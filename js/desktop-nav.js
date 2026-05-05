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
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) {
        return EDGE_MODE;
      }
      return normalizeMode(stored);
    } catch (_) {
      return EDGE_MODE;
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

  function getVersionText() {
    if (typeof window.buildTimestamp !== 'undefined') {
      return window.buildTimestamp;
    }

    if (window.CoursebookVersionTimestamp) {
      return window.CoursebookVersionTimestamp;
    }

    try {
      const storedTimestamp = localStorage.getItem('coursebook-build-timestamp');
      if (storedTimestamp) return storedTimestamp;
    } catch (_) {
      // Local storage can be disabled in privacy-restricted contexts.
    }

    return 'Unknown';
  }

  async function loadVersionTimestamp() {
    if (window.CoursebookVersionTimestamp) {
      return window.CoursebookVersionTimestamp;
    }

    if (window.location && window.location.protocol === 'file:') {
      return getVersionText();
    }

    try {
      const response = await fetch('courses.version.json?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('Version timestamp unavailable');
      const data = await response.json();
      const timestamp = data && data.timestamp;
      if (timestamp) {
        window.CoursebookVersionTimestamp = timestamp;
        try {
          localStorage.setItem('coursebook-build-timestamp', timestamp);
        } catch (_) {}
        return timestamp;
      }
    } catch (_) {
      // Keep the synchronous fallback text if the version file cannot be reached.
    }

    return getVersionText();
  }

  function getPrivacyModalMarkup() {
    return `
      <div class="coursebook-privacy-modal-content" role="dialog" aria-modal="true" aria-labelledby="privacyModalTitle">
        <button type="button" class="coursebook-privacy-close" aria-label="Close privacy modal">&times;</button>
        <div class="coursebook-privacy-kicker">Privacy overview</div>
        <h2 id="privacyModalTitle">Your data stays close to the app.</h2>
        <p class="coursebook-privacy-lede">Coursebook stores only the information needed to keep your study workspace working, synced, and personalized.</p>

        <div class="coursebook-privacy-grid">
          <section class="coursebook-privacy-card">
            <span class="coursebook-privacy-icon">ID</span>
            <h3>Account session</h3>
            <p>Your user ID, session token, display name, color, avatar, and basic account settings keep you signed in and identifiable in shared features.</p>
          </section>
          <section class="coursebook-privacy-card">
            <span class="coursebook-privacy-icon">PC</span>
            <h3>Device marker</h3>
            <p>A random device ID helps manage active sessions. It is not used for advertising or cross-site tracking.</p>
          </section>
          <section class="coursebook-privacy-card">
            <span class="coursebook-privacy-icon">UI</span>
            <h3>Preferences</h3>
            <p>Interface choices such as editor font, layout preferences, and other app settings are saved so the workspace feels consistent when you return.</p>
          </section>
          <section class="coursebook-privacy-card">
            <span class="coursebook-privacy-icon">DB</span>
            <h3>Study content</h3>
            <p>Notes, calendar items, saved documents, chats, and related course data may be stored locally or in the app database so your workspace can load again.</p>
          </section>
        </div>

        <div class="coursebook-privacy-note">
          <strong>No ad tracking.</strong>
          <span>Coursebook does not use cookies for advertising, behavioral profiling, or analytics resale. Data is used to provide the app features you open.</span>
        </div>
      </div>
    `;
  }

  function ensurePrivacyModal() {
    let modal = document.getElementById('privacyModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'privacyModal';
      document.body.appendChild(modal);
    }

    modal.className = 'coursebook-privacy-modal';
    modal.style.display = 'none';
    modal.innerHTML = getPrivacyModalMarkup();

    modal.onclick = function(event) {
      if (event.target === modal) {
        closePrivacyModalShared();
      }
    };

    const closeButton = modal.querySelector('.coursebook-privacy-close');
    if (closeButton) {
      closeButton.onclick = closePrivacyModalShared;
    }
  }

  function ensureSidebarUtilities() {
    const sideMenu = document.getElementById('side-menu');
    if (!sideMenu) return;

    const logoLink = sideMenu.querySelector('.logo-header > a');
    if (logoLink) {
      logoLink.href = 'index.html';
      logoLink.removeAttribute('target');
      logoLink.removeAttribute('rel');
      logoLink.setAttribute('aria-label', 'Coursebook home');
    }

    let footer = sideMenu.querySelector('.sidebar-footer-links');
    const innerWrap = sideMenu.querySelector('.bb-inner-wrap') || sideMenu;
    if (!footer) {
      footer = document.createElement('div');
      footer.className = 'sidebar-footer-links';
      innerWrap.appendChild(footer);
    }

    footer.innerHTML = `
      <button type="button" class="sidebar-footer-item" data-coursebook-privacy>Privacy</button>
      <button type="button" class="sidebar-footer-item" data-coursebook-version>Version</button>
      <span id="versionInfo" class="sidebar-version-popover" hidden></span>
    `;

    const privacyButton = footer.querySelector('[data-coursebook-privacy]');
    const versionButton = footer.querySelector('[data-coursebook-version]');

    if (privacyButton) {
      privacyButton.addEventListener('click', window.showPrivacyModal);
    }

    if (versionButton) {
      versionButton.addEventListener('click', window.toggleVersionInfo);
    }

    ensurePrivacyModal();
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

  function showPrivacyModalShared() {
    ensurePrivacyModal();
    const modal = document.getElementById('privacyModal');
    if (modal) {
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  }

  function closePrivacyModalShared() {
    const modal = document.getElementById('privacyModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function toggleVersionInfoShared() {
    const versionInfo = document.getElementById('versionInfo');
    if (!versionInfo) return;

    if (versionInfo.hidden || versionInfo.style.display === 'none') {
      versionInfo.textContent = getVersionText();
      versionInfo.hidden = false;
      versionInfo.style.display = 'inline-block';
      loadVersionTimestamp().then(function(timestamp) {
        if (!versionInfo.hidden && timestamp) {
          versionInfo.textContent = timestamp;
        }
      });
      window.clearTimeout(window.CoursebookDesktopNavVersionTimer);
      window.CoursebookDesktopNavVersionTimer = window.setTimeout(function() {
        versionInfo.hidden = true;
        versionInfo.style.display = 'none';
      }, 5000);
    } else {
      versionInfo.hidden = true;
      versionInfo.style.display = 'none';
    }
  }

  function installGlobalUtilities() {
    window.showPrivacyModal = showPrivacyModalShared;
    window.closePrivacyModal = closePrivacyModalShared;
    window.toggleVersionInfo = toggleVersionInfoShared;
  }

  installGlobalUtilities();

  // Pages that don't load courses.generated.js (tools.html, calendar.html, etc.)
  // never have window.buildTimestamp set, so the version popover would show
  // "Unknown" until the async fetch completes — and the popover auto-hides at
  // 5s, sometimes before the fetch resolves. Kick off the fetch eagerly so the
  // timestamp is cached on window/localStorage by the time the user clicks.
  loadVersionTimestamp().catch(function() { /* swallow — getVersionText will fall back */ });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closePrivacyModalShared();
    }
  });

  document.addEventListener('DOMContentLoaded', function() {
    installGlobalUtilities();
    applyMode(readMode());
    ensureSidebarUtilities();
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
    },
    refreshUtilities: ensureSidebarUtilities
  };
})();
