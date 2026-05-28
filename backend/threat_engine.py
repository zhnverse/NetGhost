import time
from typing import Optional
from collections import defaultdict, deque

# Only truly malicious ports — removed common service ports (135, 139, 445, 23, 512-514, 69)
# that generate massive false positives on real networks
SUSPICIOUS_PORTS = {
    4444:  ("reverse_shell", "Metasploit default listener", "high"),
    1337:  ("c2",           "Elite/leet port often used by C2", "medium"),
    6666:  ("malware",      "IRC botnet/malware port", "high"),
    6667:  ("botnet",       "IRC botnet communication", "high"),
    6668:  ("botnet",       "IRC botnet communication", "high"),
    6669:  ("botnet",       "IRC botnet communication", "high"),
    31337: ("backdoor",     "Back Orifice / elite hacker port", "high"),
    12345: ("backdoor",     "NetBus RAT", "high"),
    27374: ("trojan",       "Sub7 trojan", "high"),
    4899:  ("rat",          "Radmin remote admin tool", "medium"),
    1080:  ("proxy",        "SOCKS proxy — often used by malware", "medium"),
    8888:  ("c2",           "Common C2 callback port", "low"),
}

# Only flag outbound connections to these — not inbound (avoids Tor relay false positives)
SUSPICIOUS_PORTS_OUTBOUND_ONLY = {
    9001:  ("tor", "Tor relay port", "low"),
    9030:  ("tor", "Tor directory port", "low"),
}

KNOWN_BAD_PREFIXES = [
    "185.220.",   # Common Tor exit nodes
    "195.206.",   # Known bulletproof hosting
]

# Ephemeral port boundary — ports above this are client-assigned and NOT suspicious
EPHEMERAL_PORT_MIN = 1024

# Port scan tracking: timestamped windows per src→dst pair
# _port_windows: key → deque of (timestamp, dst_port) tuples
_port_windows: dict[str, deque] = defaultdict(lambda: deque(maxlen=500))
_scan_window = 60  # seconds


def _is_private(ip: str) -> bool:
    try:
        import ipaddress
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return False


def analyze_connection(
    src_ip: str,
    dst_ip: str,
    src_port: Optional[int],
    dst_port: Optional[int],
    protocol: str,
    bytes_count: int = 0,
) -> tuple[bool, str, float, str]:
    """Returns (is_threat, threat_type, score, description)"""
    threats = []
    score = 0.0

    # Skip loopback — internal process communication, never a real threat
    if src_ip == "127.0.0.1" or dst_ip == "127.0.0.1":
        return False, "", 0.0, ""

    # Check destination port signatures (outgoing connection to bad port)
    if dst_port and dst_port in SUSPICIOUS_PORTS:
        ttype, desc, severity = SUSPICIOUS_PORTS[dst_port]
        sev_score = {"low": 0.3, "medium": 0.6, "high": 0.9}.get(severity, 0.5)
        threats.append((ttype, desc, sev_score))
        score = max(score, sev_score)

    # Outbound-only suspicious ports
    if dst_port and dst_port in SUSPICIOUS_PORTS_OUTBOUND_ONLY and not _is_private(dst_ip):
        ttype, desc, severity = SUSPICIOUS_PORTS_OUTBOUND_ONLY[dst_port]
        sev_score = {"low": 0.3, "medium": 0.6}.get(severity, 0.3)
        threats.append((ttype, desc, sev_score))
        score = max(score, sev_score)

    # Check source port — only flag if it's a service-range port (< 1024),
    # not an ephemeral client port. This prevents flagging server replies.
    if src_port and src_port < EPHEMERAL_PORT_MIN and src_port in SUSPICIOUS_PORTS:
        ttype, desc, severity = SUSPICIOUS_PORTS[src_port]
        sev_score = {"low": 0.2, "medium": 0.5, "high": 0.8}.get(severity, 0.4)
        threats.append((ttype + "_reverse", desc + " (inbound)", sev_score))
        score = max(score, sev_score)

    # Known bad IP prefixes
    for prefix in KNOWN_BAD_PREFIXES:
        if dst_ip.startswith(prefix):
            threats.append(("suspicious_ip", f"IP in suspicious range {prefix}*", 0.5))
            score = max(score, 0.5)
            break

    # Port scan detection: many unique SERVICE ports (< 1024) from one src to one dst
    # within the time window. Using service ports only prevents ephemeral client ports
    # (32768-60999) from triggering false positives on every TCP reply packet.
    if dst_port and dst_port < EPHEMERAL_PORT_MIN:
        key = f"{src_ip}->{dst_ip}"
        now = time.time()
        cutoff = now - _scan_window

        # Add this event and prune old ones
        _port_windows[key].append((now, dst_port))
        while _port_windows[key] and _port_windows[key][0][0] < cutoff:
            _port_windows[key].popleft()

        # Count unique service ports in current window
        recent_ports = {p for (t, p) in _port_windows[key]}
        unique_ports = len(recent_ports)

        if unique_ports >= 15:
            threats.append(("port_scan",
                f"Port scan: {unique_ports} unique service ports in {_scan_window}s", 0.85))
            score = max(score, 0.85)
        elif unique_ports >= 8:
            threats.append(("port_sweep",
                f"Possible sweep: {unique_ports} unique ports", 0.5))
            score = max(score, 0.5)

    # Large outbound transfer heuristic (only outbound to external IPs)
    if bytes_count > 10_000_000 and not _is_private(dst_ip):
        threats.append(("data_exfil", f"Large outbound transfer: {bytes_count // 1048576}MB", 0.4))
        score = max(score, 0.4)

    if not threats:
        return False, "", 0.0, ""

    best = max(threats, key=lambda x: x[2])
    return True, best[0], score, best[1]


def classify_protocol(dst_port: Optional[int], src_port: Optional[int], proto: str) -> str:
    PORT_NAMES = {
        80: "HTTP", 443: "HTTPS", 53: "DNS", 22: "SSH", 21: "FTP",
        25: "SMTP", 110: "POP3", 143: "IMAP", 3306: "MySQL",
        5432: "PostgreSQL", 6379: "Redis", 27017: "MongoDB",
        3389: "RDP", 5900: "VNC", 8080: "HTTP-Alt", 8443: "HTTPS-Alt",
        123: "NTP", 161: "SNMP", 389: "LDAP", 636: "LDAPS",
        993: "IMAPS", 995: "POP3S", 587: "SMTP-TLS", 465: "SMTPS",
        8888: "HTTP-Dev", 3000: "HTTP-Dev", 5000: "HTTP-Dev",
    }
    # Check both ports — whichever is a well-known service port wins.
    # This handles reply packets where src_port=443 but dst_port=ephemeral.
    for port in [dst_port, src_port]:
        if port and port in PORT_NAMES:
            return PORT_NAMES[port]
    # Strip tshark version suffix: "TLSv1.2" → "HTTPS" (all TLS on unknown port)
    if proto and proto.upper().startswith("TLS"):
        return "HTTPS"
    return proto.upper() if proto else "UNKNOWN"
