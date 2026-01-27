(function() {
    let currentUid = null;
    let currentUserName = null;
    let isGuest = false;
    let presenceRefPath = null;

    // Activity tracking state
    let lastActivityTime = Date.now();
    let isPageVisible = !document.hidden;
    let isUserActive = true;
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity = idle
    const ACTIVITY_CHECK_INTERVAL = 10000; // Check every 10 seconds

    const loggedInUserStr = localStorage.getItem('loggedInUser');
    const urlParams = new URLSearchParams(window.location.search);
    const guestMode = urlParams.get('guest') === 'true';

    if (loggedInUserStr) {
        const user = JSON.parse(loggedInUserStr);
        currentUid = user.uid;
        currentUserName = user.userName || user.displayName; // Assuming userName or displayName for current user
        isGuest = false;
        presenceRefPath = '/online_users/';
    } else if (guestMode) {
        isGuest = true;
        let guestId = sessionStorage.getItem('guestId');
        if (!guestId) {
            guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('guestId', guestId);
        }
        currentUid = guestId;
        currentUserName = `Guest-${currentUid.substring(6, 10)}`; // e.g., Guest-cd23
        presenceRefPath = '/online_guests/';
    } else {
        return; // No logged-in user and not in guest mode, so presence is not tracked
    }

    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }

    const firebaseConfig = {
        apiKey: "API_KEY",
        authDomain: "med-student-chat.firebaseapp.com",
        databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "med-student-chat",
        storageBucket: "med-student-chat.appspot.com",
        messagingSenderId: "SENDER_ID",
        appId: "APP_ID"
    };

    // Track user activity events
    function updateActivity() {
        lastActivityTime = Date.now();
        if (!isUserActive && isPageVisible) {
            isUserActive = true;
            updatePresenceStatus();
        }
    }

    // Listen for user interactions
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', function() {
        isPageVisible = !document.hidden;
        if (isPageVisible) {
            lastActivityTime = Date.now();
            isUserActive = true;
        } else {
            isUserActive = false;
        }
        updatePresenceStatus();
    });

    // Check for idle timeout periodically
    function checkIdleStatus() {
        const timeSinceActivity = Date.now() - lastActivityTime;
        const wasActive = isUserActive;
        
        // User is active if: page is visible AND activity within timeout
        isUserActive = isPageVisible && (timeSinceActivity < IDLE_TIMEOUT);
        
        // Update presence if status changed
        if (wasActive !== isUserActive) {
            updatePresenceStatus();
        }
    }

    // Update presence status in Firebase
    function updatePresenceStatus() {
        if (typeof firebase === 'undefined' || !window.userStatusDatabaseRef) return;
        
        const isMobile = window.innerWidth <= 768 || 
                         /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isUserActive) {
            const deviceData = {
                isMobile: isMobile,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isGuest: isGuest,
                userName: currentUserName,
                isActive: true,
                lastActivity: Date.now()
            };
            window.userStatusDatabaseRef.set(deviceData);
            console.log('Presence: User is ACTIVE');
        } else {
            // Mark as inactive (but still connected)
            window.userStatusDatabaseRef.update({
                isActive: false,
                lastInactive: Date.now()
            });
            console.log('Presence: User is INACTIVE (idle or tab hidden)');
        }
    }

    if (typeof firebase !== 'undefined') {
        const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
        const db = firebase.database();

        const userStatusDatabaseRef = db.ref(presenceRefPath + currentUid + '/' + deviceId);
        window.userStatusDatabaseRef = userStatusDatabaseRef; // Store globally for updates

        db.ref('.info/connected').on('value', function(snapshot) {
            if (snapshot.val() === false) {
                return;
            };

            // Determine device type
            const isMobile = window.innerWidth <= 768 || 
                             /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            const deviceData = {
                isMobile: isMobile,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                isGuest: isGuest,
                userName: currentUserName,
                isActive: isUserActive && isPageVisible,
                lastActivity: Date.now()
            };
            console.log('Presence: Setting initial presence for UID:', currentUid, 'isGuest:', isGuest, 'isActive:', deviceData.isActive);

            userStatusDatabaseRef.onDisconnect().remove().then(function() {
                userStatusDatabaseRef.set(deviceData);
            });
        });

        // Check idle status periodically
        setInterval(checkIdleStatus, ACTIVITY_CHECK_INTERVAL);
    }

    // Expose activity state globally for chat system
    window.userActivityState = {
        isActive: () => isUserActive && isPageVisible,
        getLastActivityTime: () => lastActivityTime
    };
})();
