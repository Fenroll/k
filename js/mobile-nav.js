(function() {
    // Prevent double initialization
    if (document.getElementById('bottom-nav')) return;

    const THEME_KEY = 'index-copy-theme';

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
    const navHTML = `
    <div class="bottom-nav" id="bottom-nav">
        <a href="index.html" class="bottom-nav-item ${activeTab === 'courses' ? 'active' : ''}">
            <img src="svg/icon-courses.svg" alt="Courses">
            <span>Courses</span>
        </a>
        <a href="notes.html" class="bottom-nav-item ${activeTab === 'notes' ? 'active' : ''}">
            <img src="svg/icon-notebook.svg" alt="Notes">
            <span>Notes</span>
        </a>
        <a href="calendar.html" class="bottom-nav-item ${activeTab === 'calendar' ? 'active' : ''}">
            <img src="svg/icon-calendar.svg" alt="Calendar">
            <span>Calendar</span>
        </a>
        <div class="bottom-nav-item" id="others-toggle">
            <svg viewBox="0 0 24 24" width="24" height="24">
                <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
            <span>Others</span>
        </div>
    </div>

    <div class="others-menu-overlay" id="others-menu-overlay">
        <div class="others-menu-content">
            <a href="https://elearn.mu-varna.bg/ultra/course" class="others-menu-item">
                <img src="svg/icon-blackboard.svg" alt="Blackboard"> Blackboard
            </a>
            <a href="account.html" class="others-menu-item">
                <img src="svg/icon-account.svg" alt="Account"> Account
            </a>
            <a href="tools.html"  class="others-menu-item">
                <img src="svg/icon-tools.svg" alt="Tools">
            <span>Tools</span>
              </a>
            <a href="anamnesis.html" class="others-menu-item">
                <img src="svg/icon-anamnesis.svg" alt="Anamnesis"> Anamnesis
            </a>
            <a href="text-editor.html" class="others-menu-item">
                <img src="svg/icon-editor.svg" alt="Editor"> Editor
            </a>
            <a href="admin.html" class="others-menu-item" id="mobile-admin-link" style="display: none;">
                <img src="svg/icon-admin.svg" alt="Admin"> Admin 
            </a>
            <a href="#" id="mobile-logout" class="others-menu-item">
                <img src="svg/icon-signout.svg" alt="Logout"> Logout
            </a>
        </div>
    </div>
    `;

    // Inject HTML
    const div = document.createElement('div');
    div.innerHTML = navHTML;
    document.body.appendChild(div);

    function getStoredThemePreference() {
        try {
            return localStorage.getItem(THEME_KEY);
        } catch (err) {
            return null;
        }
    }

    function isDarkThemeEnabled() {
        const body = document.body;
        const html = document.documentElement;
        const bodyDark = body && body.classList.contains('dark-mode');
        const htmlDark = html && (html.classList.contains('dark-mode') || html.getAttribute('data-theme') === 'dark');
        const storedTheme = getStoredThemePreference();
        const storedDark = storedTheme === 'dark';

        let prefersDark = false;
        if (window.matchMedia) {
            prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        if (storedTheme === 'light') {
            return Boolean(bodyDark || htmlDark);
        }

        return Boolean(bodyDark || htmlDark || storedDark || prefersDark);
    }

    function syncMobileNavTheme() {
        const useDark = isDarkThemeEnabled();
        const bottomNav = document.getElementById('bottom-nav');
        const menuOverlay = document.getElementById('others-menu-overlay');

        if (bottomNav) {
            bottomNav.classList.toggle('dark-mode', useDark);
        }

        if (menuOverlay) {
            menuOverlay.classList.toggle('dark-mode', useDark);
            const menuContent = menuOverlay.querySelector('.others-menu-content');
            if (menuContent) {
                menuContent.classList.toggle('dark-mode', useDark);
            }

            const menuItems = menuOverlay.querySelectorAll('.others-menu-item');
            menuItems.forEach(item => item.classList.toggle('dark-mode', useDark));
        }
    }

    syncMobileNavTheme();
    window.requestAnimationFrame(syncMobileNavTheme);
    window.setTimeout(syncMobileNavTheme, 80);
    window.setTimeout(syncMobileNavTheme, 300);

    const body = document.body;
    const html = document.documentElement;
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(syncMobileNavTheme);
        if (body) {
            observer.observe(body, { attributes: true, attributeFilter: ['class'] });
        }
        if (html) {
            observer.observe(html, { attributes: true, attributeFilter: ['class', 'data-theme'] });
        }
    }

    window.addEventListener('pageshow', syncMobileNavTheme);
    window.addEventListener('focus', syncMobileNavTheme);
    document.addEventListener('visibilitychange', syncMobileNavTheme);
    window.addEventListener('storage', syncMobileNavTheme);
    window.addEventListener('themechange', syncMobileNavTheme);

    if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', syncMobileNavTheme);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(syncMobileNavTheme);
        }
    }

    // Event Listeners
    const toggleBtn = document.getElementById('others-toggle');
    const overlay = document.getElementById('others-menu-overlay');
    const content = overlay.querySelector('.others-menu-content');
    const logoutBtn = document.getElementById('mobile-logout');

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncMobileNavTheme, { once: true });
    }

})();