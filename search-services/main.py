import hmac
import logging
import os
import threading
import time

from ddgs import DDGS
from ddgs.exceptions import DDGSException, RatelimitException
from fastapi import FastAPI, Header, HTTPException, Query

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("search")

SECRET = os.environ.get("SEARCH_SERVICE_SECRET", "")
BACKEND = os.environ.get("DDGS_BACKEND", "auto")
MIN_GAP = float(os.environ.get("SEARCH_MIN_GAP", "3"))
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


@app.get("/health")
def health():
    return {
        "ok": True,
        "backend": BACKEND,
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
            raise HTTPException(status_code=503, detail="Search is paused after being blocked")

        wait = MIN_GAP - (now - state["last"])
        if wait > 0:
            time.sleep(wait)

        try:
            raw = DDGS(timeout=10).text(query, max_results=limit, backend=BACKEND)
            state["fails"] = 0
        except RatelimitException as e:
            log.error("rate limited: %r", e)
            trip(BREAKER_SECONDS)
            raise HTTPException(status_code=503, detail="The search engines rate limited the request")
        except DDGSException as e:
            if "no results" in str(e).lower():
                raw = []
            else:
                log.exception("ddgs failed backend=%s query=%r", BACKEND, query)
                register_failure()
                raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {str(e)[:200]}")
        except Exception as e:
            log.exception("unexpected failure backend=%s query=%r", BACKEND, query)
            register_failure()
            raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {str(e)[:200]}")
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
