(function() {
    const isLoggedIn = localStorage.getItem('loggedInUser');
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const isMdViewerPage = window.location.pathname.endsWith('md-viewer.html');
    const urlParams = new URLSearchParams(window.location.search);
    const isGuestAccess = urlParams.get('guest') === 'true';

    // If not logged in and not on the login page
    if (!isLoggedIn && !isLoginPage) {
        // Allow access to md-viewer.html if guest=true
        if (isMdViewerPage && isGuestAccess) {
            return;
        }
        window.location.href = 'login.html';
    }
})();
