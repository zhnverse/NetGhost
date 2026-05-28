import geoip2.database
import geoip2.errors
import os
import ipaddress
from typing import Optional

CITY_DB_PATHS = [
    "/usr/lib/gophish/static/db/geolite2-city.mmdb",
    "/usr/share/GeoIP/GeoLite2-City.mmdb",
    "/var/lib/GeoIP/GeoLite2-City.mmdb",
    "/usr/local/share/GeoIP/GeoLite2-City.mmdb",
]

COUNTRY_DB_PATHS = [
    "/usr/share/ettercap/GeoLite2-Country.mmdb",
    "/usr/share/GeoIP/GeoLite2-Country.mmdb",
    "/var/lib/GeoIP/GeoLite2-Country.mmdb",
]

_city_reader: Optional[geoip2.database.Reader] = None
_country_reader: Optional[geoip2.database.Reader] = None

# Approximate coordinates for countries (fallback)
COUNTRY_COORDS = {
    "US": (37.09, -95.71), "CN": (35.86, 104.19), "GB": (55.37, -3.43),
    "DE": (51.16, 10.45), "FR": (46.22, 2.21), "JP": (36.20, 138.25),
    "RU": (61.52, 105.31), "BR": (14.23, -51.92), "IN": (20.59, 78.96),
    "AU": (-25.27, 133.77), "CA": (56.13, -106.34), "KR": (35.90, 127.76),
    "NL": (52.13, 5.29), "SG": (1.35, 103.81), "SE": (60.12, 18.64),
    "CH": (46.81, 8.22), "NO": (60.47, 8.46), "FI": (61.92, 25.74),
    "HK": (22.39, 114.10), "TW": (23.69, 120.96), "UA": (48.37, 31.16),
    "PL": (51.91, 19.14), "IT": (41.87, 12.56), "ES": (40.46, -3.74),
    "MX": (23.63, -102.55), "AR": (-38.41, -63.61), "ZA": (-30.55, 22.93),
    "NG": (9.08, 8.67), "IR": (32.42, 53.68), "TR": (38.96, 35.24),
}


def _find_db(paths: list[str]) -> Optional[str]:
    for p in paths:
        if os.path.exists(p):
            return p
    return None


def init_geoip():
    global _city_reader, _country_reader
    city_path = _find_db(CITY_DB_PATHS)
    if city_path:
        try:
            _city_reader = geoip2.database.Reader(city_path)
        except Exception:
            pass

    country_path = _find_db(COUNTRY_DB_PATHS)
    if country_path:
        try:
            _country_reader = geoip2.database.Reader(country_path)
        except Exception:
            pass


def is_private(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_private or ipaddress.ip_address(ip).is_loopback
    except ValueError:
        return False


def lookup(ip: str) -> dict:
    result = {
        "country": None, "city": None,
        "lat": None, "lon": None,
        "is_private": is_private(ip),
    }

    if result["is_private"]:
        result["country"] = "LAN"
        result["lat"] = 0.0
        result["lon"] = 0.0
        return result

    try:
        if _city_reader:
            r = _city_reader.city(ip)
            result["country"] = r.country.iso_code
            result["city"] = r.city.name
            if r.location.latitude:
                result["lat"] = r.location.latitude
                result["lon"] = r.location.longitude
        elif _country_reader:
            r = _country_reader.country(ip)
            result["country"] = r.country.iso_code
            if r.country.iso_code in COUNTRY_COORDS:
                result["lat"], result["lon"] = COUNTRY_COORDS[r.country.iso_code]
    except (geoip2.errors.AddressNotFoundError, Exception):
        pass

    if result["lat"] is None and result["country"] in COUNTRY_COORDS:
        result["lat"], result["lon"] = COUNTRY_COORDS[result["country"]]

    return result
