import React, { useEffect } from 'react';
import './App.css';
import { Routes, Route, useLocation } from "react-router-dom";
import Home from './components/Home';
import Friendly from './components/Friendly';
import TeamSelect from './components/TeamSelect';
import Match from './components/Match';
import LeagueSelect from './components/LeagueSelect';
import LeagueDashboard from './components/LeagueDashboard';
import TournamentSelect from './components/TournamentSelect';
import TournamentDashboard from './components/TournamentDashboard';
import PreMatch from './components/PreMatch';
import Fixtures from './components/Fixtures';
import Zone12EngineTestDemo from './components/Zone12EngineTestDemo';
import { applyTeamTheme, resetToDefaultTheme } from './utils/themeManager';
import { cleanStale1To5Rosters } from './data/rosters/rosterRegistry';

function App() {
  const location = useLocation();

  useEffect(() => {
    // Purge any stale 1-5 cached squads and upgrade career teams to 1-10
    cleanStale1To5Rosters();
  }, []);

  useEffect(() => {
    // When on home page or initial game mode select, use default retro green
    if (location.pathname === '/' || location.pathname === '/friendly' || location.pathname === '/league' || location.pathname === '/tournament') {
      resetToDefaultTheme();
    } else {
      // In league dashboard, tournament, pre-match, match, etc., apply the player team's theme
      applyTeamTheme();
    }
  }, [location.pathname]);

  return (
    

    <Routes>
      <Route exact path="/" element={<Home />} />
      <Route path="/zone12-demo" element={<Zone12EngineTestDemo />} />
      <Route exact path="/friendly" element={<Friendly />} />
      <Route exact path="/pre-match" element={<PreMatch />} />
      <Route exact path="/match" element={<Match />} />

      <Route exact path="/mex86" element={<TeamSelect />} />

      <Route exact path="/fra84" element={<TeamSelect />} />
      <Route exact path="/ger88" element={<TeamSelect />} />
      <Route exact path="/swe92" element={<TeamSelect />} />
      <Route exact path="/eng96" element={<TeamSelect />} />
      <Route exact path="/nld00" element={<TeamSelect />} />
      <Route exact path="/por04" element={<TeamSelect />} />
      <Route exact path="/aut08" element={<TeamSelect />} />
      <Route exact path="/polukr12" element={<TeamSelect />} />
      <Route exact path="/fra16" element={<TeamSelect />} />
      <Route exact path="/eur20" element={<TeamSelect />} />
      <Route exact path="/eur24" element={<TeamSelect />} />

      <Route exact path="/ecu93" element={<TeamSelect />} />
      <Route exact path="/bol97" element={<TeamSelect />} />
      <Route exact path="/par99" element={<TeamSelect />} />
      <Route exact path="/col01" element={<TeamSelect />} />
      <Route exact path="/per04" element={<TeamSelect />} />
      <Route exact path="/ven07" element={<TeamSelect />} />
      <Route exact path="/arg11" element={<TeamSelect />} />
      <Route exact path="/chl15" element={<TeamSelect />} />
      <Route exact path="/usa16" element={<TeamSelect />} />
      <Route exact path="/bra19" element={<TeamSelect />} />
      <Route exact path="/bra21" element={<TeamSelect />} />
      <Route exact path="/chi91" element={<TeamSelect />} />
      <Route exact path="/bra89" element={<TeamSelect />} />
      <Route exact path="/cop24" element={<TeamSelect />} />
      <Route exact path="/ita90" element={<TeamSelect />} />
      <Route exact path="/usa94" element={<TeamSelect />} />
      <Route exact path="/korjap02" element={<TeamSelect />} />
      <Route exact path="/ger06" element={<TeamSelect />} />
      <Route exact path="/rsa10" element={<TeamSelect />} />
      <Route exact path="/bra14" element={<TeamSelect />} />
      <Route exact path="/rus18" element={<TeamSelect />} />
      <Route exact path="/qat22" element={<TeamSelect />} />
      <Route exact path="/world26" element={<TeamSelect />} />

      <Route exact path="/league" element={<LeagueSelect />} />
      <Route exact path="/league/dashboard" element={<LeagueDashboard />} />
      <Route exact path="/league/fixtures" element={<Fixtures />} />

      <Route exact path="/tournament" element={<TournamentSelect />} />
      <Route exact path="/tournament/dashboard" element={<TournamentDashboard />} />
    </Routes>
  );
}

export default App;

