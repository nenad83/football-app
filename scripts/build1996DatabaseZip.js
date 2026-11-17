/**
 * 1996/97 DATABASE GENERATOR & ZIP BUILDER (football-app)
 * ==============================================================================
 * Builds an authentic Championship Manager 01/02 format "1996.zip" archive
 * in "F:/Igri/CM Data/1996.zip" using authentic player records from CM 96/97
 * (F:/Igri/CM2/CM9697/Game Files) and CM 01/02 base data.
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CM_DATA_DIR = 'F:/Igri/CM Data';
const CM2_GAME_DIR = 'F:/Igri/CM2/CM9697/Game Files';
const BASE_DB_DIR = 'F:/Igri/CM 0102/1997-98/Data';
const CM95_DB_DIR = 'F:/Igri/CM 0102/1995-96/Data';
const TARGET_ZIP = path.join(CM_DATA_DIR, '1996.zip');
const STAGING_DIR = path.join(ROOT_DIR, 'node_modules', '.cm_1996_staging');

console.log("==================================================================");
console.log("⚽ CM 1996/97 DATABASE BUILDER & ARCHIVER");
console.log("==================================================================");

// 1. Prepare Staging Directory
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

console.log("📁 Copying base database files from:", BASE_DB_DIR);
const files = fs.readdirSync(BASE_DB_DIR);
for (const file of files) {
  if (file.toLowerCase().endsWith('.dat')) {
    fs.copyFileSync(path.join(BASE_DB_DIR, file), path.join(STAGING_DIR, file));
  }
}
console.log(`   ⚡ Staged ${files.filter(f => f.endsWith('.dat')).length} .dat files.`);

// 2. Load Staging Database
const staffFile = path.join(STAGING_DIR, 'staff.dat');
const clubFile = path.join(STAGING_DIR, 'club.dat');
const fnFile = path.join(STAGING_DIR, 'first_names.dat');
const snFile = path.join(STAGING_DIR, 'second_names.dat');
const cnFile = path.join(STAGING_DIR, 'common_names.dat');

const staffBuf = fs.readFileSync(staffFile);
const clubBuf = fs.readFileSync(clubFile);
const fnBuf = fs.readFileSync(fnFile);
const snBuf = fs.readFileSync(snFile);
const cnBuf = fs.readFileSync(cnFile);

const STAFF_REC_LEN = 110;
const PLAYER_REC_LEN = 70;

let playerBlockOffset = -1;
for (let cand = 30000 * STAFF_REC_LEN; cand < staffBuf.length - 1000; cand += 1) {
  if (staffBuf.readInt32LE(cand) === 0 &&
      staffBuf.readInt32LE(cand + PLAYER_REC_LEN) === 1 &&
      staffBuf.readInt32LE(cand + PLAYER_REC_LEN * 2) === 2 &&
      staffBuf.readInt32LE(cand + PLAYER_REC_LEN * 3) === 3) {
    playerBlockOffset = cand;
    break;
  }
}

const staffCount = Math.floor(playerBlockOffset / STAFF_REC_LEN);
console.log(`   ⚡ Loaded ${staffCount} staff records, player block at offset ${playerBlockOffset}.`);

function readStringTable(buf, id) {
  if (id <= 0) return '';
  const off = id * 60;
  if (off + 60 > buf.length) return '';
  let end = off;
  while (end < off + 60 && buf[end] !== 0) end++;
  return buf.toString('latin1', off, end).trim();
}

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Index clubs in club.dat
const clubsByNorm = new Map();
for (let i = 0; i < clubBuf.length / 581; i++) {
  const off = i * 581;
  const longName = clubBuf.slice(off + 4, off + 56).toString('latin1').replace(/\0.*$/, '').trim();
  const shortName = clubBuf.slice(off + 56, off + 86).toString('latin1').replace(/\0.*$/, '').trim();
  clubsByNorm.set(normalize(longName), i);
  clubsByNorm.set(normalize(shortName), i);
}

// 3. Known Iconic 1996/97 Club IDs in CM 01/02
const CLUB_IDS = {
  BARCELONA: 1066,      // F.C. Barcelona
  MAN_UTD: 5670,        // Manchester United
  NEWCASTLE: 6369,      // Newcastle United
  ARSENAL: 676,         // Arsenal
  LIVERPOOL: 5339,      // Liverpool
  CHELSEA: 1951,        // Chelsea
  TOTTENHAM: 9396,      // Tottenham Hotspur
  MIDDLESBROUGH: 5921,  // Middlesbrough
  REAL_MADRID: 7551,    // Real Madrid C.F.
  JUVENTUS: 4598,       // Juventus
  AC_MILAN: 5934,       // AC Milan
  INTER: 4346,          // Internazionale
  FIORENTINA: 3247,     // Fiorentina
  PARMA: 6927,          // Parma
  ROMA: 7739,           // AS Roma
  LAZIO: 5165,          // Lazio
  DORTMUND: 2585,       // BV Borussia Dortmund
  BAYERN: 3030,         // FC Bayern München
  AJAX: 244,            // Ajax
  MONACO: 6031,         // AS Monaco
  DEPORTIVO: 2405,      // Deportivo de La Coruña
  ATLETICO: 795,        // Atlético de Madrid
  MARSEILLE: 5759,      // Olympique Marseille
  BOLOGNA: 1374,        // Bologna 1909
  PSV: 6842             // PSV
};

// 4. Parse Authentic CM 96/97 Game Records (PLDATA1 & PLDATA2)
console.log("📖 Parsing authentic 1996/97 players from CM2 game files...");
function parseCM2(filePath) {
  const buf = fs.readFileSync(filePath);
  const players = [];
  const numRecs = Math.floor((buf.length - 632) / 193);
  for (let i = 0; i < numRecs; i++) {
    const off = 632 + i * 193;
    const fn = buf.slice(off, off + 30).toString('latin1').replace(/\0.*$/, '').trim();
    const sn = buf.slice(off + 30, off + 65).toString('latin1').replace(/\0.*$/, '').trim();
    const nat = buf.slice(off + 65, off + 100).toString('latin1').replace(/\0.*$/, '').trim();
    const club = buf.slice(off + 102, off + 137).toString('latin1').replace(/\0.*$/, '').trim();
    if (sn.length > 1) {
      players.push({ fn, sn, name: (fn + ' ' + sn).trim(), nat, club });
    }
  }
  return players;
}

const cm2Players = [
  ...parseCM2(path.join(CM2_GAME_DIR, 'PLDATA1.DB1')),
  ...parseCM2(path.join(CM2_GAME_DIR, 'PLDATA2.DB1'))
];
console.log(`   ⚡ Loaded ${cm2Players.length} authentic CM2 players.`);

// Map CM2 club abbreviations to CM 01/02 Club IDs
function resolveCM2Club(cm2ClubName) {
  if (!cm2ClubName) return null;
  const c = cm2ClubName.trim();
  const cNorm = normalize(c);

  // Exact known mappings
  if (c === 'Man Utd') return CLUB_IDS.MAN_UTD;
  if (c === 'Newcastle') return CLUB_IDS.NEWCASTLE;
  if (c === 'Arsenal') return CLUB_IDS.ARSENAL;
  if (c === 'Liverpool') return CLUB_IDS.LIVERPOOL;
  if (c === 'Chelsea') return CLUB_IDS.CHELSEA;
  if (c === 'Middlesbrough' || c === 'Middlesb') return CLUB_IDS.MIDDLESBROUGH;
  if (c === 'Tottenham') return CLUB_IDS.TOTTENHAM;
  if (c === 'Real Madrid') return CLUB_IDS.REAL_MADRID;
  if (c === 'Barcelona') return CLUB_IDS.BARCELONA;
  if (c === 'Juventus') return CLUB_IDS.JUVENTUS;
  if (c === 'AC Milan' || c === 'Milan') return CLUB_IDS.AC_MILAN;
  if (c === 'Internazionale' || c === 'Inter') return CLUB_IDS.INTER;
  if (c === 'Fiorentina') return CLUB_IDS.FIORENTINA;
  if (c === 'Parma') return CLUB_IDS.PARMA;
  if (c === 'Roma') return CLUB_IDS.ROMA;
  if (c === 'Lazio') return CLUB_IDS.LAZIO;
  if (c === 'Dortmund') return CLUB_IDS.DORTMUND;
  if (c === 'Bayern Munich' || c === 'Bayern') return CLUB_IDS.BAYERN;
  if (c === 'Ajax') return CLUB_IDS.AJAX;
  if (c === 'AS Monaco' || c === 'Monaco') return CLUB_IDS.MONACO;
  if (c === 'Dep.La C' || c === 'Deportivo') return CLUB_IDS.DEPORTIVO;

  // Direct normalized match
  if (clubsByNorm.has(cNorm)) return clubsByNorm.get(cNorm);

  // Expanded UK abbreviations
  const expanded = c
    .replace(/\bU\b/g, 'United')
    .replace(/\bC\b/g, 'City')
    .replace(/\bR\b/g, 'Rovers')
    .replace(/\bO\b/g, 'Orient')
    .replace(/^N\./g, 'Nottingham ')
    .replace(/^Sheff\b/g, 'Sheffield ')
    .replace(/^W\.B\.A\./g, 'West Bromwich Albion')
    .replace(/^Q\.P\.R\./g, 'Queens Park Rangers');

  const expNorm = normalize(expanded);
  if (clubsByNorm.has(expNorm)) return clubsByNorm.get(expNorm);

  return null;
}

// Build index of CM2 players by normalized name
const cm2ClubByPlayerName = new Map();
for (const p of cm2Players) {
  const clubId = resolveCM2Club(p.club);
  if (clubId !== null) {
    const k1 = normalize(p.fn + p.sn);
    const k2 = normalize(p.sn);
    cm2ClubByPlayerName.set(k1, clubId);
    if (!cm2ClubByPlayerName.has(k2)) {
      cm2ClubByPlayerName.set(k2, clubId);
    }
  }
}

// 5. Update staff.dat for 1996/97
console.log("🛠️ Patching staff.dat records for 1996/97 season...");
let updatedCount = 0;
let ageAdjustedCount = 0;

for (let i = 0; i < staffCount; i++) {
  const off = i * STAFF_REC_LEN;
  const fnId = staffBuf.readInt32LE(off + 4);
  const snId = staffBuf.readInt32LE(off + 8);
  const cnId = staffBuf.readInt32LE(off + 12);
  const fn = readStringTable(fnBuf, fnId);
  const sn = readStringTable(snBuf, snId);
  const cn = readStringTable(cnBuf, cnId);
  const fullName = cn || `${fn} ${sn}`.trim();
  const normFull = normalize(fullName);
  const normSn = normalize(sn);

  // 1. Shift birth year (+1) so player is 1 year younger in 1996
  const birthYear = staffBuf.readInt16LE(off + 0x12);
  if (birthYear > 1940 && birthYear < 1985) {
    staffBuf.writeInt16LE(birthYear + 1, off + 0x12);
    ageAdjustedCount++;
  }

  // 2. Iconic 1996 Transfers
  let targetClub = null;
  if (fullName === 'Ronaldo') {
    targetClub = CLUB_IDS.BARCELONA; // Ronaldo 47 goals for Barca in 96/97!
  } else if (fullName === 'Alan Shearer') {
    targetClub = CLUB_IDS.NEWCASTLE;
  } else if (fullName === 'Fabrizio Ravanelli') {
    targetClub = CLUB_IDS.MIDDLESBROUGH;
  } else if (fullName === 'Juninho Paulista' || (fn === 'Osvaldo' && sn === 'Giroldo')) {
    targetClub = CLUB_IDS.MIDDLESBROUGH;
  } else if (fullName === 'Gianluca Vialli') {
    targetClub = CLUB_IDS.CHELSEA;
  } else if (fullName === 'Teddy Sheringham') {
    targetClub = CLUB_IDS.TOTTENHAM;
  } else if (fullName === 'Les Ferdinand') {
    targetClub = CLUB_IDS.NEWCASTLE;
  } else if (fullName === 'David Ginola') {
    targetClub = CLUB_IDS.NEWCASTLE;
  } else if (fullName === 'Marc Overmars') {
    targetClub = CLUB_IDS.AJAX;
  } else if (fullName === 'Emmanuel Petit') {
    targetClub = CLUB_IDS.MONACO;
  } else if (fullName === 'Patrick Kluivert') {
    targetClub = CLUB_IDS.AJAX;
  } else if (fullName === 'Sonny Anderson') {
    targetClub = CLUB_IDS.MONACO;
  } else if (fullName === 'Christian Vieri') {
    targetClub = CLUB_IDS.JUVENTUS;
  } else if (fullName === 'Roberto Baggio') {
    targetClub = CLUB_IDS.AC_MILAN;
  } else if (fullName === 'Edgar Davids') {
    targetClub = CLUB_IDS.AC_MILAN;
  } else if (fullName === 'Christophe Dugarry') {
    targetClub = CLUB_IDS.AC_MILAN;
  } else if (fullName === 'Rivaldo') {
    targetClub = CLUB_IDS.DEPORTIVO;
  } else if (cm2ClubByPlayerName.has(normFull)) {
    targetClub = cm2ClubByPlayerName.get(normFull);
  }

  if (targetClub !== null) {
    staffBuf.writeInt32LE(targetClub, off + 0x39);
    updatedCount++;
  }
}

console.log(`   ⚡ Updated club assignments for ${updatedCount} players.`);
console.log(`   ⚡ Adjusted birth years for ${ageAdjustedCount} staff records.`);

// 6. Restore Eric Cantona at Manchester United
console.log("👑 Restoring Eric Cantona (Captain, Manchester United 1996/97)...");
try {
  // Find a free-agent staff record in staffBuf to replace with Cantona
  for (let i = 500; i < staffCount; i++) {
    const off = i * STAFF_REC_LEN;
    const cid = staffBuf.readInt32LE(off + 0x39);
    const pPtr = staffBuf.readInt32LE(off + 0x61);
    // Find unattached free staff
    if (cid <= 0 && pPtr > 0 && pPtr < 40000) {
      staffBuf.writeInt32LE(1089, off + 0x04);   // fnId: 'Eric'
      staffBuf.writeInt32LE(30864, off + 0x08);  // snId: 'Cantona'
      staffBuf.writeInt32LE(0, off + 0x0C);      // cnId: 0
      staffBuf.writeInt16LE(1966 + 1, off + 0x12); // birthYear: 1966
      staffBuf.writeInt32LE(CLUB_IDS.MAN_UTD, off + 0x39); // Manchester United
      staffBuf.writeInt32LE(pPtr, off + 0x61);    // player pointer

      // Update player record attributes
      const pOff = playerBlockOffset + pPtr * PLAYER_REC_LEN;
      staffBuf.writeInt16LE(188, pOff + 0x05); // 188 Current Ability (5★)
      staffBuf.writeInt16LE(190, pOff + 0x07); // 190 Potential
      staffBuf.writeInt8(20, pOff + 0x15);    // Striker/Forward = 20
      staffBuf.writeInt8(20, pOff + 0x14);    // Attacking Midfield = 20
      staffBuf.writeInt8(20, pOff + 0x19);    // Central = 20
      staffBuf.writeUInt8(7, pOff + 0x04);     // Shirt #7
      console.log(`   ⚡ Eric Cantona restored at Manchester United (Staff #${i}, Shirt #7, CA 188).`);
      break;
    }
  }
} catch (e) {
  console.warn("   ⚠️ Warning: Could not inject Cantona:", e.message);
}

// 7. Write Patched staff.dat
fs.writeFileSync(staffFile, staffBuf);
console.log("💾 Patched staff.dat saved successfully.");

// 8. Compress Staging Directory into 1996.zip
console.log(`📦 Packaging ${TARGET_ZIP}...`);
if (fs.existsSync(TARGET_ZIP)) {
  fs.unlinkSync(TARGET_ZIP);
}

const zipCommand = `powershell -Command "Compress-Archive -Path '${STAGING_DIR}/*' -DestinationPath '${TARGET_ZIP}' -Force"`;
execSync(zipCommand, { stdio: 'inherit' });

const zipStats = fs.statSync(TARGET_ZIP);
console.log(`✅ ${TARGET_ZIP} created successfully (${(zipStats.size / (1024 * 1024)).toFixed(2)} MB)!`);

// 9. Clean up staging directory
try {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
} catch (e) {}

console.log("==================================================================");
console.log("🎉 1996.ZIP DATABASE BUILD COMPLETE!");
console.log("==================================================================");
