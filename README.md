# NetGhost 👻

A personal network traffic visualizer and threat detector. Captures live packets, plots connections on a 3D rotating globe, flags suspicious activity, and lets you hunt through your traffic history.

![NetGhost Globe](screenshot.png)

## Features

- **3D Globe** — real-time connection arcs from your machine to destination IPs worldwide
- **Live Feed** — scrolling packet stream with protocol badges, filterable by IP/protocol/country
- **Threat Detection** — flags suspicious ports (Metasploit, Tor, RATs, C2), port scans, large outbound transfers
- **Analytics** — connection timeline, protocol breakdown, top countries and destination IPs
- **Hunt** — free-text search across all captured traffic (IP, protocol, country, threat type, DNS query)
- **DNS Log** — every DNS query logged, tracker/ad/telemetry domains highlighted
- **Privacy Audit** — privacy score (0–100) with tracker, ad network, and telemetry breakdown + recommendations
- **Protocols** — bandwidth and connection breakdown by protocol with destination detail
- **Settings** — database stats, data clear, capture instructions

## Architecture

```
NetGhost/
├── backend/          # Python · FastAPI · SQLite (aiosqlite)
│   ├── main.py       # All API routes + WebSocket + capture loop
│   ├── capture.py    # tshark packet capture → falls back to demo mode
│   ├── threat_engine.py  # Threat scoring, port scan detection
│   ├── geoip_service.py  # MaxMind GeoLite2 + coordinate fallback
│   └── database.py   # Schema + migrations
├── frontend/         # React 19 · Vite · TypeScript
│   └── src/
│       ├── components/   # Globe3D, Analytics, DNSLog, Privacy, ...
│       ├── hooks/        # useWebSocket (auto-reconnect)
│       └── store.ts      # Zustand global state
└── start.sh          # Launches backend + frontend
```

**Backend** runs on `:8000` (FastAPI + uvicorn).  
**Frontend** runs on `:5173` (Vite dev server, proxies `/api` and `/ws` to backend).  
**Capture** uses `tshark` for real packet capture; auto-falls back to demo mode if unavailable or no permission.

## Quick Start

### Requirements

- Python 3.11+
- Node.js 18+
- tshark (optional — for live capture)

```bash
# Install tshark (Kali / Debian / Ubuntu)
sudo apt install tshark -y

# Allow capture without root
sudo usermod -aG wireshark $USER && newgrp wireshark
```

### Install

```bash
git clone https://github.com/zhnverse/NetGhost.git
cd NetGhost

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Run

```bash
./start.sh
```

Then open **http://localhost:5173**.

> **No tshark / no root?** The app auto-starts in **demo mode** — simulated realistic traffic with trackers, threats, and geo data so every feature works out of the box.

## Pages

| Tab | What it shows |
|-----|---------------|
| 🌍 Globe | 3D earth with live arcs. Green = HTTPS, purple = DNS, red = threat |
| 📡 Live Feed | Real-time packet stream. Filter by IP, protocol, country |
| ⚠️ Threats | Flagged connections by severity. Click → investigate in Hunt |
| 📊 Analytics | Timeline chart, protocol pie, top countries, top IPs |
| 🔍 Hunt | Search: type an IP, country code, protocol, or port number |
| 🌐 DNS Log | Every DNS query. Trackers highlighted in orange |
| 🖥️ Protocols | Network usage grouped by protocol with destination breakdown |
| 🔒 Privacy | Score gauge + tracker/ad/telemetry lists + block recommendations |
| ⚙️ Settings | DB size, clear data, capture instructions, quick-reference commands |

## Hunt Examples

```
8.8.8.8          # all traffic to Google DNS
protocol:DNS     # DNS queries only
CN               # connections to China
4444             # Metasploit default port
port_scan        # detected port scans
reverse_shell    # reverse shell indicators
```

## API

The backend exposes a REST API at `http://localhost:8000`:

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Live stats: connections, threats, bytes |
| `GET /api/connections` | Paginated connection log |
| `GET /api/threats` | Threat events |
| `GET /api/dns` | DNS query log |
| `GET /api/hunt?q=` | Full-text search |
| `GET /api/processes` | Protocol-grouped network stats |
| `GET /api/privacy` | Privacy score + tracker breakdown |
| `GET /api/stats/geo` | Top destination countries |
| `GET /api/stats/timeline` | Connections over time |
| `WS  /ws` | Live connection stream |
| `DELETE /api/connections/clear` | Clear all data |

Interactive docs: **http://localhost:8000/docs**

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | Python, FastAPI, uvicorn, aiosqlite, tshark |
| Frontend | React 19, Vite, TypeScript, Zustand, Recharts, globe.gl |
| Database | SQLite (WAL mode) |
| GeoIP | MaxMind GeoLite2 (auto-detected) + coordinate fallback |
| Styling | CSS variables, dark theme |

## License

MIT
