/**
 * Скрипт за автоматично обновяване на примерни JSON файлове за фармакологичните тестове
 * За да използвате: node update_pharma_samples.js
 */

const fs = require('fs');
const path = require('path');

// Конфигурация
const SAMPLES_DIR = path.join(__dirname, 'Примерни');
const HTML_FILE = path.join(__dirname, 'tests.html');
const START_MARKER = '// ГЕНЕРИРАНИ ДАННИ ЗА ПРИМЕРНИ ФАЙЛОВЕ - НАЧАЛО';
const END_MARKER = '// ГЕНЕРИРАНИ ДАННИ ЗА ПРИМЕРНИ ФАЙЛОВЕ - КРАЙ';

// Главна функция
function main() {
    console.log('Сканиране на папка "Примерни" за JSON файлове...');
    
    if (!fs.existsSync(SAMPLES_DIR)) {
        console.error(`Грешка: Директорията "${SAMPLES_DIR}" не съществува.`);
        return;
    }
    
    if (!fs.existsSync(HTML_FILE)) {
        console.error(`Грешка: Файлът "${HTML_FILE}" не съществува.`);
        return;
    }
    
    try {
        // Прочитане на директорията
        const files = fs.readdirSync(SAMPLES_DIR);
        const jsonFiles = files.filter(file => file.toLowerCase().endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            console.log('Не са намерени JSON файлове в папката "Примерни"');
        } else {
            console.log(`Намерени са ${jsonFiles.length} JSON файла.`);
        }
        
        // Обработка на всеки JSON файл
        const sampleFilesData = [];
        
        for (const fileName of jsonFiles) {
            try {
                const filePath = path.join(SAMPLES_DIR, fileName);
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);
                
                // Извличане на информация за файла
                let totalGroups = 0;
                let totalDrugs = 0;
                
                if (jsonData.groups && Array.isArray(jsonData.groups)) {
                    totalGroups = jsonData.groups.length;
                    
                    // Изчисляване на общия брой лекарства
                    for (const group of jsonData.groups) {
                        if (group.drugs && Array.isArray(group.drugs)) {
                            totalDrugs += group.drugs.length;
                        }
                    }
                }
                
                // Добавяне на информация за файла
                sampleFilesData.push({
                    fileName,
                    title: fileName.replace('.json', ''),
                    groups: totalGroups,
                    drugs: totalDrugs,
                    data: jsonData
                });
                
                console.log(`  ✓ ${fileName}: ${totalGroups} групи, ${totalDrugs} лекарства`);
            } catch (err) {
                console.error(`  ✗ Грешка при обработка на файл ${fileName}:`, err.message);
            }
        }
        
        // Обновяване на HTML файла
        updateHtmlFile(sampleFilesData);
        
    } catch (err) {
        console.error('Грешка при сканиране на директорията:', err);
    }
}

// Генериране на JavaScript код
function generateJavaScriptCode(sampleFilesData) {
    const now = new Date();
    const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    
    return `
${START_MARKER}
const sampleFiles = ${JSON.stringify(sampleFilesData, null, 2)};

// Функция за зареждане на примерните файлове в интерфейса
function loadSampleFiles() {
  // Изчистване на контейнера
  sampleFilesContainer.innerHTML = '';

  // Добавяне на карта за всеки примерен файл
    if (sampleFiles.length > 0) {
        // Къстъм сортиране: Фармакология отпред (Изпит, I, II, III, IV ...), после Упражнение по номер
        const norm = (s) => (s || '').toString().trim().toLowerCase().replace(/a/g, 'а');
        const romanMap = { i:1, ii:2, iii:3, iv:4, v:5, vi:6, vii:7, viii:8, ix:9, x:10 };
        const romanToInt = (s) => romanMap[s] !== undefined ? romanMap[s] : 999;
        const meta = (file) => {
            const title = file.title || file.fileName || '';
            const t = norm(title);
            const isPharma = /^\s*фармакология/.test(t);
            const isExercise = /^\s*упражнение/.test(t);
            let pRank = 999, pNum = 999, exNum = Number.POSITIVE_INFINITY;
            if (isPharma) {
                const rest = t.replace(/^\s*фармакология\s*/, '');
                if (/^изпит\b/.test(rest)) { pRank = 0; pNum = 0; }
                else {
                    const m = rest.match(/^(i{1,3}|iv|v|vi|vii|viii|ix|x)\b/);
                    if (m) { pRank = 1; pNum = romanToInt(m[1]); }
                    else { pRank = 2; pNum = 999; }
                }
            } else if (isExercise) {
                const m = t.match(/упражнение\s*(\d+)/);
                if (m) exNum = parseInt(m[1], 10);
            }
            return { isPharma, isExercise, pRank, pNum, exNum, title };
        };
        const sorted = sampleFiles.slice().sort((a, b) => {
            const A = meta(a), B = meta(b);
            if (A.isPharma && !B.isPharma) return -1;
            if (!A.isPharma && B.isPharma) return 1;
            if (A.isPharma && B.isPharma) {
                if (A.pRank !== B.pRank) return A.pRank - B.pRank;
                if (A.pNum !== B.pNum) return A.pNum - B.pNum;
                return A.title.localeCompare(B.title, 'bg');
            }
            if (A.isExercise && B.isExercise) {
                if (A.exNum !== B.exNum) return A.exNum - B.exNum;
                return A.title.localeCompare(B.title, 'bg');
            }
            return A.title.localeCompare(B.title, 'bg');
        });

        sorted.forEach(function(file) {
            const card = document.createElement('div');
            card.className = 'sample-file-card';

            const img = document.createElement('img');
            img.className = 'sample-file-icon';
            img.alt = 'JSON';
            img.src = 'images/json-file-icon.svg';
            img.addEventListener('error', function() {
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M8 15h8"/></svg>';
                img.src = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
            }, { once: true });

            const nameDiv = document.createElement('div');
            nameDiv.className = 'sample-file-name';
            nameDiv.textContent = file.title || file.fileName;

            const infoDiv = document.createElement('div');
            infoDiv.className = 'sample-file-info';
            infoDiv.textContent = (file.groups + ' групи, ' + file.drugs + ' лекарства');

            card.appendChild(img);
            card.appendChild(nameDiv);
            card.appendChild(infoDiv);

            // Добавяне на събитие за зареждане на файла
            card.addEventListener('click', function() { loadSampleFile(file.fileName); });

            sampleFilesContainer.appendChild(card);
        });
    }
}

// Важно: Извикване на функцията при зареждане
loadSampleFiles();
${END_MARKER}`;
}

// Обновяване на HTML файла
function updateHtmlFile(sampleFilesData) {
    try {
        const htmlContent = fs.readFileSync(HTML_FILE, 'utf8');
        
        const startIndex = htmlContent.indexOf(START_MARKER);
        const endIndex = htmlContent.indexOf(END_MARKER);
        
        if (startIndex === -1 || endIndex === -1) {
            console.error('Грешка: Не са намерени маркерите в HTML файла.');
            console.error(`Трябва да добавите маркерите ${START_MARKER} и ${END_MARKER} в tests.html`);
            return;
        }
        
        const newJsCode = generateJavaScriptCode(sampleFilesData);
        
        const newHtmlContent = 
            htmlContent.substring(0, startIndex) + 
            newJsCode + 
            htmlContent.substring(endIndex + END_MARKER.length);
        
        fs.writeFileSync(HTML_FILE, newHtmlContent, 'utf8');
        
        console.log(`\n✅ Успешно обновен файл: ${HTML_FILE}`);
        console.log(`   Добавени ${sampleFilesData.length} примерни файла.`);
    } catch (err) {
        console.error('Грешка при обновяване на HTML файла:', err);
    }
}

// Стартиране на скрипта
main();