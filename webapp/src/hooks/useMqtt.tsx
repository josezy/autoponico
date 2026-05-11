"use client";

import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import mqtt, { MqttClient } from 'mqtt';

export type DeviceKey = 'valvula-tanque';
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
}

export const TASMOTA_DEVICES: TasmotaDevice[] = [
  { key: 'valvula-tanque', name: 'Valvula Tanque', topic: 'valvula-tanque' },
];

const SUBSCRIPTIONS = [
  'tele/+/LWT',
  'tele/+/STATE',
  'stat/+/POWER',
  'stat/+/RESULT',
];

interface MqttContextType {
  devices: Record<DeviceKey, TasmotaDeviceState>;
  mqttConnected: boolean;
  sendCommand: (deviceKey: DeviceKey, action: 'ON' | 'OFF' | 'TOGGLE') => void;
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

const MqttContext = createContext<MqttContextType | null>(null);

export const MqttProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const clientRef = useRef<MqttClient | null>(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [devices, setDevices] = useState<Record<DeviceKey, TasmotaDeviceState>>(buildInitialDeviceStates);

  const updateDevice = useCallback((deviceKey: DeviceKey, patch: Partial<Pick<TasmotaDeviceState, 'power' | 'connected'>>) => {
    setDevices((prev) => ({
      ...prev,
      [deviceKey]: {
        ...prev[deviceKey],
        ...patch,
        lastSeen: new Date(),
      },
    }));
  }, []);

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

      // Poll current state from each device
      TASMOTA_DEVICES.forEach((d) => {
        client.publish(`cmnd/${d.topic}/POWER`, '');
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

      if (prefix === 'stat' && leaf === 'RESULT') {
        try {
          const parsed = JSON.parse(payloadText);
          const power = normalizePower(parsed.POWER ?? parsed.POWER1 ?? parsed.Power ?? parsed.power);
          if (power !== 'UNKNOWN') {
            updateDevice(device.key, { connected: true, power });
          }
        } catch { /* ignore malformed JSON */ }
      }
    });

    return () => {
      client.removeAllListeners();
      client.end();
      clientRef.current = null;
    };
  }, [updateDevice]);

  const sendCommand = useCallback((deviceKey: DeviceKey, action: 'ON' | 'OFF' | 'TOGGLE') => {
    const device = TASMOTA_DEVICES.find((d) => d.key === deviceKey);
    if (!device || !clientRef.current?.connected) return;
    clientRef.current.publish(`cmnd/${device.topic}/POWER`, action);
  }, []);

  return (
    <MqttContext.Provider value={{ devices, mqttConnected, sendCommand }}>
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
