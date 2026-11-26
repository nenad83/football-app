import React, { useState, useMemo } from 'react';
import CountryFlag from './CountryFlag';
import { getAllViewableWorldLeagues, getClubManager } from '../utils/worldCareerManager';

const MiniClubBadge = ({ primaryColor = '#00ff64', secondaryColor = '#ffffff', size = 22 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const h = Math.round(size * 0.65);
  return (
    <svg width={size} height={h} viewBox="0 0 100 65" style={{ borderRadius: '4px', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 }}>
      {isSolid ? (
        <rect width="100" height="65" fill={primaryColor} />
      ) : (
        <>
          <rect x="0" width="50" height="65" fill={primaryColor} />
          <rect x="50" width="50" height="65" fill={secondaryColor} />
        </>
      )}
    </svg>
  );
};

export default function WorldTablesPanel({ leagueState }) {
  const leagues = useMemo(() => getAllViewableWorldLeagues(leagueState), [leagueState]);
  const [selectedKey, setSelectedKey] = useState(() => {
    const firstForeign = leagues.find((l) => !l.isCurrent);
    return firstForeign ? firstForeign.key : (leagues[0]?.key || '');
  });

  const activeLeague = leagues.find((l) => l.key === selectedKey) || leagues[0];
  const worldState = leagueState?.worldState;
  const openVacancyClubKeys = new Set((worldState?.vacancies || []).map((v) => v.clubKey));

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  if (!activeLeague) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
        World league tables will appear after the first round initializes.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <h3 className="team-card-title" style={{ margin: 0, textAlign: 'left', color: '#00e5ff' }}>
          🌍 LIVE WORLD TABLES ({leagues.length} TRACKED)
        </h3>
        <span style={{ fontSize: '10px', color: '#888', fontFamily: 'Orbitron' }}>
          ROUND {activeLeague.roundsSimulated}/{activeLeague.totalRounds}
        </span>
      </div>

      {/* Tracked League Selector Pills */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {leagues.map((lg) => {
          const isSel = lg.key === activeLeague.key;
          return (
            <button
              key={lg.key}
              type="button"
              onClick={() => setSelectedKey(lg.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '10.5px',
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 'bold',
                cursor: 'pointer',
                border: isSel ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.08)',
                background: isSel ? 'rgba(0, 229, 255, 0.14)' : 'rgba(0, 0, 0, 0.35)',
                color: isSel ? '#00e5ff' : '#aaa'
              }}
            >
              <CountryFlag country={lg.country} size={16} />
              <span>{cap(lg.country)} D{lg.division}</span>
              {lg.isCurrent && <span style={{ color: '#00ff64', fontSize: '9px' }}>★</span>}
            </button>
          );
        })}
      </div>

      {/* Live Standings Table with Persistent AI Managers */}
      <table className="retro-standings-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#888', textTransform: 'uppercase', fontSize: '9.5px', textAlign: 'center' }}>
            <th style={{ padding: '7px 4px', textAlign: 'left' }}>Pos</th>
            <th style={{ padding: '7px 4px', textAlign: 'left' }}>Club</th>
            <th style={{ padding: '7px 4px', textAlign: 'left' }}>Manager</th>
            <th style={{ padding: '7px 4px' }}>P</th>
            <th style={{ padding: '7px 4px' }}>W</th>
            <th style={{ padding: '7px 4px' }}>D</th>
            <th style={{ padding: '7px 4px' }}>L</th>
            <th style={{ padding: '7px 4px' }}>GD</th>
            <th style={{ padding: '7px 4px', color: '#ffd700' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {activeLeague.teams.map((team, idx) => {
            const isUserClub = activeLeague.isCurrent && !leagueState?.isUnemployed && team.idnum === leagueState?.playerTeamId;
            const cKey = `${String(activeLeague.country).toLowerCase()}:${String(team.name).toLowerCase().trim()}`;
            const aiMgr = getClubManager(worldState, activeLeague.country, team.name);
            const isVacant = openVacancyClubKeys.has(cKey) || (!isUserClub && !aiMgr);
            const managerDisplay = isUserClub
              ? `${leagueState?.managerName || 'You'} (You)`
              : (isVacant ? 'VACANT' : aiMgr.name);
            const gd = (team.gf || 0) - (team.ga || 0);

            return (
              <tr
                key={`${activeLeague.key}-${team.idnum}-${team.name}`}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  background: isUserClub ? 'rgba(0, 255, 100, 0.06)' : 'transparent',
                  color: isUserClub ? '#00ff64' : '#fff',
                  fontWeight: isUserClub ? 'bold' : 'normal'
                }}
              >
                <td style={{ padding: '8px 4px', textAlign: 'left', fontWeight: 'bold' }}>{idx + 1}.</td>
                <td style={{ padding: '8px 4px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <MiniClubBadge primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} size={22} />
                    <span style={{ maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={team.name}>
                      {team.name}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'left', fontSize: '10.5px', color: isVacant ? '#ff9100' : (isUserClub ? '#00ff64' : '#9ca3af') }}>
                  {isVacant ? '🚨 VACANT' : managerDisplay}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.played || 0}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.won || 0}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.drawn || 0}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center' }}>{team.lost || 0}</td>
                <td style={{ padding: '8px 4px', textAlign: 'center', color: gd > 0 ? '#00ff64' : (gd < 0 ? '#ff4500' : '#888') }}>
                  {gd > 0 ? `+${gd}` : gd}
                </td>
                <td style={{ padding: '8px 4px', textAlign: 'center', color: isUserClub ? '#00ff64' : '#ffd700', fontWeight: 'bold' }}>
                  {team.points || 0}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
