import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import '../assets/styles/Match.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { clRules } from '../data/cl/clRules';
import { uefaRules } from '../data/uefa/uefaRules';
import { ueclRules } from '../data/uecl/ueclRules';
import { clibRules } from '../data/clib/clibRules';
import { csudRules } from '../data/csud/csudRules';
import { concacafRules } from '../data/concacaf/concacafRules';
import { getModifiedStat as computeModifiedStat, adjustCPUTactic as runCPUTacticAdjustment, TacticsPanel } from './MatchTactics';
import { getSubstitutionLimit, getStoppageLimit } from '../utils/matchRules';
import { getSavedFormation, getCPUFormation, updateTeamStatsInStorage, getFormationSlots, getIdealSlotPosition, getPositionPenalty, generateDefaultLineup } from './FormationTactics';
import { getPrebuiltRoster, getTeamDetails, getTeamDetailsSync, calculateMatchAttendance } from '../data/rosters/rosterRegistry';
import { getCPUMatchLineupAndStats } from '../utils/cpuSquadManager';
import {
  calculateTeamTacticalStats,
  getRoleMetadata,
  getNextRoleForSlot,
  summarizeActiveRoles,
  normalizeMentality
} from '../utils/tacticalRoleEngine';
import {
  getMidfieldWinCommentary,
  getMidfieldDrawCommentary,
  getAttackSuccessCommentary,
  getAttackFailCommentary,
  getGoalCommentary,
  getSaveCommentary,
  getPenaltyGoalCommentary,
  getPenaltyMissCommentary
} from './MatchCommentary';
import { initializeKnockouts } from "../utils/tournamentRules";
import { advanceDomesticCup } from "../utils/domesticCupGenerator";

const MATCH_REFEREES = [
  'Pierluigi Collina',
  'Graham Poll',
  'Mike Riley',
  'Howard Webb',
  'Uriah Rennie',
  'Steve Bennett',
  'Mark Halsey',
  'Dermot Gallagher',
  'David Elleray',
  'Paul Durkin'
];

function getContrastText(hexColor, fallback = '#ffffff') {
  if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#') || hexColor.length < 7) {
    return fallback;
  }
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 155 ? '#06131c' : '#ffffff';
}

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

// Unified Match Simulation Helper
const simulateFixture = (h, a) => {
  const midDiff = h.midfield - a.midfield;
  const homeChancesExp = Math.max(1, Math.min(6, 3.8 + midDiff * 0.4));
  const randomShift = (Math.random() - 0.5) * 2;
  const homeChances = Math.round(homeChancesExp + randomShift);
  const awayChances = 7 - homeChances;

  const homeConv = Math.max(0.1, Math.min(0.65, 0.3 + (h.attack - a.defense) * 0.05));
  const awayConv = Math.max(0.1, Math.min(0.65, 0.3 + (a.attack - h.defense) * 0.05));

  let homeGoals = 0;
  for (let i = 0; i < homeChances; i++) {
    if (Math.random() < homeConv) homeGoals++;
  }
  let awayGoals = 0;
  for (let i = 0; i < awayChances; i++) {
    if (Math.random() < awayConv) awayGoals++;
  }

  if (Math.random() < 0.12) homeGoals++;
  if (Math.random() < 0.12) awayGoals++;

  return { homeGoals, awayGoals };
};

const updateFanConfidence = (currentConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals) => {
  const pRating = playerTeam ? (playerTeam.attack + playerTeam.midfield + playerTeam.defense) / 3 : 3.0;
  const oRating = opponentTeam ? (opponentTeam.attack + opponentTeam.midfield + opponentTeam.defense) / 3 : 3.0;

  let change = 0;
  if (playerGoals > opponentGoals) {
    change = 6 + Math.round((oRating - pRating) * 4.5);
    change = Math.max(3, change);
  } else if (playerGoals < opponentGoals) {
    change = -6 + Math.round((oRating - pRating) * 4.5);
    change = Math.min(-3, change);
  } else {
    change = -2 + Math.round((oRating - pRating) * 5);
    change = Math.max(-8, Math.min(8, change));
  }

  const startingConf = currentConfidence !== undefined ? currentConfidence : 50;
  return Math.max(0, Math.min(100, startingConf + change));
};


// Post-match player condition depletion (fatigue), recovery, and injury updates
export const updatePlayerConditionsAndInjuries = (teamName, season, isTournamentMode, didPlayMatch = true, minutesPlayedMap = null) => {
  const rosterKey = `retro_roster_${teamName}_${season}`;
  const lineupKey = `retro_lineup_${teamName}_${season}`;

  const cachedRoster = localStorage.getItem(rosterKey);
  const cachedLineup = localStorage.getItem(lineupKey);

  if (!cachedRoster) return;

  try {
    let roster = JSON.parse(cachedRoster);
    let lineup = cachedLineup ? JSON.parse(cachedLineup) : {};

    // 1. Establish set of player names in starting lineup
    const startingNames = didPlayMatch
      ? new Set(Object.values(lineup).filter(Boolean).map(p => p.name))
      : new Set();

    const injuryAlerts = [];

    // 2. Loop through all roster players
    roster = roster.map(p => {
      let cond = p.condition !== undefined ? p.condition : 100;
      let injuryMatches = p.injuryMatchesLeft !== undefined ? p.injuryMatchesLeft : 0;
      let injury = p.injury || null;

      // Handle recovery of injured players
      if (injuryMatches > 0) {
        injuryMatches -= 1;
        if (injuryMatches === 0) {
          injury = null;
        }
        // Recover condition while injured (like bench players)
        const recoveryRate = p.age < 24
          ? 25 + Math.floor(Math.random() * 10)
          : (p.age < 30 ? 20 + Math.floor(Math.random() * 8) : 12 + Math.floor(Math.random() * 6));
        cond = Math.min(100, cond + recoveryRate);
      } else {
        // Player is healthy
        let playedMins = 0;
        let hasPlayed = false;

        if (minutesPlayedMap) {
          if (minutesPlayedMap[p.name] !== undefined) {
            playedMins = minutesPlayedMap[p.name];
            hasPlayed = playedMins > 0;
          }
        } else {
          hasPlayed = startingNames.has(p.name);
          playedMins = hasPlayed ? 90 : 0;
        }

        // Calculate potential full-match fatigue drop
        let fullFatigueDrop = 0;
        if (p.position === "GK") {
          fullFatigueDrop = p.age >= 30
            ? 1 + Math.floor(Math.random() * 3)
            : 1 + Math.floor(Math.random() * 2);
        } else {
          fullFatigueDrop = p.age >= 30
            ? 6 + Math.floor(Math.random() * 4)
            : (p.age < 24 ? 3 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 4));
        }

        const recoveryRate = p.age < 24
          ? 25 + Math.floor(Math.random() * 10)
          : (p.age < 30 ? 20 + Math.floor(Math.random() * 8) : 12 + Math.floor(Math.random() * 6));

        if (minutesPlayedMap) {
          // Manual match: turn-by-turn condition depletion was already applied.
          // We only add proportional recovery for the minutes they rested.
          const maxMins = Math.max(90, ...Object.values(minutesPlayedMap));
          const restRatio = Math.max(0, 1.0 - (playedMins / maxMins));
          const recovery = Math.round(recoveryRate * restRatio);
          cond = Math.min(100, cond + recovery);
        } else {
          // Simulated match: apply both proportional fatigue and recovery
          const maxMins = 90;
          const playRatio = Math.min(1.0, playedMins / maxMins);
          const restRatio = 1.0 - playRatio;

          const fatigue = Math.round(fullFatigueDrop * playRatio);
          const recovery = Math.round(recoveryRate * restRatio);

          cond = Math.max(0, Math.min(100, cond - fatigue + recovery));
        }

        // 1. Check for sudden match incident (impact injury) regardless of condition
        let impactInjuryChance = 0.015; // 1.5% chance per 90 mins played
        const maxMins = minutesPlayedMap ? Math.max(90, ...Object.values(minutesPlayedMap)) : 90;
        const playRatio = Math.min(1.0, playedMins / maxMins);
        impactInjuryChance = impactInjuryChance * playRatio;

        let gotImpactInjury = false;
        if (hasPlayed && Math.random() < impactInjuryChance) {
          gotImpactInjury = true;
        }

        // 2. Check for fatigue injury if condition is <= 60%
        let gotFatigueInjury = false;
        if (!gotImpactInjury && hasPlayed && cond <= 60) {
          let injuryChance = 0.15; // default for 50-60%
          if (cond < 40) {
            injuryChance = 0.45;
          } else if (cond < 50) {
            injuryChance = 0.25;
          }
          injuryChance = injuryChance * playRatio;
          if (Math.random() < injuryChance) {
            gotFatigueInjury = true;
          }
        }

        if (gotImpactInjury || gotFatigueInjury) {
          const injuries = [
            { name: "Bruised Ribs", duration: 1 + Math.floor(Math.random() * 2) },
            { name: "Twisted Ankle", duration: 2 + Math.floor(Math.random() * 2) },
            { name: "Pulled Hamstring", duration: 3 + Math.floor(Math.random() * 2) },
            { name: "Knee Sprain", duration: 5 + Math.floor(Math.random() * 2) }
          ];
          const selectedInjury = injuries[Math.floor(Math.random() * injuries.length)];
          injury = selectedInjury.name;
          injuryMatches = selectedInjury.duration;

          const cause = gotImpactInjury ? "in a hard tackle" : "due to fatigue";
          injuryAlerts.push(`🤕 ${p.name} (${p.position}, Age ${p.age}) suffered a ${injury} ${cause} (Out for ${injuryMatches} matches)`);
        }
      }

      return {
        ...p,
        condition: cond,
        injuryMatchesLeft: injuryMatches,
        injury: injury
      };
    });

    // 3. Sync condition/injury fields in the lineup without auto-removing injured players
    const newLineup = { ...lineup };
    let lineupChanged = false;
    Object.keys(newLineup).forEach(slotId => {
      const assigned = newLineup[slotId];
      if (assigned) {
        const rosterPlayer = roster.find(rp => rp.name === assigned.name);
        if (rosterPlayer) {
          newLineup[slotId] = {
            ...assigned,
            condition: rosterPlayer.condition,
            injuryMatchesLeft: rosterPlayer.injuryMatchesLeft,
            injury: rosterPlayer.injury
          };
          lineupChanged = true;
        }
      }
    });

    // 4. Save back to localStorage
    localStorage.setItem(rosterKey, JSON.stringify(roster));
    if (lineupChanged) {
      localStorage.setItem(lineupKey, JSON.stringify(newLineup));
    }

    // 5. Notify the user if there are any injuries
    if (injuryAlerts.length > 0) {
      alert(`⚠️ MEDICAL REPORT - INJURY UPDATES:\n\n${injuryAlerts.join("\n")}`);
    }

  } catch (err) {
    console.error("Error updating player conditions/injuries in Match.js", err);
  }
};

export default function Match() {
  const url = window.location.search;
  const urlsplit = url.split(/[?,&]/);
  const cup = urlsplit[1];
  const teamone = urlsplit[2];
  const teamtwo = urlsplit[3];

  const navigate = useNavigate();
  const location = useLocation();
  const startingTactics = location.state || {};

  // Dynamic parameters mapping (Friendly vs League vs Tournament vs Europe)
  const isLeague = cup === "league";
  const isTournament = cup === "tournament";
  const isEurope = cup === "europe";
  let leagueState = null;
  let tournamentState = null;
  let teamid = null;
  let teamonename = null;
  let teamtwoname = null;
  let playerTeamId = null;
  let isLeg2 = false;
  let leg1HomeScore = 0;
  let leg1AwayScore = 0;

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
    const activeClRules = leagueState.region === "south_america"
      ? clibRules
      : (leagueState.region === "north_america" ? concacafRules : clRules);
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

    if (!hasGroupStage && currentEvent.stage !== "final" && currentEvent.matchday === 2) {
      isLeg2 = true;
      const kStateKeyLeg1 = toCamelCase(currentEvent.stage) + "Leg1";
      const m1 = cupState.knockoutState[kStateKeyLeg1]?.find(f => f.homeId === pId || f.awayId === pId);
      if (m1) {
        leg1HomeScore = m1.homeScore;
        leg1AwayScore = m1.awayScore;
      }
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

  const [time, setTime] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  const [playMode] = useState(startingTactics.playMode || "manual");
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(2200);

  // Tactical choices: balanced, attack, defense
  const [homeTactic, setHomeTactic] = useState(() => {
    if (startingTactics.homeTactic !== undefined) {
      return normalizeMentality(startingTactics.homeTactic);
    }
    if (teamid && teamonename && teamtwoname) {
      const team = teamid[teamonename];
      const opp = teamid[teamtwoname];
      if (team && opp) {
        const diff = (team.attack + team.midfield + team.defense) - (opp.attack + opp.midfield + opp.defense);
        if (diff <= -3) return "defense";
        if (diff >= 3) return "attack";
      }
    }
    return "balanced";
  });
  const [awayTactic, setAwayTactic] = useState(() => {
    if (startingTactics.awayTactic !== undefined) {
      return normalizeMentality(startingTactics.awayTactic);
    }
    if (teamid && teamonename && teamtwoname) {
      const team = teamid[teamtwoname];
      const opp = teamid[teamonename];
      if (team && opp) {
        const diff = (team.attack + team.midfield + team.defense) - (opp.attack + opp.midfield + opp.defense);
        if (diff <= -3) return "defense";
        if (diff >= 3) return "attack";
      }
    }
    return "balanced";
  });

  const [homeCounter, setHomeCounter] = useState(() => {
    return startingTactics.homeCounter !== undefined ? startingTactics.homeCounter : false;
  });
  const [awayCounter, setAwayCounter] = useState(() => {
    return startingTactics.awayCounter !== undefined ? startingTactics.awayCounter : false;
  });
  const [homePressing, setHomePressing] = useState(() => {
    return startingTactics.homePressing !== undefined ? startingTactics.homePressing : false;
  });
  const [awayPressing, setAwayPressing] = useState(() => {
    return startingTactics.awayPressing !== undefined ? startingTactics.awayPressing : false;
  });
  const [homePressingDuration, setHomePressingDuration] = useState(0);
  const [awayPressingDuration, setAwayPressingDuration] = useState(0);

  const [homeSubs, setHomeSubs] = useState(0);
  const [awaySubs, setAwaySubs] = useState(0);
  const [homeStoppagesUsed, setHomeStoppagesUsed] = useState(0);
  const [awayStoppagesUsed, setAwayStoppagesUsed] = useState(0);
  const [subsBeforeModalOpen, setSubsBeforeModalOpen] = useState(0);

  const [showSubModal, setShowSubModal] = useState(false);
  const [squad, setSquad] = useState([]);
  const [lineup, setLineup] = useState({});
  const [playerRoles, setPlayerRoles] = useState({});
  const [savedStartingRoles, setSavedStartingRoles] = useState({});
  const [selectedRosterPlayer, setSelectedRosterPlayer] = useState(null);
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [dragOverSlotId, setDragOverSlotId] = useState(null);
  const [playerMinutes, setPlayerMinutes] = useState({});
  const [savedStartingLineup, setSavedStartingLineup] = useState(null);
  const [selectedBenchNames, setSelectedBenchNames] = useState([]);
  const [cpuStats, setCpuStats] = useState({});
  const [cpuLineups, setCpuLineups] = useState({});
  const [cpuBenches, setCpuBenches] = useState({});
  const [cpuRoles, setCpuRoles] = useState({});
  const [showOpponentModal, setShowOpponentModal] = useState(null);

  const getPlayerTeamNameAndSeason = useCallback(() => {
    let teamName = "";
    let season = "1995";

    if (isLeague || isEurope) {
      const raw = localStorage.getItem("retro_league_career");
      if (raw) {
        const parsed = JSON.parse(raw);
        const playerTeam = parsed.teams?.find(t => t.idnum === parsed.playerTeamId);
        if (playerTeam) teamName = playerTeam.name;
        season = parsed.season || "1995";
      }
    } else if (isTournament) {
      const raw = localStorage.getItem("retro_tournament_state");
      if (raw) {
        const parsed = JSON.parse(raw);
        const playerTeam = parsed.teams?.find(t => t.idnum === parsed.playerTeamId);
        if (playerTeam) teamName = playerTeam.name;
        season = parsed.cupId ? (parsed.cupId.match(/\d+/) ? parsed.cupId.match(/\d+/)[0] : "1995") : "1995";
      }
    }
    return { teamName, season };
  }, [isLeague, isEurope, isTournament]);

  useEffect(() => {
    let isMounted = true;
    const { teamName, season } = getPlayerTeamNameAndSeason();
    if (teamName) {
      const rosterKey = `retro_roster_${teamName}_${season}`;
      const lineupKey = `retro_lineup_${teamName}_${season}`;
      const rolesKey = `retro_roles_${teamName}_${season}`;
      const cachedRoster = localStorage.getItem(rosterKey);
      const cachedLineup = localStorage.getItem(lineupKey);
      const cachedRoles = localStorage.getItem(rolesKey);

      let loadedSquad = cachedRoster ? JSON.parse(cachedRoster) : [];
      let loadedLineup = cachedLineup ? JSON.parse(cachedLineup) : {};
      const isStale1To5 = loadedSquad.length > 0 && (
        !loadedSquad.some(p => Number(p.rating) > 5) &&
        !loadedSquad.some(p => p.wage !== undefined)
      );
      if (isStale1To5) {
        loadedSquad = [];
        loadedLineup = {};
      }
      let loadedRoles = {};
      if (cachedRoles) {
        try {
          loadedRoles = JSON.parse(cachedRoles) || {};
        } catch (e) {
          loadedRoles = {};
        }
      }

      const initializeMatchSquad = async () => {
        if (loadedSquad.length === 0) {
          const prebuilt = await getPrebuiltRoster(teamName, season);
          if (prebuilt && prebuilt.length >= 11) {
            loadedSquad = prebuilt;
            localStorage.setItem(rosterKey, JSON.stringify(loadedSquad));
          }
        }

        if (loadedSquad.length >= 11 && Object.keys(loadedLineup).length === 0) {
          loadedLineup = generateDefaultLineup(loadedSquad, getSavedFormation());
          localStorage.setItem(lineupKey, JSON.stringify(loadedLineup));
          updateTeamStatsInStorage(loadedLineup, getSavedFormation(), loadedRoles);
        }

        const currentRound = leagueState ? leagueState.currentRound : 1;
        if (currentRound === 1 && loadedSquad.length > 0) {
          let updated = false;
          loadedSquad = loadedSquad.map(p => {
            if (p.condition !== 100 || p.injuryMatchesLeft !== 0 || p.injury !== null) {
              updated = true;
            }
            return {
              ...p,
              condition: 100,
              injuryMatchesLeft: 0,
              injury: null
            };
          });
          if (updated) {
            localStorage.setItem(rosterKey, JSON.stringify(loadedSquad));

            // Also sync the lineup
            Object.keys(loadedLineup).forEach(slotId => {
              const player = loadedLineup[slotId];
              if (player) {
                const rosterPlayer = loadedSquad.find(p => p.name === player.name);
                if (rosterPlayer) {
                  loadedLineup[slotId] = rosterPlayer;
                }
              }
            });
            localStorage.setItem(lineupKey, JSON.stringify(loadedLineup));
          }
        }

        if (!isMounted) return;

        setSquad(loadedSquad);
        setLineup(loadedLineup);
        setPlayerRoles(loadedRoles);
        setSavedStartingLineup(JSON.parse(JSON.stringify(loadedLineup)));
        setSavedStartingRoles(JSON.parse(JSON.stringify(loadedRoles)));

        // Load selected bench names
        const benchKey = `retro_bench_${teamName}_${season}`;
        const cachedBench = localStorage.getItem(benchKey);
        let loadedBench = cachedBench ? JSON.parse(cachedBench) : [];
        if (loadedBench.length === 0 && loadedSquad.length > 0) {
          const startingNames = new Set(Object.values(loadedLineup).filter(Boolean).map(p => p.name));
          loadedBench = loadedSquad.filter(p => !startingNames.has(p.name)).slice(0, 7).map(p => p.name);
          localStorage.setItem(benchKey, JSON.stringify(loadedBench));
        }
        setSelectedBenchNames(loadedBench);

        // Initialize minutes tracker for all squad players
        const initialMinutes = {};
        loadedSquad.forEach(p => {
          const isStarting = Object.values(loadedLineup).some(lp => lp && lp.name === p.name);
          initialMinutes[p.name] = {
            name: p.name,
            started: isStarting,
            enteredAt: isStarting ? 0 : null,
            exitedAt: null,
            minutesPlayed: 0
          };
        });
        setPlayerMinutes(initialMinutes);
      };

      initializeMatchSquad();
    }
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLeague, isEurope, isTournament, getPlayerTeamNameAndSeason]);

  const getPositionColor = (pos) => {
    if (!pos) return '#aaa';
    const p = pos.toUpperCase();
    if (p === 'GK') return '#ffd700';
    if (['DL', 'DC', 'DR', 'DMC'].includes(p)) return '#00e5ff';
    if (['MC', 'MR', 'ML', 'AMC'].includes(p)) return '#00ff64';
    return '#ff4500';
  };

  const getLastName = (fullName) => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1];
  };

  const isPlayerHome = teamonename === playerTeamId;

  const handleTogglePlayerRole = (slotId, nextRole, player, slot) => {
    let resolvedSlot = slot;
    let resolvedPlayer = player || (lineup ? lineup[slotId] : null);
    if (!resolvedSlot) {
      const foundSlot = getFormationSlots(getSavedFormation()).find(s => s.id === slotId);
      if (foundSlot) {
        resolvedSlot = {
          ...foundSlot,
          idealPos: getIdealSlotPosition(foundSlot.role, foundSlot.x, foundSlot.y)
        };
      }
    }
    const currentRole = playerRoles[slotId] || 'normal';
    const resolvedNextRole = nextRole || (resolvedSlot ? getNextRoleForSlot(resolvedSlot, resolvedPlayer, currentRole) : 'normal');
    const nextRoles = { ...playerRoles, [slotId]: resolvedNextRole };
    setPlayerRoles(nextRoles);
    const { teamName, season } = getPlayerTeamNameAndSeason();
    if (teamName) {
      localStorage.setItem(`retro_roles_${teamName}_${season}`, JSON.stringify(nextRoles));
      updateTeamStatsInStorage(lineup, getSavedFormation(), nextRoles);
    }
    if (resolvedPlayer && resolvedSlot && time > 0) {
      const meta = getRoleMetadata(resolvedSlot, resolvedPlayer, resolvedNextRole);
      logEvent(`⚙️ Tactical duty: ${resolvedPlayer.name} (${resolvedSlot.idealPos || resolvedPlayer.position}) switched to ${meta.label}`, "normal");
    }
  };

  const executeSwap = (playerFromBench, targetSlotId, playerToBench) => {
    if (playerFromBench && playerFromBench.injuryMatchesLeft > 0) {
      alert(`${playerFromBench.name} is injured and cannot play! (${playerFromBench.injuryMatchesLeft} matches remaining)`);
      return;
    }
    if (playerFromBench && playerMinutes[playerFromBench.name] && playerMinutes[playerFromBench.name].exitedAt !== null) {
      alert(`${playerFromBench.name} has already been substituted out and cannot return to the field!`);
      return;
    }

    const { teamName, season } = getPlayerTeamNameAndSeason();

    const startingNames = new Set(Object.values(lineup).filter(Boolean).map(p => p.name));
    const isSub = playerFromBench && !startingNames.has(playerFromBench.name);

    if (isSub) {
      const currentSubs = isPlayerHome ? homeSubs : awaySubs;
      const maxSubs = getSubstitutionLimit(null, season);
      if (currentSubs >= maxSubs) {
        alert(`You have already used all ${maxSubs} substitutions!`);
        return;
      }

      const maxStoppages = getStoppageLimit(null, season);
      const currentStoppages = isPlayerHome ? homeStoppagesUsed : awayStoppagesUsed;
      if (time !== 45 && time !== 0 && currentStoppages >= maxStoppages) {
        alert(`You cannot make any more substitutions during active play as you have used all ${maxStoppages} stoppage windows!`);
        return;
      }
    }

    const newLineup = { ...lineup };
    let originSlotId = null;
    Object.keys(newLineup).forEach(k => {
      if (newLineup[k] && newLineup[k].name === playerFromBench.name) {
        originSlotId = k;
      }
    });

    if (originSlotId) {
      const existingInTarget = newLineup[targetSlotId];
      newLineup[originSlotId] = existingInTarget || null;
    }

    newLineup[targetSlotId] = playerFromBench;
    setLineup(newLineup);

    if (teamName) {
      localStorage.setItem(`retro_lineup_${teamName}_${season}`, JSON.stringify(newLineup));
      updateTeamStatsInStorage(newLineup, getSavedFormation());
    }

    if (isSub) {
      if (isPlayerHome) {
        setHomeSubs(prev => prev + 1);
        logEvent(`🔄 Sub: ${playerFromBench.name} comes on for ${playerToBench ? playerToBench.name : "empty slot"}!`, "normal");
      } else {
        setAwaySubs(prev => prev + 1);
        logEvent(`🔄 Sub: ${playerFromBench.name} comes on for ${playerToBench ? playerToBench.name : "empty slot"}!`, "normal");
      }

      setPlayerMinutes(prev => {
        const next = { ...prev };
        if (playerToBench && next[playerToBench.name]) {
          const entryTime = next[playerToBench.name].enteredAt !== null ? next[playerToBench.name].enteredAt : 0;
          next[playerToBench.name] = {
            ...next[playerToBench.name],
            exitedAt: time,
            minutesPlayed: next[playerToBench.name].minutesPlayed + (time - entryTime),
            enteredAt: null
          };
        }
        if (playerFromBench && next[playerFromBench.name]) {
          next[playerFromBench.name] = {
            ...next[playerFromBench.name],
            enteredAt: time,
            exitedAt: null
          };
        }
        return next;
      });
    } else {
      logEvent(`⚙️ Tactical realignment: ${playerFromBench.name} moved to ${targetSlotId.replace('-', ' ').toUpperCase()}`, "normal");
    }
  };

  const removePlayerFromField = (slotId, player) => {
    const { teamName, season } = getPlayerTeamNameAndSeason();
    const newLineup = { ...lineup };
    newLineup[slotId] = null;
    setLineup(newLineup);

    if (teamName) {
      localStorage.setItem(`retro_lineup_${teamName}_${season}`, JSON.stringify(newLineup));
      updateTeamStatsInStorage(newLineup, getSavedFormation());
    }

    setPlayerMinutes(prev => {
      const next = { ...prev };
      if (player && next[player.name]) {
        const entryTime = next[player.name].enteredAt !== null ? next[player.name].enteredAt : 0;
        next[player.name] = {
          ...next[player.name],
          exitedAt: time,
          minutesPlayed: next[player.name].minutesPlayed + (time - entryTime),
          enteredAt: null
        };
      }
      return next;
    });

    logEvent(`🤕 ${player.name} leaves the field! The team is now playing with ${Object.values(newLineup).filter(Boolean).length} players.`, "normal");
  };

  const handleCloseSubModal = () => {
    // Check if there are any injured players still in the starting lineup
    const injuredOnPitch = Object.values(lineup).filter(Boolean).filter(lp => lp.injuryMatchesLeft > 0);
    if (injuredOnPitch.length > 0) {
      alert(`You must substitute or remove injured players from the starting lineup before continuing! Injured: ${injuredOnPitch.map(p => p.name).join(', ')}`);
      return;
    }

    // Check if any substitutions were made and update stoppages count
    const subsAfter = isPlayerHome ? homeSubs : awaySubs;
    const subsUsed = subsAfter - subsBeforeModalOpen;
    if (subsUsed > 0 && time !== 45 && time !== 0) {
      if (isPlayerHome) {
        setHomeStoppagesUsed(prev => prev + 1);
      } else {
        setAwayStoppagesUsed(prev => prev + 1);
      }
    }

    setShowSubModal(false);
  };

  const handleHomeTacticChange = (newTactic) => {
    if (newTactic === homeTactic) return;
    setHomeTactic(newTactic);
    if (time > 0) {
      logEvent(`${teamid[teamonename].name} shifts mentality to ${newTactic.replace('_', ' ').toUpperCase()}!`, "normal");
    }
  };

  const handleAwayTacticChange = (newTactic) => {
    if (newTactic === awayTactic) return;
    setAwayTactic(newTactic);
    if (time > 0) {
      logEvent(`${teamid[teamtwoname].name} shifts mentality to ${newTactic.replace('_', ' ').toUpperCase()}!`, "normal");
    }
  };

  const handleCPUTacticChangeHome = (newTactic) => {
    if (newTactic === homeTactic) return;
    setHomeTactic(newTactic);
    if (time > 0) {
      logEvent(`${teamid[teamonename].name} changes mentality to ${newTactic.replace('_', ' ').toUpperCase()}!`, "normal");
    }
  };

  const handleCPUTacticChangeAway = (newTactic) => {
    if (newTactic === awayTactic) return;
    setAwayTactic(newTactic);
    if (time > 0) {
      logEvent(`${teamid[teamtwoname].name} changes mentality to ${newTactic.replace('_', ' ').toUpperCase()}!`, "normal");
    }
  };

  const [rollone, setrollOne] = useState(0);
  const [rolltwo, setRollTwo] = useState(0);

  const [scorehome, setScoreHome] = useState(0);
  const [scoreaway, setScoreAway] = useState(0);

  // RPG states
  const [hasHomeChance, setHasHomeChance] = useState(false);
  const [hasAwayChance, setHasAwayChance] = useState(false);
  const [hasHomeScoreChance, setHasHomeScoreChance] = useState(false);
  const [hasAwayScoreChance, setHasAwayScoreChance] = useState(false);

  const [showGoalFlash, setShowGoalFlash] = useState(false);
  const [goalSubtitle, setGoalSubtitle] = useState("");
  const [scoringTeamColors, setScoringTeamColors] = useState({ primary: "#ffd700", secondary: "#ffffff" });

  const triggerGoalFlash = (scoringTeam) => {
    // playSoundFile(goalAudioRef); // Commented out for now
    const GOAL_SUBTITLES = [
      "WHAT A STRIKE!",
      "SENSATIONAL SHOT!",
      "THE CROWD GOES WILD!",
      "UNSTOPPABLE FINISH!",
      "MAGIC MOMENT!",
      "AN ABSOLUTE BEAUTY!",
      "INTO THE BACK OF THE NET!",
      "PURE GENIUS!",
      "THEY'VE DONE IT!"
    ];
    const randomSub = GOAL_SUBTITLES[Math.floor(Math.random() * GOAL_SUBTITLES.length)];
    setGoalSubtitle(randomSub);

    if (scoringTeam) {
      setScoringTeamColors({
        primary: scoringTeam.primaryColor || "#ffd700",
        secondary: scoringTeam.secondaryColor || "#ffffff"
      });
    } else {
      setScoringTeamColors({ primary: "#ffd700", secondary: "#ffffff" });
    }

    setShowGoalFlash(true);
    setTimeout(() => {
      setShowGoalFlash(false);
    }, 3200);
  };

  // Penalty shootouts states
  const [isPenaltyShootout, setIsPenaltyShootout] = useState(false);
  const [homepenalty, setHomePenalty] = useState(0);
  const [awaypenalty, setAwayPenalty] = useState(0);
  const [penaltyFirstShooter, setPenaltyFirstShooter] = useState(null);
  const [penaltyTurn, setPenaltyTurn] = useState(null);
  const [penaltyHomeShots, setPenaltyHomeShots] = useState(0);
  const [penaltyAwayShots, setPenaltyAwayShots] = useState(0);
  const [penaltyWinner, setPenaltyWinner] = useState(null);
  const [isPenaltyCPUProcessing, setIsPenaltyCPUProcessing] = useState(false);

  const [referee] = useState(() => MATCH_REFEREES[Math.floor(Math.random() * MATCH_REFEREES.length)]);

  // Event feed chronicle & CM 01/02 Live Banner
  const [chronicle, setChronicle] = useState([
    {
      time: 0,
      text: `Match starting: ${teamid[teamonename]?.name || 'Home'} vs ${teamid[teamtwoname]?.name || 'Away'}`,
      type: 'normal',
      side: 'neutral'
    }
  ]);
  const [liveBanner, setLiveBanner] = useState({
    time: 0,
    text: `⚽ Match starting: ${teamid[teamonename]?.name || 'Home'} vs ${teamid[teamtwoname]?.name || 'Away'}`,
    type: 'normal',
    side: 'neutral'
  });

  // Visual ball position
  const [ballPosition, setBallPosition] = useState('center');

  // CM 01/02 Sound effects playback
  const playCMSound = useCallback((soundFile) => {
    if (!soundFile) return;
    try {
      const normalized = soundFile.toLowerCase();
      const audio = new Audio(`/sounds/cm/${normalized}`);
      audio.volume = 0.65;
      audio.play().catch(() => { });
    } catch (e) {
      // browser audio policy
    }
  }, []);

  const logEvent = useCallback((payload, type = 'normal', side = 'neutral') => {
    let text = payload;
    let sound = null;
    let eventSide = side;

    if (payload && typeof payload === 'object') {
      text = payload.text || String(payload);
      sound = payload.sound || null;
      // Only fallback to payload.side if the caller didn't specify an explicit home/away side
      if ((!side || side === 'neutral') && payload.side && (payload.side === 'home' || payload.side === 'away')) {
        eventSide = payload.side;
      }
    }

    if (sound) {
      playCMSound(sound);
    }

    const newEvent = { time, text: String(text), type, side: eventSide };
    setChronicle(prev => [newEvent, ...prev]);
    setLiveBanner(newEvent);
  }, [time, playCMSound]);

  const getTeamLineup = useCallback((teamKey) => {
    if (teamKey === null || teamKey === undefined) return null;
    if (teamKey === playerTeamId) {
      return (lineup && Object.keys(lineup).length > 0) ? lineup : null;
    }
    if (cpuLineups && cpuLineups[teamKey] && Object.keys(cpuLineups[teamKey]).length > 0) {
      return cpuLineups[teamKey];
    }
    if (teamKey === teamonename && !isHomeDisabled && lineup && Object.keys(lineup).length > 0) {
      return lineup;
    }
    if (teamKey === teamtwoname && !isAwayDisabled && lineup && Object.keys(lineup).length > 0) {
      return lineup;
    }
    return null;
  }, [playerTeamId, lineup, cpuLineups, teamonename, teamtwoname, isHomeDisabled, isAwayDisabled]);

  const getCommentaryBarStyle = () => {
    if (!liveBanner) {
      return { background: '#092131', color: '#ffdd44', borderColor: '#00a2a2' };
    }
    if (liveBanner.type === 'goal') {
      return {
        background: '#cc0000',
        color: '#ffffff',
        borderColor: '#ffd700'
      };
    }
    if (liveBanner.side === 'home' && teamid[teamonename]?.primaryColor) {
      const bg = teamid[teamonename].primaryColor;
      return {
        background: bg,
        color: getContrastText(bg),
        borderColor: teamid[teamonename].secondaryColor || '#ffffff'
      };
    }
    if (liveBanner.side === 'away' && teamid[teamtwoname]?.primaryColor) {
      const bg = teamid[teamtwoname].primaryColor;
      return {
        background: bg,
        color: getContrastText(bg),
        borderColor: teamid[teamtwoname].secondaryColor || '#ffffff'
      };
    }
    return {
      background: '#092131',
      color: '#e0f0f5',
      borderColor: '#00a2a2'
    };
  };

  // Persistent refs for audio elements to prevent recreation on re-renders
  const crowdAudioRef = useRef(null);
  const kickAudioRef = useRef(null);
  const whistleAudioRef = useRef(null);
  const finalWhistleAudioRef = useRef(null);
  // const goalAudioRef = useRef(null); // Commented out for now

  // Transition tracking refs for whistles
  const prevTimeRef = useRef(0);
  const prevIsGameOverRef = useRef(false);
  const prevIsPenaltyShootoutRef = useRef(false);

  // Initialize audio files on mount and cleanup on unmount
  useEffect(() => {
    crowdAudioRef.current = new Audio('/sounds/crowd.mp3');
    crowdAudioRef.current.loop = true;
    crowdAudioRef.current.volume = 0.2; // Ambient background crowd volume

    kickAudioRef.current = new Audio('/sounds/ball-kick.mp3');
    kickAudioRef.current.volume = 0.5;

    whistleAudioRef.current = new Audio('/sounds/whistle.mp3');
    whistleAudioRef.current.volume = 0.6;

    finalWhistleAudioRef.current = new Audio('/sounds/final_whistle.mp3');
    finalWhistleAudioRef.current.volume = 0.6;

    // goalAudioRef.current = new Audio('/sounds/goal.mp3'); // Commented out for now
    // goalAudioRef.current.volume = 0.6;

    return () => {
      if (crowdAudioRef.current) {
        crowdAudioRef.current.pause();
        crowdAudioRef.current = null;
      }
      if (kickAudioRef.current) {
        kickAudioRef.current.pause();
        kickAudioRef.current = null;
      }
      if (whistleAudioRef.current) {
        whistleAudioRef.current.pause();
        whistleAudioRef.current = null;
      }
      if (finalWhistleAudioRef.current) {
        finalWhistleAudioRef.current.pause();
        finalWhistleAudioRef.current = null;
      }
      // if (goalAudioRef.current) {
      //   goalAudioRef.current.pause();
      //   goalAudioRef.current = null;
      // }
    };
  }, []);

  // Helper to play sound with error handling for autoplay restrictions
  const playSoundFile = (audioRef) => {
    if (audioRef && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log("Audio playback blocked by browser/user interaction policies:", err);
      });
    }
  };

  // Play ball-kick.mp3 whenever ballPosition changes during active play
  useEffect(() => {
    if (time > 0 && !isGameOver && !isPenaltyShootout) {
      playSoundFile(kickAudioRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ballPosition]);

  // Play crowd.mp3 in the background when simulation is running/active
  const shouldPlayCrowd = !isGameOver && !isPenaltyShootout && (playMode === "manual" ? true : isPlaying);
  useEffect(() => {
    if (!crowdAudioRef.current) return;
    if (shouldPlayCrowd) {
      crowdAudioRef.current.play().catch(err => {
        console.log("Crowd audio playback failed:", err);
      });
    } else {
      crowdAudioRef.current.pause();
    }
  }, [shouldPlayCrowd]);

  // Manage referee whistle sounds on key match transitions
  useEffect(() => {
    // 1. Kickoffs (whistle.mp3)
    if (prevTimeRef.current === 90 && time === 93) {
      // Extra Time kickoff
      playSoundFile(whistleAudioRef);
    }

    // 2. End of halves (final_whistle.mp3)
    if (prevTimeRef.current === 42 && time === 45) {
      playSoundFile(finalWhistleAudioRef);
    } else if (prevTimeRef.current === 87 && time === 90) {
      playSoundFile(finalWhistleAudioRef);
    } else if (prevTimeRef.current === 117 && time === 120) {
      playSoundFile(finalWhistleAudioRef);
    }

    // 3. Penalty shootout end (final_whistle.mp3)
    if (!prevIsGameOverRef.current && isGameOver && isPenaltyShootout) {
      playSoundFile(finalWhistleAudioRef);
    }

    // Update refs for tracking next transitions
    prevTimeRef.current = time;
    prevIsGameOverRef.current = isGameOver;
    prevIsPenaltyShootoutRef.current = isPenaltyShootout;
  }, [time, isGameOver, isPenaltyShootout]);

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

  const playerFormation = getSavedFormation();

  const homeFormation = (playerTeamId !== null && teamonename === playerTeamId)
    ? playerFormation
    : getCPUFormation(teamid[teamonename], teamid[teamtwoname], year);

  const awayFormation = (playerTeamId !== null && teamtwoname === playerTeamId)
    ? playerFormation
    : getCPUFormation(teamid[teamtwoname], teamid[teamonename], year);

  const [homeDetails, setHomeDetails] = useState(() => getTeamDetailsSync(teamid?.[teamonename]?.name, year));
  const [awayDetails, setAwayDetails] = useState(() => getTeamDetailsSync(teamid?.[teamtwoname]?.name, year));

  useEffect(() => {
    let isMounted = true;
    const loadDetails = async () => {
      try {
        if (teamid?.[teamonename]?.name) {
          const hDet = await getTeamDetails(teamid[teamonename].name, year);
          if (isMounted && hDet) setHomeDetails(hDet);
        }
        if (teamid?.[teamtwoname]?.name) {
          const aDet = await getTeamDetails(teamid[teamtwoname].name, year);
          if (isMounted && aDet) setAwayDetails(aDet);
        }
      } catch (err) {
        console.warn("Failed to load team details in Match:", err);
      }
    };
    loadDetails();
    return () => { isMounted = false; };
  }, [teamid, teamonename, teamtwoname, year]);

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

  const stadium = homeDetails?.stadium;
  const stadiumName = stadium?.name || "";
  const stadiumCapacity = stadium?.capacity || stadium?.seating || 0;

  const attendanceInfo = useMemo(() => {
    if (!stadiumCapacity || !teamid?.[teamonename] || !teamid?.[teamtwoname]) return null;
    const seed = `${teamid[teamonename].name}_${teamid[teamtwoname].name}_${year}`;
    return calculateMatchAttendance(teamid[teamonename], teamid[teamtwoname], stadiumCapacity, seed);
  }, [stadiumCapacity, teamid, teamonename, teamtwoname, year]);

  const getBaseStat = (teamKey, statType) => {
    const isHome = teamKey === teamonename;
    const formation = isHome ? homeFormation : awayFormation;

    // If this is the player's team and we have a lineup, compute base stat using saved starting roles & balanced mentality
    if (playerTeamId !== null && teamKey === playerTeamId && lineup && Object.keys(lineup).filter(k => lineup[k]).length >= 7) {
      const startingRoles = (savedStartingRoles && Object.keys(savedStartingRoles).length > 0) ? savedStartingRoles : playerRoles;
      const baseCalc = calculateTeamTacticalStats(lineup, formation, startingRoles, 'balanced');
      return baseCalc[statType] !== undefined ? baseCalc[statType] : 3;
    }

    // If CPU team has an active lineup, compute base stat (normal roles, balanced mentality)
    if (cpuLineups && cpuLineups[teamKey] && Object.keys(cpuLineups[teamKey]).filter(k => cpuLineups[teamKey][k]).length >= 7) {
      const baseCalc = calculateTeamTacticalStats(cpuLineups[teamKey], formation, {}, 'balanced');
      return baseCalc[statType] !== undefined ? baseCalc[statType] : 3;
    }

    if (cpuStats && cpuStats[teamKey] && cpuStats[teamKey][statType] !== undefined) {
      return cpuStats[teamKey][statType];
    }
    if (teamid && teamid[teamKey] && teamid[teamKey][statType] !== undefined) {
      return teamid[teamKey][statType];
    }
    return 3;
  };

  const getModifiedStat = (teamKey, statType) => {
    const baseValue = getBaseStat(teamKey, statType);
    const isHome = teamKey === teamonename;
    const tactic = isHome ? homeTactic : awayTactic;
    const counter = isHome ? homeCounter : awayCounter;
    const pressing = isHome ? homePressing : awayPressing;
    const oppPressing = isHome ? awayPressing : homePressing;
    const pressingDuration = isHome ? homePressingDuration : awayPressingDuration;
    const formation = isHome ? homeFormation : awayFormation;

    const isPlayerSide = playerTeamId !== null && teamKey === playerTeamId;
    const activeLineup = isPlayerSide ? lineup : (cpuLineups ? cpuLineups[teamKey] : null);
    const activeRoles = isPlayerSide ? playerRoles : (cpuRoles && cpuRoles[teamKey] ? cpuRoles[teamKey] : {});

    return computeModifiedStat(
      baseValue,
      statType,
      tactic,
      counter,
      pressing,
      oppPressing,
      pressingDuration,
      formation,
      null,
      activeLineup,
      activeRoles
    );
  };

  // Load CPU authentic starting lineups, rotation, tactical roles, and dynamic strength ratings
  useEffect(() => {
    let isMounted = true;
    const loadCPUSquads = async () => {
      if (!teamid) return;
      const newStats = {};
      const newLineups = {};
      const newBenches = {};
      const newRoles = {};
      const currentCalEvent = leagueState?.calendar ? leagueState.calendar[leagueState.calendarIndex] : null;
      const isDomCup = isLeague && currentCalEvent && (currentCalEvent.type === "domestic_cup" || currentCalEvent.isDomesticCup);
      const isCupMatch = Boolean(cup || isEurope || isDomCup || isTournament || (!isLeague && !isEurope));

      // Home team if CPU
      if (teamonename !== null && teamonename !== playerTeamId && teamid[teamonename]) {
        const hTeam = teamid[teamonename];
        const oppTeam = teamid[teamtwoname];
        const res = await getCPUMatchLineupAndStats(
          hTeam.name,
          hTeam,
          year,
          homeFormation,
          isCupMatch,
          oppTeam,
          true,
          teamtwoname === playerTeamId ? lineup : null,
          awayFormation
        );
        if (res && res.stats) {
          newStats[teamonename] = res.baseStats || res.stats;
          newLineups[teamonename] = res.lineup;
          newBenches[teamonename] = res.bench;
          newRoles[teamonename] = res.roles || {};
          if (isMounted && res.mentality) {
            setHomeTactic(res.mentality);
          }
        }
      }

      // Away team if CPU
      if (teamtwoname !== null && teamtwoname !== playerTeamId && teamid[teamtwoname]) {
        const aTeam = teamid[teamtwoname];
        const oppTeam = teamid[teamonename];
        const res = await getCPUMatchLineupAndStats(
          aTeam.name,
          aTeam,
          year,
          awayFormation,
          isCupMatch,
          oppTeam,
          false,
          teamonename === playerTeamId ? lineup : null,
          homeFormation
        );
        if (res && res.stats) {
          newStats[teamtwoname] = res.baseStats || res.stats;
          newLineups[teamtwoname] = res.lineup;
          newBenches[teamtwoname] = res.bench;
          newRoles[teamtwoname] = res.roles || {};
          if (isMounted && res.mentality) {
            setAwayTactic(res.mentality);
          }
        }
      }

      if (isMounted) {
        setCpuStats(newStats);
        setCpuLineups(newLineups);
        setCpuBenches(newBenches);
        setCpuRoles(newRoles);
      }
    };

    loadCPUSquads();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamonename, teamtwoname, playerTeamId, year, homeFormation, awayFormation, cup, isEurope]);

  const adjustCPUTactic = (teamKey, opponentKey, scoreSelf, scoreOpp, isHomeSide, setTacticSetter, setCounterSetter, setPressingSetter, currentMatchTime) => {
    const team = teamid[teamKey];
    const opp = teamid[opponentKey];
    if (!team || !opp) return;

    const selfFormation = isHomeSide ? homeFormation : awayFormation;
    const oppFormation = isHomeSide ? awayFormation : homeFormation;
    const selfLineup = cpuLineups[teamKey] || {};
    const oppLineup = (opponentKey === playerTeamId) ? lineup : (cpuLineups[opponentKey] || {});
    const currentTactic = isHomeSide ? homeTactic : awayTactic;
    const currentTeamRoles = cpuRoles[teamKey] || {};

    let proposedTactic = currentTactic;
    let proposedRoles = currentTeamRoles;

    runCPUTacticAdjustment({
      team,
      opp,
      lineup: selfLineup,
      formation: selfFormation,
      oppLineup,
      oppFormation,
      scoreSelf,
      scoreOpp,
      isLeg2,
      leg1HomeScore,
      leg1AwayScore,
      currentMatchTime,
      isHomeSide,
      currentMentality: currentTactic,
      currentRoles: currentTeamRoles,
      setTactic: (t) => { proposedTactic = t; },
      setRoles: (r) => { proposedRoles = r; }
    });

    const setTactic = isHomeSide ? setHomeTactic : setAwayTactic;
    const teamName = team.name;

    // Update CPU player roles and log if roles changed during active play
    const prevSummary = summarizeActiveRoles(selfLineup, selfFormation, currentTeamRoles)
      .map(s => `${s.lastName} (${s.shortLabel})`).join(', ');
    const nextSummary = summarizeActiveRoles(selfLineup, selfFormation, proposedRoles)
      .map(s => `${s.lastName} (${s.shortLabel})`).join(', ');

    if (prevSummary !== nextSummary) {
      setCpuRoles(prev => ({
        ...prev,
        [teamKey]: proposedRoles
      }));
      if (currentMatchTime > 0 && nextSummary) {
        logEvent(`🧠 ${teamName} tactical shift: ${nextSummary}`, "normal");
      }
    }

    const tacticChanged = proposedTactic !== currentTactic;

    if (tacticChanged) {
      setTactic(proposedTactic);
      if (currentMatchTime > 0) {
        const label = proposedTactic === 'defense' ? 'DEFENSIVE' : (proposedTactic === 'attack' ? 'ATTACKING' : 'NORMAL');
        logEvent(`📋 ${teamName} changes mentality to ${label}!`, "normal");
      }
    }
  };

  const handleSubstitution = (isHome) => {
    const { season } = getPlayerTeamNameAndSeason();
    const maxSubs = getSubstitutionLimit(null, season);
    if (isHome) {
      if (homeSubs >= maxSubs) return;
      setHomeSubs(prev => prev + 1);
      logEvent(`🔄 Substitution for ${teamid[teamonename].name}: fresh legs brought on!`, "normal");
    } else {
      if (awaySubs >= maxSubs) return;
      setAwaySubs(prev => prev + 1);
      logEvent(`🔄 Substitution for ${teamid[teamtwoname].name}: fresh legs brought on!`, "normal");
    }
  };

  function increaseTime() {
    if (isGameOver) return;

    // Deplete individual player conditions for the active lineup
    const { teamName, season } = getPlayerTeamNameAndSeason();
    if (Object.keys(lineup).length > 0) {
      let lineupChanged = false;
      let injuredPlayerName = null;
      let injuredPlayerMsg = null;
      const newLineup = { ...lineup };
      const updatedSquad = squad.map(sp => {
        // If this player is in the current starting lineup on the field
        const slotEntry = Object.entries(newLineup).find(([slotId, lp]) => lp && lp.name === sp.name);
        if (slotEntry) {
          const [slotId, lp] = slotEntry;

          let drop = 0;
          if (sp.position === "GK") {
            // GK depletes much slower: ~1-2% chance of 1% drop per 3 mins
            drop = Math.random() < 0.06 ? 1 : 0;
          } else {
            // Other positions deplete ~5-9% over 90 mins (approx 0.27-0.39% drop per 3-min turn)
            // Pressing increases fatigue
            const isPressingActive = isPlayerHome ? homePressing : awayPressing;
            const threshold = isPressingActive ? 0.39 : 0.27;
            drop = Math.random() < threshold ? 1 : 0;
          }

          let newCond = Math.max(0, sp.condition - drop);
          lineupChanged = true;

          // Mid-match injury check
          let injuryMatches = sp.injuryMatchesLeft !== undefined ? sp.injuryMatchesLeft : 0;
          let injury = sp.injury || null;

          if (injuryMatches === 0) {
            let turnInjuryChance = 0.0003; // ~0.03% base chance for fit players per 3 mins
            if (newCond <= 40) {
              turnInjuryChance = 0.005; // 0.5% chance per turn for extremely exhausted players
            } else if (newCond <= 60) {
              turnInjuryChance = 0.0025; // 0.25% chance per turn
            } else if (newCond <= 80) {
              turnInjuryChance = 0.001; // 0.1% chance per turn
            }

            if (Math.random() < turnInjuryChance) {
              const injuries = [
                { name: "Bruised Ribs", duration: 1 + Math.floor(Math.random() * 2) },
                { name: "Twisted Ankle", duration: 2 + Math.floor(Math.random() * 2) },
                { name: "Pulled Hamstring", duration: 3 + Math.floor(Math.random() * 2) },
                { name: "Knee Sprain", duration: 5 + Math.floor(Math.random() * 2) }
              ];
              const selectedInjury = injuries[Math.floor(Math.random() * injuries.length)];
              injury = selectedInjury.name;
              injuryMatches = selectedInjury.duration;
              newCond = Math.max(0, newCond - 30); // drop condition due to injury

              injuredPlayerName = sp.name;
              injuredPlayerMsg = `🤕 INJURY ALERT!\n\n${sp.name} (${sp.position}, Age ${sp.age}) has suffered a ${injury} and cannot continue! (Out for ${injuryMatches} matches)\n\nPlease open the substitution modal to replace or remove him.`;
            }
          }

          newLineup[slotId] = {
            ...lp,
            condition: newCond,
            injuryMatchesLeft: injuryMatches,
            injury: injury
          };

          return {
            ...sp,
            condition: newCond,
            injuryMatchesLeft: injuryMatches,
            injury: injury
          };
        }
        return sp;
      });

      if (lineupChanged) {
        setSquad(updatedSquad);
        setLineup(newLineup);

        if (teamName) {
          const rosterKey = `retro_roster_${teamName}_${season}`;
          const lineupKey = `retro_lineup_${teamName}_${season}`;
          localStorage.setItem(rosterKey, JSON.stringify(updatedSquad));
          localStorage.setItem(lineupKey, JSON.stringify(newLineup));

          updateTeamStatsInStorage(newLineup, getSavedFormation());
        }
      }

      if (injuredPlayerName) {
        logEvent(`🤕 INJURY: ${injuredPlayerName} is forced off the pitch due to injury!`, "normal");
        setIsPlaying(false);
        setShowSubModal(true);
        setTimeout(() => {
          alert(injuredPlayerMsg);
        }, 100);
      }
    }

    if (homePressing) {
      setHomePressingDuration(prev => prev + 3);
    } else {
      setHomePressingDuration(prev => Math.max(0, prev - 3));
    }

    if (awayPressing) {
      setAwayPressingDuration(prev => prev + 3);
    } else {
      setAwayPressingDuration(prev => Math.max(0, prev - 3));
    }

    setHasHomeChance(false);
    setHasAwayChance(false);
    setHasHomeScoreChance(false);
    setHasAwayScoreChance(false);
    setBallPosition("center");

    const nextTime = time + 3;
    setTime(nextTime);

    // AI CPU substitutions
    if (nextTime >= 45) {
      const maxSubs = getSubstitutionLimit(null, season);
      const maxStoppages = getStoppageLimit(null, season);

      // Home CPU sub
      if (isHomeDisabled && homeSubs < maxSubs && nextTime >= 60 && Math.random() < 0.20) {
        const isStoppage = nextTime !== 45;
        if (!isStoppage || maxStoppages >= 99 || homeStoppagesUsed < maxStoppages) {
          setHomeSubs(prev => prev + 1);
          if (isStoppage && maxStoppages < 99) {
            setHomeStoppagesUsed(prev => prev + 1);
          }
          logEvent(`🔄 Substitution for ${teamid[teamonename].name}: fresh legs brought on!`, "normal");
        }
      }
      // Away CPU sub
      if (isAwayDisabled && awaySubs < maxSubs && nextTime >= 60 && Math.random() < 0.20) {
        const isStoppage = nextTime !== 45;
        if (!isStoppage || maxStoppages >= 99 || awayStoppagesUsed < maxStoppages) {
          setAwaySubs(prev => prev + 1);
          if (isStoppage && maxStoppages < 99) {
            setAwayStoppagesUsed(prev => prev + 1);
          }
          logEvent(`🔄 Substitution for ${teamid[teamtwoname].name}: fresh legs brought on!`, "normal");
        }
      }
    }

    // Dynamic AI reactive tactical adjustments (dependent on strength, time, and scoreline)
    if (playerTeamId === null || teamonename !== playerTeamId) {
      adjustCPUTactic(teamonename, teamtwoname, scorehome, scoreaway, true, handleCPUTacticChangeHome, setHomeCounter, setHomePressing, nextTime);
    }
    if (playerTeamId === null || teamtwoname !== playerTeamId) {
      adjustCPUTactic(teamtwoname, teamonename, scoreaway, scorehome, false, handleCPUTacticChangeAway, setAwayCounter, setAwayPressing, nextTime);
    }
  }

  // Hook to initialize tactics at kickoff (dependent on team strength relative to player)
  useEffect(() => {
    if (teamid && teamonename && teamtwoname) {
      if (playerTeamId === null || teamonename !== playerTeamId) {
        adjustCPUTactic(teamonename, teamtwoname, 0, 0, true, handleCPUTacticChangeHome, setHomeCounter, setHomePressing, 0);
      }
      if (isAwayDisabled || teamtwoname !== playerTeamId) {
        adjustCPUTactic(teamtwoname, teamonename, 0, 0, false, handleCPUTacticChangeAway, setAwayCounter, setAwayPressing, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamid, teamonename, teamtwoname, playerTeamId]);

  // Automatically track substitution count when the sub modal is opened
  useEffect(() => {
    if (showSubModal) {
      setSubsBeforeModalOpen(isPlayerHome ? homeSubs : awaySubs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSubModal]);

  // Automatically pause autoplay and initialize penalty shootout
  useEffect(() => {
    if (isPenaltyShootout) {
      setIsPlaying(false);
      // Determine first shooter randomly (Coin toss)
      const first = Math.random() > 0.5 ? 'home' : 'away';
      setPenaltyFirstShooter(first);
      setPenaltyTurn(first);
      setHomePenalty(0);
      setAwayPenalty(0);
      setPenaltyHomeShots(0);
      setPenaltyAwayShots(0);
      setPenaltyWinner(null);
      setIsPenaltyCPUProcessing(false);
      if (teamid && teamonename && teamtwoname) {
        logEvent(`📢 PENALTY SHOOTOUT! A coin toss decided that ${teamid[first === 'home' ? teamonename : teamtwoname].name} will shoot first!`, "kickoff");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPenaltyShootout]);

  // CPU shoots automatically when it is their turn
  useEffect(() => {
    if (!isPenaltyShootout || !penaltyTurn || penaltyWinner || isPenaltyCPUProcessing) return;

    const isHomeTurn = (penaltyTurn === 'home');
    const isCPUTurn = isHomeTurn ? isHomeDisabled : isAwayDisabled;

    if (isCPUTurn) {
      setIsPenaltyCPUProcessing(true);
      const delay = Math.max(1600, simSpeed * 1.2);
      const timer = setTimeout(() => {
        executePenalty(penaltyTurn);
        setIsPenaltyCPUProcessing(false);
      }, delay);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPenaltyShootout, penaltyTurn, penaltyWinner, isHomeDisabled, isAwayDisabled, simSpeed]);

  // Autoplay game loop
  useEffect(() => {
    if (playMode !== "auto" || !isPlaying || isGameOver || isPenaltyShootout || showGoalFlash) {
      return;
    }

    // Dynamic pacing: grant extra time during key attack build-ups and goal chances so commentary can be comfortably read
    let stepDelay = simSpeed;
    if (hasHomeScoreChance || hasAwayScoreChance) {
      stepDelay = Math.round(simSpeed * 1.3);
    } else if (hasHomeChance || hasAwayChance) {
      stepDelay = Math.round(simSpeed * 1.15);
    }

    const timer = setTimeout(() => {
      if (hasHomeScoreChance) {
        handleHomeScoreChance();
      } else if (hasAwayScoreChance) {
        handleAwayScoreChance();
      } else if (hasHomeChance) {
        handleHomeChance();
      } else if (hasAwayChance) {
        handleAwayChance();
      } else {
        increaseTime();
      }
    }, stepDelay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playMode,
    isPlaying,
    isGameOver,
    isPenaltyShootout,
    showGoalFlash,
    time,
    hasHomeChance,
    hasAwayChance,
    hasHomeScoreChance,
    hasAwayScoreChance,
    simSpeed
  ]);

  useEffect(() => {
    if (time === 0) {
      logEvent({
        text: `Referee ${referee} calls the captains. KICK OFF! The match is underway!`,
        sound: "kickoff.wav"
      }, "kickoff", "neutral");
      return;
    }

    if (time === 45) {
      logEvent({
        text: `Halftime whistle blows! ${teamid[teamonename].name} ${scorehome} - ${scoreaway} ${teamid[teamtwoname].name}. The players head to the lockers.`,
        sound: "halfwhis.wav"
      }, "kickoff", "neutral");
      setHomePressingDuration(prev => Math.max(0, prev - 10));
      setAwayPressingDuration(prev => Math.max(0, prev - 10));
      setIsPlaying(false);
      return;
    }

    if (time === 90) {
      let needsExtraTime = false;
      let playerAgg = 0;
      let oppAgg = 0;
      let isKnockoutLeg2 = false;

      const currentCalEvent = leagueState?.calendar ? leagueState.calendar[leagueState.calendarIndex] : null;
      const isDomesticCupMatch = isLeague && currentCalEvent && (currentCalEvent.type === "domestic_cup" || currentCalEvent.isDomesticCup);

      if (isDomesticCupMatch) {
        needsExtraTime = (scorehome === scoreaway);
      } else if (isLeague || (isTournament && (tournamentState?.stage === "groups" || tournamentState?.stage === "finalGroup"))) {
        needsExtraTime = false;
      } else if (isEurope) {
        // Parse European cup parameters dynamically from active save state
        const raw = localStorage.getItem("retro_league_career");
        const lState = JSON.parse(raw);
        const currentEvent = lState.calendar[lState.calendarIndex];
        const cupState = lState.europeanCupState;
        const pId = cupState.europeanPlayerTeamId;

        const isGroupStage = currentEvent.stage === "group_stage" || currentEvent.stage === "league_stage";
        const isLeg1 = currentEvent.stage !== "final" && currentEvent.matchday === 1;

        if (isGroupStage || isLeg1) {
          needsExtraTime = false;
        } else if (currentEvent.stage === "final") {
          // Single leg final goes straight to Extra Time
          needsExtraTime = (scorehome === scoreaway);
        } else {
          // Knockout Leg 2: check aggregate scores to determine if we go to Extra Time
          isKnockoutLeg2 = true;
          const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
          const kStateKeyLeg1 = toCamelCase(currentEvent.stage) + "Leg1";
          const m1 = cupState.knockoutState[kStateKeyLeg1].find(f => f.homeId === pId || f.awayId === pId);

          const isHomeLeg2 = teamonename === pId;

          if (isHomeLeg2) {
            playerAgg = scorehome + m1.awayScore;
            oppAgg = scoreaway + m1.homeScore;
          } else {
            playerAgg = scoreaway + m1.homeScore;
            oppAgg = scorehome + m1.awayScore;
          }

          if (playerAgg === oppAgg) {
            const seasonShort = lState.season.split("/")[0];
            const isSA = lState.region === "south_america" || lState.country === "argentina" || lState.country === "brazil" || lState.country === "colombia";
            const useAwayGoals = parseInt(seasonShort) < 2021 && !isSA;

            if (useAwayGoals) {
              const playerAwayGoals = isHomeLeg2 ? m1.awayScore : scoreaway;
              const oppAwayGoals = isHomeLeg2 ? scoreaway : m1.awayScore;

              if (playerAwayGoals === oppAwayGoals) {
                needsExtraTime = true;
              } else {
                needsExtraTime = false;
              }
            } else {
              needsExtraTime = true;
            }
          } else {
            needsExtraTime = false;
          }
        }
      } else {
        // Cup tournaments with single legs
        needsExtraTime = (scorehome === scoreaway);
      }

      if (needsExtraTime) {
        logEvent("Full time whistle! Tied on aggregate. We head to Extra Time!", "kickoff");
      } else {
        setIsGameOver(true);
        if (isEurope && isKnockoutLeg2) {
          logEvent(`FULL TIME! Final Score: ${teamid[teamonename].name} ${scorehome} - ${scoreaway} ${teamid[teamtwoname].name} (Aggregate: ${playerAgg} - ${oppAgg})`, "kickoff");
        } else {
          logEvent(`FULL TIME! Final Score: ${teamid[teamonename].name} ${scorehome} - ${scoreaway} ${teamid[teamtwoname].name}`, "kickoff");
        }
      }
      return;
    }

    if (time === 120 && scorehome !== scoreaway) {
      setIsGameOver(true);
      logEvent(`END OF EXTRA TIME! Final Score: ${teamid[teamonename].name} ${scorehome} - ${scoreaway} ${teamid[teamtwoname].name}`, "kickoff");
      return;
    }

    if (time === 120 && scorehome === scoreaway) {
      setIsPenaltyShootout(true);
      logEvent("End of Extra Time! Still tied! We are going to a penalty shootout!", "kickoff");
      return;
    }

    // Midfield calculations
    if (time > 0 && !isGameOver && !isPenaltyShootout) {
      const r1 = Math.floor(Math.random() * 6) + 1 + getModifiedStat(teamonename, "midfield");
      const r2 = Math.floor(Math.random() * 6) + 1 + getModifiedStat(teamtwoname, "midfield");
      setrollOne(r1);
      setRollTwo(r2);

      const homeLineupData = getTeamLineup(teamonename);
      const awayLineupData = getTeamLineup(teamtwoname);
      const homeName = teamid[teamonename].name;
      const awayName = teamid[teamtwoname].name;

      if (r1 > r2) {
        logEvent(getMidfieldWinCommentary(homeName, awayName, homeLineupData, awayLineupData), "chance", "home");
        setHasHomeChance(true);
        setBallPosition("home-attack");
      } else if (r2 > r1) {
        logEvent(getMidfieldWinCommentary(awayName, homeName, awayLineupData, homeLineupData), "chance", "away");
        setHasAwayChance(true);
        setBallPosition("away-attack");
      } else {
        logEvent(getMidfieldDrawCommentary(homeName, awayName, homeLineupData, awayLineupData), "normal", "neutral");
        setBallPosition("center");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);

  // Home Attacks
  function handleHomeChance() {
    setHasHomeChance(false);
    const homeattack = Math.floor(Math.random() * 6) + 1 + getModifiedStat(teamonename, "attack");
    const awaydefense = Math.floor(Math.random() * 6) + 1 + getModifiedStat(teamtwoname, "defense");

    setrollOne(homeattack);
    setRollTwo(awaydefense);

    const homeLineupData = getTeamLineup(teamonename);
    const awayLineupData = getTeamLineup(teamtwoname);
    const homeName = teamid[teamonename].name;
    const awayName = teamid[teamtwoname].name;

    if (homeattack > awaydefense) {
      logEvent(getAttackSuccessCommentary(homeName, awayName, homeLineupData, awayLineupData), "chance", "home");
      setHasHomeScoreChance(true);
    } else {
      logEvent(getAttackFailCommentary(awayName, homeName, awayLineupData, homeLineupData), "save", "away");
      setBallPosition("center");
    }
  }

  function handleHomeScoreChance() {
    setHasHomeScoreChance(false);
    const homescore = Math.floor(Math.random() * 6) + 1;
    const awaysave = Math.floor(Math.random() * 6) + 1;
    setrollOne(homescore);
    setRollTwo(awaysave);

    const homeLineupData = getTeamLineup(teamonename);
    const awayLineupData = getTeamLineup(teamtwoname);
    const homeName = teamid[teamonename].name;
    const awayName = teamid[teamtwoname].name;

    if (homescore > awaysave) {
      logEvent(getGoalCommentary(homeName, awayName, homeLineupData, awayLineupData), "goal", "home");
      setScoreHome(prev => prev + 1);
      setBallPosition("home-goal");
      triggerGoalFlash(teamid[teamonename]);
    } else {
      logEvent(getSaveCommentary(awayName, homeName, awayLineupData, homeLineupData), "save", "away");
      setBallPosition("center");
    }
  }

  // Away Attacks
  function handleAwayChance() {
    setHasAwayChance(false);
    const awayattack = Math.floor(Math.random() * 6) + 1 + getModifiedStat(teamtwoname, "attack");
    const homedefense = Math.floor(Math.random() * 6) + 1 + getModifiedStat(teamonename, "defense");

    setrollOne(homedefense);
    setRollTwo(awayattack);

    const homeLineupData = getTeamLineup(teamonename);
    const awayLineupData = getTeamLineup(teamtwoname);
    const homeName = teamid[teamonename].name;
    const awayName = teamid[teamtwoname].name;

    if (awayattack > homedefense) {
      logEvent(getAttackSuccessCommentary(awayName, homeName, awayLineupData, homeLineupData), "chance", "away");
      setHasAwayScoreChance(true);
    } else {
      logEvent(getAttackFailCommentary(homeName, awayName, homeLineupData, awayLineupData), "save", "home");
      setBallPosition("center");
    }
  }

  function handleAwayScoreChance() {
    setHasAwayScoreChance(false);
    const awayscore = Math.floor(Math.random() * 6) + 1;
    const homesave = Math.floor(Math.random() * 6) + 1;
    setrollOne(homesave);
    setRollTwo(awayscore);

    const homeLineupData = getTeamLineup(teamonename);
    const awayLineupData = getTeamLineup(teamtwoname);
    const homeName = teamid[teamonename].name;
    const awayName = teamid[teamtwoname].name;

    if (awayscore > homesave) {
      logEvent(getGoalCommentary(awayName, homeName, awayLineupData, homeLineupData), "goal", "away");
      setScoreAway(prev => prev + 1);
      setBallPosition("away-goal");
      triggerGoalFlash(teamid[teamtwoname]);
    } else {
      logEvent(getSaveCommentary(homeName, awayName, homeLineupData, awayLineupData), "save", "home");
      setBallPosition("center");
    }
  }

  // Helper to check shootout winner
  function getShootoutWinner(hScore, aScore, hShots, aShots, firstShooter) {
    if (hShots <= 5 && aShots <= 5) {
      const hRem = 5 - hShots;
      const aRem = 5 - aShots;
      if (hScore > aScore + aRem) return 'home';
      if (aScore > hScore + hRem) return 'away';
    } else {
      // Sudden death (must have taken equal number of shots to compare)
      if (hShots === aShots) {
        if (hScore > aScore) return 'home';
        if (aScore > hScore) return 'away';
      }
    }
    return null;
  }

  // Unified penalty execution logic
  function executePenalty(shootingTeam) {
    if (shootingTeam !== 'home' && shootingTeam !== 'away') return;
    const isHome = shootingTeam === 'home';
    const attackerTeamKey = isHome ? teamonename : teamtwoname;
    const defenderTeamKey = isHome ? teamtwoname : teamonename;
    const attackerLineup = getTeamLineup(attackerTeamKey);
    const defenderLineup = getTeamLineup(defenderTeamKey);
    const attackerName = teamid[attackerTeamKey].name;
    const defenderName = teamid[defenderTeamKey].name;

    const r = Math.floor(Math.random() * 6) + 1 + teamid[attackerTeamKey].attack;

    if (isHome) {
      setrollOne(r);
      setRollTwo(7);
    } else {
      setrollOne(7);
      setRollTwo(r);
    }

    let isGoal = false;
    if (r > 7) {
      logEvent(getPenaltyGoalCommentary(attackerName, defenderName, attackerLineup, defenderLineup), "goal", isHome ? "home" : "away");
      triggerGoalFlash(teamid[attackerTeamKey]);
      isGoal = true;
    } else {
      logEvent(getPenaltyMissCommentary(attackerName, defenderName, attackerLineup, defenderLineup), "miss", isHome ? "home" : "away");
    }

    // Since react states update asynchronously, compute local next scores
    const nextHomePenalty = homepenalty + (isHome && isGoal ? 1 : 0);
    const nextAwayPenalty = awaypenalty + (!isHome && isGoal ? 1 : 0);
    const nextHomeShots = penaltyHomeShots + (isHome ? 1 : 0);
    const nextAwayShots = penaltyAwayShots + (!isHome ? 1 : 0);

    if (isHome && isGoal) setHomePenalty(nextHomePenalty);
    if (!isHome && isGoal) setAwayPenalty(nextAwayPenalty);
    setPenaltyHomeShots(nextHomeShots);
    setPenaltyAwayShots(nextAwayShots);

    const winner = getShootoutWinner(nextHomePenalty, nextAwayPenalty, nextHomeShots, nextAwayShots, penaltyFirstShooter);

    if (winner) {
      setPenaltyWinner(winner);
      setIsGameOver(true);
      logEvent(`🏆 PENALTY SHOOTOUT OVER! ${teamid[winner === 'home' ? teamonename : teamtwoname].name} wins the shootout ${nextHomePenalty} - ${nextAwayPenalty}!`, "kickoff");
    } else {
      const nextTurn = isHome ? 'away' : 'home';
      setPenaltyTurn(nextTurn);
    }
  }

  function handleHomePenalty() {
    if (penaltyTurn !== 'home' || isPenaltyCPUProcessing || penaltyWinner) return;
    executePenalty('home');
  }

  function handleAwayPenalty() {
    if (penaltyTurn !== 'away' || isPenaltyCPUProcessing || penaltyWinner) return;
    executePenalty('away');
  }



  const getWinnerId = (m) => {
    if (m.homeScore > m.awayScore) return m.homeId;
    if (m.awayScore > m.homeScore) return m.awayId;
    return m.penaltyHomeScore > m.penaltyAwayScore ? m.homeId : m.awayId;
  };

  const getLoserId = (m) => {
    const w = getWinnerId(m);
    return m.homeId === w ? m.awayId : m.homeId;
  };

  // Helper to advance knockout round stages
  const advanceKnockoutRound = (stateCopy) => {
    const completedMatches = stateCopy.knockoutState[stateCopy.stage];
    const isWorldCup = stateCopy.isWorldCup;
    const isCopa = stateCopy.teams.length === 12 || stateCopy.teams.length === 10;

    if (stateCopy.stage === "roundOf32") {
      const roundOf16 = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[2]), awayId: getWinnerId(completedMatches[3]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[4]), awayId: getWinnerId(completedMatches[5]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[6]), awayId: getWinnerId(completedMatches[7]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[8]), awayId: getWinnerId(completedMatches[9]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[10]), awayId: getWinnerId(completedMatches[11]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[12]), awayId: getWinnerId(completedMatches[13]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
        { homeId: getWinnerId(completedMatches[14]), awayId: getWinnerId(completedMatches[15]), played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" }
      ];
      stateCopy.knockoutState.roundOf16 = roundOf16;
      stateCopy.stage = "roundOf16";
    } else if (stateCopy.stage === "roundOf16") {
      const quarterFinals = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
        { homeId: getWinnerId(completedMatches[2]), awayId: getWinnerId(completedMatches[3]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
        { homeId: getWinnerId(completedMatches[4]), awayId: getWinnerId(completedMatches[5]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
        { homeId: getWinnerId(completedMatches[6]), awayId: getWinnerId(completedMatches[7]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" }
      ];
      stateCopy.knockoutState.quarterFinals = quarterFinals;
      stateCopy.stage = "quarterFinals";
    } else if (stateCopy.stage === "quarterFinals") {
      const semiFinals = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Semi-finals" },
        { homeId: getWinnerId(completedMatches[2]), awayId: getWinnerId(completedMatches[3]), played: false, homeScore: 0, awayScore: 0, stageName: "Semi-finals" }
      ];
      stateCopy.knockoutState.semiFinals = semiFinals;
      stateCopy.stage = "semiFinals";
    } else if (stateCopy.stage === "semiFinals") {
      if (isWorldCup || isCopa) {
        stateCopy.knockoutState.thirdPlace = [
          { homeId: getLoserId(completedMatches[0]), awayId: getLoserId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Third-Place Match" }
        ];
      }
      stateCopy.knockoutState.final = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Grand Final" }
      ];
      stateCopy.stage = (isWorldCup || isCopa) ? "thirdPlace" : "final";
    } else if (stateCopy.stage === "thirdPlace") {
      stateCopy.stage = "final";
    } else if (stateCopy.stage === "final") {
      stateCopy.stage = "over";
    }
  };

  // Exit match and trigger standings update and AI simulations for League & Tournaments
  const handleExitMatch = () => {
    const getFinalMinutesMap = () => {
      const finalMinutesMap = {};
      const finalTime = time; // 90 or 120
      Object.keys(playerMinutes).forEach(name => {
        const pm = playerMinutes[name];
        let mins = pm.minutesPlayed;
        if (pm.enteredAt !== null) {
          mins += (finalTime - pm.enteredAt);
        }
        finalMinutesMap[name] = mins;
      });
      return finalMinutesMap;
    };

    if (isLeague) {
      let justPlayedFixtures = [];
      let roundTitle = "";

      if (leagueState.calendar) {
        // Interleaved Calendar Campaign Mode
        const currentEvent = leagueState.calendar[leagueState.calendarIndex];

        if (currentEvent && (currentEvent.type === "domestic_cup" || currentEvent.isDomesticCup) && leagueState.domesticCupState) {
          const domCup = leagueState.domesticCupState;
          const stage = currentEvent.stage;
          const pId = leagueState.playerTeamId;
          const stageMatches = domCup.knockoutState ? (domCup.knockoutState[stage] || []) : [];

          // Record player's match result
          const userMatch = stageMatches.find(m => m.homeId === pId || m.awayId === pId);
          if (userMatch) {
            userMatch.played = true;
            userMatch.homeScore = scorehome;
            userMatch.awayScore = scoreaway;
            if (scorehome === scoreaway) {
              userMatch.penaltyHomeScore = homepenalty;
              userMatch.penaltyAwayScore = awaypenalty;
              userMatch.winnerId = homepenalty > awaypenalty ? userMatch.homeId : userMatch.awayId;
            } else {
              userMatch.winnerId = scorehome > scoreaway ? userMatch.homeId : userMatch.awayId;
            }
          }

          // Simulate AI matches in this round
          stageMatches.forEach(m => {
            if (!m.played && m.homeId !== pId && m.awayId !== pId) {
              const h = (domCup.participatingTeams && domCup.participatingTeams.find(t => t.idnum === m.homeId)) || leagueState.teams.find(t => t.idnum === m.homeId);
              const a = (domCup.participatingTeams && domCup.participatingTeams.find(t => t.idnum === m.awayId)) || leagueState.teams.find(t => t.idnum === m.awayId);
              const { homeGoals, awayGoals } = simulateFixture(h, a);
              m.homeScore = homeGoals;
              m.awayScore = awayGoals;
              m.played = true;
              if (homeGoals === awayGoals) {
                const penH = Math.floor(Math.random() * 3) + 3;
                let penA = Math.floor(Math.random() * 3) + 3;
                if (penA === penH) penA += 1;
                m.penaltyHomeScore = penH;
                m.penaltyAwayScore = penA;
                m.winnerId = penH > penA ? m.homeId : m.awayId;
              } else {
                m.winnerId = homeGoals > awayGoals ? m.homeId : m.awayId;
              }
            }
          });

          // Advance cup state
          leagueState.domesticCupState = advanceDomesticCup(
            leagueState.domesticCupState,
            leagueState.teams,
            pId,
            leagueState.managerName
          );

          leagueState.calendarIndex += 1;
          justPlayedFixtures = stageMatches.map(m => ({
            homeId: m.homeId,
            awayId: m.awayId,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            played: true
          }));
          roundTitle = `${domCup.cupName.toUpperCase()} - ${(stage || "").replace(/_/g, ' ').toUpperCase()}`;
        } else if (currentEvent) {
          const currentRoundFixtures = leagueState.fixtures[currentEvent.index - 1] || [];
          justPlayedFixtures = currentRoundFixtures;
          roundTitle = `ROUND ${currentEvent.index} RESULTS`;

          currentRoundFixtures.forEach(f => {
            const isPlayerFixture = f.homeId === leagueState.playerTeamId || f.awayId === leagueState.playerTeamId;
            if (isPlayerFixture) {
              f.homeScore = scorehome;
              f.awayScore = scoreaway;
              f.played = true;
            } else {
              // Simulate AI fixture based on team ratings
              const h = leagueState.teams.find(t => t.idnum === f.homeId);
              const a = leagueState.teams.find(t => t.idnum === f.awayId);

              const { homeGoals, awayGoals } = simulateFixture(h, a);
              f.homeScore = homeGoals;
              f.awayScore = awayGoals;
              f.played = true;
            }
          });

          // Recalculate standings from round 1 up to current league round
          leagueState.teams.forEach(t => {
            t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0; t.gf = 0; t.ga = 0; t.points = 0;
          });

          leagueState.fixtures.forEach(roundFixtures => {
            roundFixtures.forEach(f => {
              if (f.played) {
                const h = leagueState.teams.find(t => t.idnum === f.homeId);
                const a = leagueState.teams.find(t => t.idnum === f.awayId);

                h.played += 1;
                a.played += 1;
                h.gf += f.homeScore;
                h.ga += f.awayScore;
                a.gf += f.awayScore;
                a.ga += f.homeScore;

                if (f.homeScore > f.awayScore) {
                  h.won += 1; h.points += 3;
                  a.lost += 1;
                } else if (f.awayScore > f.homeScore) {
                  a.won += 1; a.points += 3;
                  h.lost += 1;
                } else {
                  h.drawn += 1; h.points += 1;
                  a.drawn += 1; a.points += 1;
                }
              }
            });
          });

          // Increment Display Domestic Round Only if last matchday of calendar of same index
          leagueState.currentRound = currentEvent.index + 1;
          leagueState.calendarIndex += 1;
        }
      } else {
        // Legacy League Campaign Mode
        const currentRoundFixtures = leagueState.fixtures[leagueState.currentRound - 1];
        justPlayedFixtures = currentRoundFixtures;
        roundTitle = `ROUND ${leagueState.currentRound} RESULTS`;

        currentRoundFixtures.forEach(f => {
          const isPlayerFixture = f.homeId === leagueState.playerTeamId || f.awayId === leagueState.playerTeamId;
          if (isPlayerFixture) {
            f.homeScore = scorehome;
            f.awayScore = scoreaway;
            f.played = true;
          } else {
            const h = leagueState.teams.find(t => t.idnum === f.homeId);
            const a = leagueState.teams.find(t => t.idnum === f.awayId);
            const { homeGoals, awayGoals } = simulateFixture(h, a);
            f.homeScore = homeGoals;
            f.awayScore = awayGoals;
            f.played = true;
          }
        });

        leagueState.teams.forEach(t => {
          t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0; t.gf = 0; t.ga = 0; t.points = 0;
        });

        leagueState.fixtures.forEach(roundFixtures => {
          roundFixtures.forEach(f => {
            if (f.played) {
              const h = leagueState.teams.find(t => t.idnum === f.homeId);
              const a = leagueState.teams.find(t => t.idnum === f.awayId);
              h.played += 1; a.played += 1;
              h.gf += f.homeScore; h.ga += f.awayScore;
              a.gf += f.awayScore; a.ga += f.homeScore;
              if (f.homeScore > f.awayScore) {
                h.won += 1; h.points += 3; a.lost += 1;
              } else if (f.awayScore > f.homeScore) {
                a.won += 1; a.points += 3; h.lost += 1;
              } else {
                h.drawn += 1; h.points += 1; a.drawn += 1; a.points += 1;
              }
            }
          });
        });

        leagueState.currentRound += 1;
      }

      // Update Fan Confidence after match played
      const pId = leagueState.playerTeamId;
      const isPlayerHome = teamonename === pId;
      const opponentId = isPlayerHome ? teamtwoname : teamonename;
      const playerTeam = leagueState.teams.find(t => t.idnum === pId);
      const opponentTeam = leagueState.teams.find(t => t.idnum === opponentId) || (leagueState.domesticCupState?.participatingTeams?.find(t => t.idnum === opponentId));
      const playerGoals = isPlayerHome ? scorehome : scoreaway;
      const opponentGoals = isPlayerHome ? scoreaway : scorehome;
      leagueState.fanConfidence = updateFanConfidence(leagueState.fanConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals);

      // Save the advanced league state to localStorage first so that updateTeamStatsInStorage works on the updated state
      localStorage.setItem("retro_league_career", JSON.stringify(leagueState));

      // Restore starting lineup and roles so mid-match substitutions/adjustments don't persist
      if (savedStartingLineup) {
        localStorage.setItem(`retro_lineup_${playerTeam.name}_${leagueState.season}`, JSON.stringify(savedStartingLineup));
      }
      if (savedStartingRoles) {
        localStorage.setItem(`retro_roles_${playerTeam.name}_${leagueState.season}`, JSON.stringify(savedStartingRoles));
      }

      // Update roster & lineup conditions/injuries
      updatePlayerConditionsAndInjuries(playerTeam.name, leagueState.season, false, true, getFinalMinutesMap());
      const oppIdRound = teamonename === playerTeamId ? teamtwoname : teamonename;
      const oppTeamRound = teamid ? teamid[oppIdRound] : null;
      if (oppTeamRound && oppTeamRound.name) {
        updatePlayerConditionsAndInjuries(oppTeamRound.name, leagueState.season, false, true);
      }

      // Load updated lineup and update team stats in storage
      const lineupKey = `retro_lineup_${playerTeam.name}_${leagueState.season}`;
      const savedLineup = localStorage.getItem(lineupKey);
      if (savedLineup) {
        try {
          const parsedLineup = JSON.parse(savedLineup);
          updateTeamStatsInStorage(parsedLineup, getSavedFormation(), savedStartingRoles || playerRoles);
          // Re-load the leagueState from storage so that the newly updated team stats are included!
          const refreshedRaw = localStorage.getItem("retro_league_career");
          if (refreshedRaw) {
            leagueState = JSON.parse(refreshedRaw);
          }
        } catch (e) {
          console.error("Error updating team stats after player condition changes", e);
        }
      }

      localStorage.setItem("retro_league_career", JSON.stringify(leagueState));
      const isDomCupFinished = roundTitle && !roundTitle.includes("RESULTS");
      navigate("/league/dashboard", {
        state: {
          showRoundResults: true,
          fixtures: justPlayedFixtures,
          roundTitle,
          themeColor: isDomCupFinished ? "#ff0055" : "#00ff64"
        }
      });
    } else if (isEurope) {
      // European Cup Campaign Mode
      const stateCopy = JSON.parse(JSON.stringify(leagueState));
      const currentEvent = stateCopy.calendar[stateCopy.calendarIndex];
      const cupState = stateCopy.europeanCupState;
      const pId = cupState.europeanPlayerTeamId;

      const advanceKnockoutToNextRound = (cState, stg) => {
        const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
        const leg1 = cState.knockoutState[toCamelCase(stg) + "Leg1"];
        const leg2 = cState.knockoutState[toCamelCase(stg) + "Leg2"];
        const winners = [];

        for (let i = 0; i < leg1.length; i++) {
          const m1 = leg1[i];
          const m2 = leg2.find(m => m.homeId === m1.awayId && m.awayId === m1.homeId);

          const homeAgg = m1.homeScore + (m2 ? m2.awayScore : 0);
          const awayAgg = m1.awayScore + (m2 ? m2.homeScore : 0);
          let winnerId = null;

          if (homeAgg > awayAgg) {
            winnerId = m1.homeId;
          } else if (awayAgg > homeAgg) {
            winnerId = m1.awayId;
          } else {
            // Tied on aggregate: check rules
            const seasonShort = cState.season.split("/")[0];
            const isSA = cState.region === "south_america" || cState.country === "argentina" || cState.country === "brazil" || cState.country === "colombia";
            const useAwayGoals = parseInt(seasonShort) < 2021 && !isSA;

            let goesToExtraTime = true;
            if (useAwayGoals) {
              const homeAwayGoals = m2 ? m2.awayScore : 0; // Team A played away in Leg 2
              const awayAwayGoals = m1.awayScore;          // Team B played away in Leg 1

              if (homeAwayGoals > awayAwayGoals) {
                winnerId = m1.homeId;
                goesToExtraTime = false;
              } else if (awayAwayGoals > homeAwayGoals) {
                winnerId = m1.awayId;
                goesToExtraTime = false;
              }
            }

            if (goesToExtraTime) {
              // Simulate extra time & penalties between team A (m1.homeId) and team B (m1.awayId)
              const teamA = cState.teams.find(t => t.idnum === m1.homeId);
              const teamB = cState.teams.find(t => t.idnum === m1.awayId);

              const attA = teamA ? (teamA.attack || 3) : 3;
              const midA = teamA ? (teamA.midfield || 3) : 3;
              const defA = teamA ? (teamA.defense || 3) : 3;

              const attB = teamB ? (teamB.attack || 3) : 3;
              const midB = teamB ? (teamB.midfield || 3) : 3;
              const defB = teamB ? (teamB.defense || 3) : 3;

              // 1. Simulate extra time goals
              const midDiff = midA - midB;
              const homeChancesExp = Math.max(0.3, Math.min(2.0, 1.2 + midDiff * 0.13));
              const randomShift = (Math.random() - 0.5) * 0.7;
              const homeChances = Math.round(homeChancesExp + randomShift);
              const awayChances = Math.max(0, 2 - homeChances);

              const homeConv = Math.max(0.1, Math.min(0.65, 0.3 + (attA - defB) * 0.05));
              const awayConv = Math.max(0.1, Math.min(0.65, 0.3 + (attB - defA) * 0.05));

              let extraA = 0;
              for (let c = 0; c < homeChances; c++) {
                if (Math.random() < homeConv) extraA++;
              }
              let extraB = 0;
              for (let c = 0; c < awayChances; c++) {
                if (Math.random() < awayConv) extraB++;
              }

              // Update the Leg 2 scores to reflect simulated extra time
              if (m2) {
                m2.awayScore += extraA; // team A was away in Leg 2
                m2.homeScore += extraB; // team B was home in Leg 2
              }

              const newHomeAgg = homeAgg + extraA;
              const newAwayAgg = awayAgg + extraB;

              if (newHomeAgg > newAwayAgg) {
                winnerId = m1.homeId;
              } else if (newAwayAgg > newHomeAgg) {
                winnerId = m1.awayId;
              } else {
                // Still tied after Extra Time: simulate penalties
                let penA = 0;
                let penB = 0;
                for (let r = 0; r < 5; r++) {
                  if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attA - defB) * 0.03))) penA++;
                  if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attB - defA) * 0.03))) penB++;
                }
                while (penA === penB) {
                  if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attA - defB) * 0.03))) penA++;
                  if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attB - defA) * 0.03))) penB++;
                }

                // Save penalty scores in Leg 2
                if (m2) {
                  m2.penaltyHomeScore = penB; // Leg 2 home is team B
                  m2.penaltyAwayScore = penA; // Leg 2 away is team A
                }

                winnerId = penA > penB ? m1.homeId : m1.awayId;
              }
            }
          }
          winners.push(winnerId);
        }

        const seasonShort = stateCopy.season.split("/")[0];
        const activeClRules = stateCopy.region === "south_america"
          ? clibRules
          : (stateCopy.region === "north_america" ? concacafRules : clRules);
        const activeUefaRules = stateCopy.region === "south_america" ? csudRules : uefaRules;
        const rules = stateCopy.europeanCup === "cl" ? activeClRules[seasonShort] : (stateCopy.europeanCup === "uefa" ? activeUefaRules[seasonShort] : ueclRules[seasonShort]);
        const currentIdx = rules.stages.indexOf(stg);
        const nextStage = rules.stages[currentIdx + 1];

        if (stg === "playoffs") {
          const top8Ids = cState.knockoutState.top8Ids || [];
          const r16Leg1 = [];
          for (let i = 0; i < 8; i++) {
            r16Leg1.push({
              homeId: winners[i],
              awayId: top8Ids[i],
              played: false,
              homeScore: 0,
              awayScore: 0
            });
          }
          const r16Leg2 = r16Leg1.map(m => ({
            homeId: m.awayId,
            awayId: m.homeId,
            played: false,
            homeScore: 0,
            awayScore: 0
          }));

          cState.knockoutState.roundOf16Leg1 = r16Leg1;
          cState.knockoutState.roundOf16Leg2 = r16Leg2;
        } else if (nextStage === "final") {
          cState.knockoutState.final = [
            { homeId: winners[0], awayId: winners[1], played: false, homeScore: 0, awayScore: 0 }
          ];
        } else if (nextStage) {
          const nextLeg1 = [];
          for (let i = 0; i < winners.length; i += 2) {
            nextLeg1.push({ homeId: winners[i], awayId: winners[i + 1], played: false, homeScore: 0, awayScore: 0 });
          }
          const nextLeg2 = nextLeg1.map(m => ({ homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0 }));

          cState.knockoutState[toCamelCase(nextStage) + "Leg1"] = nextLeg1;
          cState.knockoutState[toCamelCase(nextStage) + "Leg2"] = nextLeg2;
        }
      };

      const isCL = stateCopy.europeanCup === "cl";
      const isUEFA = stateCopy.europeanCup === "uefa";
      const isUECL = stateCopy.europeanCup === "uecl";
      const seasonShort = stateCopy.season.split("/")[0];
      const activeClRules = stateCopy.region === "south_america"
        ? clibRules
        : (stateCopy.region === "north_america" ? concacafRules : clRules);
      const activeUefaRules = stateCopy.region === "south_america" ? csudRules : uefaRules;
      const rules = isCL ? activeClRules[seasonShort] : (isUEFA ? activeUefaRules[seasonShort] : ueclRules[seasonShort]);

      if (isCL || ((isUEFA || isUECL) && rules && (rules.format === "group_then_knockout" || rules.format === "league_then_knockout"))) {
        if (currentEvent.stage === "group_stage" || currentEvent.stage === "league_stage") {
          const mIndex = currentEvent.matchday - 1;
          const userFixture = cupState.fixtures[mIndex].find(f => f.homeId === pId || f.awayId === pId);
          userFixture.homeScore = scorehome;
          userFixture.awayScore = scoreaway;
          userFixture.played = true;

          // Simulate other matches
          cupState.fixtures[mIndex].forEach(f => {
            if (!f.played) {
              const h = cupState.teams.find(t => t.idnum === f.homeId);
              const a = cupState.teams.find(t => t.idnum === f.awayId);
              const { homeGoals, awayGoals } = simulateFixture(h, a);
              f.homeScore = homeGoals;
              f.awayScore = awayGoals;
              f.played = true;
            }
          });

          // Transition CL/UEFA group stage to knockouts after all group matchdays complete
          const totalGroupMatchdays = rules.calendarSchedules.filter(s => s.stage === "group_stage" || s.stage === "league_stage").length;
          if (currentEvent.matchday === totalGroupMatchdays || ((seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001") && currentEvent.matchday === 6)) {
            if (rules && rules.format === "league_then_knockout") {
              const sortedTeams = cupState.teams.map(t => {
                let gf = 0, ga = 0, points = 0;
                cupState.fixtures.forEach(matchdayFixtures => {
                  matchdayFixtures.forEach(f => {
                    if (f.played && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                      const isHome = f.homeId === t.idnum;
                      const myScore = isHome ? f.homeScore : f.awayScore;
                      const oppScore = isHome ? f.awayScore : f.homeScore;
                      gf += myScore; ga += oppScore;
                      if (myScore > oppScore) { points += 3; }
                      else if (myScore < oppScore) { /* lost */ }
                      else { points += 1; }
                    }
                  });
                });
                return { ...t, points, gd: gf - ga, gf };
              }).sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.gd !== a.gd) return b.gd - a.gd;
                return b.gf - a.gf;
              });

              const top8Ids = sortedTeams.slice(0, 8).map(t => t.idnum);
              const playoffTeams = sortedTeams.slice(8, 24);

              const playoffsLeg1 = [];
              for (let i = 0; i < 8; i++) {
                playoffsLeg1.push({
                  homeId: playoffTeams[15 - i].idnum,
                  awayId: playoffTeams[i].idnum,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                });
              }
              const playoffsLeg2 = playoffsLeg1.map(m => ({
                homeId: m.awayId,
                awayId: m.homeId,
                played: false,
                homeScore: 0,
                awayScore: 0
              }));

              cupState.knockoutState = {
                playoffsLeg1,
                playoffsLeg2,
                top8Ids,
                roundOf16Leg1: null,
                roundOf16Leg2: null,
                quarterFinalsLeg1: null,
                quarterFinalsLeg2: null,
                semiFinalsLeg1: null,
                semiFinalsLeg2: null,
                final: null
              };
            } else if ([...new Set((cupState.teams || []).map(t => t.group))].filter(g => g && g !== "bye" && g !== "champion").length === 4 && cupState.fixtures.length <= 6 && seasonShort !== "1993") {
              const groups = ["A", "B", "C", "D"];
              const winners = {};
              const runnersUp = {};
              groups.forEach(g => {
                const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                  let gf = 0, ga = 0, points = 0;
                  cupState.fixtures.forEach(matchdayFixtures => {
                    matchdayFixtures.forEach(f => {
                      if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                        const isHome = f.homeId === t.idnum;
                        const myScore = isHome ? f.homeScore : f.awayScore;
                        const oppScore = isHome ? f.awayScore : f.homeScore;
                        gf += myScore; ga += oppScore;
                        if (myScore > oppScore) { points += 3; }
                        else if (myScore === oppScore) { points += 1; }
                      }
                    });
                  });
                  return { ...t, points, gd: gf - ga, gf };
                }).sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  if (b.gd !== a.gd) return b.gd - a.gd;
                  return b.gf - a.gf;
                });
                winners[g] = gTeams[0];
                runnersUp[g] = gTeams[1];
              });
              const qfLeg1 = [
                { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
                { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
                { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 }
              ];
              const qfLeg2 = qfLeg1.map(m => ({ homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0 }));
              cupState.knockoutState = {
                roundOf32Leg1: null, roundOf32Leg2: null,
                roundOf16Leg1: null, roundOf16Leg2: null,
                quarterFinalsLeg1: qfLeg1,
                quarterFinalsLeg2: qfLeg2,
                semiFinalsLeg1: null,
                semiFinalsLeg2: null,
                final: null
              };
            } else if (seasonShort === "2009" || seasonShort === "2010" || seasonShort === "2011" || seasonShort === "2012" || seasonShort === "2013" || seasonShort === "2014" || seasonShort === "2015" || seasonShort === "2016" || seasonShort === "2017" || seasonShort === "2018" || seasonShort === "2019" || seasonShort === "2020" || seasonShort === "2021" || seasonShort === "2022" || seasonShort === "2023") {
              if (stateCopy.europeanCup === "cl" || (stateCopy.region === "south_america" && stateCopy.europeanCup === "uefa" && (seasonShort === "2020" || seasonShort === "2021")) || seasonShort === "2021" || seasonShort === "2022" || seasonShort === "2023") {
                // Champions League 2009: 8 groups, top 2 advance to Round of 16
                const groups = ["A", "B", "C", "D", "E", "F", "G", "H"];
                const winners = {};
                const runnersUp = {};

                groups.forEach(g => {
                  const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                    let gf = 0, ga = 0, points = 0;
                    cupState.fixtures.forEach(matchdayFixtures => {
                      matchdayFixtures.forEach(f => {
                        if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                          const isHome = f.homeId === t.idnum;
                          const myScore = isHome ? f.homeScore : f.awayScore;
                          const oppScore = isHome ? f.awayScore : f.homeScore;
                          gf += myScore; ga += oppScore;
                          if (myScore > oppScore) { points += 3; }
                          else if (myScore < oppScore) { /* lost */ }
                          else { points += 1; }
                        }
                      });
                    });
                    return { ...t, points, gd: gf - ga, gf };
                  }).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                  });

                  winners[g] = gTeams[0];
                  runnersUp[g] = gTeams[1];
                });

                const r16Leg1 = [
                  { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["E"].idnum, awayId: runnersUp["F"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["F"].idnum, awayId: runnersUp["E"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["G"].idnum, awayId: runnersUp["H"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["H"].idnum, awayId: runnersUp["G"].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const r16Leg2 = r16Leg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: r16Leg1,
                  roundOf16Leg2: r16Leg2,
                  quarterFinalsLeg1: null,
                  quarterFinalsLeg2: null,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              } else {
                // Europa League 2009: 12 groups, top 2 advance + 8 best 3rd placed to form Round of 32
                const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
                const winners = {};
                const runnersUp = {};
                const thirds = [];

                groups.forEach(g => {
                  const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                    let gf = 0, ga = 0, points = 0;
                    cupState.fixtures.forEach(matchdayFixtures => {
                      matchdayFixtures.forEach(f => {
                        if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                          const isHome = f.homeId === t.idnum;
                          const myScore = isHome ? f.homeScore : f.awayScore;
                          const oppScore = isHome ? f.awayScore : f.homeScore;
                          gf += myScore; ga += oppScore;
                          if (myScore > oppScore) { points += 3; }
                          else if (myScore < oppScore) { /* lost */ }
                          else { points += 1; }
                        }
                      });
                    });
                    return { ...t, points, gd: gf - ga, gf };
                  }).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                  });

                  winners[g] = gTeams[0];
                  runnersUp[g] = gTeams[1];
                  thirds.push(gTeams[2]);
                });

                // Sort thirds to find best 8
                const bestThirds = [...thirds].sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  const gdA = a.gf - a.ga;
                  const gdB = b.gf - b.ga;
                  if (gdB !== gdA) return gdB - gdA;
                  return b.gf - a.gf;
                }).slice(0, 8);

                // Seeding / Pairing for Round of 32
                const r32Leg1 = [
                  { homeId: winners["A"].idnum, awayId: bestThirds[0].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["B"].idnum, awayId: bestThirds[1].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["C"].idnum, awayId: bestThirds[2].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["D"].idnum, awayId: bestThirds[3].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["E"].idnum, awayId: bestThirds[4].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["F"].idnum, awayId: bestThirds[5].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["G"].idnum, awayId: bestThirds[6].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["H"].idnum, awayId: bestThirds[7].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["I"].idnum, awayId: runnersUp["J"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["J"].idnum, awayId: runnersUp["I"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["K"].idnum, awayId: runnersUp["L"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["L"].idnum, awayId: runnersUp["K"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: runnersUp["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: runnersUp["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: runnersUp["E"].idnum, awayId: runnersUp["F"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: runnersUp["G"].idnum, awayId: runnersUp["H"].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];

                const r32Leg2 = r32Leg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: r32Leg1,
                  roundOf32Leg2: r32Leg2,
                  roundOf16Leg1: null,
                  roundOf16Leg2: null,
                  quarterFinalsLeg1: null,
                  quarterFinalsLeg2: null,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              }
            } else if (seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001") {
              if (cupState.teams.length === 32) {
                // End of 1st Group Stage (32 teams -> 16 teams)
                const groups = ["A", "B", "C", "D", "E", "F", "G", "H"];
                const winners = {};
                const runnersUp = {};

                groups.forEach(g => {
                  const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                    let gf = 0, ga = 0, points = 0;
                    cupState.fixtures.forEach(matchdayFixtures => {
                      matchdayFixtures.forEach(f => {
                        if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                          const isHome = f.homeId === t.idnum;
                          const myScore = isHome ? f.homeScore : f.awayScore;
                          const oppScore = isHome ? f.awayScore : f.homeScore;
                          gf += myScore; ga += oppScore;
                          if (myScore > oppScore) { points += 3; }
                          else if (myScore < oppScore) { /* lost */ }
                          else { points += 1; }
                        }
                      });
                    });
                    return { ...t, points, gd: gf - ga, gf };
                  }).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                  });

                  winners[g] = JSON.parse(JSON.stringify(gTeams[0]));
                  runnersUp[g] = JSON.parse(JSON.stringify(gTeams[1]));
                });

                // Re-group 16 teams into Groups A, B, C, D
                const groupA = [winners["A"], runnersUp["B"], winners["E"], runnersUp["F"]];
                const groupB = [winners["B"], runnersUp["A"], winners["F"], runnersUp["E"]];
                const groupC = [winners["C"], runnersUp["D"], winners["G"], runnersUp["H"]];
                const groupD = [winners["D"], runnersUp["C"], winners["H"], runnersUp["G"]];

                groupA.forEach(t => t.group = "A");
                groupB.forEach(t => t.group = "B");
                groupC.forEach(t => t.group = "C");
                groupD.forEach(t => t.group = "D");

                const advancingTeams = [...groupA, ...groupB, ...groupC, ...groupD];

                // Generate 6 new matchdays of fixtures for the 2nd Group Stage
                const extraFixtures = [];
                for (let m = 0; m < 6; m++) extraFixtures.push([]);

                ["A", "B", "C", "D"].forEach(g => {
                  const gTeams = advancingTeams.filter(t => t.group === g);
                  const t0 = gTeams[0].idnum;
                  const t1 = gTeams[1].idnum;
                  const t2 = gTeams[2].idnum;
                  const t3 = gTeams[3].idnum;

                  // Matchday 7 (extraFixtures[0])
                  extraFixtures[0].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                  extraFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
                  // Matchday 8 (extraFixtures[1])
                  extraFixtures[1].push({ homeId: t0, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                  extraFixtures[1].push({ homeId: t1, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
                  // Matchday 9 (extraFixtures[2])
                  extraFixtures[2].push({ homeId: t0, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
                  extraFixtures[2].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                  // Matchday 10 (extraFixtures[3])
                  extraFixtures[3].push({ homeId: t1, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                  extraFixtures[3].push({ homeId: t3, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                  // Matchday 11 (extraFixtures[4])
                  extraFixtures[4].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                  extraFixtures[4].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                  // Matchday 12 (extraFixtures[5])
                  extraFixtures[5].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                  extraFixtures[5].push({ homeId: t2, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                });

                cupState.teams = advancingTeams;
                cupState.fixtures.push(...extraFixtures);
                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: null, roundOf16Leg2: null,
                  quarterFinalsLeg1: null, quarterFinalsLeg2: null,
                  semiFinalsLeg1: null, semiFinalsLeg2: null,
                  final: null
                };
              } else {
                // End of 2nd Group Stage (16 teams -> 8 teams)
                const groups = ["A", "B", "C", "D"];
                const winners = {};
                const runnersUp = {};

                groups.forEach(g => {
                  const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                    let gf = 0, ga = 0, points = 0;
                    // Fixtures are in cupState.fixtures[6..11] for the 2nd stage
                    cupState.fixtures.forEach((matchdayFixtures, idx) => {
                      if (idx >= 6) {
                        matchdayFixtures.forEach(f => {
                          if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                            const isHome = f.homeId === t.idnum;
                            const myScore = isHome ? f.homeScore : f.awayScore;
                            const oppScore = isHome ? f.awayScore : f.homeScore;
                            gf += myScore; ga += oppScore;
                            if (myScore > oppScore) { points += 3; }
                            else if (myScore < oppScore) { /* lost */ }
                            else { points += 1; }
                          }
                        });
                      }
                    });
                    return { ...t, points, gd: gf - ga, gf };
                  }).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                  });

                  winners[g] = gTeams[0];
                  runnersUp[g] = gTeams[1];
                });

                const qfLeg1 = [
                  { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const qfLeg2 = qfLeg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: null, roundOf16Leg2: null,
                  quarterFinalsLeg1: qfLeg1,
                  quarterFinalsLeg2: qfLeg2,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              }
            } else if (seasonShort === "1989" || seasonShort === "1990" || seasonShort === "1991" || seasonShort === "1992" || seasonShort === "1993" || seasonShort === "1994" || seasonShort === "1995" || seasonShort === "1996" || seasonShort === "1997" || seasonShort === "1998" || seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001" || seasonShort === "2002" || seasonShort === "2003" || seasonShort === "2004" || seasonShort === "2005" || seasonShort === "2006" || seasonShort === "2007" || seasonShort === "2008") {
              if (stateCopy.region === "south_america" && (seasonShort === "1989" || seasonShort === "1990" || seasonShort === "1991" || seasonShort === "1992" || seasonShort === "1993" || seasonShort === "1994" || seasonShort === "1995" || seasonShort === "1996" || seasonShort === "1997" || seasonShort === "1998" || seasonShort === "1999")) {
                const groups = ["A", "B", "C", "D", "E"];
                const winnersList = [];
                const runnersUpList = [];
                const thirdsList = [];

                groups.forEach(g => {
                  const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                    let gf = 0, ga = 0, points = 0;
                    cupState.fixtures.forEach(matchdayFixtures => {
                      matchdayFixtures.forEach(f => {
                        if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                          const isHome = f.homeId === t.idnum;
                          const myScore = isHome ? f.homeScore : f.awayScore;
                          const oppScore = isHome ? f.awayScore : f.homeScore;
                          gf += myScore; ga += oppScore;
                          if (myScore > oppScore) { points += 3; }
                          else if (myScore < oppScore) { /* lost */ }
                          else { points += 1; }
                        }
                      });
                    });
                    return { ...t, points, gd: gf - ga, gf };
                  }).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                  });

                  winnersList.push(gTeams[0]);
                  runnersUpList.push(gTeams[1]);
                  thirdsList.push(gTeams[2]);
                });

                const sortRank = (list) => [...list].sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  if (b.gd !== a.gd) return b.gd - a.gd;
                  return b.gf - a.gf;
                });

                const sortedWinners = sortRank(winnersList);
                const sortedRunnersUp = sortRank(runnersUpList);
                const sortedThirds = sortRank(thirdsList);

                const defendingChamp = cupState.teams.find(t => t.group === "bye");

                const r16Leg1 = [
                  { homeId: defendingChamp.idnum, awayId: sortedThirds[4].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedWinners[0].idnum, awayId: sortedThirds[3].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedWinners[1].idnum, awayId: sortedThirds[2].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedWinners[2].idnum, awayId: sortedThirds[1].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedWinners[3].idnum, awayId: sortedThirds[0].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedWinners[4].idnum, awayId: sortedRunnersUp[4].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedRunnersUp[0].idnum, awayId: sortedRunnersUp[3].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: sortedRunnersUp[1].idnum, awayId: sortedRunnersUp[2].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const r16Leg2 = r16Leg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: r16Leg1,
                  roundOf16Leg2: r16Leg2,
                  quarterFinalsLeg1: null,
                  quarterFinalsLeg2: null,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              } else {
                const groups = ["A", "B", "C", "D", "E", "F", "G", "H"];
                const winners = {};
                const runnersUp = {};

                groups.forEach(g => {
                  const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                    let gf = 0, ga = 0, points = 0;
                    cupState.fixtures.forEach(matchdayFixtures => {
                      matchdayFixtures.forEach(f => {
                        if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                          const isHome = f.homeId === t.idnum;
                          const myScore = isHome ? f.homeScore : f.awayScore;
                          const oppScore = isHome ? f.awayScore : f.homeScore;
                          gf += myScore; ga += oppScore;
                          if (myScore > oppScore) { points += 3; }
                          else if (myScore < oppScore) { /* lost */ }
                          else { points += 1; }
                        }
                      });
                    });
                    return { ...t, points, gd: gf - ga, gf };
                  }).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.gd !== a.gd) return b.gd - a.gd;
                    return b.gf - a.gf;
                  });

                  winners[g] = gTeams[0];
                  runnersUp[g] = gTeams[1];
                });

                const r16Leg1 = [
                  { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["E"].idnum, awayId: runnersUp["F"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["F"].idnum, awayId: runnersUp["E"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["G"].idnum, awayId: runnersUp["H"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["H"].idnum, awayId: runnersUp["G"].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const r16Leg2 = r16Leg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: r16Leg1,
                  roundOf16Leg2: r16Leg2,
                  quarterFinalsLeg1: null,
                  quarterFinalsLeg2: null,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              }
            } else {
              const isTwoGroupSeason = seasonShort === "1991" || seasonShort === "1992" || seasonShort === "1993";
              const isSixGroupSeason = seasonShort === "1997" || seasonShort === "1998";
              const groups = isTwoGroupSeason
                ? ["A", "B"]
                : (isSixGroupSeason ? ["A", "B", "C", "D", "E", "F"] : ["A", "B", "C", "D"]);
              const winners = {};
              const runnersUp = {};

              groups.forEach(g => {
                const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
                  let gf = 0, ga = 0, points = 0;
                  cupState.fixtures.forEach(matchdayFixtures => {
                    matchdayFixtures.forEach(fx => {
                      if (fx.played && fx.group === g && (fx.homeId === t.idnum || fx.awayId === t.idnum)) {
                        const isHome = fx.homeId === t.idnum;
                        const myScore = isHome ? fx.homeScore : fx.awayScore;
                        const oppScore = isHome ? fx.awayScore : fx.homeScore;
                        gf += myScore; ga += oppScore;
                        if (myScore > oppScore) { points += 3; }
                        else if (myScore < oppScore) { /* lost */ }
                        else { points += 1; }
                      }
                    });
                  });
                  return { ...t, points, gd: gf - ga, gf };
                }).sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  if (b.gd !== a.gd) return b.gd - a.gd;
                  return b.gf - a.gf;
                });

                winners[g] = gTeams[0];
                runnersUp[g] = gTeams[1];
              });

              if (seasonShort === "1991" || seasonShort === "1992") {
                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: null, roundOf16Leg2: null,
                  quarterFinalsLeg1: null, quarterFinalsLeg2: null,
                  semiFinalsLeg1: null, semiFinalsLeg2: null,
                  final: [
                    { homeId: winners["A"].idnum, awayId: winners["B"].idnum, played: false, homeScore: 0, awayScore: 0 }
                  ]
                };
              } else if (seasonShort === "1993") {
                const sfLeg1 = [
                  { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const sfLeg2 = sfLeg1.map(m => ({
                  homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0
                }));
                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: null, roundOf16Leg2: null,
                  quarterFinalsLeg1: null, quarterFinalsLeg2: null,
                  semiFinalsLeg1: sfLeg1,
                  semiFinalsLeg2: sfLeg2,
                  final: null
                };
              } else if (isSixGroupSeason) {
                const runnersUpList = Object.values(runnersUp);
                runnersUpList.sort((a, b) => {
                  if (b.points !== a.points) return b.points - a.points;
                  if (b.gd !== a.gd) return b.gd - a.gd;
                  return b.gf - a.gf;
                });
                const bestRunners = [runnersUpList[0], runnersUpList[1]];
                const wA = winners["A"];
                const wB = winners["B"];
                const wC = winners["C"];
                const wD = winners["D"];
                const wE = winners["E"];
                const wF = winners["F"];

                const qfLeg1 = [
                  { homeId: wA.idnum, awayId: bestRunners[1].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: wB.idnum, awayId: bestRunners[0].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: wC.idnum, awayId: wD.idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: wE.idnum, awayId: wF.idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const qfLeg2 = qfLeg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: null, roundOf16Leg2: null,
                  quarterFinalsLeg1: qfLeg1,
                  quarterFinalsLeg2: qfLeg2,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              } else {
                const qfLeg1 = [
                  { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
                  { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 }
                ];
                const qfLeg2 = qfLeg1.map(m => ({
                  homeId: m.awayId,
                  awayId: m.homeId,
                  played: false,
                  homeScore: 0,
                  awayScore: 0
                }));

                cupState.knockoutState = {
                  roundOf32Leg1: null, roundOf32Leg2: null,
                  roundOf16Leg1: null, roundOf16Leg2: null,
                  quarterFinalsLeg1: qfLeg1,
                  quarterFinalsLeg2: qfLeg2,
                  semiFinalsLeg1: null,
                  semiFinalsLeg2: null,
                  final: null
                };
              }
            }
          }
        } else {
          // Play user CL Knockout match
          const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
          const kStateKey = toCamelCase(currentEvent.stage) + (currentEvent.stage !== "final" ? "Leg" + currentEvent.matchday : "");
          const bracket = cupState.knockoutState[kStateKey];
          const userFixture = bracket.find(f => f.homeId === pId || f.awayId === pId);
          userFixture.homeScore = scorehome;
          userFixture.awayScore = scoreaway;
          userFixture.played = true;

          // Simulate other CL Knockout matches
          bracket.forEach(f => {
            if (!f.played) {
              const h = cupState.teams.find(t => t.idnum === f.homeId);
              const a = cupState.teams.find(t => t.idnum === f.awayId);
              const { homeGoals, awayGoals } = simulateFixture(h, a);
              f.homeScore = homeGoals;
              f.awayScore = awayGoals;
              f.played = true;
            }
          });

          // Advance round if Leg 2 is done
          if (currentEvent.stage !== "final" && currentEvent.matchday === 2) {
            advanceKnockoutToNextRound(cupState, currentEvent.stage);
          }
        }
      } else if (isUEFA && rules && rules.format === "pure_knockout") {
        // UEFA Cup Knockout play
        const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
        const kStateKey = toCamelCase(currentEvent.stage) + (currentEvent.stage !== "final" ? "Leg" + currentEvent.matchday : "");
        const bracket = cupState.knockoutState[kStateKey];
        const userFixture = bracket.find(f => f.homeId === pId || f.awayId === pId);
        userFixture.homeScore = scorehome;
        userFixture.awayScore = scoreaway;
        userFixture.played = true;

        // Simulate other UEFA matches
        bracket.forEach(f => {
          if (!f.played) {
            const h = cupState.teams.find(t => t.idnum === f.homeId);
            const a = cupState.teams.find(t => t.idnum === f.awayId);
            const { homeGoals, awayGoals } = simulateFixture(h, a);
            f.homeScore = homeGoals;
            f.awayScore = awayGoals;
            f.played = true;
          }
        });

        // Advance knockout round if Leg 2 is done
        if (currentEvent.stage !== "final" && currentEvent.matchday === 2) {
          advanceKnockoutToNextRound(cupState, currentEvent.stage);
        }
      }

      // Update Fan Confidence after European cup match
      const isPlayerHome = teamonename === pId;
      const opponentId = isPlayerHome ? teamtwoname : teamonename;
      const playerTeam = cupState.teams.find(t => t.idnum === pId);
      const opponentTeam = cupState.teams.find(t => t.idnum === opponentId);
      const playerGoals = isPlayerHome ? scorehome : scoreaway;
      const opponentGoals = isPlayerHome ? scoreaway : scorehome;
      stateCopy.fanConfidence = updateFanConfidence(stateCopy.fanConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals);

      let justPlayedFixtures = [];
      let roundTitle = "";
      {
        const isCL = stateCopy.europeanCup === "cl";
        const isUEFA = stateCopy.europeanCup === "uefa";
        const seasonShort = stateCopy.season.split("/")[0];
        const activeClRules = stateCopy.region === "south_america"
          ? clibRules
          : (stateCopy.region === "north_america" ? concacafRules : clRules);
        const activeUefaRules = stateCopy.region === "south_america" ? csudRules : uefaRules;
        const rules = isCL ? activeClRules[seasonShort] : (isUEFA ? activeUefaRules[seasonShort] : ueclRules[seasonShort]);
        const hasGroupStage = rules && (
          (rules.format === "group_then_knockout" && currentEvent.stage === "group_stage") ||
          (rules.format === "league_then_knockout" && currentEvent.stage === "league_stage")
        );

        if (hasGroupStage) {
          const mIndex = currentEvent.matchday - 1;
          justPlayedFixtures = cupState.fixtures[mIndex] || [];
          roundTitle = `${stateCopy.europeanCup.toUpperCase()} MATCHDAY ${currentEvent.matchday}`;
        } else {
          const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
          const kStateKey = toCamelCase(currentEvent.stage) + (currentEvent.stage !== "final" ? "Leg" + currentEvent.matchday : "");
          justPlayedFixtures = cupState.knockoutState[kStateKey] || [];
          roundTitle = `${currentEvent.stage.replace(/_/g, ' ').toUpperCase()}${currentEvent.stage !== "final" ? ` LEG ${currentEvent.matchday}` : ""}`;
        }
      }

      stateCopy.calendarIndex += 1;

      // Save the advanced career state to localStorage first so that updateTeamStatsInStorage works on the updated state
      localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));

      // Restore starting lineup and roles so mid-match substitutions/adjustments don't persist
      if (savedStartingLineup) {
        localStorage.setItem(`retro_lineup_${playerTeam.name}_${stateCopy.season}`, JSON.stringify(savedStartingLineup));
      }
      if (savedStartingRoles) {
        localStorage.setItem(`retro_roles_${playerTeam.name}_${stateCopy.season}`, JSON.stringify(savedStartingRoles));
      }

      // Update roster & lineup conditions/injuries
      updatePlayerConditionsAndInjuries(playerTeam.name, stateCopy.season, false, true, getFinalMinutesMap());
      const oppIdEuro = teamonename === playerTeamId ? teamtwoname : teamonename;
      const oppTeamEuro = teamid ? teamid[oppIdEuro] : null;
      if (oppTeamEuro && oppTeamEuro.name) {
        updatePlayerConditionsAndInjuries(oppTeamEuro.name, stateCopy.season, false, true);
      }

      // Load updated lineup and update team stats in storage
      const lineupKey = `retro_lineup_${playerTeam.name}_${stateCopy.season}`;
      const savedLineup = localStorage.getItem(lineupKey);
      if (savedLineup) {
        try {
          const parsedLineup = JSON.parse(savedLineup);
          updateTeamStatsInStorage(parsedLineup, getSavedFormation(), savedStartingRoles || playerRoles);
          // Re-load the leagueState from storage
          const refreshedRaw = localStorage.getItem("retro_league_career");
          if (refreshedRaw) {
            const refreshedState = JSON.parse(refreshedRaw);
            stateCopy.teams = refreshedState.teams;
            stateCopy.europeanCupState.teams = refreshedState.europeanCupState.teams;
            stateCopy.fanConfidence = refreshedState.fanConfidence;
          }
        } catch (e) {
          console.error("Error updating team stats after player condition changes in Europe", e);
        }
      }

      localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
      navigate("/league/dashboard", {
        state: {
          showRoundResults: true,
          fixtures: justPlayedFixtures,
          roundTitle,
          themeColor: "#00e5ff"
        }
      });
    } else if (isTournament) {
      const stateCopy = { ...tournamentState };
      const currentStage = stateCopy.stage;

      let justPlayedFixtures = [];
      let roundTitle = "";
      if (currentStage === "groups") {
        justPlayedFixtures = stateCopy.fixtures[stateCopy.currentRound - 1] || [];
        roundTitle = `GROUP STAGE - ROUND ${stateCopy.currentRound}`;
      } else if (currentStage === "finalGroup") {
        justPlayedFixtures = stateCopy.knockoutState.finalGroup[stateCopy.currentRound - 1] || [];
        roundTitle = `FINAL ROUND - ROUND ${stateCopy.currentRound}`;
      } else {
        justPlayedFixtures = stateCopy.knockoutState[currentStage] || [];
        roundTitle = `${currentStage.replace(/([A-Z])/g, ' $1').toUpperCase()} RESULTS`;
      }

      if (currentStage === "groups" || currentStage === "finalGroup") {
        const roundFixtures = currentStage === "groups"
          ? stateCopy.fixtures[stateCopy.currentRound - 1]
          : stateCopy.knockoutState.finalGroup[stateCopy.currentRound - 1];

        const playerFixture = roundFixtures.find(
          f => f.homeId === stateCopy.playerTeamId || f.awayId === stateCopy.playerTeamId
        );
        if (playerFixture) {
          playerFixture.homeScore = scorehome;
          playerFixture.awayScore = scoreaway;
          playerFixture.played = true;
        }

        // Simulate other AI group stage fixtures
        roundFixtures.forEach(f => {
          if (!f.played) {
            const h = stateCopy.teams.find(t => t.idnum === f.homeId);
            const a = stateCopy.teams.find(t => t.idnum === f.awayId);

            const { homeGoals, awayGoals } = simulateFixture(h, a);
            f.homeScore = homeGoals;
            f.awayScore = awayGoals;
            f.played = true;
          }
        });

        // Advance round
        if (currentStage === "groups") {
          if (stateCopy.currentRound < stateCopy.fixtures.length) {
            stateCopy.currentRound += 1;
          } else {
            // Transition to Knockout Stage!
            initializeKnockouts(stateCopy);
          }
        } else {
          // finalGroup
          if (stateCopy.currentRound < 3) {
            stateCopy.currentRound += 1;
          } else {
            stateCopy.stage = "over";
          }
        }
      } else {
        // Knockout Stages
        const activeMatches = stateCopy.knockoutState[currentStage];
        const playerMatch = activeMatches.find(
          f => f.homeId === stateCopy.playerTeamId || f.awayId === stateCopy.playerTeamId
        );

        playerMatch.homeScore = scorehome;
        playerMatch.awayScore = scoreaway;
        playerMatch.penaltyHomeScore = homepenalty;
        playerMatch.penaltyAwayScore = awaypenalty;
        playerMatch.played = true;

        // Simulate other AI knockout fixtures
        activeMatches.forEach(f => {
          if (!f.played) {
            const h = stateCopy.teams.find(t => t.idnum === f.homeId);
            const a = stateCopy.teams.find(t => t.idnum === f.awayId);
            const { homeGoals, awayGoals } = simulateFixture(h, a);

            let pH = 0, pA = 0;
            if (homeGoals === awayGoals) {
              if (Math.random() > 0.5) { pH = 5; pA = 4; }
              else { pH = 4; pA = 5; }
            }
            f.homeScore = homeGoals;
            f.awayScore = awayGoals;
            f.penaltyHomeScore = pH;
            f.penaltyAwayScore = pA;
            f.played = true;
          }
        });

        // Advance knockout tier
        advanceKnockoutRound(stateCopy);
      }

      // Update Fan Confidence after tournament match
      const pId = stateCopy.playerTeamId;
      const isPlayerHome = teamonename === pId;
      const opponentId = isPlayerHome ? teamtwoname : teamonename;
      const playerTeam = stateCopy.teams.find(t => t.idnum === pId);
      const opponentTeam = stateCopy.teams.find(t => t.idnum === opponentId);
      const playerGoals = isPlayerHome ? scorehome : scoreaway;
      const opponentGoals = isPlayerHome ? scoreaway : scorehome;
      stateCopy.fanConfidence = updateFanConfidence(stateCopy.fanConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals);

      // Save the advanced tournament state to localStorage first so that updateTeamStatsInStorage works on the updated state
      localStorage.setItem("retro_tournament_state", JSON.stringify(stateCopy));

      // Restore starting lineup and roles so mid-match substitutions/adjustments don't persist
      const rosterSeason = stateCopy.cupId ? (stateCopy.cupId.match(/\d+/) ? stateCopy.cupId.match(/\d+/)[0] : "1995") : "1995";
      if (savedStartingLineup) {
        localStorage.setItem(`retro_lineup_${playerTeam.name}_${rosterSeason}`, JSON.stringify(savedStartingLineup));
      }
      if (savedStartingRoles) {
        localStorage.setItem(`retro_roles_${playerTeam.name}_${rosterSeason}`, JSON.stringify(savedStartingRoles));
      }

      // Update roster & lineup conditions/injuries
      updatePlayerConditionsAndInjuries(playerTeam.name, rosterSeason, true, true, getFinalMinutesMap());
      const oppIdTourn = teamonename === playerTeamId ? teamtwoname : teamonename;
      const oppTeamTourn = teamid ? teamid[oppIdTourn] : null;
      if (oppTeamTourn && oppTeamTourn.name) {
        updatePlayerConditionsAndInjuries(oppTeamTourn.name, rosterSeason, true, true);
      }

      // Load updated lineup and update team stats in storage
      const lineupKey = `retro_lineup_${playerTeam.name}_${rosterSeason}`;
      const savedLineup = localStorage.getItem(lineupKey);
      if (savedLineup) {
        try {
          const parsedLineup = JSON.parse(savedLineup);
          updateTeamStatsInStorage(parsedLineup, getSavedFormation(), savedStartingRoles || playerRoles);
          // Re-load tournamentState from storage
          const refreshedRaw = localStorage.getItem("retro_tournament_state");
          if (refreshedRaw) {
            const refreshedState = JSON.parse(refreshedRaw);
            stateCopy.teams = refreshedState.teams;
          }
        } catch (e) {
          console.error("Error updating team stats after player condition changes in Tournament", e);
        }
      }

      localStorage.setItem("retro_tournament_state", JSON.stringify(stateCopy));
      navigate("/tournament/dashboard", {
        state: {
          showRoundResults: true,
          fixtures: justPlayedFixtures,
          roundTitle,
          themeColor: "#ffd700"
        }
      });
    } else {
      const { teamName, season } = getPlayerTeamNameAndSeason();
      if (teamName && savedStartingLineup) {
        localStorage.setItem(`retro_lineup_${teamName}_${season}`, JSON.stringify(savedStartingLineup));
      }
      if (teamName && savedStartingRoles) {
        localStorage.setItem(`retro_roles_${teamName}_${season}`, JSON.stringify(savedStartingRoles));
      }
      navigate("/friendly");
    }
  };

  // Dynamic theme customization for different cup competitions
  const theme = {
    background: undefined,
    border: undefined,
    boxShadow: undefined,
    scoreboardStyle: {},
    buttonStyle: {}
  };

  const currentCalendarEvent = leagueState?.calendar ? leagueState.calendar[leagueState.calendarIndex] : null;
  const isDomesticCupMatch = isLeague && currentCalendarEvent && (currentCalendarEvent.type === "domestic_cup" || currentCalendarEvent.isDomesticCup);

  if (isDomesticCupMatch) {
    const primary = "#ff0055";
    theme.border = "2.5px solid #ff0055";
    theme.boxShadow = "0 0 35px rgba(255, 0, 85, 0.25)";
    theme.scoreboardStyle = {
      borderColor: primary,
      boxShadow: `0 10px 40px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(255, 0, 85, 0.05)`
    };
    theme.buttonStyle = {
      borderColor: primary,
      color: primary,
      background: "rgba(255, 0, 85, 0.04)",
      textShadow: `0 0 5px ${primary}`,
      boxShadow: `0 0 15px rgba(255, 0, 85, 0.25)`
    };
  } else if (isEurope) {
    const isCL = leagueState?.europeanCup === "cl";
    theme.background = isCL
      ? "radial-gradient(circle, #0b2545 0%, #020712 100%)"
      : "radial-gradient(circle, #3d1b04 0%, #0c0400 100%)";
    theme.border = isCL
      ? "2.5px solid #00e5ff"
      : "2.5px solid #ff8800";
    theme.boxShadow = isCL
      ? "0 0 35px rgba(0, 229, 255, 0.25)"
      : "0 0 35px rgba(255, 136, 0, 0.25)";

    const primary = isCL ? "#00e5ff" : "#ff8800";
    const secondary = isCL ? "rgba(0, 229, 255, 0.25)" : "rgba(255, 136, 0, 0.25)";
    const secondaryGlow = isCL ? "rgba(0, 229, 255, 0.05)" : "rgba(255, 136, 0, 0.05)";

    theme.scoreboardStyle = {
      borderColor: primary,
      boxShadow: `0 10px 40px rgba(0, 0, 0, 0.7), inset 0 0 20px ${secondaryGlow}`
    };
    theme.buttonStyle = {
      borderColor: primary,
      color: primary,
      background: isCL ? "rgba(0, 229, 255, 0.04)" : "rgba(255, 136, 0, 0.04)",
      textShadow: `0 0 5px ${primary}`,
      boxShadow: `0 0 15px ${secondary}`
    };
  } else if (isTournament) {
    const isWC = tournamentState?.isWorldCup;
    const isCopa = tournamentState?.teams?.length === 12 || tournamentState?.teams?.length === 10;
    theme.background = isWC
      ? "radial-gradient(circle, #0c1b33 0%, #030814 100%)"
      : (isCopa
        ? "radial-gradient(circle, #0a261c 0%, #020d09 100%)"
        : "radial-gradient(circle, #1f1135 0%, #080312 100%)");
    theme.border = isWC
      ? "2.5px solid #ffd700"
      : (isCopa
        ? "2.5px solid #00ff88"
        : "2.5px solid #c0c0c0");
    theme.boxShadow = isWC
      ? "0 0 35px rgba(255, 215, 0, 0.25)"
      : (isCopa
        ? "0 0 35px rgba(0, 255, 136, 0.25)"
        : "0 0 35px rgba(192, 192, 192, 0.25)");

    const primary = isWC ? "#ffd700" : (isCopa ? "#00ff88" : "#c0c0c0");
    const secondary = isWC ? "rgba(255, 215, 0, 0.25)" : (isCopa ? "rgba(0, 255, 136, 0.25)" : "rgba(192, 192, 192, 0.25)");
    const secondaryGlow = isWC ? "rgba(255, 215, 0, 0.05)" : (isCopa ? "rgba(0, 255, 136, 0.05)" : "rgba(192, 192, 192, 0.05)");

    theme.scoreboardStyle = {
      borderColor: primary,
      boxShadow: `0 10px 40px rgba(0, 0, 0, 0.7), inset 0 0 20px ${secondaryGlow}`
    };
    theme.buttonStyle = {
      borderColor: primary,
      color: primary,
      background: isWC
        ? "rgba(255, 215, 0, 0.04)"
        : (isCopa
          ? "rgba(0, 255, 136, 0.04)"
          : "rgba(192, 192, 192, 0.04)"),
      textShadow: `0 0 5px ${primary}`,
      boxShadow: `0 0 15px ${secondary}`
    };
  }

  const { season } = getPlayerTeamNameAndSeason();
  const maxSubs = getSubstitutionLimit(null, season);
  const maxStoppages = getStoppageLimit(null, season);

  const isHomeSubDisabled = isHomeDisabled || homeSubs >= maxSubs || (time !== 45 && time !== 0 && homeStoppagesUsed >= maxStoppages) || time === 0 || isGameOver || isPenaltyShootout;
  const isAwaySubDisabled = isAwayDisabled || awaySubs >= maxSubs || (time !== 45 && time !== 0 && awayStoppagesUsed >= maxStoppages) || time === 0 || isGameOver || isPenaltyShootout;

  return (
    <div
      className="match-dashboard-container"
      style={{
        background: theme.background,
        border: theme.border,
        boxShadow: theme.boxShadow
      }}
    >
      {showGoalFlash && (
        <div className="goal-flash-overlay">
          <div
            className="goal-flash-text"
            style={{
              '--team-primary': scoringTeamColors.primary,
              '--team-secondary': scoringTeamColors.secondary
            }}
          >
            GOAL!!!
          </div>
          <div className="goal-flash-sub">{goalSubtitle}</div>
        </div>
      )}

      {/* Stadium Scoreboard */}
      <div
        className="stadium-scoreboard"
        style={theme.scoreboardStyle}
      >
        <div className="board-panel team-name-left">
          <h2>{teamid[teamonename].name.toUpperCase()}</h2>
        </div>

        <div className="board-panel score-digits">
          <span className="digit-green">{scorehome}</span>
          <span className="digit-divider">:</span>
          <span className="digit-green">{scoreaway}</span>
        </div>

        <div className="board-panel team-name-right">
          <h2>{teamid[teamtwoname].name.toUpperCase()}</h2>
        </div>

        <div className="board-panel match-clock">
          <span className="clock-label">TIME</span>
          <span className="clock-val">{time}'</span>
        </div>
      </div>

      {/* Stadium & Attendance Info Strip */}
      {stadiumName && (
        <div
          className="match-venue-strip"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '5px 18px',
            margin: '0 auto 14px',
            maxWidth: '850px',
            background: 'rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            fontSize: '11px',
            fontFamily: 'Orbitron',
            color: '#ccc',
            letterSpacing: '0.6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span>🏟️</span>
            <strong style={{ color: '#fff' }}>{stadiumName}</strong>
          </span>
          {attendanceInfo && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#aaa' }}>
              <span>👥</span>
              <span>ATTENDANCE:</span>
              <strong style={{ color: '#00ff64' }}>{attendanceInfo.attendance.toLocaleString()}</strong>
              <span style={{ fontSize: '9.5px', opacity: 0.75 }}>({attendanceInfo.percent}%)</span>
            </span>
          )}
        </div>
      )}

      {/* Main Grid: Home, Pitch, Away */}
      <div className="teams match-arena-layout">

        {/* Left Side: Home Squad Card */}
        <div className="team-stats-card panel-left glass-card">
          <div className="kit-wrapper">
            {renderKit(teamid[teamonename])}
          </div>
          <h3 className="team-card-title">{teamid[teamonename].name}</h3>
          {homeManagerName && (
            <div style={{
              fontSize: '10px',
              color: '#ffd700',
              fontFamily: 'Orbitron',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>👔</span>
              <span>{homeManagerName}</span>
            </div>
          )}
          {homeFormation && (
            <span style={{ fontSize: '9px', color: '#00ff64', fontFamily: 'Orbitron', letterSpacing: '1px', marginBottom: '4px', opacity: 0.8 }}>
              ⚽ {homeFormation}
            </span>
          )}
          {cpuLineups[teamonename] && Object.keys(cpuLineups[teamonename]).length > 0 && (
            <button
              type="button"
              onClick={() => setShowOpponentModal(teamonename)}
              style={{
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid #00e5ff',
                color: '#00e5ff',
                fontSize: '9px',
                fontFamily: 'Orbitron',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
                marginBottom: '6px',
                letterSpacing: '0.5px'
              }}
            >
              📋 VIEW TEAM
            </button>
          )}

          <div className="team-card-bars">
            {(() => {
              const baseAtt = getBaseStat(teamonename, "attack");
              const modAtt = getModifiedStat(teamonename, "attack");
              const diffAtt = modAtt - baseAtt;
              const attSpan = diffAtt > 0 ? <span style={{ color: '#00ff64', fontWeight: 'bold' }}> +{diffAtt}</span> : (diffAtt < 0 ? <span style={{ color: '#ff4500', fontWeight: 'bold' }}> {diffAtt}</span> : null);

              const baseMid = getBaseStat(teamonename, "midfield");
              const modMid = getModifiedStat(teamonename, "midfield");
              const diffMid = modMid - baseMid;
              const midSpan = diffMid > 0 ? <span style={{ color: '#00ff64', fontWeight: 'bold' }}> +{diffMid}</span> : (diffMid < 0 ? <span style={{ color: '#ff4500', fontWeight: 'bold' }}> {diffMid}</span> : null);

              const baseDef = getBaseStat(teamonename, "defense");
              const modDef = getModifiedStat(teamonename, "defense");
              const diffDef = modDef - baseDef;
              const defSpan = diffDef > 0 ? <span style={{ color: '#00ff64', fontWeight: 'bold' }}> +{diffDef}</span> : (diffDef < 0 ? <span style={{ color: '#ff4500', fontWeight: 'bold' }}> {diffDef}</span> : null);

              return (
                <>
                  <div className="rpg-bar">
                    <span className="rpg-label">ATT: {baseAtt}{attSpan}</span>
                    <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${Math.min(100, modAtt * 20)}%`, transition: 'width 0.4s ease' }}></div></div>
                  </div>
                  <div className="rpg-bar">
                    <span className="rpg-label">MID: {baseMid}{midSpan}</span>
                    <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${Math.min(100, modMid * 20)}%`, transition: 'width 0.4s ease' }}></div></div>
                  </div>
                  <div className="rpg-bar">
                    <span className="rpg-label">DEF: {baseDef}{defSpan}</span>
                    <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${Math.min(100, modDef * 20)}%`, transition: 'width 0.4s ease' }}></div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', width: '100%' }}>
                    <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Orbitron' }}>
                      SUBS: <strong style={{ color: '#fff' }}>{maxSubs - homeSubs}</strong> LEFT
                      {maxStoppages < 99 && (
                        <div style={{ fontSize: '7.5px', marginTop: '2px', color: '#aaa' }}>
                          WINDOWS: <strong style={{ color: '#fff' }}>{maxStoppages - homeStoppagesUsed}</strong> LEFT
                        </div>
                      )}
                    </span>
                    <button
                      disabled={isHomeSubDisabled}
                      onClick={() => {
                        if (squad && squad.length > 0) {
                          setIsPlaying(false);
                          setShowSubModal(true);
                        } else {
                          handleSubstitution(true);
                        }
                      }}
                      style={{
                        background: isHomeSubDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(0, 229, 255, 0.1)',
                        border: isHomeSubDisabled ? '1px solid rgba(255,255,255,0.05)' : '1px solid #00e5ff',
                        color: isHomeSubDisabled ? '#888' : '#00e5ff',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '8px',
                        cursor: isHomeSubDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        opacity: isHomeSubDisabled ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: isHomeSubDisabled ? 'none' : '0 0 10px rgba(0, 229, 255, 0.2)',
                        textShadow: isHomeSubDisabled ? 'none' : '0 0 3px rgba(0, 229, 255, 0.5)'
                      }}
                      title="Open team tactics and substitutions"
                    >
                      ⚙️ TACTICS
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="dice-roll-container">
            <span className="roll-label">MIDFIELD ROLL</span>
            <div className="roll-number-glowing">{rollone}</div>
          </div>

          {/* Tactical Selector Panel */}
          <TacticsPanel
            disabled={isHomeDisabled}
            counter={homeCounter}
            setCounter={setHomeCounter}
            pressing={homePressing}
            setPressing={setHomePressing}
            tactic={homeTactic}
            setTactic={handleHomeTacticChange}
            mentalityCooldown={0}
            lineup={(teamonename === playerTeamId || (!isHomeDisabled && Object.keys(lineup).length > 0 && !cpuLineups[teamonename])) ? lineup : cpuLineups[teamonename]}
            formation={homeFormation || getSavedFormation() || '4-4-2'}
            playerRoles={(teamonename === playerTeamId || (!isHomeDisabled && Object.keys(lineup).length > 0 && !cpuLineups[teamonename])) ? playerRoles : (cpuRoles[teamonename] || {})}
            onToggleRole={(teamonename === playerTeamId || (!isHomeDisabled && Object.keys(lineup).length > 0 && !cpuLineups[teamonename])) ? handleTogglePlayerRole : undefined}
          />
        </div>

        {/* Center Side: Active Pitch Controller & Chronicle Feed */}
        <div className="pitch-controller-center">

          {/* Animated SVG/CSS Football Pitch */}
          <div className="retro-tactical-pitch">
            <div className="pitch-goal-net net-left"></div>
            <div className="pitch-goal-net net-right"></div>

            {/* Glowing Football animation */}
            <div className={`glowing-football ball-pos-${ballPosition}`}>
              ⚽
            </div>
          </div>

          {/* Momentum Indicator Bar */}
          <div className="momentum-bar-wrapper">
            <span className="momentum-title">MIDFIELD MOMENTUM</span>
            <div className="momentum-gauge">
              <div className="momentum-gauge-fill" style={{
                left: `${50 + ((rollone - rolltwo) * 6)}%`,
                width: '12px'
              }}></div>
            </div>
          </div>

          {/* Interactive Arena Actions */}
          <div className="arena-game-controls">

            {/* Normal Time next events */}
            {playMode === "manual" && !isGameOver && !isPenaltyShootout && !hasHomeChance && !hasAwayChance && !hasHomeScoreChance && !hasAwayScoreChance && (
              <button
                className="match-control-btn kickoff-theme-btn glowing-btn"
                onClick={() => {
                  if (time === 0 || time === 45) {
                    playSoundFile(whistleAudioRef);
                  }
                  increaseTime();
                }}
                style={theme.buttonStyle}
              >
                {time === 0 ? "KICK OFF MATCH" : (time === 45 ? "START 2ND HALF" : "ADVANCE TIME (Next Event)")}
              </button>
            )}

            {/* Active RPG Play buttons */}
            {playMode === "manual" && hasHomeChance && (
              <button className="match-control-btn active-attack-btn glowing-btn pulse" onClick={handleHomeChance}>
                🔥 {teamid[teamonename].name} Chance! Press Forward
              </button>
            )}

            {playMode === "manual" && hasHomeScoreChance && (
              <button className="match-control-btn score-shoot-btn glowing-btn pulse-glow" onClick={handleHomeScoreChance}>
                🎯 {teamid[teamonename].name} Shooting Chance! Shoot!
              </button>
            )}

            {playMode === "manual" && hasAwayChance && (
              <button className="match-control-btn active-attack-btn glowing-btn pulse" onClick={handleAwayChance}>
                🔥 {teamid[teamtwoname].name} Chance! Press Forward
              </button>
            )}

            {playMode === "manual" && hasAwayScoreChance && (
              <button className="match-control-btn score-shoot-btn glowing-btn pulse-glow" onClick={handleAwayScoreChance}>
                🎯 {teamid[teamtwoname].name} Shooting Chance! Shoot!
              </button>
            )}

            {/* Autoplay Controls */}
            {playMode === "auto" && !isGameOver && !isPenaltyShootout && (
              <div className="autoplay-manager-panel glass-card" style={{ width: '100%', padding: '15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'Orbitron', color: '#ffb300', fontWeight: 'bold', letterSpacing: '1.5px' }}>
                    AUTOPLAY MANAGER
                  </span>
                  <span style={{ fontSize: '10px', color: '#888', fontStyle: 'italic' }}>
                    {isPlaying ? (showGoalFlash ? "⏳ Celebration Pause" : "▶ Simulated play running") : "⏸ Simulation paused"}
                  </span>
                </div>

                {/* Main controls row */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                  {/* Play/Pause Button */}
                  <button
                    onClick={() => {
                      const nextPlaying = !isPlaying;
                      setIsPlaying(nextPlaying);
                      if (nextPlaying && (time === 0 || time === 45)) {
                        playSoundFile(whistleAudioRef);
                      }
                    }}
                    className="glowing-btn"
                    style={{
                      padding: '10px 24px',
                      fontFamily: 'Orbitron',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isPlaying ? '2px solid #ff4500' : '2px solid #00ff64',
                      background: isPlaying ? 'rgba(255, 69, 0, 0.05)' : 'rgba(0, 255, 100, 0.05)',
                      color: isPlaying ? '#ff4500' : '#00ff64',
                      boxShadow: isPlaying ? '0 0 15px rgba(255, 69, 0, 0.2)' : '0 0 15px rgba(0, 255, 100, 0.2)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isPlaying ? (
                      <>
                        <span style={{ fontSize: '10px' }}>⏸</span> PAUSE PLAY
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '10px' }}>▶</span> RESUME PLAY
                      </>
                    )}
                  </button>

                  {/* Speed Controls */}
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '3px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[
                      { label: "Slow", delay: 3200, title: "Relaxed Reading Pace (3.2s)" },
                      { label: "1x Normal", delay: 2200, title: "Authentic CM Pace (2.2s)" },
                      { label: "2x Fast", delay: 1200, title: "Fast Pace (1.2s)" },
                      { label: "3x Quick", delay: 600, title: "Quick Simulation (0.6s)" }
                    ].map(speedOpt => (
                      <button
                        key={speedOpt.label}
                        onClick={() => setSimSpeed(speedOpt.delay)}
                        title={speedOpt.title}
                        style={{
                          padding: '6px 12px',
                          fontFamily: 'Orbitron',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          border: 'none',
                          background: simSpeed === speedOpt.delay ? 'rgba(255, 215, 0, 0.18)' : 'transparent',
                          color: simSpeed === speedOpt.delay ? '#ffd700' : '#888',
                          textShadow: simSpeed === speedOpt.delay ? '0 0 5px rgba(255, 215, 0, 0.4)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {speedOpt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Indicator */}
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center', fontSize: '11.5px', color: '#ccc', fontFamily: 'monospace' }}>
                  {(() => {
                    if (showGoalFlash) return "🥅 Goal celebration in progress...";
                    if (hasHomeScoreChance) return `🎯 ${teamid[teamonename].name} is shooting!`;
                    if (hasAwayScoreChance) return `🎯 ${teamid[teamtwoname].name} is shooting!`;
                    if (hasHomeChance) return `🔥 ${teamid[teamonename].name} is in attack!`;
                    if (hasAwayChance) return `🔥 ${teamid[teamtwoname].name} is in attack!`;
                    if (time === 0) return "⚽ Awaiting kickoff. Press Play to start.";
                    if (time === 45) return "☕ Halftime interval. Press Play to start 2nd half.";
                    return "🔄 Standard midfield contest in progress...";
                  })()}
                </div>
              </div>
            )}


            {/* Shootouts */}
            {isPenaltyShootout && (
              <div className="penalty-shootout-actions animated-slide-in">
                <h3>PENALTY SHOOTOUT</h3>

                {/* Round Info */}
                {(() => {
                  const currentRoundNum = Math.max(penaltyHomeShots, penaltyAwayShots) + 1;
                  if (penaltyWinner) {
                    return (
                      <div className="penalty-winner-banner" style={{ color: '#00ff64', fontFamily: 'Orbitron', fontWeight: 'bold', fontSize: '16px', margin: '10px 0' }}>
                        🏆 WINNER: {teamid[penaltyWinner === 'home' ? teamonename : teamtwoname].name.toUpperCase()}
                      </div>
                    );
                  }

                  const isHomeTurn = (penaltyTurn === 'home');
                  const nextTeamName = teamid[isHomeTurn ? teamonename : teamtwoname].name;
                  const isCPUTurn = isHomeTurn ? isHomeDisabled : isAwayDisabled;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', margin: '5px 0' }}>
                      <span style={{ fontSize: '14px', color: '#ffb300', fontFamily: 'Orbitron' }}>
                        {currentRoundNum <= 5 ? `ROUND ${currentRoundNum} OF 5` : `💥 SUDDEN DEATH (ROUND ${currentRoundNum})`}
                      </span>
                      <span style={{ fontSize: '11px', color: '#aaa', letterSpacing: '1px' }}>
                        {isCPUTurn ? `🤖 CPU is preparing to shoot for ${nextTeamName}...` : `👉 YOUR TURN: Shoot for ${nextTeamName}!`}
                      </span>
                    </div>
                  );
                })()}

                <div className="penalty-board" style={{ fontSize: '20px', letterSpacing: '1px', margin: '5px 0' }}>
                  <span style={{ color: '#00e5ff' }}>{teamid[teamonename].name} {homepenalty}</span>
                  <span style={{ color: '#888', margin: '0 10px' }}>-</span>
                  <span style={{ color: '#00e5ff' }}>{awaypenalty} {teamid[teamtwoname].name}</span>
                </div>

                <div style={{ fontSize: '11px', color: '#888', margin: '0 0 10px 0' }}>
                  Shots: {penaltyHomeShots} | {penaltyAwayShots}
                </div>

                {!penaltyWinner && (
                  <div className="penalty-buttons-deck">
                    <button
                      className="penalty-btn glowing-btn"
                      onClick={handleHomePenalty}
                      disabled={penaltyTurn !== 'home' || isHomeDisabled || isPenaltyCPUProcessing}
                      style={{
                        opacity: (penaltyTurn === 'home' && !isHomeDisabled && !isPenaltyCPUProcessing) ? 1 : 0.3,
                        cursor: (penaltyTurn === 'home' && !isHomeDisabled && !isPenaltyCPUProcessing) ? 'pointer' : 'not-allowed',
                        borderColor: (penaltyTurn === 'home' && !isHomeDisabled && !isPenaltyCPUProcessing) ? '#ffd700' : 'rgba(255,255,255,0.1)',
                        color: (penaltyTurn === 'home' && !isHomeDisabled && !isPenaltyCPUProcessing) ? '#ffd700' : '#888',
                        background: (penaltyTurn === 'home' && !isHomeDisabled && !isPenaltyCPUProcessing) ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                      }}
                    >
                      Home Shoot ({teamid[teamonename].name})
                    </button>
                    <button
                      className="penalty-btn glowing-btn"
                      onClick={handleAwayPenalty}
                      disabled={penaltyTurn !== 'away' || isAwayDisabled || isPenaltyCPUProcessing}
                      style={{
                        opacity: (penaltyTurn === 'away' && !isAwayDisabled && !isPenaltyCPUProcessing) ? 1 : 0.3,
                        cursor: (penaltyTurn === 'away' && !isAwayDisabled && !isPenaltyCPUProcessing) ? 'pointer' : 'not-allowed',
                        borderColor: (penaltyTurn === 'away' && !isAwayDisabled && !isPenaltyCPUProcessing) ? '#ffd700' : 'rgba(255,255,255,0.1)',
                        color: (penaltyTurn === 'away' && !isAwayDisabled && !isPenaltyCPUProcessing) ? '#ffd700' : '#888',
                        background: (penaltyTurn === 'away' && !isAwayDisabled && !isPenaltyCPUProcessing) ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                      }}
                    >
                      Away Shoot ({teamid[teamtwoname].name})
                    </button>
                  </div>
                )}

                {!penaltyWinner && (
                  <button className="match-control-btn end-game-btn" onClick={handleExitMatch} style={{ marginTop: '10px' }}>
                    END MATCH & EXIT
                  </button>
                )}
              </div>
            )}

            {/* Game Over exit button */}
            {isGameOver && (
              <button className="match-control-btn end-game-btn glowing-btn" onClick={handleExitMatch}>
                {isTournament
                  ? "🏆 EXIT TO TOURNAMENT OFFICE"
                  : (isEurope
                    ? "🏆 EXIT TO LEAGUE OFFICE"
                    : (isLeague
                      ? "🏆 EXIT TO LEAGUE OFFICE"
                      : "🏆 EXIT TO EXHIBITION LOBBY"))}
              </button>
            )}

          </div>

          {/* CM 01/02 Retro Live Commentary Console (Positioned directly below Pitch & Controls) */}
          <div className="cm-live-commentary-section">
            {/* Iconic CM 01/02 Flashing Single-Line Live Commentary Bar */}
            <div
              className={`cm-live-commentary-bar ${liveBanner?.type === 'goal' ? 'cm-goal-flash' : ''}`}
              style={getCommentaryBarStyle()}
            >
              {liveBanner?.text || "⚽ Match awaiting kickoff..."}
            </div>

            {/* CM 01/02 Incident & Chronicle Stream */}
            <div className="cm-commentary-console">
              <div className="cm-console-header">
                <span className="cm-header-title">
                  <span className="cm-retro-icon">⚽</span> CM 01/02 MATCH INCIDENT &amp; COMMENTARY LOG
                </span>
                <span className="cm-header-ref">
                  REF: {referee.toUpperCase()}
                </span>
              </div>
              <div className="cm-commentary-stream">
                {chronicle.map((item, index) => {
                  let rowClass = `cm-comm-item cm-type-${item.type}`;
                  if (item.type === 'goal') rowClass += ' goal';
                  else if (item.type === 'save') rowClass += ' save';
                  else if (item.type === 'miss') rowClass += ' miss';
                  else if (item.type === 'chance') rowClass += ' chance';
                  if (index === 0) rowClass += ' latest-item';

                  const sideColor = item.side === 'away'
                    ? (teamid[teamtwoname]?.primaryColor || '#40e0d0')
                    : item.side === 'home'
                      ? (teamid[teamonename]?.primaryColor || '#ffdd44')
                      : '#00a2a2';

                  return (
                    <div
                      key={index}
                      className={rowClass}
                      style={{
                        borderLeftColor: item.type === 'goal' ? '#ffd700' : (item.side === 'neutral' ? '#00a2a2' : sideColor)
                      }}
                    >
                      <span className="cm-comm-min">{item.time}'</span>
                      <span className="cm-comm-text">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Away Squad Card */}
        <div className="team-stats-card panel-right glass-card">
          <div className="kit-wrapper">
            {renderKit(teamid[teamtwoname])}
          </div>
          <h3 className="team-card-title">{teamid[teamtwoname].name}</h3>
          {awayManagerName && (
            <div style={{
              fontSize: '10px',
              color: '#00e5ff',
              fontFamily: 'Orbitron',
              letterSpacing: '0.5px',
              marginBottom: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>👔</span>
              <span>{awayManagerName}</span>
            </div>
          )}
          {awayFormation && (
            <span style={{ fontSize: '9px', color: '#00ff64', fontFamily: 'Orbitron', letterSpacing: '1px', marginBottom: '4px', opacity: 0.8 }}>
              ⚽ {awayFormation}
            </span>
          )}
          {cpuLineups[teamtwoname] && Object.keys(cpuLineups[teamtwoname]).length > 0 && (
            <button
              type="button"
              onClick={() => setShowOpponentModal(teamtwoname)}
              style={{
                background: 'rgba(0, 229, 255, 0.12)',
                border: '1px solid #00e5ff',
                color: '#00e5ff',
                fontSize: '9px',
                fontFamily: 'Orbitron',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: 'pointer',
                marginBottom: '6px',
                letterSpacing: '0.5px'
              }}
            >
              📋 VIEW TEAM
            </button>
          )}

          <div className="team-card-bars">
            {(() => {
              const baseAtt = getBaseStat(teamtwoname, "attack");
              const modAtt = getModifiedStat(teamtwoname, "attack");
              const diffAtt = modAtt - baseAtt;
              const attSpan = diffAtt > 0 ? <span style={{ color: '#00ff64', fontWeight: 'bold' }}> +{diffAtt}</span> : (diffAtt < 0 ? <span style={{ color: '#ff4500', fontWeight: 'bold' }}> {diffAtt}</span> : null);

              const baseMid = getBaseStat(teamtwoname, "midfield");
              const modMid = getModifiedStat(teamtwoname, "midfield");
              const diffMid = modMid - baseMid;
              const midSpan = diffMid > 0 ? <span style={{ color: '#00ff64', fontWeight: 'bold' }}> +{diffMid}</span> : (diffMid < 0 ? <span style={{ color: '#ff4500', fontWeight: 'bold' }}> {diffMid}</span> : null);

              const baseDef = getBaseStat(teamtwoname, "defense");
              const modDef = getModifiedStat(teamtwoname, "defense");
              const diffDef = modDef - baseDef;
              const defSpan = diffDef > 0 ? <span style={{ color: '#00ff64', fontWeight: 'bold' }}> +{diffDef}</span> : (diffDef < 0 ? <span style={{ color: '#ff4500', fontWeight: 'bold' }}> {diffDef}</span> : null);

              return (
                <>
                  <div className="rpg-bar">
                    <span className="rpg-label">ATT: {baseAtt}{attSpan}</span>
                    <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${Math.min(100, modAtt * 20)}%`, transition: 'width 0.4s ease' }}></div></div>
                  </div>
                  <div className="rpg-bar">
                    <span className="rpg-label">MID: {baseMid}{midSpan}</span>
                    <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${Math.min(100, modMid * 20)}%`, transition: 'width 0.4s ease' }}></div></div>
                  </div>
                  <div className="rpg-bar">
                    <span className="rpg-label">DEF: {baseDef}{defSpan}</span>
                    <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${Math.min(100, modDef * 20)}%`, transition: 'width 0.4s ease' }}></div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', width: '100%' }}>
                    <span style={{ fontSize: '9px', color: '#888', fontFamily: 'Orbitron' }}>
                      SUBS: <strong style={{ color: '#fff' }}>{maxSubs - awaySubs}</strong> LEFT
                      {maxStoppages < 99 && (
                        <div style={{ fontSize: '7.5px', marginTop: '2px', color: '#aaa' }}>
                          WINDOWS: <strong style={{ color: '#fff' }}>{maxStoppages - awayStoppagesUsed}</strong> LEFT
                        </div>
                      )}
                    </span>
                    <button
                      disabled={isAwaySubDisabled}
                      onClick={() => {
                        if (squad && squad.length > 0) {
                          setIsPlaying(false);
                          setShowSubModal(true);
                        } else {
                          handleSubstitution(false);
                        }
                      }}
                      style={{
                        background: isAwaySubDisabled ? 'rgba(255,255,255,0.03)' : 'rgba(0, 229, 255, 0.1)',
                        border: isAwaySubDisabled ? '1px solid rgba(255,255,255,0.05)' : '1px solid #00e5ff',
                        color: isAwaySubDisabled ? '#888' : '#00e5ff',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '8px',
                        cursor: isAwaySubDisabled ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                        opacity: isAwaySubDisabled ? 0.4 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: isAwaySubDisabled ? 'none' : '0 0 10px rgba(0, 229, 255, 0.2)',
                        textShadow: isAwaySubDisabled ? 'none' : '0 0 3px rgba(0, 229, 255, 0.5)'
                      }}
                      title="Open team tactics and substitutions"
                    >
                      ⚙️ TACTICS
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="dice-roll-container">
            <span className="roll-label">MIDFIELD ROLL</span>
            <div className="roll-number-glowing">{rolltwo}</div>
          </div>

          {/* Tactical Selector Panel */}
          <TacticsPanel
            disabled={isAwayDisabled}
            counter={awayCounter}
            setCounter={setAwayCounter}
            pressing={awayPressing}
            setPressing={setAwayPressing}
            tactic={awayTactic}
            setTactic={handleAwayTacticChange}
            mentalityCooldown={0}
            lineup={(teamtwoname === playerTeamId || (!isAwayDisabled && Object.keys(lineup).length > 0 && !cpuLineups[teamtwoname])) ? lineup : cpuLineups[teamtwoname]}
            formation={awayFormation || getSavedFormation() || '4-4-2'}
            playerRoles={(teamtwoname === playerTeamId || (!isAwayDisabled && Object.keys(lineup).length > 0 && !cpuLineups[teamtwoname])) ? playerRoles : (cpuRoles[teamtwoname] || {})}
            onToggleRole={(teamtwoname === playerTeamId || (!isAwayDisabled && Object.keys(lineup).length > 0 && !cpuLineups[teamtwoname])) ? handleTogglePlayerRole : undefined}
          />
        </div>

      </div>

      {showSubModal && (
        <div className="sub-modal-overlay">
          <div className="sub-modal-container">
            {/* Modal Header */}
            <div className="sub-modal-header">
              <div>
                <h2 className="sub-modal-title">
                  MANUAL SUBSTITUTIONS & ROLES
                </h2>
                <span className="sub-modal-subtitle">
                  Drag & Drop or Click to swap players, or click role badges to change player duties. Subs used: <strong style={{ color: '#00e5ff' }}>{isPlayerHome ? homeSubs : awaySubs} / {maxSubs}</strong>{maxStoppages < 99 && <> (Stoppages: <strong style={{ color: '#00e5ff' }}>{isPlayerHome ? homeStoppagesUsed : awayStoppagesUsed} / {maxStoppages}</strong>)</>}
                </span>
              </div>
              <button
                onClick={handleCloseSubModal}
                className="sub-modal-close-btn"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="sub-modal-content">
              {/* Pitch Area */}
              <div className="sub-modal-pitch-area">
                <div className="sub-modal-pitch-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span className="sub-modal-pitch-title">TACTICAL FORMATION: {getSavedFormation().toUpperCase()}</span>
                  {(() => {
                    const activeMentality = isPlayerHome ? homeTactic : awayTactic;
                    const calc = calculateTeamTacticalStats(lineup, getSavedFormation(), playerRoles, activeMentality);
                    return (
                      <span style={{ fontSize: '9.5px', fontFamily: 'Orbitron', color: '#00ff64', letterSpacing: '0.5px' }}>
                        🛡️ DEF: {calc.defense} ({calc.defSum.toFixed(0)}÷4) &nbsp;|&nbsp; ⚙️ MID: {calc.midfield} ({calc.midSum.toFixed(0)}÷4) &nbsp;|&nbsp; ⚔️ ATT: {calc.attack} ({calc.attSum.toFixed(0)}÷2)
                      </span>
                    );
                  })()}
                </div>

                {/* Visual field */}
                <div className="sub-modal-pitch-field">
                  {/* Field lines representation */}
                  <div style={{ position: 'absolute', top: '4%', bottom: '4%', left: '4%', right: '4%', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '4%', right: '4%', height: '1px', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />

                  {/* Penalty Areas */}
                  <div style={{ position: 'absolute', top: '4%', left: '25%', right: '25%', height: '12%', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: '4%', left: '25%', right: '25%', height: '12%', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', pointerEvents: 'none' }} />

                  {/* Pitch Slots */}
                  {getFormationSlots(getSavedFormation()).map(slot => {
                    const assignedPlayer = lineup[slot.id];
                    const idealPos = getIdealSlotPosition(slot.role, slot.x, slot.y);
                    const slotWithPos = { ...slot, idealPos };
                    const currentRole = playerRoles[slot.id] || 'normal';
                    const roleMeta = assignedPlayer
                      ? getRoleMetadata(slotWithPos, assignedPlayer, currentRole)
                      : null;

                    let displayRating = 1;
                    let penalty = 0;
                    let penaltyTitle = "";
                    if (assignedPlayer) {
                      penalty = getPositionPenalty(assignedPlayer.positions || [assignedPlayer.position], idealPos);
                      const reduction = (assignedPlayer.condition < 80 ? 1 : 0) + penalty;
                      displayRating = Math.max(1, assignedPlayer.rating - reduction);

                      if (penalty > 0) {
                        penaltyTitle = `Skill reduced by ${penalty} for playing out of position (Ideal: ${idealPos}, Plays: ${(assignedPlayer.positions || [assignedPlayer.position]).join(', ')})`;
                      }
                      if (assignedPlayer.condition < 80) {
                        penaltyTitle += (penaltyTitle ? " & " : "") + "Rating reduced by 1 due to low condition (<80%)";
                      }
                    }

                    return (
                      <div
                        key={slot.id}
                        onDragOver={(e) => { e.preventDefault(); setDragOverSlotId(slot.id); }}
                        onDragLeave={() => setDragOverSlotId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlotId(null);
                          if (draggedPlayer) {
                            executeSwap(draggedPlayer, slot.id, assignedPlayer);
                            setDraggedPlayer(null);
                          }
                        }}
                        style={{
                          left: `${slot.x}%`,
                          top: `${slot.y}%`
                        }}
                        className="sub-modal-pitch-slot"
                      >
                        {assignedPlayer ? (
                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggedPlayer(assignedPlayer);
                            }}
                            onClick={() => {
                              if (selectedRosterPlayer) {
                                executeSwap(selectedRosterPlayer, slot.id, assignedPlayer);
                                setSelectedRosterPlayer(null);
                              } else {
                                setSelectedRosterPlayer(assignedPlayer);
                              }
                            }}
                            style={{
                              background: selectedRosterPlayer?.name === assignedPlayer.name ? 'rgba(0, 229, 255, 0.25)' : undefined,
                              border: `1.5px solid ${selectedRosterPlayer?.name === assignedPlayer.name ? '#00e5ff' : getPositionColor(assignedPlayer.position)}`,
                              boxShadow: `0 4px 10px rgba(0,0,0,0.5), 0 0 8px ${getPositionColor(assignedPlayer.position)}33`,
                              position: 'relative'
                            }}
                            className="sub-modal-player-card"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removePlayerFromField(slot.id, assignedPlayer);
                              }}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                background: '#ff3b30',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                fontSize: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                zIndex: 10,
                                fontWeight: 'bold',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                              }}
                              title="Remove player from field"
                            >
                              ✕
                            </button>
                            <span
                              style={{ color: getPositionColor(assignedPlayer.position) }}
                              className="sub-modal-player-position"
                            >
                              {assignedPlayer.position}
                            </span>
                            <span className="sub-modal-player-name">
                              {assignedPlayer.injuryMatchesLeft > 0 ? "🤕 " : ""}{getLastName(assignedPlayer.name)}
                            </span>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                              <span
                                style={{ color: (assignedPlayer.condition < 80 || penalty > 0) ? '#ffa500' : '#00ff64' }}
                                className="sub-modal-player-rating"
                                title={penaltyTitle}
                              >
                                ★{displayRating}
                              </span>
                              <span
                                style={{ color: assignedPlayer.condition < 80 ? '#ffa500' : '#00ff64', fontSize: '7px', fontWeight: 'bold', fontFamily: 'Orbitron, sans-serif' }}
                                className="sub-modal-player-condition"
                              >
                                ⚡{assignedPlayer.condition}%
                              </span>
                            </div>
                            {slot.role !== 'gk' && roleMeta && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextRole = getNextRoleForSlot(slotWithPos, assignedPlayer, roleMeta.id);
                                  handleTogglePlayerRole(slot.id, nextRole, assignedPlayer, slotWithPos);
                                }}
                                title={`${roleMeta.label}: ${roleMeta.desc} (Click to change role)`}
                                style={{
                                  marginTop: '2px',
                                  padding: '1px 4px',
                                  fontSize: '6.5px',
                                  fontFamily: 'Orbitron, sans-serif',
                                  fontWeight: 'bold',
                                  borderRadius: '3px',
                                  border: `1px solid ${roleMeta.color}`,
                                  background: roleMeta.id === 'normal' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.75)',
                                  color: roleMeta.color,
                                  cursor: 'pointer',
                                  lineHeight: 1.2
                                }}
                              >
                                {roleMeta.shortLabel} ↻
                              </button>
                            )}
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              if (selectedRosterPlayer) {
                                executeSwap(selectedRosterPlayer, slot.id, null);
                                setSelectedRosterPlayer(null);
                              }
                            }}
                            style={{
                              border: dragOverSlotId === slot.id ? '2px dashed #00ff64' : undefined,
                              background: dragOverSlotId === slot.id ? 'rgba(0, 255, 100, 0.12)' : undefined,
                              color: dragOverSlotId === slot.id ? '#00ff64' : undefined
                            }}
                            className="sub-modal-empty-slot"
                          >
                            <span>+</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Roster Area (Bench & Reserves) */}
              <div className="sub-modal-roster-area">
                <h3 className="sub-modal-roster-header">SQUAD ROSTER & BENCH</h3>
                <div className="sub-modal-roster-list">
                  {squad
                    .filter(player => {
                      const isStarting = Object.values(lineup).some(lp => lp && lp.name === player.name);
                      if (isStarting) return false;
                      if (selectedBenchNames && selectedBenchNames.length > 0) {
                        return selectedBenchNames.includes(player.name);
                      }
                      return true;
                    })
                    .map(player => {
                      const isInjured = player.injuryMatchesLeft > 0;
                      const hasExited = playerMinutes[player.name]?.exitedAt !== null && playerMinutes[player.name]?.started;

                      return (
                        <div
                          key={player.name}
                          draggable={!(isInjured || hasExited)}
                          onDragStart={(e) => {
                            setDraggedPlayer(player);
                          }}
                          onClick={() => {
                            if (isInjured || hasExited) return;
                            if (selectedRosterPlayer?.name === player.name) {
                              setSelectedRosterPlayer(null);
                            } else {
                              setSelectedRosterPlayer(player);
                            }
                          }}
                          style={{
                            background: selectedRosterPlayer?.name === player.name ? 'rgba(0, 229, 255, 0.15)' : undefined,
                            border: selectedRosterPlayer?.name === player.name ? '1px solid #00e5ff' : undefined,
                            opacity: (isInjured || hasExited) ? 0.45 : 1,
                            cursor: (isInjured || hasExited) ? 'not-allowed' : 'pointer'
                          }}
                          className="sub-modal-roster-item"
                        >
                          <div className="sub-modal-roster-item-info">
                            <span
                              style={{ color: getPositionColor(player.position) }}
                              className="sub-modal-roster-item-position"
                              title={`Plays positions: ${(player.positions || [player.position]).join(', ')}`}
                            >
                              {player.position}
                            </span>
                            <span className="sub-modal-roster-item-name">
                              {isInjured ? "🤕 " : ""}{player.name}
                            </span>
                          </div>

                          <div className="sub-modal-roster-item-stats">
                            {isInjured ? (
                              <span className="sub-modal-roster-item-injured">
                                Injured ({player.injuryMatchesLeft}m)
                              </span>
                            ) : hasExited ? (
                              <span style={{ color: '#ff4500', fontSize: '9px', fontWeight: 'bold' }}>
                                SUBBED OUT
                              </span>
                            ) : (
                              <>
                                <span
                                  style={{ color: player.condition < 80 ? '#ffa500' : '#00ff64' }}
                                  className="sub-modal-roster-item-condition"
                                >
                                  ⚡{player.condition}%
                                </span>
                                <span
                                  style={{ color: player.condition < 80 ? '#ffa500' : '#ffd700' }}
                                  className="sub-modal-roster-item-rating"
                                >
                                  ★{player.condition < 80 ? Math.max(1, player.rating - 1) : player.rating}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sub-modal-footer">
              <button
                onClick={handleCloseSubModal}
                className="sub-modal-resume-btn"
              >
                RESUME MATCH
              </button>
            </div>
          </div>
        </div>
      )}

      {showOpponentModal && teamid && teamid[showOpponentModal] && (() => {
        const oppTeam = teamid[showOpponentModal];
        const isOppHome = showOpponentModal === teamonename;
        const oppFormation = isOppHome ? homeFormation : awayFormation;
        const oppTactic = (isOppHome ? homeTactic : awayTactic) || 'normal';
        const oppLineup = cpuLineups[showOpponentModal] || {};
        const oppBench = cpuBenches[showOpponentModal] || [];
        const oppRoles = cpuRoles[showOpponentModal] || {};
        const slots = getFormationSlots(oppFormation || '4-4-2');

        return (
          <div
            className="sub-modal-overlay"
            onClick={() => setShowOpponentModal(null)}
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
              padding: '16px'
            }}
          >
            <div
              className="sub-modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(180deg, #10131c 0%, #080a0f 100%)',
                border: '1.5px solid rgba(0, 229, 255, 0.35)',
                borderRadius: '12px',
                width: '95%',
                maxWidth: '1050px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 0 35px rgba(0, 229, 255, 0.25)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 22px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.3)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontFamily: 'Orbitron', color: '#00e5ff', fontSize: '18px', letterSpacing: '1px' }}>
                      {oppTeam?.name}
                    </h2>
                    {(() => {
                      const oppMgr = showOpponentModal === teamonename ? homeManagerName : awayManagerName;
                      return oppMgr ? (
                        <span style={{
                          fontSize: '10px',
                          color: '#ffd700',
                          fontFamily: 'Orbitron',
                          background: 'rgba(255, 215, 0, 0.1)',
                          border: '1px solid rgba(255, 215, 0, 0.25)',
                          borderRadius: '10px',
                          padding: '2px 8px'
                        }}>
                          👔 {oppMgr}
                        </span>
                      ) : null;
                    })()}
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'Orbitron',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0, 229, 255, 0.15)',
                      border: '1px solid rgba(0, 229, 255, 0.4)',
                      color: '#00e5ff'
                    }}>
                      OPPONENT
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#00ff64', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                      ⚽ Formation: {oppFormation}
                    </span>
                    <span style={{ fontSize: '10px', color: '#ffd700', fontFamily: 'Orbitron', textTransform: 'uppercase' }}>
                      Mentality: {oppTactic}
                    </span>
                    <span style={{ fontSize: '10px', color: '#aaa', fontFamily: 'Orbitron' }}>
                      LIVE: ATT {getModifiedStat(showOpponentModal, "attack")} | MID {getModifiedStat(showOpponentModal, "midfield")} | DEF {getModifiedStat(showOpponentModal, "defense")}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOpponentModal(null)}
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

              {/* Two Column Layout: Pitch & Bench */}
              <div style={{ display: 'flex', gap: '20px', padding: '20px', flexWrap: 'wrap' }}>
                {/* Column 1: Field Lineup */}
                <div style={{ flex: '1 1 540px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'Orbitron', fontWeight: 'bold', color: '#00e5ff', letterSpacing: '0.8px' }}>
                      STARTING XI ON FIELD
                    </span>
                  </div>

                  <div
                    className="sub-modal-pitch-field"
                    style={{
                      position: 'relative',
                      height: '360px',
                      minHeight: '360px',
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
                      const p = oppLineup[slot.id];
                      const idealPos = getIdealSlotPosition(slot.role, slot.x, slot.y);
                      const activeRole = oppRoles[slot.id] || 'normal';
                      const roleMeta = p ? getRoleMetadata(idealPos, p.positions || [idealPos], activeRole) : null;
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
                                {idealPos !== 'GK' && roleMeta && activeRole !== 'normal' && (
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
                </div>

                {/* Column 2: Substitutes Bench */}
                <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '280px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'Orbitron', fontWeight: 'bold', color: '#aaa', letterSpacing: '0.8px' }}>
                      AVAILABLE SUBSTITUTES ({oppBench.length})
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxHeight: '360px',
                    overflowY: 'auto',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {oppBench && oppBench.length > 0 ? (
                      oppBench.map((p, idx) => (
                        <div
                          key={p.name || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'rgba(0, 0, 0, 0.35)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '5px',
                            fontSize: '11px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 'bold',
                              fontFamily: 'Orbitron',
                              color: getPositionColor(p.position),
                              background: 'rgba(255, 255, 255, 0.06)',
                              padding: '2px 5px',
                              borderRadius: '3px'
                            }}>
                              {p.position || 'SUB'}
                            </span>
                            <span style={{ color: '#fff', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                              {p.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', flexShrink: 0 }}>
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
                      <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '12px', textAlign: 'center' }}>
                        No substitutes on the bench
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'flex-end',
                background: 'rgba(0,0,0,0.2)'
              }}>
                <button
                  type="button"
                  onClick={() => setShowOpponentModal(null)}
                  style={{
                    background: 'rgba(0, 229, 255, 0.15)',
                    border: '1px solid #00e5ff',
                    color: '#00e5ff',
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
        );
      })()}
    </div>
  );
}
