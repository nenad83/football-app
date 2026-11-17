import React, { useState, useEffect, useMemo } from 'react';
import { updateTeamStatsInStorage } from './FormationTactics';
import { getPrebuiltRoster, getTransferMarketPool, loadSeasonRosters } from '../data/rosters/rosterRegistry';
import { generateTransferAnnouncementNews } from '../utils/newsGenerator';


// Calculate player value based on rating, age, and era inflation
export const calculatePlayerValue = (player, seasonStr) => {
  const r = parseInt(player.rating) || 3;
  const age = parseInt(player.age) || 25;

  let baseVal = 0.5;
  if (r === 1) baseVal = 0.3;
  else if (r === 2) baseVal = 1.0;
  else if (r === 3) baseVal = 3.0;
  else if (r === 4) baseVal = 8.0;
  else if (r === 5) baseVal = 22.0;

  let ageMult = 1.0;
  if (age < 23) ageMult = 1.15;
  else if (age >= 29 && age <= 32) ageMult = 0.8;
  else if (age > 32) ageMult = 0.45;

  const eraYear = parseInt((seasonStr || "2001").split("/")[0]) || 2001;
  const eraMultiplier = 1 + (eraYear - 1980) * 0.04;
  return parseFloat((baseVal * ageMult * eraMultiplier).toFixed(1));
};

// Compute dynamic success probability
export const getTransferSuccessProbability = (player, bid, clubRating, managerRating, seasonStr) => {
  const val = calculatePlayerValue(player, seasonStr);
  if (bid < val * 0.6) return 0; // Instant reject if bid is below 60% of value

  // Good players refuse to go to low teams unless manager rating is elite
  const clubDiff = player.rating - clubRating;
  if (clubDiff > 1.5 && managerRating < 4.0) {
    return -1; // special code for refusal
  }

  const ratio = bid / val;
  let moneyProb = 0;
  if (ratio >= 1.0) {
    moneyProb = 60 + ((ratio - 1.0) / 0.5) * 35; // scales to 95% at 1.5x value
  } else {
    moneyProb = ((ratio - 0.6) / 0.4) * 60; // scales to 60% at 1.0x value
  }

  const prestigeAvg = (clubRating + managerRating) / 2;
  const prestigeDiff = prestigeAvg - player.rating;

  let finalProb = moneyProb + (prestigeDiff * 12);
  finalProb = Math.max(5, Math.min(95, Math.round(finalProb)));
  return finalProb;
};

// Helper: match player position against broad filter (GK, DEF, MID, ATT)
export const matchesPositionFilter = (pos, filter) => {
  if (!filter || filter === "ALL") return true;
  const p = (pos || "").toUpperCase();
  if (filter === "GK") return p.includes("GK");
  if (filter === "DEF") return p.includes("D") && !p.includes("DMC");
  if (filter === "MID") return p.includes("M") || p.includes("DMC") || p.includes("AMC");
  if (filter === "ATT") return p.includes("ST") || p.includes("CF") || p.includes("F") || p.includes("W");
  return p.includes(filter);
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

  // Search tab states
  const [seasonRostersData, setSeasonRostersData] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClub, setSelectedClub] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [ratingFilter, setRatingFilter] = useState(0);

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

  // Club Rating (1-5 stars)
  const clubRating = playerTeamObj ? parseFloat(((playerTeamObj.attack + playerTeamObj.midfield + playerTeamObj.defense) / 3).toFixed(1)) : 3.0;

  // Determine if Transfer Window is currently open
  // Open in first 5 rounds (1-5) and mid-season winter period of 5 rounds starting at midpoint
  const totalRounds = teams.length ? (teams.length - 1) * 2 : 30;
  const midRoundStart = Math.floor(totalRounds / 2);
  const isWindowOpen = (currentRound >= 1 && currentRound <= 5) || (currentRound >= midRoundStart && currentRound < midRoundStart + 5);

  const windowKey = `${season}_${currentRound <= 5 ? 'start' : 'mid'}`;

  // Get active roster size
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

  useEffect(() => {
    let isMounted = true;
    if (isOpen || inline) {
      const raw = localStorage.getItem(rosterKey);
      if (raw) {
        try {
          setSquadRoster(JSON.parse(raw));
        } catch {
          setSquadRoster([]);
        }
      } else {
        if (typeof getPrebuiltRoster === 'function') {
          Promise.resolve(getPrebuiltRoster(playerTeamName, season)).then(prebuilt => {
            if (isMounted && prebuilt && prebuilt.length > 0) {
              localStorage.setItem(rosterKey, JSON.stringify(prebuilt));
              setSquadRoster(prebuilt);
            }
          }).catch(() => { });
        }
      }
    }
    return () => { isMounted = false; };
  }, [isOpen, inline, rosterKey, playerTeamName, season]);

  const roster = squadRoster;
  const shortlist = useMemo(() => leagueState?.shortlist || [], [leagueState?.shortlist]);

  // Load Season Rosters on demand for Search Tab
  useEffect(() => {
    if (activeTab === "search" && !seasonRostersData && !searchLoading && season) {
      setSearchLoading(true);
      Promise.all([
        loadSeasonRosters(season),
        getTransferMarketPool ? getTransferMarketPool(season) : Promise.resolve([])
      ]).then(([rosters, cmPool]) => {
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
      }).catch(err => {
        console.warn("[TransferModal] Error loading season rosters for search:", err);
        setSearchLoading(false);
      });
    }
  }, [activeTab, seasonRostersData, searchLoading, season]);

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
        value: p.value || calculatePlayerValue(p, season)
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
              value: p.value || calculatePlayerValue(p, season)
            });
            if (pool.length >= 250) break;
          }
        }
        if (pool.length >= 250) break;
      }
    }

    if (posFilter !== "ALL") {
      pool = pool.filter(p => matchesPositionFilter(p.position, posFilter));
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

  const handleToggleShortlist = (player) => {
    if (!player || !player.name) return;
    const currentShortlist = leagueState?.shortlist || [];
    const exists = currentShortlist.some(p => p.name.toLowerCase() === player.name.toLowerCase());
    let updated;
    if (exists) {
      updated = currentShortlist.filter(p => p.name.toLowerCase() !== player.name.toLowerCase());
      setMessage(`⭐ Removed ${player.name} from shortlist.`);
    } else {
      const item = {
        name: player.name,
        position: player.position,
        positions: player.positions || [player.position],
        rating: player.rating,
        age: player.age,
        currentClub: player.currentClub || player.club || "Free Agent",
        historicalNotes: player.historicalNotes || (player.currentClub && player.currentClub !== "Free Agent" ? `Player at ${player.currentClub}.` : "Free agent target."),
        value: player.value !== undefined ? player.value : calculatePlayerValue(player, season),
        bidStatus: player.bidStatus || null
      };
      updated = [...currentShortlist, item];
      setMessage(`⭐ Added ${player.name} to shortlist!`);
    }

    const updatedState = {
      ...leagueState,
      shortlist: updated
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

      // If cmPool had fewer than 50 players (e.g. 1994), supplement with real club players from that season
      if (picked.length < 50) {
        try {
          const allSeasonRosters = await loadSeasonRosters(season);
          if (allSeasonRosters) {
            const candidates = [];
            for (const [cName, squad] of Object.entries(allSeasonRosters)) {
              if (cName.toLowerCase() === playerTeamName.toLowerCase()) continue;
              if (!Array.isArray(squad)) continue;
              for (const cp of squad) {
                if (!activeNames.has(cp.name.toLowerCase()) && !pickedNames.has(cp.name)) {
                  candidates.push({
                    name: cp.name,
                    position: cp.position,
                    positions: cp.positions || [cp.position],
                    rating: cp.rating,
                    age: cp.age,
                    currentClub: cName,
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
          positions: p.positions || [p.position],
          rating: p.rating,
          age: p.age,
          currentClub: p.currentClub || (p.onLoan ? p.loanClub : "Free Agent"),
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
        const rating = Math.max(1, Math.min(5, Math.round(clubRating + (Math.random() * 2 - 1))));
        const p = {
          name: `${firstName} ${lastName}`,
          position: primaryPos,
          positions: [primaryPos],
          rating: rating,
          age: 19 + Math.floor(Math.random() * 14),
          currentClub: "Other Club",
          historicalNotes: "Available for transfer this window."
        };
        p.value = calculatePlayerValue(p, season);
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
            positions: p.positions || [p.position],
            rating: p.rating,
            age: p.age,
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
              positions: p.positions || [p.position],
              rating: p.rating,
              age: p.age,
              fromClub: buyerClub,
              offerAmount: parseFloat((val * multiplier).toFixed(1)),
              isUnsolicited: true
            });
          }
        });
      }

      generatedOffers = offersList;
    }

    const updatedState = {
      ...leagueState,
      lastTransferWindow: windowKey,
      lastTransferUpdateRound: currentRound,
      transferTargets: generatedTargets,
      transferOffers: generatedOffers
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
              positions: p.positions || [p.position],
              rating: p.rating,
              age: p.age,
              currentClub: p.currentClub || (p.onLoan ? p.loanClub : "Free Agent"),
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
                    positions: cp.positions || [cp.position],
                    rating: cp.rating,
                    age: cp.age,
                    currentClub: cName,
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
            positions: p.positions || [p.position],
            rating: p.rating,
            age: p.age,
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
          positions: p.positions || [p.position],
          rating: p.rating,
          age: p.age,
          fromClub: buyerClub,
          offerAmount: parseFloat((val * multiplier).toFixed(1)),
          isUnsolicited: true
        });
      }

      updatedOffers = [...updatedOffers, ...newOffersList];
    }

    const updatedState = {
      ...leagueState,
      lastTransferUpdateRound: currentRound,
      transferTargets: updatedTargets,
      transferOffers: updatedOffers
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setLoading(false);
  };

  const getBidValue = (player) => {
    if (!player || !player.name) return "0.0";
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

    const bidStr = customBidAmount !== undefined ? customBidAmount : getBidValue(player);
    const bidAmount = parseFloat(bidStr);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      setMessage("❌ Please enter a valid bid amount.");
      return;
    }
    if (bidAmount > budget) {
      setMessage("❌ You do not have enough transfer budget for this bid.");
      return;
    }

    const prob = getTransferSuccessProbability(player, bidAmount, clubRating, managerRating, season);
    if (prob === -1) {
      setMessage(`❌ Negotiations failed: ${player.name} refuses to negotiate with a club of our reputation.`);
      return;
    }

    const roll = Math.floor(Math.random() * 100);
    const success = roll < prob;

    const targetsCopy = [...(leagueState.transferTargets || [])];
    const targetIdx = targetsCopy.findIndex(t => t.name.toLowerCase() === player.name.toLowerCase());

    const shortlistCopy = [...(leagueState.shortlist || [])];
    const shortlistIdx = shortlistCopy.findIndex(t => t.name.toLowerCase() === player.name.toLowerCase());

    if (success) {
      const newBudget = parseFloat((budget - bidAmount).toFixed(1));

      const squadPlayer = {
        name: player.name,
        position: player.position,
        positions: player.positions || [player.position],
        rating: player.rating,
        age: player.age,
        condition: 100,
        injuryMatchesLeft: 0,
        injury: null,
        isAI: true
      };

      currentRoster.push(squadPlayer);
      localStorage.setItem(rosterKey, JSON.stringify(currentRoster));
      setSquadRoster(currentRoster);

      // Remove from seller club's local storage if saved
      if (player.currentClub && player.currentClub !== "Free Agent" && player.currentClub !== playerTeamName) {
        const oldClubKey = `retro_roster_${player.currentClub}_${season}`;
        const rawOld = localStorage.getItem(oldClubKey);
        if (rawOld) {
          try {
            const oldRoster = JSON.parse(rawOld);
            const filteredOld = oldRoster.filter(p => p.name.toLowerCase() !== player.name.toLowerCase());
            localStorage.setItem(oldClubKey, JSON.stringify(filteredOld));
          } catch { }
        }
      }

      if (targetIdx !== -1) {
        targetsCopy[targetIdx] = { ...targetsCopy[targetIdx], bidStatus: 'accepted' };
      }
      if (shortlistIdx !== -1) {
        shortlistCopy[shortlistIdx] = { ...shortlistCopy[shortlistIdx], bidStatus: 'accepted' };
      }

      // Generate Transfer Desk Done Deal news
      const dealNews = generateTransferAnnouncementNews({
        playerName: player.name,
        playerPosition: player.position,
        playerAge: player.age,
        fromClub: player.currentClub || player.club || "Free Agent",
        toClub: playerTeamName,
        fee: bidAmount,
        isBuy: true,
        managerName: leagueState?.managerName || "The Manager",
        season
      });
      const updatedNewsFeed = [dealNews, ...(leagueState.newsFeed || [])];

      const updatedState = {
        ...leagueState,
        budget: newBudget,
        transferTargets: targetsCopy,
        shortlist: shortlistCopy,
        newsFeed: updatedNewsFeed
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`🎉 SUCCESS! ${player.name} has signed with our club for a fee of $${bidAmount.toFixed(1)}M!`);
    } else {
      if (targetIdx !== -1) {
        targetsCopy[targetIdx] = { ...targetsCopy[targetIdx], bidStatus: 'rejected' };
      }
      if (shortlistIdx !== -1) {
        shortlistCopy[shortlistIdx] = { ...shortlistCopy[shortlistIdx], bidStatus: 'rejected' };
      }

      const updatedState = {
        ...leagueState,
        transferTargets: targetsCopy,
        shortlist: shortlistCopy
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`❌ NEGOTIATIONS FAILED: ${player.name} (${player.currentClub || player.club || 'club'}) has rejected our offer.`);
    }
  };

  const handleAcceptOffer = (offer) => {
    const currentRoster = getRoster();
    if (currentRoster.length <= 15) {
      setMessage("❌ Roster size cannot drop below 15 players.");
      return;
    }

    const updatedRoster = currentRoster.filter(p => p.name !== offer.playerName);
    localStorage.setItem(rosterKey, JSON.stringify(updatedRoster));
    setSquadRoster(updatedRoster);

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

    const newBudget = parseFloat((budget + offer.offerAmount).toFixed(1));
    const remainingOffers = (leagueState.transferOffers || []).filter(o => o.id !== offer.id);

    const careerRaw = localStorage.getItem("retro_league_career");
    let currentTeams = teams;
    if (careerRaw) {
      try {
        const parsed = JSON.parse(careerRaw);
        currentTeams = parsed.teams;
      } catch { }
    }

    // Generate Transfer Desk Departure news
    const sellNews = generateTransferAnnouncementNews({
      playerName: offer.playerName,
      playerPosition: offer.position,
      playerAge: offer.age,
      fromClub: playerTeamName,
      toClub: offer.fromClub,
      fee: offer.offerAmount,
      isBuy: false,
      managerName: leagueState?.managerName || "The Manager",
      season
    });
    const updatedNewsFeed = [sellNews, ...(leagueState.newsFeed || [])];

    const updatedState = {
      ...leagueState,
      teams: currentTeams,
      budget: newBudget,
      transferOffers: remainingOffers,
      newsFeed: updatedNewsFeed
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setMessage(`💵 SOLD! ${offer.playerName} has joined ${offer.fromClub} for $${offer.offerAmount.toFixed(1)}M.`);
  };

  const handleRejectOffer = (offerId) => {
    const remainingOffers = (leagueState.transferOffers || []).filter(o => o.id !== offerId);
    const updatedState = {
      ...leagueState,
      transferOffers: remainingOffers
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setMessage("Offer rejected.");
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

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
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
    const bidValue = getBidValue(player);
    const numericBid = parseFloat(bidValue) || 0;
    const prob = getTransferSuccessProbability(player, numericBid, clubRating, managerRating, season);
    const inSquad = isPlayerInSquad(player.name);
    const shortlisted = isShortlisted(player.name);
    const effectiveValue = player.value !== undefined ? player.value : calculatePlayerValue(player, season);

    return (
      <div key={player.name} style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1.5px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '8px', padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px',
        opacity: player.bidStatus ? 0.65 : 1,
        transition: 'border-color 0.2s ease'
      }}>
        {/* Player Identity */}
        <div style={{ flexGrow: 1, textAlign: 'left', minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#fff' }}>{player.name}</span>
            <span style={{
              fontSize: '9px', background: 'rgba(255,255,255,0.08)',
              padding: '1px 5px', borderRadius: '3px', color: '#ffd700', fontWeight: 'bold'
            }}>
              {player.position}
            </span>
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
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>
            Age: {player.age} | Club: <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>{player.currentClub || player.club || "Free Agent"}</span>
          </div>
          {player.historicalNotes && (
            <div style={{
              fontSize: '10px', color: '#888', fontStyle: 'italic', marginTop: '4px',
              background: 'rgba(255,255,255,0.01)', padding: '3px 6px', borderRadius: '4px',
              borderLeft: '2px solid rgba(255, 69, 0, 0.3)'
            }}>
              📋 {player.historicalNotes}
            </div>
          )}
        </div>

        {/* Player Rating & Value */}
        <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>Rating</span>
          <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '11px' }}>
            {"⭐".repeat(player.rating)}
          </span>
          <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', marginTop: '2px' }}>Value</span>
          <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '12.5px' }}>
            ${effectiveValue.toFixed(1)}M
          </span>
        </div>

        {/* Actions: Shortlist Toggle & Bidding Control */}
        <div style={{ width: '230px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
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
              🤝 BOUGHT
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
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#aaa' }}>Offer:</span>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 4px' }}>
                  <span style={{ color: '#888', fontSize: '11px', marginRight: '2px' }}>$</span>
                  <input
                    type="number"
                    step="0.1"
                    value={bidValue}
                    onChange={(e) => handleBidChange(player.name, e.target.value)}
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      color: '#fff', fontSize: '11.5px', fontWeight: 'bold', width: '46px',
                      textAlign: 'center', fontFamily: 'Orbitron'
                    }}
                  />
                  <span style={{ color: '#888', fontSize: '11px', marginLeft: '2px' }}>M</span>
                </div>
              </div>

              <div style={{ fontSize: '10px', textAlign: 'right' }}>
                {prob === -1 ? (
                  <span style={{ color: '#ff3333', fontWeight: 'bold' }}>Player Refuses to Join</span>
                ) : prob === 0 ? (
                  <span style={{ color: '#ff3333' }}>Offer Too Low</span>
                ) : (
                  <span style={{ color: '#aaa' }}>
                    Chance: <strong style={{ color: prob >= 70 ? '#00ff64' : (prob >= 40 ? '#ffa500' : '#ff3333') }}>{prob}%</strong>
                  </span>
                )}
              </div>

              <button
                onClick={() => handleMakeBid(player)}
                disabled={!isWindowOpen || prob === -1 || numericBid <= 0 || numericBid > budget}
                className="play-match-btn glowing-btn"
                style={{
                  fontSize: '9.5px', padding: '4px 10px', width: '100%',
                  borderColor: (!isWindowOpen || prob === -1 || numericBid <= 0 || numericBid > budget) ? 'rgba(255,255,255,0.1)' : '#ff4500',
                  color: (!isWindowOpen || prob === -1 || numericBid <= 0 || numericBid > budget) ? '#666' : '#fff',
                  background: (!isWindowOpen || prob === -1 || numericBid <= 0 || numericBid > budget) ? 'transparent' : 'rgba(255, 69, 0, 0.1)',
                  cursor: (!isWindowOpen || prob === -1 || numericBid <= 0 || numericBid > budget) ? 'not-allowed' : 'pointer',
                  marginTop: '1px'
                }}
                title={!isWindowOpen ? "Transfer window closed (Opens R1-5 & Mid-Season)" : "Submit transfer bid"}
              >
                {!isWindowOpen ? "🔒 Window Closed" : "Submit Bid ➔"}
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
      width: '100%', maxWidth: '1050px', margin: '0 auto', display: 'flex', justifyContent: 'center'
    } : {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div className="glass-card animated-scale-in" style={{
        width: '100%', maxWidth: inline ? '1050px' : '950px', maxHeight: inline ? 'none' : '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1.5px solid rgba(255, 69, 0, 0.25)', boxShadow: '0 0 35px rgba(255, 69, 0, 0.15)',
        padding: '0'
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
              TRANSFERS & SCOUTING — {season}
            </h2>
            <div style={{ fontSize: '10.5px', color: '#aaa', marginTop: '3px' }}>
              Club: <strong style={{ color: '#fff' }}>{playerTeamName}</strong> (Div {leagueState.division || 1}) | Round: {currentRound} of {totalRounds}
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

        {/* Sub-Header: Tabs & Budget */}
        <div style={{
          padding: '10px 20px', background: 'rgba(0,0,0,0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
        }}>
          {/* Navigation Tabs */}
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
              📤 SELL PLAYERS ({leagueState.transferOffers?.length || 0})
            </button>
          </div>

          {/* Stats & Budget */}
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', fontSize: '11.5px' }}>
            <div style={{ display: 'flex', gap: '5px', color: '#aaa' }}>
              <span>Club:</span>
              <span style={{ color: '#00ff64', fontWeight: 'bold' }}>{"⭐".repeat(Math.round(clubRating))} ({clubRating})</span>
            </div>
            <div style={{ display: 'flex', gap: '5px', color: '#aaa' }}>
              <span>Manager:</span>
              <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{"⭐".repeat(Math.round(managerRating))} ({managerRating})</span>
            </div>
            <div style={{
              background: 'rgba(255, 234, 0, 0.05)', border: '1px solid rgba(255, 234, 0, 0.25)',
              borderRadius: '6px', padding: '3px 10px', display: 'flex', gap: '6px', alignItems: 'center'
            }}>
              <span style={{ color: '#888', fontSize: '10px', textTransform: 'uppercase' }}>Budget:</span>
              <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '13px' }}>
                ${budget.toFixed(1)}M
              </span>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div style={{
            background: message.startsWith("❌") ? 'rgba(255,51,81,0.08)' : (message.startsWith("💵") || message.startsWith("🎉") || message.startsWith("⭐") ? 'rgba(0,255,100,0.08)' : 'rgba(255,255,255,0.03)'),
            borderBottom: '1px solid rgba(255,255,255,0.05)',
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
                  🔒 <strong>Transfer window closed:</strong> Bids can only be submitted during open windows (Rounds 1–5 & Mid-Season). You can still shortlist players now.
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
                    Track players you are monitoring. Make contract offers directly from here when ready.
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
              {/* Search Bar Controls */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px'
              }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search Input */}
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

                  {/* Club Dropdown Selector */}
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

                {/* Filter Pills: Position & Rating */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Position Filter */}
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

                  {/* Star Rating Filter */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginRight: '4px' }}>Min Rating:</span>
                    {[
                      { label: 'All', min: 0 },
                      { label: '⭐⭐⭐⭐⭐ (5)', min: 5 },
                      { label: '⭐⭐⭐⭐+ (4+)', min: 4 },
                      { label: '⭐⭐⭐+ (3+)', min: 3 }
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

                {/* Matching Clubs Quick Pills (when typing a club name) */}
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

              {/* Search Results Display */}
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
                /* Empty Search Prompt */
                <div style={{ textAlign: 'center', padding: '50px 20px', color: '#888' }}>
                  <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔍</div>
                  <h4 style={{ fontFamily: 'Orbitron', color: '#00e5ff', margin: '0 0 6px 0', fontSize: '14px' }}>
                    GLOBAL SCOUTING SEARCH
                  </h4>
                  <p style={{ fontSize: '11.5px', color: '#aaa', maxWidth: '460px', margin: '0 auto', lineHeight: '1.5' }}>
                    Search any player or club from the {season} season, or choose a club from the dropdown to scout their entire 22-player squad and make offers.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================
               TAB 4: SELL PLAYERS
               ======================================================== */
            <div style={{
              display: 'flex',
              gap: '24px',
              height: '100%',
              minHeight: '400px',
              flexWrap: 'wrap',
              textAlign: 'left'
            }}>
              {/* Left Column: Squad & Listing */}
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
                  <span>📋 Squad & Listing</span>
                  <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 'normal' }}>
                    Size: {squadRoster.length}/30
                  </span>
                </h3>

                <p style={{ margin: '0 0 16px 0', fontSize: '11px', color: '#aaa', lineHeight: '1.4' }}>
                  List players you don't need. They have a <strong style={{ color: '#00ff64' }}>60% chance</strong> of receiving offers on next round turns.
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
                            <span style={{
                              fontSize: '9px',
                              background: 'rgba(255,255,255,0.08)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              color: '#ffd700',
                              fontWeight: 'bold'
                            }}>
                              {player.position}
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
                            Age: {player.age} | Rating: {"⭐".repeat(player.rating)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#ffd700', marginTop: '3px', fontWeight: 'bold' }}>
                            Est. Value: ${val.toFixed(1)}M
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
                  Review bids received from other clubs. Accepting an offer sells the player immediately.
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
                    leagueState.transferOffers.map((offer, index) => (
                      <div key={offer.id || index} style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        {/* Player Info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#fff' }}>{offer.playerName}</span>
                              <span style={{
                                fontSize: '9px',
                                background: 'rgba(255,255,255,0.08)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                color: '#ffd700',
                                fontWeight: 'bold'
                              }}>
                                {offer.position}
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
                              Age: {offer.age} | Rating: {"⭐".repeat(offer.rating)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Buyer</div>
                            <div style={{ fontSize: '12px', color: '#00e5ff', fontWeight: 'bold' }}>{offer.fromClub}</div>
                          </div>
                        </div>

                        {/* Fee & Action Buttons */}
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
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

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
