"""Write the JapaneseEngine spec for one lesson of the board-designed course (src/japanese/course/design.json + design.md).

  python scripts/japanese_specs.py 1            → src/japanese/specs/jpw-01.json (unvoiced; then japanese_make.py voices + times it)

1. writer (Gemini, Claude Sonnet fallback) gets: the lesson's row from the board design (can-do, hook, secret, practice, mission),
   course rules (politeness, Bangla bridges, pronunciation), earlier lessons' key phrases (for recall), the scene schema and
   the hand-made example spec → full spec JSON.
2. validate(): scene types/order, every key the engine looks up, kana rows == their spoken text, lengths → errors go back to
   the writer for up to 2 repairs. Then scripts/lesson_check.py (Global Class Rules).
3. Japanese accuracy review by a second model (GPT-5.6): find/replace fixes for wrong Japanese, romaji, politeness or meaning.
Cost ≈ $0.08–0.15 per lesson. Never overwrites an existing spec unless --force.
"""
import json, os, re, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ai_router import ask_json, log, SPENT  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT / "src/japanese/course"
SPECS = ROOT / "src/japanese/specs"
# owner 2026-10-22: text work on FREE OpenRouter models first, paid only for serious steps (accuracy review); voices on OpenRouter
WRITER = os.environ.get("SPEC_WRITER", "or:nvidia/nemotron-3-ultra-550b-a55b:free,or:google/gemma-4-31b-it:free,claude:claude-haiku-5-5,claude:claude-sonnet-5-5").split(",")
REVIEWER = os.environ.get("SPEC_REVIEWER", "claude:claude-sonnet-5-5,or:google/gemini-4-argon").split(",")  # accuracy = serious → paid
BN = "০১২৩৪৫৬৭৮৯"
CAST = {
    "F": {"name": "ユイ", "bn": "ইউই", "voice": "vsOHlw2syHreLeo0GXA1", "look": "yui", "role": "সহকর্মী"},
    "M": {"name": "ラフィ", "bn": "রাফি", "voice": "3VouIDzZzPEjDgmtbXBJ", "look": "rafi"},
    "B": {"name": "たなか", "bn": "তানাকা-সান", "voice": "yXZ07Dvjx4c0c7ZtjRHv", "look": "boss", "role": "সুপারভাইজার"},
}
TIMING = ("a", "b", "frames", "amp", "cs", "cc", "file", "len", "total", "voAmp")

SCHEMA = """SPEC FORMAT (JapaneseEngine). Top level: {id, course, lessonNo, title (Bangla), titleJp, objective (one measurable Bangla can-do sentence),
next:{bn, jp}, cast (given — copy it exactly), scenes:[...]}. Beats are played in order:
  {"t": "<Bangla teacher line>"}  — Tanvir, warm and simple Bangla, ≤ 260 characters each; write Japanese words inside t in BANGLA letters (e.g. ওহাইও গোজাইমাস), never kana.
  {"j": "<Japanese>", "who": "F|M|B", "ro": "<Hepburn romaji>", "bn": "<Bangla meaning>", "key"?: "..."} — native audio. who: F = ユイ coworker/clerk (woman),
       M = ラフィ the learner's character (Bangladeshi man), B = たなかさん supervisor (man). Use natural polite です/ます unless a scene teaches casual speech.
  {"slow": true} on a j beat = the same line at 0.75x.  {"gap": true, "say"?: "<Bangla prompt>"} = learner speaks.  {"hold": <frames>, "key": "..."} = silence.
Scene types (use EXACTLY this order; keys in quotes are mandatory):
 1 hook: "world" street|work|store, "question" (short English question, last word highlighted), "questionBn"; beats [{hold:30},{j (the moment), who},{hold:24},{t (the story hook, ≤ 260 chars)}]
 2 title: "goals" [4 short Bangla goals]; beats [{t}]
 3 recall (ONLY from lesson 2): "items" [{q: Bangla prompt}] ×3 from EARLIER lessons; beats [{t}, then for i: {hold:90,key:"h<i>"},{j,who,ro,key:"j<i>"}]
 4 kana (when the lesson teaches new kana): "head", "rows" [{chars:[{k, ro, bn (Bangla sound), hint (Bangla memory hook, ≤ 60 chars)}]}] max 5 chars/row, max 3 rows;
   beats [{t}, then for each row i: {j: the row's characters joined with no spaces, who:"F", ro, key:"r<i>"}, {t: hints for that row, key:"x<i>"}]
 5 learn ×1–3 (one key word/phrase each): "n", "kana" [[char, romaji]...] = EXACTLY the characters of the main j (kana only, no punctuation), "mark"?{i, text},
   "long"?[indices], "mean", "when", "icon" sun|heart|hand; beats [{t},{j,who:"F",ro,key:"main"},{t}]
 6 speak: beats [{t}, then for 3 phrases: {j,who:"F",ro,bn,slow:true},{j same},{gap:true}, then {t}]  (exactly 3 phrases)
 7 grammar: "rows" [2 rows of {blocks:[[jp, romaji, Bangla role, colour "#4CC9F0"|"#FFC845"|"#FF5E8A"|"#3DDC97"]], bn}] — blocks joined = the row's j text (no punctuation);
   beats [{t},{j,who:"F",ro,key:"r0"},{t,key:"e0"},{j,who:"F",ro,key:"r1"},{t,key:"e1"}]
 8 secret: "kind" (e.g. "বাংলা সেতু · সিক্রেট" or "কাজের জায়গার সিক্রেট"), "head" (Bangla), "pairs" [[Bangla, Japanese]] 2–3, "why" (the source or the reason it is true); beats [{t}]
 9 fix: "rows" [2 × {wrong, wro, right, rro, why}]; beats [{t,key:"q0"},{hold:90,key:"h0"},{t,key:"x0"},{t,key:"q1"},{hold:90,key:"h1"},{t,key:"x1"}]
10 context: "cards" [3 × {place, icon train|food|home, use}]; beats [{t},{hold:75,key:"h0"},{j,who,ro,key:"j0"},{hold:75,key:"h1"},{j,..,key:"j1"},{hold:75,key:"h2"},{j,..,key:"j2"},{t}]
11 roleplay pass 1: "pass":1, "world" work|store|street, "place" (Bangla); beats [{t}, 4–6 j lines alternating M with ONE partner (F or B), each with ro and bn]
12 roleplay pass 2: "pass":2, same world/place/lines, but BEFORE every M line insert {gap:true, say:"<Bangla hint what to say>"}; end with {t}
13 quiz ×3: "n" 1..3, "q" (Bangla), "o" [3 × [main, sub]] (Japanese options get romaji in sub; Bangla options sub ""), "a" index; quiz 3 has "boss": true and is a
   real situation combining the lesson; optional "listen": true with a {j,key:"listen"} beat before the hold; beats [{t},({j,key:"listen"}),{hold:150,key:"count"},{t (reveal)}]
14 mission: "xp" 20, "steps" [4 short Bangla steps — record yourself + the transfer task]; beats [{t}]
15 reward: "words" [≤5 × [jp, Bangla]], "before", "after" (Bangla); beats [{t},{j:"またね！",who:"F",ro:"Mata ne!",bn:"আবার দেখা হবে!"}]
Rules: one concept at a time; every Japanese line must be correct, natural and polite as used in real Japanese workplaces; romaji Hepburn with macrons (ō);
teacher talk short; no fake promises (no pass/job guarantee); total ≈ 5–7 minutes."""


def bn_digits(n):
    return "".join(BN[int(d)] for d in str(n))


def board_row(n):
    md = (COURSE / "design.md").read_text(encoding="utf-8")
    m = re.search(rf"^\| {bn_digits(n)} \|(.+)$", md, re.M)
    return m.group(0) if m else ""


def strip_timing(o):
    if isinstance(o, dict):
        return {k: strip_timing(v) for k, v in o.items() if k not in TIMING}
    if isinstance(o, list):
        return [strip_timing(x) for x in o]
    return o


def earlier(n):
    out = []
    for i in range(1, n):
        p = SPECS / f"jpw-{i:02d}.json"
        if p.exists():
            s = json.loads(p.read_text(encoding="utf-8"))
            js = sorted({b["j"] for sc in s["scenes"] for b in sc.get("beats", []) if b.get("j") and sc["type"] in ("learn", "speak", "roleplay")})
            out.append(f"Lesson {i} ({s.get('title')}): " + " / ".join(js[:10]))
    return "\n".join(out[-6:]) or "(none — this is lesson 1)"


def keys_of(sc):
    return {b.get("key") for b in sc.get("beats", []) if b.get("key")}


def validate(spec, n):
    err = []
    sc = spec.get("scenes", []); types = [s.get("type") for s in sc]
    must = ["hook", "title"] + (["recall"] if n > 1 else []) + ["speak", "grammar", "secret", "fix", "context", "roleplay", "mission", "reward"]
    for t in must:
        if t not in types:
            err.append(f"missing scene {t}")
    if types and types[0] != "hook":
        err.append("first scene must be hook")
    if sum(t == "quiz" for t in types) < 3:
        err.append("need 3 quiz scenes")
    for i, s in enumerate(sc):
        t = s.get("type"); k = keys_of(s); where = f"scene {i + 1} ({t})"
        bs = s.get("beats", [])
        for b in bs:
            if b.get("j") and not b.get("ro"):
                err.append(f"{where}: j beat without ro: {b['j']}")
            if b.get("j") and b.get("who") not in ("F", "M", "B"):
                err.append(f"{where}: j beat needs who F|M|B")
            if b.get("t") and len(b["t"]) > 320:
                err.append(f"{where}: teacher line too long ({len(b['t'])} chars) — split it")
            if b.get("t") and re.search(r"[぀-ヿ一-鿿]", b["t"]):
                err.append(f"{where}: teacher line contains Japanese script — write it in Bangla letters")
        if t == "hook" and not any(b.get("j") for b in bs):
            err.append(f"{where}: needs a j beat")
        if t == "learn":
            main = next((b for b in bs if b.get("key") == "main"), None)
            if not main:
                err.append(f"{where}: needs key main")
            else:
                kana = "".join(c[0] for c in s.get("kana", [])); spoken = re.sub(r"[、。！？!?\s]", "", main["j"])
                if kana != spoken:
                    err.append(f"{where}: kana tiles '{kana}' must equal the main line '{spoken}'")
        if t == "kana":
            for r_i, r in enumerate(s.get("rows", [])):
                b = next((x for x in bs if x.get("key") == f"r{r_i}"), None)
                if not b or re.sub(r"[、。\s]", "", b.get("j", "")) != "".join(c["k"] for c in r.get("chars", [])):
                    err.append(f"{where}: row {r_i} needs a j beat key r{r_i} whose text is exactly its characters")
                if f"x{r_i}" not in k:
                    err.append(f"{where}: row {r_i} needs a t beat key x{r_i}")
        if t == "grammar":
            for r_i, r in enumerate(s.get("rows", [])[:2]):
                b = next((x for x in bs if x.get("key") == f"r{r_i}"), None)
                if not b:
                    err.append(f"{where}: needs j key r{r_i}"); continue
                joined = "".join(bl[0] for bl in r.get("blocks", [])); spoken = re.sub(r"[、。！？!?\s]", "", b["j"])
                if joined != spoken:
                    err.append(f"{where}: row {r_i} blocks '{joined}' must equal its spoken line '{spoken}'")
            if not {"e0", "e1"} <= k:
                err.append(f"{where}: needs t keys e0 and e1")
        if t == "fix" and not {"q0", "h0", "x0", "q1", "h1", "x1"} <= k:
            err.append(f"{where}: needs keys q0 h0 x0 q1 h1 x1")
        if t == "context":
            for c_i in range(len(s.get("cards", []))):
                if not {f"h{c_i}", f"j{c_i}"} <= k:
                    err.append(f"{where}: card {c_i} needs keys h{c_i} and j{c_i}")
        if t == "recall":
            for r_i in range(len(s.get("items", []))):
                if not {f"h{r_i}", f"j{r_i}"} <= k:
                    err.append(f"{where}: item {r_i} needs keys h{r_i} and j{r_i}")
        if t == "speak":
            js = [b for b in bs if b.get("j")]; gaps = [b for b in bs if b.get("gap")]
            if len(js) != 6 or len(gaps) != 3:
                err.append(f"{where}: needs exactly 3 phrases (slow + normal j each) and 3 gaps")
        if t == "quiz":
            if "count" not in k:
                err.append(f"{where}: needs hold key count")
            if len(s.get("o", [])) != 3 or s.get("a") not in (0, 1, 2):
                err.append(f"{where}: needs 3 options and a in 0..2")
            if s.get("listen") and "listen" not in k:
                err.append(f"{where}: listen quiz needs j key listen")
        if t == "roleplay":
            js = [b for b in bs if b.get("j")]
            if not 3 <= len(js) <= 7:
                err.append(f"{where}: needs 3–7 j lines")
            partners = {b["who"] for b in js if b.get("who") != "M"}
            if len(partners) > 1:
                err.append(f"{where}: only one partner (F or B) per roleplay")
            if s.get("pass") == 2 and not any(b.get("gap") for b in bs):
                err.append(f"{where}: pass 2 needs gaps before M lines")
        if t == "reward" and not (s.get("before") and s.get("after")):
            err.append(f"{where}: needs before and after")
    quizzes = [s for s in sc if s.get("type") == "quiz"]
    if quizzes and not quizzes[-1].get("boss"):
        err.append("last quiz needs boss true")
    return err


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    n = int(sys.argv[1]); force = "--force" in sys.argv
    out = SPECS / f"jpw-{n:02d}.json"
    if out.exists() and not force:
        log(f"= {out.name} exists"); return
    design = json.loads((COURSE / "design.json").read_text(encoding="utf-8"))
    seq = {x["n"]: x for x in design["lesson_sequence"]}; row = seq[n]
    nxt = seq.get(n + 1, {"title": "কোর্স শেষ"})
    rules = {k: design.get(k) for k in ("politeness_and_culture", "bangla_bridges", "pronunciation_focus", "kana_kanji_policy")}
    example = strip_timing(json.loads((SPECS / "jp-01-first-words.json").read_text(encoding="utf-8")))
    sys_p = ("You are the lead course designer of AI University's 'Japanese for Bangladeshi workers' course (Bangla explanations, native Japanese audio, "
             "animated video lessons). You write one lesson as an engine spec. You are an expert Japanese teacher and know real Japanese workplaces.")
    user = (f"LESSON {n} of 30 (board design):\n{json.dumps(row, ensure_ascii=False)}\nBoard table row (Bangla: can-do | hook | secret | practice | mission):\n{board_row(n)}\n"
            f"NEXT LESSON: {nxt.get('title')}\n\nCOURSE RULES:\n{json.dumps(rules, ensure_ascii=False)[:6000]}\n\nEARLIER LESSONS (for recall; reuse their phrases):\n{earlier(n)}\n\n"
            f"{SCHEMA}\n\nCAST (copy exactly): {json.dumps(CAST, ensure_ascii=False)}\nid must be \"jpw-{n:02d}\", lessonNo \"পাঠ {bn_digits(f'{n:02d}')}\", course \"জাপানি ভাষা · কাজের জাপানি\".\n\n"
            f"STYLE EXAMPLE (an older hand-made lesson; follow its tone and field shapes, NOT its content):\n{json.dumps(example, ensure_ascii=False)[:14000]}\n\nWrite the full spec JSON for lesson {n}.")
    spec = ask_json(WRITER, sys_p, user, max_tokens=32000); spec["cast"] = CAST; spec["id"] = f"jpw-{n:02d}"
    for attempt in range(2):
        errs = validate(spec, n)
        if not errs:
            break
        log(f"  · repair {attempt + 1}: {len(errs)} problems")
        spec = ask_json(WRITER, sys_p, f"{SCHEMA}\n\nThis spec has problems:\n- " + "\n- ".join(errs[:40]) +
                        f"\n\nSPEC:\n{json.dumps(spec, ensure_ascii=False)}\n\nReturn the full corrected spec JSON (fix only what is listed).", max_tokens=32000)
        spec["cast"] = CAST; spec["id"] = f"jpw-{n:02d}"
    errs = validate(spec, n)
    if errs:
        sys.exit("✗ spec still invalid: " + "; ".join(errs[:10]))
    # Japanese accuracy review (second model): find/replace fixes only
    rv = ask_json(REVIEWER, "You are a native Japanese teacher who trains Bangladeshi workers for Japanese workplaces. Check ONLY correctness.",
                  "Check every Japanese line (j, show, kana, blocks, options, pairs, words), its romaji (Hepburn with macrons) and its Bangla meaning in this lesson spec. "
                  "Also check politeness level and whether it is what people really say in a Japanese workplace. Return JSON {ok: bool, fixes: [{find, replace, why}]} where "
                  "find is an exact substring of the JSON text below (keep it short but unique) and replace is the corrected text. Empty fixes if all correct.\n\n" +
                  json.dumps(spec, ensure_ascii=False), max_tokens=12000)
    txt = json.dumps(spec, ensure_ascii=False); applied = 0
    for fx in rv.get("fixes", []):  # one at a time: a fix that breaks the JSON or the schema is skipped, the rest still land
        if fx.get("find") and fx["find"] in txt and fx.get("replace") is not None:
            t2 = txt.replace(fx["find"], fx["replace"], 1)
            try:
                if not validate(json.loads(t2), n):
                    txt = t2; applied += 1
            except ValueError:
                pass
    spec = json.loads(txt)
    spec["review"] = {"applied": applied, "notes": [f.get("why") for f in rv.get("fixes", [])][:20]}
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    chk = subprocess.run([sys.executable, str(ROOT / "scripts/lesson_check.py"), str(out), "--lesson-no", str(n)], capture_output=True, text=True, encoding="utf-8")
    log(chk.stdout.strip())
    if chk.returncode:
        out.rename(out.with_suffix(".failed.json")); sys.exit("✗ lesson_check failed")
    log(f"✓ {out.name}: {len(spec['scenes'])} scenes, {applied} accuracy fixes, cost ≈ ${SPENT['or'] + SPENT['claude']:.3f}")


if __name__ == "__main__":
    main()
