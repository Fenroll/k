// ============================================
// REAL-TIME CHAT SYSTEM - с FALLBACK
// ============================================

class ChatSystem {
  constructor(documentId) {
    console.log('ChatSystem инициализирам за:', documentId);
    this.documentId = documentId || 'default';
    this.useLocalStorage = !database; // Fallback на localStorage ако няма Firebase
    
    if (database) {
      try {
        this.messagesRef = database.ref(`messages/${this.documentId}`);
        console.log('Използвам Firebase Database');
      } catch (error) {
        console.warn('Firebase ref error:', error);
        this.useLocalStorage = true;
      }
    } else {
      console.warn('Firebase не е налично - използвам localStorage');
    }
    
    this.messages = [];
    this.listeners = [];
  }

  // Изпрати съобщение
  async sendMessage(text) {
    if (!text.trim()) return;

    const message = {
      userId: currentUser.userId,
      userName: currentUser.userName,
      userColor: currentUser.color,
      text: text.trim(),
      timestamp: Date.now(),
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9)
    };

    try {
      if (this.useLocalStorage) {
        // Локално съхранение
        const key = `chat_${this.documentId}`;
        const messages = JSON.parse(localStorage.getItem(key) || '[]');
        messages.push(message);
        localStorage.setItem(key, JSON.stringify(messages.slice(-100))); // Последни 100
        console.log('Съобщение съхранено локално');
        
        // Уведоми слушатели
        this.listeners.forEach(callback => callback(message));
        return true;
      } else {
        // Firebase
        await this.messagesRef.push(message);
        return true;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  // Слушай за нови съобщения
  onMessagesChange(callback) {
    if (this.useLocalStorage) {
      // Локално съхранение - зареди от localStorage
      const key = `chat_${this.documentId}`;
      const messages = JSON.parse(localStorage.getItem(key) || '[]');
      this.messages = messages;
      callback(this.messages);
      console.log('Зареди', messages.length, 'съобщения от localStorage');
      
      // Периодично провери за нови съобщения
      this.pollInterval = setInterval(() => {
        const updated = JSON.parse(localStorage.getItem(key) || '[]');
        if (updated.length !== this.messages.length) {
          this.messages = updated;
          callback(this.messages);
        }
      }, 500);
    } else {
      // Firebase - оригинален код
      try {
        this.messagesRef
          .orderByChild('timestamp')
          .limitToLast(50)
          .on('value', (snapshot) => {
            const data = snapshot.val() || {};
            this.messages = Object.keys(data).map(key => ({
              ...data[key],
              key: key
            }));
            callback(this.messages);
          });

        this.messagesRef.on('child_added', (snapshot) => {
          const message = snapshot.val();
          if (message && !this.messages.find(m => m.id === message.id)) {
            this.messages.push({
              ...message,
              key: snapshot.key
            });
            this.notifyNewMessage(message);
          }
        });
      } catch (error) {
        console.error('Firebase error:', error);
        this.useLocalStorage = true;
        this.onMessagesChange(callback);
      }
    }
  }

  // Извести слушатели за ново съобщение
  notifyNewMessage(message) {
    this.listeners.forEach(callback => callback(message));
  }

  // Регистрирай listener за нови съобщения
  addMessageListener(callback) {
    this.listeners.push(callback);
  }

  // Спри слушането
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.messagesRef) {
      try {
        this.messagesRef.off();
      } catch (error) {
        console.warn('Error stopping Firebase ref:', error);
      }
    }
    this.listeners = [];
  }

  // Изтрий съобщение
  deleteMessage(messageKey) {
    if (this.messagesRef) {
      this.messagesRef.child(messageKey).remove();
    }
  }

  // Чисти стари съобщения (> 24 часа)
  cleanOldMessages() {
    if (this.useLocalStorage) {
      const key = `chat_${this.documentId}`;
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let messages = JSON.parse(localStorage.getItem(key) || '[]');
      messages = messages.filter(m => m.timestamp > oneDayAgo);
      localStorage.setItem(key, JSON.stringify(messages));
    } else if (this.messagesRef) {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.messagesRef
        .orderByChild('timestamp')
        .endAt(oneDayAgo)
        .once('value', (snapshot) => {
          const keys = Object.keys(snapshot.val() || {});
          keys.forEach(key => {
            this.messagesRef.child(key).remove();
          });
        });
    }
  }
}

// ============================================
// CHAT UI MANAGER
// ============================================

class ChatUIManager {
  constructor(containerId, documentId) {
    console.log('ChatUIManager конструктор с ID:', containerId);
    this.container = document.getElementById(containerId);
    console.log('Container намерен:', !!this.container);
    this.documentId = documentId || 'default';
    this.chatSystem = new ChatSystem(this.documentId);
    this.activeUsersManager = new ActiveUsersManager(this.documentId);
    this.isOpen = false;
    this.autoScroll = true;

    this.init();
  }

  init() {
    console.log('ChatUIManager.init() начало');
    // Маркирай потребител като активен
    this.activeUsersManager.markUserActive();

    // Слушай за промени в активните потребители
    this.activeUsersManager.onActiveCountChange((data) => {
      this.updateActiveCount(data);
      this.updateActiveSidebar(data.users);
    });

    // Слушай за нови съобщения
    this.chatSystem.onMessagesChange((messages) => {
      this.renderMessages(messages);
    });

    // Нов чат listener
    this.chatSystem.addMessageListener((message) => {
      if (this.isOpen) {
        // Чатът е отворен, няма нужда от уведомления
      } else {
        // Чатът е затворен, мигни иконката
        this.showNotification();
      }
    });

    this.attachEventListeners();
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

    // Scroll контрол
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

    const success = await this.chatSystem.sendMessage(text);
    if (success) {
      input.value = '';
      input.focus();
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
            <span class="message-author">${msg.userName}</span>
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
    if (badgeEl) {
      badgeEl.textContent = data.count;
      badgeEl.style.display = data.count > 1 ? 'flex' : 'none';
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
    this.chatSystem.stop();
    this.activeUsersManager.stop();
  }
}

// ============================================
// ЭКСПОРТ
// ============================================
window.ChatSystem = ChatSystem;
window.ChatUIManager = ChatUIManager;
