"use client";

import React, { useState } from "react";
import { ImSpinner9 } from "react-icons/im";
import { TbPower } from "react-icons/tb";
import { toast } from "react-toastify";

import { useMqtt, DeviceKey, TASMOTA_DEVICES } from "@/hooks/useMqtt";
import ToggleSwitch from './ToggleSwitch';

const TasmotaPlugControl = () => {
  const { devices, mqttConnected, sendCommand } = useMqtt();
  const [loadingDevices, setLoadingDevices] = useState<Map<DeviceKey, "ON" | "OFF">>(new Map());

  React.useEffect(() => {
    setLoadingDevices((prev) => {
      let changed = false;
      const next = new Map(prev);
      next.forEach((expectedPower, deviceKey) => {
        if (devices[deviceKey].power === expectedPower) {
          next.delete(deviceKey);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [devices]);

  const handleDeviceCommand = (deviceKey: DeviceKey, action: "ON" | "OFF") => {
    if (!mqttConnected) {
      toast.error('MQTT broker is disconnected.');
      return;
    }

    setLoadingDevices((prev) => new Map(prev).set(deviceKey, action));
    sendCommand(deviceKey, action);
  };

  const DeviceControl = ({ deviceKey }: { deviceKey: DeviceKey }) => {
    const device = devices[deviceKey];
    const loading = loadingDevices.has(deviceKey);

    return (
      <div className="bg-gray-50 rounded-lg p-4 border">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg">{device.name}</h3>
          <div className="flex items-center gap-3">
            {loading && (
              <ImSpinner9 className="animate-spin text-lg text-gray-500" />
            )}
            <ToggleSwitch
              checked={device.power === 'ON'}
              onChange={(e) => handleDeviceCommand(deviceKey, e.target.checked ? "ON" : "OFF")}
              disabled={loading || !mqttConnected || !device.connected}
            />
            <div
              className={`h-3 w-3 rounded-full ${device.connected ? "bg-green-500" : "bg-red-500"}`}
              title={device.connected ? "Connected" : "Disconnected"}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TbPower
            className={`text-2xl ${device.power === 'ON' ? 'text-green-600' : 'text-gray-400'}`}
          />
          <span className="text-sm font-medium">
            {loading
              ? "Loading..."
              : device.power === 'UNKNOWN'
                ? "Unknown"
                : device.power}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Tasmota Plug Control (MQTT)</h2>
        <span className={`text-sm ${mqttConnected ? 'text-green-600' : 'text-red-600'}`}>
          {mqttConnected ? 'MQTT connected' : 'MQTT disconnected'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {TASMOTA_DEVICES.map((d) => (
          <DeviceControl key={d.key} deviceKey={d.key} />
        ))}
      </div>
    </div>
  );
};

export default TasmotaPlugControl;
