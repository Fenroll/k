(function() {
    // Wait for marked to load
    window.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const shouldAutoOpenVisualEditor = ['1', 'true', 'yes'].includes(String(urlParams.get('openVisualEditor') || '').toLowerCase());
        const returnToUrl = urlParams.get('returnTo') || '';

        // Elements
        const openBtn = document.getElementById('open-visual-editor');
        const visualContainer = document.getElementById('visual-editor-container');
        const closeBtn = document.getElementById('close-visual-editor');
        const visualSaveBtn = document.getElementById('save-visual-editor');
        const saveScheduleJsonBtn = document.getElementById('save-schedule-json');
        const scheduleJsonEditor = document.getElementById('schedule-json-editor');
        const manageSemestersBtn = document.getElementById('manage-semesters-btn');
        const modeSelector = document.getElementById('ve-mode-selector');
        
        // Exam View Elements
        const scheduleTable = document.getElementById('ve-schedule-table');
        const examEditorView = document.getElementById('ve-exam-editor');
        const examListContainer = document.getElementById('ve-exam-list');
        const addExamBtnInView = document.getElementById('ve-add-exam-btn');

        if (!openBtn || !visualContainer) return;

        // State
        let currentScheduleData = null;
        let currentWeekIndex = 0;
        let scheduleByWeek = [];
        let viewMode = 'schedule'; // 'schedule', 'template-winter', 'template-summer'
        const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

        function getTimeMinutes(value) {
            const [hours, minutes] = String(value || '').split(':').map(Number);
            return hours * 60 + minutes;
        }

        function setVisualEditorError(elementId, message) {
            const errorEl = document.getElementById(elementId);
            if (!errorEl) return;
            const messageEl = errorEl.querySelector('.ve-validation-message');
            if (messageEl) messageEl.textContent = message;
            errorEl.classList.add('is-visible');
        }

        function clearVisualEditorError(elementId) {
            const errorEl = document.getElementById(elementId);
            if (errorEl) errorEl.classList.remove('is-visible');
        }

        function markInvalidTimeInputs(ids = []) {
            ['ve-start', 've-end'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('ve-input-invalid', ids.includes(id));
            });
        }

        function validateEventTimes(startTime, endTime, options = {}) {
            const { requireBoth = true } = options;
            const start = String(startTime || '').trim();
            const end = String(endTime || '').trim();
            const hasStart = start.length > 0;
            const hasEnd = end.length > 0;

            // Partial overrides may set only one of the two times — the other
            // is inherited from the template and shouldn't trigger validation.
            if (!requireBoth && !hasStart && !hasEnd) {
                return { ok: true, fields: [], message: '' };
            }

            if ((requireBoth || hasStart) && !timePattern.test(start)) {
                return {
                    ok: false,
                    fields: ['ve-start'],
                    message: 'Start time must use HH:MM, for example 08:30.'
                };
            }

            if ((requireBoth || hasEnd) && !timePattern.test(end)) {
                return {
                    ok: false,
                    fields: ['ve-end'],
                    message: 'End time must use HH:MM, for example 10:15.'
                };
            }

            if (hasStart && hasEnd && getTimeMinutes(end) <= getTimeMinutes(start)) {
                return {
                    ok: false,
                    fields: ['ve-start', 've-end'],
                    message: 'End time must be later than start time.'
                };
            }

            return { ok: true, fields: [], message: '' };
        }

        function describeEvent(entry, source) {
            const parts = [];
            if (source) parts.push(source);
            if (entry && entry.subject) parts.push(entry.subject);
            if (entry && entry.day) parts.push(entry.day);
            return parts.join(' - ') || 'Schedule item';
        }

        // Convert a raw override key (absolute index across all semesters) into
        // a friendly label that matches what the UI shows when navigating —
        // e.g., "Summer Week 8 (2026-04-13) [stored as #23]". Falls back to the
        // raw key if the schedule structure isn't available.
        function describeOverrideWeek(data, weekKey) {
            const rawLabel = `Week ${weekKey} override`;
            const weekIndex = parseInt(weekKey, 10) - 1;
            const weeks = (data && Array.isArray(data.weeks)) ? data.weeks : [];
            if (Number.isNaN(weekIndex) || weekIndex < 0 || weekIndex >= weeks.length) {
                return `${rawLabel} (ORPHANED — no week #${weekKey} in current schedule)`;
            }
            const week = weeks[weekIndex];
            if (!week || !week.startDate) return rawLabel;
            const weekStartStr = week.startDate;

            let semesterKey = null;
            if (data && data.semesters && typeof data.semesters === 'object') {
                const keys = Object.keys(data.semesters).sort((a, b) => {
                    const aStart = (data.semesters[a] && data.semesters[a].startDate) || '';
                    const bStart = (data.semesters[b] && data.semesters[b].startDate) || '';
                    return String(aStart).localeCompare(String(bStart));
                });
                for (const key of keys) {
                    const semStart = data.semesters[key] && data.semesters[key].startDate;
                    if (semStart && weekStartStr >= semStart) semesterKey = key;
                }
            }

            let relativeNum = parseInt(weekKey, 10);
            let semLabel = '';
            if (semesterKey && data.semesters[semesterKey] && data.semesters[semesterKey].startDate) {
                const semStart = new Date(data.semesters[semesterKey].startDate);
                const weekStart = new Date(weekStartStr);
                const diffDays = Math.floor((weekStart - semStart) / (1000 * 60 * 60 * 24));
                relativeNum = Math.floor(diffDays / 7) + 1;
                if (relativeNum < 1) relativeNum = 1;
                semLabel = (data.semesters[semesterKey].name || semesterKey).toString();
                semLabel = semLabel.charAt(0).toUpperCase() + semLabel.slice(1);
            }

            const prefix = semLabel ? `${semLabel} Week ${relativeNum}` : `Week ${relativeNum}`;
            return `${prefix} (${weekStartStr}) [stored as #${weekKey}] override`;
        }

        function findInvalidScheduleTime(data) {
            if (!data || typeof data !== 'object') return null;
            const collections = [];

            if (Array.isArray(data.template)) {
                collections.push({ source: 'Legacy template', items: data.template });
            }

            if (data.templates && typeof data.templates === 'object') {
                Object.keys(data.templates).forEach((key) => {
                    if (Array.isArray(data.templates[key])) {
                        collections.push({ source: `${key} template`, items: data.templates[key] });
                    }
                });
            }

            if (data.overrides && typeof data.overrides === 'object') {
                Object.keys(data.overrides).forEach((week) => {
                    if (Array.isArray(data.overrides[week])) {
                        collections.push({
                            source: describeOverrideWeek(data, week),
                            items: data.overrides[week],
                            weekKey: week
                        });
                    }
                });
            }

            for (const collection of collections) {
                for (const entry of collection.items) {
                    if (!entry || entry.remove || entry.removeDay || (entry.changes && entry.changes.removed === true)) continue;
                    const candidate = entry.changes ? { ...entry, ...entry.changes } : entry;
                    if (!candidate.startTime && !candidate.endTime) continue;
                    const result = validateEventTimes(candidate.startTime, candidate.endTime, { requireBoth: false });
                    if (!result.ok) {
                        // Surface the actual offending value so it can be located in Firebase.
                        const offendingValue = result.fields && result.fields.includes('ve-end')
                            ? candidate.endTime
                            : candidate.startTime;
                        const offendingDisplay = offendingValue === undefined || offendingValue === null
                            ? '(missing)'
                            : `"${String(offendingValue)}"`;
                        try {
                            // Find sibling entries that target the same slot — these are
                            // typically duplicate overrides accumulated from multiple edits
                            // of the same event. The renderer applies them in order and the
                            // last one wins, but the validator catches any of them.
                            const siblings = collection.items.filter((other) => {
                                if (!other || other === entry) return false;
                                if (entry.day && other.day !== entry.day) return false;
                                if (entry.subject && other.subject !== entry.subject) return false;
                                return true;
                            });
                            console.warn('[Schedule validation] Bad entry:', {
                                source: collection.source,
                                weekKey: collection.weekKey,
                                entry,
                                candidate,
                                badField: result.fields,
                                badValue: offendingValue,
                                siblingEntriesForSameSlot: siblings,
                                hint: siblings.length > 0
                                    ? `Found ${siblings.length} other override(s) for the same day+subject. Delete the entry with the bad value from Firebase under /.../overrides/${collection.weekKey}/.`
                                    : 'No siblings — this is the only override for that slot. Fix or delete it.'
                            });
                        } catch (_) { /* noop */ }
                        return {
                            message: `${describeEvent(candidate, collection.source)}: ${result.message} (got ${offendingDisplay} — see browser console for full entry)`,
                            entry: candidate
                        };
                    }
                }
            }

            return null;
        }

        // Auto-clean override arrays before save. Removes:
        //   1. null/non-object slots (Firebase leftovers from manual deletions)
        //   2. duplicate `changes:` entries for the same (day, subject, originalStartTime)
        //      slot — merged into the latest one so no field edits are lost
        //   3. entries whose merged candidate fails time validation (stale typos
        //      that the renderer can't apply cleanly anyway)
        // Returns { weeksTouched, removed: [{ weekKey, reason, entry }] }.
        function cleanupOverrides(data) {
            const summary = { weeksTouched: 0, removed: [] };
            if (!data || !data.overrides || typeof data.overrides !== 'object') return summary;

            Object.keys(data.overrides).forEach((weekKey) => {
                const arr = data.overrides[weekKey];
                if (!Array.isArray(arr)) return;
                const originalLength = arr.length;

                // Step 1: drop null/non-object entries.
                let work = [];
                arr.forEach((e) => {
                    if (e && typeof e === 'object') {
                        work.push(e);
                    } else if (e !== undefined) {
                        summary.removed.push({ weekKey, reason: 'null-slot', entry: e });
                    }
                });

                // Step 2: walk in order. Merge `changes:` entries for the same slot into
                // the first occurrence (later fields win per Object.assign). A `remove:`
                // or `removeDay` for the same slot resets the merge tracker so any later
                // `changes:` for that slot starts fresh.
                const result = [];
                const slotIndex = new Map(); // slotKey -> index in result

                work.forEach((entry) => {
                    const slotKey = (entry.day && entry.subject && entry.startTime)
                        ? `${entry.day}|${entry.subject}|${entry.startTime}`
                        : null;
                    const isChangesEdit = !!entry.changes
                        && !entry.remove
                        && !entry.removeDay
                        && entry.changes.removed !== true;

                    if (isChangesEdit && slotKey && slotIndex.has(slotKey)) {
                        const prev = result[slotIndex.get(slotKey)];
                        prev.changes = { ...prev.changes, ...entry.changes };
                        summary.removed.push({ weekKey, reason: 'duplicate-merged', entry });
                        return;
                    }

                    result.push(entry);

                    if (isChangesEdit && slotKey) {
                        slotIndex.set(slotKey, result.length - 1);
                    } else if (slotKey && (entry.remove || (entry.changes && entry.changes.removed === true))) {
                        slotIndex.delete(slotKey);
                    } else if (entry.removeDay) {
                        Array.from(slotIndex.keys()).forEach((k) => {
                            if (k.startsWith(`${entry.removeDay}|`)) slotIndex.delete(k);
                        });
                    }
                });

                // Step 3: drop any remaining entry whose merged candidate fails time
                // validation. Form validation prevents new bad entries; anything bad
                // here is stale data not displaying correctly anyway.
                const validated = [];
                result.forEach((entry) => {
                    if (entry.remove || entry.removeDay || (entry.changes && entry.changes.removed === true)) {
                        validated.push(entry);
                        return;
                    }
                    const candidate = entry.changes ? { ...entry, ...entry.changes } : entry;
                    if (!candidate.startTime && !candidate.endTime) {
                        validated.push(entry);
                        return;
                    }
                    const v = validateEventTimes(candidate.startTime, candidate.endTime, { requireBoth: false });
                    if (v.ok) {
                        validated.push(entry);
                    } else {
                        summary.removed.push({
                            weekKey,
                            reason: `invalid-times (${v.message})`,
                            entry,
                            candidate
                        });
                    }
                });

                if (validated.length === 0) {
                    delete data.overrides[weekKey];
                } else {
                    data.overrides[weekKey] = validated;
                }

                if (validated.length !== originalLength) summary.weeksTouched += 1;
            });

            return summary;
        }

        function openVisualEditorPanel(options = {}) {
            const { silentNoData = false } = options;

            const jsonContent = scheduleJsonEditor.value;
            if (!jsonContent) {
                if (!silentNoData) {
                    alert('Please load or import schedule data first.');
                }
                return false;
            }

            try {
                currentScheduleData = JSON.parse(jsonContent);
            } catch (e) {
                if (!silentNoData) {
                    alert('Invalid JSON in editor. Please fix errors before opening visual editor.\n' + e.message);
                }
                return false;
            }

            try {
                initScheduleView(false); // False = don't preserve, reset to today
                visualContainer.style.display = 'block';
                document.body.style.overflow = 'hidden';
                return true;
            } catch (e) {
                console.error('Visual editor failed to render schedule:', e);
                if (!silentNoData) {
                    alert('Failed to render schedule view (JSON parsed OK, but rendering crashed). See browser console for details.\n\n' + (e && e.message ? e.message : e));
                }
                return false;
            }
        }

        // Open Visual Editor
        openBtn.addEventListener('click', () => {
            openVisualEditorPanel();
        });

        // Close Visual Editor
        closeBtn.addEventListener('click', () => {
            if (returnToUrl) {
                window.location.href = returnToUrl;
                return;
            }

            visualContainer.style.display = 'none';
            document.body.style.overflow = '';
        });

        if (shouldAutoOpenVisualEditor) {
            const tryOpenIfJsonReady = () => {
                const hasJson = Boolean(scheduleJsonEditor && String(scheduleJsonEditor.value || '').trim());
                if (!hasJson) return false;
                openVisualEditorPanel({ silentNoData: true });
                return true;
            };

            const handleScheduleLoaded = (evt) => {
                const hasData = Boolean(evt && evt.detail && evt.detail.hasData);
                if (hasData) {
                    openVisualEditorPanel({ silentNoData: true });
                } else {
                    openVisualEditorPanel();
                }
            };

            if (!tryOpenIfJsonReady()) {
                window.addEventListener('admin:schedule-json-loaded', handleScheduleLoaded, { once: true });

                if (window.__adminScheduleJsonLoaded) {
                    window.dispatchEvent(new CustomEvent('admin:schedule-json-loaded', {
                        detail: { hasData: Boolean(window.__adminScheduleJsonHasData) }
                    }));
                }
            }
        }

        // Save Visual Editor data to Firebase using the existing JSON save flow.
        if (visualSaveBtn) {
            visualSaveBtn.addEventListener('click', () => {
                clearVisualEditorError('ve-save-error');

                if (!currentScheduleData) {
                    alert('No schedule data loaded to save.');
                    return;
                }

                if (!scheduleJsonEditor) {
                    alert('Schedule JSON editor is missing. Cannot save.');
                    return;
                }

                // Auto-clean stale/duplicate/invalid override entries before saving.
                const cleanupSummary = cleanupOverrides(currentScheduleData);
                if (cleanupSummary.removed.length > 0) {
                    try {
                        console.warn('[Schedule cleanup] Auto-removed override entries:', cleanupSummary.removed);
                    } catch (_) { /* noop */ }
                    const reasons = {};
                    cleanupSummary.removed.forEach((r) => {
                        reasons[r.reason] = (reasons[r.reason] || 0) + 1;
                    });
                    const reasonSummary = Object.keys(reasons)
                        .map((k) => `${reasons[k]} ${k}`)
                        .join(', ');
                    if (typeof showAdminNotification === 'function') {
                        showAdminNotification(`Cleaned ${cleanupSummary.removed.length} stale override entr${cleanupSummary.removed.length === 1 ? 'y' : 'ies'} (${reasonSummary}). See console for details.`, 'info');
                    } else {
                        console.info(`[Schedule cleanup] Removed ${cleanupSummary.removed.length} entries: ${reasonSummary}`);
                    }
                }

                const invalidTime = findInvalidScheduleTime(currentScheduleData);
                if (invalidTime) {
                    setVisualEditorError('ve-save-error', invalidTime.message);
                    return;
                }

                scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);

                if (saveScheduleJsonBtn) {
                    window.__adminSilentScheduleSaveNotification = true;
                    saveScheduleJsonBtn.click();
                } else {
                    alert('Main Save JSON button not found.');
                }
            });
        }

        // Mode Selector
        if (modeSelector) {
            modeSelector.addEventListener('change', (e) => {
                viewMode = e.target.value;
                currentWeekIndex = 0;
                initScheduleView(false);
            });
        }

        // Initialize Schedule Logic
        function initScheduleView(preservePosition = false) {
            if (!currentScheduleData) return;
            
            // Legacy Migration
            if (currentScheduleData.template && (!currentScheduleData.templates || Object.keys(currentScheduleData.templates).length === 0)) {
                if (!currentScheduleData.templates) currentScheduleData.templates = {};
                currentScheduleData.templates.winter = JSON.parse(JSON.stringify(currentScheduleData.template));
            }

            // Legacy Migration: Semester Config
            if (currentScheduleData.semester && (!currentScheduleData.semesters || !currentScheduleData.semesters.winter)) {
                if (!currentScheduleData.semesters) currentScheduleData.semesters = {};
                currentScheduleData.semesters.winter = {
                    id: 'winter',
                    name: 'Winter Semester',
                    startDate: currentScheduleData.semester.startDate,
                    endDate: currentScheduleData.semester.endDate,
                    examPeriod: currentScheduleData.semester.examPeriod,
                    christmasBreak: currentScheduleData.semester.christmasBreak
                };
            }

            // Ensure structure
            if (!currentScheduleData.semesters) currentScheduleData.semesters = {};
            if (!currentScheduleData.templates) currentScheduleData.templates = {};
            if (!currentScheduleData.weeks) currentScheduleData.weeks = [];
            if (!currentScheduleData.exams) currentScheduleData.exams = [];
            
            // Only regenerate if weeks are missing (or explicit reset needed, handled elsewhere)
            if (currentScheduleData.weeks.length === 0) {
                regenerateAllWeeks();
            }

            if (viewMode === 'schedule') {
                scheduleByWeek = generateWeeksFromTemplate(currentScheduleData);
                if (!preservePosition) {
                    currentWeekIndex = findCurrentWeekIndex();
                } else {
                    // Ensure index is still valid
                    if (currentWeekIndex >= scheduleByWeek.length) currentWeekIndex = scheduleByWeek.length - 1;
                    if (currentWeekIndex < 0) currentWeekIndex = 0;
                }
                document.getElementById('ve-prev-week-btn').disabled = false;
                document.getElementById('ve-next-week-btn').disabled = false;
            } else if (viewMode.startsWith('template-')) {
                const semKey = viewMode.replace('template-', '');
                scheduleByWeek = generateTemplateView(semKey);
                currentWeekIndex = 0;
                document.getElementById('ve-prev-week-btn').disabled = true;
                document.getElementById('ve-next-week-btn').disabled = true;
            }

            updateWeekControlsVisibility();
            
            renderSchedule();
            updateWeekInfo();
        }

        function updateWeekControlsVisibility() {
            const prevBtn = document.getElementById('ve-prev-week-btn');
            const nextBtn = document.getElementById('ve-next-week-btn');
            const editBtn = document.getElementById('ve-edit-week-btn');
            const weekSelector = document.querySelector('.week-selector');
            const isTemplateMode = viewMode.startsWith('template-');

            if (prevBtn) prevBtn.style.display = isTemplateMode ? 'none' : '';
            if (nextBtn) nextBtn.style.display = isTemplateMode ? 'none' : '';
            if (editBtn) editBtn.style.display = isTemplateMode ? 'none' : '';
            if (weekSelector) weekSelector.classList.toggle('template-mode', isTemplateMode);
        }
        
        function generateTemplateView(semKey) {
            const template = (currentScheduleData.templates && currentScheduleData.templates[semKey]) || [];
            return [{
                weekNumber: 0,
                startDate: "Template View",
                schedule: JSON.parse(JSON.stringify(template)),
                semester: semKey,
                isTemplateMode: true,
                type: 'normal'
            }];
        }

        function generateWeeksFromTemplate(config) {
            const weeks = [];
            const overrides = config.overrides || {};
            const addedExamPeriods = new Set(); // Track which exam periods we've already added

            const processedTemplates = {};
            if (config.templates) {
                Object.keys(config.templates).forEach(sem => {
                    processedTemplates[sem] = config.templates[sem];
                });
            } else {
                const template = config.template || [];
                processedTemplates['winter'] = template;
                processedTemplates['summer'] = [];
            }
            
            config.weeks.forEach((week, index) => {
                const weekNumber = index + 1;
                const weekStartDateStr = week.startDate; 

                let semesterKey = 'winter'; 
                if (config.semesters) {
                    const keys = Object.keys(config.semesters).sort((a, b) => config.semesters[a].startDate.localeCompare(config.semesters[b].startDate));
                    for (const key of keys) {
                        if (weekStartDateStr >= config.semesters[key].startDate) {
                            semesterKey = key;
                        }
                    }
                }

                // Auto-detect if this week overlaps with any exam period
                let matchingExamPeriod = null;
                const weekDate = new Date(weekStartDateStr);
                const weekEndDate = new Date(weekDate);
                weekEndDate.setDate(weekEndDate.getDate() + 6); // Week spans Monday to Sunday
                
                if (config.semesters) {
                    for (const semKey in config.semesters) {
                        const sem = config.semesters[semKey];
                        if (sem.examPeriod && sem.examPeriod.start && sem.examPeriod.end) {
                            const examStart = new Date(sem.examPeriod.start);
                            const examEnd = new Date(sem.examPeriod.end);
                            examStart.setHours(0, 0, 0, 0);
                            examEnd.setHours(0, 0, 0, 0);
                            weekDate.setHours(0, 0, 0, 0);
                            weekEndDate.setHours(0, 0, 0, 0);
                            
                            // Check if week overlaps with exam period at all
                            if (weekDate <= examEnd && weekEndDate >= examStart) {
                                matchingExamPeriod = { key: semKey, ...sem.examPeriod };
                                break;
                            }
                        }
                    }
                }

                // Skip weeks that overlap with exam periods - but add the exam period once
                if (matchingExamPeriod) {
                    const examKey = `${matchingExamPeriod.start}_${matchingExamPeriod.end}`;
                    if (!addedExamPeriods.has(examKey)) {
                        addedExamPeriods.add(examKey);
                        weeks.push({
                            weekNumber: weekNumber,
                            startDate: matchingExamPeriod.start,
                            endDate: matchingExamPeriod.end,
                            schedule: [],
                            semester: semesterKey,
                            type: 'exam'
                        });
                    }
                    return; // Skip this week
                }

                const currentTemplate = processedTemplates[semesterKey] || [];
                let schedule = JSON.parse(JSON.stringify(currentTemplate));
                
                // Apply overrides
                if (overrides[weekNumber]) {
                    overrides[weekNumber].forEach(override => {
                        // Firebase leaves null slots when array elements are deleted in
                        // the middle. Skip them so rendering doesn't crash.
                        if (!override) return;
                        if (override.removeDay) {
                            schedule = schedule.filter(item => item.day !== override.removeDay);
                        } else if (override.remove) {
                            schedule = schedule.filter(item => 
                                !(item.day === override.day && 
                                  item.subject === override.subject && 
                                  item.startTime === override.startTime)
                            );
                        } else if (override.changes) {
                            if (override.changes.removed === true) {
                                schedule = schedule.filter(item => 
                                    !(item.day === override.day && 
                                      item.subject === override.subject && 
                                      item.startTime === override.startTime)
                                );
                            } else {
                                const itemIndex = schedule.findIndex(item => 
                                    item.day === override.day && 
                                    item.subject === override.subject && 
                                    item.startTime === override.startTime
                                );
                                if (itemIndex !== -1) {
                                    Object.assign(schedule[itemIndex], override.changes);
                                }
                            }
                        } else {
                            schedule.push({ ...override });
                        }
                    });
                }
                
                weeks.push({
                    weekNumber: weekNumber,
                    startDate: week.startDate,
                    schedule: schedule,
                    semester: semesterKey,
                    type: 'normal'
                });
            });
            return weeks;
        }

        function findCurrentWeekIndex() {
            if (scheduleByWeek.length === 0) return 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            for (let i = 0; i < scheduleByWeek.length; i++) {
                const week = scheduleByWeek[i];
                const start = new Date(week.startDate);
                start.setHours(0,0,0,0);
                
                let end;
                if (week.type === 'exam' && week.endDate) {
                    end = new Date(week.endDate);
                } else {
                    end = new Date(start);
                    end.setDate(end.getDate() + 6);
                }
                end.setHours(0,0,0,0);
                
                if (today >= start && today <= end) {
                    return i;
                }
            }
            return Math.max(0, scheduleByWeek.length - 1);
        }

        function changeWeek(direction) {
            const newIndex = currentWeekIndex + direction;
            if (newIndex >= 0 && newIndex < scheduleByWeek.length) {
                currentWeekIndex = newIndex;
                renderSchedule();
                updateWeekInfo();
            }
        }

        window.changeWeekAdmin = changeWeek;

        function updateWeekInfo() {
            const currentWeek = scheduleByWeek[currentWeekIndex];
            if (!currentWeek) return;
            
            const infoEl = document.getElementById('ve-week-info');

            if (currentWeek.isTemplateMode) {
                infoEl.textContent = `Editing Template: ${currentWeek.semester.toUpperCase()}`;
                infoEl.style.color = '#e0e0e0';
                return;
            }

            const options = { day: 'numeric', month: 'long' };
            const start = new Date(currentWeek.startDate);
            let end;

            if (currentWeek.type === 'exam') {
                // For exam weeks, calculate end date from exam period or use endDate if set
                if (currentWeek.endDate) {
                    end = new Date(currentWeek.endDate);
                } else {
                    // Try to get end date from the semester's exam period
                    const currentSem = currentScheduleData.semesters[currentWeek.semester];
                    if (currentSem && currentSem.examPeriod && currentSem.examPeriod.end) {
                        end = new Date(currentSem.examPeriod.end);
                    } else {
                        // Fallback: use week end
                        end = new Date(start);
                        end.setDate(end.getDate() + 6);
                    }
                }
                infoEl.style.color = '#d87060';
                infoEl.textContent = `EXAM SEASON: ${start.toLocaleDateString('bg-BG', options)} - ${end.toLocaleDateString('bg-BG', options)}`;
            } else {
                end = new Date(start);
                end.setDate(end.getDate() + 6);
                
                // Calculate relative week number
                let relativeWeekNum = 1;
                const currentSem = currentScheduleData.semesters[currentWeek.semester];
                if (currentSem && currentSem.startDate) {
                    const semStart = new Date(currentSem.startDate);
                    const diffTime = start - semStart;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    relativeWeekNum = Math.floor(diffDays / 7) + 1;
                }
                if (relativeWeekNum < 1) relativeWeekNum = 1;

                infoEl.style.color = '#e0e0e0';
                infoEl.textContent = `Week ${relativeWeekNum}: ${start.toLocaleDateString('bg-BG', options)} - ${end.toLocaleDateString('bg-BG', options)}`;
            }
        }

        function renderSchedule() {
            const currentWeek = scheduleByWeek[currentWeekIndex];
            
            if (currentWeek.type === 'exam') {
                scheduleTable.style.display = 'none';
                examEditorView.style.display = 'block';
                renderExamView(currentWeek);
            } else {
                scheduleTable.style.display = 'table';
                examEditorView.style.display = 'none';
                renderTableView(currentWeek);
            }
        }

        function renderTableView(currentWeek) {
            const days = ['ПОН', 'ВТ', 'СР', 'ЧЕТ', 'ПЕТ'];
            const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

            // Update table headers FIRST so any later error doesn't strand them on stale text.
            const headerRow = document.querySelector('#ve-schedule-table thead tr');
            if (headerRow) {
                const ths = headerRow.querySelectorAll('th');
                let baseDate = null;
                if (currentWeek && currentWeek.startDate) {
                    const parsed = new Date(currentWeek.startDate);
                    if (!Number.isNaN(parsed.getTime())) baseDate = parsed;
                }
                ths.forEach((th, i) => {
                    if (baseDate) {
                        const d = new Date(baseDate);
                        d.setDate(d.getDate() + i);
                        const day = d.getDate();
                        const mon = d.getMonth() + 1;
                        const dateStr = `${day}.${mon < 10 ? '0' + mon : mon}`;
                        th.innerHTML = `<div class="ve-th-day">${dayNames[i]}</div><div class="ve-th-date">${dateStr}</div>`;
                    } else {
                        // Template mode (no real start date) — keep just the day name with the styled label class so layout is consistent.
                        th.innerHTML = `<div class="ve-th-day">${dayNames[i]}</div>`;
                    }
                });
            }

            const tbody = document.getElementById('ve-schedule-body');
            if (tbody) tbody.innerHTML = '';

            const scheduleData = currentWeek.schedule;
            
            const eventsByDay = {};
            days.forEach(day => {
                eventsByDay[day] = scheduleData
                    .filter(item => item.day === day)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
            });
            
            const maxEvents = Math.max(...days.map(day => eventsByDay[day].length), 1);
            
            for (let i = 0; i < maxEvents; i++) {
                const row = document.createElement('tr');
                days.forEach(day => {
                    const td = document.createElement('td');
                    const event = eventsByDay[day][i];
                    
                    if (event) {
                        const item = document.createElement('div');
                        item.className = `schedule-item type-${getTypeClass(event.type)}`;
                        item.innerHTML = `
                            <div class="schedule-subject">${event.subject}</div>
                            <div class="schedule-time">${event.startTime} - ${event.endTime || '?'}</div>
                        `;
                        item.onclick = (e) => {
                            e.stopPropagation();
                            openEditModal(event, day);
                        };
                        td.appendChild(item);
                    }
                    
                    const addBtn = document.createElement('div');
                    addBtn.className = 'add-event-btn-cell';
                    addBtn.textContent = '+ Add';
                    addBtn.onclick = () => openAddModal(day);
                    td.appendChild(addBtn);
                    
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            }
        }

        // --- EXAM VIEW Logic ---
        function renderExamView(currentWeek) {
            examListContainer.innerHTML = '';
            examListContainer.style.maxWidth = '1280px';
            examListContainer.style.gap = '18px';

            const allExams = currentScheduleData.exams || [];

            // Parse YYYY-MM-DD as local-midnight to avoid UTC timezone shifting the
            // boundary day on positive-UTC machines (Bulgaria is UTC+2/+3).
            const parseLocalDate = (value) => {
                if (value instanceof Date) {
                    const copy = new Date(value.getTime());
                    copy.setHours(0, 0, 0, 0);
                    return copy;
                }
                if (typeof value === 'string') {
                    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
                    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
                }
                const d = new Date(value);
                if (Number.isNaN(d.getTime())) return null;
                d.setHours(0, 0, 0, 0);
                return d;
            };

            const periodStart = parseLocalDate(currentWeek.startDate) || new Date();
            const periodEnd = parseLocalDate(currentWeek.endDate) || new Date();
            periodStart.setHours(0, 0, 0, 0);
            periodEnd.setHours(0, 0, 0, 0);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const months = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];
            const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

            const ymd = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c]));

            // Build day -> events map. Each exam contributes a 'regular' event on
            // examDate and (if set) a 'retake' event on retakeDate.
            const dayEvents = new Map();
            const addEvent = (dateStr, type, exam, examIndex) => {
                const d = parseLocalDate(dateStr);
                if (!d) return;
                const key = ymd(d);
                if (!dayEvents.has(key)) dayEvents.set(key, []);
                dayEvents.get(key).push({
                    type,
                    exam,
                    examIndex,
                    time: type === 'regular' ? (exam.examTime || '') : (exam.retakeTime || '')
                });
            };
            allExams.forEach((exam, i) => {
                addEvent(exam.examDate, 'regular', exam, i);
                if (exam.retakeDate) addEvent(exam.retakeDate, 'retake', exam, i);
            });

            const openAddForDate = (dateStr) => {
                currentEditingExamIndex = -1;
                if (examForm && typeof examForm.reset === 'function') examForm.reset();
                const dateInput = document.getElementById('ex-date');
                if (dateInput) dateInput.value = dateStr;
                const exDeleteBtn = document.getElementById('ex-delete-btn');
                if (exDeleteBtn) exDeleteBtn.style.display = 'none';
                showExamEditor();
                document.getElementById('exam-modal').style.display = 'flex';
            };

            const buildMonthGrid = (year, month, mode) => {
                const wrap = document.createElement('div');
                wrap.className = 've-cal-month';

                const header = document.createElement('div');
                header.className = 've-cal-header';
                header.innerHTML = '<span class="ve-cal-header-accent"></span>' +
                    `<span class="ve-cal-header-text">${escapeHtml(months[month])} ${year}</span>`;
                wrap.appendChild(header);

                const weekdayRow = document.createElement('div');
                weekdayRow.className = 've-cal-weekdays';
                dayNames.forEach((name, idx) => {
                    const c = document.createElement('div');
                    c.className = 've-cal-weekday' + (idx >= 5 ? ' ve-cal-weekday-weekend' : '');
                    c.textContent = name;
                    weekdayRow.appendChild(c);
                });
                wrap.appendChild(weekdayRow);

                const grid = document.createElement('div');
                grid.className = 've-cal-grid';

                const firstOfMonth = new Date(year, month, 1);
                // JS getDay: Sun=0..Sat=6 — convert to Mon=0..Sun=6 to match header.
                const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
                const lastDay = new Date(year, month + 1, 0).getDate();

                let renderUpTo = lastDay;
                if (mode === 'cropped') {
                    // Render through the end of the week containing periodEnd.
                    const cropDay = periodEnd.getDate();
                    const cropWeekday = (periodEnd.getDay() + 6) % 7;
                    renderUpTo = Math.min(lastDay, cropDay + (6 - cropWeekday));
                }

                // Padding cells before day 1 (first row's empty slots).
                for (let i = 0; i < firstWeekday; i += 1) {
                    const cell = document.createElement('div');
                    cell.className = 've-cal-cell ve-cal-cell-pad';
                    grid.appendChild(cell);
                }

                for (let day = 1; day <= renderUpTo; day += 1) {
                    const date = new Date(year, month, day);
                    date.setHours(0, 0, 0, 0);
                    const inPeriod = date >= periodStart && date <= periodEnd;
                    const isToday = date.getTime() === today.getTime();
                    const key = ymd(date);
                    const events = dayEvents.get(key) || [];
                    const dowIdx = (date.getDay() + 6) % 7;
                    const isWeekend = dowIdx >= 5;

                    // We'll only ever have at most one exam per day. If the data
                    // somehow has both a regular and a retake on the same day,
                    // prefer the regular exam (regulars are the primary event;
                    // retakes are reschedules).
                    const primaryEvent = events.find((e) => e.type === 'regular') || events[0] || null;

                    const cell = document.createElement('div');
                    const classes = ['ve-cal-cell'];
                    classes.push(inPeriod ? 've-cal-cell-in' : 've-cal-cell-out');
                    if (primaryEvent) {
                        classes.push('ve-cal-cell-has');
                        if (primaryEvent.type === 'retake') classes.push('ve-cal-cell-retake');
                    }
                    if (isWeekend && inPeriod && !primaryEvent) classes.push('ve-cal-cell-weekend');
                    if (isToday) classes.push('ve-cal-cell-today');
                    cell.className = classes.join(' ');

                    const dayRow = document.createElement('div');
                    dayRow.className = 've-cal-day';
                    dayRow.innerHTML = `<span class="ve-cal-day-num">${day}</span>`;
                    cell.appendChild(dayRow);

                    if (primaryEvent) {
                        const label = document.createElement('div');
                        label.className = 've-cal-exam-label';
                        const subj = primaryEvent.exam.subject || '?';
                        const fullName = primaryEvent.exam.fullName || primaryEvent.exam.subject || '';
                        const typeLabel = primaryEvent.type === 'regular' ? 'Редовен' : 'Поправка';
                        cell.title = `${typeLabel}: ${fullName}${primaryEvent.time ? ' @ ' + primaryEvent.time : ''}`;
                        // Render BOTH the full name and the short abbreviation.
                        // CSS shows one or the other based on viewport width:
                        // desktop = full name; mobile = abbreviation.
                        label.innerHTML =
                            `<span class="ve-cal-exam-subj ve-cal-exam-subj-full">${escapeHtml(fullName)}</span>` +
                            `<span class="ve-cal-exam-subj ve-cal-exam-subj-short">${escapeHtml(subj)}</span>` +
                            (primaryEvent.time ? `<span class="ve-cal-exam-time">${escapeHtml(primaryEvent.time)}</span>` : '');
                        cell.appendChild(label);

                        cell.addEventListener('click', () => {
                            openExamEditor(primaryEvent.examIndex);
                        });
                    } else if (inPeriod) {
                        cell.addEventListener('click', () => {
                            openAddForDate(key);
                        });
                    }

                    grid.appendChild(cell);
                }

                wrap.appendChild(grid);
                return wrap;
            };

            // Render every month from periodStart through periodEnd. The last month
            // is cropped to the week containing periodEnd; earlier months render in
            // full so the user sees the full first month, then progressively fewer
            // rows for the trailing month.
            const startKey = periodStart.getFullYear() * 12 + periodStart.getMonth();
            const endKey = periodEnd.getFullYear() * 12 + periodEnd.getMonth();
            for (let key = startKey; key <= endKey; key += 1) {
                const year = Math.floor(key / 12);
                const month = ((key % 12) + 12) % 12;
                const mode = (key === endKey && key !== startKey) ? 'cropped' : 'full';
                examListContainer.appendChild(buildMonthGrid(year, month, mode));
            }

            // Legend
            const legend = document.createElement('div');
            legend.className = 've-cal-legend';
            legend.innerHTML =
                '<span><span class="ve-cal-legend-dot" style="background:#d27260;border:1px solid #8b4438;"></span>Редовен изпит</span>' +
                '<span><span class="ve-cal-legend-dot" style="background:#5d97b8;border:1px solid #2f5670;"></span>Поправка</span>' +
                '<span class="ve-cal-legend-hint">Click any empty day to add a new exam</span>';
            examListContainer.appendChild(legend);

            if (dayEvents.size === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.cssText = 'text-align:center;color:#888;padding:14px;font-size:14px;';
                emptyMsg.textContent = 'No exams in this period yet. Click any day to add one.';
                examListContainer.appendChild(emptyMsg);
            }
        }

        if (addExamBtnInView) {
            addExamBtnInView.onclick = () => {
                currentEditingExamIndex = -1;
                examForm.reset();
                
                // PRE-FILL DATE with start date of current exam season!
                const currentWeek = scheduleByWeek[currentWeekIndex];
                if (currentWeek && currentWeek.type === 'exam' && currentWeek.startDate) {
                    document.getElementById('ex-date').value = currentWeek.startDate;
                }
                
                document.getElementById('ex-delete-btn').style.display = 'none';
                showExamEditor();
                document.getElementById('exam-modal').style.display = 'flex';
            };
        }

        function getTypeClass(type) {
            const map = {
                'Упражнение': 'exercise',
                'Лекция': 'lecture',
                'Важна лекция': 'important-lecture',
                'Колоквиум': 'exam',
                'Тест': 'test',
                'Поправка на Колоквиум': 'makeup'
            };
            return map[type] || 'lecture';
        }

        // --- Editing Logic ---

        const modal = document.getElementById('ve-modal');
        const modalForm = document.getElementById('ve-event-form');
        const deleteBtn = document.getElementById('ve-delete-btn');
        let currentEditingEvent = null;
        let currentEditingDay = null;

        function openEditModal(event, day) {
            currentEditingEvent = event;
            currentEditingDay = day;
            
            document.getElementById('ve-modal-title').textContent = 'Edit Event';
            document.getElementById('ve-subject').value = event.subject || '';
            document.getElementById('ve-fullname').value = event.fullName || '';
            document.getElementById('ve-type').value = event.type || 'Лекция';
            document.getElementById('ve-start').value = event.startTime || '';
            document.getElementById('ve-end').value = event.endTime || '';
            document.getElementById('ve-teacher').value = event.teacher || '';
            
            // Smart Load: Migrate old room/floor to building/room
            // If building is missing but room is present, assume room->building (old schema)
            // If room is missing but floor is present, assume floor->room (old schema)
            const buildingVal = event.building || (event.floor ? event.room : ''); // Heuristic: if floor exists, room was likely building
            const roomVal = (event.building ? event.room : (event.floor || event.room)) || ''; 
            
            document.getElementById('ve-building-input').value = buildingVal;
            document.getElementById('ve-room-input').value = roomVal;
            
            document.getElementById('ve-info').value = event.additionalInfo || '';

            clearVisualEditorError('ve-event-error');
            markInvalidTimeInputs();
            deleteBtn.style.display = 'block';
            modal.style.display = 'flex';
        }

        function openAddModal(day) {
            currentEditingEvent = null;
            currentEditingDay = day;
            
            document.getElementById('ve-modal-title').textContent = `Add Event (${day})`;
            modalForm.reset();
            document.getElementById('ve-type').value = 'Лекция';
            
            clearVisualEditorError('ve-event-error');
            markInvalidTimeInputs();
            deleteBtn.style.display = 'none';
            modal.style.display = 'flex';
        }

        window.closeVeModal = () => {
            clearVisualEditorError('ve-event-error');
            markInvalidTimeInputs();
            modal.style.display = 'none';
        };

        ['ve-start', 've-end'].forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('input', () => {
                clearVisualEditorError('ve-event-error');
                markInvalidTimeInputs();
            });
        });

        // Handle Save Event
        document.getElementById('ve-save-btn').addEventListener('click', () => {
            const getVal = (id) => {
                const el = document.getElementById(id);
                if (!el) {
                    console.error(`Missing element: ${id}`);
                    return '';
                }
                return el.value;
            };

            const newEventData = {
                day: currentEditingDay,
                subject: getVal('ve-subject'),
                fullName: getVal('ve-fullname'),
                type: getVal('ve-type'),
                startTime: getVal('ve-start').trim(),
                endTime: getVal('ve-end').trim(),
                teacher: getVal('ve-teacher'),
                building: getVal('ve-building-input'),
                room: getVal('ve-room-input'),
                floor: undefined, // Clear legacy floor
                additionalInfo: getVal('ve-info')
            };

            const timeValidation = validateEventTimes(newEventData.startTime, newEventData.endTime);
            if (!timeValidation.ok) {
                setVisualEditorError('ve-event-error', timeValidation.message);
                markInvalidTimeInputs(timeValidation.fields);
                const firstInvalidId = timeValidation.fields[0];
                const firstInvalidEl = firstInvalidId ? document.getElementById(firstInvalidId) : null;
                if (firstInvalidEl) firstInvalidEl.focus();
                return;
            }

            clearVisualEditorError('ve-event-error');
            markInvalidTimeInputs();
            
            // Clean up undefined
            delete newEventData.floor;

            if (viewMode.startsWith('template-')) {
                const semKey = viewMode.replace('template-', '');
                if (!currentScheduleData.templates[semKey]) currentScheduleData.templates[semKey] = [];
                const template = currentScheduleData.templates[semKey];

                if (currentEditingEvent) {
                    const index = template.findIndex(t => t === currentEditingEvent || (t.day === currentEditingEvent.day && t.startTime === currentEditingEvent.startTime && t.subject === currentEditingEvent.subject));
                    if (index !== -1) template[index] = newEventData;
                } else {
                    template.push(newEventData);
                }
            } else {
                const currentWeek = scheduleByWeek[currentWeekIndex];
                const weekNum = (currentWeek && typeof currentWeek.weekNumber === 'number')
                    ? currentWeek.weekNumber
                    : currentWeekIndex + 1;
                if (!currentScheduleData.overrides) currentScheduleData.overrides = {};
                if (!currentScheduleData.overrides[weekNum]) currentScheduleData.overrides[weekNum] = [];

                if (currentEditingEvent) {
                    let currentTemplate = [];
                    if (currentScheduleData.templates) {
                        const currentWeek = scheduleByWeek[currentWeekIndex];
                        const semKey = currentWeek ? currentWeek.semester : 'winter';
                        currentTemplate = currentScheduleData.templates[semKey] || [];
                    } else {
                        currentTemplate = currentScheduleData.template || [];
                    }

                    const isTemplate = currentTemplate.some(t => 
                        t.day === currentEditingEvent.day && 
                        t.subject === currentEditingEvent.subject && 
                        t.startTime === currentEditingEvent.startTime
                    );

                    if (isTemplate) {
                        currentScheduleData.overrides[weekNum].push({
                            day: currentEditingEvent.day,
                            subject: currentEditingEvent.subject,
                            startTime: currentEditingEvent.startTime,
                            changes: { ...newEventData }
                        });
                    } else {
                        currentScheduleData.overrides[weekNum].push({
                            day: currentEditingEvent.day,
                            subject: currentEditingEvent.subject,
                            startTime: currentEditingEvent.startTime,
                            remove: true
                        });
                        currentScheduleData.overrides[weekNum].push(newEventData);
                    }
                } else {
                    currentScheduleData.overrides[weekNum].push(newEventData);
                }
            }
            updateAndClose(true); // Preserve position
        });

        // Handle Delete Event
        deleteBtn.addEventListener('click', () => {
            if (!confirm('Delete this event?')) return;

            if (viewMode.startsWith('template-')) {
                const semKey = viewMode.replace('template-', '');
                const template = currentScheduleData.templates[semKey];
                const index = template.findIndex(t => t === currentEditingEvent || (t.day === currentEditingEvent.day && t.startTime === currentEditingEvent.startTime && t.subject === currentEditingEvent.subject));
                if (index !== -1) template.splice(index, 1);
            } else {
                const currentWeek = scheduleByWeek[currentWeekIndex];
                const weekNum = (currentWeek && typeof currentWeek.weekNumber === 'number')
                    ? currentWeek.weekNumber
                    : currentWeekIndex + 1;
                if (!currentScheduleData.overrides) currentScheduleData.overrides = {};
                if (!currentScheduleData.overrides[weekNum]) currentScheduleData.overrides[weekNum] = [];

                currentScheduleData.overrides[weekNum].push({
                    day: currentEditingEvent.day,
                    subject: currentEditingEvent.subject,
                    startTime: currentEditingEvent.startTime,
                    remove: true
                });
            }
            updateAndClose(true);
        });

        function updateAndClose(preservePosition = false) {
            scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);
            initScheduleView(preservePosition);
            closeVeModal();
        }

        // --- Exam Editor Logic (Modal) ---
        
        const examModal = document.getElementById('exam-modal');
        const examEditView = document.getElementById('exam-edit-view');
        const examListView = document.getElementById('exam-list-view');
        const examForm = document.getElementById('exam-form');
        
        const exCancelBtn = document.getElementById('ex-cancel-btn');
        const exSaveBtn = document.getElementById('ex-save-btn');
        const exDeleteBtn = document.getElementById('ex-delete-btn');
        
        let currentEditingExamIndex = -1;

        window.closeExamModal = () => {
            examModal.style.display = 'none';
        };

        function showExamEditor() {
            if (examListView) examListView.style.display = 'none';
            if (examEditView) examEditView.style.display = 'block';
        }

        function openExamEditor(index) {
            currentEditingExamIndex = index;
            const exam = currentScheduleData.exams[index];
            
            document.getElementById('ex-subject').value = exam.subject || '';
            document.getElementById('ex-fullname').value = exam.fullName || '';
            document.getElementById('ex-date').value = exam.examDate || '';
            document.getElementById('ex-time').value = exam.examTime || '';
            document.getElementById('ex-location').value = exam.examLocation || '';
            document.getElementById('ex-retake-date').value = exam.retakeDate || '';
            document.getElementById('ex-retake-time').value = exam.retakeTime || '';
            document.getElementById('ex-info').value = exam.additionalInfo || '';
            document.getElementById('ex-calc').checked = !!exam.hasCalculatorPharmacology1;
            
            exDeleteBtn.style.display = 'inline-block';
            showExamEditor();
            examModal.style.display = 'flex';
        }

        exCancelBtn.addEventListener('click', () => {
            examModal.style.display = 'none';
        });

        exSaveBtn.addEventListener('click', () => {
            const newExam = {
                subject: document.getElementById('ex-subject').value,
                fullName: document.getElementById('ex-fullname').value,
                examDate: document.getElementById('ex-date').value,
                examTime: document.getElementById('ex-time').value,
                examLocation: document.getElementById('ex-location').value,
                retakeDate: document.getElementById('ex-retake-date').value,
                retakeTime: document.getElementById('ex-retake-time').value,
                retakeLocation: '',
                additionalInfo: document.getElementById('ex-info').value,
                hasCalculatorPharmacology1: document.getElementById('ex-calc').checked
            };

            if (!currentScheduleData.exams) currentScheduleData.exams = [];

            if (currentEditingExamIndex >= 0) {
                currentScheduleData.exams[currentEditingExamIndex] = newExam;
            } else {
                currentScheduleData.exams.push(newExam);
            }

            updateAndClose(true); // Preserve position!
            renderExamView(scheduleByWeek[currentWeekIndex]);
            examModal.style.display = 'none';
        });

        exDeleteBtn.addEventListener('click', () => {
            if (currentEditingExamIndex >= 0 && confirm('Delete this exam?')) {
                currentScheduleData.exams.splice(currentEditingExamIndex, 1);
                updateAndClose(true);
                renderExamView(scheduleByWeek[currentWeekIndex]);
                examModal.style.display = 'none';
            }
        });

        // --- Semester Manager Logic ---

        const semesterModal = document.getElementById('semester-modal');
        const semesterList = document.getElementById('semester-list');
        const semesterListView = document.getElementById('semester-list-view');
        const semesterEditView = document.getElementById('semester-edit-view');
        const semesterForm = document.getElementById('semester-form');

        const addSemesterBtn = document.getElementById('add-semester-btn');
        const semCancelBtn = document.getElementById('sem-cancel-btn');
        const semSaveBtn = document.getElementById('sem-save-btn');
        const semDeleteBtn = document.getElementById('sem-delete-btn');

        let currentEditingSemId = null;

        if (manageSemestersBtn) {
            manageSemestersBtn.addEventListener('click', () => {
                renderSemesterList();
                showSemesterList();
                semesterModal.style.display = 'flex';
            });
        }

        window.closeSemesterModal = () => {
            semesterModal.style.display = 'none';
        };

        function renderSemesterList() {
            if (!currentScheduleData.semesters) currentScheduleData.semesters = {};
            semesterList.innerHTML = '';
            
            const semesters = currentScheduleData.semesters;
            const keys = Object.keys(semesters);

            if (keys.length === 0) {
                semesterList.innerHTML = '<li style="padding:10px; color:#888;">No semesters found.</li>';
                return;
            }

            keys.sort((a, b) => new Date(semesters[a].startDate) - new Date(semesters[b].startDate));

            keys.forEach(key => {
                const sem = semesters[key];
                const li = document.createElement('li');
                li.style.cssText = 'padding: 10px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; cursor: pointer;';
                li.innerHTML = `
                    <div>
                        <div style="font-weight:bold; color: #588157;">${sem.name || key}</div>
                        <div style="font-size: 0.9em; color: #aaa;">${sem.startDate} - ${sem.endDate}</div>
                    </div>
                    <button class="btn btn-secondary" style="width: auto; padding: 4px 8px; font-size: 12px;">Edit</button>
                `;
                li.onclick = () => openSemesterEditor(key);
                semesterList.appendChild(li);
            });
        }

        function showSemesterList() {
            semesterListView.style.display = 'block';
            semesterEditView.style.display = 'none';
        }

        function showSemesterEditor() {
            semesterListView.style.display = 'none';
            semesterEditView.style.display = 'block';
        }

        function openSemesterEditor(key) {
            currentEditingSemId = key;
            const sem = currentScheduleData.semesters[key];
            
            document.getElementById('sem-id').value = key || '';
            document.getElementById('sem-id').disabled = !!key;
            document.getElementById('sem-name').value = sem.name || '';
            document.getElementById('sem-start').value = sem.startDate || '';
            document.getElementById('sem-end').value = sem.endDate || '';
            
            document.getElementById('sem-exam-start').value = sem.examPeriod ? sem.examPeriod.start : '';
            document.getElementById('sem-exam-end').value = sem.examPeriod ? sem.examPeriod.end : '';
            
            document.getElementById('sem-break-start').value = sem.christmasBreak ? sem.christmasBreak.start : '';
            document.getElementById('sem-break-end').value = sem.christmasBreak ? sem.christmasBreak.end : '';
            
            semDeleteBtn.style.display = 'inline-block';
            showSemesterEditor();
        }

        addSemesterBtn.addEventListener('click', () => {
            currentEditingSemId = null;
            semesterForm.reset();
            document.getElementById('sem-id').disabled = false;
            semDeleteBtn.style.display = 'none';
            showSemesterEditor();
        });

        semCancelBtn.addEventListener('click', () => {
            showSemesterList();
        });

        semSaveBtn.addEventListener('click', () => {
            const id = document.getElementById('sem-id').value.trim();
            if (!id) { alert('ID is required'); return; }

            const newSem = {
                id: id,
                name: document.getElementById('sem-name').value,
                startDate: document.getElementById('sem-start').value,
                endDate: document.getElementById('sem-end').value,
                examPeriod: {
                    start: document.getElementById('sem-exam-start').value,
                    end: document.getElementById('sem-exam-end').value
                },
                christmasBreak: {
                    start: document.getElementById('sem-break-start').value,
                    end: document.getElementById('sem-break-end').value
                }
            };

            if (!newSem.examPeriod.start && !newSem.examPeriod.end) delete newSem.examPeriod;
            if (!newSem.christmasBreak.start && !newSem.christmasBreak.end) delete newSem.christmasBreak;

            if (!currentScheduleData.semesters) currentScheduleData.semesters = {};
            currentScheduleData.semesters[id] = newSem;

            regenerateAllWeeks();

            scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);
            renderSemesterList();
            showSemesterList();
        });

        semDeleteBtn.addEventListener('click', () => {
            if (currentEditingSemId && confirm('Delete this semester? This will not remove the schedule overrides but will break navigation.')) {
                delete currentScheduleData.semesters[currentEditingSemId];
                regenerateAllWeeks();
                scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);
                renderSemesterList();
                showSemesterList();
            }
        });

        function regenerateAllWeeks() {
            currentScheduleData.weeks = [];
            const semesters = currentScheduleData.semesters;
            if (!semesters) return;

            const keys = Object.keys(semesters).sort((a, b) => new Date(semesters[a].startDate) - new Date(semesters[b].startDate));

            keys.forEach(key => {
                const sem = semesters[key];
                const start = new Date(sem.startDate);
                let end = new Date(sem.endDate);
                
                if (sem.examPeriod && sem.examPeriod.end) {
                    const examEnd = new Date(sem.examPeriod.end);
                    if (examEnd > end) {
                        end = examEnd;
                    }
                }

                let current = new Date(start);
                
                while (current <= end) {
                    const dateStr = current.toISOString().split('T')[0];
                    currentScheduleData.weeks.push({ startDate: dateStr });
                    current.setDate(current.getDate() + 7);
                }
            });
            
            // Sort
            currentScheduleData.weeks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
            
            // Dedupe
            currentScheduleData.weeks = currentScheduleData.weeks.filter((week, index, self) => 
                index === self.findIndex((t) => (t.startDate === week.startDate))
            );
            
            // Tag exam weeks
            keys.forEach(key => {
                const sem = semesters[key];
                if (sem.examPeriod && sem.examPeriod.start && sem.examPeriod.end) {
                    const examStart = new Date(sem.examPeriod.start);
                    const examEnd = new Date(sem.examPeriod.end);
                    examStart.setHours(0,0,0,0);
                    examEnd.setHours(0,0,0,0);
                    
                    currentScheduleData.weeks = currentScheduleData.weeks.filter(w => {
                        const wStart = new Date(w.startDate);
                        wStart.setHours(0,0,0,0);
                        if (wStart >= examStart && wStart <= examEnd) return false;
                        return true;
                    });
                    
                    currentScheduleData.weeks.push({
                        startDate: sem.examPeriod.start,
                        endDate: sem.examPeriod.end,
                        type: 'exam'
                    });
                }
            });
            
            currentScheduleData.weeks.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        }

        // --- Week Date Editor Logic ---
        const weekDateModal = document.getElementById('week-date-modal');
        const editWeekBtn = document.getElementById('ve-edit-week-btn');
        const wdSaveBtn = document.getElementById('wd-save-btn');
        const wdCancelBtn = document.getElementById('wd-cancel-btn');

        window.closeWeekDateModal = () => {
            if (weekDateModal) weekDateModal.style.display = 'none';
        };

        if (editWeekBtn) {
            editWeekBtn.addEventListener('click', () => {
                if (viewMode.startsWith('template-')) {
                    alert('Cannot edit week dates in Template mode.');
                    return;
                }
                const currentWeek = scheduleByWeek[currentWeekIndex];
                if (!currentWeek) return;

                document.getElementById('wd-start').value = currentWeek.startDate || '';
                document.getElementById('wd-end').value = currentWeek.endDate || '';
                document.getElementById('wd-type').value = currentWeek.type || 'normal';
                
                if (weekDateModal) weekDateModal.style.display = 'flex';
            });
        }

        if (wdCancelBtn) {
            wdCancelBtn.addEventListener('click', () => {
                if (weekDateModal) weekDateModal.style.display = 'none';
            });
        }

        if (wdSaveBtn) {
            wdSaveBtn.addEventListener('click', () => {
                const newStart = document.getElementById('wd-start').value;
                const newEnd = document.getElementById('wd-end').value;
                const newType = document.getElementById('wd-type').value;

                if (!newStart) {
                    alert('Start Date is required');
                    return;
                }
                
                if (currentScheduleData.weeks[currentWeekIndex]) {
                    currentScheduleData.weeks[currentWeekIndex].startDate = newStart;
                    if (newEnd) currentScheduleData.weeks[currentWeekIndex].endDate = newEnd;
                    else delete currentScheduleData.weeks[currentWeekIndex].endDate;
                    
                    if (newType !== 'normal') currentScheduleData.weeks[currentWeekIndex].type = newType;
                    else delete currentScheduleData.weeks[currentWeekIndex].type;
                }

                updateAndClose(true); 
                if (weekDateModal) weekDateModal.style.display = 'none';
            });
        }

    });
})();
