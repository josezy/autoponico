# Caddy Camera Streaming Configuration

## Updated Configuration

The `caddy.json` file has been updated to include a reverse proxy for camera streaming.

## Steps to Complete Setup

### 1. Get Raspberry Pi Tailscale IP

After setting up your Raspberry Pi with Tailscale, get its IP:

```bash
# On your Raspberry Pi:
tailscale ip -4
```

You'll get an IP like: `100.x.x.x`

### 2. Update caddy.json

Replace `TAILSCALE_PI_IP` in `caddy.json` with your actual Tailscale IP:

```json
{
  "match": [{"host": ["cameras.tucanorobotics.co"]}],
  "handle": [{
    "handler": "reverse_proxy",
    "upstreams": [{"dial": "100.x.x.x:8555"}]  // <-- Replace with your Pi's Tailscale IP
  }]
}
```

### 3. Install Tailscale on rata

If not already installed:

```bash
# On rata server:
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --accept-routes
```

This allows rata to access devices on the Tailscale network.

### 4. Test Connectivity

From rata, test connection to Pi:

```bash
# Ping Pi via Tailscale
ping 100.x.x.x

# Test go2rtc API
curl http://100.x.x.x:8555/api/streams
```

You should see your configured camera streams.

### 5. DNS Configuration

Add DNS A record pointing to your rata server:
```
cameras.tucanorobotics.co  →  [rata public IP]
```

### 6. Reload Caddy

After updating the configuration:

```bash
# Validate configuration
caddy validate --config caddy.json

# Reload Caddy (graceful reload, no downtime)
caddy reload --config caddy.json

# Or restart if needed
sudo systemctl restart caddy
```

### 7. Test End-to-End

```bash
# From your local machine:
curl https://cameras.tucanorobotics.co/api/streams
```

You should see JSON response with camera streams.

## Configuration Notes

### Timeouts

The configuration sets read/write timeouts to 0 (infinite) because WebRTC connections need to stay open:

```json
"transport": {
  "protocol": "http",
  "read_timeout": 0,
  "write_timeout": 0
}
```

### HTTPS

Caddy automatically provisions Let's Encrypt certificates for `cameras.tucanorobotics.co`. Make sure:
- DNS is configured before starting Caddy
- Port 443 is open on rata
- Domain points to rata's public IP

## Testing WebRTC

Once everything is configured, test in browser:

```
https://cameras.tucanorobotics.co/
```

You should see the go2rtc web interface with your cameras listed.

To test a specific camera stream:
```
https://cameras.tucanorobotics.co/#camera1
```

## Security Considerations

Currently, the camera endpoint is **publicly accessible**. We'll add authentication in the next step (see webapp implementation).

Options for securing:
1. **Basic HTTP Auth via Caddy** (quick)
2. **JWT tokens from webapp** (better)
3. **IP whitelist** (if you have static IPs)

We'll implement option #2 with the webapp integration.

## Troubleshooting

### "Connection refused"

- Check Tailscale is running on both rata and Pi
- Verify Pi's Tailscale IP is correct in caddy.json
- Check go2rtc is running: `sudo systemctl status go2rtc`

### "502 Bad Gateway"

- go2rtc not running on Pi
- Firewall blocking port 8555
- Wrong Tailscale IP in configuration

### "Certificate error"

- DNS not pointing to rata
- Port 443 blocked
- Wait a few minutes for Let's Encrypt provisioning

### Check Caddy logs

```bash
sudo journalctl -u caddy -f
```
