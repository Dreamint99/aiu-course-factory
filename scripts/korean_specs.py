"""Write the KoreanEngine spec for one lesson of the board-designed Korean (EPS-TOPIK) course (src/korean/course/design.json + design.md).

  python scripts/korean_specs.py 2            → src/korean/specs/koe-02.json (unvoiced; then korean_make.py voices + times it)

Same pipeline as scripts/japanese_specs.py (copied 2026-10-22, Japanese files untouched):
1. writer (free OpenRouter models first: Nemotron 3 Ultra, Gemma 4 → Claude Haiku → Sonnet last) gets the lesson's row from the board design, the course rules, earlier
   lessons' key phrases (for recall), the scene schema and the hand-made lesson 1 spec → full spec JSON.
2. validate(): scene types/order, every key the engine looks up, syllable tiles / grammar blocks == their spoken line, jamo of the
   "build" block == its real Unicode decomposition, no Hangul inside Bangla teacher lines → errors go back to the writer (2 repairs).
3. Korean accuracy review by Claude Sonnet (find/replace fixes): wrong Korean, politeness (해요체/합니다체), romanization, meaning,
   real EPS workplace usage. Then scripts/lesson_check.py (Global Class Rules).
Cost ≈ $0.05–0.10 per lesson (Sonnet review; drafts free). Never overwrites an existing spec unless --force.
"""
import json, os, re, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ai_router import ask_json, log, SPENT  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
COURSE = ROOT / "src/korean/course"
SPECS = ROOT / "src/korean/specs"
WRITER = os.environ.get("SPEC_WRITER", "or:nvidia/nemotron-3-ultra-550b-a55b:free,or:google/gemma-4-31b-it:free,claude:claude-haiku-5-5,claude:claude-sonnet-5-5").split(",")
REVIEWER = os.environ.get("SPEC_REVIEWER", "claude:claude-sonnet-5-5").split(",")  # Korean accuracy = serious → paid (owner 2026-10-22: no GPT-5.6)
BN = "০১২৩৪৫৬৭৮৯"


def lid_of(n):  # lesson 1 = koe-01b: the hand-made koe-01 (greetings) stays live; the board-based lesson 1 (EPS vs TOPIK, brokers) gets its own name
    return "koe-01b" if n == 1 else f"koe-{n:02d}"
CAST = {
    "F": {"name": "지수", "bn": "জিসু", "voice": "yIiJDIlA4V9TvoOO12TS", "look": "yui", "role": "সহকর্মী"},
    "M": {"name": "라피", "bn": "রাফি", "voice": "ySf4IWnUI8NPQfkoH9Pq", "look": "rafi"},
    "B": {"name": "김 반장", "bn": "কিম বানজাং", "voice": "8G6jifm9f1BhHXadvwOt", "look": "boss", "role": "সুপারভাইজার"},
}
TIMING = ("a", "b", "frames", "amp", "cs", "cc", "file", "len", "total", "voAmp")
HAN = re.compile(r"[ᄀ-ᇿ㄰-㆏가-힣]")
PUNCT = r"[,.!?~…·\s]"
# Unicode jamo → compatibility jamo (what the learner sees)
CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]


def jamo(block):
    if not isinstance(block, str) or len(block) != 1:
        return None
    c = ord(block) - 0xAC00
    if not 0 <= c < 11172:
        return None
    return [CHO[c // 588], JUNG[(c % 588) // 28]] + ([JONG[c % 28]] if c % 28 else [])


SCHEMA = """SPEC FORMAT (KoreanEngine). Top level: {id, course, lessonNo, title (Bangla), titleJp (the lesson title in Korean),
objective (one measurable Bangla can-do sentence), next:{bn, jp (Korean)}, cast (given — copy it exactly), scenes:[...]}. Beats play in order:
  {"t": "<Bangla teacher line>"} — সনসেংনিম (Tanvir), warm simple Bangla, ≤ 260 characters; write Korean words inside t in BANGLA letters
       (e.g. কামসাহাম্নিদা), NEVER Hangul.
  {"j": "<Korean>", "who": "F|M|B", "ro": "<Revised Romanization>", "bro": "<Bangla-letter pronunciation, close to real Seoul speech, e.g.
       কামসাহাম্নিদা>", "bn": "<Bangla meaning>", "key"?: "..."} — native audio (ro, bro and bn on EVERY j beat).
       who: F = 지수 (jisu, Korean coworker / clerk / nurse, woman), M = 라피 (Rafi, the learner's character, Bangladeshi EPS worker, man),
       B = 김 반장 (Kim banjang, factory/farm supervisor, older man). Polite 해요체 (-요) by default, 합니다체 for set phrases and when
       speaking to a boss formally; the boss may speak 해요체 or short commands (-세요). Real language of Korean factories, farms, shipyards,
       dormitories and shops — what EPS workers actually hear (e.g. 반장님, 사장님, 잔업, 안전모, 조심하세요, 빨리빨리, 퇴근).
  {"slow": true} on a j beat = the same line at 0.75x.  {"gap": true, "say"?: "<Bangla prompt>"} = learner speaks.  {"hold": <frames>, "key": "..."} = silence.
Scene types (EXACTLY this order; keys in quotes are mandatory):
 1 hook: "world" street|work|store, "question" (short English question, last word highlighted, e.g. "Can you answer your boss?"), "questionBn";
   beats [{hold:30},{j (the real-life moment, said by F or B), who},{hold:24},{t (the story hook, ≤ 260 chars)}]
 2 title: "goals" [4 short Bangla goals]; beats [{t}]
 3 recall (ONLY from lesson 2): "items" [{q: Bangla prompt}] ×3 from EARLIER lessons; beats [{t}, then for i: {hold:90,key:"h<i>"},{j,who:"M",ro,bn,key:"j<i>"}]
 3b hangul (ONLY when the lesson teaches new Hangul letters — lessons on vowels, consonants, batchim): "head" (Bangla), "rows" [{chars:[{k (a
   syllable that carries the letter, e.g. 아 for ㅏ, 가 for ㄱ, 각 for batchim ㄱ), jamo (the letter itself), ro, bn (Bangla sound), hint (Bangla memory
   hook ≤ 50 chars, e.g. "খুঁটির ডানে দাগ = আ")}]}] max 6 chars per row, max 3 rows; beats [{t}, then for each row i: {j: the row's syllables joined
   with NO spaces, who:"F", ro, bro, bn, key:"r<i>"}, {t: hints for that row, key:"x<i>"}]
 4 learn ×2–4 (one key word/phrase each, main line ≤ 7 Hangul syllables): "n" (1,2,…), "kana" [[syllable, romanization]...] = EXACTLY the Hangul
   syllables of the main j in order (no spaces, no punctuation); "build" {i (tile index), parts [[jamo, Bangla sound]...] = the jamo of that
   syllable in order, e.g. 감 → [["ㄱ","ক/গ"],["ㅏ","আ"],["ㅁ","ম"]], at 0.3}; "mark"?{i, text (Bangla pronunciation warning, ≤ 40 chars), at 0.6};
   "long"?[indices]; "mean", "when", "icon" sun|heart|hand; beats [{t},{j,who:"F",ro,key:"main"},{t}]
 5 speak: beats [{t}, then for 3–4 phrases: {j,who:"F",ro,bn,slow:true},{j same,who:"F",ro,bn},{gap:true}, then {t}]
 6 grammar: "rows" [2 rows of {blocks:[[Korean chunk, romanization, Bangla role, colour "#4CC9F0"|"#FFC845"|"#FF5E8A"|"#3DDC97"]], bn}] — blocks
   joined with NO spaces = the row's j text without spaces/punctuation; beats [{t},{j,who:"F",ro,key:"r0"},{t,key:"e0"},{j,who:"F",ro,key:"r1"},{t,key:"e1"}]
 7 secret: "kind" (e.g. "বাংলা সেতু · সিক্রেট" or "কারখানার সিক্রেট" or "EPS সিক্রেট"), "head" (Bangla), "pairs" [[Bangla, "<Korean> · <romanization>"]] 2–3,
   "why" (the source or the reason it is true — Bangla bridges: SOV word order, postpositions like বিভক্তি, honorific -님 like -সাহেব/জি,
   Sino-Korean numbers, loanwords); beats [{t}, optional {j,who:"M",ro,bn} = one native example sentence]
 8 fix: "wrong" {text, ro, bn}, "right" {text, ro, bn}, "why" (Bangla, ≤ 40 chars) — a typical mistake of Bangladeshi learners (banmal to a boss,
   wrong particle, 네/아니요 confusion, rude 야, dropped -요); beats [{t},{j:wrong.text,who:"M",ro,key:"wrong"},{hold:120,key:"think"},
   {t,key:"why"},{j:right.text,who:"M",ro,key:"right"},{gap:true,say:"ঠিকটা আবার বলো"}]
 9 context: "cards" [3 × {place (Bangla), ko (Korean place name), icon food|train|store|pin, sit (Bangla situation, ≤ 40 chars)}];
   beats [{t},{hold:75,key:"c0"},{j,who:"M",ro,bn,key:"a0"},{hold:75,key:"c1"},{j,..,key:"a1"},{hold:75,key:"c2"},{j,..,key:"a2"}]
10 roleplay pass 1: "pass":1, "world" work|store|street, "place" (Bangla); beats [{t}, 4–6 j lines alternating M with ONE partner (F or B), each with ro and bn]
11 roleplay pass 2: "pass":2, same world/place/lines, but BEFORE every M line insert {gap:true, say:"<Bangla hint what to say>"}; end with {t}
12 quiz ×3: "n" 1..3, "q" (Bangla), "o" [3 × [main, sub]] (Korean options get the Bangla pronunciation in sub; Bangla options sub ""), "a" index;
   quiz 3 has "boss": true and is a real workplace situation combining the lesson; optional "listen": true with a {j,who,ro,key:"listen"} beat
   before the hold; beats [{t},({j,key:"listen"}),{hold:150,key:"count"},{t (reveal)}]
13 mission: "record" [3 Korean lines to record], "real" (Bangla real-life task); beats [{t}]
14 reward: "words" [≤5 × [Korean, Bangla]], "before", "after" (Bangla); beats [{t},{j:"또 만나요!",who:"F",ro:"Tto mannayo!",bn:"আবার দেখা হবে!"}]
BANGLA SOUND KEY (use it in bn, bro, hints and teacher lines): ㅏ আ · ㅓ অ (mouth open) · ㅗ ও (lips round) · ㅜ উ (lips round) ·
ㅡ "উ্" = উ with lips spread/flat, NEVER ঈ or ই · ㅣ ই · ㅐ/ㅔ এ · ㅑ ইয়া · ㅕ ইয়ো (open) · ㅛ ইয়ো · ㅠ ইউ · ㅘ ওয়া · ㅝ ওয়ো · ㅢ উই · word-initial
ㄱ ক, ㄷ ত, ㅂ প, ㅈ চ (soft), between vowels গ দ ব জ · ㅋ ㅌ ㅍ ㅊ strong খ থ ফ ছ · ㄲ ㄸ ㅃ ㅆ ㅉ tense ক্ক ত্ত প্প স্স চ্চ · ㄹ ল/র · ㅇ silent at the start, ং at the end.
Rules: one concept at a time; all explanations in plain Bangla — no English linguistics terms;  every Korean line correct, natural, polite as used in real Korean workplaces with foreign workers;
Revised Romanization; native lines short (≤ 8 words); teacher talk short; honest (no EPS pass/visa/job guarantee); total ≈ 5–7 minutes."""


def bn_digits(n):
    return "".join(BN[int(d)] for d in str(n))


def board_row(n):
    p = COURSE / "design.md"
    if not p.exists():
        return ""
    m = re.search(rf"^\| *(?:{bn_digits(n)}|{n}) *\|(.+)$", p.read_text(encoding="utf-8"), re.M)
    return m.group(0) if m else ""


def strip_timing(o, beat=False):  # "a"/"b" are timing only inside beats (a quiz's "a" is its answer)
    if isinstance(o, dict):
        return {k: strip_timing(v, k == "beats") for k, v in o.items() if not (k in TIMING and (beat or k not in ("a", "b")))}
    if isinstance(o, list):
        return [strip_timing(x, beat) for x in o]
    return o


def earlier(n):
    out = []
    for i in range(1, n):
        p = SPECS / f"koe-{i:02d}.json"
        if p.exists():
            s = json.loads(p.read_text(encoding="utf-8"))
            js = sorted({f"{b['j']} (= {b.get('bn', '')})" for sc in s["scenes"] for b in sc.get("beats", [])
                         if b.get("j") and sc["type"] in ("learn", "speak", "roleplay")})
            out.append(f"Lesson {i} ({s.get('title')}): " + " / ".join(js[:10]))
    return "\n".join(out[-6:]) or "(none — this is lesson 1)"


def lessons_of(design):
    """lesson n (1-based, course order) → its row; works for the board's modules[].lessons[] shape and a flat lesson_sequence."""
    if design.get("lesson_sequence"):
        return {int(x["n"]): x for x in design["lesson_sequence"]}
    out = {}
    for m in design.get("modules", []):
        for l in m.get("lessons", []):
            out[len(out) + 1] = {**l, "module": m.get("title_bn") or m.get("title")}
    return out


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
                if b.get("who") not in ("F", "M", "B"):
                    err.append(f"{where}: j beat needs who F|M|B")
                if not HAN.search(b["j"]):
                    err.append(f"{where}: j must be Hangul: {b['j']}")
                if len(b["j"].split()) > 10:
                    err.append(f"{where}: native line too long (>10 words): {b['j']}")
            if b.get("t") and len(b["t"]) > 320:
                err.append(f"{where}: teacher line too long ({len(b['t'])} chars) — split it")
            if b.get("t") and HAN.search(b["t"]):
                err.append(f"{where}: teacher line contains Hangul — write Korean words in Bangla letters")
        if t == "hook" and not any(b.get("j") for b in bs):
            err.append(f"{where}: needs a j beat")
        if t == "learn":
            main = next((b for b in bs if b.get("key") == "main"), None)
            if not main:
                err.append(f"{where}: needs key main")
            else:
                tiles = "".join(c[0] for c in s.get("kana", [])); spoken = flat(main["j"])
                if tiles != spoken:
                    err.append(f"{where}: kana tiles '{tiles}' must equal the main line '{spoken}'")
                if len(spoken) > 8:
                    err.append(f"{where}: main line too long for tiles (≤ 7 syllables)")
                bd = s.get("build")
                if not bd or not isinstance(bd.get("i"), int) or not 0 <= bd["i"] < len(s.get("kana", [])):
                    err.append(f"{where}: needs build {{i, parts, at}} with a valid tile index")
                else:
                    real = jamo(s["kana"][bd["i"]][0]); got = [p[0] for p in bd.get("parts", [])]
                    if real != got:
                        err.append(f"{where}: build parts of '{s['kana'][bd['i']][0]}' must be exactly {real} (got {got})")
            for f_ in ("mean", "when"):
                if not s.get(f_):
                    err.append(f"{where}: needs {f_}")
        if t == "hangul":
            for r_i, r in enumerate(s.get("rows", [])):
                b = next((x for x in bs if x.get("key") == f"r{r_i}"), None)
                if not b or flat(b.get("j", "")) != "".join(c.get("k", "") for c in r.get("chars", [])):
                    err.append(f"{where}: row {r_i} needs a j beat key r{r_i} whose text is exactly its syllables")
                if f"x{r_i}" not in k:
                    err.append(f"{where}: row {r_i} needs a t beat key x{r_i}")
                for c in r.get("chars", []):
                    if c.get("jamo") and jamo(c.get("k", " ")) and c["jamo"] not in jamo(c["k"]):
                        err.append(f"{where}: '{c['k']}' does not contain the letter {c['jamo']}")
        if t == "grammar":
            for r_i, r in enumerate(s.get("rows", [])[:2]):
                b = next((x for x in bs if x.get("key") == f"r{r_i}"), None)
                if not b:
                    err.append(f"{where}: needs j key r{r_i}"); continue
                joined = flat("".join(bl[0] for bl in r.get("blocks", []))); spoken = flat(b["j"])
                if joined != spoken:
                    err.append(f"{where}: row {r_i} blocks '{joined}' must equal its spoken line '{spoken}'")
            if not {"e0", "e1"} <= k:
                err.append(f"{where}: needs t keys e0 and e1")
        if t == "secret" and not (s.get("head") and s.get("pairs") and s.get("why")):
            err.append(f"{where}: needs head, pairs and why")
        if t == "fix":
            if not {"wrong", "think", "why", "right"} <= k:
                err.append(f"{where}: needs keys wrong think why right")
            if not (isinstance(s.get("wrong"), dict) and isinstance(s.get("right"), dict) and s.get("why")):
                err.append(f"{where}: needs wrong{{text,ro,bn}}, right{{text,ro,bn}} and why")
        if t == "context":
            cards = s.get("cards", [])
            if len(cards) != 3:
                err.append(f"{where}: needs 3 cards")
            for c_i in range(len(cards)):
                if not {f"c{c_i}", f"a{c_i}"} <= k:
                    err.append(f"{where}: card {c_i} needs keys c{c_i} and a{c_i}")
        if t == "recall":
            for r_i in range(len(s.get("items", []))):
                if not {f"h{r_i}", f"j{r_i}"} <= k:
                    err.append(f"{where}: item {r_i} needs keys h{r_i} and j{r_i}")
        if t == "speak":
            js = [b for b in bs if b.get("j")]; gaps = [b for b in bs if b.get("gap")]
            if len(js) not in (6, 8) or len(gaps) != len(js) // 2:
                err.append(f"{where}: needs 3–4 phrases (slow + normal j each) and one gap per phrase")
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
        if t == "mission" and not (s.get("record") and s.get("real")):
            err.append(f"{where}: needs record and real")
        if t == "reward" and not (s.get("before") and s.get("after") and s.get("words")):
            err.append(f"{where}: needs words, before and after")
    # ㅡ is an unrounded উ (owner's sound key) — models keep writing it as ঈ, which teaches a wrong vowel
    txt = json.dumps(spec, ensure_ascii=False)
    bad = sorted({x for x in re.findall(r'"(?:bro|bn|hint)": "([^"]*[ঈঊ][^"]*)"', txt)})
    if bad:
        err.append("ㅡ must be written উ্ (unrounded উ), never ঈ/ঊ — fix: " + " | ".join(bad[:5]))
    # learners are Bangla speakers with little English: no English phrases inside Bangla text (names like EPS/TOPIK/BOESL are fine)
    eng = sorted({m for m in re.findall(r'"(?:t|why|hint|head|kind|mean|when|q|before|after|real|say|sit|place)": "[^"]*?([A-Za-z][a-z]+(?:[ -][A-Za-z][a-z]+){2,})', txt)})
    if eng:
        err.append("plain Bangla only — remove these English phrases from Bangla text: " + " | ".join(eng[:6]))
    for s in sc:
        if s.get("type") == "hangul":
            for r in s.get("rows", []):
                for c in r.get("chars", []):
                    if len(c.get("k", "")) != 1:
                        err.append(f"hangul: k must be ONE syllable block (got '{c.get('k')}')")
    quizzes = [s for s in sc if s.get("type") == "quiz"]
    if quizzes and not quizzes[-1].get("boss"):
        err.append("last quiz needs boss true")
    return err


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    n = int(sys.argv[1]); force = "--force" in sys.argv
    out = SPECS / f"{lid_of(n)}.json"
    if out.exists() and not force:
        log(f"= {out.name} exists"); return
    design = json.loads((COURSE / "design.json").read_text(encoding="utf-8"))  # = the board's 6-design-final.json (copied by hand)
    seq = lessons_of(design); row = seq[n]
    nxt = seq.get(n + 1, {"title_bn": "কোর্স শেষ"})
    rules = {k: design.get(k) for k in ("learner", "signature_secrets", "decisions", "quality_gates", "levels")}
    example = strip_timing(json.loads((SPECS / "ko-01-first-words.json").read_text(encoding="utf-8")))
    sys_p = ("You are the lead course designer of AI University's 'Korean for Bangladeshi EPS workers' course (Bangla explanations, native Korean "
             "audio, animated video lessons, EPS-TOPIK path). You write one lesson as an engine spec. You are an expert Korean teacher and know "
             "real Korean factories, farms, shipyards and the EPS-TOPIK exam.")
    user = (f"LESSON {n} of 30 (board design):\n{json.dumps(row, ensure_ascii=False)}\nBoard table row (Bangla):\n{board_row(n)}\n"
            f"NEXT LESSON: {nxt.get('title_bn') or nxt.get('title')}\n\nCOURSE RULES:\n{json.dumps(rules, ensure_ascii=False)[:6000]}\n\nEARLIER LESSONS (for recall; reuse their phrases):\n{earlier(n)}\n\n"
            f"{SCHEMA}\n\nCAST (copy exactly): {json.dumps(CAST, ensure_ascii=False)}\nid must be \"{lid_of(n)}\", lessonNo \"পাঠ {bn_digits(f'{n:02d}')}\", "
            f"course \"কোরিয়ান ভাষা · EPS-TOPIK-এর পথে\".\n\n"
            f"STYLE EXAMPLE (the hand-made lesson 1; follow its tone and field shapes, NOT its content):\n{json.dumps(example, ensure_ascii=False)[:14000]}\n\n"
            f"Write the full spec JSON for lesson {n}.")
    spec = ask_json(WRITER, sys_p, user, max_tokens=32000); spec["cast"] = CAST; spec["id"] = lid_of(n)
    for attempt in range(2):
        errs = validate(spec, n)
        if not errs:
            break
        log(f"  · repair {attempt + 1}: {len(errs)} problems")
        spec = ask_json(WRITER, sys_p, f"{SCHEMA}\n\nThis spec has problems:\n- " + "\n- ".join(errs[:40]) +
                        f"\n\nSPEC:\n{json.dumps(spec, ensure_ascii=False)}\n\nReturn the full corrected spec JSON (fix only what is listed).", max_tokens=32000)
        spec["cast"] = CAST; spec["id"] = lid_of(n)
    errs = validate(spec, n)
    if errs:
        sys.exit("✗ spec still invalid: " + "; ".join(errs[:10]))
    rv = ask_json(REVIEWER, "You are a native Korean teacher who trains Bangladeshi EPS workers for Korean workplaces and knows Bangla. Check ONLY correctness.",
                  "Check every Korean line (j, text, kana, build, blocks, options, pairs, words, record), its Revised Romanization and its Bangla meaning in "
                  "this lesson spec. Also check politeness level (해요체/합니다체; never banmal to a boss) and whether it is what people really say in a Korean "
                  "factory, farm or shop. Check Bangla-letter pronunciations of Korean inside teacher lines (t) — they should sound close to standard Seoul Korean "
                  "(word-initial ㄱㄷㅂㅈ are soft: ক ত প চ; ㅡ is 'উ্', never ঈ/ই) and keep each Korean word spelled the SAME way in Bangla letters everywhere in the lesson. Return JSON {ok: bool, fixes: [{find, replace, why}]} where find is an exact substring of the JSON text "
                  "below (short but unique) and replace is the corrected text. Empty fixes if all correct.\n\n" + json.dumps(spec, ensure_ascii=False), max_tokens=12000)
    txt = json.dumps(spec, ensure_ascii=False); applied = 0
    for fx in rv.get("fixes", []):
        if fx.get("find") and fx["find"] in txt and fx.get("replace") is not None:  # every occurrence (a wrong spelling usually repeats)
            txt = txt.replace(fx["find"], fx["replace"]); applied += 1
    try:
        spec2 = json.loads(txt)
        if not validate(spec2, n):
            spec = spec2
        else:
            log("  ! review fixes broke the spec — kept the unreviewed version")
    except ValueError:
        log("  ! review fixes broke the JSON — kept the unreviewed version")
    spec["review"] = {"applied": applied, "notes": [f.get("why") for f in rv.get("fixes", [])][:20]}
    out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    chk = subprocess.run([sys.executable, str(ROOT / "scripts/lesson_check.py"), str(out), "--lesson-no", str(n)], capture_output=True, text=True, encoding="utf-8")
    log(chk.stdout.strip())
    if chk.returncode:
        out.rename(out.with_suffix(".failed.json")); sys.exit("✗ lesson_check failed")
    log(f"✓ {out.name}: {len(spec['scenes'])} scenes, {applied} accuracy fixes, cost ≈ ${SPENT['or'] + SPENT['claude']:.3f}")


if __name__ == "__main__":
    main()
