// src/utils/awardsManager.js
// Complete Engine for Goalscorers, Assists, Monthly Awards & Yearly Awards

import { getPrebuiltRosterSync } from '../data/rosters/rosterRegistry';

/**
 * Get dynamic month schedule based on total league rounds
 */
export const getMonthSchedule = (totalRounds, country) => {
  const isSouthAmerica = country && ["argentina", "brazil", "colombia"].includes(country.toLowerCase());
  
  if (isSouthAmerica) {
    if (totalRounds >= 38) {
      return [
        { name: "February", startRound: 1, endRound: 4 },
        { name: "March", startRound: 5, endRound: 8 },
        { name: "April", startRound: 9, endRound: 12 },
        { name: "May", startRound: 13, endRound: 17 },
        { name: "June/July", startRound: 18, endRound: 21 },
        { name: "August", startRound: 22, endRound: 25 },
        { name: "September", startRound: 26, endRound: 29 },
        { name: "October", startRound: 30, endRound: 33 },
        { name: "November/December", startRound: 34, endRound: totalRounds }
      ];
    }
    // Generic dynamic blocks for South America
    return generateDynamicMonthBlocks(totalRounds, ["February", "March", "April", "May", "June", "August", "September", "October", "November"]);
  }

  // European Calendar
  if (totalRounds >= 38) {
    return [
      { name: "August", startRound: 1, endRound: 4 },
      { name: "September", startRound: 5, endRound: 8 },
      { name: "October", startRound: 9, endRound: 12 },
      { name: "November", startRound: 13, endRound: 16 },
      { name: "December", startRound: 17, endRound: 21 },
      { name: "January/February", startRound: 22, endRound: 25 },
      { name: "March", startRound: 26, endRound: 29 },
      { name: "April", startRound: 30, endRound: 33 },
      { name: "May", startRound: 34, endRound: totalRounds }
    ];
  } else if (totalRounds >= 34) {
    return [
      { name: "August", startRound: 1, endRound: 4 },
      { name: "September", startRound: 5, endRound: 8 },
      { name: "October", startRound: 9, endRound: 12 },
      { name: "November", startRound: 13, endRound: 16 },
      { name: "December", startRound: 17, endRound: 20 },
      { name: "February", startRound: 21, endRound: 24 },
      { name: "March", startRound: 25, endRound: 28 },
      { name: "April/May", startRound: 29, endRound: totalRounds }
    ];
  } else if (totalRounds >= 30) {
    // 30 Rounds (e.g. Russia - Winter break in Dec/Jan/Feb)
    return [
      { name: "August", startRound: 1, endRound: 4 },
      { name: "September", startRound: 5, endRound: 8 },
      { name: "October", startRound: 9, endRound: 12 },
      { name: "November", startRound: 13, endRound: 16 },
      { name: "March", startRound: 17, endRound: 20 },
      { name: "April", startRound: 21, endRound: 25 },
      { name: "May", startRound: 26, endRound: totalRounds }
    ];
  } else {
    return generateDynamicMonthBlocks(totalRounds, ["August", "September", "October", "November", "February", "March", "April", "May"]);
  }
};

const generateDynamicMonthBlocks = (totalRounds, monthNames) => {
  const schedule = [];
  let curr = 1;
  let mIdx = 0;
  while (curr <= totalRounds) {
    const isNearEnd = curr + 4 >= totalRounds - 1;
    const end = isNearEnd ? totalRounds : (curr + 3);
    const mName = monthNames[mIdx] || `Month ${mIdx + 1}`;
    schedule.push({ name: mName, startRound: curr, endRound: end });
    curr = end + 1;
    mIdx++;
  }
  return schedule;
};

/**
 * Check if the completed round marks the end of a monthly awards cycle
 */
export const checkMonthConclusion = (round, totalRounds, country) => {
  if (!round || !totalRounds) return { isMonthEnd: false };
  const schedule = getMonthSchedule(totalRounds, country);
  const matched = schedule.find(m => m.endRound === round);
  if (matched) {
    return {
      isMonthEnd: true,
      monthName: matched.name,
      startRound: matched.startRound,
      endRound: matched.endRound
    };
  }
  return { isMonthEnd: false };
};

/**
 * Retrieve team squad roster (from storage or sync registry)
 */
export const getSquadForTeam = (teamName, season) => {
  if (!teamName) return [];
  try {
    const raw = localStorage.getItem(`retro_roster_${teamName}_${season}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const prebuilt = getPrebuiltRosterSync(teamName, season);
    if (Array.isArray(prebuilt) && prebuilt.length > 0) return prebuilt;
  } catch (err) {
    console.warn("[awardsManager] Could not load squad for", teamName, err);
  }

  // Generic fallback if squad data missing
  const genericPositions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "FW", "FW", "DF", "MF", "FW"];
  return genericPositions.map((pos, idx) => ({
    name: `${teamName} Player ${idx + 1}`,
    position: pos,
    rating: 3
  }));
};

/**
 * Pick goalscorer and assister based on player position and rating
 */
const pickScorerAndAssister = (squad, teamName) => {
  if (!squad || squad.length === 0) {
    return {
      scorer: { name: `${teamName} Striker`, position: "FW", team: teamName },
      assister: null
    };
  }

  // Weight scorers: Forwards heavy, Midfielders medium, Defenders rare, Goalkeepers never
  const scorerCandidates = squad.filter(p => p.position !== "GK");
  const scorerWeights = scorerCandidates.map(p => {
    const pos = (p.position || "FW").toUpperCase();
    const r = p.rating || 3;
    let base = 1;
    if (pos.includes("FW") || pos.includes("CF") || pos.includes("ST")) base = 6;
    else if (pos.includes("MF") || pos.includes("AM") || pos.includes("LM") || pos.includes("RM") || pos.includes("CM")) base = 2.5;
    else if (pos.includes("DF") || pos.includes("CB") || pos.includes("LB") || pos.includes("RB")) base = 0.6;
    return Math.max(0.1, base * r);
  });

  const totalScorerWeight = scorerWeights.reduce((a, b) => a + b, 0);
  let randScorer = Math.random() * totalScorerWeight;
  let scorer = scorerCandidates[0];
  for (let i = 0; i < scorerCandidates.length; i++) {
    randScorer -= scorerWeights[i];
    if (randScorer <= 0) {
      scorer = scorerCandidates[i];
      break;
    }
  }

  // 70% chance of an assist from a different player
  let assister = null;
  if (Math.random() < 0.72) {
    const assistCandidates = squad.filter(p => p.name !== scorer.name && p.position !== "GK");
    if (assistCandidates.length > 0) {
      const assistWeights = assistCandidates.map(p => {
        const pos = (p.position || "MF").toUpperCase();
        const r = p.rating || 3;
        let base = 1;
        if (pos.includes("MF") || pos.includes("AM") || pos.includes("LM") || pos.includes("RM") || pos.includes("CM") || pos.includes("W")) base = 5.5;
        else if (pos.includes("FW") || pos.includes("CF") || pos.includes("ST")) base = 2.5;
        else if (pos.includes("DF") || pos.includes("LB") || pos.includes("RB")) base = 1.8;
        return Math.max(0.1, base * r);
      });
      const totalAssistWeight = assistWeights.reduce((a, b) => a + b, 0);
      let randAssist = Math.random() * totalAssistWeight;
      for (let i = 0; i < assistCandidates.length; i++) {
        randAssist -= assistWeights[i];
        if (randAssist <= 0) {
          assister = assistCandidates[i];
          break;
        }
      }
    }
  }

  return {
    scorer: { name: scorer.name, position: scorer.position, team: teamName },
    assister: assister ? { name: assister.name, position: assister.position, team: teamName } : null
  };
};

/**
 * Generate goal events (scorers and assists) for a match scoreline
 */
export const generateMatchEvents = (homeTeamName, awayTeamName, homeGoals, awayGoals, season) => {
  const homeSquad = getSquadForTeam(homeTeamName, season);
  const awaySquad = getSquadForTeam(awayTeamName, season);

  const scorers = [];
  const assists = [];

  for (let i = 0; i < homeGoals; i++) {
    const minute = Math.min(90, Math.floor(Math.random() * 88) + 2);
    const { scorer, assister } = pickScorerAndAssister(homeSquad, homeTeamName);
    scorers.push({ ...scorer, minute });
    if (assister) assists.push({ ...assister, minute });
  }

  for (let i = 0; i < awayGoals; i++) {
    const minute = Math.min(90, Math.floor(Math.random() * 88) + 2);
    const { scorer, assister } = pickScorerAndAssister(awaySquad, awayTeamName);
    scorers.push({ ...scorer, minute });
    if (assister) assists.push({ ...assister, minute });
  }

  scorers.sort((a, b) => a.minute - b.minute);

  return { scorers, assists };
};

/**
 * Record match events into the persistent season player stats registry
 */
export const recordMatchEventsInStats = (playerStats = {}, scorers = [], assists = []) => {
  const stats = { ...(playerStats || {}) };

  scorers.forEach(s => {
    if (!s || !s.name) return;
    const key = `${s.name}__${s.team}`;
    if (!stats[key]) {
      stats[key] = {
        name: s.name,
        team: s.team,
        position: s.position || "FW",
        goals: 0,
        assists: 0,
        appearances: 1
      };
    }
    stats[key].goals += 1;
  });

  assists.forEach(a => {
    if (!a || !a.name) return;
    const key = `${a.name}__${a.team}`;
    if (!stats[key]) {
      stats[key] = {
        name: a.name,
        team: a.team,
        position: a.position || "MF",
        goals: 0,
        assists: 0,
        appearances: 1
      };
    }
    stats[key].assists += 1;
  });

  return stats;
};

/**
 * Calculate Manager of the Month and Player of the Month
 */
export const calculateMonthlyAwards = ({
  fixtures = [],
  standings = [],
  startRound,
  endRound,
  monthName,
  userManagerName,
  userTeamName
}) => {
  const teamRecords = {};
  (standings || []).forEach(t => {
    teamRecords[t.name] = {
      teamName: t.name,
      managerName: t.name === userTeamName ? (userManagerName || "Sir Alex") : `Manager ${t.name}`,
      isUser: t.name === userTeamName,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0
    };
  });

  const monthPlayerStats = {};

  // Tally all league fixtures played in startRound..endRound
  for (let r = startRound - 1; r < endRound; r++) {
    const rFixtures = fixtures[r];
    if (!Array.isArray(rFixtures)) continue;

    rFixtures.forEach(f => {
      if (!f.played || f.homeScore === undefined || f.awayScore === undefined) return;
      const hTeam = (standings || []).find(t => t.idnum === f.homeId)?.name || f.homeTeamName;
      const aTeam = (standings || []).find(t => t.idnum === f.awayId)?.name || f.awayTeamName;

      if (hTeam && teamRecords[hTeam]) {
        const rec = teamRecords[hTeam];
        rec.played += 1;
        rec.gf += f.homeScore;
        rec.ga += f.awayScore;
        rec.gd = rec.gf - rec.ga;
        if (f.homeScore > f.awayScore) { rec.won += 1; rec.points += 3; }
        else if (f.homeScore === f.awayScore) { rec.drawn += 1; rec.points += 1; }
        else { rec.lost += 1; }
      }

      if (aTeam && teamRecords[aTeam]) {
        const rec = teamRecords[aTeam];
        rec.played += 1;
        rec.gf += f.awayScore;
        rec.ga += f.homeScore;
        rec.gd = rec.gf - rec.ga;
        if (f.awayScore > f.homeScore) { rec.won += 1; rec.points += 3; }
        else if (f.awayScore === f.homeScore) { rec.drawn += 1; rec.points += 1; }
        else { rec.lost += 1; }
      }

      // Tally Scorers
      (f.scorers || []).forEach(s => {
        if (!s || !s.name) return;
        const key = `${s.name}__${s.team}`;
        if (!monthPlayerStats[key]) {
          monthPlayerStats[key] = {
            name: s.name,
            team: s.team,
            position: s.position || "FW",
            goals: 0,
            assists: 0
          };
        }
        monthPlayerStats[key].goals += 1;
      });

      // Tally Assists
      (f.assists || []).forEach(a => {
        if (!a || !a.name) return;
        const key = `${a.name}__${a.team}`;
        if (!monthPlayerStats[key]) {
          monthPlayerStats[key] = {
            name: a.name,
            team: a.team,
            position: a.position || "MF",
            goals: 0,
            assists: 0
          };
        }
        monthPlayerStats[key].assists += 1;
      });
    });
  }

  // 1. Manager of the Month
  const sortedManagers = Object.values(teamRecords).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  const motmWinner = sortedManagers[0];
  const motmRunnersUp = sortedManagers.slice(1, 3);

  // 2. Player of the Month
  const sortedPlayers = Object.values(monthPlayerStats).sort((a, b) => {
    const ptsA = (a.goals * 2) + (a.assists * 1.5);
    const ptsB = (b.goals * 2) + (b.assists * 1.5);
    if (ptsB !== ptsA) return ptsB - ptsA;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return b.assists - a.assists;
  });

  let potmWinner = sortedPlayers[0] || null;
  let potmRunnersUp = sortedPlayers.slice(1, 3);

  // Fallback if no goals occurred in the month
  if (!potmWinner && sortedManagers.length > 0) {
    const topTeam = sortedManagers[0];
    potmWinner = {
      name: `${topTeam.teamName} Star`,
      team: topTeam.teamName,
      position: "MF",
      goals: 1,
      assists: 1
    };
    potmRunnersUp = [];
  }

  return {
    monthName,
    motm: {
      winner: motmWinner,
      runnersUp: motmRunnersUp,
      monthName
    },
    potm: {
      winner: potmWinner,
      runnersUp: potmRunnersUp,
      monthName
    }
  };
};

/**
 * Calculate Manager of the Year and Player of the Year at Season End
 */
export const calculateYearlyAwards = ({
  standings = [],
  monthlyAwardsHistory = [],
  playerStats = {},
  userManagerName,
  userTeamName
}) => {
  // 1. Manager of the Year: Most MotM awards, tiebreaker: total league points
  const managerCounts = {};
  (standings || []).forEach(t => {
    const mgrName = t.name === userTeamName ? (userManagerName || "Sir Alex") : `Manager ${t.name}`;
    managerCounts[t.name] = {
      teamName: t.name,
      managerName: mgrName,
      isUser: t.name === userTeamName,
      motmCount: 0,
      totalPoints: t.points || 0,
      position: standings.indexOf(t) + 1
    };
  });

  (monthlyAwardsHistory || []).forEach(m => {
    if (m && m.motm && m.motm.winner && managerCounts[m.motm.winner.teamName]) {
      managerCounts[m.motm.winner.teamName].motmCount += 1;
    }
  });

  const sortedManagersOfYear = Object.values(managerCounts).sort((a, b) => {
    if (b.motmCount !== a.motmCount) return b.motmCount - a.motmCount;
    return b.totalPoints - a.totalPoints;
  });

  const motyWinner = sortedManagersOfYear[0];
  const motyRunnersUp = sortedManagersOfYear.slice(1, 3);

  // 2. Player of the Year: Top overall goal contribution (goals + assists), weighted by team standing
  const allPlayers = Object.values(playerStats || {});
  const sortedPlayersOfYear = allPlayers.sort((a, b) => {
    const scoreA = (a.goals * 2.5) + (a.assists * 1.8);
    const scoreB = (b.goals * 2.5) + (b.assists * 1.8);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.goals - a.goals;
  });

  const potyWinner = sortedPlayersOfYear[0] || {
    name: "Season MVP",
    team: standings[0]?.name || "Champions",
    position: "FW",
    goals: 20,
    assists: 10
  };
  const potyRunnersUp = sortedPlayersOfYear.slice(1, 3);

  return {
    moty: {
      winner: motyWinner,
      runnersUp: motyRunnersUp
    },
    poty: {
      winner: potyWinner,
      runnersUp: potyRunnersUp
    }
  };
};

/**
 * Award prestige points and title to Manager Profile
 */
export const awardManagerTitle = (awardType, details) => {
  try {
    const saved = localStorage.getItem("retro_manager_profile");
    if (!saved) return;
    const profile = JSON.parse(saved);

    if (awardType === "motm") {
      profile.monthlyAwards = (profile.monthlyAwards || 0) + 1;
      profile.monthlyAwardsList = profile.monthlyAwardsList || [];
      profile.monthlyAwardsList.push({
        type: "motm",
        month: details.monthName,
        season: details.season,
        team: details.teamName,
        points: details.points,
        record: `${details.won}W-${details.drawn}D-${details.lost}L`
      });
    } else if (awardType === "moty") {
      profile.managerOfTheYear = (profile.managerOfTheYear || 0) + 1;
      profile.motyList = profile.motyList || [];
      profile.motyList.push({
        type: "moty",
        season: details.season,
        team: details.teamName
      });
    }

    localStorage.setItem("retro_manager_profile", JSON.stringify(profile));
    return profile;
  } catch (err) {
    console.warn("[awardsManager] Failed to update manager profile", err);
  }
};
