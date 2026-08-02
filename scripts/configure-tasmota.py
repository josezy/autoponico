#!/usr/bin/env python3
"""Configure a freshly flashed Tasmota device over serial (Wi-Fi, MQTT, timezone, template).

Prereqs:
  pip install pyserial   # or: scripts/.venv/bin/pip install -r scripts/requirements-tasmota.txt
  Device on USB-TTL at 3.3V, normal boot (not flash mode). AP tasmota-XXXX is fine.

Examples:
  scripts/.venv/bin/python scripts/configure-tasmota.py --list-compatible
  scripts/.venv/bin/python scripts/configure-tasmota.py --check-env scripts/tasmota.env
  scripts/.venv/bin/python scripts/configure-tasmota.py --env scripts/tasmota.env --port /dev/cu.usbserial-0001
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print("Missing pyserial. Install with: pip install pyserial", file=sys.stderr)
    sys.exit(1)

BAUD = 115200
# GPIO4=Relay1(224), GPIO6=Led1(288) follows POWER, GPIO9=Button1(32).
# LedLink(544) only shows Wi-Fi and stays off when connected.
BASIC_R4_TEMPLATE = (
    '{"NAME":"Sonoff Basic R4",'
    '"GPIO":[0,0,0,0,224,0,288,0,0,32,0,0,0,0,0,0,0,0,0,0,0,0],'
    '"FLAG":0,"BASE":1}'
)

REQUIRED_ENV = (
    "TASMOTA_WIFI_SSID",
    "TASMOTA_WIFI_PASSWORD",
    "TASMOTA_MQTT_HOST",
    "TASMOTA_TOPIC",
)

# USB-TTL / ESP serial device hints (macOS, Linux, Windows)
PORT_NAME_HINTS = (
    "usbserial",
    "usbmodem",
    "wchusbserial",
    "slab_usb",
    "ttyusb",
    "ttyacm",
    "com",
)
PORT_DESC_HINTS = (
    "ch340",
    "ch341",
    "cp210",
    "ft232",
    "ft231",
    "ftdi",
    "silicon labs",
    "usb serial",
    "uart",
    "usb-serial",
    "usb to uart",
)

NOISE_PORT_HINTS = (
    "bluetooth",
    "debug-console",
    "incoming",
)


@dataclass
class PortInfo:
    device: str
    description: str
    manufacturer: str
    hwid: str
    likely_adapter: bool
    tasmota: bool | None = None
    probe_note: str = ""


def load_env_file(path: Path, *, override: bool = False) -> None:
    if not path.is_file():
        raise SystemExit(f"Env file not found: {path}")
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if override or key not in os.environ:
            os.environ[key] = value


def redact_cmd(cmd: str) -> str:
    return re.sub(
        r"(Password1?\s+)(\S+)",
        r"\1***",
        cmd,
        flags=re.IGNORECASE,
    )


def is_noise_port(device: str, description: str) -> bool:
    blob = f"{device} {description}".lower()
    return any(h in blob for h in NOISE_PORT_HINTS)


def is_likely_adapter(device: str, description: str, manufacturer: str) -> bool:
    if is_noise_port(device, description):
        return False
    blob = f"{device} {description} {manufacturer}".lower()
    # Windows COMx is ambiguous — treat as candidate only with USB/UART desc
    if re.fullmatch(r"com\d+", device.lower()):
        return any(h in blob for h in PORT_DESC_HINTS) or "usb" in blob
    if any(h in device.lower() for h in PORT_NAME_HINTS):
        # Exclude bare Bluetooth-Incoming-Port style names already filtered
        return True
    return any(h in blob for h in PORT_DESC_HINTS)


def enumerate_candidate_ports() -> list[PortInfo]:
    ports: list[PortInfo] = []
    for p in list_ports.comports():
        desc = p.description or ""
        manuf = p.manufacturer or ""
        if is_noise_port(p.device, desc):
            continue
        ports.append(
            PortInfo(
                device=p.device,
                description=desc,
                manufacturer=manuf,
                hwid=p.hwid or "",
                likely_adapter=is_likely_adapter(p.device, desc, manuf),
            )
        )
    # Prefer likely adapters first
    ports.sort(key=lambda x: (not x.likely_adapter, x.device))
    return ports


def read_available(ser: serial.Serial, settle_s: float = 0.2) -> str:
    chunks: list[str] = []
    deadline = time.time() + settle_s
    while time.time() < deadline:
        waiting = ser.in_waiting
        if waiting:
            chunks.append(ser.read(waiting).decode("utf-8", errors="replace"))
            deadline = time.time() + settle_s
        else:
            time.sleep(0.02)
    return "".join(chunks)


def wait_for(ser: serial.Serial, pattern: str, timeout_s: float) -> str:
    """Read until regex matches or timeout. Returns accumulated text."""
    rx = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
    buf = ""
    end = time.time() + timeout_s
    while time.time() < end:
        buf += read_available(ser, settle_s=0.1)
        if rx.search(buf):
            return buf
        time.sleep(0.05)
    return buf


def open_serial(port: str) -> serial.Serial:
    return serial.Serial(port, BAUD, timeout=0.2)


def send_cmd(ser: serial.Serial, cmd: str, wait_s: float = 1.0) -> str:
    ser.reset_input_buffer()
    print(f">>> {redact_cmd(cmd)}")
    ser.write((cmd.strip() + "\n").encode("utf-8"))
    ser.flush()
    time.sleep(wait_s)
    out = read_available(ser, settle_s=0.25)
    if out.strip():
        print(redact_cmd(out).rstrip())
    return out


def looks_like_tasmota(text: str) -> bool:
    markers = (
        "STATUS = {",
        "StatusFWR",
        "tasmota",
        "RSL: STATUS",
        "MQT:",
        "WIF:",
        "Project tasmota",
    )
    lower = text.lower()
    return any(m.lower() in lower for m in markers)


def probe_port(device: str, timeout_s: float = 2.5) -> PortInfo:
    base = next((p for p in enumerate_candidate_ports() if p.device == device), None)
    info = base or PortInfo(
        device=device,
        description="",
        manufacturer="",
        hwid="",
        likely_adapter=True,
    )
    try:
        ser = open_serial(device)
    except serial.SerialException as exc:
        info.tasmota = False
        info.probe_note = f"open failed: {exc}"
        return info
    try:
        time.sleep(0.3)
        boot = read_available(ser)
        ser.reset_input_buffer()
        ser.write(b"Status 0\n")
        ser.flush()
        out = wait_for(ser, r"STATUS\s*=\s*\{|StatusFWR|RESULT\s*=", timeout_s)
        text = boot + out
        if looks_like_tasmota(text):
            info.tasmota = True
            info.probe_note = "Status 0 responded"
        else:
            info.tasmota = False
            info.probe_note = "no Tasmota response"
    except serial.SerialException as exc:
        info.tasmota = False
        info.probe_note = f"probe failed: {exc}"
    finally:
        ser.close()
    return info


def list_compatible(*, probe: bool = True) -> list[PortInfo]:
    candidates = [p for p in enumerate_candidate_ports() if p.likely_adapter]
    if not probe:
        return candidates
    probed: list[PortInfo] = []
    for p in candidates:
        probed.append(probe_port(p.device))
    return [p for p in probed if p.tasmota]


def check_env_file(path: Path) -> list[str]:
    """Return list of problems; empty means OK."""
    problems: list[str] = []
    if not path.is_file():
        return [f"missing file: {path}"]
    load_env_file(path, override=True)
    for key in REQUIRED_ENV:
        val = os.environ.get(key, "").strip()
        if not val:
            problems.append(f"missing/empty: {key}")
    return problems


def normalize_timezone(value: str) -> str:
    """Normalize '-5' / '+01:00' / '-05:00' to ±HH:MM."""
    value = value.strip()
    m = re.match(r"^([+-]?)(\d{1,2})(?::(\d{2}))?$", value)
    if not m:
        return value
    hours = int(m.group(2))
    if m.group(1) == "-":
        hours = -hours
    minutes = int(m.group(3) or 0)
    sign = "-" if hours < 0 or (hours == 0 and m.group(1) == "-") else "+"
    return f"{sign}{abs(hours):02d}:{minutes:02d}"


@dataclass
class VerifyResult:
    ok: bool
    wifi_ip: str | None = None
    wifi_ssid: str | None = None
    mqtt_host: str | None = None
    mqtt_connected: bool | None = None
    topic: str | None = None
    timezone: str | None = None
    local_time: str | None = None
    device_name: str | None = None
    module: str | None = None
    template_name: str | None = None
    has_relay: bool | None = None
    errors: list[str] | None = None


def parse_status_sections(text: str) -> dict[str, dict]:
    """Parse Tasmota Status N lines into {STATUS: {...}, STATUS5: {...}, ...}."""
    sections: dict[str, dict] = {}
    for m in re.finditer(
        r"\b(STATUS\d*|RESULT)\s*=\s*(\{)",
        text,
        re.IGNORECASE,
    ):
        key = m.group(1).upper()
        start = m.start(2)
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        sections[key] = json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        pass
                    break
    return sections


def verify_device(
    ser: serial.Serial,
    *,
    expect_topic: str,
    expect_mqtt_host: str,
    expect_timezone: str,
) -> VerifyResult:
    errors: list[str] = []
    status0 = send_cmd(ser, "Status 0", wait_s=2.5)
    status7 = send_cmd(ser, "Status 7", wait_s=1.5)
    tpl = send_cmd(ser, "Template", wait_s=1.0)
    gpio = send_cmd(ser, "GPIO 255", wait_s=1.2)
    power = send_cmd(ser, "Power", wait_s=1.0)
    blob = "\n".join([status0, status7, tpl, gpio, power, read_available(ser, settle_s=0.5)])
    sections = parse_status_sections(blob)

    st = sections.get("STATUS", {}).get("Status", sections.get("STATUS", {}))
    st3 = sections.get("STATUS3", {}).get("StatusLOG", sections.get("STATUS3", {}))
    st5 = sections.get("STATUS5", {}).get("StatusNET", sections.get("STATUS5", {}))
    st6 = sections.get("STATUS6", {}).get("StatusMQT", sections.get("STATUS6", {}))
    st7 = sections.get("STATUS7", {}).get("StatusTIM", sections.get("STATUS7", {}))

    wifi_ip = st5.get("IPAddress") if isinstance(st5, dict) else None
    ssids = st3.get("SSId") if isinstance(st3, dict) else None
    wifi_ssid = ssids[0] if isinstance(ssids, list) and ssids else None
    mqtt_host = st6.get("MqttHost") if isinstance(st6, dict) else None
    mqtt_count = st6.get("MqttCount") if isinstance(st6, dict) else None
    mqtt_connected = None
    if re.search(r"MQT:\s*Connected", blob, re.I):
        mqtt_connected = True
    elif isinstance(mqtt_count, int):
        mqtt_connected = mqtt_count > 0

    topic = st.get("Topic") if isinstance(st, dict) else None
    device_name = st.get("DeviceName") if isinstance(st, dict) else None
    module = str(st.get("Module")) if isinstance(st, dict) and "Module" in st else None
    timezone = st7.get("Timezone") if isinstance(st7, dict) else None
    local_time = st7.get("Local") if isinstance(st7, dict) else None

    template_name = None
    for sec in parse_status_sections(tpl).values():
        if isinstance(sec, dict) and sec.get("NAME"):
            template_name = sec.get("NAME")
            break
    has_relay = "Relay1" in gpio
    power_ok = bool(re.search(r'"POWER"\s*:\s*"(ON|OFF)"', power, re.I))

    if not wifi_ip or wifi_ip in ("0.0.0.0", ""):
        errors.append("Wi-Fi not associated (IP 0.0.0.0)")
    if topic and topic != expect_topic:
        errors.append(f"topic is {topic!r}, expected {expect_topic!r}")
    elif not topic:
        errors.append("topic missing from Status 0")
    if mqtt_host and mqtt_host != expect_mqtt_host:
        errors.append(f"MqttHost is {mqtt_host!r}, expected {expect_mqtt_host!r}")
    if mqtt_connected is False:
        errors.append("MQTT not connected yet")
    if local_time and str(local_time).startswith("1970"):
        errors.append(f"clock not synced yet (Local={local_time})")
    elif timezone and normalize_timezone(str(timezone)) != normalize_timezone(expect_timezone):
        errors.append(f"timezone is {timezone!r}, expected ~{expect_timezone!r}")
    if template_name and template_name != "Sonoff Basic R4":
        errors.append(f"template is {template_name!r}, expected 'Sonoff Basic R4'")
    if not has_relay:
        errors.append("no Relay1 in GPIO map (Power will not work)")
    if not power_ok:
        errors.append("Power command failed (no relay configured?)")

    ok = (
        not errors
        and bool(wifi_ip and wifi_ip != "0.0.0.0")
        and topic == expect_topic
        and mqtt_connected is not False
        and has_relay
        and power_ok
    )

    return VerifyResult(
        ok=ok,
        wifi_ip=wifi_ip,
        wifi_ssid=wifi_ssid,
        mqtt_host=mqtt_host,
        mqtt_connected=mqtt_connected,
        topic=topic,
        timezone=str(timezone) if timezone is not None else None,
        local_time=str(local_time) if local_time is not None else None,
        device_name=device_name,
        module=module,
        template_name=template_name,
        has_relay=has_relay,
        errors=errors or None,
    )


def wait_for_boot(ser: serial.Serial, timeout_s: float = 12.0) -> str:
    return wait_for(
        ser,
        r"Project tasmota|WIF:|HTP: Web server|MQTT:|Connected|WifiManager",
        timeout_s,
    )


def ensure_basic_r4_template(ser: serial.Serial) -> None:
    """Apply Sonoff Basic R4 template + Module 0; abort if Relay1 is missing."""
    send_cmd(ser, f"Template {BASIC_R4_TEMPLATE}", wait_s=1.0)
    print("Waiting for template restart…")
    log = wait_for_boot(ser, timeout_s=15.0)
    if log.strip():
        print(log.rstrip())
    # Avoid racing Module 0 before CFG finishes loading the new template.
    time.sleep(2.5)
    mod = send_cmd(ser, "Module 0", wait_s=1.5)
    if "Restarting" in mod:
        print("Waiting for Module 0 restart…")
        log = wait_for_boot(ser, timeout_s=12.0)
        if log.strip():
            print(log.rstrip())
        time.sleep(2.0)

    tpl = send_cmd(ser, "Template", wait_s=1.0)
    gpio = send_cmd(ser, "GPIO 255", wait_s=1.2)
    if "Sonoff Basic R4" not in tpl:
        raise SystemExit("Template did not stick as Sonoff Basic R4 — aborting before Wi-Fi.")
    if "Relay1" not in gpio:
        raise SystemExit("GPIO map has no Relay1 after template — aborting before Wi-Fi.")
    print("Template OK: Sonoff Basic R4 with Relay1.")


def configure(
    port: str,
    *,
    ssid: str,
    password: str,
    mqtt_host: str,
    mqtt_port: int,
    topic: str,
    timezone: str,
    friendly_name: str | None,
    ntp: str,
    verify: bool = True,
) -> VerifyResult | None:
    print(f"Opening {port} @ {BAUD}…")
    ser = open_serial(port)
    try:
        time.sleep(0.4)
        boot = read_available(ser)
        if boot.strip():
            print(boot.rstrip())

        probe = send_cmd(ser, "Status 0", wait_s=1.5)
        if not looks_like_tasmota(probe):
            raise SystemExit(f"Port {port} did not respond like Tasmota")

        name = friendly_name or topic

        # Identity + time + MQTT (no restart yet)
        send_cmd(
            ser,
            "Backlog "
            f"FriendlyName1 {name}; "
            f"DeviceName {name}; "
            f"Timezone {timezone}; "
            f"NtpServer1 {ntp}; "
            f"MqttHost {mqtt_host}; "
            f"MqttPort {mqtt_port}; "
            f"Topic {topic}; "
            "FullTopic %prefix%/%topic%/",
            wait_s=2.5,
        )

        # Template + Module 0 (must land Relay1 before Wi-Fi restart)
        ensure_basic_r4_template(ser)

        # Wi-Fi last
        send_cmd(
            ser,
            "Backlog "
            f"SSId1 {ssid}; "
            f"Password1 {password}; "
            "Restart 1",
            wait_s=1.5,
        )
        print("\nWaiting for Wi-Fi reboot…")
        wifi_log = wait_for(
            ser,
            r"WIF:\s*Connected|IP address \d+\.\d+\.\d+\.\d+|MQT:\s*Connected",
            timeout_s=25.0,
        )
        if wifi_log.strip():
            print(redact_cmd(wifi_log).rstrip())

        # Extra settle for MQTT/NTP
        time.sleep(3.0)
        print(read_available(ser, settle_s=0.5).rstrip())

        # Template can be wiped by FRC/QPC on flaky USB power — re-check and repair.
        gpio_check = send_cmd(ser, "GPIO 255", wait_s=1.0)
        if "Relay1" not in gpio_check:
            print("Relay1 missing after Wi-Fi reboot — re-applying template…")
            ensure_basic_r4_template(ser)
            time.sleep(2.0)

        if not verify:
            print("\nConfigure commands sent (verify skipped).")
            return None

        print("\nVerifying…")
        result = verify_device(
            ser,
            expect_topic=topic,
            expect_mqtt_host=mqtt_host,
            expect_timezone=timezone,
        )
        # One retry if MQTT/NTP still catching up
        if not result.ok and result.errors:
            soft = all(
                "MQTT not connected" in e or "clock not synced" in e for e in (result.errors or [])
            )
            if soft or (result.wifi_ip and result.wifi_ip != "0.0.0.0"):
                print("Retrying verification in 5s…")
                time.sleep(5.0)
                result = verify_device(
                    ser,
                    expect_topic=topic,
                    expect_mqtt_host=mqtt_host,
                    expect_timezone=timezone,
                )

        print("\n" + json.dumps(asdict(result), indent=2))
        if result.ok:
            print(
                f"\nOK — {result.device_name or topic} on {result.wifi_ip}, "
                f"MQTT topic '{result.topic}', timezone {result.timezone}."
            )
        else:
            print("\nVerification failed:", "; ".join(result.errors or ["unknown"]), file=sys.stderr)
        return result
    finally:
        ser.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Configure Tasmota over serial after flash")
    parser.add_argument("--port", help="Serial device (default: single compatible Tasmota port)")
    parser.add_argument("--env", type=Path, help="Env file with TASMOTA_* vars")
    parser.add_argument("--ssid", default=None)
    parser.add_argument("--password", default=None)
    parser.add_argument("--mqtt-host", default=None)
    parser.add_argument("--mqtt-port", type=int, default=None)
    parser.add_argument("--topic", default=None)
    parser.add_argument("--timezone", default=None)
    parser.add_argument("--friendly-name", default=None)
    parser.add_argument("--ntp", default=None)
    parser.add_argument("--list-ports", action="store_true", help="List serial ports and exit")
    parser.add_argument(
        "--list-compatible",
        action="store_true",
        help="Probe USB-TTL ports for Tasmota; print JSON and exit",
    )
    parser.add_argument(
        "--check-env",
        type=Path,
        nargs="?",
        const=Path("scripts/tasmota.env"),
        help="Validate env file (default scripts/tasmota.env) and exit",
    )
    parser.add_argument("--no-verify", action="store_true", help="Skip post-config verification")
    parser.add_argument("--no-probe", action="store_true", help="Do not probe when listing candidates")
    return parser.parse_args()


def apply_arg_defaults(args: argparse.Namespace) -> argparse.Namespace:
    args.ssid = args.ssid or os.environ.get("TASMOTA_WIFI_SSID")
    args.password = args.password or os.environ.get("TASMOTA_WIFI_PASSWORD")
    args.mqtt_host = args.mqtt_host or os.environ.get("TASMOTA_MQTT_HOST")
    args.mqtt_port = args.mqtt_port or int(os.environ.get("TASMOTA_MQTT_PORT", "1883"))
    args.topic = args.topic or os.environ.get("TASMOTA_TOPIC")
    args.timezone = args.timezone or os.environ.get("TASMOTA_TIMEZONE", "-5")
    args.friendly_name = args.friendly_name or os.environ.get("TASMOTA_FRIENDLY_NAME")
    args.ntp = args.ntp or os.environ.get("TASMOTA_NTP", "pool.ntp.org")
    return args


def main() -> None:
    pre = argparse.ArgumentParser(add_help=False)
    pre.add_argument("--env", type=Path)
    pre_args, _ = pre.parse_known_args()
    if pre_args.env:
        load_env_file(pre_args.env)

    args = apply_arg_defaults(parse_args())

    if args.check_env is not None:
        problems = check_env_file(args.check_env)
        payload = {"env": str(args.check_env), "ok": not problems, "problems": problems}
        print(json.dumps(payload, indent=2))
        sys.exit(0 if not problems else 2)

    if args.list_ports:
        for p in enumerate_candidate_ports():
            tag = "adapter" if p.likely_adapter else "other"
            print(f"{p.device}\t{p.description}\t{tag}")
        return

    if args.list_compatible:
        ports = list_compatible(probe=not args.no_probe)
        print(json.dumps([asdict(p) for p in ports], indent=2))
        sys.exit(0 if ports else 1)

    missing = [
        name
        for name, val in (
            ("--ssid / TASMOTA_WIFI_SSID", args.ssid),
            ("--password / TASMOTA_WIFI_PASSWORD", args.password),
            ("--mqtt-host / TASMOTA_MQTT_HOST", args.mqtt_host),
            ("--topic / TASMOTA_TOPIC", args.topic),
        )
        if not val
    ]
    if missing:
        print("Missing required settings:", ", ".join(missing), file=sys.stderr)
        print("See scripts/tasmota.env.example", file=sys.stderr)
        sys.exit(2)

    port = args.port
    if not port:
        compatible = list_compatible(probe=True)
        if len(compatible) == 0:
            print("No compatible Tasmota serial devices found.", file=sys.stderr)
            sys.exit(1)
        if len(compatible) > 1:
            print("Multiple Tasmota devices found; pass --port explicitly:", file=sys.stderr)
            for p in compatible:
                print(f"  {p.device}\t{p.description}", file=sys.stderr)
            sys.exit(3)
        port = compatible[0].device
        print(f"Auto-selected port {port}")

    result = configure(
        port,
        ssid=args.ssid,
        password=args.password,
        mqtt_host=args.mqtt_host,
        mqtt_port=args.mqtt_port,
        topic=args.topic,
        timezone=args.timezone,
        friendly_name=args.friendly_name,
        ntp=args.ntp,
        verify=not args.no_verify,
    )
    if result is not None and not result.ok:
        sys.exit(4)


if __name__ == "__main__":
    main()
