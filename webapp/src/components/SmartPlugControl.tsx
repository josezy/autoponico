"use client";

import React, { useEffect, useState } from "react";
import { ImSpinner9 } from "react-icons/im";
import { TbPower } from "react-icons/tb";
import { toast } from "react-toastify";
import ToggleSwitch from './ToggleSwitch';

type DeviceKey = 'fresas' | 'valvula-tanque' | 'luz-cannabis' | 'main-pump';

interface DeviceState {
  key: DeviceKey;
  name: string;
  status: boolean | null;
  loading: boolean;
  connected: boolean;
}

const devices: Array<{ key: DeviceKey; name: string }> = [
  { key: 'fresas', name: 'Fresas' },
  { key: 'valvula-tanque', name: 'Válvula Tanque' },
  { key: 'luz-cannabis', name: 'Luz Cannabis' },
  { key: 'main-pump', name: 'Main Pump' }
];

const SmartPlugControl = () => {
  const [deviceStates, setDeviceStates] = useState<Record<DeviceKey, DeviceState>>(() => {
    const initialStates: Record<DeviceKey, DeviceState> = {} as Record<DeviceKey, DeviceState>;
    devices.forEach(device => {
      initialStates[device.key] = {
        key: device.key,
        name: device.name,
        status: null,
        loading: true,
        connected: true
      };
    });
    return initialStates;
  });

  // Function to fetch all device statuses using batch endpoint
  const fetchAllStatuses = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch('/api/tuya/plug/status-all', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (data.success && data.devices) {
        setDeviceStates(prev => {
          const newStates = { ...prev };

          data.devices.forEach((device: any) => {
            newStates[device.deviceKey as DeviceKey] = {
              ...newStates[device.deviceKey as DeviceKey],
              status: device.isOn,
              connected: device.connected,
              loading: false
            };
          });

          return newStates;
        });
      } else {
        console.error('Failed to fetch device statuses:', data.message);
        // Don't show toast for polling failures to avoid spam
      }
    } catch (error: any) {
      console.error('Error fetching device statuses:', error);
      if (error.name !== "AbortError") {
        // Set all devices as disconnected on error
        setDeviceStates(prev => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach(key => {
            newStates[key as DeviceKey] = {
              ...newStates[key as DeviceKey],
              connected: false,
              loading: false
            };
          });
          return newStates;
        });
      }
    }
  };

  // Set up interval for automatic status fetching
  useEffect(() => {
    fetchAllStatuses(); // Initial fetch

    const interval = setInterval(() => {
      fetchAllStatuses();
    }, 1000); // Fetch every 1 second

    return () => clearInterval(interval);
  }, []);

  // Function to handle device commands
  const handleDeviceCommand = async (deviceKey: DeviceKey, action: "on" | "off") => {
    setDeviceStates(prev => ({
      ...prev,
      [deviceKey]: { ...prev[deviceKey], loading: true }
    }));

    try {
      const body = { device: deviceKey, action };

      const response = await fetch("/api/tuya/plug/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        setDeviceStates(prev => ({
          ...prev,
          [deviceKey]: {
            ...prev[deviceKey],
            status: action === "on",
            connected: true,
            loading: false
          }
        }));
        toast.success(`${deviceKey} turned ${action}.`);
      } else {
        console.error(`Failed to turn ${deviceKey} ${action}:`, data.message);
        toast.error(`Failed to turn ${deviceKey} ${action}: ${data.message}`);
        setDeviceStates(prev => ({
          ...prev,
          [deviceKey]: { ...prev[deviceKey], loading: false }
        }));
      }
    } catch (error) {
      console.error(`Error sending ${deviceKey} command ${action}:`, error);
      toast.error(`Error turning ${deviceKey} ${action}.`);
      setDeviceStates(prev => ({
        ...prev,
        [deviceKey]: { ...prev[deviceKey], loading: false }
      }));
    }
  };

  // Individual device component
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
              disabled={device.loading || device.status === null}
            />
            <div
              className={`h-3 w-3 rounded-full ${device.connected ? "bg-green-500" : "bg-red-500"
                }`}
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
        <h2 className="text-2xl font-semibold">Smart Plug Control</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map(device => (
          <DeviceControl key={device.key} deviceKey={device.key} />
        ))}
      </div>
    </div>
  );
};

export default SmartPlugControl;