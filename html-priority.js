// HTML Priority Files - Keyboard Shortcuts Configuration
// Configure your 3 priority HTML files here using relative paths from the website root
// Example: 'files/Клинична Генетика/Изпит/1-msg-Теми.html'

// Function to convert absolute file path to relative path
// Input: D:\Filen\Personal\Website\files\Актуални събития Event center\INFO.md
// Output: files/Актуални събития Event center/INFO.md
function convertAbsoluteToRelativePath(absolutePath) {
  // Find the position of 'files' folder
  const filesIndex = absolutePath.toLowerCase().indexOf('\\files\\');
  
  if (filesIndex !== -1) {
    // Extract everything from 'files' onwards and convert backslashes to forward slashes
    const relativePath = absolutePath.substring(filesIndex + 1).replace(/\\/g, '/');
    return relativePath;
  }
  
  // If 'files' folder not found, try to extract from 'files' at the end of a path component
  const parts = absolutePath.split('\\');
  const filesIdx = parts.findIndex(part => part.toLowerCase() === 'files');
  
  if (filesIdx !== -1) {
    // Join from 'files' onwards with forward slashes
    return parts.slice(filesIdx).join('/');
  }
  
  // If conversion not possible, return original path
  console.warn('Could not convert path:', absolutePath);
  return absolutePath;
}

// Normalize path for matching against courses note.path values.
// Ensures relative path + forward slashes regardless of source format.
function normalizePriorityPath(path) {
  if (!path || typeof path !== 'string') return '';

  let normalized = path.trim();

  // Convert absolute paths like D:\...\files\... -> files/...
  if (/^[a-zA-Z]:\\/.test(normalized)) {
    normalized = convertAbsoluteToRelativePath(normalized);
  }

  // Normalize separators and trim leading ./ or /
  normalized = normalized.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');

  return normalized;
}

// Firebase initialization and data fetching for htmlPriority
(function() {
  const firebaseConfig = {
    apiKey: "API_KEY",
    authDomain: "med-student-chat.firebaseapp.com",
    databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "med-student-chat",
    storageBucket: "med-student-chat.appspot.com",
    messagingSenderId: "SENDER_ID",
    appId: "APP_ID"
  };

  // Check if firebase is loaded
  if (typeof firebase === 'undefined') {
    console.warn('html-priority.js: Firebase not loaded yet, skipping initialization');
    return;
  }

  let app;
  if (firebase.apps.length === 0) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  const db = firebase.database();

  window.htmlPriorityPromise = db.ref('/settings/html_priority').once('value')
    .then(snapshot => {
      const data = snapshot.val();
      if (data) {
        // Normalize loaded values so lookups in index.html are reliable.
        window.htmlPriority = {
          1: normalizePriorityPath(data[1] || 'files/Клинична Патология/Колоквиум 3 - Отделителна и Нервна система/1-msg-Теми.html'),
          2: normalizePriorityPath(data[2] || 'files/Дерматология и венерология/Теми/2-msg-Методи на изследване в дерматологията - клинични, лабораторни.html'),
          3: normalizePriorityPath(data[3] || 'files/Клинична Генетика/Изпит/1-msg-Теми.html')
        };
      } else {
        // Default values if not found in Firebase
        window.htmlPriority = {
          1: 'files/Клинична Патология/Колоквиум 3 - Отделителна и Нервна система/1-msg-Теми.html',
          2: 'files/Дерматология и венерология/Теми/2-msg-Методи на изследване в дерматологията - клинични, лабораторни.html',
          3: 'files/Клинична Генетика/Изпит/1-msg-Теми.html'
        };
        // Save default to Firebase if it doesn't exist
        db.ref('/settings/html_priority').set(window.htmlPriority);
      }
      return window.htmlPriority;
    })
    .catch(error => {
      console.error("Error fetching htmlPriority from Firebase:", error);
      // Fallback to hardcoded defaults in case of error
      window.htmlPriority = {
        1: 'files/Рентгенология/Изпит/1-msg-Теми.html',
        2: 'files/Клинична Генетика/Изпит/2-msg-Въпроси.html',
        3: 'files/Клинична Генетика/Изпит/1-msg-Теми.html'
      };
      return window.htmlPriority;
    });
})();
