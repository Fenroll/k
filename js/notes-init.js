// ============================================
// ANONYMOUS USER (Copied from chat.js for notes)
// ============================================
if (typeof window.AnonymousUser === 'undefined') {
    class AnonymousUser {
      // This class is now defined in js/user-identity.js
      // This check is a fallback.
      console.error("AnonymousUser class is not defined. Make sure js/user-identity.js is loaded.");
    }
}

if (typeof window.currentUser === 'undefined') {
    console.log("Notes: currentUser not found from chat.js, creating a new one.");
    // The currentUser object is now created in `js/user-identity.js` and is globally available.
}

// ============================================
// NOTES SYSTEM (Based on Chat System)
// ============================================

// Copied classes from chat.js and adapted for Notes behavior
// We use 'notes/' path prefix in Firebase instead of 'messages/'

// ============================================
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
      apiKey: "API_KEY", 
      authDomain: "med-student-chat.firebaseapp.com",
      databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "med-student-chat",
      storageBucket: "med-student-chat.appspot.com",
      messagingSenderId: "SENDER_ID",
      appId: "APP_ID"
    };

    this.initSDK();
  }

  async initSDK() {
    if (window.firebaseSDK) {
      this.sdk = window.firebaseSDK;
      this.initApp();
      return;
    }
    // Wait for main chat to load SDK or load it ourselves if needed
    // Assuming chat.js is present and loads SDK
    let attempts = 0;
    while (!window.firebaseSDK && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (window.firebaseSDK) {
        this.sdk = window.firebaseSDK;
        this.initApp();
    } else {
        console.error("Notes: Firebase SDK not found.");
    }
  }

  initApp() {
    try {
      const { initializeApp, getDatabase, getApps } = this.sdk;
      const app = getApps().length === 0 ? initializeApp(this.firebaseConfig) : getApps()[0];
      this.db = getDatabase(app);
    } catch (e) {
      console.error("Notes Firebase Init Error:", e);
    }
  }

  async _ensureInit() {
    if (this.db) return;
    await this.initSDK();
    while (!this.db) {
        await new Promise(r => setTimeout(r, 100));
        if (!this.sdk) break; 
    }
  }

  async getNameMappings() {
    await this._ensureInit();
    const { ref, get } = this.sdk;
    try {
        const snapshot = await get(ref(this.db, `name_mappings`));
        return snapshot.exists() ? snapshot.val() : {};
    } catch(e) { 
        console.error("Notes: Failed to get name mappings", e);
        return {}; 
    }
  }

  startNameMappingsPolling(callback) {
    this._ensureInit().then(() => {
        const { ref, onValue } = this.sdk;
        const mappingsRef = ref(this.db, `name_mappings`);
        onValue(mappingsRef, (snapshot) => {
            callback(snapshot.val() || {});
        });
    });
  }

  // --- CHANGED PATHS TO 'notes/' ---

  async sendMessage(text, replyTo = null, replyAuthor = null) {
    if (!text.trim()) return false;
    await this._ensureInit();

    const { ref, push, set, serverTimestamp } = this.sdk;
    const messagesRef = ref(this.db, `notes/${this.documentId}`);
    
    const message = {
      userId: currentUser.userId,
      userName: currentUser.userName,
      userColor: currentUser.color,
      text: text.trim(),
      timestamp: serverTimestamp(),
    };

    if (replyTo && replyAuthor) {
      message.replyTo = replyTo;
      message.replyAuthor = replyAuthor;
    }

    try {
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, message);
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
        const { ref, onValue, query, orderByChild, limitToLast } = this.sdk;
        const messagesRef = ref(this.db, `notes/${this.documentId}`);
        const q = query(messagesRef, orderByChild('timestamp'), limitToLast(500));

        onValue(q, (snapshot) => {
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
            this.messages = messages;
            callback(messages);
        });
    });
  }

  startReactionPolling(callback) {
    this._ensureInit().then(() => {
        const { ref, onValue } = this.sdk;
        const reactionsRef = ref(this.db, `notes_reactions/${this.documentId}`);
        onValue(reactionsRef, (snapshot) => {
            callback(snapshot.val() || {});
        });
    });
  }

  async deleteMessage(messageKey) {
    await this._ensureInit();
    const { ref, remove } = this.sdk;
    try {
        const messageRef = ref(this.db, `notes/${this.documentId}/${messageKey}`);
        await remove(messageRef);
        return true;
    } catch (e) { return false; }
  }

  async addReaction(messageId, emoji) {
    return this.setReaction(messageId, emoji, true);
  }

  async removeReaction(messageId, emoji) {
    return this.setReaction(messageId, emoji, false);
  }

  async setReaction(messageId, emoji, value) {
    await this._ensureInit();
    const { ref, set } = this.sdk;
    try {
      const reactionRef = ref(this.db, `notes_reactions/${this.documentId}/${messageId}/${emoji}/${currentUser.userId}`);
      if (value) {
          await set(reactionRef, true);
      } else {
          await set(reactionRef, null);
      }
      return true;
    } catch (e) { return false; }
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

    this.init();
  }

  async init() {
    this.createUI();
    
    // Start polling for name mappings
    this.db.startNameMappingsPolling((mappings) => {
        this.userNameMappings = mappings;
        if (this.lastMessages.length > 0) {
            this.renderMessages(this.lastMessages);
        }
    });

    // Listen for reactions (Realtime)
    this.db.startReactionPolling((reactions) => {
        this.reactionsCache = reactions;
        this.updateReactionsUI();
    });
    
    // Listen for messages (Realtime)
    this.db.startPolling((messages) => {
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

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'notes-widget-container';
    this.container.className = 'notes-widget hidden'; // Hidden by default
    
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
            height: calc(100vh - 100px); /* Tall up to header */
            max-height: 800px;
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
            padding: 12px;
            background: #fff;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .notes-input-area {
            padding: 12px;
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
            font-size: 13px;
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
            margin-bottom: 2px;
            transition: background 0.2s;
        }
        .note-message:hover { background: #f8fafc; }
        .note-content {
            padding: 10px 10px 10px 10px;
            border-radius: 12px;
            max-width: 100%;
            word-wrap: break-word;
        }
        .note-header {
            display: flex;
            gap: 8px;
            align-items: baseline;
            margin-bottom: 4px;
        }
        .note-author { font-weight: 600; font-size: 13px; color: var(--chat-text); }
        .note-time { font-size: 11px; color: var(--chat-text-light); }
        .note-text { font-size: 13px; line-height: 1.4; color: var(--chat-text); padding: 8px 8px 8px 10px; border-radius: 8px;}
        .note-reactions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
        .reaction-badge { font-size: 14px !important; padding: 4px 8px !important; border-radius: 12px !important; }
        
        /* Action buttons */
        .note-actions {
            position: absolute; top: 4px; right: 4px;
            display: none; background: white; border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
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
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    
    document.body.appendChild(this.container);
    
    // Check if toggle button exists, if not, keep hidden forever or remove?
    // User requested "notes-widget is always visible and not needed"
    // So let's double check styles.
    
    // Event listeners
    this.container.querySelector('.notes-close-btn').addEventListener('click', () => this.toggle());
    
    // Modify input area for inline button
    const inputArea = this.container.querySelector('.notes-input-area');
    inputArea.innerHTML = `
        <div id="notes-reply-preview"></div>
        <div class="notes-input-row">
             <textarea class="notes-input" placeholder="Напиши бележка..." rows="1"></textarea>
             <button class="notes-send-btn" title="Изпрати">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16151496 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.08 0.837654326,3.0226 1.15159189,3.97788954 L3.03521743,10.4188814 C3.03521743,10.5759788 3.34915502,10.7330762 3.50612381,10.7330762 L16.6915026,11.5185631 C16.6915026,11.5185631 17.1624089,11.5185631 17.1624089,12.0598639 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"></path>
                </svg>
             </button>
        </div>
    `;
    
    const sendBtn = this.container.querySelector('.notes-send-btn');
    const input = this.container.querySelector('.notes-input');
    
    const sendMessage = () => {
        const text = input.value;
        if(!text.trim()) return;
        
        const replyTo = input.dataset.replyTo;
        const replyAuthor = input.dataset.replyAuthor;
        
        this.db.sendMessage(text, replyTo, replyAuthor).then(success => {
            if(success) {
                input.value = '';
                input.style.height = 'auto';
                this.cancelReply();
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
    
    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = (input.scrollHeight) + 'px';
    });
  }

  toggle() {
    this.isVisible = !this.isVisible;
    if(this.isVisible) {
        this.container.classList.remove('hidden');
        this.scrollToBottom();
    } else {
        this.container.classList.add('hidden');
    }
  }
  
  scrollToBottom() {
      const list = this.container.querySelector('#notes-messages-list');
      if(list) list.scrollTop = list.scrollHeight;
  }

  renderMessages(messages) {
      const list = this.container.querySelector('#notes-messages-list');
      if(!list) return;
      
      const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 50;
      
      list.innerHTML = ''; // Full re-render for simplicity (or can optimize like chat.js)
      
      messages.forEach(msg => {
          const el = this.createMessageElement(msg, messages);
          list.appendChild(el);
      });
      
      if(wasAtBottom) this.scrollToBottom();
  }
  
  createMessageElement(msg, allMessages) {
      // Check if message belongs to current user (by userId OR userName like in chat.js)
      const isMe = (currentUser.userId && msg.userId === currentUser.userId) || (currentUser.legacyNotesId && msg.userId === currentUser.legacyNotesId);
      const el = document.createElement('div');
      el.className = 'note-message';
      el.dataset.id = msg.id;
      const resolvedName = this.resolveName(msg.userName);
      
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

      const bg = isMe ? '#e0f2fe' : 'var(--chat-secondary)';
      
      el.innerHTML = `
         <div class="note-content">
             <div class="note-header">
                <span class="note-author">${this.escapeHtml(resolvedName)}</span>
                <span class="note-time">${new Date(msg.timestamp).toLocaleTimeString('bg-BG', {hour: '2-digit', minute:'2-digit'})}</span>
             </div>
             ${replyHTML}
             <div class="note-text" style="background:${bg}">${this.linkify(msg.text)}</div>
             <div class="note-reactions" id="reactions-${msg.id}">${this.generateReactionsHTML(msg.id)}</div>
         </div>
         <div class="note-actions">
             <button class="note-action-btn reply-btn" title="Reply">
                 <img src="svg/reply-svgrepo-com.svg" alt="Reply" style="width: 16px; height: 16px">
             </button>
             <button class="note-action-btn react-btn" title="React">
                 <img src="svg/reaction-emoji-add-svgrepo-com.svg" alt="Reaction" style="width: 16px; height: 16px">
             </button>
             ${isMe ? '<button class="note-action-btn delete-btn" title="Delete"><img src="svg/trash-blank-alt-svgrepo-com.svg" alt="Delete" style="width: 16px; height: 16px"></button>' : ''}
         </div>
      `;
      
      // Handlers
      el.querySelector('.reply-btn').addEventListener('click', () => this.startReply(msg));
      el.querySelector('.react-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.showReactionPicker(msg.id, e.target);
      });
      
      const reactionsEl = el.querySelector(`#reactions-${msg.id}`);
      if (reactionsEl) this.attachReactionListeners(reactionsEl);


      if(isMe){
          el.querySelector('.delete-btn').addEventListener('click', () => this.db.deleteMessage(msg.key));
      }
      
      return el;
  }
  
  startReply(msg) {
      const input = this.container.querySelector('.notes-input');
      const preview = this.container.querySelector('#notes-reply-preview');
      
      input.dataset.replyTo = msg.id;
      input.dataset.replyAuthor = msg.userName;
      
      preview.innerHTML = `
        <div class="reply-indicator">
            <span>Replying to <b>${this.escapeHtml(msg.userName)}</b></span>
            <button onclick="window.notesManager.cancelReply()" style="border:none;background:none;cursor:pointer;">✖</button>
        </div>
      `;
      input.focus();
  }
  
  cancelReply() {
      const input = this.container.querySelector('.notes-input');
      input.dataset.replyTo = '';
      input.dataset.replyAuthor = '';
      this.container.querySelector('#notes-reply-preview').innerHTML = '';
  }
  
  showReactionPicker(msgId, targetBtn) {
       // Simple picker
       const existing = document.querySelector('.reaction-picker');
       if(existing) existing.remove();
       
       const emojis1 = ['👍', '👎', '😂', '❤️', '😮', '🐐'];
       const emojis2 = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

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
       picker.appendChild(createRow(emojis2));
       
       const rect = targetBtn.getBoundingClientRect();
       picker.style.left = (rect.left - 100) + 'px';
       picker.style.top = (rect.top - 80) + 'px';
       document.body.appendChild(picker);
       
       // Close on click outside
       setTimeout(() => {
           document.addEventListener('click', function close(e) {
               if(!picker.contains(e.target)) {
                   picker.remove();
                   document.removeEventListener('click', close);
               }
           });
       }, 0);
  }
  
  updateReactionsUI() {
    this.lastMessages.forEach(msg => {
      const display = this.container.querySelector(`#reactions-${msg.id}`);
      if (display) {
        display.innerHTML = this.generateReactionsHTML(msg.id);
        this.attachReactionListeners(display);
      }
    });
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
            return;
         }

         const docId = getDocumentId();
         console.log('📝 Notes initializing for:', docId);
         
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
