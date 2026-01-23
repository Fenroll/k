// This class will manage user accounts using Firebase Realtime Database.
class AccountSystem {
    constructor() {
        this.db = null;
        this.user = null; // Custom user object: { uid (permanent), username (for login), displayName, color }

        // DOM elements will be assigned in init()
        this.registerForm = null;
        this.loginForm = null;
        this.accountInfo = null;
        this.loadingSpinner = null;
        // New forms
        this.changePasswordForm = null;
        this.changeUsernameForm = null;
        this.changeDisplaynameForm = null;
        this.changeColorForm = null;
        this.deleteAccountForm = null;
    }

    async init() {
        // Assign DOM elements here to ensure the DOM is ready
        this.registerForm = document.getElementById('register-form');
        this.loginForm = document.getElementById('login-form');
        this.accountInfo = document.getElementById('account-info');
        this.loadingSpinner = document.getElementById('loading-spinner');
        // New forms
        this.changePasswordForm = document.getElementById('change-password-form');
        this.changeUsernameForm = document.getElementById('change-username-form');
        this.changeDisplaynameForm = document.getElementById('change-displayname-form');
        this.changeColorForm = document.getElementById('change-color-form');
        this.deleteAccountForm = document.getElementById('delete-account-form');

        if (!this.registerForm || !this.loginForm || !this.accountInfo || !this.loadingSpinner || 
            !this.changePasswordForm || !this.changeUsernameForm || !this.changeDisplaynameForm || !this.changeColorForm ||
            !this.deleteAccountForm
        ) {
            console.error("Account system UI elements not found in the DOM. Aborting initialization.");
            return;
        }

        this.loadingSpinner.style.display = 'block';
        try {
            await this.initFirebase();
            await this.checkSession();
            this.attachEventListeners();
        } finally {
            this.updateUI();
        }
    }

    async checkSession() {
        const storedUser = localStorage.getItem('loggedInUser');
        if (storedUser) {
            try {
                // We only get the UID from localStorage to identify the user.
                const sessionData = JSON.parse(storedUser);
                if (!sessionData.uid) {
                    throw new Error("Session data is invalid (missing UID).");
                }

                // Always fetch the latest user data from Firebase to ensure consistency
                // and fix any bad data (like encoded passwords) in localStorage.
                const userRef = this.db.ref(`site_users/${sessionData.uid}`);
                const snapshot = await userRef.get();

                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    const plainPassword = atob(userData.password);
                    
                    // Reconstruct the user object for the session with the decoded password.
                    this.user = { ...userData, password: plainPassword };

                    // Update localStorage with the fresh, correct data.
                    localStorage.setItem('loggedInUser', JSON.stringify(this.user));
                    console.log('Session refreshed from DB for user:', this.user.username);
                } else {
                    throw new Error("User not found in database.");
                }
            } catch (e) {
                console.error('Failed to restore session:', e.message);
                localStorage.removeItem('loggedInUser');
                this.user = null; // Ensure user is null on error
            }
        }
    }

    async initFirebase() {
        const firebaseConfig = {
            apiKey: "API_KEY",
            authDomain: "med-student-chat.firebaseapp.com",
            databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "med-student-chat",
            storageBucket: "med-student-chat.appspot.com",
            messagingSenderId: "SENDER_ID",
            appId: "APP_ID"
        };

        try {
            // Using compat scripts, the API is namespaced on the global `firebase` object.
            if (typeof firebase === 'undefined' || !firebase.initializeApp || !firebase.database) {
                throw new Error("Firebase compat SDK not loaded correctly.");
            }

            // Initialize app using compat syntax
            const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
            // Get the database service instance, which has the ref() method
            this.db = firebase.database();
        } catch (e) {
            console.error("Failed to load or initialize Firebase:", e);
            this.showError('register-error', e.message || 'Грешка при инициализация на системата.');
            this.showError('login-error', e.message || 'Грешка при инициализация на системата.');
        }
    }

    attachEventListeners() {
        document.getElementById('show-login').addEventListener('click', () => this.showForm('login'));
        document.getElementById('show-register').addEventListener('click', () => this.showForm('register'));

        document.getElementById('registration-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const displayName = document.getElementById('register-displayname').value;
            const password = document.getElementById('register-password').value;
            this.register(username, displayName, password);
        });

        document.getElementById('login-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            this.login(username, password);
        });

        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('show-delete-account-btn').addEventListener('click', () => this.showForm('delete-account'));

        // Show action forms
        document.getElementById('show-change-password-btn').addEventListener('click', () => this.showForm('change-password'));
        document.getElementById('show-change-username-btn').addEventListener('click', () => this.showForm('change-username'));
        document.getElementById('show-change-displayname-btn').addEventListener('click', () => this.showForm('change-displayname'));
        document.getElementById('show-change-color-btn').addEventListener('click', () => {
            document.getElementById('new-color').value = this.user.color || '#7c3aed';
            this.showForm('change-color');
        });

        // Cancel buttons
        document.querySelectorAll('.cancel-action-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showForm('account'));
        });

        // Form submissions for actions
        document.getElementById('change-password-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            this.changePassword(newPassword, confirmPassword);
        });

        document.getElementById('change-username-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const newUsername = document.getElementById('new-username').value;
            const password = document.getElementById('current-password-for-username').value;
            this.changeUsername(newUsername, password);
        });

        document.getElementById('change-displayname-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const newDisplayName = document.getElementById('new-displayname').value;
            this.changeDisplayName(newDisplayName);
        });

        document.getElementById('change-color-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const newColor = document.getElementById('new-color').value;
            this.changeColor(newColor);
        });

        document.getElementById('delete-account-form-element').addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('password-for-delete').value;
            this.deleteAccount(password);
        });
    }

    async register(username, displayName, password) {
        if (!username || !displayName || !password) {
            this.showError('register-error', 'Моля, попълнете всички полета.');
            return;
        }
        if (password.length < 4) {
            this.showError('register-error', 'Паролата трябва да е поне 4 символа.');
            return;
        }
        if (/[.#$[\]/]/.test(username)) {
            this.showError('register-error', 'Името съдържа невалидни символи (.#$[]/).');
            return;
        }
        if (/[.#$[\]/]/.test(displayName)) {
            this.showError('register-error', 'Името за показване съдържа невалидни символи (.#$[]/).');
            return;
        }
        this.loadingSpinner.style.display = 'block';
        this.showForm(null); // Hide all forms while loading
        this.hideError('register-error');

        try {
            // 1. Check if username is already taken by querying
            const usersRef = this.db.ref('site_users');
            const snapshot = await usersRef.orderByChild('username').equalTo(username).get();

            if (snapshot.exists()) {
                this.showError('register-error', 'Потребителското име е заето.');
            } else {
                // 2. Create new user with a unique ID generated by Firebase
                const newUserRef = usersRef.push();
                const newUid = newUserRef.key;

                const newUserDbData = {
                    uid: newUid, // Store the permanent ID inside the object as well
                    username: username,
                    displayName: displayName,
                    password: btoa(password), // Simple encoding, NOT for security
                    color: this.generateRandomColor(),
                    createdAt: Date.now()
                };

                await newUserRef.set(newUserDbData);

                // For the session, use the decoded password
                this.user = { ...newUserDbData, password: password };
                localStorage.setItem('loggedInUser', JSON.stringify(this.user));
                console.log('Успешна регистрация:', username);
            }
        } catch (error) {
            console.error("Registration error:", error);
            this.showError('register-error', 'Възникна грешка при регистрация.');
        } finally {
            this.updateUI();
        }
    }

    async login(username, password) {
        if (!username || !password) {
            this.showError('login-error', 'Моля, попълнете всички полета.');
            return;
        }
        this.loadingSpinner.style.display = 'block';
        this.showForm(null); // Hide all forms while loading
        this.hideError('login-error');

        try {
            const usersRef = this.db.ref('site_users');
            const snapshot = await usersRef.orderByChild('username').equalTo(username).get();

            if (!snapshot.exists()) {
                this.showError('login-error', 'Грешно потребителско име или парола.');
            } else {
                let userData = null;
                let userKey = null;
                // The query returns an object with the unique keys of the matches
                snapshot.forEach(childSnapshot => {
                    // We only expect one match since usernames should be unique
                    userData = childSnapshot.val();
                    userKey = childSnapshot.key;
                });

                // MIGRATION: If user object is old (no UID field), migrate it to the new structure.
                if (userData && !userData.uid) {
                    console.log(`Migrating old user account: ${userKey}`);
                    const newUid = this.db.ref('site_users').push().key;
                    
                    const migratedUserData = {
                        ...userData,
                        uid: newUid,
                        legacyUid: userKey // The old key was the username, which is the legacy ID now.
                    };

                    const updates = {};
                    updates[`/site_users/${newUid}`] = migratedUserData;
                    updates[`/site_users/${userKey}`] = null; // Delete old record

                    await this.db.ref().update(updates);

                    // For the rest of this login session, use the migrated data
                    userData = migratedUserData;
                    userKey = newUid;
                    console.log(`User ${migratedUserData.username} migrated to new UID: ${newUid} with legacy UID: ${migratedUserData.legacyUid}`);
                }

                const storedPassword = atob(userData.password);

                if (password === storedPassword) {
                    const userColor = userData.color || this.generateRandomColor();
                    // The permanent UID is the key of the record in the database
                    // After migration, userData contains the full new object.
                    this.user = { ...userData, password: storedPassword, color: userColor };
                    localStorage.setItem('loggedInUser', JSON.stringify(this.user));
                    console.log('Успешен вход:', this.user.username);

                    // If user had no color, save the new one to DB
                    if (!userData.color) {
                        await this.db.ref(`site_users/${userKey}`).update({ color: userColor });
                    }
                } else {
                    this.showError('login-error', 'Грешно потребителско име или парола.');
                }
            }
        } catch (error) {
            console.error("Login error:", error);
            this.showError('login-error', 'Възникна грешка при вход.');
        } finally {
            this.updateUI();
        }
    }

    async logout() {
        this.user = null;
        localStorage.removeItem('loggedInUser');
        console.log('Успешен изход.');
        this.updateUI();
    }

    async changePassword(newPassword, confirmPassword) {
        if (newPassword !== confirmPassword) {
            this.showError('change-password-error', 'Паролите не съвпадат.');
            return;
        }
        if (newPassword.length < 4) {
            this.showError('change-password-error', 'Паролата трябва да е поне 4 символа.');
            return;
        }
        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-password-error');

        try {
            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.update({
                password: btoa(newPassword)
            });
            this.user.password = newPassword;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));
            this.showForm('account');
        } catch (error) {
            console.error("Password change error:", error);
            this.showError('change-password-error', 'Възникна грешка при смяна на паролата.');
            this.showForm('change-password');
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async changeUsername(newUsername, password) {
        if (!newUsername || !password) {
            this.showError('change-username-error', 'Моля, попълнете всички полета.');
            return;
        }
        if (/[.#$[\]/]/.test(newUsername)) {
            this.showError('change-username-error', 'Новото име съдържа невалидни символи (.#$[]/).');
            return;
        }
        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-username-error');

        try {
            // 1. Check if new username is already taken by another user
            const usersRef = this.db.ref('site_users');
            const snapshot = await usersRef.orderByChild('username').equalTo(newUsername).get();
            if (snapshot.exists()) {
                this.showError('change-username-error', 'Потребителското име е заето.');
                this.loadingSpinner.style.display = 'none';
                this.showForm('change-username');
                return;
            }

            // 2. Verify current password
            const currentUserRef = this.db.ref(`site_users/${this.user.uid}`);
            const currentUserSnapshot = await currentUserRef.get();
            if (!currentUserSnapshot.exists()) {
                throw new Error("Текущият потребител не е намерен в базата данни. Моля, влезте отново.");
            }
            const userData = currentUserSnapshot.val();
            if (atob(userData.password) !== password) {
                this.showError('change-username-error', 'Грешна парола.');
                this.loadingSpinner.style.display = 'none';
                this.showForm('change-username');
                return;
            }

            // 3. Update the username field. The UID (the key) remains the same.
            await currentUserRef.update({ username: newUsername });

            // 4. Update local state
            this.user.username = newUsername;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));

            this.updateUI();

        } catch (error) {
            console.error("Username change error:", error);
            this.showError('change-username-error', 'Възникна грешка при смяна на потребителското име.');
            this.updateUI();
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async changeDisplayName(newDisplayName) {
        if (!newDisplayName) {
            this.showError('change-displayname-error', 'Името за показване не може да е празно.');
            return;
        }
        if (/[.#$[\]/]/.test(newDisplayName)) {
            this.showError('change-displayname-error', 'Името за показване съдържа невалидни символи (.#$[]/).');
            return;
        }
        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-displayname-error');

        try {
            const oldDisplayName = this.user.displayName;

            if (oldDisplayName === newDisplayName) {
                this.updateUI(); // No change needed, just refresh UI and exit
                return;
            }

            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.update({ displayName: newDisplayName });

            this.user.displayName = newDisplayName;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));

            // Update name mappings to handle name changes and reclaiming old names.
            if (oldDisplayName) {
                const updates = {};
                // If the new name was a key in a previous mapping, delete that mapping. This prevents cycles.
                updates[`/name_mappings/${newDisplayName}`] = null;
                // Create a mapping from the old name to the new one.
                updates[`/name_mappings/${oldDisplayName}`] = newDisplayName;

                await this.db.ref().update(updates);
            }

            this.updateUI();
        } catch (error) {
            console.error("Display name change error:", error);
            this.showError('change-displayname-error', 'Възникна грешка.');
            this.updateUI();
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async changeColor(newColor) {
        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-color-error');

        try {
            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.update({ color: newColor });

            this.user.color = newColor;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));
            
            this.updateUI();
        } catch (error) {
            console.error("Color change error:", error);
            this.showError('change-color-error', 'Възникна грешка.');
            this.updateUI();
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async deleteAccount(password) {
        if (!password) {
            this.showError('delete-account-error', 'Моля, въведете паролата си.');
            return;
        }
        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('delete-account-error');

        try {
            // 1. Verify password from local state (already fetched on session check)
            if (password !== this.user.password) {
                this.showError('delete-account-error', 'Грешна парола.');
                this.loadingSpinner.style.display = 'none';
                this.showForm('delete-account');
                return;
            }

            // 2. Delete user from Firebase
            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.remove();

            // 3. Logout
            this.logout(); // This will clear localStorage and update UI to login form

        } catch (error) {
            console.error("Account deletion error:", error);
            this.showError('delete-account-error', 'Възникна грешка при изтриване на акаунта.');
            this.updateUI(); // Go back to profile view on error
        }
    }

    // --- UI Helper Functions ---

    updateUI() {
        this.loadingSpinner.style.display = 'none';
        if (this.user) {
            document.getElementById('user-displayname').textContent = this.user.displayName || 'Няма';
            document.getElementById('user-username').textContent = this.user.username || 'Няма';
            document.getElementById('user-password').textContent = this.user.password || '••••••••';
            document.getElementById('user-uid').textContent = this.user.uid || 'Няма';
            const colorPreview = document.getElementById('user-color-preview');
            if (colorPreview) {
                colorPreview.style.backgroundColor = this.user.color || '#ccc';
            }
            this.showForm('account');
        } else {
            this.showForm('login');
        }
    }

    showForm(formId) {
        // Hide all forms first
        this.registerForm.style.display = 'none';
        this.loginForm.style.display = 'none';
        this.accountInfo.style.display = 'none';
        this.changePasswordForm.style.display = 'none';
        this.changeUsernameForm.style.display = 'none';
        this.changeDisplaynameForm.style.display = 'none';
        this.changeColorForm.style.display = 'none';
        this.deleteAccountForm.style.display = 'none';

        // Show the correct one
        if (formId === 'register') {
            this.registerForm.style.display = 'block';
        } else if (formId === 'login') {
            this.loginForm.style.display = 'block';
        } else if (formId === 'account') {
            this.accountInfo.style.display = 'block';
        } else if (formId === 'change-password') {
            this.changePasswordForm.style.display = 'block';
        } else if (formId === 'change-username') {
            this.changeUsernameForm.style.display = 'block';
        } else if (formId === 'change-displayname') {
            this.changeDisplaynameForm.style.display = 'block';
        } else if (formId === 'change-color') {
            this.changeColorForm.style.display = 'block';
        } else if (formId === 'delete-account') {
            this.deleteAccountForm.style.display = 'block';
        }
    }

    showError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    hideError(elementId) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    generateRandomColor() {
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE',
          '#FF8B94', '#6BCB77', '#4D96FF', '#FFD93D', '#6A4C93', '#FF6B9D', '#C06C84',
          '#FF9671', '#FFC75F', '#F9F871', '#845EC2', '#2C73D2', '#00B0FF', '#FB5607',
          '#7209B7', '#3A0CA3', '#560BAD', '#B5179E', '#F72585', '#4CC9F0', '#72DDF7',
          '#90E0EF', '#ADE8F7', '#CAF0F8', '#00D9FF', '#00BBF9', '#0096C7', '#023E8A'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}