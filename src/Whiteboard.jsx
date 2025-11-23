import { fetch } from "@tauri-apps/plugin-http";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { open, exists, create, BaseDirectory } from "@tauri-apps/plugin-fs";
import React, { useRef, useEffect, useState } from "react";
import { GoogleGenAI } from "@google/genai";
import { Canvg } from "canvg";
import { toast } from "react-hot-toast";

export default function Whiteboard({ roomCode, username, onExit }) {
  const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY,
  });
  const aiModel = "gemini-2.5-flash";
  const aiSystemPrompt = `You are an expert Vector Graphics Engine. Your sole purpose is to interpret natural language commands and generate valid SVG (Scalable Vector Graphics) code\n\n### INPUT DATA\nYou will receive three pieces of information in every user message:\n1. **Command:** The natural language request (e.g., "Draw three small red circles in a row").\n2. **Canvas Dimensions:** The width and height of the viewing area (e.g., { width: 800, height: 600 }).\n3. **Existing Items:** A list of SVG elements currently on the canvas with their IDs and attributes\n\n### COORDINATE SYSTEM RULES\n- The coordinate system starts at (0,0) in the top-left corner.\n- X increases to the right.\n- Y increases downwards.\n- "Center" means (width/2, height/2)\n\n### GENERATION RULES\n1. **Output Format:** You must return a JSON object containing a single key: \`"svgs"\`. The value must be an **array of strings**. Each string in the array represents one distinct SVG element (e.g., \`["<rect ... />", "<circle ... />"]\`).\n2. **Separation:** If a command requires multiple shapes (e.g., "Draw a smiley face"), break the composition down into individual primitives (face, left eye, right eye, mouth) and place them as separate strings in the array.\n3. **IDs:** Generate unique IDs for every new shape (e.g., \`id="shape_timestamp_1"\`).\n4. **Context Awareness:** \n If the user references an existing item, use the coordinates from the **Existing Items** list to calculate position.\n- If the user asks to modify an item, output the *new* version of that tag in the array.\n5. **Defaults:** If no color is specified, use "black". If no size is specified, use reasonable defaults\n\n### EXAMPLE INTERACTIO\n\n**User Input:**\n{\n"command": "Draw a target with a red center and white outer ring",\n"canvas": { "width": 500, "height": 500 },\n"existing_items": []\n\n\n**Your Output:**\n{\n"svgs": [\n"<circle id='outer_ring' cx='250' cy='250' r='50' fill='none' stroke='white' stroke-width='5' />",\n"<circle id='center_dot' cx='250' cy='250' r='20' fill='red' />"\n]\n}`;
  const aiConfig = {
    systemInstruction: aiSystemPrompt,
    thinkingConfig: {
      // thinkingBudget: -1, // Let the model decide
      thinkingBudget: 0,
    },
  };

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [color, setColor] = useState("#000000");
  const [thickness, setThickness] = useState(3);
  const [mode, setMode] = useState("pen");
  const [participants, setParticipants] = useState([]);
  const [hasPillow, setHasPillow] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const FISH_API_KEY = import.meta.env.VITE_FISH_API_KEY;
  const FISH_ASR_URL = "https://api.fish.audio/v1/asr";
  const [transcript, setTranscript] = useState("");
  const [canvasItems, setCanvasItems] = useState([]);

  // rate-limit state
  const pendingLinesRef = useRef([]);
  const lastFlushRef = useRef(0);
  const FLUSH_INTERVAL_MS = 100;

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
        return "";
      }

      const data = await res.json();
      console.log("FishAudio ASR result:", data);
      // Try a few likely shapes; fall back to JSON string
      const possibleText =
        data.text ||
        (data.result && data.result.text) ||
        (Array.isArray(data.results) &&
          data.results[0] &&
          data.results[0].text);

      if (possibleText) {
        setTranscript(possibleText);
        return possibleText;
      } else {
        const stringJson = JSON.stringify(data, null, 2);
        setTranscript(stringJson);
        return stringJson;
      }
    } catch (err) {
      console.error("FishAudio request failed:", err);
      setTranscript(`FishAudio request failed: ${err}`);
      return "";
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

      drawSvgs(canvasItems);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!username) return;

    setParticipants((prev) => {
      if (prev.includes(`${username} (You)`)) return prev;
      return [...prev, `${username} (You)`];
    });
  }, [username]);

  useEffect(() => {
    let unlisten;
    let requestBoardId;

    async function init() {
      try {
        unlisten = await listen("message-received", (event) => {
          const payload = event.payload;
          if (typeof payload !== "string") return;
          let data;
          try {
            data = JSON.parse(payload);
          } catch {
            return;
          }

          if (data.me) {
            const peerName = data.me.username;

            setParticipants((prev) => {
              const label =
                peerName === username ? `${peerName} (You)` : peerName;
              if (prev.includes(label)) return prev;
              return [...prev, label];
            });
          }

          if (data.wholeDraw) {
            clearInterval(requestBoardId);
            const svgs = data.wholeDraw;
            drawSvgs(svgs);
          }

          if (data.draw) {
            const svgs = data.draw;
            drawSvgs(svgs);
          }

          if (data.clear) {
            handleClear();
          }

          if (data.requestPillow) {
            setHasPillow(false);
            toast.success(` ${data.requestPillow} took the talking pillow`, {
              style: { background: "#1f2937", color: "white" },
            });
          }

          if (data.requestBoard) {
            invoke("send_message", {
              message: JSON.stringify({ wholeDraw: canvasItems }),
            });
          }
          if (data.leave) {
            const leaveName = data.leave;
            setParticipants((prev) =>
              prev.filter(
                (label) =>
                  label !== leaveName && label !== `${leaveName} (You)`,
              ),
            );
          }
        });
      } catch (err) {
        console.error("Failed to listen:", err);
      }
    }

    init();
    requestBoardId = setInterval(() => {
      invoke("send_message", {
        message: JSON.stringify({ requestBoard: username }),
      }).catch(console.error);
    }, 1000);

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
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

    // RATE LIMIT
    const lineSvg = `<line x1="${lastPos.x}" y1="${lastPos.y}" x2="${pos.x}" y2="${pos.y}" stroke="${ctx.strokeStyle}" stroke-width="${thickness}"/>`;
    pendingLinesRef.current.push(lineSvg);
    const now = Date.now();
    if (now - lastFlushRef.current >= FLUSH_INTERVAL_MS) {
      const toSend = pendingLinesRef.current;
      pendingLinesRef.current = [];
      lastFlushRef.current = now;
      invoke("send_message", {
        message: JSON.stringify({ draw: toSend }),
      }).catch(console.error);
      setCanvasItems((prev) => [...prev, toSend]);
    }

    setLastPos(pos);
  }

  function stopDrawing() {
    setIsDrawing(false);

    if (pendingLinesRef.current.length > 0) {
      const toSend = pendingLinesRef.current;
      pendingLinesRef.current = [];
      lastFlushRef.current = Date.now();
      invoke("send_message", {
        message: JSON.stringify({ draw: toSend }),
      }).catch(console.error);
    }
  }

  function handleExit() {
    if (username) {
      setParticipants((prev) =>
        prev.filter(
          (label) => label !== username && label !== `${username} (You)`,
        ),
      );
      invoke("send_message", {
        message: JSON.stringify({ leave: username }),
      })
        .then(() => invoke("leave_room", { joinCode: roomCode }))
        .catch(console.error);
    }
    if (typeof onExit === "function") {
      onExit();
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setCanvasItems([]);
  }

  function handleDownload() {
    console.log("Download button clicked");

    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error("Failed to create blob from canvas");
        return;
      }

      const filename = "whiteboard.png";
      exists(filename, { baseDir: BaseDirectory.Download })
        .then((fileExists) => {
          if (fileExists) {
            return open(filename, {
              write: true,
              baseDir: BaseDirectory.Download,
            });
          } else {
            return create(filename, { baseDir: BaseDirectory.Download });
          }
        })
        .then((handle) => blob.bytes().then((bytes) => handle.write(bytes)))
        .then((_) =>
          toast.success(` Saved \"${filename}\" to your downloads folder`, {
            style: { background: "#1f2937", color: "white" },
          }),
        )
        .catch((error) => {
          console.error(error);
          toast.error(` Failed to save image\nError: ${error}`, {
            style: { background: "#1f2937", color: "white" },
          });
        });
    }, "image/png");
  }

  async function startRecording() {
    if (!hasPillow || isRecording) return;

    // Guard for environments (like some Tauri WebViews) where mediaDevices is missing
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error(
        "MediaDevices.getUserMedia is not available in this environment.",
      );
      alert(
        "Microphone is not available in the desktop window. Please open http://localhost:1420 in your browser to use voice notes.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
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
          const transcription = await transcribeWithFishAudio(blob);
          if (transcription.length === 0) return;
          await processTranscription(transcription);
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

  async function processTranscription(text) {
    let promptPayload = JSON.stringify({
      command: text,
      canvas: {
        width: canvasRef.current.width,
        height: canvasRef.current.height,
      },
      existing_items: canvasItems,
    });

    try {
      const response = await ai.models.generateContent({
        model: aiModel,
        contents: promptPayload,
        config: aiConfig,
      });
      let responseString = response.candidates[0].content.parts[0].text;
      const data = JSON.parse(
        responseString.replace("```json", "").replace("```", ""),
      );

      if (data.svgs) {
        drawSvgs(data.svgs);
        invoke("send_message", {
          message: JSON.stringify({ draw: data.svgs }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to parse AI response as JSON:", error);
      // TODO: show toast with error
    }
  }

  function drawSvgs(svgs) {
    setCanvasItems((prev) => {
      const allSvgs = [...prev, ...svgs];
      const concatSvgs =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasRef.current.width}" height="${canvasRef.current.height}" viewBox="0 0 ${canvasRef.current.width} ${canvasRef.current.height}">` +
        allSvgs.join("\n") +
        "</svg>";

      const ctx = canvasRef.current.getContext("2d");
      const v = Canvg.fromString(ctx, concatSvgs);
      v.render();

      return allSvgs;
    });
  }

  return (
    <div className="whiteboard-wrapper">
      <div className="top-row">
        <div
          className="toolbar"
          style={{ display: "flex", gap: "12px", alignItems: "center" }}
        >
          <button
            onClick={() => {
              handleClear();
              invoke("send_message", {
                message: JSON.stringify({ clear: username }),
              }).catch(console.error);
            }}
          >
            Clear
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.9rem" }}>Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                border: "none",
                background: "transparent",
              }}
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
            <button
              onClick={handleDownload}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#ffffff",
                color: "#111827",
                fontSize: "0.85rem",
              }}
            >
              Download
            </button>
            <button
              onClick={handleExit}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #b91c1c",
                background: "#fee2e2",
                color: "#b91c1c",
                fontSize: "0.85rem",
              }}
            >
              Exit
            </button>
          </div>
        </div>
        <div
          className="room-code"
          style={{
            margin: "0 24px",
            fontSize: "1rem",
            fontWeight: "600",
            color: "#f6f6f6ff",
            display: "flex",
            alignItems: "center",
            minWidth: "120px",
            justifyContent: "center",
          }}
        >
          Code:&nbsp;
          <span style={{ letterSpacing: "0.15em" }}>{roomCode || "n/a"}</span>
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
                invoke("send_message", {
                  message: JSON.stringify({ requestPillow: username }),
                }).catch(console.error);
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
