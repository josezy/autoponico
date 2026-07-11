"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TbClock, TbX } from "react-icons/tb";
import { toast } from "react-toastify";

import { DeviceKey, useMqtt } from "@/hooks/useMqtt";
import {
  COUNTDOWN_PRESETS_SEC,
  DAY_LABELS,
  defaultScheduleTimer,
  describeTimer,
  formatDuration,
  formatPresetLabel,
  isDayEnabled,
  pulseTimeToSeconds,
  TasmotaScheduleTimer,
  TimerAction,
  toggleDay,
} from "@/lib/tasmota-timers";

type TabId = "countdown" | "autooff" | "schedule";

interface TasmotaTimerDialogProps {
  deviceKey: DeviceKey;
  open: boolean;
  onClose: () => void;
}

const TasmotaTimerDialog = ({ deviceKey, open, onClose }: TasmotaTimerDialogProps) => {
  const {
    devices,
    mqttConnected,
    startCountdown,
    cancelCountdown,
    setPulseTimeSeconds,
    refreshTimerState,
    setTimersEnabled,
    saveScheduleTimer,
    clearScheduleTimer,
  } = useMqtt();

  const device = devices[deviceKey];
  const [tab, setTab] = useState<TabId>("countdown");
  const [customMinutes, setCustomMinutes] = useState("5");
  const [autoOffMinutes, setAutoOffMinutes] = useState("10");
  const [editing, setEditing] = useState<TasmotaScheduleTimer | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    refreshTimerState(deviceKey);
    const pulseSeconds = pulseTimeToSeconds(device.pulseTimeSet);
    if (pulseSeconds > 0) {
      setAutoOffMinutes(String(Math.max(1, Math.round(pulseSeconds / 60))));
    }
  }, [open, deviceKey, refreshTimerState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open && !device.countdownEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [open, device.countdownEndsAt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const remainingSec = useMemo(() => {
    if (!device.countdownEndsAt) return 0;
    return Math.max(0, Math.ceil((device.countdownEndsAt - now) / 1000));
  }, [device.countdownEndsAt, now]);

  const pulseSeconds = pulseTimeToSeconds(device.pulseTimeSet);
  const usedTimerIndexes = new Set(device.timers.map((t) => t.index));
  const nextTimerIndex = (() => {
    for (let i = 1; i <= 16; i++) {
      if (!usedTimerIndexes.has(i)) return i;
    }
    return null;
  })();

  if (!open) return null;

  const ensureReady = () => {
    if (!mqttConnected || !device.connected) {
      toast.error("Device is offline or MQTT is disconnected.");
      return false;
    }
    return true;
  };

  const handleStartCountdown = (seconds: number) => {
    if (!ensureReady()) return;
    if (seconds <= 0) {
      toast.error("Duration must be greater than zero.");
      return;
    }
    startCountdown(deviceKey, seconds);
    toast.success(`Countdown started: ON for ${formatDuration(seconds)}`);
  };

  const handleCustomCountdown = () => {
    const minutes = Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      toast.error("Enter a valid number of minutes.");
      return;
    }
    handleStartCountdown(Math.round(minutes * 60));
  };

  const handleCancelCountdown = () => {
    if (!ensureReady()) return;
    cancelCountdown(deviceKey);
    toast.info("Countdown cancelled.");
  };

  const handleSaveAutoOff = () => {
    if (!ensureReady()) return;
    const minutes = Number(autoOffMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) {
      toast.error("Enter a valid number of minutes.");
      return;
    }
    const seconds = Math.round(minutes * 60);
    setPulseTimeSeconds(deviceKey, seconds);
    toast.success(
      seconds > 0
        ? `Sticky auto-off set to ${formatDuration(seconds)}`
        : "Sticky auto-off disabled",
    );
  };

  const handleDisableAutoOff = () => {
    if (!ensureReady()) return;
    setPulseTimeSeconds(deviceKey, 0);
    toast.success("Sticky auto-off disabled");
  };

  const handleSaveSchedule = () => {
    if (!ensureReady() || !editing) return;
    if (!editing.days.replace(/[0-]/g, "").length) {
      toast.error("Select at least one day.");
      return;
    }
    saveScheduleTimer(deviceKey, editing);
    setEditing(null);
    toast.success("Schedule saved");
  };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "countdown", label: "Countdown" },
    { id: "autooff", label: "Auto-off" },
    { id: "schedule", label: "Schedule" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${device.name} timers`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <TbClock className="text-xl text-gray-600" />
            <div>
              <h3 className="font-semibold text-lg leading-tight">{device.name}</h3>
              <p className="text-xs text-gray-500">Timers</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close"
          >
            <TbX className="text-xl" />
          </button>
        </div>

        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-2 text-sm font-medium ${
                tab === t.id
                  ? "border-b-2 border-blue-600 text-blue-700"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {tab === "countdown" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Turn ON now, then automatically OFF after the duration.
              </p>

              {remainingSec > 0 ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-sm text-blue-800">Countdown active</div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-blue-900">
                    {formatDuration(remainingSec)}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelCountdown}
                    className="mt-3 rounded bg-white px-3 py-1.5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                  >
                    Cancel countdown
                  </button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No active countdown.</div>
              )}

              <div className="grid grid-cols-4 gap-2">
                {COUNTDOWN_PRESETS_SEC.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleStartCountdown(sec)}
                    className="rounded-lg border bg-gray-50 px-2 py-2 text-sm font-medium hover:bg-gray-100"
                  >
                    {formatPresetLabel(sec)}
                  </button>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <label className="flex-1 text-sm">
                  <span className="mb-1 block text-gray-600">Custom (minutes)</span>
                  <input
                    type="number"
                    min={0.1}
                    step={1}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCustomCountdown}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Start
                </button>
              </div>
            </div>
          )}

          {tab === "autooff" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Sticky setting: whenever the device is turned ON, it automatically turns OFF after this duration.
              </p>

              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                Current:{" "}
                <span className="font-medium">
                  {pulseSeconds > 0 ? formatDuration(pulseSeconds) : "Disabled"}
                </span>
              </div>

              <div className="flex items-end gap-2">
                <label className="flex-1 text-sm">
                  <span className="mb-1 block text-gray-600">Auto-off after (minutes)</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={autoOffMinutes}
                    onChange={(e) => setAutoOffMinutes(e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveAutoOff}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save
                </button>
              </div>

              <button
                type="button"
                onClick={handleDisableAutoOff}
                className="rounded px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Disable auto-off
              </button>
            </div>
          )}

          {tab === "schedule" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Clock-based schedules stored on the device (requires correct device time / NTP).
              </p>

              <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium">Schedules enabled</span>
                <button
                  type="button"
                  onClick={() => {
                    if (!ensureReady()) return;
                    setTimersEnabled(deviceKey, !device.timersEnabled);
                  }}
                  className={`rounded px-3 py-1 text-sm font-medium ${
                    device.timersEnabled
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {device.timersEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {device.timers.length === 0 && !editing && (
                <div className="text-sm text-gray-500">No schedules configured.</div>
              )}

              <ul className="space-y-2">
                {device.timers.map((timer) => (
                  <li
                    key={timer.index}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        Timer {timer.index}: {describeTimer(timer)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {timer.enable ? "Armed" : "Disarmed"}
                        {timer.repeat ? " · repeats" : " · once"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...timer })}
                        className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!ensureReady()) return;
                          clearScheduleTimer(deviceKey, timer.index);
                          toast.success(`Timer ${timer.index} cleared`);
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Clear
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {editing ? (
                <ScheduleEditor
                  timer={editing}
                  onChange={setEditing}
                  onCancel={() => setEditing(null)}
                  onSave={handleSaveSchedule}
                />
              ) : (
                <button
                  type="button"
                  disabled={nextTimerIndex == null}
                  onClick={() => {
                    if (nextTimerIndex == null) return;
                    setEditing(defaultScheduleTimer(nextTimerIndex));
                  }}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Add schedule
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ScheduleEditor({
  timer,
  onChange,
  onCancel,
  onSave,
}: {
  timer: TasmotaScheduleTimer;
  onChange: (t: TasmotaScheduleTimer) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
      <div className="text-sm font-semibold">Timer {timer.index}</div>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Time</span>
        <input
          type="time"
          value={timer.time.slice(0, 5)}
          onChange={(e) => onChange({ ...timer, time: e.target.value.slice(0, 5) })}
          className="w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-gray-600">Action</span>
        <select
          value={timer.action}
          onChange={(e) => onChange({ ...timer, action: Number(e.target.value) as TimerAction })}
          className="w-full rounded border px-3 py-2"
        >
          <option value={1}>Turn ON</option>
          <option value={0}>Turn OFF</option>
          <option value={2}>Toggle</option>
        </select>
      </label>

      <div>
        <div className="mb-1 text-sm text-gray-600">Days</div>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => {
            const active = isDayEnabled(timer.days, i);
            return (
              <button
                key={`${label}-${i}`}
                type="button"
                onClick={() => onChange({ ...timer, days: toggleDay(timer.days, i) })}
                className={`h-8 w-8 rounded text-xs font-semibold ${
                  active ? "bg-blue-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={timer.enable}
            onChange={(e) => onChange({ ...timer, enable: e.target.checked })}
          />
          Armed
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={timer.repeat}
            onChange={(e) => onChange({ ...timer, repeat: e.target.checked })}
          />
          Repeat weekly
        </label>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default TasmotaTimerDialog;
