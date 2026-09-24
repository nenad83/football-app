const commentaryDatabase = {
  midfield_win: [
    "{attacker} wins the midfield battle and presses forward!",
    "{attacker} dictates the tempo in midfield, launching a quick attack.",
    "{attacker} intercepts a sloppy pass in the center circle and moves forward!",
    "A delightful sequence of short passes from {attacker} breaks the opposition lines!",
    "{attacker} dominates the midfield, sending the wingers charging forward.",
    "Possession won! {attacker} quickly shifts from defense to attack.",
    "{attacker} capitalizes on a midfield error and springs a dangerous attack!",
    "A long ball finds the {attacker} playmaker, who spins and launches the attack.",
    "Sensational vision from the {attacker} midfielder, feeding the forwards.",
    "{attacker} recovers a loose ball and drives forward with speed!"
  ],
  midfield_draw: [
    "Fierce tactical struggle in the center circle! Neither side gains ground.",
    "Both midfields are canceling each other out. A real chess match out there!",
    "Heavy tackling in the midfield! The referee demands a clean game.",
    "A loose pass is intercepted, then immediately lost again. Scrappy play!",
    "The match has turned into a midfield grind, with both teams playing it safe.",
    "Neither team is willing to take risks. Possession keeps changing hands.",
    "A high pressing duel in the middle leaves no room for creative play.",
    "Both managers are shouting instructions as the midfield battle intensifies.",
    "Pass after pass, but neither side can find a way through the compact shape.",
    "A tough 50/50 challenge in the center circle leaves both players on the turf."
  ],
  attack_success: [
    "{attacker} threads a beautiful pass through the defense! Shooting chance!",
    "{attacker} breaks down the wing! Crosses it deep into the penalty area!",
    "A neat one-two gets {attacker} into the box! The keeper is in trouble!",
    "{attacker} finds space in the channel, a low cross finds the striker!",
    "Dribbling masterclass! {attacker} weaves past the defense into the box!",
    "A pinpoint long ball over the top finds {attacker}'s forward in space!",
    "Chaos in the penalty area! The ball falls perfectly for {attacker}!",
    "{attacker}'s winger cuts inside onto their stronger foot! Space opens up!",
    "A defensive lapse lets {attacker} run clean through on goal!",
    "Quick exchange of passes, and {attacker} has a clear sight of goal!"
  ],
  attack_fail: [
    "{defender} defender intercepts with a sliding tackle in the box!",
    "{defender} goalkeeper leaps out to collect the high cross!",
    "A crucial block from {defender}'s centerback deflects the ball away!",
    "{defender} stands firm, clearing the ball out of danger.",
    "A mistimed pass runs straight through to the {defender} goalkeeper.",
    "Excellent positioning by the {defender} defender to intercept the cross.",
    "{defender} high press forces the attacker to turn back and lose possession.",
    "Solid defensive structure! {defender} blocks all passing lanes.",
    "The attacker is muscled off the ball by {defender}'s robust defender.",
    "A desperate header away by {defender} clears the threat!"
  ],
  goal: [
    "GOAL!!! {attacker} strikes a roaring volley into the net!",
    "GOAL!!! {attacker} scores a spectacular shot from outside the box!",
    "GOAL!!! A tap-in at the far post! Clinical finishing by {attacker}!",
    "GOAL!!! The keeper stood no chance against that absolute rocket!",
    "GOAL!!! Header! The striker rises above everyone to find the corner!",
    "GOAL!!! Brilliant solo effort! {attacker} player goes wild in celebration!",
    "GOAL!!! A delicate chip over the rushing goalkeeper! Masterful!",
    "GOAL!!! Deflection! The ball takes a lucky bounce and trickles in!",
    "GOAL!!! Slotted home coolly! Unstoppable precision from {attacker}!",
    "GOAL!!! Bent it into the top corner! What a magnificent strike!"
  ],
  save: [
    "WHAT A SAVE! The {defender} goalkeeper punches it clear!",
    "DENIED! The {defender} goalkeeper makes a world-class save!",
    "Off the post! The shot rebounds away to safety!",
    "Crucial finger-tip save! The keeper tips it over the bar for a corner.",
    "The goalkeeper stands tall, blocking the close-range effort with his legs!",
    "A diving catch! The goalkeeper holds onto the ball securely.",
    "Stretched to the limit! {defender} keeper makes a stunning reaction save!",
    "The shot is too central, and the keeper catches it comfortably.",
    "Blocked on the line! A heroic clearance by the {defender} defender!",
    "The goalkeeper reads the shot perfectly and smothers the ball."
  ],
  penalty_goal: [
    "{attacker} scores a confident penalty into the top corner!",
    "{attacker} converts the penalty cleanly with a bottom corner shot!",
    "GOAL! {attacker} sends the goalkeeper the wrong way and slots it home!",
    "Beautifully taken! {attacker} lifts it gently down the middle!"
  ],
  penalty_miss: [
    "{attacker} hits the penalty directly against the crossbar!",
    "{attacker}'s penalty is saved by a brilliant diving keeper!",
    "MISS! {attacker} fires the penalty wide of the left post!",
    "SAVED! {defender}'s goalkeeper guesses correctly and makes a stunning block!"
  ]
};

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCommentary(template, attacker, defender) {
  return template
    .replace(/{attacker}/g, attacker)
    .replace(/{defender}/g, defender);
}

export function getMidfieldWinCommentary(attacker, defender) {
  return formatCommentary(getRandomElement(commentaryDatabase.midfield_win), attacker, defender);
}

export function getMidfieldDrawCommentary(attacker, defender) {
  return formatCommentary(getRandomElement(commentaryDatabase.midfield_draw), attacker, defender);
}

export function getAttackSuccessCommentary(attacker, defender) {
  return formatCommentary(getRandomElement(commentaryDatabase.attack_success), attacker, defender);
}

export function getAttackFailCommentary(defender, attacker) {
  return formatCommentary(getRandomElement(commentaryDatabase.attack_fail), attacker, defender);
}

export function getGoalCommentary(attacker, defender) {
  return formatCommentary(getRandomElement(commentaryDatabase.goal), attacker, defender);
}

export function getSaveCommentary(defender, attacker) {
  return formatCommentary(getRandomElement(commentaryDatabase.save), attacker, defender);
}

export function getPenaltyGoalCommentary(attacker, defender) {
  return formatCommentary(getRandomElement(commentaryDatabase.penalty_goal), attacker, defender);
}

export function getPenaltyMissCommentary(attacker, defender) {
  return formatCommentary(getRandomElement(commentaryDatabase.penalty_miss), attacker, defender);
}
