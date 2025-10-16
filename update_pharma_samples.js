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
    sampleFiles.forEach(file => {
      const card = document.createElement('div');
      card.className = 'sample-file-card';
      card.innerHTML = \`
        <img src="images/json-file-icon.svg" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"2\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\"></path><polyline points=\\"14 2 14 8 20 8\\"></polyline><path d=\\"M12 18v-6\\"></path><path d=\\"M8 15h8\\"></path></svg>'" class="sample-file-icon">
        <div class="sample-file-name">\${file.title}</div>
        <div class="sample-file-info">\${file.groups} групи, \${file.drugs} лекарства</div>
      \`;
      
      // Добавяне на събитие за зареждане на файла
      card.addEventListener('click', () => loadSampleFile(file.fileName));
      
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