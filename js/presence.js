(function() {
    const loggedInUserStr = localStorage.getItem('loggedInUser');
    if (!loggedInUserStr) {
        return;
    }

    const user = JSON.parse(loggedInUserStr);
    const uid = user.uid;
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

        const userStatusDatabaseRef = db.ref('/online_users/' + uid + '/' + deviceId);

        db.ref('.info/connected').on('value', function(snapshot) {
            if (snapshot.val() === false) {
                return;
            };

            // Determine device type
            const isMobile = window.innerWidth <= 768 || 
                             /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            const deviceData = {
                isMobile: isMobile,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            userStatusDatabaseRef.onDisconnect().remove().then(function() {
                userStatusDatabaseRef.set(deviceData);
            });
        });
    }
})();
