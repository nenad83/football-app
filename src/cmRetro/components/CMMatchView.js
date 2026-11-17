import React, { useState, useEffect, useRef, useCallback } from 'react';
import CM0102Engine from '../engine/CM0102Engine';
import { buildOptimalLineup } from '../utils/lineupHelper';
import CMPlayerModal from './CMPlayerModal';

/**
 * Helper to ensure readable text contrast against any club's primary kit color
 */
function getContrastText(hexColor, fallback = '#ffffff') {
  if (!hexColor || !hexColor.startsWith('#') || hexColor.length < 7) return fallback;
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 155 ? '#06131c' : '#ffffff';
}

export default function CMMatchView({
  userTeamName,
  userTactics,
  userFormation = '4-4-2',
  userStarters,
  userBench = [],
  allTeams,
  allSquads
}) {
  // Default opponent: Manchester United if user is not Man Utd, otherwise Arsenal
  const defaultOpponent =
    allTeams.find(t => t.name === 'Manchester United' && t.name !== userTeamName) ||
    allTeams.find(t => t.name !== userTeamName) ||
    allTeams[0];

  const [opponentName, setOpponentName] = useState(defaultOpponent.name);
  const [venueSide, setVenueSide] = useState('home'); // 'home' = User at Home, 'away' = User Away

  // Engine & Match Playback State
  const [engine, setEngine] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.75x, 1x (Authentic CM), 2x, 4x
  const [matchState, setMatchState] = useState(null);
  const [inspectPlayer, setInspectPlayer] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Live In-Match Tactics & Sub Panel State
  const [showTacticsModal, setShowTacticsModal] = useState(false);
  const [liveTactics, setLiveTactics] = useState({
    mentality: userTactics?.mentality || 'Normal',
    passingStyle: userTactics?.passingStyle || 'Mixed',
    tackling: userTactics?.tackling || 'Normal'
  });
  const [selectedSubOutId, setSelectedSubOutId] = useState('');
  const [selectedSubInId, setSelectedSubInId] = useState('');

  // Sequencer Queues (Clock freezes during highlight chains!)
  const pendingBeatsRef = useRef([]);
  const timerRef = useRef(null);

  const userTeamMeta = allTeams.find(t => t.name === userTeamName) || allTeams[0];
  const oppTeamMeta = allTeams.find(t => t.name === opponentName) || allTeams[1] || allTeams[0];

  const homeTeamMeta = venueSide === 'home' ? userTeamMeta : oppTeamMeta;
  const awayTeamMeta = venueSide === 'home' ? oppTeamMeta : userTeamMeta;

  // Play CM 01/02 .wav sound effect
  const playSound = useCallback((soundFile) => {
    if (!soundEnabled || !soundFile) return;
    try {
      const normalized = soundFile.toLowerCase();
      const audio = new Audio(`/sounds/cm/${normalized}`);
      audio.volume = 0.65;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore browser autoplay restrictions
    }
  }, [soundEnabled]);

  // Start / Reset Match
  const handleStartMatch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingBeatsRef.current = [];

    const syncedTactics = {
      mentality: userTactics?.mentality || 'Normal',
      passingStyle: userTactics?.passingStyle || 'Mixed',
      tackling: userTactics?.tackling || 'Normal',
      formation: userFormation
    };
    setLiveTactics(syncedTactics);

    const userTeamObj = {
      name: userTeamName,
      lineup: userStarters,
      bench: userBench,
      tactics: syncedTactics
    };

    const cpuSquad = allSquads[opponentName] || [];
    const cpuOptimal = buildOptimalLineup(cpuSquad, '4-4-2');
    const cpuTeamObj = {
      name: opponentName,
      lineup: cpuOptimal.starters,
      bench: cpuOptimal.bench,
      tactics: { mentality: 'Normal', passingStyle: 'Mixed', tackling: 'Normal', formation: '4-4-2' }
    };

    const homeObj = venueSide === 'home' ? userTeamObj : cpuTeamObj;
    const awayObj = venueSide === 'home' ? cpuTeamObj : userTeamObj;

    const newEngine = new CM0102Engine(homeObj, awayObj);
    setEngine(newEngine);
    setSelectedSubOutId('');
    setSelectedSubInId('');

    setMatchState({
      minute: 0,
      displayMinute: '0',
      half: 1,
      inHighlight: false,
      homeScore: 0,
      awayScore: 0,
      liveBanner: {
        text: `${homeObj.name.toUpperCase()} v ${awayObj.name.toUpperCase()} — Referee: ${newEngine.referee}`,
        side: 'home',
        bannerStyle: 'neutral',
        zone: 'MIDFIELD'
      },
      events: [],
      homeLineup: [...newEngine.homeLineup],
      awayLineup: [...newEngine.awayLineup],
      homeBench: [...newEngine.homeBench],
      awayBench: [...newEngine.awayBench],
      homeStats: { ...newEngine.homeStats },
      awayStats: { ...newEngine.awayStats },
      scorers: [],
      cards: [],
      subsMade: { ...newEngine.subsMade },
      isFinished: false
    });

    setIsPlaying(true);
  };

  // Authentic CM 01/02 Sequencer:
  // - On quiet minutes (no highlight beats), clock ticks smoothly (~520ms) without spamming commentary
  // - On highlight minutes (5-10 beats), clock freezes while each commentary line displays for ~1.6s-2.4s
  const processNextStep = useCallback(() => {
    if (!engine) return;

    // 1. If there are pending beats in the active highlight chain, play the next beat!
    if (pendingBeatsRef.current.length > 0) {
      const beat = pendingBeatsRef.current.shift();

      if (beat.sound) {
        playSound(beat.sound);
      }

      setMatchState(prev => {
        if (!prev) return prev;

        // Only update displayed score when the goal beat itself hits the screen!
        const updatedHomeScore = beat.isGoal && beat.scoreSnapshot ? beat.scoreSnapshot.homeScore : prev.homeScore;
        const updatedAwayScore = beat.isGoal && beat.scoreSnapshot ? beat.scoreSnapshot.awayScore : prev.awayScore;
        const updatedScorers = beat.isGoal && beat.scoreSnapshot ? beat.scoreSnapshot.scorers : prev.scorers;

        const newEventItem = {
          minute: beat.displayMinute,
          text: beat.text,
          side: beat.side,
          bannerStyle: beat.bannerStyle,
          eventKey: beat.eventKey
        };

        const finishedNow = engine.isFinished && pendingBeatsRef.current.length === 0;

        return {
          ...prev,
          displayMinute: beat.displayMinute,
          inHighlight: pendingBeatsRef.current.length > 0,
          homeScore: updatedHomeScore,
          awayScore: updatedAwayScore,
          scorers: updatedScorers,
          cards: [...engine.cards],
          subsMade: { ...engine.subsMade },
          liveBanner: {
            text: beat.text,
            side: beat.side,
            bannerStyle: beat.bannerStyle || 'normal',
            zone: beat.zone || 'MIDFIELD'
          },
          events: [newEventItem, ...prev.events.slice(0, 160)],
          homeLineup: [...engine.homeLineup],
          awayLineup: [...engine.awayLineup],
          homeBench: [...engine.homeBench],
          awayBench: [...engine.awayBench],
          homeStats: { ...engine.homeStats },
          awayStats: { ...engine.awayStats },
          isFinished: finishedNow
        };
      });

      // Pause briefly at Half-Time or Full-Time whistle
      const baseDelay = beat.delayMs || 1650;
      const nextDelay = Math.max(180, Math.round(baseDelay / speedMultiplier));
      timerRef.current = setTimeout(processNextStep, nextDelay);
      return;
    }

    // 2. If engine finished and all beats have been played, stop!
    if (engine.isFinished) {
      setIsPlaying(false);
      setMatchState(prev => prev ? ({
        ...prev,
        displayMinute: 'FT',
        inHighlight: false,
        homeScore: engine.homeScore,
        awayScore: engine.awayScore,
        scorers: [...engine.scorers],
        isFinished: true
      }) : prev);
      return;
    }

    // 3. Otherwise advance to the next minute via engine.tick()
    const pkg = engine.tick();
    if (!pkg) {
      setIsPlaying(false);
      return;
    }

    if (pkg.beats && pkg.beats.length > 0) {
      // Queue up all beats for this highlight chain and play the first beat immediately
      pendingBeatsRef.current = pkg.beats.map(b => ({
        ...b,
        displayMinute: pkg.displayMinute
      }));
      processNextStep();
    } else {
      // Quiet Minute! Advance the clock cleanly without spamming commentary
      setMatchState(prev => prev ? ({
        ...prev,
        minute: pkg.minute,
        displayMinute: pkg.displayMinute,
        half: pkg.half,
        inHighlight: false,
        homeLineup: [...engine.homeLineup],
        awayLineup: [...engine.awayLineup],
        homeStats: { ...engine.homeStats },
        awayStats: { ...engine.awayStats }
      }) : prev);

      const quietTickDelay = Math.max(90, Math.round(520 / speedMultiplier));
      timerRef.current = setTimeout(processNextStep, quietTickDelay);
    }
  }, [engine, speedMultiplier, playSound]);

  // Manage timer lifecycle
  useEffect(() => {
    if (isPlaying && engine && (!engine.isFinished || pendingBeatsRef.current.length > 0)) {
      timerRef.current = setTimeout(processNextStep, 80);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, engine, processNextStep]);

  // Instant Simulation of remaining match
  const handleInstantSim = () => {
    if (!engine || engine.isFinished) return;
    setIsPlaying(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingBeatsRef.current = [];

    engine.simulateInstant();
    playSound('whist3.wav');

    setMatchState(prev => ({
      ...prev,
      minute: 90,
      displayMinute: 'FT',
      inHighlight: false,
      homeScore: engine.homeScore,
      awayScore: engine.awayScore,
      liveBanner: {
        text: `FULL TIME — ${engine.homeTeam.name} ${engine.homeScore} - ${engine.awayScore} ${engine.awayTeam.name}`,
        side: 'home',
        bannerStyle: 'neutral',
        zone: 'MIDFIELD'
      },
      events: [...engine.events, ...(prev?.events || [])].slice(0, 180),
      homeLineup: [...engine.homeLineup],
      awayLineup: [...engine.awayLineup],
      homeBench: [...engine.homeBench],
      awayBench: [...engine.awayBench],
      homeStats: { ...engine.homeStats },
      awayStats: { ...engine.awayStats },
      scorers: [...engine.scorers],
      cards: [...engine.cards],
      subsMade: { ...engine.subsMade },
      isFinished: true
    }));
  };

  // Apply Live Tactical Changes to Engine
  const handleUpdateLiveTactics = (field, val) => {
    const next = { ...liveTactics, [field]: val };
    setLiveTactics(next);
    if (engine) {
      engine.updateTactics(venueSide, next);
    }
  };

  // Make Live Substitution
  const handleMakeSubstitution = () => {
    if (!engine || !selectedSubOutId || !selectedSubInId) return;
    const ok = engine.makeSubstitution(venueSide, Number(selectedSubOutId) || selectedSubOutId, Number(selectedSubInId) || selectedSubInId);
    if (ok) {
      const userLineup = venueSide === 'home' ? engine.homeLineup : engine.awayLineup;
      const newPlayer = userLineup.find(p => String(p.id) === String(selectedSubInId));
      setSelectedSubOutId('');
      setSelectedSubInId('');
      setMatchState(prev => ({
        ...prev,
        homeLineup: [...engine.homeLineup],
        awayLineup: [...engine.awayLineup],
        homeBench: [...engine.homeBench],
        awayBench: [...engine.awayBench],
        subsMade: { ...engine.subsMade },
        liveBanner: {
          text: `${userTeamName} substitution: ${newPlayer ? newPlayer.name : 'Substitute'} comes on!`,
          side: venueSide,
          bannerStyle: 'normal',
          zone: 'MIDFIELD'
        }
      }));
    }
  };

  // Determine Live Commentary Bar Styling (Authentic CM 01/02 Team Kit Colors)
  const getCommentaryBarStyle = () => {
    if (!matchState?.liveBanner) return {};
    const { side, bannerStyle } = matchState.liveBanner;
    const activeMeta = side === 'away' ? awayTeamMeta : homeTeamMeta;
    const primary = activeMeta?.colors?.primary || '#10344c';
    const secondary = activeMeta?.colors?.secondary || '#ffffff';

    if (bannerStyle === 'yellow') {
      return {
        backgroundColor: '#ffdd00',
        color: '#050f16',
        borderColor: '#ffffff'
      };
    }
    if (bannerStyle === 'red') {
      return {
        backgroundColor: '#cc0000',
        color: '#ffffff',
        borderColor: '#ffdd44'
      };
    }
    if (bannerStyle === 'neutral') {
      return {
        backgroundColor: '#0c283a',
        color: '#ffdd44',
        borderColor: '#00a2a2'
      };
    }

    const textColor = getContrastText(primary, secondary);
    return {
      backgroundColor: primary,
      color: textColor,
      borderColor: secondary,
      '--cm-goal-bg-1': primary,
      '--cm-goal-fg-1': textColor,
      '--cm-goal-bg-2': secondary,
      '--cm-goal-fg-2': getContrastText(secondary, primary)
    };
  };

  // Compute active pitch zone index (0..4 from Home Box to Away Box)
  const getPitchZoneIndex = () => {
    if (!matchState?.liveBanner) return 2;
    const { zone, side } = matchState.liveBanner;
    if (zone === 'MIDFIELD') return 2;
    if (side === 'home') {
      if (zone === 'DEFENSE') return 1;
      if (zone === 'ATT_THIRD') return 3;
      if (zone === 'BOX') return 4;
    } else {
      if (zone === 'DEFENSE') return 3;
      if (zone === 'ATT_THIRD') return 1;
      if (zone === 'BOX') return 0;
    }
    return 2;
  };

  const activeZoneIdx = getPitchZoneIndex();
  const userLineupNow = matchState ? (venueSide === 'home' ? matchState.homeLineup : matchState.awayLineup) : [];
  const userBenchNow = matchState ? (venueSide === 'home' ? matchState.homeBench : matchState.awayBench) : [];
  const userSubsUsed = matchState ? (venueSide === 'home' ? matchState.subsMade.home : matchState.subsMade.away) : 0;

  return (
    <div className="cm-match-container">
      {/* PRE-MATCH FIXTURE BAR */}
      <div className="cm-team-banner" style={{ marginBottom: '4px' }}>
        <div>
          <h3 style={{ margin: 0, color: '#ffdd44', fontSize: '16px', letterSpacing: '0.5px' }}>
            ⚽ PREMIER LEAGUE 2004/05 — AUTHENTIC CM 01/02 MATCH ENGINE
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#a0c4d8' }}>
            139 official CM 01/02 events, 42-attribute contested duels, set pieces, cards, stoppage time & time-frozen highlight chains.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', color: '#40e0d0', fontWeight: 'bold' }}>Venue:</label>
          <select
            className="cm-select-dropdown"
            value={venueSide}
            disabled={isPlaying}
            onChange={(e) => setVenueSide(e.target.value)}
          >
            <option value="home">{userTeamName} (Home)</option>
            <option value="away">{userTeamName} (Away)</option>
          </select>

          <label style={{ fontSize: '12px', color: '#40e0d0', fontWeight: 'bold' }}>Opponent:</label>
          <select
            className="cm-select-dropdown"
            value={opponentName}
            disabled={isPlaying}
            onChange={(e) => setOpponentName(e.target.value)}
          >
            {allTeams.filter(t => t.name !== userTeamName).map(t => (
              <option key={t.id} value={t.name}>{t.name} (Rep: {t.reputation})</option>
            ))}
          </select>

          <button
            onClick={handleStartMatch}
            className="cm-ctrl-btn"
            style={{
              background: 'linear-gradient(180deg, #00a2a2 0%, #007777 100%)',
              color: '#fff',
              padding: '9px 18px',
              fontSize: '13px'
            }}
          >
            {engine ? '↺ New Match / Kick Off' : '⚡ Kick Off Match'}
          </button>
        </div>
      </div>

      {/* ACTIVE MATCH SCREEN */}
      {engine && matchState && (
        <>
          {/* CLASSIC CM 01/02 SCOREBOARD HEADER */}
          <div className="cm-scoreboard">
            {/* HOME CLUB */}
            <div className="cm-score-team">
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: homeTeamMeta.colors.primary,
                  border: `3px solid ${homeTeamMeta.colors.secondary || '#fff'}`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.6)'
                }}
              />
              <div>
                <span className="cm-team-display-name">{homeTeamMeta.name}</span>
                <div style={{ fontSize: '11px', color: '#79a6c4' }}>HOME</div>
              </div>
            </div>

            {/* SCORE & DIGITAL CLOCK */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="cm-score-digits">{matchState.homeScore}</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#40e0d0' }}>-</span>
                <span className="cm-score-digits">{matchState.awayScore}</span>
              </div>
              <div className={`cm-match-clock ${matchState.inHighlight ? 'cm-clock-highlight' : ''}`}>
                {matchState.displayMinute === 'HT' || matchState.displayMinute === 'FT'
                  ? matchState.displayMinute
                  : `${matchState.displayMinute}'`}
                {matchState.inHighlight && !matchState.isFinished && (
                  <span className="cm-live-badge">● ACTION</span>
                )}
              </div>
            </div>

            {/* AWAY CLUB */}
            <div className="cm-score-team" style={{ justifyContent: 'flex-end' }}>
              <div style={{ textAlign: 'right' }}>
                <span className="cm-team-display-name">{awayTeamMeta.name}</span>
                <div style={{ fontSize: '11px', color: '#79a6c4' }}>AWAY</div>
              </div>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: awayTeamMeta.colors.primary,
                  border: `3px solid ${awayTeamMeta.colors.secondary || '#fff'}`,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.6)'
                }}
              />
            </div>

            {/* PLAYBACK SPEED & TACTICS CONTROLS */}
            <div className="cm-match-controls">
              {!matchState.isFinished && (
                <>
                  <button
                    className="cm-ctrl-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                  <button
                    className={`cm-ctrl-btn ${speedMultiplier === 0.75 ? 'active' : ''}`}
                    onClick={() => setSpeedMultiplier(0.75)}
                    title="Slow Highlight Reading Speed"
                  >
                    Slow
                  </button>
                  <button
                    className={`cm-ctrl-btn ${speedMultiplier === 1 ? 'active' : ''}`}
                    onClick={() => setSpeedMultiplier(1)}
                    title="Authentic CM 01/02 Pacing"
                  >
                    CM 1x
                  </button>
                  <button
                    className={`cm-ctrl-btn ${speedMultiplier === 2 ? 'active' : ''}`}
                    onClick={() => setSpeedMultiplier(2)}
                    title="Fast Speed"
                  >
                    2x
                  </button>
                  <button
                    className={`cm-ctrl-btn ${speedMultiplier === 4 ? 'active' : ''}`}
                    onClick={() => setSpeedMultiplier(4)}
                    title="Very Fast Speed"
                  >
                    4x
                  </button>
                  <button
                    className="cm-ctrl-btn"
                    onClick={handleInstantSim}
                    title="Simulate immediately to Full Time"
                  >
                    ⚡ Instant
                  </button>
                  <button
                    className={`cm-ctrl-btn ${showTacticsModal ? 'active' : ''}`}
                    onClick={() => setShowTacticsModal(!showTacticsModal)}
                  >
                    ♟️ Tactics / Subs ({3 - userSubsUsed})
                  </button>
                </>
              )}

              <button
                className="cm-ctrl-btn"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title="Toggle Original CM 01/02 Sound Effects"
              >
                {soundEnabled ? '🔊 SFX On' : '🔇 Muted'}
              </button>
            </div>
          </div>

          {/* PITCH ZONE INDICATOR BAR */}
          <div className="cm-zone-strip">
            {[
              `${homeTeamMeta.name.toUpperCase()} BOX`,
              `${homeTeamMeta.name.toUpperCase()} DEF`,
              'MIDFIELD BATTLE',
              `${awayTeamMeta.name.toUpperCase()} DEF`,
              `${awayTeamMeta.name.toUpperCase()} BOX`
            ].map((label, idx) => (
              <div
                key={idx}
                className={`cm-zone-cell ${activeZoneIdx === idx ? 'active' : ''}`}
              >
                {activeZoneIdx === idx ? `⚽ ${label}` : label}
              </div>
            ))}
          </div>

          {/* ICONIC CM 01/02 FLASHING SINGLE-LINE LIVE COMMENTARY BAR */}
          <div
            className={`cm-live-commentary-bar ${matchState.liveBanner?.bannerStyle === 'goal' ? 'cm-goal-flash' : ''}`}
            style={getCommentaryBarStyle()}
          >
            {matchState.liveBanner?.text || '...'}
          </div>

          {/* IN-MATCH TACTICS & SUBSTITUTIONS PANEL */}
          {showTacticsModal && !matchState.isFinished && (
            <div className="cm-live-tactics-drawer">
              <div style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '800', color: '#ffdd44', fontSize: '13px' }}>
                  ♟️ {userTeamName.toUpperCase()} TOUCHLINE INSTRUCTIONS:
                </span>

                <div>
                  <label style={{ fontSize: '11px', color: '#40e0d0', marginRight: '6px' }}>Mentality:</label>
                  <select
                    className="cm-select-dropdown"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                    value={liveTactics.mentality}
                    onChange={(e) => handleUpdateLiveTactics('mentality', e.target.value)}
                  >
                    <option value="Defensive">Defensive</option>
                    <option value="Normal">Normal</option>
                    <option value="Attacking">Attacking</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#40e0d0', marginRight: '6px' }}>Passing:</label>
                  <select
                    className="cm-select-dropdown"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                    value={liveTactics.passingStyle}
                    onChange={(e) => handleUpdateLiveTactics('passingStyle', e.target.value)}
                  >
                    <option value="Short">Short</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Direct">Direct</option>
                    <option value="Long">Long Ball</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#40e0d0', marginRight: '6px' }}>Tackling:</label>
                  <select
                    className="cm-select-dropdown"
                    style={{ padding: '5px 10px', fontSize: '12px' }}
                    value={liveTactics.tackling}
                    onChange={(e) => handleUpdateLiveTactics('tackling', e.target.value)}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Normal">Normal</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              {/* SUBSTITUTION CONTROLS */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0, 162, 162, 0.25)' }}>
                <span style={{ fontWeight: '700', color: '#40e0d0', fontSize: '12px' }}>
                  🔄 Make Substitution ({3 - userSubsUsed} remaining):
                </span>

                <select
                  className="cm-select-dropdown"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  value={selectedSubOutId}
                  onChange={(e) => setSelectedSubOutId(e.target.value)}
                  disabled={userSubsUsed >= 3}
                >
                  <option value="">-- Player Off (On Pitch) --</option>
                  {userLineupNow.filter(p => !p.redCard).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position}) - Cond: {p.condition}% | Rat: {p.rating}
                    </option>
                  ))}
                </select>

                <select
                  className="cm-select-dropdown"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  value={selectedSubInId}
                  onChange={(e) => setSelectedSubInId(e.target.value)}
                  disabled={userSubsUsed >= 3}
                >
                  <option value="">-- Player On (Bench) --</option>
                  {userBenchNow.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position}) - CA: {p.currentAbility}
                    </option>
                  ))}
                </select>

                <button
                  className="cm-ctrl-btn"
                  style={{ padding: '5px 14px', fontSize: '12px', background: '#00a2a2', color: '#fff' }}
                  disabled={!selectedSubOutId || !selectedSubInId || userSubsUsed >= 3}
                  onClick={handleMakeSubstitution}
                >
                  Confirm Sub
                </button>
              </div>
            </div>
          )}

          {/* GOALS & CARDS SUMMARY STRIP */}
          {(matchState.scorers.length > 0 || matchState.cards.length > 0) && (
            <div style={{
              background: '#0b2436',
              padding: '8px 16px',
              borderRadius: '4px',
              border: '1px solid #144463',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ color: '#ffdd44' }}>
                <strong>Goals: </strong>
                {matchState.scorers.length === 0 ? 'None' : matchState.scorers.map((s, idx) => (
                  <span key={idx} style={{ marginRight: '12px' }}>
                    ⚽ {s.name} ({s.minute}'{s.type === 'pen' ? ' pen' : ''}) [{s.team}]
                  </span>
                ))}
              </div>
              {matchState.cards.length > 0 && (
                <div style={{ color: '#e0f0f5' }}>
                  <strong>Cards: </strong>
                  {matchState.cards.map((c, idx) => (
                    <span key={idx} style={{ marginRight: '10px' }}>
                      {c.card === 'red' ? '🟥' : '🟨'} {c.name} ({c.minute}')
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* MAIN SPLIT ARENA: MATCH COMMENTARY LOG (LEFT) & LIVE 1-10 RATINGS (RIGHT) */}
          <div className="cm-match-arena">
            {/* LEFT: COMMENTARY HISTORY LOG */}
            <div className="cm-commentary-console">
              <div className="cm-console-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CM 01/02 Match Incident & Commentary Log</span>
                <span style={{ color: '#ffdd44' }}>Ref: {engine.referee}</span>
              </div>
              <div className="cm-commentary-stream">
                {matchState.events.map((ev, idx) => {
                  let cls = 'cm-comm-item';
                  if (ev.bannerStyle === 'goal') cls += ' goal';
                  else if (ev.bannerStyle === 'yellow' || ev.bannerStyle === 'red') cls += ' card';

                  const sideColor = ev.side === 'away'
                    ? (awayTeamMeta?.colors?.primary || '#40e0d0')
                    : (homeTeamMeta?.colors?.primary || '#ffdd44');

                  return (
                    <div
                      key={idx}
                      className={cls}
                      style={{ borderLeftColor: ev.bannerStyle === 'goal' ? '#ffdd44' : sideColor }}
                    >
                      <span className="cm-comm-min">{ev.minute}'</span>
                      <span>{ev.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: LIVE PLAYER RATINGS (1-10) */}
            <div className="cm-table-card" style={{ height: '480px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                background: '#10344c',
                padding: '10px 14px',
                borderBottom: '2px solid #00a2a2',
                fontWeight: 'bold',
                color: '#40e0d0',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>LIVE PLAYER RATINGS (CLICK TO INSPECT 42 SKILLS)</span>
                <span style={{ color: '#ffdd44' }}>SCALE: 1 - 10</span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="cm-table">
                  <thead>
                    <tr>
                      <th style={{ width: '36px' }}>Club</th>
                      <th>Player</th>
                      <th style={{ width: '42px' }}>Pos</th>
                      <th style={{ width: '52px', textAlign: 'center' }}>Cond</th>
                      <th style={{ width: '38px', textAlign: 'center' }}>Sh</th>
                      <th style={{ width: '38px', textAlign: 'center' }}>Tck</th>
                      <th style={{ width: '48px', textAlign: 'center' }}>Rat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* HOME TEAM */}
                    <tr style={{ background: '#0a2333', fontWeight: 'bold' }}>
                      <td colSpan="7" style={{ color: '#ffdd44', padding: '6px 14px' }}>
                        {homeTeamMeta.name} (Home)
                      </td>
                    </tr>
                    {matchState.homeLineup.map((p) => (
                      <tr
                        key={'h_' + p.id}
                        onClick={() => setInspectPlayer(p)}
                        style={{ opacity: p.redCard ? 0.45 : 1 }}
                      >
                        <td style={{ color: '#40e0d0', fontSize: '11px', fontWeight: 'bold' }}>H</td>
                        <td style={{ fontWeight: '600' }}>
                          {p.name}{' '}
                          {p.goals > 0 && <span style={{ color: '#ffdd44' }}>{'⚽'.repeat(p.goals)}</span>}
                          {p.assists > 0 && <span style={{ color: '#40e0d0', fontSize: '11px' }}> ({p.assists}A)</span>}
                          {p.yellowCards > 0 && !p.redCard && <span title="Booked"> 🟨</span>}
                          {p.redCard && <span title="Sent Off"> 🟥</span>}
                        </td>
                        <td style={{ color: '#a0c4d8', fontSize: '11px' }}>{p.assignedSlot || p.position}</td>
                        <td style={{
                          textAlign: 'center',
                          color: p.condition >= 80 ? '#33ff77' : p.condition >= 68 ? '#ffdd44' : '#ff6b6b',
                          fontWeight: 'bold'
                        }}>
                          {p.condition}%
                        </td>
                        <td style={{ textAlign: 'center' }}>{p.shots}</td>
                        <td style={{ textAlign: 'center' }}>{p.tacklesWon}</td>
                        <td style={{
                          textAlign: 'center',
                          fontWeight: '800',
                          color: p.rating >= 8 ? '#33ff77' : p.rating >= 7 ? '#ffdd44' : p.rating <= 5 ? '#ff6b6b' : '#88aacc',
                          fontSize: '14px'
                        }}>
                          {p.rating}
                        </td>
                      </tr>
                    ))}

                    {/* AWAY TEAM */}
                    <tr style={{ background: '#0a2333', fontWeight: 'bold' }}>
                      <td colSpan="7" style={{ color: '#40e0d0', padding: '6px 14px' }}>
                        {awayTeamMeta.name} (Away)
                      </td>
                    </tr>
                    {matchState.awayLineup.map((p) => (
                      <tr
                        key={'a_' + p.id}
                        onClick={() => setInspectPlayer(p)}
                        style={{ opacity: p.redCard ? 0.45 : 1 }}
                      >
                        <td style={{ color: '#ffaa00', fontSize: '11px', fontWeight: 'bold' }}>A</td>
                        <td style={{ fontWeight: '600' }}>
                          {p.name}{' '}
                          {p.goals > 0 && <span style={{ color: '#ffdd44' }}>{'⚽'.repeat(p.goals)}</span>}
                          {p.assists > 0 && <span style={{ color: '#40e0d0', fontSize: '11px' }}> ({p.assists}A)</span>}
                          {p.yellowCards > 0 && !p.redCard && <span title="Booked"> 🟨</span>}
                          {p.redCard && <span title="Sent Off"> 🟥</span>}
                        </td>
                        <td style={{ color: '#a0c4d8', fontSize: '11px' }}>{p.assignedSlot || p.position}</td>
                        <td style={{
                          textAlign: 'center',
                          color: p.condition >= 80 ? '#33ff77' : p.condition >= 68 ? '#ffdd44' : '#ff6b6b',
                          fontWeight: 'bold'
                        }}>
                          {p.condition}%
                        </td>
                        <td style={{ textAlign: 'center' }}>{p.shots}</td>
                        <td style={{ textAlign: 'center' }}>{p.tacklesWon}</td>
                        <td style={{
                          textAlign: 'center',
                          fontWeight: '800',
                          color: p.rating >= 8 ? '#33ff77' : p.rating >= 7 ? '#ffdd44' : p.rating <= 5 ? '#ff6b6b' : '#88aacc',
                          fontSize: '14px'
                        }}>
                          {p.rating}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* BOTTOM: FULL MATCH STATISTICS */}
          <div className="cm-stats-card">
            <div style={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#40e0d0',
              textTransform: 'uppercase',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              {homeTeamMeta.name} vs {awayTeamMeta.name} — Match Statistics
            </div>

            <div className="cm-stat-bar-row">
              <span className="cm-stat-val" style={{ color: '#ffdd44' }}>{Math.round(matchState.homeStats.possession)}%</span>
              <span className="cm-stat-label">Possession</span>
              <span className="cm-stat-val" style={{ color: '#40e0d0' }}>{Math.round(matchState.awayStats.possession)}%</span>
            </div>

            <div className="cm-stat-bar-row">
              <span className="cm-stat-val" style={{ color: '#ffdd44' }}>{matchState.homeStats.shots}</span>
              <span className="cm-stat-label">Shots</span>
              <span className="cm-stat-val" style={{ color: '#40e0d0' }}>{matchState.awayStats.shots}</span>
            </div>

            <div className="cm-stat-bar-row">
              <span className="cm-stat-val" style={{ color: '#ffdd44' }}>{matchState.homeStats.onTarget}</span>
              <span className="cm-stat-label">Shots On Target</span>
              <span className="cm-stat-val" style={{ color: '#40e0d0' }}>{matchState.awayStats.onTarget}</span>
            </div>

            <div className="cm-stat-bar-row">
              <span className="cm-stat-val" style={{ color: '#ffdd44' }}>{matchState.homeStats.corners}</span>
              <span className="cm-stat-label">Corners</span>
              <span className="cm-stat-val" style={{ color: '#40e0d0' }}>{matchState.awayStats.corners}</span>
            </div>

            <div className="cm-stat-bar-row">
              <span className="cm-stat-val" style={{ color: '#ffdd44' }}>{matchState.homeStats.offsides || 0}</span>
              <span className="cm-stat-label">Offsides</span>
              <span className="cm-stat-val" style={{ color: '#40e0d0' }}>{matchState.awayStats.offsides || 0}</span>
            </div>

            <div className="cm-stat-bar-row">
              <span className="cm-stat-val" style={{ color: '#ffdd44' }}>{matchState.homeStats.fouls}</span>
              <span className="cm-stat-label">Fouls</span>
              <span className="cm-stat-val" style={{ color: '#40e0d0' }}>{matchState.awayStats.fouls}</span>
            </div>
          </div>
        </>
      )}

      {inspectPlayer && (
        <CMPlayerModal player={inspectPlayer} onClose={() => setInspectPlayer(null)} />
      )}
    </div>
  );
}
