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
    let userName = localStorage.getItem('userName');
    if (!userName) {
      const adjectives = ['Умен', 'Бързо', 'Силен', 'Весел', 'Смелен', 'Светъл'];
      const nouns = ['Студент', 'Лекар', 'Учен', 'Гений', 'Орел', 'Мудрец'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      userName = `${adj} ${noun}`;
      localStorage.setItem('userName', userName);
    }
    return userName;
  }

  generateUserColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
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

  async sendMessage(text) {
    if (!text.trim()) return false;

    const message = {
      userId: currentUser.userId,
      userName: currentUser.userName,
      userColor: currentUser.color,
      text: text.trim(),
      timestamp: Date.now(),
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

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

    const poll = async () => {
      const messages = await this.loadMessages();
      
      if (messages.length > this.messages.length) {
        callback(messages);
        const newMessage = messages[messages.length - 1];
        this.listeners.forEach(listener => listener(newMessage));
      }
      
      this.messages = messages;
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
      Object.keys(data || {}).forEach(userId => {
        const user = data[userId];
        if (now - user.lastSeen < 120000) {
          activeUsers[userId] = user;
        }
      });

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
      }, 1000);  // Всеки 1 секунда вместо 2

      // Polling за активни потребители
      this.chatFirebase.startActiveUsersPolling((data) => {
        this.updateActiveCount(data);
        this.updateActiveSidebar(data.users);
      }, 2000);  // Всеки 2 секунди вместо 5

      // Listener за уведомления
      this.chatFirebase.addMessageListener((message) => {
        if (!this.isOpen) {
          this.showNotification();
        }
      });

      this.attachEventListeners();
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

  async handleSendMessage() {
    const input = this.container.querySelector('.chat-input');
    const text = input.value;

    if (!text.trim()) return;

    const success = await this.chatFirebase.sendMessage(text);
    if (success) {
      input.value = '';
      input.focus();
      
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

    messagesContainer.innerHTML = messages.map(msg => `
      <div class="chat-message" data-user-id="${msg.userId}">
        <div class="message-avatar" style="background-color: ${msg.userColor}">
          ${msg.userName.charAt(0)}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-author">${this.escapeHtml(msg.userName)}</span>
            <span class="message-time">${this.formatTime(msg.timestamp)}</span>
          </div>
          <div class="message-text">${this.escapeHtml(msg.text)}</div>
        </div>
      </div>
    `).join('');

    if (scrollWasAtBottom) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 0);
    }
  }

  updateActiveCount(data) {
    const badgeEl = document.querySelector('.chat-badge-count');
    const countEl = document.querySelector('.chat-online-count');
    
    if (badgeEl) {
      badgeEl.textContent = data.count;
      badgeEl.style.display = data.count > 1 ? 'flex' : 'none';
    }

    if (countEl) {
      countEl.textContent = `${data.count} онлайн`;
    }
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
    const icon = document.querySelector('.chat-icon');
    if (icon) {
      icon.classList.add('has-notification');
      setTimeout(() => {
        icon.classList.remove('has-notification');
      }, 3000);
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

    const pathname = window.location.pathname;
    const match = pathname.match(/\/([a-z0-9-]+)\.html/i);
    const documentId = match ? match[1] : 'default';

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
