import el24Data from './el24.json';
import el23Data from './el23.json';
import el22Data from './el22.json';
import el21Data from './el21.json';
import el20Data from './el20.json';
import el19Data from './el19.json';
import el18Data from './el18.json';
import el17Data from './el17.json';
import el16Data from './el16.json';
import el15Data from './el15.json';
import el14Data from './el14.json';
import el13Data from './el13.json';
import el12Data from './el12.json';
import el11Data from './el11.json';
import el10Data from './el10.json';
import el09Data from './el09.json';
import uefa08Data from './uefa08.json';
import uefa07Data from './uefa07.json';
import uefa06Data from './uefa06.json';
import uefa97Data from './uefa97.json';
import uefa05Data from './uefa05.json';
import uefa04Data from './uefa04.json';
import uefa03Data from './uefa03.json';
import uefa02Data from './uefa02.json';
import uefa01Data from './uefa01.json';
import uefa00Data from './uefa00.json';
import uefa99Data from './uefa99.json';
import uefa98Data from './uefa98.json';
import uefa96Data from './uefa96.json';
import uefa95Data from './uefa95.json';
import uefa94Data from './uefa94.json';
import uefa93Data from './uefa93.json';
import uefa92Data from './uefa92.json';
import uefa91Data from './uefa91.json';
import uefa90Data from './uefa90.json';
import uefa89Data from './uefa89.json';
import uefa88Data from './uefa88.json';
import uefa87Data from './uefa87.json';
import el25Data from './el25.json';
import el26Data from './el26.json';

export const uefaRules = {
  "2026": {
    teamsData: el26Data,

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

    teamsData: el25Data,
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
    teamsData: el24Data,
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
    teamsData: el23Data,
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
    teamsData: el22Data,
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
    teamsData: el21Data,
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
  "2020": {
    teamsData: el20Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2019": {
    teamsData: el19Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2018": {
    teamsData: el18Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2017": {
    teamsData: el17Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2016": {
    teamsData: el16Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2015": {
    teamsData: el15Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2014": {
    teamsData: el14Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2013": {
    teamsData: el13Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2012": {
    teamsData: el12Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2011": {
    teamsData: el11Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2010": {
    teamsData: el10Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2009": {
    teamsData: el09Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "round_of_32", matchday: 1 },
      { offset: 23, stage: "round_of_32", matchday: 2 },
      { offset: 26, stage: "round_of_16", matchday: 1 },
      { offset: 29, stage: "round_of_16", matchday: 2 },
      { offset: 32, stage: "quarter_finals", matchday: 1 },
      { offset: 35, stage: "quarter_finals", matchday: 2 },
      { offset: 37, stage: "semi_finals", matchday: 1 },
      { offset: 40, stage: "semi_finals", matchday: 2 },
      { offset: 43, stage: "final", matchday: 1 }
    ]
  },
  "2007": {
    teamsData: uefa07Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  },
  "2008": {
    teamsData: uefa08Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  },
  "2006": {
    teamsData: uefa06Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  },
  "2005": {
    teamsData: uefa05Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 20, stage: "round_of_16", matchday: 1 },
      { offset: 23, stage: "round_of_16", matchday: 2 },
      { offset: 26, stage: "quarter_finals", matchday: 1 },
      { offset: 29, stage: "quarter_finals", matchday: 2 },
      { offset: 32, stage: "semi_finals", matchday: 1 },
      { offset: 35, stage: "semi_finals", matchday: 2 },
      { offset: 37, stage: "final", matchday: 1 }
    ]
  },
  "2004": {
    teamsData: uefa04Data,
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
  "2003": {
    teamsData: uefa03Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "2002": {
    teamsData: uefa02Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "2001": {
    teamsData: uefa01Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "2000": {
    teamsData: uefa00Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1999": {
    teamsData: uefa99Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1998": {
    teamsData: uefa98Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1997": {
    teamsData: uefa97Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1996": {
    teamsData: uefa96Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1995": {
    teamsData: uefa95Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1993": {
    teamsData: uefa93Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1994": {
    teamsData: uefa94Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "round_of_32",   matchday: 1 },
      { offset: 8,  stage: "round_of_32",   matchday: 2 },
      { offset: 13, stage: "round_of_16",   matchday: 1 },
      { offset: 18, stage: "round_of_16",   matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals",   matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1992": {
    teamsData: uefa92Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "round_of_32", matchday: 1 },
      { offset: 8, stage: "round_of_32", matchday: 2 },
      { offset: 13, stage: "round_of_16", matchday: 1 },
      { offset: 18, stage: "round_of_16", matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1991": {
    teamsData: uefa91Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "round_of_32", matchday: 1 },
      { offset: 8, stage: "round_of_32", matchday: 2 },
      { offset: 13, stage: "round_of_16", matchday: 1 },
      { offset: 18, stage: "round_of_16", matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals",   matchday: 2 },
      { offset: 41, stage: "final",         matchday: 1 }
    ]
  },
  "1990": {
    teamsData: uefa90Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "round_of_32", matchday: 1 },
      { offset: 8, stage: "round_of_32", matchday: 2 },
      { offset: 13, stage: "round_of_16", matchday: 1 },
      { offset: 18, stage: "round_of_16", matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals", matchday: 2 },
      { offset: 41, stage: "final", matchday: 1 }
    ]
  },
  "1989": {
    teamsData: uefa89Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "round_of_32", matchday: 1 },
      { offset: 8, stage: "round_of_32", matchday: 2 },
      { offset: 13, stage: "round_of_16", matchday: 1 },
      { offset: 18, stage: "round_of_16", matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals", matchday: 2 },
      { offset: 41, stage: "final", matchday: 1 }
    ]
  },
  "1988": {
    teamsData: uefa88Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "round_of_32", matchday: 1 },
      { offset: 8, stage: "round_of_32", matchday: 2 },
      { offset: 13, stage: "round_of_16", matchday: 1 },
      { offset: 18, stage: "round_of_16", matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals", matchday: 2 },
      { offset: 41, stage: "final", matchday: 1 }
    ]
  },
  "1987": {
    teamsData: uefa87Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "round_of_32", matchday: 1 },
      { offset: 8, stage: "round_of_32", matchday: 2 },
      { offset: 13, stage: "round_of_16", matchday: 1 },
      { offset: 18, stage: "round_of_16", matchday: 2 },
      { offset: 23, stage: "quarter_finals", matchday: 1 },
      { offset: 28, stage: "quarter_finals", matchday: 2 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals", matchday: 2 },
      { offset: 41, stage: "final", matchday: 1 }
    ]
  }
};
