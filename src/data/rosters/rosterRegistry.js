/**
 * Dynamic On-Demand Roster & Metadata Service
 * Fetches season roster files on demand from /data/rosters/rostersYYYY.json
 * Replaces 100MB static Webpack bundle with lightning-fast 0.2s instant startup.
 */

const seasonRosterCache = new Map();
const seasonDetailsCache = new Map();
const seasonTransferCache = new Map();

const ROSTER_BASE_URL = (process.env.REACT_APP_ROSTER_DATA_URL || "https://pub-6fad1cd62b6f435eb0e2677d784e497c.r2.dev").replace(/\/+$/, "");

async function fetchRosterData(filename) {
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
  try {
    const res = await fetch(`/data/rosters10/${filename}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {}

  // 3. Fallback to local /data/rosters/
  try {
    const res = await fetch(`/data/rosters/${filename}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[rosterRegistry] Local fallback failed for ${filename}:`, err);
  }

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
 * Calibrates a player's rating to the authentic 1-10 scale
 */
export function calibratePlayerRating(p) {
  if (!p) return p;
  if (p.currentAbility) {
    p.rating = getRatingFromCA(p.currentAbility);
  } else if (p.rating <= 5) {
    p.rating = scaleStatTo10(p.rating);
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
 * Loads a season's full rosters on demand from /data/rosters/rostersYYYY.json
 * @param {string|number} season - Season year (e.g. 2004, "2004/05", "04")
 * @returns {Promise<Object|null>} Map of club names to squad arrays
 */
export async function loadSeasonRosters(season) {
  const year = normalizeSeasonYear(season);
  if (seasonRosterCache.has(year)) {
    return seasonRosterCache.get(year);
  }

  const data = await fetchRosterData(`rosters${year}.json`);
  if (data) {
    for (const team in data) {
      if (Array.isArray(data[team])) {
        data[team].forEach(p => calibratePlayerRating(p));
      }
    }
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
  if (data) {
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
