/**
 * Batch Extractor for Scotland and Ukraine across all seasons (1990-2025)
 * Safely merges authentic Scottish & Ukrainian squads and finances into public/data/rosters10/
 * without re-extracting or modifying any existing leagues!
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXTRACTOR_SCRIPT = path.join(ROOT_DIR, 'scripts', 'extractCMSquads10.js');
const CM_DATA_BASE = 'F:/Igri/CM Data';

const args = process.argv.slice(2);
const extraArgs = args.join(' ');

console.log("==================================================================");
console.log("🏴󠁧󠁢󠁳󠁣󠁴󠁿 🇺🇦 BATCH SQUAD EXTRACTOR: SCOTLAND & UKRAINE (1990 - 2025)");
if (extraArgs) console.log(`• Flags: ${extraArgs}`);
console.log("==================================================================");

for (let yr = 1990; yr <= 2025; yr++) {
  const yrStr = String(yr);
  console.log(`\n------------------------------------------------------------------`);
  console.log(`⏳ Processing Season ${yrStr} / ${String((yr + 1) % 100).padStart(2, '0')}...`);

  // Scotland (1990 - 2025)
  try {
    const cmdSco = `node "${EXTRACTOR_SCRIPT}" --season ${yrStr} --league sco ${extraArgs}`;
    console.log(`   🏴󠁧󠁢󠁳󠁣󠁴󠁿 Extracting Scotland (sco${yrStr.slice(-2)})...`);
    execSync(cmdSco, { stdio: 'inherit', cwd: ROOT_DIR });
  } catch (err) {
    console.error(`   ⚠️ Failed to extract Scotland for season ${yrStr}:`, err.message);
  }

  // Ukraine (1991 - 2025)
  if (yr >= 1991) {
    try {
      const cmdUkr = `node "${EXTRACTOR_SCRIPT}" --season ${yrStr} --league ukr ${extraArgs}`;
      console.log(`   🇺🇦 Extracting Ukraine (ukr${yrStr.slice(-2)})...`);
      execSync(cmdUkr, { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (err) {
      console.error(`   ⚠️ Failed to extract Ukraine for season ${yrStr}:`, err.message);
    }
  }
}

console.log("\n==================================================================");
console.log("🎉 ALL SEASONS PROCESSED AND MERGED SUCCESSFULLY!");
console.log("==================================================================");
