// Version checker for site-wide updates
(function() {
  if (window.location.protocol === 'file:') {
    return;
  }

  const CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes
  const VERSION_FILE = 'courses.version.json';
  const DISMISSED_KEY = 'coursebook-update-dismissed';

  let currentVersion = window.coursesVersion || null;
  let dismissedVersion = null;
  try { dismissedVersion = localStorage.getItem(DISMISSED_KEY) || null; } catch (_) {}

  async function checkVersion() {
    try {
      const response = await fetch(`${VERSION_FILE}?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();
      const latestVersion = data && data.version;
      if (!latestVersion) return;

      if (!currentVersion) {
        // First successful read — adopt as baseline so we don't fire immediately on a stale page load.
        currentVersion = latestVersion;
        return;
      }

      if (latestVersion !== currentVersion && latestVersion !== dismissedVersion) {
        showUpdateNotification(latestVersion);
      }
    } catch (error) {
      console.warn('Version check failed:', error);
    }
  }

  function injectStyles() {
    if (document.getElementById('update-notification-style')) return;
    const style = document.createElement('style');
    style.id = 'update-notification-style';
    style.textContent = `
      @keyframes updateSlideIn {
        from { transform: translateY(-12px) scale(0.96); opacity: 0; }
        to   { transform: translateY(0)     scale(1);    opacity: 1; }
      }
      @keyframes updateIconPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(88, 129, 87, 0.35); }
        50%      { box-shadow: 0 0 0 8px rgba(88, 129, 87, 0);    }
      }
      #update-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        font-family: 'Open Sans', Arial, sans-serif;
        background: #fff;
        color: #1f2937;
        border: 1px solid #588157;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(58, 90, 64, 0.18), 0 2px 6px rgba(58, 90, 64, 0.08);
        padding: 14px 16px;
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        animation: updateSlideIn 0.22s cubic-bezier(0.32, 0.72, 0, 1) both;
      }
      #update-notification .upd-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #update-notification .upd-icon {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #eef5ec;
        color: #588157;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: updateIconPulse 2.4s ease-in-out infinite;
      }
      #update-notification .upd-title {
        font-size: 14px;
        font-weight: 700;
        color: #111827;
        flex: 1;
        line-height: 1.3;
      }
      #update-notification .upd-close {
        background: none;
        border: 0;
        cursor: pointer;
        color: #9ca3af;
        font-size: 22px;
        line-height: 1;
        padding: 0 4px;
        border-radius: 6px;
        transition: background 0.15s, color 0.15s;
      }
      #update-notification .upd-close:hover { color: #374151; background: #f3f4f6; }
      #update-notification .upd-body {
        font-size: 13px;
        line-height: 1.45;
        color: #4b5563;
        padding-left: 42px;
      }
      #update-notification .upd-body a {
        color: #588157;
        font-weight: 600;
        text-decoration: underline;
      }
      #update-notification .upd-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      #update-notification .upd-btn {
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        border: 0;
        border-radius: 8px;
        padding: 8px 14px;
        cursor: pointer;
        transition: background 0.15s, transform 0.12s, box-shadow 0.15s;
      }
      #update-notification .upd-btn-primary {
        background: #588157;
        color: #fff;
        box-shadow: 0 2px 6px rgba(58, 90, 64, 0.22);
      }
      #update-notification .upd-btn-primary:hover { background: #4a6d49; box-shadow: 0 3px 10px rgba(58, 90, 64, 0.30); }
      #update-notification .upd-btn-primary:active { transform: scale(0.97); }
      #update-notification .upd-btn-ghost {
        background: transparent;
        color: #6b7280;
      }
      #update-notification .upd-btn-ghost:hover { color: #374151; background: #f3f4f6; }
      #update-notification.is-refreshing .upd-actions { pointer-events: none; opacity: 0.6; }
      #update-notification.is-refreshing .upd-btn-primary { background: #4a6d49; }
      @media (prefers-reduced-motion: reduce) {
        #update-notification { animation: none; }
        #update-notification .upd-icon { animation: none; }
      }
      @media (max-width: 768px) {
        #update-notification {
          left: max(12px, env(safe-area-inset-left));
          right: max(12px, env(safe-area-inset-right));
          top: max(12px, env(safe-area-inset-top));
          max-width: none;
        }
        #update-notification .upd-body { padding-left: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function showUpdateNotification(version) {
    if (document.getElementById('update-notification')) return;
    injectStyles();

    const isViewer = window.location.pathname.includes('md-viewer.html');
    const subPageHint = isViewer
      ? `<div class="upd-body" style="margin-top:-2px;">Open <a href="index.html">Courses</a> first to load the latest content.</div>`
      : '';

    const notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', 'polite');
    notification.innerHTML = `
      <div class="upd-row">
        <div class="upd-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3l1.9 5.5L19 10l-5.1 1.5L12 17l-1.9-5.5L5 10l5.1-1.5L12 3z"></path>
            <path d="M5 17l.7 2L8 19.7 5.7 20.4 5 22.7l-.7-2.3L2 19.7l2.3-.7z"></path>
          </svg>
        </div>
        <div class="upd-title">A new version is available</div>
        <button class="upd-close" id="update-close-btn" type="button" aria-label="Dismiss">&times;</button>
      </div>
      <div class="upd-body">Refresh to load the latest changes.</div>
      ${subPageHint}
      <div class="upd-actions">
        <button class="upd-btn upd-btn-ghost" id="update-later-btn" type="button">Later</button>
        <button class="upd-btn upd-btn-primary" id="update-refresh-btn" type="button">Refresh now</button>
      </div>
    `;

    document.body.appendChild(notification);

    const dismiss = (persist) => {
      if (persist) {
        dismissedVersion = version;
        try { localStorage.setItem(DISMISSED_KEY, version); } catch (_) {}
      }
      notification.remove();
    };

    const refreshBtn = document.getElementById('update-refresh-btn');
    refreshBtn.addEventListener('click', () => {
      // Indicate refresh is in progress so multiple clicks don't pile up.
      notification.classList.add('is-refreshing');
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Refreshing…';
      try { localStorage.removeItem(DISMISSED_KEY); } catch (_) {}
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now());
      window.location.href = url.toString();
    });
    document.getElementById('update-close-btn').addEventListener('click', () => dismiss(true));
    document.getElementById('update-later-btn').addEventListener('click', () => dismiss(true));
  }

  // Initial check after a short delay so window.coursesVersion has a chance to populate.
  setTimeout(() => {
    if (!currentVersion && window.coursesVersion) {
      currentVersion = window.coursesVersion;
    }
    checkVersion();
  }, 1000);

  setInterval(checkVersion, CHECK_INTERVAL);
})();
