/**
 * Lineup and Formation helper for CM 01/02 Retro Engine
 */

export const RETRO_FORMATIONS = {
  '4-4-2': {
    name: '4-4-2',
    label: 'Standard 4-4-2',
    slots: [
      { id: 'gk', pos: 'GK', label: 'GK' },
      { id: 'dl', pos: 'DL', label: 'DL' },
      { id: 'dc1', pos: 'DC', label: 'DC' },
      { id: 'dc2', pos: 'DC', label: 'DC' },
      { id: 'dr', pos: 'DR', label: 'DR' },
      { id: 'ml', pos: 'ML', label: 'ML' },
      { id: 'mc1', pos: 'MC', label: 'MC' },
      { id: 'mc2', pos: 'MC', label: 'MC' },
      { id: 'mr', pos: 'MR', label: 'MR' },
      { id: 'st1', pos: 'ST', label: 'ST' },
      { id: 'st2', pos: 'ST', label: 'ST' }
    ]
  },
  '4-3-3': {
    name: '4-3-3',
    label: 'Attacking 4-3-3',
    slots: [
      { id: 'gk', pos: 'GK', label: 'GK' },
      { id: 'dl', pos: 'DL', label: 'DL' },
      { id: 'dc1', pos: 'DC', label: 'DC' },
      { id: 'dc2', pos: 'DC', label: 'DC' },
      { id: 'dr', pos: 'DR', label: 'DR' },
      { id: 'mc1', pos: 'MC', label: 'MC' },
      { id: 'mc2', pos: 'MC', label: 'MC' },
      { id: 'mc3', pos: 'MC', label: 'MC' },
      { id: 'lw', pos: 'LW', label: 'LW' },
      { id: 'st', pos: 'ST', label: 'ST' },
      { id: 'rw', pos: 'RW', label: 'RW' }
    ]
  },
  '4-5-1': {
    name: '4-5-1',
    label: 'Controlled 4-5-1',
    slots: [
      { id: 'gk', pos: 'GK', label: 'GK' },
      { id: 'dl', pos: 'DL', label: 'DL' },
      { id: 'dc1', pos: 'DC', label: 'DC' },
      { id: 'dc2', pos: 'DC', label: 'DC' },
      { id: 'dr', pos: 'DR', label: 'DR' },
      { id: 'dmc', pos: 'DMC', label: 'DMC' },
      { id: 'ml', pos: 'ML', label: 'ML' },
      { id: 'mc', pos: 'MC', label: 'MC' },
      { id: 'mr', pos: 'MR', label: 'MR' },
      { id: 'amc', pos: 'AMC', label: 'AMC' },
      { id: 'st', pos: 'ST', label: 'ST' }
    ]
  }
};

export function buildOptimalLineup(squad, formationName = '4-4-2') {
  if (!squad || squad.length === 0) return { starters: [], bench: [] };

  const formation = RETRO_FORMATIONS[formationName] || RETRO_FORMATIONS['4-4-2'];
  const starters = [];
  const usedIds = new Set();

  // Sort squad by current ability
  const available = [...squad].sort((a, b) => (b.currentAbility || 0) - (a.currentAbility || 0));

  for (const slot of formation.slots) {
    // 1. Exact match on primary position
    let candidate = available.find(p => !usedIds.has(p.id) && p.position === slot.pos);

    // 2. Match in secondary positions
    if (!candidate) {
      candidate = available.find(p => !usedIds.has(p.id) && p.positions && p.positions.includes(slot.pos));
    }

    // 3. Department match (GK vs DF vs MF vs FW)
    if (!candidate) {
      if (slot.pos === 'GK') {
        candidate = available.find(p => !usedIds.has(p.id) && p.position === 'GK');
      } else if (['DC', 'DL', 'DR'].includes(slot.pos)) {
        candidate = available.find(p => !usedIds.has(p.id) && ['DC', 'DL', 'DR', 'SW', 'DF'].some(pos => (p.positions || []).includes(pos)));
      } else if (['MC', 'ML', 'MR', 'DMC', 'AMC'].includes(slot.pos)) {
        candidate = available.find(p => !usedIds.has(p.id) && ['MC', 'ML', 'MR', 'DMC', 'AMC', 'MF'].some(pos => (p.positions || []).includes(pos)));
      } else {
        candidate = available.find(p => !usedIds.has(p.id) && ['ST', 'CF', 'LW', 'RW', 'FW'].some(pos => (p.positions || []).includes(pos)));
      }
    }

    // 4. Any available non-GK player
    if (!candidate) {
      candidate = available.find(p => !usedIds.has(p.id) && (slot.pos === 'GK' ? p.position === 'GK' : p.position !== 'GK'));
    }

    if (!candidate) {
      candidate = available.find(p => !usedIds.has(p.id)) || available[0];
    }

    usedIds.add(candidate.id);
    starters.push({
      ...candidate,
      slotId: slot.id,
      assignedSlot: slot.label
    });
  }

  const bench = available.filter(p => !usedIds.has(p.id));

  return { starters, bench };
}
