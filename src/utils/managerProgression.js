// Shared Manager Prestige, Levels, Per-Match XP, and Live Career Profile Tracking

export const MANAGER_LEVELS = [
  { level: 1, min: 0, next: 500, label: 'LOCAL AMATEUR', icon: '🟢', color: '#00ff64' },
  { level: 2, min: 500, next: 1000, label: 'REGIONAL PROFESSIONAL', icon: '🔵', color: '#00e5ff' },
  { level: 3, min: 1000, next: 2000, label: 'NATIONAL CONTENDER', icon: '🟠', color: '#ff9100' },
  { level: 4, min: 2000, next: 4000, label: 'ELITE COACH', icon: '🟣', color: '#a855f7' },
  { level: 5, min: 4000, next: null, label: 'LEGENDARY BOSS', icon: '🟡', color: '#ffd700' }
];

export const PRESTIGE_WEIGHTS = {
  SEASON_COMPLETED: 75,
  MOTM: 60,
  MOTY: 250,
  LEAGUE_TITLE: 450,
  CUP_TITLE: 500
};

export const DEFAULT_MANAGER_PROFILE = {
  name: 'Sir Alex',
  nationality: '',
  photo: null,
  seasons: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  points: 0,
  gf: 0,
  ga: 0,
  matchXp: 0,
  leagueTitles: 0,
  cupTitles: 0,
  monthlyAwards: 0,
  managerOfTheYear: 0,
  monthlyAwardsList: [],
  motyList: [],
  trophiesList: [],
  history: [],
  currentStint: null,
  committedMatchKeys: [],
  lastMatchXpNote: null
};

function dedupeAwardEntries(list, keyFn) {
  const seen = new Set();
  const unique = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    if (!item) return;
    const key = keyFn(item);
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  return unique;
}

/**
 * Removes duplicate MOTM / MOTY award entries caused by earlier re-mount re-evaluation bugs
 * and adjusts inflated counts proportionally while preserving any legitimate award counts.
 */
export function deduplicateManagerAwards(profile) {
  if (!profile || typeof profile !== 'object') return { profile, changed: false };
  const norm = (v) => String(v || '').trim().toLowerCase();

  const rawMotm = Array.isArray(profile.monthlyAwardsList) ? profile.monthlyAwardsList : [];
  const rawMoty = Array.isArray(profile.motyList) ? profile.motyList : [];

  const uniqueMotm = dedupeAwardEntries(rawMotm, (m) => `${norm(m.season)}::${norm(m.month)}::${norm(m.team)}`);
  const uniqueMoty = dedupeAwardEntries(rawMoty, (m) => `${norm(m.season)}::${norm(m.team)}`);

  const removedMotm = rawMotm.length - uniqueMotm.length;
  const removedMoty = rawMoty.length - uniqueMoty.length;

  let nextMonthlyCount = Number(profile.monthlyAwards) || 0;
  let nextMotyCount = Number(profile.managerOfTheYear) || 0;

  if (removedMotm > 0) {
    nextMonthlyCount = Math.max(uniqueMotm.length, nextMonthlyCount - removedMotm);
  } else if (uniqueMotm.length > nextMonthlyCount) {
    nextMonthlyCount = uniqueMotm.length;
  }

  if (removedMoty > 0) {
    nextMotyCount = Math.max(uniqueMoty.length, nextMotyCount - removedMoty);
  } else if (uniqueMoty.length > nextMotyCount) {
    nextMotyCount = uniqueMoty.length;
  }

  const changed =
    removedMotm > 0 ||
    removedMoty > 0 ||
    nextMonthlyCount !== (Number(profile.monthlyAwards) || 0) ||
    nextMotyCount !== (Number(profile.managerOfTheYear) || 0);

  if (!changed) return { profile, changed: false };

  return {
    changed: true,
    profile: {
      ...profile,
      monthlyAwards: nextMonthlyCount,
      managerOfTheYear: nextMotyCount,
      monthlyAwardsList: uniqueMotm,
      motyList: uniqueMoty
    }
  };
}

export function loadManagerProfileFromStorage(fallbackName = 'Sir Alex', fallbackNationality = '') {
  try {
    const raw = localStorage.getItem('retro_manager_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = {
        ...DEFAULT_MANAGER_PROFILE,
        ...parsed,
        nationality: parsed.nationality || fallbackNationality || '',
        monthlyAwardsList: Array.isArray(parsed.monthlyAwardsList) ? parsed.monthlyAwardsList : [],
        motyList: Array.isArray(parsed.motyList) ? parsed.motyList : [],
        trophiesList: Array.isArray(parsed.trophiesList) ? parsed.trophiesList : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        committedMatchKeys: Array.isArray(parsed.committedMatchKeys) ? parsed.committedMatchKeys : []
      };
      const { profile: healed, changed } = deduplicateManagerAwards(base);
      if (changed) {
        try {
          localStorage.setItem('retro_manager_profile', JSON.stringify(healed));
        } catch (e) {
          // Ignore storage quota issues cleanly
        }
      }
      return healed;
    }
  } catch (e) {
    // Fallback to default
  }
  const defaultNat = fallbackNationality || (fallbackName === 'Sir Alex' ? 'gb-sct' : '');
  return { ...DEFAULT_MANAGER_PROFILE, name: fallbackName || 'Sir Alex', nationality: defaultNat };
}

function getTeamAvg10(team) {
  if (!team) return 5.5;
  const raw = ((Number(team.attack) || 3) + (Number(team.midfield) || 3) + (Number(team.defense) || 3)) / 3;
  return raw <= 5 ? raw * 2 : raw;
}

/**
 * Total Manager Prestige / XP (0 - 4000+ Legendary Boss scale).
 */
export function calculateManagerPrestige(profile) {
  if (!profile) return 0;
  // Backwards compatibility if an older save lacked live matchXp
  const matchXp = profile.matchXp !== undefined
    ? (Number(profile.matchXp) || 0)
    : ((Number(profile.wins) || 0) * 15 + (Number(profile.draws) || 0) * 5);

  return Math.round(
    matchXp +
    ((Number(profile.seasons) || 0) * PRESTIGE_WEIGHTS.SEASON_COMPLETED) +
    ((Number(profile.monthlyAwards) || 0) * PRESTIGE_WEIGHTS.MOTM) +
    ((Number(profile.managerOfTheYear) || 0) * PRESTIGE_WEIGHTS.MOTY) +
    ((Number(profile.leagueTitles) || 0) * PRESTIGE_WEIGHTS.LEAGUE_TITLE) +
    ((Number(profile.cupTitles) || 0) * PRESTIGE_WEIGHTS.CUP_TITLE)
  );
}

/**
 * Returns active level metadata, XP needed for next level, progress %, and point breakdown.
 */
export function getManagerLevelProgress(profile) {
  const prestige = calculateManagerPrestige(profile);
  let levelObj = MANAGER_LEVELS[0];
  for (let i = MANAGER_LEVELS.length - 1; i >= 0; i--) {
    if (prestige >= MANAGER_LEVELS[i].min) {
      levelObj = MANAGER_LEVELS[i];
      break;
    }
  }

  const nextThreshold = levelObj.next;
  const pointsToNext = nextThreshold !== null ? Math.max(0, nextThreshold - prestige) : 0;
  const span = nextThreshold !== null ? (nextThreshold - levelObj.min) : 1;
  const progressPct = nextThreshold !== null
    ? Math.max(0, Math.min(100, Math.round(((prestige - levelObj.min) / span) * 100)))
    : 100;

  const matchXp = profile?.matchXp !== undefined
    ? (Number(profile.matchXp) || 0)
    : ((Number(profile?.wins) || 0) * 15 + (Number(profile?.draws) || 0) * 5);

  return {
    prestige,
    level: levelObj.level,
    label: levelObj.label,
    icon: levelObj.icon,
    color: levelObj.color,
    minThreshold: levelObj.min,
    nextThreshold,
    pointsToNext,
    progressPct,
    breakdown: {
      matchXp: Math.round(matchXp),
      seasonsXp: (Number(profile?.seasons) || 0) * PRESTIGE_WEIGHTS.SEASON_COMPLETED,
      awardsXp: ((Number(profile?.monthlyAwards) || 0) * PRESTIGE_WEIGHTS.MOTM) +
        ((Number(profile?.managerOfTheYear) || 0) * PRESTIGE_WEIGHTS.MOTY),
      trophiesXp: ((Number(profile?.leagueTitles) || 0) * PRESTIGE_WEIGHTS.LEAGUE_TITLE) +
        ((Number(profile?.cupTitles) || 0) * PRESTIGE_WEIGHTS.CUP_TITLE)
    }
  };
}

/**
 * Maps Manager Prestige (0-4000+) onto a 1.0 - 5.0 star rating for club & transfer attraction.
 */
export function getManagerRating5(profile) {
  const prestige = calculateManagerPrestige(profile);
  const scaled = 1.5 + (prestige / 4000) * 3.5;
  return Math.min(5.0, Math.max(1.0, parseFloat(scaled.toFixed(1))));
}

/**
 * Calculates per-match XP earned:
 * - Win: +15 base (+5 Away win bonus, +5/+10/+15 Giant-Killing bonus vs higher-rated side)
 * - Draw: +5 base (+5 extra = +10 total if huge underdog by >= 1.0 rating)
 * - Penalty shootout advance on top of draw: +3 bonus
 * - Loss: 0 XP
 */
export function calculateMatchXpReward({
  playerGoals = 0,
  opponentGoals = 0,
  isHome = true,
  playerTeam = null,
  opponentTeam = null,
  wonOnPenalties = false
}) {
  const pAvg = getTeamAvg10(playerTeam);
  const oAvg = getTeamAvg10(opponentTeam);
  const ratingGap = oAvg - pAvg; // positive => opponent is stronger

  if (playerGoals > opponentGoals) {
    let xp = 15;
    const notes = ['Win +15'];
    if (!isHome) {
      xp += 5;
      notes.push('Away +5');
    }
    if (ratingGap >= 1.5) {
      xp += 15;
      notes.push('Giant Killing +15');
    } else if (ratingGap >= 0.7) {
      xp += 10;
      notes.push('Upset +10');
    } else if (ratingGap >= 0.25) {
      xp += 5;
      notes.push('Underdog +5');
    }
    return { xp, breakdownLabel: notes.join(' • ') };
  }

  if (playerGoals === opponentGoals) {
    let xp = 5;
    const notes = ['Draw +5'];
    if (ratingGap >= 1.0) {
      xp += 5;
      notes.push('Huge Underdog +5');
    }
    if (wonOnPenalties) {
      xp += 3;
      notes.push('Penalties +3');
    }
    return { xp, breakdownLabel: notes.join(' • ') };
  }

  return { xp: 0, breakdownLabel: 'Defeat (0 XP)' };
}

/**
 * Commits a finished user match immediately to managerProfile in localStorage (idempotent via matchKey).
 */
export function recordLiveUserMatchToProfile({
  matchKey,
  playerGoals = 0,
  opponentGoals = 0,
  isHome = true,
  playerTeam = null,
  opponentTeam = null,
  wonOnPenalties = false,
  season = '2001/02',
  country = 'england',
  division = 1,
  competitionLabel = 'League',
  fallbackManagerName = 'Sir Alex'
}) {
  if (typeof localStorage === 'undefined') return null;
  const profile = loadManagerProfileFromStorage(fallbackManagerName);

  const keyStr = String(matchKey || '');
  if (keyStr && profile.committedMatchKeys.includes(keyStr)) {
    return profile;
  }

  const isWin = playerGoals > opponentGoals;
  const isDraw = playerGoals === opponentGoals;
  const isLoss = playerGoals < opponentGoals;
  const pts = isWin ? 3 : (isDraw ? 1 : 0);

  const { xp, breakdownLabel } = calculateMatchXpReward({
    playerGoals,
    opponentGoals,
    isHome,
    playerTeam,
    opponentTeam,
    wonOnPenalties
  });

  const clubName = playerTeam?.name || profile.currentStint?.team || 'Club';
  const prevStint = (profile.currentStint && profile.currentStint.season === season && profile.currentStint.team === clubName)
    ? profile.currentStint
    : {
      season,
      team: clubName,
      country,
      division,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      points: 0,
      xpEarned: 0
    };

  const nextStint = {
    ...prevStint,
    country: country || prevStint.country,
    division: division || prevStint.division,
    played: (prevStint.played || 0) + 1,
    won: (prevStint.won || 0) + (isWin ? 1 : 0),
    drawn: (prevStint.drawn || 0) + (isDraw ? 1 : 0),
    lost: (prevStint.lost || 0) + (isLoss ? 1 : 0),
    gf: (prevStint.gf || 0) + (Number(playerGoals) || 0),
    ga: (prevStint.ga || 0) + (Number(opponentGoals) || 0),
    points: (prevStint.points || 0) + pts,
    xpEarned: (prevStint.xpEarned || 0) + xp
  };

  const baseMatchXp = profile.matchXp !== undefined
    ? (Number(profile.matchXp) || 0)
    : ((Number(profile.wins) || 0) * 15 + (Number(profile.draws) || 0) * 5);

  const updatedKeys = keyStr
    ? [...profile.committedMatchKeys, keyStr].slice(-80)
    : profile.committedMatchKeys;

  const updated = {
    ...profile,
    wins: (Number(profile.wins) || 0) + (isWin ? 1 : 0),
    draws: (Number(profile.draws) || 0) + (isDraw ? 1 : 0),
    losses: (Number(profile.losses) || 0) + (isLoss ? 1 : 0),
    points: (Number(profile.points) || 0) + pts,
    gf: (Number(profile.gf) || 0) + (Number(playerGoals) || 0),
    ga: (Number(profile.ga) || 0) + (Number(opponentGoals) || 0),
    matchXp: baseMatchXp + xp,
    currentStint: nextStint,
    committedMatchKeys: updatedKeys,
    lastMatchXpNote: {
      xp,
      breakdownLabel,
      competitionLabel,
      opponentName: opponentTeam?.name || 'Opponent',
      score: `${playerGoals}-${opponentGoals}`
    }
  };

  try {
    localStorage.setItem('retro_manager_profile', JSON.stringify(updated));
  } catch (e) {
    // Ignore storage quota issues cleanly
  }
  return updated;
}

/**
 * Shared stint finalizer used on end-of-season sign, mid-season takeover, and resignation/sack.
 * Ensures live-committed matches are NEVER double-counted while preserving compatibility with
 * synthetic headless tests where matches weren't played individually.
 */
export function finalizeStintAndSeasonToProfile({
  profile,
  season,
  clubName,
  country,
  division = 1,
  teamStats = null,
  stintBaseline = null,
  isSeasonComplete = false,
  leaguePos = null,
  leagueTitleCount = 0,
  cupTitleCount = 0,
  trophyNames = [],
  monthlyAwardsWon = 0,
  motyWon = 0,
  exitNote = ''
}) {
  const baseProfile = {
    ...DEFAULT_MANAGER_PROFILE,
    ...(profile || {}),
    monthlyAwardsList: Array.isArray(profile?.monthlyAwardsList) ? [...profile.monthlyAwardsList] : [],
    motyList: Array.isArray(profile?.motyList) ? [...profile.motyList] : [],
    trophiesList: Array.isArray(profile?.trophiesList) ? [...profile.trophiesList] : [],
    history: Array.isArray(profile?.history) ? [...profile.history] : []
  };

  const hasLiveStint = Boolean(
    clubName &&
    baseProfile.currentStint &&
    baseProfile.currentStint.team === clubName &&
    (baseProfile.currentStint.played || 0) > 0
  );

  let rowPlayed = 0;
  let rowWon = 0;
  let rowDrawn = 0;
  let rowLost = 0;
  let rowGf = 0;
  let rowGa = 0;
  let rowPts = 0;
  let needAddToLifetime = false;

  if (hasLiveStint) {
    rowPlayed = baseProfile.currentStint.played || 0;
    rowWon = baseProfile.currentStint.won || 0;
    rowDrawn = baseProfile.currentStint.drawn || 0;
    rowLost = baseProfile.currentStint.lost || 0;
    rowGf = baseProfile.currentStint.gf || 0;
    rowGa = baseProfile.currentStint.ga || 0;
    rowPts = baseProfile.currentStint.points || 0;
  } else if (teamStats) {
    const base = stintBaseline || { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
    rowPlayed = Math.max(0, (teamStats.played || 0) - (base.played || 0));
    rowWon = Math.max(0, (teamStats.won || 0) - (base.won || 0));
    rowDrawn = Math.max(0, (teamStats.drawn || 0) - (base.drawn || 0));
    rowLost = Math.max(0, (teamStats.lost || 0) - (base.lost || 0));
    rowGf = Math.max(0, (teamStats.gf || 0) - (base.gf || 0));
    rowGa = Math.max(0, (teamStats.ga || 0) - (base.ga || 0));
    rowPts = Math.max(0, (teamStats.points || 0) - (base.points || 0));
    needAddToLifetime = rowPlayed > 0;
  }

  const newTrophies = (Array.isArray(trophyNames) ? trophyNames : [])
    .filter(Boolean)
    .map((tName) => ({
      season,
      team: clubName || 'Club',
      country,
      trophy: tName
    }));

  const shouldPushHistory = rowPlayed > 0 || isSeasonComplete;
  const nextHistory = shouldPushHistory
    ? [
      ...baseProfile.history,
      {
        season,
        team: clubName || 'Free Agent (Unemployed)',
        country: clubName ? country : null,
        division,
        played: rowPlayed,
        won: rowWon,
        drawn: rowDrawn,
        lost: rowLost,
        gf: rowGf,
        ga: rowGa,
        points: rowPts,
        finalPos: leaguePos || null,
        leagueTitle: leagueTitleCount || 0,
        cupTitle: cupTitleCount || 0,
        monthlyAwardsWon: monthlyAwardsWon || 0,
        managerOfTheYearWon: motyWon || 0,
        note: exitNote || ''
      }
    ]
    : baseProfile.history;

  const prevMatchXp = baseProfile.matchXp !== undefined
    ? (Number(baseProfile.matchXp) || 0)
    : ((Number(baseProfile.wins) || 0) * 15 + (Number(baseProfile.draws) || 0) * 5);

  return {
    ...baseProfile,
    seasons: (Number(baseProfile.seasons) || 0) + (isSeasonComplete ? 1 : 0),
    wins: (Number(baseProfile.wins) || 0) + (needAddToLifetime ? rowWon : 0),
    draws: (Number(baseProfile.draws) || 0) + (needAddToLifetime ? rowDrawn : 0),
    losses: (Number(baseProfile.losses) || 0) + (needAddToLifetime ? rowLost : 0),
    points: (Number(baseProfile.points) || 0) + (needAddToLifetime ? rowPts : 0),
    gf: (Number(baseProfile.gf) || 0) + (needAddToLifetime ? rowGf : 0),
    ga: (Number(baseProfile.ga) || 0) + (needAddToLifetime ? rowGa : 0),
    matchXp: prevMatchXp + (needAddToLifetime ? (rowWon * 15 + rowDrawn * 5) : 0),
    leagueTitles: (Number(baseProfile.leagueTitles) || 0) + (leagueTitleCount || 0),
    cupTitles: (Number(baseProfile.cupTitles) || 0) + (cupTitleCount || 0),
    trophiesList: [...baseProfile.trophiesList, ...newTrophies],
    history: nextHistory,
    currentStint: null
  };
}
