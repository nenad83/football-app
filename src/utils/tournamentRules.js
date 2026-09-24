export const sortGroupTable = (teams) => {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
};

export const calculateStandingsCopy = (stateCopy) => {
  return stateCopy.teams.map(t => {
    const teamFixtures = [];
    stateCopy.fixtures.forEach(rFixtures => {
      rFixtures.forEach(f => {
        if (f.played && (f.homeId === t.idnum || f.awayId === t.idnum)) {
          teamFixtures.push(f);
        }
      });
    });

    let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0;
    teamFixtures.forEach(f => {
      played += 1;
      const isHome = f.homeId === t.idnum;
      const myScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      gf += myScore; ga += oppScore;
      if (myScore > oppScore) { won += 1; points += 3; }
      else if (myScore < oppScore) { lost += 1; }
      else { drawn += 1; points += 1; }
    });

    return { ...t, played, won, drawn, lost, gf, ga, points };
  });
};

export const initializeKnockouts = (stateCopy) => {
  const updatedStandings = calculateStandingsCopy(stateCopy);
  const isWorldCup = stateCopy.isWorldCup;

  if (stateCopy.cupId === "chi91" || stateCopy.cupId === "bra89") {
    const sortedA = sortGroupTable(updatedStandings.filter(t => t.group === 'A'));
    const sortedB = sortGroupTable(updatedStandings.filter(t => t.group === 'B'));

    const finalRoundTeamIds = [sortedA[0].idnum, sortedA[1].idnum, sortedB[0].idnum, sortedB[1].idnum];
    stateCopy.teams.forEach(t => {
      if (finalRoundTeamIds.includes(t.idnum)) {
        t.group = 'Final';
      }
    });

    const round1 = [
      { homeId: sortedA[0].idnum, awayId: sortedB[1].idnum, played: false, homeScore: 0, awayScore: 0, group: "Final" },
      { homeId: sortedA[1].idnum, awayId: sortedB[0].idnum, played: false, homeScore: 0, awayScore: 0, group: "Final" }
    ];
    const round2 = [
      { homeId: sortedA[0].idnum, awayId: sortedA[1].idnum, played: false, homeScore: 0, awayScore: 0, group: "Final" },
      { homeId: sortedB[1].idnum, awayId: sortedB[0].idnum, played: false, homeScore: 0, awayScore: 0, group: "Final" }
    ];
    const round3 = [
      { homeId: sortedB[1].idnum, awayId: sortedA[1].idnum, played: false, homeScore: 0, awayScore: 0, group: "Final" },
      { homeId: sortedA[0].idnum, awayId: sortedB[0].idnum, played: false, homeScore: 0, awayScore: 0, group: "Final" }
    ];
    stateCopy.knockoutState.finalGroup = [round1, round2, round3];
    stateCopy.stage = "finalGroup";
    stateCopy.currentRound = 1;
    return;
  }

  if (isWorldCup && stateCopy.teams.length === 48) {
    // 48-team World Cup: Top 2 + 8 wildcards to Round of 32
    const groups = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    const winners = {};
    const runnersUp = {};
    
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      winners[g] = sorted[0];
      runnersUp[g] = sorted[1];
    });

    // 2. Get Top 8 third-placed wildcards
    const thirds = [];
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      thirds.push(sorted[2]);
    });
    const sortedThirds = [...thirds].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
    const wildcards = sortedThirds.slice(0, 8);

    // 3. Assemble Round of 32 (16 Matches)
    const roundOf32 = [
      { homeId: winners['A'].idnum, awayId: runnersUp['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['C'].idnum, awayId: wildcards[0].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['D'].idnum, awayId: runnersUp['E'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['F'].idnum, awayId: wildcards[1].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['G'].idnum, awayId: runnersUp['H'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['I'].idnum, awayId: wildcards[2].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['J'].idnum, awayId: runnersUp['K'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['L'].idnum, awayId: wildcards[3].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['B'].idnum, awayId: runnersUp['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['E'].idnum, awayId: wildcards[4].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['H'].idnum, awayId: runnersUp['G'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: winners['K'].idnum, awayId: wildcards[5].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: runnersUp['C'].idnum, awayId: runnersUp['F'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: runnersUp['I'].idnum, awayId: wildcards[6].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: runnersUp['J'].idnum, awayId: runnersUp['L'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" },
      { homeId: runnersUp['D'].idnum, awayId: wildcards[7].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 32" }
    ];

    stateCopy.knockoutState.roundOf32 = roundOf32;
    stateCopy.stage = "roundOf32";
    stateCopy.currentRound = 1;
    return;
  }

  if (isWorldCup && stateCopy.teams.length === 24) {
    // 24-team World Cup: Top 2 + 4 wildcards to Round of 16
    const groups = ['A','B','C','D','E','F'];
    const winners = {};
    const runnersUp = {};
    
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      winners[g] = sorted[0];
      runnersUp[g] = sorted[1];
    });

    // 2. Get Top 4 third-placed wildcards
    const thirds = [];
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      thirds.push(sorted[2]);
    });
    const sortedThirds = [...thirds].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
    const wildcards = sortedThirds.slice(0, 4);

    // 3. Assemble Round of 16 (8 Matches)
    const roundOf16 = [
      { homeId: winners['A'].idnum, awayId: wildcards[0].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: runnersUp['A'].idnum, awayId: runnersUp['C'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['B'].idnum, awayId: wildcards[1].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: runnersUp['B'].idnum, awayId: runnersUp['F'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['C'].idnum, awayId: wildcards[2].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: runnersUp['D'].idnum, awayId: runnersUp['E'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['D'].idnum, awayId: wildcards[3].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['E'].idnum, awayId: winners['F'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" }
    ];

    stateCopy.knockoutState.roundOf16 = roundOf16;
    stateCopy.stage = "roundOf16";
  } else if (isWorldCup && stateCopy.teams.length === 32) {
    // 32-team World Cup: Top 2 from each group A-H to Round of 16 directly
    const groups = ['A','B','C','D','E','F','G','H'];
    const winners = {};
    const runnersUp = {};
    
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      winners[g] = sorted[0];
      runnersUp[g] = sorted[1];
    });

    const roundOf16 = [
      { homeId: winners['A'].idnum, awayId: runnersUp['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['C'].idnum, awayId: runnersUp['D'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['E'].idnum, awayId: runnersUp['F'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['G'].idnum, awayId: runnersUp['H'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['B'].idnum, awayId: runnersUp['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['D'].idnum, awayId: runnersUp['C'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['F'].idnum, awayId: runnersUp['E'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" },
      { homeId: winners['H'].idnum, awayId: runnersUp['G'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Round of 16" }
    ];

    stateCopy.knockoutState.roundOf16 = roundOf16;
    stateCopy.stage = "roundOf16";
  } else if (stateCopy.teams.length === 10) {
    // Copa America 2021: 2 groups, Top 4 to Quarter-finals (A1 vs B4, A2 vs B3, B2 vs A3, B1 vs A4)
    const groups = ['A','B'];
    const winners = {};
    const runnersUp = {};
    const thirds = {};
    const fourths = {};
    
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      winners[g] = sorted[0];
      runnersUp[g] = sorted[1];
      thirds[g] = sorted[2];
      fourths[g] = sorted[3];
    });

    const quarterFinals = [
      { homeId: winners['A'].idnum, awayId: fourths['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: runnersUp['A'].idnum, awayId: thirds['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: runnersUp['B'].idnum, awayId: thirds['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['B'].idnum, awayId: fourths['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" }
    ];

    stateCopy.knockoutState.quarterFinals = quarterFinals;
    stateCopy.stage = "quarterFinals";
  } else if (stateCopy.teams.length === 12) {
    // Copa America: 3 groups, Top 2 + 2 best 3rd-placed advance to Quarter-finals
    const groups = ['A','B','C'];
    const winners = {};
    const runnersUp = {};
    
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      winners[g] = sorted[0];
      runnersUp[g] = sorted[1];
    });

    const thirds = [];
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      thirds.push(sorted[2]);
    });
    const sortedThirds = [...thirds].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
    const wildcards = sortedThirds.slice(0, 2);

    // Assemble Quarter-finals (4 Matches)
    const quarterFinals = [
      { homeId: winners['A'].idnum, awayId: wildcards[0].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['B'].idnum, awayId: runnersUp['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['C'].idnum, awayId: runnersUp['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: runnersUp['C'].idnum, awayId: wildcards[1].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" }
    ];

    stateCopy.knockoutState.quarterFinals = quarterFinals;
    stateCopy.stage = "quarterFinals";
  } else if (stateCopy.teams.length === 16) {
    // Euro 1996 (16 teams): Top 2 from groups A, B, C, D to Quarter-finals
    const groups = ['A','B','C','D'];
    const winners = {};
    const runnersUp = {};
    
    groups.forEach(g => {
      const sorted = sortGroupTable(updatedStandings.filter(t => t.group === g));
      winners[g] = sorted[0];
      runnersUp[g] = sorted[1];
    });

    const quarterFinals = (stateCopy.cupId === "cop24") ? [
      { homeId: winners['A'].idnum, awayId: runnersUp['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['B'].idnum, awayId: runnersUp['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['C'].idnum, awayId: runnersUp['D'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['D'].idnum, awayId: runnersUp['C'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" }
    ] : [
      { homeId: winners['A'].idnum, awayId: runnersUp['B'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['C'].idnum, awayId: runnersUp['D'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['B'].idnum, awayId: runnersUp['A'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" },
      { homeId: winners['D'].idnum, awayId: runnersUp['C'].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Quarter-finals" }
    ];

    stateCopy.knockoutState.quarterFinals = quarterFinals;
    stateCopy.stage = "quarterFinals";
  } else {
    // Euro Cup: Assemble Semi-finals directly (2 Matches)
    const sortedA = sortGroupTable(updatedStandings.filter(t => t.group === 'A'));
    const sortedB = sortGroupTable(updatedStandings.filter(t => t.group === 'B'));

    const semiFinals = [
      { homeId: sortedA[0].idnum, awayId: sortedB[1].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Semi-finals" },
      { homeId: sortedB[0].idnum, awayId: sortedA[1].idnum, played: false, homeScore: 0, awayScore: 0, stageName: "Semi-finals" }
    ];

    stateCopy.knockoutState.semiFinals = semiFinals;
    stateCopy.stage = "semiFinals";
  }
};
