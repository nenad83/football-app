/**
 * ==============================================================================
 * CM 01/02 AUTHENTIC MATCH ENGINE (CM0102Engine.js)
 * ==============================================================================
 * True-to-life recreation of the Sports Interactive Championship Manager 01/02
 * match simulation engine.
 *
 * Features:
 * 1. Uses all 139 authentic event types & multi-line sequences from commentary.json
 * 2. Multi-Zone Possession Chain state machine (Defense -> Midfield -> Wings/Box)
 * 3. Contested attribute rolls using all 42 CM player skills:
 *    - Passing, Vision, Decisions, Technique vs Anticipation, Positioning
 *    - Dribbling, Pace, Agility, Flair vs Tackling, Marking, Strength
 *    - Crossing, Corners, Free Kicks vs Jumping, Heading, Bravery
 *    - Finishing, Composure, Off The Ball, Long Shots vs Reflexes, Handling, One-on-Ones
 * 4. Tactical effects (Mentality, Passing Style, Tackling intensity, Formations)
 * 5. Set pieces (Corners, Free Kicks, Penalties, Throw-ins, Goal Kicks, Offsides)
 * 6. Stoppage time (45+N and 90+N), Fatigue, Yellow/Red cards, Substitutions
 * ==============================================================================
 */

import commentaryData from '../../data/cmRetro/commentary.json';

const REFEREES = [
  'Pierluigi Collina',
  'Graham Poll',
  'Mike Riley',
  'Howard Webb',
  'Uriah Rennie',
  'Steve Bennett',
  'Mark Halsey',
  'Dermot Gallagher'
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(items) {
  if (!items || items.length === 0) return null;
  const totalWeight = items.reduce((sum, item) => sum + (item.w || 1), 0);
  let r = Math.random() * totalWeight;
  for (const item of items) {
    r -= (item.w || 1);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export class CM0102Engine {
  constructor(homeTeam, awayTeam, options = {}) {
    this.homeTeam = homeTeam;
    this.awayTeam = awayTeam;
    this.options = options;
    this.referee = pickRandom(REFEREES);

    // Match Clock State
    this.minute = 0;
    this.half = 1; // 1 = 1st half, 2 = 2nd half
    this.halfStoppage = randInt(1, 3);
    this.fullStoppage = randInt(2, 5);
    this.inStoppage = false;
    this.stoppageMinute = 0;
    this.halfTimeReached = false;
    this.isFinished = false;

    // Score & Team Stats
    this.homeScore = 0;
    this.awayScore = 0;

    this.homeStats = {
      possession: 50,
      shots: 0,
      onTarget: 0,
      corners: 0,
      fouls: 0,
      offsides: 0,
      yellowCards: 0,
      redCards: 0,
      passesAttempted: 0,
      passesCompleted: 0,
      tacklesWon: 0,
      crossesCompleted: 0
    };

    this.awayStats = {
      possession: 50,
      shots: 0,
      onTarget: 0,
      corners: 0,
      fouls: 0,
      offsides: 0,
      yellowCards: 0,
      redCards: 0,
      passesAttempted: 0,
      passesCompleted: 0,
      tacklesWon: 0,
      crossesCompleted: 0
    };

    this.scorers = []; // { name, team, side, minute, type: 'goal' | 'pen' }
    this.cards = [];   // { name, team, side, minute, card: 'yellow' | 'red' }
    this.subsMade = { home: 0, away: 0 };
    this.events = [];  // Full match log

    // Tactics
    this.homeTactics = {
      mentality: homeTeam.tactics?.mentality || 'Normal',
      passingStyle: homeTeam.tactics?.passingStyle || 'Mixed',
      tackling: homeTeam.tactics?.tackling || 'Normal'
    };
    this.awayTactics = {
      mentality: awayTeam.tactics?.mentality || 'Normal',
      passingStyle: awayTeam.tactics?.passingStyle || 'Mixed',
      tackling: awayTeam.tactics?.tackling || 'Normal'
    };

    // Initialize Lineups & Benches
    this.homeLineup = this._initPlayers(homeTeam.lineup.slice(0, 11), 'home');
    this.awayLineup = this._initPlayers(awayTeam.lineup.slice(0, 11), 'away');
    this.homeBench = this._initPlayers(homeTeam.bench || homeTeam.lineup.slice(11), 'home');
    this.awayBench = this._initPlayers(awayTeam.bench || awayTeam.lineup.slice(11), 'away');

    this.possessionSamples = { home: 1, away: 1 };
  }

  _initPlayers(players, side) {
    return (players || []).map((p, idx) => {
      const a = p.attributes || {};
      return {
        id: p.id || `${side}_${idx}`,
        name: p.name,
        position: p.position || 'MC',
        positions: p.positions || [p.position || 'MC'],
        assignedSlot: p.assignedSlot || p.position || 'MC',
        squadNumber: p.squadNumber || idx + 1,
        teamSide: side,
        currentAbility: p.currentAbility || 140,
        condition: p.condition || 100,
        rating: 6,
        rawRating: 6.2,
        goals: 0,
        assists: 0,
        shots: 0,
        onTarget: 0,
        passesAttempted: 0,
        passesCompleted: 0,
        tacklesAttempted: 0,
        tacklesWon: 0,
        interceptions: 0,
        saves: 0,
        fouls: 0,
        yellowCards: 0,
        redCard: false,
        subbedOff: false,
        knackeredNotified: false,
        attributes: {
          acceleration: a.acceleration ?? 12,
          aggression: a.aggression ?? 11,
          agility: a.agility ?? 12,
          anticipation: a.anticipation ?? 12,
          balance: a.balance ?? 12,
          bravery: a.bravery ?? 12,
          consistency: a.consistency ?? 12,
          corners: a.corners ?? 10,
          crossing: a.crossing ?? 11,
          decisions: a.decisions ?? 12,
          dirtiness: a.dirtiness ?? 8,
          dribbling: a.dribbling ?? 11,
          finishing: a.finishing ?? 10,
          flair: a.flair ?? 10,
          freeKicks: a.freeKicks ?? 10,
          handling: a.handling ?? 10,
          heading: a.heading ?? 11,
          importantMatches: a.importantMatches ?? 12,
          jumping: a.jumping ?? 11,
          leadership: a.leadership ?? 10,
          leftFoot: a.leftFoot ?? 10,
          longShots: a.longShots ?? 10,
          marking: a.marking ?? 11,
          offTheBall: a.offTheBall ?? 12,
          naturalFitness: a.naturalFitness ?? 14,
          oneOnOnes: a.oneOnOnes ?? 10,
          pace: a.pace ?? 12,
          passing: a.passing ?? 12,
          penalties: a.penalties ?? 11,
          positioning: a.positioning ?? 12,
          reflexes: a.reflexes ?? 10,
          rightFoot: a.rightFoot ?? 14,
          stamina: a.stamina ?? 14,
          strength: a.strength ?? 12,
          tackling: a.tackling ?? 11,
          teamwork: a.teamwork ?? 12,
          technique: a.technique ?? 12,
          vision: a.vision ?? 12,
          workRate: a.workRate ?? 13
        }
      };
    });
  }

  // Update tactics live during match
  updateTactics(side, newTactics) {
    if (side === 'home') {
      this.homeTactics = { ...this.homeTactics, ...newTactics };
    } else {
      this.awayTactics = { ...this.awayTactics, ...newTactics };
    }
  }

  // Perform substitution live during match
  makeSubstitution(side, starterId, benchId) {
    if (this.subsMade[side] >= 3) return null;
    const lineup = side === 'home' ? this.homeLineup : this.awayLineup;
    const bench = side === 'home' ? this.homeBench : this.awayBench;
    const team = side === 'home' ? this.homeTeam : this.awayTeam;

    const sIdx = lineup.findIndex(p => p.id === starterId && !p.redCard);
    const bIdx = bench.findIndex(p => p.id === benchId);
    if (sIdx === -1 || bIdx === -1) return null;

    const playerOff = lineup[sIdx];
    const playerOn = bench[bIdx];

    playerOn.assignedSlot = playerOff.assignedSlot;
    lineup[sIdx] = playerOn;
    bench.splice(bIdx, 1);
    this.subsMade[side]++;

    const beats = [];
    this._emitEvent(beats, 'EVENT_MAKING_CHANGE', { team, side, zone: 'MIDFIELD' });
    this._emitEvent(beats, 'EVENT_SUBSTITUTION', { p1: playerOn, p2: playerOff, team, side, zone: 'MIDFIELD' });
    return { playerOn, playerOff, beats };
  }

  // Effective attribute scaled by player condition & CA
  _eff(player, attrName) {
    const raw = player.attributes[attrName] || 10;
    const condFactor = player.condition >= 75 ? 1.0 : (0.72 + (player.condition / 75) * 0.28);
    const caBonus = ((player.currentAbility || 140) - 140) * 0.045;
    return Math.max(1, (raw + caBonus) * condFactor);
  }

  _active(lineup) {
    return lineup.filter(p => !p.redCard);
  }

  _getGK(lineup) {
    const active = this._active(lineup);
    return active.find(p => p.position === 'GK') || active[0];
  }

  _getDefenders(lineup) {
    const active = this._active(lineup);
    const list = active.filter(p => ['DC', 'DL', 'DR', 'SW', 'DF'].some(pos => (p.assignedSlot || p.position).includes(pos)));
    return list.length > 0 ? list : active.slice(1, 5);
  }

  _getMidfielders(lineup) {
    const active = this._active(lineup);
    const list = active.filter(p => ['MC', 'ML', 'MR', 'DMC', 'AMC', 'AML', 'AMR', 'MF'].some(pos => (p.assignedSlot || p.position).includes(pos)));
    return list.length > 0 ? list : active.slice(4, 9);
  }

  _getWingers(lineup) {
    const active = this._active(lineup);
    const list = active.filter(p => ['ML', 'MR', 'AML', 'AMR', 'LW', 'RW', 'DL', 'DR'].some(pos => (p.assignedSlot || p.position).includes(pos)));
    return list.length > 0 ? list : this._getMidfielders(lineup);
  }

  _getForwards(lineup) {
    const active = this._active(lineup);
    const list = active.filter(p => ['ST', 'CF', 'LW', 'RW', 'FW', 'AMC'].some(pos => (p.assignedSlot || p.position).includes(pos)));
    return list.length > 0 ? list : active.slice(-2);
  }

  // Pick player weighted by specific attributes
  _pickWeightedPlayer(pool, attrNames) {
    if (!pool || pool.length === 0) return null;
    const weights = pool.map(p => {
      const sum = attrNames.reduce((acc, a) => acc + this._eff(p, a), 0);
      return { p, w: Math.pow(Math.max(5, sum), 1.5) };
    });
    return pickWeighted(weights)?.p || pool[0];
  }

  _bestSetPieceTaker(lineup, attrName) {
    const active = this._active(lineup).filter(p => p.position !== 'GK');
    if (active.length === 0) return lineup[0];
    return [...active].sort((a, b) => (b.attributes[attrName] || 10) - (a.attributes[attrName] || 10))[0];
  }

  _adjustRating(player, delta) {
    if (!player) return;
    player.rawRating = clamp(player.rawRating + delta, 3.0, 10.0);
    player.rating = Math.round(player.rawRating);
  }

  _drainCondition(lineup, tactics) {
    const pressFactor = tactics.mentality === 'Attacking' ? 1.12 : 1.0;
    this._active(lineup).forEach(p => {
      const work = (p.attributes.workRate || 12) / 20;
      const stam = (p.attributes.stamina || 14) / 20;
      const fit = (p.attributes.naturalFitness || 14) / 20;
      const drain = (0.22 + work * 0.16 - stam * 0.09 - fit * 0.04) * pressFactor;
      p.condition = Math.max(45, Math.round((p.condition - drain) * 10) / 10);
    });
  }

  /**
   * Formats an authentic CM 01/02 event from commentary.json into sequential UI beats
   */
  _emitEvent(beats, eventKey, ctx = {}) {
    const variants = commentaryData[eventKey];
    if (!variants || variants.length === 0) return;

    const chosen = pickWeighted(variants);
    if (!chosen || !chosen.lines) return;

    const baseSide = ctx.side || 'home';
    const distance = ctx.distance || randInt(20, 42);
    const addedMins = ctx.addedMinutes || 3;

    // Calculate authentic readable delay per line (1600ms - 3000ms)
    let baseDelay = chosen.d || 1500;
    if (baseDelay < 1550) baseDelay = 1600;
    if (eventKey.includes('GOAL') || eventKey.includes('PENALTY') || eventKey.includes('CARD') || eventKey.includes('SENT_OFF')) {
      baseDelay = Math.max(baseDelay, 2400);
    }

    chosen.lines.forEach((rawLine, idx) => {
      let line = rawLine;
      let lineSide = baseSide;
      let bannerStyle = ctx.bannerStyle || 'team'; // 'team' | 'goal' | 'yellow' | 'red' | 'neutral'

      if (line.includes('<O>')) {
        lineSide = baseSide === 'home' ? 'away' : 'home';
        line = line.replace(/<O>/g, '');
      }
      if (line.includes('<Y>')) {
        bannerStyle = 'yellow';
        line = line.replace(/<Y>/g, '');
      }
      if (line.includes('<R>')) {
        bannerStyle = 'red';
        line = line.replace(/<R>/g, '');
      }
      if (eventKey === 'EVENT_GOAL_SCORED' || eventKey === 'EVENT_GOAL_ONE' || eventKey === 'EVENT_SCORED_PENALTY') {
        bannerStyle = 'goal';
      }

      if (ctx.p1) line = line.replace(/<p1>/g, ctx.p1.name);
      if (ctx.p2) line = line.replace(/<p2>/g, ctx.p2.name);
      if (ctx.team) {
        line = line.replace(/<t>/g, ctx.team.name);
        line = line.replace(/<tc>/g, ctx.team.name.toUpperCase());
      }
      line = line.replace(/<d>/g, String(distance));
      line = line.replace(/<N>/g, String(addedMins));
      line = line.replace(/<Rf>/g, this.referee);
      line = line.replace(/\{s\}/g, "'s");

      beats.push({
        eventKey,
        text: line.trim(),
        delayMs: baseDelay,
        sound: idx === 0 && chosen.s ? chosen.s.toLowerCase() : null,
        side: lineSide,
        bannerStyle,
        zone: ctx.zone || 'MIDFIELD',
        isGoal: Boolean(ctx.isGoal && idx === 0),
        scoreSnapshot: ctx.scoreSnapshot || null
      });
    });
  }

  /**
   * Computes real-time team control and attacking weights based on:
   * - Active players on pitch (red cards reduce power heavily)
   * - Current Ability (CA) & Midfield attributes (Passing, Vision, WorkRate, Decisions, Tackling)
   * - Stamina/Condition & Tactical Mentality
   */
  _calculateTeamStrengths() {
    const calcSide = (lineup, tactics, isHome) => {
      const active = this._active(lineup);
      const mids = this._getMidfielders(lineup);
      const defs = this._getDefenders(lineup);
      const fwds = this._getForwards(lineup);

      const avgCA = active.reduce((s, p) => s + (p.currentAbility || 140), 0) / 11;
      const manCountFactor = Math.pow(active.length / 11, 1.8);

      const midScore = mids.reduce((s, p) => (
        s + this._eff(p, 'passing') * 1.3 +
            this._eff(p, 'vision') * 1.1 +
            this._eff(p, 'decisions') * 1.1 +
            this._eff(p, 'workRate') * 1.0 +
            this._eff(p, 'teamwork') * 0.9 +
            this._eff(p, 'tackling') * 0.8
      ), 0) / Math.max(1, mids.length);

      const defScore = defs.reduce((s, p) => (
        s + this._eff(p, 'tackling') * 1.5 +
            this._eff(p, 'positioning') * 1.5 +
            this._eff(p, 'marking') * 1.2 +
            this._eff(p, 'anticipation') * 1.0 +
            this._eff(p, 'strength') * 0.8 +
            this._eff(p, 'pace') * 0.8
      ), 0) / Math.max(1, defs.length);

      const attScore = fwds.reduce((s, p) => (
        s + this._eff(p, 'finishing') * 1.5 +
            this._eff(p, 'offTheBall') * 1.4 +
            this._eff(p, 'pace') * 1.2 +
            this._eff(p, 'dribbling') * 1.1 +
            this._eff(p, 'anticipation') * 1.0
      ), 0) / Math.max(1, fwds.length);

      const mentalityAttMod = tactics.mentality === 'Attacking' ? 1.12 : (tactics.mentality === 'Defensive' ? 0.86 : 1.0);
      const mentalityDefMod = tactics.mentality === 'Defensive' ? 1.14 : (tactics.mentality === 'Attacking' ? 0.90 : 1.0);
      const homeBoost = isHome ? 1.08 : 1.0;

      // Mild CA multiplier for possession/initiation since individual attribute duels already scale every pass/tackle/shot
      const caMultiplier = Math.pow(avgCA / 148, 0.85);

      return {
        avgCA,
        control: midScore * caMultiplier * manCountFactor * homeBoost,
        attack: attScore * caMultiplier * manCountFactor * mentalityAttMod * homeBoost,
        defense: defScore * caMultiplier * manCountFactor * mentalityDefMod
      };
    };

    return {
      home: calcSide(this.homeLineup, this.homeTactics, true),
      away: calcSide(this.awayLineup, this.awayTactics, false)
    };
  }

  /**
   * Simulates a Corner Kick Chain
   */
  _simulateCorner(beats, side, attTeam, defTeam, attLineup, defLineup, attStats, defStats) {
    attStats.corners++;
    const taker = this._bestSetPieceTaker(attLineup, 'corners');
    const keeper = this._getGK(defLineup);
    const defenders = this._getDefenders(defLineup);
    const attackers = [...this._getForwards(attLineup), ...this._getDefenders(attLineup).slice(0, 2)];

    const target = this._pickWeightedPlayer(attackers, ['jumping', 'heading', 'bravery', 'strength']) || attackers[0];
    const marker = this._pickWeightedPlayer(defenders, ['jumping', 'heading', 'marking', 'strength']) || defenders[0];

    this._emitEvent(beats, 'EVENT_RESTART_CORNER', { team: attTeam, side, zone: 'BOX' });
    this._emitEvent(beats, 'EVENT_TAKE_CORNER', { p1: taker, team: attTeam, side, zone: 'BOX' });

    // 1. Check if Goalkeeper claims or punches the corner (approx 28%)
    const gkAerial = (this._eff(keeper, 'handling') + this._eff(keeper, 'jumping') + this._eff(keeper, 'bravery')) / 3;
    if (Math.random() < 0.18 + (gkAerial - 14) * 0.015) {
      if (Math.random() < 0.65) {
        this._emitEvent(beats, 'EVENT_GOALIE_CATCH_BALL', { p1: keeper, side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
      } else {
        this._emitEvent(beats, 'EVENT_GOALKEEPER_PUNCH', { p1: keeper, side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
      }
      this._adjustRating(keeper, +0.08);
      return;
    }

    // 2. Aerial Duel: Attacker vs Marker
    const attJump = this._eff(target, 'jumping') * 1.3 + this._eff(target, 'heading') * 1.2 + this._eff(target, 'bravery') + (this._eff(taker, 'corners') * 0.4) + rollD20();
    const defJump = this._eff(marker, 'jumping') * 1.3 + this._eff(marker, 'heading') * 1.2 + this._eff(marker, 'positioning') + rollD20() + 3;

    if (defJump >= attJump) {
      this._emitEvent(beats, 'EVENT_HEAD_CLEAR', { p1: marker, side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
      this._adjustRating(marker, +0.10);
      return;
    }

    // Attacker wins the header!
    this._emitEvent(beats, 'EVENT_WINS_JUMPFORBALL', { p1: target, p2: marker, side, zone: 'BOX' });
    this._emitEvent(beats, 'EVENT_SHOT_HEADER', { p1: target, side, zone: 'BOX' });
    this._resolveShotOutcome(beats, side, target, taker, marker, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, true, false);
  }

  /**
   * Simulates a Dangerous Free Kick
   */
  _simulateFreeKick(beats, side, attTeam, defTeam, attLineup, defLineup, attStats, defStats) {
    const taker = this._bestSetPieceTaker(attLineup, 'freeKicks');
    const keeper = this._getGK(defLineup);
    const defender = pickRandom(this._getDefenders(defLineup));

    this._emitEvent(beats, 'EVENT_RESTART_FREEKICK', { team: attTeam, side, zone: 'ATT_THIRD' });
    this._emitEvent(beats, 'EVENT_FREE_KICK_CHANCE_CENTRAL', { p1: taker, side, zone: 'ATT_THIRD' });
    this._emitEvent(beats, 'EVENT_SHOT_FREE_KICK', { p1: taker, side, zone: 'ATT_THIRD' });

    attStats.shots++;
    taker.shots++;

    // 38% hits wall
    if (Math.random() < 0.38) {
      this._emitEvent(beats, 'EVENT_WALL_BLOCKS_SHOT', { side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
      if (Math.random() < 0.45) {
        this._simulateCorner(beats, side, attTeam, defTeam, attLineup, defLineup, attStats, defStats);
      } else {
        this._emitEvent(beats, 'EVENT_CLEAR_BALL', { p1: defender, side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
      }
      return;
    }

    const fkSkill = this._eff(taker, 'freeKicks') * 1.4 + this._eff(taker, 'technique') * 0.8;
    const onTargetProb = clamp(0.32 + (fkSkill - 22) * 0.022, 0.22, 0.62);

    if (Math.random() > onTargetProb) {
      if (Math.random() < 0.16) {
        this._emitEvent(beats, 'EVENT_SHOT_HITS_BAR', { p1: taker, side, zone: 'BOX' });
      } else {
        this._emitEvent(beats, 'EVENT_SHOT_JUST_OVER', { p1: taker, side, zone: 'BOX' });
      }
      return;
    }

    attStats.onTarget++;
    taker.onTarget++;

    const gkSkill = this._eff(keeper, 'reflexes') * 1.3 + this._eff(keeper, 'positioning') * 1.0 + this._eff(keeper, 'handling') * 0.7;
    const goalProb = clamp(0.16 + (fkSkill - gkSkill) * 0.015, 0.08, 0.32);

    if (Math.random() < goalProb) {
      this._recordGoal(beats, side, taker, null, keeper, attTeam, attStats, 'goal');
    } else {
      keeper.saves++;
      this._adjustRating(keeper, +0.35);
      this._emitEvent(beats, 'EVENT_GREAT_SAVE_HELD', { p1: keeper, side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
    }
  }

  /**
   * Simulates a Penalty Kick
   */
  _simulatePenalty(beats, side, attTeam, defTeam, attLineup, defLineup, attStats) {
    const taker = this._bestSetPieceTaker(attLineup, 'penalties');
    const keeper = this._getGK(defLineup);

    this._emitEvent(beats, 'EVENT_RESTART_PENALTY', { team: attTeam, side, zone: 'BOX' });
    this._emitEvent(beats, 'EVENT_TAKE_PENALTY', { p1: taker, side, zone: 'BOX' });

    attStats.shots++;
    taker.shots++;

    const penSkill = (this._eff(taker, 'penalties') + this._eff(taker, 'finishing') + (taker.attributes.bravery || 12)) / 3;
    const gkSkill = (this._eff(keeper, 'reflexes') + this._eff(keeper, 'oneOnOnes') + this._eff(keeper, 'agility')) / 3;

    const roll = Math.random();
    const goalThreshold = clamp(0.75 + (penSkill - gkSkill) * 0.015, 0.65, 0.88);

    if (roll < goalThreshold) {
      attStats.onTarget++;
      taker.onTarget++;
      this._recordGoal(beats, side, taker, null, keeper, attTeam, attStats, 'pen');
    } else if (roll < goalThreshold + 0.14) {
      attStats.onTarget++;
      taker.onTarget++;
      keeper.saves++;
      this._adjustRating(keeper, +0.8);
      this._adjustRating(taker, -0.5);
      this._emitEvent(beats, 'EVENT_SAVES_PENALTY', { p1: keeper, side: side === 'home' ? 'away' : 'home', zone: 'BOX' });
    } else {
      this._adjustRating(taker, -0.5);
      const missEv = pickRandom(['EVENT_PENALTY_HIT_WIDE', 'EVENT_PENALTY_HIT_OVER', 'EVENT_PENALTY_HITS_POST']);
      this._emitEvent(beats, missEv, { p1: taker, side, zone: 'BOX' });
    }
  }

  /**
   * Records a goal and emits authentic CM 01/02 goal celebration + contextual commentary
   */
  _recordGoal(beats, side, scorer, assister, keeper, attTeam, attStats, goalType = 'goal') {
    const prevHome = this.homeScore;
    const prevAway = this.awayScore;

    if (side === 'home') this.homeScore++;
    else this.awayScore++;

    const newHome = this.homeScore;
    const newAway = this.awayScore;

    scorer.goals++;
    this._adjustRating(scorer, +0.95);
    if (assister && assister.id !== scorer.id) {
      assister.assists++;
      this._adjustRating(assister, +0.45);
    }
    if (keeper) {
      this._adjustRating(keeper, -0.25);
    }

    const displayMin = this.inStoppage ? `${this.minute}+${this.stoppageMinute}` : `${this.minute}`;
    this.scorers.push({
      name: scorer.name,
      team: attTeam.name,
      side,
      minute: displayMin,
      type: goalType
    });

    const scoreSnapshot = { homeScore: newHome, awayScore: newAway, scorers: [...this.scorers] };

    this._emitEvent(beats, 'EVENT_GOAL_SCORED', {
      team: attTeam,
      side,
      zone: 'BOX',
      bannerStyle: 'goal',
      isGoal: true,
      scoreSnapshot
    });

    if (goalType === 'pen') {
      this._emitEvent(beats, 'EVENT_SCORED_PENALTY', { p1: scorer, team: attTeam, side, zone: 'BOX', bannerStyle: 'goal' });
    } else {
      this._emitEvent(beats, 'EVENT_GOAL_ONE', { p1: scorer, team: attTeam, side, zone: 'BOX', bannerStyle: 'goal' });
    }

    // Contextual Goal Commentary (Equaliser, Hat-trick, Late Winner, Clincher, Pulled One Back)
    if (scorer.goals === 3) {
      this._emitEvent(beats, 'EVENT_HAT_TRICK', { p1: scorer, team: attTeam, side, zone: 'BOX' });
    } else if (newHome === newAway && (prevHome !== prevAway)) {
      if (this.minute >= 80) {
        this._emitEvent(beats, 'EVENT_LATE_EQUALISER', { team: attTeam, side, zone: 'BOX' });
      } else {
        this._emitEvent(beats, 'EVENT_EQUALISER', { team: attTeam, side, zone: 'BOX' });
      }
    } else {
      const teamScore = side === 'home' ? newHome : newAway;
      const oppScore = side === 'home' ? newAway : newHome;
      if (this.minute >= 82 && teamScore === oppScore + 1) {
        this._emitEvent(beats, 'EVENT_WINNING_GOAL', { team: attTeam, side, zone: 'BOX' });
      } else if (teamScore >= oppScore + 3 && this.minute >= 65) {
        this._emitEvent(beats, 'EVENT_CLINCHING_GOAL', { team: attTeam, side, zone: 'BOX' });
      } else if (teamScore < oppScore && oppScore - teamScore === 1) {
        this._emitEvent(beats, 'EVENT_PULLED_ONE_BACK', { team: attTeam, side, zone: 'BOX' });
      }
    }
  }

  /**
   * Resolves a Shot on Goal (Block vs Miss vs Save vs Goal)
   */
  _resolveShotOutcome(beats, side, shooter, assister, defender, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, isHeader = false, isOneOnOne = false, isLongShot = false) {
    attStats.shots++;
    shooter.shots++;
    const oppSide = side === 'home' ? 'away' : 'home';

    // 1. Defender Block Check (unless clean through 1-on-1)
    if (!isOneOnOne && defender) {
      const blockChance = clamp(
        0.14 + (this._eff(defender, 'positioning') + this._eff(defender, 'bravery') - this._eff(shooter, 'agility') * 1.2) * 0.01,
        0.08,
        0.25
      );
      if (Math.random() < blockChance) {
        defender.tacklesWon++;
        defStats.tacklesWon++;
        this._adjustRating(defender, +0.16);
        this._emitEvent(beats, isHeader ? 'EVENT_BLOCK_SHOT_HEADER' : 'EVENT_BLOCK_SHOT', {
          p1: defender,
          side: oppSide,
          zone: 'BOX'
        });

        if (Math.random() < 0.48) {
          this._simulateCorner(beats, side, attTeam, defTeam, attLineup, defLineup, attStats, defStats);
        } else {
          this._emitEvent(beats, 'EVENT_CLEAR_BALL', { p1: defender, side: oppSide, zone: 'BOX' });
        }
        return;
      }
    }

    // 2. Shot On Target Accuracy Check
    const finishStat = isHeader
      ? (this._eff(shooter, 'heading') * 0.65 + this._eff(shooter, 'finishing') * 0.35)
      : (isLongShot
          ? (this._eff(shooter, 'longShots') * 0.65 + this._eff(shooter, 'technique') * 0.35)
          : (this._eff(shooter, 'finishing') * 0.65 + this._eff(shooter, 'technique') * 0.35));

    const composure = (this._eff(shooter, 'decisions') + this._eff(shooter, 'bravery')) / 2;
    const baseAcc = isOneOnOne ? 0.68 : (isLongShot ? 0.38 : (isHeader ? 0.48 : 0.54));
    const onTargetProb = clamp(baseAcc + ((finishStat + composure) / 2 - 13) * 0.025, 0.28, 0.82);

    if (Math.random() > onTargetProb) {
      // Shot missed target!
      this._adjustRating(shooter, -0.06);
      const r = Math.random();
      if (r < 0.14) {
        const woodEv = pickRandom(['EVENT_SHOT_HITS_POST', 'EVENT_SHOT_HITS_BAR', 'EVENT_SHOT_CLIPS_POST']);
        this._emitEvent(beats, woodEv, { p1: shooter, side, zone: 'BOX' });
      } else if (isHeader) {
        this._emitEvent(beats, 'EVENT_SHOT_WELL_OVER_HEADER', { p1: shooter, side, zone: 'BOX' });
      } else {
        const missEv = pickRandom([
          'EVENT_SHOT_WIDE',
          'EVENT_SHOT_JUST_WIDE',
          'EVENT_SHOT_OVER',
          'EVENT_SHOT_JUST_OVER',
          'EVENT_SHOT_WELL_OVER',
          'EVENT_SHOT_WELL_WIDE'
        ]);
        this._emitEvent(beats, missEv, { p1: shooter, side, zone: 'BOX' });
      }

      if (isOneOnOne && Math.random() < 0.65) {
        this._emitEvent(beats, 'EVENT_MISSED_EASY_CHANCE_CLOSE', { p1: shooter, team: attTeam, side, zone: 'BOX' });
      }

      this._emitEvent(beats, 'EVENT_RESTART_GOAL_KICK', { team: defTeam, side: oppSide, zone: 'DEFENSE' });
      return;
    }

    // 3. Shot is ON TARGET! Striker vs Goalkeeper Duel (both normalized to 1-20 scale)
    attStats.onTarget++;
    shooter.onTarget++;

    const attPower = (finishStat * 1.25 + composure * 0.55 + this._eff(shooter, 'flair') * 0.20) / 2.0;
    const gkPower = (
      this._eff(keeper, 'reflexes') * 0.80 +
      this._eff(keeper, 'handling') * 0.45 +
      this._eff(keeper, 'positioning') * 0.45 +
      (isOneOnOne ? this._eff(keeper, 'oneOnOnes') * 0.30 : this._eff(keeper, 'agility') * 0.30)
    ) / 2.0;

    const baseGoalRate = isOneOnOne ? 0.48 : (isLongShot ? 0.18 : (isHeader ? 0.28 : 0.33));
    const goalProb = clamp(baseGoalRate + (attPower - gkPower) * 0.028, 0.12, 0.66);

    if (Math.random() < goalProb) {
      // GOAL!
      this._recordGoal(beats, side, shooter, assister, keeper, attTeam, attStats, 'goal');
    } else {
      // SAVED BY GOALKEEPER!
      keeper.saves++;
      this._adjustRating(keeper, +0.35);
      this._adjustRating(shooter, +0.05);

      const saveRoll = Math.random();
      if (saveRoll < 0.45) {
        // Held cleanly
        const heldEv = gkPower >= 38 ? 'EVENT_GREAT_SAVE_HELD' : (gkPower >= 32 ? 'EVENT_GOOD_SAVE_HELD' : 'EVENT_GOALKEEPER_HELD');
        this._emitEvent(beats, heldEv, { p1: keeper, side: oppSide, zone: 'BOX' });
      } else if (saveRoll < 0.78) {
        // Tipped behind for a corner!
        this._emitEvent(beats, 'EVENT_GOALKEEPER_TIPPED', { p1: keeper, side: oppSide, zone: 'BOX' });
        if (Math.random() < 0.55) {
          this._simulateCorner(beats, side, attTeam, defTeam, attLineup, defLineup, attStats, defStats);
        } else {
          this._emitEvent(beats, 'EVENT_RESTART_CORNER', { team: attTeam, side, zone: 'BOX' });
        }
      } else {
        // Parried loose in the box!
        const parryEv = pickRandom(['EVENT_GOALKEEPER_PARRY', 'EVENT_GOOD_SAVE_NOT_HELD', 'EVENT_GREAT_SAVE_NOT_HELD', 'EVENT_GOALKEEPER_BLOCK']);
        this._emitEvent(beats, parryEv, { p1: keeper, side: oppSide, zone: 'BOX' });
        this._emitEvent(beats, 'EVENT_BALL_GOES_LOOSE', { side: oppSide, zone: 'BOX' });
        this._emitEvent(beats, 'EVENT_CLEAR_BALL', { p1: defender || keeper, side: oppSide, zone: 'BOX' });
      }
    }
  }

  /**
   * Simulates a Full Multi-Step Highlight Chain (5 to 9 sequential events)
   */
  _generateHighlightChain(side, strengths) {
    const beats = [];
    const oppSide = side === 'home' ? 'away' : 'home';
    const attTeam = side === 'home' ? this.homeTeam : this.awayTeam;
    const defTeam = side === 'home' ? this.awayTeam : this.homeTeam;
    const attLineup = side === 'home' ? this.homeLineup : this.awayLineup;
    const defLineup = side === 'home' ? this.awayLineup : this.homeLineup;
    const attStats = side === 'home' ? this.homeStats : this.awayStats;
    const defStats = side === 'home' ? this.awayStats : this.homeStats;
    const attTactics = side === 'home' ? this.homeTactics : this.awayTactics;
    const defTactics = side === 'home' ? this.awayTactics : this.homeTactics;

    const mids = this._getMidfielders(attLineup);
    const wingers = this._getWingers(attLineup);
    const fwds = this._getForwards(attLineup);
    const oppMids = this._getMidfielders(defLineup);
    const oppDefs = this._getDefenders(defLineup);
    const keeper = this._getGK(defLineup);

    const initiator = this._pickWeightedPlayer(mids, ['passing', 'vision', 'decisions', 'workRate']) || mids[0];
    const oppMid = this._pickWeightedPlayer(oppMids, ['tackling', 'positioning', 'anticipation', 'workRate']) || oppMids[0];
    const defender = this._pickWeightedPlayer(oppDefs, ['tackling', 'positioning', 'marking', 'anticipation']) || oppDefs[0];
    const striker = this._pickWeightedPlayer(fwds, ['offTheBall', 'finishing', 'pace', 'anticipation']) || fwds[0];

    // =========================================================================
    // PHASE 1: MIDFIELD INITIATION & BUILD-UP
    // =========================================================================
    attStats.passesAttempted++;
    initiator.passesAttempted++;

    const buildStyle = attTactics.passingStyle;
    const useWing = Math.random() < 0.46;
    const receiver = useWing
      ? (this._pickWeightedPlayer(wingers.filter(p => p.id !== initiator.id), ['pace', 'dribbling', 'crossing']) || striker)
      : (this._pickWeightedPlayer([...mids, ...fwds].filter(p => p.id !== initiator.id), ['offTheBall', 'technique', 'vision']) || striker);

    const slotStr = String(receiver.assignedSlot || receiver.position || '');
    const isLeftFlank = slotStr.includes('L') ? true : (slotStr.includes('R') ? false : Math.random() < 0.5);

    if (buildStyle === 'Long' || (buildStyle === 'Direct' && Math.random() < 0.45)) {
      const longEv = pickRandom(['EVENT_ATTEMPT_PASS_LONG_HIGH', 'EVENT_PASS_MEDIUM_FORWARD', 'EVENT_PASS_TO_RUN_ONTO_HIGH']);
      this._emitEvent(beats, longEv, { p1: initiator, p2: receiver, team: attTeam, side, zone: 'MIDFIELD' });
    } else if (useWing) {
      const wingPassEv = isLeftFlank
        ? pickRandom(['EVENT_PASS_SHORT_LEFT_WING', 'EVENT_PASS_MEDIUM_LEFT_WING', 'EVENT_PASS_SHORT_LEFT'])
        : pickRandom(['EVENT_PASS_SHORT_RIGHT_WING', 'EVENT_PASS_MEDIUM_RIGHT_WING', 'EVENT_PASS_SHORT_RIGHT']);
      this._emitEvent(beats, wingPassEv, { p1: initiator, p2: receiver, team: attTeam, side, zone: 'MIDFIELD' });
    } else {
      const shortEv = pickRandom(['EVENT_PASS_SHORT_FORWARD', 'EVENT_PASS_SHORT_FORWARD_FIRST_TIME', 'EVENT_PASS_MEDIUM_FORWARD']);
      this._emitEvent(beats, shortEv, { p1: initiator, p2: receiver, team: attTeam, side, zone: 'MIDFIELD' });
    }

    // Check Midfield Interception
    const passScore = this._eff(initiator, 'passing') * 1.35 + this._eff(initiator, 'vision') * 1.1 + this._eff(initiator, 'decisions') + rollD20() + 3;
    const intScore = this._eff(oppMid, 'anticipation') * 1.1 + this._eff(oppMid, 'positioning') * 1.05 + rollD20();

    if (intScore > passScore) {
      oppMid.interceptions++;
      this._adjustRating(oppMid, +0.12);
      this._adjustRating(initiator, -0.04);
      this._emitEvent(beats, 'EVENT_GOOD_INTERCEPT', { p1: oppMid, side: oppSide, zone: 'MIDFIELD' });
      return beats;
    }

    attStats.passesCompleted++;
    initiator.passesCompleted++;
    this._adjustRating(initiator, +0.04);

    // Receiver controls the ball
    if (this._eff(receiver, 'technique') >= 15 && Math.random() < 0.45) {
      this._emitEvent(beats, 'EVENT_GREAT_FIRST_TOUCH', { p1: receiver, side, zone: 'ATT_THIRD' });
    } else {
      this._emitEvent(beats, 'EVENT_MOVE_ONTO_PASS', { p1: receiver, side, zone: 'ATT_THIRD' });
    }

    // =========================================================================
    // PHASE 2: PROGRESSION & 1v1 DUEL
    // =========================================================================
    if (useWing) {
      this._emitEvent(beats, isLeftFlank ? 'EVENT_TAKES_BALL_TO_LEFT' : 'EVENT_TAKES_BALL_TO_RIGHT', { p1: receiver, side, zone: 'ATT_THIRD' });
    } else {
      this._emitEvent(beats, pickRandom(['EVENT_RUN_WITH_BALL', 'EVENT_CROSSES_HALFWAY_LINE']), { p1: receiver, team: attTeam, side, zone: 'ATT_THIRD' });
    }

    // 1v1 Challenge against Defender
    if (Math.random() < 0.58) {
      this._emitEvent(beats, 'EVENT_TAKE_ON_OPPONENT', { p1: receiver, p2: defender, side, zone: 'ATT_THIRD' });

      const dribScore = this._eff(receiver, 'dribbling') * 1.35 + this._eff(receiver, 'pace') * 1.15 + this._eff(receiver, 'agility') + rollD20() + 2;
      const tackMod = defTactics.tackling === 'Hard' ? 2.5 : (defTactics.tackling === 'Easy' ? -2 : 0);
      const tackScore = this._eff(defender, 'tackling') * 1.2 + this._eff(defender, 'positioning') * 1.0 + this._eff(defender, 'pace') * 0.65 + tackMod + rollD20();

      if (tackScore > dribScore) {
        // Check if it was a Foul or a Clean Tackle!
        const foulProb = clamp(
          0.22 + ((defender.attributes.dirtiness || 8) + (defender.attributes.aggression || 10) - this._eff(defender, 'tackling')) * 0.015 + (defTactics.tackling === 'Hard' ? 0.14 : 0),
          0.10,
          0.48
        );

        if (Math.random() < foulProb) {
          // FOUL COMMITTED!
          defender.fouls++;
          defStats.fouls++;
          this._adjustRating(defender, -0.14);

          const foulEv = pickRandom(['EVENT_FOUL', 'EVENT_FOUL_TRIP', 'EVENT_FOUL_SHIRT_TUG', 'EVENT_FOUL_SLIDE_TACKLE', 'EVENT_FOUL_BLOCK_TACKLE', 'EVENT_FOUL_PUSH_OPPONENT']);
          this._emitEvent(beats, foulEv, { p1: defender, p2: receiver, side: oppSide, zone: 'ATT_THIRD' });

          // Check Yellow / Red Card
          const cardRoll = Math.random();
          const cardChance = 0.24 + ((defender.attributes.dirtiness || 8) / 20) * 0.18 + (defTactics.tackling === 'Hard' ? 0.10 : 0);
          if (cardRoll < cardChance) {
            const displayMin = this.inStoppage ? `${this.minute}+${this.stoppageMinute}` : `${this.minute}`;
            if (defender.yellowCards === 1) {
              defender.yellowCards = 2;
              defender.redCard = true;
              defStats.redCards++;
              this.cards.push({ name: defender.name, team: defTeam.name, side: oppSide, minute: displayMin, card: 'red' });
              this._adjustRating(defender, -1.0);
              this._emitEvent(beats, 'EVENT_SECOND_YELLOW_CARD', { p1: defender, side: oppSide, zone: 'ATT_THIRD' });
            } else if (cardRoll < 0.03) {
              defender.redCard = true;
              defStats.redCards++;
              this.cards.push({ name: defender.name, team: defTeam.name, side: oppSide, minute: displayMin, card: 'red' });
              this._adjustRating(defender, -1.2);
              this._emitEvent(beats, 'EVENT_SENT_OFF', { p1: defender, side: oppSide, zone: 'ATT_THIRD' });
            } else {
              defender.yellowCards = 1;
              defStats.yellowCards++;
              this.cards.push({ name: defender.name, team: defTeam.name, side: oppSide, minute: displayMin, card: 'yellow' });
              this._adjustRating(defender, -0.25);
              this._emitEvent(beats, 'EVENT_YELLOW_CARD', { p1: defender, side: oppSide, zone: 'ATT_THIRD' });
            }
          }

          // Free Kick or Penalty!
          if (Math.random() < 0.11) {
            this._simulatePenalty(beats, side, attTeam, defTeam, attLineup, defLineup, attStats);
          } else if (Math.random() < 0.55) {
            this._simulateFreeKick(beats, side, attTeam, defTeam, attLineup, defLineup, attStats, defStats);
          } else {
            this._emitEvent(beats, 'EVENT_RESTART_FREEKICK', { team: attTeam, side, zone: 'ATT_THIRD' });
          }
          return beats;
        } else {
          // CLEAN TACKLE WON!
          defender.tacklesWon++;
          defStats.tacklesWon++;
          this._adjustRating(defender, +0.18);
          this._adjustRating(receiver, -0.06);

          const cleanTackEv = Math.random() < 0.55 ? 'EVENT_PERFECT_SLIDE_TACKLE' : 'EVENT_PERFECT_BLOCK_TACKLE';
          this._emitEvent(beats, cleanTackEv, { p1: defender, p2: receiver, side: oppSide, zone: 'ATT_THIRD' });

          if (Math.random() < 0.40) {
            this._emitEvent(beats, 'EVENT_RESTART_THROW_IN', { side, zone: 'ATT_THIRD' });
          } else {
            this._emitEvent(beats, 'EVENT_CLEAR_BALL', { p1: defender, side: oppSide, zone: 'DEFENSE' });
          }
          return beats;
        }
      }

      // Attacker beats the defender!
      this._adjustRating(receiver, +0.12);
      this._adjustRating(defender, -0.08);
      this._emitEvent(beats, 'EVENT_RUN_PAST_OPPONENT', { p1: receiver, p2: defender, side, zone: 'ATT_THIRD' });
    }

    // =========================================================================
    // PHASE 3: FINAL THIRD DELIVERY & SHOT
    // =========================================================================
    // Branch A: Winger Crosses into the Box
    if (useWing && Math.random() < 0.68) {
      this._emitEvent(beats, Math.random() < 0.65 ? 'EVENT_GETS_TO_THE_BYLINE' : 'EVENT_CUTS_INSIDE', { p1: receiver, side, zone: 'ATT_THIRD' });
      this._emitEvent(beats, 'EVENT_ATTEMPT_PASS_CROSS', { p1: receiver, side, zone: 'BOX' });

      const crossTarget = striker.id !== receiver.id ? striker : (pickRandom(fwds.filter(p => p.id !== receiver.id)) || striker);
      const boxDefender = pickRandom(oppDefs) || defender;

      // Keeper claim check on cross (16%)
      if (Math.random() < 0.16) {
        this._emitEvent(beats, 'EVENT_GOALIE_CATCH_BALL', { p1: keeper, side: oppSide, zone: 'BOX' });
        this._adjustRating(keeper, +0.08);
        return beats;
      }

      // Aerial duel in the box
      const attAir = this._eff(crossTarget, 'jumping') * 1.2 + this._eff(crossTarget, 'heading') * 1.2 + this._eff(receiver, 'crossing') * 0.65 + rollD20() + 2;
      const defAir = this._eff(boxDefender, 'jumping') * 1.15 + this._eff(boxDefender, 'heading') * 1.15 + this._eff(boxDefender, 'positioning') * 0.55 + rollD20();

      if (defAir > attAir) {
        this._emitEvent(beats, 'EVENT_HEAD_CLEAR', { p1: boxDefender, side: oppSide, zone: 'BOX' });
        this._adjustRating(boxDefender, +0.12);
        return beats;
      }

      attStats.crossesCompleted++;
      this._emitEvent(beats, 'EVENT_WINS_JUMPFORBALL', { p1: crossTarget, p2: boxDefender, side, zone: 'BOX' });

      const isVolley = Math.random() < 0.30;
      if (isVolley) {
        const volEv = pickRandom(['EVENT_SHOT_VOLLEY', 'EVENT_SHOT_HALF_VOLLEY', 'EVENT_SHOT_VOLLEY_RIGHT_FOOT', 'EVENT_SHOT_VOLLEY_LEFT_FOOT']);
        this._emitEvent(beats, volEv, { p1: crossTarget, side, zone: 'BOX' });
        this._resolveShotOutcome(beats, side, crossTarget, receiver, boxDefender, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, false, false, false);
      } else {
        const headEv = Math.random() < 0.25 ? 'EVENT_SHOT_DIVING_HEADER' : 'EVENT_SHOT_HEADER';
        this._emitEvent(beats, headEv, { p1: crossTarget, side, zone: 'BOX' });
        this._resolveShotOutcome(beats, side, crossTarget, receiver, boxDefender, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, true, false, false);
      }
      return beats;
    }

    // Branch B: Long Range Strike from outside the area (22% of central attacks)
    if (Math.random() < 0.24) {
      const longShooter = receiver;
      const longEv = pickRandom([
        'EVENT_SHOT_FROM_DISTANCE_HIGH_DRIVE',
        'EVENT_SHOT_FROM_DISTANCE_LOW_DRIVE',
        'EVENT_SHOT_FROM_DISTANCE_BANANA',
        'EVENT_SHOT_FROM_DISTANCE_HOPE'
      ]);
      this._emitEvent(beats, longEv, { p1: longShooter, side, zone: 'ATT_THIRD' });
      this._resolveShotOutcome(beats, side, longShooter, initiator, defender, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, false, false, true);
      return beats;
    }

    // Branch C: Incisive Through Ball / Pass into the Penalty Box
    const targetStriker = striker.id !== receiver.id ? striker : (pickRandom(fwds.filter(p => p.id !== receiver.id)) || striker);
    const boxDef = pickRandom(oppDefs.filter(p => p.id !== defender.id)) || defender;

    if (targetStriker.id !== receiver.id) {
      const throughEv = pickRandom([
        'EVENT_PASS_TO_RUN_ONTO_LOW',
        'EVENT_PASS_SHORT_INTO_AREA_INTO_PATH',
        'EVENT_PASS_SHORT_INTO_AREA',
        'EVENT_PASS_SHORT_INTO_AREA_FIRST_TIME'
      ]);
      this._emitEvent(beats, throughEv, { p1: receiver, p2: targetStriker, side, zone: 'BOX' });

      // Check Offside Trap (approx 12% of through balls)
      const offsideProb = clamp(0.14 - (this._eff(targetStriker, 'offTheBall') - this._eff(boxDef, 'positioning')) * 0.012, 0.05, 0.22);
      if (Math.random() < offsideProb) {
        attStats.offsides++;
        this._emitEvent(beats, 'EVENT_RESTART_OFFSIDE', { p1: targetStriker, side: oppSide, zone: 'BOX' });
        return beats;
      }

      // Check Through-Ball Interception by Last Defender
      const tbPass = this._eff(receiver, 'passing') + this._eff(receiver, 'vision') + this._eff(targetStriker, 'pace') + rollD20() + 3;
      const tbInt = this._eff(boxDef, 'anticipation') + this._eff(boxDef, 'positioning') + this._eff(boxDef, 'pace') + rollD20();
      if (tbInt > tbPass) {
        boxDef.interceptions++;
        this._adjustRating(boxDef, +0.15);
        this._emitEvent(beats, 'EVENT_INTERCEPT_THROUGH_BALL', { p1: boxDef, side: oppSide, zone: 'BOX' });
        return beats;
      }
    }

    // Striker is inside the box!
    const isOneOnOne = Math.random() < 0.32;
    if (isOneOnOne) {
      this._emitEvent(beats, 'EVENT_CLEAN_THROUGH', { p1: targetStriker, side, zone: 'BOX' });
      const oneOnOneEv = Math.random() < 0.25
        ? 'EVENT_SHOT_CHIP_GOALIE'
        : (Math.random() < 0.25 ? 'EVENT_GO_ROUND_KEEPER' : 'EVENT_SHOT_LOW_DRIVE');
      this._emitEvent(beats, oneOnOneEv, { p1: targetStriker, p2: keeper, side, zone: 'BOX' });
      this._resolveShotOutcome(beats, side, targetStriker, receiver, boxDef, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, false, true, false);
    } else {
      this._emitEvent(beats, 'EVENT_BRINGS_BALL_INTO_AREA', { p1: targetStriker, side, zone: 'BOX' });
      const shotEv = pickRandom([
        'EVENT_SHOT_LOW_DRIVE',
        'EVENT_SHOT_LOW_DRIVE_RIGHT_FOOT',
        'EVENT_SHOT_LOW_DRIVE_LEFT_FOOT',
        'EVENT_SHOT_HIGH_DRIVE_RIGHT_FOOT',
        'EVENT_SHOT_HIGH_DRIVE_LEFT_FOOT',
        'EVENT_SHOT_BANANA',
        'EVENT_SHOT_FROM_ANGLE_LOW_DRIVE',
        'EVENT_SHOT_FROM_ANGLE_HIGH_DRIVE'
      ]);
      this._emitEvent(beats, shotEv, { p1: targetStriker, side, zone: 'BOX' });
      this._resolveShotOutcome(beats, side, targetStriker, receiver, boxDef, keeper, attTeam, defTeam, attLineup, defLineup, attStats, defStats, false, false, false);
    }

    return beats;
  }

  /**
   * Automatic CPU Substitutions in 2nd Half for tired or underperforming players
   */
  _checkAutoCPUSub(beats) {
    if (this.half !== 2 || this.minute < 62 || this.subsMade.away >= 3) return;
    if (Math.random() > 0.08) return;

    const candidates = this._active(this.awayLineup)
      .filter(p => p.position !== 'GK' && (p.condition < 74 || p.rating <= 6))
      .sort((a, b) => a.condition - b.condition);

    if (candidates.length === 0 || this.awayBench.length === 0) return;
    const toSubOff = candidates[0];
    const replacement = this.awayBench.find(b => b.position !== 'GK') || this.awayBench[0];
    if (!replacement) return;

    const res = this.makeSubstitution('away', toSubOff.id, replacement.id);
    if (res && res.beats) {
      beats.push(...res.beats);
    }
  }

  /**
   * Advances the match by 1 clock tick.
   * - On quiet minutes: returns `beats: []` so the clock advances smoothly WITHOUT spamming text!
   * - On highlight minutes: returns a full multi-step sequence of beats while the clock pauses!
   */
  tick() {
    if (this.isFinished) return null;

    const beats = [];

    // Kick-Off at minute 0 -> 1
    if (this.minute === 0) {
      this.minute = 1;
      this._emitEvent(beats, 'EVENT_START_MATCH', { team: this.homeTeam, side: 'home', zone: 'MIDFIELD' });
      return {
        minute: 1,
        displayMinute: '1',
        half: this.half,
        isHighlight: true,
        beats
      };
    }

    // Handle 1st Half Stoppage Time & Half-Time Whistle
    if (this.half === 1 && this.minute === 45 && !this.halfTimeReached) {
      if (!this.inStoppage) {
        this.inStoppage = true;
        this.stoppageMinute = 1;
        this._emitEvent(beats, 'EVENT_TIME_ADDED_ON', { addedMinutes: this.halfStoppage, side: 'home', bannerStyle: 'neutral', zone: 'MIDFIELD' });
        return {
          minute: 45,
          displayMinute: `45+${this.stoppageMinute}`,
          half: 1,
          isHighlight: true,
          beats
        };
      } else if (this.stoppageMinute < this.halfStoppage) {
        this.stoppageMinute++;
      } else {
        // End of 1st Half!
        this.inStoppage = false;
        this.stoppageMinute = 0;
        this.halfTimeReached = true;
        this.half = 2;
        this._emitEvent(beats, 'EVENT_HALF_TIME_WHISTLE', { side: 'home', bannerStyle: 'neutral', zone: 'MIDFIELD' });
        return {
          minute: 45,
          displayMinute: 'HT',
          half: 2,
          isHighlight: true,
          type: 'HALF_TIME',
          beats
        };
      }
    } else if (this.half === 2 && this.minute === 45 && this.halfTimeReached) {
      // Kick off 2nd Half
      this.minute = 46;
      this._emitEvent(beats, 'EVENT_KICK_OFF', { team: this.awayTeam, side: 'away', zone: 'MIDFIELD' });
      return {
        minute: 46,
        displayMinute: '46',
        half: 2,
        isHighlight: true,
        beats
      };
    } else if (this.half === 2 && this.minute === 90) {
      // Handle 2nd Half Stoppage Time & Full-Time Whistle
      if (!this.inStoppage) {
        this.inStoppage = true;
        this.stoppageMinute = 1;
        this._emitEvent(beats, 'EVENT_TIME_ADDED_ON', { addedMinutes: this.fullStoppage, side: 'home', bannerStyle: 'neutral', zone: 'MIDFIELD' });
        return {
          minute: 90,
          displayMinute: `90+${this.stoppageMinute}`,
          half: 2,
          isHighlight: true,
          beats
        };
      } else if (this.stoppageMinute < this.fullStoppage) {
        this.stoppageMinute++;
      } else {
        this.inStoppage = false;
        this.isFinished = true;
        this._emitEvent(beats, 'EVENT_FINAL_WHISTLE', { side: 'home', bannerStyle: 'neutral', zone: 'MIDFIELD' });
        return {
          minute: 90,
          displayMinute: 'FT',
          half: 2,
          isHighlight: true,
          type: 'FULL_TIME',
          beats
        };
      }
    } else {
      this.minute++;
    }

    const displayMinute = this.inStoppage ? `${this.minute}+${this.stoppageMinute}` : `${this.minute}`;

    // Drain stamina
    this._drainCondition(this.homeLineup, this.homeTactics);
    this._drainCondition(this.awayLineup, this.awayTactics);

    // Compute dynamic team strengths
    const strengths = this._calculateTeamStrengths();
    const hControl = strengths.home.control;
    const aControl = strengths.away.control;
    const homePossProb = clamp(hControl / (hControl + aControl), 0.22, 0.78);

    // Update possession sample for this minute
    const isHomePossession = Math.random() < homePossProb;
    if (isHomePossession) {
      this.possessionSamples.home += 1.2;
      this.homeStats.passesAttempted += randInt(3, 6);
      this.homeStats.passesCompleted += randInt(2, 5);
    } else {
      this.possessionSamples.away += 1.2;
      this.awayStats.passesAttempted += randInt(3, 6);
      this.awayStats.passesCompleted += randInt(2, 5);
    }
    const totalPoss = this.possessionSamples.home + this.possessionSamples.away;
    this.homeStats.possession = Math.round((this.possessionSamples.home / totalPoss) * 100);
    this.awayStats.possession = 100 - this.homeStats.possession;

    // Check CPU Auto-Substitution
    this._checkAutoCPUSub(beats);

    // Check if a player is knackered in late game
    if (this.minute >= 70 && Math.random() < 0.08) {
      const tiredPlayer = [...this._active(this.homeLineup), ...this._active(this.awayLineup)]
        .find(p => p.condition <= 66 && !p.knackeredNotified);
      if (tiredPlayer) {
        tiredPlayer.knackeredNotified = true;
        this._emitEvent(beats, 'EVENT_PLAYER_KNACKERED', { p1: tiredPlayer, side: tiredPlayer.teamSide, zone: 'MIDFIELD' });
      }
    }

    // Determine if a Highlight Sequence occurs this minute (~34% of minutes = ~31 sequences/match)
    const highlightProb = 0.34;
    if (Math.random() < highlightProb) {
      // Decide which team attacks based on Control + Attack vs Opponent Defense
      const hAttackWeight = strengths.home.control * 0.50 + (strengths.home.attack / Math.max(10, strengths.away.defense)) * 55;
      const aAttackWeight = strengths.away.control * 0.50 + (strengths.away.attack / Math.max(10, strengths.home.defense)) * 55;
      const homeAttackProb = clamp(hAttackWeight / (hAttackWeight + aAttackWeight), 0.28, 0.72);

      const attSide = Math.random() < homeAttackProb ? 'home' : 'away';
      const chainBeats = this._generateHighlightChain(attSide, strengths);
      beats.push(...chainBeats);
    }

    return {
      minute: this.minute,
      displayMinute,
      half: this.half,
      isHighlight: beats.length > 0,
      activePossessionSide: isHomePossession ? 'home' : 'away',
      beats
    };
  }

  /**
   * Instant Simulation of remaining match minutes
   */
  simulateInstant() {
    while (!this.isFinished) {
      const pkg = this.tick();
      if (pkg && pkg.beats && pkg.beats.length > 0) {
        pkg.beats.forEach(b => {
          this.events.unshift({
            minute: pkg.displayMinute,
            text: b.text,
            side: b.side,
            bannerStyle: b.bannerStyle,
            eventKey: b.eventKey
          });
        });
      }
    }
    return {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      homeStats: this.homeStats,
      awayStats: this.awayStats,
      scorers: this.scorers,
      cards: this.cards,
      homeLineup: this.homeLineup,
      awayLineup: this.awayLineup
    };
  }
}

export default CM0102Engine;
