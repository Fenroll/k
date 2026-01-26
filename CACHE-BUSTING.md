# Cache Busting System for courses.generated.js

## Overview

This project uses a robust cache-busting mechanism that works with local files (file:// protocol) without requiring a localhost server. The system ensures that browsers always load the latest version of `courses.generated.js` after regeneration.

## How It Works

### 1. Version Generation
When you run `generate_courses.js`, it:
- Generates a unique version string combining:
  - Date: `YYYYMMDD` (e.g., `20260126`)
  - Time hash: Base-36 encoded time of day (e.g., `1aay`)
  - Final version: `202601261aay`
- This ensures every build gets a unique version, even multiple builds on the same day

### 2. Automatic HTML Updates
The script automatically updates all HTML files that load `courses.generated.js`:
- `index.html`
- `md-viewer.html`
- `md-editor.html`
- `text-editor.html`
- `admin.html`

Each file's script tag is updated from:
```html
<script src="courses.generated.js?v=20260125"></script>
```

To:
```html
<script src="courses.generated.js?v=202601261aay"></script>
```

### 3. Version Tracking
The version is stored in two places:
1. **courses.version.json** - JSON file with version and timestamp
   ```json
   {
     "version": "202601261aay",
     "timestamp": "26.01.2026 16:40"
   }
   ```

2. **courses.generated.js** - JavaScript variable
   ```javascript
   window.coursesVersion = "202601261aay";
   ```

## Why This Works Locally

Unlike server-based cache busting (which relies on HTTP headers), this approach:
- Uses query string versioning (`?v=202601261aay`)
- Browser treats different query strings as different resources
- Works with `file://` protocol (no server needed)
- Forces browser to fetch new file when version changes

## Usage

### Regenerate Content
```bash
node generate_courses.js
```

This single command:
1. Scans the `files/` directory
2. Generates `courses.generated.js` with new content
3. Creates unique version string
4. Updates all HTML files automatically
5. Saves version to `courses.version.json`

### Verify Cache Busting
After running the script, check:
1. Console output shows version (e.g., `coursesVersion: 202601261aay`)
2. HTML files updated (✓ marks in console)
3. Browser loads new content (no hard refresh needed)

## Benefits

✅ **Automatic** - No manual version updates needed  
✅ **Unique** - Every build gets a unique version  
✅ **Local-friendly** - Works without servers  
✅ **Reliable** - Browsers reliably cache-bust  
✅ **Trackable** - Version file shows when last updated  

## Technical Details

### Version Format
- **Date component**: `YYYYMMDD` (8 digits)
- **Time component**: `[0-9a-z]+` (base-36 encoded seconds since midnight)
- **Combined**: `202601261aay` = January 26, 2026 at 16:40:36

### Script Injection
The version is injected at the top of `courses.generated.js`:
```javascript
window.coursesVersion = "202601261aay";
const courses = [...];
const eventInfo = "...";
const buildTimestamp = "26.01.2026 16:40";
```

### HTML Pattern Matching
The update function uses regex to find and replace:
```javascript
const scriptPattern = /<script src="courses\.generated\.js(?:\?v=[0-9]+)?"><\/script>/g;
const newScriptTag = `<script src="courses.generated.js?v=${version}"></script>`;
```

## Troubleshooting

### Problem: Browser still shows old content
**Solution**: Check that:
1. `generate_courses.js` ran successfully
2. HTML file shows new version in script tag
3. No browser extensions blocking scripts
4. Try Ctrl+Shift+R (hard refresh) once

### Problem: HTML files not updating
**Solution**: 
1. Check file permissions (must be writable)
2. Verify file paths in script output
3. Check for syntax errors in HTML files

### Problem: Version file not created
**Solution**:
1. Check write permissions in directory
2. Look for error messages in console
3. Verify Node.js has file system access

## Future Enhancements

Potential improvements:
- Add version checking in JavaScript to show update notifications
- Create version history log
- Add rollback capability
- Implement version comparison utilities

---

**Last Updated**: January 26, 2026  
**Current Version**: 202601261aay
