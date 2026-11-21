/**
 * matchEngine.js
 *
 * Pluggable Football Match Simulation Engine.
 * 
 * Supports:
 * 1. 'd10' (1-10 Granular Scale):
 *    - Midfield contest: 1d10 + Midfield Stat
 *    - Attack vs Defense contest: 1d10 + Attack/Defense Stat
 *    - Shooting before goal (Final shot vs GK save): 1d6 vs 1d6 + GK save mod (-1/0/+1)
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
 * Returns goalkeeper save roll modifier based on active GK rating (1-10 scale):
 *  - Rating 9-10: +2 to save rolls (+1 in classic_d6)
 *  - Rating 7-8:  +1 to save rolls
 *  - Rating 5-6:   0 modifier
 *  - Rating 1-4 (or missing/out-of-position GK when lineup is active): -1 to save rolls
 */
export function getGoalkeeperSaveModifier(gkPlayer, hasActiveLineup = true, modeOverride = null) {
  if (!hasActiveLineup) return 0;
  if (!gkPlayer) return -1;

  const positions = Array.isArray(gkPlayer.positions) && gkPlayer.positions.length > 0
    ? gkPlayer.positions
    : [gkPlayer.position];
  const isNaturalGK = positions.some(p => String(p || '').trim().toUpperCase() === 'GK');
  if (!isNaturalGK) return -1;

  const d10 = isD10Engine(modeOverride);
  let rating = Number(gkPlayer.rating);
  if (isNaN(rating) || rating <= 0) rating = 6;
  if (!d10 && rating <= 5 && !gkPlayer.currentAbility) {
    rating *= 2;
  }

  if (rating >= 9) return d10 ? 2 : 1;
  if (rating >= 7) return 1;
  if (rating <= 4) return -1;
  return 0;
}

/**
 * Resolves a shooting chance on goal before goal (final finish vs GK save).
 * Applies optional modifier (e.g. GK save modifier -1 / 0 / +1).
 */
export function rollShotOnGoal(modifier = 0) {
  const rawRoll = rollDie(6);
  const numericMod = Number(modifier) || 0;
  return {
    roll: rawRoll,
    modifier: numericMod,
    total: rawRoll + numericMod,
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
 * Resolves whether a duel roll triggers a foul and what disciplinary action the referee takes.
 * - Normalizes foul rate to ~10% on natural 1 (gated on d6 so classic d6 matches d10 discipline).
 * - Referee rolls 1d10: 1 (with 1d18/1d14 confirmation) = direct red; <= yellowMax (2 normal, 3 pressing/strict, 4 both) = yellow.
 * - Tapers direct red probability once a team already has a red card or the match already has 2+ reds.
 */
export function resolveFoulCheck({
  rawRoll,
  sides = 10,
  isPressing = false,
  refereeStrictness = 'normal',
  teamRedCards = 0,
  matchRedCards = 0
} = {}) {
  if (rawRoll !== 1) {
    return { foul: false, outcome: 'none', refRoll: null, confirmRoll: null };
  }

  // Normalize classic d6 (16.7%) to match d10 (10%) duel foul trigger rate
  if (sides < 10 && Math.random() > 6 / 10) {
    return { foul: false, outcome: 'none', refRoll: null, confirmRoll: null };
  }

  const refRoll = rollDie(10);
  const isStrict = refereeStrictness === 'strict';
  let yellowMax = 2;
  if (isPressing && isStrict) {
    yellowMax = 4;
  } else if (isPressing || isStrict) {
    yellowMax = 3;
  }

  const allowDirectRed = teamRedCards === 0 && matchRedCards < 2;
  if (refRoll === 1) {
    const confirmSides = (isPressing && isStrict) ? 14 : 18;
    const confirmRoll = rollDie(confirmSides);
    if (allowDirectRed && confirmRoll === 1) {
      return { foul: true, outcome: 'red', refRoll, confirmRoll, sides };
    }
    return { foul: true, outcome: 'yellow', refRoll, confirmRoll, sides };
  }

  if (refRoll <= yellowMax) {
    return { foul: true, outcome: 'yellow', refRoll, confirmRoll: null, sides };
  }

  return { foul: true, outcome: 'warning', refRoll, confirmRoll: null, sides };
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
