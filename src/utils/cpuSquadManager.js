import { getPrebuiltRoster } from '../data/rosters/rosterRegistry.js';
import {
  getFormationSlots,
  getIdealSlotPosition
} from '../components/FormationTactics.js';
import {
  calculateTeamTacticalStats,
  computeCPUTacticalPlan
} from './tacticalRoleEngine.js';

/**
 * Strict Positional Compatibility Map
 * Defines natural, secondary, and emergency positions for every pitch slot.
 * Ensures AI managers never place a DR at DC, a DC at DMC, or a striker in goal.
 */
export const POSITION_COMPATIBILITY = {
  GK: {
    natural: ['GK'],
    secondary: [],
    emergency: []
  },
  DR: {
    natural: ['DR', 'RWB'],
    secondary: ['DL', 'MR'],
    emergency: ['DC']
  },
  DL: {
    natural: ['DL', 'LWB'],
    secondary: ['DR', 'ML'],
    emergency: ['DC']
  },
  DC: {
    natural: ['DC', 'SW'],
    secondary: ['DMC'],
    emergency: ['DR', 'DL']
  },
  DMC: {
    natural: ['DMC', 'DM'],
    secondary: ['MC', 'DC'],
    emergency: ['AMC', 'MR', 'ML']
  },
  MC: {
    natural: ['MC', 'CM'],
    secondary: ['DMC', 'AMC'],
    emergency: ['MR', 'ML']
  },
  MR: {
    natural: ['MR', 'AMR', 'RW'],
    secondary: ['MC', 'DR'],
    emergency: ['ML', 'AML']
  },
  ML: {
    natural: ['ML', 'AML', 'LW'],
    secondary: ['MC', 'DL'],
    emergency: ['MR', 'AMR']
  },
  AMR: {
    natural: ['AMR', 'MR', 'RW'],
    secondary: ['AMC', 'ST', 'CF'],
    emergency: ['AML', 'LW']
  },
  AML: {
    natural: ['AML', 'ML', 'LW'],
    secondary: ['AMC', 'ST', 'CF'],
    emergency: ['AMR', 'RW']
  },
  AMC: {
    natural: ['AMC', 'CAM', 'AM'],
    secondary: ['MC', 'ST', 'CF', 'AML', 'AMR'],
    emergency: ['DMC']
  },
  RW: {
    natural: ['RW', 'AMR', 'MR'],
    secondary: ['ST', 'CF'],
    emergency: ['LW', 'AML']
  },
  LW: {
    natural: ['LW', 'AML', 'ML'],
    secondary: ['ST', 'CF'],
    emergency: ['RW', 'AMR']
  },
  ST: {
    natural: ['ST', 'CF', 'FW'],
    secondary: ['AMC', 'AML', 'AMR', 'LW', 'RW'],
    emergency: ['MC']
  },
  CF: {
    natural: ['CF', 'ST', 'FW'],
    secondary: ['AMC', 'AML', 'AMR', 'LW', 'RW'],
    emergency: ['MC']
  }
};

/**
 * Checks if a player has any natural position for an ideal slot.
 */
function hasNaturalPosition(player, idealPos) {
  const comp = POSITION_COMPATIBILITY[idealPos];
  const natural = comp ? comp.natural : [idealPos];
  const positions = player.positions || [player.position];
  return positions.some(p => natural.includes(p));
}

/**
 * Checks if a player has secondary eligibility for an ideal slot.
 */
function hasSecondaryPosition(player, idealPos) {
  const comp = POSITION_COMPATIBILITY[idealPos];
  const secondary = comp ? comp.secondary : [];
  const positions = player.positions || [player.position];
  return positions.some(p => secondary.includes(p));
}

/**
 * Retrieve or load CPU team squad from localStorage or static on-demand JSON.
 * @param {string} teamName - Club name
 * @param {string|number} season - Year or season string
 * @returns {Promise<Array|null>} Array of players or null
 */
export async function getOrLoadCPUSquad(teamName, season) {
  if (!teamName || !season) return null;
  const rosterKey = `retro_roster_${teamName}_${season}`;

  try {
    const cached = localStorage.getItem(rosterKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 11) {
        const isStale1To5 = !parsed.some(p => Number(p.rating) > 5) && !parsed.some(p => p.wage !== undefined);
        if (!isStale1To5) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn(`[cpuSquadManager] Failed to read ${rosterKey} from localStorage:`, err);
  }

  // Load from prebuilt rosters
  try {
    const prebuilt = await getPrebuiltRoster(teamName, season);
    if (prebuilt && prebuilt.length >= 11) {
      const initialized = prebuilt.map(p => ({
        ...p,
        condition: p.condition !== undefined ? p.condition : 100,
        injuryMatchesLeft: p.injuryMatchesLeft !== undefined ? p.injuryMatchesLeft : 0,
        injury: p.injury !== undefined ? p.injury : null
      }));
      try {
        localStorage.setItem(rosterKey, JSON.stringify(initialized));
      } catch (e) {
        // LocalStorage may be full; still return squad in memory
      }
      return initialized;
    }
  } catch (err) {
    console.warn(`[cpuSquadManager] Could not load prebuilt squad for ${teamName} (${season}):`, err);
  }

  return null;
}

/**
 * Generates an authentic starting 11 for an AI opponent.
 * Enforces strict positional matching, player fatigue & injury checks,
 * and realistic managerial squad rotation (cup matches / congested fixtures).
 *
 * @param {Array} squad - 22-man roster
 * @param {string} formationKey - '4-4-2', '4-3-3', etc.
 * @param {Object} options - { isCup: boolean, allowRotation: boolean }
 * @returns {Object} { lineup, bench, starters }
 */
export function generateCPULineup(squad, formationKey = '4-4-2', options = {}) {
  if (!Array.isArray(squad) || squad.length === 0) {
    return { lineup: {}, bench: [], starters: [] };
  }

  const { isCup = false, allowRotation = true } = options;
  const rawSlots = getFormationSlots(formationKey);
  const slots = rawSlots.map(s => ({
    ...s,
    idealPos: getIdealSlotPosition(s.role, s.x, s.y)
  }));

  const usedNames = new Set();
  const lineup = {};

  // Slot priority order: assign rare/specialist positions first so flexible
  // players are not accidentally consumed by general central positions.
  const priority = {
    GK: 1,
    DR: 2,
    DL: 2,
    MR: 3,
    ML: 3,
    AMR: 3,
    AML: 3,
    RW: 3,
    LW: 3,
    DMC: 4,
    AMC: 4,
    DC: 5,
    MC: 6,
    ST: 7,
    CF: 7
  };

  const sortedSlots = [...slots].sort((a, b) => {
    const pA = priority[a.idealPos] || 10;
    const pB = priority[b.idealPos] || 10;
    return pA - pB;
  });

  // Assign each formation slot
  for (const slot of sortedSlots) {
    const ideal = slot.idealPos;

    // 1. Natural candidates (healthy & fit)
    let candidates = squad.filter(
      p => !usedNames.has(p.name) &&
        !(p.injuryMatchesLeft > 0) &&
        hasNaturalPosition(p, ideal)
    );

    // Calculate effective rating considering fatigue
    const getEffectiveScore = (p) => {
      let score = p.rating || 3;
      const cond = p.condition !== undefined ? p.condition : 100;
      if (cond < 75) score -= 1.6;
      else if (cond < 85) score -= 0.8;
      return score;
    };

    candidates.sort((a, b) => getEffectiveScore(b) - getEffectiveScore(a));

    let chosen = null;

    if (candidates.length > 0) {
      chosen = candidates[0];

      // Squad rotation logic: if allowRotation and team has close quality backup
      if (allowRotation && candidates.length > 1) {
        const top = candidates[0];
        const second = candidates[1];
        const ratingDiff = (top.rating || 3) - (second.rating || 3);
        const topCond = top.condition !== undefined ? top.condition : 100;

        // If top player is slightly tired (< 90%) or it's a cup match, rotate
        let rotationProb = isCup ? 0.35 : 0.15;
        if (topCond < 88) rotationProb += 0.25;

        if (ratingDiff <= 1 && Math.random() < rotationProb) {
          chosen = second;
        }
      }
    }

    // 2. Secondary fit fallback (only if no natural player available)
    if (!chosen) {
      let secondaryCandidates = squad.filter(
        p => !usedNames.has(p.name) &&
          !(p.injuryMatchesLeft > 0) &&
          hasSecondaryPosition(p, ideal)
      );
      secondaryCandidates.sort((a, b) => getEffectiveScore(b) - getEffectiveScore(a));
      if (secondaryCandidates.length > 0) {
        chosen = secondaryCandidates[0];
      }
    }

    // 3. Emergency fallback (only if entire position is depleted by injuries)
    if (!chosen) {
      let emergencyCandidates = squad.filter(
        p => !usedNames.has(p.name) && !(p.injuryMatchesLeft > 0)
      );
      emergencyCandidates.sort((a, b) => (b.rating || 3) - (a.rating || 3));
      if (emergencyCandidates.length > 0) {
        chosen = emergencyCandidates[0];
      }
    }

    if (chosen) {
      usedNames.add(chosen.name);
      lineup[slot.id] = chosen;
    }
  }

  // Build bench list (remaining healthy players sorted by rating)
  const bench = squad
    .filter(p => !usedNames.has(p.name) && !(p.injuryMatchesLeft > 0))
    .sort((a, b) => (b.rating || 3) - (a.rating || 3))
    .slice(0, 7);

  const starters = Object.values(lineup).filter(Boolean);

  return { lineup, bench, starters };
}

/**
 * Calculates dynamic attack, midfield, and defense ratings from the 11 players on the pitch
 * using the tactical role engine (Defense ÷ 4, Midfield ÷ 4, Attack ÷ 2, floored).
 *
 * @param {Object} lineup - Map of slotId to player
 * @param {string} formationKey - '4-4-2', etc.
 * @param {Object} playerRoles - Map of slotId to tactical role ('normal', 'support_def', 'support_mid', 'support_att')
 * @param {string} mentality - 'defense' | 'balanced' | 'attack'
 * @returns {Object} { attack: number, midfield: number, defense: number, defSum, midSum, attSum }
 */
export function calculateDepartmentStats(lineup, formationKey = '4-4-2', playerRoles = {}, mentality = 'balanced') {
  if (!lineup || Object.keys(lineup).length === 0) {
    return { attack: 3, midfield: 3, defense: 3, defSum: 12, midSum: 12, attSum: 6 };
  }

  return calculateTeamTacticalStats(lineup, formationKey, playerRoles, mentality);
}

/**
 * Full Opponent Coordinator:
 * Fetches squad, generates authentic 11, computes AI tactical roles & mentality,
 * and calculates dynamic ratings.
 * If squad is missing or corrupted, gracefully falls back to hardcoded stats.
 *
 * @param {string} teamName - Club name
 * @param {Object} fallbackTeam - Hardcoded team object from league JSON
 * @param {string|number} season - Year or season string
 * @param {string} formationKey - Opponent's active formation
 * @param {boolean} isCup - Whether this is a cup game
 * @param {Object} oppTeam - Opponent team object (for relative strength comparison)
 * @param {boolean} isHomeSide - Whether this CPU team is playing at home
 * @param {Object} oppLineup - Opponent starting lineup if available
 * @param {string} oppFormation - Opponent formation
 * @returns {Promise<Object>} { stats, baseStats, lineup, bench, roles, mentality, posture, isFallback }
 */
export async function getCPUMatchLineupAndStats(
  teamName,
  fallbackTeam,
  season,
  formationKey,
  isCup = false,
  oppTeam = null,
  isHomeSide = false,
  oppLineup = null,
  oppFormation = '4-4-2'
) {
  const fallbackStats = {
    attack: fallbackTeam?.attack || 3,
    midfield: fallbackTeam?.midfield || 3,
    defense: fallbackTeam?.defense || 3
  };

  if (!teamName || !season) {
    const fallbackPlan = computeCPUTacticalPlan({
      lineup: {},
      formationKey,
      selfTeam: fallbackTeam,
      oppTeam,
      oppLineup,
      oppFormation,
      scoreSelf: 0,
      scoreOpp: 0,
      currentMatchTime: 0,
      isHomeSide
    });
    return {
      stats: fallbackStats,
      baseStats: fallbackStats,
      lineup: {},
      bench: [],
      roles: {},
      mentality: fallbackPlan.mentality,
      posture: fallbackPlan.posture,
      isFallback: true
    };
  }

  try {
    const squad = await getOrLoadCPUSquad(teamName, season);
    if (!squad || squad.length < 11) {
      const fallbackPlan = computeCPUTacticalPlan({
        lineup: {},
        formationKey,
        selfTeam: fallbackTeam,
        oppTeam,
        oppLineup,
        oppFormation,
        scoreSelf: 0,
        scoreOpp: 0,
        currentMatchTime: 0,
        isHomeSide
      });
      return {
        stats: fallbackStats,
        baseStats: fallbackStats,
        lineup: {},
        bench: [],
        roles: {},
        mentality: fallbackPlan.mentality,
        posture: fallbackPlan.posture,
        isFallback: true
      };
    }

    const { lineup, bench } = generateCPULineup(squad, formationKey, { isCup, allowRotation: true });
    const plan = computeCPUTacticalPlan({
      lineup,
      formationKey,
      selfTeam: fallbackTeam,
      oppTeam,
      oppLineup,
      oppFormation,
      scoreSelf: 0,
      scoreOpp: 0,
      currentMatchTime: 0,
      isHomeSide
    });
    const baseStats = calculateDepartmentStats(lineup, formationKey, {}, 'balanced');
    const stats = calculateDepartmentStats(lineup, formationKey, plan.roles, plan.mentality);

    // Save active CPU lineup & roles so they can be viewed and persisted
    try {
      const lineupKey = `retro_lineup_${teamName}_${season}`;
      localStorage.setItem(lineupKey, JSON.stringify(lineup));
    } catch (e) {
      // Non-fatal
    }

    return {
      stats,
      baseStats,
      lineup,
      bench,
      roles: plan.roles,
      mentality: plan.mentality,
      posture: plan.posture,
      isFallback: false
    };
  } catch (err) {
    console.warn(`[cpuSquadManager] Error generating CPU lineup for ${teamName}:`, err);
    return {
      stats: fallbackStats,
      baseStats: fallbackStats,
      lineup: {},
      bench: [],
      roles: {},
      mentality: 'balanced',
      posture: 'balanced',
      isFallback: true
    };
  }
}
