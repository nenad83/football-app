import React, { useState } from 'react';
import CountryFlag from './CountryFlag';
import { computeHireProbability } from '../utils/worldCareerManager';

const MiniClubBadge = ({ primaryColor = '#00e5ff', secondaryColor = '#ffffff', size = 28 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const h = Math.round(size * 0.65);
  return (
    <svg width={size} height={h} viewBox="0 0 100 65" style={{ borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
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

export default function WorldJobsPanel({
  leagueState,
  managerPrestige = 0,
  boardConfidence = 60,
  onApplyVacancy,
  onAcceptDirectOffer,
  onDeclineDirectOffer,
  onAdvanceUnemployedWeek,
  isBusy = false
}) {
  const [filterScope, setFilterScope] = useState('all'); // 'all' | 'domestic' | 'foreign'

  const worldState = leagueState?.worldState || {};
  const vacancies = worldState.vacancies || [];
  const directOffers = worldState.directOffers || [];
  const cooldowns = worldState.rejectedCooldowns || {};
  const isUnemployed = Boolean(leagueState?.isUnemployed);
  const currentCountry = leagueState?.country || 'england';
  const currentClub = !isUnemployed
    ? leagueState?.teams?.find((t) => t.idnum === leagueState?.playerTeamId)
    : null;

  const filteredVacancies = vacancies.filter((v) => {
    if (filterScope === 'domestic') return v.country === currentCountry;
    if (filterScope === 'foreign') return v.country !== currentCountry;
    return true;
  });

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  return (
    <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#00e5ff', fontFamily: 'Orbitron', letterSpacing: '2px' }}>
            💼 LIVE MANAGER JOB MARKET
          </h2>
          <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {isUnemployed
              ? 'Unemployed Free Agent • Advance Weeks & Apply Anytime'
              : `Currently Managing ${currentClub?.name || 'Club'} • Immediate Mid-Season Takeovers Active`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.25)', borderRadius: '8px', padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#ffd700', fontFamily: 'Orbitron' }}>REPUTATION</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>{managerPrestige} PTS</div>
          </div>

          {isUnemployed && onAdvanceUnemployedWeek && (
            <button
              type="button"
              disabled={isBusy}
              onClick={onAdvanceUnemployedWeek}
              className="play-match-btn glowing-btn pulse"
              style={{ fontSize: '11px', padding: '9px 16px', borderColor: '#00ff64', color: '#00ff64' }}
            >
              ⏩ ADVANCE 1 WEEK (SIM WORLD)
            </button>
          )}
        </div>
      </div>

      {/* Section 1: Direct Headhunt Offers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '12px', color: '#ffd700', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
          📩 DIRECT CLUB APPROACHES ({directOffers.length})
        </h3>
        {directOffers.length === 0 ? (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '14px', fontSize: '11.5px', color: '#888' }}>
            No direct headhunt offers right now. Strong results and high manager prestige will attract immediate club approaches (including foreign leagues).
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '12px' }}>
            {directOffers.map((offer) => (
              <div key={offer.id} style={{ background: 'rgba(255, 215, 0, 0.05)', border: '1.5px solid rgba(255, 215, 0, 0.35)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MiniClubBadge primaryColor={offer.primaryColor} secondaryColor={offer.secondaryColor} size={32} />
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {offer.name} <CountryFlag country={offer.country} size={18} />
                      </div>
                      <div style={{ fontSize: '10px', color: '#ffd700' }}>
                        {cap(offer.country)} D{offer.division} • Pos {offer.leaguePos}/{offer.totalTeams} • {offer.remainingRounds} rounds left
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 215, 0, 0.15)', color: '#ffd700', fontFamily: 'Orbitron' }}>
                    {offer.roundsLeft}W LEFT
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#ccc', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span>Target: <strong style={{ color: '#00ff64' }}>{offer.expectedText}</strong></span>
                  <span>Rating: <strong>ATT {offer.attack} | MID {offer.midfield} | DEF {offer.defense}</strong></span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onAcceptDirectOffer(offer)}
                    className="play-match-btn glowing-btn"
                    style={{ flex: 1, fontSize: '10.5px', padding: '8px', borderColor: '#00ff64', color: '#00ff64' }}
                  >
                    {isBusy ? 'LOADING...' : '✅ ACCEPT IMMEDIATE TAKEOVER'}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onDeclineDirectOffer(offer.id)}
                    className="play-match-btn"
                    style={{ fontSize: '10.5px', padding: '8px 12px', borderColor: 'rgba(255,255,255,0.15)', color: '#aaa', background: 'transparent' }}
                  >
                    DECLINE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Open Club Vacancies */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '12px', color: '#00e5ff', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
            🚨 AVAILABLE CLUB VACANCIES ({filteredVacancies.length})
          </h3>

          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'all', label: 'ALL' },
              { id: 'domestic', label: `${cap(currentCountry).toUpperCase()}` },
              { id: 'foreign', label: 'FOREIGN' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterScope(f.id)}
                style={{
                  fontSize: '10px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontFamily: 'Orbitron',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  border: filterScope === f.id ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
                  background: filterScope === f.id ? 'rgba(0, 229, 255, 0.14)' : 'transparent',
                  color: filterScope === f.id ? '#00e5ff' : '#888'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredVacancies.length === 0 ? (
          <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '20px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
            {Number(leagueState?.currentRound || 1) <= 5
              ? 'Season just kicked off! Managerial pressure & sackings across clubs begin around Round 6+.'
              : 'No matching club vacancies right now. Advance another week as boards evaluate underperforming managers!'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
            {filteredVacancies.map((vac) => {
              const cd = cooldowns[vac.clubKey] || 0;
              const chance = computeHireProbability(managerPrestige, vac.minPrestige, boardConfidence, true);
              const chanceColor = chance >= 70 ? '#00ff64' : (chance >= 45 ? '#ffd700' : '#ff6b6b');

              return (
                <div key={vac.id} style={{ background: 'rgba(0,0,0,0.42)', border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <MiniClubBadge primaryColor={vac.primaryColor} secondaryColor={vac.secondaryColor} size={30} />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {vac.name} <CountryFlag country={vac.country} size={18} />
                          {!vac.isTracked && (
                            <span style={{ fontSize: '8.5px', background: 'rgba(224, 64, 251, 0.2)', color: '#e040fb', padding: '1px 5px', borderRadius: '3px', fontFamily: 'Orbitron' }}>
                              INT&apos;L
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                          {cap(vac.country)} D{vac.division} • Pos {vac.leaguePos}/{vac.totalTeams} • {vac.remainingRounds} rounds left
                        </div>
                      </div>
                    </div>

                    <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255, 145, 0, 0.14)', color: '#ff9100', fontFamily: 'Orbitron', whiteSpace: 'nowrap' }}>
                      CLOSES IN {vac.roundsLeft}W
                    </span>
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#bbb', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                    <span>Dismissed: <strong style={{ color: '#ff8a80' }}>{vac.prevManagerName}</strong></span>
                    <span>Rating: <strong style={{ color: '#00e5ff' }}>{vac.attack}/{vac.midfield}/{vac.defense}</strong></span>
                  </div>

                  <div style={{ fontSize: '10.5px', color: '#aaa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Target: <strong style={{ color: '#00ff64' }}>{vac.expectedText}</strong></span>
                    <span>
                      Hire Odds: <strong style={{ color: chanceColor }}>{chance}%</strong> (Req ~{vac.minPrestige} PTS)
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isBusy || cd > 0}
                    onClick={() => onApplyVacancy(vac)}
                    className="play-match-btn glowing-btn"
                    style={{
                      marginTop: '4px',
                      width: '100%',
                      fontSize: '10.5px',
                      padding: '8px',
                      borderColor: cd > 0 ? '#555' : '#00e5ff',
                      color: cd > 0 ? '#777' : '#00e5ff',
                      cursor: cd > 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {cd > 0
                      ? `🔒 REJECTED (${cd}W COOLDOWN)`
                      : (isBusy ? 'PROCESSING...' : (vac.isTracked ? '📝 APPLY FOR IMMEDIATE TAKEOVER' : '✈️ APPLY & SIMULATE LEAGUE TO DATE'))}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
