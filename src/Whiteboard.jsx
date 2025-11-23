import { event } from "@tauri-apps/api";
import { fetch } from "@tauri-apps/plugin-http";
import React, { useRef, useEffect, useState } from "react";

export default function Whiteboard() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
    const [color, setColor] = useState("#000000");
    const [thickness, setThickness] = useState(3);
    const [mode, setMode] = useState("pen");
    const participants = ["Shivvy Dunne (You)", "Rehat", "Namboo"]
    const [hasPillow, setHasPillow] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const FISH_API_KEY = import.meta.env.VITE_FISH_API_KEY;
    const FISH_ASR_URL = "https://api.fish.audio/v1/asr";
    const [transcript, setTranscript] = useState("");

    async function transcribeWithFishAudio(blob) {
      if (!FISH_API_KEY) {
        console.error("No FishAudio API key set in VITE_FISH_API_KEY");
        return;
      }

      const formData = new FormData();
      formData.append("audio", blob, "chunk.webm");
      formData.append("language", "en");
      formData.append("ignore_timestamps", "true");

      try {
        const res = await fetch(FISH_ASR_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FISH_API_KEY}`,
          },
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          console.error("FishAudio ASR error:", res.status, text);
          setTranscript(`FishAudio error ${res.status}: ${text}`);
          return;
        }

        const data = await res.json();
        console.log("FishAudio ASR result:", data);
        // Try a few likely shapes; fall back to JSON string
        const possibleText =
          data.text ||
          (data.result && data.result.text) ||
          (Array.isArray(data.results) && data.results[0] && data.results[0].text);

        if (possibleText) {
          setTranscript(possibleText);
        } else {
          setTranscript(JSON.stringify(data, null, 2));
        }
      } catch (err) {
        console.error("FishAudio request failed:", err);
      }
    }


    useEffect(() => {
        function resize() {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

            canvas.width = rect.width;
            canvas.height = rect.height;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#000000";
        }

        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    function getMousePos(e) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleMouseDown(e) {
        setIsDrawing(true);
        setLastPos(getMousePos(e));
    }
    function handleMouseMove(e) {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const pos = getMousePos(e);
        
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = thickness;

        if (mode === "eraser") {
          ctx.globalCompositeOperation = "destination-out";
          ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
          ctx.globalCompositeOperation = "source-over";
          ctx.strokeStyle = color;
        }
        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        setLastPos(pos);
    }

    function stopDrawing() {
        setIsDrawing(false);
    }

    function handleClear() {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
    }

    async function startRecording() {
      if (!hasPillow || isRecording) return;

      // Guard for environments (like some Tauri WebViews) where mediaDevices is missing
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("MediaDevices.getUserMedia is not available in this environment.");
        alert(
          "Microphone is not available in the desktop window. Please open http://localhost:1420 in your browser to use voice notes."
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          try {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            await transcribeWithFishAudio(blob);
          } finally {
            stream.getTracks().forEach((t) => t.stop());
            setIsRecording(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Recording failed", err);
      }
    }

    function stopRecording() {
        if (!mediaRecorderRef.current) return;
        mediaRecorderRef.current.stop();
    }

    return (
      <div className="whiteboard-wrapper">
        <div className="top-row">
          <div className="toolbar" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button onClick={handleClear}>Clear</button>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.9rem" }}>Color</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: 28, height: 28, padding: 0, border: "none", background: "transparent" }}
              />
            </div>
  
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.9rem" }}>Size</span>
              <input
                type="range"
                min={1}
                max={20}
                value={thickness}
                onChange={(e) => setThickness(parseInt(e.target.value, 10))}
              />
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => setMode("pen")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: mode === "pen" ? "#111827" : "#ffffff",
                  color: mode === "pen" ? "#ffffff" : "#111827",
                  fontSize: "0.85rem",
                }}
              >
                Pen
              </button>
              <button
                onClick={() => setMode("eraser")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  background: mode === "eraser" ? "#111827" : "#ffffff",
                  color: mode === "eraser" ? "#ffffff" : "#111827",
                  fontSize: "0.85rem",
                }}
              >
                Erase
              </button>
            </div>
          </div>
            <div className="participants">
              <span className="participants-label">In room</span>
              {participants.map((name) => (
                <div key={name} className="participant-pill">
                  {name}
                </div>
              ))}
              {!hasPillow ? (
                <button
                  className="pillow-button"
                  onClick={() => {
                    // later backend will enforce only one pillow per room
                    setHasPillow(true);
                  }}
                >
                  Request talking pillow 🎤
                </button>
              ) : (
                <button
                  className={`pillow-button ${isRecording ? "recording" : ""}`}
                  onClick={() => {
                    if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                >
                  {isRecording ? "Stop talking ⏹" : "Start talking 🎙"}
                </button>
              )}
            </div>
          </div>   
      
          <div
            className="canvas-container"
            ref={containerRef}
            style={{ position: "relative" }}
          >
            <canvas
              ref={canvasRef}
              className="whiteboard-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
            {transcript && (
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  maxWidth: "40%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                  fontSize: "0.8rem",
                  color: "#111827",
                  pointerEvents: "none",
                  whiteSpace: "pre-wrap",
                }}
              >
                {transcript}
              </div>
            )}
          </div>
        </div>
    );
}


