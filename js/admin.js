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
                html += `<li>${user.username} (${displayName}) - ${deviceCount} device(s) <button class="edit-user-btn" data-uid="${uid}">Edit</button></li>`;
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
            const newPassword = generateRandomPassword();
            try {
                await db.ref(`site_users/${uid}`).update({
                    password: btoa(newPassword)
                });
                showNotification(`Password reset successfully. New password: ${newPassword}`);
            } catch (error) {
                showError('edit-user-error', 'Failed to reset password.');
                console.error(error);
            }
        };


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


        // Online Users Logic
        const onlineUsersRef = db.ref('online_users');
        onlineUsersRef.on('value', (snapshot) => {
            onlineUsersContainer.innerHTML = '<ul></ul>';
            const onlineUsers = snapshot.val();
            if (onlineUsers) {
                for (const uid in onlineUsers) {
                    const devices = onlineUsers[uid];
                    const deviceCount = Object.keys(devices).length;
                    
                    usersRef.child(uid).once('value', (userSnapshot) => {
                        const user = userSnapshot.val();
                        if (user) {
                            const li = document.createElement('li');
                            li.id = `online-user-${uid}`;
                            li.innerHTML = `${user.username} - ${deviceCount} device(s) online`;
                            onlineUsersContainer.querySelector('ul').appendChild(li);
                        }
                    });
                }
            }
        });
    });
})();