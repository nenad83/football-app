import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../assets/styles/Match.css";
import CountryFlag from "./CountryFlag";

// Inline SVG Flag Component for teams
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
        borderRadius: "4px",
        overflow: "hidden",
        border: "1.2px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
        display: "inline-block",
        verticalAlign: "middle"
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

const getStageLabel = (stage, matchday) => {
  const stageLabelMap = {
    round_of_32: "Round of 32",
    playoffs: "Playoffs",
    round_of_16: "Round of 16",
    quarter_finals: "Quarter Final",
    semi_finals: "Semi Final",
    final: "Final"
  };
  const legLabel = stage === "final" ? "" : ` - Leg ${matchday}`;
  return `${stageLabelMap[stage] || stage}${legLabel}`;
};

export default function Fixtures({ inline = false, mode = "league", leagueState: propLeagueState = null }) {
  const [leagueState, setLeagueState] = useState(propLeagueState);
  const [filter, setFilter] = useState("all"); // all, league, cup
  const [expandedRounds, setExpandedRounds] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (propLeagueState) {
      setLeagueState(propLeagueState);
      return;
    }
    let raw = null;
    if (mode === "tournament") {
      raw = localStorage.getItem("retro_tournament_state");
    } else {
      raw = localStorage.getItem("retro_league_career");
      if (!raw) {
        raw = localStorage.getItem("retro_tournament_state");
      }
    }
    if (!raw && !inline) {
      navigate("/league");
      return;
    }
    if (raw) {
      setLeagueState(JSON.parse(raw));
    }
  }, [navigate, mode, inline, propLeagueState]);

  const toggleRound = (roundId) => {
    setExpandedRounds(prev => ({
      ...prev,
      [roundId]: !prev[roundId]
    }));
  };

  const effectiveCalendar = useMemo(() => {
    if (!leagueState || mode === "tournament") return null;
    if (leagueState.calendar && leagueState.calendar.length > 0) {
      return leagueState.calendar;
    }

    const totalRounds = (leagueState.teams?.length - 1) * 2 || 38;
    const cal = [];
    for (let r = 1; r <= totalRounds; r++) {
      cal.push({ type: "league", index: r });
    }
    if (leagueState.domesticCupState?.calendarSchedules) {
      const domSlots = [...leagueState.domesticCupState.calendarSchedules].sort((a, b) => b.offset - a.offset);
      domSlots.forEach(slot => {
        if (slot.stage !== "final") {
          cal.splice(slot.offset, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
        } else {
          const finalIdx = Math.max(1, cal.length - 1);
          cal.splice(finalIdx, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
        }
      });
    }
    return cal;
  }, [leagueState, mode]);

  const compiledFixtures = useMemo(() => {
    if (!leagueState) return [];

    const {
      fixtures,
      teams,
      playerTeamId,
      europeanCup,
      europeanCupState
    } = leagueState;

    const list = [];
    const playerTeam = teams.find(t => t.idnum === playerTeamId);
    if (!playerTeam) return [];

    // If there is no calendar, we loop through fixtures (e.g. group stage / tournament)
    if (!effectiveCalendar) {
      if (fixtures) {
        fixtures.forEach((roundFixtures, rIdx) => {
          const match = roundFixtures.find(f => f.homeId === playerTeamId || f.awayId === playerTeamId);

          // Compile other matches in the same round
          const rMatches = [];
          roundFixtures.forEach(f => {
            if (f.homeId === playerTeamId || f.awayId === playerTeamId) return;
            const hTeam = teams.find(t => t.idnum === f.homeId);
            const aTeam = teams.find(t => t.idnum === f.awayId);
            if (hTeam && aTeam) {
              rMatches.push({ homeTeam: hTeam, awayTeam: aTeam, homeScore: f.homeScore, awayScore: f.awayScore, played: f.played });
            }
          });

          if (match) {
            const isHome = match.homeId === playerTeamId;
            const opponentId = isHome ? match.awayId : match.homeId;
            const opponent = teams.find(t => t.idnum === opponentId);
            list.push({
              type: mode === "tournament" ? "tournament" : "league",
              round: rIdx + 1,
              label: mode === "tournament" ? `Group Stage - Round ${rIdx + 1}` : `League - Round ${rIdx + 1}`,
              isHome,
              opponent,
              played: match.played,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              playerGoals: isHome ? match.homeScore : match.awayScore,
              opponentGoals: isHome ? match.awayScore : match.homeScore,
              isActive: (rIdx + 1) === (leagueState.currentRound || 1),
              roundMatches: rMatches
            });
          }
        });
      }

      // Check for tournament knockoutState
      if (leagueState.knockoutState) {
        const stageConfigs = [
          { key: "roundOf16", label: "Round of 16" },
          { key: "quarterFinals", label: "Quarter Final" },
          { key: "semiFinals", label: "Semi Final" },
          { key: "thirdPlace", label: "3rd Place Match" },
          { key: "final", label: "Final" }
        ];

        stageConfigs.forEach(({ key, label }) => {
          const kMatches = leagueState.knockoutState[key];
          if (kMatches && Array.isArray(kMatches) && kMatches.length > 0) {
            const playerMatch = kMatches.find(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
            const rMatches = [];
            kMatches.forEach(f => {
              if (f.homeId === playerTeamId || f.awayId === playerTeamId) return;
              const hTeam = teams.find(t => t.idnum === f.homeId);
              const aTeam = teams.find(t => t.idnum === f.awayId);
              if (hTeam && aTeam) {
                rMatches.push({ homeTeam: hTeam, awayTeam: aTeam, homeScore: f.homeScore, awayScore: f.awayScore, played: f.played, penaltyHomeScore: f.penaltyHomeScore, penaltyAwayScore: f.penaltyAwayScore });
              }
            });

            if (playerMatch) {
              const isHome = playerMatch.homeId === playerTeamId;
              const opponentId = isHome ? playerMatch.awayId : playerMatch.homeId;
              const opponent = teams.find(t => t.idnum === opponentId);
              list.push({
                type: "cup",
                label,
                isHome,
                opponent,
                played: playerMatch.played,
                homeScore: playerMatch.homeScore,
                awayScore: playerMatch.awayScore,
                playerGoals: isHome ? playerMatch.homeScore : playerMatch.awayScore,
                opponentGoals: isHome ? playerMatch.awayScore : playerMatch.homeScore,
                isActive: leagueState.stage === key,
                roundMatches: rMatches
              });
            }
          }
        });
      }

      return list;
    }

    // Step through calendar
    effectiveCalendar.forEach((event, cIdx) => {
      const isNextMatch = cIdx === leagueState.calendarIndex;

      if (event.type === "league") {
        const roundFixtures = fixtures[event.index - 1];
        if (roundFixtures) {
          const match = roundFixtures.find(f => f.homeId === playerTeamId || f.awayId === playerTeamId);

          const rMatches = [];
          roundFixtures.forEach(f => {
            if (f.homeId === playerTeamId || f.awayId === playerTeamId) return;
            const hTeam = teams.find(t => t.idnum === f.homeId);
            const aTeam = teams.find(t => t.idnum === f.awayId);
            if (hTeam && aTeam) {
              rMatches.push({ homeTeam: hTeam, awayTeam: aTeam, homeScore: f.homeScore, awayScore: f.awayScore, played: f.played });
            }
          });

          if (match) {
            const isHome = match.homeId === playerTeamId;
            const opponentId = isHome ? match.awayId : match.homeId;
            const opponent = teams.find(t => t.idnum === opponentId);
            list.push({
              type: "league",
              round: event.index,
              label: `League - Round ${event.index}`,
              isHome,
              opponent,
              played: match.played,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              playerGoals: isHome ? match.homeScore : match.awayScore,
              opponentGoals: isHome ? match.awayScore : match.homeScore,
              isActive: isNextMatch,
              roundMatches: rMatches
            });
          }
        }
      } else if (event.type === "europe" && europeanCupState) {
        const pId = europeanCupState.europeanPlayerTeamId;
        if (!pId) return;

        const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
        const seasonShort = leagueState.season.split("/")[0];

        let cupName = "European Cup";
        if (leagueState.region === "north_america") {
          cupName = "CONCACAF Champions Cup";
        } else if (leagueState.region === "south_america") {
          cupName = europeanCup === "cl" ? "Copa Libertadores" : "Copa Sudamericana";
        } else if (europeanCup === "cl") {
          cupName = parseInt(seasonShort) >= 1992 ? "Champions League" : "Champions Cup";
        } else if (europeanCup === "uefa") {
          cupName = parseInt(seasonShort) >= 2009 ? "Europa League" : "UEFA Cup";
        } else if (europeanCup === "uecl") {
          cupName = "Conference League";
        }

        const hasGroupStage = (event.stage === "group_stage" || event.stage === "league_stage");
        const stage = event.stage;
        const matchday = event.matchday;

        // Compile all matches of this stage/matchday
        const rMatches = [];
        let fList = [];
        if (hasGroupStage) {
          fList = europeanCupState.fixtures[matchday - 1] || [];
        } else {
          const kStateKey = toCamelCase(stage) + (stage !== "final" ? "Leg" + matchday : "");
          fList = europeanCupState.knockoutState[kStateKey] || [];
        }

        fList.forEach(f => {
          const hTeam = europeanCupState.teams.find(t => t.idnum === f.homeId);
          const aTeam = europeanCupState.teams.find(t => t.idnum === f.awayId);
          if (hTeam && aTeam) {
            rMatches.push({
              homeTeam: hTeam,
              awayTeam: aTeam,
              homeScore: f.homeScore,
              awayScore: f.awayScore,
              played: f.played,
              isPlayerMatch: f.homeId === pId || f.awayId === pId
            });
          }
        });

        // Find the player's match
        const playerMatch = rMatches.find(m => m.isPlayerMatch);

        if (playerMatch) {
          const isHome = playerMatch.homeTeam.idnum === pId;
          const opponent = isHome ? playerMatch.awayTeam : playerMatch.homeTeam;
          list.push({
            type: "cup",
            stage: event.stage,
            matchday: event.matchday,
            label: `${cupName} - ${hasGroupStage ? `MD ${matchday}` : getStageLabel(stage, matchday)}`,
            isHome,
            opponent,
            played: playerMatch.played,
            homeScore: playerMatch.homeScore,
            awayScore: playerMatch.awayScore,
            playerGoals: isHome ? playerMatch.homeScore : playerMatch.awayScore,
            opponentGoals: isHome ? playerMatch.awayScore : playerMatch.homeScore,
            isActive: isNextMatch,
            roundMatches: rMatches.filter(m => !m.isPlayerMatch)
          });
        } else {
          // Player team not playing (Rest week / Eliminated)
          const isRest = hasGroupStage;
          list.push({
            type: isRest ? "rest" : "eliminated",
            stage: event.stage,
            matchday: event.matchday,
            label: `${cupName} - ${hasGroupStage ? `MD ${matchday}` : getStageLabel(stage, matchday)}`,
            description: isRest ? "Rest Week - Squad Rested" : "Eliminated - Neutral Matches",
            isActive: isNextMatch,
            roundMatches: rMatches
          });
        }
      } else if ((event.type === "domestic_cup" || event.isDomesticCup) && leagueState.domesticCupState) {
        const domCup = leagueState.domesticCupState;
        const pId = playerTeamId;
        const stage = event.stage;
        const stageLabelMap = {
          round_of_32: "Round of 32",
          round_of_16: "Round of 16",
          quarter_finals: "Quarter Final",
          semi_finals: "Semi Final",
          final: "Final"
        };
        const stageName = stageLabelMap[stage] || (stage ? stage.replace(/_/g, ' ').toUpperCase() : "Cup Round");
        const fList = domCup.knockoutState ? (domCup.knockoutState[stage] || []) : [];

        const rMatches = [];
        fList.forEach(f => {
          const hTeam = (domCup.participatingTeams && domCup.participatingTeams.find(t => t.idnum === f.homeId)) || teams.find(t => t.idnum === f.homeId);
          const aTeam = (domCup.participatingTeams && domCup.participatingTeams.find(t => t.idnum === f.awayId)) || teams.find(t => t.idnum === f.awayId);
          if (hTeam && aTeam) {
            rMatches.push({
              homeTeam: hTeam,
              awayTeam: aTeam,
              homeScore: f.homeScore,
              awayScore: f.awayScore,
              played: f.played,
              penaltyHomeScore: f.penaltyHomeScore,
              penaltyAwayScore: f.penaltyAwayScore,
              isPlayerMatch: f.homeId === pId || f.awayId === pId
            });
          }
        });

        const playerMatch = rMatches.find(m => m.isPlayerMatch);
        if (playerMatch) {
          const isHome = playerMatch.homeTeam.idnum === pId;
          const opponent = isHome ? playerMatch.awayTeam : playerMatch.homeTeam;
          list.push({
            type: "cup",
            stage: event.stage,
            label: `${domCup.cupName} - ${stageName}`,
            isHome,
            opponent,
            played: playerMatch.played,
            homeScore: playerMatch.homeScore,
            awayScore: playerMatch.awayScore,
            playerGoals: isHome ? playerMatch.homeScore : playerMatch.awayScore,
            opponentGoals: isHome ? playerMatch.awayScore : playerMatch.homeScore,
            penaltyHomeScore: playerMatch.penaltyHomeScore,
            penaltyAwayScore: playerMatch.penaltyAwayScore,
            isActive: isNextMatch,
            roundMatches: rMatches.filter(m => !m.isPlayerMatch)
          });
        } else {
          list.push({
            type: "eliminated",
            stage: event.stage,
            label: `${domCup.cupName} - ${stageName}`,
            description: "Eliminated - Neutral Matches",
            isActive: isNextMatch,
            roundMatches: rMatches
          });
        }
      }
    });

    return list;
  }, [leagueState, mode, effectiveCalendar]);

  const filteredFixtures = useMemo(() => {
    if (filter === "league") {
      return compiledFixtures.filter(f => f.type === "league");
    }
    if (filter === "cup") {
      return compiledFixtures.filter(f => f.type !== "league");
    }
    return compiledFixtures;
  }, [compiledFixtures, filter]);

  if (!leagueState) {
    return (
      <div className="Match team-select-container">
        <div className="empty-kit-slot">...</div>
      </div>
    );
  }

  const {
    season,
    country,
    playerTeamId,
    teams,
    managerName
  } = leagueState;

  const playerTeam = teams.find(t => t.idnum === playerTeamId);
  const managerNameToShow = managerName || "Sir Alex";

  // Calculate stats for overview card
  const stats = {
    played: playerTeam?.played || 0,
    won: playerTeam?.won || 0,
    drawn: playerTeam?.drawn || 0,
    lost: playerTeam?.lost || 0,
    gf: playerTeam?.gf || 0,
    ga: playerTeam?.ga || 0,
    gd: (playerTeam?.gf || 0) - (playerTeam?.ga || 0),
    points: playerTeam?.points || 0
  };

  const getOutcomeDetails = (fixture) => {
    if (!fixture.played) return { text: "VS", color: "#ff4500", bg: "rgba(255,255,255,0.03)" };

    if (fixture.playerGoals > fixture.opponentGoals) {
      return {
        text: "W",
        color: "#00ff64",
        border: "1px solid rgba(0, 255, 100, 0.4)",
        bg: "rgba(0, 255, 100, 0.05)",
        desc: `Win (${fixture.homeScore}-${fixture.awayScore})`
      };
    } else if (fixture.playerGoals < fixture.opponentGoals) {
      return {
        text: "L",
        color: "#ff3333",
        border: "1px solid rgba(255, 51, 51, 0.4)",
        bg: "rgba(255, 51, 51, 0.05)",
        desc: `Loss (${fixture.homeScore}-${fixture.awayScore})`
      };
    } else {
      return {
        text: "D",
        color: "#ffa500",
        border: "1px solid rgba(255, 165, 0, 0.4)",
        bg: "rgba(255, 165, 0, 0.05)",
        desc: `Draw (${fixture.homeScore}-${fixture.awayScore})`
      };
    }
  };

  return (
    <div className="Match team-select-container league-dashboard-arena" style={{ minHeight: inline ? "auto" : "100vh", paddingBottom: inline ? "20px" : "50px" }}>

      {/* Header */}
      {!inline && (
        <div className="matchheader selector-header" style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "1000px" }}>
          <div>
            <h1 className="glowing-header-text" style={{ textAlign: "left", fontSize: "32px" }}>FIXTURES & RESULTS</h1>
            <p className="lobby-subtitle" style={{ textAlign: "left" }}>
              Season {season} - {playerTeam?.name} Fixtures Log
            </p>
          </div>

          <button
            onClick={() => navigate(mode === "tournament" ? "/tournament/dashboard" : "/league/dashboard")}
            className="glowing-btn"
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              borderColor: "#00e5ff",
              color: "#00e5ff",
              background: "rgba(0, 229, 255, 0.05)",
              fontFamily: "Orbitron"
            }}
          >
            ➔ BACK TO OFFICE
          </button>
        </div>
      )}

      <div className="match-arena-layout" style={{ maxWidth: "1000px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Top Info Cards */}
        <div style={{ display: "flex", width: "100%", gap: "20px", flexWrap: "wrap" }}>

          {/* Manager & Team Office */}
          <div className="glass-card" style={{ flex: "1 1 300px", padding: "18px 22px" }}>
            <h3 className="team-card-title" style={{ fontSize: "14px", textAlign: "left", color: "#ffd700", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px", fontFamily: "Orbitron", textTransform: "uppercase" }}>
              📋 CABINET PROFILE
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px", marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Club Name:</span>
                <span style={{ fontWeight: "bold", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                  {playerTeam?.name} <CountryFlag country={country} size={16} />
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>Manager In Office:</span>
                <span style={{ fontWeight: "bold", color: "#fff" }}>{managerNameToShow}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#888" }}>League Division:</span>
                <span style={{ fontWeight: "bold", color: "#00ff64", textTransform: "uppercase" }}>
                  {country} {leagueState.division === 2 ? "Division 2" : "Division 1"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats board */}
          <div className="glass-card" style={{ flex: "2 1 500px", padding: "18px 22px" }}>
            <h3 className="team-card-title" style={{ fontSize: "14px", textAlign: "left", color: "#00ff64", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px", fontFamily: "Orbitron", textTransform: "uppercase" }}>
              📊 DOMESTIC LEAGUE RECORD
            </h3>

            <div className="domestic-stats-grid">
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#888", fontWeight: "bold" }}>P</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.played}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#00ff64", fontWeight: "bold" }}>W</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#00ff64", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.won}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#ffa500", fontWeight: "bold" }}>D</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#ffa500", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.drawn}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#ff3333", fontWeight: "bold" }}>L</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#ff3333", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.lost}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#888", fontWeight: "bold" }}>GF</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.gf}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#888", fontWeight: "bold" }}>GA</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fff", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.ga}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.3)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: "10px", color: "#888", fontWeight: "bold" }}>GD</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: stats.gd >= 0 ? "#00ff64" : "#ff3333", fontFamily: "Orbitron", marginTop: "4px" }}>
                  {stats.gd > 0 ? `+${stats.gd}` : stats.gd}
                </div>
              </div>
              <div style={{ background: "rgba(0, 255, 100, 0.05)", padding: "8px", borderRadius: "8px", border: "1px solid rgba(0,255,100,0.2)" }}>
                <div style={{ fontSize: "10px", color: "#00ff64", fontWeight: "bold" }}>PTS</div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#00ff64", fontFamily: "Orbitron", marginTop: "4px" }}>{stats.points}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="filter-tabs-container">
          <button
            onClick={() => setFilter("all")}
            className="back-home-btn"
            style={{
              fontSize: "12px",
              padding: "8px 16px",
              borderColor: filter === "all" ? "#ffd700" : "rgba(255,255,255,0.1)",
              background: filter === "all" ? "rgba(255, 215, 0, 0.08)" : "transparent"
            }}
          >
            📋 ALL MATCHES ({compiledFixtures.length})
          </button>

          <button
            onClick={() => setFilter("league")}
            className="back-home-btn"
            style={{
              fontSize: "12px",
              padding: "8px 16px",
              borderColor: filter === "league" ? "#00ff64" : "rgba(255,255,255,0.1)",
              background: filter === "league" ? "rgba(0, 255, 100, 0.08)" : "transparent"
            }}
          >
            🛡️ LEAGUE ONLY ({compiledFixtures.filter(f => f.type === "league").length})
          </button>

          <button
            onClick={() => setFilter("cup")}
            className="back-home-btn"
            style={{
              fontSize: "12px",
              padding: "8px 16px",
              borderColor: filter === "cup" ? "#00e5ff" : "rgba(255,255,255,0.1)",
              background: filter === "cup" ? "rgba(0, 229, 255, 0.08)" : "transparent"
            }}
          >
            ⭐ CUP FIXTURES ({compiledFixtures.filter(f => f.type !== "league").length})
          </button>
        </div>

        {/* Scrollable List container */}
        <div className="glass-card fixtures-scroll-container">
          {filteredFixtures.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888", fontSize: "14px" }}>
              No matches scheduled or recorded in this category.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredFixtures.map((fixture, idx) => {
                const outcome = getOutcomeDetails(fixture);
                const isRest = fixture.type === "rest";
                const isEliminated = fixture.type === "eliminated";

                const showSpecialStatus = isRest || isEliminated;
                const roundId = fixture.type === "league" ? `league-${fixture.round}` : `cup-${fixture.stage}-${fixture.matchday}`;
                const isExpanded = expandedRounds[roundId];
                const rowClass = `fixture-row animated-slide-in${fixture.isActive ? " active-fixture" : ""}${showSpecialStatus ? " special-fixture" : ""}`;

                return (
                  <div key={idx} className={rowClass}>

                    {/* Top Main Bar */}
                    <div className="fixture-main-bar">

                      {/* Stage/Round details */}
                      <div className="fixture-round-col">
                        <span
                          className={`fixture-round-label ${
                            fixture.isActive ? "active-text" : (fixture.type === "league" ? "league-text" : "cup-text")
                          }`}
                        >
                          {fixture.label}
                        </span>
                        <span className="fixture-round-status">
                          {fixture.isActive ? "🔴 NEXT MATCH" : (fixture.played ? "✔ COMPLETED" : "⏳ UPCOMING")}
                        </span>
                      </div>

                      {/* Team 1 (Home Team) */}
                      <div className="fixture-team-home">
                        {showSpecialStatus ? (
                          <span className={`fixture-special-badge ${isRest ? "rest-badge" : "eliminated-badge"}`}>
                            {isRest ? "REST WEEK" : "ELIMINATED"}
                          </span>
                        ) : (
                          <>
                            <span
                              className={`fixture-team-name${fixture.isHome ? " player-team" : ""}`}
                              title={fixture.isHome ? playerTeam?.name : (fixture.opponent?.name || "Unknown")}
                            >
                              {fixture.isHome ? playerTeam?.name : (fixture.opponent?.name || "Unknown")}
                            </span>
                            <TeamFlag
                              primaryColor={fixture.isHome ? playerTeam?.primaryColor : (fixture.opponent?.primaryColor || "#555")}
                              secondaryColor={fixture.isHome ? playerTeam?.secondaryColor : (fixture.opponent?.secondaryColor || "#555")}
                            />
                          </>
                        )}
                      </div>

                      {/* Score / Center Preview */}
                      <div className="fixture-score-col">
                        {showSpecialStatus ? (
                          <span className="fixture-special-sleep">💤</span>
                        ) : (
                          <div className="fixture-score-wrapper">
                            {/* Score or VS */}
                            <div className="fixture-score-text-wrapper">
                              <span className="fixture-score-val" style={{ color: outcome.color }}>
                                {fixture.played
                                  ? `${fixture.homeScore} - ${fixture.awayScore}${fixture.penaltyHomeScore !== undefined && (fixture.penaltyHomeScore > 0 || fixture.penaltyAwayScore > 0) ? ` (${fixture.penaltyHomeScore}-${fixture.penaltyAwayScore} pen)` : ""}`
                                  : "VS"
                                }
                              </span>
                            </div>

                            {/* Played status result badge (W / D / L) */}
                            {fixture.played ? (
                              <span
                                className="fixture-status-badge outcome-badge"
                                style={{
                                  background: outcome.bg,
                                  border: outcome.border,
                                  color: outcome.color,
                                }}
                                title={outcome.desc}
                              >
                                {outcome.text}
                              </span>
                            ) : (
                              <span className="fixture-status-badge venue-badge">
                                {fixture.isHome ? "HOME" : "AWAY"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Team 2 (Away Team) */}
                      <div className="fixture-team-away">
                        {showSpecialStatus ? (
                          <span className="fixture-special-desc">
                            {fixture.description}
                          </span>
                        ) : (
                          <>
                            <TeamFlag
                              primaryColor={fixture.isHome ? (fixture.opponent?.primaryColor || "#555") : playerTeam?.primaryColor}
                              secondaryColor={fixture.isHome ? (fixture.opponent?.secondaryColor || "#555") : playerTeam?.secondaryColor}
                            />
                            <span
                              className={`fixture-team-name${!fixture.isHome ? " player-team" : ""}`}
                              title={fixture.isHome ? (fixture.opponent?.name || "Unknown") : playerTeam?.name}
                            >
                              {fixture.isHome ? (fixture.opponent?.name || "Unknown") : playerTeam?.name}
                            </span>
                          </>
                        )}
                      </div>

                    </div>

                    {/* Secondary Row: Collapsible or Neutral matches list */}
                    {showSpecialStatus ? (
                      /* Display neutral cup matches directly */
                      fixture.roundMatches && fixture.roundMatches.length > 0 && (
                        <div className="fixture-secondary-row">
                          <div className="neutral-matches-title">
                            🏆 TOURNAMENT SCHEDULE / RESULTS:
                          </div>

                          <div className="neutral-matches-box">
                            {fixture.roundMatches.map((m, mIdx) => (
                              <div key={mIdx} className="neutral-match-row">
                                <span className="neutral-match-team-home">
                                  {m.homeTeam.name}
                                </span>
                                <span className="neutral-match-flag">
                                  <TeamFlag primaryColor={m.homeTeam.primaryColor} secondaryColor={m.homeTeam.secondaryColor} size={20} />
                                </span>
                                <span className="neutral-match-score" style={{ color: m.played ? "#00ff64" : "#888" }}>
                                  {m.played ? `${m.homeScore} - ${m.awayScore}${m.penaltyHomeScore !== undefined && (m.penaltyHomeScore > 0 || m.penaltyAwayScore > 0) ? ` (${m.penaltyHomeScore}-${m.penaltyAwayScore} pen)` : ""}` : "vs"}
                                </span>
                                <span className="neutral-match-flag">
                                  <TeamFlag primaryColor={m.awayTeam.primaryColor} secondaryColor={m.awayTeam.secondaryColor} size={20} />
                                </span>
                                <span className="neutral-match-team-away">
                                  {m.awayTeam.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      /* Active weeks: Collapsible drawer to view other matches in the round */
                      fixture.roundMatches && fixture.roundMatches.length > 0 && (
                        <div className="expand-matches-btn-wrapper">
                          <button
                            onClick={() => toggleRound(roundId)}
                            className="expand-matches-btn"
                            style={{
                              color: fixture.isActive ? "#00e5ff" : "#ffd700"
                            }}
                          >
                            {isExpanded ? "▼ HIDE OTHER MATCHES" : `▶ SHOW OTHER MATCHES (${fixture.roundMatches.length})`}
                          </button>

                          {isExpanded && (
                            <div className="neutral-matches-box" style={{ background: "rgba(0, 0, 0, 0.25)" }}>
                              {fixture.roundMatches.map((m, mIdx) => (
                                <div key={mIdx} className="neutral-match-row" style={{ color: "#ccc" }}>
                                  <span className="neutral-match-team-home">
                                    {m.homeTeam.name}
                                  </span>
                                  <span className="neutral-match-flag">
                                    <TeamFlag primaryColor={m.homeTeam.primaryColor} secondaryColor={m.homeTeam.secondaryColor} size={20} />
                                  </span>
                                  <span className="neutral-match-score" style={{ color: m.played ? "#00ff64" : "#888" }}>
                                    {m.played ? `${m.homeScore} - ${m.awayScore}${m.penaltyHomeScore !== undefined && (m.penaltyHomeScore > 0 || m.penaltyAwayScore > 0) ? ` (${m.penaltyHomeScore}-${m.penaltyAwayScore} pen)` : ""}` : "vs"}
                                  </span>
                                  <span className="neutral-match-flag">
                                    <TeamFlag primaryColor={m.awayTeam.primaryColor} secondaryColor={m.awayTeam.secondaryColor} size={20} />
                                  </span>
                                  <span className="neutral-match-team-away">
                                    {m.awayTeam.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {!inline && (
        <div style={{ marginTop: "20px" }}>
          <button className="back-home-btn" onClick={() => navigate(mode === "tournament" ? "/tournament/dashboard" : "/league/dashboard")}>➔ RETURN TO OFFICE</button>
        </div>
      )}

    </div>
  );
}
