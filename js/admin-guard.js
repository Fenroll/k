(function() {
    // This guard relies on user-identity.js being loaded first.
    if (window.currentUserPromise) {
        window.currentUserPromise.then(user => {
            if (!user || !user.isAdmin) {
                window.location.href = 'index.html';
            }
        }).catch(error => {
            console.error("Error in admin-guard:", error);
            window.location.href = 'login.html';
        });
    } else {
        // Fallback if user-identity.js is not loaded, though it should be.
        console.error("currentUserPromise not found. Admin check failed.");
        window.location.href = 'login.html';
    }
})();

