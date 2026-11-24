/**
 * tacticalRoleEngine.js
 *
 * Core Tactical Role, Department Calculation, and AI Opponent Decision Engine.
 *
 * Rules Implemented:
 * 1. Player Tactical Roles (50/50 split & 75%-retention Specialist Bonuses):
 *    - DR / DL / DC:
 *      • Full Back / Defender ('normal'): 100% skill to Defense.
 *      • Wing Back / Support Midfield ('support_mid'): 50/50 split — keeps 50% in Defense (-50%), moves 50% to Midfield.
 *    - DMC / DML / DMR (Defensive Mid Specialists):
 *      • Midfield ('normal'): 100% skill to Midfield.
 *      • Support Defense ('support_def'): Specialist bonus — keeps 75% in Midfield (-25%), adds +50% to Defense.
 *    - MC / MR / ML:
 *      • Midfield ('normal'): 100% skill to Midfield.
 *      • Support Defense ('support_def'): 50/50 split — keeps 50% in Midfield (-50%), moves 50% to Defense (or 75% if DMC/DML/DMR).
 *      • Support Attack ('support_att'): keeps 50% in Midfield (-50%), adds Attack boost (or 75% in Midfield if AMC/AML/AMR).
 *    - AMC / AML / AMR (Attacking Mid Specialists):
 *      • Midfield ('normal'): 100% skill to Midfield.
 *      • Support Attack ('support_att'): Specialist bonus — keeps 75% in Midfield (-25%), adds Attack boost.
 *    - ST / CF / FC / SC / LW / RW:
 *      • Attack ('normal'): 100% skill to Attack.
 *      • Support Midfield ('support_mid'): loses proportionate Attack (-50% zone share), adds 50% skill to Midfield.
 *
 * 2. Formation-Fair Department Rating Calculation:
 *    - Each zone divides by that formation's actual slot count in that zone (defSlots, midSlots, attSlots)
 *      so 4-3-3 / 3-5-2 / 4-5-1 / 4-4-2 start on an equal skill footing and weak teams stay below 10.
 *
 * 3. Mentality:
 *    - Defensive ('defense'): +1 team Defense, -1 team Attack.
 *    - Attacking ('attack'):  +1 team Attack, -1 team Defense.
 *    - Normal ('balanced'):   No modifiers (0).
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

  const DEF_SPECIALISTS = ['DMC', 'DML', 'DMR'];
  const ATT_SPECIALISTS = ['AMC', 'AML', 'AMR'];
  const isDefSpecialist = DEF_SPECIALISTS.includes(idealPos) || playerPositions.some(p => DEF_SPECIALISTS.includes(p));
  const isAttSpecialist = ATT_SPECIALISTS.includes(idealPos) || playerPositions.some(p => ATT_SPECIALISTS.includes(p));

  if (slotRole === 'def') {
    if (idealPos === 'DL' || idealPos === 'DR') {
      return [
        {
          id: 'normal',
          label: 'Full Back (Defend)',
          shortLabel: 'FB (DEF)',
          color: '#00e5ff',
          desc: 'Stays in defensive flank (a1/a3) to guard wingers (100% Defense)'
        },
        {
          id: 'support_mid',
          label: 'Wing Back (+Midfield)',
          shortLabel: 'WB (+MID)',
          color: '#00ff64',
          desc: 'Moves up to c1/c3 (50% Def, 50% Mid) — can Cross before goal or play Through-Balls!'
        },
        {
          id: 'support_att',
          label: 'Attacking Wing Back (+Attack)',
          shortLabel: 'WB (+ATT)',
          color: '#ff4500',
          desc: 'Overlaps all the way to d1/d3 (50% Def, +50% Att) — can Dribble & Shoot or Cross!'
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
        desc: '100% skill in Defense'
      },
      {
        id: 'support_mid',
        label: 'Support Midfield (+MID)',
        shortLabel: 'SUP (+MID)',
        color: '#00ff64',
        desc: '50/50 split: 50% Defense, 50% Midfield'
      }
    ];
  }

  if (slotRole === 'mid') {
    if (idealPos === 'DMC' || idealPos === 'DML' || idealPos === 'DMR') {
      return [
        {
          id: 'normal',
          label: 'Defensive Mid (Midfield)',
          shortLabel: 'MID',
          color: '#00ff64',
          desc: '100% skill in Midfield'
        },
        {
          id: 'support_def',
          label: 'Support Defense (+DEF)',
          shortLabel: 'DEF (75%M)',
          color: '#00e5ff',
          desc: 'Specialist: keeps 75% in Midfield, +50% to Defense'
        }
      ];
    }

    if (idealPos === 'AMC' || idealPos === 'AML' || idealPos === 'AMR') {
      const attBadge = isAttSpecialist ? '75%M' : '50/50';
      const attPenaltyDesc = isAttSpecialist
        ? 'Specialist: keeps 75% in Midfield, +50% to Attack'
        : '50/50 split: 50% Midfield, +50% to Attack';

      return [
        {
          id: 'normal',
          label: 'Attacking Mid (Midfield)',
          shortLabel: 'MID',
          color: '#00ff64',
          desc: '100% skill in Midfield'
        },
        {
          id: 'support_att',
          label: 'Support Attack (+ATT)',
          shortLabel: `ATT (${attBadge})`,
          color: '#ff4500',
          desc: attPenaltyDesc
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
          desc: '100% skill in Midfield'
        },
        {
          id: 'support_att',
          label: 'Support Attack (+ATT)',
          shortLabel: isAttSpecialist ? 'ATT (75%M)' : 'ATT (50/50)',
          color: '#ff4500',
          desc: isAttSpecialist ? 'Specialist: 75% Midfield, +50% Attack' : '50/50 split: 50% Midfield, +50% Attack'
        },
        {
          id: 'support_def',
          label: 'Support Defense (+DEF)',
          shortLabel: isDefSpecialist ? 'DEF (75%M)' : 'DEF (50/50)',
          color: '#00e5ff',
          desc: isDefSpecialist ? 'Specialist: 75% Midfield, +50% Defense' : '50/50 split: 50% Midfield, +50% Defense'
        }
      ];
    }

    // MC
    return [
      {
        id: 'normal',
        label: 'Central Mid (Midfield)',
        shortLabel: 'MID',
        color: '#00ff64',
        desc: '100% skill in Midfield'
      },
      {
        id: 'support_def',
        label: 'Support Defense (+DEF)',
        shortLabel: isDefSpecialist ? 'DEF (75%M)' : 'DEF (50/50)',
        color: '#00e5ff',
        desc: isDefSpecialist ? 'Specialist: keeps 75% in Midfield, +50% Defense' : '50/50 split: 50% Midfield, +50% Defense'
      },
      {
        id: 'support_att',
        label: 'Support Attack (+ATT)',
        shortLabel: isAttSpecialist ? 'ATT (75%M)' : 'ATT (50/50)',
        color: '#ff4500',
        desc: isAttSpecialist ? 'Specialist: keeps 75% in Midfield, +50% Attack' : '50/50 split: 50% Midfield, +50% Attack'
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
        desc: '100% skill in Attack'
      },
      {
        id: 'support_mid',
        label: 'Support Midfield (+MID)',
        shortLabel: 'SUP (+MID)',
        color: '#00ff64',
        desc: 'Drops deep: adds 50% skill to Midfield'
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
export function calculatePlayerContribution(
  player,
  slot,
  roleId = 'normal',
  mentality = 'balanced',
  zoneCounts = { def: 4, mid: 4, att: 2, rawAtt: 2 }
) {
  if (!player || !slot || slot.role === 'gk') {
    return { def: 0, mid: 0, att: 0, effectiveSkill: player ? (player.rating || 3) : 0 };
  }

  const defDiv = Math.max(4, zoneCounts?.def || 4);
  const midDiv = Math.max(3, zoneCounts?.mid || 4);
  const attDiv = Math.max(2, zoneCounts?.att || 2);
  const rawAttCount = zoneCounts?.rawAtt ?? attDiv;

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

  const isDefSpecialist = ['DMC', 'DML', 'DMR'].includes(idealPos) ||
    playerPositions.some(p => ['DMC', 'DML', 'DMR'].includes(p));
  const isAttSpecialist = ['AMC', 'AML', 'AMR'].includes(idealPos) ||
    playerPositions.some(p => ['AMC', 'AML', 'AMR'].includes(p));

  const validRole = getRoleMetadata(slot, player, roleId).id;
  const eff = getPlayerEffectiveSkill(player, slot);

  let def = 0;
  let mid = 0;
  let att = 0;

  if (slot.role === 'def') {
    if (validRole === 'support_mid') {
      // Exact 50/50 split: e.g. Finnan (9) -> 4.5 to Defense, 4.5 to Midfield
      def = eff * 0.5;
      mid = eff * 0.5 * (midDiv / defDiv);
    } else if (validRole === 'support_att') {
      // Attacking Wing Back (Giggs / Roberto Carlos / Trent style): 50% Defense, +50% Attack
      def = eff * 0.5;
      att = rawAttCount === 1
        ? eff * 0.5
        : eff * 0.5 * (attDiv / defDiv);
    } else {
      def = eff;
    }
  } else if (slot.role === 'mid') {
    if (validRole === 'support_def') {
      // DMC/DML/DMR specialists keep 75% in Midfield (-25%); MC/MR/ML keep 50% (-50%)
      mid = eff * (isDefSpecialist ? 0.75 : 0.5);
      def = eff * 0.5 * (defDiv / midDiv);
    } else if (validRole === 'support_att') {
      // AMC/AML/AMR specialists keep 75% in Midfield (-25%); MC/MR/ML keep 50% (-50%)
      // In 1-striker shapes (4-5-1, 4-2-3-1), attacker runner contributes full 50% into attSum (÷2)
      mid = eff * (isAttSpecialist ? 0.75 : 0.5);
      att = rawAttCount === 1
        ? eff * 0.5
        : eff * 0.5 * (attDiv / Math.max(3, midDiv));
    } else {
      mid = eff;
    }
  } else if (slot.role === 'att') {
    if (validRole === 'support_mid') {
      const attDropRatio = Math.min(0.6, 0.5 * (attDiv / Math.max(1, midDiv)));
      att = eff * (1 - attDropRatio);
      mid = eff * 0.5 * (midDiv / Math.max(3, midDiv));
    } else {
      att = eff;
    }
  }

  return { def, mid, att, effectiveSkill: eff, validRole };
}

/**
 * Calculates full team Defense, Midfield, and Attack ratings from the starting lineup,
 * formation, player roles map, and mentality.
 *
 * - Divides Defense by max(4, defSlots), Midfield by max(3, midSlots), Attack by max(2, attSlots)
 * - Uses 50/50 tactical role splits (and 75%-midfield retention for DMC/DML/DMR and AMC/AML/AMR specialists)
 * - Applies Mentality (+/-1 to team Defense / Attack) cleanly at department level
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
      divisors: { def: 4, mid: 4, att: 2 },
      rawTotalSkill: 60
    };
  }

  const normMentality = normalizeMentality(mentality);
  const rawSlots = getFormationSlots(formationKey);
  const slots = rawSlots.map(s => ({
    ...s,
    idealPos: getIdealSlotPosition(s.role, s.x, s.y)
  }));

  const rawDef = slots.filter(s => s.role === 'def').length;
  const rawMid = slots.filter(s => s.role === 'mid').length;
  const rawAtt = slots.filter(s => s.role === 'att').length;

  const zoneCounts = {
    def: Math.max(4, rawDef),
    mid: Math.max(3, rawMid),
    att: Math.max(2, rawAtt),
    rawAtt
  };

  let defSum = 0;
  let midSum = 0;
  let attSum = 0;
  let rawTotalSkill = 0;

  slots.forEach(slot => {
    if (slot.role === 'gk') return;
    const player = lineup[slot.id];
    if (!player) return;

    const roleId = (playerRoles && playerRoles[slot.id]) || player.tacticalRole || 'normal';
    const contrib = calculatePlayerContribution(player, slot, roleId, normMentality, zoneCounts);

    defSum += contrib.def;
    midSum += contrib.mid;
    attSum += contrib.att;
    rawTotalSkill += contrib.effectiveSkill;
  });

  const defMentMod = normMentality === 'defense' ? 1 : (normMentality === 'attack' ? -1 : 0);
  const attMentMod = normMentality === 'attack' ? 1 : (normMentality === 'defense' ? -1 : 0);

  const defense = Math.min(10, Math.max(1, Math.floor((defSum / zoneCounts.def) + 0.2) + defMentMod));
  const midfield = Math.min(10, Math.max(1, Math.floor((midSum / zoneCounts.mid) + 0.2)));
  const attack = Math.min(10, Math.max(1, Math.floor((attSum / zoneCounts.att) + 0.2) + attMentMod));

  return {
    defense,
    midfield,
    attack,
    defSum,
    midSum,
    attSum,
    divisors: { def: zoneCounts.def, mid: zoneCounts.mid, att: zoneCounts.att },
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
  oppRoles = {},
  oppMentality = 'balanced',
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
  // 1. Evaluate Baseline Strength of Self vs Opponent ( plus opponent's live tactical setup )
  const baseSelf = calculateTeamTacticalStats(lineup, formationKey, {}, 'balanced');
  let baseOppSkill = 30;
  let baseOppDeptSum = 9;
  let oppLiveStats = {
    attack: oppTeam?.attack || 6,
    midfield: oppTeam?.midfield || 6,
    defense: oppTeam?.defense || 6
  };

  if (oppLineup && Object.keys(oppLineup).filter(k => oppLineup[k]).length >= 7) {
    const baseOpp = calculateTeamTacticalStats(oppLineup, oppFormation, {}, 'balanced');
    baseOppSkill = baseOpp.rawTotalSkill;
    baseOppDeptSum = baseOpp.attack + baseOpp.midfield + baseOpp.defense;
    oppLiveStats = calculateTeamTacticalStats(oppLineup, oppFormation, oppRoles || {}, oppMentality || 'balanced');
  } else if (oppTeam) {
    baseOppDeptSum = (oppTeam.attack || 6) + (oppTeam.midfield || 6) + (oppTeam.defense || 6);
    baseOppSkill = baseOppDeptSum * 3.3;
  }

  const activeSelfPlayers = lineup ? Object.values(lineup).filter(Boolean).length : 11;
  const hasLineup = Boolean(lineup && activeSelfPlayers >= 7);

  const selfDeptSum = hasLineup
    ? (baseSelf.attack + baseSelf.midfield + baseSelf.defense)
    : ((selfTeam?.attack || 6) + (selfTeam?.midfield || 6) + (selfTeam?.defense || 6));

  const selfSkill = hasLineup
    ? baseSelf.rawTotalSkill
    : selfDeptSum * 3.3;

  // Combine raw player skill difference and department difference (realistic 1-10 scale thresholds)
  const homeBonus = isHomeSide ? 1.2 : -0.8;
  const skillDiff = (selfSkill - baseOppSkill) + homeBonus;
  const deptDiff = selfDeptSum - baseOppDeptSum;

  // Classify strength tier:
  // -2: Much Weaker | -1: Slightly Weaker | 0: Equal | +1: Slightly Stronger | +2: Very Superior
  let tier = 0;
  if (skillDiff <= -10.5 || deptDiff <= -5) {
    tier = -2;
  } else if (skillDiff <= -4.5 || deptDiff <= -2) {
    tier = -1;
  } else if (skillDiff >= 10.5 || deptDiff >= 5) {
    tier = 2;
  } else if (skillDiff >= 4.5 || deptDiff >= 2) {
    tier = 1;
  }

  // If CPU had a player sent off (10 or fewer players), downgrade effective tier so it plays compactly
  const isDownAMan = hasLineup && activeSelfPlayers < 11;
  if (isDownAMan) {
    tier = Math.max(-2, tier - 1);
  }

  // 2. Evaluate Match Scoreline / Aggregate State
  const goalDiff = scoreSelf - scoreOpp;
  let leg1Diff = 0;
  if (isLeg2) {
    leg1Diff = isHomeSide ? (leg1AwayScore - leg1HomeScore) : (leg1HomeScore - leg1AwayScore);
  }
  const effectiveGoalDiff = isLeg2 ? (goalDiff + leg1Diff) : goalDiff;
  const behindBy = effectiveGoalDiff < 0 ? Math.abs(effectiveGoalDiff) : 0;

  // Check if opponent is dominating midfield or CPU is bleeding goals
  const isOutnumberedInMidfield = oppLiveStats.midfield > baseSelf.midfield;
  const isConcedingHeavily =
    behindBy >= 3 ||
    (scoreOpp >= 3 && behindBy >= 2) ||
    (behindBy === 2 && (tier <= 0 || isDownAMan || (currentMatchTime >= 75 && tier <= 1)));

  // 3. Determine Strategic Posture
  // ('park_bus' | 'damage_control' | 'defensive' | 'cautious_def' | 'balanced' | 'cautious_att' | 'attacking' | 'all_out_attack')
  let posture = 'balanced';

  if (currentMatchTime === 0) {
    // Pre-match kickoff gameplan: only truly superior teams (tier === 2) start with 'attacking'
    if (tier === -2) posture = 'defensive';
    else if (tier === -1) posture = 'cautious_def';
    else if (tier === 0) posture = 'balanced';
    else if (tier === 1) posture = isHomeSide ? 'cautious_att' : 'balanced';
    else if (tier === 2) posture = isHomeSide ? 'attacking' : 'cautious_att';
  } else if (isConcedingHeavily) {
    // DAMAGE CONTROL: "Better to lose 3-0 than 6-0" — reinforce defense & midfield instead of opening up further
    posture = (behindBy >= 3 || tier <= -1 || isDownAMan) ? 'damage_control' : 'cautious_def';
  } else if (effectiveGoalDiff < 0) {
    // CPU IS TRAILING (by 1 goal, or by 2 goals as a stronger side that hasn't collapsed)
    if (behindBy === 1) {
      if (currentMatchTime >= 80) {
        // Final 10 minutes trailing by 1: push for equalizer (unless down a man & much weaker)
        posture = (isDownAMan || tier <= -2) ? 'cautious_att' : 'all_out_attack';
      } else if (currentMatchTime >= 72) {
        posture = tier <= -2 ? 'cautious_att' : (tier >= 1 && !isDownAMan ? 'all_out_attack' : 'attacking');
      } else if (currentMatchTime >= 52) {
        if (tier <= -2) posture = 'balanced';
        else if (tier === -1 || tier === 0) posture = 'cautious_att';
        else posture = 'attacking';
      } else {
        // First half down 0-1: stay composed, never abandon midfield or defense early
        if (tier <= -2) posture = 'cautious_def';
        else if (tier === -1 || tier === 0) posture = 'balanced';
        else if (tier === 1) posture = 'cautious_att';
        else posture = 'attacking';
      }
    } else {
      // behindBy === 2 and tier >= 1 (Stronger team down 0-2 before damage-control cutoff)
      if (currentMatchTime >= 75) {
        posture = (tier === 2 && scoreOpp <= 2 && !isDownAMan) ? 'all_out_attack' : 'cautious_def';
      } else if (currentMatchTime >= 55) {
        posture = tier === 2 ? 'attacking' : 'cautious_att';
      } else {
        posture = tier === 2 ? 'attacking' : 'balanced';
      }
    }
  } else if (effectiveGoalDiff > 0) {
    // CPU IS LEADING: manage the game, protect midfield & defense
    if (effectiveGoalDiff >= 2) {
      // Comfortably ahead by 2+ goals: control midfield and defense, never stay reckless in attack
      if (currentMatchTime >= 70) {
        posture = tier <= 0 ? 'defensive' : 'cautious_def';
      } else {
        posture = tier <= -1 ? 'defensive' : (tier === 0 ? 'cautious_def' : 'balanced');
      }
    } else {
      // Leading by 1 goal
      if (currentMatchTime >= 75) {
        posture = tier <= -1 ? 'park_bus' : (tier <= 1 ? 'defensive' : 'cautious_def');
      } else if (currentMatchTime >= 50) {
        posture = tier <= 0 ? 'defensive' : (tier === 1 ? 'cautious_def' : 'balanced');
      } else {
        if (tier <= -1) posture = 'defensive';
        else if (tier === 0) posture = 'cautious_def';
        else posture = 'balanced';
      }
    }
  } else {
    // MATCH IS TIED (0-0, 1-1, etc.)
    if (currentMatchTime >= 75) {
      if (tier === 2 && !isDownAMan) {
        // Only a very superior team pushes all-out late in a draw (after 80')
        posture = currentMatchTime >= 81 ? 'all_out_attack' : 'attacking';
      } else if (tier === 1 && !isDownAMan) {
        posture = isHomeSide ? 'attacking' : 'cautious_att';
      } else if (tier <= -1) {
        posture = tier === -2 ? 'park_bus' : 'defensive';
      } else {
        posture = 'balanced';
      }
    } else {
      if (tier === -2) posture = 'defensive';
      else if (tier === -1) posture = 'cautious_def';
      else if (tier === 0) posture = 'balanced';
      else if (tier === 1) posture = isHomeSide ? 'cautious_att' : 'balanced';
      else posture = isHomeSide ? 'attacking' : 'cautious_att';
    }
  }

  // 4. Map Strategic Posture to Mentality ('defense' | 'balanced' | 'attack')
  // Note: 'attack' mentality imposes -1 on every defender, so only use it when genuinely attacking/all-out or tier === 2
  let targetMentality = 'balanced';
  if (posture === 'park_bus' || posture === 'defensive' || posture === 'damage_control') {
    targetMentality = 'defense';
  } else if (posture === 'all_out_attack') {
    targetMentality = 'attack';
  } else if (posture === 'attacking') {
    // Only use 'attack' mentality if defense stays resilient or team is very superior / late chasing 1 goal
    targetMentality = (tier >= 2 || (behindBy === 1 && currentMatchTime >= 65)) ? 'attack' : 'balanced';
  } else {
    targetMentality = 'balanced';
  }

  // 5. Assign Intelligent Player Roles for Outfield Slots with Strict Midfield & Defense Floors
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
      const aPositions = (a.player?.positions || [a.player?.position || '']).map(p => String(p).toUpperCase());
      const bPositions = (b.player?.positions || [b.player?.position || '']).map(p => String(p).toUpperCase());
      const aIsEligibleAMC = a.idealPos === 'AMC' && aPositions.includes('AMC');
      const bIsEligibleAMC = b.idealPos === 'AMC' && bPositions.includes('AMC');
      if (aIsEligibleAMC && !bIsEligibleAMC) return -1;
      if (!aIsEligibleAMC && bIsEligibleAMC) return 1;
      return b.eff - a.eff;
    });

  const forwards = slots.filter(s => s.role === 'att')
    .sort((a, b) => a.eff - b.eff); // Secondary striker first for dropping deep into midfield

  // Helper: safely test a candidate role assignment against minimum Defense and Midfield floors
  const tryAssignRole = (slotId, candidateRole, { minDef, minMid, requireGainIn = null } = {}) => {
    const before = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
    const testRoles = { ...roles, [slotId]: candidateRole };
    const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
    if (minDef !== undefined && after.defense < minDef) return false;
    if (minMid !== undefined && after.midfield < minMid) return false;
    if (requireGainIn === 'attack' && after.attack <= before.attack) return false;
    if (requireGainIn === 'midfield' && after.midfield <= before.midfield) return false;
    if (requireGainIn === 'defense' && after.defense <= before.defense) return false;
    roles[slotId] = candidateRole;
    return true;
  };

  // Apply role combinations according to posture:
  if (posture === 'park_bus' || posture === 'damage_control') {
    // Reinforce defense and midfield to stop conceding goals
    const defCandidates = [...dmcs, ...mcs, ...wideMids];
    defCandidates.slice(0, 2).forEach(s => { roles[s.id] = 'support_def'; });
    if (forwards.length >= 2) {
      roles[forwards[0].id] = 'support_mid';
    }
  } else if (posture === 'defensive') {
    const defCandidates = [...dmcs, ...mcs];
    const numToPull = (tier <= -2 || currentMatchTime >= 70) ? Math.min(2, defCandidates.length) : 1;
    defCandidates.slice(0, numToPull).forEach(s => { roles[s.id] = 'support_def'; });

    if (forwards.length >= 2) {
      const curStats = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      if (curStats.midfield < baseSelf.midfield || curStats.midfield < oppLiveStats.midfield || curStats.attSum % 2 === 1) {
        roles[forwards[0].id] = 'support_mid';
      }
    }
  } else if (posture === 'cautious_def') {
    const defCandidates = [...dmcs, ...mcs];
    if (defCandidates.length > 0) {
      roles[defCandidates[0].id] = 'support_def';
    }
    // If 2 forwards and dropping 1 preserves Attack or boosts midfield threshold, drop 1 forward to support midfield
    if (forwards.length >= 2) {
      const curStats = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
      const fwdAttSlot = slots.find(s => s.id === forwards[0].id);
      if (fwdAttSlot) {
        const testRoles = { ...roles, [fwdAttSlot.id]: 'support_mid' };
        const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
        if (curStats.midfield < oppLiveStats.midfield || (after.midfield > curStats.midfield && after.attack >= curStats.attack)) {
          roles[forwards[0].id] = 'support_mid';
        }
      }
    }
  } else if (posture === 'balanced') {
    // Strictly preserve base Defense and Midfield while seeking threshold gains
    if (dmcs.length > 0) {
      tryAssignRole(dmcs[0].id, 'support_def', {
        minDef: baseSelf.defense,
        minMid: baseSelf.midfield,
        requireGainIn: 'defense'
      });
    }
    if (attMids.length > 0) {
      tryAssignRole(attMids[0].id, 'support_att', {
        minDef: baseSelf.defense,
        minMid: forwards.length <= 1 ? Math.max(5, baseSelf.midfield - 1) : baseSelf.midfield,
        requireGainIn: 'attack'
      });
    }
  } else if (posture === 'cautious_att') {
    // Slightly stronger / home initiative: NEVER sacrifice base Defense or Midfield if tier < 2
    const minDefFloor = tier >= 2 ? Math.max(4, baseSelf.defense - 1) : baseSelf.defense;
    const minMidFloor = baseSelf.midfield;

    // If a DMC can cover defense without dropping midfield below floor, lock that in first
    if (dmcs.length > 0) {
      tryAssignRole(dmcs[0].id, 'support_def', {
        minDef: minDefFloor,
        minMid: minMidFloor,
        requireGainIn: 'defense'
      });
    }

    // Only push 1 Wing-Back if Defense stays >= minDefFloor
    if (fullBacks.length > 0) {
      tryAssignRole(fullBacks[0].id, 'support_mid', {
        minDef: minDefFloor,
        minMid: minMidFloor
      });
    }

    // Only push 1 Attacking Midfielder if Midfield stays >= minMidFloor
    const attCandidates = [...attMids, ...wideMids, ...mcs];
    for (const cand of attCandidates.slice(0, 2)) {
      if (tryAssignRole(cand.id, 'support_att', {
        minDef: minDefFloor,
        minMid: minMidFloor,
        requireGainIn: 'attack'
      })) {
        break;
      }
    }
  } else if (posture === 'attacking') {
    // Controlled attacking: keep Defense & Midfield strong (never gut the backline)
    const minDefFloor = tier >= 2
      ? Math.max(5, baseSelf.defense - 1)
      : Math.max(4, baseSelf.defense - (behindBy === 1 && currentMatchTime >= 65 ? 1 : 0));
    const minMidFloor = tier >= 2
      ? Math.max(4, baseSelf.midfield - 1)
      : baseSelf.midfield;

    // Check if 'attack' mentality alone violated minDefFloor; if so, fall back to 'balanced' mentality
    const statsAtStart = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
    if (targetMentality === 'attack' && statsAtStart.defense < minDefFloor) {
      targetMentality = 'balanced';
    }

    if (fullBacks.length > 0) {
      tryAssignRole(fullBacks[0].id, 'support_mid', {
        minDef: minDefFloor
      });
      if (fullBacks.length > 1 && tier >= 2) {
        tryAssignRole(fullBacks[1].id, 'support_mid', {
          minDef: minDefFloor
        });
      }
    } else if (centerBacks.length >= 3) {
      tryAssignRole(centerBacks[0].id, 'support_mid', {
        minDef: minDefFloor
      });
    }

    const attCandidates = [...attMids, ...wideMids, ...mcs];
    const maxSupportAtt = tier >= 2 ? 2 : 1;
    let assignedAtt = 0;
    for (const cand of attCandidates) {
      if (assignedAtt >= maxSupportAtt) break;
      if (tryAssignRole(cand.id, 'support_att', {
        minDef: minDefFloor,
        minMid: minMidFloor
      })) {
        assignedAtt++;
      }
    }
  } else if (posture === 'all_out_attack') {
    // Final-minutes desperate push (only reached >= 75' in a close 1-goal game or tier === 2 late draw)
    // Still keep Center-Backs at home in a 4-back formation and keep a safe Defense floor (>= 4)
    const minDefFloor = Math.max(4, baseSelf.defense - 2);
    const minMidFloor = Math.max(4, baseSelf.midfield - 1);

    for (const fb of fullBacks) {
      tryAssignRole(fb.id, 'support_mid', { minDef: minDefFloor });
    }
    if (centerBacks.length >= 3) {
      tryAssignRole(centerBacks[0].id, 'support_mid', { minDef: minDefFloor });
    }

    const attCandidates = [...attMids, ...wideMids, ...mcs];
    let assignedAtt = 0;
    for (const cand of attCandidates) {
      if (assignedAtt >= 2) break;
      if (tryAssignRole(cand.id, 'support_att', {
        minDef: minDefFloor,
        minMid: minMidFloor
      })) {
        assignedAtt++;
      }
    }
  }

  // 6. Situational Midfield & Defensive Adaptation:
  // - Similar-strength teams (tier 0 or 1): actively push to match/dominate midfield (target oppMid + 1),
  //   willing to drop surplus attackers (keeping >= 1 striker & Attack >= 7) or step 1 WB up while Defense >= 7.
  // - Weaker teams (tier <= -1): keep defensive block intact while adding midfield support so they don't get overrun.
  // - Much stronger teams (tier === 2): control midfield first (>= oppMid), keeping spare firepower in attack.
  if (posture !== 'all_out_attack') {
    let curStats = calculateTeamTacticalStats(lineup, formationKey, roles, targetMentality);
    const targetMid = tier >= 0 && tier <= 1
      ? Math.min(10, oppLiveStats.midfield + 1)
      : oppLiveStats.midfield;

    // Step A: Pull back any 'support_att' midfielders to 'normal' if CPU is below target midfield
    if (curStats.midfield < targetMid || (tier < 2 && curStats.midfield < baseSelf.midfield)) {
      const pushedMids = [...mcs, ...wideMids, ...attMids].filter(s => roles[s.id] === 'support_att');
      for (const pm of pushedMids) {
        const testRoles = { ...roles, [pm.id]: 'normal' };
        const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
        if (after.midfield > curStats.midfield) {
          roles[pm.id] = 'normal';
          curStats = after;
          if (curStats.midfield >= targetMid && curStats.midfield >= baseSelf.midfield) break;
        }
      }
    }

    // Step B: Drop extra forward(s) to 'support_mid' (always keep at least 1 forward on normal Attack)
    // Similar/stronger sides can drop up to (forwards.length - 1) if Attack stays >= 7; weaker sides keep Attack >= 6
    if ((curStats.midfield < targetMid || isOutnumberedInMidfield) && forwards.length >= 2) {
      const maxDrops = forwards.length - 1;
      const minAttFloor = tier <= -1 ? 6 : 7;
      let dropped = forwards.filter(f => roles[f.id] === 'support_mid').length;
      for (const fwd of forwards) {
        if (dropped >= maxDrops || curStats.midfield >= targetMid) break;
        if (roles[fwd.id] !== 'normal') continue;
        const testRoles = { ...roles, [fwd.id]: 'support_mid' };
        const after = calculateTeamTacticalStats(lineup, formationKey, testRoles, targetMentality);
        if (after.midfield > curStats.midfield && after.attack >= Math.min(curStats.attack, minAttFloor)) {
          roles[fwd.id] = 'support_mid';
          curStats = after;
          dropped++;
        }
      }
    }

    // Step C: If still trailing targetMid, allow 1 Full-Back -> WB (+MID) while keeping a strong Defense floor
    // Similar strength (tier 0/1) can trade surplus Defense (e.g. 9 -> 8 or 8 -> 7) if needed to contest midfield;
    // Weaker teams (tier <= -1) never weaken Defense to push a Full-Back up.
    if (curStats.midfield < targetMid && fullBacks.length > 0) {
      const availFb = fullBacks.find(fb => roles[fb.id] === 'normal');
      if (availFb) {
        const wbMinDef = tier <= -1
          ? curStats.defense
          : Math.max(7, Math.min(curStats.defense, baseSelf.defense - 1));
        tryAssignRole(availFb.id, 'support_mid', {
          minDef: wbMinDef,
          requireGainIn: 'midfield'
        });
      }
    }
  }

  return {
    mentality: targetMentality,
    roles,
    posture,
    tier
  };
}

/**
 * Infers a broad pitch slot role ('gk' | 'def' | 'mid' | 'att') from a CM position string.
 */
function inferSlotRoleFromPosition(posRaw) {
  const pos = String(posRaw || '').toUpperCase().trim();
  if (!pos) return 'mid';
  if (pos === 'GK' || pos.includes('GK')) return 'gk';
  if (['ST', 'CF', 'SC', 'FC', 'FW', 'LW', 'RW'].some(k => pos.includes(k))) return 'att';
  if (['DC', 'DL', 'DR', 'SW', 'DF', 'CB', 'LB', 'RB', 'LWB', 'RWB'].some(k => pos.includes(k))) return 'def';
  return 'mid';
}

/**
 * Computes goal-scoring and assist weights for a player given slot, natural position, skill, and tactical role.
 * - Attacking roles (forwards & support_att midfielders) lead goal scoring, scaled superlinearly by skill.
 * - Support roles (normal mids, support_mid forwards, wing backs) score at a lower rate via distance shots/headers.
 * - Defenders score rarely via set-piece headers or deep strikes.
 */
function computeGoalAndAssistWeights(player, slot, roleId = 'normal', squadBoost = 1.0) {
  const rawPos = String(player?.position || (Array.isArray(player?.positions) ? player.positions[0] : '') || '').toUpperCase();
  const idealPos = slot
    ? (slot.idealPos || getIdealSlotPosition(slot.role, slot.x, slot.y))
    : (rawPos || 'MC');
  const slotRole = slot ? slot.role : inferSlotRoleFromPosition(idealPos);
  const validRole = slot ? getRoleMetadata(slot, player, roleId).id : 'normal';
  const effSkill = slot ? getPlayerEffectiveSkill(player, slot) : Math.max(1, Number(player?.rating) || 3);

  let scorerTier = 'support';
  let goalRoleMult = 1.6;
  let assistRoleMult = 5.0;

  if (slotRole === 'att') {
    if (validRole === 'support_mid') {
      scorerTier = 'support';
      goalRoleMult = 5.5;
      assistRoleMult = 7.5;
    } else {
      scorerTier = 'attacking';
      goalRoleMult = 10.0;
      assistRoleMult = 4.5;
    }
  } else if (slotRole === 'mid') {
    const isAttackingMidPos = ['AMC', 'AML', 'AMR', 'LW', 'RW', 'AM'].some(k => idealPos.includes(k));
    const isDefensiveMidPos = idealPos === 'DMC' || idealPos === 'DM';

    if (validRole === 'support_att') {
      scorerTier = 'attacking';
      goalRoleMult = isAttackingMidPos ? 8.0 : 7.0;
      assistRoleMult = isAttackingMidPos ? 9.0 : 7.5;
    } else if (validRole === 'support_def') {
      scorerTier = 'defense';
      goalRoleMult = 0.65;
      assistRoleMult = 2.2;
    } else if (isAttackingMidPos) {
      scorerTier = 'support';
      goalRoleMult = 2.8;
      assistRoleMult = 8.0;
    } else if (isDefensiveMidPos) {
      scorerTier = 'support';
      goalRoleMult = 0.7;
      assistRoleMult = 2.2;
    } else {
      scorerTier = 'support';
      goalRoleMult = 1.6;
      assistRoleMult = ['ML', 'MR', 'LM', 'RM'].includes(idealPos) ? 8.0 : 5.5;
    }
  } else if (slotRole === 'def') {
    if (validRole === 'support_mid') {
      scorerTier = 'support';
      goalRoleMult = 0.85;
      assistRoleMult = 4.2;
    } else {
      const isFullBack = ['DL', 'DR', 'LB', 'RB', 'LWB', 'RWB'].some(k => idealPos.includes(k));
      scorerTier = 'defense';
      goalRoleMult = isFullBack ? 0.3 : 0.55;
      assistRoleMult = isFullBack ? 1.6 : 0.45;
    }
  } else {
    scorerTier = 'defense';
    goalRoleMult = 0.01;
    assistRoleMult = 0.05;
  }

  const goalSkillFactor = Math.pow(Math.max(1, effSkill), 2.0);
  const assistSkillFactor = Math.pow(Math.max(1, effSkill), 1.75);

  return {
    player,
    slotRole,
    idealPos,
    validRole,
    effSkill,
    scorerTier,
    goalWeight: Math.max(0.05, goalSkillFactor * goalRoleMult * squadBoost),
    assistWeight: Math.max(0.05, assistSkillFactor * assistRoleMult * squadBoost)
  };
}

function drawWeightedEntry(entries, weightKey) {
  if (!entries || entries.length === 0) return null;
  const total = entries.reduce((sum, e) => sum + Math.max(0.01, e[weightKey] || 0), 0);
  if (total <= 0) return entries[0];
  let roll = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= Math.max(0.01, entries[i][weightKey] || 0);
    if (roll <= 0) return entries[i];
  }
  return entries[entries.length - 1];
}

/**
 * Picks a goalscorer and optional assister from an active lineup or squad array,
 * weighted by tactical role (attacking / support / defense) and effective player skill.
 */
export function pickWeightedGoalScorerAndAssister(
  lineupInput,
  teamName = 'Team',
  formationKey = '4-4-2',
  playerRoles = {},
  options = {}
) {
  const {
    includeAssist = true,
    assistChance = 0.76,
    squadRotationMode = false,
    onlyAttackersIfAvailable = false
  } = options;

  let entries = [];

  if (lineupInput && !Array.isArray(lineupInput) && typeof lineupInput === 'object') {
    const rawSlots = getFormationSlots(formationKey || '4-4-2');
    const slotMap = new Map(
      rawSlots.map(s => [s.id, { ...s, idealPos: getIdealSlotPosition(s.role, s.x, s.y) }])
    );

    Object.keys(lineupInput).forEach(slotId => {
      const player = lineupInput[slotId];
      if (!player) return;
      const slot = slotMap.get(slotId) || null;
      const roleId = (playerRoles && playerRoles[slotId]) || player.tacticalRole || 'normal';
      const entry = computeGoalAndAssistWeights(player, slot, roleId, 1.0);
      entries.push(entry);
    });
  } else if (Array.isArray(lineupInput) && lineupInput.length > 0) {
    const cleanPlayers = lineupInput.filter(Boolean);
    const outfield = cleanPlayers.filter(p => inferSlotRoleFromPosition(p.position) !== 'gk');
    const pool = outfield.length > 0 ? outfield : cleanPlayers;

    let sortedByRating = pool;
    if (squadRotationMode) {
      sortedByRating = [...pool].sort((a, b) => (Number(b.rating) || 3) - (Number(a.rating) || 3));
    }

    entries = sortedByRating.map((player, idx) => {
      let squadBoost = 1.0;
      if (squadRotationMode) {
        if (idx < 10) squadBoost = 1.0;
        else if (idx < 14) squadBoost = 0.35;
        else squadBoost = 0.06;
      }
      return computeGoalAndAssistWeights(player, null, player.tacticalRole || 'normal', squadBoost);
    });
  }

  if (entries.length === 0) {
    return {
      scorer: { name: `${teamName} Striker`, position: 'ST', team: teamName },
      assister: null,
      scorerTier: 'attacking',
      attackingPool: []
    };
  }

  const outfieldEntries = entries.filter(e => e.slotRole !== 'gk');
  const scoringPool = outfieldEntries.length > 0 ? outfieldEntries : entries;

  const attackingEntries = scoringPool.filter(e => e.scorerTier === 'attacking');
  const activeGoalPool = (onlyAttackersIfAvailable && attackingEntries.length > 0)
    ? attackingEntries
    : scoringPool;

  const scorerEntry = drawWeightedEntry(activeGoalPool, 'goalWeight') || scoringPool[0];
  let assisterEntry = null;

  if (includeAssist && Math.random() < assistChance) {
    const assistCandidates = scoringPool.filter(e => e.player?.name !== scorerEntry.player?.name);
    if (assistCandidates.length > 0) {
      assisterEntry = drawWeightedEntry(assistCandidates, 'assistWeight');
    }
  }

  return {
    scorer: scorerEntry.player,
    assister: assisterEntry ? assisterEntry.player : null,
    scorerTier: scorerEntry.scorerTier,
    attackingPool: attackingEntries.map(e => e.player)
  };
}

/**
 * Returns the available Individual Match Instructions for a given slot, player, and tactical role.
 */
export function getAvailableInstructionsForSlot(slot, player, roleId = 'normal') {
  if (!slot) {
    return [{
      id: 'pass',
      label: 'Standard Play',
      shortLabel: 'PASS',
      icon: '⚽',
      color: '#00ff88',
      desc: 'Standard passing and movement.'
    }];
  }

  const slotRole = slot.role;
  const idealPos = (slot.idealPos || getIdealSlotPosition(slot.role, slot.x, slot.y) || '').toUpperCase();
  const labelPos = (slot.label || idealPos || '').toUpperCase();

  // 1. Goalkeeper (GK)
  if (slotRole === 'gk' || idealPos === 'GK' || labelPos === 'GK') {
    return [
      {
        id: 'short',
        label: 'Short Distribution',
        shortLabel: 'SHORT',
        icon: '🛡️',
        color: '#00e5ff',
        desc: 'Passes safely into the next build-up box (b2 / c2) to start controlled midfield possession.'
      },
      {
        id: 'long',
        label: 'Long Distribution',
        shortLabel: 'LONG',
        icon: '🚀',
        color: '#ffcc00',
        desc: 'Launches long from a2/d2 directly to c1, c2, or c3 (b1/b2/b3)! Players there contest a Tackle duel to win the ball and start an instant attack.'
      }
    ];
  }

  // 2. Full Backs / Wing Backs (DL / DR)
  if (slotRole === 'def' && (idealPos === 'DL' || idealPos === 'DR' || labelPos === 'DL' || labelPos === 'DR')) {
    if (roleId === 'support_mid') {
      return [
        {
          id: 'high_cross',
          label: 'High Cross from Flank (c1/c3)',
          shortLabel: 'HIGH CROSS',
          icon: '🎯',
          color: '#00ff88',
          desc: 'Moves a1→c1 / a3→c3 (50% share if winger present). Rolls Crossing vs Marking (diff >= 2) → Striker Heading vs (DC Heading + GK Handling)/2.'
        },
        {
          id: 'low_cross',
          label: 'Low Whipped Cross (c1/c3)',
          shortLabel: 'LOW CROSS',
          icon: '⚡',
          color: '#00e5ff',
          desc: 'Moves a1→c1 / a3→c3 (50% share if winger present). Rolls Crossing vs Marking (diff >= 2) → Striker Finishing vs (DC Tackling + GK Handling)/2.'
        },
        {
          id: 'through_ball',
          label: 'Through Ball into Box',
          shortLabel: 'THROUGH',
          icon: '🗡️',
          color: '#ffd700',
          desc: 'Moves to c1/c3 and plays a killer ball into nearby box (needs diff >= 4). If successful, Striker gets +3 Finishing!'
        }
      ];
    }

    if (roleId === 'support_att') {
      return [
        {
          id: 'high_cross',
          label: 'Byline High Cross (d1/d3)',
          shortLabel: 'HIGH CROSS',
          icon: '🎯',
          color: '#00ff88',
          desc: 'Charges all the way to d1/d3 (50% share with winger). Rolls Crossing vs Marking → Striker Heading vs (DC Heading + GK Handling)/2.'
        },
        {
          id: 'low_cross',
          label: 'Byline Low Cutback (d1/d3)',
          shortLabel: 'LOW CROSS',
          icon: '⚡',
          color: '#00e5ff',
          desc: 'Charges to d1/d3 (50% share with winger). Rolls Crossing vs Marking → Striker Finishing vs (DC Tackling + GK Handling)/2.'
        },
        {
          id: 'dribble',
          label: 'Overlap Dribble & Shoot',
          shortLabel: 'DRIBBLE',
          icon: '🔥',
          color: '#ff4500',
          desc: 'Giggs / Roberto Carlos / Trent overlap to d1/d3! Beats opponent Tackling (diff >= 2) to go 1-on-1 with the Keeper and shoot!'
        }
      ];
    }

    // Normal FB (DEF)
    return [
      {
        id: 'hold_line',
        label: 'Stay Back & Guard Flank',
        shortLabel: 'STAY BACK',
        icon: '🛡️',
        color: '#00e5ff',
        desc: 'Stays strictly in defensive corner (a1/a3 or d1/d3) to mark & tackle opposition wingers.'
      },
      {
        id: 'tight_mark_winger',
        label: 'Tight Mark Winger (+1 vs Cross)',
        shortLabel: 'TIGHT MARK',
        icon: '🔒',
        color: '#38bdf8',
        desc: 'Stays at a1/a3 and presses wide: +1 Marking against High/Low Crosses, -1 Tackling against Dribbles.'
      },
      {
        id: 'aggressive_press',
        label: 'Stop Dribblers (+1 vs Dribble)',
        shortLabel: 'HARD TACKLE',
        icon: '⚔️',
        color: '#f97316',
        desc: 'Stays at a1/a3 and dives into challenges: +1 Tackling against Winger Dribbles, -1 Marking against Crosses.'
      }
    ];
  }

  // 3. Center Backs (DC)
  if (slotRole === 'def') {
    return [
      {
        id: 'tight_marking',
        label: 'Aerial & Tight Marking',
        shortLabel: 'TIGHT MARK',
        icon: '🛡️',
        color: '#00e5ff',
        desc: 'Standard center-back screen: +1 Heading/Marking when contesting High Crosses in the box.'
      },
      {
        id: 'aggressive_tackle',
        label: 'Aggressive Box Tackler',
        shortLabel: 'AGGR TACKLE',
        icon: '⚔️',
        color: '#f97316',
        desc: 'Steps in hard on the ground: +1 Tackling when defending Low Crosses and 1-on-1 shots.'
      },
      {
        id: 'direct_pass',
        label: 'Ball-Playing DC (+1 Build-Up)',
        shortLabel: 'BALL PLAY',
        icon: '🎯',
        color: '#00ff88',
        desc: 'Steps into b2/c2 build-up when on Support Midfield or launching counters (+1 Passing).'
      }
    ];
  }

  // 4. Wingers & Wide Midfielders (AMR, AML, ML, MR, LW, RW)
  const isWingerSlot = ['AMR', 'AML', 'ML', 'MR', 'LW', 'RW', 'DML', 'DMR'].includes(idealPos) ||
    ['AMR', 'AML', 'ML', 'MR', 'LW', 'RW'].includes(labelPos);
  if (isWingerSlot) {
    const isAttackingWideRole =
      ['AMR', 'AML', 'LW', 'RW'].includes(idealPos) ||
      ['AMR', 'AML', 'LW', 'RW'].includes(labelPos) ||
      roleId === 'support_att';
    const wingList = [
      {
        id: 'high_cross',
        label: 'High Cross (Aerial Target)',
        shortLabel: 'HIGH CROSS',
        icon: '🎯',
        color: '#00ff88',
        desc: 'Crossing vs FB Marking (diff >= 2) → Striker Heading vs (Opp DC Heading + GK Handling)/2 (50% chance which DC & Striker).'
      },
      {
        id: 'low_cross',
        label: 'Low Cross (Ground Cutback)',
        shortLabel: 'LOW CROSS',
        icon: '⚡',
        color: '#00e5ff',
        desc: 'Crossing vs FB Marking (diff >= 2) → Striker Finishing vs (Opp DC Tackling + GK Handling)/2 (50% chance which DC & Striker).'
      },
      {
        id: 'dribble',
        label: 'Cut Inside & Dribble (1v1)',
        shortLabel: 'DRIBBLE',
        icon: '🔥',
        color: '#ff4500',
        desc: 'Dribbling vs FB Tackling (diff >= 2) → Winger goes straight into a 1-on-1 shooting chance against the Keeper!'
      }
    ];
    if (isAttackingWideRole) {
      wingList.push({
        id: 'long_shot',
        label: 'Shoot from Distance',
        shortLabel: 'LONG SHOT',
        icon: '🚀',
        color: '#a855f7',
        desc: 'Cuts inside from the flank and unleashes a long-range strike (d10 + Long Shots vs Defense, requires diff >= 5 to score).'
      });
    }
    return wingList;
  }

  // 5. Attacking Midfielder Central (AMC) — or Central Midfielder (MC) on Attacking role ('support_att')
  const isAmcLikeSlot = idealPos === 'AMC' || labelPos === 'AMC' ||
    ((idealPos === 'MC' || labelPos === 'MC') && roleId === 'support_att');
  if (isAmcLikeSlot) {
    return [
      {
        id: 'pass',
        label: 'Standard Box Pass',
        shortLabel: 'PASS',
        icon: '⚽',
        color: '#00ff88',
        desc: 'Reliable short pass into the box (requires diff >= 2 vs DMC/DC Marking) to set up a Striker.'
      },
      {
        id: 'through_ball',
        label: 'Killer Through Ball (+3 Striker)',
        shortLabel: 'THROUGH',
        icon: '🗡️',
        color: '#ffd700',
        desc: 'Tries to split defense to find a Striker in space (requires diff >= 4 vs DMC/DC). If successful, Striker rolls Finishing with +3!'
      },
      {
        id: 'dribble',
        label: 'Dribble Through & Shoot 1v1',
        shortLabel: 'DRIBBLE 1V1',
        icon: '🔥',
        color: '#ff4500',
        desc: 'Takes on opponent DMC or DC (Dribbling vs Tackling, diff >= 2). If successful, AMC shoots 1-on-1 against the Keeper!'
      },
      {
        id: 'long_shot',
        label: 'Shoot from Distance',
        shortLabel: 'LONG SHOT',
        icon: '🚀',
        color: '#a855f7',
        desc: 'Unleashes a long-range strike from c2/b2 (d10 + Long Shots vs Defense, requires diff >= 5 to score).'
      }
    ];
  }

  // 6. Defensive Midfielder Central (DMC)
  if (idealPos === 'DMC' || labelPos === 'DMC') {
    return [
      {
        id: 'pass',
        label: 'Simple Recycle Pass (Safe)',
        shortLabel: 'PASS',
        icon: '⚽',
        color: '#00ff88',
        desc: 'Always plays a controlled pass from b2 to c1/c2/c3 (requires standard diff >= 2).'
      },
      {
        id: 'through_ball',
        label: 'Deep Playmaker Through Ball',
        shortLabel: 'THROUGH',
        icon: '🗡️',
        color: '#ffd700',
        desc: 'Hits a defence-splitting pass from b2 to c1/c2/c3 (requires diff >= 4). If successful, receiver gets +3 skill on their next move!'
      },
      {
        id: 'man_mark',
        label: 'Man-Mark Opponent AMC (+1 Mark)',
        shortLabel: 'MAN MARK',
        icon: '🔒',
        color: '#00e5ff',
        desc: 'Screens central zone b2/c2 tightly (+1 Marking against opponent AMC passes & through-balls) and plays simple passes.'
      }
    ];
  }

  // 7. Central Midfielder (MC)
  if (slotRole === 'mid') {
    return [
      {
        id: 'pass',
        label: 'Standard Pass (Always Pass)',
        shortLabel: 'PASS',
        icon: '⚽',
        color: '#00ff88',
        desc: 'Always passes the ball from b2 to c1, c2 (if AMC), or c3 with standard diff >= 2.'
      },
      {
        id: 'through_ball',
        label: 'Through Ball (+3 to Receiver)',
        shortLabel: 'THROUGH',
        icon: '🗡️',
        color: '#ffd700',
        desc: 'Passes from b2 to c1, c2 (if AMC), or c3 requiring diff >= 4 instead of 2! If successful, AMR/AMC/AML is free and rolls with Skill + 3 on their next move!'
      }
    ];
  }

  // 8. Strikers / Center Forwards (ST / CF)
  if (slotRole === 'att') {
    return [
      {
        id: 'balanced_finisher',
        label: 'Complete Forward (Balanced)',
        shortLabel: 'BALANCED',
        icon: '⚽',
        color: '#00ff88',
        desc: 'Ready for any service: uses pure Heading on High Crosses and pure Finishing on Low Crosses & 1-on-1 shots.'
      },
      {
        id: 'target_man',
        label: 'Aerial Target Man (+1 Heading)',
        shortLabel: 'TARGET MAN',
        icon: '🎯',
        color: '#ffcc00',
        desc: 'Dominates the air: +1 Heading on High Crosses, -1 Finishing on Low Crosses.'
      },
      {
        id: 'poacher',
        label: 'Box Poacher (+1 Low/1v1 Finish)',
        shortLabel: 'POACHER',
        icon: '⚡',
        color: '#ff4500',
        desc: 'Clinical on the deck: +1 Finishing on Low Crosses & Through-Balls, -1 Heading on High Crosses.'
      }
    ];
  }

  return [
    {
      id: 'pass',
      label: 'Standard Play',
      shortLabel: 'PASS',
      icon: '⚽',
      color: '#00ff88',
      desc: 'Standard passing and movement.'
    }
  ];
}

export function getDefaultInstructionForSlot(slot, player, roleId = 'normal') {
  const list = getAvailableInstructionsForSlot(slot, player, roleId);
  if (!slot) return list[0]?.id || 'pass';

  const idealPos = (slot.idealPos || getIdealSlotPosition(slot.role, slot.x, slot.y) || '').toUpperCase();
  const labelPos = (slot.label || idealPos || '').toUpperCase();
  const isAmcSlot = idealPos === 'AMC' || labelPos === 'AMC';

  if (isAmcSlot && player) {
    const sk = player.skills || {};
    const rating = Math.max(1, Math.min(10, Math.round(Number(player.rating) || 6)));
    const pass = sk.passing ?? rating;
    const drib = sk.dribbling ?? rating;
    const lsh = sk.longShots ?? Math.max(1, rating - 1);

    if (lsh >= 8 && lsh > pass && lsh >= drib) {
      return 'long_shot';
    }
    if (drib >= 8 && drib > pass && drib > lsh) {
      return 'dribble';
    }
    if (pass >= 9 && pass >= drib && pass >= lsh) {
      return 'through_ball';
    }
    return 'pass';
  }

  return list[0]?.id || 'pass';
}

export function getInstructionMetadata(slot, player, roleId = 'normal', instructionId) {
  const list = getAvailableInstructionsForSlot(slot, player, roleId);
  if (instructionId) {
    const found = list.find(i => i.id === instructionId);
    if (found) return found;
  }
  const defaultId = getDefaultInstructionForSlot(slot, player, roleId);
  return list.find(i => i.id === defaultId) || list[0];
}

export function getSavedPlayerInstructions(teamName, season) {
  try {
    if (teamName && season) {
      const saved = localStorage.getItem(`retro_instructions_${teamName}_${season}`);
      if (saved) return JSON.parse(saved);
    }
    const fallback = localStorage.getItem('retro_player_instructions');
    if (fallback) return JSON.parse(fallback);
  } catch (e) {
    // ignore storage errors
  }
  return {};
}

export function savePlayerInstructions(teamName, season, instructionsMap) {
  try {
    const payload = JSON.stringify(instructionsMap || {});
    if (teamName && season) {
      localStorage.setItem(`retro_instructions_${teamName}_${season}`, payload);
    }
    localStorage.setItem('retro_player_instructions', payload);
  } catch (e) {
    // ignore storage errors
  }
}

export const DEFAULT_TEAM_TACTICS = {
  mentality: 'balanced',         // 'defense' | 'balanced' | 'attack'
  attackingFocus: 'both_flanks', // 'left' | 'right' | 'center' | 'both_flanks'
  passing: 'short',              // 'short' | 'long'
  tackling: 'normal',            // 'easy' | 'normal' | 'hard'
  pressing: false,               // false | true
  counterAttack: false           // false | true
};

export function normalizeTeamTactics(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawPassing = String(src.passing || 'short').toLowerCase();
  const passing = rawPassing === 'long' ? 'long' : 'short';
  const validFocus = ['left', 'right', 'center', 'both_flanks'];
  const attackingFocus = validFocus.includes(src.attackingFocus) ? src.attackingFocus : 'both_flanks';
  return {
    mentality: normalizeMentality(src.mentality),
    attackingFocus,
    tackling: ['easy', 'normal', 'hard'].includes(src.tackling) ? src.tackling : 'normal',
    passing,
    pressing: Boolean(src.pressing),
    counterAttack: Boolean(src.counterAttack)
  };
}

export function getSavedTeamTactics(teamName, season) {
  try {
    if (teamName && season) {
      const saved = localStorage.getItem(`retro_team_tactics_${teamName}_${season}`);
      if (saved) return normalizeTeamTactics(JSON.parse(saved));
    }
    const fallback = localStorage.getItem('retro_team_tactics');
    if (fallback) return normalizeTeamTactics(JSON.parse(fallback));
  } catch (e) {
    // ignore storage errors
  }
  return { ...DEFAULT_TEAM_TACTICS };
}

export function saveTeamTactics(teamName, season, tacticsObj) {
  const normalized = normalizeTeamTactics(tacticsObj);
  try {
    const payload = JSON.stringify(normalized);
    if (teamName && season) {
      localStorage.setItem(`retro_team_tactics_${teamName}_${season}`, payload);
    }
    localStorage.setItem('retro_team_tactics', payload);
  } catch (e) {
    // ignore storage errors
  }
  return normalized;
}

export function getSavedPenaltyTakers(teamName, season) {
  try {
    if (teamName && season) {
      const saved = localStorage.getItem(`retro_penalties_${teamName}_${season}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    // ignore storage errors
  }
  return [];
}

export function savePenaltyTakers(teamName, season, takersList) {
  const cleanList = Array.isArray(takersList) ? takersList.filter(Boolean) : [];
  try {
    if (teamName && season) {
      localStorage.setItem(`retro_penalties_${teamName}_${season}`, JSON.stringify(cleanList));
    }
  } catch (e) {
    // ignore storage errors
  }
  return cleanList;
}

export function resolveValidPenaltyTakers(lineupObj, preferredNames = [], maxCount = 5) {
  const onPitch = lineupObj ? Object.values(lineupObj).filter(Boolean) : [];
  if (onPitch.length === 0) return [];
  const pitchNames = new Set(onPitch.map(p => p.name));

  const ordered = [];
  const seen = new Set();
  if (Array.isArray(preferredNames)) {
    preferredNames.forEach((name) => {
      if (name && pitchNames.has(name) && !seen.has(name)) {
        ordered.push(name);
        seen.add(name);
      }
    });
  }

  // Fill remaining slots automatically from best finishers/attackers on pitch (GK last)
  const candidates = [...onPitch].sort((a, b) => {
    const aGk = String(a.position || '').toUpperCase() === 'GK' ? 1 : 0;
    const bGk = String(b.position || '').toUpperCase() === 'GK' ? 1 : 0;
    if (aGk !== bGk) return aGk - bGk;
    const aFin = a.skills?.finishing ?? Number(a.rating) ?? 5;
    const bFin = b.skills?.finishing ?? Number(b.rating) ?? 5;
    if (bFin !== aFin) return bFin - aFin;
    return (Number(b.rating) || 0) - (Number(a.rating) || 0);
  });

  for (const p of candidates) {
    if (ordered.length >= Math.min(maxCount, onPitch.length)) break;
    if (!seen.has(p.name)) {
      ordered.push(p.name);
      seen.add(p.name);
    }
  }

  return ordered.slice(0, maxCount);
}

