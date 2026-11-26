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
const CONCACAF_DIR = path.join(ROOT_DIR, 'src', 'data', 'concacaf');

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

  const findDatDir = (dir, depth = 3) => {
    if (fs.existsSync(path.join(dir, 'staff.dat')) && fs.existsSync(path.join(dir, 'club.dat'))) {
      return dir;
    }
    if (depth <= 0) return null;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const found = findDatDir(path.join(dir, entry.name), depth - 1);
        if (found) return found;
      }
    }
    return null;
  };
  cmDataDir = findDatDir(extractDest, 3);
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
  if (ca >= 95) return 5;  // Lower Premier League squad / Championship regulars
  if (ca >= 80) return 4;  // Solid Championship / League One starters
  if (ca >= 65) return 3;  // League One / League Two regulars
  if (ca >= 50) return 2;  // League Two / National League
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
  bel: "belgium",
  swe: "sweden",
  den: "denmark",
  mex: "mexico",
  usa: "usa",
  cl: "europe_cl",
  uefa: "europe_el",
  uecl: "europe_uecl",
  clib: "south_america_clib",
  csud: "south_america_csud",
  concacaf: "north_america_concacaf"
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
  const NON_PLAYER_REC_LEN = 68;
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

  const nonPlayerBlockOffset = staffBlockBytes;
  const nonPlayerCount = Math.max(0, Math.floor((playerBlockOffset - nonPlayerBlockOffset) / NON_PLAYER_REC_LEN));
  const nonPlayerPtrOffset = (STAFF_REC_LEN === 157) ? 0x99 : 0x69;

  const CM_FORMATION_ENUM = {
    1: '5-3-2',     // 5-3-2 Sweeper
    2: '5-3-2',     // 5-3-2
    3: '4-4-2',     // 4-4-2
    4: '4-3-3',     // 4-3-3
    5: '4-2-4',     // 4-2-4
    6: '3-5-2',     // 3-5-2
    7: '4-1-2-1-2', // 4-1-2-1-2
    8: '4-5-1',     // 4-5-1
    9: '3-4-3'      // 3-4-3
  };

  console.log(`   ⚡ Loaded ${clubs.length} clubs with authentic finances, ${staffCount} staff, ${nonPlayerCount} non-players, ${playerCount} players (${((Date.now() - t0) / 1000).toFixed(2)}s)`);

  return {
    clubs,
    clubsById,
    staffBuf,
    staffCount,
    staffRecLen: STAFF_REC_LEN,
    playerPtrOffset: (STAFF_REC_LEN === 157) ? 0x91 : 0x61,
    nonPlayerPtrOffset,
    nonPlayerBlockOffset,
    nonPlayerCount,
    playerBlockOffset,
    playerCount,
    getNation,
    getStadium,
    getNonPlayerFormation(staffOffset) {
      if (staffOffset + nonPlayerPtrOffset + 4 > staffBuf.length) return null;
      const npPtr = staffBuf.readInt32LE(staffOffset + nonPlayerPtrOffset);
      if (npPtr < 0 || npPtr >= nonPlayerCount) return null;
      const npOff = nonPlayerBlockOffset + npPtr * NON_PLAYER_REC_LEN;
      if (npOff + 68 > staffBuf.length) return null;
      const formByte = staffBuf.readUInt8(npOff + 67);
      return CM_FORMATION_ENUM[formByte] || null;
    },
    readName(fnId, snId, cnId) {
      const common = readStringTable(cnBuf, cnId);
      if (common) return common;
      const fn = readStringTable(fnBuf, fnId);
      const sn = readStringTable(snBuf, snId);
      return `${fn} ${sn}`.trim() || "Unknown Player";
    },
    readFullName(fnId, snId) {
      const fn = readStringTable(fnBuf, fnId);
      const sn = readStringTable(snBuf, snId);
      return `${fn} ${sn}`.trim();
    }
  };
}

/**
 * Curated historical formation overrides for clubs/managers where CM01/02's 9-formation
 * enum could not distinguish sub-formations (e.g. 4-2-3-1, 3-4-2-1, 4-3-1-2, 4-3-2-1)
 * or where SI's original database had a known formation typo (e.g. Hitzfeld's 4-2-4 code).
 */
function resolveHistoricalFormationOverride(teamName, managerName, seasonYear) {
  const yr = parseInt(seasonYear, 10) || 2001;
  const t = String(teamName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const m = String(managerName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Fix SI DB typo for Ottmar Hitzfeld (byte 5 = 4-2-4 instead of 3-5-2 / 5-3-2)
  if (m.includes('hitzfeld')) {
    return yr <= 1997 ? '3-5-2' : '5-3-2';
  }
  if ((t.includes('dortmund')) && yr >= 1991 && yr <= 1997) return '3-5-2';

  // 2. Liverpool historical eras
  if (t === 'liverpool') {
    if (yr >= 2005 && yr <= 2009) return '4-2-3-1'; // Rafa Benítez
    if (yr >= 2016 && yr <= 2023) return '4-3-3';   // Jürgen Klopp
    if (yr >= 2024) return '4-2-3-1';               // Arne Slot
  }

  // 3. Manchester United
  if (t.includes('manchester united') || t === 'man utd') {
    if (yr >= 1989 && yr <= 2006) return '4-4-2';   // Sir Alex Ferguson classic 4-4-2
    if (yr >= 2014 && yr <= 2024) return '4-2-3-1'; // van Gaal / Mourinho / Solskjaer / ten Hag
    if (yr >= 2025 || m.includes('amorim')) return '3-4-2-1'; // Rúben Amorim
  }

  // 4. Manchester City
  if (t.includes('manchester city') || t === 'man city') {
    if (yr >= 2011 && yr <= 2015) return '4-2-3-1'; // Mancini / Pellegrini
    if (yr >= 2016) return '4-3-3';                 // Pep Guardiola
  }

  // 5. Arsenal
  if (t === 'arsenal') {
    if (yr >= 1989 && yr <= 2005) return '4-4-2';   // George Graham / Wenger Invincibles 4-4-2
    if (yr >= 2009 && yr <= 2016) return '4-2-3-1'; // Wenger 4-2-3-1 era
    if (yr === 2020) return '3-4-3';                // Arteta 2020 FA Cup 3-4-3
    if (yr >= 2021 && yr <= 2022) return '4-2-3-1'; // Arteta transition 4-2-3-1
    if (yr >= 2023) return '4-3-3';                 // Arteta modern 4-3-3
  }

  // 6. Chelsea
  if (t === 'chelsea') {
    if (yr >= 2004 && yr <= 2007) return '4-3-3';   // Mourinho 1st spell
    if (yr === 2009) return '4-1-2-1-2';            // Ancelotti Diamond
    if (yr >= 2011 && yr <= 2015) return '4-2-3-1'; // Di Matteo / Mourinho 2nd spell
    if (yr >= 2016 && yr <= 2017) return '3-4-3';   // Antonio Conte title-winning 3-4-3
    if (yr >= 2020 && yr <= 2022) return '3-4-2-1'; // Thomas Tuchel CL-winning 3-4-2-1
    if (yr >= 2023) return '4-2-3-1';               // Pochettino / Maresca
  }

  // 7. Tottenham Hotspur
  if (t.includes('tottenham')) {
    if (yr >= 2014 && yr <= 2020) return '4-2-3-1'; // Pochettino / Mourinho
    if (yr >= 2021 && yr <= 2022) return '3-4-3';   // Conte
    if (yr >= 2023) return '4-2-3-1';               // Postecoglou
  }

  // 8. AC Milan
  if (t.includes('milan') && !t.includes('inter')) {
    if (yr >= 1989 && yr <= 1995) return '4-4-2';   // Sacchi / Capello 4-4-2
    if (yr >= 2002 && yr <= 2006) return '4-3-1-2'; // Ancelotti Rui Costa / Kaká diamond
    if (yr >= 2007 && yr <= 2008) return '4-3-2-1'; // Ancelotti Christmas Tree (Kaká + Seedorf behind Inzaghi)
    if (yr >= 2010 && yr <= 2012) return '4-3-1-2'; // Allegri Scudetto
    if (yr >= 2020 && yr <= 2024) return '4-2-3-1'; // Pioli Scudetto 4-2-3-1
  }

  // 9. Inter Milan
  if (t === 'inter' || t === 'inter milan' || t === 'internazionale') {
    if (yr >= 2006 && yr <= 2008) return '4-3-1-2'; // Mancini
    if (yr === 2009) return '4-2-3-1';              // Mourinho Treble 2009/10
    if (yr >= 2019) return '3-5-2';                 // Conte / Simone Inzaghi
  }

  // 10. Juventus
  if (t.includes('juventus')) {
    if (yr >= 1996 && yr <= 1998) return '4-3-1-2'; // Lippi (Zidane behind Del Piero & Inzaghi/Boksic)
    if (yr >= 2001 && yr <= 2003) return '4-3-1-2'; // Lippi (Nedved behind Del Piero & Trezeguet)
    if (yr >= 2011 && yr <= 2014) return '3-5-2';   // Conte BBC 3-5-2
    if (yr >= 2016 && yr <= 2017) return '4-2-3-1'; // Allegri Mandzukic-Dybala-Cuadrado-Higuain
  }

  // 11. Roma & Napoli & Atalanta
  if ((t === 'roma' || t === 'as roma') && yr >= 2005 && yr <= 2008) return '4-2-3-1'; // Spalletti Totti false 9
  if (t.includes('atalanta') && yr >= 2017) return '3-4-1-2'; // Gasperini
  if (t.includes('napoli') && yr >= 2015 && yr <= 2018) return '4-3-3'; // Sarri

  // 12. Real Madrid & Barcelona
  if (t.includes('real madrid')) {
    if (yr >= 2000 && yr <= 2002) return '4-2-3-1'; // Del Bosque
    if (yr >= 2010 && yr <= 2013) return '4-2-3-1'; // José Mourinho
    if (yr >= 2014 && yr <= 2022) return '4-3-3';   // Ancelotti / Zidane BBC 4-3-3
    if (yr === 2023) return '4-3-1-2';              // Ancelotti Bellingham diamond
    if (yr >= 2024) return '4-3-3';
  }
  if (t.includes('barcelona') && !t.includes('sc') && !t.includes('guayaquil')) {
    if (yr >= 1989 && yr <= 1996) return '4-3-3';   // Cruyff Dream Team
    if (yr >= 2004 && yr <= 2023) return '4-3-3';   // Rijkaard / Guardiola / Luis Enrique / Xavi
    if (yr >= 2024) return '4-2-3-1';               // Hansi Flick 4-2-3-1
  }

  // 13. Bayern Munich, Borussia Dortmund & Bayer Leverkusen
  if (t.includes('bayern')) {
    if (yr >= 1989 && yr <= 1998) return '5-3-2';   // German Libero era
    if (yr >= 2010 && yr <= 2012) return '4-2-3-1'; // van Gaal / Heynckes Treble
    if (yr >= 2013 && yr <= 2015) return '4-1-4-1'; // Guardiola Bayern
    if (yr >= 2016) return '4-2-3-1';               // Heynckes / Flick Sextuple / Nagelsmann / Tuchel / Kompany
  }
  if (t.includes('dortmund')) {
    if (yr >= 2010 && yr <= 2016) return '4-2-3-1'; // Klopp & Tuchel 4-2-3-1
    if (yr >= 2018 && yr <= 2019) return '4-2-3-1'; // Favre
  }
  if (t.includes('leverkusen')) {
    if (yr >= 2001 && yr <= 2002) return '4-1-4-1'; // Toppmöller 2002 CL finalists
    if (yr >= 2022) return '3-4-2-1';               // Xabi Alonso invincible 3-4-2-1
  }

  // 14. Manager-based signature overrides across clubs
  if (m.includes('amorim')) return '3-4-2-1';
  if (m.includes('gasperini') && yr >= 2016) return '3-4-1-2';
  if (m.includes('xabi alonso') && t.includes('leverkusen')) return '3-4-2-1';

  return null;
}

function getDefaultEraRegionFormation(region, seasonYear) {
  const yr = parseInt(seasonYear, 10) || 2001;
  const r = String(region || '').toLowerCase();
  if (r.includes('netherlands')) return '4-3-3';
  if (r.includes('germany') && yr <= 1998) return '5-3-2';
  if (r.includes('italy') && yr <= 1996) return '4-4-2';
  if ((r.includes('argentina') || r.includes('brazil') || r.includes('colombia') || r.includes('south_america')) && yr <= 2004) {
    return '4-3-1-2';
  }
  if (yr >= 2012) return '4-2-3-1';
  return '4-4-2';
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

  // Extract 9 core 1-10 player skills from CM 01/02 70-byte player record (pOffset + 27 + attrIdx)
  // CM stores 1-20 values (or 0 if random/unset in editor). Convert 1-20 -> 1-10, fallback to position-adjusted rating.
  const primaryPos = uniquePositions[0] || "MC";
  const dept = getGeneralPosition(primaryPos);
  const scaleCM20To10 = (rawVal, fallback10) => {
    if (rawVal >= 1 && rawVal <= 20) {
      return Math.max(1, Math.min(10, Math.round(rawVal / 2)));
    }
    return Math.max(1, Math.min(10, Math.round(fallback10)));
  };

  const rawCrossing  = staffBuf.readUInt8(pOffset + 27 + 8);
  const rawDribbling = staffBuf.readUInt8(pOffset + 27 + 11);
  const rawFinishing = staffBuf.readUInt8(pOffset + 27 + 12);
  const rawHandling  = staffBuf.readUInt8(pOffset + 27 + 15);
  const rawHeading   = staffBuf.readUInt8(pOffset + 27 + 16);
  const rawLongShots = staffBuf.readUInt8(pOffset + 27 + 22);
  const rawMarking   = staffBuf.readUInt8(pOffset + 27 + 23);
  const rawPassing   = staffBuf.readUInt8(pOffset + 27 + 28);
  const rawTackling  = staffBuf.readUInt8(pOffset + 27 + 35);

  const isWide = ['ML', 'MR', 'AML', 'AMR', 'DL', 'DR', 'LW', 'RW'].includes(primaryPos);
  const skills = {
    passing:   scaleCM20To10(rawPassing,   dept === 'MF' ? rating : (dept === 'GK' ? Math.max(2, rating - 3) : Math.max(3, rating - 1))),
    marking:   scaleCM20To10(rawMarking,   dept === 'DF' ? rating : (primaryPos === 'DMC' ? rating : (dept === 'MF' ? Math.max(3, rating - 2) : Math.max(1, rating - 4)))),
    tackling:  scaleCM20To10(rawTackling,  dept === 'DF' ? rating : (primaryPos === 'DMC' ? rating : (dept === 'MF' ? Math.max(3, rating - 1) : Math.max(1, rating - 4)))),
    dribbling: scaleCM20To10(rawDribbling, (dept === 'FW' || isWide || primaryPos === 'AMC') ? rating : (dept === 'MF' ? Math.max(3, rating - 1) : Math.max(2, rating - 3))),
    crossing:  scaleCM20To10(rawCrossing,  isWide ? rating : (dept === 'MF' || dept === 'FW' ? Math.max(3, rating - 2) : Math.max(2, rating - 3))),
    heading:   scaleCM20To10(rawHeading,   (primaryPos === 'DC' || primaryPos === 'ST' || primaryPos === 'CF') ? rating : Math.max(3, rating - 2)),
    finishing: scaleCM20To10(rawFinishing, dept === 'FW' ? rating : (primaryPos === 'AMC' ? Math.max(4, rating - 1) : (dept === 'MF' ? Math.max(3, rating - 2) : Math.max(1, rating - 4)))),
    longShots: scaleCM20To10(rawLongShots, (primaryPos === 'AMC' || primaryPos === 'MC' || dept === 'FW') ? Math.max(4, rating - 1) : Math.max(2, rating - 3)),
    handling:  scaleCM20To10(rawHandling,  dept === 'GK' ? rating : 1)
  };

  const rawLeftFoot  = staffBuf.readUInt8(pOffset + 27 + 21);
  const rawRightFoot = staffBuf.readUInt8(pOffset + 27 + 32);
  let foot;
  if (rawLeftFoot > 0 || rawRightFoot > 0) {
    if (rawLeftFoot >= 15 && rawRightFoot >= 15) foot = 'Either';
    else if (rawLeftFoot >= 15 && rawRightFoot < 15) foot = 'Left';
    else if (rawRightFoot >= 15 && rawLeftFoot < 15) foot = 'Right';
    else if (rawLeftFoot > rawRightFoot) foot = 'Left';
    else if (rawRightFoot > rawLeftFoot) foot = 'Right';
  }

  // Age Filtering
  const refYear = seasonYear > 2001 ? 2001 : seasonYear;
  const realAge = birthYear > 1900 ? (refYear - birthYear) : -1;
  if (realAge > 0 && realAge < 16) return null;
  if (birthYear <= 1900 && currentAbility < 50) return null;

  let age = realAge;
  if (isNaN(age) || age < 16 || age > 45) age = 25;

  const name = cmDb.readName(fnId, snId, cnId);
  const rawFull = cmDb.readFullName(fnId, snId);
  const fullName = (rawFull && rawFull !== name) ? rawFull : undefined;
  const natId = staffBuf.readInt32LE(staffOffset + 0x1A);
  const nationalityRaw = cmDb.getNation(natId);
  const nationality = (nationalityRaw && nationalityRaw !== 'Unknown') ? nationalityRaw : undefined;

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
    ...(fullName ? { fullName } : {}),
    position: uniquePositions[0],
    positions: uniquePositions,
    rating, // 1 to 10
    skills,
    age,
    ...(nationality ? { nationality } : {}),
    ...(foot ? { foot } : {}),
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
  "sparta rotterdam": ["sparta rotterdam", "sparta"],

  // Greece & Eastern Europe
  "olympiacos": ["olympiakos", "olympiakos piraeus"],
  "olympiacos piraeus": ["olympiakos piraeus", "olympiakos"],
  "panathinaikos": ["panathinaikos athens", "panathinaikos"],
  "aek athens": ["aek", "aek athens"],
  "paok": ["paok salonika", "paok"],
  "dinamo zagreb": ["nk dinamo", "dinamo", "nk dinamo zagreb", "dinamo zagreb", "croatia zagreb", "nk croatia"],
  "artmedia bratislava": ["fc artmedia bratislava", "artmedia bratislava", "artmedia petrzalka", "artmedia"],
  "slovan bratislava": ["sk slovan bratislava", "slovan bratislava"],
  "rapid bucuresti": ["fc rapid bucuresti", "rapid bucuresti", "rapid bucharest", "rapid"],
  "dinamo bucuresti": ["fc dinamo bucuresti", "dinamo bucuresti", "dinamo bucharest"],
  "maccabi petah tikva": ["maccabi petah tikva", "maccabi petach tikva", "m petah tikva"],

  // Russia & Ukraine
  "krylya sovetov": ["krylja sovetov samara", "krylja sovetov", "krylya sovetov"],
  "krylia sovetov": ["krylja sovetov samara", "krylja sovetov", "krylya sovetov"],
  "fc rostov": ["rostselmash", "rostselmash rostov na donu", "rostov"],
  "fc moscow": ["fc moscow", "fk moskva", "moskva"],
  "saturn moscow region": ["saturn moscow region", "saturn ramenskoe", "saturn ren tv", "saturn"],
  "dynamo moscow": ["dinamo moscow", "dynamo moscow"],
  "dynamo kiev": ["dinamo kiev", "dynamo kiev"],
  "dynamo kyiv": ["dinamo kiev", "dynamo kiev"],
  "zenit st petersburg": ["zenith st petersburg", "zenit st petersburg", "zenith"],
  "zenit saint petersburg": ["zenith st petersburg", "zenit st petersburg", "zenith"],
  "shakhtar donetsk": ["shakhtar", "shakhtar donetsk"],
  "cska moscow": ["cska moscow", "cska"],
  "lokomotiv moscow": ["lokomotiv moscow", "lokomotiv"],
  "torpedo moscow": ["torpedo moscow", "torpedo luzhniki"],
  "fakel voronezh": ["fakel", "fakel voronezh"],
  "rodina moscow": ["rodina", "fc rodina moscow"],

  // Scandinavia, Scotland, Poland, MLS & Others
  "brondby": ["brondbyernes idraets forening", "brondby", "brondby if"],
  "fc copenhagen": ["fc kobenhavn", "kobenhavn", "copenhagen"],
  "rosenborg": ["rosenborg bk", "rosenborg"],
  "hearts": ["heart of midlothian", "hearts"],
  "celtic": ["glasgow celtic", "celtic"],
  "rangers": ["glasgow rangers", "rangers"],
  "falkirk": ["falkirk fc", "falkirk"],
  "dyskobolia grodzisk": ["groclin grodzisk", "groclin", "dyskobolia"],
  "dyskobolia": ["groclin grodzisk", "groclin", "dyskobolia"],
  "groclin": ["groclin grodzisk", "groclin"],
  "groclin grodzisk": ["groclin grodzisk", "groclin"],
  "halmstads bk": ["halmstad bk", "halmstad", "halmstads bk"],
  "halmstad bk": ["halmstad bk", "halmstad"],
  "red star belgrade": ["crvena zvezda", "red star", "red star belgrade"],
  "red star": ["crvena zvezda", "red star"],
  "crvena zvezda": ["crvena zvezda", "red star"],
  "dc united": ["washington dc united", "washington d c united", "dc united"],
  "d c united": ["washington dc united", "washington d c united", "dc united"],
  "tigres uanl": ["tigres de la uanl", "tigres uanl", "tigres"],
  "bodoglimt": ["bodo glimt", "fk bodo glimt"],
  "union sg": ["union saint gilloise", "royale union saint gilloise", "union sg"],
  "lask": ["lask linz", "lask"],
  "viking": ["viking fk", "viking"],
  "sabah": ["sabah fk", "sabah baku"],
  "ado den haag": ["den haag", "fc den haag", "ado den haag"],
  "sc cambuur": ["cambuur", "cambuur leeuwarden", "sc cambuur"],
  "sbv excelsior": ["excelsior", "sbv excelsior"],
  "telstar": ["sc telstar", "telstar"],

  // Germany
  "alemannia aachen": ["tsv alemannia aachen", "alemannia aachen", "aachen"],
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
  "tsv 1860 munich": ["tsv 1860 munchen", "1860 munchen", "tsv 1860 munich", "1860 munich"],
  "1 fc koeln": ["1 fc koln", "1 fc koeln", "fc koln"],
  "1 fc koln": ["1 fc koln", "1 fc koeln", "fc koln"],
  "fc koln": ["1 fc koln", "1 fc koeln", "fc koln"],
  "1 fc saarbruecken": ["1 fc saarbrucken", "1 fc saarbruecken", "saarbrucken", "saarbruecken"],
  "saarbruecken": ["1 fc saarbrucken", "1 fc saarbruecken", "saarbrucken", "saarbruecken"],
  "rot weiss oberhausen": ["rot weiss oberhausen", "oberhausen"],
  "rot weiss essen": ["rot weiss essen", "essen"],
  "rot weiss erfurt": ["rot weiss erfurt", "erfurt"],
  "hertha bsc": ["hertha bsc berlin", "hertha bsc", "hertha berlin"],
  "hertha berlin": ["hertha bsc berlin", "hertha bsc", "hertha berlin"],
  "schalke 04": ["fc schalke 04", "schalke 04", "schalke"],
  "hamburg": ["hamburger sv", "hsv", "hamburg"],
  "werder bremen": ["sv werder bremen", "werder bremen", "bremen"],
  "wolfsburg": ["vfl wolfsburg", "wolfsburg"],
  "bochum": ["vfl bochum", "bochum"],
  "hannover 96": ["hannover 96", "hannover"],
  "elversberg": ["sv elversberg", "elversberg"],
  "paderborn": ["sc paderborn 07", "sc paderborn", "paderborn"],
  "heidenheim": ["1 fc heidenheim", "heidenheim"],
  "st pauli": ["fc st pauli", "st pauli"],
  "fc st pauli": ["fc st pauli", "st pauli"],

  // South America
  "boca juniors": ["boca juniors", "ca boca juniors", "boca"],
  "river plate": ["river plate", "ca river plate", "river"],
  "santos": ["santos futebol clube", "santos fc", "santos"],
  "flamengo": ["clube de regatas do flamengo", "cr flamengo", "flamengo"],
  "corinthians": ["sport club corinthians paulista", "sc corinthians paulista", "corinthians"],
  "palmeiras": ["sociedade esportiva palmeiras", "se palmeiras", "palmeiras"],
  "gremio": ["gremio foot ball porto alegrense", "gremio fbpa", "gremio"],
  "cruzeiro": ["cruzeiro esporte clube", "cruzeiro"],
  "internacional": ["sport club internacional", "internacional"],
  "sao paulo": ["sao paulo futebol clube", "sao paulo fc", "sao paulo"],
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
  "racing santander": ["real racing club", "racing de santander", "racing santander"],
  "poli ejido": ["polideportivo ejido", "poli ejido", "ejido"],
  "racing ferrol": ["racing club de ferrol", "racing ferrol", "ferrol"],
  "sporting gijon": ["sporting de gijon", "sporting gijon"],
  "atletico madrid": ["club atletico de madrid", "atletico de madrid", "atletico madrid"],
  "athletic bilbao": ["athletic club bilbao", "athletic bilbao", "athletic club"],
  "real madrid": ["real madrid cf", "real madrid"],
  "barcelona": ["fc barcelona", "barcelona"],
  "real betis": ["betis", "real betis balompie"],
  "castilla": ["real madrid b", "real madrid c f b", "real madrid cf b", "castilla"],
  "sporting cp": ["sporting clube de portugal", "sporting cp", "sporting lisbon"],
  "benfica": ["sport lisboa e benfica", "benfica", "sl benfica"],
  "porto": ["futebol clube do porto", "porto", "fc porto"],
  "braga": ["sporting clube de braga", "braga", "sc braga"],
  "uniao de leiria": ["uniao desportiva de leiria", "uniao leiria", "leiria"],
  "academico de viseu": ["academico viseu", "academico de viseu"],
  "alverca": ["fc alverca", "alverca"],
  "maritimo": ["cs maritimo", "maritimo"],
  "inter": ["fc internazionale", "internazionale", "inter milan"],
  "inter milan": ["fc internazionale", "internazionale", "inter milan"],
  "milan": ["ac milan", "milan"],
  "ac milan": ["ac milan", "milan"],
  "juventus": ["juventus fc", "juventus"],
  "roma": ["as roma", "roma"],
  "lazio": ["ss lazio", "lazio"],
  "como": ["como 1907", "calcio como", "como"],
  "marseille": ["olympique de marseille", "marseille"],
  "lyon": ["olympique lyonnais", "lyon"],
  "paris saint germain": ["paris saint germain", "paris saint germain fc", "psg"],
  "paris sg": ["paris saint germain", "paris saint germain fc", "psg"],
  "psg": ["paris saint germain", "paris saint germain fc", "psg"],
  "ajaccio": ["ajaccio ac", "ac ajaccio", "ajaccio"],
  "ac ajaccio": ["ajaccio ac", "ac ajaccio", "ajaccio"],
  "le mans": ["le mans fc", "le mans"],
  "lens": ["rc lens", "lens"],
  "lille osc": ["lille", "losc lille", "lille osc"],
  "stade rennais": ["rennes", "stade rennais"],
  "fenerbahce": ["fenerbahce sk", "fenerbahce"],
  "besiktas": ["besiktas jk", "besiktas"],
  "trabzonspor": ["trabzonspor", "trabzon"],
  "coventry city": ["coventry", "coventry city"],
  "hull city": ["hull", "hull city"],
  "bolton wanderers": ["bolton", "bolton wanderers"],
  "cardiff city": ["cardiff", "cardiff city"],
  "lincoln city": ["lincoln", "lincoln city"],
  // Mexico (Liga MX)
  "club america": ["club de futbol america", "america mex", "club america", "aguilas del america"],
  "chivas guadalajara": ["cd guadalajara", "club guadalajara", "guadalajara", "chivas"],
  "cruz azul": ["cruz azul", "club deportivo cruz azul"],
  "pumas unam": ["unam pumas", "club universidad nacional", "pumas u n a m", "pumas"],
  "tigres uanl": ["tigres uanl", "uanl tigres", "tigres de la uanl"],
  "toluca": ["deportivo toluca", "toluca", "club deportivo toluca"],
  "monterrey": ["cf monterrey", "club de futbol monterrey", "monterrey", "rayados"],
  "pachuca": ["cf pachuca", "club de futbol pachuca", "pachuca"],
  "santos laguna": ["santos laguna", "club santos laguna"],
  "atlas": ["club deportivo atlas", "atlas de guadalajara", "atlas"],
  "necaxa": ["club necaxa", "necaxa", "rayos del necaxa"],
  "puebla": ["puebla fc", "club puebla", "puebla"],
  "morelia": ["club monarcas morelia", "monarcas morelia", "atletico morelia", "morelia"],
  "atlante": ["club de futbol atlante", "atlante fc", "atlante"],
  "tecos uag": ["tecos uag", "uag tecos", "estudiantes tecos", "tecos"],
  "leon": ["club leon", "leon fc", "la fiera leon"],
  "veracruz": ["tiburones rojos de veracruz", "tiburones rojos", "veracruz"],
  "tijuana": ["club tijuana", "xolos de tijuana", "tijuana", "club inter de tijuana"],
  "queretaro": ["queretaro fc", "gallos blancos de queretaro", "queretaro"],
  "atletico san luis": ["atletico de san luis", "atletico san luis", "club atletico de san luis"],
  "san luis": ["atletico de san luis", "club san luis", "san luis fc"],
  "jaguares chiapas": ["jaguares de chiapas", "chiapas fc", "jaguares chiapas"],
  "dorados de sinaloa": ["dorados de sinaloa", "club social y deportivo dorados", "dorados"],
  "lobos buap": ["lobos buap", "lobos de la buap"],
  "toros neza": ["toros neza", "neza ut"],
  "celaya": ["club atletico celaya", "atletico celaya", "celaya fc", "celaya"],
  "irapuato": ["club de futbol irapuato", "atletico irapuato", "irapuato"],
  "tampico madero": ["tampico madero", "tm futbol club"],
  "correcaminos": ["correcaminos uat", "correcaminos"],
  "udeg": ["cd leones negros de la udeg", "leones negros", "club universidad de guadalajara", "udeg"],
  "cobras": ["cobras de ciudad juarez", "cobras juarez"],
  "indios": ["indios de ciudad juarez", "club de futbol indios"],
  "fc juarez": ["fc juarez", "bravos de juarez"],
  "mazatlan": ["mazatlan fc", "mazatlan"],
  // USA / Canada (MLS & CPL)
  "d c united": ["dc united", "d c united", "washington dc united"],
  "la galaxy": ["los angeles galaxy", "la galaxy"],
  "ny nj metrostars": ["nynj metrostars", "ny nj metrostars", "metrostars", "new york red bulls"],
  "new york red bulls": ["new york red bulls", "nynj metrostars", "ny nj metrostars"],
  "kansas city wizards": ["kansas city wizards", "sporting kc", "sporting kansas city"],
  "sporting kansas city": ["sporting kansas city", "sporting kc", "kansas city wizards"],
  "dallas burn": ["dallas burn", "fc dallas"],
  "fc dallas": ["fc dallas", "dallas burn"],
  "columbus crew": ["columbus crew", "columbus"],
  "new england revolution": ["new england revolution", "new england"],
  "san jose clash": ["san jose clash", "san jose earthquakes"],
  "san jose earthquakes": ["san jose earthquakes", "san jose clash"],
  "colorado rapids": ["colorado rapids", "colorado"],
  "chicago fire": ["chicago fire", "chicago"],
  "tampa bay mutiny": ["tampa bay mutiny", "tampa bay"],
  "miami fusion": ["miami fusion fc", "miami fusion"],
  "chivas usa": ["cd chivas usa", "chivas usa"],
  "real salt lake": ["real salt lake"],
  "houston dynamo": ["houston dynamo fc", "houston dynamo"],
  "toronto fc": ["toronto fc"],
  "seattle sounders": ["seattle sounders fc", "seattle sounders"],
  "philadelphia union": ["philadelphia union"],
  "portland timbers": ["portland timbers"],
  "vancouver whitecaps": ["vancouver whitecaps fc", "vancouver whitecaps"],
  "montreal impact": ["montreal impact", "cf montreal"],
  "cf montreal": ["cf montreal", "montreal impact"],
  "new york city fc": ["new york city fc", "nycfc"],
  "orlando city": ["orlando city sc", "orlando city"],
  "atlanta united": ["atlanta united fc", "atlanta united"],
  "minnesota united": ["minnesota united fc", "minnesota thunder"],
  "lafc": ["los angeles fc", "lafc"],
  "fc cincinnati": ["fc cincinnati"],
  "inter miami": ["inter miami cf", "inter miami", "club internacional de futbol miami"],
  "nashville sc": ["nashville sc"],
  "austin fc": ["austin fc"],
  "charlotte fc": ["charlotte fc"],
  "st louis city sc": ["st louis city sc", "st louis city"],
  "san diego fc": ["san diego fc"],
  // CONCACAF (Central America / Caribbean / CPL)
  "saprissa": ["deportivo saprissa", "saprissa"],
  "alajuelense": ["ld alajuelense", "liga deportiva alajuelense", "alajuelense"],
  "herediano": ["club sport herediano", "cs herediano", "herediano"],
  "cd olimpia": ["cd olimpia", "deportivo olimpia", "olimpia hon"],
  "motagua": ["club deportivo motagua", "cd motagua tegucigalpa", "motagua"],
  "real espana": ["real cd espana", "real espana"],
  "marathon": ["cd marathon", "deportivo marathon", "club deportivo marathon"],
  "comunicaciones": ["club comunicaciones", "csd comunicaciones", "comunicaciones fc", "comunicaciones"],
  "csd municipal": ["club social y deportivo municipal", "csd municipal", "municipal"],
  "antigua gfc": ["antigua gfc", "antigua"],
  "cd fas": ["club deportivo fas", "cd fas"],
  "alianza fc": ["alianza fc slv", "alianza futbol club", "alianza fc"],
  "isidro metapan": ["ad isidro metapan", "isidro metapan"],
  "tauro": ["tauro fc", "tauro"],
  "arabe unido": ["cd arabe unido", "arabe unido"],
  "defence force": ["defence force fc", "defence force"],
  "w connection": ["w connection", "williams connection"],
  "harbour view": ["harbour view fc", "harbour view"],
  "cavalier fc": ["cavalier fc", "cavalier sc"],
  "violette": ["violette athletic club", "violette ac"],
  "cibao fc": ["cibao fc"],
  "forge fc": ["forge fc"],
  "cavalry fc": ["cavalry fc"],
  // Belgium (First Division / Pro League)
  "anderlecht": ["rsc anderlecht", "r s c anderlecht", "anderlecht"],
  "club brugge": ["club brugge kv", "club brugge", "fc bruges"],
  "standard liege": ["standard de liege", "r standard de liege", "standard liege", "standard"],
  "genk": ["krc genk", "racing genk", "fc genk", "genk"],
  "gent": ["kaa gent", "aa gent", "la gantoise", "gent"],
  "antwerp": ["royal antwerp fc", "r antwerp fc", "antwerp", "fc antwerp"],
  "union saint gilloise": ["royale union saint gilloise", "r union saint gilloise", "union saint gilloise", "union sg"],
  "kv mechelen": ["kv mechelen", "fc mechelen", "mechelen", "kv malines"],
  "charleroi": ["r charleroi sc", "charleroi sc", "sporting charleroi", "charleroi"],
  "cercle brugge": ["cercle brugge ksv", "cercle brugge"],
  "sint truiden": ["sint truidense vv", "k sint truidense vv", "st truiden", "sint truiden", "stvv"],
  "westerlo": ["kvc westerlo", "westerlo"],
  "kortrijk": ["kv kortrijk", "kortrijk"],
  "oh leuven": ["oud heverlee leuven", "oh leuven", "leuven"],
  "zulte waregem": ["sv zulte waregem", "zulte waregem"],
  "waregem": ["ksv waregem", "waregem"],
  "lierse": ["lierse sk", "k lierse sk", "lierse"],
  "lokeren": ["ksc lokeren", "lokeren", "sporting lokeren"],
  "beveren": ["ksk beveren", "beveren"],
  "waasland beveren": ["waasland beveren", "sk beveren", "beveren"],
  "kv oostende": ["kv oostende", "k v oostende", "oostende"],
  "mouscron": ["excelsior mouscron", "r excelsior mouscron", "royal excel mouscron", "mouscron peruwelz", "mouscron"],
  "eupen": ["kas eupen", "as eupen", "eupen"],
  "germinal ekeren": ["kfc germinal ekeren", "germinal ekeren", "ekeren"],
  "germinal beerschot": ["kfc germinal beerschot", "germinal beerschot", "gba", "beerschot ac"],
  "beerschot": ["k beerschot vac", "beerschot wilrijk", "beerschot va", "beerschot"],
  "rwdm": ["rwd molenbeek", "rwdm", "molenbeek"],
  "fc brussels": ["fc brussels", "fc brussel"],
  "rfc liege": ["rfc liege", "rfc de liege", "club liegeois"],
  "aalst": ["ksc eendracht aalst", "eendracht aalst", "aalst"],
  "lommel": ["kfc lommel sk", "lommel sk", "lommel"],
  "harelbeke": ["krc harelbeke", "harelbeke"],
  "roeselare": ["ksv roeselare", "roeselare"],
  "mons": ["raec mons", "mons"],
  "la louviere": ["raa louvieroise", "raal la louviere", "la louviere"],
  "seraing": ["rfc seraing", "seraing"],
  "dender": ["fcv dender eh", "dender"],
  "boom": ["kfc boom", "boom fc", "boom"],
  "geel": ["kfc verbroedering geel", "verbroedering geel", "geel"],
  "tubize": ["afc tubize", "tubize"],
  "heusden zolder": ["k beringen heusden zolder", "heusden zolder"],
  // Sweden (Allsvenskan - includes normalizeName ä->ae, ö->oe forms too)
  "malmo ff": ["malmo ff", "malmoe ff", "malmo"],
  "ifk goteborg": ["ifk goteborg", "ifk goeteborg", "goeteborg", "goteborg", "ifk gothenburg"],
  "aik": ["aik solna", "aik stockholm", "aik"],
  "djurgarden": ["djurgardens if", "djurgarden"],
  "hammarby": ["hammarby if", "hammarby"],
  "elfsborg": ["if elfsborg", "elfsborg"],
  "ifk norrkoping": ["ifk norrkoeping", "norrkoeping", "ifk norrkoping", "norrkoping"],
  "bk hacken": ["bk haecken", "haecken", "bk hacken", "hacken"],
  "helsingborg": ["helsingborgs if", "helsingborg"],
  "kalmar ff": ["kalmar ff", "kalmar"],
  "halmstads bk": ["halmstads bk", "halmstad"],
  "orebro sk": ["oerebro sk", "oerebro", "orebro sk", "orebro"],
  "gais": ["gais goeteborg", "gais goteborg", "gais"],
  "mjallby aif": ["mjaellby aif", "mjaellby", "mjallby aif", "mjallby"],
  "ik sirius": ["ik sirius", "sirius"],
  "if brommapojkarna": ["if brommapojkarna", "brommapojkarna"],
  "gif sundsvall": ["gif sundsvall", "sundsvall"],
  "trelleborgs ff": ["trelleborgs ff", "trelleborg"],
  "orgryte is": ["oergryte is", "oergryte", "orgryte is", "orgryte"],
  "osters if": ["oesters if", "oester", "osters if", "oster"],
  "degerfors if": ["degerfors if", "degerfors"],
  "gefle if": ["gefle if", "gefle"],
  "atvidabergs ff": ["atvidabergs ff", "atvidaberg"],
  "landskrona bois": ["landskrona bois", "landskrona"],
  "ifk varnamo": ["ifk vaernamo", "vaernamo", "ifk varnamo", "varnamo"],
  "varbergs bois": ["varbergs bois", "varberg"],
  "vasteras sk": ["vaesteras sk", "vaesteras", "vasteras sk", "vasteras"],
  "falkenbergs ff": ["falkenbergs ff", "falkenberg"],
  "jonkopings sodra": ["joenkoepings soedra if", "joenkoepings soedra", "jonkopings sodra if", "jonkopings sodra"],
  "ostersunds fk": ["oestersunds fk", "oestersund", "ostersunds fk", "ostersund"],
  "afc eskilstuna": ["afc eskilstuna", "afc united", "vaesby united", "vasby united"],
  "ljungskile sk": ["ljungskile sk", "ljungskile"],
  "syrianska fc": ["syrianska fc", "syrianska"],
  "assyriska ff": ["assyriska ff", "assyriska"],
  "enkopings sk": ["enkoepings sk", "enkoeping", "enkopings sk", "enkoping"],
  "vastra frolunda": ["vaestra froelunda if", "vaestra froelunda", "vastra frolunda if", "vastra frolunda"],
  "ik brage": ["ik brage", "brage"],
  "umea fc": ["umea fc", "umea"],
  "ik oddevold": ["ik oddevold", "oddevold"],
  "dalkurd ff": ["dalkurd ff", "dalkurd"],
  // Denmark (Superliga - includes normalizeName æ->ae, ø->o, ä->ae, ö->oe forms too)
  "fc copenhagen": ["fc kobenhavn", "fc copenhagen", "f c kobenhavn", "kobenhavn", "copenhagen"],
  "brondby": ["brondby if", "brondby"],
  "midtjylland": ["fc midtjylland", "midtjylland"],
  "nordsjaelland": ["fc nordsjaelland", "farum bk", "nordsjaelland", "farum"],
  "agf aarhus": ["agf aarhus", "aarhus gf", "aarhus gymnastikforening", "agf"],
  "aab": ["aalborg bk", "aab aalborg", "aalborg", "aab"],
  "ob": ["odense bk", "odense boldklub", "odense", "ob"],
  "odense bk": ["odense bk", "odense boldklub", "odense", "ob"],
  "silkeborg": ["silkeborg if", "silkeborg"],
  "randers": ["randers fc", "randers freja", "randers"],
  "viborg": ["viborg ff", "viborg"],
  "lyngby": ["lyngby bk", "lyngby fc", "lyngby"],
  "vejle": ["vejle bk", "vejle boldklub", "vejle"],
  "esbjerg": ["esbjerg fb", "esbjerg"],
  "sonderjyske": ["soenderjyske", "sonderjyske", "hfk sonderjylland", "haderslev fk"],
  "ac horsens": ["ac horsens", "horsens"],
  "herfolge": ["herfolge bk", "herfoelge bk", "herfolge", "herfoelge"],
  "ab": ["akademisk boldklub", "ab copenhagen", "ab"],
  "ikast fs": ["ikast fs", "ikast"],
  "naestved": ["naestved bk", "naestved if", "naestved"],
  "bk frem": ["boldklubben frem", "bk frem", "frem"],
  "b 1903": ["boldklubben 1903", "b 1903", "b1903"],
  "kb": ["kjobenhavns boldklub", "kb copenhagen", "kb"],
  "hobro": ["hobro ik", "hobro"],
  "hb koge": ["hb koge", "hb koege", "herfolge koge"],
  "koge": ["koge bk", "koege bk", "koge", "koege"],
  "hvidovre": ["hvidovre if", "hvidovre"],
  "fc helsingor": ["fc helsingor", "fc helsingoer", "elite 3000 helsingor", "helsingor"],
  "vendsyssel": ["vendsyssel ff", "fc hjorring", "vendsyssel"],
  "fc vestsjaelland": ["fc vestsjaelland", "vestsjaelland"],
  "aarhus fremad": ["aarhus fremad"],
  "b 93": ["boldklubben af 1893", "b 93", "b93"],
  "bronshoj": ["bronshoj bk", "broenshoej bk", "bronshoj", "broenshoej"],
  "b 1913": ["boldklubben 1913", "b 1913", "b1913"],
  "fredericia": ["fc fredericia", "fredericia"]
};

function findBestMatchingClub(teamName, cmClubs, playersByClubId) {
  const norm = normalizeName(teamName);
  const aliasTargets = (NAME_ALIASES[norm] || [norm]).map(normalizeName);

  const stripped = norm
    .replace(/^(rc|rcd|uc|us|afc|cfc|cd|ca|as|ss|sk|nk|bk|fk|tsv)\s+/, '')
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
      // 3. Substring match ONLY for longer distinctive names (avoids 2-letter matches like "ia" hitting "alemannia")
      else if (target.length >= 4 && (c.normLong.includes(target) || c.normShort.includes(target))) {
        score += 50;
      }

      if (score > 0) {
        if (/\b(ii|b|2|u20|u21|u23|reserves)$/.test(c.normLong) || /\b(ii|b|2|u20|u21|u23)$/.test(c.normShort)) {
          score -= 60;
        }
        const pCount = playersByClubId ? (playersByClubId.get(c.id)?.length || 0) : 0;
        candidates.push({ c, score, pCount });
      }
    }
    if (candidates.some(cand => cand.score >= 120 && cand.pCount >= 11)) break;
  }

  if (candidates.length === 0 && !NAME_ALIASES[norm]) {
    const words = norm.split(' ').filter(w => !['fc', 'cf', 'ac', 'de', 'la', 'the', 'ca', 'cd', 'tsv', 'sc', 'vfb', 'sv', 'united', 'city', 'real', 'america', 'club', 'atletico', 'sporting', 'municipal', 'alianza', 'olimpia', 'deportivo', 'nacional', 'santos', 'union'].includes(w));
    const coreWord = words[0];
    if (coreWord && coreWord.length >= 4) {
      const wordRe = new RegExp(`(^|\\s)${coreWord}(\\s|$)`);
      for (const c of cmClubs) {
        if (wordRe.test(c.normLong) || wordRe.test(c.normShort)) {
          const isReserve = /\b(ii|b|2|u20|u21|u23|reserves)$/.test(c.normLong) || /\b(ii|b|2|u20|u21|u23)$/.test(c.normShort);
          const pCount = playersByClubId ? (playersByClubId.get(c.id)?.length || 0) : 0;
          candidates.push({ c, score: isReserve ? 10 : 30, pCount });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

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
// 7. SQUAD SYNTHESIZER & 25-MAN ROSTER BALANCER (1-10 SCALE)
// ---------------------------------------------------------------------------
function synthesizeSquadFiller10(existingPlayers, team, seasonYear, region = "") {
  const squad = [...existingPlayers];
  const neededPositions = [
    'GK', 'GK', 'GK',
    'DC', 'DC', 'DC', 'DC', 'DC', 'DL', 'DR', 'DL', 'DR',
    'MC', 'MC', 'MC', 'MC', 'MC', 'ML', 'MR', 'AMC', 'DMC',
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

  const isHispanic = ['colombia', 'argentina', 'mexico', 'north_america_concacaf', 'south_america_clib', 'south_america_csud', 'spain'].includes(region);
  const isItalian = region === 'italy' || /perugia|juventus|milan|inter|roma|lazio|napoli|palermo|sampdoria/i.test(team.name);
  const isAmerican = region === 'usa';
  const isNordic = region === 'sweden' || region === 'denmark';
  const isBelgian = region === 'belgium';

  const firstNames = isItalian ? [
    "Alessandro", "Gianluigi", "Marco", "Francesco", "Andrea", "Matteo", "Lorenzo", "Roberto", "Simone", "Luca",
    "Fabio", "Daniele", "Federico", "Gabriele", "Filippo", "Davide", "Christian", "Massimo", "Stefano", "Giorgio"
  ] : (isHispanic ? [
    "Carlos", "Diego", "Andrés", "Juan", "David", "Alejandro", "Santiago", "Mateo", "Cristian", "Sebastián",
    "Felipe", "Camilo", "Daniel", "Oscar", "Julián", "Fabio", "Hernán", "Javier", "Nelson", "Ricardo"
  ] : (isAmerican ? [
    "Chris", "Jason", "Ryan", "Matt", "Brian", "Kevin", "Tyler", "Brandon", "Jordan", "Austin",
    "Taylor", "Justin", "Andrew", "Kyle", "Josh", "Nick", "Sean", "Evan", "Eric", "Scott"
  ] : (isNordic ? [
    "Erik", "Johan", "Anders", "Henrik", "Lars", "Mikkel", "Kasper", "Christian", "Mads", "Soren",
    "Jonas", "Fredrik", "Gustav", "Viktor", "Jesper", "Niels", "Peter", "Rasmus", "Emil", "Sebastian"
  ] : (isBelgian ? [
    "Kevin", "Jan", "Thomas", "Dries", "Eden", "Romelu", "Thibaut", "Axel", "Yannick", "Pieter",
    "Bram", "Koen", "Jelle", "Nicolas", "Laurent", "Olivier", "Wout", "Niels", "Maarten", "Maxime"
  ] : [
    "Luka", "Marko", "Ivan", "David", "Matej", "Filip", "Jan", "Milan", "Stefan", "Nikola",
    "Alex", "Thomas", "Daniel", "Martin", "Andreas", "Michael", "Lucas", "Paul", "Erik", "Simon"
  ]))));

  const lastNames = isItalian ? [
    "Rossi", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno",
    "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana"
  ] : (isHispanic ? [
    "Zapata", "Moreno", "Córdoba", "Murillo", "Ospina", "Bedoya", "Rentería", "Palacios", "Mosquera", "Valencia",
    "Rodríguez", "González", "López", "Gómez", "Martínez", "García", "Pérez", "Sánchez", "Ramírez", "Díaz"
  ] : (isAmerican ? [
    "Johnson", "Williams", "Brown", "Miller", "Davis", "Wilson", "Clark", "Lewis", "Walker", "Hall",
    "Allen", "Young", "King", "Wright", "Scott", "Adams", "Baker", "Nelson", "Carter", "Mitchell"
  ] : (isNordic ? [
    "Larsson", "Johansson", "Andersson", "Nilsson", "Eriksson", "Lindqvist", "Karlsson", "Bergstrom", "Hansen", "Nielsen",
    "Jensen", "Pedersen", "Madsen", "Christensen", "Sorensen", "Rasmussen", "Jorgensen", "Holm", "Lindholm", "Olsen"
  ] : (isBelgian ? [
    "De Bruyne", "Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters",
    "De Smet", "Vermeulen", "Van Der Berg", "Hendrickx", "Bogaert", "Lambert", "Dupont", "Simon", "Michiels", "Bogaerts"
  ] : [
    "Kovacic", "Modric", "Petrovic", "Horvat", "Novak", "Kovacevic", "Babic", "Maric", "Juric", "Simic",
    "Schmidt", "Muller", "Weber", "Fischer", "Schneider", "Hansen", "Johansson", "Larsson", "Nielsen", "Jensen"
  ]))));

  let fillerIdx = 0;
  while (squad.length < 25) {
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

    const isWide = ['ML', 'MR', 'AML', 'AMR', 'DL', 'DR', 'LW', 'RW'].includes(pos);
    const clamp10 = (v) => Math.max(1, Math.min(10, Math.round(v)));
    const skills = {
      passing:   clamp10(dept === 'MF' ? rating : (dept === 'GK' ? rating - 3 : rating - 1)),
      marking:   clamp10(dept === 'DF' || pos === 'DMC' ? rating : (dept === 'MF' ? rating - 2 : rating - 4)),
      tackling:  clamp10(dept === 'DF' || pos === 'DMC' ? rating : (dept === 'MF' ? rating - 1 : rating - 4)),
      dribbling: clamp10((dept === 'FW' || isWide || pos === 'AMC') ? rating : (dept === 'MF' ? rating - 1 : rating - 3)),
      crossing:  clamp10(isWide ? rating : (dept === 'MF' || dept === 'FW' ? rating - 2 : rating - 3)),
      heading:   clamp10((pos === 'DC' || pos === 'ST' || pos === 'CF') ? rating : rating - 2),
      finishing: clamp10(dept === 'FW' ? rating : (pos === 'AMC' ? rating - 1 : (dept === 'MF' ? rating - 2 : rating - 4))),
      longShots: clamp10((pos === 'AMC' || pos === 'MC' || dept === 'FW') ? rating - 1 : rating - 3),
      handling:  clamp10(dept === 'GK' ? rating : 1)
    };

    squad.push({
      name: pName,
      position: pos,
      positions: [pos],
      rating, // 1 to 10
      skills,
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

  if (squad.length < 25) {
    for (const p of players) {
      addPlayer(p);
      if (squad.length >= 25) break;
    }
  }

  return squad.slice(0, 25);
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

  // 1. Group Managers by Club ID (Job 5 = Manager, Job 12 = Player/Manager; Job 6/8 = Assistant/Coach formation fallback)
  console.log("⏳ Grouping CM managers & preferred formations by club...");
  const managersByClubId = new Map();
  const assistantFormationByClubId = new Map();
  for (let i = 0; i < cmDb.staffCount; i++) {
    const off = i * STAFF_REC_LEN;
    const clubId = cmDb.staffBuf.readInt32LE(off + 0x39);
    const job = cmDb.staffBuf.readUInt8(off + 0x3D);
    if (clubId <= 0) continue;

    if (job === 5 || (job === 12 && !managersByClubId.has(clubId))) {
      const fnId = cmDb.staffBuf.readInt32LE(off + 0x04);
      const snId = cmDb.staffBuf.readInt32LE(off + 0x08);
      const cnId = cmDb.staffBuf.readInt32LE(off + 0x0C);
      const name = cmDb.readName(fnId, snId, cnId);
      const birthYear = cmDb.staffBuf.readInt16LE(off + 0x12);
      const refYear = seasonFullYear > 2001 ? 2001 : seasonFullYear;
      let age = birthYear > 1900 ? (refYear - birthYear) : 52;
      if (isNaN(age) || age < 22 || age > 85) age = 52;
      const natId = cmDb.staffBuf.readInt32LE(off + 0x1A);
      const nationality = cmDb.getNation(natId);
      const preferredFormation = cmDb.getNonPlayerFormation(off);
      managersByClubId.set(clubId, {
        name,
        age,
        nationality,
        ...(preferredFormation ? { preferredFormation } : {})
      });
    } else if ((job === 6 || job === 8) && !assistantFormationByClubId.has(clubId)) {
      const staffFormation = cmDb.getNonPlayerFormation(off);
      if (staffFormation) {
        assistantFormationByClubId.set(clubId, staffFormation);
      }
    }
  }
  console.log(`   ⚡ Found ${managersByClubId.size} authentic club managers (including player-managers).`);

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
    { dir: CSUD_DIR, type: 'csud' },
    { dir: CONCACAF_DIR, type: 'concacaf' }
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
    const tl = targetLeague.toLowerCase();
    const fn = item.filename.toLowerCase();
    const cp = item.countryPrefix.toLowerCase();
    return cp === tl || fn.startsWith(tl) || fn.replace('.json', '') === tl;
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

      // Manager metadata & preferred formation resolution
      const rawManager = (!isSyntheticClub && managersByClubId.get(matchedClub.id)) || null;
      let manager = rawManager ? { ...rawManager } : { name: "Unknown Manager", age: 50, nationality: "Unknown" };
      if (!manager.name || manager.name === "Unknown Player") {
        manager = { name: "Unknown Manager", age: 50, nationality: "Unknown" };
      }

      const historicalOverride = resolveHistoricalFormationOverride(team.name, manager.name, seasonFullYear);
      const assistantFallback = !isSyntheticClub ? assistantFormationByClubId.get(matchedClub.id) : null;
      const resolvedFormation = historicalOverride
        || manager.preferredFormation
        || assistantFallback
        || getDefaultEraRegionFormation(region, seasonFullYear);

      if (manager.name !== "Unknown Manager") {
        manager.preferredFormation = resolvedFormation;
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
      const weeklyPayroll = Math.round(avgWageW * 25);

      teamDetailsMap[team.name] = {
        manager,
        preferredFormation: resolvedFormation,
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
      } catch (e) { }
    }
    fs.writeFileSync(consolidatedPath, JSON.stringify(finalConsolidated, null, 2), 'utf8');
    console.log(`📦 Consolidated squads saved: ${path.relative(ROOT_DIR, consolidatedPath)} (${Object.keys(finalConsolidated).length} clubs total)`);

    const detailsPath = path.join(OUTPUT_BASE_DIR, `teamDetails${seasonFullYear}.json`);
    let finalDetails = teamDetailsMap;
    if (fs.existsSync(detailsPath)) {
      try {
        const existingDetails = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
        finalDetails = { ...existingDetails, ...teamDetailsMap };
      } catch (e) { }
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
