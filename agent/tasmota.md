# Tasmota / Sonoff Basic R4

Flash and MQTT setup for Sonoff devices used by the Autoponico dashboard.

Device reference: [templates.blakadder.com/sonoff_BASICR4.html](https://templates.blakadder.com/sonoff_BASICR4.html)  
Chip: **ESP32-C3** (not ESP8266 — do not use Tasmotizer).

## Safety

- **Never** flash while the Sonoff is connected to mains AC.
- Power only from the USB-TTL adapter’s **3.3V**.
- The Basic R4 has no isolation transformer; the serial header is only safe when the device is **not** on AC.

## Hardware

- Sonoff Basic R4
- USB-TTL adapter set to **3.3V** (CH340 recommended)
- 4 Dupont jumpers
- Computer with **Chrome or Edge** (Web Serial required)

## Serial wiring

Open the case (4 plastic tabs). Connect:

| Sonoff Basic R4 | USB-TTL |
| --- | --- |
| VCC / 3.3V | 3.3V |
| GND | GND |
| RX | TX |
| TX | RX |

Cross RX/TX. Confirm the adapter is **3.3V**, not 5V.

## Enter flash mode

1. Hold the onboard button (GPIO9 / Button1).
2. Plug USB-TTL into the computer while still holding the button.
3. Hold ~2–3 seconds, then release.

## Flash with Web Installer

1. Open [https://tasmota.github.io/install/](https://tasmota.github.io/install/) in Chrome/Edge.
2. Set **Flash Speed** to **115200 Baud** — higher baud rates failed on this hardware; 115200 is the known-good setting.
3. Select firmware **`tasmota32c3`** (ESP32-C3), not plain `tasmota` / ESP8266.
4. Click **Install** → pick the correct serial port.
5. Allow erase + flash (~few minutes), then reboot / power-cycle.

## First Wi-Fi config

1. Connect a phone/laptop to the Tasmota AP (`tasmota-XXXX`).
2. Open `http://192.168.4.1` and enter LAN Wi-Fi credentials.
3. Device joins DHCP; use its LAN IP for the rest of setup.

## Module template

Go to Configuration → Configure Other → paste the template → check Activate → Save.

```
{"NAME":"Sonoff Basic R4","GPIO":[0,0,0,0,224,0,544,0,0,32,0,0,0,0,0,0,0,0,0,0,0,0],"FLAG":0,"BASE":1}
```

GPIO: Relay1 = GPIO4, LedLink = GPIO6, Button1 = GPIO9.

## MQTT (Autoponico)

`http://<device-ip>/mq`:

| Setting | Value |
| --- | --- |
| Host | IP of `rata` (ws-server MQTT broker) |
| Port | `1883` |
| Topic | Must match a key in `TASMOTA_DEVICES` in `webapp/src/hooks/useMqtt.tsx` |
| Full Topic | `%prefix%/%topic%/` |

Current Tasmota topics: `valvula-tanque`, `main-pump`.

Dashboard timer features (MQTT): TimedPower, PulseTime, Timer1–16 (device NTP/time must be correct for schedules).

## Troubleshooting

- **Flash fails / times out**: use **115200** baud; re-enter flash mode (hold button before applying USB power); check 3.3V and crossed RX/TX.
- **No serial port**: install USB-TTL drivers; try another cable/port.
- **Wrong firmware**: must be `tasmota32c3`.
- **Relay/button wrong**: re-apply template.
