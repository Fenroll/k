(function() {
  const STORAGE_KEY = 'coursebook-desktop-sidebar-mode';
  const EDGE_MODE = 'edge-hover';
  const CLASS_NAME = 'sidebar-edge-hover';

  function normalizeMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    if (mode === 'edge' || mode === 'edge-hover' || mode === 'hover') return EDGE_MODE;
    if (mode === 'classic' || mode === 'default' || mode === 'normal') return 'classic';
    return '';
  }

  function readMode() {
    try {
      return normalizeMode(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      return '';
    }
  }

  function writeMode(mode) {
    try {
      if (mode === EDGE_MODE) {
        localStorage.setItem(STORAGE_KEY, EDGE_MODE);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {
      // Preference storage can be unavailable in private/locked contexts.
    }
  }

  function applyMode(mode) {
    const enabled = mode === EDGE_MODE;
    document.documentElement.classList.toggle(CLASS_NAME, enabled);
    if (document.body) {
      document.body.classList.toggle(CLASS_NAME, enabled);
    }
  }

  function applyFromUrl() {
    let params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (_) {
      return readMode();
    }

    const requested = normalizeMode(params.get('sidebar'));
    if (!requested) return readMode();

    writeMode(requested);
    return requested === EDGE_MODE ? EDGE_MODE : '';
  }

  const initialMode = applyFromUrl();
  applyMode(initialMode);

  document.addEventListener('DOMContentLoaded', function() {
    applyMode(readMode());
  });

  window.addEventListener('storage', function(event) {
    if (event.key === STORAGE_KEY) {
      applyMode(readMode());
    }
  });

  window.CoursebookDesktopNav = {
    storageKey: STORAGE_KEY,
    getMode: readMode,
    setMode: function(mode) {
      const normalized = normalizeMode(mode);
      writeMode(normalized);
      applyMode(normalized === EDGE_MODE ? EDGE_MODE : '');
    }
  };
})();
