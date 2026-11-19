/**
 * ==============================================================================
 * CHAMPIONSHIP MANAGER (CM 01/02) SQUAD & FINANCE EXTRACTOR - 1 TO 10 RATING (football-app)
 * ==============================================================================
 *
 * Extracts authentic player squads with 1-10 SKILL RATINGS, club managers,
 * stadiums, and transfer-listed / loan-listed pools directly from CM 01/02
 * database files (.dat files) or Bosman Edition archives.
 *
 * NEW FINANCIAL SYSTEM:
 * - Extracts authentic Transfer Budgets (Cash at Bank) from club.dat (offset 101).
 * - Extracts authentic Payroll & Wage Caps from club.dat (offsets 119 and 123).
 * - Applies a realistic Era Inflation Multiplier across 1990-2025 so budgets
 *   and player wages scale smoothly and historically.
 * - Adds individual weekly wages to each player based on club wage caps.
 *
 * USAGE:
 *   node scripts/extractCMSquads10.js [options]
 *
 * OPTIONS:
 *   --season <year>      Season year (e.g. 2001, 2002, 2004, 1995; default: 2001)
 *   --dataDir <path>     Path to folder containing extracted .dat files
 *   --zip <path>         Path to a season zip file (e.g. "F:/Igri/CM Data/2001.zip")
 *   --league <name>      Filter by league code (e.g. eng01, ita01, cl01)
 *   --team <name>        Filter by single team name (e.g. "Liverpool", "Manchester City")
 *   --dry-run            Simulate extraction without writing JSON files
 *   --live               Write output directly to /public/data/rosters (default: /public/data/rosters10)
 *   --outDir <path>      Custom output directory for generated files
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

// ---------------------------------------------------------------------------
// 1. CLI ARGUMENT PARSING
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}
const hasFlag = (flag) => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
CM 01/02 1-10 SQUAD & FINANCIAL EXTRACTOR
Usage: node scripts/extractCMSquads10.js [options]

Options:
  --season <year>   Season year (e.g. 2001, 2002, 2004, 1995; default: 2001)
  --dataDir <path>  Path to folder containing extracted .dat files
  --zip <path>      Path to season zip file (e.g. F:/Igri/CM Data/2001.zip)
  --league <name>   Process only specific league (e.g. eng01)
  --team <name>     Process only specific team (e.g. "Liverpool")
  --dry-run         Preview output without writing files
  --live            Write directly to live /public/data/rosters
  --outDir <path>   Custom output directory
  --help            Show this help message
`);
  process.exit(0);
}

const targetSeason = getArg('--season', '2001');
const seasonShort = targetSeason.length === 4 ? targetSeason.slice(2) : targetSeason;
const seasonFullYear = targetSeason.length === 2 ? (parseInt(targetSeason, 10) >= 70 ? 1900 + parseInt(targetSeason, 10) : 2000 + parseInt(targetSeason, 10)) : parseInt(targetSeason, 10);
const targetLeague = getArg('--league', null);
const targetTeam = getArg('--team', null);
const isDryRun = hasFlag('--dry-run');
const isLive = hasFlag('--live');

const customOutDir = getArg('--outDir', null);
const OUTPUT_BASE_DIR = customOutDir
  ? path.resolve(customOutDir)
  : (isLive ? path.join(ROOT_DIR, 'public', 'data', 'rosters') : path.join(ROOT_DIR, 'public', 'data', 'rosters10'));

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
// 2. REALISTIC ERA FINANCIAL INFLATION MULTIPLIER (1990 - 2026)
// ---------------------------------------------------------------------------
/**
 * Scales budgets and weekly wages relative to the 2001/02 CM gold standard (1.00x).
 * Accurately models the exponential explosion in television rights & commercial revenue.
 */
function getEraFinancialMultiplier(year) {
  const y = parseInt(year, 10);
  if (y <= 1990) return 0.18;
  if (y <= 1993) return +(0.18 + (y - 1990) * 0.04).toFixed(3);  // 1990: 0.18x, 1993: 0.30x
  if (y <= 1997) return +(0.30 + (y - 1993) * 0.075).toFixed(3); // 1995: 0.45x, 1997: 0.60x
  if (y <= 2001) return +(0.60 + (y - 1997) * 0.10).toFixed(3);  // 2001: 1.00x (Baseline)
  if (y <= 2008) return +(1.00 + (y - 2001) * 0.17).toFixed(3);  // 2008: 2.19x
  if (y <= 2016) return +(2.19 + (y - 2008) * 0.23).toFixed(3);  // 2016: 4.03x
  if (y <= 2025) return +(4.03 + (y - 2016) * 0.25).toFixed(3);  // 2025: 6.28x
  return 6.5;
}

// ---------------------------------------------------------------------------
// 3. STATS, RATINGS (1-10) & VALUE CALIBRATION
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

/**
 * Maps 0-200 Championship Manager Current Ability (CA) to a granular 1-10 Rating
 */
function getRating10(currentAbility) {
  const ca = parseInt(currentAbility, 10) || 50;
  if (ca >= 170) return 10; // All-time peak legends / Ballon d'Or winners (Cantona, Henry, Owen, Ronaldo, Zidane)
  if (ca >= 155) return 9;  // World-class superstars (Bergkamp, Schmeichel, Adams, Shearer, Giggs, Beckham, Keane)
  if (ca >= 140) return 8;  // Elite top-flight stars / internationals (Seaman, Wright, Campbell, Fowler, Ince, Pallister)
  if (ca >= 125) return 7;  // Solid Premier League starters (Southall, Cottee, Dixon, Winterburn, Bould, Keown)
  if (ca >= 110) return 6;  // Mid Premier League / Top Championship starters (Watson, Hinchcliffe, Parlour)
  if (ca >= 95)  return 5;  // Lower Premier League squad / Championship regulars
  if (ca >= 80)  return 4;  // Solid Championship / League One starters
  if (ca >= 65)  return 3;  // League One / League Two regulars
  if (ca >= 50)  return 2;  // League Two / National League
  return 1;                // Youth trainees / semi-pro
}

/**
 * Calculates player transfer market value on a 1-10 rating scale with era inflation
 */
function calculatePlayerValue10(rating, age, seasonYear) {
  const r = parseInt(rating, 10) || 5;
  const a = parseInt(age, 10) || 25;

  let baseVal = 2.0;
  if (r === 10) baseVal = 45.0;
  else if (r === 9) baseVal = 30.0;
  else if (r === 8) baseVal = 18.0;
  else if (r === 7) baseVal = 10.0;
  else if (r === 6) baseVal = 5.5;
  else if (r === 5) baseVal = 3.0;
  else if (r === 4) baseVal = 1.5;
  else if (r === 3) baseVal = 0.8;
  else if (r === 2) baseVal = 0.4;
  else baseVal = 0.15;

  let ageMult = 1.0;
  if (a < 23) ageMult = 1.15;
  else if (a >= 29 && a <= 32) ageMult = 0.8;
  else if (a > 32) ageMult = 0.45;

  const eraMult = getEraFinancialMultiplier(seasonYear);
  return parseFloat((baseVal * ageMult * eraMult).toFixed(1));
}

function normalizeName(str) {
  if (!str) return "";
  return str
    .replace(/ø/gi, 'o')
    .replace(/æ/gi, 'ae')
    .replace(/å/gi, 'a')
    .replace(/ä/gi, 'ae')
    .replace(/ö/gi, 'oe')
    .replace(/ü/gi, 'ue')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
  sco: "scotland",
  ukr: "ukraine",
  cl: "europe_cl",
  uefa: "europe_el",
  uecl: "europe_uecl",
  clib: "south_america_clib",
  csud: "south_america_csud"
};

// ---------------------------------------------------------------------------
// 4. CM DATABASE BINARY LOADER (WITH CLUB FINANCES)
// ---------------------------------------------------------------------------
function loadCMDatabase(cmDir) {
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

  const NAT_REC_LEN = 290;
  function getNation(id) {
    if (!natBuf || id <= 0) return "Unknown";
    const off = id * NAT_REC_LEN;
    if (off + 4 + 52 > natBuf.length) return "Unknown";
    let end = off + 4;
    while (end < off + 4 + 52 && natBuf[end] !== 0) end++;
    return natBuf.toString('latin1', off + 4, end).trim() || "Unknown";
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

  // Read Clubs (581 bytes per record; includes finances at 101, 119, 123)
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

    // Authentic CM financial fields
    const rawCash = clubBuf.readInt32LE(off + 101);     // Bank balance / transfer cash (£)
    const rawAvgWage = clubBuf.readInt32LE(off + 119);   // Squad average wage (£/week)
    const rawWageCap = clubBuf.readInt32LE(off + 123);   // Top earner wage ceiling (£/week)

    const clubObj = {
      id,
      longName,
      shortName,
      normLong,
      normShort,
      stadiumId,
      rawCash: rawCash > 0 && rawCash < 300000000 ? rawCash : 0,
      rawAvgWage: rawAvgWage > 0 && rawAvgWage < 200000 ? rawAvgWage : 0,
      rawWageCap: rawWageCap > 0 && rawWageCap < 250000 ? rawWageCap : 0
    };
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

  console.log(`   ⚡ Loaded ${clubs.length} clubs with authentic finances, ${staffCount} staff, ${playerCount} players (${((Date.now() - t0) / 1000).toFixed(2)}s)`);

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
// 5. PLAYER DECODER WITH 1-10 RATINGS & INDIVIDUAL WAGES
// ---------------------------------------------------------------------------
function decodePlayer10(staffBuf, staffOffset, cmDb, seasonYear, clubIdOverride = null) {
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

  // 1 to 10 Star Rating from 0-200 CA
  const rating = getRating10(currentAbility);

  // Age Filtering
  const refYear = seasonYear > 2001 ? 2001 : seasonYear;
  const realAge = birthYear > 1900 ? (refYear - birthYear) : -1;
  if (realAge > 0 && realAge < 16) return null;
  if (birthYear <= 1900 && currentAbility < 50) return null;

  let age = realAge;
  if (isNaN(age) || age < 16 || age > 45) age = 25;

  const name = cmDb.readName(fnId, snId, cnId);

  // Transfer & Loan Status Decoding
  const ownClubId = clubIdOverride !== null ? clubIdOverride : staffBuf.readInt32LE(staffOffset + 0x39);
  const loanClubId = staffBuf.readInt32LE(staffOffset + 0x69);
  const isOnLoan = loanClubId > 0 && loanClubId !== ownClubId && loanClubId < 13000;
  const loanClubObj = isOnLoan ? cmDb.clubsById.get(loanClubId) : null;
  const loanClubName = loanClubObj ? loanClubObj.shortName : null;

  const eStatus = staffBuf.readUInt8(staffOffset + 0x5E);
  const fStatus = staffBuf.readUInt8(staffOffset + 0x5F);
  const isExplicitListed = eStatus === 2 || fStatus === 3;
  const isTransferListed = ownClubId <= 0 || isExplicitListed || isOnLoan;

  const playerVal = calculatePlayerValue10(rating, age, seasonYear);

  return {
    name,
    position: uniquePositions[0],
    positions: uniquePositions,
    rating, // 1 to 10
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
// 6. CLUB MATCHING ALGORITHM
// ---------------------------------------------------------------------------
const NAME_ALIASES = {
  "psv eindhoven": ["psv"],
  "psv": ["psv"],
  "nac breda": ["nac"],
  "nac": ["nac"],
  "nec nijmegen": ["nec"],
  "nec": ["nec"],
  "az alkmaar": ["az"],
  "az": ["az"],
  "roda jc": ["roda jc", "roda"],
  "olympiacos": ["olympiakos", "olympiakos piraeus"],
  "panathinaikos": ["panathinaikos athens", "panathinaikos"],
  "dinamo zagreb": ["nk dinamo", "dinamo", "nk dinamo zagreb", "croatia zagreb"],
  "krylya sovetov": ["krylja sovetov samara", "krylja sovetov"],
  "fc rostov": ["rostselmash", "rostov"],
  "dynamo moscow": ["dinamo moscow", "dynamo moscow"],
  "dynamo kiev": ["dinamo kiev", "dynamo kiev"],
  "zenit st. petersburg": ["zenith st petersburg", "zenit st petersburg", "zenith"],
  "celtic": ["glasgow celtic", "celtic"],
  "rangers": ["glasgow rangers", "rangers"],
  "red star belgrade": ["crvena zvezda", "red star"],
  "cologne": ["1 fc koln", "1 fc koeln", "fc koln", "cologne"],
  "fc cologne": ["1 fc koln", "1 fc koeln", "fc koln", "cologne"],
  "freiburg": ["sc freiburg", "freiburg"],
  "borussia dortmund": ["bv borussia dortmund", "dortmund"],
  "dortmund": ["bv borussia dortmund", "dortmund"],
  "bayern munich": ["fc bayern munchen", "bayern munchen", "fc bayern"],
  "bayer leverkusen": ["bayer 04 leverkusen", "leverkusen"],
  "stuttgart": ["vfb stuttgart", "stuttgart"],
  "nuremberg": ["1 fc nurnberg", "1 fc nuernberg", "nurnberg"],
  "borussia monchengladbach": ["borussia m gladbach", "m gladbach", "monchengladbach"],
  "1860 munich": ["tsv 1860 munchen", "1860 munchen"],
  "internazionale": ["inter", "internazionale milano", "inter milan"],
  "inter milan": ["inter", "internazionale", "internazionale milano"],
  "ac milan": ["milan", "ac milan"],
  "milan": ["milan", "ac milan"],
  "roma": ["as roma", "roma"],
  "lazio": ["ss lazio", "lazio"],
  "atletico madrid": ["atletico de madrid", "atletico madrid", "atletico"],
  "athletic bilbao": ["athletic club bilbao", "athletic club", "athletic bilbao"],
  "real betis": ["betis", "real betis balompie"],
  "sporting gijon": ["sporting de gijon", "sporting gijon"],
  "marseille": ["olympique de marseille", "marseille"],
  "lyon": ["olympique lyonnais", "lyon"],
  "paris saint germain": ["paris saint germain", "psg", "paris sg"],
  "psg": ["paris saint germain", "psg", "paris sg"],
  "sporting cp": ["sporting clube de portugal", "sporting cp", "sporting lisbon"],
  "porto": ["fc porto", "porto"],
  "benfica": ["sl benfica", "benfica"],
  "boca juniors": ["boca", "boca juniors", "ca boca juniors"],
  "river plate": ["river", "river plate", "ca river plate"],
  "flamengo": ["cr flamengo", "flamengo"],
  "corinthians": ["sc corinthians paulista", "corinthians"],
  "sao paulo": ["sao paulo fc", "sao paulo"],
  "palmeiras": ["se palmeiras", "palmeiras"],
  "santos": ["santos fc", "santos"]
};

function findBestMatchingClub(teamName, cmClubs, playersByClubId) {
  const normTarget = normalizeName(teamName);

  // Exact Match
  for (const club of cmClubs) {
    if (club.normLong === normTarget || club.normShort === normTarget) {
      return club;
    }
  }

  // Aliases
  const aliases = NAME_ALIASES[normTarget] || [];
  for (const alias of aliases) {
    const normAlias = normalizeName(alias);
    for (const club of cmClubs) {
      if (club.normLong === normAlias || club.normShort === normAlias) {
        return club;
      }
    }
  }

  // Substring inclusion
  let bestCandidate = null;
  let maxPlayers = -1;

  for (const club of cmClubs) {
    const match = club.normLong.includes(normTarget) || normTarget.includes(club.normLong) ||
                  club.normShort.includes(normTarget) || normTarget.includes(club.normShort);
    if (match) {
      const pCount = (playersByClubId.get(club.id) || []).length;
      if (pCount > maxPlayers) {
        maxPlayers = pCount;
        bestCandidate = club;
      }
    }
  }

  return bestCandidate;
}

// ---------------------------------------------------------------------------
// 7. SQUAD SYNTHESIZER & 22-MAN ROSTER BALANCER (1-10 SCALE)
// ---------------------------------------------------------------------------
function synthesizeSquadFiller10(existingPlayers, team, seasonYear, region = "") {
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
  const isItalian = region === 'italy' || /perugia|juventus|milan|inter|roma|lazio|napoli|palermo|sampdoria/i.test(team.name);

  const firstNames = isItalian ? [
    "Alessandro", "Gianluigi", "Marco", "Francesco", "Andrea", "Matteo", "Lorenzo", "Roberto", "Simone", "Luca",
    "Fabio", "Daniele", "Federico", "Gabriele", "Filippo", "Davide", "Christian", "Massimo", "Stefano", "Giorgio"
  ] : (isHispanic ? [
    "Carlos", "Diego", "Andrés", "Juan", "David", "Alejandro", "Santiago", "Mateo", "Cristian", "Sebastián",
    "Felipe", "Camilo", "Daniel", "Oscar", "Julián", "Fabio", "Hernán", "Javier", "Nelson", "Ricardo"
  ] : [
    "Luka", "Marko", "Ivan", "David", "Matej", "Filip", "Jan", "Milan", "Stefan", "Nikola",
    "Alex", "Thomas", "Daniel", "Martin", "Andreas", "Michael", "Lucas", "Paul", "Erik", "Simon"
  ]);

  const lastNames = isItalian ? [
    "Rossi", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno",
    "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana"
  ] : (isHispanic ? [
    "Zapata", "Moreno", "Córdoba", "Murillo", "Ospina", "Bedoya", "Rentería", "Palacios", "Mosquera", "Valencia",
    "Rodríguez", "González", "López", "Gómez", "Martínez", "García", "Pérez", "Sánchez", "Ramírez", "Díaz"
  ] : [
    "Kovacic", "Modric", "Petrovic", "Horvat", "Novak", "Kovacevic", "Babic", "Maric", "Juric", "Simic",
    "Schmidt", "Muller", "Weber", "Fischer", "Schneider", "Hansen", "Johansson", "Larsson", "Nielsen", "Jensen"
  ]);

  let fillerIdx = 0;
  while (squad.length < 22) {
    const pos = remainingNeeded.shift() || 'MC';
    const dept = getGeneralPosition(pos);
    let baseRating5 = 3;
    if (dept === 'FW') baseRating5 = team.attack || 3;
    else if (dept === 'MF') baseRating5 = team.midfield || 3;
    else if (dept === 'DF' || dept === 'GK') baseRating5 = team.defense || 3;

    // Convert team 1-5 rating to 1-10 baseline: rating5 * 2
    const baseRating10 = baseRating5 * 2;
    const ratingVariance = (fillerIdx % 3 === 0) ? 1 : ((fillerIdx % 4 === 0) ? -1 : 0);
    const rating = Math.max(1, Math.min(10, Math.round(baseRating10 + ratingVariance)));
    const age = 19 + ((fillerIdx * 7) % 15);
    const fn = firstNames[fillerIdx % firstNames.length];
    const ln = lastNames[(Math.floor(fillerIdx / firstNames.length) + fillerIdx * 3) % lastNames.length];
    const pName = `${fn} ${ln}`;

    squad.push({
      name: pName,
      position: pos,
      positions: [pos],
      rating, // 1 to 10
      age,
      currentAbility: rating * 18,
      squadNumber: squad.length + 1,
      value: calculatePlayerValue10(rating, age, seasonYear),
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

function selectBalancedSquad10(players) {
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

  if (squad.length < 22) {
    for (const p of players) {
      addPlayer(p);
      if (squad.length >= 22) break;
    }
  }

  return squad.slice(0, 22);
}

// ---------------------------------------------------------------------------
// 8. MAIN EXECUTION PIPELINE
// ---------------------------------------------------------------------------
async function main() {
  console.log("==================================================================");
  console.log("⚽ CM 01/02 FULL EXTRACTOR - 1 TO 10 RATINGS & ERA FINANCES");
  console.log("==================================================================");
  console.log(`• Season Target:       ${targetSeason} (year: ${seasonFullYear})`);
  console.log(`• Era Inflation:       ${getEraFinancialMultiplier(seasonFullYear)}x (relative to 2001)`);
  console.log(`• CM Data Directory:   ${cmDataDir}`);
  console.log(`• Output Directory:    ${OUTPUT_BASE_DIR}`);
  console.log(`• Dry Run Mode:        ${isDryRun ? "YES" : "NO"}`);
  if (targetLeague) console.log(`• Filter League:       ${targetLeague}`);
  if (targetTeam) console.log(`• Filter Team:         ${targetTeam}`);
  console.log("==================================================================\n");

  const startTime = Date.now();
  const cmDb = loadCMDatabase(cmDataDir);
  const STAFF_REC_LEN = cmDb.staffRecLen;
  const eraMult = getEraFinancialMultiplier(seasonFullYear);

  // 1. Group Managers by Club ID
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
      const refYear = seasonFullYear > 2001 ? 2001 : seasonFullYear;
      let age = birthYear > 1900 ? (refYear - birthYear) : 52;
      if (isNaN(age) || age < 25 || age > 85) age = 52;
      const natId = cmDb.staffBuf.readInt32LE(off + 0x1A);
      const nationality = cmDb.getNation(natId);
      managersByClubId.set(clubId, { name, age, nationality });
    }
  }
  console.log(`   ⚡ Found ${managersByClubId.size} authentic club managers.`);

  // 2. Group active players by club & collect transfer market pool
  console.log("⏳ Grouping CM players by club (1-10 scale) & building transfer pool...");
  const playersByClubId = new Map();
  const transferMarketPool = [];

  for (let i = 0; i < cmDb.staffCount; i++) {
    const off = i * STAFF_REC_LEN;
    const clubId = cmDb.staffBuf.readInt32LE(off + 0x39);
    const job = cmDb.staffBuf.readUInt8(off + 0x3D);

    if (job === 11 || job === 12) {
      if (clubId > 0) {
        const p = decodePlayer10(cmDb.staffBuf, off, cmDb, seasonFullYear, clubId);
        if (p) {
          if (!playersByClubId.has(clubId)) playersByClubId.set(clubId, []);
          playersByClubId.get(clubId).push(p);

          if ((p.transferListed || p.loanListed) && p.currentAbility >= 100) {
            const owningClub = cmDb.clubsById.get(clubId);
            transferMarketPool.push({
              name: p.name,
              position: p.position,
              positions: p.positions,
              rating: p.rating, // 1 to 10
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
        const p = decodePlayer10(cmDb.staffBuf, off, cmDb, seasonFullYear, -1);
        if (p && p.currentAbility >= 95) {
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
  console.log(`   ⚡ Extracted ${finalTransferPool.length} elite transfer market targets.`);

  // 3. Scan Competitions
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
        isSyntheticClub = true;
        matchedClub = {
          id: -totalTeamsProcessed,
          longName: team.name,
          shortName: team.name,
          stadiumId: -1,
          rawCash: 0,
          rawAvgWage: 0,
          rawWageCap: 0
        };
      }

      // Stadium metadata
      let stadium = !isSyntheticClub ? cmDb.getStadium(matchedClub.stadiumId) : null;
      if (!stadium) {
        stadium = { name: `${team.name} Stadium`, capacity: 18000, seating: 12000 };
      }

      // Manager metadata
      let manager = (!isSyntheticClub && managersByClubId.get(matchedClub.id)) || null;
      if (!manager || manager.name === "Unknown Manager") {
        manager = { name: "Unknown Manager", age: 50, nationality: "Unknown" };
      }

      // Realistic Scaled Finances
      const baseCash = (matchedClub.rawCash && matchedClub.rawCash > 0)
        ? matchedClub.rawCash
        : Math.round(((team.attack || 3) + (team.midfield || 3) + (team.defense || 3)) * 1200000);

      const baseWageCap = (matchedClub.rawWageCap && matchedClub.rawWageCap > 0)
        ? matchedClub.rawWageCap
        : Math.round(((team.attack || 3) + (team.midfield || 3) + (team.defense || 3)) * 4500);

      const baseAvgWage = (matchedClub.rawAvgWage && matchedClub.rawAvgWage > 0)
        ? matchedClub.rawAvgWage
        : Math.round(baseWageCap * 0.45);

      const budgetM = parseFloat(((baseCash * eraMult) / 1000000).toFixed(1));
      const wageCapW = Math.round(baseWageCap * eraMult);
      const avgWageW = Math.round(baseAvgWage * eraMult);
      const weeklyPayroll = Math.round(avgWageW * 22);

      teamDetailsMap[team.name] = {
        manager,
        stadium,
        finances: {
          transferBudget: Math.max(0.2, budgetM),         // Budget in Millions (£M)
          weeklyWageCap: Math.max(500, wageCapW),         // Ceiling for single star in £/wk
          averageWeeklyWage: Math.max(250, avgWageW),     // Average player wage in £/wk
          estimatedWeeklyPayroll: Math.max(5500, weeklyPayroll), // Total weekly payroll (£/wk)
          currency: "GBP"
        }
      };

      // Squad extraction & individual player wage allocation
      const rawRoster = playersByClubId.get(matchedClub.id) || [];
      let squadToBalance = rawRoster;
      if (rawRoster.length < 11) {
        squadToBalance = synthesizeSquadFiller10(rawRoster, team, seasonFullYear, region);
      }

      const balancedSquad = selectBalancedSquad10(squadToBalance);

      // Assign authentic player wage based on skill rating within the club's wage cap
      balancedSquad.forEach(player => {
        const r = player.rating || 5;
        let wageShare = 0.45;
        if (r >= 10) wageShare = 0.95;
        else if (r === 9) wageShare = 0.85;
        else if (r === 8) wageShare = 0.70;
        else if (r === 7) wageShare = 0.55;
        else if (r === 6) wageShare = 0.45;
        else if (r === 5) wageShare = 0.35;
        else if (r === 4) wageShare = 0.25;
        else wageShare = 0.15;

        player.wage = Math.max(250, Math.round(wageCapW * wageShare));
      });

      if (!isDryRun) {
        const outDir = path.join(OUTPUT_BASE_DIR, String(seasonFullYear), region);
        fs.mkdirSync(outDir, { recursive: true });
        const outFile = path.join(outDir, `${sanitizeFilename(team.name)}.json`);
        fs.writeFileSync(outFile, JSON.stringify(balancedSquad, null, 2), 'utf8');
        consolidatedMap[team.name] = balancedSquad;
      }

      totalSaved++;
      console.log(`   ✅ [${team.name.padEnd(22)}] -> Budget: £${budgetM}M | WageCap: £${wageCapW.toLocaleString()}/wk | AvgWage: £${avgWageW.toLocaleString()}/wk`);
    }
    console.log("");
  }

  // 4. Save Consolidated Indexes & Transfer Market (Smart Merge with existing teams)
  if (!isDryRun && Object.keys(consolidatedMap).length > 0) {
    fs.mkdirSync(OUTPUT_BASE_DIR, { recursive: true });
    const consolidatedPath = path.join(OUTPUT_BASE_DIR, `rosters${seasonFullYear}.json`);
    let finalConsolidated = consolidatedMap;
    if (fs.existsSync(consolidatedPath)) {
      try {
        const existingRosters = JSON.parse(fs.readFileSync(consolidatedPath, 'utf8'));
        finalConsolidated = { ...existingRosters, ...consolidatedMap };
      } catch (e) {}
    }
    fs.writeFileSync(consolidatedPath, JSON.stringify(finalConsolidated, null, 2), 'utf8');
    console.log(`📦 Consolidated squads saved: ${path.relative(ROOT_DIR, consolidatedPath)} (${Object.keys(finalConsolidated).length} clubs total)`);

    const detailsPath = path.join(OUTPUT_BASE_DIR, `teamDetails${seasonFullYear}.json`);
    let finalDetails = teamDetailsMap;
    if (fs.existsSync(detailsPath)) {
      try {
        const existingDetails = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
        finalDetails = { ...existingDetails, ...teamDetailsMap };
      } catch (e) {}
    }
    fs.writeFileSync(detailsPath, JSON.stringify(finalDetails, null, 2), 'utf8');
    console.log(`📦 Team metadata & finances saved: ${path.relative(ROOT_DIR, detailsPath)} (${Object.keys(finalDetails).length} clubs total)`);

    const transferPath = path.join(OUTPUT_BASE_DIR, `transferMarket${seasonFullYear}.json`);
    fs.writeFileSync(transferPath, JSON.stringify(finalTransferPool, null, 2), 'utf8');
    console.log(`📦 Transfer market pool saved: ${path.relative(ROOT_DIR, transferPath)} (${finalTransferPool.length} players)`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("==================================================================");
  console.log("🏁 EXTRACTION COMPLETE!");
  console.log("==================================================================");
  console.log(`• Teams Processed:  ${totalTeamsProcessed}`);
  console.log(`• Squads Extracted: ${totalSaved}`);
  console.log(`• Total Time:       ${durationSec}s`);
  console.log(`• Output Location:  ${OUTPUT_BASE_DIR}`);
  console.log("==================================================================\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
