"""Standalone LLM router for video-studio scripts (works locally and in GitHub Actions). Same idea as ai-university/educator/llm.py.

  from ai_router import ask_json
  data = ask_json(["or:google/gemini-4-argon", "claude:claude-sonnet-5-5"], system, user)

Keys come from the environment (Actions secrets) or video-studio/.env: OPENROUTER_API_KEY, ANTHROPIC_API_KEY.
"claude:" candidates are skipped when ANTHROPIC_API_KEY is missing, when spend in work/claude_spend.json passes CLAUDE_BUDGET
(default $95), or after a credit/billing error. Any failure moves to the next candidate. Broken JSON is repaired by a cheap model.
"""
import datetime, json, os, re, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
LEDGER = Path(os.environ.get("CLAUDE_LEDGER", ROOT / "work" / "claude_spend.json"))
BUDGET = float(os.environ.get("CLAUDE_BUDGET", "95"))
PRICE = {"claude-opus-5-5": (4, 20), "claude-sonnet-5-5": (2, 10), "claude-haiku-5-5": (0.1, 0.5)}
SPENT = {"or": 0.0, "claude": 0.0}
_env = None


def key(name):
    global _env
    if os.environ.get(name):
        return os.environ[name]
    if _env is None:
        _env = {}
        f = ROOT / ".env"
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.lstrip().startswith("#"):
                    k, v = line.split("=", 1); _env[k.strip()] = v.strip().strip('"')
    return _env.get(name, "")


def log(*a):
    print(*a, flush=True)


def _openrouter(model, system, user, max_tokens, json_mode):
    body = {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "max_tokens": max_tokens, "temperature": 0.4}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    for t in range(3):
        r = requests.post("https://openrouter.ai/api/v1/chat/completions", timeout=900, json=body,
                          headers={"Authorization": "Bearer " + key("OPENROUTER_API_KEY"), "X-Title": "AIU course factory"})
        if r.status_code in (429, 500, 502, 503, 504):
            log(f"    ! {model} HTTP {r.status_code}"); time.sleep(10 * (t + 1)); continue
        r.raise_for_status(); d = r.json()
        u = d.get("usage", {}); SPENT["or"] += float(u.get("cost") or 0)
        log(f"    · {model.split('/')[-1]} {u.get('prompt_tokens', '?')}→{u.get('completion_tokens', '?')} tok")
        return d["choices"][0]["message"].get("content") or ""
    raise RuntimeError(f"{model} kept failing")


def _ledger():
    try:
        return json.loads(LEDGER.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"total": 0.0, "calls": 0, "off_until": ""}


def _claude(model, system, user, max_tokens):
    import anthropic
    led = _ledger(); today = datetime.date.today().isoformat()
    if not key("ANTHROPIC_API_KEY") or led["total"] >= BUDGET or (led.get("off_until") or "") >= today:
        raise RuntimeError("claude off")
    c = anthropic.Anthropic(api_key=key("ANTHROPIC_API_KEY"), max_retries=2, timeout=900)
    try:
        with c.messages.stream(model=model, max_tokens=max_tokens, system=system, messages=[{"role": "user", "content": user}]) as st:
            r = st.get_final_message()
    except Exception as e:  # noqa: BLE001
        if any(w in str(e).lower() for w in ("credit", "billing", "quota", "permission", "authentication")):
            led["off_until"] = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
            LEDGER.parent.mkdir(parents=True, exist_ok=True); LEDGER.write_text(json.dumps(led), encoding="utf-8")
        raise
    pi, po = PRICE.get(model, (4, 20)); cost = (r.usage.input_tokens * pi + r.usage.output_tokens * po) / 1e6
    led["total"] = round(led["total"] + cost, 4); led["calls"] += 1
    LEDGER.parent.mkdir(parents=True, exist_ok=True); LEDGER.write_text(json.dumps(led), encoding="utf-8")
    SPENT["claude"] += cost; log(f"    · {model} ${cost:.3f}")
    if r.stop_reason == "refusal":
        raise RuntimeError("refusal")
    return "".join(b.text for b in r.content if b.type == "text")


def _parse(text):
    m = re.search(r"\{.*\}", text, re.S); raw = m.group(0) if m else text
    try:
        return json.loads(raw)
    except ValueError:
        fixed = _openrouter("openai/gpt-6-luna", "Fix this broken JSON. Keep every value exactly; only repair syntax. Return the JSON only.", raw, 32000, True)
        log("    · JSON repaired"); return json.loads(re.search(r"\{.*\}", fixed, re.S).group(0))


def ask_json(cands, system, user, max_tokens=24000):
    last = None
    for c in cands:
        prov, model = c.split(":", 1)
        try:
            text = _claude(model, system + "\nAnswer with ONE JSON object only.", user, max_tokens) if prov == "claude" \
                else _openrouter(model, system + "\nAnswer with ONE JSON object only.", user, max_tokens, True)
            out = _parse(text)
            if isinstance(out, dict) and len(json.dumps(out)) > 40:
                return out
            raise ValueError("empty answer")
        except Exception as e:  # noqa: BLE001
            last = e; log(f"    ! {c}: {str(e)[:140]} → next")
    raise RuntimeError(f"all models failed: {last}")
