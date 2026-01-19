// Node.js script to generate a static JS array of courses, sections, and files for your overlay system
// Usage: node generate_courses.js
// It will output a file 'courses.generated.js' with the JS array for direct inclusion in your HTML
// This version maintains consistent IDs for existing courses when new courses are added

const fs = require('fs');
const path = require('path');

const ELEMENTS_DIR = path.join(__dirname, 'files');
const OUTPUT_FILE = path.join(__dirname, 'courses.generated.js');
const ID_MAPPING_FILE = path.join(__dirname, 'course-ids.json');
const NAME_MAPPING_FILE = path.join(__dirname, 'folder-name-mappings.json');
const RECENT_CHANGES_FILE = path.join(__dirname, 'recent-changes.json');
const FILES_INDEX_FILE = path.join(__dirname, 'files-index.json');

function padId(num) {
  return num.toString().padStart(6, '0');
}

// Load existing ID mappings or create empty object
function loadIdMappings() {
  if (fs.existsSync(ID_MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(ID_MAPPING_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Warning: Could not parse ID mappings file, starting fresh:', error.message);
      return {};
    }
  }
  return {};
}

// Load folder name mappings
function loadNameMappings() {
  if (fs.existsSync(NAME_MAPPING_FILE)) {
    try {
      const data = fs.readFileSync(NAME_MAPPING_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Warning: Could not parse name mappings file:', error.message);
      return {};
    }
  }
  return {};
}

// Apply name mapping if exists
function getMappedName(folderName, nameMappings) {
  return nameMappings[folderName] || folderName;
}

// Рекурсивна функция за получаване на всички файлове
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

// Функция за генериране на HTML таблица със последните променени файлове
function generateRecentFilesHtml() {
  try {
    const allFiles = getAllFiles(ELEMENTS_DIR);
    console.log('Total files found:', allFiles.length);
    
    // Филтрирам само HTML файлове в files/ папката
    const htmlFiles = allFiles.filter(file => file.endsWith('.html'));
    console.log('HTML files found:', htmlFiles.length);

    // Взимам metadata за всеки файл
    const filesWithStats = htmlFiles.map(file => {
      const stats = fs.statSync(file);
      const relativePath = path.relative(ELEMENTS_DIR, file);
      const parts = relativePath.split(path.sep);
      const courseName = parts[0];
      
      return {
        path: relativePath,
        modified: stats.mtime,
        size: stats.size,
        courseName: courseName,
        isArchived: courseName.startsWith('[АРХИВ]')
      };
    });

    // Сортирам по време на модификация (най-новите първо)
    filesWithStats.sort((a, b) => b.modified - a.modified);
    console.log('Files sorted by modification time');

    // Правя карта на текущите файлове за индекс (само справка)
    const currentFilesList = {};
    allFiles.forEach(file => {
      if (!file.endsWith('.url')) {
        const relativePath = path.relative(ELEMENTS_DIR, file).replace(/\\/g, '/');
        currentFilesList[relativePath] = true;
      }
    });

    // Запазвам текущия индекс (само за справка)
    fs.writeFileSync(FILES_INDEX_FILE, JSON.stringify(currentFilesList, null, 2), 'utf-8');

    // Зареждам folder-name-mappings за правилните имена
    const nameMappings = loadNameMappings();

    // Групирам файловете по курс (предмет)
    const courseGroups = {};
    filesWithStats.forEach(file => {
      if (!courseGroups[file.courseName]) {
        courseGroups[file.courseName] = [];
      }
      courseGroups[file.courseName].push(file);
    });

    console.log('Recent unique files:', Object.keys(courseGroups).length, 'courses');

    // ГЕНЕРИРАМ HTML ЗА ПОСЛЕДНИ ПРОМЕНИ - МИНИМАЛЕН ФОРМАТ
    // Cache-busting с уникален timestamp
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const uniqueVersion = `${timestamp}-${randomId}`;
    let html = `<div style="margin: 20px 0;" data-version="${uniqueVersion}">\n\n`;
    
    // ТАБЛИЦА 1: ПОСЛЕДНИТЕ 5 ПРОМЕНЕНИ HTML ФАЙЛОВЕ (всички типове промени)
    html += '<h3>⭐ Последни 5 променени файлове:</h3>\n';
    
    // Дата на последна актуализация
    const now = new Date();
    const updateDate = now.toLocaleString('bg-BG');
    html += `<p style="margin-top: 20px; color: #666; font-size: 0.9em;">📅 Последна актуализация: ${updateDate}</p>\n\n</div>`;

    return html;
  } catch (error) {
    console.warn('Warning: Could not generate recent files HTML:', error.message);
    return '<p style="color: red;">⚠️ Грешка при генериране на таблица</p>';
  }
}

// Функция за обновяване на INFO.md със генерираната таблица
function updateInfoMdWithRecentFiles() {
  try {
    const infofMdPath = path.join(__dirname, 'files', 'Актуални събития Event center', 'INFO.md');
    
    if (!fs.existsSync(infofMdPath)) {
      console.warn('Warning: INFO.md not found at', infofMdPath);
      return;
    }

    let content = fs.readFileSync(infofMdPath, 'utf-8');
    
    // Генерирам HTML за таблицата
    const tableHtml = generateRecentFilesHtml();
    
    // Намирам маркерите за вмъкване
    const startMarker = '<!-- AUTO_GENERATED_TABLE_START -->';
    const endMarker = '<!-- AUTO_GENERATED_TABLE_END -->';
    
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
      // Заменям съдържанието между маркерите
      const before = content.substring(0, startIndex + startMarker.length);
      const after = content.substring(endIndex);
      
      content = before + '\n' + tableHtml + '\n' + after;
      
      fs.writeFileSync(infofMdPath, content, 'utf-8');
      console.log('✓ Updated INFO.md with recent files table');
    } else {
      console.warn('Warning: Could not find auto-generation markers in INFO.md');
    }
  } catch (error) {
    console.warn('Warning: Could not update INFO.md:', error.message);
  }
}

// Функция за генериране на JSON със последните променени файлове
function generateRecentChanges() {
  try {
    const allFiles = getAllFiles(ELEMENTS_DIR);
    
    // Филтрирам само HTML файлове
    const htmlFiles = allFiles.filter(file => file.endsWith('.html'));

    // Взимам metadata за всеки файл
    const filesWithStats = htmlFiles.map(file => {
      const stats = fs.statSync(file);
      const relativePath = path.relative(ELEMENTS_DIR, file);
      return {
        path: relativePath,
        modified: stats.mtime,
        size: stats.size
      };
    });

    // Сортирам по време на модификация (най-новите първо)
    filesWithStats.sort((a, b) => b.modified - a.modified);

    // Зареждам предишния индекс на файлове
    let previousIndex = {};
    if (fs.existsSync(FILES_INDEX_FILE)) {
      try {
        previousIndex = JSON.parse(fs.readFileSync(FILES_INDEX_FILE, 'utf-8'));
      } catch (e) {
        console.log('No previous files index found, creating new one');
      }
    }

    // Правя карта на текущите файлове
    const currentFilesList = {};
    htmlFiles.forEach(file => {
      const relativePath = path.relative(ELEMENTS_DIR, file).replace(/\\/g, '/');
      currentFilesList[relativePath] = true;
    });

    // Намирам добавени файлове (съществуват в текущ индекс, но не в предишния)
    const addedFiles = Object.keys(currentFilesList).filter(file => !previousIndex[file]);

    // Намирам премахнати файлове (съществуват в предишния индекс, но не в текущия)
    const removedFiles = Object.keys(previousIndex).filter(file => !currentFilesList[file]);

    // Запазвам текущия индекс
    fs.writeFileSync(FILES_INDEX_FILE, JSON.stringify(currentFilesList, null, 2), 'utf-8');

    // Филтрирам MSG файлове за отделна таблица
    const msgFiles = filesWithStats.filter(file => file.path.includes('msg'));
    
    // Взимам последните 5 уникално променени файлове (с дедупликация)
    const seen = new Set();
    const recentUnique = [];
    
    filesWithStats.forEach(file => {
      const fileName = path.basename(file.path);
      if (!seen.has(fileName)) {
        seen.add(fileName);
        recentUnique.push(file);
      }
      if (recentUnique.length >= 5) return;
    });

    // Генерирам JSON
    const jsonData = {
      generated: new Date().toISOString(),
      totalHtmlFiles: htmlFiles.length,
      recentFiles: recentUnique.map(f => ({
        path: f.path.replace(/\\/g, '/'),
        modified: f.modified,
        size: f.size
      })),
      msgFiles: msgFiles.slice(0, 5).map(f => ({
        path: f.path.replace(/\\/g, '/'),
        modified: f.modified,
        size: f.size
      })),
      addedFiles: addedFiles.slice(0, 10),
      removedFiles: removedFiles.slice(0, 10)
    };

    fs.writeFileSync(RECENT_CHANGES_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log('Generated recent changes:', RECENT_CHANGES_FILE);
    if (addedFiles.length > 0) console.log(`  Added files: ${addedFiles.length}`);
    if (removedFiles.length > 0) console.log(`  Removed files: ${removedFiles.length}`);
  } catch (error) {
    console.warn('Warning: Could not generate recent changes file:', error.message);
  }
}

// Save ID mappings to file
function saveIdMappings(mappings) {
  const data = JSON.stringify(mappings, null, 2);
  fs.writeFileSync(ID_MAPPING_FILE, data, 'utf8');
  console.log('Updated ID mappings saved to:', ID_MAPPING_FILE);
}

// Get or assign ID for a course title
function getOrAssignId(courseTitle, existingMappings, nextId) {
  if (existingMappings[courseTitle]) {
    return { id: existingMappings[courseTitle], nextId };
  }
  
  // Assign new ID
  const newId = padId(nextId.value);
  existingMappings[courseTitle] = newId;
  nextId.value++;
  console.log(`Assigned new ID ${newId} to course: ${courseTitle}`);
  return { id: newId, nextId };
}

// Read text file content
function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.warn('Could not read file:', filePath, error.message);
    return '';
  }
}

// Read URL from .url file
function readUrlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Parse .url file format (INI-style)
    const urlMatch = content.match(/URL=(.+)/i);
    return urlMatch ? urlMatch[1].trim() : null;
  } catch (error) {
    console.warn('Could not read URL file:', filePath, error.message);
    return null;
  }
}

function getAllCourses() {
  if (!fs.existsSync(ELEMENTS_DIR)) return [];
  
  // Load existing ID mappings and name mappings
  const idMappings = loadIdMappings();
  const nameMappings = loadNameMappings();
  console.log('Loaded existing ID mappings:', Object.keys(idMappings).length, 'courses');
  console.log('Loaded name mappings:', Object.keys(nameMappings).length, 'folders');
  
  // Get current subjects from filesystem
  // Filter out hidden folders that start with . or _ (they won't appear in courses)
  const subjects = fs.readdirSync(ELEMENTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.') && !dirent.name.startsWith('_'))
    .map(dirent => dirent.name);
  
  // Clean up ID mappings - remove entries for courses that no longer exist
  const originalCount = Object.keys(idMappings).length;
  Object.keys(idMappings).forEach(courseTitle => {
    if (!subjects.includes(courseTitle)) {
      console.log(`Removing ID for deleted course: ${courseTitle} (ID: ${idMappings[courseTitle]})`);
      delete idMappings[courseTitle];
    }
  });
  const removedCount = originalCount - Object.keys(idMappings).length;
  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} ID(s) for non-existent courses`);
  }
  
  // Find gaps in existing IDs to reuse, or find the next available ID
  const existingIds = Object.values(idMappings).map(id => parseInt(id, 10)).sort((a, b) => a - b);
  let nextIdValue = 1;
  
  // Find the first gap in the sequence
  for (let i = 1; i <= existingIds.length; i++) {
    if (!existingIds.includes(i)) {
      nextIdValue = i;
      break;
    }
  }
  
  // If no gaps, use the next number after the highest
  if (nextIdValue === 1 && existingIds.length > 0) {
    nextIdValue = Math.max(...existingIds) + 1;
  }
  
  const nextId = { value: nextIdValue };

  const courses = subjects.map((subject) => {
    const subjectPath = path.join(ELEMENTS_DIR, subject);
    
    // Get or assign stable ID for this course
    const { id } = getOrAssignId(subject, idMappings, nextId);
    
    // Apply name mapping for the course title
    const displayTitle = getMappedName(subject, nameMappings);
    
    const sections = fs.readdirSync(subjectPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .map(section => {
        const sectionPath = path.join(subjectPath, section);
  return processSection(section, sectionPath, `files/${subject}/${section}`, nameMappings);
      });
    
    return {
      id: id,
      title: displayTitle,
      sections
    };
  });
  
  // Recursive function to process sections and subsections
  function processSection(sectionName, sectionPath, relativePath, nameMappings) {
    const entries = fs.readdirSync(sectionPath, { withFileTypes: true });
    
    // Supported file extensions
    const supportedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
      '.zip', '.rar', '.7z',
      '.txt', '.log', '.md', '.html',
      '.one', '.onetoc2',
      '.url'
    ];
    
    // Helper function to extract order prefix and convert to sortable number
    // Supports: 1-, 2-, 11-, 1.1-, 2.1-, 2.2-, 2.11-
    function extractOrderPrefix(fileName) {
      const match = fileName.match(/^([\d.]+)-/);
      if (!match) return null;
      
      const prefix = match[1];
      
      // If it contains a dot, parse as decimal (e.g., "1.1" -> 1.1, "2.22" -> 2.22)
      if (prefix.includes('.')) {
        return parseFloat(prefix);
      }
      
      // Otherwise, parse as integer (e.g., "1" -> 1, "11" -> 11)
      return parseInt(prefix, 10);
    }
    
    // Helper function to remove order prefix for display
    function removeOrderPrefix(fileName) {
      return fileName.replace(/^[\d.]+-/, '');
    }
    
    // Custom sort function: files with prefix first (sorted by number), then files without prefix (alphabetically)
    function sortFiles(fileList) {
      return fileList.sort((a, b) => {
        const orderA = extractOrderPrefix(a.name);
        const orderB = extractOrderPrefix(b.name);
        
        // Both have order prefix - sort by number
        if (orderA !== null && orderB !== null) {
          return orderA - orderB;
        }
        
        // Only A has prefix - A comes first
        if (orderA !== null && orderB === null) {
          return -1;
        }
        
        // Only B has prefix - B comes first
        if (orderA === null && orderB !== null) {
          return 1;
        }
        
        // Neither has prefix - sort alphabetically
        return a.name.localeCompare(b.name, 'bg');
      });
    }
    
    // Get all supported files in this section
    // Separate msg files from regular files
    const files = [];
    const msgNotes = [];
    
    entries
      .filter(dirent => {
        if (!dirent.isFile()) return false;
        const fileName = dirent.name.toLowerCase();
        // Skip temporary files (Word/Excel temp files starting with ~$)
        if (fileName.startsWith('~$')) return false;
        return supportedExtensions.some(ext => fileName.endsWith(ext));
      })
      .forEach(file => {
        const fileName = file.name;
        const filePath = path.join(sectionPath, fileName);
        const fileExt = path.extname(fileName).toLowerCase();
        
        // Check if it's a msg file (txt, md, html, or docx with "msg" in name)
        if ((fileExt === '.txt' || fileExt === '.md' || fileExt === '.html' || fileExt === '.docx') && fileName.toLowerCase().includes('msg')) {
          // Read content for txt, md, and html files
          let content = '';
          if (fileExt === '.txt' || fileExt === '.md' || fileExt === '.html') {
            content = readTextFile(filePath);
          }
          
          msgNotes.push({
            name: fileName,
            path: `${relativePath}/${fileName}`,
            content: content,
            type: fileExt === '.txt' ? 'text' : (fileExt === '.md' ? 'markdown' : (fileExt === '.html' ? 'html' : 'docx'))
          });
        } else {
          // Regular file
          const fileData = {
            name: fileName,
            path: `${relativePath}/${fileName}`
          };
          
          // If it's a .url file, extract the URL
          if (fileExt === '.url') {
            const url = readUrlFile(filePath);
            if (url) {
              fileData.url = url;
            }
          }
          
          files.push(fileData);
        }
      });
    
    // Sort files and msgNotes by order prefix
    sortFiles(files);
    sortFiles(msgNotes);
    
    // Get subdirectories and process them recursively
    const subsections = entries
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const subPath = path.join(sectionPath, dirent.name);
        const subRelativePath = `${relativePath}/${dirent.name}`;
        return processSection(dirent.name, subPath, subRelativePath, nameMappings);
      });
    
    // Apply name mapping for display
    const displayName = getMappedName(sectionName, nameMappings);
    
    const result = {
      name: displayName,
      files,
      subsections: subsections.length > 0 ? subsections : undefined
    };
    
    // Add msgNotes if any exist
    if (msgNotes.length > 0) {
      result.msgNotes = msgNotes;
    }
    
    return result;
  }
  
  // Save updated mappings
  saveIdMappings(idMappings);
  
  // Separate active and archived courses
  const activeCourses = [];
  const archivedCourses = [];
  
  courses.forEach(course => {
    if (course.title.startsWith('[АРХИВ]')) {
      // Remove [АРХИВ] prefix from display title for archived courses
      course.title = course.title.replace('[АРХИВ] ', '');
      course.isArchived = true;
      archivedCourses.push(course);
    } else {
      course.isArchived = false;
      activeCourses.push(course);
    }
  });
  
  // Sort active courses by ID number
  activeCourses.sort((a, b) => {
    const idA = parseInt(a.id, 10);
    const idB = parseInt(b.id, 10);
    return idA - idB;
  });
  
  // Defragment active courses - reassign sequential IDs from 1
  console.log('\nDefragmenting active courses...');
  const courseIdMap = {}; // Maps old ID to new ID
  
  activeCourses.forEach((course, index) => {
    const oldId = course.id;
    const newId = padId(index + 1);
    
    if (oldId !== newId) {
      console.log(`Reassigning: ${oldId} -> ${newId} (${course.title})`);
      courseIdMap[oldId] = newId;
      course.id = newId;
    }
  });
  
  // Update idMappings with new IDs
  if (Object.keys(courseIdMap).length > 0) {
    Object.keys(idMappings).forEach(courseTitle => {
      const oldId = idMappings[courseTitle];
      if (courseIdMap[oldId]) {
        idMappings[courseTitle] = courseIdMap[oldId];
      }
    });
  }
  
  // Sort archived courses by ID number
  archivedCourses.sort((a, b) => {
    const idA = parseInt(a.id, 10);
    const idB = parseInt(b.id, 10);
    return idA - idB;
  });
  
  // Defragment archived courses - reassign sequential IDs from 1
  console.log('\nDefragmenting archived courses...');
  archivedCourses.forEach((course, index) => {
    const oldId = course.id;
    const newId = padId(index + 1);
    
    if (oldId !== newId) {
      console.log(`Reassigning archived: ${oldId} -> ${newId} (${course.title})`);
      course.id = newId;
    }
  });
  
  // Save updated mappings after defragmentation
  saveIdMappings(idMappings);
  
  console.log('Active courses after defragmentation:', activeCourses.map(c => `${c.id}: ${c.title}`).join(', '));
  console.log('Archived courses after defragmentation:', archivedCourses.map(c => `${c.id}: ${c.title}`).join(', '));
  
  // Combine: active courses first, then archived courses
  return [...activeCourses, ...archivedCourses];
}

function main() {
  // Get regular courses
  const courses = getAllCourses();
  
  // Load event info from INFO.md - try to read it directly
  let eventInfo = '';
  const eventInfoPath = path.join(ELEMENTS_DIR, 'Актуални събития Event center', 'INFO.md');
  try {
    eventInfo = fs.readFileSync(eventInfoPath, 'utf8');
    console.log('✓ Loaded event info from:', eventInfoPath);
    console.log('  Event info length:', eventInfo.length, 'characters');
  } catch (error) {
    console.log('ℹ Event info file not found or could not be read');
  }
  
  // Generate build timestamp
  const buildDate = new Date();
const dateParts = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
}).formatToParts(buildDate);

const date = `${dateParts.find(p => p.type === 'day').value}.${dateParts.find(p => p.type === 'month').value}.${dateParts.find(p => p.type === 'year').value}`;

// Часът остава същият
const time = buildDate.toLocaleString('bg-BG', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
  const buildTimestamp = `${date} ${time}`;;
  
  const js = 'const courses = ' + JSON.stringify(courses, null, 2) + ';\n' +
             'const eventInfo = ' + JSON.stringify(eventInfo) + ';\n' +
             'const buildTimestamp = "' + buildTimestamp + '";\n';
  fs.writeFileSync(OUTPUT_FILE, js, 'utf8');
  console.log('Generated courses:', OUTPUT_FILE);
  console.log('Build timestamp:', buildTimestamp);
  
  // Генерирам последни променени файлове
  generateRecentChanges();
  
  // Генерирам HTML таблица и я вмъквам в INFO.md
  updateInfoMdWithRecentFiles();
}

main();
