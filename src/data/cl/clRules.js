import cl24Data from './cl24.json';
import cl23Data from './cl23.json';
import cl22Data from './cl22.json';
import cl21Data from './cl21.json';
import cl20Data from './cl20.json';
import cl19Data from './cl19.json';
import cl18Data from './cl18.json';
import cl17Data from './cl17.json';
import cl16Data from './cl16.json';
import cl15Data from './cl15.json';
import cl14Data from './cl14.json';
import cl13Data from './cl13.json';
import cl12Data from './cl12.json';
import cl11Data from './cl11.json';
import cl10Data from './cl10.json';
import cl09Data from './cl09.json';
import cl08Data from './cl08.json';
import cl07Data from './cl07.json';
import cl06Data from './cl06.json';
import cl97Data from './cl97.json';
import cl05Data from './cl05.json';
import cl04Data from './cl04.json';
import cl03Data from './cl03.json';
import cl02Data from './cl02.json';
import cl01Data from './cl01.json';
import cl00Data from './cl00.json';
import cl99Data from './cl99.json';
import cl98Data from './cl98.json';
import cl96Data from './cl96.json';
import cl95Data from './cl95.json';
import cl94Data from './cl94.json';
import cl93Data from './cl93.json';
import cl92Data from './cl92.json';
import cl91Data from './cl91.json';
import cl90Data from './cl90.json';
import cl89Data from './cl89.json';
import cl88Data from './cl88.json';
import cl87Data from './cl87.json';
import cl25Data from './cl25.json';
import cl26Data from './cl26.json';

export const clRules = {
  "2026": {
    teamsData: cl26Data,

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

    teamsData: cl25Data,
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
    teamsData: cl24Data,
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
    teamsData: cl23Data,
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
    teamsData: cl22Data,
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
    teamsData: cl21Data,
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
    teamsData: cl20Data,
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
  "2019": {
    teamsData: cl19Data,
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
  "2018": {
    teamsData: cl18Data,
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
  "2017": {
    teamsData: cl17Data,
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
  "2016": {
    teamsData: cl16Data,
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
  "2015": {
    teamsData: cl15Data,
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
  "2014": {
    teamsData: cl14Data,
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
  "2013": {
    teamsData: cl13Data,
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
  "2012": {
    teamsData: cl12Data,
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
  "2011": {
    teamsData: cl11Data,
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
  "2010": {
    teamsData: cl10Data,
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
  "2009": {
    teamsData: cl09Data,
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
  "2007": {
    teamsData: cl07Data,
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
  "2008": {
    teamsData: cl08Data,
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
  "2006": {
    teamsData: cl06Data,
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
  "2005": {
    teamsData: cl05Data,
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
  "2004": {
    teamsData: cl04Data,
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
    teamsData: cl03Data,
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
  "2002": {
    teamsData: cl02Data,
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
  "2001": {
    teamsData: cl01Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "group_stage", matchday: 7 },
      { offset: 23, stage: "group_stage", matchday: 8 },
      { offset: 26, stage: "group_stage", matchday: 9 },
      { offset: 29, stage: "group_stage", matchday: 10 },
      { offset: 32, stage: "group_stage", matchday: 11 },
      { offset: 35, stage: "group_stage", matchday: 12 },
      { offset: 37, stage: "quarter_finals", matchday: 1 },
      { offset: 39, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 43, stage: "semi_finals", matchday: 2 },
      { offset: 45, stage: "final", matchday: 1 }
    ]
  },
  "2000": {
    teamsData: cl00Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "group_stage", matchday: 7 },
      { offset: 23, stage: "group_stage", matchday: 8 },
      { offset: 26, stage: "group_stage", matchday: 9 },
      { offset: 29, stage: "group_stage", matchday: 10 },
      { offset: 32, stage: "group_stage", matchday: 11 },
      { offset: 35, stage: "group_stage", matchday: 12 },
      { offset: 37, stage: "quarter_finals", matchday: 1 },
      { offset: 39, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 43, stage: "semi_finals", matchday: 2 },
      { offset: 45, stage: "final", matchday: 1 }
    ]
  },
  "1999": {
    teamsData: cl99Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 2, stage: "group_stage", matchday: 1 },
      { offset: 5, stage: "group_stage", matchday: 2 },
      { offset: 8, stage: "group_stage", matchday: 3 },
      { offset: 11, stage: "group_stage", matchday: 4 },
      { offset: 14, stage: "group_stage", matchday: 5 },
      { offset: 17, stage: "group_stage", matchday: 6 },
      { offset: 20, stage: "group_stage", matchday: 7 },
      { offset: 23, stage: "group_stage", matchday: 8 },
      { offset: 26, stage: "group_stage", matchday: 9 },
      { offset: 29, stage: "group_stage", matchday: 10 },
      { offset: 32, stage: "group_stage", matchday: 11 },
      { offset: 35, stage: "group_stage", matchday: 12 },
      { offset: 37, stage: "quarter_finals", matchday: 1 },
      { offset: 39, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 43, stage: "semi_finals", matchday: 2 },
      { offset: 45, stage: "final", matchday: 1 }
    ]
  },
  "1998": {
    teamsData: cl98Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 33, stage: "quarter_finals", matchday: 1 },
      { offset: 36, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 44, stage: "semi_finals", matchday: 2 },
      { offset: 47, stage: "final", matchday: 1 }
    ]
  },
  "1997": {
    teamsData: cl97Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 33, stage: "quarter_finals", matchday: 1 },
      { offset: 36, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 44, stage: "semi_finals", matchday: 2 },
      { offset: 47, stage: "final", matchday: 1 }
    ]
  },
  "1996": {
    teamsData: cl96Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 33, stage: "quarter_finals", matchday: 1 },
      { offset: 36, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 44, stage: "semi_finals", matchday: 2 },
      { offset: 47, stage: "final", matchday: 1 }
    ]
  },
  "1995": {
    teamsData: cl95Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 33, stage: "quarter_finals", matchday: 1 },
      { offset: 36, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 44, stage: "semi_finals", matchday: 2 },
      { offset: 47, stage: "final", matchday: 1 }
    ]
  },
  "1993": {
    teamsData: cl93Data,
    format: "group_then_knockout",
    stages: ["group_stage", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3,  stage: "group_stage", matchday: 1 },
      { offset: 8,  stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 33, stage: "semi_finals", matchday: 1 },
      { offset: 36, stage: "semi_finals", matchday: 2 },
      { offset: 41, stage: "final",       matchday: 1 }
    ]
  },
  "1994": {
    teamsData: cl94Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 33, stage: "quarter_finals", matchday: 1 },
      { offset: 36, stage: "quarter_finals", matchday: 2 },
      { offset: 41, stage: "semi_finals", matchday: 1 },
      { offset: 44, stage: "semi_finals", matchday: 2 },
      { offset: 47, stage: "final", matchday: 1 }
    ]
  },
  "1992": {
    teamsData: cl92Data,
    format: "group_then_knockout",
    stages: ["group_stage", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 41, stage: "final", matchday: 1 }
    ]
  },
  "1991": {
    teamsData: cl91Data,
    format: "group_then_knockout",
    stages: ["group_stage", "final"],
    calendarSchedules: [
      { offset: 3, stage: "group_stage", matchday: 1 },
      { offset: 8, stage: "group_stage", matchday: 2 },
      { offset: 13, stage: "group_stage", matchday: 3 },
      { offset: 18, stage: "group_stage", matchday: 4 },
      { offset: 23, stage: "group_stage", matchday: 5 },
      { offset: 28, stage: "group_stage", matchday: 6 },
      { offset: 41, stage: "final", matchday: 1 }
    ]
  },
  "1990": {
    teamsData: cl90Data,
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
    teamsData: cl89Data,
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
    teamsData: cl88Data,
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
    teamsData: cl87Data,
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
