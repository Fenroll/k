// ============================================
// COMPLETE CHAT SYSTEM - ONE FILE
// Firebase REST API + UI + User Management
// ============================================

// (Chat system initialized)

// ============================================
// PART 1: ANONYMOUS USER
// ============================================

class AnonymousUser {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.userName = this.getOrCreateUserName();
    this.color = this.generateUserColor();
  }

  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  getOrCreateUserName() {
    // ОПЦИЯ: Разкомент долу за НОВО име при всяко refresh
    // localStorage.removeItem('userName');
    
    let userName = localStorage.getItem('userName');
    if (!userName) {
      const adjectives = [
        'Умен', 'Бърз', 'Силен', 'Весел', 'Смелен',
        'Спокоен', 'Оптимистичен', 'Брилянтен', 'Всеобхватен', 'Бдителен', 'Скромен',
        'Остър', 'Модерен', 'Елегантен', 'Енергичен', 'Креативен'
      ];
      const nouns = [
        'Студент', 'Лекар', 'Учен', 'Гений', 'Мъдрец',
        'Тигър', 'Дракон', 'Лъв', 'Вълк', 'Доктор', 'Професор'
      ];
      
      // Генериране на уникално име
      let newName = '';
      do {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        newName = `${adj} ${noun}`;
      } while (newName === userName); // Ако случайно съвпадне, генерира ново
      
      userName = newName;
      localStorage.setItem('userName', userName);
    }
    return userName;
  }

  generateUserColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE',
      '#FF8B94', '#6BCB77', '#4D96FF', '#FFD93D', '#6A4C93', '#FF6B9D', '#C06C84',
      '#FF9671', '#FFC75F', '#F9F871', '#845EC2', '#2C73D2', '#00B0FF', '#FB5607',
      '#7209B7', '#3A0CA3', '#560BAD', '#B5179E', '#F72585', '#4CC9F0', '#72DDF7',
      '#90E0EF', '#ADE8F7', '#CAF0F8', '#00D9FF', '#00BBF9', '#0096C7', '#023E8A'
    ];
    let color = localStorage.getItem('userColor');
    if (!color) {
      color = colors[Math.floor(Math.random() * colors.length)];
      localStorage.setItem('userColor', color);
    }
    return color;
  }
}

const currentUser = new AnonymousUser();

// ============================================
// PART 2: FIREBASE REST API
// ============================================

class ChatFirebaseREST {
  constructor(documentId) {
    this.documentId = documentId || 'default';
    this.messages = [];
    this.listeners = [];
    this.isPolling = false;
    
    // ВАЖНО: Тук трябва да се попълнят вашите данни от Firebase Console!
    this.firebaseConfig = {
      apiKey: "API_KEY", // Замени с твоя API Key
      authDomain: "med-student-chat.firebaseapp.com",
      databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "med-student-chat",
      storageBucket: "med-student-chat.appspot.com",
      messagingSenderId: "SENDER_ID",
      appId: "APP_ID"
    };

    console.log('Using Firebase SDK Wrapper');
    this.initSDK();
  }

  async initSDK() {
    if (window.firebaseSDK) {
      this.sdk = window.firebaseSDK;
      this.initApp();
      return;
    }

    try {
      // Dynamic loads require modern browser support
      const { initializeApp, getApps, getApp } = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js");
      const dbModule = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js");
      
      this.sdk = { initializeApp, getApps, getApp, ...dbModule };
      window.firebaseSDK = this.sdk;
      this.initApp();
    } catch (e) {
      console.error("Failed to load Firebase SDK:", e);
    }
  }

  initApp() {
    try {
      const { initializeApp, getDatabase, getApps } = this.sdk;
      // Check if app already exists to avoid errors on page reload/navigation
      const app = getApps().length === 0 ? initializeApp(this.firebaseConfig) : getApps()[0];
      this.db = getDatabase(app);
      console.log('✓ Firebase SDK Initialized');
    } catch (e) {
      console.error("Firebase Init Error:", e);
    }
  }

  async _ensureInit() {
    if (this.db) return;
    await this.initSDK();
    // Wait a bit if still initializing?
    while (!this.db) {
        await new Promise(r => setTimeout(r, 100));
        // Add timeout break to avoid infinite loop?
        if (!this.sdk) break; 
    }
  }

  async sendMessage(text, replyTo = null, replyAuthor = null) {
    if (!text.trim()) return false;
    await this._ensureInit();

    const { ref, push, set, serverTimestamp } = this.sdk;
    const messagesRef = ref(this.db, `messages/${this.documentId}`);
    
    const message = {
      userId: currentUser.userId,
      userName: currentUser.userName,
      userColor: currentUser.color,
      text: text.trim(),
      timestamp: serverTimestamp(),
      // id will be generated by key
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
      console.error('SDK Send error:', error);
      return false;
    }
  }

  async loadMessages() {
    // В SDK режим, това се използва рядко, защото startPolling поддържа всичко
    await this._ensureInit();
    const { ref, get, query, orderByChild, limitToLast } = this.sdk;
    
    try {
      const messagesRef = ref(this.db, `messages/${this.documentId}`);
      // Limit to last 100 to prevent lagging
      const q = query(messagesRef, orderByChild('timestamp'), limitToLast(100));
      
      const snapshot = await get(q);
      if (!snapshot.exists()) return [];
      
      const data = snapshot.val();
      const messages = Object.keys(data).map(key => ({
        ...data[key],
        key: key,
        id: key
      }));

      // Sort
      messages.sort((a, b) => a.timestamp - b.timestamp);
      this.messages = messages;
      return messages;
    } catch (error) {
      console.error('SDK Load error:', error);
      return [];
    }
  }

  startPolling(callback, interval = 2000) {
    if (this.isPolling) return;
    this.isPolling = true;

    this._ensureInit().then(() => {
        const { ref, onValue, query, orderByChild, limitToLast } = this.sdk;
        const messagesRef = ref(this.db, `messages/${this.documentId}`);
        // Realtime Listener
        const q = query(messagesRef, orderByChild('timestamp'), limitToLast(100));

        onValue(q, (snapshot) => {
            const messages = [];
            snapshot.forEach((child) => {
                const val = child.val();
                messages.push({
                    ...val,
                    key: child.key,
                    id: child.key,
                    // Handle serverTimestamp properly if it's still processing (can be null briefly)
                    timestamp: val.timestamp || Date.now()
                });
            });
            
            // Check for new messages for notifications
            if (messages.length > this.messages.length && this.messages.length > 0) {
                 const newMessage = messages[messages.length - 1];
                 this.listeners.forEach(listener => listener(newMessage));
            }

            this.messages = messages;
            callback(messages);
        });
    });
  }

  addMessageListener(callback) {
    this.listeners.push(callback);
  }

  async markUserActive() {
    await this._ensureInit();
    const { ref, set, update, onDisconnect, serverTimestamp, onValue } = this.sdk;
    const userRef = ref(this.db, `active_users/${this.documentId}/${currentUser.userId}`);
    const connectedRef = ref(this.db, '.info/connected');

    try {
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                const userData = {
                    userId: currentUser.userId,
                    userName: currentUser.userName,
                    color: currentUser.color,
                    lastSeen: serverTimestamp(),
                    isActive: true
                };
                onDisconnect(userRef).remove();
                set(userRef, userData);
            }
        });

        // Heartbeat: Обновявай timestamp на всеки 60 сек, за да не те мислят за изчезнал
        setInterval(() => {
             if (this.db) {
                 update(userRef, { lastSeen: serverTimestamp() }).catch(e => console.error("Heartbeat error", e));
             }
        }, 30000);

        console.log('✓ Потребител маркиран активен (SDK Presence + Heartbeat)');
        return true;
    } catch (error) {
        console.error('Mark active error:', error);
        return false;
    }
  }

  async getActiveUsers() {
    await this._ensureInit();
    const { ref, get } = this.sdk;
    try {
        const snapshot = await get(ref(this.db, `active_users/${this.documentId}`));
        return snapshot.exists() ? snapshot.val() : {};
    } catch(e) { return {}; }
  }

  async deleteMessage(messageKey) {
    await this._ensureInit();
    const { ref, remove } = this.sdk;
    try {
        const messageRef = ref(this.db, `messages/${this.documentId}/${messageKey}`);
        await remove(messageRef);
        return true;
    } catch (e) {
        console.error("SDK deleteMessage error:", e);
        return false;
    }
  }

  async getReactions(messageId) {
    await this._ensureInit();
    const { ref, get } = this.sdk;
    try {
      const snapshot = await get(ref(this.db, `reactions/${this.documentId}/${messageId}`));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (e) {
      console.error("SDK getReactions error:", e);
      return null;
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
    const { ref, set } = this.sdk;
    try {
      // Use set with false to "remove" (logically) or null/remove to physically remove?
      // The original code used PUT with true/false, establishing a schema where key=userId, value=true/false
      // path: reactions/docId/msgId/emoji/userId = true/false
      const reactionRef = ref(this.db, `reactions/${this.documentId}/${messageId}/${emoji}/${currentUser.userId}`);
      
      // If value is false, maybe we should remove the node to keep DB clean, 
      // but original code sent 'false'. Let's stick to user logic or improve it.
      // Actually, removing it is better for counting.
      if (value) {
          await set(reactionRef, true);
      } else {
          await set(reactionRef, null); // Remove the node
      }
      return true;
    } catch (e) {
      console.error("SDK setReaction error:", e);
      return false;
    }
  }

  startActiveUsersPolling(callback, interval = 5000) {
    this._ensureInit().then(() => {
        const { ref, onValue } = this.sdk;
        onValue(ref(this.db, `active_users/${this.documentId}`), (snapshot) => {
            const usersRaw = snapshot.val() || {};
            const validUsers = {};
            
            // Филтрирай само валидни потребители с име
            Object.keys(usersRaw).forEach(key => {
                const u = usersRaw[key];
                // Проверка дали записът е обект и има userName
                if (u && typeof u === 'object' && u.userName) {
                    validUsers[key] = u;
                }
            });
            
            callback({
                count: Object.keys(validUsers).length,
                users: validUsers,
                usersList: Object.keys(validUsers)
            });
        });
    });
  }

  stop() {
    this.isPolling = false;
    this.listeners = [];
  }
}

// ============================================
// PART 3: CHAT UI MANAGER
// ============================================

class ChatUIManager {
  constructor(containerId, documentId) {
    console.log('💬 ChatUIManager инициализирам...');
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('Container не е намерен:', containerId);
      return;
    }
    
    this.documentId = documentId || 'default';
    this.chatFirebase = new ChatFirebaseREST(this.documentId);
    this.isOpen = false;
    this.autoScroll = true;
    this.lastReadMessageId = localStorage.getItem(`lastReadMessage_${documentId}`) || null;
    this.notificationsDisabled = localStorage.getItem(`notificationsDisabled_${documentId}`) !== 'false';
    this.unreadCount = 0;
    this.lastMessages = [];  // Съхранявам предишни съобщения

    this.init();
  }

  async init() {
    try {
      // Маркирай потребител активен
      await this.chatFirebase.markUserActive();

      // Зареди първоначални съобщения - от localStorage или Firebase
      let messages = this.loadFromCache();
      if (!messages || messages.length === 0) {
        messages = await this.chatFirebase.loadMessages();
      }
      this.saveToCache(messages);
      this.renderMessages(messages);

      // Polling за нови съобщения - SMART CHECK с localStorage
      this.chatFirebase.startPolling((messages) => {
        this.saveToCache(messages);
        this.renderMessages(messages);
      }, 2500);

      // Polling за реакции - вече се управлява автоматично от SDK
      /* 
      setInterval(async () => {
        const messages = await this.chatFirebase.loadMessages();
        this.saveToCache(messages);
        messages.forEach(msg => {
          this.loadAndDisplayReactions(msg.id);
        });
      }, 1000); 
      */

      // Polling за активни потребители
      this.chatFirebase.startActiveUsersPolling((data) => {
        this.updateNotificationButton(data);
        this.updateHeaderOnlineCount(data.count);
      }, 5000);

      // Listener за уведомления
      this.chatFirebase.addMessageListener((message) => {
        if (!this.isOpen) {
          this.showNotification();
        }
      });

      this.attachEventListeners();
      
      // Инициализирай бутон за уведомления един път
      this.initNotificationButton();
      
      console.log('✓✓✓ ChatUIManager готов');
    } catch (error) {
      console.error('Init error:', error);
    }
  }

  loadFromCache() {
    try {
      const key = `chatMessages_${this.documentId}`;
      const cached = localStorage.getItem(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Cache load error:', error);
    }
    return null;
  }

  saveToCache(messages) {
    try {
      const key = `chatMessages_${this.documentId}`;
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  attachEventListeners() {
    const sendBtn = this.container.querySelector('.chat-send-btn');
    const input = this.container.querySelector('.chat-input');

    if (sendBtn && input) {
      sendBtn.addEventListener('click', () => this.handleSendMessage());
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    const messagesContainer = this.container.querySelector('.chat-messages');
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', () => {
        const isAtBottom =
          messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
        this.autoScroll = isAtBottom;
      });
    }
  }

  initNotificationButton() {
    // Инициализирай бутон за уведомления един път
    const sidebarEl = this.container.querySelector('.chat-active-users');
    if (!sidebarEl) {
      console.error('Sidebar не е намерен!');
      return;
    }

    sidebarEl.innerHTML = `
      <div style="padding: 8px;">
        <button id="toggle-notifications" style="width: 100%; padding: 10px; background: ${this.notificationsDisabled ? '#ff6b6b' : '#4ade80'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <img src="svg/${this.notificationsDisabled ? 'bell-slash-svgrepo-com.svg' : 'bell-alt-svgrepo-com.svg'}" alt="Уведомления" style="width: 16px; height: 16px; filter: invert(1);">
          <span>${this.notificationsDisabled ? 'Изключени' : 'Включени'}</span>
        </button>
        <div id="active-users-list" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;"></div>
      </div>
    `;

    // Добави listener един път
    const toggleBtn = sidebarEl.querySelector('#toggle-notifications');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.notificationsDisabled = !this.notificationsDisabled;
        localStorage.setItem(`notificationsDisabled_${this.documentId}`, this.notificationsDisabled);
        // Обнови цвета без да презаписваш HTML
        this.updateNotificationButtonColor();
        // Обнови иконката (скрий/покажи числото на непрочетени)
        this.updateActiveCount();
      });
    } else {
      console.error('Бутон НЕ е намерен!');
    }
  }

  updateNotificationButtonColor() {
    // Обнови само цвета и текста на бутона без да презаписваш HTML
    const toggleBtn = document.querySelector('#toggle-notifications');
    if (toggleBtn) {
      toggleBtn.style.background = this.notificationsDisabled ? '#ff6b6b' : '#4ade80';
      const img = toggleBtn.querySelector('img');
      if (img) {
        img.src = `svg/${this.notificationsDisabled ? 'bell-slash-svgrepo-com.svg' : 'bell-alt-svgrepo-com.svg'}`;
      }
      const span = toggleBtn.querySelector('span');
      if (span) {
        span.textContent = this.notificationsDisabled ? 'Изключени' : 'Включени';
      }
    }
  }

  updateNotificationButton(data) {
    // Обнови активни потребители в списъка (без да презаписваш бутона)
    const usersList = document.getElementById('active-users-list');
    if (!usersList) return;

    const users = Object.values(data.users || {}).slice(0, 5);
    usersList.innerHTML = `
      <strong>Активни (${data.count}):</strong><br>
      ${users.map(user => `
        <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${user.color};"></div>
          <span style="font-size: 10px;">${user.userName}</span>
        </div>
      `).join('')}
    `;
  }

  async handleAdminCommand(commandObj) {
      const cmd = commandObj.substring(7).trim(); // Remove "/admin "

      if (cmd === 'deletechat') {
          if(confirm("⚠ WARNING: This will delete ALL chat history globally! Are you sure?")) {
              await window.deleteAllChatMessages('admin');
          }
          return;
      }

      // /admin rename OldName: NewName
      if (cmd.startsWith('rename ')) {
          const parts = cmd.substring(7).split(':');
          if (parts.length === 2) {
              const oldName = parts[0].trim();
              const newName = parts[1].trim();
              await this.adminRenameUser(oldName, newName);
          } else {
              alert('Usage: /admin rename Old Name: New Name');
          }
          return;
      }

      // /admin claimname New Name
      if (cmd.startsWith('claimname ')) {
          const newName = cmd.substring(10).trim();
          if (newName) {
              this.claimName(newName);
          } else {
              alert('Usage: /admin claimname New Name');
          }
          return;
      }
  }

  claimName(newName) {
      if (!newName) return;
      
      // Update global user object
      currentUser.userName = newName;
      
      // Update local storage
      localStorage.setItem('userName', newName);
      
      // Update UI
      const currentUserNameEl = document.getElementById('current-user-name');
      if (currentUserNameEl) {
          currentUserNameEl.textContent = newName;
      }
      
      // Update presence
      this.chatFirebase.markUserActive();
      
      alert(`✅ Успешно сменихте името си на: ${newName}`);
  }

  async adminRenameUser(oldName, newName) {
      if (!confirm(`Rename all messages from "${oldName}" to "${newName}"?`)) return;

      const messages = this.chatFirebase.messages;
      let count = 0;
      
      // Update each message found locally (but perform update on server)
      // Ideally we should query server, but iterating local is decent approximation for now
      for (const msg of messages) {
          if (msg.userName === oldName) {
              await this.chatFirebase.updateMessage(msg.key, { userName: newName });
              count++;
          }
      }
      
      alert(`Renamed ${count} messages.`);
  }

  async handleSendMessage() {
    const input = this.container.querySelector('.chat-input');
    const text = input.value;

    if (!text.trim()) return;

    // --- ADMIN COMMANDS ---
    if (text.startsWith('/admin ')) {
       await this.handleAdminCommand(text);
       input.value = '';
       return;
    }
    // ----------------------

    // Провери дали има reply
    const replyTo = input.dataset.replyTo;
    const replyAuthor = input.dataset.replyAuthor;

    const success = await this.chatFirebase.sendMessage(text, replyTo, replyAuthor);
    if (success) {
      input.value = '';
      input.dataset.replyTo = '';
      input.dataset.replyAuthor = '';
      input.focus();
      
      // Премахни reply indicator
      const replyIndicator = this.container.querySelector('.reply-indicator');
      if (replyIndicator) replyIndicator.remove();
      
      setTimeout(async () => {
        const messages = await this.chatFirebase.loadMessages();
        this.saveToCache(messages);  // Запази в localStorage
        this.renderMessages(messages);
      }, 500);
    }
  }

  recalculateUnreadCount(messages) {
    if (!this.lastReadMessageId) {
        this.unreadCount = messages.length;
        return;
    }

    let readIndex = messages.findIndex(m => m.id === this.lastReadMessageId);
    
    // If marker is gone (deleted), try to recover using previous history
    if (readIndex === -1 && this.lastMessages.length > 0) {
        const oldIndex = this.lastMessages.findIndex(m => m.id === this.lastReadMessageId);
        if (oldIndex !== -1) {
            // Find a survivor preceding the deleted marker
            // Iterate backwards from oldIndex to find a survivor
            for (let i = oldIndex - 1; i >= 0; i--) {
                const predecessor = this.lastMessages[i];
                if (messages.find(m => m.id === predecessor.id)) {
                    this.lastReadMessageId = predecessor.id;
                    localStorage.setItem(`lastReadMessage_${this.documentId}`, this.lastReadMessageId);
                    readIndex = messages.findIndex(m => m.id === this.lastReadMessageId);
                    break;
                }
            }
        }
        
        // If still not found (e.g. all preceding messages deleted too, or never found), reset to 0
        // Because if the marker is gone, we assume the user was up to date.
        if (readIndex === -1) {
             this.unreadCount = 0;
             return;
        }
    }
    
    // Calculate unread
    if (readIndex !== -1) {
        this.unreadCount = Math.max(0, messages.length - readIndex - 1);
    } else {
        this.unreadCount = messages.length; 
    }
  }

  renderMessages(messages) {
    const messagesContainer = this.container.querySelector('.chat-messages');
    if (!messagesContainer) return;

    const scrollWasAtBottom = this.autoScroll ||
      messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;

    // SMART UPDATE: Сравни старите и новите съобщения
    const oldIds = new Set(this.lastMessages.map(m => m.id));
    const newIds = new Set(messages.map(m => m.id));
    
    // Откри нови, изтрити и променени съобщения
    const addedIds = [...newIds].filter(id => !oldIds.has(id));
    const deletedIds = [...oldIds].filter(id => !newIds.has(id));
    
    // Ако е първи път, render всичко
    if (this.lastMessages.length === 0) {
      this.fullRenderMessages(messages, messagesContainer);
    } else if (deletedIds.length > 0) {
      // INCREMENTAL DELETE
      deletedIds.forEach(deletedId => {
        const el = messagesContainer.querySelector(`[data-message-id="${deletedId}"]`);
        if (el) {
          el.style.opacity = '0';
          el.style.transition = 'opacity 0.3s';
          setTimeout(() => el.remove(), 300);
        }
      });
    } else if (addedIds.length > 0) {
      // INCREMENTAL ADD
      addedIds.forEach(newId => {
        const msg = messages.find(m => m.id === newId);
        if (msg) {
          const messageEl = this.createMessageElement(msg, messages);
          messagesContainer.appendChild(messageEl);
          this.attachMessageListeners(messageEl);
        }
      });
    }

    // ROBUST UNREAD CALCULATION
    this.recalculateUnreadCount(messages);

    // Обнови реакциите за всяко съобщение (само променените)
    [...addedIds, ...oldIds].forEach(id => {
      const msg = messages.find(m => m.id === id);
      if (msg) {
        this.loadAndDisplayReactions(msg.id);
      }
    });

    // Обнови badge
    this.updateActiveCount();

    // Съхрани за следния път
    this.lastMessages = messages;

    if (scrollWasAtBottom) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 0);
    }
  }

  fullRenderMessages(messages, messagesContainer) {
    messagesContainer.innerHTML = '';
    
    // Добави всички съобщения един по един (incremental)
    messages.forEach(msg => {
      const messageEl = this.createMessageElement(msg, messages);
      messagesContainer.appendChild(messageEl);
      this.attachMessageListeners(messageEl);
    });
  }

  createMessageElement(msg, messagesMap) {
    const messagesMapObj = {};
    (messagesMap || []).forEach(m => {
      messagesMapObj[m.id] = m;
    });

    // Ако има reply, намери оригиналното съобщение
    let replyHTML = '';
    if (msg.replyTo && messagesMapObj[msg.replyTo]) {
      const originalMsg = messagesMapObj[msg.replyTo];
      replyHTML = `
        <div style="background: #e8f5e9; border-left: 3px solid #4ade80; padding: 8px; margin-bottom: 8px; font-size: 11px; border-radius: 3px; max-width: 100%; overflow: hidden;">
          <div style="color: #666; font-weight: bold; margin-bottom: 4px;">Отговор на ${this.escapeHtml(msg.replyAuthor)}</div>
          <div style="color: #999; padding: 6px; background: white; border-radius: 3px; max-height: 40px; overflow: hidden; word-wrap: break-word; word-break: break-word;">"${this.linkifyText(originalMsg.text)}"</div>
        </div>
      `;
    }

    const isCurrentUser = msg.userId === currentUser.userId || msg.userName === currentUser.userName;
    const messageBgColor = msg.userId === currentUser.userId ? '#e0f2fe' : 'var(--chat-secondary)';

    const htmlString = `
      <div class="chat-message" data-user-id="${msg.userId}" data-message-id="${msg.id}" data-message-key="${msg.key}" style="position: relative;">
        <div class="message-content">
          <div class="message-header">
            <span class="message-author">${this.escapeHtml(msg.userName)}</span>
            <span class="message-time">${this.formatTime(msg.timestamp)}</span>
          </div>
          ${replyHTML}
          <div class="message-text" style="background-color: ${messageBgColor};">${this.linkifyText(msg.text)}</div>
          <div class="message-reactions" data-message-id="${msg.id}"></div>
        </div>
        <button class="message-reply-btn" data-message-id="${msg.id}" style="position: absolute; top: 8px; right: 8px; display: none; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; width: 28px; height: 28px;" title="Отговори">
          <img src="svg/reply-svgrepo-com.svg" alt="Reply" style="width: 100%; height: 100%; opacity: 0.7; filter: invert(0.3);">
        </button>
        <button class="message-reaction-btn" data-message-id="${msg.id}" style="position: absolute; top: 8px; right: 36px; display: none; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; width: 28px; height: 28px;" title="Добави реакция">
          <img src="svg/reaction-emoji-add-svgrepo-com.svg" alt="Reaction" style="width: 100%; height: 100%; opacity: 0.7;">
        </button>
        ${isCurrentUser ? `<button class="message-delete-btn" data-message-key="${msg.key}" style="position: absolute; top: 8px; right: 64px; display: none; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; width: 28px; height: 28px;" title="Изтрий съобщение">
          <img src="svg/trash-blank-alt-svgrepo-com.svg" alt="Delete" style="width: 100%; height: 100%; opacity: 0.6;">
        </button>` : ''}
      </div>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = htmlString;
    return temp.firstElementChild;
  }

  attachMessageListeners(msgEl) {
    msgEl.addEventListener('mouseenter', () => {
      const btn = msgEl.querySelector('.message-reaction-btn');
      const replyBtn = msgEl.querySelector('.message-reply-btn');
      const deleteBtn = msgEl.querySelector('.message-delete-btn');
      if (btn) btn.style.display = 'block';
      if (replyBtn) replyBtn.style.display = 'block';
      if (deleteBtn) deleteBtn.style.display = 'block';
    });
    msgEl.addEventListener('mouseleave', () => {
      const btn = msgEl.querySelector('.message-reaction-btn');
      const replyBtn = msgEl.querySelector('.message-reply-btn');
      const deleteBtn = msgEl.querySelector('.message-delete-btn');
      if (btn) btn.style.display = 'none';
      if (replyBtn) replyBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
    });

    // Добави listener за реакции
    const reactionBtn = msgEl.querySelector('.message-reaction-btn');
    if (reactionBtn) {
      reactionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showReactionPicker(msgEl.dataset.messageId);
      });
    }

    // Добави listener за reply
    const replyBtn = msgEl.querySelector('.message-reply-btn');
    if (replyBtn) {
      replyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startReply(msgEl.dataset.messageId, msgEl);
      });
    }

    // Добави listener за delete
    const deleteBtn = msgEl.querySelector('.message-delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const messageKey = deleteBtn.dataset.messageKey;
        this.deleteMessage(messageKey);
      });
    }
  }
HeaderOnHeaderOnlineCount(count) {
    const onlineCountEl = this.container.querySelector('.chat-online-count');
    if (onlineCountEl) {
        onlineCountEl.textContent = `🟢 ${count || 1} Online`;
    }
  }

  updatelineCount(count) {
    const onlineCountEl = this.container.querySelector('.chat-online-count');
    if (onlineCountEl) {
        onlineCountEl.textContent = `🟢 ${count || 1} Online`;
    }
  }

  updateHeaderOnlineCount(count) {
    const onlineCountEl = this.container.querySelector('.chat-online-count');
    if (onlineCountEl) {
        onlineCountEl.textContent = `🟢 ${count || 1} Online`;
    }
  }

  updateActiveCount(data) {
    const badgeEl = document.querySelector('.chat-badge-count');
    
    // Покази брой непрочетени съобщения САМО ако уведомленията са включени И чатът е затворен
    if (badgeEl) {
      if (this.notificationsDisabled || this.isOpen) {
        badgeEl.style.display = 'none';
      } else {
        badgeEl.textContent = this.unreadCount;
        badgeEl.style.display = this.unreadCount > 0 ? 'flex' : 'none';
      }
    }
  }

  updateNotificationButton(data) {
    // Обнови активни потребители в списъка (без да презаписваш бутона)
    const usersList = document.getElementById('active-users-list');
    if (!usersList) return;

    const users = Object.values(data.users || {}).slice(0, 5);
    const activeCount = data.count || users.length || 0;
    
    if (users.length === 0) {
      usersList.innerHTML = '';
      return;
    }

    usersList.innerHTML = `
      <strong>Активни (${activeCount}):</strong><br>
      ${users.filter(user => user && user.userName && user.color).map(user => `
        <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${user.color};"></div>
          <span style="font-size: 10px;">${user.userName}</span>
        </div>
      `).join('')}
    `;
  }

  updateActiveSidebar(users) {
    const sidebarEl = this.container.querySelector('.chat-active-users');
    if (!sidebarEl) return;

    const usersList = Object.values(users).slice(0, 5);
    sidebarEl.innerHTML = `
      <div class="active-users-header">Активни сега:</div>
      ${usersList.map(user => `
        <div class="active-user" title="${user.userName}">
          <div class="active-user-badge" style="background-color: ${user.color}">
            ${user.userName.charAt(0)}
          </div>
          <span>${user.userName}</span>
        </div>
      `).join('')}
    `;
  }

  showNotification() {
    // Не показвай визуална уведомления - само числото на непрочетени
    // Числото вече се показва от updateActiveCount()
  }

  markAsRead() {
    const messages = this.chatFirebase.messages;
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      this.lastReadMessageId = lastMessage.id;
      localStorage.setItem(`lastReadMessage_${this.documentId}`, lastMessage.id);
      this.unreadCount = 0;
      this.updateActiveCount();
    }
  }

  showReactionPicker(messageId) {
    // Премахни стар picker ако съществува
    const oldPicker = document.querySelector('.reaction-picker');
    if (oldPicker) oldPicker.remove();

    const emojis1 = ['👍', '👎', '😂', '❤️', '😮', '🐐'];
    const emojis2 = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
    
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
    `;

    const addEmojiButton = (emoji, messageId) => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = `
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 4px;
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addReaction(messageId, emoji);
        picker.remove();
        document.removeEventListener('click', closePicker);
      });
      return btn;
    };

    // Първи ред емоджи
    const row1 = document.createElement('div');
    row1.style.cssText = 'display: flex; gap: 4px; justify-content: space-around;';
    emojis1.forEach(emoji => {
      row1.appendChild(addEmojiButton(emoji, messageId));
    });
    picker.appendChild(row1);

    // Втори ред букви
    const row2 = document.createElement('div');
    row2.style.cssText = 'display: flex; gap: 4px; justify-content: space-around;';
    emojis2.forEach(emoji => {
      row2.appendChild(addEmojiButton(emoji, messageId));
    });
    picker.appendChild(row2);

    // Позиционирай picker до съобщението
    const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (msgEl) {
      const rect = msgEl.getBoundingClientRect();
      picker.style.left = (rect.left + 50) + 'px';
      picker.style.top = (rect.top - 60) + 'px';
      document.body.appendChild(picker);
    }

    // Функция за затваряне на picker
    const closePicker = (e) => {
      // Ако кликнеш извън picker-а - затвори
      if (!picker.contains(e.target) && !e.target.closest('[data-message-id]')) {
        picker.remove();
        document.removeEventListener('click', closePicker);
      }
    };
    
    // Добави listener за всеки клик
    document.addEventListener('click', closePicker);
  }

  async addReaction(messageId, emoji) {
    if (await this.chatFirebase.addReaction(messageId, emoji)) {
      console.log('✓ Реакция добавена:', emoji);
      this.loadAndDisplayReactions(messageId);
    }
  }

  async loadAndDisplayReactions(messageId) {
    try {
      const reactions = await this.chatFirebase.getReactions(messageId);
      
      const container = document.querySelector(`[data-message-id="${messageId}"] .message-reactions`);
      
      if (!container) return;

      if (!reactions) {
        container.innerHTML = '';
        return;
      }

      const reactionCounts = {};
      const myReactions = {};
      
      Object.keys(reactions).forEach(emoji => {
        // Since we are now using SDK and likely storing just true/null, or maybe the OLD data has false
        // we should handle both.
        // Structure: reactions[emoji] = { userId1: true, userId2: false, ... }
        const usersObj = reactions[emoji] || {};
        const userIds = Object.keys(usersObj).filter(userId => usersObj[userId] === true);
        const count = userIds.length;
        
        if (count > 0) {
          reactionCounts[emoji] = count;
          if (userIds.includes(currentUser.userId)) {
            myReactions[emoji] = true;
          }
        }
      });
      
      // Ако няма реакции - изчисти контейнера
      if (Object.keys(reactionCounts).length === 0) {
        container.innerHTML = '';
        return;
      }

      container.innerHTML = Object.keys(reactionCounts).map(emoji => `
        <button class="reaction-badge" data-emoji="${emoji}" data-message-id="${messageId}" 
          style="background: ${myReactions[emoji] ? '#93c5fd' : '#f0f0f0'}; border: none; border-radius: 12px; padding: 4px 8px; margin-right: 4px; cursor: pointer; font-size: 12px; font-weight: ${myReactions[emoji] ? 'bold' : 'normal'};">
          ${emoji} <span>${reactionCounts[emoji]}</span>
        </button>
      `).join('');

      // Добави listeners за toggle реакции при клик на badge
      container.querySelectorAll('.reaction-badge').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const emoji = btn.dataset.emoji;
          const msgId = btn.dataset.messageId;
          
          if (myReactions[emoji]) {
            this.removeReaction(msgId, emoji);
          } else {
            this.addReaction(msgId, emoji);
          }
        });
      });
    } catch (error) {
      console.error('Load reactions error:', error);
    }
  }

  async removeReaction(messageId, emoji) {
    if (await this.chatFirebase.removeReaction(messageId, emoji)) {
      this.loadAndDisplayReactions(messageId);
    }
  }

  startReply(messageId, messageEl) {
    // Намери текста на съобщението
    const textEl = messageEl.querySelector('.message-text');
    const authorEl = messageEl.querySelector('.message-author');
    
    if (!textEl || !authorEl) return;

    const author = authorEl.textContent;
    const text = textEl.textContent;

    // Постави reply инфо в input поле
    const input = this.container.querySelector('.chat-input');
    if (input) {
      input.dataset.replyTo = messageId;
      input.dataset.replyAuthor = author;
      input.dataset.replyText = text;
      
      // Добавяй визуална индикация
      const inputArea = this.container.querySelector('.chat-input-area');
      let replyIndicator = inputArea.querySelector('.reply-indicator');
      
      if (!replyIndicator) {
        replyIndicator = document.createElement('div');
        replyIndicator.className = 'reply-indicator';
        inputArea.insertBefore(replyIndicator, input);
      }

      replyIndicator.style.cssText = `
        background: #f0f0f0;
        border-left: 3px solid #4ade80;
        padding: 8px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 12px;
      `;

      replyIndicator.innerHTML = `
        <div style="color: #666; margin-bottom: 4px; font-weight: bold;">Отговор на ${this.escapeHtml(author)}</div>
        <div style="color: #999; margin-bottom: 6px; padding: 6px; background: white; border-radius: 3px; max-height: 50px; overflow: hidden; word-wrap: break-word; word-break: break-word;">"${this.escapeHtml(text)}"</div>
        <button onclick="this.closest('.reply-indicator').remove(); this.previousElementSibling.dataset.replyTo = '';" style="background: #999; color: white; border: none; border-radius: 3px; padding: 2px 6px; cursor: pointer; font-size: 11px;">Отмяна</button>
      `;

      input.focus();
    }
  }

  toggleChat() {
    if (!this.container) {
      console.error('Container не е намерен!');
      return;
    }
    this.isOpen = !this.isOpen;
    const chatPanel = this.container.querySelector('.chat-panel');
    if (chatPanel) {
      chatPanel.classList.toggle('open', this.isOpen);
      if (this.isOpen) {
        const input = this.container.querySelector('.chat-input');
        if (input) input.focus();
        
        // Маркирай съобщенията като прочетени
        this.markAsRead();
      }
    }
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  linkifyText(text) {
    // Разпознаи URL-и и преобразувай ги в линкове
    const escaped = this.escapeHtml(text);
    const urlRegex = /(https?:\/\/[^\s<>\[\]{}|\\^`"]*)/g;
    return escaped.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" style="color: #4ade80; text-decoration: underline; cursor: pointer;">${url}</a>`;
    });
  }

  async deleteMessage(messageKey) {
        if (await this.chatFirebase.deleteMessage(messageKey)) {
            // Премахни локално веднага с анимация
            const messagesContainer = this.container.querySelector('.chat-messages');
            const messageEl = messagesContainer.querySelector(`[data-message-key="${messageKey}"]`);
            if (messageEl) {
                messageEl.style.opacity = '0';
                messageEl.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    messageEl.remove();
                }, 300);
            }
        } else {
            console.error('Failed to delete message via SDK');
        }
  }

  destroy() {
    this.chatFirebase.stop();
  }
}

// ============================================
// PART 4: INITIALIZATION
// ============================================

(function initializeChat() {
  console.log('Chat init...');
  
  let attempts = 0;
  const maxAttempts = 20;

  function tryInit() {
    attempts++;
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initChat);
    } else if (attempts < maxAttempts) {
      if (document.getElementById('chat-widget')) {
        initChat();
      } else {
        setTimeout(tryInit, 100);
      }
    }
  }

  function initChat() {
    console.log('Инициализирам Chat UI...');
    
    const chatWidget = document.getElementById('chat-widget');
    if (!chatWidget) {
      console.error('Chat widget не е намерен!');
      return;
    }

    // ГЛОБАЛЕН ЧАТ ЗА ВСИЧКИ САЙТОВЕ
    const documentId = 'global-chat';

    let chatManager;
    try {
      chatManager = new ChatUIManager('chat-widget', documentId);
      window.chatManager = chatManager;
      console.log('✓✓✓ Chat система ГОТОВА!');
    } catch (error) {
      console.error('Chat init error:', error);
      return;
    }

    const chatIcon = document.getElementById('chat-toggle');
    if (chatIcon) {
      chatIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('💬 Click');
        if (window.chatManager) {
          window.chatManager.toggleChat();
        }
      });
    }

    const chatCloseBtn = document.getElementById('chat-close');
    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.chatManager) {
          window.chatManager.toggleChat();
        }
      });
    }

    const currentUserNameEl = document.getElementById('current-user-name');
    if (currentUserNameEl && currentUser) {
      currentUserNameEl.textContent = currentUser.userName;
    }

    console.log('Потребител:', currentUser.userName);
  }

  tryInit();
})();

// ============================================
// GLOBAL RESET FUNCTION - достъпна отвсякъде
// ============================================

window.resetChat = function() {
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
  localStorage.removeItem('userColor');
  console.log('✅ Ресет завършен! Напиши в консолата: location.reload()');
};

window.deleteAllChatMessages = async function(password) {
  if (!password) {
    console.error('❌ Парола не е дадена! Използвай: window.deleteAllChatMessages("admin")');
    return false;
  }

  if (password !== 'admin') {
    console.error('❌ ГРЕШНА ПАРОЛА!');
    return false;
  }

  try {
    const baseURL = 'https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app';
    const messagesRef = `${baseURL}/messages/global-chat.json`; // Fix: target global-chat
    const reactionsRef = `${baseURL}/reactions/global-chat.json`; // Fix: target global-chat

    // Изтрий съобщенията
    const msgResponse = await fetch(messagesRef, { method: 'DELETE' });
    if (!msgResponse.ok) throw new Error('Грешка при изтриване на съобщенията');

    // Изтрий реакциите
    const reactResponse = await fetch(reactionsRef, { method: 'DELETE' });
    if (!reactResponse.ok) throw new Error('Грешка при изтриване на реакциите');

    console.log('✅ ЧАТ ИЗТРИТ УСПЕШНО! Всички съобщения и реакции са премахнати.');
    console.log('💡 Напиши: location.reload() за да видиш промените');
    return true;
  } catch (error) {
    console.error('❌ Грешка при изтриване на чата:', error);
    return false;
  }
};

console.log('💡 Команди: resetChat() - ресет на име');

