const fs = require('fs');
const path = require('path');
const {
  BEL_QUALIFIERS,
  SWE_QUALIFIERS,
  DEN_QUALIFIERS
} = require('./generateBelgiumSwedenDenmarkLeagues');

const ROOT_DIR = path.resolve(__dirname, '..');
const LEAGUE_DATA_PATH = path.join(ROOT_DIR, 'src', 'data', 'leagueData.js');
const QUALIFIERS_PATH = path.join(ROOT_DIR, 'src', 'data', 'qualifiersBySeason.js');

// ============================================================================
// 1. UPDATE qualifiersBySeason.js (1989 - 2026)
// ============================================================================
console.log("Updating qualifiersBySeason.js...");
let qualContent = fs.readFileSync(QUALIFIERS_PATH, 'utf8');

for (let yr = 1989; yr <= 2026; yr++) {
  const yrStr = String(yr);
  const belQ = BEL_QUALIFIERS[yrStr] || { cl: [], uefa: [], uecl: [] };
  const sweQ = SWE_QUALIFIERS[yrStr] || { cl: [], uefa: [], uecl: [] };
  const denQ = DEN_QUALIFIERS[yrStr] || { cl: [], uefa: [], uecl: [] };

  const seasonRegex = new RegExp(`("${yrStr}":\\s*\\{[\\s\\S]*?\\r?\\n  \\}(?:,|\\r?\\n\\};))`, 'm');
  const match = qualContent.match(seasonRegex);

  if (!match) {
    console.warn(`⚠️ Could not find season ${yrStr} in qualifiersBySeason.js`);
    continue;
  }

  let seasonBlock = match[1];

  function injectIntoCup(block, cupName, belList, sweList, denList) {
    const cupRegex = new RegExp(`(${cupName}:\\s*\\{[\\s\\S]*?\\r?\\n    \\})`, 'm');
    const cupMatch = block.match(cupRegex);
    if (!cupMatch) return block;

    let cupBlock = cupMatch[1];
    if (!cupBlock.includes('belgium:')) {
      const belJson = JSON.stringify(belList || []);
      const sweJson = JSON.stringify(sweList || []);
      const denJson = JSON.stringify(denList || []);
      const lastLineRegex = /([ \t]*)([a-z0-9_]+:\s*\[[^\]]*\])(\s*\r?\n    \})/i;
      if (lastLineRegex.test(cupBlock)) {
        cupBlock = cupBlock.replace(
          lastLineRegex,
          `$1$2,\n      belgium: ${belJson},\n      sweden: ${sweJson},\n      denmark: ${denJson}$3`
        );
      }
    }
    return block.replace(cupMatch[1], cupBlock);
  }

  seasonBlock = injectIntoCup(seasonBlock, 'cl', belQ.cl, sweQ.cl, denQ.cl);
  seasonBlock = injectIntoCup(seasonBlock, 'uefa', belQ.uefa, sweQ.uefa, denQ.uefa);
  if (yr >= 2021) {
    seasonBlock = injectIntoCup(seasonBlock, 'uecl', belQ.uecl || [], sweQ.uecl || [], denQ.uecl || []);
  }

  qualContent = qualContent.replace(match[1], seasonBlock);
}

fs.writeFileSync(QUALIFIERS_PATH, qualContent, 'utf8');
console.log("✅ qualifiersBySeason.js successfully updated.");

// ============================================================================
// 2. UPDATE leagueData.js (1989 - 2026)
// ============================================================================
console.log("Updating leagueData.js...");
let leagueContent = fs.readFileSync(LEAGUE_DATA_PATH, 'utf8');

const belImports = [];
const sweImports = [];
const denImports = [];

for (let y = 1989; y <= 2026; y++) {
  const shortYr = String(y).slice(-2);
  belImports.push(`import bel${shortYr}Data from './leagues/bel/bel${shortYr}.json';`);
  sweImports.push(`import swe${shortYr}Data from './leagues/swe/swe${shortYr}.json';`);
  denImports.push(`import den${shortYr}Data from './leagues/den/den${shortYr}.json';`);
}

if (!leagueContent.includes('bel89Data')) {
  const newImportsBlock = `\n// belgium\n${belImports.join('\n')}\n// sweden\n${sweImports.join('\n')}\n// denmark\n${denImports.join('\n')}\n`;
  leagueContent = leagueContent.replace(
    '// Lookup map: leagueDataMap[season][country]',
    `${newImportsBlock}\n// Lookup map: leagueDataMap[season][country]`
  );
}

for (let y = 1989; y <= 2026; y++) {
  const yrStr = String(y);
  const shortYr = yrStr.slice(-2);
  const rowRegex = new RegExp(`("${yrStr}":\\s*\\{[^\\}]*?)(\\s*\\},?)`);
  const rowMatch = leagueContent.match(rowRegex);

  if (rowMatch && !rowMatch[1].includes('belgium:')) {
    const additions = `, belgium: bel${shortYr}Data, sweden: swe${shortYr}Data, denmark: den${shortYr}Data`;
    const updatedRow = `${rowMatch[1]}${additions}${rowMatch[2]}`;
    leagueContent = leagueContent.replace(rowMatch[0], updatedRow);
  }
}

fs.writeFileSync(LEAGUE_DATA_PATH, leagueContent, 'utf8');
console.log("✅ leagueData.js successfully updated.");
