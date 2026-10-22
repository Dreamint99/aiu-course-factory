"""Cloud render of one Korean course lesson video (KoreanEngine) on the public repo Dreamint99/aiu-render
(free GitHub Actions minutes, parallel chunks).

  python scripts/korean_cloud.py <lesson-id> [--chunks 6]      (run scripts/korean_make.py <spec> first: voices + timing)

Syncs src/korean engine files into M:/Code/aiu-render (push only when changed), uploads public/korean/<id> + aiu2 + the dark logo
as a temporary release "in-<id>" (deleted afterwards), runs render.yml (kind=korean, comp=KoreanLesson), downloads the MP4 to
output/AI-University/Korean/<id>.mp4
"""
import argparse, json, os, shutil, subprocess, sys, tarfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "Dreamint99/aiu-render"
RENDER_REPO = Path(os.environ.get("RENDER_REPO", "M:/Code/aiu-render"))  # local clone of the render repo (the CI factory clones it)
OUT = ROOT / "output/AI-University/Korean"


def sh(cmd, check=True, cwd=None):
    r = subprocess.run(cmd, cwd=cwd or ROOT, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode:
        raise RuntimeError(f"{cmd[:90]}â€¦ â†’ {(r.stderr or r.stdout)[-300:]}")
    return r.stdout.strip()


def frames(spec):  # total frames written by the *_make.py script
    return spec["total"]


def sync_engine():
    (RENDER_REPO / "src/korean").mkdir(parents=True, exist_ok=True)
    for f in ("KoreanEngine.tsx", "CloudRoot.tsx", "cloud.ts"):
        shutil.copy2(ROOT / "src/korean" / f, RENDER_REPO / "src/korean" / f)
    sh("git pull -q --rebase", cwd=RENDER_REPO, check=False); sh("git add src/korean public/fonts/NotoSansKR.ttf", cwd=RENDER_REPO)  # stage only our own files (other agents push there too)
    if sh("git diff --cached --name-only", cwd=RENDER_REPO):
        sh('git -c user.email=iamkashimuddin@gmail.com -c user.name="Masum Ahmed" commit -q -m "sync korean engine + fonts"', cwd=RENDER_REPO)
        sh("git push -q origin HEAD", cwd=RENDER_REPO); print("engine synced", flush=True)


def existing_run(lid):
    """A run for this lesson that is still going, or finished OK in the last 3 h with its MP4 artifact still there
    (lets a restarted batch pick up renders started by a killed process instead of rendering again)."""
    try:
        runs = json.loads(sh(f"gh run list -R {REPO} -w render.yml -L 60 --json databaseId,displayTitle,status,conclusion,createdAt") or "[]")
    except RuntimeError:
        return None
    for r in runs:
        if r["displayTitle"] != f"render {lid}":
            continue
        if r["status"] != "completed":
            return r["databaseId"]
        if r["conclusion"] == "success":
            arts = json.loads(sh(f"gh api repos/{REPO}/actions/runs/{r['databaseId']}/artifacts --jq .artifacts", check=False) or "[]")
            if any(a["name"] == f"out-{lid}" and not a.get("expired") for a in arts):
                return r["databaseId"]
        return None  # newest run for this lesson failed/cancelled â†’ render again
    return None


def render(lid, chunks):
    run = existing_run(lid)
    if run:
        print(f"{lid}: attaching to existing run {run}", flush=True)
        return wait_and_fetch(lid, run, time.time())
    spec = json.loads((ROOT / f"src/korean/specs/{lid}.json").read_text(encoding="utf-8"))
    pub = ROOT / "public/korean" / lid
    (pub / "props.json").write_text(json.dumps({"spec": spec}, ensure_ascii=False), encoding="utf-8")
    pack = ROOT / f"work/tmp/in-{lid}.tar.gz"; pack.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(pack, "w:gz") as t:
        t.add(pub, arcname=f"korean/{lid}"); t.add(ROOT / "public/aiu2", arcname="aiu2"); t.add(ROOT / "public/brand/logo-dark.png", arcname="brand/logo-dark.png")
    sh(f"gh release delete in-{lid} -R {REPO} -y --cleanup-tag", check=False)
    sh(f'gh release create in-{lid} "{pack}" -R {REPO} -t "input {lid}" -n "temporary render input â€” deleted after the render"')
    t0 = time.time()
    sh(f"gh workflow run render.yml -R {REPO} -f id={lid} -f frames={frames(spec)} -f chunks={chunks} -f kind=korean -f comp=KoreanLesson")
    run = None
    for _ in range(30):
        time.sleep(6)
        runs = json.loads(sh(f"gh run list -R {REPO} -w render.yml -L 30 --json databaseId,displayTitle") or "[]")
        mine = [r for r in runs if r["displayTitle"] == f"render {lid}"]
        if mine: run = mine[0]["databaseId"]; break
    if not run: raise RuntimeError("run not found")
    print(f"run {run} started", flush=True)
    return wait_and_fetch(lid, run, t0)


def wait_and_fetch(lid, run, t0):
    while True:
        time.sleep(30)
        v = json.loads(sh(f"gh run view {run} -R {REPO} --json status,conclusion"))
        if v["status"] == "completed": break
        if time.time() - t0 > 3600: raise RuntimeError("render timed out")
    try:
        if v["conclusion"] != "success": raise RuntimeError(f"render {v['conclusion']} (run {run})")
        tmp = ROOT / f"work/tmp/out-{lid}"; shutil.rmtree(tmp, ignore_errors=True)
        for i in range(3):
            try: sh(f'gh run download {run} -R {REPO} -n out-{lid} -D "{tmp}"'); break
            except RuntimeError:
                if i == 2: raise
                time.sleep(10)
        OUT.mkdir(parents=True, exist_ok=True)
        shutil.move(str(tmp / f"{lid}.mp4"), OUT / f"{lid}.mp4"); shutil.rmtree(tmp, ignore_errors=True)
    finally:
        sh(f"gh release delete in-{lid} -R {REPO} -y --cleanup-tag", check=False)
        for a in json.loads(sh(f"gh api repos/{REPO}/actions/runs/{run}/artifacts --jq .artifacts", check=False) or "[]"):
            sh(f"gh api -X DELETE repos/{REPO}/actions/artifacts/{a['id']}", check=False)
    return int(time.time() - t0)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    a = argparse.ArgumentParser(); a.add_argument("ids", nargs="+"); a.add_argument("--chunks", default="6"); a = a.parse_args()
    sync_engine()
    for lid in a.ids:
        print(f"âœ“ {lid} rendered in the cloud ({render(lid, a.chunks)}s) â†’ {OUT / (lid + '.mp4')}", flush=True)
