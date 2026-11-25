import React from 'react';

/**
 * Shared popup modal for Team Instructions:
 * Mentality, Attacking Focus, Passing, Tackling, Pressing & Counter Attack.
 * Used in both Lineup / Pre-Match Tactics (FormationTactics) and live Match.
 */
export default function TeamInstructionsModal({
  isOpen,
  onClose,
  teamName = '',
  teamTactics = {},
  onUpdate,
  subtitle = ''
}) {
  if (!isOpen) return null;

  const groups = [
    {
      key: 'mentality',
      label: 'MENTALITY',
      hint: 'Controls team risk balance and match mentality',
      options: [
        { value: 'defense', label: '🛡️ Defensive', color: '#00e5ff' },
        { value: 'balanced', label: '⚖️ Normal', color: '#ffd700' },
        { value: 'attack', label: '⚔️ Attacking', color: '#ff4500' }
      ]
    },
    {
      key: 'attackingFocus',
      label: 'ATTACKING',
      hint: 'Mixed (Default): 33% Left / 33% Right / 34% Center • Left/Right/Center: 80% lane • Both Flanks: 50/50',
      options: [
        { value: 'mixed', label: '🎲 Mixed', color: '#00ff64' },
        { value: 'left', label: '⬅️ Left Flank', color: '#00e5ff' },
        { value: 'right', label: '➡️ Right Flank', color: '#00e5ff' },
        { value: 'center', label: '🎯 Center', color: '#ffd700' },
        { value: 'both_flanks', label: '↔️ Both Flanks', color: '#a855f7' }
      ]
    },
    {
      key: 'passing',
      label: 'PASSING',
      hint: 'Short: adjacent boxes (b1/b3/c1/c2/c3) • Long: deep boxes (d1/d2/d3 tackle duel)',
      options: [
        { value: 'short', label: '⚽ Short', color: '#00ff64' },
        { value: 'long', label: '🚀 Long', color: '#00e5ff' }
      ]
    },
    {
      key: 'tackling',
      label: 'TACKLING',
      hint: 'Saved team tackling intensity',
      options: [
        { value: 'easy', label: '🪶 Easy', color: '#00ff64' },
        { value: 'normal', label: '⚖️ Normal', color: '#ffd700' },
        { value: 'hard', label: '💥 Hard', color: '#ff4500' }
      ]
    },
    {
      key: 'pressing',
      label: 'PRESSING',
      hint: 'Saved high-pressing instruction',
      options: [
        { value: false, label: 'No', color: '#aaa' },
        { value: true, label: '🔥 Yes', color: '#ff9500' }
      ]
    },
    {
      key: 'counterAttack',
      label: 'COUNTER ATTACK',
      hint: 'Saved counter-attack instruction',
      options: [
        { value: false, label: 'No', color: '#aaa' },
        { value: true, label: '⚡ Yes', color: '#00e5ff' }
      ]
    }
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(4px)',
        zIndex: 100070,
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
          maxWidth: '520px',
          background: 'linear-gradient(160deg, #161822 0%, #0d0f16 100%)',
          border: '1.5px solid rgba(0, 229, 255, 0.45)',
          borderRadius: '14px',
          padding: '20px 22px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          gap: '13px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Orbitron', fontSize: '15px', color: '#00e5ff', letterSpacing: '1px' }}>
              ⚙️ TEAM INSTRUCTIONS
            </h3>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
              {subtitle || `Saved for ${teamName || 'your club'} & applied in Match Preview and 12-Box Engine`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: '#aaa',
              padding: '4px 9px',
              cursor: 'pointer',
              fontFamily: 'Orbitron',
              fontSize: '11px'
            }}
          >
            ✕
          </button>
        </div>

        {groups.map((group) => (
          <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Orbitron', fontSize: '11px', fontWeight: 'bold', color: '#ddd' }}>
                {group.label}
              </span>
              <span style={{ fontSize: '9.5px', color: '#777' }}>{group.hint}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {group.options.map((opt) => {
                const isSelected = teamTactics[group.key] === opt.value;
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => onUpdate && onUpdate({ [group.key]: opt.value })}
                    style={{
                      flex: 1,
                      minWidth: '88px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isSelected ? `1.5px solid ${opt.color}` : '1px solid rgba(255,255,255,0.12)',
                      background: isSelected ? `${opt.color}22` : 'rgba(255,255,255,0.03)',
                      color: isSelected ? opt.color : '#999',
                      fontFamily: 'Orbitron',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(0, 255, 100, 0.16)',
              border: '1.5px solid #00ff64',
              borderRadius: '8px',
              color: '#00ff64',
              fontFamily: 'Orbitron',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '8px 20px',
              cursor: 'pointer'
            }}
          >
            DONE ✓
          </button>
        </div>
      </div>
    </div>
  );
}
