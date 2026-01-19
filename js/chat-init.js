// ============================================
// CHAT INITIALIZATION SCRIPT
// Поставиш това в края на body на всяка страница
// ============================================

(function initializeChat() {
  console.log('Chat init начало...');
  
  // Чакай за зареждане на Chat системата (Firebase е опционален)
  let attempts = 0;
  const maxAttempts = 30; // 3 секунди при 100ms интервал

  function tryInit() {
    attempts++;
    
    // Проверка за Chat системата
    if (typeof ChatUIManager === 'undefined' || typeof currentUser === 'undefined') {
      if (attempts === 1) {
        console.log('Чакане на Chat система...');
      }
      if (attempts < maxAttempts) {
        setTimeout(tryInit, 100);
      } else {
        console.error('Chat система не е зареена след 3 секунди');
      }
      return;
    }

    // Чакай DOM да е готов
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initChat);
    } else {
      initChat();
    }
  }

  function initChat() {
    console.log('Инициализирам chat...');
    
    // Проверка че DOM елементите съществуват
    const chatWidget = document.getElementById('chat-widget');
    if (!chatWidget) {
      console.error('Chat widget не е намерен в DOM!');
      return;
    }

    // Извлекай ID на документа от URL или заглавието
    const documentId = getDocumentId();
    console.log('Document ID:', documentId);

    // Инициализирай ChatUIManager
    let chatManager;
    try {
      chatManager = new ChatUIManager('chat-widget', documentId);
      window.chatManager = chatManager; // Запази в window
      console.log('✓ ChatUIManager инициализиран успешно');
    } catch (error) {
      console.error('Грешка при инициализиране на ChatUIManager:', error);
      return;
    }

    // Setup иконка клик
    const chatIcon = document.getElementById('chat-toggle');
    const chatCloseBtn = document.getElementById('chat-close');
    const currentUserNameEl = document.getElementById('current-user-name');

    console.log('Chat elements:', {
      icon: !!chatIcon,
      closeBtn: !!chatCloseBtn,
      userNameEl: !!currentUserNameEl
    });

    if (chatIcon) {
      chatIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('💬 Chat icon clicked');
        if (window.chatManager) {
          window.chatManager.toggleChat();
        }
      });
      console.log('✓ Chat icon listener добавен');
    } else {
      console.error('✗ Chat toggle button не е намерен!');
    }

    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Close button clicked');
        if (window.chatManager) {
          window.chatManager.toggleChat();
        }
      });
      console.log('✓ Chat close button listener добавен');
    }

    // Показывай текущото име на потребителя
    if (currentUserNameEl && currentUser) {
      currentUserNameEl.textContent = currentUser.userName;
      console.log('✓ User name set:', currentUser.userName);
    }

    console.log('✓✓✓ Chat система успешно инициализирана за документ:', documentId);
    console.log('✓ Текущ потребител:', currentUser.userName, `(${currentUser.userId})`);
  }

  function getDocumentId() {
    // Опция 1: От URL параметър
    const urlParams = new URLSearchParams(window.location.search);
    const docIdFromUrl = urlParams.get('docId') || urlParams.get('doc');
    if (docIdFromUrl) return docIdFromUrl;

    // Опция 2: От заглавието на документа
    const titleEl = document.querySelector('h1, .page-title, [data-doc-id]');
    if (titleEl) {
      const docId = titleEl.getAttribute('data-doc-id');
      if (docId) return docId;
    }

    // Опция 3: От URL пътя
    const pathname = window.location.pathname;
    const match = pathname.match(/\/([a-z0-9-]+)\.html/i);
    if (match) return match[1];

    // Fallback
    return document.title.replace(/\s+/g, '-').toLowerCase() || 'default';
  }

  // Начай инициализацията
  tryInit();
})();
