/** Helpers for Tasmota TimedPower / PulseTime / Timer MQTT APIs. */

export type TimerAction = 0 | 1 | 2; // OFF | ON | TOGGLE

export interface TasmotaScheduleTimer {
  index: number;
  enable: boolean;
  mode: number;
  time: string;
  window: number;
  days: string;
  repeat: boolean;
  output: number;
  action: TimerAction;
}

export const EMPTY_DAYS = '-------';
export const ALL_DAYS = 'SMTWTFS';
export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const COUNTDOWN_PRESETS_SEC = [60, 300, 900, 1800] as const;

/** Encode seconds into Tasmota PulseTime units. */
export function secondsToPulseTime(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < 11.2) return Math.max(1, Math.round(seconds * 10));
  return Math.round(seconds) + 100;
}

/** Decode Tasmota PulseTime units to seconds. */
export function pulseTimeToSeconds(pulseTime: number): number {
  if (pulseTime <= 0) return 0;
  if (pulseTime <= 111) return pulseTime / 10;
  return pulseTime - 100;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatPresetLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return formatDuration(seconds);
}

export function parseTimerPayload(index: number, raw: unknown): TasmotaScheduleTimer | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const time = typeof t.Time === 'string' ? t.Time.slice(0, 5) : '00:00';
  const daysRaw = typeof t.Days === 'string' ? t.Days : EMPTY_DAYS;
  const days = daysRaw.length === 7 ? daysRaw : EMPTY_DAYS;
  const actionRaw = Number(t.Action);
  const action = (actionRaw === 0 || actionRaw === 1 || actionRaw === 2 ? actionRaw : 0) as TimerAction;

  return {
    index,
    enable: Number(t.Enable) === 1,
    mode: Number(t.Mode) || 0,
    time,
    window: Number(t.Window) || 0,
    days,
    repeat: Number(t.Repeat) === 1,
    output: Number(t.Output) || 1,
    action,
  };
}

export function timerToPayload(timer: Omit<TasmotaScheduleTimer, 'index'>): string {
  return JSON.stringify({
    Enable: timer.enable ? 1 : 0,
    Mode: timer.mode,
    Time: timer.time,
    Window: timer.window,
    Days: timer.days,
    Repeat: timer.repeat ? 1 : 0,
    Output: timer.output,
    Action: timer.action,
  });
}

export function toggleDay(days: string, dayIndex: number): string {
  const chars = days.padEnd(7, '-').slice(0, 7).split('');
  const on = chars[dayIndex] !== '0' && chars[dayIndex] !== '-';
  chars[dayIndex] = on ? '-' : ALL_DAYS[dayIndex];
  return chars.join('');
}

export function isDayEnabled(days: string, dayIndex: number): boolean {
  const c = days[dayIndex];
  return !!c && c !== '0' && c !== '-';
}

export function describeTimer(timer: TasmotaScheduleTimer): string {
  const action = timer.action === 1 ? 'ON' : timer.action === 0 ? 'OFF' : 'TOGGLE';
  const days = DAY_LABELS.map((label, i) => (isDayEnabled(timer.days, i) ? label : '·')).join('');
  return `${timer.time} → ${action} (${days})`;
}

export function defaultScheduleTimer(index: number): TasmotaScheduleTimer {
  return {
    index,
    enable: true,
    mode: 0,
    time: '08:00',
    window: 0,
    days: ALL_DAYS,
    repeat: true,
    output: 1,
    action: 1,
  };
}
