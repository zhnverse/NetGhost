"""
Network traffic capture using tshark subprocess.
Falls back to demo data if capture fails (permission issues, no interfaces).
"""
import asyncio
import subprocess
import json
import time
import random
from typing import AsyncIterator
import logging

logger = logging.getLogger("capture")

# Demo IPs for when capture isn't available
DEMO_EXTERNAL_IPS = [
    ("8.8.8.8", 53, "UDP"),          # Google DNS
    ("1.1.1.1", 53, "UDP"),           # Cloudflare DNS
    ("93.184.216.34", 443, "TCP"),    # example.com
    ("151.101.1.140", 443, "TCP"),    # Fastly CDN
    ("185.220.101.1", 443, "TCP"),    # Tor exit node
    ("172.217.14.78", 443, "TCP"),    # Google
    ("104.244.42.65", 443, "TCP"),    # Twitter/X
    ("157.240.11.35", 443, "TCP"),    # Facebook
    ("52.84.12.45", 443, "TCP"),      # AWS CloudFront
    ("31.13.72.36", 443, "TCP"),      # Facebook CDN
    ("185.199.108.153", 443, "TCP"),  # GitHub
    ("23.185.0.1", 80, "TCP"),        # Pantheon
    ("209.85.200.100", 25, "TCP"),    # Gmail SMTP
    ("91.108.4.1", 443, "TCP"),       # Telegram
    ("188.166.1.1", 4444, "TCP"),     # Simulated suspicious (C2-like)
    ("142.250.80.46", 443, "TCP"),    # Google services
    ("216.58.215.78", 443, "TCP"),    # Google Analytics
    ("104.16.132.229", 443, "TCP"),   # Cloudflare
    ("13.107.42.14", 443, "TCP"),     # Microsoft/Office365
    ("52.96.240.16", 443, "TCP"),     # Microsoft Exchange
]

# DNS queries associated with destinations (for demo realism)
DEMO_DNS_MAP = {
    "8.8.8.8": "dns.google",
    "1.1.1.1": "one.one.one.one",
    "93.184.216.34": "example.com",
    "151.101.1.140": "reddit.com",
    "172.217.14.78": "www.google.com",
    "104.244.42.65": "twitter.com",
    "157.240.11.35": "www.facebook.com",
    "52.84.12.45": "d1wqtxts1xzle7.cloudfront.net",
    "31.13.72.36": "static.xx.fbcdn.net",
    "185.199.108.153": "github.com",
    "91.108.4.1": "web.telegram.org",
    "142.250.80.46": "fonts.googleapis.com",
    "216.58.215.78": "www.google-analytics.com",
    "104.16.132.229": "cdnjs.cloudflare.com",
    "13.107.42.14": "outlook.office365.com",
    "52.96.240.16": "smtp.office365.com",
}

DEMO_DNS_QUERIES = [
    ("www.google.com", "142.250.80.46", False, "search"),
    ("api.github.com", "185.199.108.133", False, "dev"),
    ("cdn.jsdelivr.net", "104.16.132.229", False, "cdn"),
    ("fonts.googleapis.com", "142.250.80.46", True, "tracker"),
    ("registry.npmjs.org", "104.16.132.229", False, "dev"),
    ("pypi.org", "151.101.1.140", False, "dev"),
    ("updates.ubuntu.com", "91.189.91.48", False, "update"),
    ("www.google-analytics.com", "216.58.215.78", True, "tracker"),
    ("googletagmanager.com", "216.58.215.78", True, "tracker"),
    ("doubleclick.net", "216.58.215.78", True, "ads"),
    ("pixel.facebook.com", "157.240.11.35", True, "tracker"),
    ("connect.facebook.net", "157.240.11.35", True, "tracker"),
    ("ads.twitter.com", "104.244.42.65", True, "ads"),
    ("telemetry.microsoft.com", "13.107.42.14", True, "telemetry"),
    ("vortex.data.microsoft.com", "13.107.42.14", True, "telemetry"),
    ("outlook.office365.com", "13.107.42.14", False, "email"),
    ("www.facebook.com", "157.240.11.35", False, "social"),
    ("twitter.com", "104.244.42.65", False, "social"),
    ("reddit.com", "151.101.1.140", False, "social"),
    ("github.com", "185.199.108.153", False, "dev"),
    ("discord.com", "162.159.135.232", False, "chat"),
    ("slack.com", "54.192.151.253", False, "chat"),
    ("hotjar.com", "104.17.50.244", True, "tracker"),
    ("segment.com", "104.18.28.17", True, "analytics"),
    ("mixpanel.com", "34.232.106.54", True, "analytics"),
]

DEMO_LOCAL_IP = "192.168.1.100"


async def get_interfaces() -> list[str]:
    """Get available network interfaces."""
    try:
        result = await asyncio.create_subprocess_exec(
            "tshark", "-D",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await result.communicate()
        interfaces = []
        for line in stdout.decode().splitlines():
            parts = line.strip().split(". ", 1)
            if len(parts) == 2:
                iface = parts[1].split(" ")[0]
                if not iface.startswith("lo") and not iface.startswith("any"):
                    interfaces.append(iface)
        return interfaces or ["eth0"]
    except Exception:
        return ["eth0"]


async def capture_packets(interface: str = "any") -> AsyncIterator[dict]:
    """Capture packets using tshark with JSON output. Falls back to demo on error."""
    fields = [
        "-T", "ek",
        "-e", "ip.src",
        "-e", "ip.dst",
        "-e", "tcp.srcport",
        "-e", "tcp.dstport",
        "-e", "udp.srcport",
        "-e", "udp.dstport",
        "-e", "frame.len",
        "-e", "_ws.col.Protocol",
        "-e", "frame.time_epoch",
        "-e", "dns.qry.name",
        "-e", "dns.a",
    ]

    cmd = ["tshark", "-i", interface, "-l", *fields]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async for line in proc.stdout:
            line = line.decode().strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                layers = data.get("layers", {})

                src = _first(layers.get("ip_src"))
                dst = _first(layers.get("ip_dst"))
                if not src or not dst:
                    continue

                proto = _first(layers.get("_ws_col_protocol", ["TCP"]))
                src_port = int(_first(layers.get("tcp_srcport") or layers.get("udp_srcport") or [0]) or 0)
                dst_port = int(_first(layers.get("tcp_dstport") or layers.get("udp_dstport") or [0]) or 0)
                frame_len = int(_first(layers.get("frame_len") or [64]) or 64)
                ts = float(_first(layers.get("frame_time_epoch") or [time.time()]) or time.time())
                dns_query = _first(layers.get("dns_qry_name"))
                dns_response = _first(layers.get("dns_a"))

                yield {
                    "src_ip": src,
                    "dst_ip": dst,
                    "src_port": src_port,
                    "dst_port": dst_port,
                    "protocol": proto,
                    "bytes": frame_len,
                    "timestamp": ts,
                    "dns_query": dns_query,
                    "dns_response": dns_response,
                    "demo": False,
                }
            except (json.JSONDecodeError, ValueError, KeyError):
                continue

    except (PermissionError, FileNotFoundError, OSError) as e:
        logger.warning(f"Capture failed ({e}), falling back to demo mode")
        async for pkt in demo_capture():
            yield pkt


def _first(val):
    if isinstance(val, list):
        return val[0] if val else None
    return val


async def demo_capture() -> AsyncIterator[dict]:
    """Generate realistic demo traffic for when capture isn't available."""
    tick = 0
    while True:
        tick += 1
        n = random.randint(1, 4)
        for _ in range(n):
            dst_ip, dst_port, proto = random.choice(DEMO_EXTERNAL_IPS)
            src_port = random.randint(32768, 65535)
            bytes_count = random.randint(64, 8192)
            if random.random() < 0.05:
                bytes_count = random.randint(100_000, 5_000_000)

            dns_query = None
            dns_response = None
            if dst_port == 53 or random.random() < 0.25:
                # Generate a DNS event alongside or instead of connection
                qname, resp_ip, _is_tracker, _cat = random.choice(DEMO_DNS_QUERIES)
                dns_query = qname
                dns_response = resp_ip

            yield {
                "src_ip": DEMO_LOCAL_IP,
                "dst_ip": dst_ip,
                "src_port": src_port,
                "dst_port": dst_port,
                "protocol": proto,
                "bytes": bytes_count,
                "timestamp": time.time(),
                "dns_query": dns_query,
                "dns_response": dns_response,
                "demo": True,
            }

        await asyncio.sleep(random.uniform(0.5, 2.0))


async def try_capture_with_sudo(interface: str = "any") -> AsyncIterator[dict]:
    """Try tshark capture; fallback to demo if permission denied or not installed."""
    try:
        result = subprocess.run(
            ["tshark", "-i", interface, "-c", "1", "-q"],
            capture_output=True, timeout=3
        )
        if result.returncode == 0:
            async for pkt in capture_packets(interface):
                yield pkt
            return
    except Exception:
        pass

    logger.info("No capture permission or tshark unavailable — running in demo mode")
    async for pkt in demo_capture():
        yield pkt
