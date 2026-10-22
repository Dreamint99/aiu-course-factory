"""Korean course factory — makes the board-designed lessons one after another, unattended (locally or in GitHub Actions).

  python scripts/korean_factory.py [--max 4] [--only 3,4] [--upload]

Per lesson n (koe-NN), in order, skipping lessons already in src/korean/factory.json "done":
  1. scripts/korean_specs.py n   (AI spec + validation + Korean accuracy review + lesson_check; kept if it already exists)
  2. scripts/korean_make.py      (Bangla teacher via OpenRouter, native Korean via ElevenLabs with timestamps)
  3. scripts/korean_cloud.py     (free chunked render on the public render repo) → output/AI-University/Korean/koe-NN.mp4
  4. --upload: the MP4 becomes an asset of release "korean-course" in this factory repo (private), the spec + state are committed.
A failing lesson is recorded (tries++) and skipped after 3 tries; later lessons still run. Spend is printed per lesson.
In CI (env CI=true) every finished lesson is committed and pushed at once, so a timeout never loses work.
"""
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "src/korean/factory"  # one small file per lesson (NN.json) so parallel runs never conflict on a shared state file
TOTAL = 30
OUT = ROOT / "output/AI-University/Korean"


def run(*cmd, check=True):
    r = subprocess.run(cmd, cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True)
    print((r.stdout or "")[-1500:], (r.stderr or "")[-800:], flush=True)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(map(str, cmd[:3]))} failed")
    return r


def load():
    st = {"done": [], "failed": {}}
    for f in STATE.glob("*.json") if STATE.exists() else []:
        x = json.loads(f.read_text(encoding="utf-8")); n = int(f.stem)
        if x.get("done"):
            st["done"].append(n)
        elif x.get("tries"):
            st["failed"][str(n)] = x["tries"]
    st["done"].sort()
    return st


def save_one(n, done, tries):
    STATE.mkdir(parents=True, exist_ok=True)
    (STATE / f"{n:02d}.json").write_text(json.dumps({"done": done, "tries": tries}), encoding="utf-8")


def commit(msg):
    if os.environ.get("CI") != "true":
        return
    paths = [p for p in ("src/korean/specs", "src/korean/factory", "src/korean/claude_spend.json") if (ROOT / p).exists()]
    run("git", "add", *paths, check=False)  # a missing path would make git add stage nothing at all
    run("git", "-c", "user.email=factory@aiuniversitybd.com", "-c", "user.name=AIU course factory", "commit", "-q", "-m", msg, check=False)
    run("git", "pull", "-q", "--rebase", check=False); run("git", "push", "-q", check=False)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    a = argparse.ArgumentParser(); a.add_argument("--max", type=int, default=4); a.add_argument("--only", default=""); a.add_argument("--upload", action="store_true"); a.add_argument("--specs-only", action="store_true")
    a = a.parse_args()
    st = load()
    if a.upload:  # the videos already in the private release are the truth
        repo = os.environ.get("FACTORY_REPO", "Dreamint99/aiu-course-videos")
        r = run("gh", "release", "view", "korean-course", "-R", repo, "--json", "assets", "-q", ".assets[].name", check=False)
        st["done"] = sorted(set(st["done"]) | {int(m) for m in re.findall(r"koe-(\d+)\.mp4", r.stdout or "") if m != "01"} | ({1} if "koe-01b.mp4" in (r.stdout or "") else set()))  # koe-01 = hand-made, lesson 1 is koe-01b
    todo = [int(x) for x in a.only.split(",") if x and int(x) not in st["done"]] or ([] if a.only else [n for n in range(1, TOTAL + 1) if n not in st["done"]])
    if a.specs_only:  # specs already written count as done here, so every run moves on to new lessons
        todo = [n for n in todo if not (ROOT / "src/korean/specs" / f"{'koe-01b' if n == 1 else f'koe-{n:02d}'}.json").exists()]
    todo = [n for n in todo if st["failed"].get(str(n), 0) < 3][: a.max]
    print(f"factory: {len(st['done'])}/{TOTAL} done, this run: {todo}", flush=True)
    for n in todo:
        lid = "koe-01b" if n == 1 else f"koe-{n:02d}"; t0 = time.time()
        try:
            run(sys.executable, "scripts/korean_specs.py", str(n))
            if a.specs_only:  # write every spec now (free/cheap text models); voices + renders later when TTS credit is there
                print(f"✓ {lid} spec ready", flush=True); continue
            run(sys.executable, "scripts/korean_make.py", f"src/korean/specs/{lid}.json")
            run(sys.executable, "scripts/lesson_check.py", f"src/korean/specs/{lid}.json", "--lesson-no", str(n))
            run(sys.executable, "scripts/korean_cloud.py", lid, "--chunks", "8")
            mp4 = OUT / f"{lid}.mp4"
            if not mp4.exists():
                raise RuntimeError("no mp4 after render")
            if a.upload:
                repo = os.environ.get("FACTORY_REPO", "Dreamint99/aiu-course-factory")
                if run("gh", "release", "view", "korean-course", "-R", repo, check=False).returncode:
                    run("gh", "release", "create", "korean-course", "-R", repo, "-t", "Korean course videos", "-n", "Finished lesson videos (private).")
                run("gh", "release", "upload", "korean-course", str(mp4), "-R", repo, "--clobber")
            st["done"] = sorted(set(st["done"]) | {n}); st["failed"].pop(str(n), None)
            print(f"✓ {lid} in {int(time.time() - t0)}s", flush=True)
        except Exception as e:  # noqa: BLE001
            st["failed"][str(n)] = st["failed"].get(str(n), 0) + 1
            print(f"✗ {lid}: {e}", flush=True)
        save_one(n, n in st["done"], st["failed"].get(str(n), 0)); commit(f"{lid}: {'done' if n in st['done'] else 'failed'}")
    print(f"factory: {len(st['done'])}/{TOTAL} done", flush=True)


if __name__ == "__main__":
    main()
