import aiosqlite
import asyncio
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "netghost.db")

CREATE_CONNECTIONS = """
CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    src_ip TEXT NOT NULL,
    dst_ip TEXT NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol TEXT,
    bytes INTEGER DEFAULT 0,
    packets INTEGER DEFAULT 1,
    src_country TEXT,
    src_city TEXT,
    src_lat REAL,
    src_lon REAL,
    dst_country TEXT,
    dst_city TEXT,
    dst_lat REAL,
    dst_lon REAL,
    is_threat INTEGER DEFAULT 0,
    threat_type TEXT,
    threat_score REAL DEFAULT 0.0,
    hostname TEXT
)
"""

CREATE_THREATS = """
CREATE TABLE IF NOT EXISTS threats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    ip TEXT NOT NULL,
    threat_type TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium',
    connection_id INTEGER,
    FOREIGN KEY(connection_id) REFERENCES connections(id)
)
"""

CREATE_THREAT_INTEL = """
CREATE TABLE IF NOT EXISTS threat_intel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE NOT NULL,
    threat_type TEXT,
    confidence REAL DEFAULT 0.5,
    source TEXT,
    last_seen REAL
)
"""

CREATE_DNS = """
CREATE TABLE IF NOT EXISTS dns_cache (
    ip TEXT PRIMARY KEY,
    hostname TEXT,
    resolved_at REAL
)
"""

CREATE_DNS_LOG = """
CREATE TABLE IF NOT EXISTS dns_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp REAL NOT NULL,
    query TEXT NOT NULL,
    src_ip TEXT,
    dst_ip TEXT,
    response_ip TEXT,
    is_tracker INTEGER DEFAULT 0,
    category TEXT
)
"""

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA synchronous=NORMAL")
        await _db.execute(CREATE_CONNECTIONS)
        await _db.execute(CREATE_THREATS)
        await _db.execute(CREATE_THREAT_INTEL)
        await _db.execute(CREATE_DNS)
        await _db.execute(CREATE_DNS_LOG)
        await _db.execute("CREATE INDEX IF NOT EXISTS idx_conn_ts ON connections(timestamp)")
        await _db.execute("CREATE INDEX IF NOT EXISTS idx_conn_src ON connections(src_ip)")
        await _db.execute("CREATE INDEX IF NOT EXISTS idx_conn_threat ON connections(is_threat)")
        await _db.execute("CREATE INDEX IF NOT EXISTS idx_threats_ip ON threats(ip)")
        await _db.execute("CREATE INDEX IF NOT EXISTS idx_dns_ts ON dns_log(timestamp)")
        # Add dns_query column to connections if it doesn't exist (migration)
        try:
            await _db.execute("ALTER TABLE connections ADD COLUMN dns_query TEXT")
        except Exception:
            pass
        await _db.commit()
    return _db


async def close_db():
    global _db
    if _db:
        await _db.close()
        _db = None
