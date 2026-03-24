// ============================================
// USER INITIALIZATION (Handled by user-identity.js)
// ============================================

// ============================================
// NOTES SYSTEM (Based on Chat System)
// ============================================

// Copied classes from chat.js and adapted for Notes behavior
// We use 'notes/' path prefix in Firebase instead of 'messages/'

// ============================================
// NOTES FIREBASE ADAPTER
// NOTES FIREBASE ADAPTER
// ============================================

class NotesFirebaseREST {
  constructor(documentId) {
    this.documentId = documentId || 'default';
    this.messages = [];
    this.listeners = [];
    this.isPolling = false;
    
    // Config from chat.js
    this.firebaseConfig = {
      apiKey: "API_KEY", // Replace with your actual API Key
      authDomain: "med-student-chat.firebaseapp.com",
      databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "med-student-chat",
      storageBucket: "med-student-chat.appspot.com",
      messagingSenderId: "SENDER_ID",
      appId: "APP_ID"
    };

    this.initSDK();
    // console.log('NotesFirebaseREST: Constructor called for documentId:', documentId); // Keep for initial debugging
  }

  async initSDK() {
    // If the global firebase object is already available, use it.
    if (typeof firebase !== 'undefined') {
        this.initApp(firebase);
        return;
    } else {
        console.error("NotesFirebaseREST: Firebase SDK not loaded globally. Please ensure firebase-app-compat.js and firebase-database-compat.js are loaded BEFORE notes-init.js");
    }
  }

  initApp(firebaseInstance) {
    try {
      // Check if app already exists to avoid errors on page reload/navigation
      const app = firebaseInstance.apps.length === 0 ? firebaseInstance.initializeApp(this.firebaseConfig, "notesApp") : firebaseInstance.app();
      this.db = firebaseInstance.database();
      // console.log('NotesFirebaseREST: Firebase App initialized.');
    } catch (e) {
      console.error("NotesFirebaseREST: Firebase Init Error:", e);
    }
  }

  async _ensureInit() {
    if (this.db) return;
    // If initSDK didn't run or failed, try again with global firebase.
    // This provides a fallback if initSDK was called prematurely or firebase wasn't ready.
    if (typeof firebase !== 'undefined' && !this.db) {
        this.initApp(firebase);
        if (this.db) return; // If successful now
    }
    // If still not initialized, something is wrong.
    throw new Error("NotesFirebaseREST: Firebase not initialized. Check SDK loading and configuration.");
  }

  async getNameMappings() {
    await this._ensureInit();
    try {
        const snapshot = await firebase.database().ref(`name_mappings`).once('value');
        return snapshot.exists() ? snapshot.val() : {};
    } catch(e) { 
        console.error("Notes: Failed to get name mappings", e);
        return {}; 
    }
  }

  startNameMappingsPolling(callback) {
    this._ensureInit().then(() => {
        const mappingsRef = firebase.database().ref(`name_mappings`);
        // console.log('NotesFirebaseREST: Starting name mappings polling.');
        mappingsRef.on('value', (snapshot) => {
            callback(snapshot.val() || {});
        });
    });
  }

  startSiteUsersPolling(callback) {
    this._ensureInit().then(() => {
      const usersRef = firebase.database().ref('site_users');
      usersRef.on('value', (snapshot) => {
        callback(snapshot.val() || {});
      });
    });
  }

  // --- CHANGED PATHS TO 'notes/' ---

  async sendMessage(text, replyTo = null, replyAuthor = null) {
    if (!text.trim()) return false;
    await this._ensureInit();

    const messagesRef = firebase.database().ref(`notes/${this.documentId}`);
    
    const message = {
      userId: currentUser.userId,
      text: text.trim(),
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    if (replyTo && replyAuthor) {
      message.replyTo = replyTo;
      message.replyAuthor = replyAuthor;
    }

    try {
      const newMessageRef = messagesRef.push();
      await newMessageRef.set(message); // Can be removed, frequent
      // console.log('NotesFirebaseREST: Message sent successfully.');
      return true;
    } catch (error) {
      console.error('Notes Send error:', error);
      return false;
    }
  }

  startPolling(callback) {
    if (this.isPolling) return;
    this.isPolling = true;

    this._ensureInit().then(() => {
        const messagesRef = firebase.database().ref(`notes/${this.documentId}`);
        const q = messagesRef.orderByChild('timestamp').limitToLast(500);

        q.on('value', (snapshot) => {
            const messages = [];
            snapshot.forEach((child) => {
                const val = child.val();
                messages.push({
                    ...val,
                    key: child.key,
                    id: child.key,
                    timestamp: val.timestamp || Date.now()
                });
            });
            // console.log('NotesFirebaseREST: Messages updated from polling.'); // Can be removed, frequent
            this.messages = messages;
            callback(messages);
        });
    });
  }

  startReactionPolling(callback) {
    this._ensureInit().then(() => {
        const reactionsRef = firebase.database().ref(`notes_reactions/${this.documentId}`); // Can be removed, less critical
        // console.log('NotesFirebaseREST: Starting reactions polling.');
        reactionsRef.on('value', (snapshot) => {
            callback(snapshot.val() || {});
        });
    });
  }

  async deleteMessage(messageKey) {
    await this._ensureInit();
    try {
        const messageRef = firebase.database().ref(`notes/${this.documentId}/${messageKey}`); // Can be removed, less critical
        await messageRef.remove();
        // console.log('NotesFirebaseREST: Message deleted successfully.');
        return true;
    } catch (e) { console.error('NotesFirebaseREST: Delete message error:', e); return false; }
  }

  async updateMessage(messageKey, updates) {
    await this._ensureInit();
    try {
      const messageRef = firebase.database().ref(`notes/${this.documentId}/${messageKey}`);
      await messageRef.update(updates || {});
      return true;
    } catch (e) {
      console.error('NotesFirebaseREST: Update message error:', e);
      return false;
    }
  }

  async addReaction(messageId, emoji) {
    return this.setReaction(messageId, emoji, true);
  }

  async removeReaction(messageId, emoji) {
    return this.setReaction(messageId, emoji, false);
  }

  async setReaction(messageId, emoji, value) {
    await this._ensureInit();
    try {
      const reactionRef = firebase.database().ref(`notes_reactions/${this.documentId}/${messageId}/${emoji}/${currentUser.userId}`);
      if (value) {
          await reactionRef.set(true);
      } else {
          await reactionRef.set(null); // Remove the node to keep DB clean // Can be removed, frequent
      }
      // console.log(`NotesFirebaseREST: Reaction ${emoji} for message ${messageId} set to ${value}.`);
      return true;
    } catch (e) { console.error('NotesFirebaseREST: Set reaction error:', e); return false; }
  }

  stop() {
    this.isPolling = false;
  }
}

// Cache buster
const NOTES_VERSION = '20260123_v3';

// ============================================
// NOTES UI MANAGER
// ============================================

class NotesUIManager {
  constructor(documentId) {
    this.documentId = documentId;
    this.db = new NotesFirebaseREST(this.documentId);
    this.container = null;
    this.isVisible = false;
    this.autoScroll = true;
    this.lastMessages = [];
    this.reactionsCache = {};
    this.userNameMappings = {}; // For showing updated names on old messages
    this.userProfiles = {};
    this.avatarCache = new Map();
    this.editingMessage = null;

    // console.log('NotesUIManager: Constructor called for documentId:', documentId);
    this.init();
  }

  async init() {
    this.createUI(); // Keep for initial debugging
    
    // Start polling for name mappings // Can be removed, less critical
    // console.log('NotesUIManager: Starting name mappings polling.');
    this.db.startNameMappingsPolling((mappings) => {
        this.userNameMappings = mappings;
        if (this.lastMessages.length > 0) {
            this.renderMessages(this.lastMessages);
        }
    });

    this.db.startSiteUsersPolling((users) => {
      this.userProfiles = users || {};
      this.avatarCache.clear();
      if (this.lastMessages.length > 0) {
        this.renderMessages(this.lastMessages);
      }
    });
    
    // Listen for reactions (Realtime) // Can be removed, less critical
    // console.log('NotesUIManager: Starting reaction polling.');
    this.db.startReactionPolling((reactions) => {
        this.reactionsCache = reactions;
        this.updateReactionsUI();
    });
    
    // Listen for messages (Realtime)
    // console.log('NotesUIManager: Starting messages polling.');
    this.db.startPolling((messages) => { // Can be removed, less critical
        this.lastMessages = messages;
        this.renderMessages(messages);
    });
  }

  resolveName(originalName) {
    if (!this.userNameMappings || !originalName) return originalName;
    let currentName = originalName;
    let resolvedName = this.userNameMappings[currentName];
    let depth = 0; // safety break for circular dependencies
    while (resolvedName && depth < 10) {
        currentName = resolvedName;
        // Check for the next name in the chain
        resolvedName = this.userNameMappings[currentName];
        depth++;
    }
    return currentName;
  }

  getDisplayNameByUserId(userId, fallbackName = '') {
    let rawName = fallbackName || '';

    if (window.currentUser && userId && String(window.currentUser.userId) === String(userId)) {
      rawName = window.currentUser.userName || window.currentUser.displayName || rawName;
    }

    if (this.userProfiles && userId) {
      const profile = this.userProfiles[userId] || this.userProfiles[String(userId)];
      if (profile) {
        rawName = profile.displayName || profile.username || profile.userName || rawName;
      }
    }

    const resolved = this.resolveName(rawName || 'Unknown');
    return resolved || 'Unknown';
  }

  getUserInfo(userId, fallbackName = '') {
    const cacheKey = userId ? `id:${String(userId)}` : (fallbackName ? `name:${String(fallbackName).toLowerCase()}` : null);
    if (cacheKey && this.avatarCache.has(cacheKey)) {
      return this.avatarCache.get(cacheKey);
    }

    let avatar = null;
    let color = '#588157';

    if (window.currentUser && userId && String(window.currentUser.userId) === String(userId)) {
      avatar = window.currentUser.avatar || avatar;
      color = window.currentUser.color || color;
    }

    if (this.userProfiles && userId) {
      const profile = this.userProfiles[userId] || this.userProfiles[String(userId)];
      if (profile) {
        avatar = profile.avatar || avatar;
        color = profile.color || color;
      }
    }

    const info = { avatar, color };
    if (cacheKey) {
      this.avatarCache.set(cacheKey, info);
    }
    return info;
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'notes-widget-container';
    this.container.className = 'notes-widget hidden'; // Hidden by default
    // console.log('NotesUIManager: UI container created and appended to body.');
    // console.log('NotesUIManager: UI container created and appended to body.'); // Can be removed
    // UI Structure mimic chat.js but tailored
    this.container.innerHTML = `
        <div class="notes-header">
            <span>Бележки за този файл</span>
            <button class="notes-close-btn">✕</button>
        </div>
        <div class="notes-messages" id="notes-messages-list">
            <!-- Messages go here -->
        </div>
        
        <div class="notes-input-area">
             <textarea class="notes-input" placeholder="Напиши бележка..." rows="1"></textarea>
             <button class="notes-send-btn">➤</button>
        </div>
    `;

    // Inject CSS
    const css = `
        .notes-widget {
            /* CSS Variables for consistency with chat.js */
            --chat-text: #2c1810;
            --chat-text-light: #6d4c41;
            --chat-secondary: #efebe9;
            
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 350px;
            height: min(800px, calc(100dvh - 100px));
            max-height: calc(100dvh - 24px);
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 5px 25px rgba(0,0,0,0.2);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            font-family: 'Segoe UI', sans-serif;
            border: 1px solid #e2e8f0;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }
        .notes-widget.hidden {
            display: none !important; /* Force hidden to fix "always visible" issue */
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
        }
        .notes-header {
            padding: 16px;
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            border-bottom: 1px solid #e2e8f0;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 18px;
            color: white;
        }
        .notes-close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: background 0.2s;
            line-height: 1;
        }
        .notes-close-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .notes-messages {
            flex: 1;
            overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
            padding: 12px 0 20px 0;
            background: #fff;
            display: flex;
            flex-direction: column;
          gap: 0;
        }
        
        .notes-input-area {
            padding: 12px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid #bcaaa4;
            background: #fff;
            border-radius: 0 0 12px 12px;
        }
        .notes-input-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
        }
        .notes-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #bcaaa4;
            border-radius: 8px;
            outline: none;
          font-size: 16px;
            resize: none;
            overflow: hidden;
            transition: all 0.2s;
        }
        .notes-input:focus {
            border-color: #7c3aed;
            box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
        .notes-send-btn {
            background: #7c3aed; color: white; border: none; padding: 0;
            border-radius: 8px; width: 36px; height: 36px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            transition: all 0.2s;
        }
        .notes-send-btn:hover {
            transform: scale(1.05);
        }
        .notes-send-btn:active {
            transform: scale(0.95);
        }
        
        /* Message Styles (Copied & Simplified from chat.js) */
        .note-message {
            position: relative;
            transition: background 0.2s;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .note-message.note-message-continuation {
          margin-top: -3px;
          margin-bottom: 0;
        }
        .note-message.note-message-continuation .note-content {
          padding-top: 2px;
        }
        .note-message:hover { background: #f8fafc; }
        .note-avatar {
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
          max-width: 32px;
          max-height: 32px;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
          flex-shrink: 0;
          object-fit: cover;
          display: block;
        }
        .note-avatar-fallback {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 700;
        }
        .note-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-right: 80px;
          min-width: 0;
          max-width: 100%;
          word-wrap: break-word;
          position: relative;
        }
        .note-header {
            display: flex;
            gap: 8px;
            align-items: baseline;
          margin-bottom: 2px;
        }
        .note-author { font-weight: 600; font-size: 13px; color: var(--chat-text); }
        .note-time { font-size: 11px; color: var(--chat-text-light); }
        .note-text { font-size: 13px; line-height: 1.4; color: var(--chat-text); padding: 4px 10px; border-radius: 8px; word-break: break-word; overflow-wrap: anywhere; box-sizing: border-box; max-width: 100%; width: fit-content; }
        .note-text a { word-break: break-all; overflow-wrap: anywhere; }
        .note-reactions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
        .reaction-badge { font-size: 14px !important; padding: 4px 8px !important; border-radius: 12px !important; }
        
        /* Action buttons */
        .note-actions {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          right: -79px;
            display: none; background: white; border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          gap: 2px;
          z-index: 10;
        }
        .note-actions.two-btns { right: -53px; }
        .note-message:hover .note-actions { display: flex; }
        .note-action-btn {
            background: none; border: none; cursor: pointer; padding: 4px;
            font-size: 14px; opacity: 0.6;
        }
        .note-action-btn:hover { opacity: 1; background: #f1f5f9; }
        
        .reply-indicator {
            background: #f1f5f9; border-left: 3px solid #3b82f6;
            padding: 8px; margin-bottom: 8px; border-radius: 4px;
            font-size: 12px; display: flex; justify-content: space-between; items-align: center;
        }
        
        .reaction-picker { z-index: 10001; }

        .message-option-item.disabled {
          opacity: 0.45;
          cursor: default;
          pointer-events: none;
        }

        @supports not (height: 100dvh) {
          .notes-widget {
            height: calc(100vh - 100px);
            max-height: 800px;
          }
        }

        @media (max-width: 768px) {
          .notes-widget {
            left: max(8px, env(safe-area-inset-left));
            right: max(8px, env(safe-area-inset-right));
            top: max(8px, env(safe-area-inset-top));
            bottom: calc(max(8px, env(safe-area-inset-bottom)) + var(--mobile-keyboard-offset, 0px));
            width: auto;
            height: auto;
            max-height: none;
            transform: none;
          }

          .notes-widget.notes-keyboard-open {
            top: max(4px, env(safe-area-inset-top));
            bottom: calc(max(4px, env(safe-area-inset-bottom)) + var(--mobile-keyboard-offset, 0px));
            height: auto;
          }

          .notes-widget.hidden {
            transform: translateY(16px) scale(0.96);
          }

          html.notes-widget-open,
          body.notes-widget-open {
            overflow: hidden !important;
            overscroll-behavior: none;
          }

          html.notes-widget-open #chat-widget .chat-icon,
          body.notes-widget-open #chat-widget .chat-icon,
          html.notes-widget-open #chat-toggle,
          body.notes-widget-open #chat-toggle {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
          }
        }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    
    document.body.appendChild(this.container);
    
    // Check if toggle button exists, if not, keep hidden forever or remove?
    // console.log('NotesUIManager: Attaching event listeners to UI elements.'); // Can be removed
    // User requested "notes-widget is always visible and not needed"
    // So let's double check styles.

    // Event listeners
    
    // Modify input area for inline button
    const inputArea = this.container.querySelector('.notes-input-area');
    inputArea.innerHTML = `
        <div id="notes-reply-preview"></div>
        <div class="notes-input-row" style="display: flex; gap: 12px; align-items: flex-end;">
             <textarea class="notes-input" placeholder="Напиши бележка..." rows="1"></textarea>
             <button class="notes-send-btn" title="Изпрати">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.08 0.837654326,3.0226 1.15159189,3.97788954 L3.03521743,10.4188814 C3.03521743,10.5759788 3.34915502,10.7330762 3.50612381,10.7330762 L16.6915026,11.5185631 C16.6915026,11.5185631 17.1624089,11.5185631 17.1624089,12.0598639 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"></path>
                </svg>
             </button>
        </div>
    `;
    
    const sendBtn = this.container.querySelector('.notes-send-btn');
    const input = this.container.querySelector('.notes-input');
    const closeBtn = this.container.querySelector('.notes-close-btn');
    this.inputEl = input;

    this.setPageScrollLocked = (locked) => {
      document.documentElement.classList.toggle('notes-widget-open', Boolean(locked));
      document.body.classList.toggle('notes-widget-open', Boolean(locked));
    };

    this.isMobileViewport = () => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    this.setChatToggleHidden = (hidden) => {
      const chatToggleBtn = document.getElementById('chat-toggle');
      if (!chatToggleBtn) return;
      if (hidden) {
        chatToggleBtn.dataset.notesHidden = '1';
        chatToggleBtn.style.display = 'none';
      } else {
        if (chatToggleBtn.dataset.notesHidden === '1') {
          chatToggleBtn.style.display = '';
          delete chatToggleBtn.dataset.notesHidden;
        }
      }
    };

    this.scrollToBottomReliable = () => {
      this.scrollToBottom();
      requestAnimationFrame(() => this.scrollToBottom());
      setTimeout(() => this.scrollToBottom(), 120);
      setTimeout(() => this.scrollToBottom(), 300);
    };

    const forceInputFocusable = () => {
      if (!this.inputEl) return;
      this.inputEl.disabled = false;
      this.inputEl.readOnly = false;
      this.inputEl.removeAttribute('disabled');
      this.inputEl.removeAttribute('readonly');
      this.inputEl.style.webkitUserSelect = 'text';
      this.inputEl.style.userSelect = 'text';
    };

    input.addEventListener('touchstart', () => {
      forceInputFocusable();
      setTimeout(() => {
        if (this.isVisible && this.inputEl) this.inputEl.focus({ preventScroll: true });
      }, 0);
    }, { passive: true });

    input.addEventListener('pointerdown', () => {
      forceInputFocusable();
    });
    
    const sendMessage = () => {
        const text = input.value;
        if(!text.trim()) return;
        
        const replyTo = input.dataset.replyTo;
        const replyAuthor = input.dataset.replyAuthor;
        
        const savePromise = this.editingMessage
          ? this.db.updateMessage(this.editingMessage.key, { text: text.trim(), edited: true })
          : this.db.sendMessage(text, replyTo, replyAuthor);

        savePromise.then(success => {
            if(success) {
                input.value = '';
                input.style.height = 'auto';
                this.cancelReply();
            this.cancelEditing();
            }
        });
    };
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea with cap to reduce mobile layout jumping
    const maxInputHeight = 140;
    input.addEventListener('input', () => {
        input.style.height = 'auto';
      const nextHeight = Math.min(input.scrollHeight, maxInputHeight);
      input.style.height = nextHeight + 'px';
      input.style.overflowY = input.scrollHeight > maxInputHeight ? 'auto' : 'hidden';
    });

    input.addEventListener('focus', () => {
      this.container.classList.add('notes-keyboard-open');
      this.setPageScrollLocked(true);
    });

    input.addEventListener('blur', () => {
      this.container.classList.remove('notes-keyboard-open');
      if (!this.isVisible) {
        this.setPageScrollLocked(false);
      }
    });

    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeNotes();
    });

    closeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeNotes();
    });

    closeBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeNotes();
    }, { passive: false });

    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closeNotes();
    });

  }

  openNotes() {
    this.isVisible = true;
    this.container.classList.remove('hidden');
    this.setPageScrollLocked(true);
    if (this.isMobileViewport()) {
      this.setChatToggleHidden(true);
    }
    this.scrollToBottomReliable();

    const pagePath = String(window.location.pathname || '').toLowerCase();
    const shouldAutoFocus = !(this.isMobileViewport() && pagePath.includes('md-viewer'));
    if (shouldAutoFocus) {
      const tryFocus = () => {
        if (this.inputEl && this.isVisible) {
          this.inputEl.disabled = false;
          this.inputEl.readOnly = false;
          this.inputEl.focus({ preventScroll: true });
        }
      };
      setTimeout(tryFocus, 20);
      setTimeout(tryFocus, 120);
    }
  }

  closeNotes() {
    this.isVisible = false;
    this.cancelReply();
    this.cancelEditing();
    if (this.inputEl) this.inputEl.blur();
    this.container.classList.add('hidden');
    this.container.classList.remove('notes-keyboard-open');
    this.setPageScrollLocked(false);
    this.setChatToggleHidden(false);
  }

  toggle() {
    if (this.isVisible) {
      this.closeNotes();
      return;
    }
    this.openNotes();
  }
  
  scrollToBottom() {
      const list = this.container.querySelector('#notes-messages-list');
      if(list) list.scrollTop = list.scrollHeight;
  }

  buildMessageRenderSignature(msg, isContinuation) {
      return [
          msg.id || '',
          msg.key || '',
          msg.userId || '',
          msg.userName || '',
          msg.text || '',
          msg.timestamp || '',
          msg.replyTo || '',
          msg.replyAuthor || '',
          msg.edited ? '1' : '0',
          isContinuation ? '1' : '0'
      ].join('|');
  }

  renderMessages(messages) {
      const list = this.container.querySelector('#notes-messages-list');
      if(!list) return;
      
      // console.log('NotesUIManager: Rendering messages.'); // Can be removed, frequent
      const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 50;

      const existingById = new Map();
      list.querySelectorAll('.note-message[data-id]').forEach((el) => {
          existingById.set(el.dataset.id, el);
      });

      const nextIds = new Set();

      let prevMsg = null;
      messages.forEach((msg, index) => {
          const isContinuation = !!(
            prevMsg &&
            prevMsg.userId === msg.userId &&
            (msg.timestamp - prevMsg.timestamp < 3 * 60 * 1000)
          );

          const id = String(msg.id || '');
          if (id) nextIds.add(id);

          const signature = this.buildMessageRenderSignature(msg, isContinuation);
          const existing = existingById.get(id);
          const expectedNodeAtIndex = list.children[index] || null;

          let targetEl = existing;
          if (!existing) {
            targetEl = this.createMessageElement(msg, messages, isContinuation);
            list.insertBefore(targetEl, expectedNodeAtIndex);
          } else if (existing.dataset.renderSig !== signature) {
            const replacement = this.createMessageElement(msg, messages, isContinuation);
            existing.replaceWith(replacement);
            targetEl = replacement;
          }

          targetEl.dataset.renderSig = signature;

          const nodeAfterUpdates = list.children[index] || null;
          if (targetEl !== nodeAfterUpdates) {
            list.insertBefore(targetEl, nodeAfterUpdates);
          }

          prevMsg = msg;
      });

      existingById.forEach((el, id) => {
          if (!nextIds.has(id)) {
            el.remove();
          }
      });
      
      if(wasAtBottom) this.scrollToBottom();
  }
  
  createMessageElement(msg, allMessages, isContinuation = false) {
      // Check if message belongs to current user (by userId OR userName like in chat.js)
      const isMe = (currentUser.userId && msg.userId === currentUser.userId) || (currentUser.legacyNotesId && msg.userId === currentUser.legacyNotesId);
      const el = document.createElement('div');
      el.className = `note-message${isMe ? ' is-self-message' : ''}`;
      el.dataset.id = msg.id;
      el.dataset.userId = msg.userId || '';
      el.dataset.messageKey = msg.key || '';
      el.dataset.renderSig = this.buildMessageRenderSignature(msg, isContinuation);
      const resolvedName = this.getDisplayNameByUserId(msg.userId, msg.userName);
      const userInfo = this.getUserInfo(msg.userId, resolvedName || msg.userName);
      const currentAvatar = userInfo.avatar;
      const currentColor = userInfo.color || msg.userColor || '#588157';
      
      // Reply content
      let replyHTML = '';
      if (msg.replyTo) {
          const original = allMessages.find(m => m.id === msg.replyTo);
          if (original) {
               replyHTML = `
                 <div style="background: #f1f5f9; border-left: 3px solid #cbd5e1; padding: 4px 8px; margin-bottom: 4px; font-size: 11px; border-radius: 4px; opacity: 0.8;">
                   <b>${this.escapeHtml(msg.replyAuthor || 'Someone')}:</b> ${this.escapeHtml(original.text.substring(0, 50))}...
                 </div>
               `;
          }
      }

      const bg = isMe ? '#e8f5e9' : 'var(--chat-secondary)';
      const initial = (resolvedName || '?').charAt(0).toUpperCase();
      const avatarVisibility = isContinuation ? 'visibility:hidden;' : 'visibility:visible;';
      const headerDisplay = isContinuation ? 'display:none;' : 'display:flex;';
      const actionClass = isMe ? '' : 'two-btns';

      let avatarHtml = '';
      if (currentAvatar && typeof currentAvatar === 'string' && currentAvatar.length > 5) {
        avatarHtml = `
          <div style="width:32px;height:32px;position:relative;flex-shrink:0;">
            <img src="${currentAvatar}" class="note-avatar" style="${avatarVisibility} width:32px; height:32px; border-radius:50%; object-fit:cover; display:block;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="note-avatar-fallback" style="background:${currentColor}; ${avatarVisibility} display:none; position:absolute; inset:0;">${this.escapeHtml(initial)}</div>
          </div>`;
      } else {
        avatarHtml = `<div class="note-avatar-fallback" style="${avatarVisibility} background:${currentColor};">${this.escapeHtml(initial)}</div>`;
      }
      
      el.innerHTML = `
        ${avatarHtml}
         <div class="note-content">
           <div class="note-header" style="${headerDisplay}">
                <span class="note-author">${this.escapeHtml(resolvedName)}</span>
                <span class="note-time">${new Date(msg.timestamp).toLocaleTimeString('bg-BG', {hour: '2-digit', minute:'2-digit'})}</span>
             </div>
             ${replyHTML}
             <div class="note-bubble-container" style="position: relative; width: fit-content; display: flex; flex-direction: column;">
               <div class="note-text" style="background:${bg}">${this.linkify(msg.text)}${msg.edited ? '<span style="font-size: 10px; opacity: 0.5; margin-left: 4px;">(edited)</span>' : ''}</div>
               <div class="note-actions ${actionClass}">
               <button class="note-action-btn reply-btn" title="Reply">
                 <img src="svg/chat/icon-reply.svg" alt="Reply" style="width: 16px; height: 16px">
               </button>
               <button class="note-action-btn react-btn" title="React">
                 <img src="svg/chat/icon-reaction.svg" alt="Reaction" style="width: 16px; height: 16px">
               </button>
               ${isMe ? '<button class="note-action-btn options-btn" title="More options"><img src="svg/chat/icon-three-dots-vertical.svg" alt="More" style="width: 16px; height: 16px"></button>' : ''}
               </div>
             </div>
             <div class="note-reactions" id="reactions-${msg.id}">${this.generateReactionsHTML(msg.id)}</div>
         </div>
      `;
      
      // Handlers
      el.querySelector('.reply-btn').addEventListener('click', () => this.startReply(msg));
      el.querySelector('.react-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.showReactionPicker(msg.id, e.target);
      });

      if (isMe) {
        const optionsBtn = el.querySelector('.options-btn');
        if (optionsBtn) {
          optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMessageOptions(msg, e, optionsBtn, 'owner-only');
          });
        }
      }

        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showMessageOptions(msg, e, null, 'full');
        });
      
      const reactionsEl = el.querySelector(`#reactions-${msg.id}`);
      if (reactionsEl) this.attachReactionListeners(reactionsEl);
      return el;
  }
  
  startReply(msg) {
      if (this.editingMessage) {
        this.cancelEditing();
      }
      const input = this.container.querySelector('.notes-input');
      const preview = this.container.querySelector('#notes-reply-preview');
      
      input.dataset.replyTo = msg.id;
      const replyAuthorName = this.getDisplayNameByUserId(msg.userId, msg.userName);
      input.dataset.replyAuthor = replyAuthorName;
      
      preview.innerHTML = `
        <div class="reply-indicator" style="background: #f1f5f9; border-left: 3px solid #3b82f6; padding: 8px; margin-bottom: 8px; border-radius: 4px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>Replying to <b>${this.escapeHtml(replyAuthorName)}</b></span>
            <button type="button" onpointerdown="window.notesManager.cancelReply(event); return false;" onclick="window.notesManager.cancelReply(event); return false;" style="border:none;background:none;cursor:pointer;">✖</button>
        </div>
      `;
      input.focus();
  }
  
  cancelReply(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const input = this.container.querySelector('.notes-input');
      input.dataset.replyTo = '';
      input.dataset.replyAuthor = '';
      // console.log('NotesUIManager: Reply cancelled.'); // Can be removed
      this.container.querySelector('#notes-reply-preview').innerHTML = '';
  }

  startEditing(msg) {
      if (!msg || !msg.key) return;

      this.cancelReply();
      this.editingMessage = { id: msg.id, key: msg.key };

      const input = this.container.querySelector('.notes-input');
      const preview = this.container.querySelector('#notes-reply-preview');
      if (!input || !preview) return;

      input.value = msg.text || '';
      input.style.height = 'auto';
      const maxInputHeight = 140;
      const nextHeight = Math.min(input.scrollHeight, maxInputHeight);
      input.style.height = nextHeight + 'px';
      input.style.overflowY = input.scrollHeight > maxInputHeight ? 'auto' : 'hidden';

      preview.innerHTML = `
        <div class="reply-indicator" style="background: #fef3c7; border-left: 3px solid #d97706; padding: 8px; margin-bottom: 8px; border-radius: 4px; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span>Editing message</span>
            <button onclick="window.notesManager.cancelEditing()" style="border:none;background:none;cursor:pointer;">✖</button>
        </div>
      `;

      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
  }

  cancelEditing() {
      this.editingMessage = null;
      const preview = this.container.querySelector('#notes-reply-preview');
      if (preview && preview.textContent && /Editing message/i.test(preview.textContent)) {
        preview.innerHTML = '';
      }
  }

  showMessageOptions(msg, event, anchorEl = null, mode = 'full') {
      const existing = document.getElementById('message-options-menu');
      if (existing) existing.remove();
      if (!msg) return;

      const isMe = (currentUser.userId && msg.userId === currentUser.userId) || (currentUser.legacyNotesId && msg.userId === currentUser.legacyNotesId);
      const menu = document.createElement('div');
      menu.id = 'message-options-menu';
      menu.className = 'message-options-menu';

      const isOwnerOnly = mode === 'owner-only';
      menu.innerHTML = `
        ${isOwnerOnly ? '' : '<div class="message-option-item reply"><img src="svg/chat/icon-reply.svg" alt="Reply">Reply</div>'}
        ${isOwnerOnly ? '' : '<div class="message-option-item reaction"><img src="svg/chat/icon-reaction.svg" alt="Reaction">Reaction</div>'}
        <div class="message-option-item edit ${isMe ? '' : 'disabled'}"><img src="svg/chat/icon-edit.svg" alt="Edit">Edit</div>
        <div class="message-option-item delete ${isMe ? '' : 'disabled'}"><img src="svg/chat/icon-delete.svg" alt="Delete">Delete</div>
      `;

      document.body.appendChild(menu);

      const menuRect = menu.getBoundingClientRect();
      let left = (event && Number.isFinite(event.clientX)) ? event.clientX : 20;
      let top = (event && Number.isFinite(event.clientY)) ? event.clientY : 20;

      if (anchorEl && anchorEl.getBoundingClientRect) {
        const rect = anchorEl.getBoundingClientRect();
        left = rect.right - menuRect.width;
        top = rect.bottom + 5;
      }

      if (left + menuRect.width > window.innerWidth - 10) {
        left = window.innerWidth - menuRect.width - 10;
      }
      if (top + menuRect.height > window.innerHeight - 10) {
        top = window.innerHeight - menuRect.height - 10;
      }
      if (left < 10) left = 10;
      if (top < 10) top = 10;

      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;

      const replyItem = menu.querySelector('.reply');
      if (replyItem) {
        replyItem.onclick = () => {
          menu.remove();
          this.startReply(msg);
        };
      }
      const reactionItem = menu.querySelector('.reaction');
      if (reactionItem) {
        reactionItem.onclick = () => {
          menu.remove();
          this.showReactionPicker(msg.id, event && event.target ? event.target : document.body);
        };
      }

      const editItem = menu.querySelector('.edit');
      if (isMe && editItem) {
        editItem.onclick = () => {
          menu.remove();
          this.startEditing(msg);
        };
      }

      const deleteItem = menu.querySelector('.delete');
      if (isMe && deleteItem) {
        deleteItem.onclick = () => {
          menu.remove();
          this.db.deleteMessage(msg.key);
        };
      }

      setTimeout(() => {
        const close = (e) => {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('mousedown', close);
            document.removeEventListener('touchstart', close);
          }
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('touchstart', close, { passive: true });
      }, 0);
  }
  
  showReactionPicker(msgId, targetBtn) {
       // Simple picker
      const existing = document.querySelector('.reaction-picker');
       if(existing) existing.remove();
       
       const emojis1 = ['👍', '👎', '😂', '❤️', '😮', '🐐'];

       const picker = document.createElement('div');
       picker.className = 'reaction-picker';
       picker.style.cssText = `
         position: fixed; background: white; border: 1px solid #ddd;
         padding: 8px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
         display: flex; flex-direction: column; gap: 4px; z-index: 10001;
       `;
       
       const createRow = (emojis) => {
           const row = document.createElement('div');
           row.style.cssText = 'display: flex; gap: 4px; justify-content: space-around;';
           emojis.forEach(emoji => {
               const btn = document.createElement('button');
               btn.textContent = emoji;
               btn.style.cssText = "background:none;border:none;font-size:18px;cursor:pointer;padding:4px;";
               btn.onclick = () => {
                   this.db.addReaction(msgId, emoji);
                   picker.remove();
               };
               row.appendChild(btn);
           });
           return row;
       };

       picker.appendChild(createRow(emojis1));
       
       document.body.appendChild(picker);

       const targetRect = targetBtn && targetBtn.getBoundingClientRect ? targetBtn.getBoundingClientRect() : null;
       const pickerRect = picker.getBoundingClientRect();
       let left = targetRect ? (targetRect.left + targetRect.width / 2 - pickerRect.width / 2) : ((window.innerWidth - pickerRect.width) / 2);
       let top = targetRect ? (targetRect.top - pickerRect.height - 8) : ((window.innerHeight - pickerRect.height) / 2);

       if (left < 10) left = 10;
       if (left + pickerRect.width > window.innerWidth - 10) {
         left = window.innerWidth - pickerRect.width - 10;
       }
       if (top < 10) {
         top = targetRect ? (targetRect.bottom + 8) : 10;
       }
       if (top + pickerRect.height > window.innerHeight - 10) {
         top = window.innerHeight - pickerRect.height - 10;
       }

       picker.style.left = `${Math.round(left)}px`;
       picker.style.top = `${Math.round(top)}px`;
       
       // Close on click outside
       setTimeout(() => {
           document.addEventListener('click', function close(e) {
               if(!picker.contains(e.target)) { // Can be removed
                   console.log('NotesUIManager: Reaction picker closed.');
                   picker.remove();
                   document.removeEventListener('click', close);
               }
           });
       }, 0);
  }
  
  updateReactionsUI() {
    this.lastMessages.forEach(msg => {
      const display = this.container.querySelector(`#reactions-${msg.id}`);
      // console.log('NotesUIManager: Updating reactions for message:', msg.id); // Can be removed, frequent
      if (display) {
        display.innerHTML = this.generateReactionsHTML(msg.id);
        this.attachReactionListeners(display);
      }
    });
  }

  showReactionTooltip(badgeElement) {
    this.hideReactionTooltip();

    const msgId = badgeElement.dataset.msgid;
    const emoji = badgeElement.dataset.emoji;
    if (!msgId || !emoji) return;

    const usersObj = this.reactionsCache?.[msgId]?.[emoji];
    if (!usersObj) return;

    const reactorIds = Object.keys(usersObj).filter((uid) => usersObj[uid] === true);
    if (!reactorIds.length) return;

    const messageMap = {};
    this.lastMessages.forEach((m) => {
      if (m && m.userId && !messageMap[m.userId]) {
        messageMap[m.userId] = m.userName || '';
      }
    });

    const namesHtml = reactorIds.map((uid) => {
      const fallback = messageMap[uid] || '';
      const resolved = this.getDisplayNameByUserId(uid, fallback);
      const isMe = currentUser && currentUser.userId && String(currentUser.userId) === String(uid);
      return isMe ? `<strong>${this.escapeHtml(resolved)} (Аз)</strong>` : this.escapeHtml(resolved);
    }).join('<br>');

    const tooltip = document.createElement('div');
    tooltip.id = 'notes-reaction-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: #111827;
      color: #ffffff;
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      line-height: 1.35;
      box-shadow: 0 6px 18px rgba(0,0,0,0.28);
      z-index: 10003;
      pointer-events: none;
      max-width: min(260px, calc(100vw - 24px));
    `;
    tooltip.innerHTML = namesHtml;
    document.body.appendChild(tooltip);

    const badgeRect = badgeElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = badgeRect.left + (badgeRect.width / 2) - (tooltipRect.width / 2);
    let top = badgeRect.top - tooltipRect.height - 6;

    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;
    if (top < 10) top = badgeRect.bottom + 6;
    if (top + tooltipRect.height > window.innerHeight - 10) top = window.innerHeight - tooltipRect.height - 10;

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  hideReactionTooltip() {
    const tooltip = document.getElementById('notes-reaction-tooltip');
    if (tooltip) tooltip.remove();
  }

  generateReactionsHTML(msgId) {
    const reactions = this.reactionsCache[msgId];
    if (!reactions) return '';

    const reactionCounts = {};
    const myReactions = {};

    Object.keys(reactions).forEach(emoji => {
      const users = reactions[emoji];
      if (users) {
        const activeUsers = Object.keys(users).filter(uid => users[uid] === true);
        const count = activeUsers.length;
        if (count > 0) {
          reactionCounts[emoji] = count;
          if (activeUsers.includes(currentUser.userId)) {
            myReactions[emoji] = true;
          }
        }
      }
    });

    return Object.keys(reactionCounts).map(emoji => `
        <button class="reaction-badge" data-emoji="${emoji}" data-msgid="${msgId}"
           style="background:${myReactions[emoji] ? '#93c5fd' : '#f1f5f9'};border:none;border-radius:12px;padding:4px 8px;font-size:14px;margin-right:4px;cursor:pointer;font-weight:${myReactions[emoji] ? 'bold' : 'normal'}">
           ${emoji} ${reactionCounts[emoji]}
        </button>
    `).join('');
  }

  attachReactionListeners(el) {
      el.querySelectorAll('.reaction-badge').forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const emoji = btn.dataset.emoji;
              const msgId = btn.dataset.msgid;
              
              const myReaction = this.reactionsCache[msgId]?.[emoji]?.[currentUser.userId];

              if (myReaction) {
                  this.db.removeReaction(msgId, emoji);
              } else {
                  this.db.addReaction(msgId, emoji);
              }
          });

              btn.addEventListener('mouseenter', (e) => {
                this.showReactionTooltip(e.currentTarget);
              });

              btn.addEventListener('mouseleave', () => {
                this.hideReactionTooltip();
              });
      });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
  
  linkify(text) {
      // Basic linkify with line break preservation
      const escaped = this.escapeHtml(text);
      const withBreaks = escaped.replace(/\n/g, '<br>');
      return withBreaks.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#0ea5e9">$1</a>');
  }
}

// ============================================
// INITIALIZATION
// ============================================

(async function() {
    function getDocumentId() {
        // Logic from original notes-init.js to identify file
        const urlParams = new URLSearchParams(window.location.search);
        
        // From md-viewer path
        const pathParam = urlParams.get('path');
        if (pathParam) {
          // Use full path to avoid collisions defined by folder structure
          let path = decodeURIComponent(pathParam);
          
          // Remove 'files/' prefix for cleaner ID
          path = path.replace(/^files\//, '');
          
          // CRITICAL: Remove [АРХИВ] prefix to keep same notes when archiving courses
          // This allows notes from "Рентгенология" and "[АРХИВ] Рентгенология" to be the same
          path = path.replace(/\[АРХИВ\]\s*/g, '');
          path = path.replace(/\[ARCHIVE\]\s*/g, '');
          
          // Replace invalid Firebase characters: . # $ [ ] and /
          // Creating a flat ID like: doc_Folder_Subfolder_Filename_md
          path = path.replace(/[.#$[\]/]/g, '_');
          
          return 'doc_' + path;
        }
        
        const docIdFromUrl = urlParams.get('docId') || urlParams.get('doc');
        if (docIdFromUrl) return docIdFromUrl;

        const pathname = window.location.pathname;
        const match = pathname.match(/\/([a-z0-9-]+)\.html/i);
        if (match) return 'doc_' + match[1];
        
        return 'doc_general';
    }

    async function init() {
         // Wait for user identity to be resolved
         await window.currentUserPromise;

         // Only init if toggle button exists on page
         const btn = document.getElementById('notes-toggle-btn');
         if (!btn) {
            // console.log('📝 Notes Skipped: No toggle button found.');
            // console.log('Notes Init: notes-toggle-btn not found. Notes widget will not be initialized.');
            return; 
         }

         const docId = getDocumentId(); // Keep, important for debugging
         // console.log('📝 Notes initializing for:', docId);
         // console.log('Notes Init: Document ID:', docId);
         
         window.notesManager = new NotesUIManager(docId);
         
         btn.addEventListener('click', (e) => {
             e.preventDefault();
             window.notesManager.toggle();
         });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Delay slightly to ensure body exists if script in head
        setTimeout(init, 100);
    }
})();
