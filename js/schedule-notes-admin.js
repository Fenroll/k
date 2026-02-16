// js/schedule-notes-admin.js

document.addEventListener('DOMContentLoaded', () => {
    // Ensure currentUserPromise is available before proceeding
    if (!window.currentUserPromise) {
        console.error("currentUserPromise not found. Firebase initialization order might be incorrect for schedule-notes-admin.js.");
        const errorEl = document.getElementById('schedule-notes-error');
        if (errorEl) {
            errorEl.textContent = 'Error: Firebase initialization not complete. Please check console.';
            errorEl.style.display = 'block';
        }
        // Optionally disable the module
        document.getElementById('schedule-notes-content').disabled = true;
        document.getElementById('save-schedule-notes').disabled = true;
        document.getElementById('load-schedule-notes').disabled = true;
        return;
    }

    window.currentUserPromise.then(user => {
        // Check if the user is an admin before proceeding with admin module functions
        if (!user || !user.isAdmin) {
            console.warn("User is not an admin. Schedule notes admin module will not be active.");
            // Disable the module if not an admin
            const scheduleNotesContent = document.getElementById('schedule-notes-content');
            const saveScheduleNotesBtn = document.getElementById('save-schedule-notes');
            const loadScheduleNotesBtn = document.getElementById('load-schedule-notes');
            const scheduleNotesError = document.getElementById('schedule-notes-error');

            if (scheduleNotesContent) scheduleNotesContent.disabled = true;
            if (saveScheduleNotesBtn) saveScheduleNotesBtn.disabled = true;
            if (loadScheduleNotesBtn) loadScheduleNotesBtn.disabled = true;
            if (scheduleNotesError) {
                scheduleNotesError.textContent = 'Unauthorized: Admin access required.';
                scheduleNotesError.style.display = 'block';
            }
            return;
        }

        // --- Firebase is now initialized and user is confirmed as admin ---
        const scheduleNotesContent = document.getElementById('schedule-notes-content');
        const saveScheduleNotesBtn = document.getElementById('save-schedule-notes');
        const loadScheduleNotesBtn = document.getElementById('load-schedule-notes');
        const scheduleNotesError = document.getElementById('schedule-notes-error');
        const notificationContainer = document.getElementById('notification-container'); // Assumed to exist globally in admin.html

        // Reference to the Firebase Realtime Database node for schedule notes
        const dbRef = firebase.database().ref('scheduleNotes/content');

        // Helper function to show notifications (copied from admin.js for self-containment)
        function showNotification(message, isError = false) {
            if (!notificationContainer) return;

            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            if (isError) {
                notification.style.borderColor = '#cf6679';
            }
            notificationContainer.appendChild(notification);
            
            // Trigger reflow to enable transition
            notification.offsetHeight; 
            notification.classList.add('show');

            setTimeout(() => {
                notification.classList.remove('show');
                notification.addEventListener('transitionend', () => notification.remove());
            }, 3000);
        }
        
        // Helper function to show error messages (copied from admin.js for self-containment)
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


        // Load content from Firebase when the module loads
        const loadContent = () => {
            hideError('schedule-notes-error'); // Clear previous errors
            dbRef.once('value')
                .then(snapshot => {
                    const value = snapshot.val();
                    let content = '';

                    if (typeof value === 'string') {
                        content = value;
                    } else if (value && typeof value === 'object') {
                        content = value.content || '';
                    }

                    if (content) {
                        scheduleNotesContent.value = content;
                        showNotification('Schedule notes loaded successfully!', false);
                    } else {
                        scheduleNotesContent.value = '## No schedule notes found yet. Start typing!';
                        showNotification('No schedule notes found in database.', false);
                    }
                })
                .catch(error => {
                    console.error('Error loading schedule notes:', error);
                    showError('schedule-notes-error', `Error loading: ${error.message}`);
                    showNotification('Error loading schedule notes!', true);
                });
        };

        // Save content to Firebase
        saveScheduleNotesBtn.addEventListener('click', () => {
            const content = scheduleNotesContent.value;
            const editorName = user.displayName || user.userName || user.username || user.userId || 'Admin';
            const payload = {
                content,
                lastEditedBy: editorName,
                lastEditedAt: firebase.database.ServerValue.TIMESTAMP
            };

            dbRef.set(payload)
                .then(() => {
                    showNotification('Schedule notes saved successfully!', false);
                    hideError('schedule-notes-error');
                })
                .catch(error => {
                    console.error('Error saving schedule notes:', error);
                    showError('schedule-notes-error', `Error saving: ${error.message}`);
                    showNotification('Error saving schedule notes!', true);
                });
        });

        // Manual load button (mostly for debugging or explicit refresh)
        if (loadScheduleNotesBtn) { // Check if button exists
            loadScheduleNotesBtn.addEventListener('click', loadContent);
        }
        

        // Initial load when the script runs (or when DOM is ready)
        loadContent();

    }).catch(error => {
        console.error("Error resolving currentUserPromise in schedule-notes-admin module:", error);
        const errorEl = document.getElementById('schedule-notes-error');
        if (errorEl) {
            errorEl.textContent = `Error initializing module: ${error.message}`;
            errorEl.style.display = 'block';
        }
    });
});