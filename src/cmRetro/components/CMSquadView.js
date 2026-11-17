import React, { useState } from 'react';
import CMPlayerModal from './CMPlayerModal';

function getPosClass(pos) {
  if (pos === 'GK') return 'cm-badge-gk';
  if (['DC', 'DL', 'DR', 'SW', 'DF'].includes(pos)) return 'cm-badge-df';
  if (['MC', 'ML', 'MR', 'DMC', 'AMC', 'AML', 'AMR', 'MF'].includes(pos)) return 'cm-badge-mf';
  return 'cm-badge-fw';
}

function getStatColor(val) {
  if (val >= 16) return '#33ff77';
  if (val >= 12) return '#ffdd44';
  return '#88aacc';
}

export default function CMSquadView({ squad, teamName }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  if (!squad || squad.length === 0) {
    return <div style={{ padding: '20px', color: '#79a6c4' }}>No players found in squad.</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: '#40e0d0', fontSize: '16px', letterSpacing: '0.5px' }}>
          SQUAD ROSTER ({squad.length} PLAYERS) — CLICK ANY PLAYER FOR FULL 42 ATTRIBUTES
        </h3>
      </div>

      <div className="cm-table-card">
        <table className="cm-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>No</th>
              <th>Player Name</th>
              <th style={{ width: '80px' }}>Position</th>
              <th style={{ width: '50px', textAlign: 'center' }}>Age</th>
              <th style={{ width: '50px', textAlign: 'center' }}>CA</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Cond</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Pace</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Pass</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Tack</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Fin</th>
              <th style={{ width: '60px', textAlign: 'center' }}>Pos / Ref</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((player) => {
              const a = player.attributes || {};
              const isGK = player.position === 'GK';
              const posRef = isGK ? a.reflexes : a.positioning;

              return (
                <tr key={player.id || player.name} onClick={() => setSelectedPlayer(player)}>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ffdd44' }}>
                    {player.squadNumber || '-'}
                  </td>
                  <td style={{ fontWeight: '700', color: '#ffffff' }}>
                    {player.name}
                  </td>
                  <td>
                    <span className={`cm-badge-pos ${getPosClass(player.position)}`}>
                      {player.position}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: '#a0c4d8' }}>
                    {player.age}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#40e0d0' }}>
                    {player.currentAbility}
                  </td>
                  <td style={{ textAlign: 'center', color: '#33ff77', fontWeight: 'bold' }}>
                    {player.condition || 100}%
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: getStatColor(a.pace) }}>
                    {a.pace || 0}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: getStatColor(a.passing) }}>
                    {a.passing || 0}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: getStatColor(a.tackling) }}>
                    {a.tackling || 0}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: getStatColor(a.finishing) }}>
                    {a.finishing || 0}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: getStatColor(posRef) }}>
                    {posRef || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedPlayer && (
        <CMPlayerModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </div>
  );
}
