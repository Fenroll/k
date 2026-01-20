const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT_DIR = __dirname; // Използва текущата директория

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
    // Премахване на query parameters (напр. ?v=15)
    const urlPath = req.url.split('?')[0];
    let filePath = path.join(ROOT_DIR, urlPath === '/' ? 'index.html' : urlPath);
    
    // Декодиране на URL (convert %20 to space)
    filePath = decodeURIComponent(filePath);
    
    // Позволи достъп до файлове без .html разширение
    if (path.extname(filePath) === '' && urlPath !== '/') {
        if (fs.existsSync(filePath + '.html')) {
            filePath += '.html';
        }
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                fs.readFile(path.join(ROOT_DIR, '404.html'), (error, content404) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    if (error) {
                        res.end('404 Not Found', 'utf-8');
                    } else {
                        res.end(content404, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + err.code + ' ..\n');
            }
        } else {
            // Enable CORS for all responses
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('\n\n');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   DEV SERVER ЗАПУЩЕН                     ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Local:   http://localhost:${PORT}`);
    console.log(`📁 Root:    ${ROOT_DIR}`);
    console.log('');
    console.log('💡 Отвори браузъра и провери конзолата (F12)');
    console.log('   Всички CORS грешки трябва да са решени!');
    console.log('\nНатисни Ctrl+C за спиране\n\n');
});
