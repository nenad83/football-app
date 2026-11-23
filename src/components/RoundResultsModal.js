import React from "react";

// Reuse inline TeamFlag component
const TeamFlag = ({ primaryColor, secondaryColor, size = 28 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const flagHeight = Math.round(size * 0.65);

  return (
    <svg
      width={size}
      height={flagHeight}
      viewBox="0 0 100 65"
      className="team-flag"
      style={{
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0
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

export default function RoundResultsModal({
  isOpen,
  fixtures,
  teams,
  playerTeamId,
  roundTitle,
  onClose,
  themeColor = '#00ff64'
}) {
  if (!isOpen || !fixtures || fixtures.length === 0) return null;

  // Helper to find a team by idnum (with optional name disambiguation for multi-division cups)
  const getTeam = (teamId, preferredName = null) => {
    if (Array.isArray(teams)) {
      if (preferredName) {
        const exactMatch = teams.find(t => t.idnum === teamId && t.name === preferredName)
          || teams.find(t => t.name === preferredName);
        if (exactMatch) return exactMatch;
      }
      return teams.find(t => t.idnum === teamId);
    }
    if (teams && typeof teams === 'object') {
      return teams[teamId];
    }
    return null;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      zIndex: 2500,
      padding: '20px 0'
    }}>
      <div className="glass-card animated-slide-in" style={{
        width: '90%',
        maxWidth: '550px',
        background: 'linear-gradient(135deg, rgba(22, 22, 28, 0.98), rgba(12, 12, 16, 0.99))',
        border: `2px solid ${themeColor}33`,
        boxShadow: `0 25px 50px rgba(0,0,0,0.7), 0 0 30px ${themeColor}1a`,
        borderRadius: '16px',
        padding: '25px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '20px',
        margin: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '15px' }}>
          <span style={{ fontSize: '10px', color: themeColor, fontWeight: 'bold', letterSpacing: '2px', fontFamily: 'Orbitron' }}>ROUND FINISHED</span>
          <h2 style={{ fontSize: '20px', margin: 0, color: '#fff', fontFamily: 'Orbitron', letterSpacing: '1px', textAlign: 'center' }}>
            {roundTitle || "ROUND RESULTS"}
          </h2>
        </div>

        {/* Fixtures List */}
        <div style={{
          maxHeight: '350px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingRight: '5px'
        }}>
          {fixtures.map((fixture, idx) => {
            const homeTeam = getTeam(fixture.homeId, fixture.homeName);
            const awayTeam = getTeam(fixture.awayId, fixture.awayName);
            const isPlayerFixture = fixture.homeId === playerTeamId || fixture.awayId === playerTeamId;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 15px',
                  borderRadius: '10px',
                  background: isPlayerFixture 
                    ? `linear-gradient(90deg, ${themeColor}11, rgba(255,255,255,0.02))` 
                    : 'rgba(255,255,255,0.02)',
                  border: isPlayerFixture 
                    ? `1.5px solid ${themeColor}88` 
                    : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isPlayerFixture 
                    ? `0 0 10px ${themeColor}1a` 
                    : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Home Team */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '40%', justifyContent: 'flex-end', textAlign: 'right' }}>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: isPlayerFixture ? 'bold' : 'normal', 
                    color: fixture.homeId === playerTeamId ? themeColor : '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {homeTeam?.name || fixture.homeName || `Team ${fixture.homeId}`}
                  </span>
                  <TeamFlag primaryColor={homeTeam?.primaryColor} secondaryColor={homeTeam?.secondaryColor} size={24} />
                </div>

                {/* Score */}
                <div style={{
                  width: '20%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Orbitron',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: isPlayerFixture ? themeColor : '#ffd700',
                  letterSpacing: '1px'
                }}>
                  {fixture.played ? (
                    `${fixture.homeScore} - ${fixture.awayScore}`
                  ) : (
                    'vs'
                  )}
                </div>

                {/* Away Team */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '40%', justifyContent: 'flex-start', textAlign: 'left' }}>
                  <TeamFlag primaryColor={awayTeam?.primaryColor} secondaryColor={awayTeam?.secondaryColor} size={24} />
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: isPlayerFixture ? 'bold' : 'normal', 
                    color: fixture.awayId === playerTeamId ? themeColor : '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {awayTeam?.name || fixture.awayName || `Team ${fixture.awayId}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          className="match-control-btn glowing-btn pulse"
          style={{
            marginTop: '10px',
            width: '100%',
            background: `linear-gradient(135deg, ${themeColor}dd, ${themeColor})`,
            borderColor: themeColor,
            color: '#000',
            fontWeight: '900',
            fontFamily: 'Orbitron',
            letterSpacing: '1px',
            boxShadow: `0 0 15px ${themeColor}33`,
            height: '45px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
          onClick={onClose}
        >
          CONTINUE TO OFFICE ➔
        </button>
      </div>
    </div>
  );
}
