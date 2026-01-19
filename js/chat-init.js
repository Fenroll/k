// ============================================
// CHAT INITIALIZATION SCRIPT
// Поставиш това в края на body на всяка страница
// ============================================

(function initializeChat() {
  // Проверка за Firebase библиотеката
  if (typeof firebase === 'undefined') {
    console.error('Firebase не е зареден. Добавете: <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js"></script>');
    return;
  }

  if (typeof firebase.database === 'undefined') {
    console.error('Firebase Database না е зареден. Добавете: <script src="https://www.gstatic.com/firebasejs/10.5.0/firebase-database.js"></script>');
    return;
  }

  // Чакай DOM да е готов
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
  } else {
    initChat();
  }

  function initChat() {
    // Извлекай ID на документа от URL или заглавието
    const documentId = getDocumentId();

    // Инициализирай ChatUIManager
    const chatManager = new ChatUIManager('chat-widget', documentId);

    // Setup иконка клик
    const chatIcon = document.getElementById('chat-toggle');
    const chatCloseBtn = document.getElementById('chat-close');
    const currentUserNameEl = document.getElementById('current-user-name');

    if (chatIcon) {
      chatIcon.addEventListener('click', () => {
        chatManager.toggleChat();
      });
    }

    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', () => {
        chatManager.toggleChat();
      });
    }

    // Показывай текущото име на потребителя
    if (currentUserNameEl) {
      currentUserNameEl.textContent = currentUser.userName;
    }

    // Спри чата при закрыване на страницата
    window.addEventListener('beforeunload', () => {
      chatManager.destroy();
    });

    console.log('Chat система успешно инициализирана за документ:', documentId);
    console.log('Текущ потребител:', currentUser.userName, `(${currentUser.userId})`);
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
})();
