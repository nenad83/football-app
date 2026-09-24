import { NavLink } from "react-router-dom";
import '../assets/styles/Friendly.css';
import React from 'react';

function Friendly(props) {
  return (
    <div className="friendly-lobby-container">
      <div className="lobby-header">
        <h1 className="glowing-header-text">CHOOSE CHAMPIONSHIP</h1>
        <p className="lobby-subtitle">SELECT A HISTORIC CUP FOR A FRIENDLY SIMULATION MATCH</p>
      </div>

      <div className="championship-grid">
        
        {/* World Cups */}
        <div className="championship-card-deck">
          <div className="deck-tag gold-tag">WORLD CUPS</div>
          <div className="cup-links-box">
            <NavLink className="cup-item" to="/mex86">
              <span className="cup-flag">🇲🇽</span>
              <span className="cup-name">Mexico 1986</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/ita90">
              <span className="cup-flag">🇮🇹</span>
              <span className="cup-name">Italy 1990</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/usa94">
              <span className="cup-flag">🇺🇸</span>
              <span className="cup-name">USA 1994</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/korjap02">
              <span className="cup-flag">🇰🇷🇯🇵</span>
              <span className="cup-name">Korea/Japan 2002</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/ger06">
              <span className="cup-flag">🇩🇪</span>
              <span className="cup-name">Germany 2006</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/rsa10">
              <span className="cup-flag">🇿🇦</span>
              <span className="cup-name">South Africa 2010</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/bra14">
              <span className="cup-flag">🇧🇷</span>
              <span className="cup-name">Brazil 2014</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/rus18">
              <span className="cup-flag">🇷🇺</span>
              <span className="cup-name">Russia 2018</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/qat22">
              <span className="cup-flag">🇶🇦</span>
              <span className="cup-name">Qatar 2022</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/world26">
              <span className="cup-flag">🇨🇦🇲🇽🇺🇸</span>
              <span className="cup-name">World Cup 2026</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
          </div>
        </div>

        {/* Euro Cups */}
        <div className="championship-card-deck">
          <div className="deck-tag blue-tag">EURO CUPS</div>
          <div className="cup-links-box">
            <NavLink className="cup-item" to="/fra84">
              <span className="cup-flag">🇫🇷</span>
              <span className="cup-name">France 1984</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/ger88">
              <span className="cup-flag">🇩🇪</span>
              <span className="cup-name">Germany 1988</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/swe92">
              <span className="cup-flag">🇸🇪</span>
              <span className="cup-name">Sweden 1992</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/eng96">
              <span className="cup-flag">🏴󠁧󠁢󠁥󠁮󠁧󠁿</span>
              <span className="cup-name">England 1996</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/nld00">
              <span className="cup-flag">🇧🇪🇳🇱</span>
              <span className="cup-name">Belgium & Netherlands 2000</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/por04">
              <span className="cup-flag">🇵🇹</span>
              <span className="cup-name">Portugal 2004</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/aut08">
              <span className="cup-flag">🇦🇹🇨🇭</span>
              <span className="cup-name">Austria & Switzerland 2008</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/polukr12">
              <span className="cup-flag">🇵🇱🇺🇦</span>
              <span className="cup-name">Poland & Ukraine 2012</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/fra16">
              <span className="cup-flag">🇫🇷</span>
              <span className="cup-name">France 2016</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/eur20">
              <span className="cup-flag">🇪🇺</span>
              <span className="cup-name">Europe 2020</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/eur24">
              <span className="cup-flag">🇩🇪</span>
              <span className="cup-name">Germany 2024</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
          </div>
        </div>

        {/* Copa America */}
        <div className="championship-card-deck single-cup-deck">
          <div className="deck-tag green-tag">COPA AMERICA</div>
          <div className="cup-links-box">
            <NavLink className="cup-item" to="/ecu93">
              <span className="cup-flag">🇪🇨</span>
              <span className="cup-name">Ecuador 1993</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/bol97">
              <span className="cup-flag">🇧🇴</span>
              <span className="cup-name">Bolivia 1997</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/par99">
              <span className="cup-flag">🇵🇾</span>
              <span className="cup-name">Paraguay 1999</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/col01">
              <span className="cup-flag">🇨🇴</span>
              <span className="cup-name">Colombia 2001</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/per04">
              <span className="cup-flag">🇵🇪</span>
              <span className="cup-name">Peru 2004</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/ven07">
              <span className="cup-flag">🇻🇪</span>
              <span className="cup-name">Venezuela 2007</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/arg11">
              <span className="cup-flag">🇦🇷</span>
              <span className="cup-name">Argentina 2011</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/chl15">
              <span className="cup-flag">🇨🇱</span>
              <span className="cup-name">Chile 2015</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/usa16">
              <span className="cup-flag">🇺🇸</span>
              <span className="cup-name">USA 2016</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/bra19">
              <span className="cup-flag">🇧🇷</span>
              <span className="cup-name">Brazil 2019</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/bra21">
              <span className="cup-flag">🇧🇷</span>
              <span className="cup-name">Brazil 2021</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/chi91">
              <span className="cup-flag">🇨🇱</span>
              <span className="cup-name">Chile 1991</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/bra89">
              <span className="cup-flag">🇧🇷</span>
              <span className="cup-name">Brazil 1989</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
            <NavLink className="cup-item" to="/cop24">
              <span className="cup-flag">🇺🇸</span>
              <span className="cup-name">USA 2024</span>
              <span className="cup-arrow">➔</span>
            </NavLink>
          </div>
        </div>

      </div>

      <div className="lobby-actions">
        <NavLink className="back-home-btn" to="/">RETURN TO MAIN CABINET</NavLink>
      </div>
    </div>
  );
}

export default Friendly;