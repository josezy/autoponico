# 📹 Camera Streaming Implementation

This document provides an overview of the camera streaming feature added to the Autoponico project.

## Overview

The implementation allows you to stream live video from V380 cameras in your greenhouse to the web application using WebRTC for low-latency viewing.

## Quick Start

1. **Setup Raspberry Pi** at greenhouse:
   ```bash
   cd raspberry-pi
   ./setup.sh
   ```

2. **Configure cameras** in `/etc/go2rtc/go2rtc.yaml`

3. **Update Caddy** on rata server with Pi's Tailscale IP

4. **Access cameras** at: https://autoponico-ws.tucanorobotics.co/cameras

## Architecture

```
V380 Cameras → Raspberry Pi (go2rtc) → Tailscale VPN → rata (Caddy) → Vercel Webapp
```

## Files Created

### Raspberry Pi Setup
- `raspberry-pi/setup.sh` - Automated Pi setup script
- `raspberry-pi/go2rtc.yaml.example` - Camera configuration template
- `raspberry-pi/README.md` - Detailed Pi setup instructions

### Server Configuration
- `caddy.json` - Updated with camera proxy route
- `CADDY_CAMERA_SETUP.md` - Caddy configuration guide

### Webapp Components
- `webapp/src/components/CameraPlayer.tsx` - WebRTC video player component
- `webapp/src/components/Navigation.tsx` - Navigation bar with cameras link
- `webapp/src/app/cameras/page.tsx` - Camera grid view page
- `webapp/src/app/layout.tsx` - Updated with navigation

### Documentation
- `CAMERA_SETUP_GUIDE.md` - Complete step-by-step setup guide
- `CAMERA_AUTHENTICATION.md` - Security and authentication options
- `README_CAMERAS.md` - This file

## Technology Stack

- **go2rtc**: RTSP to WebRTC converter (runs on Pi)
- **Tailscale**: Secure VPN mesh network
- **Caddy**: Reverse proxy with automatic HTTPS
- **WebRTC**: Browser-native real-time video streaming
- **React**: Frontend video player components

## Key Features

✅ Live low-latency video streaming (~200ms)
✅ On-demand streaming (only uses bandwidth when viewing)
✅ Multiple camera support (3-5 cameras on Pi 3 B+)
✅ Responsive web interface
✅ Secure Tailscale VPN tunnel
✅ HTTPS with automatic certificates
✅ Click-to-play interface (saves bandwidth)
✅ Full-screen single camera view
✅ Grid view for multiple cameras

## Performance

**Raspberry Pi 3 B+:**
- 1-2 cameras: Excellent
- 3 cameras: Good
- 5 cameras: May stutter with all viewing simultaneously

**Latency:** ~200-500ms (acceptable for monitoring)

**Bandwidth:** ~2-4 Mbps per camera (only when viewing)

## Security

Multiple security options available:

1. **Tailscale VPN** - Network-level encryption (implemented)
2. **HTTP Basic Auth** - Simple password protection (optional)
3. **Tailscale ACLs** - Device-level access control (optional)
4. **JWT tokens** - Advanced multi-user auth (future)

See `CAMERA_AUTHENTICATION.md` for details.

## Configuration

### Camera IDs

Camera IDs in webapp must match go2rtc configuration:

**In `/etc/go2rtc/go2rtc.yaml` on Pi:**
```yaml
streams:
  camera1:
    - rtsp://admin:123456@192.168.1.101:554/live/ch00_1
```

**In `webapp/src/app/cameras/page.tsx`:**
```typescript
const DEFAULT_CAMERAS = [
  { id: 'camera1', name: 'Greenhouse - North', enabled: true },
];
```

### Environment Variables

**Webapp (`.env.local`):**
```bash
NEXT_PUBLIC_CAMERA_URL="https://cameras.tucanorobotics.co"
```

**Caddy (`caddy.json`):**
- Replace `TAILSCALE_PI_IP` with actual Pi Tailscale IP

## Maintenance

### Update go2rtc

```bash
# On Pi:
wget https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_arm64
chmod +x go2rtc_linux_arm64
sudo mv go2rtc_linux_arm64 /usr/local/bin/go2rtc
sudo systemctl restart go2rtc
```

### View Logs

```bash
# Pi - go2rtc logs:
sudo journalctl -u go2rtc -f

# rata - Caddy logs:
sudo journalctl -u caddy -f

# Browser - Developer console:
F12 → Console tab
```

### Restart Services

```bash
# On Pi:
sudo systemctl restart go2rtc

# On rata:
sudo systemctl reload caddy
```

## Troubleshooting

See `CAMERA_SETUP_GUIDE.md` for detailed troubleshooting steps.

**Quick checks:**
1. Is go2rtc running? `sudo systemctl status go2rtc`
2. Can Pi reach cameras? `ping 192.168.1.101`
3. Is Tailscale connected? `tailscale status`
4. Can rata reach Pi? `curl http://TAILSCALE_IP:8555/api/streams`
5. Is DNS configured? `dig cameras.tucanorobotics.co`

## Future Enhancements

Potential features to add:

- [ ] Motion detection alerts
- [ ] Video recording/archive
- [ ] Timelapse generation
- [ ] PTZ camera controls
- [ ] Snapshot scheduling
- [ ] Multi-user access with roles
- [ ] Camera grouping/layouts
- [ ] Mobile app (PWA)

## Support

For issues or questions:
1. Check the troubleshooting section in `CAMERA_SETUP_GUIDE.md`
2. Review logs on Pi, rata, and browser console
3. Verify each component independently

## License

Part of the Autoponico project.
