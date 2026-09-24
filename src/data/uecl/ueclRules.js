import uecl24Data from './uecl24.json';
import uecl23Data from './uecl23.json';
import uecl22Data from './uecl22.json';
import uecl21Data from './uecl21.json';
import uecl25Data from './uecl25.json';
import uecl26Data from './uecl26.json';

export const ueclRules = {
  "2026": {
    teamsData: uecl26Data,

    format: "league_then_knockout",
    stages: ["league_stage", "playoffs", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "league_stage", matchday: 1 },
      { offset: 4, stage: "league_stage", matchday: 2 },
      { offset: 6, stage: "league_stage", matchday: 3 },
      { offset: 8, stage: "league_stage", matchday: 4 },
      { offset: 11, stage: "league_stage", matchday: 5 },
      { offset: 13, stage: "league_stage", matchday: 6 },
      { offset: 15, stage: "league_stage", matchday: 7 },
      { offset: 17, stage: "league_stage", matchday: 8 },
      { offset: 20, stage: "playoffs", matchday: 1 },
      { offset: 22, stage: "playoffs", matchday: 2 },
      { offset: 25, stage: "round_of_16", matchday: 1 },
      { offset: 27, stage: "round_of_16", matchday: 2 },
      { offset: 30, stage: "quarter_finals", matchday: 1 },
      { offset: 32, stage: "quarter_finals", matchday: 2 },
      { offset: 35, stage: "semi_finals", matchday: 1 },
      { offset: 37, stage: "semi_finals", matchday: 2 },
      { offset: 39, stage: "final", matchday: 1 }
    ]
  },
  "2025": {

    teamsData: uecl25Data,
    format: "league_then_knockout",
    stages: ["league_stage", "playoffs", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "league_stage", matchday: 1 },
      { offset: 4, stage: "league_stage", matchday: 2 },
      { offset: 6, stage: "league_stage", matchday: 3 },
      { offset: 8, stage: "league_stage", matchday: 4 },
      { offset: 11, stage: "league_stage", matchday: 5 },
      { offset: 13, stage: "league_stage", matchday: 6 },
      { offset: 15, stage: "league_stage", matchday: 7 },
      { offset: 17, stage: "league_stage", matchday: 8 },
      { offset: 20, stage: "playoffs", matchday: 1 },
      { offset: 22, stage: "playoffs", matchday: 2 },
      { offset: 25, stage: "round_of_16", matchday: 1 },
      { offset: 27, stage: "round_of_16", matchday: 2 },
      { offset: 30, stage: "quarter_finals", matchday: 1 },
      { offset: 32, stage: "quarter_finals", matchday: 2 },
      { offset: 35, stage: "semi_finals", matchday: 1 },
      { offset: 37, stage: "semi_finals", matchday: 2 },
      { offset: 39, stage: "final", matchday: 1 }
    ]
  },
  "2024": {
    teamsData: uecl24Data,
    format: "league_then_knockout",
    stages: ["league_stage", "playoffs", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "league_stage", matchday: 1 },
      { offset: 4, stage: "league_stage", matchday: 2 },
      { offset: 6, stage: "league_stage", matchday: 3 },
      { offset: 8, stage: "league_stage", matchday: 4 },
      { offset: 11, stage: "league_stage", matchday: 5 },
      { offset: 13, stage: "league_stage", matchday: 6 },
      { offset: 15, stage: "league_stage", matchday: 7 },
      { offset: 17, stage: "league_stage", matchday: 8 },
      { offset: 20, stage: "playoffs", matchday: 1 },
      { offset: 22, stage: "playoffs", matchday: 2 },
      { offset: 25, stage: "round_of_16", matchday: 1 },
      { offset: 27, stage: "round_of_16", matchday: 2 },
      { offset: 30, stage: "quarter_finals", matchday: 1 },
      { offset: 32, stage: "quarter_finals", matchday: 2 },
      { offset: 35, stage: "semi_finals", matchday: 1 },
      { offset: 37, stage: "semi_finals", matchday: 2 },
      { offset: 39, stage: "final", matchday: 1 }
    ]
  },
  "2023": {
    teamsData: uecl23Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  },
  "2022": {
    teamsData: uecl22Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  },
  "2021": {
    teamsData: uecl21Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  }
};
