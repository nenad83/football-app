/**
 * Dynamic On-Demand Roster & Metadata Service
 * Fetches season roster files on demand from /data/rosters/rostersYYYY.json
 * Replaces 100MB static Webpack bundle with lightning-fast 0.2s instant startup.
 */

const seasonRosterCache = new Map();
const seasonDetailsCache = new Map();
const seasonTransferCache = new Map();

const ROSTER_BASE_URL = (process.env.REACT_APP_ROSTER_DATA_URL || "https://pub-cec0cd09840f431988f02e47ba9fca96.r2.dev").replace(/\/+$/, "");

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

  // 2. Fallback to local files if offline or network failure
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

  if (detailsData[teamName]) {
    return detailsData[teamName];
  }

  const lowerName = teamName.toLowerCase().trim();
  for (const [key, details] of Object.entries(detailsData)) {
    if (key.toLowerCase().trim() === lowerName) {
      return details;
    }
  }

  return null;
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

export default getPrebuiltRoster;
