import React from 'react';
import { getFormationModifier } from './FormationTactics';

// Pure function to get tactical stat modifiers and pressing fatigue penalties
export const getModifiedStat = (baseValue, statType, tactic, counter, pressing, oppPressing, pressingDuration, formation, stamina) => {
  let mod = 0;

  // Formation modifiers (e.g., 4-3-3: +1 ATT, -1 MID)
  if (formation) {
    mod += getFormationModifier(formation, statType);
  }

  // Base mentality modifiers
  if (tactic === "ultra_defense") {
    if (statType === "attack") mod -= 3;
    if (statType === "defense") mod += 4;
  } else if (tactic === "defense") {
    if (statType === "attack") mod -= 2;
    if (statType === "defense") mod += 2;
  } else if (tactic === "attack") {
    if (statType === "attack") mod += 2;
    if (statType === "defense") mod -= 2;
  } else if (tactic === "ultra_attack") {
    if (statType === "attack") mod += 4;
    if (statType === "midfield") mod -= 1;
    if (statType === "defense") mod -= 3;
  }

  // Counter-attack modifier (+2 Att, -2 Mid)
  if (counter) {
    if (statType === "attack") {
      mod += oppPressing ? 3 : 2;
    }
    if (statType === "midfield") mod -= 2;
  }

  // Pressing modifier (+1 Mid, -2 Def)
  if (pressing) {
    if (statType === "midfield") mod += 1;
    if (statType === "defense") mod -= 2;
  }

  // Pressing fatigue penalty (Energy)
  let fatiguePenalty = 0;
  if (pressingDuration >= 25) {
    fatiguePenalty = -2;
  } else if (pressingDuration >= 15) {
    fatiguePenalty = -1;
  }

  // Stamina fatigue penalties
  let staminaMod = 0;
  if (stamina !== undefined) {
    if (stamina <= 0) {
      staminaMod = -3;
    } else if (stamina < 10) {
      staminaMod = -2;
    } else if (stamina < 20) {
      staminaMod = -1;
    }
  }

  return Math.max(1, baseValue + mod + fatiguePenalty + staminaMod);
};

// Pure function for AI tactical decision-making overrides
export const adjustCPUTactic = ({
  team,
  opp,
  scoreSelf,
  scoreOpp,
  isLeg2,
  leg1HomeScore,
  leg1AwayScore,
  currentMatchTime,
  isHomeSide,
  opponentTactic,
  opponentCounter,
  opponentPressing,
  pressingDuration,
  setTactic,
  setCounter,
  setPressing,
  stamina
}) => {
  if (!team || !opp) return;

  const teamStrength = team.attack + team.midfield + team.defense;
  const oppStrength = opp.attack + opp.midfield + opp.defense;
  const diff = teamStrength - oppStrength;
  const goalDiff = scoreSelf - scoreOpp;

  // Calculate Leg 1 score difference if this is Leg 2 of a European tie
  let leg1Diff = 0;
  if (isLeg2) {
    if (isHomeSide) {
      leg1Diff = leg1AwayScore - leg1HomeScore;
    } else {
      leg1Diff = leg1HomeScore - leg1AwayScore;
    }
  }
  const aggGoalDiff = goalDiff + leg1Diff;
  const effectiveGoalDiff = isLeg2 ? aggGoalDiff : goalDiff;

  let tactic = "balanced";
  let counter = false;
  let pressing = false;

  // Underdog Stance
  if (diff <= -5) {
    if (effectiveGoalDiff < 0) {
      if (currentMatchTime >= 70) {
        tactic = "balanced";
        counter = false;
      } else {
        tactic = "defense";
        counter = true;
      }
    } else {
      tactic = "ultra_defense";
      counter = false;
    }
  } else if (diff <= -3) {
    if (effectiveGoalDiff < 0) {
      tactic = "defense";
      counter = true;
    } else {
      tactic = "defense";
      counter = false;
    }
  } else if (diff >= 3 && currentMatchTime === 0) {
    tactic = "attack";
    counter = false;
  } else if (diff >= 5 && scoreSelf === 0 && scoreOpp === 0 && currentMatchTime >= 60) {
    tactic = "ultra_attack";
    counter = false;
  } else {
    // Standard match situations
    if (effectiveGoalDiff < 0) {
      const absDiff = Math.abs(effectiveGoalDiff);
      if (absDiff >= 2 || currentMatchTime >= 70) {
        tactic = diff >= -1 ? "ultra_attack" : "attack";
      } else {
        tactic = "attack";
      }
      counter = false;
    } else if (effectiveGoalDiff > 0) {
      if (currentMatchTime >= 70) {
        tactic = diff <= 1 ? "ultra_defense" : "defense";
        counter = true;
      } else if (currentMatchTime >= 50) {
        tactic = "defense";
        counter = true;
      } else {
        tactic = "balanced";
        counter = false;
      }
    } else {
      if (diff >= 3) {
        tactic = currentMatchTime >= 65 ? "ultra_attack" : "attack";
        counter = false;
      } else if (diff >= 1) {
        tactic = isHomeSide ? "attack" : "balanced";
        counter = false;
      } else if (diff <= -1) {
        tactic = isHomeSide ? "balanced" : "defense";
        counter = true;
      } else {
        tactic = "balanced";
        counter = !isHomeSide;
      }
    }
  }

  // Pressing rules
  if (effectiveGoalDiff < 0 && (diff > -5 || currentMatchTime >= 70)) {
    pressing = true;
  }
  if (diff >= 3) {
    pressing = true;
  }
  if (effectiveGoalDiff === 0 && diff === 0 && isHomeSide && diff > -5) {
    pressing = true;
  }

  // Reactive rules
  if (opponentTactic === "ultra_attack") {
    counter = true;
  }
  if (opponentTactic === "defense" && !opponentCounter && effectiveGoalDiff >= 0 && currentMatchTime < 70 && diff > -5) {
    pressing = true;
  }
  if (opponentPressing) {
    counter = true;
  }

  // TACTICAL OVERRIDES
  if (diff > -3) {
    if (effectiveGoalDiff >= 4) {
      tactic = "defense";
      pressing = false;
    }

    if (goalDiff <= -3) {
      if (tactic === "balanced") {
        tactic = "defense";
      } else if (tactic === "defense") {
        tactic = "ultra_defense";
      } else if (tactic === "attack" || tactic === "ultra_attack") {
        tactic = "defense";
      }
      pressing = false;
    }

    if (currentMatchTime >= 75 && effectiveGoalDiff === 1) {
      tactic = "ultra_defense";
      counter = true;
      pressing = false;
    }

    if (currentMatchTime >= 75 && effectiveGoalDiff < 0) {
      tactic = "ultra_attack";
      pressing = true;
      counter = false;
    }
  }

  if (pressingDuration >= 10) {
    pressing = false;
  }

  // If exhausted, stop pressing to preserve energy
  if (stamina !== undefined && stamina < 30) {
    pressing = false;
  }

  // Enforce tactical constraints for AI
  if (tactic === "balanced") {
    counter = false;
    pressing = false;
  } else if (tactic === "defense" || tactic === "ultra_defense") {
    pressing = false;
  } else if (tactic === "attack" || tactic === "ultra_attack") {
    counter = false;
  }

  setTactic(tactic);
  setCounter(counter);
  setPressing(pressing);
};

// Reusable UI Tactics Panel Component
export const TacticsPanel = ({
  disabled,
  counter,
  setCounter,
  pressing,
  setPressing,
  tactic,
  setTactic,
  mentalityCooldown = 0
}) => {
  const isMentalityDisabled = disabled || mentalityCooldown > 0;

  const handleMentalityChange = (newTactic) => {
    if (isMentalityDisabled) return;
    setTactic(newTactic);

    if (newTactic === "balanced") {
      setCounter(false);
      setPressing(false);
    } else if (newTactic === "defense" || newTactic === "ultra_defense") {
      setPressing(false);
    } else if (newTactic === "attack" || newTactic === "ultra_attack") {
      setCounter(false);
    }
  };

  const isCounterDisabled = disabled || (tactic !== "defense" && tactic !== "ultra_defense");
  const isPressingDisabled = disabled || (tactic !== "attack" && tactic !== "ultra_attack");

  return (
    <div className="tactical-panel" style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', width: '100%' }}>
      <span className="roll-label" style={{ fontSize: '10px', marginBottom: '8px', display: 'block' }}>
        TEAM TACTICS {mentalityCooldown > 0 && <span style={{ color: '#ffd700', marginLeft: '5px', textShadow: '0 0 5px rgba(255, 215, 0, 0.3)' }}>(Locked: {mentalityCooldown}m)</span>}
      </span>

      {/* Toggles Row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
        <button
          disabled={isCounterDisabled}
          onClick={() => setCounter(prev => !prev)}
          style={{
            background: counter ? '#ffc107' : 'rgba(255,255,255,0.05)',
            border: counter ? '1.5px solid #ffca2c' : '1px solid rgba(255,255,255,0.1)',
            color: counter ? '#111' : '#aaa',
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '8px',
            cursor: isCounterDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            opacity: isCounterDisabled ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Counter-Attack: +2 Attack, -2 Midfield (Requires Defensive/Ultra-Defensive mentality)"
        >
          ⚡ Counter: {counter ? "ON" : "OFF"}
        </button>
        <button
          disabled={isPressingDisabled}
          onClick={() => setPressing(prev => !prev)}
          style={{
            background: pressing ? '#ff3b30' : 'rgba(255,255,255,0.05)',
            border: pressing ? '1.5px solid #ff453a' : '1px solid rgba(255,255,255,0.1)',
            color: pressing ? '#fff' : '#aaa',
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '8px',
            cursor: isPressingDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s ease',
            opacity: isPressingDisabled ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title="Pressing: +1 Midfield, -2 Defense (Requires Attacking/Ultra-Attacking mentality)"
        >
          🛑 Pressing: {pressing ? "ON" : "OFF"}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', width: '100%' }}>
        <button
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange("ultra_defense")}
          style={{
            background: tactic === "ultra_defense" ? '#8b0000' : 'rgba(255,255,255,0.05)',
            border: tactic === "ultra_defense" ? '1.5px solid #ff3333' : '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '3px 1px',
            borderRadius: '5px',
            fontSize: '7px',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled ? 0.4 : 1
          }}
          title="Park the Bus: -3 Att, +4 Def"
        >
          🛡️ U-DF
        </button>
        <button
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange("defense")}
          style={{
            background: tactic === "defense" ? '#ff4500' : 'rgba(255,255,255,0.05)',
            border: tactic === "defense" ? '1.5px solid #ff4500' : '1px solid rgba(255,255,255,0.1)',
            color: tactic === "defense" ? '#fff' : '#aaa',
            padding: '3px 1px',
            borderRadius: '5px',
            fontSize: '7px',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled ? 0.4 : 1
          }}
          title="Defensive: -2 Att, +2 Def"
        >
          🚌 DEF
        </button>
        <button
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange("balanced")}
          style={{
            background: tactic === "balanced" ? '#007bff' : 'rgba(255,255,255,0.05)',
            border: tactic === "balanced" ? '1.5px solid #007bff' : '1px solid rgba(255,255,255,0.1)',
            color: tactic === "balanced" ? '#fff' : '#aaa',
            padding: '3px 1px',
            borderRadius: '5px',
            fontSize: '7px',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled ? 0.4 : 1
          }}
          title="Balanced: No changes"
        >
          ⚖️ BAL
        </button>
        <button
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange("attack")}
          style={{
            background: tactic === "attack" ? '#00ff64' : 'rgba(255,255,255,0.05)',
            border: tactic === "attack" ? '1.5px solid #00ff64' : '1px solid rgba(255,255,255,0.1)',
            color: tactic === "attack" ? '#111' : '#aaa',
            padding: '3px 1px',
            borderRadius: '5px',
            fontSize: '7px',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled ? 0.4 : 1
          }}
          title="Attacking: +2 Att, -2 Def"
        >
          🔥 ATT
        </button>
        <button
          disabled={isMentalityDisabled}
          onClick={() => handleMentalityChange("ultra_attack")}
          style={{
            background: tactic === "ultra_attack" ? '#b30000' : 'rgba(255,255,255,0.05)',
            border: tactic === "ultra_attack" ? '1.5px solid #ff0055' : '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            padding: '3px 1px',
            borderRadius: '5px',
            fontSize: '7px',
            cursor: isMentalityDisabled ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            flex: 1,
            transition: 'all 0.2s ease',
            opacity: isMentalityDisabled ? 0.4 : 1
          }}
          title="All-Out Attack: +4 Att, -1 Mid, -3 Def"
        >
          🌋 U-AT
        </button>
      </div>
    </div>
  );
};
