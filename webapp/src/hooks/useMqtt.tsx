"use client";

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';

import {
  parseTimerPayload,
  secondsToPulseTime,
  timerToPayload,
  TasmotaScheduleTimer,
} from '@/lib/tasmota-timers';

export type DeviceKey = 'valvula-tanque' | 'main-pump';
type DevicePower = 'ON' | 'OFF' | 'UNKNOWN';

export interface TasmotaDevice {
  key: DeviceKey;
  name: string;
  topic: string;
}

export interface TasmotaDeviceState {
  key: DeviceKey;
  name: string;
  topic: string;
  power: DevicePower;
  connected: boolean;
  lastSeen: Date | null;
  /** Client-side end timestamp for active TimedPower countdown (ms since epoch). */
  countdownEndsAt: number | null;
  /** Raw PulseTime Set value (0 = disabled). */
  pulseTimeSet: number;
  timersEnabled: boolean;
  timers: TasmotaScheduleTimer[];
}

export const TASMOTA_DEVICES: TasmotaDevice[] = [
  { key: 'valvula-tanque', name: 'Valvula Tanque', topic: 'valvula-tanque' },
  { key: 'main-pump', name: 'Main Pump', topic: 'main-pump' },
];

const SUBSCRIPTIONS = [
  'tele/+/LWT',
  'tele/+/STATE',
  'stat/+/POWER',
  'stat/+/RESULT',
  'stat/+/STATUS7',
];

type DevicePatch = Partial<
  Pick<
    TasmotaDeviceState,
    'power' | 'connected' | 'countdownEndsAt' | 'pulseTimeSet' | 'timersEnabled' | 'timers'
  >
>;

interface MqttContextType {
  devices: Record<DeviceKey, TasmotaDeviceState>;
  mqttConnected: boolean;
  sendCommand: (deviceKey: DeviceKey, action: 'ON' | 'OFF' | 'TOGGLE') => void;
  startCountdown: (deviceKey: DeviceKey, seconds: number) => void;
  cancelCountdown: (deviceKey: DeviceKey) => void;
  setPulseTimeSeconds: (deviceKey: DeviceKey, seconds: number) => void;
  refreshTimerState: (deviceKey: DeviceKey) => void;
  setTimersEnabled: (deviceKey: DeviceKey, enabled: boolean) => void;
  saveScheduleTimer: (deviceKey: DeviceKey, timer: TasmotaScheduleTimer) => void;
  clearScheduleTimer: (deviceKey: DeviceKey, index: number) => void;
}

const buildInitialDeviceStates = (): Record<DeviceKey, TasmotaDeviceState> => {
  const states = {} as Record<DeviceKey, TasmotaDeviceState>;
  TASMOTA_DEVICES.forEach((d) => {
    states[d.key] = {
      key: d.key,
      name: d.name,
      topic: d.topic,
      power: 'UNKNOWN',
      connected: false,
      lastSeen: null,
      countdownEndsAt: null,
      pulseTimeSet: 0,
      timersEnabled: false,
      timers: [],
    };
  });
  return states;
};

const deviceByTopic = new Map<string, TasmotaDevice>(
  TASMOTA_DEVICES.map((d) => [d.topic, d]),
);

const normalizePower = (raw: unknown): DevicePower => {
  if (typeof raw === 'string') {
    const v = raw.trim().toUpperCase();
    if (v === 'ON' || v === 'OFF') return v;
  }
  if (typeof raw === 'boolean') return raw ? 'ON' : 'OFF';
  return 'UNKNOWN';
};

const isConfiguredTimer = (timer: TasmotaScheduleTimer) => {
  const hasDays = timer.days.replace(/[0-]/g, '').length > 0;
  return timer.enable || hasDays;
};

const MqttContext = createContext<MqttContextType | null>(null);

export const MqttProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const clientRef = useRef<MqttClient | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState<Record<DeviceKey, TasmotaDeviceState>>(buildInitialDeviceStates);

  const updateDevice = useCallback((deviceKey: DeviceKey, patch: DevicePatch) => {
    setDevices((prev) => ({
      ...prev,
      [deviceKey]: {
        ...prev[deviceKey],
        ...patch,
        lastSeen: new Date(),
      },
    }));
  }, []);

  const publishDeviceCmnd = useCallback((deviceKey: DeviceKey, command: string, payload: string) => {
    const device = TASMOTA_DEVICES.find((d) => d.key === deviceKey);
    if (!device || !clientRef.current?.connected) return;
    clientRef.current.publish(`cmnd/${device.topic}/${command}`, payload);
  }, []);

  const refreshTimerState = useCallback((deviceKey: DeviceKey) => {
    publishDeviceCmnd(deviceKey, 'TimedPower', '');
    publishDeviceCmnd(deviceKey, 'PulseTime', '');
    publishDeviceCmnd(deviceKey, 'STATUS', '7');
  }, [publishDeviceCmnd]);

  const parseTimedPowerResult = useCallback((deviceKey: DeviceKey, value: unknown) => {
    if (value === 'Empty' || value === '' || value == null) {
      updateDevice(deviceKey, { countdownEndsAt: null });
      return;
    }
    const entries = Array.isArray(value) ? value : [value];
    let maxRemaining = 0;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const remaining = Number((entry as Record<string, unknown>).Remaining);
      if (Number.isFinite(remaining) && remaining > maxRemaining) {
        maxRemaining = remaining;
      }
    }
    updateDevice(deviceKey, {
      countdownEndsAt: maxRemaining > 0 ? Date.now() + maxRemaining : null,
    });
  }, [updateDevice]);

  const parsePulseTimeResult = useCallback((deviceKey: DeviceKey, parsed: Record<string, unknown>) => {
    const pt1 = parsed.PulseTime1 ?? parsed.PulseTime;
    if (!pt1 || typeof pt1 !== 'object') return;
    const set = Number((pt1 as Record<string, unknown>).Set);
    if (Number.isFinite(set)) {
      updateDevice(deviceKey, { pulseTimeSet: set });
    }
  }, [updateDevice]);

  const parseStatusTim = useCallback((deviceKey: DeviceKey, statusTim: Record<string, unknown>) => {
    const timersFlag = statusTim.Timers;
    const timersEnabled =
      timersFlag === 'ON' || timersFlag === 1 || timersFlag === '1' || timersFlag === true;

    const timers: TasmotaScheduleTimer[] = [];
    for (let i = 1; i <= 16; i++) {
      const key = `Timer${i}`;
      if (!(key in statusTim)) continue;
      const timer = parseTimerPayload(i, statusTim[key]);
      if (!timer) continue;
      const hasDays = timer.days.replace(/[0-]/g, '').length > 0;
      if (timer.enable || hasDays) {
        timers.push(timer);
      }
    }

    updateDevice(deviceKey, { timersEnabled: !!timersEnabled, timers });
  }, [updateDevice]);

  const parseResultPayload = useCallback((deviceKey: DeviceKey, parsed: Record<string, unknown>) => {
    const power = normalizePower(parsed.POWER ?? parsed.POWER1 ?? parsed.Power ?? parsed.power);
    if (power !== 'UNKNOWN') {
      updateDevice(deviceKey, { connected: true, power });
    }

    if ('TimedPower' in parsed) {
      parseTimedPowerResult(deviceKey, parsed.TimedPower);
    }

    if ('PulseTime1' in parsed || 'PulseTime' in parsed) {
      parsePulseTimeResult(deviceKey, parsed);
    }

    if ('Timers' in parsed && (parsed.Timers === 'ON' || parsed.Timers === 'OFF' || parsed.Timers === 0 || parsed.Timers === 1 || parsed.Timers === 2)) {
      updateDevice(deviceKey, {
        timersEnabled: parsed.Timers === 'ON' || parsed.Timers === 1,
      });
    }

    for (let i = 1; i <= 16; i++) {
      const key = `Timer${i}`;
      if (!(key in parsed)) continue;
      const timer = parseTimerPayload(i, parsed[key]);
      if (!timer) continue;
      setDevices((prev) => {
        const existing = prev[deviceKey].timers.filter((t) => t.index !== i);
        const nextTimers = isConfiguredTimer(timer)
          ? [...existing, timer].sort((a, b) => a.index - b.index)
          : existing;
        return {
          ...prev,
          [deviceKey]: {
            ...prev[deviceKey],
            timers: nextTimers,
            lastSeen: new Date(),
          },
        };
      });
    }

    if (parsed.StatusTIM && typeof parsed.StatusTIM === 'object') {
      parseStatusTim(deviceKey, parsed.StatusTIM as Record<string, unknown>);
    }
  }, [parsePulseTimeResult, parseStatusTim, parseTimedPowerResult, updateDevice]);

  useEffect(() => {
    const brokerUrl = process.env.NEXT_PUBLIC_MQTT_WS_URL || 'wss://autoponico-ws.tucanorobotics.co/mqtt';
    const clientId = `dashboard-${Math.random().toString(36).substring(2, 10)}`;

    const client = mqtt.connect(brokerUrl, {
      clientId,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      setMqttConnected(true);
      client.subscribe(SUBSCRIPTIONS);

      TASMOTA_DEVICES.forEach((d) => {
        client.publish(`cmnd/${d.topic}/POWER`, '');
        client.publish(`cmnd/${d.topic}/TimedPower`, '');
        client.publish(`cmnd/${d.topic}/PulseTime`, '');
        client.publish(`cmnd/${d.topic}/STATUS`, '7');
      });
    });

    client.on('close', () => setMqttConnected(false));
    client.on('offline', () => setMqttConnected(false));

    client.on('message', (topic: string, payload: Buffer) => {
      const segments = topic.split('/');
      if (segments.length < 3) return;

      const [prefix, deviceTopic, leaf] = segments;
      const device = deviceByTopic.get(deviceTopic);
      if (!device) return;

      const payloadText = payload.toString();

      if (prefix === 'tele' && leaf === 'LWT') {
        const connected = payloadText.trim().toLowerCase() === 'online';
        updateDevice(device.key, { connected });
        return;
      }

      if (prefix === 'tele' && leaf === 'STATE') {
        try {
          const parsed = JSON.parse(payloadText);
          const power = normalizePower(parsed.POWER ?? parsed.POWER1 ?? parsed.Power ?? parsed.power);
          updateDevice(device.key, {
            connected: true,
            ...(power !== 'UNKNOWN' && { power }),
          });
        } catch { /* ignore malformed JSON */ }
        return;
      }

      if (prefix === 'stat' && leaf === 'POWER') {
        const power = normalizePower(payloadText);
        updateDevice(device.key, { connected: true, ...(power !== 'UNKNOWN' && { power }) });
        return;
      }

      if (prefix === 'stat' && (leaf === 'RESULT' || leaf === 'STATUS7')) {
        try {
          const parsed = JSON.parse(payloadText) as Record<string, unknown>;
          if (leaf === 'STATUS7' && parsed.StatusTIM && typeof parsed.StatusTIM === 'object') {
            parseStatusTim(device.key, parsed.StatusTIM as Record<string, unknown>);
            return;
          }
          parseResultPayload(device.key, parsed);
        } catch { /* ignore malformed JSON */ }
      }
    });

    return () => {
      client.removeAllListeners();
      client.end();
      clientRef.current = null;
    };
  }, [parseResultPayload, parseStatusTim, updateDevice]);

  const sendCommand = useCallback((deviceKey: DeviceKey, action: 'ON' | 'OFF' | 'TOGGLE') => {
    publishDeviceCmnd(deviceKey, 'POWER', action);
  }, [publishDeviceCmnd]);

  const startCountdown = useCallback((deviceKey: DeviceKey, seconds: number) => {
    const ms = Math.max(50, Math.round(seconds * 1000));
    updateDevice(deviceKey, { countdownEndsAt: Date.now() + ms });
    // Default TimedPower action is ON then inverted OFF
    publishDeviceCmnd(deviceKey, 'TimedPower', String(ms));
  }, [publishDeviceCmnd, updateDevice]);

  const cancelCountdown = useCallback((deviceKey: DeviceKey) => {
    updateDevice(deviceKey, { countdownEndsAt: null });
    // Empty TimedPower1 clears the relay-1 timer without forcing the end action
    publishDeviceCmnd(deviceKey, 'TimedPower1', '');
  }, [publishDeviceCmnd, updateDevice]);

  const setPulseTimeSeconds = useCallback((deviceKey: DeviceKey, seconds: number) => {
    const encoded = secondsToPulseTime(seconds);
    updateDevice(deviceKey, { pulseTimeSet: encoded });
    publishDeviceCmnd(deviceKey, 'PulseTime1', String(encoded));
  }, [publishDeviceCmnd, updateDevice]);

  const setTimersEnabled = useCallback((deviceKey: DeviceKey, enabled: boolean) => {
    updateDevice(deviceKey, { timersEnabled: enabled });
    publishDeviceCmnd(deviceKey, 'Timers', enabled ? '1' : '0');
  }, [publishDeviceCmnd, updateDevice]);

  const saveScheduleTimer = useCallback((deviceKey: DeviceKey, timer: TasmotaScheduleTimer) => {
    setDevices((prev) => {
      const others = prev[deviceKey].timers.filter((t) => t.index !== timer.index);
      return {
        ...prev,
        [deviceKey]: {
          ...prev[deviceKey],
          timers: [...others, timer].sort((a, b) => a.index - b.index),
          timersEnabled: true,
          lastSeen: new Date(),
        },
      };
    });
    publishDeviceCmnd(deviceKey, 'Timers', '1');
    publishDeviceCmnd(deviceKey, `Timer${timer.index}`, timerToPayload(timer));
  }, [publishDeviceCmnd]);

  const clearScheduleTimer = useCallback((deviceKey: DeviceKey, index: number) => {
    setDevices((prev) => ({
      ...prev,
      [deviceKey]: {
        ...prev[deviceKey],
        timers: prev[deviceKey].timers.filter((t) => t.index !== index),
        lastSeen: new Date(),
      },
    }));
    publishDeviceCmnd(deviceKey, `Timer${index}`, '0');
  }, [publishDeviceCmnd]);

  return (
    <MqttContext.Provider
      value={{
        devices,
        mqttConnected,
        sendCommand,
        startCountdown,
        cancelCountdown,
        setPulseTimeSeconds,
        refreshTimerState,
        setTimersEnabled,
        saveScheduleTimer,
        clearScheduleTimer,
      }}
    >
      {children}
    </MqttContext.Provider>
  );
};

export const useMqtt = (): MqttContextType => {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqtt must be used within a MqttProvider');
  }
  return context;
};
