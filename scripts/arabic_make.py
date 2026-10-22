"""Arabic course lesson video (ArabicEngine) — voices, timing, kana word timing and mouth data for one spec. No Claude needed.

  python scripts/arabic_make.py src/arabic/specs/<id>.json    → public/arabic/<id>/ (vo/*.mp3, props.json)
  then: python scripts/arabic_cloud.py <id>                       → GitHub render → output/AI-University/Arabic/<id>.mp4

A scene is a list of beats played one after another:
  {"t": "..."}                       teacher (উস্তাদ) in Bangla — Tanvir via OpenRouter eleven-v4 (owner: realistic male voice)
  {"j": "...", "who": "F"|"M"}       native Gulf Arabic line — ElevenLabs library voices from spec.cast through OpenRouter (pay per use, owner 2026-10-22);
                                     no timestamps there, so word timing is estimated from the loudness envelope (ar_starts) and every word
                                     lights up exactly when it is spoken; "slow": true = same take at 0.75x (atempo, pitch kept)
  {"gap": true}                      learner speaks: as long as the Arabic line before it (or after it, in a roleplay) × 1.4 + 1.2 s
  {"hold": n}                        n frames of silence (quiz countdown, pauses)
Each beat gets a/b (frames inside the scene); the scene length and spec.total are written back into the spec.
Audio is cached by text hash in work/arabic/<id>/cache.
"""
import base64, hashlib, json, math, os, subprocess, sys
from pathlib import Path
import numpy as np
import requests

ROOT = Path(__file__).resolve().parents[1]
FPS, LEAD, TAIL, SP = 30, 12, 16, 8  # = ArabicEngine.tsx
TANVIR = "SamfdZr6Xh6ZtPUGZUhg"


def env():  # video-studio/.env locally; in GitHub Actions the keys come from repo secrets (environment)
    e = {}
    if (ROOT / ".env").exists():
        for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1); e[k.strip()] = v.strip().strip('"')
    for k in ("ELEVENLABS_API_KEY", "OPENROUTER_API_KEY", "OR_BASE"):
        if os.environ.get(k):
            e[k] = os.environ[k]
    return e


E = env()
KEY = E["ELEVENLABS_API_KEY"]
# Teacher (Bangla) lines go through OpenRouter's ElevenLabs (eleven-v4, ≈$0.02 per 1k chars) so the ElevenLabs plan quota is kept
# for the native Arabic lines (library voices + per-character timestamps only work direct). AR_TEACHER=direct switches back.
TEACHER_VIA = os.environ.get("AR_TEACHER", "openrouter")


NATIVE_VIA = os.environ.get("AR_NATIVE", "openrouter")  # owner 2026-10-22: ElevenLabs through OpenRouter (pay per use) for native lines too
HARAKAT = set("ًٌٍَُِّْٰـ")
PAUSE = set("،؟.!?:؛")


def ar_starts(text, amp):
    """Start frame of every character when no TTS timestamps exist (OpenRouter): spread the letters over the voiced part of the
    loudness envelope. Harakat take no time, a space is a short joint, punctuation is a pause. The engine lights whole words
    (right to left), so per-word accuracy is what matters."""
    voiced = [i for i, c in enumerate(amp) if c != "0"]
    a, b = (voiced[0], voiced[-1] + 1) if voiced else (0, max(1, len(amp)))
    w = [0.0 if c in HARAKAT else 1.6 if c in PAUSE else 0.5 if c == " " else 1.0 for c in text]
    tot = sum(w) or 1; out, acc = [], 0.0
    for x in w:
        out.append(round(a + (b - a) * acc / tot)); acc += x
    return out


def or_tts(text, voice, cache):
    out = cache / (hashlib.sha1(f"or|{voice}|{text}".encode()).hexdigest()[:16] + ".mp3")
    if out.exists() and out.stat().st_size > 2000:
        return out
    base = E.get("OR_BASE", "https://openrouter.ai/api/v1").rstrip("/")
    for _ in range(5):
        try:
            r = requests.post(base + "/audio/speech", headers={"Authorization": "Bearer " + E["OPENROUTER_API_KEY"]}, timeout=300,
                              json={"model": "elevenlabs/eleven-v4", "input": text, "voice": voice, "response_format": "mp3"})
        except requests.RequestException:
            continue
        if r.ok and len(r.content) > 2000:
            out.write_bytes(r.content); return out
        print("  ! or-tts", r.status_code, r.text[:160], flush=True)
    sys.exit(f"tts failed: {text[:50]}")


def tts(text, voice, lang, cache, prev=None):
    """→ (mp3 path, char start times in seconds or None)"""
    h = hashlib.sha1(f"{voice}|{lang}|{text}|{prev or ''}".encode()).hexdigest()[:16]
    mp3, js = cache / f"{h}.mp3", cache / f"{h}.json"
    if mp3.exists() and mp3.stat().st_size > 2000:
        return mp3, json.loads(js.read_text(encoding="utf-8")) if js.exists() else None
    body = {"text": text, "model_id": "eleven_v4", "language_code": lang}
    if prev:
        body["previous_text"] = prev
    for _ in range(4):
        r = requests.post(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_192",
                          headers={"xi-api-key": KEY}, json=body, timeout=300)
        if r.ok:
            d = r.json(); mp3.write_bytes(base64.b64decode(d["audio_base64"]))
            al = d.get("alignment") or {}
            ts = {"c": al.get("characters", []), "s": al.get("character_start_times_seconds", []), "e": al.get("character_end_times_seconds", [])}
            js.write_text(json.dumps(ts, ensure_ascii=False), encoding="utf-8"); return mp3, ts
        print("  ! tts", r.status_code, r.text[:160], flush=True)
    sys.exit(f"tts failed: {text[:50]}")


def run(*a):
    subprocess.run(["ffmpeg", "-y", "-v", "error", *a], check=True)


def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))


def envelope(p):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    hop = 16000 // FPS; n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1)) if n else np.zeros(1)
    ref = np.percentile(rms, 95) or 1
    return "".join(str(int(min(9, round(9 * min(1, r / ref) ** 0.8)))) if r > ref * 0.08 else "0" for r in rms)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    sp = ROOT / sys.argv[1]; spec = json.loads(sp.read_text(encoding="utf-8")); sid = spec["id"]
    pub = ROOT / "public/arabic" / sid / "vo"; pub.mkdir(parents=True, exist_ok=True)
    cache = ROOT / "work/arabic" / sid / "cache"; cache.mkdir(parents=True, exist_ok=True)
    cast = spec["cast"]; chars = 0
    for si, s in enumerate(spec["scenes"]):
        prev_t = None
        for bi, b in enumerate(s["beats"]):
            name = f"s{si + 1:02d}_{bi + 1:02d}.mp3"
            if "t" in b:
                raw = or_tts(b["t"], TANVIR, cache) if TEACHER_VIA == "openrouter" else tts(b["t"], TANVIR, "bn", cache, prev_t)[0]
                prev_t = b["t"]; chars += len(b["t"])
                run("-i", str(raw), "-ac", "1", "-ar", "44100", "-af", "loudnorm=I=-15:TP=-1.5", "-b:a", "160k", str(pub / name))
            elif "j" in b:
                k = 0.75 if b.get("slow") else 1.0; chars += len(b["j"])
                if NATIVE_VIA == "openrouter":  # pay-per-use, no plan quota; no timestamps → estimated from the loudness below
                    raw, ts = or_tts(b["j"], cast[b["who"]]["voice"], cache), None
                else:
                    raw, ts = tts(b["j"], cast[b["who"]]["voice"], "ar", cache)
                af = (f"atempo={k}," if k != 1 else "") + "loudnorm=I=-14:TP=-1.5"
                run("-i", str(raw), "-ac", "1", "-ar", "44100", "-af", af, "-b:a", "160k", str(pub / name))
                if ts and ts["s"]:  # frame (inside the line) at which each character of the text starts
                    b["cs"] = [round(t / k * FPS) for t in ts["s"]]; b["cc"] = "".join(ts["c"])
            else:
                continue
            b["file"] = f"vo/{name}"; b["frames"] = math.ceil(dur(pub / name) * FPS) + 2; b["amp"] = envelope(pub / name)
            if "j" in b and "cs" not in b:
                b["cs"] = ar_starts(b["j"], b["amp"]); b["cc"] = b["j"]
        # timeline
        t = LEAD; beats = s["beats"]
        for bi, b in enumerate(beats):
            if b.get("gap"):
                ref = next((x for x in (beats[bi + 1:] if s["type"] == "roleplay" else reversed(beats[:bi])) if "j" in x), None)
                b["frames"] = round((ref["frames"] if ref else 60) * 1.4) + 36
            elif "hold" in b:
                b["frames"] = b["hold"]
            b["a"] = t; b["b"] = t + b["frames"]; t = b["b"] + SP
        s["len"] = t - SP + TAIL
    spec["total"] = sum(s["len"] for s in spec["scenes"]) + 20
    sp.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    (pub.parent / "props.json").write_text(json.dumps({"spec": spec}, ensure_ascii=False), encoding="utf-8")
    print(f"✓ {sid}: {len(spec['scenes'])} scenes, {spec['total'] / FPS:.0f}s, {chars} characters voiced")


if __name__ == "__main__":
    main()
