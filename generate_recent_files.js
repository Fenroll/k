const fs = require('fs');
const path = require('path');

/**
 * Скрипт за генериране на таблица със последни променени MSG HTML файлове
 * и новодобавени файлове в files/ папката
 */

const FILES_DIR = path.join(__dirname, 'files');
const OUTPUT_FILE = path.join(__dirname, 'recent-changes.md');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

function getMsgHtmlFiles() {
  const allFiles = getAllFiles(FILES_DIR);
  
  // Филтрирам само HTML файлове с "msg" в името
  const msgFiles = allFiles.filter(file => {
    const basename = path.basename(file);
    return file.endsWith('.html') && basename.includes('msg');
  });

  // Взимам metadata за всеки файл
  const filesWithStats = msgFiles.map(file => {
    const stats = fs.statSync(file);
    const relativePath = path.relative(FILES_DIR, file);
    return {
      path: relativePath,
      fullPath: file,
      modified: stats.mtime,
      size: stats.size,
      created: stats.birthtime
    };
  });

  // Сортирам по време на модификация (най-новите първо)
  filesWithStats.sort((a, b) => b.modified - a.modified);

  return filesWithStats;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('bg-BG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
}

function generateMarkdownTable(files, limit = 15) {
  if (files.length === 0) {
    return '> Няма намерени msg HTML файлове';
  }

  const recentFiles = files.slice(0, limit);

  let markdown = '| Файл | Последна модификация | Размер |\n';
  markdown += '|------|---------------------|--------|\n';

  recentFiles.forEach(file => {
    const displayPath = file.path.replace(/\\/g, '/');
    const fileName = path.basename(file.path);
    const sizeKb = (file.size / 1024).toFixed(1);
    const modDate = formatDate(file.modified);
    
    markdown += `| ${fileName} | ${modDate} | ${sizeKb} KB |\n`;
  });

  return markdown;
}

function generateHtmlTable(files, limit = 15) {
  if (files.length === 0) {
    return '<p>Няма намерени msg HTML файлове</p>';
  }

  const recentFiles = files.slice(0, limit);

  let html = '<table class="recent-files-table">\n';
  html += '<thead><tr><th>Файл</th><th>Последна модификация</th><th>Размер</th></tr></thead>\n';
  html += '<tbody>\n';

  recentFiles.forEach(file => {
    const displayPath = file.path.replace(/\\/g, '/');
    const fileName = path.basename(file.path);
    const sizeKb = (file.size / 1024).toFixed(1);
    const modDate = formatDate(file.modified);
    
    html += `<tr><td>${fileName}</td><td>${modDate}</td><td>${sizeKb} KB</td></tr>\n`;
  });

  html += '</tbody>\n</table>\n';
  return html;
}

function main() {
  console.log('🔍 Сканирам файловете...');
  
  const msgFiles = getMsgHtmlFiles();
  
  console.log(`✅ Намерени ${msgFiles.length} msg HTML файла`);
  
  // Генерирам markdown таблица
  const markdownTable = generateMarkdownTable(msgFiles, 20);
  
  const markdownContent = `# Последни променени файлове

Автоматично генерирано список със последните 20 променени MSG HTML файла.

## 📊 Таблица със последни промени

${markdownTable}

---

*Последна актуализация: ${new Date().toLocaleString('bg-BG')}*
`;

  // Запазвам markdown файл
  fs.writeFileSync(OUTPUT_FILE, markdownContent, 'utf-8');
  console.log(`✅ Markdown файл генериран: ${OUTPUT_FILE}`);

  // Генерирам и JSON за JavaScript вмъкване
  const jsonData = {
    generated: new Date().toISOString(),
    totalMsgFiles: msgFiles.length,
    recentFiles: msgFiles.slice(0, 20).map(f => ({
      path: f.path.replace(/\\/g, '/'),
      modified: f.modified,
      size: f.size
    }))
  };

  const jsonFile = path.join(__dirname, 'recent-changes.json');
  fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`✅ JSON файл генериран: ${jsonFile}`);
}

main();
