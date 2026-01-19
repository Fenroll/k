// ============================================
// CHAT SYSTEM - Firebase REST API (без SDK)
// Работи със всички студенти в реално време!
// ============================================

class ChatFirebaseREST {
  constructor(documentId) {
    this.documentId = documentId || 'default';
    this.baseURL = 'https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app';
    this.messagesEndpoint = `${this.baseURL}/messages/${this.documentId}.json`;
    this.activeUsersEndpoint = `${this.baseURL}/active_users/${this.documentId}.json`;
    this.messages = [];
    this.listeners = [];
    this.lastTimestamp = 0;
    this.isPolling = false;
    console.log('ChatFirebaseREST инициализиран за:', documentId);
  }

  // Изпрати съобщение
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
        console.log('✓ Съобщение изпратено към Firebase');
        return true;
      } else {
        console.error('Firebase POST error:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Грешка при изпращане на съобщение:', error);
      return false;
    }
  }

  // Зареди съобщения от Firebase
  async loadMessages() {
    try {
      const response = await fetch(this.messagesEndpoint);
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      if (!data) return [];

      const messages = Object.keys(data).map(key => ({
        ...data[key],
        key: key
      }));

      // Сортирай по timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);
      
      this.messages = messages;
      console.log('Зареди', messages.length, 'съобщения от Firebase');
      return messages;
    } catch (error) {
      console.error('Error loading messages:', error);
      return [];
    }
  }

  // Слушай за нови съобщения (polling)
  startPolling(callback, interval = 2000) {
    if (this.isPolling) return;
    this.isPolling = true;

    const poll = async () => {
      const messages = await this.loadMessages();
      
      // Ако има нови съобщения
      if (messages.length > this.messages.length) {
        callback(messages);
        
        // Уведоми за ново съобщение
        const newMessage = messages[messages.length - 1];
        this.listeners.forEach(listener => listener(newMessage));
      }
      
      this.messages = messages;
      setTimeout(poll, interval);
    };

    poll();
  }

  // Регистрирай listener
  addMessageListener(callback) {
    this.listeners.push(callback);
  }

  // Обнови активния потребител
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

      console.log('✓ Потребител маркиран като активен');

      // Периодично обнови
      setInterval(async () => {
        await fetch(userRef, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastSeen: Date.now() })
        });
      }, 30000);

      // Махни потребителя щом затвори таба
      window.addEventListener('beforeunload', async () => {
        await fetch(userRef, { method: 'DELETE' });
      });

      return true;
    } catch (error) {
      console.error('Error marking user active:', error);
      return false;
    }
  }

  // Получи активни потребители
  async getActiveUsers() {
    try {
      const response = await fetch(this.activeUsersEndpoint);
      if (!response.ok) return {};
      
      const data = await response.json();
      const now = Date.now();
      
      // Филтрирай активни (последни 2 минути)
      const activeUsers = {};
      Object.keys(data || {}).forEach(userId => {
        const user = data[userId];
        if (now - user.lastSeen < 120000) {
          activeUsers[userId] = user;
        }
      });

      return activeUsers;
    } catch (error) {
      console.error('Error getting active users:', error);
      return {};
    }
  }

  // Слушай за активни потребители (polling)
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
// CHAT UI MANAGER - със Firebase REST
// ============================================

class ChatUIManagerREST {
  constructor(containerId, documentId) {
    console.log('ChatUIManagerREST инициализирам');
    this.container = document.getElementById(containerId);
    this.documentId = documentId || 'default';
    this.chatFirebase = new ChatFirebaseREST(this.documentId);
    this.isOpen = false;
    this.autoScroll = true;

    this.init();
  }

  async init() {
    console.log('ChatUIManagerREST.init()');
    
    // Маркирай потребител като активен
    await this.chatFirebase.markUserActive();

    // Зареди първоначални съобщения
    const messages = await this.chatFirebase.loadMessages();
    this.renderMessages(messages);

    // Начни polling за нови съобщения
    this.chatFirebase.startPolling((messages) => {
      this.renderMessages(messages);
    }, 2000);

    // Начни polling за активни потребители
    this.chatFirebase.startActiveUsersPolling((data) => {
      this.updateActiveCount(data);
      this.updateActiveSidebar(data.users);
    }, 5000);

    // Регистрирай listener за уведомления
    this.chatFirebase.addMessageListener((message) => {
      if (!this.isOpen) {
        this.showNotification();
      }
    });

    this.attachEventListeners();
    console.log('✓ ChatUIManagerREST готов');
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
      
      // Презареди съобщения
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
      console.error('Chat container не е намерен!');
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
// EXPORT
// ============================================
window.ChatFirebaseREST = ChatFirebaseREST;
window.ChatUIManagerREST = ChatUIManagerREST;
