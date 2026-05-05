const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FILES_DIR = path.join(ROOT, 'files');
const ASSETS_DIR = path.join(ROOT, 'assets');
const MANIFEST_PATH = path.join(ROOT, 'files-assets-r2-manifest.json');
const DEFAULT_WORKER_URL = 'https://r2-upload.sergey-2210-pavlov.workers.dev';
const DEFAULT_USER_NAME = 'Coursebook Assets';
const DEFAULT_R2_PREFIX = 'coursebook-assets';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const uploadOnly = args.has('--upload-only');
const rewriteOnly = args.has('--rewrite-only');
const archivedOnly = args.has('--archived-only');
const workerUrl = getArgValue('--worker') || DEFAULT_WORKER_URL;
const userName = getArgValue('--user') || DEFAULT_USER_NAME;
const r2Prefix = trimSlashes(getArgValue('--prefix') || DEFAULT_R2_PREFIX);

if (uploadOnly && rewriteOnly) {
  fail('Use only one of --upload-only or --rewrite-only.');
}

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function walkFiles(dir, extension, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, extension, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
      results.push(fullPath);
    }
  }
  return results;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    fail(`Could not read ${path.basename(MANIFEST_PATH)}: ${error.message}`);
  }
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  return types[ext] || 'application/octet-stream';
}

function findAssetRefs(html) {
  const refs = new Set();
  const attrRegex = /\b(?:src|data-original-src)=("|')((?:\.\/|\/)?assets\/[^"']+)\1/gi;
  let match;
  while ((match = attrRegex.exec(html))) {
    refs.add(match[2]);
  }
  return refs;
}

function normalizeAssetRef(ref) {
  return toPosixPath(String(ref || '').replace(/^\.?\//, '').replace(/^\/+/, ''));
}

function resolveAssetPath(normalizedRef) {
  if (!normalizedRef.toLowerCase().startsWith('assets/')) return null;
  const relativeAssetPath = normalizedRef.slice('assets/'.length);
  return path.join(ASSETS_DIR, ...relativeAssetPath.split('/'));
}

function getUploadPath(normalizedRef) {
  return `${r2Prefix}/${normalizedRef}`;
}

async function uploadAsset(normalizedRef, filePath) {
  const data = fs.readFileSync(filePath);
  const blob = new Blob([data], { type: getContentType(filePath) });
  const formData = new FormData();
  formData.append('file', blob, path.basename(filePath));
  formData.append('path', getUploadPath(normalizedRef));
  formData.append('userName', userName);
  formData.append('bucketType', 'default');

  const response = await fetch(workerUrl, { method: 'POST', body: formData });
  const text = await response.text();
  let result;
  try {
    result = text ? JSON.parse(text) : {};
  } catch (_) {
    result = { message: text };
  }

  if (!response.ok || !result.url) {
    const detail = result.message || result.error || text || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return {
    url: result.url,
    key: result.key || '',
    size: result.size || fs.statSync(filePath).size,
    uploadedAt: new Date().toISOString()
  };
}

function collectTargets() {
  const htmlFiles = walkFiles(FILES_DIR, '.html')
    .filter((filePath) => !archivedOnly || path.relative(FILES_DIR, filePath).startsWith('[АРХИВ]'));
  const files = [];
  const assets = new Map();

  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf8');
    const refs = Array.from(findAssetRefs(html));
    if (!refs.length) continue;

    files.push({ filePath, refs });
    for (const ref of refs) {
      const normalized = normalizeAssetRef(ref);
      if (!assets.has(normalized)) {
        assets.set(normalized, {
          normalized,
          filePath: resolveAssetPath(normalized),
          usedBy: []
        });
      }
      assets.get(normalized).usedBy.push(filePath);
    }
  }

  return { files, assets };
}

async function main() {
  const manifest = loadManifest();
  const { files, assets } = collectTargets();
  const assetList = Array.from(assets.values()).sort((a, b) => a.normalized.localeCompare(b.normalized));
  const missing = assetList.filter((asset) => !asset.filePath || !fs.existsSync(asset.filePath));
  const unmapped = assetList.filter((asset) => !manifest[asset.normalized]);

  console.log(`HTML files with local asset refs: ${files.length}`);
  console.log(`Unique local asset refs: ${assetList.length}`);
  console.log(`Already mapped in manifest: ${assetList.length - unmapped.length}`);
  console.log(`Missing local asset files: ${missing.length}`);

  if (missing.length) {
    console.log('\nMissing assets:');
    missing.forEach((asset) => console.log(`- ${asset.normalized}`));
  }

  if (!apply) {
    console.log('\nDry run only. Use --apply to upload and rewrite files.');
    console.log('Options: --archived-only, --upload-only, --rewrite-only, --worker=<url>, --prefix=<path>');
    return;
  }

  if (!rewriteOnly) {
    for (const asset of assetList) {
      if (manifest[asset.normalized]) continue;
      if (!asset.filePath || !fs.existsSync(asset.filePath)) continue;

      process.stdout.write(`Uploading ${asset.normalized} ... `);
      manifest[asset.normalized] = await uploadAsset(asset.normalized, asset.filePath);
      saveManifest(manifest);
      console.log('done');
    }
  }

  if (uploadOnly) {
    console.log('\nUpload-only mode complete. HTML files were not changed.');
    return;
  }

  let changedFiles = 0;
  let replacedRefs = 0;
  for (const target of files) {
    let html = fs.readFileSync(target.filePath, 'utf8');
    let changed = false;

    for (const ref of target.refs) {
      const normalized = normalizeAssetRef(ref);
      const mapped = manifest[normalized];
      if (!mapped || !mapped.url) continue;

      const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const refRegex = new RegExp(escapedRef, 'g');
      const before = html;
      html = html.replace(refRegex, mapped.url);
      if (html !== before) {
        changed = true;
        replacedRefs += 1;
      }
    }

    if (changed) {
      fs.writeFileSync(target.filePath, html, 'utf8');
      changedFiles += 1;
      console.log(`Rewrote ${path.relative(ROOT, target.filePath)}`);
    }
  }

  console.log(`\nChanged HTML files: ${changedFiles}`);
  console.log(`Replaced unique refs in files: ${replacedRefs}`);
  if (missing.length) {
    console.log('Some refs were left unchanged because the local asset file was missing.');
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
