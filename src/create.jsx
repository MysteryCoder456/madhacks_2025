import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";

export default function CreateModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const joinCode = await invoke("create_room", {username: name,
      });
      console.log("Room created:", joinCode);
      if (onCreate) { onCreate(joinCode);}
      onClose();
    } catch (error) {
      console.error("Didn't create room", error);
      toast.error(
        ` Could not create room\nError: ${error}`,
        { style: { background: "#1f2937", color: "white" } }
      );
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        {/* Close button */}
        <button
          style={styles.closeButton}
          onClick={onClose}
          aria-label="Close create modal"
        >
          ✖
        </button>

        <h2 style={styles.title}>Create a Room</h2>
        <p style={styles.subtitle}>
          Choose a display name to create a new MindMerge room.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Username field */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Name shown on the whiteboard</label>
            <input
              style={styles.textInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Buttons */}
          <div style={styles.actions}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit" style={styles.primaryButton}>
              Create Room
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

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "20px",
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
