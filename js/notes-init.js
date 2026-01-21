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

  async loadMessages() {
    await this._ensureInit();
    const { ref, get, query, orderByChild, limitToLast } = this.sdk;
    
    try {
      const messagesRef = ref(this.db, `notes/${this.documentId}`);
      const q = query(messagesRef, orderByChild('timestamp'), limitToLast(500));
      
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      
      const data = snapshot.val();
      const messages = Object.keys(data).map(key => ({
        ...data[key],
        key: key,
        id: key
      }));

      messages.sort((a, b) => a.timestamp - b.timestamp);
      this.messages = messages;
      return messages;
    } catch (error) {
      console.error('Notes Load error:', error);
      return [];
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

  async deleteMessage(messageKey) {
    await this._ensureInit();
    const { ref, remove } = this.sdk;
    try {
        const messageRef = ref(this.db, `notes/${this.documentId}/${messageKey}`);
        await remove(messageRef);
        return true;
    } catch (e) { return false; }
  }

  async getReactions(messageId) {
    await this._ensureInit();
    const { ref, get } = this.sdk;
    try {
      const snapshot = await get(ref(this.db, `notes_reactions/${this.documentId}/${messageId}`));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (e) { return null; }
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

    this.init();
  }

  async init() {
    this.createUI();
    
    // Initial Load & Polling
    const messages = await this.db.loadMessages();
    this.renderMessages(messages);
    
    this.db.startPolling((messages) => {
        this.renderMessages(messages);
    });
  }

  createUI() {
    this.container = document.createElement('div');
    this.container.id = 'notes-widget-container';
    this.container.className = 'notes-widget hidden'; // Hidden by default
    
    // UI Structure mimic chat.js but tailored
    this.container.innerHTML = `
        <div class="notes-header">
            <span>Бележки за този файл</span>
            <button class="notes-close-btn">&times;</button>
        </div>
        <div class="notes-messages" id="notes-messages-list">
            <!-- Messages go here -->
        </div>
        
        <div class="notes-input-area">
             <input type="text" class="notes-input" placeholder="Напиши бележка..." />
             <button class="notes-send-btn">➤</button>
        </div>
    `;

    // Inject CSS
    const css = `
        .notes-widget {
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
            padding: 12px 16px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            color: #1e293b;
        }
        .notes-close-btn {
            background: none; border: none; font-size: 24px; color: #64748b; cursor: pointer;
            line-height: 1; padding: 0 4px;
        }
        .notes-close-btn:hover { color: #ef4444; }
        
        .notes-messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            background: #fff;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .notes-input-area {
            padding: 12px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 8px;
            align-items: center;
            background: #f8fafc;
            border-radius: 0 0 12px 12px;
            flex-direction: column; 
            align-items: stretch;
        }
        .notes-input {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 20px;
            outline: none;
            font-size: 14px;
        }
        .notes-input:focus { border-color: #3b82f6; }
        .notes-send-btn {
            background: #3b82f6; color: white; border: none; padding: 8px 12px;
            border-radius: 50%; width: 36px; height: 36px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            align-self: flex-end;
            margin-top: -46px; /* Floating over input */
        }
        
        /* Message Styles (Copied & Simplified from chat.js) */
        .note-message {
            position: relative;
            margin-bottom: 4px;
            transition: background 0.2s;
        }
        .note-message:hover { background: #f8fafc; }
        .note-content {
            padding: 8px 12px;
            border-radius: 12px;
            max-width: 90%;
            word-wrap: break-word;
        }
        .note-header {
            display: flex; justify-content: space-between; margin-bottom: 2px;
            font-size: 11px; color: #64748b;
        }
        .note-author { font-weight: 600; }
        .note-text { font-size: 14px; line-height: 1.4; color: #334155; padding: 6px 8px; border-radius: 8px;}
        .note-reactions { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
        
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
        <div style="display:flex; width:100%; position:relative;">
             <input type="text" class="notes-input" placeholder="Напиши бележка..." />
             <button class="notes-send-btn">➤</button>
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
                this.cancelReply();
            }
        });
    };
    
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
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
      
      // Update reactions
      messages.forEach(msg => {
         this.loadReactions(msg.id);
      });
      
      if(wasAtBottom) this.scrollToBottom();
  }
  
  createMessageElement(msg, allMessages) {
      const isMe = msg.userId === currentUser.userId;
      const el = document.createElement('div');
      el.className = 'note-message';
      el.dataset.id = msg.id;
      
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

      const bg = isMe ? '#e0f2fe' : '#f1f5f9';
      
      el.innerHTML = `
         <div class="note-content">
             <div class="note-header">
                 <span class="note-author">${this.escapeHtml(msg.userName)}</span>
                 <span>${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
             </div>
             ${replyHTML}
             <div class="note-text" style="background:${bg}">${this.linkify(msg.text)}</div>
             <div class="note-reactions" id="reactions-${msg.id}"></div>
         </div>
         <div class="note-actions">
             <button class="note-action-btn reply-btn" title="Reply">↩</button>
             <button class="note-action-btn react-btn" title="React">☺</button>
             ${isMe ? '<button class="note-action-btn delete-btn" title="Delete">🗑</button>' : ''}
         </div>
      `;
      
      // Handlers
      el.querySelector('.reply-btn').addEventListener('click', () => this.startReply(msg));
      el.querySelector('.react-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.showReactionPicker(msg.id, e.target);
      });
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
                   this.db.addReaction(msgId, emoji).then(() => this.loadReactions(msgId));
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
  
  async loadReactions(msgId) {
      const display = this.container.querySelector(`#reactions-${msgId}`);
      if(!display) return;
      
      const reactions = await this.db.getReactions(msgId);
      if(!reactions) {
          display.innerHTML = '';
          return;
      }
      
      const reactionCounts = {};
      const myReactions = {};

      Object.keys(reactions).forEach(emoji => {
          const users = reactions[emoji];
          if(users) {
              const activeUsers = Object.keys(users).filter(uid => users[uid] === true);
              const count = activeUsers.length;
              if(count > 0) {
                  reactionCounts[emoji] = count;
                  if (activeUsers.includes(currentUser.userId)) {
                      myReactions[emoji] = true;
                  }
              }
          }
      });
      
      display.innerHTML = Object.keys(reactionCounts).map(emoji => `
          <button class="reaction-badge" data-emoji="${emoji}" data-msgid="${msgId}"
             style="background:${myReactions[emoji] ? '#93c5fd' : '#f1f5f9'};border:none;border-radius:10px;padding:2px 6px;font-size:11px;margin-right:2px;cursor:pointer;font-weight:${myReactions[emoji] ? 'bold' : 'normal'}">
             ${emoji} ${reactionCounts[emoji]}
          </button>
      `).join('');

      // Add click listeners for toggling
      display.querySelectorAll('.reaction-badge').forEach(btn => {
          btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const emoji = btn.dataset.emoji;
              const mId = btn.dataset.msgid;
              
              if (myReactions[emoji]) {
                  this.db.removeReaction(mId, emoji).then(() => this.loadReactions(mId));
              } else {
                  this.db.addReaction(mId, emoji).then(() => this.loadReactions(mId));
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
      // Basic linkify
      return this.escapeHtml(text).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#0ea5e9">$1</a>');
  }
}

// ============================================
// INITIALIZATION
// ============================================

(function() {
    function getDocumentId() {
        // Logic from original notes-init.js to identify file
        const urlParams = new URLSearchParams(window.location.search);
        
        // From md-viewer path
        const pathParam = urlParams.get('path');
        if (pathParam) {
          const filename = pathParam.split('/').pop().replace(/\.[^.]+$/, '');
          return 'doc_' + filename.toLowerCase();
        }
        
        const docIdFromUrl = urlParams.get('docId') || urlParams.get('doc');
        if (docIdFromUrl) return docIdFromUrl;

        const pathname = window.location.pathname;
        const match = pathname.match(/\/([a-z0-9-]+)\.html/i);
        if (match) return 'doc_' + match[1];
        
        return 'doc_general';
    }

    function init() {
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
