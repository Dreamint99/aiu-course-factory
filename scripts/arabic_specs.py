"""Write the ArabicEngine spec for one lesson of the board-designed Gulf Arabic course (src/arabic/course/design.json + design.md).

  python scripts/arabic_specs.py 1            → src/arabic/specs/arw-01.json (unvoiced; then arabic_make.py voices + times it)

Same pipeline as scripts/japanese_specs.py (copied 2026-10-22, Japanese files untouched):
1. writer (Gemini 4 Argon → GPT-5.6 Sol → Claude Sonnet last) gets the lesson's row from the board design, the course rules
   (dialect, Bangla bridges, pronunciation, culture), earlier lessons' key phrases (for recall), the scene schema and an example
   spec → full spec JSON.
2. validate(): scene types/order, every key the engine looks up, syllable tiles / grammar blocks == their spoken line, ro + bro
   on every native line, no Arabic script inside Bangla teacher lines → errors go back to the writer for up to 2 repairs.
3. Gulf Arabic accuracy review by a second model (find/replace fixes): wrong Arabic, harakat, dialect (Saudi/Qatari khaleeji, not
   MSA/Egyptian), transliteration, Bangla pronunciation, meaning, politeness/culture. Then scripts/lesson_check.py (Global Class Rules).
Cost ≈ $0.08–0.15 per lesson (OpenRouter). Never overwrites an existing spec unless --force.
"""
import json, re, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ai_router import ask_json, log, SPENT  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT / "src/arabic/course"
SPECS = ROOT / "src/arabic/specs"
WRITER = ["or:google/gemini-4-argon", "or:openai/gpt-5.6-sol", "claude:claude-sonnet-5-5"]
REVIEWER = ["or:openai/gpt-5.6-sol", "or:google/gemini-4-argon", "claude:claude-sonnet-5-5"]
BN = "০১২৩৪৫৬৭৮৯"
# voices: all Saudi-accent ElevenLabs library voices (no Qatari-labelled voice exists in the library; Saudi/Qatari khaleeji are close)
CAST = {
    "M": {"name": "رفيع", "bn": "রাফি", "voice": "pNGUEZc2WLum9bjP611g", "look": "rafi"},
    "S": {"name": "أبو صالح", "bn": "আবু সালেহ", "voice": "rpGHcNQJvO8dFNNFNj1v", "look": "qatari", "role": "স্থানীয়"},
    "B": {"name": "أبو فيصل", "bn": "আবু ফয়সাল", "voice": "FyTdvEJCoWuIYfS3P1x0", "look": "saudi", "role": "সুপারভাইজার"},
    "F": {"name": "منى", "bn": "মুনা", "voice": "o0oG1TnHDWDdKbAeBgCO", "look": "madam", "role": "মাদাম"},
}
TIMING = ("a", "b", "frames", "amp", "cs", "cc", "file", "len", "total", "voAmp")
AR = re.compile(r"[؀-ۿ]")
PUNCT = r"[،؟.!?:؛\s‍]"

SCHEMA = """SPEC FORMAT (ArabicEngine). Top level: {id, course, lessonNo, title (Bangla), titleJp (the lesson title in Gulf Arabic with harakat),
objective (one measurable Bangla can-do sentence), next:{bn, jp (Arabic)}, cast (given — copy it exactly), scenes:[...]}. Beats are played in order:
  {"t": "<Bangla teacher line>"}  — উস্তাদ (Tanvir), warm and simple Bangla, ≤ 260 characters each; write Arabic words inside t in BANGLA letters
       (e.g. আবগা হা-যা), NEVER Arabic script.
  {"j": "<Gulf Arabic with full harakat>", "who": "M|S|B|F", "ro": "<Latin transliteration: ā ī ū ē ō, ḥ, ʿ, kh, gh, sh, th, dh>",
   "bro": "<Bangla-letter pronunciation, e.g. আবগা হা-যা>", "bn": "<Bangla meaning>", "key"?: "..."} — native audio.
       who: M = রাফি (the learner's character, Bangladeshi worker, male), S = আবু সালেহ (local man: shopkeeper, driver, customer, clerk, kafeel),
       B = আবু ফয়সাল (supervisor / mudir at work), F = মুনা (a woman: employer "madam", nurse, office clerk). Use the SPOKEN Gulf dialect of
       Saudi Arabia and Qatar (khaleeji): أبغى، وش، كم، زين، شلونك/كيف حالك، ما فيه مشكلة، يعطيك العافية، إن شاء الله … — not textbook MSA,
       not Egyptian/Levantine. Polite and safe for a foreign worker. Address a man with -ak, a woman with -ik.
  {"slow": true} on a j beat = the same line at 0.75x.  {"gap": true, "say"?: "<Bangla prompt>"} = learner speaks.  {"hold": <frames>, "key": "..."} = silence.
Scene types (use EXACTLY this order; keys in quotes are mandatory):
 1 hook: "world" street|store|work|home|clinic, "question" (short English question, last word highlighted), "questionBn";
   beats [{hold:30},{j (the real-life moment, said by S, B or F), who},{hold:24},{t (the story hook, ≤ 260 chars)}]
 2 title: "goals" [4 short Bangla goals]; beats [{t}]
 3 recall (ONLY from lesson 2): "items" [{q: Bangla prompt}] ×3 from EARLIER lessons; beats [{t}, then for i: {hold:90,key:"h<i>"},{j,who,ro,bro,key:"j<i>"}]
 4 learn ×2–4 (one key word/phrase each): "n" (1,2,…), "kana" [[arabic chunk, latin, Bangla sound]...] = the main j split into 2–6 syllable/word
   chunks in reading order — the chunks joined with NO spaces must equal the main j with spaces and punctuation (، ؟ . !) removed, harakat included;
   "mark"?{i, text (Bangla warning about a hard sound, e.g. ع ح خ ق)}, "long"?[indices], "mean", "when", "icon" sun|heart|hand|smile;
   beats [{t},{j,who:"S" or "F",ro,bro,key:"main"},{t}]
 5 speak: beats [{t}, then for 3 phrases: {j,who:"S" or "F",ro,bro,bn,slow:true},{j same},{gap:true}, then {t}]  (exactly 3 phrases)
 6 grammar: "rows" [2 rows of {blocks:[[arabic word, latin, Bangla role, colour "#4CC9F0"|"#FFC845"|"#FF5E8A"|"#3DDC97"]], bn}] — blocks in reading
   order (first word first); blocks joined with no spaces = the row's j text without spaces/punctuation; "tip" (one short Bangla rule, ≤ 50 chars);
   beats [{t},{j,who:"S",ro,bro,key:"r0"},{t,key:"e0"},{j,who:"S",ro,bro,key:"r1"},{t,key:"e1"}]
 7 secret: "kind" (e.g. "বাংলা সেতু · সিক্রেট" or "প্রবাসীদের সিক্রেট"), "head" (Bangla), "pairs" [[Bangla, Arabic]] 2–3, "why" (the source or the
   reason it is true — e.g. Arabic loanwords already in Bangla: কলম/قلم, কিতাব/كتاب, দুনিয়া/دنيا, হিসাব/حساب, ওয়াক্ত/وقت); beats [{t}]
 8 fix: "rows" [2 × {wrong, wro, wbro, right, rro, rbro, why}] (typical mistakes of Bangladeshi workers: word order, wrong gender -ak/-ik,
   ح/ه or ع dropped, MSA/Egyptian word instead of Gulf, rude form); beats [{t,key:"q0"},{hold:90,key:"h0"},{t,key:"x0"},{t,key:"q1"},{hold:90,key:"h1"},{t,key:"x1"}]
 9 context: "cards" [3 × {place, icon taxi|work|store|phone|clinic|office|bus|airport|money|kitchen|home|food, use}];
   beats [{t},{hold:75,key:"h0"},{j,who,ro,bro,key:"j0"},{hold:75,key:"h1"},{j,..,key:"j1"},{hold:75,key:"h2"},{j,..,key:"j2"},{t}]
10 roleplay pass 1: "pass":1, "world" street|store|work|home|clinic, "place" (Bangla); beats [{t}, 4–6 j lines alternating M with ONE partner (S, B or F), each with ro, bro and bn]
11 roleplay pass 2: "pass":2, same world/place/lines, but BEFORE every M line insert {gap:true, say:"<Bangla hint what to say>"}; end with {t}
12 quiz ×3: "n" 1..3, "q" (Bangla), "o" [3 × [main, sub]] (Arabic options get the Bangla pronunciation in sub; Bangla options sub ""), "a" index;
   quiz 3 has "boss": true and is a real situation combining the lesson; optional "listen": true with a {j,who,ro,bro,key:"listen"} beat before the hold;
   beats [{t},({j,key:"listen"}),{hold:150,key:"count"},{t (reveal)}]
13 mission: "xp" 20, "steps" [4 short Bangla steps — record yourself + the real-life transfer task]; beats [{t}]
14 reward: "words" [≤5 × [Arabic, Bangla]], "before", "after" (Bangla); beats [{t},{j:"مَعَ السَّلَامَة!",who:"S",ro:"Maʿa s-salāma!",bro:"মাআস সালামা!",bn:"আল্লাহ হাফেজ!"}]
Rules: one concept at a time; every Arabic line must be correct, natural spoken Gulf Arabic as used today by Saudis/Qataris with foreign workers, with
full harakat; keep native lines short (≤ 8 words); teacher talk short; honest (no visa/job/pass guarantees); total ≈ 5–7 minutes."""


def bn_digits(n):
    return "".join(BN[int(d)] for d in str(n))


def board_row(n):
    p = COURSE / "design.md"
    if not p.exists():
        return ""
    m = re.search(rf"^\| *(?:{bn_digits(n)}|{n}) *\|(.+)$", p.read_text(encoding="utf-8"), re.M)
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
        p = SPECS / f"arw-{i:02d}.json"
        if p.exists():
            s = json.loads(p.read_text(encoding="utf-8"))
            js = sorted({f"{b['j']} ({b.get('bro', '')} = {b.get('bn', '')})" for sc in s["scenes"] for b in sc.get("beats", [])
                         if b.get("j") and sc["type"] in ("learn", "speak", "roleplay")})
            out.append(f"Lesson {i} ({s.get('title')}): " + " / ".join(js[:10]))
    return "\n".join(out[-6:]) or "(none — this is lesson 1)"


def keys_of(sc):
    return {b.get("key") for b in sc.get("beats", []) if b.get("key")}


def flat(t):
    return re.sub(PUNCT, "", t or "")


def validate(spec, n):
    err = []
    sc = spec.get("scenes", []); types = [s.get("type") for s in sc]
    must = ["hook", "title"] + (["recall"] if n > 1 else []) + ["learn", "speak", "grammar", "secret", "fix", "context", "roleplay", "mission", "reward"]
    for t in must:
        if t not in types:
            err.append(f"missing scene {t}")
    if types and types[0] != "hook":
        err.append("first scene must be hook")
    if sum(t == "quiz" for t in types) < 3:
        err.append("need 3 quiz scenes")
    if not spec.get("objective"):
        err.append("objective missing")
    for i, s in enumerate(sc):
        t = s.get("type"); k = keys_of(s); where = f"scene {i + 1} ({t})"
        bs = s.get("beats", [])
        for b in bs:
            if b.get("j"):
                if not b.get("ro") or not b.get("bro"):
                    err.append(f"{where}: j beat needs ro AND bro (Bangla pronunciation): {b['j']}")
                if b.get("who") not in ("M", "S", "B", "F"):
                    err.append(f"{where}: j beat needs who M|S|B|F")
                if not AR.search(b["j"]):
                    err.append(f"{where}: j must be Arabic script: {b['j']}")
                if len(b["j"].split()) > 10:
                    err.append(f"{where}: native line too long (>10 words): {b['j']}")
            if b.get("t") and len(b["t"]) > 320:
                err.append(f"{where}: teacher line too long ({len(b['t'])} chars) — split it")
            if b.get("t") and AR.search(b["t"]):
                err.append(f"{where}: teacher line contains Arabic script — write Arabic words in Bangla letters")
        if t == "hook" and not any(b.get("j") for b in bs):
            err.append(f"{where}: needs a j beat")
        if t == "learn":
            main = next((b for b in bs if b.get("key") == "main"), None)
            if not main:
                err.append(f"{where}: needs key main")
            else:
                chunks = "".join(c[0] for c in s.get("kana", [])); spoken = flat(main["j"])
                if flat(chunks) != spoken:
                    err.append(f"{where}: kana chunks joined '{chunks}' must equal the main line without spaces/punctuation '{spoken}'")
                if any(len(c) < 2 for c in s.get("kana", [])):
                    err.append(f"{where}: every kana item is [arabic chunk, latin, Bangla sound]")
        if t == "grammar":
            for r_i, r in enumerate(s.get("rows", [])[:2]):
                b = next((x for x in bs if x.get("key") == f"r{r_i}"), None)
                if not b:
                    err.append(f"{where}: needs j key r{r_i}"); continue
                joined = flat("".join(bl[0] for bl in r.get("blocks", []))); spoken = flat(b["j"])
                if joined != spoken:
                    err.append(f"{where}: row {r_i} blocks '{joined}' must equal its spoken line '{spoken}' (no spaces/punctuation)")
            if not {"e0", "e1"} <= k:
                err.append(f"{where}: needs t keys e0 and e1")
        if t == "fix":
            if not {"q0", "h0", "x0", "q1", "h1", "x1"} <= k:
                err.append(f"{where}: needs keys q0 h0 x0 q1 h1 x1")
            for r in s.get("rows", []):
                if not all(r.get(x) for x in ("wrong", "wro", "right", "rro", "why")):
                    err.append(f"{where}: rows need wrong, wro, wbro, right, rro, rbro, why")
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
                err.append(f"{where}: only one partner (S, B or F) per roleplay")
            if s.get("pass") == 2 and not any(b.get("gap") for b in bs):
                err.append(f"{where}: pass 2 needs gaps before M lines")
        if t == "reward" and not (s.get("before") and s.get("after")):
            err.append(f"{where}: needs before and after")
    quizzes = [s for s in sc if s.get("type") == "quiz"]
    if quizzes and not quizzes[-1].get("boss"):
        err.append("last quiz needs boss true")
    return err


def rules_of(design):
    keep = {}
    for k, v in design.items():
        if any(w in k.lower() for w in ("dialect", "bridge", "pronunc", "culture", "polite", "script", "language", "honest", "safety", "style")):
            keep[k] = v
    return json.dumps(keep, ensure_ascii=False)[:7000]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    n = int(sys.argv[1]); force = "--force" in sys.argv
    out = SPECS / f"arw-{n:02d}.json"
    if out.exists() and not force:
        log(f"= {out.name} exists"); return
    design = json.loads((COURSE / "design.json").read_text(encoding="utf-8"))
    seq = {int(x.get("n") or x.get("no") or i + 1): x for i, x in enumerate(design["lesson_sequence"])}; row = seq[n]
    nxt = seq.get(n + 1, {"title": "কোর্স শেষ"})
    ex_path = SPECS / "arw-01.json" if n > 1 and (SPECS / "arw-01.json").exists() else ROOT / "src/japanese/specs/jpw-01.json"
    example = strip_timing(json.loads(ex_path.read_text(encoding="utf-8")))
    ex_note = "an earlier Arabic lesson of THIS course" if "arw" in ex_path.name else \
        "a lesson of our JAPANESE course — copy only its field shapes, tone and scene flow; every native line must be Gulf Arabic with ro + bro"
    sys_p = ("You are the lead course designer of AI University's 'Spoken Gulf Arabic for Bangladeshi workers' course (Bangla explanations, native "
             "Saudi/Gulf Arabic audio, animated video lessons). You write one lesson as an engine spec. You are an expert Arabic teacher who has lived "
             "in Saudi Arabia and Qatar and knows exactly how Saudis and Qataris speak with Bangladeshi workers at work, in shops, taxis, clinics and homes.")
    user = (f"LESSON {n} of {len(seq)} (board design):\n{json.dumps(row, ensure_ascii=False)}\nBoard table row: {board_row(n)}\n"
            f"NEXT LESSON: {nxt.get('title')}\n\nCOURSE RULES (board):\n{rules_of(design)}\n\nEARLIER LESSONS (for recall; reuse their phrases):\n{earlier(n)}\n\n"
            f"{SCHEMA}\n\nCAST (copy exactly): {json.dumps(CAST, ensure_ascii=False)}\nid must be \"arw-{n:02d}\", lessonNo \"পাঠ {bn_digits(f'{n:02d}')}\", "
            f"course \"আরবি ভাষা · গালফের কথ্য আরবি\".\n\nSTYLE EXAMPLE ({ex_note}; follow its tone and field shapes, NOT its content):\n"
            f"{json.dumps(example, ensure_ascii=False)[:14000]}\n\nWrite the full spec JSON for lesson {n}.")
    spec = ask_json(WRITER, sys_p, user, max_tokens=32000); spec["cast"] = CAST; spec["id"] = f"arw-{n:02d}"
    for attempt in range(2):
        errs = validate(spec, n)
        if not errs:
            break
        log(f"  · repair {attempt + 1}: {len(errs)} problems")
        spec = ask_json(WRITER, sys_p, f"{SCHEMA}\n\nThis spec has problems:\n- " + "\n- ".join(errs[:40]) +
                        f"\n\nSPEC:\n{json.dumps(spec, ensure_ascii=False)}\n\nReturn the full corrected spec JSON (fix only what is listed).", max_tokens=32000)
        spec["cast"] = CAST; spec["id"] = f"arw-{n:02d}"
    errs = validate(spec, n)
    if errs:
        sys.exit("✗ spec still invalid: " + "; ".join(errs[:10]))
    # Gulf Arabic accuracy review (second model): find/replace fixes only
    rv = ask_json(REVIEWER, "You are a native Saudi Arabic speaker from Riyadh who has also lived in Doha and trains Bangladeshi workers in spoken Gulf Arabic. "
                  "You read Bangla. Check ONLY correctness.",
                  "Check every Arabic line (j, kana chunks, blocks, options, pairs, words, wrong/right), its harakat, its Latin transliteration (ro), its "
                  "Bangla-letter pronunciation (bro — must let a Bangladeshi say it right), its Bangla meaning, and whether it is natural SPOKEN Saudi/Qatari "
                  "Gulf Arabic (not MSA-only, not Egyptian/Levantine), polite and culturally safe for a foreign worker. Keep the spec's structure: when you fix a "
                  "main/learn line, the kana chunks or grammar blocks of that line must still join to it. Return JSON {ok: bool, fixes: [{find, replace, why}]} "
                  "where find is an exact substring of the JSON text below (short but unique) and replace is the corrected text. Empty fixes if all correct.\n\n" +
                  json.dumps(spec, ensure_ascii=False), max_tokens=14000)
    txt = json.dumps(spec, ensure_ascii=False); applied = 0
    for fx in rv.get("fixes", []):
        if fx.get("find") and fx["find"] in txt and fx.get("replace") is not None:
            txt = txt.replace(fx["find"], fx["replace"], 1); applied += 1
    try:
        spec2 = json.loads(txt)
        if not validate(spec2, n):
            spec = spec2
        else:
            log("  ! review fixes broke the spec — kept the unreviewed version"); applied = 0
    except ValueError:
        log("  ! review fixes broke the JSON — kept the unreviewed version"); applied = 0
    spec["review"] = {"applied": applied, "notes": [f.get("why") for f in rv.get("fixes", [])][:20]}
    SPECS.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    chk = subprocess.run([sys.executable, str(ROOT / "scripts/lesson_check.py"), str(out), "--lesson-no", str(n)], capture_output=True, text=True, encoding="utf-8")
    log(chk.stdout.strip())
    if chk.returncode:
        out.rename(out.with_suffix(".failed.json")); sys.exit("✗ lesson_check failed")
    log(f"✓ {out.name}: {len(spec['scenes'])} scenes, {applied} accuracy fixes, cost ≈ ${SPENT['or'] + SPENT['claude']:.3f}")


if __name__ == "__main__":
    main()
