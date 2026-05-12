// This class will manage user accounts using Firebase Realtime Database.
class AccountSystem {
    constructor() {
        this.db = null;
        this.user = null; // Custom user object: { uid (permanent), username (for login), displayName, color, preferredFont }
        this.defaultPreferredFont = 'open-sans';
        this.fontLabels = {
            'open-sans': 'Open Sans',
            'noto-sans': 'Noto Sans',
            'roboto': 'Roboto',
            'fira-sans': 'Fira Sans',
            'rubik': 'Rubik'
        };
        this.fontStacks = {
            'open-sans': "'Open Sans', Arial, sans-serif",
            'noto-sans': "'Noto Sans', Arial, sans-serif",
            'roboto': "'Roboto', Arial, sans-serif",
            'fira-sans': "'Fira Sans', Arial, sans-serif",
            'rubik': "'Rubik', Arial, sans-serif"
        };
        this.fontAliases = {
            'ibm-plex-sans': 'roboto',
            'pt-sans': 'fira-sans',
            'ubuntu': 'fira-sans'
        };

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
        this.changeFontForm = null;
        this.changeBannerForm = null;
        this.deleteAccountForm = null;
        this.bannerCropState = null;
        this.pendingBannerCrop = null;
    }

    // --- R2 image upload (avatars/banners) ---
    // Uploads via the existing Cloudflare worker used by chat/notes. Returns the
    // public URL stored on `site_users/<uid>.avatar` / `.banner` (no base64 in DB).
    async uploadProfileImageToR2(blob, kind) {
        if (!blob) throw new Error('No image to upload');
        const uid = (this.user && this.user.uid) || 'unknown';
        const type = blob.type || 'image/jpeg';
        const ext = (type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '');
        const fileName = `${uid}-${Date.now()}.${ext}`;
        const path = `${kind}s/${fileName}`;
        const file = blob instanceof File ? blob : new File([blob], fileName, { type });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);
        formData.append('userName', (this.user && (this.user.userName || this.user.username)) || 'user');

        const response = await fetch('https://r2-upload.sergey-2210-pavlov.workers.dev', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text || 'Image upload failed');
        }
        const data = await response.json();
        if (!data || !data.url) throw new Error('Upload succeeded but no URL was returned');
        return data.url;
    }

    canvasToBlob(canvas, type = 'image/jpeg', quality = 0.9) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to encode image'));
            }, type, quality);
        });
    }

    async dataUrlToBlob(dataUrl) {
        const r = await fetch(dataUrl);
        return await r.blob();
    }

    decodeStoredPassword(passwordValue) {
        if (typeof passwordValue !== 'string') {
            return '';
        }

        // Support legacy plain-text records while preferring base64-encoded values.
        try {
            return atob(passwordValue);
        } catch (error) {
            return passwordValue;
        }
    }

    normalizePreferredFont(preferredFontValue) {
        const rawKey = (preferredFontValue || this.defaultPreferredFont).toString().trim().toLowerCase();
        const normalized = this.fontAliases[rawKey] || rawKey;
        return this.fontLabels[normalized] ? normalized : this.defaultPreferredFont;
    }

    getCoursesHomeUrl() {
        return 'index.html';
    }

    applyFontPreview(fontKey) {
        const previewWrap = document.getElementById('font-preview-wrap');
        if (!previewWrap) return;
        const normalizedKey = this.normalizePreferredFont(fontKey);
        const stack = this.fontStacks[normalizedKey] || this.fontStacks[this.defaultPreferredFont];
        previewWrap.style.setProperty('--preview-font-family', stack);
    }

    async init() {
        const isLoginPage = window.location.pathname.endsWith('login.html');
        const isAccountPage = window.location.pathname.endsWith('account.html');

        this.loadingSpinner = document.getElementById('loading-spinner');

        if (isLoginPage) {
            this.loginForm = document.getElementById('login-form');
            if (!this.loginForm || !this.loadingSpinner) {
                console.error("Login page UI elements not found. Aborting.");
                return;
            }
        } else if (isAccountPage) {
            this.accountInfo = document.getElementById('account-info');
            this.changePasswordForm = document.getElementById('change-password-form');
            this.changeUsernameForm = document.getElementById('change-username-form');
            this.changeDisplaynameForm = document.getElementById('change-displayname-form');
            this.changeColorForm = document.getElementById('change-color-form');
            this.changeFontForm = document.getElementById('change-font-form');
            this.changeAvatarForm = document.getElementById('change-avatar-form');
            this.changeBannerForm = document.getElementById('change-banner-form');
            this.deleteAccountForm = document.getElementById('delete-account-form');

            if (!this.accountInfo || !this.loadingSpinner || !this.changePasswordForm || !this.changeUsernameForm || !this.changeDisplaynameForm || !this.changeColorForm || !this.changeFontForm || !this.changeAvatarForm || !this.changeBannerForm || !this.deleteAccountForm) {
                console.error("Account page UI elements not found. Aborting.");
                return;
            }
        } else {
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
                    const plainPassword = this.decodeStoredPassword(userData.password);
                    const preferredFont = this.normalizePreferredFont(userData.preferredFont);
                    
                    // Reconstruct the user object for the session with the decoded password.
                    this.user = { ...userData, password: plainPassword, preferredFont };

                    // Update localStorage with the fresh, correct data.
                    localStorage.setItem('loggedInUser', JSON.stringify(this.user));

                    if (!userData.preferredFont || preferredFont !== userData.preferredFont) {
                        await userRef.update({ preferredFont });
                    }
                    console.log('Session refreshed from DB for user:', this.user.username);
                } else { // Keep, error message
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
        const isLoginPage = window.location.pathname.endsWith('login.html');
        const isAccountPage = window.location.pathname.endsWith('account.html');

        if (isLoginPage) {
            const loginFormElement = document.getElementById('login-form-element');
            if (loginFormElement) {
                loginFormElement.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const username = document.getElementById('login-username').value;
                    const password = document.getElementById('login-password').value;
                    this.login(username, password);
                });
            }
        } else if (isAccountPage) {
            const showLoginBtn = document.getElementById('show-login');
            if (showLoginBtn) {
                showLoginBtn.addEventListener('click', () => this.showForm('login'));
            }

            const showRegisterBtn = document.getElementById('show-register');
            if (showRegisterBtn) {
                showRegisterBtn.addEventListener('click', () => this.showForm('register'));
            }

            const registerFormElement = document.getElementById('registration-form-element');
            if (registerFormElement) {
                registerFormElement.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const username = document.getElementById('register-username').value;
                    const displayName = document.getElementById('register-displayname').value;
                    const password = document.getElementById('register-password').value;
                    this.register(username, displayName, password);
                });
            }

            document.getElementById('show-delete-account-btn').addEventListener('click', () => this.showForm('delete-account'));

            // Show action forms
            document.getElementById('show-change-password-btn').addEventListener('click', () => this.showForm('change-password'));
            document.getElementById('show-change-username-btn').addEventListener('click', () => this.showForm('change-username'));
            document.getElementById('show-change-displayname-btn').addEventListener('click', () => this.showForm('change-displayname'));
            document.getElementById('show-change-color-btn').addEventListener('click', () => {
                document.getElementById('new-color').value = this.user.color || '#7c3aed';
                this.showForm('change-color');
            });
            document.getElementById('show-change-font-btn').addEventListener('click', () => {
                const fontSelect = document.getElementById('new-font');
                if (fontSelect) {
                    const normalizedKey = this.normalizePreferredFont(this.user.preferredFont);
                    fontSelect.value = normalizedKey;
                    this.applyFontPreview(normalizedKey);
                }
                this.showForm('change-font');
            });
            const fontSelect = document.getElementById('new-font');
            if (fontSelect) {
                fontSelect.addEventListener('change', () => {
                    this.applyFontPreview(fontSelect.value);
                });
            }
            document.getElementById('show-change-avatar-btn').addEventListener('click', () => this.showForm('change-avatar'));
            document.getElementById('show-change-banner-btn').addEventListener('click', () => {
                this.updateBannerPreview();
                this.showForm('change-banner');
            });
            const bannerFileInput = document.getElementById('new-banner-file');
            const bannerUrlInput = document.getElementById('new-banner-url');
            if (bannerFileInput) {
                bannerFileInput.addEventListener('change', () => this.previewBannerFile(bannerFileInput.files && bannerFileInput.files[0]));
            }
            if (bannerUrlInput) {
                bannerUrlInput.addEventListener('change', () => this.openBannerCropModal(bannerUrlInput.value.trim()));
            }
            this.initBannerCropModal();

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

            document.getElementById('change-font-form-element').addEventListener('submit', (e) => {
                e.preventDefault();
                const newFont = document.getElementById('new-font').value;
                this.changeFont(newFont);
            });

            document.getElementById('change-avatar-form-element').addEventListener('submit', (e) => {
                e.preventDefault();
                const fileInput = document.getElementById('new-avatar-file');
                const urlInput = document.getElementById('new-avatar-url');
                
                if (fileInput.files.length > 0) {
                    this.changeAvatar(fileInput.files[0]);
                } else if (urlInput.value.trim()) {
                    this.changeAvatar(urlInput.value.trim());
                } else {
                    this.showError('change-avatar-error', 'Моля, изберете файл или въведете URL.');
                }
            });

            document.getElementById('change-banner-form-element').addEventListener('submit', (e) => {
                e.preventDefault();
                const fileInput = document.getElementById('new-banner-file');
                const urlInput = document.getElementById('new-banner-url');

                if (this.pendingBannerCrop) {
                    this.changeBanner(this.pendingBannerCrop, true);
                } else if (fileInput.files.length > 0 || urlInput.value.trim()) {
                    this.showError('change-banner-error', 'Please choose the crop first.');
                } else {
                    this.showError('change-banner-error', 'Please choose an image file or enter an image URL.');
                }
            });

            document.getElementById('remove-banner-btn').addEventListener('click', () => this.changeBanner(null));

            document.getElementById('delete-account-form-element').addEventListener('submit', (e) => {
                e.preventDefault();
                const password = document.getElementById('password-for-delete').value;
                this.deleteAccount(password);
            });
        }
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
                    preferredFont: this.defaultPreferredFont,
                    createdAt: Date.now()
                };

                await newUserRef.set(newUserDbData);

                // For the session, use the decoded password
                this.user = { ...newUserDbData, password: password };
                localStorage.setItem('loggedInUser', JSON.stringify(this.user));
                // console.log('Успешна регистрация:', username); // Can be removed
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

                const storedPassword = this.decodeStoredPassword(userData.password);

                if (password === storedPassword) {
                    const userColor = userData.color || this.generateRandomColor();
                    // The permanent UID is the key of the record in the database
                    // After migration, userData contains the full new object.
                    const preferredFont = this.normalizePreferredFont(userData.preferredFont);
                    this.user = { ...userData, password: storedPassword, color: userColor, preferredFont };
                    localStorage.setItem('loggedInUser', JSON.stringify(this.user));

                    // Device tracking
                    let deviceId = localStorage.getItem('deviceId');
                    if (!deviceId) {
                        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
                        localStorage.setItem('deviceId', deviceId);
                    }
                    const deviceRef = this.db.ref(`site_users/${userKey}/devices/${deviceId}`);
                    deviceRef.set({ lastLogin: Date.now() });

                    window.location.href = this.getCoursesHomeUrl(); // Redirect to courses page

                    // If user had no color, save the new one to DB
                    if (!userData.color) {
                        await this.db.ref(`site_users/${userKey}`).update({ color: userColor });
                    }
                    if (!userData.preferredFont || preferredFont !== userData.preferredFont) {
                        await this.db.ref(`site_users/${userKey}`).update({ preferredFont });
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
        window.location.href = 'login.html';
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
            if (this.decodeStoredPassword(userData.password) !== password) {
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

    async changeFont(newFont) {
        const normalizedFont = this.normalizePreferredFont(newFont);
        if (!this.fontLabels[normalizedFont]) {
            this.showError('change-font-error', 'Невалиден избор на шрифт.');
            return;
        }

        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-font-error');

        try {
            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.update({ preferredFont: normalizedFont });

            this.user.preferredFont = normalizedFont;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));

            this.updateUI();
        } catch (error) {
            console.error('Font change error:', error);
            this.showError('change-font-error', 'Възникна грешка.');
            this.updateUI();
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async changeAvatar(avatarSource) {
        if (!avatarSource) {
            this.showError('change-avatar-error', 'Моля, изберете изображение или въведете URL.');
            return;
        }

        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-avatar-error');

        try {
            // Both branches resolve to a resized Blob; we then upload to R2 and
            // store only the resulting URL on the user record.
            const resizeImgToBlob = (img) => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxSize = 150;
                if (width > height) {
                    if (width > maxSize) { height *= maxSize / width; width = maxSize; }
                } else {
                    if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                return this.canvasToBlob(canvas, 'image/jpeg', 0.9);
            };

            let avatarBlob;
            if (typeof avatarSource === 'string') {
                // URL input: probe without CORS, then re-load with CORS so we can resize via canvas.
                avatarBlob = await new Promise((resolve, reject) => {
                    const testImg = new Image();
                    testImg.onload = () => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => resizeImgToBlob(img).then(resolve, reject);
                        img.onerror = () => reject(new Error('Този сървър блокира обработката на изображения (CORS). Моля, изтеглете изображението и го качете като файл.'));
                        img.src = avatarSource;
                    };
                    testImg.onerror = () => reject(new Error('Не можа да се зареди изображението от URL. Проверете дали е валидно и достъпно.'));
                    testImg.src = avatarSource;
                });
            } else {
                const file = avatarSource;
                if (file.size > 2 * 1024 * 1024) {
                    throw new Error('Файлът е твърде голям (макс 2MB).');
                }
                avatarBlob = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (readerEvent) => {
                        const img = new Image();
                        img.onload = () => resizeImgToBlob(img).then(resolve, reject);
                        img.onerror = () => reject(new Error('Невалидно изображение.'));
                        img.src = readerEvent.target.result;
                    };
                    reader.onerror = () => reject(new Error('Грешка при четене на файла.'));
                    reader.readAsDataURL(file);
                });
            }

            const finalAvatar = await this.uploadProfileImageToR2(avatarBlob, 'avatar');

            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.update({ avatar: finalAvatar });

            this.user.avatar = finalAvatar;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));
            
            // Clear inputs
            document.getElementById('new-avatar-file').value = '';
            document.getElementById('new-avatar-url').value = '';
            
            this.updateUI();

        } catch (error) {
            console.error("Avatar change error:", error);
            this.showError('change-avatar-error', error.message || 'Възникна грешка при качване.');
            this.showForm('change-avatar');
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    async changeBanner(bannerSource, alreadyProcessed = false) {
        this.loadingSpinner.style.display = 'block';
        this.showForm(null);
        this.hideError('change-banner-error');

        try {
            let finalBanner;
            if (!bannerSource) {
                finalBanner = null;
            } else if (alreadyProcessed) {
                // `bannerSource` is the cropped JPEG data URL from renderBannerCropToDataUrl.
                // Convert to a Blob, upload to R2, store the resulting URL.
                const blob = await this.dataUrlToBlob(bannerSource);
                finalBanner = await this.uploadProfileImageToR2(blob, 'banner');
            } else {
                // Opens the crop modal and throws — user must crop first.
                finalBanner = await this.renderBannerSourceToCrop(bannerSource);
            }
            const userRef = this.db.ref(`site_users/${this.user.uid}`);
            await userRef.update({ banner: finalBanner });

            this.user.banner = finalBanner;
            localStorage.setItem('loggedInUser', JSON.stringify(this.user));

            const fileInput = document.getElementById('new-banner-file');
            const urlInput = document.getElementById('new-banner-url');
            if (fileInput) fileInput.value = '';
            if (urlInput) urlInput.value = '';
            this.pendingBannerCrop = null;
            this.resetBannerCropControls();

            this.updateUI();
        } catch (error) {
            console.error("Banner change error:", error);
            this.showError('change-banner-error', error.message || 'Could not save the banner image.');
            this.showForm('change-banner');
            this.updateBannerPreview();
        } finally {
            this.loadingSpinner.style.display = 'none';
        }
    }

    updateBannerPreview() {
        const profilePreview = document.getElementById('user-banner-preview');
        const formPreview = document.getElementById('current-banner-preview');
        const banner = this.user && this.user.banner ? this.user.banner : '';
        const color = this.user && this.user.color ? this.user.color : '#588157';

        if (profilePreview) {
            profilePreview.style.backgroundImage = banner ? `url("${banner}")` : 'none';
            profilePreview.style.backgroundColor = banner ? 'transparent' : color;
        }

        if (formPreview) {
            formPreview.style.display = banner ? 'block' : 'none';
            formPreview.style.backgroundImage = banner ? `url("${banner}")` : 'none';
            formPreview.style.backgroundPosition = 'center';
            formPreview.style.backgroundSize = 'cover';
        }
    }

    previewBannerFile(file) {
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
            this.showError('change-banner-error', 'Banner image is too large. Maximum size is 4MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => this.openBannerCropModal(event.target.result);
        reader.onerror = () => this.showError('change-banner-error', 'Could not read the banner file.');
        reader.readAsDataURL(file);
    }

    async renderBannerSourceToCrop(src) {
        this.openBannerCropModal(src);
        throw new Error('Please choose the crop first.');
    }

    initBannerCropModal() {
        const modal = document.getElementById('banner-crop-modal');
        const stage = document.getElementById('banner-crop-stage');
        const image = document.getElementById('banner-crop-image');
        const zoom = document.getElementById('banner-modal-zoom');
        const applyBtn = document.getElementById('apply-banner-crop-btn');
        const cancelBtn = document.getElementById('cancel-banner-crop-btn');
        if (!modal || !stage || !image || !zoom || !applyBtn || !cancelBtn) return;

        zoom.addEventListener('input', () => {
            if (!this.bannerCropState) return;
            this.setBannerCropZoom(Number(zoom.value) || 1);
        });

        let dragState = null;
        const activePointers = new Map();
        let pinchState = null;
        const pointerDistance = () => {
            const points = Array.from(activePointers.values());
            if (points.length < 2) return 0;
            return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        };
        stage.addEventListener('pointerdown', (event) => {
            if (!this.bannerCropState) return;
            stage.setPointerCapture(event.pointerId);
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (activePointers.size >= 2) {
                pinchState = {
                    distance: pointerDistance(),
                    zoom: this.bannerCropState.zoom
                };
                dragState = null;
            } else {
                dragState = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    offsetX: this.bannerCropState.offsetX,
                    offsetY: this.bannerCropState.offsetY
                };
            }
        });

        stage.addEventListener('pointermove', (event) => {
            if (!this.bannerCropState || !activePointers.has(event.pointerId)) return;
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pinchState && activePointers.size >= 2) {
                const nextDistance = pointerDistance();
                if (pinchState.distance > 0 && nextDistance > 0) {
                    this.setBannerCropZoom(pinchState.zoom * (nextDistance / pinchState.distance));
                }
                return;
            }
            if (!dragState || dragState.pointerId !== event.pointerId) return;
            this.bannerCropState.offsetX = dragState.offsetX + event.clientX - dragState.startX;
            this.bannerCropState.offsetY = dragState.offsetY + event.clientY - dragState.startY;
            this.clampBannerCropOffset();
            this.renderBannerCropModal();
        });

        const endDrag = (event) => {
            activePointers.delete(event.pointerId);
            if (dragState && dragState.pointerId === event.pointerId) dragState = null;
            if (activePointers.size < 2) pinchState = null;
        };
        stage.addEventListener('pointerup', endDrag);
        stage.addEventListener('pointercancel', endDrag);
        stage.addEventListener('wheel', (event) => {
            if (!this.bannerCropState) return;
            event.preventDefault();
            const direction = event.deltaY > 0 ? -1 : 1;
            this.setBannerCropZoom(this.bannerCropState.zoom + direction * 0.08);
        }, { passive: false });

        applyBtn.addEventListener('click', () => this.applyBannerCropFromModal());
        cancelBtn.addEventListener('click', () => this.closeBannerCropModal());
        modal.addEventListener('click', (event) => {
            if (event.target === modal) this.closeBannerCropModal();
        });
    }

    openBannerCropModal(src) {
        const modal = document.getElementById('banner-crop-modal');
        const stage = document.getElementById('banner-crop-stage');
        const image = document.getElementById('banner-crop-image');
        const zoom = document.getElementById('banner-modal-zoom');
        if (!modal || !stage || !image || !zoom || !src) return;

        this.hideError('change-banner-error');
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            const stageRect = stage.getBoundingClientRect();
            const frame = this.getBannerCropFrameRect();
            const baseScale = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
            const minZoom = 1;
            const maxZoom = 3;
            this.bannerCropState = {
                src,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                stageWidth: stageRect.width,
                stageHeight: stageRect.height,
                frame,
                baseScale,
                zoom: minZoom,
                minZoom,
                maxZoom,
                offsetX: 0,
                offsetY: 0
            };
            zoom.min = String(minZoom);
            zoom.max = String(maxZoom);
            zoom.step = '0.01';
            zoom.value = String(minZoom);
            this.renderBannerCropModal();
        };
        image.onerror = () => {
            this.closeBannerCropModal();
            this.showError('change-banner-error', 'Could not load this banner image.');
        };
        image.src = src;
    }

    closeBannerCropModal() {
        const modal = document.getElementById('banner-crop-modal');
        if (modal) {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
        }
    }

    setBannerCropZoom(nextZoom) {
        const state = this.bannerCropState;
        const zoom = document.getElementById('banner-modal-zoom');
        if (!state) return;
        state.zoom = Math.min(state.maxZoom, Math.max(state.minZoom, nextZoom));
        if (zoom) zoom.value = String(state.zoom);
        this.clampBannerCropOffset();
        this.renderBannerCropModal();
    }

    getBannerCropFrameRect() {
        const stage = document.getElementById('banner-crop-stage');
        const frameEl = stage ? stage.querySelector('.banner-crop-frame') : null;
        if (!stage || !frameEl) return { left: 0, top: 0, width: 640, height: 190 };
        const stageRect = stage.getBoundingClientRect();
        const frameRect = frameEl.getBoundingClientRect();
        return {
            left: frameRect.left - stageRect.left,
            top: frameRect.top - stageRect.top,
            width: frameRect.width,
            height: frameRect.height
        };
    }

    getBannerCropImageMetrics() {
        const state = this.bannerCropState;
        if (!state) return null;
        const scale = state.baseScale * state.zoom;
        const width = state.naturalWidth * scale;
        const height = state.naturalHeight * scale;
        const centerX = state.stageWidth / 2 + state.offsetX;
        const centerY = state.stageHeight / 2 + state.offsetY;
        return { scale, width, height, left: centerX - width / 2, top: centerY - height / 2 };
    }

    clampBannerCropOffset() {
        const state = this.bannerCropState;
        if (!state) return;
        state.stageWidth = document.getElementById('banner-crop-stage').clientWidth;
        state.stageHeight = document.getElementById('banner-crop-stage').clientHeight;
        state.frame = this.getBannerCropFrameRect();
        const metrics = this.getBannerCropImageMetrics();
        if (!metrics) return;

        const centerBaseX = state.stageWidth / 2;
        const centerBaseY = state.stageHeight / 2;
        const minCenterX = state.frame.left + state.frame.width - metrics.width / 2;
        const maxCenterX = state.frame.left + metrics.width / 2;
        const minCenterY = state.frame.top + state.frame.height - metrics.height / 2;
        const maxCenterY = state.frame.top + metrics.height / 2;
        const currentCenterX = centerBaseX + state.offsetX;
        const currentCenterY = centerBaseY + state.offsetY;
        state.offsetX = Math.min(maxCenterX, Math.max(minCenterX, currentCenterX)) - centerBaseX;
        state.offsetY = Math.min(maxCenterY, Math.max(minCenterY, currentCenterY)) - centerBaseY;
    }

    renderBannerCropModal() {
        const image = document.getElementById('banner-crop-image');
        const state = this.bannerCropState;
        const stage = document.getElementById('banner-crop-stage');
        if (!image || !state || !stage) return;
        state.stageWidth = stage.clientWidth;
        state.stageHeight = stage.clientHeight;
        state.frame = this.getBannerCropFrameRect();
        const scale = state.baseScale * state.zoom;
        image.style.width = `${state.naturalWidth}px`;
        image.style.height = `${state.naturalHeight}px`;
        image.style.transform = `translate(-50%, -50%) translate(${state.offsetX}px, ${state.offsetY}px) scale(${scale})`;
    }

    applyBannerCropFromModal() {
        try {
            const cropped = this.renderBannerCropToDataUrl();
            this.pendingBannerCrop = cropped;
            const formPreview = document.getElementById('current-banner-preview');
            if (formPreview) {
                formPreview.style.display = 'block';
                formPreview.style.backgroundImage = `url("${cropped}")`;
                formPreview.style.backgroundPosition = 'center';
                formPreview.style.backgroundSize = 'cover';
            }
            this.closeBannerCropModal();
        } catch (error) {
            this.showError('change-banner-error', error.message || 'Could not crop this image.');
            this.closeBannerCropModal();
        }
    }

    renderBannerCropToDataUrl() {
        const image = document.getElementById('banner-crop-image');
        const state = this.bannerCropState;
        this.clampBannerCropOffset();
        const metrics = this.getBannerCropImageMetrics();
        if (!image || !state || !metrics) throw new Error('No banner crop is selected.');

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 190;
        const ctx = canvas.getContext('2d');
        const sourceX = (state.frame.left - metrics.left) / metrics.scale;
        const sourceY = (state.frame.top - metrics.top) / metrics.scale;
        const sourceW = state.frame.width / metrics.scale;
        const sourceH = state.frame.height / metrics.scale;
        ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/jpeg', 0.9);
    }

    resetBannerCropControls() {
        this.pendingBannerCrop = null;
        this.closeBannerCropModal();
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
        if (this.loadingSpinner) this.loadingSpinner.style.display = 'none';
        
        const isLoginPage = window.location.pathname.endsWith('login.html');
        const isAccountPage = window.location.pathname.endsWith('account.html');

        if (this.user) {
            if (isAccountPage) {
                document.getElementById('user-displayname').textContent = this.user.displayName || 'Няма';
                document.getElementById('user-username').textContent = this.user.username || 'Няма';
                document.getElementById('user-password').textContent = this.user.password || '••••••••';
                document.getElementById('user-uid').textContent = this.user.uid || 'Няма';
                
                const colorPreview = document.getElementById('user-color-preview');
                if (colorPreview) {
                    colorPreview.style.backgroundColor = this.user.color || '#ccc';
                }
                this.updateBannerPreview();

                const fontValue = document.getElementById('user-font');
                if (fontValue) {
                    const fontKey = this.normalizePreferredFont(this.user.preferredFont);
                    fontValue.textContent = this.fontLabels[fontKey] || this.fontLabels[this.defaultPreferredFont];
                }

                const avatarPreview = document.getElementById('user-avatar-preview');
                if (avatarPreview) {
                    avatarPreview.src = this.user.avatar || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjY2NjIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PHBhdGggZD0iTTEyIDE2cy0yLTItNC0ybTggMHMtMiAyLTQgMiIvPjwvc3ZnPg=='; // Simple placeholder
                }

                this.showForm('account');
            }
        } else {
            if (isLoginPage) {
                this.showForm('login');
            }
        }
    }

    showForm(formId) {
        const isLoginPage = window.location.pathname.endsWith('login.html');
        const isAccountPage = window.location.pathname.endsWith('account.html');

        if (isLoginPage) {
            if (this.loginForm) this.loginForm.style.display = 'none';
            if (formId === 'login' && this.loginForm) {
                this.loginForm.style.display = 'block';
            }
        } else if (isAccountPage) {
            if (this.accountInfo) this.accountInfo.style.display = 'none';
            if (this.changePasswordForm) this.changePasswordForm.style.display = 'none';
            if (this.changeUsernameForm) this.changeUsernameForm.style.display = 'none';
            if (this.changeDisplaynameForm) this.changeDisplaynameForm.style.display = 'none';
            if (this.changeColorForm) this.changeColorForm.style.display = 'none';
            if (this.changeFontForm) this.changeFontForm.style.display = 'none';
            if (this.changeAvatarForm) this.changeAvatarForm.style.display = 'none';
            if (this.changeBannerForm) this.changeBannerForm.style.display = 'none';
            if (this.deleteAccountForm) this.deleteAccountForm.style.display = 'none';
            
            if (formId === 'account' && this.accountInfo) this.accountInfo.style.display = 'block';
            else if (formId === 'change-password' && this.changePasswordForm) this.changePasswordForm.style.display = 'block';
            else if (formId === 'change-username' && this.changeUsernameForm) this.changeUsernameForm.style.display = 'block';
            else if (formId === 'change-displayname' && this.changeDisplaynameForm) this.changeDisplaynameForm.style.display = 'block';
            else if (formId === 'change-color' && this.changeColorForm) this.changeColorForm.style.display = 'block';
            else if (formId === 'change-font' && this.changeFontForm) this.changeFontForm.style.display = 'block';
            else if (formId === 'change-avatar' && this.changeAvatarForm) this.changeAvatarForm.style.display = 'block';
            else if (formId === 'change-banner' && this.changeBannerForm) this.changeBannerForm.style.display = 'block';
            else if (formId === 'delete-account' && this.deleteAccountForm) this.deleteAccountForm.style.display = 'block';
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
