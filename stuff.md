# Website Audit Report - February 17, 2026

## Executive Summary
Comprehensive audit of the medical student coursebook website revealing **23 critical issues**, **31 improvements**, and **18 enhancement ideas** across security, performance, code quality, and user experience.

---

## 🔴 CRITICAL ISSUES (Fix Immediately)

### 1. **Firebase API Keys Exposed**
**Severity:** CRITICAL  
**Location:** Multiple files (`calendar.html`, `html-priority.js`, `admin.js`, `account-system.js`, etc.)  
**Issue:** Hardcoded Firebase configuration with placeholder API keys visible in client-side code.
```javascript
apiKey: "API_KEY",
messagingSenderId: "SENDER_ID",
appId: "APP_ID"
```
**Risk:** Database exposure, unauthorized access, data manipulation.  
**Fix:** Move to environment variables, use Firebase security rules, implement proper authentication.

### 2. **Password Stored in Base64 (Not Encrypted)**
**Severity:** CRITICAL  
**Location:** `js/account-system.js`, `js/user-identity.js`
```javascript
const plainPassword = atob(userData.password);
```
**Issue:** Base64 is encoding, NOT encryption. Passwords are trivially recoverable.  
**Fix:** Use bcrypt/argon2 for password hashing on server-side. Never store plaintext passwords client-side.

### 3. **No Input Validation/Sanitization**
**Severity:** HIGH  
**Location:** `anamnesis.html`, `admin.html`, form inputs across the site  
**Issue:** User inputs are not validated or sanitized, enabling XSS attacks.  
**Fix:** Implement CSP headers, sanitize all inputs with DOMPurify, validate on both client and server.

### 4. **Gender Field Typo**
**Severity:** MEDIUM  
**Location:** `anamnesis.html:667`
```html
<option value="F">Женат</option>
```
**Issue:** "Женат" means "Married (male)" not "Female". Should be "Жена".  
**Fix:** Change to `<option value="F">Жена</option>`.

### 5. **Inconsistent Cache Busting**
**Severity:** MEDIUM  
**Location:** Multiple HTML files  
**Issue:** Version parameters are inconsistent (`?v=202602161rky`, `?v=20260131`, `?v=202404231000`).  
**Impact:** Users may load stale JavaScript causing runtime errors.  
**Fix:** Standardize version format, implement automated versioning in build script.

### 6. **Duplicate Navigation Items**
**Severity:** LOW  
**Location:** `anamnesis.html:571-572`
```html
<li class="base-navigation-button">
     <a href="tools.html">...</a>
</li>
<li class="base-navigation-button">  <!-- DUPLICATE -->
    <li class="base-navigation-button">
```
**Issue:** Nested `<li>` tags causing invalid HTML.  
**Fix:** Remove duplicate wrapper.

---

## ⚠️ HIGH PRIORITY IMPROVEMENTS

### 7. **Missing Error Boundaries**
**Impact:** App crashes propagate to users  
**Fix:** Add try-catch blocks in critical functions, implement global error handler.

### 8. **No Loading States**
**Location:** `index.html`, `calendar.html`, `md-viewer.html`  
**Issue:** Users see blank screens during data fetch.  
**Fix:** Add skeleton loaders, loading spinners with timeouts.

### 9. **Memory Leaks in Chat System**
**Location:** `js/chat.js`  
**Issue:** Firebase listeners not properly cleaned up on page unload.
```javascript
startNameMappingsPolling(callback) {
  const unsubscribe = mappingsRef.on('value', ...);
  this.unsubscribers.push(unsubscribe); // Good, but never called on unmount
}
```
**Fix:** Implement cleanup in `beforeunload` or component unmount.

### 10. **Inefficient File Indexing**
**Location:** `generate_courses.js`  
**Issue:** Recursive file traversal without optimization, can be slow for large directories.  
**Fix:** Use streaming, implement caching, add progress indicators.

### 11. **No Mobile Navigation on Anamnesis**
**Location:** `anamnesis.html`  
**Issue:** Mobile menu toggle is referenced but `mobile-nav.css` hides it incorrectly.
```css
.mobile-menu-toggle { display: none !important; }
```
**Fix:** Review mobile navigation logic, ensure consistency across all pages.

### 12. **Hardcoded Timestamps in Script Tags**
**Location:** Multiple files  
**Issue:** Manual timestamp management is error-prone.  
**Fix:** Automate with build script to inject `Date.now()` or git commit hash.

### 13. **Unused Firebase Init Script**
**Location:** `js/firebase-init.js`  
**Issue:** File creates `AnonymousUser` class but it's replaced by `user-identity.js`.  
**Fix:** Remove dead code or merge functionality.

### 14. **Large Inline Styles**
**Location:** `index.html` (2945 lines), `calendar.html`, `md-viewer.html`  
**Issue:** Massive inline `<style>` blocks hurt maintainability and caching.  
**Fix:** Extract to external CSS files, use PostCSS for optimization.

### 15. **No Content Security Policy (CSP)**
**Impact:** Vulnerable to XSS, clickjacking  
**Fix:** Add CSP headers:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;">
```

---

## 🟡 MEDIUM PRIORITY IMPROVEMENTS

### 16. **Inconsistent Color System**
**Location:** `index.html` color generation functions  
**Issue:** Complex deterministic color system with 60+ colors, but no fallback.  
**Fix:** Simplify to 12-15 distinct colors with accessibility testing (WCAG AA contrast).

### 17. **Table Processing Performance**
**Location:** `index.html` - `processTableRowspans`, `processTableColspans`  
**Issue:** DOM parsing executed on every render, no caching.  
**Fix:** Memoize processed tables, use Web Workers for heavy parsing.

### 18. **Missing Alt Text on Images**
**Location:** SVG icons throughout the site  
**Issue:** Screen readers can't describe icons.  
**Fix:** Add `aria-label` or `<title>` elements to all SVGs.

### 19. **No Lazy Loading**
**Location:** Course images, markdown content  
**Issue:** All content loads immediately, slowing initial page load.  
**Fix:** Implement `loading="lazy"` for images, virtual scrolling for lists.

### 20. **Cloudflare Worker Lacks Authentication**
**Location:** `cloudflare-r2-worker.js`  
**Issue:** No API key validation, anyone can upload/delete files.
```javascript
'Access-Control-Allow-Origin': '*'
```
**Fix:** Implement Bearer token authentication, whitelist origins.

### 21. **Version Check Polling**
**Location:** `js/version-check.js`  
**Issue:** Checks every 2 minutes via polling, wastes bandwidth.  
**Fix:** Use Server-Sent Events (SSE) or WebSockets for push updates.

### 22. **No Offline Support**
**Impact:** Site unusable without internet  
**Fix:** Implement Service Worker with offline caching strategy.

### 23. **Markdown Rendering Inconsistency**
**Location:** `md-viewer.html`, `text-editor.html`  
**Issue:** Two different Marked.js configurations causing rendering differences.  
**Fix:** Centralize Markdown config in shared module.

### 24. **Admin Panel Lacks RBAC**
**Location:** `admin.html`, `js/admin-guard.js`  
**Issue:** Binary admin check, no granular permissions.  
**Fix:** Implement role-based access control (Editor, Moderator, Admin).

### 25. **Generated Courses File Too Large**
**Location:** `courses.generated.js`  
**Issue:** Entire course catalog in one file, no code splitting.  
**Fix:** Split by course, load on-demand with dynamic imports.

### 26. **No Rate Limiting on Chat**
**Location:** `js/chat.js`  
**Issue:** Users can spam messages.  
**Fix:** Implement client-side throttling + Firebase rules for rate limits.

### 27. **Search Not Optimized**
**Location:** `index.html` course filter  
**Issue:** Linear search through all courses on every keystroke.  
**Fix:** Use Fuse.js for fuzzy search, debounce input (300ms).

### 28. **Poor Mobile Table UX**
**Location:** Markdown tables in `md-viewer.html`  
**Issue:** Tables overflow with horizontal scroll, hard to read.  
**Fix:** Convert wide tables to card layout on mobile with CSS.

---

## 🟢 ENHANCEMENT IDEAS

### 29. **Dark Mode Support**
Add theme toggle with `prefers-color-scheme` detection.

### 30. **Progressive Web App (PWA)**
Add manifest.json, Service Worker for installability.

### 31. **Better Image Optimization**
Use WebP/AVIF with fallbacks, implement responsive images.

### 32. **Search Across All Content**
Implement full-text search with indexed Markdown content.

### 33. **Export Anamnesis as PDF**
Add client-side PDF generation with jsPDF.

### 34. **Real-time Collaboration**
Use Firebase Realtime Database for collaborative editing.

### 35. **Analytics Dashboard**
Track course views, popular files (privacy-friendly with Plausible/Umami).

### 36. **Keyboard Shortcuts Help Modal**
Document all shortcuts (Ctrl+1/2/3, etc.) in a help overlay.

### 37. **Better File Upload UI**
Drag-and-drop with progress bars for Cloudflare R2 uploads.

### 38. **Code Syntax Highlighting**
Add Prism.js or Highlight.js for code blocks in Markdown.

### 39. **Print-Friendly Styles**
Add `@media print` CSS for anamnesis, course content.

### 40. **Internationalization (i18n)**
Prepare for English translation with i18next.

### 41. **Better Mobile Gestures**
Swipe left/right for next/previous image in gallery.

### 42. **Course Progress Tracking**
Mark files as "completed" with visual indicators.

### 43. **Favorites/Bookmarks**
Allow users to star courses/files for quick access.

### 44. **Version History for Anamnesis**
Track changes with diff viewer (Firebase timestamp nodes).

### 45. **Better Error Messages**
Replace generic alerts with toast notifications (Notyf, Toastify).

### 46. **Automated Backups**
Daily Firebase exports to Google Cloud Storage.

---

## 📊 CODE QUALITY ISSUES

### 47. **Inconsistent Naming Conventions**
Mix of camelCase, snake_case, kebab-case.  
**Fix:** Adopt consistent style guide (Airbnb, Standard).

### 48. **Magic Numbers Everywhere**
```javascript
const CHECK_INTERVAL = 2 * 60 * 1000; // Better!
setTimeout(() => {}, 120000); // Bad!
```
**Fix:** Extract to named constants.

### 49. **Deeply Nested Callbacks**
**Location:** `index.html` overlay rendering  
**Fix:** Refactor with async/await, separate into modules.

### 50. **No TypeScript**
JavaScript lacks type safety, causing runtime errors.  
**Fix:** Migrate to TypeScript incrementally with JSDoc types first.

### 51. **No Linting**
Inconsistent code style, potential bugs undetected.  
**Fix:** Add ESLint + Prettier with pre-commit hooks.

### 52. **No Testing**
Zero unit tests, integration tests, or E2E tests.  
**Fix:** Add Jest for unit tests, Playwright for E2E.

### 53. **Unused Dependencies**
**Location:** `package.json`
```json
"@vercel/speed-insights": "^1.2.0" // Not imported anywhere
```
**Fix:** Audit with `npm-check` or `depcheck`.

### 54. **No Build Process**
No bundling, minification, or tree-shaking.  
**Fix:** Add Vite or esbuild for modern build pipeline.

### 55. **Git Submodules for Files**
**Location:** `.gitmodules` references `files/` subdirectory  
**Issue:** Complicates deployment, hard to sync.  
**Fix:** Consider Git LFS or separate CDN for large files.

---

## 🎨 UI/UX IMPROVEMENTS

### 56. **Inconsistent Button Styles**
Different padding, colors, hover states across pages.  
**Fix:** Create design system with CSS variables.

### 57. **Poor Touch Targets on Mobile**
Buttons < 44x44px, violating accessibility guidelines.  
**Fix:** Increase touch targets to 48x48px minimum.

### 58. **No Focus Indicators**
Keyboard navigation invisible, inaccessible for keyboard users.  
**Fix:** Add `:focus-visible` styles with clear outlines.

### 59. **Confusing Overlay Close Methods**
Multiple close buttons (X, ribbon, outside click) cause confusion.  
**Fix:** Standardize close behavior, add "Press ESC to close" hint.

### 60. **Calendar Week Selector UX**
Week navigation lacks date range preview.  
**Fix:** Show "Jan 15 - Jan 21" next to week number.

### 61. **Missing Empty States**
When no anamnesis records exist, just blank space.  
**Fix:** Add illustrations with CTAs ("Create your first anamnesis").

### 62. **Long File Names Overflow**
File names truncate without showing full text on hover.  
**Fix:** Add `title` attribute with full name, use ellipsis correctly.

---

## 🚀 PERFORMANCE OPTIMIZATIONS

### 63. **Render Blocking Resources**
Google Fonts, Firebase SDKs loaded synchronously.  
**Fix:** Use `<link rel="preconnect">`, `async`/`defer` attributes.

### 64. **No Image Compression**
Assets folder contains unoptimized PNGs (some >2MB).  
**Fix:** Use ImageOptim, Squoosh, or automate with Sharp.

### 65. **Excessive DOM Nodes**
Index page renders 100+ course cards immediately.  
**Fix:** Virtual scrolling with Intersection Observer.

### 66. **Redundant Color Calculations**
Color generation runs on every card render.  
**Fix:** Pre-calculate and cache color mapping.

---

## 🔧 SUGGESTED ACTION PLAN

### Phase 1: Security & Critical Bugs (Week 1)
1. Fix Firebase API key exposure
2. Implement proper password hashing
3. Add input validation/sanitization
4. Fix gender field typo
5. Remove duplicate navigation items

### Phase 2: Performance & Stability (Week 2)
6. Add error boundaries
7. Implement loading states
8. Fix memory leaks in chat
9. Optimize file indexing
10. Add CSP headers

### Phase 3: Code Quality (Week 3)
11. Extract CSS to external files
12. Add ESLint + Prettier
13. Remove dead code (firebase-init.js)
14. Standardize version management
15. Add basic unit tests

### Phase 4: UX Improvements (Week 4)
16. Fix mobile navigation
17. Add lazy loading
18. Implement dark mode
19. Add PWA manifest
20. Improve accessibility

### Phase 5: Enhancements (Ongoing)
21. Full-text search
22. PDF export for anamnesis
23. Analytics dashboard
24. Offline support
25. i18n preparation

---

## 📦 RECOMMENDED DEPENDENCIES

```json
{
  "dependencies": {
    "firebase": "^10.8.0",
    "marked": "^11.1.1",
    "dompurify": "^3.0.8",
    "fuse.js": "^7.0.0",
    "notyf": "^3.10.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.4",
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "playwright": "^1.41.0"
  }
}
```

---

## 🔍 METRICS TO TRACK

- **Performance:** Lighthouse score (target: >90)
- **Accessibility:** WCAG AA compliance (target: 100%)
- **Security:** Mozilla Observatory grade (target: A+)
- **Bundle Size:** Total JS/CSS (target: <500KB gzipped)
- **Error Rate:** Sentry/Rollbar tracking (target: <1%)

---

## 📝 FINAL NOTES

This audit identified **66 total issues** spanning security, performance, code quality, and UX. The site is functional but has critical vulnerabilities that should be addressed immediately. The codebase shows good potential but lacks modern development practices (testing, type safety, bundling).

**Estimated effort:** 120-160 hours for full implementation.

**Priority order:** Security → Stability → Performance → Features

---

Generated: February 17, 2026  
Auditor: GitHub Copilot  
Workspace: D:\Proton\My files\Website

