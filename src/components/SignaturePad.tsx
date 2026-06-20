"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, Undo2, Upload, X } from "lucide-react";

interface SignaturePadProps {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  width?: number;
  height?: number;
}

export default function SignaturePad({ value, onChange, label = "Signature", width = 400, height = 160 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  }, []);

  useEffect(() => {
    if (!value) {
      const ctx = getCtx();
      if (ctx) ctx.clearRect(0, 0, width, height);
      setHasStrokes(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const ctx = getCtx();
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        setHasStrokes(true);
      }
    };
    img.src = value;
  }, [value, getCtx, width, height]);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function saveSnapshot() {
    const canvas = canvasRef.current;
    if (canvas) setHistory((prev) => [...prev.slice(-19), canvas.toDataURL()]);
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    saveSnapshot();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStrokes(true);
  }

  function endDraw() {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function handleClear() {
    saveSnapshot();
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, width, height);
    setHasStrokes(false);
    onChange("");
  }

  function handleUndo() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (!prev) { handleClear(); return; }
    const img = new Image();
    img.onload = () => {
      const ctx = getCtx();
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        onChange(canvasRef.current?.toDataURL("image/png") || "");
      }
    };
    img.src = prev;
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {value && !hasStrokes ? (
        <div className="relative inline-block">
          <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-3" style={{ width, height: height + 16 }}>
            <img src={value} alt="Signature" className="max-h-full max-w-full object-contain mx-auto" style={{ height }} />
          </div>
          <button type="button" onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="inline-block">
          <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-white relative group"
            style={{ width }}>
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="cursor-crosshair touch-none block w-full"
              style={{ height }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasStrokes && !isDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-sm">Draw signature here</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" onClick={handleUndo} disabled={history.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Undo2 size={12} /> Undo
            </button>
            <button type="button" onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Eraser size={12} /> Clear
            </button>
            <label className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 cursor-pointer transition-colors">
              <Upload size={12} /> Upload
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
