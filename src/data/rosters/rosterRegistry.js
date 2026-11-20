/**
 * Dynamic On-Demand Roster & Metadata Service
 * Fetches season roster files on demand from /data/rosters/rostersYYYY.json
 * Replaces 100MB static Webpack bundle with lightning-fast 0.2s instant startup.
 */

const seasonRosterCache = new Map();
const seasonDetailsCache = new Map();
const seasonTransferCache = new Map();
const seasonCatalogCache = new Map();
const normalizedNameCache = new Map();

let cachedLedgerRaw = null;
let cachedLedgerObj = {};

export const CAREER_TRANSFERS_KEY = "retro_career_transfers";

export function normalizePlayerNameKey(name) {
  const raw = String(name || "");
  if (!raw) return "";
  const hit = normalizedNameCache.get(raw);
  if (hit !== undefined) return hit;
  // Fast ASCII path avoids costly NFD Unicode decomposition for most names
  let normalized;
  if (/^[\x20-\x7E]+$/.test(raw)) {
    normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();
  } else {
    normalized = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (normalizedNameCache.size < 60000) {
    normalizedNameCache.set(raw, normalized);
  }
  return normalized;
}

export function clubsMatch(clubA, clubB) {
  if (!clubA || !clubB) return false;
  return String(clubA).toLowerCase().trim() === String(clubB).toLowerCase().trim();
}

export function getCareerTransferLedger() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(CAREER_TRANSFERS_KEY);
    if (!raw) {
      cachedLedgerRaw = null;
      cachedLedgerObj = {};
      return cachedLedgerObj;
    }
    if (raw === cachedLedgerRaw) {
      return cachedLedgerObj;
    }
    const parsed = JSON.parse(raw);
    cachedLedgerRaw = raw;
    cachedLedgerObj = parsed && typeof parsed === "object" ? parsed : {};
    return cachedLedgerObj;
  } catch (e) {
    return {};
  }
}

export function saveCareerTransferLedger(ledger) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const nextObj = ledger || {};
    const raw = JSON.stringify(nextObj);
    localStorage.setItem(CAREER_TRANSFERS_KEY, raw);
    cachedLedgerRaw = raw;
    cachedLedgerObj = nextObj;
  } catch (e) {}
}

export function clearCareerTransferLedger() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(CAREER_TRANSFERS_KEY);
    cachedLedgerRaw = null;
    cachedLedgerObj = {};
  } catch (e) {}
}

export function recordCareerTransfer({ player, fromClub, toClub, retired = false }) {
  if (!player || !player.name) return;
  const key = normalizePlayerNameKey(player.name);
  if (!key) return;
  const ledger = getCareerTransferLedger();
  const prevEntry = ledger[key];
  ledger[key] = {
    name: player.name,
    club: retired ? "__RETIRED__" : (toClub || "Free Agent"),
    fromClub: fromClub || prevEntry?.fromClub || player.currentClub || null,
    retired: Boolean(retired),
    snapshot: { ...player }
  };
  saveCareerTransferLedger(ledger);
}

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
 * Builds and caches a lookup map of normalized player name -> { player, club }
 * from a season's raw DB and market pool (invalidated cleanly when either source loads).
 */
function buildSeasonPlayerCatalog(year) {
  const cached = seasonCatalogCache.get(year);
  const rawSeasonData = seasonRosterCache.get(year);
  const rawMarket = seasonTransferCache.get(year);
  if (
    cached &&
    cached.seasonRef === rawSeasonData &&
    cached.marketRef === rawMarket
  ) {
    return cached.map;
  }

  const catalog = new Map();
  if (rawSeasonData && typeof rawSeasonData === "object") {
    for (const [clubKey, squad] of Object.entries(rawSeasonData)) {
      if (!Array.isArray(squad)) continue;
      for (const p of squad) {
        if (!p || !p.name) continue;
        const key = normalizePlayerNameKey(p.name);
        if (!catalog.has(key)) {
          catalog.set(key, { player: p, club: clubKey });
        }
      }
    }
  }
  if (Array.isArray(rawMarket)) {
    for (const p of rawMarket) {
      if (!p || !p.name) continue;
      const key = normalizePlayerNameKey(p.name);
      if (!catalog.has(key)) {
        catalog.set(key, { player: p, club: p.currentClub || "Free Agent" });
      }
    }
  }
  seasonCatalogCache.set(year, {
    seasonRef: rawSeasonData,
    marketRef: rawMarket,
    map: catalog
  });
  return catalog;
}

/**
 * Produces a next-season player object with updated rating/age/value/wage from the next DB if available,
 * resetting transient match conditions and season accumulators.
 */
function refreshPlayerForNextSeason(prevPlayer, dbMatchPlayer, nextSeason) {
  const nextYear = normalizeSeasonYear(nextSeason);
  const prevAge = Number(prevPlayer.age) || 24;
  const nextAge = dbMatchPlayer && Number(dbMatchPlayer.age) > 0
    ? Number(dbMatchPlayer.age)
    : prevAge + 1;

  const updated = {
    ...prevPlayer,
    age: nextAge,
    condition: 100,
    injured: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    yellows: 0,
    reds: 0
  };

  if (dbMatchPlayer) {
    if (dbMatchPlayer.currentAbility) {
      updated.currentAbility = dbMatchPlayer.currentAbility;
    }
    if (dbMatchPlayer.rating !== undefined && dbMatchPlayer.rating !== null) {
      updated.rating = dbMatchPlayer.rating;
    }
    if (Array.isArray(dbMatchPlayer.positions) && dbMatchPlayer.positions.length > 0) {
      updated.positions = dbMatchPlayer.positions;
    }
    if (dbMatchPlayer.position) {
      updated.position = dbMatchPlayer.position;
    }
    if (dbMatchPlayer.value !== undefined) {
      updated.value = dbMatchPlayer.value;
    }
    if (dbMatchPlayer.wage !== undefined) {
      updated.wage = dbMatchPlayer.wage;
    }
    if (dbMatchPlayer.nationality && !updated.nationality) {
      updated.nationality = dbMatchPlayer.nationality;
    }
  }

  calibratePlayerRating(updated, nextYear);
  return updated;
}

/**
 * Applies the global career transfer & retirement ledger to a club's squad array
 * without mutating cached DB arrays:
 * - Removes anyone retired or currently registered at a different club
 * - Injects anyone registered to this club (refreshing skills from the target season's DB when loaded)
 */
export function applyCareerLedgerToSquad(teamName, rawSquad, season, preloadedLedger = null) {
  if (!Array.isArray(rawSquad) && !teamName) return rawSquad;
  const ledger = preloadedLedger || getCareerTransferLedger();
  const ledgerKeys = ledger ? Object.keys(ledger) : [];
  if (ledgerKeys.length === 0) {
    return rawSquad;
  }

  const baseList = Array.isArray(rawSquad) ? rawSquad : [];
  const lowerTeam = teamName ? String(teamName).toLowerCase().trim() : "";

  // Collect only ledger entries destined for this club
  const incomingEntries = [];
  if (lowerTeam) {
    for (let i = 0; i < ledgerKeys.length; i++) {
      const k = ledgerKeys[i];
      const entry = ledger[k];
      if (entry && !entry.retired && entry.club && String(entry.club).toLowerCase().trim() === lowerTeam) {
        incomingEntries.push([k, entry]);
      }
    }
  }

  // Fast check: does any player in baseList appear in ledger?
  let hasOutgoingOrCollision = false;
  for (let i = 0; i < baseList.length; i++) {
    const p = baseList[i];
    if (!p || !p.name) continue;
    const key = normalizePlayerNameKey(p.name);
    if (ledger[key]) {
      hasOutgoingOrCollision = true;
      break;
    }
  }

  if (!hasOutgoingOrCollision && incomingEntries.length === 0) {
    return rawSquad;
  }

  const year = (incomingEntries.length > 0 && season) ? normalizeSeasonYear(season) : null;
  const catalog = year ? buildSeasonPlayerCatalog(year) : null;

  const seen = new Set();
  const result = [];

  for (let i = 0; i < baseList.length; i++) {
    const p = baseList[i];
    if (!p || !p.name) continue;
    const key = normalizePlayerNameKey(p.name);
    if (!key || seen.has(key)) continue;

    const entry = ledger[key];
    if (entry && (entry.retired || !clubsMatch(entry.club, teamName))) {
      continue;
    }
    seen.add(key);
    result.push({ ...p });
  }

  for (let i = 0; i < incomingEntries.length; i++) {
    const [key, entry] = incomingEntries[i];
    if (seen.has(key)) continue;
    seen.add(key);
    const dbMatch = catalog ? catalog.get(key)?.player : null;
    const baseSnap = entry.snapshot ? { ...entry.snapshot } : { name: entry.name, position: "MC", rating: 6, age: 25 };
    if (dbMatch && year) {
      result.push(refreshPlayerForNextSeason(baseSnap, dbMatch, year));
    } else {
      result.push(baseSnap);
    }
  }

  return result;
}

export function applyCareerLedgerToSeasonData(seasonData, season) {
  if (!seasonData || typeof seasonData !== "object") return seasonData;
  const ledger = getCareerTransferLedger();
  if (!ledger || Object.keys(ledger).length === 0) return seasonData;
  const cloned = {};
  for (const [clubName, squad] of Object.entries(seasonData)) {
    cloned[clubName] = Array.isArray(squad)
      ? applyCareerLedgerToSquad(clubName, squad, season, ledger)
      : squad;
  }
  return cloned;
}

/**
 * Synchronizes in-memory season roster data with any saved localStorage club rosters
 * and global career transfer ledger so transferred/retired players never duplicate across teams.
 */
function syncSeasonDataWithLocalStorage(seasonData, season) {
  if (!seasonData) return seasonData;
  const year = normalizeSeasonYear(season);
  const sStr = String(season);
  const ledger = getCareerTransferLedger();
  const hasLedger = ledger && Object.keys(ledger).length > 0;

  // Scan localStorage once instead of calling getItem 2x per club across 1,000+ clubs
  const localOverrides = new Map();
  if (typeof window !== 'undefined' && window.localStorage) {
    const suffixExact = `_${sStr}`;
    const suffixYear = `_${year}`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("retro_roster_")) continue;
      let clubPart = null;
      let priority = 0;
      if (k.endsWith(suffixExact)) {
        clubPart = k.slice("retro_roster_".length, k.length - suffixExact.length);
        priority = 2;
      } else if (k.endsWith(suffixYear)) {
        clubPart = k.slice("retro_roster_".length, k.length - suffixYear.length);
        priority = 1;
      }
      if (!clubPart) continue;
      const existing = localOverrides.get(clubPart);
      if (!existing || priority > existing.priority) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(parsed) && parsed.length > 0) {
            localOverrides.set(clubPart, { parsed, priority });
          }
        } catch (e) {}
      }
    }
  }

  if (localOverrides.size === 0 && !hasLedger) {
    return seasonData;
  }

  const synced = {};
  for (const teamName of Object.keys(seasonData)) {
    const ov = localOverrides.get(teamName);
    const baseSquad = ov ? ov.parsed : seasonData[teamName];
    synced[teamName] = (hasLedger && Array.isArray(baseSquad))
      ? applyCareerLedgerToSquad(teamName, baseSquad, season, ledger)
      : baseSquad;
  }
  return synced;
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
    seasonRosterCache.set(year, data);
    return syncSeasonDataWithLocalStorage(data, season);
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
          return applyCareerLedgerToSquad(teamName, savedParsed, season);
        }
      } catch (e) {}
    }
  }

  if (!seasonRosterCache.has(year)) {
    await loadSeasonRosters(year);
  }
  const seasonData = seasonRosterCache.get(year);
  if (!seasonData) return null;

  const matched = findSquadForTeam(seasonData, teamName);
  return matched ? applyCareerLedgerToSquad(teamName, matched, season) : null;
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
          return applyCareerLedgerToSquad(teamName, savedParsed, season);
        }
      } catch (e) {}
    }
  }

  const seasonData = seasonRosterCache.get(year);
  if (!seasonData) return null;

  const matched = findSquadForTeam(seasonData, teamName);
  return matched ? applyCareerLedgerToSquad(teamName, matched, season) : null;
}

/**
 * Computes annual retirement probability for players aged 36+.
 */
export function getRetirementChance(age, position, isAbsentFromNextDb = false) {
  const a = Number(age) || 25;
  if (a < 36) return 0;
  if (a >= 42) return 1.0;

  const isGK = position === "GK";
  let baseChance = 0;
  if (a === 36) baseChance = isGK ? 0.08 : 0.16;
  else if (a === 37) baseChance = isGK ? 0.16 : 0.30;
  else if (a === 38) baseChance = isGK ? 0.30 : 0.50;
  else if (a === 39) baseChance = isGK ? 0.50 : 0.72;
  else baseChance = isGK ? 0.75 : 0.90;

  if (isAbsentFromNextDb) {
    baseChance = Math.min(0.96, baseChance + 0.10);
  }
  return baseChance;
}

/**
 * Carries over the player's squad from prevSeason to nextSeason:
 * - Preserves all bought players & keeps sold players excluded
 * - Updates ratings/ages/values from nextSeason's DB when present (or age+1 otherwise)
 * - Rolls realistic 36-40+ retirements and logs retirees in retro_career_transfers
 * - Safeguards minimum GK (2) and squad depth (16) from the club's next-season DB newcomers
 * - Persists retro_roster_*, retro_lineup_*, retro_roles_*, and retro_captain_* for nextSeason
 */
export function advancePlayerSquadForNextSeason({ teamName, prevSeason, nextSeason }) {
  if (!teamName || !prevSeason || !nextSeason) {
    return { squad: [], retiredPlayers: [] };
  }

  const prevYear = normalizeSeasonYear(prevSeason);
  const nextYear = normalizeSeasonYear(nextSeason);
  const catalog = buildSeasonPlayerCatalog(nextYear);

  // 1. Load outgoing squad from prevSeason (localStorage first, fallback to DB)
  let outgoingRaw = null;
  if (typeof window !== "undefined" && window.localStorage) {
    const savedPrev = localStorage.getItem(`retro_roster_${teamName}_${prevSeason}`) ||
                      localStorage.getItem(`retro_roster_${teamName}_${prevYear}`);
    if (savedPrev) {
      try {
        const parsed = JSON.parse(savedPrev);
        if (Array.isArray(parsed) && parsed.length > 0) {
          outgoingRaw = parsed;
        }
      } catch (e) {}
    }
  }
  if (!outgoingRaw) {
    outgoingRaw = getPrebuiltRosterSync(teamName, prevSeason) || [];
  }

  // Apply ledger against prevSeason before rolling into nextSeason
  const cleanedOutgoing = applyCareerLedgerToSquad(teamName, outgoingRaw, prevSeason) || [];

  // 2. Refresh skills/ages from nextSeason DB & collect retirement candidates
  const updatedCandidates = cleanedOutgoing.map((p, idx) => {
    const key = normalizePlayerNameKey(p.name);
    const dbEntry = catalog.get(key);
    const refreshed = refreshPlayerForNextSeason(p, dbEntry?.player || null, nextSeason);
    return {
      player: refreshed,
      absentFromNextDb: !dbEntry,
      origIndex: idx
    };
  });

  // Never retire the sole remaining GK if squad would otherwise have 0 GKs
  const totalGKs = updatedCandidates.filter(c => c.player.position === "GK").length;
  let survivingGKs = totalGKs;

  const retiredPlayers = [];
  const keptSquad = [];

  for (const item of updatedCandidates) {
    const p = item.player;
    const chance = getRetirementChance(p.age, p.position, item.absentFromNextDb);
    const canRetireGK = p.position !== "GK" || survivingGKs > 1;

    if (chance > 0 && canRetireGK && Math.random() < chance) {
      if (p.position === "GK") survivingGKs--;
      retiredPlayers.push(p);
      recordCareerTransfer({ player: p, fromClub: teamName, toClub: "__RETIRED__", retired: true });
    } else {
      keptSquad.push(p);
    }
  }

  // 3. Safeguard minimum GK (2) and squad size (16) from club's next-season DB newcomers
  const rawNextSeasonData = seasonRosterCache.get(nextYear);
  const rawNextClubDb = rawNextSeasonData ? findSquadForTeam(rawNextSeasonData, teamName) : null;
  if (Array.isArray(rawNextClubDb) && rawNextClubDb.length > 0) {
    const ledger = getCareerTransferLedger();
    const existingKeys = new Set(keptSquad.map(p => normalizePlayerNameKey(p.name)));
    const availableNewcomers = rawNextClubDb.filter(p => {
      if (!p || !p.name) return false;
      const key = normalizePlayerNameKey(p.name);
      if (existingKeys.has(key)) return false;
      const entry = ledger[key];
      if (entry && (entry.retired || !clubsMatch(entry.club, teamName))) return false;
      return true;
    });

    while (keptSquad.filter(p => p.position === "GK").length < 2) {
      const gk = availableNewcomers.find(p => p.position === "GK" && !existingKeys.has(normalizePlayerNameKey(p.name)));
      if (!gk) break;
      const key = normalizePlayerNameKey(gk.name);
      existingKeys.add(key);
      keptSquad.push({ ...gk, condition: 100, injured: false, injuryWeeks: 0, goals: 0, assists: 0 });
    }

    // Prefer younger prospects / squad players if total size dipped below 16
    const sortedRepl = [...availableNewcomers].sort((a, b) => (Number(a.age) || 25) - (Number(b.age) || 25));
    for (const cand of sortedRepl) {
      if (keptSquad.length >= 16) break;
      const key = normalizePlayerNameKey(cand.name);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      keptSquad.push({ ...cand, condition: 100, injured: false, injuryWeeks: 0, goals: 0, assists: 0 });
    }
  }

  // 4. Persist squad, lineup, roles, and captain for nextSeason
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(`retro_roster_${teamName}_${nextSeason}`, JSON.stringify(keptSquad));

    const survivorByKey = new Map(keptSquad.map(p => [normalizePlayerNameKey(p.name), p]));

    // Carry over Starting Lineup (updating player stats to nextSeason versions, clearing retirees)
    const prevLineupRaw = localStorage.getItem(`retro_lineup_${teamName}_${prevSeason}`) ||
                          localStorage.getItem(`retro_lineup_${teamName}_${prevYear}`);
    if (prevLineupRaw) {
      try {
        const parsedLineup = JSON.parse(prevLineupRaw);
        const migratedLineup = {};
        for (const [slotId, slotPlayer] of Object.entries(parsedLineup)) {
          if (slotPlayer && slotPlayer.name) {
            const survivor = survivorByKey.get(normalizePlayerNameKey(slotPlayer.name));
            migratedLineup[slotId] = survivor ? { ...survivor } : null;
          } else {
            migratedLineup[slotId] = null;
          }
        }
        localStorage.setItem(`retro_lineup_${teamName}_${nextSeason}`, JSON.stringify(migratedLineup));
      } catch (e) {}
    }

    // Carry over Roles (removing retired players)
    const prevRolesRaw = localStorage.getItem(`retro_roles_${teamName}_${prevSeason}`) ||
                         localStorage.getItem(`retro_roles_${teamName}_${prevYear}`);
    if (prevRolesRaw) {
      try {
        const parsedRoles = JSON.parse(prevRolesRaw);
        const migratedRoles = {};
        for (const [roleKey, playerName] of Object.entries(parsedRoles)) {
          migratedRoles[roleKey] = (playerName && survivorByKey.has(normalizePlayerNameKey(playerName)))
            ? survivorByKey.get(normalizePlayerNameKey(playerName)).name
            : "";
        }
        localStorage.setItem(`retro_roles_${teamName}_${nextSeason}`, JSON.stringify(migratedRoles));
      } catch (e) {}
    }

    // Carry over Captain (replacing if retired)
    const prevCap = localStorage.getItem(`retro_captain_${teamName}_${prevSeason}`) ||
                    localStorage.getItem(`retro_captain_${teamName}_${prevYear}`);
    if (prevCap) {
      const capSurvivor = survivorByKey.get(normalizePlayerNameKey(prevCap));
      if (capSurvivor) {
        localStorage.setItem(`retro_captain_${teamName}_${nextSeason}`, capSurvivor.name);
      } else if (keptSquad.length > 0) {
        const nextCap = [...keptSquad].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))[0];
        if (nextCap && nextCap.name) {
          localStorage.setItem(`retro_captain_${teamName}_${nextSeason}`, nextCap.name);
        }
      }
    }
  }

  return { squad: keptSquad, retiredPlayers };
}

/**
 * Atomically transfers a player from one club to another across localStorage, lineups, and in-memory caches
 * so the player never exists on two teams simultaneously.
 */
export function transferPlayerBetweenClubs({ player, fromClub, toClub, season }) {
  if (!player || !player.name || !season) return;
  recordCareerTransfer({ player, fromClub, toClub, retired: false });
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
function filterMarketPoolWithLedger(pool) {
  if (!Array.isArray(pool)) return [];
  const ledger = getCareerTransferLedger();
  if (!ledger || Object.keys(ledger).length === 0) return pool;
  return pool.filter(p => {
    if (!p || !p.name) return false;
    const entry = ledger[normalizePlayerNameKey(p.name)];
    if (!entry) return true;
    if (entry.retired) return false;
    return entry.club === "Free Agent" || entry.club === "Other Club";
  });
}

export async function getTransferMarketPool(season) {
  if (!season) return [];
  const year = normalizeSeasonYear(season);

  if (seasonTransferCache.has(year)) {
    return filterMarketPoolWithLedger(seasonTransferCache.get(year));
  }

  const data = await fetchRosterData(`transferMarket${year}.json`);
  if (Array.isArray(data)) {
    data.forEach(p => calibratePlayerRating(p, year));
    seasonTransferCache.set(year, data);
    return filterMarketPoolWithLedger(data);
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
