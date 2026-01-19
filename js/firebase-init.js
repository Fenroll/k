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
try {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase инициализиран успешно');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

const database = firebase.database();
console.log('Firebase Database готов');

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
      timestamp: firebase.database.ServerValue.TIMESTAMP
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
    this.activeUsersRef = database.ref(`active_users/${this.documentId}`);
    this.userRef = this.activeUsersRef.child(currentUser.userId);
  }

  // Маркирай че потребител е активен
  markUserActive() {
    this.userRef.set({
      ...currentUser.toObject(),
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      isActive: true
    });

    // Махай потребителя щом затвори таба/прозорец
    window.addEventListener('beforeunload', () => {
      this.userRef.remove();
    });

    // Периодично обнови timestamp (заDetect offline)
    setInterval(() => {
      this.userRef.update({
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    }, 30000); // Всеки 30 сек
  }

  // Получи брой активни потребители
  onActiveCountChange(callback) {
    this.activeUsersRef.on('value', (snapshot) => {
      const users = snapshot.val() || {};
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
    });
  }

  // Прекрати проследяване
  stop() {
    this.activeUsersRef.off();
    this.userRef.remove();
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
