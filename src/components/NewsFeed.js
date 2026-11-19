import React, { useState } from 'react';
import { CATEGORY_CONFIG } from '../utils/newsGenerator';

export default function NewsFeed({
  newsItems = [],
  onSelectTab,
  onMarkRead,
  onMarkAllRead
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedNewsId, setSelectedNewsId] = useState(
    newsItems.length > 0 ? newsItems[0].id : null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items based on category and search query
  const filteredItems = newsItems.filter(item => {
    const matchesCategory =
      activeCategory === 'all' ||
      (activeCategory === 'match' && (item.category === 'match' || item.category === 'league' || item.category === 'drama' || item.category === 'cup')) ||
      (activeCategory === 'transfer' && item.category === 'transfer') ||
      (activeCategory === 'preview' && (item.category === 'preview' || item.category === 'derby')) ||
      (activeCategory === 'board' && (item.category === 'board' || item.category === 'pressure' || item.category === 'award' || item.category === 'yearlyAward')) ||
      (activeCategory === 'medical' && item.category === 'medical');

    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Automatically select first item in filtered list if current selection is invalid
  const currentSelectedId = selectedNewsId && filteredItems.some(i => i.id === selectedNewsId)
    ? selectedNewsId
    : (filteredItems.length > 0 ? filteredItems[0].id : null);

  const activeNews = newsItems.find(i => i.id === currentSelectedId);

  const handleSelectNews = (id) => {
    setSelectedNewsId(id);
    if (onMarkRead) {
      onMarkRead(id);
    }
  };

  return (
    <div className="glass-card animated-slide-in" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
      
      {/* Header bar */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 className="glowing-header-text" style={{ fontSize: '20px', margin: 0, color: '#00e5ff', fontFamily: 'Orbitron', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📰 CLUB & LEAGUE NEWS DESK</span>
          </h2>
          <span style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Football Manager Live Media & Scouting Feed
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#fff',
              fontSize: '11px',
              outline: 'none',
              width: '160px'
            }}
          />
          {onMarkAllRead && (
            <button
              onClick={onMarkAllRead}
              style={{
                background: 'rgba(0, 229, 255, 0.1)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '6px',
                color: '#00e5ff',
                fontSize: '11px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontFamily: 'Orbitron'
              }}
            >
              ✓ MARK ALL READ
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'all', label: '🌐 ALL NEWS' },
          { id: 'match', label: '⚽ MATCHES & DRAMA' },
          { id: 'transfer', label: '💰 TRANSFERS' },
          { id: 'preview', label: '🧠 TACTICS & DERBIES' },
          { id: 'board', label: '💼 BOARD & MEDIA' },
          { id: 'medical', label: '🏥 MEDICAL & SQUAD' }
        ].map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: isActive ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                border: isActive ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.06)',
                color: isActive ? '#00e5ff' : '#888',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: 'Orbitron',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Main 2-Column Reader Layout */}
      <div style={{ display: 'flex', gap: '20px', minHeight: '480px' }}>

        {/* Left Column: News Inbox Feed */}
        <div style={{
          width: '38%',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '520px',
          overflowY: 'auto'
        }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
              No news stories match selected category.
            </div>
          ) : (
            filteredItems.map(item => {
              const isSelected = item.id === currentSelectedId;
              const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.league;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectNews(item.id)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: isSelected
                      ? 'linear-gradient(135deg, rgba(0, 229, 255, 0.12), rgba(0, 255, 100, 0.05))'
                      : (item.isRead ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.04)'),
                    border: isSelected
                      ? '1px solid #00e5ff'
                      : (item.isRead ? '1px solid rgba(255,255,255,0.04)' : `1px solid ${catConfig.color}66`),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 'bold',
                      fontFamily: 'Orbitron',
                      color: catConfig.color,
                      background: `${catConfig.color}15`,
                      padding: '2px 6px',
                      borderRadius: '3px',
                      border: `1px solid ${catConfig.color}33`
                    }}>
                      {catConfig.icon} {item.categoryLabel || catConfig.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#888' }}>{item.dateStr}</span>
                      {!item.isRead && (
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#00ff64',
                          boxShadow: '0 0 6px #00ff64',
                          display: 'inline-block'
                        }} />
                      )}
                    </div>
                  </div>

                  <h4 style={{
                    fontSize: '12.5px',
                    color: isSelected ? '#00e5ff' : (item.isRead ? '#ccc' : '#fff'),
                    margin: '0 0 4px 0',
                    fontWeight: item.isRead ? 'normal' : 'bold',
                    lineHeight: '1.3'
                  }}>
                    {item.title}
                  </h4>

                  <p style={{
                    fontSize: '11px',
                    color: '#888',
                    margin: 0,
                    lineHeight: '1.3',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.summary}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Full Article View */}
        <div style={{
          width: '62%',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '10px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          maxHeight: '520px',
          overflowY: 'auto'
        }}>
          {activeNews ? (
            <>
              {/* Article Top Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  fontFamily: 'Orbitron',
                  color: (CATEGORY_CONFIG[activeNews.category] || CATEGORY_CONFIG.league).color,
                  letterSpacing: '1px'
                }}>
                  {(CATEGORY_CONFIG[activeNews.category] || CATEGORY_CONFIG.league).icon} {activeNews.categoryLabel || (CATEGORY_CONFIG[activeNews.category] || CATEGORY_CONFIG.league).label}
                </span>
                <span style={{ fontSize: '11px', color: '#888', fontFamily: 'Orbitron' }}>
                  {activeNews.dateStr}
                </span>
              </div>

              {/* Title */}
              <h3 style={{ fontSize: '18px', color: '#fff', margin: 0, fontWeight: 'bold', lineHeight: '1.4' }}>
                {activeNews.title}
              </h3>

              {/* Match Scoreline Widget if available */}
              {activeNews.matchWidget && (
                <div style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(0,255,100,0.3)',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  display: 'flex',
                  justify: 'space-around',
                  alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: activeNews.matchWidget.homeTeam === activeNews.matchWidget.userTeam ? '#00ff64' : '#fff' }}>
                    {activeNews.matchWidget.homeTeam}
                  </span>
                  <div style={{ fontFamily: 'Orbitron', fontSize: '18px', fontWeight: 'bold', color: '#00e5ff', background: 'rgba(0,229,255,0.1)', padding: '4px 14px', borderRadius: '6px', border: '1px solid rgba(0,229,255,0.3)' }}>
                    {activeNews.matchWidget.homeScore} - {activeNews.matchWidget.awayScore}
                  </div>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: activeNews.matchWidget.awayTeam === activeNews.matchWidget.userTeam ? '#00ff64' : '#fff' }}>
                    {activeNews.matchWidget.awayTeam}
                  </span>
                </div>
              )}

              {/* Monthly or Yearly Award Widget if available */}
              {activeNews.awardWidget && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(0, 0, 0, 0.6))',
                  border: '1.5px solid #ffd700',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 0 15px rgba(255, 215, 0, 0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Orbitron', fontSize: '13px', fontWeight: 'bold', color: '#ffd700', letterSpacing: '1px' }}>
                      🏆 {activeNews.awardWidget.title}
                    </span>
                    <span style={{ fontSize: '10.5px', background: 'rgba(255,215,0,0.2)', color: '#ffd700', padding: '3px 8px', borderRadius: '4px', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                      OFFICIAL AWARD
                    </span>
                  </div>

                  <div style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,215,0,0.3)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '28px' }}>🥇</span>
                      <div>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', display: 'block' }}>
                          {activeNews.awardWidget.winner}
                        </span>
                        <span style={{ fontSize: '12px', color: '#00ff64', fontWeight: 'bold' }}>
                          {activeNews.awardWidget.team}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'Orbitron' }}>
                      <span style={{ fontSize: '10px', color: '#aaa', display: 'block' }}>RECORD</span>
                      <span style={{ fontSize: '13px', color: '#ffd700', fontWeight: 'bold' }}>
                        {activeNews.awardWidget.record}
                      </span>
                    </div>
                  </div>

                  {activeNews.awardWidget.runnersUp && activeNews.awardWidget.runnersUp.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {activeNews.awardWidget.runnersUp.map((ru, idx) => (
                        <div key={idx} style={{
                          flex: 1,
                          minWidth: '140px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>{idx === 0 ? '🥈' : '🥉'}</span>
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#eee', display: 'block' }}>
                              {ru.managerName || ru.name}
                            </span>
                            <span style={{ color: '#888', fontSize: '9.5px' }}>
                              {ru.teamName || ru.team} {ru.points !== undefined ? `(${ru.points} pts)` : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Derby / Rivalry Clash Widget if available */}
              {activeNews.derbyWidget && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 51, 68, 0.12), rgba(0, 0, 0, 0.5))',
                  border: '1px solid #ff3344',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Orbitron', fontSize: '13px', fontWeight: 'bold', color: '#ff3344', letterSpacing: '1px' }}>
                      ⚔️ {activeNews.derbyWidget.name.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '10px', background: 'rgba(255,51,68,0.2)', color: '#ff3344', padding: '2px 8px', borderRadius: '4px', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                      ARCH-RIVALRY
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0', borderTop: '1px solid rgba(255,51,68,0.2)', borderBottom: '1px solid rgba(255,51,68,0.2)' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#00ff64' }}>{activeNews.derbyWidget.userTeam}</span>
                    <span style={{ fontSize: '16px', color: '#ff3344', fontWeight: 'bold', fontFamily: 'Orbitron' }}>VS</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#ff3344' }}>{activeNews.derbyWidget.opponentName}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#ccc', fontStyle: 'italic' }}>
                    {activeNews.derbyWidget.desc}
                  </p>
                </div>
              )}

              {/* Title Race & Relegation Drama Widget if available */}
              {activeNews.dramaWidget && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.15), rgba(0,0,0,0.5))',
                  border: '1px solid #9c27b0',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Orbitron', fontSize: '11px', fontWeight: 'bold', color: '#ba68c8', letterSpacing: '1px' }}>
                      {activeNews.dramaWidget.type === 'champions' ? '👑 TITLE CLINCHED' : (activeNews.dramaWidget.type === 'title_decider' ? '🏆 TITLE DECIDER' : '⚠️ RELEGATION SCRAP')}
                    </span>
                    <span style={{ fontSize: '10px', color: '#ddd', fontFamily: 'Orbitron' }}>
                      {activeNews.dramaWidget.roundsRemaining} match{activeNews.dramaWidget.roundsRemaining === 1 ? '' : 'es'} left
                    </span>
                  </div>
                  {activeNews.dramaWidget.type === 'champions' ? (
                    <div style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>
                      👑 {activeNews.dramaWidget.championName} ({activeNews.dramaWidget.points} pts) lead {activeNews.dramaWidget.runnerUpName} ({activeNews.dramaWidget.runnerUpPoints} pts)
                    </div>
                  ) : (
                    <div style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>
                      {activeNews.dramaWidget.teamA} (Pos #{activeNews.dramaWidget.rankA}) vs {activeNews.dramaWidget.teamB} (Pos #{activeNews.dramaWidget.rankB})
                    </div>
                  )}
                </div>
              )}

              {/* Manager Pressure / Form Streak Widget if available */}
              {activeNews.pressureWidget && (
                <div style={{
                  background: activeNews.pressureWidget.type === 'crisis'
                    ? 'linear-gradient(135deg, rgba(230, 0, 92, 0.15), rgba(0,0,0,0.5))'
                    : 'linear-gradient(135deg, rgba(0, 255, 100, 0.1), rgba(0,0,0,0.5))',
                  border: `1px solid ${activeNews.pressureWidget.type === 'crisis' ? '#e6005c' : '#00ff64'}`,
                  borderRadius: '10px',
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontFamily: 'Orbitron', fontSize: '11px', fontWeight: 'bold', color: activeNews.pressureWidget.type === 'crisis' ? '#ff3366' : '#00ff64', display: 'block' }}>
                      {activeNews.pressureWidget.type === 'crisis' ? '🚨 CRISIS RADAR' : (activeNews.pressureWidget.type === 'winning_streak' ? '🔥 WINNING STREAK' : '🛡️ UNBEATEN RUN')}
                    </span>
                    <span style={{ fontSize: '12px', color: '#ccc' }}>
                      {activeNews.pressureWidget.teamName} · Mgr. {activeNews.pressureWidget.managerName}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Orbitron', fontSize: '18px', fontWeight: 'bold', color: activeNews.pressureWidget.type === 'crisis' ? '#ff3366' : '#00ff64' }}>
                    {activeNews.pressureWidget.type === 'crisis' ? `${activeNews.pressureWidget.losses} DEFEATS` : (activeNews.pressureWidget.type === 'winning_streak' ? `${activeNews.pressureWidget.wins} WINS` : `${activeNews.pressureWidget.unbeaten} UNBEATEN`)}
                  </div>
                </div>
              )}

              {/* Transfer Deal Widget if available */}
              {activeNews.transferWidget && (() => {
                const tw = activeNews.transferWidget;
                const isRej = tw.type === 'rejected' || tw.type === 'collapsed';
                const isRum = tw.type === 'rumor';
                const borderCol = isRej ? 'rgba(255, 51, 81, 0.45)' : (isRum ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 215, 0, 0.35)');
                const accentCol = isRej ? '#ff3351' : (isRum ? '#00e5ff' : '#ffd700');
                const headerText = tw.type === 'signing' ? '✅ COMPLETED SIGNING'
                  : tw.type === 'departure' ? '🤝 SQUAD DEPARTURE'
                  : tw.type === 'rejected' ? '❌ TRANSFER BID REJECTED'
                  : tw.type === 'collapsed' ? '🚧 CONTRACT TALKS COLLAPSED'
                  : tw.type === 'rumor' ? '🕵️ TRANSFER RUMOR & SCOUT REPORT'
                  : '💰 TRANSFER DESK';

                return (
                  <div style={{
                    background: `linear-gradient(135deg, ${ isRej ? 'rgba(255, 51, 81, 0.08)' : (isRum ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 215, 0, 0.08)') }, rgba(0, 0, 0, 0.5))`,
                    border: `1px solid ${borderCol}`,
                    borderRadius: '10px',
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'Orbitron', fontSize: '12px', fontWeight: 'bold', color: accentCol }}>
                          {headerText}
                        </span>
                        {tw.isRival && (
                          <span style={{ fontSize: '9px', background: 'rgba(255, 51, 68, 0.2)', border: '1px solid #ff3344', color: '#ff3344', padding: '1px 6px', borderRadius: '4px', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                            ⚔️ RIVAL CLUB
                          </span>
                        )}
                        {tw.isFirstTeam && (
                          <span style={{ fontSize: '9px', background: 'rgba(0, 229, 255, 0.15)', border: '1px solid #00e5ff', color: '#00e5ff', padding: '1px 6px', borderRadius: '4px', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                            🛡️ FIRST XI STAR
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', color: accentCol, padding: '3px 8px', borderRadius: '4px', fontFamily: 'Orbitron', fontWeight: 'bold' }}>
                        {tw.fee}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '8px', fontSize: '12px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '5px' }}>
                        <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>PLAYER</span>
                        <strong style={{ color: '#fff' }}>{tw.playerName}</strong> ({tw.playerPosition})
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '5px' }}>
                        <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>FROM</span>
                        <strong style={{ color: '#ccc' }}>{tw.fromClub}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '5px' }}>
                        <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>TO / INTERESTED</span>
                        <strong style={{ color: isRej ? '#ff3351' : '#00ff64' }}>{tw.toClub}</strong>
                      </div>
                      {tw.wage && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '5px' }}>
                          <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>WEEKLY WAGE</span>
                          <strong style={{ color: '#00e5ff' }}>{tw.wage}</strong>
                        </div>
                      )}
                      {tw.contractYears && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '5px' }}>
                          <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>CONTRACT</span>
                          <strong style={{ color: '#ffd700' }}>{tw.contractYears} {tw.contractYears === 1 ? 'Year' : 'Years'}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Medical Injured List Widget if available */}
              {activeNews.medicalWidget && activeNews.medicalWidget.length > 0 && (
                <div style={{ background: 'rgba(255, 51, 102, 0.05)', border: '1px solid rgba(255, 51, 102, 0.25)', borderRadius: '8px', padding: '12px' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#ff3366', fontFamily: 'Orbitron' }}>🏥 SIDELINED PLAYERS</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {activeNews.medicalWidget.map((inj, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#fff', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                        <span>👤 {inj.playerName || inj.name || "Squad Member"}</span>
                        <span style={{ color: '#ff3366', fontWeight: 'bold', fontFamily: 'Orbitron', fontSize: '11px' }}>
                          Out for {inj.weeksRemaining} week{inj.weeksRemaining > 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Opponent Preview Stats Widget if available */}
              {activeNews.previewWidget && (
                <div style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '11px', color: '#00e5ff', fontFamily: 'Orbitron', letterSpacing: '1px' }}>
                    🔍 OPPONENT SCOUTING: {activeNews.previewWidget.opponentName}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', fontSize: '12px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: '#888', fontSize: '9px', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>ATTACK</span>
                      <strong style={{
                        color: activeNews.previewWidget.attackLabel === 'Very Strong' ? '#00ff64' : (activeNews.previewWidget.attackLabel === 'Strong' ? '#76ff03' : (activeNews.previewWidget.attackLabel === 'Solid' ? '#ffd700' : '#ff3366')),
                        fontFamily: 'Orbitron', fontSize: '12px'
                      }}>
                        {activeNews.previewWidget.attackLabel || activeNews.previewWidget.attack}
                      </strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: '#888', fontSize: '9px', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>MIDFIELD</span>
                      <strong style={{
                        color: activeNews.previewWidget.midfieldLabel === 'Very Strong' ? '#00ff64' : (activeNews.previewWidget.midfieldLabel === 'Strong' ? '#76ff03' : (activeNews.previewWidget.midfieldLabel === 'Solid' ? '#ffd700' : '#ff3366')),
                        fontFamily: 'Orbitron', fontSize: '12px'
                      }}>
                        {activeNews.previewWidget.midfieldLabel || activeNews.previewWidget.midfield}
                      </strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: '#888', fontSize: '9px', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>DEFENSE</span>
                      <strong style={{
                        color: activeNews.previewWidget.defenseLabel === 'Very Strong' ? '#00ff64' : (activeNews.previewWidget.defenseLabel === 'Strong' ? '#76ff03' : (activeNews.previewWidget.defenseLabel === 'Solid' ? '#ffd700' : '#ff3366')),
                        fontFamily: 'Orbitron', fontSize: '12px'
                      }}>
                        {activeNews.previewWidget.defenseLabel || activeNews.previewWidget.defense}
                      </strong>
                    </div>
                  </div>

                  {/* Key Opponent Players List */}
                  {activeNews.previewWidget.keyPlayers && activeNews.previewWidget.keyPlayers.length > 0 && (
                    <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '10px', color: '#ffd700', fontFamily: 'Orbitron', fontWeight: 'bold', display: 'block', marginBottom: '6px', textAlign: 'left' }}>
                        ⭐ KEY OPPONENT PLAYERS:
                      </span>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {activeNews.previewWidget.keyPlayers.map((kp, idx) => (
                          <div key={idx} style={{
                            background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,215,0,0.25)',
                            borderRadius: '5px', padding: '4px 8px', fontSize: '11px', color: '#fff',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}>
                            <span style={{ fontWeight: 'bold' }}>{kp.name}</span>
                            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '3px', color: '#ffd700' }}>
                              {kp.position}
                            </span>
                            <span style={{ fontSize: '10px', color: '#ffd700', fontWeight: 'bold' }}>
                              {kp.rating > 5 ? `★${kp.rating}` : "⭐".repeat(kp.rating || 3)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* League Roundup Full Results Grid Widget if available */}
              {activeNews.resultsWidget && activeNews.resultsWidget.length > 0 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 145, 0, 0.25)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontFamily: 'Orbitron', color: '#ff9100', fontWeight: 'bold' }}>
                      📋 MATCHDAY {activeNews.round} RESULTS
                    </span>
                    <span style={{ fontSize: '10px', color: '#888' }}>
                      {activeNews.resultsWidget.length} matches played
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
                    {activeNews.resultsWidget.map((res, rIdx) => (
                      <div key={rIdx} style={{
                        background: res.isUserMatch ? 'rgba(0, 255, 100, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: res.isUserMatch ? '1px solid rgba(0, 255, 100, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '5px',
                        padding: '6px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11px'
                      }}>
                        <span style={{
                          fontWeight: res.isUserMatch ? 'bold' : 'normal',
                          color: res.isUserMatch ? '#00ff64' : '#ddd',
                          maxWidth: '85px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {res.homeName}
                        </span>
                        <span style={{
                          fontFamily: 'Orbitron',
                          fontWeight: 'bold',
                          color: '#00e5ff',
                          background: 'rgba(0,0,0,0.4)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>
                          {res.homeScore} - {res.awayScore}
                        </span>
                        <span style={{
                          fontWeight: res.isUserMatch ? 'bold' : 'normal',
                          color: res.isUserMatch ? '#00ff64' : '#ddd',
                          maxWidth: '85px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textAlign: 'right'
                        }}>
                          {res.awayName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Article Body */}
              <div style={{ fontSize: '13px', color: '#ddd', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                {activeNews.body}
              </div>

              {/* Quick Jump Action Button */}
              {activeNews.actionTab && onSelectTab && (
                <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => onSelectTab(activeNews.actionTab)}
                    style={{
                      background: 'linear-gradient(135deg, #0091ff, #00e5ff)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#000',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      fontFamily: 'Orbitron',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)'
                    }}
                  >
                    GO TO {activeNews.actionTab.toUpperCase()} ➔
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Select a news article from the inbox to read.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
