import concacaf88Data from './concacaf88.json';
import concacaf89Data from './concacaf89.json';
import concacaf90Data from './concacaf90.json';
import concacaf91Data from './concacaf91.json';
import concacaf92Data from './concacaf92.json';
import concacaf93Data from './concacaf93.json';
import concacaf94Data from './concacaf94.json';
import concacaf95Data from './concacaf95.json';
import concacaf96Data from './concacaf96.json';
import concacaf97Data from './concacaf97.json';
import concacaf98Data from './concacaf98.json';
import concacaf99Data from './concacaf99.json';
import concacaf00Data from './concacaf00.json';
import concacaf01Data from './concacaf01.json';
import concacaf02Data from './concacaf02.json';
import concacaf03Data from './concacaf03.json';
import concacaf04Data from './concacaf04.json';
import concacaf05Data from './concacaf05.json';
import concacaf06Data from './concacaf06.json';
import concacaf07Data from './concacaf07.json';
import concacaf08Data from './concacaf08.json';
import concacaf09Data from './concacaf09.json';
import concacaf10Data from './concacaf10.json';
import concacaf11Data from './concacaf11.json';
import concacaf12Data from './concacaf12.json';
import concacaf13Data from './concacaf13.json';
import concacaf14Data from './concacaf14.json';
import concacaf15Data from './concacaf15.json';
import concacaf16Data from './concacaf16.json';
import concacaf17Data from './concacaf17.json';
import concacaf18Data from './concacaf18.json';
import concacaf19Data from './concacaf19.json';
import concacaf20Data from './concacaf20.json';
import concacaf21Data from './concacaf21.json';
import concacaf22Data from './concacaf22.json';
import concacaf23Data from './concacaf23.json';
import concacaf24Data from './concacaf24.json';
import concacaf25Data from './concacaf25.json';
import concacaf26Data from './concacaf26.json';

const pureKnockoutSchedule = [
  { offset: 4,  stage: "round_of_16",    matchday: 1 },
  { offset: 7,  stage: "round_of_16",    matchday: 2 },
  { offset: 12, stage: "quarter_finals", matchday: 1 },
  { offset: 15, stage: "quarter_finals", matchday: 2 },
  { offset: 20, stage: "semi_finals",    matchday: 1 },
  { offset: 23, stage: "semi_finals",    matchday: 2 },
  { offset: 27, stage: "final",          matchday: 1 }
];

const groupThenKnockoutSchedule = [
  { offset: 2,  stage: "group_stage",    matchday: 1 },
  { offset: 5,  stage: "group_stage",    matchday: 2 },
  { offset: 8,  stage: "group_stage",    matchday: 3 },
  { offset: 11, stage: "group_stage",    matchday: 4 },
  { offset: 14, stage: "group_stage",    matchday: 5 },
  { offset: 17, stage: "group_stage",    matchday: 6 },
  { offset: 21, stage: "quarter_finals", matchday: 1 },
  { offset: 24, stage: "quarter_finals", matchday: 2 },
  { offset: 27, stage: "semi_finals",    matchday: 1 },
  { offset: 30, stage: "semi_finals",    matchday: 2 },
  { offset: 33, stage: "final",          matchday: 1 }
];

export const concacafRules = {
  "1988": {
    teamsData: concacaf88Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1989": {
    teamsData: concacaf89Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1990": {
    teamsData: concacaf90Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1991": {
    teamsData: concacaf91Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1992": {
    teamsData: concacaf92Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1993": {
    teamsData: concacaf93Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1994": {
    teamsData: concacaf94Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1995": {
    teamsData: concacaf95Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1996": {
    teamsData: concacaf96Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1997": {
    teamsData: concacaf97Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1998": {
    teamsData: concacaf98Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "1999": {
    teamsData: concacaf99Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2000": {
    teamsData: concacaf00Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2001": {
    teamsData: concacaf01Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2002": {
    teamsData: concacaf02Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2003": {
    teamsData: concacaf03Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2004": {
    teamsData: concacaf04Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2005": {
    teamsData: concacaf05Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2006": {
    teamsData: concacaf06Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2007": {
    teamsData: concacaf07Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2008": {
    teamsData: concacaf08Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2009": {
    teamsData: concacaf09Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2010": {
    teamsData: concacaf10Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2011": {
    teamsData: concacaf11Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2012": {
    teamsData: concacaf12Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2013": {
    teamsData: concacaf13Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2014": {
    teamsData: concacaf14Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2015": {
    teamsData: concacaf15Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2016": {
    teamsData: concacaf16Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2017": {
    teamsData: concacaf17Data,
    format: "group_then_knockout",
    stages: ["group_stage", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: groupThenKnockoutSchedule
  },
  "2018": {
    teamsData: concacaf18Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2019": {
    teamsData: concacaf19Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2020": {
    teamsData: concacaf20Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2021": {
    teamsData: concacaf21Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2022": {
    teamsData: concacaf22Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2023": {
    teamsData: concacaf23Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2024": {
    teamsData: concacaf24Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2025": {
    teamsData: concacaf25Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  },
  "2026": {
    teamsData: concacaf26Data,
    format: "pure_knockout",
    stages: ["round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: pureKnockoutSchedule
  }
};
