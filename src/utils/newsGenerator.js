// src/utils/newsGenerator.js
// Utility to generate Football Manager-style dynamic news stories

import {
  getPrebuiltRosterSync,
  getTeamDetailsSync,
  resolveHistoricalFormationOverride
} from '../data/rosters/rosterRegistry';
import { getCPUFormation } from '../components/FormationTactics';

export const NEWS_RETENTION_ROUNDS = 5;

/**
 * Prunes news items older than `keepRounds` (default: 5) relative to `currentRound`.
 */
export const pruneNewsFeed = (newsFeed = [], currentRound = 1, keepRounds = NEWS_RETENTION_ROUNDS) => {
  if (!Array.isArray(newsFeed)) return [];
  const curr = Math.max(1, Number(currentRound) || 1);
  const windowSize = Math.max(1, Number(keepRounds) || NEWS_RETENTION_ROUNDS);
  const minRound = curr - (windowSize - 1);
  return newsFeed.filter((item) => {
    if (!item) return false;
    const itemRound = Number(item.round);
    if (Number.isNaN(itemRound)) return true;
    return itemRound >= minRound;
  });
};

/**
 * Prepends new items and trims anything older than `keepRounds` rounds.
 */
export const appendAndPruneNews = (existingFeed = [], newItems = [], currentRound = 1, keepRounds = NEWS_RETENTION_ROUNDS) => {
  const items = Array.isArray(newItems) ? newItems.filter(Boolean) : (newItems ? [newItems] : []);
  const combined = [...items, ...(Array.isArray(existingFeed) ? existingFeed : [])];
  return pruneNewsFeed(combined, currentRound, keepRounds);
};

export const CATEGORY_CONFIG = {
  match: { label: 'MATCH RECAP', color: '#00ff64', icon: '⚽' },
  preview: { label: 'TACTICAL PREVIEW', color: '#00e5ff', icon: '🧠' },
  medical: { label: 'MEDICAL REPORT', color: '#ff3366', icon: '🏥' },
  board: { label: 'BOARDROOM', color: '#e040fb', icon: '💼' },
  transfer: { label: 'TRANSFER DESK', color: '#ffd700', icon: '💰' },
  league: { label: 'LEAGUE ROUNDUP', color: '#ff9100', icon: '📰' },
  cup: { label: 'DOMESTIC CUP', color: '#ff0055', icon: '🏆' },
  derby: { label: 'RIVALRY CLASH', color: '#ff3344', icon: '⚔️' },
  pressure: { label: 'MEDIA SPOTLIGHT', color: '#e6005c', icon: '🔥' },
  drama: { label: 'SEASON DRAMA', color: '#9c27b0', icon: '🎯' },
  award: { label: 'MONTHLY AWARDS', color: '#ffd700', icon: '🏆' },
  yearlyAward: { label: 'ANNUAL AWARDS', color: '#ffd700', icon: '👑' }
};

/**
 * Historical Derbies and Famous Football Rivalries
 */
export const RIVALRIES = [
  // England
  { teams: ["liverpool", "manchester united"], name: "North-West Derby", desc: "England's two most decorated titans collide in one of world football's fiercest rivalries." },
  { teams: ["everton", "liverpool"], name: "Merseyside Derby", desc: "The pride of Merseyside is at stake in this historic cross-park clash." },
  { teams: ["manchester city", "manchester united"], name: "Manchester Derby", desc: "A fierce battle for municipal bragging rights and league supremacy." },
  { teams: ["arsenal", "tottenham"], name: "North London Derby", desc: "North London divides as two eternal neighbors lock horns in an intense showdown." },
  { teams: ["arsenal", "manchester united"], name: "Premier League Classic", desc: "Two of English football's defining empires locked in a generational title rivalry." },
  { teams: ["arsenal", "chelsea"], name: "London Derby", desc: "Capital pride on the line in this high-stakes London heavyweight showdown." },
  { teams: ["chelsea", "tottenham"], name: "Battle of London", desc: "Fierce London rivals clash in a fixture renowned for high drama and bad blood." },
  { teams: ["chelsea", "liverpool"], name: "Modern Heavyweight Rivalry", desc: "High-stakes domestic and European history fuels this intense modern rivalry." },
  { teams: ["liverpool", "manchester city"], name: "Modern Title Rivalry", desc: "Two heavyweights contesting the pinnacle of modern English football." },
  { teams: ["newcastle", "sunderland"], name: "Tyne-Wear Derby", desc: "The passionate North East comes to a complete standstill." },
  { teams: ["aston villa", "birmingham"], name: "Second City Derby", desc: "Raw Birmingham passion ignites in this ferocious rivalry." },
  { teams: ["leeds", "manchester united"], name: "Roses Rivalry", desc: "Historic regional enmity reignites in a fast and furious contest." },
  { teams: ["chelsea", "manchester united"], name: "Title Contenders Clash", desc: "Two English powerhouses with no love lost between them." },
  { teams: ["millwall", "west ham"], name: "Dockers Derby", desc: "One of East London's oldest and most fiercely contested rivalries." },

  // Spain
  { teams: ["barcelona", "real madrid"], name: "El Clásico", desc: "The biggest and most prestigious match in club football history." },
  { teams: ["atletico", "real madrid"], name: "El Derbi Madrileño", desc: "A clash of styles, pride, and silverware in the Spanish capital." },
  { teams: ["atletico", "barcelona"], name: "La Liga Titan Clash", desc: "High-intensity battles for Spanish supremacy." },
  { teams: ["betis", "sevilla"], name: "El Gran Derbi", desc: "Seville boils over with pure Spanish passion and intense municipal bragging rights." },
  { teams: ["athletic", "sociedad"], name: "Basque Derby", desc: "Pride and heritage meet in the fiery traditional Basque encounter." },
  { teams: ["barcelona", "espanyol"], name: "Derbi Barceloní", desc: "Catalan bragging rights on the line in the battle for Barcelona." },
  { teams: ["valencia", "villarreal"], name: "Derbi de la Comunitat", desc: "Valencian community supremacy is fiercely contested." },
  { teams: ["real madrid", "valencia"], name: "Spanish Heavyweight Rivalry", desc: "Fierce hostility whenever the capital giants face Valencia." },
  { teams: ["celta", "deportivo"], name: "O Noso Derbi", desc: "Galician supremacy contested between Vigo and A Coruña." },

  // Italy
  { teams: ["inter", "juventus"], name: "Derby d'Italia", desc: "Italian football's headline fixture brimming with bad blood, controversy, and title stakes." },
  { teams: ["milan", "inter"], name: "Derby della Madonnina", desc: "The shared cathedral of San Siro rocks in the clash of the Milanese giants." },
  { teams: ["juventus", "milan"], name: "Scudetto Rivalry", desc: "Italy's two most successful clubs battle for domestic and continental glory." },
  { teams: ["lazio", "roma"], name: "Derby della Capitale", desc: "The eternal city boils over in one of the most hostile, emotional derbies on earth." },
  { teams: ["juventus", "roma"], name: "Serie A Grudge Match", desc: "Decades of bitter title battles separate Turin and Rome." },
  { teams: ["juventus", "torino"], name: "Derby della Mole", desc: "Turin divides between the aristocrats and the working-class soul of Il Toro." },
  { teams: ["genoa", "sampdoria"], name: "Derby della Lanterna", desc: "Genoa's historic maritime rivals battle under the shadow of the Lanterna." },
  { teams: ["napoli", "roma"], name: "Derby del Sole", desc: "Southern fire meets capital pride in this electrifying Italian clash." },
  { teams: ["juventus", "napoli"], name: "North-South Rivalry", desc: "Historic regional tension between Turin's establishment and Naples' passion." },
  { teams: ["fiorentina", "juventus"], name: "Rivalry of the Century", desc: "Florence rises in hostile fury against their black-and-white arch-enemies." },

  // Germany
  { teams: ["dortmund", "schalke"], name: "Revierderby", desc: "The mother of all German derbies: Ruhr valley passion and industrial grit." },
  { teams: ["bayern", "dortmund"], name: "Der Klassiker", desc: "Germany's modern titans collide in a match that often crowns champions." },
  { teams: ["bayern", "leverkusen"], name: "Bundesliga Power Clash", desc: "Fierce competition at the summit of German football." },
  { teams: ["bayern", "schalke"], name: "Bundesliga Grudge Match", desc: "Intense rivalry between Gelsenkirchen and Munich." },
  { teams: ["hamburg", "bremen"], name: "Nordderby", desc: "The fight for supremacy in northern Germany." },
  { teams: ["koln", "monchengladbach"], name: "Rheinderby", desc: "Rhineland pride is on the line in this heated regional contest." },
  { teams: ["koln", "leverkusen"], name: "Rhine Neighbours Rivalry", desc: "Local Rhine rivals battle for regional dominance." },
  { teams: ["bayern", "1860"], name: "Münchner Stadtderby", desc: "Historic Munich neighbors collide for Bavarian city bragging rights." },

  // France
  { teams: ["marseille", "paris"], name: "Le Classique", desc: "France's fiercest grudge match: Capital glamour meets Mediterranean fire." },
  { teams: ["lyon", "saint-etienne"], name: "Derby Rhône-Alpes", desc: "Historic hostility in eastern France between two proud institutions." },
  { teams: ["lyon", "marseille"], name: "Choc des Olympiques", desc: "France's two great Olympiques battle for prestige." },
  { teams: ["lyon", "paris"], name: "Ligue 1 Summit Rivalry", desc: "Modern French heavyweights clash for domestic dominance." },
  { teams: ["lens", "lille"], name: "Derby du Nord", desc: "Passionate northern French rivalry fought with unrelenting intensity." },
  { teams: ["monaco", "nice"], name: "Derby de la Côte d'Azur", desc: "French Riviera pride and prestige contested on the Mediterranean coast." },

  // Scotland, Netherlands, Portugal, Russia
  { teams: ["celtic", "rangers"], name: "Old Firm Derby", desc: "One of the most intense, politically and culturally charged rivalries in all of sport." },
  { teams: ["hearts", "hibernian"], name: "Edinburgh Derby", desc: "Scotland's historic capital divides between maroon and green." },
  { teams: ["ajax", "feyenoord"], name: "De Klassieker", desc: "Amsterdam vs Rotterdam: the cultural and footballing war for the Netherlands." },
  { teams: ["ajax", "psv"], name: "De Topper", desc: "The two dominant titans of Dutch football battle for the Eredivisie crown." },
  { teams: ["feyenoord", "psv"], name: "Dutch Heavyweight Clash", desc: "Rotterdam grit meets Eindhoven power." },
  { teams: ["benfica", "porto"], name: "O Clássico", desc: "Lisbon capital pedigree meets the unyielding dragon spirit of the north." },
  { teams: ["benfica", "sporting"], name: "Derbi de Lisboa", desc: "The capital derby that has divided Lisbon for over a century." },
  { teams: ["porto", "sporting"], name: "Clássico dos Dragões e Leões", desc: "Fierce Portuguese rivalry between North and South." },
  { teams: ["cska moscow", "spartak moscow"], name: "Main Moscow Derby", desc: "Russia's fiercest and most historic capital rivalry." },
  { teams: ["spartak moscow", "zenit"], name: "Two Capitals Derby", desc: "Moscow and St. Petersburg clash for Russian football supremacy." },
  { teams: ["dynamo moscow", "spartak moscow"], name: "Oldest Moscow Derby", desc: "Decades of history divide Moscow's oldest rivals." },

  // Belgium, Sweden, Denmark, Ex-Yugoslavia
  { teams: ["anderlecht", "club brugge"], name: "De Topper", desc: "Belgium's two most decorated clubs battle for supremacy." },
  { teams: ["anderlecht", "standard liege"], name: "Belgian Clásico", desc: "Brussels vs Liège in Belgium's fiercest historical rivalry." },
  { teams: ["aik", "djurgarden"], name: "Tvillingderbyt", desc: "Stockholm's twin giants collide in Sweden's fiercest capital derby." },
  { teams: ["malmo ff", "ifk goteborg"], name: "Swedish Classic", desc: "Sweden's two all-time most successful clubs lock horns." },
  { teams: ["fc copenhagen", "brondby"], name: "The New Firm", desc: "Denmark's fiercely contested Copenhagen derby stops the capital." },
  { teams: ["red star belgrade", "partizan"], name: "Eternal Derby", desc: "Belgrade splits in half as Serbia's two historic giants clash in the Veciti Derbi." },
  { teams: ["dinamo zagreb", "hajduk split"], name: "Croatian Eternal Derby", desc: "Zagreb vs Split in Croatia's fiercest and most storied football rivalry." },
  { teams: ["croatia zagreb", "hajduk split"], name: "Croatian Eternal Derby", desc: "Zagreb vs Split in Croatia's fiercest and most storied football rivalry." },
  { teams: ["red star belgrade", "dinamo zagreb"], name: "Yugoslav Classic", desc: "Two juggernauts of Yugoslav football face off in an electric encounter." },
  { teams: ["red star belgrade", "hajduk split"], name: "Yugoslav Big Four Clash", desc: "Classic rivalry between two proud pillars of Yugoslav football." },
  { teams: ["partizan", "dinamo zagreb"], name: "Yugoslav Big Four Clash", desc: "High-stakes showdown between two of Yugoslavia's most decorated clubs." },
  { teams: ["spartak moscow", "dynamo kyiv"], name: "Soviet Classic", desc: "Moscow meets Kyiv in the most iconic and fiercely contested rivalry of Soviet football." },

  // South America
  { teams: ["boca", "river"], name: "Superclásico", desc: "A visceral, unforgettable football carnival of pure Argentine devotion." },
  { teams: ["independiente", "racing"], name: "Clásico de Avellaneda", desc: "Two stadiums separated by only a few hundred meters, locked in fierce rivalry." },
  { teams: ["boca", "independiente"], name: "Clásico Grande", desc: "Two Argentine giants with legendary continental pedigrees." },
  { teams: ["huracan", "san lorenzo"], name: "Clásico Porteño", desc: "Neighborhood passion and lifelong rivalry in Buenos Aires." },
  { teams: ["flamengo", "fluminense"], name: "Fla-Flu", desc: "The poetic, legendary Rio de Janeiro spectacle inside the Maracanã." },
  { teams: ["flamengo", "vasco"], name: "Clássico dos Milhões", desc: "Rio de Janeiro's most populous rivalry." },
  { teams: ["corinthians", "palmeiras"], name: "Derby Paulista", desc: "São Paulo's historic, pulse-pounding derby." },
  { teams: ["corinthians", "sao paulo"], name: "Clássico Majestoso", desc: "Fierce São Paulo city supremacy on the line." },
  { teams: ["sao paulo", "santos"], name: "San-São", desc: "Two of Brazil's most celebrated footballing institutions collide." },
  { teams: ["gremio", "internacional"], name: "Grenal", desc: "Porto Alegre's bone-crunching, impassioned southern Brazilian clash." },
  { teams: ["atletico mineiro", "cruzeiro"], name: "Clássico Mineiro", desc: "Belo Horizonte explodes with emotion as rivals clash at the Mineirão." },
  { teams: ["america", "deportivo cali"], name: "Clásico Vallecaucano", desc: "Cali divides in red and green for Colombia's fiercest regional derby." },
  { teams: ["millonarios", "nacional"], name: "Superclásico Colombiano", desc: "Bogotá and Medellín's giants clash in Colombia's biggest rivalry." },
  { teams: ["millonarios", "santa fe"], name: "Clásico Capitalino", desc: "The battle for Bogotá at El Campín." }
];

/**
 * Normalizes team names for fuzzy derby matching
 */
export const normalizeTeamName = (str) => {
  if (!str) return "";
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|ac|as|ssc|bv|afc|cd|rc|sp|fk|sl|sc|de|del|la|el|the)\b/g, '')
    .replace(/[.\-_']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if two teams share a historic derby or rivalry
 */
export const checkDerby = (teamA, teamB) => {
  if (!teamA || !teamB) return null;
  const nA = normalizeTeamName(teamA);
  const nB = normalizeTeamName(teamB);

  return RIVALRIES.find(r => {
    const k0 = r.teams[0];
    const k1 = r.teams[1];
    return (nA.includes(k0) && nB.includes(k1)) || (nA.includes(k1) && nB.includes(k0));
  }) || null;
};

/**
 * Calculate team's consecutive form streaks (wins, unbeaten, losses, winless)
 */
export const calculateTeamStreak = (fixtures, pId, teamName) => {
  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return { wins: 0, unbeaten: 0, losses: 0, winless: 0, totalPlayed: 0 };
  }

  const outcomes = [];
  for (let r = 0; r < fixtures.length; r++) {
    const roundFixtures = fixtures[r];
    if (!Array.isArray(roundFixtures)) continue;
    const f = roundFixtures.find(match => {
      if (!match.played || match.homeScore === undefined || match.awayScore === undefined) return false;
      if (pId !== undefined && (match.homeId === pId || match.awayId === pId)) return true;
      if (teamName && (match.homeTeamName === teamName || match.awayTeamName === teamName)) return true;
      return false;
    });

    if (f) {
      const isHome = pId !== undefined ? (f.homeId === pId) : (f.homeTeamName === teamName);
      const myScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      if (myScore > oppScore) outcomes.push("W");
      else if (myScore < oppScore) outcomes.push("L");
      else outcomes.push("D");
    }
  }

  let wins = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === "W"; i--) wins++;

  let unbeaten = 0;
  for (let i = outcomes.length - 1; i >= 0 && (outcomes[i] === "W" || outcomes[i] === "D"); i--) unbeaten++;

  let losses = 0;
  for (let i = outcomes.length - 1; i >= 0 && outcomes[i] === "L"; i--) losses++;

  let winless = 0;
  for (let i = outcomes.length - 1; i >= 0 && (outcomes[i] === "L" || outcomes[i] === "D"); i--) winless++;

  return { wins, unbeaten, losses, winless, totalPlayed: outcomes.length };
};

/**
 * Convert numeric rating (1-10) into a qualitative tactical label
 */
export const getQualitativeRating = (val) => {
  const num = Math.round(Number(val) || 5);
  if (num >= 9) return "Very Strong";
  if (num >= 7) return "Strong";
  if (num >= 5) return "Solid";
  if (num >= 3) return "Vulnerable";
  return "Poor";
};

/**
 * Retrieve strongest key players for an opponent
 */
export const getKeyOpponentPlayers = (teamName, season) => {
  if (!teamName) return [];
  try {
    let squad = null;
    const localRaw = localStorage.getItem(`retro_roster_${teamName}_${season}`);
    if (localRaw) {
      squad = JSON.parse(localRaw);
    } else {
      squad = getPrebuiltRosterSync(teamName, season);
    }

    if (Array.isArray(squad) && squad.length > 0) {
      const sorted = [...squad].sort((a, b) => {
        const rDiff = (b.rating || 3) - (a.rating || 3);
        if (rDiff !== 0) return rDiff;
        return (b.currentAbility || 0) - (a.currentAbility || 0);
      });
      return sorted.slice(0, 3).map(p => ({
        name: p.name,
        position: p.position,
        rating: p.rating || 3,
        ratingLabel: getQualitativeRating(p.rating || 3)
      }));
    }
  } catch (err) {
    console.warn("[newsGenerator] Could not retrieve key players for", teamName, err);
  }
  return [];
};

/**
 * Generate Transfer Announcement News Item (Signings & Departures)
 */
export const generateTransferAnnouncementNews = ({
  playerName,
  playerPosition,
  playerAge,
  fromClub,
  toClub,
  fee,
  wage,
  contractYears,
  isRival = false,
  isFirstTeam = false,
  rivalryName = "",
  isBuy,
  managerName,
  season,
  round = 1
}) => {
  const timestamp = Date.now();
  const feeStr = fee && Number(fee) > 0 ? `$${Number(fee).toFixed(1)}M` : "Free Transfer";
  const wageStr = wage ? `$${Number(wage).toLocaleString()}/wk` : null;
  const contractStr = contractYears ? `${contractYears}-year contract` : null;
  let title = "";
  let summary = "";
  let body = "";

  if (isBuy) {
    if (isRival) {
      title = `🔥 SHOCK RIVAL RAID: ${toClub} Poach ${playerName} from Arch-Rivals ${fromClub}!`;
    } else if (isFirstTeam) {
      title = `🌟 MARQUEE SIGNING: ${toClub} Land First-XI Star ${playerName} from ${fromClub}!`;
    } else {
      title = `⚽ DONE DEAL: ${toClub} Complete Signing of ${playerName}!`;
    }

    const contractSummary = contractStr && wageStr
      ? ` on a ${contractStr} worth ${wageStr}`
      : (wageStr ? ` on wages of ${wageStr}` : "");

    summary = `${playerName} joins ${toClub} from ${fromClub || 'Free Agency'} for ${feeStr}${contractSummary}.`;

    const rivalParagraph = isRival
      ? `\n\nThe controversial move across the ${rivalryName || 'rivalry'} divide has sent shockwaves through both sets of supporters, with ${toClub} paying a substantial rival premium to force the deal over the line.`
      : (isFirstTeam ? `\n\nPrying a regular starting XI centerpiece away from ${fromClub} required determined negotiation from the ${toClub} boardroom.` : "");

    const contractParagraph = contractStr && wageStr
      ? `\n\nFollowing a successful medical, ${playerName} put pen to paper on a ${contractStr} worth ${wageStr}, immediately joining ${toClub}'s payroll.`
      : "";

    body = `Official Club Announcement: ${toClub} have formally completed the acquisition of ${playerName} (${playerPosition || 'Player'}${playerAge ? `, age ${playerAge}` : ''}) from ${fromClub || 'Free Agency'}.

The deal was ratified today for an agreed transfer fee of ${feeStr}.${rivalParagraph}${contractParagraph}

Manager ${managerName || 'The manager'} spoke glowingly of the new signing at the official unveiling press conference: "${playerName} brings immense quality, technical ability, and proven pedigree to our squad. We are delighted to welcome them to the club."`;
  } else {
    title = `🤝 OFFICIAL: ${playerName} Departs ${fromClub} to Join ${toClub}`;
    summary = `${toClub} agree deal to sign ${playerName} from ${fromClub} for a fee of ${feeStr}${wageStr ? ` (freeing ${wageStr} in payroll)` : ''}.`;
    body = `Club Announcement: ${fromClub} have confirmed the departure of ${playerName} to ${toClub} in a transfer valued at ${feeStr}.

Manager ${managerName || 'The manager'} thanked the player for their service and professionalism during their time at the club: "We thank ${playerName} for their contributions and wish them every success in the next chapter of their career at ${toClub}."

The incoming ${feeStr} fee has been added to the club's transfer budget${wageStr ? `, while ${wageStr} has been freed from the weekly wage bill` : ''}.`;
  }

  return {
    id: `news_transfer_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    round,
    dateStr: "Transfer Desk",
    category: "transfer",
    categoryLabel: CATEGORY_CONFIG.transfer.label,
    title,
    summary,
    body,
    transferWidget: {
      playerName,
      playerPosition: playerPosition || "Player",
      fromClub: fromClub || "Free Agent",
      toClub: toClub || "Club",
      fee: feeStr,
      wage: wageStr,
      contractYears: contractYears || null,
      isRival,
      isFirstTeam,
      type: isBuy ? "signing" : "departure"
    },
    isRead: false,
    timestamp,
    actionTab: "transfers"
  };
};

/**
 * Generate Transfer Bid Rejected News (Club rejects bid due to rival tax, First 11 status, or valuation)
 */
export const generateTransferRejectedNews = ({
  playerName,
  playerPosition,
  playerAge,
  fromClub,
  toClub,
  fee,
  isRival = false,
  isFirstTeam = false,
  rivalryName = "",
  reason = "valuation", // "rival", "first11", "refusal", "valuation"
  round = 0
}) => {
  const timestamp = Date.now();
  const feeStr = `$${Number(fee || 0).toFixed(1)}M`;
  let title = "";
  let summary = "";
  let body = "";

  if (reason === "refusal") {
    title = `🚫 SNUBBED: ${playerName} Refuses to Enter Talks with ${toClub}`;
    summary = `${fromClub} star ${playerName} has no interest in a move to ${toClub} at this stage of his career.`;
    body = `Transfer Desk Report: ${toClub}'s ambitious pursuit of ${playerName} (${playerPosition}, age ${playerAge || 25}) has hit an immediate brick wall.

Representatives for the ${fromClub} standout informed ${toClub} officials that their client has no desire to step down from his current level unless the club significantly improves its standing and silverware credentials.`;
  } else if (isRival) {
    title = `⚔️ BITTER RIVALS STAND FIRM: ${fromClub} Reject ${toClub}'s ${feeStr} Bid for ${playerName}`;
    summary = `Arch-rivals ${fromClub} refuse to do business with ${toClub} over ${playerName} at ${feeStr}.`;
    body = `Transfer Desk Report: ${fromClub} have swiftly rejected a ${feeStr} transfer approach from ${rivalryName || 'bitter'} rivals ${toClub} for ${playerName} (${playerPosition}).

Sources inside ${fromClub}'s boardroom state the club has zero appetite to strengthen a direct rival unless an astronomical, above-market "rival premium" offer is placed on the table.`;
  } else if (isFirstTeam) {
    title = `🛡️ HANDS-OFF WARNING: ${fromClub} Turn Down ${feeStr} Bid for First-XI Star ${playerName}`;
    summary = `${fromClub} insist key starter ${playerName} is indispensable after rebuffing ${toClub}'s ${feeStr} offer.`;
    body = `Transfer Desk Report: ${fromClub} have rebuffed an official ${feeStr} bid from ${toClub} for first-team regular ${playerName} (${playerPosition}).

Because ${playerName} is a cornerstone of ${fromClub}'s starting XI, club hierarchy made it clear that only an extraordinary offer well above market valuation would tempt them to part ways with a key starter.`;
  } else {
    title = `❌ BID REJECTED: ${fromClub} Rebuff ${toClub}'s ${feeStr} Offer for ${playerName}`;
    summary = `Negotiations stall as ${fromClub} deem ${toClub}'s ${feeStr} bid for ${playerName} insufficient.`;
    body = `Transfer Desk Report: ${fromClub} have formally turned down a ${feeStr} transfer bid from ${toClub} for ${playerName} (${playerPosition}).

While ${fromClub} have not completely ruled out a sale during the current transfer window, club directors reportedly value the player higher and will require an improved financial package to sanction a move.`;
  }

  return {
    id: `news_transfer_rej_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    round,
    dateStr: "Transfer Desk",
    category: "transfer",
    categoryLabel: CATEGORY_CONFIG.transfer.label,
    title,
    summary,
    body,
    transferWidget: {
      playerName,
      playerPosition: playerPosition || "Player",
      fromClub: fromClub || "Club",
      toClub: toClub || "Club",
      fee: feeStr,
      isRival,
      isFirstTeam,
      type: "rejected"
    },
    isRead: false,
    timestamp,
    actionTab: "transfers"
  };
};

/**
 * Generate Contract Talks Collapsed News (Club accepted fee, but player rejected wage/contract years)
 */
export const generateContractCollapsedNews = ({
  playerName,
  playerPosition,
  fromClub,
  toClub,
  fee,
  offeredWage,
  demandedWage,
  offeredYears,
  round = 0
}) => {
  const timestamp = Date.now();
  const feeStr = fee && Number(fee) > 0 ? `$${Number(fee).toFixed(1)}M` : "Free Transfer";
  const offWageStr = `$${Number(offeredWage || 0).toLocaleString()}/wk`;
  const demWageStr = `$${Number(demandedWage || 0).toLocaleString()}/wk`;

  const title = `🚧 DEAL COLLAPSES: Personal Terms Breakdown Halts ${playerName} Move to ${toClub}!`;
  const summary = `Despite ${fromClub} accepting a ${feeStr} fee, ${playerName} walked away over wage demands (${offWageStr} vs ${demWageStr}).`;
  const body = `Transfer Desk Exclusive: ${toClub}'s proposed signing of ${playerName} (${playerPosition}) from ${fromClub} has dramatically collapsed at the final hurdle following a breakdown in personal terms negotiations.

Although ${toClub} had already reached an agreement with ${fromClub} over a ${feeStr} transfer fee, talks with the player's agent broke down in the boardroom. ${toClub} tabled a ${offeredYears}-year contract worth ${offWageStr}, which fell short of the player's valuation of roughly ${demWageStr}.

Unless ${toClub} free up additional payroll budget and return with an improved contract package, ${playerName} will remain at ${fromClub}.`;

  return {
    id: `news_contract_col_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    round,
    dateStr: "Transfer Desk",
    category: "transfer",
    categoryLabel: CATEGORY_CONFIG.transfer.label,
    title,
    summary,
    body,
    transferWidget: {
      playerName,
      playerPosition: playerPosition || "Player",
      fromClub: fromClub || "Free Agent",
      toClub: toClub || "Club",
      fee: feeStr,
      wage: `${offWageStr} (Offered)`,
      contractYears: offeredYears,
      type: "collapsed"
    },
    isRead: false,
    timestamp,
    actionTab: "transfers"
  };
};

/**
 * Generate Incoming Offer Rejected News (When user turns down a bid from another club)
 */
export const generateIncomingOfferRejectedNews = ({
  playerName,
  playerPosition,
  fromClub,
  buyerClub,
  fee,
  round = 0
}) => {
  const timestamp = Date.now();
  const feeStr = `$${Number(fee || 0).toFixed(1)}M`;
  const title = `🛡️ OFFER REBUFFED: ${fromClub} Turn Down ${feeStr} Bid from ${buyerClub} for ${playerName}`;
  const summary = `${fromClub} management reject ${buyerClub}'s ${feeStr} approach for ${playerName}.`;
  const body = `Transfer Desk Report: ${fromClub} have officially rejected a ${feeStr} transfer offer from ${buyerClub} for ${playerName} (${playerPosition || 'Player'}).

Club sources indicate that the manager considers ${playerName} an important part of the squad setup and was unimpressed by ${buyerClub}'s valuation.`;

  return {
    id: `news_in_rej_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    round,
    dateStr: "Transfer Desk",
    category: "transfer",
    categoryLabel: CATEGORY_CONFIG.transfer.label,
    title,
    summary,
    body,
    transferWidget: {
      playerName,
      playerPosition: playerPosition || "Player",
      fromClub,
      toClub: buyerClub,
      fee: feeStr,
      type: "rejected"
    },
    isRead: false,
    timestamp,
    actionTab: "transfers"
  };
};

/**
 * Generate Dynamic Transfer Rumors & Media Gossip Column
 */
export const generateTransferRumorNews = ({
  playerTeamName,
  teams = [],
  transferTargets = [],
  shortlist = [],
  round = 1,
  season = "2001/02"
}) => {
  const timestamp = Date.now();
  const otherClubs = teams.filter(t => t.name && t.name !== playerTeamName).map(t => t.name);
  const randomOtherClub = otherClubs.length > 0
    ? otherClubs[Math.floor(Math.random() * otherClubs.length)]
    : "European Giants";

  // Pick a target from shortlist first (if any), else from high-rated transferTargets
  let subjectPlayer = null;
  let isShortlistedTarget = false;

  const availableShortlist = (shortlist || []).filter(p => p.bidStatus !== 'accepted');
  if (availableShortlist.length > 0 && Math.random() < 0.65) {
    subjectPlayer = availableShortlist[Math.floor(Math.random() * availableShortlist.length)];
    isShortlistedTarget = true;
  } else if (Array.isArray(transferTargets) && transferTargets.length > 0) {
    const highProfile = transferTargets.filter(p => !p.bidStatus && (p.rating >= 7 || p.value >= 8));
    const pool = highProfile.length > 0 ? highProfile : transferTargets;
    subjectPlayer = pool[Math.floor(Math.random() * pool.length)];
  }

  if (!subjectPlayer) return null;

  const pName = subjectPlayer.name;
  const pPos = (Array.isArray(subjectPlayer.positions) && subjectPlayer.positions.length > 0)
    ? subjectPlayer.positions.join(", ")
    : (subjectPlayer.position || "Player");
  const pClub = subjectPlayer.currentClub || subjectPlayer.club || "Free Agent";
  const estVal = subjectPlayer.value ? `$${Number(subjectPlayer.value).toFixed(1)}M` : "$10.0M";
  const derby = checkDerby(playerTeamName, pClub);

  const rumorTemplates = [
    {
      title: `🕵️ TRANSFER GOSSIP: ${playerTeamName} Scouts Spotted Monitoring ${pName}`,
      summary: `Media reports link ${playerTeamName} with a potential ${estVal} move for ${pClub}'s ${pName}.`,
      body: `Transfer Rumor Mill: Speculation is mounting in the press that ${playerTeamName} are preparing a formal move for ${pClub} standout ${pName} (${pPos}).

Scouts from ${playerTeamName} were reportedly in the stands this week compiling a dossier on the player, who is valued at around ${estVal}.${derby ? ` However, given the fierce ${derby.name} rivalry between ${playerTeamName} and ${pClub}, any official approach would likely require a huge premium.` : `\n\nSources close to the player suggest he would be open to discussing personal terms if the two clubs can agree on a fee.`}`
    },
    {
      title: `🗞️ RUMOR MILL: ${randomOtherClub} Weighing Up Rival Bid for ${pName}`,
      summary: `${pClub}'s ${pName} is attracting heavy interest across the division with a valuation near ${estVal}.`,
      body: `Transfer Gossip Column: ${pName} (${pPos}, ${pClub}) has emerged as one of the hottest properties of the ${season} transfer window.

Reports indicate that ${randomOtherClub} are considering a ${estVal} swoop, while ${isShortlistedTarget ? `${playerTeamName} are also known to have the player high on their shortlist` : `several top-flight clubs are monitoring his contract situation closely`}. Managers hoping to secure his signature may need to act quickly before the window closes.`
    },
    {
      title: `💬 AGENT WHISPERS: ${pName} Mulling Over Future Amid ${playerTeamName} Links`,
      summary: `Representatives of ${pClub}'s ${pName} hint at possible transfer activity if wage demands are met.`,
      body: `Media Spotlight: The future of ${pName} (${pPos}) at ${pClub} is dominating back-page headlines today following cryptic comments from his representative.

Linked with a ${estVal} move to ${playerTeamName}, the player's camp hinted that an ambitious contract offer and competitive weekly wages could persuade him to make a switch during the transfer window.`
    }
  ];

  const chosen = rumorTemplates[Math.floor(Math.random() * rumorTemplates.length)];

  return {
    id: `news_rumor_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    round,
    dateStr: `Round ${round} Rumors`,
    category: "transfer",
    categoryLabel: "TRANSFER RUMORS",
    title: chosen.title,
    summary: chosen.summary,
    body: chosen.body,
    transferWidget: {
      playerName: pName,
      playerPosition: pPos,
      fromClub: pClub,
      toClub: `${playerTeamName} / ${randomOtherClub}`,
      fee: `Est. ${estVal}`,
      isRival: !!derby,
      type: "rumor"
    },
    isRead: false,
    timestamp,
    actionTab: "transfers"
  };
};

/**
 * Generate Transfer Window Status News (Window Open / Deadline Approaching)
 */
export const generateTransferWindowStatusNews = ({
  windowType, // "summer_open", "summer_deadline", "winter_open", "winter_deadline"
  round,
  season
}) => {
  const timestamp = Date.now();
  let title = "";
  let summary = "";
  let body = "";

  if (windowType === "summer_open") {
    title = `💰 TRANSFER WINDOW OPEN: Summer Market Officially Underway`;
    summary = `Clubs across the league can now buy, sell, and negotiate player contracts.`;
    body = `The summer transfer window is officially open for business! Scouting networks and recruitment teams have been activated across all divisions as managers look to reshape their squads for the campaign ahead.

Managers have until Round 5 to finalize signings, balance wage budgets, and offload surplus players before the first registration deadline slams shut.`;
  } else if (windowType === "summer_deadline") {
    title = `⏳ TRANSFER DEADLINE: Summer Market Closes Following Round 5`;
    summary = `Final scramble for signings as the summer transfer window reaches its conclusion.`;
    body = `The summer transfer window is now officially closed! Fax machines and phone lines were pushed to their limits in the final hours as clubs finalized last-gasp deals.

Squads are now locked in until the mid-season winter transfer window opens. Managers must now rely on their existing rosters and tactical acumen.`;
  } else if (windowType === "winter_open") {
    title = `❄️ WINTER WINDOW OPEN: Mid-Season Transfer Market Commences`;
    summary = `Clubs get a crucial opportunity to reinforce squads for the second half of the season.`;
    body = `The mid-season transfer window has officially opened! With title races tightening and relegation battles intensifying, managers have a vital window of opportunity to bring in reinforcements, address injury crises, and offload fringe players.`;
  } else if (windowType === "winter_deadline") {
    title = `🔒 WINDOW SHUT: Winter Transfer Market Officially Closed`;
    summary = `The mid-season transfer window has closed. All squad rosters are locked for the remainder of the season.`;
    body = `The winter transfer window has closed its doors. Teams across the division have submitted their final squad lists. With the transfer market now concluded, the run-in to the season climax begins!`;
  }

  return {
    id: `news_window_${windowType}_${round}_${timestamp}`,
    round,
    dateStr: round > 0 ? `Matchday ${round}` : "Transfer Desk",
    category: "transfer",
    categoryLabel: CATEGORY_CONFIG.transfer.label,
    title,
    summary,
    body,
    isRead: false,
    timestamp,
    actionTab: "transfers"
  };
};

/**
 * Generate initial pre-season news items when starting a new career or initializing news state.
 */
export const generateInitialNews = ({ teamName, managerName, expectation, budget, season }) => {
  const timestamp = Date.now();
  const boardText = expectation?.text || "Avoid Relegation";
  const budgetVal = budget !== undefined ? budget : 10.0;

  return [
    {
      id: `news_0_board_${timestamp}`,
      round: 0,
      dateStr: "Pre-Season",
      category: "board",
      categoryLabel: CATEGORY_CONFIG.board.label,
      title: `Board Unveils Season Objectives: Target set as "${boardText}"`,
      summary: `Manager ${managerName} takes charge at ${teamName} with a transfer budget of $${budgetVal.toFixed(1)}M.`,
      body: `The board of directors at ${teamName} have officially welcomed Manager ${managerName} for the upcoming ${season} campaign. Following detailed boardroom discussions, the directors have outlined clear expectations: the team is expected to achieve at least "${boardText}".

To support these objectives, the board has approved a starting transfer budget of $${budgetVal.toFixed(1)}M alongside squad wage allocations. Manager ${managerName} addressed the press, expressing confidence in meeting targets while promising an exciting tactical style for supporters.`,
      isRead: false,
      timestamp: timestamp - 2000,
      actionTab: "board"
    },
    {
      id: `news_0_window_${timestamp}`,
      round: 0,
      dateStr: "Pre-Season",
      category: "transfer",
      categoryLabel: CATEGORY_CONFIG.transfer.label,
      title: `💰 Summer Transfer Window Officially Open for ${season}`,
      summary: `Clubs can submit bids and strengthen their squads until Round 5.`,
      body: `The summer transfer window is officially open! Manager ${managerName} and the scouting staff at ${teamName} have full access to the transfer market to shortlist targets, negotiate player signings, and field offers from interested clubs.

The market remains open through Round 5, after which squads will be locked until the mid-season window.`,
      isRead: false,
      timestamp: timestamp - 1000,
      actionTab: "transfers"
    },
    {
      id: `news_0_preview_${timestamp}`,
      round: 0,
      dateStr: "Pre-Season",
      category: "preview",
      categoryLabel: CATEGORY_CONFIG.preview.label,
      title: `Pre-Season Tactical Outlook: ${teamName} Gear Up for Campaign Opening`,
      summary: `Analytical breakdown of ${teamName}'s tactical setup and squad readiness ahead of Matchday 1.`,
      body: `As the new season approaches, sports analysts have taken a close look at ${teamName}'s squad depth and tactical preparation under ${managerName}. 

The squad has undergone rigorous tactical drills during pre-season training, emphasizing positional discipline and quick transitions. Key senior players are reported to be in high spirits, and fans are eagerly anticipating the opening match. Tactical adjustments and squad rotations will be key as the fixture list unfolds.`,
      isRead: false,
      timestamp: timestamp,
      actionTab: "tactics"
    }
  ];
};

/**
 * Generate matchday news stories after a round is played or simulated.
 */
export const generateMatchdayNews = ({
  round,
  userFixture,
  allFixtures = [],
  standings = [],
  teamName,
  opponentName,
  nextOpponent,
  managerName,
  injuries = [],
  budget,
  fanConfidence = 50,
  boardConfidence = 50,
  season = "",
  isEuropeanMatch = false,
  europeanCupName = "",
  fullFixturesList = [],
  playerTeamId
}) => {
  const timestamp = Date.now();
  const newsItems = [];

  // Helper to resolve clean team name from id or fallback
  const getTeamName = (id, fallback) => {
    if (fallback && fallback !== "Home Team" && fallback !== "Away Team") return fallback;
    const found = (standings || []).find(t => t.idnum === id);
    return found ? found.name : (fallback || `Team ${id}`);
  };

  // 1. User Match Recap Story
  if (userFixture && userFixture.played) {
    const isHome = userFixture.homeTeamName ? userFixture.homeTeamName === teamName : (userFixture.homeId !== undefined && standings.length > 0 ? getTeamName(userFixture.homeId) === teamName : true);
    const userGoals = isHome ? userFixture.homeScore : userFixture.awayScore;
    const oppGoals = isHome ? userFixture.awayScore : userFixture.homeScore;
    const oppName = opponentName || (isHome ? getTeamName(userFixture.awayId, userFixture.awayTeamName) : getTeamName(userFixture.homeId, userFixture.homeTeamName)) || "Opponent";
    const goalDiff = userGoals - oppGoals;

    let matchHeadline = "";
    let matchBody = "";

    if (goalDiff > 2) {
      matchHeadline = `EMPHATIC VICTORY: ${teamName} Thrash ${oppName} ${userGoals}-${oppGoals}!`;
      matchBody = `Manager ${managerName}'s ${teamName} put on a masterclass performance today, dismantling ${oppName} with a sensational ${userGoals}-${oppGoals} victory. From the opening whistle, ${teamName} dominated possession and created chances at will. The home support erupted as the team delivered one of their finest displays of the season.`;
    } else if (goalDiff > 0) {
      matchHeadline = `HARD-FOUGHT WIN: ${teamName} Edge Past ${oppName} ${userGoals}-${oppGoals}`;
      matchBody = `${teamName} secured three crucial points in a tight battle against ${oppName}, finishing ${userGoals}-${oppGoals}. ${managerName}'s tactical adjustments proved decisive as the squad showed resilience and composure in the closing minutes to seal the win.`;
    } else if (goalDiff === 0) {
      matchHeadline = `POINTS SHARED: ${teamName} Draw ${userGoals}-${oppGoals} Against ${oppName}`;
      matchBody = `It ended all square at ${userGoals}-${oppGoals} between ${teamName} and ${oppName} in a tense matchday encounter. Both sides had chances to claim victory, but defensive discipline on both ends ensured the points were shared.`;
    } else if (goalDiff === -1 || goalDiff === -2) {
      matchHeadline = `NARROW DEFEAT: ${teamName} Suffer ${userGoals}-${oppGoals} Loss to ${oppName}`;
      matchBody = `${teamName} fell to a disappointing ${userGoals}-${oppGoals} defeat against ${oppName}. Despite creating several promising opportunities, ${managerName}'s men were unable to capitalize, leaving the manager frustrated in post-match press interviews.`;
    } else {
      matchHeadline = `HEAVY BLOW: ${teamName} Crushed ${userGoals}-${oppGoals} by ${oppName}`;
      matchBody = `A painful matchday for ${teamName} as they succumbed to a heavy ${userGoals}-${oppGoals} loss against ${oppName}. Pundits criticized defensive errors and called on Manager ${managerName} to swiftly address team form before the next fixture.`;
    }

    // Find current league position
    const playerRank = standings.findIndex(t => t.name === teamName) + 1;
    if (playerRank > 0) {
      matchBody += ` Following this result, ${teamName} sit in Position ${playerRank} in the table.`;
    }

    newsItems.push({
      id: `news_${round}_match_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "match",
      categoryLabel: isEuropeanMatch ? `${europeanCupName || "EUROPE"} MATCH` : CATEGORY_CONFIG.match.label,
      title: matchHeadline,
      summary: `${teamName} ${userGoals}-${oppGoals} ${oppName}. Read full match analysis and table standings impact.`,
      body: matchBody,
      matchWidget: {
        homeTeam: isHome ? teamName : oppName,
        awayTeam: isHome ? oppName : teamName,
        homeScore: userFixture.homeScore,
        awayScore: userFixture.awayScore,
        userTeam: teamName
      },
      isRead: false,
      timestamp: timestamp,
      actionTab: "home"
    });
  }

  // 2. Derby / Rivalry Clash Story (Special High-Stakes Preview)
  if (nextOpponent) {
    const derby = checkDerby(teamName, nextOpponent.name);
    if (derby) {
      newsItems.push({
        id: `news_${round}_derby_${timestamp}`,
        round: round,
        dateStr: `Matchday ${round}`,
        category: "derby",
        categoryLabel: CATEGORY_CONFIG.derby.label,
        title: `⚔️ ${derby.name.toUpperCase()}: Fierce Passion Awaits as ${teamName} Face Arch-Rivals ${nextOpponent.name}!`,
        summary: `The city and nation prepare for ${derby.name}. ${derby.desc}`,
        body: `All eyes across the footballing world turn to the upcoming fixture as ${teamName} and bitter adversaries ${nextOpponent.name} lock horns in the historic ${derby.name}!

${derby.desc}

Form books and league positions count for nothing when these two clash. Both sets of supporters have already created a cauldron of anticipation, with tension palpable in every corner of the streets.

Manager ${managerName} addressed the media ahead of the blockbuster showdown: "This is far more than just three points. This is about pride, history, and delivering for our supporters. We have to match their physical intensity while keeping our cool on the pitch." Expect a ferocious, tackle-heavy contest with zero room for error.`,
        derbyWidget: {
          name: derby.name,
          opponentName: nextOpponent.name,
          userTeam: teamName,
          desc: derby.desc
        },
        isRead: false,
        timestamp: timestamp + 5,
        actionTab: "tactics"
      });
    }
  }

  // 3. Manager Pressure & Form Streak Stories
  const streak = calculateTeamStreak(fullFixturesList, playerTeamId, teamName);
  if (streak.losses >= 3) {
    newsItems.push({
      id: `news_${round}_pressure_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "pressure",
      categoryLabel: CATEGORY_CONFIG.pressure.label,
      title: `🚨 CRISIS WATCH: Manager ${managerName} Under Severe Pressure After ${streak.losses} Consecutive Defeats!`,
      summary: `Mounting discontent among supporters and media as ${teamName} suffer their ${streak.losses}${streak.losses === 3 ? 'rd' : 'th'} straight loss.`,
      body: `Pressure is intensifying exponentially on Manager ${managerName} after ${teamName} slumped to their ${streak.losses}th consecutive league defeat today.

Media pundits have begun openly questioning the manager's tactical decisions, squad selections, and motivational abilities. Inside reports suggest the boardroom is growing anxious, and urgent talks are scheduled regarding the club's alarming downward spiral.

Supporters made their dissatisfaction loud and clear at the final whistle. A positive result in the upcoming fixture is now considered non-negotiable for ${managerName} to steady the ship.`,
      pressureWidget: {
        type: "crisis",
        losses: streak.losses,
        managerName,
        teamName
      },
      isRead: false,
      timestamp: timestamp + 10,
      actionTab: "tactics"
    });
  } else if (streak.wins >= 4) {
    newsItems.push({
      id: `news_${round}_streak_wins_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "pressure",
      categoryLabel: "🔥 WINNING RUN",
      title: `🔥 UNSTOPPABLE RUN: ${teamName} Power to ${streak.wins} Straight League Victories!`,
      summary: `Rampant form continues as Manager ${managerName}'s side make it ${streak.wins} wins on the bounce.`,
      body: `The unstoppable juggernaut that is ${teamName} rolled on today, clinching their ${streak.wins}th consecutive league triumph under Manager ${managerName}.

Analysts have hailed the team's relentless pressing, quick transitions, and lethal clinical finishing in front of goal. Confidence throughout the squad is sky-high, with players publicly praising the tactical harmony within the squad.

Supporters are daring to dream of remarkable glory as ${teamName} cement their status as the division's form team.`,
      pressureWidget: {
        type: "winning_streak",
        wins: streak.wins,
        managerName,
        teamName
      },
      isRead: false,
      timestamp: timestamp + 10,
      actionTab: "home"
    });
  } else if (streak.unbeaten >= 6) {
    newsItems.push({
      id: `news_${round}_streak_unbeaten_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "pressure",
      categoryLabel: "🛡️ UNBEATEN RUN",
      title: `🛡️ FORTRESS FORM: ${teamName} Extend Unbeaten Streak to ${streak.unbeaten} Matches!`,
      summary: `Rock-solid tactical discipline sees ${teamName} preserve an impressive ${streak.unbeaten}-game unbeaten run.`,
      body: `Steely resilience and outstanding tactical organization have propelled ${teamName} to a formidable ${streak.unbeaten}-match unbeaten run in league competition.

Manager ${managerName} has built a side that simply refuses to be beaten. Speaking to the press, the manager said: "The work rate without the ball is exceptional. When a team defends together as one cohesive unit, results naturally follow."

Opponents are finding it increasingly impossible to breach ${teamName}'s resolute defensive structure.`,
      pressureWidget: {
        type: "unbeaten_streak",
        unbeaten: streak.unbeaten,
        managerName,
        teamName
      },
      isRead: false,
      timestamp: timestamp + 10,
      actionTab: "home"
    });
  }

  // 4. Late-Season Title Race & Relegation Drama
  const totalRounds = (standings.length > 0 ? (standings.length - 1) * 2 : 0) || (fullFixturesList ? fullFixturesList.length : 38);
  const roundsRemaining = Math.max(0, totalRounds - round);

  if (roundsRemaining <= 5 && standings.length >= 4) {
    const sortedStandings = [...standings].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = (a.gf || 0) - (a.ga || 0);
      const gdB = (b.gf || 0) - (b.ga || 0);
      if (gdB !== gdA) return gdB - gdA;
      return (b.gf || 0) - (a.gf || 0);
    });

    const leader = sortedStandings[0];
    const runnerUp = sortedStandings[1];
    const pointsGap = (leader.points || 0) - (runnerUp.points || 0);
    const maxPointsLeft = roundsRemaining * 3;

    // Check if champions mathematically confirmed
    if (pointsGap > maxPointsLeft) {
      newsItems.push({
        id: `news_${round}_champions_${timestamp}`,
        round: round,
        dateStr: `Matchday ${round}`,
        category: "drama",
        categoryLabel: "👑 CHAMPIONS CROWNED",
        title: `👑 CHAMPIONS: ${leader.name} Mathematically Crowned League Champions!`,
        summary: `${leader.name} have officially secured the league title with ${roundsRemaining} matches left!`,
        body: `History has been written! ${leader.name} have officially clinched the league championship, ensuring the prestigious trophy heads to their cabinet!

With an unassailable lead of ${pointsGap} points and only ${roundsRemaining} games remaining, their nearest pursuers can no longer mathematically catch them.

Manager and players celebrated passionately with supporters at the final whistle. The coronation marks the crowning achievement of a sensational campaign.`,
        dramaWidget: {
          type: "champions",
          championName: leader.name,
          points: leader.points,
          runnerUpName: runnerUp.name,
          runnerUpPoints: runnerUp.points,
          roundsRemaining
        },
        isRead: false,
        timestamp: timestamp + 15,
        actionTab: "home"
      });
    } else if (nextOpponent) {
      const userRank = sortedStandings.findIndex(t => t.name === teamName) + 1;
      const oppRank = sortedStandings.findIndex(t => t.name === nextOpponent.name) + 1;

      // Title Decider: both user and next opponent are in top 3
      if (userRank > 0 && userRank <= 3 && oppRank > 0 && oppRank <= 3) {
        newsItems.push({
          id: `news_${round}_title_decider_${timestamp}`,
          round: round,
          dateStr: `Matchday ${round}`,
          category: "drama",
          categoryLabel: "🏆 TITLE DECIDER",
          title: `🏆 TITLE DECIDER: Crucial Top-3 Showdown as ${teamName} Face ${nextOpponent.name}!`,
          summary: `The title race hangs in the balance as #${userRank} ${teamName} meet #${oppRank} ${nextOpponent.name} with ${roundsRemaining} games left.`,
          body: `With only ${roundsRemaining} matches left to decide the destination of the championship, all eyes converge on this monumental top-of-the-table collision!

${teamName} (sitting ${userRank}${userRank === 1 ? 'st' : (userRank === 2 ? 'nd' : 'rd')}) lock horns with ${nextOpponent.name} (${oppRank}${oppRank === 1 ? 'st' : (oppRank === 2 ? 'nd' : 'rd')}) in a match that carries colossal title consequences. A victory could provide the definitive leap toward lifting the trophy, while defeat would be a catastrophic blow.

Pundits are describing the upcoming fixture as the definitive match of the entire season.`,
          dramaWidget: {
            type: "title_decider",
            teamA: teamName,
            teamB: nextOpponent.name,
            rankA: userRank,
            rankB: oppRank,
            roundsRemaining
          },
          isRead: false,
          timestamp: timestamp + 15,
          actionTab: "tactics"
        });
      } else {
        // Relegation Six-Pointer: user and opponent both in bottom 4
        const totalTeams = sortedStandings.length;
        const isUserRelegationZone = userRank >= totalTeams - 3;
        const isOppRelegationZone = oppRank >= totalTeams - 3;

        if (isUserRelegationZone && isOppRelegationZone) {
          newsItems.push({
            id: `news_${round}_relegation_scrap_${timestamp}`,
            round: round,
            dateStr: `Matchday ${round}`,
            category: "drama",
            categoryLabel: "⚠️ RELEGATION SCRAP",
            title: `⚠️ RELEGATION SIX-POINTER: Survival on the Line as ${teamName} Battle ${nextOpponent.name}!`,
            summary: `Desperation peaks at the bottom of the table: ${teamName} and ${nextOpponent.name} fight for top-flight survival.`,
            body: `Panic and tension have reached boiling point in the relegation dogfight. With just ${roundsRemaining} matches left before the drop, ${teamName} and ${nextOpponent.name} face off in what could be a make-or-break survival encounter.

Both sides are separated by a razor-thin margin near the bottom of the table. Three points here could secure salvation, while defeat could condemn either club to relegation heartbreak. Expect raw passion, desperate challenges, and nerve-shredding football from first whistle to last.`,
            dramaWidget: {
              type: "relegation_scrap",
              teamA: teamName,
              teamB: nextOpponent.name,
              rankA: userRank,
              rankB: oppRank,
              roundsRemaining
            },
            isRead: false,
            timestamp: timestamp + 15,
            actionTab: "tactics"
          });
        }
      }
    }
  }

  // 5. Transfer Window Status Announcements
  const midRoundStart = Math.floor(totalRounds / 2);
  if (round === 1) {
    newsItems.push(generateTransferWindowStatusNews({
      windowType: "summer_open",
      round,
      season
    }));
  } else if (round === 5) {
    newsItems.push(generateTransferWindowStatusNews({
      windowType: "summer_deadline",
      round,
      season
    }));
  } else if (round === midRoundStart) {
    newsItems.push(generateTransferWindowStatusNews({
      windowType: "winter_open",
      round,
      season
    }));
  } else if (round === midRoundStart + 4) {
    newsItems.push(generateTransferWindowStatusNews({
      windowType: "winter_deadline",
      round,
      season
    }));
  }

  // 6. League Roundup Story (Focuses on best match + lists ALL other results)
  if (allFixtures && allFixtures.length > 0 && standings.length > 0) {
    const playedFixtures = allFixtures
      .filter(f => f.played)
      .map(f => {
        const h = getTeamName(f.homeId, f.homeTeamName);
        const a = getTeamName(f.awayId, f.awayTeamName);
        const hScore = f.homeScore !== undefined ? f.homeScore : 0;
        const aScore = f.awayScore !== undefined ? f.awayScore : 0;
        return {
          homeName: h,
          awayName: a,
          homeScore: hScore,
          awayScore: aScore,
          isUserMatch: (h.toLowerCase() === (teamName || "").toLowerCase() || a.toLowerCase() === (teamName || "").toLowerCase()),
          diff: Math.abs(hScore - aScore),
          totalGoals: hScore + aScore
        };
      });

    const otherPlayed = playedFixtures.filter(f => !f.isUserMatch);
    if (playedFixtures.length > 0) {
      let headlineMatch = otherPlayed[0] || playedFixtures[0];
      if (otherPlayed.length > 0) {
        // Pick best match: highest total goals + margin of victory
        const sortedOther = [...otherPlayed].sort((a, b) => {
          const scoreA = (a.totalGoals * 1.5) + a.diff;
          const scoreB = (b.totalGoals * 1.5) + b.diff;
          return scoreB - scoreA;
        });
        headlineMatch = sortedOther[0];
      }

      let headlineTitle = "";
      const hDiff = headlineMatch.homeScore - headlineMatch.awayScore;
      if (headlineMatch.totalGoals >= 5) {
        headlineTitle = `GOAL FEST: ${headlineMatch.homeName} ${headlineMatch.homeScore}-${headlineMatch.awayScore} ${headlineMatch.awayName}`;
      } else if (Math.abs(hDiff) >= 3) {
        const winner = hDiff > 0 ? headlineMatch.homeName : headlineMatch.awayName;
        headlineTitle = `ROUT: ${winner} Cruise to ${headlineMatch.homeScore}-${headlineMatch.awayScore} Victory`;
      } else if (hDiff === 0 && headlineMatch.totalGoals > 0) {
        headlineTitle = `THRILLER: ${headlineMatch.homeName} & ${headlineMatch.awayName} Share Points (${headlineMatch.homeScore}-${headlineMatch.awayScore})`;
      } else {
        headlineTitle = `League Roundup: ${headlineMatch.homeName} ${headlineMatch.homeScore}-${headlineMatch.awayScore} ${headlineMatch.awayName}`;
      }

      const resultsListText = playedFixtures.map(f => {
        const badge = f.isUserMatch ? " ⭐" : "";
        return `• ${f.homeName} ${f.homeScore} - ${f.awayScore} ${f.awayName}${badge}`;
      }).join("\n");

      const roundupBody = `Matchday ${round} provided plenty of drama and key results across the division.

In the featured clash of the round, ${headlineMatch.homeName} met ${headlineMatch.awayName} in an entertaining contest that concluded ${headlineMatch.homeScore}-${headlineMatch.awayScore}.

📋 Matchday ${round} Full Results:
${resultsListText}

Points dropped and gained this round will have significant implications as clubs battle for European spots and survival.`;

      newsItems.push({
        id: `news_${round}_league_${timestamp}`,
        round: round,
        dateStr: `Matchday ${round}`,
        category: "league",
        categoryLabel: CATEGORY_CONFIG.league.label,
        title: headlineTitle,
        summary: `Matchday ${round} round-up: ${headlineMatch.homeName} ${headlineMatch.homeScore}-${headlineMatch.awayScore} ${headlineMatch.awayName} headlines the action, plus full division results.`,
        body: roundupBody,
        resultsWidget: playedFixtures,
        isRead: false,
        timestamp: timestamp + 20,
        actionTab: "home"
      });
    }
  }

  // 7. Tactical Preview for Next Opponent (Qualitative ratings + Preferred Tactic + Key players list)
  if (nextOpponent) {
    const nName = nextOpponent.name || "Next Opponent";
    const attNum = nextOpponent.attack || 3;
    const midNum = nextOpponent.midfield || 3;
    const defNum = nextOpponent.defense || 3;

    const attLabel = getQualitativeRating(attNum);
    const midLabel = getQualitativeRating(midNum);
    const defLabel = getQualitativeRating(defNum);

    const oppDetails = getTeamDetailsSync(nName, season);
    const oppManagerName = (oppDetails?.manager?.name && oppDetails.manager.name !== "Unknown Manager")
      ? oppDetails.manager.name
      : null;
    const seasonYrNum = parseInt(String(season || "2001").split("/")[0], 10) || 2001;
    const oppFormation = nextOpponent.preferredFormation
      || resolveHistoricalFormationOverride(nName, oppManagerName, seasonYrNum)
      || oppDetails?.manager?.preferredFormation
      || oppDetails?.preferredFormation
      || getCPUFormation(nextOpponent, { attack: 6, midfield: 6, defense: 6 }, seasonYrNum)
      || "4-4-2";

    const keyPlayers = nextOpponent.keyPlayers || getKeyOpponentPlayers(nName, season);

    let tacticalAdvice = "Maintain a balanced tactical shape.";
    if (attNum > defNum && attNum > midNum) {
      tacticalAdvice = `${nName} boast a dangerous, attack-minded setup in their ${oppFormation} system. Disciplined defensive screening and caution on turnovers will be essential.`;
    } else if (defNum > attNum && defNum > midNum) {
      tacticalAdvice = `${nName} rely on a disciplined and stubborn defensive low block in a ${oppFormation} shape. Quick wing progression and high pressing will be crucial to break them down.`;
    } else if (midNum >= attNum && midNum >= defNum) {
      tacticalAdvice = `${nName} feature a commanding midfield unit operating in a ${oppFormation} formation. Competing for second balls and maintaining possession tempo will decide the match.`;
    }

    let keyPlayersText = "";
    if (keyPlayers && keyPlayers.length > 0) {
      const pList = keyPlayers.map(p => `${p.name} (${p.position}, rated ${p.ratingLabel})`).join(", ");
      keyPlayersText = `\n\n⭐ Key Opponent Players to Watch: ${pList}. Special tactical attention should be given to limiting their space and service.`;
    }

    newsItems.push({
      id: `news_${round}_preview_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "preview",
      categoryLabel: CATEGORY_CONFIG.preview.label,
      title: `Tactical Scouting Report: Preparing for ${nName} (${oppFormation})`,
      summary: `Scouting analysis on ${nName} (Preferred Tactic: ${oppFormation}): Attack is ${attLabel}, Midfield is ${midLabel}, Defense is ${defLabel}.`,
      body: `Scouts have submitted their tactical dossier on our upcoming opponents, ${nName}.

📐 Expected Tactical Formation: ${nName}${oppManagerName ? ` (under ${oppManagerName})` : ""} are expected to line up in their preferred ${oppFormation} formation.

Our analysts rate their attacking threat as ${attLabel}, their midfield balance as ${midLabel}, and their defensive unit as ${defLabel}.

${tacticalAdvice}${keyPlayersText}

Manager ${managerName} is expected to adjust training routines this week to exploit their tactical vulnerabilities.`,
      previewWidget: {
        opponentName: nName,
        formation: oppFormation,
        managerName: oppManagerName,
        attackLabel: attLabel,
        midfieldLabel: midLabel,
        defenseLabel: defLabel,
        attackScore: attNum,
        midfieldScore: midNum,
        defenseScore: defNum,
        keyPlayers: keyPlayers || []
      },
      isRead: false,
      timestamp: timestamp + 30,
      actionTab: "tactics"
    });
  }

  // 8. Medical Department & Squad Status Report
  const activeInjuries = Array.isArray(injuries) ? injuries.filter(i => i.weeksRemaining > 0) : [];
  if (activeInjuries.length > 0) {
    const playerNames = activeInjuries.map(i => `${i.playerName || i.name} (${i.weeksRemaining} wk${i.weeksRemaining > 1 ? 's' : ''})`).join(", ");
    newsItems.push({
      id: `news_${round}_medical_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "medical",
      categoryLabel: CATEGORY_CONFIG.medical.label,
      title: `Medical Desk Update: ${activeInjuries.length} Squad Member${activeInjuries.length > 1 ? 's' : ''} Sidelined`,
      summary: `Physio department reports recovery progress for ${playerNames}.`,
      body: `The physio room at ${teamName} has issued a squad health update following recent matches. Currently, ${activeInjuries.length} player(s) are undergoing medical treatment and recovery protocols: ${playerNames}.

Manager ${managerName} will need to adjust squad selections and tactical lineups to compensate for these absences in upcoming fixtures.`,
      medicalWidget: activeInjuries,
      isRead: false,
      timestamp: timestamp + 35,
      actionTab: "tactics"
    });
  } else {
    newsItems.push({
      id: `news_${round}_medical_${timestamp}`,
      round: round,
      dateStr: `Matchday ${round}`,
      category: "medical",
      categoryLabel: CATEGORY_CONFIG.medical.label,
      title: `Physio Room Clear: ${teamName} Report Full Squad Fitness`,
      summary: `Clean bill of health reported by medical staff ahead of upcoming fixtures.`,
      body: `Great news from the medical department at ${teamName}! Head physio staff confirmed that the entire squad is in peak physical condition with zero registered injuries. Manager ${managerName} has a full complement of players available for selection.`,
      isRead: false,
      timestamp: timestamp + 35,
      actionTab: "tactics"
    });
  }

  // 9. Boardroom & Fan Reaction (Monthly update every 4 matches, or final round)
  const isMonthlyReview = (round > 0 && round % 4 === 0) || (round > 0 && standings.length > 0 && round === (standings.length - 1) * 2);
  if (isMonthlyReview) {
    const monthNum = Math.ceil(round / 4);
    let moodText = "Stable";
    if (fanConfidence >= 75) moodText = "Extremely Enthusiastic";
    else if (fanConfidence >= 50) moodText = "Satisfied";
    else if (fanConfidence >= 30) moodText = "Concerned";
    else moodText = "Restless & Mutinous";

    newsItems.push({
      id: `news_${round}_board_${timestamp}`,
      round: round,
      dateStr: `Month ${monthNum} Review`,
      category: "board",
      categoryLabel: CATEGORY_CONFIG.board.label,
      title: `Monthly Board & Fan Review: Supporter Mood Rated "${moodText}" (${fanConfidence}%)`,
      summary: `Periodic monthly club review after Matchday ${round}: Board confidence at ${boardConfidence}%, Supporter approval at ${fanConfidence}%.`,
      body: `As part of the club's regular monthly assessment following Matchday ${round}, the board of directors and official supporter representatives have published their review.

Supporter feedback over the past month rates the fan mood as "${moodText}" with an approval score of ${fanConfidence}%.

In the boardroom, directors confirmed their confidence rating stands at ${boardConfidence}%. The board reiterated that Manager ${managerName} retains their backing as long as seasonal objectives remain on track.`,
      isRead: false,
      timestamp: timestamp + 40,
      actionTab: "board"
    });
  }

  return newsItems;
};

/**
 * Generate Domestic Cup Draw Announcement story.
 */
export const generateDomesticCupDrawNews = ({ cupName, stageName, teamName, opponentName, managerName, round = 1 }) => {
  const timestamp = Date.now();
  return {
    id: `news_cup_draw_${timestamp}`,
    round,
    dateStr: "Cup Draw",
    category: "cup",
    categoryLabel: CATEGORY_CONFIG.cup.label,
    title: `${cupName} Draw Confirmed: ${teamName} Drawn Against ${opponentName}`,
    summary: `${teamName} learn their ${stageName} opponents in the official ${cupName} draw.`,
    body: `The official draw for the ${stageName} of the ${cupName} has taken place! 

Manager ${managerName}'s ${teamName} have been drawn to face ${opponentName} in a high-stakes knockout tie. The squad will be looking for a clinical performance to advance to the next round of the cup competition.`,
    isRead: false,
    timestamp
  };
};

/**
 * Generate Domestic Cup Match Recap story.
 */
export const generateDomesticCupMatchNews = ({
  cupName,
  stageName,
  userFixture,
  teamName,
  managerName,
  isWinner,
  nextStageName,
  round = 1
}) => {
  const timestamp = Date.now();
  const isHome = userFixture.homeName === teamName;
  const oppName = isHome ? userFixture.awayName : userFixture.homeName;
  const userScore = isHome ? userFixture.homeScore : userFixture.awayScore;
  const oppScore = isHome ? userFixture.awayScore : userFixture.homeScore;

  let scoreStr = `${userScore}-${oppScore}`;
  if (userFixture.penaltyHomeScore !== null && userFixture.penaltyHomeScore !== undefined) {
    const userPens = isHome ? userFixture.penaltyHomeScore : userFixture.penaltyAwayScore;
    const oppPens = isHome ? userFixture.penaltyAwayScore : userFixture.penaltyHomeScore;
    scoreStr += ` (${userPens}-${oppPens} on penalties)`;
  }

  let title = "";
  let body = "";

  if (stageName === "Domestic Cup Final") {
    if (isWinner) {
      title = `🏆 CHAMPIONS! ${teamName} Win the ${cupName}!`;
      body = `Glory for Manager ${managerName} and ${teamName}! A sensational ${scoreStr} victory over ${oppName} in the ${cupName} Final secures the coveted trophy! Fans have flooded the streets in celebration as ${teamName} lift the domestic cup!`;
    } else {
      title = `${cupName} Final Heartbreak: ${teamName} Defeated by ${oppName}`;
      body = `${teamName} suffered a painful ${scoreStr} loss against ${oppName} in the ${cupName} Final. Manager ${managerName} praised the team's effort post-match, but fell just short of domestic cup silverware.`;
    }
  } else {
    if (isWinner) {
      title = `${cupName} Victory: ${teamName} Advance to ${nextStageName || 'Next Round'}`;
      body = `${teamName} delivered a strong performance in the ${stageName} of the ${cupName}, overcoming ${oppName} ${scoreStr}. Manager ${managerName} expressed delight in post-match interviews as ${teamName} stay alive in the cup campaign.`;
    } else {
      title = `${cupName} Knockout: ${teamName} Eliminated by ${oppName}`;
      body = `${teamName}'s ${cupName} journey comes to an end following a ${scoreStr} defeat against ${oppName} in the ${stageName}. Focus now shifts entirely back to league fixtures.`;
    }
  }

  return {
    id: `news_cup_match_${timestamp}`,
    round,
    dateStr: stageName,
    category: "cup",
    categoryLabel: CATEGORY_CONFIG.cup.label,
    title,
    summary: `${teamName} ${isWinner ? 'triumph' : 'suffer defeat'} in the ${stageName} of the ${cupName} (${scoreStr}).`,
    body,
    isRead: false,
    timestamp
  };
};

/**
 * Generate Manager & Player of the Month News Stories
 */
export const generateMonthlyAwardsNews = ({ monthName, motm, potm, round, season }) => {
  const timestamp = Date.now();
  const newsItems = [];

  if (motm && motm.winner) {
    const w = motm.winner;
    const runnersUpStr = (motm.runnersUp || []).map((ru, idx) => `${idx === 0 ? '2nd' : '3rd'}: ${ru.managerName} (${ru.teamName}, ${ru.points} pts)`).join(" | ");

    newsItems.push({
      id: `news_${round}_motm_${timestamp}`,
      round,
      dateStr: `${monthName} Review`,
      category: "award",
      categoryLabel: CATEGORY_CONFIG.award.label,
      title: `🏆 MANAGER OF THE MONTH: ${w.managerName} Wins ${monthName} Honor!`,
      summary: `${w.managerName} (${w.teamName}) named ${monthName}'s best manager after guiding the side to ${w.points} points.`,
      body: `The official league committee has announced the recipient of the ${monthName} Manager of the Month award!

Manager ${w.managerName} of ${w.teamName} has scooped the prestigious award following an exceptional run of results. Under their guidance, ${w.teamName} collected ${w.points} points from ${w.played} matches (${w.won}W-${w.drawn}D-${w.lost}L), boasting a goal difference of ${w.gd > 0 ? `+${w.gd}` : w.gd}.

Pundits praised ${w.managerName}'s tactical mastery and composure under pressure throughout the monthly cycle.

📋 ${monthName} Manager Standings:
🥇 1st: ${w.managerName} (${w.teamName}) - ${w.points} pts (${w.won}W-${w.drawn}D-${w.lost}L)
${runnersUpStr ? (motm.runnersUp || []).map((ru, idx) => `${idx === 0 ? '🥈 2nd' : '🥉 3rd'}: ${ru.managerName} (${ru.teamName}) - ${ru.points} pts`).join("\n") : ''}`,
      awardWidget: {
        type: "motm",
        title: `${monthName.toUpperCase()} MANAGER OF THE MONTH`,
        winner: w.managerName,
        team: w.teamName,
        record: `${w.won}W - ${w.drawn}D - ${w.lost}L`,
        points: w.points,
        runnersUp: motm.runnersUp || []
      },
      isRead: false,
      timestamp,
      actionTab: "manager"
    });
  }

  if (potm && potm.winner) {
    const p = potm.winner;
    newsItems.push({
      id: `news_${round}_potm_${timestamp}`,
      round,
      dateStr: `${monthName} Review`,
      category: "award",
      categoryLabel: "⭐ STAR OF THE MONTH",
      title: `⭐ PLAYER OF THE MONTH: ${p.name} Crowned ${monthName} Star!`,
      summary: `${p.name} (${p.team}) wins the ${monthName} award with ${p.goals} goals and ${p.assists} assists.`,
      body: `Supporters and analysts have voted ${p.name} (${p.team}) as the official ${monthName} Player of the Month!

The ${p.position || 'attacker'} produced scintillating performances over the past month, registering ${p.goals} goal${p.goals === 1 ? '' : 's'} and providing ${p.assists} assist${p.assists === 1 ? '' : 's'}. Their direct involvement proved decisive in multiple key encounters.

${(potm.runnersUp && potm.runnersUp.length > 0) ? `Runners-up for the monthly award: ${potm.runnersUp.map(ru => `${ru.name} (${ru.team})`).join(", ")}.` : ''}`,
      awardWidget: {
        type: "potm",
        title: `${monthName.toUpperCase()} PLAYER OF THE MONTH`,
        winner: p.name,
        team: p.team,
        record: `${p.goals} Goals, ${p.assists} Assists`,
        runnersUp: potm.runnersUp || []
      },
      isRead: false,
      timestamp: timestamp + 5,
      actionTab: "home"
    });
  }

  return newsItems;
};

/**
 * Generate Manager & Player of the Year News Stories at Season End
 */
export const generateYearlyAwardsNews = ({ moty, poty, round, season }) => {
  const timestamp = Date.now();
  const newsItems = [];

  if (moty && moty.winner) {
    const w = moty.winner;
    newsItems.push({
      id: `news_${round}_moty_${timestamp}`,
      round,
      dateStr: "Season Climax",
      category: "yearlyAward",
      categoryLabel: CATEGORY_CONFIG.yearlyAward.label,
      title: `👑 MANAGER OF THE YEAR: ${w.managerName} Crowned Manager of the Season!`,
      summary: `After a majestic campaign with ${w.teamName}, ${w.managerName} wins the coveted Manager of the Year trophy!`,
      body: `The curtains have drawn on the ${season} campaign, and the prestigious Manager of the Year accolade has officially been awarded!

${w.managerName} of ${w.teamName} takes home the ultimate managerial honor! Having secured ${w.motmCount} Monthly Award${w.motmCount === 1 ? '' : 's'} and guiding ${w.teamName} to ${w.totalPoints} points, ${w.managerName} proved to be the standout tactician of the entire season.

The football world stands in applause for an unforgettable tactical masterclass.`,
      awardWidget: {
        type: "moty",
        title: "👑 MANAGER OF THE YEAR",
        winner: w.managerName,
        team: w.teamName,
        record: `${w.motmCount} Monthly Awards, ${w.totalPoints} Points`,
        runnersUp: moty.runnersUp || []
      },
      isRead: false,
      timestamp,
      actionTab: "manager"
    });
  }

  if (poty && poty.winner) {
    const p = poty.winner;
    newsItems.push({
      id: `news_${round}_poty_${timestamp}`,
      round,
      dateStr: "Season Climax",
      category: "yearlyAward",
      categoryLabel: "🌟 MVP OF THE YEAR",
      title: `🌟 PLAYER OF THE YEAR: ${p.name} Named Season MVP!`,
      summary: `${p.name} (${p.team}) wins the prestigious Player of the Year award with ${p.goals} goals and ${p.assists} assists.`,
      body: `Following an extraordinary season of individual brilliance, ${p.name} (${p.team}) has been crowned the official Player of the Year!

With a sensational haul of ${p.goals} goals and ${p.assists} assists across all league rounds, ${p.name} electrified supporters week in, week out. Scouts, journalists, and fellow players unanimously hailed the ${p.position} as the defining talent of the campaign.`,
      awardWidget: {
        type: "poty",
        title: "🌟 PLAYER OF THE YEAR",
        winner: p.name,
        team: p.team,
        record: `${p.goals} Goals, ${p.assists} Assists`,
        runnersUp: poty.runnersUp || []
      },
      isRead: false,
      timestamp: timestamp + 5,
      actionTab: "home"
    });
  }

  return newsItems;
};

/**
 * Generates club news stories when veteran players (36-40+) announce retirement at season transition.
 */
export const generateRetirementNews = ({ retirees = [], teamName, season, round = 1 }) => {
  if (!Array.isArray(retirees) || retirees.length === 0) return [];
  const baseTs = Date.now();
  return retirees.map((player, idx) => {
    const pos = player.position || "player";
    const age = Number(player.age) || 37;
    const rating = Number(player.rating) || 6;
    const qual = getQualitativeRating(rating);
    return {
      id: `news_retirement_${season}_${idx}_${baseTs}`,
      round,
      dateStr: `Pre-Season ${season}`,
      category: "transfer",
      categoryLabel: "🏅 PLAYER RETIREMENT",
      title: `🏅 END OF AN ERA: ${player.name} (${age}) Announces Retirement`,
      summary: `Veteran ${pos} ${player.name} has hung up his boots at age ${age}, concluding his chapter at ${teamName}.`,
      body: `An emotional announcement from the ${teamName} dressing room today: ${age}-year-old ${pos} ${player.name} (rated ${qual}, ${rating}/10) has officially retired from professional football ahead of the ${season} campaign.\n\nSupporters and teammates paid tribute to ${player.name}'s dedication and experience. With a spot now open in the ${teamName} squad, the board expects you to review your depth chart and evaluate potential reinforcements in the transfer market.`,
      isRead: false,
      timestamp: baseTs + idx,
      actionTab: "tactics"
    };
  });
};
