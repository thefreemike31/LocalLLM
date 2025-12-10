/**
 * IndexedDB Data Layer for Local AI Chat
 * Handles users, chats, and folders storage
 */

const DB_NAME = 'LocalAIChat';
const DB_VERSION = 2;

let db = null;

// ===== Database Initialization =====
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Users store
            if (!database.objectStoreNames.contains('users')) {
                const usersStore = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                usersStore.createIndex('name', 'name', { unique: false });
            }

            // Chats store
            if (!database.objectStoreNames.contains('chats')) {
                const chatsStore = database.createObjectStore('chats', { keyPath: 'id', autoIncrement: true });
                chatsStore.createIndex('userId', 'userId', { unique: false });
                chatsStore.createIndex('folderId', 'folderId', { unique: false });
                chatsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }

            // Folders store
            if (!database.objectStoreNames.contains('folders')) {
                const foldersStore = database.createObjectStore('folders', { keyPath: 'id', autoIncrement: true });
                foldersStore.createIndex('userId', 'userId', { unique: false });
                foldersStore.createIndex('order', 'order', { unique: false });
            }

            // Memories store (v2)
            if (!database.objectStoreNames.contains('memories')) {
                const memoriesStore = database.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
                memoriesStore.createIndex('userId', 'userId', { unique: false });
                memoriesStore.createIndex('category', 'category', { unique: false });
            }
        };
    });
}

// ===== Generic DB Operations =====
function dbAdd(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbPut(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGet(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbGetByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ===== User Operations =====
const Users = {
    async create(name, color = null) {
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9'];
        const user = {
            name,
            color: color || colors[Math.floor(Math.random() * colors.length)],
            settings: {},
            createdAt: new Date().toISOString()
        };
        const id = await dbAdd('users', user);
        return { ...user, id };
    },

    async getAll() {
        return dbGetAll('users');
    },

    async get(id) {
        return dbGet('users', id);
    },

    async update(user) {
        return dbPut('users', user);
    },

    async delete(id) {
        // Also delete user's chats and folders
        const chats = await Chats.getByUser(id);
        for (const chat of chats) {
            await Chats.delete(chat.id);
        }
        const folders = await Folders.getByUser(id);
        for (const folder of folders) {
            await Folders.delete(folder.id);
        }
        return dbDelete('users', id);
    }
};

// ===== Chat Operations =====
const Chats = {
    async create(userId, title = 'New Chat', folderId = null) {
        const chat = {
            userId,
            folderId,
            title,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const id = await dbAdd('chats', chat);
        return { ...chat, id };
    },

    async get(id) {
        return dbGet('chats', id);
    },

    async getByUser(userId) {
        const chats = await dbGetByIndex('chats', 'userId', userId);
        return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },

    async getByFolder(folderId) {
        return dbGetByIndex('chats', 'folderId', folderId);
    },

    async update(chat) {
        chat.updatedAt = new Date().toISOString();
        return dbPut('chats', chat);
    },

    async updateMessages(chatId, messages) {
        const chat = await this.get(chatId);
        if (chat) {
            chat.messages = messages;
            chat.updatedAt = new Date().toISOString();
            // Auto-generate title from first user message if still default
            if (chat.title === 'New Chat' && messages.length > 0) {
                const firstUserMsg = messages.find(m => m.role === 'user');
                if (firstUserMsg) {
                    chat.title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
                }
            }
            return dbPut('chats', chat);
        }
    },

    async moveToFolder(chatId, folderId) {
        const chat = await this.get(chatId);
        if (chat) {
            chat.folderId = folderId;
            return this.update(chat);
        }
    },

    async delete(id) {
        return dbDelete('chats', id);
    }
};

// ===== Folder Operations =====
const Folders = {
    async create(userId, name, color = '#6366f1') {
        const folders = await this.getByUser(userId);
        const folder = {
            userId,
            name,
            color,
            order: folders.length,
            createdAt: new Date().toISOString()
        };
        const id = await dbAdd('folders', folder);
        return { ...folder, id };
    },

    async get(id) {
        return dbGet('folders', id);
    },

    async getByUser(userId) {
        const folders = await dbGetByIndex('folders', 'userId', userId);
        return folders.sort((a, b) => a.order - b.order);
    },

    async update(folder) {
        return dbPut('folders', folder);
    },

    async delete(id) {
        // Move folder's chats to unsorted (folderId = null)
        const chats = await Chats.getByFolder(id);
        for (const chat of chats) {
            chat.folderId = null;
            await Chats.update(chat);
        }
        return dbDelete('folders', id);
    }
};

// ===== Memories Operations =====
const Memories = {
    MAX_MEMORIES: 50, // Limit to prevent system prompt from getting too large

    async create(userId, content, category = 'fact') {
        // Check if at limit
        const existing = await this.getByUser(userId);
        if (existing.length >= this.MAX_MEMORIES) {
            // Remove oldest memory
            const oldest = existing.sort((a, b) =>
                new Date(a.createdAt) - new Date(b.createdAt)
            )[0];
            await this.delete(oldest.id);
        }

        const memory = {
            userId,
            content,
            category,
            createdAt: new Date().toISOString()
        };
        const id = await dbAdd('memories', memory);
        return { ...memory, id };
    },

    async getByUser(userId) {
        const memories = await dbGetByIndex('memories', 'userId', userId);
        return memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async update(memory) {
        return dbPut('memories', memory);
    },

    async delete(id) {
        return dbDelete('memories', id);
    },

    async deleteByUser(userId) {
        const memories = await this.getByUser(userId);
        for (const memory of memories) {
            await this.delete(memory.id);
        }
    }
};

// Export for use
window.LocalAIDB = {
    init: initDB,
    Users,
    Chats,
    Folders,
    Memories
};
