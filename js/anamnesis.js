(function() {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "API_KEY",
        authDomain: "med-student-chat.firebaseapp.com",
        databaseURL: "https://med-student-chat-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "med-student-chat",
        storageBucket: "med-student-chat.appspot.com",
        messagingSenderId: "SENDER_ID",
        appId: "APP_ID"
    };

    if (typeof firebase === 'undefined') {
        console.error("Firebase SDK not loaded.");
        return;
    }
    
    const app = firebase.apps.length === 0 ? firebase.initializeApp(firebaseConfig) : firebase.app();
    const db = firebase.database();

    // --- State ---
    let allAnamneses = [];
    let groupedPatients = {}; 
    let currentUser = null;
    let editingRecordId = null;
    let currentPatientNorm = null;

    // --- DOM Elements ---
    const patientListEl = document.getElementById('patient-list');
    const searchInput = document.getElementById('patient-search');
    const formView = document.getElementById('view-form');
    const displayView = document.getElementById('view-display');
    const form = document.getElementById('anamnesis-form');
    const container = document.getElementById('anamnesis-container');
    const title = document.getElementById('workspace-title');
    const btnNew = document.getElementById('btn-new-anamnesis');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // Mobile Elements
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sideMenu = document.getElementById('side-menu');
    const sideOverlay = document.getElementById('sidemenuOverlay');
    const workspacePanel = document.getElementById('workspacePanel');
    const btnBackMobile = document.getElementById('btn-back-mobile');
    const btnNewMobileList = document.getElementById('btn-new-mobile-list');

    // --- Initialization ---
    async function init() {
        setupMobileEvents();
        if (btnNewMobileList) {
            btnNewMobileList.onclick = () => btnNew.click();
        }
        showLoading(true);
        
        try {
            if (!window.currentUserPromise) {
                console.error("Anamnesis: User identity system not ready.");
                return;
            }
            currentUser = await window.currentUserPromise;
            
            const ref = db.ref('anamneses');
            ref.on('value', (snapshot) => {
                const data = snapshot.val();
                processData(data);
                renderSidebar(searchInput.value);
                
                // Refresh current view if active
                if (currentPatientNorm) {
                    if (groupedPatients[currentPatientNorm]) {
                        renderCards(groupedPatients[currentPatientNorm]);
                    } else {
                        container.innerHTML = '';
                        title.textContent = "Нова Анамнеза";
                        showForm(true); 
                        currentPatientNorm = null;
                    }
                }
                showLoading(false);
            }, (error) => {
                console.error("Anamnesis: Read error:", error);
                showLoading(false);
            });

        } catch (e) {
            console.error("Anamnesis: Initialization error:", e);
            showLoading(false);
        }
    }

    function setupMobileEvents() {
        if (mobileToggle && sideMenu && sideOverlay) {
            mobileToggle.addEventListener('click', () => {
                sideMenu.classList.add('mobile-open');
                sideOverlay.style.display = 'block';
                document.body.style.overflow = 'hidden';
            });
            sideOverlay.addEventListener('click', () => {
                sideMenu.classList.remove('mobile-open');
                sideOverlay.style.display = 'none';
                document.body.style.overflow = '';
            });
        }
        if (btnBackMobile && workspacePanel) {
            btnBackMobile.addEventListener('click', (e) => {
                e.preventDefault();
                workspacePanel.classList.remove('active');
                document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('selected'));
                currentPatientNorm = null; 
            });
        }
    }

    function processData(data) {
        allAnamneses = [];
        groupedPatients = {};
        if (!data) return;
        Object.keys(data).forEach(key => {
            const record = { id: key, ...data[key] };
            allAnamneses.push(record);
            const normName = (record.name || record.patientName || "Unknown").toLowerCase().trim();
            if (!groupedPatients[normName]) {
                groupedPatients[normName] = [];
            }
            groupedPatients[normName].push(record);
        });
        Object.values(groupedPatients).forEach(list => {
            list.sort((a, b) => b.timestamp - a.timestamp);
        });
    }

    function renderSidebar(filterText = '') {
        patientListEl.innerHTML = '';
        const normFilter = filterText.toLowerCase().trim();
        const names = Object.keys(groupedPatients).sort(); 

        if (names.length === 0) {
            patientListEl.innerHTML = '<li style="padding:20px; color:#999; text-align:center;">Няма намерени пациенти</li>';
            return;
        }

        names.forEach(normName => {
            const records = groupedPatients[normName];
            const latest = records[0]; 
            const originalName = latest.name || latest.patientName; 
            if (normFilter && !normName.includes(normFilter)) return;

            const li = document.createElement('li');
            li.className = 'patient-item';
            if (normName === currentPatientNorm) li.classList.add('selected');
            li.innerHTML = `
                <div class="patient-name">${escapeHtml(originalName)}</div>
                <div class="patient-meta">
                    <span>${records.length} версии</span>
                    <span>${formatDate(latest.timestamp)}</span>
                </div>
            `;
            li.onclick = () => selectPatient(normName, li);
            patientListEl.appendChild(li);
        });
    }

    function selectPatient(normName, liElement) {
        currentPatientNorm = normName;
        document.querySelectorAll('.patient-item').forEach(el => el.classList.remove('selected'));
        if (liElement) liElement.classList.add('selected');
        showForm(false);
        const records = groupedPatients[normName];
        if (!records || records.length === 0) return;
        title.textContent = records[0].name || records[0].patientName;
        renderCards(records);
        if (workspacePanel) workspacePanel.classList.add('active');
    }

    function renderCards(records) {
        container.innerHTML = '';
        records.forEach(record => {
            const card = document.createElement('div');
            card.className = 'anamnesis-card';
            const dateStr = formatDate(record.timestamp, true);
            const isAuthor = currentUser && (record.authorId === currentUser.userId);

            const renderModuleHeader = (t) => `<h2 style="text-align:center; color:#3a5a40; font-size:24px; margin:40px 0 20px 0; text-transform:uppercase; letter-spacing:1px; border-bottom:2px solid #588157; padding-bottom:10px;">${t}</h2>`;
            const renderSectionHeader = (t) => `<h3 style="text-align:left; color:#588157; font-size:18px; margin:30px 0 15px 0; font-weight:700; border-bottom:1px solid #eee; padding-bottom:5px;">${t}</h3>`;
            const renderField = (l, v) => {
                if (!v) return '';
                return `<div style="margin-bottom:12px; border-bottom:1px solid #f0f0f0; padding-bottom:8px;">
                    <span style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px; display:block; margin-bottom:2px;">${l}</span>
                    <div style="font-size:15px; color:#333; white-space:pre-wrap; line-height:1.5;">${escapeHtml(v)}</div>
                </div>`;
            };
            const renderGroup = (c) => `<div style="background:#fff; padding:0 10px;">${c}</div>`;

            let actionsHtml = isAuthor ? `
                <div style="display:flex; gap:10px;">
                    <button class="action-btn edit-btn" style="background:none; border:1px solid #588157; color:#588157; padding:4px 8px; border-radius:4px; cursor:pointer;">Edit</button>
                    <button class="action-btn delete-btn" style="background:none; border:1px solid #d32f2f; color:#d32f2f; padding:4px 8px; border-radius:4px; cursor:pointer;">Delete</button>
                </div>` : '';

            let html = `
                <div class="anamnesis-header-bar">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span class="author-badge">Написано от: ${escapeHtml(record.authorName || 'Unknown')}</span>
                        <span class="date-badge">${dateStr}</span>
                    </div>
                    ${actionsHtml}
                </div>
                <div class="anamnesis-view-content">`;

            // MODULE 1: ANAMNESIS
            let aContent = '';
            let pas = renderField('Име', record.name) + renderField('Възраст / Пол / Адрес', [record.age ? record.age + ' г.' : '', record.gender === 'M' ? 'Мъж' : (record.gender === 'F' ? 'Женат' : record.gender), record.address].filter(Boolean).join(' | ')) + renderField('Прием в Клиниката', record.admission_note);
            if(pas) aContent += renderSectionHeader('1. Въведение и Паспортни Данни') + renderGroup(pas);

            let mor = renderField('Основно Оплакване', record.complaint) + renderField('Хронология и Прогрес', record.chronology) + renderField('Лечение / Епизоди', record.history_treatment);
            if(mor) aContent += renderSectionHeader('2. Anamnesis Morbi') + renderGroup(mor);

            let sym = renderField('Болка', record.sym_pain) + renderField('Кашлица', record.sym_cough) + renderField('Задух', record.sym_dyspnea) + renderField('Кръвно Налягане | Пулс', [record.sym_bp_hist, record.sym_pulse].filter(Boolean).join(' | ')) + renderField('Температура', record.sym_temp);
            if(sym) aContent += renderSectionHeader('Детайли по Симптоми') + renderGroup(sym);

            let vit = renderField('Прекарани Заболявания', record.past_diseases) + renderField('Придружаващи заболявания', record.concomitant_diseases) + renderField('Медикаменти', record.medications);
            if(vit) aContent += renderSectionHeader('3. Anamnesis Vitae') + renderGroup(vit);

            let soc = renderField('Навици & Алергии', [record.habits, record.allergies].filter(Boolean).join(' | ')) + renderField('Фамилна История', record.family_history);
            if(soc) aContent += renderSectionHeader('4. Социална и Фамилна') + renderGroup(soc);

            if(aContent) html += renderModuleHeader('Анамнеза') + aContent;

            // MODULE 2: STATUS PRAESENS
            let sContent = '';
            const genS = (t, flds) => {
                let c = '';
                flds.forEach(f => { c += renderField(f.label, record[f.key]); });
                return c ? renderSectionHeader(t) + renderGroup(c) : '';
            };

            sContent += genS('1. Общо състояние', [{key: 'st_general', label: 'Общ вид'}, {key: 'st_consciousness', label: 'Съзнание'}, {key: 'st_posture', label: 'Положение'}, {key: 'st_skin', label: 'Кожа и лигавици'}, {key: 'st_lymph', label: 'Лимфни възли'}, {key: 'st_gait', label: 'Походка'}]);
            sContent += genS('2. Глава и Шия', [{key: 'st_head', label: 'Глава и очи'}, {key: 'st_mouth', label: 'Устна кухина и език'}, {key: 'st_neck', label: 'Шия и щитовидна жлеза'}]);
            sContent += genS('3. Дихателна система', [{key: 'st_resp_inspect', label: 'Оглед и гръден кош'}, {key: 'st_resp_palp', label: 'Палпация и перкусия'}, {key: 'st_resp_auscult', label: 'Аускултация (дишане)'}]);
            
            // Special CVD section
            let cvd = renderField('Оглед и Палпация', record.st_cardio_inspect_palp) + renderField('Перкусия (Граници)', record.st_cardio_percussion) + renderField('Аускултация', record.st_cardio_auscultation) + renderField('Шиен венозен застой', record.st_cardio_jvd) + renderField('Кръвно налягане | Пулс', [record.st_bp, record.st_pulse].filter(Boolean).join(' | '));
            if(cvd) sContent += renderSectionHeader('4. Сърдечно-съдова система') + renderGroup(cvd);

            sContent += genS('5. Корем и коремни органи', [
                {key: 'st_abd_inspect', label: 'Оглед'},
                {key: 'st_abd_auscult', label: 'Аускултация'},
                {key: 'st_abd_percuss', label: 'Перкусия'},
                {key: 'st_abd_palp_super', label: 'Повърхностна палпация'},
                {key: 'st_abd_palp_deep', label: 'Дълбока палпация'},
                {key: 'st_abd_liver', label: 'Чернодробна област'},
                {key: 'st_abd_spleen', label: 'Слезка'}
            ]);
            sContent += genS('6. Пикочо-полова и Двигателна', [{key: 'st_kidney', label: 'Бъбречни области'}, {key: 'st_limbs', label: 'Крайници и стави'}]);

            if(sContent) html += renderModuleHeader('Статус Презенс') + sContent;

            html += `</div>`;
            card.innerHTML = html;
            if(isAuthor) {
                card.querySelector('.edit-btn').onclick = () => editRecord(record);
                card.querySelector('.delete-btn').onclick = () => deleteRecord(record.id);
            }
            container.appendChild(card);
        });
    }

    function editRecord(r) {
        editingRecordId = r.id;
        title.textContent = "Редактиране";
        Object.keys(r).forEach(k => { if(form.elements[k]) form.elements[k].value = r[k]; });
        if(form.elements['name'] && r.patientName) form.elements['name'].value = r.patientName;
        showForm(true);
        if(workspacePanel) workspacePanel.classList.add('active');
    }

    function deleteRecord(id) {
        if(confirm("Изтриване?")) {
            showLoading(true);
            db.ref('anamneses/' + id).remove().finally(() => showLoading(false));
        }
    }

    function showForm(s) {
        if(s) { formView.classList.remove('hidden'); displayView.classList.add('hidden'); }
        else { formView.classList.add('hidden'); displayView.classList.remove('hidden'); editingRecordId = null; }
    }

    btnNew.onclick = () => { editingRecordId = null; form.reset(); title.textContent = "Нова Анамнеза"; showForm(true); if(workspacePanel) workspacePanel.classList.add('active'); };
    searchInput.addEventListener('input', (e) => renderSidebar(e.target.value));

    form.onsubmit = async (e) => {
        e.preventDefault();
        if(!currentUser) return alert("Login needed");
        const fd = new FormData(form);
        const nr = {};
        for (let [k, v] of fd.entries()) nr[k] = v;
        if(!nr.name) return alert("Name needed");
        showLoading(true);
        nr.patientName = nr.name;
        nr.patientNameNormalized = nr.name.toLowerCase();
        if(!editingRecordId) { nr.authorId = currentUser.userId; nr.authorName = currentUser.userName; }
        nr.timestamp = firebase.database.ServerValue.TIMESTAMP;
        try {
            if(editingRecordId) await db.ref('anamneses/' + editingRecordId).update(nr);
            else await db.ref('anamneses').push(nr);
            form.reset();
            editingRecordId = null;
            currentPatientNorm = nr.patientNameNormalized;
        } catch(err) { alert(err.message); } finally { showLoading(false); }
    };

    function showLoading(s) { if(s) loadingOverlay.classList.remove('hidden'); else loadingOverlay.classList.add('hidden'); }
    function escapeHtml(t) { return t ? String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : ''; }
    function formatDate(ts, it = false) { if(!ts) return ''; const d = new Date(ts); return it ? d.toLocaleString('bg-BG') : d.toLocaleDateString('bg-BG'); }
    init();
})();