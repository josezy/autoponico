---
name: configure-tasmota-device
description: >-
  Configure a freshly flashed Tasmota Sonoff over USB serial (Wi-Fi, MQTT,
  timezone, Basic R4 template), then register or update it in the webapp
  TASMOTA_DEVICES list. Use when the user runs /configure-tasmota-device,
  asks to configure Tasmota over serial, or set up a Sonoff after flashing.
disable-model-invocation: true
---

# Configure Tasmota device

Post-flash serial setup for Autoponico Sonoff / Tasmota devices, plus webapp registration so the dashboard shows the plug.

Repo paths (run from workspace root):

- Script: `scripts/configure-tasmota.py`
- Env (secrets, gitignored): `scripts/tasmota.env`
- Example env: `scripts/tasmota.env.example`
- Venv: `scripts/.venv` (`pip install -r scripts/requirements-tasmota.txt`)
- Webapp devices: `webapp/src/hooks/useMqtt.tsx` (`DeviceKey`, `TASMOTA_DEVICES`)

Prefer: `scripts/.venv/bin/python scripts/configure-tasmota.py …`  
Serial access needs full host permissions (not sandboxed).

## Prerequisite: normal boot after flash

Flashing leaves the chip in (or recently in) download/flash mode. **Configure only works after a normal Tasmota boot.**

Before discovery/configure:

1. Finish the web installer flash.
2. **Unplug USB, then plug back in** without holding the button (or power-cycle the same way).
3. Confirm the `tasmota-XXXX` AP appears (or the device is otherwise running firmware) — that means the serial console will answer `Status 0`.
4. Close Chrome’s install tab / any other serial monitor so the port is not busy.

If the user just flashed and did not re-plug, say so explicitly and stop until they do — do not keep probing as if no hardware exists.

## Workflow

Copy this checklist and track it:

```
- [ ] 0. Post-flash re-plug / normal boot (no flash button)
- [ ] 1. Ensure venv / pyserial
- [ ] 2. Discover compatible serial devices
- [ ] 3. Select port (prompt / auto / stop)
- [ ] 4. Validate scripts/tasmota.env
- [ ] 5. Run configure + verify on device
- [ ] 6. Register / update webapp TASMOTA_DEVICES
- [ ] 7. Report (do not commit unless user asks)
```

### 1. Ensure venv

If `scripts/.venv` is missing:

```bash
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/requirements-tasmota.txt
```

### 2. Discover compatible devices

```bash
scripts/.venv/bin/python scripts/configure-tasmota.py --list-compatible
```

Output is JSON array of probed USB-TTL ports that respond like Tasmota.

If empty, also run:

```bash
scripts/.venv/bin/python scripts/configure-tasmota.py --list-ports
```

- **0 compatible, but `--list-ports` shows a USB-TTL adapter** → hardware is present; Tasmota did not answer. Most common: **forgot to re-plug after flash** (still in flash/download mode), flash button held, or port busy (Chrome installer / serial monitor → `Resource busy`). Tell the user to re-plug without holding the button, close other serial users, retry.
- **0 compatible and no adapter in `--list-ports`** → cable/adapter/drivers; USB-TTL at 3.3V.
- **1 device** → use its `device` field as `--port` (say which port was auto-selected).
- **2+ devices** → if the user prompt already named a port path, use that if it appears in the list; otherwise **ask the user which port** (show `device` + `description`) and wait. Do not guess.

If the user already passed an explicit port in the prompt, skip discovery selection and use that port (still run configure against it).

### 3. Validate env

```bash
scripts/.venv/bin/python scripts/configure-tasmota.py --check-env scripts/tasmota.env
```

Requires non-empty: `TASMOTA_WIFI_SSID`, `TASMOTA_WIFI_PASSWORD`, `TASMOTA_MQTT_HOST`, `TASMOTA_TOPIC`.

- If file missing or `ok: false` → stop. Point to `scripts/tasmota.env.example` and list `problems`. Do not invent secrets.

Use from env (or prompt overrides):

| Env | Webapp field |
|-----|----------------|
| `TASMOTA_TOPIC` | `key` and `topic` (same kebab-case string) |
| `TASMOTA_FRIENDLY_NAME` | `name` (fallback: title-case topic) |

### 4. Configure device

```bash
scripts/.venv/bin/python scripts/configure-tasmota.py --env scripts/tasmota.env --port <PORT>
```

Do not print Wi-Fi passwords in chat (script redacts `Password1`).

If verification reports missing `Relay1` / Power error / template not `Sonoff Basic R4`, the GPIO template did not stick (dim LED, no Toggle). Re-run configure or apply template manually; the script re-checks Relay1 after Wi-Fi reboot.

Only proceed to webapp registration after serial configure **succeeds** (or the user confirms the device is already online with that topic).

### 5. Register / update webapp

Edit `webapp/src/hooks/useMqtt.tsx` so the dashboard lists the device.

**Source of truth:** `TASMOTA_DEVICES` and `DeviceKey`.

1. Read current `DeviceKey` and `TASMOTA_DEVICES`.
2. Resolve identity:
   - `key` / `topic` = `TASMOTA_TOPIC` (must match MQTT topic on the device)
   - `name` = `TASMOTA_FRIENDLY_NAME` or a sensible display name
3. **If `key` already exists** in `DeviceKey` / `TASMOTA_DEVICES`:
   - Update `name` and/or `topic` if they differ from env (keep one entry; do not duplicate).
   - If everything already matches, say so and skip the edit.
4. **If `key` is new**:
   - Add `'your-topic'` to the `DeviceKey` union.
   - Append `{ key, name, topic }` to `TASMOTA_DEVICES`.
5. **Tuya migration** (when moving a plug off Tuya):
   - Remove the same key from `webapp/src/components/SmartPlugControl.tsx` device list / `DeviceKey`.
   - Remove the key from `DEVICES` in `webapp/src/lib/tuya-api.ts`.
6. Optionally align docs that list MQTT topics (`README.md`, `agent/tasmota.md`) with the new set — keep brief.
7. `TasmotaPlugControl` already maps `TASMOTA_DEVICES`; no UI wiring beyond `useMqtt.tsx` unless something else hard-codes keys.

Do **not** invent topics; they must match `TASMOTA_TOPIC` / the device MQTT topic.

### 6. Report — do not commit

Summarize:

- Serial verify JSON (IP, MQTT, topic, timezone, template/relay).
- Webapp: **added** / **updated** / **unchanged**, with the `key` and file paths touched.

**Never create a git commit unless the user explicitly asks.** Leave changes unstaged/uncommitted for review. Do not push.

Exit codes from the serial script: `0` OK, `1` no compatible device, `2` env/settings, `3` multiple ports need `--port`, `4` verify failed.

## Safety

- Never flash/configure on mains AC; USB 3.3V only.
- Never commit `scripts/tasmota.env`.
- Never auto-commit webapp or skill-driven code changes.
- Details: [agent/tasmota.md](../../../agent/tasmota.md)
