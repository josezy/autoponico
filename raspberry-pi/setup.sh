#!/bin/bash

# Raspberry Pi Camera Streaming Setup Script
# For Raspberry Pi 3 B+ running Raspberry Pi OS
# This script installs Tailscale and go2rtc for V380 camera streaming

set -e

echo "================================"
echo "Autoponico Camera Streaming Setup"
echo "================================"
echo ""

# Update system
echo "[1/6] Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install dependencies
echo "[2/6] Installing dependencies..."
sudo apt-get install -y curl wget

# Install Tailscale
echo "[3/6] Installing Tailscale..."
if ! command -v tailscale &> /dev/null; then
    curl -fsSL https://tailscale.com/install.sh | sh
    echo "Tailscale installed successfully"
else
    echo "Tailscale already installed"
fi

# Connect to Tailscale
echo ""
echo "To connect to Tailscale, run:"
echo "  sudo tailscale up"
echo ""
read -p "Press enter to continue once connected to Tailscale..."

# Install go2rtc
echo "[4/6] Installing go2rtc..."
GO2RTC_VERSION="1.9.13"
ARCH="arm64"

# Detect architecture
if uname -m | grep -q "armv7"; then
    ARCH="arm"
elif uname -m | grep -q "aarch64"; then
    ARCH="arm64"
fi

wget -O go2rtc "https://github.com/AlexxIT/go2rtc/releases/download/v${GO2RTC_VERSION}/go2rtc_linux_${ARCH}"
chmod +x go2rtc
sudo mv go2rtc /usr/local/bin/

# Create go2rtc directory
sudo mkdir -p /etc/go2rtc
sudo chown $USER:$USER /etc/go2rtc

# Create go2rtc configuration
echo "[5/6] Creating go2rtc configuration..."
cat > /etc/go2rtc/go2rtc.yaml << 'EOF'
# go2rtc configuration for V380 cameras
streams:
  camera1:
    - rtsp://admin:123456@192.168.1.101:554/live/ch00_1
  camera2:
    - rtsp://admin:123456@192.168.1.102:554/live/ch00_1
  camera3:
    - rtsp://admin:123456@192.168.1.103:554/live/ch00_1

api:
  listen: ":8555"

webrtc:
  listen: ":8555"
  candidates:
    - stun:8555

log:
  level: info
EOF

echo ""
echo "IMPORTANT: Update /etc/go2rtc/go2rtc.yaml with your actual camera IPs and credentials"
echo ""

# Install PTZ proxy
echo "[6/6] Installing PTZ proxy..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
sudo cp "$SCRIPT_DIR/ptz-proxy.py" /etc/go2rtc/ptz-proxy.py

# Create systemd service for PTZ proxy
sudo tee /etc/systemd/system/ptz-proxy.service > /dev/null << EOF
[Unit]
Description=ONVIF PTZ Proxy for V380 Camera
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /etc/go2rtc/ptz-proxy.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for go2rtc
echo "Creating systemd service..."
sudo tee /etc/systemd/system/go2rtc.service > /dev/null << EOF
[Unit]
Description=go2rtc camera streaming service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/etc/go2rtc
ExecStart=/usr/local/bin/go2rtc -config /etc/go2rtc/go2rtc.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
sudo systemctl daemon-reload
sudo systemctl enable go2rtc.service
sudo systemctl enable ptz-proxy.service

echo ""
echo "================================"
echo "Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Edit /etc/go2rtc/go2rtc.yaml with your camera IPs and credentials"
echo "2. Start services: sudo systemctl start go2rtc ptz-proxy"
echo "3. Check status: sudo systemctl status go2rtc ptz-proxy"
echo "4. View logs: sudo journalctl -u go2rtc -f"
echo ""
echo "Note: PTZ proxy reads each camera IP from go2rtc.yaml via ?src=cameraN"
echo ""
echo "Your Tailscale IP:"
tailscale ip -4
echo ""
echo "Use this IP in your Caddy configuration on rata"
echo ""
