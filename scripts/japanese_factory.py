"""Japanese course factory — makes the board-designed lessons one after another, unattended (locally or in GitHub Actions).

  python scripts/japanese_factory.py [--max 4] [--only 3,4] [--upload]

Per lesson n (jpw-NN), in order, skipping lessons already in src/japanese/factory.json "done":
  1. scripts/japanese_specs.py n   (AI spec + validation + Japanese accuracy review + lesson_check; kept if it already exists)
  2. scripts/japanese_make.py      (Bangla teacher via OpenRouter, native Japanese via ElevenLabs with timestamps)
  3. scripts/japanese_cloud.py     (free chunked render on the public render repo) → output/AI-University/Japanese/jpw-NN.mp4
  4. --upload: the MP4 becomes an asset of release "japanese-course" in this factory repo (private), the spec + state are committed.
A failing lesson is recorded (tries++) and skipped after 3 tries; later lessons still run. Spend is printed per lesson.
In CI (env CI=true) every finished lesson is committed and pushed at once, so a timeout never loses work.
"""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "src/japanese/factory.json"
TOTAL = 30
OUT = ROOT / "output/AI-University/Japanese"


def run(*cmd, check=True):
    r = subprocess.run(cmd, cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True)
    print((r.stdout or "")[-1500:], (r.stderr or "")[-800:], flush=True)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(map(str, cmd[:3]))} failed")
    return r


def load():
    return json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"done": [], "failed": {}}


def save(st):
    STATE.write_text(json.dumps(st, indent=1), encoding="utf-8")


def commit(msg):
    if os.environ.get("CI") != "true":
        return
    paths = [p for p in ("src/japanese/specs", "src/japanese/factory.json", "src/japanese/claude_spend.json") if (ROOT / p).exists()]
    run("git", "add", *paths, check=False)  # a missing path would make git add stage nothing at all
    run("git", "-c", "user.email=factory@aiuniversitybd.com", "-c", "user.name=AIU course factory", "commit", "-q", "-m", msg, check=False)
    run("git", "pull", "-q", "--rebase", check=False); run("git", "push", "-q", check=False)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = argparse.ArgumentParser(); a.add_argument("--max", type=int, default=4); a.add_argument("--only", default=""); a.add_argument("--upload", action="store_true")
    a = a.parse_args()
    st = load()
    if a.upload:  # the videos already in the private release are the truth (parallel runs can lose factory.json commits)
        repo = os.environ.get("FACTORY_REPO", "Dreamint99/aiu-course-videos")
        r = run("gh", "release", "view", "japanese-course", "-R", repo, "--json", "assets", "-q", ".assets[].name", check=False)
        have = {int(m) for m in re.findall(r"jpw-(\d+)\.mp4", r.stdout or "")}
        st["done"] = sorted(set(st["done"]) | have)
    todo = [int(x) for x in a.only.split(",") if x and int(x) not in st["done"]] or ([] if a.only else [n for n in range(1, TOTAL + 1) if n not in st["done"]])
    todo = [n for n in todo if st["failed"].get(str(n), 0) < 3][: a.max]
    print(f"factory: {len(st['done'])}/{TOTAL} done, this run: {todo}", flush=True)
    for n in todo:
        lid = f"jpw-{n:02d}"; t0 = time.time()
        try:
            run(sys.executable, "scripts/japanese_specs.py", str(n))
            run(sys.executable, "scripts/japanese_make.py", f"src/japanese/specs/{lid}.json")
            run(sys.executable, "scripts/lesson_check.py", f"src/japanese/specs/{lid}.json", "--lesson-no", str(n))
            run(sys.executable, "scripts/japanese_cloud.py", lid, "--chunks", "8")
            mp4 = OUT / f"{lid}.mp4"
            if not mp4.exists():
                raise RuntimeError("no mp4 after render")
            if a.upload:
                repo = os.environ.get("FACTORY_REPO", "Dreamint99/aiu-course-factory")
                if run("gh", "release", "view", "japanese-course", "-R", repo, check=False).returncode:
                    run("gh", "release", "create", "japanese-course", "-R", repo, "-t", "Japanese course videos", "-n", "Finished lesson videos (private).")
                run("gh", "release", "upload", "japanese-course", str(mp4), "-R", repo, "--clobber")
            st["done"] = sorted(set(st["done"]) | {n}); st["failed"].pop(str(n), None)
            print(f"✓ {lid} in {int(time.time() - t0)}s", flush=True)
        except Exception as e:  # noqa: BLE001
            st["failed"][str(n)] = st["failed"].get(str(n), 0) + 1
            print(f"✗ {lid}: {e}", flush=True)
        save(st); commit(f"{lid}: {'done' if n in st['done'] else 'failed'}")
    print(f"factory: {len(st['done'])}/{TOTAL} done", flush=True)


if __name__ == "__main__":
    main()
