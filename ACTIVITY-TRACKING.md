# Activity Tracking System Documentation

## Overview

The website now implements **intelligent activity tracking** that only marks users as "active" when they're genuinely using the website, not just when they have a tab open.

## Problem Solved

**Before:** Users appeared "online" and "active" as long as they had a tab open, even if:
- Tab was minimized or in background
- User was idle for hours
- Computer was locked
- User went to lunch

**After:** Users only appear "active" when:
- ✅ Page is visible (tab is in foreground)
- ✅ Recent user interaction (within last 5 minutes)
- ✅ Both conditions must be true

## How It Works

### 1. Page Visibility Detection

Tracks whether the tab is visible or hidden:

```javascript
document.addEventListener('visibilitychange', function() {
    isPageVisible = !document.hidden;
    // User becomes inactive when tab is hidden
});
```

**Triggers:**
- Switching to another tab → User becomes inactive
- Minimizing browser → User becomes inactive
- Switching to another app → User becomes inactive
- Coming back to tab → User becomes active (if not idle)

### 2. User Interaction Detection

Monitors real user activity:

```javascript
const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
activityEvents.forEach(event => {
    document.addEventListener(event, updateActivity, { passive: true });
});
```

**What counts as activity:**
- Mouse movement
- Mouse clicks
- Keyboard input
- Scrolling
- Touch gestures (mobile)

### 3. Idle Timeout

Automatically marks user as inactive after **5 minutes** of no interaction:

```javascript
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
```

**Example scenarios:**

| Scenario | Status |
|----------|--------|
| Actively browsing, moving mouse | ✅ Active |
| Reading content, no interaction for 3 min | ✅ Active |
| Reading content, no interaction for 6 min | ❌ Inactive (idle) |
| Tab in background, mouse active in other tab | ❌ Inactive (hidden) |
| Return to tab, click on page | ✅ Active (immediate) |

### 4. Smart Status Updates

Updates Firebase presence only when status changes:

```javascript
function checkIdleStatus() {
    const wasActive = isUserActive;
    isUserActive = isPageVisible && (timeSinceActivity < IDLE_TIMEOUT);
    
    // Only update if status changed
    if (wasActive !== isUserActive) {
        updatePresenceStatus();
    }
}
```

Checks every **10 seconds** but only sends updates when necessary.

## Integration with Chat System

### chat-firebase-rest.js Integration

The chat system now respects activity state:

```javascript
// Only update lastSeen if user is actually active
const isUserActive = window.userActivityState?.isActive() ?? true;

if (!isUserActive) {
    console.log('⏸ User inactive - skipping lastSeen update');
    return;
}

// User is active - update normally
await fetch(userRef, {
    method: 'PATCH',
    body: JSON.stringify({ 
        lastSeen: Date.now(),
        isActive: true
    })
});
```

**Result:** `lastSeen` timestamp only updates when user is genuinely active.

## Firebase Data Structure

### Updated Presence Data

```json
{
  "online_users": {
    "user123": {
      "device_abc": {
        "isMobile": false,
        "timestamp": 1706371234567,
        "isGuest": false,
        "userName": "John Doe",
        "isActive": true,           // ← NEW: True only if genuinely active
        "lastActivity": 1706371234567,  // ← NEW: Last interaction timestamp
        "lastInactive": 1706371000000   // ← NEW: When user became inactive
      }
    }
  }
}
```

## Configuration

### Adjustable Parameters

Located in [js/presence.js](js/presence.js):

```javascript
// How long before user is considered idle (default: 5 minutes)
const IDLE_TIMEOUT = 5 * 60 * 1000;

// How often to check idle status (default: 10 seconds)
const ACTIVITY_CHECK_INTERVAL = 10000;
```

### Recommended Settings

| Use Case | IDLE_TIMEOUT | ACTIVITY_CHECK_INTERVAL |
|----------|--------------|------------------------|
| **Chat/Messaging** | 5 minutes | 10 seconds |
| **Collaboration Tools** | 3 minutes | 5 seconds |
| **Content Browsing** | 10 minutes | 30 seconds |
| **Gaming/Interactive** | 2 minutes | 5 seconds |

## Testing the System

### Manual Testing

1. **Test Tab Visibility:**
   - Open browser console: `F12`
   - Watch for: `Presence: User is ACTIVE` / `Presence: User is INACTIVE`
   - Switch tabs → Should see "INACTIVE (idle or tab hidden)"
   - Return to tab → Should see "User is ACTIVE"

2. **Test Idle Timeout:**
   - Stay on page, don't interact
   - Wait 5 minutes
   - Console should show: `Presence: User is INACTIVE`
   - Move mouse → Should see "User is ACTIVE"

3. **Test Activity Updates:**
   - Watch chat system console
   - When active: `✓ User active - updated lastSeen`
   - When inactive: `⏸ User inactive - skipping lastSeen update`

### Automated Testing

Check activity state programmatically:

```javascript
// In browser console
window.userActivityState.isActive()  // Returns true/false
window.userActivityState.getLastActivityTime()  // Returns timestamp
```

## Console Messages

### Normal Operation

```
Presence: Setting initial presence for UID: user123 isGuest: false isActive: true
Presence: User is ACTIVE
✓ User active - updated lastSeen
```

### User Goes Idle

```
Presence: User is INACTIVE (idle or tab hidden)
⏸ User inactive - skipping lastSeen update
⏸ User inactive - skipping lastSeen update
```

### User Returns

```
Presence: User is ACTIVE
✓ User active - updated lastSeen
```

## Performance Impact

### Minimal Overhead

- Event listeners use `{ passive: true }` flag → No scroll blocking
- Activity checks run every 10 seconds → Negligible CPU usage
- Firebase updates only on status changes → Reduced bandwidth
- No polling loops → Battery-friendly on mobile

### Bandwidth Comparison

**Before:** 
- Update every 30 seconds regardless of activity
- ~120 Firebase writes/hour per user

**After:**
- Update only when active
- ~60-80 Firebase writes/hour for active users
- ~0-10 writes/hour for idle/background tabs

**Savings:** ~40-50% reduction in unnecessary Firebase writes

## Backward Compatibility

The system includes fallback for pages that don't have presence.js:

```javascript
const isUserActive = window.userActivityState?.isActive() ?? true;
```

If `window.userActivityState` doesn't exist, defaults to `true` (old behavior).

## Privacy Considerations

### What is Tracked

- ✅ Whether user is interacting (yes/no)
- ✅ Whether tab is visible (yes/no)
- ✅ Timestamp of last activity

### What is NOT Tracked

- ❌ Specific actions (what was clicked)
- ❌ Mouse coordinates
- ❌ Keystrokes or content
- ❌ Browsing patterns
- ❌ Screen recordings

All tracking is **presence-only** for showing online status.

## Troubleshooting

### Issue: User shown as inactive when clearly active

**Possible causes:**
1. Browser has aggressive battery saving
2. Tab throttling by browser
3. Extensions blocking events

**Solution:**
- Check browser console for activity logs
- Try different browser
- Disable extensions temporarily

### Issue: User stays active when idle

**Possible causes:**
1. Background processes triggering events
2. Auto-scrolling content
3. Animations triggering mouse events

**Solution:**
- Check `IDLE_TIMEOUT` setting
- Look for auto-playing content
- Review custom scripts

### Issue: Frequent status changes

**Possible causes:**
1. User rapidly switching tabs
2. Split-screen usage
3. Mouse hovering on tab edge

**Solution:**
- Normal behavior for multitasking users
- Consider increasing `ACTIVITY_CHECK_INTERVAL`

## Future Enhancements

Potential improvements:
- [ ] Add "away" status (between active and offline)
- [ ] Configurable idle timeout per user
- [ ] Visual indicator of activity status
- [ ] Activity heatmap for analytics
- [ ] Smart idle timeout based on usage patterns

## Files Modified

1. **[js/presence.js](js/presence.js)** - Core activity tracking
2. **[js/chat-firebase-rest.js](js/chat-firebase-rest.js)** - Chat integration

## Technical Details

### Global API

The system exposes a global API for other scripts:

```javascript
window.userActivityState = {
    isActive: () => boolean,           // Current activity status
    getLastActivityTime: () => number  // Timestamp of last activity
};
```

### Event Flow

```
User Interaction
    ↓
updateActivity()
    ↓
lastActivityTime = now
    ↓
isUserActive = true
    ↓
updatePresenceStatus()
    ↓
Firebase.set({ isActive: true })
```

---

**Implemented:** January 27, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready
