import {NavLink} from "react-router-dom";
import '../App.css';
import React from 'react';


function Home(props) {
  return (
    <>
    <div className="App">
      
      
      <header className="App-header">
        <NavLink className='startgame' to="/league">LEAGUE</NavLink>
        <NavLink className='startgame' to="/tournament">INTERNATIONAL CUPS</NavLink>
      </header>


    </div>

    </>
  );
}

export default Home;