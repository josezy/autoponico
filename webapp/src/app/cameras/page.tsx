"use client"

import React, { useState } from 'react';
import CameraPlayer from '@/components/CameraPlayer';

interface Camera {
  id: string;
  name: string;
  enabled: boolean;
}

// Configure your cameras here
const DEFAULT_CAMERAS: Camera[] = [
  { id: 'camera1', name: 'Greenhouse - North', enabled: true },
  { id: 'camera2', name: 'Greenhouse - South', enabled: true },
  { id: 'camera3', name: 'Greenhouse - Overview', enabled: true },
  // Add more cameras as needed
  // { id: 'camera4', name: 'Greenhouse - East', enabled: false },
  // { id: 'camera5', name: 'Greenhouse - West', enabled: false },
];

export default function CamerasPage() {
  const [cameras] = useState<Camera[]>(DEFAULT_CAMERAS);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  const activeCameras = cameras.filter(cam => cam.enabled);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 dark:text-white">
        Greenhouse Cameras 📹
      </h1>

      {/* Single camera view */}
      {selectedCamera && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold dark:text-white">
              {cameras.find(c => c.id === selectedCamera)?.name}
            </h2>
            <button
              onClick={() => setSelectedCamera(null)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Grid
            </button>
          </div>
          <CameraPlayer
            cameraId={selectedCamera}
            cameraName={cameras.find(c => c.id === selectedCamera)?.name}
            autoPlay={true}
            className="max-w-4xl mx-auto"
          />
        </div>
      )}

      {/* Grid view */}
      {!selectedCamera && (
        <>
          {activeCameras.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No cameras configured. Edit DEFAULT_CAMERAS in the page to add cameras.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCameras.map((camera) => (
                <div
                  key={camera.id}
                  onClick={() => setSelectedCamera(camera.id)}
                  className="cursor-pointer transform transition-transform hover:scale-105"
                >
                  <CameraPlayer
                    cameraId={camera.id}
                    cameraName={camera.name}
                    autoPlay={false}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              📝 Instructions:
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Click on any camera thumbnail to view full-screen</li>
              <li>Click the play button to start streaming</li>
              <li>Streams only consume bandwidth when actively playing</li>
              <li>Use the reload button if a stream becomes unresponsive</li>
            </ul>
          </div>

          {/* Configuration hint */}
          <div className="mt-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              ⚙️ Configuration:
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              To add or modify cameras, edit the <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">DEFAULT_CAMERAS</code> array in:
            </p>
            <code className="block text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded overflow-x-auto">
              webapp/src/app/cameras/page.tsx
            </code>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
              Make sure camera IDs match those configured in go2rtc on your Raspberry Pi.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
