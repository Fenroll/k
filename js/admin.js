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
        const deleteAccountBtn = document.getElementById('delete-account');
        const notificationContainer = document.getElementById('notification-container');

        // Upload limit settings elements
        const uploadMaxTotalMbInput = document.getElementById('upload-max-total-mb');
        const uploadLimitCurrentText = document.getElementById('upload-limit-current');
        const saveUploadLimitBtn = document.getElementById('save-upload-limit');

        // Domain migration elements
        const domainMigrationOldInput = document.getElementById('domain-migration-old');
        const domainMigrationNewInput = document.getElementById('domain-migration-new');
        const domainMigrationRootsInput = document.getElementById('domain-migration-roots');
        const domainMigrationPreviewBtn = document.getElementById('domain-migration-preview');
        const domainMigrationApplyBtn = document.getElementById('domain-migration-apply');
        const domainMigrationLocalBtn = document.getElementById('domain-migration-local');
        const domainMigrationDownloadCoursesBtn = document.getElementById('domain-migration-download-courses');
        const domainMigrationStatus = document.getElementById('domain-migration-status');
        const domainMigrationLog = document.getElementById('domain-migration-log');
        
        // HTML Priority Settings elements
        const htmlPriorityForm = document.getElementById('html-priority-form-element');
        const htmlPriorityInput1 = document.getElementById('html-priority-1');
        const htmlPriorityInput2 = document.getElementById('html-priority-2');
        const htmlPriorityInput3 = document.getElementById('html-priority-3');
        const htmlPriorityError = document.getElementById('html-priority-error');
        const browseButtons = document.querySelectorAll('.browse-btn');
        const clearPriorityButtons = document.querySelectorAll('.clear-priority-btn');

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
            const length = 10;
            // Avoid ambiguous characters (O/0, I/l/1) to reduce manual typing mistakes.
            const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
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
            // Remove common extensions
            cleanName = cleanName.replace(/\.(?:html?|url|pdf)$/i, '');
            return cleanName;
        }

        // Helper function to check if a file can be used as a priority target.
        function isPriorityTargetFile(file) {
            return Boolean(file && file.name && file.path);
        }

        function normalizeMigrationPrefix(value) {
            return String(value || '').trim().replace(/\/+$/, '');
        }

        function isHttpUrlPrefix(value) {
            if (!/^https?:\/\//i.test(value)) return false;
            try {
                const parsed = new URL(value);
                return Boolean(parsed.protocol && parsed.hostname);
            } catch (_) {
                return false;
            }
        }

        function getDomainMigrationRoots() {
            const fallback = [
                'messages',
                'notes',
                'course_notes',
                'site_users',
                'uploads',
                'uploadLogs',
                'filesUploads',
                'settings',
                'scheduleNotes',
                'anamneses',
                'name_mappings',
                'protected_names',
                'reactions',
                'notes_reactions',
                'finance'
            ];
            const raw = domainMigrationRootsInput ? domainMigrationRootsInput.value : '';
            const roots = String(raw || '')
                .split(',')
                .map(root => root.trim().replace(/^\/+|\/+$/g, ''))
                .filter(Boolean);
            return roots.length ? roots : fallback;
        }

        function setDomainMigrationBusy(isBusy) {
            [domainMigrationPreviewBtn, domainMigrationApplyBtn, domainMigrationLocalBtn, domainMigrationDownloadCoursesBtn]
                .filter(Boolean)
                .forEach(button => {
                    button.disabled = isBusy;
                });
        }

        function setDomainMigrationStatus(text) {
            if (domainMigrationStatus) {
                domainMigrationStatus.textContent = text;
            }
        }

        function appendDomainMigrationLog(text) {
            if (!domainMigrationLog) return;
            domainMigrationLog.value += `[${new Date().toLocaleTimeString('bg-BG')}] ${text}\n`;
            domainMigrationLog.scrollTop = domainMigrationLog.scrollHeight;
        }

        function escapeRegExp(value) {
            return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function replaceAllString(value, oldPrefix, newPrefix) {
            return String(value).replace(new RegExp(escapeRegExp(oldPrefix), 'g'), newPrefix);
        }

        function countStringOccurrences(value, needle) {
            if (!needle) return 0;
            let count = 0;
            let index = String(value).indexOf(needle);
            while (index !== -1) {
                count += 1;
                index = String(value).indexOf(needle, index + needle.length);
            }
            return count;
        }

        function collectDomainStringUpdates(value, currentPath, oldPrefix, newPrefix, updates, samples, stats) {
            if (typeof value === 'string') {
                const occurrences = countStringOccurrences(value, oldPrefix);
                if (occurrences > 0) {
                    const nextValue = replaceAllString(value, oldPrefix, newPrefix);
                    updates[currentPath.join('/')] = {
                        before: value,
                        after: nextValue
                    };
                    stats.fields += 1;
                    stats.occurrences += occurrences;
                    if (samples.length < 20) {
                        samples.push({
                            path: currentPath.join('/'),
                            occurrences,
                            before: value.slice(0, 180),
                            after: nextValue.slice(0, 180)
                        });
                    }
                }
                return;
            }

            if (!value || typeof value !== 'object') return;

            Object.entries(value).forEach(([key, childValue]) => {
                collectDomainStringUpdates(childValue, currentPath.concat(key), oldPrefix, newPrefix, updates, samples, stats);
            });
        }

        function downloadDomainMigrationBackup(updates, oldPrefix, newPrefix) {
            const entries = Object.entries(updates);
            if (!entries.length) return;

            const backup = {
                createdAt: new Date().toISOString(),
                oldPrefix,
                newPrefix,
                fields: entries.map(([path, after]) => ({
                    path,
                    before: after.before,
                    after: after.after
                }))
            };

            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `domain-migration-plan-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        }

        async function applyTransactionalStringUpdates(updates, oldPrefix, newPrefix) {
            const entries = Object.keys(updates);
            let changed = 0;
            let skipped = 0;

            for (let index = 0; index < entries.length; index += 1) {
                const path = entries[index];
                const result = await db.ref(path).transaction(currentValue => {
                    if (typeof currentValue !== 'string') return currentValue;
                    if (!currentValue.includes(oldPrefix)) return currentValue;
                    return replaceAllString(currentValue, oldPrefix, newPrefix);
                });

                const finalValue = result && result.snapshot ? result.snapshot.val() : null;
                if (typeof finalValue === 'string' && finalValue.includes(newPrefix)) {
                    changed += 1;
                } else {
                    skipped += 1;
                }

                if ((index + 1) % 50 === 0 || index === entries.length - 1) {
                    appendDomainMigrationLog(`Applied ${index + 1}/${entries.length} field transaction(s).`);
                }
            }

            return { changed, skipped };
        }

        async function runDomainMigration({ applyChanges }) {
            const oldPrefix = normalizeMigrationPrefix(domainMigrationOldInput && domainMigrationOldInput.value);
            const newPrefix = normalizeMigrationPrefix(domainMigrationNewInput && domainMigrationNewInput.value);

            hideError('domain-migration-error');
            if (!oldPrefix || !newPrefix) {
                showError('domain-migration-error', 'Enter both old and new domain or URL prefixes.');
                return;
            }
            if (oldPrefix === newPrefix) {
                showError('domain-migration-error', 'Old and new prefixes are the same.');
                return;
            }
            if (!isHttpUrlPrefix(oldPrefix) || !isHttpUrlPrefix(newPrefix)) {
                showError('domain-migration-error', 'Both prefixes should be complete URLs that start with http:// or https://.');
                return;
            }

            const roots = getDomainMigrationRoots();
            const updates = {};
            const samples = [];
            const totalStats = { fields: 0, occurrences: 0 };

            setDomainMigrationBusy(true);
            setDomainMigrationStatus(`${applyChanges ? 'Applying' : 'Previewing'} migration...`);
            if (domainMigrationLog) domainMigrationLog.value = '';
            appendDomainMigrationLog(`Old: ${oldPrefix}`);
            appendDomainMigrationLog(`New: ${newPrefix}`);
            appendDomainMigrationLog(`Roots: ${roots.join(', ')}`);

            try {
                for (const root of roots) {
                    appendDomainMigrationLog(`Scanning ${root}...`);
                    const snapshot = await db.ref(root).once('value');
                    const value = snapshot.val();
                    const beforeFields = totalStats.fields;
                    const beforeOccurrences = totalStats.occurrences;
                    collectDomainStringUpdates(value, [root], oldPrefix, newPrefix, updates, samples, totalStats);
                    appendDomainMigrationLog(
                        `${root}: ${totalStats.fields - beforeFields} field(s), ${totalStats.occurrences - beforeOccurrences} occurrence(s).`
                    );
                }

                const updateCount = Object.keys(updates).length;
                setDomainMigrationStatus(
                    `${applyChanges ? 'Apply' : 'Preview'} result: ${updateCount} Firebase field(s), ${totalStats.occurrences} URL occurrence(s).`
                );

                if (samples.length) {
                    appendDomainMigrationLog('Samples:');
                    samples.forEach(sample => {
                        appendDomainMigrationLog(`- ${sample.path} (${sample.occurrences})`);
                        appendDomainMigrationLog(`  before: ${sample.before}`);
                        appendDomainMigrationLog(`  after:  ${sample.after}`);
                    });
                } else {
                    appendDomainMigrationLog('No matching Firebase values found.');
                }

                if (applyChanges && updateCount > 0) {
                    downloadDomainMigrationBackup(updates, oldPrefix, newPrefix);
                    appendDomainMigrationLog('Downloaded a migration plan backup before writing.');

                    const confirmed = window.confirm(
                        `Apply ${updateCount} Firebase field update(s), replacing ${totalStats.occurrences} occurrence(s)?\n\nA migration plan JSON has been downloaded. Each field will be updated with a transaction to avoid overwriting concurrent edits.\n\nThis does not edit local browser drafts or the deployed static courses.generated.js file.`
                    );
                    if (!confirmed) {
                        setDomainMigrationStatus('Apply cancelled. No changes written.');
                        appendDomainMigrationLog('Cancelled by admin before writing.');
                        return;
                    }
                    const result = await applyTransactionalStringUpdates(updates, oldPrefix, newPrefix);
                    setDomainMigrationStatus(`Done: updated ${result.changed} Firebase field(s). Skipped ${result.skipped}.`);
                    showNotification('Domain migration applied successfully.', false);
                }
            } catch (error) {
                console.error('Domain migration failed:', error);
                showError('domain-migration-error', `Migration failed: ${error.message || error}`);
                setDomainMigrationStatus('Migration failed.');
                appendDomainMigrationLog(`ERROR: ${error.message || error}`);
            } finally {
                setDomainMigrationBusy(false);
            }
        }

        async function downloadPatchedCoursesGenerated() {
            const oldPrefix = normalizeMigrationPrefix(domainMigrationOldInput && domainMigrationOldInput.value);
            const newPrefix = normalizeMigrationPrefix(domainMigrationNewInput && domainMigrationNewInput.value);

            hideError('domain-migration-error');
            if (!oldPrefix || !newPrefix) {
                showError('domain-migration-error', 'Enter both old and new prefixes before downloading.');
                return;
            }
            if (oldPrefix === newPrefix) {
                showError('domain-migration-error', 'Old and new prefixes are the same.');
                return;
            }
            if (!isHttpUrlPrefix(oldPrefix) || !isHttpUrlPrefix(newPrefix)) {
                showError('domain-migration-error', 'Both prefixes should be complete URLs that start with http:// or https://.');
                return;
            }

            setDomainMigrationBusy(true);
            setDomainMigrationStatus('Preparing patched courses.generated.js...');
            try {
                const response = await fetch(`courses.generated.js?v=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Could not fetch courses.generated.js (HTTP ${response.status})`);
                }
                const source = await response.text();
                const occurrences = countStringOccurrences(source, oldPrefix);
                const patched = replaceAllString(source, oldPrefix, newPrefix);
                const blob = new Blob([patched], { type: 'application/javascript;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'courses.generated.js';
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                setDomainMigrationStatus(`Downloaded patched courses.generated.js with ${occurrences} replacement(s). Replace the deployed file with this one.`);
                appendDomainMigrationLog(`courses.generated.js replacements: ${occurrences}`);
            } catch (error) {
                console.error('Failed to patch courses.generated.js:', error);
                showError('domain-migration-error', `Download failed: ${error.message || error}`);
                setDomainMigrationStatus('Download failed.');
            } finally {
                setDomainMigrationBusy(false);
            }
        }

        function migrateCurrentBrowserStorage() {
            const oldPrefix = normalizeMigrationPrefix(domainMigrationOldInput && domainMigrationOldInput.value);
            const newPrefix = normalizeMigrationPrefix(domainMigrationNewInput && domainMigrationNewInput.value);

            hideError('domain-migration-error');
            if (!oldPrefix || !newPrefix) {
                showError('domain-migration-error', 'Enter both old and new prefixes before migrating this browser cache.');
                return;
            }
            if (oldPrefix === newPrefix) {
                showError('domain-migration-error', 'Old and new prefixes are the same.');
                return;
            }
            if (!isHttpUrlPrefix(oldPrefix) || !isHttpUrlPrefix(newPrefix)) {
                showError('domain-migration-error', 'Both prefixes should be complete URLs that start with http:// or https://.');
                return;
            }

            const matches = [];
            for (let index = 0; index < localStorage.length; index += 1) {
                const key = localStorage.key(index);
                if (!key) continue;
                const value = localStorage.getItem(key);
                if (typeof value === 'string' && value.includes(oldPrefix)) {
                    matches.push({ key, before: value, after: replaceAllString(value, oldPrefix, newPrefix) });
                }
            }

            if (!matches.length) {
                setDomainMigrationStatus('This browser cache has no matching values.');
                appendDomainMigrationLog('Local browser cache: no matches.');
                return;
            }

            const backup = {
                createdAt: new Date().toISOString(),
                oldPrefix,
                newPrefix,
                storage: 'localStorage',
                items: matches
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `localstorage-domain-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            const confirmed = window.confirm(
                `Update ${matches.length} localStorage item(s) in this browser?\n\nA backup JSON has been downloaded first. This only affects this browser/profile, not other users or devices.`
            );
            if (!confirmed) {
                setDomainMigrationStatus('This browser cache migration was cancelled.');
                appendDomainMigrationLog('Local browser cache migration cancelled.');
                return;
            }

            matches.forEach(item => localStorage.setItem(item.key, item.after));
            setDomainMigrationStatus(`Updated ${matches.length} localStorage item(s) in this browser.`);
            appendDomainMigrationLog(`Local browser cache updated: ${matches.map(item => item.key).join(', ')}`);
            showNotification('This browser cache was migrated successfully.', false);
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
                            if (isPriorityTargetFile(file) && (file.name.toLowerCase().includes(lowerCaseFilter) || file.path.toLowerCase().includes(lowerCaseFilter))) {
                                sectionFiles.push({ name: file.name, path: file.path });
                            }
                        });
                    }

                    // Process msgNotes files (if they exist and are distinct)
                    if (section.msgNotes) {
                        section.msgNotes.forEach(file => {
                            // Ensure no duplicates and allow any file type.
                            if (isPriorityTargetFile(file) && !sectionFiles.some(sf => sf.path === file.path) && (file.name.toLowerCase().includes(lowerCaseFilter) || file.path.toLowerCase().includes(lowerCaseFilter))) {
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

        if (domainMigrationPreviewBtn) {
            domainMigrationPreviewBtn.addEventListener('click', () => runDomainMigration({ applyChanges: false }));
        }
        if (domainMigrationApplyBtn) {
            domainMigrationApplyBtn.addEventListener('click', () => runDomainMigration({ applyChanges: true }));
        }
        if (domainMigrationLocalBtn) {
            domainMigrationLocalBtn.addEventListener('click', migrateCurrentBrowserStorage);
        }
        if (domainMigrationDownloadCoursesBtn) {
            domainMigrationDownloadCoursesBtn.addEventListener('click', downloadPatchedCoursesGenerated);
        }

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
                    password: btoa(password),
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
                    document.getElementById('edit-show-in-members').checked = user.showInMembersList || false;
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
            const newUsername = document.getElementById('edit-username').value.trim();
            const newDisplayName = document.getElementById('edit-displayname').value.trim();
            const showInMembersList = document.getElementById('edit-show-in-members').checked;

            if (!uid || !newUsername || !newDisplayName) {
                showError('edit-user-error', 'Username and display name are required.');
                return;
            }

            try {
                const duplicateSnapshot = await db.ref('site_users').orderByChild('username').equalTo(newUsername).once('value');
                let hasDuplicate = false;
                duplicateSnapshot.forEach((child) => {
                    if (child.key !== uid) {
                        hasDuplicate = true;
                    }
                });

                if (hasDuplicate) {
                    showError('edit-user-error', 'Username already exists.');
                    return;
                }

                await db.ref(`site_users/${uid}`).update({
                    username: newUsername,
                    displayName: newDisplayName,
                    showInMembersList: showInMembersList
                });
                showNotification('User updated successfully!');
                hideError('edit-user-error');
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
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(newPassword).catch(() => {});
                }
                prompt("Password reset successfully. Please copy the new password:", newPassword);
                modal.style.display = 'none';
            } catch (error) {
                showError('edit-user-error', 'Failed to reset password: ' + (error.message || error));
                console.error(error);
            }
        };

        if (deleteAccountBtn) {
            deleteAccountBtn.onclick = async () => {
                const uid = document.getElementById('edit-user-uid').value;
                if (!uid) {
                    showError('edit-user-error', 'User ID is missing.');
                    return;
                }

                const confirmed = window.confirm('Delete this account? This cannot be undone.');
                if (!confirmed) return;

                try {
                    await db.ref(`site_users/${uid}`).remove();
                    showNotification('User deleted successfully.');
                    hideError('edit-user-error');
                    modal.style.display = 'none';
                } catch (error) {
                    showError('edit-user-error', 'Failed to delete user: ' + (error.message || error));
                    console.error(error);
                }
            };
        }


        // Schedule Data (JSON) Management
        const scheduleJsonEditor = document.getElementById('schedule-json-editor');
        const loadScheduleJsonBtn = document.getElementById('load-schedule-json');
        const saveScheduleJsonBtn = document.getElementById('save-schedule-json');
        const scheduleJsonRef = db.ref('/settings/scheduleData');

        async function loadScheduleJsonFromFirebase(options = {}) {
            const { showSuccessNotification = true } = options;

            try {
                const snapshot = await scheduleJsonRef.once('value');
                const data = snapshot.val();

                if (data) {
                    scheduleJsonEditor.value = JSON.stringify(data, null, 2);
                    if (showSuccessNotification) {
                        showNotification('Schedule data loaded from Firebase.');
                    }
                } else {
                    if (showSuccessNotification) {
                        showNotification('No schedule data found in Firebase.', true);
                    }
                }

                hideError('schedule-json-error');

                window.__adminScheduleJsonLoaded = true;
                window.__adminScheduleJsonHasData = Boolean(data);
                window.dispatchEvent(new CustomEvent('admin:schedule-json-loaded', {
                    detail: { hasData: Boolean(data) }
                }));
            } catch (error) {
                console.error('Error loading schedule data:', error);
                showError('schedule-json-error', 'Failed to load schedule data: ' + error.message);

                window.__adminScheduleJsonLoaded = true;
                window.__adminScheduleJsonHasData = false;
                window.dispatchEvent(new CustomEvent('admin:schedule-json-loaded', {
                    detail: { hasData: false, error: true }
                }));
            }
        }

        // Upload limit settings
        const uploadLimitSettingsRef = db.ref('/settings/uploadLimits');
        const BYTES_IN_MB = 1024 * 1024;

        function formatBytesAsMb(bytes) {
            const mb = bytes / BYTES_IN_MB;
            return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(2)} MB`;
        }

        uploadLimitSettingsRef.on('value', (snapshot) => {
            const settings = snapshot.val() || {};
            const currentLimitBytes = Number(settings.defaultMaxTotalBytes);

            if (Number.isFinite(currentLimitBytes) && currentLimitBytes > 0) {
                const currentLimitMb = currentLimitBytes / BYTES_IN_MB;
                uploadMaxTotalMbInput.value = Number.isInteger(currentLimitMb)
                    ? String(currentLimitMb)
                    : currentLimitMb.toFixed(2);
                uploadLimitCurrentText.textContent = `Current limit: ${formatBytesAsMb(currentLimitBytes)}`;
            } else {
                uploadMaxTotalMbInput.value = '';
                uploadLimitCurrentText.textContent = 'Current limit: not set (worker fallback will be used)';
            }

            hideError('upload-limit-error');
        });

        if (saveUploadLimitBtn) {
            saveUploadLimitBtn.addEventListener('click', async () => {
                hideError('upload-limit-error');

                const mbValue = Number(uploadMaxTotalMbInput.value);
                if (!Number.isFinite(mbValue) || mbValue <= 0) {
                    showError('upload-limit-error', 'Please enter a valid number greater than 0 (MB).');
                    return;
                }

                const maxTotalBytes = Math.floor(mbValue * BYTES_IN_MB);

                try {
                    await uploadLimitSettingsRef.update({
                        defaultMaxTotalBytes: maxTotalBytes,
                        updatedAt: firebase.database.ServerValue.TIMESTAMP,
                        updatedBy: user.userName || user.username || 'admin'
                    });
                    showNotification(`Upload limit saved: ${formatBytesAsMb(maxTotalBytes)}`);
                } catch (error) {
                    console.error('Failed to save upload limit:', error);
                    showError('upload-limit-error', 'Failed to save upload limit: ' + error.message);
                }
            });
        }

        // Load from Firebase
        if (loadScheduleJsonBtn) {
            loadScheduleJsonBtn.addEventListener('click', async () => {
                await loadScheduleJsonFromFirebase({ showSuccessNotification: true });
            });
        }

        // Auto-load schedule JSON when the admin page initializes.
        loadScheduleJsonFromFirebase({ showSuccessNotification: false });

        // Save to Firebase
        saveScheduleJsonBtn.addEventListener('click', async () => {
            const content = scheduleJsonEditor.value;
            const shouldShowSaveNotification = !window.__adminSilentScheduleSaveNotification;
            try {
                const parsedData = JSON.parse(content);
                await scheduleJsonRef.set(parsedData);
                if (shouldShowSaveNotification) {
                    showNotification('Schedule data saved to Firebase successfully!');
                }
                hideError('schedule-json-error');
            } catch (error) {
                console.error("Error saving schedule data:", error);
                if (error instanceof SyntaxError) {
                    showError('schedule-json-error', 'Invalid JSON format: ' + error.message);
                } else {
                    showError('schedule-json-error', 'Failed to save schedule data: ' + error.message);
                }
            } finally {
                window.__adminSilentScheduleSaveNotification = false;
            }
        });


        // HTML Priority Settings Logic
        const htmlPriorityRef = db.ref('/settings/html_priority');
        htmlPriorityRef.on('value', (snapshot) => {
            const prioritySettings = snapshot.val();
            if (prioritySettings) {
                const entry1 = prioritySettings['1'] || '';
                const entry2 = prioritySettings['2'] || '';
                const entry3 = prioritySettings['3'] || '';

                const path1 = typeof entry1 === 'object' ? entry1.path || '' : entry1;
                const path2 = typeof entry2 === 'object' ? entry2.path || '' : entry2;
                const path3 = typeof entry3 === 'object' ? entry3.path || '' : entry3;

                htmlPriorityInput1.value = path1 || '';
                htmlPriorityInput1.dataset.fullPath = path1 || '';
                htmlPriorityInput1.dataset.label = typeof entry1 === 'object' ? String(entry1.label || '').trim() : '';

                htmlPriorityInput2.value = path2 || '';
                htmlPriorityInput2.dataset.fullPath = path2 || '';
                htmlPriorityInput2.dataset.label = typeof entry2 === 'object' ? String(entry2.label || '').trim() : '';

                htmlPriorityInput3.value = path3 || '';
                htmlPriorityInput3.dataset.fullPath = path3 || '';
                htmlPriorityInput3.dataset.label = typeof entry3 === 'object' ? String(entry3.label || '').trim() : '';
            } else {
                htmlPriorityInput1.value = '';
                htmlPriorityInput1.dataset.fullPath = '';
                htmlPriorityInput1.dataset.label = '';
                htmlPriorityInput2.value = '';
                htmlPriorityInput2.dataset.fullPath = '';
                htmlPriorityInput2.dataset.label = '';
                htmlPriorityInput3.value = '';
                htmlPriorityInput3.dataset.fullPath = '';
                htmlPriorityInput3.dataset.label = '';
            }
        });

        [htmlPriorityInput1, htmlPriorityInput2, htmlPriorityInput3].forEach((input) => {
            if (!input) return;
            input.addEventListener('input', () => {
                input.dataset.fullPath = input.value.trim();
                input.dataset.label = '';
            });
        });

        htmlPriorityForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPrioritySettings = {
                1: {
                    path: (htmlPriorityInput1.dataset.fullPath || htmlPriorityInput1.value || '').trim(),
                    label: (htmlPriorityInput1.dataset.label || '').trim()
                },
                2: {
                    path: (htmlPriorityInput2.dataset.fullPath || htmlPriorityInput2.value || '').trim(),
                    label: (htmlPriorityInput2.dataset.label || '').trim()
                },
                3: {
                    path: (htmlPriorityInput3.dataset.fullPath || htmlPriorityInput3.value || '').trim(),
                    label: (htmlPriorityInput3.dataset.label || '').trim()
                }
            };
            // Trim empty entries
            Object.keys(newPrioritySettings).forEach((key) => {
                const entry = newPrioritySettings[key];
                if (!entry.path) {
                    newPrioritySettings[key] = { path: '', label: '' };
                }
            });
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

        clearPriorityButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const input = document.getElementById(e.target.dataset.targetInput);
                if (!input) return;
                input.value = '';
                input.dataset.fullPath = '';
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
                const selectedValue = (target.dataset.path || '').trim();
                const selectedLabel = getCleanFileName(target.textContent || '').trim();
                currentInputForFileSelection.value = selectedValue;
                currentInputForFileSelection.dataset.fullPath = selectedValue;
                currentInputForFileSelection.dataset.label = selectedLabel;
                fileBrowserModal.style.display = 'none';
                currentInputForFileSelection = null; // Clear selection
            }
        });


        // Online Users Logic - Refactored to include guest users
        const siteUsersRef = db.ref('site_users');
        const onlineUsersRef = db.ref('online_users'); // Authenticated users
        const onlineGuestsRef = db.ref('online_guests'); // Guest users
        const offsetRef = db.ref(".info/serverTimeOffset");

        let serverTimeOffset = 0;
        offsetRef.on("value", (snap) => {
            serverTimeOffset = snap.val() || 0;
        });

        let allSiteUsers = {};
        let allOnlineAuthData = {};
        let allOnlineGuestData = {};

        function processAndDisplayOnlineUsers() {
            onlineUsersContainer.innerHTML = '<ul></ul>';
            const ul = onlineUsersContainer.querySelector('ul');
            const allOnline = {}; // Consolidated list of all online users
            
            const now = Date.now() + serverTimeOffset;
            const GRACE_PERIOD = 2 * 60 * 1000; // 2 minutes

            const isUserOnline = (devices) => {
                return Object.values(devices).some(device => {
                    // 1. Truly active - most important check
                    if (device.isActive === true) {
                        return true;
                    }
                    
                    // 2. Recently active (within 30 seconds) - for transitions
                    if (device.lastActivity && (now - device.lastActivity) < 30000) {
                        return true;
                    }
                    
                    // 3. Grace period for backgrounded tabs
                    if (device.lastInactive && (now - device.lastInactive) < GRACE_PERIOD) {
                        return true;
                    }
                    
                    // 4. Grace period for disconnected devices
                    if (device.offlineAt && (now - device.offlineAt) < GRACE_PERIOD) {
                        return true;
                    }
                    
                    return false;
                });
            };

            // Add authenticated online users
            for (const uid in allOnlineAuthData) {
                const devices = allOnlineAuthData[uid];
                
                // Only show users who are actually online according to grace period logic
                if (!isUserOnline(devices)) continue;
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
                        isGuest: false,
                        devices: devices // Add device details
                    };
                } else {
                    // Fallback for authenticated users whose profile might be missing
                    allOnline[uid] = {
                        userId: uid,
                        userName: `Unknown User (${uid})`,
                        color: '#cccccc',
                        deviceCount: deviceCount,
                        hasMobile: hasMobile,
                        isGuest: false,
                        devices: devices // Add device details
                    };
                }
            }

            // Add guest online users
            for (const guestId in allOnlineGuestData) {
                const devices = allOnlineGuestData[guestId];
                
                // Only show guests who are actually online according to grace period logic
                if (!isUserOnline(devices)) continue;
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
                    isGuest: true,
                    devices: devices // Add device details
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

                // Build device details if available
                let deviceDetailsHtml = '';
                if (onlineUser.devices && Object.keys(onlineUser.devices).length > 0) {
                    deviceDetailsHtml = '<div style="margin-left:28px; margin-top:4px; font-size:0.75em; color:#666;">';
                    Object.entries(onlineUser.devices).forEach(([devId, devData]) => {
                        const shortDevId = devId.substring(0, 12);
                        const deviceIcon = devData.isMobile ? '📱' : '🖥️';
                        const deviceName = devData.deviceName || 'Unknown';
                        const activeStatus = devData.isActive ? '✅' : '⏸️';
                        deviceDetailsHtml += `<div>${deviceIcon} ${activeStatus} ${deviceName} (${shortDevId})</div>`;
                    });
                    deviceDetailsHtml += '</div>';
                }

                li.id = `online-user-${onlineUser.userId}`;
                li.innerHTML = `
                    <div style="display:flex; align-items:center; flex-direction:column; align-items:flex-start;">
                        <div style="display:flex; align-items:center;">
                            ${avatarHtml}
                            <span style="color: ${onlineUser.color}; font-weight: bold;">${onlineUser.userName}</span>
                            <span style="margin-left:8px; font-size:0.9em; color:#888;">${userType}${mobileIcon} - ${onlineUser.deviceCount} device(s) online</span>
                        </div>
                        ${deviceDetailsHtml}
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
