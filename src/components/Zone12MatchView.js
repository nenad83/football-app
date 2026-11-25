import React, { useEffect, useRef, useState } from 'react';

export const ZONE_COORDS = {
  a1: { left: '12%', top: '18%', col: 0, row: 0 },
  a2: { left: '10%', top: '50%', col: 0, row: 1 },
  a3: { left: '12%', top: '82%', col: 0, row: 2 },
  b1: { left: '36%', top: '18%', col: 1, row: 0 },
  b2: { left: '38%', top: '50%', col: 1, row: 1 },
  b3: { left: '36%', top: '82%', col: 1, row: 2 },
  c1: { left: '64%', top: '18%', col: 2, row: 0 },
  c2: { left: '62%', top: '50%', col: 2, row: 1 },
  c3: { left: '64%', top: '82%', col: 2, row: 2 },
  d1: { left: '88%', top: '18%', col: 3, row: 0 },
  d2: { left: '90%', top: '50%', col: 3, row: 1 },
  d3: { left: '88%', top: '82%', col: 3, row: 2 }
};

const COL_LETTERS = ['a', 'b', 'c', 'd'];

/**
 * Builds a clean box-by-box visual queue from `fromZone` through `targetZones`.
 * Adjacent transitions step 1 column/row at a time; intentional long passes
 * (GK long kicks `a2 -> c*` or team long passes `b2 -> d*`) jump 1 column directly.
 */
export function buildBoxStepPath(fromZone, targetZones = [], isLongJump = false) {
  const cleanTargets = (targetZones || []).filter((z) => ZONE_COORDS[z]);
  if (cleanTargets.length === 0) return fromZone && ZONE_COORDS[fromZone] ? [fromZone] : ['b2'];

  const steps = [];
  let cursor = ZONE_COORDS[fromZone] ? fromZone : cleanTargets[0];

  const appendAdjacentWalk = (target) => {
    if (!ZONE_COORDS[target] || target === cursor) {
      if (steps[steps.length - 1] !== target) steps.push(target);
      cursor = target;
      return;
    }
    let guard = 0;
    while (cursor !== target && guard < 8) {
      guard += 1;
      const cur = ZONE_COORDS[cursor];
      const dst = ZONE_COORDS[target];
      const nextCol = cur.col + Math.sign(dst.col - cur.col);
      const nextRow = cur.row + Math.sign(dst.row - cur.row);
      const nextZone = `${COL_LETTERS[nextCol]}${nextRow + 1}`;
      if (nextZone !== cursor && steps[steps.length - 1] !== nextZone) {
        steps.push(nextZone);
      }
      cursor = nextZone;
    }
  };

  cleanTargets.forEach((target, idx) => {
    const isFinalPass = idx === cleanTargets.length - 1;
    if (isLongJump && isFinalPass) {
      // Intentional long pass jumps directly from startZone (e.g. a2->c2 or b2->d2)
      if (steps[steps.length - 1] !== target) steps.push(target);
      cursor = target;
    } else {
      appendAdjacentWalk(target);
    }
  });

  return steps.length > 0 ? steps : [cleanTargets[cleanTargets.length - 1]];
}

/**
 * Renders the animated 12-Box football pitch with Home/Away goal orientation,
 * subtle 12-box dividers, and box-by-box (or 1-box-jump on long passes) ball animation.
 */
export default function Zone12MatchView({
  lastZoneResult,
  homeTeamName = 'Home',
  awayTeamName = 'Away',
  pitchOverlay = null,
  forcedDisplayZone = null
}) {
  const [displayZone, setDisplayZone] = useState('b2');
  const displayZoneRef = useRef('b2');
  const timersRef = useRef([]);

  useEffect(() => {
    displayZoneRef.current = displayZone;
  }, [displayZone]);

  useEffect(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];

    if (forcedDisplayZone && ZONE_COORDS[forcedDisplayZone]) {
      setDisplayZone(forcedDisplayZone);
      return;
    }

    if (!lastZoneResult) {
      setDisplayZone('b2');
      return;
    }

    const activeZone = lastZoneResult.activeZone || 'b2';
    const currentSteps = Array.isArray(lastZoneResult.steps) ? lastZoneResult.steps : [];
    const lastStep = currentSteps[currentSteps.length - 1];
    const phase = String(lastStep?.phase || '');
    const isLongJump =
      phase.includes('GK LONG') ||
      phase.includes('LONG BALL');

    let targetPath;
    if (currentSteps.length <= 1) {
      // Step 1: ensure ball travels from previous spot -> startZone -> secondZone (if passed)
      const sZone = lastZoneResult.startZone || activeZone;
      targetPath = activeZone !== sZone ? [sZone, activeZone] : [activeZone];
    } else {
      targetPath = [activeZone];
    }

    const queue = buildBoxStepPath(displayZoneRef.current, targetPath, isLongJump);
    if (queue.length === 1) {
      setDisplayZone(queue[0]);
      return;
    }

    queue.forEach((zoneId, idx) => {
      const tid = setTimeout(() => {
        setDisplayZone(zoneId);
      }, idx * 240);
      timersRef.current.push(tid);
    });

    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, [lastZoneResult, forcedDisplayZone]);

  const ballCoord = ZONE_COORDS[displayZone] || ZONE_COORDS.b2;
  const attSide = lastZoneResult?.attackingSide;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Clear Left/Right Goal & Attack Direction Strip */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '6px',
        background: 'rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '9px',
        fontFamily: 'Orbitron',
        gap: '6px'
      }}>
        <span style={{ color: attSide === 'home' ? '#00ff88' : '#cbd5e1', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          🥅 {homeTeamName} (DEF LEFT • ATT ➔)
        </span>
        <span style={{
          padding: '1px 7px',
          borderRadius: '4px',
          background: 'rgba(0, 229, 255, 0.14)',
          border: '1px solid rgba(0, 229, 255, 0.35)',
          color: '#00e5ff',
          fontWeight: 'bold',
          flexShrink: 0
        }}>
          ZONE: {displayZone.toUpperCase()}
        </span>
        <span style={{ color: attSide === 'away' ? '#00ff88' : '#cbd5e1', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
          (⬅ ATT • DEF RIGHT) {awayTeamName} 🥅
        </span>
      </div>

      {/* Animated Pitch with subtle 12-Box grid lines & GK side markers */}
      <div className="retro-tactical-pitch" style={{ position: 'relative' }}>
        <div className="pitch-goal-net net-left"></div>
        <div className="pitch-goal-net net-right"></div>

        {/* Faint 4x3 12-Box grid */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          pointerEvents: 'none',
          zIndex: 1
        }}>
          {['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'C3', 'D3'].map((lbl) => (
            <div
              key={lbl}
              style={{
                border: '1px dashed rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                padding: '3px 5px'
              }}
            >
              <span style={{ fontSize: '7.5px', fontFamily: 'Orbitron', color: 'rgba(255,255,255,0.22)' }}>
                {lbl}
              </span>
            </div>
          ))}
        </div>

        {/* Home & Away GK Labels */}
        <span style={{
          position: 'absolute',
          left: '14px',
          bottom: '6px',
          fontSize: '8px',
          fontFamily: 'Orbitron',
          color: 'rgba(255,255,255,0.65)',
          background: 'rgba(0,0,0,0.45)',
          padding: '1px 5px',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 2
        }}>
          🥅 {homeTeamName} GK
        </span>
        <span style={{
          position: 'absolute',
          right: '14px',
          bottom: '6px',
          fontSize: '8px',
          fontFamily: 'Orbitron',
          color: 'rgba(255,255,255,0.65)',
          background: 'rgba(0,0,0,0.45)',
          padding: '1px 5px',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 2
        }}>
          {awayTeamName} GK 🥅
        </span>

        {pitchOverlay}

        <div
          className="glowing-football"
          style={{
            position: 'absolute',
            left: ballCoord.left,
            top: ballCoord.top,
            transform: 'translate(-50%, -50%)',
            transition: 'left 0.25s ease, top 0.25s ease',
            zIndex: 5
          }}
        >
          ⚽
        </div>
      </div>
    </div>
  );
}
