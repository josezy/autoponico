# Agent notes

Cross-tool entrypoint for coding agents working in this repo.

## Repo map

| Path | Role |
|------|------|
| `webapp/` | Next.js dashboard (Vercel) |
| `ws-server/` | WebSocket + MQTT bridge (runs on `rata`) |
| `raspberry-pi/` | go2rtc + ONVIF PTZ proxy (runs on `greenhouse`) |
| `arduino/` | ESP32 firmware |
| `caddy.json` | Caddy routes on `rata` (source of truth in git) |
| `agent/` | Longer ops/reference docs for agents |

## Before changing deploy/runtime

Read **[agent/infrastructure.md](agent/infrastructure.md)** for hosts, services, clone paths, and how to update them via git (not one-off file copies).

## Defaults

- Prefer editing files in git, then `git pull` on hosts and restart/reload the affected service.
- Do not commit secrets (camera RTSP credentials live in `/etc/go2rtc/go2rtc.yaml` on the Pi, not in the example yaml).
- Do not hand-edit production configs on hosts when the same file exists in this repo.
