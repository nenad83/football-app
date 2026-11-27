// Handles historical federation splits and club identity renames across Ex-Yugoslavia
// (1988-2026) and the Soviet Union (1988-1991 -> Russia / Ukraine).

export const EX_YUGOSLAVIA_COUNTRIES = new Set(['yugoslavia', 'croatia', 'fr_yugoslavia', 'serbia']);
export const HISTORICAL_FEDERATION_COUNTRIES = new Set(['yugoslavia', 'croatia', 'fr_yugoslavia', 'serbia', 'ussr']);

const RUSSIAN_CLUBS_FROM_USSR = new Set([
  'spartak moscow',
  'cska moscow',
  'torpedo moscow',
  'dynamo moscow',
  'lokomotiv moscow',
  'spartak vladikavkaz',
  'zenit leningrad',
  'zenit st. petersburg',
  'zenit st petersburg',
  'rotor volgograd'
]);

const UKRAINIAN_CLUBS_FROM_USSR = new Set([
  'dynamo kyiv',
  'dnipro',
  'chornomorets odesa',
  'shakhtar donetsk',
  'metalist kharkiv',
  'metalurh zaporizhzhia'
]);

const USSR_1990_WITHDRAWALS = new Set([
  'zalgiris vilnius',
  'dinamo tbilisi'
]);

const CROATIAN_CLUBS_FROM_YUG = new Set([
  'dinamo zagreb',
  'hask gradjanski',
  'croatia zagreb',
  'hajduk split',
  'rijeka',
  'nk osijek',
  'osijek'
]);

const FRY_1992_CONTINUATION_CLUBS = new Set([
  'red star belgrade',
  'partizan',
  'fk vojvodina',
  'ofk beograd',
  'proleter zrenjanin',
  'rad',
  'borac banja luka',
  'zemun',
  'radnicki nis',
  'buducnost podgorica',
  'sutjeska niksic',
  'spartak subotica'
]);

const MONTENEGRIN_CLUBS = new Set([
  'zeta',
  'buducnost podgorica',
  'jedinstvo bijelo polje',
  'sutjeska niksic',
  'mogren',
  'rudar pljevlja',
  'kom'
]);

/**
 * Resolves historical club renames for a destination federation + start year.
 */
export function resolveHistoricalClubName(clubName = '', targetCountry = '', nextStartYr = 1991) {
  const clean = String(clubName || '').trim();
  const low = clean.toLowerCase();
  const c = String(targetCountry || '').toLowerCase().trim();
  const yr = parseInt(nextStartYr, 10) || 1991;

  if (low === 'dinamo zagreb' || low === 'hask gradjanski' || low === 'croatia zagreb') {
    if (c === 'croatia') {
      if (yr === 1991) return 'HASK Gradjanski';
      if (yr >= 1992 && yr <= 1998) return 'Croatia Zagreb';
    }
    return 'Dinamo Zagreb';
  }
  if (low === 'osijek' || low === 'nk osijek') {
    return 'NK Osijek';
  }
  if (low === 'sartid smederevo' || low === 'smederevo') {
    return yr >= 2004 ? 'Smederevo' : 'Sartid Smederevo';
  }
  if (low === 'buducnost banatski dvor' || low === 'banat zrenjanin') {
    return (c === 'serbia' || yr >= 2006) ? 'Banat Zrenjanin' : 'Buducnost Banatski Dvor';
  }
  if (low === 'radnicki kragujevac' || low === 'radnicki 1923') {
    return (c === 'serbia' && yr >= 2011) ? 'Radnicki 1923' : 'Radnicki Kragujevac';
  }
  if (low === 'inker zapresic' || low === 'inter zapresic') {
    return yr >= 2003 ? 'Inter Zapresic' : 'Inker Zapresic';
  }
  if (low === 'varteks' || low === 'varazdin') {
    return (yr === 2010 || yr === 2011 || yr >= 2019) ? 'Varazdin' : 'Varteks';
  }
  if (low === 'istra 1961' || low === 'pula 1856') {
    return (yr >= 2004 && yr <= 2006) ? 'Pula 1856' : 'Istra 1961';
  }
  if (low === 'zenit leningrad' || low === 'zenit st. petersburg' || low === 'zenit st petersburg') {
    return (c === 'russia' || yr >= 1992) ? 'Zenit St. Petersburg' : 'Zenit Leningrad';
  }
  return clean;
}

/**
 * Returns default successor federation for job offer pools when a federation dissolves.
 */
export function getSuccessorFederation(country = '', nextStartYr = 1992) {
  const c = String(country || '').toLowerCase().trim();
  const yr = parseInt(nextStartYr, 10) || 1992;
  if (c === 'yugoslavia' && yr >= 1992) return 'fr_yugoslavia';
  if (c === 'fr_yugoslavia' && yr >= 2006) return 'serbia';
  if (c === 'ussr' && yr >= 1992) return 'russia';
  return c;
}

/**
 * Resolves a single club's federation & club name across season rollover.
 */
export function getClubSplitDestination({ country = '', clubName = '', nextStartYr = 1991 }) {
  const c = String(country || '').toLowerCase().trim();
  const yr = parseInt(nextStartYr, 10) || 1991;
  const low = String(clubName || '').trim().toLowerCase();

  if (c === 'yugoslavia' && yr === 1991) {
    if (CROATIAN_CLUBS_FROM_YUG.has(low)) {
      return {
        country: 'croatia',
        nextName: resolveHistoricalClubName(clubName, 'croatia', yr),
        canRenew: true,
        exitReason: null
      };
    }
    if (low === 'olimpija ljubljana') {
      return {
        country: null,
        nextName: clubName,
        canRenew: false,
        exitReason: 'Olimpija Ljubljana departed for the Slovenian PrvaLiga following the 1991 breakup.'
      };
    }
    return {
      country: 'yugoslavia',
      nextName: resolveHistoricalClubName(clubName, 'yugoslavia', yr),
      canRenew: true,
      exitReason: null
    };
  }

  if (c === 'yugoslavia' && yr >= 1992) {
    if (FRY_1992_CONTINUATION_CLUBS.has(low)) {
      return {
        country: 'fr_yugoslavia',
        nextName: resolveHistoricalClubName(clubName, 'fr_yugoslavia', yr),
        canRenew: true,
        exitReason: null
      };
    }
    return {
      country: null,
      nextName: clubName,
      canRenew: false,
      exitReason: `${clubName} withdrew following the 1992 dissolution of SFR Yugoslavia.`
    };
  }

  if (c === 'fr_yugoslavia' && yr >= 2006) {
    if (MONTENEGRIN_CLUBS.has(low)) {
      return {
        country: null,
        nextName: clubName,
        canRenew: false,
        exitReason: `${clubName} moved to the Montenegrin First League after the 2006 state union dissolution.`
      };
    }
    return {
      country: 'serbia',
      nextName: resolveHistoricalClubName(clubName, 'serbia', yr),
      canRenew: true,
      exitReason: null
    };
  }

  if (c === 'ussr' && yr === 1990) {
    if (USSR_1990_WITHDRAWALS.has(low)) {
      return {
        country: null,
        nextName: clubName,
        canRenew: false,
        exitReason: `${clubName} withdrew from the Soviet Top League ahead of the 1990 season.`
      };
    }
    return {
      country: 'ussr',
      nextName: resolveHistoricalClubName(clubName, 'ussr', yr),
      canRenew: true,
      exitReason: null
    };
  }

  if (c === 'ussr' && yr >= 1992) {
    if (RUSSIAN_CLUBS_FROM_USSR.has(low)) {
      return {
        country: 'russia',
        nextName: resolveHistoricalClubName(clubName, 'russia', yr),
        canRenew: true,
        exitReason: null
      };
    }
    if (UKRAINIAN_CLUBS_FROM_USSR.has(low)) {
      return {
        country: 'ukraine',
        nextName: resolveHistoricalClubName(clubName, 'ukraine', yr),
        canRenew: true,
        exitReason: null
      };
    }
    return {
      country: null,
      nextName: clubName,
      canRenew: false,
      exitReason: `${clubName} moved to its newly independent national league after the 1991 dissolution of the Soviet Union.`
    };
  }

  return {
    country: c,
    nextName: resolveHistoricalClubName(clubName, c, yr),
    canRenew: true,
    exitReason: null
  };
}

/**
 * Builds next season teams and rollover metadata for an ex-Yugoslavia career.
 */
export function buildExYugoslaviaNextSeason({
  country,
  nextStartYr,
  teams = [],
  playerTeamId = null,
  leagueDataMap = {},
  scaleStat = (v) => v
}) {
  const playerTeam = teams.find((t) => t.idnum === playerTeamId) || null;
  const split = playerTeam
    ? getClubSplitDestination({ country, clubName: playerTeam.name, nextStartYr })
    : { country: getSuccessorFederation(country, nextStartYr), nextName: '', canRenew: false, exitReason: null };

  const targetCountry = split.canRenew && split.country
    ? split.country
    : getSuccessorFederation(country, nextStartYr);

  const nextYrStr = String(nextStartYr);
  const rawNextRoster = (leagueDataMap[nextYrStr] && leagueDataMap[nextYrStr][targetCountry]) || [];
  let baseList = rawNextRoster.map((t, idx) => ({
    ...t,
    idnum: t.idnum !== undefined ? t.idnum : idx,
    attack: (t.attack <= 5 && t.midfield <= 5 && t.defense <= 5) ? scaleStat(t.attack) : t.attack,
    midfield: (t.attack <= 5 && t.midfield <= 5 && t.defense <= 5) ? scaleStat(t.midfield) : t.midfield,
    defense: (t.attack <= 5 && t.midfield <= 5 && t.defense <= 5) ? scaleStat(t.defense) : t.defense,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0
  }));

  let resolvedPlayerTeamId = null;
  if (split.canRenew && playerTeam && baseList.length > 0) {
    const targetName = split.nextName || playerTeam.name;
    let found = baseList.find((t) => t.name.toLowerCase() === targetName.toLowerCase());
    if (!found) {
      // Preserve player's club in top flight if promoted/spared in alternate career history
      const lastSlot = baseList[baseList.length - 1];
      const replacement = {
        ...playerTeam,
        idnum: lastSlot.idnum,
        id: lastSlot.id,
        name: targetName,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        points: 0
      };
      baseList = [...baseList.slice(0, baseList.length - 1), replacement];
      found = replacement;
    }
    resolvedPlayerTeamId = found ? found.idnum : null;
  }

  return {
    targetCountry,
    nextTeams: baseList,
    resolvedPlayerTeamName: split.canRenew ? (split.nextName || playerTeam?.name || '') : '',
    resolvedPlayerTeamId,
    canRenew: Boolean(split.canRenew),
    exitReason: split.exitReason || null
  };
}
