import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import '../assets/styles/Match.css';
import { clRules } from '../data/cl/clRules';
import { uefaRules } from '../data/uefa/uefaRules';
import { ueclRules } from '../data/uecl/ueclRules';
import { clibRules } from '../data/clib/clibRules';
import { csudRules } from '../data/csud/csudRules';
import { TacticsPanel } from './MatchTactics';
import {
  getSavedFormation,
  FORMATIONS,
  getCPUFormation,
  FormationPitch,
  updateTeamStatsInStorage,
  getFormationSlots,
  getIdealSlotPosition,
  generateDefaultLineup
} from './FormationTactics';
import { calculateTeamTacticalStats, getRoleMetadata } from '../utils/tacticalRoleEngine';
import { getCPUMatchLineupAndStats } from '../utils/cpuSquadManager';
import { getTeamDetails, getTeamDetailsSync } from '../data/rosters/rosterRegistry';

const getLastName = (name) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

const getPositionColor = (pos) => {
  if (!pos) return '#aaa';
  const p = pos.toUpperCase();
  if (p === 'GK') return '#ffd700';
  if (p.includes('D') && !p.includes('DM') && !p.includes('MID')) return '#00e5ff';
  if (p.includes('M') || p.includes('DM')) return '#00ff64';
  return '#ff4500';
};

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
      if (team && opp && teamonename !== playerTeamId) {
        const diff = (team.attack + team.midfield + team.defense) - (opp.attack + opp.midfield + opp.defense);
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
      if (team && opp && teamtwoname !== playerTeamId) {
        const diff = (team.attack + team.midfield + team.defense) - (opp.attack + opp.midfield + opp.defense);
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
  // Selected play mode for the match simulation (manual or auto) - default is auto
  const [playMode, setPlayMode] = useState("auto");
  const [showLineupsModal, setShowLineupsModal] = useState(false);
  const [cpuHomeData, setCpuHomeData] = useState(null);
  const [cpuAwayData, setCpuAwayData] = useState(null);
  const [playerBench, setPlayerBench] = useState([]);
  const playerFormation = getSavedFormation();

  const { playerTeamName, playerSeason } = (() => {
    if ((isLeague || isEurope) && leagueState) {
      const pTeam = leagueState.teams?.find(t => t.idnum === leagueState.playerTeamId);
      return {
        playerTeamName: pTeam ? pTeam.name : (teamid && playerTeamId !== null && teamid[playerTeamId] ? teamid[playerTeamId].name : ""),
        playerSeason: leagueState.season || "1995"
      };
    }
    if (isTournament && tournamentState) {
      const pTeam = tournamentState.teams?.find(t => t.idnum === tournamentState.playerTeamId);
      const s = tournamentState.cupId ? (tournamentState.cupId.match(/\d+/) ? tournamentState.cupId.match(/\d+/)[0] : "1995") : "1995";
      return {
        playerTeamName: pTeam ? pTeam.name : "",
        playerSeason: s
      };
    }
    return { playerTeamName: "", playerSeason: "1995" };
  })();

  const [playerLineup] = useState(() => {
    if (!playerTeamName) return {};
    try {
      const raw = localStorage.getItem(`retro_lineup_${playerTeamName}_${playerSeason}`);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const [playerRoles, setPlayerRoles] = useState(() => {
    if (!playerTeamName) return {};
    try {
      const raw = localStorage.getItem(`retro_roles_${playerTeamName}_${playerSeason}`);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) {
      return {};
    }
  });

  const handleTogglePlayerRole = (slotId, nextRole) => {
    const nextRoles = { ...playerRoles, [slotId]: nextRole };
    setPlayerRoles(nextRoles);
    if (playerTeamName) {
      localStorage.setItem(`retro_roles_${playerTeamName}_${playerSeason}`, JSON.stringify(nextRoles));
      updateTeamStatsInStorage(playerLineup, playerFormation, nextRoles);
    }
  };

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

  const homeTeamRaw = teamid[teamonename];
  const awayTeamRaw = teamid[teamtwoname];

  const homeFormation = playerTeamId !== null && teamonename === playerTeamId
    ? playerFormation
    : getCPUFormation(homeTeamRaw, awayTeamRaw, year);

  const awayFormation = playerTeamId !== null && teamtwoname === playerTeamId
    ? playerFormation
    : getCPUFormation(awayTeamRaw, homeTeamRaw, year);

  const homeTeam = (() => {
    if (playerTeamId !== null && teamonename === playerTeamId && playerLineup && Object.keys(playerLineup).filter(k => playerLineup[k]).length >= 7) {
      const calc = calculateTeamTacticalStats(playerLineup, homeFormation, playerRoles, homeTactic);
      return { ...homeTeamRaw, attack: calc.attack, midfield: calc.midfield, defense: calc.defense };
    }
    return homeTeamRaw;
  })();

  const awayTeam = (() => {
    if (playerTeamId !== null && teamtwoname === playerTeamId && playerLineup && Object.keys(playerLineup).filter(k => playerLineup[k]).length >= 7) {
      const calc = calculateTeamTacticalStats(playerLineup, awayFormation, playerRoles, awayTactic);
      return { ...awayTeamRaw, attack: calc.attack, midfield: calc.midfield, defense: calc.defense };
    }
    return awayTeamRaw;
  })();

  const homeFormationData = FORMATIONS[homeFormation];
  const awayFormationData = FORMATIONS[awayFormation];

  const [homeDetails, setHomeDetails] = useState(() => getTeamDetailsSync(homeTeamRaw?.name, year));
  const [awayDetails, setAwayDetails] = useState(() => getTeamDetailsSync(awayTeamRaw?.name, year));

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      try {
        if (homeTeamRaw?.name) {
          const hDet = await getTeamDetails(homeTeamRaw.name, year);
          if (isMounted && hDet) setHomeDetails(hDet);
        }
        if (awayTeamRaw?.name) {
          const aDet = await getTeamDetails(awayTeamRaw.name, year);
          if (isMounted && aDet) setAwayDetails(aDet);
        }
      } catch (err) {
        console.warn("Error loading team details in PreMatch:", err);
      }
    };
    loadDetails();
    return () => { isMounted = false; };
  }, [homeTeamRaw?.name, awayTeamRaw?.name, year]);

  const isHomePlayer = playerTeamId !== null && teamonename === playerTeamId;
  const isAwayPlayer = playerTeamId !== null && teamtwoname === playerTeamId;

  const getPlayerCustomManager = () => {
    try {
      const profRaw = localStorage.getItem("retro_manager_profile");
      if (profRaw) {
        const p = JSON.parse(profRaw);
        if (p?.name && p.name.trim()) return p.name.trim();
      }
    } catch (e) {}
    if (leagueState?.managerName && leagueState.managerName.trim()) {
      return leagueState.managerName.trim();
    }
    if (tournamentState?.managerName && tournamentState.managerName.trim()) {
      return tournamentState.managerName.trim();
    }
    return "";
  };

  const customManager = getPlayerCustomManager();

  const homeManagerName = isHomePlayer
    ? (customManager || homeDetails?.manager?.name || "")
    : (homeDetails?.manager?.name || "");

  const awayManagerName = isAwayPlayer
    ? (customManager || awayDetails?.manager?.name || "")
    : (awayDetails?.manager?.name || "");

  const stadiumName = homeDetails?.stadium?.name || "";

  useEffect(() => {
    let isMounted = true;
    const loadPreMatchSquads = async () => {
      // 1. If player team is involved, load player bench from localStorage
      if (playerTeamName) {
        try {
          const rawRoster = localStorage.getItem(`retro_roster_${playerTeamName}_${playerSeason}`);
          const rawBench = localStorage.getItem(`retro_bench_${playerTeamName}_${playerSeason}`);
          const squad = rawRoster ? JSON.parse(rawRoster) : [];
          const benchNames = rawBench ? JSON.parse(rawBench) : [];
          const startingNames = new Set(Object.values(playerLineup).filter(Boolean).map(p => p.name));
          let bench = benchNames.map(name => squad.find(p => p.name === name)).filter(Boolean);
          if (bench.length === 0) {
            bench = squad.filter(p => !startingNames.has(p.name)).slice(0, 7);
          }
          if (isMounted) setPlayerBench(bench);
        } catch (e) {
          console.error("Error loading player bench in PreMatch", e);
        }
      }

      // 2. Home team if CPU
      if (teamonename !== null && teamonename !== playerTeamId && teamid && teamid[teamonename]) {
        try {
          const res = await getCPUMatchLineupAndStats(
            homeTeamRaw.name,
            homeTeamRaw,
            year,
            homeFormation,
            Boolean(cup || isEurope),
            awayTeamRaw,
            true,
            teamtwoname === playerTeamId ? playerLineup : null,
            awayFormation
          );
          if (isMounted && res) {
            setCpuHomeData(res);
          }
        } catch (e) {
          console.error("Error loading CPU home lineup in PreMatch", e);
        }
      }

      // 3. Away team if CPU
      if (teamtwoname !== null && teamtwoname !== playerTeamId && teamid && teamid[teamtwoname]) {
        try {
          const res = await getCPUMatchLineupAndStats(
            awayTeamRaw.name,
            awayTeamRaw,
            year,
            awayFormation,
            Boolean(cup || isEurope),
            homeTeamRaw,
            false,
            teamonename === playerTeamId ? playerLineup : null,
            homeFormation
          );
          if (isMounted && res) {
            setCpuAwayData(res);
          }
        } catch (e) {
          console.error("Error loading CPU away lineup in PreMatch", e);
        }
      }
    };

    loadPreMatchSquads();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamonename, teamtwoname, playerTeamId, year, homeFormation, awayFormation, cup, isEurope]);

  const homeResolvedLineup = teamonename === playerTeamId
    ? (Object.keys(playerLineup).length >= 7 ? playerLineup : generateDefaultLineup(playerBench.length > 0 ? [...Object.values(playerLineup).filter(Boolean), ...playerBench] : [], homeFormation))
    : (cpuHomeData?.lineup || {});

  const homeResolvedBench = teamonename === playerTeamId
    ? playerBench
    : (cpuHomeData?.bench || []);

  const homeResolvedRoles = teamonename === playerTeamId
    ? playerRoles
    : (cpuHomeData?.roles || {});

  const awayResolvedLineup = teamtwoname === playerTeamId
    ? (Object.keys(playerLineup).length >= 7 ? playerLineup : generateDefaultLineup(playerBench.length > 0 ? [...Object.values(playerLineup).filter(Boolean), ...playerBench] : [], awayFormation))
    : (cpuAwayData?.lineup || {});

  const awayResolvedBench = teamtwoname === playerTeamId
    ? playerBench
    : (cpuAwayData?.bench || []);

  const awayResolvedRoles = teamtwoname === playerTeamId
    ? playerRoles
    : (cpuAwayData?.roles || {});

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

  const renderTeamSheetColumn = (team, isHome, formation, tactic, lineup, bench, roles) => {
    const slots = getFormationSlots(formation || '4-4-2');
    const managerToShow = isHome ? homeManagerName : awayManagerName;
    return (
      <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '320px' }}>
        {/* Team Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: isHome ? 'rgba(255, 215, 0, 0.08)' : 'rgba(0, 229, 255, 0.08)',
          border: `1px solid ${isHome ? 'rgba(255, 215, 0, 0.25)' : 'rgba(0, 229, 255, 0.25)'}`,
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '10px',
              fontFamily: 'Orbitron',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
              background: isHome ? '#ffd700' : '#00e5ff',
              color: '#000'
            }}>
              {isHome ? 'HOME' : 'AWAY'}
            </span>
            <div>
              <div style={{ fontFamily: 'Orbitron', fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>
                {team?.name}
              </div>
              {managerToShow && (
                <div style={{ fontSize: '9.5px', color: isHome ? '#ffd700' : '#00e5ff', fontFamily: 'Orbitron', marginTop: '2px', opacity: 0.9 }}>
                  👔 {managerToShow}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#00ff64', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
              ⚽ {formation}
            </span>
            <span style={{ fontSize: '10px', color: '#aaa', fontFamily: 'Orbitron', textTransform: 'uppercase' }}>
              [{tactic || 'normal'}]
            </span>
          </div>
        </div>

        {/* Tactical Pitch */}
        <div
          className="sub-modal-pitch-field"
          style={{
            position: 'relative',
            height: '350px',
            minHeight: '350px',
            background: '#0a4a1a',
            backgroundImage: 'radial-gradient(rgba(0, 255, 100, 0.15) 1.5px, transparent 1.5px), radial-gradient(rgba(0, 255, 100, 0.15) 1.5px, #0a4a1a 1.5px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
            borderRadius: '10px',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            overflow: 'hidden'
          }}
        >
          {/* Pitch Lines */}
          <div style={{ position: 'absolute', top: '4%', bottom: '4%', left: '4%', right: '4%', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '50%', left: '4%', right: '4%', height: '1px', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '4%', left: '25%', right: '25%', height: '12%', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '4%', left: '25%', right: '25%', height: '12%', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', pointerEvents: 'none' }} />

          {/* Field Players */}
          {slots.map(slot => {
            const p = lineup?.[slot.id];
            const idealPos = getIdealSlotPosition(slot.role, slot.x, slot.y);
            const role = roles?.[slot.id] || 'normal';
            const roleMeta = p ? getRoleMetadata(idealPos, p.positions || [idealPos], role) : null;
            return (
              <div
                key={slot.id}
                style={{
                  position: 'absolute',
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 10
                }}
              >
                {p ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(12, 12, 18, 0.92)',
                      border: `1.5px solid ${getPositionColor(p.position || idealPos)}`,
                      borderRadius: '6px',
                      padding: '2px 6px',
                      minWidth: '58px',
                      maxWidth: '85px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.6)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '3px' }}>
                      <span style={{ fontSize: '7.5px', fontWeight: 'bold', fontFamily: 'Orbitron', color: getPositionColor(p.position || idealPos) }}>
                        {idealPos}
                      </span>
                      <span style={{ fontSize: '7.5px', color: '#ffd700', fontWeight: 'bold' }}>
                        ★{p.rating}
                      </span>
                    </div>
                    <span style={{ fontSize: '8.5px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px', textAlign: 'center' }}>
                      {getLastName(p.name)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '2px', marginTop: '1px' }}>
                      <span style={{ fontSize: '7px', color: (p.condition || 100) < 80 ? '#ff4500' : '#00ff64' }}>
                        ⚡{p.condition || 100}%
                      </span>
                      {idealPos !== 'GK' && roleMeta && role !== 'normal' && (
                        <span style={{ fontSize: '6.5px', fontFamily: 'Orbitron', fontWeight: 'bold', color: roleMeta.color, background: 'rgba(0,0,0,0.5)', padding: '0 2px', borderRadius: '2px' }}>
                          {roleMeta.shortLabel}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px dashed #555',
                    color: '#888',
                    fontSize: '8px',
                    fontFamily: 'Orbitron'
                  }}>
                    {idealPos}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Substitutes Section */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontFamily: 'Orbitron', fontWeight: 'bold', color: '#aaa', letterSpacing: '0.8px' }}>
              BENCH SUBSTITUTES ({bench?.length || 0})
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '6px',
            maxHeight: '140px',
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {bench && bench.length > 0 ? (
              bench.map((p, idx) => (
                <div
                  key={p.name || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    fontSize: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{
                      fontSize: '8.5px',
                      fontWeight: 'bold',
                      fontFamily: 'Orbitron',
                      color: getPositionColor(p.position),
                      background: 'rgba(255,255,255,0.06)',
                      padding: '1px 4px',
                      borderRadius: '3px'
                    }}>
                      {p.position || 'SUB'}
                    </span>
                    <span style={{ color: '#fff', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                      {p.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9.5px', flexShrink: 0 }}>
                    {p.age && <span style={{ color: '#888' }}>{p.age}y</span>}
                    <span style={{ color: (p.condition || 100) < 80 ? '#ff4500' : '#00ff64' }}>
                      ⚡{p.condition || 100}%
                    </span>
                    <span style={{ color: '#ffd700', fontWeight: 'bold' }}>
                      ★{p.rating}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '10px', color: '#666', fontStyle: 'italic', padding: '6px 0' }}>
                No substitutes available
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="Match team-select-container pre-match-lobby" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="matchheader selector-header" style={{ marginBottom: '30px', textAlign: 'center' }}>
        <h1 className="glowing-header-text" style={{ fontSize: '36px', letterSpacing: '2px', fontFamily: 'Orbitron' }}>PRE-MATCH ROOM</h1>
        <p className="lobby-subtitle" style={{ fontSize: '12px', opacity: 0.7 }}>SET UP YOUR MENTALITY AND PLAYSTYLE BEFORE THE COMBAT</p>
        {stadiumName && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
            padding: '4px 14px',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            fontSize: '11px',
            fontFamily: 'Orbitron',
            color: '#ddd',
            letterSpacing: '0.8px'
          }}>
            <span>🏟️</span>
            <span>VENUE: <strong style={{ color: '#00ff64' }}>{stadiumName}</strong></span>
          </div>
        )}
      </div>

      <div className="match-arena-layout" style={{ display: 'flex', width: '100%', maxWidth: '1100px', justifyContent: 'space-between', gap: '20px', alignItems: 'stretch' }}>

        {/* Left Card: Home Team Sheet & Tactics */}
        <div className="team-stats-card panel-left glass-card" style={{ flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="deck-tag gold-tag" style={{ alignSelf: 'flex-start', marginBottom: '15px' }}>HOME</span>
          <div className="kit-wrapper" style={{ margin: '10px 0' }}>
            {renderKit(homeTeam)}
          </div>
          <h3 className="team-card-title" style={{ fontFamily: 'Orbitron', fontSize: '20px', marginBottom: '6px' }}>{homeTeam.name}</h3>
          {homeManagerName && (
            <div style={{
              fontSize: '10.5px',
              color: '#ffd700',
              fontFamily: 'Orbitron',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              background: 'rgba(255, 215, 0, 0.08)',
              border: '1px solid rgba(255, 215, 0, 0.22)',
              borderRadius: '12px',
              padding: '2px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>👔</span>
              <span>Manager: <strong>{homeManagerName}</strong></span>
            </div>
          )}
          {homeFormationData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#00ff64', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                ⚽ {homeFormation}
              </span>
              {homeFormationData.era && (
                <span style={{ fontSize: '8px', color: '#a3b3a7', fontFamily: 'Orbitron', letterSpacing: '0.5px' }}>
                  ⏳ {homeFormationData.era}
                </span>
              )}
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
              <div
                onClick={() => setShowLineupsModal(true)}
                style={{ marginTop: '8px', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                title="Click to view matchday lineups for both teams"
              >
                <FormationPitch formation={homeFormation} isSelected={false} size="small" />
              </div>
              <button
                type="button"
                onClick={() => setShowLineupsModal(true)}
                style={{
                  marginTop: '6px',
                  background: 'rgba(0, 255, 100, 0.1)',
                  border: '1px solid rgba(0, 255, 100, 0.35)',
                  borderRadius: '4px',
                  color: '#00ff64',
                  fontSize: '8.5px',
                  fontFamily: 'Orbitron',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  letterSpacing: '0.5px'
                }}
              >
                👁️ VIEW TEAM LINEUP
              </button>
            </div>
          )}

          <div className="team-card-bars" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="rpg-bar">
              <span className="rpg-label">ATTACK: {homeTeam.attack}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${Math.min(100, homeTeam.attack * 20)}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">MIDFIELD: {homeTeam.midfield}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${Math.min(100, homeTeam.midfield * 20)}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">DEFENSE: {homeTeam.defense}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${Math.min(100, homeTeam.defense * 20)}%` }}></div></div>
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
            lineup={playerTeamId !== null && teamonename === playerTeamId ? playerLineup : undefined}
            formation={homeFormation}
            playerRoles={playerTeamId !== null && teamonename === playerTeamId ? playerRoles : undefined}
            onToggleRole={playerTeamId !== null && teamonename === playerTeamId ? handleTogglePlayerRole : undefined}
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
            type="button"
            onClick={() => setShowLineupsModal(true)}
            style={{
              width: '100%',
              padding: '11px 14px',
              background: 'rgba(0, 255, 100, 0.1)',
              border: '1px solid #00ff64',
              borderRadius: '8px',
              color: '#00ff64',
              fontFamily: 'Orbitron',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              letterSpacing: '0.8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 0 12px rgba(0,255,100,0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            📋 VIEW TEAM LINEUPS & SUBS
          </button>

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
          <h3 className="team-card-title" style={{ fontFamily: 'Orbitron', fontSize: '20px', marginBottom: '6px' }}>{awayTeam.name}</h3>
          {awayManagerName && (
            <div style={{
              fontSize: '10.5px',
              color: '#00e5ff',
              fontFamily: 'Orbitron',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              background: 'rgba(0, 229, 255, 0.08)',
              border: '1px solid rgba(0, 229, 255, 0.22)',
              borderRadius: '12px',
              padding: '2px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>👔</span>
              <span>Manager: <strong>{awayManagerName}</strong></span>
            </div>
          )}
          {awayFormationData && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#00ff64', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                ⚽ {awayFormation}
              </span>
              {awayFormationData.era && (
                <span style={{ fontSize: '8px', color: '#a3b3a7', fontFamily: 'Orbitron', letterSpacing: '0.5px' }}>
                  ⏳ {awayFormationData.era}
                </span>
              )}
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
              <div
                onClick={() => setShowLineupsModal(true)}
                style={{ marginTop: '8px', cursor: 'pointer', transition: 'transform 0.2s ease' }}
                title="Click to view matchday lineups for both teams"
              >
                <FormationPitch formation={awayFormation} isSelected={false} size="small" />
              </div>
              <button
                type="button"
                onClick={() => setShowLineupsModal(true)}
                style={{
                  marginTop: '6px',
                  background: 'rgba(0, 229, 255, 0.1)',
                  border: '1px solid rgba(0, 229, 255, 0.35)',
                  borderRadius: '4px',
                  color: '#00e5ff',
                  fontSize: '8.5px',
                  fontFamily: 'Orbitron',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  letterSpacing: '0.5px'
                }}
              >
                👁️ VIEW TEAM LINEUP
              </button>
            </div>
          )}

          <div className="team-card-bars" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="rpg-bar">
              <span className="rpg-label">ATTACK: {awayTeam.attack}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${Math.min(100, awayTeam.attack * 20)}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">MIDFIELD: {awayTeam.midfield}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${Math.min(100, awayTeam.midfield * 20)}%` }}></div></div>
            </div>
            <div className="rpg-bar">
              <span className="rpg-label">DEFENSE: {awayTeam.defense}</span>
              <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${Math.min(100, awayTeam.defense * 20)}%` }}></div></div>
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
            lineup={playerTeamId !== null && teamtwoname === playerTeamId ? playerLineup : undefined}
            formation={awayFormation}
            playerRoles={playerTeamId !== null && teamtwoname === playerTeamId ? playerRoles : undefined}
            onToggleRole={playerTeamId !== null && teamtwoname === playerTeamId ? handleTogglePlayerRole : undefined}
          />
        </div>

      </div>

      {/* Pre-Match Tactical Lineups & Subs Modal */}
      {showLineupsModal && (
        <div
          className="sub-modal-overlay"
          onClick={() => setShowLineupsModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
        >
          <div
            className="sub-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #10131c 0%, #080a0f 100%)',
              border: '1.5px solid rgba(0, 255, 100, 0.35)',
              borderRadius: '12px',
              width: '95%',
              maxWidth: '1120px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 0 35px rgba(0, 255, 100, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 22px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>📋</span>
                <div>
                  <h2 style={{ margin: 0, fontFamily: 'Orbitron', color: '#00ff64', fontSize: '18px', letterSpacing: '1px' }}>
                    PRE-MATCH TEAM SHEETS & TACTICAL LINEUPS
                  </h2>
                  <div style={{ fontSize: '11px', color: '#aaa', fontFamily: 'Orbitron', marginTop: '3px' }}>
                    {homeTeam.name} vs {awayTeam.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLineupsModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px 12px',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Two-Column Lineup Body */}
            <div style={{ display: 'flex', gap: '20px', padding: '20px', flexWrap: 'wrap' }}>
              {renderTeamSheetColumn(homeTeam, true, homeFormation, homeTactic, homeResolvedLineup, homeResolvedBench, homeResolvedRoles)}
              {renderTeamSheetColumn(awayTeam, false, awayFormation, awayTactic, awayResolvedLineup, awayResolvedBench, awayResolvedRoles)}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 22px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <button
                type="button"
                onClick={() => setShowLineupsModal(false)}
                style={{
                  background: 'rgba(0, 255, 100, 0.15)',
                  border: '1px solid #00ff64',
                  color: '#00ff64',
                  fontFamily: 'Orbitron',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  letterSpacing: '1px'
                }}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
