// ============================================
// CENTRALIZED USER IDENTITY SYSTEM
// ============================================
class CurrentUser {
  // The constructor is simple, just setting up properties.
  constructor() {
    this.userId = null;
    this.userName = null;
    this.color = null;
    this.legacyChatId = null; // Keep, important for user state
    this.legacyNotesId = null;
    this.password = null; // Needed for account.html
  }

  // This will be called by the async factory.
  _populate(data) {
    Object.assign(this, data);
  }

  // Methods for anonymous user creation
  getOrCreateAnonymousId() {
    let userId = localStorage.getItem('anonymous_userId');
    if (!userId) {
      userId = 'anon_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('anonymous_userId', userId);
    }
    return userId;
  }

  getOrCreateAnonymousName() {
    let userName = localStorage.getItem('anonymous_userName');
    if (!userName) {
      const adjectives = [
        'Умен', 'Бърз', 'Силен', 'Весел', 'Смелен',
        'Спокоен', 'Оптимистичен', 'Брилянтен', 'Всеобхватен', 'Бдителен', 'Скромен',
        'Остър', 'Модерен', 'Елегантен', 'Енергичен', 'Креативен'
      ];
      const nouns = [
        'Студент', 'Лекар', 'Учен', 'Гений', 'Мъдрец',
        'Тигър', 'Дракон', 'Лъв', 'Вълк', 'Доктор', 'Професор'
      ];
      userName = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
      localStorage.setItem('anonymous_userName', userName);
    }
    return userName;
  }

  generateAnonymousColor() {
    let color = localStorage.getItem('anonymous_userColor');
    if (!color) {
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE',
        '#FF8B94', '#6BCB77', '#4D96FF', '#FFD93D', '#6A4C93', '#FF6B9D', '#C06C84'
      ];
      color = colors[Math.floor(Math.random() * colors.length)];
      localStorage.setItem('anonymous_userColor', color);
    }
    return color;
  }
}

// Async factory function to create and initialize the user
async function createAndInitUser() {
    const user = new CurrentUser();
    const loggedInUserStr = localStorage.getItem('loggedInUser');
    const urlParams = new URLSearchParams(window.location.search);
    const guestMode = urlParams.get('guest') === 'true';

    // Handle authenticated user
    if (loggedInUserStr) {
        let sessionData;
        try {
            sessionData = JSON.parse(loggedInUserStr);
        } catch (e) {
            console.error("Failed to parse loggedInUser, falling back to anonymous or guest.", e);
            localStorage.removeItem('loggedInUser');
        }

        if (sessionData && sessionData.uid) {
            try {
                const dbUrl = "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app";
                const response = await fetch(`${dbUrl}/site_users/${sessionData.uid}.json`);
                
                if (!response.ok) {
                    throw new Error(`Firebase fetch failed: ${response.statusText}`);
                }

                const freshUserData = await response.json();

                if (freshUserData) {
                    const plainPassword = atob(freshUserData.password);
                    const fullUserObject = { ...freshUserData, password: plainPassword };
                    
                    user._populate({
                        userId: fullUserObject.uid,
                        userName: fullUserObject.displayName,
                        color: fullUserObject.color,
                        legacyChatId: fullUserObject.legacyChatId || null,
                        legacyNotesId: fullUserObject.legacyNotesId || null,
                        ...fullUserObject,
                        isGuest: false
                    });
                    
                    localStorage.setItem('loggedInUser', JSON.stringify(fullUserObject));
                    return user;
                } else {
                    throw new Error("User not found in database.");
                }
            } catch (e) {
                console.error('Failed to refresh session from DB, logging out.', e.message);
                localStorage.removeItem('loggedInUser');
            }
        }
    }

    // Handle guest user
    if (guestMode) {
        let guestId = sessionStorage.getItem('guestId');
        if (!guestId) {
            guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('guestId', guestId);
        }
        
        // Generate a random color for guest if not present
        let guestColor = sessionStorage.getItem('guestColor');
        if (!guestColor) {
            guestColor = user.generateAnonymousColor(); // Re-use anonymous color generator
            sessionStorage.setItem('guestColor', guestColor);
        }

        user._populate({
            userId: guestId,
            userName: `Guest-${guestId.substring(6, 10)}`, // e.g., Guest-cd23
            color: guestColor,
            isGuest: true,
            legacyChatId: null, 
            legacyNotesId: null
        });
        return user;
    }

    // Fallback to anonymous user if no logged-in user and not in guest mode
    const anonymousId = user.getOrCreateAnonymousId();
    user._populate({
        userId: anonymousId,
        userName: user.getOrCreateAnonymousName(),
        color: user.generateAnonymousColor(),
        legacyChatId: anonymousId,
        legacyNotesId: anonymousId
    });
    return user;
}

// Instantiate a single global user object and expose it via a promise
if (typeof window.currentUserPromise === 'undefined') {
    window.currentUserPromise = createAndInitUser().then(user => {
        window.currentUser = user;
        return user;
    });
}