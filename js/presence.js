(function() {
    // ============================================================
    //  Presence v3 — three-state (active / away / offline) model
    //  with debounced visibility, mobile-aware thresholds, page
    //  lifecycle handling, cross-tab BroadcastChannel sync, and
    //  per-tab localStorage entries (no read-modify-write races).
    // ============================================================

    const IS_MOBILE_DEVICE = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const IDLE_TIMEOUT              = IS_MOBILE_DEVICE ? 10 * 60 * 1000 : 5 * 60 * 1000;
    const VISIBILITY_HIDE_DEBOUNCE  = IS_MOBILE_DEVICE ? 60 * 1000      : 30 * 1000;
    const ACTIVITY_CHECK_INTERVAL   = 30 * 1000;
    const HEARTBEAT_INTERVAL        = 20 * 1000;        // wake-up cadence; actual writes are gated
    const HEARTBEAT_MIN_WRITE_GAP   = 60 * 1000;        // never write more often than this while active
    const ACTIVITY_UPDATE_THROTTLE  = 1000;
    const TAB_BROADCAST_INTERVAL    = 5 * 1000;
    const TAB_ENTRY_TTL             = 30 * 1000;
    const TAB_ELECTION_INTERVAL     = 15 * 1000;
    const LEADER_STALE_MS           = 10 * 1000;
    const PERIODIC_CLEANUP_INTERVAL = 5 * 60 * 1000;
    const MAX_DEVICES_PER_USER      = 5;
    const LOCALSTORAGE_CLEANUP_DAYS = 7;
    const MAX_RECONNECT_ATTEMPTS    = 5;

    // --- Identity ---
    let currentUid = null;
    let currentUserName = null;
    let isGuest = false;
    let presenceRefPath = null;

    const loggedInUserStr = localStorage.getItem('loggedInUser');
    const urlParams = new URLSearchParams(window.location.search);
    const guestMode = urlParams.get('guest') === 'true';

    if (loggedInUserStr) {
        try {
            const user = JSON.parse(loggedInUserStr);
            if (!user.uid) {
                console.warn('Presence: Invalid user data, missing uid — skipping presence');
                return;
            }
            currentUid = user.uid;
            currentUserName = user.userName || user.displayName;
            presenceRefPath = '/online_users/';
        } catch (e) {
            console.error('Presence: Failed to parse loggedInUser:', e);
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
        currentUserName = `Guest-${currentUid.substring(6, 10)}`;
        presenceRefPath = '/online_guests/';
    } else {
        return;
    }

    // --- Device + tab identity ---
    function getDeviceFingerprint() {
        const ua = navigator.userAgent;
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
            browser, os,
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
    } else {
        const storedInfo = localStorage.getItem('deviceInfo_' + deviceId);
        try {
            deviceInfo = storedInfo ? JSON.parse(storedInfo) : getDeviceFingerprint();
        } catch (e) {
            deviceInfo = getDeviceFingerprint();
        }
        deviceInfo.timestamp = Date.now();
        localStorage.setItem('deviceInfo_' + deviceId, JSON.stringify(deviceInfo));
    }
    const tabId = 'tab_' + Math.random().toString(36).substr(2, 9);

    // --- Cross-tab keys ---
    const tabKeyPrefix = 'presence_tab_' + (currentUid || 'guest') + '_'; // per-tab entries (no shared map)
    const myTabKey    = tabKeyPrefix + tabId;
    const leaderKey   = 'presence_leader_' + (currentUid || 'guest');
    const channelName = 'presence_' + (currentUid || 'guest');

    // --- Local state ---
    let lastActivityTime = Date.now();
    let isPageVisible = !document.hidden;
    let currentState = computeStateLocal();
    let writtenState = null;
    let lastWrittenActivityTs = 0;
    let isConnected = false;
    let reconnectAttempts = 0;
    let isLeaderTab = false;
    let hideDebounceTimer = null;
    let lastActivityWriteTime = 0;

    // Sibling tab snapshots received via BroadcastChannel
    const siblings = new Map(); // tabId -> { visible, lastActivity, ts }

    function pruneSiblings(now) {
        for (const [id, entry] of siblings) {
            if (!entry || (now - (entry.ts || 0)) > TAB_ENTRY_TTL) siblings.delete(id);
        }
    }

    // --- BroadcastChannel (preferred) with storage-event fallback ---
    let channel = null;
    try {
        if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(channelName);
    } catch (e) { channel = null; }

    if (channel) {
        channel.onmessage = (e) => {
            const msg = e.data;
            if (!msg || msg.tabId === tabId) return;
            if (msg.type === 'state') {
                siblings.set(msg.tabId, { visible: !!msg.visible, lastActivity: msg.lastActivity || 0, ts: Date.now() });
                recomputeState();
            } else if (msg.type === 'leader-changed') {
                electLeader(false);
            } else if (msg.type === 'request-state') {
                postBroadcast({ type: 'state', tabId, visible: isPageVisible, lastActivity: lastActivityTime });
            }
        };
    }

    function postBroadcast(msg) {
        if (channel) {
            try { channel.postMessage(msg); } catch (e) {}
        }
    }

    function writeMyTabEntry() {
        const now = Date.now();
        try {
            localStorage.setItem(myTabKey, JSON.stringify({
                uid: currentUid,
                visible: isPageVisible,
                lastActivity: lastActivityTime,
                ts: now
            }));
        } catch (e) {}
    }

    function removeMyTabEntry() {
        try { localStorage.removeItem(myTabKey); } catch (e) {}
    }

    function readSiblingsFromStorage() {
        // Fallback path: pull sibling state from localStorage on demand
        // (used when BroadcastChannel isn't available or after long idle).
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(tabKeyPrefix)) continue;
            const id = key.substring(tabKeyPrefix.length);
            if (id === tabId) continue;
            try {
                const entry = JSON.parse(localStorage.getItem(key));
                if (!entry || entry.uid !== currentUid) continue;
                if ((now - (entry.ts || 0)) > TAB_ENTRY_TTL) {
                    // Sweep stale entries (their writing tab is dead).
                    try { localStorage.removeItem(key); } catch (e) {}
                    siblings.delete(id);
                    continue;
                }
                siblings.set(id, { visible: !!entry.visible, lastActivity: entry.lastActivity || 0, ts: entry.ts });
            } catch (e) {
                try { localStorage.removeItem(key); } catch (e2) {}
            }
        }
    }

    function broadcastTabState() {
        writeMyTabEntry();
        postBroadcast({ type: 'state', tabId, visible: isPageVisible, lastActivity: lastActivityTime });
    }

    // storage event = fallback signaling for browsers without BroadcastChannel and for leader key
    window.addEventListener('storage', (e) => {
        if (!e.key) return;
        if (e.key === leaderKey) {
            electLeader(false);
        } else if (e.key.startsWith(tabKeyPrefix) && e.key !== myTabKey) {
            const id = e.key.substring(tabKeyPrefix.length);
            if (!e.newValue) {
                siblings.delete(id);
            } else {
                try {
                    const entry = JSON.parse(e.newValue);
                    if (entry && entry.uid === currentUid) {
                        siblings.set(id, { visible: !!entry.visible, lastActivity: entry.lastActivity || 0, ts: entry.ts || Date.now() });
                    }
                } catch (ex) {}
            }
            recomputeState();
        }
    });

    // --- Aggregate state across this tab + siblings ---
    function readAggregate() {
        const now = Date.now();
        pruneSiblings(now);
        let anyVisible = isPageVisible;
        let mostRecent = lastActivityTime;
        for (const entry of siblings.values()) {
            if (!entry) continue;
            if (entry.visible) anyVisible = true;
            if ((entry.lastActivity || 0) > mostRecent) mostRecent = entry.lastActivity;
        }
        return { anyVisible, lastActivity: mostRecent };
    }

    function computeStateLocal() {
        // Used at bootstrap before any siblings have been heard from.
        const now = Date.now();
        if (isPageVisible && (now - lastActivityTime) < IDLE_TIMEOUT) return 'active';
        return 'away';
    }

    function computeState() {
        const agg = readAggregate();
        const now = Date.now();
        const online = (typeof navigator !== 'undefined') ? (navigator.onLine !== false) : true;
        if (!online) return 'away';
        if (agg.anyVisible && (now - agg.lastActivity) < IDLE_TIMEOUT) return 'active';
        return 'away';
    }

    function recomputeState() {
        const next = computeState();
        if (next !== currentState) {
            currentState = next;
            flushStateToFirebase();
            scheduleNextExpirationCheck();
        }
    }

    // Schedule a single timer for the next state expiration (idle timeout edge).
    // Replaces wasteful constant polling.
    let nextExpirationTimer = null;
    function scheduleNextExpirationCheck() {
        if (nextExpirationTimer) {
            clearTimeout(nextExpirationTimer);
            nextExpirationTimer = null;
        }
        if (currentState !== 'active') return;
        const agg = readAggregate();
        const now = Date.now();
        const msUntilIdle = IDLE_TIMEOUT - (now - agg.lastActivity);
        if (msUntilIdle <= 0) {
            recomputeState();
            return;
        }
        nextExpirationTimer = setTimeout(() => {
            nextExpirationTimer = null;
            recomputeState();
        }, msUntilIdle + 500);
    }

    // --- Activity tracking ---
    function updateActivity() {
        const now = Date.now();
        lastActivityTime = now;
        if (now - lastActivityWriteTime < ACTIVITY_UPDATE_THROTTLE) return;
        lastActivityWriteTime = now;
        broadcastTabState();
        recomputeState();
        scheduleNextExpirationCheck();
    }

    const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'touchmove', 'pointerdown', 'wheel', 'click'];
    activityEvents.forEach(ev => document.addEventListener(ev, updateActivity, { passive: true }));

    let mouseMoveTimeout = null;
    document.addEventListener('mousemove', () => {
        if (mouseMoveTimeout) return;
        mouseMoveTimeout = setTimeout(() => {
            updateActivity();
            mouseMoveTimeout = null;
        }, 2000);
    }, { passive: true });

    // --- Visibility with debounce ---
    function handleVisibilityChange() {
        if (!document.hidden) {
            if (hideDebounceTimer) { clearTimeout(hideDebounceTimer); hideDebounceTimer = null; }
            isPageVisible = true;
            lastActivityTime = Date.now();
            broadcastTabState();
            recomputeState();
            scheduleNextExpirationCheck();
            return;
        }
        if (hideDebounceTimer) return;
        hideDebounceTimer = setTimeout(() => {
            hideDebounceTimer = null;
            isPageVisible = false;
            broadcastTabState();
            recomputeState();
        }, VISIBILITY_HIDE_DEBOUNCE);
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // navigator online/offline -> recompute (we'll show as away when offline)
    window.addEventListener('online', () => { lastActivityTime = Date.now(); recomputeState(); });
    window.addEventListener('offline', () => { recomputeState(); });

    // --- Page lifecycle: pagehide / freeze / resume / beforeunload ---
    function relinquishLeadership() {
        try {
            const raw = localStorage.getItem(leaderKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.tabId === tabId) localStorage.removeItem(leaderKey);
            }
        } catch (e) {}
        postBroadcast({ type: 'leader-changed', tabId });
    }

    function teardownTab() {
        removeMyTabEntry();
        if (isLeaderTab && window.userStatusDatabaseRef) {
            try {
                window.userStatusDatabaseRef.update({
                    state: 'away',
                    isActive: false,
                    awayAt: firebase.database.ServerValue.TIMESTAMP,
                    lastActivity: firebase.database.ServerValue.TIMESTAMP
                });
            } catch (e) {}
        }
        relinquishLeadership();
    }

    window.addEventListener('pagehide', () => {
        isPageVisible = false;
        teardownTab();
    });
    document.addEventListener('freeze', () => {
        isPageVisible = false;
        broadcastTabState();
    });
    document.addEventListener('resume', () => {
        isPageVisible = !document.hidden;
        lastActivityTime = Date.now();
        broadcastTabState();
        electLeader(false);
        recomputeState();
        scheduleNextExpirationCheck();
    });
    window.addEventListener('beforeunload', teardownTab);

    // --- Leader election ---
    function electLeader(allowTakeover) {
        const now = Date.now();
        let claim = false;
        try {
            const raw = localStorage.getItem(leaderKey);
            if (!raw) {
                claim = true;
            } else {
                const parsed = JSON.parse(raw);
                const age = now - (parsed.timestamp || 0);
                if (parsed.tabId === tabId) claim = true;
                else if (age > LEADER_STALE_MS) claim = true;
                else if (allowTakeover) claim = false;
            }
        } catch (e) { claim = true; }

        const wasLeader = isLeaderTab;
        isLeaderTab = claim;
        if (claim) {
            try { localStorage.setItem(leaderKey, JSON.stringify({ tabId, timestamp: now })); } catch (e) {}
        }
        if (!wasLeader && isLeaderTab) {
            registerDisconnectHandler();
            writtenState = null;
            lastWrittenActivityTs = 0;
            flushStateToFirebase();
            postBroadcast({ type: 'leader-changed', tabId });
        } else if (wasLeader && !isLeaderTab) {
            if (window.userStatusDatabaseRef) {
                try { window.userStatusDatabaseRef.onDisconnect().cancel(); } catch (e) {}
            }
        }
    }

    function registerDisconnectHandler() {
        if (!window.userStatusDatabaseRef) return;
        try {
            // No offlineAt — consumer derives offline from staleness of state+timestamps.
            window.userStatusDatabaseRef.onDisconnect().update({
                state: 'away',
                isActive: false,
                awayAt: firebase.database.ServerValue.TIMESTAMP,
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (e) {
            console.warn('Presence: onDisconnect register failed:', e.message);
        }
    }

    // --- Firebase writes ---
    function flushStateToFirebase() {
        if (typeof firebase === 'undefined' || !window.userStatusDatabaseRef || !isConnected) return;
        if (!isLeaderTab) return;
        if (writtenState === currentState) return;

        const ts = firebase.database.ServerValue.TIMESTAMP;
        if (currentState === 'active') {
            const data = {
                state: 'active',
                isActive: true,
                isMobile: IS_MOBILE_DEVICE,
                isGuest: isGuest,
                userName: currentUserName,
                lastActivity: ts,
                awayAt: null,
                deviceName: deviceInfo ? deviceInfo.deviceName : 'Unknown',
                browser: deviceInfo ? deviceInfo.browser : 'Unknown',
                os: deviceInfo ? deviceInfo.os : 'Unknown',
                screenResolution: deviceInfo ? deviceInfo.screenResolution : 'Unknown'
            };
            window.userStatusDatabaseRef.update(data).catch(err => {
                console.warn('Presence: failed to flush active:', err.message);
            });
            if (!isGuest && currentUid) {
                firebase.database().ref(`site_users/${currentUid}`).update({ lastSeen: ts })
                    .catch(() => {});
            }
        } else {
            window.userStatusDatabaseRef.update({
                state: 'away',
                isActive: false,
                awayAt: ts,
                lastActivity: ts
            }).catch(err => console.warn('Presence: failed to flush away:', err.message));
        }
        writtenState = currentState;
        lastWrittenActivityTs = Date.now();
    }

    // --- Device cleanup (leader only) ---
    function performDeviceCleanup(db, forceRun = false) {
        if (!presenceRefPath || !currentUid) return Promise.resolve();
        if (!isLeaderTab && !forceRun) return Promise.resolve();

        const userDevicesRef = db.ref(presenceRefPath + currentUid);
        return db.ref('.info/serverTimeOffset').once('value').then(snap => {
            const serverTimeOffset = snap.val() || 0;
            return userDevicesRef.once('value').then(snapshot => {
                const devices = snapshot.val();
                if (!devices) return;
                const now = Date.now() + serverTimeOffset;
                const STALE_THRESHOLD = 30 * 60 * 1000;
                const entries = Object.entries(devices);
                const ops = [];

                if (entries.length > MAX_DEVICES_PER_USER) {
                    const sorted = entries
                        .filter(([id]) => id !== deviceId)
                        .sort(([, a], [, b]) => (a.lastActivity || 0) - (b.lastActivity || 0));
                    const toRemove = entries.length - MAX_DEVICES_PER_USER;
                    for (let i = 0; i < toRemove && i < sorted.length; i++) {
                        ops.push(userDevicesRef.child(sorted[i][0]).remove());
                    }
                }

                entries.forEach(([id, dev]) => {
                    if (id === deviceId) return;
                    if (!dev.deviceName && !dev.browser) {
                        ops.push(userDevicesRef.child(id).remove());
                        return;
                    }
                    const age = dev.lastActivity ? (now - dev.lastActivity) : STALE_THRESHOLD + 1;
                    if (age > STALE_THRESHOLD) ops.push(userDevicesRef.child(id).remove());
                });

                return Promise.all(ops);
            });
        }).catch(err => console.warn('Presence: cleanup failed:', err.message));
    }

    function cleanupLocalStorage() {
        const now = Date.now();
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith('deviceInfo_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if ((now - (data.timestamp || 0)) > LOCALSTORAGE_CLEANUP_DAYS * 24 * 60 * 60 * 1000) {
                        toRemove.push(key);
                    }
                } catch (e) { toRemove.push(key); }
            } else if (key.startsWith(tabKeyPrefix)) {
                try {
                    const entry = JSON.parse(localStorage.getItem(key));
                    if (!entry || (now - (entry.ts || 0)) > 24 * 60 * 60 * 1000) toRemove.push(key);
                } catch (e) { toRemove.push(key); }
            }
        }
        toRemove.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    }

    // --- Firebase boot ---
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
        if (firebase.apps.length === 0) firebase.initializeApp(firebaseConfig);
        const db = firebase.database();

        const userStatusDatabaseRef = db.ref(presenceRefPath + currentUid + '/' + deviceId);
        window.userStatusDatabaseRef = userStatusDatabaseRef;

        db.ref('.info/connected').on('value', (snapshot) => {
            const wasConnected = isConnected;
            isConnected = snapshot.val() === true;
            if (!isConnected) {
                reconnectAttempts++;
                if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                    console.warn('Presence: max reconnect attempts reached');
                }
                return;
            }
            if (!wasConnected) reconnectAttempts = 0;

            readSiblingsFromStorage();
            electLeader(false);
            broadcastTabState();

            if (isLeaderTab) {
                registerDisconnectHandler();
                // Force re-flush regardless of cached state — survives network blips.
                writtenState = null;
                lastWrittenActivityTs = 0;
                currentState = computeState();
                flushStateToFirebase();
                if (!isGuest && currentUid) {
                    db.ref(`site_users/${currentUid}`).update({
                        lastSeen: firebase.database.ServerValue.TIMESTAMP
                    }).catch(() => {});
                }
                performDeviceCleanup(db, true);
                scheduleNextExpirationCheck();
            }
        });

        // Periodic local sweep — covers BroadcastChannel-unavailable browsers,
        // long-idle tabs whose sibling channel went quiet, and stale-entry cleanup.
        setInterval(() => {
            readSiblingsFromStorage();
            recomputeState();
        }, ACTIVITY_CHECK_INTERVAL);

        // Smart heartbeat — only writes when the consumer's freshness window would expire.
        setInterval(() => {
            if (!isLeaderTab || !isConnected) return;
            if (currentState !== 'active') return;
            const now = Date.now();
            if ((now - lastWrittenActivityTs) < HEARTBEAT_MIN_WRITE_GAP) return;
            window.userStatusDatabaseRef.update({
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            }).then(() => { lastWrittenActivityTs = Date.now(); }).catch(() => {});
        }, HEARTBEAT_INTERVAL);

        setInterval(() => electLeader(true), TAB_ELECTION_INTERVAL);
        electLeader(false);

        setInterval(broadcastTabState, TAB_BROADCAST_INTERVAL);
        broadcastTabState();

        // Ask siblings to introduce themselves so we can build the initial picture fast.
        postBroadcast({ type: 'request-state', tabId });

        setInterval(() => { if (isConnected) performDeviceCleanup(db); }, PERIODIC_CLEANUP_INTERVAL);
        cleanupLocalStorage();
    }

    // --- Public API ---
    window.userActivityState = {
        isActive: () => currentState === 'active',
        getState: () => currentState, // 'active' | 'away'
        getLastActivityTime: () => lastActivityTime,
        isConnected: () => isConnected,
        getDeviceId: () => deviceId,
        getDeviceInfo: () => deviceInfo,
        isLeaderTab: () => isLeaderTab,
        getTabId: () => tabId
    };

    window.cleanupMyDevices = function() {
        if (typeof firebase === 'undefined' || !presenceRefPath || !currentUid) return;
        const db = firebase.database();
        const userDevicesRef = db.ref(presenceRefPath + currentUid);
        userDevicesRef.once('value').then(snap => {
            const devices = snap.val() || {};
            Object.keys(devices).forEach(id => {
                if (id !== deviceId) userDevicesRef.child(id).remove();
            });
        });
    };
})();
