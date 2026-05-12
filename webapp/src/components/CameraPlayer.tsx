"use client"

import React, { useEffect, useRef, useState } from 'react';
import { TbReload, TbPlayerPlay, TbPlayerStop, TbMaximize, TbMinimize } from 'react-icons/tb';

interface CameraPlayerProps {
  cameraId: string;
  cameraName?: string;
  autoPlay?: boolean;
  className?: string;
  onExpand?: () => void;
  expandIcon?: 'maximize' | 'minimize';
}

export default function CameraPlayer({
  cameraId,
  cameraName,
  autoPlay = false,
  className = "",
  onExpand,
  expandIcon = 'maximize'
}: CameraPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
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
      </div>
    </div>
  );
}
