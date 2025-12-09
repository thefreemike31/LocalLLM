#!/usr/bin/env python3
"""
HTTP server for Local AI Chat with web search API.
Serves static files and provides a search endpoint.

Usage:
    python serve.py

Endpoints:
    GET /           - Serves static files
    POST /api/search - Web search via DuckDuckGo
"""

import http.server
import socketserver
import sys
import socket
import json
import urllib.request
import urllib.parse
import urllib.error
import ssl
import re
from html import unescape

PORT = 8080
HOST = '0.0.0.0'

# Upstream Ollama URL (Change this if Ollama is on another machine)
# Example: 'http://192.168.7.149:11434'
OLLAMA_BASE_URL = 'http://localhost:11434'

# SSL context for HTTPS requests
ssl_context = ssl.create_default_context()


def search_duckduckgo(query, num_results=5):
    """
    Search DuckDuckGo and return results.
    Uses the HTML search page and parses results.
    """
    results = []
    
    try:
        # Use DuckDuckGo HTML search
        encoded_query = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as response:
            html = response.read().decode('utf-8')
        
        # Parse results from HTML
        # Find result links and snippets
        result_pattern = r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)</a>'
        snippet_pattern = r'<a[^>]+class="result__snippet"[^>]*>([^<]+(?:<[^>]+>[^<]*</[^>]+>)*[^<]*)</a>'
        
        links = re.findall(result_pattern, html)
        snippets = re.findall(snippet_pattern, html)
        
        for i, (link, title) in enumerate(links[:num_results]):
            snippet = snippets[i] if i < len(snippets) else ""
            # Clean up snippet
            snippet = re.sub(r'<[^>]+>', '', snippet)
            snippet = unescape(snippet).strip()
            
            # Decode the DuckDuckGo redirect URL
            if 'uddg=' in link:
                actual_url = urllib.parse.unquote(link.split('uddg=')[1].split('&')[0])
            else:
                actual_url = link
            
            results.append({
                'title': unescape(title).strip(),
                'url': actual_url,
                'snippet': snippet[:300]
            })
        
        # If no results from HTML parsing, try instant answer API
        if not results:
            api_url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1"
            req = urllib.request.Request(api_url, headers=headers)
            with urllib.request.urlopen(req, timeout=10, context=ssl_context) as response:
                data = json.loads(response.read().decode('utf-8'))
            
            # Get abstract if available
            if data.get('Abstract'):
                results.append({
                    'title': data.get('Heading', 'DuckDuckGo'),
                    'url': data.get('AbstractURL', ''),
                    'snippet': data.get('Abstract', '')[:300]
                })
            
            # Get related topics
            for topic in data.get('RelatedTopics', [])[:num_results]:
                if isinstance(topic, dict) and 'Text' in topic:
                    results.append({
                        'title': topic.get('Text', '')[:50],
                        'url': topic.get('FirstURL', ''),
                        'snippet': topic.get('Text', '')[:300]
                    })
    
    except Exception as e:
        print(f"Search error: {e}")
        results = [{'title': 'Search Error', 'url': '', 'snippet': str(e)}]
    
    return results


class SearchRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with CORS and search API."""
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Proxy Ollama API requests
        if self.path.startswith('/api/ollama/'):
            self.proxy_ollama('GET')
        else:
            super().do_GET()
    
    def do_POST(self):
        if self.path == '/api/search':
            self.handle_search()
        elif self.path.startswith('/api/ollama/'):
            self.proxy_ollama('POST')
        else:
            self.send_error(404, 'Not Found')
    
    def proxy_ollama(self, method):
        """Proxy requests to Ollama API."""
        try:
            # Forward to Ollama (configurable upstream)
            target_url = f"{OLLAMA_BASE_URL}{self.path.replace('/api/ollama', '')}"
            
            print(f"Proxying to: {target_url}")
            
            # Read request body if present
            body = None
            if 'Content-Length' in self.headers:
                content_length = int(self.headers['Content-Length'])
                body = self.rfile.read(content_length)
            
            # Create request
            req = urllib.request.Request(target_url, data=body, method=method)
            req.add_header('Content-Type', 'application/json')
            
            # Make request to Ollama (10 minute timeout for large models)
            try:
                with urllib.request.urlopen(req, timeout=600) as response:
                    result = response.read()
                    
                    self.send_response(response.status)
                    self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                    self.end_headers()
                    self.wfile.write(result)
            except urllib.error.HTTPError as e:
                # Pass through HTTP errors from Ollama (like 400 Bad Request)
                print(f"Ollama HTTP error: {e.code}")
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_body = e.read() if e.fp else b'{}'
                self.wfile.write(error_body)
                
        except urllib.error.URLError as e:
            print(f"Ollama connection error: {e}")
            self.send_json({'error': f'Cannot connect to Ollama: {e.reason}'}, 502)
        except socket.timeout:
            print("Ollama timeout - model taking too long")
            self.send_json({'error': 'Ollama timeout - model taking too long to respond'}, 504)
        except Exception as e:
            print(f"Ollama proxy error: {e}")
            self.send_json({'error': str(e)}, 500)
    
    def handle_search(self):
        """Handle search API requests."""
        try:
            content_length = int(self.headers['Content-Length'])
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            query = data.get('query', '')
            num_results = data.get('num_results', 5)
            
            if not query:
                self.send_json({'error': 'Query required'}, 400)
                return
            
            print(f"🔍 Searching: {query}")
            results = search_duckduckgo(query, num_results)
            
            # Build context for LLM
            context = f"Web search results for '{query}':\n\n"
            for i, r in enumerate(results, 1):
                context += f"{i}. {r['title']}\n"
                context += f"   URL: {r['url']}\n"
                context += f"   {r['snippet']}\n\n"
            
            self.send_json({
                'results': results,
                'context': context,
                'query': query
            })
            
        except json.JSONDecodeError:
            self.send_json({'error': 'Invalid JSON'}, 400)
        except Exception as e:
            print(f"Search error: {e}")
            self.send_json({'error': str(e)}, 500)
    
    def send_json(self, data, status=200):
        """Send JSON response."""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")


def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def main():
    local_ip = get_local_ip()
    
    print("=" * 50)
    print("  🤖 Local AI Chat Server")
    print("=" * 50)
    print()
    print(f"  Server running on port {PORT}")
    print()
    print("  Access URLs:")
    print(f"    • Local:   http://localhost:{PORT}")
    print(f"    • Network: http://{local_ip}:{PORT}")
    print()
    print("  🔍 Web Search API: POST /api/search")
    print()
    print("-" * 50)
    print("  Press Ctrl+C to stop the server")
    print("-" * 50)
    print()
    
    with socketserver.TCPServer((HOST, PORT), SearchRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 Server stopped.")
            sys.exit(0)


if __name__ == '__main__':
    main()
