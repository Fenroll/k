// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBoGfYxsZDyh1mxlWMazSYqjpt8Yexl3s",
  authDomain: "med-student-chat.firebaseapp.com",
  databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "med-student-chat",
  storageBucket: "med-student-chat.firebasestorage.app",
  messagingSenderId: "181414766637",
  appId: "1:181414766637:web:547948b1d7f994d03f22c7",
  measurementId: "G-ZQKF2X8A5K"
};

console.log('Инициализирам Firebase...');

// Initialize Firebase
let firebaseReady = false;
try {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase инициализиран успешно');
  firebaseReady = true;
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.warn('Firebase не работи - чат ще работи локално');
  firebaseReady = false;
}

const database = firebaseReady ? firebase.database() : null;
console.log('Firebase Database готов:', !!database);

// ============================================
// АНОНИМЕН ПОТРЕБИТЕЛ СИСТЕМА
// ============================================

class AnonymousUser {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.userName = this.getOrCreateUserName();
    this.color = this.generateUserColor();
  }

  getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  getOrCreateUserName() {
    let userName = localStorage.getItem('userName');
    if (!userName) {
      const adjectives = ['Умен', 'Бързо', 'Силен', 'Весел', 'Смелен', 'Светъл'];
      const nouns = ['Студент', 'Лекар', 'Учен', 'Гений', 'Орел', 'Мудрец'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      userName = `${adj} ${noun}`;
      localStorage.setItem('userName', userName);
    }
    return userName;
  }

  generateUserColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    let color = localStorage.getItem('userColor');
    if (!color) {
      color = colors[Math.floor(Math.random() * colors.length)];
      localStorage.setItem('userColor', color);
    }
    return color;
  }

  toObject() {
    return {
      userId: this.userId,
      userName: this.userName,
      color: this.color,
      timestamp: Date.now()
    };
  }
}

// Глобален инстанция на потребителя
const currentUser = new AnonymousUser();

// ============================================
// АКТИВНИ ПОТРЕБИТЕЛИ - Проследяване
// ============================================

class ActiveUsersManager {
  constructor(documentId) {
    this.documentId = documentId || 'default';
    this.useLocalStorage = !database;
    
    if (database) {
      try {
        this.activeUsersRef = database.ref(`active_users/${this.documentId}`);
        this.userRef = this.activeUsersRef.child(currentUser.userId);
        console.log('ActiveUsersManager използва Firebase');
      } catch (error) {
        console.warn('Firebase error:', error);
        this.useLocalStorage = true;
      }
    } else {
      console.log('ActiveUsersManager използва localStorage');
    }
  }

  // Маркирай че потребител е активен
  markUserActive() {
    if (this.useLocalStorage) {
      const key = `active_users_${this.documentId}`;
      const users = JSON.parse(localStorage.getItem(key) || '{}');
      users[currentUser.userId] = {
        ...currentUser.toObject(),
        lastSeen: Date.now(),
        isActive: true
      };
      localStorage.setItem(key, JSON.stringify(users));
      console.log('Потребител маркиран като активен локално');

      // Махай потребителя щом затвори таба
      window.addEventListener('beforeunload', () => {
        const users = JSON.parse(localStorage.getItem(key) || '{}');
        delete users[currentUser.userId];
        localStorage.setItem(key, JSON.stringify(users));
      });

      // Периодично обнови timestamp
      setInterval(() => {
        const users = JSON.parse(localStorage.getItem(key) || '{}');
        if (users[currentUser.userId]) {
          users[currentUser.userId].lastSeen = Date.now();
          localStorage.setItem(key, JSON.stringify(users));
        }
      }, 30000);
    } else {
      // Firebase
      this.userRef.set({
        ...currentUser.toObject(),
        lastSeen: Date.now(),
        isActive: true
      });

      window.addEventListener('beforeunload', () => {
        this.userRef.remove();
      });

      setInterval(() => {
        this.userRef.update({
          lastSeen: Date.now()
        });
      }, 30000);
    }
  }

  // Получи брой активни потребители
  onActiveCountChange(callback) {
    if (this.useLocalStorage) {
      const key = `active_users_${this.documentId}`;
      
      // Първоначално зареди
      const users = JSON.parse(localStorage.getItem(key) || '{}');
      this.updateActiveCount(users, callback);
      
      // Периодично провери за нови
      setInterval(() => {
        const updated = JSON.parse(localStorage.getItem(key) || '{}');
        this.updateActiveCount(updated, callback);
      }, 500);
    } else {
      // Firebase
      this.activeUsersRef.on('value', (snapshot) => {
        const users = snapshot.val() || {};
        this.updateActiveCount(users, callback);
      });
    }
  }

  updateActiveCount(users, callback) {
    const count = Object.keys(users).length;
    
    // Провери за offline потребители (> 2 мин неактивни)
    const now = Date.now();
    const onlineUsers = Object.keys(users).filter(userId => {
      const user = users[userId];
      return (now - user.lastSeen) < 120000; // 2 минути
    });

    callback({
      count: onlineUsers.length,
      users: users,
      usersList: onlineUsers
    });
  }

  // Прекрати проследяване
  stop() {
    if (this.activeUsersRef && this.userRef) {
      try {
        this.activeUsersRef.off();
        this.userRef.remove();
      } catch (error) {
        console.warn('Stop error:', error);
      }
    } else if (this.useLocalStorage) {
      const key = `active_users_${this.documentId}`;
      const users = JSON.parse(localStorage.getItem(key) || '{}');
      delete users[currentUser.userId];
      localStorage.setItem(key, JSON.stringify(users));
    }
  }
}

// ============================================
// ЭКСПОРТ
// ============================================
window.AnonymousUser = AnonymousUser;
window.ActiveUsersManager = ActiveUsersManager;
window.currentUser = currentUser;
window.database = database;

console.log('Firebase Init завършен. currentUser:', currentUser.userName, currentUser.userId);
console.log('Anonymous User System готов');
