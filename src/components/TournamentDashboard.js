import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import '../assets/styles/Match.css';
import RoundResultsModal from './RoundResultsModal';
import { FormationTacticsModal, getSavedFormation, FormationPitch, updateTeamStatsInStorage } from './FormationTactics';
import { updatePlayerConditionsAndInjuries } from './Match';
import { sortGroupTable, initializeKnockouts } from "../utils/tournamentRules";
import NewsFeed from './NewsFeed';
import Fixtures from './Fixtures';
import { generateInitialNews } from '../utils/newsGenerator';

// Reuse our TeamFlag component
const TeamFlag = ({ primaryColor, secondaryColor, size = 32 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const flagHeight = Math.round(size * 0.65);
  
  return (
    <svg 
      width={size} 
      height={flagHeight} 
      viewBox="0 0 100 65" 
      className="team-flag" 
      style={{ 
        borderRadius: '4px', 
        overflow: 'hidden', 
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
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

const calculateManagerPrestige = (profile) => {
  if (!profile) return 0;
  return Math.round(
    ((profile.seasons || 0) * 25) + 
    ((profile.leagueTitles || 0) * 100) + 
    ((profile.cupTitles || 0) * 120) + 
    ((profile.points || 0) * 0.5)
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

export default function TournamentDashboard() {
  const [tournamentState, setTournamentState] = useState(null);
  const [officeTab, setOfficeTab] = useState("home"); // "news" | "home" | "tactics" | "transfers" | "board" | "manager"
  const [activeTab, setActiveTab] = useState("standings"); // "standings" or "bracket"
  
  // Manager Profile States
  const [managerProfile, setManagerProfile] = useState({
    name: "Sir Alex",
    photo: null,
    seasons: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    gf: 0,
    ga: 0,
    leagueTitles: 0,
    cupTitles: 0,
    history: []
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState(null);
  const [showFormationModal, setShowFormationModal] = useState(false);

  const reloadTournamentState = () => {
    const raw = localStorage.getItem("retro_tournament_state");
    if (raw) {
      setTournamentState(JSON.parse(raw));
    }
  };

  const navigate = useNavigate();
  const location = useLocation();

  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsModalFixtures, setResultsModalFixtures] = useState([]);
  const [resultsModalTitle, setResultsModalTitle] = useState("");
  const [resultsModalTheme, setResultsModalTheme] = useState("#ffd700");

  useEffect(() => {
    if (location.state && location.state.showRoundResults) {
      const { fixtures, roundTitle, themeColor } = location.state;
      setResultsModalFixtures(fixtures || []);
      setResultsModalTitle(roundTitle || "ROUND RESULTS");
      setResultsModalTheme(themeColor || "#ffd700");
      setResultsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const raw = localStorage.getItem("retro_tournament_state");
    if (!raw) {
      navigate("/tournament");
      return;
    }
    const parsedState = JSON.parse(raw);

    // Seed initial news feed if empty or missing
    if (!parsedState.newsFeed || parsedState.newsFeed.length === 0) {
      const pTeam = parsedState.teams?.find(t => t.idnum === parsedState.playerTeamId);
      parsedState.newsFeed = generateInitialNews({
        teamName: pTeam ? pTeam.name : "National Team",
        managerName: parsedState.managerName || "Sir Alex",
        expectation: parsedState.boardExpectation,
        budget: 0,
        season: parsedState.cupName || "Tournament"
      });
      localStorage.setItem("retro_tournament_state", JSON.stringify(parsedState));
    }

    setTournamentState(parsedState);

    // Sync or Seed Manager Profile
    const savedProfile = localStorage.getItem("retro_manager_profile");
    if (savedProfile) {
      const parsedProfile = JSON.parse(savedProfile);
      setManagerProfile(parsedProfile);
      setEditName(parsedProfile.name || parsedState.managerName || "Sir Alex");
    } else {
      const initialProfile = {
        name: parsedState.managerName || "Sir Alex",
        photo: null,
        seasons: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        gf: 0,
        ga: 0,
        leagueTitles: 0,
        cupTitles: 0,
        history: []
      };
      localStorage.setItem("retro_manager_profile", JSON.stringify(initialProfile));
      setManagerProfile(initialProfile);
      setEditName(initialProfile.name);
    }
  }, [navigate]);

  /* eslint-disable no-unused-vars */
  const handleOpenProfileModal = () => {
    setEditName(managerProfile.name || "Sir Alex");
    setEditPhoto(managerProfile.photo || null);
    setShowProfileModal(true);
  };

  const handleCancelProfile = () => {
    setEditName(managerProfile.name || "Sir Alex");
    setEditPhoto(managerProfile.photo || null);
    setShowProfileModal(false);
  };

  const handleSaveProfile = () => {
    const updated = {
      ...managerProfile,
      name: editName,
      photo: editPhoto
    };
    localStorage.setItem("retro_manager_profile", JSON.stringify(updated));
    setManagerProfile(updated);

    // Sync current active tournament's manager name
    if (tournamentState) {
      const stateCopy = { ...tournamentState, managerName: editName };
      localStorage.setItem("retro_tournament_state", JSON.stringify(stateCopy));
      setTournamentState(stateCopy);
    }
    setShowProfileModal(false);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target.result;
      setEditPhoto(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleExportSave = () => {
    try {
      const team = tournamentState.teams.find(t => t.idnum === tournamentState.playerTeamId);
      const teamName = team ? team.name : "";
      const season = tournamentState.cupId ? (tournamentState.cupId.match(/\d+/) ? tournamentState.cupId.match(/\d+/)[0] : "1995") : "1995";
      
      const rosterKey = teamName ? `retro_roster_${teamName}_${season}` : null;
      const lineupKey = teamName ? `retro_lineup_${teamName}_${season}` : null;
      
      const cachedRoster = rosterKey ? localStorage.getItem(rosterKey) : null;
      const cachedLineup = lineupKey ? localStorage.getItem(lineupKey) : null;

      // Gather all rosters and lineups for this team
      const rosters = {};
      const lineups = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && teamName) {
          if (key.startsWith(`retro_roster_${teamName}_`)) {
            try {
              rosters[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              console.error(e);
            }
          } else if (key.startsWith(`retro_lineup_${teamName}_`)) {
            try {
              lineups[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      const exportPayload = {
        tournamentState: tournamentState,
        managerProfile: managerProfile,
        formation: localStorage.getItem('retro_player_formation') || '4-4-2',
        rosterKey: rosterKey,
        rosterData: cachedRoster ? JSON.parse(cachedRoster) : null,
        lineupKey: lineupKey,
        lineupData: cachedLineup ? JSON.parse(cachedLineup) : null,
        rosters: rosters,
        lineups: lineups
      };

      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const safeStage = stage.toLowerCase();
      downloadAnchor.setAttribute("download", `retro_tournament_${cupId}_stage_${safeStage}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export save file: " + e.message);
    }
  };

  const handleImportSave = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        let stateData = null;
        let profileData = null;

        if (importedData.tournamentState) {
          stateData = importedData.tournamentState;
          profileData = importedData.managerProfile;
          
          // Import all rosters if present
          if (importedData.rosters) {
            Object.entries(importedData.rosters).forEach(([key, val]) => {
              if (val) {
                localStorage.setItem(key, JSON.stringify(val));
              }
            });
          } else if (importedData.rosterKey && importedData.rosterData) {
            localStorage.setItem(importedData.rosterKey, JSON.stringify(importedData.rosterData));
          }
          
          // Import all lineups if present
          if (importedData.lineups) {
            Object.entries(importedData.lineups).forEach(([key, val]) => {
              if (val) {
                localStorage.setItem(key, JSON.stringify(val));
              }
            });
          } else if (importedData.lineupKey && importedData.lineupData) {
            localStorage.setItem(importedData.lineupKey, JSON.stringify(importedData.lineupData));
          }
        } else if (importedData.cupId && importedData.stage && importedData.teams && importedData.fixtures) {
          stateData = importedData;
        } else {
          throw new Error("Invalid save file format. Missing core tournament parameters.");
        }

        if (importedData.formation) {
          localStorage.setItem('retro_player_formation', importedData.formation);
        }
        localStorage.setItem("retro_tournament_state", JSON.stringify(stateData));
        setTournamentState(stateData);

        if (profileData) {
          localStorage.setItem("retro_manager_profile", JSON.stringify(profileData));
          setManagerProfile(profileData);
          setEditName(profileData.name || stateData.managerName || "Sir Alex");
        }
        alert("Tournament save successfully imported! You can continue playing.");
      } catch (err) {
        alert("Error importing save file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!tournamentState) {
    return <div className="Match team-select-container"><div className="empty-kit-slot">...</div></div>;
  }

  const { cupId, cupName, isWorldCup, playerTeamId, stage, currentRound, teams, fixtures, knockoutState, managerName, boardExpectation } = tournamentState;
  const fanConfidence = tournamentState.fanConfidence !== undefined ? tournamentState.fanConfidence : 50;

  const finalManagerName = managerName || "Sir Alex";
  const finalExpectation = boardExpectation || { text: "Play Competitively", stage: "groups", desc: "Underdog" };

  const getPlayerCupResult = () => {
    if (cupId === "chi91" || cupId === "bra89") {
      const playerTeam = teams.find(t => t.idnum === playerTeamId);
      if (playerTeam && playerTeam.group === "Final") {
        const finalStandings = standings.filter(t => t.group === "Final");
        const sortedFinal = sortGroupTable(finalStandings);
        if (sortedFinal[0] && sortedFinal[0].idnum === playerTeamId && stage === "over") {
          return "winner";
        }
        return "semiFinals";
      }
      return "groups";
    }

    if (stage === "groups") {
      return "groups";
    }

    const madeR32 = knockoutState.roundOf32?.some(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    const madeR16 = knockoutState.roundOf16?.some(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    const madeQF = knockoutState.quarterFinals?.some(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    const madeSF = knockoutState.semiFinals?.some(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    const madeFinal = knockoutState.final?.some(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    
    let wonCup = false;
    if (knockoutState.final && knockoutState.final[0] && knockoutState.final[0].played) {
      const f = knockoutState.final[0];
      const playerIsHome = f.homeId === playerTeamId;
      const playerWon = (playerIsHome && f.homeScore > f.awayScore) || (!playerIsHome && f.awayScore > f.homeScore);
      if (playerWon) wonCup = true;
    }

    if (wonCup) return "winner";
    if (madeFinal) return "final";
    if (madeSF) return "semiFinals";
    if (madeQF) return "quarterFinals";
    if (madeR16) return "roundOf16";
    if (madeR32) return "roundOf32";
    return "groups";
  };

  const getTournamentBoardVerdict = (result, expectation) => {
    if (result === "winner") {
      return {
        status: "CHAMPIONS",
        title: "TOURNAMENT CHAMPIONS! 🏆",
        color: "#ffd700",
        verdict: `Congratulations, Manager ${finalManagerName}! You have guided ${playerTeamObj.name} to historical glory by winning the tournament! The nation celebrates your triumph!`
      };
    } else {
      let stageName = "Group Stage";
      if ((cupId === "chi91" || cupId === "bra89") && result === "semiFinals") stageName = "the Final Round";
      else if (result === "final") stageName = "the Grand Final";
      else if (result === "thirdPlace") stageName = "the Third-Place Match";
      else if (result === "semiFinals") stageName = "the Semi-finals";
      else if (result === "quarterFinals") stageName = "the Quarter-finals";
      else if (result === "roundOf16") stageName = "the Round of 16";
      else if (result === "roundOf32") stageName = "the Round of 32";

      return {
        status: "ELIMINATED",
        title: "TOURNAMENT RUN ENDED ❌",
        color: "#ff4500",
        verdict: `Manager ${finalManagerName}, your tournament run has come to an end. ${playerTeamObj.name} was eliminated in ${stageName}.`
      };
    }
  };

  const playerTeamObj = teams.find(t => t.idnum === playerTeamId);

  const activeFormation = getSavedFormation();
  const playerTacticalFocus = (() => {
    if (!playerTeamObj) return "Balanced Style";
    const att = playerTeamObj.attack;
    const mid = playerTeamObj.midfield;
    const def = playerTeamObj.defense;
    if (att > mid && att > def) return "⚔️ Attacking Style";
    if (mid > att && mid > def) return "🧠 Midfield Control Style";
    if (def > att && def > mid) return "🛡️ Defensive Style";
    return "⚖️ Balanced Style";
  })();

  // Recalculate group tables
  const standings = teams.map(t => {
    const teamFixtures = [];
    if (stage === "finalGroup" || ((cupId === "chi91" || cupId === "bra89") && stage === "over")) {
      if (knockoutState.finalGroup) {
        knockoutState.finalGroup.forEach(rFixtures => {
          rFixtures.forEach(f => {
            if (f.played && (f.homeId === t.idnum || f.awayId === t.idnum)) {
              teamFixtures.push(f);
            }
          });
        });
      }
    } else {
      fixtures.forEach(rFixtures => {
        rFixtures.forEach(f => {
          if (f.played && (f.homeId === t.idnum || f.awayId === t.idnum)) {
            teamFixtures.push(f);
          }
        });
      });
    }

    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0;
    teamFixtures.forEach(f => {
      played += 1;
      const isHome = f.homeId === t.idnum;
      const myScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      gf += myScore;
      ga += oppScore;
      if (myScore > oppScore) {
        won += 1;
        points += 3;
      } else if (myScore < oppScore) {
        lost += 1;
      } else {
        drawn += 1;
        points += 1;
      }
    });

    return { ...t, played, won, drawn, lost, gf, ga, points };
  });

  // Calculate 3rd placed wildcards (for World Cup and Copa America)
  const getThirdPlacedWildcards = () => {
    const groups = (isWorldCup && teams.length === 48)
      ? ['A','B','C','D','E','F','G','H','I','J','K','L']
      : ((isWorldCup && teams.length === 24) ? ['A','B','C','D','E','F'] : (teams.length === 12 ? ['A','B','C'] : []));
    const thirds = [];
    groups.forEach(g => {
      const gTeams = standings.filter(t => t.group === g);
      const sorted = sortGroupTable(gTeams);
      if (sorted && sorted[2]) {
        thirds.push(sorted[2]); // 3rd team
      }
    });
    // Sort thirds
    return sortedStandings(thirds);
  };

  const sortedStandings = (list) => {
    return [...list].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  };

  const thirdPlacedWildcards = ((isWorldCup && (teams.length === 24 || teams.length === 48)) || teams.length === 12) ? getThirdPlacedWildcards() : [];
  const top4ThirdPlacedIds = (isWorldCup && teams.length === 48)
    ? thirdPlacedWildcards.slice(0, 8).map(t => t.idnum)
    : ((isWorldCup && teams.length === 24) 
      ? thirdPlacedWildcards.slice(0, 4).map(t => t.idnum) 
      : (teams.length === 12 ? thirdPlacedWildcards.slice(0, 2).map(t => t.idnum) : []));

  // Group letters for standings grid
  const groupLetters = (stage === "finalGroup" || ((cupId === "chi91" || cupId === "bra89") && stage === "over"))
    ? ['Final']
    : ((isWorldCup && teams.length === 48)
      ? ['A','B','C','D','E','F','G','H','I','J','K','L']
      : ((isWorldCup && teams.length === 32)
        ? ['A','B','C','D','E','F','G','H']
        : (isWorldCup ? ['A','B','C','D','E','F'] : (teams.length === 16 ? ['A','B','C','D'] : (teams.length === 12 ? ['A','B','C'] : ['A','B'])))));

  // Check if player is still in the tournament
  const isPlayerEliminated = () => {
    if (stage === "groups") {
      return false; // Groups still running
    }
    if (stage === "finalGroup" || ((cupId === "chi91" || cupId === "bra89") && stage === "over")) {
      const playerTeam = teams.find(t => t.idnum === playerTeamId);
      return playerTeam ? playerTeam.group !== 'Final' : true;
    }
    // Check if player's team is in the current knockout stage matches
    const activeKnockoutStage = knockoutState[stage];
    if (!activeKnockoutStage) return true;
    return !activeKnockoutStage.some(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
  };

  const eliminated = isPlayerEliminated();

  const getTournamentBoardConfidence = () => {
    if (!tournamentState) return 100;
    
    const targetStage = finalExpectation.stage || "groups";
    const stageOrder = { "groups": 1, "roundOf32": 1.5, "roundOf16": 2, "quarterFinals": 3, "semiFinals": 4, "final": 5, "winner": 6 };
    const currentRank = stageOrder[stage] || 1;
    const targetRank = stageOrder[targetStage] || 1;
    
    if (eliminated) {
      const playerResult = getPlayerCupResult();
      const resultRank = stageOrder[playerResult] || 1;
      const diff = targetRank - resultRank;
      
      if (diff <= 0) {
        return Math.min(100, 85 + Math.abs(diff) * 5);
      } else if (diff === 1) {
        return 60;
      } else {
        return Math.max(10, 45 - (diff - 2) * 15);
      }
    } else {
      const diff = targetRank - currentRank;
      if (diff <= 0) {
        return 95;
      } else if (diff === 1) {
        return 80;
      } else if (diff === 2) {
        return 70;
      } else {
        return Math.max(40, 75 - diff * 10);
      }
    }
  };

  // Find Player's Next Match
  let nextFixture = null;
  let isHome = true;
  let opponentObj = null;

  if (stage === "groups") {
    const roundFixtures = fixtures[currentRound - 1];
    nextFixture = roundFixtures.find(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    if (nextFixture) {
      isHome = nextFixture.homeId === playerTeamId;
      opponentObj = standings.find(t => t.idnum === (isHome ? nextFixture.awayId : nextFixture.homeId));
    }
  } else if (stage === "finalGroup") {
    const roundFixtures = knockoutState.finalGroup ? knockoutState.finalGroup[currentRound - 1] : [];
    nextFixture = roundFixtures.find(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
    if (nextFixture) {
      isHome = nextFixture.homeId === playerTeamId;
      opponentObj = standings.find(t => t.idnum === (isHome ? nextFixture.awayId : nextFixture.homeId));
    }
  } else {
    const activeKnockoutStage = knockoutState[stage];
    if (activeKnockoutStage) {
      nextFixture = activeKnockoutStage.find(f => (f.homeId === playerTeamId || f.awayId === playerTeamId) && !f.played);
      if (nextFixture) {
        isHome = nextFixture.homeId === playerTeamId;
        opponentObj = standings.find(t => t.idnum === (isHome ? nextFixture.awayId : nextFixture.homeId));
      }
    }
  }

  // Handle Kick-off
  const handleKickOff = () => {
    if (eliminated) {
      handleSimulateKnockoutRound();
      return;
    }
    navigate("/pre-match?tournament");
  };

  // Simulate remaining group matches for the round
  const handleSimulateGroupRound = () => {
    let stateCopy = { ...tournamentState };
    const roundFixtures = stage === "finalGroup"
      ? stateCopy.knockoutState.finalGroup[currentRound - 1]
      : stateCopy.fixtures[currentRound - 1];

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
    if (stage === "finalGroup") {
      if (currentRound < 3) {
        stateCopy.currentRound += 1;
      } else {
        stateCopy.stage = "over";
      }
    } else {
      if (currentRound < fixtures.length) {
        stateCopy.currentRound += 1;
      } else {
        // Transition to Knockout Stage!
        initializeKnockouts(stateCopy);
      }
    }

    localStorage.setItem("retro_tournament_state", JSON.stringify(stateCopy));

    // Now run player condition/injury updates & team stat recalculations for Tournament
    if (playerTeamObj && playerTeamObj.name) {
      const season = stateCopy.cupId ? (stateCopy.cupId.match(/\d+/) ? stateCopy.cupId.match(/\d+/)[0] : "1995") : "1995";
      updatePlayerConditionsAndInjuries(playerTeamObj.name, season, true, true);
      const cachedLineup = localStorage.getItem(`retro_lineup_${playerTeamObj.name}_${season}`);
      if (cachedLineup) {
        try {
          const parsedLineup = JSON.parse(cachedLineup);
          updateTeamStatsInStorage(parsedLineup, getSavedFormation());
          // Refresh stateCopy from storage
          const refreshedRaw = localStorage.getItem("retro_tournament_state");
          if (refreshedRaw) {
            stateCopy = JSON.parse(refreshedRaw);
          }
        } catch (e) {
          console.error("Error updating team stats after tournament simulation", e);
        }
      }
    }

    setTournamentState(stateCopy);

    setResultsModalFixtures(roundFixtures);
    setResultsModalTitle(stage === "finalGroup" ? `FINAL ROUND - ROUND ${currentRound}` : `GROUP STAGE - ROUND ${currentRound}`);
    setResultsModalTheme("#ffd700");
    setResultsModalOpen(true);
  };



  // Simulate knockout stage round (runs if player is eliminated)
  const handleSimulateKnockoutRound = () => {
    let stateCopy = { ...tournamentState };
    const roundMatches = stateCopy.knockoutState[stage];
    if (!roundMatches) {
      stateCopy.stage = "over";
      localStorage.setItem("retro_tournament_state", JSON.stringify(stateCopy));
      setTournamentState(stateCopy);
      return;
    }

    roundMatches.forEach(f => {
      if (!f.played) {
        const h = stateCopy.teams.find(t => t.idnum === f.homeId);
        const a = stateCopy.teams.find(t => t.idnum === f.awayId);
        const { homeGoals, awayGoals } = simulateFixture(h, a);

        // Knockout draws resolve with penalties
        let penHome = 0, penAway = 0;
        if (homeGoals === awayGoals) {
          if (Math.random() > 0.5) {
            penHome = 5; penAway = 4;
          } else {
            penHome = 4; penAway = 5;
          }
        }

        f.homeScore = homeGoals;
        f.awayScore = awayGoals;
        f.penaltyHomeScore = penHome;
        f.penaltyAwayScore = penAway;
        f.played = true;
      }
    });

    advanceKnockoutRound(stateCopy);

    // Run player condition recovery (didPlay = false) since player is eliminated
    if (playerTeamObj && playerTeamObj.name) {
      const season = stateCopy.cupId ? (stateCopy.cupId.match(/\d+/) ? stateCopy.cupId.match(/\d+/)[0] : "1995") : "1995";
      updatePlayerConditionsAndInjuries(playerTeamObj.name, season, true, false);
      const cachedLineup = localStorage.getItem(`retro_lineup_${playerTeamObj.name}_${season}`);
      if (cachedLineup) {
        try {
          const parsedLineup = JSON.parse(cachedLineup);
          updateTeamStatsInStorage(parsedLineup, getSavedFormation());
          // Refresh stateCopy from storage
          const refreshedRaw = localStorage.getItem("retro_tournament_state");
          if (refreshedRaw) {
            stateCopy = JSON.parse(refreshedRaw);
          }
        } catch (e) {
          console.error("Error updating team stats after tournament knockout simulation", e);
        }
      }
    }

    setTournamentState(stateCopy);

    setResultsModalFixtures(roundMatches);
    setResultsModalTitle(`${stage.replace(/([A-Z])/g, ' $1').toUpperCase()} RESULTS`);
    setResultsModalTheme("#ffd700");
    setResultsModalOpen(true);
  };

  // Advancing Knockout Tiers
  const advanceKnockoutRound = (stateCopy) => {
    const completedMatches = stateCopy.knockoutState[stage];
    
    // Helper to extract winner index
    const getWinnerId = (m) => {
      if (m.homeScore > m.awayScore) return m.homeId;
      if (m.awayScore > m.homeScore) return m.awayId;
      return m.penaltyHomeScore > m.penaltyAwayScore ? m.homeId : m.awayId;
    };

    if (stage === "roundOf32") {
      // 16 Matches ➔ Build Round of 16 (8 Matches)
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
    } else if (stage === "roundOf16") {
      // 8 Matches ➔ Build Quarters (4 Matches)
      const quarterFinals = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
        { homeId: getWinnerId(completedMatches[2]), awayId: getWinnerId(completedMatches[3]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
        { homeId: getWinnerId(completedMatches[4]), awayId: getWinnerId(completedMatches[5]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
        { homeId: getWinnerId(completedMatches[6]), awayId: getWinnerId(completedMatches[7]), played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" }
      ];
      stateCopy.knockoutState.quarterFinals = quarterFinals;
      stateCopy.stage = "quarterFinals";
    } else if (stage === "quarterFinals") {
      // 4 Matches ➔ Build Semis (2 Matches)
      const semiFinals = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Semi-finals" },
        { homeId: getWinnerId(completedMatches[2]), awayId: getWinnerId(completedMatches[3]), played: false, homeScore: 0, awayScore: 0, stageName: "Semi-finals" }
      ];
      stateCopy.knockoutState.semiFinals = semiFinals;
      stateCopy.stage = "semiFinals";
    } else if (stage === "semiFinals") {
      // 2 Matches ➔ Build Third-Place and Final
      const getLoserId = (m) => {
        const winner = getWinnerId(m);
        return m.homeId === winner ? m.awayId : m.homeId;
      };

      // World Cup / Copa America has Third Place play-off
      if (isWorldCup || stateCopy.teams.length === 12 || stateCopy.teams.length === 10) {
        stateCopy.knockoutState.thirdPlace = [
          { homeId: getLoserId(completedMatches[0]), awayId: getLoserId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Third-Place Match" }
        ];
      }
      
      stateCopy.knockoutState.final = [
        { homeId: getWinnerId(completedMatches[0]), awayId: getWinnerId(completedMatches[1]), played: false, homeScore: 0, awayScore: 0, stageName: "Grand Final" }
      ];
      
      stateCopy.stage = (isWorldCup || stateCopy.teams.length === 12 || stateCopy.teams.length === 10) ? "thirdPlace" : "final";
    } else if (stage === "thirdPlace") {
      // Advance to final match
      stateCopy.stage = "final";
    } else if (stage === "final") {
      // Over
      stateCopy.stage = "over";
    }

    localStorage.setItem("retro_tournament_state", JSON.stringify(stateCopy));
    setTournamentState(stateCopy);
  };

  const handleResetTournament = () => {
    if (window.confirm("Are you sure you want to end this tournament campaign and return to the selector menu?")) {
      localStorage.removeItem("retro_tournament_state");
      navigate("/tournament");
    }
  };

  const handleMarkNewsRead = (newsId) => {
    if (!tournamentState || !tournamentState.newsFeed) return;
    const updatedNewsFeed = tournamentState.newsFeed.map(item =>
      item.id === newsId ? { ...item, isRead: true } : item
    );
    const updatedState = { ...tournamentState, newsFeed: updatedNewsFeed };
    setTournamentState(updatedState);
    localStorage.setItem("retro_tournament_state", JSON.stringify(updatedState));
  };

  const handleMarkAllNewsRead = () => {
    if (!tournamentState || !tournamentState.newsFeed) return;
    const updatedNewsFeed = tournamentState.newsFeed.map(item => ({ ...item, isRead: true }));
    const updatedState = { ...tournamentState, newsFeed: updatedNewsFeed };
    setTournamentState(updatedState);
    localStorage.setItem("retro_tournament_state", JSON.stringify(updatedState));
  };

  return (
    <div className="Match team-select-container league-dashboard-arena">
      <div className="matchheader selector-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1100px' }}>
        <div>
          <h1 className="glowing-header-text" style={{ textAlign: 'left', fontSize: '32px' }}>INTERNATIONAL CUPS HUB</h1>
          <p className="lobby-subtitle" style={{ textAlign: 'left' }}>{cupName}</p>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleExportSave}
              className="glowing-btn"
              style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#00ff64', color: '#00ff64', background: 'rgba(0, 255, 100, 0.05)' }}
              title="Export tournament save to a JSON file"
            >
              💾 EXPORT SAVE
            </button>
            <button 
              onClick={() => document.getElementById("import-tourney-save-input").click()}
              className="glowing-btn"
              style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#ffc107', color: '#ffc107', background: 'rgba(255, 193, 7, 0.05)' }}
              title="Import tournament save from a JSON file"
            >
              📂 IMPORT SAVE
            </button>
            <input 
              type="file" 
              id="import-tourney-save-input" 
              accept=".json" 
              style={{ display: 'none' }} 
              onChange={handleImportSave}
            />
          </div>

          <button className={`glowing-btn ${activeTab === 'standings' ? 'active-tab-btn' : ''}`} style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setActiveTab('standings')}>
            STANDINGS & GROUPS
          </button>
          {cupId !== "chi91" && cupId !== "bra89" && (
            <button className={`glowing-btn ${activeTab === 'bracket' ? 'active-tab-btn' : ''}`} style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setActiveTab('bracket')}>
              KNOCKOUT TREE
            </button>
          )}
        </div>
      </div>

      {/* Office Navigation Tabs */}
      <div className="office-tabs-bar" style={{
        display: 'flex',
        justify: 'center',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(15, 18, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '6px 10px',
        margin: '15px auto 20px auto',
        maxWidth: '1100px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        flexWrap: 'wrap'
      }}>
        {[
          {
            id: 'news',
            label: (() => {
              const unread = (tournamentState?.newsFeed || []).filter(i => !i.isRead).length;
              return unread > 0 ? `📰 NEWS (${unread})` : '📰 NEWS';
            })(),
            color: '#00e5ff'
          },
          { id: 'home', label: '🏠 HOME', color: '#00ff64' },
          { id: 'tactics', label: '📋 FORMATIONS & TACTICS', color: '#ffd700' },
          { id: 'matches', label: '⚽ MATCHES', color: '#00e5ff' },
          { id: 'transfers', label: '🔄 TRANSFERS', color: '#ff4500' },
          { id: 'board', label: '📊 BOARD', color: '#e040fb' },
          { id: 'manager', label: '👔 MANAGER', color: '#00e676' }
        ].map(tab => {
          const isActive = officeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setOfficeTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '11.5px',
                fontWeight: 'bold',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '1px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                border: isActive ? `1px solid ${tab.color}` : '1px solid rgba(255, 255, 255, 0.05)',
                background: isActive ? `${tab.color}15` : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? tab.color : '#8888aa',
                boxShadow: isActive ? `0 0 15px ${tab.color}33` : 'none',
                outline: 'none'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {officeTab === "news" && (
        <NewsFeed
          newsItems={tournamentState?.newsFeed || []}
          onSelectTab={(tabId) => setOfficeTab(tabId)}
          onMarkRead={handleMarkNewsRead}
          onMarkAllRead={handleMarkAllNewsRead}
        />
      )}

      {officeTab === "tactics" && (
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <FormationTacticsModal
            isOpen={true}
            inline={true}
            mode="tournament"
            onClose={reloadTournamentState}
          />
        </div>
      )}

      {officeTab === "matches" && (
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <Fixtures inline={true} mode="tournament" />
        </div>
      )}

      {officeTab === "transfers" && (
        <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#ff4500', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
              🔄 NATIONAL SQUAD ROSTER HUB
            </h2>
            <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {cupName} | Roster Overview
            </span>
          </div>

          <div style={{ background: 'rgba(255, 69, 0, 0.05)', border: '1px dashed rgba(255, 69, 0, 0.3)', borderRadius: '10px', padding: '15px', textAlign: 'center', color: '#ffaa88' }}>
            <div style={{ fontSize: '30px', marginBottom: '6px' }}>🌐</div>
            <h4 style={{ margin: '0 0 6px 0', fontFamily: 'Orbitron', color: '#ffea00' }}>NATIONAL TEAM SQUAD RULES</h4>
            <p style={{ fontSize: '12px', margin: 0, color: '#ccc', lineHeight: '1.5' }}>
              Club transfer market transactions do not apply during international tournament competition. You are managing the selected 23-player national team roster for <strong>{playerTeamObj ? playerTeamObj.name : "National Team"}</strong>.
            </p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', color: '#00ff64', margin: '0 0 12px 0', fontFamily: 'Orbitron' }}>
              ⚽ SQUAD RATING & ATTRIBUTES
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px' }}>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block' }}>ATTACK RATING</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4500', fontFamily: 'Orbitron', marginTop: '4px', display: 'block' }}>
                  ★ {playerTeamObj ? playerTeamObj.attack : 3}/5
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px' }}>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block' }}>MIDFIELD RATING</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ff64', fontFamily: 'Orbitron', marginTop: '4px', display: 'block' }}>
                  ★ {playerTeamObj ? playerTeamObj.midfield : 3}/5
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '10px' }}>
                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', display: 'block' }}>DEFENSE RATING</span>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron', marginTop: '4px', display: 'block' }}>
                  ★ {playerTeamObj ? playerTeamObj.defense : 3}/5
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {officeTab === "board" && (
        <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#e040fb', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
              📊 FOOTBALL FEDERATION DIRECTORS DESK
            </h2>
            <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {cupName} | Campaign Evaluation
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(224, 64, 251, 0.25)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#e040fb', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                  🏛️ FEDERATION SATISFACTION
                </span>
                {(() => {
                  const conf = getTournamentBoardConfidence();
                  return (
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px',
                      background: conf >= 70 ? 'rgba(0, 255, 100, 0.1)' : (conf >= 55 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 51, 81, 0.1)'),
                      color: conf >= 70 ? '#00ff64' : (conf >= 55 ? '#ffa500' : '#ff3333'),
                      fontWeight: 'bold', fontSize: '10px', fontFamily: 'Orbitron'
                    }}>
                      {conf >= 70 ? "EXCELLENT" : (conf >= 55 ? "GOOD" : "UNDERPERFORMING")}
                    </span>
                  );
                })()}
              </div>

              {(() => {
                const conf = getTournamentBoardConfidence();
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'Orbitron', color: conf >= 70 ? '#00ff64' : (conf >= 55 ? '#ffa500' : '#ff3333') }}>
                        {conf}%
                      </span>
                      <span style={{ fontSize: '11px', color: '#aaa' }}>approval rating</span>
                    </div>

                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${conf}%`, height: '100%',
                        background: conf >= 70 ? '#00ff64' : (conf >= 55 ? '#ffa500' : '#ff3333'),
                        boxShadow: `0 0 10px ${conf >= 70 ? '#00ff64' : (conf >= 55 ? '#ffa500' : '#ff3333')}`,
                        transition: 'width 0.5s ease-in-out'
                      }} />
                    </div>
                  </>
                );
              })()}

              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Tournament Target:</span>
                  <span style={{ fontWeight: 'bold', color: '#00ff64' }}>{finalExpectation.text}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Current Stage:</span>
                  <span style={{ fontWeight: 'bold', color: '#ffd700' }}>{stage.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 255, 100, 0.2)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#00ff64', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                  📣 NATION SUPPORTERS MORALE
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px',
                  background: fanConfidence >= 75 ? 'rgba(0, 255, 100, 0.1)' : (fanConfidence >= 45 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 51, 81, 0.1)'),
                  color: fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333'),
                  fontWeight: 'bold', fontSize: '10px', fontFamily: 'Orbitron'
                }}>
                  {fanConfidence >= 75 ? "THRILLED" : (fanConfidence >= 45 ? "MIXED" : "MUTINOUS")}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'Orbitron', color: fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333') }}>
                  {fanConfidence}%
                </span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>nation fan morale</span>
              </div>

              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${fanConfidence}%`, height: '100%',
                  background: fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333'),
                  boxShadow: `0 0 10px ${fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333')}`,
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>

              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '11.5px', color: '#aaa', lineHeight: '1.4' }}>
                {fanConfidence >= 75
                  ? "Supporters across the country are ecstatic with national team performances!"
                  : (fanConfidence >= 45
                    ? "Supporters expect strong knockout qualification performances."
                    : "Supporters are demanding immediate tactical changes from the coaching staff.")}
              </div>
            </div>
          </div>

          {stage === "over" && (
            <div style={{ marginTop: '10px' }}>
              {(() => {
                const result = getPlayerCupResult();
                const verdict = getTournamentBoardVerdict(result, finalExpectation);
                return (
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: `2px solid ${verdict.color}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ color: verdict.color, fontSize: '18px', margin: 0, fontFamily: 'Orbitron' }}>
                      🏆 CAMPAIGN RESULT: {verdict.title}
                    </h3>
                    <p style={{ color: '#ccc', textAlign: 'center', fontSize: '12px', margin: 0 }}>
                      {verdict.verdict}
                    </p>
                    <button
                      className="play-match-btn glowing-btn"
                      style={{ fontSize: '12px', padding: '8px 20px', borderColor: verdict.color, color: verdict.color }}
                      onClick={handleResetTournament}
                    >
                      START NEW INTERNATIONAL CAMPAIGN
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {officeTab === "manager" && (
        <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '650px', margin: '0 auto', padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', border: '1.5px solid rgba(255, 215, 0, 0.25)', borderRadius: '16px' }}>
          <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#ffd700', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
            👔 MANAGER'S PERSONAL PROFILE
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '110px', height: '110px', borderRadius: '50%',
              border: '2.5px solid #00ff64', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)', boxShadow: '0 0 15px rgba(0,255,100,0.2)'
            }}>
              {editPhoto ? (
                <img src={editPhoto} alt="Manager Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '48px' }}>👔</span>
              )}
            </div>

            <label className="glowing-btn" style={{
              padding: '4px 12px', fontSize: '10px', cursor: 'pointer',
              borderColor: '#00ff64', color: '#00ff64', background: 'rgba(0, 255, 100, 0.05)',
              borderRadius: '4px', fontWeight: 'bold'
            }}>
              📷 UPLOAD PHOTO
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.25)',
            borderRadius: '10px', padding: '8px 15px', width: '90%', textAlign: 'center'
          }}>
            <span style={{ fontSize: '9px', color: '#ffd700', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Manager Reputation</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron', marginTop: '2px' }}>
              {calculateManagerPrestige(managerProfile)} PTS
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 'bold', marginTop: '2px',
              color: (() => {
                const p = calculateManagerPrestige(managerProfile);
                if (p < 50) return '#00ff64';
                if (p < 150) return '#00e5ff';
                if (p < 300) return '#a020f0';
                return '#ffd700';
              })()
            }}>
              {(() => {
                const p = calculateManagerPrestige(managerProfile);
                if (p < 50) return '🟢 LOCAL AMATEUR';
                if (p < 150) return '🔵 REGIONAL PROFESSIONAL';
                if (p < 300) return '🟣 ELITE COACH';
                return '🟡 LEGENDARY BOSS';
              })()}
            </span>
          </div>

          <div style={{ width: '90%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' }}>Edit Name</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,255,100,0.3)',
                  borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
                  outline: 'none', textAlign: 'center', fontWeight: 'bold'
                }}
                maxLength={20}
              />
              <button
                type="button"
                className="glowing-btn"
                style={{ padding: '8px 15px', fontSize: '11px', borderColor: '#ffd700', color: '#ffd700' }}
                onClick={handleSaveProfile}
              >
                SAVE
              </button>
            </div>
          </div>

          <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
            <h4 style={{ color: '#00e5ff', margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontFamily: 'Orbitron' }}>
              👔 CAREER LIFETIME STATISTICS
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron', display: 'block' }}>{managerProfile.seasons}</span>
                <span style={{ fontSize: '8.5px', color: '#888' }}>Seasons</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron', display: 'block' }}>{managerProfile.leagueTitles}</span>
                <span style={{ fontSize: '8.5px', color: '#888' }}>League 🏆</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron', display: 'block' }}>{managerProfile.cupTitles}</span>
                <span style={{ fontSize: '8.5px', color: '#888' }}>Cup ⭐</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00ff64', fontFamily: 'Orbitron', display: 'block' }}>{managerProfile.wins}</span>
                <span style={{ fontSize: '8.5px', color: '#888' }}>Wins</span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ color: '#ffd700', margin: '0 0 5px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontFamily: 'Orbitron' }}>
              📜 CAREER HISTORY
            </h4>
            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              {(!managerProfile.history || managerProfile.history.length === 0) ? (
                <span style={{ fontSize: '10px', color: '#666', textAlign: 'center', display: 'block', fontStyle: 'italic', padding: '10px 0' }}>
                  No history recorded yet. Complete seasons to build your legacy!
                </span>
              ) : (
                [...managerProfile.history].reverse().map((h, index) => (
                  <div key={index} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', fontSize: '10.5px', color: '#ccc', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span style={{ color: '#00e5ff' }}>📅 {h.season} - {h.team}</span>
                      <span style={{ display: 'flex', gap: '3px' }}>
                        {h.leagueTitle > 0 && <span title="League Champion" style={{ color: '#ffd700' }}>🏆</span>}
                        {h.cupTitle > 0 && <span title="Cup Winner" style={{ color: '#00ff64' }}>⭐</span>}
                      </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#aaa' }}>
                      Matches: <strong style={{ color: '#fff' }}>{h.played}</strong> | W: <strong style={{ color: '#00ff64' }}>{h.won}</strong> | D: <strong style={{ color: '#ffd700' }}>{h.drawn}</strong> | L: <strong style={{ color: '#ff3333' }}>{h.lost}</strong> | Pts: <strong style={{ color: '#00e5ff' }}>{h.points}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {officeTab === "home" && (
        <div className="match-arena-layout" style={{ maxWidth: '1100px' }}>
        
        {/* Left Side: Tables / Bracket */}
        <div className="glass-card standings-table-card" style={{ 
          width: '58%', 
          flexGrow: 1, 
          padding: '20px',
          height: '490px',
          overflowY: 'auto'
        }}>
          
          {activeTab === "standings" && (
            <div className="animated-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <h3 className="team-card-title" style={{ textAlign: 'left', color: '#ffd700', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                GROUP STANDINGS TABLES
              </h3>
              
              {groupLetters.map(gLetter => {
                const gTeams = standings.filter(t => t.group === gLetter);
                const sorted = sortGroupTable(gTeams);
                
                return (
                  <div key={gLetter} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#ffd700', fontFamily: 'Orbitron', fontSize: '12px' }}>
                      {gLetter === 'Final' ? "FINAL ROUND STANDINGS" : `GROUP ${gLetter}`}
                    </h4>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ color: '#888', textTransform: 'uppercase', fontSize: '9px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <th style={{ padding: '6px 4px', textAlign: 'left' }}>Pos</th>
                          <th style={{ padding: '6px 4px', textAlign: 'left' }}>Team</th>
                          <th style={{ padding: '6px 4px' }}>P</th>
                          <th style={{ padding: '6px 4px' }}>W</th>
                          <th style={{ padding: '6px 4px' }}>D</th>
                          <th style={{ padding: '6px 4px' }}>L</th>
                          <th style={{ padding: '6px 4px' }}>GD</th>
                          <th style={{ padding: '6px 4px', color: '#ffd700' }}>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((team, idx) => {
                          const isPlayer = team.idnum === playerTeamId;
                          const advancesDirect = gLetter === 'Final' ? (idx === 0) : (idx < 2);
                          return (
                            <tr key={team.idnum} style={{ background: isPlayer ? 'rgba(0, 255, 100, 0.04)' : 'transparent', color: isPlayer ? '#00ff64' : '#fff' }}>
                              <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={24} />
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '130px' }} title={team.name}>
                                  {team.name} {isPlayer && " (You)"}
                                </span>
                                {advancesDirect && (gLetter === 'Final' ? <span style={{ color: '#ffd700', fontSize: '11px', fontWeight: 'bold' }} title="Champion Candidate">👑</span> : <span style={{ color: '#00ff64', fontSize: '9px', fontWeight: 'bold' }}>✓</span>)}
                              </td>
                              <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.played}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.won}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.drawn}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.lost}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.gf - team.ga}</td>
                              <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 'bold', color: isPlayer ? '#00ff64' : '#ffd700' }}>{team.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Wildcard Third-Placed rank view (World Cup or Copa America) */}
              {((isWorldCup && (teams.length === 24 || teams.length === 48)) || teams.length === 12) && (
                <div style={{ background: 'rgba(255,215,0,0.02)', padding: '15px', borderRadius: '10px', border: '1.5px dashed rgba(255,215,0,0.1)' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#ffd700', fontFamily: 'Orbitron', fontSize: '12px' }}>
                    WILDCARD: THIRD-PLACED COMPARISON ({teams.length === 48 ? "TOP 8 ADVANCE" : (isWorldCup ? "TOP 4 ADVANCE" : "TOP 2 ADVANCE")})
                  </h4>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ color: '#888', textTransform: 'uppercase', fontSize: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <th style={{ padding: '6px 4px', textAlign: 'left' }}>Rank</th>
                        <th style={{ padding: '6px 4px', textAlign: 'left' }}>Team (Group)</th>
                        <th style={{ padding: '6px 4px' }}>P</th>
                        <th style={{ padding: '6px 4px' }}>W</th>
                        <th style={{ padding: '6px 4px' }}>D</th>
                        <th style={{ padding: '6px 4px' }}>L</th>
                        <th style={{ padding: '6px 4px' }}>GD</th>
                        <th style={{ padding: '6px 4px', color: '#ffd700' }}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {thirdPlacedWildcards.map((team, idx) => {
                        const isPlayer = team.idnum === playerTeamId;
                        const qualifies = top4ThirdPlacedIds.includes(team.idnum);
                        return (
                          <tr key={team.idnum} style={{ background: qualifies ? 'rgba(0, 255, 100, 0.02)' : 'transparent', color: qualifies ? '#fff' : '#888', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '6px 4px', fontWeight: 'bold', color: qualifies ? '#00ff64' : '#ff4500' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={20} />
                              <span>{team.name} (Gr {team.group}) {isPlayer && " (You)"}</span>
                              {qualifies && <span style={{ color: '#00ff64', fontSize: '9px', fontWeight: 'bold' }}>✓ Adv</span>}
                            </td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{team.played}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{team.won}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{team.drawn}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{team.lost}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center' }}>{team.gf - team.ga}</td>
                            <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', color: qualifies ? '#00ff64' : '#ffd700' }}>{team.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "bracket" && (
            <div className="animated-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <h3 className="team-card-title" style={{ textAlign: 'left', color: '#ffd700', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                KNOCKOUT BRACKET STAGES
              </h3>
              
              {stage === "groups" ? (
                <div style={{ flexGrow: 1, minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '13px', textAlign: 'center' }}>
                  Knockout brackets will dynamically unlock and populate after completing Group Matchday Round 3!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Render Bracket Tiers */}
                  {Object.keys(knockoutState).map(tierKey => {
                    const tierMatches = knockoutState[tierKey];
                    if (!tierMatches) return null;
                    
                    let tierLabel = "ROUND OF 16";
                    if (tierKey === "roundOf32") tierLabel = "ROUND OF 32";
                    else if (tierKey === "quarterFinals") tierLabel = "QUARTER-FINALS";
                    else if (tierKey === "semiFinals") tierLabel = "SEMI-FINALS";
                    else if (tierKey === "thirdPlace") tierLabel = "THIRD-PLACE PLAY-OFF";
                    else if (tierKey === "final") tierLabel = "GRAND FINAL";

                    return (
                      <div key={tierKey} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#ffd700', fontFamily: 'Orbitron', fontSize: '11px', letterSpacing: '1px' }}>
                          {tierLabel}
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {tierMatches.map((m, mIdx) => {
                            const hT = teams.find(t => t.idnum === m.homeId);
                            const aT = teams.find(t => t.idnum === m.awayId);
                            const isPlayerMatch = m.homeId === playerTeamId || m.awayId === playerTeamId;
                            
                            return (
                              <div key={mIdx} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                padding: '8px 12px', 
                                background: isPlayerMatch ? 'rgba(0, 255, 100, 0.04)' : 'rgba(0,0,0,0.2)',
                                border: isPlayerMatch ? '1px dashed #00ff64' : '1px solid rgba(255,255,255,0.02)',
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}>
                                <span style={{ width: '40%', textAlign: 'left', fontWeight: isPlayerMatch ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <TeamFlag primaryColor={hT.primaryColor} secondaryColor={hT.secondaryColor} size={20} />
                                  <span>{hT.name}</span>
                                </span>
                                
                                <span style={{ fontWeight: 'bold', fontFamily: 'Orbitron', color: m.played ? '#00ff64' : '#ff4500' }}>
                                  {m.played ? (
                                    <>
                                      {m.homeScore} - {m.awayScore}
                                      {m.penaltyHomeScore > 0 && <span style={{ fontSize: '9px', color: '#ffd700', marginLeft: '4px' }}>({m.penaltyHomeScore}-{m.penaltyAwayScore} Pen)</span>}
                                    </>
                                  ) : "vs"}
                                </span>

                                <span style={{ width: '40%', textAlign: 'right', fontWeight: isPlayerMatch ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                  <span>{aT.name}</span>
                                  <TeamFlag primaryColor={aT.primaryColor} secondaryColor={aT.secondaryColor} size={20} />
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

        </div>

        {/* Right Side: Active Play Panel */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>
          
          {stage !== "over" ? (
            <div className="glass-card next-match-panel animated-slide-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              
              {eliminated ? (
                <>
                  <div style={{ fontSize: '32px' }}>📊</div>
                  <h3 className="team-card-title" style={{ color: '#ff4500' }}>ELIMINATED</h3>
                  <p style={{ fontSize: '12px', color: '#a3b3a7', textAlign: 'center', margin: '0', lineHeight: '1.4' }}>
                    {playerTeamObj.name} did not advance. However, you can still watch the tournament unfold by simulating the rest of the matches!
                  </p>
                  
                  <button 
                    className="match-control-btn kickoff-theme-btn glowing-btn pulse" 
                    style={{ width: '95%' }} 
                    onClick={stage === "finalGroup" ? handleSimulateGroupRound : handleSimulateKnockoutRound}
                  >
                    SIMULATE {stage === "finalGroup" ? `ROUND ${currentRound}` : stage.toUpperCase()} FIXTURES
                  </button>
                </>
              ) : (
                <>
                  <h3 className="team-card-title" style={{ color: '#00ff64' }}>
                    {stage === "groups" ? `GROUP MATCHDAY ${currentRound}` : (stage === "finalGroup" ? `FINAL ROUND MATCHDAY ${currentRound}` : `${stage.toUpperCase()} FIXTURE`)}
                  </h3>
                  
                  {nextFixture ? (
                    <>
                      <div className="versus-preview" style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center', margin: '10px 0' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '45%' }}>
                          <TeamFlag primaryColor={isHome ? playerTeamObj.primaryColor : opponentObj.primaryColor} secondaryColor={isHome ? playerTeamObj.secondaryColor : opponentObj.secondaryColor} size={65} />
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                            {isHome ? playerTeamObj.name : opponentObj.name}
                          </span>
                          <span style={{ fontSize: '9px', color: '#888' }}>{isHome ? "HOME" : "AWAY"}</span>
                        </div>
                        
                        <div style={{ fontFamily: 'Orbitron', fontWeight: 'bold', fontSize: '16px', color: '#ff4500' }}>VS</div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '45%' }}>
                          <TeamFlag primaryColor={isHome ? opponentObj.primaryColor : playerTeamObj.primaryColor} secondaryColor={isHome ? opponentObj.secondaryColor : playerTeamObj.secondaryColor} size={65} />
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                            {isHome ? opponentObj.name : playerTeamObj.name}
                          </span>
                          <span style={{ fontSize: '9px', color: '#888' }}>{isHome ? "AWAY" : "HOME"}</span>
                        </div>
                      </div>

                      <div className="stats-box" style={{ width: '95%', padding: '10px 15px', gap: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', margin: '0 auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', textAlign: 'center' }}>
                          <span style={{ textAlign: 'left', fontWeight: 'bold', color: '#fff' }}>{isHome ? playerTeamObj.attack : (opponentObj ? opponentObj.attack : 3)}</span>
                          <span style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>ATTACK</span>
                          <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>{isHome ? (opponentObj ? opponentObj.attack : 3) : playerTeamObj.attack}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', textAlign: 'center' }}>
                          <span style={{ textAlign: 'left', fontWeight: 'bold', color: '#fff' }}>{isHome ? playerTeamObj.midfield : (opponentObj ? opponentObj.midfield : 3)}</span>
                          <span style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>MIDFIELD</span>
                          <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>{isHome ? (opponentObj ? opponentObj.midfield : 3) : playerTeamObj.midfield}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', alignItems: 'center', textAlign: 'center' }}>
                          <span style={{ textAlign: 'left', fontWeight: 'bold', color: '#fff' }}>{isHome ? playerTeamObj.defense : (opponentObj ? opponentObj.defense : 3)}</span>
                          <span style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>DEFENSE</span>
                          <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>{isHome ? (opponentObj ? opponentObj.defense : 3) : playerTeamObj.defense}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', width: '100%', gap: '10px', justifyContent: 'center' }}>
                        <button className="match-control-btn kickoff-theme-btn glowing-btn pulse" style={{ width: '95%' }} onClick={handleKickOff}>
                          PLAY MATCH
                        </button>
                        {(stage === "groups" || stage === "finalGroup") && (
                          <button className="match-control-btn" style={{ width: '40%', fontSize: '11px' }} onClick={handleSimulateGroupRound}>
                            SIM ROUND
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ padding: '20px', color: '#ffc107', fontSize: '14px', fontWeight: 'bold', textAlign: 'center', background: 'rgba(255,193,7,0.05)', borderRadius: '8px', border: '1px dashed rgba(255,193,7,0.3)', width: '90%', margin: '15px 0' }}>
                        💤 BYE ROUND / REST WEEK<br/>
                        <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'normal', marginTop: '6px', display: 'inline-block' }}>
                          Your team does not have a match in this round. Simulate to proceed!
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                        {(stage === "groups" || stage === "finalGroup") && (
                          <button className="match-control-btn kickoff-theme-btn glowing-btn pulse" style={{ width: '95%' }} onClick={handleSimulateGroupRound}>
                            SIMULATE ROUND FIXTURES
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

            </div>
          ) : (
            (() => {
              const result = getPlayerCupResult();
              const verdict = getTournamentBoardVerdict(result, finalExpectation);
              return (
                <div className="glass-card season-over-panel animated-slide-in" style={{ padding: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', border: `2px solid ${verdict.color}`, boxShadow: `0 0 20px ${verdict.color}33` }}>
                  <div style={{ fontSize: '45px' }}>{result === "winner" ? "🏆" : "❌"}</div>
                  
                  <h3 className="team-card-title" style={{ color: verdict.color, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {verdict.title}
                  </h3>
                  
                  <div style={{ 
                    background: 'rgba(0,0,0,0.5)', 
                    border: `1px solid ${verdict.color}55`, 
                    borderRadius: '8px', 
                    padding: '15px', 
                    color: '#fff', 
                    fontSize: '13px', 
                    lineHeight: '1.5',
                    textAlign: 'center',
                    width: '90%'
                  }}>
                    {verdict.verdict}
                  </div>
 
                  <div className="stats-box" style={{ width: '90%', padding: '10px 15px', gap: '4px', fontSize: '12.5px', textAlign: 'center' }}>
                    <div>Final Summary for {finalManagerName}:</div>
                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px', marginTop: '3px' }}>
                      Furthest Stage Reached: {result.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      Campaign Target: {finalExpectation.text} ({finalExpectation.desc})
                    </div>
                  </div>

                  <button className="play-match-btn glowing-btn" style={{ fontSize: '13px', padding: '10px 20px', width: '95%', borderColor: verdict.color, color: verdict.color }} onClick={handleResetTournament}>
                    START NEW CAMPAIGN
                  </button>
                </div>
              );
            })()
          )}

          {/* Active Tactical Overview Panel */}
          {stage !== "over" && (
            <div className="glass-card next-match-panel" style={{ padding: '15px 20px', display: 'flex', flexDirection: 'column', gap: '8px', width: '95%', margin: '0 auto 20px auto' }}>
              <h3 className="team-card-title" style={{ fontSize: '13px', textAlign: 'left', color: '#00ff64', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>⚽ ACTIVE FORMATION & TACTICS</span>
                <button
                  onClick={() => setOfficeTab("tactics")}
                  style={{ background: 'transparent', border: '1px solid rgba(0, 255, 100, 0.3)', borderRadius: '4px', color: '#00ff64', cursor: 'pointer', fontSize: '10px', padding: '2px 8px', fontWeight: 'bold', fontFamily: 'Orbitron' }}
                >
                  EDIT TACTICS ➔
                </button>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888' }}>Active Formation:</span>
                  <span style={{ fontWeight: 'bold', color: '#00ff64', fontFamily: 'Orbitron' }}>
                    ⚽ {activeFormation}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888' }}>Squad Tactic Style:</span>
                  <span style={{ fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron' }}>
                    {playerTacticalFocus}
                  </span>
                </div>
                
                {/* Visual Pitch */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                  <FormationPitch formation={activeFormation} isSelected={false} size="small" />
                </div>
              </div>
            </div>
          )}

          {/* Group Matchday Round Feed */}
          {(stage === "groups" || stage === "finalGroup") && (
            <div className="glass-card fixtures-feed-panel" style={{ padding: '15px 20px', height: '210px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 className="team-card-title" style={{ fontSize: '12px', textAlign: 'left', color: '#888', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                {stage === "finalGroup" ? `FINAL ROUND - ROUND ${currentRound} SCHEDULE` : `MATCHDAY ROUND ${currentRound} SCHEDULE`}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1 }}>
                {(stage === "groups" ? fixtures[currentRound - 1] : knockoutState.finalGroup[currentRound - 1]).map((f, idx) => {
                  const hTeam = teams.find(t => t.idnum === f.homeId);
                  const aTeam = teams.find(t => t.idnum === f.awayId);
                  const isPlayerFixture = f.homeId === playerTeamId || f.awayId === playerTeamId;
                  
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        fontSize: '11px',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        background: isPlayerFixture ? 'rgba(0, 255, 100, 0.03)' : 'transparent',
                        border: isPlayerFixture ? '1px dashed rgba(0, 255, 100, 0.2)' : 'none',
                        color: isPlayerFixture ? '#00ff64' : '#fff'
                      }}
                    >
                      <span style={{ width: '40%', textAlign: 'left', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={hTeam.name}>{hTeam.name}</span>
                      
                      <span style={{ fontWeight: 'bold', fontFamily: 'Orbitron', color: f.played ? '#00ff64' : '#ff4500' }}>
                        {f.played ? `${f.homeScore} - ${f.awayScore}` : `vs (Gr ${f.group})`}
                      </span>
                      
                      <span style={{ width: '40%', textAlign: 'right', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={aTeam.name}>{aTeam.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button className="back-home-btn" onClick={handleResetTournament}>➔ ABANDON TOURNAMENT & CABINET</button>
      </div>

      {showProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          zIndex: 2000,
          padding: '20px 0',
          pointerEvents: 'auto'
        }}>
          <div className="glass-card animated-slide-in" style={{
            width: '90%',
            maxWidth: '450px',
            background: 'linear-gradient(135deg, rgba(22, 22, 28, 0.98), rgba(12, 12, 16, 0.99))',
            border: '2px solid rgba(255, 215, 0, 0.15)',
            borderRadius: '16px',
            padding: '25px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.7), 0 0 25px rgba(255,215,0,0.08)',
            margin: 'auto'
          }}>
            <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#ffd700', fontFamily: 'Orbitron', letterSpacing: '2px' }}>👔 MANAGER PROFILE</h2>

            {/* Manager Photo Upload & Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                border: '2.5px solid #00ff64',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)',
                position: 'relative',
                boxShadow: '0 0 15px rgba(0,255,100,0.2)'
              }}>
                {editPhoto ? (
                  <img src={editPhoto} alt="Manager Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '48px' }}>👔</span>
                )}
              </div>

              <label className="glowing-btn" style={{
                padding: '4px 10px',
                fontSize: '10px',
                cursor: 'pointer',
                borderColor: '#00ff64',
                color: '#00ff64',
                background: 'rgba(0, 255, 100, 0.05)',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}>
                📷 UPLOAD PHOTO
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Manager Reputation Badge */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,215,0,0.04)',
              border: '1px solid rgba(255,215,0,0.25)',
              borderRadius: '10px',
              padding: '8px 15px',
              width: '90%',
              textAlign: 'center',
              boxShadow: 'inset 0 0 10px rgba(255,215,0,0.05)'
            }}>
              <span style={{ fontSize: '9px', color: '#ffd700', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Manager Reputation</span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron', marginTop: '2px' }}>
                {calculateManagerPrestige(managerProfile)} PTS
              </span>
              <span style={{
                fontSize: '9.5px',
                color: (() => {
                  const p = calculateManagerPrestige(managerProfile);
                  if (p < 50) return '#00ff64'; // Local Amateur
                  if (p < 150) return '#00e5ff'; // Regional Pro
                  if (p < 300) return '#a020f0'; // Elite Coach
                  return '#ffd700'; // Legendary Boss
                })(),
                fontWeight: 'bold',
                marginTop: '2px'
              }}>
                {(() => {
                  const p = calculateManagerPrestige(managerProfile);
                  if (p < 50) return '🟢 LOCAL AMATEUR';
                  if (p < 150) return '🔵 REGIONAL PROFESSIONAL';
                  if (p < 300) return '🟣 ELITE COACH';
                  return '🟡 LEGENDARY BOSS';
                })()}
              </span>
            </div>

            {/* Name Editor Box */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>Edit Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(0,255,100,0.3)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  textAlign: 'center',
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold'
                }}
                maxLength={20}
              />
            </div>

            {/* Lifetime Statistics Feed */}
            <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
              <h4 style={{ color: '#00e5ff', margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>👔 CAREER LIFETIME STATISTICS</h4>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                fontSize: '11px',
                color: '#aaa',
                marginBottom: '10px'
              }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>{managerProfile.seasons}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Seasons Played</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron' }}>{managerProfile.leagueTitles}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>League Titles 🏆</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron' }}>{managerProfile.cupTitles}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Cup Titles ⭐</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>
                    {managerProfile.wins + managerProfile.draws + managerProfile.losses}
                  </span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Matches Played</span>
                </div>
              </div>

              {/* Match Stats Grid */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                background: 'rgba(0,0,0,0.4)',
                padding: '12px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                border: '1px solid rgba(255,255,255,0.03)',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#00ff64', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.wins}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Wins</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.draws}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Draws</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#ff3333', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.losses}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Losses</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.points}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Points</span>
                </div>
              </div>
            </div>

            {/* Year-by-Year Career History Feed */}
            <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ color: '#ffd700', margin: '0 0 5px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontFamily: 'Orbitron' }}>📜 CAREER HISTORY</h4>
              <div className="career-history-scroll" style={{
                maxHeight: '120px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
                width: '100%'
              }}>
                {(!managerProfile.history || managerProfile.history.length === 0) ? (
                  <span style={{ fontSize: '10px', color: '#666', textAlign: 'center', display: 'block', fontStyle: 'italic', padding: '10px 0' }}>
                    No history recorded yet. Complete seasons to build your legacy!
                  </span>
                ) : (
                  [...managerProfile.history].reverse().map((h, index) => (
                    <div key={index} style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '10.5px',
                      color: '#ccc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      textAlign: 'left'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span style={{ color: '#00e5ff' }}>📅 {h.season} - {h.team}</span>
                        <span style={{ display: 'flex', gap: '3px' }}>
                          {h.leagueTitle > 0 && <span title="League Champion" style={{ color: '#ffd700' }}>🏆</span>}
                          {h.cupTitle > 0 && <span title="Cup Winner" style={{ color: '#00ff64' }}>⭐</span>}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#aaa' }}>
                        Matches Played: <strong style={{ color: '#fff' }}>{h.played}</strong> | Won: <strong style={{ color: '#00ff64' }}>{h.won}</strong> | Draw: <strong style={{ color: '#ffd700' }}>{h.drawn}</strong> | Lost: <strong style={{ color: '#ff3333' }}>{h.lost}</strong> | Points: <strong style={{ color: '#00e5ff' }}>{h.points}</strong>
                      </div>
                      <div style={{ fontSize: '9px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Domestic League Title: <strong>{h.leagueTitle}</strong></span>
                        <span>Int'l / European Cup: <strong>{h.cupTitle}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              className="play-match-btn glowing-btn"
              style={{ width: '100%', marginTop: '5px', borderColor: '#ffd700', color: '#ffd700', padding: '10px 15px', fontSize: '13px' }}
              onClick={handleSaveProfile}
            >
              SAVE & CLOSE PROFILE
            </button>

            {/* Exit/Cancel Button */}
            <button
              type="button"
              className="play-match-btn"
              style={{
                width: '100%',
                marginTop: '10px',
                borderColor: '#ff4500',
                color: '#ff4500',
                background: 'transparent',
                padding: '10px 15px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={handleCancelProfile}
            >
              EXIT WITHOUT SAVING
            </button>
          </div>
        </div>
      )}

      <RoundResultsModal
        isOpen={resultsModalOpen}
        fixtures={resultsModalFixtures}
        teams={teams}
        playerTeamId={playerTeamId}
        roundTitle={resultsModalTitle}
        themeColor={resultsModalTheme}
        onClose={() => setResultsModalOpen(false)}
      />

      <FormationTacticsModal
        isOpen={showFormationModal}
        mode="tournament"
        onClose={() => {
          setShowFormationModal(false);
          reloadTournamentState();
        }}
      />
    </div>
  );
}
