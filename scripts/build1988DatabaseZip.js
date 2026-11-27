/**
 * ==============================================================================
 * 1988/89 CM DATABASE ZIP ARCHIVER (build1988DatabaseZip.js)
 * ==============================================================================
 * Creates "F:/Igri/CM Data/1988.zip" from "F:/Igri/CM Data/1989.zip" by patching
 * Summer 1989 transfers and managerial moves back to their authentic 1988/89
 * clubs and adjusting contract join years <= 1988. Birth years in 1989.zip are
 * already real calendar years, so `extractCMSquads10.js --season 1988`
 * automatically computes exact 1988/89 player ages (1988 - birthYear).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CM_DATA_DIR = 'F:/Igri/CM Data';
const SOURCE_1989_ZIP = path.join(CM_DATA_DIR, '1989.zip');
const TARGET_1988_ZIP = path.join(CM_DATA_DIR, '1988.zip');
const STAGING_DIR = path.join(ROOT_DIR, 'node_modules', '.cm_1988_zip_staging');

console.log('==================================================================');
console.log('⚽ CM 1988/89 DATABASE ARCHIVER (1988.ZIP)');
console.log('==================================================================');

if (!fs.existsSync(SOURCE_1989_ZIP)) {
  console.error(`❌ Source archive not found: ${SOURCE_1989_ZIP}`);
  process.exit(1);
}

// 1. Prepare clean staging directory
if (fs.existsSync(STAGING_DIR)) {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
}
fs.mkdirSync(STAGING_DIR, { recursive: true });

// 2. Unpack 1989.zip into staging
console.log(`📦 Unpacking base database from ${SOURCE_1989_ZIP}...`);
execSync(`powershell -Command "Expand-Archive -Path '${SOURCE_1989_ZIP}' -DestinationPath '${STAGING_DIR}' -Force"`);

const staffFile = path.join(STAGING_DIR, 'staff.dat');
const clubFile = path.join(STAGING_DIR, 'club.dat');
const idxFile = path.join(STAGING_DIR, 'index.dat');
const fnFile = path.join(STAGING_DIR, 'first_names.dat');
const snFile = path.join(STAGING_DIR, 'second_names.dat');
const cnFile = path.join(STAGING_DIR, 'common_names.dat');

if (!fs.existsSync(staffFile) || !fs.existsSync(clubFile)) {
  console.error('❌ Failed to unpack staff.dat or club.dat into staging.');
  process.exit(1);
}

const staffBuf = fs.readFileSync(staffFile);
const clubBuf = fs.readFileSync(clubFile);
const idxBuf = fs.readFileSync(idxFile);
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
const PLAYER_REC_LEN = 70;
let staffCount = 0;
for (let i = 0; i < Math.floor(idxBuf.length / 67); i++) {
  const off = i * 67;
  const name = idxBuf.slice(off + 8, off + 50).toString('latin1').replace(/\0.*$/, '').trim();
  if (name === 'staff.dat') {
    staffCount = idxBuf.readInt32LE(off + 63);
    break;
  }
}

let playerBlockOffset = -1;
for (let c = staffCount * STAFF_REC_LEN; c < staffBuf.length - 500; c++) {
  if (
    staffBuf.readInt32LE(c) === 0 &&
    staffBuf.readInt32LE(c + PLAYER_REC_LEN) === 1 &&
    staffBuf.readInt32LE(c + PLAYER_REC_LEN * 2) === 2
  ) {
    playerBlockOffset = c;
    break;
  }
}

const clubsById = new Map();
const CLUB_REC_LEN = 581;
for (let i = 0; i < Math.floor(clubBuf.length / CLUB_REC_LEN); i++) {
  const off = i * CLUB_REC_LEN;
  const id = clubBuf.readInt32LE(off);
  const longName = clubBuf.slice(off + 4, off + 56).toString('latin1').replace(/\0.*$/, '').trim();
  const shortName = clubBuf.slice(off + 56, off + 86).toString('latin1').replace(/\0.*$/, '').trim();
  clubsById.set(id, { id, longName, shortName });
}

console.log(`📂 Loaded staff.dat (${staffCount} records, playerBlock @ ${playerBlockOffset}). Patching 1988/89 assignments...`);

// 3. Verified 1989.zip Club IDs (cross-checked against club.dat)
const CLUB_IDS = {
  FREE_AGENT: -1,
  // England
  ASTON_VILLA: 933,
  EVERTON: 3722,
  LIVERPOOL: 6635,
  MAN_CITY: 7022,
  MAN_UTD: 7023,
  MIDDLESBROUGH: 7355,
  NEWCASTLE: 7902,
  NORWICH: 8039,
  NOTTINGHAM_FOREST: 8046,
  QPR: 9151,
  SHEFF_WED: 10441,
  SOUTHAMPTON: 10807,
  TOTTENHAM: 11726,
  WEST_HAM: 12765,
  // Italy
  AC_MILAN: 7369,
  ASCOLI: 900,
  AS_ROMA: 9644,
  BOLOGNA: 1728,
  COMO: 2680,
  CREMONESE: 2797,
  FIORENTINA: 4036,
  HELLAS_VERONA: 12377,
  INTER: 5377,
  JUVENTUS: 5691,
  LECCE: 6426,
  MESSINA: 7284,
  MONZA: 7538,
  NAPOLI: 7752,
  PESCARA: 8742,
  PISA: 8826,
  TORINO: 11675,
  TORRES: 11716,
  // Spain
  BARCELONA: 1340,
  LOGRONES: 6678,
  REAL_MADRID: 9413,
  VALLADOLID: 12224,
  // Germany
  BAYER_LEVERKUSEN: 6524,
  BAYER_UERDINGEN: 1412,
  BAYERN_MUNICH: 3766,
  BORUSSIA_MGLADBACH: 6876,
  HAMBURGER_SV: 4747,
  KAISERSLAUTERN: 5776,
  KOLN: 5,
  NURNBERG: 8082,
  VFB_STUTTGART: 12401,
  WERDER_BREMEN: 12757,
  // France
  AS_CANNES: 2190,
  AS_MONACO: 7489,
  AUXERRE: 1074,
  BORDEAUX: 1754,
  LILLE: 6573,
  MARSEILLE: 7136,
  NANTES: 7747,
  NICE: 7933,
  RACING_CP: 9266,
  SOCHAUX: 10716,
  TOULON: 11731,
  TOULOUSE: 11732,
  // Netherlands, Portugal, Belgium, Scandinavia, Switzerland
  AJAX: 331,
  BENFICA: 1497,
  BRONDBY: 1920,
  CLUB_BRUGGE: 2608,
  GRASSHOPPER: 4555,
  KORTRIJK: 5749,
  MALMO: 7008,
  OB: 8106,
  OSTERS_IF: 8385,
  PSV: 8487,
  // Eastern Europe / USSR / Yugoslavia
  BUDUCNOST: 1970,
  CSKA_SOFIA: 2095,
  DINAMO_KIEV: 3119,
  DINAMO_MINSK: 3126,
  NK_DINAMO: 3099,
  NK_OSIJEK: 8368,
  STEAUA: 11076,
  TATABANYA: 1327,
  // South America
  FLAMENGO: 4058,
  NEWELLS: 7909,
  RIVER_PLATE: 9589
};

// Reverse verified Summer 1989 player transfers & manager moves back to 1988/89 clubs
const HISTORICAL_1988_ASSIGNMENTS = [
  // Italy
  { staffIndex: 72161, name: 'Michael Laudrup', clubId: CLUB_IDS.JUVENTUS },
  { staffIndex: 80789, name: 'Alessandro Altobelli', clubId: CLUB_IDS.JUVENTUS },
  { staffIndex: 52223, name: 'Massimo Mauro', clubId: CLUB_IDS.JUVENTUS },
  { staffIndex: 44022, name: 'Antonio Cabrini', clubId: CLUB_IDS.JUVENTUS },
  { staffIndex: 102747, name: 'Salvatore Schillaci', clubId: CLUB_IDS.MESSINA },
  { staffIndex: 102466, name: 'Pierliugi Casiraghi', clubId: CLUB_IDS.MONZA },
  { staffIndex: 39947, name: 'Dario Bonetti', clubId: CLUB_IDS.HELLAS_VERONA },
  { staffIndex: 96772, name: 'Thomas Berthold', clubId: CLUB_IDS.HELLAS_VERONA },
  { staffIndex: 52345, name: 'Claudio Caniggia', clubId: CLUB_IDS.HELLAS_VERONA },
  { staffIndex: 103365, name: 'Roberto Soldà', clubId: CLUB_IDS.HELLAS_VERONA },
  { staffIndex: 57704, name: 'Sergei Aleinikov', clubId: CLUB_IDS.DINAMO_MINSK },
  { staffIndex: 94323, name: 'Jürgen Klinsmann', clubId: CLUB_IDS.VFB_STUTTGART },
  { staffIndex: 5872, name: 'Ramón Díaz', clubId: CLUB_IDS.INTER },
  { staffIndex: 17995, name: 'Gianfranco Zola', clubId: CLUB_IDS.TORRES },
  { staffIndex: 106069, name: 'Francesco Romano', clubId: CLUB_IDS.NAPOLI },
  { staffIndex: 115647, name: 'Marco Baroni', clubId: CLUB_IDS.LECCE },
  { staffIndex: 12432, name: 'Ottavio Bianchi', clubId: CLUB_IDS.NAPOLI, isStaff: true },
  { staffIndex: 103253, name: 'Albertino Bigon', clubId: CLUB_IDS.FREE_AGENT, isStaff: true },
  { staffIndex: 105299, name: 'Pietro Paolo Virdis', clubId: CLUB_IDS.AC_MILAN },
  { staffIndex: 105828, name: 'Roberto Mussi', clubId: CLUB_IDS.AC_MILAN },
  { staffIndex: 108246, name: 'Diego Fuser', clubId: CLUB_IDS.TORINO },
  { staffIndex: 108501, name: 'Andrea Pazzagli', clubId: CLUB_IDS.ASCOLI },
  { staffIndex: 112650, name: 'Stefano Carobbi', clubId: CLUB_IDS.FIORENTINA },
  { staffIndex: 11679, name: 'Glenn Hysén', clubId: CLUB_IDS.FIORENTINA },
  { staffIndex: 80084, name: 'Fulvio Collovati', clubId: CLUB_IDS.AS_ROMA },
  { staffIndex: 76787, name: 'Srecko Katanec', clubId: CLUB_IDS.VFB_STUTTGART },
  { staffIndex: 103352, name: 'Attilio Lombardo', clubId: CLUB_IDS.CREMONESE },
  { staffIndex: 103287, name: 'Giovanni Invernizzi', clubId: CLUB_IDS.COMO },
  { staffIndex: 54295, name: 'Stéphane Demol', clubId: CLUB_IDS.BOLOGNA },
  { staffIndex: 55467, name: 'Júnior', clubId: CLUB_IDS.PESCARA },
  { staffIndex: 108435, name: 'Abel Balbo', clubId: CLUB_IDS.RIVER_PLATE },
  { staffIndex: 115141, name: 'Roberto Nestor Sensini', clubId: CLUB_IDS.NEWELLS },
  { staffIndex: 74550, name: 'Paul Elliott', clubId: CLUB_IDS.PISA },

  // England
  { staffIndex: 77064, name: 'Gary Lineker', clubId: CLUB_IDS.BARCELONA },
  { staffIndex: 31665, name: 'Chris Waddle', clubId: CLUB_IDS.TOTTENHAM },
  { staffIndex: 43463, name: 'Chris Fairclough', clubId: CLUB_IDS.TOTTENHAM },
  { staffIndex: 7546, name: 'Paul Ince', clubId: CLUB_IDS.WEST_HAM },
  { staffIndex: 79063, name: 'Gary Pallister', clubId: CLUB_IDS.MIDDLESBROUGH },
  { staffIndex: 47712, name: 'Neil Webb', clubId: CLUB_IDS.NOTTINGHAM_FOREST },
  { staffIndex: 79065, name: 'Mike Phelan', clubId: CLUB_IDS.NORWICH },
  { staffIndex: 79424, name: 'Danny Wallace', clubId: CLUB_IDS.SOUTHAMPTON },
  { staffIndex: 79351, name: 'Paul McGrath', clubId: CLUB_IDS.MAN_UTD },
  { staffIndex: 47885, name: 'Norman Whiteside', clubId: CLUB_IDS.MAN_UTD },
  { staffIndex: 75811, name: 'Gordon Strachan', clubId: CLUB_IDS.MAN_UTD },
  { staffIndex: 75100, name: 'Trevor Steven', clubId: CLUB_IDS.EVERTON },
  { staffIndex: 45588, name: 'Peter Reid', clubId: CLUB_IDS.EVERTON },
  { staffIndex: 77152, name: 'Martin Keown', clubId: CLUB_IDS.ASTON_VILLA },
  { staffIndex: 81924, name: 'Alan McInally', clubId: CLUB_IDS.ASTON_VILLA },
  { staffIndex: 120568, name: 'Nigel Spackman', clubId: CLUB_IDS.LIVERPOOL },
  { staffIndex: 86691, name: 'Clive Allen', clubId: CLUB_IDS.BORDEAUX },
  { staffIndex: 26528, name: 'Mel Sterland', clubId: CLUB_IDS.SHEFF_WED },
  { staffIndex: 114644, name: 'Kenny Sansom', clubId: CLUB_IDS.NEWCASTLE },

  // Spain
  { staffIndex: 119750, name: 'Ronald Koeman', clubId: CLUB_IDS.PSV },
  { staffIndex: 123818, name: 'Fernando Hierro', clubId: CLUB_IDS.VALLADOLID },
  { staffIndex: 33048, name: 'Ricardo Gallego', clubId: CLUB_IDS.REAL_MADRID },
  { staffIndex: 90997, name: 'Oscar Ruggeri', clubId: CLUB_IDS.LOGRONES },
  { staffIndex: 56471, name: 'Vasyl Rats', clubId: CLUB_IDS.DINAMO_KIEV },
  { staffIndex: 60944, name: 'Luboslav Penev', clubId: CLUB_IDS.CSKA_SOFIA },

  // Germany
  { staffIndex: 7683, name: 'Jürgen Kohler', clubId: CLUB_IDS.KOLN },
  { staffIndex: 94871, name: 'Thomas Allofs', clubId: CLUB_IDS.KOLN },
  { staffIndex: 91762, name: 'Flemming Povlsen', clubId: CLUB_IDS.KOLN },
  { staffIndex: 95128, name: 'Norbert Nachtweih', clubId: CLUB_IDS.BAYERN_MUNICH },
  { staffIndex: 93508, name: 'Manfred Schwabl', clubId: CLUB_IDS.NURNBERG },
  { staffIndex: 95374, name: 'Radmilo Mihajlovic', clubId: CLUB_IDS.NK_DINAMO },
  { staffIndex: 94345, name: 'Michael Frontzeck', clubId: CLUB_IDS.BORUSSIA_MGLADBACH },
  { staffIndex: 52868, name: 'Uwe Bein', clubId: CLUB_IDS.HAMBURGER_SV },
  { staffIndex: 95364, name: 'Bruno Labbadia', clubId: CLUB_IDS.HAMBURGER_SV },
  { staffIndex: 94953, name: 'Stefan Kuntz', clubId: CLUB_IDS.BAYER_UERDINGEN },
  { staffIndex: 93950, name: 'Michael Schulz', clubId: CLUB_IDS.KAISERSLAUTERN },
  { staffIndex: 51611, name: 'Frank Ordenewitz', clubId: CLUB_IDS.WERDER_BREMEN },
  { staffIndex: 93452, name: 'Wolfgang Rolff', clubId: CLUB_IDS.BAYER_LEVERKUSEN },
  { staffIndex: 14164, name: 'Jorginho', clubId: CLUB_IDS.FLAMENGO },
  { staffIndex: 69546, name: 'Brian Laudrup', clubId: CLUB_IDS.BRONDBY },
  { staffIndex: 17055, name: 'Wynton Rufer', clubId: CLUB_IDS.GRASSHOPPER },

  // France
  { staffIndex: 89396, name: 'Enzo Francescoli', clubId: CLUB_IDS.RACING_CP },
  { staffIndex: 86642, name: 'Vincent Guérin', clubId: CLUB_IDS.RACING_CP },
  { staffIndex: 120368, name: 'Sonny Silooy', clubId: CLUB_IDS.RACING_CP },
  { staffIndex: 89085, name: 'Jean Tigana', clubId: CLUB_IDS.BORDEAUX },
  { staffIndex: 86573, name: 'Alain Roche', clubId: CLUB_IDS.BORDEAUX },
  { staffIndex: 95570, name: 'Klaus Allofs', clubId: CLUB_IDS.MARSEILLE },
  { staffIndex: 9203, name: 'Yvon Le Roux', clubId: CLUB_IDS.MARSEILLE },
  { staffIndex: 87245, name: 'William Ayache', clubId: CLUB_IDS.MARSEILLE },
  { staffIndex: 38803, name: 'Manuel Amoros', clubId: CLUB_IDS.AS_MONACO },
  { staffIndex: 1629, name: 'Patrick Battiston', clubId: CLUB_IDS.AS_MONACO },
  { staffIndex: 51821, name: 'Enzo Scifo', clubId: CLUB_IDS.BORDEAUX },
  { staffIndex: 86601, name: 'Jean-Philippe Durand', clubId: CLUB_IDS.TOULOUSE },
  { staffIndex: 54153, name: 'Daniel Bravo', clubId: CLUB_IDS.NICE },
  { staffIndex: 86797, name: 'Stéphane Paille', clubId: CLUB_IDS.SOCHAUX },
  { staffIndex: 119556, name: 'Rob Witschge', clubId: CLUB_IDS.AJAX },
  { staffIndex: 4474, name: 'Joseph-Antoine Bell', clubId: CLUB_IDS.TOULON },
  { staffIndex: 73035, name: 'Bernard Lama', clubId: CLUB_IDS.LILLE },
  { staffIndex: 59291, name: 'Marko Mlinaric', clubId: CLUB_IDS.AUXERRE },
  { staffIndex: 61701, name: 'Zlatko Vujovic', clubId: CLUB_IDS.AS_CANNES },
  { staffIndex: 61644, name: 'Zoran Vujovic', clubId: CLUB_IDS.AS_CANNES },

  // Netherlands, Portugal, Scotland, Belgium, Scandinavia, Yugoslavia, Brazil
  { staffIndex: 79349, name: 'Aldair', clubId: CLUB_IDS.FLAMENGO },
  { staffIndex: 83626, name: 'Bebeto', clubId: CLUB_IDS.FLAMENGO },
  { staffIndex: 128976, name: 'Carlos Mozer', clubId: CLUB_IDS.BENFICA },
  { staffIndex: 70073, name: 'Jonas Thern', clubId: CLUB_IDS.MALMO },
  { staffIndex: 28480, name: 'Thomas Ravelli', clubId: CLUB_IDS.OSTERS_IF },
  { staffIndex: 78093, name: 'Mo Johnston', clubId: CLUB_IDS.NANTES },
  { staffIndex: 52358, name: 'Marc Degryse', clubId: CLUB_IDS.CLUB_BRUGGE },
  { staffIndex: 52562, name: 'Lorenzo Staelens', clubId: CLUB_IDS.KORTRIJK },
  { staffIndex: 65335, name: 'Davor Suker', clubId: CLUB_IDS.NK_OSIJEK },
  { staffIndex: 63823, name: 'Predrag Mijatovic', clubId: CLUB_IDS.BUDUCNOST },
  { staffIndex: 114799, name: 'Miodrag Belodedici', clubId: CLUB_IDS.STEAUA },
  { staffIndex: 92870, name: 'Lars Elstrup', clubId: CLUB_IDS.OB },
  { staffIndex: 99940, name: 'József Kiprich', clubId: CLUB_IDS.TATABANYA }
];

function getFullName(staffIdx) {
  const off = staffIdx * STAFF_REC_LEN;
  const fn = readStringTable(fnBuf, staffBuf.readInt32LE(off + 4));
  const sn = readStringTable(snBuf, staffBuf.readInt32LE(off + 8));
  const cn = readStringTable(cnBuf, staffBuf.readInt32LE(off + 12));
  return cn || `${fn} ${sn}`.trim();
}

let patchedCount = 0;
let missedCount = 0;

for (const transfer of HISTORICAL_1988_ASSIGNMENTS) {
  let matchedIdx = -1;
  if (transfer.staffIndex !== undefined && transfer.staffIndex < staffCount) {
    const nm = getFullName(transfer.staffIndex);
    if (nm.toLowerCase() === transfer.name.toLowerCase() || nm.toLowerCase().includes(transfer.name.toLowerCase())) {
      matchedIdx = transfer.staffIndex;
    }
  }

  if (matchedIdx === -1) {
    let bestCa = -1;
    for (let i = 0; i < staffCount; i++) {
      const nm = getFullName(i);
      if (nm.toLowerCase() !== transfer.name.toLowerCase()) continue;
      const off = i * STAFF_REC_LEN;
      const pPtr = staffBuf.readInt32LE(off + 0x61);
      if (transfer.isStaff) {
        if (staffBuf.readInt32LE(off + 0x69) >= 0) {
          matchedIdx = i;
          break;
        }
      } else if (pPtr >= 0 && playerBlockOffset > 0) {
        const po = playerBlockOffset + pPtr * PLAYER_REC_LEN;
        const ca = staffBuf.readInt16LE(po + 5);
        if (ca > bestCa) {
          bestCa = ca;
          matchedIdx = i;
        }
      }
    }
  }

  if (matchedIdx !== -1) {
    const off = matchedIdx * STAFF_REC_LEN;
    staffBuf.writeInt32LE(transfer.clubId, off + 0x39);
    const curJoinYr = staffBuf.readInt16LE(off + 0x40);
    if (curJoinYr >= 1989) {
      staffBuf.writeInt16LE(1988, off + 0x40);
    }
    const clubLabel = transfer.clubId === -1
      ? 'FREE AGENT'
      : (clubsById.get(transfer.clubId)?.longName || `Club #${transfer.clubId}`);
    console.log(`  ⭐ #${matchedIdx}: ${transfer.name} -> ${clubLabel} (${transfer.clubId})`);
    patchedCount++;
  } else {
    console.warn(`  ⚠️ Could not locate: ${transfer.name}`);
    missedCount++;
  }
}

// Clamp any remaining 1989 join years to 1988 so no staff shows a future join date
let clampedDates = 0;
for (let i = 0; i < staffCount; i++) {
  const off = i * STAFF_REC_LEN;
  const joinYr = staffBuf.readInt16LE(off + 0x40);
  if (joinYr === 1989) {
    staffBuf.writeInt16LE(1988, off + 0x40);
    clampedDates++;
  }
}

console.log(`✅ Patched ${patchedCount} 1988/89 assignments (missed: ${missedCount}), normalized ${clampedDates} join years.`);

// 4. Write patched staff.dat
fs.writeFileSync(staffFile, staffBuf);
console.log('💾 Patched staff.dat written to staging.');

// 5. Package into F:/Igri/CM Data/1988.zip
console.log(`📦 Packaging ${TARGET_1988_ZIP}...`);
if (fs.existsSync(TARGET_1988_ZIP)) {
  console.log(`  Overwriting existing ${TARGET_1988_ZIP}...`);
  fs.unlinkSync(TARGET_1988_ZIP);
}

execSync(`powershell -Command "Compress-Archive -Path '${STAGING_DIR}\\*' -DestinationPath '${TARGET_1988_ZIP}' -Force"`, {
  stdio: 'inherit'
});

if (fs.existsSync(TARGET_1988_ZIP)) {
  const stats = fs.statSync(TARGET_1988_ZIP);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ ${TARGET_1988_ZIP} created successfully (${sizeMb} MB)!`);
} else {
  console.error(`❌ Failed to create ${TARGET_1988_ZIP}`);
  process.exit(1);
}

// 6. Clean up staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

console.log('==================================================================');
console.log('🎉 1988.ZIP READY IN F:/Igri/CM Data/1988.zip');
console.log('==================================================================');
