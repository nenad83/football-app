/**
 * Batch Extractor for Belgium, Sweden, and Denmark across seasons (1989 - 2026)
 * Safely merges authentic Belgian, Swedish & Danish squads and finances into public/data/rosters10/
 * without modifying any existing leagues.
 *
 * Examples:
 *   node scripts/extractBelgiumSwedenDenmarkAllSeasons.js                  # All seasons 1989-2026
 *   node scripts/extractBelgiumSwedenDenmarkAllSeasons.js --season 2001    # Single season 2001
 *   node scripts/extractBelgiumSwedenDenmarkAllSeasons.js --dry-run        # Preview without writing
 *   node scripts/extractCMSquads10.js --season 2001 --league bel           # Only Belgium 2001
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const EXTRACTOR_SCRIPT = path.join(ROOT_DIR, 'scripts', 'extractCMSquads10.js');

const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const singleSeason = getArg('--season', null);
const singleLeague = getArg('--league', null);
const passFlags = args.filter((a, idx) => {
  if (a === '--season' || a === '--league') return false;
  if (idx > 0 && (args[idx - 1] === '--season' || args[idx - 1] === '--league')) return false;
  return true;
});
const extraArgs = passFlags.join(' ');

const startYear = singleSeason ? parseInt(singleSeason, 10) : 1989;
const endYear = singleSeason ? parseInt(singleSeason, 10) : 2026;
const targetLeagues = singleLeague ? [singleLeague] : ['bel', 'swe', 'den'];

console.log("==================================================================");
console.log("🇧🇪 🇸🇪 🇩🇰 BATCH SQUAD EXTRACTOR: BELGIUM, SWEDEN & DENMARK");
console.log(`• Seasons: ${startYear} - ${endYear} | Leagues: ${targetLeagues.join(', ')}`);
if (extraArgs) console.log(`• Flags: ${extraArgs}`);
console.log("==================================================================");

for (let yr = startYear; yr <= endYear; yr++) {
  const yrStr = String(yr);
  const shortYr = yrStr.slice(-2);
  console.log(`\n------------------------------------------------------------------`);
  console.log(`⏳ Processing Season ${yrStr} / ${String((yr + 1) % 100).padStart(2, '0')}...`);

  for (const lg of targetLeagues) {
    try {
      const cmd = `node "${EXTRACTOR_SCRIPT}" --season ${yrStr} --league ${lg} ${extraArgs}`.trim();
      console.log(`   ⚽ Extracting ${lg.toUpperCase()} (${lg}${shortYr})...`);
      execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (err) {
      console.error(`   ⚠️ Failed to extract ${lg.toUpperCase()} for season ${yrStr}:`, err.message);
    }
  }
}

console.log("\n==================================================================");
console.log("🎉 EXTRACTION COMPLETE!");
console.log("==================================================================");
