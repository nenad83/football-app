/**
 * Dynamic On-Demand Roster & Metadata Service
 * Fetches season roster files on demand from /data/rosters/rostersYYYY.json
 * Replaces 100MB static Webpack bundle with lightning-fast 0.2s instant startup.
 */

const seasonRosterCache = new Map();
const seasonDetailsCache = new Map();
const seasonTransferCache = new Map();

const ROSTER_BASE_URL = (process.env.REACT_APP_ROSTER_DATA_URL || "https://pub-6fad1cd62b6f435eb0e2677d784e497c.r2.dev").replace(/\/+$/, "");

async function tryFetchLocalJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
    if (ct && !ct.toLowerCase().includes("json")) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function fetchRosterData(filename) {
  const isLocalDev = typeof window !== "undefined" &&
    window.location &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  // On localhost, prefer freshly generated local /data/rosters10/ files first
  if (isLocalDev) {
    const local10 = await tryFetchLocalJson(`/data/rosters10/${filename}`);
    if (local10) return local10;
    const localBase = await tryFetchLocalJson(`/data/rosters/${filename}`);
    if (localBase) return localBase;
  }

  // 1. Try remote Cloudflare R2
  try {
    const res = await fetch(`${ROSTER_BASE_URL}/${filename}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[rosterRegistry] Cloudflare R2 fetch failed for ${filename}:`, err);
  }

  // 2. Try local /data/rosters10/
  const fallback10 = await tryFetchLocalJson(`/data/rosters10/${filename}`);
  if (fallback10) return fallback10;

  // 3. Fallback to local /data/rosters/
  const fallbackBase = await tryFetchLocalJson(`/data/rosters/${filename}`);
  if (fallbackBase) return fallbackBase;

  return null;
}

/**
 * Curated historical formation overrides for clubs/managers where CM01/02's 9-formation
 * enum could not distinguish sub-formations (e.g. 4-2-3-1, 3-4-2-1, 4-3-1-2, 4-3-2-1)
 * or where SI's original database had a known formation typo (e.g. Hitzfeld's 4-2-4 code).
 */
export function resolveHistoricalFormationOverride(teamName, managerName, seasonYear) {
  const yr = parseInt(normalizeSeasonYear(seasonYear), 10) || 2001;
  const t = String(teamName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const m = String(managerName || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (m.includes('hitzfeld')) {
    return yr <= 1997 ? '3-5-2' : '5-3-2';
  }
  if (t.includes('dortmund') && yr >= 1991 && yr <= 1997) return '3-5-2';

  if (t === 'liverpool') {
    if (yr >= 2005 && yr <= 2009) return '4-2-3-1';
    if (yr >= 2016 && yr <= 2023) return '4-3-3';
    if (yr >= 2024) return '4-2-3-1';
  }

  if (t.includes('manchester united') || t === 'man utd') {
    if (yr >= 1989 && yr <= 2006) return '4-4-2';
    if (yr >= 2014 && yr <= 2024) return '4-2-3-1';
    if (yr >= 2025 || m.includes('amorim')) return '3-4-2-1';
  }

  if (t.includes('manchester city') || t === 'man city') {
    if (yr >= 2011 && yr <= 2015) return '4-2-3-1';
    if (yr >= 2016) return '4-3-3';
  }

  if (t === 'arsenal') {
    if (yr >= 1989 && yr <= 2005) return '4-4-2';
    if (yr >= 2009 && yr <= 2016) return '4-2-3-1';
    if (yr === 2020) return '3-4-3';
    if (yr >= 2021 && yr <= 2022) return '4-2-3-1';
    if (yr >= 2023) return '4-3-3';
  }

  if (t === 'chelsea') {
    if (yr >= 2004 && yr <= 2007) return '4-3-3';
    if (yr === 2009) return '4-1-2-1-2';
    if (yr >= 2011 && yr <= 2015) return '4-2-3-1';
    if (yr >= 2016 && yr <= 2017) return '3-4-3';
    if (yr >= 2020 && yr <= 2022) return '3-4-2-1';
    if (yr >= 2023) return '4-2-3-1';
  }

  if (t.includes('tottenham')) {
    if (yr >= 2014 && yr <= 2020) return '4-2-3-1';
    if (yr >= 2021 && yr <= 2022) return '3-4-3';
    if (yr >= 2023) return '4-2-3-1';
  }

  if (t.includes('milan') && !t.includes('inter')) {
    if (yr >= 1989 && yr <= 1995) return '4-4-2';
    if (yr >= 2002 && yr <= 2006) return '4-3-1-2';
    if (yr >= 2007 && yr <= 2008) return '4-3-2-1';
    if (yr >= 2010 && yr <= 2012) return '4-3-1-2';
    if (yr >= 2020 && yr <= 2024) return '4-2-3-1';
  }

  if (t === 'inter' || t === 'inter milan' || t === 'internazionale') {
    if (yr >= 2006 && yr <= 2008) return '4-3-1-2';
    if (yr === 2009) return '4-2-3-1';
    if (yr >= 2019) return '3-5-2';
  }

  if (t.includes('juventus')) {
    if (yr >= 1996 && yr <= 1998) return '4-3-1-2';
    if (yr >= 2001 && yr <= 2003) return '4-3-1-2';
    if (yr >= 2011 && yr <= 2014) return '3-5-2';
    if (yr >= 2016 && yr <= 2017) return '4-2-3-1';
  }

  if ((t === 'roma' || t === 'as roma') && yr >= 2005 && yr <= 2008) return '4-2-3-1';
  if (t.includes('atalanta') && yr >= 2017) return '3-4-1-2';
  if (t.includes('napoli') && yr >= 2015 && yr <= 2018) return '4-3-3';

  if (t.includes('real madrid')) {
    if (yr >= 2000 && yr <= 2002) return '4-2-3-1';
    if (yr >= 2010 && yr <= 2013) return '4-2-3-1';
    if (yr >= 2014 && yr <= 2022) return '4-3-3';
    if (yr === 2023) return '4-3-1-2';
    if (yr >= 2024) return '4-3-3';
  }

  if (t.includes('barcelona') && !t.includes('sc') && !t.includes('guayaquil')) {
    if (yr >= 1989 && yr <= 1996) return '4-3-3';
    if (yr >= 2004 && yr <= 2023) return '4-3-3';
    if (yr >= 2024) return '4-2-3-1';
  }

  if (t.includes('bayern')) {
    if (yr >= 1989 && yr <= 1998) return '5-3-2';
    if (yr >= 2010 && yr <= 2012) return '4-2-3-1';
    if (yr >= 2013 && yr <= 2015) return '4-1-4-1';
    if (yr >= 2016) return '4-2-3-1';
  }

  if (t.includes('dortmund')) {
    if (yr >= 2010 && yr <= 2016) return '4-2-3-1';
    if (yr >= 2018 && yr <= 2019) return '4-2-3-1';
  }

  if (t.includes('leverkusen')) {
    if (yr >= 2001 && yr <= 2002) return '4-1-4-1';
    if (yr >= 2022) return '3-4-2-1';
  }

  if (m.includes('amorim')) return '3-4-2-1';
  if (m.includes('gasperini') && yr >= 2016) return '3-4-1-2';
  if (m.includes('xabi alonso') && t.includes('leverkusen')) return '3-4-2-1';

  return null;
}

/**
 * Maps 0-200 Championship Manager Current Ability (CA) to a granular 1-10 Rating
 */
export function getRatingFromCA(ca) {
  const c = parseInt(ca, 10) || 50;
  if (c >= 170) return 10; // All-time peak legends / Ballon d'Or winners (Cantona, Henry, Owen, Ronaldo, Zidane)
  if (c >= 155) return 9;  // World-class superstars (Bergkamp, Schmeichel, Adams, Shearer, Giggs, Beckham, Keane)
  if (c >= 140) return 8;  // Elite top-flight stars / internationals (Seaman, Wright, Campbell, Fowler, Ince, Pallister)
  if (c >= 125) return 7;  // Solid Premier League starters (Southall, Cottee, Dixon, Winterburn, Bould, Keown)
  if (c >= 110) return 6;  // Mid Premier League / Top Championship starters (Watson, Hinchcliffe, Parlour)
  if (c >= 95)  return 5;  // Lower Premier League squad / Championship regulars
  if (c >= 80)  return 4;  // Solid Championship / League One starters
  if (c >= 65)  return 3;  // League One / League Two regulars
  if (c >= 50)  return 2;  // League Two / National League
  return 1;                // Youth trainees / semi-pro
}

/**
 * Era financial multiplier relative to 2001/02 (1.00x)
 */
export function getEraFinancialMultiplier(yearOrSeason) {
  const y = parseInt(normalizeSeasonYear(yearOrSeason), 10) || 2001;
  if (y <= 1990) return 0.18;
  if (y <= 1993) return +(0.18 + (y - 1990) * 0.04).toFixed(3);
  if (y <= 1997) return +(0.30 + (y - 1993) * 0.075).toFixed(3);
  if (y <= 2001) return +(0.60 + (y - 1997) * 0.10).toFixed(3);
  if (y <= 2008) return +(1.00 + (y - 2001) * 0.17).toFixed(3);
  if (y <= 2016) return +(2.19 + (y - 2008) * 0.23).toFixed(3);
  if (y <= 2025) return +(4.03 + (y - 2016) * 0.25).toFixed(3);
  return 6.5;
}

/**
 * Calculates or returns a player's authentic weekly wage ($/wk)
 */
export function calculatePlayerWage(player, season = "2001", clubWageCap = null) {
  if (!player) return 1000;
  if (typeof player.wage === 'number' && player.wage > 0) {
    return Math.round(player.wage);
  }
  const r = parseInt(player.rating, 10) || 5;
  if (clubWageCap && clubWageCap > 0) {
    let wageShare = 0.45;
    if (r >= 10) wageShare = 0.95;
    else if (r === 9) wageShare = 0.85;
    else if (r === 8) wageShare = 0.70;
    else if (r === 7) wageShare = 0.55;
    else if (r === 6) wageShare = 0.45;
    else if (r === 5) wageShare = 0.35;
    else if (r === 4) wageShare = 0.25;
    else wageShare = 0.15;
    return Math.max(250, Math.round(clubWageCap * wageShare));
  }

  let baseWage2001 = 8000;
  if (r >= 10) baseWage2001 = 60000;
  else if (r === 9) baseWage2001 = 44000;
  else if (r === 8) baseWage2001 = 30000;
  else if (r === 7) baseWage2001 = 20000;
  else if (r === 6) baseWage2001 = 13000;
  else if (r === 5) baseWage2001 = 8000;
  else if (r === 4) baseWage2001 = 4500;
  else if (r === 3) baseWage2001 = 2500;
  else if (r === 2) baseWage2001 = 1200;
  else baseWage2001 = 500;

  const eraMult = getEraFinancialMultiplier(season);
  return Math.max(250, Math.round((baseWage2001 * eraMult) / 100) * 100);
}

/**
 * Calibrates a player's rating to the authentic 1-10 scale
 */
export function calibratePlayerRating(p, season = "2001") {
  if (!p) return p;
  if (p.currentAbility) {
    p.rating = getRatingFromCA(p.currentAbility);
  } else if (p.rating <= 5) {
    p.rating = scaleStatTo10(p.rating);
  }
  if (!p.wage || p.wage <= 0) {
    p.wage = calculatePlayerWage(p, season);
  }
  return p;
}

export function normalizeSeasonYear(season) {
  if (!season) return "2001";
  const s = String(season).trim();
  const m4 = s.match(/\d{4}/);
  if (m4) return m4[0];
  const m2 = s.match(/\d{2}/);
  if (m2) {
    const n = parseInt(m2[0], 10);
    return n >= 80 ? `19${m2[0]}` : `20${m2[0]}`;
  }
  return "2001";
}

/**
 * Synchronizes in-memory season roster data with any saved localStorage club rosters
 * so transferred players never appear on two teams simultaneously.
 */
function syncSeasonDataWithLocalStorage(seasonData, season) {
  if (!seasonData || typeof window === 'undefined' || !window.localStorage) return seasonData;
  const year = normalizeSeasonYear(season);
  const sStr = String(season);

  // Collect all localStorage roster overrides for this season
  for (const teamName of Object.keys(seasonData)) {
    const rawExact = localStorage.getItem(`retro_roster_${teamName}_${sStr}`) ||
                     localStorage.getItem(`retro_roster_${teamName}_${year}`);
    if (rawExact) {
      try {
        const parsed = JSON.parse(rawExact);
        if (Array.isArray(parsed) && parsed.length > 0) {
          seasonData[teamName] = parsed;
        }
      } catch (e) {}
    }
  }
  return seasonData;
}

/**
 * Loads a season's full rosters on demand from /data/rosters/rostersYYYY.json
 * @param {string|number} season - Season year (e.g. 2004, "2004/05", "04")
 * @returns {Promise<Object|null>} Map of club names to squad arrays
 */
export async function loadSeasonRosters(season) {
  const year = normalizeSeasonYear(season);
  // Warm teamDetails cache in parallel so manager & preferredFormation are ready synchronously
  if (!seasonDetailsCache.has(year)) {
    fetchRosterData(`teamDetails${year}.json`).then(det => {
      if (det && !seasonDetailsCache.has(year)) {
        seasonDetailsCache.set(year, det);
      }
    }).catch(() => {});
  }
  if (seasonRosterCache.has(year)) {
    return syncSeasonDataWithLocalStorage(seasonRosterCache.get(year), season);
  }

  const data = await fetchRosterData(`rosters${year}.json`);
  if (data) {
    for (const team in data) {
      if (Array.isArray(data[team])) {
        data[team].forEach(p => calibratePlayerRating(p, year));
      }
    }
    syncSeasonDataWithLocalStorage(data, season);
    seasonRosterCache.set(year, data);
    return data;
  }

  return null;
}

/**
 * Retrieves an authentic prebuilt squad on demand.
 * @param {string} teamName - Name of the team (e.g. "Arsenal", "Liverpool", "Perugia")
 * @param {string|number} season - Season year (e.g. 2001, "2001/02")
 * @returns {Promise<Array|null>} Array of 22 player objects or null
 */
export async function getPrebuiltRoster(teamName, season) {
  if (!teamName || !season) return null;
  const year = normalizeSeasonYear(season);

  // Check if club has a modified transfer roster saved in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const savedRaw = localStorage.getItem(`retro_roster_${teamName}_${season}`) ||
                     localStorage.getItem(`retro_roster_${teamName}_${year}`);
    if (savedRaw) {
      try {
        const savedParsed = JSON.parse(savedRaw);
        if (Array.isArray(savedParsed) && savedParsed.length > 0) {
          return savedParsed;
        }
      } catch (e) {}
    }
  }

  let seasonData = seasonRosterCache.get(year);
  if (!seasonData) {
    seasonData = await loadSeasonRosters(year);
  }
  if (!seasonData) return null;

  if (seasonData[teamName]) {
    return seasonData[teamName];
  }

  const lowerName = teamName.toLowerCase().trim();
  for (const [key, squad] of Object.entries(seasonData)) {
    if (key.toLowerCase().trim() === lowerName) {
      return squad;
    }
  }
  for (const [key, squad] of Object.entries(seasonData)) {
    const k = key.toLowerCase().trim();
    if (k.includes(lowerName) || lowerName.includes(k)) {
      return squad;
    }
  }

  return null;
}

/**
 * Synchronous getter for prebuilt squad (returns squad if season already in memory).
 * @param {string} teamName - Name of the team
 * @param {string|number} season - Season year
 * @returns {Array|null} Array of 22 player objects or null
 */
export function getPrebuiltRosterSync(teamName, season) {
  if (!teamName || !season) return null;
  const year = normalizeSeasonYear(season);

  if (typeof window !== 'undefined' && window.localStorage) {
    const savedRaw = localStorage.getItem(`retro_roster_${teamName}_${season}`) ||
                     localStorage.getItem(`retro_roster_${teamName}_${year}`);
    if (savedRaw) {
      try {
        const savedParsed = JSON.parse(savedRaw);
        if (Array.isArray(savedParsed) && savedParsed.length > 0) {
          return savedParsed;
        }
      } catch (e) {}
    }
  }

  const seasonData = seasonRosterCache.get(year);
  if (!seasonData) return null;

  if (seasonData[teamName]) return seasonData[teamName];

  const lowerName = teamName.toLowerCase().trim();
  for (const [key, squad] of Object.entries(seasonData)) {
    if (key.toLowerCase().trim() === lowerName) {
      return squad;
    }
  }
  for (const [key, squad] of Object.entries(seasonData)) {
    const k = key.toLowerCase().trim();
    if (k.includes(lowerName) || lowerName.includes(k)) {
      return squad;
    }
  }

  return null;
}

/**
 * Atomically transfers a player from one club to another across localStorage, lineups, and in-memory caches
 * so the player never exists on two teams simultaneously.
 */
export function transferPlayerBetweenClubs({ player, fromClub, toClub, season }) {
  if (!player || !player.name || !season) return;
  const year = normalizeSeasonYear(season);
  const pNameLower = player.name.toLowerCase().trim();
  const seasonData = seasonRosterCache.get(year);

  // 1. Remove player from fromClub (and any other club in seasonRosterCache except toClub)
  if (fromClub && fromClub !== "Free Agent" && fromClub !== "Other Club") {
    const fromKeys = [
      `retro_roster_${fromClub}_${season}`,
      `retro_roster_${fromClub}_${year}`
    ];

    let existingFromSquad = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      for (const k of fromKeys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          try {
            existingFromSquad = JSON.parse(raw);
            break;
          } catch (e) {}
        }
      }
    }

    if (!existingFromSquad && seasonData) {
      existingFromSquad = findSquadForTeam(seasonData, fromClub);
    }

    if (Array.isArray(existingFromSquad)) {
      const filteredFrom = existingFromSquad.filter(p => (p.name || "").toLowerCase().trim() !== pNameLower);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`retro_roster_${fromClub}_${season}`, JSON.stringify(filteredFrom));
      }
      if (seasonData) {
        for (const [key, sq] of Object.entries(seasonData)) {
          if (key.toLowerCase().trim() === fromClub.toLowerCase().trim() || sq === existingFromSquad) {
            seasonData[key] = filteredFrom;
          }
        }
      }
    }

    // Also clear player from seller club's saved starting lineup if present
    if (typeof window !== 'undefined' && window.localStorage) {
      const lineupKeys = [
        `retro_lineup_${fromClub}_${season}`,
        `retro_lineup_${fromClub}_${year}`
      ];
      for (const lk of lineupKeys) {
        const rawL = localStorage.getItem(lk);
        if (rawL) {
          try {
            const lineupObj = JSON.parse(rawL);
            let changed = false;
            for (const slotId of Object.keys(lineupObj)) {
              if (lineupObj[slotId] && (lineupObj[slotId].name || "").toLowerCase().trim() === pNameLower) {
                lineupObj[slotId] = null;
                changed = true;
              }
            }
            if (changed) {
              localStorage.setItem(lk, JSON.stringify(lineupObj));
            }
          } catch (e) {}
        }
      }
    }
  }

  // 2. Sweep all clubs in seasonRosterCache to ensure player is removed from any previous club
  if (seasonData) {
    const toLower = (toClub || "").toLowerCase().trim();
    for (const [clubKey, squad] of Object.entries(seasonData)) {
      if (clubKey.toLowerCase().trim() === toLower) continue;
      if (Array.isArray(squad) && squad.some(p => (p.name || "").toLowerCase().trim() === pNameLower)) {
        const cleaned = squad.filter(p => (p.name || "").toLowerCase().trim() !== pNameLower);
        seasonData[clubKey] = cleaned;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(`retro_roster_${clubKey}_${season}`, JSON.stringify(cleaned));
        }
      }
    }
  }

  // 3. Add player to destination club in seasonRosterCache & localStorage if not already present
  if (toClub && toClub !== "Free Agent") {
    let destSquad = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      const rawDest = localStorage.getItem(`retro_roster_${toClub}_${season}`) ||
                      localStorage.getItem(`retro_roster_${toClub}_${year}`);
      if (rawDest) {
        try {
          destSquad = JSON.parse(rawDest);
        } catch (e) {}
      }
    }
    if (!destSquad && seasonData) {
      destSquad = findSquadForTeam(seasonData, toClub);
    }

    if (Array.isArray(destSquad)) {
      const alreadyThere = destSquad.some(p => (p.name || "").toLowerCase().trim() === pNameLower);
      const updatedDest = alreadyThere
        ? destSquad.map(p => (p.name || "").toLowerCase().trim() === pNameLower ? { ...p, ...player } : p)
        : [...destSquad, { ...player }];

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`retro_roster_${toClub}_${season}`, JSON.stringify(updatedDest));
      }
      if (seasonData) {
        let matchedKey = toClub;
        for (const key of Object.keys(seasonData)) {
          if (key.toLowerCase().trim() === toClub.toLowerCase().trim()) {
            matchedKey = key;
            break;
          }
        }
        seasonData[matchedKey] = updatedDest;
      }
    }
  }
}

function findTeamInDetails(detailsData, teamName) {
  if (!detailsData || !teamName) return null;
  if (detailsData[teamName]) return detailsData[teamName];

  const clean = (s) => String(s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

  const lowerName = teamName.toLowerCase().trim();
  const cleanTarget = clean(teamName);

  for (const [key, details] of Object.entries(detailsData)) {
    if (key.toLowerCase().trim() === lowerName) return details;
  }
  for (const [key, details] of Object.entries(detailsData)) {
    const k = key.toLowerCase().trim();
    if (k.includes(lowerName) || lowerName.includes(k)) return details;
  }
  for (const [key, details] of Object.entries(detailsData)) {
    const cleanKey = clean(key);
    if (cleanKey && cleanTarget && (cleanKey === cleanTarget || cleanKey.includes(cleanTarget) || cleanTarget.includes(cleanKey))) {
      return details;
    }
  }
  return null;
}

/**
 * Retrieves authentic team details (manager and stadium) for a club.
 * @param {string} teamName - Name of the team
 * @param {string|number} season - Season identifier
 * @returns {Promise<Object|null>} { manager: { name, age, nationality }, stadium: { name, capacity, seating } }
 */
export async function getTeamDetails(teamName, season) {
  if (!teamName || !season) return null;
  const year = normalizeSeasonYear(season);

  let detailsData = seasonDetailsCache.get(year);
  if (!detailsData) {
    detailsData = await fetchRosterData(`teamDetails${year}.json`);
    if (detailsData) {
      seasonDetailsCache.set(year, detailsData);
    }
  }
  if (!detailsData) return null;

  return findTeamInDetails(detailsData, teamName);
}

/**
 * Synchronous getter for authentic team details (manager and stadium) if season details are cached.
 * @param {string} teamName - Name of the team
 * @param {string|number} season - Season identifier
 * @returns {Object|null}
 */
export function getTeamDetailsSync(teamName, season) {
  if (!teamName || !season) return null;
  const year = normalizeSeasonYear(season);
  const detailsData = seasonDetailsCache.get(year);
  if (!detailsData) return null;
  return findTeamInDetails(detailsData, teamName);
}

/**
 * Calculates authentic match attendance based on stadium capacity and relative strength of opponent.
 * Rule: Playing with stronger or equal teams => attendance nearly at max (95% - 99%).
 *       Playing with weaker teams => attendance scales lower based on how weak the opponent is (55% - 92%).
 * @param {Object} homeTeam - Home team object ({ attack, midfield, defense })
 * @param {Object} awayTeam - Away team object ({ attack, midfield, defense })
 * @param {number} stadiumCapacity - Max stadium capacity
 * @param {string|number} matchSeed - Stable seed to prevent number jittering across simulation ticks
 * @returns {{ attendance: number, capacity: number, percent: number }}
 */
export function calculateMatchAttendance(homeTeam, awayTeam, stadiumCapacity, matchSeed = null) {
  const cap = Number(stadiumCapacity) || 45000;
  if (!homeTeam || !awayTeam) {
    return { attendance: Math.round(cap * 0.88), capacity: cap, percent: 88 };
  }

  const homePower = (homeTeam.attack || 3) + (homeTeam.midfield || 3) + (homeTeam.defense || 3);
  const awayPower = (awayTeam.attack || 3) + (awayTeam.midfield || 3) + (awayTeam.defense || 3);
  const weakness = homePower - awayPower;

  // Stable pseudo-random variation based on seed or deterministic numbers
  let rand = 0.5;
  if (typeof matchSeed === 'number') {
    rand = Math.abs(Math.sin(matchSeed * 997)) % 1;
  } else if (typeof matchSeed === 'string') {
    let hash = 0;
    for (let i = 0; i < matchSeed.length; i++) {
      hash = (hash << 5) - hash + matchSeed.charCodeAt(i);
      hash |= 0;
    }
    rand = Math.abs((hash % 1000) / 1000);
  } else {
    rand = 0.5;
  }

  let baseFill = 0.95;
  if (weakness <= 0) {
    // Away team is equal or stronger: nearly at max capacity (95% - 99%)
    baseFill = 0.95 + (rand * 0.04);
  } else if (weakness === 1) {
    // Very competitive match (90% - 94%)
    baseFill = 0.90 + (rand * 0.04);
  } else if (weakness <= 3) {
    // Moderately weaker (82% - 88%)
    baseFill = 0.82 + (rand * 0.06);
  } else if (weakness <= 5) {
    // Clearly weaker (70% - 78%)
    baseFill = 0.70 + (rand * 0.08);
  } else {
    // Much weaker / mismatch (55% - 66%)
    baseFill = 0.55 + (rand * 0.11);
  }

  const clampedFill = Math.min(0.99, Math.max(0.45, baseFill));
  const attendance = Math.round(cap * clampedFill);
  const percent = Math.round(clampedFill * 100);

  return {
    attendance,
    capacity: cap,
    percent
  };
}

/**
 * Retrieves authentic CM transfer market pool for a season.
 * @param {string|number} season - Season identifier
 * @returns {Promise<Array>} Array of real CM transfer-listed and free agent targets
 */
export async function getTransferMarketPool(season) {
  if (!season) return [];
  const year = normalizeSeasonYear(season);

  if (seasonTransferCache.has(year)) {
    return seasonTransferCache.get(year);
  }

  const data = await fetchRosterData(`transferMarket${year}.json`);
  if (Array.isArray(data)) {
    data.forEach(p => calibratePlayerRating(p, year));
    seasonTransferCache.set(year, data);
    return data;
  }

  return [];
}

/**
 * Scale a rating from 1-5 scale up to 1-10 scale if needed.
 * 5 -> 10, 4 -> 8, 3 -> 6, 2 -> 4, 1 -> 2
 */
export function scaleStatTo10(val) {
  const num = Number(val) || 3;
  if (num > 5) return Math.min(10, Math.max(1, num));
  return Math.min(10, Math.max(1, Math.round(num * 2)));
}

/**
 * Finds a team's squad array inside a season's full rosters object.
 */
export function findSquadForTeam(seasonData, teamName) {
  if (!seasonData || !teamName) return null;
  if (seasonData[teamName]) return seasonData[teamName];
  const lower = teamName.toLowerCase().trim();
  for (const [key, squad] of Object.entries(seasonData)) {
    if (key.toLowerCase().trim() === lower) return squad;
  }
  for (const [key, squad] of Object.entries(seasonData)) {
    const k = key.toLowerCase().trim();
    if (k.includes(lower) || lower.includes(k)) return squad;
  }
  return null;
}

/**
 * Computes authentic 1-10 tactical ratings (defense, midfield, attack)
 * from a team's squad of players (top 4 defenders, top 4 midfielders, top 2 forwards).
 */
export function calculateSquadTacticalAverages(squad) {
  if (!Array.isArray(squad) || squad.length === 0) return null;
  const def = squad.filter(p => ['GK','DC','DL','DR','SW','LWB','RWB'].includes(p.position))
                   .map(p => Number(p.rating) || 6).sort((a,b) => b - a).slice(0, 4);
  const mid = squad.filter(p => ['MC','ML','MR','DMC','AMC','CM','DM','AM'].includes(p.position))
                   .map(p => Number(p.rating) || 6).sort((a,b) => b - a).slice(0, 4);
  const att = squad.filter(p => ['ST','CF','LW','RW','FC','SC'].includes(p.position))
                   .map(p => Number(p.rating) || 6).sort((a,b) => b - a).slice(0, 2);

  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 6;
  return {
    defense: Math.min(10, Math.max(1, avg(def))),
    midfield: Math.min(10, Math.max(1, avg(mid))),
    attack: Math.min(10, Math.max(1, avg(att)))
  };
}

/**
 * Automatically purges stale 1-5 roster and lineup caches from localStorage
 * and updates any saved career teams to the 1-10 scale.
 */
export function cleanStale1To5Rosters() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('retro_roster_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data) && data.length > 0) {
              let updated = false;
              data.forEach(p => {
                const prev = p.rating;
                calibratePlayerRating(p);
                if (p.rating !== prev) updated = true;
              });
              // If still entirely <= 5 (no high rated players), purge to fetch authentic prebuilt squad
              const hasHighRating = data.some(p => Number(p.rating) >= 7);
              if (!hasHighRating) {
                keysToRemove.push(key);
              } else if (updated) {
                localStorage.setItem(key, JSON.stringify(data));
              }
            }
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      } else if (key.startsWith('retro_lineup_')) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw);
            if (typeof data === 'object' && data !== null) {
              const players = Object.values(data).filter(Boolean);
              let updated = false;
              players.forEach(p => {
                const prev = p.rating;
                calibratePlayerRating(p);
                if (p.rating !== prev) updated = true;
              });
              const hasHighRating = players.some(p => Number(p.rating) >= 7);
              if (!hasHighRating) {
                keysToRemove.push(key);
              } else if (updated) {
                localStorage.setItem(key, JSON.stringify(data));
              }
            }
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[rosterRegistry] Purged ${keysToRemove.length} stale roster/lineup caches.`);
    }

    // Check retro_league_career to ensure career teams are on 1-10 scale
    const careerRaw = localStorage.getItem('retro_league_career');
    if (careerRaw) {
      try {
        const career = JSON.parse(careerRaw);
        if (career && Array.isArray(career.teams) && career.teams.length > 0) {
          let updated = false;
          career.teams = career.teams.map(t => {
            const att = Number(t.attack) || 6;
            const mid = Number(t.midfield) || 6;
            const def = Number(t.defense) || 6;
            if (att <= 5 || mid <= 5 || def <= 5) {
              updated = true;
              return {
                ...t,
                attack: scaleStatTo10(att),
                midfield: scaleStatTo10(mid),
                defense: scaleStatTo10(def)
              };
            }
            return t;
          });

          if (career.europeanCupState && Array.isArray(career.europeanCupState.teams)) {
            career.europeanCupState.teams = career.europeanCupState.teams.map(t => {
              const att = Number(t.attack) || 6;
              const mid = Number(t.midfield) || 6;
              const def = Number(t.defense) || 6;
              if (att <= 5 || mid <= 5 || def <= 5) {
                updated = true;
                return {
                  ...t,
                  attack: scaleStatTo10(att),
                  midfield: scaleStatTo10(mid),
                  defense: scaleStatTo10(def)
                };
              }
              return t;
            });
          }

          if (updated) {
            localStorage.setItem('retro_league_career', JSON.stringify(career));
            console.log('[rosterRegistry] Upgraded career team stats to 1-10 scale.');
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn('[rosterRegistry] Error running cleanStale1To5Rosters:', e);
  }
}

export default getPrebuiltRoster;
