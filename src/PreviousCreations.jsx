export default function (onClose) {
  const creations = ["Pets.png", "BST.png", "UFO.png"];

  return (
    <div style={styles.container}>
      <span style={styles.header}>
        <button onClick={onClose}>Go Back</button>
        <h1 style={styles.title}>Previous Creations</h1>
      </span>

      {creations.map((url) => (
        <img
          src={`/creations/${url}`}
          key={url}
          alt={url.split(".")[0]}
          width="60%"
          height="auto"
        />
      ))}
    </div>
  );
}

const styles = {
  container: {
    width: "100vw",
    height: "100vh",
    background: "#000000",
    display: "flex",
    flexDirection: "column",
    justifyContent: "leading",
    alignItems: "center",
    fontFamily: "Inter, Arial, sans-serif",
    overflowY: "auto",
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

  header: {
    width: "100vw",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
};
