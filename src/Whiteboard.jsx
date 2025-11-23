import { event } from "@tauri-apps/api";
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
            const formData = new FormData();
            formData.append("audio", blob, "chunk.webm");

            await fetch("http://localhost:1420/api/talking-pillow/audio", {
              method: "POST",
              body: formData,
            });
          } catch (err) {
            console.error("Failed to send audio chunk", err);
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
      
          <div className="canvas-container" ref={containerRef}>
            <canvas
              ref={canvasRef}
              className="whiteboard-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>
        </div>
    );
}


