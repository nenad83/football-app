/**
 * tacticalRoleEngine.js
 *
 * Core Tactical Role, Department Calculation, and AI Opponent Decision Engine.
 *
 * Rules Implemented:
 * 1. Player Tactical Roles (Duties):
 *    - DR / DL:
 *      • Full Back ('normal'): Full skill to Defense.
 *      • Wing Back ('support_mid'): -4 skill to Defense, Full skill to Midfield.
 *    - DC:
 *      • Defender ('normal'): Full skill to Defense.
 *      • Support Midfield ('support_mid'): -4 skill to Defense, Full skill to Midfield.
 *    - DMC:
 *      • Midfield ('normal'): Full skill to Midfield.
 *      • Support Defense ('support_def'): -2 skill to Midfield, Full skill to Defense.
 *    - MC:
 *      • Midfield ('normal'): Full skill to Midfield.
 *      • Support Defense ('support_def'): -4 skill to Midfield (-2 if natural DMC), Full skill to Defense.
 *      • Support Attack ('support_att'): -4 skill to Midfield, Full skill to Attack.
 *    - MR / ML:
 *      • Midfield ('normal'): Full skill to Midfield.
 *      • Support Attack ('support_att'): -4 skill to Midfield, Full skill to Attack.
 *      • Support Defense ('support_def'): -4 skill to Midfield, Full skill to Defense.
 *    - AMC:
 *      • Midfield ('normal'): Full skill to Midfield.
 *      • Support Attack ('support_att'): -2 skill to Midfield (if natural AMC in AMC slot; -4 otherwise), Full skill to Attack.
 *    - AMR / AML:
 *      • Midfield ('normal'): Full skill to Midfield.
 *      • Support Attack ('support_att'): -4 skill to Midfield, Full skill to Attack.
 *    - ST / CF / FC / SC / LW / RW:
 *      • Attack ('normal'): Full skill to Attack.
 *      • Support Midfield ('support_mid'): -2 skill to Attack, Full skill to Midfield.
 *
 * 2. Department Rating Calculation:
 *    - Defense = Math.floor(totalDefenseContribution / 4) (always divided by 4)
 *    - Midfield = Math.floor(totalMidfieldContribution / 4) (always divided by 4)
 *    - Attack = Math.floor(totalAttackContribution / 2) (always divided by 2)
 *
 * 3. Mentality:
 *    - Defensive ('defense'): +1 skill to all defenders and all players supporting defense;
 *                             -1 skill to all attackers and all players supporting attack.
 *    - Attacking ('attack'):  +1 skill to all attackers and all players supporting attack;
 *                             -1 skill to all defenders and all players supporting defense.
 *    - Normal ('balanced'):   No bonuses (0).
 */

import {
  getFormationSlots,
  getIdealSlotPosition,
  getPositionPenalty
} from '../components/FormationTactics';

/**
 * Normalizes any legacy mentality string ('ultra_defense', 'ultra_attack') into the 3 core mentalities.
 */
export function normalizeMentality(mentality) {
  if (mentality === 'defense' || mentality === 'ultra_defense') return 'defense';
  if (mentality === 'attack' || mentality === 'ultra_attack') return 'attack';
  return 'balanced';
}

/**
 * Returns the available tactical roles for a given formation slot and assigned player.
 * Accepts either a slot object ({ id, role, x, y, idealPos }) or a position string (e.g. 'DR', 'MC', 'ST').
 */
export function getAvailableRolesForSlot(slot, player = null) {
  if (!slot) {
    return [{ id: 'normal', label: 'Normal', shortLabel: 'NORM', color: '#aaa', desc: 'Standard role' }];
  }

  let slotRole = typeof slot === 'object' ? slot.role : null;
  let idealPos = '';

  if (typeof slot === 'string') {
    idealPos = slot.toUpperCase();
    if (idealPos === 'GK') slotRole = 'gk';
    else if (['DL', 'DC', 'DR', 'DF'].includes(idealPos)) slotRole = 'def';
    else if (['DMC', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'MF'].includes(idealPos)) slotRole = 'mid';
    else slotRole = 'att';
  } else {
    idealPos = slot.idealPos || getIdealSlotPosition(slot.role, slot.x, slot.y);
  }

  if (slotRole === 'gk' || idealPos === 'GK') {
    return [{ id: 'normal', label: 'Goalkeeper', shortLabel: 'GK', color: '#ffd700', desc: 'Goalkeeper' }];
  }

  const rawPlayerPos = Array.isArray(player)
    ? player[0]
    : (player?.position || (Array.isArray(player?.positions) ? player.positions[0] : '') || idealPos || '');
  const playerPos = String(rawPlayerPos).toUpperCase();
  const playerPositions = (
    Array.isArray(player?.positions)
      ? player.positions
      : (player?.position ? [player.position] : (typeof player === 'string' ? [player] : []))
  ).map(p => String(p).toUpperCase());
  if (playerPos && !playerPositions.includes(playerPos)) {
    playerPositions.push(playerPos);
  }

  const isDMCPlayer = idealPos === 'DMC' || playerPositions.includes('DMC') || playerPos === 'DMC';
  const isEligibleAMC = idealPos === 'AMC' && (player ? (playerPositions.includes('AMC') || playerPos === 'AMC') : true);

  if (slotRole === 'def') {
    if (idealPos === 'DL' || idealPos === 'DR') {
      return [
        {
          id: 'normal',
          label: 'Full Back (Defend)',
          shortLabel: 'FB (DEF)',
          color: '#00e5ff',
          desc: 'Full rating in Defense'
        },
        {
          id: 'support_mid',
          label: 'Wing Back (+Midfield)',
          shortLabel: 'WB (+MID)',
          color: '#00ff64',
          desc: '-4 in Defense, Full rating in Midfield'
        }
      ];
    }
    // DC
    return [
      {
        id: 'normal',
        label: 'Defender (Defend)',
        shortLabel: 'DEF',
        color: '#00e5ff',
        desc: 'Full rating in Defense'
      },
      {
        id: 'support_mid',
        label: 'Support Midfield (+MID)',
        shortLabel: 'SUP (+MID)',
        color: '#00ff64',
        desc: '-4 in Defense, Full rating in Midfield'
      }
    ];
  }

  if (slotRole === 'mid') {
    if (idealPos === 'DMC') {
      return [
        {
          id: 'normal',
          label: 'Defensive Mid (Midfield)',
          shortLabel: 'MID',
          color: '#00ff64',
          desc: 'Full rating in Midfield'
        },
        {
          id: 'support_def',
          label: 'Support Defense (+DEF)',
          shortLabel: 'DEF (-2M)',
          color: '#00e5ff',
          desc: '-2 in Midfield, Full rating in Defense'
        }
      ];
    }

    if (idealPos === 'AMC') {
      const attPenaltyLabel = isEligibleAMC ? '-2M' : '-4M';
      const attPenaltyDesc = isEligibleAMC
        ? '-2 in Midfield (AMC), Full rating in Attack'
        : '-4 in Midfield, Full rating in Attack';

      return [
        {
          id: 'normal',
          label: 'Attacking Mid (Midfield)',
          shortLabel: 'MID',
          color: '#00ff64',
          desc: 'Full rating in Midfield'
        },
        {
          id: 'support_att',
          label: 'Support Attack (+ATT)',
          shortLabel: `ATT (${attPenaltyLabel})`,
          color: '#ff4500',
          desc: attPenaltyDesc
        }
      ];
    }

    if (idealPos === 'AML' || idealPos === 'AMR') {
      return [
        {
          id: 'normal',
          label: 'Attacking Mid (Midfield)',
          shortLabel: 'MID',
          color: '#00ff64',
          desc: 'Full rating in Midfield'
        },
        {
          id: 'support_att',
          label: 'Support Attack (+ATT)',
          shortLabel: 'ATT (-4M)',
          color: '#ff4500',
          desc: '-4 in Midfield, Full rating in Attack'
        }
      ];
    }

    if (idealPos === 'ML' || idealPos === 'MR') {
      return [
        {
          id: 'normal',
          label: 'Wide Mid (Midfield)',
          shortLabel: 'MID',
          color: '#00ff64',
          desc: 'Full rating in Midfield'
        },
        {
          id: 'support_att',
          label: 'Support Attack (+ATT)',
          shortLabel: 'ATT (-4M)',
          color: '#ff4500',
          desc: '-4 in Midfield, Full rating in Attack'
        },
        {
          id: 'support_def',
          label: 'Support Defense (+DEF)',
          shortLabel: 'DEF (-4M)',
          color: '#00e5ff',
          desc: '-4 in Midfield, Full rating in Defense'
        }
      ];
    }

    // MC
    const defPenaltyLabel = isDMCPlayer ? '-2M' : '-4M';
    const defPenaltyDesc = isDMCPlayer
      ? '-2 in Midfield (DMC), Full rating in Defense'
      : '-4 in Midfield, Full rating in Defense';

    return [
      {
        id: 'normal',
        label: 'Central Mid (Midfield)',
        shortLabel: 'MID',
        color: '#00ff64',
        desc: 'Full rating in Midfield'
      },
      {
        id: 'support_def',
        label: 'Support Defense (+DEF)',
        shortLabel: `DEF (${defPenaltyLabel})`,
        color: '#00e5ff',
        desc: defPenaltyDesc
      },
      {
        id: 'support_att',
        label: 'Support Attack (+ATT)',
        shortLabel: 'ATT (-4M)',
        color: '#ff4500',
        desc: '-4 in Midfield, Full rating in Attack'
      }
    ];
  }

  if (slotRole === 'att') {
    return [
      {
        id: 'normal',
        label: 'Forward (Attack)',
        shortLabel: 'ATT',
        color: '#ff4500',
        desc: 'Full rating in Attack'
      },
      {
        id: 'support_mid',
        label: 'Support Midfield (+MID)',
        shortLabel: 'SUP (-2A)',
        color: '#00ff64',
        desc: '-2 in Attack, Full rating in Midfield'
      }
    ];
  }

  return [{ id: 'normal', label: 'Normal', shortLabel: 'NORM', color: '#aaa', desc: 'Standard role' }];
}

/**
 * Cycles to the next valid tactical role for a given slot and player.
 */
export function getNextRoleForSlot(slot, player, currentRole = 'normal') {
  const available = getAvailableRolesForSlot(slot, player);
  if (available.length <= 1) return 'normal';
  const idx = available.findIndex(r => r.id === currentRole);
  if (idx === -1) return available[0].id;
  return available[(idx + 1) % available.length].id;
}

/**
 * Returns metadata for a player's current tactical role in a slot.
 */
export function getRoleMetadata(slot, player, roleId = 'normal') {
  const available = getAvailableRolesForSlot(slot, player);
  return available.find(r => r.id === roleId) || available[0];
}

/**
 * Computes effective base skill of a player in a slot (accounting for condition < 80% and out-of-position penalty).
 */
export function getPlayerEffectiveSkill(player, slot) {
  if (!player) return 0;
  let r = Number(player.rating) || 3;
  let reduction = 0;

  const idealPos = slot.idealPos || getIdealSlotPosition(slot.role, slot.x, slot.y);
  const penalty = getPositionPenalty(player.positions || [player.position], idealPos);
  reduction += penalty;

  return Math.max(1, r - reduction);
}

/**
 * Calculates a single player's contribution to Defense, Midfield, and Attack
 * given their slot, effective skill, assigned role, and team mentality.
 */
export function calculatePlayerContribution(player, slot, roleId = 'normal', mentality = 'balanced') {
  if (!player || !slot || slot.role === 'gk') {
    return { def: 0, mid: 0, att: 0, effectiveSkill: player ? (player.rating || 3) : 0 };
  }

  const normMentality = normalizeMentality(mentality);
  const defMentalityBonus = normMentality === 'defense' ? 1 : (normMentality === 'attack' ? -1 : 0);
  const attMentalityBonus = normMentality === 'attack' ? 1 : (normMentality === 'defense' ? -1 : 0);

  const idealPos = slot.idealPos || getIdealSlotPosition(slot.role, slot.x, slot.y);
  const playerPos = (player.position || idealPos || '').toUpperCase();
  const playerPositions = (
    Array.isArray(player?.positions)
      ? player.positions
      : (player?.position ? [player.position] : [])
  ).map(p => String(p).toUpperCase());
  if (playerPos && !playerPositions.includes(playerPos)) {
    playerPositions.push(playerPos);
  }

  const isDMC = idealPos === 'DMC' || playerPositions.includes('DMC') || playerPos === 'DMC';
  const isEligibleAMC = idealPos === 'AMC' && (playerPositions.includes('AMC') || playerPos === 'AMC');

  const validRole = getRoleMetadata(slot, player, roleId).id;
  const eff = getPlayerEffectiveSkill(player, slot);

  let def = 0;
  let mid = 0;
  let att = 0;

  if (slot.role === 'def') {
    if (validRole === 'support_mid') {
      // Wing Back (DR/DL) or Ball-Playing DC supporting midfield: -4 in defense, full in midfield
      def = Math.max(0, (eff - 4) + defMentalityBonus);
      mid = eff;
    } else {
      // Full Back / Defender: full in defense
      def = Math.max(0, eff + defMentalityBonus);
    }
  } else if (slot.role === 'mid') {
    if (validRole === 'support_def') {
      // Supporting defense: DMC loses only 2 in midfield; MC/MR/ML loses 4 in midfield. Full to defense + mentality bonus.
      const midLoss = isDMC ? 2 : 4;
      mid = Math.max(0, eff - midLoss);
      def = Math.max(0, eff + defMentalityBonus);
    } else if (validRole === 'support_att') {
      // Supporting attack: Specialist AMC in AMC slot loses only 2 in midfield; others lose 4. Full to attack + mentality bonus.
      const midLoss = isEligibleAMC ? 2 : 4;
      mid = Math.max(0, eff - midLoss);
      att = Math.max(0, eff + attMentalityBonus);
    } else {
      // Normal midfield
      mid = eff;
    }
  } else if (slot.role === 'att') {
    if (validRole === 'support_mid') {
      // Supporting midfield: -2 in attack, full to midfield
      att = Math.max(0, (eff - 2) + attMentalityBonus);
      mid = eff;
    } else {
      // Normal forward
      att = Math.max(0, eff + attMentalityBonus);
    }
  }

  return { def, mid, att, effectiveSkill: eff, validRole };
}

/**
 * Calculates full team Defense, Midfield, and Attack ratings from the starting lineup,
 * formation, player roles map, and mentality.
 *
 * Division rules:
 * - Defense: Math.floor(defSum / 4)
 * - Midfield: Math.floor(midSum / 4)
 * - Attack: Math.floor(attSum / 2)
 */
export function calculateTeamTacticalStats(lineup, formationKey = '4-4-2', playerRoles = {}, mentality = 'balanced') {
  if (!lineup || Object.keys(lineup).length === 0) {
    return {
      defense: 6,
      midfield: 6,
      attack: 6,
      defSum: 24,
      midSum: 24,
      attSum: 12,
      rawTotalSkill: 60
    };
  }

  const rawSlots = getFormationSlots(formationKey);
  const slots = rawSlots.map(s => ({
    ...s,
    idealPos: getIdealSlotPosition(s.role, s.x, s.y)
  }));

  let defSum = 0;
  let midSum = 0;
  let attSum = 0;
  let rawTotalSkill = 0;

  slots.forEach(slot => {
    if (slot.role === 'gk') return;
    const player = lineup[slot.id];
    if (!player) return;

    const roleId = (playerRoles && playerRoles[slot.id]) || player.tacticalRole || 'normal';
    const contrib = calculatePlayerContribution(player, slot, roleId, mentality);

    defSum += contrib.def;
    midSum += contrib.mid;
    attSum += contrib.att;
    rawTotalSkill += contrib.effectiveSkill;
  });

  const defense = Math.max(1, Math.floor(defSum / 4));
  const midfield = Math.max(1, Math.floor(midSum / 4));
  const attack = Math.max(1, Math.floor(attSum / 2));

  return {
    defense,
    midfield,
    attack,
    defSum,
    midSum,
    attSum,
    rawTotalSkill
  };
}

/**
 * Summarizes active non-default tactical roles for UI display and commentary logs.
 */
export function summarizeActiveRoles(lineup, formationKey = '4-4-2', playerRoles = {}) {
  if (!lineup) return [];
  const rawSlots = getFormationSlots(formationKey);
  const summary = [];

  rawSlots.forEach(s => {
    if (s.role === 'gk') return;
    const player = lineup[s.id];
    if (!player) return;
    const idealPos = getIdealSlotPosition(s.role, s.x, s.y);
    const slot = { ...s, idealPos };
    const roleId = (playerRoles && playerRoles[s.id]) || 'normal';
    const meta = getRoleMetadata(slot, player, roleId);
    if (meta.id !== 'normal') {
      const lastName = player.name ? player.name.trim().split(/\s+/).pop() : idealPos;
      summary.push({
        slotId: s.id,
        playerName: player.name,
        lastName,
        position: player.position || idealPos,
        idealPos,
        roleId: meta.id,
        shortLabel: meta.shortLabel,
        label: meta.label,
        color: meta.color
      });
    }
  });

  return summary;
}

/**
 * Intelligent CPU Tactical & Player-Role Planner.
 *
 * Evaluates:
 * - Relative team strength (raw skill sum & department ratings)
 * - Match situation (scoreline, aggregate score in 2-legged ties, match minute, home/away)
 * - Available specialists in the CPU's starting XI (DMCs, MCs, WBs, AMCs, Wingers, Strikers)
 * - Division thresholds (dividing by 4, 4, 2) to make smart, logical role assignments
 */
export function computeCPUTacticalPlan({
  lineup,
  formationKey = '4-4-2',
  selfTeam,
  oppTeam,
  oppLineup = null,
  oppFormation = '4-4-2',
  scoreSelf = 0,
  scoreOpp = 0,
  isLeg2 = false,
  leg1HomeScore = 0,
  leg1AwayScore = 0,
  currentMatchTime = 0,
  isHomeSide = false,
  currentMentality = 'balanced',
  currentRoles = {}
}) {
  // 1. Evaluate Baseline Strength of Self vs Opponent
  const baseSelf = calculateTeamTacticalStats(lineup, formationKey, {}, 'balanced');
  let baseOppSkill = 30;
  let baseOppDeptSum = 9;

  if (oppLineup && Object.keys(oppLineup).length >= 8) {
    const baseOpp = calculateTeamTacticalStats(oppLineup, oppFormation, {}, 'balanced');
    baseOppSkill = baseOpp.rawTotalSkill;
    baseOppDeptSum = baseOpp.attack + baseOpp.midfield + baseOpp.defense;
  } else if (oppTeam) {
    baseOppDeptSum = (oppTeam.attack || 3) + (oppTeam.midfield || 3) + (oppTeam.defense || 3);
    baseOppSkill = baseOppDeptSum * 3.3;
  }

  const selfDeptSum = (lineup && Object.keys(lineup).length >= 8)
    ? (baseSelf.attack + baseSelf.midfield + baseSelf.defense)
    : ((selfTeam?.attack || 3) + (selfTeam?.midfield || 3) + (selfTeam?.defense || 3));

  const selfSkill = (lineup && Object.keys(lineup).length >= 8)
    ? baseSelf.rawTotalSkill
    : selfDeptSum * 3.3;

  // Combine raw player skill difference and department difference
  const homeBonus = isHomeSide ? 1.5 : -1.0;
  const skillDiff = (selfSkill - baseOppSkill) + homeBonus;
  const deptDiff = selfDeptSum - baseOppDeptSum;

  // Classify strength tier:
  // -2: Much Weaker | -1: Slightly Weaker | 0: Equal | +1: Slightly Stronger | +2: Much Stronger
  let tier = 0;
  if (skillDiff <= -6.5 || deptDiff <= -3) {
    tier = -2;
  } else if (skillDiff <= -2.5 || deptDiff <= -1) {
    tier = -1;
  } else if (skillDiff >= 6.5 || deptDiff >= 3) {
    tier = 2;
  } else if (skillDiff >= 2.5 || deptDiff >= 1) {
    tier = 1;
  }

  // 2. Evaluate Match Scoreline / Aggregate State
  const goalDiff = scoreSelf - scoreOpp;
  let leg1Diff = 0;
  if (isLeg2) {
    leg1Diff = isHomeSide ? (leg1AwayScore - leg1HomeScore) : (leg1HomeScore - leg1AwayScore);
  }
  const effectiveGoalDiff = isLeg2 ? (goalDiff + leg1Diff) : goalDiff;

  // 3. Determine Strategic Posture ('park_bus', 'defensive', 'cautious_def', 'balanced', 'cautious_att', 'attacking', 'all_out_attack')
  let posture = 'balanced';

  if (currentMatchTime === 0) {
    // Pre-match kickoff gameplan based on relative strength
    if (tier === -2) posture = 'defensive';
    else if (tier === -1) posture = isHomeSide ? 'cautious_def' : 'defensive';
    else if (tier === 0) posture = isHomeSide ? 'cautious_att' : 'balanced';
    else if (tier === 1) posture = isHomeSide ? 'attacking' : 'cautious_att';
    else if (tier === 2) posture = 'attacking';
  } else {
    // Live In-Match Dynamic Adjustments
    if (effectiveGoalDiff < 0) {
      // CPU IS TRAILING
      const behindBy = Math.abs(effectiveGoalDiff);
      if (currentMatchTime >= 75) {
        // Desperate late push for goals
        posture = tier <= -2 && behindBy === 1 ? 'attacking' : 'all_out_attack';
      } else if (currentMatchTime >= 55) {
        posture = tier <= -2 ? 'cautious_att' : 'attacking';
      } else if (behindBy >= 2) {
        // Down by 2+ goals in first half
        posture = tier <= -2 ? 'balanced' : 'attacking';
      } else {
        // Down by 1 goal early
        if (tier <= -2) posture = 'cautious_def'; // Underdog stays compact early so they don't collapse
        else if (tier === -1) posture = 'balanced';
        else posture = 'attacking';
      }
    } else if (effectiveGoalDiff > 0) {
      // CPU IS LEADING
      if (currentMatchTime >= 75) {
        // Closing out the match late
        if (effectiveGoalDiff === 1) {
          posture = tier >= 2 ? 'cautious_def' : 'park_bus';
        } else {
          posture = 'defensive';
        }
      } else if (currentMatchTime >= 50) {
        if (effectiveGoalDiff === 1) {
          posture = tier <= 0 ? 'defensive' : 'cautious_def';
        } else {
          posture = tier <= -1 ? 'defensive' : 'balanced';
        }
      } else {
        // Leading in first half
        if (tier <= -1) posture = 'defensive';
        else if (tier === 0) posture = 'cautious_def';
        else if (tier === 1) posture = 'balanced';
        else posture = 'cautious_att';
      }
    } else {
      // MATCH IS TIED (0-0, 1-1, etc.)
      if (currentMatchTime >= 70) {
        if (tier >= 1) {
          // Stronger team pushing late for a winner
          posture = tier === 2 ? 'all_out_attack' : 'attacking';
        } else if (tier <= -1) {
          // Weaker team holding on for a valuable draw late
          posture = tier === -2 ? 'park_bus' : 'defensive';
        } else {
          posture = isHomeSide ? 'cautious_att' : 'cautious_def';
        }
      } else {
        // Tied in normal flow
        if (tier === -2) posture = 'defensive';
        else if (tier === -1) posture = 'cautious_def';
        else if (tier === 0) posture = isHomeSide ? 'cautious_att' : 'balanced';
        else if (tier === 1) posture = isHomeSide ? 'attacking' : 'cautious_att';
        else posture = 'attacking';
      }
    }
  }

  // 4. Map Strategic Posture to Mentality ('defense' | 'balanced' | 'attack')
  let targetMentality = 'balanced';
  if (posture === 'park_bus' || posture === 'defensive') {
    targetMentality = 'defense';
  } else if (posture === 'attacking' || posture === 'all_out_attack') {
    targetMentality = 'attack';
  } else {
    targetMentality = 'balanced';
  }

  // 5. Assign Intelligent Player Roles for Outfield Slots
  const roles = {};
  if (!lineup || Object.keys(lineup).length === 0) {
    return { mentality: targetMentality, roles, posture, tier };
  }

  const rawSlots = getFormationSlots(formationKey);
  const slots = rawSlots.map(s => ({
    ...s,
    idealPos: getIdealSlotPosition(s.role, s.x, s.y),
    player: lineup[s.id],
    eff: getPlayerEffectiveSkill(lineup[s.id], s)
  })).filter(s => s.role !== 'gk' && s.player);

  // Initialize all slots to 'normal'
  slots.forEach(s => { roles[s.id] = 'normal'; });

  // Group slots by tactical type
  const fullBacks = slots.filter(s => s.role === 'def' && (s.idealPos === 'DL' || s.idealPos === 'DR'))
    .sort((a, b) => b.eff - a.eff);
  const centerBacks = slots.filter(s => s.role === 'def' && s.idealPos === 'DC')
    .sort((a, b) => b.eff - a.eff);

  const dmcs = slots.filter(s => s.role === 'mid' && (s.idealPos === 'DMC' || (s.player.position || '').toUpperCase() === 'DMC'))
    .sort((a, b) => b.eff - a.eff);
  const mcs = slots.filter(s => s.role === 'mid' && s.idealPos === 'MC' && (s.player.position || '').toUpperCase() !== 'DMC')
    .sort((a, b) => b.eff - a.eff);
  const wideMids = slots.filter(s => s.role === 'mid' && (s.idealPos === 'ML' || s.idealPos === 'MR'))
    .sort((a, b) => b.eff - a.eff);
  const attMids = slots.filter(s => s.role === 'mid' && (s.idealPos === 'AMC' || s.idealPos === 'AML' || s.idealPos === 'AMR'))
    .sort((a, b) => {
      // Prioritize natural AMC in AMC slot because they only lose -1 to midfield
      const aPositions = (a.player?.positions || [a.player?.position || '']).map(p => String(p).toUpperCase());
      const bPositions = (b.player?.positions || [b.player?.position || '']).map(p => String(p).toUpperCase());
      const aIsEligibleAMC = a.idealPos === 'AMC' && aPositions.includes('AMC');
      const bIsEligibleAMC = b.idealPos === 'AMC' && bPositions.includes('AMC');
      if (aIsEligibleAMC && !bIsEligibleAMC) return -1;
      if (!aIsEligibleAMC && bIsEligibleAMC) return 1;
      return b.eff - a.eff;
    });

  const forwards = slots.filter(s => s.role === 'att')
    .sort((a, b) => a.eff - b.eff); // Weakest/secondary striker first for dropping deep into midfield

  // Apply role combinations according to posture:
  if (posture === 'park_bus') {
    // Ultra-solid block: pull up to 2 DMCs/MCs + 1 wide mid into defense, and drop 1 forward to support midfield
    const defCandidates = [...dmcs, ...mcs, ...wideMids];
    defCandidates.slice(0, 2).forEach(s => { roles[s.id] = 'support_def'; });
    if (forwards.length >= 2) {
      roles[forwards[0].id] = 'support_mid';
    }
  } else if (posture === 'defensive') {
    // Weaker team / defending lead: Defensive mentality + pull 1-2 midfielders (DMC/MC) to support defense
    const defCandidates = [...dmcs, ...mcs];
    const numToPull = (tier <= -2 || currentMatchTime >= 70) ? Math.min(2, defCandidates.length) : 1;
    defCandidates.slice(0, numToPull).forEach(s => { roles[s.id] = 'support_def'; });

    // If playing with 2+ strikers and midfield needs help, drop 1 striker to support midfield
    if (forwards.length >= 2) {
      const curStats = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      if (curStats.midfield < baseSelf.midfield || curStats.attSum % 2 === 1) {
        roles[forwards[0].id] = 'support_mid';
      }
    }
  } else if (posture === 'cautious_def') {
    // Slightly weaker team / away caution: Normal mentality, pull 1 DMC or MC to support defense
    const defCandidates = [...dmcs, ...mcs];
    if (defCandidates.length > 0) {
      roles[defCandidates[0].id] = 'support_def';
    }
    // If 2 forwards and dropping 1 keeps attack or boosts midfield threshold, drop 1 forward to support midfield
    if (forwards.length >= 2) {
      const curStats = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      if ((curStats.midSum % 4) >= 2 && (curStats.attSum % 2) === 1) {
        roles[forwards[0].id] = 'support_mid';
      }
    }
  } else if (posture === 'balanced') {
    // Evenly matched: smart threshold optimization!
    // 1. If we have a natural DMC (only -2 to mid) and Defense can gain a point without losing Midfield, use DMC on support_def
    if (dmcs.length > 0) {
      const testRoles = { ...roles, [dmcs[0].id]: 'support_def' };
      const before = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
      if (after.defense > before.defense && after.midfield >= before.midfield) {
        roles[dmcs[0].id] = 'support_def';
      }
    }
    // 2. If we have an AMC and Attack can gain a point while keeping Midfield strong
    if (attMids.length > 0) {
      const testRoles = { ...roles, [attMids[0].id]: 'support_att' };
      const before = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
      if (after.attack > before.attack && after.midfield >= before.midfield) {
        roles[attMids[0].id] = 'support_att';
      }
    }
  } else if (posture === 'cautious_att') {
    // Slightly stronger / home initiative: Normal mentality, push 1-2 attacking mids/wingers to attack, and 1 Wing Back to midfield
    const attCandidates = [...attMids, ...wideMids, ...mcs];
    if (attCandidates.length > 0) {
      roles[attCandidates[0].id] = 'support_att';
    }
    // Push best full-back to Wing Back to replenish midfield
    if (fullBacks.length > 0) {
      const testRoles = { ...roles, [fullBacks[0].id]: 'support_mid' };
      const before = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
      if (after.midfield > before.midfield || (before.defSum % 4) >= 2) {
        roles[fullBacks[0].id] = 'support_mid';
      }
    }
  } else if (posture === 'attacking') {
    // Stronger team / chasing a goal: Attacking mentality, push 1-2 AMCs/wingers to attack, and 1-2 Wing Backs to midfield
    const attCandidates = [...attMids, ...wideMids, ...mcs];
    const numAtt = attCandidates.length >= 2 ? 2 : 1;
    attCandidates.slice(0, numAtt).forEach(s => { roles[s.id] = 'support_att'; });

    if (fullBacks.length > 0) {
      roles[fullBacks[0].id] = 'support_mid';
      if (fullBacks.length > 1 && tier >= 2) {
        roles[fullBacks[1].id] = 'support_mid';
      }
    } else if (centerBacks.length >= 3) {
      // 3-back formation (e.g. 3-5-2 / 3-4-3): 1 DC steps into midfield
      roles[centerBacks[0].id] = 'support_mid';
    }
  } else if (posture === 'all_out_attack') {
    // Desperate late comeback / heavy pressure: Attacking mentality, Wing Backs + 1 DC in midfield, 2-3 midfielders in attack
    const attCandidates = [...attMids, ...wideMids, ...mcs];
    attCandidates.slice(0, 3).forEach(s => { roles[s.id] = 'support_att'; });

    fullBacks.forEach(s => { roles[s.id] = 'support_mid'; });
    if (centerBacks.length >= 2) {
      roles[centerBacks[0].id] = 'support_mid';
    }
  }

  return {
    mentality: targetMentality,
    roles,
    posture,
    tier
  };
}
