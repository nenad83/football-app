import React from 'react';
import { getPlayerSkills } from '../utils/zone12MatchEngine';

const getPosColor = (pos) => {
  const p = String(pos || '').toUpperCase();
  if (p === 'GK') return '#ffd700';
  if (['DC', 'DL', 'DR', 'SW', 'CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p)) return '#00e5ff';
  if (['DMC', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'LM', 'CM', 'RM', 'AM'].includes(p)) return '#00ff64';
  return '#ff4500';
};

const getSkillBarColor = (val) => {
  if (val >= 8) return '#00ff64';
  if (val >= 6) return '#00e5ff';
  if (val >= 4) return '#ffd700';
  return '#7a8490';
};

/**
 * Small reusable `(i)` button for opening the Player Info modal from pitch cards, squad lists, or modals.
 */
export function PlayerInfoButton({ player, onOpen, size = 'sm', style = {} }) {
  if (!player || !onOpen) return null;
  const px = size === 'xs' ? 13 : (size === 'md' ? 18 : 15);
  const fontSize = size === 'xs' ? '8px' : (size === 'md' ? '10px' : '9px');
  return (
    <button
      type="button"
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onOpen(player);
      }}
      title={`View full info & skills for ${player.name}`}
      style={{
        width: `${px}px`,
        height: `${px}px`,
        minWidth: `${px}px`,
        borderRadius: '50%',
        border: '1px solid rgba(0, 229, 255, 0.55)',
        background: 'rgba(0, 229, 255, 0.14)',
        color: '#00e5ff',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        fontWeight: 'bold',
        fontSize,
        lineHeight: 1,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        ...style
      }}
    >
      i
    </button>
  );
}

/**
 * Full-detail Player Profile & 1-10 Match Engine Skills popup modal.
 */
export default function PlayerInfoModal({ player, onClose, teamName = '', seasonStats = null }) {
  if (!player) return null;

  const baseSkills = getPlayerSkills({ ...player, condition: 100 });
  const hasExtractedSkills = Boolean(player.skills && typeof player.skills === 'object');
  const fullPositions = Array.isArray(player.positions) && player.positions.length > 0
    ? player.positions
    : [player.position || 'MC'];
  const cond = player.condition !== undefined ? player.condition : 100;
  const fatigueMod = cond < 55 ? -2 : (cond < 72 ? -1 : 0);
  const posColor = getPosColor(player.position);

  const skillRows = [
    { key: 'passing',   label: 'Passing',    val: baseSkills.passing,   group: 'tech' },
    { key: 'dribbling', label: 'Dribbling',  val: baseSkills.dribbling, group: 'tech' },
    { key: 'crossing',  label: 'Crossing',   val: baseSkills.crossing,  group: 'tech' },
    { key: 'finishing', label: 'Finishing',  val: baseSkills.finishing, group: 'att' },
    { key: 'longShots', label: 'Long Shots', val: baseSkills.longShots, group: 'att' },
    { key: 'heading',   label: 'Heading',    val: baseSkills.heading,   group: 'att' },
    { key: 'marking',   label: 'Marking',    val: baseSkills.marking,   group: 'def' },
    { key: 'tackling',  label: 'Tackling',   val: baseSkills.tackling,  group: 'def' },
    { key: 'handling',  label: 'Handling (GK)', val: baseSkills.handling, group: 'gk' }
  ];

  const isInjured = Number(player.injuryMatchesLeft) > 0;
  const isSuspended = Number(player.suspensionMatchesLeft) > 0;
  const goals = seasonStats?.goals ?? player.goals;
  const assists = seasonStats?.assists ?? player.assists;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100060,
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #111622 0%, #090c12 100%)',
          border: `1.5px solid ${posColor}88`,
          borderRadius: '12px',
          boxShadow: `0 18px 48px rgba(0,0,0,0.88), 0 0 24px ${posColor}25`,
          display: 'flex',
          flexDirection: 'column',
          color: '#fff'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.35)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {player.squadNumber ? (
                <span style={{
                  fontFamily: 'Orbitron',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#ffd700',
                  background: 'rgba(255, 215, 0, 0.12)',
                  border: '1px solid rgba(255, 215, 0, 0.35)',
                  borderRadius: '4px',
                  padding: '2px 6px'
                }}>
                  #{player.squadNumber}
                </span>
              ) : null}
              <h3 style={{ margin: 0, fontFamily: 'Orbitron', fontSize: '16px', color: '#fff', letterSpacing: '0.6px' }}>
                {player.fullName || player.name}
              </h3>
              <span style={{
                fontFamily: 'Orbitron',
                fontSize: '10px',
                fontWeight: 'bold',
                color: posColor,
                background: 'rgba(0,0,0,0.45)',
                border: `1px solid ${posColor}66`,
                borderRadius: '4px',
                padding: '2px 7px'
              }}>
                {player.position || fullPositions[0]}
              </span>
              {player.rating !== undefined && (
                <span style={{
                  fontFamily: 'Orbitron',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#ffd700'
                }}>
                  ★{player.rating}
                </span>
              )}
            </div>

            {teamName && (
              <div style={{ fontSize: '11px', color: '#9aa5b4', fontFamily: 'Orbitron' }}>
                {teamName}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '6px',
              color: '#ccc',
              fontSize: '14px',
              padding: '4px 10px',
              cursor: 'pointer',
              lineHeight: 1.1
            }}
          >
            ✕
          </button>
        </div>

        {/* Bio / Profile Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '8px',
          padding: '14px 18px 8px 18px'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '7px 10px' }}>
            <div style={{ fontSize: '9px', fontFamily: 'Orbitron', color: '#7e8a9a', marginBottom: '2px' }}>POSITIONS</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: posColor }}>
              {fullPositions.join(', ')}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '7px 10px' }}>
            <div style={{ fontSize: '9px', fontFamily: 'Orbitron', color: '#7e8a9a', marginBottom: '2px' }}>AGE / NATIONALITY</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
              {player.age ? `${player.age} yrs` : 'N/A'}
              <span style={{ color: '#6b7788', margin: '0 6px' }}>•</span>
              <span style={{ color: player.nationality ? '#e2e8f0' : '#7a8490', fontStyle: player.nationality ? 'normal' : 'italic' }}>
                {player.nationality || 'Not in DB yet'}
              </span>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '7px 10px' }}>
            <div style={{ fontSize: '9px', fontFamily: 'Orbitron', color: '#7e8a9a', marginBottom: '2px' }}>CONDITION & STATUS</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: cond < 60 ? '#ff5555' : (cond < 80 ? '#ffa500' : '#00ff64') }}>
                ⚡ {cond}%
              </span>
              {fatigueMod < 0 && (
                <span style={{ fontSize: '10px', color: '#ffa500' }}>({fatigueMod} fatigue)</span>
              )}
              {isInjured && (
                <span style={{ fontSize: '10px', color: '#ff5555' }}>🤕 {player.injury || 'Injured'} ({player.injuryMatchesLeft}m)</span>
              )}
              {isSuspended && (
                <span style={{ fontSize: '10px', color: '#ff4d6d' }}>🟥 {player.suspensionReason || 'Suspended'} ({player.suspensionMatchesLeft}m)</span>
              )}
              {!isInjured && !isSuspended && <span style={{ fontSize: '10px', color: '#8de4af' }}>Fit</span>}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '7px 10px' }}>
            <div style={{ fontSize: '9px', fontFamily: 'Orbitron', color: '#7e8a9a', marginBottom: '2px' }}>VALUE & CONTRACT</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffd700' }}>
              {player.value !== undefined ? `£${player.value}M` : 'N/A'}
              {player.wage ? (
                <span style={{ color: '#9aa5b4', fontSize: '10.5px', fontWeight: 'normal' }}>
                  {' '}• £{Number(player.wage).toLocaleString()}/wk
                </span>
              ) : null}
            </div>
            {player.onLoan && player.loanClub && (
              <div style={{ fontSize: '10px', color: '#00e5ff', marginTop: '2px' }}>
                On loan: {player.loanClub}
              </div>
            )}
          </div>
        </div>

        {/* Extra info strip (CA / Preferred Foot / Season Stats) */}
        {(player.currentAbility || player.foot || goals !== undefined || assists !== undefined) && (
          <div style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '0 18px 8px 18px',
            fontSize: '10.5px',
            color: '#b0bac8'
          }}>
            {player.currentAbility ? (
              <span style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.25)', borderRadius: '4px', padding: '2px 7px', color: '#00e5ff', fontFamily: 'Orbitron', fontSize: '9.5px' }}>
                CA: {player.currentAbility}
              </span>
            ) : null}
            {player.foot ? (
              <span style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 7px' }}>
                Foot: <strong>{player.foot}</strong>
              </span>
            ) : null}
            {goals !== undefined ? (
              <span style={{ background: 'rgba(0, 255, 100, 0.08)', border: '1px solid rgba(0, 255, 100, 0.25)', borderRadius: '4px', padding: '2px 7px', color: '#00ff64' }}>
                ⚽ Goals: <strong>{goals}</strong>
              </span>
            ) : null}
            {assists !== undefined ? (
              <span style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.25)', borderRadius: '4px', padding: '2px 7px', color: '#00e5ff' }}>
                🎯 Assists: <strong>{assists}</strong>
              </span>
            ) : null}
          </div>
        )}

        {/* 1-10 Match Engine Skills */}
        <div style={{ padding: '6px 18px 16px 18px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '5px'
          }}>
            <span style={{ fontFamily: 'Orbitron', fontSize: '10.5px', fontWeight: 'bold', color: '#ffd700', letterSpacing: '0.8px' }}>
              PLAYER SKILLS (1–10 SCALE)
            </span>
            <span style={{ fontSize: '9.5px', color: hasExtractedSkills ? '#00ff64' : '#88929b' }}>
              {hasExtractedSkills ? 'DB Extracted' : 'Position Derived'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {skillRows.map(sk => {
              const effectiveVal = Math.max(1, Math.min(10, sk.val + fatigueMod));
              const barColor = getSkillBarColor(sk.val);
              return (
                <div key={sk.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '98px', fontSize: '11px', color: '#d0d8e4', flexShrink: 0 }}>
                    {sk.label}
                  </span>
                  <div style={{
                    flex: 1,
                    height: '8px',
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${sk.val * 10}%`,
                      height: '100%',
                      background: barColor,
                      boxShadow: sk.val >= 8 ? `0 0 8px ${barColor}66` : 'none',
                      transition: 'width 0.25s ease'
                    }} />
                  </div>
                  <span style={{
                    width: '44px',
                    textAlign: 'right',
                    fontFamily: 'Orbitron',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: barColor,
                    flexShrink: 0
                  }}>
                    {sk.val}
                    {fatigueMod < 0 && effectiveVal !== sk.val && (
                      <span style={{ color: '#ffa500', fontSize: '9px' }}> ({effectiveVal})</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
