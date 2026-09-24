import React, { useState, useEffect } from 'react';
import { updateTeamStatsInStorage } from './FormationTactics';

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

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

  const eraMultiplier = 1 + (parseInt(seasonStr.split("/")[0]) - 1980) * 0.04;
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

// Names database for procedural fallbacks
const FIRST_NAMES = ["Oliver", "David", "Christian", "Alessandro", "Roberto", "Gabriel", "Ronaldo", "Zinedine", "Luis", "Thierry", "Alan", "Dennis", "Roy", "Patrick", "Pavel", "Hernan", "Michael", "Francesco", "Gianluigi", "Paolo", "Fabio", "Gary", "Paul", "Ryan", "Peter", "Ruud", "Eric", "Marc", "Clarence", "Edgar"];
const LAST_NAMES = ["Kahn", "Beckham", "Vieri", "Del Piero", "Baggio", "Batistuta", "Zidane", "Figo", "Henry", "Shearer", "Bergkamp", "Keane", "Vieira", "Nedved", "Crespo", "Owen", "Totti", "Buffon", "Maldini", "Cannavaro", "Neville", "Scholes", "Giggs", "Schmeichel", "van Nistelrooy", "Cantona", "Overmars", "Seedorf", "Davids", "Stam"];

export default function TransferModal({ isOpen, onClose, leagueState, setLeagueState, managerProfile, inline = false }) {
  const [activeTab, setActiveTab] = useState("buy"); // "buy" | "sell"
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState({}); // playerId -> bid amount string
  const [message, setMessage] = useState("");

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
  const getRoster = () => {
    try {
      const raw = localStorage.getItem(rosterKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [squadRoster, setSquadRoster] = useState([]);

  useEffect(() => {
    if (isOpen || inline) {
      setSquadRoster(getRoster());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, inline, rosterKey]);

  const roster = squadRoster;

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

  // Generate unique window targets and offers if not set or different window
  useEffect(() => {
    if ((!isOpen && !inline) || !leagueState) return;
    if (!isWindowOpen) return;
    if (leagueState.lastTransferWindow !== windowKey) {
      generateMarketData();
    } else if (leagueState.lastTransferUpdateRound !== currentRound) {
      updateMarketData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, inline, isWindowOpen, leagueState?.lastTransferUpdateRound, currentRound]);

  if ((!isOpen && !inline) || !leagueState) return null;

  const generateMarketData = async () => {
    setLoading(true);
    let generatedTargets = [];
    let generatedOffers = [];

    // 1. Generate Buy Targets (AI first, fallback procedural)
    try {
      const prompt = `You are a football transfer historian.
For the season "${season}" (specifically starting year ${season.split("/")[0]}), list 16-20 authentic, real-world football players who were actively transferred or involved in key transfer stories in that specific season.
These transfer targets must be realistic and calibrated for a club with:
- Division: ${leagueState.division || 1}
- Average Club Star Rating: ${clubRating}/5 (Attack: ${playerTeamObj?.attack}/5, Midfield: ${playerTeamObj?.midfield}/5, Defense: ${playerTeamObj?.defense}/5)
- Transfer Budget: $${budget.toFixed(1)}M USD

Requirements:
1. Provide exactly 16-20 players.
2. The players must be real players who transferred in real life in ${season.split("/")[0]}.
3. Provide realistic ratings (1-5) and ages for that season.
4. Scale values so that at least 6-8 players are well within our budget, several are near the budget, and 2-4 can be high-profile stars slightly beyond our range.
5. Do not include players already in our active squad: ${roster.map(p => p.name).join(", ")}.
6. Return a JSON array. Each object must have:
   - "name": Full name of the player
   - "position": One of: "GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"
   - "positions": Array of 1-3 positions starting with their primary position
   - "rating": Integer between 1 and 5
   - "age": Integer age
   - "currentClub": The club they are transferring from in real life
   - "historicalNotes": A brief 1-sentence note about their real transfer that season (e.g. "Transferred to Newcastle from Blackburn for £15m.")`;

      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                position: { type: "STRING" },
                positions: { type: "ARRAY", items: { type: "STRING" } },
                rating: { type: "INTEGER" },
                age: { type: "INTEGER" },
                currentClub: { type: "STRING" },
                historicalNotes: { type: "STRING" }
              },
              required: ["name", "position", "positions", "rating", "age", "currentClub", "historicalNotes"]
            }
          }
        }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text.trim());
          if (Array.isArray(parsed) && parsed.length > 0) {
            generatedTargets = parsed.map(p => ({
              ...p,
              value: calculatePlayerValue(p, season),
              bidStatus: null
            }));
          }
        }
      }
    } catch (e) {
      console.warn("Failed to fetch targets from Gemini, falling back to procedural", e);
    }

    // Procedural Fallback if Gemini fails or returns empty
    if (generatedTargets.length === 0) {
      const positionsPool = ["GK", "DL", "DR", "DC", "MC", "MR", "ML", "AMC", "ST", "CF"];
      for (let i = 0; i < 18; i++) {
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
          historicalNotes: "Available for transfer this winter."
        };
        p.value = calculatePlayerValue(p, season);
        p.bidStatus = null;
        generatedTargets.push(p);
      }
    }

    // 2. Generate Sell Offers (prioritizing transfer-listed players with 60% chance + occasional unsolicited bids)
    const currentRoster = getRoster();
    if (currentRoster.length > 15) {
      const otherClubs = teams.filter(t => t.idnum !== playerTeamId).map(t => t.name);
      const offersList = [];

      // A. Offers for Transfer-Listed players (60% chance each)
      const listedPlayers = currentRoster.filter(p => p.transferListed && p.rating > 1);
      listedPlayers.forEach(p => {
        if (Math.random() < 0.60) {
          const val = calculatePlayerValue(p, season);
          const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
          const multiplier = 0.80 + Math.random() * 0.35; // 0.80x to 1.15x value
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

      // B. Unsolicited offers for non-listed players (to keep things dynamic, 1-2 random offers)
      const nonListedPlayers = currentRoster.filter(p => !p.transferListed && p.rating > 1);
      if (nonListedPlayers.length > 0 && offersList.length < 3) {
        const numUnsolicited = Math.min(2, Math.floor(Math.random() * 2) + 1); // 1 or 2
        const shuffledNonListed = [...nonListedPlayers].sort(() => 0.5 - Math.random());
        const selectedNonListed = shuffledNonListed.slice(0, numUnsolicited);
        selectedNonListed.forEach(p => {
          if (Math.random() < 0.35) { // 35% chance to actually get a bid for a non-listed player
            const val = calculatePlayerValue(p, season);
            const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
            const multiplier = 0.90 + Math.random() * 0.35; // unsolicited offers pay slightly more (0.90x to 1.25x value)
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

    // Initialize bids object
    const initialBids = {};
    generatedTargets.forEach((t, index) => {
      initialBids[index] = t.value.toFixed(1);
    });
    setBids(initialBids);

    // Save to state & storage
    const updatedState = {
      ...leagueState,
      lastTransferWindow: windowKey,
      lastTransferUpdateRound: currentRound,
      transferTargets: generatedTargets,
      transferOffers: generatedOffers
    };
    localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
    setLeagueState(updatedState);
    setLoading(false);
  };

  const updateMarketData = async () => {
    setLoading(true);
    let currentTargets = [...(leagueState.transferTargets || [])];
    
    // 1. Update Buy Targets
    // Keep active bids (accepted or rejected)
    const bidTargets = currentTargets.filter(t => t.bidStatus);
    const unbidTargets = currentTargets.filter(t => !t.bidStatus);

    // Randomly remove 2-4 unbid targets (simulating other clubs signing them)
    const numToRemove = Math.min(unbidTargets.length, 2 + Math.floor(Math.random() * 3));
    const shuffledUnbid = [...unbidTargets].sort(() => 0.5 - Math.random());
    const keptUnbid = shuffledUnbid.slice(numToRemove);
    const removedNames = shuffledUnbid.slice(0, numToRemove).map(p => p.name);

    let newTargets = [];
    const numToGenerate = numToRemove;

    if (numToGenerate > 0) {
      try {
        const prompt = `You are a football transfer database assistant.
For the season "${season}" (specifically starting year ${season.split("/")[0]}), generate exactly ${numToGenerate} authentic, real-world football players who were active in that season.
These transfer targets must be realistic and calibrated for a club with:
- Division: ${leagueState.division || 1}
- Average Club Star Rating: ${clubRating}/5 (Attack: ${playerTeamObj?.attack}/5, Midfield: ${playerTeamObj?.midfield}/5, Defense: ${playerTeamObj?.defense}/5)
- Transfer Budget: $${budget.toFixed(1)}M USD

Requirements:
1. Provide exactly ${numToGenerate} players.
2. The players must be real players who transferred or were active in real life in ${season.split("/")[0]}.
3. Provide realistic ratings (1-5) and ages for that season.
4. Scale values so they are realistic for our budget.
5. Do not include players already in our active squad: ${roster.map(p => p.name).join(", ")}.
6. Do not include these recently removed players: ${removedNames.join(", ")}.
7. Return a JSON array. Each object must have:
   - "name": Full name of the player
   - "position": One of: "GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"
   - "positions": Array of 1-3 positions starting with their primary position
   - "rating": Integer between 1 and 5
   - "age": Integer age
   - "currentClub": The club they are transferring from in real life
   - "historicalNotes": A brief 1-sentence note about their real transfer that season`;

        const requestBody = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  position: { type: "STRING" },
                  positions: { type: "ARRAY", items: { type: "STRING" } },
                  rating: { type: "INTEGER" },
                  age: { type: "INTEGER" },
                  currentClub: { type: "STRING" },
                  historicalNotes: { type: "STRING" }
                },
                required: ["name", "position", "positions", "rating", "age", "currentClub", "historicalNotes"]
              }
            }
          }
        };

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": GEMINI_API_KEY
            },
            body: JSON.stringify(requestBody)
          }
        );

        if (response.ok) {
          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text.trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
              newTargets = parsed.map(p => ({
                ...p,
                value: calculatePlayerValue(p, season),
                bidStatus: null
              }));
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch new targets from Gemini, using procedural fallback", e);
      }

      if (newTargets.length === 0) {
        const positionsPool = ["GK", "DL", "DR", "DC", "MC", "MR", "ML", "AMC", "ST", "CF"];
        for (let i = 0; i < numToGenerate; i++) {
          const primaryPos = positionsPool[Math.floor(Math.random() * positionsPool.length)];
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
            historicalNotes: "Scouted and available for transfer this week."
          };
          p.value = calculatePlayerValue(p, season);
          p.bidStatus = null;
          newTargets.push(p);
        }
      }
    }

    const updatedTargets = [...bidTargets, ...keptUnbid, ...newTargets];

    // 2. Update Sell Offers
    let currentOffers = [...(leagueState.transferOffers || [])];
    const numOffersToRemove = Math.min(currentOffers.length, Math.floor(Math.random() * 2) + 1); // 1 or 2
    const shuffledOffers = [...currentOffers].sort(() => 0.5 - Math.random());
    let updatedOffers = shuffledOffers.slice(numOffersToRemove);

    const currentRoster = getRoster();
    if (currentRoster.length > 15) {
      const otherClubs = teams.filter(t => t.idnum !== playerTeamId).map(t => t.name);
      const newOffersList = [];

      // A. Offers for Transfer-Listed players (60% chance each, if they don't already have an active offer)
      const listedPlayers = currentRoster.filter(p => p.transferListed && p.rating > 1 && !updatedOffers.some(o => o.playerName === p.name));
      listedPlayers.forEach(p => {
        if (Math.random() < 0.60) {
          const val = calculatePlayerValue(p, season);
          const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
          const multiplier = 0.80 + Math.random() * 0.35; // 0.80x to 1.15x value
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

      // B. Unsolicited offers for non-listed players (20% chance to get a new unsolicited offer for one random eligible player)
      const nonListedPlayers = currentRoster.filter(p => !p.transferListed && p.rating > 1 && !updatedOffers.some(o => o.playerName === p.name));
      if (nonListedPlayers.length > 0 && Math.random() < 0.25) {
        const p = nonListedPlayers[Math.floor(Math.random() * nonListedPlayers.length)];
        const val = calculatePlayerValue(p, season);
        const buyerClub = otherClubs.length > 0 ? otherClubs[Math.floor(Math.random() * otherClubs.length)] : "FC Europa";
        const multiplier = 0.90 + Math.random() * 0.35; // 0.90x to 1.25x value
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

    const newBids = {};
    updatedTargets.forEach((t, idx) => {
      newBids[idx] = bids[idx] || t.value.toFixed(1);
    });
    setBids(newBids);
    setLoading(false);
  };

  const handleBidChange = (index, value) => {
    setBids(prev => ({
      ...prev,
      [index]: value
    }));
  };

  const handleMakeBid = (index, player) => {
    const bidAmount = parseFloat(bids[index]);
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

    if (success) {
      // 1. Deduct budget
      const newBudget = parseFloat((budget - bidAmount).toFixed(1));

      // 2. Add to squad roster
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

      const currentRoster = getRoster();
      currentRoster.push(squadPlayer);
      localStorage.setItem(rosterKey, JSON.stringify(currentRoster));
      setSquadRoster(currentRoster);

      // Update targets list status
      targetsCopy[index] = { ...player, bidStatus: 'accepted' };

      const updatedState = {
        ...leagueState,
        budget: newBudget,
        transferTargets: targetsCopy
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`🎉 SUCCESS! ${player.name} has signed with our club for a fee of $${bidAmount.toFixed(1)}M!`);
    } else {
      // Failed bid
      targetsCopy[index] = { ...player, bidStatus: 'rejected' };

      const updatedState = {
        ...leagueState,
        transferTargets: targetsCopy
      };
      localStorage.setItem("retro_league_career", JSON.stringify(updatedState));
      setLeagueState(updatedState);
      setMessage(`❌ NEGOTIATIONS FAILED: ${player.name} has rejected our offer.`);
    }
  };

  const handleAcceptOffer = (offer) => {
    const currentRoster = getRoster();
    if (currentRoster.length <= 15) {
      setMessage("❌ Roster size cannot drop below 15 players.");
      return;
    }

    // 1. Remove player from roster
    const updatedRoster = currentRoster.filter(p => p.name !== offer.playerName);
    localStorage.setItem(rosterKey, JSON.stringify(updatedRoster));
    setSquadRoster(updatedRoster);

    // 2. Remove player from lineup if assigned
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
          // Recalculate team stats
          updateTeamStatsInStorage(lineup, localStorage.getItem(`retro_formation_${playerTeamName}_${season}`) || "442");
        }
      } catch (err) {
        console.error("Error updating lineup on sell", err);
      }
    }

    // 3. Add fee to budget
    const newBudget = parseFloat((budget + offer.offerAmount).toFixed(1));

    // 4. Remove offer from state
    const remainingOffers = (leagueState.transferOffers || []).filter(o => o.id !== offer.id);

    // Sync back to leagueState
    // We reload teams stats from storage, so load squad ratings
    const careerRaw = localStorage.getItem("retro_league_career");
    let currentTeams = teams;
    if (careerRaw) {
      try {
        const parsed = JSON.parse(careerRaw);
        currentTeams = parsed.teams;
      } catch {}
    }

    const updatedState = {
      ...leagueState,
      teams: currentTeams,
      budget: newBudget,
      transferOffers: remainingOffers
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

  return (
    <div className={inline ? "inline-transfer-container" : "modal-backdrop"} style={inline ? {
      width: '100%', maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'center'
    } : {
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div className="glass-card animated-scale-in" style={{
        width: '100%', maxWidth: inline ? '1000px' : '900px', maxHeight: inline ? 'none' : '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1.5px solid rgba(255, 69, 0, 0.25)', boxShadow: '0 0 35px rgba(255, 69, 0, 0.15)',
        padding: '0'
      }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px', background: 'rgba(255, 69, 0, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{
              margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#ffea00',
              fontFamily: 'Orbitron', letterSpacing: '1.5px', textTransform: 'uppercase'
            }}>
              🔄 Transfer Market
            </h2>
            <span style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase' }}>
              Season {season} | Round {currentRound} of {totalRounds}
            </span>
          </div>
          {!inline && (
            <button onClick={onClose} style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px', color: '#aaa', padding: '4px 10px',
              fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', fontFamily: 'Orbitron'
            }}>
              CLOSE ➔
            </button>
          )}
        </div>

        {/* Modal Body */}
        {!isWindowOpen ? (
          <div style={{ padding: '40px 30px', textAlign: 'center', color: '#ccc' }}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>🔒</div>
            <h3 style={{ fontFamily: 'Orbitron', color: '#ff4500' }}>TRANSFER WINDOW CLOSED</h3>
            <p style={{ fontSize: '13px', maxWidth: '500px', margin: '15px auto', lineHeight: '1.6' }}>
              The transfer market is currently closed. Transfer windows open during the:
            </p>
            <ul style={{
              display: 'inline-block', textAlign: 'left', fontSize: '12px',
              background: 'rgba(255,255,255,0.02)', padding: '15px 25px 15px 35px',
              borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#aaa'
            }}>
              <li>🚀 **Summer Window**: Rounds 1 to 5</li>
              <li>❄️ **Winter Window**: Midpoint (Rounds {midRoundStart} to {midRoundStart + 4})</li>
            </ul>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '20px' }}>
              Current Round: Round {currentRound}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
            
            {/* Control Bar: Tabs & Budget */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 24px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setActiveTab("buy"); setMessage(""); }}
                  style={{
                    background: activeTab === "buy" ? 'rgba(255, 69, 0, 0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === "buy" ? '#ff4500' : 'rgba(255,255,255,0.1)',
                    color: activeTab === "buy" ? '#fff' : '#aaa',
                    borderRadius: '4px', padding: '6px 16px', fontSize: '11px',
                    fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  📥 BUY PLAYERS
                </button>
                <button
                  onClick={() => { setActiveTab("sell"); setMessage(""); }}
                  style={{
                    background: activeTab === "sell" ? 'rgba(255, 69, 0, 0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: activeTab === "sell" ? '#ff4500' : 'rgba(255,255,255,0.1)',
                    color: activeTab === "sell" ? '#fff' : '#aaa',
                    borderRadius: '4px', padding: '6px 16px', fontSize: '11px',
                    fontFamily: 'Orbitron', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  📤 SELL PLAYERS ({leagueState.transferOffers?.length || 0})
                </button>
              </div>

              {/* Stats & Budget */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center', fontSize: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', color: '#aaa' }}>
                  <span>Club Rating:</span>
                  <span style={{ color: '#00ff64', fontWeight: 'bold' }}>{"⭐".repeat(Math.round(clubRating))} ({clubRating})</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', color: '#aaa' }}>
                  <span>Manager Rating:</span>
                  <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{"⭐".repeat(Math.round(managerRating))} ({managerRating})</span>
                </div>
                <div style={{
                  background: 'rgba(255, 234, 0, 0.05)', border: '1px solid rgba(255, 234, 0, 0.25)',
                  borderRadius: '6px', padding: '4px 12px', display: 'flex', gap: '8px', alignItems: 'center'
                }}>
                  <span style={{ color: '#888', fontSize: '10px', textTransform: 'uppercase' }}>Budget:</span>
                  <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '14px' }}>
                    ${budget.toFixed(1)}M
                  </span>
                </div>
              </div>
            </div>

            {/* Notification/Console Area */}
            {message && (
              <div style={{
                background: message.startsWith("❌") ? 'rgba(255,51,81,0.08)' : (message.startsWith("💵") || message.startsWith("🎉") ? 'rgba(0,255,100,0.08)' : 'rgba(255,255,255,0.03)'),
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                padding: '10px 24px', fontSize: '11.5px', color: '#fff', textAlign: 'left', fontWeight: 'bold'
              }}>
                💬 {message}
              </div>
            )}

            {/* Active Tab Contents */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '20px 24px' }}>
              
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
                /* BUY PLAYERS TAB */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(leagueState.transferTargets || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '13px' }}>
                      No transfer targets available in this window.
                    </div>
                  ) : (
                    leagueState.transferTargets.map((player, index) => {
                      const bidValue = bids[index] || player.value.toFixed(1);
                      const numericBid = parseFloat(bidValue) || 0;
                      const prob = getTransferSuccessProbability(player, numericBid, clubRating, managerRating, season);

                      return (
                        <div key={index} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1.5px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px', padding: '14px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px',
                          opacity: player.bidStatus ? 0.6 : 1
                        }}>
                          {/* Player Identity */}
                          <div style={{ flexGrow: 1, textAlign: 'left', minWidth: '200px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>{player.name}</span>
                              <span style={{
                                fontSize: '9px', background: 'rgba(255,255,255,0.08)',
                                padding: '1px 5px', borderRadius: '3px', color: '#ffd700', fontWeight: 'bold'
                              }}>
                                {player.position}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                              Age: {player.age} | Current Club: <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>{player.currentClub}</span>
                            </div>
                            <div style={{
                              fontSize: '10px', color: '#888', fontStyle: 'italic', marginTop: '4px',
                              background: 'rgba(255,255,255,0.01)', padding: '4px 8px', borderRadius: '4px',
                              borderLeft: '2px solid rgba(255, 69, 0, 0.3)'
                            }}>
                              📋 {player.historicalNotes}
                            </div>
                          </div>

                          {/* Player Rating & Value */}
                          <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Rating</span>
                            <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '12px' }}>
                              {"⭐".repeat(player.rating)}
                            </span>
                            <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginTop: '4px' }}>Estimated Value</span>
                            <span style={{ color: '#ffea00', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '13px' }}>
                              ${player.value.toFixed(1)}M
                            </span>
                          </div>

                          {/* Bidding Control Panel */}
                          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                            {player.bidStatus === 'accepted' ? (
                              <span style={{
                                padding: '6px 12px', background: 'rgba(0, 255, 100, 0.1)',
                                border: '1px solid rgba(0, 255, 100, 0.3)', color: '#00ff64',
                                borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Orbitron'
                              }}>
                                🤝 BOUGHT
                              </span>
                            ) : player.bidStatus === 'rejected' ? (
                              <span style={{
                                padding: '6px 12px', background: 'rgba(255, 51, 81, 0.1)',
                                border: '1px solid rgba(255, 51, 81, 0.3)', color: '#ff3333',
                                borderRadius: '4px', fontWeight: 'bold', fontSize: '11px', fontFamily: 'Orbitron'
                              }}>
                                ❌ REJECTED
                              </span>
                            ) : (
                              <>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: '#aaa' }}>Offer:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px 4px' }}>
                                    <span style={{ color: '#888', fontSize: '11px', marginRight: '2px' }}>$</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={bidValue}
                                      onChange={(e) => handleBidChange(index, e.target.value)}
                                      style={{
                                        background: 'transparent', border: 'none', outline: 'none',
                                        color: '#fff', fontSize: '12px', fontWeight: 'bold', width: '50px',
                                        textAlign: 'center', fontFamily: 'Orbitron'
                                      }}
                                    />
                                    <span style={{ color: '#888', fontSize: '11px', marginLeft: '2px' }}>M</span>
                                  </div>
                                </div>

                                {/* Dynamic Probability Display */}
                                <div style={{ fontSize: '10.5px', marginTop: '2px', textAlign: 'right' }}>
                                  {prob === -1 ? (
                                    <span style={{ color: '#ff3333', fontWeight: 'bold' }}>Player Refuses to Join</span>
                                  ) : prob === 0 ? (
                                    <span style={{ color: '#ff3333' }}>Offer Too Low</span>
                                  ) : (
                                    <span style={{ color: '#aaa' }}>
                                      Success Chance: <strong style={{ color: prob >= 70 ? '#00ff64' : (prob >= 40 ? '#ffa500' : '#ff3333') }}>{prob}%</strong>
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleMakeBid(index, player)}
                                  disabled={prob === -1 || numericBid <= 0 || numericBid > budget}
                                  className="play-match-btn glowing-btn"
                                  style={{
                                    fontSize: '10px', padding: '6px 12px', width: '100%',
                                    borderColor: (prob === -1 || numericBid <= 0 || numericBid > budget) ? 'rgba(255,255,255,0.1)' : '#ff4500',
                                    color: (prob === -1 || numericBid <= 0 || numericBid > budget) ? '#555' : '#fff',
                                    background: (prob === -1 || numericBid <= 0 || numericBid > budget) ? 'transparent' : 'rgba(255, 69, 0, 0.1)',
                                    cursor: (prob === -1 || numericBid <= 0 || numericBid > budget) ? 'not-allowed' : 'pointer',
                                    marginTop: '2px'
                                  }}
                                >
                                  Submit Bid ➔
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* SELL PLAYERS TAB */
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
                      📥 Incoming Offers ({ (leagueState.transferOffers || []).length })
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
        )}

      </div>
      
      {/* Dynamic keyframe animation style block */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
