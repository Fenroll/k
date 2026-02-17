(function() {
    const pathLower = (window.location.pathname || '').toLowerCase();
    const isLoginPage = /\/login(?:\.html)?$/.test(pathLower);
    const isMdViewerPage = window.location.pathname.endsWith('md-viewer.html');
    const urlParams = new URLSearchParams(window.location.search);
    const isGuestAccess = urlParams.get('guest') === 'true';
    const AUTH_WAIT_MS = 800;
    const AUTH_POLL_MS = 50;

    function hasValidSession() {
        return !!localStorage.getItem('loggedInUser');
    }

    function shouldAllowWithoutSession() {
        // Allow access to md-viewer.html if guest=true
        return isMdViewerPage && isGuestAccess;
    }

    function redirectToLogin() {
        if (!window.location.pathname.endsWith('login.html')) {
            window.location.href = 'login.html';
        }
    }

    function hidePageUntilAuthResolved() {
        if (!document.documentElement) return;
        document.documentElement.style.visibility = 'hidden';
    }

    function revealPage() {
        if (!document.documentElement) return;
        document.documentElement.style.visibility = '';
    }

    // Never delay or hide the login page.
    if (isLoginPage) {
        revealPage();
        return;
    }

    // If not logged in and not on the login page, give a short grace window
    // for localStorage/session hydration after fast navigation.
    if (!hasValidSession()) {
        if (shouldAllowWithoutSession()) {
            return;
        }

        hidePageUntilAuthResolved();

        const start = Date.now();
        const timer = setInterval(() => {
            if (hasValidSession()) {
                clearInterval(timer);
                revealPage();
                return;
            }

            if (Date.now() - start >= AUTH_WAIT_MS) {
                clearInterval(timer);
                if (!hasValidSession() && !shouldAllowWithoutSession()) {
                    redirectToLogin();
                } else {
                    revealPage();
                }
            }
        }, AUTH_POLL_MS);
    }
})();
