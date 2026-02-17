(function () {
  const STORAGE_KEY = 'appVersionToken';

  function getTokenFromScriptTag() {
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      const src = script.getAttribute('src') || '';
      if (!src.includes('js/version-manager.js')) continue;
      try {
        const parsed = new URL(src, window.location.href);
        return parsed.searchParams.get('v');
      } catch (_) {
        const match = src.match(/[?&]v=([a-zA-Z0-9_]+)/);
        if (match) return match[1];
      }
    }
    return null;
  }

  function getTokenFromLocation() {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('v');
    } catch (_) {
      return null;
    }
  }

  function isExternalUrl(url) {
    return /^(?:[a-z]+:)?\/\//i.test(url) ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('chrome-extension:');
  }

  function getCurrentToken() {
    if (window.__APP_VERSION_TOKEN) return window.__APP_VERSION_TOKEN;

    const fromScript = getTokenFromScriptTag();
    if (fromScript) return fromScript;

    const fromCourses = window.coursesVersion || null;
    if (fromCourses) return fromCourses;

    const fromLocation = getTokenFromLocation();
    if (fromLocation) return fromLocation;

    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function setToken(token, persist) {
    if (!token) return null;
    window.__APP_VERSION_TOKEN = token;
    if (persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, token);
      } catch (_) {}
    }
    return token;
  }

  function versionedUrl(url, explicitToken) {
    if (!url || isExternalUrl(url)) return url;

    const token = explicitToken || getCurrentToken();
    if (!token) return url;

    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin !== window.location.origin && window.location.origin !== 'null') {
        return url;
      }
      parsed.searchParams.set('v', token);
      if (window.location.origin === 'null') {
        const path = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
        return path + parsed.search;
      }
      const relativePath = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
      return relativePath + parsed.search;
    } catch (_) {
      if (/[?&]v=/.test(url)) {
        return url.replace(/([?&])v=[^&]*/i, '$1v=' + token);
      }
      return url + (url.includes('?') ? '&' : '?') + 'v=' + token;
    }
  }

  function applyTokenToLocalAssets() {
    const token = getCurrentToken();
    if (!token) return;

    const localSelectors = [
      'script[src^="js/"]',
      'script[src^="./js/"]',
      'script[src^="courses.generated.js"]',
      'link[href^="css/"]',
      'link[href^="./css/"]'
    ];

    document.querySelectorAll(localSelectors.join(',')).forEach(node => {
      const attr = node.tagName === 'LINK' ? 'href' : 'src';
      const value = node.getAttribute(attr);
      if (!value || isExternalUrl(value)) return;
      node.setAttribute(attr, versionedUrl(value, token));
    });
  }

  const initialToken = setToken(getCurrentToken(), true);

  window.VersionManager = {
    getToken: getCurrentToken,
    setToken,
    versionedUrl,
    applyTokenToLocalAssets
  };

  if (initialToken) {
    applyTokenToLocalAssets();
  }
})();
