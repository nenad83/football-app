// Utility managing tracked world league tables, persistent AI managers,
// live mid-season job vacancies/approaches, immediate takeovers, and Unemployed mode.

import { leagueDataMap, leagueDataMapD2 } from '../data/leagueData';
import { leagueDataMapSA } from '../data/leagueDataSA';
import { leagueDataMapNA } from '../data/leagueDataNA';
import {
  scaleStatTo10,
  getTeamDetailsSync,
  loadSeasonRosters,
  getPrebuiltRoster,
  calculateSquadTacticalAverages
} from '../data/rosters/rosterRegistry';
import { simulateFixture } from './matchEngine';
import { calculateBoardExpectation } from './boardExpectationEngine';
import {
  createDomesticCup,
  advanceDomesticCup,
  getDomesticCupExpectation,
  CUP_STAGE_NAMES
} from './domesticCupGenerator';
import {
  calculateManagerPrestige,
  finalizeStintAndSeasonToProfile
} from './managerProgression';
import { HISTORICAL_FEDERATION_COUNTRIES, getClubSplitDestination } from './exYugoslaviaRollover';
import { appendAndPruneNews } from './newsGenerator';

export const SA_COUNTRIES = new Set(['argentina', 'brazil', 'colombia']);
export const NA_COUNTRIES = new Set(['usa', 'mexico']);
export const BIG5_EUROPE = ['england', 'spain', 'italy', 'germany', 'france'];
export const CORE_EUROPE_TRACKED = [
  ['england', 1], ['england', 2],
  ['spain', 1], ['spain', 2],
  ['germany', 1], ['germany', 2],
  ['italy', 1], ['italy', 2],
  ['france', 1],
  ['portugal', 1],
  ['netherlands', 1],
  ['belgium', 1]
];

// Country manager name pools for generating persistent AI managers when JSON clubs have none.
const MANAGER_NAME_POOLS = {
  england: {
    first: ['Arthur', 'Graham', 'Brian', 'Trevor', 'Alan', 'Roy', 'Harry', 'Stuart', 'Keith', 'Martin', 'Gareth', 'Eddie'],
    last: ['Wilkinson', 'Atkinson', 'Robson', 'Pardew', 'Allardyce', 'Redknapp', 'Hoddle', 'Pearson', 'Dyche', 'Southgate', 'Howe', 'Cooper']
  },
  spain: {
    first: ['Luis', 'Javier', 'Vicente', 'Ernesto', 'Manolo', 'Miguel', 'Joaquin', 'Quique', 'Paco', 'Unai', 'Julen', 'Imanol'],
    last: ['Aragones', 'Del Bosque', 'Valverde', 'Irureta', 'Caparros', 'Lotina', 'Flores', 'Mendilibar', 'Emery', 'Alguacil', 'Michel', 'Bordalas']
  },
  italy: {
    first: ['Arrigo', 'Fabio', 'Marcello', 'Carlo', 'Claudio', 'Roberto', 'Luciano', 'Alberto', 'Gian Piero', 'Stefano', 'Massimiliano', 'Simone'],
    last: ['Sacchi', 'Capello', 'Lippi', 'Ancelotti', 'Ranieri', 'Mancini', 'Spalletti', 'Zaccheroni', 'Gasperini', 'Pioli', 'Allegri', 'Inzaghi']
  },
  germany: {
    first: ['Ottmar', 'Jupp', 'Otto', 'Christoph', 'Felix', 'Ralf', 'Thomas', 'Juergen', 'Hansi', 'Julian', 'Marco', 'Dieter'],
    last: ['Hitzfeld', 'Heynckes', 'Rehhagel', 'Daum', 'Magath', 'Rangnick', 'Schaaf', 'Klopp', 'Flick', 'Nagelsmann', 'Rose', 'Hecking']
  },
  france: {
    first: ['Aime', 'Guy', 'Jean', 'Gerard', 'Didier', 'Laurent', 'Claude', 'Christophe', 'Rudi', 'Bruno', 'Antoine', 'Franck'],
    last: ['Jacquet', 'Roux', 'Tigana', 'Houllier', 'Deschamps', 'Blanc', 'Puel', 'Galtier', 'Garcia', 'Genesio', 'Kombouare', 'Haise']
  },
  netherlands: {
    first: ['Rinus', 'Louis', 'Guus', 'Dick', 'Bert', 'Frank', 'Ronald', 'Co', 'Aad', 'Peter', 'Arne', 'Erik'],
    last: ['Michels', 'Van Gaal', 'Hiddink', 'Advocaat', 'Van Marwijk', 'Rijkaard', 'Koeman', 'Adriaanse', 'De Mos', 'Bosz', 'Slot', 'Ten Hag']
  },
  portugal: {
    first: ['Artur', 'Toni', 'Manuel', 'Carlos', 'Jose', 'Fernando', 'Jesualdo', 'Andre', 'Sergio', 'Ruben', 'Paulo', 'Nuno'],
    last: ['Jorge', 'Oliveira', 'Cajuda', 'Queiroz', 'Mourinho', 'Santos', 'Ferreira', 'Villas-Boas', 'Conceicao', 'Amorim', 'Fonseca', 'Espirito Santo']
  },
  scotland: {
    first: ['Walter', 'Jock', 'Alex', 'Jim', 'Tommy', 'Craig', 'Gordon', 'Ally', 'Derek', 'Neil', 'Steve', 'David'],
    last: ['Smith', 'Stein', 'McLeish', 'McLean', 'Burns', 'Levein', 'Strachan', 'McCoist', 'McInnes', 'Lennon', 'Clarke', 'Moyes']
  },
  belgium: {
    first: ['Raymond', 'Guy', 'Georges', 'Eric', 'Paul', 'Marc', 'Hein', 'Michel', 'Philippe', 'Felice', 'Wouter', 'Karel'],
    last: ['Goethals', 'Thys', 'Leekens', 'Gerets', 'Van Himst', 'Wilmots', 'Vanhaezebrouck', 'Preudhomme', 'Clement', 'Mazzu', 'Vrancken', 'Geraerts']
  },
  ukraine: {
    first: ['Valeriy', 'Myron', 'Oleh', 'Serhiy', 'Yuriy', 'Oleksandr', 'Viktor', 'Roman', 'Ruslan', 'Ihor', 'Pavlo', 'Andriy'],
    last: ['Lobanovskyi', 'Markevych', 'Blokhin', 'Rebrov', 'Vernydub', 'Shovkovskyi', 'Skrypnyk', 'Hryhorchuk', 'Rotan', 'Kostiuk', 'Yakovenko', 'Shevchenko']
  },
  yugoslavia: {
    first: ['Miljan', 'Ivica', 'Vujadin', 'Tomislav', 'Branko', 'Ljupko', 'Ante', 'Dragoslav', 'Ilija', 'Slobodan', 'Miroslav', 'Josip'],
    last: ['Miljanic', 'Osim', 'Boskov', 'Ivic', 'Stankovic', 'Petrovic', 'Mladinic', 'Sekularac', 'Petkovic', 'Santrac', 'Blazevic', 'Skoblar']
  },
  fr_yugoslavia: {
    first: ['Ljubisa', 'Slavoljub', 'Ilija', 'Milovan', 'Zoran', 'Dragoslav', 'Milorad', 'Miodrag', 'Vladimir', 'Radmilo', 'Sima', 'Dejan'],
    last: ['Tumbakovic', 'Muslin', 'Petkovic', 'Djoric', 'Filipovic', 'Stepanovic', 'Kosanovic', 'Jesic', 'Petrovic', 'Ivancevic', 'Krunic', 'Svilar']
  },
  serbia: {
    first: ['Radomir', 'Vladan', 'Aleksandar', 'Marko', 'Dejan', 'Dragan', 'Mladen', 'Ljubisa', 'Savo', 'Nenad', 'Miroslav', 'Veljko'],
    last: ['Antic', 'Milojevic', 'Stanojevic', 'Nikolic', 'Stankovic', 'Stojkovic', 'Krstajic', 'Tumbakovic', 'Milosevic', 'Lalatovic', 'Djukic', 'Paunovic']
  },
  croatia: {
    first: ['Miroslav', 'Tomislav', 'Otto', 'Zlatko', 'Slaven', 'Branko', 'Igor', 'Matjaz', 'Sergej', 'Nenad', 'Zoran', 'Ante'],
    last: ['Blazevic', 'Ivic', 'Baric', 'Kranjcar', 'Bilic', 'Ivankovic', 'Stimac', 'Kek', 'Jakirovic', 'Bjelica', 'Vulic', 'Cacic']
  },
  ussr: {
    first: ['Valeriy', 'Konstantin', 'Oleg', 'Pavel', 'Eduard', 'Anatoly', 'Nodar', 'Yevhen', 'Nikolai', 'Yuri', 'Nikita', 'Boris'],
    last: ['Lobanovskyi', 'Beskov', 'Romantsev', 'Sadyrin', 'Malofeyev', 'Byshovets', 'Akhalkatsi', 'Kucherevskyi', 'Morozov', 'Semin', 'Simonyan', 'Ignatyev']
  },
  russia: {
    first: ['Oleg', 'Yuri', 'Valery', 'Gurban', 'Leonid', 'Stanislav', 'Sergei', 'Dmitri', 'Vadim', 'Vladimir', 'Igor', 'Mikhail'],
    last: ['Romantsev', 'Semin', 'Gazzaev', 'Berdyev', 'Slutsky', 'Cherchesov', 'Semak', 'Alenichev', 'Evseev', 'Fedotov', 'Cherevchenko', 'Galaktionov']
  },
  sweden: {
    first: ['Sven', 'Lars', 'Tommy', 'Hans', 'Janne', 'Erik', 'Henrik', 'Mikael', 'Olof', 'Per', 'Magnus', 'Kim'],
    last: ['Eriksson', 'Lagerback', 'Soderberg', 'Backe', 'Andersson', 'Hamren', 'Rydstrom', 'Stahre', 'Mellberg', 'Olsson', 'Haglund', 'Hellberg']
  },
  denmark: {
    first: ['Richard', 'Sepp', 'Morten', 'Bo', 'Michael', 'Brian', 'Kasper', 'Kent', 'Jess', 'Thomas', 'Jacob', 'Lars'],
    last: ['Nielsen', 'Piontek', 'Olsen', 'Johansson', 'Laudrup', 'Priske', 'Hjulmand', 'Nielsen', 'Thorup', 'Frank', 'Neestrup', 'Friis']
  },
  brazil: {
    first: ['Tele', 'Mario', 'Vanderlei', 'Luiz Felipe', 'Carlos Alberto', 'Muricy', 'Tite', 'Renato', 'Abel', 'Cuca', 'Dorival', 'Fernando'],
    last: ['Santana', 'Zagallo', 'Luxemburgo', 'Scolari', 'Parreira', 'Ramalho', 'Bachi', 'Portaluppi', 'Braga', 'Stival', 'Junior', 'Diniz']
  },
  argentina: {
    first: ['Carlos', 'Cesar', 'Marcelo', 'Jose', 'Hector', 'Alfio', 'Alejandro', 'Diego', 'Gabriel', 'Eduardo', 'Lionel', 'Martin'],
    last: ['Bianchi', 'Menotti', 'Bielsa', 'Pekerman', 'Cuper', 'Basile', 'Sabella', 'Simeone', 'Milito', 'Coudet', 'Scaloni', 'Demichelis']
  },
  colombia: {
    first: ['Francisco', 'Hernan Dario', 'Luis Fernando', 'Jorge Luis', 'Reinaldo', 'Juan Carlos', 'Alberto', 'Alexis', 'Leonel', 'Hernan', 'Rafael', 'Lucas'],
    last: ['Maturana', 'Gomez', 'Suarez', 'Pinto', 'Rueda', 'Osorio', 'Gamero', 'Garcia', 'Alvarez', 'Torres', 'Dudamel', 'Gonzalez']
  },
  mexico: {
    first: ['Ignacio', 'Javier', 'Manuel', 'Ricardo', 'Miguel', 'Hugo', 'Victor', 'Enrique', 'Tomas', 'Guillermo', 'Jaime', 'Luis'],
    last: ['Trelles', 'Aguirre', 'Lapuente', 'La Volpe', 'Herrera', 'Sanchez', 'Vucetich', 'Meza', 'Boy', 'Vazquez', 'Lozano', 'Tena']
  },
  usa: {
    first: ['Bruce', 'Bob', 'Steve', 'Peter', 'Greg', 'Gregg', 'Caleb', 'Brian', 'Jim', 'Ben', 'Jesse', 'Curt'],
    last: ['Arena', 'Bradley', 'Sampson', 'Vermes', 'Vanney', 'Berhalter', 'Porter', 'Schmetzer', 'Curtin', 'Olsen', 'Marsch', 'Onalfo']
  }
};

export function getRegionForCountry(country = '') {
  const c = String(country).toLowerCase().trim();
  if (SA_COUNTRIES.has(c)) return 'south_america';
  if (NA_COUNTRIES.has(c)) return 'north_america';
  return 'europe';
}

export function normalizeClubKey(country = '', clubName = '') {
  return `${String(country).toLowerCase().trim()}:${String(clubName).toLowerCase().trim()}`;
}

export function getLeagueRoundCycles(countryKey, teamsCount) {
  if (countryKey === 'usa') return 1;
  if ((countryKey === 'scotland' || countryKey === 'denmark' || countryKey === 'croatia' || countryKey === 'serbia' || countryKey === 'fr_yugoslavia') && teamsCount === 12) return 3;
  if ((countryKey === 'scotland' || countryKey === 'croatia') && teamsCount === 10) return 4;
  return 2;
}

export function getTotalRoundsForTeams(teamsList = [], countryKey = 'england', fixturesList = null) {
  if (Array.isArray(fixturesList) && fixturesList.length > 0) return fixturesList.length;
  if (!Array.isArray(teamsList) || teamsList.length === 0) return 38;
  const base = teamsList.length % 2 === 0 ? teamsList.length - 1 : teamsList.length;
  return base * getLeagueRoundCycles(countryKey, teamsList.length);
}

/**
 * Generates deterministic Berger round-robin pairings without mutating teams.
 */
export function generateBergerRoundRobinPairings(teamsList = [], cyclesInput = 2) {
  const cycles = Math.max(1, Number(cyclesInput) || 2);
  const list = teamsList.length % 2 === 0 ? [...teamsList] : [...teamsList, null];
  const n = list.length;
  if (n < 2) return [];

  const firstLeg = [];
  for (let round = 0; round < n - 1; round++) {
    const roundFixtures = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (!home || !away) continue;
      if (round % 2 === 0) {
        roundFixtures.push({ homeId: home.idnum, awayId: away.idnum });
      } else {
        roundFixtures.push({ homeId: away.idnum, awayId: home.idnum });
      }
    }
    firstLeg.push(roundFixtures);
    list.splice(1, 0, list.pop());
  }

  const allRounds = [];
  for (let cycle = 0; cycle < cycles; cycle++) {
    const swapHomeAway = cycle % 2 === 1;
    for (let round = 0; round < firstLeg.length; round++) {
      allRounds.push(
        firstLeg[round].map((f) => ({
          homeId: swapHomeAway ? f.awayId : f.homeId,
          awayId: swapHomeAway ? f.homeId : f.awayId
        }))
      );
    }
  }
  return allRounds;
}

/**
 * Reconstructs full LeagueDashboard fixtures array from compact playedScores ("2-1,0-0,...")
 * and recomputes standings consistently.
 */
export function buildFixturesFromPlayedScores(teamsList = [], countryKey = 'england', playedScores = []) {
  const cycles = getLeagueRoundCycles(countryKey, teamsList.length);
  const pairings = generateBergerRoundRobinPairings(teamsList, cycles);

  const freshTeams = teamsList.map((t) => ({
    ...t,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0
  }));

  const fixtures = pairings.map((roundPairs, rIdx) => {
    const scoreTokens = typeof playedScores[rIdx] === 'string' && playedScores[rIdx].length > 0
      ? playedScores[rIdx].split(',')
      : null;

    return roundPairs.map((pair, mIdx) => {
      if (scoreTokens && scoreTokens[mIdx] && scoreTokens[mIdx].includes('-')) {
        const [hStr, aStr] = scoreTokens[mIdx].split('-');
        const hScore = parseInt(hStr, 10) || 0;
        const aScore = parseInt(aStr, 10) || 0;
        const h = freshTeams.find((t) => t.idnum === pair.homeId);
        const a = freshTeams.find((t) => t.idnum === pair.awayId);
        if (h && a) {
          h.played += 1;
          a.played += 1;
          h.gf += hScore;
          h.ga += aScore;
          a.gf += aScore;
          a.ga += hScore;
          if (hScore > aScore) {
            h.won += 1;
            h.points += 3;
            a.lost += 1;
          } else if (aScore > hScore) {
            a.won += 1;
            a.points += 3;
            h.lost += 1;
          } else {
            h.drawn += 1;
            h.points += 1;
            a.drawn += 1;
            a.points += 1;
          }
        }
        return {
          homeId: pair.homeId,
          awayId: pair.awayId,
          played: true,
          homeScore: hScore,
          awayScore: aScore
        };
      }
      return {
        homeId: pair.homeId,
        awayId: pair.awayId,
        played: false,
        homeScore: 0,
        awayScore: 0
      };
    });
  });

  return { fixtures, teams: freshTeams };
}

function getSeasonDataMap(country, division = 1) {
  const c = String(country).toLowerCase();
  if (division === 2) return leagueDataMapD2;
  if (SA_COUNTRIES.has(c)) return leagueDataMapSA;
  if (NA_COUNTRIES.has(c)) return leagueDataMapNA;
  return leagueDataMap;
}

function resolveSeasonYearKey(dataMap, seasonShort) {
  if (!dataMap) return null;
  const yr = String(seasonShort || '2001').split('/')[0];
  if (dataMap[yr]) return yr;
  const years = Object.keys(dataMap)
    .map((y) => parseInt(y, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (years.length === 0) return null;
  const target = parseInt(yr, 10) || years[years.length - 1];
  let best = years[0];
  for (const y of years) {
    if (y <= target) best = y;
  }
  return String(best);
}

/**
 * Loads normalized 1-10 raw club entries for a country + division + seasonYear.
 */
export function getRawTeamsForLeague(country, seasonShort, division = 1) {
  const c = String(country).toLowerCase();
  const dataMap = getSeasonDataMap(c, division);
  const yrKey = resolveSeasonYearKey(dataMap, seasonShort);
  if (!yrKey || !dataMap[yrKey] || !Array.isArray(dataMap[yrKey][c])) return null;
  return dataMap[yrKey][c].map((t) => ({
    ...t,
    division,
    attack: scaleStatTo10(t.attack),
    midfield: scaleStatTo10(t.midfield),
    defense: scaleStatTo10(t.defense),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
    streak: 0
  }));
}

/**
 * Determines which background leagues should simulate live:
 * - Current continent D1 leagues (when in SA or NA)
 * - PLUS core tracked Europe set (ENG 1&2, ESP 1&2, GER 1&2, ITA 1&2, FRA 1, POR 1, NED 1, BEL 1) across all regions.
 */
export function getTrackedLeagueSpecs(region = 'europe', seasonShort = '2001') {
  const yr = String(seasonShort).split('/')[0];
  const specs = [];
  const added = new Set();

  const pushSpec = (country, division) => {
    const k = `${country}_d${division}`;
    if (added.has(k)) return;
    const raw = getRawTeamsForLeague(country, yr, division);
    if (Array.isArray(raw) && raw.length >= 4) {
      added.add(k);
      specs.push({ key: k, country, division });
    }
  };

  if (region === 'south_america') {
    const saYr = resolveSeasonYearKey(leagueDataMapSA, yr);
    Object.keys(leagueDataMapSA[saYr] || {}).forEach((c) => pushSpec(c, 1));
    CORE_EUROPE_TRACKED.forEach(([c, d]) => pushSpec(c, d));
  } else if (region === 'north_america') {
    const naYr = resolveSeasonYearKey(leagueDataMapNA, yr);
    Object.keys(leagueDataMapNA[naYr] || {}).forEach((c) => pushSpec(c, 1));
    CORE_EUROPE_TRACKED.forEach(([c, d]) => pushSpec(c, d));
  } else {
    CORE_EUROPE_TRACKED.forEach(([c, d]) => pushSpec(c, d));
  }

  return specs;
}

/**
 * Lists all D1 + D2 countries available anywhere for the season (for untracked scouting / surprise offers).
 */
export function getAllWorldLeagueSpecs(seasonShort = '2001') {
  const yr = String(seasonShort).split('/')[0];
  const specs = [];
  const added = new Set();
  const addFrom = (mapObj, div) => {
    const yKey = resolveSeasonYearKey(mapObj, yr);
    if (!yKey || !mapObj[yKey]) return;
    Object.keys(mapObj[yKey]).forEach((c) => {
      const k = `${c}_d${div}`;
      if (!added.has(k) && Array.isArray(mapObj[yKey][c]) && mapObj[yKey][c].length >= 4) {
        added.add(k);
        specs.push({ key: k, country: c, division: div });
      }
    });
  };
  addFrom(leagueDataMap, 1);
  addFrom(leagueDataMapSA, 1);
  addFrom(leagueDataMapNA, 1);
  addFrom(leagueDataMapD2, 2);
  return specs;
}

function createUniqueAiManager(country, rating10, aiManagers = {}, seasonStr = '2001/02', seedOffset = 0) {
  const pool = MANAGER_NAME_POOLS[country] || MANAGER_NAME_POOLS.england;
  const usedNames = new Set(Object.values(aiManagers).map((m) => m.name));
  const totalCombos = pool.first.length * pool.last.length;
  let chosenName = '';

  for (let attempt = 0; attempt < totalCombos * 2; attempt++) {
    const idx = (attempt + seedOffset + Math.floor(Math.random() * totalCombos)) % totalCombos;
    const f = pool.first[Math.floor(idx / pool.last.length) % pool.first.length];
    const l = pool.last[idx % pool.last.length];
    const candidate = `${f} ${l}`;
    if (!usedNames.has(candidate)) {
      chosenName = candidate;
      break;
    }
  }
  if (!chosenName) {
    const idx = Object.keys(aiManagers).length + 1;
    chosenName = `${pool.first[idx % pool.first.length]} ${pool.last[(idx * 3) % pool.last.length]} ${idx}`;
  }

  const tier = rating10 >= 8.2 ? 4 : (rating10 >= 6.8 ? 3 : (rating10 >= 5.2 ? 2 : 1));
  const rep = Math.round(tier * 65 + Math.random() * 55);
  const id = `mgr_${country}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    name: chosenName,
    nationality: country,
    tier,
    reputation: rep,
    currentClubKey: null,
    bannedClubKeys: [],
    appointedSeason: seasonStr
  };
}

function assignExpectedRanksToTeams(teamsList, country, seasonShort, division) {
  if (!Array.isArray(teamsList) || teamsList.length === 0) return [];
  const scored = teamsList.map((t) => {
    const exp = calculateBoardExpectation({
      team: t,
      allTeams: teamsList,
      country,
      season: seasonShort,
      division
    });
    return {
      ...t,
      expectedRank: exp?.rank || Math.ceil(teamsList.length / 2),
      expectedText: exp?.text || 'Mid-Table'
    };
  });
  return scored;
}

function ensureLeagueEntryManagers(teamsList, country, seasonStr, stateBag, userClubKey = null) {
  const { aiManagers, clubManagerMap, freeAgents } = stateBag;

  teamsList.forEach((t, idx) => {
    const cKey = normalizeClubKey(country, t.name);
    if (userClubKey && cKey === userClubKey) {
      // If user manages this club, remove any prior AI link cleanly without wiping other clubs.
      const prevId = clubManagerMap[cKey];
      if (prevId && prevId !== 'USER' && aiManagers[prevId]) {
        aiManagers[prevId] = { ...aiManagers[prevId], currentClubKey: null };
        if (!freeAgents.includes(prevId)) freeAgents.push(prevId);
      }
      clubManagerMap[cKey] = 'USER';
      return;
    }

    const existingId = clubManagerMap[cKey];
    if (existingId && existingId !== 'USER' && aiManagers[existingId]) {
      aiManagers[existingId].currentClubKey = cKey;
      return;
    }

    // Try picking an eligible free agent not banned from this club, else create a fresh AI manager
    const clubRating = ((t.attack || 5) + (t.midfield || 5) + (t.defense || 5)) / 3;
    const candidateIdx = freeAgents.findIndex((fid) => {
      const m = aiManagers[fid];
      return m && !(m.bannedClubKeys || []).includes(cKey) && !m.currentClubKey;
    });

    if (candidateIdx !== -1) {
      const pickedId = freeAgents.splice(candidateIdx, 1)[0];
      aiManagers[pickedId] = {
        ...aiManagers[pickedId],
        currentClubKey: cKey,
        appointedSeason: aiManagers[pickedId].appointedSeason || seasonStr
      };
      clubManagerMap[cKey] = pickedId;
    } else {
      const created = createUniqueAiManager(country, clubRating, aiManagers, seasonStr, idx * 7);
      created.currentClubKey = cKey;
      aiManagers[created.id] = created;
      clubManagerMap[cKey] = created.id;
    }
  });
}

function buildTrackedLeagueEntry({ country, division, seasonShort, seasonStr, stateBag, userClubKey }) {
  const raw = getRawTeamsForLeague(country, seasonShort, division);
  if (!raw) return null;
  const teamsWithExp = assignExpectedRanksToTeams(raw, country, seasonShort, division);
  ensureLeagueEntryManagers(teamsWithExp, country, seasonStr, stateBag, userClubKey);

  return {
    key: `${country}_d${division}`,
    country,
    division,
    totalRounds: getTotalRoundsForTeams(teamsWithExp, country),
    roundsSimulated: 0,
    playedScores: [],
    teams: teamsWithExp
  };
}

/**
 * Initializes or validates worldState for a career save while preserving existing AI managers.
 */
export function initializeWorldState({
  country,
  division = 1,
  region = 'europe',
  season = '2001/02',
  teams = [],
  playerTeamId = null,
  existingWorldState = null
}) {
  const seasonShort = String(season).split('/')[0];
  const playerTeam = teams.find((t) => t.idnum === playerTeamId);
  const userClubKey = playerTeam ? normalizeClubKey(country, playerTeam.name) : null;

  const aiManagers = existingWorldState?.aiManagers ? JSON.parse(JSON.stringify(existingWorldState.aiManagers)) : {};
  const clubManagerMap = existingWorldState?.clubManagerMap ? { ...existingWorldState.clubManagerMap } : {};
  const freeAgents = Array.isArray(existingWorldState?.freeAgents) ? [...existingWorldState.freeAgents] : [];
  const stateBag = { aiManagers, clubManagerMap, freeAgents };

  // Ensure active league's AI clubs have persistent managers
  ensureLeagueEntryManagers(teams, country, season, stateBag, userClubKey);

  const specs = getTrackedLeagueSpecs(region, seasonShort);
  const allowedSpecKeys = new Set(specs.map((s) => s.key));
  const trackedLeagues = existingWorldState?.trackedLeagues
    ? JSON.parse(JSON.stringify(existingWorldState.trackedLeagues))
    : {};

  const activeKey = `${country}_d${division}`;
  delete trackedLeagues[activeKey];
  Object.keys(trackedLeagues).forEach((k) => {
    if (!allowedSpecKeys.has(k)) delete trackedLeagues[k];
  });

  specs.forEach((spec) => {
    if (spec.key === activeKey) return;
    if (!trackedLeagues[spec.key] || !Array.isArray(trackedLeagues[spec.key].teams) || trackedLeagues[spec.key].teams.length === 0) {
      const entry = buildTrackedLeagueEntry({
        country: spec.country,
        division: spec.division,
        seasonShort,
        seasonStr: season,
        stateBag,
        userClubKey
      });
      if (entry) trackedLeagues[spec.key] = entry;
    } else {
      ensureLeagueEntryManagers(trackedLeagues[spec.key].teams, spec.country, season, stateBag, userClubKey);
    }
  });

  return {
    aiManagers,
    clubManagerMap,
    freeAgents,
    trackedLeagues,
    vacancies: Array.isArray(existingWorldState?.vacancies) ? existingWorldState.vacancies : [],
    directOffers: Array.isArray(existingWorldState?.directOffers) ? existingWorldState.directOffers : [],
    rejectedCooldowns: existingWorldState?.rejectedCooldowns ? { ...existingWorldState.rejectedCooldowns } : {},
    lastTickKey: existingWorldState?.lastTickKey || ''
  };
}

/**
 * Carries AI manager assignments forward across seasons so any new mid-season hire stays in charge next year.
 */
export function carryoverWorldForNextSeason({
  prevWorldState,
  nextSeasonStr,
  nextRegion,
  nextCountry,
  nextDivision = 1,
  nextTeams = [],
  playerTeamId = null
}) {
  const prev = prevWorldState || {};
  const nextStartYr = parseInt(String(nextSeasonStr || '').split('/')[0], 10);
  const rawClubMap = { ...(prev.clubManagerMap || {}) };
  const carriedClubMap = {};
  const nextAiManagers = prev.aiManagers ? JSON.parse(JSON.stringify(prev.aiManagers)) : {};

  // Clear prior 'USER' marker & migrate federation splits / club renames across seasons
  Object.entries(rawClubMap).forEach(([clubKey, mgrId]) => {
    if (!mgrId || mgrId === 'USER') return;
    const colonIdx = clubKey.indexOf(':');
    if (colonIdx === -1) {
      carriedClubMap[clubKey] = mgrId;
      return;
    }
    const oldCountry = clubKey.slice(0, colonIdx);
    const oldName = clubKey.slice(colonIdx + 1);
    if (HISTORICAL_FEDERATION_COUNTRIES.has(oldCountry) && !Number.isNaN(nextStartYr)) {
      const split = getClubSplitDestination({ country: oldCountry, clubName: oldName, nextStartYr });
      if (split.canRenew && split.country) {
        const nextKey = normalizeClubKey(split.country, split.nextName || oldName);
        carriedClubMap[nextKey] = mgrId;
        if (nextAiManagers[mgrId]) {
          nextAiManagers[mgrId].currentClubKey = nextKey;
        }
      } else if (nextAiManagers[mgrId]) {
        nextAiManagers[mgrId].currentClubKey = null;
      }
    } else {
      carriedClubMap[clubKey] = mgrId;
    }
  });

  return initializeWorldState({
    country: nextCountry,
    division: nextDivision,
    region: nextRegion,
    season: nextSeasonStr,
    teams: nextTeams,
    playerTeamId,
    existingWorldState: {
      aiManagers: nextAiManagers,
      clubManagerMap: carriedClubMap,
      freeAgents: prev.freeAgents || [],
      trackedLeagues: {}, // Reset tables to Round 0 for the fresh season
      vacancies: [],
      directOffers: [],
      rejectedCooldowns: {},
      lastTickKey: ''
    }
  });
}

export function getClubManager(worldState, country, teamName) {
  if (!worldState) return null;
  const cKey = normalizeClubKey(country, teamName);
  const mgrId = worldState.clubManagerMap?.[cKey];
  if (!mgrId || mgrId === 'USER') return null;
  return worldState.aiManagers?.[mgrId] || null;
}

export function sortTeamsForTable(teamsList = []) {
  return [...teamsList].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    const gdA = (a.gf || 0) - (a.ga || 0);
    const gdB = (b.gf || 0) - (b.ga || 0);
    if (gdB !== gdA) return gdB - gdA;
    if ((b.gf || 0) !== (a.gf || 0)) return (b.gf || 0) - (a.gf || 0);
    return String(a.name).localeCompare(String(b.name));
  });
}

function simulateSingleBackgroundRound(entry) {
  if (!entry || !Array.isArray(entry.teams) || entry.teams.length < 2) return entry;
  const roundIdx = entry.roundsSimulated || 0;
  if (roundIdx >= entry.totalRounds) return entry;

  const cycles = getLeagueRoundCycles(entry.country, entry.teams.length);
  const allPairings = generateBergerRoundRobinPairings(entry.teams, cycles);
  const pairs = allPairings[roundIdx];
  if (!pairs) return entry;

  const teamById = new Map(entry.teams.map((t) => [t.idnum, t]));
  const roundTokens = [];

  pairs.forEach((p) => {
    const h = teamById.get(p.homeId);
    const a = teamById.get(p.awayId);
    if (!h || !a) {
      roundTokens.push('0-0');
      return;
    }
    const { homeGoals, awayGoals } = simulateFixture(h, a);
    h.played = (h.played || 0) + 1;
    a.played = (a.played || 0) + 1;
    h.gf = (h.gf || 0) + homeGoals;
    h.ga = (h.ga || 0) + awayGoals;
    a.gf = (a.gf || 0) + awayGoals;
    a.ga = (a.ga || 0) + homeGoals;

    if (homeGoals > awayGoals) {
      h.won = (h.won || 0) + 1;
      h.points = (h.points || 0) + 3;
      h.streak = (h.streak || 0) >= 0 ? (h.streak || 0) + 1 : 1;
      a.lost = (a.lost || 0) + 1;
      a.streak = (a.streak || 0) <= 0 ? (a.streak || 0) - 1 : -1;
    } else if (awayGoals > homeGoals) {
      a.won = (a.won || 0) + 1;
      a.points = (a.points || 0) + 3;
      a.streak = (a.streak || 0) >= 0 ? (a.streak || 0) + 1 : 1;
      h.lost = (h.lost || 0) + 1;
      h.streak = (h.streak || 0) <= 0 ? (h.streak || 0) - 1 : -1;
    } else {
      h.drawn = (h.drawn || 0) + 1;
      h.points = (h.points || 0) + 1;
      h.streak = 0;
      a.drawn = (a.drawn || 0) + 1;
      a.points = (a.points || 0) + 1;
      a.streak = 0;
    }
    roundTokens.push(`${homeGoals}-${awayGoals}`);
  });

  entry.roundsSimulated = roundIdx + 1;
  entry.playedScores = entry.playedScores || [];
  entry.playedScores[roundIdx] = roundTokens.join(',');
  return entry;
}

/**
 * Generates and fast-simulates an untracked foreign league up to targetProgressPct (e.g. Ajax from Brazil).
 */
export function catchUpUntrackedLeague({
  country,
  division = 1,
  season,
  progressPct = 0.5,
  existingWorldState = null
}) {
  const seasonShort = String(season || '2001/02').split('/')[0];
  const world = existingWorldState ? JSON.parse(JSON.stringify(existingWorldState)) : {
    aiManagers: {},
    clubManagerMap: {},
    freeAgents: [],
    trackedLeagues: {}
  };
  const stateBag = {
    aiManagers: world.aiManagers || {},
    clubManagerMap: world.clubManagerMap || {},
    freeAgents: world.freeAgents || []
  };

  const entry = buildTrackedLeagueEntry({
    country,
    division,
    seasonShort,
    seasonStr: season,
    stateBag,
    userClubKey: null
  });
  if (!entry) return null;

  const targetRounds = Math.min(entry.totalRounds, Math.max(0, Math.round(progressPct * entry.totalRounds)));
  for (let r = 0; r < targetRounds; r++) {
    simulateSingleBackgroundRound(entry);
  }

  return { entry, worldPatch: stateBag };
}

function computeRequiredPrestige(clubObj) {
  const avgRating10 = ((clubObj.attack || 5) + (clubObj.midfield || 5) + (clubObj.defense || 5)) / 3;
  if (avgRating10 >= 8.5) return 2200;
  if (avgRating10 >= 7.6) return 1100;
  if (avgRating10 >= 6.4) return 450;
  if (avgRating10 >= 5.2) return 100;
  return 0;
}

export function computeHireProbability(managerPrestige, minPrestige, currentConfidence = 60, isVacancy = true) {
  const gap = managerPrestige - minPrestige;
  const slope = gap >= 0 ? gap * 0.08 : gap * 0.12;
  const confBoost = currentConfidence >= 75 ? 10 : (currentConfidence < 45 ? -10 : 0);
  const raw = (isVacancy ? 65 : 50) + slope + confBoost;
  return Math.max(5, Math.min(98, Math.round(raw)));
}

function appointReplacementAiManager(worldState, clubKey, clubCountry, clubRating10, seasonStr) {
  const aiManagers = worldState.aiManagers || {};
  const clubManagerMap = worldState.clubManagerMap || {};
  const freeAgents = worldState.freeAgents || [];

  const eligibleIdx = freeAgents.findIndex((fid) => {
    const m = aiManagers[fid];
    return m && !m.currentClubKey && !(m.bannedClubKeys || []).includes(clubKey);
  });

  if (eligibleIdx !== -1) {
    const pickedId = freeAgents.splice(eligibleIdx, 1)[0];
    aiManagers[pickedId] = {
      ...aiManagers[pickedId],
      currentClubKey: clubKey,
      appointedSeason: seasonStr
    };
    clubManagerMap[clubKey] = pickedId;
    return aiManagers[pickedId];
  }

  const created = createUniqueAiManager(clubCountry, clubRating10, aiManagers, seasonStr, freeAgents.length + 13);
  created.currentClubKey = clubKey;
  aiManagers[created.id] = created;
  clubManagerMap[clubKey] = created.id;
  return created;
}

function createJobRecord({
  club,
  country,
  division,
  leaguePos,
  totalTeams,
  expectedRank,
  expectedText,
  roundsSimulated,
  totalRounds,
  prevManagerName,
  reason,
  sourceType = 'vacancy',
  roundsLeft = 4,
  isTracked = true
}) {
  const minPrestige = computeRequiredPrestige(club);
  const cKey = normalizeClubKey(country, club.name);
  return {
    id: `job_${cKey}_${roundsSimulated}_${Math.random().toString(36).slice(2, 6)}`,
    clubKey: cKey,
    idnum: club.idnum,
    name: club.name,
    country,
    division,
    attack: club.attack,
    midfield: club.midfield,
    defense: club.defense,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    kit: club.kit,
    rating: ((club.attack || 5) + (club.midfield || 5) + (club.defense || 5)) / 3,
    leaguePos,
    totalTeams,
    expectedRank,
    expectedText: expectedText || `Top ${expectedRank}`,
    played: club.played || roundsSimulated || 0,
    points: club.points || 0,
    totalRounds,
    remainingRounds: Math.max(0, totalRounds - (roundsSimulated || 0)),
    roundsLeft,
    minPrestige,
    prevManagerName: prevManagerName || 'Former Boss',
    reason: reason || 'Poor league campaign',
    sourceType,
    isTracked
  };
}

/**
 * Advances tracked foreign leagues proportionally to user calendar progress and ticks
 * live job vacancies, AI sackings, AI appointments, and occasional direct approaches.
 */
export function syncWorldProgressAndJobs({
  leagueState,
  managerPrestige = 0,
  boardConfidence = 60,
  forceTick = false
}) {
  if (!leagueState || !Array.isArray(leagueState.teams) || leagueState.teams.length === 0) {
    return { worldState: leagueState?.worldState || null, newsItems: [], changed: false };
  }

  const totalRounds = getTotalRoundsForTeams(leagueState.teams, leagueState.country);
  const currentRound = Math.max(1, Number(leagueState.currentRound) || 1);
  const completedRounds = Math.min(totalRounds, Math.max(0, currentRound - 1));
  const progressPct = totalRounds > 0 ? completedRounds / totalRounds : 0;

  const tickKey = `${leagueState.season}:${leagueState.country}:${leagueState.division || 1}:${leagueState.calendarIndex || 0}:${currentRound}:${leagueState.isUnemployed ? 'U' : 'E'}`;

  let worldState = initializeWorldState({
    country: leagueState.country,
    division: leagueState.division || 1,
    region: leagueState.region || getRegionForCountry(leagueState.country),
    season: leagueState.season,
    teams: leagueState.teams,
    playerTeamId: leagueState.playerTeamId,
    existingWorldState: leagueState.worldState
  });

  const prevTrackedCount = Object.keys(leagueState.worldState?.trackedLeagues || {}).length;
  const nextTrackedCount = Object.keys(worldState.trackedLeagues || {}).length;
  if (!forceTick && worldState.lastTickKey === tickKey && prevTrackedCount === nextTrackedCount) {
    return { worldState, newsItems: [], changed: false };
  }

  const newsItems = [];
  const capCountry = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const nowRound = currentRound;

  // 1. Advance every tracked league proportionally up to current career progressPct
  Object.values(worldState.trackedLeagues).forEach((entry) => {
    const targetRounds = Math.min(entry.totalRounds, Math.round(progressPct * entry.totalRounds));
    while ((entry.roundsSimulated || 0) < targetRounds) {
      simulateSingleBackgroundRound(entry);
    }
  });

  // 2. Age existing vacancies & directOffers; fill expired vacancies with brand-new AI managers
  const survivingVacancies = [];
  const existingClubKeys = new Set();

  (worldState.vacancies || []).forEach((v) => {
    const updated = { ...v, roundsLeft: (v.roundsLeft || 1) - 1 };
    // Sync live table info if still tracked or active
    const liveTable = updated.country === leagueState.country && (updated.division || 1) === (leagueState.division || 1)
      ? sortTeamsForTable(leagueState.teams)
      : (worldState.trackedLeagues[`${updated.country}_d${updated.division || 1}`]
        ? sortTeamsForTable(worldState.trackedLeagues[`${updated.country}_d${updated.division || 1}`].teams)
        : null);
    if (liveTable) {
      const idx = liveTable.findIndex((t) => normalizeClubKey(updated.country, t.name) === updated.clubKey);
      if (idx !== -1) {
        updated.leaguePos = idx + 1;
        updated.points = liveTable[idx].points;
        updated.played = liveTable[idx].played;
      }
    }

    if (updated.roundsLeft <= 0) {
      // Board hires a NEW AI manager (never re-hiring the sacked one due to bannedClubKeys)
      const hired = appointReplacementAiManager(
        worldState,
        updated.clubKey,
        updated.country,
        updated.rating || 6,
        leagueState.season
      );
      if (updated.isTracked !== false) {
        newsItems.push({
          id: `news_hire_${updated.clubKey}_${nowRound}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          round: nowRound,
          dateStr: `Round ${nowRound}`,
          category: 'board',
          categoryLabel: '👔 MANAGER HIRED',
          title: `🤝 ${updated.name} Appoint ${hired.name}`,
          summary: `${updated.name} (${capCountry(updated.country)}) have named ${hired.name} as their new permanent manager after parting ways with ${updated.prevManagerName}.`,
          body: `The board at ${updated.name} has concluded its managerial search and officially appointed ${hired.name} on a long-term deal.\n\n${hired.name} takes over with the club sitting ${updated.leaguePos}th on ${updated.points} points.`,
          isRead: false,
          timestamp: Date.now()
        });
      }
    } else {
      survivingVacancies.push(updated);
      existingClubKeys.add(updated.clubKey);
    }
  });
  worldState.vacancies = survivingVacancies;

  worldState.directOffers = (worldState.directOffers || [])
    .map((o) => ({ ...o, roundsLeft: (o.roundsLeft || 1) - 1 }))
    .filter((o) => o.roundsLeft > 0);

  // Decrement rejected cooldowns
  const nextCooldowns = {};
  Object.entries(worldState.rejectedCooldowns || {}).forEach(([ck, rLeft]) => {
    if (rLeft > 1) nextCooldowns[ck] = rLeft - 1;
  });
  worldState.rejectedCooldowns = nextCooldowns;

  // 3. Evaluate AI Sackings only once season has settled (Round >= 6 and season not nearly over)
  const canSpawnVacancies = completedRounds >= 5 && completedRounds < totalRounds - 2;
  const maxActiveVacancies = leagueState.isUnemployed ? 6 : 5;

  if (canSpawnVacancies && worldState.vacancies.length < maxActiveVacancies) {
    const candidates = [];

    // Active league clubs (excluding player)
    const activeTable = sortTeamsForTable(leagueState.teams);
    activeTable.forEach((club, idx) => {
      if (club.idnum === leagueState.playerTeamId) return;
      const cKey = normalizeClubKey(leagueState.country, club.name);
      if (existingClubKeys.has(cKey)) return;
      const mgrId = worldState.clubManagerMap?.[cKey];
      if (!mgrId || mgrId === 'USER') return;
      const exp = calculateBoardExpectation({
        team: club,
        allTeams: leagueState.teams,
        country: leagueState.country,
        season: String(leagueState.season).split('/')[0],
        division: leagueState.division || 1
      });
      const expectedRank = exp?.rank || Math.ceil(activeTable.length / 2);
      const posDiff = (idx + 1) - expectedRank;
      if (posDiff >= 5) {
        candidates.push({
          club,
          country: leagueState.country,
          division: leagueState.division || 1,
          leaguePos: idx + 1,
          totalTeams: activeTable.length,
          expectedRank,
          expectedText: exp?.text || `Top ${expectedRank}`,
          roundsSimulated: completedRounds,
          totalRounds,
          severity: posDiff,
          isTracked: true
        });
      }
    });

    // Tracked foreign leagues clubs
    Object.values(worldState.trackedLeagues).forEach((entry) => {
      if ((entry.roundsSimulated || 0) < 5 || entry.roundsSimulated >= entry.totalRounds - 2) return;
      const sorted = sortTeamsForTable(entry.teams);
      sorted.forEach((club, idx) => {
        const cKey = normalizeClubKey(entry.country, club.name);
        if (existingClubKeys.has(cKey)) return;
        const mgrId = worldState.clubManagerMap?.[cKey];
        if (!mgrId || mgrId === 'USER') return;
        const expectedRank = club.expectedRank || Math.ceil(sorted.length / 2);
        const posDiff = (idx + 1) - expectedRank;
        const lostStreak = (club.streak || 0) <= -3 ? 2 : 0;
        if (posDiff >= 5 || (posDiff >= 3 && lostStreak > 0)) {
          candidates.push({
            club,
            country: entry.country,
            division: entry.division,
            leaguePos: idx + 1,
            totalTeams: sorted.length,
            expectedRank,
            expectedText: club.expectedText || `Top ${expectedRank}`,
            roundsSimulated: entry.roundsSimulated,
            totalRounds: entry.totalRounds,
            severity: posDiff + lostStreak,
            isTracked: true
          });
        }
      });
    });

    // Pick at most 1-2 new sackings this round so market feels lively without spam
    const shuffledCands = candidates.sort((a, b) => (b.severity + Math.random() * 2) - (a.severity + Math.random() * 2));
    const spawnLimit = worldState.vacancies.length < 2 ? 2 : (Math.random() < 0.45 ? 1 : 0);

    for (let i = 0; i < Math.min(spawnLimit, shuffledCands.length); i++) {
      const pick = shuffledCands[i];
      const cKey = normalizeClubKey(pick.country, pick.club.name);
      const oldMgrId = worldState.clubManagerMap[cKey];
      const oldMgr = worldState.aiManagers[oldMgrId];
      if (!oldMgr) continue;

      // Sack oldMgr cleanly and mark bannedClubKeys so club hires a different manager later
      const updatedBanned = [...(oldMgr.bannedClubKeys || []), cKey];
      worldState.aiManagers[oldMgrId] = {
        ...oldMgr,
        currentClubKey: null,
        bannedClubKeys: updatedBanned
      };
      if (!worldState.freeAgents.includes(oldMgrId)) {
        worldState.freeAgents.push(oldMgrId);
      }
      delete worldState.clubManagerMap[cKey];

      const vacancy = createJobRecord({
        club: pick.club,
        country: pick.country,
        division: pick.division,
        leaguePos: pick.leaguePos,
        totalTeams: pick.totalTeams,
        expectedRank: pick.expectedRank,
        expectedText: pick.expectedText,
        roundsSimulated: pick.roundsSimulated,
        totalRounds: pick.totalRounds,
        prevManagerName: oldMgr.name,
        reason: `Sitting ${pick.leaguePos}th (Target: ${pick.expectedText})`,
        sourceType: 'vacancy',
        roundsLeft: 4,
        isTracked: true
      });
      worldState.vacancies.push(vacancy);
      existingClubKeys.add(cKey);

      newsItems.push({
        id: `news_sack_${cKey}_${nowRound}_${Date.now()}_${i}`,
        round: nowRound,
        dateStr: `Round ${nowRound}`,
        category: 'board',
        categoryLabel: '🚨 MANAGER SACKED',
        title: `⚡ ${pick.club.name} Sack ${oldMgr.name}!`,
        summary: `${pick.club.name} (${capCountry(pick.country)}) have dismissed ${oldMgr.name} with the club languishing in ${pick.leaguePos}th place. Check the Jobs desk!`,
        body: `After an underwhelming run leaving ${pick.club.name} in ${pick.leaguePos}th position (board target: ${pick.expectedText}), the directors have dismissed ${oldMgr.name}.\n\nApplications are now open on the Jobs board.`,
        isRead: false,
        timestamp: Date.now()
      });
    }

    // Also keep at least 1 untracked surprise opening if playing outside Europe (e.g. Ajax/Porto/Celtic) occasionally!
    const hasUntrackedOffer = worldState.vacancies.some((v) => v.isTracked === false) || worldState.directOffers.some((o) => o.isTracked === false);
    if (!hasUntrackedOffer && Math.random() < 0.30) {
      const seasonShort = String(leagueState.season).split('/')[0];
      const trackedKeys = new Set(Object.keys(worldState.trackedLeagues));
      trackedKeys.add(`${leagueState.country}_d${leagueState.division || 1}`);
      const untrackedSpecs = getAllWorldLeagueSpecs(seasonShort).filter((s) => s.division === 1 && !trackedKeys.has(s.key));
      if (untrackedSpecs.length > 0) {
        const pickedSpec = untrackedSpecs[Math.floor(Math.random() * untrackedSpecs.length)];
        const rawPool = getRawTeamsForLeague(pickedSpec.country, seasonShort, 1) || [];
        const maxAllow = managerPrestige < 500 ? 6.6 : (managerPrestige < 1000 ? 7.6 : (managerPrestige < 2000 ? 8.4 : 10));
        const eligibleClubs = rawPool.filter((c) => ((c.attack + c.midfield + c.defense) / 3) <= maxAllow);
        const club = (eligibleClubs.length > 0 ? eligibleClubs : rawPool)[Math.floor(Math.random() * (eligibleClubs.length || rawPool.length))];
        if (club) {
          const fakeExp = calculateBoardExpectation({
            team: club,
            allTeams: rawPool,
            country: pickedSpec.country,
            season: seasonShort,
            division: 1
          });
          const estTotal = getTotalRoundsForTeams(rawPool, pickedSpec.country);
          const estRound = Math.round(progressPct * estTotal);
          const fakePos = Math.min(rawPool.length, Math.max(4, (fakeExp?.rank || 6) + 5));
          const fakeVacancy = createJobRecord({
            club,
            country: pickedSpec.country,
            division: 1,
            leaguePos: fakePos,
            totalTeams: rawPool.length,
            expectedRank: fakeExp?.rank || 6,
            expectedText: fakeExp?.text || 'Top Half',
            roundsSimulated: estRound,
            totalRounds: estTotal,
            prevManagerName: 'Former Coach',
            reason: `International Opening (${capCountry(pickedSpec.country)})`,
            sourceType: 'vacancy',
            roundsLeft: 4,
            isTracked: false
          });
          worldState.vacancies.push(fakeVacancy);
        }
      }
    }
  }

  // 4. Direct Headhunt Offer when player performs strongly (or prestige >= 30 & unemployed)
  const shouldRollApproach = completedRounds >= 5 && completedRounds < totalRounds - 2 && worldState.directOffers.length < 2;
  if (shouldRollApproach && (boardConfidence >= 72 || (leagueState.isUnemployed && Math.random() < 0.45))) {
    const approachRoll = Math.random();
    if (approachRoll < (leagueState.isUnemployed ? 0.45 : 0.25)) {
      const eligibleVacancies = worldState.vacancies.filter((v) =>
        managerPrestige + 200 >= v.minPrestige &&
        !worldState.directOffers.some((o) => o.clubKey === v.clubKey)
      );
      if (eligibleVacancies.length > 0) {
        const chosen = eligibleVacancies[Math.floor(Math.random() * eligibleVacancies.length)];
        const directOffer = {
          ...chosen,
          id: `offer_${chosen.clubKey}_${nowRound}_${Date.now()}`,
          sourceType: 'direct_offer',
          roundsLeft: 3
        };
        worldState.directOffers.push(directOffer);
        newsItems.push({
          id: `news_approach_${chosen.clubKey}_${nowRound}_${Date.now()}`,
          round: nowRound,
          dateStr: `Round ${nowRound}`,
          category: 'board',
          categoryLabel: '📩 DIRECT JOB OFFER',
          title: `📩 ${chosen.name} Approach You With Immediate Offer!`,
          summary: `Impressed by your reputation, ${chosen.name} (${capCountry(chosen.country)}) want you to take charge immediately!`,
          body: `${chosen.name}'s directors have reached out with an immediate managerial contract offer. Visit the Jobs tab within 3 rounds to accept or decline.`,
          isRead: false,
          timestamp: Date.now()
        });
      }
    }
  }

  worldState.lastTickKey = tickKey;
  return { worldState, newsItems, changed: true };
}

/**
 * Evaluates a user's job application to a live vacancy based on prestige + current form.
 */
export function applyForVacancy({ leagueState, managerProfile, vacancy }) {
  if (!leagueState?.worldState || !vacancy) {
    return { accepted: false, reason: 'Vacancy is no longer available.', updatedWorldState: leagueState?.worldState };
  }
  const worldState = JSON.parse(JSON.stringify(leagueState.worldState));
  if (worldState.rejectedCooldowns?.[vacancy.clubKey] > 0) {
    return {
      accepted: false,
      reason: `${vacancy.name} recently rejected your application (${worldState.rejectedCooldowns[vacancy.clubKey]} rounds cooldown).`,
      updatedWorldState: worldState
    };
  }

  const prestige = calculateManagerPrestige(managerProfile);

  // If prestige clearly meets club threshold or underdog club needs help while unemployed, accept!
  const prob = computeHireProbability(prestige, vacancy.minPrestige, 65, true);
  const hardFloor = Math.max(0, vacancy.minPrestige - 250);
  const accepted = prestige >= hardFloor && (prestige >= vacancy.minPrestige || Math.random() * 100 < prob);

  if (accepted) {
    return { accepted: true, updatedWorldState: worldState };
  }

  worldState.rejectedCooldowns = {
    ...(worldState.rejectedCooldowns || {}),
    [vacancy.clubKey]: 4
  };
  return {
    accepted: false,
    reason: `${vacancy.name}'s board felt your manager reputation (${prestige} PTS) isn't quite proven enough yet (Recommended: ~${vacancy.minPrestige} PTS).`,
    updatedWorldState: worldState
  };
}

/**
 * Helper to fast-simulate domestic cup matches cleanly on demand up to targetRound.
 */
function catchUpDomesticCupToRound(domRoster, totalTargetRounds, targetCountry, playerTeamId, targetCompletedRounds) {
  let cupState = createDomesticCup(domRoster, totalTargetRounds, targetCountry, playerTeamId);
  if (!cupState || !cupState.calendarSchedules) return cupState;

  for (let i = 0; i < cupState.stages.length; i++) {
    const sched = cupState.calendarSchedules[i];
    if (!sched || sched.offset > targetCompletedRounds || cupState.isCompleted) break;

    const stg = cupState.stage;
    const teamsPool = cupState.participatingTeams;
    const matches = cupState.knockoutState?.[stg] || [];
    matches.forEach((m) => {
      if (!m.played) {
        const h = teamsPool.find((t) => t.idnum === m.homeId) || { attack: 5, midfield: 5, defense: 5 };
        const a = teamsPool.find((t) => t.idnum === m.awayId) || { attack: 5, midfield: 5, defense: 5 };
        const { homeGoals, awayGoals } = simulateFixture(h, a);
        m.homeScore = homeGoals;
        m.awayScore = awayGoals;
        m.played = true;
        if (m.homeScore === m.awayScore) {
          if (Math.random() < 0.5) {
            m.penaltyHomeScore = 5;
            m.penaltyAwayScore = 4;
          } else {
            m.penaltyHomeScore = 4;
            m.penaltyAwayScore = 5;
          }
        }
      }
    });
    cupState = advanceDomesticCup(cupState);
  }
  return cupState;
}

/**
 * Builds remaining calendar events cleanly after a foreign/cross-division mid-season takeover.
 */
function buildRemainingMidSeasonCalendar(startRound, totalRounds, domesticCupState, oldEuropeanCupState, existingCalendar) {
  const calendar = [];
  for (let r = startRound; r <= totalRounds; r++) {
    calendar.push({ type: 'league', index: r });
  }

  // Insert remaining unplayed domestic cup stages proportionally
  if (domesticCupState && !domesticCupState.isCompleted && Array.isArray(domesticCupState.calendarSchedules)) {
    const remainingStages = domesticCupState.calendarSchedules.slice(domesticCupState.currentStageIndex || 0);
    const remainingLeagueCount = Math.max(1, totalRounds - startRound + 1);
    const inserts = remainingStages.map((s, idx) => {
      const proportional = Math.max(0, Math.min(remainingLeagueCount - 1, Math.round(((idx + 1) / (remainingStages.length + 1)) * remainingLeagueCount)));
      return {
        offset: s.stage === 'final' ? Math.max(1, calendar.length - 1) : proportional,
        stage: s.stage
      };
    }).sort((a, b) => b.offset - a.offset);

    inserts.forEach((slot) => {
      calendar.splice(Math.min(calendar.length, slot.offset), 0, {
        type: 'domestic_cup',
        stage: slot.stage,
        isDomesticCup: true
      });
    });
  }

  // If still in the same continent and an active European cup exists with unplayed calendar slots, preserve remaining unplayed midweeks
  if (oldEuropeanCupState && Array.isArray(existingCalendar)) {
    const oldEuroEvents = existingCalendar.filter((ev) => ev.type === 'europe');
    const unplayedCount = oldEuroEvents.length;
    if (unplayedCount > 0) {
      // Check how many unplayed events remained proportionally from old calendar
      // Handled by caller passing sliced remaining unplayed euro events!
    }
  }
  return calendar;
}

/**
 * Core synchronous state builder for taking over a club immediately mid-season.
 */
export function executeMidSeasonTakeoverCore({
  leagueState,
  targetJob,
  managerProfile,
  managerName = null,
  newClubBudget = null,
  newClubPayroll = null,
  newClubLoadedSquad = null
}) {
  const prevState = JSON.parse(JSON.stringify(leagueState));
  const seasonStr = prevState.season;
  const seasonShort = String(seasonStr).split('/')[0];
  const oldCountry = prevState.country;
  const oldDivision = prevState.division || 1;
  const oldRegion = prevState.region || getRegionForCountry(oldCountry);
  const oldTotalRounds = getTotalRoundsForTeams(prevState.teams, oldCountry);
  const oldCompletedRounds = Math.max(0, (prevState.currentRound || 1) - 1);
  const progressPct = oldTotalRounds > 0 ? oldCompletedRounds / oldTotalRounds : 0;

  // 1. Archive partial stint from previous club (if employed) into managerProfile without double-counting
  let updatedProfile = { ...managerProfile };
  if (!prevState.isUnemployed && prevState.playerTeamId !== null && prevState.playerTeamId !== undefined) {
    const oldTeam = prevState.teams?.find((t) => t.idnum === prevState.playerTeamId);
    if (oldTeam) {
      updatedProfile = finalizeStintAndSeasonToProfile({
        profile: updatedProfile,
        season: seasonStr,
        clubName: oldTeam.name,
        country: oldCountry,
        division: oldDivision,
        teamStats: oldTeam,
        stintBaseline: prevState.stintBaseline,
        isSeasonComplete: false,
        exitNote: `Moved mid-season (After R${oldTeam.played || 0})`
      });
    }
  }

  let worldState = initializeWorldState({
    country: oldCountry,
    division: oldDivision,
    region: oldRegion,
    season: seasonStr,
    teams: prevState.teams || [],
    playerTeamId: prevState.playerTeamId,
    existingWorldState: prevState.worldState
  });

  // 2. Old club gets a new AI manager (never USER!) so the league can continue cleanly
  if (!prevState.isUnemployed && prevState.playerTeamId !== null && prevState.playerTeamId !== undefined) {
    const oldTeam = prevState.teams?.find((t) => t.idnum === prevState.playerTeamId);
    if (oldTeam) {
      const oldClubKey = normalizeClubKey(oldCountry, oldTeam.name);
      const oldRating = ((oldTeam.attack || 5) + (oldTeam.midfield || 5) + (oldTeam.defense || 5)) / 3;
      appointReplacementAiManager(worldState, oldClubKey, oldCountry, oldRating, seasonStr);
    }
  }

  const targetCountry = String(targetJob.country || oldCountry).toLowerCase();
  const targetDivision = targetJob.division || 1;
  const targetRegion = getRegionForCountry(targetCountry);
  const isSameActiveLeague = targetCountry === oldCountry && targetDivision === oldDivision && Array.isArray(prevState.teams) && prevState.teams.length > 0;

  // Remove accepted club from vacancies and directOffers
  const targetClubKey = normalizeClubKey(targetCountry, targetJob.name);
  worldState.vacancies = (worldState.vacancies || []).filter((v) => v.clubKey !== targetClubKey);
  worldState.directOffers = (worldState.directOffers || []).filter((o) => o.clubKey !== targetClubKey);

  // Release any current AI manager at target club to freeAgents, and assign USER
  const prevTargetMgrId = worldState.clubManagerMap?.[targetClubKey];
  if (prevTargetMgrId && prevTargetMgrId !== 'USER' && worldState.aiManagers[prevTargetMgrId]) {
    worldState.aiManagers[prevTargetMgrId].currentClubKey = null;
    if (!worldState.freeAgents.includes(prevTargetMgrId)) {
      worldState.freeAgents.push(prevTargetMgrId);
    }
  }
  worldState.clubManagerMap[targetClubKey] = 'USER';

  let nextTeams = prevState.teams;
  let nextFixtures = prevState.fixtures;
  let nextCurrentRound = prevState.currentRound;
  let nextCalendar = prevState.calendar;
  let nextCalendarIndex = prevState.calendarIndex || 0;
  let nextDomesticCupState = prevState.domesticCupState;
  let nextEuropeanCup = prevState.europeanCup;
  let nextEuropeanCupState = prevState.europeanCupState;
  let nextEuropeanQualifierState = prevState.europeanQualifierState;
  let nextPlayerTeamId = null;

  if (isSameActiveLeague) {
    const found = nextTeams.find((t) => t.name.toLowerCase() === targetJob.name.toLowerCase()) || nextTeams.find((t) => t.idnum === targetJob.idnum);
    nextPlayerTeamId = found ? found.idnum : targetJob.idnum;
  } else {
    // Archive old league back into trackedLeagues if tracked in oldRegion (or targetRegion)
    const oldKey = `${oldCountry}_d${oldDivision}`;
    const oldSpecs = new Set(getTrackedLeagueSpecs(targetRegion, seasonShort).map((s) => s.key));
    if (oldSpecs.has(oldKey) && Array.isArray(prevState.teams) && prevState.teams.length > 0) {
      const compactScores = (prevState.fixtures || [])
        .slice(0, oldCompletedRounds)
        .map((rList) => (rList || []).map((f) => `${f.homeScore || 0}-${f.awayScore || 0}`).join(','));
      worldState.trackedLeagues[oldKey] = {
        key: oldKey,
        country: oldCountry,
        division: oldDivision,
        totalRounds: oldTotalRounds,
        roundsSimulated: oldCompletedRounds,
        playedScores: compactScores,
        teams: assignExpectedRanksToTeams(prevState.teams, oldCountry, seasonShort, oldDivision)
      };
    }

    // Grab target league from trackedLeagues OR catch up untracked league on demand (e.g. Ajax!)
    const targetKey = `${targetCountry}_d${targetDivision}`;
    let targetEntry = worldState.trackedLeagues[targetKey];
    if (!targetEntry) {
      const caughtUp = catchUpUntrackedLeague({
        country: targetCountry,
        division: targetDivision,
        season: seasonStr,
        progressPct,
        existingWorldState: worldState
      });
      targetEntry = caughtUp?.entry;
      if (caughtUp?.worldPatch) {
        worldState.aiManagers = caughtUp.worldPatch.aiManagers;
        worldState.clubManagerMap = caughtUp.worldPatch.clubManagerMap;
        worldState.freeAgents = caughtUp.worldPatch.freeAgents;
      }
    } else {
      delete worldState.trackedLeagues[targetKey];
    }

    // Re-filter trackedLeagues if region changed (so tracked leagues match the new continent + Big 5 Europe)
    if (targetRegion !== oldRegion) {
      worldState = initializeWorldState({
        country: targetCountry,
        division: targetDivision,
        region: targetRegion,
        season: seasonStr,
        teams: targetEntry?.teams || [],
        playerTeamId: null,
        existingWorldState: worldState
      });
    }

    const built = buildFixturesFromPlayedScores(
      targetEntry.teams,
      targetCountry,
      targetEntry.playedScores || []
    );
    nextTeams = built.teams;
    nextFixtures = built.fixtures;
    const found = nextTeams.find((t) => t.name.toLowerCase() === targetJob.name.toLowerCase()) || nextTeams.find((t) => t.idnum === targetJob.idnum);
    nextPlayerTeamId = found ? found.idnum : nextTeams[0]?.idnum;
    nextCurrentRound = Math.min(nextFixtures.length + 1, (targetEntry.roundsSimulated || 0) + 1);

    // Fast-simulate target Domestic Cup up to current progress & schedule remaining stages
    const rawD1 = nextTeams.map((t) => ({ ...t, division: targetDivision }));
    const rawD2 = targetDivision === 1
      ? (getRawTeamsForLeague(targetCountry, seasonShort, 2) || [])
      : (getRawTeamsForLeague(targetCountry, seasonShort, 1) || []);
    const targetDomRoster = [...rawD1, ...rawD2];
    nextDomesticCupState = catchUpDomesticCupToRound(
      targetDomRoster,
      nextFixtures.length,
      targetCountry,
      nextPlayerTeamId,
      Math.max(0, nextCurrentRound - 1)
    );

    nextCalendar = buildRemainingMidSeasonCalendar(
      nextCurrentRound,
      nextFixtures.length,
      nextDomesticCupState,
      null,
      null
    );
    nextCalendarIndex = 0;

    // Cross-continent switches reset continental cup for current half-year; same-continent preserves live Europe
    if (targetRegion !== oldRegion) {
      nextEuropeanCup = null;
      nextEuropeanCupState = null;
      nextEuropeanQualifierState = null;
    } else if (prevState.europeanCupState && Array.isArray(prevState.calendar)) {
      const remEuro = prevState.calendar.slice(prevState.calendarIndex || 0).filter((ev) => ev.type === 'europe');
      if (remEuro.length > 0 && nextCalendar.length > 0) {
        const step = Math.max(1, Math.floor(nextCalendar.length / (remEuro.length + 1)));
        [...remEuro].reverse().forEach((ev, i) => {
          const pos = Math.max(1, Math.min(nextCalendar.length, nextCalendar.length - (i + 1) * step));
          nextCalendar.splice(pos, 0, ev);
        });
      }
    }
  }

  // Update newly loaded squad rating if roster was loaded
  if (Array.isArray(newClubLoadedSquad) && newClubLoadedSquad.length > 0 && nextPlayerTeamId !== null) {
    const avg = calculateSquadTacticalAverages(newClubLoadedSquad);
    if (avg) {
      nextTeams = nextTeams.map((t) =>
        t.idnum === nextPlayerTeamId ? { ...t, attack: avg.attack, midfield: avg.midfield, defense: avg.defense } : t
      );
    }
  }

  const newTeamObj = nextTeams.find((t) => t.idnum === nextPlayerTeamId) || nextTeams[0];
  const stintBaseline = newTeamObj
    ? {
      played: newTeamObj.played || 0,
      won: newTeamObj.won || 0,
      drawn: newTeamObj.drawn || 0,
      lost: newTeamObj.lost || 0,
      gf: newTeamObj.gf || 0,
      ga: newTeamObj.ga || 0,
      points: newTeamObj.points || 0
    }
    : { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };

  // Reassign europeanPlayerTeamId if the new club is in the current continental tournament
  if (nextEuropeanCupState && Array.isArray(nextEuropeanCupState.teams) && newTeamObj) {
    const matchInEuro = nextEuropeanCupState.teams.find((t) => t.name.toLowerCase() === newTeamObj.name.toLowerCase());
    nextEuropeanCupState = {
      ...nextEuropeanCupState,
      europeanPlayerTeamId: matchInEuro ? matchInEuro.idnum : null
    };
  }

  const newExpectation = calculateBoardExpectation({
    team: newTeamObj,
    allTeams: nextTeams,
    country: targetCountry,
    season: seasonShort,
    division: targetDivision
  });
  const newCupExpectation = nextDomesticCupState
    ? getDomesticCupExpectation(newTeamObj || {}, nextDomesticCupState.bracketSize)
    : null;

  // Compute realistic budget if caller didn't fetch team details
  const avgR = newTeamObj ? ((newTeamObj.attack + newTeamObj.midfield + newTeamObj.defense) / 3) : 6;
  const norm5 = avgR > 5 ? avgR / 2 : avgR;
  const eraMul = 1 + (parseInt(seasonShort, 10) - 1980) * 0.04;
  const fallbackBudget = Math.max(0.5, parseFloat((Math.pow(norm5, 2.2) * (targetDivision === 2 ? 0.3 : 1.2) * eraMul).toFixed(1)));
  const resolvedBudget = typeof newClubBudget === 'number' ? newClubBudget : fallbackBudget;

  const capCountry = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
  const takeoverNews = {
    id: `news_takeover_${targetClubKey}_${Date.now()}`,
    round: nextCurrentRound,
    dateStr: `Round ${nextCurrentRound}`,
    category: 'board',
    categoryLabel: '✍️ NEW APPOINTMENT',
    title: `🔥 ${newTeamObj.name} Unveil ${managerName || managerProfile?.name || 'Manager'} as New Boss!`,
    summary: `In a dramatic mid-season twist, ${newTeamObj.name} (${capCountry(targetCountry)}) have appointed you with immediate effect.`,
    body: `The board at ${newTeamObj.name} moved swiftly to secure your signature.\n\nBoard Expectation: ${newExpectation.text}\nTransfer Budget: $${resolvedBudget.toFixed(1)}M\nMatches Played So Far: ${stintBaseline.played} (${stintBaseline.points} pts)`,
    isRead: false,
    timestamp: Date.now()
  };

  const nextLeagueState = {
    ...prevState,
    season: seasonStr,
    country: targetCountry,
    region: targetRegion,
    division: targetDivision,
    playerTeamId: nextPlayerTeamId,
    managerName: managerName || prevState.managerName || managerProfile?.name || 'Sir Alex',
    isUnemployed: false,
    isSacked: false,
    warningSacked: undefined,
    stintBaseline,
    boardExpectation: newExpectation,
    domesticCupExpectation: newCupExpectation,
    domesticCupState: nextDomesticCupState,
    currentRound: nextCurrentRound,
    teams: nextTeams,
    fixtures: nextFixtures,
    europeanCup: nextEuropeanCup,
    europeanCupState: nextEuropeanCupState,
    europeanQualifierState: nextEuropeanQualifierState,
    calendar: nextCalendar,
    calendarIndex: nextCalendarIndex,
    fanConfidence: 60,
    budget: resolvedBudget,
    payrollBudget: typeof newClubPayroll === 'number' ? newClubPayroll : prevState.payrollBudget,
    worldState,
    newsFeed: appendAndPruneNews(prevState.newsFeed, takeoverNews, nextCurrentRound)
  };

  return { nextLeagueState, updatedProfile, takeoverNews, newTeamObj };
}

/**
 * Full async mid-season takeover loader (ensures rosters & club finances are preloaded).
 */
export async function prepareMidSeasonTakeover({
  leagueState,
  targetJob,
  managerProfile,
  editName = null
}) {
  const seasonStr = leagueState?.season || '2001/02';
  const seasonShort = String(seasonStr).split('/')[0];

  await loadSeasonRosters(seasonShort);
  const nextDetails = getTeamDetailsSync(targetJob.name, seasonShort);
  const newClubSquad = await getPrebuiltRoster(targetJob.name, seasonStr);

  const budget = nextDetails?.finances && typeof nextDetails.finances.transferBudget === 'number'
    ? nextDetails.finances.transferBudget
    : null;
  const payroll = nextDetails?.finances && typeof nextDetails.finances.estimatedWeeklyPayroll === 'number'
    ? Math.round(nextDetails.finances.estimatedWeeklyPayroll * 1.12)
    : null;

  return executeMidSeasonTakeoverCore({
    leagueState,
    targetJob,
    managerProfile,
    managerName: editName,
    newClubBudget: budget,
    newClubPayroll: payroll,
    newClubLoadedSquad: newClubSquad
  });
}

/**
 * Puts the manager into Unemployed mode instead of dead-ending the career when sacked or resigning.
 */
export function enterUnemployedMode({ leagueState, managerProfile, reason = 'Sacked by the Board' }) {
  const stateCopy = JSON.parse(JSON.stringify(leagueState));
  const oldTeam = stateCopy.teams?.find((t) => t.idnum === stateCopy.playerTeamId);
  let updatedProfile = { ...managerProfile };

  if (oldTeam && !stateCopy.isUnemployed) {
    updatedProfile = finalizeStintAndSeasonToProfile({
      profile: updatedProfile,
      season: stateCopy.season,
      clubName: oldTeam.name,
      country: stateCopy.country,
      division: stateCopy.division || 1,
      teamStats: oldTeam,
      stintBaseline: stateCopy.stintBaseline,
      isSeasonComplete: false,
      exitNote: reason
    });
  }

  let worldState = initializeWorldState({
    country: stateCopy.country,
    division: stateCopy.division || 1,
    region: stateCopy.region || getRegionForCountry(stateCopy.country),
    season: stateCopy.season,
    teams: stateCopy.teams || [],
    playerTeamId: null,
    existingWorldState: stateCopy.worldState
  });

  if (oldTeam) {
    const oldClubKey = normalizeClubKey(stateCopy.country, oldTeam.name);
    const oldRating = ((oldTeam.attack || 5) + (oldTeam.midfield || 5) + (oldTeam.defense || 5)) / 3;
    appointReplacementAiManager(worldState, oldClubKey, stateCopy.country, oldRating, stateCopy.season);
  }

  if (stateCopy.europeanCupState) {
    stateCopy.europeanCupState.europeanPlayerTeamId = null;
  }

  const newsItem = {
    id: `news_unemployed_${Date.now()}`,
    round: stateCopy.currentRound || 1,
    dateStr: `Round ${stateCopy.currentRound || 1}`,
    category: 'board',
    categoryLabel: '💼 FREE AGENT MANAGER',
    title: `👔 You Are Now an Unemployed Manager`,
    summary: `${reason}. Track live world tables, advance weeks, and apply for openings in the Jobs tab!`,
    body: `${reason}.\n\nYour career continues — advance week-by-week to watch clubs sack underperforming bosses and apply for your next job.`,
    isRead: false,
    timestamp: Date.now()
  };

  return {
    nextLeagueState: {
      ...stateCopy,
      isUnemployed: true,
      isSacked: false,
      warningSacked: undefined,
      playerTeamId: null,
      stintBaseline: null,
      worldState,
      newsFeed: appendAndPruneNews(stateCopy.newsFeed, newsItem, stateCopy.currentRound || 1)
    },
    updatedProfile
  };
}

/**
 * Advances 1 calendar event (league round or domestic cup) when managing as an Unemployed Manager.
 */
export function simulateUnemployedWeek(leagueState, managerPrestige = 0) {
  if (!leagueState) return null;
  let stateCopy = JSON.parse(JSON.stringify(leagueState));
  const totalRounds = getTotalRoundsForTeams(stateCopy.teams, stateCopy.country, stateCopy.fixtures);
  const calIdx = stateCopy.calendarIndex || 0;
  const currentEvent = stateCopy.calendar && calIdx < stateCopy.calendar.length
    ? stateCopy.calendar[calIdx]
    : (stateCopy.currentRound <= totalRounds ? { type: 'league', index: stateCopy.currentRound } : null);

  if (!currentEvent) {
    return { nextLeagueState: stateCopy, simulatedType: 'season_end', simulatedFixtures: [] };
  }

  let simulatedFixtures = [];
  let simulatedType = currentEvent.type;

  if (currentEvent.type === 'league') {
    const rFixtures = stateCopy.fixtures?.[currentEvent.index - 1] || [];
    rFixtures.forEach((f) => {
      if (!f.played) {
        const h = stateCopy.teams.find((t) => t.idnum === f.homeId);
        const a = stateCopy.teams.find((t) => t.idnum === f.awayId);
        if (h && a) {
          const { homeGoals, awayGoals } = simulateFixture(h, a);
          f.homeScore = homeGoals;
          f.awayScore = awayGoals;
          f.played = true;
        }
      }
    });
    // Recompute active league table
    stateCopy.teams.forEach((t) => {
      t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0; t.gf = 0; t.ga = 0; t.points = 0;
    });
    (stateCopy.fixtures || []).forEach((roundList) => {
      (roundList || []).forEach((f) => {
        if (!f.played) return;
        const h = stateCopy.teams.find((t) => t.idnum === f.homeId);
        const a = stateCopy.teams.find((t) => t.idnum === f.awayId);
        if (!h || !a) return;
        h.played += 1; a.played += 1;
        h.gf += f.homeScore; h.ga += f.awayScore;
        a.gf += f.awayScore; a.ga += f.homeScore;
        if (f.homeScore > f.awayScore) { h.won += 1; h.points += 3; a.lost += 1; }
        else if (f.awayScore > f.homeScore) { a.won += 1; a.points += 3; h.lost += 1; }
        else { h.drawn += 1; h.points += 1; a.drawn += 1; a.points += 1; }
      });
    });
    stateCopy.currentRound = currentEvent.index + 1;
    simulatedFixtures = rFixtures;
  } else if ((currentEvent.type === 'domestic_cup' || currentEvent.isDomesticCup) && stateCopy.domesticCupState && !stateCopy.domesticCupState.isCompleted) {
    const stg = stateCopy.domesticCupState.stage;
    const matches = stateCopy.domesticCupState.knockoutState?.[stg] || [];
    matches.forEach((m) => {
      if (!m.played) {
        const h = stateCopy.domesticCupState.participatingTeams?.find((t) => t.idnum === m.homeId) || { attack: 5, midfield: 5, defense: 5 };
        const a = stateCopy.domesticCupState.participatingTeams?.find((t) => t.idnum === m.awayId) || { attack: 5, midfield: 5, defense: 5 };
        const { homeGoals, awayGoals } = simulateFixture(h, a);
        m.homeScore = homeGoals;
        m.awayScore = awayGoals;
        m.played = true;
        if (m.homeScore === m.awayScore) {
          if (Math.random() < 0.5) { m.penaltyHomeScore = 5; m.penaltyAwayScore = 4; }
          else { m.penaltyHomeScore = 4; m.penaltyAwayScore = 5; }
        }
      }
    });
    stateCopy.domesticCupState = advanceDomesticCup(stateCopy.domesticCupState);
    simulatedFixtures = matches;
  }

  if (stateCopy.calendar) {
    stateCopy.calendarIndex = calIdx + 1;
  }

  const synced = syncWorldProgressAndJobs({
    leagueState: stateCopy,
    managerPrestige,
    boardConfidence: 50,
    forceTick: true
  });
  stateCopy.worldState = synced.worldState;
  if (synced.newsItems.length > 0) {
    stateCopy.newsFeed = appendAndPruneNews(stateCopy.newsFeed, synced.newsItems, stateCopy.currentRound || 1);
  }

  return { nextLeagueState: stateCopy, simulatedType, simulatedFixtures };
}

/**
 * Returns formatted table entries for active league + all tracked foreign/D2 leagues for the WORLD TABLES UI.
 */
export function getAllViewableWorldLeagues(leagueState) {
  if (!leagueState) return [];
  const activeKey = `${leagueState.country}_d${leagueState.division || 1}`;
  const list = [
    {
      key: activeKey,
      country: leagueState.country,
      division: leagueState.division || 1,
      isCurrent: true,
      roundsSimulated: Math.max(0, (leagueState.currentRound || 1) - 1),
      totalRounds: getTotalRoundsForTeams(leagueState.teams, leagueState.country, leagueState.fixtures),
      teams: sortTeamsForTable(leagueState.teams || [])
    }
  ];

  const tracked = leagueState.worldState?.trackedLeagues || {};
  Object.values(tracked).forEach((entry) => {
    list.push({
      key: entry.key,
      country: entry.country,
      division: entry.division || 1,
      isCurrent: false,
      roundsSimulated: entry.roundsSimulated || 0,
      totalRounds: entry.totalRounds || 38,
      teams: sortTeamsForTable(entry.teams || [])
    });
  });

  return list.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (a.division !== b.division) return a.division - b.division;
    return String(a.country).localeCompare(String(b.country));
  });
}

export { CUP_STAGE_NAMES };
