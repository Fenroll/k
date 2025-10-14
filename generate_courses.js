// Node.js script to generate a static JS array of courses, sections, and files for your overlay system
// Usage: node generate_courses.js
// It will output a file 'courses.generated.js' with the JS array for direct inclusion in your HTML
// This version maintains consistent IDs for existing courses when new courses are added

const fs = require('fs');
const path = require('path');

const ELEMENTS_DIR = path.join(__dirname, 'Елементи');
const OUTPUT_FILE = path.join(__dirname, 'courses.generated.js');
const ID_MAPPING_FILE = path.join(__dirname, 'course-ids.json');
const NAME_MAPPING_FILE = path.join(__dirname, 'folder-name-mappings.json');

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
  const subjects = fs.readdirSync(ELEMENTS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
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
  
  // Find the highest existing ID number to continue from
  const existingIds = Object.values(idMappings).map(id => parseInt(id, 10));
  const nextIdValue = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
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
        return processSection(section, sectionPath, `Елементи/${subject}/${section}`, nameMappings);
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
      '.txt', '.log', '.md',
      '.one', '.onetoc2',
      '.url'
    ];
    
    // Get all supported files in this section
    // Separate msg files from regular files
    const files = [];
    const msgNotes = [];
    
    entries
      .filter(dirent => {
        if (!dirent.isFile()) return false;
        const fileName = dirent.name.toLowerCase();
        return supportedExtensions.some(ext => fileName.endsWith(ext));
      })
      .forEach(file => {
        const fileName = file.name;
        const filePath = path.join(sectionPath, fileName);
        const fileExt = path.extname(fileName).toLowerCase();
        
        // Check if it's a msg file (txt, md, or docx with "msg" in name)
        if ((fileExt === '.txt' || fileExt === '.md' || fileExt === '.docx') && fileName.toLowerCase().includes('msg')) {
          // Read content for txt and md files
          let content = '';
          if (fileExt === '.txt' || fileExt === '.md') {
            content = readTextFile(filePath);
          }
          
          msgNotes.push({
            name: fileName,
            path: `${relativePath}/${fileName}`,
            content: content,
            type: fileExt === '.txt' ? 'text' : (fileExt === '.md' ? 'markdown' : 'docx')
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
  
  // Sort courses by ID number for consistent ordering
  courses.sort((a, b) => {
    const idA = parseInt(a.id, 10);
    const idB = parseInt(b.id, 10);
    return idA - idB;
  });
  
  console.log('Courses sorted by ID:', courses.map(c => `${c.id}: ${c.title}`).join(', '));
  
  return courses;
}

function main() {
  const courses = getAllCourses();
  const js = 'const courses = ' + JSON.stringify(courses, null, 2) + ';\n';
  fs.writeFileSync(OUTPUT_FILE, js, 'utf8');
  console.log('Generated courses:', OUTPUT_FILE);
}

main();
