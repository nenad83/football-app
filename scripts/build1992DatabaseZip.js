/**
 * build1992DatabaseZip.js
 * 
 * Packages the authentic 1992/93 Championship Manager database files from
 * 'F:/Igri/CM Data/1992/Premier League Manager 92-93/Data' into the standard
 * archive 'F:/Igri/CM Data/1992.zip'.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = 'F:/Igri/CM Data/1992/Premier League Manager 92-93/Data';
const STAGE_DIR = path.join(__dirname, 'temp_1992_stage');
const DEST_ZIP = 'F:/Igri/CM Data/1992.zip';

console.log('==================================================================');
console.log('⚽ CM 1992/93 DATABASE BUILDER & ARCHIVER');
console.log('==================================================================');

if (!fs.existsSync(SOURCE_DIR)) {
  console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
  process.exit(1);
}

// 1. Prepare clean staging directory
if (fs.existsSync(STAGE_DIR)) {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGE_DIR, { recursive: true });

// 2. Copy all .dat and .cfg files, skipping any backup copies (- Copy)
const files = fs.readdirSync(SOURCE_DIR);
let copiedCount = 0;

for (const file of files) {
  if (file.includes(' - Copy')) continue;
  if (file.endsWith('.dat') || file.endsWith('.cfg') || file.endsWith('.lng')) {
    const srcPath = path.join(SOURCE_DIR, file);
    const destPath = path.join(STAGE_DIR, file);
    fs.copyFileSync(srcPath, destPath);
    copiedCount++;
  }
}

console.log(`📁 Copied ${copiedCount} database and configuration files to staging.`);

// 3. Compress into F:\Igri\CM Data\1992.zip
if (fs.existsSync(DEST_ZIP)) {
  console.log(`⚠️ Existing ${DEST_ZIP} found. Replacing with clean build...`);
  fs.unlinkSync(DEST_ZIP);
}

console.log(`📦 Packaging ${DEST_ZIP}...`);
const psCmd = `powershell -Command "Compress-Archive -Path '${STAGE_DIR}\\*' -DestinationPath '${DEST_ZIP}' -Force"`;
execSync(psCmd, { stdio: 'inherit' });

// 4. Verify Archive
if (fs.existsSync(DEST_ZIP)) {
  const stats = fs.statSync(DEST_ZIP);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ ${DEST_ZIP} created successfully (${sizeMb} MB)!`);
} else {
  console.error(`❌ Failed to create ${DEST_ZIP}`);
  process.exit(1);
}

// 5. Clean up temporary staging
fs.rmSync(STAGE_DIR, { recursive: true, force: true });

console.log('==================================================================');
console.log('🎉 1992.ZIP DATABASE ARCHIVE READY!');
console.log('==================================================================');
