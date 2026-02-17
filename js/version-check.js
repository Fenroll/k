// Version checker for site-wide updates
(function() {
  if (window.location.protocol === 'file:') {
    return;
  }

  const CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes
  const VERSION_FILE = 'courses.version.json';
  
  // Get initial version from courses.generated.js if available, or fetch it
  let currentVersion = window.coursesVersion || null;
  let dismissedVersion = null; // Track version dismissed by user

  async function checkVersion() {
    try {
      const response = await fetch(`${VERSION_FILE}?t=${Date.now()}`);
      if (!response.ok) return;
      
      const data = await response.json();
      const latestVersion = data.version;
      
      if (currentVersion && latestVersion && latestVersion !== currentVersion) {
        // Only show if user hasn't dismissed this specific version
        if (latestVersion !== dismissedVersion) {
          showUpdateNotification(latestVersion);
        }
      } else if (!currentVersion) {
        // First load if window.coursesVersion wasn't set (e.g. race condition)
        currentVersion = latestVersion;
      }
    } catch (error) {
      console.warn('Version check failed:', error);
    }
  }

  function showUpdateNotification(version) {
    // Check if notification already exists
    if (document.getElementById('update-notification')) return;

    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc2626; /* Red for urgency */
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      font-family: 'Open Sans', sans-serif;
      max-width: 350px;
      animation: slideInRight 0.3s ease;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Check if we are in md-viewer or other sub-pages
    const isViewer = window.location.pathname.includes('md-viewer.html');
    const additionalInstruction = isViewer 
      ? `Please refresh from <a href="index.html" style="color:white;text-decoration:underline;font-weight:bold;">Courses</a> first.` 
      : '';

    notification.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <strong style="font-size:1.1em;">New Content Available!</strong>
        <button id="update-close-btn" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:0 4px;">&times;</button>
      </div>
      <div style="font-size:0.95em;line-height:1.4;">
        Site content has been updated. Please refresh to see the latest changes.
      </div>
      ${additionalInstruction ? `<div style="font-size:0.9em;margin-top:4px;">${additionalInstruction}</div>` : ''}
      <button id="update-refresh-btn" style="margin-top:8px;background:white;color:#dc2626;border:none;padding:8px;border-radius:4px;font-weight:bold;cursor:pointer;">Refresh Now</button>
    `;

    // Add keyframe animation style if not present
    if (!document.getElementById('update-anim-style')) {
      const style = document.createElement('style');
      style.id = 'update-anim-style';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);
    
    // Attach event listener to the refresh button
    document.getElementById('update-refresh-btn').addEventListener('click', function() {
      // Force refresh of the main HTML file by adding a timestamp to the URL
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now());
      window.location.href = url.toString();
    });

    // Attach event listener to the close button
    document.getElementById('update-close-btn').addEventListener('click', function() {
      dismissedVersion = version; // Remember this version was dismissed
      notification.remove();
    });
  }

  // Initial check (delay slightly to ensure currentVersion is populated if loaded via script)
  setTimeout(() => {
    if (!currentVersion && window.coursesVersion) {
      currentVersion = window.coursesVersion;
    }
    // Also fetch initial version from server to handle cached JS files with old window.coursesVersion
    checkVersion();
  }, 1000);

  // Periodic check
  setInterval(checkVersion, CHECK_INTERVAL);
})();
