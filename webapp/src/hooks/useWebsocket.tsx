import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

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
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [wsData, setWsData] = useState<WsData>({});
  const [connected, setConnected] = useState(false);

  const connect = useCallback((url: string) => {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      const newSocket = new WebSocket(url);
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

  useEffect(() => {
    if (socket) {

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { command, ...rest } = data;
          setWsData((prevData) => ({...prevData, [command]: rest}));
        } catch (e) {
          console.log("WS:", event.data)
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
