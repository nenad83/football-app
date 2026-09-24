import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import '../assets/styles/Match.css';
import { clRules } from '../data/cl/clRules';
import { uefaRules } from '../data/uefa/uefaRules';
import { ueclRules } from '../data/uecl/ueclRules';
import { clibRules } from '../data/clib/clibRules';
import { csudRules } from '../data/csud/csudRules';
import { TacticsPanel } from './MatchTactics';
import { getSavedFormation, FORMATIONS, getCPUFormation, FormationPitch } from './FormationTactics';

// Inline premium vector Team Flag component
const TeamFlag = ({ primaryColor, secondaryColor, size = 120 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const flagHeight = Math.round(size * 0.65);

  return (
    <svg
      width={size}
      height={flagHeight}
      viewBox="0 0 100 65"
      className="team-flag"
      style={{
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1.5px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    >
      {isSolid ? (
        <rect width="100" height="65" fill={primaryColor} />
      ) : (
        <>
          <rect x="0" width="50" height="65" fill={primaryColor} />
          <rect x="50" width="50" height="65" fill={secondaryColor} />
        </>
      )}
    </svg>
  );
};

export default function PreMatch() {
  const navigate = useNavigate();
  const url = window.location.search;
  const urlsplit = url.split(/[?,&]/);
  const cup = urlsplit[1];
  const teamone = urlsplit[2];
  const teamtwo = urlsplit[3];

  const isLeague = cup === "league";
  const isTournament = cup === "tournament";
  const isEurope = cup === "europe";

  let leagueState = null;
  let tournamentState = null;
  let teamid = null;
  let teamonename = null;
  let teamtwoname = null;
  let playerTeamId = null;

  if (isLeague || isEurope) {
    const raw = localStorage.getItem("retro_league_career");
    if (raw) {
      leagueState = JSON.parse(raw);
      // Sync stats of domestic teams in the European Cup with their updated domestic stats
      if (leagueState.teams && leagueState.europeanCupState && leagueState.europeanCupState.teams) {
        let changed = false;
        leagueState.europeanCupState.teams.forEach(euroTeam => {
          const domesticTeam = leagueState.teams.find(t => t.name === euroTeam.name);
          if (domesticTeam) {
            if (euroTeam.attack !== domesticTeam.attack ||
              euroTeam.midfield !== domesticTeam.midfield ||
              euroTeam.defense !== domesticTeam.defense) {
              euroTeam.attack = domesticTeam.attack;
              euroTeam.midfield = domesticTeam.midfield;
              euroTeam.defense = domesticTeam.defense;
              changed = true;
            }
          }
        });
        if (changed) {
          localStorage.setItem("retro_league_career", JSON.stringify(leagueState));
        }
      }
    }
  }

  if (isLeague && leagueState) {
    teamid = {};
    leagueState.teams.forEach(t => { teamid[t.idnum] = t; });
    playerTeamId = leagueState.playerTeamId;

    const currentEvent = leagueState.calendar ? leagueState.calendar[leagueState.calendarIndex] : null;
    if (currentEvent && (currentEvent.type === "domestic_cup" || currentEvent.isDomesticCup) && leagueState.domesticCupState) {
      const domCup = leagueState.domesticCupState;
      if (domCup.participatingTeams) {
        domCup.participatingTeams.forEach(t => { teamid[t.idnum] = t; });
      }
      const stageMatches = domCup.knockoutState ? (domCup.knockoutState[currentEvent.stage] || []) : [];
      const userCupMatch = stageMatches.find(m => m.homeId === leagueState.playerTeamId || m.awayId === leagueState.playerTeamId);
      if (userCupMatch) {
        teamonename = userCupMatch.homeId;
        teamtwoname = userCupMatch.awayId;
      } else {
        const currentFixture = leagueState.fixtures[leagueState.currentRound - 1]?.find(
          f => f.homeId === leagueState.playerTeamId || f.awayId === leagueState.playerTeamId
        );
        if (currentFixture) {
          teamonename = currentFixture.homeId;
          teamtwoname = currentFixture.awayId;
        }
      }
    } else {
      const currentFixture = leagueState.fixtures[leagueState.currentRound - 1]?.find(
        f => f.homeId === leagueState.playerTeamId || f.awayId === leagueState.playerTeamId
      );
      if (currentFixture) {
        teamonename = currentFixture.homeId;
        teamtwoname = currentFixture.awayId;
      }
    }
  } else if (isEurope && leagueState) {
    teamid = {};
    leagueState.europeanCupState.teams.forEach(t => { teamid[t.idnum] = t; });

    const currentEvent = leagueState.calendar[leagueState.calendarIndex];
    const cupState = leagueState.europeanCupState;
    const pId = cupState.europeanPlayerTeamId;
    playerTeamId = pId;

    const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
    const seasonShort = leagueState.season.split("/")[0];
    const activeClRules = leagueState.region === "south_america" ? clibRules : clRules;
    const activeUefaRules = leagueState.region === "south_america" ? csudRules : uefaRules;
    const rules = leagueState.europeanCup === "cl" ? activeClRules[seasonShort] : (leagueState.europeanCup === "uefa" ? activeUefaRules[seasonShort] : ueclRules[seasonShort]);
    const hasGroupStage = rules && (
      (rules.format === "group_then_knockout" && currentEvent.stage === "group_stage") ||
      (rules.format === "league_then_knockout" && currentEvent.stage === "league_stage")
    );

    if (hasGroupStage) {
      const fixture = cupState.fixtures[currentEvent.matchday - 1].find(f => f.homeId === pId || f.awayId === pId);
      teamonename = fixture.homeId;
      teamtwoname = fixture.awayId;
    } else {
      const kStateKey = toCamelCase(currentEvent.stage) + (currentEvent.stage !== "final" ? "Leg" + currentEvent.matchday : "");
      const match = cupState.knockoutState[kStateKey].find(f => f.homeId === pId || f.awayId === pId);
      teamonename = match.homeId;
      teamtwoname = match.awayId;
    }
  } else if (isTournament) {
    const raw = localStorage.getItem("retro_tournament_state");
    tournamentState = JSON.parse(raw);
    teamid = {};
    tournamentState.teams.forEach(t => { teamid[t.idnum] = t; });
    playerTeamId = tournamentState.playerTeamId;

    if (tournamentState.stage === "groups") {
      const currentFixture = tournamentState.fixtures[tournamentState.currentRound - 1].find(
        f => f.homeId === tournamentState.playerTeamId || f.awayId === tournamentState.playerTeamId
      );
      teamonename = currentFixture.homeId;
      teamtwoname = currentFixture.awayId;
    } else if (tournamentState.stage === "finalGroup") {
      const currentFixture = tournamentState.knockoutState.finalGroup[tournamentState.currentRound - 1].find(
        f => f.homeId === tournamentState.playerTeamId || f.awayId === tournamentState.playerTeamId
      );
      teamonename = currentFixture.homeId;
      teamtwoname = currentFixture.awayId;
    } else {
      const currentFixture = tournamentState.knockoutState[tournamentState.stage].find(
        f => (f.homeId === tournamentState.playerTeamId || f.awayId === tournamentState.playerTeamId) && !f.played
      );
      teamonename = currentFixture.homeId;
      teamtwoname = currentFixture.awayId;
    }
  } else {
    const getCupSubdir = (cupId) => {
      if (["mex86", "ita90", "usa94", "korjap02", "ger06", "rsa10", "bra14", "rus18", "qat22", "world26"].includes(cupId)) return "wc";
      if (["fra84", "ger88", "swe92", "eng96", "nld00", "por04", "aut08", "polukr12", "fra16", "eur20", "eur24"].includes(cupId)) return "ec";
      if (["ecu93", "chi91", "bra89", "bol97", "par99", "col01", "per04", "ven07", "arg11", "chl15", "usa16", "bra19", "bra21", "cop24"].includes(cupId)) return "cam";
      return "";
    };
    const subdir = getCupSubdir(cup);
    teamid = require('../data/cups/' + subdir + '/' + cup + '.json');
    teamonename = teamone.slice(6);
    teamtwoname = teamtwo.slice(6);
  }

  const isHomeDisabled = playerTeamId !== null && teamonename !== playerTeamId;
  const isAwayDisabled = playerTeamId !== null && teamtwoname !== playerTeamId;

  // States for starting tactics
  const [homeTactic, setHomeTactic] = useState(() => {
    if (teamid && teamonename && teamtwoname) {
      const team = teamid[teamonename];
      const opp = teamid[teamtwoname];
      if (team && opp) {
        const diff = (team.attack + team.midfield + team.defense) - (opp.attack + opp.midfield + opp.defense);
        if (diff <= -5) return "ultra_defense";
        if (diff <= -3) return "defense";
        if (diff >= 3) return "attack";
      }
    }
    return "balanced";
  });

  const [awayTactic, setAwayTactic] = useState(() => {
    if (teamid && teamonename && teamtwoname) {
      const team = teamid[teamtwoname];
      const opp = teamid[teamonename];
      if (team && opp) {
        const diff = (team.attack + team.midfield + team.defense) - (opp.attack + opp.midfield + opp.defense);
        if (diff <= -5) return "ultra_defense";
        if (diff <= -3) return "defense";
        if (diff >= 3) return "attack";
      }
    }
    return "balanced";
  });

  const [homeCounter, setHomeCounter] = useState(false);
  const [awayCounter, setAwayCounter] = useState(false);
  const [homePressing, setHomePressing] = useState(false);
  const [awayPressing, setAwayPressing] = useState(false);
  // Selected play mode for the match simulation (manual or auto)
  const [playMode, setPlayMode] = useState("manual");
  const playerFormation = getSavedFormation();

  const year = (() => {
    if (leagueState && leagueState.season) {
      const yearStr = leagueState.season.split("/")[0];
      const yr = parseInt(yearStr);
      if (!isNaN(yr)) return yr;
    }
    if (tournamentState && tournamentState.cupId) {
      const cupId = tournamentState.cupId;
      const match = cupId.match(/\d+/);
      if (match) {
        const yr = parseInt(match[0]);
        return yr < 50 ? 2000 + yr : 1900 + yr;
      }
    }
    if (cup) {
      const match = cup.match(/\d+/);
      if (match) {
        const yr = parseInt(match[0]);
        return yr < 50 ? 2000 + yr : 1900 + yr;
      }
    }
    return 1995; // default fallback
  })();

  const homeTeam = teamid[teamonename];
  const awayTeam = teamid[teamtwoname];

  const homeFormation = playerTeamId !== null && teamonename === playerTeamId
    ? playerFormation
    : getCPUFormation(homeTeam, awayTeam, year);

  const awayFormation = playerTeamId !== null && teamtwoname === playerTeamId
    ? playerFormation
    : getCPUFormation(awayTeam, homeTeam, year);

  const homeFormationData = FORMATIONS[homeFormation];
  const awayFormationData = FORMATIONS[awayFormation];

  const handleStartMatch = () => {
    navigate(`/match${url}`, {
      state: {
        homeTactic,
        homeCounter,
        homePressing,
        awayTactic,
        awayCounter,
        awayPressing,
        playMode
      }
    });
  };

  const renderKit = (team) => {
    if (!team) return <div className="empty-kit-slot">?</div>;
    if (team.primaryColor) {
      return <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={120} />;
    }
    try {
      return <img className='kitimage' src={require('../assets/images/kits/' + team.kit)} alt={`${team.name} kit`} />;
    } catch (e) {
      return <div className="empty-kit-slot">👕</div>;
    }
  };

  return (
    <div className="Match team-select-container pre-match-lobby" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="matchheader selector-header" style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 className="glowing-header-text" style={{ fontSize: '36px', letterSpacing: '2px', fontFamily: 'Orbitron' }}>PRE-MATCH ROOM</h1>
        <p className="lobby-subtitle" style={{ fontSize: '12px', opacity: 0.7 }}>SET UP YOUR Mentality AND PLAYSTYLE BEFORE THE COMBAT</p>
      </div>

      <div className="match-arena-layout" style={{ display: 'flex', width: '100%', maxWidth: '1100px', justifyContent: 'space-between', gap: '20px', alignItems: 'stretch' }}>

        {/* Left Card: Home Team Sheet & Tactics */}
        <div className="team-stats-card panel-left glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="deck-tag gold-tag" style={{ alignSelf: 'flex-start', marginBottom: '15px' }}>HOME</span>
          <div className="kit-wrapper" style={{ margin: '10px 0' }}>
            {renderKit(homeTeam)}
          </div>
          <h3 className="team-card-title" style={{ fontFamily: 'Orbitron', fontSize: '20px', marginBottom: '8px' }}>{homeTeam.name}</h3>
          {homeFormationData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#00ff64', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                ⚽ {homeFormation}
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {homeFormationData.modifiers.attack !== 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: homeFormationData.modifiers.attack > 0 ? '#00ff64' : '#ff3333', fontFamily: 'Orbitron' }}>
                    ATT {homeFormationData.modifiers.attack > 0 ? '+' : ''}{homeFormationData.modifiers.attack}
                  </span>
                )}
                {homeFormationData.modifiers.midfield !== 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: homeFormationData.modifiers.midfield > 0 ? '#00ff64' : '#ff3333', fontFamily: 'Orbitron' }}>
                    MID {homeFormationData.modifiers.midfield > 0 ? '+' : ''}{homeFormationData.modifiers.midfield}
                  </span>
                )}
                {homeFormationData.modifiers.defense !== 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: homeFormationData.modifiers.defense > 0 ? '#00ff64' : '#ff3333', fontFamily: 'Orbitron' }}>
                    DEF {homeFormationData.modifiers.defense > 0 ? '+' : ''}{homeFormationData.modifiers.defense}
                  </span>
                )}
                {homeFormationData.modifiers.attack === 0 && homeFormationData.modifiers.midfield === 0 && homeFormationData.modifiers.defense === 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron' }}>STANDARD</span>
                )}
              </div>
              <div style={{ marginTop: '8px' }}>
                <FormationPitch formation={homeFormation} isSelected={false} size="small" />
              </div>
            </div>
          )}

          <div className="team-card-bars" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="rpg-bar">
              <span className="rpg-label">ATTACK: {homeTeam.attack}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${homeTeam.attack * 20}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">MIDFIELD: {homeTeam.midfield}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${homeTeam.midfield * 20}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">DEFENSE: {homeTeam.defense}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${homeTeam.defense * 20}%` }}></div></div>
            </div>
          </div>

          <TacticsPanel
            disabled={isHomeDisabled}
            counter={homeCounter}
            setCounter={setHomeCounter}
            pressing={homePressing}
            setPressing={setHomePressing}
            tactic={homeTactic}
            setTactic={setHomeTactic}
          />
        </div>

        {/* Center Panel: Strength Comparison & Kickoff */}
        <div className="pitch-controller-center" style={{ width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '20px' }}>
          <div style={{ fontSize: '40px', fontWeight: 'bold', fontStyle: 'italic', color: '#ffd700', textShadow: '0 0 10px rgba(255, 215, 0, 0.4)', fontFamily: 'Orbitron', margin: '20px 0' }}>VS</div>

          {/* Comparison ratings radar-like bars */}
          <div className="glass-card comparison-box" style={{ width: '100%', padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '11px', fontFamily: 'Orbitron', color: '#aaa', margin: '0 0 5px 0', textTransform: 'uppercase' }}>TEAM COMPARISON</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>{homeTeam.attack}</span>
                <span>ATTACK</span>
                <span>{awayTeam.attack}</span>
              </div>
              <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ flex: homeTeam.attack, background: '#ff4500' }}></div>
                <div style={{ flex: awayTeam.attack, background: '#00ff64' }}></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>{homeTeam.midfield}</span>
                <span>MIDFIELD</span>
                <span>{awayTeam.midfield}</span>
              </div>
              <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ flex: homeTeam.midfield, background: '#ff4500' }}></div>
                <div style={{ flex: awayTeam.midfield, background: '#00ff64' }}></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>{homeTeam.defense}</span>
                <span>DEFENSE</span>
                <span>{awayTeam.defense}</span>
              </div>
              <div style={{ height: '6px', background: '#222', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ flex: homeTeam.defense, background: '#ff4500' }}></div>
                <div style={{ flex: awayTeam.defense, background: '#00ff64' }}></div>
              </div>
            </div>
          </div>

          {/* Match Play Mode Selector */}
          <div className="glass-card simulation-mode-box" style={{ width: '100%', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '5px' }}>
            <h4 style={{ fontSize: '11px', fontFamily: 'Orbitron', color: '#aaa', margin: '0 0 5px 0', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' }}>MATCH MODE</h4>
            <div className="sim-mode-toggle-group" style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                type="button"
                onClick={() => setPlayMode("manual")}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontFamily: 'Orbitron',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: playMode === "manual" ? '1.5px solid #00ff64' : '1.5px solid rgba(255,255,255,0.08)',
                  background: playMode === "manual" ? 'rgba(0, 255, 100, 0.1)' : 'rgba(0,0,0,0.3)',
                  color: playMode === "manual" ? '#00ff64' : '#888',
                  boxShadow: playMode === "manual" ? '0 0 10px rgba(0, 255, 100, 0.15)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                Manual
              </button>
              <button
                type="button"
                onClick={() => setPlayMode("auto")}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontFamily: 'Orbitron',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: playMode === "auto" ? '1.5px solid #ffd700' : '1.5px solid rgba(255,255,255,0.08)',
                  background: playMode === "auto" ? 'rgba(255, 215, 0, 0.1)' : 'rgba(0,0,0,0.3)',
                  color: playMode === "auto" ? '#ffd700' : '#888',
                  boxShadow: playMode === "auto" ? '0 0 10px rgba(255, 215, 0, 0.15)' : 'none',
                  transition: 'all 0.25s ease'
                }}
              >
                Autoplay
              </button>
            </div>
          </div>

          <button
            className="match-control-btn kickoff-theme-btn glowing-btn pulse-glow"
            onClick={handleStartMatch}
            style={{
              padding: '15px 30px',
              fontSize: '16px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '5px',
              width: '100%',
              borderColor: '#ffd700',
              color: '#ffd700',
              background: 'rgba(255, 215, 0, 0.05)',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.25)'
            }}
          >
            KICK OFF MATCH ➔
          </button>
        </div>

        {/* Right Card: Away Team Sheet & Tactics */}
        <div className="team-stats-card panel-right glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="deck-tag blue-tag" style={{ alignSelf: 'flex-start', marginBottom: '15px' }}>AWAY</span>
          <div className="kit-wrapper" style={{ margin: '10px 0' }}>
            {renderKit(awayTeam)}
          </div>
          <h3 className="team-card-title" style={{ fontFamily: 'Orbitron', fontSize: '20px', marginBottom: '8px' }}>{awayTeam.name}</h3>
          {awayFormationData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#00ff64', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                ⚽ {awayFormation}
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {awayFormationData.modifiers.attack !== 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: awayFormationData.modifiers.attack > 0 ? '#00ff64' : '#ff3333', fontFamily: 'Orbitron' }}>
                    ATT {awayFormationData.modifiers.attack > 0 ? '+' : ''}{awayFormationData.modifiers.attack}
                  </span>
                )}
                {awayFormationData.modifiers.midfield !== 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: awayFormationData.modifiers.midfield > 0 ? '#00ff64' : '#ff3333', fontFamily: 'Orbitron' }}>
                    MID {awayFormationData.modifiers.midfield > 0 ? '+' : ''}{awayFormationData.modifiers.midfield}
                  </span>
                )}
                {awayFormationData.modifiers.defense !== 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: awayFormationData.modifiers.defense > 0 ? '#00ff64' : '#ff3333', fontFamily: 'Orbitron' }}>
                    DEF {awayFormationData.modifiers.defense > 0 ? '+' : ''}{awayFormationData.modifiers.defense}
                  </span>
                )}
                {awayFormationData.modifiers.attack === 0 && awayFormationData.modifiers.midfield === 0 && awayFormationData.modifiers.defense === 0 && (
                  <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron' }}>STANDARD</span>
                )}
              </div>
              <div style={{ marginTop: '8px' }}>
                <FormationPitch formation={awayFormation} isSelected={false} size="small" />
              </div>
            </div>
          )}

          <div className="team-card-bars" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="rpg-bar">
              <span className="rpg-label">ATTACK: {awayTeam.attack}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${awayTeam.attack * 20}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">MIDFIELD: {awayTeam.midfield}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${awayTeam.midfield * 20}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">DEFENSE: {awayTeam.defense}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${awayTeam.defense * 20}%` }}></div></div>
            </div>
          </div>

          <TacticsPanel
            disabled={isAwayDisabled}
            counter={awayCounter}
            setCounter={setAwayCounter}
            pressing={awayPressing}
            setPressing={setAwayPressing}
            tactic={awayTactic}
            setTactic={setAwayTactic}
          />
        </div>

      </div>
    </div>
  );
}
