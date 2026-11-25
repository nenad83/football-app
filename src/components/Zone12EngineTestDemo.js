import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import '../assets/styles/Match.css';
import Zone12MatchView, { ZONE_COORDS } from './Zone12MatchView';
import { FORMATIONS, getFormationSlots, getIdealSlotPosition } from './FormationTactics';
import {
  getAvailableRolesForSlot,
  getAvailableInstructionsForSlot,
  getDefaultInstructionForSlot,
  DEFAULT_TEAM_TACTICS
} from '../utils/tacticalRoleEngine';
import {
  buildTeamZoneRoster,
  createZone12StepSession,
  advanceZone12SandboxStep
} from '../utils/zone12MatchEngine';

const HOME_PLAYER_NAMES = {
  GK: 'G. Buffon',
  DL: 'A. Benarrivo',
  DC: 'F. Cannavaro',
  DR: 'L. Thuram',
  DMC: 'M. Almeyda',
  ML: 'D. Fuser',
  MC: 'J. Veron',
  MR: 'S. Conceicao',
  AML: 'A. Ortega',
  AMC: 'H. Nakata',
  AMR: 'M. Di Vaio',
  ST: 'H. Crespo'
};

const AWAY_PLAYER_NAMES = {
  GK: 'F. Toldo',
  DL: 'G. Gresko',
  DC: 'I. Cordoba',
  DR: 'J. Zanetti',
  DMC: 'C. Zanetti',
  ML: 'C. Seedorf',
  MC: 'L. Di Biagio',
  MR: 'S. Dalmat',
  AML: 'A. Guglielminpietro',
  AMC: 'A. Recoba',
  AMR: 'M. Kallon',
  ST: 'C. Vieri'
};

/**
 * Generates an 11-player lineup synced to the chosen formation's slots.
 */
function buildDemoLineup(formationKey, isHome, skillBase = 7) {
  const slots = getFormationSlots(formationKey || '4-4-2');
  const namesMap = isHome ? HOME_PLAYER_NAMES : AWAY_PLAYER_NAMES;
  const countByPos = {};
  const lineup = {};

  slots.forEach((slot) => {
    const pos = getIdealSlotPosition(slot.role, slot.x, slot.y) || 'MC';
    countByPos[pos] = (countByPos[pos] || 0) + 1;
    const baseName = namesMap[pos] || pos;
    const name = countByPos[pos] > 1 ? `${baseName} ${countByPos[pos]}` : baseName;
    lineup[slot.id] = {
      name,
      position: pos,
      rating: skillBase,
      skills: {
        passing: skillBase,
        marking: skillBase,
        tackling: skillBase,
        dribbling: skillBase,
        crossing: skillBase,
        heading: skillBase,
        finishing: skillBase,
        longShots: skillBase,
        handling: skillBase
      }
    };
  });
  return { slots, lineup };
}

/**
 * Computes within-box (dx, dy) offsets so multiple teammates & opponents
 * sharing any A1..D3 box stay readable without overlapping.
 */
function getCircleOffset(indexInGroup, totalInGroup, isHome) {
  const teamShiftX = isHome ? -4.2 : 4.2;
  const cols = totalInGroup >= 3 ? 2 : 1;
  const colIdx = indexInGroup % cols;
  const rowIdx = Math.floor(indexInGroup / cols);
  const totalRows = Math.ceil(totalInGroup / cols);

  const subX = cols === 1 ? 0 : (colIdx === 0 ? -2.4 : 2.4);
  const subY = (rowIdx - (totalRows - 1) / 2) * 8.4;
  return { dx: teamShiftX + subX, dy: subY };
}

/**
 * Computes a concise hint showing where the ball moves from the CURRENT step
 * depending on whether the user picks Success, Hold, or Failure.
 */
function buildCurrentStepPreview({
  session,
  homeRoster,
  awayRoster,
  homeTeamTactics,
  awayTeamTactics,
  forceChannel,
  forceStep1Mode,
  forceActorInstruction
}) {
  if (session.phase === 'STEP_2' && session.step2Context) {
    const ctx = session.step2Context;
    const activeAction = forceActorInstruction !== 'auto' ? forceActorInstruction : ctx.defaultAction;
    if (activeAction === 'long_shot') {
      return {
        headline: `STEP 2 in [${ctx.secondZone.toUpperCase()}] • ${ctx.actor?.name} (LONG SHOT)`,
        line1: `⚽ Goal (+5): Screamer flies from [${ctx.secondZone.toUpperCase()}] into [${ctx.boxZone.toUpperCase()}]!`,
        line2: `🧤 Saved (< +5): Keeper holds shot — ${ctx.defendingSide.toUpperCase()} takes the ball!`
      };
    }
    if (ctx.mode === 'long_ball_uncontested') {
      return {
        headline: `STEP 2 in [${ctx.secondZone.toUpperCase()}] • ${ctx.actor?.name} (UNCONTESTED LONG BALL)`,
        line1: `✅ Advance: Moves ball 1 step into [${ctx.boxZone.toUpperCase()}] for Step 3 Finish.`,
        line2: `0 opposition defenders in [${ctx.secondZone.toUpperCase()}].`
      };
    }
    return {
      headline: `STEP 2 in [${ctx.secondZone.toUpperCase()}] • ${ctx.actor?.name} vs ${ctx.defender?.name} (${String(activeAction).toUpperCase().replace('_', ' ')})`,
      line1: `✅ Success: Ball moves 1 step [${ctx.secondZone.toUpperCase()} ➔ ${ctx.boxZone.toUpperCase()}] and stops at Step 3 Finish.`,
      line2: `❌ Failure: ${ctx.defender?.name} wins possession in [${ctx.secondZone.toUpperCase()}] — ${ctx.defendingSide.toUpperCase()} takes the ball!`
    };
  }

  if (session.phase === 'STEP_3' && session.step3Context) {
    const ctx = session.step3Context;
    const defLbl = ctx.is1v1Keeper
      ? (ctx.boxDef.gk?.name || 'GK')
      : `${ctx.boxDef.dc?.name || 'DC'} + ${ctx.boxDef.gk?.name || 'GK'}`;
    return {
      headline: `STEP 3 IN PENALTY BOX [${ctx.boxZone.toUpperCase()}] • ${ctx.finisher?.name} vs ${defLbl}`,
      line1: `⚽ GOAL (+3 diff): ${ctx.finisher?.name} scores! Opponent restarts from midfield.`,
      line2: `🧤 SAVED (< +3): ${defLbl} stops the shot — ${ctx.defendingSide.toUpperCase()} takes possession!`
    };
  }

  // STEP_1 Preview
  const side = session.possessionSide;
  const isHome = side === 'home';
  const attRoster = isHome ? homeRoster : awayRoster;
  const attTeamTactics = isHome ? homeTeamTactics : awayTeamTactics;
  const focus = forceChannel !== 'auto' ? forceChannel : (attTeamTactics?.attackingFocus || 'mixed');
  const isLong = forceStep1Mode !== 'gk_long' && attTeamTactics?.passing === 'long';
  const curZone = session.ballZone;
  const ownBox = isHome ? 'a2' : 'd2';
  const midZone = isHome ? 'b2' : 'c2';
  const isOwnFlankOrCorner = isHome
    ? ['a1', 'a3', 'b1', 'b3'].includes(curZone)
    : ['d1', 'd3', 'c1', 'c3'].includes(curZone);
  const isGkBall = Boolean(session.recycleState?.player?.effectivePos === 'GK') || (forceStep1Mode === 'gk_long');

  let targetDesc = isLong
    ? `${isHome ? 'D1/D2/D3 (1-box jump)' : 'A3/A2/A1 (1-box jump)'} (or turnover if empty / no AMC) and pauses at Step 2.`
    : `${isHome ? 'C1/C2/C3 (next box)' : 'B3/B2/B1 (next box)'} (or turnover if empty / no AMC) and pauses at Step 2.`;

  if (session.recycleState?.isRecovery && attTeamTactics?.counterAttack === true) {
    targetDesc = `⚡ COUNTER ATTACK (+2 IN STEP 2): Launches straight forward into ${isLong ? (isHome ? 'D1/D2/D3' : 'A3/A2/A1') : (isHome ? 'C1/C2/C3' : 'B3/B2/B1')} (like Long launch), skipping slow MC build-up!`;
  } else if (curZone === ownBox && !isGkBall) {
    targetDesc = `Pass [${curZone.toUpperCase()} ➔ ${midZone.toUpperCase()}] to MC (+5 if GK! If stolen inside [${curZone.toUpperCase()}], striker shoots STEP 3!).`;
  } else if (curZone === ownBox && isGkBall) {
    targetDesc = `GK Long Kick (+5 after save) [${curZone.toUpperCase()} ➔ ${isHome ? 'C1/C2/C3' : 'B1/B2/B3'}] (Tackle duel) ➔ Step 2!`;
  } else if (isOwnFlankOrCorner) {
    const upFlank = (isHome ? (curZone.endsWith('1') ? 'C1' : 'C3') : (curZone.endsWith('1') ? 'B1' : 'B3'));
    targetDesc = `Flank/Team logic: goes up flank [➔ ${upFlank}] if same-flank focus & receiver ahead; otherwise passes [➔ ${midZone.toUpperCase()}] to MC!`;
  }

  const holdTargets = isHome
    ? (session.ballZone === 'b2' ? 'B1 / B3 / A1 / A3 / A2' : 'A1 / A3 / A2 / B2')
    : (session.ballZone === 'c2' ? 'C1 / C3 / D1 / D3 / D2' : 'D1 / D3 / D2 / C2');

  return {
    headline: `STEP 1 IN [${session.ballZone.toUpperCase()}] • ${side.toUpperCase()} HAS THE BALL (${session.recycleState?.player?.name ? `${session.recycleState.player.name} • ` : ''}Focus: ${focus.toUpperCase()}, Passing: ${attTeamTactics?.passing?.toUpperCase() || 'SHORT'})`,
    line1: `✅ Success (+2/+4): ${targetDesc}`,
    line2: `🔄 Near Success (0/+1): Holds ball via lateral/back pass to [${holdTargets}] • ❌ Fail (-1): ${isHome ? 'AWAY' : 'HOME'} takes ball right in [${session.ballZone.toUpperCase()}] • ⚡ Counter (-2): Instant ${isHome ? 'AWAY' : 'HOME'} Step 2`,
    hasAmc: (attRoster.effectiveAmcs || []).length > 0
  };
}

export default function Zone12EngineTestDemo() {
  const formationKeys = Object.keys(FORMATIONS);

  const [homeFormation, setHomeFormation] = useState('4-4-2');
  const [awayFormation, setAwayFormation] = useState('4-2-3-1');
  const [homeSkillBase, setHomeSkillBase] = useState(7);
  const [awaySkillBase, setAwaySkillBase] = useState(7);

  const [homeTeamTactics, setHomeTeamTactics] = useState({ ...DEFAULT_TEAM_TACTICS });
  const [awayTeamTactics, setAwayTeamTactics] = useState({ ...DEFAULT_TEAM_TACTICS });

  const [homeRoles, setHomeRoles] = useState({});
  const [awayRoles, setAwayRoles] = useState({});
  const [homeInstructions, setHomeInstructions] = useState({});
  const [awayInstructions, setAwayInstructions] = useState({});

  const [forceChannel, setForceChannel] = useState('auto');
  const [forceStep1Mode, setForceStep1Mode] = useState('auto');
  const [forceActorInstruction, setForceActorInstruction] = useState('auto');

  const homeBuilt = useMemo(() => buildDemoLineup(homeFormation, true, homeSkillBase), [homeFormation, homeSkillBase]);
  const awayBuilt = useMemo(() => buildDemoLineup(awayFormation, false, awaySkillBase), [awayFormation, awaySkillBase]);

  const homeRoster = useMemo(
    () => buildTeamZoneRoster(homeBuilt.lineup, homeRoles, 'home', { name: 'Home XI' }, homeFormation, homeInstructions),
    [homeBuilt.lineup, homeRoles, homeFormation, homeInstructions]
  );
  const awayRoster = useMemo(
    () => buildTeamZoneRoster(awayBuilt.lineup, awayRoles, 'away', { name: 'Away XI' }, awayFormation, awayInstructions),
    [awayBuilt.lineup, awayRoles, awayFormation, awayInstructions]
  );

  const [session, setSession] = useState(() => createZone12StepSession({ possessionSide: 'home' }));
  const [lastZoneResult, setLastZoneResult] = useState(null);
  const [historyLog, setHistoryLog] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null); // { side, slotId }

  const stepPreview = useMemo(
    () => buildCurrentStepPreview({
      session,
      homeRoster,
      awayRoster,
      homeTeamTactics,
      awayTeamTactics,
      forceChannel,
      forceStep1Mode,
      forceActorInstruction
    }),
    [session, homeRoster, awayRoster, homeTeamTactics, awayTeamTactics, forceChannel, forceStep1Mode, forceActorInstruction]
  );

  const resetToSide = (side, nextStep1Mode = forceStep1Mode) => {
    const fresh = createZone12StepSession({
      possessionSide: side,
      homeRoster,
      awayRoster,
      forceStep1Mode: nextStep1Mode
    });
    setSession(fresh);
    setLastZoneResult(null);
    setHistoryLog([]);
  };

  const handleFormationChange = (side, nextFormation) => {
    if (side === 'home') {
      setHomeFormation(nextFormation);
      setHomeRoles({});
      setHomeInstructions({});
    } else {
      setAwayFormation(nextFormation);
      setAwayRoles({});
      setAwayInstructions({});
    }
    setSelectedPlayer(null);
    setSession(createZone12StepSession({ possessionSide: side }));
    setLastZoneResult(null);
  };

  const handleRoleChange = (side, slot, player, nextRole) => {
    const instrs = getAvailableInstructionsForSlot(slot, player, nextRole);
    const defaultInstr = getDefaultInstructionForSlot(slot, player, nextRole) || instrs[0]?.id || 'pass';
    const validInstrIds = instrs.map((i) => i.id);

    if (side === 'home') {
      setHomeRoles((prev) => ({ ...prev, [slot.id]: nextRole }));
      setHomeInstructions((prev) => ({
        ...prev,
        [slot.id]: validInstrIds.includes(prev[slot.id]) ? prev[slot.id] : defaultInstr
      }));
    } else {
      setAwayRoles((prev) => ({ ...prev, [slot.id]: nextRole }));
      setAwayInstructions((prev) => ({
        ...prev,
        [slot.id]: validInstrIds.includes(prev[slot.id]) ? prev[slot.id] : defaultInstr
      }));
    }
  };

  const handleInstructionChange = (side, slotId, nextInstr) => {
    if (side === 'home') {
      setHomeInstructions((prev) => ({ ...prev, [slotId]: nextInstr }));
    } else {
      setAwayInstructions((prev) => ({ ...prev, [slotId]: nextInstr }));
    }
  };

  const handleStep1ModeChange = (nextMode) => {
    setForceStep1Mode(nextMode);
    if (session.phase === 'STEP_1' && !session.recycleState) {
      setSession((prev) => createZone12StepSession({
        possessionSide: prev.possessionSide,
        homeRoster,
        awayRoster,
        forceStep1Mode: nextMode
      }));
    }
  };

  const handleStepDecision = (decision) => {
    const { session: nextSession, zoneResult } = advanceZone12SandboxStep({
      session,
      decision,
      homeLineup: homeBuilt.lineup,
      awayLineup: awayBuilt.lineup,
      homeRoles,
      awayRoles,
      homeInstructions,
      awayInstructions,
      homeTeamTactics,
      awayTeamTactics,
      homeFormation,
      awayFormation,
      homeTactic: homeTeamTactics.mentality,
      awayTactic: awayTeamTactics.mentality,
      homeTeam: { name: 'Home XI' },
      awayTeam: { name: 'Away XI' },
      forceChannel,
      forceStep1Mode,
      forceActorInstruction
    });

    setSession(nextSession);
    if (zoneResult) {
      setLastZoneResult(zoneResult);
    }
    if (nextSession.lastStepSummary) {
      setHistoryLog((prev) => [
        {
          id: `${Date.now()}-${prev.length}`,
          phase: session.phase,
          text: nextSession.lastStepSummary,
          turnoverTo: nextSession.turnoverSide,
          isGoal: Boolean(zoneResult?.isGoal)
        },
        ...prev
      ].slice(0, 12));
    }
  };

  // Show the ball at the turnover / finished spot right after a completed step, or at session.ballZone
  const displayedBallZone = useMemo(() => {
    if (lastZoneResult?.activeZone && (session.turnoverSide || session.phase !== 'STEP_1' || session.recycleState)) {
      return lastZoneResult.activeZone;
    }
    return session.ballZone || 'b2';
  }, [lastZoneResult, session.turnoverSide, session.phase, session.recycleState, session.ballZone]);

  // SVG arrow showing ONLY the last 1-step movement (e.g. B2 -> C1, or C1 -> D2)
  const arrowPoints = useMemo(() => {
    const raw = lastZoneResult?.zonePath && lastZoneResult.zonePath.length >= 2
      ? lastZoneResult.zonePath
      : [];
    const clean = [];
    raw.forEach((z) => {
      if (ZONE_COORDS[z] && clean[clean.length - 1] !== z) clean.push(z);
    });
    return clean.map((z) => ({
      zone: z,
      x: parseFloat(ZONE_COORDS[z].left),
      y: parseFloat(ZONE_COORDS[z].top)
    }));
  }, [lastZoneResult]);

  // Overlay rendered directly inside Zone12MatchView's pitch
  const pitchOverlay = (
    <>
      {arrowPoints.length >= 2 && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}
        >
          <defs>
            <marker id="z12-step-arrow" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill={lastZoneResult?.isGoal ? '#00ff88' : (session.turnoverSide ? '#ef4444' : '#00e5ff')} />
            </marker>
          </defs>
          {arrowPoints.slice(0, -1).map((pt, idx) => {
            const nxt = arrowPoints[idx + 1];
            return (
              <line
                key={`${pt.zone}-${nxt.zone}-${idx}`}
                x1={pt.x}
                y1={pt.y}
                x2={nxt.x}
                y2={nxt.y}
                stroke={lastZoneResult?.isGoal ? '#00ff88' : (session.turnoverSide ? '#ef4444' : '#00e5ff')}
                strokeWidth="0.95"
                strokeDasharray="2 1.2"
                markerEnd="url(#z12-step-arrow)"
                opacity="0.9"
              />
            );
          })}
        </svg>
      )}

      {/* Home (Blue) & Away (Orange) Circles */}
      {Object.keys(ZONE_COORDS).map((zoneId) => {
        const coord = ZONE_COORDS[zoneId];
        const baseX = parseFloat(coord.left);
        const baseY = parseFloat(coord.top);
        const hList = homeRoster.zonePlayers[zoneId] || [];
        const aList = awayRoster.zonePlayers[zoneId] || [];

        const renderTeamList = (list, isHomeSide) =>
          list.map((player, idx) => {
            const { dx, dy } = getCircleOffset(idx, list.length, isHomeSide);
            const leftPct = Math.max(4, Math.min(96, baseX + dx));
            const topPct = Math.max(8, Math.min(92, baseY + dy));
            const sideKey = isHomeSide ? 'home' : 'away';

            const activeCtx = session.phase === 'STEP_2' ? session.step2Context : (session.phase === 'STEP_3' ? session.step3Context : null);
            const pendingActorName = session.phase === 'STEP_2'
              ? activeCtx?.actor?.name
              : (session.phase === 'STEP_3' ? activeCtx?.finisher?.name : session.recycleState?.player?.name);
            const pendingDefName = session.phase === 'STEP_2'
              ? activeCtx?.defender?.name
              : (session.phase === 'STEP_3' ? activeCtx?.boxDef?.dc?.name : null);

            const isPendingActor = Boolean(pendingActorName && player.name === pendingActorName && session.attackingSide === sideKey);
            const isPendingDef = Boolean(pendingDefName && player.name === pendingDefName && session.attackingSide !== sideKey);
            const isSelected = Boolean(selectedPlayer?.side === sideKey && selectedPlayer?.slotId === player.slotId);

            const bg = isHomeSide
              ? 'radial-gradient(circle at 30% 30%, #38bdf8, #0284c7)'
              : 'radial-gradient(circle at 30% 30%, #fb923c, #ea580c)';
            const borderColor = isPendingActor
              ? '#00ff88'
              : (isPendingDef ? '#ff2a55' : (isSelected ? '#ffffff' : 'rgba(255,255,255,0.8)'));

            return (
              <button
                key={`${sideKey}-${player.slotId || player.name}`}
                type="button"
                onClick={() => setSelectedPlayer({ side: sideKey, slotId: player.slotId })}
                title={`${isHomeSide ? 'HOME' : 'AWAY'} • ${player.name} (${player.effectivePos}) | Box: ${zoneId.toUpperCase()} | Role: ${player.duty} | Instr: ${player.instruction}`}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: bg,
                  border: `2px solid ${borderColor}`,
                  boxShadow: isPendingActor
                    ? '0 0 12px #00ff88'
                    : (isPendingDef ? '0 0 12px #ff2a55' : '0 2px 5px rgba(0,0,0,0.75)'),
                  color: '#fff',
                  fontSize: '8.5px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: 'pointer',
                  zIndex: 4
                }}
              >
                <span>{player.effectivePos}</span>
                <span style={{
                  position: 'absolute',
                  top: '27px',
                  background: 'rgba(0,0,0,0.78)',
                  color: isHomeSide ? '#7dd3fc' : '#fdba74',
                  fontSize: '7.5px',
                  fontFamily: 'sans-serif',
                  padding: '0 3px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none'
                }}>
                  {player.name.split(' ').slice(-1)[0]}
                </span>
              </button>
            );
          });

        return (
          <React.Fragment key={zoneId}>
            {renderTeamList(hList, true)}
            {renderTeamList(aList, false)}
          </React.Fragment>
        );
      })}
    </>
  );

  const renderTeamPanel = (side) => {
    const isHome = side === 'home';
    const formation = isHome ? homeFormation : awayFormation;
    const tactics = isHome ? homeTeamTactics : awayTeamTactics;
    const setTactics = isHome ? setHomeTeamTactics : setAwayTeamTactics;
    const skillBase = isHome ? homeSkillBase : awaySkillBase;
    const setSkillBase = isHome ? setHomeSkillBase : setAwaySkillBase;
    const built = isHome ? homeBuilt : awayBuilt;
    const roster = isHome ? homeRoster : awayRoster;
    const rolesMap = isHome ? homeRoles : awayRoles;
    const instrMap = isHome ? homeInstructions : awayInstructions;
    const accent = isHome ? '#38bdf8' : '#fb923c';

    const slotZoneMap = {};
    Object.entries(roster.zonePlayers).forEach(([z, list]) => {
      list.forEach((p) => {
        if (p?.slotId) slotZoneMap[p.slotId] = z.toUpperCase();
      });
    });

    return (
      <div style={{
        background: 'rgba(10, 18, 30, 0.92)',
        border: `1.5px solid ${accent}`,
        borderRadius: '10px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontFamily: 'Orbitron', color: accent }}>
            {isHome ? '🔵 HOME XI (ATT ➔)' : '🔴 AWAY XI (⬅ ATT)'}
          </h3>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>Skills:</span>
            {[5, 7, 9].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSkillBase(lvl)}
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  borderRadius: '4px',
                  border: `1px solid ${skillBase === lvl ? accent : '#334155'}`,
                  background: skillBase === lvl ? 'rgba(255,255,255,0.12)' : '#0f172a',
                  color: skillBase === lvl ? '#fff' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            Formation
            <select
              value={formation}
              onChange={(e) => handleFormationChange(side, e.target.value)}
              style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
            >
              {formationKeys.map((fk) => (
                <option key={fk} value={fk}>{FORMATIONS[fk]?.label || fk}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            Mentality
            <select
              value={tactics.mentality}
              onChange={(e) => setTactics((p) => ({ ...p, mentality: e.target.value }))}
              style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
            >
              <option value="defense">Defensive</option>
              <option value="balanced">Balanced</option>
              <option value="attack">Attacking</option>
            </select>
          </label>
          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            Attacking Focus
            <select
              value={tactics.attackingFocus}
              onChange={(e) => setTactics((p) => ({ ...p, attackingFocus: e.target.value }))}
              style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
            >
              <option value="mixed">Mixed (33% L / 33% R / 34% C)</option>
              <option value="both_flanks">Both Flanks (50/50)</option>
              <option value="left">Left Flank (80%)</option>
              <option value="right">Right Flank (80%)</option>
              <option value="center">Center (80% AMC)</option>
            </select>
          </label>
          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            Passing Style
            <select
              value={tactics.passing}
              onChange={(e) => setTactics((p) => ({ ...p, passing: e.target.value }))}
              style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
            >
              <option value="short">Short (Border Box)</option>
              <option value="long">Long (Jump 1 Box)</option>
            </select>
          </label>
          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            Tackling
            <select
              value={tactics.tackling || 'normal'}
              onChange={(e) => setTactics((p) => ({ ...p, tackling: e.target.value }))}
              style={{ background: '#0f172a', color: tactics.tackling === 'hard' ? '#fca5a5' : (tactics.tackling === 'easy' ? '#86efac' : '#fff'), border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
            >
              <option value="easy">Easy (-1 / Low Foul)</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard (+1 / Card & Pen 💥)</option>
            </select>
          </label>
          <label style={{ fontSize: '10px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            Counter Attack
            <select
              value={tactics.counterAttack ? 'yes' : 'no'}
              onChange={(e) => setTactics((p) => ({ ...p, counterAttack: e.target.value === 'yes' }))}
              style={{ background: '#0f172a', color: tactics.counterAttack ? '#67e8f9' : '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '11px' }}
            >
              <option value="no">No (Build via MC)</option>
              <option value="yes">⚡ Yes (+2 Fast Counter)</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
          {built.slots.map((slot) => {
            const player = built.lineup[slot.id];
            const roles = getAvailableRolesForSlot(slot, player);
            const activeRole = rolesMap[slot.id] || roles[0]?.id || 'normal';
            const instrs = getAvailableInstructionsForSlot(slot, player, activeRole);
            const activeInstr = instrMap[slot.id] || getDefaultInstructionForSlot(slot, player, activeRole) || instrs[0]?.id || 'pass';
            const isFocused = selectedPlayer?.side === side && selectedPlayer?.slotId === slot.id;
            const liveBox = slotZoneMap[slot.id] || '?';

            return (
              <div
                key={slot.id}
                onClick={() => setSelectedPlayer({ side, slotId: slot.id })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 1fr',
                  gap: '4px',
                  alignItems: 'center',
                  padding: '4px 6px',
                  borderRadius: '5px',
                  background: isFocused ? 'rgba(255,255,255,0.12)' : 'rgba(15, 23, 42, 0.75)',
                  border: `1px solid ${isFocused ? accent : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: '10px', lineHeight: 1.15 }}>
                  <div style={{ fontWeight: 'bold', color: accent }}>
                    {player.position} <span style={{ color: '#ffd700' }}>[{liveBox}]</span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {player.name.split(' ').slice(-1)[0]}
                  </div>
                </div>

                <select
                  value={activeRole}
                  onChange={(e) => handleRoleChange(side, slot, player, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: '#020617', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '4px', padding: '2px 4px', fontSize: '10px' }}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.shortLabel || r.label}</option>
                  ))}
                </select>

                <select
                  value={activeInstr}
                  onChange={(e) => handleInstructionChange(side, slot.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ background: '#020617', color: '#ffd700', border: '1px solid #334155', borderRadius: '4px', padding: '2px 4px', fontSize: '10px' }}
                >
                  {instrs.map((ins) => (
                    <option key={ins.id} value={ins.id}>{ins.shortLabel || ins.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const activeStep2Action = forceActorInstruction !== 'auto'
    ? forceActorInstruction
    : session.step2Context?.defaultAction;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #0c1f33 0%, #050b14 70%)',
      color: '#e2e8f0',
      padding: '14px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        maxWidth: '1500px',
        margin: '0 auto 12px auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '10px 14px',
        background: 'rgba(10, 18, 30, 0.9)',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        borderRadius: '10px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontFamily: 'Orbitron', color: '#ffd700' }}>
            🧪 12-BOX ENGINE STEP-BY-STEP SANDBOX
          </h1>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            One click = ONE step only (Step 1 ➔ Step 2 ➔ Step 3). See exactly where the ball moves and when the opponent takes over.
          </div>
        </div>
        <NavLink
          to="/"
          style={{
            padding: '7px 14px',
            borderRadius: '6px',
            border: '1px solid #00e5ff',
            color: '#00e5ff',
            textDecoration: 'none',
            fontFamily: 'Orbitron',
            fontSize: '11px',
            fontWeight: 'bold'
          }}
        >
          ⬅ BACK TO MENU
        </NavLink>
      </div>

      <div style={{
        maxWidth: '1500px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(270px, 320px) minmax(440px, 1fr) minmax(270px, 320px)',
        gap: '12px',
        alignItems: 'start'
      }}>
        {renderTeamPanel('home')}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{
            background: 'rgba(10, 18, 30, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '10px',
            padding: '10px'
          }}>
            <Zone12MatchView
              lastZoneResult={lastZoneResult}
              homeTeamName="Home XI"
              awayTeamName="Away XI"
              pitchOverlay={pitchOverlay}
              forcedDisplayZone={displayedBallZone}
            />

            {/* Phase Progress Pill Strip */}
            <div style={{
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {['STEP_1', 'STEP_2', 'STEP_3'].map((ph) => {
                  const active = session.phase === ph;
                  return (
                    <span
                      key={ph}
                      style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontFamily: 'Orbitron',
                        borderRadius: '4px',
                        border: `1px solid ${active ? '#00ff88' : '#334155'}`,
                        background: active ? 'rgba(0,255,136,0.18)' : '#0f172a',
                        color: active ? '#00ff88' : '#64748b',
                        fontWeight: active ? 'bold' : 'normal'
                      }}
                    >
                      {ph.replace('_', ' ')}
                    </span>
                  );
                })}
                <span style={{ fontSize: '11px', color: session.possessionSide === 'home' ? '#38bdf8' : '#fb923c', fontWeight: 'bold' }}>
                  • {session.possessionSide.toUpperCase()} POSSESSION
                </span>
                {session.cards && session.cards.length > 0 && (
                  <span style={{ fontSize: '11px', color: '#fde047', fontWeight: 'bold' }}>
                    • Cards: {session.cards.filter((c) => c.type === 'yellow').length}🟨 {session.cards.filter((c) => c.type === 'red' || c.type === 'second_yellow').length}🟥
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                <span style={{ color: '#00ff88' }}>◉ Active Actor</span> &nbsp;
                <span style={{ color: '#ff2a55' }}>◉ Defender</span>
              </div>
            </div>
          </div>

          {/* Step-by-Step Decision Controls */}
          <div style={{
            background: 'rgba(10, 18, 30, 0.92)',
            border: `1.5px solid ${session.possessionSide === 'home' ? '#38bdf8' : '#fb923c'}`,
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#cbd5e1' }}>START / RESET:</span>
                <button
                  type="button"
                  onClick={() => resetToSide('home')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '5px',
                    border: `1.5px solid ${session.possessionSide === 'home' ? '#38bdf8' : '#334155'}`,
                    background: session.possessionSide === 'home' ? 'rgba(56,189,248,0.22)' : '#0f172a',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  🔵 HOME [B2]
                </button>
                <button
                  type="button"
                  onClick={() => resetToSide('away')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '5px',
                    border: `1.5px solid ${session.possessionSide === 'away' ? '#fb923c' : '#334155'}`,
                    background: session.possessionSide === 'away' ? 'rgba(251,146,60,0.22)' : '#0f172a',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  🔴 AWAY [C2]
                </button>
              </div>
              {session.turnoverSide && (
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(239, 68, 68, 0.18)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#fca5a5',
                  fontSize: '10px',
                  fontWeight: 'bold'
                }}>
                  🔄 POSSESSION FLIPPED TO {session.turnoverSide.toUpperCase()}!
                </span>
              )}
            </div>

            {session.recycleState && (
              <div style={{
                padding: '5px 8px',
                borderRadius: '5px',
                background: 'rgba(255, 215, 0, 0.14)',
                border: '1px solid rgba(255, 215, 0, 0.45)',
                color: '#fde047',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                🔄 RECYCLED HOLD: {session.recycleState.side.toUpperCase()} kept possession with {session.recycleState.player?.name} in [{session.recycleState.zone?.toUpperCase()}]. Next pass starts here!
              </div>
            )}

            {/* Channel & Action Modifiers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                Target Channel
                <select value={forceChannel} onChange={(e) => setForceChannel(e.target.value)} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '10px' }}>
                  <option value="auto">Auto (Team Focus %)</option>
                  <option value="left">Left Flank</option>
                  <option value="center">Center</option>
                  <option value="right">Right Flank</option>
                </select>
              </label>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                Step 1 Pass Type
                <select value={forceStep1Mode} onChange={(e) => handleStep1ModeChange(e.target.value)} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '10px' }}>
                  <option value="auto">Auto (GK/MC Instr)</option>
                  <option value="mid_pass">Mid Short/Long (+2)</option>
                  <option value="mid_through">Through Ball (+4)</option>
                  <option value="gk_long">GK Long Kick</option>
                </select>
              </label>
              <label style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                Step 2 Actor Action
                <select value={forceActorInstruction} onChange={(e) => setForceActorInstruction(e.target.value)} style={{ background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: '4px', padding: '4px', fontSize: '10px' }}>
                  <option value="auto">Auto (Slot Instr)</option>
                  <option value="pass">Pass</option>
                  <option value="through_ball">Through Ball (+3)</option>
                  <option value="high_cross">High Cross</option>
                  <option value="low_cross">Low Cross</option>
                  <option value="dribble">Dribble (1v1)</option>
                  <option value="long_shot">Long Shot</option>
                </select>
              </label>
            </div>

            {/* Dynamic Decision Buttons Based on Current Step */}
            {session.phase === 'STEP_1' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                <button type="button" onClick={() => handleStepDecision('success_2')} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.22)', color: '#86efac', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  ✅ SUCCESS (+2) ➔ STEP 2
                </button>
                <button type="button" onClick={() => handleStepDecision('success_4')} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #00e5ff', background: 'rgba(0,229,255,0.22)', color: '#67e8f9', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  🗡️ BIG SUCCESS (+4)
                </button>
                <button type="button" onClick={() => handleStepDecision('hold_0_1')} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #eab308', background: 'rgba(234,179,8,0.22)', color: '#fde047', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  🔄 HOLD (0 / +1)
                </button>
                <button type="button" onClick={() => handleStepDecision('fail_1')} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #f97316', background: 'rgba(249,115,22,0.22)', color: '#fdba74', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  ❌ FAILURE (-1 OPP BALL)
                </button>
                <button type="button" onClick={() => handleStepDecision('counter_2')} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.22)', color: '#fca5a5', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  ⚡ COUNTER (-2)
                </button>
                <button type="button" onClick={() => handleStepDecision('random')} style={{ padding: '9px', borderRadius: '6px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.22)', color: '#e9d5ff', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}>
                  🎲 REAL D10 STEP 1
                </button>
              </div>
            )}

            {session.phase === 'STEP_2' && session.step2Context?.mode === 'long_ball_uncontested' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
                <button type="button" onClick={() => handleStepDecision('success')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.25)', color: '#86efac', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  🚀 COLLECT UNCONTESTED LONG BALL ➔ STEP 3 BOX [{session.step2Context.boxZone?.toUpperCase()}]
                </button>
              </div>
            )}

            {session.phase === 'STEP_2' && session.step2Context?.mode !== 'long_ball_uncontested' && activeStep2Action === 'long_shot' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                <button type="button" onClick={() => handleStepDecision('goal')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.25)', color: '#86efac', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  ⚽ SCREAMER GOAL (+5)
                </button>
                <button type="button" onClick={() => handleStepDecision('save')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.25)', color: '#fca5a5', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  🧤 SAVED (OPP BALL)
                </button>
                <button type="button" onClick={() => handleStepDecision('random')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.25)', color: '#e9d5ff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  🎲 REAL D10 SHOT
                </button>
              </div>
            )}

            {session.phase === 'STEP_2' && session.step2Context?.mode !== 'long_ball_uncontested' && activeStep2Action !== 'long_shot' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                <button type="button" onClick={() => handleStepDecision('success')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.25)', color: '#86efac', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  ✅ SUCCESS ➔ STEP 3 BOX
                </button>
                <button type="button" onClick={() => handleStepDecision('fail')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ef4444', background: 'rgba(239,68,68,0.25)', color: '#fca5a5', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  ❌ FAILURE (OPP TAKES BALL)
                </button>
                <button type="button" onClick={() => handleStepDecision('random')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.25)', color: '#e9d5ff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  🎲 REAL D10 STEP 2
                </button>
              </div>
            )}

            {session.phase === 'STEP_3' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
                <button type="button" onClick={() => handleStepDecision('goal')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.25)', color: '#86efac', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  ⚽ GOAL! (+3 DIFF)
                </button>
                <button type="button" onClick={() => handleStepDecision('save')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #f97316', background: 'rgba(249,115,22,0.25)', color: '#fdba74', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  🧤 SAVED (OPP BALL)
                </button>
                <button type="button" onClick={() => handleStepDecision('random')} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #a855f7', background: 'rgba(168,85,247,0.25)', color: '#e9d5ff', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>
                  🎲 REAL D10 FINISH
                </button>
              </div>
            )}
          </div>

          {/* Current Decision Preview & Step-by-Step History */}
          <div style={{
            background: 'rgba(10, 18, 30, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '12px'
          }}>
            <div style={{ fontFamily: 'Orbitron', fontSize: '11px', color: '#ffd700' }}>
              📍 {stepPreview.headline}
            </div>
            <div style={{ color: '#86efac' }}>{stepPreview.line1}</div>
            <div style={{ color: '#fdba74' }}>{stepPreview.line2}</div>

            {historyLog.length > 0 && (
              <div style={{ marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
                  STEP-BY-STEP LOG (NEWEST FIRST)
                </div>
                {historyLog.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '5px 8px',
                      marginBottom: '4px',
                      borderRadius: '5px',
                      background: 'rgba(2, 6, 23, 0.75)',
                      borderLeft: `3px solid ${entry.isGoal ? '#22c55e' : (entry.turnoverTo ? '#ef4444' : '#00e5ff')}`,
                      fontSize: '11.5px',
                      color: '#f8fafc'
                    }}
                  >
                    <span style={{ fontFamily: 'Orbitron', fontSize: '9.5px', color: '#94a3b8', marginRight: '6px' }}>
                      [{entry.phase.replace('_', ' ')}]
                    </span>
                    {entry.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {renderTeamPanel('away')}
      </div>
    </div>
  );
}
