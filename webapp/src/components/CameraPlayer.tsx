"use client"

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TbReload, TbPlayerPlay, TbPlayerStop, TbMaximize, TbMinimize, TbCamera,
         TbArrowUp, TbArrowDown, TbArrowLeft, TbArrowRight, TbZoomIn, TbZoomOut } from 'react-icons/tb';

interface CameraPlayerProps {
  cameraId: string;
  cameraName?: string;
  autoPlay?: boolean;
  className?: string;
  onExpand?: () => void;
  expandIcon?: 'maximize' | 'minimize';
  ptz?: boolean;
}

const CAMERA_ORIGIN = process.env.NEXT_PUBLIC_CAMERA_URL || 'https://cameras.tucanorobotics.co';
const LOAD_TIMEOUT_MS = 15000;

function getProxyBaseUrl() {
  if (typeof window === 'undefined') return CAMERA_ORIGIN;
  return `${window.location.origin}/api/camera-proxy`;
}

function buildStreamUrl(cameraId: string) {
  const params = new URLSearchParams({
    src: cameraId,
    mode: 'mse,hls,mjpeg',
    background: 'true',
  });
  return `${CAMERA_ORIGIN}/stream.html?${params.toString()}`;
}

export default function CameraPlayer({
  cameraId,
  cameraName,
  autoPlay = false,
  className = "",
  onExpand,
  expandIcon = 'maximize',
  ptz = false,
}: CameraPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const loadTimeoutRef = useRef<number | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isSnapshotting, setIsSnapshotting] = useState(false);

  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current !== null) {
      window.clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  const stopStream = useCallback((resetUi = true) => {
    clearLoadTimeout();
    setStreamUrl(null);
    setIsPlaying(false);
    setIsLoading(false);
    if (resetUi) {
      setError(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [clearLoadTimeout]);

  const startStream = useCallback(() => {
    clearLoadTimeout();
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);
    setStreamUrl(buildStreamUrl(cameraId));

    loadTimeoutRef.current = window.setTimeout(() => {
      setIsLoading(false);
      setError('Failed to load camera stream.');
      setStreamUrl(null);
    }, LOAD_TIMEOUT_MS);
  }, [cameraId, clearLoadTimeout]);

  const handleStreamLoad = useCallback(() => {
    clearLoadTimeout();
    setIsLoading(false);
    setIsPlaying(true);
    setError(null);
  }, [clearLoadTimeout]);

  const proxyBaseUrl = getProxyBaseUrl();

  const sendPTZ = useCallback((cmd: string) => {
    const params = new URLSearchParams({
      src: cameraId,
      cmd,
      speed: '0.5',
    });
    fetch(`${proxyBaseUrl}/ptz?${params.toString()}`, { method: 'POST' }).catch(console.error);
  }, [proxyBaseUrl, cameraId]);

  const stopPTZ = useCallback(() => sendPTZ('stop'), [sendPTZ]);

  const reclampPan = useCallback((newZoom: number) => {
    const el = containerRef.current;
    if (!el || newZoom <= 1) { setPan({ x: 0, y: 0 }); return; }
    const maxX = ((newZoom - 1) / 2) * el.clientWidth;
    const maxY = ((newZoom - 1) / 2) * el.clientHeight;
    setPan(p => ({
      x: Math.max(-maxX, Math.min(maxX, p.x)),
      y: Math.max(-maxY, Math.min(maxY, p.y)),
    }));
  }, []);

  const digitalZoomIn = useCallback(() => {
    setZoom(z => {
      const next = Math.min(z + 0.5, 4);
      reclampPan(next);
      return next;
    });
  }, [reclampPan]);

  const digitalZoomOut = useCallback(() => {
    setZoom(z => {
      const next = Math.max(z - 0.5, 1);
      reclampPan(next);
      return next;
    });
  }, [reclampPan]);

  const clampPan = useCallback((x: number, y: number, z: number) => {
    const el = containerRef.current;
    if (!el || z <= 1) return { x: 0, y: 0 };
    const maxX = ((z - 1) / 2) * el.clientWidth;
    const maxY = ((z - 1) / 2) * el.clientHeight;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    if (zoom <= 1) return;
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    containerRef.current?.setPointerCapture(e.pointerId);
  }, [zoom]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setPan(p => clampPan(p.x + dx, p.y + dy, zoom));
  }, [zoom, clampPan]);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    containerRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  const takeSnapshot = useCallback(async () => {
    setIsSnapshotting(true);
    try {
      const res = await fetch(
        `${proxyBaseUrl}/api/frame.jpeg?src=${encodeURIComponent(cameraId)}&t=${Date.now()}`
      );
      if (!res.ok) throw new Error(`Snapshot failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cameraName || cameraId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to save snapshot:', err);
    } finally {
      setIsSnapshotting(false);
    }
  }, [proxyBaseUrl, cameraId, cameraName]);

  useEffect(() => {
    if (autoPlay) startStream();
    return () => stopStream(false);
  }, [cameraId, autoPlay, startStream, stopStream]);

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <h3 className="text-white font-medium">
          {cameraName || `Camera ${cameraId}`}
        </h3>
        <div className="flex gap-2">
          {!isPlaying ? (
            <button
              onClick={startStream}
              disabled={isLoading}
              className="p-2 rounded hover:bg-gray-700 text-white disabled:opacity-50"
              title="Play"
            >
              {isLoading ? <TbReload className="animate-spin" size={20} /> : <TbPlayerPlay size={20} />}
            </button>
          ) : (
            <button onClick={() => stopStream()} className="p-2 rounded hover:bg-gray-700 text-white" title="Stop">
              <TbPlayerStop size={20} />
            </button>
          )}
          {isPlaying && (
            <button
              onClick={takeSnapshot}
              disabled={isSnapshotting}
              className="p-2 rounded hover:bg-gray-700 text-white disabled:opacity-50"
              title="Save snapshot"
            >
              {isSnapshotting ? <TbReload className="animate-spin" size={20} /> : <TbCamera size={20} />}
            </button>
          )}
          <button
            onClick={() => { stopStream(); setTimeout(startStream, 100); }}
            disabled={isLoading}
            className="p-2 rounded hover:bg-gray-700 text-white disabled:opacity-50"
            title="Reload"
          >
            <TbReload size={20} />
          </button>
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-2 rounded hover:bg-gray-700 text-white"
              title={expandIcon === 'maximize' ? 'Full screen' : 'Minimize'}
            >
              {expandIcon === 'maximize' ? <TbMaximize size={20} /> : <TbMinimize size={20} />}
            </button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative bg-black overflow-hidden"
        style={{
          aspectRatio: '16/9',
          touchAction: zoom > 1 ? 'none' : 'auto',
          cursor: zoom > 1 ? 'grab' : undefined,
        }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        {streamUrl && (
          <iframe
            src={streamUrl}
            title={cameraName || cameraId}
            allow="autoplay; fullscreen"
            // Block hover/click into go2rtc so its native controls never show or pause the stream.
            // Parent handles pan/zoom; PTZ buttons sit above with pointer-events-auto.
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            style={{
              transform: zoom > 1 ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined,
              transformOrigin: 'center center',
              willChange: zoom > 1 ? 'transform' : undefined,
            }}
            onLoad={handleStreamLoad}
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white flex flex-col items-center gap-2">
              <TbReload className="animate-spin" size={32} />
              <span>Connecting...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <p className="text-red-400 text-center px-4">⚠️ {error}</p>
          </div>
        )}

        {!isPlaying && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <button
              onClick={startStream}
              className="p-4 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <TbPlayerPlay size={48} />
            </button>
          </div>
        )}

        {ptz && isPlaying && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-0.5 z-10 pointer-events-auto">
              <div />
              <PTZButton cmd="up" onStart={sendPTZ} onStop={stopPTZ}><TbArrowUp size={20} /></PTZButton>
              <div />
              <PTZButton cmd="left" onStart={sendPTZ} onStop={stopPTZ}><TbArrowLeft size={20} /></PTZButton>
              <div />
              <PTZButton cmd="right" onStart={sendPTZ} onStop={stopPTZ}><TbArrowRight size={20} /></PTZButton>
              <div />
              <PTZButton cmd="down" onStart={sendPTZ} onStop={stopPTZ}><TbArrowDown size={20} /></PTZButton>
              <div />
            </div>
            <div className="absolute bottom-4 right-4 flex flex-col gap-0.5 items-center z-10 pointer-events-auto">
              {zoom > 1 && (
                <span className="text-white text-xs bg-black/50 rounded px-1.5 py-0.5 mb-0.5">{zoom}x</span>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={digitalZoomIn}
                className="w-10 h-10 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 active:bg-teal-600 transition-colors select-none"
              >
                <TbZoomIn size={20} />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={digitalZoomOut}
                disabled={zoom <= 1}
                className="w-10 h-10 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 active:bg-teal-600 transition-colors select-none disabled:opacity-30"
              >
                <TbZoomOut size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PTZButton({ cmd, onStart, onStop, children }: {
  cmd: string;
  onStart: (cmd: string) => void;
  onStop: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onStart(cmd); }}
      onPointerUp={(e) => { e.stopPropagation(); onStop(); }}
      onPointerLeave={onStop}
      className="w-10 h-10 flex items-center justify-center rounded bg-black/50 text-white hover:bg-black/70 active:bg-teal-600 transition-colors select-none touch-none"
    >
      {children}
    </button>
  );
}
