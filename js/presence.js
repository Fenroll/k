(function() {
    let currentUid = null;
    let currentUserName = null;
    let isGuest = false;
    let presenceRefPath = null;

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

    if (typeof firebase !== 'undefined') {
        const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
        const db = firebase.database();

        const userStatusDatabaseRef = db.ref(presenceRefPath + currentUid + '/' + deviceId);

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
                userName: currentUserName // Include userName for guests
            };
            console.log('Presence: Setting presence for UID:', currentUid, 'isGuest:', isGuest, 'path:', presenceRefPath + currentUid + '/' + deviceId, 'data:', deviceData);

            userStatusDatabaseRef.onDisconnect().remove().then(function() {
                userStatusDatabaseRef.set(deviceData);
            });
        });
    }
})();
