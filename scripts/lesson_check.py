"""Global Class Rules check for a lesson spec (see CLASS_RULES.md). Exit code 1 = not allowed to render.

  python scripts/lesson_check.py src/japanese/specs/<id>.json [--lesson-no N]

Works on the beat-based language specs (japanese/arabic/korean). Timing checks run only after *_make.py has written a/b/len.
"""
import json, re, sys
from pathlib import Path

FPS = 30


def check(spec, n):
    err, warn = [], []
    sc = spec.get("scenes", []); types = [s.get("type") for s in sc]
    need = lambda t, why: None if t in types else err.append(f"missing scene '{t}' — {why}")
    if not types or types[0] != "hook":
        err.append("first scene must be 'hook' (cinematic real-life moment)")
    elif sc[0].get("len") and not (5 * FPS <= sc[0]["len"] <= 18 * FPS):
        warn.append(f"hook is {sc[0]['len'] / FPS:.0f}s (aim for 5–15 s)")
    if not spec.get("objective"):
        err.append("spec.objective missing — one measurable can-do sentence")
    need("title", "learning goal"); need("speak", "guided practice with mic gaps"); need("fix", "mistake recovery")
    need("context", "same skill in other real places"); need("roleplay", "real-life roleplay"); need("mission", "tangible output + real mission")
    need("reward", "reward + recap + before/after"); need("secret", "a true life hack / Bangla bridge / insider tip")
    if n > 1:
        need("recall", "spaced review of earlier lessons")
    quizzes = [s for s in sc if s.get("type") == "quiz"]
    if len(quizzes) < 3:
        err.append(f"{len(quizzes)} quiz scenes — need 3+ timed challenges")
    if quizzes and not quizzes[-1].get("boss"):
        err.append("last quiz must be the boss challenge (\"boss\": true)")
    for i, s in enumerate(sc):
        beats = s.get("beats", [])
        if s.get("type") == "roleplay" and s.get("pass") == 2 and not any(b.get("gap") for b in beats):
            err.append(f"scene {i + 1}: 'your turn' roleplay without learner gaps")
        if s.get("type") in ("quiz", "fix", "recall") and not any("hold" in b for b in beats):
            err.append(f"scene {i + 1} ({s['type']}): no pause before the answer (active recall)")
        for b in beats:
            if b.get("t") and len(b["t"]) > 420:
                warn.append(f"scene {i + 1}: teacher line of {len(b['t'])} chars — split it (no lecture blocks)")
            if b.get("frames") and b.get("t") and b["frames"] > 26 * FPS:
                warn.append(f"scene {i + 1}: teacher talks {b['frames'] / FPS:.0f}s in one go")
    if not any(s.get("type") == "speak" and any(b.get("gap") for b in s.get("beats", [])) for s in sc):
        err.append("no speak-before-reveal gap in the pronunciation lab")
    r = next((s for s in sc if s.get("type") == "reward"), None)
    if r and not (r.get("before") and r.get("after")):
        err.append("reward needs 'before' and 'after' (what the learner could not do → can do now)")
    if spec.get("total") and spec["total"] > 8 * 60 * FPS:
        warn.append(f"lesson is {spec['total'] / FPS / 60:.1f} min — keep it focused")
    return err, warn


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    p = Path(sys.argv[1]); spec = json.loads(p.read_text(encoding="utf-8"))
    n = int(sys.argv[sys.argv.index("--lesson-no") + 1]) if "--lesson-no" in sys.argv else int((re.findall(r"\d+", spec.get("id", "")) or [1])[0])
    err, warn = check(spec, n)
    for w in warn: print("⚠", w)
    for e in err: print("✗", e)
    print("✓ passes Global Class Rules" if not err else f"✗ {len(err)} rule(s) failed — fix before rendering")
    sys.exit(1 if err else 0)
