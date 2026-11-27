import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import '../assets/styles/Match.css';
import { clRules } from '../data/cl/clRules';
import { uefaRules } from '../data/uefa/uefaRules';
import { ueclRules } from '../data/uecl/ueclRules';
import { clibRules } from '../data/clib/clibRules';
import { csudRules } from '../data/csud/csudRules';
import { concacafRules } from '../data/concacaf/concacafRules';
import { leagueDataMap, leagueDataMapD2 } from '../data/leagueData';
import { historicalRelegated, historicalPromoted } from '../data/historicalRelegationData';
import { leagueDataMapSA } from '../data/leagueDataSA';
import { leagueDataMapNA } from '../data/leagueDataNA';
import { qualifiersBySeason } from '../data/qualifiersBySeason';
import { qualifiersBySeasonSA } from '../data/qualifiersBySeasonSA';
import { qualifiersBySeasonNA } from '../data/qualifiersBySeasonNA';
import CountryFlag from './CountryFlag';
import RoundResultsModal from './RoundResultsModal';
import { FormationTacticsModal, getSavedFormation, getPreferredTeamFormation, updateTeamStatsInStorage, getPreviousSeasonString } from './FormationTactics';
import { updatePlayerConditionsAndInjuries } from './Match';
import TransferModal from './TransferModal';
import NewsFeed from './NewsFeed';
import Fixtures from './Fixtures';
import { createDomesticCup, advanceDomesticCup, getDomesticCupExpectation, CUP_STAGE_NAMES } from '../utils/domesticCupGenerator';
import { generateInitialNews, generateMatchdayNews, generateDomesticCupDrawNews, generateDomesticCupMatchNews, generateMonthlyAwardsNews, generateYearlyAwardsNews, generateRetirementNews, getQualitativeRating, appendAndPruneNews, pruneNewsFeed } from '../utils/newsGenerator';
import { checkMonthConclusion, generateMatchEvents, recordMatchEventsInStats, calculateMonthlyAwards, calculateYearlyAwards, awardManagerTitle, repairCareerAwardManagerNames } from '../utils/awardsManager';
import { loadSeasonRosters, cleanStale1To5Rosters, scaleStatTo10, getTeamDetailsSync, getPrebuiltRoster, getTransferMarketPool, advancePlayerSquadForNextSeason, calculateSquadTacticalAverages, clearCareerTransferLedger } from '../data/rosters/rosterRegistry';
import { applyTeamTheme, resetToDefaultTheme } from '../utils/themeManager';
import { simulateFixture as simulateFixtureEngine } from '../utils/matchEngine';
import { calculateBoardExpectation } from '../utils/boardExpectationEngine';
import WorldTablesPanel from './WorldTablesPanel';
import WorldJobsPanel from './WorldJobsPanel';
import ManagerProfilePanel from './ManagerProfilePanel';
import NationFlag from './NationFlag';
import { NATIONALITIES } from '../utils/nationalities';
import {
  calculateManagerPrestige,
  getManagerLevelProgress,
  loadManagerProfileFromStorage,
  recordLiveUserMatchToProfile,
  finalizeStintAndSeasonToProfile
} from '../utils/managerProgression';
import {
  syncWorldProgressAndJobs,
  carryoverWorldForNextSeason,
  prepareMidSeasonTakeover,
  applyForVacancy,
  enterUnemployedMode,
  simulateUnemployedWeek
} from '../utils/worldCareerManager';
import {
  isUefaCountryBanned,
  determineEuropeanQualifier,
  generateDynamicSchedules,
  pickQualifierOpponent,
  buildEuropeanCupSetup,
  insertEuropeanEventsIntoCalendar,
  resolveTwoLegTie,
  getQualifierCompetitionTitle,
  isSameEuropeanClubName
} from '../utils/europeanQualifierHelper';
import {
  HISTORICAL_FEDERATION_COUNTRIES,
  buildExYugoslaviaNextSeason,
  getSuccessorFederation
} from '../utils/exYugoslaviaRollover';

const SA_COUNTRIES = new Set(["argentina", "brazil", "colombia"]);
const NA_COUNTRIES = new Set(["usa", "mexico"]);

const getLeagueRoundCycles = (countryKey, teamsCount) => {
  if (countryKey === "usa") return 1;
  if ((countryKey === "scotland" || countryKey === "denmark" || countryKey === "croatia" || countryKey === "serbia" || countryKey === "fr_yugoslavia") && teamsCount === 12) return 3;
  if ((countryKey === "scotland" || countryKey === "croatia") && teamsCount === 10) return 4;
  return 2;
};

const getTotalLeagueRounds = (teamsList, countryKey, fixturesList) => {
  if (fixturesList && fixturesList.length > 0) return fixturesList.length;
  if (!teamsList || teamsList.length === 0) return 38;
  const base = teamsList.length % 2 === 0 ? teamsList.length - 1 : teamsList.length;
  return base * getLeagueRoundCycles(countryKey, teamsList.length);
};

// Unified Match Simulation Helper
const simulateFixture = (h, a) => {
  return simulateFixtureEngine(h, a);
};

const updateFanConfidence = (currentConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals) => {
  const pRating = playerTeam ? (playerTeam.attack + playerTeam.midfield + playerTeam.defense) / 3 : 3.0;
  const oRating = opponentTeam ? (opponentTeam.attack + opponentTeam.midfield + opponentTeam.defense) / 3 : 3.0;
  const is10 = (pRating > 5 || oRating > 5);
  const factor = is10 ? 0.5 : 1.0;

  let change = 0;
  if (playerGoals > opponentGoals) {
    change = 6 + Math.round((oRating - pRating) * 4.5 * factor);
    change = Math.max(3, change);
  } else if (playerGoals < opponentGoals) {
    change = -6 + Math.round((oRating - pRating) * 4.5 * factor);
    change = Math.min(-3, change);
  } else {
    change = -2 + Math.round((oRating - pRating) * 5 * factor);
    change = Math.max(-8, Math.min(8, change));
  }

  const startingConf = currentConfidence !== undefined ? currentConfidence : 50;
  return Math.max(0, Math.min(100, startingConf + change));
};

// Curated pool of backup teams for simulated promotion/relegation when advancing seasons
const countryBackupTeams = {
  england: [
    { name: "Nottingham Forest", primaryColor: "#DD0000", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Leicester City", primaryColor: "#003090", secondaryColor: "#F0A000", kit: "swe92/4.png" },
    { name: "Norwich City", primaryColor: "#FFF200", secondaryColor: "#00A651", kit: "ger88/0.png" },
    { name: "Ipswich Town", primaryColor: "#004B93", secondaryColor: "#FFFFFF", kit: "fra84/1.png" },
    { name: "Crystal Palace", primaryColor: "#1B458F", secondaryColor: "#C4122E", kit: "fra84/3.png" },
    { name: "Middlesbrough", primaryColor: "#E2001A", secondaryColor: "#FFFFFF", kit: "ger88/2.png" },
    { name: "West Bromwich Albion", primaryColor: "#122F67", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Bolton Wanderers", primaryColor: "#FFFFFF", secondaryColor: "#122F67", kit: "ecu93/3.png" },
    { name: "Sunderland", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", kit: "swe92/4.png" },
    { name: "Derby County", primaryColor: "#FFFFFF", secondaryColor: "#000000", kit: "ecu93/3.png" },
    { name: "Sheffield United", primaryColor: "#E01E22", secondaryColor: "#FFFFFF", kit: "swe92/4.png" },
    { name: "Blackburn Rovers", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" }
  ],
  spain: [
    { name: "Real Zaragoza", primaryColor: "#FFFFFF", secondaryColor: "#0000FF", kit: "swe92/0.png" },
    { name: "Real Betis", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Celta Vigo", primaryColor: "#87CEEB", secondaryColor: "#FFFFFF", kit: "ger88/3.png" },
    { name: "Real Sociedad", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "RCD Mallorca", primaryColor: "#E2001A", secondaryColor: "#000000", kit: "fra84/4.png" },
    { name: "Malaga", primaryColor: "#00A3E0", secondaryColor: "#FFFFFF", kit: "ger88/3.png" },
    { name: "Rayo Vallecano", primaryColor: "#FFFFFF", secondaryColor: "#FF0000", kit: "swe92/4.png" },
    { name: "Getafe", primaryColor: "#0000FF", secondaryColor: "#0000FF", kit: "ecu93/1.png" }
  ],
  germany: [
    { name: "VfL Bochum", primaryColor: "#005CA9", secondaryColor: "#FFFFFF", kit: "ger88/2.png" },
    { name: "MSV Duisburg", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "1. FC Kaiserslautern", primaryColor: "#E30613", secondaryColor: "#E30613", kit: "fra84/1.png" },
    { name: "Karlsruher SC", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "SC Freiburg", primaryColor: "#E30613", secondaryColor: "#000000", kit: "fra84/1.png" },
    { name: "1. FC Koln", primaryColor: "#FFFFFF", secondaryColor: "#E30613", kit: "swe92/0.png" },
    { name: "Borussia Monchengladbach", primaryColor: "#FFFFFF", secondaryColor: "#008000", kit: "swe92/2.png" }
  ],
  italy: [
    { name: "Bari", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Brescia", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "Venezia", primaryColor: "#008000", secondaryColor: "#FFA500", kit: "swe92/2.png" },
    { name: "Verona", primaryColor: "#FFFF00", secondaryColor: "#0000FF", kit: "mex86/3.png" },
    { name: "Lecce", primaryColor: "#FFFF00", secondaryColor: "#FF0000", kit: "mex86/3.png" },
    { name: "Empoli", primaryColor: "#0000FF", secondaryColor: "#0000FF", kit: "ecu93/1.png" },
    { name: "Cagliari", primaryColor: "#0000FF", secondaryColor: "#FF0000", kit: "ecu93/1.png" }
  ],
  france: [
    { name: "Strasbourg", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "Le Havre", primaryColor: "#87CEEB", secondaryColor: "#000080", kit: "ger88/3.png" },
    { name: "Nimes", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Caen", primaryColor: "#0000FF", secondaryColor: "#FF0000", kit: "ecu93/1.png" },
    { name: "Toulouse", primaryColor: "#4B0082", secondaryColor: "#FFFFFF", kit: "swe92/3.png" },
    { name: "Auxerre", primaryColor: "#FFFFFF", secondaryColor: "#0000FF", kit: "swe92/0.png" },
    { name: "Sochaux", primaryColor: "#FFFF00", secondaryColor: "#0000FF", kit: "mex86/3.png" }
  ],
  russia: [
    { name: "Saturn Moscow Region", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "Anzhi Makhachkala", primaryColor: "#FFFF00", secondaryColor: "#008000", kit: "swe92/0.png" },
    { name: "Uralan Elista", primaryColor: "#FFFF00", secondaryColor: "#0000FF", kit: "mex86/3.png" },
    { name: "Fakel Voronezh", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "Lokomotiv Nizhny Novgorod", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", kit: "swe92/4.png" },
    { name: "Rostselmash Rostov", primaryColor: "#FFFF00", secondaryColor: "#0000FF", kit: "mex86/3.png" },
    { name: "Tyumen", primaryColor: "#FFFFFF", secondaryColor: "#000000", kit: "ecu93/3.png" },
    { name: "Dynamo Stavropol", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ecu93/1.png" },
    { name: "Sokol Saratov", primaryColor: "#FFFFFF", secondaryColor: "#0000FF", kit: "ecu93/3.png" },
    { name: "Lada Togliatti", primaryColor: "#CC0000", secondaryColor: "#FFFFFF", kit: "fra84/4.png" },
    { name: "Baltika Kaliningrad", primaryColor: "#005BAA", secondaryColor: "#FFFFFF", kit: "fra84/5.png" },
    { name: "Zhemchuzhina Sochi", primaryColor: "#FFA500", secondaryColor: "#008000", kit: "swe92/2.png" },
    { name: "Asmaral Moscow", primaryColor: "#003399", secondaryColor: "#FFFFFF", kit: "swe92/3.png" },
    { name: "Okean Nakhodka", primaryColor: "#000080", secondaryColor: "#FFFFFF", kit: "swe92/5.png" },
    { name: "Shinnik Yaroslavl", primaryColor: "#FFD700", secondaryColor: "#000000", kit: "fra84/6.png" }
  ],
  portugal: [
    { name: "Gil Vicente", primaryColor: "#FF0000", secondaryColor: "#0000FF", kit: "ger88/3.png" },
    { name: "Beira-Mar", primaryColor: "#FFFF00", secondaryColor: "#000000", kit: "mex86/3.png" },
    { name: "Chaves", primaryColor: "#0000FF", secondaryColor: "#FF0000", kit: "ecu93/1.png" },
    { name: "Paços de Ferreira", primaryColor: "#FFFF00", secondaryColor: "#008000", kit: "ecu93/2.png" },
    { name: "Estrela da Amadora", primaryColor: "#FF0000", secondaryColor: "#008000", kit: "swe92/2.png" },
    { name: "Famalicão", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Tirsense", primaryColor: "#E30613", secondaryColor: "#FFFFFF", kit: "fra84/4.png" },
    { name: "Rio Ave", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Nacional", primaryColor: "#000000", secondaryColor: "#FFFFFF", kit: "ecu93/3.png" },
    { name: "Salgueiros", primaryColor: "#DD0000", secondaryColor: "#FFFFFF", kit: "ger88/2.png" },
    { name: "Belenenses", primaryColor: "#000080", secondaryColor: "#FFFFFF", kit: "swe92/5.png" }
  ],
  argentina: [
    { name: "Tigre", primaryColor: "#FF6600", secondaryColor: "#000080", kit: "ecu93/1.png" },
    { name: "Colon", primaryColor: "#FF0000", secondaryColor: "#000000", kit: "fra84/1.png" },
    { name: "Belgrano", primaryColor: "#FFFFFF", secondaryColor: "#000080", kit: "swe92/0.png" },
    { name: "Godoy Cruz", primaryColor: "#006400", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Quilmes", primaryColor: "#FFFFFF", secondaryColor: "#4B0082", kit: "swe92/3.png" },
    { name: "Olimpo", primaryColor: "#000000", secondaryColor: "#FFFFFF", kit: "ecu93/3.png" },
    { name: "San Martin San Juan", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" }
  ],
  brazil: [
    { name: "Goias", primaryColor: "#006400", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Coritiba", primaryColor: "#006400", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Vitoria", primaryColor: "#CC0000", secondaryColor: "#000000", kit: "fra84/1.png" },
    { name: "Joinville", primaryColor: "#FFFFFF", secondaryColor: "#000080", kit: "swe92/0.png" },
    { name: "Chapecoense", primaryColor: "#006400", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Avai", primaryColor: "#000080", secondaryColor: "#FFFFFF", kit: "swe92/5.png" },
    { name: "Sport Recife", primaryColor: "#CC0000", secondaryColor: "#000000", kit: "fra84/1.png" }
  ],
  colombia: [
    { name: "Águilas Doradas", primaryColor: "#FFD700", secondaryColor: "#000000", kit: "swe92/0.png" },
    { name: "Quindío", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" },
    { name: "Real Cartagena", primaryColor: "#FF0000", secondaryColor: "#008000", kit: "swe92/0.png" },
    { name: "Itagüí", primaryColor: "#FFD700", secondaryColor: "#008000", kit: "swe92/0.png" },
    { name: "Jaguares de Córdoba", primaryColor: "#FFFF00", secondaryColor: "#008000", kit: "swe92/0.png" },
    { name: "Alianza Petrolera", primaryColor: "#FFFF00", secondaryColor: "#000000", kit: "swe92/0.png" },
    { name: "Llaneros", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "ecu93/2.png" }
  ],
  netherlands: [
    { name: "VVV-Venlo", primaryColor: "#FFFF00", secondaryColor: "#000000", kit: "mex86/3.png" },
    { name: "FC Den Bosch", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "swe92/5.png" },
    { name: "Go Ahead Eagles", primaryColor: "#FF0000", secondaryColor: "#FFFF00", kit: "swe92/4.png" },
    { name: "sc Heerenveen", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "swe92/5.png" },
    { name: "NEC Nijmegen", primaryColor: "#FF0000", secondaryColor: "#008000", kit: "fra84/3.png" },
    { name: "FC Utrecht", primaryColor: "#FF0000", secondaryColor: "#FFFFFF", kit: "fra84/1.png" },
    { name: "FC Volendam", primaryColor: "#FF4500", secondaryColor: "#000000", kit: "swe92/2.png" },
    { name: "Cambuur", primaryColor: "#FFFF00", secondaryColor: "#0000FF", kit: "mex86/3.png" },
    { name: "NAC Breda", primaryColor: "#FFFF00", secondaryColor: "#000000", kit: "mex86/3.png" },
    { name: "De Graafschap", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "swe92/5.png" }
  ],
  scotland: [
    { name: "Partick Thistle", primaryColor: "#E51E25", secondaryColor: "#FFD700", kit: "ger88/4.png" },
    { name: "Falkirk", primaryColor: "#00205B", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Livingston", primaryColor: "#FFD700", secondaryColor: "#000000", kit: "mex86/3.png" },
    { name: "Inverness Caledonian Thistle", primaryColor: "#00205B", secondaryColor: "#E51E25", kit: "swe92/2.png" },
    { name: "Raith Rovers", primaryColor: "#00205B", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Dunfermline Athletic", primaryColor: "#000000", secondaryColor: "#FFFFFF", kit: "swe92/3.png" },
    { name: "Ayr United", primaryColor: "#FFFFFF", secondaryColor: "#000000", kit: "swe92/0.png" },
    { name: "Greenock Morton", primaryColor: "#0000FF", secondaryColor: "#FFFFFF", kit: "swe92/5.png" },
    { name: "Airdrieonians", primaryColor: "#CC0000", secondaryColor: "#FFFFFF", kit: "fra84/1.png" }
  ],
  ukraine: [
    { name: "Metalist 1925 Kharkiv", primaryColor: "#FFD700", secondaryColor: "#003399", kit: "mex86/3.png" },
    { name: "FC Mynai", primaryColor: "#003366", secondaryColor: "#00CCFF", kit: "swe92/0.png" },
    { name: "Inhulets Petrove", primaryColor: "#FFD700", secondaryColor: "#CC0000", kit: "mex86/3.png" },
    { name: "FC Lviv", primaryColor: "#003399", secondaryColor: "#FFCC00", kit: "swe92/0.png" },
    { name: "Olimpik Donetsk", primaryColor: "#005BAA", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Desna Chernihiv", primaryColor: "#005BAA", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Mariupol", primaryColor: "#FF8C00", secondaryColor: "#005BAA", kit: "ecu93/1.png" },
    { name: "Volyn Lutsk", primaryColor: "#CC0000", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Bukovyna Chernivtsi", primaryColor: "#FFFF00", secondaryColor: "#000000", kit: "mex86/3.png" }
  ],
  belgium: [
    { name: "Westerlo", primaryColor: "#FFCC00", secondaryColor: "#0033A0", kit: "mex86/3.png" },
    { name: "Sint-Truiden", primaryColor: "#FFDD00", secondaryColor: "#003399", kit: "mex86/3.png" },
    { name: "Kortrijk", primaryColor: "#CC0000", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "OH Leuven", primaryColor: "#FFFFFF", secondaryColor: "#111111", kit: "swe92/0.png" },
    { name: "Zulte Waregem", primaryColor: "#800020", secondaryColor: "#008000", kit: "swe92/4.png" },
    { name: "Beveren", primaryColor: "#FFD700", secondaryColor: "#0047AB", kit: "mex86/3.png" },
    { name: "Lokeren", primaryColor: "#FFFFFF", secondaryColor: "#111111", kit: "swe92/0.png" },
    { name: "Dender", primaryColor: "#003399", secondaryColor: "#111111", kit: "swe92/0.png" },
    { name: "Eupen", primaryColor: "#111111", secondaryColor: "#FFFFFF", kit: "swe92/3.png" }
  ],
  sweden: [
    { name: "GAIS", primaryColor: "#007A3D", secondaryColor: "#111111", kit: "swe92/1.png" },
    { name: "Degerfors IF", primaryColor: "#CC0000", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Osters IF", primaryColor: "#CC0000", secondaryColor: "#0047AB", kit: "ger88/1.png" },
    { name: "GIF Sundsvall", primaryColor: "#0047AB", secondaryColor: "#FFD700", kit: "swe92/0.png" },
    { name: "Halmstads BK", primaryColor: "#0047AB", secondaryColor: "#111111", kit: "swe92/0.png" },
    { name: "Trelleborgs FF", primaryColor: "#0047AB", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Orgryte IS", primaryColor: "#CC0000", secondaryColor: "#0047AB", kit: "ger88/1.png" },
    { name: "Gefle IF", primaryColor: "#5BC2E7", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Vasteras SK", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "swe92/1.png" }
  ],
  denmark: [
    { name: "Vejle", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Lyngby", primaryColor: "#0047AB", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "SonderjyskE", primaryColor: "#5BC2E7", secondaryColor: "#111111", kit: "swe92/0.png" },
    { name: "AC Horsens", primaryColor: "#FFD700", secondaryColor: "#111111", kit: "mex86/3.png" },
    { name: "Esbjerg", primaryColor: "#0047AB", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Viborg", primaryColor: "#008000", secondaryColor: "#FFFFFF", kit: "swe92/1.png" },
    { name: "Hobro", primaryColor: "#FFD700", secondaryColor: "#0038A8", kit: "mex86/3.png" },
    { name: "Hvidovre", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Fredericia", primaryColor: "#D90429", secondaryColor: "#111111", kit: "ger88/1.png" }
  ],
  yugoslavia: [
    { name: "Napredak Krusevac", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "OFK Beograd", primaryColor: "#005EB8", secondaryColor: "#FFFFFF", kit: "swe92/5.png" },
    { name: "Celik Zenica", primaryColor: "#D90429", secondaryColor: "#000000", kit: "ger88/1.png" }
  ],
  fr_yugoslavia: [
    { name: "Napredak Krusevac", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Radnicki Nis", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "ger88/1.png" },
    { name: "Borac Cacak", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "swe92/3.png" }
  ],
  serbia: [
    { name: "Javor Ivanjica", primaryColor: "#FFFFFF", secondaryColor: "#005EB8", kit: "swe92/0.png" },
    { name: "Radnik Surdulica", primaryColor: "#005EB8", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Metalac Gornji Milanovac", primaryColor: "#005EB8", secondaryColor: "#FFFFFF", kit: "swe92/0.png" }
  ],
  croatia: [
    { name: "Cibalia", primaryColor: "#005EB8", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Rudes", primaryColor: "#003399", secondaryColor: "#FFFFFF", kit: "swe92/0.png" },
    { name: "Orijent", primaryColor: "#D90429", secondaryColor: "#FFFFFF", kit: "ger88/1.png" }
  ],
  ussr: [
    { name: "Neftchi Baku", primaryColor: "#000000", secondaryColor: "#FFFFFF", kit: "swe92/3.png" },
    { name: "Kairat Almaty", primaryColor: "#FFD700", secondaryColor: "#000000", kit: "mex86/3.png" },
    { name: "Rotor Volgograd", primaryColor: "#003399", secondaryColor: "#FFFFFF", kit: "swe92/0.png" }
  ]
};

// Berger tables generator for fixture creation (inserts a bye slot when teamsList.length is odd)
const generateRoundRobinFixtures = (teamsList, cyclesInput = 2) => {
  const cycles = typeof cyclesInput === 'boolean' ? (cyclesInput ? 1 : 2) : Math.max(1, cyclesInput || 2);
  const list = teamsList.length % 2 === 0 ? [...teamsList] : [...teamsList, null];
  const n = list.length;
  const firstLeg = [];

  for (let round = 0; round < n - 1; round++) {
    const roundFixtures = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (!home || !away) continue;
      if (round % 2 === 0) {
        roundFixtures.push({ homeId: home.idnum, awayId: away.idnum, played: false, homeScore: 0, awayScore: 0 });
      } else {
        roundFixtures.push({ homeId: away.idnum, awayId: home.idnum, played: false, homeScore: 0, awayScore: 0 });
      }
    }
    firstLeg.push(roundFixtures);
    list.splice(1, 0, list.pop());
  }

  const fixtures = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    const swapHomeAway = cycle % 2 === 1;
    for (let round = 0; round < firstLeg.length; round++) {
      const roundFixtures = firstLeg[round].map(f => ({
        homeId: swapHomeAway ? f.awayId : f.homeId,
        awayId: swapHomeAway ? f.homeId : f.awayId,
        played: false,
        homeScore: 0,
        awayScore: 0
      }));
      fixtures.push(roundFixtures);
    }
  }

  return fixtures;
};

// Inline premium vector Team Flag component

const TeamFlag = ({ primaryColor, secondaryColor, size = 120 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const flagHeight = Math.round(size * 0.65);

  return (
    <svg
      width={size}
      height={flagHeight}
      viewBox="0 0 100 65"
      className="team-flag"
      style={{
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1.5px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    >
      {isSolid ? (
        <rect width="100" height="65" fill={primaryColor} />
      ) : (
        <>
          <rect x="0" width="50" height="65" fill={primaryColor} />
          <rect x="50" width="50" height="65" fill={secondaryColor} />
        </>
      )}
    </svg>
  );
};

const STAGE_ORDER = {
  "group_stage": 1,
  "league_stage": 1,
  "round_of_32": 2,
  "playoffs": 2.5,
  "round_of_16": 3,
  "quarter_finals": 4,
  "semi_finals": 5,
  "final": 6,
  "winner": 7
};

const getRulesGlobal = (cup, yr, isSouthAmerica, isNorthAmerica = false) => {
  if (isNorthAmerica) {
    if (cup === "cl") return concacafRules[yr] || concacafRules["2010"];
    return null;
  } else if (isSouthAmerica) {
    if (cup === "cl") return clibRules[yr] || clibRules["2010"];
    if (cup === "uefa") return csudRules[yr] || csudRules["2010"];
    return null;
  } else {
    if (cup === "cl") return clRules[yr] || clRules["1993"];
    if (cup === "uefa") return uefaRules[yr] || uefaRules["1993"];
    if (cup === "uecl") return ueclRules[yr] || ueclRules["2021"];
    return null;
  }
};

const getPlayerCupStatus = (state, isSouthAmerica) => {
  if (!state.europeanCup || !state.europeanCupState) {
    return { active: false, stageReached: null, isEliminated: false, isWinner: false };
  }
  const { europeanCupState, season } = state;
  const pId = europeanCupState.europeanPlayerTeamId;
  if (!pId) {
    return { active: false, stageReached: null, isEliminated: false, isWinner: false };
  }

  const seasonShort = season.split("/")[0];
  const isNorthAmerica = state.region === "north_america" || NA_COUNTRIES.has(state.country);
  const rules = getRulesGlobal(state.europeanCup, seasonShort, isSouthAmerica, isNorthAmerica);
  if (!rules) {
    return { active: false, stageReached: null, isEliminated: false, isWinner: false };
  }

  const knockoutState = europeanCupState.knockoutState || {};

  // 1. Check Final
  if (knockoutState.final && knockoutState.final.length > 0) {
    const f = knockoutState.final[0];
    const isInFinal = f.homeId === pId || f.awayId === pId;
    if (isInFinal) {
      if (f.played) {
        const hScore = f.homeScore + (f.penaltyHomeScore || 0);
        const aScore = f.awayScore + (f.penaltyAwayScore || 0);
        const won = (f.homeId === pId && hScore > aScore) || (f.awayId === pId && aScore > hScore);
        if (won) {
          return { active: false, stageReached: "final", isEliminated: false, isWinner: true };
        } else {
          return { active: false, stageReached: "final", isEliminated: true, isWinner: false };
        }
      } else {
        return { active: true, stageReached: "final", isEliminated: false, isWinner: false };
      }
    }
  }

  // 2. Check Semi Finals
  if (knockoutState.semiFinalsLeg1 && knockoutState.semiFinalsLeg1.length > 0) {
    const sf1 = knockoutState.semiFinalsLeg1;
    const isInSf = sf1.some(m => m.homeId === pId || m.awayId === pId);
    if (isInSf) {
      if (knockoutState.final && knockoutState.final.length > 0) {
        const f = knockoutState.final[0];
        const isInFinal = f.homeId === pId || f.awayId === pId;
        if (!isInFinal) {
          return { active: false, stageReached: "semi_finals", isEliminated: true, isWinner: false };
        }
      }
      return { active: true, stageReached: "semi_finals", isEliminated: false, isWinner: false };
    }
  }

  // 3. Check Quarter Finals
  if (knockoutState.quarterFinalsLeg1 && knockoutState.quarterFinalsLeg1.length > 0) {
    const qf1 = knockoutState.quarterFinalsLeg1;
    const isInQf = qf1.some(m => m.homeId === pId || m.awayId === pId);
    if (isInQf) {
      if (knockoutState.semiFinalsLeg1 && knockoutState.semiFinalsLeg1.length > 0) {
        const isInSf = knockoutState.semiFinalsLeg1.some(m => m.homeId === pId || m.awayId === pId);
        if (!isInSf) {
          return { active: false, stageReached: "quarter_finals", isEliminated: true, isWinner: false };
        }
      }
      return { active: true, stageReached: "quarter_finals", isEliminated: false, isWinner: false };
    }
  }

  // 4. Check Round of 16
  if (knockoutState.roundOf16Leg1 && knockoutState.roundOf16Leg1.length > 0) {
    const r16 = knockoutState.roundOf16Leg1;
    const isInR16 = r16.some(m => m.homeId === pId || m.awayId === pId);
    if (isInR16) {
      if (knockoutState.quarterFinalsLeg1 && knockoutState.quarterFinalsLeg1.length > 0) {
        const isInQf = knockoutState.quarterFinalsLeg1.some(m => m.homeId === pId || m.awayId === pId);
        if (!isInQf) {
          return { active: false, stageReached: "round_of_16", isEliminated: true, isWinner: false };
        }
      }
      return { active: true, stageReached: "round_of_16", isEliminated: false, isWinner: false };
    }
  }

  // 5. Check Playoffs
  if (knockoutState.playoffsLeg1 && knockoutState.playoffsLeg1.length > 0) {
    const po = knockoutState.playoffsLeg1;
    const isInPo = po.some(m => m.homeId === pId || m.awayId === pId);
    if (isInPo) {
      if (knockoutState.roundOf16Leg1 && knockoutState.roundOf16Leg1.length > 0) {
        const isInR16 = knockoutState.roundOf16Leg1.some(m => m.homeId === pId || m.awayId === pId);
        if (!isInR16) {
          return { active: false, stageReached: "playoffs", isEliminated: true, isWinner: false };
        }
      }
      return { active: true, stageReached: "playoffs", isEliminated: false, isWinner: false };
    } else {
      const top8Ids = knockoutState.top8Ids || [];
      if (top8Ids.includes(pId)) {
        return { active: true, stageReached: "league_stage", isEliminated: false, isWinner: false };
      }
    }
  }

  // 6. Check Round of 32
  if (knockoutState.roundOf32Leg1 && knockoutState.roundOf32Leg1.length > 0) {
    const r32 = knockoutState.roundOf32Leg1;
    const isInR32 = r32.some(m => m.homeId === pId || m.awayId === pId);
    if (isInR32) {
      if (knockoutState.roundOf16Leg1 && knockoutState.roundOf16Leg1.length > 0) {
        const isInR16 = knockoutState.roundOf16Leg1.some(m => m.homeId === pId || m.awayId === pId);
        if (!isInR16) {
          return { active: false, stageReached: "round_of_32", isEliminated: true, isWinner: false };
        }
      }
      return { active: true, stageReached: "round_of_32", isEliminated: false, isWinner: false };
    }
  }

  const hasStartedKnockouts = Object.values(knockoutState).some(val => val !== null && val.length > 0);
  if (hasStartedKnockouts) {
    const groupStageKey = rules.format === "league_then_knockout" ? "league_stage" : "group_stage";
    return { active: false, stageReached: groupStageKey, isEliminated: true, isWinner: false };
  }

  const initialStage = rules.format === "league_then_knockout" ? "league_stage" : "group_stage";
  const isInCupTeams = europeanCupState.teams.some(t => t.idnum === pId);
  if (isInCupTeams) {
    return { active: true, stageReached: initialStage, isEliminated: false, isWinner: false };
  }

  return { active: false, stageReached: null, isEliminated: false, isWinner: false };
};

const getCupExpectation = (team, cup, rules, cupTeams) => {
  if (!team || !cup || !rules || !cupTeams || cupTeams.length === 0) return null;

  const sortedCupTeams = [...cupTeams]
    .map(t => ({ idnum: t.idnum, rating: (t.attack + t.midfield + t.defense) / 3 }))
    .sort((a, b) => b.rating - a.rating);
  const teamIndex = sortedCupTeams.findIndex(t => t.idnum === team.idnum);
  const rank = teamIndex !== -1 ? teamIndex + 1 : 1;
  const N = cupTeams.length;
  const pct = rank / N;

  const stages = rules.stages;

  let targetStage = "";
  let text = "";

  if (pct <= 0.10) {
    targetStage = "final";
    text = "Win the Cup!";
  } else if (pct <= 0.30) {
    targetStage = "semi_finals";
    text = "Reach the Semi Finals";
  } else if (pct <= 0.55) {
    targetStage = "quarter_finals";
    text = "Reach the Quarter Finals";
  } else {
    if (stages.includes("round_of_16")) {
      targetStage = "round_of_16";
      text = "Reach Round of 16";
    } else if (stages.includes("group_stage") || stages.includes("league_stage")) {
      targetStage = stages.includes("league_stage") ? "league_stage" : "group_stage";
      text = "Play Competitively";
    } else {
      targetStage = stages[1] || stages[0];
      text = "Reach Second Round";
    }
  }

  return { text, targetStage, pct };
};

const getBoardConfidence = (state, standingsList, playerPos, isSouthAmerica) => {
  if (!state) return 100;
  const expObj = state.boardExpectation || { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };
  const expRank = expObj.rank || 17;
  const diff = playerPos - expRank;
  const isRelegated = playerPos > (state.teams.length - 3);

  // League score calculation
  let leagueScore = 75;
  if (diff < 0) {
    leagueScore = Math.min(100, 75 + Math.abs(diff) * 4);
  } else if (diff > 0) {
    leagueScore = Math.max(0, 75 - diff * 12);
  }
  if (isRelegated) {
    leagueScore = Math.max(0, leagueScore - 15);
  }

  // If player is in 1st place, reward them with high confidence
  if (playerPos === 1) {
    const totalRounds = getTotalLeagueRounds(state.teams, state.country, state.fixtures);
    const isSeasonOver = (state.calendar ? state.calendarIndex >= state.calendar.length : state.currentRound > totalRounds);
    leagueScore = Math.max(leagueScore, isSeasonOver ? 100 : 95);
  }

  // Cup score calculation
  if (state.europeanCup && state.europeanCupState) {
    const isNorthAmerica = state.region === "north_america" || NA_COUNTRIES.has(state.country);
    const rules = getRulesGlobal(state.europeanCup, state.season.split("/")[0], isSouthAmerica, isNorthAmerica);
    const pId = state.europeanCupState.europeanPlayerTeamId;
    const cupTeam = state.europeanCupState.teams.find(t => t.idnum === pId);

    if (cupTeam && rules) {
      const cupExpectation = getCupExpectation(cupTeam, state.europeanCup, rules, state.europeanCupState.teams);
      const cupStatus = getPlayerCupStatus(state, isSouthAmerica);

      if (cupExpectation && cupStatus && cupStatus.stageReached) {
        let cupScore = 75;
        const orderReached = STAGE_ORDER[cupStatus.stageReached] || 0;
        const orderTarget = STAGE_ORDER[cupExpectation.targetStage] || 0;

        if (cupStatus.active) {
          if (orderReached >= orderTarget) {
            cupScore = 85;
          } else {
            cupScore = 75;
          }
        } else if (cupStatus.isWinner) {
          cupScore = 100;
        } else {
          // Eliminated
          if (orderReached >= orderTarget) {
            cupScore = 80;
          } else {
            const orderDiff = orderTarget - orderReached;
            cupScore = Math.max(10, 50 - orderDiff * 15);
          }
        }
        return Math.round(leagueScore * 0.75 + cupScore * 0.25);
      }
    }
  }

  return Math.round(leagueScore);
};

const calculateStandingsForRounds = (teamsList, fixturesList, startRound, endRound) => {
  if (!teamsList || !fixturesList) return [];
  const calculated = teamsList.map(t => ({
    ...t,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));

  fixturesList.forEach((roundFixtures, rIdx) => {
    const roundNum = rIdx + 1;
    if (roundNum >= startRound && roundNum <= endRound) {
      roundFixtures.forEach(f => {
        if (f.played) {
          const h = calculated.find(team => team.idnum === f.homeId);
          const a = calculated.find(team => team.idnum === f.awayId);
          if (h && a) {
            h.played += 1;
            a.played += 1;
            h.gf += f.homeScore;
            h.ga += f.awayScore;
            a.gf += f.awayScore;
            a.ga += f.homeScore;

            if (f.homeScore > f.awayScore) {
              h.won += 1; h.points += 3;
              a.lost += 1;
            } else if (f.awayScore > f.homeScore) {
              a.won += 1; a.points += 3;
              h.lost += 1;
            } else {
              h.drawn += 1; h.points += 1;
              a.drawn += 1; a.points += 1;
            }
          }
        }
      });
    }
  });

  return calculated.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
};

const formatOrdinal = (num) => {
  const n = parseInt(num, 10);
  if (!n || n <= 0) return "—";
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
};

export default function LeagueDashboard() {
  const [leagueState, setLeagueState] = useState(null);
  const [officeTab, setOfficeTab] = useState("home"); // "news" | "home" | "tactics" | "transfers" | "board" | "manager"
  const [activeTab, setActiveTab] = useState("league"); // league or europe
  const [clActiveGroup, setClActiveGroup] = useState("A");
  const [subStandingsTab, setSubStandingsTab] = useState(null);
  const [leagueViewMode, setLeagueViewMode] = useState("standings"); // "standings" | "scorers" | "assists"
  const [selectedCupStage, setSelectedCupStage] = useState(null);
  const [selectedEuroKoStage, setSelectedEuroKoStage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [resultsModalOpen, setResultsModalOpen] = useState(false);
  const [resultsModalFixtures, setResultsModalFixtures] = useState([]);
  const [resultsModalTitle, setResultsModalTitle] = useState("");
  const [resultsModalTheme, setResultsModalTheme] = useState("#00ff64");

  useEffect(() => {
    if (location.state && location.state.showRoundResults) {
      const { fixtures, roundTitle, themeColor } = location.state;
      setResultsModalFixtures(fixtures || []);
      setResultsModalTitle(roundTitle || "ROUND RESULTS");
      setResultsModalTheme(themeColor || "#00ff64");
      setResultsModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  let advanceCLGroupStageToKnockouts;

  const activeGroupsList = useMemo(() => {
    return leagueState && leagueState.europeanCupState && leagueState.europeanCupState.teams
      ? [...new Set(leagueState.europeanCupState.teams.filter(t => t.group && t.group !== "bye" && t.group !== "champion").map(t => t.group))].sort()
      : [];
  }, [leagueState]);

  const topScorersList = useMemo(() => {
    const stats = leagueState?.playerStats || {};
    return Object.values(stats)
      .filter(p => (p.goals || 0) > 0)
      .sort((a, b) => (b.goals || 0) - (a.goals || 0))
      .slice(0, 20);
  }, [leagueState?.playerStats]);

  const topAssistsList = useMemo(() => {
    const stats = leagueState?.playerStats || {};
    return Object.values(stats)
      .filter(p => (p.assists || 0) > 0)
      .sort((a, b) => (b.assists || 0) - (a.assists || 0))
      .slice(0, 20);
  }, [leagueState?.playerStats]);

  const processRoundStatsAndAwards = (career, roundNumber) => {
    if (!career || !career.fixtures || !career.teams) return career;
    const roundIdx = roundNumber - 1;
    const rFixtures = career.fixtures[roundIdx];
    if (!Array.isArray(rFixtures)) return career;

    career.playerStats = career.playerStats || {};

    // 1. Generate goalscorers and assists for any played fixture in this round that doesn't have them yet
    rFixtures.forEach(f => {
      const needsEvents = !f.scorersRecorded && (!f.scorers || (f.scorers.length === 0 && ((f.homeScore || 0) + (f.awayScore || 0)) > 0));
      if (f.played && needsEvents) {
        const hTeam = (career.teams || []).find(t => t.idnum === f.homeId)?.name || f.homeTeamName || `Team ${f.homeId}`;
        const aTeam = (career.teams || []).find(t => t.idnum === f.awayId)?.name || f.awayTeamName || `Team ${f.awayId}`;
        const { scorers, assists } = generateMatchEvents(hTeam, aTeam, f.homeScore || 0, f.awayScore || 0, career.season);
        f.scorers = scorers;
        f.assists = assists;
        f.scorersRecorded = true;
        career.playerStats = recordMatchEventsInStats(career.playerStats, scorers, assists);
      }
    });

    const totalLeagueRounds = (career.teams.length - 1) * 2;
    const pTeam = career.teams.find(t => t.idnum === career.playerTeamId);
    const userTeamName = pTeam ? pTeam.name : "";
    const finalManagerName = career.managerName || "Sir Alex";

    // 2. Check Monthly Awards
    const monthCheck = checkMonthConclusion(roundNumber, totalLeagueRounds, career.country);
    if (monthCheck.isMonthEnd) {
      career.monthlyAwards = career.monthlyAwards || [];
      const alreadyAwarded = career.monthlyAwards.some(m => m.monthName === monthCheck.monthName);
      if (!alreadyAwarded) {
        const monthAwards = calculateMonthlyAwards({
          fixtures: career.fixtures,
          standings: career.teams,
          startRound: monthCheck.startRound,
          endRound: monthCheck.endRound,
          monthName: monthCheck.monthName,
          userManagerName: finalManagerName,
          userTeamName,
          season: career.season
        });

        career.monthlyAwards.push({
          monthName: monthCheck.monthName,
          ...monthAwards
        });

        // If user won Manager of the Month, boost manager profile
        if (monthAwards.motm?.winner?.isUser) {
          const updatedProf = awardManagerTitle("motm", {
            monthName: monthCheck.monthName,
            season: career.season,
            teamName: userTeamName,
            points: monthAwards.motm.winner.points,
            won: monthAwards.motm.winner.won,
            drawn: monthAwards.motm.winner.drawn,
            lost: monthAwards.motm.winner.lost
          });
          if (updatedProf) setManagerProfile(updatedProf);
        }

        const awardStories = generateMonthlyAwardsNews({
          monthName: monthCheck.monthName,
          motm: monthAwards.motm,
          potm: monthAwards.potm,
          round: roundNumber,
          season: career.season
        });

        career.newsFeed = appendAndPruneNews(career.newsFeed, awardStories, roundNumber);
      }
    }

    // 3. Check Yearly Awards if final round
    if (roundNumber >= totalLeagueRounds && !career.hasGeneratedYearlyAwards) {
      const yearlyAwards = calculateYearlyAwards({
        standings: career.teams,
        monthlyAwardsHistory: career.monthlyAwards || [],
        playerStats: career.playerStats || {},
        userManagerName: finalManagerName,
        userTeamName,
        season: career.season
      });

      career.yearlyAwards = yearlyAwards;
      career.hasGeneratedYearlyAwards = true;

      if (yearlyAwards.moty?.winner?.isUser) {
        const updatedProf = awardManagerTitle("moty", {
          season: career.season,
          teamName: userTeamName
        });
        if (updatedProf) setManagerProfile(updatedProf);
      }

      const yearlyStories = generateYearlyAwardsNews({
        moty: yearlyAwards.moty,
        poty: yearlyAwards.poty,
        round: roundNumber,
        season: career.season
      });

      career.newsFeed = appendAndPruneNews(career.newsFeed, yearlyStories, roundNumber);
    }

    return career;
  };

  // Sort Standings Table (dynamic based on Apertura/Clausura tabs)
  const standings = useMemo(() => {
    if (!leagueState) return [];
    const { country, teams, fixtures, currentRound } = leagueState;
    const isAperturaClausuraLeague = country === "argentina" || country === "colombia" || country === "mexico";
    const halfRounds = fixtures ? Math.floor(fixtures.length / 2) : (teams ? (teams.length % 2 === 0 ? teams.length - 1 : teams.length) : 19);
    const totalRounds = getTotalLeagueRounds(teams, country, fixtures);

    const activeSubStandings = subStandingsTab || (currentRound <= halfRounds ? "apertura" : "clausura");

    if (!isAperturaClausuraLeague || activeSubStandings === "aggregate") {
      return [...teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.gf - a.ga;
        const gdB = b.gf - b.ga;
        if (gdB !== gdA) return gdB - gdA;
        return b.gf - a.gf;
      });
    }

    const startRound = activeSubStandings === "apertura" ? 1 : halfRounds + 1;
    const endRound = activeSubStandings === "apertura" ? halfRounds : totalRounds;

    return calculateStandingsForRounds(teams, fixtures, startRound, endRound);
  }, [leagueState, subStandingsTab]);

  // Manager Profile States
  const [managerProfile, setManagerProfile] = useState(() => loadManagerProfileFromStorage("Sir Alex"));
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(() => {
    try {
      const saved = localStorage.getItem("retro_manager_profile");
      if (saved) return JSON.parse(saved).name || "Sir Alex";
    } catch (e) { }
    return "Sir Alex";
  });
  const [editPhoto, setEditPhoto] = useState(() => {
    try {
      const saved = localStorage.getItem("retro_manager_profile");
      if (saved) return JSON.parse(saved).photo || null;
    } catch (e) { }
    return null;
  });
  const [editNationality, setEditNationality] = useState(() => {
    try {
      const saved = localStorage.getItem("retro_manager_profile");
      if (saved) return JSON.parse(saved).nationality || "";
    } catch (e) { }
    return "";
  });
  const [nextSeasonTeams, setNextSeasonTeams] = useState([]);
  const [seasonRolloverMeta, setSeasonRolloverMeta] = useState(null);
  const [jobOffers, setJobOffers] = useState([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showFormationModal, setShowFormationModal] = useState(false);
  const [isJobBusy, setIsJobBusy] = useState(false);

  const reloadLeagueState = () => {
    const raw = localStorage.getItem("retro_league_career");
    if (raw) {
      setLeagueState(JSON.parse(raw));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleOpenProfileModal = () => {
    setEditName(managerProfile.name || "Sir Alex");
    setEditPhoto(managerProfile.photo || null);
    setEditNationality(managerProfile.nationality || leagueState?.managerNationality || "");
    setShowProfileModal(true);
  };

  const handleCancelProfile = () => {
    setEditName(managerProfile.name || "Sir Alex");
    setEditPhoto(managerProfile.photo || null);
    setEditNationality(managerProfile.nationality || leagueState?.managerNationality || "");
    setShowProfileModal(false);
  };

  useEffect(() => {
    cleanStale1To5Rosters();
    const raw = localStorage.getItem("retro_league_career");
    if (!raw) {
      navigate("/league");
      return;
    }
    const parsedCareer = JSON.parse(raw);
    if (parsedCareer.season) {
      loadSeasonRosters(parsedCareer.season).then(() => {
        try {
          const latestRaw = localStorage.getItem("retro_league_career");
          if (!latestRaw) return;
          const latestCareer = JSON.parse(latestRaw);
          const { changed, career: repairedCareer } = repairCareerAwardManagerNames(latestCareer);
          if (changed) {
            localStorage.setItem("retro_league_career", JSON.stringify(repairedCareer));
            setLeagueState(repairedCareer);
          }
        } catch (err) {
          console.warn("[LeagueDashboard] Could not repair award manager names:", err);
        }
      }).catch(() => { });
    }

    // Auto-upgrade legacy 1-5 saves to 1-10 scale once (never re-double teams already on 1-10)
    if (parsedCareer.statScale !== "1-10" && parsedCareer.teams && Array.isArray(parsedCareer.teams)) {
      const allTeamsLegacy = parsedCareer.teams.every(t => (Number(t.attack) || 0) <= 5 && (Number(t.midfield) || 0) <= 5 && (Number(t.defense) || 0) <= 5);
      if (allTeamsLegacy) {
        parsedCareer.teams = parsedCareer.teams.map(t => {
          const att = Number(t.attack) || 3;
          const mid = Number(t.midfield) || 3;
          const def = Number(t.defense) || 3;
          return {
            ...t,
            attack: scaleStatTo10(att),
            midfield: scaleStatTo10(mid),
            defense: scaleStatTo10(def)
          };
        });
      }
      parsedCareer.statScale = "1-10";
      localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
    }

    // Auto-initialize budget for pre-existing saves if undefined
    if (parsedCareer.budget === undefined) {
      const playerTeamObj = parsedCareer.teams?.find(t => t.idnum === parsedCareer.playerTeamId);
      if (playerTeamObj) {
        const stats = {
          attack: playerTeamObj.attack || 3,
          midfield: playerTeamObj.midfield || 3,
          defense: playerTeamObj.defense || 3
        };
        const avgRating = (stats.attack + stats.midfield + stats.defense) / 3;
        const divisionMultiplier = (parsedCareer.division || 1) === 2 ? 0.3 : 1.2;
        const eraMultiplier = 1 + (parseInt(parsedCareer.season.split("/")[0]) - 1980) * 0.04;
        parsedCareer.budget = Math.max(0.5, parseFloat((Math.pow(avgRating, 2.2) * divisionMultiplier * eraMultiplier).toFixed(1)));
      } else {
        parsedCareer.budget = 10.0;
      }
      localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
    }
    if (parsedCareer.lastTransferWindow === undefined) {
      parsedCareer.lastTransferWindow = "";
      localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
    }

    // Sync stats of domestic teams in the European Cup with their updated domestic stats
    if (parsedCareer.teams && parsedCareer.europeanCupState && parsedCareer.europeanCupState.teams) {
      let changed = false;
      parsedCareer.europeanCupState.teams.forEach(euroTeam => {
        const domesticTeam = parsedCareer.teams.find(t => t.name === euroTeam.name);
        if (domesticTeam) {
          if (euroTeam.attack !== domesticTeam.attack ||
            euroTeam.midfield !== domesticTeam.midfield ||
            euroTeam.defense !== domesticTeam.defense) {
            euroTeam.attack = domesticTeam.attack;
            euroTeam.midfield = domesticTeam.midfield;
            euroTeam.defense = domesticTeam.defense;
            changed = true;
          }
        }
      });
      if (changed) {
        localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
      }
    }

    // Seed initial news feed if empty or missing
    if (!parsedCareer.newsFeed || parsedCareer.newsFeed.length === 0) {
      const pTeam = parsedCareer.teams?.find(t => t.idnum === parsedCareer.playerTeamId);
      parsedCareer.newsFeed = generateInitialNews({
        teamName: pTeam ? pTeam.name : "Team",
        managerName: parsedCareer.managerName || "Sir Alex",
        expectation: parsedCareer.boardExpectation,
        budget: parsedCareer.budget,
        season: parsedCareer.season
      });
      localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
    }

    // Sanitize any existing scouting news feed items with 1-10 scale ratings
    if (Array.isArray(parsedCareer.newsFeed)) {
      let newsSanitized = false;
      parsedCareer.newsFeed = parsedCareer.newsFeed.map(item => {
        if (item && item.category === "preview" && item.previewWidget) {
          const pw = item.previewWidget;
          const att = pw.attackScore != null ? pw.attackScore : (typeof pw.attack === 'number' ? pw.attack : null);
          const mid = pw.midfieldScore != null ? pw.midfieldScore : (typeof pw.midfield === 'number' ? pw.midfield : null);
          const def = pw.defenseScore != null ? pw.defenseScore : (typeof pw.defense === 'number' ? pw.defense : null);
          if (att != null && mid != null && def != null) {
            const newAtt = getQualitativeRating(att);
            const newMid = getQualitativeRating(mid);
            const newDef = getQualitativeRating(def);
            const oppName = pw.opponentName || "Opponent";
            const oppForm = pw.formation || getPreferredTeamFormation(oppName, parsedCareer.season);
            if (pw.attackLabel !== newAtt || pw.midfieldLabel !== newMid || pw.defenseLabel !== newDef || pw.formation !== oppForm) {
              newsSanitized = true;
              const newSummary = `Scouting analysis on ${oppName} (Preferred Tactic: ${oppForm}): Attack is ${newAtt}, Midfield is ${newMid}, Defense is ${newDef}.`;
              let newBody = item.body || "";
              newBody = newBody.replace(
                /rate their attacking threat as [^,]+, their midfield balance as [^,]+, and their defensive unit as [^.\n]+/,
                `rate their attacking threat as ${newAtt}, their midfield balance as ${newMid}, and their defensive unit as ${newDef}`
              );
              if (!newBody.includes("Expected Tactical Formation:")) {
                newBody = newBody.replace(
                  `Scouts have submitted their tactical dossier on our upcoming opponents, ${oppName}.`,
                  `Scouts have submitted their tactical dossier on our upcoming opponents, ${oppName}.\n\n📐 Expected Tactical Formation: ${oppName} are expected to line up in their preferred ${oppForm} formation.`
                );
              }
              return {
                ...item,
                summary: newSummary,
                body: newBody,
                previewWidget: {
                  ...pw,
                  formation: oppForm,
                  attackLabel: newAtt,
                  midfieldLabel: newMid,
                  defenseLabel: newDef
                }
              };
            }
          }
        }
        return item;
      });
      const prunedLoadedNews = pruneNewsFeed(parsedCareer.newsFeed, parsedCareer.currentRound || 1);
      if (prunedLoadedNews.length !== parsedCareer.newsFeed.length) {
        parsedCareer.newsFeed = prunedLoadedNews;
        newsSanitized = true;
      }
      if (newsSanitized) {
        localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
      }
    }

    // Auto-generate post-match news & process awards for last played round
    if (parsedCareer.teams && parsedCareer.fixtures) {
      // Backfill any played fixtures that lack scorers/assists
      parsedCareer.playerStats = parsedCareer.playerStats || {};
      parsedCareer.fixtures.forEach(rFixtures => {
        if (Array.isArray(rFixtures)) {
          rFixtures.forEach(f => {
            const needsEvents = !f.scorersRecorded && (!f.scorers || (f.scorers.length === 0 && ((f.homeScore || 0) + (f.awayScore || 0)) > 0));
            if (f.played && needsEvents) {
              const hTeam = (parsedCareer.teams || []).find(t => t.idnum === f.homeId)?.name || f.homeTeamName || `Team ${f.homeId}`;
              const aTeam = (parsedCareer.teams || []).find(t => t.idnum === f.awayId)?.name || f.awayTeamName || `Team ${f.awayId}`;
              const { scorers, assists } = generateMatchEvents(hTeam, aTeam, f.homeScore || 0, f.awayScore || 0, parsedCareer.season);
              f.scorers = scorers;
              f.assists = assists;
              f.scorersRecorded = true;
              parsedCareer.playerStats = recordMatchEventsInStats(parsedCareer.playerStats, scorers, assists);
            }
          });
        }
      });

      const lastCompletedRound = parsedCareer.currentRound - 1;
      const hasMatchNewsForLastRound = parsedCareer.newsFeed?.some(
        n => n.round === lastCompletedRound && (n.category === "match" || n.category === "league")
      );
      if (lastCompletedRound >= 1 && !hasMatchNewsForLastRound) {
        const roundFixtures = parsedCareer.fixtures[lastCompletedRound - 1];
        if (roundFixtures) {
          const pId = parsedCareer.playerTeamId;
          const playerFixture = roundFixtures.find(f => f.homeId === pId || f.awayId === pId);
          if (playerFixture && playerFixture.played) {
            const isPlayerHome = playerFixture.homeId === pId;
            const opponentId = isPlayerHome ? playerFixture.awayId : playerFixture.homeId;
            const playerTeam = parsedCareer.teams.find(t => t.idnum === pId);
            const opponentTeam = parsedCareer.teams.find(t => t.idnum === opponentId);
            const currentInjuries = JSON.parse(localStorage.getItem(`retro_player_injuries_${playerTeam?.name}_${parsedCareer.season}`) || "[]");

            const nextRoundFixtures = parsedCareer.fixtures[lastCompletedRound];
            const nextUserFixture = nextRoundFixtures?.find(f => f.homeId === pId || f.awayId === pId);
            const nextOpponentId = nextUserFixture ? (nextUserFixture.homeId === pId ? nextUserFixture.awayId : nextUserFixture.homeId) : null;
            const nextOpponentTeam = parsedCareer.teams.find(t => t.idnum === nextOpponentId);

            const newStories = generateMatchdayNews({
              round: lastCompletedRound,
              userFixture: playerFixture,
              allFixtures: roundFixtures,
              standings: parsedCareer.teams,
              teamName: playerTeam ? playerTeam.name : "",
              opponentName: opponentTeam ? opponentTeam.name : "",
              nextOpponent: nextOpponentTeam,
              managerName: parsedCareer.managerName || "Sir Alex",
              injuries: currentInjuries,
              budget: parsedCareer.budget,
              fanConfidence: parsedCareer.fanConfidence || 50,
              boardConfidence: 60,
              season: parsedCareer.season,
              fullFixturesList: parsedCareer.fixtures,
              playerTeamId: pId
            });

            // If awards for this round are already in newsFeed (e.g. existing save),
            // place newStories directly below the awards so awards remain at the top.
            const existingRoundAwards = (parsedCareer.newsFeed || []).filter(
              n => n.round === lastCompletedRound && (n.category === "award" || n.category === "yearlyAward")
            );
            const otherNews = (parsedCareer.newsFeed || []).filter(
              n => !(n.round === lastCompletedRound && (n.category === "award" || n.category === "yearlyAward"))
            );
            parsedCareer.newsFeed = pruneNewsFeed([...existingRoundAwards, ...newStories, ...otherNews], lastCompletedRound);
            localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
          }
        }
      }

      if (lastCompletedRound >= 1) {
        const prevAwardsCount = (parsedCareer.monthlyAwards || []).length;
        const prevYearly = Boolean(parsedCareer.hasGeneratedYearlyAwards);
        const processedCareer = processRoundStatsAndAwards(parsedCareer, lastCompletedRound);
        if (
          (processedCareer.monthlyAwards || []).length !== prevAwardsCount ||
          Boolean(processedCareer.hasGeneratedYearlyAwards) !== prevYearly
        ) {
          localStorage.setItem("retro_league_career", JSON.stringify(processedCareer));
        }
      }
    }

    // Initialize or heal Domestic Cup if missing or if player team was excluded
    const playerInCup = parsedCareer.domesticCupState?.participatingTeams?.some(t => t.idnum === parsedCareer.playerTeamId);
    if ((!parsedCareer.domesticCupState || !playerInCup) && parsedCareer.teams && parsedCareer.country) {
      const seasonShort = parsedCareer.season ? parsedCareer.season.split("/")[0] : "2026";
      const rawDiv1 = (leagueDataMap[seasonShort] && leagueDataMap[seasonShort][parsedCareer.country]) || parsedCareer.teams;
      const rawDiv2 = (leagueDataMapD2[seasonShort] && leagueDataMapD2[seasonShort][parsedCareer.country]) || [];
      const div1Roster = rawDiv1.map(t => ({ ...t, division: 1 }));
      const div2Roster = rawDiv2.map(t => ({ ...t, division: 2 }));
      const fullRoster = [...div1Roster, ...div2Roster];
      const totalLeagueRounds = (parsedCareer.teams.length - 1) * 2;
      parsedCareer.domesticCupState = createDomesticCup(fullRoster, totalLeagueRounds, parsedCareer.country, parsedCareer.playerTeamId);

      const pTeam = parsedCareer.teams.find(t => t.idnum === parsedCareer.playerTeamId);
      parsedCareer.domesticCupExpectation = getDomesticCupExpectation(pTeam || {}, parsedCareer.domesticCupState.bracketSize);

      const pId = parsedCareer.playerTeamId;
      const firstStg = parsedCareer.domesticCupState.stage;
      const firstMatches = parsedCareer.domesticCupState.knockoutState[firstStg] || [];
      const userCupMatch = firstMatches.find(m => m.homeId === pId || m.awayId === pId);
      if (userCupMatch) {
        const isHome = userCupMatch.homeId === pId;
        const oppName = isHome ? userCupMatch.awayName : userCupMatch.homeName;
        const drawNews = generateDomesticCupDrawNews({
          cupName: parsedCareer.domesticCupState.cupName,
          stageName: CUP_STAGE_NAMES[firstStg] || firstStg,
          teamName: pTeam ? pTeam.name : "Your Team",
          opponentName: oppName,
          managerName: parsedCareer.managerName || "Sir Alex",
          round: parsedCareer.currentRound || 1
        });
        const newsFiltered = (parsedCareer.newsFeed || []).filter(n => n.category !== "cup" || n.dateStr !== "Cup Draw");
        parsedCareer.newsFeed = appendAndPruneNews(newsFiltered, drawNews, parsedCareer.currentRound || 1);
      }

      if (!parsedCareer.calendar) {
        parsedCareer.calendar = [];
        for (let r = 1; r <= totalLeagueRounds; r++) {
          parsedCareer.calendar.push({ type: "league", index: r });
        }
      } else {
        parsedCareer.calendar = parsedCareer.calendar.filter(e => !e.isDomesticCup && e.type !== "domestic_cup");
      }

      if (parsedCareer.domesticCupState.calendarSchedules) {
        const domSlots = [...parsedCareer.domesticCupState.calendarSchedules].sort((a, b) => b.offset - a.offset);
        domSlots.forEach(slot => {
          if (slot.stage !== "final") {
            parsedCareer.calendar.splice(slot.offset, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
          } else {
            const finalIdx = Math.max(1, parsedCareer.calendar.length - 1);
            parsedCareer.calendar.splice(finalIdx, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
          }
        });
      }
      localStorage.setItem("retro_league_career", JSON.stringify(parsedCareer));
    }

    setLeagueState(parsedCareer);

    // Sync or Seed Manager Profile (normalized with new fields & live matchXp)
    const normalizedProf = loadManagerProfileFromStorage(
      parsedCareer.managerName || "Sir Alex",
      parsedCareer.managerNationality || ""
    );
    if (!localStorage.getItem("retro_manager_profile")) {
      localStorage.setItem("retro_manager_profile", JSON.stringify(normalizedProf));
    }
    setManagerProfile(normalizedProf);
    setEditName(normalizedProf.name || parsedCareer.managerName || "Sir Alex");
    setEditPhoto(normalizedProf.photo || null);
    setEditNationality(normalizedProf.nationality || parsedCareer.managerNationality || "");
  }, [navigate]);

  const handleSaveProfile = () => {
    const photoToSave = editPhoto || managerProfile.photo || null;
    const nationalityToSave = editNationality || "";
    const updated = {
      ...managerProfile,
      name: editName,
      nationality: nationalityToSave,
      photo: photoToSave
    };
    try {
      localStorage.setItem("retro_manager_profile", JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save manager profile", e);
    }
    setManagerProfile(updated);
    setEditPhoto(photoToSave);
    setEditNationality(nationalityToSave);

    // Sync current active career's manager name & nationality
    if (leagueState) {
      const stateCopy = { ...leagueState, managerName: editName, managerNationality: nationalityToSave };
      localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
      setLeagueState(stateCopy);
    }
    setShowProfileModal(false);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to crop/resize image to a crisp 200x200 square
        const canvas = document.createElement("canvas");
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        // Center-crop square logic
        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
        // Clean JPEG compression ~15-25 KB (guarantees localStorage limit is never exceeded)
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);

        setEditPhoto(compressedBase64);

        // Auto-save immediately to managerProfile and localStorage so it is never lost!
        try {
          const currentProfile = JSON.parse(localStorage.getItem("retro_manager_profile") || "{}");
          const updatedProfile = {
            ...managerProfile,
            ...currentProfile,
            photo: compressedBase64
          };
          localStorage.setItem("retro_manager_profile", JSON.stringify(updatedProfile));
          setManagerProfile(updatedProfile);
        } catch (err) {
          console.warn("Failed to auto-save photo to localStorage", err);
        }
      };
      img.src = uploadEvent.target.result;
    };
    reader.readAsDataURL(file);
  };

  const getExpectation = (
    team,
    allTeams = null,
    forceDivision = null,
    forceCountry = null,
    forceSeason = null
  ) =>
    calculateBoardExpectation({
      team,
      allTeams,
      country: forceCountry || team?.country || leagueState?.country || 'england',
      season: forceSeason || leagueState?.season || '2001',
      division: (forceDivision !== null && forceDivision !== undefined) ? forceDivision : (leagueState?.division || 1)
    });

  const generateJobOffers = (updatedTeamsList, tier, nextStartYr, currentCountry) => {
    if (tier === "disgraced") return [];

    // Calculate manager prestige based on experience and stats
    const prestige = calculateManagerPrestige(managerProfile);

    // Limit the maximum rating of offering clubs based on unified 0-4000+ Manager Prestige
    let maxRating = 5.0;
    if (prestige < 500) {
      maxRating = 3.1;
    } else if (prestige < 1000) {
      maxRating = 3.6;
    } else if (prestige < 2000) {
      maxRating = 4.2;
    } else if (prestige < 4000) {
      maxRating = 4.7;
    }

    const nextStartYrStr = String(nextStartYr);
    const effectiveDomesticCountry = HISTORICAL_FEDERATION_COUNTRIES.has(currentCountry)
      ? getSuccessorFederation(currentCountry, nextStartYr)
      : currentCountry;
    const hasD2 = leagueDataMapD2[nextStartYrStr] && leagueDataMapD2[nextStartYrStr][effectiveDomesticCountry];
    const isSACareer = SA_COUNTRIES.has(effectiveDomesticCountry);
    const isNACareer = NA_COUNTRIES.has(effectiveDomesticCountry);

    const activeD1MapCareer = isNACareer ? leagueDataMapNA : (isSACareer ? leagueDataMapSA : leagueDataMap);
    const d1Teams = (activeD1MapCareer[nextStartYrStr] && activeD1MapCareer[nextStartYrStr][effectiveDomesticCountry])
      ? activeD1MapCareer[nextStartYrStr][effectiveDomesticCountry].map(t => ({ ...t, division: 1 }))
      : [];
    const d2Teams = (hasD2)
      ? leagueDataMapD2[nextStartYrStr][effectiveDomesticCountry].map(t => ({ ...t, division: 2 }))
      : [];

    const allDomesticRoster = [...d1Teams, ...d2Teams];

    // Sort other teams in next season's league by overall quality
    const otherDomesticTeams = allDomesticRoster
      .filter(t => effectiveDomesticCountry !== currentCountry || t.idnum !== playerTeamId)
      .map(t => ({
        ...t,
        country: effectiveDomesticCountry,
        rating: (t.attack + t.midfield + t.defense) / 3
      }))
      .sort((a, b) => b.rating - a.rating);

    // Filter teams to ensure we only present offers within the manager's prestige ceiling
    const allowedDomesticTeams = otherDomesticTeams.filter(t => t.rating <= maxRating);
    const domesticPool = allowedDomesticTeams.length > 0
      ? allowedDomesticTeams
      : (otherDomesticTeams.length > 0 ? [otherDomesticTeams[otherDomesticTeams.length - 1]] : []);

    let domesticOffers = [];
    const highRatingFloor = Math.max(1.5, maxRating - 0.5);
    const midRatingFloor = Math.max(1.0, maxRating - 1.2);

    if (domesticPool.length === 0) {
      domesticOffers = [];
    } else if (tier === "outstanding") {
      const highTier = domesticPool.filter(t => t.rating >= highRatingFloor);
      const midTier = domesticPool.filter(t => t.rating >= midRatingFloor && t.rating < highRatingFloor);

      const pick1 = highTier.length > 0 ? highTier[Math.floor(Math.random() * highTier.length)] : domesticPool[0];
      const pick2 = midTier.length > 0 ? midTier[Math.floor(Math.random() * midTier.length)] : domesticPool[Math.floor(domesticPool.length / 2)];

      domesticOffers = [pick1, pick2];
    } else if (tier === "warning") {
      const midTier = domesticPool.filter(t => t.rating >= midRatingFloor && t.rating < highRatingFloor);
      const lowTier = domesticPool.filter(t => t.rating < midRatingFloor);

      const pick1 = midTier.length > 0 ? midTier[Math.floor(Math.random() * midTier.length)] : domesticPool[Math.floor(domesticPool.length / 2)];
      const pick2 = lowTier.length > 0 ? lowTier[Math.floor(Math.random() * lowTier.length)] : domesticPool[domesticPool.length - 1];

      domesticOffers = [pick1, pick2];
    } else if (tier === "decent_sacked") {
      const lowTier = domesticPool.filter(t => t.rating < highRatingFloor);
      const shuffledLow = [...lowTier].sort(() => 0.5 - Math.random());

      const pick1 = shuffledLow[0] || domesticPool[Math.max(0, domesticPool.length - 2)];
      const pick2 = shuffledLow[1] || domesticPool[domesticPool.length - 1];

      domesticOffers = [pick1, pick2];
    }

    // Generate international offers from other countries
    let internationalOffers = [];

    // Pick from SA, NA, or European pool depending on current region
    const activeDomesticMap = isNACareer ? leagueDataMapNA : (isSACareer ? leagueDataMapSA : leagueDataMap);
    if (activeDomesticMap[nextStartYrStr]) {
      const otherCountries = Object.keys(activeDomesticMap[nextStartYrStr]).filter(c => c !== currentCountry);

      // Shuffle other countries so we get a random mix
      const shuffledCountries = [...otherCountries].sort(() => 0.5 - Math.random());

      // Pick teams from up to 2 other countries
      shuffledCountries.slice(0, 2).forEach(otherCountry => {
        const countryData = activeDomesticMap[nextStartYrStr][otherCountry];
        if (countryData && countryData.length > 0) {
          const countryDataD1 = countryData.map(t => ({ ...t, division: 1 }));
          const countryDataD2 = (leagueDataMapD2[nextStartYrStr] && leagueDataMapD2[nextStartYrStr][otherCountry])
            ? leagueDataMapD2[nextStartYrStr][otherCountry].map(t => ({ ...t, division: 2 }))
            : [];

          // Format teams with rating
          const formattedTeams = [...countryDataD1, ...countryDataD2].map(t => ({
            ...t,
            country: otherCountry,
            rating: (t.attack + t.midfield + t.defense) / 3
          }));

          const allowedTeams = formattedTeams.filter(t => t.rating <= maxRating);
          const activePool = allowedTeams.length > 0 ? allowedTeams : [formattedTeams[formattedTeams.length - 1]];

          let pool = [];
          if (tier === "outstanding") {
            pool = activePool.filter(t => t.rating >= highRatingFloor);
          } else if (tier === "warning") {
            pool = activePool.filter(t => t.rating >= midRatingFloor && t.rating < highRatingFloor);
          } else { // decent_sacked
            pool = activePool.filter(t => t.rating < highRatingFloor);
          }

          if (pool.length === 0) pool = activePool;
          const randomTeam = pool[Math.floor(Math.random() * pool.length)];
          if (randomTeam) {
            internationalOffers.push({
              idnum: randomTeam.idnum,
              id: randomTeam.id,
              name: randomTeam.name,
              attack: randomTeam.attack,
              midfield: randomTeam.midfield,
              defense: randomTeam.defense,
              kit: randomTeam.kit || "swe92/0.png",
              primaryColor: randomTeam.primaryColor,
              secondaryColor: randomTeam.secondaryColor,
              played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0,
              country: otherCountry,
              rating: randomTeam.rating,
              division: randomTeam.division || 1
            });
          }
        }
      });
    }

    // Combine domestic and international offers
    const combinedOffers = [...domesticOffers, ...internationalOffers];

    // Map each team to include board expectation
    return combinedOffers.map(team => {
      const isSA = SA_COUNTRIES.has(team.country);
      const isNA = NA_COUNTRIES.has(team.country);
      const targetMap = (team.division === 2) ? leagueDataMapD2 : (isNA ? leagueDataMapNA : (isSA ? leagueDataMapSA : leagueDataMap));
      const nextStartYrStr = String(nextStartYr);
      const countryRoster = (targetMap[nextStartYrStr] && targetMap[nextStartYrStr][team.country]) || [];
      return {
        ...team,
        expectation: getExpectation(team, countryRoster, team.division, team.country, nextStartYrStr)
      };
    });
  };

  useEffect(() => {
    if (!leagueState) return;
    const { calendar, calendarIndex, currentRound, teams, boardExpectation, isSacked } = leagueState;
    const totalRounds = getTotalLeagueRounds(teams, leagueState.country, leagueState.fixtures);
    const isSeasonOverCalculated = (calendar ? calendarIndex >= calendar.length : currentRound > totalRounds) || isSacked;

    if (isSeasonOverCalculated && nextSeasonTeams.length === 0) {
      const { playerTeamId, region, country, season } = leagueState;
      // Sort Standings Table
      const standingsSorted = [...teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.gf - a.ga;
        const gdB = b.gf - b.ga;
        if (gdB !== gdA) return gdB - gdA;
        return b.gf - a.gf;
      });

      const division = leagueState.division || 1;
      const yearParts = season.split("/");
      const startYr = parseInt(yearParts[0]);
      const nextStartYr = startYr + 1;
      const startYrStr = String(startYr);
      const nextStartYrStr = String(nextStartYr);
      const hasD2Current = leagueDataMapD2[startYrStr] && leagueDataMapD2[startYrStr][country];

      let updatedTeams = [];

      if (hasD2Current) {
        if (division === 2) {
          const promotedTeams = standingsSorted.slice(0, 3);
          const promotedIds = promotedTeams.map(t => t.idnum);

          const relegatedNames = (historicalRelegated[startYrStr] && historicalRelegated[startYrStr][country]) || [];
          const nextD2Roster = (leagueDataMapD2[nextStartYrStr] && leagueDataMapD2[nextStartYrStr][country]) || [];

          const relegated = relegatedNames.map(name => {
            const match = nextD2Roster.find(t => t.name.toLowerCase() === name.toLowerCase());
            return match ? { ...match } : {
              name: name,
              attack: 2, midfield: 2, defense: 2,
              kit: "swe92/0.png", primaryColor: "#FFFFFF", secondaryColor: "#000000"
            };
          });

          updatedTeams = teams.map(team => {
            const promoteIndex = promotedIds.indexOf(team.idnum);
            if (promoteIndex !== -1) {
              const rel = relegated[promoteIndex] || relegated[0];
              return {
                idnum: team.idnum,
                id: team.id,
                name: rel.name,
                attack: rel.attack,
                midfield: rel.midfield,
                defense: rel.defense,
                kit: rel.kit || "swe92/0.png",
                primaryColor: rel.primaryColor,
                secondaryColor: rel.secondaryColor,
                played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
              };
            } else {
              return {
                ...team,
                played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
              };
            }
          });
        } else {
          // division === 1 (Active Division 1)
          const relegatedTeams = standingsSorted.slice(-3);
          const relegatedIds = relegatedTeams.map(t => t.idnum);

          const promotedNames = (historicalPromoted[startYrStr] && historicalPromoted[startYrStr][country]) || [];
          const nextD1Roster = (leagueDataMap[nextStartYrStr] && leagueDataMap[nextStartYrStr][country]) || [];

          const promoted = promotedNames.map(name => {
            const match = nextD1Roster.find(t => t.name.toLowerCase() === name.toLowerCase());
            return match ? { ...match } : {
              name: name,
              attack: 2, midfield: 2, defense: 2,
              kit: "swe92/0.png", primaryColor: "#FFFFFF", secondaryColor: "#000000"
            };
          });

          updatedTeams = teams.map(team => {
            const relegateIndex = relegatedIds.indexOf(team.idnum);
            if (relegateIndex !== -1) {
              const promo = promoted[relegateIndex] || promoted[0];
              return {
                idnum: team.idnum,
                id: team.id,
                name: promo.name,
                attack: promo.attack,
                midfield: promo.midfield,
                defense: promo.defense,
                kit: promo.kit || "swe92/0.png",
                primaryColor: promo.primaryColor,
                secondaryColor: promo.secondaryColor,
                played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
              };
            } else {
              return {
                ...team,
                played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
              };
            }
          });
        }
      } else if (NA_COUNTRIES.has(country)) {
        const nextHistorical = (leagueDataMapNA[nextStartYrStr] && leagueDataMapNA[nextStartYrStr][country]) || [];
        const baseList = nextHistorical.length > 0 ? nextHistorical : teams;
        const playerTeam = teams.find(t => t.idnum === playerTeamId);
        const hasPlayerInNext = playerTeam && baseList.some(t => t.name.toLowerCase() === playerTeam.name.toLowerCase());
        const combined = hasPlayerInNext || !playerTeam
          ? baseList
          : [...baseList.slice(0, baseList.length - 1), playerTeam];
        updatedTeams = combined.map(t => ({
          ...t,
          played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
        }));
        setSeasonRolloverMeta(null);
      } else if (HISTORICAL_FEDERATION_COUNTRIES.has(country)) {
        const rollover = buildExYugoslaviaNextSeason({
          country,
          nextStartYr,
          teams,
          playerTeamId,
          leagueDataMap,
          scaleStat: scaleStatTo10
        });
        updatedTeams = rollover.nextTeams.length > 0 ? rollover.nextTeams : teams.map(t => ({
          ...t,
          played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
        }));
        setSeasonRolloverMeta({
          canRenew: rollover.canRenew,
          targetCountry: rollover.targetCountry,
          exitReason: rollover.exitReason,
          resolvedPlayerTeamName: rollover.resolvedPlayerTeamName
        });
      } else {
        // Fallback: old relegation/promotion system
        const relegatedTeams = standingsSorted.slice(-3);
        const relegatedIds = relegatedTeams.map(t => t.idnum);

        const backupPool = countryBackupTeams[country] || [];
        const activeNames = teams.map(t => t.name);
        const availableBackup = backupPool.filter(t => !activeNames.includes(t.name));

        const shuffledBackup = [...availableBackup].sort(() => 0.5 - Math.random());
        const promoted = shuffledBackup.slice(0, 3);

        updatedTeams = teams.map(team => {
          const relegateIndex = relegatedIds.indexOf(team.idnum);
          if (relegateIndex !== -1) {
            const promo = promoted[relegateIndex] || promoted[0];
            return {
              idnum: team.idnum,
              id: team.id,
              name: promo.name,
              attack: Math.floor(Math.random() * 2) + 2,
              midfield: Math.floor(Math.random() * 2) + 2,
              defense: Math.floor(Math.random() * 2) + 2,
              kit: promo.kit || "swe92/0.png",
              primaryColor: promo.primaryColor,
              secondaryColor: promo.secondaryColor,
              played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
            };
          } else {
            return {
              ...team,
              played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
            };
          }
        });
      }

      setNextSeasonTeams(updatedTeams);

      // Generate job offers
      const playerPos = standingsSorted.findIndex(t => t.idnum === playerTeamId) + 1;
      const finalExp = boardExpectation || { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };

      // Roll for Warning Tier decision if not rolled yet
      const isSA = region === "south_america" || country === "argentina" || country === "brazil" || country === "colombia";
      const confidence = getBoardConfidence(leagueState, standingsSorted, playerPos, isSA);
      const fanConf = leagueState.fanConfidence !== undefined ? leagueState.fanConfidence : 50;
      const combinedConf = (confidence + fanConf) / 2;

      let currentWarningSacked = leagueState.warningSacked;
      let stateChanged = false;

      if (currentWarningSacked === undefined) {
        if (confidence >= 55 && confidence < 70) {
          const roll = Math.random() * 100;
          currentWarningSacked = roll >= combinedConf;
        } else {
          currentWarningSacked = false;
        }
        stateChanged = true;
      }

      const tempState = { ...leagueState, warningSacked: currentWarningSacked };
      if (stateChanged) {
        localStorage.setItem("retro_league_career", JSON.stringify(tempState));
        setLeagueState(tempState);
      }

      const verdict = getBoardVerdict(playerPos, finalExp, tempState);
      const offers = generateJobOffers(updatedTeams, verdict.tier, nextStartYr, country);
      setJobOffers(offers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueState, nextSeasonTeams.length]);

  // Sync tracked world leagues, persistent AI managers, and live job vacancies on career progress
  useEffect(() => {
    if (!leagueState) return;
    const teamsList = leagueState.teams || [];
    const sorted = [...teamsList].sort((a, b) => (b.points || 0) - (a.points || 0));
    const pPos = !leagueState.isUnemployed && leagueState.playerTeamId !== null
      ? (sorted.findIndex((t) => t.idnum === leagueState.playerTeamId) + 1)
      : 10;
    const isSA = leagueState.region === "south_america" || SA_COUNTRIES.has(leagueState.country);
    const liveConf = (!leagueState.isUnemployed && leagueState.playerTeamId !== null)
      ? getBoardConfidence(leagueState, sorted, pPos, isSA)
      : 50;

    const synced = syncWorldProgressAndJobs({
      leagueState,
      managerPrestige: calculateManagerPrestige(managerProfile),
      boardConfidence: liveConf
    });

    if (synced.changed && synced.worldState) {
      const updatedCareer = {
        ...leagueState,
        worldState: synced.worldState,
        newsFeed: synced.newsItems.length > 0
          ? appendAndPruneNews(leagueState.newsFeed, synced.newsItems, leagueState.currentRound || 1)
          : pruneNewsFeed(leagueState.newsFeed, leagueState.currentRound || 1)
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedCareer));
      setLeagueState(updatedCareer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueState?.season, leagueState?.country, leagueState?.division, leagueState?.calendarIndex, leagueState?.currentRound, leagueState?.isUnemployed]);

  useEffect(() => {
    if (!leagueState || leagueState.isSacked || leagueState.isUnemployed) return;
    const { calendar, calendarIndex, currentRound, teams, playerTeamId, region, country } = leagueState;
    const totalRounds = getTotalLeagueRounds(teams, country, leagueState.fixtures);
    const isSeasonOverCalculated = calendar
      ? calendarIndex >= calendar.length
      : currentRound > totalRounds;

    if (isSeasonOverCalculated) return;

    const standingsList = [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
    const playerPos = standingsList.findIndex(t => t.idnum === playerTeamId) + 1;
    const isSA = region === "south_america" || country === "argentina" || country === "brazil" || country === "colombia";

    const confidence = getBoardConfidence(leagueState, standingsList, playerPos, isSA);
    const fanConfidence = leagueState.fanConfidence !== undefined ? leagueState.fanConfidence : 50;

    if ((confidence <= 0 || fanConfidence <= 0) && currentRound >= 10) {
      const reason = fanConfidence <= 0
        ? "Sacked by the board after supporter revolt"
        : "Contract terminated after board confidence dropped to 0%";
      const { nextLeagueState, updatedProfile } = enterUnemployedMode({
        leagueState,
        managerProfile,
        reason
      });
      localStorage.setItem("retro_manager_profile", JSON.stringify(updatedProfile));
      localStorage.setItem("retro_league_career", JSON.stringify(nextLeagueState));
      resetToDefaultTheme();
      setManagerProfile(updatedProfile);
      setLeagueState(nextLeagueState);
      setOfficeTab("jobs");
      alert(`🚨 BREAKING NEWS: ${reason}!\n\nYou are now an Unemployed Manager — track world leagues and apply for open jobs in the 💼 JOBS tab.`);
    }
  }, [leagueState, managerProfile]);

  const handleMidSeasonTakeover = async (targetJob) => {
    if (!leagueState || !targetJob || isJobBusy) return;
    setIsJobBusy(true);
    try {
      const { nextLeagueState, updatedProfile, newTeamObj } = await prepareMidSeasonTakeover({
        leagueState,
        targetJob,
        managerProfile,
        editName
      });
      const startYr = String(nextLeagueState.season || "2001").split("/")[0];
      const nextDetails = getTeamDetailsSync(newTeamObj.name, startYr);
      const prefFormation = getPreferredTeamFormation(newTeamObj.name, startYr, nextDetails);
      localStorage.setItem("retro_player_formation", prefFormation);
      localStorage.setItem(`retro_formation_${newTeamObj.name}_${nextLeagueState.season}`, prefFormation);
      localStorage.setItem("retro_manager_profile", JSON.stringify(updatedProfile));
      localStorage.setItem("retro_league_career", JSON.stringify(nextLeagueState));
      applyTeamTheme(newTeamObj);
      setManagerProfile(updatedProfile);
      setLeagueState(nextLeagueState);
      setSubStandingsTab(null);
      setActiveTab("league");
      setOfficeTab("home");
      alert(`✅ SIGNED WITH ${newTeamObj.name.toUpperCase()}!\nImmediate takeover complete for the ${nextLeagueState.season} campaign.`);
    } catch (err) {
      console.error("[Jobs] Mid-season takeover failed:", err);
      alert("Could not finalize takeover right now. Please try again.");
    } finally {
      setIsJobBusy(false);
    }
  };

  const handleApplyVacancy = async (vacancy) => {
    if (!leagueState || !vacancy || isJobBusy) return;
    const res = applyForVacancy({ leagueState, managerProfile, vacancy });
    if (res.accepted) {
      await handleMidSeasonTakeover(vacancy);
    } else {
      const updatedCareer = { ...leagueState, worldState: res.updatedWorldState };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedCareer));
      setLeagueState(updatedCareer);
      alert(`❌ APPLICATION REJECTED\n\n${res.reason}`);
    }
  };

  const handleDeclineDirectOffer = (offerId) => {
    if (!leagueState?.worldState) return;
    const updatedWorld = {
      ...leagueState.worldState,
      directOffers: (leagueState.worldState.directOffers || []).filter((o) => o.id !== offerId)
    };
    const updatedCareer = { ...leagueState, worldState: updatedWorld };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedCareer));
    setLeagueState(updatedCareer);
  };

  const handleResignFromClub = () => {
    if (!leagueState || leagueState.isUnemployed) return;
    const clubName = leagueState.teams?.find((t) => t.idnum === leagueState.playerTeamId)?.name || "your club";
    if (!window.confirm(`Resign immediately from ${clubName} and enter the live job market as an Unemployed Manager?`)) {
      return;
    }
    const { nextLeagueState, updatedProfile } = enterUnemployedMode({
      leagueState,
      managerProfile,
      reason: `Voluntarily resigned from ${clubName}`
    });
    localStorage.setItem("retro_manager_profile", JSON.stringify(updatedProfile));
    localStorage.setItem("retro_league_career", JSON.stringify(nextLeagueState));
    resetToDefaultTheme();
    setManagerProfile(updatedProfile);
    setLeagueState(nextLeagueState);
    setOfficeTab("jobs");
  };

  const handleAdvanceUnemployedWeek = () => {
    if (!leagueState || !leagueState.isUnemployed) return;
    const cal = leagueState.calendar;
    const idx = leagueState.calendarIndex || 0;
    const ev = cal && idx < cal.length ? cal[idx] : null;
    if (ev && (ev.type === "europe" || ev.type === "europe_qualifier")) {
      // Let existing rest-week/europe simulator advance midweek European competition cleanly
      simulateRestWeek();
      return;
    }
    const res = simulateUnemployedWeek(leagueState, calculateManagerPrestige(managerProfile));
    if (!res) return;
    localStorage.setItem("retro_league_career", JSON.stringify(res.nextLeagueState));
    setLeagueState(res.nextLeagueState);
    if (res.simulatedFixtures && res.simulatedFixtures.length > 0) {
      setResultsModalFixtures(res.simulatedFixtures);
      setResultsModalTitle(res.simulatedType === "domestic_cup" ? "DOMESTIC CUP RESULTS" : `WORLD & LEAGUE ROUND ${Math.max(1, (res.nextLeagueState.currentRound || 2) - 1)}`);
      setResultsModalTheme(res.simulatedType === "domestic_cup" ? "#ff0055" : "#00e5ff");
      setResultsModalOpen(true);
    }
  };

  const handleSignContract = async (selectedTeamId, customPlayerTeam = null) => {
    if (!leagueState || nextSeasonTeams.length === 0) return;

    // 1. Sort Standings Table (domestic league)
    const currentStandings = [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });

    const playerTeamStats = !leagueState.isUnemployed ? currentStandings.find(t => t.idnum === playerTeamId) : null;
    const pPos = playerTeamStats ? currentStandings.findIndex(t => t.idnum === playerTeamId) + 1 : 0;

    // Check if player won European or Domestic cup
    let isEuroCupWinner = false;
    if (playerTeamStats && europeanCupState && europeanCupState.knockoutState && europeanCupState.knockoutState.final) {
      const finalMatch = europeanCupState.knockoutState.final[0];
      if (finalMatch && finalMatch.played) {
        const pId = europeanCupState.europeanPlayerTeamId;
        const homeScore = finalMatch.homeScore + (finalMatch.penaltyHomeScore || 0);
        const awayScore = finalMatch.awayScore + (finalMatch.penaltyAwayScore || 0);
        if (homeScore > awayScore) {
          isEuroCupWinner = finalMatch.homeId === pId;
        } else if (awayScore > homeScore) {
          isEuroCupWinner = finalMatch.awayId === pId;
        }
      }
    }

    let isDomesticCupWinner = false;
    if (playerTeamStats && leagueState.domesticCupState && leagueState.domesticCupState.isCompleted && leagueState.domesticCupState.winnerId === playerTeamId) {
      isDomesticCupWinner = true;
    }

    const totalCupTitlesWon = (isEuroCupWinner ? 1 : 0) + (isDomesticCupWinner ? 1 : 0);

    // 2. Aggregate stats to the lifetime Manager Profile (respecting partial mid-season stintBaseline)
    const isSA = region === "south_america" || country === "argentina" || country === "colombia";
    const isAperturaClausura = country === "argentina" || country === "colombia" || country === "mexico";
    const wonApertura = Boolean(playerTeamStats) && isAperturaClausura && (leagueState.aperturaChampion === playerTeamStats.name);
    const wonClausura = Boolean(playerTeamStats) && isAperturaClausura && (leagueState.clausuraChampion === playerTeamStats.name);
    const titlesWonCount = playerTeamStats
      ? (isAperturaClausura ? ((wonApertura ? 1 : 0) + (wonClausura ? 1 : 0)) : (pPos === 1 ? 1 : 0))
      : 0;

    const trophyNames = [];
    if (titlesWonCount > 0) {
      if (isAperturaClausura) {
        if (wonApertura) trophyNames.push(`${cap(country)} Apertura Title`);
        if (wonClausura) trophyNames.push(`${cap(country)} Clausura Title`);
      } else {
        trophyNames.push(`${cap(country)} Division ${leagueState.division || 1} Champion`);
      }
    }
    if (isDomesticCupWinner) {
      trophyNames.push(leagueState.domesticCupState?.cupName || "Domestic Cup");
    }
    if (isEuroCupWinner) {
      const euroLabel = isNorthAmerica
        ? "CONCACAF Champions Cup"
        : isSouthAmerica
          ? (europeanCup === "cl" ? "Copa Libertadores" : "Copa Sudamericana")
          : (europeanCup === "cl" ? "Champions Cup / UCL" : (europeanCup === "uefa" ? "UEFA Cup / Europa League" : "Conference League"));
      trophyNames.push(euroLabel);
    }

    const updatedProfile = finalizeStintAndSeasonToProfile({
      profile: managerProfile,
      season,
      clubName: playerTeamStats ? playerTeamStats.name : null,
      country,
      division: leagueState.division || 1,
      teamStats: playerTeamStats,
      stintBaseline: leagueState.stintBaseline,
      isSeasonComplete: true,
      leaguePos: pPos > 0 ? pPos : null,
      leagueTitleCount: titlesWonCount,
      cupTitleCount: totalCupTitlesWon,
      trophyNames,
      monthlyAwardsWon: (leagueState.monthlyAwards || []).filter(m => m.motm?.winner?.isUser).length,
      motyWon: leagueState.yearlyAwards?.moty?.winner?.isUser ? 1 : 0,
      exitNote: pPos > 0 ? `Finished ${formatOrdinal(pPos)}` : "Unemployed Season"
    });
    localStorage.setItem("retro_manager_profile", JSON.stringify(updatedProfile));
    setManagerProfile(updatedProfile);

    // 3. Advance Year
    const yearParts = season.split("/");
    const startYr = parseInt(yearParts[0]);
    const nextStartYr = startYr + 1;
    const nextEndYr = (nextStartYr + 1) % 100;
    const nextSeasonStr = `${nextStartYr}/${String(nextEndYr).padStart(2, '0')}`;

    // Resolve target country, division, and roster
    let finalNextSeasonTeams = nextSeasonTeams;
    let finalCountry = country;
    const currentDivision = leagueState.division || 1;
    let nextDivision = currentDivision;
    const startYrStr = String(startYr);
    const hasD2Current = leagueDataMapD2[startYrStr] && leagueDataMapD2[startYrStr][country];

    const chosenOffer = jobOffers.find(o => o.idnum === selectedTeamId);
    if (chosenOffer) {
      nextDivision = chosenOffer.division || 1;
      if (chosenOffer.country !== country) {
        finalCountry = chosenOffer.country;
        const isSADest = SA_COUNTRIES.has(finalCountry);
        const isNADest = NA_COUNTRIES.has(finalCountry);
        const nextStartYrStr = String(nextStartYr);
        const hasD2Dest = leagueDataMapD2[nextStartYrStr] && leagueDataMapD2[nextStartYrStr][finalCountry];
        const targetMap = (nextDivision === 2 && hasD2Dest)
          ? leagueDataMapD2
          : (isNADest ? leagueDataMapNA : (isSADest ? leagueDataMapSA : leagueDataMap));
        const fallbackKey = isNADest ? "mexico" : (isSADest ? "argentina" : "england");
        const targetRoster = (targetMap[nextStartYrStr] && targetMap[nextStartYrStr][finalCountry])
          ? targetMap[nextStartYrStr][finalCountry]
          : (targetMap[nextStartYrStr] ? Object.values(targetMap[nextStartYrStr])[0] : leagueDataMap[nextStartYrStr][fallbackKey]);
        finalNextSeasonTeams = targetRoster.map(t => ({
          ...t,
          played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
        }));
      } else if (nextDivision !== currentDivision) {
        // Different division, same country via job offer
        const nextStartYrStr = String(nextStartYr);
        const isSACurrent = SA_COUNTRIES.has(country);
        const isNACurrent = NA_COUNTRIES.has(country);
        let targetRoster = null;
        if (nextDivision === 1) {
          const d1Map = isNACurrent ? leagueDataMapNA : (isSACurrent ? leagueDataMapSA : leagueDataMap);
          targetRoster = (d1Map[nextStartYrStr] && d1Map[nextStartYrStr][country]) || null;
        } else {
          const hasD2Next = leagueDataMapD2[nextStartYrStr] && leagueDataMapD2[nextStartYrStr][country];
          targetRoster = hasD2Next ? leagueDataMapD2[nextStartYrStr][country] : null;
        }
        if (targetRoster) {
          finalNextSeasonTeams = targetRoster.map(t => ({
            ...t,
            played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
          }));
        }
      }
    } else {
      if (hasD2Current) {
        if (currentDivision === 2) {
          const wasPromoted = currentStandings.findIndex(t => t.idnum === playerTeamId) < 3;
          nextDivision = wasPromoted ? 1 : 2;
        } else {
          const wasRelegated = currentStandings.findIndex(t => t.idnum === playerTeamId) >= (currentStandings.length - 3);
          nextDivision = wasRelegated ? 2 : 1;
        }
      }

      // If division changed (promotion or relegation), load the correct roster
      if (nextDivision !== currentDivision) {
        const nextStartYrStr = String(nextStartYr);
        const isSACurrent = SA_COUNTRIES.has(country);
        const isNACurrent = NA_COUNTRIES.has(country);
        const playerTeamObj = currentStandings.find(t => t.idnum === playerTeamId);
        const playerTeamName = playerTeamObj ? playerTeamObj.name : null;

        let targetRoster = null;
        if (nextDivision === 1) {
          // Promoted from D2 to D1 — load D1 roster
          const d1Map = isNACurrent ? leagueDataMapNA : (isSACurrent ? leagueDataMapSA : leagueDataMap);
          targetRoster = (d1Map[nextStartYrStr] && d1Map[nextStartYrStr][country]) || null;
        } else {
          // Relegated from D1 to D2 — load D2 roster
          const hasD2Next = leagueDataMapD2[nextStartYrStr] && leagueDataMapD2[nextStartYrStr][country];
          targetRoster = hasD2Next ? leagueDataMapD2[nextStartYrStr][country] : null;
        }

        if (targetRoster) {
          finalNextSeasonTeams = targetRoster.map(t => ({
            ...t,
            played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
          }));
          // Find the player's team in the new roster by name and update selectedTeamId
          if (playerTeamName) {
            const matchInNewRoster = finalNextSeasonTeams.find(t => t.name.toLowerCase() === playerTeamName.toLowerCase());
            if (matchInNewRoster) {
              selectedTeamId = matchInNewRoster.idnum;
            }
          }
        }
      } else if (NA_COUNTRIES.has(country)) {
        const playerTeamObj = currentStandings.find(t => t.idnum === playerTeamId);
        const playerTeamName = playerTeamObj ? playerTeamObj.name : null;
        if (playerTeamName) {
          const matchInNewRoster = finalNextSeasonTeams.find(t => t.name.toLowerCase() === playerTeamName.toLowerCase());
          if (matchInNewRoster) {
            selectedTeamId = matchInNewRoster.idnum;
          }
        }
      } else if (HISTORICAL_FEDERATION_COUNTRIES.has(country)) {
        const rollover = buildExYugoslaviaNextSeason({
          country,
          nextStartYr,
          teams,
          playerTeamId,
          leagueDataMap,
          scaleStat: scaleStatTo10
        });
        if (!rollover.canRenew) {
          return;
        }
        finalCountry = rollover.targetCountry;
        finalNextSeasonTeams = rollover.nextTeams;
        nextDivision = 1;
        if (rollover.resolvedPlayerTeamId !== null) {
          selectedTeamId = rollover.resolvedPlayerTeamId;
        }
      }
    }

    const playerTeamObjBeforeReset = currentStandings.find(t => t.idnum === playerTeamId) || null;

    // Get selected team details
    const selectedTeamObj = finalNextSeasonTeams.find(t => t.idnum === selectedTeamId);

    // Team stats upgrades are removed as they are calculated dynamically based on player lineup

    const selectedTeamName = selectedTeamObj ? selectedTeamObj.name : "";

    // 4. European/SA/NA Qualification Settings
    let nextEuropeanCup = null;
    let nextEuropeanCupState = null;
    let nextEuropeanQualifierState = null;
    let nextCalendar = null;
    const isSAFinalCountry = SA_COUNTRIES.has(finalCountry);
    const isNAFinalCountry = NA_COUNTRIES.has(finalCountry);
    const pPosPrev = currentStandings.findIndex(t => t.idnum === playerTeamId) + 1;

    if (nextDivision === 1) {
      if (finalCountry === country && currentDivision === 1) {
        // Dynamic qualification based on current season's final standings using historical spot counts
        const startYrStr = season.split("/")[0];
        if (isNAFinalCountry) {
          const activeQualsNA = qualifiersBySeasonNA[startYrStr];
          const numConcSpots = (activeQualsNA && activeQualsNA.cl && activeQualsNA.cl[country]) ? activeQualsNA.cl[country].length : 2;
          const concTeamNames = currentStandings.slice(0, numConcSpots).map(t => t.name);
          if (concTeamNames.includes(selectedTeamName)) {
            nextEuropeanCup = "cl";
          }
        } else if (isSAFinalCountry) {
          // SA qualification: use qualifiersBySeasonSA
          const activeQualsSA = qualifiersBySeasonSA[startYrStr];
          const numClibSpots = (activeQualsSA && activeQualsSA.cl && activeQualsSA.cl[country]) ? activeQualsSA.cl[country].length : 3;
          const numCsudSpots = (activeQualsSA && activeQualsSA.uefa && activeQualsSA.uefa[country]) ? activeQualsSA.uefa[country].length : 3;
          const clibTeamNames = currentStandings.slice(0, numClibSpots).map(t => t.name);
          const csudTeamNames = currentStandings.slice(numClibSpots, numClibSpots + numCsudSpots).map(t => t.name);
          if (clibTeamNames.includes(selectedTeamName)) {
            nextEuropeanCup = "cl";
          } else if (csudTeamNames.includes(selectedTeamName)) {
            nextEuropeanCup = "uefa";
          }
        } else if (!isUefaCountryBanned(country, nextStartYr, 'all')) {
          const activeQuals = qualifiersBySeason[startYrStr];
          const numClSpots = (activeQuals && activeQuals.cl && activeQuals.cl[country]) ? activeQuals.cl[country].length : 1;
          const numUefaSpots = (activeQuals && activeQuals.uefa && activeQuals.uefa[country]) ? activeQuals.uefa[country].length : 3;
          const numUeclSpots = (activeQuals && activeQuals.uecl && activeQuals.uecl[country]) ? activeQuals.uecl[country].length : 0;
          const clTeamNames = currentStandings.slice(0, numClSpots).map(t => t.name);
          const uefaTeamNames = currentStandings.slice(numClSpots, numClSpots + numUefaSpots).map(t => t.name);
          const ueclTeamNames = currentStandings.slice(numClSpots + numUefaSpots, numClSpots + numUefaSpots + numUeclSpots).map(t => t.name);
          if (clTeamNames.includes(selectedTeamName) && !isUefaCountryBanned(country, nextStartYr, 'cl')) {
            nextEuropeanCup = "cl";
          } else if (uefaTeamNames.includes(selectedTeamName)) {
            nextEuropeanCup = "uefa";
          } else if (ueclTeamNames.includes(selectedTeamName)) {
            nextEuropeanCup = "uecl";
          }
        }
      } else {
        // Historical database qualification for the new country
        if (isNAFinalCountry) {
          const nextQualifiersNA = qualifiersBySeasonNA[String(nextStartYr)];
          if (nextQualifiersNA) {
            const concQuals = (nextQualifiersNA.cl && nextQualifiersNA.cl[finalCountry]) || [];
            if (concQuals.includes(selectedTeamName)) {
              nextEuropeanCup = "cl";
            }
          }
        } else if (isSAFinalCountry) {
          const nextQualifiersSA = qualifiersBySeasonSA[String(nextStartYr)];
          if (nextQualifiersSA) {
            const clibQuals = (nextQualifiersSA.cl && nextQualifiersSA.cl[finalCountry]) || [];
            const csudQuals = (nextQualifiersSA.uefa && nextQualifiersSA.uefa[finalCountry]) || [];
            if (clibQuals.includes(selectedTeamName)) {
              nextEuropeanCup = "cl";
            } else if (csudQuals.includes(selectedTeamName)) {
              nextEuropeanCup = "uefa";
            }
          }
        } else if (!isUefaCountryBanned(finalCountry, nextStartYr, 'all')) {
          const nextQualifiers = qualifiersBySeason[String(nextStartYr)];
          if (nextQualifiers) {
            const clQuals = nextQualifiers.cl[finalCountry] || [];
            const uefaQuals = nextQualifiers.uefa[finalCountry] || [];
            const ueclQuals = (nextQualifiers.uecl && nextQualifiers.uecl[finalCountry]) || [];
          if (clQuals.some(q => isSameEuropeanClubName(q, selectedTeamName)) && !isUefaCountryBanned(finalCountry, nextStartYr, 'cl')) {
              nextEuropeanCup = "cl";
            } else if (uefaQuals.some(q => isSameEuropeanClubName(q, selectedTeamName))) {
              nextEuropeanCup = "uefa";
            } else if (ueclQuals.some(q => isSameEuropeanClubName(q, selectedTeamName))) {
              nextEuropeanCup = "uecl";
            }
          }
        }
      }

      // Check 2-leg UEFA Qualifying Play-Off eligibility when D1 Champion/Runner-up missed direct spots
      const isContinuationInSameOrSuccessor = finalCountry === country || (!chosenOffer && HISTORICAL_FEDERATION_COUNTRIES.has(country));
      if (!isSAFinalCountry && isContinuationInSameOrSuccessor && currentDivision === 1) {
        const qualComp = determineEuropeanQualifier({
          country: finalCountry,
          currentDivision,
          nextDivision,
          playerPosition: pPosPrev,
          nextEuropeanCup,
          nextStartYr,
          isSA: isSAFinalCountry
        });
        if (qualComp) {
          const qualOpp = pickQualifierOpponent({
            competition: qualComp,
            seasonYear: nextStartYr,
            playerTeamName: selectedTeamName,
            domesticTeams: finalNextSeasonTeams
          });
          nextEuropeanCup = null;
          nextEuropeanCupState = null;
          nextEuropeanQualifierState = {
            competition: qualComp,
            competitionLabel: getQualifierCompetitionTitle(qualComp, nextSeasonStr),
            season: nextSeasonStr,
            opponent: qualOpp,
            opponentTeamKey: qualOpp.idnum,
            leg1HomeId: selectedTeamId,
            leg1AwayId: qualOpp.idnum,
            leg1HomeScore: 0,
            leg1AwayScore: 0,
            leg1Played: false,
            leg2HomeId: qualOpp.idnum,
            leg2AwayId: selectedTeamId,
            leg2HomeScore: 0,
            leg2AwayScore: 0,
            leg2Played: false,
            completed: false,
            qualified: false
          };
        }
      }
    }

    if (nextEuropeanCup) {
      // Find the closest template rules year available (NA, SA, or European)
      let rules;
      if (isNAFinalCountry) {
        const concYears = Object.keys(concacafRules).map(Number).sort((a, b) => a - b);
        const closestConcYear = concYears.reduce((prev, curr) => Math.abs(curr - nextStartYr) < Math.abs(prev - nextStartYr) ? curr : prev);
        rules = concacafRules[String(closestConcYear)];
      } else if (isSAFinalCountry) {
        const clibYears = Object.keys(clibRules).map(Number).sort((a, b) => a - b);
        const closestClibYear = clibYears.reduce((prev, curr) => Math.abs(curr - nextStartYr) < Math.abs(prev - nextStartYr) ? curr : prev);
        const csudYears = Object.keys(csudRules).map(Number).sort((a, b) => a - b);
        const closestCsudYear = csudYears.reduce((prev, curr) => Math.abs(curr - nextStartYr) < Math.abs(prev - nextStartYr) ? curr : prev);
        rules = nextEuropeanCup === "cl" ? clibRules[String(closestClibYear)] : csudRules[String(closestCsudYear)];
      } else {
        const clYears = Object.keys(clRules).map(Number).sort((a, b) => a - b);
        const closestClYear = clYears.reduce((prev, curr) => Math.abs(curr - nextStartYr) < Math.abs(prev - nextStartYr) ? curr : prev);
        const uefaYears = Object.keys(uefaRules).map(Number).sort((a, b) => a - b);
        const closestUefaYear = uefaYears.reduce((prev, curr) => Math.abs(curr - nextStartYr) < Math.abs(prev - nextStartYr) ? curr : prev);
        const ueclYears = Object.keys(ueclRules).map(Number).sort((a, b) => a - b);
        const closestUeclYear = ueclYears.reduce((prev, curr) => Math.abs(curr - nextStartYr) < Math.abs(prev - nextStartYr) ? curr : prev);
        const rulesClYearStr = String(closestClYear);
        const rulesUefaYearStr = String(closestUefaYear);
        const rulesUeclYearStr = String(closestUeclYear);
        rules = nextEuropeanCup === "cl" ? clRules[rulesClYearStr] : (nextEuropeanCup === "uefa" ? uefaRules[rulesUefaYearStr] : ueclRules[rulesUeclYearStr]);
      }

      // Deep copy European Cup teams template
      const euroTeams = JSON.parse(JSON.stringify(rules.teamsData));
      const domesticNames = finalNextSeasonTeams.map(t => t.name);

      let nextEuropeanPlayerTeamId = null;
      const existingTeamIndex = euroTeams.findIndex(t => isSameEuropeanClubName(t.name, selectedTeamName));

      if (existingTeamIndex !== -1) {
        nextEuropeanPlayerTeamId = euroTeams[existingTeamIndex].idnum;
      } else {
        // Find first team in the European Cup from same domestic league and swap with new player team
        const indexToReplace = euroTeams.findIndex(t => domesticNames.some(dn => isSameEuropeanClubName(dn, t.name)));
        if (indexToReplace !== -1) {
          euroTeams[indexToReplace].name = selectedTeamObj.name;
          euroTeams[indexToReplace].primaryColor = selectedTeamObj.primaryColor;
          euroTeams[indexToReplace].secondaryColor = selectedTeamObj.secondaryColor;
          euroTeams[indexToReplace].kit = selectedTeamObj.kit;
          nextEuropeanPlayerTeamId = euroTeams[indexToReplace].idnum;
        } else {
          // Fallback: replace first team in the cup
          euroTeams[0].name = selectedTeamObj.name;
          euroTeams[0].primaryColor = selectedTeamObj.primaryColor;
          euroTeams[0].secondaryColor = selectedTeamObj.secondaryColor;
          euroTeams[0].kit = selectedTeamObj.kit;
          nextEuropeanPlayerTeamId = euroTeams[0].idnum;
        }
      }

      // Sync stats of domestic teams in the European Cup with their updated domestic stats
      euroTeams.forEach(euroTeam => {
        const domesticTeam = finalNextSeasonTeams.find(t => isSameEuropeanClubName(t.name, euroTeam.name));
        if (domesticTeam) {
          euroTeam.attack = domesticTeam.attack;
          euroTeam.midfield = domesticTeam.midfield;
          euroTeam.defense = domesticTeam.defense;
        }
      });

      // Initialize calendar
      const baseNextRounds = finalNextSeasonTeams.length % 2 === 0 ? finalNextSeasonTeams.length - 1 : finalNextSeasonTeams.length;
      const nextTotalRounds = baseNextRounds * getLeagueRoundCycles(finalCountry, finalNextSeasonTeams.length);
      const dynamicSchedules = generateDynamicSchedules(nextTotalRounds, rules);
      nextCalendar = [];
      for (let r = 1; r <= nextTotalRounds; r++) {
        nextCalendar.push({ type: "league", index: r });
      }

      // Interleave European fixture dates using descending order to splice correctly
      const sortedSlots = [...dynamicSchedules].sort((a, b) => b.offset - a.offset);
      sortedSlots.forEach(slot => {
        if (slot.stage !== "final") {
          nextCalendar.splice(slot.offset, 0, { type: "europe", stage: slot.stage, matchday: slot.matchday });
        }
      });
      sortedSlots.forEach(slot => {
        if (slot.stage === "final") {
          nextCalendar.push({ type: "europe", stage: slot.stage, matchday: slot.matchday });
        }
      });

      if (rules.format === "group_then_knockout") {
        // Build CL Group fixtures
        const clFixtures = [];
        const groups = [...new Set(euroTeams.map(t => t.group))].filter(g => g !== "bye" && g !== "champion").sort();
        const firstGroupTeams = euroTeams.filter(t => t.group === groups[0]);
        const numMatchdays = firstGroupTeams.length === 5 ? 5 : 6;
        for (let m = 0; m < numMatchdays; m++) clFixtures.push([]);

        groups.forEach(g => {
          const gTeams = euroTeams.filter(t => t.group === g);
          if (gTeams.length === 5) {
            const t0 = gTeams[0].idnum;
            const t1 = gTeams[1].idnum;
            const t2 = gTeams[2].idnum;
            const t3 = gTeams[3].idnum;
            const t4 = gTeams[4].idnum;

            // Matchday 1
            clFixtures[0].push({ homeId: t1, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });

            // Matchday 2
            clFixtures[1].push({ homeId: t0, awayId: t4, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });

            // Matchday 3
            clFixtures[2].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[2].push({ homeId: t4, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });

            // Matchday 4
            clFixtures[3].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[3].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });

            // Matchday 5
            clFixtures[4].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[4].push({ homeId: t4, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
          } else {
            const t0 = gTeams[0].idnum;
            const t1 = gTeams[1].idnum;
            const t2 = gTeams[2].idnum;
            const t3 = gTeams[3].idnum;

            clFixtures[0].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[1].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[1].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[2].push({ homeId: t0, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[2].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[3].push({ homeId: t1, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[3].push({ homeId: t3, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[4].push({ homeId: t0, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[4].push({ homeId: t2, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[5].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
            clFixtures[5].push({ homeId: t1, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
          }
        });

        nextEuropeanCupState = {
          teams: euroTeams,
          fixtures: clFixtures,
          europeanPlayerTeamId: nextEuropeanPlayerTeamId,
          knockoutState: {
            roundOf32Leg1: null, roundOf32Leg2: null,
            roundOf16Leg1: null, roundOf16Leg2: null,
            quarterFinalsLeg1: null, quarterFinalsLeg2: null,
            semiFinalsLeg1: null, semiFinalsLeg2: null,
            final: null
          }
        };
      } else if (rules.format === "league_then_knockout") {
        // Build League fixtures (using the circle method matchmaking for first 8 rounds)
        const clFixtures = [];
        const numTeams = euroTeams.length; // 36
        const rounds = 8;

        const list = [...euroTeams];
        for (let r = 0; r < rounds; r++) {
          const roundPairs = [];
          for (let i = 0; i < numTeams / 2; i++) {
            const home = list[i];
            const away = list[numTeams - 1 - i];

            // Alternate home/away to balance
            if (r % 2 === 0) {
              roundPairs.push({ homeId: home.idnum, awayId: away.idnum, played: false, homeScore: 0, awayScore: 0 });
            } else {
              roundPairs.push({ homeId: away.idnum, awayId: home.idnum, played: false, homeScore: 0, awayScore: 0 });
            }
          }
          clFixtures.push(roundPairs);
          list.splice(1, 0, list.pop());
        }

        nextEuropeanCupState = {
          teams: euroTeams,
          fixtures: clFixtures,
          europeanPlayerTeamId: nextEuropeanPlayerTeamId,
          knockoutState: {
            playoffsLeg1: null, playoffsLeg2: null,
            roundOf16Leg1: null, roundOf16Leg2: null,
            quarterFinalsLeg1: null, quarterFinalsLeg2: null,
            semiFinalsLeg1: null, semiFinalsLeg2: null,
            final: null
          }
        };
      } else if (rules.format === "pure_knockout") {
        const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
        const firstStage = rules.stages[0];
        const firstLegKey = toCamelCase(firstStage) + "Leg1";
        const secondLegKey = toCamelCase(firstStage) + "Leg2";

        const leg1Fixtures = [];
        for (let i = 0; i < euroTeams.length; i += 2) {
          leg1Fixtures.push({
            homeId: euroTeams[i].idnum,
            awayId: euroTeams[i + 1].idnum,
            played: false,
            homeScore: 0,
            awayScore: 0
          });
        }
        const leg2Fixtures = leg1Fixtures.map(m => ({
          homeId: m.awayId,
          awayId: m.homeId,
          played: false,
          homeScore: 0,
          awayScore: 0
        }));

        const knockoutState = {
          roundOf32Leg1: null, roundOf32Leg2: null,
          roundOf16Leg1: null, roundOf16Leg2: null,
          quarterFinalsLeg1: null, quarterFinalsLeg2: null,
          semiFinalsLeg1: null, semiFinalsLeg2: null,
          final: null
        };
        knockoutState[firstLegKey] = leg1Fixtures;
        knockoutState[secondLegKey] = leg2Fixtures;

        nextEuropeanCupState = {
          teams: euroTeams,
          europeanPlayerTeamId: nextEuropeanPlayerTeamId,
          knockoutState
        };
      }
    }

    // 6. Generate fresh Round-Robin Fixtures for domestic league
    const nextFixtures = generateRoundRobinFixtures(finalNextSeasonTeams, getLeagueRoundCycles(finalCountry, finalNextSeasonTeams.length));
    const newBoardExpectation = getExpectation(selectedTeamObj, finalNextSeasonTeams, nextDivision, finalCountry, nextSeasonStr.split("/")[0]);

    // Compute budget for next season
    const avgRating = (selectedTeamObj.attack + selectedTeamObj.midfield + selectedTeamObj.defense) / 3;
    const normRating5 = avgRating > 5 ? avgRating / 2 : avgRating;
    const divisionMultiplier = nextDivision === 2 ? 0.3 : 1.2;
    const eraMultiplier = 1 + (parseInt(nextSeasonStr.split("/")[0]) - 1980) * 0.04;
    const nextDetails = getTeamDetailsSync(selectedTeamObj.name, nextSeasonStr.split("/")[0]);
    const newClubBaseBudget = (nextDetails && nextDetails.finances && typeof nextDetails.finances.transferBudget === 'number')
      ? nextDetails.finances.transferBudget
      : Math.max(0.5, parseFloat((Math.pow(normRating5, 2.2) * divisionMultiplier * eraMultiplier).toFixed(1)));
    const isPlayerRenewing = Boolean(!chosenOffer && playerTeamObjBeforeReset && (selectedTeamId === playerTeamId || selectedTeamObj.name.toLowerCase() === playerTeamObjBeforeReset.name.toLowerCase() || HISTORICAL_FEDERATION_COUNTRIES.has(country)));

    let nextBudget = newClubBaseBudget;
    let nextPayrollBudget = (nextDetails && nextDetails.finances && typeof nextDetails.finances.estimatedWeeklyPayroll === 'number')
      ? Math.round(nextDetails.finances.estimatedWeeklyPayroll * 1.12)
      : undefined;
    if (isPlayerRenewing) {
      const finalConfidence = getBoardConfidence(leagueState, currentStandings, pPos, isSA);
      const remainingBudget = leagueState.budget || 0;
      if (finalConfidence >= 70) {
        // Expectations met/exceeded: carry over remaining budget + full new base funding
        nextBudget = parseFloat((remainingBudget + newClubBaseBudget).toFixed(1));
      } else {
        // Expectations not met: carry over remaining budget + only 20% slice of base funding
        nextBudget = parseFloat((remainingBudget + newClubBaseBudget * 0.2).toFixed(1));
      }
      if (leagueState.payrollBudget && (!nextPayrollBudget || leagueState.payrollBudget > nextPayrollBudget)) {
        nextPayrollBudget = Math.round(leagueState.payrollBudget * 1.05);
      }
    }

    // Initialize Domestic Cup for next season
    const nextTotalRounds = nextFixtures.length;
    const nextStartYearStr = nextSeasonStr.split("/")[0];
    const rawNextD1 = finalNextSeasonTeams.map(t => ({ ...t, division: t.division || 1 }));
    const rawNextD2 = ((leagueDataMapD2[nextStartYearStr] && leagueDataMapD2[nextStartYearStr][finalCountry]) || []).map(t => ({ ...t, division: 2 }));
    const nextDomRoster = [...rawNextD1, ...rawNextD2];
    const nextDomesticCupState = createDomesticCup(nextDomRoster, nextTotalRounds, finalCountry, selectedTeamId);
    const nextSelectedTeam = finalNextSeasonTeams.find(t => t.idnum === selectedTeamId);
    const nextDomesticCupExpectation = getDomesticCupExpectation(nextSelectedTeam || {}, nextDomesticCupState.bracketSize);

    if (!nextCalendar) {
      nextCalendar = [];
      for (let r = 1; r <= nextTotalRounds; r++) {
        nextCalendar.push({ type: "league", index: r });
      }
    }

    if (nextDomesticCupState.calendarSchedules) {
      const domSlots = [...nextDomesticCupState.calendarSchedules].sort((a, b) => b.offset - a.offset);
      domSlots.forEach(slot => {
        if (slot.stage !== "final") {
          nextCalendar.splice(slot.offset, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
        } else {
          const finalIdx = Math.max(1, nextCalendar.length - 1);
          nextCalendar.splice(finalIdx, 0, { type: "domestic_cup", stage: slot.stage, isDomesticCup: true });
        }
      });
    }

    if (nextEuropeanQualifierState) {
      nextCalendar.unshift(
        { type: "europe_qualifier", leg: 1, competition: nextEuropeanQualifierState.competition },
        { type: "europe_qualifier", leg: 2, competition: nextEuropeanQualifierState.competition }
      );
    }

    // 7. Preload next season rosters + market pool so squad continuity, skill progression,
    // ledger filtering (no duplicates), and 36-40+ retirements process cleanly
    await Promise.all([
      loadSeasonRosters(nextStartYearStr),
      getTransferMarketPool(nextStartYearStr)
    ]);

    let retirementNews = [];
    let teamsForNextState = finalNextSeasonTeams;

    if (isPlayerRenewing) {
      const continuity = advancePlayerSquadForNextSeason({
        teamName: selectedTeamName,
        prevTeamName: playerTeamObjBeforeReset ? playerTeamObjBeforeReset.name : selectedTeamName,
        prevSeason: season,
        nextSeason: nextSeasonStr
      });
      if (continuity && Array.isArray(continuity.squad) && continuity.squad.length > 0) {
        const updatedAverages = calculateSquadTacticalAverages(continuity.squad);
        if (updatedAverages) {
          teamsForNextState = finalNextSeasonTeams.map(t =>
            t.idnum === selectedTeamId
              ? { ...t, attack: updatedAverages.attack, midfield: updatedAverages.midfield, defense: updatedAverages.defense }
              : t
          );
        }
      }
      if (continuity && Array.isArray(continuity.retiredPlayers) && continuity.retiredPlayers.length > 0) {
        retirementNews = generateRetirementNews({
          retirees: continuity.retiredPlayers,
          teamName: selectedTeamName,
          season: nextSeasonStr,
          round: 1
        });
      }
    } else {
      // Player switched clubs: load the new club's roster filtered by global transfer ledger
      const newClubRoster = await getPrebuiltRoster(selectedTeamName, nextSeasonStr);
      if (Array.isArray(newClubRoster) && newClubRoster.length > 0) {
        const updatedAverages = calculateSquadTacticalAverages(newClubRoster);
        if (updatedAverages) {
          teamsForNextState = finalNextSeasonTeams.map(t =>
            t.idnum === selectedTeamId
              ? { ...t, attack: updatedAverages.attack, midfield: updatedAverages.midfield, defense: updatedAverages.defense }
              : t
          );
        }
      }
    }

    const openerNews = generateInitialNews({
      teamName: selectedTeamName,
      managerName: editName || managerProfile.name,
      expectation: newBoardExpectation || { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" },
      budget: nextBudget,
      season: nextSeasonStr
    });
    const initialNextNewsFeed = [...retirementNews, ...(Array.isArray(openerNews) ? openerNews : [])];

    const nextRegionStr = isSAFinalCountry ? "south_america" : (isNAFinalCountry ? "north_america" : "europe");
    const carriedWorldState = carryoverWorldForNextSeason({
      prevWorldState: leagueState.worldState,
      nextSeasonStr,
      nextRegion: nextRegionStr,
      nextCountry: finalCountry,
      nextDivision,
      nextTeams: teamsForNextState,
      playerTeamId: selectedTeamId
    });

    // 8. Construct final new season object
    const nextLeagueState = {
      season: nextSeasonStr,
      country: finalCountry,
      region: nextRegionStr,
      playerTeamId: selectedTeamId,
      managerName: editName || managerProfile.name,
      isUnemployed: false,
      isSacked: false,
      stintBaseline: null,
      boardExpectation: newBoardExpectation || { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" },
      domesticCupExpectation: nextDomesticCupExpectation,
      domesticCupState: nextDomesticCupState,
      currentRound: 1,
      teams: teamsForNextState,
      fixtures: nextFixtures,
      europeanCup: nextEuropeanCup,
      europeanCupState: nextEuropeanCupState,
      europeanQualifierState: nextEuropeanQualifierState,
      calendar: nextCalendar,
      calendarIndex: 0,
      fanConfidence: selectedTeamId === leagueState.playerTeamId ? (leagueState.fanConfidence !== undefined ? leagueState.fanConfidence : 50) : 50,
      aperturaChampion: null,
      clausuraChampion: null,
      division: nextDivision,
      statScale: "1-10",
      budget: nextBudget,
      payrollBudget: nextPayrollBudget,
      worldState: carriedWorldState,
      newsFeed: initialNextNewsFeed,
      lastTransferWindow: ""
    };

    const nextClubPreferredFormation = isPlayerRenewing
      ? (getSavedFormation() || getPreferredTeamFormation(selectedTeamName, nextStartYearStr, nextDetails))
      : getPreferredTeamFormation(selectedTeamName, nextStartYearStr, nextDetails);
    localStorage.setItem("retro_player_formation", nextClubPreferredFormation);
    localStorage.setItem(`retro_formation_${selectedTeamName}_${nextSeasonStr}`, nextClubPreferredFormation);

    localStorage.setItem("retro_league_career", JSON.stringify(nextLeagueState));
    applyTeamTheme(selectedTeamObj);
    setLeagueState(nextLeagueState);
    setSubStandingsTab(null);
    setNextSeasonTeams([]);
    setSeasonRolloverMeta(null);
    setJobOffers([]);
    alert(`Signed a contract with ${selectedTeamName} (${finalCountry.toUpperCase()}) for the ${nextSeasonStr} season!`);
  };

  useEffect(() => {
    if (!leagueState) return;
    const { europeanCup } = leagueState;
    if (activeTab === "europe" && (europeanCup === "cl" || europeanCup === "uefa" || europeanCup === "uecl") && activeGroupsList.length > 0 && !activeGroupsList.includes(clActiveGroup)) {
      setClActiveGroup("A");
    }
  }, [activeTab, leagueState, clActiveGroup, activeGroupsList]);

  useEffect(() => {
    if (leagueState && leagueState.europeanCupState && leagueState.calendar && leagueState.calendarIndex < leagueState.calendar.length) {
      const cupState = leagueState.europeanCupState;
      const currentEvent = leagueState.calendar[leagueState.calendarIndex];
      const seasonShort = leagueState.season.split("/")[0];
      if ((seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001") &&
        currentEvent.type === "europe" &&
        currentEvent.matchday > 6 &&
        cupState.teams.length === 32) {
        if (advanceCLGroupStageToKnockouts) {
          const stateCopy = JSON.parse(JSON.stringify(leagueState));
          advanceCLGroupStageToKnockouts(stateCopy.europeanCupState);
          localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
          setLeagueState(stateCopy);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueState]);

  useEffect(() => {
    if (!leagueState) return;
    const { country, currentRound, teams, fixtures, aperturaChampion, clausuraChampion } = leagueState;
    if (country === "argentina" || country === "colombia" || country === "mexico") {
      const halfRounds = fixtures ? Math.floor(fixtures.length / 2) : (teams.length % 2 === 0 ? teams.length - 1 : teams.length);
      const totalRounds = getTotalLeagueRounds(teams, country, fixtures);

      // 1. Check if Apertura is complete and needs champion declaration
      if (currentRound > halfRounds && !aperturaChampion) {
        const calculatedApertura = calculateStandingsForRounds(teams, fixtures, 1, halfRounds);
        const winner = calculatedApertura[0];
        if (winner) {
          const stateCopy = { ...leagueState, aperturaChampion: winner.name };
          localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
          setLeagueState(stateCopy);

          setTimeout(() => {
            alert(`🏆 APERTURA CHAMPION DECLARED!\n\nCongratulations to ${winner.name} for winning the Apertura Championship!`);
          }, 500);
        }
      }

      // 2. Check if Clausura is complete and needs champion declaration
      const isSeasonOverCalculated = leagueState.calendar
        ? leagueState.calendarIndex >= leagueState.calendar.length
        : currentRound > totalRounds;

      if (isSeasonOverCalculated && !clausuraChampion) {
        const calculatedClausura = calculateStandingsForRounds(teams, fixtures, halfRounds + 1, totalRounds);
        const winner = calculatedClausura[0];
        if (winner) {
          const stateCopy = { ...leagueState, clausuraChampion: winner.name };
          localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
          setLeagueState(stateCopy);

          setTimeout(() => {
            alert(`🏆 CLAUSURA CHAMPION DECLARED!\n\nCongratulations to ${winner.name} for winning the Clausura Championship!`);
          }, 500);
        }
      }
    }
  }, [leagueState]);

  const handleExportSave = () => {
    try {
      // Find the player's team name
      const team = leagueState.teams.find(t => t.idnum === leagueState.playerTeamId);
      const teamName = team ? team.name : "";

      const rosterKey = teamName ? `retro_roster_${teamName}_${leagueState.season}` : null;
      const lineupKey = teamName ? `retro_lineup_${teamName}_${leagueState.season}` : null;

      let cachedRoster = rosterKey ? localStorage.getItem(rosterKey) : null;
      let cachedLineup = lineupKey ? localStorage.getItem(lineupKey) : null;

      // Fallback if current season squad is not generated yet (e.g. immediately after progressing season)
      if (!cachedRoster && teamName && leagueState.season) {
        const prevSeason = getPreviousSeasonString(leagueState.season);
        const prevRosterKey = prevSeason ? `retro_roster_${teamName}_${prevSeason}` : null;
        const prevLineupKey = prevSeason ? `retro_lineup_${teamName}_${prevSeason}` : null;
        if (prevRosterKey) {
          cachedRoster = localStorage.getItem(prevRosterKey);
        }
        if (prevLineupKey) {
          cachedLineup = localStorage.getItem(prevLineupKey);
        }
      }

      // Gather all rosters and lineups for this team
      const rosters = {};
      const lineups = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && teamName) {
          if (key.startsWith(`retro_roster_${teamName}_`)) {
            try {
              rosters[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              console.error(e);
            }
          } else if (key.startsWith(`retro_lineup_${teamName}_`)) {
            try {
              lineups[key] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      const exportPayload = {
        career: leagueState,
        managerProfile: managerProfile,
        formation: localStorage.getItem('retro_player_formation') || '4-4-2',
        rosterKey: rosterKey,
        rosterData: cachedRoster ? JSON.parse(cachedRoster) : null,
        lineupKey: lineupKey,
        lineupData: cachedLineup ? JSON.parse(cachedLineup) : null,
        rosters: rosters,
        lineups: lineups
      };

      const dataStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const safeSeason = season.replace("/", "-");
      const rNum = calendar ? calendarIndex : currentRound;
      downloadAnchor.setAttribute("download", `retro_league_${country}_${safeSeason}_stage_${rNum}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to export save file: " + e.message);
    }
  };

  const handleImportSave = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        let careerData = null;
        let profileData = null;

        if (importedData.career && importedData.managerProfile) {
          careerData = importedData.career;
          profileData = importedData.managerProfile;

          // Import all rosters if present
          if (importedData.rosters) {
            Object.entries(importedData.rosters).forEach(([key, val]) => {
              if (val) {
                localStorage.setItem(key, JSON.stringify(val));
              }
            });
          } else if (importedData.rosterKey && importedData.rosterData) {
            localStorage.setItem(importedData.rosterKey, JSON.stringify(importedData.rosterData));
          }

          // Import all lineups if present
          if (importedData.lineups) {
            Object.entries(importedData.lineups).forEach(([key, val]) => {
              if (val) {
                localStorage.setItem(key, JSON.stringify(val));
              }
            });
          } else if (importedData.lineupKey && importedData.lineupData) {
            localStorage.setItem(importedData.lineupKey, JSON.stringify(importedData.lineupData));
          }
        } else if (importedData.season && importedData.country && importedData.teams && importedData.fixtures) {
          careerData = importedData;
        } else {
          throw new Error("Invalid save file format. Missing core league parameters.");
        }

        if (importedData.formation) {
          localStorage.setItem('retro_player_formation', importedData.formation);
        }
        localStorage.setItem("retro_league_career", JSON.stringify(careerData));
        applyTeamTheme(careerData.teams?.find(t => t.idnum === careerData.playerTeamId));
        setLeagueState(careerData);

        if (profileData) {
          localStorage.setItem("retro_manager_profile", JSON.stringify(profileData));
          setManagerProfile(profileData);
          setEditName(profileData.name || careerData.managerName || "Sir Alex");
          setEditPhoto(profileData.photo || null);
          setEditNationality(profileData.nationality || careerData.managerNationality || "");
        } else {
          localStorage.removeItem("retro_manager_profile");
          const initialProfile = {
            name: careerData.managerName || "Sir Alex",
            nationality: careerData.managerNationality || "",
            photo: null,
            seasons: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            gf: 0,
            ga: 0,
            leagueTitles: 0,
            cupTitles: 0,
            history: []
          };
          setManagerProfile(initialProfile);
          setEditName(initialProfile.name);
          setEditPhoto(null);
          setEditNationality(initialProfile.nationality);
        }

        alert("Career save and manager profile successfully imported!");
      } catch (err) {
        alert("Error importing save file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (!leagueState) return <div className="Match team-select-container"><div className="empty-kit-slot">...</div></div>;

  const {
    season,
    country,
    region,
    playerTeamId,
    currentRound,
    teams,
    fixtures,
    managerName,
    boardExpectation,
    europeanCup,
    europeanCupState,
    calendar,
    calendarIndex,
    division
  } = leagueState;


  const finalManagerName = managerName || "Sir Alex";
  const finalExpectation = boardExpectation || { text: "Avoid Relegation", rank: 17, desc: "Avoid Relegation" };

  // Find player's team object
  const playerTeamObj = teams.find(t => t.idnum === playerTeamId);

  // Dynamic calculations for total rounds based on teams count
  const totalRounds = getTotalLeagueRounds(teams, country, leagueState.fixtures);
  const seasonShort = season.split("/")[0];

  const isSouthAmerica = region === "south_america" || country === "argentina" || country === "brazil" || country === "colombia";
  const isNorthAmerica = region === "north_america" || NA_COUNTRIES.has(country);

  const getRules = (cup, yr) => {
    if (isNorthAmerica) {
      if (cup === "cl") return concacafRules[yr] || concacafRules["2010"];
      return null;
    } else if (isSouthAmerica) {
      if (cup === "cl") return clibRules[yr] || clibRules["2010"];
      if (cup === "uefa") return csudRules[yr] || csudRules["2010"];
      return null;
    } else {
      if (cup === "cl") return clRules[yr] || clRules["1993"];
      if (cup === "uefa") return uefaRules[yr] || uefaRules["1993"];
      if (cup === "uecl") return ueclRules[yr] || ueclRules["2021"];
      return null;
    }
  };

  const rules = europeanCup ? getRules(europeanCup, seasonShort) : null;
  const isLeagueStageCup = rules && rules.format === "league_then_knockout";

  // Interleaved calendar resolution
  const currentEvent = calendar && calendarIndex < calendar.length ? calendar[calendarIndex] : { type: "league", index: currentRound };
  const isSeasonOver = (calendar ? calendarIndex >= calendar.length : currentRound > totalRounds) || leagueState.isSacked;

  let isEuropeanMatchNext = false;
  let isEuropeanGroupStageNext = false;
  let clPlayerFixture = null;
  let europeanOpponent = null;
  let europeanIsHome = true;
  let isRestWeek = false;

  if (!isSeasonOver && currentEvent.type === "europe") {
    isEuropeanMatchNext = true;
    const cupState = europeanCupState;
    const pId = cupState?.europeanPlayerTeamId;
    const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());

    const hasGroupStage = rules && (
      (rules.format === "group_then_knockout" && currentEvent.stage === "group_stage") ||
      (rules.format === "league_then_knockout" && currentEvent.stage === "league_stage")
    );
    isEuropeanGroupStageNext = !!hasGroupStage;

    if (!cupState || !pId) {
      isRestWeek = true;
    } else if (hasGroupStage) {
      clPlayerFixture = cupState.fixtures[currentEvent.matchday - 1]?.find(f => !f.played && (f.homeId === pId || f.awayId === pId));
      if (clPlayerFixture) {
        europeanIsHome = clPlayerFixture.homeId === pId;
        const oppId = europeanIsHome ? clPlayerFixture.awayId : clPlayerFixture.homeId;
        europeanOpponent = cupState.teams.find(t => t.idnum === oppId);
        if (!europeanOpponent) isRestWeek = true;
      } else {
        isRestWeek = true;
      }
    } else {
      // Knockout stage
      const stage = currentEvent.stage;
      const matchday = currentEvent.matchday;
      const kStateKey = toCamelCase(stage) + (stage !== "final" ? "Leg" + matchday : "");
      const bracket = cupState.knockoutState?.[kStateKey];
      if (bracket) {
        const match = bracket.find(f => f.homeId === pId || f.awayId === pId);
        if (match && !match.played) {
          clPlayerFixture = match;
          europeanIsHome = match.homeId === pId;
          const oppId = europeanIsHome ? match.awayId : match.homeId;
          europeanOpponent = cupState.teams.find(t => t.idnum === oppId);
          if (!europeanOpponent) isRestWeek = true;
        } else {
          isRestWeek = true;
        }
      } else {
        isRestWeek = true;
      }
    }
  }

  const isAperturaClausuraLeague = country === "argentina" || country === "colombia" || country === "mexico";
  const halfRounds = leagueState.fixtures ? Math.floor(leagueState.fixtures.length / 2) : (teams ? (teams.length % 2 === 0 ? teams.length - 1 : teams.length) : 19);
  const activeSubStandings = subStandingsTab || (currentRound <= halfRounds ? "apertura" : "clausura");

  // Dynamic qualification spots resolution
  const startYrStr = season ? season.split("/")[0] : "";
  let clSpotsCount = 0;
  let uefaSpotsCount = 0;
  let ueclSpotsCount = 0;

  if (isNorthAmerica) {
    const activeQualsNA = qualifiersBySeasonNA[startYrStr];
    clSpotsCount = (activeQualsNA && activeQualsNA.cl && activeQualsNA.cl[country]) ? activeQualsNA.cl[country].length : 2;
    uefaSpotsCount = 0;
  } else if (isSouthAmerica) {
    const activeQualsSA = qualifiersBySeasonSA[startYrStr];
    clSpotsCount = (activeQualsSA && activeQualsSA.cl && activeQualsSA.cl[country]) ? activeQualsSA.cl[country].length : 3;
    uefaSpotsCount = (activeQualsSA && activeQualsSA.uefa && activeQualsSA.uefa[country]) ? activeQualsSA.uefa[country].length : 3;
  } else {
    const activeQuals = qualifiersBySeason[startYrStr];
    clSpotsCount = (activeQuals && activeQuals.cl && activeQuals.cl[country]) ? activeQuals.cl[country].length : 1;
    uefaSpotsCount = (activeQuals && activeQuals.uefa && activeQuals.uefa[country]) ? activeQuals.uefa[country].length : 3;
    ueclSpotsCount = (activeQuals && activeQuals.uecl && activeQuals.uecl[country]) ? activeQuals.uecl[country].length : 0;
  }

  const playerPosition = standings.findIndex(t => t.idnum === playerTeamId) + 1;
  const confidence = getBoardConfidence(leagueState, standings, playerPosition, isSouthAmerica);
  const fanConfidence = leagueState.fanConfidence !== undefined ? leagueState.fanConfidence : 50;

  const cupExpectationObj = (() => {
    if (!europeanCup || !europeanCupState) return null;
    const rules = getRulesGlobal(europeanCup, seasonShort, isSouthAmerica, isNorthAmerica);
    const pId = europeanCupState.europeanPlayerTeamId;
    const cupTeam = europeanCupState.teams.find(t => t.idnum === pId);
    if (!cupTeam || !rules) return null;
    return getCupExpectation(cupTeam, europeanCup, rules, europeanCupState.teams);
  })();

  // Get Player's Match for the round (Domestic / Domestic Cup)
  let playerFixture = null;
  let opponentTeamObj = null;
  let isHome = true;
  const isDomesticCupNext = !isSeasonOver && currentEvent && (currentEvent.type === "domestic_cup" || currentEvent.isDomesticCup);
  const isEuropeanQualifierNext = !isSeasonOver && currentEvent && currentEvent.type === "europe_qualifier" && Boolean(leagueState?.europeanQualifierState);

  if (!isSeasonOver) {
    if (isEuropeanQualifierNext) {
      const qualState = leagueState.europeanQualifierState;
      const isLeg1 = currentEvent.leg === 1;
      isHome = isLeg1;
      opponentTeamObj = qualState.opponent;
      playerFixture = isLeg1
        ? { homeId: qualState.leg1HomeId, awayId: qualState.leg1AwayId, played: false, homeScore: 0, awayScore: 0 }
        : { homeId: qualState.leg2HomeId, awayId: qualState.leg2AwayId, played: false, homeScore: 0, awayScore: 0 };
    } else if (currentEvent.type === "league") {
      const roundFixtures = fixtures[currentEvent.index - 1];
      if (roundFixtures) {
        playerFixture = roundFixtures.find(f => f.homeId === playerTeamId || f.awayId === playerTeamId);
        if (playerFixture) {
          isHome = playerFixture.homeId === playerTeamId;
          const opponentId = isHome ? playerFixture.awayId : playerFixture.homeId;
          opponentTeamObj = teams.find(t => t.idnum === opponentId);
        }
      }
    } else if (isDomesticCupNext && leagueState?.domesticCupState) {
      const domCup = leagueState.domesticCupState;
      const stage = currentEvent.stage;
      const stageMatches = domCup.knockoutState ? (domCup.knockoutState[stage] || []) : [];
      playerFixture = stageMatches.find(m => !m.played && (m.homeId === playerTeamId || m.awayId === playerTeamId));
      if (playerFixture) {
        isHome = playerFixture.homeId === playerTeamId;
        const opponentId = isHome ? playerFixture.awayId : playerFixture.homeId;
        opponentTeamObj = (domCup.participatingTeams && domCup.participatingTeams.find(t => t.idnum === opponentId)) || teams.find(t => t.idnum === opponentId);
      }
    }
  }

  const isDomesticCupEliminated = Boolean(
    isDomesticCupNext &&
    !opponentTeamObj &&
    leagueState?.domesticCupState?.knockoutState &&
    Object.values(leagueState.domesticCupState.knockoutState).some(stageArr =>
      Array.isArray(stageArr) && stageArr.some(m => {
        if (!m.played || (m.homeId !== playerTeamId && m.awayId !== playerTeamId)) return false;
        if (m.winnerId !== undefined && m.winnerId !== null) return m.winnerId !== playerTeamId;
        const isH = m.homeId === playerTeamId;
        const pScore = (isH ? m.homeScore : m.awayScore) + ((isH ? m.penaltyHomeScore : m.penaltyAwayScore) || 0);
        const oScore = (isH ? m.awayScore : m.homeScore) + ((isH ? m.penaltyAwayScore : m.penaltyHomeScore) || 0);
        return pScore < oScore;
      })
    )
  );  // UEFA CL standings dynamically calculated
  const getCLGroupStandings = (groupLetter) => {
    const seasonShort = season.split("/")[0];
    const rules = getRules(europeanCup, seasonShort);
    const isSwiss = rules && rules.format === "league_then_knockout";

    const isDoubleStage = season === "1999/00" || season === "2000/01" || season === "2001/02";
    const isSecondStage = isDoubleStage && europeanCupState.teams.length === 16;

    const gTeams = isSwiss ? europeanCupState.teams : europeanCupState.teams.filter(t => t.group === groupLetter);
    return gTeams.map(t => {
      let played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0;
      europeanCupState.fixtures.forEach((matchdayFixtures, idx) => {
        // In 2nd group stage of season 2000/01, only consider 2nd stage fixtures (idx >= 6)
        // In 1st group stage, only consider 1st stage fixtures (idx < 6)
        if (isDoubleStage) {
          if (isSecondStage && idx < 6) return;
          if (!isSecondStage && idx >= 6) return;
        }

        matchdayFixtures.forEach(f => {
          if (f.played && (isSwiss || f.group === groupLetter) && (f.homeId === t.idnum || f.awayId === t.idnum)) {
            played += 1;
            const isHome = f.homeId === t.idnum;
            const myScore = isHome ? f.homeScore : f.awayScore;
            const oppScore = isHome ? f.awayScore : f.homeScore;
            gf += myScore;
            ga += oppScore;
            if (myScore > oppScore) { won += 1; points += 3; }
            else if (myScore < oppScore) { lost += 1; }
            else { drawn += 1; points += 1; }
          }
        });
      });
      return { ...t, played, won, drawn, lost, gf, ga, points };
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
  };
  const getBoardVerdict = (position, expectation, customState = null) => {
    const activeState = customState || leagueState;
    if (activeState?.isUnemployed) {
      return {
        status: "FREE AGENT",
        tier: "decent_sacked",
        title: "OFF-SEASON FREE AGENT",
        color: "#00e5ff",
        verdict: `The ${activeState.season || ''} season has concluded while you are unattached. Sign a contract with one of the interested clubs below for next season!`
      };
    }
    if (activeState?.isSacked) {
      if (activeState.fanConfidence !== undefined && activeState.fanConfidence <= 0) {
        return {
          status: "FIRED (FAN MUTINY)",
          tier: "decent_sacked",
          title: "CONTRACT TERMINATION - FAN REVOLT! 🤬",
          color: "#ff3333",
          verdict: `Due to abysmal performances and a total collapse in supporter relations, the board of ${playerTeamObj?.name || 'the club'} has terminated your contract immediately mid-season because the fans have completely revolted!`
        };
      }
      const isRelegated = position > (teams.length - 3);
      if (isRelegated) {
        return {
          status: "FIRED (DISGRACED)",
          tier: "disgraced",
          title: "MID-SEASON TERMINATION - DISGRACED!",
          color: "#ff3333",
          verdict: `Board confidence has reached 0% while in the relegation zone! The board of ${playerTeamObj?.name || 'the club'} has dismissed you in disgrace. No professional club wants to hire you.`
        };
      }
      return {
        status: "FIRED (MID-SEASON)",
        tier: "decent_sacked",
        title: "MID-SEASON TERMINATION!",
        color: "#ff3333",
        verdict: `Due to disastrous results and board confidence plummeting to 0%, the board of ${playerTeamObj?.name || 'the club'} has terminated your contract immediately mid-season! You must find a new job.`
      };
    }

    const confidence = getBoardConfidence(activeState, standings, position, isSouthAmerica);
    const fanConfidence = activeState.fanConfidence !== undefined ? activeState.fanConfidence : 50;
    const combinedConfidence = Math.round((confidence + fanConfidence) / 2);

    if (activeState?.warningSacked) {
      return {
        status: "FIRED (WARNING ROLL)",
        tier: "decent_sacked",
        title: "BOARD & FAN DECISION: SACKED!",
        color: "#ff3333",
        verdict: `Manager ${finalManagerName}, because you finished in Pos ${position} with a warning board confidence of ${confidence}% and fan confidence of ${fanConfidence}%, the board and supporters voted on your future. By a ${Math.round(100 - combinedConfidence)}% margin, they decided to terminate your contract immediately! You must find a new job.`
      };
    }

    if (confidence < 40) {
      const isRelegated = position > (teams.length - 3);
      return {
        status: "FIRED (DISGRACED)",
        tier: "disgraced",
        title: "TERMINATED - DISGRACED!",
        color: "#ff3333",
        verdict: isRelegated
          ? `Disastrous season, Manager ${finalManagerName}! You finished in Pos ${position} and relegated ${playerTeamObj?.name || 'the club'}. With board confidence at a low ${confidence}%, your contract is terminated immediately.`
          : `Disastrous season, Manager ${finalManagerName}! You finished in Pos ${position}, falling far short of our targets. With board confidence at a low ${confidence}%, your contract is terminated immediately.`
      };
    } else if (confidence >= 40 && confidence < 55) {
      return {
        status: "FIRED",
        tier: "decent_sacked",
        title: "TERMINATED IMMEDIATELY!",
        color: "#ff3333",
        verdict: `We regret to inform you, Manager ${finalManagerName}, that you have been sacked. Finishing in Pos ${position} with confidence at ${confidence}% falls short of our expectations. However, other lower-tier clubs might still be interested in your services.`
      };
    } else if (confidence >= 55 && confidence < 70) {
      return {
        status: "WARNING / ANOTHER CHANCE",
        tier: "warning",
        title: "BOARD WARNING - FINAL CHANCE",
        color: "#ffa500",
        verdict: `Manager ${finalManagerName}, you finished in Pos ${position} with board confidence at ${confidence}%. The board is disappointed, but because of the narrow margin, we are giving you one last chance next season. You must improve!`
      };
    } else {
      return {
        status: "RETAINED & HERO",
        tier: "outstanding",
        title: "CONTRACT RENEWED!",
        color: "#00ff64",
        verdict: `Outstanding work, Manager ${finalManagerName}! You guided ${playerTeamObj?.name || 'the club'} to Pos ${position} with a strong board confidence of ${confidence}%. The board and fans are absolutely thrilled. Your contract has been extended!`
      };
    }
  };

  advanceCLGroupStageToKnockouts = (cupState) => {
    const seasonShort = season.split("/")[0];
    const rules = getRules(europeanCup, seasonShort);

    if (rules && rules.format === "league_then_knockout") {
      const sortedTeams = cupState.teams.map(t => {
        let gf = 0, ga = 0, points = 0;
        cupState.fixtures.forEach(matchdayFixtures => {
          matchdayFixtures.forEach(f => {
            if (f.played && (f.homeId === t.idnum || f.awayId === t.idnum)) {
              const isHome = f.homeId === t.idnum;
              const myScore = isHome ? f.homeScore : f.awayScore;
              const oppScore = isHome ? f.awayScore : f.homeScore;
              gf += myScore; ga += oppScore;
              if (myScore > oppScore) { points += 3; }
              else if (myScore < oppScore) { /* lost */ }
              else { points += 1; }
            }
          });
        });
        return { ...t, points, gd: gf - ga, gf };
      }).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });

      const top8Ids = sortedTeams.slice(0, 8).map(t => t.idnum);
      const playoffTeams = sortedTeams.slice(8, 24);

      const playoffsLeg1 = [];
      for (let i = 0; i < 8; i++) {
        playoffsLeg1.push({
          homeId: playoffTeams[15 - i].idnum,
          awayId: playoffTeams[i].idnum,
          played: false,
          homeScore: 0,
          awayScore: 0
        });
      }
      const playoffsLeg2 = playoffsLeg1.map(m => ({
        homeId: m.awayId,
        awayId: m.homeId,
        played: false,
        homeScore: 0,
        awayScore: 0
      }));

      cupState.knockoutState = {
        playoffsLeg1,
        playoffsLeg2,
        top8Ids,
        roundOf16Leg1: null,
        roundOf16Leg2: null,
        quarterFinalsLeg1: null,
        quarterFinalsLeg2: null,
        semiFinalsLeg1: null,
        semiFinalsLeg2: null,
        final: null
      };
      return;
    }

    const uniqueGroupList = [...new Set((cupState.teams || []).map(t => t.group))].filter(g => g && g !== "bye" && g !== "champion").sort();
    if (uniqueGroupList.length === 4 && cupState.fixtures.length <= 6 && seasonShort !== "1993") {
      // 4 groups of 4 -> Quarter-Finals (e.g. CONCACAF 2008-2017, UCL 1994-1996)
      const winners = {};
      const runnersUp = {};
      uniqueGroupList.forEach(g => {
        const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
          let gf = 0, ga = 0, points = 0;
          cupState.fixtures.forEach(matchdayFixtures => {
            matchdayFixtures.forEach(f => {
              if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                const isHome = f.homeId === t.idnum;
                const myScore = isHome ? f.homeScore : f.awayScore;
                const oppScore = isHome ? f.awayScore : f.homeScore;
                gf += myScore; ga += oppScore;
                if (myScore > oppScore) { points += 3; }
                else if (myScore === oppScore) { points += 1; }
              }
            });
          });
          return { ...t, points, gd: gf - ga, gf };
        }).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gd !== a.gd) return b.gd - a.gd;
          return b.gf - a.gf;
        });
        winners[g] = gTeams[0];
        runnersUp[g] = gTeams[1];
      });
      const qfLeg1 = [
        { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 }
      ];
      const qfLeg2 = qfLeg1.map(m => ({ homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0 }));
      cupState.knockoutState = {
        roundOf32Leg1: null, roundOf32Leg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: qfLeg1,
        quarterFinalsLeg2: qfLeg2,
        semiFinalsLeg1: null,
        semiFinalsLeg2: null,
        final: null
      };
      return;
    }

    if (seasonShort === "2009" || seasonShort === "2010" || seasonShort === "2011" || seasonShort === "2012" || seasonShort === "2013" || seasonShort === "2014" || seasonShort === "2015" || seasonShort === "2016" || seasonShort === "2017" || seasonShort === "2018" || seasonShort === "2019" || seasonShort === "2020" || seasonShort === "2021" || seasonShort === "2022" || seasonShort === "2023") {
      if (europeanCup === "cl" || (leagueState.region === "south_america" && europeanCup === "uefa" && (seasonShort === "2020" || seasonShort === "2021")) || seasonShort === "2021" || seasonShort === "2022" || seasonShort === "2023") {
        // Champions League 2009: 8 groups, top 2 advance to Round of 16
        const groups = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const winners = {};
        const runnersUp = {};

        groups.forEach(g => {
          const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
            let gf = 0, ga = 0, points = 0;
            cupState.fixtures.forEach(matchdayFixtures => {
              matchdayFixtures.forEach(f => {
                if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                  const isHome = f.homeId === t.idnum;
                  const myScore = isHome ? f.homeScore : f.awayScore;
                  const oppScore = isHome ? f.awayScore : f.homeScore;
                  gf += myScore; ga += oppScore;
                  if (myScore > oppScore) { points += 3; }
                  else if (myScore < oppScore) { /* lost */ }
                  else { points += 1; }
                }
              });
            });
            return { ...t, points, gd: gf - ga, gf };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          });

          winners[g] = gTeams[0];
          runnersUp[g] = gTeams[1];
        });

        const r16Leg1 = [
          { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["E"].idnum, awayId: runnersUp["F"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["F"].idnum, awayId: runnersUp["E"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["G"].idnum, awayId: runnersUp["H"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["H"].idnum, awayId: runnersUp["G"].idnum, played: false, homeScore: 0, awayScore: 0 }
        ];
        const r16Leg2 = r16Leg1.map(m => ({
          homeId: m.awayId,
          awayId: m.homeId,
          played: false,
          homeScore: 0,
          awayScore: 0
        }));

        cupState.knockoutState = {
          roundOf32Leg1: null, roundOf32Leg2: null,
          roundOf16Leg1: r16Leg1,
          roundOf16Leg2: r16Leg2,
          quarterFinalsLeg1: null,
          quarterFinalsLeg2: null,
          semiFinalsLeg1: null,
          semiFinalsLeg2: null,
          final: null
        };
      } else {
        // Europa League 2009: 12 groups, top 2 advance + 8 best 3rd placed to form Round of 32
        const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
        const winners = {};
        const runnersUp = {};
        const thirds = [];

        groups.forEach(g => {
          const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
            let gf = 0, ga = 0, points = 0;
            cupState.fixtures.forEach(matchdayFixtures => {
              matchdayFixtures.forEach(f => {
                if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                  const isHome = f.homeId === t.idnum;
                  const myScore = isHome ? f.homeScore : f.awayScore;
                  const oppScore = isHome ? f.awayScore : f.homeScore;
                  gf += myScore; ga += oppScore;
                  if (myScore > oppScore) { points += 3; }
                  else if (myScore < oppScore) { /* lost */ }
                  else { points += 1; }
                }
              });
            });
            return { ...t, points, gd: gf - ga, gf };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          });

          winners[g] = gTeams[0];
          runnersUp[g] = gTeams[1];
          thirds.push(gTeams[2]);
        });

        // Sort thirds to find best 8
        const bestThirds = [...thirds].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          const gdA = a.gf - a.ga;
          const gdB = b.gf - b.ga;
          if (gdB !== gdA) return gdB - gdA;
          return b.gf - a.gf;
        }).slice(0, 8);

        // Seeding / Pairing for Round of 32
        const r32Leg1 = [
          { homeId: winners["A"].idnum, awayId: bestThirds[0].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["B"].idnum, awayId: bestThirds[1].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["C"].idnum, awayId: bestThirds[2].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["D"].idnum, awayId: bestThirds[3].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["E"].idnum, awayId: bestThirds[4].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["F"].idnum, awayId: bestThirds[5].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["G"].idnum, awayId: bestThirds[6].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["H"].idnum, awayId: bestThirds[7].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["I"].idnum, awayId: runnersUp["J"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["J"].idnum, awayId: runnersUp["I"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["K"].idnum, awayId: runnersUp["L"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["L"].idnum, awayId: runnersUp["K"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: runnersUp["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: runnersUp["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: runnersUp["E"].idnum, awayId: runnersUp["F"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: runnersUp["G"].idnum, awayId: runnersUp["H"].idnum, played: false, homeScore: 0, awayScore: 0 }
        ];

        const r32Leg2 = r32Leg1.map(m => ({
          homeId: m.awayId,
          awayId: m.homeId,
          played: false,
          homeScore: 0,
          awayScore: 0
        }));

        cupState.knockoutState = {
          roundOf32Leg1: r32Leg1,
          roundOf32Leg2: r32Leg2,
          roundOf16Leg1: null,
          roundOf16Leg2: null,
          quarterFinalsLeg1: null,
          quarterFinalsLeg2: null,
          semiFinalsLeg1: null,
          semiFinalsLeg2: null,
          final: null
        };
      }
      return;
    }

    if (seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001") {
      if (cupState.teams.length === 32) {
        const groups = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const winners = {};
        const runnersUp = {};

        groups.forEach(g => {
          const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
            let gf = 0, ga = 0, points = 0;
            cupState.fixtures.forEach(matchdayFixtures => {
              matchdayFixtures.forEach(f => {
                if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                  const isHome = f.homeId === t.idnum;
                  const myScore = isHome ? f.homeScore : f.awayScore;
                  const oppScore = isHome ? f.awayScore : f.homeScore;
                  gf += myScore; ga += oppScore;
                  if (myScore > oppScore) { points += 3; }
                  else if (myScore < oppScore) { /* lost */ }
                  else { points += 1; }
                }
              });
            });
            return { ...t, points, gd: gf - ga, gf };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          });

          winners[g] = JSON.parse(JSON.stringify(gTeams[0]));
          runnersUp[g] = JSON.parse(JSON.stringify(gTeams[1]));
        });

        // Re-group 16 teams into Groups A, B, C, D
        const groupA = [winners["A"], runnersUp["B"], winners["E"], runnersUp["F"]];
        const groupB = [winners["B"], runnersUp["A"], winners["F"], runnersUp["E"]];
        const groupC = [winners["C"], runnersUp["D"], winners["G"], runnersUp["H"]];
        const groupD = [winners["D"], runnersUp["C"], winners["H"], runnersUp["G"]];

        groupA.forEach(t => t.group = "A");
        groupB.forEach(t => t.group = "B");
        groupC.forEach(t => t.group = "C");
        groupD.forEach(t => t.group = "D");

        const advancingTeams = [...groupA, ...groupB, ...groupC, ...groupD];

        // Generate 6 new matchdays of fixtures for the 2nd Group Stage
        const extraFixtures = [];
        for (let m = 0; m < 6; m++) extraFixtures.push([]);

        ["A", "B", "C", "D"].forEach(g => {
          const gTeams = advancingTeams.filter(t => t.group === g);
          const t0 = gTeams[0].idnum;
          const t1 = gTeams[1].idnum;
          const t2 = gTeams[2].idnum;
          const t3 = gTeams[3].idnum;

          // Matchday 7 (extraFixtures[0])
          extraFixtures[0].push({ homeId: t0, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
          extraFixtures[0].push({ homeId: t2, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
          // Matchday 8 (extraFixtures[1])
          extraFixtures[1].push({ homeId: t0, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
          extraFixtures[1].push({ homeId: t1, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
          // Matchday 9 (extraFixtures[2])
          extraFixtures[2].push({ homeId: t0, awayId: t3, played: false, homeScore: 0, awayScore: 0, group: g });
          extraFixtures[2].push({ homeId: t1, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
          // Matchday 10 (extraFixtures[3])
          extraFixtures[3].push({ homeId: t1, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
          extraFixtures[3].push({ homeId: t3, awayId: t2, played: false, homeScore: 0, awayScore: 0, group: g });
          // Matchday 11 (extraFixtures[4])
          extraFixtures[4].push({ homeId: t2, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
          extraFixtures[4].push({ homeId: t3, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
          // Matchday 12 (extraFixtures[5])
          extraFixtures[5].push({ homeId: t3, awayId: t0, played: false, homeScore: 0, awayScore: 0, group: g });
          extraFixtures[5].push({ homeId: t2, awayId: t1, played: false, homeScore: 0, awayScore: 0, group: g });
        });

        cupState.teams = advancingTeams;
        cupState.fixtures.push(...extraFixtures);
        cupState.knockoutState = {
          roundOf32Leg1: null, roundOf32Leg2: null,
          roundOf16Leg1: null, roundOf16Leg2: null,
          quarterFinalsLeg1: null, quarterFinalsLeg2: null,
          semiFinalsLeg1: null, semiFinalsLeg2: null,
          final: null
        };
      } else {
        // End of 2nd Group Stage (16 teams -> 8 teams)
        const groups = ["A", "B", "C", "D"];
        const winners = {};
        const runnersUp = {};

        groups.forEach(g => {
          const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
            let gf = 0, ga = 0, points = 0;
            // Fixtures are in cupState.fixtures[6..11] for the 2nd stage
            cupState.fixtures.forEach((matchdayFixtures, idx) => {
              if (idx >= 6) {
                matchdayFixtures.forEach(f => {
                  if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                    const isHome = f.homeId === t.idnum;
                    const myScore = isHome ? f.homeScore : f.awayScore;
                    const oppScore = isHome ? f.awayScore : f.homeScore;
                    gf += myScore; ga += oppScore;
                    if (myScore > oppScore) { points += 3; }
                    else if (myScore < oppScore) { /* lost */ }
                    else { points += 1; }
                  }
                });
              }
            });
            return { ...t, points, gd: gf - ga, gf };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          });

          winners[g] = gTeams[0];
          runnersUp[g] = gTeams[1];
        });

        const qfLeg1 = [
          { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 }
        ];
        const qfLeg2 = qfLeg1.map(m => ({
          homeId: m.awayId,
          awayId: m.homeId,
          played: false,
          homeScore: 0,
          awayScore: 0
        }));

        cupState.knockoutState = {
          roundOf32Leg1: null, roundOf32Leg2: null,
          roundOf16Leg1: null, roundOf16Leg2: null,
          quarterFinalsLeg1: qfLeg1,
          quarterFinalsLeg2: qfLeg2,
          semiFinalsLeg1: null,
          semiFinalsLeg2: null,
          final: null
        };
      }
      return;
    }

    if (seasonShort === "1989" || seasonShort === "1990" || seasonShort === "1991" || seasonShort === "1992" || seasonShort === "1993" || seasonShort === "1994" || seasonShort === "1995" || seasonShort === "1996" || seasonShort === "1997" || seasonShort === "1998" || seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001" || seasonShort === "2002" || seasonShort === "2003" || seasonShort === "2004" || seasonShort === "2005" || seasonShort === "2006" || seasonShort === "2007" || seasonShort === "2008") {
      if (isSouthAmerica && (seasonShort === "1989" || seasonShort === "1990" || seasonShort === "1991" || seasonShort === "1992" || seasonShort === "1993" || seasonShort === "1994" || seasonShort === "1995" || seasonShort === "1996" || seasonShort === "1997" || seasonShort === "1998" || seasonShort === "1999")) {
        const groups = ["A", "B", "C", "D", "E"];
        const winnersList = [];
        const runnersUpList = [];
        const thirdsList = [];

        groups.forEach(g => {
          const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
            let gf = 0, ga = 0, points = 0;
            cupState.fixtures.forEach(matchdayFixtures => {
              matchdayFixtures.forEach(f => {
                if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                  const isHome = f.homeId === t.idnum;
                  const myScore = isHome ? f.homeScore : f.awayScore;
                  const oppScore = isHome ? f.awayScore : f.homeScore;
                  gf += myScore; ga += oppScore;
                  if (myScore > oppScore) { points += 3; }
                  else if (myScore < oppScore) { /* lost */ }
                  else { points += 1; }
                }
              });
            });
            return { ...t, points, gd: gf - ga, gf };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          });

          winnersList.push(gTeams[0]);
          runnersUpList.push(gTeams[1]);
          thirdsList.push(gTeams[2]);
        });

        const sortRank = (list) => [...list].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gd !== a.gd) return b.gd - a.gd;
          return b.gf - a.gf;
        });

        const sortedWinners = sortRank(winnersList);
        const sortedRunnersUp = sortRank(runnersUpList);
        const sortedThirds = sortRank(thirdsList);

        const defendingChamp = cupState.teams.find(t => t.group === "bye");

        const r16Leg1 = [
          { homeId: defendingChamp.idnum, awayId: sortedThirds[4].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedWinners[0].idnum, awayId: sortedThirds[3].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedWinners[1].idnum, awayId: sortedThirds[2].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedWinners[2].idnum, awayId: sortedThirds[1].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedWinners[3].idnum, awayId: sortedThirds[0].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedWinners[4].idnum, awayId: sortedRunnersUp[4].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedRunnersUp[0].idnum, awayId: sortedRunnersUp[3].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: sortedRunnersUp[1].idnum, awayId: sortedRunnersUp[2].idnum, played: false, homeScore: 0, awayScore: 0 }
        ];
        const r16Leg2 = r16Leg1.map(m => ({
          homeId: m.awayId,
          awayId: m.homeId,
          played: false,
          homeScore: 0,
          awayScore: 0
        }));

        cupState.knockoutState = {
          roundOf32Leg1: null, roundOf32Leg2: null,
          roundOf16Leg1: r16Leg1,
          roundOf16Leg2: r16Leg2,
          quarterFinalsLeg1: null,
          quarterFinalsLeg2: null,
          semiFinalsLeg1: null,
          semiFinalsLeg2: null,
          final: null
        };
      } else {
        const groups = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const winners = {};
        const runnersUp = {};

        groups.forEach(g => {
          const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
            let gf = 0, ga = 0, points = 0;
            cupState.fixtures.forEach(matchdayFixtures => {
              matchdayFixtures.forEach(f => {
                if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
                  const isHome = f.homeId === t.idnum;
                  const myScore = isHome ? f.homeScore : f.awayScore;
                  const oppScore = isHome ? f.awayScore : f.homeScore;
                  gf += myScore; ga += oppScore;
                  if (myScore > oppScore) { points += 3; }
                  else if (myScore < oppScore) { /* lost */ }
                  else { points += 1; }
                }
              });
            });
            return { ...t, points, gd: gf - ga, gf };
          }).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          });

          winners[g] = gTeams[0];
          runnersUp[g] = gTeams[1];
        });

        const r16Leg1 = [
          { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["E"].idnum, awayId: runnersUp["F"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["F"].idnum, awayId: runnersUp["E"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["G"].idnum, awayId: runnersUp["H"].idnum, played: false, homeScore: 0, awayScore: 0 },
          { homeId: winners["H"].idnum, awayId: runnersUp["G"].idnum, played: false, homeScore: 0, awayScore: 0 }
        ];
        const r16Leg2 = r16Leg1.map(m => ({
          homeId: m.awayId,
          awayId: m.homeId,
          played: false,
          homeScore: 0,
          awayScore: 0
        }));

        cupState.knockoutState = {
          roundOf32Leg1: null, roundOf32Leg2: null,
          roundOf16Leg1: r16Leg1,
          roundOf16Leg2: r16Leg2,
          quarterFinalsLeg1: null,
          quarterFinalsLeg2: null,
          semiFinalsLeg1: null,
          semiFinalsLeg2: null,
          final: null
        };
      }
      return;
    }

    const isTwoGroupSeason = seasonShort === "1992" || seasonShort === "1993";
    const isSixGroupSeason = seasonShort === "1997" || seasonShort === "1998";
    const groups = isTwoGroupSeason
      ? ["A", "B"]
      : (isSixGroupSeason ? ["A", "B", "C", "D", "E", "F"] : ["A", "B", "C", "D"]);
    const winners = {};
    const runnersUp = {};

    groups.forEach(g => {
      const gTeams = cupState.teams.filter(t => t.group === g).map(t => {
        let gf = 0, ga = 0, points = 0;
        cupState.fixtures.forEach(matchdayFixtures => {
          matchdayFixtures.forEach(f => {
            if (f.played && f.group === g && (f.homeId === t.idnum || f.awayId === t.idnum)) {
              const isHome = f.homeId === t.idnum;
              const myScore = isHome ? f.homeScore : f.awayScore;
              const oppScore = isHome ? f.awayScore : f.homeScore;
              gf += myScore; ga += oppScore;
              if (myScore > oppScore) { points += 3; }
              else if (myScore < oppScore) { /* lost */ }
              else { points += 1; }
            }
          });
        });
        return { ...t, points, gd: gf - ga, gf };
      }).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });

      winners[g] = gTeams[0];
      runnersUp[g] = gTeams[1];
    });

    if (seasonShort === "1991" || seasonShort === "1992") {
      // 1991/92 & 1992/93: Group winners go directly to the final (no semi-finals)
      cupState.knockoutState = {
        roundOf32Leg1: null, roundOf32Leg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: null, quarterFinalsLeg2: null,
        semiFinalsLeg1: null, semiFinalsLeg2: null,
        final: [
          { homeId: winners["A"].idnum, awayId: winners["B"].idnum, played: false, homeScore: 0, awayScore: 0 }
        ]
      };
    } else if (seasonShort === "1993") {
      // 1993/94: Top 2 from each group go to semi-finals (cross: A-winner vs B-runner-up, B-winner vs A-runner-up)
      const sfLeg1 = [
        { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 }
      ];
      const sfLeg2 = sfLeg1.map(m => ({
        homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0
      }));
      cupState.knockoutState = {
        roundOf32Leg1: null, roundOf32Leg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: null, quarterFinalsLeg2: null,
        semiFinalsLeg1: sfLeg1,
        semiFinalsLeg2: sfLeg2,
        final: null
      };
    } else if (isSixGroupSeason) {
      // 1998/99: 6 groups → 6 winners + 2 best runners-up → quarter-finals
      const runnersUpList = Object.values(runnersUp);
      runnersUpList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
      const bestRunners = [runnersUpList[0], runnersUpList[1]];
      const wA = winners["A"];
      const wB = winners["B"];
      const wC = winners["C"];
      const wD = winners["D"];
      const wE = winners["E"];
      const wF = winners["F"];

      const qfLeg1 = [
        { homeId: wA.idnum, awayId: bestRunners[1].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: wB.idnum, awayId: bestRunners[0].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: wC.idnum, awayId: wD.idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: wE.idnum, awayId: wF.idnum, played: false, homeScore: 0, awayScore: 0 }
      ];
      const qfLeg2 = qfLeg1.map(m => ({
        homeId: m.awayId,
        awayId: m.homeId,
        played: false,
        homeScore: 0,
        awayScore: 0
      }));

      cupState.knockoutState = {
        roundOf32Leg1: null, roundOf32Leg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: qfLeg1,
        quarterFinalsLeg2: qfLeg2,
        semiFinalsLeg1: null,
        semiFinalsLeg2: null,
        final: null
      };
    } else {
      // 1994+: 4 groups → quarter-finals
      const qfLeg1 = [
        { homeId: winners["A"].idnum, awayId: runnersUp["B"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["B"].idnum, awayId: runnersUp["A"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["C"].idnum, awayId: runnersUp["D"].idnum, played: false, homeScore: 0, awayScore: 0 },
        { homeId: winners["D"].idnum, awayId: runnersUp["C"].idnum, played: false, homeScore: 0, awayScore: 0 }
      ];
      const qfLeg2 = qfLeg1.map(m => ({
        homeId: m.awayId,
        awayId: m.homeId,
        played: false,
        homeScore: 0,
        awayScore: 0
      }));

      cupState.knockoutState = {
        roundOf32Leg1: null, roundOf32Leg2: null,
        roundOf16Leg1: null, roundOf16Leg2: null,
        quarterFinalsLeg1: qfLeg1,
        quarterFinalsLeg2: qfLeg2,
        semiFinalsLeg1: null,
        semiFinalsLeg2: null,
        final: null
      };
    }
  };


  const advanceKnockoutToNextRound = (cupState, stage) => {
    const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
    const leg1 = cupState.knockoutState[toCamelCase(stage) + "Leg1"];
    const leg2 = cupState.knockoutState[toCamelCase(stage) + "Leg2"];
    const winners = [];

    for (let i = 0; i < leg1.length; i++) {
      const m1 = leg1[i];
      const m2 = leg2.find(m => m.homeId === m1.awayId && m.awayId === m1.homeId);

      const homeAgg = m1.homeScore + (m2 ? m2.awayScore : 0);
      const awayAgg = m1.awayScore + (m2 ? m2.homeScore : 0);
      let winnerId = null;

      if (homeAgg > awayAgg) {
        winnerId = m1.homeId;
      } else if (awayAgg > homeAgg) {
        winnerId = m1.awayId;
      } else {
        // Tied on aggregate: check rules
        const seasonShortVal = (leagueState?.season || season || "").split("/")[0];
        const regionVal = leagueState?.region || "";
        const countryVal = leagueState?.country || "";
        const isSA = regionVal === "south_america" || countryVal === "argentina" || countryVal === "brazil" || countryVal === "colombia";
        const useAwayGoals = parseInt(seasonShortVal) < 2021 && !isSA;

        let goesToExtraTime = true;
        if (useAwayGoals) {
          const homeAwayGoals = m2 ? m2.awayScore : 0; // Team A played away in Leg 2
          const awayAwayGoals = m1.awayScore;          // Team B played away in Leg 1

          if (homeAwayGoals > awayAwayGoals) {
            winnerId = m1.homeId;
            goesToExtraTime = false;
          } else if (awayAwayGoals > homeAwayGoals) {
            winnerId = m1.awayId;
            goesToExtraTime = false;
          }
        }

        if (goesToExtraTime) {
          // Simulate extra time & penalties between team A (m1.homeId) and team B (m1.awayId)
          const teamA = cupState.teams.find(t => t.idnum === m1.homeId);
          const teamB = cupState.teams.find(t => t.idnum === m1.awayId);

          const attA = teamA ? (teamA.attack || 3) : 3;
          const midA = teamA ? (teamA.midfield || 3) : 3;
          const defA = teamA ? (teamA.defense || 3) : 3;

          const attB = teamB ? (teamB.attack || 3) : 3;
          const midB = teamB ? (teamB.midfield || 3) : 3;
          const defB = teamB ? (teamB.defense || 3) : 3;

          // 1. Simulate extra time goals
          const midDiff = midA - midB;
          const homeChancesExp = Math.max(0.3, Math.min(2.0, 1.2 + midDiff * 0.13));
          const randomShift = (Math.random() - 0.5) * 0.7;
          const homeChances = Math.round(homeChancesExp + randomShift);
          const awayChances = Math.max(0, 2 - homeChances);

          const homeConv = Math.max(0.1, Math.min(0.65, 0.3 + (attA - defB) * 0.05));
          const awayConv = Math.max(0.1, Math.min(0.65, 0.3 + (attB - defA) * 0.05));

          let extraA = 0;
          for (let c = 0; c < homeChances; c++) {
            if (Math.random() < homeConv) extraA++;
          }
          let extraB = 0;
          for (let c = 0; c < awayChances; c++) {
            if (Math.random() < awayConv) extraB++;
          }

          // Update the Leg 2 scores to reflect simulated extra time
          if (m2) {
            m2.awayScore += extraA; // team A was away in Leg 2
            m2.homeScore += extraB; // team B was home in Leg 2
          }

          const newHomeAgg = homeAgg + extraA;
          const newAwayAgg = awayAgg + extraB;

          if (newHomeAgg > newAwayAgg) {
            winnerId = m1.homeId;
          } else if (newAwayAgg > newHomeAgg) {
            winnerId = m1.awayId;
          } else {
            // Still tied after Extra Time: simulate penalties
            let penA = 0;
            let penB = 0;
            for (let r = 0; r < 5; r++) {
              if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attA - defB) * 0.03))) penA++;
              if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attB - defA) * 0.03))) penB++;
            }
            while (penA === penB) {
              if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attA - defB) * 0.03))) penA++;
              if (Math.random() < Math.max(0.5, Math.min(0.9, 0.75 + (attB - defA) * 0.03))) penB++;
            }

            // Save penalty scores in Leg 2
            if (m2) {
              m2.penaltyHomeScore = penB; // Leg 2 home is team B
              m2.penaltyAwayScore = penA; // Leg 2 away is team A
            }

            winnerId = penA > penB ? m1.homeId : m1.awayId;
          }
        }
      }
      winners.push(winnerId);
    }

    const seasonShort = season.split("/")[0];
    const rules = getRules(europeanCup, seasonShort);
    const currentIdx = rules.stages.indexOf(stage);
    const nextStage = rules.stages[currentIdx + 1];

    if (stage === "playoffs") {
      const top8Ids = cupState.knockoutState.top8Ids || [];
      const r16Leg1 = [];
      for (let i = 0; i < 8; i++) {
        r16Leg1.push({
          homeId: winners[i],
          awayId: top8Ids[i],
          played: false,
          homeScore: 0,
          awayScore: 0
        });
      }
      const r16Leg2 = r16Leg1.map(m => ({
        homeId: m.awayId,
        awayId: m.homeId,
        played: false,
        homeScore: 0,
        awayScore: 0
      }));

      cupState.knockoutState.roundOf16Leg1 = r16Leg1;
      cupState.knockoutState.roundOf16Leg2 = r16Leg2;
    } else if (nextStage === "final") {
      cupState.knockoutState.final = [
        { homeId: winners[0], awayId: winners[1], played: false, homeScore: 0, awayScore: 0 }
      ];
    } else if (nextStage) {
      const nextLeg1 = [];
      for (let i = 0; i < winners.length; i += 2) {
        nextLeg1.push({ homeId: winners[i], awayId: winners[i + 1], played: false, homeScore: 0, awayScore: 0 });
      }
      const nextLeg2 = nextLeg1.map(m => ({ homeId: m.awayId, awayId: m.homeId, played: false, homeScore: 0, awayScore: 0 }));

      cupState.knockoutState[toCamelCase(nextStage) + "Leg1"] = nextLeg1;
      cupState.knockoutState[toCamelCase(nextStage) + "Leg2"] = nextLeg2;
    }
  };

  const simulateCLUEFAKnockoutRound = (stateCopy, currentEvent) => {
    const cupState = stateCopy.europeanCupState;
    const stage = currentEvent.stage;
    const matchday = currentEvent.matchday;
    const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
    const kStateKey = toCamelCase(stage) + (stage !== "final" ? "Leg" + matchday : "");
    const bracket = cupState.knockoutState[kStateKey];

    if (bracket) {
      bracket.forEach(m => {
        if (!m.played) {
          const h = cupState.teams.find(t => t.idnum === m.homeId);
          const a = cupState.teams.find(t => t.idnum === m.awayId);
          const { homeGoals, awayGoals } = simulateFixture(h, a);
          m.homeScore = homeGoals;
          m.awayScore = awayGoals;
          m.played = true;

          // If single leg final ends in draw, simulate penalties
          if (stage === "final" && m.homeScore === m.awayScore) {
            if (Math.random() > 0.5) {
              m.penaltyHomeScore = 5;
              m.penaltyAwayScore = 4;
            } else {
              m.penaltyHomeScore = 4;
              m.penaltyAwayScore = 5;
            }
          }
        }
      });

      // Update Fan Confidence for simulated European knockout match
      const pId = cupState.europeanPlayerTeamId;
      const playerMatch = bracket.find(m => m.homeId === pId || m.awayId === pId);
      if (playerMatch) {
        const isPlayerHome = playerMatch.homeId === pId;
        const opponentId = isPlayerHome ? playerMatch.awayId : playerMatch.homeId;
        const playerTeam = cupState.teams.find(t => t.idnum === pId);
        const opponentTeam = cupState.teams.find(t => t.idnum === opponentId);
        const playerGoals = isPlayerHome ? playerMatch.homeScore : playerMatch.awayScore;
        const opponentGoals = isPlayerHome ? playerMatch.awayScore : playerMatch.homeScore;
        stateCopy.fanConfidence = updateFanConfidence(stateCopy.fanConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals);

        if (!stateCopy.isUnemployed) {
          const wonPens = playerMatch.homeScore === playerMatch.awayScore &&
            ((isPlayerHome && (playerMatch.penaltyHomeScore || 0) > (playerMatch.penaltyAwayScore || 0)) ||
              (!isPlayerHome && (playerMatch.penaltyAwayScore || 0) > (playerMatch.penaltyHomeScore || 0)));
          const domesticPlayerTeam = stateCopy.teams.find(t => t.idnum === stateCopy.playerTeamId) || playerTeam;
          const profUpdated = recordLiveUserMatchToProfile({
            matchKey: `${stateCopy.season}:euro:${stateCopy.europeanCup || 'euro'}:${stage}_leg${matchday || 1}:${playerMatch.homeId}-${playerMatch.awayId}`,
            playerGoals,
            opponentGoals,
            isHome: isPlayerHome,
            playerTeam: domesticPlayerTeam,
            opponentTeam,
            wonOnPenalties: wonPens,
            season: stateCopy.season,
            country: stateCopy.country,
            division: stateCopy.division || 1,
            competitionLabel: (stateCopy.europeanCup || 'Europe').toUpperCase(),
            fallbackManagerName: stateCopy.managerName
          });
          if (profUpdated) setManagerProfile(profUpdated);
        }
      }

      if (stage !== "final" && matchday === 2) {
        advanceKnockoutToNextRound(cupState, stage);
      }
    }
  };

  const simulateRestWeek = () => {
    let stateCopy = JSON.parse(JSON.stringify(leagueState));
    const currentEvent = stateCopy.calendar[stateCopy.calendarIndex];
    const cupState = stateCopy.europeanCupState;
    const seasonShort = stateCopy.season.split("/")[0];

    const isCL = stateCopy.europeanCup === "cl";
    const isUEFA = stateCopy.europeanCup === "uefa";
    const isUECL = stateCopy.europeanCup === "uecl";
    const rules = getRules(stateCopy.europeanCup, seasonShort);

    if (isCL || ((isUEFA || isUECL) && rules && (rules.format === "group_then_knockout" || rules.format === "league_then_knockout"))) {
      if (currentEvent.stage === "group_stage" || currentEvent.stage === "league_stage") {
        const mIndex = currentEvent.matchday - 1;
        const fixtures = cupState.fixtures[mIndex];
        fixtures.forEach(f => {
          if (!f.played) {
            const h = cupState.teams.find(t => t.idnum === f.homeId);
            const a = cupState.teams.find(t => t.idnum === f.awayId);
            const { homeGoals, awayGoals } = simulateFixture(h, a);
            f.homeScore = homeGoals;
            f.awayScore = awayGoals;
            f.played = true;
          }
        });

        // Update Fan Confidence for simulated European group/league match
        const pId = cupState.europeanPlayerTeamId;
        const playerFixture = fixtures.find(f => f.homeId === pId || f.awayId === pId);
        if (playerFixture) {
          const isPlayerHome = playerFixture.homeId === pId;
          const opponentId = isPlayerHome ? playerFixture.awayId : playerFixture.homeId;
          const playerTeam = cupState.teams.find(t => t.idnum === pId);
          const opponentTeam = cupState.teams.find(t => t.idnum === opponentId);
          const playerGoals = isPlayerHome ? playerFixture.homeScore : playerFixture.awayScore;
          const opponentGoals = isPlayerHome ? playerFixture.awayScore : playerFixture.homeScore;
          stateCopy.fanConfidence = updateFanConfidence(stateCopy.fanConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals);

          if (!stateCopy.isUnemployed) {
            const domesticPlayerTeam = stateCopy.teams.find(t => t.idnum === stateCopy.playerTeamId) || playerTeam;
            const profUpdated = recordLiveUserMatchToProfile({
              matchKey: `${stateCopy.season}:euro:${stateCopy.europeanCup || 'euro'}:${currentEvent.stage}_md${currentEvent.matchday}:${playerFixture.homeId}-${playerFixture.awayId}`,
              playerGoals,
              opponentGoals,
              isHome: isPlayerHome,
              playerTeam: domesticPlayerTeam,
              opponentTeam,
              season: stateCopy.season,
              country: stateCopy.country,
              division: stateCopy.division || 1,
              competitionLabel: (stateCopy.europeanCup || 'Europe').toUpperCase(),
              fallbackManagerName: stateCopy.managerName
            });
            if (profUpdated) setManagerProfile(profUpdated);
          }
        }

        const totalGroupMatchdays = rules.calendarSchedules.filter(s => s.stage === "group_stage" || s.stage === "league_stage").length;
        if (currentEvent.matchday === totalGroupMatchdays || ((seasonShort === "1999" || seasonShort === "2000" || seasonShort === "2001") && currentEvent.matchday === 6)) {
          advanceCLGroupStageToKnockouts(cupState);
        }
      } else {
        simulateCLUEFAKnockoutRound(stateCopy, currentEvent);
      }
    } else if (isUEFA || isUECL) {
      simulateCLUEFAKnockoutRound(stateCopy, currentEvent);
    }

    let simulatedFixtures = [];
    let modalTitle = "";
    if (cupState) {
      const stage = currentEvent.stage;
      const matchday = currentEvent.matchday;
      const rules = getRules(stateCopy.europeanCup, seasonShort);
      const hasGroupStage = rules && (
        (rules.format === "group_then_knockout" && stage === "group_stage") ||
        (rules.format === "league_then_knockout" && stage === "league_stage")
      );

      if (hasGroupStage) {
        simulatedFixtures = cupState.fixtures[matchday - 1] || [];
        modalTitle = `${stateCopy.europeanCup.toUpperCase()} MATCHDAY ${matchday}`;
      } else {
        const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
        const kStateKey = toCamelCase(stage) + (stage !== "final" ? "Leg" + matchday : "");
        simulatedFixtures = cupState.knockoutState[kStateKey] || [];
        modalTitle = `${stage.replace(/_/g, ' ').toUpperCase()}${stage !== "final" ? ` LEG ${matchday}` : ""}`;
      }
    }

    stateCopy.calendarIndex += 1;
    localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));

    // Now run player condition/injury updates & team stat recalculations for the European week
    const pId = stateCopy.playerTeamId;
    const playerTeam = stateCopy.teams.find(t => t.idnum === pId);
    const teamName = playerTeam ? playerTeam.name : "";
    if (teamName) {
      // Check if player's team played a match in Europe this week
      let playerPlayedThisWeek = false;
      if (cupState) {
        const euroPlayerId = cupState.europeanPlayerTeamId;
        if (currentEvent.stage === "group_stage" || currentEvent.stage === "league_stage") {
          const mIndex = currentEvent.matchday - 1;
          const fixtures = cupState.fixtures[mIndex] || [];
          playerPlayedThisWeek = fixtures.some(f => f.homeId === euroPlayerId || f.awayId === euroPlayerId);
        } else {
          const toCamelCase = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
          const kStateKey = toCamelCase(currentEvent.stage) + (currentEvent.stage !== "final" ? "Leg" + currentEvent.matchday : "");
          const bracket = cupState.knockoutState[kStateKey] || [];
          playerPlayedThisWeek = bracket.some(m => m.homeId === euroPlayerId || m.awayId === euroPlayerId);
        }
      }

      updatePlayerConditionsAndInjuries(teamName, stateCopy.season, false, playerPlayedThisWeek);
      const cachedLineup = localStorage.getItem(`retro_lineup_${teamName}_${stateCopy.season}`);
      if (cachedLineup) {
        try {
          const parsedLineup = JSON.parse(cachedLineup);
          updateTeamStatsInStorage(parsedLineup, getSavedFormation());
          // Re-load the leagueState from storage so that the newly updated team stats are included!
          const refreshedRaw = localStorage.getItem("retro_league_career");
          if (refreshedRaw) {
            stateCopy = JSON.parse(refreshedRaw);
          }
        } catch (e) {
          console.error("Error updating team stats after rest week simulation", e);
        }
      }
    }

    setLeagueState(stateCopy);

    if (simulatedFixtures && simulatedFixtures.length > 0) {
      setResultsModalFixtures(simulatedFixtures);
      setResultsModalTitle(modalTitle);
      setResultsModalTheme("#00e5ff");
      setResultsModalOpen(true);
    }
  };

  const handleSimulateLeagueRound = () => {
    let stateCopy = JSON.parse(JSON.stringify(leagueState));
    const currentEvent = stateCopy.calendar
      ? stateCopy.calendar[stateCopy.calendarIndex]
      : { type: "league", index: stateCopy.currentRound };

    if (currentEvent.type === "league") {
      const roundFixtures = stateCopy.fixtures[currentEvent.index - 1];

      roundFixtures.forEach(f => {
        if (!f.played) {
          const h = stateCopy.teams.find(t => t.idnum === f.homeId);
          const a = stateCopy.teams.find(t => t.idnum === f.awayId);

          const { homeGoals, awayGoals } = simulateFixture(h, a);
          f.homeScore = homeGoals;
          f.awayScore = awayGoals;
          f.played = true;
        }
      });

      // Update Fan Confidence for simulated domestic match
      const pId = stateCopy.playerTeamId;
      const playerFixture = roundFixtures.find(f => f.homeId === pId || f.awayId === pId);
      if (playerFixture) {
        const isPlayerHome = playerFixture.homeId === pId;
        const opponentId = isPlayerHome ? playerFixture.awayId : playerFixture.homeId;
        const playerTeam = stateCopy.teams.find(t => t.idnum === pId);
        const opponentTeam = stateCopy.teams.find(t => t.idnum === opponentId);
        const playerGoals = isPlayerHome ? playerFixture.homeScore : playerFixture.awayScore;
        const opponentGoals = isPlayerHome ? playerFixture.awayScore : playerFixture.homeScore;
        stateCopy.fanConfidence = updateFanConfidence(stateCopy.fanConfidence, playerTeam, opponentTeam, playerGoals, opponentGoals);
      }

      // Recalculate standings from round 1
      stateCopy.teams.forEach(t => {
        t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0; t.gf = 0; t.ga = 0; t.points = 0;
      });

      stateCopy.fixtures.forEach(rFixtures => {
        rFixtures.forEach(f => {
          if (f.played) {
            const h = stateCopy.teams.find(t => t.idnum === f.homeId);
            const a = stateCopy.teams.find(t => t.idnum === f.awayId);

            h.played += 1;
            a.played += 1;
            h.gf += f.homeScore;
            h.ga += f.awayScore;
            a.gf += f.awayScore;
            a.ga += f.homeScore;

            if (f.homeScore > f.awayScore) {
              h.won += 1; h.points += 3;
              a.lost += 1;
            } else if (f.awayScore > f.homeScore) {
              a.won += 1; a.points += 3;
              h.lost += 1;
            } else {
              h.drawn += 1; h.points += 1;
              a.drawn += 1; a.points += 1;
            }
          }
        });
      });

      if (stateCopy.calendar) {
        stateCopy.currentRound = currentEvent.index + 1;
        stateCopy.calendarIndex += 1;
      } else {
        stateCopy.currentRound += 1;
      }

      localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));

      // Now run player condition/injury updates & team stat recalculations
      const playerTeam = stateCopy.teams.find(t => t.idnum === pId);
      const teamName = playerTeam ? playerTeam.name : "";
      if (teamName) {
        updatePlayerConditionsAndInjuries(teamName, stateCopy.season, false, true);
        const cachedLineup = localStorage.getItem(`retro_lineup_${teamName}_${stateCopy.season}`);
        if (cachedLineup) {
          try {
            const parsedLineup = JSON.parse(cachedLineup);
            updateTeamStatsInStorage(parsedLineup, getSavedFormation());
            // Re-load the leagueState from storage so that the newly updated team stats are included!
            const refreshedRaw = localStorage.getItem("retro_league_career");
            if (refreshedRaw) {
              stateCopy = JSON.parse(refreshedRaw);
            }
          } catch (e) {
            console.error("Error updating team stats after league simulation", e);
          }
        }

        // Generate FM-style news items for this simulated round
        const isPlayerHome = playerFixture ? playerFixture.homeId === pId : true;
        const opponentId = playerFixture ? (isPlayerHome ? playerFixture.awayId : playerFixture.homeId) : null;
        const opponentTeam = stateCopy.teams.find(t => t.idnum === opponentId);

        const currentInjuries = JSON.parse(localStorage.getItem(`retro_player_injuries_${teamName}_${stateCopy.season}`) || "[]");
        const nextRoundFixtures = stateCopy.fixtures[currentEvent.index];
        const nextUserFixture = nextRoundFixtures?.find(f => f.homeId === pId || f.awayId === pId);
        const nextOpponentId = nextUserFixture ? (nextUserFixture.homeId === pId ? nextUserFixture.awayId : nextUserFixture.homeId) : null;
        const nextOpponentTeam = stateCopy.teams.find(t => t.idnum === nextOpponentId);

        const newMatchNews = generateMatchdayNews({
          round: currentEvent.index,
          userFixture: playerFixture,
          allFixtures: roundFixtures,
          standings: stateCopy.teams,
          teamName: teamName,
          opponentName: opponentTeam ? opponentTeam.name : "",
          nextOpponent: nextOpponentTeam,
          managerName: finalManagerName,
          injuries: currentInjuries,
          budget: stateCopy.budget,
          fanConfidence: stateCopy.fanConfidence || 50,
          boardConfidence: 60,
          season: stateCopy.season,
          fullFixturesList: stateCopy.fixtures,
          playerTeamId: pId
        });

        stateCopy.newsFeed = appendAndPruneNews(stateCopy.newsFeed, newMatchNews, currentEvent.index);
        stateCopy = processRoundStatsAndAwards(stateCopy, currentEvent.index);
        localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));

        if (playerFixture && !stateCopy.isUnemployed) {
          const pGoals = isPlayerHome ? playerFixture.homeScore : playerFixture.awayScore;
          const oGoals = isPlayerHome ? playerFixture.awayScore : playerFixture.homeScore;
          const profUpdated = recordLiveUserMatchToProfile({
            matchKey: `${stateCopy.season}:league:r${currentEvent.index}:${playerFixture.homeId}-${playerFixture.awayId}`,
            playerGoals: pGoals,
            opponentGoals: oGoals,
            isHome: isPlayerHome,
            playerTeam,
            opponentTeam,
            season: stateCopy.season,
            country: stateCopy.country,
            division: stateCopy.division || 1,
            competitionLabel: 'League',
            fallbackManagerName: finalManagerName
          });
          if (profUpdated) setManagerProfile(profUpdated);
        }
      }

      setLeagueState(stateCopy);

      setResultsModalFixtures(roundFixtures);
      setResultsModalTitle(`ROUND ${currentEvent.index} RESULTS`);
      setResultsModalTheme("#00ff64");
      setResultsModalOpen(true);
    }
  };

  const handleMarkNewsRead = (newsId) => {
    if (!leagueState || !leagueState.newsFeed) return;
    const updatedNewsFeed = leagueState.newsFeed.map(item =>
      item.id === newsId ? { ...item, isRead: true } : item
    );
    const updatedState = { ...leagueState, newsFeed: updatedNewsFeed };
    setLeagueState(updatedState);
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
  };

  const handleMarkAllNewsRead = () => {
    if (!leagueState || !leagueState.newsFeed) return;
    const updatedNewsFeed = leagueState.newsFeed.map(item => ({ ...item, isRead: true }));
    const updatedState = { ...leagueState, newsFeed: updatedNewsFeed };
    setLeagueState(updatedState);
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
  };

  const simulateDomesticCupRound = () => {
    let stateCopy = JSON.parse(JSON.stringify(leagueState));
    if (!stateCopy || !stateCopy.domesticCupState) return;
    const domCup = stateCopy.domesticCupState;
    if (domCup.isCompleted) {
      if (stateCopy.calendar) {
        stateCopy.calendarIndex += 1;
        localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
        setLeagueState(stateCopy);
      }
      return;
    }

    const stage = domCup.stage;
    const matches = domCup.knockoutState[stage] || [];

    matches.forEach(m => {
      if (!m.played) {
        const h = domCup.participatingTeams?.find(t => t.idnum === m.homeId) || stateCopy.teams.find(t => t.idnum === m.homeId) || { attack: 2, midfield: 2, defense: 2 };
        const a = domCup.participatingTeams?.find(t => t.idnum === m.awayId) || stateCopy.teams.find(t => t.idnum === m.awayId) || { attack: 2, midfield: 2, defense: 2 };

        const { homeGoals, awayGoals } = simulateFixture(h, a);
        m.homeScore = homeGoals;
        m.awayScore = awayGoals;
        m.played = true;

        if (m.homeScore === m.awayScore) {
          let pHome = 5, pAway = 4;
          if (Math.random() < 0.5) {
            pHome = 4; pAway = 5;
          }
          m.penaltyHomeScore = pHome;
          m.penaltyAwayScore = pAway;
        }
      }
    });

    const updatedCup = advanceDomesticCup(domCup);
    stateCopy.domesticCupState = updatedCup;

    const pId = stateCopy.playerTeamId;
    const userMatch = matches.find(m => m.homeId === pId || m.awayId === pId);
    if (userMatch) {
      const isHome = userMatch.homeId === pId;
      const userGoals = (isHome ? userMatch.homeScore : userMatch.awayScore) + ((isHome ? userMatch.penaltyHomeScore : userMatch.penaltyAwayScore) || 0);
      const oppGoals = (isHome ? userMatch.awayScore : userMatch.homeScore) + ((isHome ? userMatch.penaltyAwayScore : userMatch.penaltyHomeScore) || 0);
      const isWinner = userGoals > oppGoals;
      const playerTeam = stateCopy.teams.find(t => t.idnum === pId);

      const cupStory = generateDomesticCupMatchNews({
        cupName: updatedCup.cupName,
        stageName: userMatch.stageName || CUP_STAGE_NAMES[stage],
        userFixture: userMatch,
        teamName: playerTeam ? playerTeam.name : "Your Team",
        managerName: stateCopy.managerName || "Sir Alex",
        isWinner,
        nextStageName: CUP_STAGE_NAMES[updatedCup.stage],
        round: stateCopy.currentRound || 1
      });

      stateCopy.newsFeed = appendAndPruneNews(stateCopy.newsFeed, cupStory, stateCopy.currentRound || 1);

      if (!stateCopy.isUnemployed) {
        const pGoals90 = isHome ? userMatch.homeScore : userMatch.awayScore;
        const oGoals90 = isHome ? userMatch.awayScore : userMatch.homeScore;
        const oppId = isHome ? userMatch.awayId : userMatch.homeId;
        const oppTeamCup = domCup.participatingTeams?.find(t => t.idnum === oppId) || stateCopy.teams.find(t => t.idnum === oppId);
        const wonPens = (userMatch.homeScore === userMatch.awayScore) && isWinner;
        const profUpdated = recordLiveUserMatchToProfile({
          matchKey: `${stateCopy.season}:cup:${stage}:${userMatch.homeId}-${userMatch.awayId}`,
          playerGoals: pGoals90,
          opponentGoals: oGoals90,
          isHome,
          playerTeam,
          opponentTeam: oppTeamCup,
          wonOnPenalties: wonPens,
          season: stateCopy.season,
          country: stateCopy.country,
          division: stateCopy.division || 1,
          competitionLabel: updatedCup.cupName || 'Domestic Cup',
          fallbackManagerName: stateCopy.managerName
        });
        if (profUpdated) setManagerProfile(profUpdated);
      }
    }

    if (stateCopy.calendar) {
      stateCopy.calendarIndex += 1;
    }
    localStorage.setItem("retro_league_career", JSON.stringify(stateCopy));
    setLeagueState(stateCopy);

    setResultsModalFixtures(matches);
    setResultsModalTitle(`${updatedCup.cupName.toUpperCase()} - ${(CUP_STAGE_NAMES[stage] || stage).toUpperCase()}`);
    setResultsModalTheme("#ff0055");
    setResultsModalOpen(true);
  };

  const simulateEuropeanQualifierLeg = () => {
    const stateCopy = JSON.parse(JSON.stringify(leagueState));
    const qualState = stateCopy?.europeanQualifierState;
    const ev = stateCopy?.calendar?.[stateCopy.calendarIndex];
    if (!qualState || !ev) return;

    const pId = stateCopy.playerTeamId;
    const pTeam = stateCopy.teams.find(t => t.idnum === pId);
    const opp = qualState.opponent;
    if (!pTeam || !opp) return;

    const isLeg1 = ev.leg === 1;
    const homeTeam = isLeg1 ? pTeam : opp;
    const awayTeam = isLeg1 ? opp : pTeam;
    const { homeGoals, awayGoals } = simulateFixture(homeTeam, awayTeam);

    let legResultFixture = {
      homeId: homeTeam.idnum,
      awayId: awayTeam.idnum,
      homeScore: homeGoals,
      awayScore: awayGoals,
      played: true
    };
    let modalTitle = `${qualState.competitionLabel} 3RD QUALIFYING ROUND - LEG ${ev.leg}`;

    if (isLeg1) {
      qualState.leg1HomeScore = homeGoals;
      qualState.leg1AwayScore = awayGoals;
      qualState.leg1Played = true;
    } else {
      let l2H = homeGoals;
      let l2A = awayGoals;
      let penH = null;
      let penA = null;

      let tieRes = resolveTwoLegTie({
        playerTeamId: pId,
        leg1HomeId: qualState.leg1HomeId,
        leg1HomeScore: qualState.leg1HomeScore,
        leg1AwayScore: qualState.leg1AwayScore,
        leg2HomeId: qualState.leg2HomeId,
        leg2HomeScore: l2H,
        leg2AwayScore: l2A,
        seasonStr: stateCopy.season,
        isSA: false
      });

      if (tieRes.needsET) {
        if (Math.random() < 0.35) l2H += 1;
        if (Math.random() < 0.35) l2A += 1;
        tieRes = resolveTwoLegTie({
          playerTeamId: pId,
          leg1HomeId: qualState.leg1HomeId,
          leg1HomeScore: qualState.leg1HomeScore,
          leg1AwayScore: qualState.leg1AwayScore,
          leg2HomeId: qualState.leg2HomeId,
          leg2HomeScore: l2H,
          leg2AwayScore: l2A,
          seasonStr: stateCopy.season,
          isSA: false
        });
      }

      if (tieRes.needsET) {
        penH = Math.random() < 0.5 ? 5 : 4;
        penA = penH === 5 ? 4 : 5;
        tieRes = resolveTwoLegTie({
          playerTeamId: pId,
          leg1HomeId: qualState.leg1HomeId,
          leg1HomeScore: qualState.leg1HomeScore,
          leg1AwayScore: qualState.leg1AwayScore,
          leg2HomeId: qualState.leg2HomeId,
          leg2HomeScore: l2H,
          leg2AwayScore: l2A,
          leg2PenHome: penH,
          leg2PenAway: penA,
          seasonStr: stateCopy.season,
          isSA: false
        });
      }

      qualState.leg2HomeScore = l2H;
      qualState.leg2AwayScore = l2A;
      qualState.leg2Played = true;
      if (penH !== null) {
        qualState.leg2PenaltyHomeScore = penH;
        qualState.leg2PenaltyAwayScore = penA;
      }
      qualState.completed = true;
      qualState.qualified = tieRes.playerWon;
      qualState.tieSummary = tieRes;

      legResultFixture = {
        homeId: homeTeam.idnum,
        awayId: awayTeam.idnum,
        homeScore: l2H,
        awayScore: l2A,
        penaltyHomeScore: penH !== null ? penH : undefined,
        penaltyAwayScore: penA !== null ? penA : undefined,
        played: true
      };

      const decNote = tieRes.decidedBy === 'penalties'
        ? `on penalties (${tieRes.playerPen}-${tieRes.oppPen})`
        : (tieRes.decidedBy === 'away_goals' ? 'on away goals' : 'on aggregate');

      if (tieRes.playerWon) {
        const setup = buildEuropeanCupSetup({
          competition: qualState.competition,
          seasonStr: stateCopy.season,
          isSA: false,
          selectedTeamObj: pTeam,
          nextSeasonTeams: stateCopy.teams,
          targetReplaceTeamName: opp.name
        });
        stateCopy.europeanCup = setup.europeanCup;
        stateCopy.europeanCupState = setup.europeanCupState;
        stateCopy.calendar = insertEuropeanEventsIntoCalendar(stateCopy.calendar, setup.dynamicSchedules, 2);

        stateCopy.newsFeed = appendAndPruneNews(stateCopy.newsFeed, {
          id: `news_qual_win_${Date.now()}`,
          round: stateCopy.currentRound || 1,
          dateStr: '3rd Qualifying Round',
          category: 'cup',
          categoryLabel: '🏆 QUALIFIED FOR EUROPE',
          title: `✅ ${pTeam.name} Qualify for ${qualState.competitionLabel}!`,
          summary: `${pTeam.name} defeated ${opp.name} (${tieRes.playerAgg}-${tieRes.oppAgg} agg, ${decNote}) to claim their place in the ${qualState.competitionLabel}.`,
          body: `Celebrations are underway after ${pTeam.name} overcame ${opp.name} across two intense qualifying legs (${tieRes.playerAgg}-${tieRes.oppAgg} on aggregate, winning ${decNote})!\n\n${pTeam.name} have officially taken ${opp.name}'s place in this season's ${qualState.competitionLabel}.`,
          isRead: false,
          timestamp: Date.now()
        }, stateCopy.currentRound || 1);
      } else {
        stateCopy.europeanCup = null;
        stateCopy.europeanCupState = null;
        stateCopy.newsFeed = appendAndPruneNews(stateCopy.newsFeed, {
          id: `news_qual_loss_${Date.now()}`,
          round: stateCopy.currentRound || 1,
          dateStr: '3rd Qualifying Round',
          category: 'cup',
          categoryLabel: '🇪🇺 QUALIFYING EXIT',
          title: `❌ ${pTeam.name} Eliminated from ${qualState.competitionLabel} Qualifying`,
          summary: `${pTeam.name} fell to ${opp.name} (${tieRes.playerAgg}-${tieRes.oppAgg} agg, lost ${decNote}) and will focus on domestic competitions this season.`,
          body: `Heartbreak in the 3rd Qualifying Round as ${pTeam.name} fell short against ${opp.name} (${tieRes.playerAgg}-${tieRes.oppAgg} on aggregate).\n\nFocus now shifts to the domestic league and cup campaign.`,
          isRead: false,
          timestamp: Date.now()
        }, stateCopy.currentRound || 1);
      }
    }

    if (!stateCopy.isUnemployed && legResultFixture) {
      const pGoalsQual = isLeg1 ? legResultFixture.homeScore : legResultFixture.awayScore;
      const oGoalsQual = isLeg1 ? legResultFixture.awayScore : legResultFixture.homeScore;
      const wonPensQual = !isLeg1 &&
        legResultFixture.penaltyHomeScore != null &&
        legResultFixture.penaltyAwayScore != null &&
        legResultFixture.penaltyAwayScore > legResultFixture.penaltyHomeScore;
      const profUpdated = recordLiveUserMatchToProfile({
        matchKey: `${stateCopy.season}:qual:${qualState.competition || 'euro'}_leg${ev.leg}:${legResultFixture.homeId}-${legResultFixture.awayId}`,
        playerGoals: pGoalsQual,
        opponentGoals: oGoalsQual,
        isHome: isLeg1,
        playerTeam: pTeam,
        opponentTeam: opp,
        wonOnPenalties: wonPensQual,
        season: stateCopy.season,
        country: stateCopy.country,
        division: stateCopy.division || 1,
        competitionLabel: `${qualState.competitionLabel || 'Europe'} Qual`,
        fallbackManagerName: stateCopy.managerName
      });
      if (profUpdated) setManagerProfile(profUpdated);
    }

    stateCopy.calendarIndex += 1;
    localStorage.setItem('retro_league_career', JSON.stringify(stateCopy));
    setLeagueState(stateCopy);

    setResultsModalFixtures([legResultFixture]);
    setResultsModalTitle(modalTitle);
    setResultsModalTheme("#ffd700");
    setResultsModalOpen(true);
  };

  const handleSimulateRound = () => {
    if (isSeasonOver) return;

    if (isEuropeanQualifierNext) {
      simulateEuropeanQualifierLeg();
    } else if (currentEvent && (currentEvent.type === "domestic_cup" || currentEvent.isDomesticCup)) {
      simulateDomesticCupRound();
    } else if (isEuropeanMatchNext) {
      simulateRestWeek();
    } else {
      handleSimulateLeagueRound();
    }
  };

  const handleKickOff = () => {
    if (isSeasonOver) return;
    const hasEuroMatch = isEuropeanMatchNext && !isRestWeek && Boolean(clPlayerFixture) && Boolean(europeanOpponent);
    const hasDomesticMatch = !isEuropeanMatchNext && Boolean(playerFixture) && Boolean(opponentTeamObj);
    const willPlayMatch = isEuropeanMatchNext ? hasEuroMatch : hasDomesticMatch;
    if (willPlayMatch && playerTeamObj?.name) {
      try {
        const lineupRaw = localStorage.getItem(`retro_lineup_${playerTeamObj.name}_${season}`);
        const rosterRaw = localStorage.getItem(`retro_roster_${playerTeamObj.name}_${season}`);
        const parsedLineup = lineupRaw ? JSON.parse(lineupRaw) : {};
        const parsedRoster = rosterRaw ? JSON.parse(rosterRaw) : [];
        const rosterByName = new Map(
          (Array.isArray(parsedRoster) ? parsedRoster : []).filter(Boolean).map(rp => [rp.name, rp])
        );
        const suspendedStarters = Object.values(parsedLineup || {})
          .filter(Boolean)
          .map(lp => rosterByName.get(lp.name) || lp)
          .filter(p => p.suspensionMatchesLeft > 0);
        if (suspendedStarters.length > 0) {
          const listStr = suspendedStarters
            .map(p => `• ${p.name} (${p.suspensionMatchesLeft}m — ${p.suspensionReason || 'Suspended'})`)
            .join("\n");
          alert(`🟥 SUSPENDED STARTER(S) IN LINEUP!\n\nYou cannot kick off with suspended player(s) in your starting XI:\n${listStr}\n\nPlease replace them in Tactics.`);
          setOfficeTab("tactics");
          return;
        }
      } catch (e) {
        // Proceed if localStorage parse fails
      }
    }

    if (isEuropeanMatchNext) {
      if (!hasEuroMatch) {
        simulateRestWeek();
      } else {
        navigate(`/pre-match?europe`);
      }
    } else if (!hasDomesticMatch) {
      handleSimulateRound();
    } else {
      navigate(`/pre-match?league`);
    }
  };

  const handleResetCareer = () => {
    if (window.confirm("Are you sure you want to end this career and start a new league?")) {
      localStorage.removeItem("retro_league_career");
      localStorage.removeItem("retro_manager_profile");
      clearCareerTransferLedger();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("retro_roster_") || key.startsWith("retro_lineup_") || key.startsWith("retro_roles_") || key.startsWith("retro_formation_") || key.startsWith("retro_captain_"))) {
          localStorage.removeItem(key);
        }
      }
      navigate("/league");
    }
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const renderContinentalKnockoutBracket = (cupState, euroRules) => {
    const kState = cupState?.knockoutState;
    if (!kState) return null;

    const KO_ORDER = ["playoffs", "round_of_32", "round_of_16", "quarter_finals", "semi_finals", "final"];
    const KO_LABELS = {
      playoffs: "Knockout Playoffs",
      round_of_32: "Round of 32",
      round_of_16: "Round of 16",
      quarter_finals: "Quarter-Finals",
      semi_finals: "Semi-Finals",
      final: "Final"
    };
    const toCamel = (str) => str.replace(/_([a-z0-9])/g, (g) => g[1].toUpperCase());
    const getStageFixtures = (stg) => {
      if (stg === "final") {
        return { leg1: kState.final || [], leg2: null };
      }
      const key = toCamel(stg);
      return { leg1: kState[`${key}Leg1`] || [], leg2: kState[`${key}Leg2`] || [] };
    };
    const isStageComplete = (stg) => {
      const { leg1, leg2 } = getStageFixtures(stg);
      if (leg1.length === 0 || !leg1.every(m => m.played)) return false;
      if (stg === "final") return true;
      return leg2 && leg2.length > 0 && leg2.every(m => m.played);
    };

    const ruleStages = (euroRules?.stages || []).filter(s => KO_LABELS[s]);
    const stages = KO_ORDER.filter(s => ruleStages.includes(s) || getStageFixtures(s).leg1.length > 0);
    if (stages.length === 0) return null;

    const generatedStages = stages.filter(s => getStageFixtures(s).leg1.length > 0);
    const currentLiveStage = generatedStages.find(s => !isStageComplete(s))
      || generatedStages[generatedStages.length - 1]
      || stages[0];
    const activeStage = (selectedEuroKoStage && stages.includes(selectedEuroKoStage))
      ? selectedEuroKoStage
      : currentLiveStage;

    const { leg1: stageLeg1, leg2: stageLeg2 } = getStageFixtures(activeStage);
    const pId = cupState.europeanPlayerTeamId;

    return (
      <div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {stages.map(stg => {
            const isSelected = activeStage === stg;
            const isPlayed = isStageComplete(stg);
            const hasDraw = getStageFixtures(stg).leg1.length > 0;
            const isCurrent = hasDraw && !isPlayed && stg === currentLiveStage;
            return (
              <button
                key={stg}
                onClick={() => setSelectedEuroKoStage(stg)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron, sans-serif',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  border: isSelected ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.08)',
                  background: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0,0,0,0.3)',
                  color: isSelected ? '#00e5ff' : (isPlayed ? '#00ff64' : '#888')
                }}
              >
                {KO_LABELS[stg].toUpperCase()} {isCurrent ? '⚡' : (isPlayed ? '✓' : '')}
              </button>
            );
          })}
        </div>

        {stageLeg1.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontFamily: 'Orbitron', fontSize: '12px' }}>
            Stage matches draw not generated yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {stageLeg1.map((m, i) => {
              const h = cupState.teams.find(t => t.idnum === m.homeId);
              const a = cupState.teams.find(t => t.idnum === m.awayId);
              const m2 = stageLeg2 ? stageLeg2.find(x => x.homeId === m.awayId && x.awayId === m.homeId) : null;
              const isUserMatch = Boolean(pId && (m.homeId === pId || m.awayId === pId));
              const isFinalStage = activeStage === "final";
              const hasPens = isFinalStage
                ? (m.penaltyHomeScore > 0 || m.penaltyAwayScore > 0)
                : Boolean(m2 && (m2.penaltyHomeScore > 0 || m2.penaltyAwayScore > 0));
              const statusLabel = isFinalStage
                ? (m.played ? (hasPens ? 'PENALTIES' : 'FULL TIME') : 'UPCOMING')
                : (m2 && m2.played ? (hasPens ? 'PENALTIES' : 'FULL TIME') : (m.played ? 'LEG 2 NEXT' : 'UPCOMING'));

              let centerScore = 'VS';
              if (isFinalStage) {
                if (m.played) centerScore = `${m.homeScore} - ${m.awayScore}`;
              } else if (m2 && m2.played) {
                centerScore = `${m.homeScore + m2.awayScore} - ${m.awayScore + m2.homeScore}`;
              } else if (m.played) {
                centerScore = `${m.homeScore} - ${m.awayScore}`;
              }

              return (
                <div
                  key={`${activeStage}-${i}`}
                  style={{
                    background: isUserMatch ? 'rgba(0, 229, 255, 0.12)' : 'rgba(0, 0, 0, 0.35)',
                    border: isUserMatch ? '1.5px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: isUserMatch ? '#00e5ff' : '#888', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                    <span>{KO_LABELS[activeStage]}</span>
                    <span>{statusLabel}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                      {h && <TeamFlag primaryColor={h.primaryColor} secondaryColor={h.secondaryColor} size={18} />}
                      <span
                        title={h?.name || "TBD"}
                        style={{
                          fontSize: '11.5px',
                          fontWeight: m.homeId === pId ? 'bold' : 'normal',
                          color: m.homeId === pId ? '#00ff64' : '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {h?.name || "TBD"}
                      </span>
                    </div>

                    <div style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', fontSize: '11.5px', fontWeight: 'bold', fontFamily: 'Orbitron', color: (isFinalStage ? m.played : (m.played || m2?.played)) ? '#ffd700' : '#666', flexShrink: 0 }}>
                      {centerScore}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                      <span
                        title={a?.name || "TBD"}
                        style={{
                          fontSize: '11.5px',
                          fontWeight: m.awayId === pId ? 'bold' : 'normal',
                          color: m.awayId === pId ? '#00ff64' : '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'right'
                        }}
                      >
                        {a?.name || "TBD"}
                      </span>
                      {a && <TeamFlag primaryColor={a.primaryColor} secondaryColor={a.secondaryColor} size={18} />}
                    </div>
                  </div>

                  {!isFinalStage && (
                    <div style={{ textAlign: 'center', fontSize: '9.5px', color: m.played ? '#9fb3a5' : '#666', fontFamily: 'Orbitron', marginTop: '1px' }}>
                      L1: {m.played ? `${m.homeScore}-${m.awayScore}` : 'vs'} | L2: {m2 && m2.played ? `${m2.awayScore}-${m2.homeScore}` : 'vs'}
                      {hasPens ? ` (${m2.penaltyAwayScore}-${m2.penaltyHomeScore} pen)` : ''}
                    </div>
                  )}

                  {isFinalStage && m.played && hasPens && (
                    <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#00e5ff', fontFamily: 'Orbitron', marginTop: '1px' }}>
                      Pens: {m.penaltyHomeScore} - {m.penaltyAwayScore}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="Match team-select-container league-dashboard-arena">
      <div className="matchheader selector-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1100px' }}>
        <div>
          <h1 className="glowing-header-text" style={{ textAlign: 'left', fontSize: '32px' }}>LEAGUE & CUPS OFFICE</h1>
          <p className="lobby-subtitle" style={{ textAlign: 'left' }}>
            Season {season}
            {isAperturaClausuraLeague && (
              isSeasonOver
                ? " (Season Over)"
                : (currentRound <= halfRounds ? " (Apertura)" : " (Clausura)")
            )}
            {" "} - {cap(country)} {division === 2 ? "Division 2" : "Division 1"}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px', fontSize: '11.5px', color: '#e2e8f0' }}>
            <span style={{ color: '#94a3b8' }}>👔 Manager:</span>
            {(managerProfile?.nationality || leagueState?.managerNationality) && (
              <NationFlag nation={managerProfile?.nationality || leagueState?.managerNationality} size={16} />
            )}
            <strong style={{ color: '#ffd700', fontFamily: 'Orbitron', letterSpacing: '0.5px' }}>
              {managerProfile?.name || finalManagerName}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleExportSave}
              className="glowing-btn"
              style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#00ff64', color: '#00ff64', background: 'rgba(0, 255, 100, 0.05)' }}
              title="Export career save to a JSON file"
            >
              💾 EXPORT SAVE
            </button>
            <button
              onClick={() => document.getElementById("import-save-input").click()}
              className="glowing-btn"
              style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#ffc107', color: '#ffc107', background: 'rgba(255, 193, 7, 0.05)' }}
              title="Import career save from a JSON file"
            >
              📂 IMPORT SAVE
            </button>
            <input
              type="file"
              id="import-save-input"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportSave}
            />
          </div>

          {!isSeasonOver ? (
            calendar ? (
              <div className="round-badge animated-slide-in" style={{ borderColor: isEuropeanQualifierNext ? '#ffd700' : (isEuropeanMatchNext ? '#00e5ff' : (isDomesticCupNext ? '#ff0055' : '#00ff64')) }}>
                <span className="round-badge-title" style={{ color: isEuropeanQualifierNext ? '#ffd700' : (isEuropeanMatchNext ? '#00e5ff' : (isDomesticCupNext ? '#ff0055' : '#00ff64')) }}>
                  {isEuropeanQualifierNext ? "UEFA PLAY-OFF" : (isEuropeanMatchNext ? "MIDWEEK" : (isDomesticCupNext ? "DOMESTIC CUP" : "WEEKEND"))}
                </span>
                <span className="round-badge-num" style={{ color: '#fff', fontSize: (isDomesticCupNext || isEuropeanQualifierNext) ? '11px' : '18px' }}>
                  {isEuropeanQualifierNext
                    ? `3RD QUAL. LEG ${currentEvent.leg}`
                    : (isEuropeanMatchNext ? `CUP MD ${currentEvent.matchday}` : (isDomesticCupNext ? (CUP_STAGE_NAMES[currentEvent?.stage] || currentEvent?.stage || "CUP ROUND") : `LEAGUE ${currentEvent?.index}`))}
                </span>
              </div>
            ) : (
              <div className="round-badge animated-slide-in">
                <span className="round-badge-title">ROUND</span>
                <span className="round-badge-num">{currentRound}<span className="round-badge-max">/{totalRounds}</span></span>
              </div>
            )
          ) : (
            <div className="round-badge gold-badge animated-slide-in">
              <span className="round-badge-title">SEASON</span>
              <span className="round-badge-num">OVER</span>
            </div>
          )}
        </div>
      </div>

      {/* Office Navigation Tabs */}
      <div className="office-tabs-bar" style={{
        display: 'flex',
        justify: 'center',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(15, 18, 26, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '6px 10px',
        margin: '15px auto 20px auto',
        maxWidth: '1100px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        flexWrap: 'wrap'
      }}>
        {[
          {
            id: 'news',
            label: (() => {
              const unread = (leagueState?.newsFeed || []).filter(i => !i.isRead).length;
              return unread > 0 ? `📰 NEWS (${unread})` : '📰 NEWS';
            })(),
            color: '#00e5ff'
          },
          { id: 'home', label: '🏠 HOME', color: '#00ff64' },
          ...(!leagueState?.isUnemployed ? [
            { id: 'tactics', label: '📋 FORMATIONS & TACTICS', color: '#ffd700' }
          ] : []),
          { id: 'matches', label: '⚽ MATCHES', color: '#00e5ff' },
          ...(!leagueState?.isUnemployed ? [
            { id: 'transfers', label: '🔄 TRANSFERS', color: '#ff4500' },
            { id: 'board', label: '📊 BOARD', color: '#e040fb' }
          ] : []),
          {
            id: 'jobs',
            label: (() => {
              const openCount = (leagueState?.worldState?.vacancies?.length || 0) + (leagueState?.worldState?.directOffers?.length || 0);
              return openCount > 0 ? `💼 JOBS (${openCount})` : '💼 JOBS';
            })(),
            color: '#38bdf8'
          },
          { id: 'manager', label: '👔 MANAGER', color: '#00e676' }
        ].map(tab => {
          const isActive = officeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (officeTab === "tactics" && tab.id !== "tactics") {
                  reloadLeagueState();
                }
                setOfficeTab(tab.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '11.5px',
                fontWeight: 'bold',
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '1px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                border: isActive ? `1px solid ${tab.color}` : '1px solid rgba(255, 255, 255, 0.05)',
                background: isActive ? `${tab.color}15` : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? tab.color : '#8888aa',
                boxShadow: isActive ? `0 0 15px ${tab.color}33` : 'none',
                outline: 'none'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {officeTab === "jobs" && (
        <WorldJobsPanel
          leagueState={leagueState}
          managerPrestige={calculateManagerPrestige(managerProfile)}
          boardConfidence={confidence}
          onApplyVacancy={handleApplyVacancy}
          onAcceptDirectOffer={handleMidSeasonTakeover}
          onDeclineDirectOffer={handleDeclineDirectOffer}
          onAdvanceUnemployedWeek={handleAdvanceUnemployedWeek}
          isBusy={isJobBusy}
        />
      )}

      {officeTab === "news" && (
        <NewsFeed
          newsItems={leagueState?.newsFeed || []}
          onSelectTab={(tabId) => setOfficeTab(tabId)}
          onMarkRead={handleMarkNewsRead}
          onMarkAllRead={handleMarkAllNewsRead}
        />
      )}

      {officeTab === "tactics" && (
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          <FormationTacticsModal
            isOpen={true}
            inline={true}
            mode="career"
            onClose={reloadLeagueState}
          />
        </div>
      )}

      {officeTab === "matches" && (
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <Fixtures inline={true} mode="league" />
        </div>
      )}

      {officeTab === "transfers" && (
        <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <TransferModal
            isOpen={true}
            inline={true}
            leagueState={leagueState}
            setLeagueState={setLeagueState}
            managerProfile={managerProfile}
            onClose={reloadLeagueState}
          />
        </div>
      )}



      {officeTab === "board" && (
        <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#e040fb', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
              📊 BOARDROOM & DIRECTORS DESK
            </h2>
            <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {season} Season | Board Evaluation Desk
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(224, 64, 251, 0.25)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#e040fb', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                  💼 BOARD CONFIDENCE
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px',
                  background: confidence >= 70 ? 'rgba(0, 255, 100, 0.1)' : (confidence >= 55 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 51, 81, 0.1)'),
                  color: confidence >= 70 ? '#00ff64' : (confidence >= 55 ? '#ffa500' : '#ff3333'),
                  fontWeight: 'bold', fontSize: '10px', fontFamily: 'Orbitron'
                }}>
                  {confidence >= 70 ? "SECURE" : (confidence >= 55 ? "WARNING" : "FIRE RISK")}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'Orbitron', color: confidence >= 70 ? '#00ff64' : (confidence >= 55 ? '#ffa500' : '#ff3333') }}>
                  {confidence}%
                </span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>overall approval</span>
              </div>

              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${confidence}%`, height: '100%',
                  background: confidence >= 70 ? '#00ff64' : (confidence >= 55 ? '#ffa500' : '#ff3333'),
                  boxShadow: `0 0 10px ${confidence >= 70 ? '#00ff64' : (confidence >= 55 ? '#ffa500' : '#ff3333')}`,
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>

              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>League Objective:</span>
                  <span style={{ fontWeight: 'bold', color: '#00ff64' }}>{finalExpectation.text}</span>
                </div>
                {leagueState?.domesticCupExpectation && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>Domestic Cup Target:</span>
                    <span style={{ fontWeight: 'bold', color: '#ff0055' }}>{leagueState.domesticCupExpectation.text}</span>
                  </div>
                )}
                {cupExpectationObj && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#888' }}>European Cup Objective:</span>
                    <span style={{ fontWeight: 'bold', color: '#00e5ff' }}>{cupExpectationObj.text}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Current Position:</span>
                  <span style={{ fontWeight: 'bold', color: '#ffd700' }}>Pos {playerPosition}</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 255, 100, 0.2)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#00ff64', fontSize: '12px', fontWeight: 'bold', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                  📣 SUPPORTERS MORALE
                </span>
                <span style={{
                  padding: '2px 8px', borderRadius: '4px',
                  background: fanConfidence >= 75 ? 'rgba(0, 255, 100, 0.1)' : (fanConfidence >= 45 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 51, 81, 0.1)'),
                  color: fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333'),
                  fontWeight: 'bold', fontSize: '10px', fontFamily: 'Orbitron'
                }}>
                  {fanConfidence >= 75 ? "THRILLED" : (fanConfidence >= 45 ? "MIXED" : "MUTINOUS")}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: 'Orbitron', color: fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333') }}>
                  {fanConfidence}%
                </span>
                <span style={{ fontSize: '11px', color: '#aaa' }}>fan morale</span>
              </div>

              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${fanConfidence}%`, height: '100%',
                  background: fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333'),
                  boxShadow: `0 0 10px ${fanConfidence >= 75 ? '#00ff64' : (fanConfidence >= 45 ? '#ffa500' : '#ff3333')}`,
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>

              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px', fontSize: '11.5px', color: '#aaa', lineHeight: '1.4' }}>
                {fanConfidence >= 75
                  ? "Supporters are ecstatic with matchday performances and tactics."
                  : (fanConfidence >= 45
                    ? "Supporters have mixed expectations. Winning upcoming fixtures will boost morale."
                    : "Supporters are deeply dissatisfied with recent results. Strong wins needed urgently!")}
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 215, 0, 0.03)', border: '1px solid rgba(255, 215, 0, 0.15)', borderRadius: '12px', padding: '18px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Available Budget</span>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffea00', fontFamily: 'Orbitron', marginTop: '4px' }}>
                ${(leagueState.budget !== undefined ? leagueState.budget : 10.0).toFixed(1)}M
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Team Rating</span>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron', marginTop: '4px' }}>
                ATT {playerTeamObj?.attack} | MID {playerTeamObj?.midfield} | DEF {playerTeamObj?.defense}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Manager Prestige</span>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#00ff64', fontFamily: 'Orbitron', marginTop: '4px' }}>
                {calculateManagerPrestige(managerProfile)} PTS
              </div>
            </div>
          </div>

          {!isSeasonOver && !leagueState?.isUnemployed && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="play-match-btn"
                style={{ fontSize: '11px', padding: '8px 16px', borderColor: '#ff6b6b', color: '#ff6b6b', background: 'rgba(255, 51, 81, 0.06)' }}
                onClick={handleResignFromClub}
              >
                🚪 RESIGN & ENTER JOB MARKET
              </button>
            </div>
          )}

          {isSeasonOver && (
            <div style={{ marginTop: '10px' }}>
              {(() => {
                const verdict = getBoardVerdict(playerPosition, finalExpectation);
                return (
                  <div style={{ background: 'rgba(0,0,0,0.5)', border: `2px solid ${verdict.color}`, borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ color: verdict.color, fontSize: '18px', margin: 0, fontFamily: 'Orbitron' }}>
                      🏆 END OF SEASON BOARD VERDICT: {verdict.title}
                    </h3>
                    <p style={{ color: '#ccc', textAlign: 'center', fontSize: '12px', margin: 0 }}>
                      {verdict.verdict}
                    </p>
                    {verdict.tier !== "disgraced" && seasonRolloverMeta?.canRenew !== false && (
                      <button
                        className="play-match-btn glowing-btn pulse"
                        style={{ fontSize: '12px', padding: '8px 20px', borderColor: '#00ff64', color: '#00ff64' }}
                        onClick={() => handleSignContract(playerTeamId)}
                      >
                        ⚽ RENEW CONTRACT WITH {playerTeamObj?.name}
                      </button>
                    )}
                    {seasonRolloverMeta?.canRenew === false && (
                      <p style={{ color: '#ffb74d', textAlign: 'center', fontSize: '11.5px', margin: 0 }}>
                        {seasonRolloverMeta.exitReason} Choose an incoming Job Offer below to continue your career.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {officeTab === "manager" && (
        <ManagerProfilePanel
          managerProfile={managerProfile}
          leagueState={leagueState}
          editName={editName}
          setEditName={setEditName}
          editNationality={editNationality}
          setEditNationality={setEditNationality}
          editPhoto={editPhoto}
          onPhotoUpload={handlePhotoUpload}
          onSaveProfile={handleSaveProfile}
        />
      )}

      {officeTab === "home" && (
        <div className="match-arena-layout" style={{ maxWidth: '1100px' }}>

          {/* Left Grid Card: Standings / Standings Tab */}
          <div className="glass-card standings-table-card" style={{
            width: '58%',
            flexGrow: 1,
            padding: '20px',
            height: '480px',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab("league")}
                className="back-home-btn"
                style={{
                  fontSize: '11px',
                  padding: '6px 12px',
                  borderColor: activeTab === "league" ? '#ffd700' : 'rgba(255,255,255,0.1)',
                  background: activeTab === "league" ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                  color: activeTab === "league" ? '#ffd700' : '#888'
                }}
              >
                🏆 DOMESTIC LEAGUE
              </button>
              {leagueState?.domesticCupState && (
                <button
                  onClick={() => setActiveTab("cup")}
                  className="back-home-btn"
                  style={{
                    fontSize: '11px',
                    padding: '6px 12px',
                    borderColor: activeTab === "cup" ? '#ff0055' : 'rgba(255,255,255,0.1)',
                    background: activeTab === "cup" ? 'rgba(255, 0, 85, 0.12)' : 'transparent',
                    color: activeTab === "cup" ? '#ff0055' : '#888'
                  }}
                >
                  🥊 {leagueState.domesticCupState.cupName?.toUpperCase() || "DOMESTIC CUP"}
                </button>
              )}
              {europeanCup && (
                <button
                  onClick={() => setActiveTab("europe")}
                  className="back-home-btn"
                  style={{
                    fontSize: '11px',
                    padding: '6px 12px',
                    borderColor: activeTab === "europe" ? '#00e5ff' : 'rgba(255,255,255,0.1)',
                    background: activeTab === "europe" ? 'rgba(0, 229, 255, 0.08)' : 'transparent',
                    color: activeTab === "europe" ? '#00e5ff' : '#888'
                  }}
                >
                  {isNorthAmerica ? "⭐ NORTH AMERICAN COMPETITION" : (isSouthAmerica ? "⭐ SOUTH AMERICAN COMPETITION" : "⭐ EUROPEAN COMPETITION")}
                </button>
              )}
              <button
                onClick={() => setActiveTab("world")}
                className="back-home-btn"
                style={{
                  fontSize: '11px',
                  padding: '6px 12px',
                  borderColor: activeTab === "world" ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                  background: activeTab === "world" ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                  color: activeTab === "world" ? '#38bdf8' : '#888'
                }}
              >
                🌍 WORLD TABLES
              </button>
            </div>

            {activeTab === "world" ? (
              <WorldTablesPanel leagueState={leagueState} />
            ) : activeTab === "league" ? (
              <>
                {/* League View Mode Switcher */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setLeagueViewMode("standings")}
                    style={{
                      fontSize: '11px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontFamily: 'Orbitron',
                      fontWeight: 'bold',
                      border: leagueViewMode === "standings" ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                      background: leagueViewMode === "standings" ? 'rgba(255, 215, 0, 0.12)' : 'transparent',
                      color: leagueViewMode === "standings" ? '#ffd700' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📋 LEAGUE TABLE
                  </button>
                  <button
                    onClick={() => setLeagueViewMode("scorers")}
                    style={{
                      fontSize: '11px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontFamily: 'Orbitron',
                      fontWeight: 'bold',
                      border: leagueViewMode === "scorers" ? '1px solid #00ff64' : '1px solid rgba(255,255,255,0.1)',
                      background: leagueViewMode === "scorers" ? 'rgba(0, 255, 100, 0.12)' : 'transparent',
                      color: leagueViewMode === "scorers" ? '#00ff64' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    ⚽ TOP SCORERS
                  </button>
                  <button
                    onClick={() => setLeagueViewMode("assists")}
                    style={{
                      fontSize: '11px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontFamily: 'Orbitron',
                      fontWeight: 'bold',
                      border: leagueViewMode === "assists" ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
                      background: leagueViewMode === "assists" ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                      color: leagueViewMode === "assists" ? '#00e5ff' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    🎯 TOP ASSISTS
                  </button>
                </div>

                {leagueViewMode === "standings" && (
                  <>
                    <h3 className="team-card-title" style={{ textAlign: 'left', marginBottom: '15px', color: '#ffd700' }}>
                      {isAperturaClausuraLeague
                        ? `${activeSubStandings.toUpperCase()} STANDINGS`
                        : "LEAGUE STANDINGS"
                      }
                    </h3>

                    {isAperturaClausuraLeague && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                        <button
                          onClick={() => setSubStandingsTab("apertura")}
                          className="back-home-btn"
                          style={{
                            fontSize: '11px',
                            padding: '6px 12px',
                            borderColor: activeSubStandings === "apertura" ? '#ffd700' : 'rgba(255,255,255,0.1)',
                            background: activeSubStandings === "apertura" ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                            color: activeSubStandings === "apertura" ? '#ffd700' : '#888',
                            cursor: 'pointer'
                          }}
                        >
                          Apertura
                        </button>
                        <button
                          onClick={() => setSubStandingsTab("clausura")}
                          className="back-home-btn"
                          style={{
                            fontSize: '11px',
                            padding: '6px 12px',
                            borderColor: activeSubStandings === "clausura" ? '#ffd700' : 'rgba(255,255,255,0.1)',
                            background: activeSubStandings === "clausura" ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                            color: activeSubStandings === "clausura" ? '#ffd700' : '#888',
                            cursor: 'pointer'
                          }}
                        >
                          Clausura
                        </button>
                        <button
                          onClick={() => setSubStandingsTab("aggregate")}
                          className="back-home-btn"
                          style={{
                            fontSize: '11px',
                            padding: '6px 12px',
                            borderColor: activeSubStandings === "aggregate" ? '#ffd700' : 'rgba(255,255,255,0.1)',
                            background: activeSubStandings === "aggregate" ? 'rgba(255, 215, 0, 0.08)' : 'transparent',
                            color: activeSubStandings === "aggregate" ? '#ffd700' : '#888',
                            cursor: 'pointer'
                          }}
                        >
                          Aggregate
                        </button>
                      </div>
                    )}

                    <table className="retro-standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textTransform: 'uppercase', fontSize: '10px', textAlign: 'center' }}>
                          <th style={{ padding: '8px 5px', textAlign: 'left' }}>Pos</th>
                          <th style={{ padding: '8px 5px', textAlign: 'left' }}>Team</th>
                          <th style={{ padding: '8px 5px' }}>P</th>
                          <th style={{ padding: '8px 5px' }}>W</th>
                          <th style={{ padding: '8px 5px' }}>D</th>
                          <th style={{ padding: '8px 5px' }}>L</th>
                          <th style={{ padding: '8px 5px' }}>GD</th>
                          <th style={{ padding: '8px 5px', color: '#ffd700' }}>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((team, index) => {
                          const isPlayer = team.idnum === playerTeamId;
                          return (
                            <tr
                              key={team.idnum}
                              style={{
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                background: isPlayer ? 'rgba(0, 255, 100, 0.04)' : 'transparent',
                                color: isPlayer ? '#00ff64' : '#fff',
                                fontWeight: isPlayer ? 'bold' : 'normal'
                              }}
                            >
                              <td style={{ padding: '10px 5px', textAlign: 'left', fontWeight: 'bold' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ minWidth: '24px', display: 'inline-block' }}>{index + 1}.</span>
                                  {(() => {
                                    const pos = index + 1;
                                    const showQualDots = !isAperturaClausuraLeague || activeSubStandings === "aggregate";
                                    let color = null;
                                    if (showQualDots) {
                                      if (division === 2) {
                                        if (pos <= 3) color = '#00ff64'; // Green for Promotion
                                      } else {
                                        if (pos <= clSpotsCount) color = '#00ff64'; // Green for CL/Libertadores/CONCACAF
                                        else if (pos <= clSpotsCount + uefaSpotsCount) color = '#00e5ff'; // Blue for UEFA/Sudamericana
                                        else if (pos <= clSpotsCount + uefaSpotsCount + ueclSpotsCount) color = '#ffd700'; // Yellow/Gold for UECL
                                        else if (country !== "usa" && pos > standings.length - 3) color = '#ff3b30'; // Red for Relegation
                                      }
                                    }

                                    if (!color) return (
                                      <span style={{ display: 'inline-block', width: '8px', height: '8px', flexShrink: 0 }} />
                                    );
                                    return (
                                      <span
                                        style={{
                                          display: 'inline-block',
                                          width: '8px',
                                          height: '8px',
                                          borderRadius: '50%',
                                          background: color,
                                          boxShadow: `0 0 6px ${color}`,
                                          flexShrink: 0
                                        }}
                                        title={
                                          division === 2
                                            ? "Promotion Zone"
                                            : pos <= clSpotsCount
                                              ? (isNorthAmerica ? "CONCACAF Champions Cup Zone" : (isSouthAmerica ? "Copa Libertadores Zone" : "Champions League Zone"))
                                              : pos <= clSpotsCount + uefaSpotsCount
                                                ? (isSouthAmerica ? "Copa Sudamericana Zone" : "UEFA Cup / Europa League Zone")
                                                : pos <= clSpotsCount + uefaSpotsCount + ueclSpotsCount
                                                  ? "Conference League Zone"
                                                  : "Relegation Zone"
                                        }
                                      />
                                    );
                                  })()}
                                </div>
                              </td>
                              <td style={{ padding: '10px 5px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={28} />
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={team.name}>
                                  {team.name} {isPlayer && " (You)"}
                                </span>
                              </td>
                              <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.played}</td>
                              <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.won}</td>
                              <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.drawn}</td>
                              <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.lost}</td>
                              <td style={{ padding: '10px 5px', textAlign: 'center', color: (team.gf - team.ga) > 0 ? '#00ff64' : ((team.gf - team.ga) < 0 ? '#ff4500' : '#888') }}>
                                {(team.gf - team.ga) > 0 ? `+${team.gf - team.ga}` : (team.gf - team.ga)}
                              </td>
                              <td style={{ padding: '10px 5px', textAlign: 'center', color: isPlayer ? '#00ff64' : '#ffd700', fontWeight: 'bold' }}>{team.points}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Standings Legend */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {division === 2 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00ff64', boxShadow: '0 0 6px #00ff64' }}></span>
                          <span style={{ color: '#aaa', fontSize: '10px', fontFamily: 'Orbitron' }}>Promotion Zone</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00ff64', boxShadow: '0 0 6px #00ff64' }}></span>
                            <span style={{ color: '#aaa', fontSize: '10px', fontFamily: 'Orbitron' }}>{isNorthAmerica ? "CONCACAF Champions Cup" : (isSouthAmerica ? "Copa Libertadores" : "Champions League")}</span>
                          </div>
                          {uefaSpotsCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 6px #00e5ff' }}></span>
                              <span style={{ color: '#aaa', fontSize: '10px', fontFamily: 'Orbitron' }}>{isSouthAmerica ? "Copa Sudamericana" : "Europa League"}</span>
                            </div>
                          )}
                          {ueclSpotsCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ffd700', boxShadow: '0 0 6px #ffd700' }}></span>
                              <span style={{ color: '#aaa', fontSize: '10px', fontFamily: 'Orbitron' }}>Conference League</span>
                            </div>
                          )}
                          {country !== "usa" && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#ff3b30', boxShadow: '0 0 6px #ff3b30' }}></span>
                              <span style={{ color: '#aaa', fontSize: '10px', fontFamily: 'Orbitron' }}>Relegation</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}

                {leagueViewMode === "scorers" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 className="team-card-title" style={{ textAlign: 'left', margin: '0 0 10px 0', color: '#00ff64' }}>
                      ⚽ TOP GOALSCORERS (GOLDEN BOOT)
                    </h3>
                    {topScorersList.length === 0 ? (
                      <div style={{ padding: '30px 10px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                        No goals recorded yet this season. Play or simulate matches to see the Golden Boot race unfold!
                      </div>
                    ) : (
                      <table className="retro-standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textTransform: 'uppercase', fontSize: '10px', textAlign: 'center' }}>
                            <th style={{ padding: '8px 5px', textAlign: 'left', width: '45px' }}>Rank</th>
                            <th style={{ padding: '8px 5px', textAlign: 'left' }}>Player</th>
                            <th style={{ padding: '8px 5px', textAlign: 'left' }}>Club</th>
                            <th style={{ padding: '8px 5px', textAlign: 'center', width: '50px' }}>Pos</th>
                            <th style={{ padding: '8px 5px', textAlign: 'center', color: '#00ff64', width: '60px' }}>Goals</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topScorersList.map((player, idx) => {
                            const userClub = leagueState?.teams?.find(t => t.idnum === leagueState?.playerTeamId)?.name;
                            const isUserTeam = userClub && player.team === userClub;
                            const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                            return (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                                  background: isUserTeam ? 'rgba(0, 255, 100, 0.08)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'),
                                  color: isUserTeam ? '#00ff64' : '#fff'
                                }}
                              >
                                <td style={{ padding: '9px 5px', textAlign: 'left', fontWeight: 'bold' }}>
                                  {rankBadge}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'left', fontWeight: 'bold' }}>
                                  {player.name}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'left', color: '#aaa', fontSize: '12px' }}>
                                  {player.team}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'center', color: '#888', fontSize: '11px', fontFamily: 'Orbitron' }}>
                                  {player.position || 'FW'}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'center', color: '#00ff64', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '14px' }}>
                                  {player.goals}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {leagueViewMode === "assists" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h3 className="team-card-title" style={{ textAlign: 'left', margin: '0 0 10px 0', color: '#00e5ff' }}>
                      🎯 TOP ASSIST PROVIDERS (PLAYMAKER LEADERS)
                    </h3>
                    {topAssistsList.length === 0 ? (
                      <div style={{ padding: '30px 10px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                        No assists recorded yet this season. Play or simulate matches to see the Playmaker leaderboard!
                      </div>
                    ) : (
                      <table className="retro-standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textTransform: 'uppercase', fontSize: '10px', textAlign: 'center' }}>
                            <th style={{ padding: '8px 5px', textAlign: 'left', width: '45px' }}>Rank</th>
                            <th style={{ padding: '8px 5px', textAlign: 'left' }}>Player</th>
                            <th style={{ padding: '8px 5px', textAlign: 'left' }}>Club</th>
                            <th style={{ padding: '8px 5px', textAlign: 'center', width: '50px' }}>Pos</th>
                            <th style={{ padding: '8px 5px', textAlign: 'center', color: '#00e5ff', width: '60px' }}>Assists</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topAssistsList.map((player, idx) => {
                            const userClub = leagueState?.teams?.find(t => t.idnum === leagueState?.playerTeamId)?.name;
                            const isUserTeam = userClub && player.team === userClub;
                            const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                            return (
                              <tr
                                key={idx}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                                  background: isUserTeam ? 'rgba(0, 229, 255, 0.08)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'),
                                  color: isUserTeam ? '#00e5ff' : '#fff'
                                }}
                              >
                                <td style={{ padding: '9px 5px', textAlign: 'left', fontWeight: 'bold' }}>
                                  {rankBadge}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'left', fontWeight: 'bold' }}>
                                  {player.name}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'left', color: '#aaa', fontSize: '12px' }}>
                                  {player.team}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'center', color: '#888', fontSize: '11px', fontFamily: 'Orbitron' }}>
                                  {player.position || 'MF'}
                                </td>
                                <td style={{ padding: '9px 5px', textAlign: 'center', color: '#00e5ff', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '14px' }}>
                                  {player.assists}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </>
            ) : activeTab === "cup" ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="team-card-title" style={{ textAlign: 'left', margin: 0, color: '#ff0055' }}>
                    {leagueState?.domesticCupState?.cupName?.toUpperCase() || 'DOMESTIC CUP'}
                  </h3>
                  <span style={{ fontSize: '10.5px', color: '#ff0055', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                    {leagueState?.domesticCupState?.isCompleted
                      ? `🏆 CHAMPION: ${leagueState?.domesticCupState?.winnerName?.toUpperCase()}`
                      : `STAGE: ${CUP_STAGE_NAMES[leagueState?.domesticCupState?.stage]?.toUpperCase()}`}
                  </span>
                </div>

                {leagueState?.domesticCupState && (
                  <div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {leagueState.domesticCupState.stages.map(stg => {
                        const isCurrent = leagueState.domesticCupState.stage === stg;
                        const matches = leagueState.domesticCupState.knockoutState[stg] || [];
                        const isPlayed = matches.length > 0 && matches.every(m => m.played);
                        return (
                          <button
                            key={stg}
                            onClick={() => setSelectedCupStage(stg)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              fontFamily: 'Orbitron, sans-serif',
                              letterSpacing: '0.5px',
                              cursor: 'pointer',
                              border: (selectedCupStage || leagueState.domesticCupState.stage) === stg ? '1px solid #ff0055' : '1px solid rgba(255,255,255,0.08)',
                              background: (selectedCupStage || leagueState.domesticCupState.stage) === stg ? 'rgba(255,0,85,0.2)' : 'rgba(0,0,0,0.3)',
                              color: (selectedCupStage || leagueState.domesticCupState.stage) === stg ? '#ff0055' : (isPlayed ? '#00ff64' : '#888')
                            }}
                          >
                            {CUP_STAGE_NAMES[stg]?.toUpperCase() || stg.toUpperCase()} {isCurrent ? '⚡' : (isPlayed ? '✓' : '')}
                          </button>
                        );
                      })}
                    </div>

                    {(() => {
                      const activeStg = selectedCupStage || leagueState.domesticCupState.stage;
                      const stageMatches = leagueState.domesticCupState.knockoutState[activeStg] || [];
                      if (stageMatches.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontFamily: 'Orbitron', fontSize: '12px' }}>
                            Stage matches draw not generated yet.
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
                          {stageMatches.map(m => {
                            const isUserMatch = m.homeId === leagueState.playerTeamId || m.awayId === leagueState.playerTeamId;
                            const homeTeamObj = leagueState.domesticCupState.participatingTeams.find(t => t.idnum === m.homeId) || leagueState.teams.find(t => t.idnum === m.homeId);
                            const awayTeamObj = leagueState.domesticCupState.participatingTeams.find(t => t.idnum === m.awayId) || leagueState.teams.find(t => t.idnum === m.awayId);

                            return (
                              <div
                                key={m.id}
                                style={{
                                  background: isUserMatch ? 'rgba(255, 0, 85, 0.12)' : 'rgba(0, 0, 0, 0.35)',
                                  border: isUserMatch ? '1.5px solid #ff0055' : '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '5px'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: isUserMatch ? '#ff0055' : '#888', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                                  <span>{m.stageName || CUP_STAGE_NAMES[activeStg]}</span>
                                  <span>{m.played ? (m.penaltyHomeScore !== null ? 'PENALTIES' : 'FULL TIME') : 'UPCOMING'}</span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                    {homeTeamObj && <TeamFlag primaryColor={homeTeamObj.primaryColor} secondaryColor={homeTeamObj.secondaryColor} size={18} />}
                                    <span style={{ fontSize: '11.5px', fontWeight: m.homeId === leagueState.playerTeamId ? 'bold' : 'normal', color: m.homeId === leagueState.playerTeamId ? '#00ff64' : '#fff' }}>
                                      {m.homeName}
                                    </span>
                                  </div>

                                  <div style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', fontSize: '11.5px', fontWeight: 'bold', fontFamily: 'Orbitron', color: m.played ? '#ffd700' : '#666' }}>
                                    {m.played ? `${m.homeScore} - ${m.awayScore}` : 'VS'}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, justifyContent: 'flex-end' }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: m.awayId === leagueState.playerTeamId ? 'bold' : 'normal', color: m.awayId === leagueState.playerTeamId ? '#00ff64' : '#fff' }}>
                                      {m.awayName}
                                    </span>
                                    {awayTeamObj && <TeamFlag primaryColor={awayTeamObj.primaryColor} secondaryColor={awayTeamObj.secondaryColor} size={18} />}
                                  </div>
                                </div>

                                {m.played && m.penaltyHomeScore !== null && (
                                  <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#00e5ff', fontFamily: 'Orbitron', marginTop: '1px' }}>
                                    Pens: {m.penaltyHomeScore} - {m.penaltyAwayScore}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              (rules && rules.format !== "pure_knockout") ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 className="team-card-title" style={{ color: '#00e5ff', margin: '0' }}>
                      {isNorthAmerica
                        ? "CONCACAF CHAMPIONS CUP"
                        : isSouthAmerica
                          ? (europeanCup === "cl" ? "COPA LIBERTADORES" : "COPA SUDAMERICANA")
                          : (europeanCup === "cl"
                            ? "UEFA CHAMPIONS LEAGUE"
                            : (europeanCup === "uefa"
                              ? (parseInt(season.split("/")[0]) >= 2009 ? "UEFA EUROPA LEAGUE" : "UEFA CUP")
                              : "UEFA CONFERENCE LEAGUE"))}{" "}
                      {isLeagueStageCup ? "- LEAGUE STAGE" : `- GROUP ${clActiveGroup}`}
                    </h3>
                    {!isLeagueStageCup && activeGroupsList.length > 0 && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {activeGroupsList.map(g => (
                          <button
                            key={g}
                            onClick={() => setClActiveGroup(g)}
                            style={{
                              background: clActiveGroup === g ? '#00e5ff' : 'rgba(0,0,0,0.4)',
                              border: `1px solid ${clActiveGroup === g ? '#00e5ff' : 'rgba(255,255,255,0.1)'}`,
                              borderRadius: '4px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '11px',
                              padding: '4px 8px',
                              fontWeight: 'bold'
                            }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <table className="retro-standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textTransform: 'uppercase', fontSize: '10px', textAlign: 'center' }}>
                        <th style={{ padding: '8px 5px', textAlign: 'left' }}>Pos</th>
                        <th style={{ padding: '8px 5px', textAlign: 'left' }}>Team</th>
                        <th style={{ padding: '8px 5px' }}>P</th>
                        <th style={{ padding: '8px 5px' }}>W</th>
                        <th style={{ padding: '8px 5px' }}>D</th>
                        <th style={{ padding: '8px 5px' }}>L</th>
                        <th style={{ padding: '8px 5px' }}>GD</th>
                        <th style={{ padding: '8px 5px', color: '#00e5ff' }}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCLGroupStandings(clActiveGroup).map((team, index) => {
                        const isPlayer = Boolean(playerTeamObj && team.name === playerTeamObj.name);
                        return (
                          <tr
                            key={team.idnum}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              background: isPlayer ? 'rgba(0, 229, 255, 0.04)' : 'transparent',
                              color: isPlayer ? '#00e5ff' : '#fff',
                              fontWeight: isPlayer ? 'bold' : 'normal'
                            }}
                          >
                            <td style={{ padding: '10px 5px', textAlign: 'left', fontWeight: 'bold' }}>{index + 1}</td>
                            <td style={{ padding: '10px 5px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={28} />
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }} title={team.name}>
                                {team.name} {isPlayer && " (You)"}
                              </span>
                            </td>
                            <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.played}</td>
                            <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.won}</td>
                            <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.drawn}</td>
                            <td style={{ padding: '10px 5px', textAlign: 'center' }}>{team.lost}</td>
                            <td style={{ padding: '10px 5px', textAlign: 'center', color: (team.gf - team.ga) > 0 ? '#00ff64' : ((team.gf - team.ga) < 0 ? '#ff4500' : '#888') }}>
                              {(team.gf - team.ga) > 0 ? `+${team.gf - team.ga}` : (team.gf - team.ga)}
                            </td>
                            <td style={{ padding: '10px 5px', textAlign: 'center', color: isPlayer ? '#00e5ff' : '#ffd700', fontWeight: 'bold' }}>{team.points}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Brackets Summary if Knockout is active */}
                  {europeanCupState.knockoutState && (
                    europeanCupState.knockoutState.playoffsLeg1 ||
                    europeanCupState.knockoutState.roundOf16Leg1 ||
                    europeanCupState.knockoutState.quarterFinalsLeg1 ||
                    europeanCupState.knockoutState.semiFinalsLeg1 ||
                    europeanCupState.knockoutState.final
                  ) && (
                      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}>
                        <h3 className="team-card-title" style={{ color: '#00e5ff', fontSize: '13px', textAlign: 'left', marginBottom: '12px' }}>
                          ⭐ KNOCKOUT BRACKET STAGES
                        </h3>
                        {renderContinentalKnockoutBracket(europeanCupState, rules)}
                      </div>
                    )}
                </>
              ) : (
                // Knockout Bracket standings (UEFA Cup or 1990/91 Champions Cup)
                <>
                  <h3 className="team-card-title" style={{ color: '#00e5ff', marginBottom: '15px' }}>
                    🏆 {isNorthAmerica
                      ? "CONCACAF CHAMPIONS CUP"
                      : isSouthAmerica
                        ? (europeanCup === "cl" ? "COPA LIBERTADORES" : "COPA SUDAMERICANA")
                        : (europeanCup === "cl"
                          ? (parseInt(season.split("/")[0]) >= 1992 ? "CHAMPIONS LEAGUE" : "CHAMPIONS CUP")
                          : (europeanCup === "uefa"
                            ? (parseInt(season.split("/")[0]) >= 2009 ? "EUROPA LEAGUE" : "UEFA CUP")
                            : "CONFERENCE LEAGUE"))} - KNOCKOUT BRACKET
                  </h3>

                  {renderContinentalKnockoutBracket(europeanCupState, rules)}
                </>
              )
            )}
          </div>

          {/* Right Grid: Next Match Preview Board */}
          <div style={{ width: '40%', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

            {!isSeasonOver ? (
              leagueState?.isUnemployed ? (
                <div
                  className="glass-card next-match-panel animated-slide-in"
                  style={{
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    border: '1.5px solid #38bdf8',
                    boxShadow: '0 0 18px rgba(56, 189, 248, 0.16)'
                  }}
                >
                  <h3 className="team-card-title" style={{ color: '#38bdf8', fontSize: '15px', margin: 0 }}>
                    👔 UNEMPLOYED MANAGER DESK
                  </h3>
                  <p style={{ fontSize: '11.5px', color: '#bbb', textAlign: 'center', margin: 0, lineHeight: '1.45' }}>
                    You are currently a free agent watching Round {currentEvent?.index || currentRound} of {cap(country)}. Advance weeks to keep tracked world tables moving and watch new clubs sack managers.
                  </p>
                  <div className="stats-box" style={{ width: '92%', padding: '10px 14px', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Open Jobs: <strong style={{ color: '#ffd700' }}>{(leagueState?.worldState?.vacancies?.length || 0) + (leagueState?.worldState?.directOffers?.length || 0)}</strong></span>
                    <span>Prestige: <strong style={{ color: '#00ff64' }}>{calculateManagerPrestige(managerProfile)} PTS</strong></span>
                  </div>
                  <button
                    className="match-control-btn kickoff-theme-btn glowing-btn pulse"
                    style={{ width: '95%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', borderColor: '#38bdf8', color: '#08121c', fontWeight: 'bold' }}
                    onClick={handleAdvanceUnemployedWeek}
                  >
                    ⏩ ADVANCE 1 WEEK (SIM WORLD)
                  </button>
                  <button
                    className="match-control-btn"
                    style={{ width: '95%', fontSize: '11px', border: '1px solid rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.08)', color: '#38bdf8', cursor: 'pointer' }}
                    onClick={() => setOfficeTab("jobs")}
                  >
                    💼 BROWSE LIVE JOBS MARKET ({(leagueState?.worldState?.vacancies?.length || 0) + (leagueState?.worldState?.directOffers?.length || 0)})
                  </button>
                </div>
              ) : (
                <div
                  className="glass-card next-match-panel animated-slide-in"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '15px',
                    border: isEuropeanMatchNext ? '1.5px solid #00e5ff' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: isEuropeanMatchNext ? '0 0 15px rgba(0, 229, 255, 0.15)' : 'none'
                  }}
                >
                  {isEuropeanMatchNext ? (
                    <>
                      <h3 className="team-card-title" style={{ color: '#00e5ff', fontSize: '14px', letterSpacing: '1px', textShadow: '0 0 8px rgba(0, 229, 255, 0.4)' }}>
                        ⭐ {isNorthAmerica
                          ? "CONCACAF CHAMPIONS CUP"
                          : isSouthAmerica
                            ? (europeanCup === "cl" ? "COPA LIBERTADORES" : "COPA SUDAMERICANA NIGHT")
                            : (europeanCup === "cl"
                              ? "UEFA CHAMPIONS LEAGUE"
                              : (europeanCup === "uefa"
                                ? (parseInt(season.split("/")[0]) >= 2009 ? "UEFA EUROPA LEAGUE" : "UEFA CUP NIGHT")
                                : "UEFA CONFERENCE LEAGUE NIGHT"))}
                      </h3>

                      {(isRestWeek || !clPlayerFixture || !europeanOpponent) ? (
                        <div style={{ margin: '15px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(() => {
                            const isEuroOut = Boolean(getPlayerCupStatus(leagueState, isSouthAmerica)?.isEliminated);
                            return (
                              <>
                                <span style={{ fontSize: '32px' }}>{isEuroOut ? '❌' : '💤'}</span>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                                  {isEuroOut ? 'ELIMINATED FROM COMPETITION' : 'REST WEEK - SQUAD RESTED'}
                                </span>
                                <span style={{ fontSize: '11px', color: '#aaa', padding: '0 15px', lineHeight: '1.4' }}>
                                  {isEuroOut
                                    ? 'Your team was eliminated in a previous round. Click below to simulate this stage and view the results.'
                                    : 'Your team does not have a fixture in this continental stage. Click below to simulate the midweek matches.'}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="versus-preview" style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center', margin: '10px 0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '45%' }}>
                            <TeamFlag primaryColor={europeanIsHome ? playerTeamObj.primaryColor : europeanOpponent.primaryColor} secondaryColor={europeanIsHome ? playerTeamObj.secondaryColor : europeanOpponent.secondaryColor} size={80} />
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{europeanIsHome ? playerTeamObj.name : europeanOpponent.name}</span>
                            <span style={{ fontSize: '9px', color: '#888' }}>{europeanIsHome ? "HOME" : "AWAY"}</span>
                          </div>

                          <div style={{ fontFamily: 'Orbitron', fontWeight: 'bold', fontSize: '16px', color: '#00e5ff' }}>VS</div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '45%' }}>
                            <TeamFlag primaryColor={europeanIsHome ? europeanOpponent.primaryColor : playerTeamObj.primaryColor} secondaryColor={europeanIsHome ? europeanOpponent.secondaryColor : playerTeamObj.secondaryColor} size={80} />
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{europeanIsHome ? europeanOpponent.name : playerTeamObj.name}</span>
                            <span style={{ fontSize: '9px', color: '#888' }}>{europeanIsHome ? "AWAY" : "HOME"}</span>
                          </div>
                        </div>
                      )}

                      {(!isRestWeek && clPlayerFixture && europeanOpponent) && (() => {
                        const playerCupTeam = europeanCupState?.teams?.find(t => t.idnum === europeanCupState?.europeanPlayerTeamId);
                        const clGroupStandings = (isEuropeanGroupStageNext && playerCupTeam?.group && typeof getCLGroupStandings === 'function')
                          ? getCLGroupStandings(playerCupTeam.group)
                          : (rules?.format === "league_then_knockout" && typeof getCLGroupStandings === 'function' ? getCLGroupStandings(null) : []);
                        const pCupRank = clGroupStandings?.length ? clGroupStandings.findIndex(t => t.idnum === playerCupTeam?.idnum) + 1 : 0;
                        const oppCupRank = clGroupStandings?.length ? clGroupStandings.findIndex(t => t.idnum === europeanOpponent?.idnum) + 1 : 0;
                        const euroHomePos = europeanIsHome ? pCupRank : oppCupRank;
                        const euroAwayPos = europeanIsHome ? oppCupRank : pCupRank;
                        const isSwissLeague = rules?.format === "league_then_knockout";
                        const euroTableLabel = isSwissLeague ? "LEAGUE PHASE" : (playerCupTeam?.group ? `GROUP ${playerCupTeam.group} TABLE` : "TABLE POSITION");

                        return (
                          <div className="stats-box" style={{ width: '90%', padding: '12px 16px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', alignItems: 'center', textAlign: 'center', width: '100%' }}>
                              {isEuropeanGroupStageNext && euroHomePos > 0 && euroAwayPos > 0 ? (
                                <>
                                  <span style={{ textAlign: 'left', fontWeight: 'bold', color: '#00e5ff', fontSize: '15px', fontFamily: 'Orbitron' }}>
                                    {`${formatOrdinal(euroHomePos)} Place`}
                                  </span>
                                  <span style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                                    {euroTableLabel}
                                  </span>
                                  <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#00e5ff', fontSize: '15px', fontFamily: 'Orbitron' }}>
                                    {`${formatOrdinal(euroAwayPos)} Place`}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span style={{ textAlign: 'left', fontWeight: 'bold', color: '#00e5ff', fontSize: '13px', fontFamily: 'Orbitron' }}>
                                    KNOCKOUT
                                  </span>
                                  <span style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                                    {currentEvent?.stage ? currentEvent.stage.toUpperCase().replace(/_/g, " ") : "KNOCKOUT MATCH"}
                                  </span>
                                  <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#00e5ff', fontSize: '13px', fontFamily: 'Orbitron' }}>
                                    KNOCKOUT
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {(isRestWeek || !clPlayerFixture || !europeanOpponent) ? (
                        <button
                          className="match-control-btn kickoff-theme-btn glowing-btn pulse"
                          style={{ width: '95%', background: 'linear-gradient(135deg, #0091ff, #00e5ff)', borderColor: '#00e5ff' }}
                          onClick={handleSimulateRound}
                        >
                          SIMULATE MIDWEEK ROUND ➔
                        </button>
                      ) : (
                        <div style={{ display: 'flex', width: '95%', gap: '10px', justifyContent: 'center' }}>
                          <button
                            className="match-control-btn kickoff-theme-btn glowing-btn pulse"
                            style={{ flex: 1, background: 'linear-gradient(135deg, #0091ff, #00e5ff)', borderColor: '#00e5ff' }}
                            onClick={handleKickOff}
                          >
                            {isSouthAmerica ? "ENTER CONTINENTAL STAGE ➔" : "ENTER EUROPEAN STAGE ➔"}
                          </button>
                          <button
                            className="match-control-btn"
                            style={{ width: '35%', fontSize: '11px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)', color: '#aaa', cursor: 'pointer' }}
                            onClick={handleSimulateRound}
                          >
                            SIM ROUND
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <h3 className="team-card-title" style={{ color: isEuropeanQualifierNext ? '#ffd700' : (isDomesticCupNext ? '#ff0055' : '#00ff64') }}>
                        {isEuropeanQualifierNext
                          ? `🏆 ${leagueState?.europeanQualifierState?.competitionLabel || 'UEFA'} 3RD QUALIFYING ROUND (LEG ${currentEvent.leg}/2)`
                          : (isDomesticCupNext ? `🥊 ${leagueState?.domesticCupState?.cupName?.toUpperCase() || 'DOMESTIC CUP'} MATCH` : "NEXT MATCH FIXTURE")}
                      </h3>

                      {(!playerFixture || !opponentTeamObj) ? (
                        <div style={{ margin: '15px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontSize: '32px' }}>{isDomesticCupEliminated ? '❌' : '🥊'}</span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                            {isDomesticCupNext
                              ? (isDomesticCupEliminated ? "ELIMINATED FROM CUP" : "REST / NEUTRAL CUP ROUND")
                              : "NO UPCOMING FIXTURE"}
                          </span>
                          <span style={{ fontSize: '11px', color: '#aaa', padding: '0 15px', lineHeight: '1.4' }}>
                            {isDomesticCupNext
                              ? (isDomesticCupEliminated
                                ? "You were eliminated in an earlier round. Click below to simulate this cup round and view the results."
                                : "Your team has no match in this stage. Click below to simulate the round.")
                              : "No upcoming match scheduled."}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="versus-preview" style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center', margin: '10px 0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '45%' }}>
                              <TeamFlag primaryColor={isHome ? playerTeamObj.primaryColor : opponentTeamObj.primaryColor} secondaryColor={isHome ? playerTeamObj.secondaryColor : opponentTeamObj.secondaryColor} size={80} />
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{isHome ? playerTeamObj.name : opponentTeamObj.name}</span>
                              <span style={{ fontSize: '9px', color: '#888' }}>{isHome ? "HOME" : "AWAY"}</span>
                            </div>

                            <div style={{ fontFamily: 'Orbitron', fontWeight: 'bold', fontSize: '16px', color: isEuropeanQualifierNext ? '#ffd700' : (isDomesticCupNext ? '#ff0055' : '#ff4500') }}>VS</div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', width: '45%' }}>
                              <TeamFlag primaryColor={isHome ? opponentTeamObj.primaryColor : playerTeamObj.primaryColor} secondaryColor={isHome ? opponentTeamObj.secondaryColor : playerTeamObj.secondaryColor} size={80} />
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>{isHome ? opponentTeamObj.name : playerTeamObj.name}</span>
                              <span style={{ fontSize: '9px', color: '#888' }}>{isHome ? "AWAY" : "HOME"}</span>
                            </div>
                          </div>

                          {isEuropeanQualifierNext ? (
                            <div className="stats-box" style={{ width: '90%', padding: '10px 14px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#ffd700', fontWeight: 'bold', fontFamily: 'Orbitron', letterSpacing: '0.5px' }}>
                                {currentEvent.leg === 2
                                  ? `LEG 1: ${playerTeamObj.name} ${leagueState.europeanQualifierState.leg1HomeScore} - ${leagueState.europeanQualifierState.leg1AwayScore} ${opponentTeamObj.name}`
                                  : `WINNER ENTERS GROUP / LEAGUE STAGE (REPLACES ${opponentTeamObj.name.toUpperCase()})`}
                              </span>
                              <span style={{ color: '#9aa', fontSize: '10px' }}>
                                {parseInt((season || '2001').split('/')[0], 10) < 2021
                                  ? '2-Leg Aggregate (Away Goals Rule Active • ET & Penalties if Tied)'
                                  : '2-Leg Aggregate (No Away Goals • ET & Penalties if Tied)'}
                              </span>
                            </div>
                          ) : (() => {
                            const oppPosition = opponentTeamObj ? (standings.findIndex(t => t.idnum === opponentTeamObj.idnum || t.name === opponentTeamObj.name) + 1) : 0;
                            const homeTablePos = isHome ? playerPosition : (oppPosition > 0 ? oppPosition : null);
                            const awayTablePos = isHome ? (oppPosition > 0 ? oppPosition : null) : playerPosition;

                            return (
                              <div className="stats-box" style={{ width: '90%', padding: '12px 16px', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', alignItems: 'center', textAlign: 'center', width: '100%' }}>
                                  <span style={{ textAlign: 'left', fontWeight: 'bold', color: '#ffd700', fontSize: '15px', fontFamily: 'Orbitron' }}>
                                    {homeTablePos ? `${formatOrdinal(homeTablePos)} Place` : "—"}
                                  </span>
                                  <span style={{ color: '#888', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                                    {isDomesticCupNext ? "LEAGUE POSITION" : "TABLE POSITION"}
                                  </span>
                                  <span style={{ textAlign: 'right', fontWeight: 'bold', color: '#ffd700', fontSize: '15px', fontFamily: 'Orbitron' }}>
                                    {awayTablePos ? `${formatOrdinal(awayTablePos)} Place` : "—"}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {(!playerFixture || !opponentTeamObj) ? (
                        <button
                          className="match-control-btn kickoff-theme-btn glowing-btn pulse"
                          style={{ width: '95%', background: isDomesticCupNext ? 'linear-gradient(135deg, #ff0055, #ff4081)' : undefined, borderColor: isDomesticCupNext ? '#ff0055' : undefined }}
                          onClick={handleSimulateRound}
                        >
                          {isDomesticCupNext ? "SIMULATE CUP ROUND ➔" : "SIMULATE ROUND ➔"}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', width: '95%', gap: '10px', justifyContent: 'center' }}>
                          <button
                            className="match-control-btn kickoff-theme-btn glowing-btn pulse"
                            style={{
                              flex: 1,
                              background: isEuropeanQualifierNext
                                ? 'linear-gradient(135deg, #ffb300, #ffd700)'
                                : (isDomesticCupNext ? 'linear-gradient(135deg, #ff0055, #ff4081)' : undefined),
                              borderColor: isEuropeanQualifierNext ? '#ffd700' : (isDomesticCupNext ? '#ff0055' : undefined),
                              color: isEuropeanQualifierNext ? '#121217' : undefined
                            }}
                            onClick={handleKickOff}
                          >
                            {isEuropeanQualifierNext
                              ? `PLAY QUALIFIER LEG ${currentEvent.leg} ➔`
                              : (isDomesticCupNext ? `PLAY CUP MATCH ➔` : `PLAY ROUND ${currentEvent.index}`)}
                          </button>
                          <button
                            className="match-control-btn"
                            style={{ width: '35%', fontSize: '11px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)', color: '#aaa', cursor: 'pointer' }}
                            onClick={handleSimulateRound}
                          >
                            {isEuropeanQualifierNext ? "SIM LEG" : "SIM ROUND"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            ) : (
              (() => {
                const verdict = getBoardVerdict(playerPosition, finalExpectation);
                return (
                  <div className="glass-card season-over-panel animated-slide-in" style={{
                    padding: '25px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '15px',
                    border: `2px solid ${verdict.color}`,
                    boxShadow: `0 0 20px ${verdict.color}33`,
                    maxHeight: '520px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '40px' }}>{playerPosition === 1 ? "🏆" : (verdict.tier === "disgraced" ? "💼❌" : "💼📋")}</div>

                    <h3 className="team-card-title" style={{ color: verdict.color, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0' }}>
                      {verdict.title}
                    </h3>

                    <div style={{
                      background: 'rgba(0,0,0,0.5)',
                      border: `1px solid ${verdict.color}33`,
                      borderRadius: '8px',
                      padding: '12px 15px',
                      color: '#fff',
                      fontSize: '12px',
                      lineHeight: '1.4',
                      textAlign: 'center',
                      width: '90%'
                    }}>
                      {verdict.verdict}
                    </div>

                    {!leagueState?.isUnemployed && playerTeamObj && (
                      <div className="stats-box" style={{ width: '90%', padding: '8px 12px', gap: '3px', fontSize: '11.5px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>
                          Pos {playerPosition} | Pts {playerTeamObj.points} | GD {playerTeamObj.gf - playerTeamObj.ga}
                        </div>
                      </div>
                    )}

                    {verdict.tier === "disgraced" ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '95%', alignItems: 'center' }}>
                        <span style={{ color: '#ff3333', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>
                          GAME OVER - BLACKLISTED BY ALL PROFESSIONAL CLUBS!
                        </span>
                        <button
                          className="play-match-btn glowing-btn"
                          style={{ fontSize: '13px', padding: '10px 20px', width: '100%', borderColor: verdict.color, color: verdict.color }}
                          onClick={handleResetCareer}
                        >
                          RETIRE & START NEW CAREER
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', marginTop: '10px' }}>

                        {!leagueState?.isUnemployed && playerTeamObj && (
                          <div style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '10px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#aaa', fontWeight: 'bold' }}>CURRENT CLUB CONTRACT</span>
                              <span style={{
                                fontSize: '9px',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                background: (verdict.tier !== "decent_sacked" && seasonRolloverMeta?.canRenew !== false) ? 'rgba(0, 255, 100, 0.1)' : 'rgba(255, 51, 81, 0.1)',
                                color: (verdict.tier !== "decent_sacked" && seasonRolloverMeta?.canRenew !== false) ? '#00ff64' : '#ff3333'
                              }}>
                                {seasonRolloverMeta?.canRenew === false ? "LEAGUE EXIT" : (verdict.tier !== "decent_sacked" ? "OFFERED" : "SACKED")}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <TeamFlag primaryColor={playerTeamObj.primaryColor} secondaryColor={playerTeamObj.secondaryColor} size={30} />
                              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{playerTeamObj.name}</span>
                                <span style={{ fontSize: '10px', color: '#888' }}>Expectation: {finalExpectation.text}</span>
                              </div>
                            </div>

                            {verdict.tier !== "decent_sacked" && seasonRolloverMeta?.canRenew !== false ? (
                              <button
                                className="play-match-btn glowing-btn pulse"
                                style={{
                                  fontSize: '11px',
                                  padding: '8px',
                                  width: '100%',
                                  borderColor: '#00ff64',
                                  color: '#00ff64',
                                  background: 'rgba(0, 255, 100, 0.03)'
                                }}
                                onClick={() => {
                                  handleSignContract(playerTeamId);
                                }}
                              >
                                ⚽ STAY & RENEW CONTRACT
                              </button>
                            ) : (
                              <button
                                className="play-match-btn"
                                disabled
                                style={{
                                  fontSize: '11px',
                                  padding: '8px',
                                  width: '100%',
                                  borderColor: 'rgba(255,255,255,0.05)',
                                  color: '#666',
                                  background: 'rgba(0,0,0,0.2)',
                                  cursor: 'not-allowed'
                                }}
                              >
                                {seasonRolloverMeta?.canRenew === false ? "⚠️ CLUB DEPARTED LEAGUE" : "🔒 CONTRACT TERMINATED"}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Job Offers Grid */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <h4 style={{
                            fontSize: '11px',
                            color: '#00e5ff',
                            fontWeight: 'bold',
                            margin: '0',
                            textAlign: 'left',
                            fontFamily: 'Orbitron',
                            letterSpacing: '1px'
                          }}>
                            💼 INCOMING JOB OFFERS ({jobOffers.length})
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                            {jobOffers.map((offer) => (
                              <div key={offer.idnum} style={{
                                background: 'rgba(0,0,0,0.4)',
                                border: '1px solid rgba(0, 229, 255, 0.1)',
                                borderRadius: '8px',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TeamFlag primaryColor={offer.primaryColor} secondaryColor={offer.secondaryColor} size={25} />
                                    <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {offer.name} <CountryFlag country={offer.country} size={18} />
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '9px', color: '#888' }}>
                                    ATT {offer.attack} | MID {offer.midfield} | DEF {offer.defense}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '9.5px', color: '#aaa', textAlign: 'left' }}>
                                    Expectation: {offer.expectation.text}
                                  </span>
                                  <button
                                    className="play-match-btn glowing-btn"
                                    style={{
                                      fontSize: '9.5px',
                                      padding: '4px 10px',
                                      borderColor: '#00e5ff',
                                      color: '#00e5ff',
                                      background: 'rgba(0, 229, 255, 0.02)'
                                    }}
                                    onClick={() => handleSignContract(offer.idnum)}
                                  >
                                    SIGN CONTRACT ➔
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Quit Career option */}
                        <button
                          className="play-match-btn"
                          style={{ fontSize: '11px', padding: '8px', width: '100%', borderColor: '#ff4500', color: '#ff4500', background: 'transparent' }}
                          onClick={handleResetCareer}
                        >
                          ❌ RETIRE & RESET CAREER
                        </button>

                      </div>
                    )}
                  </div>
                );
              })()
            )}


          </div>

        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button className="back-home-btn" onClick={handleResetCareer}>➔ END CAREER & MAIN CABINET</button>
      </div>

      {/* Sleek Glassmorphic Manager Profile Modal */}
      {showProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          zIndex: 2000,
          padding: '20px 0'
        }}>
          <div className="glass-card animated-slide-in" style={{
            width: '90%',
            maxWidth: '450px',
            background: 'linear-gradient(135deg, rgba(22, 22, 28, 0.98), rgba(12, 12, 16, 0.99))',
            border: '2px solid rgba(255, 215, 0, 0.15)',
            borderRadius: '16px',
            padding: '25px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.7), 0 0 25px rgba(255,215,0,0.08)',
            margin: 'auto'
          }}>
            <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#ffd700', fontFamily: 'Orbitron', letterSpacing: '2px' }}>👔 MANAGER PROFILE</h2>

            {/* Manager Photo Upload & Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '180px',
                height: '180px',
                borderRadius: 0,
                border: '2.5px solid #00ff64',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)',
                position: 'relative',
                boxShadow: '0 0 15px rgba(0,255,100,0.2)'
              }}>
                {(editPhoto || managerProfile?.photo) ? (
                  <img src={editPhoto || managerProfile?.photo} alt="Manager Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '68px' }}>👔</span>
                )}
              </div>

              <label className="glowing-btn" style={{
                padding: '4px 10px',
                fontSize: '10px',
                cursor: 'pointer',
                borderColor: '#00ff64',
                color: '#00ff64',
                background: 'rgba(0, 255, 100, 0.05)',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}>
                📷 UPLOAD PHOTO
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Manager Reputation Badge */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,215,0,0.04)',
              border: '1px solid rgba(255,215,0,0.25)',
              borderRadius: '10px',
              padding: '8px 15px',
              width: '90%',
              textAlign: 'center',
              boxShadow: 'inset 0 0 10px rgba(255,215,0,0.05)'
            }}>
              <span style={{ fontSize: '9px', color: '#ffd700', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Manager Reputation</span>
              {(() => {
                const lvl = getManagerLevelProgress(managerProfile);
                return (
                  <>
                    <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron', marginTop: '2px' }}>
                      {lvl.prestige.toLocaleString()} PTS
                    </span>
                    <span style={{ fontSize: '9.5px', color: lvl.color, fontWeight: 'bold', marginTop: '2px' }}>
                      {lvl.icon} {lvl.label}
                    </span>
                    {lvl.nextThreshold != null && (
                      <span style={{ fontSize: '8.5px', color: '#aaa', marginTop: '3px' }}>
                        {lvl.pointsToNext.toLocaleString()} PTS to next level ({lvl.nextThreshold.toLocaleString()} PTS)
                      </span>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Name Editor Box */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>Edit Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(0,255,100,0.3)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  textAlign: 'center',
                  fontFamily: 'sans-serif',
                  fontWeight: 'bold'
                }}
                maxLength={20}
              />
            </div>

            {/* Nationality Editor Box */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>Nationality</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '26px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  {editNationality ? <NationFlag nation={editNationality} size={22} /> : <span style={{ fontSize: '14px' }}>🏳️</span>}
                </div>
                <select
                  value={editNationality}
                  onChange={(e) => setEditNationality(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.65)',
                    border: '1px solid rgba(0,229,255,0.3)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: '12.5px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Nationality --</option>
                  {NATIONALITIES.map((nat) => (
                    <option key={nat.code} value={nat.code}>
                      {nat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Lifetime Statistics Feed */}
            <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px' }}>
              <h4 style={{ color: '#00e5ff', margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>👔 CAREER LIFETIME STATISTICS</h4>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                fontSize: '11px',
                color: '#aaa',
                marginBottom: '10px'
              }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>{managerProfile.seasons}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Seasons Played</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron' }}>{managerProfile.leagueTitles}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>League Titles 🏆</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron' }}>{managerProfile.cupTitles}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Cup Titles ⭐</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>
                    {managerProfile.wins + managerProfile.draws + managerProfile.losses}
                  </span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Matches Played</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron' }}>{managerProfile.monthlyAwards || 0}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Monthly Awards 🎖️</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#ff0055', fontFamily: 'Orbitron' }}>{managerProfile.managerOfTheYear || 0}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>Manager of Year 👑</span>
                </div>
              </div>

              {/* Match Stats Grid */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                background: 'rgba(0,0,0,0.4)',
                padding: '12px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                border: '1px solid rgba(255,255,255,0.03)',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#00ff64', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.wins}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Wins</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.draws}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Draws</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#ff3333', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.losses}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Losses</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ color: '#00e5ff', fontWeight: 'bold', fontSize: '13px' }}>{managerProfile.points}</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>Points</span>
                </div>
              </div>
            </div>

            {/* Year-by-Year Career History Feed */}
            <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ color: '#ffd700', margin: '0 0 5px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center', fontFamily: 'Orbitron' }}>📜 CAREER HISTORY</h4>
              <div className="career-history-scroll" style={{
                maxHeight: '120px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px',
                width: '100%'
              }}>
                {(!managerProfile.history || managerProfile.history.length === 0) ? (
                  <span style={{ fontSize: '10px', color: '#666', textAlign: 'center', display: 'block', fontStyle: 'italic', padding: '10px 0' }}>
                    No history recorded yet. Complete seasons to build your legacy!
                  </span>
                ) : (
                  [...managerProfile.history].reverse().map((h, index) => (
                    <div key={index} style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '10.5px',
                      color: '#ccc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      textAlign: 'left'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span style={{ color: '#00e5ff' }}>📅 {h.season} - {h.team}</span>
                        <span style={{ display: 'flex', gap: '3px' }}>
                          {h.leagueTitle > 0 && <span title="League Champion" style={{ color: '#ffd700' }}>🏆</span>}
                          {h.cupTitle > 0 && <span title="Cup Winner" style={{ color: '#00ff64' }}>⭐</span>}
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#aaa' }}>
                        Matches Played: <strong style={{ color: '#fff' }}>{h.played}</strong> | Won: <strong style={{ color: '#00ff64' }}>{h.won}</strong> | Draw: <strong style={{ color: '#ffd700' }}>{h.drawn}</strong> | Lost: <strong style={{ color: '#ff3333' }}>{h.lost}</strong> | Points: <strong style={{ color: '#00e5ff' }}>{h.points}</strong>
                      </div>
                      <div style={{ fontSize: '9px', color: '#888', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Domestic League Title: <strong>{h.leagueTitle}</strong></span>
                        <span>Int'l / European Cup: <strong>{h.cupTitle}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              className="play-match-btn glowing-btn"
              style={{ width: '100%', marginTop: '5px', borderColor: '#ffd700', color: '#ffd700', padding: '10px 15px', fontSize: '13px' }}
              onClick={handleSaveProfile}
            >
              SAVE & CLOSE PROFILE
            </button>

            {/* Exit/Cancel Button */}
            <button
              type="button"
              className="play-match-btn"
              style={{
                width: '100%',
                marginTop: '10px',
                borderColor: '#ff4500',
                color: '#ff4500',
                background: 'transparent',
                padding: '10px 15px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={handleCancelProfile}
            >
              EXIT WITHOUT SAVING
            </button>
          </div>
        </div>
      )}

      <RoundResultsModal
        isOpen={resultsModalOpen}
        fixtures={resultsModalFixtures}
        teams={resultsModalTheme === "#00e5ff"
          ? leagueState?.europeanCupState?.teams
          : resultsModalTheme === "#ff0055"
            ? [
              ...(leagueState?.domesticCupState?.participatingTeams || []),
              ...(leagueState?.teams || [])
            ]
            : [
              ...(leagueState?.teams || []),
              ...(leagueState?.europeanQualifierState?.opponent ? [leagueState.europeanQualifierState.opponent] : [])
            ]}
        playerTeamId={resultsModalTheme === "#00e5ff" ? leagueState?.europeanCupState?.europeanPlayerTeamId : leagueState?.playerTeamId}
        roundTitle={resultsModalTitle}
        themeColor={resultsModalTheme}
        onClose={() => setResultsModalOpen(false)}
      />

      <FormationTacticsModal
        isOpen={showFormationModal}
        mode="career"
        onClose={() => {
          setShowFormationModal(false);
          reloadLeagueState();
        }}
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          reloadLeagueState();
        }}
        leagueState={leagueState}
        setLeagueState={setLeagueState}
        managerProfile={managerProfile}
      />
    </div>
  );
}
