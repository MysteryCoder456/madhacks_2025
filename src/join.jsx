import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";

export default function JoinModal({ open, onClose, onJoin }) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");

  if (!open) return null; 

  const handleDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(0, 1); 
  
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (digit && index < 5) {
      const nextInput = document.getElementById(`digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };
  
  const handleDigitKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
  
      setCode((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
  
      if (index > 0) {
        const prevInput = document.getElementById(`digit-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
          const len = prevInput.value.length;
          prevInput.setSelectionRange(len, len);
        }
      }
    }
  };
  

  const handleSubmit = async (e) => {
      e.preventDefault();
      const joinCode = code.join(""); 
      console.log("Join room with:", { joinCode, name });
      try {
        await invoke("join_room", {
            username: name,
            joinCode: joinCode,
        });
        if(onJoin) onJoin(joinCode, name)
        onClose();
      } catch (error) {
        console.error("Didn't join room", error);
        toast.error(
            `Failed to join room\nError: ${error}`,
            { style: { background: "#1f2937", color: "white" } }
        );
      }
    };
  

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()} 
      >
        <button
          style={styles.closeButton}
          onClick={onClose}
          aria-label="Close join modal"
        >
        </button>

        <h2 style={styles.title}>Join by Code</h2>
        <p style={styles.subtitle}>
          Enter the 6-digit code to join a MindMerge room.
        </p>

        <form onSubmit={handleSubmit}>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Name shown on the whiteboard</label>
            <input
              style={styles.textInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <h3 style={styles.codeHeading}>Join room by code</h3>

          <div style={styles.codeContainer}>
            {code.map((digit, index) => (
              <div key={index} style={styles.digitBox}>
                <input
                  id={`digit-${index}`}
                  style={styles.digitInput}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleDigitKeyDown(index, e)}
                  maxLength={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
                <div style={styles.dash} />
              </div>
            ))}
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" style={styles.primaryButton}>
              Join Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    position: "relative",
    background: "#050816",
    borderRadius: "24px",
    border: "1px solid #111827",
    padding: "32px 40px 30px",
    width: "min(680px, 95vw)", 
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.8)",
    color: "#E5E7EB",
  },

  closeButton: {
    position: "absolute",
    top: "14px",
    right: "20px",
    border: "none",
    background: "transparent",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: "1.2rem",
  },

  title: {
    fontSize: "2rem",
    fontWeight: "700",
    marginBottom: "8px",
    color: "#F9FAFB",
  },

  subtitle: {
    fontSize: "0.98rem",
    color: "#9CA3AF",
    marginBottom: "24px",
  },

  fieldGroup: {
    marginBottom: "22px",
  },

  label: {
    display: "block",
    fontSize: "0.9rem",
    marginBottom: "6px",
    color: "#9CA3AF",
  },

  textInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid #1F2937",
    backgroundColor: "#020617",
    color: "#F9FAFB",
    fontSize: "0.98rem",
    outline: "none",
  },

  codeHeading: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#D1D5DB",
    marginBottom: "14px",
    marginTop: "4px",
  },

  codeContainer: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "28px",
    padding: "8px 4px",
  },

  digitBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: 1,
  },

  digitInput: {
    width: "42px",
    height: "42px",
    textAlign: "center",
    fontSize: "1.6rem",
    fontWeight: "600",
    background: "transparent",
    color: "#F9FAFB",
    border: "none",
    outline: "none",
  },

  dash: {
    marginTop: "6px",
    width: "28px",
    height: "2px",
    backgroundColor: "#4B5563",
    borderRadius: "999px",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "8px",
  },

  secondaryButton: {
    padding: "10px 18px",
    borderRadius: "999px",
    border: "1px solid #4B5563",
    background: "transparent",
    color: "#D1D5DB",
    cursor: "pointer",
    fontSize: "0.95rem",
  },

  primaryButton: {
    padding: "10px 22px",
    borderRadius: "999px",
    border: "none",
    background:
      "linear-gradient(135deg, #2563EB 0%, #6366F1 45%, #EC4899 100%)",
    color: "white",
    cursor: "pointer",
    fontSize: "0.95rem",
    fontWeight: "600",
  },
};
