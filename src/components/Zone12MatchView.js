import React from 'react';

const ZONE_COORDS = {
  a1: { left: '12%', top: '18%' },
  a2: { left: '10%', top: '50%' },
  a3: { left: '12%', top: '82%' },
  b1: { left: '36%', top: '18%' },
  b2: { left: '38%', top: '50%' },
  b3: { left: '36%', top: '82%' },
  c1: { left: '64%', top: '18%' },
  c2: { left: '62%', top: '50%' },
  c3: { left: '64%', top: '82%' },
  d1: { left: '88%', top: '18%' },
  d2: { left: '90%', top: '50%' },
  d3: { left: '88%', top: '82%' }
};

/**
 * Renders the clean animated football pitch (without visible zone boxes)
 * for the 12-Box Skills Engine. Roll details are shown under each team's
 * ZONE DUEL TOTAL panel.
 */
export default function Zone12MatchView({ lastZoneResult }) {
  const activeZone = lastZoneResult?.activeZone || 'b2';
  const ballCoord = ZONE_COORDS[activeZone] || ZONE_COORDS.b2;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Clean Animated Pitch (Boxes calculated internally, hidden on pitch) */}
      <div className="retro-tactical-pitch" style={{ position: 'relative' }}>
        <div className="pitch-goal-net net-left"></div>
        <div className="pitch-goal-net net-right"></div>

        <div
          className="glowing-football"
          style={{
            position: 'absolute',
            left: lastZoneResult ? ballCoord.left : '50%',
            top: lastZoneResult ? ballCoord.top : '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.45s ease, top 0.45s ease',
            zIndex: 5
          }}
        >
          ⚽
        </div>
      </div>
    </div>
  );
}
