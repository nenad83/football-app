import csud02Data from './csud02.json';
import csud03Data from './csud03.json';
import csud04Data from './csud04.json';
import csud05Data from './csud05.json';
import csud06Data from './csud06.json';
import csud07Data from './csud07.json';
import csud08Data from './csud08.json';
import csud09Data from './csud09.json';
import csud10Data from './csud10.json';
import csud11Data from './csud11.json';
import csud12Data from './csud12.json';
import csud13Data from './csud13.json';
import csud14Data from './csud14.json';
import csud15Data from './csud15.json';
import csud16Data from './csud16.json';
import csud17Data from './csud17.json';
import csud18Data from './csud18.json';
import csud19Data from './csud19.json';
import csud20Data from './csud20.json';
import csud21Data from './csud21.json';
import csud22Data from './csud22.json';
import csud23Data from './csud23.json';
import csud24Data from './csud24.json';
import csud25Data from './csud25.json';
import csud26Data from './csud26.json';

const qfOnlyKnockoutSchedule = [
  { offset: 3,  stage: "quarter_finals", matchday: 1 },
  { offset: 8,  stage: "quarter_finals", matchday: 2 },
  { offset: 13, stage: "semi_finals",    matchday: 1 },
  { offset: 18, stage: "semi_finals",    matchday: 2 },
  { offset: 23, stage: "final",          matchday: 1 }
];

const knockout16Schedule = [
  { offset: 5,  stage: "round_of_16",   matchday: 1 },
  { offset: 10, stage: "round_of_16",   matchday: 2 },
  { offset: 15, stage: "quarter_finals", matchday: 1 },
  { offset: 20, stage: "quarter_finals", matchday: 2 },
  { offset: 25, stage: "semi_finals",   matchday: 1 },
  { offset: 30, stage: "semi_finals",   matchday: 2 },
  { offset: 35, stage: "final",         matchday: 1 }
];

const standardKnockoutSchedule = [
  { offset: 3,  stage: "round_of_32",   matchday: 1 },
  { offset: 8,  stage: "round_of_32",   matchday: 2 },
  { offset: 13, stage: "round_of_16",   matchday: 1 },
  { offset: 18, stage: "round_of_16",   matchday: 2 },
  { offset: 23, stage: "quarter_finals", matchday: 1 },
  { offset: 28, stage: "quarter_finals", matchday: 2 },
  { offset: 33, stage: "semi_finals",   matchday: 1 },
  { offset: 36, stage: "semi_finals",   matchday: 2 },
  { offset: 41, stage: "final",         matchday: 1 }
];

const groupSchedule = [
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
];

export const csudRules = {
  "2002": {
    teamsData: csud02Data,
    format: "pure_knockout",
    stages: ["quarter_finals", "semi_finals", "final"],
    calendarSchedules: qfOnlyKnockoutSchedule
  },
  "2003": {
    teamsData: csud03Data,
    format: "pure_knockout",
    stages: ["quarter_finals", "semi_finals", "final"],
    calendarSchedules: qfOnlyKnockoutSchedule
  },
  "2004": {
    teamsData: csud04Data,
    format: "pure_knockout",
    stages: ["quarter_finals", "semi_finals", "final"],
    calendarSchedules: qfOnlyKnockoutSchedule
  },
  "2005": {
    teamsData: csud05Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: knockout16Schedule
  },
  "2006": {
    teamsData: csud06Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: knockout16Schedule
  },
  "2007": {
    teamsData: csud07Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: knockout16Schedule
  },
  "2008": {
    teamsData: csud08Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: knockout16Schedule
  },
  "2009": {
    teamsData: csud09Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: knockout16Schedule
  },
  "2010": {
    teamsData: csud10Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2011": {
    teamsData: csud11Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2012": {
    teamsData: csud12Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2013": {
    teamsData: csud13Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2014": {
    teamsData: csud14Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2015": {
    teamsData: csud15Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2016": {
    teamsData: csud16Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2017": {
    teamsData: csud17Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2018": {
    teamsData: csud18Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2019": {
    teamsData: csud19Data,
    format: "pure_knockout",
    stages: ["round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardKnockoutSchedule
  },
  "2020": {
    teamsData: csud20Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  },
  "2021": {
    teamsData: csud21Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  },
  "2022": {
    teamsData: csud22Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  },
  "2023": {
    teamsData: csud23Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  },
  "2024": {
    teamsData: csud24Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  },
  "2025": {
    teamsData: csud25Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  },
  "2026": {
    teamsData: csud26Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupSchedule
  }
};
