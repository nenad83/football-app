import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import '../assets/styles/Match.css';
import { applyTeamTheme } from '../utils/themeManager';
import { scaleStatTo10 } from '../data/rosters/rosterRegistry';

// Import Compile-time Databases
import mex86Data from '../data/cups/wc/mex86.json';
import ita90Data from '../data/cups/wc/ita90.json';
import usa94Data from '../data/cups/wc/usa94.json';
import fra84Data from '../data/cups/ec/fra84.json';
import ger88Data from '../data/cups/ec/ger88.json';
import swe92Data from '../data/cups/ec/swe92.json';
import ecu93Data from '../data/cups/cam/ecu93.json';
import uru95Data from '../data/cups/cam/uru95.json';
import fra98Data from '../data/cups/wc/fra98.json';
import eng96Data from '../data/cups/ec/eng96.json';
import nld00Data from '../data/cups/ec/nld00.json';
import korjap02Data from '../data/cups/wc/korjap02.json';
import bol97Data from '../data/cups/cam/bol97.json';
import par99Data from '../data/cups/cam/par99.json';
import por04Data from '../data/cups/ec/por04.json';
import col01Data from '../data/cups/cam/col01.json';
import per04Data from '../data/cups/cam/per04.json';
import ger06Data from '../data/cups/wc/ger06.json';
import aut08Data from '../data/cups/ec/aut08.json';
import polukr12Data from '../data/cups/ec/polukr12.json';
import ven07Data from '../data/cups/cam/ven07.json';
import rsa10Data from '../data/cups/wc/rsa10.json';
import bra14Data from '../data/cups/wc/bra14.json';
import rus18Data from '../data/cups/wc/rus18.json';
import qat22Data from '../data/cups/wc/qat22.json';
import world26Data from '../data/cups/wc/world26.json';
import arg11Data from '../data/cups/cam/arg11.json';
import chl15Data from '../data/cups/cam/chl15.json';
import usa16Data from '../data/cups/cam/usa16.json';
import bra19Data from '../data/cups/cam/bra19.json';
import bra21Data from '../data/cups/cam/bra21.json';
import chi91Data from '../data/cups/cam/chi91.json';
import bra89Data from '../data/cups/cam/bra89.json';
import cop24Data from '../data/cups/cam/cop24.json';
import fra16Data from '../data/cups/ec/fra16.json';
import eur20Data from '../data/cups/ec/eur20.json';
import eur24Data from '../data/cups/ec/eur24.json';

// Reuse our TeamFlag component
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

// Fixture generator for 4-team groups
const generateGroupFixtures = (roster, isWorldCup) => {
  const isWC32 = roster.length === 32;
  const isWC48 = roster.length === 48;
  const isCopaAmerica = roster.length === 12;
  const isEuro16 = roster.length === 16;
  const groups = isWC48
    ? ['A','B','C','D','E','F','G','H','I','J','K','L']
    : (isWC32 
      ? ['A','B','C','D','E','F','G','H'] 
      : (isEuro16 ? ['A','B','C','D'] : (isWorldCup ? ['A','B','C','D','E','F'] : (isCopaAmerica ? ['A','B','C'] : ['A','B']))));
  const fixtures = [];
  const numRounds = (roster[0]?.id === 'bra21' || roster[0]?.id === 'chi91' || roster[0]?.id === 'bra89') ? 5 : 3;
  
  for (let round = 0; round < numRounds; round++) {
    const roundFixtures = [];
    groups.forEach(gLetter => {
      const gTeams = roster.filter(t => t.group === gLetter);
      if (roster[0]?.id === 'eng96' || roster[0]?.id === 'nld00' || roster[0]?.id === 'aut08') {
        if (round === 0) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else if (round === 1) {
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else {
          roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        }
      } else if (roster[0]?.id === 'polukr12') {
        if (gLetter === 'A' || gLetter === 'B' || gLetter === 'C') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'bra14') {
        if (round === 0) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else if (round === 1) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else {
          roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        }
      } else if (roster[0]?.id === 'qat22') {
        // WC 2022 Qatar - accurate match order per group
        if (gLetter === 'A') {
          // A: Qatar(0) Ecuador(1) Senegal(2) Netherlands(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          // B: England(0) Iran(1) USA(2) Wales(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'C') {
          // C: Argentina(0) Saudi Arabia(1) Mexico(2) Poland(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          // D: France(0) Australia(1) Denmark(2) Tunisia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'E') {
          // E: Spain(0) Costa Rica(1) Germany(2) Japan(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'F') {
          // F: Belgium(0) Canada(1) Morocco(2) Croatia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'G') {
          // G: Brazil(0) Serbia(1) Switzerland(2) Cameroon(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'H') {
          // H: Portugal(0) Ghana(1) Uruguay(2) South Korea(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'cop24') {
        // Copa America 2024 - accurate match order per group
        if (gLetter === 'A' || gLetter === 'C') {
          // A: Argentina(0) Peru(1) Chile(2) Canada(3)
          // C: USA(0) Uruguay(1) Panama(2) Bolivia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B' || gLetter === 'D') {
          // B: Mexico(0) Ecuador(1) Venezuela(2) Jamaica(3)
          // D: Brazil(0) Colombia(1) Paraguay(2) Costa Rica(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'rus18') {
        // WC 2018 Russia - accurate match order per group
        if (gLetter === 'A') {
          // A: Russia(0) Saudi(1) Egypt(2) Uruguay(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          // B: Portugal(0) Spain(1) Morocco(2) Iran(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'C') {
          // C: France(0) Australia(1) Peru(2) Denmark(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          // D: Argentina(0) Iceland(1) Croatia(2) Nigeria(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'E') {
          // E: Brazil(0) Switzerland(1) Costa Rica(2) Serbia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'F') {
          // F: Germany(0) Mexico(1) Sweden(2) South Korea(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'G') {
          // G: Belgium(0) Panama(1) Tunisia(2) England(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'H') {
          // H: Poland(0) Senegal(1) Colombia(2) Japan(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'chl15') {
        if (round === 0) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else if (round === 1) {
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else {
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        }
      } else if (roster[0]?.id === 'bra19') {
        if (round === 0) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else if (round === 1) {
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else {
          roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        }
      } else if (roster[0]?.id === 'bra89') {
        // Copa America 1989 Groups A and B
        if (gLetter === 'A') {
          // Paraguay (0), Brazil (1), Colombia (2), Peru (3), Venezuela (4)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 2) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 3) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 4) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          // Argentina (0), Uruguay (1), Chile (2), Ecuador (3), Bolivia (4)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 2) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 3) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 4) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'bra21' || roster[0]?.id === 'chi91') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[4].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 2) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 3) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 4) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 2) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 3) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 4) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[4].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'usa16') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'C') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'fra16') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'eur24') {
        // Euro 2024 - accurate match order per group
        if (gLetter === 'A') {
          // A: Germany(0) Scotland(1) Hungary(2) Switzerland(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          // B: Spain(0) Croatia(1) Italy(2) Albania(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'C') {
          // C: Slovenia(0) Denmark(1) Serbia(2) England(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          // D: Poland(0) Netherlands(1) Austria(2) France(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'E') {
          // E: Belgium(0) Slovakia(1) Romania(2) Ukraine(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'F') {
          // F: Turkey(0) Georgia(1) Portugal(2) Czech Republic(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'eur20') {
        // Euro 2020 - accurate match order per group
        if (gLetter === 'A') {
          // A: Turkey(0) Italy(1) Wales(2) Switzerland(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          // B: Denmark(0) Finland(1) Belgium(2) Russia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'C') {
          // C: Netherlands(0) Ukraine(1) Austria(2) North Macedonia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          // D: England(0) Croatia(1) Scotland(2) Czech Republic(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'E') {
          // E: Spain(0) Sweden(1) Poland(2) Slovakia(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'F') {
          // F: Hungary(0) Portugal(1) France(2) Germany(3)
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'bol97') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'par99') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'col01') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'per04') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'ven07') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else if (roster[0]?.id === 'por04') {
        if (gLetter === 'A') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'B') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'C') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        } else if (gLetter === 'D') {
          if (round === 0) {
            roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else if (round === 1) {
            roundFixtures.push({ homeId: gTeams[3].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          } else {
            roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
            roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[0].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          }
        }
      } else {
        if (round === 0) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[1].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[2].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else if (round === 1) {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        } else {
          roundFixtures.push({ homeId: gTeams[0].idnum, awayId: gTeams[3].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
          roundFixtures.push({ homeId: gTeams[1].idnum, awayId: gTeams[2].idnum, played: false, homeScore: 0, awayScore: 0, group: gLetter });
        }
      }
    });
    fixtures.push(roundFixtures);
  }
  return fixtures;
};

export default function TournamentSelect() {
  const [selectedCup, setSelectedCup] = useState("qat22");
  const [activeTab, setActiveTab] = useState("wc"); // "wc", "ec", "cam"
  const [step, setStep] = useState(1); // 1 = Cup Pick, 2 = Team Select
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [managerName, setManagerName] = useState("Sir Alex");
  
  const navigate = useNavigate();

  const handleImportSave = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        let stateData = null;
        let profileData = null;

        if (importedData.tournamentState) {
          stateData = importedData.tournamentState;
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
        } else if (importedData.cupId && importedData.stage && importedData.teams && importedData.fixtures) {
          stateData = importedData;
        } else {
          throw new Error("Invalid save file format. Missing core tournament parameters.");
        }

        if (importedData.formation) {
          localStorage.setItem('retro_player_formation', importedData.formation);
        }
        localStorage.setItem("retro_tournament_state", JSON.stringify(stateData));

        if (profileData) {
          localStorage.setItem("retro_manager_profile", JSON.stringify(profileData));
        }

        alert("Tournament save successfully imported! Loading dashboard...");
        applyTeamTheme(stateData.teams?.find(t => t.idnum === stateData.playerTeamId));
        navigate("/tournament/dashboard");
      } catch (err) {
        alert("Error importing save file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const getExpectation = (team) => {
    if (!team) return null;
    const avg = (team.attack + team.midfield + team.defense) / 3;
    if (avg >= 4.5) {
      return { text: "Win the Cup!", stage: "winner", desc: "Title Favorites" };
    } else if (avg >= 3.5) {
      return { text: "Reach the Semi-Finals", stage: "semiFinals", desc: "Strong Competitor" };
    } else if (avg >= 2.5) {
      return { text: "Reach the Knockout Stage", stage: "roundOf16", desc: "Respectable Challenger" };
    } else {
      return { text: "Competitive Group Stage", stage: "groups", desc: "Underdog" };
    }
  };


  // Load the correct database
  const getCupData = () => {
    if (selectedCup === "mex86") return mex86Data;
    if (selectedCup === "ita90") return ita90Data;
    if (selectedCup === "usa94") return usa94Data;
    if (selectedCup === "fra84") return fra84Data;
    if (selectedCup === "ger88") return ger88Data;
    if (selectedCup === "swe92") return swe92Data;
    if (selectedCup === "eng96") return eng96Data;
    if (selectedCup === "nld00") return nld00Data;
    if (selectedCup === "por04") return por04Data;
    if (selectedCup === "aut08") return aut08Data;
    if (selectedCup === "polukr12") return polukr12Data;
    if (selectedCup === "fra16") return fra16Data;
    if (selectedCup === "eur20") return eur20Data;
    if (selectedCup === "eur24") return eur24Data;
    if (selectedCup === "ecu93") return ecu93Data;
    if (selectedCup === "uru95") return uru95Data;
    if (selectedCup === "bol97") return bol97Data;
    if (selectedCup === "par99") return par99Data;
    if (selectedCup === "col01") return col01Data;
    if (selectedCup === "per04") return per04Data;
    if (selectedCup === "ven07") return ven07Data;
    if (selectedCup === "arg11") return arg11Data;
    if (selectedCup === "chl15") return chl15Data;
    if (selectedCup === "usa16") return usa16Data;
    if (selectedCup === "bra19") return bra19Data;
    if (selectedCup === "bra21") return bra21Data;
    if (selectedCup === "chi91") return chi91Data;
    if (selectedCup === "bra89") return bra89Data;
    if (selectedCup === "cop24") return cop24Data;
    if (selectedCup === "fra98") return fra98Data;
    if (selectedCup === "korjap02") return korjap02Data;
    if (selectedCup === "ger06") return ger06Data;
    if (selectedCup === "rsa10") return rsa10Data;
    if (selectedCup === "bra14") return bra14Data;
    if (selectedCup === "rus18") return rus18Data;
    if (selectedCup === "qat22") return qat22Data;
    if (selectedCup === "world26") return world26Data;
    return ita90Data;
  };

  const getCupTitle = (id) => {
    if (id === "mex86") return "Mexico 1986 World Cup";
    if (id === "ita90") return "Italy 1990 World Cup";
    if (id === "usa94") return "USA 1994 World Cup";
    if (id === "fra84") return "France 1984 European Championship";
    if (id === "ger88") return "Germany 1988 European Championship";
    if (id === "swe92") return "Sweden 1992 European Championship";
    if (id === "eng96") return "England 1996 European Championship";
    if (id === "nld00") return "Belgium & Netherlands 2000 European Championship";
    if (id === "por04") return "Portugal 2004 European Championship";
    if (id === "aut08") return "Austria & Switzerland 2008 European Championship";
    if (id === "polukr12") return "Poland & Ukraine 2012 European Championship";
    if (id === "fra16") return "France 2016 European Championship";
    if (id === "eur20") return "Europe 2020 European Championship";
    if (id === "eur24") return "Germany 2024 European Championship";
    if (id === "ecu93") return "Ecuador 1993 Copa América";
    if (id === "uru95") return "Uruguay 1995 Copa América";
    if (id === "bol97") return "Bolivia 1997 Copa América";
    if (id === "par99") return "Paraguay 1999 Copa América";
    if (id === "col01") return "Colombia 2001 Copa América";
    if (id === "per04") return "Peru 2004 Copa América";
    if (id === "ven07") return "Venezuela 2007 Copa América";
    if (id === "arg11") return "Argentina 2011 Copa América";
    if (id === "chl15") return "Chile 2015 Copa América";
    if (id === "usa16") return "USA 2016 Copa América Centenario";
    if (id === "bra19") return "Brazil 2019 Copa América";
    if (id === "bra21") return "Brazil 2021 Copa América";
    if (id === "chi91") return "Chile 1991 Copa América";
    if (id === "bra89") return "Brazil 1989 Copa América";
    if (id === "cop24") return "USA 2024 Copa América";
    if (id === "fra98") return "France 1998 World Cup";
    if (id === "korjap02") return "Korea/Japan 2002 World Cup";
    if (id === "ger06") return "Germany 2006 World Cup";
    if (id === "rsa10") return "South Africa 2010 World Cup";
    if (id === "bra14") return "Brazil 2014 World Cup";
    if (id === "rus18") return "Russia 2018 World Cup";
    if (id === "qat22") return "Qatar 2022 World Cup";
    if (id === "world26") return "Canada, Mexico & USA 2026 World Cup";
    return "Sweden 1992 European Championship";
  };

  const rawData = getCupData();
  const isWorldCup = rawData.length === 24 || rawData.length === 32 || rawData.length === 48;

  // Process data, assigning authentic groups based on historical indexes
  const roster = rawData.map(team => {
    let group = 'A';
    if (rawData.length === 24) {
      if (team.idnum >= 4 && team.idnum <= 7) group = 'B';
      else if (team.idnum >= 8 && team.idnum <= 11) group = 'C';
      else if (team.idnum >= 12 && team.idnum <= 15) group = 'D';
      else if (team.idnum >= 16 && team.idnum <= 19) group = 'E';
      else if (team.idnum >= 20 && team.idnum <= 23) group = 'F';
    } else if (rawData.length === 48) {
      if (team.idnum >= 4 && team.idnum <= 7) group = 'B';
      else if (team.idnum >= 8 && team.idnum <= 11) group = 'C';
      else if (team.idnum >= 12 && team.idnum <= 15) group = 'D';
      else if (team.idnum >= 16 && team.idnum <= 19) group = 'E';
      else if (team.idnum >= 20 && team.idnum <= 23) group = 'F';
      else if (team.idnum >= 24 && team.idnum <= 27) group = 'G';
      else if (team.idnum >= 28 && team.idnum <= 31) group = 'H';
      else if (team.idnum >= 32 && team.idnum <= 35) group = 'I';
      else if (team.idnum >= 36 && team.idnum <= 39) group = 'J';
      else if (team.idnum >= 40 && team.idnum <= 43) group = 'K';
      else if (team.idnum >= 44 && team.idnum <= 47) group = 'L';
    } else if (rawData.length === 32) {
      if (team.idnum >= 4 && team.idnum <= 7) group = 'B';
      else if (team.idnum >= 8 && team.idnum <= 11) group = 'C';
      else if (team.idnum >= 12 && team.idnum <= 15) group = 'D';
      else if (team.idnum >= 16 && team.idnum <= 19) group = 'E';
      else if (team.idnum >= 20 && team.idnum <= 23) group = 'F';
      else if (team.idnum >= 24 && team.idnum <= 27) group = 'G';
      else if (team.idnum >= 28 && team.idnum <= 31) group = 'H';
    } else if (rawData.length === 10) {
      if (team.idnum >= 5 && team.idnum <= 9) group = 'B';
    } else if (rawData.length === 12) {
      if (team.idnum >= 4 && team.idnum <= 7) group = 'B';
      else if (team.idnum >= 8 && team.idnum <= 11) group = 'C';
    } else if (rawData.length === 16) {
      if (team.idnum >= 4 && team.idnum <= 7) group = 'B';
      else if (team.idnum >= 8 && team.idnum <= 11) group = 'C';
      else if (team.idnum >= 12 && team.idnum <= 15) group = 'D';
    } else {
      if (team.idnum >= 4 && team.idnum <= 7) group = 'B';
    }
    return {
      ...team,
      attack: scaleStatTo10(team.attack),
      midfield: scaleStatTo10(team.midfield),
      defense: scaleStatTo10(team.defense),
      group,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
    };
  });

  const activeTeamObj = roster.find(t => t.idnum === selectedTeamId);

  // Group letters to display
  const groupLetters = rawData.length === 48
    ? ['A','B','C','D','E','F','G','H','I','J','K','L']
    : (rawData.length === 32 
      ? ['A','B','C','D','E','F','G','H'] 
      : (rawData.length === 24 ? ['A','B','C','D','E','F'] : (rawData.length === 16 ? ['A','B','C','D'] : (rawData.length === 12 ? ['A','B','C'] : ['A','B']))));

  const handleStartTournament = () => {
    if (selectedTeamId === null) return;

    // Clear all previous rosters and lineups from localStorage to start fresh
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("retro_roster_") || key.startsWith("retro_lineup_"))) {
        localStorage.removeItem(key);
      }
    }

    const expObj = getExpectation(activeTeamObj);
    const fixtures = generateGroupFixtures(roster, isWorldCup);
    const tournamentState = {
      cupId: selectedCup,
      cupName: getCupTitle(selectedCup),
      isWorldCup,
      playerTeamId: selectedTeamId,
      managerName: managerName || "Manager",
      boardExpectation: expObj,
      stage: "groups",
      currentRound: 1, // Round 1, 2, or 3
      teams: roster,
      fixtures,
      fanConfidence: 50,
      knockoutState: {
        roundOf32: null,
        roundOf16: null,
        quarterFinals: null,
        semiFinals: null,
        thirdPlace: null,
        final: null
      }
    };

    localStorage.setItem("retro_tournament_state", JSON.stringify(tournamentState));
    applyTeamTheme(tournamentState.teams?.find(t => t.idnum === tournamentState.playerTeamId));
    navigate("/tournament/dashboard");
  };

  return (
    <div className="Match team-select-container">
      
      {/* STEP 1: Cup Selector */}
      {step === 1 && (
        <div className="animated-slide-in" style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="matchheader selector-header">
            <h1 className="glowing-header-text">INTERNATIONAL CUPS OFFICE</h1>
            <p className="lobby-subtitle">SELECT A HISTORICAL CHAMPIONSHIP</p>
          </div>

          <div className="team-select-card" style={{ width: '100%', padding: '30px' }}>
            <h2>CHOOSE TOURNAMENT</h2>

            <div className="tournament-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', width: '100%' }}>
              <button 
                type="button"
                className={`glowing-btn ${activeTab === 'wc' ? 'active-tab-btn' : ''}`} 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '11px',
                  flexGrow: 1,
                  background: activeTab === 'wc' ? 'rgba(0, 255, 100, 0.15)' : 'rgba(0,0,0,0.3)',
                  borderColor: activeTab === 'wc' ? '#00ff64' : 'rgba(255,255,255,0.1)',
                  color: activeTab === 'wc' ? '#00ff64' : '#888'
                }} 
                onClick={() => { setActiveTab('wc'); setSelectedCup('qat22'); }}
              >
                🏆 WORLD CUPS
              </button>
              <button 
                type="button"
                className={`glowing-btn ${activeTab === 'ec' ? 'active-tab-btn' : ''}`} 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '11px',
                  flexGrow: 1,
                  background: activeTab === 'ec' ? 'rgba(0, 255, 100, 0.15)' : 'rgba(0,0,0,0.3)',
                  borderColor: activeTab === 'ec' ? '#00ff64' : 'rgba(255,255,255,0.1)',
                  color: activeTab === 'ec' ? '#00ff64' : '#888'
                }} 
                onClick={() => { setActiveTab('ec'); setSelectedCup('eur24'); }}
              >
                🇪🇺 EURO CUPS
              </button>
              <button 
                type="button"
                className={`glowing-btn ${activeTab === 'cam' ? 'active-tab-btn' : ''}`} 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '11px',
                  flexGrow: 1,
                  background: activeTab === 'cam' ? 'rgba(0, 255, 100, 0.15)' : 'rgba(0,0,0,0.3)',
                  borderColor: activeTab === 'cam' ? '#00ff64' : 'rgba(255,255,255,0.1)',
                  color: activeTab === 'cam' ? '#00ff64' : '#888'
                }} 
                onClick={() => { setActiveTab('cam'); setSelectedCup('cop24'); }}
              >
                🌎 COPA AMERICA
              </button>
            </div>

            <div className="select-wrapper" style={{ width: '90%', marginBottom: '15px' }}>
              <select className="team-dropdown" value={selectedCup} onChange={(e) => setSelectedCup(e.target.value)}>
                {activeTab === 'wc' && (
                  <>
                    <option value="world26">Canada, Mexico, USA 2026 (World Cup) 🇨🇦🇲🇽🇺🇸</option>
                    <option value="qat22">Qatar 2022 (World Cup) 🇶🇦</option>
                    <option value="rus18">Russia 2018 (World Cup) 🇷🇺</option>
                    <option value="bra14">Brazil 2014 (World Cup) 🇧🇷</option>
                    <option value="rsa10">South Africa 2010 (World Cup) 🇿🇦</option>
                    <option value="ger06">Germany 2006 (World Cup) 🇩🇪</option>
                    <option value="fra98">France 1998 (World Cup) 🇫🇷</option>
                    <option value="korjap02">Korea/Japan 2002 (World Cup) 🇰🇷🇯🇵</option>
                    <option value="ita90">Italy 1990 (World Cup) 🇮🇹</option>
                    <option value="usa94">USA 1994 (World Cup) 🇺🇸</option>
                    <option value="mex86">Mexico 1986 (World Cup) 🇲🇽</option>
                  </>
                )}
                {activeTab === 'ec' && (
                  <>
                    <option value="eur24">Germany 2024 (Euro Cup) 🇩🇪</option>
                    <option value="eur20">Europe 2020 (Euro Cup) 🇪🇺</option>
                    <option value="fra16">France 2016 (Euro Cup) 🇫🇷</option>
                    <option value="polukr12">Poland & Ukraine 2012 (Euro Cup) 🇵🇱🇺🇦</option>
                    <option value="aut08">Austria & Switzerland 2008 (Euro Cup) 🇦🇹🇨🇭</option>
                    <option value="por04">Portugal 2004 (Euro Cup) 🇵🇹</option>
                    <option value="nld00">Belgium & Netherlands 2000 (Euro Cup) 🇧🇪🇳🇱</option>
                    <option value="eng96">England 1996 (Euro Cup) 🏴󠁧󠁢󠁥󠁮󠁧󠁿</option>
                    <option value="swe92">Sweden 1992 (Euro Cup) 🇸🇪</option>
                    <option value="ger88">Germany 1988 (Euro Cup) 🇩🇪</option>
                    <option value="fra84">France 1984 (Euro Cup) 🇫🇷</option>
                  </>
                )}
                {activeTab === 'cam' && (
                  <>
                    <option value="cop24">USA 2024 (Copa América) 🇺🇸</option>
                    <option value="bra21">Brazil 2021 (Copa América) 🇧🇷</option>
                    <option value="bra19">Brazil 2019 (Copa América) 🇧🇷</option>
                    <option value="usa16">USA 2016 (Copa América Centenario) 🇺🇸</option>
                    <option value="chl15">Chile 2015 (Copa América) 🇨🇱</option>
                    <option value="arg11">Argentina 2011 (Copa América) 🇦🇷</option>
                    <option value="ven07">Venezuela 2007 (Copa América) 🇻🇪</option>
                    <option value="per04">Peru 2004 (Copa América) 🇵🇪</option>
                    <option value="col01">Colombia 2001 (Copa América) 🇨🇴</option>
                    <option value="par99">Paraguay 1999 (Copa América) 🇵🇾</option>
                    <option value="bol97">Bolivia 1997 (Copa América) 🇧🇴</option>
                    <option value="uru95">Uruguay 1995 (Copa América) 🇺🇾</option>
                    <option value="ecu93">Ecuador 1993 (Copa América) 🇪🇨</option>
                    <option value="chi91">Chile 1991 (Copa América) 🇨🇱</option>
                    <option value="bra89">Brazil 1989 (Copa América) 🇧🇷</option>
                  </>
                )}
              </select>
            </div>

            <button className="play-match-btn glowing-btn" style={{ marginTop: '20px', width: '90%' }} onClick={() => { setSelectedTeamId(null); setStep(2); }}>
              NEXT: SELECT SQUAD ➔
            </button>

            <div style={{ display: 'flex', alignItems: 'center', width: '90%', margin: '20px 0 10px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
              <span style={{ padding: '0 10px', fontSize: '9px', color: '#888', letterSpacing: '1px', fontWeight: 'bold' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }}></div>
            </div>

            <button
              onClick={() => document.getElementById("select-import-save-input").click()}
              className="glowing-btn"
              style={{
                width: '90%',
                padding: '12px',
                fontSize: '12px',
                borderColor: '#ffc107',
                color: '#ffc107',
                background: 'rgba(255, 193, 7, 0.05)',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 'bold',
                borderRadius: '10px',
                cursor: 'pointer',
                letterSpacing: '1px',
                transition: 'all 0.3s ease',
                border: '1.5px solid #ffc107',
                boxShadow: '0 0 10px rgba(255, 193, 7, 0.1)'
              }}
              title="Import tournament save from a JSON file"
              onMouseEnter={(e) => {
                e.target.style.background = '#ffc107';
                e.target.style.color = '#050c06';
                e.target.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 193, 7, 0.05)';
                e.target.style.color = '#ffc107';
                e.target.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.1)';
              }}
            >
              📂 IMPORT SAVE GAME
            </button>
            <input
              type="file"
              id="select-import-save-input"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportSave}
            />
          </div>
          
          <div style={{ marginTop: '10px' }}>
            <button className="back-home-btn" onClick={() => navigate("/")}>➔ RETURN TO CABINET</button>
          </div>
        </div>
      )}

      {/* STEP 2: Team Selection Deck */}
      {step === 2 && (
        <div className="animated-slide-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="matchheader selector-header">
            <h1 className="glowing-header-text" style={{ fontSize: '32px' }}>CHOOSE YOUR SQUAD</h1>
            <p className="lobby-subtitle">{getCupTitle(selectedCup)}</p>
          </div>

          <div className="selection-deck" style={{ flexWrap: 'wrap', gap: '25px', maxWidth: '1100px' }}>
            
            {/* Scroll Box of Grouped Teams */}
            <div className="teams-grid-scroll-box" style={{ 
              flexGrow: 1, 
              height: '480px', 
              overflowY: 'auto', 
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              paddingRight: '10px'
            }}>
              {groupLetters.map(gLetter => (
                <div key={gLetter} style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px', padding: '15px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontFamily: 'Orbitron', color: '#ffd700', fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px' }}>
                    GROUP {gLetter}
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                    {roster.filter(t => t.group === gLetter).map(team => (
                      <div 
                        key={team.idnum}
                        className={`team-select-mini-card ${selectedTeamId === team.idnum ? 'selected-mini-card' : ''}`}
                        onClick={() => setSelectedTeamId(team.idnum)}
                        style={{
                          background: selectedTeamId === team.idnum ? 'rgba(0,255,100,0.06)' : 'rgba(0,0,0,0.4)',
                          border: selectedTeamId === team.idnum ? '2px solid #00ff64' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '10px',
                          padding: '10px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.25s ease'
                        }}
                      >
                        <TeamFlag primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={45} />
                        <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#fff', textAlign: 'center' }}>{team.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Team details sideboard */}
            <div className="team-select-card" style={{ width: '300px', minHeight: '450px', flexShrink: 0 }}>
              <h2>TEAM OVERVIEW</h2>
              {activeTeamObj ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '12px' }}>
                  <TeamFlag primaryColor={activeTeamObj.primaryColor} secondaryColor={activeTeamObj.secondaryColor} size={110} />
                  <h3 style={{ margin: '0', color: '#fff', fontSize: '16px', textAlign: 'center' }}>{activeTeamObj.name}</h3>

                  <div className="stats-box" style={{ width: '90%', padding: '8px 12px' }}>
                    <div className="stat-row">
                      <span className="stat-label">Attack</span>
                      <div className="progress-bar-bg"><div className="progress-bar-fill attack-fill" style={{ width: `${Math.min(100, (activeTeamObj.attack / 10) * 100)}%` }}></div></div>
                      <span className="stat-val">{activeTeamObj.attack}/10</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Midfield</span>
                      <div className="progress-bar-bg"><div className="progress-bar-fill midfield-fill" style={{ width: `${Math.min(100, (activeTeamObj.midfield / 10) * 100)}%` }}></div></div>
                      <span className="stat-val">{activeTeamObj.midfield}/10</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Defense</span>
                      <div className="progress-bar-bg"><div className="progress-bar-fill defense-fill" style={{ width: `${Math.min(100, (activeTeamObj.defense / 10) * 100)}%` }}></div></div>
                      <span className="stat-val">{activeTeamObj.defense}/10</span>
                    </div>
                  </div>

                  {/* Manager Name Input */}
                  <div style={{ width: '90%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', color: '#00ff64', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>Manager Name</label>
                    <input 
                      type="text" 
                      value={managerName} 
                      onChange={(e) => setManagerName(e.target.value)}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(0,255,100,0.2)',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#fff',
                        fontSize: '13px',
                        width: '100%',
                        outline: 'none',
                        textAlign: 'center'
                      }}
                      maxLength={20}
                    />
                  </div>

                  {/* Board Expectation */}
                  <div style={{ 
                    width: '90%', 
                    padding: '8px 12px', 
                    background: 'rgba(0,255,100,0.03)', 
                    border: '1px solid rgba(0,255,100,0.15)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    <span style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Board Expectation</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00ff64' }}>{getExpectation(activeTeamObj)?.text}</span>
                    <span style={{ fontSize: '10px', color: '#aaa' }}>Goal: {getExpectation(activeTeamObj)?.desc}</span>
                  </div>

                  <button className="play-match-btn glowing-btn" style={{ fontSize: '13px', padding: '10px 20px', width: '90%', marginTop: '5px' }} onClick={handleStartTournament}>
                    CONFIRM & START SQUAD
                  </button>
                </div>
              ) : (
                <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '13px', textAlign: 'center', padding: '0 10px' }}>
                  Select one of the national teams to view statistics and colors.
                </div>
              )}
            </div>

          </div>

          <div style={{ marginTop: '10px' }}>
            <button className="back-home-btn" onClick={() => setStep(1)}>➔ BACK TO SETUP</button>
          </div>
        </div>
      )}

    </div>
  );
}
