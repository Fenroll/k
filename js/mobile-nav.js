(function() {
    // Prevent double initialization
    if (document.getElementById('bottom-nav')) return;

    // Detect current page to set active state
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    
    let activeTab = '';
    // Check for index.html or root
    if (page === 'index.html' || page === '') activeTab = 'courses';
    else if (page.includes('anamnesis')) activeTab = 'anamnesis';
    else if (page.includes('calendar')) activeTab = 'calendar';
    
    // HTML Structure
    const navHTML = `
    <div class="bottom-nav" id="bottom-nav">
        <a href="index.html" class="bottom-nav-item ${activeTab === 'courses' ? 'active' : ''}">
            <img src="svg/icon-courses.svg" alt="Courses">
            <span>Courses</span>
        </a>
        <a href="anamnesis.html" class="bottom-nav-item ${activeTab === 'anamnesis' ? 'active' : ''}">
            <img src="svg/icon-anamnesis.svg" alt="Anamnesis">
            <span>Anamnesis</span>
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
            <a href="tools.html" class="others-menu-item">
                <img src="svg/icon-tools.svg" alt="Tools"> Tools
            </a>
            <a href="text-editor.html" class="others-menu-item">
                <img src="svg/icon-editor.svg" alt="Editor"> Editor
            </a>
            <a href="admin.html" class="others-menu-item" id="mobile-admin-link" style="display: none;">
                <img src="svg/icon-admin.svg" alt="Admin"> Admin Panel
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

})();