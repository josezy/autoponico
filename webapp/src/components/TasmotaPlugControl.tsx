"use client";

import React, { useEffect, useState } from "react";
import { ImSpinner9 } from "react-icons/im";
import { TbPower } from "react-icons/tb";
import { toast } from "react-toastify";

import { useWebSocket } from "@/hooks/useWebsocket";
import ToggleSwitch from './ToggleSwitch';

type DeviceKey = 'fresas' | 'valvula-tanque' | 'luz-cannabis' | 'main-pump';

interface DeviceState {
  key: DeviceKey;
  name: string;
  status: boolean | null;
  loading: boolean;
  connected: boolean;
}

const COMMAND_TIMEOUT_MS = 2500;

const devices: Array<{ key: DeviceKey; name: string }> = [
  { key: 'fresas', name: 'Fresas' },
  { key: 'valvula-tanque', name: 'Válvula Tanque' },
  { key: 'luz-cannabis', name: 'Luz Cannabis' },
  { key: 'main-pump', name: 'Main Pump' }
];

const TasmotaPlugControl = () => {
  const { connected: wsConnected, send, wsData } = useWebSocket();
  const [deviceStates, setDeviceStates] = useState<Record<DeviceKey, DeviceState>>(() => {
    const initialStates: Record<DeviceKey, DeviceState> = {} as Record<DeviceKey, DeviceState>;
    devices.forEach(device => {
      initialStates[device.key] = {
        key: device.key,
        name: device.name,
        status: null,
        loading: false,
        connected: false
      };
    });
    return initialStates;
  });

  useEffect(() => {
    if (wsConnected) {
      send(JSON.stringify({ type: 'device-sync-request' }));
    }
  }, [send, wsConnected]);

  useEffect(() => {
    setDeviceStates(prev => {
      const nextStates = { ...prev };

      devices.forEach((device) => {
        const wsDeviceState = wsData.devices[device.key];
        if (!wsDeviceState) {
          nextStates[device.key] = {
            ...nextStates[device.key],
            connected: false,
          };
          return;
        }

        nextStates[device.key] = {
          ...nextStates[device.key],
          status: wsDeviceState.power === 'UNKNOWN' ? null : wsDeviceState.power === 'ON',
          connected: wsDeviceState.connected,
          loading: false,
        };
      });

      return nextStates;
    });
  }, [wsData.devices]);

  const handleDeviceCommand = (deviceKey: DeviceKey, action: "on" | "off") => {
    if (!wsConnected) {
      toast.error('WebSocket bridge is disconnected.');
      return;
    }

    setDeviceStates(prev => ({
      ...prev,
      [deviceKey]: { ...prev[deviceKey], loading: true }
    }));

    send(JSON.stringify({
      type: 'device-command',
      deviceKey,
      action,
    }));

    window.setTimeout(() => {
      setDeviceStates(prev => ({
        ...prev,
        [deviceKey]: { ...prev[deviceKey], loading: false }
      }));
    }, COMMAND_TIMEOUT_MS);
  };

  const DeviceControl = ({ deviceKey }: { deviceKey: DeviceKey }) => {
    const device = deviceStates[deviceKey];

    return (
      <div className="bg-gray-50 rounded-lg p-4 border">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg">{device.name}</h3>
          <div className="flex items-center gap-3">
            {device.loading && (
              <ImSpinner9 className="animate-spin text-lg text-gray-500" />
            )}
            <ToggleSwitch
              checked={device.status || false}
              onChange={(e) => handleDeviceCommand(deviceKey, e.target.checked ? "on" : "off")}
              disabled={device.loading || !wsConnected || !device.connected}
            />
            <div
              className={`h-3 w-3 rounded-full ${device.connected ? "bg-green-500" : "bg-red-500"}`}
              title={device.connected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TbPower
            className={`text-2xl ${device.status ? 'text-green-600' : 'text-gray-400'}`}
          />
          <span className="text-sm font-medium">
            {device.loading
              ? "Loading..."
              : device.status === null
                ? "Unknown"
                : device.status
                  ? "ON"
                  : "OFF"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Tasmota Plug Control (MQTT)</h2>
        <span className={`text-sm ${wsConnected ? 'text-green-600' : 'text-red-600'}`}>
          {wsConnected ? 'WS bridge connected' : 'WS bridge disconnected'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map(device => (
          <DeviceControl key={device.key} deviceKey={device.key} />
        ))}
      </div>
    </div>
  );
};

export default TasmotaPlugControl;