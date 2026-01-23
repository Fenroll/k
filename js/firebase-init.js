// ============================================
// ANONYMOUS USER SYSTEM (БЕЗ Firebase SDK)
// ============================================

class AnonymousUser {
  constructor() {
    this.userId = this.getOrCreateUserId();
    this.userName = this.getOrCreateUserName();
    this.color = this.generateUserColor(); // Keep, important for user state
    console.log('✓ AnonymousUser създаден:', this.userName, this.userId);
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
      const adjectives = ['Умен', 'Бързо', 'Силен', 'Весел', 'Смелен', 'Светъл', 'Спокойно', 'Оптимисен'];
      const nouns = ['Студент', 'Лекар', 'Учен', 'Гений', 'Орел', 'Мудрец', 'Тигър', 'Феникс'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      userName = `${adj} ${noun}`;
      localStorage.setItem('userName', userName);
    }
    return userName;
  }

  generateUserColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#95E1D3'];
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

// Създай глобален потребител
const currentUser = new AnonymousUser();

console.log('===================================');
console.log('✓ Anonymous User System готов'); // Keep, important for user state
console.log('Потребител:', currentUser.userName, '(' + currentUser.userId + ')');
console.log('===================================');
