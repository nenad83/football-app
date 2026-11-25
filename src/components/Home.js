import {NavLink} from "react-router-dom";
import '../App.css';
import React from 'react';


function Home(props) {
  return (
    <>
    <div className="App">
      
      
      <header className="App-header">
        <NavLink className='startgame' to="/zone12-demo" style={{ borderColor: '#00a2a2', background: 'linear-gradient(180deg, #10344c 0%, #082333 100%)', color: '#ffdd44', boxShadow: '0 4px 12px rgba(0, 162, 162, 0.4)' }}>🧪 12-BOX ENGINE TEST (DEMO)</NavLink>
        <NavLink className='startgame' to="/league">LEAGUE</NavLink>
        <NavLink className='startgame' to="/tournament">INTERNATIONAL CUPS</NavLink>
      </header>


    </div>

    </>
  );
}

export default Home;