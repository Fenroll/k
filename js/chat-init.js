// ============================================
// CHAT INITIALIZATION SCRIPT
// Използва Firebase REST API (без SDK)
// ============================================

(function initializeChat() {
  console.log('Chat init начало...');
  
  // Чакай за зареждане на Chat системата
  let attempts = 0;
  const maxAttempts = 30;

  function tryInit() {
    attempts++;
    
    // Проверка за Chat системата
    if (typeof ChatUIManagerREST === 'undefined' || typeof currentUser === 'undefined') {
      if (attempts === 1) {
        console.log('Чакане на Chat система...');
      }
      if (attempts < maxAttempts) {
        setTimeout(tryInit, 100);
      } else {
        console.error('Chat система не е зареена');
      }
      return;
    }

    // Чакай DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initChat);
    } else {
      initChat();
    }
  }

  function initChat() {
    console.log('Инициализирам chat със Firebase REST...');
    
    const chatWidget = document.getElementById('chat-widget');
    if (!chatWidget) {
      console.error('Chat widget не е намерен!');
      return;
    }

    const documentId = getDocumentId();
    console.log('Document ID:', documentId);

    let chatManager;
    try {
      chatManager = new ChatUIManagerREST('chat-widget', documentId);
      window.chatManager = chatManager;
      console.log('✓✓✓ ChatUIManagerREST инициализиран успешно');
    } catch (error) {
      console.error('Грешка при инициализиране:', error);
      return;
    }

    const chatIcon = document.getElementById('chat-toggle');
    const chatCloseBtn = document.getElementById('chat-close');
    const currentUserNameEl = document.getElementById('current-user-name');

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
    }

    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.chatManager) {
          window.chatManager.toggleChat();
        }
      });
      console.log('✓ Chat close button listener добавен');
    }

    if (currentUserNameEl && currentUser) {
      currentUserNameEl.textContent = currentUser.userName;
      console.log('✓ User name set:', currentUser.userName);
    }

    console.log('✓✓✓ Chat система готова!');
    console.log('Потребител:', currentUser.userName, currentUser.userId);
  }

  function getDocumentId() {
    const urlParams = new URLSearchParams(window.location.search);
    const docIdFromUrl = urlParams.get('docId') || urlParams.get('doc');
    if (docIdFromUrl) return docIdFromUrl;

    const titleEl = document.querySelector('h1, .page-title, [data-doc-id]');
    if (titleEl) {
      const docId = titleEl.getAttribute('data-doc-id');
      if (docId) return docId;
    }

    const pathname = window.location.pathname;
    const match = pathname.match(/\/([a-z0-9-]+)\.html/i);
    if (match) return match[1];

    return document.title.replace(/\s+/g, '-').toLowerCase() || 'default';
  }

  tryInit();
})();
