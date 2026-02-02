(function() {
    // Wait for marked to load
    window.addEventListener('DOMContentLoaded', () => {
        // Elements
        const openBtn = document.getElementById('open-visual-editor');
        const visualContainer = document.getElementById('visual-editor-container');
        const closeBtn = document.getElementById('close-visual-editor');
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

        // Open Visual Editor
        openBtn.addEventListener('click', () => {
            try {
                const jsonContent = scheduleJsonEditor.value;
                if (!jsonContent) {
                    alert('Please load or import schedule data first.');
                    return;
                }
                currentScheduleData = JSON.parse(jsonContent);
                initScheduleView(false); // False = don't preserve, reset to today
                visualContainer.style.display = 'block';
                document.body.style.overflow = 'hidden';
            } catch (e) {
                alert('Invalid JSON in editor. Please fix errors before opening visual editor.\n' + e.message);
            }
        });

        // Close Visual Editor
        closeBtn.addEventListener('click', () => {
            visualContainer.style.display = 'none';
            document.body.style.overflow = '';
        });

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
            
            renderSchedule();
            updateWeekInfo();
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

            const options = { day: 'numeric', month: 'long', year: 'numeric' };
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
            const tbody = document.getElementById('ve-schedule-body');
            tbody.innerHTML = '';
            
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
            const allExams = currentScheduleData.exams || [];
            
            const periodStart = new Date(currentWeek.startDate);
            const periodEnd = new Date(currentWeek.endDate);
            periodStart.setHours(0,0,0,0);
            periodEnd.setHours(0,0,0,0);

            const filteredExams = allExams.filter(exam => {
                if (!exam.examDate) return false;
                const d = new Date(exam.examDate);
                d.setHours(0,0,0,0);
                return d >= periodStart && d <= periodEnd;
            });

            const months = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли', 'август', 'септември', 'октомври', 'ноември', 'декември'];

            // Always show add button container, handled by HTML button outside list
            
            if (filteredExams.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.cssText = 'grid-column: 1/-1; text-align: center; color: #888; padding: 20px;';
                emptyMsg.textContent = 'No exams found for this period. Add one!';
                examListContainer.appendChild(emptyMsg);
            }

            const formatDate = (dStr) => {
                const d = new Date(dStr);
                if (isNaN(d.getTime())) return dStr;
                return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
            };

            filteredExams.forEach((exam) => {
                const originalIndex = allExams.indexOf(exam);

                const card = document.createElement('div');
                card.className = 'exam-card'; 
                
                const examDateFormatted = formatDate(exam.examDate);
                let retakeDateFormatted = exam.retakeDate || '-';

                card.innerHTML = `
                    <div class="exam-card-header">
                        <h3 class="exam-card-title">${exam.fullName || exam.subject}</h3>
                    </div>
                    
                    <div class="exam-section">
                        <div class="exam-section-title">
                            <svg class="exam-section-icon" viewBox="0 0 24 24"><path d="M9,10H7V12H9V10M13,10H11V12H13V10M17,10H15V12H17V10M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V8H19V19Z"/></svg>
                            Редовен изпит
                        </div>
                        <div class="exam-info-grid">
                            <div class="exam-info-item">
                                <span class="exam-info-label">Дата:</span>
                                <span class="exam-info-value">${examDateFormatted}</span>
                            </div>
                            <div class="exam-info-item">
                                <span class="exam-info-label">Час:</span>
                                <span class="exam-info-value">${exam.examTime || ''}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="exam-section">
                        <div class="exam-section-title">
                            <svg class="exam-section-icon" viewBox="0 0 24 24"><path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z"/></svg>
                            Поправка
                        </div>
                        <div class="exam-info-grid">
                            <div class="exam-info-item">
                                <span class="exam-info-label">Дата:</span>
                                <span class="exam-info-value">${retakeDateFormatted}</span>
                            </div>
                            <div class="exam-info-item">
                                <span class="exam-info-label">Час:</span>
                                <span class="exam-info-value">${exam.retakeTime || ''}</span>
                            </div>
                        </div>
                    </div>
                    <button class="exam-card-edit-btn">Edit</button>
                `;
                card.querySelector('button').onclick = (e) => {
                    e.stopPropagation();
                    openExamEditor(originalIndex);
                };
                examListContainer.appendChild(card);
            });
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
            
            deleteBtn.style.display = 'block';
            modal.style.display = 'flex';
        }

        function openAddModal(day) {
            currentEditingEvent = null;
            currentEditingDay = day;
            
            document.getElementById('ve-modal-title').textContent = `Add Event (${day})`;
            modalForm.reset();
            document.getElementById('ve-type').value = 'Лекция';
            
            deleteBtn.style.display = 'none';
            modal.style.display = 'flex';
        }

        window.closeVeModal = () => {
            modal.style.display = 'none';
        };

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
                startTime: getVal('ve-start'),
                endTime: getVal('ve-end'),
                teacher: getVal('ve-teacher'),
                building: getVal('ve-building-input'),
                room: getVal('ve-room-input'),
                floor: undefined, // Clear legacy floor
                additionalInfo: getVal('ve-info')
            };
            
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
                const weekNum = currentWeekIndex + 1;
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
                const weekNum = currentWeekIndex + 1;
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
