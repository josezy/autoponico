import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';

export interface WsDeviceState {
  deviceKey: string;
  name: string;
  topic: string;
  power: 'ON' | 'OFF' | 'UNKNOWN';
  connected: boolean;
  lastSeen: string | null;
  source: 'mqtt' | 'server';
}

interface WsData {
  ph?: Record<string, any>;
  ec?: Record<string, any>;
  distance?: Record<string, any>;
  control?: Record<string, any>;
  influxdb?: Record<string, any>;
  management?: Record<string, any>;
  devices: Record<string, WsDeviceState>;
}

interface WebSocketContextType {
  send: (data: string) => void;
  connect: (url: string) => void;
  disconnect: () => void;
  wsData: WsData;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [wsData, setWsData] = useState<WsData>({ devices: {} });
  const [connected, setConnected] = useState(false);

  const connect = useCallback((url: string) => {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      const targetUrl = new URL(url, window.location.origin);
      targetUrl.searchParams.set('role', 'dashboard');
      const newSocket = new WebSocket(targetUrl.toString());
      setSocket(newSocket);
    }
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.close();
      setSocket(null);
      setConnected(false);
    }
  }, [socket]);

  const send = useCallback((data: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    } else {
      console.error('WebSocket is not connected');
      setConnected(false);
    }
  }, [socket]);

  const hydrateDeviceSnapshot = useCallback((devices: WsDeviceState[]) => {
    setWsData((prevData) => ({
      ...prevData,
      devices: devices.reduce<Record<string, WsDeviceState>>((accumulator, device) => {
        accumulator[device.deviceKey] = device;
        return accumulator;
      }, { ...prevData.devices }),
    }));
  }, []);

  const updateDeviceState = useCallback((device: WsDeviceState) => {
    setWsData((prevData) => ({
      ...prevData,
      devices: {
        ...prevData.devices,
        [device.deviceKey]: device,
      },
    }));
  }, []);

  useEffect(() => {
    if (socket) {

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.command) {
            const { command, ...rest } = data;
            setWsData((prevData) => ({...prevData, [command]: rest}));
            return;
          }

          if (data.type === 'device-snapshot' && Array.isArray(data.devices)) {
            hydrateDeviceSnapshot(data.devices);
            return;
          }

          if (data.type === 'device-state' && data.deviceKey) {
            updateDeviceState(data as WsDeviceState);
            return;
          }

          if (data.type === 'device-error') {
            toast(data.message || 'Device error', { type: 'error' });
            return;
          }

          if (data.type === 'device-command-queued' || data.type === 'server-ready') {
            return;
          }

          console.log('WS JSON:', data);
        } catch (e) {
          console.log("WS:", event.data)
          toast(`WS: ${event.data}`, { type: 'info' });
        }
      };

      socket.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      socket.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      };

      return () => {
        socket.close();
        setConnected(false);
      };
    }
  }, [socket]);

  const contextValue: WebSocketContextType = {
    send,
    connect,
    disconnect,
    wsData,
    connected,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
