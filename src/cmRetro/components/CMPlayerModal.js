import React from 'react';

function getStatClass(val) {
  if (val >= 16) return 'cm-stat-elite';
  if (val >= 12) return 'cm-stat-good';
  return 'cm-stat-normal';
}

function StatRow({ label, value }) {
  return (
    <div className="cm-attr-row">
      <span className="cm-attr-label">{label}</span>
      <span className={`cm-stat-num ${getStatClass(value || 0)}`}>{value || 0}</span>
    </div>
  );
}

export default function CMPlayerModal({ player, onClose }) {
  if (!player) return null;

  const a = player.attributes || {};
  const isGK = player.position === 'GK';

  return (
    <div className="cm-modal-overlay" onClick={onClose}>
      <div className="cm-modal-box" onClick={e => e.stopPropagation()}>
        <div className="cm-modal-header">
          <div>
            <h2 className="cm-modal-title">
              {player.squadNumber ? `#${player.squadNumber} ` : ''}{player.name}
            </h2>
            <div style={{ fontSize: '13px', color: '#40e0d0', marginTop: '4px' }}>
              Position: <strong>{player.position}</strong> ({(player.positions || []).join(', ')}) | Age: <strong>{player.age}</strong> | CA: <strong>{player.currentAbility}</strong>
            </div>
          </div>
          <button className="cm-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="cm-attr-grid">
          {/* TECHNICAL COLUMN */}
          <div className="cm-attr-col">
            <div className="cm-attr-col-title">Technical</div>
            <StatRow label="Finishing" value={a.finishing} />
            <StatRow label="Passing" value={a.passing} />
            <StatRow label="Tackling" value={a.tackling} />
            <StatRow label="Heading" value={a.heading} />
            <StatRow label="Dribbling" value={a.dribbling} />
            <StatRow label="Crossing" value={a.crossing} />
            <StatRow label="Long Shots" value={a.longShots} />
            <StatRow label="Marking" value={a.marking} />
            <StatRow label="Technique" value={a.technique} />
            <StatRow label="Free Kicks" value={a.freeKicks} />
            <StatRow label="Corners" value={a.corners} />
            <StatRow label="Penalties" value={a.penalties} />
          </div>

          {/* MENTAL COLUMN */}
          <div className="cm-attr-col">
            <div className="cm-attr-col-title">Mental</div>
            <StatRow label="Decisions" value={a.decisions} />
            <StatRow label="Positioning" value={a.positioning} />
            <StatRow label="Off The Ball" value={a.offTheBall} />
            <StatRow label="Anticipation" value={a.anticipation} />
            <StatRow label="Composure" value={a.bravery || a.composure} />
            <StatRow label="Work Rate" value={a.workRate} />
            <StatRow label="Teamwork" value={a.teamwork} />
            <StatRow label="Vision" value={a.vision} />
            <StatRow label="Consistency" value={a.consistency} />
            <StatRow label="Important Matches" value={a.importantMatches} />
            <StatRow label="Aggression" value={a.aggression} />
            <StatRow label="Dirtiness" value={a.dirtiness} />
          </div>

          {/* PHYSICAL COLUMN */}
          <div className="cm-attr-col">
            <div className="cm-attr-col-title">Physical</div>
            <StatRow label="Pace" value={a.pace} />
            <StatRow label="Acceleration" value={a.acceleration} />
            <StatRow label="Stamina" value={a.stamina} />
            <StatRow label="Strength" value={a.strength} />
            <StatRow label="Agility" value={a.agility} />
            <StatRow label="Balance" value={a.balance} />
            <StatRow label="Jumping" value={a.jumping} />
            <StatRow label="Natural Fitness" value={a.naturalFitness} />

            {/* GOALKEEPING (if GK) */}
            {isGK && (
              <>
                <div className="cm-attr-col-title" style={{ marginTop: '16px', color: '#ffaa00' }}>Goalkeeping</div>
                <StatRow label="Reflexes" value={a.reflexes} />
                <StatRow label="Handling" value={a.handling} />
                <StatRow label="One On Ones" value={a.oneOnOnes} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
