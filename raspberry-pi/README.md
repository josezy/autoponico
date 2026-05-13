# Raspberry Pi Camera Streaming Setup

This directory contains setup scripts and configuration for streaming V380 cameras from your greenhouse using a Raspberry Pi 3 B+.

## Architecture

```
[V380 Cameras] --RTSP--> [Raspberry Pi + go2rtc] <--Tailscale--> [rata + Caddy] --HTTPS--> [Vercel Webapp]
```

## Hardware Requirements

- Raspberry Pi 3 B+ (or newer)
- MicroSD card (8GB+)
- Power supply
- Ethernet cable (recommended) or WiFi

## Setup Instructions

### 1. Prepare Raspberry Pi

1. Flash Raspberry Pi OS (64-bit recommended) to SD card
2. Enable SSH before first boot:
   - Create empty file named `ssh` in boot partition
3. Boot Pi and SSH in:
   ```bash
   ssh pi@raspberrypi.local
   ```

### 2. Run Setup Script

```bash
# Copy setup.sh to your Pi
scp setup.sh pi@raspberrypi.local:~/

# SSH into Pi and run setup
ssh pi@raspberrypi.local
chmod +x setup.sh
./setup.sh
```

### 3. Configure Tailscale

During setup, you'll be prompted to connect to Tailscale:

```bash
sudo tailscale up
```

Follow the link to authenticate. Save your Tailscale IP address for later.

### 4. Configure Cameras

Edit the go2rtc configuration with your actual camera IPs and credentials:

```bash
sudo nano /etc/go2rtc/go2rtc.yaml
```

Update the RTSP URLs:
- Change IP addresses (192.168.1.101, etc.)
- Change username/password (admin:123456)
- Add or remove camera streams as needed

### 5. Start go2rtc Service

```bash
sudo systemctl start go2rtc
sudo systemctl status go2rtc
```

Check logs:
```bash
sudo journalctl -u go2rtc -f
```

### 6. Test Locally

From your Pi, test the streams:

```bash
# Get your Tailscale IP
tailscale ip -4

# Test in browser (from another device on Tailscale)
# http://[TAILSCALE_IP]:8555
```

## Troubleshooting

### go2rtc won't start

Check logs:
```bash
sudo journalctl -u go2rtc -n 50
```

Common issues:
- Wrong camera IP/credentials
- Camera not accessible from Pi (check network)
- Port 8555 already in use

### Camera connection issues

Test RTSP connection directly:
```bash
sudo apt-get install ffmpeg
ffmpeg -rtsp_transport tcp -i rtsp://admin:123456@192.168.1.101:554/live/ch00_1 -frames:v 1 test.jpg
```

### Check ceshi.ini on cameras

Make sure you've enabled RTSP on your V380 cameras:
1. Create file `ceshi.ini` on camera's SD card
2. Content:
   ```ini
   [CONST_PARAM]
   rtsp=1
   ```
3. Restart camera

## Maintenance

### Update go2rtc

```bash
# Download latest version
wget -O go2rtc https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_arm64
chmod +x go2rtc
sudo mv go2rtc /usr/local/bin/

# Restart service
sudo systemctl restart go2rtc
```

### View logs

```bash
# Follow logs in real-time
sudo journalctl -u go2rtc -f

# View last 100 lines
sudo journalctl -u go2rtc -n 100
```

### Restart service

```bash
sudo systemctl restart go2rtc
```

## Performance Notes

Raspberry Pi 3 B+ can handle:
- ✅ 1-2 cameras simultaneously: Excellent
- ✅ 3 cameras simultaneously: Good
- ⚠️ 5 cameras simultaneously: May stutter

go2rtc only processes streams when someone is actively viewing them, so idle CPU/bandwidth usage is minimal.

## Next Steps

After Pi setup is complete:
1. Configure Caddy on rata (see main project docs)
2. Update webapp to include camera viewer component
3. Add authentication
