// ============================================
// COMPLETE CHAT SYSTEM - ONE FILE
// Firebase REST API + UI + User Management
// ============================================

console.log('🔧 Инициализирам Complete Chat System...');

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
        'Умен', 'Бърз', 'Силен', 'Весел', 'Смелен', 'Светъл',
        'Спокоен', 'Оптимист', 'Брилянтен', 'Всеобхватен',
        'Ловък', 'Прав', 'Бдителен', 'Майстерски', 'Скромен',
        'Остър', 'Модерен', 'Елегантен', 'Энергичен', 'Креативен'
      ];
      const nouns = [
        'Студент', 'Лекар', 'Учен', 'Гений', 'Израелец', 'Мъдрец',
        'Тигър', 'Феникс', 'Дракон', 'Лъв', 'Вълк', 'Доктор', 'Професор',
        'Инженер', 'Художник', 'Музикант', 'Строител', 'Пилот', 'Капитан', 'Шампион'
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
console.log('✓ Потребител:', currentUser.userName);

// ============================================
// PART 2: FIREBASE REST API
// ============================================

class ChatFirebaseREST {
  constructor(documentId) {
    this.documentId = documentId || 'default';
    this.baseURL = 'https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app';
    this.messagesEndpoint = `${this.baseURL}/messages/${this.documentId}.json`;
    this.activeUsersEndpoint = `${this.baseURL}/active_users/${this.documentId}.json`;
    this.messages = [];
    this.listeners = [];
    this.isPolling = false;
    console.log('✓ Firebase REST за:', documentId);
  }

  async sendMessage(text, replyTo = null, replyAuthor = null) {
    if (!text.trim()) return false;

    const message = {
      userId: currentUser.userId,
      userName: currentUser.userName,
      userColor: currentUser.color,
      text: text.trim(),
      timestamp: Date.now(),
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    // Ако има reply, добави го
    if (replyTo && replyAuthor) {
      message.replyTo = replyTo;
      message.replyAuthor = replyAuthor;
    }

    try {
      const response = await fetch(this.messagesEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (response.ok) {
        console.log('✓ Съобщение отправено');
        return true;
      } else {
        console.error('Firebase error:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Send error:', error);
      return false;
    }
  }

  async loadMessages() {
    try {
      const response = await fetch(this.messagesEndpoint);
      if (!response.ok) return [];
      
      const data = await response.json();
      if (!data) return [];

      const messages = Object.keys(data).map(key => ({
        ...data[key],
        key: key
      }));

      messages.sort((a, b) => a.timestamp - b.timestamp);
      this.messages = messages;
      return messages;
    } catch (error) {
      console.error('Load error:', error);
      return [];
    }
  }

  startPolling(callback, interval = 2000) {
    if (this.isPolling) return;
    this.isPolling = true;
    let lastCount = 0;

    const poll = async () => {
      try {
        const messages = await this.loadMessages();
        
        // Ако брой съобщения се промени, обнови UI
        if (messages.length !== lastCount) {
          callback(messages);
          lastCount = messages.length;
          
          // Ако има ново съобщение, уведоми
          if (messages.length > 0 && messages.length > lastCount - 1) {
            const newMessage = messages[messages.length - 1];
            this.listeners.forEach(listener => listener(newMessage));
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
      
      setTimeout(poll, interval);
    };

    poll();
  }

  addMessageListener(callback) {
    this.listeners.push(callback);
  }

  async markUserActive() {
    const userRef = `${this.baseURL}/active_users/${this.documentId}/${currentUser.userId}.json`;
    
    try {
      const userData = {
        userId: currentUser.userId,
        userName: currentUser.userName,
        color: currentUser.color,
        lastSeen: Date.now(),
        isActive: true
      };

      await fetch(userRef, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      console.log('✓ Потребител маркиран активен');

      setInterval(async () => {
        await fetch(userRef, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastSeen: Date.now() })
        });
      }, 30000);

      window.addEventListener('beforeunload', async () => {
        await fetch(userRef, { method: 'DELETE' });
      });

      return true;
    } catch (error) {
      console.error('Mark active error:', error);
      return false;
    }
  }

  async getActiveUsers() {
    try {
      const response = await fetch(this.activeUsersEndpoint);
      if (!response.ok) return {};
      
      const data = await response.json();
      const now = Date.now();
      
      const activeUsers = {};
      const inactiveUsers = [];

      Object.keys(data || {}).forEach(userId => {
        const user = data[userId];
        if (now - user.lastSeen < 120000) {  // 2 минути
          activeUsers[userId] = user;
        } else {
          inactiveUsers.push(userId);
        }
      });

      // Изтрий неактивните потребители
      for (const userId of inactiveUsers) {
        const userRef = `${this.baseURL}/active_users/${this.documentId}/${userId}.json`;
        try {
          await fetch(userRef, { method: 'DELETE' });
        } catch (e) {
          console.warn('Не можах да изтря неактивния потребител:', userId);
        }
      }

      return activeUsers;
    } catch (error) {
      console.error('Get users error:', error);
      return {};
    }
  }

  startActiveUsersPolling(callback, interval = 5000) {
    const poll = async () => {
      const users = await this.getActiveUsers();
      callback({
        count: Object.keys(users).length,
        users: users,
        usersList: Object.keys(users)
      });
      setTimeout(poll, interval);
    };

    poll();
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
    this.notificationsDisabled = localStorage.getItem(`notificationsDisabled_${documentId}`) === 'true';
    this.unreadCount = 0;

    this.init();
  }

  async init() {
    try {
      // Маркирай потребител активен
      await this.chatFirebase.markUserActive();

      // Зареди първоначални съобщения
      const messages = await this.chatFirebase.loadMessages();
      this.renderMessages(messages);

      // Polling за нови съобщения
      this.chatFirebase.startPolling((messages) => {
        this.renderMessages(messages);
      }, 2500);  // Всеки 2.5 секунди (вместо 1)

      // Polling за активни потребители
      this.chatFirebase.startActiveUsersPolling((data) => {
        // Показвай бутон за уведомления И активни потребители
        this.updateNotificationButton(data);
      }, 5000);  // Всеки 5 секунди (вместо 2)

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
        <button id="toggle-notifications" style="width: 100%; padding: 10px; background: ${this.notificationsDisabled ? '#ff6b6b' : '#4ade80'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">
          ${this.notificationsDisabled ? '🔔 Включи уведомл.' : '🔕 Отключи уведомл.'}
        </button>
        <div id="active-users-list" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280;"></div>
      </div>
    `;

    console.log('Инициализирам бутон за уведомления');

    // Добави listener един път
    const toggleBtn = sidebarEl.querySelector('#toggle-notifications');
    if (toggleBtn) {
      console.log('Бутон намерен, добавяме listener');
      toggleBtn.addEventListener('click', () => {
        this.notificationsDisabled = !this.notificationsDisabled;
        localStorage.setItem(`notificationsDisabled_${this.documentId}`, this.notificationsDisabled);
        // Обнови цвета без да презаписваш HTML
        this.updateNotificationButtonColor();
        // Обнови иконката (скрий/покажи числото на непрочетени)
        this.updateActiveCount();
        console.log('Уведомления:', this.notificationsDisabled ? 'Отключени' : 'Включени');
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
      toggleBtn.textContent = this.notificationsDisabled ? '🔔 Включи уведомл.' : '🔕 Отключи уведомл.';
      console.log('✓ Бутон обновен');
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

  async handleSendMessage() {
    const input = this.container.querySelector('.chat-input');
    const text = input.value;

    if (!text.trim()) return;

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
        this.renderMessages(messages);
      }, 500);
    }
  }

  renderMessages(messages) {
    const messagesContainer = this.container.querySelector('.chat-messages');
    if (!messagesContainer) return;

    const scrollWasAtBottom = this.autoScroll ||
      messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;

    // Направи map за лесен достъп до съобщенията по ID
    const messagesMap = {};
    messages.forEach(msg => {
      messagesMap[msg.id] = msg;
    });

    messagesContainer.innerHTML = messages.map(msg => {
      // Ако има reply, намери оригиналното съобщение
      let replyHTML = '';
      if (msg.replyTo && messagesMap[msg.replyTo]) {
        const originalMsg = messagesMap[msg.replyTo];
        replyHTML = `
          <div style="background: #e8f5e9; border-left: 3px solid #4ade80; padding: 8px; margin-bottom: 8px; font-size: 11px; border-radius: 3px;">
            <div style="color: #666; font-weight: bold; margin-bottom: 4px;">Отговор на ${this.escapeHtml(msg.replyAuthor)}</div>
            <div style="color: #999; padding: 6px; background: white; border-radius: 3px; max-height: 40px; overflow: hidden;">"${this.escapeHtml(originalMsg.text)}"</div>
          </div>
        `;
      }

      return `
        <div class="chat-message" data-user-id="${msg.userId}" data-message-id="${msg.id}" style="position: relative;">
          <div class="message-avatar" style="background-color: ${msg.userColor}">
            ${msg.userName.charAt(0)}
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-author">${this.escapeHtml(msg.userName)}</span>
              <span class="message-time">${this.formatTime(msg.timestamp)}</span>
            </div>
            ${replyHTML}
            <div class="message-text">${this.escapeHtml(msg.text)}</div>
            <div class="message-reactions" data-message-id="${msg.id}"></div>
          </div>
          <button class="message-reply-btn" data-message-id="${msg.id}" style="position: absolute; top: 8px; right: 8px; display: none; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; width: 28px; height: 28px;" title="Отговори">
            <img src="svg/reply-svgrepo-com.svg" alt="Reply" style="width: 100%; height: 100%; opacity: 0.7; filter: invert(0.3);">
          </button>
          <button class="message-reaction-btn" data-message-id="${msg.id}" style="position: absolute; top: 8px; right: 36px; display: none; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; width: 28px; height: 28px;" title="Добави реакция">
            <img src="svg/reaction-emoji-add-svgrepo-com.svg" alt="Reaction" style="width: 100%; height: 100%; opacity: 0.7;">
          </button>
        </div>
      `;
    }).join('');

    // Добави hover events
    const messageEls = messagesContainer.querySelectorAll('.chat-message');
    messageEls.forEach(msgEl => {
      msgEl.addEventListener('mouseenter', () => {
        const btn = msgEl.querySelector('.message-reaction-btn');
        const replyBtn = msgEl.querySelector('.message-reply-btn');
        if (btn) btn.style.display = 'block';
        if (replyBtn) replyBtn.style.display = 'block';
      });
      msgEl.addEventListener('mouseleave', () => {
        const btn = msgEl.querySelector('.message-reaction-btn');
        const replyBtn = msgEl.querySelector('.message-reply-btn');
        if (btn) btn.style.display = 'none';
        if (replyBtn) replyBtn.style.display = 'none';
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
    });

    // Зареди реакциите за всяко съобщение
    messages.forEach(msg => {
      this.loadAndDisplayReactions(msg.id);
    });

    // Изчисли непрочетени съобщения
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (!this.lastReadMessageId || this.lastReadMessageId !== lastMessage.id) {
        this.unreadCount = messages.length - (this.lastReadMessageId ? 
          messages.findIndex(m => m.id === this.lastReadMessageId) + 1 : 0);
      }
    }

    // Обнови badge
    this.updateActiveCount();

    if (scrollWasAtBottom) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 0);
    }
  }

  updateActiveCount(data) {
    const badgeEl = document.querySelector('.chat-badge-count');
    
    // Покази брой непрочетени съобщения САМО ако уведомленията са включени
    if (badgeEl) {
      if (this.notificationsDisabled) {
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

    const emojis = ['👍', '👎', '😂', '❤️', '😮'];
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 8px;
      display: flex;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
    `;

    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.textContent = emoji;
      btn.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
      `;
      btn.addEventListener('click', () => {
        this.addReaction(messageId, emoji);
        picker.remove();
      });
      picker.appendChild(btn);
    });

    // Позиционирай picker до съобщението
    const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (msgEl) {
      const rect = msgEl.getBoundingClientRect();
      picker.style.left = rect.left + 'px';
      picker.style.top = (rect.top - 50) + 'px';
      document.body.appendChild(picker);
    }
  }

  async addReaction(messageId, emoji) {
    const reactionRef = `${this.chatFirebase.baseURL}/reactions/${this.chatFirebase.documentId}/${messageId}/${emoji}/${currentUser.userId}.json`;
    
    try {
      await fetch(reactionRef, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(true)
      });

      console.log('✓ Реакция добавена:', emoji);
      this.loadAndDisplayReactions(messageId);
    } catch (error) {
      console.error('Reaction error:', error);
    }
  }

  async loadAndDisplayReactions(messageId) {
    try {
      const reactionsRef = `${this.chatFirebase.baseURL}/reactions/${this.chatFirebase.documentId}/${messageId}.json`;
      const response = await fetch(reactionsRef);
      
      if (!response.ok) {
        // Няма реакции
        const container = document.querySelector(`[data-message-id="${messageId}"] .message-reactions`);
        if (container) container.innerHTML = '';
        return;
      }

      const reactions = await response.json();
      const container = document.querySelector(`[data-message-id="${messageId}"] .message-reactions`);
      
      if (!container || !reactions) return;

      const reactionCounts = {};
      const myReactions = {};
      
      Object.keys(reactions).forEach(emoji => {
        const userIds = Object.keys(reactions[emoji]);
        const count = userIds.length;
        if (count > 0) {
          reactionCounts[emoji] = count;
          // Провери дали аз съм добавил този emoji
          if (userIds.includes(currentUser.userId)) {
            myReactions[emoji] = true;
          }
        }
      });

      container.innerHTML = Object.keys(reactionCounts).map(emoji => `
        <button class="reaction-badge" data-emoji="${emoji}" data-message-id="${messageId}" 
          style="background: ${myReactions[emoji] ? '#93c5fd' : '#f0f0f0'}; border: none; border-radius: 12px; padding: 4px 8px; margin-right: 4px; cursor: pointer; font-size: 12px; font-weight: ${myReactions[emoji] ? 'bold' : 'normal'};">
          ${emoji} <span>${reactionCounts[emoji]}</span>
        </button>
      `).join('');

      // Добави listeners за toggle реакции
      container.querySelectorAll('.reaction-badge').forEach(btn => {
        btn.addEventListener('click', () => {
          const emoji = btn.dataset.emoji;
          if (myReactions[emoji]) {
            // Премахни реакцията
            this.removeReaction(messageId, emoji);
          }
        });
      });
    } catch (error) {
      console.error('Load reactions error:', error);
    }
  }

  async removeReaction(messageId, emoji) {
    const reactionRef = `${this.chatFirebase.baseURL}/reactions/${this.chatFirebase.documentId}/${messageId}/${emoji}/${currentUser.userId}.json`;
    
    try {
      await fetch(reactionRef, {
        method: 'DELETE'
      });

      console.log('✓ Реакция премахната:', emoji);
      this.loadAndDisplayReactions(messageId);
    } catch (error) {
      console.error('Remove reaction error:', error);
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
        <div style="color: #999; margin-bottom: 6px; padding: 6px; background: white; border-radius: 3px; max-height: 50px; overflow: hidden;">"${this.escapeHtml(text)}"</div>
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
    const messagesRef = `${baseURL}/messages/global-chat.json`;
    const reactionsRef = `${baseURL}/reactions/global-chat.json`;

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

console.log('💡 Команди: resetChat() - ресет на име, deleteAllChatMessages("admin") - изтрий чата');

