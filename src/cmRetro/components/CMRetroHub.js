import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/cmRetro.css';

import teamsData from '../../data/cmRetro/2004/teams.json';
import squadsData from '../../data/cmRetro/2004/squads.json';
import { buildOptimalLineup } from '../utils/lineupHelper';

import CMSquadView from './CMSquadView';
import CMTacticsView from './CMTacticsView';
import CMMatchView from './CMMatchView';

export default function CMRetroHub() {
  const [selectedTeamName, setSelectedTeamName] = useState('Arsenal');
  const [activeTab, setActiveTab] = useState('squad'); // 'squad' | 'tactics' | 'match'
  const [formation, setFormation] = useState('4-4-2');
  const [tactics, setTactics] = useState({
    mentality: 'Attacking',
    passingStyle: 'Short',
    tackling: 'Normal'
  });

  const [starters, setStarters] = useState([]);
  const [bench, setBench] = useState([]);

  // When team or formation changes, build optimal lineup
  useEffect(() => {
    const squad = squadsData[selectedTeamName] || [];
    const lineup = buildOptimalLineup(squad, formation);
    setStarters(lineup.starters);
    setBench(lineup.bench);
  }, [selectedTeamName, formation]);

  const handleSwapPlayers = (starterIdx, benchIdx) => {
    const newStarters = [...starters];
    const newBench = [...bench];

    const temp = newStarters[starterIdx];
    const targetBenchPlayer = newBench[benchIdx];

    // Preserve assigned slot info
    newStarters[starterIdx] = {
      ...targetBenchPlayer,
      slotId: temp.slotId,
      assignedSlot: temp.assignedSlot
    };

    newBench[benchIdx] = {
      ...temp,
      slotId: undefined,
      assignedSlot: undefined
    };

    setStarters(newStarters);
    setBench(newBench);
  };

  const currentSquad = squadsData[selectedTeamName] || [];
  const currentTeamInfo = teamsData.find(t => t.name === selectedTeamName) || teamsData[0];

  return (
    <div className="cm-retro-container">
      {/* RETRO TOP HEADER BAR */}
      <header className="cm-top-bar">
        <div className="cm-title-badge">
          <span className="cm-logo-text">CHAMPIONSHIP MANAGER</span>
          <span className="cm-logo-sub">01/02 DUEL ENGINE DEMO (2004/05)</span>
        </div>

        {/* NAVIGATION TABS */}
        <nav className="cm-nav-tabs">
          <button
            className={`cm-tab-btn ${activeTab === 'squad' ? 'active' : ''}`}
            onClick={() => setActiveTab('squad')}
          >
            📋 Squad Roster
          </button>
          <button
            className={`cm-tab-btn ${activeTab === 'tactics' ? 'active' : ''}`}
            onClick={() => setActiveTab('tactics')}
          >
            ♟️ Tactics & Lineup
          </button>
          <button
            className={`cm-tab-btn ${activeTab === 'match' ? 'active' : ''}`}
            onClick={() => setActiveTab('match')}
          >
            ⚡ Match Engine
          </button>
        </nav>

        <NavLink to="/" className="cm-exit-btn">
          ⬅ Return to Main Menu
        </NavLink>
      </header>

      {/* CONTENT AREA */}
      <main className="cm-content-area">
        {/* TEAM SELECTOR BANNER */}
        <div className="cm-team-banner">
          <div className="cm-team-info">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: currentTeamInfo.colors.primary,
                border: `2px solid ${currentTeamInfo.colors.secondary || '#fff'}`
              }}
            />
            <div>
              <h1 className="cm-team-name">{selectedTeamName}</h1>
              <div className="cm-team-detail">
                English Premier League (2004/05) | Reputation: {currentTeamInfo.reputation} | Squad: {currentSquad.length} Players
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#40e0d0', fontWeight: 'bold', marginRight: '8px' }}>
              Select Club:
            </label>
            <select
              className="cm-select-dropdown"
              value={selectedTeamName}
              onChange={(e) => setSelectedTeamName(e.target.value)}
            >
              {teamsData.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'squad' && (
          <CMSquadView squad={currentSquad} teamName={selectedTeamName} />
        )}

        {activeTab === 'tactics' && (
          <CMTacticsView
            starters={starters}
            bench={bench}
            onSwapPlayers={handleSwapPlayers}
            formation={formation}
            onChangeFormation={setFormation}
            tactics={tactics}
            onChangeTactics={setTactics}
          />
        )}

        {activeTab === 'match' && (
          <CMMatchView
            userTeamName={selectedTeamName}
            userSquad={currentSquad}
            userTactics={tactics}
            userFormation={formation}
            userStarters={starters}
            userBench={bench}
            allTeams={teamsData}
            allSquads={squadsData}
          />
        )}
      </main>
    </div>
  );
}
