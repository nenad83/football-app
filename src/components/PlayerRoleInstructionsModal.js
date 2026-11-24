import React from 'react';
import {
  getAvailableRolesForSlot,
  getAvailableInstructionsForSlot,
  getDefaultInstructionForSlot
} from '../utils/tacticalRoleEngine';

export function PlayerRoleInstructionsModal({
  isOpen,
  onClose,
  player,
  slot,
  currentRoleId = 'normal',
  currentInstructionId,
  onSelectRole,
  onSelectInstruction,
  teamColor = '#00ff88'
}) {
  if (!isOpen || !player || !slot) return null;

  const availableRoles = getAvailableRolesForSlot(slot, player);
  const activeRole = availableRoles.find(r => r.id === currentRoleId) || availableRoles[0];
  const availableInstructions = getAvailableInstructionsForSlot(slot, player, activeRole?.id || 'normal');
  const defaultInstrId = getDefaultInstructionForSlot(slot, player, activeRole?.id || 'normal');
  const activeInstrId = currentInstructionId && availableInstructions.some(i => i.id === currentInstructionId)
    ? currentInstructionId
    : defaultInstrId;

  const sk = player.skills || {};
  const posLabel = slot.label || player.position || 'P';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100050,
        background: 'rgba(2, 6, 15, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(165deg, rgba(10, 22, 42, 0.98) 0%, rgba(5, 11, 22, 0.99) 100%)',
          border: `1px solid ${teamColor}66`,
          borderRadius: '14px',
          boxShadow: `0 20px 50px rgba(0, 0, 0, 0.85), 0 0 24px ${teamColor}22`,
          color: '#f8fafc',
          padding: '18px 20px',
          fontFamily: "'Inter', 'Segoe UI', sans-serif"
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '12px',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span
              style={{
                background: 'rgba(0, 255, 136, 0.14)',
                border: '1px solid rgba(0, 255, 136, 0.45)',
                color: '#00ff88',
                fontWeight: 900,
                fontSize: '0.78rem',
                padding: '4px 9px',
                borderRadius: '6px',
                letterSpacing: '0.6px',
                flexShrink: 0
              }}
            >
              {posLabel}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 900,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {player.fullName || player.name}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.6)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ color: '#ffd700', fontWeight: 800 }}>★ {player.rating || 5}</span>
                {player.position && <span>Nat Pos: <strong style={{ color: '#cbd5e1' }}>{player.position}</strong></span>}
                {typeof player.condition === 'number' && (
                  <span>Cond: <strong style={{ color: player.condition >= 80 ? '#00ff88' : '#ffcc00' }}>{Math.round(player.condition)}%</strong></span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>

        {/* Key Relevant Skills Pill Bar */}
        {Object.keys(sk).length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '8px 10px',
              marginBottom: '14px',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px',
              fontSize: '0.68rem'
            }}
          >
            {[
              ['PAS', sk.passing],
              ['DRI', sk.dribbling],
              ['CRO', sk.crossing],
              ['FIN', sk.finishing],
              ['HEA', sk.heading],
              ['TAC', sk.tackling],
              ['MAR', sk.marking],
              ['LSH', sk.longShots],
              ['HAN', sk.handling]
            ]
              .filter(([, val]) => typeof val === 'number')
              .map(([k, val]) => (
                <span
                  key={k}
                  style={{
                    padding: '2px 7px',
                    borderRadius: '5px',
                    background: val >= 8 ? 'rgba(0,255,136,0.14)' : 'rgba(255,255,255,0.05)',
                    border: val >= 8 ? '1px solid rgba(0,255,136,0.35)' : '1px solid rgba(255,255,255,0.1)',
                    color: val >= 8 ? '#00ff88' : '#cbd5e1',
                    fontWeight: 700
                  }}
                >
                  {k}: <strong style={{ color: '#fff' }}>{val}</strong>
                </span>
              ))}
          </div>
        )}

        {/* Section 1: Tactical Role / Duty */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 900,
              letterSpacing: '1px',
              color: '#00e5ff',
              textTransform: 'uppercase',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>1. Tactical Role & Zone Movement</span>
            <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              {availableRoles.length > 1 ? 'Click to switch role' : 'Fixed position role'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {availableRoles.map((role) => {
              const isSelected = role.id === activeRole?.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => {
                    if (onSelectRole) onSelectRole(slot.id, role.id, player, slot);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    cursor: availableRoles.length > 1 ? 'pointer' : 'default',
                    background: isSelected
                      ? `linear-gradient(90deg, ${role.color}26 0%, rgba(15,23,42,0.85) 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? `1.5px solid ${role.color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: `${role.color}25`,
                          border: `1px solid ${role.color}`,
                          color: role.color,
                          fontSize: '0.66rem',
                          fontWeight: 900,
                          letterSpacing: '0.5px'
                        }}
                      >
                        {role.shortLabel}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.84rem', color: isSelected ? '#fff' : '#cbd5e1' }}>
                        {role.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.35 }}>
                      {role.desc}
                    </div>
                  </div>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: isSelected ? `5px solid ${role.color}` : '2px solid rgba(255,255,255,0.25)',
                      flexShrink: 0
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Individual Instructions */}
        <div>
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 900,
              letterSpacing: '1px',
              color: '#ffd700',
              textTransform: 'uppercase',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>2. Individual Match Instruction (12-Box Engine)</span>
            <span style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
              Dice & Skill Action
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {availableInstructions.map((instr) => {
              const isSelected = instr.id === activeInstrId;
              return (
                <button
                  key={instr.id}
                  type="button"
                  onClick={() => {
                    if (onSelectInstruction) onSelectInstruction(slot.id, instr.id, player, slot);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '11px 12px',
                    borderRadius: '9px',
                    cursor: 'pointer',
                    background: isSelected
                      ? `linear-gradient(90deg, ${instr.color}28 0%, rgba(15,23,42,0.9) 100%)`
                      : 'rgba(255,255,255,0.03)',
                    border: isSelected
                      ? `1.5px solid ${instr.color}`
                      : '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.95rem' }}>{instr.icon || '⚡'}</span>
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: `${instr.color}25`,
                          border: `1px solid ${instr.color}`,
                          color: instr.color,
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          letterSpacing: '0.5px'
                        }}
                      >
                        {instr.shortLabel}
                      </span>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isSelected ? '#fff' : '#e2e8f0' }}>
                        {instr.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.4 }}>
                      {instr.desc}
                    </div>
                  </div>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: isSelected ? `5px solid ${instr.color}` : '2px solid rgba(255,255,255,0.25)',
                      flexShrink: 0
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00ff88 0%, #00b8ff 100%)',
              border: 'none',
              color: '#04101f',
              fontWeight: 900,
              fontSize: '0.78rem',
              letterSpacing: '0.6px',
              cursor: 'pointer'
            }}
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
export default PlayerRoleInstructionsModal;
