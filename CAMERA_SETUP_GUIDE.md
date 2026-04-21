# 📹 Complete Camera Streaming Setup Guide

This guide will walk you through setting up live camera streaming from your V380 greenhouse cameras to your Autoponico webapp.

## 📋 Prerequisites

- ✅ V380 cameras with RTSP enabled (via ceshi.ini)
- ✅ Raspberry Pi 3 B+ (or newer) at greenhouse
- ✅ rata server (Vultr) with Caddy installed
- ✅ Cameras and Pi on same LAN
- ✅ Pi has internet access

## 🏗️ Architecture Overview

```
[V380 Cameras @ Greenhouse LAN]
        ↓ RTSP
[Raspberry Pi 3 B+]
  - go2rtc (RTSP → WebRTC converter)
  - Tailscale client
        ↓ Tailscale VPN (encrypted tunnel)
[rata @ Vultr]
  - Caddy (reverse proxy)
  - Tailscale client
        ↓ HTTPS
[Vercel Webapp]
  - React WebRTC player
        ↓
[User's Browser]
```

## 🚀 Setup Steps

### Step 1: Enable RTSP on V380 Cameras

For each camera:

1. Insert SD card into computer
2. Create file `ceshi.ini` in root directory:
   ```ini
   [CONST_PARAM]
   rtsp=1
   ```
3. Insert SD card back into camera
4. Reboot camera
5. Test RTSP (from Pi or computer on same network):
   ```bash
   ffmpeg -rtsp_transport tcp -i rtsp://admin:123456@192.168.1.101:554/live/ch00_1 -frames:v 1 test.jpg
   ```

### Step 2: Setup Raspberry Pi

1. **Flash Raspberry Pi OS** (64-bit recommended)
   - Download from: https://www.raspberrypi.com/software/
   - Flash to SD card using Raspberry Pi Imager
   - Enable SSH before first boot

2. **Copy setup script to Pi:**
   ```bash
   scp raspberry-pi/setup.sh pi@raspberrypi.local:~/
   ```

3. **SSH into Pi and run setup:**
   ```bash
   ssh pi@raspberrypi.local
   chmod +x setup.sh
   ./setup.sh
   ```

4. **Connect to Tailscale:**

   During setup, you'll be prompted to connect:
   ```bash
   sudo tailscale up
   ```

   Follow the link to authenticate in your browser. Save the Tailscale IP address shown.

5. **Configure cameras:**
   ```bash
   sudo nano /etc/go2rtc/go2rtc.yaml
   ```

   Update camera IPs, usernames, and passwords:
   ```yaml
   streams:
     camera1:
       - rtsp://admin:PASSWORD@192.168.1.101:554/live/ch00_1
     camera2:
       - rtsp://admin:PASSWORD@192.168.1.102:554/live/ch00_1
     camera3:
       - rtsp://admin:PASSWORD@192.168.1.103:554/live/ch00_1
   ```

6. **Start go2rtc:**
   ```bash
   sudo systemctl start go2rtc
   sudo systemctl status go2rtc
   ```

7. **Verify it's working:**
   ```bash
   curl http://localhost:8555/api/streams
   ```

   You should see your cameras listed.

### Step 3: Setup rata Server

1. **Install Tailscale on rata:**
   ```bash
   ssh your-user@rata.server.com
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up --accept-routes
   ```

2. **Test connectivity to Pi:**
   ```bash
   # Get Pi's Tailscale IP (from Step 2.4)
   ping 100.x.x.x
   curl http://100.x.x.x:8555/api/streams
   ```

3. **Update Caddy configuration:**

   Edit `caddy.json` and replace `TAILSCALE_PI_IP` with your Pi's actual Tailscale IP:
   ```json
   {
     "match": [{"host": ["cameras.tucanorobotics.co"]}],
     "handle": [{
       "handler": "reverse_proxy",
       "upstreams": [{"dial": "100.x.x.x:8555"}]
     }]
   }
   ```

4. **Configure DNS:**

   Add DNS A record:
   ```
   cameras.tucanorobotics.co  →  [rata public IP]
   ```

5. **Reload Caddy:**
   ```bash
   caddy validate --config caddy.json
   caddy reload --config caddy.json
   ```

6. **Test end-to-end:**
   ```bash
   curl https://cameras.tucanorobotics.co/api/streams
   ```

   You should see JSON with your camera streams.

### Step 4: Update Webapp (Vercel)

1. **Add environment variable:**

   In Vercel dashboard or `.env.local`:
   ```bash
   NEXT_PUBLIC_CAMERA_URL="https://cameras.tucanorobotics.co"
   ```

2. **Deploy webapp:**
   ```bash
   cd webapp
   npm run build
   # Or push to git if auto-deploy is configured
   ```

3. **Access cameras:**

   Navigate to: `https://autoponico-ws.tucanorobotics.co/cameras`

### Step 5: Add Authentication (Recommended)

See `CAMERA_AUTHENTICATION.md` for detailed options. Quick option:

1. **Generate password hash:**
   ```bash
   caddy hash-password
   ```

2. **Update Caddy** (see CAMERA_AUTHENTICATION.md for full config)

3. **Update webapp** to send auth headers

## ✅ Verification Checklist

- [ ] RTSP enabled on all cameras (test with ffmpeg)
- [ ] Raspberry Pi running and accessible via SSH
- [ ] go2rtc service running on Pi (`sudo systemctl status go2rtc`)
- [ ] Tailscale connected on both Pi and rata
- [ ] rata can access Pi via Tailscale (`ping 100.x.x.x`)
- [ ] Caddy configuration updated with correct Tailscale IP
- [ ] DNS pointing cameras.tucanorobotics.co to rata
- [ ] HTTPS certificate provisioned (check Caddy logs)
- [ ] Webapp shows cameras page with camera list
- [ ] Clicking play button shows live video

## 🔧 Troubleshooting

### Camera won't connect

**Check camera RTSP:**
```bash
# From Pi:
ffmpeg -rtsp_transport tcp -i rtsp://admin:PASSWORD@192.168.1.101:554/live/ch00_1 -frames:v 1 test.jpg
```

If this fails:
- Verify camera IP address
- Check camera username/password
- Ensure ceshi.ini is created correctly
- Reboot camera

### go2rtc not starting

**Check logs:**
```bash
sudo journalctl -u go2rtc -n 50
```

Common issues:
- Wrong camera credentials in go2rtc.yaml
- Camera not accessible from Pi (network issue)
- Port 8555 already in use

### Tailscale connection issues

**Check Tailscale status:**
```bash
# On Pi:
tailscale status

# On rata:
tailscale status
```

Both should show "logged in" and list each other.

### Caddy proxy not working

**Check Caddy logs:**
```bash
sudo journalctl -u caddy -f
```

Common issues:
- Wrong Tailscale IP in caddy.json
- DNS not propagated yet (wait 5-10 minutes)
- Certificate provisioning failed (check port 443 is open)

### WebRTC connection fails in browser

**Check browser console:**
- Look for CORS errors
- Check network tab for failed API calls
- Verify camera URL in environment variables

**Common fixes:**
- Clear browser cache
- Check HTTPS certificate is valid
- Ensure go2rtc is running on Pi
- Verify rata can reach Pi via Tailscale

## 📊 Performance Notes

**Raspberry Pi 3 B+ can handle:**
- 1-2 cameras simultaneously: Excellent performance
- 3 cameras simultaneously: Good performance
- 5 cameras simultaneously: May experience stuttering

**Bandwidth requirements:**
- Per camera: ~2-4 Mbps
- 3 cameras: ~6-12 Mbps upload needed from greenhouse

**Important:** Streams only consume bandwidth when actively being viewed. Idle usage is minimal.

## 🔐 Security Recommendations

1. **Enable authentication** (see CAMERA_AUTHENTICATION.md)
2. **Use Tailscale ACLs** to restrict access
3. **Change default camera passwords**
4. **Monitor Caddy logs** for suspicious activity
5. **Keep software updated:**
   ```bash
   # On Pi:
   sudo apt update && sudo apt upgrade

   # Update go2rtc manually when new versions release
   ```

## 📱 Mobile Access

The webapp is responsive and works on mobile browsers. Simply navigate to:
```
https://autoponico-ws.tucanorobotics.co/cameras
```

WebRTC works on:
- ✅ Chrome/Safari on iOS
- ✅ Chrome on Android
- ✅ Desktop browsers

## 🎯 Next Steps

1. ✅ Complete basic setup following this guide
2. ✅ Test with one camera first, then add more
3. ✅ Add authentication (see CAMERA_AUTHENTICATION.md)
4. Consider adding:
   - Motion detection notifications
   - Recording/timelapse functionality
   - Camera PTZ controls (if supported)
   - Snapshot archive

## 📚 Related Documentation

- `raspberry-pi/README.md` - Detailed Pi setup instructions
- `CADDY_CAMERA_SETUP.md` - Caddy configuration details
- `CAMERA_AUTHENTICATION.md` - Security options
- `go2rtc.yaml.example` - Camera configuration examples

## 🆘 Getting Help

If you encounter issues:

1. Check logs on all components (Pi, rata, browser console)
2. Verify network connectivity at each step
3. Test each layer independently (RTSP → go2rtc → Tailscale → Caddy → webapp)
4. Refer to troubleshooting section above

## 🎉 Success!

Once everything is working, you'll have:
- ✅ Live camera streaming from greenhouse
- ✅ Secure access via HTTPS
- ✅ Low latency WebRTC video
- ✅ Accessible from anywhere
- ✅ Minimal bandwidth when not viewing

Enjoy monitoring your greenhouse! 🌱📹
