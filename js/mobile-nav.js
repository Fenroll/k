(function() {
    // Prevent double initialization
    if (document.getElementById('bottom-nav')) {
        if (document.body) document.body.classList.add('mobile-nav-ready');
        return;
    }

    const NAV_CACHE_KEY = 'coursebook-mobile-nav-html-v3';
    const CRITICAL_STYLE_ID = 'coursebook-mobile-nav-critical';

    function installCriticalMobileNavStyles() {
        if (document.getElementById(CRITICAL_STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = CRITICAL_STYLE_ID;
        style.textContent = `
@media (max-width: 900px) {
  #bottom-nav.bottom-nav {
    display: flex !important;
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: calc(60px + var(--locked-safe-area-bottom, env(safe-area-inset-bottom))) !important;
    background: #fff !important;
    border-top: 1px solid #e0e0e0 !important;
    z-index: 9999 !important;
    justify-content: space-around !important;
    align-items: center !important;
    box-sizing: border-box !important;
    padding-bottom: var(--locked-safe-area-bottom, env(safe-area-inset-bottom)) !important;
    overflow: hidden !important;
    transform: none !important;
    transition: none !important;
    contain: layout paint style !important;
    backface-visibility: hidden !important;
    -webkit-backface-visibility: hidden !important;
    -webkit-transform: none !important;
  }

  #bottom-nav .bottom-nav-item {
    display: flex !important;
    flex: 1 1 0 !important;
    height: 100% !important;
    min-width: 0 !important;
    align-items: center !important;
    justify-content: center !important;
    flex-direction: column !important;
    text-decoration: none !important;
    color: #888 !important;
    font: 11px 'Open Sans', Arial, sans-serif !important;
    -webkit-tap-highlight-color: transparent !important;
  }

  #bottom-nav .bottom-nav-item img,
  #bottom-nav .bottom-nav-item svg {
    width: 24px !important;
    height: 24px !important;
    max-width: 24px !important;
    max-height: 24px !important;
    margin: 0 0 4px 0 !important;
    flex: 0 0 24px !important;
  }

  #others-menu-overlay.others-menu-overlay {
    display: none;
    position: fixed !important;
    inset: 0 !important;
    z-index: 9998 !important;
  }

  #side-menu {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
}
@media (min-width: 901px) {
  #bottom-nav.bottom-nav,
  #others-menu-overlay.others-menu-overlay {
    display: none !important;
  }
}`;
        document.head.appendChild(style);
    }

    function getCachedNavHTML() {
        try {
            return localStorage.getItem(NAV_CACHE_KEY) || '';
        } catch (_) {
            return '';
        }
    }

    function cacheNavHTML(html) {
        try {
            localStorage.setItem(NAV_CACHE_KEY, html);
        } catch (_) {
            // Ignore storage errors in private/restricted contexts.
        }
    }

    installCriticalMobileNavStyles();

    try {
        localStorage.removeItem('coursebook-mobile-nav-html-v2');
    } catch (_) {
        // Ignore storage errors in private/restricted contexts.
    }

    function setLockedSafeAreaInset() {
        const root = document.documentElement;
        if (!root) return;

        const host = document.body || root;
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute; height:0; padding-bottom: env(safe-area-inset-bottom);';
        host.appendChild(probe);
        const value = getComputedStyle(probe).paddingBottom || '0px';
        probe.remove();
        root.style.setProperty('--locked-safe-area-bottom', value);
    }

    setLockedSafeAreaInset();
    window.addEventListener('orientationchange', () => {
        setTimeout(setLockedSafeAreaInset, 250);
    });

    // Detect current page to set active state
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    
    let activeTab = '';
    // Check for index.html or root
    if (page === 'index.html' || page === '') activeTab = 'courses';
    else if (page.includes('notes') || page.includes('anamnesis')) activeTab = 'notes';
    else if (page.includes('calendar')) activeTab = 'calendar';
    else if (page.includes('tools')) activeTab = 'tools';
    
    // HTML Structure
    const builtNavHTML = `
    <div class="bottom-nav" id="bottom-nav">
        <a href="index.html" class="bottom-nav-item ${activeTab === 'courses' ? 'active' : ''}" data-mobile-tab="courses">
            <img src="svg/icon-courses.svg" alt="Courses" width="24" height="24">
            <span>Courses</span>
        </a>
        <a href="notes.html" class="bottom-nav-item ${activeTab === 'notes' ? 'active' : ''}" data-mobile-tab="notes">
            <img src="svg/icon-notebook.svg" alt="Notes" width="24" height="24">
            <span>Notes</span>
        </a>
        <a href="calendar.html" class="bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}" data-mobile-tab="calendar">
            <img src="svg/icon-calendar.svg" alt="Calendar" width="24" height="24">
            <span>Calendar</span>
        </a>
        <div class="bottom-nav-item" id="others-toggle" data-mobile-tab="others">
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <span>Others</span>
        </div>
    </div>

    <div class="others-menu-overlay" id="others-menu-overlay">
        <div class="others-menu-content">
            <a href="account.html" class="others-menu-item">
                <img src="svg/icon-account.svg" alt="Account" width="20" height="20"> Account
            </a>
            <a href="tools.html" class="others-menu-item">
                <img src="svg/icon-tools.svg" alt="Tools" width="20" height="20">
                <span>Tools</span>
            </a>
            <a href="anamnesis.html" class="others-menu-item">
                <img src="svg/icon-anamnesis.svg" alt="Anamnesis" width="20" height="20"> Anamnesis
            </a>
            <a href="text-editor.html" class="others-menu-item">
                <img src="svg/icon-editor.svg" alt="Editor" width="20" height="20"> Editor
            </a>
            <a href="admin.html" class="others-menu-item" id="mobile-admin-link" style="display: none;">
                <img src="svg/icon-admin.svg" alt="Admin" width="20" height="20"> Admin
            </a>
            <a href="#" id="mobile-logout" class="others-menu-item">
                <img src="svg/icon-signout.svg" alt="Logout" width="20" height="20"> Logout
            </a>
        </div>
    </div>
    `;

    // Inject HTML
    const cachedNavHTML = getCachedNavHTML();
    const navHTML = cachedNavHTML || builtNavHTML;
    const div = document.createElement('div');
    div.innerHTML = navHTML;
    document.body.appendChild(div);
    document.body.classList.add('mobile-nav-ready');

    if (navHTML !== builtNavHTML) {
        const currentActive = div.querySelector('.bottom-nav-item.active');
        if (currentActive) currentActive.classList.remove('active');

        const nextActive = activeTab ? div.querySelector(`.bottom-nav-item[data-mobile-tab="${activeTab}"]`) : null;
        if (nextActive) nextActive.classList.add('active');
    }

    // Skip the localStorage write when the cached value already matches
    // what we just rendered — avoids touching storage on every page load.
    if (cachedNavHTML !== builtNavHTML) {
        cacheNavHTML(builtNavHTML);
    }

    // Event Listeners
    const toggleBtn = document.getElementById('others-toggle');
    const overlay = document.getElementById('others-menu-overlay');
    const content = overlay.querySelector('.others-menu-content');
    const logoutBtn = document.getElementById('mobile-logout');

    // Delegated press feedback: 4 listeners on each container instead of 5 per item.
    function installPressFeedback(container) {
        if (!container) return;
        const startPress = (e) => {
            const item = e.target.closest('.bottom-nav-item, .others-menu-item');
            if (item && container.contains(item)) item.classList.add('is-pressing');
        };
        const endPress = (e) => {
            const item = e.target.closest('.bottom-nav-item, .others-menu-item');
            if (item && container.contains(item)) item.classList.remove('is-pressing');
        };
        container.addEventListener('pointerdown', startPress, { passive: true });
        container.addEventListener('pointerup', endPress, { passive: true });
        container.addEventListener('pointercancel', endPress, { passive: true });
        container.addEventListener('pointerleave', endPress, { passive: true });
    }

    installPressFeedback(document.getElementById('bottom-nav'));
    installPressFeedback(document.getElementById('others-menu-overlay'));

    function toggleMenu() {
        if (overlay.classList.contains('open')) {
            overlay.classList.remove('open');
            setTimeout(() => { 
                if(!overlay.classList.contains('open')) overlay.style.display = 'none'; 
            }, 200);
        } else {
            overlay.style.display = 'block';
            // Force reflow
            overlay.offsetHeight;
            overlay.classList.add('open');
        }
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            toggleMenu();
        });
    }

    if (content) {
        content.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Logout logic
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof handleLogout === 'function') {
                handleLogout();
            } else {
                localStorage.removeItem('loggedInUser');
                window.location.href = 'login.html';
            }
        });
    }

    // Admin visibility
    if (window.currentUserPromise) {
        window.currentUserPromise.then(user => {
            const adminLink = document.getElementById('mobile-admin-link');
            if (user && user.isAdmin && adminLink) {
                adminLink.style.display = 'flex';
            }
        });
    }

})();
