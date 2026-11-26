// src/utils/awardsManager.js
// Complete Engine for Goalscorers, Assists, Monthly Awards & Yearly Awards

import { getPrebuiltRosterSync, getTeamDetailsSync } from '../data/rosters/rosterRegistry';
import { pickWeightedGoalScorerAndAssister } from './tacticalRoleEngine';
import { getCPUFormation } from '../components/FormationTactics';

const FALLBACK_MANAGER_NAMES = [
  "Graham Taylor", "Terry Yorath", "John Gregory", "Alan Curbishley",
  "George Burley", "David Jones", "Peter Reid", "Joe Royle",
  "Brian Little", "Howard Kendall", "Ray Wilkins", "Steve Bruce",
  "Glenn Hoddle", "Gerry Francis", "Mick McCarthy", "Nigel Worthington",
  "Paul Jewell", "Phil Brown", "Gary Megson", "Dave Bassett",
  "Trevor Francis", "Glenn Roeder", "Lawrie Sanchez", "Colin Todd"
];

export const isPlaceholderManagerName = (name, teamName = "") => {
  if (!name || typeof name !== "string") return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (teamName && trimmed.toLowerCase() === `manager ${teamName}`.toLowerCase()) return true;
  return /^Manager\s+/i.test(trimmed);
};

/**
 * Resolves the authentic manager name for a team in a season (or deterministic fallback if missing).
 */
export const resolveClubManagerName = (teamObjOrName, season, userTeamName = "", userManagerName = "") => {
  const teamName = typeof teamObjOrName === "string"
    ? teamObjOrName
    : (teamObjOrName?.name || teamObjOrName?.teamName || "");
  if (!teamName) return "Head Coach";

  if (userTeamName && teamName === userTeamName) {
    return userManagerName || "Sir Alex";
  }

  if (typeof teamObjOrName === "object" && teamObjOrName?.managerName && !isPlaceholderManagerName(teamObjOrName.managerName, teamName)) {
    return teamObjOrName.managerName;
  }

  if (season) {
    const det = getTeamDetailsSync(teamName, season);
    if (det?.manager?.name && det.manager.name.trim()) {
      return det.manager.name.trim();
    }
  }

  let hash = 0;
  for (let i = 0; i < teamName.length; i++) {
    hash = ((hash * 31) + teamName.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_MANAGER_NAMES[hash % FALLBACK_MANAGER_NAMES.length];
};

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
 * Pick goalscorer and assister based on tactical role, position, and effective skill.
 */
const pickScorerAndAssister = (squad, teamName, season = "1995") => {
  let savedLineup = null;
  let savedRoles = {};
  let formation = "4-4-2";

  try {
    const rawLineup = typeof localStorage !== "undefined"
      ? localStorage.getItem(`retro_lineup_${teamName}_${season}`)
      : null;
    if (rawLineup) {
      const parsed = JSON.parse(rawLineup);
      if (parsed && typeof parsed === "object" && Object.values(parsed).some(Boolean)) {
        savedLineup = parsed;
      }
    }
    const rawRoles = typeof localStorage !== "undefined"
      ? localStorage.getItem(`retro_roles_${teamName}_${season}`)
      : null;
    if (rawRoles) {
      savedRoles = JSON.parse(rawRoles) || {};
    }
    if (savedLineup) {
      formation = (typeof localStorage !== "undefined" && localStorage.getItem("retro_player_formation"))
        || getCPUFormation({ name: teamName }, null, season)
        || "4-4-2";
    }
  } catch (e) {
    // fallback to squad array weights
  }

  const inputPool = savedLineup || squad;
  if (!inputPool || (Array.isArray(inputPool) && inputPool.length === 0)) {
    return {
      scorer: { name: `${teamName} Striker`, position: "ST", team: teamName },
      assister: null
    };
  }

  const { scorer, assister } = pickWeightedGoalScorerAndAssister(
    inputPool,
    teamName,
    formation,
    savedRoles,
    {
      includeAssist: true,
      assistChance: 0.76,
      squadRotationMode: !savedLineup
    }
  );

  return {
    scorer: { name: scorer.name, position: scorer.position || "ST", team: teamName },
    assister: assister ? { name: assister.name, position: assister.position || "MC", team: teamName } : null
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
    const { scorer, assister } = pickScorerAndAssister(homeSquad, homeTeamName, season);
    scorers.push({ ...scorer, minute });
    if (assister) assists.push({ ...assister, minute });
  }

  for (let i = 0; i < awayGoals; i++) {
    const minute = Math.min(90, Math.floor(Math.random() * 88) + 2);
    const { scorer, assister } = pickScorerAndAssister(awaySquad, awayTeamName, season);
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
  userTeamName,
  season
}) => {
  const teamRecords = {};
  (standings || []).forEach(t => {
    teamRecords[t.name] = {
      teamName: t.name,
      managerName: resolveClubManagerName(t, season, userTeamName, userManagerName),
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
  userTeamName,
  season
}) => {
  // 1. Manager of the Year: Most MotM awards, tiebreaker: total league points
  const managerCounts = {};
  (standings || []).forEach(t => {
    const mgrName = resolveClubManagerName(t, season, userTeamName, userManagerName);
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
    const norm = (v) => String(v || "").trim().toLowerCase();

    if (awardType === "motm") {
      profile.monthlyAwardsList = Array.isArray(profile.monthlyAwardsList) ? profile.monthlyAwardsList : [];
      const alreadyRecorded = profile.monthlyAwardsList.some((item) =>
        norm(item?.season) === norm(details?.season) &&
        norm(item?.month) === norm(details?.monthName) &&
        norm(item?.team) === norm(details?.teamName)
      );
      if (alreadyRecorded) return profile;

      profile.monthlyAwards = (profile.monthlyAwards || 0) + 1;
      profile.monthlyAwardsList.push({
        type: "motm",
        month: details.monthName,
        season: details.season,
        team: details.teamName,
        points: details.points,
        record: `${details.won}W-${details.drawn}D-${details.lost}L`
      });
    } else if (awardType === "moty") {
      profile.motyList = Array.isArray(profile.motyList) ? profile.motyList : [];
      const alreadyRecorded = profile.motyList.some((item) =>
        norm(item?.season) === norm(details?.season) &&
        norm(item?.team) === norm(details?.teamName)
      );
      if (alreadyRecorded) return profile;

      profile.managerOfTheYear = (profile.managerOfTheYear || 0) + 1;
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

/**
 * Repairs saved monthly/yearly awards and news items whose CPU manager names used placeholder "Manager <Team>".
 */
export const repairCareerAwardManagerNames = (career) => {
  if (!career || !career.season) return { changed: false, career };
  let changed = false;

  const pTeam = (career.teams || []).find(t => t.idnum === career.playerTeamId);
  const userTeamName = pTeam ? pTeam.name : "";
  const userManagerName = career.managerName || "Sir Alex";
  const season = career.season;

  const fixEntry = (entry) => {
    if (!entry || !entry.teamName) return entry;
    if (!isPlaceholderManagerName(entry.managerName, entry.teamName)) return entry;
    const resolved = resolveClubManagerName(entry.teamName, season, userTeamName, userManagerName);
    if (resolved && resolved !== entry.managerName) {
      changed = true;
      return { ...entry, managerName: resolved };
    }
    return entry;
  };

  const nextMonthly = Array.isArray(career.monthlyAwards)
    ? career.monthlyAwards.map(m => {
        if (!m?.motm) return m;
        return {
          ...m,
          motm: {
            ...m.motm,
            winner: fixEntry(m.motm.winner),
            runnersUp: Array.isArray(m.motm.runnersUp) ? m.motm.runnersUp.map(fixEntry) : m.motm.runnersUp
          }
        };
      })
    : career.monthlyAwards;

  let nextYearly = career.yearlyAwards;
  if (nextYearly?.moty) {
    nextYearly = {
      ...nextYearly,
      moty: {
        ...nextYearly.moty,
        winner: fixEntry(nextYearly.moty.winner),
        runnersUp: Array.isArray(nextYearly.moty.runnersUp) ? nextYearly.moty.runnersUp.map(fixEntry) : nextYearly.moty.runnersUp
      }
    };
  }

  const nextNewsFeed = Array.isArray(career.newsFeed)
    ? career.newsFeed.map(item => {
        const aw = item?.awardWidget;
        if (!aw || (aw.type !== "motm" && aw.type !== "moty")) return item;

        let itemChanged = false;
        let nextWinner = aw.winner;
        let nextTitle = item.title || "";
        let nextSummary = item.summary || "";
        let nextBody = item.body || "";

        if (aw.team && isPlaceholderManagerName(aw.winner, aw.team)) {
          const resolvedWinner = resolveClubManagerName(aw.team, season, userTeamName, userManagerName);
          if (resolvedWinner && resolvedWinner !== aw.winner) {
            const oldPlaceholder = aw.winner;
            nextWinner = resolvedWinner;
            if (oldPlaceholder) {
              nextTitle = nextTitle.split(oldPlaceholder).join(resolvedWinner);
              nextSummary = nextSummary.split(oldPlaceholder).join(resolvedWinner);
              nextBody = nextBody.split(oldPlaceholder).join(resolvedWinner);
            }
            itemChanged = true;
          }
        }

        const nextRunnersUp = Array.isArray(aw.runnersUp)
          ? aw.runnersUp.map(ru => {
              if (!ru || !ru.teamName || !isPlaceholderManagerName(ru.managerName, ru.teamName)) return ru;
              const resolved = resolveClubManagerName(ru.teamName, season, userTeamName, userManagerName);
              if (resolved && resolved !== ru.managerName) {
                const oldName = ru.managerName;
                if (oldName) {
                  nextBody = nextBody.split(oldName).join(resolved);
                  nextSummary = nextSummary.split(oldName).join(resolved);
                }
                itemChanged = true;
                return { ...ru, managerName: resolved };
              }
              return ru;
            })
          : aw.runnersUp;

        if (!itemChanged) return item;
        changed = true;
        return {
          ...item,
          title: nextTitle,
          summary: nextSummary,
          body: nextBody,
          awardWidget: {
            ...aw,
            winner: nextWinner,
            runnersUp: nextRunnersUp
          }
        };
      })
    : career.newsFeed;

  if (!changed) return { changed: false, career };

  return {
    changed: true,
    career: {
      ...career,
      monthlyAwards: nextMonthly,
      yearlyAwards: nextYearly,
      newsFeed: nextNewsFeed
    }
  };
};
