import { leagueDataMap, leagueDataMapD2 } from '../data/leagueData';
import { leagueDataMapSA } from '../data/leagueDataSA';
import { leagueDataMapNA } from '../data/leagueDataNA';
import { qualifiersBySeason } from '../data/qualifiersBySeason';
import { qualifiersBySeasonSA } from '../data/qualifiersBySeasonSA';
import { qualifiersBySeasonNA } from '../data/qualifiersBySeasonNA';
import {
  findSquadForTeam,
  getPrebuiltRosterSync,
  scaleStatTo10
} from '../data/rosters/rosterRegistry';
import { isUefaCountryBanned } from './europeanQualifierHelper';

const SA_COUNTRIES = new Set(['argentina', 'brazil', 'colombia']);
const NA_COUNTRIES = new Set(['usa', 'mexico']);

const DEF_POS = new Set(['GK', 'DC', 'DL', 'DR', 'SW', 'LWB', 'RWB']);
const MID_POS = new Set(['MC', 'ML', 'MR', 'DMC', 'AMC', 'CM', 'DM', 'AM']);
const ATT_POS = new Set(['ST', 'CF', 'LW', 'RW', 'FC', 'SC']);

function normalizeYearStr(season) {
  if (!season) return '2001';
  const str = String(season).trim();
  const match = str.match(/^(\d{4})/);
  return match ? match[1] : str;
}

function getSeasonQualifiersEntry(qualMap, yearStr) {
  if (!qualMap) return null;
  if (qualMap[yearStr]) return qualMap[yearStr];
  const years = Object.keys(qualMap)
    .map((y) => parseInt(y, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (years.length === 0) return null;
  const target = parseInt(yearStr, 10) || years[years.length - 1];
  let best = years[0];
  for (const y of years) {
    if (y <= target) best = y;
  }
  return qualMap[String(best)] || null;
}

/**
 * Returns historical continental / European qualification slot counts for a country in a given season.
 */
export function getContinentalQualificationInfo(country, season) {
  const yearStr = normalizeYearStr(season);
  const yearNum = parseInt(yearStr, 10) || 2001;
  const isSA = SA_COUNTRIES.has(country);
  const isNA = NA_COUNTRIES.has(country);

  if (isSA) {
    const entry = getSeasonQualifiersEntry(qualifiersBySeasonSA, yearStr);
    const topSpots = entry?.cl?.[country]?.length || 0;
    const secSpots = entry?.uefa?.[country]?.length || 0;
    return {
      isContinental: true,
      isSA: true,
      isNA: false,
      topSpots,
      secSpots,
      totalSpots: topSpots + secSpots
    };
  }

  if (isNA) {
    const entry = getSeasonQualifiersEntry(qualifiersBySeasonNA, yearStr);
    const topSpots = entry?.cl?.[country]?.length || 0;
    return {
      isContinental: true,
      isSA: false,
      isNA: true,
      topSpots,
      secSpots: 0,
      totalSpots: topSpots
    };
  }

  if (isUefaCountryBanned(country, yearNum, 'all')) {
    return {
      isContinental: false,
      isSA: false,
      isNA: false,
      topSpots: 0,
      secSpots: 0,
      totalSpots: 0
    };
  }

  const entry = getSeasonQualifiersEntry(qualifiersBySeason, yearStr);
  const clSpots = isUefaCountryBanned(country, yearNum, 'cl') ? 0 : (entry?.cl?.[country]?.length || 0);
  const uefaSpots = entry?.uefa?.[country]?.length || 0;
  const ueclSpots = entry?.uecl?.[country]?.length || 0;

  return {
    isContinental: false,
    isSA: false,
    isNA: false,
    topSpots: clSpots,
    secSpots: uefaSpots + ueclSpots,
    totalSpots: clSpots + uefaSpots + ueclSpots
  };
}

function getRawLeagueTeamsForContext(country, yearStr, division) {
  if (!country) return null;
  if (SA_COUNTRIES.has(country)) {
    return leagueDataMapSA[yearStr]?.[country] || null;
  }
  if (NA_COUNTRIES.has(country)) {
    return leagueDataMapNA[yearStr]?.[country] || null;
  }
  if (division === 2) {
    return leagueDataMapD2[yearStr]?.[country] || null;
  }
  return leagueDataMap[yearStr]?.[country] || null;
}

function computeUnroundedSquadScore10(squad) {
  if (!Array.isArray(squad) || squad.length === 0) return null;
  const isSquad1To10 = squad.some(
    (p) => Number(p?.rating) >= 6 || p?.currentAbility !== undefined || p?.isHistorical || p?.skills
  );
  const getRating = (p) => {
    const r = Number(p?.rating);
    if (!Number.isFinite(r) || r <= 0) return 6;
    return isSquad1To10 ? Math.min(10, Math.max(1, r)) : Math.min(10, Math.max(1, r * 2));
  };
  const avgFloat = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 6);

  const def = squad.filter((p) => DEF_POS.has(p.position)).map(getRating).sort((a, b) => b - a).slice(0, 4);
  const mid = squad.filter((p) => MID_POS.has(p.position)).map(getRating).sort((a, b) => b - a).slice(0, 4);
  const att = squad.filter((p) => ATT_POS.has(p.position)).map(getRating).sort((a, b) => b - a).slice(0, 2);
  const top11 = squad.map(getRating).sort((a, b) => b - a).slice(0, 11);

  const deptAvg = (avgFloat(def) + avgFloat(mid) + avgFloat(att)) / 3;
  const top11Avg = avgFloat(top11);
  return deptAvg * 0.6 + top11Avg * 0.4;
}

function toScale10Avg(teamObj) {
  const att = scaleStatTo10(teamObj?.attack);
  const mid = scaleStatTo10(teamObj?.midfield);
  const def = scaleStatTo10(teamObj?.defense);
  return (att + mid + def) / 3;
}

function computeTeamStrengthScore(teamObj, { seasonYearStr, country, division, seasonRosters, rawLeagueTeams }) {
  if (!teamObj) return 5;

  const rosterData = seasonRosters ? findSquadForTeam(seasonRosters, teamObj.name) : null;
  const cachedSquad = rosterData || getPrebuiltRosterSync(teamObj.name, seasonYearStr);
  const squadFloat = computeUnroundedSquadScore10(cachedSquad);

  const rawList = rawLeagueTeams || getRawLeagueTeamsForContext(country, seasonYearStr, division);
  const rawMatch = Array.isArray(rawList)
    ? rawList.find((r) => r.name?.toLowerCase().trim() === teamObj.name?.toLowerCase().trim())
    : null;
  const prestigeFloat = rawMatch ? toScale10Avg(rawMatch) : null;

  if (squadFloat !== null && prestigeFloat !== null) {
    return squadFloat * 0.65 + prestigeFloat * 0.35;
  }
  if (squadFloat !== null) {
    return squadFloat;
  }
  if (prestigeFloat !== null) {
    const teamAvg = toScale10Avg(teamObj);
    return teamAvg * 0.6 + prestigeFloat * 0.4;
  }
  return toScale10Avg(teamObj);
}

/**
 * Calculates realistic, league-relative board expectations that adapt to:
 * - Relative strength within the club's own league (works equally for Premier League, Serie A, Scotland, Russia, etc.)
 * - Historical era & country European qualification spots (e.g., 2-3 spots in the 90s vs 7-8+ spots in 2025, or 0 during bans)
 * - League size N (12-team Scottish league vs 20-team Serie A/PL)
 */
export function calculateBoardExpectation({
  team,
  allTeams = null,
  country = 'england',
  season = '2001',
  division = 1,
  seasonRosters = null,
  rawLeagueTeams = null
}) {
  if (!team) return null;

  const seasonYearStr = normalizeYearStr(season);
  const isSA = SA_COUNTRIES.has(country);
  const isNA = NA_COUNTRIES.has(country);
  const isContinentalRegion = isSA || isNA;

  if (!allTeams || allTeams.length === 0) {
    const avg10 = toScale10Avg(team);
    if (division === 2) {
      if (avg10 >= 5.6) return { text: 'Win Promotion! 🏆', rank: 1, desc: 'Title Contender / Automatic Promotion' };
      if (avg10 >= 4.6) return { text: 'Promote / Reach Playoffs ↗️', rank: 3, desc: 'Promotion Challenger' };
      if (avg10 >= 3.6) return { text: 'Finish in Top 10', rank: 10, desc: 'Top 10 Finisher' };
      return { text: 'Avoid Relegation', rank: 17, desc: 'Avoid Relegation' };
    }
    if (avg10 >= 9.0) return { text: 'Win the League!', rank: 1, desc: 'Title Contender' };
    if (avg10 >= 8.4) {
      return {
        text: isContinentalRegion ? 'Finish in Top Spots (Continental)' : 'Finish in Top 4 (Europe)',
        rank: 4,
        desc: isContinentalRegion ? 'Continental Challenger' : 'European Challenger'
      };
    }
    if (avg10 >= 7.8) {
      return {
        text: isContinentalRegion ? 'Finish in Top Spots (Continental)' : 'Finish in Top 6 (Europe)',
        rank: 6,
        desc: isContinentalRegion ? 'Continental Challenger' : 'European Challenger'
      };
    }
    if (avg10 >= 6.4) return { text: 'Finish in Top 10', rank: 10, desc: 'Top 10 Finisher' };
    if (avg10 >= 4.6) return { text: 'Finish in Mid-Table (10th-14th)', rank: 14, desc: 'Mid-Table Stability' };
    return { text: 'Avoid Relegation', rank: 17, desc: 'Avoid Relegation' };
  }

  const N = allTeams.length;
  const ctx = { seasonYearStr, country, division, seasonRosters, rawLeagueTeams };
  const scoredTeams = allTeams
    .map((t) => ({
      idnum: t.idnum,
      name: t.name,
      score: computeTeamStrengthScore(t, ctx)
    }))
    .sort((a, b) => b.score - a.score);

  let teamIndex = scoredTeams.findIndex((t) => team.idnum !== undefined && t.idnum === team.idnum);
  if (teamIndex === -1 && team.name) {
    const targetName = team.name.toLowerCase().trim();
    teamIndex = scoredTeams.findIndex((t) => t.name?.toLowerCase().trim() === targetName);
  }
  const rank = teamIndex !== -1 ? teamIndex + 1 : Math.ceil(N / 2);
  const pct = rank / N;

  if (division === 2) {
    if (pct <= 0.15) {
      return { text: 'Win Promotion! 🏆', rank: 1, desc: 'Title Contender / Automatic Promotion' };
    }
    if (pct <= 0.45) {
      return { text: 'Promote / Reach Playoffs ↗️', rank: Math.max(2, Math.round(N * 0.2)), desc: 'Promotion Challenger' };
    }
    if (pct <= 0.75) {
      const topHalf = N <= 14 ? Math.ceil(N / 2) : 10;
      return { text: `Finish in Top ${topHalf}`, rank: topHalf, desc: `Top ${topHalf} Finisher` };
    }
    return { text: 'Avoid Relegation', rank: Math.max(2, N - 3), desc: 'Avoid Relegation' };
  }

  const qualInfo = getContinentalQualificationInfo(country, seasonYearStr);
  const leaderScore = scoredTeams[0]?.score || 7;
  const thirdScore = scoredTeams[2]?.score ?? leaderScore;
  const secondScore = scoredTeams[1]?.score ?? leaderScore;

  // Title contenders: top 2 teams (expand to 3 in big leagues only if #3 is tightly matched with #1)
  let titleCut = N <= 14 ? (leaderScore - secondScore > 0.7 ? 1 : 2) : 2;
  if (N >= 16 && N > 2 && leaderScore - thirdScore <= 0.25) {
    titleCut = 3;
  }

  if (rank <= titleCut) {
    return { text: 'Win the League!', rank: 1, desc: 'Title Contender' };
  }

  // Era- and country-specific European / Continental qualification tiers
  if (qualInfo.totalSpots > 0) {
    const euroCap = Math.min(qualInfo.totalSpots, Math.max(titleCut + 1, Math.floor(N * 0.40)));
    if (isContinentalRegion) {
      if (rank <= euroCap) {
        return {
          text: 'Finish in Top Spots (Continental)',
          rank: Math.min(Math.max(4, euroCap), Math.max(4, N - 4)),
          desc: 'Continental Challenger'
        };
      }
    } else if (rank <= euroCap) {
      if (euroCap <= 4) {
        return {
          text: `Finish in Top ${euroCap} (Europe)`,
          rank: euroCap,
          desc: 'European Challenger'
        };
      }
      const clCap = Math.max(titleCut + 1, Math.min(Math.max(4, qualInfo.topSpots), Math.floor(N * 0.25)));
      if (rank <= clCap) {
        return {
          text: `Finish in Top ${clCap} (Europe)`,
          rank: clCap,
          desc: qualInfo.topSpots >= 3 ? 'Champions League Contender' : 'European Challenger'
        };
      }
      return {
        text: `Finish in Top ${euroCap} (Europe)`,
        rank: euroCap,
        desc: 'European Challenger'
      };
    }
  } else {
    // Leagues without continental spots (e.g. Russia 2025, England 1988 ban) use domestic top-place targets
    const upperDomCut = Math.max(titleCut + 1, Math.round(N * 0.25));
    const lowerDomCut = Math.max(upperDomCut + 1, Math.round(N * 0.40));
    if (rank <= upperDomCut) {
      return {
        text: `Finish in Top ${upperDomCut}`,
        rank: upperDomCut,
        desc: `Top ${upperDomCut} Challenger`
      };
    }
    if (rank <= lowerDomCut) {
      return {
        text: `Finish in Top ${lowerDomCut}`,
        rank: lowerDomCut,
        desc: `Top ${lowerDomCut} Challenger`
      };
    }
  }

  // Top-half / Top-10 tier
  const topHalfRank = N <= 14 ? Math.ceil(N / 2) : (N <= 16 ? 8 : 10);
  if (pct <= 0.55) {
    return {
      text: `Finish in Top ${topHalfRank}`,
      rank: topHalfRank,
      desc: `Top ${topHalfRank} Finisher`
    };
  }

  // Mid-table tier
  if (pct <= 0.80) {
    const midRank = N >= 18 ? 14 : Math.round(N * 0.72);
    return {
      text: N >= 18 ? 'Finish in Mid-Table (10th-14th)' : 'Finish in Mid-Table',
      rank: midRank,
      desc: 'Mid-Table Stability'
    };
  }

  // Lower-table / Survival tier
  const relegationSafeRank = Math.max(2, N - 3);
  return {
    text: 'Avoid Relegation',
    rank: relegationSafeRank,
    desc: 'Avoid Relegation'
  };
}
