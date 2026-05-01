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
    this.notesImageUploadButton = null;
    this.notesImageUploadInput = null;
    this.notesImageUploadStatus = null;
    this.notesImageUploadStatusTimer = null;

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
            this.renderMessages(this.lastMessages, { forceRebuild: true });
        }
    });

    this.db.startSiteUsersPolling((users) => {
      this.userProfiles = users || {};
      this.avatarCache.clear();
      if (this.lastMessages.length > 0) {
        this.renderMessages(this.lastMessages, { forceRebuild: true });
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
            <span>Notes for this file</span>
            <button class="notes-close-btn" title="Close">&times;</button>
        </div>
        <div class="notes-messages" id="notes-messages-list">
            <!-- Messages go here -->
        </div>

        <div class="notes-input-area">
             <textarea class="notes-input" placeholder="Write a note..." rows="1"></textarea>
             <button class="notes-send-btn">&#10148;</button>
        </div>
    `;

    // Inject CSS
    const css = `
        .notes-widget {
            --chat-text: #1f2937;
            --chat-text-light: #587058;
            --chat-secondary: #eef5ec;
            --chat-primary: #588157;
            --chat-border: #cddbc8;

            position: fixed;
            bottom: 20px;
            left: 20px;
            width: min(430px, calc(100vw - 40px));
            height: min(800px, calc(100dvh - 100px));
            max-height: calc(100dvh - 24px);
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 5px 40px rgba(58, 90, 64, 0.18);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            font-family: 'Open Sans', 'Segoe UI', Arial, sans-serif;
            border: 1px solid #cddbc8;
            transition: transform 0.3s ease, opacity 0.3s ease;
            overflow: hidden;
        }
        .notes-widget.hidden {
            display: none !important;
            transform: translateY(20px) scale(0.95);
            opacity: 0;
            pointer-events: none;
        }
        .notes-header {
            padding: 15px 16px;
            background: #588157;
            border-bottom: 1px solid rgba(52, 78, 65, 0.3);
            box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.12);
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 18px;
            color: white;
            letter-spacing: -0.01em;
        }
        .notes-close-btn {
            background: rgba(255, 255, 255, 0.14);
            border: 1px solid rgba(255, 255, 255, 0.24);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
            color: white;
            font-size: 18px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            transition: background 0.2s;
            line-height: 1;
        }
        .notes-close-btn:hover {
            background: rgba(255, 255, 255, 0.24);
        }

        .notes-messages {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding: 12px 0 20px 0;
            background: #edf3e8;
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .notes-messages::-webkit-scrollbar { width: 6px; }
        .notes-messages::-webkit-scrollbar-track { background: transparent; }
        .notes-messages::-webkit-scrollbar-thumb { background: var(--chat-border); border-radius: 3px; }
        .notes-messages::-webkit-scrollbar-thumb:hover { background: var(--chat-text-light); }
        .notes-messages a {
            color: #4ade80 !important;
            text-decoration: underline !important;
            cursor: pointer !important;
        }

        /* Date separator: pill on horizontal line */
        .notes-date-separator {
            display: flex;
            align-items: center;
            justify-content: center;
            height: auto;
            margin: 18px 14px 14px;
            padding: 0;
            background: transparent;
            position: relative;
            flex-shrink: 0;
        }
        .notes-date-separator::before,
        .notes-date-separator::after {
            content: "";
            flex: 1;
            height: 1px;
            background: #cad9c5;
        }
        .notes-date-separator span {
            position: static;
            transform: none;
            top: auto;
            margin: 0 10px;
            padding: 4px 10px;
            border-radius: 999px;
            background: #f7faf4;
            border: 1px solid #d7e5d2;
            color: #587058;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            box-shadow: 0 1px 2px rgba(58, 90, 64, 0.06);
        }

        .notes-input-area {
            padding: 12px;
            padding-bottom: calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid #cddbc8;
            background: #f4f8f1;
            box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.75) inset;
            border-radius: 0 0 12px 12px;
        }
        .notes-input-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
            width: 100%;
        }
        .notes-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #b9cdb3;
            border-radius: 10px;
            outline: none;
            font-size: 16px;
            min-height: 36px;
            resize: none;
            overflow: hidden;
            transition: all 0.2s;
            background: #fbfcf7;
            box-shadow: inset 0 1px 2px rgba(58, 90, 64, 0.05);
            font-family: inherit;
            color: var(--chat-text);
            line-height: 1.4;
        }
        .notes-input:focus {
            border-color: #588157;
            box-shadow: 0 0 0 3px rgba(88, 129, 87, 0.13);
        }
        .notes-image-upload-btn,
        .notes-send-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: var(--chat-primary);
            color: white;
            border-radius: 10px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
            padding: 0;
            line-height: 1;
            box-shadow: 0 2px 6px rgba(58, 90, 64, 0.16);
        }
        .notes-image-upload-btn:hover,
        .notes-send-btn:hover {
            transform: scale(1.05);
        }
        .notes-image-upload-btn:active,
        .notes-send-btn:active {
            transform: scale(0.95);
        }
        .notes-image-upload-btn:disabled {
            opacity: 0.75;
            cursor: wait;
            transform: none;
        }
        .notes-image-upload-btn svg,
        .notes-send-btn svg {
            display: block;
        }

        /* Message Styles — sage green theme matching chat.js */
        .note-message {
            position: relative;
            transition: background 0.2s;
            display: flex;
            gap: 8px;
            align-items: flex-start;
            padding: 0 12px;
            margin-bottom: 2px;
            animation: notesSlideIn 0.3s ease;
        }
        @keyframes notesSlideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .note-message.note-message-continuation {
            margin-top: -1px;
            margin-bottom: 0;
        }
        .note-message.note-message-continuation .note-content { gap: 0; }
        .note-message.note-message-continuation .note-bubble-container { gap: 0; }
        .note-message.note-message-continuation .note-text {
            padding-top: 5px;
            padding-bottom: 5px;
        }

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
            border: 2px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 2px 7px rgba(58, 90, 64, 0.18);
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
            border: 2px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 2px 7px rgba(58, 90, 64, 0.18);
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
        .note-author {
            font-weight: 600;
            font-size: 13px;
            color: var(--chat-text);
        }
        .note-time {
            font-size: 11px;
            color: var(--chat-text-light);
        }

        .note-bubble-container {
            position: relative;
            width: fit-content;
            display: flex;
            flex-direction: column;
            gap: 3px;
            max-width: 100%;
        }

        .note-text {
            font-size: 13px;
            line-height: 1.4;
            color: var(--chat-text);
            padding: 4px 10px;
            border-radius: 10px;
            word-break: break-word;
            overflow-wrap: anywhere;
            box-sizing: border-box;
            max-width: 100%;
            width: fit-content;
            background: #fbfcf7;
            border: 1px solid #dfe8dc;
            box-shadow: 0 1px 3px rgba(58, 90, 64, 0.08);
        }
        .note-text strong { font-weight: 700; color: inherit; }
        .note-text em { font-style: italic; color: inherit; }
        .note-text a { word-break: break-all; overflow-wrap: anywhere; }
        .note-text img {
            display: block;
            max-width: 100%;
            max-height: 280px;
            object-fit: contain;
            background: #f7faf4;
            border: 1px solid rgba(58, 90, 64, 0.12);
            border-radius: 8px;
            cursor: zoom-in;
        }
        .note-message.is-self-message .note-text {
            background: #d9ecd4;
            border-color: #b7d1af;
            box-shadow: 0 2px 7px rgba(58, 90, 64, 0.14);
        }

        /* Inline reply preview inside messages */
        .note-reply-preview {
            background: #eef5ec;
            border-left: 3px solid #8aad82;
            color: #1f2937;
            padding: 4px 8px;
            margin-bottom: 2px;
            font-size: 11px;
            border-radius: 8px;
            box-shadow: inset 0 0 0 1px rgba(88, 129, 87, 0.08);
            opacity: 0.92;
        }
        .note-reply-preview b { color: #111827; }

        /* Reactions */
        .note-reactions {
            margin: 2px 0 2px;
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            min-height: 0;
        }
        .note-reactions:empty { display: none; margin: 0; }
        .note-message.note-message-continuation .note-reactions {
            margin: 1px 0 1px;
        }

        #notes-widget-container .reaction-badge {
            background: none;
            border: none;
            cursor: pointer;
            color: #111827;
            font-size: 12px;
            padding: 3px 8px;
            border-radius: 999px;
            margin-right: 0;
            transition: transform 0.15s;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-weight: 600;
        }
        #notes-widget-container .reaction-badge.is-other-reaction {
            background: #eef5ec;
            border: 1px solid #c9dcc3;
            box-shadow: 0 1px 3px rgba(58, 90, 64, 0.12);
            font-weight: 600;
        }
        #notes-widget-container .reaction-badge.is-my-reaction {
            background: #b9d8b1;
            border: 1px solid #7faa75;
            box-shadow: 0 1px 5px rgba(58, 90, 64, 0.18);
            font-weight: 800;
        }
        #notes-widget-container .reaction-badge:hover {
            transform: translateY(-1px);
        }

        /* Action buttons */
        .note-actions {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            right: -79px;
            display: none;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(58, 90, 64, 0.12);
            border: 1px solid #dfe8dc;
            gap: 2px;
            z-index: 10;
            padding: 2px;
        }
        .note-actions.two-btns { right: -53px; }
        @media (hover: hover) and (pointer: fine) {
            .note-message:hover .note-actions { display: flex; }
        }
        .note-action-btn {
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            transition: background 0.2s;
            opacity: 0.85;
        }
        .note-action-btn:hover {
            background: rgba(88, 129, 87, 0.1);
            opacity: 1;
        }

        /* Reply indicator above input */
        #notes-widget-container .reply-indicator {
            background: #eef5ec;
            border-left: 3px solid #588157;
            padding: 8px 12px;
            margin-bottom: 8px;
            border-radius: 8px;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10px;
            box-shadow: inset 0 0 0 1px rgba(88, 129, 87, 0.08);
        }
        #notes-widget-container .reply-indicator-author {
            font-weight: 700;
            color: #588157;
            margin-bottom: 2px;
        }
        #notes-widget-container .reply-indicator-text {
            opacity: 0.75;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--chat-text);
        }
        #notes-widget-container .reply-indicator-close {
            border: none;
            background: none;
            cursor: pointer;
            font-size: 16px;
            color: #6b7f60;
            padding: 0 4px;
            line-height: 1;
        }
        #notes-widget-container .reply-indicator-close:hover {
            color: #344e41;
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
        <div class="notes-input-row">
            <button type="button" class="notes-image-upload-btn" title="Upload image">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            </button>
            <textarea class="notes-input" placeholder="Write a note..." rows="1"></textarea>
            <button class="notes-send-btn" title="Send">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.08 0.837654326,3.0226 1.15159189,3.97788954 L3.03521743,10.4188814 C3.03521743,10.5759788 3.34915502,10.7330762 3.50612381,10.7330762 L16.6915026,11.5185631 C16.6915026,11.5185631 17.1624089,11.5185631 17.1624089,12.0598639 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"></path>
                </svg>
            </button>
        </div>
        <input type="file" class="notes-image-upload-input" accept="image/*" style="display: none;">
    `;
    
    const sendBtn = this.container.querySelector('.notes-send-btn');
    const input = this.container.querySelector('.notes-input');
    const closeBtn = this.container.querySelector('.notes-close-btn');
    const imageUploadBtn = this.container.querySelector('.notes-image-upload-btn');
    const imageUploadInput = this.container.querySelector('.notes-image-upload-input');
    this.inputEl = input;
    this.notesImageUploadButton = imageUploadBtn;
    this.notesImageUploadInput = imageUploadInput;
    this.notesImageUploadStatus = null;

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

    input.addEventListener('paste', async (e) => {
      const clipboardItems = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const imageItem = clipboardItems.find(item => item.kind === 'file' && item.type.startsWith('image/'));
      if (!imageItem) return;

      e.preventDefault();

      const file = imageItem.getAsFile();
      if (!file) return;

      const originalDisabled = imageUploadBtn ? imageUploadBtn.disabled : false;
      const originalHtml = imageUploadBtn ? imageUploadBtn.innerHTML : '';

      try {
        if (imageUploadBtn) {
          imageUploadBtn.disabled = true;
          imageUploadBtn.innerHTML = '<span>...</span>';
        }
        const uploadedUrl = await this.uploadImageFileToCloudflare(file, 'Uploading note image');
        this.insertTextAtTextareaCursor(input, this.formatInsertedNoteImageText(input.value, uploadedUrl));
      } catch (error) {
        alert('Image upload failed: ' + error.message);
      } finally {
        if (imageUploadBtn) {
          imageUploadBtn.disabled = originalDisabled;
          imageUploadBtn.innerHTML = originalHtml;
        }
      }
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

    if (imageUploadBtn && imageUploadInput) {
      imageUploadBtn.addEventListener('click', () => {
        imageUploadInput.value = '';
        imageUploadInput.click();
      });

      imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
        if (!file) return;

        const originalHtml = imageUploadBtn.innerHTML;
        try {
          imageUploadBtn.disabled = true;
          imageUploadBtn.innerHTML = '<span>Uploading...</span>';
          const uploadedUrl = await this.uploadImageFileToCloudflare(file, 'Uploading note image');
          this.insertTextAtTextareaCursor(input, this.formatInsertedNoteImageText(input.value, uploadedUrl));
          this.setNotesImageUploadStatus('Image uploaded and inserted.');
        } catch (error) {
          this.setNotesImageUploadStatus(`Image upload failed: ${error.message}`, true);
          alert('Image upload failed: ' + error.message);
        } finally {
          imageUploadBtn.disabled = false;
          imageUploadBtn.innerHTML = originalHtml;
          imageUploadInput.value = '';
        }
      });
    }

  }

  setNotesImageUploadStatus(message, isError = false) {
    const status = this.notesImageUploadStatus;
    if (!status) return;

    if (this.notesImageUploadStatusTimer) {
      clearTimeout(this.notesImageUploadStatusTimer);
      this.notesImageUploadStatusTimer = null;
    }

    status.textContent = message || '';
    status.style.color = isError ? '#ef4444' : '#6b7280';

    if (message && !isError) {
      this.notesImageUploadStatusTimer = setTimeout(() => {
        if (this.notesImageUploadStatus === status) {
          status.textContent = '';
        }
        this.notesImageUploadStatusTimer = null;
      }, 4000);
    }
  }

  formatUploadBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return '0 B';
    if (value < 1024) return `${Math.round(value)} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  extensionForImageMimeType(mimeType) {
    switch (String(mimeType || '').toLowerCase()) {
      case 'image/jpeg': return 'jpg';
      case 'image/png': return 'png';
      case 'image/webp': return 'webp';
      default: return 'png';
    }
  }

  buildOptimizedImageFileName(fileName, mimeType) {
    const fallback = 'image';
    const raw = String(fileName || fallback).trim() || fallback;
    const base = raw.replace(/\.[^.]+$/, '') || fallback;
    return `${base}.${this.extensionForImageMimeType(mimeType)}`;
  }

  shouldSkipCanvasOptimization(fileType) {
    const type = String(fileType || '').toLowerCase();
    return type === 'image/gif' || type === 'image/svg+xml';
  }

  getOptimizationMimeCandidates(fileType) {
    const type = String(fileType || '').toLowerCase();
    if (type === 'image/jpeg' || type === 'image/jpg') {
      return ['image/jpeg'];
    }
    if (type === 'image/webp') {
      return ['image/webp'];
    }
    if (type === 'image/png') {
      return ['image/png'];
    }
    return ['image/png'];
  }

  loadImageElementFromFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not decode image'));
      };

      img.src = objectUrl;
    });
  }

  canvasToBlobAsync(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image'));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    });
  }

  async optimizeImageFileForUpload(file, maxBytes = 1 * 1024 * 1024) {
    const originalSize = file && Number.isFinite(file.size) ? file.size : 0;
    const isOversized = originalSize > maxBytes;

    if (!file || !(file instanceof File)) {
      throw new Error('No image file was provided');
    }

    if (!file.type || !file.type.startsWith('image/')) {
      throw new Error('Selected file is not an image');
    }

    if (this.shouldSkipCanvasOptimization(file.type)) {
      return {
        file,
        wasOptimized: false,
        originalSize,
        finalSize: originalSize,
        note: isOversized
          ? 'This image format cannot be safely auto-compressed. Please use PNG, JPG, or WEBP under 1MB.'
          : ''
      };
    }

    const sourceImage = await this.loadImageElementFromFile(file);
    const sourceWidth = Math.max(1, Math.round(sourceImage.naturalWidth || sourceImage.width || 0));
    const sourceHeight = Math.max(1, Math.round(sourceImage.naturalHeight || sourceImage.height || 0));

    if (!sourceWidth || !sourceHeight) {
      throw new Error('Could not read image dimensions for optimization');
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) {
      throw new Error('Image optimization is not available in this browser');
    }

    const scaleSteps = isOversized
      ? [1, 0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.35, 0.28]
      : [1];
    const qualitySteps = isOversized
      ? [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38]
      : [0.98, 0.96, 0.94, 0.92];
    const mimeCandidates = this.getOptimizationMimeCandidates(file.type);

    let bestBlob = null;
    let bestMimeType = '';

    for (const scale of scaleSteps) {
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.drawImage(sourceImage, 0, 0, width, height);

      for (const mimeType of mimeCandidates) {
        const candidateQualities = mimeType === 'image/png' ? [undefined] : qualitySteps;

        for (const quality of candidateQualities) {
          let blob;
          try {
            blob = await this.canvasToBlobAsync(canvas, mimeType, quality);
          } catch (error) {
            continue;
          }

          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
            bestMimeType = mimeType;
          }

          if (blob.size <= maxBytes) {
            const optimizedMimeType = blob.type || mimeType;
            const optimizedFile = new File([blob], this.buildOptimizedImageFileName(file.name, optimizedMimeType), {
              type: optimizedMimeType,
              lastModified: Date.now()
            });

            if (!isOversized && optimizedFile.size >= (originalSize * 0.97)) {
              return {
                file,
                wasOptimized: false,
                originalSize,
                finalSize: originalSize,
                note: ''
              };
            }

            return {
              file: optimizedFile,
              wasOptimized: true,
              originalSize,
              finalSize: optimizedFile.size,
              note: ''
            };
          }
        }
      }
    }

    if (!bestBlob) {
      throw new Error('Unable to optimize image');
    }

    const fallbackMimeType = bestBlob.type || bestMimeType || 'image/jpeg';
    const fallbackFile = new File([bestBlob], this.buildOptimizedImageFileName(file.name, fallbackMimeType), {
      type: fallbackMimeType,
      lastModified: Date.now()
    });

    if (!isOversized && fallbackFile.size >= (originalSize * 0.97)) {
      return {
        file,
        wasOptimized: false,
        originalSize,
        finalSize: originalSize,
        note: ''
      };
    }

    return {
      file: fallbackFile,
      wasOptimized: true,
      originalSize,
      finalSize: fallbackFile.size,
      note: fallbackFile.size > maxBytes
        ? `Could not reduce image below ${this.formatUploadBytes(maxBytes)}.`
        : ''
    };
  }

  getUploadUserName() {
    let userName = 'anonymous';
    try {
      if (typeof currentUser !== 'undefined' && currentUser) {
        userName = currentUser.userName || currentUser.displayName || currentUser.username || userName;
      } else {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
          const user = JSON.parse(loggedInUser);
          userName = user.userName || user.displayName || user.username || userName;
        }
      }
    } catch (e) {
      console.warn('Could not get user name:', e);
    }
    return userName;
  }

  sanitizeUploadFileName(fileName) {
    const normalized = (fileName || 'image.png').replace(/\s+/g, '-').toLowerCase();
    return normalized.replace(/[^a-z0-9._-]/g, '') || 'image.png';
  }

  buildCloudflareImagePath(fileName) {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = now.getTime();
    const safeName = this.sanitizeUploadFileName(fileName);
    return `notes-images/${year}/${month}/${timestamp}-${safeName}`;
  }

  insertTextAtTextareaCursor(textarea, text) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const prefix = textarea.value.slice(0, start);
    const suffix = textarea.value.slice(end);
    textarea.value = prefix + text + suffix;
    const nextPos = start + text.length;
    textarea.setSelectionRange(nextPos, nextPos);
    textarea.focus();
  }

  formatInsertedNoteImageText(currentValue, imageUrl) {
    const trimmedUrl = String(imageUrl || '').trim();
    if (!trimmedUrl) return '';
    const needsLeadingNewline = currentValue.length > 0 && !currentValue.endsWith('\n');
    return `${needsLeadingNewline ? '\n' : ''}${trimmedUrl}\n`;
  }

  async uploadImageFileToCloudflare(file, statusPrefix = 'Uploading image') {
    if (!file) throw new Error('No file selected');
    if (!file.type || !file.type.startsWith('image/')) {
      throw new Error('Selected file is not an image');
    }

    this.setNotesImageUploadStatus(`${statusPrefix}... preparing image`);

    const optimizationResult = await this.optimizeImageFileForUpload(file, 1 * 1024 * 1024);
    const fileToUpload = optimizationResult.file;

    if (optimizationResult.note) {
      throw new Error(optimizationResult.note);
    }

    if (fileToUpload.size > 1 * 1024 * 1024) {
      throw new Error(`Image is ${this.formatUploadBytes(fileToUpload.size)} after optimization and exceeds the ${this.formatUploadBytes(1 * 1024 * 1024)} limit.`);
    }

    this.setNotesImageUploadStatus(`${statusPrefix}...`);

    if (optimizationResult.wasOptimized) {
      this.setNotesImageUploadStatus(
        `${statusPrefix}... optimized ${this.formatUploadBytes(optimizationResult.originalSize)} to ${this.formatUploadBytes(optimizationResult.finalSize)}.`
      );
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('path', this.buildCloudflareImagePath(fileToUpload.name));
    formData.append('userName', this.getUploadUserName());

    const response = await fetch('https://r2-upload.sergey-2210-pavlov.workers.dev', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Upload failed');
    }

    const data = await response.json();
    if (!data || !data.url) {
      throw new Error('Upload succeeded but no URL was returned');
    }

    this.setNotesImageUploadStatus(`Upload complete (${this.formatUploadBytes(fileToUpload.size)}). URL is ready to insert.`);
    return data.url;
  }

  openNotes() {
    this.isVisible = true;
    this.container.classList.remove('hidden');
    this.setPageScrollLocked(true);
    if (this.isMobileViewport()) {
      this.setChatToggleHidden(true);
    }
    this.scrollToBottom();
    requestAnimationFrame(() => this.scrollToBottom());

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

  getDateSeparatorLabel(timestamp) {
      const date = new Date(Number(timestamp) || Date.now());
      return date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
      });
  }

  formatNoteTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(Number(timestamp) || Date.now());
      const now = new Date();
      const isToday = date.getDate() === now.getDate()
          && date.getMonth() === now.getMonth()
          && date.getFullYear() === now.getFullYear();

      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      if (isToday) {
          return `${hours}:${minutes}`;
      }
      const month = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${month} ${day}, ${hours}:${minutes}`;
  }

  escapeAttrValue(value) {
      return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  isContinuationOf(prevMsg, msg) {
      if (!prevMsg) return false;
      if (prevMsg.userId !== msg.userId) return false;
      if (this.getDateSeparatorLabel(prevMsg.timestamp) !== this.getDateSeparatorLabel(msg.timestamp)) return false;
      return (Number(msg.timestamp) - Number(prevMsg.timestamp) < 3 * 60 * 1000);
  }

  buildDateSeparatorEl(label) {
      const dateSep = document.createElement('div');
      dateSep.className = 'notes-date-separator';
      dateSep.dataset.date = label;
      const span = document.createElement('span');
      span.textContent = label;
      dateSep.appendChild(span);
      return dateSep;
  }

  renderMessages(messages, options = {}) {
      const list = this.container.querySelector('#notes-messages-list');
      if (!list) return;

      const forceRebuild = !!options.forceRebuild;

      const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 50;
      const previousScrollTop = list.scrollTop;

      const orderedMessages = Array.isArray(messages)
          ? [...messages].sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0))
          : [];

      if (forceRebuild) {
          list.innerHTML = '';
      }

      // 1. Remove deleted messages from DOM
      const newIds = new Set(orderedMessages.map(m => m.id));
      let messageRemoved = false;
      list.querySelectorAll('.note-message').forEach(el => {
          if (!newIds.has(el.dataset.id)) {
              el.remove();
              messageRemoved = true;
          }
      });

      const previousMessages = Array.isArray(this.lastRenderedMessages) ? this.lastRenderedMessages : [];

      // Fast path: append-only (one new message at the end, prior order unchanged)
      const isAppendOnly =
          !forceRebuild &&
          !messageRemoved &&
          orderedMessages.length === previousMessages.length + 1 &&
          previousMessages.every((prev, idx) => prev.id === orderedMessages[idx].id);

      if (isAppendOnly) {
          const newMsg = orderedMessages[orderedMessages.length - 1];
          const prevMsg = orderedMessages.length > 1 ? orderedMessages[orderedMessages.length - 2] : null;

          const newDateLabel = this.getDateSeparatorLabel(newMsg.timestamp);
          const prevDateLabel = prevMsg ? this.getDateSeparatorLabel(prevMsg.timestamp) : null;

          if (newDateLabel !== prevDateLabel) {
              list.appendChild(this.buildDateSeparatorEl(newDateLabel));
          }

          const messageEl = this.createMessageElement(newMsg, orderedMessages, this.isContinuationOf(prevMsg, newMsg));
          list.appendChild(messageEl);

          this.lastRenderedMessages = orderedMessages.slice();
          if (wasAtBottom) this.scrollToBottom();
          return;
      }

      // Fast path: single message edited in place
      const isSameOrderAndIds =
          !forceRebuild &&
          !messageRemoved &&
          orderedMessages.length === previousMessages.length &&
          orderedMessages.every((msg, idx) => msg.id === previousMessages[idx].id);

      if (isSameOrderAndIds) {
          const changedIndexes = [];
          orderedMessages.forEach((msg, idx) => {
              const prev = previousMessages[idx];
              if ((msg.text || '') !== (prev.text || '') ||
                  !!msg.edited !== !!prev.edited ||
                  (msg.replyTo || '') !== (prev.replyTo || '') ||
                  (msg.replyAuthor || '') !== (prev.replyAuthor || '')) {
                  changedIndexes.push(idx);
              }
          });

          if (changedIndexes.length === 0) {
              this.lastRenderedMessages = orderedMessages.slice();
              return;
          }

          if (changedIndexes.length === 1) {
              const changedIndex = changedIndexes[0];
              const changedMsg = orderedMessages[changedIndex];
              const prevMsg = changedIndex > 0 ? orderedMessages[changedIndex - 1] : null;
              const isContinuation = this.isContinuationOf(prevMsg, changedMsg);

              const existingEl = list.querySelector(`.note-message[data-id="${this.escapeAttrValue(changedMsg.id)}"]`);
              if (existingEl) {
                  const replacementEl = this.createMessageElement(changedMsg, orderedMessages, isContinuation);
                  existingEl.replaceWith(replacementEl);
                  this.lastRenderedMessages = orderedMessages.slice();
                  return;
              }
          }
      }

      // Fast path: single deletion (already removed above; just refresh adjacent continuation)
      const isSingleDelete =
          !forceRebuild &&
          messageRemoved &&
          previousMessages.length === orderedMessages.length + 1;

      if (isSingleDelete) {
          let i = 0;
          let j = 0;
          let removedIndex = -1;
          while (i < previousMessages.length && j < orderedMessages.length) {
              if (previousMessages[i].id === orderedMessages[j].id) {
                  i++;
                  j++;
              } else if (removedIndex === -1) {
                  removedIndex = i;
                  i++;
              } else {
                  removedIndex = -1;
                  break;
              }
          }
          if (removedIndex === -1 && i === previousMessages.length - 1 && j === orderedMessages.length) {
              removedIndex = i;
              i++;
          }

          const validSingleDelete = removedIndex !== -1 && i === previousMessages.length && j === orderedMessages.length;
          if (validSingleDelete) {
              const removedMsg = previousMessages[removedIndex];
              const removedDateKey = this.getDateSeparatorLabel(removedMsg.timestamp);
              const hasRemainingOnDate = orderedMessages.some(m => this.getDateSeparatorLabel(m.timestamp) === removedDateKey);
              if (!hasRemainingOnDate) {
                  const orphan = list.querySelector(`.notes-date-separator[data-date="${this.escapeAttrValue(removedDateKey)}"]`);
                  if (orphan) orphan.remove();
              }

              const affectedIndex = removedIndex;
              if (affectedIndex < orderedMessages.length) {
                  const affectedMsg = orderedMessages[affectedIndex];
                  const prevMsg = affectedIndex > 0 ? orderedMessages[affectedIndex - 1] : null;
                  const affectedEl = list.querySelector(`.note-message[data-id="${this.escapeAttrValue(affectedMsg.id)}"]`);
                  if (affectedEl) {
                      const replacementEl = this.createMessageElement(affectedMsg, orderedMessages, this.isContinuationOf(prevMsg, affectedMsg));
                      affectedEl.replaceWith(replacementEl);
                  }
              }

              this.lastRenderedMessages = orderedMessages.slice();
              return;
          }
      }

      // Slow path: full reconcile, but reuse existing nodes by render signature
      const fragment = document.createDocumentFragment();
      let prevMsg = null;
      let prevDateLabel = '';

      orderedMessages.forEach((msg) => {
          const currentDateLabel = this.getDateSeparatorLabel(msg.timestamp);
          if (currentDateLabel !== prevDateLabel) {
              const existingSep = list.querySelector(`.notes-date-separator[data-date="${this.escapeAttrValue(currentDateLabel)}"]`);
              fragment.appendChild(existingSep || this.buildDateSeparatorEl(currentDateLabel));
              prevDateLabel = currentDateLabel;
          }

          const isContinuation = this.isContinuationOf(prevMsg, msg);
          const newSig = this.buildMessageRenderSignature(msg, isContinuation);
          const existingEl = list.querySelector(`.note-message[data-id="${this.escapeAttrValue(msg.id)}"]`);

          if (existingEl && existingEl.dataset.renderSig === newSig) {
              fragment.appendChild(existingEl);
          } else {
              const messageEl = this.createMessageElement(msg, orderedMessages, isContinuation);
              fragment.appendChild(messageEl);
          }
          prevMsg = msg;
      });

      list.innerHTML = '';
      list.appendChild(fragment);

      this.lastRenderedMessages = orderedMessages.slice();

      if (wasAtBottom) {
          this.scrollToBottom();
      } else {
          list.scrollTop = previousScrollTop;
      }
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
                 <div class="note-reply-preview">
                   <b>${this.escapeHtml(msg.replyAuthor || 'Someone')}:</b> ${this.escapeHtml(original.text.substring(0, 50))}...
                 </div>
               `;
          }
      }

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
                <span class="note-time">${this.formatNoteTime(msg.timestamp)}</span>
             </div>
             ${replyHTML}
             <div class="note-bubble-container">
               <div class="note-text">${this.linkify(msg.text)}${msg.edited ? '<span style="font-size: 10px; opacity: 0.5; margin-left: 4px;">(edited)</span>' : ''}</div>
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

      el.querySelectorAll('.note-message-image').forEach((img) => {
        img.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openImageModal(img.dataset.imageUrl || img.src);
        });
      });

      return el;
  }

  openImageModal(imageUrl) {
    if (!imageUrl) return;

    if (window.chatManager && typeof window.chatManager.openImageModal === 'function') {
      window.chatManager.openImageModal(imageUrl);
      return;
    }

    const existingModal = document.getElementById('image-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'image-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
        position: relative;
        background: white;
        padding: 20px;
        border-radius: 12px;
        border: 2px solid #e5e7eb;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        max-width: 90%;
        max-height: 90%;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = `
        max-width: 100%;
        max-height: calc(90vh - 80px);
        object-fit: contain;
        border-radius: 8px;
        display: block;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: -12px;
        right: -12px;
        background: white;
        border: 2px solid #e5e7eb;
        color: #374151;
        font-size: 24px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    `;
    closeBtn.onmouseover = () => {
        closeBtn.style.background = '#f3f4f6';
        closeBtn.style.borderColor = '#d1d5db';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.background = 'white';
        closeBtn.style.borderColor = '#e5e7eb';
    };

    container.appendChild(img);
    container.appendChild(closeBtn);
    modal.appendChild(container);
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modal.remove();
    });

    container.addEventListener('click', (e) => e.stopPropagation());

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
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

      const previewText = (msg.text || '').length > 60 ? (msg.text || '').substring(0, 57) + '...' : (msg.text || '');

      preview.innerHTML = `
        <div class="reply-indicator">
            <div style="flex: 1; min-width: 0;">
                <div class="reply-indicator-author">Replying to ${this.escapeHtml(replyAuthorName)}</div>
                <div class="reply-indicator-text">${this.escapeHtml(previewText)}</div>
            </div>
            <button type="button" class="reply-indicator-close" onpointerdown="window.notesManager.cancelReply(event); return false;" onclick="window.notesManager.cancelReply(event); return false;">&times;</button>
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
        <div class="reply-indicator">
            <span><strong class="reply-indicator-author" style="margin-bottom:0;">Editing message</strong></span>
            <button type="button" class="reply-indicator-close" onclick="window.notesManager.cancelEditing()">&times;</button>
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
      const existing = document.querySelector('.reaction-picker');
      if (existing) existing.remove();

      const emojis = ['\u{1F44D}', '\u{1F44E}', '\u{1F602}', '\u{2764}\u{FE0F}', '\u{1F62D}', '\u{1F62E}', '\u{1F410}'];
      const pickerHover = '#eef5ec';

      const picker = document.createElement('div');
      picker.className = 'reaction-picker';
      picker.style.cssText = `
        position: fixed;
        background: #ffffff;
        color: #1f2937;
        border: 1px solid #cddbc8;
        border-radius: 20px;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        gap: 4px;
        box-shadow: 0 4px 15px rgba(58, 90, 64, 0.15);
        z-index: 10001;
      `;

      const addEmojiButton = (emoji) => {
          const btn = document.createElement('button');
          btn.textContent = emoji;
          btn.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
            border-radius: 50%;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          `;
          btn.addEventListener('mouseenter', () => btn.style.background = pickerHover);
          btn.addEventListener('mouseleave', () => btn.style.background = 'none');
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.db.addReaction(msgId, emoji);
              picker.remove();
              document.removeEventListener('click', closePicker);
          });
          return btn;
      };

      emojis.forEach(emoji => picker.appendChild(addEmojiButton(emoji)));

      const customBtn = document.createElement('button');
      customBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      `;
      customBtn.title = 'Add custom reaction';
      customBtn.style.cssText = `
        background: #f3f4f6;
        border: none;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: 4px;
        color: #6b7280;
        transition: all 0.2s;
      `;
      customBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const customEmoji = prompt('Enter an emoji or short text for the reaction:');
          if (customEmoji && customEmoji.trim()) {
              this.db.addReaction(msgId, customEmoji.trim().substring(0, 5));
          }
          picker.remove();
          document.removeEventListener('click', closePicker);
      });
      picker.appendChild(customBtn);

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

      const closePicker = (e) => {
          if (!picker.contains(e.target) && !(e.target && e.target.closest && e.target.closest('.react-btn'))) {
              picker.remove();
              document.removeEventListener('click', closePicker);
          }
      };
      setTimeout(() => {
          document.addEventListener('click', closePicker);
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
      return isMe ? `<strong>${this.escapeHtml(resolved)} (You)</strong>` : this.escapeHtml(resolved);
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
        <button class="reaction-badge ${myReactions[emoji] ? 'is-my-reaction' : 'is-other-reaction'}" data-emoji="${emoji}" data-msgid="${msgId}">
           ${emoji} <span>${reactionCounts[emoji]}</span>
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
      const source = String(text || '');
      const urlPattern = /https?:\/\/[^\s]+/g;
      const imagePattern = /\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i;

      let lastIndex = 0;
      let html = '';
      let match;

      while ((match = urlPattern.exec(source)) !== null) {
        const before = source.slice(lastIndex, match.index);
        if (before) {
          html += this.escapeHtml(before).replace(/\n/g, '<br>');
        }

        const rawUrl = match[0];
        const trimmedUrl = rawUrl.replace(/[),.?!;:]+$/g, '');
        const trailing = rawUrl.slice(trimmedUrl.length);
        const safeUrl = this.escapeHtml(trimmedUrl);

        if (imagePattern.test(trimmedUrl)) {
          html += `<img src="${safeUrl}" alt="Image" class="note-message-image" data-image-url="${safeUrl}" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid rgba(0,0,0,0.08);display:block;object-fit:contain;background:#f8fafc;cursor:zoom-in;">`;
        } else {
          html += `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#0ea5e9">${safeUrl}</a>`;
        }

        if (trailing) {
          html += this.escapeHtml(trailing).replace(/\n/g, '<br>');
        }

        lastIndex = match.index + rawUrl.length;
      }

      const rest = source.slice(lastIndex);
      if (rest) {
        html += this.escapeHtml(rest).replace(/\n/g, '<br>');
      }

      return html;
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
