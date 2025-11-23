import { event } from "@tauri-apps/api";
import React, { useRef, useEffect, useState } from "react";

export default function Whiteboard() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
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
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            }

            const formData = new FormData();
            formData.append("audio", blob, "chunk.webm")
            try {
                await fetch("http://localhost:1420/api/talking-pillow/audio", {
                    method: "POST",
                    body: formData,
                });
            } catch (err) {
                console.error("Failed to send audio chunk", err)
            }
            stream.getTracks().forEach((t) => t.stop());
            setIsRecording(false);

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
                <div className="toolbar">
                    <button onClick={handleClear}>Clear</button>
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
                                setHasPillow(true);
                            }}
                        >
                            Request talking pillow 
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
                            {isRecording ? "Stop talking" : "Start talking"}
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


