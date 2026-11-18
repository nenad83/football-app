/**
 * matchEngine.js
 *
 * Pluggable Football Match Simulation Engine.
 * 
 * Supports:
 * 1. 'd10' (1-10 Granular Scale):
 *    - Midfield contest: 1d10 + Midfield Stat
 *    - Attack vs Defense contest: 1d10 + Attack/Defense Stat
 *    - Shooting before goal (Final shot vs GK save): 1d6 vs 1d6 (no modifier)
 *    - Penalty shootout: 1d10 + Attack vs target threshold (14)
 *    - Stat progress bars scale to 10 max.
 *
 * 2. 'classic_d6' (Legacy 1-5 Scale):
 *    - Midfield contest: 1d6 + Midfield Stat
 *    - Attack vs Defense contest: 1d6 + Attack/Defense Stat
 *    - Shooting before goal: 1d6 vs 1d6 (no modifier)
 *    - Penalty shootout: 1d6 + Attack vs target (7)
 *    - Stat progress bars scale to 5 max.
 */

export const ENGINE_MODE_D10 = 'd10';
export const ENGINE_MODE_CLASSIC_D6 = 'classic_d6';

const STORAGE_KEY = 'football_match_engine_mode';

/**
 * Retrieves the currently active engine mode ('d10' or 'classic_d6').
 * Defaults to 'd10'.
 */
export function getEngineMode() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === ENGINE_MODE_CLASSIC_D6 || saved === ENGINE_MODE_D10) {
        return saved;
      }
    }
  } catch (e) {
    // LocalStorage unavailable
  }
  return ENGINE_MODE_D10;
}

/**
 * Updates the active engine mode.
 */
export function setEngineMode(mode) {
  const targetMode = mode === ENGINE_MODE_CLASSIC_D6 ? ENGINE_MODE_CLASSIC_D6 : ENGINE_MODE_D10;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, targetMode);
    }
  } catch (e) {
    // LocalStorage unavailable
  }
  return targetMode;
}

/**
 * Checks whether the d10 engine is currently active.
 */
export function isD10Engine(modeOverride = null) {
  const mode = modeOverride || getEngineMode();
  return mode === ENGINE_MODE_D10;
}

/**
 * Roll a die with N sides (1 to N).
 */
export function rollDie(sides = 6) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Resolves a midfield contest roll.
 * In 'd10' mode: rolls 1d10 + midfieldStat.
 * In 'classic_d6' mode: rolls 1d6 + midfieldStat.
 */
export function rollMidfield(stat = 3, modeOverride = null) {
  const d10 = isD10Engine(modeOverride);
  const sides = d10 ? 10 : 6;
  const rawRoll = rollDie(sides);
  const numericStat = Number(stat) || 0;
  return {
    roll: rawRoll,
    stat: numericStat,
    total: rawRoll + numericStat,
    sides
  };
}

/**
 * Resolves an attack vs defense duel roll.
 * In 'd10' mode: rolls 1d10 + stat.
 * In 'classic_d6' mode: rolls 1d6 + stat.
 */
export function rollAttackDef(stat = 3, modeOverride = null) {
  const d10 = isD10Engine(modeOverride);
  const sides = d10 ? 10 : 6;
  const rawRoll = rollDie(sides);
  const numericStat = Number(stat) || 0;
  return {
    roll: rawRoll,
    stat: numericStat,
    total: rawRoll + numericStat,
    sides
  };
}

/**
 * Resolves a shooting chance on goal before goal (final finish vs GK save).
 * Pure unassisted 1d6 roll without modifiers.
 */
export function rollShotOnGoal() {
  const rawRoll = rollDie(6);
  return {
    roll: rawRoll,
    sides: 6
  };
}

/**
 * Resolves a penalty shootout attempt.
 */
export function rollPenalty(attackStat = 3, modeOverride = null) {
  const d10 = isD10Engine(modeOverride);
  const sides = d10 ? 10 : 6;
  const rawRoll = rollDie(sides);
  const numericStat = Number(attackStat) || 0;
  const total = rawRoll + numericStat;
  const targetThreshold = d10 ? 14 : 7;
  return {
    roll: rawRoll,
    stat: numericStat,
    total,
    isGoal: total > targetThreshold,
    targetThreshold,
    sides
  };
}

/**
 * Unified Match Simulation Helper (for background AI vs AI matches and tournaments).
 * Auto-detects 1-10 vs 1-5 stats and produces balanced historical scorelines.
 */
export function simulateFixture(h, a, modeOverride = null) {
  if (!h || !a) return { homeGoals: 0, awayGoals: 0 };

  const mode = modeOverride || getEngineMode();
  const is10 = mode === ENGINE_MODE_D10 || (
    (h.midfield && h.midfield > 5) ||
    (a.midfield && a.midfield > 5) ||
    (h.attack && h.attack > 5) ||
    (a.attack && a.attack > 5)
  );

  const hMid = Number(h.midfield) || 3;
  const aMid = Number(a.midfield) || 3;
  const hAtt = Number(h.attack) || 3;
  const aAtt = Number(a.attack) || 3;
  const hDef = Number(h.defense) || 3;
  const aDef = Number(a.defense) || 3;

  const midDiff = hMid - aMid;
  const midCoeff = is10 ? 0.2 : 0.4;
  const homeChancesExp = Math.max(1, Math.min(6, 3.8 + midDiff * midCoeff));
  const randomShift = (Math.random() - 0.5) * 2;
  const homeChances = Math.round(homeChancesExp + randomShift);
  const awayChances = 7 - homeChances;

  const convCoeff = is10 ? 0.025 : 0.05;
  const homeConv = Math.max(0.1, Math.min(0.65, 0.3 + (hAtt - aDef) * convCoeff));
  const awayConv = Math.max(0.1, Math.min(0.65, 0.3 + (aAtt - hDef) * convCoeff));

  let homeGoals = 0;
  for (let i = 0; i < homeChances; i++) {
    if (Math.random() < homeConv) homeGoals++;
  }
  let awayGoals = 0;
  for (let i = 0; i < awayChances; i++) {
    if (Math.random() < awayConv) awayGoals++;
  }

  if (Math.random() < 0.12) homeGoals++;
  if (Math.random() < 0.12) awayGoals++;

  return { homeGoals, awayGoals };
}

/**
 * Returns human-readable engine metadata for UI displays.
 */
export function getEngineMetadata(modeOverride = null) {
  const d10 = isD10Engine(modeOverride);
  if (d10) {
    return {
      mode: ENGINE_MODE_D10,
      label: 'd10 Engine',
      badge: 'd10 / d6',
      sidesDuels: 10,
      sidesShooting: 6,
      statScale: '1-10',
      description: '1-10 Ratings | d10 Duels | d6 Finishing'
    };
  }
  return {
    mode: ENGINE_MODE_CLASSIC_D6,
    label: 'Classic d6 Engine',
    badge: 'd6 / d6',
    sidesDuels: 6,
    sidesShooting: 6,
    statScale: '1-5',
    description: '1-5 Ratings | d6 Duels | d6 Finishing'
  };
}
