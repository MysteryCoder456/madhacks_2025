import React, { useEffect, useState } from "react";

export default function Menu({ onCreateRoom, onJoinRoom, onOpenPreferences }) {
  const fullTitle = "MindMerge";
  const [displayedTitle, setDisplayedTitle] = useState("");
  const [hovered, setHovered] = useState(null); 

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedTitle(fullTitle.slice(0, i + 1));
      i++;
      if (i === fullTitle.length) clearInterval(interval);
    }, 90);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>{displayedTitle}</h1>

      <div style={styles.buttons}>
        
        <button
          style={{
            ...styles.button,
            ...(hovered === "create" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHovered("create")}
          onMouseLeave={() => setHovered(null)}
          onClick={onCreateRoom}
        >
          Create Room
        </button>

        <button
          style={{
            ...styles.button,
            ...(hovered === "join" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHovered("join")}
          onMouseLeave={() => setHovered(null)}
          onClick={onJoinRoom}
        >
          Join Room
        </button>

        <button
          style={{
            ...styles.button,
            ...(hovered === "prefs" ? styles.buttonHover : {}),
          }}
          onMouseEnter={() => setHovered("prefs")}
          onMouseLeave={() => setHovered(null)}
          onClick={onOpenPreferences}
        >
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
    background: "#000000",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Inter, Arial, sans-serif",
  },

  title: {
    fontSize: "4rem",
    fontWeight: "800",
    color: "white",
    marginBottom: "80px",
    letterSpacing: "0.2rem",
    textTransform: "uppercase",
  },

  buttons: {
    display: "flex",
    flexDirection: "column",
    gap: "30px",
    width: "min(500px, 90vw)",
  },

  button: {
    width: "100%",
    padding: "24px 20px",
    borderRadius: "16px",
    border: "none",
    fontSize: "1.5rem",
    fontWeight: "700",
    cursor: "pointer",
    backgroundColor: "#1A3BAA",
    color: "white",
    transition: "opacity 0.25s ease, transform 0.2s ease",
    boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
  },

  buttonHover: {
    opacity: 0.75,
    transform: "scale(1.02)",
  },
};
