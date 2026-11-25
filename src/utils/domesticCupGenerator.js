// src/utils/domesticCupGenerator.js

/**
 * Returns realistic domestic cup names for various countries.
 */
export const getCupNameByCountry = (country = "") => {
  const c = country.toLowerCase();
  switch (c) {
    case "england":
      return "FA Cup";
    case "spain":
      return "Copa del Rey";
    case "germany":
      return "DFB-Pokal";
    case "italy":
      return "Coppa Italia";
    case "france":
      return "Coupe de France";
    case "portugal":
      return "Taça de Portugal";
    case "netherlands":
      return "KNVB Cup";
    case "brazil":
      return "Copa do Brasil";
    case "argentina":
      return "Copa Argentina";
    case "colombia":
      return "Copa Colombia";
    case "russia":
      return "Russian Cup";
    case "turkey":
      return "Turkish Cup";
    case "scotland":
      return "Scottish Cup";
    case "belgium":
      return "Belgian Cup";
    case "sweden":
      return "Svenska Cupen";
    case "denmark":
      return "Danish Cup";
    case "mexico":
      return "Copa MX";
    case "usa":
      return "U.S. Open Cup";
    default:
      return `${country ? country.charAt(0).toUpperCase() + country.slice(1) : "Domestic"} Cup`;
  }
};

/**
 * Helper to shuffle array (Fisher-Yates)
 */
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Stage labels for UI display
 */
export const CUP_STAGE_NAMES = {
  round_of_32: "Round of 32",
  round_of_16: "Round of 16",
  quarter_finals: "Quarter-Finals",
  semi_finals: "Semi-Finals",
  final: "Domestic Cup Final"
};

/**
 * Generate a dynamic Domestic Cup state for a season.
 * @param {Array} countryRoster - All teams in the country/season (Div 1 + Div 2 if available)
 * @param {number} totalLeagueRounds - Total number of league matchdays (e.g. 38 or 30)
 * @param {string} country - Country key
 */
export const createDomesticCup = (countryRoster = [], totalLeagueRounds = 38, country = "", playerTeamId = null) => {
  const cupName = getCupNameByCountry(country);
  const totalTeamsAvailable = countryRoster.length;

  // Decide bracket size: 32 if 24+ teams available, otherwise 16
  const bracketSize = totalTeamsAvailable >= 24 ? 32 : 16;
  const stages = bracketSize === 32 
    ? ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"]
    : ["round_of_16", "quarter_finals", "semi_finals", "final"];

  // Select teams for the cup
  let selectedTeams = [...countryRoster];

  // If we have more teams than bracket size, pick top Div 1 teams first, then fill/sample rest
  if (selectedTeams.length > bracketSize) {
    const playerTeamObj = selectedTeams.find(t => t.idnum === playerTeamId);
    const otherTeams = selectedTeams.filter(t => t.idnum !== playerTeamId);

    // Separate div 1 and div 2 if division property exists
    const div1Teams = otherTeams.filter(t => t.division === 1);
    const div2Teams = otherTeams.filter(t => t.division === 2);
    
    let poolToSample = otherTeams;
    const neededFromPool = bracketSize - (playerTeamObj ? 1 : 0);

    if (div1Teams.length > 0) {
      if (div1Teams.length >= neededFromPool) {
        poolToSample = div1Teams;
      } else {
        const remainingDiv2Needed = neededFromPool - div1Teams.length;
        poolToSample = [...div1Teams, ...shuffleArray(div2Teams).slice(0, remainingDiv2Needed)];
      }
    }

    const sampledOthers = shuffleArray(poolToSample).slice(0, neededFromPool);
    selectedTeams = playerTeamObj ? [playerTeamObj, ...sampledOthers] : sampledOthers;
  }

  // If fewer teams than bracket size (e.g. 10 or 12 teams for 16 bracket), duplicate top teams or pad
  while (selectedTeams.length < bracketSize) {
    const extra = countryRoster[selectedTeams.length % countryRoster.length];
    selectedTeams.push({
      ...extra,
      idnum: extra.idnum + 10000 + selectedTeams.length,
      name: `${extra.name} B`
    });
  }

  // Shuffle teams for initial round matchups
  const shuffled = shuffleArray(selectedTeams);
  const firstStage = stages[0];
  const firstStageName = CUP_STAGE_NAMES[firstStage];
  
  const initialMatches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    initialMatches.push({
      id: `cup_${firstStage}_${i/2}`,
      homeId: shuffled[i].idnum,
      awayId: shuffled[i + 1].idnum,
      homeName: shuffled[i].name,
      awayName: shuffled[i + 1].name,
      played: false,
      homeScore: 0,
      awayScore: 0,
      penaltyHomeScore: null,
      penaltyAwayScore: null,
      stageName: firstStageName
    });
  }

  // Calculate mid-week calendar offsets spaced out across the season
  // e.g. for 38 rounds and 5 stages: round 4, 12, 20, 28, 36
  const numStages = stages.length;
  const step = Math.floor((totalLeagueRounds - 4) / numStages);
  const calendarSchedules = stages.map((stg, index) => {
    const offset = Math.min(totalLeagueRounds - 1, Math.max(3, 4 + index * step));
    return {
      offset,
      stage: stg,
      stageName: CUP_STAGE_NAMES[stg],
      isDomesticCup: true
    };
  });

  return {
    cupName,
    bracketSize,
    participatingTeams: selectedTeams,
    stages,
    currentStageIndex: 0,
    stage: firstStage,
    knockoutState: {
      [firstStage]: initialMatches
    },
    calendarSchedules,
    isCompleted: false,
    winner: null
  };
};

/**
 * Advances the domestic cup to the next stage when all matches in current stage are completed.
 */
export const advanceDomesticCup = (cupState) => {
  if (!cupState || cupState.isCompleted) return cupState;

  const currentStage = cupState.stages[cupState.currentStageIndex];
  const currentMatches = cupState.knockoutState[currentStage] || [];

  // Check if all matches in current stage are finished
  const allPlayed = currentMatches.every(m => m.played);
  if (!allPlayed) return cupState;

  // Determine winners
  const winners = currentMatches.map(m => {
    const totalHome = m.homeScore + (m.penaltyHomeScore || 0);
    const totalAway = m.awayScore + (m.penaltyAwayScore || 0);
    return totalHome > totalAway ? m.homeId : m.awayId;
  });

  // If this was the Final
  if (currentStage === "final") {
    const winningTeamId = winners[0];
    const winningTeam = cupState.participatingTeams.find(t => t.idnum === winningTeamId);
    return {
      ...cupState,
      isCompleted: true,
      winnerId: winningTeamId,
      winnerName: winningTeam ? winningTeam.name : "Cup Champion"
    };
  }

  // Otherwise, create next round matches
  const nextStageIndex = cupState.currentStageIndex + 1;
  const nextStage = cupState.stages[nextStageIndex];
  const nextStageName = CUP_STAGE_NAMES[nextStage];

  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    const homeTeam = cupState.participatingTeams.find(t => t.idnum === winners[i]);
    const awayTeam = cupState.participatingTeams.find(t => t.idnum === winners[i + 1]);
    nextMatches.push({
      id: `cup_${nextStage}_${i/2}`,
      homeId: winners[i],
      awayId: winners[i + 1],
      homeName: homeTeam ? homeTeam.name : `Team ${winners[i]}`,
      awayName: awayTeam ? awayTeam.name : `Team ${winners[i+1]}`,
      played: false,
      homeScore: 0,
      awayScore: 0,
      penaltyHomeScore: null,
      penaltyAwayScore: null,
      stageName: nextStageName
    });
  }

  return {
    ...cupState,
    currentStageIndex: nextStageIndex,
    stage: nextStage,
    knockoutState: {
      ...cupState.knockoutState,
      [nextStage]: nextMatches
    }
  };
};

/**
 * Returns Board Expectation for the Domestic Cup based on team strength
 */
export const getDomesticCupExpectation = (team = {}, bracketSize = 32) => {
  const ratingSum = (team.attack || 2) + (team.midfield || 2) + (team.defense || 2);

  if (ratingSum >= 13) {
    return {
      text: "Win the Cup",
      targetStage: "final",
      desc: "Target: Win Domestic Cup Trophy"
    };
  } else if (ratingSum >= 10) {
    return {
      text: "Reach Semi-Finals",
      targetStage: "semi_finals",
      desc: "Target: Reach Domestic Cup Semi-Finals"
    };
  } else if (ratingSum >= 7) {
    return {
      text: "Reach Quarter-Finals",
      targetStage: "quarter_finals",
      desc: "Target: Reach Domestic Cup Quarter-Finals"
    };
  } else {
    return {
      text: "Competitive Cup Run",
      targetStage: bracketSize === 32 ? "round_of_16" : "quarter_finals",
      desc: "Target: Give a strong performance in early rounds"
    };
  }
};
