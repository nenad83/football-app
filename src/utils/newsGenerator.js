// src/utils/newsGenerator.js
// Utility to generate Football Manager-style dynamic news stories

export const CATEGORY_CONFIG = {
  match: { label: 'MATCH RECAP', color: '#00ff64', icon: '⚽' },
  preview: { label: 'TACTICAL PREVIEW', color: '#00e5ff', icon: '🧠' },
  medical: { label: 'MEDICAL REPORT', color: '#ff3366', icon: '🏥' },
  board: { label: 'BOARDROOM', color: '#e040fb', icon: '💼' },
  transfer: { label: 'TRANSFER DESK', color: '#ffd700', icon: '⚽' },
  league: { label: 'LEAGUE ROUNDUP', color: '#ff9100', icon: '📰' },
  cup: { label: 'DOMESTIC CUP', color: '#ff0055', icon: '🏆' }
};

/**
 * Generate initial pre-season news items when starting a new career or initializing news state.
 */
export const generateInitialNews = ({ teamName, managerName, expectation, budget, season }) => {
  const timestamp = Date.now();
  const boardText = expectation?.text || "Avoid Relegation";
  const budgetVal = budget !== undefined ? budget : 10.0;

  return [
    {
      id: `news_0_board_${timestamp}`,
      round: 0,
      dateStr: "Pre-Season",
      category: "board",
      categoryLabel: CATEGORY_CONFIG.board.label,
      title: `Board Unveils Season Objectives: Target set as "${boardText}"`,
      summary: `Manager ${managerName} takes charge at ${teamName} with a transfer budget of $${budgetVal.toFixed(1)}M.`,
      body: `The board of directors at ${teamName} have officially welcomed Manager ${managerName} for the upcoming ${season} campaign. Following detailed boardroom discussions, the directors have outlined clear expectations: the team is expected to achieve at least "${boardText}".

To support these objectives, the board has approved a starting transfer budget of $${budgetVal.toFixed(1)}M alongside squad wage allocations. Manager ${managerName} addressed the press, expressing confidence in meeting targets while promising an exciting tactical style for supporters.`,
      isRead: false,
      timestamp: timestamp - 1000,
      actionTab: "board"
    },
    {
      id: `news_0_preview_${timestamp}`,
      round: 0,
      dateStr: "Pre-Season",
      category: "preview",
      categoryLabel: CATEGORY_CONFIG.preview.label,
      title: `Pre-Season Tactical Outlook: ${teamName} Gear Up for Campaign Opening`,
      summary: `Analytical breakdown of ${teamName}'s tactical setup and squad readiness ahead of Matchday 1.`,
      body: `As the new season approaches, sports analysts have taken a close look at ${teamName}'s squad depth and tactical preparation under ${managerName}. 

The squad has undergone rigorous tactical drills during pre-season training, emphasizing positional discipline and quick transitions. Key senior players are reported to be in high spirits, and fans are eagerly anticipating the opening match. Tactical adjustments and squad rotations will be key as the fixture list unfolds.`,
      isRead: false,
      timestamp: timestamp,
      actionTab: "tactics"
    }
  ];
};

/**
 * Generate matchday news stories after a round is played or simulated.
 */
export const generateMatchdayNews = ({
  round,
  userFixture,
  allFixtures = [],
  standings = [],
  teamName,
  opponentName,
  nextOpponent,
  managerName,
  injuries = [],
  budget,
  fanConfidence = 50,
  boardConfidence = 50,
  isEuropeanMatch = false,
  europeanCupName = ""
}) => {
  const timestamp = Date.now();
  const newsItems = [];

  // 1. User Match Recap Story
  if (userFixture && userFixture.played) {
    const isHome = userFixture.homeTeamName ? userFixture.homeTeamName === teamName : true;
    const userGoals = isHome ? userFixture.homeScore : userFixture.awayScore;
    const oppGoals = isHome ? userFixture.awayScore : userFixture.homeScore;
    const oppName = opponentName || (isHome ? userFixture.awayTeamName : userFixture.homeTeamName) || "Opponent";
    const goalDiff = userGoals - oppGoals;

    let matchHeadline = "";
    let matchBody = "";

    if (goalDiff > 2) {
      matchHeadline = `EMPHATIC VICTORY: ${teamName} Thrash ${oppName} ${userGoals}-${oppGoals}!`;
      matchBody = `Manager ${managerName}'s ${teamName} put on a masterclass performance today, dismantling ${oppName} with a sensational ${userGoals}-${oppGoals} victory. From the opening whistle, ${teamName} dominated possession and created chances at will. The home support erupted as the team delivered one of their finest displays of the season.`;
    } else if (goalDiff > 0) {
      matchHeadline = `HARD-FOUGHT WIN: ${teamName} Edge Past ${oppName} ${userGoals}-${oppGoals}`;
      matchBody = `${teamName} secured three crucial points in a tight battle against ${oppName}, finishing ${userGoals}-${oppGoals}. ${managerName}'s tactical adjustments proved decisive as the squad showed resilience and composure in the closing minutes to seal the win.`;
    } else if (goalDiff === 0) {
      matchHeadline = `POINTS SHARED: ${teamName} Draw ${userGoals}-${oppGoals} Against ${oppName}`;
      matchBody = `It ended all square at ${userGoals}-${oppGoals} between ${teamName} and ${oppName} in a tense matchday encounter. Both sides had chances to claim victory, but defensive discipline on both ends ensured the points were shared.`;
    } else if (goalDiff === -1 || goalDiff === -2) {
      matchHeadline = `NARROW DEFEAT: ${teamName} Suffer ${userGoals}-${oppGoals} Loss to ${oppName}`;
      matchBody = `${teamName} fell to a disappointing ${userGoals}-${oppGoals} defeat against ${oppName}. Despite creating several promising opportunities, ${managerName}'s men were unable to capitalize, leaving the manager frustrated in post-match press interviews.`;
    } else {
      matchHeadline = `HEAVY BLOW: ${teamName} Crushed ${userGoals}-${oppGoals} by ${oppName}`;
      matchBody = `A painful matchday for ${teamName} as they succumbed to a heavy ${userGoals}-${oppGoals} loss against ${oppName}. Pundits criticized defensive errors and called on Manager ${managerName} to swiftly address team form before the next fixture.`;
    }

    // Find current league position
    const playerRank = standings.findIndex(t => t.name === teamName) + 1;
    if (playerRank > 0) {
      matchBody += ` Following this result, ${teamName} sit in Position ${playerRank} in the table.`;
    }

    newsItems.push({
      id: `news_${round}_match_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "match",
      categoryLabel: isEuropeanMatch ? `${europeanCupName || "EUROPE"} MATCH` : CATEGORY_CONFIG.match.label,
      title: matchHeadline,
      summary: `${teamName} ${userGoals}-${oppGoals} ${oppName}. Read full match analysis and table standings impact.`,
      body: matchBody,
      matchWidget: {
        homeTeam: isHome ? teamName : oppName,
        awayTeam: isHome ? oppName : teamName,
        homeScore: userFixture.homeScore,
        awayScore: userFixture.awayScore,
        userTeam: teamName
      },
      isRead: false,
      timestamp: timestamp,
      actionTab: "home"
    });
  }

  // 2. League Roundup / Upset Alert Story
  if (allFixtures && allFixtures.length > 1 && standings.length > 0) {
    const playedOther = allFixtures.filter(f => f.played && f.homeTeamName !== teamName && f.awayTeamName !== teamName);
    if (playedOther.length > 0) {
      let notableFixture = playedOther[0];
      let maxDiff = -1;
      playedOther.forEach(f => {
        const diff = Math.abs(f.homeScore - f.awayScore);
        if (diff > maxDiff) {
          maxDiff = diff;
          notableFixture = f;
        }
      });

      if (notableFixture) {
        const hName = notableFixture.homeTeamName || "Home Team";
        const aName = notableFixture.awayTeamName || "Away Team";
        newsItems.push({
          id: `news_${round}_league_${timestamp}`,
          round: round,
          dateStr: `Matchday ${round}`,
          category: "league",
          categoryLabel: CATEGORY_CONFIG.league.label,
          title: `League Roundup: ${hName} ${notableFixture.homeScore}-${notableFixture.awayScore} ${aName}`,
          summary: `Highlights and key results from around the league in Matchday ${round}.`,
          body: `Matchday ${round} brought plenty of drama across the division. In the headline clash of the rest of the league, ${hName} clashed with ${aName}, ending in a ${notableFixture.homeScore}-${notableFixture.awayScore} scoreline. 

Pundits note that competition at both top and bottom ends of the table is heating up as the season progresses.`,
          isRead: false,
          timestamp: timestamp + 10,
          actionTab: "home"
        });
      }
    }
  }

  // 3. Medical Department & Squad Status Report
  const activeInjuries = Array.isArray(injuries) ? injuries.filter(i => i.weeksRemaining > 0) : [];
  if (activeInjuries.length > 0) {
    const playerNames = activeInjuries.map(i => `${i.playerName || i.name} (${i.weeksRemaining} wk${i.weeksRemaining > 1 ? 's' : ''})`).join(", ");
    newsItems.push({
      id: `news_${round}_medical_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "medical",
      categoryLabel: CATEGORY_CONFIG.medical.label,
      title: `Medical Desk Update: ${activeInjuries.length} Squad Member${activeInjuries.length > 1 ? 's' : ''} Sidelined`,
      summary: `Physio department reports recovery progress for ${playerNames}.`,
      body: `The physio room at ${teamName} has issued a squad health update following recent matches. Currently, ${activeInjuries.length} player(s) are undergoing medical treatment and recovery protocols: ${playerNames}.

Manager ${managerName} will need to adjust squad selections and tactical lineups to compensate for these absences in upcoming fixtures.`,
      medicalWidget: activeInjuries,
      isRead: false,
      timestamp: timestamp + 20,
      actionTab: "tactics"
    });
  } else {
    newsItems.push({
      id: `news_${round}_medical_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "medical",
      categoryLabel: CATEGORY_CONFIG.medical.label,
      title: `Physio Room Clear: ${teamName} Report Full Squad Fitness`,
      summary: `Clean bill of health reported by medical staff ahead of upcoming fixtures.`,
      body: `Great news from the medical department at ${teamName}! Head physio staff confirmed that the entire squad is in peak physical condition with zero registered injuries. Manager ${managerName} has a full complement of players available for selection.`,
      isRead: false,
      timestamp: timestamp + 20,
      actionTab: "tactics"
    });
  }

  // 4. Tactical Preview for Next Opponent
  if (nextOpponent) {
    const nName = nextOpponent.name || "Next Opponent";
    const att = nextOpponent.attack || 0;
    const mid = nextOpponent.midfield || 0;
    const def = nextOpponent.defense || 0;

    let tacticalAdvice = "Maintain balanced tactical shape.";
    if (att > def && att > mid) {
      tacticalAdvice = `${nName} boast a formidable attack (${att}). Defensive solidity and disciplined midfield screening will be critical.`;
    } else if (def > att && def > mid) {
      tacticalAdvice = `${nName} rely on a stubborn defensive structure (${def}). High pressing and quick wing play can unlock their backline.`;
    } else {
      tacticalAdvice = `${nName} feature a balanced lineup. Controlling midfield tempo will be the key factor.`;
    }

    newsItems.push({
      id: `news_${round}_preview_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "preview",
      categoryLabel: CATEGORY_CONFIG.preview.label,
      title: `Tactical Scouting Report: Preparing for ${nName}`,
      summary: `In-depth analysis of ${nName}'s strengths and recommended tactical approach.`,
      body: `Scouts have compiled a detailed performance analysis on ${teamName}'s next opponent, ${nName}. 

Statistically, ${nName} feature an Attack rating of ${att}, Midfield rating of ${mid}, and Defense rating of ${def}. 

${tacticalAdvice} Manager ${managerName} is expected to refine line-up tactics in training this week to prepare for the clash.`,
      previewWidget: {
        opponentName: nName,
        attack: att,
        midfield: mid,
        defense: def
      },
      isRead: false,
      timestamp: timestamp + 30,
      actionTab: "tactics"
    });
  }

  // 5. Boardroom & Fan Reaction
  let moodText = "Stable";
  if (fanConfidence >= 75) moodText = "Extremely Enthusiastic";
  else if (fanConfidence >= 50) moodText = "Satisfied";
  else if (fanConfidence >= 30) moodText = "Concerned";
  else moodText = "Restless & Mutinous";

  newsItems.push({
    id: `news_${round}_board_${timestamp}`,
    round: round,
    dateStr: `Matchday ${round}`,
    category: "board",
    categoryLabel: CATEGORY_CONFIG.board.label,
    title: `Fan & Board Pulse: Fan Mood Rated "${moodText}" (${fanConfidence}%)`,
    summary: `Board confidence stands at ${boardConfidence}% following recent matchday outcomes.`,
    body: `Following Matchday ${round}, supporter feedback across fansets indicates a mood rated "${moodText}" with an approval score of ${fanConfidence}%. 

In the boardroom, directors report an overall confidence score of ${boardConfidence}%. The board reiterates that Manager ${managerName} has their support as long as end-of-season targets remain within reach.`,
    isRead: false,
    timestamp: timestamp + 40,
    actionTab: "board"
  });

  return newsItems;
};

/**
 * Generate Domestic Cup Draw Announcement story.
 */
export const generateDomesticCupDrawNews = ({ cupName, stageName, teamName, opponentName, managerName }) => {
  const timestamp = Date.now();
  return {
    id: `news_cup_draw_${timestamp}`,
    round: 0,
    dateStr: "Cup Draw",
    category: "cup",
    categoryLabel: CATEGORY_CONFIG.cup.label,
    title: `${cupName} Draw Confirmed: ${teamName} Drawn Against ${opponentName}`,
    summary: `${teamName} learn their ${stageName} opponents in the official ${cupName} draw.`,
    body: `The official draw for the ${stageName} of the ${cupName} has taken place! 

Manager ${managerName}'s ${teamName} have been drawn to face ${opponentName} in a high-stakes knockout tie. The squad will be looking for a clinical performance to advance to the next round of the cup competition.`,
    isRead: false,
    timestamp
  };
};

/**
 * Generate Domestic Cup Match Recap story.
 */
export const generateDomesticCupMatchNews = ({
  cupName,
  stageName,
  userFixture,
  teamName,
  managerName,
  isWinner,
  nextStageName
}) => {
  const timestamp = Date.now();
  const isHome = userFixture.homeName === teamName;
  const oppName = isHome ? userFixture.awayName : userFixture.homeName;
  const userScore = isHome ? userFixture.homeScore : userFixture.awayScore;
  const oppScore = isHome ? userFixture.awayScore : userFixture.homeScore;

  let scoreStr = `${userScore}-${oppScore}`;
  if (userFixture.penaltyHomeScore !== null && userFixture.penaltyHomeScore !== undefined) {
    const userPens = isHome ? userFixture.penaltyHomeScore : userFixture.penaltyAwayScore;
    const oppPens = isHome ? userFixture.penaltyAwayScore : userFixture.penaltyHomeScore;
    scoreStr += ` (${userPens}-${oppPens} on penalties)`;
  }

  let title = "";
  let body = "";

  if (stageName === "Domestic Cup Final") {
    if (isWinner) {
      title = `🏆 CHAMPIONS! ${teamName} Win the ${cupName}!`;
      body = `Glory for Manager ${managerName} and ${teamName}! A sensational ${scoreStr} victory over ${oppName} in the ${cupName} Final secures the coveted trophy! Fans have flooded the streets in celebration as ${teamName} lift the domestic cup!`;
    } else {
      title = `${cupName} Final Heartbreak: ${teamName} Defeated by ${oppName}`;
      body = `${teamName} suffered a painful ${scoreStr} loss against ${oppName} in the ${cupName} Final. Manager ${managerName} praised the team's effort post-match, but fell just short of domestic cup silverware.`;
    }
  } else {
    if (isWinner) {
      title = `${cupName} Victory: ${teamName} Advance to ${nextStageName || 'Next Round'}`;
      body = `${teamName} delivered a strong performance in the ${stageName} of the ${cupName}, overcoming ${oppName} ${scoreStr}. Manager ${managerName} expressed delight in post-match interviews as ${teamName} stay alive in the cup campaign.`;
    } else {
      title = `${cupName} Knockout: ${teamName} Eliminated by ${oppName}`;
      body = `${teamName}'s ${cupName} journey comes to an end following a ${scoreStr} defeat against ${oppName} in the ${stageName}. Focus now shifts entirely back to league fixtures.`;
    }
  }

  return {
    id: `news_cup_match_${timestamp}`,
    round: 0,
    dateStr: stageName,
    category: "cup",
    categoryLabel: CATEGORY_CONFIG.cup.label,
    title,
    summary: `${teamName} ${isWinner ? 'triumph' : 'suffer defeat'} in the ${stageName} of the ${cupName} (${scoreStr}).`,
    body,
    isRead: false,
    timestamp
  };
};

