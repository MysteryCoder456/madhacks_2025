import React from "react";

export default function Menu({ onCreateRoom, onJoinRoom, onOpenPreferences }) {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Whiteboard Collab</h1>

      <div style={styles.buttonContainer}>
        <button style={styles.button} onClick={onCreateRoom}>
          Create Room
        </button>

        <button style={styles.button} onClick={onJoinRoom}>
          Join Room
        </button>

        <button style={styles.button} onClick={onOpenPreferences}>
          Preferences
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f0f0",
    fontFamily: "sans-serif",
  },
  title: {
    fontSize: "2.2rem",
    marginBottom: "40px",
    fontWeight: "bold",
  },
  buttonContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "240px",
  },
  button: {
    padding: "12px 20px",
    borderRadius: "8px",
    border: "none",
    fontSize: "1rem",
    cursor: "pointer",
    backgroundColor: "#4A90E2",
    color: "white",
    transition: "0.2s",
  },
};
