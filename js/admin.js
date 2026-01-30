(function() {
    if (!window.currentUserPromise) {
        console.error("currentUserPromise not found. Admin script cannot run.");
        return;
    }

    window.currentUserPromise.then(user => {
        if (!user || !user.isAdmin) {
            // The admin-guard should have already redirected, but as a fallback:
            console.warn("User is not an admin. Admin script will not run.");
            return;
        }

        // Re-add Firebase initialization
        const firebaseConfig = {
            apiKey: "API_KEY",
            authDomain: "med-student-chat.firebaseapp.com",
            databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "med-student-chat",
            storageBucket: "med-student-chat.appspot.com",
            messagingSenderId: "SENDER_ID",
            appId: "APP_ID"
        };

        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK not loaded.");
            return;
        }
        
        const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
        const db = firebase.database();

        const onlineUsersContainer = document.getElementById('online-users');
        const allUsersContainer = document.getElementById('all-users');
        const registrationForm = document.getElementById('registration-form-element');
        const modal = document.getElementById('edit-user-modal');
        const closeModalBtn = modal.querySelector('.close-button');
        const saveChangesBtn = document.getElementById('save-user-changes');
        const resetPasswordBtn = document.getElementById('reset-password');
        const notificationContainer = document.getElementById('notification-container');
        
        // HTML Priority Settings elements
        const htmlPriorityForm = document.getElementById('html-priority-form-element');
        const htmlPriorityInput1 = document.getElementById('html-priority-1');
        const htmlPriorityInput2 = document.getElementById('html-priority-2');
        const htmlPriorityInput3 = document.getElementById('html-priority-3');
        const htmlPriorityError = document.getElementById('html-priority-error');
        const browseButtons = document.querySelectorAll('.browse-btn');

        // File Browser Modal elements
        const fileBrowserModal = document.getElementById('fileBrowserModal');
        const closeFileBrowserBtn = document.getElementById('closeFileBrowserBtn');
        const fileSearchInput = document.getElementById('fileSearchInput');
        const fileListContainer = document.getElementById('fileListContainer'); // This now references the UL
        let currentInputForFileSelection = null; // To track which input field to populate

        // Helper functions
        function showNotification(message, isError = false) {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            if (isError) {
                notification.style.borderColor = '#cf6679';
            }
            notificationContainer.appendChild(notification);
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 3000);
        }
        
        function showError(elementId, message) {
            const errorEl = document.getElementById(elementId);
            if (errorEl) {
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            }
        }

        function hideError(elementId) {
            const errorEl = document.getElementById(elementId);
            if (errorEl) {
                errorEl.style.display = 'none';
            }
        }

        function generateRandomColor() {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
            return colors[Math.floor(Math.random() * colors.length)];
        }
        
        function generateRandomPassword() {
            const length = 8;
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let retVal = "";
            for (let i = 0, n = charset.length; i < length; ++i) {
                retVal += charset.charAt(Math.floor(Math.random() * n));
            }
            return retVal;
        }

        // Helper function to clean up file names
        function getCleanFileName(fileName) {
            // Remove common prefixes like "1-msg-", "2.1-msg-", etc.
            let cleanName = fileName.replace(/^[\d\.]+-msg-/, '');
            // Remove .html extension
            cleanName = cleanName.replace(/\.html$/, '');
            return cleanName;
        }

        // Helper function to check if a file is an HTML msg file
        function isHtmlMsgFile(file) {
            if (!file || !file.name || !file.path) return false;
            const fileName = file.name;
            const isMsg = fileName.includes('-msg-') || fileName.startsWith('msg-');
            const isHtml = file.path.endsWith('.html');
            return isMsg && isHtml;
        }

        // Helper function to convert full path to display format for input fields
        function getDisplayPath(fullPath) {
            // Example fullPath: "files/Вътрешни болести 1 ч/Пулмология/1-msg-Обективно изследване на белите дробове.html"
            const parts = fullPath.split('/');
            // Check if it's a valid path starting with 'files' and has enough parts
            if (parts.length >= 4 && parts[0] === 'files') { 
                const courseName = parts[1];
                const folderName = parts[2]; // This is the 'Course Folder'
                const fileNameWithPrefix = parts[parts.length - 1]; // Last part is the file name
                
                let cleanFileName = getCleanFileName(fileNameWithPrefix);

                // Use the desired format: "Course Name / Course Folder / Item Name"
                return `${courseName} / ${folderName} / ${cleanFileName}`;
            }
            // If the path is shorter (e.g., "files/Course/FileName.html") handle it as a fallback
            if (parts.length >= 3 && parts[0] === 'files') {
                const courseName = parts[1];
                const fileNameWithPrefix = parts[parts.length - 1];
                let cleanFileName = getCleanFileName(fileNameWithPrefix);
                return `${courseName} / ${cleanFileName}`;
            }

            return fullPath; // Fallback to full path if not in expected format
        }

        // --- File Browser Functions ---
        function buildFileList(filter = '') {
            fileListContainer.innerHTML = '';
            const lowerCaseFilter = filter.toLowerCase();
            let hasResults = false;

            if (!window.courses) {
                const noCourses = document.createElement('li');
                noCourses.textContent = 'Courses data not available.';
                fileListContainer.appendChild(noCourses);
                return;
            }

            window.courses.forEach(course => {
                const courseTitle = course.title;
                let courseHasResults = false;
                const courseItems = []; // Collect items for this course

                course.sections.forEach(section => {
                    const sectionName = section.name;
                    const sectionFiles = []; // Collect files for this section

                    // Process regular files that are "msg" types
                    if (section.files) {
                        section.files.forEach(file => {
                            if (isHtmlMsgFile(file) && (file.name.toLowerCase().includes(lowerCaseFilter) || file.path.toLowerCase().includes(lowerCaseFilter))) {
                                sectionFiles.push({ name: file.name, path: file.path });
                            }
                        });
                    }

                    // Process msgNotes files (if they exist and are distinct)
                    if (section.msgNotes) {
                        section.msgNotes.forEach(file => {
                            // Ensure no duplicates and apply the same "msg" filter
                            if (isHtmlMsgFile(file) && !sectionFiles.some(sf => sf.path === file.path) && (file.name.toLowerCase().includes(lowerCaseFilter) || file.path.toLowerCase().includes(lowerCaseFilter))) {
                                sectionFiles.push({ name: file.name, path: file.path });
                            }
                        });
                    }
                    
                    if (sectionFiles.length > 0) {
                        courseHasResults = true;
                        const sectionHeader = document.createElement('li');
                        sectionHeader.className = 'folder-header';
                        sectionHeader.textContent = `  ${sectionName}`;
                        courseItems.push(sectionHeader);

                        sectionFiles.forEach(file => {
                            const fileItem = document.createElement('li');
                            fileItem.className = 'file-item';
                            fileItem.dataset.path = file.path; // Store full path
                            // Use clean file name for display in the modal
                            fileItem.innerHTML = `<div class="file-item-name">${getCleanFileName(file.name)}</div>`;
                            courseItems.push(fileItem);
                        });
                    }
                });

                if (courseHasResults) {
                    hasResults = true;
                    const courseHeader = document.createElement('li');
                    courseHeader.className = 'course-header';
                    courseHeader.textContent = courseTitle;
                    fileListContainer.appendChild(courseHeader);
                    courseItems.forEach(item => fileListContainer.appendChild(item));
                }
            });

            if (!hasResults && lowerCaseFilter) {
                const noResults = document.createElement('li');
                noResults.textContent = 'No matching files found.';
                fileListContainer.appendChild(noResults);
            }
        }


        // --- Event Listeners ---

        // Register function
        async function register(username, displayName, password) {
            hideError('register-error');
            
            if (!username || !displayName || !password) {
                showError('register-error', 'All fields are required');
                return;
            }

            try {
                const usersRef = db.ref('site_users');
                const snapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
                
                if (snapshot.exists()) {
                    showError('register-error', 'Username already exists');
                    return;
                }

                const newUserRef = usersRef.push();
                const uid = newUserRef.key;
                const randomColor = generateRandomColor();

                await newUserRef.set({
                    username: username,
                    displayName: displayName,
                    password: password,
                    color: randomColor,
                    isAdmin: false,
                    createdAt: Date.now()
                });

                showNotification(`Account created successfully! Username: ${username}`);
                document.getElementById('registration-form-element').reset();
            } catch (error) {
                console.error('Registration error:', error);
                showError('register-error', 'Failed to create account: ' + error.message);
            }
        }

        // Registration form
        if(registrationForm) {
            registrationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const displayName = document.getElementById('register-displayname').value;
                const password = document.getElementById('register-password').value;
                register(username, displayName, password);
            });
        }


        // User Management Logic
        const usersRef = db.ref('site_users');
        usersRef.on('value', (snapshot) => {
            const users = snapshot.val();
            let html = '<ul>';
            for (const uid in users) {
                const user = users[uid];
                const displayName = user.displayName || user.username;
                const deviceCount = user.devices ? Object.keys(user.devices).length : 0;
                
                // Avatar HTML
                let avatarHtml;
                if (user.avatar) {
                    avatarHtml = `<img src="${user.avatar}" style="width:24px; height:24px; border-radius:50%; object-fit:cover; margin-right:8px; vertical-align:middle; border:1px solid #444;">`;
                } else {
                    avatarHtml = `<span style="display:inline-block; width:24px; height:24px; border-radius:50%; background-color:${user.color || '#ccc'}; color:white; text-align:center; line-height:24px; font-size:12px; font-weight:bold; margin-right:8px; vertical-align:middle;">${(user.username || "?").charAt(0).toUpperCase()}</span>`;
                }

                html += `<li style="display:flex; align-items:center; padding:8px;">
                    ${avatarHtml}
                    <div style="flex:1;">
                        <span style="font-weight:bold; color:${user.color || '#ccc'};">${user.username}</span> 
                        <span style="color:#888;">(${displayName})</span>
                        <span style="font-size:0.8em; color:#666; margin-left:10px;">${deviceCount} device(s)</span>
                    </div>
                    <button class="edit-user-btn" data-uid="${uid}">Edit</button>
                </li>`;
            }
            html += '</ul>';
            allUsersContainer.innerHTML = html;

            document.querySelectorAll('.edit-user-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const uid = e.target.dataset.uid;
                    const user = users[uid];
                    document.getElementById('edit-user-uid').value = uid;
                    document.getElementById('edit-username').value = user.username;
                    document.getElementById('edit-displayname').value = user.displayName;
                    modal.style.display = 'block';
                });
            });
        });
        
        closeModalBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (event) => {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }
        
        saveChangesBtn.onclick = async () => {
            const uid = document.getElementById('edit-user-uid').value;
            const newUsername = document.getElementById('edit-username').value;
            const newDisplayName = document.getElementById('edit-displayname').value;

            try {
                await db.ref(`site_users/${uid}`).update({
                    username: newUsername,
                    displayName: newDisplayName
                });
                showNotification('User updated successfully!');
                modal.style.display = 'none';
            } catch (error) {
                showError('edit-user-error', 'Failed to update user.');
                console.error(error);
            }
        };

        resetPasswordBtn.onclick = async () => {
            const uid = document.getElementById('edit-user-uid').value;
            if (!uid) {
                showError('edit-user-error', 'User ID is missing.');
                return;
            }
            const newPassword = generateRandomPassword();
            try {
                await db.ref(`site_users/${uid}`).update({
                    password: btoa(newPassword)
                });
                prompt("Password reset successfully. Please copy the new password:", newPassword);
                modal.style.display = 'none';
            } catch (error) {
                showError('edit-user-error', 'Failed to reset password: ' + (error.message || error));
                console.error(error);
            }
        };


        // Schedule Data (JSON) Management
        const scheduleJsonEditor = document.getElementById('schedule-json-editor');
        const loadScheduleJsonBtn = document.getElementById('load-schedule-json');
        const saveScheduleJsonBtn = document.getElementById('save-schedule-json');
        const scheduleJsonRef = db.ref('/settings/scheduleData');

        // Load from Firebase
        loadScheduleJsonBtn.addEventListener('click', async () => {
            try {
                const snapshot = await scheduleJsonRef.once('value');
                const data = snapshot.val();
                if (data) {
                    scheduleJsonEditor.value = JSON.stringify(data, null, 2);
                    showNotification('Schedule data loaded from Firebase.');
                } else {
                    showNotification('No schedule data found in Firebase.', true);
                }
                hideError('schedule-json-error');
            } catch (error) {
                console.error("Error loading schedule data:", error);
                showError('schedule-json-error', 'Failed to load schedule data: ' + error.message);
            }
        });

        // Save to Firebase
        saveScheduleJsonBtn.addEventListener('click', async () => {
            const content = scheduleJsonEditor.value;
            try {
                const parsedData = JSON.parse(content);
                await scheduleJsonRef.set(parsedData);
                showNotification('Schedule data saved to Firebase successfully!');
                hideError('schedule-json-error');
            } catch (error) {
                console.error("Error saving schedule data:", error);
                if (error instanceof SyntaxError) {
                    showError('schedule-json-error', 'Invalid JSON format: ' + error.message);
                } else {
                    showError('schedule-json-error', 'Failed to save schedule data: ' + error.message);
                }
            }
        });


        // HTML Priority Settings Logic
        const htmlPriorityRef = db.ref('/settings/html_priority');
        htmlPriorityRef.on('value', (snapshot) => {
            const prioritySettings = snapshot.val();
            if (prioritySettings) {
                // When loading, set the display path to value, and full path to data-full-path
                htmlPriorityInput1.value = getDisplayPath(prioritySettings['1'] || '');
                htmlPriorityInput1.dataset.fullPath = prioritySettings['1'] || '';
                htmlPriorityInput2.value = getDisplayPath(prioritySettings['2'] || '');
                htmlPriorityInput2.dataset.fullPath = prioritySettings['2'] || '';
                htmlPriorityInput3.value = getDisplayPath(prioritySettings['3'] || '');
                htmlPriorityInput3.dataset.fullPath = prioritySettings['3'] || '';
            } else {
                htmlPriorityInput1.value = '';
                htmlPriorityInput1.dataset.fullPath = '';
                htmlPriorityInput2.value = '';
                htmlPriorityInput2.dataset.fullPath = '';
                htmlPriorityInput3.value = '';
                htmlPriorityInput3.dataset.fullPath = '';
            }
            // If value is empty, display 'Select file...'
            if (!htmlPriorityInput1.value) htmlPriorityInput1.value = 'Select file...';
            if (!htmlPriorityInput2.value) htmlPriorityInput2.value = 'Select file...';
            if (!htmlPriorityInput3.value) htmlPriorityInput3.value = 'Select file...';
        });

        htmlPriorityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPrioritySettings = {
                1: htmlPriorityInput1.dataset.fullPath, // Save full path from data attribute
                2: htmlPriorityInput2.dataset.fullPath,
                3: htmlPriorityInput3.dataset.fullPath
            };
            try {
                await htmlPriorityRef.set(newPrioritySettings);
                showNotification('HTML Priority settings saved successfully!');
                hideError('html-priority-error');
            } catch (error) {
                showError('html-priority-error', 'Failed to save HTML Priority settings.');
                console.error(error);
            }
        });

        // File Browser Event Listeners
        browseButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                currentInputForFileSelection = document.getElementById(e.target.dataset.targetInput);
                buildFileList();
                fileBrowserModal.style.display = 'flex';
            });
        });

        closeFileBrowserBtn.onclick = () => fileBrowserModal.style.display = 'none';
        fileBrowserModal.addEventListener('click', (event) => {
            if (event.target === fileBrowserModal) {
                fileBrowserModal.style.display = 'none';
            }
        });

        fileSearchInput.addEventListener('keyup', () => {
            buildFileList(fileSearchInput.value);
        });

        fileListContainer.addEventListener('click', (e) => {
            let target = e.target;
            // Traverse up to find the li.file-item
            while (target && !target.classList.contains('file-item')) {
                target = target.parentNode;
            }
            if (target && target.classList.contains('file-item') && currentInputForFileSelection) {
                currentInputForFileSelection.value = getDisplayPath(target.dataset.path); // Display friendly path
                currentInputForFileSelection.dataset.fullPath = target.dataset.path; // Store full path
                fileBrowserModal.style.display = 'none';
                currentInputForFileSelection = null; // Clear selection
            }
        });


        // Online Users Logic - Refactored to include guest users
        const siteUsersRef = db.ref('site_users');
        const onlineUsersRef = db.ref('online_users'); // Authenticated users
        const onlineGuestsRef = db.ref('online_guests'); // Guest users

        let allSiteUsers = {};
        let allOnlineAuthData = {};
        let allOnlineGuestData = {};

        function processAndDisplayOnlineUsers() {
            onlineUsersContainer.innerHTML = '<ul></ul>';
            const ul = onlineUsersContainer.querySelector('ul');
            const allOnline = {}; // Consolidated list of all online users

            // Add authenticated online users
            for (const uid in allOnlineAuthData) {
                const devices = allOnlineAuthData[uid];
                const deviceCount = Object.keys(devices).length;
                let hasMobile = false;
                if (deviceCount > 0) {
                    hasMobile = Object.values(devices).some(device => device.isMobile === true);
                }

                const userProfile = allSiteUsers[uid];
                if (userProfile) {
                    allOnline[uid] = {
                        userId: uid,
                        userName: userProfile.displayName || userProfile.username,
                        color: userProfile.color,
                        avatar: userProfile.avatar, // Add avatar
                        deviceCount: deviceCount,
                        hasMobile: hasMobile,
                        isGuest: false
                    };
                } else {
                    // Fallback for authenticated users whose profile might be missing
                    allOnline[uid] = {
                        userId: uid,
                        userName: `Unknown User (${uid})`,
                        color: '#cccccc',
                        deviceCount: deviceCount,
                        hasMobile: hasMobile,
                        isGuest: false
                    };
                }
            }

            // Add guest online users
            for (const guestId in allOnlineGuestData) {
                const devices = allOnlineGuestData[guestId];
                const deviceCount = Object.keys(devices).length;
                let hasMobile = false;
                if (deviceCount > 0) {
                    hasMobile = Object.values(devices).some(device => device.isMobile === true);
                }

                // Guest userName is stored directly in deviceData by presence.js
                const sampleDeviceData = devices[Object.keys(devices)[0]]; // Get data from one device
                const guestUserName = sampleDeviceData.userName || `Guest-${guestId.substring(6, 10)}`;

                allOnline[guestId] = {
                    userId: guestId,
                    userName: guestUserName,
                    color: '#9E9E9E', // Default grey for guests
                    deviceCount: deviceCount,
                    hasMobile: hasMobile,
                    isGuest: true
                };
            }

            // Convert to array and sort
            const sortedOnlineUsers = Object.values(allOnline).sort((a, b) => {
                const currentAdminId = window.currentUser ? window.currentUser.userId : null;

                // 1. Current Admin always on top
                if (currentAdminId && a.userId === currentAdminId) return -1;
                if (currentAdminId && b.userId === currentAdminId) return 1;

                // 2. Guests next (if not the admin)
                if (a.isGuest && !b.isGuest) return -1;
                if (!a.isGuest && b.isGuest) return 1;
                
                // 3. Then alphabetically by userName
                return a.userName.localeCompare(b.userName);
            });

            if (sortedOnlineUsers.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No users currently online.';
                ul.appendChild(li);
                return;
            }

            sortedOnlineUsers.forEach(onlineUser => {
                const li = document.createElement('li');
                const userType = onlineUser.isGuest ? '' : ''; // Removed "(Guest)" for guest users
                const mobileIcon = onlineUser.hasMobile ? ' 📱' : '';
                
                // Avatar HTML
                let avatarHtml;
                if (onlineUser.avatar) {
                    avatarHtml = `<img src="${onlineUser.avatar}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; margin-right:8px; vertical-align:middle;">`;
                } else {
                    avatarHtml = `<span style="display:inline-block; width:20px; height:20px; border-radius:50%; background-color:${onlineUser.color}; color:white; text-align:center; line-height:20px; font-size:10px; font-weight:bold; margin-right:8px; vertical-align:middle;">${onlineUser.userName.charAt(0).toUpperCase()}</span>`;
                }

                li.id = `online-user-${onlineUser.userId}`;
                li.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        ${avatarHtml}
                        <span style="color: ${onlineUser.color}; font-weight: bold;">${onlineUser.userName}</span>
                        <span style="margin-left:8px; font-size:0.9em; color:#888;">${userType}${mobileIcon} - ${onlineUser.deviceCount} device(s) online</span>
                    </div>
                `;
                ul.appendChild(li);
            });
        }

        // Listen for changes in site_users (for user details)
        siteUsersRef.on('value', (snapshot) => {
            allSiteUsers = snapshot.val() || {};
            processAndDisplayOnlineUsers();
        });

        // Listen for changes in authenticated online users
        onlineUsersRef.on('value', (snapshot) => {
            allOnlineAuthData = snapshot.val() || {};
            processAndDisplayOnlineUsers();
        });

        // Listen for changes in guest online users
        onlineGuestsRef.on('value', (snapshot) => {
            allOnlineGuestData = snapshot.val() || {};
            processAndDisplayOnlineUsers();
        });
    });
})();