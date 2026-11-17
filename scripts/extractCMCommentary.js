/**
 * Extracts structured CM 01/02 match commentary events from events_eng.cfg
 * Preserves multi-line sequences, weights (w), delays (d), sounds (s), and placeholders (ph).
 */
const fs = require('fs');
const path = require('path');

const srcFile = 'F:/Igri/CM0102 Bosman Edition/game/Data/events_eng.cfg';
const destFile = path.resolve(__dirname, '../src/data/cmRetro/commentary.json');

if (!fs.existsSync(srcFile)) {
  console.error('events_eng.cfg not found at:', srcFile);
  process.exit(1);
}

const raw = fs.readFileSync(srcFile, 'latin1');
const lines = raw.split(/\r?\n/);

const events = {};
let currentEventName = null;
let currentEntry = null;

for (let rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  if (line.startsWith('# EVENT_')) {
    currentEventName = line.slice(2).trim();
    if (!events[currentEventName]) {
      events[currentEventName] = [];
    }
    currentEntry = null;
  } else if (line.startsWith('=') && currentEventName) {
    // Format: = id, weight, delay, Sound.wav, placeholders...
    const parts = line.slice(1).split(',').map(p => p.trim());
    const weight = parseInt(parts[1], 10) || 1;
    const delay = parseInt(parts[2], 10) || 8;
    const sound = parts[3] && parts[3] !== '0' ? parts[3] : null;
    const ph = parts.slice(4).join(', ').trim();

    currentEntry = {
      w: weight,
      d: delay,
      s: sound,
      ph,
      lines: []
    };
    events[currentEventName].push(currentEntry);
  } else if (line.startsWith('G ') && currentEntry) {
    const text = line.slice(2).trim();
    if (text) {
      currentEntry.lines.push(text);
    }
  }
}

console.log(`Parsed ${Object.keys(events).length} event groups from events_eng.cfg.`);
if (process.argv.includes('--write')) {
  fs.writeFileSync(destFile, JSON.stringify(events, null, 2), 'utf8');
  console.log(`Wrote structured commentary to ${destFile}`);
}
