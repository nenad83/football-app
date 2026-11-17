/**
 * ==============================================================================
 * BATCH SEASON ROSTER GENERATOR (football-app)
 * ==============================================================================
 *
 * This script scans team definition files (e.g. src/data/leagues/*99*.json)
 * and generates authentic, balanced 22-man player squads for an entire season.
 *
 * Squads are saved as static JSON files so the game loads instantly, works 100%
 * offline, and requires zero live AI calls during gameplay.
 *
 * USAGE:
 *   node scripts/generateSeasonRosters.js [options]
 *
 * OPTIONS:
 *   --season <year>        Target season short code or year (default: 99 or 1999)
 *   --league <code|file>   Process only one specific league (e.g. eng, eng99, ita99_d2)
 *   --team <name>          Test with only one specific team (e.g. "Arsenal" or "Boca Juniors")
 *   --dry-run              Preview all matching teams without calling the API or writing files
 *   --concurrency <num>    Number of concurrent API requests (default: 3)
 *   --delay <ms>           Delay in ms between requests to respect rate limits (default: 800)
 *   --force                Overwrite squads that have already been generated
 *   --help                 Display this help screen
 *
 * EXAMPLES:
 *   1. Preview all 1999 teams without doing anything:
 *      node scripts/generateSeasonRosters.js --season 1999 --dry-run
 *
 *   2. Test generating just one team:
 *      node scripts/generateSeasonRosters.js --season 1999 --team "Arsenal"
 *
 *   3. Generate only the English Premier League:
 *      node scripts/generateSeasonRosters.js --season 1999 --league eng99
 *
 *   4. Run the full season generation:
 *      node scripts/generateSeasonRosters.js --season 1999
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. ENVIRONMENT & CONFIGURATION
// ---------------------------------------------------------------------------
const ROOT_DIR = path.resolve(__dirname, '..');
const LEAGUES_DIR = path.join(ROOT_DIR, 'src', 'data', 'leagues');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'src', 'data', 'rosters');

// Auto-load .env.local or .env if present
function loadEnv() {
  const envPaths = [
    path.join(ROOT_DIR, '.env.local'),
    path.join(ROOT_DIR, '.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.substring(0, eqIdx).trim();
          let val = trimmed.substring(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    }
  }
}
loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.REACT_APP_GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const COUNTRY_MAP = {
  arg: "argentina",
  bra: "brazil",
  col: "colombia",
  eng: "england",
  esp: "spain",
  fra: "france",
  ger: "germany",
  ita: "italy",
  ned: "netherlands",
  por: "portugal",
  rus: "russia"
};

// ---------------------------------------------------------------------------
// 2. PARSE CLI ARGUMENTS
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}
const hasFlag = flag => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Usage: node scripts/generateSeasonRosters.js [options]

Options:
  --season <year>      Season year (e.g. 1999 or 99, default: 1999)
  --league <name>      Filter by league code (e.g. eng, eng99, ita99_d2)
  --team <name>        Filter by single team name (e.g. "Arsenal")
  --dry-run            Simulate without making API calls or creating files
  --concurrency <num>  Number of concurrent requests (default: 3)
  --delay <ms>         Delay in ms between batches (default: 800)
  --force              Overwrite existing roster files
  --help               Show this help message
`);
  process.exit(0);
}

const targetSeasonArg = getArg('--season', '1999');
const seasonShort = targetSeasonArg.length === 4 ? targetSeasonArg.slice(-2) : targetSeasonArg;
const fullYear = targetSeasonArg.length === 4 ? parseInt(targetSeasonArg, 10) : 1900 + parseInt(targetSeasonArg, 10);
const seasonFormatted = `${fullYear}/${String((fullYear + 1) % 100).padStart(2, '0')}`;

const targetLeague = getArg('--league', null);
const targetTeam = getArg('--team', null);
const isDryRun = hasFlag('--dry-run');
const isForce = hasFlag('--force');
const concurrency = parseInt(getArg('--concurrency', '3'), 10);
const delayMs = parseInt(getArg('--delay', '800'), 10);

// ---------------------------------------------------------------------------
// 3. STATS CALIBRATION (Matches FormationTactics.js 100%)
// ---------------------------------------------------------------------------
function getGeneralPosition(pos) {
  if (!pos) return "MF";
  const p = pos.trim().toUpperCase();
  if (p === "GK" || p === "GOALKEEPER") return "GK";
  if (["DF", "DEFENDER", "CB", "LB", "RB", "SW", "DL", "DR", "DC", "LWB", "RWB"].includes(p)) return "DF";
  if (["MF", "MIDFIELDER", "CM", "DM", "AM", "LM", "RM", "DMC", "AMC", "MC", "ML", "MR", "AML", "AMR"].includes(p)) return "MF";
  if (["FW", "FORWARD", "ST", "CF", "SC", "LW", "RW", "LF", "RF", "STRIKER", "WINGER"].includes(p)) return "FW";
  return "MF";
}

function calibrateSquadRatings(squad, stats) {
  if (!stats) return squad;

  const departments = {
    GK: Math.max(1, (stats.defense || 3) - 0.5),
    DF: Math.max(1, (stats.defense || 3) - 0.5),
    MF: Math.max(1, (stats.midfield || 3) - 0.5),
    FW: Math.max(1, (stats.attack || 3) - 0.5)
  };

  const grouped = { GK: [], DF: [], MF: [], FW: [] };
  squad.forEach(p => {
    const dept = getGeneralPosition(p.position);
    if (grouped[dept]) grouped[dept].push(p);
    else grouped.MF.push(p);
  });

  Object.keys(grouped).forEach(dept => {
    const players = grouped[dept];
    const target = departments[dept];
    const N = players.length;
    if (N === 0) return;

    const targetSum = Math.round(target * N);
    const currentSum = players.reduce((sum, p) => sum + (parseInt(p.rating, 10) || 3), 0);
    const currentAvg = currentSum / N;

    if (Math.round(currentAvg) === target) {
      players.forEach(p => {
        p.rating = Math.max(1, Math.min(5, parseInt(p.rating, 10) || 3));
      });
      return;
    }

    const diff = target - currentAvg;
    const floatRatings = players.map(p => {
      const originalRating = parseInt(p.rating, 10) || 3;
      const shifted = originalRating + diff;
      const clamped = Math.max(1, Math.min(5, shifted));
      return { p, originalRating, shifted, clamped, rounded: Math.round(clamped) };
    });

    let initialSum = floatRatings.reduce((sum, item) => sum + item.rounded, 0);
    let attempts = 0;
    while (initialSum !== targetSum && attempts < 100) {
      attempts++;
      if (initialSum < targetSum) {
        const candidates = floatRatings.filter(item => item.rounded < 5).sort((a, b) => b.shifted - a.shifted);
        if (candidates.length === 0) break;
        candidates[0].rounded += 1;
        initialSum += 1;
      } else {
        const candidates = floatRatings.filter(item => item.rounded > 1).sort((a, b) => a.shifted - b.shifted);
        if (candidates.length === 0) break;
        candidates[0].rounded -= 1;
        initialSum -= 1;
      }
    }

    floatRatings.forEach(item => {
      item.p.rating = item.rounded;
    });
  });

  return squad;
}

// ---------------------------------------------------------------------------
// 4. GEMINI API SQUAD GENERATION WITH EXPONENTIAL BACKOFF
// ---------------------------------------------------------------------------
const VALID_POSITIONS = ["GK", "DL", "DC", "DR", "DMC", "MC", "MR", "ML", "AMC", "AML", "AMR", "ST", "CF", "LW", "RW"];

async function callGeminiWithRetry(prompt, retries = 5, backoff = 2000) {
  if (!GEMINI_API_KEY) {
    throw new Error("No GEMINI_API_KEY found in environment or .env.local");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
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
            position: { type: "STRING", enum: VALID_POSITIONS },
            positions: { type: "ARRAY", items: { type: "STRING", enum: VALID_POSITIONS } },
            rating: { type: "INTEGER" },
            age: { type: "INTEGER" }
          },
          required: ["name", "position", "positions", "rating", "age"]
        }
      }
    }
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });

      if (response.status === 429) {
        let errJson = null;
        try {
          errJson = await response.json();
        } catch {}
        const errMsg = errJson?.error?.message || "";
        if (errMsg.toLowerCase().includes("per day") || errMsg.toLowerCase().includes("daily")) {
          throw new Error(`Daily quota exhausted on free tier for model ${GEMINI_MODEL}: ${errMsg}`);
        }
        console.warn(`    ⚠️ Rate limit (429) hit. Backing off for ${backoff}ms (attempt ${attempt}/${retries})...`);
        await new Promise(r => setTimeout(r, backoff));
        backoff *= 2;
        continue;
      }

      if (!response.ok) {
        let errJson = null;
        try { errJson = await response.json(); } catch {}
        throw new Error(`HTTP ${response.status}: ${errJson?.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error("Empty candidate response from Gemini API");

      let clean = rawText.trim();
      if (clean.startsWith("```json")) clean = clean.substring(7, clean.length - 3).trim();
      else if (clean.startsWith("```")) clean = clean.substring(3, clean.length - 3).trim();

      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || parsed.length < 11) {
        throw new Error(`Invalid squad array size: ${parsed?.length}`);
      }
      return parsed;
    } catch (err) {
      if (err.message.includes("Daily quota exhausted")) throw err;
      if (attempt === retries) throw err;
      console.warn(`    ⚠️ Attempt ${attempt} failed: ${err.message}. Retrying in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      backoff *= 2;
    }
  }
  throw new Error("Exhausted all retries without receiving a valid squad from Gemini API");
}

async function generateSquadForTeam(team, seasonStr, country) {
  const prompt = `You are a football database expert. 
Generate a squad of 22 players for the team "${team.name}" in the "${seasonStr}" season. 
The team represents the country "${country}" and has game ratings: Attack: ${team.attack}/5, Midfield: ${team.midfield}/5, Defense: ${team.defense}/5.

Requirements:
1. Provide exactly 22 players.
2. The players must be real, authentic players who played for "${team.name}" in the ${seasonStr} season.
3. Group by positions: exactly 2 Goalkeepers, exactly 7 or 8 Defenders, exactly 7 or 8 Midfielders, and exactly 4 to 6 Forwards so that total is exactly 22.
4. For each player provide:
   - "name": Full real name
   - "position": Primary position tag (one of: GK, DL, DR, DC, DMC, MC, ML, MR, AMC, AML, AMR, ST, CF, LW, RW)
   - "positions": Array of 1-3 positions they played
   - "rating": Integer 1 to 5
   - "age": Real-life age in the year ${seasonStr.split('/')[0]}
`;

  const rawSquad = await callGeminiWithRetry(prompt);

  const formattedSquad = rawSquad.map(p => {
    let r = parseInt(p.rating, 10) || 3;
    r = Math.max(1, Math.min(5, r));
    const age = Math.max(16, Math.min(45, parseInt(p.age, 10) || 25));
    return {
      name: p.name.trim(),
      position: p.position,
      positions: Array.isArray(p.positions) && p.positions.length > 0 ? p.positions : [p.position],
      rating: r,
      age: age,
      condition: 100,
      injuryMatchesLeft: 0,
      injury: null,
      isHistorical: true
    };
  });

  return calibrateSquadRatings(formattedSquad, {
    attack: team.attack,
    midfield: team.midfield,
    defense: team.defense
  });
}

// ---------------------------------------------------------------------------
// 5. HELPER UTILITIES
// ---------------------------------------------------------------------------
function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 6. MAIN EXECUTION PIPELINE
// ---------------------------------------------------------------------------
async function main() {
  console.log("==================================================================");
  console.log("⚽ RETRO FOOTBALL SQUAD BATCH GENERATOR");
  console.log("==================================================================");
  console.log(`• Season Target:       ${seasonFormatted} (code: ${seasonShort})`);
  console.log(`• Leagues Directory:   ${LEAGUES_DIR}`);
  console.log(`• Output Directory:    ${path.join(OUTPUT_BASE_DIR, String(fullYear))}`);
  console.log(`• Gemini Model:        ${GEMINI_MODEL}`);
  console.log(`• Dry Run Mode:        ${isDryRun ? "YES (Preview Only)" : "NO (Live Generation)"}`);
  console.log(`• Overwrite Existing:  ${isForce ? "YES" : "NO (Skip existing)"}`);
  if (targetLeague) console.log(`• Filter League:       ${targetLeague}`);
  if (targetTeam) console.log(`• Filter Team:         ${targetTeam}`);
  console.log("==================================================================\n");

  if (!isDryRun && !GEMINI_API_KEY) {
    console.error("❌ ERROR: No Gemini API Key found!");
    console.error("   Please set GEMINI_API_KEY in your environment or in football-app/.env.local");
    process.exit(1);
  }

  // Find all matching league files
  const leagueFiles = [];
  const entries = fs.readdirSync(LEAGUES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(LEAGUES_DIR, entry.name);
    if (entry.isDirectory()) {
      const subFiles = fs.readdirSync(fullPath);
      for (const sf of subFiles) {
        if (sf.endsWith('.json') && sf.includes(seasonShort)) {
          leagueFiles.push({
            filename: sf,
            fullPath: path.join(fullPath, sf),
            countryPrefix: entry.name
          });
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name.includes(seasonShort)) {
      const prefix = entry.name.slice(0, 3);
      leagueFiles.push({
        filename: entry.name,
        fullPath: fullPath,
        countryPrefix: prefix
      });
    }
  }

  // Filter leagues if requested
  const filteredFiles = leagueFiles.filter(item => {
    if (!targetLeague) return true;
    const cleanL = targetLeague.toLowerCase();
    return item.filename.toLowerCase().includes(cleanL) || item.countryPrefix.toLowerCase().includes(cleanL);
  });

  if (filteredFiles.length === 0) {
    console.warn(`⚠️ No league files matched season "${seasonShort}" and filter "${targetLeague || 'all'}".`);
    process.exit(0);
  }

  // Collect all teams
  const allTasks = [];
  for (const lFile of filteredFiles) {
    const rawContent = fs.readFileSync(lFile.fullPath, 'utf8');
    const teamsList = JSON.parse(rawContent);
    const country = COUNTRY_MAP[lFile.countryPrefix] || lFile.countryPrefix;
    const leagueCode = path.basename(lFile.filename, '.json');

    teamsList.forEach((team, idx) => {
      if (targetTeam && !team.name.toLowerCase().includes(targetTeam.toLowerCase())) {
        return;
      }
      allTasks.push({
        team,
        country,
        leagueCode,
        index: idx,
        leagueFile: lFile.filename
      });
    });
  }

  console.log(`📋 Found ${filteredFiles.length} league file(s) with ${allTasks.length} matching team(s).\n`);

  if (isDryRun) {
    console.log("--- DRY RUN PREVIEW ---");
    filteredFiles.forEach(f => console.log(`  📁 [League File] ${f.filename} (${COUNTRY_MAP[f.countryPrefix] || f.countryPrefix})`));
    console.log(`\nSample Teams (showing first 15 of ${allTasks.length}):`);
    allTasks.slice(0, 15).forEach(t => {
      console.log(`  • [${t.leagueCode}] ${t.team.name.padEnd(25)} (Att: ${t.team.attack}, Mid: ${t.team.midfield}, Def: ${t.team.defense}) -> ${t.country}`);
    });
    if (allTasks.length > 15) {
      console.log(`  ... and ${allTasks.length - 15} more teams.`);
    }
    console.log("\n💡 Dry run complete! No API calls were made and no files were written.");
    process.exit(0);
  }

  // Ensure output directory exists
  const seasonOutputDir = path.join(OUTPUT_BASE_DIR, String(fullYear));
  fs.mkdirSync(seasonOutputDir, { recursive: true });

  let completedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  // Worker loop for controlled concurrency
  let taskIndex = 0;
  async function worker(workerId) {
    while (taskIndex < allTasks.length) {
      const currentIdx = taskIndex++;
      const item = allTasks[currentIdx];
      const team = item.team;
      const country = item.country;
      const leagueCode = item.leagueCode;

      const teamFileSafeName = sanitizeFilename(team.name);
      const teamOutDir = path.join(seasonOutputDir, country);
      fs.mkdirSync(teamOutDir, { recursive: true });
      const outputPath = path.join(teamOutDir, `${teamFileSafeName}.json`);

      // Skip if already generated and force is false
      if (!isForce && fs.existsSync(outputPath)) {
        skippedCount++;
        console.log(`[${currentIdx + 1}/${allTasks.length}] ⏩ Skipped (already exists): [${leagueCode}] ${team.name}`);
        continue;
      }

      console.log(`[${currentIdx + 1}/${allTasks.length}] ⏳ Generating: [${leagueCode}] ${team.name} (${country})...`);

      try {
        const squad = await generateSquadForTeam(team, seasonFormatted, country);
        fs.writeFileSync(outputPath, JSON.stringify(squad, null, 2), 'utf8');
        completedCount++;
        console.log(`[${currentIdx + 1}/${allTasks.length}] ✅ Saved ${squad.length} players for: ${team.name} -> ${path.relative(ROOT_DIR, outputPath)}`);
      } catch (err) {
        errorCount++;
        console.error(`[${currentIdx + 1}/${allTasks.length}] ❌ ERROR generating squad for ${team.name}:`, err.message);
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  // Launch workers
  const workerPool = [];
  const activeWorkers = Math.min(concurrency, allTasks.length);
  for (let w = 0; w < activeWorkers; w++) {
    workerPool.push(worker(w + 1));
  }
  await Promise.all(workerPool);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n==================================================================");
  console.log("🏁 GENERATION BATCH FINISHED!");
  console.log("==================================================================");
  console.log(`• Total Teams Processed: ${allTasks.length}`);
  console.log(`• Newly Generated:       ${completedCount}`);
  console.log(`• Skipped (Existed):     ${skippedCount}`);
  console.log(`• Errors:                ${errorCount}`);
  console.log(`• Time Elapsed:          ${durationSec}s`);
  console.log(`• Saved Location:        ${seasonOutputDir}`);
  console.log("==================================================================\n");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
