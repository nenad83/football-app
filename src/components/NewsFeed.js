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
      (activeCategory === 'match' && (item.category === 'match' || item.category === 'league')) ||
      (activeCategory === 'medical' && item.category === 'medical') ||
      (activeCategory === 'board' && (item.category === 'board' || item.category === 'transfer')) ||
      (activeCategory === 'preview' && item.category === 'preview');

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
          { id: 'match', label: '⚽ MATCHES & RESULTS' },
          { id: 'medical', label: '🏥 MEDICAL & SQUAD' },
          { id: 'board', label: '💼 BOARD & TRANSFERS' },
          { id: 'preview', label: '🧠 TACTICS & PREVIEWS' }
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
                <div style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '11px', color: '#00e5ff', fontFamily: 'Orbitron' }}>
                    🔍 OPPONENT RATINGS: {activeNews.previewWidget.opponentName}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', fontSize: '12px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px' }}>
                      <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>ATTACK</span>
                      <strong style={{ color: '#ff4500', fontFamily: 'Orbitron' }}>{activeNews.previewWidget.attack}</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px' }}>
                      <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>MIDFIELD</span>
                      <strong style={{ color: '#00e5ff', fontFamily: 'Orbitron' }}>{activeNews.previewWidget.midfield}</strong>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px' }}>
                      <span style={{ color: '#888', fontSize: '9px', display: 'block' }}>DEFENSE</span>
                      <strong style={{ color: '#00ff64', fontFamily: 'Orbitron' }}>{activeNews.previewWidget.defense}</strong>
                    </div>
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
