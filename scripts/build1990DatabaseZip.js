/**
 * ==============================================================================
 * 1990/91 CM DATABASE ZIP ARCHIVER (build1990DatabaseZip.js)
 * ==============================================================================
 * Creates the authentic "1990.zip" archive in "F:/Igri/CM Data/1990.zip"
 * using the CM 01/02 binary database files (.dat) with all authentic 1990/91
 * club assignments patched (Diego Maradona at Napoli, Prosinečki at Red Star,
 * Platt at Aston Villa, Saunders & Mark Wright at Derby, etc.).
 *
 * This allows running:
 *   node scripts/extractCMSquads.js --season 1990
 * at any time to regenerate 1990 squads directly from the official CM archive!
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CM_DATA_DIR = 'F:/Igri/CM Data';
const SOURCE_1991_ZIP = path.join(CM_DATA_DIR, '1991.zip');
const TARGET_1990_ZIP = path.join(CM_DATA_DIR, '1990.zip');
const STAGING_DIR = path.join(ROOT_DIR, 'node_modules', '.cm_1990_zip_staging');

console.log('==================================================================');
console.log('⚽ CM 1990/91 DATABASE ARCHIVER (1990.ZIP)');
console.log('==================================================================');

if (!fs.existsSync(SOURCE_1991_ZIP)) {
  console.error(`❌ Source archive not found: ${SOURCE_1991_ZIP}`);
  process.exit(1);
}

// 1. Prepare clean staging directory
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// 2. Unpack 1991.zip into staging
console.log(`📦 Unpacking base database from ${SOURCE_1991_ZIP}...`);
execSync(`powershell -Command "Expand-Archive -Path '${SOURCE_1991_ZIP}' -DestinationPath '${STAGING_DIR}' -Force"`);

const staffFile = path.join(STAGING_DIR, 'staff.dat');
const clubFile = path.join(STAGING_DIR, 'club.dat');
const fnFile = path.join(STAGING_DIR, 'first_names.dat');
const snFile = path.join(STAGING_DIR, 'second_names.dat');
const cnFile = path.join(STAGING_DIR, 'common_names.dat');

if (!fs.existsSync(staffFile) || !fs.existsSync(clubFile)) {
  console.error('❌ Failed to unpack staff.dat or club.dat into staging.');
  process.exit(1);
}

const staffBuf = fs.readFileSync(staffFile);
const clubBuf = fs.readFileSync(clubFile);
const fnBuf = fs.readFileSync(fnFile);
const snBuf = fs.readFileSync(snFile);
const cnBuf = fs.readFileSync(cnFile);

function readStringTable(buf, id) {
  if (id <= 0) return '';
  const off = id * 60;
  if (off + 60 > buf.length) return '';
  let end = off;
  while (end < off + 60 && buf[end] !== 0) end++;
  return buf.toString('latin1', off, end).trim();
}

const STAFF_REC_LEN = 110;
const staffCount = Math.floor(staffBuf.length / STAFF_REC_LEN);

console.log(`📂 Loaded staff.dat (${staffCount} records). Patching 1990/91 historical transfers...`);

// 3. Known Club IDs in 1991.zip:
const CLUB_IDS = {
  ASTON_VILLA: 730,
  CRYSTAL_PALACE: 2264,
  DERBY_COUNTY: 2431,
  LIVERPOOL: 5339,
  MAN_UTD: 5670,
  QPR: 7349,
  NAPOLI: 6241,
  JUVENTUS: 4598,
  ROMA: 7739,
  BARI: 1074,
  RED_STAR: 7578,
  REAL_MADRID: 7551,
  ATLETICO_MADRID: 795,
  MONTPELLIER: 6067,
  MARSEILLE: 5759,
  PARIS_SG: 6920,
  PARTIZAN: 6933,
  RANGERS: 7490
};

// Map of transfers to apply in binary staff.dat:
// Format: { staffIndex: optional, nameMatch: string, targetClubId: number, targetClubName: string }
const HISTORICAL_TRANSFERS = [
  { staffIndex: 40544, name: 'David Platt', clubId: CLUB_IDS.ASTON_VILLA, clubName: 'Aston Villa' },
  { staffIndex: 24195, name: 'Ian Wright', clubId: CLUB_IDS.CRYSTAL_PALACE, clubName: 'Crystal Palace' },
  { staffIndex: 24234, name: 'Dean Saunders', clubId: CLUB_IDS.DERBY_COUNTY, clubName: 'Derby County' },
  { staffIndex: 24585, name: 'Mark Wright', clubId: CLUB_IDS.DERBY_COUNTY, clubName: 'Derby County' },
  { staffIndex: 24688, name: 'Peter Beardsley', clubId: CLUB_IDS.LIVERPOOL, clubName: 'Liverpool' },
  { staffIndex: 24666, name: 'Paul Parker', clubId: CLUB_IDS.QPR, clubName: 'QPR' },
  { staffIndex: 24676, name: 'Les Sealey', clubId: CLUB_IDS.MAN_UTD, clubName: 'Manchester United' },
  { staffIndex: 28928, name: 'Diego Maradona', clubId: CLUB_IDS.NAPOLI, clubName: 'Napoli' },
  { staffIndex: 34387, name: 'Jocelyn Angloma', clubId: CLUB_IDS.PARIS_SG, clubName: 'Paris Saint-Germain' },
  { staffIndex: 34692, name: 'Laurent Blanc', clubId: CLUB_IDS.MONTPELLIER, clubName: 'Montpellier' },
  { staffIndex: 40488, name: 'Thomas Häßler', clubId: CLUB_IDS.JUVENTUS, clubName: 'Juventus' },
  { staffIndex: 49242, name: 'Bernd Schuster', clubId: CLUB_IDS.ATLETICO_MADRID, clubName: 'Atlético Madrid' },
  { staffIndex: 49564, name: 'Robert Prosinecki', clubId: CLUB_IDS.RED_STAR, clubName: 'Red Star Belgrade' }
];

let patchedCount = 0;
for (const transfer of HISTORICAL_TRANSFERS) {
  let matchedIdx = -1;
  if (transfer.staffIndex !== undefined) {
    const off = transfer.staffIndex * STAFF_REC_LEN;
    const fnId = staffBuf.readInt32LE(off + 4);
    const snId = staffBuf.readInt32LE(off + 8);
    const cnId = staffBuf.readInt32LE(off + 12);
    const fn = readStringTable(fnBuf, fnId);
    const sn = readStringTable(snBuf, snId);
    const cn = readStringTable(cnBuf, cnId);
    const fullName = cn || `${fn} ${sn}`.trim();
    if (fullName.toLowerCase().includes(transfer.name.toLowerCase())) {
      matchedIdx = transfer.staffIndex;
    }
  }

  // Fallback search by name if index shifted
  if (matchedIdx === -1) {
    for (let i = 0; i < staffCount; i++) {
      const off = i * STAFF_REC_LEN;
      const fnId = staffBuf.readInt32LE(off + 4);
      const snId = staffBuf.readInt32LE(off + 8);
      const cnId = staffBuf.readInt32LE(off + 12);
      const fn = readStringTable(fnBuf, fnId);
      const sn = readStringTable(snBuf, snId);
      const cn = readStringTable(cnBuf, cnId);
      const fullName = cn || `${fn} ${sn}`.trim();
      const pPtr = staffBuf.readInt32LE(off + 0x61);
      if (fullName.toLowerCase() === transfer.name.toLowerCase() && pPtr > 0) {
        matchedIdx = i;
        break;
      }
    }
  }

  if (matchedIdx !== -1) {
    const off = matchedIdx * STAFF_REC_LEN;
    staffBuf.writeInt32LE(transfer.clubId, off + 0x39);
    console.log(`  ⭐ Patched Staff #${matchedIdx}: ${transfer.name} -> Club ID ${transfer.clubId} (${transfer.clubName})`);
    patchedCount++;
  } else {
    console.warn(`  ⚠️ Could not locate player: ${transfer.name}`);
  }
}

console.log(`✅ Successfully patched ${patchedCount} historical transfers into staff.dat.`);

// 4. Save modified staff.dat
fs.writeFileSync(staffFile, staffBuf);
console.log('💾 Patched staff.dat written to staging.');

// 5. Compress staging into F:/Igri/CM Data/1990.zip
console.log(`📦 Packaging ${TARGET_1990_ZIP}...`);
if (fs.existsSync(TARGET_1990_ZIP)) {
  console.log(`  Overwriting existing ${TARGET_1990_ZIP}...`);
  fs.unlinkSync(TARGET_1990_ZIP);
}

execSync(`powershell -Command "Compress-Archive -Path '${STAGING_DIR}/*' -DestinationPath '${TARGET_1990_ZIP}' -Force"`, {
  stdio: 'inherit'
});

if (fs.existsSync(TARGET_1990_ZIP)) {
  const stats = fs.statSync(TARGET_1990_ZIP);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ ${TARGET_1990_ZIP} created successfully (${sizeMb} MB)!`);
} else {
  console.error(`❌ Failed to create ${TARGET_1990_ZIP}`);
  process.exit(1);
}

// 6. Clean up staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

console.log('==================================================================');
console.log('🎉 1990.ZIP READY IN F:/Igri/CM Data/1990.zip');
console.log('==================================================================');
console.log('You can now run:');
console.log('  node scripts/extractCMSquads.js --season 1990');
console.log('==================================================================');
