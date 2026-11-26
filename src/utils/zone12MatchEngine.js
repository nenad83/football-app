import { getFormationSlots, getIdealSlotPosition } from '../components/FormationTactics';
import { getDefaultInstructionForSlot } from './tacticalRoleEngine';
import { resolveFoulCheck } from './matchEngine';

function getTacklingMod(teamTacticsObj = null) {
  const mode = String(teamTacticsObj?.tackling || 'normal').toLowerCase();
  if (mode === 'hard') return 1;
  if (mode === 'easy') return -1;
  return 0;
}

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
  const allLeftWings = nonGkPool.filter(p => ['ML', 'LM', 'AML', 'LW', 'FL', 'DML'].includes(p.effectivePos));
  const allRightWings = nonGkPool.filter(p => ['MR', 'RM', 'AMR', 'RW', 'FR', 'DMR'].includes(p.effectivePos));
  const cutInsideWingers = [...allLeftWings, ...allRightWings].filter(p => p.instruction === 'cut_inside');
  const pureLeftWings = allLeftWings.filter(p => p.instruction !== 'cut_inside');
  const pureRightWings = allRightWings.filter(p => p.instruction !== 'cut_inside');
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
  // 1) In Possession: An MC with Attacking duty ('attack') acts as an AMC in c2 (b2 for Away),
  //    unless instructed as a 'shadow_striker' which surges forward into d2/a2 as a box attacker.
  const attackingMCs = mcs.filter(p => p.duty === 'attack');
  const effectiveAmcs = [...amcs, ...attackingMCs];
  const shadowStrikers = effectiveAmcs.filter(p => p.instruction === 'shadow_striker');
  const holdingAmcs = effectiveAmcs.filter(p => p.instruction !== 'shadow_striker');

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
    const isCutInsideWinger = ['ML', 'LM', 'DML', 'AML', 'LW', 'FL', 'MR', 'RM', 'DMR', 'AMR', 'RW', 'FR'].includes(ep) && p.instruction === 'cut_inside';
    const isShadowStrikerAmc = (['AMC', 'AM'].includes(ep) || (['MC', 'CM', 'DMC', 'DM'].includes(ep) && p.duty === 'attack')) && p.instruction === 'shadow_striker';
    let box = side === 'home' ? 'b2' : 'c2';
    if (side === 'home') {
      if (ep === 'GK' || p === gk) box = 'a2';
      else if (isCutInsideWinger || isShadowStrikerAmc) box = 'd2';
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
      else if (isCutInsideWinger || isShadowStrikerAmc) box = 'a2';
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
  const boxFinishers = [...strikers, ...cutInsideWingers, ...shadowStrikers];
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
    holdingAmcs,
    shadowStrikers,
    cutInsideWingers,
    pureStrikers: strikers,
    defensiveMids,
    step1PressMids,
    buildUpMids,
    pureLeftWings,
    pureRightWings,
    leftWings,
    rightWings,
    strikers: boxFinishers.length > 0 ? boxFinishers : (effectiveAmcs.length > 0 ? effectiveAmcs : (mcs.length > 0 ? mcs : [nonGkPool[nonGkPool.length - 1]])),
    centralMids: centralMids.length > 0 ? centralMids : nonGkPool,
    zonePlayers
  };
}

/**
 * Count outfield players (excluding GK) stationed across one or more pitch boxes.
 */
function countOutfieldInBoxes(roster, boxes) {
  if (!roster?.zonePlayers) return 0;
  const boxList = Array.isArray(boxes) ? boxes : [boxes];
  return boxList.reduce((sum, box) => {
    const list = roster.zonePlayers[box] || [];
    return sum + list.filter(p => p && p.effectivePos !== 'GK' && p !== roster.gk).length;
  }, 0);
}

/**
 * Compute numerical advantage bonuses for any contested box on the 12-box pitch.
 * - Exclude GK so 1 ST vs 2 DCs + GK = +1 Def and 1 ST vs 3 DCs + GK = +2 Def.
 * - Flank lanes compare overlapping wingers/WBs (c/d or b/a) vs defending FB + tracking-back wide mid.
 * - Step 1 midfield falls back to opp mirror midfield box (c2/b2) when no opp presser sits inside startZone.
 */
function getBoxNumericalModifiers(attRoster, defRoster, zone, options = {}) {
  const { mode = 'exact', isHomeAtt = true, minAttCount = 0 } = options;
  if (!attRoster?.zonePlayers || !defRoster?.zonePlayers || !zone) {
    return { attCount: 0, defCount: 0, diff: 0, attBonus: 0, defBonus: 0 };
  }

  let attCount = 0;
  let defCount = 0;

  if (mode === 'flank' || zone.endsWith('1') || zone.endsWith('3')) {
    const col = zone.slice(-1);
    const attFlankBoxes = isHomeAtt ? [`c${col}`, `d${col}`] : [`b${col}`, `a${col}`];
    const defFlankBoxes = isHomeAtt ? [`d${col}`, `c${col}`] : [`a${col}`, `b${col}`];
    attCount = Math.max(minAttCount, countOutfieldInBoxes(attRoster, attFlankBoxes));
    defCount = countOutfieldInBoxes(defRoster, defFlankBoxes);
  } else if (mode === 'midfield_step1' && (zone === 'b2' || zone === 'c2')) {
    attCount = Math.max(minAttCount, countOutfieldInBoxes(attRoster, zone));
    const directPressCount = countOutfieldInBoxes(defRoster, zone);
    const mirrorMidZone = zone === 'b2' ? 'c2' : 'b2';
    defCount = directPressCount > 0 ? directPressCount : countOutfieldInBoxes(defRoster, mirrorMidZone);
  } else {
    attCount = Math.max(minAttCount, countOutfieldInBoxes(attRoster, zone));
    defCount = countOutfieldInBoxes(defRoster, zone);
  }

  const diff = attCount - defCount;
  return {
    attCount,
    defCount,
    diff,
    attBonus: diff > 0 ? diff : 0,
    defBonus: diff < 0 ? Math.abs(diff) : 0
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

function resolveDuelWithOverride(attBase, defBase, overrideDiff = null) {
  if (overrideDiff === null || overrideDiff === undefined) {
    const attDie = rollD10();
    const defDie = rollD10();
    return {
      attDie,
      defDie,
      attTotal: attDie + attBase,
      defTotal: defDie + defBase,
      diff: (attDie + attBase) - (defDie + defBase)
    };
  }
  const baseDiff = attBase - defBase;
  const neededDieDiff = overrideDiff - baseDiff;
  let defDie = Math.max(1, Math.min(10, Math.round(5 - neededDieDiff / 2)));
  let attDie = Math.max(1, Math.min(10, defDie + neededDieDiff));
  defDie = Math.max(1, Math.min(10, attDie - neededDieDiff));
  attDie = Math.max(1, Math.min(10, defDie + neededDieDiff));
  return {
    attDie,
    defDie,
    attTotal: attDie + attBase,
    defTotal: defDie + defBase,
    diff: overrideDiff
  };
}

function chooseTargetChannelHelper(attR, isHomeSide, teamTacticsObj = null, forceChannel = null) {
  const hasLeftWing = attR.leftWings.length > 0;
  const hasRightWing = attR.rightWings.length > 0;
  const hasAMC = (attR.effectiveAmcs && attR.effectiveAmcs.length > 0);

  const leftZone = isHomeSide ? 'c1' : 'b3';
  const centerZone = isHomeSide ? 'c2' : 'b2';
  const rightZone = isHomeSide ? 'c3' : 'b1';

  if (forceChannel && ['left', 'center', 'right'].includes(forceChannel)) {
    if (forceChannel === 'left') return { channel: 'left', zone: leftZone };
    if (forceChannel === 'right') return { channel: 'right', zone: rightZone };
    return { channel: 'center', zone: centerZone };
  }

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

  // Default / 'mixed': 33% Left Flank, 33% Right Flank, 34% Center
  const roll = Math.random();
  if (roll < 0.33) return { channel: 'left', zone: leftZone };
  if (roll < 0.66) return { channel: 'right', zone: rightZone };
  return { channel: 'center', zone: centerZone };
}

function pickHoldTargetHelper(attR, currZone, currPasser, isHomeSide) {
  const fallbackZone = isHomeSide ? 'a2' : 'd2';
  let candidateZones;
  if (isHomeSide) {
    if (currZone === 'b2') candidateZones = ['b1', 'b3', 'a1', 'a3', 'a2'];
    else if (currZone === 'b1') candidateZones = ['a1', 'b2', 'a2', 'a3', 'b3'];
    else if (currZone === 'b3') candidateZones = ['a3', 'b2', 'a2', 'a1', 'b1'];
    else candidateZones = ['a1', 'a3', 'a2', 'b2', 'b1', 'b3'];
  } else {
    if (currZone === 'c2') candidateZones = ['c1', 'c3', 'd1', 'd3', 'd2'];
    else if (currZone === 'c1') candidateZones = ['d1', 'c2', 'd2', 'd3', 'c3'];
    else if (currZone === 'c3') candidateZones = ['d3', 'c2', 'd2', 'd1', 'c1'];
    else candidateZones = ['d1', 'd3', 'd2', 'c2', 'c1', 'c3'];
  }

  const options = [];
  candidateZones.forEach((z) => {
    const list = attR.zonePlayers[z] || [];
    list.forEach((p) => {
      if (p && p.name !== currPasser?.name) {
        options.push({ zone: z, player: p });
      }
    });
  });

  if (options.length > 0) return pickRandom(options);
  const fbPool = attR.zonePlayers[fallbackZone] || [];
  const fbPlayer = fbPool[0] || currPasser;
  return { zone: fbPool[0] ? fallbackZone : currZone, player: fbPlayer };
}

function resolveBoxDefenseHelper(defRoster, mode = 'standard') {
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
}

/**
 * Resolves where a successful Step 1 pass goes when starting outside center midfield
 * (`a2`/`d2` GK/DC, `a1`/`a3`/`d1`/`d3` fullbacks, `b1`/`b3`/`c1`/`c3` flank wins)
 * so players never teleport directly to MC without a real pass check:
 * - Own Box (GK short or DC in a2/d2): always passes to MC (randomly among MCs in b2/c2).
 * - Own Flank (DR/DL in b3/b1 or a3/a1): follows flank/team focus logic — advances up THAT flank
 *   if team focus selects that flank and a forward flank teammate exists; otherwise passes inside
 *   to MC (or MCs if more than one).
 * - High press win in opponent's flank: attacks forward directly from that channel.
 */
function resolveFlankOrDefBuildUpPlan({
  startZone,
  attRoster,
  isHomeAtt,
  attTeamTactics,
  forceChannel = null,
  isRecovery = false
}) {
  const midZone = isHomeAtt ? 'b2' : 'c2';
  const ownBoxZone = isHomeAtt ? 'a2' : 'd2';
  const mcPoolInBox = (attRoster.zonePlayers[midZone] || []).filter((p) => p.effectivePos !== 'GK');
  const mcFallbackPool = mcPoolInBox.length > 0
    ? mcPoolInBox
    : (attRoster.buildUpMids?.length > 0 ? attRoster.buildUpMids : attRoster.centralMids);
  const pickedMc = pickRandom(mcFallbackPool) || attRoster.all?.[0] || null;
  const chosenChannel = chooseTargetChannelHelper(attRoster, isHomeAtt, attTeamTactics, forceChannel);

  // If team has Counter Attack enabled after winning the ball in own half/box,
  // bypass slow MC build-up and fast-forward straight into STEP 2 with +2!
  const ownHalfZones = isHomeAtt ? ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'] : ['d1', 'd2', 'd3', 'c1', 'c2', 'c3'];
  if (isRecovery && attTeamTactics?.counterAttack === true && ownHalfZones.includes(startZone)) {
    return {
      kind: 'to_counter_step2',
      chosenChannel,
      counterBonus: 2,
      reason: 'counter_attack_recovery'
    };
  }

  if (startZone === ownBoxZone) {
    return {
      kind: 'to_mc',
      nextZone: midZone,
      nextPlayer: pickedMc,
      chosenChannel: null,
      reason: 'own_box_to_mc'
    };
  }

  const isLong = attTeamTactics?.passing === 'long';

  const leftDeep = isHomeAtt ? 'a1' : 'd3';
  const rightDeep = isHomeAtt ? 'a3' : 'd1';
  if (startZone === leftDeep || startZone === rightDeep) {
    const flankSide = startZone === leftDeep ? 'left' : 'right';
    const adjFlankBox = isHomeAtt
      ? (flankSide === 'left' ? 'b1' : 'b3')
      : (flankSide === 'left' ? 'c3' : 'c1');
    const adjPool = (attRoster.zonePlayers[adjFlankBox] || []).filter((p) => p.effectivePos !== 'GK');
    if (chosenChannel.channel === flankSide && !isLong && adjPool.length > 0) {
      return {
        kind: 'to_flank_mid',
        nextZone: adjFlankBox,
        nextPlayer: pickRandom(adjPool),
        chosenChannel,
        reason: 'deep_flank_up_line'
      };
    }
    return {
      kind: 'to_mc',
      nextZone: midZone,
      nextPlayer: pickedMc,
      chosenChannel,
      reason: 'deep_flank_to_mc'
    };
  }

  const leftMid = isHomeAtt ? 'b1' : 'c3';
  const rightMid = isHomeAtt ? 'b3' : 'c1';
  if (startZone === leftMid || startZone === rightMid) {
    const flankSide = startZone === leftMid ? 'left' : 'right';
    const shortForwardFlank = isHomeAtt
      ? (flankSide === 'left' ? 'c1' : 'c3')
      : (flankSide === 'left' ? 'b3' : 'b1');
    const longForwardFlank = isHomeAtt
      ? (flankSide === 'left' ? 'd1' : 'd3')
      : (flankSide === 'left' ? 'a3' : 'a1');
    const targetForwardBox = isLong ? longForwardFlank : shortForwardFlank;
    const forwardPool = (attRoster.zonePlayers[targetForwardBox] || []).filter((p) => p.effectivePos !== 'GK');

    if (chosenChannel.channel === flankSide && forwardPool.length > 0) {
      return {
        kind: 'to_step2_flank',
        chosenChannel: { channel: flankSide, zone: shortForwardFlank },
        targetBox: targetForwardBox,
        reason: 'mid_flank_up_line'
      };
    }

    return {
      kind: 'to_mc',
      nextZone: midZone,
      nextPlayer: pickedMc,
      chosenChannel,
      reason: 'mid_flank_to_mc'
    };
  }

  const attLeft = isHomeAtt ? 'c1' : 'b3';
  const attRight = isHomeAtt ? 'c3' : 'b1';
  if (startZone === attLeft) {
    return { kind: 'to_step2_direct', chosenChannel: { channel: 'left', zone: attLeft }, reason: 'high_press_flank' };
  }
  if (startZone === attRight) {
    return { kind: 'to_step2_direct', chosenChannel: { channel: 'right', zone: attRight }, reason: 'high_press_flank' };
  }

  return { kind: 'forward_standard', chosenChannel, reason: 'center_mid_forward' };
}

function runZone12PossessionCore({
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
  isKickoffRestart = false,
  recycleState = null,
  testOverrides = null
}) {
  // Helper for deterministic scenario testing in Zone12EngineTestDemo (null in normal matches)
  const resolveDuelWithOverride = (attBase, defBase, overrideDiff = null) => {
    if (overrideDiff === null || overrideDiff === undefined) {
      const attDie = rollD10();
      const defDie = rollD10();
      return {
        attDie,
        defDie,
        attTotal: attDie + attBase,
        defTotal: defDie + defBase,
        diff: (attDie + attBase) - (defDie + defBase)
      };
    }
    const baseDiff = attBase - defBase;
    const neededDieDiff = overrideDiff - baseDiff;
    let defDie = Math.max(1, Math.min(10, Math.round(5 - neededDieDiff / 2)));
    let attDie = Math.max(1, Math.min(10, defDie + neededDieDiff));
    defDie = Math.max(1, Math.min(10, attDie - neededDieDiff));
    attDie = Math.max(1, Math.min(10, defDie + neededDieDiff));
    const attTotal = attDie + attBase;
    const defTotal = defDie + defBase;
    return {
      attDie,
      defDie,
      attTotal,
      defTotal,
      diff: overrideDiff
    };
  };
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
  const initDefTeamTactics = initIsHome ? awayTeamTactics : homeTeamTactics;

  const steps = [];
  const logs = [];
  const zonePath = [];
  const midEventMin = resolveEventMinute(2);

  // Helper to choose an attacking channel ('left', 'center', or 'right')
  // Respects Team Instructions attackingFocus:
  // - 'mixed' (default): 33% Left Flank, 33% Right Flank, 34% Center
  // - 'left': 80% Left Flank, 20% Right/Center
  // - 'right': 80% Right Flank, 20% Left/Center
  // - 'center': 80% Center, 20% Left/Right
  // - 'both_flanks': 50% Left Flank, 50% Right Flank
  const chooseTargetChannel = (attR, isHomeSide, teamTacticsObj = null) =>
    chooseTargetChannelHelper(attR, isHomeSide, teamTacticsObj, testOverrides?.forceChannel);

  // ---------------------------------------------------------------------------
  // STEP 1: Check GK Distribution Instruction ('long' vs 'short') or Midfield / Recycled Build-up
  //         Note: Kickoff restarts always begin in center midfield (never GK long kick).
  // ---------------------------------------------------------------------------
  const activeRecycle = (!isKickoffRestart && recycleState && recycleState.side === initSide && recycleState.player)
    ? recycleState
    : null;
  const initGk = initAttRoster.gk;
  const isGkRecycle = Boolean(activeRecycle && (activeRecycle.player?.effectivePos === 'GK' || activeRecycle.player?.name === initGk?.name));
  const isGkLongDistribution = !isKickoffRestart && (!activeRecycle || isGkRecycle) && (
    typeof testOverrides?.forceGkLong === 'boolean'
      ? testOverrides.forceGkLong
      : initGk?.instruction === 'long'
  );

  let startZone = activeRecycle?.zone || (initIsHome ? 'b2' : 'c2');
  let midPasser = null;
  let midMarker = null;
  let midSuccess = false;
  let counterTriggered = false;
  let step2SkillBonus = 0; // +3 if MC/DMC succeeds a through_ball (diff >= 4)
  let preChosenChannel = null;

  // Picks a valid occupied lateral/back zone & teammate to hold possession on diff 0 or 1
  const pickHoldTarget = (attR, currZone, currPasser, isHomeSide) => {
    const fallbackZone = isHomeSide ? 'a2' : 'd2';
    let candidateZones;
    if (isHomeSide) {
      if (currZone === 'b2') candidateZones = ['b1', 'b3', 'a1', 'a3', 'a2'];
      else if (currZone === 'b1') candidateZones = ['a1', 'b2', 'a2', 'a3', 'b3'];
      else if (currZone === 'b3') candidateZones = ['a3', 'b2', 'a2', 'a1', 'b1'];
      else candidateZones = ['a1', 'a3', 'a2', 'b2', 'b1', 'b3'];
    } else {
      if (currZone === 'c2') candidateZones = ['c1', 'c3', 'd1', 'd3', 'd2'];
      else if (currZone === 'c1') candidateZones = ['d1', 'c2', 'd2', 'd3', 'c3'];
      else if (currZone === 'c3') candidateZones = ['d3', 'c2', 'd2', 'd1', 'c1'];
      else candidateZones = ['d1', 'd3', 'd2', 'c2', 'c1', 'c3'];
    }

    const options = [];
    candidateZones.forEach((z) => {
      const list = attR.zonePlayers[z] || [];
      list.forEach((p) => {
        if (p && p.name !== currPasser?.name) {
          options.push({ zone: z, player: p });
        }
      });
    });

    if (options.length > 0) {
      return pickRandom(options);
    }
    const fbPool = attR.zonePlayers[fallbackZone] || [];
    const fbPlayer = fbPool[0] || currPasser;
    return { zone: fbPool[0] ? fallbackZone : currZone, player: fbPlayer };
  };

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

    const attTackSkill = targetAttPlayer.skills.tackling;
    const defTackSkill = targetDefPlayer.skills.tackling;
    const attTackBonus = (initAttTactic === 'attack' ? 1 : 0) + (isGkRecycle ? 5 : 0);
    const defTackBonus = getTacklingMod(initDefTeamTactics);
    const forcedGkDiff = testOverrides?.forceStep1Outcome === 'success_2' || testOverrides?.forceStep1Outcome === 'success_4'
      ? 2
      : (testOverrides?.forceStep1Outcome === 'counter_2'
        ? -2
        : (testOverrides?.forceStep1Outcome ? -1 : null));
    const gkDuel = resolveDuelWithOverride(attTackSkill + attTackBonus, defTackSkill + defTackBonus, forcedGkDiff);
    const attTackDie = gkDuel.attDie;
    const defTackDie = gkDuel.defDie;
    const attTackTotal = gkDuel.attTotal;
    const defTackTotal = gkDuel.defTotal;
    const tackDiff = gkDuel.diff;

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
    // GK SHORT DISTRIBUTION / RECYCLED BUILD-UP (b2/c2 or lateral/back hold zone)
    zonePath.push(startZone);

    const attMids = initAttRoster.buildUpMids && initAttRoster.buildUpMids.length > 0
      ? initAttRoster.buildUpMids
      : ((initAttRoster.mcs.length > 0 || initAttRoster.dmcs.length > 0)
        ? [...initAttRoster.mcs, ...initAttRoster.dmcs]
        : (initAttRoster.centralMids.length > 0 ? initAttRoster.centralMids : initAttRoster.all));

    const defMids = (initDefRoster.step1PressMids && initDefRoster.step1PressMids.length > 0)
      ? initDefRoster.step1PressMids
      : (initDefRoster.centralMids.length > 0 ? initDefRoster.centralMids : initDefRoster.all);

    const resolvePressingDefenderForZone = (z) => {
      const isDeepBack = initIsHome ? z.startsWith('a') : z.startsWith('d');
      if (isDeepBack) {
        const highPressPool = [...(initDefRoster.strikers || []), ...(initDefRoster.effectiveAmcs || [])].filter(Boolean);
        if (highPressPool.length > 0) return pickRandom(highPressPool);
      }
      if (z === 'b1' || z === 'c1' || z === 'b3' || z === 'c3') {
        const widePress = initIsHome
          ? (z === 'b1' ? initDefRoster.rightWings : initDefRoster.leftWings)
          : (z === 'c1' ? initDefRoster.leftWings : initDefRoster.rightWings);
        if (widePress && widePress.length > 0) return pickRandom(widePress);
      }
      return pickRandom(defMids);
    };

    midPasser = activeRecycle
      ? (Object.values(initAttRoster.zonePlayers).flat().find(p => p && p.name === activeRecycle.player.name) || activeRecycle.player)
      : pickRandom(attMids);
    midMarker = activeRecycle ? resolvePressingDefenderForZone(startZone) : pickRandom(defMids);

    // Check MC / DMC Individual Instruction: 'pass' (default, diff >= 2) vs 'through_ball' (diff >= 4, grants +3 skill to receiver!)
    const isMidThroughBall = !activeRecycle && (
      testOverrides?.forceStep1ThroughBall
        ? testOverrides.forceStep1ThroughBall === 'through_ball'
        : midPasser.instruction === 'through_ball'
    );
    const requiredMidDiff = isMidThroughBall ? 4 : 2;
    const ballPlayDcBonus = (['DC', 'CB', 'SW'].includes(midPasser.effectivePos) && midPasser.instruction === 'direct_pass') ? 1 : 0;

    const step1Num = getBoxNumericalModifiers(initAttRoster, initDefRoster, startZone, {
      mode: (startZone === 'b2' || startZone === 'c2') ? 'midfield_step1' : 'exact',
      isHomeAtt: initIsHome,
      minAttCount: 1
    });
    const attNumBonus = step1Num.attBonus;
    const defNumBonus = step1Num.defBonus;
    const doublePivotPassBonus = initAttRoster.dmcCount >= 2 ? 1 : 0;
    const mentalityPassBonus = initAttTactic === 'attack' ? 1 : (initAttTactic === 'defense' ? -2 : 0);
    const gkPassProtectionBonus = (midPasser.effectivePos === 'GK' || midPasser.name === initGk?.name) ? 5 : 0;

    const attStep1Bonus = attNumBonus + doublePivotPassBonus + mentalityPassBonus + ballPlayDcBonus + gkPassProtectionBonus;
    const defStep1Bonus = defNumBonus + getTacklingMod(initDefTeamTactics);
    const baseCounterThreshold = initAttTactic === 'defense' ? -4 : -2;
    const counterThreshold = initDefTeamTactics?.counterAttack === true
      ? (initAttTactic === 'defense' ? -2 : -1)
      : baseCounterThreshold;

    let forcedStep1Diff = null;
    if (testOverrides?.forceStep1Outcome === 'success_2') forcedStep1Diff = requiredMidDiff;
    else if (testOverrides?.forceStep1Outcome === 'success_4') forcedStep1Diff = 4;
    else if (testOverrides?.forceStep1Outcome === 'hold_0_1') forcedStep1Diff = 0;
    else if (testOverrides?.forceStep1Outcome === 'fail_1') forcedStep1Diff = -1;
    else if (testOverrides?.forceStep1Outcome === 'counter_2') forcedStep1Diff = counterThreshold;

    const passSkill = midPasser.skills.passing;
    const markSkill = midMarker.skills.marking;
    const step1Duel = resolveDuelWithOverride(passSkill + attStep1Bonus, markSkill + defStep1Bonus, forcedStep1Diff);
    const passDie = step1Duel.attDie;
    const markDie = step1Duel.defDie;
    const passTotal = step1Duel.attTotal;
    const markTotal = step1Duel.defTotal;
    const midDiff = step1Duel.diff;

    midSuccess = midDiff >= requiredMidDiff;
    // Hold Possession rule: diff 0 or 1 keeps the ball (recycles to b1/b3/a1/a3/a2 for Home, c1/c3/d1/d3/d2 for Away).
    // Turnovers only happen on diff <= -1 (or diff 2-3 if attempting a risky through-ball without succeeding).
    const isHoldPossession = !isMilestoneStopCheck(midSuccess, counterTriggered) && (midDiff === 0 || midDiff === 1);
    function isMilestoneStopCheck() { return false; }

    // Center-circle kickoff restarts cannot be counter-ambushed in Step 1;
    // Defensive low-blocks only leave counters open on heavy turnovers (diff <= -4).
    counterTriggered = !isKickoffRestart && midDiff <= counterThreshold;

    if (midSuccess && isMidThroughBall) {
      step2SkillBonus = 3;
    }

    const holdPick = isHoldPossession ? pickHoldTarget(initAttRoster, startZone, midPasser, initIsHome) : null;

    steps.push({
      phase: isKickoffRestart
        ? (isMidThroughBall ? 'KICKOFF THROUGH-BALL (+3)' : 'KICKOFF RESTART (MIDFIELD)')
        : (activeRecycle
          ? 'RECYCLED BUILD-UP PASS'
          : (isMidThroughBall ? 'MIDFIELD THROUGH-BALL (+3)' : 'MIDFIELD BUILD-UP')),
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
      holdPossession: isHoldPossession,
      holdTargetZone: holdPick?.zone || null,
      summary: midSuccess
        ? (isMidThroughBall
          ? `🗡️ ${midPasser.name} splits the defence from [${startZone.toUpperCase()}]! (d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal} vs ${midMarker.name} d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal}, diff +${midDiff} >= 4 → Receiver gets +3 Skill!)`
          : `${midPasser.name} passes cleanly from [${startZone.toUpperCase()}] (d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal} vs ${midMarker.name} d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal}, diff +${midDiff} >= 2)`)
        : (counterTriggered
          ? `⚡ ${midMarker.name} intercepts ${midPasser.name} in [${startZone.toUpperCase()}] and launches an instant counter! (d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal} vs d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal})`
          : (isHoldPossession && holdPick
            ? `🔄 Closed down in [${startZone.toUpperCase()}] (diff ${midDiff >= 0 ? `+${midDiff}` : midDiff}) — ${midPasser.name} recycles safely to ${holdPick.player.name} in [${holdPick.zone.toUpperCase()}] to keep possession!`
            : `${midMarker.name} stops ${midPasser.name}'s ${isMidThroughBall ? 'through-ball' : 'pass'} in [${startZone.toUpperCase()}] (d10:${passDie}+Pass:${passSkill}${fmtBonus(attStep1Bonus)}=${passTotal} vs d10:${markDie}+Mark:${markSkill}${fmtBonus(defStep1Bonus)}=${markTotal}, diff ${midDiff >= 0 ? `+${midDiff}` : midDiff} < ${requiredMidDiff})`))
    });

    const ownBoxZone = initIsHome ? 'a2' : 'd2';
    if (!midSuccess && !isHoldPossession && startZone === ownBoxZone) {
      // Attacker stole GK/DC short pass right inside the penalty box (a2 / d2) -> immediate shot!
      const oppSide = initIsHome ? 'away' : 'home';
      const oppAttTactic = initIsHome ? awayTactic : homeTactic;
      const oppDefTactic = initIsHome ? homeTactic : awayTactic;
      const stealFinMod = oppAttTactic === 'attack' ? 1 : (oppAttTactic === 'defense' ? -2 : 0);
      const stealDefMod = oppDefTactic === 'defense' ? 1 : (oppDefTactic === 'attack' ? -1 : 0);
      const is1v1Gk = (midPasser.effectivePos === 'GK' || midPasser.name === initGk?.name);
      const boxDef = resolveBoxDefenseHelper(initAttRoster, 'standard');
      const defSkillVal = is1v1Gk ? (initGk?.skills?.handling || 6) : boxDef.combinedSkill;
      const defLabel = is1v1Gk ? (initGk?.name || 'GK') : `${boxDef.dc?.name || 'DC'} + ${initGk?.name || 'GK'}`;
      const finSkill = midMarker.skills.finishing;
      const forcedStealShotDiff = testOverrides?.forceStep3Outcome === 'goal'
        ? 3
        : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
      const stealShotDuel = resolveDuelWithOverride(finSkill + stealFinMod, defSkillVal + stealDefMod, forcedStealShotDiff);
      const isGoal = stealShotDuel.diff >= 3;

      const stealLog = {
        text: `${midEventMin}' ⚡ ${midMarker.name} (${initDefTeamName}) intercepts ${midPasser.name}'s pass inside [${startZone.toUpperCase()}]!`,
        type: 'chance'
      };
      steps[0].stepLog = stealLog;
      logs.push(stealLog);

      const shotLog = isGoal
        ? {
          text: `${midEventMin}' ⚽ GOAL! ${midMarker.name} (${initDefTeamName}) punishes the mistake in [${startZone.toUpperCase()}] and fires past ${initGk?.name || 'the keeper'}!`,
          type: 'goal'
        }
        : {
          text: `${midEventMin}' 🧤 SAVE! ${midMarker.name} (${initDefTeamName}) gets an instant shot inside [${startZone.toUpperCase()}], but ${defLabel} recovers to keep it out!`,
          type: 'save'
        };

      steps.push({
        phase: is1v1Gk ? 'BOX STEAL 1v1 vs KEEPER' : 'BOX STEAL FINISH',
        zone: startZone,
        attacker: midMarker.name,
        attackerPlayer: midMarker,
        attackerSlotId: midMarker.slotId || null,
        attackerPos: midMarker.effectivePos,
        attackerSkillName: 'Finishing',
        attackerSkill: finSkill,
        attackerBonus: stealFinMod,
        attackerDie: stealShotDuel.attDie,
        attackerTotal: stealShotDuel.attTotal,
        defender: defLabel,
        defenderPlayer: is1v1Gk ? initGk : (boxDef.dc || initGk),
        defenderSlotId: is1v1Gk ? (initGk?.slotId || null) : (boxDef.dc?.slotId || null),
        defenderPos: is1v1Gk ? 'GK' : 'DC+GK',
        defenderSkillName: is1v1Gk ? 'Handling' : boxDef.formulaName,
        defenderSkill: defSkillVal,
        defenderBonus: stealDefMod,
        defenderDie: stealShotDuel.defDie,
        defenderTotal: stealShotDuel.defTotal,
        diff: stealShotDuel.diff,
        requiredDiff: 3,
        success: isGoal,
        stepLog: shotLog,
        summary: isGoal
          ? `⚽ BOX STEAL GOAL! ${midMarker.name} scores in [${startZone.toUpperCase()}]! (diff +${stealShotDuel.diff} >= 3)`
          : `🧤 ${defLabel} stops ${midMarker.name}'s instant shot in [${startZone.toUpperCase()}] (diff ${stealShotDuel.diff} < 3)`
      });
      logs.push(shotLog);

      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide: oppSide,
        nextAttacker: initSide,
        counterTriggered: true,
        startZone,
        activeZone: startZone,
        zonePath,
        steps,
        logs,
        isGoal,
        isShot: true,
        isOnTarget: true,
        scorer: isGoal ? midMarker : null,
        assister: null,
        homePenaltyTaker,
        awayPenaltyTaker,
        homeGk,
        awayGk,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      };
    }

    if (!midSuccess && !counterTriggered) {
      if (isHoldPossession && holdPick) {
        zonePath.push(holdPick.zone);
        const holdLog = {
          text: `${midEventMin}' 🔄 ${midPasser.name} (${initAttTeamName}) is pressed by ${midMarker.name} in [${startZone.toUpperCase()}], and plays a safe pass to ${holdPick.player.name} in [${holdPick.zone.toUpperCase()}] to hold possession.`,
          type: 'normal'
        };
        steps[0].stepLog = holdLog;
        logs.push(holdLog);
        return {
          minutesElapsed: 2,
          step1Side: initSide,
          attackingSide: initSide,
          nextAttacker: initSide,
          nextRecycleState: { side: initSide, zone: holdPick.zone, player: holdPick.player },
          isHoldPossession: true,
          counterTriggered: false,
          startZone,
          activeZone: holdPick.zone,
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

      const oppSide = initIsHome ? 'away' : 'home';
      const failLog = {
        text: isKickoffRestart
          ? `${midEventMin}' ${initAttTeamName} restarts from the center circle — ${midPasser.name} probes forward, before ${midMarker.name} (${initDefTeamName}) closes down and wins possession!`
          : `${midEventMin}' ${midPasser.name} (${initAttTeamName}) attempts a ${isMidThroughBall ? 'defence-splitting through-ball' : 'forward pass'} from [${startZone.toUpperCase()}], but ${midMarker.name} (${initDefTeamName}) closes down and intercepts cleanly. ${initDefTeamName} wins possession!`,
        type: 'normal'
      };
      steps[0].stepLog = failLog;
      logs.push(failLog);
      return {
        minutesElapsed: 2,
        step1Side: initSide,
        attackingSide: initSide,
        nextAttacker: oppSide,
        nextRecycleState: null,
        isHoldPossession: false,
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
  const defTeamTactics = isHomeAtt ? awayTeamTactics : homeTeamTactics;
  const defTacklingMod = getTacklingMod(defTeamTactics);

  // Team Mentality modifiers for Steps 2 & 3:
  // Defensive mentality penalizes attacking skills (passing, crossing, finishing, heading, dribbling, through balls) by -2,
  // while Long Shots keeps -1.
  const attMentalityMod = attTactic === 'attack' ? 1 : (attTactic === 'defense' ? -2 : 0);
  const longShotMentalityMod = attTactic === 'attack' ? 1 : (attTactic === 'defense' ? -1 : 0);
  const defMentalityMod = defTactic === 'defense' ? 1 : (defTactic === 'attack' ? -1 : 0);

  // ---------------------------------------------------------------------------
  // STEP 2: Choose Next Box (c1, c2, or c3 for Home; b1, b2, or b3 for Away)
  //         If build-up started outside b2/c2 (e.g. DR won in b3 or GK/DC in a2),
  //         apply flank/MC transfer logic first (unless Counter Attack = Yes launches straight to Step 2!).
  // ---------------------------------------------------------------------------
  let recoveryTransferPlan = null;
  if (!counterTriggered && !isGkLongDistribution && activeRecycle) {
    recoveryTransferPlan = resolveFlankOrDefBuildUpPlan({
      startZone,
      attRoster,
      isHomeAtt,
      attTeamTactics,
      forceChannel: testOverrides?.forceChannel || null,
      isRecovery: Boolean(activeRecycle?.isRecovery)
    });
    if ((recoveryTransferPlan.kind === 'to_mc' || recoveryTransferPlan.kind === 'to_flank_mid') && recoveryTransferPlan.nextZone) {
      if (zonePath[zonePath.length - 1] !== recoveryTransferPlan.nextZone) {
        zonePath.push(recoveryTransferPlan.nextZone);
      }
      if (recoveryTransferPlan.nextPlayer) {
        midPasser = recoveryTransferPlan.nextPlayer;
      }
      if (steps[0]) {
        steps[0].summary = `${steps[0].summary} ➔ Feeds [${recoveryTransferPlan.nextZone.toUpperCase()}] (${midPasser?.name || 'MC'})`;
      }
    }
  }

  const isCounterLaunch = Boolean(
    (counterTriggered && attTeamTactics?.counterAttack === true) ||
    recoveryTransferPlan?.kind === 'to_counter_step2' ||
    (isGkLongDistribution && isGkRecycle && attTeamTactics?.counterAttack === true)
  );
  if (isCounterLaunch) {
    step2SkillBonus += 2;
  }

  const chosenChannel = (!counterTriggered && preChosenChannel)
    ? preChosenChannel
    : (recoveryTransferPlan?.chosenChannel || chooseTargetChannel(attRoster, isHomeAtt, attTeamTactics));
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
    const longShotSkill = shooter.skills.longShots;
    const longShotAttBonus = extraAttBonus + longShotMentalityMod + step2SkillBonus;
    const longShotDefBonus = extraDefBonus + defMentalityMod;
    const forcedShotDiff = testOverrides?.forceStep3Outcome === 'goal'
      ? 5
      : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
    const shotDuel = resolveDuelWithOverride(longShotSkill + longShotAttBonus, boxDef.combinedSkill + longShotDefBonus, forcedShotDiff);
    const shotDie = shotDuel.attDie;
    const saveDie = shotDuel.defDie;
    const shotTotal = shotDuel.attTotal;
    const saveTotal = shotDuel.defTotal;
    const shotDiff = shotDuel.diff;
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
      const deepNum = getBoxNumericalModifiers(attRoster, defRoster, deepTargetZone, {
        mode: deepTargetZone.endsWith('2') ? 'exact' : 'flank',
        isHomeAtt,
        minAttCount: 1
      });
      const attNumBonus = deepNum.attBonus;
      const defNumBonus = deepNum.defBonus;
      const attTackSkill = attTarget.skills.tackling;
      const defTackSkill = defTarget.skills.tackling;
      const attBonus = attNumBonus + attMentalityMod + step2SkillBonus;
      const defBonus = defNumBonus + defMentalityMod + defTacklingMod;
      const forcedLongTackleDiff = testOverrides?.forceStep2Outcome === 'success'
        ? 1
        : (testOverrides?.forceStep2Outcome === 'fail' ? -1 : null);
      const longTackleDuel = resolveDuelWithOverride(attTackSkill + attBonus, defTackSkill + defBonus, forcedLongTackleDiff);
      const attTackDie = longTackleDuel.attDie;
      const defTackDie = longTackleDuel.defDie;
      const attTotal = longTackleDuel.attTotal;
      const defTotal = longTackleDuel.defTotal;
      const tackDiff = longTackleDuel.diff;
      const tackleWon = tackDiff >= 1;

      const longTackleLog = tackleWon
        ? {
          text: `${midEventMin}' 🚀 ${attTarget.name} (${attTeamName}) battles ${defTarget.name} for the long ball in [${deepTargetZone.toUpperCase()}]${attNumBonus ? ` (+${attNumBonus} teammate support)` : ''} and wins the tackle to set up a huge chance!`,
          type: 'chance'
        }
        : {
          text: `${midEventMin}' ${defTarget.name} (${defTeamName})${defNumBonus ? ` (+${defNumBonus} defensive cover)` : ''} out-muscles ${attTarget.name} in [${deepTargetZone.toUpperCase()}] to win the long-ball tackle and clear the danger!`,
          type: 'save'
        };

      steps.push({
        phase: `LONG BALL TACKLE${attNumBonus ? ` (ATT +${attNumBonus})` : ''}${defNumBonus ? ` (DEF +${defNumBonus})` : ''}`,
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
    const boxNum = getBoxNumericalModifiers(attRoster, defRoster, boxZone, {
      mode: 'exact',
      isHomeAtt,
      minAttCount: 1
    });
    const finSkill = isHighCrossLong ? finisher.skills.heading : finisher.skills.finishing;
    const finSkillName = isHighCrossLong ? 'Heading' : 'Finishing';
    const finInstrBonus = isHighCrossLong
      ? (finisher.instruction === 'target_man' ? 1 : (finisher.instruction === 'poacher' ? -1 : 0))
      : (finisher.instruction === 'poacher' ? 1 : 0);
    const totalFinBonus = attMentalityMod + finInstrBonus + boxNum.attBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus;
    const forcedLongFinDiff = testOverrides?.forceStep3Outcome === 'goal'
      ? 3
      : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
    const longFinDuel = resolveDuelWithOverride(finSkill + totalFinBonus, boxDef.combinedSkill + totalDefBonus, forcedLongFinDiff);
    const finDie = longFinDuel.attDie;
    const gkDie = longFinDuel.defDie;
    const finTotal = longFinDuel.attTotal;
    const gkTotal = longFinDuel.defTotal;
    const finDiff = longFinDuel.diff;
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
      ? ((attRoster.holdingAmcs && attRoster.holdingAmcs.length > 0) ? attRoster.holdingAmcs : attRoster.effectiveAmcs)
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

    const rawAmcInstr = amcPlayer.instruction || 'pass';
    const amcInstr = (testOverrides?.forceActorInstruction && ['long_shot', 'dribble', 'through_ball', 'pass', 'shadow_striker'].includes(testOverrides.forceActorInstruction))
      ? testOverrides.forceActorInstruction
      : rawAmcInstr;
    const dmcManMarkBonus = oppCentralDef?.instruction === 'man_mark' ? 1 : 0;
    const boxZone = isHomeAtt ? 'd2' : 'a2';
    const c2Num = getBoxNumericalModifiers(attRoster, defRoster, secondZone, {
      mode: 'exact',
      isHomeAtt,
      minAttCount: 1
    });
    const boxNum = getBoxNumericalModifiers(attRoster, defRoster, boxZone, {
      mode: 'exact',
      isHomeAtt,
      minAttCount: 1
    });

    // 1. AMC (or Attacking MC) Instruction: LONG SHOT ('long_shot')
    if (amcInstr === 'long_shot') {
      return resolveLongShotOutcome({
        shooter: amcPlayer,
        shotZone: secondZone,
        targetBoxZone: boxZone,
        extraAttBonus: c2Num.attBonus,
        extraDefBonus: c2Num.defBonus,
        isFlank: false
      });
    }

    // 2. AMC Instruction: DRIBBLE ('dribble') or SHADOW STRIKER ('shadow_striker')
    //    - 'dribble': beats DMC/DC tackling -> 1v1 vs Keeper!
    //    - 'shadow_striker': beats DMC/DC tackling -> crashes box d2/a2 to finish vs DC+GK with box numerical overload!
    if (amcInstr === 'dribble' || amcInstr === 'shadow_striker') {
      const isShadowSurge = amcInstr === 'shadow_striker';
      const dribSkill = amcPlayer.skills.dribbling;
      const tackSkill = oppCentralDef.skills.tackling;
      const dribAttBonus = c2Num.attBonus + attMentalityMod + step2SkillBonus;
      const dribDefBonus = c2Num.defBonus + defMentalityMod + defTacklingMod;
      const forcedDribDiff = testOverrides?.forceStep2Outcome === 'success'
        ? 2
        : (testOverrides?.forceStep2Outcome === 'fail' ? 0 : null);
      const dribDuel = resolveDuelWithOverride(dribSkill + dribAttBonus, tackSkill + dribDefBonus, forcedDribDiff);
      const dribDie = dribDuel.attDie;
      const tackDie = dribDuel.defDie;
      const dribTotal = dribDuel.attTotal;
      const tackTotal = dribDuel.defTotal;
      const dribDiff = dribDuel.diff;
      const dribSuccess = dribDiff >= 2;

      const dribLog = dribSuccess
        ? {
          text: isShadowSurge
            ? `${midEventMin}' ⚡ ${amcPlayer.name} (${attTeamName}) bursts from deep past ${oppCentralDef.name} as a Shadow Striker, crashing into the penalty box!`
            : `${midEventMin}' 🔥 ${amcPlayer.name} (${attTeamName}) drops a shoulder and glides past ${oppCentralDef.name}'s challenge, racing clean through 1-on-1 with the keeper!`,
          type: 'chance'
        }
        : {
          text: `${midEventMin}' ${amcPlayer.name} (${attTeamName}) tries to ${isShadowSurge ? 'surge into the box' : 'dribble through the middle'}, but ${oppCentralDef.name} (${defTeamName}) times a sharp tackle to win the ball back!`,
          type: 'save'
        };

      steps.push({
        phase: isShadowSurge ? 'SHADOW STRIKER SURGE' : 'AMC CENTRAL DRIBBLE',
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
          ? `🔥 ${amcPlayer.name} ${isShadowSurge ? 'surges past' : 'dribbles past'} ${oppCentralDef.name} in [${secondZone.toUpperCase()}]! (d10:${dribDie}+Drib:${dribSkill}${fmtBonus(dribAttBonus)}=${dribTotal} vs d10:${tackDie}+Tack:${tackSkill}${fmtBonus(dribDefBonus)}=${tackTotal}, diff +${dribDiff} >= 2)`
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

      // Step 3: Shadow Striker finishes vs DC+GK with box numerical modifiers; pure Dribble shoots 1v1 vs GK
      zonePath.push(boxZone);
      const gk = defRoster.gk;
      const boxDef = isShadowSurge ? getBoxDefenseTarget('standard') : null;
      const dcForFoul = isShadowSurge ? boxDef.dc : pickRandom(defRoster.dcs);
      const finSkill = amcPlayer.skills.finishing;
      const defTargetSkill = isShadowSurge ? boxDef.combinedSkill : (gk ? gk.skills.handling : 6);
      const totalFinBonus = attMentalityMod + (isShadowSurge ? boxNum.attBonus : 0);
      const totalDefBonus = defMentalityMod + (isShadowSurge ? (boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus) : 0);
      const forcedAmcDribFin = testOverrides?.forceStep3Outcome === 'goal'
        ? 3
        : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
      const amcFinDuel = resolveDuelWithOverride(finSkill + totalFinBonus, defTargetSkill + totalDefBonus, forcedAmcDribFin);
      const finDie = amcFinDuel.attDie;
      const gkDie = amcFinDuel.defDie;
      const finTotal = amcFinDuel.attTotal;
      const gkTotal = amcFinDuel.defTotal;
      const finDiff = amcFinDuel.diff;
      const isGoal = finDiff >= 3;
      const defLabel = isShadowSurge ? `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}` : (gk?.name || 'GK');

      const finLog = isGoal
        ? {
          text: isShadowSurge
            ? `${midEventMin}' ⚽ GOAL! Shadow Striker ${amcPlayer.name} crashes the box after beating ${oppCentralDef.name} and drills a fierce finish past ${boxDef.gk?.name || 'the keeper'}!`
            : `${midEventMin}' ⚽ GOAL! After dancing past ${oppCentralDef.name}, ${amcPlayer.name} bursts into the box and slots a clinical finish 1-on-1 past ${gk?.name || 'the keeper'}!`,
          type: 'goal'
        }
        : {
          text: isShadowSurge
            ? `${midEventMin}' 🧤 SAVE! ${amcPlayer.name} bursts into the box, but ${boxDef.dc?.name || 'the defense'} closes down and ${boxDef.gk?.name || 'the keeper'} keeps out the shot!`
            : `${midEventMin}' 🧤 BIG 1v1 SAVE! ${amcPlayer.name} is clean through on goal, but ${gk?.name || 'the keeper'} spreads himself brilliantly to block the shot! ${defTeamName} clears!`,
          type: 'save'
        };

      steps.push({
        phase: isShadowSurge ? 'SHADOW STRIKER BOX FINISH' : 'AMC 1v1 vs KEEPER',
        zone: boxZone,
        attacker: amcPlayer.name,
        attackerPlayer: amcPlayer,
        attackerSlotId: amcPlayer.slotId || null,
        attackerPos: amcPlayer.effectivePos,
        attackerSkillName: 'Finishing',
        attackerSkill: finSkill,
        attackerBonus: totalFinBonus,
        attackerDie: finDie,
        attackerTotal: finTotal,
        defender: defLabel,
        defenderPlayer: dcForFoul || null,
        defenderSlotId: dcForFoul?.slotId || null,
        defenderPos: isShadowSurge ? 'DC+GK' : 'GK',
        defenderSkillName: isShadowSurge ? boxDef.formulaName : 'Handling',
        defenderSkill: defTargetSkill,
        defenderBonus: totalDefBonus,
        defenderDie: gkDie,
        defenderTotal: gkTotal,
        diff: finDiff,
        requiredDiff: 3,
        success: isGoal,
        stepLog: finLog,
        summary: isGoal
          ? `⚽ ${isShadowSurge ? 'SHADOW STRIKER' : '1v1'} GOAL! ${amcPlayer.name} beats ${defLabel} in [${boxZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+${isShadowSurge ? boxDef.formulaName : 'Hand'}:${defTargetSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff +${finDiff} >= 3)`
          : `${defLabel} denies ${amcPlayer.name} in [${boxZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+${isShadowSurge ? boxDef.formulaName : 'Hand'}:${defTargetSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff ${finDiff >= 0 ? `+${finDiff}` : finDiff} < 3)`
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

    const tbPassSkill = amcPlayer.skills.passing;
    const tbMarkSkill = oppCentralDef.skills.marking;
    const tbAttBonus = c2Num.attBonus + attMentalityMod + step2SkillBonus;
    const tbDefBonus = c2Num.defBonus + defMentalityMod + dmcManMarkBonus + defTacklingMod;
    const forcedTbDiff = testOverrides?.forceStep2Outcome === 'success'
      ? requiredAmcDiff
      : (testOverrides?.forceStep2Outcome === 'fail' ? 0 : null);
    const tbDuel = resolveDuelWithOverride(tbPassSkill + tbAttBonus, tbMarkSkill + tbDefBonus, forcedTbDiff);
    const tbPassDie = tbDuel.attDie;
    const tbMarkDie = tbDuel.defDie;
    const tbPassTotal = tbDuel.attTotal;
    const tbMarkTotal = tbDuel.defTotal;
    const tbDiff = tbDuel.diff;
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

    // Striker finishes in d2 (Home) / a2 (Away) (includes cut_inside wingers & shadow_strikers!)
    zonePath.push(boxZone);
    const striker = pickRandom(attRoster.strikers);
    const boxDef = getBoxDefenseTarget('standard');
    const finSkill = striker.skills.finishing;
    const poacherBonus = striker.instruction === 'poacher' ? 1 : 0;
    const totalFinBonus = attMentalityMod + strikerThroughBallBonus + poacherBonus + boxNum.attBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus;
    const forcedFinDiff = testOverrides?.forceStep3Outcome === 'goal'
      ? 3
      : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
    const finDuel = resolveDuelWithOverride(finSkill + totalFinBonus, boxDef.combinedSkill + totalDefBonus, forcedFinDiff);
    const finDie = finDuel.attDie;
    const gkDie = finDuel.defDie;
    const finTotal = finDuel.attTotal;
    const gkTotal = finDuel.defTotal;
    const finDiff = finDuel.diff;
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
    testOverrides?.forceActorInstruction &&
    ['high_cross', 'low_cross', 'dribble', 'through_ball', 'long_shot', 'cut_inside'].includes(testOverrides.forceActorInstruction)
  )
    ? testOverrides.forceActorInstruction
    : ((
      ['high_cross', 'low_cross', 'dribble', 'through_ball', 'cut_inside'].includes(rawWingInstr) ||
      (rawWingInstr === 'long_shot' && canWingLongShot)
    )
      ? rawWingInstr
      : (winger?.duty === 'attack' ? 'dribble' : 'high_cross'));

  const flankNum = getBoxNumericalModifiers(attRoster, defRoster, actionZone, {
    mode: 'flank',
    isHomeAtt,
    minAttCount: 1
  });
  const boxNum = getBoxNumericalModifiers(attRoster, defRoster, boxZone, {
    mode: 'exact',
    isHomeAtt,
    minAttCount: 1
  });

  // 0. Attacking Winger / Attacking Wide Mid Instruction: LONG SHOT ('long_shot')
  if (wingAction === 'long_shot') {
    return resolveLongShotOutcome({
      shooter: winger,
      shotZone: actionZone,
      targetBoxZone: boxZone,
      extraAttBonus: flankNum.attBonus,
      extraDefBonus: flankNum.defBonus,
      isFlank: true
    });
  }

  // 1. Winger / WB (+MID) Instruction: THROUGH BALL ('through_ball')
  if (wingAction === 'through_ball') {
    const tbSkill = winger.skills.passing;
    const fbSkill = oppFullback.skills.marking;
    const tbAttBonus = flankNum.attBonus + attMentalityMod + step2SkillBonus;
    const tbDefBonus = flankNum.defBonus + defMentalityMod + oppFbTightMarkMod + defTacklingMod;
    const forcedWingTb = testOverrides?.forceStep2Outcome === 'success'
      ? 4
      : (testOverrides?.forceStep2Outcome === 'fail' ? 0 : null);
    const wingTbDuel = resolveDuelWithOverride(tbSkill + tbAttBonus, fbSkill + tbDefBonus, forcedWingTb);
    const tbDie = wingTbDuel.attDie;
    const fbDie = wingTbDuel.defDie;
    const tbTotal = wingTbDuel.attTotal;
    const fbTotal = wingTbDuel.defTotal;
    const tbDiff = wingTbDuel.diff;
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
    const finSkill = striker.skills.finishing;
    const poacherBonus = striker.instruction === 'poacher' ? 1 : 0;
    const totalFinBonus = attMentalityMod + 3 + poacherBonus + boxNum.attBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus;
    const forcedTbFin = testOverrides?.forceStep3Outcome === 'goal'
      ? 3
      : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
    const tbFinDuel = resolveDuelWithOverride(finSkill + totalFinBonus, boxDef.combinedSkill + totalDefBonus, forcedTbFin);
    const finDie = tbFinDuel.attDie;
    const gkDie = tbFinDuel.defDie;
    const finTotal = tbFinDuel.attTotal;
    const gkTotal = tbFinDuel.defTotal;
    const finDiff = tbFinDuel.diff;
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

  // 2. Winger / Attacking WB Instruction: DRIBBLE ('dribble') or CUT INSIDE ('cut_inside') -> shoots!
  if (wingAction === 'dribble' || wingAction === 'cut_inside') {
    const isCutInsideAction = wingAction === 'cut_inside';
    const dribSkill = winger.skills.dribbling;
    const tackSkill = oppFullback.skills.tackling;
    const dribAttBonus = flankNum.attBonus + attMentalityMod + step2SkillBonus;
    const dribDefBonus = flankNum.defBonus + defMentalityMod + oppFbTackleMod + defTacklingMod;
    const forcedWingDrib = testOverrides?.forceStep2Outcome === 'success'
      ? 2
      : (testOverrides?.forceStep2Outcome === 'fail' ? 0 : null);
    const wingDribDuel = resolveDuelWithOverride(dribSkill + dribAttBonus, tackSkill + dribDefBonus, forcedWingDrib);
    const dribDie = wingDribDuel.attDie;
    const tackDie = wingDribDuel.defDie;
    const dribTotal = wingDribDuel.attTotal;
    const tackTotal = wingDribDuel.defTotal;
    const dribDiff = wingDribDuel.diff;
    const dribSuccess = dribDiff >= 2;

    const dribLog = dribSuccess
      ? {
        text: isCutInsideAction
          ? `${midEventMin}' ⚡ ${winger.name} (${attTeamName}) ghosts inside off the flank past ${oppFullback.name} directly into [${boxZone.toUpperCase()}] for a shot!`
          : `${midEventMin}' 🔥 ${winger.name} (${attTeamName}) skins ${oppFullback.name} down the wing and cuts inside, 1-on-1 with the keeper!`,
        type: 'chance'
      }
      : {
        text: `${midEventMin}' ${winger.name} (${attTeamName}) tries to ${isCutInsideAction ? 'cut inside off the flank' : 'take on ' + oppFullback.name + ' down the flank'}, but ${oppFullback.name} wins a crunching tackle to reclaim possession!`,
        type: 'save'
      };

    steps.push({
      phase: isCutInsideAction ? 'WINGER CUT INSIDE' : (isAttackingWingBack ? 'WB OVERLAP DRIBBLE (1v1)' : 'WING DRIBBLE (1v1)'),
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
        ? `${winger.name} ${isCutInsideAction ? 'cuts inside past' : 'dribbles past'} ${oppFullback.name} in [${actionZone.toUpperCase()}]! (d10:${dribDie}+Drib:${dribSkill}${fmtBonus(dribAttBonus)}=${dribTotal} vs d10:${tackDie}+Tack:${tackSkill}${fmtBonus(dribDefBonus)}=${tackTotal}, diff +${dribDiff} >= 2)`
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

    const finishZone = isCutInsideAction ? boxZone : wingDeepZone;
    if (zonePath[zonePath.length - 1] !== finishZone) {
      zonePath.push(finishZone);
    }

    const boxDef = getBoxDefenseTarget('standard');
    const finSkill = winger.skills.finishing;
    const totalFinBonus = attMentalityMod + boxNum.attBonus;
    const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus;
    const forcedWingDribFin = testOverrides?.forceStep3Outcome === 'goal'
      ? 3
      : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
    const wingDribFinDuel = resolveDuelWithOverride(finSkill + totalFinBonus, boxDef.combinedSkill + totalDefBonus, forcedWingDribFin);
    const finDie = wingDribFinDuel.attDie;
    const gkDie = wingDribFinDuel.defDie;
    const finTotal = wingDribFinDuel.attTotal;
    const gkTotal = wingDribFinDuel.defTotal;
    const finDiff = wingDribFinDuel.diff;
    const isGoal = finDiff >= 3;

    const dribFinishLog = isGoal
      ? {
        text: `${midEventMin}' ⚽ GOAL! ${winger.name} ${isCutInsideAction ? 'cuts inside off the flank' : 'bursts past ' + oppFullback.name} into the penalty area and rifles a low shot past ${boxDef.gk?.name || 'the keeper'}!`,
        type: 'goal'
      }
      : {
        text: `${midEventMin}' 🧤 ${winger.name} ${isCutInsideAction ? 'cuts inside into the box' : 'beats ' + oppFullback.name + ' into the box'} and strikes at goal, but ${boxDef.gk?.name || 'the keeper'} makes a crucial save! ${defTeamName} clears!`,
        type: 'save'
      };

    steps.push({
      phase: isCutInsideAction ? 'CUT INSIDE FINISH' : (isAttackingWingBack ? 'WB OVERLAP 1v1 SHOT' : 'WINGER 1v1 SHOT'),
      zone: finishZone,
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
        ? `⚽ GOAL! ${winger.name} scores in [${finishZone.toUpperCase()}]! (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff +${finDiff} >= 3)`
        : `${boxDef.gk?.name || 'GK'} saves ${winger.name}'s shot in [${finishZone.toUpperCase()}] (d10:${finDie}+Fin:${finSkill}${fmtBonus(totalFinBonus)}=${finTotal} vs d10:${gkDie}+Def/GK:${boxDef.combinedSkill}${fmtBonus(totalDefBonus)}=${gkTotal}, diff ${finDiff >= 0 ? `+${finDiff}` : finDiff} < 3)`
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
      activeZone: finishZone,
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
  const crossSkill = winger.skills.crossing;
  const fbMarkSkill = oppFullback.skills.marking;
  const crossAttBonus = flankNum.attBonus + attMentalityMod + step2SkillBonus;
  const crossDefBonus = flankNum.defBonus + defMentalityMod + oppFbTightMarkMod + defTacklingMod;
  const forcedCrossDiff = testOverrides?.forceStep2Outcome === 'success'
    ? 2
    : (testOverrides?.forceStep2Outcome === 'fail' ? 0 : null);
  const crossDuel = resolveDuelWithOverride(crossSkill + crossAttBonus, fbMarkSkill + crossDefBonus, forcedCrossDiff);
  const crossDie = crossDuel.attDie;
  const fbMarkDie = crossDuel.defDie;
  const crossTotal = crossDuel.attTotal;
  const fbMarkTotal = crossDuel.defTotal;
  const crossDiff = crossDuel.diff;
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

  const strikerSkill = isLowCross ? striker.skills.finishing : striker.skills.heading;
  const strikerSkillName = isLowCross ? 'Finishing' : 'Heading';
  const strikerInstrMod = isLowCross
    ? (striker.instruction === 'poacher' ? 1 : (striker.instruction === 'target_man' ? -1 : 0))
    : (striker.instruction === 'target_man' ? 1 : (striker.instruction === 'poacher' ? -1 : 0));

  const totalAttBonus = attMentalityMod + strikerInstrMod + boxNum.attBonus;
  const totalDefBonus = defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus;
  const forcedCrossFin = testOverrides?.forceStep3Outcome === 'goal'
    ? 3
    : (testOverrides?.forceStep3Outcome === 'save' ? 0 : null);
  const crossFinDuel = resolveDuelWithOverride(strikerSkill + totalAttBonus, boxDef.combinedSkill + totalDefBonus, forcedCrossFin);
  const finishDie = crossFinDuel.attDie;
  const gkDie = crossFinDuel.defDie;
  const finishTotal = crossFinDuel.attTotal;
  const gkTotal = crossFinDuel.defTotal;
  const finishDiff = crossFinDuel.diff;
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
 * Simulates one possession sequence on the 12-box grid (`a1..d3`) with full
 * Position Individual Instructions support.
 * Preserves recovered ball zone & defender on turnovers/saves so defenders (DR/DL/DC/GK)
 * must pass out of their won zone (e.g. B3 -> B2 MC or up flank) instead of warping to MC.
 */
export function simulateZone12Possession(params) {
  let res = runZone12PossessionCore(params);
  if (!res) return res;

  // Replace internal step minute prefixes with exact live clock labels (e.g. 35', 36', 37' or 45+1', 45+2')
  const labels = params?.stepMinuteLabels;
  if (labels && Array.isArray(res.steps)) {
    const stampedSteps = res.steps.map((st, idx) => {
      const targetLbl = labels[`step${idx + 1}`] || labels.step1;
      if (!targetLbl || !st?.stepLog?.text) return st;
      const updatedText = String(st.stepLog.text).replace(/^\d+'/, `${targetLbl}'`);
      return {
        ...st,
        stepLog: { ...st.stepLog, text: updatedText }
      };
    });
    res = { ...res, steps: stampedSteps };
  }

  if (res.isGoal || res.nextRecycleState || res.isHoldPossession) {
    return res;
  }

  const winnerSide = res.nextAttacker;
  if (!winnerSide) return res;
  const winIsHome = winnerSide === 'home';

  if (res.isShot) {
    // Save by Keeper -> GK has the ball in a2 / d2 to distribute to MC (or GK Long)
    const winZone = winIsHome ? 'a2' : 'd2';
    const winGk = winIsHome ? res.homeGk : res.awayGk;
    return {
      ...res,
      nextRecycleState: winGk
        ? { side: winnerSide, zone: winZone, player: winGk, isRecovery: true }
        : null
    };
  }

  const lastStep = res.steps && res.steps.length > 0 ? res.steps[res.steps.length - 1] : null;
  const winZone = lastStep?.zone || res.activeZone || (winIsHome ? 'b2' : 'c2');
  const winnerZonePlayers = winIsHome ? res.homeZonePlayers : res.awayZonePlayers;
  const fallbackPool = winnerZonePlayers?.[winZone] || [];
  const winPlayer = lastStep?.defenderPlayer || fallbackPool[0] || null;

  return {
    ...res,
    nextRecycleState: winPlayer
      ? { side: winnerSide, zone: winZone, player: winPlayer, isRecovery: true }
      : null
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

/**
 * Initializes an idle Step 1 session for the 12-Box interactive step-by-step test sandbox.
 */
export function createZone12StepSession({
  possessionSide = 'home',
  homeRoster = null,
  awayRoster = null,
  forceStep1Mode = 'auto',
  isKickoffRestart = false,
  recycleState = null
} = {}) {
  const isHome = possessionSide === 'home';
  const attRoster = isHome ? homeRoster : awayRoster;
  const activeRecycle = (!isKickoffRestart && recycleState && recycleState.side === possessionSide && recycleState.player)
    ? recycleState
    : null;
  const isGkRecycle = Boolean(activeRecycle && (activeRecycle.player?.effectivePos === 'GK' || activeRecycle.player?.name === attRoster?.gk?.name));
  const isGkLong = !isKickoffRestart && (!activeRecycle || isGkRecycle) && attRoster && (
    forceStep1Mode === 'gk_long' ||
    (forceStep1Mode === 'auto' && attRoster.gk?.instruction === 'long')
  );
  const startZone = activeRecycle?.zone || (isGkLong ? (isHome ? 'a2' : 'd2') : (isHome ? 'b2' : 'c2'));

  return {
    phase: 'STEP_1',
    possessionSide,
    attackingSide: possessionSide,
    ballZone: startZone,
    displayPath: [startZone],
    steps: [],
    logs: [],
    cards: [],
    recycleState: activeRecycle,
    isKickoffRestart,
    step2Context: null,
    step3Context: null,
    lastStepSummary: null,
    turnoverSide: null,
    isCompleted: false
  };
}

/**
 * Advances the interactive 12-Box step-by-step sandbox by EXACTLY ONE decision step:
 *  - From `STEP_1`: executes Midfield/Recycled Pass or GK Long Kick ONLY -> stops at `STEP_2`
 *    (or stays `STEP_1` on Hold 0/+1, or flips possession on Failure -1 / Empty Turnover).
 *  - From `STEP_2`: executes Long Ball Tackle, AMC Play, Wing Cross/Dribble, or Long Shot ->
 *    stops at `STEP_3` inside the penalty box (or flips possession on Failure / resolves Long Shot).
 *  - From `STEP_3`: executes Box Finish / Header -> Goal or Save, then resets to Opponent `STEP_1`.
 */
export function advanceZone12SandboxStep({
  session,
  decision = 'random', // STEP_1: 'success_2'|'success_4'|'hold_0_1'|'fail_1'|'counter_2'|'random' | STEP_2: 'success'|'fail'|'goal'|'save'|'random' | STEP_3: 'goal'|'save'|'random'
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
  homeTeam = { name: 'Home XI' },
  awayTeam = { name: 'Away XI' },
  forceChannel = 'auto',
  forceStep1Mode = 'auto',
  forceActorInstruction = 'auto'
}) {
  const homeRoster = buildTeamZoneRoster(homeLineup, homeRoles, 'home', homeTeam, homeFormation, homeInstructions);
  const awayRoster = buildTeamZoneRoster(awayLineup, awayRoles, 'away', awayTeam, awayFormation, awayInstructions);
  const current = session || createZone12StepSession({
    possessionSide: 'home',
    homeRoster,
    awayRoster,
    forceStep1Mode
  });

  const mentalityBonusMap = (tactic) => (tactic === 'attack' ? 1 : (tactic === 'defense' ? -1 : 0));
  const eventMin = 42;
  const existingCards = Array.isArray(current.cards) ? current.cards : [];

  const evaluateSandboxDiscipline = ({
    defSide,
    defPlayer,
    defDie,
    defTeamTactics,
    isBoxZone = false,
    boxZone = null,
    attRoster = null,
    defRoster = null
  }) => {
    const tackleMode = String(defTeamTactics?.tackling || 'normal').toLowerCase();
    const teamReds = existingCards.filter((c) => c.side === defSide && (c.type === 'red' || c.type === 'second_yellow')).length;
    const matchReds = existingCards.filter((c) => c.type === 'red' || c.type === 'second_yellow').length;
    const check = resolveFoulCheck({
      rawRoll: defDie,
      sides: 10,
      tackling: tackleMode,
      teamRedCards: teamReds,
      matchRedCards: matchReds,
      foulFrequencyScale: 1
    });

    if (!check.foul) {
      return { cardEntry: null, nextCards: existingCards, penaltyResult: null, note: '' };
    }

    const offender = (defPlayer && defPlayer.effectivePos !== 'GK')
      ? defPlayer
      : (defRoster?.dcs?.[0] || defPlayer || { name: 'Defender', position: 'DC' });
    const priorYellows = existingCards.filter(
      (c) => c.side === defSide && c.playerName === offender.name && c.type === 'yellow'
    ).length;

    let cardEntry = null;
    let nextCards = existingCards;
    let cardNote = `⚠️ Foul by ${offender.name} (${tackleMode.toUpperCase()} tackling)`;

    if (check.outcome !== 'warning') {
      const cardType = check.outcome === 'red'
        ? 'red'
        : (priorYellows >= 1 ? 'second_yellow' : 'yellow');
      cardEntry = {
        id: `${Date.now()}_${defSide}_${offender.name}`,
        side: defSide,
        playerName: offender.name,
        type: cardType
      };
      nextCards = [...existingCards, cardEntry];
      cardNote = cardType === 'red'
        ? `🟥 DIRECT RED CARD: ${offender.name} sent off!`
        : (cardType === 'second_yellow'
          ? `🟨🟥 SECOND YELLOW RED: ${offender.name} sent off!`
          : `🟨 YELLOW CARD: ${offender.name} booked!`);
    }

    let penaltyResult = null;
    if (isBoxZone && attRoster && defRoster) {
      const attSide = defSide === 'home' ? 'away' : 'home';
      const taker = attRoster.strikers?.[0] || attRoster.effectiveAmcs?.[0] || attRoster.all?.[0];
      const gk = defRoster.gk;
      penaltyResult = resolveZone12PenaltyKick({
        attackingSide: attSide,
        zone: boxZone || (attSide === 'home' ? 'd2' : 'a2'),
        taker,
        gk,
        attTeamName: attSide === 'home' ? (homeTeam?.name || 'Home XI') : (awayTeam?.name || 'Away XI'),
        defTeamName: defSide === 'home' ? (homeTeam?.name || 'Home XI') : (awayTeam?.name || 'Away XI'),
        minute: eventMin
      });
      cardNote = `🚨 PENALTY KICK! ${cardNote} ➔ ${penaltyResult.log.text}`;
    }

    return { cardEntry, nextCards, penaltyResult, note: cardNote };
  };

  const buildNextIdleSession = ({
    nextSide,
    kickoff = false,
    nextRecycle = null,
    visualZone,
    displayPath,
    steps,
    logs,
    lastStepSummary,
    turnoverSide = null,
    isGoal = false,
    isShot = false,
    isHold = false,
    counterTriggered = false,
    nextCards = existingCards
  }) => {
    let resolvedRecycle = nextRecycle;
    if (isGoal || kickoff) {
      resolvedRecycle = null;
    } else if (!resolvedRecycle) {
      const nextIsHome = nextSide === 'home';
      const nextRoster = nextIsHome ? homeRoster : awayRoster;
      if (isShot) {
        const saveZone = nextIsHome ? 'a2' : 'd2';
        resolvedRecycle = nextRoster.gk
          ? { side: nextSide, zone: saveZone, player: nextRoster.gk, isRecovery: true }
          : null;
      } else {
        const lastStep = steps && steps.length > 0 ? steps[steps.length - 1] : null;
        const winZone = visualZone || (nextIsHome ? 'b2' : 'c2');
        const fallbackPool = nextRoster.zonePlayers?.[winZone] || [];
        const winPlayer = lastStep?.defenderPlayer || fallbackPool[0] || null;
        resolvedRecycle = winPlayer
          ? { side: nextSide, zone: winZone, player: winPlayer, isRecovery: true }
          : null;
      }
    }

    return {
      session: {
        phase: 'STEP_1',
        possessionSide: nextSide,
        attackingSide: nextSide,
        ballZone: (resolvedRecycle?.zone) || (nextSide === 'home' ? 'b2' : 'c2'),
        displayPath,
        steps: [],
        logs: [],
        cards: nextCards,
        recycleState: resolvedRecycle,
        isKickoffRestart: kickoff,
        step2Context: null,
        step3Context: null,
        lastStepSummary,
        turnoverSide,
        isCompleted: true
      },
      zoneResult: {
        minutesElapsed: 1,
        step1Side: current.possessionSide,
        attackingSide: current.attackingSide,
        nextAttacker: nextSide,
        nextRecycleState: resolvedRecycle,
        isHoldPossession: isHold,
        counterTriggered,
        startZone: displayPath[0] || visualZone,
        activeZone: visualZone,
        zonePath: displayPath,
        steps,
        logs,
        cards: nextCards,
        isGoal,
        isShot,
        isOnTarget: isShot,
        isLongJump: false,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      }
    };
  };

  // ===========================================================================
  // PHASE 1: MIDFIELD / RECYCLED PASS / GK LONG KICK -> STOPS BEFORE STEP 2
  // ===========================================================================
  if (current.phase === 'STEP_1') {
    const initSide = current.possessionSide;
    const initIsHome = initSide === 'home';
    const oppSide = initIsHome ? 'away' : 'home';
    const initAttRoster = initIsHome ? homeRoster : awayRoster;
    const initDefRoster = initIsHome ? awayRoster : homeRoster;
    const initDefTeamName = initIsHome ? (awayTeam?.name || 'Away XI') : (homeTeam?.name || 'Home XI');
    const initAttTactic = initIsHome ? homeTactic : awayTactic;
    const initAttTeamTactics = initIsHome ? homeTeamTactics : awayTeamTactics;
  const initDefTeamTactics = initIsHome ? awayTeamTactics : homeTeamTactics;

    const activeRecycle = (!current.isKickoffRestart && current.recycleState && current.recycleState.side === initSide && current.recycleState.player)
      ? current.recycleState
      : null;
    const initGk = initAttRoster.gk;
    const isGkRecycle = Boolean(activeRecycle && (activeRecycle.player?.effectivePos === 'GK' || activeRecycle.player?.name === initGk?.name));
    const isGkLongDistribution = !current.isKickoffRestart && (!activeRecycle || isGkRecycle) && (
      forceStep1Mode === 'gk_long' ||
      (forceStep1Mode === 'auto' && initGk?.instruction === 'long')
    );

    const startZone = activeRecycle?.zone || (isGkLongDistribution ? (initIsHome ? 'a2' : 'd2') : (initIsHome ? 'b2' : 'c2'));
    const channelOverride = forceChannel !== 'auto' ? forceChannel : null;

    let midPasser = null;
    let midMarker = null;
    let midSuccess = false;
    let counterTriggered = false;
    let step2SkillBonus = 0;
    let step1Record = null;
    let preChosenChannel = null;

    if (isGkLongDistribution) {
      preChosenChannel = chooseTargetChannelHelper(initAttRoster, initIsHome, initAttTeamTactics, channelOverride);
      const targetZone = preChosenChannel.zone;
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
      const attTackBonus = (initAttTactic === 'attack' ? 1 : 0) + (isGkRecycle ? 5 : 0);
      const defTackBonus = getTacklingMod(initDefTeamTactics);
      const forcedGkDiff = (decision === 'success_2' || decision === 'success_4')
        ? 2
        : (decision === 'counter_2' ? -2 : (decision === 'fail_1' || decision === 'hold_0_1' ? -1 : null));
      const gkDuel = resolveDuelWithOverride(targetAttPlayer.skills.tackling + attTackBonus, targetDefPlayer.skills.tackling + defTackBonus, forcedGkDiff);
      const tackDiff = gkDuel.diff;
      midSuccess = tackDiff >= 2;
      counterTriggered = tackDiff <= -2;

      step1Record = {
        phase: 'GK LONG DISTRIBUTION (TACKLE)',
        zone: targetZone,
        attacker: targetAttPlayer.name,
        attackerPlayer: targetAttPlayer,
        attackerSlotId: targetAttPlayer.slotId || null,
        attackerPos: targetAttPlayer.effectivePos,
        attackerSkillName: 'Tackling',
        attackerSkill: targetAttPlayer.skills.tackling,
        attackerBonus: attTackBonus,
        attackerDie: gkDuel.attDie,
        attackerTotal: gkDuel.attTotal,
        defender: targetDefPlayer.name,
        defenderPlayer: targetDefPlayer,
        defenderSlotId: targetDefPlayer.slotId || null,
        defenderPos: targetDefPlayer.effectivePos,
        defenderSkillName: 'Tackling',
        defenderSkill: targetDefPlayer.skills.tackling,
        defenderBonus: defTackBonus,
        defenderDie: gkDuel.defDie,
        defenderTotal: gkDuel.defTotal,
        diff: tackDiff,
        requiredDiff: 2,
        success: midSuccess,
        counterTriggered,
        summary: midSuccess
          ? `🚀 ${initGk.name} launches long [${startZone.toUpperCase()} -> ${targetZone.toUpperCase()}]! ${targetAttPlayer.name} wins tackle vs ${targetDefPlayer.name} (diff +${tackDiff})`
          : (counterTriggered
            ? `⚡ ${targetDefPlayer.name} wins GK long-ball tackle in [${targetZone.toUpperCase()}] and triggers a COUNTER! (diff ${tackDiff})`
            : `❌ ${targetDefPlayer.name} wins GK long-ball tackle in [${targetZone.toUpperCase()}] — ${initDefTeamName} takes possession! (diff ${tackDiff})`)
      };

      if (!midSuccess && !counterTriggered) {
        const failLog = { text: `${eventMin}' ${step1Record.summary}`, type: 'normal' };
        return buildNextIdleSession({
          nextSide: oppSide,
          visualZone: targetZone,
          displayPath: [startZone, targetZone],
          steps: [step1Record],
          logs: [failLog],
          lastStepSummary: step1Record.summary,
          turnoverSide: oppSide
        });
      }
    } else {
      const attMids = initAttRoster.buildUpMids && initAttRoster.buildUpMids.length > 0
        ? initAttRoster.buildUpMids
        : initAttRoster.centralMids;
      const defMids = initDefRoster.step1PressMids && initDefRoster.step1PressMids.length > 0
        ? initDefRoster.step1PressMids
        : initDefRoster.centralMids;

      const resolvePressingDefenderForZone = (z) => {
        const isDeepBack = initIsHome ? z.startsWith('a') : z.startsWith('d');
        if (isDeepBack) {
          const highPressPool = [...(initDefRoster.strikers || []), ...(initDefRoster.effectiveAmcs || [])].filter(Boolean);
          if (highPressPool.length > 0) return pickRandom(highPressPool);
        }
        if (z === 'b1' || z === 'c1' || z === 'b3' || z === 'c3') {
          const widePress = initIsHome
            ? (z === 'b1' ? initDefRoster.rightWings : initDefRoster.leftWings)
            : (z === 'c1' ? initDefRoster.leftWings : initDefRoster.rightWings);
          if (widePress && widePress.length > 0) return pickRandom(widePress);
        }
        return pickRandom(defMids);
      };

      midPasser = activeRecycle
        ? (Object.values(initAttRoster.zonePlayers).flat().find((p) => p && p.name === activeRecycle.player.name) || activeRecycle.player)
        : pickRandom(attMids);
      midMarker = activeRecycle ? resolvePressingDefenderForZone(startZone) : pickRandom(defMids);

      const isMidThroughBall = !activeRecycle && (
        forceStep1Mode === 'mid_through'
          ? true
          : (forceStep1Mode === 'mid_pass' ? false : midPasser.instruction === 'through_ball')
      );
      const requiredMidDiff = isMidThroughBall ? 4 : 2;
      const ballPlayDcBonus = (['DC', 'CB', 'SW'].includes(midPasser.effectivePos) && midPasser.instruction === 'direct_pass') ? 1 : 0;
      const step1Num = getBoxNumericalModifiers(initAttRoster, initDefRoster, startZone, {
        mode: (startZone === 'b2' || startZone === 'c2') ? 'midfield_step1' : 'exact',
        isHomeAtt: initIsHome,
        minAttCount: 1
      });
      const gkPassProtectionBonus = (midPasser.effectivePos === 'GK' || midPasser.name === initGk?.name) ? 5 : 0;
      const attStep1Bonus = step1Num.attBonus
        + (initAttRoster.dmcCount >= 2 ? 1 : 0)
        + (initAttTactic === 'attack' ? 1 : (initAttTactic === 'defense' ? -2 : 0))
        + ballPlayDcBonus
        + gkPassProtectionBonus;
      const defStep1Bonus = step1Num.defBonus + getTacklingMod(initDefTeamTactics);
      const baseCounterThreshold = initAttTactic === 'defense' ? -4 : -2;
      const counterThreshold = initDefTeamTactics?.counterAttack === true
        ? (initAttTactic === 'defense' ? -2 : -1)
        : baseCounterThreshold;

      let forcedStep1Diff = null;
      if (decision === 'success_2') forcedStep1Diff = requiredMidDiff;
      else if (decision === 'success_4') forcedStep1Diff = 4;
      else if (decision === 'hold_0_1') forcedStep1Diff = 0;
      else if (decision === 'fail_1') forcedStep1Diff = -1;
      else if (decision === 'counter_2') forcedStep1Diff = counterThreshold;

      const s1Duel = resolveDuelWithOverride(midPasser.skills.passing + attStep1Bonus, midMarker.skills.marking + defStep1Bonus, forcedStep1Diff);
      const midDiff = s1Duel.diff;
      midSuccess = midDiff >= requiredMidDiff;
      counterTriggered = !current.isKickoffRestart && midDiff <= counterThreshold;
      const isHoldPossession = !midSuccess && !counterTriggered && (midDiff === 0 || midDiff === 1);
      if (midSuccess && isMidThroughBall) step2SkillBonus = 3;

      const s1Disc = evaluateSandboxDiscipline({
        defSide: oppSide,
        defPlayer: midMarker,
        defDie: s1Duel.defDie,
        defTeamTactics: initDefTeamTactics,
        isBoxZone: false,
        attRoster: initAttRoster,
        defRoster: initDefRoster
      });

      const holdPick = isHoldPossession ? pickHoldTargetHelper(initAttRoster, startZone, midPasser, initIsHome) : null;
      const baseSummary = midSuccess
        ? `✅ ${midPasser.name} passes cleanly from [${startZone.toUpperCase()}] (diff +${midDiff} >= ${requiredMidDiff})`
        : (counterTriggered
          ? `⚡ ${midMarker.name} steals from ${midPasser.name} in [${startZone.toUpperCase()}] & launches a COUNTER! (diff ${midDiff})`
          : (isHoldPossession && holdPick
            ? `🔄 Closed down (diff +${midDiff}) — ${midPasser.name} recycles safely [${startZone.toUpperCase()} -> ${holdPick.zone.toUpperCase()}] to ${holdPick.player.name}!`
            : `❌ ${midMarker.name} intercepts ${midPasser.name} in [${startZone.toUpperCase()}] — ${initDefTeamName} takes possession! (diff ${midDiff})`));

      step1Record = {
        phase: activeRecycle ? 'RECYCLED BUILD-UP PASS' : (isMidThroughBall ? 'MIDFIELD THROUGH-BALL (+3)' : 'MIDFIELD BUILD-UP'),
        zone: startZone,
        attacker: midPasser.name,
        attackerPlayer: midPasser,
        attackerSlotId: midPasser.slotId || null,
        attackerPos: midPasser.effectivePos,
        attackerSkillName: 'Passing',
        attackerSkill: midPasser.skills.passing,
        attackerBonus: attStep1Bonus,
        attackerDie: s1Duel.attDie,
        attackerTotal: s1Duel.attTotal,
        defender: midMarker.name,
        defenderPlayer: midMarker,
        defenderSlotId: midMarker.slotId || null,
        defenderPos: midMarker.effectivePos,
        defenderSkillName: 'Marking',
        defenderSkill: midMarker.skills.marking,
        defenderBonus: defStep1Bonus,
        defenderDie: s1Duel.defDie,
        defenderTotal: s1Duel.defTotal,
        diff: midDiff,
        requiredDiff: requiredMidDiff,
        success: midSuccess,
        counterTriggered,
        holdPossession: isHoldPossession,
        holdTargetZone: holdPick?.zone || null,
        summary: s1Disc.note ? `${baseSummary} | ${s1Disc.note}` : baseSummary
      };

      const ownBoxZone = initIsHome ? 'a2' : 'd2';
      if (!midSuccess && !isHoldPossession && startZone === ownBoxZone) {
        // Attacker stole GK/DC short pass right inside the penalty box (a2 / d2) -> go straight to STEP_3 shot!
        const oppIsHome = oppSide === 'home';
        const oppAttTactic = oppIsHome ? homeTactic : awayTactic;
        const oppDefTactic = oppIsHome ? awayTactic : homeTactic;
        const stealFinMod = oppAttTactic === 'attack' ? 1 : (oppAttTactic === 'defense' ? -2 : 0);
        const stealDefMod = oppDefTactic === 'defense' ? 1 : (oppDefTactic === 'attack' ? -1 : 0);
        const is1v1Gk = (midPasser.effectivePos === 'GK' || midPasser.name === initGk?.name);
        const boxDef = resolveBoxDefenseHelper(initAttRoster, 'standard');
        const stealSummary = `⚡ ${midMarker.name} steals ${midPasser.name}'s pass inside [${startZone.toUpperCase()}] — immediate 1v1 shot in the box!${s1Disc.note ? ` | ${s1Disc.note}` : ''}`;
        const stealRecord = { ...step1Record, summary: stealSummary };
        const nextSession = {
          phase: 'STEP_3',
          possessionSide: oppSide,
          attackingSide: oppSide,
          ballZone: startZone,
          displayPath: [startZone],
          steps: [stealRecord],
          logs: [{ text: `${eventMin}' ${stealSummary}`, type: 'chance' }],
          cards: s1Disc.nextCards,
          recycleState: null,
          isKickoffRestart: false,
          step2Context: null,
          step3Context: {
            attackingSide: oppSide,
            defendingSide: initSide,
            boxZone: startZone,
            finisher: midMarker,
            assister: null,
            boxDefMode: 'standard',
            boxDef,
            finSkill: midMarker.skills.finishing,
            finSkillName: 'Finishing',
            totalFinBonus: stealFinMod,
            totalDefBonus: stealDefMod + (is1v1Gk ? 0 : boxDef.dcInstrBonus + getTacklingMod(initAttTeamTactics)),
            is1v1Keeper: is1v1Gk,
            counterTriggered: true
          },
          lastStepSummary: stealSummary,
          turnoverSide: oppSide,
          isCompleted: false
        };
        return {
          session: nextSession,
          zoneResult: {
            minutesElapsed: 1,
            step1Side: initSide,
            attackingSide: oppSide,
            nextAttacker: oppSide,
            counterTriggered: true,
            startZone,
            activeZone: startZone,
            zonePath: [startZone],
            steps: nextSession.steps,
            logs: nextSession.logs,
            cards: s1Disc.nextCards,
            isGoal: false,
            isShot: false,
            homeZonePlayers: homeRoster.zonePlayers,
            awayZonePlayers: awayRoster.zonePlayers
          }
        };
      }

      if (!midSuccess && !counterTriggered) {
        if (isHoldPossession && holdPick) {
          const holdLog = { text: `${eventMin}' ${step1Record.summary}`, type: 'normal' };
          return buildNextIdleSession({
            nextSide: initSide,
            nextRecycle: { side: initSide, zone: holdPick.zone, player: holdPick.player },
            visualZone: holdPick.zone,
            displayPath: [startZone, holdPick.zone],
            steps: [step1Record],
            logs: [holdLog],
            lastStepSummary: step1Record.summary,
            isHold: true,
            nextCards: s1Disc.nextCards
          });
        }
        const failLog = { text: `${eventMin}' ${step1Record.summary}`, type: 'normal' };
        return buildNextIdleSession({
          nextSide: oppSide,
          visualZone: startZone,
          displayPath: [startZone],
          steps: [step1Record],
          logs: [failLog],
          lastStepSummary: step1Record.summary,
          turnoverSide: oppSide,
          nextCards: s1Disc.nextCards
        });
      }
    }

    // Step 1 succeeded OR Counter triggered!
    // If starting from a won defensive/flank box (e.g. DR in b3 or GK/DC in a2), apply flank/MC transfer logic
    // unless Counter Attack = Yes launches directly into STEP 2 (+2)!
    const attackingSide = counterTriggered ? oppSide : initSide;
    const defendingSide = attackingSide === 'home' ? 'away' : 'home';
    const isHomeAtt = attackingSide === 'home';
    const attRoster = isHomeAtt ? homeRoster : awayRoster;
    const defRoster = isHomeAtt ? awayRoster : homeRoster;
    const attTeamName = isHomeAtt ? (homeTeam?.name || 'Home XI') : (awayTeam?.name || 'Away XI');
    const defTeamName = isHomeAtt ? (awayTeam?.name || 'Away XI') : (homeTeam?.name || 'Home XI');
    const attTeamTactics = isHomeAtt ? homeTeamTactics : awayTeamTactics;

    let recoveryTransferPlan = null;
    if (!counterTriggered && !isGkLongDistribution && activeRecycle) {
      recoveryTransferPlan = resolveFlankOrDefBuildUpPlan({
        startZone,
        attRoster,
        isHomeAtt,
        attTeamTactics,
        forceChannel: channelOverride,
        isRecovery: Boolean(activeRecycle?.isRecovery)
      });
      if ((recoveryTransferPlan.kind === 'to_mc' || recoveryTransferPlan.kind === 'to_flank_mid') && recoveryTransferPlan.nextZone) {
        const nextPlayer = recoveryTransferPlan.nextPlayer;
        const transferSummary = `✅ ${midPasser.name} passes [${startZone.toUpperCase()} ➔ ${recoveryTransferPlan.nextZone.toUpperCase()}] to ${nextPlayer?.name || 'MC'}!`;
        const transferRecord = {
          ...step1Record,
          phase: 'RECOVERY PASS',
          summary: transferSummary
        };
        return buildNextIdleSession({
          nextSide: attackingSide,
          nextRecycle: nextPlayer
            ? { side: attackingSide, zone: recoveryTransferPlan.nextZone, player: nextPlayer, isRecovery: true }
            : null,
          visualZone: recoveryTransferPlan.nextZone,
          displayPath: [startZone, recoveryTransferPlan.nextZone],
          steps: [transferRecord],
          logs: [{ text: `${eventMin}' ${transferSummary}`, type: 'normal' }],
          lastStepSummary: transferSummary
        });
      }
    }

    const isCounterLaunch = Boolean(
      (counterTriggered && attTeamTactics?.counterAttack === true) ||
      recoveryTransferPlan?.kind === 'to_counter_step2' ||
      (isGkLongDistribution && isGkRecycle && attTeamTactics?.counterAttack === true)
    );
    if (isCounterLaunch) {
      step2SkillBonus += 2;
    }

    const chosenChannel = (!counterTriggered && preChosenChannel)
      ? preChosenChannel
      : (recoveryTransferPlan?.chosenChannel || chooseTargetChannelHelper(attRoster, isHomeAtt, attTeamTactics, channelOverride));
    const isTeamLongPass = !isGkLongDistribution && attTeamTactics?.passing === 'long';
    const deepTargetZone = isHomeAtt
      ? (chosenChannel.channel === 'left' ? 'd1' : (chosenChannel.channel === 'right' ? 'd3' : 'd2'))
      : (chosenChannel.channel === 'left' ? 'a3' : (chosenChannel.channel === 'right' ? 'a1' : 'a2'));
    const secondZone = isTeamLongPass ? deepTargetZone : chosenChannel.zone;
    const boxZone = isHomeAtt ? 'd2' : 'a2';
    const pathToStep2 = [startZone, secondZone];

    // Check empty-box turnovers on Step 1 -> Step 2 transition
    if (isTeamLongPass) {
      const attDeepPlayers = (attRoster.zonePlayers[deepTargetZone] || []).filter((p) => p.effectivePos !== 'GK' && p !== attRoster.gk);
      if (attDeepPlayers.length === 0) {
        const emptySummary = `❌ Long ball to [${deepTargetZone.toUpperCase()}] — NO ${attTeamName} player in box! ${defTeamName} collects.`;
        const emptyStep = { phase: 'LONG BALL (NO TEAMMATE IN BOX)', zone: deepTargetZone, success: false, summary: emptySummary };
        return buildNextIdleSession({
          nextSide: defendingSide,
          visualZone: deepTargetZone,
          displayPath: pathToStep2,
          steps: [step1Record, emptyStep],
          logs: [{ text: `${eventMin}' ${emptySummary}`, type: 'save' }],
          lastStepSummary: emptySummary,
          turnoverSide: defendingSide,
          counterTriggered
        });
      }

      const attTarget = pickRandom(attDeepPlayers);
      const defDeepPlayers = (defRoster.zonePlayers[deepTargetZone] || []).filter((p) => p.effectivePos !== 'GK' && p !== defRoster.gk);
      const defTarget = defDeepPlayers.length > 0 ? pickRandom(defDeepPlayers) : null;
      const mode = defDeepPlayers.length > 0 ? 'long_ball_tackle' : 'long_ball_uncontested';

      const nextSession = {
        phase: 'STEP_2',
        possessionSide: attackingSide,
        attackingSide,
        ballZone: secondZone,
        displayPath: pathToStep2,
        steps: [step1Record],
        logs: [{ text: `${eventMin}' ${step1Record.summary}`, type: 'chance' }],
        recycleState: null,
        isKickoffRestart: false,
        step2Context: {
          mode,
          attackingSide,
          defendingSide,
          channel: chosenChannel.channel,
          secondZone,
          boxZone,
          isTeamLongPass: true,
          isGkLongDistribution: false,
          step2SkillBonus,
          counterTriggered,
          actor: attTarget,
          defender: defTarget,
          attDeepCount: attDeepPlayers.length,
          defDeepCount: defDeepPlayers.length,
          defaultAction: attTarget.instruction || 'pass',
          initiator: counterTriggered ? midMarker : midPasser
        },
        step3Context: null,
        lastStepSummary: `${step1Record.summary} ➔ Long jump to [${secondZone.toUpperCase()}].`,
        turnoverSide: null,
        isCompleted: false
      };
      return {
        session: nextSession,
        zoneResult: {
          minutesElapsed: 1,
          step1Side: initSide,
          attackingSide,
          nextAttacker: attackingSide,
          counterTriggered,
          startZone,
          activeZone: secondZone,
          zonePath: pathToStep2,
          steps: nextSession.steps,
          logs: nextSession.logs,
          isGoal: false,
          isShot: false,
          isOnTarget: false,
          isLongJump: true,
          homeZonePlayers: homeRoster.zonePlayers,
          awayZonePlayers: awayRoster.zonePlayers
        }
      };
    }

    if (chosenChannel.channel === 'center') {
      const hasAMCInCenter = Boolean(attRoster.effectiveAmcs && attRoster.effectiveAmcs.length > 0);
      if (!hasAMCInCenter && !isGkLongDistribution) {
        const noAmcSummary = `❌ Center pass into [${secondZone.toUpperCase()}] — NO AMC / Attacking MC stationed there! ${defTeamName} intercepts.`;
        const emptyStep = { phase: 'CENTER PASS (NO AMC — TURNOVER)', zone: secondZone, success: false, summary: noAmcSummary };
        return buildNextIdleSession({
          nextSide: defendingSide,
          visualZone: secondZone,
          displayPath: pathToStep2,
          steps: [step1Record, emptyStep],
          logs: [{ text: `${eventMin}' ${noAmcSummary}`, type: 'save' }],
          lastStepSummary: noAmcSummary,
          turnoverSide: defendingSide,
          counterTriggered
        });
      }

      const amcPool = hasAMCInCenter
        ? ((attRoster.holdingAmcs && attRoster.holdingAmcs.length > 0) ? attRoster.holdingAmcs : attRoster.effectiveAmcs)
        : attRoster.mcs;
      const nonPasserAmcs = (counterTriggered || isGkLongDistribution) ? amcPool : amcPool.filter((p) => p.name !== midPasser.name);
      const amcPlayer = isGkLongDistribution && !counterTriggered
        ? midPasser
        : (nonPasserAmcs.length > 0 ? pickRandom(nonPasserAmcs) : (amcPool[0] || midPasser));
      const oppCentralDef = (defRoster.defensiveMids?.length > 0)
        ? pickRandom(defRoster.defensiveMids)
        : (defRoster.dcs[0] || midMarker);

      const nextSession = {
        phase: 'STEP_2',
        possessionSide: attackingSide,
        attackingSide,
        ballZone: secondZone,
        displayPath: pathToStep2,
        steps: [step1Record],
        logs: [{ text: `${eventMin}' ${step1Record.summary}`, type: 'chance' }],
        recycleState: null,
        isKickoffRestart: false,
        step2Context: {
          mode: 'center_amc',
          attackingSide,
          defendingSide,
          channel: 'center',
          secondZone,
          boxZone,
          isTeamLongPass: false,
          isGkLongDistribution,
          step2SkillBonus,
          counterTriggered,
          actor: amcPlayer,
          defender: oppCentralDef,
          defaultAction: amcPlayer.instruction || 'pass',
          initiator: counterTriggered ? midMarker : (isGkLongDistribution ? initGk : midPasser)
        },
        step3Context: null,
        lastStepSummary: `${step1Record.summary} ➔ Ball moves to ${amcPlayer.name} in [${secondZone.toUpperCase()}].`,
        turnoverSide: null,
        isCompleted: false
      };
      return {
        session: nextSession,
        zoneResult: {
          minutesElapsed: 1,
          step1Side: initSide,
          attackingSide,
          nextAttacker: attackingSide,
          counterTriggered,
          startZone,
          activeZone: secondZone,
          zonePath: pathToStep2,
          steps: nextSession.steps,
          logs: nextSession.logs,
          isGoal: false,
          isShot: false,
          isOnTarget: false,
          isLongJump: isGkLongDistribution,
          homeZonePlayers: homeRoster.zonePlayers,
          awayZonePlayers: awayRoster.zonePlayers
        }
      };
    }

    // Wing Flank Step 2 setup
    const isLeftChannel = chosenChannel.channel === 'left';
    const primaryBorderFlankBox = isHomeAtt ? (isLeftChannel ? 'c1' : 'c3') : (isLeftChannel ? 'b3' : 'b1');
    const secondaryBorderFlankBox = isHomeAtt ? (isLeftChannel ? 'b1' : 'b3') : (isLeftChannel ? 'c3' : 'c1');
    const borderFlankPlayers = [
      ...(attRoster.zonePlayers[primaryBorderFlankBox] || []),
      ...(attRoster.zonePlayers[secondaryBorderFlankBox] || [])
    ];
    if (!isGkLongDistribution && attTeamTactics && borderFlankPlayers.length === 0) {
      const noWingSummary = `❌ Short pass to [${primaryBorderFlankBox.toUpperCase()}] — NO teammate in bordering flank box! ${defTeamName} intercepts.`;
      const emptyStep = { phase: 'SHORT PASS (NO BORDERING RECEIVER)', zone: primaryBorderFlankBox, success: false, summary: noWingSummary };
      return buildNextIdleSession({
        nextSide: defendingSide,
        visualZone: primaryBorderFlankBox,
        displayPath: pathToStep2,
        steps: [step1Record, emptyStep],
        logs: [{ text: `${eventMin}' ${noWingSummary}`, type: 'save' }],
        lastStepSummary: noWingSummary,
        turnoverSide: defendingSide,
        counterTriggered
      });
    }

    const pureWingPool = isLeftChannel ? attRoster.pureLeftWings : attRoster.pureRightWings;
    const attFlankFb = isLeftChannel ? attRoster.dl : attRoster.dr;
    const fbOverlaps = isLeftChannel ? attRoster.dlOverlaps : attRoster.drOverlaps;
    const winger = (isGkLongDistribution && !counterTriggered)
      ? midPasser
      : ((attTeamTactics && borderFlankPlayers.length > 0)
        ? pickRandom(borderFlankPlayers)
        : pickFlankActor(pureWingPool, attFlankFb, fbOverlaps));
    const oppFullback = isLeftChannel ? defRoster.dr : defRoster.dl;
    const rawWingInstr = winger?.instruction;
    const canWingLongShot = Boolean(winger && winger !== attFlankFb && (['AMR', 'AML', 'LW', 'RW', 'FL', 'FR'].includes(winger.effectivePos) || winger.duty === 'attack'));
    const defaultWingAction = (['high_cross', 'low_cross', 'dribble', 'through_ball', 'cut_inside'].includes(rawWingInstr) || (rawWingInstr === 'long_shot' && canWingLongShot))
      ? rawWingInstr
      : (winger?.duty === 'attack' ? 'dribble' : 'high_cross');

    const nextSession = {
      phase: 'STEP_2',
      possessionSide: attackingSide,
      attackingSide,
      ballZone: secondZone,
      displayPath: pathToStep2,
      steps: [step1Record],
      logs: [{ text: `${eventMin}' ${step1Record.summary}`, type: 'chance' }],
      recycleState: null,
      isKickoffRestart: false,
      step2Context: {
        mode: 'wing',
        attackingSide,
        defendingSide,
        channel: chosenChannel.channel,
        secondZone,
        boxZone,
        isTeamLongPass: false,
        isGkLongDistribution,
        step2SkillBonus,
        counterTriggered,
        actor: winger,
        defender: oppFullback,
        defaultAction: defaultWingAction,
        initiator: counterTriggered ? midMarker : (isGkLongDistribution ? initGk : midPasser)
      },
      step3Context: null,
      lastStepSummary: `${step1Record.summary} ➔ Ball moves to ${winger.name} in [${secondZone.toUpperCase()}].`,
      turnoverSide: null,
      isCompleted: false
    };
    return {
      session: nextSession,
      zoneResult: {
        minutesElapsed: 1,
        step1Side: initSide,
        attackingSide,
        nextAttacker: attackingSide,
        counterTriggered,
        startZone,
        activeZone: secondZone,
        zonePath: pathToStep2,
        steps: nextSession.steps,
        logs: nextSession.logs,
        isGoal: false,
        isShot: false,
        isOnTarget: false,
        isLongJump: isGkLongDistribution,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      }
    };
  }

  // ===========================================================================
  // PHASE 2: ATTACKING HALF ACTION (C1/C2/C3 or D1/D2/D3) -> STOPS AT STEP 3
  // ===========================================================================
  if (current.phase === 'STEP_2' && current.step2Context) {
    const ctx = current.step2Context;
    const isHomeAtt = ctx.attackingSide === 'home';
    const attRoster = isHomeAtt ? homeRoster : awayRoster;
    const defRoster = isHomeAtt ? awayRoster : homeRoster;
    const attTactic = isHomeAtt ? homeTactic : awayTactic;
    const defTactic = isHomeAtt ? awayTactic : homeTactic;
    const defTeamTactics = isHomeAtt ? awayTeamTactics : homeTeamTactics;
    const defTacklingMod = getTacklingMod(defTeamTactics);
    const attMentalityMod = mentalityBonusMap(attTactic);
    const defMentalityMod = mentalityBonusMap(defTactic);
    const defTeamName = isHomeAtt ? (awayTeam?.name || 'Away XI') : (homeTeam?.name || 'Home XI');
    const zonePathWithBox = [...current.displayPath, ctx.boxZone];
    const boxNum = getBoxNumericalModifiers(attRoster, defRoster, ctx.boxZone, {
      mode: 'exact',
      isHomeAtt,
      minAttCount: 1
    });

    // Special case: Uncontested Long Ball in d1/d2/d3
    if (ctx.mode === 'long_ball_uncontested') {
      const freeSummary = `🚀 ${ctx.actor.name} collects the uncontested long ball in [${ctx.secondZone.toUpperCase()}] and squares into [${ctx.boxZone.toUpperCase()}]!`;
      const step2Record = {
        phase: 'LONG BALL (UNCONTESTED)',
        zone: ctx.secondZone,
        attacker: ctx.actor.name,
        attackerPlayer: ctx.actor,
        attackerSlotId: ctx.actor.slotId || null,
        defender: 'Open Space',
        success: true,
        summary: freeSummary
      };
      const isCenterLong = ctx.channel === 'center';
      const isHighCrossLong = !isCenterLong && ctx.actor.instruction === 'high_cross';
      const finisher = isCenterLong || ['dribble', 'long_shot', 'cut_inside', 'shadow_striker'].includes(ctx.actor.instruction)
        ? ctx.actor
        : (pickRandom(attRoster.strikers) || ctx.actor);
      const boxDefMode = isHighCrossLong ? 'high_cross' : 'standard';
      const boxDef = resolveBoxDefenseHelper(defRoster, boxDefMode);
      const nextSession = {
        phase: 'STEP_3',
        possessionSide: ctx.attackingSide,
        attackingSide: ctx.attackingSide,
        ballZone: ctx.boxZone,
        displayPath: zonePathWithBox,
        steps: [...current.steps, step2Record],
        logs: [...current.logs, { text: `${eventMin}' ${freeSummary}`, type: 'chance' }],
        cards: existingCards,
        recycleState: null,
        isKickoffRestart: false,
        step2Context: null,
        step3Context: {
          attackingSide: ctx.attackingSide,
          defendingSide: ctx.defendingSide,
          boxZone: ctx.boxZone,
          finisher,
          assister: finisher.name !== ctx.actor.name ? ctx.actor : ctx.initiator,
          boxDefMode,
          boxDef,
          finSkill: isHighCrossLong ? finisher.skills.heading : finisher.skills.finishing,
          finSkillName: isHighCrossLong ? 'Heading' : 'Finishing',
          totalFinBonus: attMentalityMod + (ctx.step2SkillBonus || 0) + boxNum.attBonus + (isHighCrossLong ? (finisher.instruction === 'target_man' ? 1 : (finisher.instruction === 'poacher' ? -1 : 0)) : (finisher.instruction === 'poacher' ? 1 : 0)),
          totalDefBonus: defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus,
          is1v1Keeper: false,
          counterTriggered: ctx.counterTriggered
        },
        lastStepSummary: freeSummary,
        turnoverSide: null,
        isCompleted: false
      };
      return {
        session: nextSession,
        zoneResult: {
          minutesElapsed: 1,
          attackingSide: ctx.attackingSide,
          nextAttacker: ctx.attackingSide,
          counterTriggered: ctx.counterTriggered,
          startZone: ctx.secondZone,
          activeZone: ctx.boxZone,
          zonePath: [ctx.secondZone, ctx.boxZone],
          steps: nextSession.steps,
          logs: nextSession.logs,
          isGoal: false,
          isShot: false,
          homeZonePlayers: homeRoster.zonePlayers,
          awayZonePlayers: awayRoster.zonePlayers
        }
      };
    }

    // Special case: Contested Long Ball Tackle
    if (ctx.mode === 'long_ball_tackle') {
      const deepNum = getBoxNumericalModifiers(attRoster, defRoster, ctx.secondZone, {
        mode: ctx.secondZone.endsWith('2') ? 'exact' : 'flank',
        isHomeAtt,
        minAttCount: 1
      });
      const attBonus = deepNum.attBonus + attMentalityMod + (ctx.step2SkillBonus || 0);
      const defBonus = deepNum.defBonus + defMentalityMod + defTacklingMod;
      const forcedDiff = decision === 'success' ? 1 : (decision === 'fail' ? -1 : null);
      const duel = resolveDuelWithOverride(ctx.actor.skills.tackling + attBonus, ctx.defender.skills.tackling + defBonus, forcedDiff);
      const won = duel.diff >= 1;
      const summary = won
        ? `✅ ${ctx.actor.name} wins long-ball tackle in [${ctx.secondZone.toUpperCase()}] vs ${ctx.defender.name} (diff +${duel.diff}) ➔ feeds [${ctx.boxZone.toUpperCase()}]!`
        : `❌ ${ctx.defender.name} wins tackle in [${ctx.secondZone.toUpperCase()}] — ${defTeamName} takes possession! (diff ${duel.diff})`;
      const step2Record = {
        phase: 'LONG BALL TACKLE',
        zone: ctx.secondZone,
        attacker: ctx.actor.name,
        attackerPlayer: ctx.actor,
        attackerSlotId: ctx.actor.slotId || null,
        defender: ctx.defender.name,
        defenderPlayer: ctx.defender,
        defenderSlotId: ctx.defender.slotId || null,
        diff: duel.diff,
        requiredDiff: 1,
        success: won,
        summary
      };
      if (!won) {
        return buildNextIdleSession({
          nextSide: ctx.defendingSide,
          visualZone: ctx.secondZone,
          displayPath: [ctx.secondZone],
          steps: [...current.steps, step2Record],
          logs: [...current.logs, { text: `${eventMin}' ${summary}`, type: 'save' }],
          lastStepSummary: summary,
          turnoverSide: ctx.defendingSide,
          counterTriggered: ctx.counterTriggered
        });
      }

      const isCenterLong = ctx.channel === 'center';
      const isHighCrossLong = !isCenterLong && ctx.actor.instruction === 'high_cross';
      const finisher = isCenterLong || ['dribble', 'long_shot', 'cut_inside', 'shadow_striker'].includes(ctx.actor.instruction)
        ? ctx.actor
        : (pickRandom(attRoster.strikers) || ctx.actor);
      const boxDefMode = isHighCrossLong ? 'high_cross' : 'standard';
      const boxDef = resolveBoxDefenseHelper(defRoster, boxDefMode);
      const nextSession = {
        phase: 'STEP_3',
        possessionSide: ctx.attackingSide,
        attackingSide: ctx.attackingSide,
        ballZone: ctx.boxZone,
        displayPath: zonePathWithBox,
        steps: [...current.steps, step2Record],
        logs: [...current.logs, { text: `${eventMin}' ${summary}`, type: 'chance' }],
        recycleState: null,
        isKickoffRestart: false,
        step2Context: null,
        step3Context: {
          attackingSide: ctx.attackingSide,
          defendingSide: ctx.defendingSide,
          boxZone: ctx.boxZone,
          finisher,
          assister: finisher.name !== ctx.actor.name ? ctx.actor : ctx.initiator,
          boxDefMode,
          boxDef,
          finSkill: isHighCrossLong ? finisher.skills.heading : finisher.skills.finishing,
          finSkillName: isHighCrossLong ? 'Heading' : 'Finishing',
          totalFinBonus: attMentalityMod + (ctx.step2SkillBonus || 0) + boxNum.attBonus + (isHighCrossLong ? (finisher.instruction === 'target_man' ? 1 : (finisher.instruction === 'poacher' ? -1 : 0)) : (finisher.instruction === 'poacher' ? 1 : 0)),
          totalDefBonus: defMentalityMod + boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus,
          is1v1Keeper: false,
          counterTriggered: ctx.counterTriggered
        },
        lastStepSummary: summary,
        turnoverSide: null,
        isCompleted: false
      };
      return {
        session: nextSession,
        zoneResult: {
          minutesElapsed: 1,
          attackingSide: ctx.attackingSide,
          nextAttacker: ctx.attackingSide,
          counterTriggered: ctx.counterTriggered,
          startZone: ctx.secondZone,
          activeZone: ctx.boxZone,
          zonePath: [ctx.secondZone, ctx.boxZone],
          steps: nextSession.steps,
          logs: nextSession.logs,
          isGoal: false,
          isShot: false,
          homeZonePlayers: homeRoster.zonePlayers,
          awayZonePlayers: awayRoster.zonePlayers
        }
      };
    }

    // Normal Center AMC or Wing Action
    const activeAction = forceActorInstruction !== 'auto'
      ? forceActorInstruction
      : ctx.defaultAction;
    const s2Num = getBoxNumericalModifiers(attRoster, defRoster, ctx.secondZone, {
      mode: ctx.mode === 'center_amc' ? 'exact' : 'flank',
      isHomeAtt,
      minAttCount: 1
    });

    // Long Shot finishes immediately in Step 2 (diff >= 5)
    if (activeAction === 'long_shot') {
      const boxDef = resolveBoxDefenseHelper(defRoster, 'standard');
      const attBonus = s2Num.attBonus + (attTactic === 'attack' ? 2 : (attTactic === 'defense' ? -2 : 0)) + (ctx.step2SkillBonus || 0);
      const forcedDiff = decision === 'goal' ? 5 : (decision === 'save' ? 0 : null);
      const duel = resolveDuelWithOverride(ctx.actor.skills.longShots + attBonus, boxDef.combinedSkill + defMentalityMod + s2Num.defBonus, forcedDiff);
      const isGoal = duel.diff >= 5;
      const summary = isGoal
        ? `⚽ SCREAMER GOAL! ${ctx.actor.name} scores from distance in [${ctx.secondZone.toUpperCase()}]! (diff +${duel.diff} >= 5)`
        : `🧤 ${boxDef.gk?.name || 'GK'} saves ${ctx.actor.name}'s long shot from [${ctx.secondZone.toUpperCase()}] — ${defTeamName} takes possession! (diff ${duel.diff} < 5)`;
      const stepRecord = {
        phase: 'LONG DISTANCE SHOT',
        zone: isGoal ? ctx.boxZone : ctx.secondZone,
        attacker: ctx.actor.name,
        attackerPlayer: ctx.actor,
        attackerSlotId: ctx.actor.slotId || null,
        defender: `${boxDef.dc?.name || 'DC'} + ${boxDef.gk?.name || 'GK'}`,
        defenderPlayer: boxDef.dc || null,
        diff: duel.diff,
        requiredDiff: 5,
        success: isGoal,
        summary
      };
      return buildNextIdleSession({
        nextSide: ctx.defendingSide,
        kickoff: isGoal,
        visualZone: isGoal ? ctx.boxZone : ctx.secondZone,
        displayPath: isGoal ? [ctx.secondZone, ctx.boxZone] : [ctx.secondZone],
        steps: [...current.steps, stepRecord],
        logs: [...current.logs, { text: `${eventMin}' ${summary}`, type: isGoal ? 'goal' : 'save' }],
        lastStepSummary: summary,
        turnoverSide: ctx.defendingSide,
        isGoal,
        isShot: true,
        counterTriggered: ctx.counterTriggered
      });
    }

    // Center AMC or Wing Dribble / Cut Inside / Shadow Striker / Through Ball / Pass / High Cross / Low Cross -> goes to Step 3 or Turnover!
    let requiredDiff = 2;
    let skillName = 'Passing';
    let attSkill = ctx.actor.skills.passing;
    let defSkill = ctx.defender.skills.marking;
    let attBonus = s2Num.attBonus + attMentalityMod + (ctx.step2SkillBonus || 0);
    let defBonus = s2Num.defBonus + defMentalityMod + defTacklingMod;
    let boxDefMode = 'standard';
    let nextStep3Bonus = 0;
    let is1v1Keeper = false;
    let isSelfFinisher = false;

    if (ctx.mode === 'center_amc') {
      const dmcManMark = ctx.defender?.instruction === 'man_mark' ? 1 : 0;
      if (activeAction === 'dribble' || activeAction === 'shadow_striker') {
        skillName = 'Dribbling';
        attSkill = ctx.actor.skills.dribbling;
        defSkill = ctx.defender.skills.tackling;
        is1v1Keeper = activeAction === 'dribble';
        isSelfFinisher = true;
      } else {
        defBonus += dmcManMark;
        if (activeAction === 'through_ball') {
          requiredDiff = 4;
          nextStep3Bonus = 3;
        }
      }
    } else {
      const oppFbTight = ctx.defender?.instruction === 'tight_mark_winger' ? 1 : (ctx.defender?.instruction === 'aggressive_press' ? -1 : 0);
      const oppFbTack = ctx.defender?.instruction === 'aggressive_press' ? 1 : (ctx.defender?.instruction === 'tight_mark_winger' ? -1 : 0);
      if (activeAction === 'dribble' || activeAction === 'cut_inside') {
        skillName = 'Dribbling';
        attSkill = ctx.actor.skills.dribbling;
        defSkill = ctx.defender.skills.tackling;
        defBonus += oppFbTack;
        is1v1Keeper = activeAction === 'dribble';
        isSelfFinisher = true;
      } else if (activeAction === 'through_ball') {
        requiredDiff = 4;
        nextStep3Bonus = 3;
        defBonus += oppFbTight;
        boxDefMode = 'low_cross';
      } else {
        skillName = 'Crossing';
        attSkill = ctx.actor.skills.crossing;
        defBonus += oppFbTight;
        boxDefMode = activeAction === 'low_cross' ? 'low_cross' : 'high_cross';
      }
    }

    const forcedDiff = decision === 'success' ? requiredDiff : (decision === 'fail' ? 0 : null);
    const duel = resolveDuelWithOverride(attSkill + attBonus, defSkill + defBonus, forcedDiff);
    const won = duel.diff >= requiredDiff;
    const actionLabel = String(activeAction || 'pass').toUpperCase().replace('_', ' ');
    const s2Disc = evaluateSandboxDiscipline({
      defSide: ctx.defendingSide,
      defPlayer: ctx.defender,
      defDie: duel.defDie,
      defTeamTactics,
      isBoxZone: false,
      attRoster,
      defRoster
    });
    const baseS2Summary = won
      ? `✅ ${ctx.actor.name} succeeds ${actionLabel} in [${ctx.secondZone.toUpperCase()}] vs ${ctx.defender.name} (diff +${duel.diff} >= ${requiredDiff}) ➔ Ball moves into [${ctx.boxZone.toUpperCase()}]!`
      : `❌ ${ctx.defender.name} stops ${ctx.actor.name}'s ${actionLabel} in [${ctx.secondZone.toUpperCase()}] — ${defTeamName} takes possession! (diff ${duel.diff} < ${requiredDiff})`;
    const summary = s2Disc.note ? `${baseS2Summary} | ${s2Disc.note}` : baseS2Summary;

    const step2Record = {
      phase: `${ctx.mode === 'center_amc' ? 'AMC' : 'WING'} ${actionLabel}`,
      zone: ctx.secondZone,
      attacker: ctx.actor.name,
      attackerPlayer: ctx.actor,
      attackerSlotId: ctx.actor.slotId || null,
      defender: ctx.defender.name,
      defenderPlayer: ctx.defender,
      defenderSlotId: ctx.defender.slotId || null,
      attackerSkillName: skillName,
      attackerDie: duel.attDie,
      defenderDie: duel.defDie,
      diff: duel.diff,
      requiredDiff,
      success: won,
      summary
    };

    if (!won) {
      return buildNextIdleSession({
        nextSide: ctx.defendingSide,
        visualZone: ctx.secondZone,
        displayPath: [ctx.secondZone],
        steps: [...current.steps, step2Record],
        logs: [...current.logs, { text: `${eventMin}' ${summary}`, type: 'save' }],
        lastStepSummary: summary,
        turnoverSide: ctx.defendingSide,
        counterTriggered: ctx.counterTriggered,
        nextCards: s2Disc.nextCards
      });
    }

    const finisher = isSelfFinisher ? ctx.actor : (pickRandom(attRoster.strikers) || ctx.actor);
    const boxDef = resolveBoxDefenseHelper(defRoster, is1v1Keeper ? 'standard' : boxDefMode);
    let finSkill = finisher.skills.finishing;
    let finSkillName = 'Finishing';
    let instrBonus = 0;

    if (!isSelfFinisher) {
      if (boxDefMode === 'high_cross') {
        finSkill = finisher.skills.heading;
        finSkillName = 'Heading';
        instrBonus = finisher.instruction === 'target_man' ? 1 : (finisher.instruction === 'poacher' ? -1 : 0);
      } else {
        instrBonus = finisher.instruction === 'poacher' ? 1 : (boxDefMode === 'low_cross' && finisher.instruction === 'target_man' ? -1 : 0);
      }
    }

    const nextSession = {
      phase: 'STEP_3',
      possessionSide: ctx.attackingSide,
      attackingSide: ctx.attackingSide,
      ballZone: ctx.boxZone,
      displayPath: zonePathWithBox,
      steps: [...current.steps, step2Record],
      logs: [...current.logs, { text: `${eventMin}' ${summary}`, type: 'chance' }],
      cards: s2Disc.nextCards,
      recycleState: null,
      isKickoffRestart: false,
      step2Context: null,
      step3Context: {
        attackingSide: ctx.attackingSide,
        defendingSide: ctx.defendingSide,
        boxZone: ctx.boxZone,
        finisher,
        assister: finisher.name !== ctx.actor.name ? ctx.actor : ctx.initiator,
        boxDefMode,
        boxDef,
        finSkill,
        finSkillName,
        totalFinBonus: attMentalityMod + (ctx.step2SkillBonus || 0) + nextStep3Bonus + instrBonus + (is1v1Keeper ? 0 : boxNum.attBonus),
        totalDefBonus: defMentalityMod + (is1v1Keeper ? 0 : boxDef.dcInstrBonus + defTacklingMod + boxNum.defBonus),
        is1v1Keeper,
        counterTriggered: ctx.counterTriggered
      },
      lastStepSummary: summary,
      turnoverSide: null,
      isCompleted: false
    };
    return {
      session: nextSession,
      zoneResult: {
        minutesElapsed: 1,
        attackingSide: ctx.attackingSide,
        nextAttacker: ctx.attackingSide,
        counterTriggered: ctx.counterTriggered,
        startZone: ctx.secondZone,
        activeZone: ctx.boxZone,
        zonePath: [ctx.secondZone, ctx.boxZone],
        steps: nextSession.steps,
        logs: nextSession.logs,
        cards: s2Disc.nextCards,
        isGoal: false,
        isShot: false,
        homeZonePlayers: homeRoster.zonePlayers,
        awayZonePlayers: awayRoster.zonePlayers
      }
    };
  }

  // ===========================================================================
  // PHASE 3: PENALTY BOX FINISH (D2 / A2) -> GOAL OR SAVE (OR HARD-FOUL PENALTY!)
  // ===========================================================================
  if (current.phase === 'STEP_3' && current.step3Context) {
    const ctx = current.step3Context;
    const isHomeAtt = ctx.attackingSide === 'home';
    const attRoster = isHomeAtt ? homeRoster : awayRoster;
    const defRoster = isHomeAtt ? awayRoster : homeRoster;
    const defTeamTactics = isHomeAtt ? awayTeamTactics : homeTeamTactics;
    const defTeamName = isHomeAtt ? (awayTeam?.name || 'Away XI') : (homeTeam?.name || 'Home XI');
    const defSkill = ctx.is1v1Keeper ? (ctx.boxDef.gk?.skills?.handling || 6) : ctx.boxDef.combinedSkill;
    const defLabel = ctx.is1v1Keeper ? (ctx.boxDef.gk?.name || 'GK') : `${ctx.boxDef.dc?.name || 'DC'} + ${ctx.boxDef.gk?.name || 'GK'}`;

    const forcedDiff = decision === 'goal' ? 3 : (decision === 'save' ? 0 : null);
    const duel = resolveDuelWithOverride(ctx.finSkill + ctx.totalFinBonus, defSkill + ctx.totalDefBonus, forcedDiff);
    const rawIsGoal = duel.diff >= 3;
    const s3Disc = evaluateSandboxDiscipline({
      defSide: ctx.defendingSide,
      defPlayer: ctx.boxDef.dc,
      defDie: duel.defDie,
      defTeamTactics,
      isBoxZone: !rawIsGoal,
      boxZone: ctx.boxZone,
      attRoster,
      defRoster
    });

    const isGoal = rawIsGoal || Boolean(s3Disc.penaltyResult?.isGoal);
    const baseS3Summary = rawIsGoal
      ? `⚽ GOAL! ${ctx.finisher.name} scores in [${ctx.boxZone.toUpperCase()}]! (${ctx.finSkillName} d10:${duel.attDie}+${ctx.finSkill}${fmtBonus(ctx.totalFinBonus)}=${duel.attTotal} vs ${defLabel} ${duel.defTotal}, diff +${duel.diff} >= 3)`
      : `🧤 SAVE! ${defLabel} denies ${ctx.finisher.name} in [${ctx.boxZone.toUpperCase()}] — ${defTeamName} restarts from the back! (diff ${duel.diff} < 3)`;
    const summary = s3Disc.note ? `${baseS3Summary} | ${s3Disc.note}` : baseS3Summary;

    const step3Record = {
      phase: ctx.is1v1Keeper ? '1v1 vs KEEPER' : (ctx.boxDefMode === 'high_cross' ? 'BOX HEADER' : 'BOX FINISH'),
      zone: ctx.boxZone,
      attacker: ctx.finisher.name,
      attackerPlayer: ctx.finisher,
      attackerSlotId: ctx.finisher.slotId || null,
      defender: defLabel,
      defenderPlayer: ctx.boxDef.dc || null,
      defenderSlotId: ctx.boxDef.dc?.slotId || null,
      attackerDie: duel.attDie,
      defenderDie: duel.defDie,
      diff: duel.diff,
      requiredDiff: 3,
      success: isGoal,
      summary
    };

    const nextSteps = s3Disc.penaltyResult
      ? [...current.steps, step3Record, s3Disc.penaltyResult.step]
      : [...current.steps, step3Record];

    return buildNextIdleSession({
      nextSide: ctx.defendingSide,
      kickoff: isGoal,
      visualZone: ctx.boxZone,
      displayPath: [ctx.boxZone],
      steps: nextSteps,
      logs: [...current.logs, { text: `${eventMin}' ${summary}`, type: isGoal ? 'goal' : 'save' }],
      lastStepSummary: summary,
      turnoverSide: ctx.defendingSide,
      isGoal,
      isShot: true,
      counterTriggered: ctx.counterTriggered,
      nextCards: s3Disc.nextCards
    });
  }

  return { session: current, zoneResult: null };
}
