# Camera Streaming Authentication

Currently, the camera endpoint is publicly accessible. Here are several options to secure it:

## Option 1: Basic HTTP Auth via Caddy (Simplest) ⭐

Add HTTP Basic Authentication directly in Caddy. This is the quickest way to secure your cameras.

### Steps:

1. **Generate password hash:**

```bash
# On rata server:
caddy hash-password
# Enter your desired password when prompted
# Copy the output hash
```

2. **Update caddy.json:**

Replace the camera route in `caddy.json` with:

```json
{
  "match": [{"host": ["cameras.tucanorobotics.co"]}],
  "handle": [
    {
      "handler": "authentication",
      "providers": {
        "http_basic": {
          "accounts": [
            {
              "username": "admin",
              "password": "PASTE_HASH_HERE"
            }
          ]
        }
      }
    },
    {
      "handler": "reverse_proxy",
      "upstreams": [{"dial": "TAILSCALE_PI_IP:8555"}],
      "transport": {
        "protocol": "http",
        "read_timeout": 0,
        "write_timeout": 0
      }
    }
  ]
}
```

3. **Reload Caddy:**

```bash
caddy reload --config caddy.json
```

4. **Update CameraPlayer component:**

Modify `webapp/src/components/CameraPlayer.tsx` to include auth headers:

```typescript
// Add this at the top of the component
const CAMERA_AUTH = btoa('admin:your-password'); // Base64 encode username:password

// Update the fetch call in startStream():
const response = await fetch(`${CAMERA_BASE_URL}/api/webrtc?src=${cameraId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${CAMERA_AUTH}`  // Add this line
  },
  body: offer.sdp
});
```

5. **Add credentials to environment:**

Update `.env.local`:
```bash
NEXT_PUBLIC_CAMERA_AUTH_USER="admin"
NEXT_PUBLIC_CAMERA_AUTH_PASS="your-password"
```

Update component to use env vars:
```typescript
const CAMERA_AUTH = btoa(
  `${process.env.NEXT_PUBLIC_CAMERA_AUTH_USER}:${process.env.NEXT_PUBLIC_CAMERA_AUTH_PASS}`
);
```

### Pros:
- ✅ Very simple to implement
- ✅ Built into Caddy
- ✅ Works immediately
- ✅ Standard HTTP Basic Auth

### Cons:
- ⚠️ Credentials in environment variables (client-side visible)
- ⚠️ Same password for all users
- ⚠️ No session management

---

## Option 2: Tailscale ACLs (Network-level Security)

Since you're already using Tailscale, you can restrict access at the network level.

### Steps:

1. **Configure Tailscale ACL:**

In your Tailscale admin panel (https://login.tailscale.com/admin/acls), add:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["rata-server", "your-laptop"],
      "dst": ["raspberry-pi:8555"]
    }
  ]
}
```

2. **Benefit:** Only specific devices can access the Pi's camera service

### Pros:
- ✅ Network-level security
- ✅ No application changes needed
- ✅ Very secure (WireGuard encryption)

### Cons:
- ⚠️ Requires Tailscale on all accessing devices
- ⚠️ Vercel can't directly access (need rata as proxy)

---

## Option 3: JWT Tokens (Most Secure, More Complex)

Implement proper JWT-based authentication with your Next.js app.

### Architecture:

```
[User logs into webapp] → [Next.js API issues JWT] → [JWT passed to camera requests] → [Caddy validates JWT] → [Access granted]
```

This is more involved and requires:
1. NextAuth.js or similar for user management
2. JWT middleware in Caddy
3. Token refresh logic

**Recommendation:** Start with Option 1, upgrade to Option 3 later if needed.

---

## Option 4: IP Whitelist

Restrict access by IP address in Caddy.

```json
{
  "match": [
    {"host": ["cameras.tucanorobotics.co"]},
    {
      "not": [
        {"remote_ip": {
          "ranges": ["YOUR_IP", "VERCEL_IP_RANGE"]
        }}
      ]
    }
  ],
  "handle": [{
    "handler": "static_response",
    "status_code": 403
  }]
}
```

### Pros:
- ✅ Simple
- ✅ No credentials needed

### Cons:
- ⚠️ Doesn't work with dynamic IPs
- ⚠️ Vercel uses many IPs (need full range)

---

## Recommended Implementation Order:

1. **Start:** Option 2 (Tailscale ACLs) - Free network-level security
2. **Add:** Option 1 (Basic Auth) - Simple password protection for public access
3. **Later:** Option 3 (JWT) - If you need multi-user access with roles

For your greenhouse monitoring use case, **Tailscale ACLs + Basic Auth** is probably sufficient and provides good security with minimal complexity.

---

## Testing Authentication

After implementing, test with:

```bash
# Without auth (should fail):
curl https://cameras.tucanorobotics.co/api/streams

# With auth (should succeed):
curl -u admin:your-password https://cameras.tucanorobotics.co/api/streams
```

In browser, you'll see a login prompt when accessing the cameras page.

---

## Security Best Practices:

1. **Use HTTPS**: Already configured via Caddy ✅
2. **Strong passwords**: Use generated passwords, not dictionary words
3. **Rotate credentials**: Change passwords periodically
4. **Monitor access**: Check Caddy logs for suspicious activity
5. **Limit exposure**: Use Tailscale ACLs when possible
6. **Environment variables**: Never commit credentials to git

Remember: Your `.env.local` should be in `.gitignore` ✅
