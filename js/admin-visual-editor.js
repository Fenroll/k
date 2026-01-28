(function() {
    // Wait for schedule-data.js and marked to load
    window.addEventListener('DOMContentLoaded', () => {
        // Elements
        const openBtn = document.getElementById('open-visual-editor');
        const visualContainer = document.getElementById('visual-editor-container');
        const closeBtn = document.getElementById('close-visual-editor');
        const scheduleJsonEditor = document.getElementById('schedule-json-editor');
        const manageExamsBtn = document.getElementById('manage-exams-btn');
        
        if (!openBtn || !visualContainer) return;

        // State
        let currentScheduleData = null;
        let currentWeekIndex = 0;
        let scheduleByWeek = [];
        let semesterConfig = null;

        // Open Visual Editor
        openBtn.addEventListener('click', () => {
            // 1. Get data from JSON editor
            try {
                const jsonContent = scheduleJsonEditor.value;
                if (!jsonContent) {
                    alert('Please load or import schedule data first.');
                    return;
                }
                currentScheduleData = JSON.parse(jsonContent);
                
                // Initialize view
                initScheduleView();
                
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

        // Initialize Schedule Logic (Similar to calendar.html)
        function initScheduleView() {
            if (!currentScheduleData) return;
            
            semesterConfig = currentScheduleData.semester;
            scheduleByWeek = generateWeeksFromTemplate(currentScheduleData);
            
            // Find current week using logic from calendar.html
            currentWeekIndex = findCurrentWeekIndex();
            
            renderSchedule();
            updateWeekInfo();
        }

        function generateWeeksFromTemplate(config) {
            const weeks = [];
            const template = config.template || [];
            const overrides = config.overrides || {};
            
            config.weeks.forEach((week, index) => {
                const weekNumber = index + 1;
                let schedule = JSON.parse(JSON.stringify(template));
                
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
                    schedule: schedule
                });
            });
            return weeks;
        }

        // Improved findCurrentWeekIndex logic from calendar.html
        function findCurrentWeekIndex() {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset time to midnight
            
            // Check if today is Saturday (6) or Sunday (0)
            const dayOfWeek = today.getDay();
            let targetDate = new Date(today);
            
            if (dayOfWeek === 0) {
                // Sunday - show next week (add 1 day to Monday)
                targetDate.setDate(targetDate.getDate() + 1);
            } else if (dayOfWeek === 6) {
                // Saturday - show next week (add 2 days to Monday)
                targetDate.setDate(targetDate.getDate() + 2);
            }
            
            for (let i = 0; i < scheduleByWeek.length; i++) {
                const weekStart = new Date(scheduleByWeek[i].startDate);
                weekStart.setHours(0, 0, 0, 0);
                
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 4); // End of week (Friday)
                
                if (targetDate >= weekStart && targetDate <= weekEnd) {
                    return i;
                }
            }
            
            // If today is before first week, return 0
            const firstWeek = new Date(scheduleByWeek[0].startDate);
            if (targetDate < firstWeek) {
                return 0;
            }
            
            // If today is after all weeks, return last week
            return scheduleByWeek.length - 1;
        }

        function changeWeek(direction) {
            const newIndex = currentWeekIndex + direction;
            if (newIndex >= 0 && newIndex < scheduleByWeek.length) {
                currentWeekIndex = newIndex;
                renderSchedule();
                updateWeekInfo();
            }
        }

        window.changeWeekAdmin = changeWeek; // Expose to global for button onclick

        function updateWeekInfo() {
            const currentWeek = scheduleByWeek[currentWeekIndex];
            if (!currentWeek) return;
            
            const startDate = new Date(currentWeek.startDate);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6); // Just show full week range for admin
            
            const options = { day: 'numeric', month: 'long' };
            document.getElementById('ve-week-info').textContent = 
                `Week ${currentWeekIndex + 1}: ${startDate.toLocaleDateString('bg-BG', options)} - ${endDate.toLocaleDateString('bg-BG', options)}`;
        }

        function renderSchedule() {
            const days = ['ПОН', 'ВТ', 'СР', 'ЧЕТ', 'ПЕТ'];
            const tbody = document.getElementById('ve-schedule-body');
            tbody.innerHTML = '';
            
            const currentWeek = scheduleByWeek[currentWeekIndex];
            const scheduleData = currentWeek.schedule;
            
            const eventsByDay = {};
            days.forEach(day => {
                eventsByDay[day] = scheduleData
                    .filter(item => item.day === day)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
            });
            
            const maxEvents = Math.max(...days.map(day => eventsByDay[day].length), 1); // At least 1 row
            
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
                    
                    // Add "Add" button to cell
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
        let currentEditingEvent = null; // Original event object if editing
        let currentEditingDay = null;   // Day we are adding/editing for

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
            document.getElementById('ve-room').value = event.room || '';
            document.getElementById('ve-floor').value = event.floor || '';
            document.getElementById('ve-info').value = event.additionalInfo || '';
            
            deleteBtn.style.display = 'block';
            modal.style.display = 'flex';
        }

        function openAddModal(day) {
            currentEditingEvent = null;
            currentEditingDay = day;
            
            document.getElementById('ve-modal-title').textContent = `Add Event (${day})`;
            modalForm.reset();
            // Default values
            document.getElementById('ve-type').value = 'Лекция';
            
            deleteBtn.style.display = 'none';
            modal.style.display = 'flex';
        }

        window.closeVeModal = () => {
            modal.style.display = 'none';
        };

        // Handle Save
        document.getElementById('ve-save-btn').addEventListener('click', () => {
            const newEventData = {
                day: currentEditingDay,
                subject: document.getElementById('ve-subject').value,
                fullName: document.getElementById('ve-fullname').value,
                type: document.getElementById('ve-type').value,
                startTime: document.getElementById('ve-start').value,
                endTime: document.getElementById('ve-end').value,
                teacher: document.getElementById('ve-teacher').value,
                room: document.getElementById('ve-room').value,
                floor: document.getElementById('ve-floor').value,
                additionalInfo: document.getElementById('ve-info').value
            };

            const weekNum = currentWeekIndex + 1;
            
            if (!currentScheduleData.overrides) currentScheduleData.overrides = {};
            if (!currentScheduleData.overrides[weekNum]) currentScheduleData.overrides[weekNum] = [];

            if (currentEditingEvent) {
                // EDITING EXISTING EVENT
                // Check if current event is in template
                const isTemplate = currentScheduleData.template.some(t => 
                    t.day === currentEditingEvent.day && 
                    t.subject === currentEditingEvent.subject && 
                    t.startTime === currentEditingEvent.startTime
                );

                if (isTemplate) {
                    const override = {
                        day: currentEditingEvent.day,
                        subject: currentEditingEvent.subject,
                        startTime: currentEditingEvent.startTime,
                        changes: { ...newEventData }
                    };
                    currentScheduleData.overrides[weekNum].push(override);
                } else {
                    // Remove old
                    currentScheduleData.overrides[weekNum].push({
                        day: currentEditingEvent.day,
                        subject: currentEditingEvent.subject,
                        startTime: currentEditingEvent.startTime,
                        remove: true
                    });
                    
                    // Add new
                    currentScheduleData.overrides[weekNum].push(newEventData);
                }

            } else {
                // ADDING NEW EVENT
                currentScheduleData.overrides[weekNum].push(newEventData);
            }

            updateAndClose();
        });

        // Handle Delete
        deleteBtn.addEventListener('click', () => {
            if (!confirm('Delete this event?')) return;
            const weekNum = currentWeekIndex + 1;
            if (!currentScheduleData.overrides) currentScheduleData.overrides = {};
            if (!currentScheduleData.overrides[weekNum]) currentScheduleData.overrides[weekNum] = [];

            // Add removal override
            currentScheduleData.overrides[weekNum].push({
                day: currentEditingEvent.day,
                subject: currentEditingEvent.subject,
                startTime: currentEditingEvent.startTime,
                remove: true
            });

            updateAndClose();
        });

        function updateAndClose() {
            // Update JSON editor
            scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);
            
            // Re-init view to reflect changes
            initScheduleView();
            
            closeVeModal();
        }

        // --- Exam Manager Logic ---
        
        const examModal = document.getElementById('exam-modal');
        const examList = document.getElementById('exam-list');
        const examListView = document.getElementById('exam-list-view');
        const examEditView = document.getElementById('exam-edit-view');
        const examForm = document.getElementById('exam-form');
        
        // Buttons
        const addExamBtn = document.getElementById('add-exam-btn');
        const exCancelBtn = document.getElementById('ex-cancel-btn');
        const exSaveBtn = document.getElementById('ex-save-btn');
        const exDeleteBtn = document.getElementById('ex-delete-btn');
        
        let currentEditingExamIndex = -1; // -1 for new exam

        if (manageExamsBtn) {
            manageExamsBtn.addEventListener('click', () => {
                renderExamList();
                showExamList();
                examModal.style.display = 'flex';
            });
        }

        window.closeExamModal = () => {
            examModal.style.display = 'none';
        };

        function renderExamList() {
            if (!currentScheduleData.exams) currentScheduleData.exams = [];
            examList.innerHTML = '';
            
            if (currentScheduleData.exams.length === 0) {
                examList.innerHTML = '<li style="padding:10px; color:#888;">No exams found.</li>';
                return;
            }

            currentScheduleData.exams.forEach((exam, index) => {
                const li = document.createElement('li');
                li.style.cssText = 'padding: 10px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; cursor: pointer;';
                li.innerHTML = `
                    <div>
                        <div style="font-weight:bold; color: #588157;">${exam.subject}</div>
                        <div style="font-size: 0.9em; color: #aaa;">${exam.examDate} ${exam.examTime || ''}</div>
                    </div>
                    <button class="btn btn-secondary" style="width: auto; padding: 4px 8px; font-size: 12px;">Edit</button>
                `;
                li.onclick = () => openExamEditor(index);
                examList.appendChild(li);
            });
        }

        function showExamList() {
            examListView.style.display = 'block';
            examEditView.style.display = 'none';
        }

        function showExamEditor() {
            examListView.style.display = 'none';
            examEditView.style.display = 'block';
        }

        function openExamEditor(index) {
            currentEditingExamIndex = index;
            const exam = currentScheduleData.exams[index];
            
            // Populate form
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
        }

        addExamBtn.addEventListener('click', () => {
            currentEditingExamIndex = -1;
            examForm.reset();
            exDeleteBtn.style.display = 'none';
            showExamEditor();
        });

        exCancelBtn.addEventListener('click', () => {
            showExamList();
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
                retakeLocation: '', // Not in form but kept in structure if needed
                additionalInfo: document.getElementById('ex-info').value,
                hasCalculatorPharmacology1: document.getElementById('ex-calc').checked
            };

            if (!currentScheduleData.exams) currentScheduleData.exams = [];

            if (currentEditingExamIndex >= 0) {
                // Edit existing
                currentScheduleData.exams[currentEditingExamIndex] = newExam;
            } else {
                // Add new
                currentScheduleData.exams.push(newExam);
            }

            // Update JSON editor
            scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);
            renderExamList();
            showExamList();
        });

        exDeleteBtn.addEventListener('click', () => {
            if (currentEditingExamIndex >= 0 && confirm('Delete this exam?')) {
                currentScheduleData.exams.splice(currentEditingExamIndex, 1);
                
                // Update JSON editor
                scheduleJsonEditor.value = JSON.stringify(currentScheduleData, null, 2);
                renderExamList();
                showExamList();
            }
        });

    });
})();