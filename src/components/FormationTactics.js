import React, { useState, useEffect } from 'react';
import { getSubstituteLimit } from '../utils/matchRules';
import { getPrebuiltRoster } from '../data/rosters/rosterRegistry';
import {
  calculateTeamTacticalStats,
  getRoleMetadata,
  getNextRoleForSlot
} from '../utils/tacticalRoleEngine';

// Formation definitions with pitch positions (department bonuses now come from player positions & tactical roles)
export const FORMATIONS = {
  '4-4-2': {
    label: '4-4-2',
    era: '1970s – Present',
    desc: 'Standard balanced formation',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 15, y: 50 }, { x: 38, y: 53 }, { x: 62, y: 53 }, { x: 85, y: 50 }],
      att: [{ x: 35, y: 25 }, { x: 65, y: 25 }]
    }
  },
  '4-3-3': {
    label: '4-3-3',
    era: '1970s – Present',
    desc: 'Attacking width with 3 forwards',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 30, y: 52 }, { x: 50, y: 48 }, { x: 70, y: 52 }],
      att: [{ x: 20, y: 22 }, { x: 50, y: 18 }, { x: 80, y: 22 }]
    }
  },
  '4-5-1': {
    label: '4-5-1',
    era: '1990s – 2010s',
    desc: 'Midfield dominance with lone striker',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 12, y: 50 }, { x: 32, y: 48 }, { x: 50, y: 45 }, { x: 68, y: 48 }, { x: 88, y: 50 }],
      att: [{ x: 50, y: 20 }]
    }
  },
  '5-3-2': {
    label: '5-3-2',
    era: '1980s – 1990s',
    desc: 'Defensive solidity with wing-backs',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 10, y: 72 }, { x: 30, y: 78 }, { x: 50, y: 80 }, { x: 70, y: 78 }, { x: 90, y: 72 }],
      mid: [{ x: 30, y: 52 }, { x: 50, y: 48 }, { x: 70, y: 52 }],
      att: [{ x: 35, y: 24 }, { x: 65, y: 24 }]
    }
  },
  '5-4-1': {
    label: '5-4-1',
    era: '2000s – Present',
    desc: 'Ultra-defensive with packed backline',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 10, y: 72 }, { x: 30, y: 78 }, { x: 50, y: 80 }, { x: 70, y: 78 }, { x: 90, y: 72 }],
      mid: [{ x: 15, y: 50 }, { x: 38, y: 48 }, { x: 62, y: 48 }, { x: 85, y: 50 }],
      att: [{ x: 50, y: 20 }]
    }
  },
  '3-5-2': {
    label: '3-5-2',
    era: '1986 – 2000s',
    desc: 'Midfield overload with two strikers',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 25, y: 78 }, { x: 50, y: 80 }, { x: 75, y: 78 }],
      mid: [{ x: 10, y: 50 }, { x: 32, y: 48 }, { x: 50, y: 44 }, { x: 68, y: 48 }, { x: 90, y: 50 }],
      att: [{ x: 35, y: 22 }, { x: 65, y: 22 }]
    }
  },
  '3-4-3': {
    label: '3-4-3',
    era: '1990s – Present',
    desc: 'All-out attack with three in back',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 25, y: 78 }, { x: 50, y: 80 }, { x: 75, y: 78 }],
      mid: [{ x: 20, y: 50 }, { x: 42, y: 48 }, { x: 58, y: 48 }, { x: 80, y: 50 }],
      att: [{ x: 20, y: 20 }, { x: 50, y: 16 }, { x: 80, y: 20 }]
    }
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    era: '2000s – Present',
    desc: 'Modern tactical with double pivot',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 38, y: 58 }, { x: 62, y: 58 }, { x: 20, y: 40 }, { x: 50, y: 38 }, { x: 80, y: 40 }],
      att: [{ x: 50, y: 18 }]
    }
  },
  '4-1-4-1': {
    label: '4-1-4-1',
    era: '2010s – Present',
    desc: 'Midfield control with single defensive pivot',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 50, y: 64 }, { x: 15, y: 48 }, { x: 38, y: 44 }, { x: 62, y: 44 }, { x: 85, y: 48 }],
      att: [{ x: 50, y: 20 }]
    }
  },
  '4-3-2-1': {
    label: '4-3-2-1',
    era: '2000s',
    desc: 'Christmas Tree layout with dense midfield',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 25, y: 58 }, { x: 50, y: 60 }, { x: 75, y: 58 }, { x: 35, y: 38 }, { x: 65, y: 38 }],
      att: [{ x: 50, y: 18 }]
    }
  },
  '4-1-2-1-2': {
    label: '4-1-2-1-2',
    era: '1990s – 2000s',
    desc: 'Diamond midfield with central playmaker',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 50, y: 64 }, { x: 30, y: 50 }, { x: 70, y: 50 }, { x: 50, y: 36 }],
      att: [{ x: 35, y: 20 }, { x: 65, y: 20 }]
    }
  },
  '4-4-2 Diamond': {
    label: '4-4-2 Diamond',
    era: '1990s – 2000s',
    desc: 'Wide diamond midfield with wingers near touchlines',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 50, y: 64 }, { x: 15, y: 50 }, { x: 85, y: 50 }, { x: 50, y: 36 }],
      att: [{ x: 35, y: 25 }, { x: 65, y: 25 }]
    }
  },
  '3-3-1-3': {
    label: '3-3-1-3',
    era: '1990s – 2000s',
    desc: 'Bielsa vertical high pressing system',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 25, y: 78 }, { x: 50, y: 80 }, { x: 75, y: 78 }],
      mid: [{ x: 50, y: 62 }, { x: 20, y: 54 }, { x: 80, y: 54 }, { x: 50, y: 38 }],
      att: [{ x: 20, y: 22 }, { x: 50, y: 16 }, { x: 80, y: 22 }]
    }
  },
  '3-4-1-2': {
    label: '3-4-1-2',
    era: '1990s – 2000s',
    desc: '3 center backs with wing-backs, dual CMs, trequartista and twin strikers',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 25, y: 78 }, { x: 50, y: 80 }, { x: 75, y: 78 }],
      mid: [{ x: 12, y: 52 }, { x: 38, y: 54 }, { x: 62, y: 54 }, { x: 88, y: 52 }, { x: 50, y: 38 }],
      att: [{ x: 35, y: 20 }, { x: 65, y: 20 }]
    }
  },
  '3-4-2-1': {
    label: '3-4-2-1',
    era: '2010s – Present',
    desc: 'Three-man backline with wide wing-backs, double pivot, dual inside 10s and lone striker',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 25, y: 78 }, { x: 50, y: 80 }, { x: 75, y: 78 }],
      mid: [{ x: 12, y: 52 }, { x: 38, y: 58 }, { x: 62, y: 58 }, { x: 88, y: 52 }, { x: 35, y: 38 }, { x: 65, y: 38 }],
      att: [{ x: 50, y: 18 }]
    }
  },
  '4-1-3-2': {
    label: '4-1-3-2',
    era: 'Late 1990s – Mid 2000s',
    desc: 'Defensive anchor pivot shielding a narrow central trio of 3 midfielders and twin strikers',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 50, y: 64 }, { x: 30, y: 48 }, { x: 50, y: 48 }, { x: 70, y: 48 }],
      att: [{ x: 35, y: 20 }, { x: 65, y: 20 }]
    }
  },
  '4-3-1-2': {
    label: '4-3-1-2',
    era: '2000s – 2010s',
    desc: 'Narrow diamond with deep playmaker, two shuttlers, pure number 10 and two strikers',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 32, y: 53 }, { x: 50, y: 60 }, { x: 68, y: 53 }, { x: 50, y: 38 }],
      att: [{ x: 35, y: 20 }, { x: 65, y: 20 }]
    }
  },
  '4-2-2-2': {
    label: '4-2-2-2',
    era: '1980s – 2000s',
    desc: 'Quadrado Mágico: twin defensive pivots behind two creative playmakers and strike pair',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 38, y: 60 }, { x: 62, y: 60 }, { x: 22, y: 40 }, { x: 78, y: 40 }],
      att: [{ x: 35, y: 20 }, { x: 65, y: 20 }]
    }
  },
  '5-2-1-2': {
    label: '5-2-1-2',
    era: '1990s & 2014',
    desc: 'Five-man defense with wing-backs, compact double midfield, attacking playmaker and counter duo',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 10, y: 72 }, { x: 30, y: 78 }, { x: 50, y: 80 }, { x: 70, y: 78 }, { x: 90, y: 72 }],
      mid: [{ x: 38, y: 54 }, { x: 62, y: 54 }, { x: 50, y: 38 }],
      att: [{ x: 35, y: 20 }, { x: 65, y: 20 }]
    }
  },
  '4-2-4': {
    label: '4-2-4',
    era: '1950s – 1970s',
    desc: 'Legendary vintage Brazilian shape with four high forwards and two workhorse midfielders',
    modifiers: { attack: 0, midfield: 0, defense: 0 },
    positions: {
      gk: [{ x: 50, y: 92 }],
      def: [{ x: 15, y: 75 }, { x: 38, y: 78 }, { x: 62, y: 78 }, { x: 85, y: 75 }],
      mid: [{ x: 38, y: 52 }, { x: 62, y: 52 }],
      att: [{ x: 15, y: 22 }, { x: 38, y: 18 }, { x: 62, y: 18 }, { x: 85, y: 22 }]
    }
  }
};

// Pure function to get formation stat modifier
export const getFormationModifier = (formation, statType) => {
  const f = FORMATIONS[formation];
  if (!f) return 0;
  return f.modifiers[statType] || 0;
};

// Get saved formation from localStorage
export const getSavedFormation = () => {
  const saved = localStorage.getItem('retro_player_formation');
  return saved || '4-4-2';
};

// Determine formation for CPU opponents based on team statistics, opponent statistics, and season year
export const getCPUFormation = (team, opp, year) => {
  if (!team || !opp) return '4-4-2';

  const teamStrength = (team.attack || 3) + (team.midfield || 3) + (team.defense || 3);
  const oppStrength = (opp.attack || 3) + (opp.midfield || 3) + (opp.defense || 3);
  const diff = teamStrength - oppStrength;

  const attack = team.attack || 3;
  const midfield = team.midfield || 3;
  const defense = team.defense || 3;
  const oppMidfield = opp.midfield || 3;
  const teamSeed = team.name ? (team.name.charCodeAt(0) + (team.name.length || 0)) : 0;

  // Vintage Pre-1980s Era
  if (year < 1980) {
    if (diff >= 3 && attack >= midfield) {
      return teamSeed % 2 === 0 ? '4-2-4' : '4-3-3';
    }
    if (diff <= -3) {
      return '5-3-2';
    }
    return teamSeed % 3 === 0 ? '4-3-3' : '4-4-2';
  }

  // 1980s Era (1980 to 1989)
  if (year >= 1980 && year < 1990) {
    if (diff <= -3) {
      return teamSeed % 2 === 0 ? '5-3-2' : '4-4-2';
    }
    if (diff >= 3) {
      if (attack > midfield) {
        return '4-3-3';
      }
      return teamSeed % 2 === 0 ? '3-5-2' : '4-2-2-2';
    }
    if (oppMidfield > midfield) {
      return '3-5-2';
    }
    return teamSeed % 2 === 0 ? '4-4-2' : '4-2-2-2';
  }

  // 1990s Era (1990 up to year 2000)
  if (year >= 1990 && year < 2000) {
    if (diff <= -3) {
      return teamSeed % 2 === 0 ? '5-3-2' : '5-2-1-2'; // defensive counter-attack
    }
    if (diff >= 3) {
      if (attack > midfield) {
        return teamSeed % 2 === 0 ? '3-4-1-2' : '4-3-3'; // attacking width or trequartista
      } else {
        return teamSeed % 2 === 0 ? '3-5-2' : '4-1-2-1-2'; // midfield control
      }
    }
    // Balanced teams
    if (oppMidfield > midfield) {
      return teamSeed % 2 === 0 ? '3-5-2' : '4-1-3-2'; // match opponent midfield
    }
    if (teamSeed % 3 === 0) {
      return '3-4-1-2';
    } else if (teamSeed % 3 === 1) {
      return '4-4-2 Diamond';
    }
    return '4-4-2'; // balanced classic
  }

  // 2000s Era (2000 to 2015)
  if (year >= 2000 && year < 2015) {
    if (diff <= -3) {
      return teamSeed % 2 === 0 ? '5-4-1' : '4-5-1'; // defensive soak & counter
    }
    if (diff >= 3) {
      if (attack > midfield) {
        if (attack > defense) {
          return '3-3-1-3'; // Bielsa vertical high pressing system
        }
        return teamSeed % 2 === 0 ? '4-3-1-2' : '4-3-3'; // Ancelotti Milan diamond or 4-3-3
      } else {
        if (midfield > defense) {
          return teamSeed % 2 === 0 ? '4-3-1-2' : '4-1-2-1-2'; // Milan or Boca diamond
        }
        return teamSeed % 2 === 0 ? '4-2-3-1' : '4-3-2-1'; // double pivot or Christmas tree
      }
    }
    // Balanced teams
    if (midfield > attack && midfield > defense) {
      if (attack >= defense) {
        return teamSeed % 2 === 0 ? '4-3-1-2' : '4-1-2-1-2';
      }
      return teamSeed % 2 === 0 ? '4-2-2-2' : '4-1-3-2';
    }
    if (oppMidfield > midfield) {
      return teamSeed % 2 === 0 ? '4-2-3-1' : '4-5-1';
    }
    if (teamSeed % 3 === 0) {
      return '4-2-3-1';
    } else if (teamSeed % 3 === 1) {
      return '4-2-2-2';
    }
    return '4-4-2';
  }

  // 2010s & 2020s Era (2015 onwards)
  if (diff <= -3) {
    return teamSeed % 2 === 0 ? '5-4-1' : '5-3-2'; // low-block counter
  }
  if (diff >= 3) {
    if (attack > midfield) {
      return teamSeed % 2 === 0 ? '3-4-2-1' : '4-3-3'; // fluid Conte/Tuchel/Alonso 3-back or modern 4-3-3
    }
    if (defense < midfield) {
      return teamSeed % 2 === 0 ? '3-4-2-1' : '3-5-2';
    }
    return teamSeed % 2 === 0 ? '4-2-3-1' : '4-1-4-1';
  }
  // Balanced teams
  if (attack > midfield) {
    return teamSeed % 2 === 0 ? '4-3-3' : '3-4-2-1';
  }
  if (teamSeed % 3 === 0) {
    return '3-4-2-1';
  } else if (teamSeed % 3 === 1) {
    return '4-1-4-1';
  }
  return '4-2-3-1';
};

// Mini pitch visualization component for formation display
export const FormationPitch = ({ formation, isSelected, size = 'normal' }) => {
  const f = FORMATIONS[formation];
  if (!f) return null;

  const pitchWidth = size === 'small' ? 100 : 160;
  const pitchHeight = size === 'small' ? 130 : 200;
  const dotSize = size === 'small' ? 4 : 6;
  const gkSize = size === 'small' ? 5 : 7;

  const roleColors = {
    gk: '#ffd700',
    def: '#00e5ff',
    mid: '#00ff64',
    att: '#ff4500'
  };

  return (
    <svg width={pitchWidth} height={pitchHeight} viewBox="0 0 100 100" style={{
      borderRadius: '8px',
      overflow: 'hidden',
      border: isSelected ? '2px solid #00ff64' : '1.5px solid rgba(255,255,255,0.1)',
      boxShadow: isSelected ? '0 0 15px rgba(0, 255, 100, 0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease'
    }}>
      {/* Pitch background */}
      <rect width="100" height="100" fill="#0a4a1a" />

      {/* Field lines */}
      <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" />
      <circle cx="50" cy="50" r="1" fill="rgba(255,255,255,0.15)" />

      {/* Penalty areas */}
      <rect x="25" y="2" width="50" height="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" rx="1" />
      <rect x="25" y="84" width="50" height="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" rx="1" />

      {/* Goal areas */}
      <rect x="35" y="2" width="30" height="6" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" rx="1" />
      <rect x="35" y="92" width="30" height="6" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" rx="1" />

      {/* Player positions */}
      {Object.entries(f.positions).map(([role, positions]) =>
        positions.map((pos, idx) => (
          <g key={`${role}-${idx}`}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={role === 'gk' ? gkSize : dotSize}
              fill={roleColors[role]}
              opacity={0.9}
              style={{
                filter: `drop-shadow(0 0 3px ${roleColors[role]})`
              }}
            />
            {size !== 'small' && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={role === 'gk' ? gkSize + 2 : dotSize + 1.5}
                fill="none"
                stroke={roleColors[role]}
                strokeWidth="0.3"
                opacity={0.4}
              />
            )}
          </g>
        ))
      )}
    </svg>
  );
};

// Name database for countries in the game (Offline Fallback)
const nameDatabase = {
  england: {
    first: ["David", "John", "Paul", "Gary", "Mark", "Alan", "Lee", "Ian", "Steve", "Peter", "Robbie", "Jamie", "Roy", "Teddy", "Tony", "Nigel", "Sol", "Rio", "Frank", "Steven", "Wayne", "Michael", "Ashley"],
    last: ["Seaman", "Adams", "Campbell", "Ferdinand", "Neville", "Cole", "Beckham", "Scholes", "Gerrard", "Lampard", "Shearer", "Sheringham", "Wright", "Fowler", "Owen", "Rooney", "Terry", "Ince", "Keown"]
  },
  germany: {
    first: ["Oliver", "Stefan", "Andreas", "Matthias", "Christian", "Thomas", "Michael", "Jens", "Bastian", "Philipp", "Miroslav", "Jurgen", "Mario", "Lothar", "Dietmar", "Mehmet", "Rudi", "Karl"],
    last: ["Kahn", "Effenberg", "Möller", "Sammer", "Ziege", "Babbel", "Lehmann", "Schweinsteiger", "Lahm", "Klose", "Klinsmann", "Basler", "Matthäus", "Hamann", "Scholl", "Völler", "Bierhoff"]
  },
  spain: {
    first: ["Iker", "Carles", "Fernando", "Raul", "Josep", "Luis", "Jose", "Míchel", "Andres", "Xavi", "Cesc", "Sergio", "David", "Santiago", "Emilio", "Gaizka", "Joseba"],
    last: ["Casillas", "Puyol", "Hierro", "Morientes", "Gonzalez", "Guardiola", "Enrique", "Bakero", "Iniesta", "Hernandez", "Fabregas", "Ramos", "Villa", "Cañizares", "Butragueño", "Mendieta", "Etxeberria"]
  },
  italy: {
    first: ["Gianluigi", "Paolo", "Alessandro", "Francesco", "Roberto", "Christian", "Filippo", "Fabio", "Gianluca", "Franco", "Giuseppe", "Demetrio", "Dino", "Andrea", "Mario"],
    last: ["Buffon", "Maldini", "Del Piero", "Totti", "Baggio", "Vieri", "Inzaghi", "Cannavaro", "Nesta", "Pagliuca", "Albertini", "Baresi", "Bergomi", "Pirlo", "Gattuso", "Zambrotta"]
  },
  france: {
    first: ["Zinedine", "Thierry", "Laurent", "Didier", "Marcel", "Lilian", "David", "Robert", "Youri", "Fabien", "Bixente", "Patrick", "Nicolas", "Eric", "Sylvain"],
    last: ["Zidane", "Henry", "Blanc", "Deschamps", "Desailly", "Thuram", "Trezeguet", "Pires", "Djorkaeff", "Barthez", "Lizarazu", "Vieira", "Anelka", "Cantona", "Wiltord"]
  },
  russia: {
    first: ["Igor", "Viktor", "Valery", "Dmitry", "Aleksandr", "Sergei", "Andrei", "Yury", "Stanislav", "Oleg", "Ilya", "Evgeny", "Roman", "Vladislav", "Egor"],
    last: ["Akinfeev", "Onopko", "Karpin", "Alenichev", "Mostovoi", "Shalimov", "Kanchelskis", "Arshavin", "Kerzhakov", "Bystrov", "Kovtun", "Titov", "Radimov", "Smertin", "Pavlyuchenko"]
  },
  portugal: {
    first: ["Luís", "João", "Vitor", "Rui", "Nuno", "Cristiano", "Pedro", "Fernando", "Ricardo", "Simão", "Deco", "Jorge", "Manuel", "Helder", "Abel"],
    last: ["Figo", "Pinto", "Baía", "Costa", "Gomes", "Ronaldo", "Pauleta", "Couto", "Carvalho", "Sabrosa", "Sousa", "Andrade", "Manuel", "Postiga", "Valente"]
  },
  netherlands: {
    first: ["Edwin", "Dennis", "Patrick", "Ruud", "Frank", "Ronald", "Edgar", "Clarence", "Marc", "Jaap", "Robin", "Wesley", "Arjen", "Giovanni", "Philip"],
    last: ["van der Sar", "Bergkamp", "Kluivert", "van Nistelrooy", "de Boer", "Davids", "Seedorf", "Overmars", "Stam", "van Persie", "Sneijder", "Robben", "van Bronckhorst", "Cocu"]
  },
  argentina: {
    first: ["Diego", "Gabriel", "Hernan", "Juan", "Javier", "Ariel", "Claudio", "Roberto", "Fernando", "Sergio", "Lionel", "Angel", "Pablo", "Martin"],
    last: ["Maradona", "Batistuta", "Crespo", "Riquelme", "Zanetti", "Ortega", "Caniggia", "Ayala", "Redondo", "Veron", "Sorin", "Messi", "Di Maria", "Aimar", "Palermo"]
  },
  brazil: {
    first: ["Ronaldo", "Roberto", "Rivaldo", "Romario", "Cafu", "Ronaldinho", "Kaka", "Adriano", "Lucio", "Dida", "Gilberto", "Emerson", "Ze", "Luis", "Denilson"],
    last: ["Nazario", "Carlos", "Ferreira", "Faria", "de Moraes", "Gaúcho", "Leite", "Ribeiro", "Silva", "Santos", "Emerson", "Roberto", "Fabiano", "de Oliveira"]
  },
  colombia: {
    first: ["Carlos", "Faustino", "Rene", "Freddy", "Adolfo", "Radamel", "James", "Mario", "Ivan", "Faryd", "Luis", "Victor", "Teofilo", "Juan"],
    last: ["Valderrama", "Asprilla", "Higuita", "Rincon", "Valencia", "Falcao", "Rodriguez", "Yepes", "Cordoba", "Mondragon", "Muriel", "Aristizabal", "Torres", "Cuadrado"]
  },
  scotland: {
    first: ["Ally", "Kenny", "Colin", "Gordon", "Darren", "Scott", "John", "Barry", "Craig", "James", "Graeme", "Paul", "Andy", "Neil", "Billy", "Duncan", "Gary"],
    last: ["McCoist", "Dalglish", "Hendry", "Strachan", "Fletcher", "Brown", "McGinn", "Ferguson", "Lambert", "Boyd", "Souness", "McStay", "Robertson", "Gallacher", "Durie", "Ferguson", "Naismith"]
  },
  ukraine: {
    first: ["Andriy", "Serhiy", "Oleksandr", "Anatoliy", "Taras", "Ruslan", "Viktor", "Artem", "Vitaliy", "Mykola", "Yevhen", "Dmytro", "Ihor", "Vladyslav", "Roman"],
    last: ["Shevchenko", "Rebrov", "Voronin", "Tymoshchuk", "Yarmolenko", "Konoplyanka", "Zinchenko", "Mudryk", "Shovkovskyi", "Milevskyi", "Stepanenko", "Rotan", "Malinovskyi", "Tsygankov", "Pyatov"]
  }
};

// Maps detailed visual position tags to core GK/DF/MF/FW categories for game functionality
export const getGeneralPosition = (pos) => {
  if (!pos) return "MF";
  const p = pos.trim().toUpperCase();
  if (p === "GK" || p === "GOALKEEPER") return "GK";

  if (p === "DF" || p === "DEFENDER" ||
    p === "CB" || p === "LB" || p === "RB" || p === "SW" ||
    p === "DL" || p === "DR" || p === "DC" || p === "LWB" || p === "RWB") {
    return "DF";
  }

  if (p === "MF" || p === "MIDFIELDER" ||
    p === "CM" || p === "DM" || p === "AM" || p === "LM" || p === "RM" ||
    p === "DMC" || p === "AMC" || p === "MC" || p === "ML" || p === "MR" ||
    p === "AML" || p === "AMR") {
    return "MF";
  }

  if (p === "FW" || p === "FORWARD" ||
    p === "ST" || p === "CF" || p === "SC" || p === "LW" || p === "RW" ||
    p === "LF" || p === "RF" || p === "STRIKER" || p === "WINGER") {
    return "FW";
  }

  return "MF";
};

// Calibrates squad player ratings to match target team stats exactly
export const calibrateSquadRatings = (squad, stats) => {
  if (!stats) return squad;

  // We calibrate the squad average to be slightly lower than the starting lineup's target rating
  // (T - 0.5) to allow backups/reserves to have lower ratings and create depth variation.
  const departments = {
    GK: Math.max(1, (stats.defense || 3) - 0.5),
    DF: Math.max(1, (stats.defense || 3) - 0.5),
    MF: Math.max(1, (stats.midfield || 3) - 0.5),
    FW: Math.max(1, (stats.attack || 3) - 0.5)
  };

  // Group players by department
  const grouped = { GK: [], DF: [], MF: [], FW: [] };
  squad.forEach(p => {
    const dept = getGeneralPosition(p.position);
    if (grouped[dept]) {
      grouped[dept].push(p);
    } else {
      grouped.MF.push(p);
    }
  });

  // Calibrate each department
  Object.keys(grouped).forEach(dept => {
    const players = grouped[dept];
    const target = departments[dept];
    const N = players.length;
    if (N === 0) return;

    // Use Math.round to keep targetSum an integer
    const targetSum = Math.round(target * N);

    // 1. Calculate current average
    const currentSum = players.reduce((sum, p) => sum + (parseInt(p.rating, 10) || 3), 0);
    const currentAvg = currentSum / N;

    // If already matching, do nothing but clamp
    if (Math.round(currentAvg) === target) {
      players.forEach(p => {
        p.rating = Math.max(1, Math.min(10, parseInt(p.rating, 10) || 6));
      });
      return;
    }

    // 2. Linear shift
    const diff = target - currentAvg;
    const floatRatings = players.map(p => {
      const originalRating = parseInt(p.rating, 10) || 6;
      const shifted = originalRating + diff;
      const clamped = Math.max(1, Math.min(10, shifted));
      return { p, originalRating, shifted, clamped, rounded: Math.round(clamped) };
    });

    // 3. Adjust sum to match targetSum
    let initialSum = floatRatings.reduce((sum, item) => sum + item.rounded, 0);
    let attempts = 0;
    const maxAttempts = 100;

    while (initialSum !== targetSum && attempts < maxAttempts) {
      attempts++;
      if (initialSum < targetSum) {
        // Increase ratings of the strongest players first to preserve star ranking order
        const candidates = floatRatings
          .filter(item => item.rounded < 10)
          .sort((a, b) => b.shifted - a.shifted);

        if (candidates.length === 0) break;

        candidates[0].rounded += 1;
        initialSum += 1;
      } else {
        // Decrease ratings of the weakest players first to preserve ranking order
        const candidates = floatRatings
          .filter(item => item.rounded > 1)
          .sort((a, b) => a.shifted - b.shifted);

        if (candidates.length === 0) break;

        candidates[0].rounded -= 1;
        initialSum -= 1;
      }
    }

    // Apply the calibrated ratings back to players
    floatRatings.forEach(item => {
      item.p.rating = item.rounded;
    });
  });

  return squad;
};

export const generatePlayerPositions = (primaryPos) => {
  const relatedMap = {
    GK: [],
    DL: ["ML", "DC"],
    DR: ["MR", "DC"],
    DC: ["DMC", "DL", "DR"],
    DMC: ["MC", "DC"],
    MC: ["DMC", "AMC"],
    ML: ["AML", "LW", "MC"],
    MR: ["AMR", "RW", "MC"],
    AMC: ["MC", "AML", "AMR", "ST"],
    AML: ["LW", "ML", "AMC"],
    AMR: ["RW", "MR", "AMC"],
    ST: ["CF", "LW", "RW"],
    CF: ["ST", "LW", "RW"],
    LW: ["AML", "ML", "CF"],
    RW: ["AMR", "MR", "CF"]
  };

  const list = [primaryPos];
  const related = relatedMap[primaryPos] || [];

  // Randomly add 1 or 2 related positions
  const numToAdd = Math.random() < 0.3 ? 0 : (Math.random() < 0.7 ? 1 : 2);
  for (let i = 0; i < numToAdd && related.length > 0; i++) {
    const rIndex = Math.floor(Math.random() * related.length);
    const pos = related.splice(rIndex, 1)[0];
    if (!list.includes(pos)) {
      list.push(pos);
    }
  }
  return list;
};

// Formats full player positions for display (e.g. "DC, DR", "DL, ML", "GK")
export const getPlayerFullPositions = (player) => {
  if (!player) return '';
  if (Array.isArray(player.positions) && player.positions.length > 0) {
    return player.positions.join(', ');
  }
  if (typeof player.positions === 'string' && player.positions.trim()) {
    return player.positions;
  }
  return player.position || '';
};

export const getIdealSlotPosition = (slotRole, x, y) => {
  if (slotRole === 'gk') return 'GK';

  if (slotRole === 'def') {
    if (x < 30) return 'DL';
    if (x > 70) return 'DR';
    return 'DC';
  }

  if (slotRole === 'mid') {
    if (x < 30) {
      if (y < 45) return 'AML';
      return 'ML';
    }
    if (x > 70) {
      if (y < 45) return 'AMR';
      return 'MR';
    }
    if (y > 55) return 'DMC';
    if (y < 45) return 'AMC';
    return 'MC';
  }

  if (slotRole === 'att') {
    if (x < 30) return 'LW';
    if (x > 70) return 'RW';
    return 'ST';
  }

  return '';
};

export const getPositionPenalty = (playerPositions, idealSlotPos) => {
  const positions = Array.isArray(playerPositions)
    ? playerPositions
    : [playerPositions];

  const equivalenceGroups = [
    ["ML", "AML", "LW"],
    ["MR", "AMR", "RW"],
    ["CF", "ST"],
    ["MC", "AMC", "DMC"],
    ["DL"],
    ["DR"],
    ["DC"],
    ["GK"]
  ];

  for (const group of equivalenceGroups) {
    if (group.includes(idealSlotPos)) {
      if (positions.some(pos => group.includes(pos))) {
        return 0;
      }
    }
  }

  const getPosType = (pos) => {
    if (pos === "GK") return "GK";
    if (["DL", "DR", "DC"].includes(pos)) return "DF";
    if (["DMC", "MC", "AMC", "ML", "MR", "AML", "AMR"].includes(pos)) return "MF";
    if (["LW", "RW", "CF", "ST"].includes(pos)) return "FW";
    return "";
  };

  const slotType = getPosType(idealSlotPos);
  const hasMatchingType = positions.some(pos => getPosType(pos) === slotType);

  if (hasMatchingType) {
    return 2;
  }

  const isAdjacent = (typeA, typeB) => {
    if (typeA === "DF" && typeB === "MF") return true;
    if (typeA === "MF" && typeB === "DF") return true;
    if (typeA === "MF" && typeB === "FW") return true;
    if (typeA === "FW" && typeB === "MF") return true;
    return false;
  };

  const hasAdjacentType = positions.some(pos => isAdjacent(getPosType(pos), slotType));
  if (hasAdjacentType) {
    return 2;
  }

  return 4;
};

// Generates procedural squad as local fallback
export const generateProceduralSquad = (teamName, country, stats) => {
  const normCountry = (country || "").toLowerCase();
  const db = nameDatabase[normCountry] || nameDatabase.england;

  const squad = [];
  const seenNames = new Set();

  const createUniqueName = () => {
    let attempts = 0;
    while (attempts < 100) {
      const f = db.first[Math.floor(Math.random() * db.first.length)];
      const l = db.last[Math.floor(Math.random() * db.last.length)];
      const name = `${f} ${l}`;
      if (!seenNames.has(name)) {
        seenNames.add(name);
        return name;
      }
      attempts++;
    }
    return `Player ${seenNames.size + 1}`;
  };

  const makePlayer = (position, baseStat) => {
    const name = createUniqueName();
    // Generate a procedural rating between 1 and 10 matching the baseStat average with some deviation
    const rating = Math.max(1, Math.min(10, Math.round(baseStat + Math.random() * 2 - 1)));
    const age = 18 + Math.floor(Math.random() * 16);
    const positions = generatePlayerPositions(position);
    return {
      name,
      position,
      positions,
      rating,
      age,
      isProcedural: true,
      condition: 100,
      injuryMatchesLeft: 0,
      injury: null,
      yellowCards: 0,
      redCards: 0,
      suspensionMatchesLeft: 0,
      suspensionReason: null
    };
  };

  // Assign detailed positions in the fallback generator
  const gkPos = ["GK"];
  const dfPos = ["DC", "DL", "DR"];
  const mfPos = ["MC", "ML", "MR", "DMC", "AMC"];
  const fwPos = ["ST", "CF", "LW", "RW"];

  for (let i = 0; i < 2; i++) {
    squad.push(makePlayer(gkPos[0], stats.defense));
  }
  for (let i = 0; i < 8; i++) {
    const pos = dfPos[i % dfPos.length];
    squad.push(makePlayer(pos, stats.defense));
  }
  for (let i = 0; i < 8; i++) {
    const pos = mfPos[i % mfPos.length];
    squad.push(makePlayer(pos, stats.midfield));
  }
  for (let i = 0; i < 4; i++) {
    const pos = fwPos[i % fwPos.length];
    squad.push(makePlayer(pos, stats.attack));
  }

  return calibrateSquadRatings(squad, stats);
};

const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-3.1-flash-lite";

// Generates a squad of 22 authentic players for the specific team/season using Gemini API with detailed positions
export const fetchGeminiSquad = async (teamName, season, country, stats) => {
  const prompt = `You are a football database expert. 
Generate a squad of 22 players for the team "${teamName}" in the "${season}" season. 
The team represents the country "${country}" and has game ratings: Attack: ${stats.attack}/5, Midfield: ${stats.midfield}/5, Defense: ${stats.defense}/5.

Requirements:
1. Provide exactly 22 players.
2. The players must be real, authentic players who played for "${teamName}" in the ${season} season. If this is a national team (like Germany, Brazil, England), provide the squad representing them during that tournament/year.
3. The players must be grouped by positions: exactly 2 Goalkeepers, exactly 7 or 8 Defenders, exactly 7 or 8 Midfielders, and exactly 4 to 6 Forwards so that the total is exactly 22.
4. For each player, provide:
   - "name": Full name of the player.
   - "position": Specify their primary playing position. It MUST be one of these exact tags: "GK" (Goalkeeper), "DL" (Left Back/Defender), "DR" (Right Back/Defender), "DC" (Centre Back/Defender), "DMC" (Defensive Midfielder), "MC" (Centre Midfielder), "ML" (Left Midfielder), "MR" (Right Midfielder), "AMC" (Attacking Midfielder), "AML" (Attacking Midfielder Left), "AMR" (Attacking Midfielder Right), "ST" (Striker), "CF" (Centre Forward), "LW" (Left Winger), "RW" (Right Winger).
   - "positions": An array of 1 to 3 positions they can play (e.g. ["AML", "LW", "ML"]), starting with their primary position. Each position in the array must be one of the exact tags listed above.
   - "rating": An integer between 1 and 5 representing their skill level (strictly only 1, 2, 3, 4, or 5). Scale the ratings so that the best/starting players align with the team's expected ratings (Goalkeepers/Defenders around ${stats.defense}/5, Midfielders around ${stats.midfield}/5, and Forwards around ${stats.attack}/5), while the backup/reserve players are rated 1 or 2 stars lower to ensure realistic roster depth and rating variation within the squad.
   - "age": The player's age in the year ${season}.
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            position: {
              type: "STRING",
              enum: ["GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"]
            },
            positions: {
              type: "ARRAY",
              items: {
                type: "STRING",
                enum: ["GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"]
              }
            },
            rating: {
              type: "INTEGER"
            },
            age: { type: "INTEGER" }
          },
          required: ["name", "position", "positions", "rating", "age"]
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

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Invalid response format from Gemini API");
  }

  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7, cleanText.length - 3).trim();
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3, cleanText.length - 3).trim();
  }

  const squad = JSON.parse(cleanText);
  if (!Array.isArray(squad) || squad.length < 11) {
    throw new Error("Invalid squad size generated by Gemini");
  }

  const formattedSquad = squad.map(p => {
    let r = parseInt(p.rating, 10) || 6;
    r = Math.max(1, Math.min(10, r));
    return {
      ...p,
      rating: r,
      isAI: true,
      condition: 100,
      injuryMatchesLeft: 0,
      injury: null,
      yellowCards: 0,
      redCards: 0,
      suspensionMatchesLeft: 0,
      suspensionReason: null,
      positions: Array.isArray(p.positions) ? p.positions : [p.position]
    };
  });

  return calibrateSquadRatings(formattedSquad, stats);
};

// Helper to convert a season string (e.g. "1995/96" or "1995") to the previous season's string
export const getPreviousSeasonString = (seasonStr) => {
  if (!seasonStr) return null;
  const parts = seasonStr.split("/");
  if (parts.length === 2) {
    const startYr = parseInt(parts[0]);
    if (!isNaN(startYr)) {
      const prevStartYr = startYr - 1;
      const prevEndYr = startYr % 100;
      return `${prevStartYr}/${String(prevEndYr).padStart(2, '0')}`;
    }
  } else {
    const yr = parseInt(seasonStr);
    if (!isNaN(yr)) {
      return String(yr - 1);
    }
  }
  return null;
};

// Procedural fallback to update squad ratings and ages when progressing a season without Gemini API
export const updateSquadStatsFallback = (existingSquad, stats) => {
  const formatted = existingSquad.map(p => {
    const age = (parseInt(p.age) || 25) + 1;
    let rating = parseInt(p.rating) || 6;
    const rand = Math.random();
    if (rand < 0.15 && rating > 1) rating -= 1;
    else if (rand > 0.85 && rating < 10) rating += 1;
    return {
      ...p,
      age,
      rating,
      condition: 100,
      injuryMatchesLeft: 0,
      injury: null,
      yellowCards: 0,
      redCards: 0,
      suspensionMatchesLeft: 0,
      suspensionReason: null
    };
  });
  return calibrateSquadRatings(formatted, stats);
};

// AI-driven squad update to keep players across seasons but update their stats based on historical performance/natural development
export const updateGeminiSquadStats = async (existingSquad, teamName, season, country, stats) => {
  const prompt = `You are a football database expert.
We are progressing to the next season "${season}" for the team "${teamName}" in "${country}".
We want to keep the EXACT same players from the previous season, but update their ratings and ages for the new season.
Here is the current squad roster:
${JSON.stringify(existingSquad.map(p => ({ name: p.name, position: p.position, rating: p.rating, age: p.age })))}

The team represents the country "${country}" and has expected game ratings for the "${season}" season: Attack: ${stats.attack}/5, Midfield: ${stats.midfield}/5, Defense: ${stats.defense}/5.

For each player in the list:
1. Keep their "name" and "position" exactly as they are.
2. Increment their age by 1, or adjust their age to be realistic for their real-life age in the starting year of the season ${season.split("/")[0]}.
3. Update their "rating" (an integer from 1 to 5) to reflect their real-life performance/status in the starting year of the season ${season.split("/")[0]}.
4. Scale the ratings so that the best/starting players align with the team's expected ratings (Defenders around ${stats.defense}/5, Midfielders around ${stats.midfield}/5, and Forwards around ${stats.attack}/5), while backup/reserve players are rated 1 or 2 stars lower to ensure realistic roster depth and variation.
5. If a player was very young or retired in real-life, or you want to simulate natural development, increase/decrease their rating accordingly.

Return a JSON array containing the exact same players (same names and primary positions) with updated "rating" and "age" values. Each object must have:
- "name": String (exact same name)
- "position": String (exact same position)
- "positions": Array of strings (optional, can match the original positions if possible)
- "rating": Integer (1 to 5)
- "age": Integer
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            position: {
              type: "STRING",
              enum: ["GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"]
            },
            positions: {
              type: "ARRAY",
              items: {
                type: "STRING",
                enum: ["GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"]
              }
            },
            rating: {
              type: "INTEGER"
            },
            age: { type: "INTEGER" }
          },
          required: ["name", "position", "positions", "rating", "age"]
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

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Invalid response format from Gemini API");
  }

  let cleanText = text.trim();
  if (cleanText.startsWith("```json")) {
    cleanText = cleanText.substring(7, cleanText.length - 3).trim();
  } else if (cleanText.startsWith("```")) {
    cleanText = cleanText.substring(3, cleanText.length - 3).trim();
  }

  const squad = JSON.parse(cleanText);
  const formattedSquad = squad.map(p => {
    let r = parseInt(p.rating, 10) || 6;
    r = Math.max(1, Math.min(10, r));
    return {
      ...p,
      rating: r,
      isAI: true,
      condition: 100,
      injuryMatchesLeft: 0,
      injury: null,
      yellowCards: 0,
      redCards: 0,
      suspensionMatchesLeft: 0,
      suspensionReason: null,
      positions: Array.isArray(p.positions) ? p.positions : [p.position]
    };
  });

  return calibrateSquadRatings(formattedSquad, stats);
};

// Flatten active formation coordinates into named drop slots
export const getFormationSlots = (formationKey) => {
  const f = FORMATIONS[formationKey];
  if (!f) return [];
  const slots = [];
  Object.entries(f.positions).forEach(([role, coords]) => {
    coords.forEach((coord, idx) => {
      slots.push({
        id: `${role}-${idx}`,
        role,
        x: coord.x,
        y: coord.y
      });
    });
  });
  return slots;
};

// Generates an optimal starting lineup based on player ratings and roles
export const generateDefaultLineup = (squad, formationKey = '4-4-2') => {
  if (!Array.isArray(squad) || squad.length === 0) return {};
  const slots = getFormationSlots(formationKey);
  const newLineup = {};
  const availableGK = squad.filter(p => getGeneralPosition(p.position) === "GK" && !(p.injuryMatchesLeft > 0) && !(p.suspensionMatchesLeft > 0)).sort((a, b) => b.rating - a.rating);
  const availableDF = squad.filter(p => getGeneralPosition(p.position) === "DF" && !(p.injuryMatchesLeft > 0) && !(p.suspensionMatchesLeft > 0)).sort((a, b) => b.rating - a.rating);
  const availableMF = squad.filter(p => getGeneralPosition(p.position) === "MF" && !(p.injuryMatchesLeft > 0) && !(p.suspensionMatchesLeft > 0)).sort((a, b) => b.rating - a.rating);
  const availableFW = squad.filter(p => getGeneralPosition(p.position) === "FW" && !(p.injuryMatchesLeft > 0) && !(p.suspensionMatchesLeft > 0)).sort((a, b) => b.rating - a.rating);

  let gkIdx = 0, dfIdx = 0, mfIdx = 0, fwIdx = 0;

  slots.forEach(slot => {
    if (slot.role === "gk") {
      if (availableGK[gkIdx]) newLineup[slot.id] = availableGK[gkIdx++];
    } else if (slot.role === "def") {
      if (availableDF[dfIdx]) newLineup[slot.id] = availableDF[dfIdx++];
    } else if (slot.role === "mid") {
      if (availableMF[mfIdx]) newLineup[slot.id] = availableMF[mfIdx++];
    } else if (slot.role === "att") {
      if (availableFW[fwIdx]) newLineup[slot.id] = availableFW[fwIdx++];
    }
  });

  return newLineup;
};

// Dynamically recalculate the player's team ratings (Attack, Midfield, Defense) based on starting lineup & player tactical roles
export const updateTeamStatsInStorage = (lineup, formationKey, playerRoles = null) => {
  if (!formationKey) return;
  const f = FORMATIONS[formationKey];
  if (!f) return;

  let activeRoles = playerRoles;
  if (!activeRoles) {
    try {
      const info = getActiveTeamInfo();
      const savedRoles = localStorage.getItem(`retro_roles_${info.name}_${info.season}`);
      activeRoles = savedRoles ? JSON.parse(savedRoles) : {};
    } catch (e) {
      activeRoles = {};
    }
  }

  const calculatedStats = calculateTeamTacticalStats(lineup, formationKey, activeRoles, 'balanced');

  // Now, update in localStorage
  // 1. League Career state
  const careerRaw = localStorage.getItem("retro_league_career");
  if (careerRaw) {
    try {
      const state = JSON.parse(careerRaw);
      if (state.teams && state.playerTeamId !== undefined) {
        const teamIndex = state.teams.findIndex(t => t.idnum === state.playerTeamId);
        if (teamIndex !== -1) {
          state.teams[teamIndex].attack = calculatedStats.attack;
          state.teams[teamIndex].midfield = calculatedStats.midfield;
          state.teams[teamIndex].defense = calculatedStats.defense;

          // Also sync to europeanCupState teams if present
          if (state.europeanCupState && state.europeanCupState.teams) {
            const euroTeamIndex = state.europeanCupState.teams.findIndex(t => t.name === state.teams[teamIndex].name);
            if (euroTeamIndex !== -1) {
              state.europeanCupState.teams[euroTeamIndex].attack = calculatedStats.attack;
              state.europeanCupState.teams[euroTeamIndex].midfield = calculatedStats.midfield;
              state.europeanCupState.teams[euroTeamIndex].defense = calculatedStats.defense;
            }
          }

          localStorage.setItem("retro_league_career", JSON.stringify(state));
        }
      }
    } catch (e) {
      console.error("Error updating career team stats in storage", e);
    }
  }

  // 2. Tournament state
  const tourneyRaw = localStorage.getItem("retro_tournament_state");
  if (tourneyRaw) {
    try {
      const state = JSON.parse(tourneyRaw);
      if (state.teams && state.playerTeamId !== undefined) {
        const teamIndex = state.teams.findIndex(t => t.idnum === state.playerTeamId);
        if (teamIndex !== -1) {
          state.teams[teamIndex].attack = calculatedStats.attack;
          state.teams[teamIndex].midfield = calculatedStats.midfield;
          state.teams[teamIndex].defense = calculatedStats.defense;
          localStorage.setItem("retro_tournament_state", JSON.stringify(state));
        }
      }
    } catch (e) {
      console.error("Error updating tournament team stats in storage", e);
    }
  }
};

// Retrieve active team details from localStorage (Career or Tournament)
const getActiveTeamInfo = (mode) => {
  if (mode === "career") {
    const careerRaw = localStorage.getItem("retro_league_career");
    if (careerRaw) {
      try {
        const state = JSON.parse(careerRaw);
        if (state.teams && state.playerTeamId !== undefined) {
          const team = state.teams.find(t => t.idnum === state.playerTeamId);
          if (team) {
            return {
              name: team.name,
              season: state.season,
              country: state.country,
              attack: team.attack || 3,
              midfield: team.midfield || 3,
              defense: team.defense || 3,
              primaryColor: team.primaryColor || '#00ff64',
              secondaryColor: team.secondaryColor || '#ffffff',
              id: team.idnum,
              currentRound: state.currentRound || 1,
              cupId: "league"
            };
          }
        }
      } catch (e) {
        console.error("Error reading career state", e);
      }
    }
  }

  if (mode === "tournament") {
    const tourneyRaw = localStorage.getItem("retro_tournament_state");
    if (tourneyRaw) {
      try {
        const state = JSON.parse(tourneyRaw);
        if (state.teams && state.playerTeamId !== undefined) {
          const team = state.teams.find(t => t.idnum === state.playerTeamId);
          if (team) {
            return {
              name: team.name,
              season: state.cupId ? (state.cupId.match(/\d+/) ? state.cupId.match(/\d+/)[0] : "1995") : "1995",
              country: state.country || 'world',
              attack: team.attack || 3,
              midfield: team.midfield || 3,
              defense: team.defense || 3,
              primaryColor: team.primaryColor || '#00ff64',
              secondaryColor: team.secondaryColor || '#ffffff',
              id: team.idnum,
              cupId: state.cupId
            };
          }
        }
      } catch (e) {
        console.error("Error reading tournament state", e);
      }
    }
  }

  // Fallback behavior if mode is unspecified
  const careerRaw = localStorage.getItem("retro_league_career");
  if (careerRaw) {
    try {
      const state = JSON.parse(careerRaw);
      if (state.teams && state.playerTeamId !== undefined) {
        const team = state.teams.find(t => t.idnum === state.playerTeamId);
        if (team) {
          return {
            name: team.name,
            season: state.season,
            country: state.country,
            attack: team.attack || 3,
            midfield: team.midfield || 3,
            defense: team.defense || 3,
            primaryColor: team.primaryColor || '#00ff64',
            secondaryColor: team.secondaryColor || '#ffffff',
            id: team.idnum,
            currentRound: state.currentRound || 1,
            cupId: "league"
          };
        }
      }
    } catch (e) {
      console.error("Error reading career state", e);
    }
  }

  const tourneyRaw = localStorage.getItem("retro_tournament_state");
  if (tourneyRaw) {
    try {
      const state = JSON.parse(tourneyRaw);
      if (state.teams && state.playerTeamId !== undefined) {
        const team = state.teams.find(t => t.idnum === state.playerTeamId);
        if (team) {
          return {
            name: team.name,
            season: state.cupId ? (state.cupId.match(/\d+/) ? state.cupId.match(/\d+/)[0] : "1995") : "1995",
            country: state.country || 'world',
            attack: team.attack || 3,
            midfield: team.midfield || 3,
            defense: team.defense || 3,
            primaryColor: team.primaryColor || '#00ff64',
            secondaryColor: team.secondaryColor || '#ffffff',
            id: team.idnum
          };
        }
      }
    } catch (e) {
      console.error("Error reading tournament state", e);
    }
  }

  return {
    name: "Liverpool",
    season: "1993",
    country: "england",
    attack: 4,
    midfield: 4,
    defense: 4,
    primaryColor: "#C8102E",
    secondaryColor: "#FFFFFF",
    id: 0
  };
};

// Formation Tactics Modal Component
export const FormationTacticsModal = ({ isOpen, onClose, mode, inline = false }) => {
  const [selectedFormation, setSelectedFormation] = useState(getSavedFormation());
  const [activeTab, setActiveTab] = useState("tactics"); // "tactics" | "squad"
  const [showFormationModal, setShowFormationModal] = useState(false);
  const [assigningPlayerMenu, setAssigningPlayerMenu] = useState(null);
  const [activeAssignSlot, setActiveAssignSlot] = useState(null);
  const [squadSortMode, setSquadSortMode] = useState('default'); // 'default' | 'rating' | 'position' | 'name'
  const [animatingOut, setAnimatingOut] = useState(false);
  const [squad, setSquad] = useState([]);
  const [lineup, setLineup] = useState({});
  const [playerRoles, setPlayerRoles] = useState({});
  const [loading, setLoading] = useState(false);
  const [draggedPlayer, setDraggedPlayer] = useState(null);
  const [draggedOrigin, setDraggedOrigin] = useState(null); // slot id if dragged from pitch
  const [dragOverSlotId, setDragOverSlotId] = useState(null);
  const [selectedRosterPlayer, setSelectedRosterPlayer] = useState(null);
  const [selectedBenchNames, setSelectedBenchNames] = useState([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const teamInfo = React.useMemo(() => getActiveTeamInfo(mode), [isOpen, mode]);
  const limit = React.useMemo(() => getSubstituteLimit(teamInfo.cupId, teamInfo.season, teamInfo.country), [teamInfo]);
  const [rosterViewFilter, setRosterViewFilter] = useState(() => (limit >= 99 ? 'all' : 'reserves')); // 'reserves' | 'all'

  const slots = React.useMemo(() => getFormationSlots(selectedFormation), [selectedFormation]);

  const startingNames = React.useMemo(() => new Set(Object.values(lineup).filter(Boolean).map(p => p.name)), [lineup]);
  const reservePlayers = React.useMemo(() => squad.filter(p => !startingNames.has(p.name) && !selectedBenchNames.includes(p.name)), [squad, startingNames, selectedBenchNames]);
  const displayedSquadPlayers = rosterViewFilter === 'reserves' ? reservePlayers : squad;

  // Memoized squad list sorted in CM 01/02 traditional order: Starting XI in slot order -> Bench S1..S7 -> Reserves
  const sortedSquadForTraditionalView = React.useMemo(() => {
    if (!Array.isArray(squad) || squad.length === 0) return [];

    if (squadSortMode === 'rating') {
      return [...squad].sort((a, b) => b.rating - a.rating);
    }
    if (squadSortMode === 'position') {
      const posWeight = (p) => {
        const gp = getGeneralPosition(p.position);
        if (gp === 'GK') return 1;
        if (gp === 'DF') return 2;
        if (gp === 'MF') return 3;
        return 4;
      };
      return [...squad].sort((a, b) => posWeight(a) - posWeight(b) || b.rating - a.rating);
    }
    if (squadSortMode === 'name') {
      return [...squad].sort((a, b) => a.name.localeCompare(b.name));
    }

    // Default CM 01/02 style: Starting XI in slot order -> Bench S1..S7 -> Reserves
    const xiPlayers = [];
    const xiNames = new Set();
    slots.forEach(slot => {
      const p = lineup[slot.id];
      if (p && !xiNames.has(p.name)) {
        xiPlayers.push(p);
        xiNames.add(p.name);
      }
    });

    const benchPlayers = [];
    const benchNames = new Set();
    selectedBenchNames.forEach(name => {
      const p = squad.find(s => s.name === name);
      if (p && !xiNames.has(p.name) && !benchNames.has(p.name)) {
        benchPlayers.push(p);
        benchNames.add(p.name);
      }
    });

    const reservePlayersList = squad
      .filter(p => !xiNames.has(p.name) && !benchNames.has(p.name))
      .sort((a, b) => {
        const posOrder = { GK: 1, DF: 2, MF: 3, FW: 4 };
        const pa = posOrder[getGeneralPosition(a.position)] || 5;
        const pb = posOrder[getGeneralPosition(b.position)] || 5;
        if (pa !== pb) return pa - pb;
        return b.rating - a.rating;
      });

    return [...xiPlayers, ...benchPlayers, ...reservePlayersList];
  }, [squad, lineup, selectedBenchNames, slots, squadSortMode]);

  // Load squad and lineup
  const loadSquadAndLineup = async (info) => {
    setLoading(true);
    const rosterKey = `retro_roster_${info.name}_${info.season}`;
    const lineupKey = `retro_lineup_${info.name}_${info.season}`;

    // Roster loading
    let activeRoster = [];
    const cachedRoster = localStorage.getItem(rosterKey);
    if (cachedRoster) {
      try {
        activeRoster = JSON.parse(cachedRoster);
      } catch (e) {
        console.error("Error parsing cached roster", e);
      }
    }

    const hasRealAI = activeRoster && activeRoster.length >= 11 && activeRoster.some(p => p.isAI || p.isHistorical);
    const hasDetailed = activeRoster && activeRoster.some(p => p.position !== "DF" && p.position !== "MF" && p.position !== "FW");
    const isStale1To5 = activeRoster && activeRoster.length > 0 && (
      !activeRoster.some(p => Number(p.rating) > 5) ||
      !activeRoster.some(p => p.wage !== undefined)
    );
    const hasInvalidRatings = activeRoster && activeRoster.some(p => Number(p.rating) > 10);

    // If the cache is empty, corrupted, lacks detailed positions, or has stale 1-5 ratings, load from database
    if (!activeRoster || activeRoster.length < 11 || !hasRealAI || !hasDetailed || isStale1To5 || hasInvalidRatings) {
      // 1. Try to load authentic prebuilt squad from local database
      const prebuilt = await getPrebuiltRoster(info.name, info.season);
      if (prebuilt && prebuilt.length >= 11) {
        activeRoster = prebuilt;
        localStorage.setItem(rosterKey, JSON.stringify(activeRoster));
        if (isStale1To5) {
          localStorage.removeItem(lineupKey);
        }
      } else {
        // 2. Try to load roster from the previous season to preserve players
        const prevSeason = getPreviousSeasonString(info.season);
        const prevRosterKey = prevSeason ? `retro_roster_${info.name}_${prevSeason}` : null;
        const prevLineupKey = prevSeason ? `retro_lineup_${info.name}_${prevSeason}` : null;
        const cachedPrevRoster = prevRosterKey ? localStorage.getItem(prevRosterKey) : null;
        const cachedPrevLineup = prevLineupKey ? localStorage.getItem(prevLineupKey) : null;

        if (cachedPrevRoster) {
          try {
            const prevRoster = JSON.parse(cachedPrevRoster);
            if (Array.isArray(prevRoster) && prevRoster.length >= 11) {
              try {
                // Ask Gemini to review the stats of the existing squad players for the new season
                const updated = await updateGeminiSquadStats(
                  prevRoster,
                  info.name,
                  info.season,
                  info.country,
                  { attack: info.attack, midfield: info.midfield, defense: info.defense }
                );
                if (updated && updated.length > 0) {
                  activeRoster = updated;
                }
              } catch (err) {
                console.error("Failed to update squad stats via AI, using fallback", err);
                activeRoster = updateSquadStatsFallback(
                  prevRoster,
                  { attack: info.attack, midfield: info.midfield, defense: info.defense }
                );
              }
              localStorage.setItem(rosterKey, JSON.stringify(activeRoster));

              // Map and migrate the lineup using updated players
              if (cachedPrevLineup) {
                try {
                  const parsedPrev = JSON.parse(cachedPrevLineup);
                  const activeLineup = {};
                  Object.entries(parsedPrev).forEach(([slotId, prevPlayer]) => {
                    if (prevPlayer) {
                      const updatedPlayer = activeRoster.find(p => p.name === prevPlayer.name);
                      if (updatedPlayer) {
                        activeLineup[slotId] = updatedPlayer;
                      }
                    }
                  });
                  localStorage.setItem(lineupKey, JSON.stringify(activeLineup));
                } catch (e) {
                  console.error("Error migrating previous lineup", e);
                }
              }
            }
          } catch (e) {
            console.error("Error loading/parsing previous roster", e);
          }
        }

        // If we still don't have a valid activeRoster, do a fresh Gemini fetch or procedural fallbacks
        if (!activeRoster || activeRoster.length < 11) {
          try {
            const fetched = await fetchGeminiSquad(
              info.name,
              info.season,
              info.country,
              { attack: info.attack, midfield: info.midfield, defense: info.defense }
            );
            if (fetched && fetched.length > 0) {
              activeRoster = fetched;
            }
          } catch (err) {
            console.error("Failed to load Gemini squad, fallback to procedural", err);
            activeRoster = generateProceduralSquad(
              info.name,
              info.country,
              { attack: info.attack, midfield: info.midfield, defense: info.defense }
            );
          }
          localStorage.setItem(rosterKey, JSON.stringify(activeRoster));
        }
      }
    }

    // Ensure all players have condition, injury, and positions fields for backwards-compatibility
    // Also, if it is Round 1 (start of season), reset all conditions to 100% and clear injuries
    if (activeRoster && activeRoster.length > 0) {
      let updated = false;
      const isRound1 = info.currentRound === 1;

      activeRoster = activeRoster.map(p => {
        const hasCond = p.condition !== undefined;
        const hasInj = p.injuryMatchesLeft !== undefined;
        const hasCards = p.yellowCards !== undefined && p.redCards !== undefined && p.suspensionMatchesLeft !== undefined;
        const hasPositions = p.positions !== undefined && Array.isArray(p.positions);

        let newCond = hasCond ? p.condition : 100;
        let newInjMatches = hasInj ? p.injuryMatchesLeft : 0;
        let newInj = p.injury || null;
        let newYellowCards = p.yellowCards !== undefined ? p.yellowCards : 0;
        let newRedCards = p.redCards !== undefined ? p.redCards : 0;
        let newSusMatches = p.suspensionMatchesLeft !== undefined ? p.suspensionMatchesLeft : 0;
        let newSusReason = p.suspensionReason || null;

        if (isRound1) {
          if (
            newCond !== 100 ||
            newInjMatches !== 0 ||
            newInj !== null ||
            newYellowCards !== 0 ||
            newRedCards !== 0 ||
            newSusMatches !== 0 ||
            newSusReason !== null
          ) {
            updated = true;
          }
          newCond = 100;
          newInjMatches = 0;
          newInj = null;
          newYellowCards = 0;
          newRedCards = 0;
          newSusMatches = 0;
          newSusReason = null;
        } else if (!hasCond || !hasInj || !hasCards || !hasPositions) {
          updated = true;
        }

        return {
          ...p,
          condition: newCond,
          injuryMatchesLeft: newInjMatches,
          injury: newInj,
          yellowCards: newYellowCards,
          redCards: newRedCards,
          suspensionMatchesLeft: newSusMatches,
          suspensionReason: newSusReason,
          positions: hasPositions ? p.positions : [p.position]
        };
      });
      if (updated) {
        localStorage.setItem(rosterKey, JSON.stringify(activeRoster));
      }
    }

    setSquad(activeRoster);

    // Lineup loading
    let activeLineup = {};
    const cachedLineup = localStorage.getItem(lineupKey);
    if (cachedLineup) {
      try {
        const parsed = JSON.parse(cachedLineup);
        const squadNames = new Set(activeRoster.map(p => p.name));
        Object.entries(parsed).forEach(([slotId, player]) => {
          if (player && squadNames.has(player.name)) {
            // Find player in activeRoster to keep stats in sync
            const rosterPlayer = activeRoster.find(p => p.name === player.name);
            activeLineup[slotId] = rosterPlayer || player;
          }
        });
        if (info.currentRound === 1) {
          localStorage.setItem(lineupKey, JSON.stringify(activeLineup));
        }
      } catch (e) {
        console.error("Error parsing cached lineup", e);
      }
    }

    // Auto-fill starting lineup if not yet set
    if (Object.keys(activeLineup).length === 0 && activeRoster.length >= 11) {
      activeLineup = generateDefaultLineup(activeRoster, selectedFormation);
      localStorage.setItem(lineupKey, JSON.stringify(activeLineup));
    }

    // Load saved player tactical roles (normal, support_mid, support_def, support_att)
    const rolesKey = `retro_roles_${info.name}_${info.season}`;
    let activeRoles = {};
    const cachedRoles = localStorage.getItem(rolesKey);
    if (cachedRoles) {
      try {
        activeRoles = JSON.parse(cachedRoles) || {};
      } catch (e) {
        activeRoles = {};
      }
    }

    setLineup(activeLineup);
    setPlayerRoles(activeRoles);
    updateTeamStatsInStorage(activeLineup, getSavedFormation(), activeRoles);

    // Load selected bench names
    const benchKey = `retro_bench_${info.name}_${info.season}`;
    const cachedBench = localStorage.getItem(benchKey);
    let activeBench = [];
    if (cachedBench) {
      try {
        activeBench = JSON.parse(cachedBench);
      } catch (e) {
        console.error("Error parsing cached bench", e);
      }
    }

    const startingNames = new Set(Object.values(activeLineup).filter(Boolean).map(p => p.name));
    activeBench = activeBench.filter(name => activeRoster.some(p => p.name === name) && !startingNames.has(name));

    const limit = getSubstituteLimit(info.cupId, info.season, info.country);
    if (limit >= 99) {
      activeBench = activeRoster.filter(p => !startingNames.has(p.name)).map(p => p.name);
      localStorage.setItem(benchKey, JSON.stringify(activeBench));
      setRosterViewFilter('all');
    } else if (activeBench.length < limit) {
      const nonStartingPlayers = activeRoster.filter(p => !startingNames.has(p.name));
      const needed = limit - activeBench.length;
      let addedCount = 0;
      for (let p of nonStartingPlayers) {
        if (addedCount >= needed) break;
        if (!activeBench.includes(p.name)) {
          activeBench.push(p.name);
          addedCount++;
        }
      }
      localStorage.setItem(benchKey, JSON.stringify(activeBench));
    }
    setSelectedBenchNames(activeBench);

    setLoading(false);
  };

  useEffect(() => {
    if (isOpen || inline) {
      setSelectedFormation(getSavedFormation());
      setAnimatingOut(false);
      setSelectedRosterPlayer(null);
      loadSquadAndLineup(teamInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, inline, teamInfo]);

  if (!isOpen && !inline) return null;

  const handleSelectFormation = (formationKey) => {
    setSelectedFormation(formationKey);
    localStorage.setItem('retro_player_formation', formationKey);

    // Clean up current lineup to remove slots that don't exist in the new formation
    const newSlots = getFormationSlots(formationKey);
    const newSlotsIds = new Set(newSlots.map(s => s.id));
    const newLineup = { ...lineup };
    let changed = false;

    Object.keys(newLineup).forEach(k => {
      if (!newSlotsIds.has(k)) {
        newLineup[k] = null;
        changed = true;
      }
    });

    const newRoles = { ...playerRoles };
    Object.keys(newRoles).forEach(k => {
      if (!newSlotsIds.has(k)) {
        delete newRoles[k];
      }
    });
    setPlayerRoles(newRoles);
    const rolesKey = `retro_roles_${teamInfo.name}_${teamInfo.season}`;
    localStorage.setItem(rolesKey, JSON.stringify(newRoles));

    if (changed) {
      setLineup(newLineup);
      const lineupKey = `retro_lineup_${teamInfo.name}_${teamInfo.season}`;
      localStorage.setItem(lineupKey, JSON.stringify(newLineup));
    }
    setSelectedRosterPlayer(null);
    updateTeamStatsInStorage(newLineup, formationKey, newRoles);
  };

  const handleToggleSlotRole = (e, slot, assignedPlayer) => {
    e.stopPropagation();
    if (!assignedPlayer || slot.role === 'gk') return;
    const currentRole = playerRoles[slot.id] || 'normal';
    const nextRole = getNextRoleForSlot(slot, assignedPlayer, currentRole);
    const nextRoles = { ...playerRoles, [slot.id]: nextRole };
    setPlayerRoles(nextRoles);
    const rolesKey = `retro_roles_${teamInfo.name}_${teamInfo.season}`;
    localStorage.setItem(rolesKey, JSON.stringify(nextRoles));
    updateTeamStatsInStorage(lineup, selectedFormation, nextRoles);
  };

  const handleClose = () => {
    setAnimatingOut(true);
    setTimeout(() => {
      setAnimatingOut(false);
      onClose();
    }, 200);
  };

  const checkUnavailablePlayer = (player) => {
    if (!player) return false;
    if (player.injuryMatchesLeft > 0) {
      alert(`${player.name} is injured and cannot play! (${player.injuryMatchesLeft} matches remaining)`);
      return true;
    }
    if (player.suspensionMatchesLeft > 0) {
      alert(`${player.name} is suspended (${player.suspensionReason || 'Disciplinary Ban'}) and cannot play! (${player.suspensionMatchesLeft} matches remaining)`);
      return true;
    }
    return false;
  };

  // Drag and drop event handlers
  const handleDragStart = (e, player, originSlotId = null) => {
    if (checkUnavailablePlayer(player)) {
      e.preventDefault();
      return;
    }
    setDraggedPlayer(player);
    setDraggedOrigin(originSlotId);
  };

  const handleDragOver = (e, slotId) => {
    e.preventDefault();
    if (dragOverSlotId !== slotId) {
      setDragOverSlotId(slotId);
    }
  };

  const updateLineupAndSave = (newLineup) => {
    setLineup(newLineup);
    const lineupKey = `retro_lineup_${teamInfo.name}_${teamInfo.season}`;
    localStorage.setItem(lineupKey, JSON.stringify(newLineup));
    updateTeamStatsInStorage(newLineup, selectedFormation, playerRoles);

    // Automatically remove any starting player from selectedBenchNames or sync all non-starters if unlimited
    const startingNames = new Set(Object.values(newLineup).filter(Boolean).map(p => p.name));
    const limit = getSubstituteLimit(teamInfo.cupId, teamInfo.season, teamInfo.country);

    let nextBench;
    if (limit >= 99) {
      nextBench = squad.filter(p => !startingNames.has(p.name)).map(p => p.name);
    } else {
      nextBench = selectedBenchNames.filter(name => !startingNames.has(name));
    }

    if (JSON.stringify(nextBench) !== JSON.stringify(selectedBenchNames)) {
      setSelectedBenchNames(nextBench);
      const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
      localStorage.setItem(benchKey, JSON.stringify(nextBench));
    }
  };

  const handleBenchSlotClick = (playerOnSlot = null) => {
    const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
    const limit = getSubstituteLimit(teamInfo.cupId, teamInfo.season, teamInfo.country);

    if (playerOnSlot) {
      // Remove this player from the bench
      const nextBench = selectedBenchNames.filter(name => name !== playerOnSlot.name);
      setSelectedBenchNames(nextBench);
      localStorage.setItem(benchKey, JSON.stringify(nextBench));
    } else if (selectedRosterPlayer) {
      if (selectedBenchNames.includes(selectedRosterPlayer.name)) {
        setSelectedRosterPlayer(null);
        return;
      }
      if (limit < 99 && selectedBenchNames.length >= limit) {
        alert(`You can only select up to ${limit} substitutes for the match bench!`);
        return;
      }

      // If the player was in the starting lineup, clear them first
      const startingSlot = Object.keys(lineup).find(k => lineup[k] && lineup[k].name === selectedRosterPlayer.name);
      if (startingSlot) {
        const newLineup = { ...lineup };
        newLineup[startingSlot] = null;
        updateLineupAndSave(newLineup);
      }

      const nextBench = [...selectedBenchNames, selectedRosterPlayer.name];
      setSelectedBenchNames(nextBench);
      localStorage.setItem(benchKey, JSON.stringify(nextBench));
      setSelectedRosterPlayer(null);
    }
  };

  const handleBenchDrop = (e) => {
    e.preventDefault();
    setDragOverSlotId(null);
    if (!draggedPlayer) return;

    if (selectedBenchNames.includes(draggedPlayer.name)) {
      setDraggedPlayer(null);
      setDraggedOrigin(null);
      return;
    }

    const limit = getSubstituteLimit(teamInfo.cupId, teamInfo.season, teamInfo.country);
    if (limit < 99 && selectedBenchNames.length >= limit) {
      alert(`You can only select up to ${limit} substitutes for the match bench!`);
      setDraggedPlayer(null);
      setDraggedOrigin(null);
      return;
    }

    if (isAssigned(draggedPlayer)) {
      // Clear from starting lineup
      const startingSlot = Object.keys(lineup).find(k => lineup[k] && lineup[k].name === draggedPlayer.name);
      if (startingSlot) {
        const newLineup = { ...lineup };
        newLineup[startingSlot] = null;
        updateLineupAndSave(newLineup);
      }
    }

    const nextBench = [...selectedBenchNames, draggedPlayer.name];
    setSelectedBenchNames(nextBench);
    const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
    localStorage.setItem(benchKey, JSON.stringify(nextBench));

    setDraggedPlayer(null);
    setDraggedOrigin(null);
  };

  const handleAddPlayerToBench = (e, player) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!player || selectedBenchNames.includes(player.name)) return;
    if (checkUnavailablePlayer(player)) return;
    const limit = getSubstituteLimit(teamInfo.cupId, teamInfo.season, teamInfo.country);
    if (limit < 99 && selectedBenchNames.length >= limit) {
      alert(`You can only select up to ${limit} substitutes for the match bench!`);
      return;
    }
    const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
    const nextBench = [...selectedBenchNames, player.name];
    setSelectedBenchNames(nextBench);
    localStorage.setItem(benchKey, JSON.stringify(nextBench));
    setSelectedRosterPlayer(null);
  };

  const handleDragLeave = () => {
    setDragOverSlotId(null);
  };

  const handleDrop = (e, slotId) => {
    e.preventDefault();
    setDragOverSlotId(null);
    if (!draggedPlayer) return;

    const newLineup = { ...lineup };

    // If the player was already in another slot, clear that slot
    Object.keys(newLineup).forEach(k => {
      if (newLineup[k] && newLineup[k].name === draggedPlayer.name) {
        newLineup[k] = null;
      }
    });

    // If dragged from pitch, handle potential swap
    if (draggedOrigin) {
      const existingInTarget = lineup[slotId];
      newLineup[draggedOrigin] = existingInTarget || null;
    }

    newLineup[slotId] = draggedPlayer;
    updateLineupAndSave(newLineup);

    setDraggedPlayer(null);
    setDraggedOrigin(null);
  };

  const handleClearSlot = (slotId) => {
    const newLineup = { ...lineup };
    newLineup[slotId] = null;
    updateLineupAndSave(newLineup);
  };

  const handleClearAll = () => {
    updateLineupAndSave({});
    setSelectedRosterPlayer(null);
  };

  const handleAutoFill = () => {
    const newLineup = generateDefaultLineup(squad, selectedFormation);
    updateLineupAndSave(newLineup);
    setSelectedRosterPlayer(null);
  };

  const handleRosterPlayerClick = (player) => {
    if (checkUnavailablePlayer(player)) return;
    if (isAssigned(player)) return;
    if (selectedRosterPlayer && selectedRosterPlayer.name === player.name) {
      setSelectedRosterPlayer(null);
    } else {
      setSelectedRosterPlayer(player);
    }
  };

  const handlePitchSlotClick = (slotId) => {
    if (selectedRosterPlayer) {
      const newLineup = { ...lineup };

      // Clear player from any other slots first (no duplicates)
      Object.keys(newLineup).forEach(k => {
        if (newLineup[k] && newLineup[k].name === selectedRosterPlayer.name) {
          newLineup[k] = null;
        }
      });

      newLineup[slotId] = selectedRosterPlayer;
      updateLineupAndSave(newLineup);
      setSelectedRosterPlayer(null);
    } else {
      if (lineup[slotId]) {
        handleClearSlot(slotId);
      }
    }
  };

  const isAssigned = (player) => {
    return Object.values(lineup).some(p => p && p.name === player.name);
  };

  const getLastName = (fullName) => {
    const parts = fullName.split(" ");
    return parts[parts.length - 1];
  };

  const getPositionColor = (pos) => {
    const genPos = getGeneralPosition(pos);
    if (genPos === "GK") return "#ffd700";
    if (genPos === "DF") return "#00e5ff";
    if (genPos === "MF") return "#00ff64";
    return "#ff4500";
  };

  // Get detailed assignment for any player (starting slot, bench sub index, or reserves)
  const getPlayerAssignmentInfo = (player) => {
    if (!player) return { type: 'reserve', label: '—', slotId: null, index: -1 };
    const startingSlotEntry = Object.entries(lineup).find(([sId, p]) => p && p.name === player.name);
    if (startingSlotEntry) {
      const [slotId] = startingSlotEntry;
      const slotObj = slots.find(s => s.id === slotId);
      const posLabel = slotObj ? getIdealSlotPosition(slotObj.role, slotObj.x, slotObj.y) : 'XI';
      return { type: 'starting', label: posLabel, slotId, index: -1 };
    }
    const benchIdx = selectedBenchNames.indexOf(player.name);
    if (benchIdx !== -1) {
      return { type: 'bench', label: `S${benchIdx + 1}`, slotId: null, index: benchIdx };
    }
    return { type: 'reserve', label: '—', slotId: null, index: -1 };
  };

  // Assign player to a starting slot
  const assignPlayerToStartingSlot = (player, targetSlotId) => {
    if (!player || !targetSlotId) return;
    if (checkUnavailablePlayer(player)) return;

    const newLineup = { ...lineup };
    const prevStartingSlot = Object.keys(newLineup).find(k => newLineup[k] && newLineup[k].name === player.name);
    const existingPlayerInTarget = newLineup[targetSlotId];

    // If player came from another starting slot, swap them!
    if (prevStartingSlot && prevStartingSlot !== targetSlotId) {
      newLineup[prevStartingSlot] = existingPlayerInTarget || null;
    }
    newLineup[targetSlotId] = player;
    updateLineupAndSave(newLineup);

    // If player was on bench, remove them from bench
    const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
    if (selectedBenchNames.includes(player.name)) {
      const nextBench = selectedBenchNames.filter(n => n !== player.name);
      setSelectedBenchNames(nextBench);
      localStorage.setItem(benchKey, JSON.stringify(nextBench));
    }

    setSelectedRosterPlayer(null);
    setActiveAssignSlot(null);
    setAssigningPlayerMenu(null);
  };

  // Assign player to a bench slot
  const assignPlayerToBenchSlot = (player, targetIndex) => {
    if (!player || targetIndex < 0) return;
    if (checkUnavailablePlayer(player)) return;

    // If player was in starting lineup, remove them
    const startingSlot = Object.keys(lineup).find(k => lineup[k] && lineup[k].name === player.name);
    if (startingSlot) {
      const newLineup = { ...lineup, [startingSlot]: null };
      updateLineupAndSave(newLineup);
    }

    const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
    const nextBench = [...selectedBenchNames];
    const prevBenchIdx = nextBench.indexOf(player.name);
    const existingPlayerAtTarget = nextBench[targetIndex];

    if (prevBenchIdx !== -1) {
      // Swap bench positions
      nextBench[prevBenchIdx] = existingPlayerAtTarget || null;
      nextBench[targetIndex] = player.name;
    } else {
      // Place at target index
      if (targetIndex < nextBench.length) {
        nextBench[targetIndex] = player.name;
      } else {
        nextBench.push(player.name);
      }
    }
    const filteredBench = nextBench.filter(Boolean);
    setSelectedBenchNames(filteredBench);
    localStorage.setItem(benchKey, JSON.stringify(filteredBench));

    setSelectedRosterPlayer(null);
    setActiveAssignSlot(null);
    setAssigningPlayerMenu(null);
  };

  // Unassign player (send to reserves)
  const handleUnassignPlayer = (player) => {
    if (!player) return;
    const startingSlot = Object.keys(lineup).find(k => lineup[k] && lineup[k].name === player.name);
    if (startingSlot) {
      const newLineup = { ...lineup, [startingSlot]: null };
      updateLineupAndSave(newLineup);
    }
    if (selectedBenchNames.includes(player.name)) {
      const benchKey = `retro_bench_${teamInfo.name}_${teamInfo.season}`;
      const nextBench = selectedBenchNames.filter(n => n !== player.name);
      setSelectedBenchNames(nextBench);
      localStorage.setItem(benchKey, JSON.stringify(nextBench));
    }
    setSelectedRosterPlayer(null);
    setActiveAssignSlot(null);
    setAssigningPlayerMenu(null);
  };

  const handleBottomSlotClick = (slotTarget) => {
    if (selectedRosterPlayer) {
      if (slotTarget.type === 'starting') {
        assignPlayerToStartingSlot(selectedRosterPlayer, slotTarget.id);
      } else if (slotTarget.type === 'bench') {
        assignPlayerToBenchSlot(selectedRosterPlayer, slotTarget.index);
      }
    } else {
      if (activeAssignSlot && activeAssignSlot.type === slotTarget.type && (activeAssignSlot.id === slotTarget.id || activeAssignSlot.index === slotTarget.index)) {
        setActiveAssignSlot(null);
      } else {
        setActiveAssignSlot(slotTarget);
      }
    }
  };

  /**
   * Renders compact season disciplinary tallies (yellow/red cards) for a player when > 0.
   */
  const renderSeasonCardPills = (player) => {
    const yc = player?.yellowCards || 0;
    const rc = player?.redCards || 0;
    if (yc === 0 && rc === 0) return null;
    const isNearBan = yc >= 4;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
        {yc > 0 && (
          <span
            style={{
              fontSize: '7.5px',
              fontWeight: 'bold',
              fontFamily: 'Orbitron',
              color: isNearBan ? '#ff9100' : '#ffd700',
              background: isNearBan ? 'rgba(255, 145, 0, 0.18)' : 'rgba(255, 215, 0, 0.12)',
              border: `1px solid ${isNearBan ? 'rgba(255, 145, 0, 0.45)' : 'rgba(255, 215, 0, 0.3)'}`,
              borderRadius: '3px',
              padding: '0.5px 3px',
              lineHeight: 1.2
            }}
            title={`Season Yellow Cards: ${yc}${isNearBan ? ' (One booking from suspension!)' : ''}`}
          >
            🟨{yc}
          </span>
        )}
        {rc > 0 && (
          <span
            style={{
              fontSize: '7.5px',
              fontWeight: 'bold',
              fontFamily: 'Orbitron',
              color: '#ff4d6d',
              background: 'rgba(255, 46, 76, 0.16)',
              border: '1px solid rgba(255, 46, 76, 0.4)',
              borderRadius: '3px',
              padding: '0.5px 3px',
              lineHeight: 1.2
            }}
            title={`Season Red Cards: ${rc}`}
          >
            🟥{rc}
          </span>
        )}
      </span>
    );
  };

  /**
   * Renders unified suspension / injury / fitness badge for bench & squad lists.
   */
  const renderBenchReserveStatusBadge = (player) => {
    if (player.suspensionMatchesLeft > 0) {
      return (
        <span
          style={{
            fontSize: '7.5px',
            fontWeight: 'bold',
            fontFamily: 'Orbitron',
            color: '#ff4d6d',
            background: 'rgba(255, 46, 76, 0.18)',
            padding: '1px 4px',
            borderRadius: '3px',
            border: '1px solid rgba(255, 46, 76, 0.45)'
          }}
          title={`Suspended: ${player.suspensionReason || 'Disciplinary Ban'} (${player.suspensionMatchesLeft}m)`}
        >
          🟥 {player.suspensionMatchesLeft}m
        </span>
      );
    }
    if (player.injuryMatchesLeft > 0) {
      return (
        <span
          style={{
            fontSize: '7.5px',
            fontWeight: 'bold',
            fontFamily: 'Orbitron',
            color: '#ff3333',
            background: 'rgba(255, 51, 51, 0.1)',
            padding: '1px 3px',
            borderRadius: '3px',
            border: '1px solid rgba(255, 51, 51, 0.25)'
          }}
          title={`Injured: ${player.injury || 'Unknown Injury'}`}
        >
          🤕 {player.injuryMatchesLeft}m
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '8px',
          fontWeight: 'bold',
          fontFamily: 'Orbitron',
          color: player.condition < 60 ? '#ff3333' : (player.condition < 80 ? '#ffa500' : '#00ff64'),
          background: player.condition < 60 ? 'rgba(255, 51, 51, 0.05)' : (player.condition < 80 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(0, 255, 100, 0.05)'),
          padding: '1px 3px',
          borderRadius: '3px',
          border: `1px solid ${player.condition < 60 ? 'rgba(255, 51, 51, 0.2)' : (player.condition < 80 ? 'rgba(255, 165, 0, 0.2)' : 'rgba(0, 255, 100, 0.15)')}`
        }}
        title={`Condition: ${player.condition !== undefined ? player.condition : 100}%`}
      >
        ⚡{player.condition !== undefined ? player.condition : 100}%
      </span>
    );
  };

  const renderTraditionalPlayerRow = (player, index) => {
    if (!player) return null;
    const assignment = getPlayerAssignmentInfo(player);
    const isSelected = selectedRosterPlayer && selectedRosterPlayer.name === player.name;
    const isSuspended = player.suspensionMatchesLeft > 0;
    const isInjured = player.injuryMatchesLeft > 0;
    const isStarting = assignment.type === 'starting';
    const isBench = assignment.type === 'bench';

    // Calculate rating with condition drop
    const displayRating = player.condition < 80 && !isInjured
      ? Math.max(1, player.rating - 1)
      : player.rating;

    // Tactical role if in starting lineup
    const roleId = isStarting ? (playerRoles[assignment.slotId] || 'normal') : null;
    const slotObj = isStarting ? slots.find(s => s.id === assignment.slotId) : null;
    const roleMeta = (isStarting && slotObj) ? getRoleMetadata(slotObj, player, roleId) : null;
    const hasRole = roleMeta && roleMeta.id !== 'normal';

    return (
      <div
        key={player.name || index}
        onClick={() => {
          if (activeAssignSlot) {
            if (activeAssignSlot.type === 'starting') {
              assignPlayerToStartingSlot(player, activeAssignSlot.id);
            } else if (activeAssignSlot.type === 'bench') {
              assignPlayerToBenchSlot(player, activeAssignSlot.index);
            }
          } else {
            handleRosterPlayerClick(player);
          }
        }}
        className="cm-squad-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2px 8px',
          height: '26px',
          borderRadius: '4px',
          background: isSelected
            ? 'rgba(0, 255, 100, 0.18)'
            : (index % 2 === 0 ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.25)'),
          border: isSelected
            ? '1px solid #00ff64'
            : (isStarting ? '1px solid rgba(0, 255, 100, 0.15)' : (isBench ? '1px solid rgba(0, 229, 255, 0.1)' : '1px solid transparent')),
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.15s ease',
          gap: '6px'
        }}
        title="Click row to select. Click slot button on left to assign."
      >
        {/* Left: Slot Button Pill */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAssigningPlayerMenu(player);
          }}
          className="cm-slot-btn"
          style={{
            width: '32px',
            height: '19px',
            borderRadius: '4px',
            border: isStarting
              ? '1px solid #64b5f6'
              : (isBench ? '1px solid #4fc3f7' : '1px solid rgba(255,255,255,0.15)'),
            background: isStarting
              ? 'linear-gradient(180deg, #1e5799 0%, #207cca 40%, #155799 100%)'
              : (isBench ? 'linear-gradient(180deg, #0288d1 0%, #01579b 100%)' : 'rgba(255,255,255,0.05)'),
            color: isStarting ? '#ffffff' : (isBench ? '#e1f5fe' : '#777'),
            fontFamily: 'Orbitron',
            fontSize: '8px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
            boxShadow: isStarting ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
          }}
          title="Click to assign slot"
        >
          {assignment.label}
        </button>

        {/* Status / Condition badge */}
        <div style={{
          width: '32px',
          height: '15px',
          borderRadius: '3px',
          background: isSuspended
            ? 'rgba(255, 46, 76, 0.22)'
            : (isInjured
              ? 'rgba(255, 51, 51, 0.2)'
              : (player.condition < 60 ? 'rgba(255, 51, 51, 0.15)' : (player.condition < 80 ? 'rgba(255, 152, 0, 0.2)' : 'rgba(0, 255, 100, 0.12)'))),
          border: `1px solid ${isSuspended ? '#ff2e4c' : (isInjured ? '#ff3333' : (player.condition < 60 ? '#ff3333' : (player.condition < 80 ? '#ffa500' : 'rgba(0, 255, 100, 0.3)')))}`,
          color: isSuspended ? '#ff4d6d' : (isInjured ? '#ff5555' : (player.condition < 60 ? '#ff5555' : (player.condition < 80 ? '#ffa500' : '#00ff64'))),
          fontSize: '7.5px',
          fontWeight: 'bold',
          fontFamily: 'Orbitron',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }} title={isSuspended ? `Suspended: ${player.suspensionReason || 'Ban'} (${player.suspensionMatchesLeft}m)` : (isInjured ? `Injured: ${player.injury || 'Injury'} (${player.injuryMatchesLeft}m)` : `Fitness: ${player.condition ?? 100}%`)}>
          {isSuspended ? 'SUS' : (isInjured ? 'INJ' : `${player.condition ?? 100}%`)}
        </div>

        {/* Player Name */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          overflow: 'hidden'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {player.name}
          </span>

          {renderSeasonCardPills(player)}

          {/* Tactical role badge if starting */}
          {hasRole && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (slotObj) handleToggleSlotRole(e, slotObj, player);
              }}
              style={{
                fontSize: '7px',
                fontWeight: 'bold',
                fontFamily: 'Orbitron',
                color: roleMeta.color,
                background: 'rgba(0,0,0,0.5)',
                border: `1px solid ${roleMeta.color}`,
                borderRadius: '3px',
                padding: '0.5px 3px',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title={`Role: ${roleMeta.label}. Click to cycle duty.`}
            >
              {roleMeta.shortName}
            </span>
          )}
        </div>

        {/* Star Rating */}
        <span style={{
          fontSize: '9.5px',
          fontWeight: 'bold',
          fontFamily: 'Orbitron',
          color: '#ffd700',
          flexShrink: 0,
          marginRight: '4px'
        }}>
          ★{displayRating}
        </span>

        {/* Playable Positions (right column, gold CM font) */}
        <span style={{
          fontSize: '9.5px',
          fontWeight: 'bold',
          fontFamily: 'Orbitron',
          color: '#ffd700',
          textAlign: 'right',
          flexShrink: 0,
          minWidth: '55px',
          letterSpacing: '0.5px'
        }} title={`Full positions: ${getPlayerFullPositions(player)}`}>
          {getPlayerFullPositions(player)}
        </span>
      </div>
    );
  };

  const currentFormation = FORMATIONS[selectedFormation];
  const formationKeys = Object.keys(FORMATIONS);

  return (
    <div style={inline ? {
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      justifyContent: 'center'
    } : {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      zIndex: 2000,
      padding: '20px',
      pointerEvents: 'auto',
      animation: animatingOut ? 'fadeOut 0.2s ease' : 'fadeIn 0.3s ease'
    }}>
      <style>{`
        .selected-roster-player {
          border: 1.5px solid #00ff64 !important;
          background: rgba(0, 255, 100, 0.12) !important;
          box-shadow: 0 0 10px rgba(0, 255, 100, 0.25) !important;
        }
        .pitch-slot-empty-target {
          border: 1.5px dashed #00ff64 !important;
          background: rgba(0, 255, 100, 0.08) !important;
          box-shadow: 0 0 8px rgba(0, 255, 100, 0.15) !important;
          cursor: pointer !important;
          animation: pulseGreen 1.5s infinite alternate !important;
        }
        @keyframes pulseGreen {
          0% {
            box-shadow: 0 0 4px rgba(0, 255, 100, 0.1);
          }
          100% {
            box-shadow: 0 0 12px rgba(0, 255, 100, 0.35);
          }
        }
        @media (max-height: 520px) {
          .tactics-modal-card {
            max-height: 98vh !important;
            padding: 10px 15px !important;
            gap: 8px !important;
            max-width: 96vw !important;
          }
          .tactics-modal-header h2 {
            font-size: 13px !important;
          }
          .tactics-container {
            height: calc(98vh - 100px) !important;
            gap: 10px !important;
          }
          .pitch-slot-container {
            min-width: 48px !important;
            padding: 1px 4px !important;
          }
          .pitch-slot-container span {
            font-size: 7.5px !important;
          }
          .pitch-slot-name {
            font-size: 9px !important;
            max-width: 58px !important;
          }
          .pitch-slot-empty {
            width: 32px !important;
            height: 32px !important;
          }
          .pitch-slot-empty span {
            font-size: 8px !important;
          }
          .roster-header {
            font-size: 9px !important;
            padding-bottom: 3px !important;
          }
          .roster-item {
            padding: 3px 6px !important;
            font-size: 10px !important;
          }
          .roster-item span.roster-player-name {
            font-size: 10px !important;
            max-width: 80px !important;
          }
          .roster-item span.roster-player-position {
            font-size: 7px !important;
            padding: 1px 3px !important;
          }
          .confirm-btn {
            padding: 6px 12px !important;
            font-size: 10px !important;
            margin-top: 0px !important;
          }
          .formations-grid {
            max-height: 48vh !important;
          }
          .active-formation-display {
            padding: 6px 10px !important;
            gap: 10px !important;
          }
          .active-pitch-wrapper {
            display: none !important;
          }
          .active-formation-display div div {
            font-size: 18px !important;
          }
          .formation-legend {
            display: none !important;
          }
        }
        @media (max-width: 1080px) and (min-height: 521px) {
          .tactics-container {
            flex-direction: column !important;
            height: auto !important;
            max-height: calc(90vh - 140px) !important;
            overflow-y: auto !important;
            gap: 15px !important;
          }
          .tactics-pitch-column {
            flex: none !important;
            width: 100% !important;
            min-width: 0 !important;
            height: 440px !important;
          }
          .tactics-bench-column {
            flex: none !important;
            width: 100% !important;
            min-width: 0 !important;
            height: 280px !important;
          }
          .tactics-reserves-column {
            flex: none !important;
            width: 100% !important;
            min-width: 0 !important;
            height: 340px !important;
          }
        }
        .cm-squad-row {
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .cm-squad-row:hover {
          background: rgba(0, 255, 100, 0.08) !important;
        }
        .cm-slot-btn:hover {
          filter: brightness(1.2);
          transform: scale(1.05);
        }
        .cm-pos-btn:hover {
          filter: brightness(1.25);
          border-color: #00ff64 !important;
          box-shadow: 0 0 8px rgba(0, 255, 100, 0.4) !important;
        }
        @media (max-width: 900px) {
          .cm-traditional-columns {
            flex-direction: column !important;
          }
        }
      `}</style>
      <div className="glass-card animated-slide-in tactics-modal-card" style={{
        width: '100%',
        maxWidth: '1200px',
        background: 'linear-gradient(135deg, rgba(22, 22, 28, 0.98), rgba(12, 12, 16, 0.99))',
        border: '2px solid rgba(0, 255, 100, 0.15)',
        borderRadius: '16px',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.7), 0 0 30px rgba(0, 255, 100, 0.06)',
        maxHeight: '92vh',
        transition: 'max-width 0.3s ease'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="glowing-header-text" style={{
            fontSize: '20px',
            margin: 0,
            color: '#00ff64',
            fontFamily: 'Orbitron',
            letterSpacing: '2px'
          }}>
            ⚽ TACTICS
          </h2>
          {!inline && (
            <button
              onClick={handleClose}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                color: '#aaa',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontFamily: 'Orbitron'
              }}
            >
              CLOSE ➔
            </button>
          )}
        </div>

        {/* Tab Selection */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '5px'
        }}>
          <button
            onClick={() => setActiveTab("tactics")}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === "tactics" ? '3px solid #00ff64' : '3px solid transparent',
              color: activeTab === "tactics" ? '#00ff64' : '#888',
              fontFamily: 'Orbitron',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '10px 0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '1px'
            }}
          >
            🛡️ TACTICS
          </button>
          <button
            onClick={() => setActiveTab("squad")}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === "squad" ? '3px solid #00ff64' : '3px solid transparent',
              color: activeTab === "squad" ? '#00ff64' : '#888',
              fontFamily: 'Orbitron',
              fontSize: '12px',
              fontWeight: 'bold',
              padding: '10px 0',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '1px'
            }}
          >
            📋 SQUAD
          </button>
        </div>

        {activeTab === "squad" ? (
          /* SQUAD TAB: CM 01/02 TRADITIONAL SQUAD VIEW */
          (() => {
            const sortedSquad = sortedSquadForTraditionalView;
            const halfCount = Math.ceil(sortedSquad.length / 2);
            const col1 = sortedSquad.slice(0, halfCount);
            const col2 = sortedSquad.slice(halfCount);
            const startingCount = Object.values(lineup).filter(Boolean).length;

            return (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '490px',
                background: '#091512',
                borderRadius: '12px',
                border: '1.5px solid rgba(0, 255, 100, 0.25)',
                boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.85)',
                overflow: 'hidden'
              }}>
                {/* Traditional View Top Header Bar */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 14px',
                  background: 'rgba(0,0,0,0.45)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontFamily: 'Orbitron',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: '#ffd700',
                      letterSpacing: '1px',
                      textShadow: '0 0 8px rgba(255, 215, 0, 0.4)'
                    }}>
                      Players (Traditional View)
                    </span>
                    <span style={{ fontSize: '9.5px', color: '#888', fontFamily: 'Orbitron' }}>
                      XI: <strong style={{ color: startingCount === 11 ? '#00ff64' : '#ffd700' }}>{startingCount}/11</strong> •{' '}
                      Subs: <strong style={{ color: '#00e5ff' }}>{selectedBenchNames.length}/{limit >= 99 ? 'ALL' : limit}</strong> •{' '}
                      Reserves: <strong style={{ color: '#aaa' }}>{reservePlayers.length}</strong>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Formation Selector Button (Opens Formation Picker Modal) */}
                    <button
                      type="button"
                      onClick={() => setShowFormationModal(true)}
                      style={{
                        background: 'rgba(0, 255, 100, 0.1)',
                        border: '1.5px solid rgba(0, 255, 100, 0.4)',
                        borderRadius: '5px',
                        color: '#00ff64',
                        fontFamily: 'Orbitron',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '4px 9px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 0 8px rgba(0, 255, 100, 0.15)',
                        transition: 'all 0.2s ease'
                      }}
                      title="Click to change team formation"
                    >
                      <span>⚽ {selectedFormation}</span>
                      <span style={{ fontSize: '8px', color: '#00ff64' }}>▼</span>
                    </button>

                    {/* Auto-select Best 11 */}
                    <button
                      type="button"
                      onClick={handleAutoFill}
                      style={{
                        background: 'rgba(0, 255, 100, 0.08)',
                        border: '1px solid rgba(0, 255, 100, 0.35)',
                        borderRadius: '5px',
                        color: '#00ff64',
                        fontFamily: 'Orbitron',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        cursor: 'pointer'
                      }}
                      title="Auto-select highest rated players into formation"
                    >
                      ⚡ AUTO-SELECT
                    </button>

                    {/* Clear All */}
                    <button
                      type="button"
                      onClick={handleClearAll}
                      style={{
                        background: 'rgba(255, 69, 0, 0.08)',
                        border: '1px solid rgba(255, 69, 0, 0.35)',
                        borderRadius: '5px',
                        color: '#ff4500',
                        fontFamily: 'Orbitron',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        cursor: 'pointer'
                      }}
                      title="Clear starting lineup"
                    >
                      ✕ CLEAR
                    </button>

                    {/* Sort Order Selector */}
                    <select
                      value={squadSortMode}
                      onChange={(e) => setSquadSortMode(e.target.value)}
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '5px',
                        color: '#ffd700',
                        fontFamily: 'Orbitron',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                      title="Sort squad display order"
                    >
                      <option value="default" style={{ background: '#121217', color: '#fff' }}>SORT: XI → SUBS → SQUAD</option>
                      <option value="position" style={{ background: '#121217', color: '#fff' }}>SORT: BY POSITION</option>
                      <option value="rating" style={{ background: '#121217', color: '#fff' }}>SORT: BY RATING</option>
                      <option value="name" style={{ background: '#121217', color: '#fff' }}>SORT: BY NAME</option>
                    </select>

                    {/* Switch to Pitch */}
                    <button
                      type="button"
                      onClick={() => setActiveTab('tactics')}
                      style={{
                        background: 'rgba(0, 229, 255, 0.1)',
                        border: '1px solid rgba(0, 229, 255, 0.4)',
                        borderRadius: '5px',
                        color: '#00e5ff',
                        fontFamily: 'Orbitron',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '4px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      🛡️ PITCH VIEW
                    </button>
                  </div>
                </div>

                {/* Banner prompts when assigning */}
                {activeAssignSlot && (
                  <div style={{
                    background: 'rgba(0, 255, 100, 0.15)',
                    borderBottom: '1px solid rgba(0, 255, 100, 0.4)',
                    padding: '3px 14px',
                    fontSize: '9.5px',
                    color: '#00ff64',
                    fontFamily: 'Orbitron',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>👉 Click any player below to assign them to position <strong>[{activeAssignSlot.label}]</strong></span>
                    <button
                      type="button"
                      onClick={() => setActiveAssignSlot(null)}
                      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '9px' }}
                    >
                      ✕ CANCEL
                    </button>
                  </div>
                )}

                {selectedRosterPlayer && !activeAssignSlot && (
                  <div style={{
                    background: 'rgba(0, 229, 255, 0.12)',
                    borderBottom: '1px solid rgba(0, 229, 255, 0.4)',
                    padding: '3px 14px',
                    fontSize: '9.5px',
                    color: '#00e5ff',
                    fontFamily: 'Orbitron',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>👉 Selected <strong>{selectedRosterPlayer.name}</strong> ({getPlayerFullPositions(selectedRosterPlayer)}): Click a slot in the bottom "Positions" bar to place them</span>
                    <button
                      type="button"
                      onClick={() => setSelectedRosterPlayer(null)}
                      style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Orbitron', fontSize: '9px' }}
                    >
                      ✕ DESELECT
                    </button>
                  </div>
                )}

                {/* 2-Column Continuous Squad Layout (CM 01/02 Classic) */}
                <div className="cm-traditional-columns" style={{
                  flex: 1,
                  display: 'flex',
                  gap: '8px',
                  padding: '6px 10px',
                  overflowY: 'auto',
                  background: 'linear-gradient(180deg, rgba(8, 20, 16, 0.6) 0%, rgba(6, 14, 12, 0.9) 100%)'
                }}>
                  {loading ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '11px', fontFamily: 'Orbitron' }}>
                      Loading squad...
                    </div>
                  ) : sortedSquad.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '11px' }}>
                      No players found in squad.
                    </div>
                  ) : (
                    <>
                      {/* Column 1 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {col1.map((player, idx) => renderTraditionalPlayerRow(player, idx))}
                      </div>

                      {/* Column 2 */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {col2.map((player, idx) => renderTraditionalPlayerRow(player, idx + col1.length))}
                      </div>
                    </>
                  )}
                </div>

                {/* Bottom "Positions" Bar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  background: 'rgba(0,0,0,0.65)',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  overflowX: 'auto',
                  flexShrink: 0
                }}>
                  <span style={{
                    fontFamily: 'Orbitron',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#ffd700',
                    letterSpacing: '1px',
                    flexShrink: 0,
                    marginRight: '4px'
                  }}>
                    Positions
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto', padding: '2px 0' }}>
                    {/* Starting Slots */}
                    {slots.map(slot => {
                      const idealPos = getIdealSlotPosition(slot.role, slot.x, slot.y);
                      const occupant = lineup[slot.id];
                      const isActiveSlot = activeAssignSlot && activeAssignSlot.type === 'starting' && activeAssignSlot.id === slot.id;

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => handleBottomSlotClick({ type: 'starting', id: slot.id, label: idealPos })}
                          className="cm-pos-btn"
                          style={{
                            minWidth: '32px',
                            height: '24px',
                            padding: '0 5px',
                            borderRadius: '4px',
                            background: isActiveSlot
                              ? 'rgba(0, 255, 100, 0.35)'
                              : (occupant ? 'linear-gradient(180deg, #1e5799 0%, #207cca 40%, #155799 100%)' : 'rgba(255,255,255,0.05)'),
                            border: isActiveSlot
                              ? '1.5px solid #00ff64'
                              : (occupant ? '1px solid #64b5f6' : '1px solid rgba(255,255,255,0.15)'),
                            color: isActiveSlot ? '#00ff64' : '#ffffff',
                            fontFamily: 'Orbitron',
                            fontSize: '8.5px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            flexShrink: 0,
                            boxShadow: isActiveSlot ? '0 0 8px rgba(0, 255, 100, 0.4)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                          title={`${idealPos}: ${occupant ? occupant.name : 'Empty'}`}
                        >
                          {idealPos}
                        </button>
                      );
                    })}

                    <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 4px', flexShrink: 0 }} />

                    {/* Bench Slots */}
                    {Array.from({ length: Math.min(limit, 7) }).map((_, bIdx) => {
                      const occupantName = selectedBenchNames[bIdx];
                      const occupant = occupantName ? squad.find(p => p.name === occupantName) : null;
                      const isActiveSlot = activeAssignSlot && activeAssignSlot.type === 'bench' && activeAssignSlot.index === bIdx;

                      return (
                        <button
                          key={bIdx}
                          type="button"
                          onClick={() => handleBottomSlotClick({ type: 'bench', index: bIdx, label: `S${bIdx + 1}` })}
                          className="cm-pos-btn"
                          style={{
                            minWidth: '30px',
                            height: '24px',
                            padding: '0 5px',
                            borderRadius: '4px',
                            background: isActiveSlot
                              ? 'rgba(0, 229, 255, 0.35)'
                              : (occupant ? 'linear-gradient(180deg, #0288d1 0%, #01579b 100%)' : 'rgba(255,255,255,0.05)'),
                            border: isActiveSlot
                              ? '1.5px solid #00e5ff'
                              : (occupant ? '1px solid #4fc3f7' : '1px solid rgba(255,255,255,0.15)'),
                            color: isActiveSlot ? '#00e5ff' : '#e1f5fe',
                            fontFamily: 'Orbitron',
                            fontSize: '8.5px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            flexShrink: 0,
                            boxShadow: isActiveSlot ? '0 0 8px rgba(0, 229, 255, 0.4)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                          title={`S${bIdx + 1}: ${occupant ? occupant.name : 'Empty'}`}
                        >
                          S{bIdx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          /* TACTICS TAB CONTENT: 3-COLUMN MODERN LAYOUT (PITCH | SUBS | RESERVES) */
          (() => {
            const limit = getSubstituteLimit(teamInfo.cupId, teamInfo.season, teamInfo.country);
            return (
              <div className="tactics-container" style={{
                display: 'flex',
                gap: '12px',
                height: '490px',
                overflow: 'hidden'
              }}>
                {/* Column 1: Interactive Pitch */}
                <div className="tactics-pitch-column" style={{
                  flex: 1.15,
                  minWidth: '450px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  height: '100%'
                }}>
                  {/* Quick Settings Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 10px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: '#888', fontFamily: 'Orbitron' }}>FORMATION:</span>
                      <button
                        type="button"
                        onClick={() => setShowFormationModal(true)}
                        style={{
                          background: 'rgba(0, 255, 100, 0.1)',
                          border: '1.5px solid rgba(0, 255, 100, 0.4)',
                          borderRadius: '6px',
                          color: '#00ff64',
                          fontFamily: 'Orbitron',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          padding: '3px 10px',
                          outline: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 0 10px rgba(0, 255, 100, 0.15)',
                          transition: 'all 0.2s ease'
                        }}
                        title="Click to select team formation"
                      >
                        <span>⚽ {selectedFormation}</span>
                        {FORMATIONS[selectedFormation]?.era && (
                          <span style={{ fontSize: '8.5px', color: '#ffd700', opacity: 0.85 }}>
                            ({FORMATIONS[selectedFormation].era})
                          </span>
                        )}
                        <span style={{ fontSize: '8.5px', color: '#00ff64', marginLeft: '2px' }}>▼ CHANGE</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleAutoFill}
                        style={{
                          background: 'rgba(0, 255, 100, 0.1)',
                          border: '1px solid rgba(0, 255, 100, 0.4)',
                          borderRadius: '4px',
                          color: '#00ff64',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          fontFamily: 'Orbitron',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        title="Automatically fill empty slots with highest rated players"
                      >
                        ⚡ AUTO-FILL
                      </button>
                      <button
                        onClick={handleClearAll}
                        style={{
                          background: 'rgba(255, 69, 0, 0.05)',
                          border: '1px solid rgba(255, 69, 0, 0.3)',
                          borderRadius: '4px',
                          color: '#ff4500',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          fontFamily: 'Orbitron',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        ✕ CLEAR
                      </button>
                    </div>
                  </div>

                  {/* Live Tactical Department Ratings Bar */}
                  {(() => {
                    const liveStats = calculateTeamTacticalStats(lineup, selectedFormation, playerRoles, 'balanced');
                    return (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 10px',
                        background: 'rgba(0, 255, 100, 0.04)',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 255, 100, 0.15)',
                        fontSize: '9.5px',
                        fontFamily: 'Orbitron'
                      }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ color: '#00e5ff', fontWeight: 'bold' }} title={`Defense Sum: ${liveStats.defSum} ÷ 4 = ${(liveStats.defSum / 4).toFixed(2)}`}>
                            🛡️ DEF: {liveStats.defense} <span style={{ fontSize: '7.5px', opacity: 0.7 }}>({liveStats.defSum}÷4)</span>
                          </span>
                          <span style={{ color: '#00ff64', fontWeight: 'bold' }} title={`Midfield Sum: ${liveStats.midSum} ÷ 4 = ${(liveStats.midSum / 4).toFixed(2)}`}>
                            ⚙️ MID: {liveStats.midfield} <span style={{ fontSize: '7.5px', opacity: 0.7 }}>({liveStats.midSum}÷4)</span>
                          </span>
                          <span style={{ color: '#ff4500', fontWeight: 'bold' }} title={`Attack Sum: ${liveStats.attSum} ÷ 2 = ${(liveStats.attSum / 2).toFixed(2)}`}>
                            ⚔️ ATT: {liveStats.attack} <span style={{ fontSize: '7.5px', opacity: 0.7 }}>({liveStats.attSum}÷2)</span>
                          </span>
                        </div>
                        <span style={{ fontSize: '7.5px', color: '#ffd700', opacity: 0.85 }}>
                          CLICK ROLE BADGE TO CHANGE DUTY
                        </span>
                      </div>
                    );
                  })()}

                  {/* CSS Interactive Field with Enlarged, High-Legibility Boxes */}
                  <div style={{
                    flexGrow: 1,
                    position: 'relative',
                    background: '#0a4a1a',
                    backgroundImage: 'radial-gradient(rgba(0, 255, 100, 0.15) 1.5px, transparent 1.5px), radial-gradient(rgba(0, 255, 100, 0.15) 1.5px, #0a4a1a 1.5px)',
                    backgroundSize: '30px 30px',
                    backgroundPosition: '0 0, 15px 15px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)',
                    overflow: 'hidden'
                  }}>
                    {/* Field lines representation */}
                    <div style={{ position: 'absolute', top: '4%', bottom: '4%', left: '4%', right: '4%', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '4%', right: '4%', height: '1px', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '60px', height: '60px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />

                    {/* Penalty Areas */}
                    <div style={{ position: 'absolute', top: '4%', left: '25%', right: '25%', height: '12%', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: '4%', left: '25%', right: '25%', height: '12%', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', pointerEvents: 'none' }} />

                    {/* Pitch Slots */}
                    {slots.map(slot => {
                      const assignedPlayer = lineup[slot.id];
                      const idealPos = getIdealSlotPosition(slot.role, slot.x, slot.y);
                      const slotWithPos = { ...slot, idealPos };
                      const roleMeta = assignedPlayer ? getRoleMetadata(slotWithPos, assignedPlayer, playerRoles[slot.id] || 'normal') : null;

                      let displayRating = 1;
                      let penalty = 0;
                      let penaltyTitle = "";
                      if (assignedPlayer) {
                        penalty = getPositionPenalty(assignedPlayer.positions || [assignedPlayer.position], idealPos);
                        const reduction = (assignedPlayer.condition < 80 ? 1 : 0) + penalty;
                        displayRating = Math.max(1, assignedPlayer.rating - reduction);

                        if (penalty > 0) {
                          penaltyTitle = `Skill reduced by ${penalty} for playing out of position (Ideal: ${idealPos}, Plays: ${(assignedPlayer.positions || [assignedPlayer.position]).join(', ')})`;
                        }
                        if (assignedPlayer.condition < 80) {
                          penaltyTitle += (penaltyTitle ? " & " : "") + "Rating reduced by 1 due to low condition (<80%)";
                        }
                      }

                      return (
                        <div
                          key={slot.id}
                          onDragOver={(e) => handleDragOver(e, slot.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, slot.id)}
                          style={{
                            position: 'absolute',
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            transform: 'translate(-50%, -50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            zIndex: 10
                          }}
                        >
                          {assignedPlayer ? (
                            <div
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, assignedPlayer, slot.id)}
                              onClick={() => handlePitchSlotClick(slot.id)}
                              className="pitch-slot-container"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                background: 'rgba(12, 12, 16, 0.95)',
                                border: `1.5px solid ${roleMeta && roleMeta.id !== 'normal' ? roleMeta.color : getPositionColor(assignedPlayer.position)}`,
                                borderRadius: '8px',
                                padding: '3px 7px',
                                minWidth: '80px',
                                cursor: 'grab',
                                boxShadow: `0 4px 12px rgba(0,0,0,0.6), 0 0 10px ${(roleMeta && roleMeta.id !== 'normal' ? roleMeta.color : getPositionColor(assignedPlayer.position))}33`,
                                animation: 'scaleIn 0.2s ease',
                                transition: 'transform 0.15s ease'
                              }}
                              title="Click card to remove from lineup, or click role badge below to change tactical duty"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                                <span style={{
                                  fontSize: '8px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: getPositionColor(assignedPlayer.position)
                                }}>
                                  {assignedPlayer.position}
                                </span>
                                <span style={{
                                  fontSize: '8px',
                                  fontWeight: 'bold',
                                  color: (assignedPlayer.condition < 80 || penalty > 0) ? '#ffa500' : '#00ff64',
                                  fontFamily: 'Orbitron'
                                }} title={penaltyTitle}>
                                  ★{displayRating}
                                </span>
                                <span style={{
                                  fontSize: '7.5px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: assignedPlayer.suspensionMatchesLeft > 0 ? '#ff4d6d' : (assignedPlayer.injuryMatchesLeft > 0 ? '#ff3333' : (assignedPlayer.condition < 60 ? '#ff3333' : (assignedPlayer.condition < 80 ? '#ffa500' : '#00ff64'))),
                                  background: assignedPlayer.suspensionMatchesLeft > 0 ? 'rgba(255, 46, 76, 0.2)' : 'rgba(0,0,0,0.4)',
                                  padding: '0.5px 3px',
                                  borderRadius: '3px',
                                  border: `1px solid ${assignedPlayer.suspensionMatchesLeft > 0 ? '#ff2e4c' : (assignedPlayer.injuryMatchesLeft > 0 ? '#ff333344' : (assignedPlayer.condition < 80 ? '#ffa50044' : '#00ff6433'))}`,
                                  flexShrink: 0
                                }} title={assignedPlayer.suspensionMatchesLeft > 0 ? `Suspended: ${assignedPlayer.suspensionReason || 'Ban'} (${assignedPlayer.suspensionMatchesLeft}m)` : (assignedPlayer.injuryMatchesLeft > 0 ? `Injured: ${assignedPlayer.injury || 'Unknown'}` : `Condition: ${assignedPlayer.condition !== undefined ? assignedPlayer.condition : 100}%`)}>
                                  {assignedPlayer.suspensionMatchesLeft > 0 ? `🟥${assignedPlayer.suspensionMatchesLeft}m` : (assignedPlayer.injuryMatchesLeft > 0 ? `🤕${assignedPlayer.injuryMatchesLeft}m` : `⚡${assignedPlayer.condition !== undefined ? assignedPlayer.condition : 100}%`)}
                                </span>
                              </div>
                              <span className="pitch-slot-name" style={{
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#fff',
                                maxWidth: '88px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                marginTop: '1px',
                                marginBottom: '1px',
                                textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                              }}>
                                {getLastName(assignedPlayer.name)}
                              </span>
                              {slot.role !== 'gk' && roleMeta && (
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleSlotRole(e, slotWithPos, assignedPlayer)}
                                  style={{
                                    marginTop: '1px',
                                    padding: '1.5px 6px',
                                    borderRadius: '4px',
                                    border: `1px solid ${roleMeta.color}88`,
                                    background: roleMeta.id === 'normal' ? 'rgba(255,255,255,0.06)' : `${roleMeta.color}25`,
                                    color: roleMeta.color,
                                    fontSize: '7.5px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Orbitron',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1.2
                                  }}
                                  title={`${roleMeta.label}: ${roleMeta.desc} (Click to toggle)`}
                                >
                                  {roleMeta.shortLabel} ↻
                                </button>
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => handlePitchSlotClick(slot.id)}
                              className={`pitch-slot-empty ${selectedRosterPlayer ? 'pitch-slot-empty-target' : ''}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                border: dragOverSlotId === slot.id ? '2px dashed #00ff64' : '1.5px dashed rgba(255,255,255,0.25)',
                                background: dragOverSlotId === slot.id ? 'rgba(0, 255, 100, 0.12)' : 'rgba(0, 0, 0, 0.4)',
                                color: dragOverSlotId === slot.id ? '#00ff64' : '#888',
                                transition: 'all 0.2s ease',
                                boxShadow: dragOverSlotId === slot.id ? '0 0 10px rgba(0,255,100,0.3)' : 'none'
                              }}>
                              <span style={{ fontSize: '9px', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                                {slot.role.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Column 2: Substitutes (Bench Slots next to Field) */}
                <div className="tactics-bench-column" style={{
                  flex: 1,
                  minWidth: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '10px 12px',
                  height: '100%',
                  overflow: 'hidden'
                }}>
                  <div className="bench-header" style={{
                    fontFamily: 'Orbitron',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#00e5ff',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    paddingBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>SUBS ({selectedBenchNames.length}/{limit >= 99 ? 'ALL' : limit})</span>
                    <span style={{ fontSize: '7.5px', color: '#888' }}>CLICK × TO REMOVE</span>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedPlayer && !isAssigned(draggedPlayer) && !selectedBenchNames.includes(draggedPlayer.name)) {
                        setDragOverSlotId('bench-zone');
                      }
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={handleBenchDrop}
                    style={{
                      flexGrow: 1,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      paddingRight: '2px'
                    }}
                  >
                    {limit >= 99 && (
                      <div style={{
                        padding: '6px 8px',
                        background: 'rgba(0, 229, 255, 0.06)',
                        border: '1px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: '6px',
                        color: '#00e5ff',
                        fontSize: '8px',
                        fontFamily: 'Orbitron',
                        textAlign: 'center',
                        lineHeight: '1.3',
                        letterSpacing: '0.5px',
                        flexShrink: 0
                      }}>
                        ALL SQUAD RESERVES ELIGIBLE AS SUBS ({selectedBenchNames.length})
                      </div>
                    )}

                    {limit >= 99 ? (
                      selectedBenchNames.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          color: '#666',
                          fontSize: '10.5px',
                          padding: '30px 10px',
                          fontStyle: 'italic'
                        }}>
                          No substitutes on bench. All players are in starting XI or removed.
                        </div>
                      ) : (
                        selectedBenchNames.map((playerName, index) => {
                          const player = squad.find(p => p.name === playerName);
                          if (!player) return null;
                          const isSelected = selectedRosterPlayer && selectedRosterPlayer.name === player.name;

                          return (
                            <div
                              key={player.name || index}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, player)}
                              onClick={() => handleRosterPlayerClick(player)}
                              className={`roster-item ${isSelected ? 'selected-roster-player' : ''}`}
                              style={{
                                height: '40px',
                                border: isSelected
                                  ? '1.5px solid #00ff64'
                                  : '1px solid rgba(0, 229, 255, 0.35)',
                                background: isSelected
                                  ? 'rgba(0, 255, 100, 0.12)'
                                  : 'rgba(0, 229, 255, 0.04)',
                                borderRadius: '7px',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 8px',
                                gap: '6px',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                userSelect: 'none',
                                transition: 'all 0.15s ease',
                                flexShrink: 0
                              }}
                              title="Click to select for field slot, or drag to pitch (Click × to remove from bench)"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1, minWidth: 0, marginRight: '6px' }}>
                                <span style={{
                                  fontSize: '7.5px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: '#00e5ff',
                                  background: 'rgba(0, 229, 255, 0.15)',
                                  padding: '1.5px 3.5px',
                                  borderRadius: '3px',
                                  flexShrink: 0
                                }}>
                                  S{index + 1}
                                </span>
                                <span className="roster-player-position" style={{
                                  fontSize: '8px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: getPositionColor(player.position),
                                  background: 'rgba(0,0,0,0.3)',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  border: `1px solid ${getPositionColor(player.position)}33`,
                                  flexShrink: 0
                                }} title={`Plays positions: ${(player.positions || [player.position]).join(', ')}`}>
                                  {player.position}{player.positions && player.positions.length > 1 ? '+' : ''}
                                </span>
                                <span className="roster-player-name" style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  color: '#fff',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: 'left'
                                }} title={player.name}>
                                  {player.name}
                                </span>
                                {renderSeasonCardPills(player)}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <span style={{ fontSize: '8.5px', color: '#888' }}>Age {player.age || 25}</span>

                                {/* Condition / Injury / Suspension */}
                                {renderBenchReserveStatusBadge(player)}

                                {/* Star Rating */}
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: player.condition < 80 && player.injuryMatchesLeft === 0 ? '#ffa500' : '#00ff64',
                                  background: player.condition < 80 && player.injuryMatchesLeft === 0 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(0, 255, 100, 0.05)',
                                  padding: '1px 3px',
                                  borderRadius: '3px',
                                  border: player.condition < 80 && player.injuryMatchesLeft === 0 ? '1px solid rgba(255, 165, 0, 0.25)' : '1px solid rgba(0, 255, 100, 0.15)'
                                }}>
                                  ★{player.condition < 80 && player.injuryMatchesLeft === 0 ? Math.max(1, player.rating - 1) : player.rating}
                                </span>

                                {/* Remove Button */}
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBenchSlotClick(player);
                                  }}
                                  style={{
                                    fontSize: '13px',
                                    color: '#ff4444',
                                    fontWeight: 'bold',
                                    padding: '0 2px',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                    lineHeight: 1
                                  }}
                                  title="Remove from bench"
                                >
                                  ×
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )
                    ) : (
                      Array.from({ length: limit }).map((_, index) => {
                        const playerName = selectedBenchNames[index];
                        const player = playerName ? squad.find(p => p.name === playerName) : null;
                        const isSelected = player && selectedRosterPlayer && selectedRosterPlayer.name === player.name;

                        return (
                          <div
                            key={index}
                            draggable={!!player}
                            onDragStart={(e) => {
                              if (player) handleDragStart(e, player);
                            }}
                            onClick={() => {
                              if (player) {
                                handleRosterPlayerClick(player);
                              } else {
                                handleBenchSlotClick(null);
                              }
                            }}
                            className={`roster-item ${isSelected ? 'selected-roster-player' : ''}`}
                            style={{
                              height: '40px',
                              border: player
                                ? (isSelected ? '1.5px solid #00ff64' : '1px solid rgba(0, 229, 255, 0.35)')
                                : (selectedRosterPlayer && !isAssigned(selectedRosterPlayer) ? '1.5px dashed #00ff64' : '1px dashed rgba(255,255,255,0.12)'),
                              background: player
                                ? (isSelected ? 'rgba(0, 255, 100, 0.12)' : 'rgba(0, 229, 255, 0.04)')
                                : (selectedRosterPlayer && !isAssigned(selectedRosterPlayer) ? 'rgba(0, 255, 100, 0.04)' : 'rgba(0,0,0,0.25)'),
                              borderRadius: '7px',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 8px',
                              gap: '6px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              userSelect: 'none',
                              transition: 'all 0.15s ease',
                              flexShrink: 0
                            }}
                            title={player ? "Click to select for field slot, or drag to pitch (Click × to remove from bench)" : "Click to place selected player or drag here"}
                          >
                            {player ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1, minWidth: 0, marginRight: '6px' }}>
                                  <span style={{
                                    fontSize: '7.5px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Orbitron',
                                    color: '#00e5ff',
                                    background: 'rgba(0, 229, 255, 0.15)',
                                    padding: '1.5px 3.5px',
                                    borderRadius: '3px',
                                    flexShrink: 0
                                  }}>
                                    S{index + 1}
                                  </span>
                                  <span className="roster-player-position" style={{
                                    fontSize: '8px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Orbitron',
                                    color: getPositionColor(player.position),
                                    background: 'rgba(0,0,0,0.3)',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    border: `1px solid ${getPositionColor(player.position)}33`,
                                    flexShrink: 0
                                  }} title={`Plays positions: ${(player.positions || [player.position]).join(', ')}`}>
                                    {player.position}{player.positions && player.positions.length > 1 ? '+' : ''}
                                  </span>
                                  <span className="roster-player-name" style={{
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: '#fff',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    flex: 1,
                                    minWidth: 0,
                                    textAlign: 'left'
                                  }} title={player.name}>
                                    {player.name}
                                  </span>
                                  {renderSeasonCardPills(player)}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '8.5px', color: '#888' }}>Age {player.age || 25}</span>

                                  {/* Condition / Injury / Suspension */}
                                  {renderBenchReserveStatusBadge(player)}

                                  {/* Star Rating */}
                                  <span style={{
                                    fontSize: '9.5px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Orbitron',
                                    color: player.condition < 80 && player.injuryMatchesLeft === 0 ? '#ffa500' : '#00ff64',
                                    background: player.condition < 80 && player.injuryMatchesLeft === 0 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(0, 255, 100, 0.05)',
                                    padding: '1px 3px',
                                    borderRadius: '3px',
                                    border: player.condition < 80 && player.injuryMatchesLeft === 0 ? '1px solid rgba(255, 165, 0, 0.25)' : '1px solid rgba(0, 255, 100, 0.15)'
                                  }}>
                                    ★{player.condition < 80 && player.injuryMatchesLeft === 0 ? Math.max(1, player.rating - 1) : player.rating}
                                  </span>

                                  {/* Remove Button */}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBenchSlotClick(player);
                                    }}
                                    style={{
                                      fontSize: '13px',
                                      color: '#ff4444',
                                      fontWeight: 'bold',
                                      padding: '0 2px',
                                      cursor: 'pointer',
                                      flexShrink: 0,
                                      lineHeight: 1
                                    }}
                                    title="Remove from bench"
                                  >
                                    ×
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                <span style={{
                                  fontSize: '7.5px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: '#666',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  padding: '1.5px 4px',
                                  borderRadius: '3px',
                                  flexShrink: 0
                                }}>
                                  S{index + 1}
                                </span>
                                <span style={{
                                  fontSize: '9px',
                                  color: selectedRosterPlayer && !isAssigned(selectedRosterPlayer) ? '#00ff64' : '#666',
                                  fontFamily: 'Orbitron',
                                  fontStyle: 'italic',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {selectedRosterPlayer && !isAssigned(selectedRosterPlayer) ? `+ Place as Sub ${index + 1}` : `+ Empty Sub ${index + 1}`}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Column 3: Reserves (Squad Players) */}
                <div className="tactics-reserves-column" style={{
                  flex: 1,
                  minWidth: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '10px 12px',
                  height: '100%',
                  overflow: 'hidden'
                }}>
                  {/* Reserves Header with Filter Toggle */}
                  <div className="roster-header" style={{
                    fontFamily: 'Orbitron',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#ffd700',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    paddingBottom: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setRosterViewFilter('reserves')}
                        style={{
                          background: rosterViewFilter === 'reserves' ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                          border: rosterViewFilter === 'reserves' ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                          color: rosterViewFilter === 'reserves' ? '#ffd700' : '#888',
                          fontSize: '9px',
                          fontFamily: 'Orbitron',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        RESERVES ({reservePlayers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRosterViewFilter('all')}
                        style={{
                          background: rosterViewFilter === 'all' ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
                          border: rosterViewFilter === 'all' ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                          color: rosterViewFilter === 'all' ? '#ffd700' : '#888',
                          fontSize: '9px',
                          fontFamily: 'Orbitron',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        ALL ({squad.length})
                      </button>
                    </div>
                    <span style={{ fontSize: '7.5px', color: '#888' }}>DRAG TO FIELD / BENCH</span>
                  </div>

                  {loading ? (
                    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '11px' }}>
                      Loading squad...
                    </div>
                  ) : (
                    <div style={{
                      flexGrow: 1,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      paddingRight: '4px'
                    }}>
                      {displayedSquadPlayers.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          color: '#888',
                          fontSize: '11px',
                          padding: '24px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{ color: '#00e5ff', fontFamily: 'Orbitron', fontSize: '11px', fontWeight: 'bold' }}>
                            ALL SQUAD PLAYERS ARE ON THE BENCH
                          </div>
                          <div style={{ color: '#aaa', fontSize: '10px', lineHeight: '1.4' }}>
                            In modern competitions, all non-starting players are eligible substitutes (see SUBS column).
                          </div>
                          <button
                            type="button"
                            onClick={() => setRosterViewFilter('all')}
                            style={{
                              marginTop: '6px',
                              background: 'rgba(255, 215, 0, 0.1)',
                              border: '1px solid #ffd700',
                              color: '#ffd700',
                              fontSize: '9.5px',
                              fontFamily: 'Orbitron',
                              fontWeight: 'bold',
                              padding: '5px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            VIEW FULL SQUAD ({squad.length})
                          </button>
                        </div>
                      ) : (
                        displayedSquadPlayers.map((player, idx) => {
                          const assigned = isAssigned(player);
                          const isOnBench = selectedBenchNames.includes(player.name);
                          const isSelected = selectedRosterPlayer && selectedRosterPlayer.name === player.name;
                          const benchHasSpace = limit >= 99 || selectedBenchNames.length < limit;

                          return (
                            <div
                              key={player.name || idx}
                              draggable={!assigned}
                              onDragStart={(e) => handleDragStart(e, player)}
                              onClick={() => handleRosterPlayerClick(player)}
                              className={`roster-item ${isSelected ? 'selected-roster-player' : ''}`}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 10px',
                                borderRadius: '7px',
                                background: isSelected
                                  ? 'rgba(0, 255, 100, 0.12)'
                                  : (assigned ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)'),
                                border: isSelected
                                  ? '1.5px solid #00ff64'
                                  : (assigned ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(255,255,255,0.06)'),
                                cursor: assigned ? 'default' : (selectedRosterPlayer ? 'pointer' : 'grab'),
                                opacity: assigned ? 0.45 : 1,
                                transition: 'all 0.15s ease',
                                userSelect: 'none'
                              }}
                              title={assigned ? "In starting lineup" : (isOnBench ? "On bench" : "Drag to field/bench or click to select")}
                            >
                              {/* Left: Position & Full Name */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0, marginRight: '8px' }}>
                                <span className="roster-player-position" style={{
                                  fontSize: '8px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: getPositionColor(player.position),
                                  background: 'rgba(0,0,0,0.3)',
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  border: `1px solid ${getPositionColor(player.position)}33`,
                                  flexShrink: 0
                                }} title={`Plays positions: ${(player.positions || [player.position]).join(', ')}`}>
                                  {player.position}{player.positions && player.positions.length > 1 ? '+' : ''}
                                </span>

                                <span className="roster-player-name" style={{
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  color: '#fff',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  flex: 1,
                                  minWidth: 0,
                                  textAlign: 'left'
                                }} title={player.name}>
                                  {player.name}
                                </span>
                              </div>

                              {/* Right: Badges, Age, Condition, Stars & Quick Action */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {assigned && (
                                  <span style={{
                                    fontSize: '7.5px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Orbitron',
                                    color: '#ffd700',
                                    background: 'rgba(255, 215, 0, 0.12)',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(255, 215, 0, 0.3)'
                                  }}>
                                    XI
                                  </span>
                                )}
                                {isOnBench && (
                                  <span style={{
                                    fontSize: '7.5px',
                                    fontWeight: 'bold',
                                    fontFamily: 'Orbitron',
                                    color: '#00e5ff',
                                    background: 'rgba(0, 229, 255, 0.12)',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(0, 229, 255, 0.3)'
                                  }}>
                                    BENCH
                                  </span>
                                )}
                                <span style={{ fontSize: '9px', color: '#888' }}>Age {player.age}</span>
                                {renderSeasonCardPills(player)}

                                {/* Condition / Injury / Suspension */}
                                {renderBenchReserveStatusBadge(player)}

                                {/* Star Rating */}
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: 'bold',
                                  fontFamily: 'Orbitron',
                                  color: player.condition < 80 && player.injuryMatchesLeft === 0 ? '#ffa500' : '#00ff64',
                                  background: player.condition < 80 && player.injuryMatchesLeft === 0 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(0, 255, 100, 0.05)',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  border: player.condition < 80 && player.injuryMatchesLeft === 0 ? '1px solid rgba(255, 165, 0, 0.25)' : '1px solid rgba(0, 255, 100, 0.15)'
                                }}>
                                  ★{player.condition < 80 && player.injuryMatchesLeft === 0 ? Math.max(1, player.rating - 1) : player.rating}
                                </span>

                                {/* Quick Add to Bench button if not assigned, not on bench, and bench has space */}
                                {!assigned && !isOnBench && benchHasSpace && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleAddPlayerToBench(e, player)}
                                    style={{
                                      background: 'rgba(0, 229, 255, 0.1)',
                                      border: '1px solid rgba(0, 229, 255, 0.4)',
                                      borderRadius: '4px',
                                      color: '#00e5ff',
                                      fontSize: '8px',
                                      fontWeight: 'bold',
                                      fontFamily: 'Orbitron',
                                      padding: '2px 5px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    title="Add to bench"
                                  >
                                    +SUB
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        )}

        {/* Footer close button */}
        <button
          onClick={handleClose}
          className="play-match-btn glowing-btn confirm-btn"
          style={{
            padding: '10px 20px',
            fontSize: '12px',
            fontWeight: 'bold',
            borderColor: '#00ff64',
            color: '#00ff64',
            background: 'rgba(0, 255, 100, 0.05)',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
            letterSpacing: '1px',
            fontFamily: 'Orbitron',
            transition: 'all 0.2s ease',
            marginTop: '5px'
          }}
        >
          CONFIRM & SAVE SETTINGS ✓
        </button>
      </div>

      {/* Formation Selection Modal */}
      {showFormationModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowFormationModal(false)}
        >
          <div
            style={{
              background: '#121217',
              border: '1.5px solid rgba(0, 255, 100, 0.4)',
              borderRadius: '16px',
              maxWidth: '960px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '20px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 30px rgba(0, 255, 100, 0.15)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{
                margin: 0,
                fontFamily: 'Orbitron',
                fontSize: '18px',
                color: '#00ff64',
                letterSpacing: '1.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>⚽ SELECT TEAM FORMATION</span>
              </h3>
              <button
                onClick={() => setShowFormationModal(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  color: '#aaa',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  transition: 'all 0.2s ease'
                }}
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Active Formation Display */}
            <div className="active-formation-display" style={{
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
              background: 'rgba(0, 255, 100, 0.03)',
              border: '1px solid rgba(0, 255, 100, 0.12)',
              borderRadius: '12px',
              padding: '12px 18px'
            }}>
              <div className="active-pitch-wrapper">
                <FormationPitch formation={selectedFormation} isSelected={true} size="normal" />
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                  fontFamily: 'Orbitron',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#00ff64',
                  textShadow: '0 0 10px rgba(0, 255, 100, 0.3)',
                  letterSpacing: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <span>{currentFormation.label}</span>
                  {currentFormation.era && (
                    <span style={{
                      fontSize: '11px',
                      color: '#ffd700',
                      fontFamily: 'Orbitron',
                      fontWeight: 'bold',
                      background: 'rgba(255, 215, 0, 0.1)',
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      letterSpacing: '0.5px',
                      textShadow: 'none'
                    }}>
                      ⏳ {currentFormation.era}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#a3b3a7',
                  lineHeight: '1.4'
                }}>
                  {currentFormation.desc}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 215, 0, 0.08)',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    color: '#ffd700',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    fontFamily: 'Orbitron',
                    letterSpacing: '0.5px'
                  }}>
                    ⚙️ RATINGS FROM PLAYER POSITIONS & ROLES (DEF÷4 • MID÷4 • ATT÷2)
                  </span>
                </div>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '2px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(0, 255, 100, 0.1)',
                  border: '1px solid rgba(0, 255, 100, 0.3)',
                  color: '#00ff64',
                  fontSize: '8.5px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron',
                  letterSpacing: '1px',
                  alignSelf: 'flex-start'
                }}>
                  ✓ ACTIVE FORMATION
                </div>
              </div>
            </div>

            {/* Formation Legend */}
            <div className="formation-legend" style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              padding: '4px 0',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.04)'
            }}>
              {[
                { color: '#ffd700', label: 'GK' },
                { color: '#00e5ff', label: 'DEF' },
                { color: '#00ff64', label: 'MID' },
                { color: '#ff4500', label: 'ATT' }
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '8px',
                  color: '#888',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: item.color,
                    boxShadow: `0 0 4px ${item.color}`
                  }} />
                  {item.label}
                </div>
              ))}
            </div>

            {/* Formation Grid */}
            <div className="formations-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              overflowY: 'auto',
              maxHeight: '44vh',
              paddingRight: '4px'
            }}>
              {formationKeys.map(key => {
                const fm = FORMATIONS[key];
                const isActive = key === selectedFormation;
                const hasModifiers = fm.modifiers.attack !== 0 || fm.modifiers.midfield !== 0 || fm.modifiers.defense !== 0;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      handleSelectFormation(key);
                      setShowFormationModal(false);
                    }}
                    style={{
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(0, 255, 100, 0.12), rgba(0, 255, 100, 0.03))'
                        : 'rgba(255,255,255,0.02)',
                      border: isActive
                        ? '1.5px solid rgba(0, 255, 100, 0.6)'
                        : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '10px',
                      padding: '10px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                      transform: isActive ? 'scale(1.02)' : 'scale(1)',
                      boxShadow: isActive ? '0 0 14px rgba(0, 255, 100, 0.25)' : 'none'
                    }}
                  >
                    <FormationPitch formation={key} isSelected={isActive} size="small" />

                    <span style={{
                      fontFamily: 'Orbitron',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: isActive ? '#00ff64' : '#fff',
                      letterSpacing: '1px'
                    }}>
                      {fm.label}
                    </span>

                    {fm.era && (
                      <span style={{
                        fontSize: '7.5px',
                        color: '#ffd700',
                        fontFamily: 'Orbitron',
                        fontWeight: 'bold',
                        background: 'rgba(255, 215, 0, 0.08)',
                        border: '1px solid rgba(255, 215, 0, 0.25)',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        letterSpacing: '0.5px',
                        textAlign: 'center'
                      }}>
                        ⏳ {fm.era}
                      </span>
                    )}

                    <span style={{
                      fontSize: '8px',
                      color: '#888',
                      textAlign: 'center',
                      lineHeight: '1.3',
                      maxWidth: '120px'
                    }}>
                      {fm.desc}
                    </span>

                    {/* Modifiers info */}
                    <div style={{
                      display: 'flex',
                      gap: '3px',
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                      minHeight: '16px'
                    }}>
                      {hasModifiers ? (
                        <>
                          {fm.modifiers.attack !== 0 && (
                            <span style={{
                              fontSize: '7px',
                              fontWeight: 'bold',
                              color: fm.modifiers.attack > 0 ? '#00ff64' : '#ff3333',
                              fontFamily: 'Orbitron'
                            }}>
                              ATT {fm.modifiers.attack > 0 ? '+' : ''}{fm.modifiers.attack}
                            </span>
                          )}
                          {fm.modifiers.midfield !== 0 && (
                            <span style={{
                              fontSize: '7px',
                              fontWeight: 'bold',
                              color: fm.modifiers.midfield > 0 ? '#00ff64' : '#ff3333',
                              fontFamily: 'Orbitron'
                            }}>
                              MID {fm.modifiers.midfield > 0 ? '+' : ''}{fm.modifiers.midfield}
                            </span>
                          )}
                          {fm.modifiers.defense !== 0 && (
                            <span style={{
                              fontSize: '7px',
                              fontWeight: 'bold',
                              color: fm.modifiers.defense > 0 ? '#00ff64' : '#ff3333',
                              fontFamily: 'Orbitron'
                            }}>
                              DEF {fm.modifiers.defense > 0 ? '+' : ''}{fm.modifiers.defense}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{
                          fontSize: '7px',
                          fontWeight: 'bold',
                          color: '#ffd700',
                          fontFamily: 'Orbitron'
                        }}>
                          STANDARD
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Player Slot Assignment Popover Modal */}
      {assigningPlayerMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setAssigningPlayerMenu(null)}
        >
          <div
            style={{
              background: '#121217',
              border: '1.5px solid rgba(0, 229, 255, 0.4)',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 25px rgba(0, 229, 255, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <div>
                <h4 style={{ margin: 0, fontFamily: 'Orbitron', fontSize: '15px', color: '#00e5ff', letterSpacing: '1px' }}>
                  ASSIGN POSITION
                </h4>
                <div style={{ fontSize: '11px', color: '#fff', marginTop: '3px', fontWeight: 'bold' }}>
                  {assigningPlayerMenu.name} <span style={{ color: '#ffd700', fontSize: '10px' }}>({getPlayerFullPositions(assigningPlayerMenu)} • ★{assigningPlayerMenu.rating})</span>
                </div>
              </div>
              <button
                onClick={() => setAssigningPlayerMenu(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  color: '#aaa',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontFamily: 'Orbitron',
                  fontSize: '10px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Starting XI slots */}
            <div>
              <div style={{ fontSize: '10px', color: '#00ff64', fontFamily: 'Orbitron', fontWeight: 'bold', marginBottom: '6px' }}>
                ⚽ STARTING XI SLOTS ({selectedFormation})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '6px' }}>
                {slots.map(slot => {
                  const idealPos = getIdealSlotPosition(slot.role, slot.x, slot.y);
                  const occupant = lineup[slot.id];
                  const isSelf = occupant && occupant.name === assigningPlayerMenu.name;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => assignPlayerToStartingSlot(assigningPlayerMenu, slot.id)}
                      style={{
                        background: isSelf ? 'rgba(0, 255, 100, 0.2)' : (occupant ? 'rgba(255,255,255,0.04)' : 'rgba(0, 255, 100, 0.05)'),
                        border: isSelf ? '1.5px solid #00ff64' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontFamily: 'Orbitron', fontSize: '10px', fontWeight: 'bold', color: getPositionColor(idealPos) }}>
                        {idealPos} {isSelf ? '✓ (Current)' : ''}
                      </span>
                      <span style={{ fontSize: '9.5px', color: occupant ? '#bbb' : '#666', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {occupant ? occupant.name : '(Empty)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Substitutes */}
            <div>
              <div style={{ fontSize: '10px', color: '#00e5ff', fontFamily: 'Orbitron', fontWeight: 'bold', marginBottom: '6px' }}>
                💺 MATCH BENCH SUBSTITUTES
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '6px' }}>
                {Array.from({ length: Math.min(limit, 7) }).map((_, bIdx) => {
                  const occupantName = selectedBenchNames[bIdx];
                  const isSelf = occupantName === assigningPlayerMenu.name;
                  return (
                    <button
                      key={bIdx}
                      type="button"
                      onClick={() => assignPlayerToBenchSlot(assigningPlayerMenu, bIdx)}
                      style={{
                        background: isSelf ? 'rgba(0, 229, 255, 0.2)' : (occupantName ? 'rgba(255,255,255,0.04)' : 'rgba(0, 229, 255, 0.05)'),
                        border: isSelf ? '1.5px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontFamily: 'Orbitron', fontSize: '10px', fontWeight: 'bold', color: '#00e5ff' }}>
                        S{bIdx + 1} {isSelf ? '✓ (Current)' : ''}
                      </span>
                      <span style={{ fontSize: '9.5px', color: occupantName ? '#bbb' : '#666', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {occupantName || '(Empty)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Unassign / Remove to Reserves */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => handleUnassignPlayer(assigningPlayerMenu)}
                style={{
                  background: 'rgba(255, 69, 0, 0.1)',
                  border: '1px solid rgba(255, 69, 0, 0.4)',
                  borderRadius: '6px',
                  color: '#ff4500',
                  fontFamily: 'Orbitron',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '6px 12px',
                  cursor: 'pointer'
                }}
              >
                ❌ SEND TO RESERVES
              </button>
              <button
                type="button"
                onClick={() => setAssigningPlayerMenu(null)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '6px',
                  color: '#aaa',
                  fontFamily: 'Orbitron',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '6px 14px',
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
