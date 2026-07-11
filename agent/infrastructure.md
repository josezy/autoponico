# Deployment infrastructure

Last verified: 2026-07-11 against live `rata` and `greenhouse`.

## Architecture

```text
V380 cameras (LAN)
    │ RTSP
    ▼
greenhouse (Raspberry Pi)
    ├── go2rtc        :8555  (streams)
    └── ptz-proxy     :8556  (ONVIF PTZ)
    │
    │ Tailscale
    ▼
rata (edge VPS)
    ├── Caddy         :80/:443  (TLS + reverse proxy)
    ├── ws-server     :3000     (WebSocket / MQTT bridge)
    └── InfluxDB      :8086
    │
    ▼
Public HTTPS
    ├── cameras.tucanorobotics.co      → greenhouse go2rtc / ptz-proxy
    ├── autoponico-ws.tucanorobotics.co → localhost:3000
    └── influxdb.tucanorobotics.co      → localhost:8086

webapp/ → Vercel (talks to cameras + ws over those public hosts)
```

SSH aliases (local `~/.ssh/config`): `rata`, `greenhouse`.

## Hosts

### `rata` — edge / Caddy / ws-server

| Item | Value |
|------|--------|
| Git clone | `/root/autoponico` (track `origin/main`) |
| Caddy | snap service `snap.caddy.server` |
| Active Caddy config | `/var/snap/caddy/common/caddy.json` |
| Repo Caddy file | `/root/autoponico/caddy.json` |
| `/etc/caddy.json` | symlink → `/root/autoponico/caddy.json` |
| ws-server | `/root/autoponico/ws-server` (historically `nodemon`/`ts-node main.ts` in a long-lived shell) |

**Camera routes in Caddy** (from `caddy.json`):

- `cameras.tucanorobotics.co/ptz` → Tailscale Pi `100.66.228.7:8556` (ptz-proxy)
- `cameras.tucanorobotics.co/*` → `100.66.228.7:8555` (go2rtc)

Confirm the Pi Tailscale IP still matches before changing dial addresses.

### `greenhouse` — cameras

| Item | Value |
|------|--------|
| Git clone | `/home/pi/autoponico` (track `origin/main`) |
| go2rtc config (live, secrets) | `/etc/go2rtc/go2rtc.yaml` |
| go2rtc binary/service | systemd `go2rtc` |
| PTZ proxy | systemd `ptz-proxy` |
| PTZ ExecStart | `/usr/bin/python3 /home/pi/autoponico/raspberry-pi/ptz-proxy.py` |

`raspberry-pi/go2rtc.yaml.example` is documentation only. Never overwrite `/etc/go2rtc/go2rtc.yaml` from the example without merging real IPs/credentials.

Stream names used by the webapp: `camera1` (Cannabis), `camera2` (Arándanos). PTZ requests must include `?src=cameraN`.

### Vercel — webapp

Deployed from `webapp/`. Camera UI uses go2rtc `stream.html` iframes and same-origin `/api/camera-proxy` for PTZ/snapshots.

## Deploy checklists

Prefer **git pull + service reload** over `scp` of individual files.

### After merging to `main`

**rata**

```bash
ssh rata
cd /root/autoponico
git fetch origin
git reset --hard origin/main   # keep clone clean; don't leave hand-edited caddy.json
cp /root/autoponico/caddy.json /var/snap/caddy/common/caddy.json
caddy reload --config /var/snap/caddy/common/caddy.json
# Restart ws-server only if ws-server/ changed (see process/session that runs it)
```

**greenhouse**

```bash
ssh greenhouse
cd /home/pi/autoponico
git fetch origin
git reset --hard origin/main
sudo systemctl restart ptz-proxy   # if raspberry-pi/ptz-proxy.py changed
# sudo systemctl restart go2rtc    # only if go2rtc install/config packaging changed
```

**webapp**

- Ship via the normal Vercel/git deploy path for `webapp/`.

### Health checks

```bash
# greenhouse
ssh greenhouse 'systemctl is-active go2rtc ptz-proxy; sudo systemctl status ptz-proxy --no-pager | head -20'

# rata
ssh rata 'systemctl is-active snap.caddy.server.service; cd /root/autoponico && git status -sb'
```

## What not to do

- Do not leave production hosts with dirty working trees that diverge from `main`.
- Do not `scp` `ptz-proxy.py` onto the Pi as the primary deploy path — the unit already runs from the clone.
- Do not edit only `/var/snap/caddy/common/caddy.json` without updating git `caddy.json` (and vice versa after pull).
- Do not commit live camera passwords from `/etc/go2rtc/go2rtc.yaml`.

## Related paths in repo

| Path | Purpose |
|------|---------|
| `caddy.json` | Public reverse-proxy routes |
| `raspberry-pi/ptz-proxy.py` | Multi-camera ONVIF PTZ (`src` query param) |
| `raspberry-pi/setup.sh` | Initial Pi install (go2rtc + ptz-proxy units) |
| `webapp/src/components/CameraPlayer.tsx` | Stream iframe + PTZ client |
| `webapp/src/app/api/camera-proxy/` | Same-origin proxy to cameras host |
