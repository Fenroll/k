// HTML Priority Files - Keyboard Shortcuts Configuration
// Configure your 3 priority HTML files here using relative paths from the website root
// Example: 'files/Клинична Генетика/Изпит/1-msg-Теми.html'

// Function to convert absolute file path to relative path
// Input: D:\Filen\Personal\Website\files\Актуални събития Event center\INFO.md
// Output: files/Актуални събития Event center/INFO.md
function convertAbsoluteToRelativePath(absolutePath) {
  // Find the position of 'files' folder
  const filesIndex = absolutePath.toLowerCase().indexOf('\\files\\');
  
  if (filesIndex !== -1) {
    // Extract everything from 'files' onwards and convert backslashes to forward slashes
    const relativePath = absolutePath.substring(filesIndex + 1).replace(/\\/g, '/');
    return relativePath;
  }
  
  // If 'files' folder not found, try to extract from 'files' at the end of a path component
  const parts = absolutePath.split('\\');
  const filesIdx = parts.findIndex(part => part.toLowerCase() === 'files');
  
  if (filesIdx !== -1) {
    // Join from 'files' onwards with forward slashes
    return parts.slice(filesIdx).join('/');
  }
  
  // If conversion not possible, return original path
  console.warn('Could not convert path:', absolutePath);
  return absolutePath;
}

const htmlPriority = {
  1: 'files/Рентгенология/Изпит/1-msg-Теми.html',
  2: 'files/Клинична Генетика/Изпит/2-msg-Въпроси.html',  // Replace with your second priority file
  3: 'files/Клинична Генетика/Изпит/1-msg-Теми.html'     // Replace with your third priority file
};
