// Node.js script to generate a static JS array of courses, sections, and files for your overlay system
// Usage: node generate_courses.js
// It will output a file 'courses.generated.js' with the JS array for direct inclusion in your HTML
// This version maintains consistent IDs for existing courses when new courses are added

const fs = require('fs');
const path = require('path');

const ELEMENTS_DIR = path.join(__dirname, 'files');
const OUTPUT_FILE = path.join(__dirname, 'courses.generated.js');
const CONTENT_DIR = path.join(__dirname, 'courses-data');
const ID_MAPPING_FILE = path.join(__dirname, 'course-ids.json');
const NAME_MAPPING_FILE = path.join(__dirname, 'folder-name-mappings.json');
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
  if (nameMappings[folderName] && typeof nameMappings[folderName] === 'object') {
    return nameMappings[folderName].title || folderName;
  }
  return nameMappings[folderName] || folderName;
}

// Helper function to get custom text from mappings
function getCustomText(folderName, nameMappings) {
  if (nameMappings[folderName] && typeof nameMappings[folderName] === 'object') {
    return nameMappings[folderName].customText || '';
  }
  return '';
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

function replaceColors(content) {
  return content
    .replace(/#7c2d12/g, '#3a5a40')
    .replace(/rgba\(146, 64, 14, 0\.1\)/g, 'rgba(218, 215, 205, 0.3)')
    .replace(/#f59e0b/g, '#a3b18a')
    .replace(/#78350f/g, '#3a5a40');
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
    // Check if the subject (stripped of archive prefix) still exists
    let strippedCourseTitle = courseTitle;
    if (strippedCourseTitle.startsWith('[АРХИВ] ')) {
      strippedCourseTitle = strippedCourseTitle.replace('[АРХИВ] ', '');
    }
    if (!subjects.some(s => {
      if (s.startsWith('[АРХИВ] ')) return s.replace('[АРХИВ] ', '') === strippedCourseTitle;
      return s === strippedCourseTitle;
    })) {
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
    const originalSubjectName = subject; // Store original subject name
    let subjectForMapping = subject;
    let isArchivedFolder = false;

    // Check if the folder name indicates an archived course
    if (subject.startsWith('[АРХИВ] ')) {
      subjectForMapping = subject.replace('[АРХИВ] ', ''); // Strip prefix for mapping
      isArchivedFolder = true;
    }

    const subjectPath = path.join(ELEMENTS_DIR, originalSubjectName); // Use original subject for path
    
    // Get or assign stable ID for this course
    const { id } = getOrAssignId(subjectForMapping, idMappings, nextId); // Use stripped subject for ID mapping
    
    // Apply name mapping for the course title and get custom text
    const displayTitle = getMappedName(subjectForMapping, nameMappings);
    const customText = getCustomText(subjectForMapping, nameMappings);
    
    const sections = fs.readdirSync(subjectPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .map(section => {
        const sectionPath = path.join(subjectPath, section);
  return processSection(section, sectionPath, `files/${originalSubjectName}/${section}`, nameMappings);
      });
    
    return {
      id: id,
      title: displayTitle,
      customText: customText,
      isArchived: isArchivedFolder, // Set isArchived flag here
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
            content = replaceColors(content);
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
  
  // The rest of the function remains the same, but the archiving logic is now based on isArchived flag
  
  // Separate active and archived courses based on the isArchived flag
  const activeCourses = courses.filter(course => !course.isArchived);
  const archivedCourses = courses.filter(course => course.isArchived);
  
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
  Object.keys(idMappings).forEach(mappedSubject => {
    const oldId = idMappings[mappedSubject];
    if (courseIdMap[oldId]) {
      idMappings[mappedSubject] = courseIdMap[oldId];
    }
  });
  
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
  
  // Save updated mappings after all defragmentation
  saveIdMappings(idMappings);
  
  console.log('Active courses after defragmentation:', activeCourses.map(c => `${c.id}: ${c.title}`).join(', '));
  console.log('Archived courses after defragmentation:', archivedCourses.map(c => `${c.id}: ${c.title}`).join(', '));
  
  // Combine: active courses first, then archived courses
  return [...activeCourses, ...archivedCourses];
}

function updateHtmlFiles(version) {
  // Update all top-level HTML files in the workspace root
  const htmlFiles = fs.readdirSync(__dirname)
    .filter(name => name.toLowerCase().endsWith('.html'))
    .map(name => path.join(__dirname, name));

  htmlFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠ Skipping ${path.basename(filePath)} - file not found`);
      return;
    }

    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;

      function replaceOutsideScriptBlocks(html, pattern, replacement) {
        const scriptBlockPattern = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
        let lastIndex = 0;
        let result = '';
        let changed = false;
        let match;

        while ((match = scriptBlockPattern.exec(html)) !== null) {
          const before = html.slice(lastIndex, match.index);
          const replacedBefore = before.replace(pattern, replacement);
          if (replacedBefore !== before) changed = true;
          result += replacedBefore;
          result += match[0];
          lastIndex = match.index + match[0].length;
        }

        const after = html.slice(lastIndex);
        const replacedAfter = after.replace(pattern, replacement);
        if (replacedAfter !== after) changed = true;
        result += replacedAfter;

        return { content: result, changed };
      }
      
      // 1. Replace courses.generated.js script tags
      const coursesPattern = /<script src="courses\.generated\.js(?:\?v=[a-zA-Z0-9_]+)?"><\/script>/g;
      const newCoursesTag = `<script src="courses.generated.js?v=${version}"></script>`;
      
      if (coursesPattern.test(content)) {
        content = content.replace(coursesPattern, newCoursesTag);
        updated = true;
      }

      // 2. Replace js/chat.js script tags
      const chatPattern = /<script src="js\/chat\.js(?:\?v=[a-zA-Z0-9_]+)?"><\/script>/g;
      const newChatTag = `<script src="js/chat.js?v=${version}"></script>`;
      
      if (chatPattern.test(content)) {
        content = content.replace(chatPattern, newChatTag);
        updated = true;
      }

      // 3. Replace js/account-system.js script tags
      const accountPattern = /<script src="(?:\.\/)?js\/account-system\.js(?:\?v=[a-zA-Z0-9_]+)?"><\/script>/g;
      const newAccountTag = `<script src="./js/account-system.js?v=${version}"></script>`;
      
      if (accountPattern.test(content)) {
        content = content.replace(accountPattern, newAccountTag);
        updated = true;
      }

      // 4. Replace js/auth-guard.js script tags
      const guardPattern = /<script src="js\/auth-guard\.js(?:\?v=[a-zA-Z0-9_]+)?"><\/script>/g;
      const newGuardTag = `<script src="js/auth-guard.js?v=${version}"></script>`;
      
      if (guardPattern.test(content)) {
        content = content.replace(guardPattern, newGuardTag);
        updated = true;
      }

      // 5. Enforce one-token policy for local static assets (script/link/img/source)
      // IMPORTANT: only apply outside <script> blocks to avoid mutating JS template strings.
      const localAssetPattern = /(<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=")(?!https?:\/\/|\/\/|data:|blob:|chrome-extension:|mailto:|tel:|#)([^"?]+)(?:\?v=[a-zA-Z0-9_]+)?(")/gi;
      const localAssetResult = replaceOutsideScriptBlocks(
        content,
        localAssetPattern,
        `$1$2?v=${version}$3`
      );
      if (localAssetResult.changed) {
        content = localAssetResult.content;
        updated = true;
      }

      // 5b. Enforce same token for internal page links (e.g. href="account.html?v=...")
      // Apply outside <script> blocks only.
      const internalHtmlLinkPattern = /(href=")(?!https?:\/\/|\/\/|mailto:|tel:|#)(?:\.\/)?([^"?#]+\.html)(?:\?v=[a-zA-Z0-9_]+)?(")/gi;
      const internalLinkResult = replaceOutsideScriptBlocks(
        content,
        internalHtmlLinkPattern,
        `$1$2?v=${version}$3`
      );
      if (internalLinkResult.changed) {
        content = internalLinkResult.content;
        updated = true;
      }

      // 6. Ensure central version manager is loaded on all updated pages
      const versionManagerPattern = /<script src="(?:\.\/)?js\/version-manager\.js(?:\?v=[a-zA-Z0-9_]+)?"><\/script>/g;
      const versionManagerTag = `<script src="js/version-manager.js?v=${version}"></script>`;

      if (versionManagerPattern.test(content)) {
        content = content.replace(versionManagerPattern, versionManagerTag);
        updated = true;
      } else if (content.includes('</head>')) {
        content = content.replace('</head>', `  ${versionManagerTag}\n</head>`);
        updated = true;
      }
      
      if (updated) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Updated ${path.basename(filePath)} with version ${version}`);
      } else {
        console.log(`⚠ No versioned script tags found in ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`✗ Error updating ${path.basename(filePath)}:`, error.message);
    }
  });
}

// Extract content from a course's sections into a flat path->content map
function extractCourseContent(course) {
  const contentMap = {};
  
  function walkSection(section) {
    if (section.msgNotes) {
      section.msgNotes.forEach(note => {
        if (note.content) {
          contentMap[note.path] = note.content;
        }
      });
    }
    if (section.subsections) {
      section.subsections.forEach(walkSection);
    }
  }
  
  if (course.sections) {
    course.sections.forEach(walkSection);
  }
  return contentMap;
}

// Strip content from a course's sections (for the main metadata-only output)
function stripCourseContent(course) {
  function walkSection(section) {
    if (section.msgNotes) {
      section.msgNotes.forEach(note => {
        delete note.content;
      });
    }
    if (section.subsections) {
      section.subsections.forEach(walkSection);
    }
  }
  
  if (course.sections) {
    course.sections.forEach(walkSection);
  }
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

  // Generate build timestamp and version (YYYYMMDD + time-based hash for uniqueness)
  const buildDate = new Date();
  const pad = n => n.toString().padStart(2, '0');
  const dateStr = `${buildDate.getFullYear()}${pad(buildDate.getMonth() + 1)}${pad(buildDate.getDate())}`;
  const timeHash = (buildDate.getHours() * 3600 + buildDate.getMinutes() * 60 + buildDate.getSeconds()).toString(36);
  const version = `${dateStr}${timeHash}`;

  // For display
  const dateParts = new Intl.DateTimeFormat('bg-BG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).formatToParts(buildDate);
  const date = `${dateParts.find(p => p.type === 'day').value}.${dateParts.find(p => p.type === 'month').value}.${dateParts.find(p => p.type === 'year').value}`;
  const time = buildDate.toLocaleString('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const buildTimestamp = `${date} ${time}`;

  // --- Generate per-course content files ---
  // Create courses-data directory
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }
  
  // Clean old content files
  const existingContentFiles = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.js'));
  existingContentFiles.forEach(f => fs.unlinkSync(path.join(CONTENT_DIR, f)));
  
  let totalContentFiles = 0;
  let totalContentSize = 0;
  
  courses.forEach(course => {
    const contentMap = extractCourseContent(course);
    const noteCount = Object.keys(contentMap).length;
    
    if (noteCount > 0) {
      // Use a unique content key: prefix archived courses to avoid ID collision
      const contentKey = (course.isArchived ? 'archived-' : '') + course.id;
      
      // Write per-course content file:
      // (window.courseContent = window.courseContent || {})["000001"] = { "path": "content", ... };
      const contentJs = '(window.courseContent = window.courseContent || {})' +
        '[' + JSON.stringify(contentKey) + '] = ' + JSON.stringify(contentMap) + ';\n';
      
      const contentFile = path.join(CONTENT_DIR, `${contentKey}.js`);
      fs.writeFileSync(contentFile, contentJs, 'utf8');
      
      // Store the content key on the course for client-side lookup
      course._contentKey = contentKey;
      
      const fileSize = Buffer.byteLength(contentJs, 'utf8');
      totalContentSize += fileSize;
      totalContentFiles++;
      console.log(`  ✓ courses-data/${contentKey}.js (${noteCount} notes, ${(fileSize / 1024).toFixed(1)} KB)`);
    }
  });
  
  console.log(`\n✓ Generated ${totalContentFiles} per-course content files (${(totalContentSize / 1024 / 1024).toFixed(2)} MB total)`);
  
  // --- Now strip content from main courses array and write metadata-only file ---
  courses.forEach(stripCourseContent);

  const js = 'window.coursesVersion = "' + version + '";\n' +
             'window.courses = ' + JSON.stringify(courses, null, 2) + ';\n' +
             'window.eventInfo = ' + JSON.stringify(eventInfo) + ';\n' +
             'window.buildTimestamp = "' + buildTimestamp + '";\n';
  fs.writeFileSync(OUTPUT_FILE, js, 'utf8');
  
  const mainSize = Buffer.byteLength(js, 'utf8');
  console.log(`\n✓ Generated ${OUTPUT_FILE} (${(mainSize / 1024).toFixed(1)} KB - metadata only)`);
  console.log('Build timestamp:', buildTimestamp);
  console.log('coursesVersion:', version);

  // Save version to JSON file for external reference
  const versionData = { version, timestamp: buildTimestamp };
  const VERSION_FILE = path.join(__dirname, 'courses.version.json');
  fs.writeFileSync(VERSION_FILE, JSON.stringify(versionData, null, 2), 'utf8');
  console.log('✓ Saved version to:', VERSION_FILE);

  // Update HTML files with new version
  console.log('\nUpdating HTML files...');
  updateHtmlFiles(version);
}

main();
