import React, { useRef, useEffect, useState } from "react";

export default function Whiteboard(){
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });


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

    function getMousePos(e){
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return {x: e.clientX - rect.left, y: e.clientY - rect.top};
    }

    function handleMouseDown(e){
        setIsDrawing(true);
        setLastPos(getMousePos(e));
    }
    function handleMouseMove(e){
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
        
    function stopDrawing(){
        setIsDrawing(false);
    }

    function handleClear(){
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
    }

    return(
        <div className = "whiteboard-wrapper">
            <div className = "toolbar">
                <button onClick = {handleClear}>Clear</button>
            </div>
            <div className = "canvas" ref = {containerRef}>
                <canvas
                ref = {canvasRef}
                className = "whiteboard-canvas"
                onMouseDown = {handleMouseDown}
                onMouseMove = {handleMouseMove}
                onMouseUp = {stopDrawing}
                onMouseLeave = {stopDrawing}>
                </canvas>
            </div>
        </div>
    );
}


