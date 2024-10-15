"use client"

import React from 'react';
import { IconBaseProps } from 'react-icons';
import { ImSpinner9 } from "react-icons/im";
import { TbReload } from "react-icons/tb";
import { LuSignalLow, LuSignalMedium, LuSignalHigh } from "react-icons/lu";
import { toast } from 'react-toastify';

import ToggleSwitch from '@/components/ToggleSwitch';
import { useWebSocket, WebSocketProvider } from '@/hooks/useWebsocket';

const LiveMeasure = (props: { command: string, value?: number, label: string, interval?: number }) => {
  const [enabled, setEnabled] = React.useState(false);
  const { send } = useWebSocket();
  const value = Math.trunc((props.value || 0) * 100) / 100;

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (enabled) {
        send(props.command);
      }
    }, props.interval || 2000);
    return () => clearInterval(interval);
  }, [enabled, send, props.command, props.interval]);

  return (
    <div className='flex items-center gap-2'>
      {enabled ? (
        !!value && <span className="text-sm text-white rounded-full w-12 flex items-center justify-center bg-teal-600 py-0.5">{value}</span>
      ) : (
        <span className="text-xs tracking-tight">{props.label}</span>
      )}
      <ToggleSwitch
        checked={enabled}
        onChange={() => setEnabled(!enabled)}
      />
    </div>
  )
}

const SignalStrength = (props: IconBaseProps & { rssi: number }) => {
  const { rssi, ...rest } = props;
  if (rssi < -70) {
    return <LuSignalLow color='red' {...rest} />
  } else if (rssi < -50) {
    return <LuSignalMedium color='orange' {...rest} />
  } else {
    return <LuSignalHigh color='green' {...rest} />
  }
}

const Dashboard = () => {
  const { send, connect, disconnect, wsData, connected } = useWebSocket();

  const [controlInfo, setControlInfo] = React.useState<Record<string, any>>({});
  const [influxDBForm, setInfluxDBForm] = React.useState({
    enabled: false,
    url: '',
    org: '',
    bucket: '',
    token: '',
  });

  React.useEffect(() => {
    connect(`${process.env.NEXT_PUBLIC_WSSERVER_URL}/ws${window.location.search}`);
    return () => {
      disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (connected) {
      send('management info');
      send('control info');
      send('influxdb info');
    }
  }, [connected]);

  React.useEffect(() => {
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
    toast(`"${command}" sent`, { autoClose: 2000 });
  };

  const handleCommandConfirm = (command: string) => {
    if (confirm(`Are you sure?`)) {
      handleCommand(command);
    }
  };

  const handleInfluxDBSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.assign({}, influxDBForm, { enabled: influxDBForm.enabled ? 1 : 0 });
    send(`influxdb update ${JSON.stringify(data)}`);
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
      <h1 className="text-2xl font-bold mb-4 dark:text-white">Autoponico Dashboard 🍃</h1>

      {/* Device Info */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className='flex justify-between w-full'>
          <div className='flex items-center gap-2'>
            <h2 className="text-xl font-semibold mb-2">Device Info</h2>
            <SignalStrength rssi={wsData.management?.rssi} size={24} strokeWidth={3} className='mb-2' />
          </div>
          <LiveMeasure command="management info" label="Live info" interval={5000} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(wsData.management || {}).map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="font-medium">{key}: </span>
              {value as string}
            </div>
          ))}
          {!Object.keys(wsData.management || {}).length && (
            <div className="text-sm">No device info</div>
          )}
        </div>

        <h2 className="text-xl font-semibold mb-2">Commands</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button onClick={() => handleCommand('ping')} className="btn">Ping</button>
          <button onClick={() => handleCommandConfirm('management reboot')} className="btn">Reboot</button>
          <button onClick={() => handleCommandConfirm('management update')} className="btn">Update firmware ⚠️</button>
        </div>
      </div>

      {/* pH Calibration */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className='flex justify-between w-full'>
          <h2 className="text-xl font-semibold mb-2">pH Calibration</h2>
          <LiveMeasure command="ph read_ph" label="Live pH" value={wsData.ph?.value}  />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={() => handleCommand('ph cal_low')} className="btn">Cal Low</button>
          <button onClick={() => handleCommand('ph cal_mid')} className="btn">Cal Mid</button>
          <button onClick={() => handleCommand('ph cal_high')} className="btn">Cal High</button>
          <button onClick={() => handleCommand('ph cal_clear')} className="btn">Cal Clear</button>
        </div>
      </div>

      {/* EC Calibration */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <div className='flex justify-between w-full'>
          <h2 className="text-xl font-semibold mb-2">EC Calibration</h2>
          <LiveMeasure command="ec R" label="Live EC" value={wsData.ec?.value}  />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button onClick={() => handleCommand('ec Cal,dry')} className="btn">Cal dry</button>
          <button onClick={() => console.error("Not implemented")} className="btn" disabled>Single point cal</button>
          <button onClick={() => handleCommand('ec Cal,?')} className="btn">Cal Clear</button>
        </div>
      </div>

      {/* Control */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2 flex gap-2">
          Control
          <TbReload
            size={28}
            strokeWidth={3}
            onClick={() => handleCommand('control info')}
            className="text-teal-600 cursor-pointer rounded-full hover:bg-neutral-100 p-1"
          />
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['ph_setpoint', 'ph_auto', 'ec_setpoint', 'ec_auto'].map((control) => {
            const label = control.replaceAll('_', ' ')
            if (control.endsWith('_auto')) {
              return (
                <div key={control} className='mr-auto'>
                  <ToggleSwitch
                    name={control}
                    label={label}
                    checked={controlInfo[control] === 'true'}
                    onChange={(e) => {
                      console.log("gonorreaass", e.target)
                      const { checked } = e.target
                      handleCommand(`control ${control} ${checked ? '1' : '0'}`)
                      setControlInfo({ ...controlInfo, [control]: checked ? 'true' : 'false' })
                    }}
                  />
                </div>
              )
            }
            return (
              <div key={control}>
                <label className="block text-sm font-medium text-gray-700">{label}</label>
                <input
                  type="text"
                  name={control}
                  value={controlInfo[control] ?? ''}
                  onChange={(e) => setControlInfo({ ...controlInfo, [control]: e.target.value })}
                  onBlur={(e) => {
                    const { value } = e.target
                    if (value.trim() === '') return
                    handleCommand(`control ${control} ${e.target.value}`)
                  }}
                  className="mt-1"
                />
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
          <button onClick={() => handleCommand('control ph_up 2000')} className="btn">pH Up</button>
          <button onClick={() => handleCommand('control ph_down 2000')} className="btn">pH Down</button>
          <button onClick={() => handleCommand('control ec_up 5000')} className="btn">EC Up</button>
        </div>
      </div>

      {/* InfluxDB */}
      <div className="bg-white shadow rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-2">InfluxDB Configuration</h2>
        <form onSubmit={handleInfluxDBSubmit}>
          <div className='w-fit mb-4'>
            <ToggleSwitch
              label="Enabled"
              checked={influxDBForm.enabled}
              onChange={(e) => setInfluxDBForm({ ...influxDBForm, enabled: e.target.checked })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">URL</label>
              <input
                type="text"
                value={influxDBForm.url}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Organization</label>
              <input
                type="text"
                value={influxDBForm.org}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, org: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bucket</label>
              <input
                type="text"
                value={influxDBForm.bucket}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, bucket: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Token</label>
              <input
                type="password"
                value={influxDBForm.token}
                onChange={(e) => setInfluxDBForm({ ...influxDBForm, token: e.target.value })}
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
