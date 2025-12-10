// ===== Tools Schema =====
const TOOLS_SCHEMA = [
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for current information, news, facts, or anything you don't know. Use this when the user asks about recent events, current data, or topics you're uncertain about.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query"
                    }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "calculator",
            description: "Evaluate a mathematical expression. Use this for any calculations to ensure accuracy.",
            parameters: {
                type: "object",
                properties: {
                    expression: {
                        type: "string",
                        description: "Mathematical expression to evaluate, e.g., '523 * 847' or 'sqrt(144)'"
                    }
                },
                required: ["expression"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_datetime",
            description: "Get the current date and time. Use this when asked about today's date, current time, or day of the week.",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "save_memory",
            description: "Save an important fact about the user to remember for future conversations. Use this when the user shares personal information, preferences, important dates, or anything they'd want you to remember across chats.",
            parameters: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "The fact or information to remember, e.g., 'User's favorite color is blue' or 'User has a dog named Max'"
                    }
                },
                required: ["content"]
            }
        }
    }
];

// ===== App State =====
const state = {
    currentUser: null,
    currentChat: null,
    messages: [],
    currentImage: null,
    isStreaming: false,
    users: [],
    chats: [],
    folders: [],
    toolsEnabled: true, // Testing with Ollama
    searchEnabled: false,
    lastSearchResults: null,
    settings: {
        apiEndpoint: '/api/ollama',
        model: '',
        systemPrompt: '',
        streamingEnabled: true
    },
    // Voice State
    isListening: false,
    recognition: null,
    synth: window.speechSynthesis,
    // Documents (RAG)
    documents: [],  // Array of {name, text, size}
    // Memories (cross-chat)
    memories: []  // Array of {id, userId, content, category, createdAt}
};

// ===== DOM Elements =====
const elements = {
    // Main
    chatContainer: document.getElementById('chatContainer'),
    messagesContainer: document.getElementById('messages'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    micBtn: document.getElementById('micBtn'), // Microphone Button
    chatTitle: document.getElementById('chatTitle'),

    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    menuBtn: document.getElementById('menuBtn'),
    userProfile: document.getElementById('userProfile'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    newChatBtn: document.getElementById('newChatBtn'),
    folderList: document.getElementById('folderList'),
    chatList: document.getElementById('chatList'),
    addFolderBtn: document.getElementById('addFolderBtn'),

    // Image
    attachBtn: document.getElementById('attachBtn'),
    imageInput: document.getElementById('imageInput'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer'),
    imagePreview: document.getElementById('imagePreview'),
    removeImage: document.getElementById('removeImage'),

    // Settings Modal
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    apiEndpoint: document.getElementById('apiEndpoint'),
    modelSelect: document.getElementById('modelSelect'),
    systemPrompt: document.getElementById('systemPrompt'),
    streamingEnabled: document.getElementById('streamingEnabled'),
    refreshModels: document.getElementById('refreshModels'),
    saveSettings: document.getElementById('saveSettings'),
    currentModel: document.getElementById('currentModel'),

    // User Modal
    userModal: document.getElementById('userModal'),
    closeUserModal: document.getElementById('closeUserModal'),
    userList: document.getElementById('userList'),
    newUserName: document.getElementById('newUserName'),
    createUserBtn: document.getElementById('createUserBtn'),

    // Folder Modal
    folderModal: document.getElementById('folderModal'),
    closeFolderModal: document.getElementById('closeFolderModal'),
    folderModalTitle: document.getElementById('folderModalTitle'),
    folderName: document.getElementById('folderName'),
    folderColorPicker: document.getElementById('folderColorPicker'),
    saveFolderBtn: document.getElementById('saveFolderBtn'),
    deleteFolderBtn: document.getElementById('deleteFolderBtn'),

    // Search
    searchBtn: document.getElementById('searchBtn'),
    searchPreview: document.getElementById('searchPreview'),
    searchPreviewContent: document.getElementById('searchPreviewContent'),
    closeSearchPreview: document.getElementById('closeSearchPreview'),

    // Other
    clearChat: document.getElementById('clearChat'),
    contextMenu: document.getElementById('contextMenu'),
    toast: document.getElementById('toast'),

    // Model Manager
    modelsBtn: document.getElementById('modelsBtn'),
    modelManagerModal: document.getElementById('modelManagerModal'),
    closeModelManager: document.getElementById('closeModelManager'),
    modelNameInput: document.getElementById('modelNameInput'),
    downloadModelBtn: document.getElementById('downloadModelBtn'),
    modelProgress: document.getElementById('modelProgress'),
    progressText: document.getElementById('progressText'),
    progressFill: document.getElementById('progressFill'),
    modelList: document.getElementById('modelList'),

    // Documents (RAG)
    docBtn: document.getElementById('docBtn'),
    docInput: document.getElementById('docInput'),
    documentContext: document.getElementById('documentContext'),
    documentList: document.getElementById('documentList'),
    clearDocuments: document.getElementById('clearDocuments'),

    // Mobile actions menu
    actionsToggle: document.getElementById('actionsToggle'),
    actionsMenu: document.getElementById('actionsMenu'),

    // Memory
    memoryBtn: document.getElementById('memoryBtn'),
    memoryModal: document.getElementById('memoryModal'),
    closeMemory: document.getElementById('closeMemory'),
    memoryInput: document.getElementById('memoryInput'),
    addMemoryBtn: document.getElementById('addMemoryBtn'),
    memoryCount: document.getElementById('memoryCount'),
    memoryList: document.getElementById('memoryList'),
    clearAllMemories: document.getElementById('clearAllMemories')
};

// ===== Voice Functions (Defined before init) =====
function setupVoiceInput() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SpeechRecognition();
        state.recognition.continuous = false;
        state.recognition.interimResults = false;
        state.recognition.lang = 'en-US';

        state.recognition.onstart = () => {
            state.isListening = true;
            elements.micBtn.classList.add('listening');
        };

        state.recognition.onend = () => {
            state.isListening = false;
            elements.micBtn.classList.remove('listening');
        };

        state.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            elements.messageInput.value += (elements.messageInput.value ? ' ' : '') + transcript;
            elements.messageInput.focus();
            autoResizeTextarea(elements.messageInput);
        };

        state.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            state.isListening = false;
            elements.micBtn.classList.remove('listening');
            showToast('Voice input error: ' + event.error, 'error');
        };
    } else {
        console.log('Speech recognition not supported');

        // Explain why to the user
        if (!window.isSecureContext) {
            console.warn('Voice input requires a secure context (HTTPS) or localhost.');
            // Only show toast if we are NOT on localhost (prevent spamming pc users if browser just doesn't have it)
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                showToast('Voice input unavailable via HTTP. Use HTTPS or localhost.', 'error');
            }
        }
    }
}

function toggleVoiceInput() {
    if (!state.recognition) {
        if (!window.isSecureContext) {
            showToast('Voice input unavailable via HTTP. Use HTTPS or localhost.', 'error');
        } else {
            showToast('Voice input not supported in this browser.', 'error');
        }
        return;
    }

    if (state.isListening) {
        console.log('Stopping recognition...');
        state.recognition.stop();
    } else {
        console.log('Starting recognition...');
        try {
            state.recognition.start();
            console.log('Recognition started request sent.');
        } catch (e) {
            console.error('Error starting recognition:', e);
            showToast('Error starting voice: ' + e.message, 'error');
        }
    }
}

function speakText(text, btnElement) {
    if (!state.synth) return;

    if (state.synth.speaking) {
        state.synth.cancel();
        if (btnElement) btnElement.classList.remove('speaking');
        return;
    }

    if (text) {
        const utterance = new SpeechSynthesisUtterance(text);

        // Try to select a "natural" voice if available
        const voices = state.synth.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural'));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onstart = () => {
            if (btnElement) btnElement.classList.add('speaking');
        };

        utterance.onend = () => {
            if (btnElement) btnElement.classList.remove('speaking');
        };

        utterance.onerror = () => {
            if (btnElement) btnElement.classList.remove('speaking');
        };

        state.synth.speak(utterance);
    }
}

// ===== Initialize =====
async function init() {
    // UI setup - ALWAYS runs regardless of DB state
    loadSettings();
    bindEvents();
    setupVoiceInput();
    autoResizeTextarea();
    fetchModels();

    // Database initialization - may fail on upgrade, but UI should still work
    try {
        await LocalAIDB.init();
        await loadUsers();

        // If no users, create default
        if (state.users.length === 0) {
            const user = await LocalAIDB.Users.create('User');
            state.users = [user];
        }

        // Load last used user or first user
        const lastUserId = localStorage.getItem('localai-lastUser');
        const user = state.users.find(u => u.id === parseInt(lastUserId)) || state.users[0];
        await switchUser(user.id);

    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to initialize database. Chat history may not save.', 'error');
    }
}

// ===== User Management =====
async function loadUsers() {
    state.users = await LocalAIDB.Users.getAll();
}

async function switchUser(userId) {
    const user = await LocalAIDB.Users.get(userId);
    if (!user) return;

    state.currentUser = user;
    localStorage.setItem('localai-lastUser', userId);

    // Update UI
    elements.userAvatar.textContent = user.name.charAt(0).toUpperCase();
    elements.userAvatar.style.background = user.color;
    elements.userName.textContent = user.name;

    // Load user's data
    await loadUserData();

    // Start fresh or load last chat
    if (state.chats.length > 0) {
        await loadChat(state.chats[0].id);
    } else {
        await createNewChat();
    }

    closeAllModals();
}

async function loadUserData() {
    state.folders = await LocalAIDB.Folders.getByUser(state.currentUser.id);
    state.chats = await LocalAIDB.Chats.getByUser(state.currentUser.id);
    state.memories = await LocalAIDB.Memories.getByUser(state.currentUser.id);
    renderSidebar();
}

async function createUser(name) {
    if (!name.trim()) return;
    const user = await LocalAIDB.Users.create(name.trim());
    state.users.push(user);
    await switchUser(user.id);
}

function renderUserList() {
    elements.userList.innerHTML = state.users.map(user => `
        <div class="user-list-item ${user.id === state.currentUser?.id ? 'active' : ''}" 
             data-user-id="${user.id}">
            <div class="user-avatar" style="background:${user.color}">${user.name.charAt(0).toUpperCase()}</div>
            <span class="user-name">${user.name}</span>
        </div>
    `).join('');
}

// ===== Chat Management =====
async function createNewChat() {
    const chat = await LocalAIDB.Chats.create(state.currentUser.id);
    state.chats.unshift(chat);
    await loadChat(chat.id);
    renderSidebar();
    closeSidebar();
}

async function loadChat(chatId) {
    const chat = await LocalAIDB.Chats.get(chatId);
    if (!chat) return;

    state.currentChat = chat;
    state.messages = chat.messages || [];

    // Update UI
    elements.chatTitle.textContent = chat.title || 'New Chat';
    elements.messagesContainer.innerHTML = '';

    if (state.messages.length === 0) {
        elements.welcomeMessage.classList.remove('hidden');
    } else {
        elements.welcomeMessage.classList.add('hidden');
        state.messages.forEach(msg => renderMessage(msg));
    }

    renderSidebar();
    scrollToBottom();
}

async function saveCurrentChat() {
    if (!state.currentChat) return;
    await LocalAIDB.Chats.updateMessages(state.currentChat.id, state.messages);

    // Refresh chat in state
    const updated = await LocalAIDB.Chats.get(state.currentChat.id);
    state.currentChat = updated;

    // Update title in header
    elements.chatTitle.textContent = updated.title || 'New Chat';

    // Update sidebar
    const idx = state.chats.findIndex(c => c.id === updated.id);
    if (idx !== -1) state.chats[idx] = updated;
    renderSidebar();
}

async function deleteChat(chatId) {
    if (!confirm('Delete this chat?')) return;

    await LocalAIDB.Chats.delete(chatId);
    state.chats = state.chats.filter(c => c.id !== chatId);

    if (state.currentChat?.id === chatId) {
        if (state.chats.length > 0) {
            await loadChat(state.chats[0].id);
        } else {
            await createNewChat();
        }
    }

    renderSidebar();
    hideContextMenu();
}

async function renameChat(chatId) {
    const chat = await LocalAIDB.Chats.get(chatId);
    const newTitle = prompt('Rename chat:', chat.title);
    if (newTitle && newTitle.trim()) {
        chat.title = newTitle.trim();
        await LocalAIDB.Chats.update(chat);

        if (state.currentChat?.id === chatId) {
            state.currentChat = chat;
            elements.chatTitle.textContent = chat.title;
        }

        const idx = state.chats.findIndex(c => c.id === chatId);
        if (idx !== -1) state.chats[idx] = chat;

        renderSidebar();
    }
    hideContextMenu();
}

// ===== Folder Management =====
async function createFolder(name, color) {
    const folder = await LocalAIDB.Folders.create(state.currentUser.id, name, color);
    state.folders.push(folder);
    renderSidebar();
}

async function updateFolder(folderId, name, color) {
    const folder = await LocalAIDB.Folders.get(folderId);
    if (folder) {
        folder.name = name;
        folder.color = color;
        await LocalAIDB.Folders.update(folder);
        const idx = state.folders.findIndex(f => f.id === folderId);
        if (idx !== -1) state.folders[idx] = folder;
        renderSidebar();
    }
}

async function deleteFolder(folderId) {
    if (!confirm('Delete this folder? Chats will be moved to unsorted.')) return;
    await LocalAIDB.Folders.delete(folderId);
    state.folders = state.folders.filter(f => f.id !== folderId);

    // Refresh chats (they were moved to unsorted)
    state.chats = await LocalAIDB.Chats.getByUser(state.currentUser.id);
    renderSidebar();
}

async function moveChatToFolder(chatId, folderId) {
    await LocalAIDB.Chats.moveToFolder(chatId, folderId);
    const idx = state.chats.findIndex(c => c.id === chatId);
    if (idx !== -1) state.chats[idx].folderId = folderId;
    renderSidebar();
    hideContextMenu();
}

// ===== Sidebar Rendering =====
function renderSidebar() {
    // Render folders
    const foldersHtml = state.folders.map(folder => {
        const folderChats = state.chats.filter(c => c.folderId === folder.id);
        return `
            <div class="folder-item" data-folder-id="${folder.id}">
                <div class="folder-header" onclick="toggleFolder(${folder.id})">
                    <span class="folder-icon" style="color:${folder.color}">📁</span>
                    <span class="folder-name">${folder.name}</span>
                    <span class="folder-count">${folderChats.length}</span>
                    <svg class="folder-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9,6 15,12 9,18"/>
                    </svg>
                </div>
                <div class="folder-chats">
                    ${folderChats.map(chat => renderChatItem(chat)).join('')}
                </div>
            </div>
        `;
    }).join('');

    elements.folderList.innerHTML = foldersHtml;

    // Render unsorted chats
    const unsortedChats = state.chats.filter(c => !c.folderId);
    elements.chatList.innerHTML = unsortedChats.map(chat => renderChatItem(chat)).join('');
}

function renderChatItem(chat) {
    const isActive = state.currentChat?.id === chat.id;
    return `
        <div class="chat-item ${isActive ? 'active' : ''}" 
             data-chat-id="${chat.id}"
             onclick="loadChat(${chat.id})">
            <span class="chat-item-icon">💬</span>
            <span class="chat-item-title">${chat.title}</span>
            <button class="chat-item-menu" onclick="event.stopPropagation(); showChatContextMenu(event, ${chat.id})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="12" cy="5" r="1"/>
                    <circle cx="12" cy="19" r="1"/>
                </svg>
            </button>
        </div>
    `;
}

function toggleFolder(folderId) {
    const el = document.querySelector(`.folder-item[data-folder-id="${folderId}"]`);
    el?.classList.toggle('open');
}

// ===== Context Menu =====
function showChatContextMenu(event, chatId) {
    contextChatId = chatId;
    const menu = elements.contextMenu;
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.classList.add('active');
}

function hideContextMenu() {
    elements.contextMenu.classList.remove('active');
    contextChatId = null;
}

// ===== Sidebar Toggle (Mobile) =====
function openSidebar() {
    elements.sidebar.classList.add('open');
    elements.sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('active');
}

// ===== Settings Management =====
function loadSettings() {
    const saved = localStorage.getItem('localai-settings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.settings = { ...state.settings, ...parsed };
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    elements.apiEndpoint.value = state.settings.apiEndpoint;
    elements.systemPrompt.value = state.settings.systemPrompt;
    elements.streamingEnabled.checked = state.settings.streamingEnabled;
}

function saveSettings() {
    state.settings.apiEndpoint = elements.apiEndpoint.value.trim() || 'http://127.0.0.1:3115';
    state.settings.model = elements.modelSelect.value;
    state.settings.systemPrompt = elements.systemPrompt.value.trim();
    state.settings.streamingEnabled = elements.streamingEnabled.checked;

    localStorage.setItem('localai-settings', JSON.stringify(state.settings));

    updateModelDisplay();
    closeAllModals();
    showToast('Settings saved!', 'success');
    fetchModels();
}

function updateModelDisplay() {
    const modelName = state.settings.model || 'No model selected';
    elements.currentModel.textContent = modelName.split('/').pop();
}

// ===== API Communication =====
async function fetchModels() {
    try {
        const response = await fetch(`${state.settings.apiEndpoint}/v1/models`);
        if (!response.ok) throw new Error('Failed to fetch models');

        const data = await response.json();
        const models = data.data || [];

        elements.modelSelect.innerHTML = '';

        if (models.length === 0) {
            elements.modelSelect.innerHTML = '<option value="">No models loaded</option>';
            elements.currentModel.textContent = 'No model loaded';
            return;
        }

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            if (model.id === state.settings.model) option.selected = true;
            elements.modelSelect.appendChild(option);
        });

        if (!state.settings.model && models.length > 0) {
            state.settings.model = models[0].id;
            localStorage.setItem('localai-settings', JSON.stringify(state.settings));
        }

        updateModelDisplay();
        elements.currentModel.style.color = 'var(--success)';

    } catch (error) {
        console.error('Error fetching models:', error);
        elements.modelSelect.innerHTML = '<option value="">Connection failed</option>';
        elements.currentModel.textContent = 'Not connected';
        elements.currentModel.style.color = 'var(--error)';
    }
}

async function sendMessage() {
    const text = elements.messageInput.value.trim();
    const image = state.currentImage;

    if (!text && !image) return;
    if (state.isStreaming) return;

    elements.welcomeMessage.classList.add('hidden');

    const userMessage = {
        role: 'user',
        content: text,
        image: image,
        timestamp: new Date().toISOString()
    };

    state.messages.push(userMessage);
    renderMessage(userMessage);

    elements.messageInput.value = '';
    clearImage();
    autoResizeTextarea();

    const typingEl = showTypingIndicator();

    // Perform web search if enabled
    let searchContext = null;
    if (state.searchEnabled && text) {
        try {
            elements.searchBtn.classList.add('searching');
            searchContext = await performWebSearch(text);
            elements.searchBtn.classList.remove('searching');
        } catch (e) {
            console.error('Search failed:', e);
            elements.searchBtn.classList.remove('searching');
        }
    }

    const apiMessages = buildApiMessages(searchContext);

    try {
        state.isStreaming = true;
        elements.sendBtn.disabled = true;

        // Use non-streaming when tools are enabled (tool calls don't work with streaming)
        if (state.toolsEnabled || !state.settings.streamingEnabled) {
            await fetchResponse(apiMessages, typingEl, searchContext);
        } else {
            await streamResponse(apiMessages, typingEl, searchContext);
        }

        await saveCurrentChat();

    } catch (error) {
        console.error('Error:', error);
        typingEl.remove();

        const errorMessage = {
            role: 'assistant',
            content: `⚠️ Error: ${error.message}`,
            timestamp: new Date().toISOString()
        };
        state.messages.push(errorMessage);
        renderMessage(errorMessage);
        await saveCurrentChat();

    } finally {
        state.isStreaming = false;
        elements.sendBtn.disabled = false;
        hideSearchPreview();
    }
}

function buildApiMessages(searchContext = null) {
    const messages = [];

    // Build system prompt with current date and search context
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US');

    let systemContent = `Current date and time: ${dateStr}, ${timeStr}\n\n`;

    // Add user memories if any exist
    if (state.memories.length > 0) {
        const memoryList = state.memories.map(m => `- ${m.content}`).join('\n');
        systemContent += `THINGS YOU REMEMBER ABOUT THIS USER:\n${memoryList}\n\n`;
    }

    // Add document context if any documents are attached
    if (state.documents.length > 0) {
        const docContext = state.documents.map(doc =>
            `=== Document: ${doc.name} ===\n${doc.text}`
        ).join('\n\n');

        systemContent += `You have access to the following documents. Use them to answer questions accurately.\n\nDOCUMENTS:\n${docContext}\n\n---\n\n`;
    }

    if (searchContext) {
        systemContent += `Use ONLY the following search results to answer. If info is not in the results, say "I don't have that information."

SEARCH RESULTS:
${searchContext.context}
---
`;
    }

    systemContent += state.settings.systemPrompt || '';

    if (systemContent.trim()) {
        messages.push({ role: 'system', content: systemContent });
    }

    for (const msg of state.messages) {
        if (msg.role === 'user') {
            if (msg.image) {
                messages.push({
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: msg.image } },
                        { type: 'text', text: msg.content || 'What do you see in this image?' }
                    ]
                });
            } else {
                messages.push({ role: 'user', content: msg.content });
            }
        } else {
            messages.push({ role: 'assistant', content: msg.content });
        }
    }

    return messages;
}

async function streamResponse(messages, typingEl) {
    const response = await fetch(`${state.settings.apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: state.settings.model,
            messages: messages,
            stream: true
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    typingEl.remove();

    const assistantMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
    };

    const messageEl = renderMessage(assistantMessage, true);
    const contentEl = messageEl.querySelector('.message-content');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        assistantMessage.content += delta;
                        contentEl.innerHTML = formatMessage(assistantMessage.content, false);
                        scrollToBottom();
                    }
                } catch (e) { }
            }
        }
    }

    contentEl.innerHTML = formatMessage(assistantMessage.content, true);
    state.messages.push(assistantMessage);
}

async function fetchResponse(messages, typingEl, searchContext = null) {
    // Use tools if enabled
    const requestBody = {
        model: state.settings.model,
        messages: messages,
        stream: false
    };

    if (state.toolsEnabled) {
        requestBody.tools = TOOLS_SCHEMA;
        requestBody.tool_choice = "auto";
    }

    let response = await fetch(`${state.settings.apiEndpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    // If model doesn't support tools (400 error), retry without them
    if (!response.ok && state.toolsEnabled && response.status === 400) {
        console.log('Model does not support tools, retrying without...');
        delete requestBody.tools;
        delete requestBody.tool_choice;
        response = await fetch(`${state.settings.apiEndpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    let data = await response.json();
    let choice = data.choices?.[0];

    // Tool call loop
    let loopCount = 0;
    const maxLoops = 5;

    while (choice?.message?.tool_calls && loopCount < maxLoops) {
        loopCount++;
        console.log('Tool calls detected:', choice.message.tool_calls);

        // Add assistant's tool call message to conversation
        messages.push(choice.message);

        // Execute each tool call
        for (const toolCall of choice.message.tool_calls) {
            const result = await executeTool(toolCall);
            console.log('Tool result:', result);

            // Add tool result to messages
            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(result)
            });

            // Show tool usage indicator
            showToolUsage(toolCall.function.name);
        }

        // Request next response with tool results
        response = await fetch(`${state.settings.apiEndpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: state.settings.model,
                messages: messages,
                stream: false,
                tools: TOOLS_SCHEMA,
                tool_choice: "auto"
            })
        });

        if (!response.ok) {
            throw new Error(`Tool loop failed: HTTP ${response.status}`);
        }

        data = await response.json();
        choice = data.choices?.[0];
    }

    typingEl.remove();

    const content = choice?.message?.content || 'No response received.';

    const assistantMessage = {
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString()
    };

    state.messages.push(assistantMessage);
    renderMessage(assistantMessage);
}

// ===== Tool Execution =====
async function executeTool(toolCall) {
    const name = toolCall.function.name;
    let args;

    try {
        args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
        return { error: "Failed to parse arguments" };
    }

    switch (name) {
        case "web_search":
            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: args.query, num_results: 5 })
                });
                const data = await response.json();
                return { results: data.context || "No results found" };
            } catch (e) {
                return { error: "Search failed: " + e.message };
            }

        case "calculator":
            try {
                // Safe math evaluation
                const expr = args.expression.replace(/[^0-9+\-*/().sqrt,pow,abs,sin,cos,tan,log,PI,E\s]/gi, '');
                const result = Function('"use strict"; return (' + expr.replace(/sqrt/g, 'Math.sqrt').replace(/pow/g, 'Math.pow').replace(/PI/g, 'Math.PI').replace(/E/g, 'Math.E').replace(/abs/g, 'Math.abs').replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan').replace(/log/g, 'Math.log') + ')')();
                return { result: result };
            } catch (e) {
                return { error: "Calculation failed: " + e.message };
            }

        case "get_datetime":
            const now = new Date();
            return {
                date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
                time: now.toLocaleTimeString('en-US'),
                iso: now.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };

        case "save_memory":
            try {
                if (!state.currentUser) {
                    return { error: "No user logged in" };
                }
                const memory = await LocalAIDB.Memories.create(
                    state.currentUser.id,
                    args.content,
                    'fact'
                );
                state.memories.push(memory);
                showToast('💾 Memory saved!', 'success');
                return { success: true, message: `Saved memory: "${args.content}"` };
            } catch (e) {
                return { error: "Failed to save memory: " + e.message };
            }

        default:
            return { error: "Unknown tool: " + name };
    }
}

function showToolUsage(toolName) {
    const icons = {
        web_search: '🔍',
        calculator: '🧮',
        get_datetime: '📅',
        save_memory: '💾'
    };
    showToast(`${icons[toolName] || '🔧'} Using ${toolName}...`);
}

// ===== Message Rendering =====
function renderMessage(message, isStreaming = false) {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;

    let html = '';

    if (message.image) {
        html += `<img src="${message.image}" alt="Attached image" class="message-image">`;
    }

    html += `<div class="message-content">${isStreaming ? '' : formatMessage(message.content)}</div>`;

    const time = message.timestamp ? formatTime(new Date(message.timestamp)) : '';
    html += `<span class="message-time">${time}</span>`;

    // Add Speak Button for Assistant
    if (message.role === 'assistant' && !isStreaming) {
        // SVG Icon: Volume/Speak
        const speakIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        html += `<button class="speak-msg-btn" title="Read Aloud">${speakIcon}</button>`;
    }

    div.innerHTML = html;

    // Attach Speak Event
    if (message.role === 'assistant' && !isStreaming) {
        const speakBtn = div.querySelector('.speak-msg-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                // Strip HTML tags for speaking
                const textToSpeak = div.querySelector('.message-content').innerText;
                speakText(textToSpeak, speakBtn);
            });
        }
    }

    elements.messagesContainer.appendChild(div);
    scrollToBottom();

    return div;
}

function formatMessage(text, isComplete = true) {
    if (!text) return '';

    const thinkingPatterns = [
        /\[THINK\]([\s\S]*?)\[\/THINK\]/gi,
        /\[THINKING\]([\s\S]*?)\[\/THINKING\]/gi
    ];

    let thinkingContent = '';
    let mainContent = text;

    for (const pattern of thinkingPatterns) {
        const match = mainContent.match(pattern);
        if (match) {
            const thinkMatch = match[0].match(/\[THINK(?:ING)?\]([\s\S]*?)\[\/THINK(?:ING)?\]/i);
            if (thinkMatch) thinkingContent = thinkMatch[1];
            mainContent = mainContent.replace(pattern, '').trim();
        }
    }

    const incompletePattern = /\[THINK(?:ING)?\]([\s\S]*)$/i;
    let isThinking = false;

    const incompleteMatch = mainContent.match(incompletePattern);
    if (incompleteMatch) {
        thinkingContent = incompleteMatch[1];
        mainContent = mainContent.replace(incompletePattern, '').trim();
        isThinking = true;
    }

    let formatted = mainContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Convert URLs to clickable links
    formatted = formatted.replace(
        /(https?:\/\/[^\s<>"']+)/g,
        '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    formatted = formatted.replace(/\n/g, '<br>');

    let html = '';

    if (thinkingContent) {
        const thinkingFormatted = thinkingContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');

        const isOpen = isThinking || !isComplete;
        html += `<details class="thinking-block" ${isOpen ? 'open' : ''}>
            <summary class="thinking-header">
                <span class="thinking-icon">${isThinking ? '⏳' : '💭'}</span>
                <span class="thinking-label">${isThinking ? 'Thinking...' : 'Thought process'}</span>
                <span class="thinking-toggle"></span>
            </summary>
            <div class="thinking-content">${thinkingFormatted}</div>
        </details>`;
    }

    if (formatted) html += formatted;

    return html;
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    elements.messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
}

function scrollToBottom() {
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

// ===== Image Handling =====
function handleImageSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 1024;
            let width = img.width;
            let height = img.height;

            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = (height / width) * maxSize;
                    width = maxSize;
                } else {
                    width = (width / height) * maxSize;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            state.currentImage = canvas.toDataURL('image/jpeg', 0.85);
            elements.imagePreview.src = state.currentImage;
            elements.imagePreviewContainer.classList.add('active');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function clearImage() {
    state.currentImage = null;
    elements.imagePreviewContainer.classList.remove('active');
    elements.imagePreview.src = '';
}

// ===== Modals =====
function openModal(modalEl) {
    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
    document.body.style.overflow = '';
}

function openUserModal() {
    renderUserList();
    openModal(elements.userModal);
}

function openFolderModal(folderId = null) {
    editingFolderId = folderId;

    if (folderId) {
        const folder = state.folders.find(f => f.id === folderId);
        elements.folderModalTitle.textContent = 'Edit Folder';
        elements.folderName.value = folder?.name || '';
        elements.deleteFolderBtn.style.display = 'block';
        selectFolderColor(folder?.color || '#6366f1');
    } else {
        elements.folderModalTitle.textContent = 'New Folder';
        elements.folderName.value = '';
        elements.deleteFolderBtn.style.display = 'none';
        selectFolderColor('#6366f1');
    }

    openModal(elements.folderModal);
}

function selectFolderColor(color) {
    elements.folderColorPicker.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === color);
    });
}

function getSelectedFolderColor() {
    return elements.folderColorPicker.querySelector('.color-option.selected')?.dataset.color || '#6366f1';
}

async function saveFolderFromModal() {
    const name = elements.folderName.value.trim();
    if (!name) {
        showToast('Please enter a folder name', 'error');
        return;
    }

    const color = getSelectedFolderColor();

    if (editingFolderId) {
        await updateFolder(editingFolderId, name, color);
    } else {
        await createFolder(name, color);
    }

    closeAllModals();
}

// ===== Toast =====
function showToast(message, type = '') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} active`;
    setTimeout(() => elements.toast.classList.remove('active'), 3000);
}

// ===== Textarea Auto-resize =====
function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// ===== Clear Chat =====
async function clearCurrentChat() {
    if (state.messages.length === 0) return;

    if (confirm('Clear all messages in this chat?')) {
        state.messages = [];
        elements.messagesContainer.innerHTML = '';
        elements.welcomeMessage.classList.remove('hidden');
        await saveCurrentChat();
    }
}

// ===== Event Binding =====
function bindEvents() {
    // Send message
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    elements.messageInput.addEventListener('input', autoResizeTextarea);

    // Image handling
    elements.attachBtn.addEventListener('click', () => elements.imageInput.click());
    elements.imageInput.addEventListener('change', handleImageSelect);
    elements.removeImage.addEventListener('click', clearImage);

    // Search
    elements.searchBtn.addEventListener('click', toggleSearch);
    elements.closeSearchPreview.addEventListener('click', hideSearchPreview);

    // Documents (RAG)
    elements.docBtn.addEventListener('click', () => elements.docInput.click());
    elements.docInput.addEventListener('change', handleDocumentUpload);
    elements.clearDocuments.addEventListener('click', clearAllDocuments);

    // Voice
    if (elements.micBtn) {
        elements.micBtn.addEventListener('click', toggleVoiceInput);
    }

    // Sidebar
    elements.menuBtn.addEventListener('click', openSidebar);
    elements.sidebarOverlay.addEventListener('click', closeSidebar);
    elements.newChatBtn.addEventListener('click', createNewChat);
    elements.userProfile.addEventListener('click', openUserModal);
    elements.addFolderBtn.addEventListener('click', () => openFolderModal());

    // User modal
    elements.closeUserModal.addEventListener('click', closeAllModals);
    elements.createUserBtn.addEventListener('click', () => {
        createUser(elements.newUserName.value);
        elements.newUserName.value = '';
    });
    elements.newUserName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            createUser(elements.newUserName.value);
            elements.newUserName.value = '';
        }
    });
    elements.userList.addEventListener('click', (e) => {
        const item = e.target.closest('.user-list-item');
        if (item) switchUser(parseInt(item.dataset.userId));
    });

    // Folder modal
    elements.closeFolderModal.addEventListener('click', closeAllModals);
    elements.saveFolderBtn.addEventListener('click', saveFolderFromModal);
    elements.deleteFolderBtn.addEventListener('click', () => {
        if (editingFolderId) {
            deleteFolder(editingFolderId);
            closeAllModals();
        }
    });
    elements.folderColorPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('color-option')) {
            selectFolderColor(e.target.dataset.color);
        }
    });

    // Settings modal
    elements.settingsBtn.addEventListener('click', () => openModal(elements.settingsModal));
    elements.closeSettings.addEventListener('click', closeAllModals);
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.refreshModels.addEventListener('click', fetchModels);

    // Model Manager
    elements.modelsBtn.addEventListener('click', openModelManager);
    elements.closeModelManager.addEventListener('click', closeAllModals);
    elements.downloadModelBtn.addEventListener('click', pullModel);
    elements.modelNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pullModel();
    });

    // Memory Manager
    elements.memoryBtn.addEventListener('click', openMemoryModal);
    elements.closeMemory.addEventListener('click', closeAllModals);
    elements.addMemoryBtn.addEventListener('click', addMemoryManual);
    elements.memoryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addMemoryManual();
    });
    elements.clearAllMemories.addEventListener('click', async () => {
        if (confirm('Delete all memories? This cannot be undone.')) {
            await LocalAIDB.Memories.deleteByUser(state.currentUser.id);
            state.memories = [];
            renderMemoryList();
            showToast('All memories cleared');
        }
    });

    // Clear chat
    elements.clearChat.addEventListener('click', clearCurrentChat);

    // Context menu
    elements.contextMenu.addEventListener('click', async (e) => {
        const action = e.target.closest('.context-item')?.dataset.action;
        if (!action || !contextChatId) return;

        switch (action) {
            case 'rename':
                await renameChat(contextChatId);
                break;
            case 'delete':
                await deleteChat(contextChatId);
                break;
            case 'move':
                // Simple move - for now just show folder picker
                const folderNames = state.folders.map(f => f.name).join(', ') || 'No folders';
                const targetName = prompt(`Move to folder:\nAvailable: ${folderNames}\n\nOr type "unsorted" to remove from folder:`);
                if (targetName) {
                    if (targetName.toLowerCase() === 'unsorted') {
                        await moveChatToFolder(contextChatId, null);
                    } else {
                        const folder = state.folders.find(f => f.name.toLowerCase() === targetName.toLowerCase());
                        if (folder) {
                            await moveChatToFolder(contextChatId, folder.id);
                        } else {
                            showToast('Folder not found', 'error');
                        }
                    }
                }
                hideContextMenu();
                break;
        }
    });

    // Close context menu on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu') && !e.target.closest('.chat-item-menu')) {
            hideContextMenu();
        }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeAllModals();
        });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
            hideContextMenu();
            closeSidebar();
            // Also close mobile actions menu
            if (elements.actionsMenu) {
                elements.actionsMenu.classList.remove('show');
                elements.actionsToggle?.classList.remove('active');
            }
        }
    });

    // Mobile actions toggle
    if (elements.actionsToggle) {
        elements.actionsToggle.addEventListener('click', () => {
            elements.actionsMenu.classList.toggle('show');
            elements.actionsToggle.classList.toggle('active');
        });
    }

    // Close actions menu when clicking an action button
    if (elements.actionsMenu) {
        elements.actionsMenu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                // Small delay to let the action trigger first
                setTimeout(() => {
                    elements.actionsMenu.classList.remove('show');
                    elements.actionsToggle?.classList.remove('active');
                }, 100);
            });
        });
    }

    // Close actions menu when clicking outside
    document.addEventListener('click', (e) => {
        if (elements.actionsMenu?.classList.contains('show')) {
            if (!e.target.closest('.actions-menu') && !e.target.closest('.actions-toggle')) {
                elements.actionsMenu.classList.remove('show');
                elements.actionsToggle?.classList.remove('active');
            }
        }
    });
}

// Make functions available globally for onclick handlers
window.loadChat = loadChat;
window.toggleFolder = toggleFolder;
window.showChatContextMenu = showChatContextMenu;

// Endpoint preset helper
function setEndpoint(url) {
    elements.apiEndpoint.value = url;
    fetchModels();
}
window.setEndpoint = setEndpoint;

// ===== Web Search =====
async function performWebSearch(query) {
    const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, num_results: 5 })
    });

    if (!response.ok) {
        throw new Error('Search failed');
    }

    const data = await response.json();
    state.lastSearchResults = data;
    showSearchPreview(data);
    return data;
}

function toggleSearch() {
    state.searchEnabled = !state.searchEnabled;
    elements.searchBtn.classList.toggle('active', state.searchEnabled);

    if (state.searchEnabled) {
        elements.messageInput.placeholder = '🔍 Search enabled - ask anything...';
        showToast('Web search enabled', 'success');
    } else {
        elements.messageInput.placeholder = 'Type a message...';
        hideSearchPreview();
    }
}

function showSearchPreview(data) {
    if (!data || !data.results || data.results.length === 0) return;

    const html = data.results.map(r => `
        <div class="search-result-item">
            <div class="search-result-title">${escapeHtml(r.title)}</div>
            <div class="search-result-url">${escapeHtml(r.url)}</div>
            <div class="search-result-snippet">${escapeHtml(r.snippet)}</div>
        </div>
    `).join('');

    elements.searchPreviewContent.innerHTML = html;
    elements.searchPreview.classList.add('active');
}

function hideSearchPreview() {
    elements.searchPreview.classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== Document Handling (RAG) =====
async function handleDocumentUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['.pdf', '.txt', '.md', '.markdown'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(ext)) {
        showToast('Unsupported file type. Use PDF, TXT, or MD.', 'error');
        return;
    }

    // Show loading
    showToast('Extracting text from document...', '');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();

        if (!data.text || data.text.startsWith('[')) {
            showToast('Could not extract text from document', 'error');
            return;
        }

        // Add to documents
        addDocument(data.filename, data.text);
        showToast(`Added: ${data.filename}`, 'success');

    } catch (error) {
        console.error('Document upload error:', error);
        showToast('Failed to upload document', 'error');
    }

    // Reset input
    event.target.value = '';
}

function addDocument(name, text) {
    // Limit text size to prevent huge prompts (first 50k chars)
    const truncatedText = text.length > 50000 ? text.substring(0, 50000) + '\n\n[Document truncated...]' : text;

    state.documents.push({
        name: name,
        text: truncatedText,
        size: text.length
    });

    renderDocumentList();
}

function removeDocument(index) {
    state.documents.splice(index, 1);
    renderDocumentList();
}

function clearAllDocuments() {
    state.documents = [];
    renderDocumentList();
}

function renderDocumentList() {
    if (state.documents.length === 0) {
        elements.documentContext.classList.remove('active');
        return;
    }

    elements.documentContext.classList.add('active');

    elements.documentList.innerHTML = state.documents.map((doc, index) => {
        const sizeKb = (doc.size / 1024).toFixed(1);
        return `
            <div class="document-chip">
                <span class="document-chip-name" title="${escapeHtml(doc.name)}">📄 ${escapeHtml(doc.name)}</span>
                <span class="document-chip-size">${sizeKb}KB</span>
                <button class="document-chip-remove" onclick="removeDocument(${index})" title="Remove">×</button>
            </div>
        `;
    }).join('');
}

window.removeDocument = removeDocument; // Make available for onclick

// ===== Model Manager =====
async function openModelManager() {
    openModal(elements.modelManagerModal);
    await fetchInstalledModels();
}

async function fetchInstalledModels() {
    try {
        elements.modelList.innerHTML = '<div class="model-list-loading">Loading models...</div>';

        const response = await fetch('/api/ollama/api/tags');
        if (!response.ok) throw new Error('Failed to fetch models');

        const data = await response.json();
        renderModelList(data.models || []);
    } catch (error) {
        console.error('Error fetching models:', error);
        elements.modelList.innerHTML = '<div class="model-list-loading">Failed to load models</div>';
    }
}

function renderModelList(models) {
    if (models.length === 0) {
        elements.modelList.innerHTML = '<div class="model-list-loading">No models installed</div>';
        return;
    }

    elements.modelList.innerHTML = models.map(model => {
        const sizeGB = model.size ? (model.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : 'Unknown';
        return `
            <div class="model-item">
                <div class="model-item-info">
                    <div class="model-item-name">🤖 ${escapeHtml(model.name)}</div>
                    <div class="model-item-details">${sizeGB}</div>
                </div>
                <div class="model-item-actions">
                    <button class="model-delete-btn" onclick="deleteModel('${escapeHtml(model.name)}')" title="Delete model">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function pullModel() {
    const modelName = elements.modelNameInput.value.trim();
    if (!modelName) {
        showToast('Please enter a model name', 'error');
        return;
    }

    elements.modelProgress.style.display = 'block';
    elements.progressText.textContent = 'Starting download...';
    elements.progressFill.style.width = '0%';
    elements.downloadModelBtn.disabled = true;

    try {
        const response = await fetch('/api/ollama/api/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        if (!response.ok) {
            throw new Error('Failed to start download');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.status) {
                        elements.progressText.textContent = data.status;
                    }
                    if (data.completed && data.total) {
                        const percent = Math.round((data.completed / data.total) * 100);
                        elements.progressFill.style.width = percent + '%';
                    }
                    if (data.status === 'success') {
                        showToast('Model downloaded successfully!', 'success');
                    }
                } catch (e) {
                    // Ignore parse errors for partial lines
                }
            }
        }

        elements.modelNameInput.value = '';
        await fetchInstalledModels();
        await fetchModels(); // Refresh the settings dropdown too

    } catch (error) {
        console.error('Error pulling model:', error);
        showToast('Failed to download model: ' + error.message, 'error');
    } finally {
        elements.modelProgress.style.display = 'none';
        elements.downloadModelBtn.disabled = false;
    }
}

async function deleteModel(modelName) {
    if (!confirm(`Delete model "${modelName}"?`)) return;

    try {
        const response = await fetch('/api/ollama/api/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });

        if (!response.ok) {
            throw new Error('Failed to delete model');
        }

        showToast('Model deleted', 'success');
        await fetchInstalledModels();
        await fetchModels(); // Refresh the settings dropdown too

    } catch (error) {
        console.error('Error deleting model:', error);
        showToast('Failed to delete model: ' + error.message, 'error');
    }
}

window.deleteModel = deleteModel; // Make available for onclick

// ===== Memory Manager =====
function openMemoryModal() {
    openModal(elements.memoryModal);
    renderMemoryList();
}

async function addMemoryManual() {
    const content = elements.memoryInput.value.trim();
    if (!content) return;

    try {
        const memory = await LocalAIDB.Memories.create(
            state.currentUser.id,
            content,
            'fact'
        );
        state.memories.push(memory);
        elements.memoryInput.value = '';
        renderMemoryList();
        showToast('Memory saved!', 'success');
    } catch (error) {
        console.error('Error saving memory:', error);
        showToast('Failed to save memory', 'error');
    }
}

async function deleteMemory(memoryId) {
    try {
        await LocalAIDB.Memories.delete(memoryId);
        state.memories = state.memories.filter(m => m.id !== memoryId);
        renderMemoryList();
        showToast('Memory deleted');
    } catch (error) {
        console.error('Error deleting memory:', error);
        showToast('Failed to delete memory', 'error');
    }
}

function renderMemoryList() {
    elements.memoryCount.textContent = state.memories.length;

    if (state.memories.length === 0) {
        elements.memoryList.innerHTML = `
            <div class="memory-list-empty">
                No memories saved yet. Start chatting and the AI will remember important things!
            </div>
        `;
        return;
    }

    elements.memoryList.innerHTML = state.memories.map(memory => {
        const date = new Date(memory.createdAt).toLocaleDateString();
        return `
            <div class="memory-item" data-memory-id="${memory.id}">
                <div class="memory-content">${escapeHtml(memory.content)}</div>
                <div class="memory-actions">
                    <span class="memory-date">${date}</span>
                    <button class="memory-delete" onclick="deleteMemory(${memory.id})" title="Delete">×</button>
                </div>
            </div>
        `;
    }).join('');
}

window.deleteMemory = deleteMemory; // Make available for onclick

// ===== Start App =====
init();

