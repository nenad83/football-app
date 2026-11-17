/**
 * ==============================================================================
 * CM 01/02 RETRO FULL ATTRIBUTE EXTRACTOR (extractCMFullData.js)
 * ==============================================================================
 * Extracts authentic player squads with ALL 42 technical, mental, physical,
 * and goalkeeping attributes directly from local CM 01/02 database files.
 *
 * Saves cleanly into: src/data/cmRetro/2004/
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data', 'cmRetro', '2004');

// Default target directory for 2004/05 season
const CM_DATA_DIR = 'F:/Igri/CM Data/extracted_2004/Summer 2004';

const ATTR_NAMES = [
  'acceleration', 'aggression', 'agility', 'anticipation', 'balance', 'bravery',
  'consistency', 'corners', 'crossing', 'decisions', 'dirtiness', 'dribbling',
  'finishing', 'flair', 'freeKicks', 'handling', 'heading', 'importantMatches',
  'injuryProneness', 'jumping', 'leadership', 'leftFoot', 'longShots', 'marking',
  'offTheBall', 'naturalFitness', 'oneOnOnes', 'pace', 'passing', 'penalties',
  'positioning', 'reflexes', 'rightFoot', 'stamina', 'strength', 'tackling',
  'teamwork', 'technique', 'throwIns', 'versatility', 'vision', 'workRate'
];

// Target 2004/05 Premier League Teams
const PREMIER_LEAGUE_2004 = [
  { name: 'Arsenal', short: 'Arsenal', colors: { primary: '#EF0107', secondary: '#FFFFFF' } },
  { name: 'Chelsea', short: 'Chelsea', colors: { primary: '#034694', secondary: '#FFFFFF' } },
  { name: 'Manchester United', short: 'Man Utd', colors: { primary: '#DA291C', secondary: '#FBE122' } },
  { name: 'Everton', short: 'Everton', colors: { primary: '#003399', secondary: '#FFFFFF' } },
  { name: 'Liverpool', short: 'Liverpool', colors: { primary: '#C8102E', secondary: '#F6EB61' } },
  { name: 'Bolton Wanderers', short: 'Bolton', colors: { primary: '#162b48', secondary: '#FFFFFF' } },
  { name: 'Middlesbrough', short: 'Middlesbrough', colors: { primary: '#D00027', secondary: '#FFFFFF' } },
  { name: 'Manchester City', short: 'Man City', colors: { primary: '#6CABDD', secondary: '#FFFFFF' } },
  { name: 'Tottenham Hotspur', short: 'Tottenham', colors: { primary: '#132257', secondary: '#FFFFFF' } },
  { name: 'Aston Villa', short: 'Aston Villa', colors: { primary: '#95BFE5', secondary: '#670E36' } },
  { name: 'Charlton Athletic', short: 'Charlton', colors: { primary: '#D00027', secondary: '#FFFFFF' } },
  { name: 'Birmingham City', short: 'Birmingham', colors: { primary: '#0000FF', secondary: '#FFFFFF' } },
  { name: 'Fulham', short: 'Fulham', colors: { primary: '#000000', secondary: '#FFFFFF' } },
  { name: 'Newcastle United', short: 'Newcastle', colors: { primary: '#000000', secondary: '#FFFFFF' } },
  { name: 'Blackburn Rovers', short: 'Blackburn', colors: { primary: '#0000FF', secondary: '#FFFFFF' } },
  { name: 'Portsmouth', short: 'Portsmouth', colors: { primary: '#001489', secondary: '#FFFFFF' } },
  { name: 'West Bromwich Albion', short: 'West Brom', colors: { primary: '#122F67', secondary: '#FFFFFF' } },
  { name: 'Crystal Palace', short: 'Crystal Palace', colors: { primary: '#1B458F', secondary: '#C4122E' } },
  { name: 'Norwich City', short: 'Norwich', colors: { primary: '#FFF200', secondary: '#00A650' } },
  { name: 'Southampton', short: 'Southampton', colors: { primary: '#D71920', secondary: '#FFFFFF' } }
];

function normalizeName(str) {
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function readStringTable(buf, id) {
  if (id <= 0) return "";
  const off = id * 60;
  if (off + 60 > buf.length) return "";
  let end = off;
  while (end < off + 60 && buf[end] !== 0) end++;
  return buf.toString('latin1', off, end).trim();
}

function runExtraction() {
  console.log("==================================================================");
  console.log("⚡ EXTRACTING FULL CM 01/02 RETRO DATA (SEASON 2004/05)");
  console.log("==================================================================");

  if (!fs.existsSync(CM_DATA_DIR)) {
    console.error(`Error: CM Data directory not found at: ${CM_DATA_DIR}`);
    process.exit(1);
  }

  const fnBuf = fs.readFileSync(path.join(CM_DATA_DIR, 'first_names.dat'));
  const snBuf = fs.readFileSync(path.join(CM_DATA_DIR, 'second_names.dat'));
  const cnBuf = fs.readFileSync(path.join(CM_DATA_DIR, 'common_names.dat'));
  const clubBuf = fs.readFileSync(path.join(CM_DATA_DIR, 'club.dat'));
  const staffBuf = fs.readFileSync(path.join(CM_DATA_DIR, 'staff.dat'));
  const idxBuf = fs.readFileSync(path.join(CM_DATA_DIR, 'index.dat'));

  // Parse clubs
  const CLUB_REC_LEN = 581;
  const numClubs = Math.floor(clubBuf.length / CLUB_REC_LEN);
  const clubs = [];
  const clubsById = new Map();

  for (let i = 0; i < numClubs; i++) {
    const off = i * CLUB_REC_LEN;
    const id = clubBuf.readInt32LE(off);
    const longName = clubBuf.slice(off + 4, off + 56).toString('latin1').replace(/\0.*$/, '').trim();
    const shortName = clubBuf.slice(off + 56, off + 86).toString('latin1').replace(/\0.*$/, '').trim();
    const stadium = clubBuf.slice(off + 172, off + 202).toString('latin1').replace(/\0.*$/, '').trim() || "Local Stadium";
    const rep = clubBuf.readInt16LE(off + 88);

    const clubObj = { id, longName, shortName, normLong: normalizeName(longName), normShort: normalizeName(shortName), reputation: rep };
    clubs.push(clubObj);
    clubsById.set(id, clubObj);
  }

  // Detect staff rec len & player block
  const STAFF_REC_LEN = 110;
  let playerBlockOffset = 21058266;

  for (let cand = 140000 * STAFF_REC_LEN; cand < staffBuf.length - 1000; cand++) {
    if (staffBuf.readInt32LE(cand) === 0 &&
        staffBuf.readInt32LE(cand + 70) === 1 &&
        staffBuf.readInt32LE(cand + 140) === 2) {
      playerBlockOffset = cand;
      break;
    }
  }

  const staffCount = Math.floor(playerBlockOffset / STAFF_REC_LEN);
  console.log(`Clubs loaded: ${clubs.length}, Player block offset: ${playerBlockOffset}, Total Staff: ${staffCount}`);

  // Group players by Club ID
  const playersByClubId = new Map();
  for (let i = 0; i < staffCount; i++) {
    const off = i * STAFF_REC_LEN;
    const clubId = staffBuf.readInt32LE(off + 0x39);
    const job = staffBuf.readUInt8(off + 0x3D);

    if (clubId > 0 && job === 11) {
      const pPtr = staffBuf.readInt32LE(off + 0x61);
      const pOff = playerBlockOffset + pPtr * 70;
      if (pPtr >= 0 && pOff + 70 <= staffBuf.length) {
        const fnId = staffBuf.readInt32LE(off + 0x04);
        const snId = staffBuf.readInt32LE(off + 0x08);
        const cnId = staffBuf.readInt32LE(off + 0x0C);
        const birthYear = staffBuf.readInt16LE(off + 0x12);

        const common = readStringTable(cnBuf, cnId);
        let name = common;
        if (!name) {
          const fn = readStringTable(fnBuf, fnId);
          const sn = readStringTable(snBuf, snId);
          name = `${fn} ${sn}`.trim() || "Unknown Player";
        }

        const currentAbility = staffBuf.readInt16LE(pOff + 0x05);
        const potentialAbility = staffBuf.readInt16LE(pOff + 0x07);
        const squadNumber = staffBuf[pOff + 0x04];

        // Positions
        const gk = staffBuf.readInt8(pOff + 0x0F);
        const df = staffBuf.readInt8(pOff + 0x11);
        const dm = staffBuf.readInt8(pOff + 0x12);
        const mf = staffBuf.readInt8(pOff + 0x13);
        const am = staffBuf.readInt8(pOff + 0x14);
        const fw = staffBuf.readInt8(pOff + 0x15);
        const right = staffBuf.readInt8(pOff + 0x17) >= 14;
        const left = staffBuf.readInt8(pOff + 0x18) >= 14;
        const centre = staffBuf.readInt8(pOff + 0x19) >= 14;

        const isGK = gk >= 15;
        const isDF = df >= 15;
        const isDM = dm >= 15;
        const isMF = mf >= 15;
        const isAM = am >= 15;
        const isFW = fw >= 15;

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
          if (centre) positions.push("ST");
          if (left) positions.push("LW");
          if (right) positions.push("RW");
          if (!centre && !left && !right) positions.push("ST");
        }
        if (positions.length === 0) positions.push("MC");

        // Primary Position based on highest positional rating
        let primaryPos = "MC";
        if (isGK) {
          primaryPos = "GK";
        } else if (fw >= 15 && fw >= mf && fw >= am) {
          primaryPos = centre ? "ST" : (left ? "LW" : (right ? "RW" : "ST"));
        } else if (df >= 15 && df >= mf && df >= dm) {
          primaryPos = centre ? "DC" : (left ? "DL" : (right ? "DR" : "DC"));
        } else if (am >= 15 && am >= mf) {
          primaryPos = left ? "AML" : (right ? "AMR" : "AMC");
        } else if (dm >= 15 && dm >= mf) {
          primaryPos = "DMC";
        } else if (mf >= 15) {
          primaryPos = left ? "ML" : (right ? "MR" : "MC");
        } else {
          primaryPos = positions[0];
        }

        // All 42 attributes
        const attributes = {};
        for (let a = 0; a < ATTR_NAMES.length; a++) {
          attributes[ATTR_NAMES[a]] = staffBuf[pOff + 27 + a];
        }

        let age = 2004 - birthYear;
        if (isNaN(age) || age < 16 || age > 45) age = 26;

        const playerObj = {
          id: pPtr,
          name,
          position: primaryPos,
          positions,
          age,
          squadNumber: (squadNumber > 0 && squadNumber < 100) ? squadNumber : undefined,
          currentAbility,
          potentialAbility,
          condition: 100,
          attributes
        };

        if (!playersByClubId.has(clubId)) playersByClubId.set(clubId, []);
        playersByClubId.get(clubId).push(playerObj);
      }
    }
  }

  // Match target 2004/05 clubs and save
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const finalTeams = [];
  const finalSquads = {};

  for (const target of PREMIER_LEAGUE_2004) {
    const norm = normalizeName(target.name);
    let matchedClub = clubs.find(c => c.normLong === norm || c.normShort === norm);
    if (!matchedClub) {
      matchedClub = clubs.find(c => c.normLong.includes(norm) || norm.includes(c.normLong));
    }

    if (!matchedClub) {
      console.warn(`Could not match club: ${target.name}`);
      continue;
    }

    const rawPlayers = playersByClubId.get(matchedClub.id) || [];
    // Sort by current ability
    rawPlayers.sort((a, b) => b.currentAbility - a.currentAbility);

    // Pick balanced squad of 24 players ensuring all top stars make the roster
    const gks = rawPlayers.filter(p => p.position === 'GK');
    const dfs = rawPlayers.filter(p => ['DC', 'DL', 'DR', 'SW', 'DF'].some(pos => p.position.includes(pos) || (p.positions || []).includes(pos)));
    const mfs = rawPlayers.filter(p => ['MC', 'ML', 'MR', 'DMC', 'AMC', 'AML', 'AMR', 'MF'].some(pos => p.position.includes(pos) || (p.positions || []).includes(pos)));
    const fws = rawPlayers.filter(p => ['ST', 'CF', 'LW', 'RW', 'FW'].some(pos => p.position.includes(pos) || (p.positions || []).includes(pos)));

    const squad = [];
    const usedIds = new Set();

    function addPlayers(pool, count) {
      let added = 0;
      for (const p of pool) {
        if (!usedIds.has(p.id) && added < count) {
          squad.push(p);
          usedIds.add(p.id);
          added++;
        }
      }
    }

    // Baseline: 2 GKs, 6 DFs, 6 MFs, 3 FWs
    addPlayers(gks, 2);
    addPlayers(dfs, 6);
    addPlayers(mfs, 6);
    addPlayers(fws, 4);

    // Fill remaining up to 24 with the highest ability players available
    for (const p of rawPlayers) {
      if (!usedIds.has(p.id) && squad.length < 24) {
        squad.push(p);
        usedIds.add(p.id);
      }
    }

    // Assign default squad numbers if missing
    let nextNum = 1;
    const usedNums = new Set(squad.map(p => p.squadNumber).filter(Boolean));
    squad.forEach(p => {
      if (!p.squadNumber) {
        while (usedNums.has(nextNum)) nextNum++;
        p.squadNumber = nextNum;
        usedNums.add(nextNum);
      }
    });

    finalTeams.push({
      id: matchedClub.id,
      name: target.name,
      shortName: target.short,
      colors: target.colors,
      reputation: matchedClub.reputation,
      squadCount: squad.length
    });

    finalSquads[target.name] = squad;
    console.log(`✅ Extracted ${target.name.padEnd(24)} (${squad.length} players) [CM Club ID: ${matchedClub.id}]`);
  }

  // Save teams.json and squads.json
  fs.writeFileSync(path.join(OUTPUT_DIR, 'teams.json'), JSON.stringify(finalTeams, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUTPUT_DIR, 'squads.json'), JSON.stringify(finalSquads, null, 2), 'utf8');

  console.log(`\n🎉 Successfully generated:`);
  console.log(`   - ${path.join(OUTPUT_DIR, 'teams.json')} (${finalTeams.length} teams)`);
  console.log(`   - ${path.join(OUTPUT_DIR, 'squads.json')}`);
}

runExtraction();
