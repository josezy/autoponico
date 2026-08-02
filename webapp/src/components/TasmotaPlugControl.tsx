"use client";

import React, { useEffect, useState } from "react";
import { ImSpinner9 } from "react-icons/im";
import { TbClock, TbPower } from "react-icons/tb";
import { toast } from "react-toastify";

import { useMqtt, DeviceKey, TASMOTA_DEVICES, TasmotaDeviceState } from "@/hooks/useMqtt";
import { formatDuration, pulseTimeToSeconds } from "@/lib/tasmota-timers";
import ToggleSwitch from './ToggleSwitch';
import TasmotaTimerDialog from './TasmotaTimerDialog';

function DeviceControl({
  device,
  loading,
  mqttConnected,
  now,
  onCommand,
  onOpenTimers,
}: {
  device: TasmotaDeviceState;
  loading: boolean;
  mqttConnected: boolean;
  now: number;
  onCommand: (deviceKey: DeviceKey, action: "ON" | "OFF") => void;
  onOpenTimers: (deviceKey: DeviceKey) => void;
}) {
  const remainingSec = device.countdownEndsAt
    ? Math.max(0, Math.ceil((device.countdownEndsAt - now) / 1000))
    : 0;
  const pulseSeconds = pulseTimeToSeconds(device.pulseTimeSet);
  const hasSchedule = device.timersEnabled && device.timers.some((t) => t.enable);

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
            onChange={(e) => onCommand(device.key, e.target.checked ? "ON" : "OFF")}
            disabled={loading || !mqttConnected || !device.connected}
          />
          <div
            className={`h-3 w-3 rounded-full ${device.connected ? "bg-green-500" : "bg-red-500"}`}
            title={device.connected ? "Connected" : "Disconnected"}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
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

        <button
          type="button"
          onClick={() => onOpenTimers(device.key)}
          disabled={!mqttConnected || !device.connected}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-white hover:text-blue-700 disabled:pointer-events-none disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-600"
          title={
            !mqttConnected || !device.connected
              ? "Timers unavailable while device is offline"
              : "Timers"
          }
          aria-label={`${device.name} timers`}
        >
          {remainingSec > 0 && (
            <span className="font-mono text-xs font-semibold text-blue-700">
              {formatDuration(remainingSec)}
            </span>
          )}
          <span className="relative">
            <TbClock className="text-xl" />
            {(pulseSeconds > 0 || hasSchedule) && remainingSec <= 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-500" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}

const TasmotaPlugControl = () => {
  const { devices, mqttConnected, sendCommand } = useMqtt();
  const [loadingDevices, setLoadingDevices] = useState<Map<DeviceKey, "ON" | "OFF">>(new Map());
  const [timerDialogDevice, setTimerDialogDevice] = useState<DeviceKey | null>(null);
  const [now, setNow] = useState(Date.now());

  const anyCountdown = Object.values(devices).some((d) => d.countdownEndsAt);

  useEffect(() => {
    if (!anyCountdown) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [anyCountdown]);

  useEffect(() => {
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
          <DeviceControl
            key={d.key}
            device={devices[d.key]}
            loading={loadingDevices.has(d.key)}
            mqttConnected={mqttConnected}
            now={now}
            onCommand={handleDeviceCommand}
            onOpenTimers={setTimerDialogDevice}
          />
        ))}
      </div>

      {timerDialogDevice && (
        <TasmotaTimerDialog
          deviceKey={timerDialogDevice}
          open={!!timerDialogDevice}
          onClose={() => setTimerDialogDevice(null)}
        />
      )}
    </div>
  );
};

export default TasmotaPlugControl;
