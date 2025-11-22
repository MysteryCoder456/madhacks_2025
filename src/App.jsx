import React from "react";
import "./App.css";
import Whiteboard from "./Whiteboard";

function App(){
  return(
    <div className = "app">
      <header className = "app-header">
        <h1>Whiteboard</h1>
        <p>
          Speech-controlled collaborative whiteboard
        </p>
      </header>
      <main className="app-main">
        <Whiteboard />
      </main>
    </div>
  );
}

export default App;