/**
 * MatchCommentary.js
 *
 * Authentic Championship Manager 01/02 Live Commentary Engine.
 *
 * Integrates real active players from match lineups:
 * - Midfield battle: Midfielders win possession, dictate tempo, or get tackled/intercepted on drawn rolls
 * - Attack creation: Strikers/wingers cut inside, take on defenders, and break clean through on goal
 * - Defending: Centrebacks and fullbacks make sliding tackles, interceptions, and clearances
 * - Shots & Goals: Low drives, volleys, chips, and headers past goalkeepers
 * - Goalkeeping: Reflex saves, holding the ball, tipping onto the post/bar
 * - Penalties: Real penalty takers and goalkeepers
 *
 * Outputs commentary strings paired with authentic CM 01/02 sound triggers.
 */

export class CommentaryResult {
  constructor(text, sound = null, side = null) {
    this.text = text;
    this.sound = sound;
    this.side = side;
  }

  toString() {
    return this.text;
  }

  valueOf() {
    return this.text;
  }
}

function getRandomElement(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function createFallbackSectorPool(teamName = 'Team') {
  return {
    gk: [{ name: `${teamName} Goalkeeper`, position: 'GK' }],
    def: [{ name: `${teamName} Defender`, position: 'DC' }],
    mid: [{ name: `${teamName} Midfielder`, position: 'MC' }],
    att: [{ name: `${teamName} Forward`, position: 'ST' }],
    all: [{ name: `${teamName} Player`, position: 'MC' }]
  };
}

/**
 * Extracts active players grouped by pitch sector from a lineup object or array.
 */
export function extractPlayersFromLineup(lineupInput, teamName = 'Team') {
  if (!lineupInput) return createFallbackSectorPool(teamName);

  const players = Array.isArray(lineupInput)
    ? lineupInput.filter(Boolean)
    : Object.values(lineupInput).filter(Boolean);

  if (players.length === 0) return createFallbackSectorPool(teamName);

  const gk = [];
  const def = [];
  const mid = [];
  const att = [];

  players.forEach((p, idx) => {
    if (!p) return;
    const name = p.name || `${teamName} Player ${idx + 1}`;
    const pos = String(p.position || (p.positions && p.positions[0]) || '').toUpperCase();
    const cleanPlayer = { ...p, name };

    if (pos === 'GK' || pos.includes('GK')) {
      gk.push(cleanPlayer);
    } else if (['DC', 'DL', 'DR', 'SW', 'DF', 'CB', 'LB', 'RB', 'LWB', 'RWB'].some(k => pos.includes(k))) {
      def.push(cleanPlayer);
    } else if (['DMC', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR', 'MF', 'CM', 'DM', 'LM', 'RM'].some(k => pos.includes(k))) {
      mid.push(cleanPlayer);
    } else if (['ST', 'CF', 'SC', 'FC', 'FW', 'LW', 'RW'].some(k => pos.includes(k))) {
      att.push(cleanPlayer);
    } else {
      mid.push(cleanPlayer);
    }
  });

  const fallbackAll = players.map(p => ({ ...p, name: p.name || `${teamName} Player` }));

  return {
    gk: gk.length > 0 ? gk : [fallbackAll[0] || { name: `${teamName} Goalkeeper`, position: 'GK' }],
    def: def.length > 0 ? def : (mid.length > 0 ? mid : fallbackAll),
    mid: mid.length > 0 ? mid : (att.length > 0 ? att : fallbackAll),
    att: att.length > 0 ? att : (mid.length > 0 ? mid : fallbackAll),
    all: fallbackAll
  };
}

function pickPlayer(pool, fallbackName = 'Player') {
  if (!pool || pool.length === 0) return { name: fallbackName };
  return getRandomElement(pool) || { name: fallbackName };
}

function pickTwoDistinct(pool1, pool2, fallback1 = 'Player 1', fallback2 = 'Player 2') {
  const p1 = pickPlayer(pool1, fallback1);
  const remaining = pool2.filter(p => p && p.name && p.name !== p1.name);
  const p2 = pickPlayer(remaining.length > 0 ? remaining : pool2, fallback2);
  return { p1, p2 };
}

/* ==============================================================================
 * AUTHENTIC CM 01/02 COMMENTARY TEMPLATES WITH SOUND EFFECTS
 * ============================================================================== */

const CM_MIDFIELD_WIN = [
  { text: "<p1> wins the ball in the centre circle and slides a low forward pass to <p2>.", sound: "lowpass.wav" },
  { text: "<p1> dictates the tempo in midfield, feeding the ball forward to <p2>.", sound: "lowpass.wav" },
  { text: "<p1> intercepts neatly in the centre circle and moves the ball forward for <p2>.", sound: "intercep.wav" },
  { text: "<p1> surges across the halfway line and threads an incisive through ball into <p2>.", sound: "passnew.wav" },
  { text: "<p1> with a fine piece of vision, floating a pinpoint ball over the top to <p2>.", sound: "passnew.wav" },
  { text: "<p1> turns sharply past his marker and sprays a magnificent pass out to <p2>.", sound: "passnew.wav" },
  { text: "<p1> controls neatly in midfield and plays a sharp first-time pass to <p2>.", sound: "linepass.wav" },
  { text: "<p1> picks up the loose ball in the middle and releases <p2> down the channel.", sound: "okaypass.wav" },
  { text: "<p1> dispossesses his opponent and immediately triggers a quick attack through <p2>.", sound: "intercep.wav" },
  { text: "<p1> exchanges quick passes in the centre before finding <p2> in space.", sound: "passurge.wav" }
];

const CM_MIDFIELD_DRAW = [
  { text: "A fierce tactical struggle in the centre circle as <p1> and <p2> contest the ball.", sound: "challeng.wav" },
  { text: "<p1> tries to launch a forward pass, but <p2> comes in with an inch-perfect tackle!", sound: "badtack.wav" },
  { text: "<p1> looks to break forward, but <p2> reads the danger and intercepts cleanly.", sound: "intercep.wav" },
  { text: "<p1> is closed down quickly in the middle by <p2>, forcing a hurried pass into touch.", sound: "challeng.wav" },
  { text: "Tough 50/50 challenge! <p1> and <p2> collide heavily in the middle of the park.", sound: "challeng.wav" },
  { text: "<p1> attempts to thread the ball through, but <p2> stands firm to block the path.", sound: "goodblok.wav" },
  { text: "<p2> makes a robust challenge to strip <p1> of possession in midfield.", sound: "badtack.wav" },
  { text: "Heavy pressing in the middle of the pitch! <p1> loses the ball under pressure from <p2>.", sound: "intercep.wav" },
  { text: "<p1> and <p2> cancel each other out in a physical duel in the centre circle.", sound: "challeng.wav" }
];

const CM_ATTACK_SUCCESS = [
  { text: "<p1> beats <p2> for pace and breaks clean through on goal!", sound: "newurge.wav" },
  { text: "<p1> is free of the last defender! <p2> couldn't keep up with him!", sound: "newurge.wav" },
  { text: "<p1> cuts inside past <p2> and finds space on the edge of the penalty area!", sound: "nwchance.wav" },
  { text: "<p1> turns <p2> inside out with sublime skill and prepares to shoot!", sound: "nwchance.wav" },
  { text: "<p1> accelerates into the 18-yard box, skipping past a desperate challenge from <p2>!", sound: "newurge.wav" },
  { text: "<p1> receives the through ball, spins away from <p2> and has only the keeper to beat!", sound: "newurge.wav" },
  { text: "<p1> glides past <p2> down the flank and cuts a dangerous ball back into the box!", sound: "passurge.wav" },
  { text: "<p1> finds half a yard of space away from <p2> and pulls the trigger!", sound: "nwchance.wav" },
  { text: "<p1> takes on <p2>, leaves him trailing behind and bears down on goal!", sound: "newurge.wav" },
  { text: "<p1> controls neatly on the chest, spins away from <p2> and shoots!", sound: "nwchance.wav" }
];

const CM_ATTACK_FAIL = [
  { text: "<p1> executes a superb sliding tackle on <p2> inside the penalty area!", sound: "smlclap1.wav" },
  { text: "<p1> reads the danger brilliantly and intercepts the pass destined for <p2>.", sound: "intercep.wav" },
  { text: "<p1> uses his strength to muscle <p2> off the ball and clears the danger.", sound: "clear.wav" },
  { text: "<p1> throws his body on the line to block <p2>'s dangerous effort!", sound: "goodblok.wav" },
  { text: "<p1> rises highest in the box to head the cross clear before <p2> can reach it.", sound: "headclap.wav" },
  { text: "<p1> steps up smartly to catch <p2> in an offside trap!", sound: "whist3.wav" },
  { text: "<p1> stands tall against <p2> and shepherds the ball safely back to the keeper.", sound: "clear.wav" },
  { text: "<p1> puts in a robust challenge on <p2> to halt the attack in its tracks.", sound: "smlclap1.wav" },
  { text: "<p1> anticipates <p2>'s movement and boots the ball emphatically upfield.", sound: "clear.wav" }
];

const CM_GOAL = [
  { text: "GOAL FOR {team}!! <p1> drills a low drive into the bottom corner past <p2>!", sound: "goalmono.wav" },
  { text: "GOAL!! Unstoppable rocket! <p1> smashes it past <p2> into the top corner!", sound: "goal10.wav" },
  { text: "GOAL FOR {team}!! <p1> rises above everyone to plant a thumping header past <p2>!", sound: "goal11.wav" },
  { text: "GOAL!! <p1> keeps his composure, chipping the ball delightfully over <p2> into the net!", sound: "goalmono.wav" },
  { text: "GOAL FOR {team}!! <p1> catches it on the half-volley and blasts it past <p2>!", sound: "goal10.wav" },
  { text: "GOAL!! <p1> slots it coolly into the corner! <p2> was rooted to the spot!", sound: "goal11.wav" },
  { text: "GOAL FOR {team}!! Sensational solo run! <p1> rounds <p2> and taps into the empty net!", sound: "goalmono.wav" },
  { text: "GOAL!! <p1> pounces on the loose ball inside the six-yard box and buries it past <p2>!", sound: "goal10.wav" },
  { text: "GOAL FOR {team}!! <p1> curls a magnificent strike into the far corner beyond the reach of <p2>!", sound: "goal11.wav" }
];

const CM_SAVE = [
  { text: "WHAT A SAVE!! <p1> dives at full stretch to tip <p2>'s venomous drive around the post!", sound: "ooh4mono.wav" },
  { text: "DENIED!! <p1> pulls off a world-class reflex stop to keep out <p2>'s close-range effort!", sound: "oohmono.wav" },
  { text: "<p1> stands tall and clutches <p2>'s powerful shot securely to his chest!", sound: "oohclapm.wav" },
  { text: "OFF THE WOODWORK!! <p2>'s thunderous shot rebounds off the crossbar to safety!", sound: "postooh.wav" },
  { text: "<p1> reacts brilliantly, parrying away <p2>'s fierce volley!", sound: "palm.wav" },
  { text: "<p1> rushes off his line and smothers the ball at the feet of <p2>!", sound: "oohmono.wav" },
  { text: "<p2> drags the shot just wide of the left post! <p1> breathes a huge sigh of relief!", sound: "disappo.wav" },
  { text: "<p1> tips <p2>'s dipping header over the crossbar for a corner!", sound: "ooh4mono.wav" },
  { text: "<p2> blazes the shot high over the bar! What a wasted chance!", sound: "newmiss.wav" }
];

const CM_PENALTY_GOAL = [
  { text: "GOAL FOR {team}!! <p1> sends <p2> the wrong way and slots the penalty calmly home!", sound: "goalmono.wav" },
  { text: "GOAL!! <p1> hammers the penalty into the top corner! <p2> had no chance!", sound: "goal10.wav" },
  { text: "GOAL FOR {team}!! Cool as ice! <p1> strokes the penalty into the bottom left corner past <p2>!", sound: "goal11.wav" },
  { text: "GOAL!! <p1> stutters his run-up and clips the ball gently down the middle past <p2>!", sound: "goalmono.wav" }
];

const CM_PENALTY_MISS = [
  { text: "SAVED!! <p1> guesses the right way and pulls off a magnificent diving save to deny <p2>!", sound: "ooh4mono.wav" },
  { text: "MISSED!! <p1> watches as <p2> smashes the penalty against the crossbar!", sound: "postooh.wav" },
  { text: "SAVED!! <p2> tries a chip down the middle, but <p1> stands firm and catches it cleanly!", sound: "oohclapm.wav" },
  { text: "MISSED!! <p2> sends the spot-kick inches wide of the left-hand post!", sound: "newmiss.wav" }
];

/* ==============================================================================
 * EXPORTED COMMENTARY GENERATORS (Backwards compatible with both 2 & 4 args)
 * ============================================================================== */

export function getMidfieldWinCommentary(attackerTeam, defenderTeam, attackerLineup = null, defenderLineup = null) {
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);
  const { p1, p2 } = pickTwoDistinct(
    attPool.mid,
    [...attPool.att, ...attPool.mid],
    `${attackerTeam} Midfielder`,
    `${attackerTeam} Forward`
  );

  const tpl = getRandomElement(CM_MIDFIELD_WIN);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, attackerTeam);

  return new CommentaryResult(text, tpl.sound, null);
}

export function getMidfieldDrawCommentary(teamA, teamB, lineupA = null, lineupB = null) {
  const poolA = extractPlayersFromLineup(lineupA, teamA);
  const poolB = extractPlayersFromLineup(lineupB, teamB);

  const p1 = pickPlayer(poolA.mid, `${teamA} Midfielder`);
  const p2 = pickPlayer([...poolB.mid, ...poolB.def], `${teamB} Midfielder`);

  const tpl = getRandomElement(CM_MIDFIELD_DRAW);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name);

  return new CommentaryResult(text, tpl.sound, 'neutral');
}

export function getAttackSuccessCommentary(attackerTeam, defenderTeam, attackerLineup = null, defenderLineup = null) {
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);
  const defPool = extractPlayersFromLineup(defenderLineup, defenderTeam);

  const p1 = pickPlayer(attPool.att.length > 0 ? attPool.att : attPool.mid, `${attackerTeam} Forward`);
  const p2 = pickPlayer(defPool.def.length > 0 ? defPool.def : defPool.all, `${defenderTeam} Defender`);

  const tpl = getRandomElement(CM_ATTACK_SUCCESS);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, attackerTeam);

  return new CommentaryResult(text, tpl.sound, null);
}

export function getAttackFailCommentary(defenderTeam, attackerTeam, defenderLineup = null, attackerLineup = null) {
  const defPool = extractPlayersFromLineup(defenderLineup, defenderTeam);
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);

  const p1 = pickPlayer(defPool.def.length > 0 ? defPool.def : defPool.all, `${defenderTeam} Defender`);
  const p2 = pickPlayer(attPool.att.length > 0 ? attPool.att : attPool.mid, `${attackerTeam} Forward`);

  const tpl = getRandomElement(CM_ATTACK_FAIL);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, defenderTeam);

  return new CommentaryResult(text, tpl.sound, null);
}

export function getGoalCommentary(attackerTeam, defenderTeam, attackerLineup = null, defenderLineup = null) {
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);
  const defPool = extractPlayersFromLineup(defenderLineup, defenderTeam);

  const p1 = pickPlayer(attPool.att.length > 0 ? attPool.att : attPool.all, `${attackerTeam} Forward`);
  const p2 = pickPlayer(defPool.gk.length > 0 ? defPool.gk : [{ name: `${defenderTeam} Goalkeeper` }], `${defenderTeam} Goalkeeper`);

  const tpl = getRandomElement(CM_GOAL);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, attackerTeam.toUpperCase());

  return new CommentaryResult(text, tpl.sound, null);
}

export function getSaveCommentary(defenderTeam, attackerTeam, defenderLineup = null, attackerLineup = null) {
  const defPool = extractPlayersFromLineup(defenderLineup, defenderTeam);
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);

  const p1 = pickPlayer(defPool.gk.length > 0 ? defPool.gk : [{ name: `${defenderTeam} Goalkeeper` }], `${defenderTeam} Goalkeeper`);
  const p2 = pickPlayer(attPool.att.length > 0 ? attPool.att : attPool.all, `${attackerTeam} Forward`);

  const tpl = getRandomElement(CM_SAVE);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, defenderTeam);

  return new CommentaryResult(text, tpl.sound, null);
}

export function getPenaltyGoalCommentary(attackerTeam, defenderTeam, attackerLineup = null, defenderLineup = null) {
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);
  const defPool = extractPlayersFromLineup(defenderLineup, defenderTeam);

  const p1 = pickPlayer(attPool.att.length > 0 ? attPool.att : attPool.all, `${attackerTeam} Striker`);
  const p2 = pickPlayer(defPool.gk.length > 0 ? defPool.gk : [{ name: `${defenderTeam} Goalkeeper` }], `${defenderTeam} Goalkeeper`);

  const tpl = getRandomElement(CM_PENALTY_GOAL);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, attackerTeam.toUpperCase());

  return new CommentaryResult(text, tpl.sound, null);
}

export function getPenaltyMissCommentary(attackerTeam, defenderTeam, attackerLineup = null, defenderLineup = null) {
  const attPool = extractPlayersFromLineup(attackerLineup, attackerTeam);
  const defPool = extractPlayersFromLineup(defenderLineup, defenderTeam);

  const p1 = pickPlayer(defPool.gk.length > 0 ? defPool.gk : [{ name: `${defenderTeam} Goalkeeper` }], `${defenderTeam} Goalkeeper`);
  const p2 = pickPlayer(attPool.att.length > 0 ? attPool.att : attPool.all, `${attackerTeam} Striker`);

  const tpl = getRandomElement(CM_PENALTY_MISS);
  const text = tpl.text
    .replace(/<p1>/g, p1.name)
    .replace(/<p2>/g, p2.name)
    .replace(/{team}/g, attackerTeam);

  return new CommentaryResult(text, tpl.sound, null);
}
