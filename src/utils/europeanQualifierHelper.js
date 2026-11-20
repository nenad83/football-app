import { clRules } from '../data/cl/clRules';
import { uefaRules } from '../data/uefa/uefaRules';
import { ueclRules } from '../data/uecl/ueclRules';
import { clibRules } from '../data/clib/clibRules';
import { csudRules } from '../data/csud/csudRules';

const TOP5_COUNTRIES_TEAMS_FALLBACK = new Set([
  'manchester city', 'arsenal', 'liverpool', 'chelsea', 'manchester united', 'tottenham', 'aston villa', 'newcastle',
  'real madrid', 'barcelona', 'atletico madrid', 'bayern munich', 'borussia dortmund', 'rb leipzig', 'bayer leverkusen',
  'inter milan', 'ac milan', 'juventus', 'napoli', 'roma', 'atalanta', 'paris saint-germain', 'olympique marseille', 'as monaco'
]);

/**
 * Checks historical UEFA federation bans so banned nations never enter or receive play-offs.
 * - England 1989/90: full Heysel ban; 1990/91: European Cup (CL) only still barred
 * - Russia 2022/23 onwards: barred from all UEFA club competitions
 */
export function isUefaCountryBanned(country, seasonYear, cupType = 'all') {
  const c = String(country || '').toLowerCase().trim();
  const yr = parseInt(String(seasonYear || '2001').split('/')[0], 10);
  if (Number.isNaN(yr)) return false;

  if (c === 'england') {
    if (yr <= 1989) return true;
    if (yr === 1990 && cupType === 'cl') return true;
  }
  if (c === 'russia' && yr >= 2022) {
    return true;
  }
  return false;
}

/**
 * Determines whether a European Division 1 champion or runner-up who missed out via
 * hardcoded qualifiers should receive a 2-leg Qualifying Play-Off tie.
 */
export function determineEuropeanQualifier({
  country,
  currentDivision,
  nextDivision,
  playerPosition,
  nextEuropeanCup,
  nextStartYr,
  isSA
}) {
  if (isSA || currentDivision !== 1 || nextDivision !== 1) return null;
  if (isUefaCountryBanned(country, nextStartYr, 'all')) return null;

  if (playerPosition === 1 && nextEuropeanCup !== 'cl' && !isUefaCountryBanned(country, nextStartYr, 'cl')) {
    return 'cl';
  }
  if (playerPosition === 2 && !nextEuropeanCup && !isUefaCountryBanned(country, nextStartYr, 'uefa')) {
    return 'uefa';
  }
  return null;
}

/**
 * Generates chronological midweek offset slots for European / SA continental schedules.
 */
export function generateDynamicSchedules(totalRounds, rules) {
  if (!rules || !rules.calendarSchedules) return [];
  const schedules = JSON.parse(JSON.stringify(rules.calendarSchedules));

  const groupSlots = schedules.filter(s => s.stage === 'group_stage' || s.stage === 'league_stage');
  const totalGroupMatchdays = groupSlots.length;

  const isAutumn = (slot) => {
    if (slot.stage === 'group_stage' || slot.stage === 'league_stage') {
      if (totalGroupMatchdays === 12) return slot.matchday <= 6;
      return true;
    }
    if (rules.format === 'pure_knockout') {
      const uniqueStages = (rules.stages || []).filter(s => s !== 'final');
      if (uniqueStages.length >= 4) {
        return slot.stage === uniqueStages[0] || slot.stage === uniqueStages[1];
      }
      if (uniqueStages.length === 3) {
        return slot.stage === uniqueStages[0];
      }
      return false;
    }
    return false;
  };

  const autumnSlots = schedules.filter(s => isAutumn(s));
  const springSlots = schedules.filter(s => !isAutumn(s) && s.stage !== 'final');
  const finalSlot = schedules.find(s => s.stage === 'final');

  const A = autumnSlots.length;
  if (A > 6) {
    autumnSlots.forEach((slot, i) => {
      slot.offset = 2 + i * 2 + (i >= 4 ? 1 : 0);
    });
  } else if (A > 0) {
    autumnSlots.forEach((slot, i) => {
      if (i === 0) {
        slot.offset = 2;
      } else {
        const prevSlot = autumnSlots[i - 1];
        if (prevSlot.stage === slot.stage && prevSlot.matchday === 1 && slot.matchday === 2) {
          slot.offset = prevSlot.offset + 2;
        } else {
          slot.offset = prevSlot.offset + 3;
        }
      }
    });
  }

  let currentR = totalRounds;
  for (let i = springSlots.length - 1; i >= 0; i--) {
    const slot = springSlots[i];
    const hasLeg2 = springSlots.some(s => s.stage === slot.stage && s.matchday === 2);
    currentR = (slot.matchday === 2 || !hasLeg2) ? currentR - 2 : currentR - 1;
    slot.offset = currentR;
  }

  if (A > 0 && springSlots.length > 0) {
    const lastAutumnOffset = autumnSlots[autumnSlots.length - 1].offset;
    const firstSpringOffset = springSlots[0].offset;
    const minGap = 2;
    if (firstSpringOffset < lastAutumnOffset + minGap) {
      const diff = (lastAutumnOffset + minGap) - firstSpringOffset;
      springSlots.forEach(slot => { slot.offset += diff; });
      if (finalSlot) finalSlot.offset += diff;
    }
  }

  if (finalSlot && finalSlot.offset === undefined) {
    finalSlot.offset = springSlots.length > 0
      ? springSlots[springSlots.length - 1].offset + 2
      : totalRounds;
  }

  const result = [...autumnSlots, ...springSlots];
  if (finalSlot) result.push(finalSlot);
  return result;
}

/**
 * Resolves the closest available template rules object for a competition and season year.
 */
export function resolveContinentalRules(competition, seasonYear, isSA = false) {
  const yr = parseInt(String(seasonYear || '2001').split('/')[0], 10) || 2001;
  let pool;
  if (isSA) {
    pool = competition === 'cl' ? clibRules : csudRules;
  } else {
    pool = competition === 'cl' ? clRules : (competition === 'uefa' ? uefaRules : ueclRules);
  }
  const years = Object.keys(pool).map(Number).sort((a, b) => a - b);
  const closest = years.reduce((prev, curr) => Math.abs(curr - yr) < Math.abs(prev - yr) ? curr : prev);
  return pool[String(closest)];
}

/**
 * Picks an already-qualified lower-seeded club for the 2-leg Qualifying Play-Off.
 */
export function pickQualifierOpponent({ competition, seasonYear, playerTeamName, domesticTeams = [] }) {
  const rules = resolveContinentalRules(competition, seasonYear, false);
  const allTeams = Array.isArray(rules?.teamsData) ? rules.teamsData : [];
  const domesticSet = new Set((domesticTeams || []).map(t => String(t.name || '').toLowerCase().trim()));
  const pLower = String(playerTeamName || '').toLowerCase().trim();

  let candidates = allTeams.filter(t => {
    const n = String(t.name || '').toLowerCase().trim();
    return n !== pLower && !domesticSet.has(n);
  });

  if (candidates.length === 0) {
    candidates = allTeams.filter(t => String(t.name || '').toLowerCase().trim() !== pLower);
  }

  const nonGiantCandidates = candidates.filter(t => !TOP5_COUNTRIES_TEAMS_FALLBACK.has(String(t.name || '').toLowerCase().trim()));
  const pool = nonGiantCandidates.length > 0 ? nonGiantCandidates : candidates;

  const sortedByPowerAsc = [...pool].sort((a, b) => {
    const pA = (a.attack || 3) + (a.midfield || 3) + (a.defense || 3);
    const pB = (b.attack || 3) + (b.midfield || 3) + (b.defense || 3);
    return pA - pB;
  });

  const slicePool = sortedByPowerAsc.slice(0, Math.min(4, sortedByPowerAsc.length));
  const picked = slicePool[Math.floor(Math.random() * slicePool.length)] || allTeams[allTeams.length - 1] || allTeams[0];

  return {
    idnum: 9001,
    originalEuroIdnum: picked.idnum,
    name: picked.name,
    attack: picked.attack || 3,
    midfield: picked.midfield || 3,
    defense: picked.defense || 3,
    kit: picked.kit || 'swe92/0.png',
    primaryColor: picked.primaryColor || '#FFFFFF',
    secondaryColor: picked.secondaryColor || '#000000'
  };
}

/**
 * Builds European / SA continental competition state + midweek schedule slots.
 */
export function buildEuropeanCupSetup({
  competition,
  seasonStr,
  isSA = false,
  selectedTeamObj,
  nextSeasonTeams = [],
  targetReplaceTeamName = null
}) {
  const yr = parseInt(String(seasonStr || '2001').split('/')[0], 10) || 2001;
  const rules = resolveContinentalRules(competition, yr, isSA);
  const euroTeams = JSON.parse(JSON.stringify(rules.teamsData));
  const selectedTeamName = selectedTeamObj?.name || '';
  const domesticNames = (nextSeasonTeams || []).map(t => t.name);

  let nextEuropeanPlayerTeamId = null;
  const existingTeamIndex = euroTeams.findIndex(t => t.name === selectedTeamName);

  if (existingTeamIndex !== -1) {
    nextEuropeanPlayerTeamId = euroTeams[existingTeamIndex].idnum;
  } else {
    let indexToReplace = -1;
    if (targetReplaceTeamName) {
      const tLower = targetReplaceTeamName.toLowerCase().trim();
      indexToReplace = euroTeams.findIndex(t => String(t.name || '').toLowerCase().trim() === tLower);
    }
    if (indexToReplace === -1) {
      indexToReplace = euroTeams.findIndex(t => domesticNames.includes(t.name));
    }
    if (indexToReplace === -1) {
      indexToReplace = euroTeams.length - 1;
    }

    euroTeams[indexToReplace].name = selectedTeamObj.name;
    euroTeams[indexToReplace].primaryColor = selectedTeamObj.primaryColor;
    euroTeams[indexToReplace].secondaryColor = selectedTeamObj.secondaryColor;
    euroTeams[indexToReplace].kit = selectedTeamObj.kit;
    nextEuropeanPlayerTeamId = euroTeams[indexToReplace].idnum;
  }

  euroTeams.forEach(euroTeam => {
    const domesticTeam = (nextSeasonTeams || []).find(t => t.name === euroTeam.name);
    if (domesticTeam) {
      euroTeam.attack = domesticTeam.attack;
      euroTeam.midfield = domesticTeam.midfield;
      euroTeam.defense = domesticTeam.defense;
    }
  });

  const nextTotalRounds = ((nextSeasonTeams.length % 2 === 0 ? nextSeasonTeams.length - 1 : nextSeasonTeams.length)) * 2;
  const dynamicSchedules = generateDynamicSchedules(nextTotalRounds, rules);
  let europeanCupState = null;

  if (rules.format === 'group_then_knockout') {
    const clFixtures = [];
    const groups = [...new Set(euroTeams.map(t => t.group))].filter(g => g !== 'bye' && g !== 'champion').sort();
    const firstGroupTeams = euroTeams.filter(t => t.group === groups[0]);
    const numMatchdays = firstGroupTeams.length === 5 ? 5 : 6;
    for (let m = 0; m < numMatchdays; m++) clFixtures.push([]);

    groups.forEach(g => {
      const gTeams = euroTeams.filter(t => t.group === g);
      if (gTeams.length === 5) {
        const [t0, t1, t2, t3, t4] = gTeams.map(t => t.idnum);
        clFixtures[0].push({ homeId: t1, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[1].push({ homeId: t0, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[2].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[2].push({ homeId: t4, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[3].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[3].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[4].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[4].push({ homeId: t4, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
      } else if (gTeams.length >= 4) {
        const [t0, t1, t2, t3] = gTeams.map(t => t.idnum);
        clFixtures[0].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[1].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[2].push({ homeId: t0, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[2].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[3].push({ homeId: t1, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[3].push({ homeId: t3, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[4].push({ homeId: t0, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[4].push({ homeId: t2, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[5].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
        clFixtures[5].push({ homeId: t1, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
      }
    });

    europeanCupState = {
      teams: euroTeams,
      fixtures: clFixtures,
      europeanPlayerTeamId: nextEuropeanPlayerTeamId,
      knockoutState: {
        roundOf32Leg1: null, roundOf32Leg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: null, quarterFinalsLeg2: null,
        semiFinalsLeg1: null, semiFinalsLeg2: null,
        final: null
      }
    };
  } else if (rules.format === 'league_then_knockout') {
    const clFixtures = [];
    const numTeams = euroTeams.length;
    const rounds = 8;
    const list = [...euroTeams];

    for (let r = 0; r < rounds; r++) {
      const roundPairs = [];
      for (let i = 0; i < numTeams / 2; i++) {
        const home = list[i];
        const away = list[numTeams - 1 - i];
        roundPairs.push(
          r % 2 === 0
            ? { homeId: home.idnum, awayId: away.idnum, played: false, homeScore: 0, awayScore: 0 }
            : { homeId: away.idnum, awayId: home.idnum, played: false, homeScore: 0, awayScore: 0 }
        );
      }
      clFixtures.push(roundPairs);
      list.splice(1, 0, list.pop());
    }

    europeanCupState = {
      teams: euroTeams,
      fixtures: clFixtures,
      europeanPlayerTeamId: nextEuropeanPlayerTeamId,
      knockoutState: {
        playoffsLeg1: null, playoffsLeg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: null, quarterFinalsLeg2: null,
        semiFinalsLeg1: null, semiFinalsLeg2: null,
        final: null
      }
    };
  } else if (rules.format === 'pure_knockout') {
    const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
    const firstStage = rules.stages[0];
    const firstLegKey = toCamelCase(firstStage) + 'Leg1';
    const secondLegKey = toCamelCase(firstStage) + 'Leg2';

    const leg1Fixtures = [];
    for (let i = 0; i < euroTeams.length; i += 2) {
      leg1Fixtures.push({
        homeId: euroTeams[i].idnum,
        awayId: euroTeams[i + 1].idnum,
        played: false,
        homeScore: 0,
        awayScore: 0
      });
    }
    const leg2Fixtures = leg1Fixtures.map(m => ({
      homeId: m.awayId,
      awayId: m.homeId,
      played: false,
      homeScore: 0,
      awayScore: 0
    }));

    const knockoutState = {
      roundOf32Leg1: null, roundOf32Leg2: null,
      roundOf16Leg1: null, roundOf16Leg2: null,
      quarterFinalsLeg1: null, quarterFinalsLeg2: null,
      semiFinalsLeg1: null, semiFinalsLeg2: null,
      final: null
    };
    knockoutState[firstLegKey] = leg1Fixtures;
    knockoutState[secondLegKey] = leg2Fixtures;

    europeanCupState = {
      teams: euroTeams,
      europeanPlayerTeamId: nextEuropeanPlayerTeamId,
      knockoutState
    };
  }

  return {
    rules,
    europeanCup: competition,
    europeanCupState,
    dynamicSchedules
  };
}

/**
 * Inserts continental calendar events into an existing calendar starting from baseOffset.
 */
export function insertEuropeanEventsIntoCalendar(baseCalendar, dynamicSchedules, baseOffset = 0) {
  const nextCal = [...(baseCalendar || [])];
  const sortedSlots = [...(dynamicSchedules || [])].sort((a, b) => b.offset - a.offset);

  sortedSlots.forEach(slot => {
    if (slot.stage !== 'final') {
      const targetIdx = Math.min(nextCal.length, Math.max(baseOffset, baseOffset + (slot.offset || 0)));
      nextCal.splice(targetIdx, 0, { type: 'europe', stage: slot.stage, matchday: slot.matchday });
    }
  });
  sortedSlots.forEach(slot => {
    if (slot.stage === 'final') {
      nextCal.push({ type: 'europe', stage: slot.stage, matchday: slot.matchday });
    }
  });

  return nextCal;
}

/**
 * Evaluates a 2-leg Home/Away tie with pre-2021 away goals or penalties.
 */
export function resolveTwoLegTie({
  playerTeamId,
  leg1HomeId,
  leg1HomeScore,
  leg1AwayScore,
  leg2HomeId,
  leg2HomeScore,
  leg2AwayScore,
  leg2PenHome = null,
  leg2PenAway = null,
  seasonStr = '2001',
  isSA = false
}) {
  const isPlayerHomeLeg1 = leg1HomeId === playerTeamId;
  const isPlayerHomeLeg2 = leg2HomeId === playerTeamId;

  const playerLeg1Goals = isPlayerHomeLeg1 ? (leg1HomeScore || 0) : (leg1AwayScore || 0);
  const oppLeg1Goals = isPlayerHomeLeg1 ? (leg1AwayScore || 0) : (leg1HomeScore || 0);
  const playerLeg2Goals = isPlayerHomeLeg2 ? (leg2HomeScore || 0) : (leg2AwayScore || 0);
  const oppLeg2Goals = isPlayerHomeLeg2 ? (leg2AwayScore || 0) : (leg2HomeScore || 0);

  const playerAgg = playerLeg1Goals + playerLeg2Goals;
  const oppAgg = oppLeg1Goals + oppLeg2Goals;

  const playerAwayGoals = (!isPlayerHomeLeg1 ? leg1AwayScore || 0 : 0) + (!isPlayerHomeLeg2 ? leg2AwayScore || 0 : 0);
  const oppAwayGoals = (isPlayerHomeLeg1 ? leg1AwayScore || 0 : 0) + (isPlayerHomeLeg2 ? leg2AwayScore || 0 : 0);

  const seasonShort = parseInt(String(seasonStr || '2001').split('/')[0], 10) || 2001;
  const useAwayGoals = seasonShort < 2021 && !isSA;

  if (playerAgg !== oppAgg) {
    return {
      playerWon: playerAgg > oppAgg,
      playerAgg,
      oppAgg,
      playerAwayGoals,
      oppAwayGoals,
      needsET: false,
      decidedBy: 'aggregate'
    };
  }

  if (useAwayGoals && playerAwayGoals !== oppAwayGoals) {
    return {
      playerWon: playerAwayGoals > oppAwayGoals,
      playerAgg,
      oppAgg,
      playerAwayGoals,
      oppAwayGoals,
      needsET: false,
      decidedBy: 'away_goals'
    };
  }

  if (leg2PenHome !== null && leg2PenAway !== null && leg2PenHome !== leg2PenAway) {
    const pPen = isPlayerHomeLeg2 ? leg2PenHome : leg2PenAway;
    const oPen = isPlayerHomeLeg2 ? leg2PenAway : leg2PenHome;
    return {
      playerWon: pPen > oPen,
      playerAgg,
      oppAgg,
      playerAwayGoals,
      oppAwayGoals,
      needsET: false,
      decidedBy: 'penalties',
      playerPen: pPen,
      oppPen: oPen
    };
  }

  return {
    playerWon: false,
    playerAgg,
    oppAgg,
    playerAwayGoals,
    oppAwayGoals,
    needsET: true,
    decidedBy: 'tied'
  };
}

export function getQualifierCompetitionTitle(competition, seasonStr = '2001') {
  const yr = parseInt(String(seasonStr || '2001').split('/')[0], 10) || 2001;
  if (competition === 'cl') return yr >= 1992 ? 'UEFA CHAMPIONS LEAGUE' : 'EUROPEAN CUP';
  if (competition === 'uefa') return yr >= 2009 ? 'UEFA EUROPA LEAGUE' : 'UEFA CUP';
  return 'UEFA CONFERENCE LEAGUE';
}
