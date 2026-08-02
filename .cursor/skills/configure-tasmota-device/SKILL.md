---
name: configure-tasmota-device
description: >-
  Configure a freshly flashed Tasmota Sonoff over USB serial (Wi-Fi, MQTT,
  timezone, Basic R4 template) using scripts/configure-tasmota.py. Use when
  the user runs /configure-tasmota-device, asks to configure Tasmota over
  serial, or set up a Sonoff after flashing.
disable-model-invocation: true
---

# Configure Tasmota device

Post-flash serial setup for Autoponico Sonoff / Tasmota devices.

Repo paths (run from workspace root):

- Script: `scripts/configure-tasmota.py`
- Env (secrets, gitignored): `scripts/tasmota.env`
- Example env: `scripts/tasmota.env.example`
- Venv: `scripts/.venv` (`pip install -r scripts/requirements-tasmota.txt`)

Prefer: `scripts/.venv/bin/python scripts/configure-tasmota.py …`  
Serial access needs full host permissions (not sandboxed).

## Workflow

Copy this checklist and track it:

```
- [ ] 1. Ensure venv / pyserial
- [ ] 2. Discover compatible serial devices
- [ ] 3. Select port (prompt / auto / stop)
- [ ] 4. Validate scripts/tasmota.env
- [ ] 5. Run configure
- [ ] 6. Verify JSON result and report
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

- **0 devices** → stop. Tell the user no valid Tasmota serial devices were found. Remind: USB-TTL at 3.3V, normal boot (not flash-button), drivers installed.
- **1 device** → use its `device` field as `--port` (say which port was auto-selected).
- **2+ devices** → if the user prompt already named a port path, use that if it appears in the list; otherwise **ask the user which port** (show `device` + `description`) and wait. Do not guess.

If the user already passed an explicit port in the prompt, skip discovery selection and use that port (still run configure against it).

### 3. Validate env

```bash
scripts/.venv/bin/python scripts/configure-tasmota.py --check-env scripts/tasmota.env
```

Requires non-empty: `TASMOTA_WIFI_SSID`, `TASMOTA_WIFI_PASSWORD`, `TASMOTA_MQTT_HOST`, `TASMOTA_TOPIC`.

- If file missing or `ok: false` → stop. Point to `scripts/tasmota.env.example` and list `problems`. Do not invent secrets.

### 4. Configure

```bash
scripts/.venv/bin/python scripts/configure-tasmota.py --env scripts/tasmota.env --port <PORT>
```

Do not print Wi-Fi passwords in chat (script redacts `Password1`).

If verification reports missing `Relay1` / Power error / template not `Sonoff Basic R4`, the GPIO template did not stick (dim LED, no Toggle). Re-run configure or apply template manually; the script now re-checks Relay1 after Wi-Fi reboot.

### 5. Report

The script prints a final verification JSON (`ok`, `wifi_ip`, `mqtt_connected`, `topic`, `timezone`, `local_time`, `errors`).

Summarize for the user:

- Success: device name, LAN IP, MQTT topic, timezone/local time, MQTT connected.
- Failure: exit code + `errors`; suggest re-seat USB, re-run, or check `rata` MQTT / Wi-Fi.

Exit codes: `0` OK, `1` no compatible device, `2` env/settings, `3` multiple ports need `--port`, `4` verify failed.

## Safety

- Never flash/configure on mains AC; USB 3.3V only.
- Never commit `scripts/tasmota.env`.
- Details: [agent/tasmota.md](../../../agent/tasmota.md)
