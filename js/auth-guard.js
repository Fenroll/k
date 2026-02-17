(function() {
    const pathLower = (window.location.pathname || '').toLowerCase();
    const hrefNoHash = (window.location.href || '').split('#')[0];
    const hrefNoQuery = hrefNoHash.split('?')[0].toLowerCase();
    const isLoginPage = /(?:^|\/)login(?:\.html)?$/.test(pathLower) || /(?:^|\/)login(?:\.html)?$/.test(hrefNoQuery);
    const isMdViewerPage = window.location.pathname.endsWith('md-viewer.html');
    const urlParams = new URLSearchParams(window.location.search);
    const isGuestAccess = urlParams.get('guest') === 'true';
    const AUTH_WAIT_MS = 2200;
    const AUTH_POLL_MS = 50;

    function cameFromInternalNonLoginPage() {
        const ref = document.referrer;
        if (!ref) return false;
        try {
            const refUrl = new URL(ref);
            const sameOrigin = refUrl.origin === window.location.origin;
            if (!sameOrigin) return false;

            const refPath = (refUrl.pathname || '').toLowerCase();
            const refHrefNoHash = (refUrl.href || '').split('#')[0];
            const refHrefNoQuery = refHrefNoHash.split('?')[0].toLowerCase();
            const refIsLogin = /(?:^|\/)login(?:\.html)?$/.test(refPath) || /(?:^|\/)login(?:\.html)?$/.test(refHrefNoQuery);
            return !refIsLogin;
        } catch (_) {
            return false;
        }
    }

    function isBackForwardNavigation() {
        try {
            const navEntries = performance.getEntriesByType && performance.getEntriesByType('navigation');
            if (navEntries && navEntries.length > 0) {
                return navEntries[0].type === 'back_forward';
            }
        } catch (_) {}
        return false;
    }

    function shouldUseGraceWindow() {
        return cameFromInternalNonLoginPage() || isBackForwardNavigation();
    }

    function hasValidSession() {
        return !!localStorage.getItem('loggedInUser');
    }

    function shouldAllowWithoutSession() {
        // Allow access to md-viewer.html if guest=true
        return isMdViewerPage && isGuestAccess;
    }

    function redirectToLogin() {
        if (!isLoginPage) {
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

    function waitForSession(maxWaitMs = AUTH_WAIT_MS) {
        return new Promise((resolve) => {
            if (hasValidSession()) {
                resolve(true);
                return;
            }

            const start = Date.now();

            const check = () => {
                if (hasValidSession()) {
                    resolve(true);
                    return;
                }

                if (Date.now() - start >= maxWaitMs) {
                    resolve(false);
                    return;
                }

                setTimeout(check, AUTH_POLL_MS);
            };

            check();
        });
    }

    function wireLateSessionRecovery() {
        const revealIfSession = () => {
            if (hasValidSession()) {
                revealPage();
            }
        };

        window.addEventListener('pageshow', revealIfSession, { once: true });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                revealIfSession();
            }
        }, { passive: true });
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

        if (!shouldUseGraceWindow()) {
            redirectToLogin();
            return;
        }

        hidePageUntilAuthResolved();
        wireLateSessionRecovery();

        waitForSession(AUTH_WAIT_MS).then((hasSessionNow) => {
            if (hasSessionNow) {
                revealPage();
                return;
            }

            if (!hasValidSession() && !shouldAllowWithoutSession()) {
                redirectToLogin();
            } else {
                revealPage();
            }
        });
    }
})();
