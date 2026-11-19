const fs = require('fs');
const path = require('path');
const { SCO_QUALIFIERS, UKR_QUALIFIERS } = require('./generateScotlandUkraineLeagues');

const ROOT_DIR = path.resolve(__dirname, '..');
const LEAGUE_DATA_PATH = path.join(ROOT_DIR, 'src', 'data', 'leagueData.js');
const QUALIFIERS_PATH = path.join(ROOT_DIR, 'src', 'data', 'qualifiersBySeason.js');

// ============================================================================
// 1. UPDATE qualifiersBySeason.js
// ============================================================================
console.log("Updating qualifiersBySeason.js...");
let qualContent = fs.readFileSync(QUALIFIERS_PATH, 'utf8');

// The file exports `export const qualifiersBySeason = { ... };`
// For each season in 1990..2026, let's inject `scotland: [...]` and `ukraine: [...]` into cl, uefa, and uecl blocks.

for (let yr = 1990; yr <= 2026; yr++) {
  const yrStr = String(yr);
  const scoQ = SCO_QUALIFIERS[yrStr] || { cl: [], uefa: [] };
  const ukrQ = UKR_QUALIFIERS[yrStr] || { cl: [], uefa: [] };

  // Match the block for that season, e.g. `"1990": {\n    cl: { ... },\n    uefa: { ... }\n  }`
  const seasonRegex = new RegExp(`("${yrStr}":\\s*\\{[\\s\\S]*?\\n  \\}(?:,|\\n\\};))`, 'm');
  const match = qualContent.match(seasonRegex);

  if (!match) {
    console.warn(`Could not find season ${yrStr} in qualifiersBySeason.js`);
    continue;
  }

  let seasonBlock = match[1];

  // Helper to inject country list into a cup block inside seasonBlock
  function injectIntoCup(block, cupName, scoList, ukrList) {
    const cupRegex = new RegExp(`(${cupName}:\\s*\\{[\\s\\S]*?\\n    \\})`, 'm');
    const cupMatch = block.match(cupRegex);
    if (!cupMatch) return block;

    let cupBlock = cupMatch[1];
    
    // Check if scotland is already in this cup block
    if (!cupBlock.includes('scotland:')) {
      const scoJson = JSON.stringify(scoList);
      const ukrJson = JSON.stringify(ukrList);
      
      // Add before closing `    }` of cup block
      // Check if last property has comma
      const lastLineRegex = /([ \t]*)([a-z0-9_]+:\s*\[[^\]]*\])(\s*\n    \})/i;
      if (lastLineRegex.test(cupBlock)) {
        cupBlock = cupBlock.replace(lastLineRegex, `$1$2,\n      scotland: ${scoJson},\n      ukraine: ${ukrJson}$3`);
      }
    }

    return block.replace(cupMatch[1], cupBlock);
  }

  seasonBlock = injectIntoCup(seasonBlock, 'cl', scoQ.cl, ukrQ.cl);
  seasonBlock = injectIntoCup(seasonBlock, 'uefa', scoQ.uefa, ukrQ.uefa);
  if (yr >= 2021) {
    seasonBlock = injectIntoCup(seasonBlock, 'uecl', scoQ.uecl || [], ukrQ.uecl || []);
  }

  qualContent = qualContent.replace(match[1], seasonBlock);
}

fs.writeFileSync(QUALIFIERS_PATH, qualContent, 'utf8');
console.log("✅ qualifiersBySeason.js successfully updated.");

// ============================================================================
// 2. UPDATE leagueData.js
// ============================================================================
console.log("Updating leagueData.js...");
let leagueContent = fs.readFileSync(LEAGUE_DATA_PATH, 'utf8');

// Build imports for Scotland and Ukraine
const scoImports = [];
for (let y = 1990; y <= 2026; y++) {
  const shortYr = String(y).slice(-2);
  scoImports.push(`import sco${shortYr}Data from './leagues/sco/sco${shortYr}.json';`);
}

const ukrImports = [];
for (let y = 1991; y <= 2026; y++) {
  const shortYr = String(y).slice(-2);
  ukrImports.push(`import ukr${shortYr}Data from './leagues/ukr/ukr${shortYr}.json';`);
}

const newImportsBlock = `\n// scotland\n${scoImports.join('\n')}\n// ukraine\n${ukrImports.join('\n')}\n`;

if (!leagueContent.includes('sco90Data')) {
  // Insert new imports right before `// Lookup map: leagueDataMap[season][country]`
  leagueContent = leagueContent.replace(
    '// Lookup map: leagueDataMap[season][country]',
    `${newImportsBlock}\n// Lookup map: leagueDataMap[season][country]`
  );
}

// Now update `leagueDataMap` entries for 1990..2026
for (let y = 1990; y <= 2026; y++) {
  const yrStr = String(y);
  const shortYr = yrStr.slice(-2);
  const rowRegex = new RegExp(`("${yrStr}":\\s*\\{[^\\}]*?)(\\s*\\},?)`);
  const rowMatch = leagueContent.match(rowRegex);

  if (rowMatch && !rowMatch[1].includes('scotland:')) {
    let additions = `, scotland: sco${shortYr}Data`;
    if (y >= 1991) {
      additions += `, ukraine: ukr${shortYr}Data`;
    }
    const updatedRow = `${rowMatch[1]}${additions}${rowMatch[2]}`;
    leagueContent = leagueContent.replace(rowMatch[0], updatedRow);
  }
}

fs.writeFileSync(LEAGUE_DATA_PATH, leagueContent, 'utf8');
console.log("✅ leagueData.js successfully updated.");
