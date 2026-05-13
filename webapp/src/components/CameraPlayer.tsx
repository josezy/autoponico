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

export default function CameraPlayer({
  cameraId,
  cameraName,
  autoPlay = false,
  className = "",
  onExpand,
  expandIcon = 'maximize',
  ptz = false,
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const CAMERA_BASE_URL = process.env.NEXT_PUBLIC_CAMERA_URL || 'https://cameras.tucanorobotics.co';

  const stopStream = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsPlaying(false);
    setError(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const startStream = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Close existing connection if any
      stopStream();

      // Create new peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pcRef.current = pc;

      // Add transceivers for video and audio
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setIsPlaying(true);
          setIsLoading(false);
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setError('Connection failed. Please try again.');
          setIsLoading(false);
          stopStream();
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to go2rtc
      const response = await fetch(`${CAMERA_BASE_URL}/api/webrtc?src=${cameraId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const answerSdp = await response.text();

      // Set remote description
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('WebRTC connection established for', cameraId);
    } catch (err) {
      console.error('Failed to start stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to camera');
      setIsLoading(false);
      stopStream();
    }
  };

  const CAMERA_PTZ_URL = `${CAMERA_BASE_URL}/ptz`;

  const sendPTZ = useCallback((cmd: string) => {
    fetch(`${CAMERA_PTZ_URL}?cmd=${cmd}&speed=0.5`, { method: 'POST' }).catch(console.error);
  }, [CAMERA_PTZ_URL]);

  const stopPTZ = useCallback(() => {
    sendPTZ('stop');
  }, [sendPTZ]);

  // Digital zoom
  const reclampPan = useCallback((newZoom: number) => {
    const el = videoContainerRef.current;
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

  // Drag-to-pan when zoomed
  const clampPan = useCallback((x: number, y: number, z: number) => {
    const el = videoContainerRef.current;
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
    videoContainerRef.current?.setPointerCapture(e.pointerId);
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
    if (dragRef.current.active) {
      dragRef.current.active = false;
      videoContainerRef.current?.releasePointerCapture(e.pointerId);
    }
  }, []);

  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.95);
    a.download = `${cameraName || cameraId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.jpg`;
    a.click();
  }, [cameraId, cameraName]);

  // Auto-play on mount if enabled
  useEffect(() => {
    if (autoPlay) {
      startStream();
    }

    // Cleanup on unmount
    return () => {
      stopStream();
    };
  }, [cameraId, autoPlay]);

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
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
              {isLoading ? (
                <TbReload className="animate-spin" size={20} />
              ) : (
                <TbPlayerPlay size={20} />
              )}
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="p-2 rounded hover:bg-gray-700 text-white"
              title="Stop"
            >
              <TbPlayerStop size={20} />
            </button>
          )}
          {isPlaying && (
            <button
              onClick={takeSnapshot}
              className="p-2 rounded hover:bg-gray-700 text-white"
              title="Save snapshot"
            >
              <TbCamera size={20} />
            </button>
          )}
          <button
            onClick={() => {
              stopStream();
              setTimeout(startStream, 100);
            }}
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

      {/* Video Container */}
      <div
        ref={videoContainerRef}
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
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          draggable={false}
          className="w-full h-full object-contain"
          style={{
            transform: zoom > 1 ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined,
            willChange: zoom > 1 ? 'transform' : undefined,
          }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white flex flex-col items-center gap-2">
              <TbReload className="animate-spin" size={32} />
              <span>Connecting...</span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <p className="text-red-400 text-center px-4">⚠️ {error}</p>
          </div>
        )}

        {/* Play prompt */}
        {!isPlaying && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <button
              onClick={startStream}
              className="p-4 rounded-full bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <TbPlayerPlay size={48} />
            </button>
          </div>
        )}

        {/* PTZ Controls */}
        {ptz && isPlaying && (
          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200">
            {/* Directional pad - centered */}
            <div className="absolute bottom-4 left-4 grid grid-cols-3 gap-0.5">
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
            {/* Digital zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-0.5 items-center">
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
