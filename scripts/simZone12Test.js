/**
 * 12-Box Skills Match Engine Simulation & Realism Benchmark
 * Runs N full 90-minute matches using the real Zone 12 engine, tactical engine,
 * foul engine, and 2001 season rosters directly from src/.
 *
 * Usage:
 *   node football-app/scripts/simZone12Test.js [matchesPerScenario=50]
 */

const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const APP_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(APP_ROOT, 'src');

// Minimal browser globals needed by src modules
const memoryStorage = new Map();
global.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear()
};
global.window = { localStorage: global.localStorage };

// Stub non-JS assets
['.css', '.png', '.jpg', '.jpeg', '.svg', '.webp'].forEach((ext) => {
  require.extensions[ext] = (m) => {
    m.exports = {};
  };
});

// Transpile ES modules / JSX inside src/ on the fly via @babel/core
const defaultJsLoader = require.extensions['.js'];
require.extensions['.js'] = function babelCjsHook(module, filename) {
  if (!filename.startsWith(SRC_ROOT)) {
    return defaultJsLoader(module, filename);
  }
  const source = fs.readFileSync(filename, 'utf8');
  const transformed = babel.transformSync(source, {
    filename,
    presets: [
      [require.resolve('@babel/preset-react', { paths: [APP_ROOT] }), { runtime: 'classic' }]
    ],
    plugins: [
      require.resolve('@babel/plugin-transform-modules-commonjs', { paths: [APP_ROOT] })
    ],
    babelrc: false,
    configFile: false,
    compact: false
  });
  return module._compile(transformed.code, filename);
};

// Load real game modules
const {
  simulateZone12Possession,
  resolveZone12PenaltyKick
} = require(path.join(SRC_ROOT, 'utils', 'zone12MatchEngine.js'));
const {
  computeCPUTacticalPlan,
  calculateTeamTacticalStats,
  getDefaultInstructionForSlot
} = require(path.join(SRC_ROOT, 'utils', 'tacticalRoleEngine.js'));
const { resolveFoulCheck } = require(path.join(SRC_ROOT, 'utils', 'matchEngine.js'));
const { generateCPULineup } = require(path.join(SRC_ROOT, 'utils', 'cpuSquadManager.js'));
const { getFormationSlots, getIdealSlotPosition } = require(path.join(SRC_ROOT, 'components', 'FormationTactics.js'));

const ROSTERS_2001 = JSON.parse(
  fs.readFileSync(path.join(APP_ROOT, 'public', 'data', 'rosters', 'rosters2001.json'), 'utf8')
);

function buildDefaultInstructions(lineup, formation, roles = {}) {
  const slots = getFormationSlots(formation);
  const instructions = {};
  for (const slot of slots) {
    const p = lineup[slot.id];
    if (!p) continue;
    instructions[slot.id] = getDefaultInstructionForSlot(slot, p, roles[slot.id] || 'normal');
  }
  return instructions;
}

function buildTeamSetup(teamName, formation = '4-4-2', fixedMentality = null, removedPositions = []) {
  const squad = ROSTERS_2001[teamName];
  if (!squad || !Array.isArray(squad) || squad.length < 11) {
    throw new Error(`Roster not found or incomplete for "${teamName}"`);
  }
  // Disable random rotation so benchmarks are consistent against true first XI
  const { lineup } = generateCPULineup(squad, formation, { isCup: false, allowRotation: false });
  const slots = getFormationSlots(formation).map((s) => ({
    ...s,
    idealPos: getIdealSlotPosition(s.role, s.x, s.y)
  }));
  const removedList = [...removedPositions];
  for (const pos of removedList) {
    const matchSlot = slots.find((s) => s.idealPos === pos && lineup[s.id]);
    if (matchSlot) lineup[matchSlot.id] = null;
  }

  const baseStats = calculateTeamTacticalStats(lineup, formation, {}, 'balanced');
  const teamObj = {
    name: teamName,
    attack: baseStats.attack,
    midfield: baseStats.midfield,
    defense: baseStats.defense
  };
  const initialPlan = computeCPUTacticalPlan({
    lineup,
    formationKey: formation,
    selfTeam: teamObj,
    oppTeam: null,
    oppLineup: null,
    oppFormation: '4-4-2',
    scoreSelf: 0,
    scoreOpp: 0,
    currentMatchTime: 0,
    isHomeSide: true
  });
  const instructions = buildDefaultInstructions(lineup, formation, initialPlan.roles);

  return {
    name: teamName,
    formation,
    slots,
    lineup,
    teamObj,
    instructions,
    fixedMentality,
    activeCount: Object.values(lineup).filter(Boolean).length
  };
}

function evaluateSimFoul({ side, rawRoll, isPressing, cards, teamRedCards, matchRedCards, offenderPlayer, offenderSlotId, lineup }) {
  const check = resolveFoulCheck({
    rawRoll,
    sides: 10,
    isPressing,
    refereeStrictness: 'normal',
    teamRedCards,
    matchRedCards,
    foulFrequencyScale: 0.55
  });
  if (!check.foul) return null;

  const hasSlot = Boolean(offenderPlayer?.name && offenderSlotId && lineup?.[offenderSlotId]);
  const playerName = offenderPlayer?.name || 'Player';
  const priorYellows = hasSlot
    ? cards.filter((c) => c.side === side && c.playerName === playerName && c.type === 'yellow').length
    : 0;

  const softenExtremeRed =
    check.outcome === 'yellow' &&
    priorYellows >= 1 &&
    (teamRedCards >= 1 || matchRedCards >= 1) &&
    Math.random() < (teamRedCards >= 1 ? 0.85 : 0.65);

  if (check.outcome === 'warning' || softenExtremeRed) {
    return { foul: true, outcome: 'warning', cardEntry: null };
  }

  const cardType = check.outcome === 'red' ? 'red' : priorYellows >= 1 ? 'second_yellow' : 'yellow';
  const cardEntry = {
    side,
    playerName,
    slotId: hasSlot ? offenderSlotId : null,
    type: cardType
  };
  cards.push(cardEntry);

  if ((cardType === 'red' || cardType === 'second_yellow') && hasSlot && lineup[offenderSlotId]) {
    lineup[offenderSlotId] = null;
  }

  return { foul: true, outcome: cardType, cardEntry };
}

function simulateFullZone12Match(homeCfg, awayCfg) {
  const homeLineup = { ...homeCfg.lineup };
  const awayLineup = { ...awayCfg.lineup };

  let homePlan = computeCPUTacticalPlan({
    lineup: homeLineup,
    formationKey: homeCfg.formation,
    selfTeam: homeCfg.teamObj,
    oppTeam: awayCfg.teamObj,
    oppLineup: awayLineup,
    oppFormation: awayCfg.formation,
    scoreSelf: 0,
    scoreOpp: 0,
    currentMatchTime: 0,
    isHomeSide: true
  });
  let awayPlan = computeCPUTacticalPlan({
    lineup: awayLineup,
    formationKey: awayCfg.formation,
    selfTeam: awayCfg.teamObj,
    oppTeam: homeCfg.teamObj,
    oppLineup: homeLineup,
    oppFormation: homeCfg.formation,
    scoreSelf: 0,
    scoreOpp: 0,
    currentMatchTime: 0,
    isHomeSide: false
  });

  let homeTactic = homeCfg.fixedMentality || homePlan.mentality;
  let awayTactic = awayCfg.fixedMentality || awayPlan.mentality;
  const homeRoles = homePlan.roles;
  const awayRoles = awayPlan.roles;

  let homeScore = 0;
  let awayScore = 0;
  let minute = 0;
  let nextAttacker = null;
  let isKickoffRestart = true;
  let recycleState = null;
  const cards = [];

  const stats = {
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0,
    homeOnTarget: 0,
    awayOnTarget: 0,
    step1Attempts: 0,
    step1Success: 0,
    step1Counters: 0,
    step2Attempts: 0,
    step2Success: 0,
    step3Attempts: 0,
    step3Success: 0,
    throughBallAttempts: 0,
    throughBallSuccess: 0,
    throughBallGoals: 0,
    longShotAttempts: 0,
    longShotGoals: 0,
    penaltiesAwarded: 0,
    penaltyGoals: 0
  };

  const countSideReds = (s) => cards.filter((c) => c.side === s && (c.type === 'red' || c.type === 'second_yellow')).length;
  const countAllReds = () => cards.filter((c) => c.type === 'red' || c.type === 'second_yellow').length;

  const refreshTactics = (currMin) => {
    if (!homeCfg.fixedMentality) {
      homePlan = computeCPUTacticalPlan({
        lineup: homeLineup,
        formationKey: homeCfg.formation,
        selfTeam: homeCfg.teamObj,
        oppTeam: awayCfg.teamObj,
        oppLineup: awayLineup,
        oppFormation: awayCfg.formation,
        scoreSelf: homeScore,
        scoreOpp: awayScore,
        currentMatchTime: currMin,
        isHomeSide: true
      });
      homeTactic = homePlan.mentality;
    }
    if (!awayCfg.fixedMentality) {
      awayPlan = computeCPUTacticalPlan({
        lineup: awayLineup,
        formationKey: awayCfg.formation,
        selfTeam: awayCfg.teamObj,
        oppTeam: homeCfg.teamObj,
        oppLineup: homeLineup,
        oppFormation: homeCfg.formation,
        scoreSelf: awayScore,
        scoreOpp: homeScore,
        currentMatchTime: currMin,
        isHomeSide: false
      });
      awayTactic = awayPlan.mentality;
    }
  };

  while (minute < 90) {
    const prevMinute = minute;
    const isFirstHalf = prevMinute < 45;
    const nextMinute = isFirstHalf ? Math.min(45, prevMinute + 2) : Math.min(90, prevMinute + 2);
    const maxMin = isFirstHalf ? 45 : 90;
    const isMilestoneStop = (isFirstHalf && nextMinute >= 45) || (!isFirstHalf && nextMinute >= 90);
    minute = nextMinute;

    const zoneRes = simulateZone12Possession({
      homeLineup,
      awayLineup,
      homeRoles,
      awayRoles,
      homeInstructions: homeCfg.instructions,
      awayInstructions: awayCfg.instructions,
      homeFormation: homeCfg.formation,
      awayFormation: awayCfg.formation,
      homeTactic,
      awayTactic,
      homeTeam: homeCfg.teamObj,
      awayTeam: awayCfg.teamObj,
      minute: Math.max(1, minute),
      maxMinute: maxMin,
      preferredAttacker: nextAttacker,
      isKickoffRestart,
      recycleState: isKickoffRestart ? null : recycleState
    });

    const step1 = zoneRes.steps?.[0] || null;
    const s1Side = zoneRes.step1Side || zoneRes.attackingSide;
    const s1DefSide = s1Side === 'home' ? 'away' : 'home';

    if (!isMilestoneStop && step1) {
      stats.step1Attempts += 1;
      if (step1.success) stats.step1Success += 1;
      if (step1.counterTriggered) stats.step1Counters += 1;
      if ((step1.phase || '').includes('THROUGH-BALL')) {
        stats.throughBallAttempts += 1;
        if (step1.success) stats.throughBallSuccess += 1;
      }

      evaluateSimFoul({
        side: s1Side,
        rawRoll: step1.attackerDie,
        isPressing: (s1Side === 'home' ? homeTactic : awayTactic) === 'attack',
        cards,
        teamRedCards: countSideReds(s1Side),
        matchRedCards: countAllReds(),
        offenderPlayer: step1.attackerPlayer,
        offenderSlotId: step1.attackerSlotId,
        lineup: s1Side === 'home' ? homeLineup : awayLineup
      });
      evaluateSimFoul({
        side: s1DefSide,
        rawRoll: step1.defenderDie,
        isPressing: (s1DefSide === 'home' ? homeTactic : awayTactic) === 'attack',
        cards,
        teamRedCards: countSideReds(s1DefSide),
        matchRedCards: countAllReds(),
        offenderPlayer: step1.defenderPlayer,
        offenderSlotId: step1.defenderSlotId,
        lineup: s1DefSide === 'home' ? homeLineup : awayLineup
      });
    }

    if (!step1 || (!step1.success && !step1.counterTriggered) || isMilestoneStop) {
      if (nextMinute === 45 && prevMinute < 45) {
        nextAttacker = null;
        recycleState = null;
        isKickoffRestart = true;
      } else {
        nextAttacker = isMilestoneStop ? null : (zoneRes.nextAttacker || s1DefSide);
        recycleState = isMilestoneStop ? null : (zoneRes.nextRecycleState || null);
        isKickoffRestart = false;
      }
      continue;
    }
    recycleState = null;

    // Step 2
    const attSide = zoneRes.attackingSide;
    const defSide = attSide === 'home' ? 'away' : 'home';
    const attLineup = attSide === 'home' ? homeLineup : awayLineup;
    const defLineup = defSide === 'home' ? homeLineup : awayLineup;
    const attPress = (attSide === 'home' ? homeTactic : awayTactic) === 'attack';
    const defPress = (defSide === 'home' ? homeTactic : awayTactic) === 'attack';

    const step2 = zoneRes.steps?.[1] || null;
    const isStep2TB = Boolean(step2 && (step2.phase || '').includes('THROUGH-BALL'));
    const isStep2LS = Boolean(step2 && (step2.attackerSkillName === 'Long Shots' || (step2.phase || '').includes('LONG SHOT')));
    if (step2) {
      stats.step2Attempts += 1;
      if (step2.success) stats.step2Success += 1;
      if (isStep2TB) {
        stats.throughBallAttempts += 1;
        if (step2.success) stats.throughBallSuccess += 1;
      }
      if (isStep2LS) {
        stats.longShotAttempts += 1;
      }

      evaluateSimFoul({
        side: attSide,
        rawRoll: step2.attackerDie,
        isPressing: attPress,
        cards,
        teamRedCards: countSideReds(attSide),
        matchRedCards: countAllReds(),
        offenderPlayer: step2.attackerPlayer,
        offenderSlotId: step2.attackerSlotId,
        lineup: attLineup
      });
      evaluateSimFoul({
        side: defSide,
        rawRoll: step2.defenderDie,
        isPressing: defPress,
        cards,
        teamRedCards: countSideReds(defSide),
        matchRedCards: countAllReds(),
        offenderPlayer: step2.defenderPlayer,
        offenderSlotId: step2.defenderSlotId,
        lineup: defLineup
      });
    }

    if (zoneRes.isShot) {
      if (attSide === 'home') stats.homeShots += 1;
      else stats.awayShots += 1;
    }
    if (zoneRes.isOnTarget) {
      if (attSide === 'home') stats.homeOnTarget += 1;
      else stats.awayOnTarget += 1;
    }

    // Did it end at Step 2 (either turnover/save or direct Long Shot goal)?
    if (!step2 || !step2.success || zoneRes.steps.length < 3) {
      if (zoneRes.isGoal) {
        if (attSide === 'home') homeScore += 1;
        else awayScore += 1;
        if (isStep2LS) stats.longShotGoals += 1;
        nextAttacker = defSide;
        isKickoffRestart = true;
        refreshTactics(minute);
      } else {
        nextAttacker = zoneRes.nextAttacker || defSide;
        isKickoffRestart = false;
      }
      continue;
    }

    // Step 3
    const step3 = zoneRes.steps[2];
    stats.step3Attempts += 1;
    if (step3.success) stats.step3Success += 1;

    evaluateSimFoul({
      side: attSide,
      rawRoll: step3.attackerDie,
      isPressing: attPress,
      cards,
      teamRedCards: countSideReds(attSide),
      matchRedCards: countAllReds(),
      offenderPlayer: step3.attackerPlayer,
      offenderSlotId: step3.attackerSlotId,
      lineup: attLineup
    });
    const defFoul = evaluateSimFoul({
      side: defSide,
      rawRoll: step3.defenderDie,
      isPressing: defPress,
      cards,
      teamRedCards: countSideReds(defSide),
      matchRedCards: countAllReds(),
      offenderPlayer: step3.defenderPlayer,
      offenderSlotId: step3.defenderSlotId,
      lineup: defLineup
    });

    if (zoneRes.isGoal) {
      if (attSide === 'home') homeScore += 1;
      else awayScore += 1;
      if ((step3.phase || '').includes('THROUGH-BALL') || isStep2TB) stats.throughBallGoals += 1;
      nextAttacker = defSide;
      isKickoffRestart = true;
      refreshTactics(minute);
      continue;
    }

    if (defFoul) {
      stats.penaltiesAwarded += 1;
      const taker = attSide === 'home' ? zoneRes.homePenaltyTaker : zoneRes.awayPenaltyTaker;
      const gk = attSide === 'home' ? zoneRes.awayGk : zoneRes.homeGk;
      const penRes = resolveZone12PenaltyKick({
        attackingSide: attSide,
        zone: step3.zone || (attSide === 'home' ? 'd2' : 'a2'),
        taker,
        gk,
        attTeamName: attSide === 'home' ? homeCfg.name : awayCfg.name,
        defTeamName: defSide === 'home' ? homeCfg.name : awayCfg.name,
        minute
      });
      if (attSide === 'home') {
        stats.homeShots += 1;
        if (penRes.step?.success) stats.homeOnTarget += 1;
      } else {
        stats.awayShots += 1;
        if (penRes.step?.success) stats.awayOnTarget += 1;
      }
      if (penRes.isGoal) {
        stats.penaltyGoals += 1;
        if (attSide === 'home') homeScore += 1;
        else awayScore += 1;
        nextAttacker = defSide;
        isKickoffRestart = true;
        refreshTactics(minute);
        continue;
      }
    }

    nextAttacker = zoneRes.nextAttacker || defSide;
    isKickoffRestart = false;
  }

  stats.homeGoals = homeScore;
  stats.awayGoals = awayScore;
  stats.yellows = cards.filter((c) => c.type === 'yellow').length;
  stats.directReds = cards.filter((c) => c.type === 'red').length;
  stats.secondYellowReds = cards.filter((c) => c.type === 'second_yellow').length;
  stats.totalReds = stats.directReds + stats.secondYellowReds;
  return stats;
}

function runScenario(title, homeCfg, awayCfg, matchCount) {
  const totals = {
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    homeGoals: 0,
    awayGoals: 0,
    cleanSheets: 0,
    fourPlusTeamGoals: 0,
    homeShots: 0,
    awayShots: 0,
    homeOnTarget: 0,
    awayOnTarget: 0,
    step1Attempts: 0,
    step1Success: 0,
    step1Counters: 0,
    step2Attempts: 0,
    step2Success: 0,
    step3Attempts: 0,
    step3Success: 0,
    throughBallAttempts: 0,
    throughBallSuccess: 0,
    throughBallGoals: 0,
    longShotAttempts: 0,
    longShotGoals: 0,
    penaltiesAwarded: 0,
    penaltyGoals: 0,
    yellows: 0,
    directReds: 0,
    secondYellowReds: 0,
    totalReds: 0
  };
  const scoreSamples = [];

  for (let i = 0; i < matchCount; i++) {
    const res = simulateFullZone12Match(homeCfg, awayCfg);
    if (res.homeGoals > res.awayGoals) totals.homeWins += 1;
    else if (res.homeGoals < res.awayGoals) totals.awayWins += 1;
    else totals.draws += 1;

    if (res.homeGoals === 0 || res.awayGoals === 0) totals.cleanSheets += 1;
    if (res.homeGoals >= 4 || res.awayGoals >= 4) totals.fourPlusTeamGoals += 1;
    if (i < 10) scoreSamples.push(`${res.homeGoals}-${res.awayGoals}`);

    for (const k of Object.keys(res)) {
      if (totals[k] !== undefined) totals[k] += res[k];
    }
  }

  const pct = (n, d) => (d > 0 ? ((n / d) * 100).toFixed(1) : '0.0');
  const avg = (n) => (n / matchCount).toFixed(2);
  const totalGoals = totals.homeGoals + totals.awayGoals;

  console.log(`\n=== ${title} (${matchCount} matches) ===`);
  console.log(
    `Teams: ${homeCfg.name} [${homeCfg.formation}, ${homeCfg.activeCount} men, ATT:${homeCfg.teamObj.attack} MID:${homeCfg.teamObj.midfield} DEF:${homeCfg.teamObj.defense}, ${homeCfg.fixedMentality || 'AI'}]` +
    ` vs ${awayCfg.name} [${awayCfg.formation}, ${awayCfg.activeCount} men, ATT:${awayCfg.teamObj.attack} MID:${awayCfg.teamObj.midfield} DEF:${awayCfg.teamObj.defense}, ${awayCfg.fixedMentality || 'AI'}]`
  );
  console.log(`Results (H/D/A): ${totals.homeWins}W / ${totals.draws}D / ${totals.awayWins}L | Sample scores: ${scoreSamples.join(', ')}`);
  console.log(`Goals / match  : Total ${avg(totalGoals)} (${homeCfg.name} ${avg(totals.homeGoals)} - ${avg(totals.awayGoals)} ${awayCfg.name}) | CleanSheet: ${pct(totals.cleanSheets, matchCount)}% | 4+ Goals by a side: ${pct(totals.fourPlusTeamGoals, matchCount)}%`);
  console.log(`Shots / match  : ${homeCfg.name} ${avg(totals.homeShots)} (${avg(totals.homeOnTarget)} OT) | ${awayCfg.name} ${avg(totals.awayShots)} (${avg(totals.awayOnTarget)} OT)`);
  console.log(
    `Steps / match  : S1 ${avg(totals.step1Attempts)} att (${pct(totals.step1Success, totals.step1Attempts)}% pass, ${pct(totals.step1Counters, totals.step1Attempts)}% counter)` +
    ` -> S2 ${avg(totals.step2Attempts)} att (${pct(totals.step2Success, totals.step2Attempts)}% pass)` +
    ` -> S3 ${avg(totals.step3Attempts)} att (${pct(totals.step3Success, totals.step3Attempts)}% goal)`
  );
  console.log(`Through Balls  : ${avg(totals.throughBallAttempts)} att/match (${pct(totals.throughBallSuccess, totals.throughBallAttempts)}% success) -> ${avg(totals.throughBallGoals)} goals/match (${pct(totals.throughBallGoals, totalGoals)}% of all goals)`);
  console.log(`Long Shots     : ${avg(totals.longShotAttempts)} att/match -> ${avg(totals.longShotGoals)} goals/match`);
  console.log(`Discipline/Pen : Yellows ${avg(totals.yellows)}/match | Reds ${avg(totals.totalReds)}/match (direct ${totals.directReds}, 2nd-Y ${totals.secondYellowReds}) | Pens ${avg(totals.penaltiesAwarded)}/match (${totals.penaltyGoals}/${totals.penaltiesAwarded} scored)`);

  return totals;
}

function main() {
  const matchCount = Math.max(5, parseInt(process.argv[2] || '50', 10) || 50);
  const t0 = Date.now();

  const liverpool442 = buildTeamSetup('Liverpool', '4-4-2');
  const arsenal442 = buildTeamSetup('Arsenal', '4-4-2');
  const everton442 = buildTeamSetup('Everton', '4-4-2');
  const fulham442 = buildTeamSetup('Fulham', '4-4-2');
  const realMadrid4231 = buildTeamSetup('Real Madrid', '4-2-3-1');
  const ipswich442 = buildTeamSetup('Ipswich Town', '4-4-2');
  const derby442 = buildTeamSetup('Derby County', '4-4-2');

  const ipswichDef = buildTeamSetup('Ipswich Town', '4-4-2', 'defense');
  const liverpoolAtt = buildTeamSetup('Liverpool', '4-4-2', 'attack');
  const ipswich9MenDef = buildTeamSetup('Ipswich Town', '4-4-2', 'defense', ['DC', 'MC']);

  const amcSlot = realMadrid4231.slots.find((s) => s.idealPos === 'AMC');
  const amcInfo = amcSlot
    ? `${realMadrid4231.lineup[amcSlot.id]?.name || 'None'} (${amcSlot.id}: ${realMadrid4231.instructions[amcSlot.id] || 'n/a'})`
    : 'No AMC slot';

  console.log(`Zone 12 Match Engine Benchmark (Real 2001 Rosters, ${matchCount} matches/scenario)`);
  console.log(`Real Madrid AMC slot: ${amcInfo}`);

  runScenario('1. Strong vs Weak (Dynamic AI)', liverpool442, ipswich442, matchCount);
  runScenario('2. Top Clash / Even Teams (Dynamic AI)', arsenal442, liverpool442, matchCount);
  runScenario('3. Mid-Table Clash / Even Teams (Dynamic AI)', everton442, fulham442, matchCount);
  runScenario('4. Elite AMC 4-2-3-1 vs Weak 4-4-2 (Dynamic AI)', realMadrid4231, derby442, matchCount);
  runScenario('5. Locked Defensive (Ipswich) vs Attacking (Liverpool)', ipswichDef, liverpoolAtt, matchCount);
  runScenario('6. Real 9-Men Defensive (DC+MC out) vs 11-Men Attacking', ipswich9MenDef, liverpoolAtt, matchCount);

  console.log(`\nCompleted in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
}

main();
