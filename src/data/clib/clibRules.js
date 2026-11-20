import clib89Data from './clib89.json';
import clib90Data from './clib90.json';
import clib91Data from './clib91.json';
import clib92Data from './clib92.json';
import clib93Data from './clib93.json';
import clib94Data from './clib94.json';
import clib95Data from './clib95.json';
import clib96Data from './clib96.json';
import clib97Data from './clib97.json';
import clib98Data from './clib98.json';
import clib99Data from './clib99.json';
import clib00Data from './clib00.json';
import clib01Data from './clib01.json';
import clib02Data from './clib02.json';
import clib03Data from './clib03.json';
import clib04Data from './clib04.json';
import clib05Data from './clib05.json';
import clib06Data from './clib06.json';
import clib07Data from './clib07.json';
import clib08Data from './clib08.json';
import clib09Data from './clib09.json';
import clib10Data from './clib10.json';
import clib11Data from './clib11.json';
import clib12Data from './clib12.json';
import clib13Data from './clib13.json';
import clib14Data from './clib14.json';
import clib15Data from './clib15.json';
import clib16Data from './clib16.json';
import clib17Data from './clib17.json';
import clib18Data from './clib18.json';
import clib19Data from './clib19.json';
import clib20Data from './clib20.json';
import clib21Data from './clib21.json';
import clib22Data from './clib22.json';
import clib23Data from './clib23.json';
import clib24Data from './clib24.json';
import clib25Data from './clib25.json';
import clib26Data from './clib26.json';

const standardSchedule = [
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

export const clibRules = {
  "1989": {
    teamsData: clib89Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1990": {
    teamsData: clib90Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1991": {
    teamsData: clib91Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1992": {
    teamsData: clib92Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1993": {
    teamsData: clib93Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1994": {
    teamsData: clib94Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1995": {
    teamsData: clib95Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1996": {
    teamsData: clib96Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1997": {
    teamsData: clib97Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1998": {
    teamsData: clib98Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "1999": {
    teamsData: clib99Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2000": {
    teamsData: clib00Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2001": {
    teamsData: clib01Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2002": {
    teamsData: clib02Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2003": {
    teamsData: clib03Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2004": {
    teamsData: clib04Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2005": {
    teamsData: clib05Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2006": {
    teamsData: clib06Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2007": {
    teamsData: clib07Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2008": {
    teamsData: clib08Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2009": {
    teamsData: clib09Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2010": {
    teamsData: clib10Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2011": {
    teamsData: clib11Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2012": {
    teamsData: clib12Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2013": {
    teamsData: clib13Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2014": {
    teamsData: clib14Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2015": {
    teamsData: clib15Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2016": {
    teamsData: clib16Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2017": {
    teamsData: clib17Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2018": {
    teamsData: clib18Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2019": {
    teamsData: clib19Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2020": {
    teamsData: clib20Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2021": {
    teamsData: clib21Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2022": {
    teamsData: clib22Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2023": {
    teamsData: clib23Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2024": {
    teamsData: clib24Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2025": {
    teamsData: clib25Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  },
  "2026": {
    teamsData: clib26Data,
    format: "group_then_knockout",
    stages: ["group_stage", "round_of_16", "quarter_finals", "semi_finals", "final"],
    calendarSchedules: standardSchedule
  }
};
