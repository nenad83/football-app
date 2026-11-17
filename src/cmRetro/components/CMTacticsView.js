import React, { useState } from 'react';
import CMPlayerModal from './CMPlayerModal';

function getPosClass(pos) {
  if (pos === 'GK') return 'cm-badge-gk';
  if (['DC', 'DL', 'DR', 'SW', 'DF'].includes(pos)) return 'cm-badge-df';
  if (['MC', 'ML', 'MR', 'DMC', 'AMC', 'AML', 'AMR', 'MF'].includes(pos)) return 'cm-badge-mf';
  return 'cm-badge-fw';
}

export default function CMTacticsView({ starters, bench, onSwapPlayers, formation, onChangeFormation, tactics, onChangeTactics }) {
  const [selectedStarterIdx, setSelectedStarterIdx] = useState(null);
  const [inspectPlayer, setInspectPlayer] = useState(null);

  const handleStarterClick = (idx) => {
    setSelectedStarterIdx(selectedStarterIdx === idx ? null : idx);
  };

  const handleBenchClick = (benchIdx) => {
    if (selectedStarterIdx !== null) {
      onSwapPlayers(selectedStarterIdx, benchIdx);
      setSelectedStarterIdx(null);
    }
  };

  return (
    <div>
      {/* TACTICAL SETTINGS BAR */}
      <div className="cm-team-banner" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#40e0d0', textTransform: 'uppercase', display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Formation</label>
            <select
              className="cm-select-dropdown"
              value={formation}
              onChange={(e) => onChangeFormation(e.target.value)}
            >
              <option value="4-4-2">4-4-2 Standard</option>
              <option value="4-3-3">4-3-3 Attacking</option>
              <option value="4-5-1">4-5-1 Controlled</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#40e0d0', textTransform: 'uppercase', display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Mentality</label>
            <select
              className="cm-select-dropdown"
              value={tactics.mentality}
              onChange={(e) => onChangeTactics({ ...tactics, mentality: e.target.value })}
            >
              <option value="Defensive">Defensive</option>
              <option value="Normal">Normal</option>
              <option value="Attacking">Attacking</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#40e0d0', textTransform: 'uppercase', display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Passing Style</label>
            <select
              className="cm-select-dropdown"
              value={tactics.passingStyle}
              onChange={(e) => onChangeTactics({ ...tactics, passingStyle: e.target.value })}
            >
              <option value="Short">Short</option>
              <option value="Direct">Direct</option>
              <option value="Long">Long Ball</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: '#40e0d0', textTransform: 'uppercase', display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Tackling</label>
            <select
              className="cm-select-dropdown"
              value={tactics.tackling}
              onChange={(e) => onChangeTactics({ ...tactics, tackling: e.target.value })}
            >
              <option value="Easy">Easy (Fewer Cards)</option>
              <option value="Normal">Normal</option>
              <option value="Hard">Hard (Crunching)</option>
            </select>
          </div>
        </div>

        {selectedStarterIdx !== null && (
          <div style={{ background: '#ffaa00', color: '#000', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px' }}>
            Click a bench player below to swap!
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
        {/* STARTING 11 TABLE */}
        <div className="cm-table-card">
          <div style={{ background: '#10344c', padding: '10px 14px', borderBottom: '2px solid #00a2a2', fontWeight: 'bold', color: '#40e0d0', fontSize: '13px' }}>
            STARTING ELEVEN (CLICK TO SELECT FOR SWAP)
          </div>
          <table className="cm-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>Slot</th>
                <th style={{ width: '35px' }}>No</th>
                <th>Name</th>
                <th style={{ width: '60px' }}>Pos</th>
                <th style={{ width: '45px', textAlign: 'center' }}>CA</th>
                <th style={{ width: '45px', textAlign: 'center' }}>Cond</th>
                <th style={{ width: '40px' }}>Info</th>
              </tr>
            </thead>
            <tbody>
              {starters.map((p, idx) => {
                const isSelected = selectedStarterIdx === idx;
                return (
                  <tr
                    key={p.id}
                    onClick={() => handleStarterClick(idx)}
                    style={{ background: isSelected ? 'rgba(255, 221, 68, 0.25)' : undefined }}
                  >
                    <td style={{ fontWeight: 'bold', color: '#ffdd44' }}>{p.assignedSlot || 'MC'}</td>
                    <td style={{ color: '#a0c4d8' }}>{p.squadNumber}</td>
                    <td style={{ fontWeight: 'bold', color: isSelected ? '#ffdd44' : '#ffffff' }}>{p.name}</td>
                    <td><span className={`cm-badge-pos ${getPosClass(p.position)}`}>{p.position}</span></td>
                    <td style={{ textAlign: 'center', color: '#40e0d0', fontWeight: 'bold' }}>{p.currentAbility}</td>
                    <td style={{ textAlign: 'center', color: '#33ff77', fontWeight: 'bold' }}>{p.condition}%</td>
                    <td>
                      <button
                        onClick={(e) => { e.stopPropagation(); setInspectPlayer(p); }}
                        style={{ background: 'transparent', border: '1px solid #00a2a2', color: '#40e0d0', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}
                      >
                        Stats
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* BENCH TABLE */}
        <div className="cm-table-card">
          <div style={{ background: '#0e2b3e', padding: '10px 14px', borderBottom: '2px solid #144463', fontWeight: 'bold', color: '#a0c4d8', fontSize: '13px' }}>
            SUBSTITUTES BENCH
          </div>
          <table className="cm-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}>No</th>
                <th>Name</th>
                <th style={{ width: '60px' }}>Pos</th>
                <th style={{ width: '45px', textAlign: 'center' }}>CA</th>
                <th style={{ width: '45px', textAlign: 'center' }}>Cond</th>
                <th style={{ width: '40px' }}>Info</th>
              </tr>
            </thead>
            <tbody>
              {bench.map((p, idx) => (
                <tr
                  key={p.id}
                  onClick={() => handleBenchClick(idx)}
                  style={{ cursor: selectedStarterIdx !== null ? 'pointer' : 'default' }}
                >
                  <td style={{ color: '#a0c4d8' }}>{p.squadNumber}</td>
                  <td style={{ fontWeight: '600', color: '#e0f0f5' }}>{p.name}</td>
                  <td><span className={`cm-badge-pos ${getPosClass(p.position)}`}>{p.position}</span></td>
                  <td style={{ textAlign: 'center', color: '#40e0d0', fontWeight: 'bold' }}>{p.currentAbility}</td>
                  <td style={{ textAlign: 'center', color: '#33ff77', fontWeight: 'bold' }}>{p.condition}%</td>
                  <td>
                    <button
                      onClick={(e) => { e.stopPropagation(); setInspectPlayer(p); }}
                      style={{ background: 'transparent', border: '1px solid #144463', color: '#a0c4d8', borderRadius: '3px', cursor: 'pointer', fontSize: '10px', padding: '2px 5px' }}
                    >
                      Stats
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {inspectPlayer && (
        <CMPlayerModal player={inspectPlayer} onClose={() => setInspectPlayer(null)} />
      )}
    </div>
  );
}
