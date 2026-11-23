import React from 'react';
import {
  getFormationSlots,
  getIdealSlotPosition
} from './FormationTactics';
import {
  normalizeMentality,
  calculateTeamTacticalStats,
  getRoleMetadata,
  getInstructionMetadata,
  summarizeActiveRoles,
  computeCPUTacticalPlan,
  getPlayerEffectiveSkill
} from '../utils/tacticalRoleEngine';
import PlayerInfoModal, { PlayerInfoButton } from './PlayerInfoModal';
import PlayerRoleInstructionsModal from './PlayerRoleInstructionsModal';

/**
 * Calculates a team's effective department stat (attack, midfield, defense)
 * using the tactical role & mentality engine (or fallback base stat if no squad lineup exists).
 *
 * Rules:
 * - Defense = Math.floor(defSum / 4)
 * - Midfield = Math.floor(midSum / 4)
 * - Attack = Math.floor(attSum / 2)
 * - Mentality:
 *   • 'defense': +1 skill to defenders & support_def, -1 skill to attackers & support_att
 *   • 'attack':  +1 skill to attackers & support_att, -1 skill to defenders & support_def
 *   • 'balanced': no bonuses
 */
export const getModifiedStat = (
  baseValue,
  statType,
  tactic,
  counter,
  pressing,
  oppPressing,
  pressingDuration,
  formation,
  _stamina = null,
  lineup = null,
  playerRoles = {}
) => {
  const normMentality = normalizeMentality(tactic);

  // If the team has an active squad lineup on the pitch, compute dynamically from player positions, roles & mentality
  if (lineup && Object.keys(lineup).filter(k => lineup[k]).length >= 7) {
    const calc = calculateTeamTacticalStats(lineup, formation || '4-4-2', playerRoles || {}, normMentality);
    const rawStat = calc[statType] !== undefined ? calc[statType] : baseValue;
    return Math.min(10, Math.max(1, rawStat));
  }

  // Fallback for teams without a squad lineup
  let mod = 0;
  if (normMentality === 'defense') {
    if (statType === 'defense') mod += 1;
    if (statType === 'attack') mod -= 1;
  } else if (normMentality === 'attack') {
    if (statType === 'attack') mod += 1;
    if (statType === 'defense') mod -= 1;
  }

  return Math.max(1, baseValue + mod);
};

/**
 * AI Opponent Tactical & Player-Role Decision Engine Wrapper
 */
export const adjustCPUTactic = ({
  team,
  opp,
  lineup = null,
  formation = '4-4-2',
  oppLineup = null,
  oppFormation = '4-4-2',
  oppRoles = {},
  oppMentality = 'balanced',
  scoreSelf,
  scoreOpp,
  isLeg2,
  leg1HomeScore,
  leg1AwayScore,
  currentMatchTime,
  isHomeSide,
  currentMentality = 'balanced',
  currentRoles = {},
  setTactic,
  setRoles
}) => {
  if (!team || !opp) return null;

  const plan = computeCPUTacticalPlan({
    lineup,
    formationKey: formation,
    selfTeam: team,
    oppTeam: opp,
    oppLineup,
    oppFormation,
    oppRoles,
    oppMentality,
    scoreSelf,
    scoreOpp,
    isLeg2,
    leg1HomeScore,
    leg1AwayScore,
    currentMatchTime,
    isHomeSide,
    currentMentality,
    currentRoles
  });

  if (setTactic) {
    setTactic(plan.mentality);
  }
  if (setRoles && plan.roles) {
    setRoles(plan.roles);
  }

  return plan;
};

/**
 * Reusable UI Tactics & Player Roles Panel Component
 */
export const TacticsPanel = ({
  disabled,
  tactic,
  setTactic,
  mentalityCooldown = 0,
  lineup = {},
  formation = '4-4-2',
  playerRoles = {},
  onToggleRole = null,
  playerInstructions = {},
  onChangeInstruction = null,
  captainName = '',
  onSelectCaptain = null
}) => {
  const [infoPlayer, setInfoPlayer] = React.useState(null);
  const [roleModalTarget, setRoleModalTarget] = React.useState(null);
  const normTactic = normalizeMentality(tactic);
  const isMentalityDisabled = disabled;

  const handleMentalityChange = (newTactic) => {
    if (isMentalityDisabled) return;
    setTactic(newTactic);
  };

  // Build ordered slot list (including GK) for role & individual instructions controls
  const rawSlots = getFormationSlots(formation || '4-4-2');
  const outfieldSlots = rawSlots
    .filter(s => lineup && lineup[s.id])
    .map(s => {
      const player = lineup[s.id];
      const idealPos = getIdealSlotPosition(s.role, s.x, s.y);
      const slotWithPos = { ...s, idealPos, label: idealPos };
      const roleId = (playerRoles && playerRoles[s.id]) || 'normal';
      const roleMeta = getRoleMetadata(slotWithPos, player, roleId);
      const instrMeta = getInstructionMetadata(
        slotWithPos,
        player,
        roleMeta.id,
        playerInstructions && playerInstructions[s.id]
      );
      const effSkill = getPlayerEffectiveSkill(player, slotWithPos);
      const lastName = player.name ? player.name.trim().split(/\s+/).pop() : idealPos;
      return {
        slot: slotWithPos,
        player,
        idealPos,
        roleId: roleMeta.id,
        roleMeta,
        instrMeta,
        effSkill,
        lastName
      };
    });

  const activeCpuRoles = disabled ? summarizeActiveRoles(lineup, formation, playerRoles) : [];
  const pitchPlayers = rawSlots
    .map(s => lineup && lineup[s.id])
    .filter(Boolean);
  const resolvedCaptainName = pitchPlayers.some(p => p.name === captainName)
    ? captainName
    : (pitchPlayers[0]?.name || '');

  return (
    <div
      className="tactical-panel"
      style={{
        marginTop: '12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: '10px',
        width: '100%'
      }}
    >
      <span className="roll-label" style={{ fontSize: '9.5px', marginBottom: '6px', display: 'block' }}>
        MENTALITY
      </span>

      {/* 3 Mentality Buttons: Defensive, Normal, Attacking */}
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', width: '100%', marginBottom: '10px' }}>
        <button
          type="button"
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange('defense')}
          style={{
            background: normTactic === 'defense' ? 'rgba(0, 229, 255, 0.22)' : 'rgba(255,255,255,0.05)',
            border: normTactic === 'defense' ? '1.5px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
            color: normTactic === 'defense' ? '#00e5ff' : '#aaa',
            padding: '4px 4px',
            borderRadius: '6px',
            fontSize: '8px',
            fontFamily: 'Orbitron',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled && normTactic !== 'defense' ? 0.45 : 1
          }}
          title="Defensive Mentality: +1 skill to all Defenders & Defense Supporters; -1 skill to all Attackers & Attack Supporters"
        >
          🛡️ DEF
        </button>

        <button
          type="button"
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange('balanced')}
          style={{
            background: normTactic === 'balanced' ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
            border: normTactic === 'balanced' ? '1.5px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
            color: normTactic === 'balanced' ? '#ffd700' : '#aaa',
            padding: '4px 4px',
            borderRadius: '6px',
            fontSize: '8px',
            fontFamily: 'Orbitron',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled && normTactic !== 'balanced' ? 0.45 : 1
          }}
          title="Normal Mentality: Standard player skills with no mentality modifiers"
        >
          ⚖️ NORMAL
        </button>

        <button
          type="button"
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange('attack')}
          style={{
            background: normTactic === 'attack' ? 'rgba(255, 69, 0, 0.25)' : 'rgba(255,255,255,0.05)',
            border: normTactic === 'attack' ? '1.5px solid #ff4500' : '1px solid rgba(255,255,255,0.1)',
            color: normTactic === 'attack' ? '#ff4500' : '#aaa',
            padding: '4px 4px',
            borderRadius: '6px',
            fontSize: '8px',
            fontFamily: 'Orbitron',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled && normTactic !== 'attack' ? 0.45 : 1
          }}
          title="Attacking Mentality: +1 skill to all Attackers & Attack Supporters; -1 skill to all Defenders & Defense Supporters"
        >
          ⚔️ ATT
        </button>
      </div>

      {/* Match Captain Selector */}
      {!disabled && onSelectCaptain && pitchPlayers.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '8px',
          marginBottom: '8px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span className="roll-label" style={{ fontSize: '9px', color: '#ffd700', whiteSpace: 'nowrap' }}>
            ©️ CAPTAIN
          </span>
          <select
            value={resolvedCaptainName}
            onChange={(e) => onSelectCaptain(e.target.value)}
            title="Select on-field match captain"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'rgba(255, 215, 0, 0.1)',
              color: '#ffd700',
              border: '1px solid rgba(255, 215, 0, 0.35)',
              borderRadius: '4px',
              padding: '4px 6px',
              fontSize: '10px',
              fontFamily: 'Orbitron, sans-serif',
              fontWeight: 'bold',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {pitchPlayers.map(p => (
              <option key={p.name} value={p.name} style={{ background: '#0c1614', color: '#fff' }}>
                {p.name} ({p.position})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Player Tactical Roles Section */}
      {!disabled && outfieldSlots.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '8px',
          width: '100%'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '5px'
          }}>
            <span className="roll-label" style={{ fontSize: '8.5px', margin: 0, color: '#00ff64' }}>
              ROLES &amp; INSTRUCTIONS (CLICK)
            </span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            maxHeight: '165px',
            overflowY: 'auto',
            paddingRight: '2px'
          }}>
            {outfieldSlots.map(({ slot, player, idealPos, roleMeta, instrMeta, effSkill, lastName }) => (
              <div
                key={slot.id}
                onClick={() => {
                  setRoleModalTarget({ slot, player });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  background: roleMeta.id !== 'normal' ? 'rgba(0, 255, 100, 0.08)' : 'rgba(255,255,255,0.03)',
                  border: roleMeta.id !== 'normal' ? `1px solid ${roleMeta.color}66` : '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  fontSize: '8.5px',
                  userSelect: 'none'
                }}
                title={`${player.name} (${idealPos}, ★${effSkill}) — ${roleMeta.label} | ${instrMeta?.label || 'Standard'}: ${instrMeta?.desc || roleMeta.desc}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                  <span style={{
                    fontFamily: 'Orbitron',
                    fontSize: '7.5px',
                    fontWeight: 'bold',
                    color: slot.role === 'gk' ? '#ffd700' : (slot.role === 'def' ? '#00e5ff' : (slot.role === 'mid' ? '#00ff64' : '#ff4500')),
                    minWidth: '22px'
                  }}>
                    {idealPos}
                  </span>
                  <span style={{
                    color: '#fff',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '64px'
                  }}>
                    {lastName}
                  </span>
                  <span style={{ color: '#ffd700', fontSize: '7.5px', fontFamily: 'Orbitron' }}>
                    ★{effSkill}
                  </span>
                  <PlayerInfoButton player={player} onOpen={setInfoPlayer} size="xs" />
                </div>
                <span style={{
                  fontFamily: 'Orbitron',
                  fontSize: '6.8px',
                  fontWeight: 'bold',
                  color: slot.role === 'gk' ? (instrMeta?.color || '#ffd700') : roleMeta.color,
                  background: 'rgba(0,0,0,0.35)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  border: `1px solid ${(slot.role === 'gk' ? (instrMeta?.color || '#ffd700') : roleMeta.color)}55`,
                  whiteSpace: 'nowrap'
                }}>
                  {slot.role === 'gk' ? `GK • ${instrMeta?.shortLabel || 'SHORT'}` : `${roleMeta.shortLabel} • ${instrMeta?.shortLabel || 'PASS'}`} ⚙
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CPU Active Roles Summary */}
      {disabled && outfieldSlots.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '7px',
          width: '100%'
        }}>
          <span className="roll-label" style={{ fontSize: '8px', marginBottom: '4px', display: 'block', color: '#aaa' }}>
            AI TACTICAL ROLES ({activeCpuRoles.length})
          </span>
          {activeCpuRoles.length === 0 ? (
            <div style={{ fontSize: '8px', color: '#777', fontStyle: 'italic' }}>
              Standard positional duties
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '3px',
              justifyContent: 'center',
              maxHeight: '95px',
              overflowY: 'auto'
            }}>
              {activeCpuRoles.map(item => (
                <span
                  key={item.slotId}
                  style={{
                    fontSize: '7px',
                    fontFamily: 'Orbitron',
                    fontWeight: 'bold',
                    color: item.color,
                    background: 'rgba(0,0,0,0.4)',
                    border: `1px solid ${item.color}55`,
                    borderRadius: '3px',
                    padding: '2px 4px'
                  }}
                  title={`${item.playerName} (${item.idealPos}): ${item.label}`}
                >
                  {item.lastName}: {item.shortLabel}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {infoPlayer && (
        <PlayerInfoModal
          player={infoPlayer}
          onClose={() => setInfoPlayer(null)}
        />
      )}
      {roleModalTarget && (
        <PlayerRoleInstructionsModal
          isOpen={Boolean(roleModalTarget)}
          onClose={() => setRoleModalTarget(null)}
          player={roleModalTarget.player}
          slot={roleModalTarget.slot}
          currentRoleId={(playerRoles && playerRoles[roleModalTarget.slot.id]) || 'normal'}
          currentInstructionId={playerInstructions && playerInstructions[roleModalTarget.slot.id]}
          onSelectRole={(slotId, nextRole, pl, sl) => {
            if (onToggleRole) onToggleRole(slotId, nextRole, pl, sl);
          }}
          onSelectInstruction={(slotId, nextInstr, pl, sl) => {
            if (onChangeInstruction) onChangeInstruction(slotId, nextInstr, pl, sl);
          }}
        />
      )}
    </div>
  );
};
