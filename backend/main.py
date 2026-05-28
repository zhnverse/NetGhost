"""
NetGhost Backend - FastAPI app with WebSocket for real-time traffic
"""
import asyncio
import time
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
import psutil

from database import get_db, close_db
from geoip_service import init_geoip, lookup
from threat_engine import analyze_connection, classify_protocol
from capture import try_capture_with_sudo, get_interfaces, DEMO_DNS_QUERIES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("netghost")

# Known tracker domains for privacy analysis
TRACKER_DOMAINS = {
    "google-analytics.com": "analytics",
    "www.google-analytics.com": "analytics",
    "googletagmanager.com": "tracker",
    "googletagservices.com": "tracker",
    "doubleclick.net": "ads",
    "googlesyndication.com": "ads",
    "pixel.facebook.com": "tracker",
    "connect.facebook.net": "tracker",
    "static.xx.fbcdn.net": "tracker",
    "ads.twitter.com": "ads",
    "analytics.twitter.com": "analytics",
    "ads.linkedin.com": "ads",
    "hotjar.com": "analytics",
    "segment.com": "analytics",
    "mixpanel.com": "analytics",
    "amplitude.com": "analytics",
    "fullstory.com": "analytics",
    "intercom.io": "tracking",
    "heap.io": "analytics",
    "telemetry.microsoft.com": "telemetry",
    "vortex.data.microsoft.com": "telemetry",
    "settings-win.data.microsoft.com": "telemetry",
    "watson.telemetry.microsoft.com": "telemetry",
    "browser.events.data.microsoft.com": "telemetry",
    "amazon-adsystem.com": "ads",
    "scorecardresearch.com": "analytics",
    "quantserve.com": "analytics",
    "outbrain.com": "ads",
    "taboola.com": "ads",
    "rubiconproject.com": "ads",
    "openx.net": "ads",
    "adnxs.com": "ads",
    "criteo.com": "ads",
    "moatads.com": "ads",
}

# Telemetry-sending applications (for privacy page)
TELEMETRY_PROCESSES = {
    "code": "VS Code",
    "vscode": "VS Code",
    "chrome": "Google Chrome",
    "chromium": "Chromium",
    "firefox": "Firefox",
    "snap": "Snap daemon",
    "ubuntu-report": "Ubuntu Reporting",
    "apport": "Ubuntu Crash Reporter",
}


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
capture_task: Optional[asyncio.Task] = None
is_demo_mode = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_geoip()
    await get_db()
    logger.info("Database ready")
    global capture_task
    capture_task = asyncio.create_task(capture_loop())
    yield
    if capture_task:
        capture_task.cancel()
    await close_db()


app = FastAPI(title="NetGhost API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _classify_tracker(domain: str) -> Optional[str]:
    """Return tracker category if domain is a known tracker, else None."""
    if not domain:
        return None
    d = domain.lower().lstrip("www.")
    for tracker, cat in TRACKER_DOMAINS.items():
        if d == tracker or d.endswith("." + tracker):
            return cat
    return None


async def capture_loop():
    global is_demo_mode
    interface = os.environ.get("CAPTURE_INTERFACE", "any")
    logger.info(f"Starting capture on interface: {interface}")

    try:
        async for pkt in try_capture_with_sudo(interface):
            is_demo_mode = pkt.get("demo", False)

            src_ip = pkt["src_ip"]
            dst_ip = pkt["dst_ip"]
            src_port = pkt["src_port"]
            dst_port = pkt["dst_port"]
            protocol = pkt["protocol"]
            bytes_count = pkt["bytes"]
            ts = pkt["timestamp"]
            dns_query = pkt.get("dns_query")
            dns_response = pkt.get("dns_response")

            src_geo = lookup(src_ip)
            dst_geo = lookup(dst_ip)

            is_threat, threat_type, threat_score, threat_desc = analyze_connection(
                src_ip, dst_ip, src_port, dst_port, protocol, bytes_count
            )

            classified_proto = classify_protocol(dst_port, src_port, protocol)

            db = await get_db()
            cursor = await db.execute(
                """INSERT INTO connections
                (timestamp, src_ip, dst_ip, src_port, dst_port, protocol, bytes,
                 src_country, src_city, src_lat, src_lon,
                 dst_country, dst_city, dst_lat, dst_lon,
                 is_threat, threat_type, threat_score, dns_query)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (ts, src_ip, dst_ip, src_port, dst_port, classified_proto, bytes_count,
                 src_geo["country"], src_geo.get("city"), src_geo["lat"], src_geo["lon"],
                 dst_geo["country"], dst_geo.get("city"), dst_geo["lat"], dst_geo["lon"],
                 1 if is_threat else 0, threat_type, threat_score, dns_query)
            )
            conn_id = cursor.lastrowid

            if is_threat:
                await db.execute(
                    """INSERT INTO threats (timestamp, ip, threat_type, description, severity, connection_id)
                    VALUES (?,?,?,?,?,?)""",
                    (ts, dst_ip, threat_type, threat_desc,
                     "high" if threat_score > 0.7 else "medium" if threat_score > 0.4 else "low",
                     conn_id)
                )

            # Log DNS queries separately
            if dns_query:
                tracker_cat = _classify_tracker(dns_query)
                await db.execute(
                    """INSERT INTO dns_log (timestamp, query, src_ip, dst_ip, response_ip, is_tracker, category)
                    VALUES (?,?,?,?,?,?,?)""",
                    (ts, dns_query, src_ip, dst_ip, dns_response,
                     1 if tracker_cat else 0, tracker_cat or "normal")
                )

            await db.commit()

            conn_data = {
                "type": "connection",
                "id": conn_id,
                "timestamp": ts,
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "src_port": src_port,
                "dst_port": dst_port,
                "protocol": classified_proto,
                "bytes": bytes_count,
                "src_country": src_geo["country"],
                "src_city": src_geo.get("city"),
                "src_lat": src_geo["lat"],
                "src_lon": src_geo["lon"],
                "dst_country": dst_geo["country"],
                "dst_city": dst_geo.get("city"),
                "dst_lat": dst_geo["lat"],
                "dst_lon": dst_geo["lon"],
                "is_threat": 1 if is_threat else 0,
                "threat_type": threat_type,
                "threat_score": threat_score,
                "dns_query": dns_query,
                "is_demo": is_demo_mode,
            }
            if is_threat:
                conn_data["threat_desc"] = threat_desc

            if manager.active:
                await manager.broadcast(conn_data)

    except asyncio.CancelledError:
        logger.info("Capture loop cancelled")
    except Exception as e:
        logger.error(f"Capture loop error: {e}", exc_info=True)


# ============================================================
# REST API
# ============================================================

@app.get("/api/status")
async def get_status():
    db = await get_db()
    async with db.execute("SELECT COUNT(*) as cnt FROM connections") as cur:
        total = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM connections WHERE is_threat=1") as cur:
        threats = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM threats") as cur:
        threat_events = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM dns_log") as cur:
        dns_count = (await cur.fetchone())["cnt"]

    net_io = psutil.net_io_counters()

    return {
        "status": "running",
        "demo_mode": is_demo_mode,
        "total_connections": total,
        "total_threats": threats,
        "threat_events": threat_events,
        "dns_queries": dns_count,
        "ws_clients": len(manager.active),
        "bytes_sent": net_io.bytes_sent,
        "bytes_recv": net_io.bytes_recv,
    }


@app.get("/api/connections")
async def get_connections(
    limit: int = Query(100, le=1000),
    offset: int = 0,
    threat_only: bool = False,
    src_ip: Optional[str] = None,
    dst_ip: Optional[str] = None,
    protocol: Optional[str] = None,
    since: Optional[float] = None,
):
    db = await get_db()
    conditions = []
    params: list = []

    if threat_only:
        conditions.append("is_threat = 1")
    if src_ip:
        conditions.append("src_ip LIKE ?")
        params.append(f"%{src_ip}%")
    if dst_ip:
        conditions.append("dst_ip LIKE ?")
        params.append(f"%{dst_ip}%")
    if protocol:
        conditions.append("protocol = ?")
        params.append(protocol.upper())
    if since:
        conditions.append("timestamp >= ?")
        params.append(since)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    async with db.execute(
        f"SELECT * FROM connections {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
        params
    ) as cur:
        rows = await cur.fetchall()

    return {"connections": [dict(r) for r in rows], "total": len(rows)}


@app.get("/api/threats")
async def get_threats(limit: int = Query(50, le=500)):
    db = await get_db()
    async with db.execute(
        "SELECT * FROM threats ORDER BY timestamp DESC LIMIT ?", (limit,)
    ) as cur:
        rows = await cur.fetchall()
    return {"threats": [dict(r) for r in rows]}


@app.get("/api/stats/geo")
async def get_geo_stats():
    db = await get_db()
    async with db.execute(
        """SELECT dst_country as country, COUNT(*) as count, SUM(bytes) as bytes,
           SUM(is_threat) as threats
           FROM connections WHERE dst_country IS NOT NULL AND dst_country != 'LAN'
           GROUP BY dst_country ORDER BY count DESC LIMIT 30"""
    ) as cur:
        rows = await cur.fetchall()
    return {"countries": [dict(r) for r in rows]}


@app.get("/api/stats/protocols")
async def get_protocol_stats():
    db = await get_db()
    async with db.execute(
        "SELECT protocol, COUNT(*) as count, SUM(bytes) as bytes FROM connections GROUP BY protocol ORDER BY count DESC LIMIT 20"
    ) as cur:
        rows = await cur.fetchall()
    return {"protocols": [dict(r) for r in rows]}


@app.get("/api/stats/timeline")
async def get_timeline(minutes: int = 60):
    db = await get_db()
    since = time.time() - (minutes * 60)
    async with db.execute(
        """SELECT CAST(timestamp/60 AS INT)*60 as bucket,
           COUNT(*) as count, SUM(is_threat) as threats, SUM(bytes) as bytes
           FROM connections WHERE timestamp >= ?
           GROUP BY bucket ORDER BY bucket""",
        (since,)
    ) as cur:
        rows = await cur.fetchall()
    return {"timeline": [dict(r) for r in rows]}


@app.get("/api/stats/top_ips")
async def get_top_ips(limit: int = 20):
    db = await get_db()
    async with db.execute(
        """SELECT dst_ip as ip, dst_country as country, COUNT(*) as count,
           SUM(bytes) as bytes, MAX(is_threat) as is_threat
           FROM connections WHERE dst_ip IS NOT NULL
           GROUP BY dst_ip ORDER BY count DESC LIMIT ?""",
        (limit,)
    ) as cur:
        rows = await cur.fetchall()
    return {"ips": [dict(r) for r in rows]}


@app.get("/api/hunt")
async def hunt(
    q: str = Query(..., description="Search query"),
    limit: int = Query(100, le=500),
):
    db = await get_db()
    term = f"%{q}%"
    async with db.execute(
        """SELECT * FROM connections
           WHERE src_ip LIKE ? OR dst_ip LIKE ? OR protocol LIKE ?
              OR threat_type LIKE ? OR src_country LIKE ? OR dst_country LIKE ?
              OR dns_query LIKE ?
           ORDER BY timestamp DESC LIMIT ?""",
        (term, term, term, term, term, term, term, limit)
    ) as cur:
        rows = await cur.fetchall()
    return {"results": [dict(r) for r in rows], "query": q, "count": len(rows)}


@app.get("/api/interfaces")
async def list_interfaces():
    interfaces = await get_interfaces()
    return {"interfaces": interfaces}


# ---- Threat Intel ----

@app.post("/api/threat_intel/add")
async def add_threat_intel(ip: str, threat_type: str, confidence: float = 0.8, source: str = "manual"):
    db = await get_db()
    await db.execute(
        """INSERT OR REPLACE INTO threat_intel (ip, threat_type, confidence, source, last_seen)
           VALUES (?,?,?,?,?)""",
        (ip, threat_type, confidence, source, time.time())
    )
    await db.commit()
    return {"status": "added", "ip": ip}


@app.get("/api/threat_intel")
async def get_threat_intel():
    db = await get_db()
    async with db.execute("SELECT * FROM threat_intel ORDER BY last_seen DESC") as cur:
        rows = await cur.fetchall()
    return {"intel": [dict(r) for r in rows]}


# ---- DNS Log ----

@app.get("/api/dns")
async def get_dns_log(
    limit: int = Query(200, le=1000),
    offset: int = 0,
    search: Optional[str] = None,
    tracker_only: bool = False,
):
    db = await get_db()
    conditions = []
    params: list = []

    if search:
        conditions.append("query LIKE ?")
        params.append(f"%{search}%")
    if tracker_only:
        conditions.append("is_tracker = 1")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    async with db.execute(
        f"SELECT * FROM dns_log {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
        params
    ) as cur:
        rows = await cur.fetchall()

    async with db.execute(f"SELECT COUNT(*) as cnt FROM dns_log {where.split('LIMIT')[0] if 'LIMIT' in where else where}", params[:-2] if params else []) as cur:
        total_row = await cur.fetchone()
        total = total_row["cnt"] if total_row else 0

    # Top queried domains
    async with db.execute(
        "SELECT query, COUNT(*) as count, MAX(is_tracker) as is_tracker FROM dns_log GROUP BY query ORDER BY count DESC LIMIT 15"
    ) as cur:
        top_domains = [dict(r) for r in await cur.fetchall()]

    return {
        "queries": [dict(r) for r in rows],
        "total": total,
        "top_domains": top_domains,
    }


@app.get("/api/dns/stats")
async def get_dns_stats():
    db = await get_db()
    since = time.time() - 3600  # last hour
    async with db.execute("SELECT COUNT(*) as cnt FROM dns_log WHERE timestamp >= ?", (since,)) as cur:
        queries_last_hour = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM dns_log WHERE is_tracker=1") as cur:
        tracker_count = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(DISTINCT query) as cnt FROM dns_log") as cur:
        unique_domains = (await cur.fetchone())["cnt"]
    return {
        "queries_last_hour": queries_last_hour,
        "tracker_count": tracker_count,
        "unique_domains": unique_domains,
    }


# ---- Processes ----

@app.get("/api/processes")
async def get_processes():
    """Derive process-like view from connection data grouped by dst_ip/port patterns."""
    db = await get_db()
    # Group by protocol to simulate process-like breakdown
    async with db.execute(
        """SELECT
               protocol as name,
               COUNT(*) as connections,
               SUM(bytes) as bytes,
               COUNT(DISTINCT dst_ip) as unique_destinations,
               COUNT(DISTINCT dst_country) as countries,
               MIN(timestamp) as first_seen,
               MAX(timestamp) as last_seen,
               SUM(is_threat) as threats
           FROM connections
           GROUP BY protocol
           ORDER BY connections DESC"""
    ) as cur:
        by_proto = [dict(r) for r in await cur.fetchall()]

    # Top destination IPs per protocol
    async with db.execute(
        """SELECT protocol, dst_ip, dst_country, COUNT(*) as count, SUM(bytes) as bytes
           FROM connections
           GROUP BY protocol, dst_ip
           ORDER BY count DESC
           LIMIT 100"""
    ) as cur:
        ip_rows = await cur.fetchall()

    ip_map: dict[str, list] = {}
    for r in ip_rows:
        ip_map.setdefault(r["protocol"], []).append(dict(r))

    for p in by_proto:
        p["top_destinations"] = ip_map.get(p["name"], [])[:5]

    return {"processes": by_proto}


@app.get("/api/processes/{name}")
async def get_process_detail(name: str, limit: int = 100):
    db = await get_db()
    async with db.execute(
        "SELECT * FROM connections WHERE protocol=? ORDER BY timestamp DESC LIMIT ?",
        (name, limit)
    ) as cur:
        conns = [dict(r) for r in await cur.fetchall()]

    async with db.execute(
        """SELECT dst_country as country, COUNT(*) as count FROM connections
           WHERE protocol=? AND dst_country IS NOT NULL GROUP BY dst_country ORDER BY count DESC""",
        (name,)
    ) as cur:
        countries = [dict(r) for r in await cur.fetchall()]

    async with db.execute(
        """SELECT dst_ip, COUNT(*) as count, SUM(bytes) as bytes FROM connections
           WHERE protocol=? GROUP BY dst_ip ORDER BY count DESC LIMIT 10""",
        (name,)
    ) as cur:
        top_ips = [dict(r) for r in await cur.fetchall()]

    return {
        "name": name,
        "connections": conns,
        "countries": countries,
        "top_ips": top_ips,
    }


# ---- Privacy Audit ----

@app.get("/api/privacy")
async def get_privacy():
    db = await get_db()
    total_since = time.time() - 86400  # last 24h

    async with db.execute(
        "SELECT COUNT(*) as cnt FROM connections WHERE timestamp >= ?", (total_since,)
    ) as cur:
        total_conns = (await cur.fetchone())["cnt"] or 1

    # Tracker DNS queries
    async with db.execute(
        """SELECT query, category, COUNT(*) as hits
           FROM dns_log WHERE is_tracker=1 AND timestamp >= ?
           GROUP BY query ORDER BY hits DESC LIMIT 30""",
        (total_since,)
    ) as cur:
        trackers = [dict(r) for r in await cur.fetchall()]

    # Telemetry domains
    telemetry = [t for t in trackers if t["category"] == "telemetry"]
    ads = [t for t in trackers if t["category"] == "ads"]
    analytics = [t for t in trackers if t["category"] in ("analytics", "tracker")]

    tracker_hits = sum(t["hits"] for t in trackers)
    tracker_ratio = tracker_hits / max(total_conns, 1)

    # Privacy score: start at 100, deduct for tracker traffic
    score = 100
    score -= min(40, int(tracker_ratio * 200))
    score -= min(20, len(trackers) * 2)
    if telemetry:
        score -= min(15, len(telemetry) * 5)
    if ads:
        score -= min(15, len(ads) * 3)
    score = max(0, score)

    # Recommendations
    recommendations = []
    for t in trackers[:5]:
        domain = t["query"]
        cat = t["category"]
        if cat == "telemetry":
            recommendations.append(f"Block {domain} — telemetry endpoint sending usage data. Add to /etc/hosts: 0.0.0.0 {domain}")
        elif cat == "ads":
            recommendations.append(f"Block {domain} — ad network. Use a DNS-based blocker like Pi-hole.")
        elif cat in ("analytics", "tracker"):
            recommendations.append(f"Block {domain} — tracking you across sites. Consider uBlock Origin or Pi-hole.")

    if not recommendations and score == 100:
        recommendations.append("Great! No trackers detected in the last 24 hours.")

    return {
        "score": score,
        "tracker_count": len(trackers),
        "tracker_hits": tracker_hits,
        "trackers": trackers,
        "telemetry": telemetry,
        "ads": ads,
        "analytics": analytics,
        "recommendations": recommendations,
    }


# ---- Settings / Data Management ----

@app.delete("/api/connections/clear")
async def clear_connections():
    db = await get_db()
    await db.execute("DELETE FROM connections")
    await db.execute("DELETE FROM threats")
    await db.execute("DELETE FROM dns_log")
    await db.commit()
    return {"status": "cleared"}


@app.get("/api/settings")
async def get_settings():
    db = await get_db()
    async with db.execute("SELECT COUNT(*) as cnt FROM connections") as cur:
        conn_count = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM threats") as cur:
        threat_count = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM dns_log") as cur:
        dns_count = (await cur.fetchone())["cnt"]
    async with db.execute("SELECT COUNT(*) as cnt FROM threat_intel") as cur:
        intel_count = (await cur.fetchone())["cnt"]

    db_path = os.path.join(os.path.dirname(__file__), "netghost.db")
    db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    return {
        "demo_mode": is_demo_mode,
        "conn_count": conn_count,
        "threat_count": threat_count,
        "dns_count": dns_count,
        "intel_count": intel_count,
        "db_size_bytes": db_size,
        "ws_clients": len(manager.active),
    }


# ---- WebSocket ----

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    # Send recent history on connect
    db = await get_db()
    async with db.execute(
        "SELECT * FROM connections ORDER BY timestamp DESC LIMIT 50"
    ) as cur:
        rows = await cur.fetchall()

    for row in reversed(rows):
        try:
            await websocket.send_json({"type": "connection", **dict(row)})
        except Exception:
            break

    try:
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping", "ts": time.time()})
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
