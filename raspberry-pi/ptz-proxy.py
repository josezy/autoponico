#!/usr/bin/env python3
"""Lightweight ONVIF PTZ proxy for V380 cameras."""

import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

GO2RTC_CONFIG = "/etc/go2rtc/go2rtc.yaml"
ONVIF_PORT = 8899
PROFILE_TOKEN = "stream0_0"
PORT = 8556


def get_camera_ip(config_path=GO2RTC_CONFIG, stream="camera1"):
    """Extract camera IP from go2rtc config (first RTSP URL for the given stream)."""
    with open(config_path) as f:
        content = f.read()
    # Find RTSP URL under the stream name
    pattern = rf'{stream}:\s*\n\s*-\s*(rtsp://\S+)'
    match = re.search(pattern, content)
    if not match:
        raise RuntimeError(f"Could not find RTSP URL for '{stream}' in {config_path}")
    parsed = urlparse(match.group(1))
    return parsed.hostname


CAMERA_IP = get_camera_ip()
ONVIF_URL = f"http://{CAMERA_IP}:{ONVIF_PORT}/onvif/PTZ"

CONTINUOUS_MOVE_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Body>
    <tptz:ContinuousMove>
      <tptz:ProfileToken>{profile}</tptz:ProfileToken>
      <tptz:Velocity>
        <tt:PanTilt x="{pan}" y="{tilt}" space="http://www.onvif.org/ver10/tptz/PanTiltSpaces/VelocityGenericSpace"/>
        <tt:Zoom x="{zoom}" space="http://www.onvif.org/ver10/tptz/ZoomSpaces/VelocityGenericSpace"/>
      </tptz:Velocity>
    </tptz:ContinuousMove>
  </s:Body>
</s:Envelope>"""

STOP_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl">
  <s:Body>
    <tptz:Stop>
      <tptz:ProfileToken>{profile}</tptz:ProfileToken>
      <tptz:PanTilt>true</tptz:PanTilt>
      <tptz:Zoom>true</tptz:Zoom>
    </tptz:Stop>
  </s:Body>
</s:Envelope>"""

COMMANDS = {
    "left":     {"pan": "-{speed}", "tilt": "0", "zoom": "0"},
    "right":    {"pan": "{speed}",  "tilt": "0", "zoom": "0"},
    "up":       {"pan": "0", "tilt": "{speed}",  "zoom": "0"},
    "down":     {"pan": "0", "tilt": "-{speed}", "zoom": "0"},
}


def send_onvif(body: str) -> str:
    req = Request(ONVIF_URL, data=body.encode(), headers={"Content-Type": "application/soap+xml"})
    with urlopen(req, timeout=5) as resp:
        return resp.read().decode()


def handle_ptz(cmd: str, speed: float = 0.5) -> dict:
    if cmd == "stop":
        send_onvif(STOP_TEMPLATE.format(profile=PROFILE_TOKEN))
        return {"ok": True, "cmd": "stop"}

    if cmd not in COMMANDS:
        return {"error": f"Unknown command: {cmd}", "valid": list(COMMANDS.keys()) + ["stop"]}

    velocity = {k: v.format(speed=speed) for k, v in COMMANDS[cmd].items()}
    body = CONTINUOUS_MOVE_TEMPLATE.format(profile=PROFILE_TOKEN, **velocity)
    send_onvif(body)
    return {"ok": True, "cmd": cmd, "speed": speed}


class PTZHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/ptz":
            self.send_response(404)
            self.end_headers()
            return

        params = parse_qs(parsed.query)
        cmd = params.get("cmd", [None])[0]
        speed = float(params.get("speed", ["0.5"])[0])

        if not cmd:
            self._respond(400, {"error": "Missing 'cmd' parameter"})
            return

        try:
            result = handle_ptz(cmd, speed)
            status = 200 if "ok" in result else 400
            self._respond(status, result)
        except Exception as e:
            self._respond(500, {"error": str(e)})

    def _respond(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f"[PTZ] {args[0]}")


if __name__ == "__main__":
    print(f"Camera IP: {CAMERA_IP} (from {GO2RTC_CONFIG})")
    print(f"ONVIF URL: {ONVIF_URL}")
    server = HTTPServer(("0.0.0.0", PORT), PTZHandler)
    print(f"PTZ proxy listening on port {PORT}")
    server.serve_forever()
