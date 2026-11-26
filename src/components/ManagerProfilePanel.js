import React, { useState } from 'react';
import CountryFlag from './CountryFlag';
import NationFlag from './NationFlag';
import { NATIONALITIES, resolveNationality } from '../utils/nationalities';
import { getManagerLevelProgress, MANAGER_LEVELS } from '../utils/managerProgression';

const MiniFlag = ({ primaryColor = '#00ff64', secondaryColor = '#ffffff', size = 20 }) => {
  const isSolid = !secondaryColor || primaryColor === secondaryColor;
  const h = Math.round(size * 0.65);
  return (
    <svg width={size} height={h} viewBox="0 0 100 65" style={{ borderRadius: '3px', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 }}>
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

export default function ManagerProfilePanel({
  managerProfile,
  leagueState,
  editName,
  setEditName,
  editNationality = '',
  setEditNationality,
  editPhoto,
  onPhotoUpload,
  onSaveProfile
}) {
  const [honoursTab, setHonoursTab] = useState('trophies'); // 'trophies' | 'moty' | 'motm'
  const progress = getManagerLevelProgress(managerProfile);
  const resolvedNationality = resolveNationality(managerProfile?.nationality || editNationality || '');
  const currentStint = managerProfile?.currentStint;
  const currentClub = !leagueState?.isUnemployed
    ? leagueState?.teams?.find((t) => t.idnum === leagueState?.playerTeamId)
    : null;

  const totalMatches = (managerProfile?.wins || 0) + (managerProfile?.draws || 0) + (managerProfile?.losses || 0);
  const winPct = totalMatches > 0 ? Math.round(((managerProfile?.wins || 0) / totalMatches) * 100) : 0;

  const trophiesList = [...(managerProfile?.trophiesList || [])].reverse();
  const motyList = [...(managerProfile?.motyList || [])].reverse();
  const motmList = [...(managerProfile?.monthlyAwardsList || [])].reverse();
  const historyList = [...(managerProfile?.history || [])].reverse();
  const lastXpNote = managerProfile?.lastMatchXpNote;

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  return (
    <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1.5px solid rgba(255, 215, 0, 0.25)', borderRadius: '16px' }}>
      {/* Top Banner: Avatar + Level Progress + Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '20px', alignItems: 'center' }}>
        {/* Identity Column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.35)', padding: '18px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            width: '180px', height: '180px', borderRadius: 0,
            border: `2.5px solid ${progress.color}`, overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', boxShadow: `0 0 18px ${progress.color}33`
          }}>
            {(editPhoto || managerProfile?.photo) ? (
              <img src={editPhoto || managerProfile?.photo} alt="Manager Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '68px' }}>👔</span>
            )}
          </div>

          <label className="glowing-btn" style={{
            padding: '4px 12px', fontSize: '10px', cursor: 'pointer',
            borderColor: '#00ff64', color: '#00ff64', background: 'rgba(0, 255, 100, 0.05)',
            borderRadius: '4px', fontWeight: 'bold'
          }}>
            📷 UPLOAD PHOTO
            <input type="file" accept="image/*" onChange={onPhotoUpload} style={{ display: 'none' }} />
          </label>

          {/* Identity Summary: Flag + Name + Nationality */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(managerProfile?.nationality || editNationality) && (
                <NationFlag nation={managerProfile?.nationality || editNationality} size={22} />
              )}
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>
                {managerProfile?.name || editName || 'Manager'}
              </span>
            </div>
            {resolvedNationality && (
              <span style={{ fontSize: '10.5px', color: '#94a3b8', letterSpacing: '0.5px' }}>
                Nationality: <strong style={{ color: '#e2e8f0' }}>{resolvedNationality.name}</strong>
              </span>
            )}
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Manager Name"
                style={{
                  flex: 1, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(0,255,100,0.3)',
                  borderRadius: '8px', padding: '7px 10px', color: '#fff', fontSize: '12.5px',
                  outline: 'none', textAlign: 'center', fontWeight: 'bold'
                }}
                maxLength={20}
              />
              <button
                type="button"
                className="glowing-btn"
                style={{ padding: '7px 14px', fontSize: '11px', borderColor: '#ffd700', color: '#ffd700' }}
                onClick={onSaveProfile}
              >
                SAVE
              </button>
            </div>

            {setEditNationality && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '26px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                  {editNationality ? <NationFlag nation={editNationality} size={22} /> : <span style={{ fontSize: '14px' }}>🏳️</span>}
                </div>
                <select
                  value={editNationality}
                  onChange={(e) => setEditNationality(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.65)',
                    border: '1px solid rgba(0,229,255,0.3)',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    color: '#fff',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Nationality --</option>
                  {NATIONALITIES.map((nat) => (
                    <option key={nat.code} value={nat.code}>
                      {nat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Reputation & Level Progression Card */}
        <div style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${progress.color}44`, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#888', fontFamily: 'Orbitron', letterSpacing: '1px', display: 'block' }}>
                LEVEL {progress.level} MANAGER
              </span>
              <span style={{ fontSize: '16px', fontWeight: 'bold', color: progress.color, fontFamily: 'Orbitron' }}>
                {progress.icon} {progress.label}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron' }}>
                {progress.prestige.toLocaleString()}
              </span>
              <span style={{ fontSize: '11px', color: '#ffd700', marginLeft: '4px', fontFamily: 'Orbitron' }}>PTS</span>
            </div>
          </div>

          {/* Progress bar toward next level */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#aaa', marginBottom: '5px' }}>
              <span>Tier Range: {progress.minThreshold.toLocaleString()} – {progress.nextThreshold ? (progress.nextThreshold - 1).toLocaleString() : '∞'} PTS</span>
              <span style={{ color: progress.color, fontWeight: 'bold' }}>
                {progress.nextThreshold !== null
                  ? `${progress.pointsToNext.toLocaleString()} PTS to ${MANAGER_LEVELS[progress.level]?.label || 'Next'}`
                  : 'MAX LEVEL ACHIEVED'}
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{
                width: `${progress.progressPct}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${progress.color}, #ffffff)`,
                boxShadow: `0 0 10px ${progress.color}`,
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>

          {/* XP Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#00ff64', fontFamily: 'Orbitron' }}>{progress.breakdown.matchXp}</div>
              <div style={{ fontSize: '8.5px', color: '#888' }}>Match XP</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#00e5ff', fontFamily: 'Orbitron' }}>{progress.breakdown.seasonsXp}</div>
              <div style={{ fontSize: '8.5px', color: '#888' }}>Seasons</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e040fb', fontFamily: 'Orbitron' }}>{progress.breakdown.awardsXp}</div>
              <div style={{ fontSize: '8.5px', color: '#888' }}>Awards</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffd700', fontFamily: 'Orbitron' }}>{progress.breakdown.trophiesXp}</div>
              <div style={{ fontSize: '8.5px', color: '#888' }}>Trophies</div>
            </div>
          </div>

          {lastXpNote && (
            <div style={{ fontSize: '10.5px', color: '#00ff64', background: 'rgba(0, 255, 100, 0.06)', border: '1px solid rgba(0, 255, 100, 0.2)', borderRadius: '6px', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span>Last Match ({lastXpNote.competitionLabel} vs {lastXpNote.opponentName}, {lastXpNote.score}):</span>
              <strong>+{lastXpNote.xp} XP ({lastXpNote.breakdownLabel})</strong>
            </div>
          )}
        </div>
      </div>

      {/* Live Lifetime Career Statistics */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
        <h4 style={{ color: '#00e5ff', margin: '0 0 10px 0', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Orbitron' }}>
          📊 LIVE LIFETIME RECORD
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '8px', textAlign: 'center' }}>
          {[
            { val: totalMatches, lbl: 'Matches', color: '#fff' },
            { val: managerProfile?.wins || 0, lbl: 'Wins', color: '#00ff64' },
            { val: managerProfile?.draws || 0, lbl: 'Draws', color: '#ffd700' },
            { val: managerProfile?.losses || 0, lbl: 'Losses', color: '#ff4d4d' },
            { val: `${winPct}%`, lbl: 'Win Rate', color: '#38bdf8' },
            { val: `${managerProfile?.gf || 0}:${managerProfile?.ga || 0}`, lbl: 'Goals F:A', color: '#ccc' },
            { val: managerProfile?.seasons || 0, lbl: 'Seasons', color: '#fff' },
            { val: managerProfile?.leagueTitles || 0, lbl: 'League 🏆', color: '#ffd700' },
            { val: managerProfile?.cupTitles || 0, lbl: 'Cups ⭐', color: '#00e5ff' },
            { val: (managerProfile?.monthlyAwards || 0) + (managerProfile?.managerOfTheYear || 0), lbl: 'Awards 🎖️', color: '#e040fb' }
          ].map((stat) => (
            <div key={stat.lbl} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)', padding: '9px 6px', borderRadius: '8px' }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: stat.color, fontFamily: 'Orbitron' }}>{stat.val}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{stat.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Club Stint Strip */}
      {currentClub && (
        <div style={{ background: 'rgba(0, 255, 100, 0.04)', border: '1px solid rgba(0, 255, 100, 0.22)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MiniFlag primaryColor={currentClub.primaryColor} secondaryColor={currentClub.secondaryColor} size={28} />
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#00ff64', display: 'flex', alignItems: 'center', gap: '6px' }}>
                CURRENTLY MANAGING: {currentClub.name} <CountryFlag country={leagueState?.country} size={16} />
              </div>
              <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                {leagueState?.season} • {cap(leagueState?.country)} Division {leagueState?.division || 1}
              </div>
            </div>
          </div>
          {currentStint && (
            <div style={{ fontSize: '11px', color: '#ddd', fontFamily: 'Orbitron' }}>
              Stint: <strong>{currentStint.played}P</strong> ({currentStint.won}W-{currentStint.drawn}D-{currentStint.lost}L) • <span style={{ color: '#00ff64' }}>+{currentStint.xpEarned} XP</span>
            </div>
          )}
        </div>
      )}

      {/* Lower Split: Awards & Honours Showcase + Club Managerial History */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        {/* Career Awards & Trophies */}
        <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <h4 style={{ color: '#ffd700', margin: 0, fontSize: '11.5px', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
              🏅 CAREER AWARDS & TROPHIES
            </h4>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'trophies', label: `🏆 (${trophiesList.length})` },
                { id: 'moty', label: `👑 MOTY (${motyList.length})` },
                { id: 'motm', label: `🎖️ MOTM (${motmList.length})` }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setHonoursTab(t.id)}
                  style={{
                    fontSize: '9.5px', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'Orbitron', fontWeight: 'bold',
                    border: honoursTab === t.id ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.08)',
                    background: honoursTab === t.id ? 'rgba(255, 215, 0, 0.14)' : 'transparent',
                    color: honoursTab === t.id ? '#ffd700' : '#888'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '7px', paddingRight: '4px' }}>
            {honoursTab === 'trophies' && (
              trophiesList.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '12px 0' }}>
                  No major trophies won yet. Win Leagues (+450 PTS) or Cups (+500 PTS) to fill your cabinet!
                </span>
              ) : (
                trophiesList.map((tr, i) => (
                  <div key={i} style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.18)', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffd700' }}>🏆 {tr.trophy}</div>
                      <div style={{ fontSize: '10px', color: '#ccc' }}>{tr.team} • {tr.season}</div>
                    </div>
                    {tr.country && <CountryFlag country={tr.country} size={18} />}
                  </div>
                ))
              )
            )}

            {honoursTab === 'moty' && (
              motyList.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '12px 0' }}>
                  No Manager of the Year awards won yet (+250 PTS each).
                </span>
              ) : (
                motyList.map((m, i) => (
                  <div key={i} style={{ background: 'rgba(255,0,85,0.07)', border: '1px solid rgba(255,0,85,0.22)', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ff4081' }}>👑 Manager of the Year — {m.season}</div>
                    <div style={{ fontSize: '10px', color: '#ccc' }}>{m.team} (+250 PTS)</div>
                  </div>
                ))
              )
            )}

            {honoursTab === 'motm' && (
              motmList.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '12px 0' }}>
                  No Manager of the Month awards won yet (+60 PTS each).
                </span>
              ) : (
                motmList.map((m, i) => (
                  <div key={i} style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.18)', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#00e5ff' }}>🎖️ {m.month} ({m.season})</div>
                      <div style={{ fontSize: '10px', color: '#ccc' }}>{m.team} • {m.record} ({m.points} pts)</div>
                    </div>
                    <span style={{ fontSize: '10px', color: '#ffd700', fontWeight: 'bold' }}>+60 PTS</span>
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* Teams Managed History Timeline */}
        <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ color: '#00e5ff', margin: 0, fontSize: '11.5px', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
            📜 TEAMS MANAGED HISTORY ({historyList.length})
          </h4>

          <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {historyList.length === 0 ? (
              <span style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', padding: '12px 0' }}>
                Complete a season or switch clubs to build your managerial timeline!
              </span>
            ) : (
              historyList.map((h, idx) => {
                const stintWinPct = h.played > 0 ? Math.round(((h.won || 0) / h.played) * 100) : 0;
                return (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '12px', color: '#fff' }}>
                        {h.country && <CountryFlag country={h.country} size={16} />}
                        <span>{h.team}</span>
                        <span style={{ fontSize: '10px', color: '#00e5ff' }}>({h.season})</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {h.finalPos > 0 && (
                          <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.08)', color: '#ddd', padding: '1px 5px', borderRadius: '3px', fontFamily: 'Orbitron' }}>
                            POS {h.finalPos}
                          </span>
                        )}
                        {h.leagueTitle > 0 && <span title="League Champion">🏆</span>}
                        {h.cupTitle > 0 && <span title="Cup Winner">⭐</span>}
                        {h.monthlyAwardsWon > 0 && <span style={{ fontSize: '9px', color: '#ffd700' }}>🎖️x{h.monthlyAwardsWon}</span>}
                        {h.managerOfTheYearWon > 0 && <span style={{ fontSize: '9px', color: '#ff4081' }}>👑</span>}
                      </div>
                    </div>

                    <div style={{ fontSize: '10px', color: '#aaa', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <span>
                        <strong style={{ color: '#fff' }}>{h.played}P</strong> | <strong style={{ color: '#00ff64' }}>{h.won}W</strong> <strong style={{ color: '#ffd700' }}>{h.drawn}D</strong> <strong style={{ color: '#ff4d4d' }}>{h.lost}L</strong> | <strong style={{ color: '#00e5ff' }}>{h.points} pts</strong>
                      </span>
                      <span style={{ color: '#888' }}>Win% {stintWinPct}% {h.note ? `• ${h.note}` : ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
