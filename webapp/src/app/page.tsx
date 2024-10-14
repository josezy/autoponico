"use client"

import React, { useEffect, useState } from 'react';
import { ImSpinner9 } from "react-icons/im";

import { useWebSocket, WebSocketProvider } from '@/hooks/useWebsocket';

const Dashboard = () => {
  const { send, connect, disconnect, wsData, connected } = useWebSocket();

  const [deviceInfo, setDeviceInfo] = useState({});
  const [controlInfo, setControlInfo] = useState<Record<string, any>>({});
  const [influxDBForm, setInfluxDBForm] = useState({
    enabled: false,
    url: '',
    org: '',
    bucket: '',
    token: '',
  });

  useEffect(() => {
    connect(`${process.env.NEXT_PUBLIC_WSSERVER_URL}/ws${window.location.search}`);
    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (connected) {
      send('management info');
      send('control info');
      send('influxdb info');
    }
  }, [connected]);

  useEffect(() => {
    // Update state when WebSocket data changes
    if (wsData.management) setDeviceInfo(wsData.management);
    if (wsData.control) setControlInfo(wsData.control);
    if (wsData.influxdb) setInfluxDBForm({
      enabled: wsData.influxdb.enabled,
      url: wsData.influxdb.url,
      org: wsData.influxdb.org,
      bucket: wsData.influxdb.bucket,
      token: wsData.influxdb.token,
    });
  }, [wsData]);

  const handleCommand = (command: string) => {
    send(command);
  };

  const handleCommandConfirm = (command: string) => {
    if (confirm(`Are you sure?`)) {
      handleCommand(command);
    }
  };

  const handleControlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    send(`control ${name} ${value}`);
  };

  const handleInfluxDBSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    send(`influxdb update ${JSON.stringify(influxDBForm)}`);
  };

  if (!connected) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <ImSpinner9 className="animate-spin text-4xl dark:text-white" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 dark:text-white">IoT Device Dashboard</h1>

      {/* Device Info */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Device Info</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(deviceInfo).map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="font-medium">{key}: </span>
              {value as string}
            </div>
          ))}
        </div>
      </div>

      {/* Commands */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Commands</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={() => handleCommand('ping')} className="btn">Ping</button>
          <button onClick={() => handleCommand('ph read_ph')} className="btn">Read pH</button>
          <button onClick={() => handleCommandConfirm('management reboot')} className="btn">Reboot</button>
          <button onClick={() => handleCommandConfirm('management update')} className="btn">Update firmware ⚠️</button>
        </div>
      </div>

      {/* pH Calibration */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">pH Calibration</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {wsData.ph && (
            <div>
              <label className="block text-sm font-medium text-gray-700">pH</label>
              <input
                type="text"
                value={wsData.ph.ph}
                readOnly
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={() => handleCommand('ph cal_low')} className="btn">Cal Low</button>
          <button onClick={() => handleCommand('ph cal_mid')} className="btn">Cal Mid</button>
          <button onClick={() => handleCommand('ph cal_high')} className="btn">Cal High</button>
          <button onClick={() => handleCommand('ph cal_clear')} className="btn">Cal Clear</button>
        </div>
      </div>

      {/* Control */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">Control</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['ph_setpoint', 'ph_auto', 'ec_setpoint', 'ec_auto'].map((control) => (
            <div key={control}>
              <label className="block text-sm font-medium text-gray-700">{control}</label>
              <input
                type="text"
                name={control}
                value={controlInfo[control] ?? ''}
                onChange={handleControlChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
          <button onClick={() => handleCommand('control ph_up')} className="btn">pH Up</button>
          <button onClick={() => handleCommand('control ph_down')} className="btn">pH Down</button>
          <button onClick={() => handleCommand('control ec_up')} className="btn">EC Up</button>
          {/* <button onClick={() => handleCommand('control ec_down')} className="btn">EC Down</button> */}
        </div>
      </div>

      {/* InfluxDB */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">InfluxDB Configuration</h2>
        <form onSubmit={handleInfluxDBSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Enabled</label>
              <input
                type="checkbox"
                checked={influxDBForm.enabled}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, enabled: e.target.checked })}
                className="mt-1 focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">URL</label>
              <input
                type="text"
                value={influxDBForm.url}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, url: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization</label>
              <input
                type="text"
                value={influxDBForm.org}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, org: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bucket</label>
              <input
                type="text"
                value={influxDBForm.bucket}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, bucket: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Token</label>
              <input
                type="password"
                value={influxDBForm.token}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, token: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          </div>
          <button type="submit" className="mt-4 btn">Update InfluxDB Config</button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <WebSocketProvider>
      <Dashboard />
    </WebSocketProvider>
  );
}
