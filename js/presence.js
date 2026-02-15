(function() {
    let currentUid = null;
    let currentUserName = null;
    let isGuest = false;
    let presenceRefPath = null;

    // Activity tracking state
    let lastActivityTime = Date.now();
    let isPageVisible = !document.hidden;
    let isUserActive = true;
    let isConnected = false;
    let reconnectAttempts = 0;
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity = idle
    const ACTIVITY_CHECK_INTERVAL = 30000; // Check every 30 seconds
    const HEARTBEAT_INTERVAL = 60000; // Update activity every 60 seconds when active
    const MAX_RECONNECT_ATTEMPTS = 5;
    const MAX_DEVICES_PER_USER = 5; // Max devices allowed per user
    const PERIODIC_CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes
    const LOCALSTORAGE_CLEANUP_DAYS = 7; // Clean localStorage entries older than 7 days
    const TAB_ELECTION_INTERVAL = 15000; // Re-elect leader every 15 seconds
    
    // Tab coordination - only one tab performs cleanup to avoid race conditions
    let isLeaderTab = true; // Start as leader, will be demoted if another tab exists
    let tabId = 'tab_' + Math.random().toString(36).substr(2, 9);

    const loggedInUserStr = localStorage.getItem('loggedInUser');
    const urlParams = new URLSearchParams(window.location.search);
    const guestMode = urlParams.get('guest') === 'true';

    if (loggedInUserStr) {
        try {
            const user = JSON.parse(loggedInUserStr);
            if (!user.uid) {
                console.warn('Presence: Invalid user data, missing uid');
                localStorage.removeItem('loggedInUser');
                return;
            }
            currentUid = user.uid;
            currentUserName = user.userName || user.displayName; // Assuming userName or displayName for current user
            isGuest = false;
            presenceRefPath = '/online_users/';
        } catch (e) {
            console.error('Presence: Failed to parse loggedInUser:', e);
            localStorage.removeItem('loggedInUser');
            return;
        }
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

    // Generate device fingerprint with browser info
    function getDeviceFingerprint() {
        const ua = navigator.userAgent;
        // Check Edge first (Edge includes "Chrome" in UA)
        const browser = ua.includes('Edg/') || ua.includes('Edge/') ? 'Edge' : 
                       ua.includes('Firefox') ? 'Firefox' : 
                       ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari' : 
                       ua.includes('Chrome') ? 'Chrome' : 
                       ua.includes('Opera') || ua.includes('OPR') ? 'Opera' : 'Other';
        const os = ua.includes('Windows') ? 'Windows' : 
                  ua.includes('Mac OS') || ua.includes('Macintosh') ? 'Mac' : 
                  ua.includes('Linux') && !ua.includes('Android') ? 'Linux' : 
                  ua.includes('Android') ? 'Android' : 
                  ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod') ? 'iOS' : 'Other';
        
        return {
            browser: browser,
            os: os,
            deviceName: `${os} - ${browser}`,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            timestamp: Date.now()
        };
    }

    let deviceId = localStorage.getItem('deviceId');
    let deviceInfo = null;
    
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
        deviceInfo = getDeviceFingerprint();
        localStorage.setItem('deviceInfo_' + deviceId, JSON.stringify(deviceInfo));
        console.log('Presence: Created new device ID:', deviceId, deviceInfo);
    } else {
        // Load existing device info or create if missing
        const storedInfo = localStorage.getItem('deviceInfo_' + deviceId);
        deviceInfo = storedInfo ? JSON.parse(storedInfo) : getDeviceFingerprint();
        
        // Update timestamp
        deviceInfo.timestamp = Date.now();
        localStorage.setItem('deviceInfo_' + deviceId, JSON.stringify(deviceInfo));
        console.log('Presence: Using existing device ID:', deviceId, deviceInfo);
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
    let lastActivityUpdateTime = 0;
    const ACTIVITY_UPDATE_THROTTLE = 1000; // Only update once per second
    
    function updateActivity() {
        const now = Date.now();
        lastActivityTime = now;
        
        // Throttle updates to prevent excessive Firebase writes
        if (now - lastActivityUpdateTime < ACTIVITY_UPDATE_THROTTLE) {
            return;
        }
        
        lastActivityUpdateTime = now;
        
        if (!isUserActive && isPageVisible) {
            isUserActive = true;
            updatePresenceStatus();
        }
    }

    // Listen for user interactions (mousemove throttled separately)
    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
    });
    
    // Throttle mousemove more aggressively
    let mouseMoveTimeout = null;
    document.addEventListener('mousemove', function() {
        if (mouseMoveTimeout) return;
        mouseMoveTimeout = setTimeout(function() {
            updateActivity();
            mouseMoveTimeout = null;
        }, 2000); // Only track mousemove every 2 seconds
    }, { passive: true });

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
    
    // Handle page unload - mark as inactive immediately
    window.addEventListener('beforeunload', function() {
        if (typeof firebase !== 'undefined' && window.userStatusDatabaseRef) {
            // Use synchronous update for beforeunload
            window.userStatusDatabaseRef.update({
                isActive: false,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        }
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
    
    // Perform device cleanup
    function performDeviceCleanup(db, forceRun = false) {
        if (!presenceRefPath || !currentUid) return Promise.resolve();
        
        // Only leader tab performs periodic cleanup (but allow forced cleanup on connect)
        if (!isLeaderTab && !forceRun) {
            return Promise.resolve();
        }
        
        const userDevicesRef = db.ref(presenceRefPath + currentUid);
        
        return db.ref(".info/serverTimeOffset").once("value").then(snap => {
            const serverTimeOffset = snap.val() || 0;
            
            return userDevicesRef.once('value').then((snapshot) => {
                const devices = snapshot.val();
                if (!devices) return;
                
                const now = Date.now() + serverTimeOffset;
                const CLEANUP_THRESHOLD = 2 * 60 * 1000;
                const STALE_THRESHOLD = 30 * 60 * 1000;
                
                const deviceList = Object.entries(devices);
                const removalPromises = [];
                
                // If too many devices, remove oldest inactive ones first
                if (deviceList.length > MAX_DEVICES_PER_USER) {
                    console.warn(`Presence: Too many devices (${deviceList.length}), enforcing limit`);
                    
                    // Sort by lastActivity, oldest first
                    const sortedDevices = deviceList
                        .filter(([devId]) => devId !== deviceId)
                        .sort(([, a], [, b]) => (a.lastActivity || 0) - (b.lastActivity || 0));
                    
                    // Remove oldest excess devices
                    const toRemove = deviceList.length - MAX_DEVICES_PER_USER;
                    for (let i = 0; i < toRemove && i < sortedDevices.length; i++) {
                        const [devId, dev] = sortedDevices[i];
                        console.log(`Presence: Removing excess device ${devId} (${dev.deviceName || 'Unknown'})`);
                        removalPromises.push(userDevicesRef.child(devId).remove());
                    }
                }
                
                // Regular cleanup logic
                deviceList.forEach(([devId, device]) => {
                    if (devId === deviceId) return;
                    
                    const deviceAge = device.lastActivity ? (now - device.lastActivity) : STALE_THRESHOLD + 1;
                    
                    if (!device.deviceName && !device.browser) {
                        removalPromises.push(userDevicesRef.child(devId).remove());
                    } else if (device.isActive === false) {
                        removalPromises.push(userDevicesRef.child(devId).remove());
                    } else if (device.offlineAt && (now - device.offlineAt > CLEANUP_THRESHOLD)) {
                        removalPromises.push(userDevicesRef.child(devId).remove());
                    } else if (deviceAge > STALE_THRESHOLD) {
                        removalPromises.push(userDevicesRef.child(devId).remove());
                    }
                });
                
                return Promise.all(removalPromises).then(() => {
                    if (removalPromises.length > 0) {
                        console.log(`Presence: Periodic cleanup removed ${removalPromises.length} device(s)`);
                    }
                });
            });
        }).catch(err => {
            console.warn('Presence: Periodic cleanup failed:', err.message);
        });
    }
    
    // Clean up old localStorage deviceInfo entries
    function cleanupLocalStorage() {
        const now = Date.now();
        const keysToRemove = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('deviceInfo_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    const age = now - (data.timestamp || 0);
                    
                    // Remove entries older than LOCALSTORAGE_CLEANUP_DAYS
                    if (age > LOCALSTORAGE_CLEANUP_DAYS * 24 * 60 * 60 * 1000) {
                        keysToRemove.push(key);
                    }
                } catch (e) {
                    // Invalid JSON, remove it
                    keysToRemove.push(key);
                }
            }
        }
        
        keysToRemove.forEach(key => {
            console.log(`Presence: Removing old localStorage entry: ${key}`);
            localStorage.removeItem(key);
        });
    }
    
    // Simple leader election - first tab to claim leadership or after 10s timeout
    function electLeader() {
        const storageKey = 'presence_leader_' + (currentUid || 'guest');
        const leaderData = localStorage.getItem(storageKey);
        const now = Date.now();
        
        if (leaderData) {
            try {
                const { tabId: leaderId, timestamp } = JSON.parse(leaderData);
                const age = now - timestamp;
                
                // If current leader heartbeat is fresh (< 10s old) and it's us, stay leader
                if (leaderId === tabId && age < 10000) {
                    isLeaderTab = true;
                }
                // If it's us but stale, refresh it
                else if (leaderId === tabId) {
                    isLeaderTab = true;
                }
                // If leader is stale (> 10s old), claim leadership
                else if (age > 10000) {
                    isLeaderTab = true;
                    console.log('Presence: Previous leader stale, claiming leadership');
                }
                // Fresh leader that's not us, step down
                else {
                    isLeaderTab = false;
                }
            } catch (e) {
                // Invalid data, claim leadership
                isLeaderTab = true;
            }
        } else {
            // No leader, claim it
            isLeaderTab = true;
        }
        
        // Update our heartbeat if we're leader
        if (isLeaderTab) {
            localStorage.setItem(storageKey, JSON.stringify({
                tabId: tabId,
                timestamp: now
            }));
        }
    }

    // Update presence status in Firebase
    function updatePresenceStatus() {
        if (typeof firebase === 'undefined' || !window.userStatusDatabaseRef || !isConnected) return;
        
        // More accurate mobile detection - only use user agent, not window width
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isUserActive) {
            const deviceData = {
                isMobile: isMobile,
                isGuest: isGuest,
                userName: currentUserName,
                isActive: true,
                lastActivity: firebase.database.ServerValue.TIMESTAMP,
                deviceName: deviceInfo ? deviceInfo.deviceName : 'Unknown',
                browser: deviceInfo ? deviceInfo.browser : 'Unknown',
                os: deviceInfo ? deviceInfo.os : 'Unknown',
                screenResolution: deviceInfo ? deviceInfo.screenResolution : 'Unknown'
            };
            window.userStatusDatabaseRef.set(deviceData).catch(err => {
                console.warn('Presence: Failed to update active status:', err.message);
            });
            
            // Also update lastSeen in user profile (for persistent tracking)
            if (!isGuest && currentUid) {
                firebase.database().ref(`site_users/${currentUid}`).update({
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                }).catch(err => console.warn('Presence: Failed to update lastSeen:', err.message));
            }
        } else {
            // Mark as inactive (but still connected)
            window.userStatusDatabaseRef.update({
                isActive: false,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            }).catch(err => {
                console.warn('Presence: Failed to update inactive status:', err.message);
            });
        }
    }

    if (typeof firebase !== 'undefined') {
        const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
        const db = firebase.database();

        const userStatusDatabaseRef = db.ref(presenceRefPath + currentUid + '/' + deviceId);
        window.userStatusDatabaseRef = userStatusDatabaseRef; // Store globally for updates

        // Get server time offset
        let serverTimeOffset = 0;
        db.ref(".info/serverTimeOffset").on("value", (snap) => {
            serverTimeOffset = snap.val() || 0;
        });

        db.ref('.info/connected').on('value', function(snapshot) {
            const wasConnected = isConnected;
            isConnected = snapshot.val() === true;
            
            if (!isConnected) {
                console.log('Presence: Disconnected from Firebase');
                reconnectAttempts++;
                if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    console.error('Presence: Max reconnection attempts reached');
                }
                return;
            }
            
            if (!wasConnected && isConnected) {
                console.log('Presence: Reconnected to Firebase');
                reconnectAttempts = 0;
            } else {
                console.log('Presence: Connected to Firebase');
            }
            
            // Determine device type - only use user agent, not window width
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            const deviceData = {
                isMobile: isMobile,
                isGuest: isGuest,
                userName: currentUserName,
                isActive: isUserActive && isPageVisible,
                lastActivity: firebase.database.ServerValue.TIMESTAMP,
                deviceName: deviceInfo ? deviceInfo.deviceName : 'Unknown',
                browser: deviceInfo ? deviceInfo.browser : 'Unknown',
                os: deviceInfo ? deviceInfo.os : 'Unknown',
                screenResolution: deviceInfo ? deviceInfo.screenResolution : 'Unknown'
            };

            userStatusDatabaseRef.onDisconnect().update({
                isActive: false,
                offlineAt: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            }).then(function() {
                // First set the current device data
                return userStatusDatabaseRef.set(deviceData);
            }).then(function() {
                
                // Update lastSeen in user profile (for persistent tracking)
                if (!isGuest && currentUid) {
                    db.ref(`site_users/${currentUid}`).update({
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    }).catch(err => console.warn('Failed to update lastSeen on connect:', err.message));
                }
                
                // Then clean up old devices for this user after setting current device
                console.log('Presence: Running initial device cleanup');
                return performDeviceCleanup(db, true); // Force run on initial connect
            }).catch(function(error) {
                console.error('Presence: Error setting up presence:', error);
            });
        });

        // Check idle status periodically
        setInterval(checkIdleStatus, ACTIVITY_CHECK_INTERVAL);
        
        // Heartbeat to keep presence fresh
        setInterval(function() {
            if (isUserActive && isPageVisible && isConnected) {
                // Update lastActivity timestamp to show we're still here
                window.userStatusDatabaseRef.update({
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                }).catch(err => {
                    console.warn('Presence: Heartbeat failed:', err.message);
                });
            }
        }, HEARTBEAT_INTERVAL);
        
        // Periodic device cleanup
        setInterval(function() {
            if (isConnected) {
                performDeviceCleanup(db);
            }
        }, PERIODIC_CLEANUP_INTERVAL);
        
        // Leader election for multi-tab coordination
        setInterval(electLeader, TAB_ELECTION_INTERVAL);
        electLeader(); // Run immediately
        
        // Clean up old localStorage entries on startup
        cleanupLocalStorage();
    }
    
    // Cleanup on page close
    window.addEventListener('beforeunload', function() {
        // Clear our leader status so another tab can take over immediately
        if (isLeaderTab) {
            const storageKey = 'presence_leader_' + (currentUid || 'guest');
            localStorage.removeItem(storageKey);
        }
    });

    // Expose activity state globally for chat system
    window.userActivityState = {
        isActive: () => isUserActive && isPageVisible,
        getLastActivityTime: () => lastActivityTime,
        isConnected: () => isConnected,
        getDeviceId: () => deviceId,
        getDeviceInfo: () => deviceInfo,
        isLeaderTab: () => isLeaderTab,
        getTabId: () => tabId
    };
    
    // Expose manual cleanup function
    window.cleanupMyDevices = function() {
        if (typeof firebase === 'undefined' || !presenceRefPath || !currentUid) {
            console.error('Cleanup: Firebase not initialized or no user logged in');
            return;
        }
        
        const db = firebase.database();
        const userDevicesRef = db.ref(presenceRefPath + currentUid);
        
        userDevicesRef.once('value').then((snapshot) => {
            const devices = snapshot.val();
            if (!devices) {
                console.log('Cleanup: No devices found');
                return;
            }
            
            console.log(`Cleanup: Found ${Object.keys(devices).length} devices, cleaning up all except current...`);
            
            Object.keys(devices).forEach(devId => {
                if (devId === deviceId) {
                    console.log(`Cleanup: Keeping current device ${devId}`);
                    return;
                }
                
                console.log(`Cleanup: Removing device ${devId} (${devices[devId].deviceName || 'Unknown'})`);
                userDevicesRef.child(devId).remove();
            });
            
            console.log('Cleanup: Complete! Refresh the page to see updated device count.');
        }).catch(err => {
            console.error('Cleanup: Error:', err);
        });
    };
})();
