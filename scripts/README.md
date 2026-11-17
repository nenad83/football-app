# Football App - Batch Squad Generator

This script allows you to pre-generate authentic, complete 22-man squads for any historical season (e.g. 1999/2000) and save them as permanent, offline JSON files in `src/data/rosters/<season>/<country>/<team>.json`.

---

## Why Pre-generate Squads?
1. **Instant Loading**: Squads load immediately (0 ms) with no lag or waiting.
2. **100% Offline**: Works without internet access and with zero live API calls during gameplay.
3. **No Quota/Cost**: You generate the squads once on your machine and never hit API limits while playing.
4. **Permanent**: The squads remain static and can be checked into git.

---

## Safe Testing (Dry Run)

You can preview exactly which teams will be processed **without making any API calls or creating files**:

```bash
# Preview all 1999 teams across all 16 leagues
node scripts/generateSeasonRosters.js --season 1999 --dry-run
```

---

## Testing on a Single Team or Single League

Before generating all 300+ teams, you can test on just **one team** or **one league**:

```bash
# Test on a single team only (e.g., Arsenal)
node scripts/generateSeasonRosters.js --season 1999 --team "Arsenal"

# Test on a single league only (e.g., English Premier League)
node scripts/generateSeasonRosters.js --season 1999 --league eng99

# Test on a 2nd division league (e.g., English Division 1)
node scripts/generateSeasonRosters.js --season 1999 --league eng99_d2

# Test on South American teams (e.g., Argentina Primera)
node scripts/generateSeasonRosters.js --season 1999 --league arg99
```

---

## Full Season Generation

When you are ready to generate the whole season:

```bash
node scripts/generateSeasonRosters.js --season 1999
```

### Resume & Safety:
* If you stop the script halfway through, you can run it again—it will **automatically skip** teams that are already generated so you never waste API calls or duplicate work.
* If you want to re-generate an existing team, pass the `--force` flag.

---

## Command-Line Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--season <year>` | Target season year or code (e.g. `1999` or `99`) | `1999` |
| `--league <name>` | Filter by league file or country (e.g. `eng99`, `ita`, `bra`) | `all` |
| `--team <name>` | Generate only for one specific team (e.g. `"Boca Juniors"`) | `all` |
| `--dry-run` | Preview teams and files without calling the API | `false` |
| `--force` | Overwrite existing squad files | `false` |
| `--concurrency <num>` | Number of parallel requests | `3` |
| `--delay <ms>` | Milliseconds delay between requests to stay under rate limits | `800` |
