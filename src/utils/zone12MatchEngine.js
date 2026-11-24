import { getFormationSlots, getIdealSlotPosition } from '../components/FormationTactics';
import { getDefaultInstructionForSlot } from './tacticalRoleEngine';

/**
 * ==============================================================================
 * 12-BOX TACTICAL SKILLS MATCH ENGINE (zone12MatchEngine.js)
 * ==============================================================================
 * Pitch Layout (4 columns x 3 vertical lanes = 12 boxes):
 *
 *   +------------+------------+------------+------------+
 *   |     a1     |     b1     |     c1     |     d1     |  <- Top / Left Wing (Home)
 *   +------------+------------+------------+------------+
 *   |     a2     |     b2     |     c2     |     d2     |  <- Center (Box / Midfield / Box)
 *   +------------+------------+------------+------------+
 *   |     a3     |     b3     |     c3     |     d3     |  <- Bottom / Right Wing (Home)
 *   +------------+------------+------------+------------+
 *      Home Def     Home Mid     Away Mid     Away Def
 *
 * Home attacks Left -> Right (b2 -> c1/c2/c3 -> d1/d2/d3).
 * Away attacks Right -> Left (c2 -> b1/b2/b3 -> a1/a2/a3).
 * ==============================================================================
 */

export const ENGINE_MODE_ZONES_12 = 'zones12';

export const ZONE_GRID_12 = [
  ['a1', 'b1', 'c1', 'd1'],
  ['a2', 'b2', 'c2', 'd2'],
  ['a3', 'b3', 'c3', 'd3']
];

export const ZONE_LABELS_12 = {
  a1: 'A1 (Home Left Def)',
  a2: 'A2 (Home Box / GK)',
  a3: 'A3 (Home Right Def)',
  b1: 'B1 (Home Left Mid)',
  b2: 'B2 (Home Center Mid)',
  b3: 'B3 (Home Right Mid)',
  c1: 'C1 (Away Right / Home Left Att)',
  c2: 'C2 (Central Attacking Mid)',
  c3: 'C3 (Away Left / Home Right Att)',
  d1: 'D1 (Away Right Def)',
  d2: 'D2 (Away Box / GK)',
  d3: 'D3 (Away Left Def)'
};

function rollD10() {
  return Math.floor(Math.random() * 10) + 1;
}

function clamp10(v) {
  return Math.max(1, Math.min(10, Math.round(Number(v) || 5)));
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmtBonus(b) {
  if (!b) return '';
  return b > 0 ? `+${b}` : `${b}`;
}

/**
 * Returns the 9 core 1-10 skills for any player.
 * Uses extracted DB `player.skills` when present (e.g. 2001/02 season),
 * or derives position-accurate fallback skills from `player.rating` + `player.position`.
 */
export function getPlayerSkills(player) {
  if (!player) {
    return {
      passing: 5, marking: 5, tackling: 5, dribbling: 5,
      crossing: 5, heading: 5, finishing: 5, longShots: 5, handling: 5
    };
  }
  const r = clamp10(player.rating || 6);
  const pos = String(player.position || 'MC').toUpperCase();
  const isGK = pos === 'GK';
  const isDF = ['DC', 'DL', 'DR', 'SW', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos);
  const isWide = ['DL', 'DR', 'LWB', 'RWB', 'ML', 'MR', 'AML', 'AMR', 'LW', 'RW', 'FL', 'FR'].includes(pos);
  const isFW = ['ST', 'CF', 'SC', 'LW', 'RW', 'FL', 'FR'].includes(pos);
  const isAMC = ['AMC', 'AML', 'AMR'].includes(pos);
  const isDMC = pos === 'DMC' || pos === 'DM';

  // Apply condition fatigue modifier softly if player is exhausted (< 65%)
  const cond = typeof player.condition === 'number' ? player.condition : 100;
  const fatiguePenalty = cond < 55 ? -2 : (cond < 72 ? -1 : 0);
  const adj = (val) => clamp10(val + fatiguePenalty);

  if (player.skills && typeof player.skills === 'object') {
    const s = player.skills;
    return {
      passing: adj(s.passing ?? r),
      marking: adj(s.marking ?? r),
      tackling: adj(s.tackling ?? r),
      dribbling: adj(s.dribbling ?? r),
      crossing: adj(s.crossing ?? r),
      heading: adj(s.heading ?? r),
      finishing: adj(s.finishing ?? r),
      longShots: adj(s.longShots ?? r),
      handling: adj(s.handling ?? (isGK ? r : 1))
    };
  }

  return {
    passing: adj(isGK ? r - 3 : (isDF ? r - 1 : r)),
    marking: adj(isDF || isDMC ? r : (isFW ? r - 4 : r - 2)),
    tackling: adj(isDF || isDMC ? r : (isFW ? r - 4 : r - 1)),
    dribbling: adj(isFW || isWide || isAMC ? r : (isDF ? r - 3 : r - 1)),
    crossing: adj(isWide ? r : (isDF || isGK ? r - 3 : r - 2)),
    heading: adj(pos === 'DC' || pos === 'ST' || pos === 'CF' ? r : r - 2),
    finishing: adj(isFW ? r : (isAMC ? r - 1 : (isDF ? r - 4 : r - 2))),
    longShots: adj(isAMC || pos === 'MC' || isFW ? r - 1 : r - 3),
    handling: adj(isGK ? r : 1)
  };
}

/**
 * Classifies a player's effective role ('attack', 'support', 'defend', 'normal')
 * from the active tactical roles map (`playerRoles[slotId]`).
 */
export function resolvePlayerDuty(slotId, player, rolesMap = {}) {
  const rawRole = String(rolesMap?.[slotId] || '').toLowerCase();
  if (
    rawRole.includes('attack') ||
    rawRole.includes('att') ||
    rawRole === 'winger_att' ||
    rawRole === 'inside_forward' ||
    rawRole === 'poacher' ||
    rawRole === 'advanced_playmaker_att'
  ) {
    return 'attack';
  }
  if (
    rawRole.includes('def') ||
    rawRole === 'anchor' ||
    rawRole === 'destroyer' ||
    rawRole === 'stay_back'
  ) {
    return 'defend';
  }
  if (
    rawRole.includes('support') ||
    rawRole.includes('wing_back') ||
    rawRole.includes('box_to_box') ||
    rawRole.includes('playmaker')
  ) {
    return 'support';
  }
  // Default duty by position
  const pos = String(player?.position || slotId || 'MC').toUpperCase();
  if (['AML', 'AMR', 'LW', 'RW', 'FL', 'FR', 'ST', 'CF'].some(p => pos.includes(p))) {
    return 'support';
  }
  return 'normal';
}

/**
 * Organizes a team's active lineup into functional tactical groups and maps them to the 12 boxes.
 * `side`: 'home' (attacks a -> d) or 'away' (attacks d -> a)
 */
export function buildTeamZoneRoster(
  lineupObj = {},
  rolesMap = {},
  side = 'home',
  fallbackTeam = {},
  formationKey = '4-4-2',
  instructionsMap = {}
) {
  const slots = getFormationSlots(formationKey || '4-4-2');
  const slotMap = {};
  slots.forEach(s => {
    const ideal = getIdealSlotPosition(s.role, s.x, s.y);
    slotMap[s.id] = { ...s, idealPos: ideal, label: ideal };
  });

  const KNOWN_POS = new Set(['GK', 'DL', 'DC', 'DR', 'SW', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'WBL', 'WBR', 'DMC', 'DM', 'ML', 'MC', 'MR', 'LM', 'CM', 'RM', 'AML', 'AMC', 'AMR', 'AM', 'LW', 'RW', 'FL', 'FR', 'ST', 'CF', 'SC', 'FW']);
  const entries = Object.entries(lineupObj || {}).filter(([, p]) => Boolean(p));

  const players = entries.map(([slotId, p]) => {
    const slotInfo = slotMap[slotId];
    const mappedIdeal = slotInfo?.idealPos;
    const cleanSlot = String(slotId || '').toUpperCase().replace(/[-_]?[0-9]+$/, '').trim();
    const fallbackSlotPos = KNOWN_POS.has(cleanSlot) ? cleanSlot : '';
    const playerPos = String(p.position || 'MC').toUpperCase();
    const effectivePos = (mappedIdeal || fallbackSlotPos || playerPos).toUpperCase();
    const rawRoleId = rolesMap?.[slotId] || 'normal';
    const duty = resolvePlayerDuty(slotId, p, rolesMap);
    const skills = getPlayerSkills(p);
    const defaultInstr = slotInfo
      ? getDefaultInstructionForSlot(slotInfo, p, rawRoleId)
      : (effectivePos === 'GK' ? 'short' : 'pass');
    const instruction = instructionsMap?.[slotId] || p.instruction || defaultInstr;

    return {
      ...p,
      slotId,
      slotPos: effectivePos,
      effectivePos,
      rawRoleId,
      duty,
      instruction,
      skills
    };
  });

  // Fallback synthetic 11 if lineupObj is empty
  if (players.length === 0) {
    const baseR = clamp10(fallbackTeam?.midfield || 6);
    const defaultSlots = ['GK', 'DL', 'DC1', 'DC2', 'DR', 'ML', 'MC1', 'MC2', 'MR', 'ST1', 'ST2'];
    defaultSlots.forEach((s, i) => {
      const cleanPos = s.replace(/[0-9]/g, '');
      const dummy = {
        name: `${fallbackTeam?.name || (side === 'home' ? 'Home' : 'Away')} #${i + 1}`,
        position: cleanPos,
        rating: baseR
      };
      players.push({
        ...dummy,
        slotId: s,
        slotPos: cleanPos,
        effectivePos: cleanPos,
        rawRoleId: 'normal',
        duty: 'normal',
        instruction: cleanPos === 'GK' ? 'short' : (['ML', 'MR'].includes(cleanPos) ? 'high_cross' : 'pass'),
        skills: getPlayerSkills(dummy)
      });
    });
  }

  const gk = players.find(p => p.effectivePos === 'GK' || String(p.position || '').toUpperCase() === 'GK') || players[0];
  // Strictly exclude GK from all outfield boxes & duels (GK stays only in a2/d2)
  const outfield = players.filter(p => p !== gk && p.effectivePos !== 'GK' && String(p.position || '').toUpperCase() !== 'GK');
  const nonGkPool = outfield.length > 0 ? outfield : players;

  const dcs = nonGkPool.filter(p => ['DC', 'CB', 'SW'].includes(p.effectivePos));
  const dl = nonGkPool.find(p => ['DL', 'LB', 'LWB', 'WBL'].includes(p.effectivePos));
  const dr = nonGkPool.find(p => ['DR', 'RB', 'RWB', 'WBR'].includes(p.effectivePos));
  const dmcs = nonGkPool.filter(p => ['DMC', 'DM'].includes(p.effectivePos));
  const mcs = nonGkPool.filter(p => ['MC', 'CM'].includes(p.effectivePos));
  const amcs = nonGkPool.filter(p => ['AMC', 'AM'].includes(p.effectivePos));
  const pureLeftWings = nonGkPool.filter(p => ['ML', 'LM', 'AML', 'LW', 'FL', 'DML'].includes(p.effectivePos));
  const pureRightWings = nonGkPool.filter(p => ['MR', 'RM', 'AMR', 'RW', 'FR', 'DMR'].includes(p.effectivePos));
  const strikers = nonGkPool.filter(p => ['ST', 'CF', 'SC', 'FW'].includes(p.effectivePos));

  // Overlapping Full-Backs / Wing-Backs (DL / DR):
  // - If on 'normal' / 'defend' (FB DEF): stay at a1/a3 (d1/d3 for Away) and provide defense.
  // - If on 'support' (WB +MID): move from a1 -> c1 or a3 -> c3 (d1 -> b1 / d3 -> b3 for Away) to Cross or Through-Ball.
  // - If on 'attack' (WB +ATT): go all the way to the end (a1 -> d1 / a3 -> d3, or d1 -> a1 / d3 -> a3) to Dribble & Shoot or Cross.
  // - If a winger is also on that flank, 50% chance for who acts/crosses!
  const dlOverlaps = Boolean(dl && (dl.duty === 'support' || dl.duty === 'attack'));
  const drOverlaps = Boolean(dr && (dr.duty === 'support' || dr.duty === 'attack'));

  const leftWings = [...pureLeftWings];
  if (dlOverlaps && !leftWings.includes(dl)) {
    leftWings.push(dl);
  }
  const rightWings = [...pureRightWings];
  if (drOverlaps && !rightWings.includes(dr)) {
    rightWings.push(dr);
  }

  // Tactical role groupings:
  // 1) In Possession: An MC with Attacking duty ('attack') acts as an AMC in c2 (b2 for Away).
  const attackingMCs = mcs.filter(p => p.duty === 'attack');
  const effectiveAmcs = [...amcs, ...attackingMCs];

  // 2) Out of Possession:
  //    - Step 1 (pressing opponent's b2/c2 build-up): AMC (or ATT-duty MC) marks first; if none, MC.
  //    - Step 2 (defending your own half's b2/c2 against opponent AMC): DMC (or DEF-duty MC) marks first; if none, DC.
  const defendDutyDmcs = dmcs.filter(p => p.duty === 'defend');
  const defendDutyMcs = mcs.filter(p => p.duty === 'defend');
  const dmcPool = [...dmcs, ...defendDutyMcs];
  const dedicatedMarkers = [...defendDutyDmcs, ...defendDutyMcs];
  const defensiveMids = dedicatedMarkers.length > 0 ? dedicatedMarkers : dmcs;

  const step1PressMids = effectiveAmcs.length > 0
    ? effectiveAmcs
    : (mcs.length > 0 ? mcs : (dmcs.length > 0 ? dmcs : nonGkPool));

  // 3) Midfield build-up passers in b2 (c2 for Away): prefer non-attacking MCs and DMCs first, plus ball-playing DCs on support_mid
  const supportMidDcs = dcs.filter(p => p.duty === 'support' || p.instruction === 'direct_pass');
  const holdingOrSupportMids = [
    ...mcs.filter(p => p.duty !== 'attack'),
    ...dmcs,
    ...supportMidDcs
  ];
  const buildUpMids = holdingOrSupportMids.length > 0
    ? holdingOrSupportMids
    : ([...mcs, ...dmcs].length > 0 ? [...mcs, ...dmcs] : nonGkPool);

  // Map each player into one of the 12 boxes internally
  const zonePlayers = {
    a1: [], a2: [], a3: [],
    b1: [], b2: [], b3: [],
    c1: [], c2: [], c3: [],
    d1: [], d2: [], d3: []
  };

  players.forEach(p => {
    const ep = p.effectivePos;
    let box = side === 'home' ? 'b2' : 'c2';
    if (side === 'home') {
      if (ep === 'GK' || p === gk) box = 'a2';
      else if (['DC', 'CB', 'SW'].includes(ep)) box = p.duty === 'support' ? 'b2' : 'a2';
      else if (['DL', 'LB', 'LWB', 'WBL'].includes(ep)) {
        box = p.duty === 'attack' ? 'd1' : (p.duty === 'support' ? 'c1' : 'a1');
      } else if (['DR', 'RB', 'RWB', 'WBR'].includes(ep)) {
        box = p.duty === 'attack' ? 'd3' : (p.duty === 'support' ? 'c3' : 'a3');
      } else if (['DMC', 'DM'].includes(ep)) box = p.duty === 'attack' ? 'c2' : 'b2';
      else if (['MC', 'CM'].includes(ep)) box = p.duty === 'attack' ? 'c2' : 'b2';
      else if (['ML', 'LM', 'DML'].includes(ep)) {
        box = p.duty === 'attack' ? 'd1' : (p.duty === 'defend' ? 'b1' : 'c1');
      } else if (['MR', 'RM', 'DMR'].includes(ep)) {
        box = p.duty === 'attack' ? 'd3' : (p.duty === 'defend' ? 'b3' : 'c3');
      }
      else if (['AML', 'LW', 'FL'].includes(ep)) box = p.duty === 'attack' ? 'd1' : 'c1';
      else if (['AMR', 'RW', 'FR'].includes(ep)) box = p.duty === 'attack' ? 'd3' : 'c3';
      else if (['AMC', 'AM'].includes(ep)) box = 'c2';
      else if (['ST', 'CF', 'SC', 'FW'].includes(ep)) box = 'd2';
    } else {
      if (ep === 'GK' || p === gk) box = 'd2';
      else if (['DC', 'CB', 'SW'].includes(ep)) box = p.duty === 'support' ? 'c2' : 'd2';
      else if (['DR', 'RB', 'RWB', 'WBR'].includes(ep)) {
        box = p.duty === 'attack' ? 'a1' : (p.duty === 'support' ? 'b1' : 'd1');
      } else if (['DL', 'LB', 'LWB', 'WBL'].includes(ep)) {
        box = p.duty === 'attack' ? 'a3' : (p.duty === 'support' ? 'b3' : 'd3');
      } else if (['DMC', 'DM'].includes(ep)) box = p.duty === 'attack' ? 'b2' : 'c2';
      else if (['MC', 'CM'].includes(ep)) box = p.duty === 'attack' ? 'b2' : 'c2';
      else if (['MR', 'RM', 'DMR'].includes(ep)) {
        box = p.duty === 'attack' ? 'a1' : (p.duty === 'defend' ? 'c1' : 'b1');
      } else if (['ML', 'LM', 'DML'].includes(ep)) {
        box = p.duty === 'attack' ? 'a3' : (p.duty === 'defend' ? 'c3' : 'b3');
      }
      else if (['AMR', 'RW', 'FR'].includes(ep)) box = p.duty === 'attack' ? 'a1' : 'b1';
      else if (['AML', 'LW', 'FL'].includes(ep)) box = p.duty === 'attack' ? 'a3' : 'b3';
      else if (['AMC', 'AM'].includes(ep)) box = 'b2';
      else if (['ST', 'CF', 'SC', 'FW'].includes(ep)) box = 'a2';
    }
    zonePlayers[box].push(p);
  });

  const centralMids = [...mcs, ...dmcs, ...amcs];
  const effectiveDcs = [...dcs, ...defendDutyDmcs];
  return {
    all: nonGkPool,
    gk,
    dcs: dcs.length > 0 ? dcs : [nonGkPool[0]],
    effectiveDcs: effectiveDcs.length > 0 ? effectiveDcs : (dcs.length > 0 ? dcs : [nonGkPool[0]]),
    dl: dl || pureLeftWings[0] || dcs[0] || nonGkPool[0],
    dr: dr || pureRightWings[0] || dcs[dcs.length - 1] || nonGkPool[0],
    dlOverlaps,
    drOverlaps,
    dmcs,
    dmcPool,
    dmcCount: dmcPool.length,
    amcCount: effectiveAmcs.length,
    mcs,
    amcs,
    effectiveAmcs,
    defensiveMids,
    step1PressMids,
    buildUpMids,
    pureLeftWings,
    pureRightWings,
    leftWings,
    rightWings,
    strikers: strikers.length > 0 ? strikers : (effectiveAmcs.length > 0 ? effectiveAmcs : (mcs.length > 0 ? mcs : [nonGkPool[nonGkPool.length - 1]])),
    centralMids: centralMids.length > 0 ? centralMids : nonGkPool,
    zonePlayers
  };
}

/**
 * Helper to pick which player acts on the flank (c1/c3 or d1/d3):
 * If both a winger and an overlapping FB/WB are on that flank, 50% chance for who acts/crosses!
 */
function pickFlankActor(pureWingers, fullback, fbOverlaps) {
  const hasPureWinger = pureWingers && pureWingers.length > 0;
  if (hasPureWinger && fbOverlaps && fullback) {
    return Math.random() < 0.5 ? pickRandom(pureWingers) : fullback;
  }
  if (hasPureWinger) {
    return pickRandom(pureWingers);
  }
  return fullback;
}

/**
 * Simulates one possession sequence on the 12-box grid (`a1..d3`) with full
 * Position Individual Instructions support.
 */
export function simulateZone12Possession({
  homeLineup,
  awayLineup,
  homeRoles = {},
  awayRoles = {},
  homeInstructions = {},
  awayInstructions = {},
  homeTeamTactics = null,
  awayTeamTactics = null,
  homeFormation = '4-4-2',
  awayFormation = '4-4-2',
  homeTactic = 'balanced',
  awayTactic = 'balanced',
  homeTeam = {},
  awayTeam = {},
  minute = 3,
  maxMinute = null,
  preferredAttacker = null,
  isKickoffRestart = false
}) {
  const resolveEventMinute = (elapsed) => {
    const raw = (Number(minute) || 0) + elapsed;
    return maxMinute ? Math.min(maxMinute, raw) : raw;
  };
  const homeRoster = buildTeamZoneRoster(homeLineup, homeRoles, 'home', homeTeam, homeFormation, homeInstructions);
  const awayRoster = buildTeamZoneRoster(awayLineup, awayRoles, 'away', awayTeam, awayFormation, awayInstructions);

  const pickBestPenaltyTaker = (roster) => {
    const candidates = [
      ...(roster.strikers || []),
      ...(roster.effectiveAmcs || []),
      ...(roster.mcs || []),
      ...(roster.all || [])
    ].filter(Boolean);
    if (candidates.length === 0) return { name: 'Penalty Taker', position: 'ST', skills: { finishing: 6 } };
    return candidates.reduce((best, cur) => ((cur.skills?.finishing || 0) > (best.skills?.finishing || 0) ? cur : best), candidates[0]);
  };
  const homePenaltyTaker = pickBestPenaltyTaker(homeRoster);
  const awayPenaltyTaker = pickBestPenaltyTaker(awayRoster);
  const homeGk = homeRoster.gk || { name: 'Goalkeeper', position: 'GK', skills: { handling: 6 } };
  const awayGk = awayRoster.gk || { name: 'Goalkeeper', position: 'GK', skills: { handling: 6 } };

  // Decide which team initiates the attack if not forced by prior turnover
  let initSide = preferredAttacker;
  if (!initSide) {
    const hMidPool = homeRoster.centralMids.length > 0 ? homeRoster.centralMids : homeRoster.all;
    const aMidPool = awayRoster.centralMids.length > 0 ? awayRoster.centralMids : awayRoster.all;
    const hAvgPass = hMidPool.reduce((s, p) => s + p.skills.passing, 0) / hMidPool.length;
    const aAvgPass = aMidPool.reduce((s, p) => s + p.skills.passing, 0) / aMidPool.length;
    const hInitRoll = rollD10() + hAvgPass + (homeTactic === 'attack' ? 0.5 : 0);
    const aInitRoll = rollD10() + aAvgPass + (awayTactic === 'attack' ? 0.5 : 0);
    initSide = hInitRoll >= aInitRoll ? 'home' : 'away';
  }

  const initIsHome = initSide === 'home';
  const initAttRoster = initIsHome ? homeRoster : awayRoster;
  const initDefRoster = initIsHome ? awayRoster : homeRoster;
  const initAttTeamName = initIsHome ? (homeTeam?.name || 'Home') : (awayTeam?.name || 'Away');
  const initDefTeamName = initIsHome ? (awayTeam?.name || 'Away') : (homeTeam?.name || 'Home');
  const initAttTactic = initIsHome ? homeTactic : awayTactic;
  const initAttTeamTactics = initIsHome ? homeTeamTactics : awayTeamTactics;

  const steps = [];
  const logs = [];
  const zonePath = [];
  const midEventMin = resolveEventMinute(2);

  // Helper to choose an attacking channel ('left', 'center', or 'right')
  // Respects Team Instructions attackingFocus:
  // - 'left': 80% Left Flank, 20% Right/Center
  // - 'right': 80% Right Flank, 20% Left/Center
  // - 'center': 80% Center, 20% Left/Right
  // - 'both_flanks': 50% Left Flank, 50% Right Flank
  const chooseTargetChannel = (attR, isHomeSide, teamTacticsObj = null) => {
    const hasLeftWing = attR.leftWings.length > 0;
    const hasRightWing = attR.rightWings.length > 0;
    const hasAMC = (attR.effectiveAmcs && attR.effectiveAmcs.length > 0);

    const leftZone = isHomeSide ? 'c1' : 'b3';
    const centerZone = isHomeSide ? 'c2' : 'b2';
    const rightZone = isHomeSide ? 'c3' : 'b1';

    const focus = teamTacticsObj?.attackingFocus || null;
    if (focus === 'left') {
      if (Math.random() < 0.80) return { channel: 'left', zone: leftZone };
      if (hasRightWing && hasAMC) {
        return Math.random() < 0.5 ? { channel: 'right', zone: rightZone } : { channel: 'center', zone: centerZone };
      }
      if (hasAMC && !hasRightWing) return { channel: 'center', zone: centerZone };
      return { channel: 'right', zone: rightZone };
    }
    if (focus === 'right') {
      if (Math.random() < 0.80) return { channel: 'right', zone: rightZone };
      if (hasLeftWing && hasAMC) {
        return Math.random() < 0.5 ? { channel: 'left', zone: leftZone } : { channel: 'center', zone: centerZone };
      }
      if (hasAMC && !hasLeftWing) return { channel: 'center', zone: centerZone };
      return { channel: 'left', zone: leftZone };
    }
    if (focus === 'center') {
      if (Math.random() < 0.80) return { channel: 'center', zone: centerZone };
      return Math.random() < 0.5 ? { channel: 'left', zone: leftZone } : { channel: 'right', zone: rightZone };
    }
    if (focus === 'both_flanks') {
      return Math.random() < 0.5 ? { channel: 'left', zone: leftZone } : { channel: 'right', zone: rightZone };
    }

    const candidates = [];
    if (hasLeftWing) {
      candidates.push({ channel: 'left', zone: leftZone, weight: hasAMC ? 35 : 50 });
    }
    if (hasRightWing) {
      candidates.push({ channel: 'right', zone: rightZone, weight: hasAMC ? 35 : 50 });
    }
    if (hasAMC || (!hasLeftWing && !hasRightWing)) {
      candidates.push({ channel: 'center', zone: centerZone, weight: (hasLeftWing || hasRightWing) ? 30 : 100 });
    }

    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let pick = Math.random() * totalWeight;
    let selected = candidates[0];
    for (const c of candidates) {
      pick -= c.weight;
      if (pick <= 0) {
        selected = c;
        break;
      }
    }
    return selected;
  };

  // ---------------------------------------------------------------------------
  // STEP 1: Check GK Distribution Instruction ('long' vs 'short') or Midfield Build-up
  //         Note: Kickoff restarts always begin in center midfield (never GK long kick).
  // ---------------------------------------------------------------------------
  const initGk = initAttRoster.gk;
  const isGkLongDistribution = !isKickoffRestart && initGk?.instruction === 'long';

  let startZone = initIsHome ? 'b2' : 'c2';
  let midPasser = null;
  let midMarker = null;
  let midSuccess = false;
  let counterTriggered = false;
  let step2SkillBonus = 0; // +3 if MC/DMC succeeds a through_ball (diff >= 4)
  let preChosenChannel = null;

  if (isGkLongDistribution) {
    // GK LONG DISTRIBUTION:
    // Launches from a2 (Home) / d2 (Away) directly to c1, c2, or c3 (b3, b2, or b1 for Away).
    // A Tackle duel is made by the player on that field who gets the ball and starts the attack!
    const gkBox = initIsHome ? 'a2' : 'd2';
    startZone = gkBox;
    zonePath.push(gkBox);

    preChosenChannel = chooseTargetChannel(initAttRoster, initIsHome, initAttTeamTactics);
    const targetZone = preChosenChannel.zone;
    zonePath.push(targetZone);

    let targetAttPlayer;
    let targetDefPlayer;
    if (preChosenChannel.channel === 'left') {
      targetAttPlayer = pickFlankActor(initAttRoster.pureLeftWings, initAttRoster.dl, initAttRoster.dlOverlaps);
      targetDefPlayer = initDefRoster.dr;
    } else if (preChosenChannel.channel === 'right') {
      targetAttPlayer = pickFlankActor(initAttRoster.pureRightWings, initAttRoster.dr, initAttRoster.drOverlaps);
      targetDefPlayer = initDefRoster.dl;
    } else {
      const amcPool = initAttRoster.effectiveAmcs.length > 0 ? initAttRoster.effectiveAmcs : initAttRoster.mcs;
      targetAttPlayer = pickRandom(amcPool) || pickRandom(initAttRoster.all);
      const defPool = initDefRoster.defensiveMids.length > 0 ? initDefRoster.defensiveMids : initDefRoster.dcs;
      targetDefPlayer = pickRandom(defPool) || pickRandom(initDefRoster.all);
    }

    midPasser = targetAttPlayer;
    midMarker = targetDefPlayer;

    const attTackDie = rollD10();
    const defTackDie = rollD10();
    const attTackSkill = targetAttPlayer.skills.tackling;
    const defTackSkill = targetDefPlayer.skills.tackling;
    const attTackBonus = initAttTactic === 'attack' ? 1 : 0;
    const defTackBonus = 0;
    const attTackTotal = attTackDie + attTackSkill + attTackBonus;
    const defTackTotal = defTackDie + defTackSkill + defTackBonus;
    const tackDiff = attTackTotal - defTackTotal;

    midSuccess = tackDiff >= 2;
    counterTriggered = tackDiff <= -2;

    steps.push({
      phase: 'GK LONG DISTRIBUTION (TACKLE)',
      zone: targetZone,
      attacker: targetAttPlayer.name,
      attackerPlayer: targetAttPlayer,
      attackerSlotId: targetAttPlayer.slotId || null,
      attackerPos: targetAttPlayer.effectivePos,
      attackerSkillName: 'Tackling',
      attackerSkill: attTackSkill,
      attackerBonus: attTackBonus,
      attackerDie: attTackDie,
      attackerTotal: attTackTotal,
      defender: targetDefPlayer.name,
      defenderPlayer: targetDefPlayer,
      defenderSlotId: targetDefPlayer.slotId || null,
      defenderPos: targetDefPlayer.effectivePos,
      defenderSkillName: 'Tackling',
      defenderSkill: defTackSkill,
      defenderBonus: defTackBonus,
      defenderDie: defTackDie,
      defenderTotal: defTackTotal,
      diff: tackDiff,
      requiredDiff: 2,
      success: midSuccess,
      counterTriggered,
      summary: midSuccess
        ? `🚀 ${initGk.name} launches long [${gkBox.toUpperCase()} -> ${targetZone.toUpperCase()}]! ${targetAttPlayer.name} wins the tackle over ${targetDefPlayer.name} (d10:${attTackDie}+Tack:${attTackSkill}${fmtBonus(attTackBonus)}=${attTackTotal} vs d10:${defTackDie}+Tack:${defTackSkill}=${defTackTotal}, diff +${tackDiff} >= 2)`
        : (counterTriggered
          ? `⚡ ${initGk.name} launches long to [${targetZone.toUpperCase()}], but ${targetDefPlayer.name} wins a crunching tackle over ${targetAttPlayer.name} and counters! (d10:${defTackDie}+Tack:${defTackSkill}=${defTackTotal} vs d10:${attTackDie}+Tack:${attTackSkill}${fmtBonus(attTackBonus)}=${attTackTotal})`
          : `${initGk.name} kicks long to [${targetZone.toUpperCase()}], where ${targetDefPlayer.name} wins the second-ball tackle vs ${targetAttPlayer.name} (d10:${attTackDie}+Tack:${attTackSkill}${fmtBonus(attTackBonus)}=${attTackTotal} vs d10:${defTackDie}+Tack:${defTackSkill}=${defTackTotal})`)
    });

    if (!midSuccess && !counterTriggered) {
      const oppSide = initIsHome ? 'away' : 'home';
      const failLog = {
        text: `${midEventMin}' 🚀 ${initGk.name} (${initAttTeamName}) launches a long distribution upfield, but ${targetDefPlayer.name} (${initDefTeamName}) wins the tackle duel against ${targetAttPlayer.name} and takes possession!`,
        type: 'normal'
      };
      steps[0].stepLog = failLog;
      logs.push(failLog);
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide: initSide,
        nextAttacker: oppSide,
        counterTriggered: false,
        startZone: gkBox,
        activeZone: targetZone,
        zonePath,
        steps,
        logs,
        isGoal: false,
        isShot: false,
        isOnTarget: false,
        scorer: null,
        assister: null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }
  } else {
    // GK SHORT DISTRIBUTION -> Standard Midfield Build-up in b2 (Home) / c2 (Away)
    zonePath.push(startZone);

    const attMids = initAttRoster.buildUpMids && initAttRoster.buildUpMids.length > 0
      ? initAttRoster.buildUpMids
      : ((initAttRoster.mcs.length > 0 || initAttRoster.dmcs.length > 0)
        ? [...initAttRoster.mcs, ...initAttRoster.dmcs]
        : (initAttRoster.centralMids.length > 0 ? initAttRoster.centralMids : initAttRoster.all));

    const defMids = (initDefRoster.step1PressMids && initDefRoster.step1PressMids.length > 0)
      ? initDefRoster.step1PressMids
      : (initDefRoster.centralMids.length > 0 ? initDefRoster.centralMids : initDefRoster.all);

    midPasser = pickRandom(attMids);
    midMarker = pickRandom(defMids);

    // Check MC / DMC Individual Instruction: 'pass' (default, diff >= 2) vs 'through_ball' (diff >= 4, grants +3 skill to receiver!)
    const isMidThroughBall = midPasser.instruction === 'through_ball';
    const requiredMidDiff = isMidThroughBall ? 4 : 2;
    const ballPlayDcBonus = (['DC', 'CB', 'SW'].includes(midPasser.effectivePos) && midPasser.instruction === 'direct_pass') ? 1 : 0;

    const attNumBonus = initAttRoster.centralMids.length > initDefRoster.centralMids.length ? 1 : 0;
    const defNumBonus = initDefRoster.centralMids.length > initAttRoster.centralMids.length ? 1 : 0;
    const doublePivotPassBonus = initAttRoster.dmcCount >= 2 ? 1 : 0;
    const mentalityPassBonus = initAttTactic === 'attack' ? 1 : (initAttTactic === 'defense' ? -2 : 0);

    const attStep1Bonus = attNumBonus + doublePivotPassBonus + mentalityPassBonus + ballPlayDcBonus;
    const defStep1Bonus = defNumBonus;

    const passDie = rollD10();
    const markDie = rollD10();
    const passSkill = midPasser.skills.passing;
    const markSkill = midMarker.skills.marking;
    const passTotal = passDie + passSkill + attStep1Bonus;
    const markTotal = markDie + markSkill + defStep1Bonus;
    const midDiff = passTotal - markTotal;

    midSuccess = midDiff >= requiredMidDiff;
    // Center-circle kickoff restarts cannot be counter-ambushed in Step 1;
    // Defensive low-blocks only leave counters open on heavy turnovers (diff <= -4).
    const counterThreshold = initAttTactic === 'defense' ? -4 : -2;
    counterTriggered = !isKickoffRestart && midDiff <= counterThreshold;

    if (midSuccess && isMidThroughBall) {
      step2SkillBonus = 3;
    }

    steps.push({
      phase: isKickoffRestart
        ? (isMidThroughBall ? 'KICKOFF THROUGH-BALL (+3)' : 'KICKOFF RESTART (MIDFIELD)')
        : (isMidThroughBall ? 'MIDFIELD THROUGH-BALL (+3)' : 'MIDFIELD BUILD-UP'),
      zone: startZone,
      attacker: midPasser.name,
      attackerPlayer: midPasser,
      attackerSlotId: midPasser.slotId || null,
      attackerPos: midPasser.effectivePos,
      attackerSkillName: 'Passing',
      attackerSkill: passSkill,
      attackerBonus: attStep1Bonus,
      attackerDie: passDie,
      attackerTotal: passTotal,
      defender: midMarker.name,
      defenderPlayer: midMarker,
      defenderSlotId: midMarker.slotId || null,
      defenderPos: midMarker.effectivePos,
      defenderSkillName: 'Marking',
      defenderSkill: markSkill,
      defenderBonus: defStep1Bonus,
      defenderDie: markDie,
      defenderTotal: markTotal,
      diff: midDiff,
      requiredDiff: requiredMidDiff,
      success: midSuccess,
      counterTriggered,
      summary: midSuccess
        ? (isMidThroughBall
          ? `🗡️ ${midPasser.name} splits the defence from [${startZone.toUpperCase()}]! (d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal} vs ${midMarker.name} d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal}, diff +${midDiff} >= 4 → Receiver gets +3 Skill!)`
          : `${midPasser.name} wins midfield in [${startZone.toUpperCase()}] (d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal} vs ${midMarker.name} d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal}, diff +${midDiff} >= 2)`)
        : (counterTriggered
          ? `⚡ ${midMarker.name} intercepts ${midPasser.name} in [${startZone.toUpperCase()}] and launches an instant counter! (d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal} vs d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal})`
          : `${midMarker.name} stops ${midPasser.name}'s ${isMidThroughBall ? 'through-ball' : 'pass'} in [${startZone.toUpperCase()}] (d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal} vs d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal}, diff ${midDiff >= 0 ? `+${midDiff}` : midDiff} < ${requiredMidDiff})`)
    });

    if (!midSuccess && !counterTriggered) {
      const oppSide = initIsHome ? 'away' : 'home';
      const failLog = {
        text: isKickoffRestart
          ? `${midEventMin}' ${initAttTeamName} restarts from the center circle — ${midPasser.name} probes forward, before ${midMarker.name} (${initDefTeamName}) closes down and wins possession!`
          : `${midEventMin}' ${midPasser.name} (${initAttTeamName}) attempts a ${isMidThroughBall ? 'defence-splitting through-ball' : 'forward pass'}, but ${midMarker.name} (${initDefTeamName}) closes down and intercepts cleanly. ${initDefTeamName} wins possession!`,
        type: 'normal'
      };
      steps[0].stepLog = failLog;
      logs.push(failLog);
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide: initSide,
        nextAttacker: oppSide,
        counterTriggered: false,
        startZone,
        activeZone: startZone,
        zonePath,
        steps,
        logs,
        isGoal: false,
        isShot: false,
        isOnTarget: false,
        scorer: null,
        assister: null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }
  }

  // Resolve who actually carries the attack forward into Step 2 & Step 3
  const attackingSide = counterTriggered ? (initIsHome ? 'away' : 'home') : initSide;
  const defendingSide = attackingSide === 'home' ? 'away' : 'home';
  const isHomeAtt = attackingSide === 'home';
  const attRoster = isHomeAtt ? homeRoster : awayRoster;
  const defRoster = isHomeAtt ? awayRoster : homeRoster;
  const attTeamName = isHomeAtt ? (homeTeam?.name || 'Home') : (awayTeam?.name || 'Away');
  const defTeamName = isHomeAtt ? (awayTeam?.name || 'Away') : (homeTeam?.name || 'Home');
  const attTactic = isHomeAtt ? homeTactic : awayTactic;
  const defTactic = isHomeAtt ? awayTactic : homeTactic;
  const attTeamTactics = isHomeAtt ? homeTeamTactics : awayTeamTactics;

  // Team Mentality modifiers for Steps 2 & 3:
  // Defensive mentality penalizes attacking skills (passing, crossing, finishing, heading, dribbling, through balls) by -2,
  // while Long Shots keeps -1.
  const attMentalityMod = attTactic === 'attack' ? 1 : (attTactic === 'defense' ? -2 : 0);
  const longShotMentalityMod = attTactic === 'attack' ? 1 : (attTactic === 'defense' ? -1 : 0);
  const defMentalityMod = defTactic === 'defense' ? 1 : (defTactic === 'attack' ? -1 : 0);

  // ---------------------------------------------------------------------------
  // STEP 2: Choose Next Box (c1, c2, or c3 for Home; b1, b2, or b3 for Away)
  // ---------------------------------------------------------------------------
  const chosenChannel = (!counterTriggered && preChosenChannel)
    ? preChosenChannel
    : chooseTargetChannel(attRoster, isHomeAtt, attTeamTactics);
  const isTeamLongPass = !isGkLongDistribution && attTeamTactics?.passing === 'long';
  const deepTargetZone = isHomeAtt
    ? (chosenChannel.channel === 'left' ? 'd1' : (chosenChannel.channel === 'right' ? 'd3' : 'd2'))
    : (chosenChannel.channel === 'left' ? 'a3' : (chosenChannel.channel === 'right' ? 'a1' : 'a2'));

  const secondZone = isTeamLongPass ? deepTargetZone : chosenChannel.zone;
  if (zonePath[zonePath.length - 1] !== secondZone) {
    zonePath.push(secondZone);
  }

  const channelDestDesc = isTeamLongPass
    ? `long into [${deepTargetZone.toUpperCase()}] (${chosenChannel.channel === 'center' ? 'penalty box' : `${chosenChannel.channel} deep flank`})`
    : (chosenChannel.channel === 'center'
      ? 'into the central attacking pocket'
      : `out wide to the ${chosenChannel.channel} flank`);
      const step1WinLog = counterTriggered
    ? {
      text: `${midEventMin}' ⚡ COUNTER! ${midMarker.name} (${attTeamName}) dispossesses ${midPasser.name} cleanly in midfield and surges forward ${channelDestDesc}!`,
      type: 'chance'
    }
    : (isGkLongDistribution
      ? {
        text: `${midEventMin}' 🚀 ${initGk.name} launches a long ball upfield and ${midPasser.name} (${attTeamName}) beats ${midMarker.name} to the tackle to spark a dangerous attack!`,
        type: 'chance'
      }
      : {
        text: isKickoffRestart
          ? `${midEventMin}' ${initAttTeamName} kicks off from midfield — ${midPasser.name} ${step2SkillBonus === 3 ? 'threads a defence-splitting through-ball past' : 'shakes off'} ${midMarker.name} and moves the ball ${channelDestDesc}!`
          : `${midEventMin}' ${midPasser.name} (${attTeamName}) ${step2SkillBonus === 3 ? 'threads a defence-splitting through-ball past' : 'beats the press of'} ${midMarker.name} and plays the ball ${channelDestDesc}!`,
        type: 'chance'
      });
  steps[0].stepLog = step1WinLog;
  logs.push(step1WinLog);

  // Helper to resolve DC + GK combined defense in d2 / a2:
  // - mode 'high_cross': (Opp DC Heading + Opp GK Handling) / 2
  // - mode 'low_cross':  (Opp DC Tackling + Opp GK Handling) / 2
  // - mode 'standard':   (Opp DC Marking + Opp GK Handling) / 2
  // If there are 2 DCs, 50% random chance (`pickRandom`) which DC contests it!
  const getBoxDefenseTarget = (mode = 'standard') => {
    const dcPool = defRoster.dcs && defRoster.dcs.length > 0 ? defRoster.dcs : defRoster.effectiveDcs;
    const dc = pickRandom(dcPool);
    const gk = defRoster.gk;
    const gkHand = gk ? gk.skills.handling : 6;

    let dcSkillVal = dc ? dc.skills.marking : 6;
    let dcSkillLabel = 'Mark';
    let dcInstrBonus = 0;

    if (mode === 'high_cross') {
      dcSkillVal = dc ? dc.skills.heading : 6;
      dcSkillLabel = 'Head';
      if (dc?.instruction === 'tight_marking') dcInstrBonus = 1;
    } else if (mode === 'low_cross') {
      dcSkillVal = dc ? dc.skills.tackling : 6;
      dcSkillLabel = 'Tack';
      if (dc?.instruction === 'aggressive_tackle') dcInstrBonus = 1;
    } else {
      dcSkillVal = dc ? dc.skills.marking : 6;
      dcSkillLabel = 'Mark';
      if (dc?.instruction === 'aggressive_tackle') dcInstrBonus = 1;
    }

    const combinedSkill = Math.round((dcSkillVal + gkHand) / 2);
    return {
      dc,
      gk,
      dcSkillVal,
      dcSkillLabel,
      dcInstrBonus,
      gkHand,
      combinedSkill,
      formulaName: `(${dcSkillLabel}+Hand)/2`,
      label: `${dc?.name || 'DC'} (${dcSkillLabel}:${dcSkillVal}) & ${gk?.name || 'GK'} (Hand:${gkHand})`
    };
  };

  const resolveLongShotOutcome = ({ shooter, shotZone, targetBoxZone, extraAttBonus = 0, extraDefBonus = 0, isFlank = false }) => {
    const boxDef = getBoxDefenseTarget('standard');
    const shotDie = rollD10();
    const saveDie = rollD10();
    const longShotSkill = shooter.skills.longShots;
    const longShotAttBonus = extraAttBonus + longShotMentalityMod + step2SkillBonus;
    const longShotDefBonus = extraDefBonus + defMentalityMod;
    const shotTotal = shotDie + longShotSkill + longShotAttBonus;
    const saveTotal = saveDie + boxDef.combinedSkill + longShotDefBonus;
    const shotDiff = shotTotal - saveTotal;
    const isGoal = shotDiff >= 5;

    const longShotLog = isGoal
      ? {
        text: isFlank
          ? `${midEventMin}' 🚀 GOAL! ${shooter.name} (${attTeamName}) cuts inside from the flank and unleashes an unstoppable thunderbolt past ${boxDef.gk?.name || 'the keeper'}!`
          : `${midEventMin}' 🚀 GOAL! ${shooter.name} (${attTeamName}) shifts the ball onto his shooting boot outside the box and unleashes an unstoppable thunderbolt past ${boxDef.gk?.name || 'the keeper'}!`,
        type: 'goal'
      }
      : {
        text: isFlank
          ? `${midEventMin}' ${shooter.name} (${attTeamName}) cuts inside and lets fly from distance, but ${boxDef.gk?.name || 'the keeper'} reacts well to hold it. ${defTeamName} takes possession!`
          : `${midEventMin}' ${shooter.name} (${attTeamName}) lets fly with a fierce long-range strike, but ${boxDef.gk?.name || 'the keeper'} reacts well to hold it. ${defTeamName} takes possession!`,
        type: 'save'
      };

    steps.push({
      phase: 'LONG DISTANCE SHOT',
      zone: shotZone,
      attacker: shooter.name,
      attackerPlayer: shooter,
      attackerSlotId: shooter.slotId || null,
      attackerPos: shooter.effectivePos,
      attackerSkillName: 'Long Shots',
      attackerSkill: longShotSkill,
      attackerBonus: longShotAttBonus,
      attackerDie: shotDie,
      attackerTotal: shotTotal,
      defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
      defenderPlayer: boxDef.dc || null,
      defenderSlotId: boxDef.dc?.slotId || null,
      defenderPos: 'DC+GK',
      defenderSkillName: boxDef.formulaName,
      defenderSkill: boxDef.combinedSkill,
      defenderBonus: longShotDefBonus,
      defenderDie: saveDie,
      defenderTotal: saveTotal,
      diff: shotDiff,
      requiredDiff: 5,
      success: isGoal,
      stepLog: longShotLog,
      summary: isGoal
        ? `🚀 SCREAMER! ${shooter.name} scores from [${shotZone.toUpperCase()}]! (d10:${shotDie}+LongShot:${longShotSkill}${fmtBonus(longShotAttBonus)}=${shotTotal} vs d10:${saveDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(longShotDefBonus)}=${saveTotal}, diff +${shotDiff} >= 5)`
        : `${shooter.name} shoots from distance in [${shotZone.toUpperCase()}] — saved (d10:${shotDie}+LongShot:${longShotSkill}${fmtBonus(longShotAttBonus)}=${shotTotal} vs d10:${saveDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(longShotDefBonus)}=${saveTotal}, diff ${shotDiff >= 0 ? `+${shotDiff}` : shotDiff} < 5)`
    });

    logs.push(longShotLog);
    if (isGoal) zonePath.push(targetBoxZone);
    const initiator = counterTriggered ? midMarker : (isGkLongDistribution ? initGk : midPasser);
    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: isGoal ? targetBoxZone : shotZone,
      zonePath,
      steps,
      logs,
      isGoal,
      isShot: true,
      isOnTarget: isGoal || shotDiff >= 2,
      scorer: isGoal ? shooter : null,
      assister: isGoal && initiator?.name !== shooter.name ? initiator : null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  };

  const returnEmptyZoneTurnover = ({ targetZone, phaseLabel, logText, summaryText }) => {
    const defInterceptor = (chosenChannel.channel === 'center')
      ? (pickRandom(defRoster.defensiveMids) || pickRandom(defRoster.dcs) || midMarker)
      : ((chosenChannel.channel === 'left' ? defRoster.dr : defRoster.dl) || pickRandom(defRoster.dcs) || midMarker);
    const passer = counterTriggered ? midMarker : (isGkLongDistribution ? initGk : midPasser);
    const turnoverLog = { text: logText, type: 'save' };

    steps.push({
      phase: phaseLabel,
      zone: targetZone,
      attacker: passer?.name || 'Passer',
      attackerPlayer: passer || null,
      attackerSlotId: passer?.slotId || null,
      attackerPos: passer?.effectivePos || 'MC',
      attackerSkillName: 'Passing',
      attackerSkill: passer?.skills?.passing || 6,
      attackerBonus: 0,
      attackerDie: 5,
      attackerTotal: (passer?.skills?.passing || 6) + 5,
      defender: defInterceptor?.name || 'Defense',
      defenderPlayer: defInterceptor || null,
      defenderSlotId: defInterceptor?.slotId || null,
      defenderPos: defInterceptor?.effectivePos || 'DC',
      defenderSkillName: 'Marking',
      defenderSkill: defInterceptor?.skills?.marking || 6,
      defenderBonus: 0,
      defenderDie: 5,
      defenderTotal: (defInterceptor?.skills?.marking || 6) + 5,
      diff: -2,
      requiredDiff: 2,
      success: false,
      stepLog: turnoverLog,
      summary: summaryText
    });
    logs.push(turnoverLog);

    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: targetZone,
      zonePath,
      steps,
      logs,
      isGoal: false,
      isShot: false,
      isOnTarget: false,
      scorer: null,
      assister: null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  };

  // ---------------------------------------------------------------------------
  // LONG PASSING MODE ('long'): Pass from b2/c2 one box behind to d1, d2, or d3 (a3, a2, a1 for Away)
  // - Requires an attacking player in that deep box (otherwise turnover).
  // - If opposition outfield player(s) are in that box: Tackle duel (d10+Tackle vs d10+Tackle, +2 for 2+ players in box).
  // ---------------------------------------------------------------------------
  if (isTeamLongPass) {
    const boxZone = isHomeAtt ? 'd2' : 'a2';
    const attDeepPlayers = (attRoster.zonePlayers[deepTargetZone] || []).filter(
      p => p.effectivePos !== 'GK' && p !== attRoster.gk
    );

    if (attDeepPlayers.length === 0) {
      const passerName = (counterTriggered ? midMarker : midPasser)?.name || 'Midfield';
      return returnEmptyZoneTurnover({
        targetZone: deepTargetZone,
        phaseLabel: 'LONG BALL (NO TEAMMATE IN BOX)',
        logText: `${midEventMin}' 🚀 ${passerName} (${attTeamName}) launches a long ball into [${deepTargetZone.toUpperCase()}], but no ${attTeamName} player is stationed in that box and ${defTeamName} collects possession easily!`,
        summaryText: `Long ball to [${deepTargetZone.toUpperCase()}] — no ${attTeamName} teammate in box (turnover)`
      });
    }

    const attTarget = pickRandom(attDeepPlayers);
    const defDeepPlayers = (defRoster.zonePlayers[deepTargetZone] || []).filter(
      p => p.effectivePos !== 'GK' && p !== defRoster.gk
    );

    if (defDeepPlayers.length > 0) {
      const defTarget = pickRandom(defDeepPlayers);
      const attTwoBonus = attDeepPlayers.length >= 2 ? 2 : 0;
      const defTwoBonus = defDeepPlayers.length >= 2 ? 2 : 0;
      const attTackDie = rollD10();
      const defTackDie = rollD10();
      const attTackSkill = attTarget.skills.tackling;
      const defTackSkill = defTarget.skills.tackling;
      const attBonus = attTwoBonus + attMentalityMod + step2SkillBonus;
      const defBonus = defTwoBonus + defMentalityMod;
      const attTotal = attTackDie + attTackSkill + attBonus;
      const defTotal = defTackDie + defTackSkill + defBonus;
      const tackDiff = attTotal - defTotal;
      const tackleWon = tackDiff >= 1;

      const longTackleLog = tackleWon
        ? {
          text: `${midEventMin}' 🚀 ${attTarget.name} (${attTeamName}) battles ${defTarget.name} for the long ball in [${deepTargetZone.toUpperCase()}]${attTwoBonus ? ' (+2 teammate support)' : ''} and wins the tackle to set up a huge chance!`,
          type: 'chance'
        }
        : {
          text: `${midEventMin}' ${defTarget.name} (${defTeamName})${defTwoBonus ? ' (+2 defensive cover)' : ''} out-muscles ${attTarget.name} in [${deepTargetZone.toUpperCase()}] to win the long-ball tackle and clear the danger!`,
          type: 'save'
        };

      steps.push({
        phase: `LONG BALL TACKLE${attTwoBonus ? ' (ATT +2)' : ''}${defTwoBonus ? ' (DEF +2)' : ''}`,
        zone: deepTargetZone,
        attacker: attTarget.name,
        attackerPlayer: attTarget,
        attackerSlotId: attTarget.slotId || null,
        attackerPos: attTarget.effectivePos,
        attackerSkillName: 'Tackling',
        attackerSkill: attTackSkill,
        attackerBonus: attBonus,
        attackerDie: attTackDie,
        attackerTotal: attTotal,
        defender: defTarget.name,
        defenderPlayer: defTarget,
        defenderSlotId: defTarget.slotId || null,
        defenderPos: defTarget.effectivePos,
        defenderSkillName: 'Tackling',
        defenderSkill: defTackSkill,
        defenderBonus: defBonus,
        defenderDie: defTackDie,
        defenderTotal: defTotal,
        diff: tackDiff,
        requiredDiff: 1,
        success: tackleWon,
        stepLog: longTackleLog,
        summary: tackleWon
          ? `🚀 ${attTarget.name} wins long-ball tackle in [${deepTargetZone.toUpperCase()}]! (d10:${attTackDie}+Tack:${attTackSkill}${fmtBonus(attBonus)}=${attTotal} vs ${defTarget.name} d10:${defTackDie}+Tack:${defTackSkill}${fmtBonus(defBonus)}=${defTotal}, diff +${tackDiff} >= 1)`
          : `${defTarget.name} wins long-ball tackle in [${deepTargetZone.toUpperCase()}] (d10:${attTackDie}+Tack:${attTackSkill}${fmtBonus(attBonus)}=${attTotal} vs d10:${defTackDie}+Tack:${defTackSkill}${fmtBonus(defBonus)}=${defTotal}, diff ${tackDiff >= 0 ? `+${tackDiff}` : tackDiff} < 1)`
      });
      logs.push(longTackleLog);

      if (!tackleWon) {
        return {
          minutesElapsed: 2,
          step1Side: initSide,
          attackingSide,
          nextAttacker: defendingSide,
          counterTriggered,
          startZone,
          activeZone: deepTargetZone,
          zonePath,
          steps,
          logs,
          isGoal: false,
          isShot: false,
          isOnTarget: false,
          scorer: null,
          assister: null,
          homePenaltyTaker,
          awayPenaltyTaker,
          homeGk,
          awayGk,
          homeZonePlayers: homeRoster.zonePlayers,
          awayZonePlayers: awayRoster.zonePlayers
        };
      }
    } else {
      // Uncontested long ball arrival in deep box (0 opposition outfield players in that box)
      const freeLog = {
        text: `${midEventMin}' 🚀 ${attTarget.name} (${attTeamName}) latches onto the long ball completely unchallenged in [${deepTargetZone.toUpperCase()}]!`,
        type: 'chance'
      };
      steps.push({
        phase: 'LONG BALL (UNCONTESTED)',
        zone: deepTargetZone,
        attacker: attTarget.name,
        attackerPlayer: attTarget,
        attackerSlotId: attTarget.slotId || null,
        attackerPos: attTarget.effectivePos,
        attackerSkillName: 'Tackling',
        attackerSkill: attTarget.skills.tackling,
        attackerBonus: 2,
        attackerDie: 8,
        attackerTotal: attTarget.skills.tackling + 10,
        defender: 'Open Space',
        defenderPlayer: null,
        defenderSlotId: null,
        defenderPos: '-',
        defenderSkillName: 'Tackling',
        defenderSkill: 0,
        defenderBonus: 0,
        defenderDie: 5,
        defenderTotal: 5,
        diff: 5,
        requiredDiff: 1,
        success: true,
        stepLog: freeLog,
        summary: `🚀 ${attTarget.name} receives long ball unchallenged in [${deepTargetZone.toUpperCase()}]!`
      });
      logs.push(freeLog);
    }

    // Step 3 after winning the Long Ball in deepTargetZone (d1, d2, or d3)
    if (zonePath[zonePath.length - 1] !== boxZone) {
      zonePath.push(boxZone);
    }
    const isCenterLong = chosenChannel.channel === 'center';
    const isHighCrossLong = !isCenterLong && attTarget.instruction === 'high_cross';
    const finisher = isCenterLong || ['dribble', 'long_shot'].includes(attTarget.instruction)
      ? attTarget
      : (pickRandom(attRoster.strikers) || attTarget);
    const boxDef = getBoxDefenseTarget(isHighCrossLong ? 'high_cross' : 'standard');
    const finDie = rollD10();
    const gkDie = rollD10();
    const finSkill = isHighCrossLong ? finisher.skills.heading : finisher.skills.finishing;
    const finSkillName = isHighCrossLong ? 'Heading' : 'Finishing';
    const finInstrBonus = isHighCrossLong
      ? (finisher.instruction === 'target_man' ? 1 : (finisher.instruction === 'poacher' ? -1 : 0))
      : (finisher.instruction === 'poacher' ? 1 : 0);
    const totalFinBonus = attMentalityMod + finInstrBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus;
    const finTotal = finDie + finSkill + totalFinBonus;
    const gkTotal = gkDie + boxDef.combinedSkill + totalDefBonus;
    const finDiff = finTotal - gkTotal;
    const isGoal = finDiff >= 3;

    const finishLog = isGoal
      ? {
        text: `${midEventMin}' ⚽ GOAL! After winning the long ball, ${finisher.name} (${attTeamName}) finishes clinically in the box past ${boxDef.gk?.name || 'the keeper'}!`,
        type: 'goal'
      }
      : {
        text: `${midEventMin}' 🧤 SAVE! ${finisher.name} (${attTeamName}) gets a shot away after the long ball, but ${boxDef.gk?.name || 'the keeper'} and ${boxDef.dc?.name || 'the defense'} deny it!`,
        type: 'save'
      };

    steps.push({
      phase: isHighCrossLong ? 'LONG BALL HEADER FINISH' : 'LONG BALL BOX FINISH',
      zone: boxZone,
      attacker: finisher.name,
      attackerPlayer: finisher,
      attackerSlotId: finisher.slotId || null,
      attackerPos: finisher.effectivePos,
      attackerSkillName: finSkillName,
      attackerSkill: finSkill,
      attackerBonus: totalFinBonus,
      attackerDie: finDie,
      attackerTotal: finTotal,
      defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
      defenderPlayer: boxDef.dc || null,
      defenderSlotId: boxDef.dc?.slotId || null,
      defenderPos: 'DC+GK',
      defenderSkillName: boxDef.formulaName,
      defenderSkill: boxDef.combinedSkill,
      defenderBonus: totalDefBonus,
      defenderDie: gkDie,
      defenderTotal: gkTotal,
      diff: finDiff,
      requiredDiff: 3,
      success: isGoal,
      stepLog: finishLog,
      summary: isGoal
        ? `⚽ GOAL! ${finisher.name} converts the long-ball attack in [${boxZone.toUpperCase()}]! (diff +${finDiff} >= 3)`
        : `${boxDef.gk?.name || 'GK'} denies ${finisher.name} in [${boxZone.toUpperCase()}] (diff ${finDiff >= 0 ? `+${finDiff}` : finDiff} < 3)`
    });
    logs.push(finishLog);

    const initiator = counterTriggered ? midMarker : midPasser;
    const assisterPlayer = (!isCenterLong && finisher.name !== attTarget.name)
      ? attTarget
      : (initiator?.name !== finisher.name ? initiator : null);
    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: boxZone,
      zonePath,
      steps,
      logs,
      isGoal,
      isShot: true,
      isOnTarget: true,
      scorer: isGoal ? finisher : null,
      assister: isGoal ? assisterPlayer : null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  }

  // ---------------------------------------------------------------------------
  // BRANCH A: CENTRAL ATTACK ON C2 (Home) / B2 (Away) — AMC INSTRUCTIONS
  // ---------------------------------------------------------------------------
  if (chosenChannel.channel === 'center') {
    const hasAMCInCenter = Boolean(attRoster.effectiveAmcs && attRoster.effectiveAmcs.length > 0);
    // If attacking through Center without an AMC (or MC on Attacking role) in c2/b2, the pass has no receiver and loses the ball!
    if (!hasAMCInCenter && !isGkLongDistribution) {
      const passerName = (counterTriggered ? midMarker : midPasser)?.name || 'Midfield';
      return returnEmptyZoneTurnover({
        targetZone: secondZone,
        phaseLabel: 'CENTER PASS (NO AMC — TURNOVER)',
        logText: `${midEventMin}' ${passerName} (${attTeamName}) tries to play a short pass through the center into [${secondZone.toUpperCase()}], but with no AMC stationed there, ${defTeamName} easily intercepts the loose ball!`,
        summaryText: `Short pass into [${secondZone.toUpperCase()}] — no AMC stationed in central box (turnover)`
      });
    }

    const amcPool = hasAMCInCenter
      ? attRoster.effectiveAmcs
      : attRoster.mcs;
    const nonPasserAmcs = (counterTriggered || isGkLongDistribution)
      ? amcPool
      : amcPool.filter(p => p.name !== midPasser.name);
    const amcPlayer = isGkLongDistribution && !counterTriggered
      ? midPasser
      : (nonPasserAmcs.length > 0
        ? pickRandom(nonPasserAmcs)
        : (amcPool.length > 0 ? pickRandom(amcPool) : (counterTriggered ? midMarker : midPasser)));

    // In Step 2 (defending half's b2/c2), DMC (or DEF-duty MC) marks first; if none, DC
    const oppCentralDef = (defRoster.defensiveMids && defRoster.defensiveMids.length > 0)
      ? pickRandom(defRoster.defensiveMids)
      : (defRoster.dcs.length > 0 ? pickRandom(defRoster.dcs) : midMarker);

    const amcInstr = amcPlayer.instruction || 'pass';
    const dmcManMarkBonus = oppCentralDef?.instruction === 'man_mark' ? 1 : 0;
    const boxZone = isHomeAtt ? 'd2' : 'a2';

    // 1. AMC (or Attacking MC) Instruction: LONG SHOT ('long_shot')
    if (amcInstr === 'long_shot') {
      return resolveLongShotOutcome({
        shooter: amcPlayer,
        shotZone: secondZone,
        targetBoxZone: boxZone,
        extraAttBonus: (attRoster.amcCount >= 2 && defRoster.dmcCount === 0) ? 1 : 0,
        extraDefBonus: defRoster.dmcCount >= 2 ? 1 : 0,
        isFlank: false
      });
    }

    // 2. AMC Instruction: DRIBBLE ('dribble') -> Beats DMC or DC tackling -> shoots 1-on-1 with the keeper!
    if (amcInstr === 'dribble') {
      const dribDie = rollD10();
      const tackDie = rollD10();
      const dribSkill = amcPlayer.skills.dribbling;
      const tackSkill = oppCentralDef.skills.tackling;
      const dribAttBonus = (attRoster.amcCount >= 2 ? 1 : 0) + attMentalityMod + step2SkillBonus;
      const dribDefBonus = (defRoster.dmcCount >= 2 ? 1 : 0) + defMentalityMod;
      const dribTotal = dribDie + dribSkill + dribAttBonus;
      const tackTotal = tackDie + tackSkill + dribDefBonus;
      const dribDiff = dribTotal - tackTotal;
      const dribSuccess = dribDiff >= 2;

      const dribLog = dribSuccess
        ? {
          text: `${midEventMin}' 🔥 ${amcPlayer.name} (${attTeamName}) drops a shoulder and glides past ${oppCentralDef.name}'s challenge, racing clean through 1-on-1 with the keeper!`,
          type: 'chance'
        }
        : {
          text: `${midEventMin}' ${amcPlayer.name} (${attTeamName}) tries to dribble through the middle, but ${oppCentralDef.name} (${defTeamName}) times a sharp tackle to win the ball back!`,
          type: 'save'
        };

      steps.push({
        phase: 'AMC CENTRAL DRIBBLE',
        zone: secondZone,
        attacker: amcPlayer.name,
        attackerPlayer: amcPlayer,
        attackerSlotId: amcPlayer.slotId || null,
        attackerPos: amcPlayer.effectivePos,
        attackerSkillName: 'Dribbling',
        attackerSkill: dribSkill,
        attackerBonus: dribAttBonus,
        attackerDie: dribDie,
        attackerTotal: dribTotal,
        defender: oppCentralDef.name,
        defenderPlayer: oppCentralDef,
        defenderSlotId: oppCentralDef.slotId || null,
        defenderPos: oppCentralDef.effectivePos,
        defenderSkillName: 'Tackling',
        defenderSkill: tackSkill,
        defenderBonus: dribDefBonus,
        defenderDie: tackDie,
        defenderTotal: tackTotal,
        diff: dribDiff,
        requiredDiff: 2,
        success: dribSuccess,
        stepLog: dribLog,
        summary: dribSuccess
          ? `🔥 ${amcPlayer.name} dribbles past ${oppCentralDef.name} in [${secondZone.toUpperCase()}] to go 1v1 with the Keeper! (d10:${dribDie}+Drib:${dribSkill}${fmtBonus(dribAttBonus)}=${dribTotal} vs d10:${tackDie}+Tack:${tackSkill}${fmtBonus(dribDefBonus)}=${tackTotal}, diff +${dribDiff} >= 2)`
          : `${oppCentralDef.name} tackles ${amcPlayer.name} in [${secondZone.toUpperCase()}] (d10:${dribDie}+Drib:${dribSkill}${fmtBonus(dribAttBonus)}=${dribTotal} vs d10:${tackDie}+Tack:${tackSkill}${fmtBonus(dribDefBonus)}=${tackTotal}, diff ${dribDiff >= 0 ? `+${dribDiff}` : dribDiff} < 2)`
      });

      logs.push(dribLog);

      if (!dribSuccess) {
        return {
          minutesElapsed: 2,
          step1Side: initSide,
          attackingSide,
          nextAttacker: defendingSide,
          counterTriggered,
          startZone,
          activeZone: secondZone,
          zonePath,
          steps,
          logs,
          isGoal: false,
          isShot: false,
          isOnTarget: false,
          scorer: null,
          assister: null,
          homePenaltyTaker,
          awayPenaltyTaker,
          homeGk,
          awayGk,
          homeZonePlayers: homeRoster.zonePlayers,
          awayZonePlayers: awayRoster.zonePlayers
        };
      }

      // Step 3: AMC shoots 1-on-1 with the keeper!
      zonePath.push(boxZone);
      const gk = defRoster.gk;
      const dcForFoul = pickRandom(defRoster.dcs);
      const finDie = rollD10();
      const gkDie = rollD10();
      const finSkill = amcPlayer.skills.finishing;
      const gkHand = gk ? gk.skills.handling : 6;
      const finTotal = finDie + finSkill + attMentalityMod;
      const gkTotal = gkDie + gkHand + defMentalityMod;
      const finDiff = finTotal - gkTotal;
      const isGoal = finDiff >= 3;

      const finLog = isGoal
        ? {
          text: `${midEventMin}' ⚽ GOAL! After dancing past ${oppCentralDef.name}, ${amcPlayer.name} bursts into the box and slots a clinical finish 1-on-1 past ${gk?.name || 'the keeper'}!`,
          type: 'goal'
        }
        : {
          text: `${midEventMin}' 🧤 BIG 1v1 SAVE! ${amcPlayer.name} is clean through on goal, but ${gk?.name || 'the keeper'} spreads himself brilliantly to block the shot! ${defTeamName} clears!`,
          type: 'save'
        };

      steps.push({
        phase: 'AMC 1v1 vs KEEPER',
        zone: boxZone,
        attacker: amcPlayer.name,
        attackerPlayer: amcPlayer,
        attackerSlotId: amcPlayer.slotId || null,
        attackerPos: amcPlayer.effectivePos,
        attackerSkillName: 'Finishing',
        attackerSkill: finSkill,
        attackerBonus: attMentalityMod,
        attackerDie: finDie,
        attackerTotal: finTotal,
        defender: gk?.name || 'GK',
        defenderPlayer: dcForFoul || null,
        defenderSlotId: dcForFoul?.slotId || null,
        defenderPos: 'GK',
        defenderSkillName: 'Handling',
        defenderSkill: gkHand,
        defenderBonus: defMentalityMod,
        defenderDie: gkDie,
        defenderTotal: gkTotal,
        diff: finDiff,
        requiredDiff: 3,
        success: isGoal,
        stepLog: finLog,
        summary: isGoal
          ? `⚽ 1v1 GOAL! ${amcPlayer.name} beats ${gk?.name || 'GK'} in [${boxZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(attMentalityMod)}=${finTotal} vs d10:${gkDie}+Hand:${gkHand}${fmtBonus(defMentalityMod)}=${gkTotal}, diff +${finDiff} >= 3)`
          : `${gk?.name || 'GK'} wins the 1-on-1 against ${amcPlayer.name} in [${boxZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(attMentalityMod)}=${finTotal} vs d10:${gkDie}+Hand:${gkHand}${fmtBonus(defMentalityMod)}=${gkTotal}, diff ${finDiff >= 0 ? `+${finDiff}` : finDiff} < 3)`
      });

      logs.push(finLog);
      const initiator = counterTriggered ? midMarker : (isGkLongDistribution ? initGk : midPasser);
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide,
        nextAttacker: defendingSide,
        counterTriggered,
        startZone,
        activeZone: boxZone,
        zonePath,
        steps,
        logs,
        isGoal,
        isShot: true,
        isOnTarget: true,
        scorer: isGoal ? amcPlayer : null,
        assister: isGoal && initiator?.name !== amcPlayer.name ? initiator : null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }

    // 3. AMC Instruction: THROUGH BALL ('through_ball', diff >= 4 -> Striker gets +3 Finishing) or PASS ('pass', diff >= 2)
    const isAmcThroughBall = amcInstr === 'through_ball';
    const requiredAmcDiff = isAmcThroughBall ? 4 : 2;
    const strikerThroughBallBonus = isAmcThroughBall ? 3 : 0;

    const tbPassDie = rollD10();
    const tbMarkDie = rollD10();
    const tbPassSkill = amcPlayer.skills.passing;
    const tbMarkSkill = oppCentralDef.skills.marking;
    const tbAttBonus = (attRoster.amcCount >= 2 ? 1 : 0) + attMentalityMod + step2SkillBonus;
    const tbDefBonus = (defRoster.dmcCount >= 2 ? 1 : 0) + defMentalityMod + dmcManMarkBonus;
    const tbPassTotal = tbPassDie + tbPassSkill + tbAttBonus;
    const tbMarkTotal = tbMarkDie + tbMarkSkill + tbDefBonus;
    const tbDiff = tbPassTotal - tbMarkTotal;
    const tbSuccess = tbDiff >= requiredAmcDiff;

    const tbLog = tbSuccess
      ? {
        text: `${midEventMin}' ${amcPlayer.name} (${attTeamName}) ${isAmcThroughBall ? 'slides a killer through-ball into space behind' : 'plays a crisp pass past'} ${oppCentralDef.name} to set up a huge chance in the box!`,
        type: 'chance'
      }
      : {
        text: `${midEventMin}' ${amcPlayer.name} (${attTeamName}) tries a ${isAmcThroughBall ? 'killer through-ball' : 'pass into the box'}, but ${oppCentralDef.name} (${defTeamName}) reads the danger and intercepts cleanly!`,
        type: 'save'
      };

    steps.push({
      phase: isAmcThroughBall ? 'AMC KILLER THROUGH-BALL (+3)' : 'CENTRAL BOX PASS',
      zone: secondZone,
      attacker: amcPlayer.name,
      attackerPlayer: amcPlayer,
      attackerSlotId: amcPlayer.slotId || null,
      attackerPos: amcPlayer.effectivePos,
      attackerSkillName: 'Passing',
      attackerSkill: tbPassSkill,
      attackerBonus: tbAttBonus,
      attackerDie: tbPassDie,
      attackerTotal: tbPassTotal,
      defender: oppCentralDef.name,
      defenderPlayer: oppCentralDef,
      defenderSlotId: oppCentralDef.slotId || null,
      defenderPos: oppCentralDef.effectivePos,
      defenderSkillName: 'Marking',
      defenderSkill: tbMarkSkill,
      defenderBonus: tbDefBonus,
      defenderDie: tbMarkDie,
      defenderTotal: tbMarkTotal,
      diff: tbDiff,
      requiredDiff: requiredAmcDiff,
      success: tbSuccess,
      stepLog: tbLog,
      summary: tbSuccess
        ? `${amcPlayer.name} ${isAmcThroughBall ? 'splits the defense (+3 Finishing to Striker!)' : 'passes'} through [${secondZone.toUpperCase()}] past ${oppCentralDef.name}! (d10:${tbPassDie}+Pass:${tbPassSkill}${fmtBonus(tbAttBonus)}=${tbPassTotal} vs d10:${tbMarkDie}+Mark:${tbMarkSkill}${fmtBonus(tbDefBonus)}=${tbMarkTotal}, diff +${tbDiff} >= ${requiredAmcDiff})`
        : `${oppCentralDef.name} intercepts ${amcPlayer.name} in [${secondZone.toUpperCase()}] (d10:${tbPassDie}+Pass:${tbPassSkill}${fmtBonus(tbAttBonus)}=${tbPassTotal} vs d10:${tbMarkDie}+Mark:${tbMarkSkill}${fmtBonus(tbDefBonus)}=${tbMarkTotal}, diff ${tbDiff >= 0 ? `+${tbDiff}` : tbDiff} < ${requiredAmcDiff})`
    });

    logs.push(tbLog);

    if (!tbSuccess) {
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide,
        nextAttacker: defendingSide,
        counterTriggered,
        startZone,
        activeZone: secondZone,
        zonePath,
        steps,
        logs,
        isGoal: false,
        isShot: false,
        isOnTarget: false,
        scorer: null,
        assister: null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }

    // Striker finishes in d2 (Home) / a2 (Away) (50% chance which Striker if 2 Strikers)
    zonePath.push(boxZone);
    const striker = pickRandom(attRoster.strikers);
    const boxDef = getBoxDefenseTarget('standard');
    const finDie = rollD10();
    const gkDie = rollD10();
    const finSkill = striker.skills.finishing;
    const poacherBonus = striker.instruction === 'poacher' ? 1 : 0;
    const totalFinBonus = attMentalityMod + strikerThroughBallBonus + poacherBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus;
    const finTotal = finDie + finSkill + totalFinBonus;
    const gkTotal = gkDie + boxDef.combinedSkill + totalDefBonus;
    const finDiff = finTotal - gkTotal;
    const isGoal = finDiff >= 3;

    const finLog = isGoal
      ? {
        text: `${midEventMin}' ⚽ GOAL! ${amcPlayer.name} slips ${isAmcThroughBall ? 'a defence-splitting through-ball' : 'a clever pass'} into the box, and ${striker.name} guides a composed finish past ${boxDef.gk?.name || 'the keeper'}!`,
        type: 'goal'
      }
      : {
        text: `${midEventMin}' 🧤 SAVE! ${striker.name} latches onto ${amcPlayer.name}'s pass inside the penalty area, but ${boxDef.gk?.name || 'the keeper'} and ${boxDef.dc?.name || 'the defense'} combine to keep it out! ${defTeamName} builds from the back!`,
        type: 'save'
      };

    steps.push({
      phase: isAmcThroughBall ? 'THROUGH-BALL FINISH (+3)' : 'BOX FINISH (1v1)',
      zone: boxZone,
      attacker: striker.name,
      attackerPlayer: striker,
      attackerSlotId: striker.slotId || null,
      attackerPos: striker.effectivePos,
      attackerSkillName: 'Finishing',
      attackerSkill: finSkill,
      attackerBonus: totalFinBonus,
      attackerDie: finDie,
      attackerTotal: finTotal,
      defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
      defenderPlayer: boxDef.dc || null,
      defenderSlotId: boxDef.dc?.slotId || null,
      defenderPos: 'DC+GK',
      defenderSkillName: boxDef.formulaName,
      defenderSkill: boxDef.combinedSkill,
      defenderBonus: totalDefBonus,
      defenderDie: gkDie,
      defenderTotal: gkTotal,
      diff: finDiff,
      requiredDiff: 3,
      success: isGoal,
      stepLog: finLog,
      summary: isGoal
        ? `⚽ GOAL! ${striker.name} finishes in [${boxZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff +${finDiff} >= 3)`
        : `${boxDef.gk?.name || 'GK'} denies ${striker.name} in [${boxZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff ${finDiff >= 0 ? `+${finDiff}` : finDiff} < 3)`
    });

    logs.push(finLog);

    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: boxZone,
      zonePath,
      steps,
      logs,
      isGoal,
      isShot: true,
      isOnTarget: true,
      scorer: isGoal ? striker : null,
      assister: isGoal && amcPlayer.name !== striker.name ? amcPlayer : null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  }

  // ---------------------------------------------------------------------------
  // BRANCH B: WING & OVERLAPPING FB/WB ATTACK ON C1 / C3 (Home) or B1 / B3 (Away)
  // ---------------------------------------------------------------------------
  const isLeftChannel = chosenChannel.channel === 'left';
  const primaryBorderFlankBox = isHomeAtt ? (isLeftChannel ? 'c1' : 'c3') : (isLeftChannel ? 'b3' : 'b1');
  const secondaryBorderFlankBox = isHomeAtt ? (isLeftChannel ? 'b1' : 'b3') : (isLeftChannel ? 'c3' : 'c1');
  const borderFlankPlayers = [
    ...(attRoster.zonePlayers[primaryBorderFlankBox] || []),
    ...(attRoster.zonePlayers[secondaryBorderFlankBox] || [])
  ];

  // In Short Passing mode from b2/c2, the ball can only reach bordering boxes (b1, b3, c1, c2, c3).
  // If no teammate is in the bordering flank boxes (e.g. winger pushed to d1/d3 and FB stayed at a1/a3), turnover!
  if (!isGkLongDistribution && attTeamTactics && borderFlankPlayers.length === 0) {
    const passerName = (counterTriggered ? midMarker : midPasser)?.name || 'Midfield';
    return returnEmptyZoneTurnover({
      targetZone: primaryBorderFlankBox,
      phaseLabel: 'SHORT PASS (NO BORDERING RECEIVER)',
      logText: `${midEventMin}' ${passerName} (${attTeamName}) looks for a short pass out to [${primaryBorderFlankBox.toUpperCase()}], but no teammate is in the bordering flank box and ${defTeamName} intercepts!`,
      summaryText: `Short pass to [${primaryBorderFlankBox.toUpperCase()}/${secondaryBorderFlankBox.toUpperCase()}] — no teammate in bordering box (turnover)`
    });
  }

  const pureWingPool = isLeftChannel ? attRoster.pureLeftWings : attRoster.pureRightWings;
  const attFlankFb = isLeftChannel ? attRoster.dl : attRoster.dr;
  const fbOverlaps = isLeftChannel ? attRoster.dlOverlaps : attRoster.drOverlaps;

  // In explicit Short Passing mode, pick from the players actually in the bordering box (c1/b1 or c3/b3);
  // otherwise if both a winger and an overlapping FB/WB are on that flank, 50% chance for who acts/crosses!
  const winger = (isGkLongDistribution && !counterTriggered)
    ? midPasser
    : ((attTeamTactics && borderFlankPlayers.length > 0)
      ? pickRandom(borderFlankPlayers)
      : pickFlankActor(pureWingPool, attFlankFb, fbOverlaps));

  const isAttackingWingBack = (winger === attFlankFb && winger?.duty === 'attack');
  const isAttackingWideActor = Boolean(winger && winger.duty === 'attack');
  const wingDeepZone = isHomeAtt ? (isLeftChannel ? 'd1' : 'd3') : (isLeftChannel ? 'a3' : 'a1');
  const boxZone = isHomeAtt ? 'd2' : 'a2';

  // Attacking Wing-Backs (WB +ATT) and Attacking Wingers/Wide Mids (ML/MR/AML/AMR +ATT) push into d1/d3 (a1/a3 for Away)
  if (isAttackingWideActor && zonePath[zonePath.length - 1] !== wingDeepZone) {
    zonePath.push(wingDeepZone);
  }
  const actionZone = isAttackingWideActor ? wingDeepZone : secondZone;

  // Opponent fullback defending that flank:
  // Attacking Left Wing faces Opponent Right Back (dr); Attacking Right Wing faces Opponent Left Back (dl)
  const oppFullback = isLeftChannel ? defRoster.dr : defRoster.dl;
  const oppFbTightMarkMod = oppFullback?.instruction === 'tight_mark_winger' ? 1 : (oppFullback?.instruction === 'aggressive_press' ? -1 : 0);
  const oppFbTackleMod = oppFullback?.instruction === 'aggressive_press' ? 1 : (oppFullback?.instruction === 'tight_mark_winger' ? -1 : 0);

  // Resolve active instruction for Winger or Overlapping FB/WB:
  // 'high_cross' | 'low_cross' | 'dribble' | 'through_ball' | 'long_shot'
  const canWingLongShot = Boolean(
    winger &&
    winger !== attFlankFb &&
    (['AMR', 'AML', 'LW', 'RW', 'FL', 'FR'].includes(winger.effectivePos) || winger.duty === 'attack')
  );
  const rawWingInstr = winger?.instruction;
  const wingAction = (
    ['high_cross', 'low_cross', 'dribble', 'through_ball'].includes(rawWingInstr) ||
    (rawWingInstr === 'long_shot' && canWingLongShot)
  )
    ? rawWingInstr
    : (winger?.duty === 'attack' ? 'dribble' : 'high_cross');

  // 0. Attacking Winger / Attacking Wide Mid Instruction: LONG SHOT ('long_shot')
  if (wingAction === 'long_shot') {
    return resolveLongShotOutcome({
      shooter: winger,
      shotZone: actionZone,
      targetBoxZone: boxZone,
      extraAttBonus: 0,
      extraDefBonus: 0,
      isFlank: true
    });
  }

  // 1. Winger / WB (+MID) Instruction: THROUGH BALL ('through_ball')
  if (wingAction === 'through_ball') {
    const tbDie = rollD10();
    const fbDie = rollD10();
    const tbSkill = winger.skills.passing;
    const fbSkill = oppFullback.skills.marking;
    const tbAttBonus = attMentalityMod + step2SkillBonus;
    const tbDefBonus = defMentalityMod + oppFbTightMarkMod;
    const tbTotal = tbDie + tbSkill + tbAttBonus;
    const fbTotal = fbDie + fbSkill + tbDefBonus;
    const tbDiff = tbTotal - fbTotal;
    const tbSuccess = tbDiff >= 4;

    const tbLog = tbSuccess
      ? {
        text: `${midEventMin}' 🗡️ ${winger.name} (${attTeamName}) curls a sweeping diagonal through-ball past ${oppFullback.name} to put the striker through on goal!`,
        type: 'chance'
      }
      : {
        text: `${midEventMin}' ${winger.name} (${attTeamName}) looks for a diagonal through-ball into the box, but ${oppFullback.name} (${defTeamName}) cuts out the pass and takes possession!`,
        type: 'save'
      };

    steps.push({
      phase: 'FLANK THROUGH-BALL (+3)',
      zone: actionZone,
      attacker: winger.name,
      attackerPlayer: winger,
      attackerSlotId: winger.slotId || null,
      attackerPos: winger.effectivePos,
      attackerSkillName: 'Passing',
      attackerSkill: tbSkill,
      attackerBonus: tbAttBonus,
      attackerDie: tbDie,
      attackerTotal: tbTotal,
      defender: oppFullback.name,
      defenderPlayer: oppFullback,
      defenderSlotId: oppFullback.slotId || null,
      defenderPos: oppFullback.effectivePos,
      defenderSkillName: 'Marking',
      defenderSkill: fbSkill,
      defenderBonus: tbDefBonus,
      defenderDie: fbDie,
      defenderTotal: fbTotal,
      diff: tbDiff,
      requiredDiff: 4,
      success: tbSuccess,
      stepLog: tbLog,
      summary: tbSuccess
        ? `🗡️ ${winger.name} threads a flank through-ball from [${actionZone.toUpperCase()}] (+3 Finishing to Striker)! (d10:${tbDie}+Pass:${tbSkill}${fmtBonus(tbAttBonus)}=${tbTotal} vs d10:${fbDie}+Mark:${fbSkill}${fmtBonus(tbDefBonus)}=${fbTotal}, diff +${tbDiff} >= 4)`
        : `${oppFullback.name} intercepts ${winger.name}'s flank through-ball in [${actionZone.toUpperCase()}] (diff ${tbDiff >= 0 ? `+${tbDiff}` : tbDiff} < 4)`
    });

    logs.push(tbLog);
    if (!tbSuccess) {
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide,
        nextAttacker: defendingSide,
        counterTriggered,
        startZone,
        activeZone: actionZone,
        zonePath,
        steps,
        logs,
        isGoal: false,
        isShot: false,
        isOnTarget: false,
        scorer: null,
        assister: null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }

    zonePath.push(boxZone);
    const striker = pickRandom(attRoster.strikers);
    const boxDef = getBoxDefenseTarget('low_cross');
    const finDie = rollD10();
    const gkDie = rollD10();
    const finSkill = striker.skills.finishing;
    const poacherBonus = striker.instruction === 'poacher' ? 1 : 0;
    const totalFinBonus = attMentalityMod + 3 + poacherBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus;
    const finTotal = finDie + finSkill + totalFinBonus;
    const gkTotal = gkDie + boxDef.combinedSkill + totalDefBonus;
    const finDiff = finTotal - gkTotal;
    const isGoal = finDiff >= 3;

    const finLog = isGoal
      ? {
        text: `${midEventMin}' ⚽ GOAL! ${striker.name} sprints onto ${winger.name}'s diagonal through-ball and fires cleanly past ${boxDef.gk?.name || 'the keeper'}!`,
        type: 'goal'
      }
      : {
        text: `${midEventMin}' 🧤 SAVE! ${striker.name} meets ${winger.name}'s through-ball in the box, but ${boxDef.gk?.name || 'the keeper'} and ${boxDef.dc?.name || 'the defense'} block the effort!`,
        type: 'save'
      };

    steps.push({
      phase: 'THROUGH-BALL FINISH (+3)',
      zone: boxZone,
      attacker: striker.name,
      attackerPlayer: striker,
      attackerSlotId: striker.slotId || null,
      attackerPos: striker.effectivePos,
      attackerSkillName: 'Finishing',
      attackerSkill: finSkill,
      attackerBonus: totalFinBonus,
      attackerDie: finDie,
      attackerTotal: finTotal,
      defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
      defenderPlayer: boxDef.dc || null,
      defenderSlotId: boxDef.dc?.slotId || null,
      defenderPos: 'DC+GK',
      defenderSkillName: boxDef.formulaName,
      defenderSkill: boxDef.combinedSkill,
      defenderBonus: totalDefBonus,
      defenderDie: gkDie,
      defenderTotal: gkTotal,
      diff: finDiff,
      requiredDiff: 3,
      success: isGoal,
      stepLog: finLog,
      summary: isGoal
        ? `⚽ GOAL! ${striker.name} converts ${winger.name}'s through-ball in [${boxZone.toUpperCase()}]!`
        : `${boxDef.gk?.name || 'GK'} denies ${striker.name} in [${boxZone.toUpperCase()}]`
    });
    logs.push(finLog);

    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: boxZone,
      zonePath,
      steps,
      logs,
      isGoal,
      isShot: true,
      isOnTarget: true,
      scorer: isGoal ? striker : null,
      assister: isGoal && winger.name !== striker.name ? winger : null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  }

  // 2. Winger / Attacking WB Instruction: DRIBBLE ('dribble') -> Beats opponent tackling -> 1-on-1 with Keeper!
  if (wingAction === 'dribble') {
    const dribDie = rollD10();
    const tackDie = rollD10();
    const dribSkill = winger.skills.dribbling;
    const tackSkill = oppFullback.skills.tackling;
    const dribAttBonus = attMentalityMod + step2SkillBonus;
    const dribDefBonus = defMentalityMod + oppFbTackleMod;
    const dribTotal = dribDie + dribSkill + dribAttBonus;
    const tackTotal = tackDie + tackSkill + dribDefBonus;
    const dribDiff = dribTotal - tackTotal;
    const dribSuccess = dribDiff >= 2;

    const dribLog = dribSuccess
      ? {
        text: `${midEventMin}' 🔥 ${winger.name} (${attTeamName}) skins ${oppFullback.name} down the wing and cuts inside, 1-on-1 with the keeper!`,
        type: 'chance'
      }
      : {
        text: `${midEventMin}' ${winger.name} (${attTeamName}) tries to take on ${oppFullback.name} down the flank, but ${oppFullback.name} wins a crunching tackle to reclaim possession!`,
        type: 'save'
      };

    steps.push({
      phase: isAttackingWingBack ? 'WB OVERLAP DRIBBLE (1v1)' : 'WING DRIBBLE (1v1)',
      zone: actionZone,
      attacker: winger.name,
      attackerPlayer: winger,
      attackerSlotId: winger.slotId || null,
      attackerPos: winger.effectivePos,
      attackerSkillName: 'Dribbling',
      attackerSkill: dribSkill,
      attackerBonus: dribAttBonus,
      attackerDie: dribDie,
      attackerTotal: dribTotal,
      defender: oppFullback.name,
      defenderPlayer: oppFullback,
      defenderSlotId: oppFullback.slotId || null,
      defenderPos: oppFullback.effectivePos,
      defenderSkillName: 'Tackling',
      defenderSkill: tackSkill,
      defenderBonus: dribDefBonus,
      defenderDie: tackDie,
      defenderTotal: tackTotal,
      diff: dribDiff,
      requiredDiff: 2,
      success: dribSuccess,
      stepLog: dribLog,
      summary: dribSuccess
        ? `${winger.name} dribbles past ${oppFullback.name} in [${actionZone.toUpperCase()}]! (d10:${dribDie}+Drib:${dribSkill}${fmtBonus(dribAttBonus)}=${dribTotal} vs d10:${tackDie}+Tack:${tackSkill}${fmtBonus(dribDefBonus)}=${tackTotal}, diff +${dribDiff} >= 2)`
        : `${oppFullback.name} tackles ${winger.name} in [${actionZone.toUpperCase()}] (d10:${dribDie}+Drib:${dribSkill}${fmtBonus(dribAttBonus)}=${dribTotal} vs d10:${tackDie}+Tack:${tackSkill}${fmtBonus(dribDefBonus)}=${tackTotal}, diff ${dribDiff >= 0 ? `+${dribDiff}` : dribDiff} < 2)`
    });

    logs.push(dribLog);

    if (!dribSuccess) {
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide,
        nextAttacker: defendingSide,
        counterTriggered,
        startZone,
        activeZone: actionZone,
        zonePath,
        steps,
        logs,
        isGoal: false,
        isShot: false,
        isOnTarget: false,
        scorer: null,
        assister: null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }

    // Dribble succeeded -> Winger / Attacking WB is in a 1-on-1 shooting chance with the keeper!
    if (zonePath[zonePath.length - 1] !== wingDeepZone) {
      zonePath.push(wingDeepZone);
    }

    const boxDef = getBoxDefenseTarget('standard');
    const finDie = rollD10();
    const gkDie = rollD10();
    const finSkill = winger.skills.finishing;
    const totalFinBonus = attMentalityMod;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus;
    const finTotal = finDie + finSkill + totalFinBonus;
    const gkTotal = gkDie + boxDef.combinedSkill + totalDefBonus;
    const finDiff = finTotal - gkTotal;
    const isGoal = finDiff >= 3;

    const dribFinishLog = isGoal
      ? {
        text: `${midEventMin}' ⚽ GOAL! ${winger.name} bursts past ${oppFullback.name} into the penalty area and rifles a low shot past ${boxDef.gk?.name || 'the keeper'}!`,
        type: 'goal'
      }
      : {
        text: `${midEventMin}' 🧤 ${winger.name} beats ${oppFullback.name} into the box and strikes at goal, but ${boxDef.gk?.name || 'the keeper'} makes a crucial 1-on-1 save! ${defTeamName} clears!`,
        type: 'save'
      };

    steps.push({
      phase: isAttackingWingBack ? 'WB OVERLAP 1v1 SHOT' : 'WINGER 1v1 SHOT',
      zone: wingDeepZone,
      attacker: winger.name,
      attackerPlayer: winger,
      attackerSlotId: winger.slotId || null,
      attackerPos: winger.effectivePos,
      attackerSkillName: 'Finishing',
      attackerSkill: finSkill,
      attackerBonus: totalFinBonus,
      attackerDie: finDie,
      attackerTotal: finTotal,
      defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
      defenderPlayer: boxDef.dc || null,
      defenderSlotId: boxDef.dc?.slotId || null,
      defenderPos: 'DC+GK',
      defenderSkillName: boxDef.formulaName,
      defenderSkill: boxDef.combinedSkill,
      defenderBonus: totalDefBonus,
      defenderDie: gkDie,
      defenderTotal: gkTotal,
      diff: finDiff,
      requiredDiff: 3,
      success: isGoal,
      stepLog: dribFinishLog,
      summary: isGoal
        ? `⚽ GOAL! ${winger.name} scores 1v1 in [${wingDeepZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff +${finDiff} >= 3)`
        : `${boxDef.gk?.name || 'GK'} saves ${winger.name}'s 1v1 shot in [${wingDeepZone.toUpperCase()}] (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff ${finDiff >= 0 ? `+${finDiff}` : finDiff} < 3)`
    });

    logs.push(dribFinishLog);

    const initiator = counterTriggered ? midMarker : (isGkLongDistribution ? initGk : midPasser);
    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: wingDeepZone,
      zonePath,
      steps,
      logs,
      isGoal,
      isShot: true,
      isOnTarget: true,
      scorer: isGoal ? winger : null,
      assister: isGoal && initiator?.name !== winger.name ? initiator : null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  }

  // ---------------------------------------------------------------------------
  // 3. WINGER / WB CROSSING: 'high_cross' vs 'low_cross'
  //    - High Cross: Striker Heading vs (Opp DC Heading + Opp GK Handling)/2
  //    - Low Cross:  Striker Finishing vs (Opp DC Tackling + Opp GK Handling)/2
  //    - 50% random chance which DC and which Striker contest it if there are 2!
  // ---------------------------------------------------------------------------
  const isLowCross = wingAction === 'low_cross';
  const crossDie = rollD10();
  const fbMarkDie = rollD10();
  const crossSkill = winger.skills.crossing;
  const fbMarkSkill = oppFullback.skills.marking;
  const crossAttBonus = attMentalityMod + step2SkillBonus;
  const crossDefBonus = defMentalityMod + oppFbTightMarkMod;
  const crossTotal = crossDie + crossSkill + crossAttBonus;
  const fbMarkTotal = fbMarkDie + fbMarkSkill + crossDefBonus;
  const crossDiff = crossTotal - fbMarkTotal;
  const crossSuccess = crossDiff >= 2;

  const crossTypeLabel = isLowCross ? 'LOW CROSS' : 'HIGH CROSS';
  const crossLog = crossSuccess
    ? {
      text: `${midEventMin}' ${winger.name} (${attTeamName}) creates half a yard on ${oppFullback.name} and whips a dangerous ${isLowCross ? 'low driven cross' : 'high curling cross'} into the six-yard box!`,
      type: 'chance'
    }
    : {
      text: `${midEventMin}' ${winger.name} (${attTeamName}) tries to swing a ${isLowCross ? 'low cross' : 'high cross'} into the middle, but ${oppFullback.name} (${defTeamName}) closes down quickly to block it! ${defTeamName} takes possession!`,
      type: 'save'
    };

  steps.push({
    phase: `WING ${crossTypeLabel}`,
    zone: actionZone,
    attacker: winger.name,
    attackerPlayer: winger,
    attackerSlotId: winger.slotId || null,
    attackerPos: winger.effectivePos,
    attackerSkillName: 'Crossing',
    attackerSkill: crossSkill,
    attackerBonus: crossAttBonus,
    attackerDie: crossDie,
    attackerTotal: crossTotal,
    defender: oppFullback.name,
    defenderPlayer: oppFullback,
    defenderSlotId: oppFullback.slotId || null,
    defenderPos: oppFullback.effectivePos,
    defenderSkillName: 'Marking',
    defenderSkill: fbMarkSkill,
    defenderBonus: crossDefBonus,
    defenderDie: fbMarkDie,
    defenderTotal: fbMarkTotal,
    diff: crossDiff,
    requiredDiff: 2,
    success: crossSuccess,
    stepLog: crossLog,
    summary: crossSuccess
      ? `${winger.name} delivers a ${isLowCross ? 'low cross' : 'high cross'} from [${actionZone.toUpperCase()}] past ${oppFullback.name}! (d10:${crossDie}+Cross:${crossSkill}${fmtBonus(crossAttBonus)}=${crossTotal} vs d10:${fbMarkDie}+Mark:${fbMarkSkill}${fmtBonus(crossDefBonus)}=${fbMarkTotal}, diff +${crossDiff} >= 2)`
      : `${oppFullback.name} blocks ${winger.name}'s ${isLowCross ? 'low cross' : 'high cross'} in [${actionZone.toUpperCase()}] (d10:${crossDie}+Cross:${crossSkill}${fmtBonus(crossAttBonus)}=${crossTotal} vs d10:${fbMarkDie}+Mark:${fbMarkSkill}${fmtBonus(crossDefBonus)}=${fbMarkTotal}, diff ${crossDiff >= 0 ? `+${crossDiff}` : crossDiff} < 2)`
  });

  logs.push(crossLog);

  if (!crossSuccess) {
    return {
      minutesElapsed: 2,
      step1Side: initSide,
      attackingSide,
      nextAttacker: defendingSide,
      counterTriggered,
      startZone,
      activeZone: actionZone,
      zonePath,
      steps,
      logs,
      isGoal: false,
      isShot: false,
      isOnTarget: false,
      scorer: null,
      assister: null,
      homePenaltyTaker,
      awayPenaltyTaker,
      homeGk,
      awayGk,
      homeZonePlayers: homeRoster.zonePlayers,
      awayZonePlayers: awayRoster.zonePlayers
    };
  }

  // Cross succeeded! Ball flies into d2 (Home) / a2 (Away):
  // - 50% random chance which Striker and which DC contest it
  // - High Cross: Striker Heading vs (Opp DC Heading + Opp GK Handling)/2
  // - Low Cross:  Striker Finishing vs (Opp DC Tackling + Opp GK Handling)/2
  zonePath.push(boxZone);
  const striker = pickRandom(attRoster.strikers);
  const boxDef = getBoxDefenseTarget(isLowCross ? 'low_cross' : 'high_cross');
  const finishDie = rollD10();
  const gkDie = rollD10();

  const strikerSkill = isLowCross ? striker.skills.finishing : striker.skills.heading;
  const strikerSkillName = isLowCross ? 'Finishing' : 'Heading';
  const strikerInstrMod = isLowCross
    ? (striker.instruction === 'poacher' ? 1 : (striker.instruction === 'target_man' ? -1 : 0))
    : (striker.instruction === 'target_man' ? 1 : (striker.instruction === 'poacher' ? -1 : 0));

  const totalAttBonus = attMentalityMod + strikerInstrMod;
  const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus;

  const finishTotal = finishDie + strikerSkill + totalAttBonus;
  const gkTotal = gkDie + boxDef.combinedSkill + totalDefBonus;
  const finishDiff = finishTotal - gkTotal;
  const isGoal = finishDiff >= 3;

  const finishLog = isGoal
    ? {
      text: isLowCross
        ? `${midEventMin}' ⚽ GOAL! ${winger.name}'s low whipped cross finds ${striker.name} in space, who sweeps a clinical finish past ${boxDef.dc?.name || 'the defender'} and ${boxDef.gk?.name || 'the keeper'}!`
        : `${midEventMin}' ⚽ GOAL! Pinpoint high cross from ${winger.name} finds ${striker.name}, who towers above ${boxDef.dc?.name || 'the defender'} to power a header past ${boxDef.gk?.name || 'the keeper'}!`,
      type: 'goal'
    }
    : {
      text: isLowCross
        ? `${midEventMin}' 🧤 ${winger.name}'s low cross reaches ${striker.name} in the area, but ${boxDef.dc?.name || 'the defender'} pressures the shot and ${boxDef.gk?.name || 'the keeper'} denies the finish!`
        : `${midEventMin}' 🧤 ${winger.name}'s high cross reaches ${striker.name} in the box, but ${boxDef.dc?.name || 'the defender'} challenges well and ${boxDef.gk?.name || 'the keeper'} stops the header!`,
      type: 'save'
    };

  steps.push({
    phase: isLowCross ? 'LOW CROSS FINISH' : 'HIGH CROSS HEADER',
    zone: boxZone,
    attacker: striker.name,
    attackerPlayer: striker,
    attackerSlotId: striker.slotId || null,
    attackerPos: striker.effectivePos,
    attackerSkillName: strikerSkillName,
    attackerSkill: strikerSkill,
    attackerBonus: totalAttBonus,
    attackerDie: finishDie,
    attackerTotal: finishTotal,
    defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
    defenderPlayer: boxDef.dc || null,
    defenderSlotId: boxDef.dc?.slotId || null,
    defenderPos: 'DC+GK',
    defenderSkillName: boxDef.formulaName,
    defenderSkill: boxDef.combinedSkill,
    defenderBonus: totalDefBonus,
    defenderDie: gkDie,
    defenderTotal: gkTotal,
    diff: finishDiff,
    requiredDiff: 3,
    success: isGoal,
    stepLog: finishLog,
    summary: isGoal
      ? `⚽ ${isLowCross ? 'LOW CROSS' : 'HEADER'} GOAL! ${striker.name} converts ${winger.name}'s cross in [${boxZone.toUpperCase()}]! (d10:${finishDie}+${strikerSkillName}:${strikerSkill}${fmtBonus(totalAttBonus)}=${finishTotal} vs d10:${gkDie}+${boxDef.formulaName}:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff +${finishDiff} >= 3)`
      : `${boxDef.dc?.name || 'DC'} & ${boxDef.gk?.name || 'GK'} stop ${striker.name} in [${boxZone.toUpperCase()}] (d10:${finishDie}+${strikerSkillName}:${strikerSkill}${fmtBonus(totalAttBonus)}=${finishTotal} vs d10:${gkDie}+${boxDef.formulaName}:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff ${finishDiff >= 0 ? `+${finishDiff}` : finishDiff} < 3)`
  });

  logs.push(finishLog);

  return {
    minutesElapsed: 2,
    step1Side: initSide,
    attackingSide,
    nextAttacker: defendingSide,
    counterTriggered,
    startZone,
    activeZone: boxZone,
    zonePath,
    steps,
    logs,
    isGoal,
    isShot: true,
    isOnTarget: true,
    scorer: isGoal ? striker : null,
    assister: isGoal && winger.name !== striker.name ? winger : null,
    homePenaltyTaker,
    awayPenaltyTaker,
    homeGk,
    awayGk,
    homeZonePlayers: homeRoster.zonePlayers,
    awayZonePlayers: awayRoster.zonePlayers
  };
}

/**
 * Resolves an in-match penalty kick awarded from a defensive foul inside the box in the 12-Box engine.
 * Formula: d10 + taker.finishing + 4 (spot advantage) vs d10 + gk.handling (goal if attacker total > keeper total).
 */
export function resolveZone12PenaltyKick({
  attackingSide = 'home',
  zone = 'd2',
  taker = null,
  gk = null,
  attTeamName = 'Attacker',
  defTeamName = 'Defender',
  minute = 1
}) {
  const safeTaker = taker || { name: 'Penalty Taker', position: 'ST', skills: { finishing: 6 } };
  const safeGk = gk || { name: 'Goalkeeper', position: 'GK', skills: { handling: 6 } };
  const takerSkills = safeTaker.skills || getPlayerSkills(safeTaker);
  const gkSkills = safeGk.skills || getPlayerSkills(safeGk);

  const penDie = rollD10();
  const gkDie = rollD10();
  const finSkill = takerSkills.finishing ?? 6;
  const handSkill = gkSkills.handling ?? 6;
  const spotBonus = 4;
  const penTotal = penDie + finSkill + spotBonus;
  const gkTotal = gkDie + handSkill;
  const diff = penTotal - gkTotal;
  const isGoal = diff >= 1;

  const log = isGoal
    ? {
      text: `${minute}' ⚽ PENALTY GOAL! ${safeTaker.name} (${attTeamName}) steps up and buries the spot-kick past ${safeGk.name}!`,
      type: 'goal'
    }
    : {
      text: `${minute}' 🧤 PENALTY SAVED! ${safeGk.name} (${defTeamName}) guesses right and denies ${safeTaker.name} from the penalty spot!`,
      type: 'save'
    };

  const step = {
    phase: 'PENALTY KICK',
    zone,
    attacker: safeTaker.name,
    attackerPos: safeTaker.position || 'ST',
    attackerSkillName: 'Finishing',
    attackerSkill: finSkill,
    attackerBonus: spotBonus,
    attackerDie: penDie,
    attackerTotal: penTotal,
    defender: safeGk.name,
    defenderPos: 'GK',
    defenderSkillName: 'Handling',
    defenderSkill: handSkill,
    defenderBonus: 0,
    defenderDie: gkDie,
    defenderTotal: gkTotal,
    diff,
    requiredDiff: 1,
    success: isGoal,
    stepLog: log
  };

  return {
    isGoal,
    step,
    log,
    taker: safeTaker,
    gk: safeGk,
    attackingSide
  };
}

const PREVIEW_BOX_CENTERS = {
  d1: { x: 17, y: 14, label: 'D1' },
  d2: { x: 50, y: 14, label: 'D2' },
  d3: { x: 83, y: 14, label: 'D3' },
  c1: { x: 17, y: 37, label: 'C1' },
  c2: { x: 50, y: 37, label: 'C2' },
  c3: { x: 83, y: 37, label: 'C3' },
  b1: { x: 17, y: 60, label: 'B1' },
  b2: { x: 50, y: 60, label: 'B2' },
  b3: { x: 83, y: 60, label: 'B3' },
  a1: { x: 17, y: 82, label: 'A1' },
  a2: { x: 50, y: 81, label: 'A2' },
  a3: { x: 83, y: 82, label: 'A3' }
};

function resolveMatchPreviewRoleLabel(player) {
  const ep = String(player?.effectivePos || 'MC').toUpperCase();
  const duty = player?.duty || 'normal';

  if (ep === 'GK') return { matchPos: 'GK', shifted: false };
  if (['MC', 'CM'].includes(ep)) {
    if (duty === 'attack') return { matchPos: 'AMC', shifted: true };
    if (duty === 'defend') return { matchPos: 'DMC', shifted: true };
    return { matchPos: 'MC', shifted: false };
  }
  if (['DMC', 'DM'].includes(ep)) {
    if (duty === 'attack') return { matchPos: 'AMC', shifted: true };
    if (duty === 'defend') return { matchPos: 'DMC', shifted: false };
    return { matchPos: 'DMC', shifted: false };
  }
  if (['DC', 'CB', 'SW'].includes(ep)) {
    if (duty === 'support') return { matchPos: 'BPD (MID)', shifted: true };
    return { matchPos: 'DC', shifted: false };
  }
  if (['DL', 'LB', 'LWB', 'WBL', 'DR', 'RB', 'RWB', 'WBR'].includes(ep)) {
    if (duty === 'attack') return { matchPos: 'WB (ATT)', shifted: true };
    if (duty === 'support') return { matchPos: 'WB (MID)', shifted: true };
    return { matchPos: ep, shifted: false };
  }
  if (['ML', 'LM', 'DML'].includes(ep)) {
    if (duty === 'attack') return { matchPos: 'AML', shifted: true };
    if (duty === 'defend') return { matchPos: 'DML', shifted: true };
    return { matchPos: ep, shifted: false };
  }
  if (['MR', 'RM', 'DMR'].includes(ep)) {
    if (duty === 'attack') return { matchPos: 'AMR', shifted: true };
    if (duty === 'defend') return { matchPos: 'DMR', shifted: true };
    return { matchPos: ep, shifted: false };
  }
  if (['AML', 'LW', 'FL', 'AMR', 'RW', 'FR'].includes(ep)) {
    if (duty === 'attack') return { matchPos: 'IF / WF', shifted: true };
    return { matchPos: ep, shifted: false };
  }
  return { matchPos: ep, shifted: false };
}

/**
 * Computes exact vertical pitch coordinates (x%, y%) and effective match role badges
 * for every active starter in the lineup according to the 12-Box Engine (`buildTeamZoneRoster`).
 * Only maps real slots present in `lineupObj` (ignores synthetic empty-team fallback).
 */
export function getZone12MatchPreviewPlacements(
  lineupObj = {},
  rolesMap = {},
  formationKey = '4-4-2',
  instructionsMap = {}
) {
  const activeEntries = Object.entries(lineupObj || {}).filter(([, p]) => Boolean(p));
  if (activeEntries.length === 0) return {};

  const roster = buildTeamZoneRoster(lineupObj, rolesMap, 'home', {}, formationKey, instructionsMap);
  const placements = {};

  Object.entries(roster.zonePlayers).forEach(([boxId, boxList]) => {
    if (!Array.isArray(boxList) || boxList.length === 0) return;
    const center = PREVIEW_BOX_CENTERS[boxId] || { x: 50, y: 50, label: boxId.toUpperCase() };
    const isCenterCol = boxId.endsWith('2');

    // Keep GK anchored cleanly at the bottom of a2 while spreading DCs above him
    const gkPlayers = boxList.filter(p => p.effectivePos === 'GK' || p === roster.gk);
    const outfieldPlayers = boxList.filter(p => !gkPlayers.includes(p));

    gkPlayers.forEach((p) => {
      const { matchPos, shifted } = resolveMatchPreviewRoleLabel(p);
      placements[p.slotId] = {
        slotId: p.slotId,
        boxId,
        boxLabel: boxId.toUpperCase(),
        x: 50,
        y: 92,
        basePos: p.effectivePos,
        matchPos,
        duty: p.duty,
        shifted
      };
    });

    const count = outfieldPlayers.length;
    outfieldPlayers.forEach((p, idx) => {
      const { matchPos, shifted } = resolveMatchPreviewRoleLabel(p);
      let x = center.x;
      let y = boxId === 'a2' ? 76 : center.y;

      if (count > 1) {
        if (isCenterCol) {
          if (count <= 3) {
            const spread = count === 2 ? 26 : 36;
            x = center.x - spread / 2 + (idx * spread) / (count - 1);
          } else {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            x = center.x + (col === 0 ? -13 : 13);
            y = y + (row === 0 ? -5.5 : 5.5);
          }
        } else {
          // Wing lane boxes (a1/b1/c1/d1 or a3/b3/c3/d3): stagger vertically & slightly inward
          const yStep = count === 2 ? 11 : 9;
          y = center.y - ((count - 1) * yStep) / 2 + idx * yStep;
        }
      }

      placements[p.slotId] = {
        slotId: p.slotId,
        boxId,
        boxLabel: boxId.toUpperCase(),
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(8, Math.min(92, y)),
        basePos: p.effectivePos,
        matchPos,
        duty: p.duty,
        shifted
      };
    });
  });

  return placements;
}
