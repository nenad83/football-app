import React, { useEffect, useState } from "react";
import '../assets/styles/Match.css';
import { useNavigate } from 'react-router-dom';

// Inline premium vector Team Flag component
const TeamFlag = ({ primaryColor, secondaryColor, size = 120 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const flagHeight = Math.round(size * 0.65);
  
  return (
    <svg 
      width={size} 
      height={flagHeight} 
      viewBox="0 0 100 65" 
      className="team-flag" 
      style={{ 
        borderRadius: '6px', 
        overflow: 'hidden', 
        border: '1.5px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    >
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

export default function TeamSelect() {
  const [data, setData] = useState([]);
  const [teamone, setTeamOne] = useState('');
  const [teamtwo, setTeamTwo] = useState('');

  const value = window.location.pathname;
  const navigate = useNavigate();

  useEffect(() => {
    const raw = value.slice(1);
    const getCupSubdir = (cupId) => {
      if (["mex86", "ita90", "usa94", "korjap02", "ger06", "rsa10", "bra14", "rus18", "qat22", "world26"].includes(cupId)) return "wc";
      if (["fra84", "ger88", "swe92", "eng96", "nld00", "por04", "aut08", "polukr12", "fra16", "eur20", "eur24"].includes(cupId)) return "ec";
      if (["ecu93", "chi91", "bra89", "bol97", "par99", "col01", "per04", "ven07", "arg11", "chl15", "usa16", "bra19", "bra21", "cop24"].includes(cupId)) return "cam";
      return "";
    };
    const subdir = getCupSubdir(raw);
    fetch("../data/cups/" + subdir + "/" + raw + ".json")
      .then(res => res.json())
      .then(data => setData(data || []))
      .catch(err => console.log(err, ' error'));
  }, [value]);

  function playMatch() {
    if (!teamone || !teamtwo) {
      alert("Please select both teams first!");
      return;
    }
    navigate("/pre-match?" + value.slice(1) + "&team1=" + teamone + "&team2=" + teamtwo);
  }

  const selectedTeamOneObj = data.find(t => String(t.idnum) === String(teamone));
  const selectedTeamTwoObj = data.find(t => String(t.idnum) === String(teamtwo));

  // Capitalize path for header
  const getCupTitle = () => {
    const raw = value.slice(1);
    if (raw === "mex86") return "Mexico 1986";
    if (raw === "ita90") return "Italy 1990";
    if (raw === "usa94") return "USA 1994";
    if (raw === "korjap02") return "Korea/Japan 2002";
    if (raw === "ger06") return "Germany 2006";
    if (raw === "rsa10") return "South Africa 2010";
    if (raw === "bra14") return "Brazil 2014";
    if (raw === "fra84") return "France 1984";
    if (raw === "ger88") return "Germany 1988";
    if (raw === "swe92") return "Sweden 1992";
    if (raw === "eng96") return "England 1996";
    if (raw === "nld00") return "Belgium & Netherlands 2000";
    if (raw === "por04") return "Portugal 2004";
    if (raw === "aut08") return "Austria & Switzerland 2008";
    if (raw === "polukr12") return "Poland & Ukraine 2012";
    if (raw === "fra16") return "France 2016";
    if (raw === "ecu93") return "Ecuador 1993";
    if (raw === "bol97") return "Bolivia 1997";
    if (raw === "par99") return "Paraguay 1999";
    if (raw === "col01") return "Colombia 2001";
    if (raw === "per04") return "Peru 2004";
    if (raw === "ven07") return "Venezuela 2007";
    if (raw === "arg11") return "Argentina 2011";
    if (raw === "chl15") return "Chile 2015";
    if (raw === "usa16") return "USA 2016";
    if (raw === "bra19") return "Brazil 2019";
    if (raw === "bra21") return "Brazil 2021";
    return raw.toUpperCase();
  };

  return (
    <div className="Match team-select-container">
      <div className="matchheader selector-header">
        <h1 className="glowing-header-text">TEAM SELECTION</h1>
        <h2 className="cup-subtitle">{getCupTitle()}</h2>
        <button className="play-match-btn glowing-btn" onClick={playMatch}>KICK OFF!</button>
      </div>

      <div className="teams selection-deck">
        
        {/* Left Team (Player 1) */}
        <div id="teamone" className="team-select-card card-left">
          <h2>PLAYER 1 (HOME)</h2>
          <div className="select-wrapper">
            <select className="team-dropdown" value={teamone} onChange={(e) => setTeamOne(e.target.value)}>
              <option value="" disabled>-- CHOOSE TEAM --</option>
              {data.map((team) => (
                <option key={team.idnum} value={team.idnum}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="kit-display">
            {selectedTeamOneObj ? (
              selectedTeamOneObj.primaryColor ? (
                <TeamFlag primaryColor={selectedTeamOneObj.primaryColor} secondaryColor={selectedTeamOneObj.secondaryColor} size={140} />
              ) : (
                <img className="kit-preview-img" alt={`${selectedTeamOneObj.name} kit`} src={"../images/kits" + value + "/" + teamone + ".png"} />
              )
            ) : (
              <div className="empty-kit-slot">?</div>
            )}
          </div>

          {selectedTeamOneObj && (
            <div className="stats-box animated-slide-in">
              <div className="stat-row">
                <span className="stat-label">Attack</span>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill attack-fill" style={{ width: `${selectedTeamOneObj.attack * 20}%` }}></div>
                </div>
                <span className="stat-val">{selectedTeamOneObj.attack}/5</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Midfield</span>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill midfield-fill" style={{ width: `${selectedTeamOneObj.midfield * 20}%` }}></div>
                </div>
                <span className="stat-val">{selectedTeamOneObj.midfield}/5</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Defense</span>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill defense-fill" style={{ width: `${selectedTeamOneObj.defense * 20}%` }}></div>
                </div>
                <span className="stat-val">{selectedTeamOneObj.defense}/5</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Team (Player 2 / AI) */}
        <div id="teamtwo" className="team-select-card card-right">
          <h2>PLAYER 2 (AWAY)</h2>
          <div className="select-wrapper">
            <select className="team-dropdown" value={teamtwo} onChange={(e) => setTeamTwo(e.target.value)}>
              <option value="" disabled>-- CHOOSE TEAM --</option>
              {data.map((team) => (
                <option key={team.idnum} value={team.idnum}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="kit-display">
            {selectedTeamTwoObj ? (
              selectedTeamTwoObj.primaryColor ? (
                <TeamFlag primaryColor={selectedTeamTwoObj.primaryColor} secondaryColor={selectedTeamTwoObj.secondaryColor} size={140} />
              ) : (
                <img className="kit-preview-img" alt={`${selectedTeamTwoObj.name} kit`} src={"../images/kits" + value + "/" + teamtwo + ".png"} />
              )
            ) : (
              <div className="empty-kit-slot">?</div>
            )}
          </div>

          {selectedTeamTwoObj && (
            <div className="stats-box animated-slide-in">
              <div className="stat-row">
                <span className="stat-label">Attack</span>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill attack-fill" style={{ width: `${selectedTeamTwoObj.attack * 20}%` }}></div>
                </div>
                <span className="stat-val">{selectedTeamTwoObj.attack}/5</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Midfield</span>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill midfield-fill" style={{ width: `${selectedTeamTwoObj.midfield * 20}%` }}></div>
                </div>
                <span className="stat-val">{selectedTeamTwoObj.midfield}/5</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Defense</span>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill defense-fill" style={{ width: `${selectedTeamTwoObj.defense * 20}%` }}></div>
                </div>
                <span className="stat-val">{selectedTeamTwoObj.defense}/5</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
