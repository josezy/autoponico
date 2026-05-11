import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

interface WsData {
  ph?: Record<string, any>;
  ec?: Record<string, any>;
  distance?: Record<string, any>;
  control?: Record<string, any>;
  influxdb?: Record<string, any>;
  management?: Record<string, any>;
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
  const socketRef = useRef<WebSocket | null>(null);
  const [wsData, setWsData] = useState<WsData>({});
  const [connected, setConnected] = useState(false);

  const connect = useCallback((url: string) => {
    if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
      const newSocket = new WebSocket(url);
      socketRef.current = newSocket;

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.command) {
            const { command, ...rest } = data;
            setWsData((prevData) => ({...prevData, [command]: rest}));
            return;
          }

          console.log('WS JSON:', data);
        } catch (e) {
          console.log("WS:", event.data)
          toast(`WS: ${event.data}`, { type: 'info' });
        }
      };

      newSocket.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      newSocket.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      };
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  const send = useCallback((data: string) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }, []);

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
