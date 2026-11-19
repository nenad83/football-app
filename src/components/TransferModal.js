import React, { useState, useEffect, useMemo } from 'react';
import { updateTeamStatsInStorage } from './FormationTactics';
import {
  calculatePlayerWage,
  findSquadForTeam,
  getPrebuiltRoster,
  getPrebuiltRosterSync,
  getTeamDetails,
  getTransferMarketPool,
  loadSeasonRosters,
  transferPlayerBetweenClubs
} from '../data/rosters/rosterRegistry';
import {
  checkDerby,
  generateContractCollapsedNews,
  generateIncomingOfferRejectedNews,
  generateTransferAnnouncementNews,
  generateTransferRejectedNews,
  generateTransferRumorNews
} from '../utils/newsGenerator';

// Exchange rate between Transfer Budget ($M) and Weekly Payroll Budget ($/wk)
// 1 Season = ~50 financial weeks => $1.0M Transfer Budget = $20,000/wk Payroll Budget
const WAGE_PER_MILLION_TRANSFER = 20000;

// Calculate player value based on rating, age, and era inflation
export const calculatePlayerValue = (player, seasonStr) => {
  if (player && typeof player.value === 'number' && player.value > 0) {
    return player.value;
  }
  const r = parseInt(player?.rating, 10) || 5;
  const age = parseInt(player?.age, 10) || 25;

  let baseVal = 2.0;
  if (r >= 10) baseVal = 45.0;
  else if (r === 9) baseVal = 30.0;
  else if (r === 8) baseVal = 18.0;
  else if (r === 7) baseVal = 10.0;
  else if (r === 6) baseVal = 5.5;
  else if (r === 5) baseVal = 3.0;
  else if (r === 4) baseVal = 1.5;
  else if (r === 3) baseVal = 0.8;
  else if (r === 2) baseVal = 0.4;
  else baseVal = 0.15;

  let ageMult = 1.0;
  if (age < 23) ageMult = 1.15;
  else if (age >= 29 && age <= 32) ageMult = 0.8;
  else if (age > 32) ageMult = 0.45;

  const eraYear = parseInt((seasonStr || "2001").split("/")[0], 10) || 2001;
  const eraMultiplier = 1 + (eraYear - 1980) * 0.04;
  return parseFloat((baseVal * ageMult * eraMultiplier).toFixed(1));
};

/**
 * Determines whether a player is in their club's First 11 (Starting XI)
 */
export const isFirst11Starter = (player, clubSquad = null) => {
  if (!player) return false;
  const clubName = player.currentClub || player.club || "Free Agent";
  if (clubName === "Free Agent" || clubName === "Other Club") return false;
  if (player.transferListed || player.loanListed) return false;

  if (Array.isArray(clubSquad) && clubSquad.length >= 11) {
    const sortByQuality = (a, b) => {
      const rDiff = (Number(b.rating) || 5) - (Number(a.rating) || 5);
      if (rDiff !== 0) return rDiff;
      return (Number(b.currentAbility) || 0) - (Number(a.currentAbility) || 0);
    };

    const gks = clubSquad.filter(p => p.position === 'GK').sort(sortByQuality).slice(0, 1);
    const defs = clubSquad.filter(p => ['DC', 'DL', 'DR', 'SW', 'DF', 'CB', 'LB', 'RB'].includes(p.position)).sort(sortByQuality).slice(0, 4);
    const mids = clubSquad.filter(p => ['MC', 'ML', 'MR', 'DMC', 'AMC', 'AML', 'AMR', 'MF', 'CM', 'DM', 'AM'].includes(p.position)).sort(sortByQuality).slice(0, 4);
    const atts = clubSquad.filter(p => ['ST', 'CF', 'LW', 'RW', 'FW', 'FC', 'SC'].includes(p.position)).sort(sortByQuality).slice(0, 2);

    const first11Names = new Set([
      ...gks.map(p => (p.name || "").toLowerCase()),
      ...defs.map(p => (p.name || "").toLowerCase()),
      ...mids.map(p => (p.name || "").toLowerCase()),
      ...atts.map(p => (p.name || "").toLowerCase())
    ]);

    if (first11Names.size < 11) {
      const allSorted = [...clubSquad].sort(sortByQuality);
      for (const p of allSorted) {
        first11Names.add((p.name || "").toLowerCase());
        if (first11Names.size >= 11) break;
      }
    }

    return first11Names.has((player.name || "").toLowerCase());
  }

  // Fallback heuristic when full club squad is not loaded yet
  return (Number(player.rating) >= 7) || (player.squadNumber && player.squadNumber >= 1 && player.squadNumber <= 11);
};

/**
 * Compute dynamic club transfer bid acceptance probability
 * Accounts for:
 * - Rival Clubs (very hard to buy from rivals; minimum 1.35x value + heavy probability penalty)
 * - First 11 Starters (very hard to pry away key starters; minimum 1.15x value + probability penalty)
 * - Club & Manager prestige
 */
export const getTransferSuccessProbability = (
  player,
  bid,
  clubRating,
  managerRating,
  seasonStr,
  options = {}
) => {
  if (!player) return 0;
  const clubName = player.currentClub || player.club || "Free Agent";
  if (clubName === "Free Agent") return 100;

  const { isRival = false, isFirst11 = false } = options;
  const val = calculatePlayerValue(player, seasonStr);

  // Elite players refuse to drop down to much weaker clubs unless manager rating is elite
  const clubDiff = (Number(player.rating) || 6) - (Number(clubRating) || 6);
  if (clubDiff > 2.2 && managerRating < 4.0) {
    return -1; // Player refuses to negotiate with club
  }

  // Determine minimum bid ratio required by selling club
  let minRatio = 0.65;
  if (isRival && isFirst11) {
    minRatio = 1.50; // Arch-rival's First 11 star: requires at least 1.5x value even to be considered
  } else if (isRival) {
    minRatio = 1.35; // Rival club tax: minimum 1.35x value
  } else if (isFirst11) {
    minRatio = 1.15; // First 11 starter: minimum 1.15x value
  } else if (player.transferListed) {
    minRatio = 0.55; // Transfer listed: club willing to accept lower bids
  }

  if (bid < val * minRatio) {
    if (isRival) return -2;   // Rival club flatly refuses bid below rival threshold
    if (isFirst11) return -3; // Club refuses low bid for First 11 starter
    return 0;                 // Standard offer too low
  }

  const ratio = bid / Math.max(0.1, val);
  let moneyProb = 0;

  if (isRival && isFirst11) {
    // Extremely hard: 1.5x -> 12%, 2.0x -> 48%, 2.5x -> 80%
    moneyProb = 12 + ((ratio - 1.5) / 1.0) * 68;
  } else if (isRival) {
    // Very hard: 1.35x -> 18%, 1.8x -> 58%, 2.2x -> 85%
    moneyProb = 18 + ((ratio - 1.35) / 0.85) * 67;
  } else if (isFirst11) {
    // Hard: 1.15x -> 25%, 1.5x -> 62%, 1.9x -> 88%
    moneyProb = 25 + ((ratio - 1.15) / 0.75) * 63;
  } else if (ratio >= 1.0) {
    moneyProb = 62 + ((ratio - 1.0) / 0.5) * 33;
  } else {
    moneyProb = ((ratio - minRatio) / Math.max(0.1, 1.0 - minRatio)) * 62;
  }

  if (player.transferListed && !isRival) {
    moneyProb += 15;
  }

  // Scale managerRating (1-5) to 1-10 to match clubRating (1-10)
  const scaledManagerRating = (Number(managerRating) || 2.5) * 2;
  const prestigeAvg = ((Number(clubRating) || 6) + scaledManagerRating) / 2;
  const prestigeDiff = prestigeAvg - (Number(player.rating) || 6);

  let finalProb = moneyProb + (prestigeDiff * 6);
  const maxCap = (isRival && isFirst11) ? 80 : (isRival ? 85 : (isFirst11 ? 90 : 95));
  finalProb = Math.max(5, Math.min(maxCap, Math.round(finalProb)));
  return finalProb;
};

// Helper: get all positions of a player as an array (e.g. ["DC", "DR"])
export const getPlayerPositionsList = (playerOrPos) => {
  if (!playerOrPos) return [];
  if (typeof playerOrPos === 'string') {
    return playerOrPos.split(/[,/ ]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  if (Array.isArray(playerOrPos)) {
    return playerOrPos.flatMap(item => getPlayerPositionsList(item));
  }
  const list = [];
  const primary = (playerOrPos.position || '').trim().toUpperCase();
  if (primary) {
    list.push(primary);
  }
  if (Array.isArray(playerOrPos.positions)) {
    playerOrPos.positions.forEach(pos => {
      if (pos && typeof pos === 'string') {
        const trimmed = pos.trim().toUpperCase();
        if (trimmed && !list.includes(trimmed)) {
          list.push(trimmed);
        }
      }
    });
  } else if (typeof playerOrPos.positions === 'string') {
    playerOrPos.positions.split(/[,/ ]+/).forEach(pos => {
      const trimmed = pos.trim().toUpperCase();
      if (trimmed && !list.includes(trimmed)) {
        list.push(trimmed);
      }
    });
  }
  return list.length > 0 ? list : (primary ? [primary] : []);
};

// Helper: format player positions for display (e.g. "DC, DR")
export const formatPlayerPositions = (playerOrPos, separator = ', ') => {
  const positions = getPlayerPositionsList(playerOrPos);
  if (positions.length > 0) {
    return positions.join(separator);
  }
  if (typeof playerOrPos === 'string') return playerOrPos;
  return playerOrPos?.position || '';
};

// Helper: match single position code against broad filter (GK, DEF, MID, ATT)
export const matchesSinglePosition = (posStr, filter) => {
  if (!filter || filter === "ALL") return true;
  const p = (posStr || "").toUpperCase();
  if (filter === "GK") return p.includes("GK");
  if (filter === "DEF") return p.includes("D") && !p.includes("DMC");
  if (filter === "MID") return p.includes("M") || p.includes("DMC") || p.includes("AMC");
  if (filter === "ATT") return p.includes("ST") || p.includes("CF") || p.includes("F") || p.includes("W");
  return p.includes(filter);
};

// Helper: match player or position against broad filter (GK, DEF, MID, ATT)
export const matchesPositionFilter = (playerOrPos, filter) => {
  if (!filter || filter === "ALL") return true;
  const positions = getPlayerPositionsList(playerOrPos);
  if (positions.length === 0) return true;
  return positions.some(pos => matchesSinglePosition(pos, filter));
};

// Names database for procedural fallbacks
const FIRST_NAMES = ["Oliver", "David", "Christian", "Alessandro", "Roberto", "Gabriel", "Ronaldo", "Zinedine", "Luis", "Thierry", "Alan", "Dennis", "Roy", "Patrick", "Pavel", "Hernan", "Michael", "Francesco", "Gianluigi", "Paolo", "Fabio", "Gary", "Paul", "Ryan", "Peter", "Ruud", "Eric", "Marc", "Clarence", "Edgar"];
const LAST_NAMES = ["Kahn", "Beckham", "Vieri", "Del Piero", "Baggio", "Batistuta", "Zidane", "Figo", "Henry", "Shearer", "Bergkamp", "Keane", "Vieira", "Nedved", "Crespo", "Owen", "Totti", "Buffon", "Maldini", "Cannavaro", "Neville", "Scholes", "Giggs", "Schmeichel", "van Nistelrooy", "Cantona", "Overmars", "Seedorf", "Davids", "Stam"];

export default function TransferModal({ isOpen, onClose, leagueState, setLeagueState, managerProfile, inline = false }) {
  const [activeTab, setActiveTab] = useState("buy"); // "buy" | "shortlist" | "search" | "sell"
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState({}); // playerName -> bid amount string
  const [message, setMessage] = useState("");

  // Pagination states (10 per page)
  const [marketPage, setMarketPage] = useState(1);
  const [shortlistPage, setShortlistPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);

  // Season rosters & club details
  const [seasonRostersData, setSeasonRostersData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [teamFinances, setTeamFinances] = useState(null);

  // Search tab filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClub, setSelectedClub] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [ratingFilter, setRatingFilter] = useState(0);

  // Contract Negotiation Popup Modal State
  // { player, bidAmount, fromClub, isRival, rivalryName, isFirst11, currentWage, demandedWage, preferredYears, offeredWage, offeredYears, attempt, agentMessage }
  const [contractNegotiation, setContractNegotiation] = useState(null);

  const { season = "", teams = [], playerTeamId = null, currentRound = 1, budget = 10.0 } = leagueState || {};
  const playerTeamObj = teams.find ? teams.find(t => t.idnum === playerTeamId) : null;
  const playerTeamName = playerTeamObj ? playerTeamObj.name : "";

  // Manager Rating (1-5 stars)
  const seasonsPlayed = managerProfile?.seasons || 0;
  const leagueTitles = managerProfile?.leagueTitles || 0;
  const cupTitles = managerProfile?.cupTitles || 0;
  const totalPoints = managerProfile?.points || 0;
  const managerPrestige = Math.round((seasonsPlayed * 25) + (leagueTitles * 100) + (cupTitles * 120) + (totalPoints * 0.5));
  const managerRating = Math.min(5, Math.max(1, parseFloat((1.5 + (managerPrestige / 500)).toFixed(1))));

  // Club Rating (1-10 scale)
  const clubRating = playerTeamObj
    ? parseFloat(((playerTeamObj.attack + playerTeamObj.midfield + playerTeamObj.defense) / 3).toFixed(1))
    : 6.0;

  // Determine if Transfer Window is currently open
  const totalRounds = teams.length ? (teams.length - 1) * 2 : 30;
  const midRoundStart = Math.floor(totalRounds / 2);
  const isWindowOpen = (currentRound >= 1 && currentRound <= 5) || (currentRound >= midRoundStart && currentRound < midRoundStart + 5);

  const windowKey = `${season}_${currentRound <= 5 ? 'start' : 'mid'}`;

  // Active squad roster in localStorage
  const rosterKey = `retro_roster_${playerTeamName}_${season}`;
  const [squadRoster, setSquadRoster] = useState([]);

  const getRoster = () => {
    try {
      const raw = localStorage.getItem(rosterKey);
      if (raw) return JSON.parse(raw);
      if (squadRoster && squadRoster.length > 0) return squadRoster;
      return [];
    } catch {
      return [];
    }
  };

  // Load player's squad, club financial details, and season rosters for First-11 detection
  useEffect(() => {
    let isMounted = true;
    if (isOpen || inline) {
      // 1. Load player team's finance details
      if (playerTeamName && season) {
        getTeamDetails(playerTeamName, season).then(details => {
          if (isMounted && details && details.finances) {
            setTeamFinances(details.finances);
          }
        }).catch(() => {});
      }

      // 2. Load player's active squad
      const raw = localStorage.getItem(rosterKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          setSquadRoster(parsed);
        } catch {
          setSquadRoster([]);
        }
      } else if (typeof getPrebuiltRoster === 'function' && playerTeamName && season) {
        Promise.resolve(getPrebuiltRoster(playerTeamName, season)).then(prebuilt => {
          if (isMounted && prebuilt && prebuilt.length > 0) {
            localStorage.setItem(rosterKey, JSON.stringify(prebuilt));
            setSquadRoster(prebuilt);
          }
        }).catch(() => {});
      }

      // 3. Preload season rosters so First-11 & Search are always ready
      if (!seasonRostersData && !searchLoading && season) {
        setSearchLoading(true);
        Promise.all([
          loadSeasonRosters(season),
          getTransferMarketPool ? getTransferMarketPool(season) : Promise.resolve([])
        ]).then(([rosters, cmPool]) => {
          if (!isMounted) return;
          const merged = { ...(rosters || {}) };
          if (cmPool && cmPool.length > 0) {
            const freeAgents = cmPool.filter(p => !p.currentClub || p.currentClub === "Free Agent");
            if (freeAgents.length > 0) {
              merged["Free Agents"] = freeAgents.map(p => ({
                ...p,
                currentClub: "Free Agent"
              }));
            }
          }
          setSeasonRostersData(merged);
          setSearchLoading(false);
        }).catch(() => {
          if (isMounted) setSearchLoading(false);
        });
      }
    }
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, inline, rosterKey, playerTeamName, season]);

  const roster = squadRoster;
  const shortlist = useMemo(() => leagueState?.shortlist || [], [leagueState?.shortlist]);

  // Calculate active weekly payroll from current squad
  const currentWeeklyPayroll = useMemo(() => {
    if (!roster || roster.length === 0) {
      return teamFinances?.estimatedWeeklyPayroll || 150000;
    }
    return roster.reduce((sum, p) => {
      return sum + calculatePlayerWage(p, season, teamFinances?.weeklyWageCap);
    }, 0);
  }, [roster, season, teamFinances]);

  // Effective Weekly Payroll Budget ($/wk)
  const effectivePayrollBudget = useMemo(() => {
    if (typeof leagueState?.payrollBudget === 'number' && leagueState.payrollBudget > 0) {
      return Math.round(leagueState.payrollBudget);
    }
    const baseEst = teamFinances?.estimatedWeeklyPayroll || currentWeeklyPayroll || 200000;
    return Math.max(Math.round(currentWeeklyPayroll * 1.12), Math.round(baseEst * 1.10));
  }, [leagueState?.payrollBudget, teamFinances, currentWeeklyPayroll]);

  const availableWeeklyWage = effectivePayrollBudget - currentWeeklyPayroll;
  const payrollUsagePercent = Math.min(100, Math.round((currentWeeklyPayroll / Math.max(1, effectivePayrollBudget)) * 100));

  // Helper to get a club's current squad for First-11 checks
  const getClubSquadForPlayer = (clubName) => {
    if (!clubName || clubName === "Free Agent" || clubName === "Other Club") return null;
    if (seasonRostersData) {
      const found = findSquadForTeam(seasonRostersData, clubName);
      if (found) return found;
    }
    return getPrebuiltRosterSync(clubName, season);
  };

  // Generate unique window targets (up to 50 players)
  useEffect(() => {
    if ((!isOpen && !inline) || !leagueState) return;
    if (!isWindowOpen) return;
    const currentTargets = leagueState.transferTargets || [];
    if (leagueState.lastTransferWindow !== windowKey || currentTargets.length < 50) {
      generateMarketData();
    } else if (leagueState.lastTransferUpdateRound !== currentRound) {
      updateMarketData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, inline, isWindowOpen, leagueState?.lastTransferUpdateRound, currentRound]);

  // Search Results Computation
  const clubsList = useMemo(() => {
    if (!seasonRostersData) return [];
    return Object.keys(seasonRostersData).sort();
  }, [seasonRostersData]);

  const searchResults = useMemo(() => {
    if (!seasonRostersData) return [];

    let pool = [];

    if (selectedClub && seasonRostersData[selectedClub]) {
      pool = seasonRostersData[selectedClub].map(p => ({
        ...p,
        currentClub: selectedClub,
        value: p.value || calculatePlayerValue(p, season),
        wage: calculatePlayerWage(p, season)
      }));
    } else if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase().trim();
      for (const [cName, squad] of Object.entries(seasonRostersData)) {
        if (!Array.isArray(squad)) continue;
        const clubMatch = cName.toLowerCase().includes(q);
        for (const p of squad) {
          if (clubMatch || p.name.toLowerCase().includes(q)) {
            pool.push({
              ...p,
              currentClub: cName,
              value: p.value || calculatePlayerValue(p, season),
              wage: calculatePlayerWage(p, season)
            });
            if (pool.length >= 250) break;
          }
        }
        if (pool.length >= 250) break;
      }
    }

    if (posFilter !== "ALL") {
      pool = pool.filter(p => matchesPositionFilter(p, posFilter));
    }

    if (ratingFilter > 0) {
      pool = pool.filter(p => p.rating >= ratingFilter);
    }

    return pool;
  }, [seasonRostersData, selectedClub, searchQuery, posFilter, ratingFilter, season]);

  const matchingClubsForQuery = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2 || !seasonRostersData || selectedClub) return [];
    const q = searchQuery.toLowerCase().trim();
    return clubsList.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, seasonRostersData, selectedClub, clubsList]);

  if ((!isOpen && !inline) || !leagueState) return null;

  const isShortlisted = (playerName) => {
    if (!playerName) return false;
    return shortlist.some(p => p.name.toLowerCase() === playerName.toLowerCase());
  };

  const isPlayerInSquad = (playerName) => {
    if (!playerName) return false;
    return roster.some(p => p.name.toLowerCase() === playerName.toLowerCase());
  };

  // Shift funds between Transfer Budget ($M) and Weekly Payroll Budget ($/wk)
  const handleShiftBudget = (direction, amountM = 0.5) => {
    const wageDelta = Math.round(amountM * WAGE_PER_MILLION_TRANSFER);

    if (direction === "to_payroll") {
      if (budget < amountM) {
        setMessage(`❌ Need at least $${amountM.toFixed(2)}M in Transfer Budget to convert to Payroll.`);
        return;
      }
      const newTransferBudget = parseFloat((budget - amountM).toFixed(2));
      const newPayrollBudget = effectivePayrollBudget + wageDelta;
      const updatedState = {
        ...leagueState,
        budget: newTransferBudget,
        payrollBudget: newPayrollBudget
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`💼 Converted $${amountM.toFixed(2)}M Transfer Budget into +$${wageDelta.toLocaleString()}/wk Payroll Budget!`);
    } else if (direction === "to_transfer") {
      if (availableWeeklyWage < wageDelta) {
        setMessage(`❌ Need at least $${wageDelta.toLocaleString()}/wk in unused Payroll room to convert to Transfer Budget.`);
        return;
      }
      const newTransferBudget = parseFloat((budget + amountM).toFixed(2));
      const newPayrollBudget = Math.max(currentWeeklyPayroll, effectivePayrollBudget - wageDelta);
      const updatedState = {
        ...leagueState,
        budget: newTransferBudget,
        payrollBudget: newPayrollBudget
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`💼 Converted $${wageDelta.toLocaleString()}/wk Payroll room into +$${amountM.toFixed(2)}M Transfer Budget!`);
    }
  };

  const handleToggleShortlist = (player) => {
    if (!player || !player.name) return;
    const currentShortlist = leagueState?.shortlist || [];
    const exists = currentShortlist.some(p => p.name.toLowerCase() === player.name.toLowerCase());
    let updated;
    let updatedNewsFeed = [...(leagueState.newsFeed || [])];

    if (exists) {
      updated = currentShortlist.filter(p => p.name.toLowerCase() !== player.name.toLowerCase());
      setMessage(`⭐ Removed ${player.name} from shortlist.`);
    } else {
      const item = {
        name: player.name,
        position: player.position,
        positions: getPlayerPositionsList(player),
        rating: player.rating,
        age: player.age,
        wage: calculatePlayerWage(player, season),
        currentClub: player.currentClub || player.club || "Free Agent",
        historicalNotes: player.historicalNotes || (player.currentClub && player.currentClub !== "Free Agent" ? `Player at ${player.currentClub}.` : "Free agent target."),
        value: player.value !== undefined ? player.value : calculatePlayerValue(player, season),
        transferListed: !!player.transferListed,
        bidStatus: player.bidStatus || null
      };
      updated = [...currentShortlist, item];
      setMessage(`⭐ Added ${player.name} to shortlist!`);

      // Generate a media rumor when shortlisting a high-profile player (rating >= 7)
      if (player.rating >= 7 && Math.random() < 0.65) {
        const rumor = generateTransferRumorNews({
          playerTeamName,
          teams,
          transferTargets: [item],
          shortlist: [item],
          round: currentRound,
          season
        });
        if (rumor) {
          updatedNewsFeed = [rumor, ...updatedNewsFeed];
        }
      }
    }

    const updatedState = {
      ...leagueState,
      shortlist: updated,
      newsFeed: updatedNewsFeed
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
  };

  const handleToggleTransferList = (playerName) => {
    const updated = squadRoster.map(p => {
      if (p.name === playerName) {
        return { ...p, transferListed: !p.transferListed };
      }
      return p;
    });
    localStorage.setItem(rosterKey, JSON.stringify(updated));
    setSquadRoster(updated);
  };

  // Generate 50 targets for the transfer market
  const generateMarketData = async () => {
    setLoading(true);
    let generatedTargets = [];
    let generatedOffers = [];

    try {
      const cmPool = getTransferMarketPool ? await getTransferMarketPool(season) : null;
      const activeNames = new Set(roster.map(p => p.name.toLowerCase()));
      const picked = [];
      const pickedNames = new Set();

      if (cmPool && cmPool.length > 0) {
        const available = cmPool.filter(p => !activeNames.has(p.name.toLowerCase()));

        if (available.length > 0) {
          const shuffled = [...available].sort(() => 0.5 - Math.random());
          const budgetFriendly = shuffled.filter(p => p.rating <= Math.max(1, clubRating - 1));
          const peerPlayers = shuffled.filter(p => Math.abs(p.rating - clubRating) <= 1);
          const starPlayers = shuffled.filter(p => p.rating > clubRating);

          picked.push(...budgetFriendly.slice(0, 16));
          picked.push(...peerPlayers.slice(0, 22));
          picked.push(...starPlayers.slice(0, 12));

          picked.forEach(p => pickedNames.add(p.name));

          for (const p of shuffled) {
            if (!pickedNames.has(p.name)) {
              picked.push(p);
              pickedNames.add(p.name);
              if (picked.length >= 50) break;
            }
          }
        }
      }

      if (picked.length < 50) {
        try {
          const allSeasonRosters = await loadSeasonRosters(season);
          if (allSeasonRosters) {
            setSeasonRostersData(prev => prev || allSeasonRosters);
            const candidates = [];
            for (const [cName, squad] of Object.entries(allSeasonRosters)) {
              if (cName.toLowerCase() === playerTeamName.toLowerCase()) continue;
              if (!Array.isArray(squad)) continue;
              for (const cp of squad) {
                if (!activeNames.has(cp.name.toLowerCase()) && !pickedNames.has(cp.name)) {
                  candidates.push({
                    name: cp.name,
                    position: cp.position,
                    positions: getPlayerPositionsList(cp),
                    rating: cp.rating,
                    age: cp.age,
                    wage: calculatePlayerWage(cp, season),
                    currentClub: cName,
                    transferListed: !!cp.transferListed,
                    historicalNotes: `Transfer target scouted from ${cName}.`,
                    value: calculatePlayerValue(cp, season),
                    bidStatus: null
                  });
                }
              }
            }
            const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
            for (const cp of shuffledCandidates) {
              picked.push(cp);
              pickedNames.add(cp.name);
              if (picked.length >= 50) break;
            }
          }
        } catch (err) {
          console.warn("Could not supplement transfer targets from season rosters", err);
        }
      }

      if (picked.length > 0) {
        generatedTargets = picked.map(p => ({
          name: p.name,
          position: p.position,
          positions: getPlayerPositionsList(p),
          rating: p.rating,
          age: p.age,
          wage: calculatePlayerWage(p, season),
          currentClub: p.currentClub || (p.onLoan ? p.loanClub : "Free Agent"),
          transferListed: !!p.transferListed,
          historicalNotes: p.historicalNotes || (p.loanListed ? `Available on loan from ${p.loanClub || 'club'}.` : "Available on the transfer market."),
          value: p.value || calculatePlayerValue(p, season),
          bidStatus: null
        }));
      }
    } catch (err) {
      console.warn("Failed to load CM transfer market pool, falling back", err);
    }

    // Procedural Fallback if still empty
    if (generatedTargets.length < 50) {
      const positionsPool = ["GK", "DL", "DR", "DC", "MC", "MR", "ML", "AMC", "ST", "CF"];
      const needed = 50 - generatedTargets.length;
      for (let i = 0; i < needed; i++) {
        const primaryPos = positionsPool[i % positionsPool.length];
        const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        const rating = Math.max(1, Math.min(10, Math.round(clubRating + (Math.random() * 2 - 1))));
        const p = {
          name: `${firstName} ${lastName}`,
          position: primaryPos,
          positions: [primaryPos],
          rating: rating,
          age: 19 + Math.floor(Math.random() * 14),
          currentClub: "Other Club",
          transferListed: true,
          historicalNotes: "Available for transfer this window."
        };
        p.value = calculatePlayerValue(p, season);
        p.wage = calculatePlayerWage(p, season);
        p.bidStatus = null;
        generatedTargets.push(p);
      }
    }

    // Generate Sell Offers
    const currentRoster = getRoster();
    if (currentRoster.length > 15) {
      const otherClubs = teams.filter(t => t.idnum !== playerTeamId).map(t => t.name);
      const offersList = [];

      const listedPlayers = currentRoster.filter(p => p.transferListed && p.rating > 1);
      listedPlayers.forEach(p => {
        if (Math.random() < 0.60) {
          const val = calculatePlayerValue(p, season);
          const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
          const multiplier = 0.80 + Math.random() * 0.35;
          offersList.push({
            id: Math.random().toString(),
            playerName: p.name,
            position: p.position,
            positions: getPlayerPositionsList(p),
            rating: p.rating,
            age: p.age,
            wage: calculatePlayerWage(p, season),
            fromClub: buyerClub,
            offerAmount: parseFloat((val * multiplier).toFixed(1)),
            isUnsolicited: false
          });
        }
      });

      const nonListedPlayers = currentRoster.filter(p => !p.transferListed && p.rating > 1);
      if (nonListedPlayers.length > 0 && offersList.length < 3) {
        const numUnsolicited = Math.min(2, Math.floor(Math.random() * 2) + 1);
        const shuffledNonListed = [...nonListedPlayers].sort(() => 0.5 - Math.random());
        const selectedNonListed = shuffledNonListed.slice(0, numUnsolicited);
        selectedNonListed.forEach(p => {
          if (Math.random() < 0.35) {
            const val = calculatePlayerValue(p, season);
            const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
            const multiplier = 0.90 + Math.random() * 0.35;
            offersList.push({
              id: Math.random().toString(),
              playerName: p.name,
              position: p.position,
              positions: getPlayerPositionsList(p),
              rating: p.rating,
              age: p.age,
              wage: calculatePlayerWage(p, season),
              fromClub: buyerClub,
              offerAmount: parseFloat((val * multiplier).toFixed(1)),
              isUnsolicited: true
            });
          }
        });
      }

      generatedOffers = offersList;
    }

    // Generate window opening transfer rumor news
    let updatedNewsFeed = [...(leagueState.newsFeed || [])];
    const rumorItem = generateTransferRumorNews({
      playerTeamName,
      teams,
      transferTargets: generatedTargets,
      shortlist: leagueState.shortlist || [],
      round: currentRound,
      season
    });
    if (rumorItem) {
      updatedNewsFeed = [rumorItem, ...updatedNewsFeed];
    }

    const updatedState = {
      ...leagueState,
      payrollBudget: leagueState.payrollBudget || effectivePayrollBudget,
      lastTransferWindow: windowKey,
      lastTransferUpdateRound: currentRound,
      transferTargets: generatedTargets,
      transferOffers: generatedOffers,
      newsFeed: updatedNewsFeed
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setMarketPage(1);
    setLoading(false);
  };

  const updateMarketData = async () => {
    setLoading(true);
    let currentTargets = [...(leagueState.transferTargets || [])];

    const bidTargets = currentTargets.filter(t => t.bidStatus);
    const unbidTargets = currentTargets.filter(t => !t.bidStatus);

    const numToRemove = Math.min(unbidTargets.length, 3 + Math.floor(Math.random() * 3));
    const shuffledUnbid = [...unbidTargets].sort(() => 0.5 - Math.random());
    const keptUnbid = shuffledUnbid.slice(numToRemove);
    const removedNames = new Set(shuffledUnbid.slice(0, numToRemove).map(p => p.name));

    const currentCount = bidTargets.length + keptUnbid.length;
    const numToGenerate = Math.max(numToRemove, 50 - currentCount);

    let newTargets = [];
    if (numToGenerate > 0) {
      try {
        const cmPool = getTransferMarketPool ? await getTransferMarketPool(season) : null;
        const activeNames = new Set([
          ...roster.map(p => p.name.toLowerCase()),
          ...bidTargets.map(p => p.name.toLowerCase()),
          ...keptUnbid.map(p => p.name.toLowerCase())
        ]);

        if (cmPool && cmPool.length > 0) {
          const available = cmPool.filter(p => !activeNames.has(p.name.toLowerCase()) && !removedNames.has(p.name));
          const shuffledAvailable = [...available].sort(() => 0.5 - Math.random());
          for (const p of shuffledAvailable) {
            newTargets.push({
              name: p.name,
              position: p.position,
              positions: getPlayerPositionsList(p),
              rating: p.rating,
              age: p.age,
              wage: calculatePlayerWage(p, season),
              currentClub: p.currentClub || (p.onLoan ? p.loanClub : "Free Agent"),
              transferListed: !!p.transferListed,
              historicalNotes: p.historicalNotes || "Available on the transfer market.",
              value: calculatePlayerValue(p, season),
              bidStatus: null
            });
            activeNames.add(p.name.toLowerCase());
            if (newTargets.length >= numToGenerate) break;
          }
        }

        if (newTargets.length < numToGenerate) {
          const allSeasonRosters = await loadSeasonRosters(season);
          if (allSeasonRosters) {
            const candidates = [];
            for (const [cName, squad] of Object.entries(allSeasonRosters)) {
              if (cName.toLowerCase() === playerTeamName.toLowerCase()) continue;
              if (!Array.isArray(squad)) continue;
              for (const cp of squad) {
                if (!activeNames.has(cp.name.toLowerCase())) {
                  candidates.push({
                    name: cp.name,
                    position: cp.position,
                    positions: getPlayerPositionsList(cp),
                    rating: cp.rating,
                    age: cp.age,
                    wage: calculatePlayerWage(cp, season),
                    currentClub: cName,
                    transferListed: !!cp.transferListed,
                    historicalNotes: `Scouted transfer target from ${cName}.`,
                    value: calculatePlayerValue(cp, season),
                    bidStatus: null
                  });
                }
              }
            }
            const shuffledCandidates = candidates.sort(() => 0.5 - Math.random());
            for (const cp of shuffledCandidates) {
              newTargets.push(cp);
              activeNames.add(cp.name.toLowerCase());
              if (newTargets.length >= numToGenerate) break;
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch new targets pool", err);
      }
    }

    const updatedTargets = [...bidTargets, ...keptUnbid, ...newTargets].slice(0, 50);

    // Update Sell Offers
    let currentOffers = [...(leagueState.transferOffers || [])];
    const numOffersToRemove = Math.min(currentOffers.length, Math.floor(Math.random() * 2) + 1);
    const shuffledOffers = [...currentOffers].sort(() => 0.5 - Math.random());
    let updatedOffers = shuffledOffers.slice(numOffersToRemove);

    const currentRoster = getRoster();
    if (currentRoster.length > 15) {
      const otherClubs = teams.filter(t => t.idnum !== playerTeamId).map(t => t.name);
      const newOffersList = [];

      const listedPlayers = currentRoster.filter(p => p.transferListed && p.rating > 1 && !updatedOffers.some(o => o.playerName === p.name));
      listedPlayers.forEach(p => {
        if (Math.random() < 0.60) {
          const val = calculatePlayerValue(p, season);
          const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
          const multiplier = 0.80 + Math.random() * 0.35;
          newOffersList.push({
            id: Math.random().toString(),
            playerName: p.name,
            position: p.position,
            positions: getPlayerPositionsList(p),
            rating: p.rating,
            age: p.age,
            wage: calculatePlayerWage(p, season),
            fromClub: buyerClub,
            offerAmount: parseFloat((val * multiplier).toFixed(1)),
            isUnsolicited: false
          });
        }
      });

      const nonListedPlayers = currentRoster.filter(p => !p.transferListed && p.rating > 1 && !updatedOffers.some(o => o.playerName === p.name));
      if (nonListedPlayers.length > 0 && Math.random() < 0.25) {
        const p = nonListedPlayers[Math.floor(Math.random() * nonListedPlayers.length)];
        const val = calculatePlayerValue(p, season);
        const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
        const multiplier = 0.90 + Math.random() * 0.35;
        newOffersList.push({
          id: Math.random().toString(),
          playerName: p.name,
          position: p.position,
          positions: getPlayerPositionsList(p),
          rating: p.rating,
          age: p.age,
          wage: calculatePlayerWage(p, season),
          fromClub: buyerClub,
          offerAmount: parseFloat((val * multiplier).toFixed(1)),
          isUnsolicited: true
        });
      }

      updatedOffers = [...updatedOffers, ...newOffersList];
    }

    // Generate round transfer rumor news
    let updatedNewsFeed = [...(leagueState.newsFeed || [])];
    const rumorItem = generateTransferRumorNews({
      playerTeamName,
      teams,
      transferTargets: updatedTargets,
      shortlist: leagueState.shortlist || [],
      round: currentRound,
      season
    });
    if (rumorItem) {
      updatedNewsFeed = [rumorItem, ...updatedNewsFeed];
    }

    const updatedState = {
      ...leagueState,
      lastTransferUpdateRound: currentRound,
      transferTargets: updatedTargets,
      transferOffers: updatedOffers,
      newsFeed: updatedNewsFeed
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setLoading(false);
  };

  const getBidValue = (player) => {
    if (!player || !player.name) return "0.0";
    const clubName = player.currentClub || player.club || "Free Agent";
    if (clubName === "Free Agent") return "0.0";
    if (bids[player.name] !== undefined) return bids[player.name];
    const val = player.value !== undefined ? player.value : calculatePlayerValue(player, season);
    return val.toFixed(1);
  };

  const handleBidChange = (playerName, value) => {
    setBids(prev => ({
      ...prev,
      [playerName]: value
    }));
  };

  // Stage 1: Submit Transfer Bid to Selling Club -> Opens Contract Negotiation Popup if Accepted
  const handleMakeBid = (player, customBidAmount) => {
    if (!player || !player.name) return;

    const currentRoster = getRoster();
    if (currentRoster.some(p => p.name.toLowerCase() === player.name.toLowerCase())) {
      setMessage(`❌ ${player.name} is already in your squad!`);
      return;
    }

    if (!isWindowOpen) {
      setMessage("🔒 The transfer window is currently closed. Official bids can be submitted during Rounds 1–5 and Mid-Season.");
      return;
    }

    const sellerClub = player.currentClub || player.club || "Free Agent";
    const isFreeAgent = sellerClub === "Free Agent";
    const bidStr = customBidAmount !== undefined ? customBidAmount : getBidValue(player);
    const bidAmount = isFreeAgent ? 0 : parseFloat(bidStr);

    if (!isFreeAgent && (isNaN(bidAmount) || bidAmount <= 0)) {
      setMessage("❌ Please enter a valid bid amount.");
      return;
    }
    if (bidAmount > budget) {
      setMessage("❌ You do not have enough transfer budget for this bid. Shift funds from Payroll or lower your offer.");
      return;
    }

    const derbyInfo = checkDerby(playerTeamName, sellerClub);
    const isRival = !!derbyInfo;
    const clubSquad = getClubSquadForPlayer(sellerClub);
    const isFirst11 = isFirst11Starter(player, clubSquad);

    const prob = getTransferSuccessProbability(
      player,
      bidAmount,
      clubRating,
      managerRating,
      season,
      { isRival, isFirst11 }
    );

    const targetsCopy = [...(leagueState.transferTargets || [])];
    const targetIdx = targetsCopy.findIndex(t => t.name.toLowerCase() === player.name.toLowerCase());
    const shortlistCopy = [...(leagueState.shortlist || [])];
    const shortlistIdx = shortlistCopy.findIndex(t => t.name.toLowerCase() === player.name.toLowerCase());

    if (prob === -1) {
      const rejNews = generateTransferRejectedNews({
        playerName: player.name,
        playerPosition: formatPlayerPositions(player),
        playerAge: player.age,
        fromClub: sellerClub,
        toClub: playerTeamName,
        fee: bidAmount,
        reason: "refusal",
        round: currentRound
      });
      const updatedState = {
        ...leagueState,
        newsFeed: [rejNews, ...(leagueState.newsFeed || [])]
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`❌ Negotiations failed: ${player.name} refuses to negotiate with a club of our reputation.`);
      return;
    }

    if (prob <= 0) {
      const val = calculatePlayerValue(player, season);
      if (prob === -2) {
        setMessage(`⚔️ RIVAL REFUSAL: Arch-rivals ${sellerClub} flatly rejected $${bidAmount.toFixed(1)}M! They will not even listen to offers below $${(val * 1.35).toFixed(1)}M.`);
      } else if (prob === -3) {
        setMessage(`🛡️ FIRST 11 STARTER: ${sellerClub} rejected $${bidAmount.toFixed(1)}M! ${player.name} is a key starter and requires at least $${(val * 1.15).toFixed(1)}M.`);
      } else {
        setMessage(`❌ ${sellerClub} rejected your $${bidAmount.toFixed(1)}M offer immediately as far below ${player.name}'s valuation.`);
      }
      return;
    }

    const roll = Math.floor(Math.random() * 100);
    const clubAccepted = isFreeAgent || roll < prob;

    if (clubAccepted) {
      // Selling club accepted the transfer fee! Now open Stage 2: Contract & Wage Negotiation Popup
      const baseWage = calculatePlayerWage(player, season, teamFinances?.weeklyWageCap);
      let demandMult = 1.10; // Standard 10% pay rise expectation on transfer
      if (isRival) demandMult += 0.22; // Rival move premium
      if (isFirst11) demandMult += 0.08; // Key starter premium
      if (player.rating > clubRating) {
        demandMult += (player.rating - clubRating) * 0.07;
      }
      if (managerRating >= 4.0) {
        demandMult -= 0.06; // Respects elite manager
      }

      const demandedWage = Math.max(500, Math.round((baseWage * demandMult) / 100) * 100);
      const age = Number(player.age) || 25;
      const preferredYears = age <= 24 ? 4 : (age <= 29 ? 3 : (age <= 32 ? 2 : 1));

      setContractNegotiation({
        player,
        bidAmount,
        fromClub: sellerClub,
        isRival,
        rivalryName: derbyInfo ? derbyInfo.name : "",
        isFirst11,
        currentWage: baseWage,
        demandedWage,
        preferredYears,
        offeredWage: demandedWage,
        offeredYears: preferredYears,
        attempt: 1,
        agentMessage: isFreeAgent
          ? `"${player.name} is a free agent and ready to discuss personal terms. We are looking for a ${preferredYears}-year deal around $${demandedWage.toLocaleString()}/wk."`
          : `"${sellerClub} have accepted your $${bidAmount.toFixed(1)}M transfer bid! ${player.name} is looking for a ${preferredYears}-year contract on $${demandedWage.toLocaleString()}/wk${isRival ? ' to cross the rivalry divide' : ''}."`
      });
    } else {
      // Club rejected the bid
      if (targetIdx !== -1) {
        targetsCopy[targetIdx] = { ...targetsCopy[targetIdx], bidStatus: 'rejected' };
      }
      if (shortlistIdx !== -1) {
        shortlistCopy[shortlistIdx] = { ...shortlistCopy[shortlistIdx], bidStatus: 'rejected' };
      }

      const rejNews = generateTransferRejectedNews({
        playerName: player.name,
        playerPosition: formatPlayerPositions(player),
        playerAge: player.age,
        fromClub: sellerClub,
        toClub: playerTeamName,
        fee: bidAmount,
        isRival,
        isFirstTeam: isFirst11,
        rivalryName: derbyInfo ? derbyInfo.name : "",
        reason: isRival ? "rival" : (isFirst11 ? "first11" : "valuation"),
        round: currentRound
      });

      const updatedState = {
        ...leagueState,
        transferTargets: targetsCopy,
        shortlist: shortlistCopy,
        newsFeed: [rejNews, ...(leagueState.newsFeed || [])]
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);

      if (isRival) {
        setMessage(`⚔️ BID REJECTED: Arch-rivals ${sellerClub} turned down our $${bidAmount.toFixed(1)}M bid for ${player.name}!`);
      } else if (isFirst11) {
        setMessage(`🛡️ BID REJECTED: ${sellerClub} refused to sell First-XI starter ${player.name} for $${bidAmount.toFixed(1)}M.`);
      } else {
        setMessage(`❌ NEGOTIATIONS FAILED: ${sellerClub} have rejected our $${bidAmount.toFixed(1)}M offer for ${player.name}.`);
      }
    }
  };

  // Compute required wage for the selected contract length inside the popup
  const getRequiredWageForYears = (neg) => {
    if (!neg) return 1000;
    const yearDiff = neg.offeredYears - neg.preferredYears;
    const age = Number(neg.player?.age) || 25;
    let lengthFactor = 1.0;

    if (yearDiff < 0) {
      // Shorter contract than desired -> wants higher weekly wage (+7% per missing year)
      lengthFactor = 1 + Math.abs(yearDiff) * 0.07;
    } else if (yearDiff > 0) {
      if (age >= 32) {
        // Older veterans prefer shorter deals; don't discount much
        lengthFactor = 1 + yearDiff * 0.03;
      } else {
        // Longer contract security -> accepts slightly lower weekly wage (-4% per extra year)
        lengthFactor = 1 - yearDiff * 0.04;
      }
    }
    return Math.max(500, Math.round((neg.demandedWage * lengthFactor) / 100) * 100);
  };

  const getContractAcceptanceChance = (neg) => {
    if (!neg) return 0;
    const reqWage = getRequiredWageForYears(neg);
    const ratio = (Number(neg.offeredWage) || 0) / Math.max(1, reqWage);
    if (ratio < 0.72) return 0;
    if (ratio >= 1.10) return 99;
    if (ratio >= 1.0) return Math.round(82 + ((ratio - 1.0) / 0.10) * 17);
    // Between 0.72 and 1.0
    return Math.max(10, Math.round(((ratio - 0.72) / 0.28) * 80));
  };

  // Stage 2: Finalize Contract Offer in Popup
  const handleSubmitContractOffer = () => {
    if (!contractNegotiation) return;
    const {
      player,
      bidAmount,
      fromClub,
      isRival,
      rivalryName,
      isFirst11,
      offeredWage,
      offeredYears,
      attempt
    } = contractNegotiation;

    const numWage = Math.round(Number(offeredWage) || 0);
    if (numWage <= 0) {
      setContractNegotiation(prev => ({
        ...prev,
        agentMessage: "❌ Please enter a valid weekly wage offer."
      }));
      return;
    }

    if (numWage > availableWeeklyWage) {
      setContractNegotiation(prev => ({
        ...prev,
        agentMessage: `⚠️ Wage offer ($${numWage.toLocaleString()}/wk) exceeds your available weekly payroll room ($${Math.max(0, availableWeeklyWage).toLocaleString()}/wk)! Use the button below to shift Transfer Budget into Payroll.`
      }));
      return;
    }

    const reqWage = getRequiredWageForYears(contractNegotiation);
    const chance = getContractAcceptanceChance(contractNegotiation);
    const roll = Math.floor(Math.random() * 100);
    const accepted = chance >= 88 || (chance > 0 && roll < chance);

    const targetsCopy = [...(leagueState.transferTargets || [])];
    const targetIdx = targetsCopy.findIndex(t => t.name.toLowerCase() === player.name.toLowerCase());
    const shortlistCopy = [...(leagueState.shortlist || [])];
    const shortlistIdx = shortlistCopy.findIndex(t => t.name.toLowerCase() === player.name.toLowerCase());

    if (accepted) {
      const newBudget = parseFloat((budget - bidAmount).toFixed(2));
      const currentRoster = getRoster();

      const squadPlayer = {
        name: player.name,
        position: player.position,
        positions: getPlayerPositionsList(player),
        rating: player.rating,
        age: player.age,
        currentAbility: player.currentAbility,
        wage: numWage,
        contractYears: offeredYears,
        value: player.value || calculatePlayerValue(player, season),
        condition: 100,
        injuryMatchesLeft: 0,
        injury: null,
        isAI: true
      };

      const updatedRoster = [...currentRoster, squadPlayer];
      localStorage.setItem(rosterKey, JSON.stringify(updatedRoster));
      setSquadRoster(updatedRoster);

      // Atomically remove from seller club across localStorage, lineups, and in-memory caches
      transferPlayerBetweenClubs({
        player: squadPlayer,
        fromClub,
        toClub: playerTeamName,
        season
      });

      // Also update local seasonRostersData state so Search tab immediately reflects removal
      if (seasonRostersData) {
        const pLower = player.name.toLowerCase().trim();
        const nextRosters = { ...seasonRostersData };
        for (const [cKey, sq] of Object.entries(nextRosters)) {
          if (!Array.isArray(sq)) continue;
          if (cKey.toLowerCase().trim() === playerTeamName.toLowerCase().trim()) {
            if (!sq.some(p => (p.name || "").toLowerCase().trim() === pLower)) {
              nextRosters[cKey] = [...sq, squadPlayer];
            }
          } else if (sq.some(p => (p.name || "").toLowerCase().trim() === pLower)) {
            nextRosters[cKey] = sq.filter(p => (p.name || "").toLowerCase().trim() !== pLower);
          }
        }
        setSeasonRostersData(nextRosters);
      }

      if (targetIdx !== -1) {
        targetsCopy[targetIdx] = { ...targetsCopy[targetIdx], bidStatus: 'accepted' };
      }
      if (shortlistIdx !== -1) {
        shortlistCopy[shortlistIdx] = { ...shortlistCopy[shortlistIdx], bidStatus: 'accepted' };
      }

      const dealNews = generateTransferAnnouncementNews({
        playerName: player.name,
        playerPosition: formatPlayerPositions(player),
        playerAge: player.age,
        fromClub,
        toClub: playerTeamName,
        fee: bidAmount,
        wage: numWage,
        contractYears: offeredYears,
        isRival,
        isFirstTeam: isFirst11,
        rivalryName,
        isBuy: true,
        managerName: leagueState?.managerName || "The Manager",
        season
      });

      const updatedState = {
        ...leagueState,
        budget: newBudget,
        payrollBudget: leagueState.payrollBudget || effectivePayrollBudget,
        transferTargets: targetsCopy,
        shortlist: shortlistCopy,
        newsFeed: [dealNews, ...(leagueState.newsFeed || [])]
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setContractNegotiation(null);
      setMessage(`🎉 DONE DEAL! ${player.name} signed a ${offeredYears}-year contract ($${numWage.toLocaleString()}/wk) for a fee of $${bidAmount.toFixed(1)}M!`);
    } else if (attempt === 1 && numWage >= reqWage * 0.70) {
      // Give the manager 1 counter-offer opportunity before talks collapse
      const compromiseWage = Math.max(numWage + 500, Math.round((reqWage * 0.96) / 100) * 100);
      setContractNegotiation(prev => ({
        ...prev,
        attempt: 2,
        demandedWage: compromiseWage,
        offeredWage: compromiseWage,
        agentMessage: `💬 AGENT COUNTER-OFFER: "${player.name} is not satisfied with $${numWage.toLocaleString()}/wk. Improve your offer to at least $${compromiseWage.toLocaleString()}/wk on a ${offeredYears}-year deal, or we walk away!"`
      }));
    } else {
      // Contract talks collapse!
      if (targetIdx !== -1) {
        targetsCopy[targetIdx] = { ...targetsCopy[targetIdx], bidStatus: 'rejected' };
      }
      if (shortlistIdx !== -1) {
        shortlistCopy[shortlistIdx] = { ...shortlistCopy[shortlistIdx], bidStatus: 'rejected' };
      }

      const collapseNews = generateContractCollapsedNews({
        playerName: player.name,
        playerPosition: formatPlayerPositions(player),
        fromClub,
        toClub: playerTeamName,
        fee: bidAmount,
        offeredWage: numWage,
        demandedWage: reqWage,
        offeredYears,
        round: currentRound
      });

      const updatedState = {
        ...leagueState,
        transferTargets: targetsCopy,
        shortlist: shortlistCopy,
        newsFeed: [collapseNews, ...(leagueState.newsFeed || [])]
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setContractNegotiation(null);
      setMessage(`🚧 CONTRACT TALKS COLLAPSED: ${player.name} rejected your personal terms ($${numWage.toLocaleString()}/wk) and will stay at ${fromClub}.`);
    }
  };

  // Quick shift inside Contract Popup to cover exact wage deficit
  const handleCoverWageDeficitInModal = () => {
    if (!contractNegotiation) return;
    const deficit = (Number(contractNegotiation.offeredWage) || 0) - availableWeeklyWage;
    if (deficit <= 0) return;

    // Round up to nearest $0.25M chunk
    const neededMillions = Math.ceil((deficit / WAGE_PER_MILLION_TRANSFER) * 4) / 4;
    const totalNeededWithBid = contractNegotiation.bidAmount + neededMillions;

    if (budget < totalNeededWithBid) {
      setContractNegotiation(prev => ({
        ...prev,
        agentMessage: `❌ Insufficient Transfer Budget! After the $${contractNegotiation.bidAmount.toFixed(1)}M transfer fee, you need $${neededMillions.toFixed(2)}M more to cover these wages.`
      }));
      return;
    }

    const wageAdded = Math.round(neededMillions * WAGE_PER_MILLION_TRANSFER);
    const newTransferBudget = parseFloat((budget - neededMillions).toFixed(2));
    const newPayrollBudget = effectivePayrollBudget + wageAdded;

    const updatedState = {
      ...leagueState,
      budget: newTransferBudget,
      payrollBudget: newPayrollBudget
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setContractNegotiation(prev => ({
      ...prev,
      agentMessage: `✅ Shifted $${neededMillions.toFixed(2)}M from Transfer Budget to add +$${wageAdded.toLocaleString()}/wk to your Payroll Budget! You can now submit the contract offer.`
    }));
  };

  const handleAcceptOffer = (offer) => {
    const currentRoster = getRoster();
    if (currentRoster.length <= 15) {
      setMessage("❌ Roster size cannot drop below 15 players.");
      return;
    }

    const soldPlayerObj = currentRoster.find(p => p.name === offer.playerName) || {
      name: offer.playerName,
      position: offer.position,
      positions: getPlayerPositionsList(offer),
      rating: offer.rating,
      age: offer.age,
      wage: offer.wage || calculatePlayerWage(offer, season)
    };
    const freedWage = calculatePlayerWage(soldPlayerObj, season, teamFinances?.weeklyWageCap);

    const updatedRoster = currentRoster.filter(p => p.name !== offer.playerName);
    localStorage.setItem(rosterKey, JSON.stringify(updatedRoster));
    setSquadRoster(updatedRoster);

    // Move sold player to buyer club so rosters stay authentic
    transferPlayerBetweenClubs({
      player: soldPlayerObj,
      fromClub: playerTeamName,
      toClub: offer.fromClub,
      season
    });

    const lineupKey = `retro_lineup_${playerTeamName}_${season}`;
    const rawLineup = localStorage.getItem(lineupKey);
    if (rawLineup) {
      try {
        const lineup = JSON.parse(rawLineup);
        let lineupChanged = false;
        for (const slotId in lineup) {
          if (lineup[slotId] && lineup[slotId].name === offer.playerName) {
            lineup[slotId] = null;
            lineupChanged = true;
          }
        }
        if (lineupChanged) {
          localStorage.setItem(lineupKey, JSON.stringify(lineup));
          updateTeamStatsInStorage(lineup, localStorage.getItem(`retro_formation_${playerTeamName}_${season}`) || "442");
        }
      } catch (err) {
        console.error("Error updating lineup on sell", err);
      }
    }

    const newBudget = parseFloat((budget + offer.offerAmount).toFixed(2));
    const remainingOffers = (leagueState.transferOffers || []).filter(o => o.id !== offer.id);

    const careerRaw = localStorage.getItem("retro_league_career");
    let currentTeams = teams;
    if (careerRaw) {
      try {
        const parsed = JSON.parse(careerRaw);
        currentTeams = parsed.teams;
      } catch { }
    }

    const sellNews = generateTransferAnnouncementNews({
      playerName: offer.playerName,
      playerPosition: formatPlayerPositions(soldPlayerObj || offer),
      playerAge: offer.age,
      fromClub: playerTeamName,
      toClub: offer.fromClub,
      fee: offer.offerAmount,
      wage: freedWage,
      isBuy: false,
      managerName: leagueState?.managerName || "The Manager",
      season
    });
    const updatedNewsFeed = [sellNews, ...(leagueState.newsFeed || [])];

    const updatedState = {
      ...leagueState,
      teams: currentTeams,
      budget: newBudget,
      payrollBudget: leagueState.payrollBudget || effectivePayrollBudget,
      transferOffers: remainingOffers,
      newsFeed: updatedNewsFeed
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setMessage(`💵 SOLD! ${offer.playerName} joined ${offer.fromClub} for $${offer.offerAmount.toFixed(1)}M (freed $${freedWage.toLocaleString()}/wk in payroll).`);
  };

  const handleRejectOffer = (offerId) => {
    const offerObj = (leagueState.transferOffers || []).find(o => o.id === offerId);
    const remainingOffers = (leagueState.transferOffers || []).filter(o => o.id !== offerId);
    let updatedNewsFeed = [...(leagueState.newsFeed || [])];

    if (offerObj) {
      const rejNews = generateIncomingOfferRejectedNews({
        playerName: offerObj.playerName,
        playerPosition: formatPlayerPositions(offerObj),
        fromClub: playerTeamName,
        buyerClub: offerObj.fromClub,
        fee: offerObj.offerAmount,
        round: currentRound
      });
      updatedNewsFeed = [rejNews, ...updatedNewsFeed];
    }

    const updatedState = {
      ...leagueState,
      transferOffers: remainingOffers,
      newsFeed: updatedNewsFeed
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setMessage(offerObj ? `🛡️ Rejected ${offerObj.fromClub}'s $${offerObj.offerAmount.toFixed(1)}M offer for ${offerObj.playerName}.` : "Offer rejected.");
  };

  // Pagination Helper Component
  const renderPagination = (currentPage, totalItems, itemsPerPage, onPageChange) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    if (totalPages <= 1) return null;

    const startIdx = (currentPage - 1) * itemsPerPage + 1;
    const endIdx = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        marginTop: '12px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontSize: '11px', color: '#888' }}>
          Showing <strong style={{ color: '#fff' }}>{startIdx}–{endIdx}</strong> of <strong style={{ color: '#ffea00' }}>{totalItems}</strong> players
        </span>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              color: currentPage === 1 ? '#555' : '#fff',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            « Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                background: currentPage === p ? 'rgba(255, 69, 0, 0.25)' : 'transparent',
                border: '1px solid',
                borderColor: currentPage === p ? '#ff4500' : 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: currentPage === p ? '#ffea00' : '#aaa',
                padding: '3px 8px',
                fontSize: '11px',
                fontFamily: 'Orbitron',
                fontWeight: currentPage === p ? 'bold' : 'normal',
                cursor: 'pointer'
              }}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              color: currentPage === totalPages ? '#555' : '#fff',
              padding: '3px 8px',
              fontSize: '11px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next »
          </button>
        </div>
      </div>
    );
  };

  // Shared Player Row Card
  const renderPlayerCard = (player, context = "buy") => {
    const sellerClub = player.currentClub || player.club || "Free Agent";
    const isFreeAgent = sellerClub === "Free Agent";
    const bidValue = getBidValue(player);
    const numericBid = isFreeAgent ? 0 : (parseFloat(bidValue) || 0);

    const derbyInfo = checkDerby(playerTeamName, sellerClub);
    const isRival = !!derbyInfo;
    const clubSquad = getClubSquadForPlayer(sellerClub);
    const isFirst11 = isFirst11Starter(player, clubSquad);

    const prob = getTransferSuccessProbability(
      player,
      numericBid,
      clubRating,
      managerRating,
      season,
      { isRival, isFirst11 }
    );
    const inSquad = isPlayerInSquad(player.name);
    const shortlisted = isShortlisted(player.name);
    const effectiveValue = isFreeAgent ? 0 : (player.value !== undefined ? player.value : calculatePlayerValue(player, season));
    const estWage = calculatePlayerWage(player, season, teamFinances?.weeklyWageCap);

    return (
      <div key={`${player.name}_${sellerClub}`} style={{
        background: isRival ? 'rgba(255, 51, 68, 0.03)' : 'rgba(255, 255, 255, 0.02)',
        border: isRival
          ? '1.5px solid rgba(255, 51, 68, 0.28)'
          : '1.5px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '8px', padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px',
        opacity: player.bidStatus ? 0.65 : 1,
        transition: 'border-color 0.2s ease',
        flexWrap: 'wrap'
      }}>
        {/* Player Identity */}
        <div style={{ flex: '1 1 220px', textAlign: 'left', minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#fff' }}>{player.name}</span>
            <span
              title={`Positions: ${formatPlayerPositions(player)}`}
              style={{
                fontSize: '9px', background: 'rgba(255,255,255,0.08)',
                padding: '1px 5px', borderRadius: '3px', color: '#ffd700', fontWeight: 'bold'
              }}
            >
              {formatPlayerPositions(player)}
            </span>
            {isRival && !inSquad && (
              <span
                title={`${derbyInfo.name}: Very difficult to sign players from arch-rivals!`}
                style={{
                  fontSize: '9px', background: 'rgba(255, 51, 68, 0.18)',
                  border: '1px solid rgba(255, 51, 68, 0.5)',
                  padding: '1px 6px', borderRadius: '3px', color: '#ff3344', fontWeight: 'bold', fontFamily: 'Orbitron'
                }}
              >
                ⚔️ RIVAL CLUB
              </span>
            )}
            {isFirst11 && !inSquad && (
              <span
                title={`Starting XI regular at ${sellerClub}: Club demands a high premium to sell!`}
                style={{
                  fontSize: '9px', background: 'rgba(0, 229, 255, 0.14)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  padding: '1px 6px', borderRadius: '3px', color: '#00e5ff', fontWeight: 'bold', fontFamily: 'Orbitron'
                }}
              >
                🛡️ FIRST 11
              </span>
            )}
            {player.transferListed && !isFreeAgent && !inSquad && (
              <span style={{
                fontSize: '9px', background: 'rgba(255, 165, 0, 0.15)',
                border: '1px solid rgba(255, 165, 0, 0.4)',
                padding: '1px 5px', borderRadius: '3px', color: '#ffa500', fontWeight: 'bold', fontFamily: 'Orbitron'
              }}>
                🏷️ LISTED
              </span>
            )}
            {inSquad && (
              <span style={{
                fontSize: '9px', background: 'rgba(0, 255, 100, 0.1)',
                border: '1px solid rgba(0, 255, 100, 0.3)',
                padding: '1px 5px', borderRadius: '3px', color: '#00ff64', fontWeight: 'bold'
              }}>
                👤 IN YOUR SQUAD
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>Age: <strong style={{ color: '#ddd' }}>{player.age}</strong></span>
            <span>Club: <strong style={{ color: isRival ? '#ff3344' : '#00e5ff' }}>{sellerClub}</strong></span>
            <span>Wage: <strong style={{ color: '#00ff64' }}>${estWage.toLocaleString()}/wk</strong></span>
          </div>
          {player.historicalNotes && (
            <div style={{
              fontSize: '10px', color: '#888', fontStyle: 'italic', marginTop: '4px',
              background: 'rgba(255,255,255,0.01)', padding: '3px 6px', borderRadius: '4px',
              borderLeft: isRival ? '2px solid #ff3344' : '2px solid rgba(255, 69, 0, 0.3)'
            }}>
              📋 {player.historicalNotes}
            </div>
          )}
        </div>

        {/* Player Rating & Value */}
        <div style={{ width: '125px', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
          <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Skill Rating</span>
          <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '12px', fontFamily: 'Orbitron' }}>
            ⭐ {player.rating}/10
          </span>
          <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', marginTop: '3px' }}>Market Value</span>
          <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '12.5px' }}>
            {isFreeAgent ? "FREE" : `$${effectiveValue.toFixed(1)}M`}
          </span>
        </div>

        {/* Actions: Shortlist Toggle & Bidding Control */}
        <div style={{ width: '240px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {/* Shortlist Button */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => handleToggleShortlist(player)}
              style={{
                background: shortlisted ? 'rgba(255, 215, 0, 0.12)' : 'transparent',
                border: '1px solid',
                borderColor: shortlisted ? '#ffd700' : 'rgba(255, 255, 255, 0.18)',
                borderRadius: '4px',
                color: shortlisted ? '#ffd700' : '#aaa',
                padding: '3px 8px',
                fontSize: '10px',
                fontFamily: 'Orbitron',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
            >
              {context === "shortlist" ? "❌ Remove" : (shortlisted ? "★ Shortlisted" : "☆ + Shortlist")}
            </button>
          </div>

          {/* Bidding Control Panel */}
          {inSquad ? (
            <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', padding: '4px 0' }}>
              Already registered
            </span>
          ) : player.bidStatus === 'accepted' ? (
            <span style={{
              padding: '5px 10px', background: 'rgba(0, 255, 100, 0.1)',
              border: '1px solid rgba(0, 255, 100, 0.3)', color: '#00ff64',
              borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Orbitron'
            }}>
              🤝 SIGNED
            </span>
          ) : player.bidStatus === 'rejected' ? (
            <span style={{
              padding: '5px 10px', background: 'rgba(255, 51, 81, 0.1)',
              border: '1px solid rgba(255, 51, 81, 0.3)', color: '#ff3333',
              borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Orbitron'
            }}>
              ❌ REJECTED
            </span>
          ) : (
            <>
              {!isFreeAgent && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>Bid Fee:</span>
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 4px' }}>
                    <span style={{ color: '#888', fontSize: '11px', marginRight: '2px' }}>$</span>
                    <input
                      type="number"
                      step="0.1"
                      value={bidValue}
                      onChange={(e) => handleBidChange(player.name, e.target.value)}
                      style={{
                        background: 'transparent', border: 'none', outline: 'none',
                        color: '#fff', fontSize: '11.5px', fontWeight: 'bold', width: '50px',
                        textAlign: 'center', fontFamily: 'Orbitron'
                      }}
                    />
                    <span style={{ color: '#888', fontSize: '11px', marginLeft: '2px' }}>M</span>
                  </div>
                </div>
              )}

              <div style={{ fontSize: '10px', textAlign: 'right' }}>
                {prob === -1 ? (
                  <span style={{ color: '#ff3333', fontWeight: 'bold' }}>Player Refuses to Join</span>
                ) : prob === -2 ? (
                  <span style={{ color: '#ff3344', fontWeight: 'bold' }}>⚔️ Rival Demands ≥ ${(effectiveValue * 1.35).toFixed(1)}M</span>
                ) : prob === -3 ? (
                  <span style={{ color: '#ffa500', fontWeight: 'bold' }}>🛡️ First 11: Min ${(effectiveValue * 1.15).toFixed(1)}M</span>
                ) : prob === 0 ? (
                  <span style={{ color: '#ff3333' }}>Offer Too Low</span>
                ) : (
                  <span style={{ color: '#aaa' }}>
                    Club Acceptance: <strong style={{ color: prob >= 70 ? '#00ff64' : (prob >= 40 ? '#ffa500' : '#ff3333') }}>{prob}%</strong>
                  </span>
                )}
              </div>

              <button
                onClick={() => handleMakeBid(player)}
                disabled={!isWindowOpen || prob <= 0 || (!isFreeAgent && (numericBid <= 0 || numericBid > budget))}
                className="play-match-btn glowing-btn"
                style={{
                  fontSize: '9.5px', padding: '5px 10px', width: '100%',
                  borderColor: (!isWindowOpen || prob <= 0 || (!isFreeAgent && (numericBid <= 0 || numericBid > budget))) ? 'rgba(255,255,255,0.1)' : '#ff4500',
                  color: (!isWindowOpen || prob <= 0 || (!isFreeAgent && (numericBid <= 0 || numericBid > budget))) ? '#666' : '#fff',
                  background: (!isWindowOpen || prob <= 0 || (!isFreeAgent && (numericBid <= 0 || numericBid > budget))) ? 'transparent' : 'rgba(255, 69, 0, 0.15)',
                  cursor: (!isWindowOpen || prob <= 0 || (!isFreeAgent && (numericBid <= 0 || numericBid > budget))) ? 'not-allowed' : 'pointer',
                  marginTop: '1px'
                }}
                title={!isWindowOpen ? "Transfer window closed (Opens R1-5 & Mid-Season)" : "Submit bid & negotiate contract"}
              >
                {!isWindowOpen ? "🔒 Window Closed" : (isFreeAgent ? "Offer Contract 📝" : "Submit Bid ➔")}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const currentTargets = leagueState.transferTargets || [];
  const TARGETS_PER_PAGE = 10;
  const paginatedTargets = currentTargets.slice((marketPage - 1) * TARGETS_PER_PAGE, marketPage * TARGETS_PER_PAGE);
  const paginatedShortlist = shortlist.slice((shortlistPage - 1) * TARGETS_PER_PAGE, shortlistPage * TARGETS_PER_PAGE);
  const paginatedSearchResults = searchResults.slice((searchPage - 1) * TARGETS_PER_PAGE, searchPage * TARGETS_PER_PAGE);

  return (
    <div className={inline ? "inline-transfer-container" : "modal-backdrop"} style={inline ? {
      width: '100%', maxWidth: '1080px', margin: '0 auto', display: 'flex', justifyContent: 'center'
    } : {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div className="glass-card animated-scale-in" style={{
        width: '100%', maxWidth: inline ? '1080px' : '980px', maxHeight: inline ? 'none' : '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1.5px solid rgba(255, 69, 0, 0.25)', boxShadow: '0 0 35px rgba(255, 69, 0, 0.15)',
        padding: '0', position: 'relative'
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '14px 20px', background: 'rgba(255, 69, 0, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
        }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              margin: '0', fontSize: '17px', fontWeight: 'bold', color: '#ffea00',
              fontFamily: 'Orbitron', letterSpacing: '1.5px', textTransform: 'uppercase'
            }}>
              TRANSFERS, CONTRACTS & PAYROLL — {season}
            </h2>
            <div style={{ fontSize: '10.5px', color: '#aaa', marginTop: '3px' }}>
              Club: <strong style={{ color: '#fff' }}>{playerTeamName}</strong> (Div {leagueState.division || 1}) | Round: {currentRound} of {totalRounds} | Club Rating: <strong style={{ color: '#00ff64' }}>{clubRating}/10</strong> | Manager: <strong style={{ color: '#ffd700' }}>{"⭐".repeat(Math.round(managerRating))} ({managerRating})</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {isWindowOpen ? (
              <span style={{
                background: 'rgba(0, 255, 100, 0.15)', border: '1px solid #00ff64',
                color: '#00ff64', padding: '3px 8px', borderRadius: '4px',
                fontSize: '10px', fontFamily: 'Orbitron', fontWeight: 'bold'
              }}>
                🟢 WINDOW OPEN
              </span>
            ) : (
              <span style={{
                background: 'rgba(255, 69, 0, 0.15)', border: '1px solid #ff4500',
                color: '#ff4500', padding: '3px 8px', borderRadius: '4px',
                fontSize: '10px', fontFamily: 'Orbitron', fontWeight: 'bold'
              }}>
                🔒 WINDOW CLOSED
              </span>
            )}

            {!inline && onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none', color: '#888',
                  fontSize: '20px', cursor: 'pointer', padding: '0 4px', lineHeight: 1
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ====================================================================
            FINANCIAL & PAYROLL ALLOCATION CONTROL BAR (Transfer ⇄ Payroll)
            ==================================================================== */}
        <div style={{
          padding: '10px 20px',
          background: 'linear-gradient(90deg, rgba(255, 234, 0, 0.05), rgba(0, 229, 255, 0.05))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Transfer Budget Box */}
          <div style={{
            background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255, 234, 0, 0.3)',
            borderRadius: '8px', padding: '6px 12px', display: 'flex', flexDirection: 'column', minWidth: '135px'
          }}>
            <span style={{ fontSize: '9px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transfer Budget</span>
            <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '15px' }}>
              ${budget.toFixed(2)}M
            </span>
          </div>

          {/* Interactive Budget Shifter Controls */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
            background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.07)'
          }}>
            <span style={{ fontSize: '9px', color: '#bbb', fontFamily: 'Orbitron', letterSpacing: '0.5px' }}>
              🔄 SHIFT BUDGET ($0.5M ⇄ $10,000/wk)
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => handleShiftBudget("to_transfer", 0.5)}
                disabled={availableWeeklyWage < 10000}
                style={{
                  background: availableWeeklyWage >= 10000 ? 'rgba(255, 234, 0, 0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: availableWeeklyWage >= 10000 ? '#ffea00' : 'rgba(255,255,255,0.1)',
                  color: availableWeeklyWage >= 10000 ? '#ffea00' : '#555',
                  borderRadius: '4px', padding: '3px 8px', fontSize: '10px',
                  fontFamily: 'Orbitron', fontWeight: 'bold',
                  cursor: availableWeeklyWage >= 10000 ? 'pointer' : 'not-allowed'
                }}
                title="Convert $10,000/wk unused payroll budget into +$0.50M transfer budget"
              >
                ⬅️ +$0.5M Transfer
              </button>

              <button
                onClick={() => handleShiftBudget("to_payroll", 0.5)}
                disabled={budget < 0.5}
                style={{
                  background: budget >= 0.5 ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                  border: '1px solid',
                  borderColor: budget >= 0.5 ? '#00e5ff' : 'rgba(255,255,255,0.1)',
                  color: budget >= 0.5 ? '#00e5ff' : '#555',
                  borderRadius: '4px', padding: '3px 8px', fontSize: '10px',
                  fontFamily: 'Orbitron', fontWeight: 'bold',
                  cursor: budget >= 0.5 ? 'pointer' : 'not-allowed'
                }}
                title="Convert $0.50M transfer budget into +$10,000/wk payroll budget"
              >
                +$10K/wk Payroll ➡️
              </button>
            </div>
          </div>

          {/* Payroll & Wage Bill Box */}
          <div style={{
            flex: '1 1 280px',
            background: 'rgba(0,0,0,0.35)',
            border: `1px solid ${availableWeeklyWage < 0 ? '#ff3344' : 'rgba(0, 229, 255, 0.3)'}`,
            borderRadius: '8px', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px' }}>
              <span style={{ color: '#aaa', textTransform: 'uppercase', fontSize: '9px' }}>
                Squad Payroll ({roster.length} players):
              </span>
              <span style={{ fontFamily: 'Orbitron', fontWeight: 'bold', color: '#fff', fontSize: '11.5px' }}>
                ${currentWeeklyPayroll.toLocaleString()}/wk <span style={{ color: '#888', fontWeight: 'normal' }}>/ ${effectivePayrollBudget.toLocaleString()}/wk</span>
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${payrollUsagePercent}%`,
                height: '100%',
                background: payrollUsagePercent > 95 ? '#ff3344' : (payrollUsagePercent > 82 ? '#ffa500' : '#00ff64'),
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ color: '#888' }}>Available Wage Room:</span>
              <strong style={{ color: availableWeeklyWage >= 0 ? '#00ff64' : '#ff3344', fontFamily: 'Orbitron' }}>
                {availableWeeklyWage >= 0 ? `+$${availableWeeklyWage.toLocaleString()}/wk` : `-$${Math.abs(availableWeeklyWage).toLocaleString()}/wk`}
              </strong>
            </div>
          </div>
        </div>

        {/* Sub-Header: Navigation Tabs */}
        <div style={{
          padding: '10px 20px', background: 'rgba(0,0,0,0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
        }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setActiveTab("buy"); setMessage(""); }}
              style={{
                background: activeTab === "buy" ? 'rgba(255, 69, 0, 0.2)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === "buy" ? '#ff4500' : 'rgba(255,255,255,0.1)',
                color: activeTab === "buy" ? '#ffea00' : '#aaa',
                borderRadius: '4px', padding: '6px 14px', fontSize: '11px',
                fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              📥 BUY PLAYERS ({currentTargets.length})
            </button>

            <button
              onClick={() => { setActiveTab("shortlist"); setMessage(""); }}
              style={{
                background: activeTab === "shortlist" ? 'rgba(255, 215, 0, 0.18)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === "shortlist" ? '#ffd700' : 'rgba(255,255,255,0.1)',
                color: activeTab === "shortlist" ? '#ffd700' : '#aaa',
                borderRadius: '4px', padding: '6px 14px', fontSize: '11px',
                fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              ⭐ SHORTLIST ({shortlist.length})
            </button>

            <button
              onClick={() => { setActiveTab("search"); setMessage(""); }}
              style={{
                background: activeTab === "search" ? 'rgba(0, 229, 255, 0.18)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === "search" ? '#00e5ff' : 'rgba(255,255,255,0.1)',
                color: activeTab === "search" ? '#00e5ff' : '#aaa',
                borderRadius: '4px', padding: '6px 14px', fontSize: '11px',
                fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              🔍 SEARCH
            </button>

            <button
              onClick={() => { setActiveTab("sell"); setMessage(""); }}
              style={{
                background: activeTab === "sell" ? 'rgba(255, 69, 0, 0.2)' : 'transparent',
                border: '1px solid',
                borderColor: activeTab === "sell" ? '#ff4500' : 'rgba(255,255,255,0.1)',
                color: activeTab === "sell" ? '#fff' : '#aaa',
                borderRadius: '4px', padding: '6px 14px', fontSize: '11px',
                fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              📤 SELL & SQUAD WAGES ({leagueState.transferOffers?.length || 0})
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div style={{
            background: (message.startsWith("❌") || message.startsWith("⚔️") || message.startsWith("🚧"))
              ? 'rgba(255,51,81,0.1)'
              : (message.startsWith("💵") || message.startsWith("🎉") || message.startsWith("⭐") || message.startsWith("💼")
                ? 'rgba(0,255,100,0.08)'
                : 'rgba(255,165,0,0.08)'),
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: '9px 20px', fontSize: '11.5px', color: '#fff', textAlign: 'left', fontWeight: 'bold'
          }}>
            💬 {message}
          </div>
        )}

        {/* Active Tab Contents */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '15px' }}>
              <div className="spinner" style={{
                width: '35px', height: '35px', border: '3px solid rgba(255,69,0,0.1)',
                borderTopColor: '#ff4500', borderRadius: '50%', animation: 'spin 1s linear infinite'
              }} />
              <span style={{ fontSize: '12px', color: '#ffea00', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                SCOUTING THE TRANSFER MARKET...
              </span>
            </div>
          ) : activeTab === "buy" ? (
            /* ========================================================
               TAB 1: BUY PLAYERS (Transfer Market - 50 Players)
               ======================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!isWindowOpen && (
                <div style={{
                  background: 'rgba(255,69,0,0.08)', border: '1px solid rgba(255,69,0,0.25)',
                  borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: '#ffaa66', textAlign: 'left'
                }}>
                  🔒 <strong>Transfer window closed:</strong> Bids can only be submitted during open windows (Rounds 1–5 & Mid-Season). You can still shortlist players and manage budgets now.
                </div>
              )}

              {currentTargets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '13px' }}>
                  No transfer targets available in this window.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {paginatedTargets.map(player => renderPlayerCard(player, "buy"))}
                  </div>

                  {renderPagination(marketPage, currentTargets.length, TARGETS_PER_PAGE, setMarketPage)}
                </>
              )}
            </div>
          ) : activeTab === "shortlist" ? (
            /* ========================================================
               TAB 2: SHORTLIST (Manager targets)
               ======================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', color: '#ffd700', fontFamily: 'Orbitron' }}>
                    ⭐ SHORTLISTED TARGETS ({shortlist.length})
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#888' }}>
                    Track players you are monitoring. Submit transfer bids and negotiate contracts when ready.
                  </p>
                </div>
              </div>

              {shortlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>⭐</div>
                  <h4 style={{ fontFamily: 'Orbitron', color: '#ffd700', margin: '0 0 6px 0', fontSize: '14px' }}>
                    YOUR SHORTLIST IS EMPTY
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#aaa', maxWidth: '440px', margin: '0 auto', lineHeight: '1.5' }}>
                    Add players from the <strong>Buy Players</strong> market or use the <strong>Search</strong> tab to scout any club in the world.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {paginatedShortlist.map(player => renderPlayerCard(player, "shortlist"))}
                  </div>

                  {renderPagination(shortlistPage, shortlist.length, TARGETS_PER_PAGE, setShortlistPage)}
                </>
              )}
            </div>
          ) : activeTab === "search" ? (
            /* ========================================================
               TAB 3: SEARCH (All Clubs & Players for this Season)
               ======================================================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 260px', position: 'relative' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedClub("");
                        setSearchPage(1);
                      }}
                      placeholder="Type player or club name (e.g. Real Madrid, Baggio, Zidane)..."
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0, 229, 255, 0.3)',
                        borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '12px',
                        outline: 'none', fontFamily: 'inherit'
                      }}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => { setSearchQuery(""); setSearchPage(1); }}
                        style={{
                          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                          background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '12px'
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div style={{ flex: '1 1 220px' }}>
                    <select
                      value={selectedClub}
                      onChange={(e) => {
                        setSelectedClub(e.target.value);
                        setSearchQuery("");
                        setSearchPage(1);
                      }}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '6px', padding: '8px 10px', color: '#ffd700', fontSize: '12px',
                        outline: 'none', cursor: 'pointer', fontFamily: 'inherit'
                      }}
                    >
                      <option value="">-- Choose Club ({clubsList.length} clubs) --</option>
                      {clubsList.map(c => (
                        <option key={c} value={c} style={{ background: '#111', color: '#fff' }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filter Pills: Position & Rating (1-10 Scale) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginRight: '4px' }}>Pos:</span>
                    {["ALL", "GK", "DEF", "MID", "ATT"].map(pos => (
                      <button
                        key={pos}
                        onClick={() => { setPosFilter(pos); setSearchPage(1); }}
                        style={{
                          background: posFilter === pos ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
                          border: '1px solid',
                          borderColor: posFilter === pos ? '#00e5ff' : 'rgba(255,255,255,0.1)',
                          color: posFilter === pos ? '#00e5ff' : '#888',
                          borderRadius: '3px', padding: '2px 8px', fontSize: '10px',
                          cursor: 'pointer', fontWeight: posFilter === pos ? 'bold' : 'normal'
                        }}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginRight: '4px' }}>Min Rating:</span>
                    {[
                      { label: 'All', min: 0 },
                      { label: '⭐ 9+ World Class', min: 9 },
                      { label: '⭐ 8+ Elite', min: 8 },
                      { label: '⭐ 7+ Starter', min: 7 },
                      { label: '⭐ 6+ Solid', min: 6 }
                    ].map(r => (
                      <button
                        key={r.min}
                        onClick={() => { setRatingFilter(r.min); setSearchPage(1); }}
                        style={{
                          background: ratingFilter === r.min ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                          border: '1px solid',
                          borderColor: ratingFilter === r.min ? '#ffd700' : 'rgba(255,255,255,0.1)',
                          color: ratingFilter === r.min ? '#ffd700' : '#888',
                          borderRadius: '3px', padding: '2px 8px', fontSize: '10px',
                          cursor: 'pointer', fontWeight: ratingFilter === r.min ? 'bold' : 'normal'
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {matchingClubsForQuery.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ fontSize: '10px', color: '#aaa' }}>Matching Clubs:</span>
                    {matchingClubsForQuery.map(c => (
                      <button
                        key={c}
                        onClick={() => { setSelectedClub(c); setSearchQuery(""); setSearchPage(1); }}
                        style={{
                          background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)',
                          color: '#00e5ff', borderRadius: '4px', padding: '2px 7px', fontSize: '10.5px',
                          cursor: 'pointer'
                        }}
                      >
                        🏟️ {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {searchLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#00e5ff' }}>
                  <div className="spinner" style={{
                    width: '30px', height: '30px', border: '3px solid rgba(0,229,255,0.1)',
                    borderTopColor: '#00e5ff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px'
                  }} />
                  <span style={{ fontSize: '11px', fontFamily: 'Orbitron' }}>LOADING GLOBAL SCOUTING DATABASE...</span>
                </div>
              ) : selectedClub ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.15)',
                    borderRadius: '6px', padding: '8px 12px'
                  }}>
                    <span style={{ fontSize: '12.5px', color: '#00e5ff', fontWeight: 'bold' }}>
                      🏟️ {selectedClub} — Squad Roster ({searchResults.length} players)
                      {checkDerby(playerTeamName, selectedClub) && (
                        <span style={{ marginLeft: '10px', color: '#ff3344', fontSize: '11px', fontFamily: 'Orbitron' }}>
                          ⚔️ ARCH-RIVAL ({checkDerby(playerTeamName, selectedClub).name})
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => { setSelectedClub(""); setSearchPage(1); }}
                      style={{
                        background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                        color: '#ccc', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', cursor: 'pointer'
                      }}
                    >
                      ✕ Clear Club
                    </button>
                  </div>

                  {searchResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#888', fontSize: '12px' }}>
                      No players match the selected filters.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {paginatedSearchResults.map(player => renderPlayerCard(player, "search"))}
                      </div>
                      {renderPagination(searchPage, searchResults.length, TARGETS_PER_PAGE, setSearchPage)}
                    </>
                  )}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#aaa', textAlign: 'left' }}>
                    Found <strong style={{ color: '#00e5ff' }}>{searchResults.length}</strong> players matching "{searchQuery}"
                  </div>

                  {searchResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '12px' }}>
                      No players or clubs found matching "{searchQuery}".
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {paginatedSearchResults.map(player => renderPlayerCard(player, "search"))}
                      </div>
                      {renderPagination(searchPage, searchResults.length, TARGETS_PER_PAGE, setSearchPage)}
                    </>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: '#888' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
                  <h4 style={{ fontFamily: 'Orbitron', color: '#00e5ff', margin: '0 0 6px 0', fontSize: '14px' }}>
                    GLOBAL SCOUTING SEARCH
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#aaa', maxWidth: '460px', margin: '0 auto', lineHeight: '1.5' }}>
                    Search any player or club from the {season} season, or choose a club from the dropdown to scout their squad, inspect First 11 starters, and submit bids.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               TAB 4: SELL PLAYERS & SQUAD PAYROLL
               ======================================================== */
            <div style={{
              display: 'flex',
              gap: '24px',
              height: '100%',
              minHeight: '400px',
              flexWrap: 'wrap',
              textAlign: 'left'
            }}>
              {/* Left Column: Squad, Wages & Listing */}
              <div style={{
                flex: '1.2 1 420px',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                overflow: 'hidden',
                maxHeight: '520px'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  color: '#ffd700',
                  fontFamily: 'Orbitron',
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>📋 Squad Wages & Transfer Listing</span>
                  <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 'normal' }}>
                    Size: {squadRoster.length}/30
                  </span>
                </h3>

                <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#aaa', lineHeight: '1.4' }}>
                  List players to attract bids (<strong style={{ color: '#00ff64' }}>60% chance</strong> next round) and free up weekly payroll room when sold.
                </p>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}>
                  {squadRoster.map((player) => {
                    const val = calculatePlayerValue(player, season);
                    const pWage = calculatePlayerWage(player, season, teamFinances?.weeklyWageCap);
                    return (
                      <div key={player.name} style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: player.transferListed
                          ? '1px solid rgba(255, 69, 0, 0.4)'
                          : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{player.name}</span>
                            <span
                              title={`Positions: ${formatPlayerPositions(player)}`}
                              style={{
                                fontSize: '9px',
                                background: 'rgba(255,255,255,0.08)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                color: '#ffd700',
                                fontWeight: 'bold'
                              }}
                            >
                              {formatPlayerPositions(player)}
                            </span>
                            {player.transferListed && (
                              <span style={{
                                fontSize: '9px',
                                background: 'rgba(255,69,0,0.15)',
                                border: '1px solid rgba(255,69,0,0.3)',
                                padding: '0px 4px',
                                borderRadius: '3px',
                                color: '#ff4500',
                                fontWeight: 'bold',
                                fontFamily: 'Orbitron'
                              }}>
                                LISTED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>
                            Age: {player.age} | Rating: <strong style={{ color: '#ffd700' }}>⭐ {player.rating}/10</strong>
                            {player.contractYears ? ` | Contract: ${player.contractYears}y` : ''}
                          </div>
                          <div style={{ fontSize: '11px', marginTop: '3px', display: 'flex', gap: '12px' }}>
                            <span style={{ color: '#ffd700', fontWeight: 'bold' }}>Value: ${val.toFixed(1)}M</span>
                            <span style={{ color: '#00ff64', fontWeight: 'bold' }}>Wage: ${pWage.toLocaleString()}/wk</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleTransferList(player.name)}
                          style={{
                            background: player.transferListed ? 'rgba(255, 69, 0, 0.15)' : 'transparent',
                            border: player.transferListed ? '1px solid #ff4500' : '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: player.transferListed ? '#ff4500' : '#ccc',
                            padding: '4px 10px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontFamily: 'Orbitron',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {player.transferListed ? "Delist ❌" : "List Player 📤"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Incoming Offers */}
              <div style={{
                flex: '1 1 350px',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                overflow: 'hidden',
                maxHeight: '520px'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  color: '#ff4500',
                  fontFamily: 'Orbitron',
                  letterSpacing: '1px'
                }}>
                  📥 Incoming Offers ({(leagueState.transferOffers || []).length})
                </h3>

                <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#aaa', lineHeight: '1.4' }}>
                  Accepting an offer adds the fee to your Transfer Budget and frees the player's weekly wages from your Payroll.
                </p>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}>
                  {(leagueState.transferOffers || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 10px', color: '#888', fontSize: '12px' }}>
                      <div style={{ fontSize: '28px', marginBottom: '10px' }}>📦</div>
                      <p>No active incoming transfer offers.</p>
                      <p style={{ fontSize: '10px', color: '#666', marginTop: '6px' }}>
                        Transfer-listed players have a high chance of receiving offers on the next match round.
                      </p>
                    </div>
                  ) : (
                    leagueState.transferOffers.map((offer, index) => {
                      const squadMatch = squadRoster.find(p => p.name === offer.playerName);
                      const offerWage = calculatePlayerWage(squadMatch || offer, season, teamFinances?.weeklyWageCap);
                      return (
                        <div key={offer.id || index} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{offer.playerName}</span>
                                <span
                                  title={`Positions: ${formatPlayerPositions(squadMatch || offer)}`}
                                  style={{
                                    fontSize: '9px',
                                    background: 'rgba(255,255,255,0.08)',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    color: '#ffd700',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {formatPlayerPositions(squadMatch || offer)}
                                </span>
                                {offer.isUnsolicited && (
                                  <span style={{
                                    fontSize: '9px',
                                    background: 'rgba(0,229,255,0.1)',
                                    border: '1px solid rgba(0,229,255,0.3)',
                                    padding: '0px 4px',
                                    borderRadius: '3px',
                                    color: '#00e5ff',
                                    fontWeight: 'bold'
                                  }}>
                                    UNSOLICITED
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>
                                Age: {offer.age} | Rating: ⭐ {offer.rating}/10 | Frees: <strong style={{ color: '#00ff64' }}>${offerWage.toLocaleString()}/wk</strong>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Buyer</div>
                              <div style={{ fontSize: '12px', color: '#00e5ff', fontWeight: 'bold' }}>{offer.fromClub}</div>
                            </div>
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(0,0,0,0.2)',
                            padding: '8px',
                            borderRadius: '6px'
                          }}>
                            <div style={{ textAlign: 'left' }}>
                              <span style={{ fontSize: '9px', color: '#888', display: 'block', textTransform: 'uppercase' }}>Offered Fee</span>
                              <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '15px' }}>
                                ${offer.offerAmount.toFixed(1)}M
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleAcceptOffer(offer)}
                                disabled={roster.length <= 15}
                                className="play-match-btn glowing-btn"
                                style={{
                                  fontSize: '10px',
                                  padding: '5px 10px',
                                  borderColor: roster.length <= 15 ? 'rgba(255,255,255,0.1)' : '#00ff64',
                                  color: roster.length <= 15 ? '#555' : '#00ff64',
                                  background: roster.length <= 15 ? 'transparent' : 'rgba(0, 255, 100, 0.05)',
                                  cursor: roster.length <= 15 ? 'not-allowed' : 'pointer'
                                }}
                              >
                                🤝 Accept
                              </button>
                              <button
                                onClick={() => handleRejectOffer(offer.id)}
                                className="play-match-btn"
                                style={{
                                  fontSize: '10px',
                                  padding: '5px 10px',
                                  borderColor: 'rgba(255,51,81,0.3)',
                                  color: '#ff3333',
                                  background: 'transparent'
                                }}
                              >
                                Reject
                              </button>
                            </div>
                          </div>

                          {roster.length <= 15 && (
                            <div style={{ fontSize: '9px', color: '#ff3333', textAlign: 'center' }}>
                              ⚠️ Cannot accept: Squad size is at minimum (15 players)
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ====================================================================
            STAGE 2 POPUP: PLAYER CONTRACT & WAGE NEGOTIATION MODAL
            ==================================================================== */}
        {contractNegotiation && (() => {
          const reqWage = getRequiredWageForYears(contractNegotiation);
          const acceptChance = getContractAcceptanceChance(contractNegotiation);
          const offeredWageNum = Math.round(Number(contractNegotiation.offeredWage) || 0);
          const wageRoomAfter = availableWeeklyWage - offeredWageNum;
          const isOverPayroll = wageRoomAfter < 0;

          return (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300,
              padding: '15px', boxSizing: 'border-box'
            }}>
              <div className="glass-card animated-scale-in" style={{
                width: '100%', maxWidth: '540px',
                background: 'linear-gradient(145deg, #101622, #090d14)',
                border: '2px solid #00e5ff',
                boxShadow: '0 0 40px rgba(0, 229, 255, 0.25)',
                borderRadius: '14px', padding: '22px',
                display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left'
              }}>
                {/* Popup Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#00ff64', fontFamily: 'Orbitron', fontWeight: 'bold', letterSpacing: '1px', display: 'block' }}>
                      ✅ CLUB FEE AGREED ({contractNegotiation.bidAmount > 0 ? `$${contractNegotiation.bidAmount.toFixed(1)}M` : 'FREE AGENT'})
                    </span>
                    <h3 style={{ margin: '4px 0 0 0', fontSize: '17px', color: '#fff', fontFamily: 'Orbitron' }}>
                      📝 CONTRACT NEGOTIATION
                    </h3>
                  </div>
                  <button
                    onClick={() => setContractNegotiation(null)}
                    style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '18px', cursor: 'pointer' }}
                    title="Walk away from talks"
                  >
                    ✕
                  </button>
                </div>

                {/* Player Summary Box */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#fff' }}>{contractNegotiation.player.name}</strong>
                      <span
                        title={`Positions: ${formatPlayerPositions(contractNegotiation.player)}`}
                        style={{ fontSize: '10px', background: 'rgba(255,215,0,0.15)', color: '#ffd700', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}
                      >
                        {formatPlayerPositions(contractNegotiation.player)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#ffd700', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                        ⭐ {contractNegotiation.player.rating}/10
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                      Age: {contractNegotiation.player.age} | From: <strong style={{ color: '#00e5ff' }}>{contractNegotiation.fromClub}</strong> | Current Wage: <strong>${contractNegotiation.currentWage.toLocaleString()}/wk</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '9px', color: '#888', display: 'block', textTransform: 'uppercase' }}>Agent Target</span>
                    <span style={{ fontSize: '13px', color: '#ffea00', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                      ~${reqWage.toLocaleString()}/wk ({contractNegotiation.preferredYears}y)
                    </span>
                  </div>
                </div>

                {/* Agent Message Quote */}
                <div style={{
                  background: contractNegotiation.attempt === 2 ? 'rgba(255, 165, 0, 0.1)' : 'rgba(0, 229, 255, 0.07)',
                  borderLeft: `3px solid ${contractNegotiation.attempt === 2 ? '#ffa500' : '#00e5ff'}`,
                  padding: '10px 12px', borderRadius: '6px', fontSize: '11.5px', color: '#eee', fontStyle: 'italic', lineHeight: '1.45'
                }}>
                  {contractNegotiation.agentMessage}
                </div>

                {/* Contract Length (Years) Selector */}
                <div>
                  <label style={{ fontSize: '10.5px', color: '#aaa', textTransform: 'uppercase', fontFamily: 'Orbitron', display: 'block', marginBottom: '6px' }}>
                    1. Select Contract Length (Years):
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map(yr => {
                      const active = contractNegotiation.offeredYears === yr;
                      return (
                        <button
                          key={yr}
                          onClick={() => setContractNegotiation(prev => ({ ...prev, offeredYears: yr }))}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: '6px',
                            border: active ? '1.5px solid #00e5ff' : '1px solid rgba(255,255,255,0.12)',
                            background: active ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0,0,0,0.3)',
                            color: active ? '#00e5ff' : '#aaa',
                            fontFamily: 'Orbitron',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {yr} {yr === 1 ? 'Year' : 'Yrs'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly Wage Offer Controls */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '10.5px', color: '#aaa', textTransform: 'uppercase', fontFamily: 'Orbitron' }}>
                      2. Weekly Wage Offer ($/wk):
                    </label>
                    <span style={{ fontSize: '10.5px', color: '#aaa' }}>
                      Acceptance Likelihood: <strong style={{ color: acceptChance >= 80 ? '#00ff64' : (acceptChance >= 45 ? '#ffa500' : '#ff3344'), fontFamily: 'Orbitron' }}>{acceptChance}%</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setContractNegotiation(prev => ({ ...prev, offeredWage: Math.max(500, (Number(prev.offeredWage) || 0) - 5000) }))}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', fontFamily: 'Orbitron', cursor: 'pointer' }}
                    >
                      -$5K
                    </button>
                    <button
                      onClick={() => setContractNegotiation(prev => ({ ...prev, offeredWage: Math.max(500, (Number(prev.offeredWage) || 0) - 1000) }))}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', fontFamily: 'Orbitron', cursor: 'pointer' }}
                    >
                      -$1K
                    </button>

                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.5)', border: '1.5px solid #ffd700', borderRadius: '6px', padding: '6px 10px'
                    }}>
                      <span style={{ color: '#ffd700', fontWeight: 'bold', marginRight: '4px' }}>$</span>
                      <input
                        type="number"
                        step="500"
                        value={contractNegotiation.offeredWage}
                        onChange={(e) => setContractNegotiation(prev => ({ ...prev, offeredWage: e.target.value }))}
                        style={{
                          background: 'transparent', border: 'none', outline: 'none',
                          color: '#fff', fontFamily: 'Orbitron', fontSize: '14px', fontWeight: 'bold',
                          width: '100px', textAlign: 'center'
                        }}
                      />
                      <span style={{ color: '#888', fontSize: '11px', marginLeft: '4px' }}>/wk</span>
                    </div>

                    <button
                      onClick={() => setContractNegotiation(prev => ({ ...prev, offeredWage: (Number(prev.offeredWage) || 0) + 1000 }))}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', fontFamily: 'Orbitron', cursor: 'pointer' }}
                    >
                      +$1K
                    </button>
                    <button
                      onClick={() => setContractNegotiation(prev => ({ ...prev, offeredWage: (Number(prev.offeredWage) || 0) + 5000 }))}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', fontFamily: 'Orbitron', cursor: 'pointer' }}
                    >
                      +$5K
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10.5px' }}>
                    <button
                      onClick={() => setContractNegotiation(prev => ({ ...prev, offeredWage: reqWage }))}
                      style={{ background: 'transparent', border: 'none', color: '#00e5ff', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '10.5px' }}
                    >
                      Match Agent's Demand (${reqWage.toLocaleString()}/wk)
                    </button>
                    <span style={{ color: '#888' }}>
                      Total Package: <strong style={{ color: '#ffd700' }}>${((offeredWageNum * 50 * contractNegotiation.offeredYears) / 1000000).toFixed(2)}M</strong> over {contractNegotiation.offeredYears}y
                    </span>
                  </div>
                </div>

                {/* Payroll Room Status & One-Click Budget Converter */}
                <div style={{
                  background: isOverPayroll ? 'rgba(255, 51, 68, 0.1)' : 'rgba(0, 255, 100, 0.06)',
                  border: `1px solid ${isOverPayroll ? '#ff3344' : 'rgba(0, 255, 100, 0.25)'}`,
                  borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: '#ccc' }}>Available Payroll Room: <strong>${availableWeeklyWage.toLocaleString()}/wk</strong></span>
                    <span style={{ color: isOverPayroll ? '#ff3344' : '#00ff64', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                      After Signing: {wageRoomAfter >= 0 ? `+$${wageRoomAfter.toLocaleString()}/wk` : `-$${Math.abs(wageRoomAfter).toLocaleString()}/wk`}
                    </span>
                  </div>

                  {isOverPayroll && (
                    <button
                      onClick={handleCoverWageDeficitInModal}
                      style={{
                        background: 'rgba(255, 234, 0, 0.15)', border: '1px solid #ffea00',
                        color: '#ffea00', borderRadius: '6px', padding: '6px 10px',
                        fontSize: '10.5px', fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
                      }}
                    >
                      ⚡ Shift Transfer Budget to Cover Wage Deficit
                    </button>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button
                    onClick={() => setContractNegotiation(null)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                      color: '#aaa', fontFamily: 'Orbitron', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    Walk Away
                  </button>
                  <button
                    onClick={handleSubmitContractOffer}
                    disabled={isOverPayroll}
                    className="play-match-btn glowing-btn"
                    style={{
                      flex: 2, padding: '10px', borderRadius: '8px',
                      borderColor: isOverPayroll ? 'rgba(255,255,255,0.1)' : '#00ff64',
                      background: isOverPayroll ? 'rgba(255,255,255,0.05)' : 'rgba(0, 255, 100, 0.18)',
                      color: isOverPayroll ? '#666' : '#00ff64',
                      fontFamily: 'Orbitron', fontSize: '12px', fontWeight: 'bold',
                      cursor: isOverPayroll ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ✍️ Submit Contract Offer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Dynamic keyframe animation style block */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
