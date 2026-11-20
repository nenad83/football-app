import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import '../assets/styles/Match.css';
import { leagueDataMap, leagueDataMapD2 } from '../data/leagueData';
import { leagueDataMapSA } from '../data/leagueDataSA';
import { qualifiersBySeason } from '../data/qualifiersBySeason';
import { qualifiersBySeasonSA } from '../data/qualifiersBySeasonSA';
import { clRules } from '../data/cl/clRules';
import { uefaRules } from '../data/uefa/uefaRules';
import { ueclRules } from '../data/uecl/ueclRules';
import { clibRules } from '../data/clib/clibRules';
import { csudRules } from '../data/csud/csudRules'; import CountryFlag from './CountryFlag';
import { createDomesticCup, getDomesticCupExpectation } from '../utils/domesticCupGenerator';
import {
  loadSeasonRosters,
  getTeamDetails,
  cleanStale1To5Rosters,
  scaleStatTo10,
  calculateSquadTacticalAverages,
  findSquadForTeam
} from '../data/rosters/rosterRegistry';
import { getPreferredTeamFormation } from './FormationTactics';
import { applyTeamTheme } from '../utils/themeManager';


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

// Berger tables generator (inserts a bye slot when teamsList.length is odd)
const generateRoundRobinFixtures = (teamsList) => {
  const list = teamsList.length % 2 === 0 ? [...teamsList] : [...teamsList, null];
  const n = list.length;
  const fixtures = [];

  // First Leg
  for (let round = 0; round < n - 1; round++) {
    const roundFixtures = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (!home || !away) continue;
      if (round % 2 === 0) {
        roundFixtures.push({ homeId: home.idnum, awayId: away.idnum, played: false, homeScore: 0, awayScore: 0 });
      } else {
        roundFixtures.push({ homeId: away.idnum, awayId: home.idnum, played: false, homeScore: 0, awayScore: 0 });
      }
    }
    fixtures.push(roundFixtures);
    list.splice(1, 0, list.pop());
  }

  // Second Leg (swapped home/away)
  for (let round = 0; round < n - 1; round++) {
    const roundFixtures = fixtures[round].map(f => ({
      homeId: f.awayId,
      awayId: f.homeId,
      played: false,
      homeScore: 0,
      awayScore: 0
    }));
    fixtures.push(roundFixtures);
  }

  return fixtures;
};

const generateDynamicSchedules = (totalRounds, rules) => {
  if (!rules || !rules.calendarSchedules) return [];

  // Deep copy the original schedules so we don't mutate the rules module
  const schedules = JSON.parse(JSON.stringify(rules.calendarSchedules));

  // 1. Classify autumn vs spring stages
  const groupSlots = schedules.filter(s => s.stage === "group_stage" || s.stage === "league_stage");
  const totalGroupMatchdays = groupSlots.length;

  const isAutumn = (slot) => {
    if (slot.stage === "group_stage" || slot.stage === "league_stage") {
      if (totalGroupMatchdays === 12) {
        return slot.matchday <= 6;
      }
      return true;
    }
    if (rules.format === "pure_knockout") {
      const uniqueStages = (rules.stages || []).filter(s => s !== "final");
      if (uniqueStages.length >= 4) {
        return slot.stage === uniqueStages[0] || slot.stage === uniqueStages[1];
      }
      if (uniqueStages.length === 3) {
        return slot.stage === uniqueStages[0];
      }
      return false;
    }
    return false;
  };

  const autumnSlots = schedules.filter(s => isAutumn(s));
  const springSlots = schedules.filter(s => !isAutumn(s) && s.stage !== "final");
  const finalSlot = schedules.find(s => s.stage === "final");

  // 2. Schedule Autumn slots forwards
  const A = autumnSlots.length;
  if (A > 6) {
    autumnSlots.forEach((slot, i) => {
      slot.offset = 2 + i * 2 + (i >= 4 ? 1 : 0);
    });
  } else if (A > 0) {
    autumnSlots.forEach((slot, i) => {
      if (i === 0) {
        slot.offset = 2;
      } else {
        const prevSlot = autumnSlots[i - 1];
        if (prevSlot.stage === slot.stage && prevSlot.matchday === 1 && slot.matchday === 2) {
          slot.offset = prevSlot.offset + 2;
        } else {
          slot.offset = prevSlot.offset + 3;
        }
      }
    });
  }

  // 3. Schedule Spring slots backwards (excluding final)
  let currentR = totalRounds;
  for (let i = springSlots.length - 1; i >= 0; i--) {
    const slot = springSlots[i];
    const hasLeg2 = springSlots.some(s => s.stage === slot.stage && s.matchday === 2);
    if (slot.matchday === 2 || !hasLeg2) {
      currentR = currentR - 2;
    } else {
      currentR = currentR - 1;
    }
    slot.offset = currentR;
  }

  // 4. Resolve Overlap
  if (A > 0 && springSlots.length > 0) {
    const lastAutumnOffset = autumnSlots[autumnSlots.length - 1].offset;
    const firstSpringOffset = springSlots[0].offset;
    const minGap = 2;
    if (firstSpringOffset < lastAutumnOffset + minGap) {
      const diff = (lastAutumnOffset + minGap) - firstSpringOffset;
      springSlots.forEach(slot => {
        slot.offset += diff;
      });
      if (finalSlot) {
        finalSlot.offset += diff;
      }
    }
  }

  // Assign Final offset (if final slot exists and wasn't shifted)
  if (finalSlot && finalSlot.offset === undefined) {
    if (springSlots.length > 0) {
      finalSlot.offset = springSlots[springSlots.length - 1].offset + 2;
    } else {
      finalSlot.offset = totalRounds;
    }
  }

  // Combine back and sort chronologically
  const result = [...autumnSlots, ...springSlots];
  if (finalSlot) result.push(finalSlot);
  return result;
};

const formatSeasonLabel = (yr) => `${yr}/${String((parseInt(yr, 10) + 1) % 100).padStart(2, '0')}`;

const EUROPE_LEAGUES = [
  { id: 'england', name: 'England', getTitle: (yr) => (parseInt(yr, 10) < 1992 ? 'First Division' : 'Premier League') },
  { id: 'italy', name: 'Italy', getTitle: () => 'Serie A' },
  { id: 'spain', name: 'Spain', getTitle: () => 'La Liga' },
  { id: 'germany', name: 'Germany', getTitle: () => 'Bundesliga' },
  { id: 'france', name: 'France', getTitle: () => 'Ligue 1' },
  { id: 'netherlands', name: 'Netherlands', getTitle: () => 'Eredivisie' },
  { id: 'portugal', name: 'Portugal', getTitle: () => 'Primeira Liga' },
  { id: 'scotland', name: 'Scotland', getTitle: () => 'Scottish Premier' },
  { id: 'russia', name: 'Russia', getTitle: () => 'Russian Premier' },
  { id: 'ukraine', name: 'Ukraine', getTitle: () => 'Ukrainian Premier' }
];

const SOUTH_AMERICA_LEAGUES = [
  { id: 'argentina', name: 'Argentina', getTitle: () => 'Primera División' },
  { id: 'brazil', name: 'Brazil', getTitle: () => 'Brasileirão Série A' },
  { id: 'colombia', name: 'Colombia', getTitle: () => 'Categoría Primera A' }
];

export default function LeagueSelect() {
  const [season, setSeason] = useState("1993");
  const [country, setCountry] = useState("england");
  const [regionTab, setRegionTab] = useState("europe"); // "europe" | "south_america"
  const [step, setStep] = useState("season"); // "season" | "league" | "teams"
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [managerName, setManagerName] = useState("Sir Alex");
  const [division, setDivision] = useState(1); // 1 = D1, 2 = D2
  const [isStarting, setIsStarting] = useState(false);
  const [seasonRosters, setSeasonRosters] = useState(null);
  const [activeDetails, setActiveDetails] = useState(null);

  // Auto clean any stale 1-5 caches on mount
  React.useEffect(() => {
    cleanStale1To5Rosters();
  }, []);

  // Preload season rosters when season changes
  React.useEffect(() => {
    let isMounted = true;
    loadSeasonRosters(season).then(data => {
      if (isMounted && data) {
        setSeasonRosters(data);
      }
    });
    return () => { isMounted = false; };
  }, [season]);

  const navigate = useNavigate();

  const getExpectation = (team, allTeams = null) => {
    if (!team) return null;
    const rawAvg = (team.attack + team.midfield + team.defense) / 3;
    const avg = rawAvg > 5 ? rawAvg / 2 : rawAvg;
    const isSA = country === "argentina" || country === "brazil" || country === "colombia";

    if (division === 2) {
      if (allTeams && allTeams.length > 0) {
        const sortedByRating = [...allTeams]
          .map(t => ({ idnum: t.idnum, rating: (t.attack + t.midfield + t.defense) / 3 }))
          .sort((a, b) => b.rating - a.rating);

        const teamIndex = sortedByRating.findIndex(t => t.idnum === team.idnum);
        const rank = teamIndex !== -1 ? teamIndex + 1 : 1;
        const N = allTeams.length;
        const pct = rank / N;

        if (pct <= 0.15 || avg >= 2.8) {
          return { text: "Win Promotion! 🏆", rank: 1, desc: "Title Contender / Automatic Promotion" };
        } else if (pct <= 0.45 || avg >= 2.3) {
          return { text: "Promote / Reach Playoffs ↗️", rank: 3, desc: "Promotion Challenger" };
        } else if (pct <= 0.75 || avg >= 1.8) {
          return { text: "Finish in Top 10", rank: 10, desc: "Top 10 Finisher" };
        } else {
          return { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };
        }
      }
      if (avg >= 2.8) return { text: "Win Promotion! 🏆", rank: 1, desc: "Title Contender / Automatic Promotion" };
      if (avg >= 2.3) return { text: "Promote / Reach Playoffs ↗️", rank: 3, desc: "Promotion Challenger" };
      if (avg >= 1.8) return { text: "Finish in Top 10", rank: 10, desc: "Top 10 Finisher" };
      return { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };
    }

    if (allTeams && allTeams.length > 0) {
      const sortedByRating = [...allTeams]
        .map(t => ({ idnum: t.idnum, rating: (t.attack + t.midfield + t.defense) / 3 }))
        .sort((a, b) => b.rating - a.rating);

      const teamIndex = sortedByRating.findIndex(t => t.idnum === team.idnum);
      const rank = teamIndex !== -1 ? teamIndex + 1 : 1;
      const N = allTeams.length;
      const pct = rank / N;

      let exp = { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };

      if (pct <= 0.12) {
        exp = { text: "Win the League!", rank: 1, desc: "Title Contender" };
      } else if (pct <= 0.28) {
        exp = {
          text: isSA ? "Finish in Top Spots (Continental)" : "Finish in Top 4 (Europe)",
          rank: 4,
          desc: isSA ? "Continental Challenger" : "European Challenger"
        };
      } else if (pct <= 0.40) {
        exp = {
          text: isSA ? "Finish in Top Spots (Continental)" : "Finish in Top 6 (Europe)",
          rank: 6,
          desc: isSA ? "Continental Challenger" : "European Challenger"
        };
      } else if (pct <= 0.55) {
        exp = { text: "Finish in Top 10", rank: 10, desc: "Top 10 Finisher" };
      } else if (pct <= 0.80) {
        exp = { text: "Finish in Mid-Table (10th-14th)", rank: 14, desc: "Mid-Table Stability" };
      } else {
        exp = { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };
      }

      // Enforce Absolute Rating Floor:
      // If a team is rated highly, we override low relative expectations to match their prestige
      if (avg >= 4.5 && exp.rank > 1) {
        exp = { text: "Win the League!", rank: 1, desc: "Title Contender" };
      } else if (avg >= 4.2 && exp.rank > 4) {
        exp = {
          text: isSA ? "Finish in Top Spots (Continental)" : "Finish in Top 4 (Europe)",
          rank: 4,
          desc: isSA ? "Continental Challenger" : "European Challenger"
        };
      } else if (avg >= 3.8 && exp.rank > 6) {
        exp = {
          text: isSA ? "Finish in Top Spots (Continental)" : "Finish in Top 6 (Europe)",
          rank: 6,
          desc: isSA ? "Continental Challenger" : "European Challenger"
        };
      } else if (avg >= 3.2 && exp.rank > 10) {
        exp = { text: "Finish in Top 10", rank: 10, desc: "Top 10 Finisher" };
      }

      return exp;
    }

    if (avg >= 4.5) {
      return { text: "Win the League!", rank: 1, desc: "Title Contender" };
    } else if (avg >= 4.2) {
      return {
        text: isSA ? "Finish in Top Spots (Continental)" : "Finish in Top 4 (Europe)",
        rank: 4,
        desc: isSA ? "Continental Challenger" : "European Challenger"
      };
    } else if (avg >= 3.8) {
      return {
        text: isSA ? "Finish in Top Spots (Continental)" : "Finish in Top 6 (Europe)",
        rank: 6,
        desc: isSA ? "Continental Challenger" : "European Challenger"
      };
    } else if (avg >= 3.2) {
      return { text: "Finish in Top 10", rank: 10, desc: "Top 10 Finisher" };
    } else if (avg >= 2.3) {
      return { text: "Finish in Mid-Table (10th-14th)", rank: 14, desc: "Mid-Table Stability" };
    } else {
      return { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };
    }
  };


  // Dynamically load the correct roster data
  const isSACountry = (country === "argentina" || country === "brazil" || country === "colombia");
  const hasD2 = leagueDataMapD2[season] && leagueDataMapD2[season][country];
  const selectedData = isSACountry
    ? ((leagueDataMapSA[season] && leagueDataMapSA[season][country]) ? leagueDataMapSA[season][country] : leagueDataMapSA["2010"]["argentina"])
    : (division === 2 && hasD2
      ? leagueDataMapD2[season][country]
      : ((leagueDataMap[season] && leagueDataMap[season][country]) ? leagueDataMap[season][country] : leagueDataMap["1993"]["england"])
    );


  const roster = selectedData.map(team => {
    const squad = seasonRosters ? findSquadForTeam(seasonRosters, team.name) : null;
    const comp = squad ? calculateSquadTacticalAverages(squad) : null;
    return {
      ...team,
      attack: comp ? comp.attack : scaleStatTo10(team.attack),
      midfield: comp ? comp.midfield : scaleStatTo10(team.midfield),
      defense: comp ? comp.defense : scaleStatTo10(team.defense),
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
    };
  });

  const activeTeamObj = roster.find(t => t.idnum === selectedTeamId);

  React.useEffect(() => {
    let isMounted = true;
    if (activeTeamObj?.name) {
      getTeamDetails(activeTeamObj.name, season).then(det => {
        if (isMounted) setActiveDetails(det);
      });
    } else {
      setActiveDetails(null);
    }
    return () => { isMounted = false; };
  }, [activeTeamObj?.name, season]);

  // Step transition handlers
  const handleSelectSeason = (yr) => {
    setSeason(yr);
    setSelectedTeamId(null);
    setDivision(1);
    setStep("league");
  };

  const handleSelectLeague = (leagueId) => {
    setCountry(leagueId);
    setSelectedTeamId(null);
    setDivision(1);
    setStep("teams");
  };

  const handleImportSave = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        let careerData = null;
        let profileData = null;

        if (importedData.career && importedData.managerProfile) {
          careerData = importedData.career;
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
        } else if (importedData.season && importedData.country && importedData.teams && importedData.fixtures) {
          careerData = importedData;
        } else {
          throw new Error("Invalid save file format. Missing core league parameters.");
        }

        if (importedData.formation) {
          localStorage.setItem('retro_player_formation', importedData.formation);
        }
        localStorage.setItem("retro_league_career", JSON.stringify(careerData));

        if (profileData) {
          localStorage.setItem("retro_manager_profile", JSON.stringify(profileData));
        } else {
          localStorage.removeItem("retro_manager_profile");
        }

        alert("Career save and manager profile successfully imported! Loading dashboard...");
        applyTeamTheme(careerData.teams?.find(t => t.idnum === careerData.playerTeamId));
        navigate("/league/dashboard");
      } catch (err) {
        alert("Error importing save file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Initialize League Career state
  const handleStartCareer = async () => {
    if (selectedTeamId === null) return;
    setIsStarting(true);

    // Preload the selected season roster into memory in the background
    loadSeasonRosters(season);

    // Clear all previous rosters and lineups from localStorage to start fresh
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("retro_roster_") || key.startsWith("retro_lineup_") || key.startsWith("retro_roles_") || key.startsWith("retro_formation_"))) {
        localStorage.removeItem(key);
      }
    }

    let startingBudget = 10.0;
    let startingPayrollBudget = null;
    let startingWageCap = null;
    let startingFormation = "4-4-2";
    try {
      const details = await getTeamDetails(activeTeamObj.name, season);
      startingFormation = getPreferredTeamFormation(activeTeamObj.name, season, details);
      if (details && details.finances) {
        if (typeof details.finances.transferBudget === 'number') {
          startingBudget = details.finances.transferBudget;
        }
        if (typeof details.finances.estimatedWeeklyPayroll === 'number') {
          startingPayrollBudget = Math.round(details.finances.estimatedWeeklyPayroll * 1.12);
        }
        if (typeof details.finances.weeklyWageCap === 'number') {
          startingWageCap = details.finances.weeklyWageCap;
        }
      } else {
        const prompt = `You are a football finance historian. What was the approximate transfer budget in USD (in millions, e.g. 5.5 for $5.5M) for the club "${activeTeamObj.name}" in the "${season}" season? 
Provide a single JSON object with the key "budget". The value must be a number (float or int) representing USD in millions. E.g. {"budget": 12.5}.
Be highly realistic: Alemannia Aachen in 1999/2000 has a small budget ($1.0M - $2.0M), while Manchester United has a large budget ($30M - $40M). Adjust for the era's financial scaling (e.g. 1980s budgets are much smaller).`;

        const requestBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                budget: { type: "NUMBER" }
              },
              required: ["budget"]
            }
          }
        };

        const apiKey = process.env.REACT_APP_GEMINI_API_KEY || "";
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (response.ok) {
          const resData = await response.json();
          const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text.trim());
            if (parsed && typeof parsed.budget === 'number') {
              startingBudget = Math.max(0.2, parseFloat(parsed.budget.toFixed(1)));
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch authentic budget, falling back to formula", e);
      const stats = {
        attack: activeTeamObj.attack || 7,
        midfield: activeTeamObj.midfield || 7,
        defense: activeTeamObj.defense || 7
      };
      const avgRating = (stats.attack + stats.midfield + stats.defense) / 3;
      const divisionMultiplier = division === 2 ? 0.3 : 1.2;
      const eraMultiplier = 1 + (parseInt(season) - 1980) * 0.04;
      startingBudget = Math.max(0.5, parseFloat((Math.pow(avgRating / 2, 2.2) * divisionMultiplier * eraMultiplier).toFixed(1)));
    }

    window.lastFetchedStartingBudget = startingBudget;

    const expObj = getExpectation(activeTeamObj, roster);
    const fixtures = generateRoundRobinFixtures(roster);

    // SA vs European Cup Initialization
    const isSA = (country === "argentina" || country === "brazil" || country === "colombia");
    let europeanCup = null;
    let europeanCupState = null;
    let calendar = null;
    let calendarIndex = 0;

    const teamName = activeTeamObj.name;

    if (isSA) {
      // South America: use qualifiersBySeasonSA
      const activeQualsSA = qualifiersBySeasonSA[season];
      if (activeQualsSA) {
        if (activeQualsSA.cl[country]?.includes(teamName)) {
          europeanCup = "cl";
        } else if (activeQualsSA.uefa[country]?.includes(teamName)) {
          europeanCup = "uefa";
        }
      }

      if (europeanCup && activeQualsSA) {
        const rules = europeanCup === "cl" ? clibRules[season] : csudRules[season];

        if (rules) {
          const totalDomesticRounds = fixtures.length;
          const dynamicSchedules = generateDynamicSchedules(totalDomesticRounds, rules);
          calendar = [];
          for (let r = 1; r <= totalDomesticRounds; r++) {
            calendar.push({ type: "league", index: r });
          }
          const sortedSlots = [...dynamicSchedules].sort((a, b) => b.offset - a.offset);
          sortedSlots.forEach(slot => {
            if (slot.stage !== "final") {
              calendar.splice(slot.offset, 0, { type: "europe", stage: slot.stage, matchday: slot.matchday });
            }
          });
          sortedSlots.forEach(slot => {
            if (slot.stage === "final") {
              calendar.push({ type: "europe", stage: slot.stage, matchday: slot.matchday });
            }
          });

          if (rules.format === "group_then_knockout") {
            const clTeams = JSON.parse(JSON.stringify(rules.teamsData));
            let playerClTeam = clTeams.find(t => t.name === teamName);
            if (!playerClTeam) {
              const domesticNames = roster.map(t => t.name);
              let indexToReplace = clTeams.findIndex(t => domesticNames.includes(t.name) && t.name !== teamName);
              if (indexToReplace === -1) {
                const saQuals = activeQualsSA[europeanCup] || {};
                const mainPlayableTeams = [
                  ...(saQuals.argentina || []),
                  ...(saQuals.brazil || []),
                  ...(saQuals.colombia || [])
                ];
                indexToReplace = clTeams.findIndex(t => !mainPlayableTeams.includes(t.name));
                if (indexToReplace === -1) indexToReplace = clTeams.length - 1;
              }
              if (indexToReplace !== -1) {
                clTeams[indexToReplace].name = teamName;
                clTeams[indexToReplace].primaryColor = activeTeamObj.primaryColor;
                clTeams[indexToReplace].secondaryColor = activeTeamObj.secondaryColor;
                clTeams[indexToReplace].kit = activeTeamObj.kit;
                playerClTeam = clTeams[indexToReplace];
              }
            }

            const clFixtures = [];
            const groups = [...new Set(clTeams.map(t => t.group))].filter(g => g !== "bye" && g !== "champion").sort();
            const firstGroupTeams = clTeams.filter(t => t.group === groups[0]);
            const numMatchdays = firstGroupTeams.length === 5 ? 5 : 6;
            for (let m = 0; m < numMatchdays; m++) clFixtures.push([]);

            groups.forEach(g => {
              const gTeams = clTeams.filter(t => t.group === g);
              if (gTeams.length === 5) {
                const [t0, t1, t2, t3, t4] = gTeams.map(t => t.idnum);
                clFixtures[0].push({ homeId: t1, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[1].push({ homeId: t0, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[2].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[2].push({ homeId: t4, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[3].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[3].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[4].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[4].push({ homeId: t4, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
              } else {
                const [t0, t1, t2, t3] = gTeams.map(t => t.idnum);
                clFixtures[0].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[1].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[2].push({ homeId: t0, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[2].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[3].push({ homeId: t1, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[3].push({ homeId: t3, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[4].push({ homeId: t0, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[4].push({ homeId: t2, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[5].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
                clFixtures[5].push({ homeId: t1, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
              }
            });

            europeanCupState = {
              teams: clTeams,
              fixtures: clFixtures,
              europeanPlayerTeamId: playerClTeam ? playerClTeam.idnum : null,
              knockoutState: {
                roundOf32Leg1: null, roundOf32Leg2: null,
                roundOf16Leg1: null, roundOf16Leg2: null,
                quarterFinalsLeg1: null, quarterFinalsLeg2: null,
                semiFinalsLeg1: null, semiFinalsLeg2: null,
                final: null
              }
            };
          } else if (rules.format === "pure_knockout") {
            const teams = JSON.parse(JSON.stringify(rules.teamsData));
            let playerTeam = teams.find(t => t.name === teamName);
            if (!playerTeam) {
              const domesticNames = roster.map(t => t.name);
              let indexToReplace = teams.findIndex(t => domesticNames.includes(t.name) && t.name !== teamName);
              if (indexToReplace === -1) indexToReplace = teams.length - 1;
              teams[indexToReplace].name = teamName;
              teams[indexToReplace].primaryColor = activeTeamObj.primaryColor;
              teams[indexToReplace].secondaryColor = activeTeamObj.secondaryColor;
              teams[indexToReplace].kit = activeTeamObj.kit;
              playerTeam = teams[indexToReplace];
            }
            const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
            const firstStage = rules.stages[0];
            const firstLegKey = toCamelCase(firstStage) + "Leg1";
            const secondLegKey = toCamelCase(firstStage) + "Leg2";
            const leg1Fixtures = [];
            for (let i = 0; i < teams.length; i += 2) {
              leg1Fixtures.push({ homeId: teams[i].idnum, awayId: teams[i + 1].idnum, played: false, homeScore: 0, awayScore: 0 });
            }
            const leg2Fixtures = leg1Fixtures.map(m => ({ homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0 }));
            const knockoutState = { roundOf32Leg1: null, roundOf32Leg2: null, roundOf16Leg1: null, roundOf16Leg2: null, quarterFinalsLeg1: null, quarterFinalsLeg2: null, semiFinalsLeg1: null, semiFinalsLeg2: null, final: null };
            knockoutState[firstLegKey] = leg1Fixtures;
            knockoutState[secondLegKey] = leg2Fixtures;
            europeanCupState = { teams, europeanPlayerTeamId: playerTeam ? playerTeam.idnum : null, knockoutState };
          }
        }
      }
    } else {
      // European Cup Initialization (original logic)
      const activeQualifiers = qualifiersBySeason[season];

      if (activeQualifiers) {
        if (activeQualifiers.cl[country]?.includes(teamName)) {
          europeanCup = "cl";
        } else if (activeQualifiers.uefa[country]?.includes(teamName)) {
          europeanCup = "uefa";
        } else if (activeQualifiers.uecl?.[country]?.includes(teamName)) {
          europeanCup = "uecl";
        }
      }

      if (europeanCup && activeQualifiers) {
        const rules = europeanCup === "cl" ? clRules[season] : (europeanCup === "uefa" ? uefaRules[season] : ueclRules[season]);

        // Initialize Calendar
        const totalDomesticRounds = fixtures.length;
        const dynamicSchedules = generateDynamicSchedules(totalDomesticRounds, rules);
        calendar = [];
        for (let r = 1; r <= totalDomesticRounds; r++) {
          calendar.push({ type: "league", index: r });
        }

        // Dynamic calendar slots interleaving using descending order to splice correctly
        const sortedSlots = [...dynamicSchedules].sort((a, b) => b.offset - a.offset);
        sortedSlots.forEach(slot => {
          if (slot.stage !== "final") {
            calendar.splice(slot.offset, 0, { type: "europe", stage: slot.stage, matchday: slot.matchday });
          }
        });
        sortedSlots.forEach(slot => {
          if (slot.stage === "final") {
            calendar.push({ type: "europe", stage: slot.stage, matchday: slot.matchday });
          }
        });

        if (rules.format === "group_then_knockout") {
          // CL Group Stage setup (e.g. 1994 Champions League)
          const clTeams = JSON.parse(JSON.stringify(rules.teamsData));
          let playerClTeam = clTeams.find(t => t.name === teamName);
          if (!playerClTeam && activeQualifiers) {
            const domesticNames = roster.map(t => t.name);
            let indexToReplace = clTeams.findIndex(t => domesticNames.includes(t.name) && t.name !== teamName);
            if (indexToReplace === -1) {
              const cupQualifiers = activeQualifiers[europeanCup] || {};
              const mainPlayableClTeams = [
                ...(cupQualifiers.england || []),
                ...(cupQualifiers.spain || []),
                ...(cupQualifiers.germany || []),
                ...(cupQualifiers.italy || []),
                ...(cupQualifiers.france || []),
                ...(cupQualifiers.russia || []),
                ...(cupQualifiers.portugal || []),
                ...(cupQualifiers.netherlands || []),
                ...(cupQualifiers.scotland || []),
                ...(cupQualifiers.ukraine || [])
              ];
              indexToReplace = clTeams.findIndex(t => !mainPlayableClTeams.includes(t.name));
              if (indexToReplace === -1) {
                indexToReplace = clTeams.length - 1;
              }
            }
            if (indexToReplace !== -1) {
              clTeams[indexToReplace].name = teamName;
              clTeams[indexToReplace].primaryColor = activeTeamObj.primaryColor;
              clTeams[indexToReplace].secondaryColor = activeTeamObj.secondaryColor;
              clTeams[indexToReplace].kit = activeTeamObj.kit;
              playerClTeam = clTeams[indexToReplace];
            }
          }

          const clFixtures = [];
          const groups = [...new Set(clTeams.map(t => t.group))].sort();
          const firstGroupTeams = clTeams.filter(t => t.group === groups[0]);
          const numMatchdays = firstGroupTeams.length === 5 ? 5 : 6;
          for (let m = 0; m < numMatchdays; m++) clFixtures.push([]);

          groups.forEach(g => {
            const gTeams = clTeams.filter(t => t.group === g);
            if (gTeams.length === 5) {
              const t0 = gTeams[0].idnum;
              const t1 = gTeams[1].idnum;
              const t2 = gTeams[2].idnum;
              const t3 = gTeams[3].idnum;
              const t4 = gTeams[4].idnum;

              // Matchday 1
              clFixtures[0].push({ homeId: t1, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });

              // Matchday 2
              clFixtures[1].push({ homeId: t0, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });

              // Matchday 3
              clFixtures[2].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[2].push({ homeId: t4, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });

              // Matchday 4
              clFixtures[3].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[3].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });

              // Matchday 5
              clFixtures[4].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[4].push({ homeId: t4, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
            } else {
              const t0 = gTeams[0].idnum;
              const t1 = gTeams[1].idnum;
              const t2 = gTeams[2].idnum;
              const t3 = gTeams[3].idnum;

              // Matchday 1
              clFixtures[0].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
              // Matchday 2
              clFixtures[1].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
              // Matchday 3
              clFixtures[2].push({ homeId: t0, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[2].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
              // Matchday 4
              clFixtures[3].push({ homeId: t1, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[3].push({ homeId: t3, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
              // Matchday 5
              clFixtures[4].push({ homeId: t0, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[4].push({ homeId: t2, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
              // Matchday 6
              clFixtures[5].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
              clFixtures[5].push({ homeId: t1, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
            }
          });

          europeanCupState = {
            teams: clTeams,
            fixtures: clFixtures,
            europeanPlayerTeamId: playerClTeam ? playerClTeam.idnum : null,
            knockoutState: {
              roundOf32Leg1: null, roundOf32Leg2: null,
              roundOf16Leg1: null, roundOf16Leg2: null,
              quarterFinalsLeg1: null, quarterFinalsLeg2: null,
              semiFinalsLeg1: null, semiFinalsLeg2: null,
              final: null
            }
          };
        } else if (rules.format === "league_then_knockout") {
          // CL/EL/UECL 36-team single league setup
          const clTeams = JSON.parse(JSON.stringify(rules.teamsData));
          let playerClTeam = clTeams.find(t => t.name === teamName);
          if (!playerClTeam && activeQualifiers) {
            const domesticNames = roster.map(t => t.name);
            let indexToReplace = clTeams.findIndex(t => domesticNames.includes(t.name) && t.name !== teamName);
            if (indexToReplace === -1) {
              const cupQualifiers = activeQualifiers[europeanCup] || {};
              const mainPlayableClTeams = [
                ...(cupQualifiers.england || []),
                ...(cupQualifiers.spain || []),
                ...(cupQualifiers.germany || []),
                ...(cupQualifiers.italy || []),
                ...(cupQualifiers.france || []),
                ...(cupQualifiers.russia || []),
                ...(cupQualifiers.portugal || []),
                ...(cupQualifiers.netherlands || []),
                ...(cupQualifiers.scotland || []),
                ...(cupQualifiers.ukraine || [])
              ];
              indexToReplace = clTeams.findIndex(t => !mainPlayableClTeams.includes(t.name));
              if (indexToReplace === -1) {
                indexToReplace = clTeams.length - 1;
              }
            }
            if (indexToReplace !== -1) {
              clTeams[indexToReplace].name = teamName;
              clTeams[indexToReplace].primaryColor = activeTeamObj.primaryColor;
              clTeams[indexToReplace].secondaryColor = activeTeamObj.secondaryColor;
              clTeams[indexToReplace].kit = activeTeamObj.kit;
              playerClTeam = clTeams[indexToReplace];
            }
          }

          const clFixtures = [];
          const numTeams = clTeams.length; // 36
          const rounds = 8;

          const list = [...clTeams];
          for (let r = 0; r < rounds; r++) {
            const roundPairs = [];
            for (let i = 0; i < numTeams / 2; i++) {
              const home = list[i];
              const away = list[numTeams - 1 - i];

              // Alternate home/away to balance
              if (r % 2 === 0) {
                roundPairs.push({ homeId: home.idnum, awayId: away.idnum, played: false, homeScore: 0, awayScore: 0 });
              } else {
                roundPairs.push({ homeId: away.idnum, awayId: home.idnum, played: false, homeScore: 0, awayScore: 0 });
              }
            }
            clFixtures.push(roundPairs);
            list.splice(1, 0, list.pop());
          }

          europeanCupState = {
            teams: clTeams,
            fixtures: clFixtures,
            europeanPlayerTeamId: playerClTeam ? playerClTeam.idnum : null,
            knockoutState: {
              playoffsLeg1: null, playoffsLeg2: null,
              roundOf16Leg1: null, roundOf16Leg2: null,
              quarterFinalsLeg1: null, quarterFinalsLeg2: null,
              semiFinalsLeg1: null, semiFinalsLeg2: null,
              final: null
            }
          };
        } else if (rules.format === "pure_knockout") {
          // Pure Knockout format setup (e.g. 1990 CL, 1990 UEFA, 1994 UEFA)
          const teams = JSON.parse(JSON.stringify(rules.teamsData));
          let playerTeam = teams.find(t => t.name === teamName);
          if (!playerTeam && activeQualifiers) {
            const domesticNames = roster.map(t => t.name);
            let indexToReplace = teams.findIndex(t => domesticNames.includes(t.name) && t.name !== teamName);
            if (indexToReplace === -1) {
              const activeQualifiersUefa = activeQualifiers.uefa || {};
              const activeQualifiersCl = activeQualifiers.cl || {};
              const mainPlayableTeams = [
                ...(activeQualifiersUefa.england || activeQualifiersCl.england || []),
                ...(activeQualifiersUefa.spain || activeQualifiersCl.spain || []),
                ...(activeQualifiersUefa.germany || activeQualifiersCl.germany || []),
                ...(activeQualifiersUefa.italy || activeQualifiersCl.italy || []),
                ...(activeQualifiersUefa.france || activeQualifiersCl.france || []),
                ...(activeQualifiersUefa.russia || activeQualifiersCl.russia || []),
                ...(activeQualifiersUefa.portugal || activeQualifiersCl.portugal || []),
                ...(activeQualifiersUefa.netherlands || activeQualifiersCl.netherlands || []),
                ...(activeQualifiersUefa.scotland || activeQualifiersCl.scotland || []),
                ...(activeQualifiersUefa.ukraine || activeQualifiersCl.ukraine || [])
              ];
              indexToReplace = teams.findIndex(t => !mainPlayableTeams.includes(t.name));
              if (indexToReplace === -1) {
                indexToReplace = teams.length - 1;
              }
            }
            if (indexToReplace !== -1) {
              teams[indexToReplace].name = teamName;
              teams[indexToReplace].primaryColor = activeTeamObj.primaryColor;
              teams[indexToReplace].secondaryColor = activeTeamObj.secondaryColor;
              teams[indexToReplace].kit = activeTeamObj.kit;
              playerTeam = teams[indexToReplace];
            }
          }

          const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
          const firstStage = rules.stages[0]; // e.g. "round_of_32" or "quarter_finals"
          const firstLegKey = toCamelCase(firstStage) + "Leg1";
          const secondLegKey = toCamelCase(firstStage) + "Leg2";

          const leg1Fixtures = [];
          for (let i = 0; i < teams.length; i += 2) {
            leg1Fixtures.push({
              homeId: teams[i].idnum,
              awayId: teams[i + 1].idnum,
              played: false,
              homeScore: 0,
              awayScore: 0
            });
          }
          const leg2Fixtures = leg1Fixtures.map(m => ({
            homeId: m.awayId,
            awayId: m.homeId,
            played: false,
            homeScore: 0,
            awayScore: 0
          }));

          const knockoutState = {
            roundOf32Leg1: null, roundOf32Leg2: null,
            roundOf16Leg1: null, roundOf16Leg2: null,
            quarterFinalsLeg1: null, quarterFinalsLeg2: null,
            semiFinalsLeg1: null, semiFinalsLeg2: null,
            final: null
          };
          knockoutState[firstLegKey] = leg1Fixtures;
          knockoutState[secondLegKey] = leg2Fixtures;

          europeanCupState = {
            teams: teams,
            europeanPlayerTeamId: playerTeam ? playerTeam.idnum : null,
            knockoutState
          };
        }
      } // end if (europeanCup && activeQualifiers)
    } // end else (European Cup)

    const totalDomesticRounds = fixtures.length;
    if (!calendar) {
      calendar = [];
      for (let r = 1; r <= totalDomesticRounds; r++) {
        calendar.push({ type: "league", index: r });
      }
    }

    const rawDiv1 = (leagueDataMap[season] && leagueDataMap[season][country]) || roster;
    const rawDiv2 = (leagueDataMapD2[season] && leagueDataMapD2[season][country]) || [];
    const div1Roster = rawDiv1.map(t => {
      const sq = seasonRosters ? findSquadForTeam(seasonRosters, t.name) : null;
      const comp = sq ? calculateSquadTacticalAverages(sq) : null;
      return {
        ...t,
        attack: comp ? comp.attack : scaleStatTo10(t.attack),
        midfield: comp ? comp.midfield : scaleStatTo10(t.midfield),
        defense: comp ? comp.defense : scaleStatTo10(t.defense),
        division: 1
      };
    });
    const div2Roster = rawDiv2.map(t => {
      const sq = seasonRosters ? findSquadForTeam(seasonRosters, t.name) : null;
      const comp = sq ? calculateSquadTacticalAverages(sq) : null;
      return {
        ...t,
        attack: comp ? comp.attack : scaleStatTo10(t.attack),
        midfield: comp ? comp.midfield : scaleStatTo10(t.midfield),
        defense: comp ? comp.defense : scaleStatTo10(t.defense),
        division: 2
      };
    });
    const fullRoster = [...div1Roster, ...div2Roster];
    const domesticCupState = createDomesticCup(fullRoster, totalDomesticRounds, country, selectedTeamId);
    const pTeam = roster.find(t => t.idnum === selectedTeamId);
    const domesticCupExpectation = getDomesticCupExpectation(pTeam || {}, domesticCupState.bracketSize);

    if (domesticCupState.calendarSchedules) {
      const domSlots = [...domesticCupState.calendarSchedules].sort((a, b) => b.offset - a.offset);
      domSlots.forEach(slot => {
        if (slot.stage !== "final") {
          calendar.splice(slot.offset, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
        } else {
          const finalIdx = Math.max(1, calendar.length - 1);
          calendar.splice(finalIdx, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
        }
      });
    }

    const leagueState = {
      season: `${season}/${String((parseInt(season) + 1) % 100).padStart(2, '0')}`,
      country: country,
      region: isSA ? "south_america" : "europe",
      playerTeamId: selectedTeamId,
      managerName: managerName || "Manager",
      boardExpectation: expObj,
      domesticCupExpectation,
      domesticCupState,
      currentRound: 1, // Start at round 1
      teams: roster,
      fixtures,
      europeanCup,
      europeanCupState,
      calendar,
      calendarIndex,
      fanConfidence: 50,
      aperturaChampion: null,
      clausuraChampion: null,
      division: division,
      budget: window.lastFetchedStartingBudget || 10.0,
      payrollBudget: startingPayrollBudget || undefined,
      weeklyWageCap: startingWageCap || undefined,
      lastTransferWindow: ""
    };

    localStorage.setItem("retro_player_formation", startingFormation);
    localStorage.setItem(`retro_formation_${activeTeamObj.name}_${leagueState.season}`, startingFormation);
    localStorage.removeItem("retro_manager_profile");
    localStorage.setItem("retro_league_career", JSON.stringify(leagueState));
    applyTeamTheme(leagueState.teams?.find(t => t.idnum === leagueState.playerTeamId));
    setIsStarting(false);
    navigate("/league/dashboard");
  };

  // Generate Year Array (1989/90 to 2025/26)
  const seasonsList = [];
  for (let y = 1989; y <= 2025; y++) {
    seasonsList.push(`${y}`);
  }

  const activeRegionLeagues = (regionTab === "europe" ? EUROPE_LEAGUES : SOUTH_AMERICA_LEAGUES).filter((league) =>
    regionTab === "europe" ? Boolean(leagueDataMap?.[season]?.[league.id]) : Boolean(leagueDataMapSA?.[season]?.[league.id])
  );

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="Match team-select-container">

      {/* STEP 1: Season Year Selector (1989/90 - 2025/26) */}
      {step === "season" && (
        <div className="animated-slide-in" style={{ width: '100%', maxWidth: '880px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="matchheader selector-header">
            <h1 className="glowing-header-text">CHOOSE SEASON</h1>
            <p className="lobby-subtitle">SELECT STARTING CAMPAIGN YEAR (1989/90 – 2025/26)</p>
          </div>

          <div className="team-select-card" style={{ width: '100%', padding: '26px', maxWidth: '880px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(122px, 1fr))',
              gap: '10px',
              width: '100%',
              marginBottom: '22px'
            }}>
              {seasonsList.map((yr) => {
                const isSelected = season === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    className={`team-select-mini-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectSeason(yr)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 8px',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid #00ff6a' : '1px solid rgba(255, 255, 255, 0.14)',
                      background: isSelected ? 'rgba(0, 255, 106, 0.14)' : 'rgba(10, 22, 13, 0.78)',
                      color: isSelected ? '#00ff6a' : '#e6f2ea',
                      boxShadow: isSelected ? '0 0 14px rgba(0, 255, 106, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px' }}>
                      {formatSeasonLabel(yr)}
                    </span>
                    <span style={{ fontSize: '10px', color: isSelected ? '#9effc5' : '#8ea395', marginTop: '3px' }}>
                      {parseInt(yr, 10) < 2000 ? '90s Era' : parseInt(yr, 10) < 2010 ? '2000s Era' : parseInt(yr, 10) < 2020 ? '2010s Era' : 'Modern Era'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '10px 0 16px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
              <span style={{ padding: '0 12px', fontSize: '9px', color: '#888', letterSpacing: '1px', fontWeight: 'bold' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <button
                onClick={() => document.getElementById("select-import-save-input").click()}
                className="glowing-btn"
                style={{
                  width: '100%',
                  maxWidth: '380px',
                  padding: '12px',
                  fontSize: '12px',
                  borderColor: '#ffc107',
                  color: '#ffc107',
                  background: 'rgba(255, 193, 7, 0.05)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontWeight: 'bold',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  letterSpacing: '1px',
                  transition: 'all 0.3s ease',
                  border: '1.5px solid #ffc107',
                  boxShadow: '0 0 10px rgba(255, 193, 7, 0.1)'
                }}
                title="Import career save from a JSON file"
                onMouseEnter={(e) => {
                  e.target.style.background = '#ffc107';
                  e.target.style.color = '#050c06';
                  e.target.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 193, 7, 0.05)';
                  e.target.style.color = '#ffc107';
                  e.target.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.1)';
                }}
              >
                📂 IMPORT SAVE GAME
              </button>
              <input
                type="file"
                id="select-import-save-input"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportSave}
              />
            </div>
          </div>

          <div style={{ marginTop: '6px' }}>
            <button className="back-home-btn" onClick={() => navigate("/")}>➔ RETURN TO CABINET</button>
          </div>
        </div>
      )}

      {/* STEP 2: League / Region Selector (Europe & South America Tabs) */}
      {step === "league" && (
        <div className="animated-slide-in" style={{ width: '100%', maxWidth: '880px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="matchheader selector-header">
            <h1 className="glowing-header-text">CHOOSE LEAGUE</h1>
            <p className="lobby-subtitle">SEASON {formatSeasonLabel(season)} — SELECT COUNTRY &amp; COMPETITION</p>
          </div>

          {/* Region Tabs: Europe / South America */}
          <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '460px' }}>
            <button
              type="button"
              onClick={() => setRegionTab("europe")}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '10px',
                cursor: 'pointer',
                border: regionTab === "europe" ? '1.5px solid #00ff6a' : '1px solid rgba(255, 255, 255, 0.15)',
                background: regionTab === "europe" ? 'rgba(0, 255, 106, 0.18)' : 'rgba(10, 22, 13, 0.78)',
                color: regionTab === "europe" ? '#00ff6a' : '#9fb3a5',
                boxShadow: regionTab === "europe" ? '0 0 14px rgba(0, 255, 106, 0.25)' : 'none',
                transition: 'all 0.2s ease',
                letterSpacing: '0.8px'
              }}
            >
              EUROPE
            </button>
            <button
              type="button"
              onClick={() => setRegionTab("south_america")}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontFamily: 'Orbitron, sans-serif',
                fontSize: '13px',
                fontWeight: 'bold',
                borderRadius: '10px',
                cursor: 'pointer',
                border: regionTab === "south_america" ? '1.5px solid #ffc107' : '1px solid rgba(255, 255, 255, 0.15)',
                background: regionTab === "south_america" ? 'rgba(255, 193, 7, 0.18)' : 'rgba(10, 22, 13, 0.78)',
                color: regionTab === "south_america" ? '#ffc107' : '#9fb3a5',
                boxShadow: regionTab === "south_america" ? '0 0 14px rgba(255, 193, 7, 0.25)' : 'none',
                transition: 'all 0.2s ease',
                letterSpacing: '0.8px'
              }}
            >
              SOUTH AMERICA
            </button>
          </div>

          <div className="team-select-card" style={{ width: '100%', padding: '26px', maxWidth: '880px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
              gap: '14px',
              width: '100%'
            }}>
              {activeRegionLeagues.map((league) => {
                const isSelected = country === league.id;
                const clubsCount = regionTab === "europe"
                  ? (leagueDataMap?.[season]?.[league.id]?.length || 0)
                  : (leagueDataMapSA?.[season]?.[league.id]?.length || 0);
                const hasDiv2 = regionTab === "europe" && Boolean(leagueDataMapD2?.[season]?.[league.id]?.length);
                return (
                  <button
                    key={league.id}
                    type="button"
                    className={`team-select-mini-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectLeague(league.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      padding: '18px 12px',
                      cursor: 'pointer',
                      borderRadius: '12px',
                      border: isSelected ? '1.5px solid #00ff6a' : '1px solid rgba(255, 255, 255, 0.14)',
                      background: isSelected ? 'rgba(0, 255, 106, 0.14)' : 'rgba(10, 22, 13, 0.78)',
                      color: '#fff',
                      boxShadow: isSelected ? '0 0 16px rgba(0, 255, 106, 0.22)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <CountryFlag country={league.id} size={56} style={{ border: '1.5px solid rgba(255, 255, 255, 0.25)', borderRadius: '6px' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                        {league.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9effc5', marginTop: '3px' }}>
                        {league.getTitle(season)}
                      </div>
                      <div style={{ fontSize: '10px', color: '#8ea395', marginTop: '4px' }}>
                        {clubsCount} clubs{hasDiv2 ? ' • D1 & D2' : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '6px' }}>
            <button className="back-home-btn" onClick={() => setStep("season")}>➔ BACK TO SEASONS</button>
          </div>
        </div>
      )}

      {/* STEP 3: Team Selection Screen */}
      {step === "teams" && (
        <div className="animated-slide-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="matchheader selector-header">
            <h1 className="glowing-header-text">CHOOSE YOUR SQUAD</h1>
            <p className="lobby-subtitle">{cap(country)} {formatSeasonLabel(season)} - {division === 2 ? 'Second Division' : 'First Division'} League Campaign</p>
          </div>

          {hasD2 && (
            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '450px' }}>
              <button
                className={`play-match-btn ${division === 1 ? 'glowing-btn' : ''}`}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: division === 1 ? 'rgba(0, 255, 100, 0.1)' : 'rgba(0,0,0,0.5)',
                  border: division === 1 ? '1.5px solid #00ff64' : '1px solid rgba(255,255,255,0.1)',
                  color: division === 1 ? '#00ff64' : '#aaa',
                  fontFamily: 'Orbitron, sans-serif'
                }}
                onClick={() => { setDivision(1); setSelectedTeamId(null); }}
              >
                DIVISION 1
              </button>
              <button
                className={`play-match-btn ${division === 2 ? 'glowing-btn' : ''}`}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  fontSize: '12px',
                  background: division === 2 ? 'rgba(0, 255, 100, 0.1)' : 'rgba(0,0,0,0.5)',
                  border: division === 2 ? '1.5px solid #00ff64' : '1px solid rgba(255,255,255,0.1)',
                  color: division === 2 ? '#00ff64' : '#aaa',
                  fontFamily: 'Orbitron, sans-serif'
                }}
                onClick={() => { setDivision(2); setSelectedTeamId(null); }}
              >
                DIVISION 2
              </button>
            </div>
          )}

          <div className="selection-deck" style={{ flexWrap: 'wrap', gap: '25px', maxWidth: '1100px' }}>

            {/* Grid of 22 Teams scrollbox */}
            <div className="teams-grid-scroll-box" style={{
              flexGrow: 1,
              height: '450px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
              paddingRight: '10px'
            }}>
              {roster.map((team) => (
                <div
                  key={team.idnum}
                  className={`team-select-mini-card ${selectedTeamId === team.idnum ? 'selected-mini-card' : ''}`}
                  onClick={() => setSelectedTeamId(team.idnum)}
                  style={{
                    background: selectedTeamId === team.idnum ? 'rgba(0,255,100,0.06)' : 'rgba(0,0,0,0.4)',
                    border: selectedTeamId === team.idnum ? '2px solid #00ff64' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={55} />
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff', textAlign: 'center' }}>{team.name}</span>
                </div>
              ))}
            </div>

            {/* Team details side board */}
            <div className="team-select-card" style={{ width: '300px', minHeight: '450px', flexShrink: 0 }}>
              <h2>TEAM OVERVIEW</h2>
              {activeTeamObj ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '12px' }}>
                  <TeamFlag primaryColor={activeTeamObj.primaryColor} secondaryColor={activeTeamObj.secondaryColor} size={110} />
                  <h3 style={{ margin: '0', color: '#fff', fontSize: '16px', textAlign: 'center' }}>{activeTeamObj.name}</h3>

                  <div className="stats-box" style={{ width: '90%', padding: '8px 12px' }}>
                    <div className="stat-row">
                      <span className="stat-label">Attack</span>
                      <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${Math.min(100, (activeTeamObj.attack / 10) * 100)}%` }}></div></div>
                      <span className="stat-val">{activeTeamObj.attack}/10</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Midfield</span>
                      <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${Math.min(100, (activeTeamObj.midfield / 10) * 100)}%` }}></div></div>
                      <span className="stat-val">{activeTeamObj.midfield}/10</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Defense</span>
                      <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${Math.min(100, (activeTeamObj.defense / 10) * 100)}%` }}></div></div>
                      <span className="stat-val">{activeTeamObj.defense}/10</span>
                    </div>
                  </div>

                  {/* Authentic CM Finances & Stadium */}
                  {activeDetails && activeDetails.finances && (
                    <div style={{
                      width: '90%',
                      padding: '8px 12px',
                      background: 'rgba(0, 229, 255, 0.05)',
                      border: '1px solid rgba(0, 229, 255, 0.2)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      fontSize: '11px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                        <span>Transfer Budget:</span>
                        <span style={{ color: '#00ff64', fontWeight: 'bold' }}>
                          £{activeDetails.finances.transferBudget}M
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc' }}>
                        <span>Weekly Wage Cap:</span>
                        <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>
                          £{activeDetails.finances.weeklyWageCap?.toLocaleString()}/wk
                        </span>
                      </div>
                      {activeDetails.stadium && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '10px' }}>
                          <span>Stadium:</span>
                          <span>{activeDetails.stadium.name} ({activeDetails.stadium.capacity?.toLocaleString()})</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manager Name Input */}
                  <div style={{ width: '90%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#00ff64', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>Manager Name</label>
                    <input
                      type="text"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(0,255,100,0.2)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#fff',
                        fontSize: '13px',
                        width: '100%',
                        outline: 'none',
                        textAlign: 'center'
                      }}
                      maxLength={20}
                    />
                  </div>

                  {/* Board Expectation */}
                  <div style={{
                    width: '90%',
                    padding: '8px 12px',
                    background: 'rgba(0,255,100,0.03)',
                    border: '1px solid rgba(0,255,100,0.15)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Board Expectation</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00ff64' }}>{getExpectation(activeTeamObj, roster)?.text}</span>
                    <span style={{ fontSize: '10px', color: '#aaa' }}>Goal: {getExpectation(activeTeamObj, roster)?.desc}</span>
                  </div>

                  <button
                    className="play-match-btn glowing-btn"
                    style={{ fontSize: '13px', padding: '10px 20px', width: '90%', marginTop: '5px', opacity: isStarting ? 0.6 : 1, cursor: isStarting ? 'not-allowed' : 'pointer' }}
                    onClick={handleStartCareer}
                    disabled={isStarting}
                  >
                    {isStarting ? "SETTING UP BOARD ROOM..." : "CONFIRM & START LOBBY"}
                  </button>
                </div>
              ) : (
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '14px', textAlign: 'center' }}>
                  Select one of the {roster.length} clubs to view historical statistics and kits.
                </div>
              )}
            </div>

          </div>

          <div style={{ marginTop: '20px' }}>
            <button className="back-home-btn" onClick={() => setStep("league")}>➔ BACK TO LEAGUES</button>
          </div>
        </div>
      )}

    </div>
  );
}
