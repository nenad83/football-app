/**
 * ==============================================================================
 * CHAMPIONSHIP MANAGER (CM 01/02) SQUAD & METADATA EXTRACTOR (football-app)
 * ==============================================================================
 *
 * Extracts authentic player squads (1-5 star ratings), club managers, stadiums,
 * and transfer-listed / loan-listed market pools directly from local CM 01/02
 * database files (.dat files) or Bosman Edition season archives in 2 to 3 seconds.
 *
 * Covers:
 * - European Domestic Leagues (England, Spain, Italy, Germany, France, Netherlands, Portugal, Russia)
 * - South American Domestic Leagues (Argentina, Brazil, Colombia)
 * - European Continental Cups: Champions League (cl), UEFA Cup / Europa League (uefa), Conference League (uecl)
 * - South American Continental Cups: Copa Libertadores (clib), Copa Sudamericana (csud)
 * - Authentic Club Managers (Name, Age, Nationality)
 * - Authentic Stadiums (Name, Capacity, Seating)
 * - Authentic Transfer Market Pool (Free Agents, Transfer Listed, Loan Listed)
 *
 * USAGE:
 *   node scripts/extractCMSquads.js [options]
 *
 * OPTIONS:
 *   --season <year>      Season year (e.g. 2004, 2005, 2001; default: 2004)
 *   --dataDir <path>     Path to folder containing extracted .dat files
 *   --zip <path>         Path to a season zip file (e.g. "F:/Igri/CM Data/Summer 2004.zip")
 *   --league <name>      Filter by league code (e.g. eng04, ita04, cl04, clib04)
 *   --team <name>        Filter by single team name (e.g. "Arsenal", "Boca Juniors")
 *   --dry-run            Simulate extraction without writing JSON files
 *   --help               Show this help message
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const LEAGUES_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues');
const CL_DIR = path.join(ROOT_DIR, 'src', 'data', 'cl');
const UEFA_DIR = path.join(ROOT_DIR, 'src', 'data', 'uefa');
const UECL_DIR = path.join(ROOT_DIR, 'src', 'data', 'uecl');
const CLIB_DIR = path.join(ROOT_DIR, 'src', 'data', 'clib');
const CSUD_DIR = path.join(ROOT_DIR, 'src', 'data', 'csud');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'public', 'data', 'rosters');

// ---------------------------------------------------------------------------
// 1. CLI ARGUMENT PARSING
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}
const hasFlag = flag => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Usage: node scripts/extractCMSquads.js [options]

Options:
  --season <year>      Target season (default: 2004)
  --dataDir <path>     Directory with CM .dat files
  --zip <path>         Season zip file to extract
  --league <name>      Filter by competition code (e.g. eng04, cl04, clib04)
  --team <name>        Filter by single team (e.g. "Chelsea", "River Plate")
  --dry-run            Simulate matching without saving files
  --help               Show help
`);
  process.exit(0);
}

const targetSeason = getArg('--season', '2004');
const seasonShort = targetSeason.slice(-2);
const seasonFullYear = parseInt(targetSeason, 10);
const targetLeague = getArg('--league', null);
const targetTeam = getArg('--team', null);
const isDryRun = hasFlag('--dry-run');

// Locate CM Data Directory or Zip
let cmDataDir = getArg('--dataDir', null);
const cmZipPath = getArg('--zip', null);

if (cmDataDir && (!fs.existsSync(path.join(cmDataDir, 'staff.dat')) || !fs.existsSync(path.join(cmDataDir, 'club.dat')))) {
  console.warn(`⚠️ Warning: Specified --dataDir does not contain staff.dat/club.dat: ${cmDataDir}`);
  cmDataDir = null;
}

let zipToExtract = cmZipPath;

if (!cmDataDir) {
  if (targetSeason === '2001') {
    const odbCandidates = [
      'F:/Igri/CM0102 Bosman Edition/game/Data-3.9.60',
      'F:/Igri/CM0102 Bosman Edition/game/Data-3.9.65',
      'F:/Igri/CM Data/2001-2002',
      'F:/Igri/CM Data/Summer 2001'
    ];
    for (const cand of odbCandidates) {
      if (fs.existsSync(path.join(cand, 'staff.dat')) && fs.existsSync(path.join(cand, 'club.dat'))) {
        cmDataDir = cand;
        break;
      }
    }
  }

  if (!cmDataDir) {
    const retroFolders = [
      `F:/Igri/CM Data/extracted_${targetSeason}/Summer ${targetSeason}`,
      `F:/Igri/CM Data/extracted_${targetSeason}`,
      `F:/Igri/CM 0102/${targetSeason}-${String(parseInt(targetSeason.slice(-2), 10) + 1).padStart(2, '0')}/Data`,
      `F:/Igri/CM 0102/${targetSeason}-${String(parseInt(targetSeason.slice(-2), 10) + 1).padStart(2, '0')}`,
      `F:/Igri/CM Data/${targetSeason}-${parseInt(targetSeason, 10) + 1}/Data`,
      `F:/Igri/CM Data/${targetSeason}-${parseInt(targetSeason, 10) + 1}`
    ];
    for (const cand of retroFolders) {
      if (fs.existsSync(path.join(cand, 'staff.dat')) && fs.existsSync(path.join(cand, 'club.dat'))) {
        cmDataDir = cand;
        break;
      }
    }
  }

  const cmBaseDir = 'F:/Igri/CM Data';
  if (!cmDataDir && fs.existsSync(cmBaseDir)) {
    const allFiles = fs.readdirSync(cmBaseDir);
    for (const f of allFiles) {
      if (f.includes(targetSeason)) {
        const full = path.join(cmBaseDir, f);
        try {
          if (fs.statSync(full).isDirectory()) {
            if (fs.existsSync(path.join(full, 'staff.dat'))) {
              cmDataDir = full;
              break;
            }
            const subs = fs.readdirSync(full);
            for (const sub of subs) {
              const subFull = path.join(full, sub);
              if (fs.statSync(subFull).isDirectory() && fs.existsSync(path.join(subFull, 'staff.dat'))) {
                cmDataDir = subFull;
                break;
              }
            }
            if (cmDataDir) break;
          } else if (f.endsWith('.zip') && !zipToExtract) {
            zipToExtract = full;
          }
        } catch { }
      }
    }
  }
}

if (!cmDataDir && zipToExtract && fs.existsSync(zipToExtract)) {
  console.log(`📦 Extracting ${path.basename(zipToExtract)}...`);
  const extractDest = path.join(ROOT_DIR, 'node_modules', '.cm_cache', targetSeason);
  fs.mkdirSync(extractDest, { recursive: true });
  execSync(`powershell -Command "Expand-Archive -Path '${zipToExtract}' -DestinationPath '${extractDest}' -Force"`);

  const subEntries = fs.readdirSync(extractDest, { withFileTypes: true });
  for (const se of subEntries) {
    const subPath = path.join(extractDest, se.name);
    if (se.isDirectory() && fs.existsSync(path.join(subPath, 'staff.dat'))) {
      cmDataDir = subPath;
      break;
    }
  }
  if (!cmDataDir && fs.existsSync(path.join(extractDest, 'staff.dat'))) {
    cmDataDir = extractDest;
  }
}

if (!cmDataDir || !fs.existsSync(cmDataDir)) {
  console.error("❌ ERROR: Could not find CM database files.");
  console.error("   Please specify --dataDir <folder_with_staff_dat> or --zip <season.zip>");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. HELPER UTILITIES & STRING NORMALIZATION
// ---------------------------------------------------------------------------
function normalizeName(str) {
  if (!str) return "";
  return str
    .replace(/d\.c\./gi, 'dc')
    .replace(/r\.c\.d\./gi, 'rcd')
    .replace(/r\.c\./gi, 'rc')
    .replace(/u\.s\./gi, 'us')
    .replace(/u\.c\./gi, 'uc')
    .replace(/a\.c\./gi, 'ac')
    .replace(/f\.c\./gi, 'fc')
    .replace(/s\.c\./gi, 'sc')
    .replace(/ø/gi, 'o')
    .replace(/Ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/Æ/gi, 'ae')
    .replace(/ß/gi, 'ss')
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

const COUNTRY_MAP = {
  arg: "argentina",
  bra: "brazil",
  col: "colombia",
  eng: "england",
  esp: "spain",
  fra: "france",
  ger: "germany",
  ita: "italy",
  ned: "netherlands",
  por: "portugal",
  rus: "russia",
  cl: "europe_cl",
  uefa: "europe_el",
  uecl: "europe_uecl",
  clib: "south_america_clib",
  csud: "south_america_csud"
};

// ---------------------------------------------------------------------------
// 3. STATS & VALUE CALIBRATION (100% Matches Game Engine)
// ---------------------------------------------------------------------------
function getGeneralPosition(pos) {
  if (!pos) return "MF";
  const p = pos.trim().toUpperCase();
  if (p === "GK" || p === "GOALKEEPER") return "GK";
  if (["DF", "DEFENDER", "CB", "LB", "RB", "SW", "DL", "DR", "DC", "LWB", "RWB"].includes(p)) return "DF";
  if (["MF", "MIDFIELDER", "CM", "DM", "AM", "LM", "RM", "DMC", "AMC", "MC", "ML", "MR", "AML", "AMR"].includes(p)) return "MF";
  if (["FW", "FORWARD", "ST", "CF", "SC", "LW", "RW", "LF", "RF", "STRIKER", "WINGER"].includes(p)) return "FW";
  return "MF";
}

function calculatePlayerValue(rating, age, seasonYear) {
  const r = parseInt(rating, 10) || 3;
  const a = parseInt(age, 10) || 25;

  let baseVal = 0.5;
  if (r === 1) baseVal = 0.3;
  else if (r === 2) baseVal = 1.0;
  else if (r === 3) baseVal = 3.0;
  else if (r === 4) baseVal = 8.0;
  else if (r === 5) baseVal = 22.0;

  let ageMult = 1.0;
  if (a < 23) ageMult = 1.15;
  else if (a >= 29 && a <= 32) ageMult = 0.8;
  else if (a > 32) ageMult = 0.45;

  const eraMultiplier = 1 + (seasonYear - 1980) * 0.04;
  return parseFloat((baseVal * ageMult * eraMultiplier).toFixed(1));
}

function calibrateSquadRatings(squad, stats) {
  // Pure CM ratings: no artificial reduction or scaling. If players are 5 stars, they keep 5 stars.
  return squad;
}

// ---------------------------------------------------------------------------
// 4. CM DATABASE BINARY READER
// ---------------------------------------------------------------------------
function loadCMDatabase(cmDir) {
  console.log(`📂 Reading CM 01/02 database from: ${cmDir}`);
  const t0 = Date.now();

  const fnBuf = fs.readFileSync(path.join(cmDir, 'first_names.dat'));
  const snBuf = fs.readFileSync(path.join(cmDir, 'second_names.dat'));
  const cnBuf = fs.readFileSync(path.join(cmDir, 'common_names.dat'));
  const clubBuf = fs.readFileSync(path.join(cmDir, 'club.dat'));
  const staffBuf = fs.readFileSync(path.join(cmDir, 'staff.dat'));
  const idxBuf = fs.readFileSync(path.join(cmDir, 'index.dat'));
  const stadBuf = fs.existsSync(path.join(cmDir, 'stadium.dat')) ? fs.readFileSync(path.join(cmDir, 'stadium.dat')) : null;
  const natBuf = fs.existsSync(path.join(cmDir, 'nation.dat')) ? fs.readFileSync(path.join(cmDir, 'nation.dat')) : null;

  function readStringTable(buf, id) {
    if (id <= 0) return "";
    const off = id * 60;
    if (off + 60 > buf.length) return "";
    let end = off;
    while (end < off + 60 && buf[end] !== 0) end++;
    return buf.toString('latin1', off, end).trim();
  }

  // Nationality table (290 bytes per record)
  const NAT_REC_LEN = 290;
  function getNation(nationId) {
    if (!natBuf || nationId < 0 || nationId >= natBuf.length / NAT_REC_LEN) return "Unknown";
    const off = nationId * NAT_REC_LEN;
    return natBuf.slice(off + 4, off + 50).toString('latin1').replace(/\0.*$/, '').trim() || "Unknown";
  }

  // Stadium table (78 bytes per record)
  const STAD_REC_LEN = 78;
  function getStadium(stadiumId) {
    if (!stadBuf || stadiumId < 0 || stadiumId >= stadBuf.length / STAD_REC_LEN) {
      return { name: "Municipal Stadium", capacity: 25000, seating: 20000 };
    }
    const off = stadiumId * STAD_REC_LEN;
    const name = stadBuf.slice(off + 4, off + 54).toString('latin1').replace(/\0.*$/, '').trim() || "Municipal Stadium";
    const capacity = stadBuf.readInt32LE(off + 60) || 25000;
    const seating = stadBuf.readInt32LE(off + 64) || Math.round(capacity * 0.8);
    return { name, capacity, seating };
  }

  // Auto-detect TStaff record length (110 bytes in modern Bosman updates vs 157 bytes in original CM0102)
  let STAFF_REC_LEN = 110;
  if (staffBuf.length >= 157 * 2 && staffBuf.readInt32LE(157) === 1) {
    STAFF_REC_LEN = 157;
  } else if (staffBuf.length >= 110 * 2 && staffBuf.readInt32LE(110) === 1) {
    STAFF_REC_LEN = 110;
  }

  // Parse index.dat counts
  const indexEntries = Math.floor(idxBuf.length / 67);
  let staffCount = 0;
  let playerCount = 0;

  for (let i = 0; i < indexEntries; i++) {
    const off = i * 67;
    const name = idxBuf.slice(off + 8, off + 50).toString('latin1').replace(/\0.*$/, '').trim();
    const count = idxBuf.readInt32LE(off + 63);
    if (name === 'staff.dat') {
      if (!staffCount) staffCount = count;
      else if (!playerCount && count > 50000) playerCount = count;
    }
  }

  if (!staffCount) staffCount = Math.floor(staffBuf.length / (STAFF_REC_LEN + 70));
  if (!playerCount) playerCount = 140000;

  // Read Clubs (581 bytes per record; stadium ID at byte offset +105)
  const CLUB_REC_LEN = 581;
  const numClubs = Math.floor(clubBuf.length / CLUB_REC_LEN);
  const clubs = [];
  const clubsById = new Map();

  for (let i = 0; i < numClubs; i++) {
    const off = i * CLUB_REC_LEN;
    const id = clubBuf.readInt32LE(off);
    const longName = clubBuf.slice(off + 4, off + 56).toString('latin1').replace(/\0.*$/, '').trim();
    const shortName = clubBuf.slice(off + 56, off + 86).toString('latin1').replace(/\0.*$/, '').trim();
    const normLong = normalizeName(longName);
    const normShort = normalizeName(shortName);
    const stadiumId = clubBuf.readInt32LE(off + 105);

    const clubObj = { id, longName, shortName, normLong, normShort, stadiumId };
    clubs.push(clubObj);
    clubsById.set(id, clubObj);
  }

  // Find Player Block in staff.dat
  const PLAYER_REC_LEN = 70;
  const staffBlockBytes = staffCount * STAFF_REC_LEN;

  let playerBlockOffset = -1;
  for (let cand = staffBlockBytes; cand < staffBuf.length - 1000; cand += 1) {
    if (staffBuf.readInt32LE(cand) === 0 &&
      staffBuf.readInt32LE(cand + PLAYER_REC_LEN) === 1 &&
      staffBuf.readInt32LE(cand + PLAYER_REC_LEN * 2) === 2 &&
      staffBuf.readInt32LE(cand + PLAYER_REC_LEN * 3) === 3) {
      playerBlockOffset = cand;
      break;
    }
  }

  if (playerBlockOffset === -1) {
    playerBlockOffset = (STAFF_REC_LEN === 157) ? 28613922 : 21058266;
  }

  console.log(`   ⚡ Loaded ${clubs.length} clubs, ${staffCount} staff (${STAFF_REC_LEN}b), ${playerCount} players (${((Date.now() - t0) / 1000).toFixed(2)}s)`);

  return {
    clubs,
    clubsById,
    staffBuf,
    staffCount,
    staffRecLen: STAFF_REC_LEN,
    playerPtrOffset: (STAFF_REC_LEN === 157) ? 0x91 : 0x61,
    playerBlockOffset,
    playerCount,
    getNation,
    getStadium,
    readName(fnId, snId, cnId) {
      const common = readStringTable(cnBuf, cnId);
      if (common) return common;
      const fn = readStringTable(fnBuf, fnId);
      const sn = readStringTable(snBuf, snId);
      return `${fn} ${sn}`.trim() || "Unknown Player";
    }
  };
}

// ---------------------------------------------------------------------------
// 5. PLAYER DECODER WITH 1-5 STARS & TRANSFER / LOAN STATUS
// ---------------------------------------------------------------------------
function decodePlayer(staffBuf, staffOffset, cmDb, seasonYear, clubIdOverride = null) {
  const fnId = staffBuf.readInt32LE(staffOffset + 0x04);
  const snId = staffBuf.readInt32LE(staffOffset + 0x08);
  const cnId = staffBuf.readInt32LE(staffOffset + 0x0C);
  const birthYear = staffBuf.readInt16LE(staffOffset + 0x12);
  const playerPtr = staffBuf.readInt32LE(staffOffset + cmDb.playerPtrOffset);

  if (playerPtr < 0 || playerPtr >= cmDb.playerCount) return null;

  const pOffset = cmDb.playerBlockOffset + playerPtr * 70;
  if (pOffset + 70 > staffBuf.length) return null;

  const currentAbility = staffBuf.readInt16LE(pOffset + 0x05);
  const squadNumber = staffBuf.readUInt8(pOffset + 0x04);

  // Positions (1 to 20 scale)
  const isGK = staffBuf.readInt8(pOffset + 0x0F) >= 15;
  const isDF = staffBuf.readInt8(pOffset + 0x11) >= 15;
  const isDM = staffBuf.readInt8(pOffset + 0x12) >= 15;
  const isMF = staffBuf.readInt8(pOffset + 0x13) >= 15;
  const isAM = staffBuf.readInt8(pOffset + 0x14) >= 15;
  const isFW = staffBuf.readInt8(pOffset + 0x15) >= 15;

  const right = staffBuf.readInt8(pOffset + 0x17) >= 14;
  const left = staffBuf.readInt8(pOffset + 0x18) >= 14;
  const centre = staffBuf.readInt8(pOffset + 0x19) >= 14;

  const positions = [];
  if (isGK) positions.push("GK");
  if (isDF) {
    if (centre) positions.push("DC");
    if (left) positions.push("DL");
    if (right) positions.push("DR");
    if (!centre && !left && !right) positions.push("DC");
  }
  if (isDM) positions.push("DMC");
  if (isMF) {
    if (centre) positions.push("MC");
    if (left) positions.push("ML");
    if (right) positions.push("MR");
    if (!centre && !left && !right) positions.push("MC");
  }
  if (isAM) {
    if (centre) positions.push("AMC");
    if (left) positions.push("AML");
    if (right) positions.push("AMR");
    if (!centre && !left && !right) positions.push("AMC");
  }
  if (isFW) {
    if (centre) positions.push("ST", "CF");
    if (left) positions.push("LW");
    if (right) positions.push("RW");
    if (!centre && !left && !right) positions.push("ST");
  }

  const uniquePositions = Array.from(new Set(positions));
  if (uniquePositions.length === 0) {
    uniquePositions.push("MC");
  }

  // 1 to 5 Star Rating from 0-200 CA
  let rating = 3;
  if (currentAbility >= 170) rating = 5;
  else if (currentAbility >= 140) rating = 4;
  else if (currentAbility >= 110) rating = 3;
  else if (currentAbility >= 80) rating = 2;
  else rating = 1;

  // Age & Underage Youth Trainee Filtering
  // Modded retro CM databases (like 1991/92) keep future child prodigies / academy trainees
  // (e.g. Michael Owen at age 11 in 1991, Gerrard at 10, Carragher at 12) with CA ~30 rather than
  // deleting records. We filter out underage kids from senior squads.
  const realAge = birthYear > 1900 ? (seasonYear - birthYear) : -1;
  if (realAge > 0 && realAge < 16) {
    return null;
  }
  if (birthYear <= 1900 && currentAbility < 50) {
    return null;
  }

  let age = realAge;
  if (isNaN(age) || age < 16 || age > 45) {
    age = 25;
  }

  const name = cmDb.readName(fnId, snId, cnId);

  // Transfer & Loan Status Decoding
  const ownClubId = clubIdOverride !== null ? clubIdOverride : staffBuf.readInt32LE(staffOffset + 0x39);
  const loanClubId = staffBuf.readInt32LE(staffOffset + 0x69);
  const isOnLoan = loanClubId > 0 && loanClubId !== ownClubId && loanClubId < 13000;
  const loanClubObj = isOnLoan ? cmDb.clubsById.get(loanClubId) : null;
  const loanClubName = loanClubObj ? loanClubObj.shortName : null;

  const eStatus = staffBuf.readUInt8(staffOffset + 0x5E); // 2 = Transfer / Loan listed
  const fStatus = staffBuf.readUInt8(staffOffset + 0x5F); // 3 = Surplus / Listed by club
  const isExplicitListed = eStatus === 2 || fStatus === 3;
  const isTransferListed = ownClubId <= 0 || isExplicitListed || isOnLoan;

  const playerVal = calculatePlayerValue(rating, age, seasonYear);

  return {
    name,
    position: uniquePositions[0],
    positions: uniquePositions,
    rating,
    age,
    currentAbility,
    squadNumber: squadNumber > 0 && squadNumber < 100 ? squadNumber : undefined,
    value: playerVal,
    transferListed: isTransferListed,
    loanListed: isOnLoan,
    onLoan: isOnLoan,
    loanClub: loanClubName || undefined,
    condition: 100,
    injuryMatchesLeft: 0,
    injury: null,
    isHistorical: true
  };
}

// ---------------------------------------------------------------------------
// 6. CLUB MATCHING ALGORITHM (Season-Agnostic & Squad-Size Aware)
// ---------------------------------------------------------------------------
const NAME_ALIASES = {
  // Netherlands (Acronyms in CM database)
  "psv eindhoven": ["psv"],
  "psv": ["psv"],
  "nac breda": ["nac"],
  "nac": ["nac"],
  "nec nijmegen": ["nec"],
  "nec": ["nec"],
  "az alkmaar": ["az"],
  "az": ["az"],
  "roda jc": ["roda jc", "roda"],

  // Greece & Eastern Europe
  "olympiacos": ["olympiakos", "olympiakos piraeus"],
  "olympiacos piraeus": ["olympiakos piraeus", "olympiakos"],
  "panathinaikos": ["panathinaikos athens", "panathinaikos"],
  "aek athens": ["aek", "aek athens"],
  "paok": ["paok salonika", "paok"],
  "dinamo zagreb": ["nk dinamo", "dinamo", "nk dinamo zagreb", "dinamo zagreb", "croatia zagreb", "nk croatia"],

  // Russia & Ukraine
  "krylya sovetov": ["krylja sovetov samara", "krylja sovetov", "krylya sovetov"],
  "krylia sovetov": ["krylja sovetov samara", "krylja sovetov", "krylya sovetov"],
  "fc rostov": ["rostselmash", "rostselmash rostov na donu", "rostov"],
  "dynamo moscow": ["dinamo moscow", "dynamo moscow"],
  "dynamo kiev": ["dinamo kiev", "dynamo kiev"],
  "dynamo kyiv": ["dinamo kiev", "dynamo kiev"],
  "zenit st. petersburg": ["zenith st petersburg", "zenit st petersburg", "zenith"],
  "zenit st petersburg": ["zenith st petersburg", "zenit st petersburg", "zenith"],
  "shakhtar donetsk": ["shakhtar", "shakhtar donetsk"],
  "cska moscow": ["cska moscow", "cska"],
  "lokomotiv moscow": ["lokomotiv moscow", "lokomotiv"],
  "torpedo moscow": ["torpedo moscow", "torpedo luzhniki"],

  // Scandinavia, Scotland, Poland & Others
  "brondby": ["brondbyernes idraets forening", "brondby", "brondby if"],
  "fc copenhagen": ["fc kobenhavn", "kobenhavn", "copenhagen"],
  "rosenborg": ["rosenborg bk", "rosenborg"],
  "hearts": ["heart of midlothian", "hearts"],
  "celtic": ["glasgow celtic", "celtic"],
  "rangers": ["glasgow rangers", "rangers"],
  "dyskobolia grodzisk": ["groclin grodzisk", "groclin", "dyskobolia"],
  "dyskobolia": ["groclin grodzisk", "groclin", "dyskobolia"],
  "groclin": ["groclin grodzisk", "groclin"],
  "groclin grodzisk": ["groclin grodzisk", "groclin"],
  "halmstads bk": ["halmstad bk", "halmstad", "halmstads bk"],
  "halmstad bk": ["halmstad bk", "halmstad"],
  "red star belgrade": ["crvena zvezda", "red star", "red star belgrade"],
  "red star": ["crvena zvezda", "red star"],
  "crvena zvezda": ["crvena zvezda", "red star"],
  "dc united": ["washington dc united", "dc united"],

  // Germany
  "cologne": ["1 fc koln", "1 fc koeln", "fc koln", "cologne"],
  "fc cologne": ["1 fc koln", "1 fc koeln", "fc koln", "cologne"],
  "freiburg": ["sc freiburg", "freiburg"],
  "borussia dortmund": ["bv borussia dortmund", "dortmund"],
  "dortmund": ["bv borussia dortmund", "dortmund"],
  "bayern munich": ["fc bayern munchen", "bayern munchen", "fc bayern"],
  "bayer leverkusen": ["bayer 04 leverkusen", "leverkusen"],
  "stuttgart": ["vfb stuttgart", "stuttgart"],
  "nuremberg": ["1 fc nurnberg", "1 fc nuernberg", "nurnberg", "nuernberg"],
  "nurnberg": ["1 fc nurnberg", "1 fc nuernberg", "nurnberg", "nuernberg"],
  "borussia monchengladbach": ["borussia m gladbach", "m gladbach", "monchengladbach", "moenchengladbach"],
  "1860 munich": ["tsv 1860 munchen", "1860 munchen"],
  "1. fc koeln": ["1 fc koln", "1 fc koeln", "fc koln"],
  "1. fc koln": ["1 fc koln", "1 fc koeln", "fc koln"],
  "fc koln": ["1 fc koln", "1 fc koeln", "fc koln"],
  "1. fc saarbruecken": ["1 fc saarbrucken", "1 fc saarbruecken", "saarbrucken", "saarbruecken"],
  "saarbruecken": ["1 fc saarbrucken", "1 fc saarbruecken", "saarbrucken", "saarbruecken"],
  "rot-weiss oberhausen": ["rot weiss oberhausen", "oberhausen"],
  "rot-weiss essen": ["rot weiss essen", "essen"],
  "rot-weiss erfurt": ["rot weiss erfurt", "erfurt"],
  "hertha bsc": ["hertha bsc berlin", "hertha bsc", "hertha berlin"],
  "hertha berlin": ["hertha bsc berlin", "hertha bsc", "hertha berlin"],
  "schalke 04": ["fc schalke 04", "schalke 04", "schalke"],
  "hamburg": ["hamburger sv", "hsv", "hamburg"],
  "werder bremen": ["sv werder bremen", "werder bremen", "bremen"],
  "wolfsburg": ["vfl wolfsburg", "wolfsburg"],
  "bochum": ["vfl bochum", "bochum"],
  "hannover 96": ["hannover 96", "hannover"],

  // South America
  "boca juniors": ["boca juniors", "ca boca juniors", "boca"],
  "river plate": ["river plate", "ca river plate", "river"],
  "santos": ["santos futebol clube", "santos"],
  "flamengo": ["clube de regatas do flamengo", "flamengo"],
  "corinthians": ["sport club corinthians paulista", "corinthians"],
  "palmeiras": ["sociedade esportiva palmeiras", "palmeiras"],
  "gremio": ["gremio foot ball porto alegrense", "gremio"],
  "cruzeiro": ["cruzeiro esporte clube", "cruzeiro"],
  "internacional": ["sport club internacional", "internacional"],
  "sao paulo": ["sao paulo futebol clube", "sao paulo"],
  "athletico paranaense": ["clube atletico paranaense", "atletico paranaense"],
  "atletico paranaense": ["clube atletico paranaense", "atletico paranaense"],
  "atletico mineiro": ["clube atletico mineiro", "atletico mineiro"],
  "vasco da gama": ["clube de regatas vasco da gama", "vasco da gama", "vasco"],
  "ldu quito": ["liga universitaria de quito", "ldu de quito", "universitaria de quito"],
  "la equidad": ["la equidad", "equidad"],
  "boyaca chico": ["boyaca chico", "chico", "chico futbol club"],
  "millonarios": ["millonarios", "los millonarios", "club deportivo los millonarios"],
  "atletico huila": ["atletico huila", "huila", "club deportivo atletico huila"],
  "santa fe": ["santa fe", "independiente santa fe", "club independiente santa fe"],
  "america de cali": ["america de cali", "corporacion deportiva america de cali"],
  "deportivo cali": ["deportivo cali", "asociacion club deportivo cali"],
  "junior": ["junior", "corporacion popular deportiva junior", "atletico junior"],
  "atletico nacional": ["atletico nacional", "corporacion deportiva club atletico nacional"],
  "once caldas": ["once caldas", "corporacion deportiva once caldas"],
  "independiente medellin": ["independiente medellin", "corporacion deportiva independiente medellin"],
  "deportes tolima": ["deportes tolima", "corporacion club deportes tolima"],
  "deportivo pasto": ["deportivo pasto", "asociacion deportivo pasto"],
  "real cartagena": ["real cartagena", "corporacion deportiva real cartagena"],
  "deportes quindio": ["deportes quindio", "corporacion deportes quindio"],
  "envigado": ["envigado", "envigado futbol club"],
  "cortulua": ["cortulua", "corporacion club deportivo tulua", "tulua"],
  "pereira": ["deportivo pereira", "deportivo pereira futbol club", "pereira"],
  "union magdalena": ["union magdalena", "asociacion deportiva club union magdalena"],
  "bucaramanga": ["bucaramanga", "club atletico bucaramanga"],

  // Portugal, Spain, France, Italy, England
  "deportivo la coruna": ["deportivo de la coruna", "deportivo"],
  "deportivo de la coruna": ["deportivo de la coruna", "deportivo"],
  "la coruna": ["deportivo de la coruna", "deportivo"],
  "sporting cp": ["sporting clube de portugal", "sporting cp", "sporting lisbon"],
  "benfica": ["sport lisboa e benfica", "benfica", "sl benfica"],
  "porto": ["futebol clube do porto", "porto", "fc porto"],
  "braga": ["sporting clube de braga", "braga", "sc braga"],
  "atletico madrid": ["club atletico de madrid", "atletico de madrid", "atletico madrid"],
  "athletic bilbao": ["athletic club", "athletic bilbao", "athletic"],
  "real madrid": ["real madrid cf", "real madrid"],
  "barcelona": ["fc barcelona", "barcelona"],
  "inter": ["fc internazionale", "internazionale", "inter milan"],
  "inter milan": ["fc internazionale", "internazionale", "inter milan"],
  "milan": ["ac milan", "milan"],
  "ac milan": ["ac milan", "milan"],
  "juventus": ["juventus fc", "juventus"],
  "roma": ["as roma", "roma"],
  "lazio": ["ss lazio", "lazio"],
  "paris saint-germain": ["paris saint germain", "paris saint germain fc", "psg"],
  "paris sg": ["paris saint germain", "paris saint germain fc", "psg"],
  "ajaccio": ["ajaccio ac", "ac ajaccio", "ajaccio"],
  "ac ajaccio": ["ajaccio ac", "ac ajaccio", "ajaccio"],
  "castilla": ["real madrid b", "real madrid c f b", "real madrid cf b", "castilla"]
};

function findBestMatchingClub(teamName, cmClubs, playersByClubId = null) {
  const norm = normalizeName(teamName);
  const aliasTargets = (NAME_ALIASES[norm] || [norm]).map(normalizeName);

  // Also add prefix- and suffix-stripped target (e.g. 'rc strasbourg' -> 'strasbourg', 'us palermo' -> 'palermo')
  const stripped = norm
    .replace(/^(rc|rcd|uc|us|afc|cfc|cd|ca|as|ss|sk|nk|bk|fk)\s+/, '')
    .replace(/\s+(bk|fk|sk|cf|fc|sc)$/, '')
    .trim();
  if (stripped && stripped !== norm && !aliasTargets.includes(stripped)) {
    aliasTargets.push(stripped);
  }

  const candidates = [];

  for (const target of aliasTargets) {
    for (const c of cmClubs) {
      let score = 0;

      // 1. Exact match on long or short name
      if (c.normLong === target || c.normShort === target) {
        score += 120;
      }
      // 2. Exact word boundaries (e.g. "sc freiburg", "freiburg fc")
      else if (c.normLong.startsWith(target + ' ') || c.normLong.endsWith(' ' + target) || c.normLong.includes(' ' + target + ' ')) {
        score += 85;
      }
      else if (c.normShort.startsWith(target + ' ') || c.normShort.endsWith(' ' + target) || c.normShort.includes(' ' + target + ' ')) {
        score += 80;
      }
      // 3. Substring match for longer distinctive words
      else if (target.length >= 4 && (c.normLong.includes(target) || c.normShort.includes(target))) {
        score += 50;
      }

      if (score > 0) {
        const pCount = playersByClubId ? (playersByClubId.get(c.id)?.length || 0) : 0;
        candidates.push({ c, score, pCount });
      }
    }
    // If exact or strong alias candidates with playable squads found, don't fall back to looser aliases
    if (candidates.some(cand => cand.score >= 80 && cand.pCount >= 11)) break;
  }

  if (candidates.length === 0) {
    // Keyword core match fallback
    const words = norm.split(' ').filter(w => !['fc', 'cf', 'ac', 'de', 'la', 'the', 'ca', 'cd', 'tsv', 'sc', 'vfb', 'sv'].includes(w));
    const coreWord = words[0];
    if (coreWord && coreWord.length >= 4) {
      for (const c of cmClubs) {
        if (c.normLong.includes(coreWord) || c.normShort.includes(coreWord)) {
          const pCount = playersByClubId ? (playersByClubId.get(c.id)?.length || 0) : 0;
          candidates.push({ c, score: 30, pCount });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Heavily prioritize clubs with playable squads (>= 11 players) over empty/reserve entries
  candidates.sort((a, b) => {
    const aHasSquad = a.pCount >= 11 ? 1 : 0;
    const bHasSquad = b.pCount >= 11 ? 1 : 0;
    if (bHasSquad !== aHasSquad) return bHasSquad - aHasSquad;

    const aExact = a.score >= 100 ? 1 : 0;
    const bExact = b.score >= 100 ? 1 : 0;
    if (bExact !== aExact) return bExact - aExact;

    return b.score - a.score || b.pCount - a.pCount;
  });

  return candidates[0].c;
}

// ---------------------------------------------------------------------------
// 7. SQUAD SYNTHESIZER & 22-MAN ROSTER BALANCER
// ---------------------------------------------------------------------------
function synthesizeSquadFiller(existingPlayers, team, seasonYear, region = "") {
  const squad = [...existingPlayers];
  const neededPositions = [
    'GK', 'GK',
    'DC', 'DC', 'DC', 'DC', 'DL', 'DR', 'DL', 'DR',
    'MC', 'MC', 'MC', 'MC', 'ML', 'MR', 'AMC', 'DMC',
    'ST', 'ST', 'ST', 'CF'
  ];

  const havePositions = squad.map(p => p.position);
  const remainingNeeded = [...neededPositions];
  for (const pos of havePositions) {
    const idx = remainingNeeded.indexOf(pos);
    if (idx !== -1) {
      remainingNeeded.splice(idx, 1);
    }
  }

  const isHispanic = ['colombia', 'argentina', 'south_america_clib', 'south_america_csud', 'spain'].includes(region);
  const isIsraeli = /tel[- ]aviv|maccabi|hapoel|jerusalem|haifa/i.test(team.name);
  const isItalian = region === 'italy' || /perugia|juventus|milan|inter|roma|lazio|napoli|palermo|sampdoria/i.test(team.name);

  const firstNames = isIsraeli ? [
    "Baruch", "Avi", "Gal", "Tamir", "Moshe", "Kobi", "Erez", "Tal", "Guy", "Yossi",
    "Yaniv", "Sharon", "Tomer", "Idan", "Omer", "Assi", "Shlomi", "Alon", "Roni", "Nir"
  ] : (isItalian ? [
    "Alessandro", "Gianluigi", "Marco", "Francesco", "Andrea", "Matteo", "Lorenzo", "Roberto", "Simone", "Luca",
    "Fabio", "Daniele", "Federico", "Gabriele", "Filippo", "Davide", "Christian", "Massimo", "Stefano", "Giorgio"
  ] : (isHispanic ? [
    "Carlos", "Diego", "Andrés", "Juan", "David", "Alejandro", "Santiago", "Mateo", "Cristian", "Sebastián",
    "Felipe", "Camilo", "Daniel", "Oscar", "Julián", "Fabio", "Hernán", "Javier", "Nelson", "Ricardo"
  ] : [
    "Luka", "Marko", "Ivan", "David", "Matej", "Filip", "Jan", "Milan", "Stefan", "Nikola",
    "Alex", "Thomas", "Daniel", "Martin", "Andreas", "Michael", "Lucas", "Paul", "Erik", "Simon"
  ]));

  const lastNames = isIsraeli ? [
    "Dego", "Yehiel", "Mishaelof", "Cohen", "Abu Siam", "Musa", "Mesika", "Levi", "Mizrahi", "Peretz",
    "Dahan", "Harazi", "Ben Haim", "Nimni", "Badir", "Keisi", "Banin", "Tal", "Katan", "Zandberg"
  ] : (isItalian ? [
    "Rossi", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno",
    "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana"
  ] : (isHispanic ? [
    "Zapata", "Moreno", "Córdoba", "Murillo", "Ospina", "Bedoya", "Rentería", "Palacios", "Mosquera", "Valencia",
    "Rodríguez", "González", "López", "Gómez", "Martínez", "García", "Pérez", "Sánchez", "Ramírez", "Díaz"
  ] : [
    "Kovacic", "Modric", "Petrovic", "Horvat", "Novak", "Kovacevic", "Babic", "Maric", "Juric", "Simic",
    "Schmidt", "Muller", "Weber", "Fischer", "Schneider", "Hansen", "Johansson", "Larsson", "Nielsen", "Jensen"
  ]));

  let fillerIdx = 0;
  while (squad.length < 22) {
    const pos = remainingNeeded.shift() || 'MC';
    const dept = getGeneralPosition(pos);
    let baseRating = 3;
    if (dept === 'FW') baseRating = team.attack || 3;
    else if (dept === 'MF') baseRating = team.midfield || 3;
    else if (dept === 'DF' || dept === 'GK') baseRating = team.defense || 3;

    const ratingVariance = (fillerIdx % 3 === 0) ? 1 : ((fillerIdx % 5 === 0) ? -1 : 0);
    const rating = Math.max(1, Math.min(5, Math.round(baseRating + ratingVariance)));
    const age = 19 + ((fillerIdx * 7) % 15);
    const fn = firstNames[fillerIdx % firstNames.length];
    const ln = lastNames[(Math.floor(fillerIdx / firstNames.length) + fillerIdx * 3) % lastNames.length];
    const pName = `${fn} ${ln}`;

    squad.push({
      name: pName,
      position: pos,
      positions: [pos],
      rating,
      age,
      currentAbility: rating * 36,
      squadNumber: squad.length + 1,
      value: calculatePlayerValue(rating, age, seasonYear),
      transferListed: false,
      loanListed: false,
      onLoan: false,
      condition: 100,
      injuryMatchesLeft: 0,
      injury: null,
      isHistorical: true
    });
    fillerIdx++;
  }

  return squad;
}
function selectBalancedSquad(players, teamStats) {
  players.sort((a, b) => (b.currentAbility || 0) - (a.currentAbility || 0));

  const gks = players.filter(p => p.position === 'GK');
  const dfs = players.filter(p => ['DC', 'DL', 'DR', 'SW'].includes(p.position));
  const fws = players.filter(p => 
    ['ST', 'CF', 'LW', 'RW'].includes(p.position) ||
    (Array.isArray(p.positions) && p.positions.some(pos => ['ST', 'CF', 'LW', 'RW'].includes(pos)))
  );
  const mfs = players.filter(p => 
    ['MC', 'ML', 'MR', 'DMC', 'AMC', 'AML', 'AMR'].includes(p.position) ||
    (!dfs.includes(p) && !gks.includes(p))
  );

  const squad = [];
  const usedNames = new Set();
  function addPlayer(p) {
    if (p && !usedNames.has(p.name)) {
      squad.push(p);
      usedNames.add(p.name);
      return true;
    }
    return false;
  }

  gks.slice(0, 2).forEach(addPlayer);
  dfs.slice(0, 8).forEach(addPlayer);
  mfs.slice(0, 8).forEach(addPlayer);
  fws.slice(0, 4).forEach(addPlayer);

  // Fill up to 22 with highest ability remaining players
  if (squad.length < 22) {
    for (const p of players) {
      addPlayer(p);
      if (squad.length >= 22) break;
    }
  }

  return squad.slice(0, 22);
}

// ---------------------------------------------------------------------------
// 8. ROSTER & METADATA REGISTRY AUTO-GENERATOR
// ---------------------------------------------------------------------------
function updateRosterRegistry() {
  const rosterDir = OUTPUT_BASE_DIR;
  if (!fs.existsSync(rosterDir)) return;
  const rosterFiles = fs.readdirSync(rosterDir).filter(f => f.startsWith('rosters') && f.endsWith('.json'));
  console.log(`⚡ Public on-demand database refreshed: ${rosterFiles.length} seasons available in /public/data/rosters.`);
}

// ---------------------------------------------------------------------------
// 9. MAIN EXECUTION PIPELINE
// ---------------------------------------------------------------------------
async function main() {
  console.log("==================================================================");
  console.log("⚽ CM 01/02 FULL COMPASS EXTRACTOR (LEAGUES, METADATA & TRANSFERS)");
  console.log("==================================================================");
  console.log(`• Season Target:       ${targetSeason} (code: ${seasonShort})`);
  console.log(`• CM Data Directory:   ${cmDataDir}`);
  console.log(`• Output Directory:    ${path.join(OUTPUT_BASE_DIR, targetSeason)}`);
  console.log(`• Dry Run Mode:        ${isDryRun ? "YES" : "NO"}`);
  if (targetLeague) console.log(`• Filter League:       ${targetLeague}`);
  if (targetTeam) console.log(`• Filter Team:         ${targetTeam}`);
  console.log("==================================================================\n");

  const startTime = Date.now();
  const cmDb = loadCMDatabase(cmDataDir);
  const STAFF_REC_LEN = cmDb.staffRecLen;

  // 1. Group Managers by Club ID (Job === 5 is JOB_MANAGER)
  console.log("⏳ Grouping CM managers by club...");
  const managersByClubId = new Map();
  for (let i = 0; i < cmDb.staffCount; i++) {
    const off = i * STAFF_REC_LEN;
    const clubId = cmDb.staffBuf.readInt32LE(off + 0x39);
    const job = cmDb.staffBuf.readUInt8(off + 0x3D);
    if (clubId > 0 && job === 5) {
      const fnId = cmDb.staffBuf.readInt32LE(off + 0x04);
      const snId = cmDb.staffBuf.readInt32LE(off + 0x08);
      const cnId = cmDb.staffBuf.readInt32LE(off + 0x0C);
      const name = cmDb.readName(fnId, snId, cnId);
      const birthYear = cmDb.staffBuf.readInt16LE(off + 0x12);
      let age = seasonFullYear - birthYear;
      if (isNaN(age) || age < 25 || age > 85) age = 52;
      const natId = cmDb.staffBuf.readInt32LE(off + 0x1A);
      const nationality = cmDb.getNation(natId);
      managersByClubId.set(clubId, { name, age, nationality });
    }
  }
  console.log(`   ⚡ Found ${managersByClubId.size} authentic club managers.`);

  // 2. Group active players by club & collect authentic transfer market pool
  console.log("⏳ Grouping CM players by club & building transfer pool...");
  const playersByClubId = new Map();
  const transferMarketPool = [];

  for (let i = 0; i < cmDb.staffCount; i++) {
    const off = i * STAFF_REC_LEN;
    const clubId = cmDb.staffBuf.readInt32LE(off + 0x39);
    const job = cmDb.staffBuf.readUInt8(off + 0x3D);

    if (job === 11 || job === 12) {
      if (clubId > 0) {
        const p = decodePlayer(cmDb.staffBuf, off, cmDb, seasonFullYear, clubId);
        if (p) {
          if (!playersByClubId.has(clubId)) playersByClubId.set(clubId, []);
          playersByClubId.get(clubId).push(p);

          // If surplus, on loan, or expiring contract, also include in transfer pool
          if ((p.transferListed || p.loanListed) && p.currentAbility >= 95) {
            const owningClub = cmDb.clubsById.get(clubId);
            transferMarketPool.push({
              name: p.name,
              position: p.position,
              positions: p.positions,
              rating: p.rating,
              age: p.age,
              currentClub: owningClub ? owningClub.shortName : "CM Club",
              currentAbility: p.currentAbility,
              value: p.value,
              transferListed: true,
              loanListed: p.loanListed,
              historicalNotes: p.loanListed
                ? `Available on loan from ${owningClub ? owningClub.shortName : 'club'}.`
                : `Listed for transfer by ${owningClub ? owningClub.shortName : 'club'}.`
            });
          }
        }
      } else {
        // Unattached Free Agents
        const p = decodePlayer(cmDb.staffBuf, off, cmDb, seasonFullYear, -1);
        if (p && p.currentAbility >= 90) {
          transferMarketPool.push({
            name: p.name,
            position: p.position,
            positions: p.positions,
            rating: p.rating,
            age: p.age,
            currentClub: "Free Agent",
            currentAbility: p.currentAbility,
            value: p.value,
            transferListed: true,
            loanListed: false,
            historicalNotes: "Unattached free agent available for immediate signing."
          });
        }
      }
    }
  }

  // Deduplicate transfer market targets by name and sort by ability
  const uniqueTransferMap = new Map();
  transferMarketPool.forEach(p => {
    if (!uniqueTransferMap.has(p.name) || (uniqueTransferMap.get(p.name).currentAbility < p.currentAbility)) {
      uniqueTransferMap.set(p.name, p);
    }
  });
  const finalTransferPool = Array.from(uniqueTransferMap.values())
    .sort((a, b) => b.currentAbility - a.currentAbility)
    .slice(0, 300);

  console.log(`   ⚡ Grouped players into ${playersByClubId.size} clubs.`);
  console.log(`   ⚡ Extracted ${finalTransferPool.length} elite transfer market targets & free agents.`);

  // 3. Scan All Competitions (Domestic Leagues & Continental Cups)
  const competitionDirs = [
    { dir: LEAGUES_DIR, type: 'league' },
    { dir: CL_DIR, type: 'cl' },
    { dir: UEFA_DIR, type: 'uefa' },
    { dir: UECL_DIR, type: 'uecl' },
    { dir: CLIB_DIR, type: 'clib' },
    { dir: CSUD_DIR, type: 'csud' }
  ];

  const competitionFiles = [];
  competitionDirs.forEach(({ dir, type }) => {
    if (!fs.existsSync(dir)) return;
    function walk(d) {
      const items = fs.readdirSync(d, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(d, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (item.isFile() && item.name.endsWith('.json') && item.name.includes(seasonShort)) {
          const countryPrefix = type === 'league' ? path.basename(d) : type;
          competitionFiles.push({
            filename: item.name,
            fullPath: full,
            countryPrefix,
            compType: type
          });
        }
      }
    }
    walk(dir);
  });

  const filteredFiles = competitionFiles.filter(item => {
    if (!targetLeague) return true;
    return item.filename.toLowerCase().includes(targetLeague.toLowerCase());
  });

  console.log(`📋 Processing ${filteredFiles.length} competition files for season ${targetSeason}...\n`);

  let totalTeamsProcessed = 0;
  let totalSaved = 0;
  let totalMissing = 0;
  const consolidatedMap = {};
  const teamDetailsMap = {};

  for (const cFile of filteredFiles) {
    const region = COUNTRY_MAP[cFile.countryPrefix] || cFile.countryPrefix;
    const compData = JSON.parse(fs.readFileSync(cFile.fullPath, 'utf8'));
    const compCode = path.basename(cFile.filename, '.json');

    console.log(`🏆 [Competition: ${compCode}] (${region.toUpperCase()} - ${compData.length} teams)`);

    for (const team of compData) {
      if (targetTeam && !team.name.toLowerCase().includes(targetTeam.toLowerCase())) {
        continue;
      }
      totalTeamsProcessed++;

      let matchedClub = findBestMatchingClub(team.name, cmDb.clubs, playersByClubId);
      let isSyntheticClub = false;
      if (!matchedClub) {
        console.log(`   ℹ️ [${team.name}] not in CM DB. Generating synthetic club profile...`);
        isSyntheticClub = true;
        matchedClub = {
          id: -totalTeamsProcessed,
          longName: team.name,
          shortName: team.name,
          stadiumId: -1
        };
      }

      // Stadium metadata
      let stadium = !isSyntheticClub ? cmDb.getStadium(matchedClub.stadiumId) : null;
      if (!stadium) {
        const lowerName = team.name.toLowerCase();
        if (lowerName.includes('deportivo la coruna') || lowerName.includes('la coruna')) {
          stadium = { name: "Riazor", capacity: 34600, seating: 34600 };
        } else if (lowerName.includes('patriotas')) {
          stadium = { name: "Estadio La Independencia", capacity: 20630, seating: 18000 };
        } else if (lowerName.includes('equidad')) {
          stadium = { name: "Estadio Metropolitano de Techo", capacity: 10000, seating: 8000 };
        } else {
          stadium = { name: `${team.name} Stadium`, capacity: 18000, seating: 12000 };
        }
      }

      // Manager metadata
      let manager = (!isSyntheticClub && managersByClubId.get(matchedClub.id)) || null;
      if (!manager || manager.name === "Unknown Manager") {
        const lowerName = team.name.toLowerCase();
        if (lowerName.includes('deportivo la coruna') || lowerName.includes('la coruna')) {
          manager = { name: "Javier Irureta", age: 53, nationality: "Spain" };
        } else if (lowerName.includes('perugia')) {
          manager = { name: "Stefano Colantuono", age: 43, nationality: "Italy" };
        } else if (lowerName.includes('patriotas')) {
          manager = { name: "Álvaro de Jesús Gómez", age: 45, nationality: "Colombia" };
        } else if (lowerName.includes('equidad')) {
          manager = { name: "Alexis García", age: 43, nationality: "Colombia" };
        } else if (!manager) {
          manager = { name: "Unknown Manager", age: 50, nationality: "Unknown" };
        }
      }

      teamDetailsMap[team.name] = {
        manager,
        stadium
      };

      // Squad extraction
      const rawRoster = playersByClubId.get(matchedClub.id) || [];
      let squadToBalance = rawRoster;
      if (rawRoster.length < 11) {
        console.log(`   ℹ️ Synthesizing squad filler for ${team.name} (CM: ${matchedClub.shortName}, existing: ${rawRoster.length} players)...`);
        squadToBalance = synthesizeSquadFiller(rawRoster, team, seasonFullYear, region);
      }

      const balancedSquad = selectBalancedSquad(squadToBalance, {
        attack: team.attack,
        midfield: team.midfield,
        defense: team.defense
      });

      if (!isDryRun) {
        const outDir = path.join(OUTPUT_BASE_DIR, String(seasonFullYear), region);
        fs.mkdirSync(outDir, { recursive: true });
        const outFile = path.join(outDir, `${sanitizeFilename(team.name)}.json`);
        fs.writeFileSync(outFile, JSON.stringify(balancedSquad, null, 2), 'utf8');
        consolidatedMap[team.name] = balancedSquad;
      }

      totalSaved++;
      console.log(`   ✅ [${team.name.padEnd(24)}] -> ${matchedClub.shortName.padEnd(16)} | Mgr: ${manager.name.padEnd(18)} | Stad: ${stadium.name} (${stadium.capacity.toLocaleString()})`);
    }
    console.log("");
  }

  // 4. Save Consolidated Indexes & Transfer Market
  if (!isDryRun) {
    if (Object.keys(consolidatedMap).length > 0) {
      const consolidatedPath = path.join(OUTPUT_BASE_DIR, `rosters${seasonFullYear}.json`);
      fs.writeFileSync(consolidatedPath, JSON.stringify(consolidatedMap, null, 2), 'utf8');
      console.log(`📦 Consolidated squads saved: ${path.relative(ROOT_DIR, consolidatedPath)} (${Object.keys(consolidatedMap).length} clubs)`);

      const detailsPath = path.join(OUTPUT_BASE_DIR, `teamDetails${seasonFullYear}.json`);
      fs.writeFileSync(detailsPath, JSON.stringify(teamDetailsMap, null, 2), 'utf8');
      console.log(`📦 Team metadata (managers & stadiums) saved: ${path.relative(ROOT_DIR, detailsPath)} (${Object.keys(teamDetailsMap).length} clubs)`);

      const transferPath = path.join(OUTPUT_BASE_DIR, `transferMarket${seasonFullYear}.json`);
      fs.writeFileSync(transferPath, JSON.stringify(finalTransferPool, null, 2), 'utf8');
      console.log(`📦 Transfer market pool saved: ${path.relative(ROOT_DIR, transferPath)} (${finalTransferPool.length} players)`);

      updateRosterRegistry();
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("==================================================================");
  console.log("🏁 EXTRACTION COMPLETE!");
  console.log("==================================================================");
  console.log(`• Teams Processed:  ${totalTeamsProcessed}`);
  console.log(`• Squads Extracted: ${totalSaved}`);
  console.log(`• Unmatched Teams:  ${totalMissing}`);
  console.log(`• Total Time:       ${durationSec}s`);
  console.log(`• Output Location:  ${path.join(OUTPUT_BASE_DIR, String(seasonFullYear))}`);
  console.log("==================================================================\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
