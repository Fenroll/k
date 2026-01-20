// ============================================
// NOTES INITIALIZATION SCRIPT
// Използва Firebase REST API (без SDK)
// ============================================

(function initializeNotes() {
  // Чакай за зареждане на Notes системата
  let attempts = 0;
  const maxAttempts = 30;

  function tryInit() {
    attempts++;
    
    // Проверка за Notes системата
    if (typeof NotesUIManagerREST === 'undefined' || typeof currentUser === 'undefined') {
      if (attempts < maxAttempts) {
        setTimeout(tryInit, 100);
      } else {
        console.error('Notes система не е заредена');
      }
      return;
    }

    // Чакай DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNotes);
    } else {
      initNotes();
    }
  }

  function initNotes() {
    const notesWidget = document.getElementById('notes-widget');
    if (!notesWidget) {
      console.error('Notes widget не е намерен!');
      return;
    }

    const documentId = getDocumentId();

    let notesManager;
    try {
      notesManager = new NotesUIManagerREST('notes-widget', documentId);
      window.notesManager = notesManager;
    } catch (error) {
      console.error('Грешка при инициализиране:', error);
      return;
    }

    const notesIcon = document.getElementById('notes-toggle');
    const notesCloseBtn = document.getElementById('notes-close');

    if (notesIcon) {
      notesIcon.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.notesManager) {
          window.notesManager.toggleNotes();
        }
      });
    }

    if (notesCloseBtn) {
      notesCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.notesManager) {
          window.notesManager.toggleNotes();
        }
      });
    }
  }

  function getDocumentId() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // First check for 'path' parameter (from md-viewer)
    const pathParam = urlParams.get('path');
    if (pathParam) {
      // Use just the filename without extension as document ID
      const filename = pathParam.split('/').pop().replace(/\.[^.]+$/, '');
      return 'notes_' + filename.toLowerCase();
    }
    
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

    // Use the page title as document ID
    const title = document.title || document.querySelector('h1')?.textContent || 'default';
    return 'notes_' + title.replace(/\s+/g, '-').toLowerCase().substring(0, 50);
  }

  tryInit();
})();
