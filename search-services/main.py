import hmac
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request

from ddgs import DDGS
from ddgs.exceptions import DDGSException, RatelimitException
from fastapi import FastAPI, Header, HTTPException, Query

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("search")

SECRET = os.environ.get("SEARCH_SERVICE_SECRET", "")
SERPER_KEY = os.environ.get("SERPER_API_KEY", "")
BRAVE_KEY = os.environ.get("BRAVE_API_KEY", "")
DDGS_PROXY = os.environ.get("DDGS_PROXY", "") or None
BACKENDS = [
    b.strip()
    for b in os.environ.get("DDGS_BACKENDS", "startpage,duckduckgo,yahoo").split(",")
    if b.strip()
]
BACKEND_TIMEOUT = float(os.environ.get("DDGS_TIMEOUT", "8"))
DEADLINE = float(os.environ.get("SEARCH_DEADLINE", "18"))
MIN_GAP = float(os.environ.get("SEARCH_MIN_GAP", "1"))
CACHE_TTL = float(os.environ.get("SEARCH_CACHE_TTL", "600"))
BREAKER_SECONDS = float(os.environ.get("SEARCH_BREAKER_SECONDS", "900"))
FAIL_LIMIT = 3
CACHE_MAX = 300

app = FastAPI()
lock = threading.Lock()
cache = {}
state = {"last": 0.0, "blocked_until": 0.0, "fails": 0}


def check_key(key):
    if SECRET and not hmac.compare_digest(key or "", SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")


def trip(seconds):
    state["blocked_until"] = time.time() + seconds
    state["fails"] = 0


def register_failure():
    state["fails"] += 1
    if state["fails"] >= FAIL_LIMIT:
        trip(BREAKER_SECONDS / 3)


def http_json(req, timeout):
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def serper(query, limit):
    req = urllib.request.Request(
        "https://google.serper.dev/search",
        data=json.dumps({"q": query, "num": limit}).encode("utf-8"),
        headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    data = http_json(req, 10)
    return [
        {"title": x.get("title", ""), "href": x.get("link", ""), "body": x.get("snippet", "")}
        for x in data.get("organic", [])
    ]


def brave(query, limit):
    params = urllib.parse.urlencode({"q": query, "count": limit})
    req = urllib.request.Request(
        f"https://api.search.brave.com/res/v1/web/search?{params}",
        headers={"X-Subscription-Token": BRAVE_KEY, "Accept": "application/json"},
    )
    data = http_json(req, 10)
    return [
        {"title": x.get("title", ""), "href": x.get("url", ""), "body": x.get("description", "")}
        for x in data.get("web", {}).get("results", [])
    ]


def ddgs_backend(name):
    def run(query, limit):
        return DDGS(timeout=BACKEND_TIMEOUT, proxy=DDGS_PROXY).text(
            query, max_results=limit, backend=name
        )

    return run


def providers():
    out = []
    if SERPER_KEY:
        out.append(("serper", serper))
    if BRAVE_KEY:
        out.append(("brave", brave))
    for b in BACKENDS:
        out.append((f"ddgs:{b}", ddgs_backend(b)))
    return out


def run_providers(query, limit):
    started = time.time()
    tried = 0
    last_err = None

    for name, fn in providers():
        if tried and time.time() - started > DEADLINE:
            break
        tried += 1
        try:
            found = fn(query, limit)
            if found:
                log.info("provider=%s ok count=%d", name, len(found))
                return found
            log.info("provider=%s returned nothing", name)
        except RatelimitException as e:
            last_err = e
            log.warning("provider=%s rate limited: %r", name, e)
        except DDGSException as e:
            if "no results" in str(e).lower():
                log.info("provider=%s no results", name)
            else:
                last_err = e
                log.warning("provider=%s failed: %s: %s", name, type(e).__name__, e)
        except urllib.error.HTTPError as e:
            last_err = e
            log.warning("provider=%s http %s", name, e.code)
        except Exception as e:
            last_err = e
            log.warning("provider=%s unexpected: %s: %s", name, type(e).__name__, e)

    if last_err is None:
        return []

    register_failure()
    raise HTTPException(
        status_code=502,
        detail=f"{type(last_err).__name__}: {str(last_err)[:200]}",
    )


@app.get("/health")
def health():
    return {
        "ok": True,
        "providers": [n for n, _ in providers()],
        "fails": state["fails"],
        "blocked_for": max(0, round(state["blocked_until"] - time.time())),
    }


@app.post("/reset")
def reset(x_service_key: str = Header(default="")):
    check_key(x_service_key)
    state["blocked_until"] = 0.0
    state["fails"] = 0
    cache.clear()
    return {"ok": True}


@app.get("/search")
def search(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(8, ge=1, le=15, alias="max"),
    x_service_key: str = Header(default=""),
):
    check_key(x_service_key)

    query = q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    key = (query.lower(), limit)
    hit = cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL:
        return {"results": hit[1], "cached": True}

    with lock:
        now = time.time()

        if now < state["blocked_until"]:
            raise HTTPException(status_code=503, detail="Search is paused after repeated failures")

        wait = MIN_GAP - (now - state["last"])
        if wait > 0:
            time.sleep(wait)

        try:
            raw = run_providers(query, limit)
            state["fails"] = 0
        finally:
            state["last"] = time.time()

    results = [
        {
            "title": str(r.get("title", "")).strip(),
            "url": r.get("href", ""),
            "snippet": str(r.get("body", "")).strip()[:300],
            "source": "web",
        }
        for r in (raw or [])
        if r.get("href") and r.get("title")
    ]

    if results:
        if len(cache) > CACHE_MAX:
            cache.pop(next(iter(cache)))
        cache[key] = (time.time(), results)

    return {"results": results}
