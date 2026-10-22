// AI University — Arabic course lesson video engine ("আরবি ভাষা · গালফের কথ্য আরবি"), v2 (2026-10-22): rebuilt from the current
// JapaneseEngine.tsx so both share one beat/scene schema (recall, workplace world, generic roleplay worlds/partners, boss quiz,
// fix rows, context cards, mission steps), then adapted for Arabic: right-to-left Noto Naskh Arabic (letters stay joined —
// karaoke lights up word by word; syllable tiles keep their joined forms with ZWJ), Latin transliteration + Bangla pronunciation
// (`bro`) on every native line, Gulf worlds (Riyadh/Doha street, baqala, worksite, villa, clinic), Gulf cast looks.
// Spoken Gulf Arabic (Saudi/Qatar). One spec per lesson: src/arabic/specs/<id>.json, written by scripts/arabic_specs.py,
// voiced + timed by scripts/arabic_make.py, rendered by scripts/arabic_cloud.py. Global Class Rules: CLASS_RULES.md.
// Old v1 engine (lesson-1 pilot, older schema): work/arabic/ArabicEngine.v1.tsx.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing, delayRender, continueRender, random } from "remotion";
import { Check, Mic, Headphones, Sparkles, Zap, Volume2, Trophy, Flame, Star, Sun, Heart, Hand, Smile, ArrowRight, ArrowLeft, Turtle, Gauge, Blocks, ShoppingBasket, Gamepad2, X, TrainFront, UtensilsCrossed, Home, Target, Smartphone, Crown, Car, HardHat, Store as StoreIcon, Stethoscope, Landmark, Bus, Plane, Wallet, CookingPot } from "lucide-react";

/* ---------- design tokens ---------- */
const C = {
  bg0: "#080B24", bg1: "#151A4D", ink: "#10142E", white: "#FFFFFF", mute: "#AEB5E2", line: "rgba(255,255,255,.13)",
  red: "#E63946", sakura: "#FF8FB1", sun: "#FFC845", mint: "#3DDC97", sky: "#4CC9F0", violet: "#8B5CF6", cream: "#FFF7E8",
};
const ACC = [C.sky, C.sun, C.sakura, C.mint, C.violet, C.red];
const BN = "Anek", EN = "Montserrat", AR = "NaskhAR", JP = AR, MARU = AR;
if (typeof document !== "undefined") {
  for (const [n, u] of [["Anek", "fonts/AnekBangla.ttf"], ["Montserrat", "fonts/Montserrat.ttf"], ["NaskhAR", "fonts/NotoNaskhArabic.ttf"]]) {
    const h = delayRender(`font ${n}`);
    const f = new FontFace(n, `url(${staticFile(u)})`, { weight: "100 900" });
    f.load().then(() => { document.fonts.add(f); continueRender(h); }).catch(() => continueRender(h));
  }
}
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const ent = (f: number, fps: number, d: number, dur = 22) => spring({ frame: f - d, fps, config: { damping: 200 }, durationInFrames: dur });
const pop = (f: number, fps: number, d: number) => spring({ frame: f - d, fps, config: { damping: 11, mass: 0.6 } });

/* ---------- spec (timed by arabic_make.py) ---------- */
export type Beat = { t?: string; j?: string; show?: string; who?: string; ro?: string; bn?: string; slow?: boolean; gap?: boolean; say?: string; bro?: string; hold?: number; key?: string; file?: string; frames: number; a: number; b: number; amp?: string; cs?: number[]; cc?: string };
export type Scene = { type: string; beats: Beat[]; len: number; [k: string]: any };
export type Spec = { id: string; course: string; lessonNo: string; title: string; titleJp: string; next: { bn: string; jp: string }; cast: Record<string, { name: string; bn: string; voice: string }>; scenes: Scene[]; total: number };
export const arLen = (spec: Spec) => spec.total || spec.scenes.reduce((n, s) => n + s.len, 0) + 20;
type P = { s: Scene; spec: Spec };
const amp = (env: string | undefined, i: number) => (env && i >= 0 && i < env.length ? (env.charCodeAt(i) - 48) / 9 : 0);
const beatAt = (s: Scene, f: number) => s.beats.find((b) => f >= b.a && f < b.b);
const byKey = (s: Scene, k: string) => s.beats.find((b) => b.key === k);
const teacherAmp = (s: Scene, f: number) => { const b = beatAt(s, f); return b && b.t ? amp(b.amp, f - b.a) : 0; };
const lineAmp = (s: Scene, f: number, who?: string) => { const b = beatAt(s, f); return b && b.j && (!who || b.who === who) ? amp(b.amp, f - b.a) : 0; };
// frame (inside the beat) at which display character i starts; falls back to even spacing when the text differs from the voiced one
const charStarts = (b: Beat, text: string) => {
  const chars = [...text]; const cc = [...(b.cc || "")]; const out: number[] = []; let k = 0;
  for (let i = 0; i < chars.length; i++) {
    const at = cc.indexOf(chars[i], k);
    if (b.cs && at >= 0) { out.push(b.cs[at]); k = at + 1; } else out.push(Math.round(((b.frames - 6) * i) / chars.length));
  }
  return out;
};

/* ---------- primitives ---------- */
const Rise: React.FC<{ d: number; children: React.ReactNode; style?: React.CSSProperties; y?: number }> = ({ d, children, style, y = 40 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const s = ent(f, fps, d);
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * y}px)`, ...style }}>{children}</div>;
};
const Pop: React.FC<{ d: number; children: React.ReactNode; style?: React.CSSProperties; rot?: number }> = ({ d, children, style, rot = 0 }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const k = pop(f, fps, d);
  return <div style={{ opacity: Math.min(1, k * 1.5), transform: `scale(${0.4 + 0.6 * k}) rotate(${rot * k + (1 - k) * -12}deg)`, ...style }}>{children}</div>;
};
const Kicker: React.FC<{ text: string; color?: string; icon?: React.FC<any>; d?: number }> = ({ text, color = C.sun, icon: I = Sparkles, d = 2 }) => (
  <div style={{ position: "absolute", left: 110, top: 124 }}>
    <Pop d={d}><span style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 24px 12px", borderRadius: 40, background: color, color: C.ink, fontFamily: BN, fontSize: 30, fontWeight: 800, boxShadow: `0 10px 30px ${color}55` }}><I size={30} strokeWidth={2.6} /> {text}</span></Pop>
  </div>
);
const SFX: React.FC<{ at: number; name: string; vol?: number }> = ({ at, name, vol = 0.3 }) => (at >= 0 ? <Sequence from={Math.round(at)} durationInFrames={45}><Audio src={staticFile(`aiu2/${name}.mp3`)} volume={vol} /></Sequence> : null);
export const Confetti: React.FC<{ at: number; x?: number; y?: number; n?: number }> = ({ at, x = 960, y = 500, n = 70 }) => {
  const f = useCurrentFrame(); const t = f - at; if (t < 0 || t > 70) return null;
  return <>{Array.from({ length: n }, (_, i) => {
    const ang = random(`a${i}`) * Math.PI * 2, sp = 10 + random(`s${i}`) * 22;
    return <div key={i} style={{ position: "absolute", left: x + Math.cos(ang) * sp * t, top: y + Math.sin(ang) * sp * t + 0.6 * t * t, width: 14, height: 22, borderRadius: 3, background: ACC[i % 6], transform: `rotate(${t * 12 + i * 30}deg)`, opacity: interpolate(t, [50, 70], [1, 0], clamp) }} />;
  })}</>;
};
// live waveform: bars from the line's loudness envelope, drawn up to the current frame
export const Wave: React.FC<{ b?: Beat; w: number; h: number; color?: string; bars?: number }> = ({ b, w, h, color = C.sky, bars = 48 }) => {
  const f = useCurrentFrame(); if (!b) return null;
  const p = interpolate(f, [b.a, b.b], [0, 1], clamp); const env = b.amp || "";
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center", gap: 4 }}>
      {Array.from({ length: bars }, (_, i) => {
        const x = Math.floor((i / bars) * env.length); const v = env ? (env.charCodeAt(x) - 48) / 9 : 0; const on = i / bars <= p;
        return <div key={i} style={{ flex: 1, height: Math.max(6, v * h), borderRadius: 4, background: on ? color : "rgba(255,255,255,.14)" }} />;
      })}
    </div>
  );
};
// Arabic text (right to left, letters joined) that lights up word by word when each word is spoken. Without TTS timestamps
// arabic_make.py estimates the start of every character from the loudness envelope (cs), so word starts follow the voice.
export const KanaKaraoke: React.FC<{ b: Beat; text: string; size: number; color?: string; dim?: string; font?: string; glow?: string }> = ({ b, text, size, color = C.ink, dim = "rgba(16,20,46,.28)", font = AR, glow = C.red }) => {
  const f = useCurrentFrame(); const st = charStarts(b, text);
  const words: { w: string; at: number }[] = []; let i = 0;
  for (const w of text.split(" ")) { const n = [...w].length; if (n) words.push({ w, at: st[i] ?? 0 }); i += n + 1; }
  return <span dir="rtl" style={{ fontFamily: font, fontSize: size, fontWeight: 700, lineHeight: 1.6, whiteSpace: "nowrap", direction: "rtl", unicodeBidi: "isolate" }}>{words.map(({ w, at }, k) => {
    const t = b.a + at; const nx = k + 1 < words.length ? b.a + words[k + 1].at : b.b; const on = f >= t; const now = on && f < nx && f < b.b;
    const kk = interpolate(f, [t, t + 6], [0, 1], clamp);
    return <span key={k} style={{ display: "inline-block", margin: `0 ${size * 0.1}px`, color: on ? color : dim, transform: `translateY(${now ? -size * 0.06 : 0}px) scale(${1 + (now ? 0.08 * (1 - kk * 0.4) : 0)})`, textShadow: now ? `0 0 ${size * 0.3}px ${glow}` : "none" }}>{w}</span>;
  })}</span>;
};
// font size that keeps a line inside `width` px (Naskh with harakat ≈ 0.5 em per character)
export const fit = (text: string, max: number, width: number) => Math.max(34, Math.min(max, Math.floor(width / Math.max(1, [...text].filter((c) => !/[ً-ٰٟ]/.test(c)).length * 0.5))));
// Arabic syllable chunks shown apart but with their joined (initial/medial/final) letter forms
const HARAKA = /[ً-ٰٟـ]/; const NOJOIN = "اأإآٱدذرزوؤةء";
const baseEnd = (x: string) => { const c = [...x].filter((ch) => !HARAKA.test(ch)); return c[c.length - 1] || ""; };
const joinedChunks = (chunks: string[], full: string) => {
  let pos = 0; const after: boolean[] = [];
  for (const c of chunks) { const at = full.indexOf(c, pos); const end = at < 0 ? pos : at + c.length; after.push(at < 0 || full[end] === " " || end >= full.length || /[،.!؟?]/.test(full[end] || "")); pos = end; }
  return chunks.map((c, i) => {
    const pre = i > 0 && !after[i - 1] && !NOJOIN.includes(baseEnd(chunks[i - 1])) ? "‍" : "";
    const post = i < chunks.length - 1 && !after[i] && !NOJOIN.includes(baseEnd(c)) ? "‍" : "";
    return pre + c + post;
  });
};
// Bangla pronunciation line (every native line carries `bro`, so learners who can't read Latin letters still say it right)
export const Bro: React.FC<{ b: Beat; size?: number; color?: string }> = ({ b, size = 30, color = "#4A5280" }) => b.bro ? <div style={{ fontFamily: BN, fontSize: size, fontWeight: 700, color }}>{b.bro}</div> : null;
export const Ar: React.FC<{ t: string; size: number; color?: string; style?: React.CSSProperties }> = ({ t, size, color = C.ink, style }) => <span dir="rtl" style={{ fontFamily: AR, fontWeight: 700, fontSize: size, color, lineHeight: 1.6, direction: "rtl", unicodeBidi: "isolate", ...style }}>{t}</span>;

/* ---------- anime characters ---------- */
// Gulf cast looks: উস্তাদ (teacher, cap + beard), rafi (the learner, Bangladeshi worker), saudi (red-check shemagh + agal,
// supervisor/kafeel), qatari (white ghutra, shopkeeper/driver/customer), madam (woman in a black hijab — employer, nurse, clerk)
export type Look = "sensei" | "rafi" | "saudi" | "qatari" | "madam";
const LOOKS: Record<Look, { skin: string; hair: string; iris: string; top: string; top2: string }> = {
  sensei: { skin: "#E0A77E", hair: "#16121F", iris: "#5B3A29", top: "#23306B", top2: "#FFFFFF" },
  rafi: { skin: "#C98B62", hair: "#120E18", iris: "#3B2618", top: "#1F9D6B", top2: "#0E5E40" },
  saudi: { skin: "#C9926A", hair: "#1A1210", iris: "#3B2618", top: "#F6F5F0", top2: "#D9D6CC" },
  qatari: { skin: "#D4A07A", hair: "#1A1210", iris: "#3B2618", top: "#FFFFFF", top2: "#D9D6CC" },
  madam: { skin: "#E3B48E", hair: "#14121A", iris: "#4A2E1E", top: "#1C1B24", top2: "#2C2A38" },
};
const DEF_LOOK: Record<string, Look> = { F: "madam", M: "rafi", B: "saudi", S: "qatari" };
const lookOf = (spec: Spec, k: string): Look => { const l = (spec.cast[k] as any)?.look as Look; return l && LOOKS[l] ? l : DEF_LOOK[k] || "qatari"; };
export const Anime: React.FC<{ look: Look; size: number; a: number; mood?: "calm" | "happy" | "wow"; wave?: boolean; bg?: string }> = ({ look, size, a, mood = "calm", wave, bg }) => {
  const f = useCurrentFrame(); const L = LOOKS[look] || LOOKS.qatari; const id = `${look}${size}`;
  const arab = look === "saudi" || look === "qatari"; const cloth = look === "saudi" ? `url(#p${id})` : "#FAFAF6";
  const blink = (f + look.length * 31) % 109 < 4 ? 0.1 : 1; const m = Math.min(1, a * 1.3); const bob = Math.sin(f / 18) * 2 + a * 3;
  const eye = (cx: number) => mood === "happy"
    ? <path d={`M${cx - 11} 98 Q${cx} 86 ${cx + 11} 98`} stroke="#1A1424" strokeWidth={5} fill="none" strokeLinecap="round" />
    : <g transform={`translate(0 ${96 * (1 - blink)}) scale(1 ${blink})`}>
        <ellipse cx={cx} cy={96} rx={12} ry={mood === "wow" ? 17 : 15} fill="#fff" />
        <ellipse cx={cx} cy={98} rx={9.5} ry={mood === "wow" ? 13 : 12} fill={L.iris} />
        <ellipse cx={cx} cy={100} rx={5} ry={6.5} fill="#120C10" />
        <circle cx={cx - 4} cy={92} r={3.6} fill="#fff" /><circle cx={cx + 4} cy={104} r={1.8} fill="#fff" opacity={0.8} />
        <path d={`M${cx - 14} 84 Q${cx} 77 ${cx + 14} 84`} stroke="#1A1424" strokeWidth={4.5} fill="none" strokeLinecap="round" />
      </g>;
  const g0 = bg || (look === "sensei" ? C.sun : look === "madam" ? C.sakura : arab ? C.sun : C.sky);
  const g1 = look === "sensei" ? C.mint : look === "madam" ? C.violet : look === "saudi" ? C.red : look === "qatari" ? C.sky : C.mint;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block" }}>
      <defs><clipPath id={`c${id}`}><circle cx="100" cy="100" r="96" /></clipPath>
        <pattern id={`p${id}`} width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#FFFFFF" /><path d="M0 0 L12 12 M12 0 L0 12" stroke="#D62839" strokeWidth="2.4" /></pattern>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={g0} /><stop offset="1" stopColor={g1} /></linearGradient></defs>
      <circle cx="100" cy="100" r="96" fill={`url(#g${id})`} />
      <g clipPath={`url(#c${id})`}>
        {wave && <g transform={`rotate(${-18 + Math.sin(f / 4) * 14} 150 170)`}><rect x="146" y="96" width="22" height="78" rx="11" fill={L.top} /><circle cx="157" cy="92" r="13" fill={L.skin} /></g>}
        <g transform={`translate(0 ${-bob * 0.4})`}>
          <path d="M28 205 C32 162 62 148 100 148 C138 148 168 162 172 205 Z" fill={L.top} />
          {look === "sensei" && <><path d="M86 148 L100 170 L114 148 Z" fill={L.top2} /><path d="M97 158 L100 192 L103 158 Z" fill={C.mint} /></>}
          {look === "rafi" && <><path d="M74 150 Q100 176 126 150" stroke={L.top2} strokeWidth={8} fill="none" /><rect x="58" y="160" width="10" height="45" rx="5" fill="#2B2B3A" /><rect x="132" y="160" width="10" height="45" rx="5" fill="#2B2B3A" /></>}
          {arab && <><path d="M88 148 L100 166 L112 148" stroke={L.top2} strokeWidth={4} fill="none" /><path d="M100 166 L100 205" stroke={L.top2} strokeWidth={3} /><circle cx="100" cy="176" r="2.6" fill={L.top2} /><circle cx="100" cy="188" r="2.6" fill={L.top2} /></>}
          {look === "madam" && <path d="M40 205 C44 150 70 128 100 128 C130 128 156 150 160 205 Z" fill={L.top2} />}
          {look !== "madam" && <rect x="89" y="128" width="22" height="24" rx="9" fill={L.skin} />}
        </g>
        <g transform={`translate(0 ${-bob}) rotate(${Math.sin(f / 23) * 2 + a * 2} 100 100)`}>
          {arab && <path d="M46 92 C42 34 158 34 154 92 L170 190 L130 176 L136 120 C130 96 70 96 64 120 L70 176 L30 190 Z" fill={cloth} stroke={look === "qatari" ? "#DCDAD0" : "none"} strokeWidth={2} />}
          {look === "madam" && <path d="M44 100 C40 36 160 36 156 100 L164 170 C150 150 126 150 100 152 C74 150 50 150 36 170 Z" fill={L.hair} />}
          {look !== "madam" && <><ellipse cx="59" cy="100" rx="7" ry="11" fill={L.skin} /><ellipse cx="141" cy="100" rx="7" ry="11" fill={L.skin} /></>}
          <path d="M60 84 C58 52 80 40 100 40 C120 40 142 52 140 84 L138 112 C134 136 116 146 100 146 C84 146 66 136 62 112 Z" fill={L.skin} />
          {look === "sensei" && <path d="M56 92 C50 44 82 30 104 32 C130 32 152 48 146 92 C142 72 132 62 118 58 C114 70 96 66 86 58 C74 62 62 72 56 92 Z" fill={L.hair} />}
          {look === "rafi" && <path d="M58 90 C52 46 82 34 102 34 C126 34 150 48 144 90 C140 70 130 58 120 56 L116 66 L106 56 L96 68 L88 56 C72 60 62 72 58 90 Z" fill={L.hair} />}
          {arab && <path d="M54 92 C50 40 150 40 146 92 C136 74 64 74 54 92 Z" fill={cloth} stroke={look === "qatari" ? "#DCDAD0" : "none"} strokeWidth={2} />}
          {arab && <><ellipse cx="100" cy="56" rx="44" ry="10" fill="none" stroke="#141414" strokeWidth={7} /><ellipse cx="100" cy="66" rx="46" ry="9" fill="none" stroke="#141414" strokeWidth={5} /></>}
          {look === "madam" && <path d="M58 92 C56 48 144 48 142 92 C138 64 120 54 100 54 C80 54 62 64 58 92 Z" fill={L.hair} />}
          {look === "madam" && <path d="M58 92 C58 70 66 58 74 54 C62 70 62 100 66 118 C62 112 58 102 58 92 Z M142 92 C142 70 134 58 126 54 C138 70 138 100 134 118 C138 112 142 102 142 92 Z" fill={L.hair} />}
          {look === "sensei" && <path d="M64 58 C66 30 134 30 136 58 C120 52 80 52 64 58 Z" fill="#F7F5EE" stroke="#D8D2C2" strokeWidth={2} />}
          {(arab || look === "sensei") && <path d={arab ? "M62 108 C62 140 82 152 100 152 C118 152 138 140 138 108 C132 126 118 132 100 132 C82 132 68 126 62 108 Z" : "M68 116 C70 138 86 146 100 146 C114 146 130 138 132 116 C124 130 114 134 100 134 C86 134 76 130 68 116 Z"} fill={L.hair} />}
          {(arab || look === "sensei") && <path d="M86 121 Q100 115 114 121 L112 124 Q100 120 88 124 Z" fill={L.hair} />}
          {eye(82)}{eye(118)}
          {look === "sensei" && <><rect x="66" y="84" width="32" height="26" rx="12" fill="none" stroke="#1A1424" strokeWidth={3} /><rect x="102" y="84" width="32" height="26" rx="12" fill="none" stroke="#1A1424" strokeWidth={3} /><path d="M98 95 L102 95" stroke="#1A1424" strokeWidth={3} /></>}
          <ellipse cx="72" cy="118" rx="8" ry="4.5" fill="#FF7E9A" opacity={look === "madam" ? 0.55 : 0.45} /><ellipse cx="128" cy="118" rx="8" ry="4.5" fill="#FF7E9A" opacity={look === "madam" ? 0.55 : 0.45} />
          <path d="M98 112 L100 116" stroke="#9A5C3C" strokeWidth={2.5} strokeLinecap="round" />
          {m > 0.06 ? <path d={`M${90 - m * 3} 126 Q100 ${126 + 6 + m * 12} ${110 + m * 3} 126 Q100 ${128 + m * 2} ${90 - m * 3} 126 Z`} fill="#7A2233" />
            : mood === "wow" ? <ellipse cx="100" cy="129" rx="5" ry="6" fill="#7A2233" />
            : <path d="M90 126 Q100 134 110 126" stroke="#7A2233" strokeWidth={3.5} fill="none" strokeLinecap="round" />}
        </g>
      </g>
      <circle cx="100" cy="100" r="96" fill="none" stroke="#fff" strokeWidth="5" />
    </svg>
  );
};

/* ---------- worlds ---------- */
const Petals: React.FC<{ n?: number; op?: number }> = ({ n = 26, op = 0.85 }) => {
  const f = useCurrentFrame();
  return <>{Array.from({ length: n }, (_, i) => {
    const sp = 0.6 + random(`p${i}`) * 1.2; const x0 = random(`x${i}`) * 2100 - 100; const y = ((f * sp * 2.2 + random(`y${i}`) * 1200) % 1250) - 80;
    const x = x0 + Math.sin(f / 30 + i) * 60 - f * 0.6 * sp;
    return <div key={i} style={{ position: "absolute", left: ((x % 2100) + 2100) % 2100 - 60, top: y, width: 9, height: 9, borderRadius: "50%", background: C.sun, boxShadow: `0 0 10px ${C.sun}`, opacity: op * (0.5 + random(`o${i}`) * 0.5), transform: `rotate(${f * 3 * sp + i * 40}deg)` }} />;
  })}</>;
};
const SIGNS = ["بقالة", "مطعم", "صيدلية", "قهوة", "جوالات", "حلويات", "الرياض"];
const Palm: React.FC<{ x: number; h: number; bottom?: number }> = ({ x, h, bottom = 270 }) => { const f = useCurrentFrame(); const sw = Math.sin(f / 40 + x) * 4;
  return <svg width={260} height={h + 120} viewBox={`0 0 260 ${h + 120}`} style={{ position: "absolute", left: x, bottom }}>
    <path d={`M126 ${h + 120} C120 ${h * 0.6} 136 ${h * 0.3} 130 110`} stroke="#3A2618" strokeWidth={16} fill="none" />
    <g transform={`rotate(${sw} 130 110)`}>{[-150, -115, -70, -30, 15, 55].map((r, i) => <path key={i} d="M130 110 Q190 80 250 120 Q190 96 130 116 Z" fill={i % 2 ? "#1E5B3A" : "#2A7A4C"} transform={`rotate(${r + 90} 130 110)`} />)}</g>
  </svg>; };
const Street: React.FC = () => {
  const f = useCurrentFrame(); const z = interpolate(f, [0, 500], [1.04, 1.16]);
  const train = interpolate(f % 360, [0, 160], [2200, -2600], clamp);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#0D1033 0%, #3A1E4A 48%, #B4553A 88%, #E08A4A 100%)", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: "50% 60%" }}>
        <svg width={360} height={960} viewBox="0 0 360 960" style={{ position: "absolute", left: 1180, bottom: 250 }}>
          <path d="M60 960 C100 600 130 300 140 40 L220 40 C230 300 260 600 300 960 Z" fill="#191637" />
          <path d="M140 40 Q180 260 220 40 Z" fill="#3A1E4A" />
          <path d="M140 40 Q180 260 220 40" stroke="#7FD4FF" strokeWidth={5} fill="none" opacity={0.9} />
          {Array.from({ length: 26 }, (_, k) => <rect key={k} x={150 - k * 0.6} y={300 + k * 24} width={60 + k * 1.2} height={6} fill="#FFD98A" opacity={0.35} />)}
        </svg>
        {Array.from({ length: 16 }, (_, i) => { const w = 110 + random(`bw${i}`) * 120, h = 360 + random(`bh${i}`) * 420, x = i * 128 - 40;
          return <div key={i} style={{ position: "absolute", left: x, bottom: 250, width: w, height: h, background: i % 2 ? "#141236" : "#1B1842", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)" }}>
            {Array.from({ length: 30 }, (_, k) => <div key={k} style={{ position: "absolute", left: 12 + (k % 4) * (w / 4.4), top: 20 + Math.floor(k / 4) * 46, width: w / 7, height: 18, background: random(`w${i}-${k}`) > 0.55 ? "#FFD98A" : "transparent", opacity: 0.55 }} />)}
          </div>; })}
        {SIGNS.map((s, i) => { const c = [C.sakura, C.sky, C.sun, C.red, C.mint][i % 5]; const fl = 0.85 + Math.sin(f / (5 + i) + i) * 0.15;
          return <div key={i} style={{ position: "absolute", left: 90 + i * 270, top: 170 + (i % 3) * 70, padding: "14px 12px", border: `4px solid ${c}`, borderRadius: 10, direction: "rtl", fontFamily: AR, fontWeight: 700, fontSize: 44, lineHeight: 1.3, color: "#fff", textShadow: `0 0 18px ${c}, 0 0 36px ${c}`, boxShadow: `0 0 30px ${c}88, inset 0 0 20px ${c}55`, opacity: fl, background: "rgba(10,8,30,.55)" }}>{s}</div>; })}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 300, height: 22, background: "#2C2650" }} />
        <div style={{ position: "absolute", left: train, bottom: 322, width: 2200, height: 80, borderRadius: 16, background: "linear-gradient(#E9ECF5, #B7BED6)", display: "flex", gap: 26, padding: "16px 30px", boxSizing: "border-box" }}>
          {Array.from({ length: 22 }, (_, k) => <div key={k} style={{ flex: "none", width: 70, height: 34, borderRadius: 6, background: "#FFE7A8", boxShadow: "0 0 18px #FFE7A8" }} />)}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, height: 6, background: C.mint }} />
        </div>
        {[20, 520, 1560, 1780].map((x, i) => <Palm key={i} x={x} h={380 + (i % 2) * 90} />)}
        <div style={{ position: "absolute", left: -200, right: -200, bottom: 0, height: 300, background: "linear-gradient(#24203F, #0E0C22)" }}>
          {Array.from({ length: 12 }, (_, k) => <div key={k} style={{ position: "absolute", left: 120 + k * 190, top: 120, width: 110, height: 150, background: "rgba(255,255,255,.75)", transform: "perspective(400px) rotateX(60deg)" }} />)}
        </div>
      </AbsoluteFill>
      <Petals n={30} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,.6) 100%)" }} />
    </AbsoluteFill>
  );
};
const Store: React.FC = () => {
  const prods = ["#FF5E5B", "#FFC845", "#4CC9F0", "#3DDC97", "#FF8FB1", "#8B5CF6"];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#FFF7E8, #F3E6CF)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120, background: "linear-gradient(90deg, #0E7A4A 0 60%, #FFFFFF 60% 62%, #F2B233 62% 100%)" }} />
      <div style={{ position: "absolute", left: 700, top: 14, padding: "0 34px", borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 8px 20px rgba(0,0,0,.15)" }}><span style={{ fontFamily: AR, fontWeight: 700, fontSize: 60, color: "#0E7A4A", direction: "rtl" }}>بقالة الخير</span><span style={{ fontFamily: EN, fontWeight: 900, fontSize: 26, color: "#B07A10" }}>BAQALA</span></div>
      {[0, 1, 2].map((r) => <div key={r} style={{ position: "absolute", left: 60, width: 760, top: 200 + r * 170, height: 140 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: "#C9B79A" }} />
        <div style={{ display: "flex", gap: 14, padding: "0 14px", alignItems: "flex-end", height: 126 }}>
          {Array.from({ length: 11 }, (_, k) => <div key={k} style={{ width: 52, height: 70 + ((k * 37 + r * 13) % 50), borderRadius: 8, background: prods[(k + r) % 6], boxShadow: "inset 0 -10px 0 rgba(0,0,0,.12)" }} />)}
        </div></div>)}
      <div style={{ position: "absolute", right: 60, top: 170, width: 640, height: 520, borderRadius: 18, background: "linear-gradient(#DDF3FF, #B9E1F5)", border: "10px solid #9FB6C6", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: 20, boxSizing: "border-box" }}>
        {Array.from({ length: 12 }, (_, k) => <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-end", justifyContent: "center" }}>{[0, 1, 2].map((q) => <div key={q} style={{ width: 30, height: 90, borderRadius: "10px 10px 6px 6px", background: k % 3 === 0 ? "rgba(76,201,240,.75)" : k % 3 === 1 ? "#FFC845" : "#3DDC97" }} />)}</div>)}
      </div>
      <div style={{ position: "absolute", left: -20, right: -20, bottom: 0, height: 330, background: "linear-gradient(#8A6B4E, #6D533B)", borderTop: "16px solid #B08A62" }} />
      <div style={{ position: "absolute", right: 300, bottom: 250, width: 220, height: 150, borderRadius: 16, background: "#3A3F58" }}><div style={{ margin: 18, height: 60, borderRadius: 8, background: "#9BE7C4" }} /></div>
    </AbsoluteFill>
  );
};
// worksite: building under construction, tower crane, Arabic safety sign, sun haze
const Work: React.FC = () => {
  const f = useCurrentFrame(); const jib = Math.sin(f / 70) * 8; const hook = 140 + Math.sin(f / 40) * 40;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#F6D9A6 0%, #F0B977 45%, #E7A25E 70%, #C98A52 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 260, top: 80, width: 200, height: 200, borderRadius: "50%", background: "#FFF1C9", boxShadow: "0 0 140px 60px rgba(255,236,190,.6)" }} />
      <div style={{ position: "absolute", left: 980, bottom: 300, width: 700, height: 560, background: "#B9A58A" }}>
        {Array.from({ length: 5 }, (_, r) => <div key={r} style={{ position: "absolute", left: 0, right: 0, top: r * 112, height: 14, background: "#8E7A60" }} />)}
        {Array.from({ length: 6 }, (_, c) => <div key={c} style={{ position: "absolute", top: 0, bottom: 0, left: c * 136, width: 16, background: "#8E7A60" }} />)}
        {Array.from({ length: 12 }, (_, k) => <div key={k} style={{ position: "absolute", left: 30 + (k % 5) * 136, top: 30 + Math.floor(k / 5) * 112, width: 90, height: 66, background: "rgba(40,40,60,.55)" }} />)}
      </div>
      <div style={{ position: "absolute", left: 1600, bottom: 300, width: 34, height: 760, background: "repeating-linear-gradient(0deg, #F2B233 0 30px, #C88A10 30px 34px)" }} />
      <div style={{ position: "absolute", left: 1617, top: 0, width: 0, height: 0, transform: `rotate(${jib}deg)`, transformOrigin: "0 0" }}>
        <div style={{ position: "absolute", left: -1100, top: 20, width: 1400, height: 26, background: "repeating-linear-gradient(90deg, #F2B233 0 40px, #C88A10 40px 46px)" }} />
        <div style={{ position: "absolute", left: -700, top: 46, width: 4, height: hook, background: "#333" }} />
        <div style={{ position: "absolute", left: -760, top: 46 + hook, width: 120, height: 70, background: "#7C8C9C", border: "4px solid #4E5C6A" }} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 160, display: "flex", alignItems: "center", gap: 16, padding: "12px 26px", borderRadius: 12, background: "#1F9D6B", color: "#fff", boxShadow: "0 8px 20px rgba(0,0,0,.2)" }}><HardHat size={50} /><span dir="rtl" style={{ fontFamily: AR, fontWeight: 700, fontSize: 50, lineHeight: 1.4 }}>السلامة أولاً</span></div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 260, height: 40, background: "repeating-linear-gradient(45deg, #FFC845 0 40px, #1E1E26 40px 80px)" }} />
      {[180, 420, 720].map((x, i) => <div key={i} style={{ position: "absolute", left: x, bottom: 300, width: 0, height: 0, borderLeft: "34px solid transparent", borderRight: "34px solid transparent", borderBottom: "90px solid #FF6A2B" }} />)}
      <div style={{ position: "absolute", left: -20, right: -20, bottom: 0, height: 262, background: "linear-gradient(#B98B5E, #8F6A46)" }} />
    </AbsoluteFill>
  );
};
// villa / majlis (housework, drivers, home visits): arches, carpet, coffee pot (dallah)
const Villa: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(#F7EEDD, #EAD9BC)", overflow: "hidden" }}>
    {[0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 120 + i * 440, top: 120, width: 300, height: 520, borderRadius: "150px 150px 0 0", background: "linear-gradient(#9CC9E8, #E8F4FB)", border: "16px solid #C9A46A", boxSizing: "border-box" }} />)}
    <div style={{ position: "absolute", left: 0, right: 0, top: 640, height: 30, background: "#C9A46A" }} />
    <div style={{ position: "absolute", left: -20, right: -20, bottom: 0, height: 410, background: "#8C2F39" }}>
      <div style={{ position: "absolute", left: 160, right: 160, top: 40, bottom: 40, border: "10px solid #E7C27A", backgroundImage: "repeating-linear-gradient(45deg, rgba(231,194,122,.25) 0 20px, transparent 20px 40px)" }} />
    </div>
    <svg width={160} height={200} viewBox="0 0 160 200" style={{ position: "absolute", left: 880, bottom: 300 }}>
      <path d="M50 190 L110 190 L120 120 C120 80 100 70 100 50 L60 50 C60 70 40 80 40 120 Z" fill="#D4A63A" stroke="#8A6514" strokeWidth={4} />
      <path d="M40 110 C10 100 6 70 0 60" stroke="#8A6514" strokeWidth={8} fill="none" /><path d="M120 100 C150 110 150 150 120 160" stroke="#8A6514" strokeWidth={6} fill="none" />
      <path d="M62 50 L80 14 L98 50 Z" fill="#D4A63A" stroke="#8A6514" strokeWidth={4} />
    </svg>
  </AbsoluteFill>
);
// clinic / hospital reception
const Clinic: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(#F4FAFB, #DCEEF1)", overflow: "hidden" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120, background: "#0E8A7A" }} />
    <div style={{ position: "absolute", left: 640, top: 18, display: "flex", alignItems: "center", gap: 20, padding: "0 30px", borderRadius: 14, background: "#fff" }}><span style={{ width: 60, height: 60, display: "grid", placeItems: "center" }}><svg width={56} height={56}><rect x={20} y={4} width={16} height={48} fill={C.red} /><rect x={4} y={20} width={48} height={16} fill={C.red} /></svg></span><span dir="rtl" style={{ fontFamily: AR, fontWeight: 700, fontSize: 58, color: "#0E8A7A", lineHeight: 1.4 }}>مستوصف</span><span style={{ fontFamily: EN, fontWeight: 900, fontSize: 26, color: "#0E8A7A" }}>CLINIC</span></div>
    <div style={{ position: "absolute", left: 80, top: 200, width: 420, height: 300, borderRadius: 20, background: "#fff", border: "6px solid #BFDDE2" }}>
      {Array.from({ length: 5 }, (_, k) => <div key={k} style={{ margin: "26px 30px 0", height: 22, borderRadius: 11, background: k ? "#E2EFF1" : "#0E8A7A", width: `${90 - k * 12}%` }} />)}
    </div>
    <div style={{ position: "absolute", right: 120, top: 210, width: 380, height: 120, borderRadius: 16, background: "#12343B", color: "#7CF0C9", fontFamily: EN, fontWeight: 900, fontSize: 64, display: "grid", placeItems: "center" }}>A-027</div>
    <div style={{ position: "absolute", left: -20, right: -20, bottom: 0, height: 330, background: "linear-gradient(#B9D7DC, #9CC3CA)", borderTop: "16px solid #E8F3F5" }} />
  </AbsoluteFill>
);
export const WORLDS: Record<string, React.FC> = { street: () => <Street />, store: () => <Store />, work: () => <Work />, home: () => <Villa />, clinic: () => <Clinic /> };

export const Studio: React.FC = () => {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, r: number, c: string, ph: number) => <div style={{ position: "absolute", left: x + Math.sin(f / 90 + ph) * 80, top: y + Math.cos(f / 110 + ph) * 60, width: r, height: r, borderRadius: "50%", background: c, filter: "blur(120px)", opacity: 0.35 }} />;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at 50% 40%, ${C.bg1}, ${C.bg0})`, overflow: "hidden" }}>
      {blob(-200, -200, 700, C.violet, 0)}{blob(1400, -120, 600, C.sakura, 2)}{blob(1300, 700, 700, C.red, 4)}{blob(-100, 760, 600, C.sky, 1)}
      <div style={{ position: "absolute", right: -120, top: 120, width: 520, height: 520, borderRadius: "50%", background: C.red, opacity: 0.12 }} />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle at 50% 100%, transparent 36%, rgba(255,255,255,.05) 37%, transparent 40%, transparent 54%, rgba(255,255,255,.05) 55%, transparent 58%)", backgroundSize: "120px 60px" }} />
      <Petals n={14} op={0.45} />
    </AbsoluteFill>
  );
};

/* ---------- scenes ---------- */
const SHook: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const j = s.beats.find((b) => b.j)!; const t = s.beats.find((b) => b.t)!;
  const q = ((s.question as string) || "Can you answer in Arabic?").split(" "); const W = WORLDS[s.world || "street"] || Street;
  const who = j.who || "S";
  return (
    <AbsoluteFill>
      <W />
      <div style={{ position: "absolute", right: 170, bottom: 120, transform: `translateY(${(1 - ent(f, fps, j.a - 26)) * 300}px)` }}>
        <Anime look={lookOf(spec, who)} size={360} a={lineAmp(s, f, who)} mood={f > j.b ? "happy" : "calm"} wave={f >= j.a && f < j.b + 30} />
      </div>
      {f >= j.a - 4 && <div style={{ position: "absolute", right: 470, bottom: 200, maxWidth: 1000 }}>
        <Pop d={j.a - 4}><div style={{ padding: "26px 44px", borderRadius: 40, borderBottomRightRadius: 6, background: "#fff", boxShadow: "0 30px 60px rgba(0,0,0,.5)" }}><KanaKaraoke b={j} text={j.show || j.j!} size={fit(j.show || j.j!, 100, 860)} /><div style={{ fontFamily: EN, fontSize: 34, fontWeight: 700, color: "#5B6390", marginTop: 4 }}>{j.ro}</div><Bro b={j} size={32} color={C.red} /></div></Pop>
      </div>}
      <div style={{ position: "absolute", left: 70, top: 150, width: 800, padding: "36px 40px 44px", borderRadius: 36, background: "rgba(8,6,28,.72)", boxShadow: "0 30px 80px rgba(0,0,0,.5)", opacity: interpolate(f, [j.b, j.b + 10], [0, 1], clamp) }}>
        <div style={{ fontFamily: EN, fontSize: 88, fontWeight: 900, color: "#fff", lineHeight: 1.08, textShadow: "0 10px 40px rgba(0,0,0,.6)" }}>
          {q.map((w, i) => { const d = j.b + 8 + i * 5; const k = pop(f, fps, d); return <span key={i} style={{ display: "inline-block", marginRight: 26, opacity: Math.min(1, k * 1.4), transform: `translateY(${(1 - k) * 60}px) rotate(${(1 - k) * -8}deg)`, color: i === q.length - 1 ? C.sun : "#fff" }}>{w}</span>; })}
        </div>
        <Rise d={t.a + 10} style={{ marginTop: 22 }}><span style={{ padding: "10px 26px", borderRadius: 30, background: C.red, fontFamily: BN, fontSize: 44, fontWeight: 800, color: "#fff" }}>{s.questionBn || "তুমি কি আরবিতে উত্তর দিতে পারবে?"}</span></Rise>
      </div>
      <SFX at={j.a - 4} name="pop" vol={0.3} /><SFX at={j.b + 8} name="whoosh" vol={0.25} />
    </AbsoluteFill>
  );
};

const STitle: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const t = s.beats[0];
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 120, top: 230 }}><Pop d={4}><div style={{ filter: "drop-shadow(0 30px 60px rgba(0,0,0,.45))" }}><Anime look="sensei" size={420} a={teacherAmp(s, f)} mood="happy" /></div></Pop>
        <Rise d={14} style={{ marginTop: -24, display: "flex", justifyContent: "center" }}><span style={{ padding: "10px 26px", borderRadius: 30, background: "#fff", fontFamily: BN, fontSize: 30, fontWeight: 800, color: C.ink }}>উস্তাদ · <span style={{ color: C.red }}>এআই প্রশিক্ষক</span></span></Rise></div>
      <div style={{ position: "absolute", left: 640, right: 100, top: 190 }}>
        <Rise d={4}><span style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: C.sky }}>{spec.course} · {spec.lessonNo}</span></Rise>
        <Rise d={8} style={{ marginTop: 10 }}><div style={{ fontFamily: BN, fontSize: 100, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>{spec.title}</div></Rise>
        <Rise d={14}><Ar t={spec.titleJp} size={54} color={C.sun} /></Rise>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {(s.goals as string[]).map((g, i) => (
            <Pop key={i} d={t.a + t.frames * (0.35 + i * 0.12)} rot={i % 2 ? 2 : -2}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 26px", borderRadius: 22, background: "rgba(255,255,255,.08)", border: `2px solid ${ACC[i]}` }}>
                <div style={{ width: 54, height: 54, borderRadius: 27, background: ACC[i], display: "grid", placeItems: "center", flex: "none" }}><Check size={32} color={C.ink} strokeWidth={3.5} /></div>
                <span style={{ fontFamily: BN, fontSize: 36, fontWeight: 700, color: "#fff" }}>{g}</span>
              </div>
            </Pop>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const WHEN: Record<string, React.FC<any>> = { sun: Sun, heart: Heart, hand: Hand, smile: Smile };
// learn: syllable tiles right to left (kana = [[chunk, latin, Bangla sound]...], joined = the main line without spaces/punctuation)
const SLearn: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame();
  const main = byKey(s, "main")!; const ex = s.beats[s.beats.length - 1];
  const kana = s.kana as [string, string, string?][]; const text = kana.map((k) => k[0]).join(""); const st = charStarts(main, text);
  const shown = joinedChunks(kana.map((k) => k[0]), main.j || ""); const nLearn = spec.scenes.filter((x) => x.type === "learn").length;
  const n = kana.length; const tw = Math.min(170, 1500 / n - 16);
  const I = WHEN[s.icon] || Sun; const exP = (x: number) => ex.a + ex.frames * x;
  return (
    <AbsoluteFill>
      <Kicker text={`জরুরি কথা ${bn(s.n || 1)} / ${bn(nLearn)}`} color={ACC[((s.n || 1) - 1) % 6]} icon={Sparkles} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "row-reverse", justifyContent: "center", gap: 16 }}>
        {kana.map(([, r, rb], i) => { const k = shown[i];
          const at = main.a + st[i]; const lit = f >= at; const now = lit && f < at + 10; const mark = s.mark?.i === i && f >= exP(0.45); const long = (s.long || []).includes(i) && f >= exP(0.35);
          return (
            <Pop key={i} d={s.beats[0].a + 4 + i * 3} rot={0}>
              <div style={{ minWidth: tw, textAlign: "center" }}>
                <div style={{ height: tw * 1.15, padding: "0 18px", borderRadius: 24, background: lit ? "#fff" : "rgba(255,255,255,.12)", display: "grid", placeItems: "center", boxShadow: now ? `0 0 0 8px ${C.sun}, 0 0 60px ${C.sun}` : mark ? `0 0 0 8px ${C.red}` : "0 18px 40px rgba(0,0,0,.4)", transform: `translateY(${now ? -16 : 0}px)` }}>
                  <span dir="rtl" style={{ fontFamily: AR, fontWeight: 700, fontSize: tw * 0.56, lineHeight: 1.6, color: lit ? (mark ? C.red : C.ink) : "rgba(255,255,255,.5)" }}>{k}</span>
                </div>
                <div style={{ marginTop: 12, fontFamily: EN, fontSize: Math.min(40, tw * 0.3), fontWeight: 800, color: mark ? C.red : long ? C.sun : lit ? C.sun : C.mute }}>{r}</div>
                {rb && <div style={{ fontFamily: BN, fontSize: Math.min(32, tw * 0.24), fontWeight: 700, color: mark ? C.red : lit ? "#fff" : C.mute }}>{rb}</div>}
                {long && <div style={{ height: 8, borderRadius: 4, background: C.sun, marginTop: 4 }} />}
              </div>
            </Pop>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 460, right: 460, top: 560, display: "flex", alignItems: "center", gap: 20 }}>
        <Volume2 size={40} color={f >= main.a && f < main.b ? C.sun : C.mute} /><Wave b={main} w={900} h={70} color={C.sun} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, display: "flex", justifyContent: "center", gap: 30 }}>
        <Pop d={exP(0.04)}><div style={{ padding: "20px 40px", borderRadius: 26, background: C.red, fontFamily: BN, fontSize: 52, fontWeight: 800, color: "#fff", boxShadow: `0 20px 50px ${C.red}66` }}>{s.mean}</div></Pop>
        <Pop d={exP(0.25)}><div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 30px", borderRadius: 26, background: "rgba(255,255,255,.1)", border: `2px solid ${C.line}`, fontFamily: BN, fontSize: 36, fontWeight: 600, color: "#fff", maxWidth: 900 }}><I size={40} color={C.sun} style={{ flex: "none" }} /> {s.when}</div></Pop>
      </div>
      {s.mark && <Rise d={exP(0.45)} style={{ position: "absolute", left: 0, right: 0, top: 800, display: "flex", justifyContent: "center" }}><div style={{ padding: "14px 30px", borderRadius: 20, background: "rgba(230,57,70,.18)", border: `2px solid ${C.red}`, fontFamily: BN, fontSize: 34, fontWeight: 700, color: "#fff" }}>⚠️ {s.mark.text}</div></Rise>}
      {kana.map((_, i) => <SFX key={i} at={main.a + st[i]} name="pop" vol={0.08} />)}
    </AbsoluteFill>
  );
};

const SSpeak: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const js = s.beats.filter((b) => b.j); const gaps = s.beats.filter((b) => b.gap);
  let cur = s.beats.filter((b) => (b.j || b.gap) && f >= b.a - 10).pop(); if (!cur) cur = js[0];
  const idx = s.beats.indexOf(cur); const line = cur.j ? cur : [...s.beats.slice(0, idx)].reverse().find((b) => b.j)!;
  const phrase = Math.floor(js.indexOf(line) / 2);
  const yours = cur.gap && f < cur.b; const k = cur.gap ? interpolate(f, [cur.a, cur.b], [1, 0], clamp) : 0;
  const started = f >= js[0].a - 10; const done = f > gaps[gaps.length - 1].b;
  return (
    <AbsoluteFill>
      <Kicker text="উচ্চারণ ল্যাব · শোনো → বলো" color={C.sky} icon={Mic} />
      {!started && <Rise d={6} style={{ position: "absolute", left: 0, right: 0, top: 400, textAlign: "center" }}><div style={{ fontFamily: BN, fontSize: 70, fontWeight: 800, color: "#fff" }}><Turtle size={60} color={C.mint} /> ধীরে <span style={{ color: C.sun }}>→</span> <Gauge size={60} color={C.sun} /> স্বাভাবিক <span style={{ color: C.sun }}>→</span> <Mic size={60} color={C.red} /> তুমি</div></Rise>}
      {started && !done && (
        <div style={{ position: "absolute", left: 220, right: 220, top: 240, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <div style={{ display: "flex", gap: 18 }}>
            <span style={{ padding: "10px 24px", borderRadius: 30, background: line.slow && !yours ? C.mint : "rgba(255,255,255,.1)", fontFamily: BN, fontSize: 30, fontWeight: 800, color: line.slow && !yours ? C.ink : C.mute }}>🐢 ধীরে</span>
            <span style={{ padding: "10px 24px", borderRadius: 30, background: !line.slow && !yours ? C.sun : "rgba(255,255,255,.1)", fontFamily: BN, fontSize: 30, fontWeight: 800, color: !line.slow && !yours ? C.ink : C.mute }}>⚡ স্বাভাবিক</span>
            <span style={{ padding: "10px 24px", borderRadius: 30, background: yours ? C.red : "rgba(255,255,255,.1)", fontFamily: BN, fontSize: 30, fontWeight: 800, color: yours ? "#fff" : C.mute }}>🎤 তুমি</span>
          </div>
          <div style={{ padding: "36px 70px", borderRadius: 40, background: "#fff", boxShadow: "0 30px 70px rgba(0,0,0,.45)", textAlign: "center" }}>
            <KanaKaraoke b={line} text={line.j!} size={fit(line.j!, 110, 1300)} />
            <div style={{ fontFamily: EN, fontSize: 40, fontWeight: 800, color: C.red, marginTop: 2 }}>{line.ro}</div><Bro b={line} size={38} color={C.ink} />
            <div style={{ fontFamily: BN, fontSize: 34, color: "#5B6390" }}>{line.bn}</div>
          </div>
          <div style={{ height: 180, display: "flex", alignItems: "center", gap: 36 }}>
            {yours ? <>
              <div style={{ position: "relative", width: 170, height: 170 }}>
                <svg width={170} height={170} style={{ position: "absolute", transform: "rotate(-90deg)" }}><circle cx={85} cy={85} r={76} stroke="rgba(255,255,255,.15)" strokeWidth={10} fill="none" /><circle cx={85} cy={85} r={76} stroke={C.red} strokeWidth={10} fill="none" strokeDasharray={478} strokeDashoffset={478 * (1 - k)} strokeLinecap="round" /></svg>
                <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: C.red, display: "grid", placeItems: "center", transform: `scale(${1 + Math.sin(f / 4) * 0.06})`, boxShadow: `0 0 ${30 + Math.sin(f / 4) * 20}px ${C.red}` }}><Mic size={64} color="#fff" /></div>
              </div>
              <div style={{ fontFamily: BN, fontSize: 64, fontWeight: 800, color: "#fff" }}>এবার <span style={{ color: C.red }}>তুমি</span> বলো!</div>
            </> : <div style={{ display: "flex", alignItems: "center", gap: 24 }}><Headphones size={54} color={C.sky} /><Wave b={line} w={700} h={80} color={line.slow ? C.mint : C.sun} /></div>}
          </div>
          <div style={{ display: "flex", gap: 14 }}>{[0, 1, 2].map((j) => <div key={j} style={{ width: j === phrase ? 54 : 18, height: 18, borderRadius: 9, background: j < phrase ? C.mint : j === phrase ? C.sun : C.line }} />)}</div>
        </div>
      )}
      {done && <Pop d={gaps[gaps.length - 1].b + 4} style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center" }}><div style={{ fontFamily: BN, fontSize: 90, fontWeight: 800, color: "#fff" }}>চমৎকার! <span style={{ color: C.sun }}>⭐⭐⭐</span></div></Pop>}
      {gaps.map((g, i) => <SFX key={i} at={g.a} name="pop" vol={0.22} />)}
      {done && <Confetti at={gaps[gaps.length - 1].b + 4} y={420} />}
    </AbsoluteFill>
  );
};

const SGrammar: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const rows = s.rows as { blocks: [string, string, string, string][]; bn: string }[];
  return (
    <AbsoluteFill>
      <Kicker text="ব্যাকরণ — ব্লক দিয়ে দেখি" color={C.violet} icon={Blocks} />
      <div style={{ position: "absolute", left: 120, right: 120, top: 230, display: "flex", flexDirection: "column", gap: 70 }}>
        {rows.map((row, r) => {
          const say = byKey(s, `r${r}`)!; const ex = byKey(s, `e${r}`)!; if (f < say.a - 14) return <div key={r} style={{ height: 260 }} />;
          const text = row.blocks.map((b) => b[0]).join(""); const st = charStarts(say, text); let ci = 0;
          const fs = text.length > 16 ? 56 : text.length > 10 ? 68 : 84;
          return (
            <div key={r} style={{ height: 260 }}>
              <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "center", alignItems: "flex-start", gap: 26 }}>
                {row.blocks.map(([jp, ro, mean, col], i) => {
                  const at = say.a + st[ci]; ci += [...jp].length; const lab = ex.a + ex.frames * ((i + 0.6) / (row.blocks.length + 1.2));
                  const hot = f >= lab && f < lab + ex.frames / (row.blocks.length + 1);
                  return (
                    <Pop key={i} d={at - 4} rot={[-3, 2, -2][i % 3]}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ padding: "20px 44px", borderRadius: 26, background: col, boxShadow: hot ? `0 0 0 8px #fff, 0 0 60px ${col}` : `0 16px 0 rgba(0,0,0,.25), 0 26px 50px rgba(0,0,0,.4)`, transform: `translateY(${hot ? -10 : 0}px)` }}>
                          <div dir="rtl" style={{ fontFamily: AR, fontWeight: 700, fontSize: fs, color: C.ink, lineHeight: 1.5, whiteSpace: "nowrap" }}>{jp}</div>
                          <div style={{ fontFamily: EN, fontSize: 34, fontWeight: 800, color: "rgba(16,20,46,.7)" }}>{ro}</div>
                        </div>
                        <div style={{ marginTop: 16, fontFamily: BN, fontSize: 34, fontWeight: 700, color: "#fff", opacity: interpolate(f, [lab, lab + 10], [0, 1], clamp), transform: `translateY(${interpolate(f, [lab, lab + 10], [16, 0], clamp)}px)` }}>{mean}</div>
                      </div>
                    </Pop>
                  );
                })}
                <Pop d={ex.a + ex.frames * 0.82}><div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 16 }}><span style={{ padding: "18px 30px", borderRadius: 22, background: "#fff", fontFamily: BN, fontSize: 46, fontWeight: 800, color: C.ink }}>{row.bn}</span><ArrowLeft size={56} color={C.sun} /></div></Pop>
              </div>
            </div>
          );
        })}
      </div>
      {(() => { const e0 = byKey(s, "e0")!; const at = e0.a + e0.frames * 0.74; return f >= at && f < e0.b + 20 ? <Rise d={at} style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center" }}><div style={{ padding: "12px 30px", borderRadius: 20, background: "rgba(255,200,69,.16)", border: `2px solid ${C.sun}`, fontFamily: BN, fontSize: 34, fontWeight: 700, color: "#fff" }}>💡 {s.tip || "আরবি লেখা চলে ডান → বাম"}</div></Rise> : null; })()}
    </AbsoluteFill>
  );
};

const SRole: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const pass2 = s.pass === 2;
  const intro = s.beats[0]; const scene = f >= intro.b - 10;
  const cur = s.beats.filter((b) => (b.j || b.gap) && f >= b.a - 6).pop();
  const k = ent(f, fps, intro.b - 10, 30);
  const world = s.world || "store"; const W = WORLDS[world] || Store; const shop = world === "store";
  const partner = s.beats.find((b) => b.j && b.who !== "M")?.who || "S";
  const bubble = (b: Beat) => {
    const L = b.who === "M"; const hide = pass2 && !L;
    return (
      <div key={b.a} style={{ position: "absolute", top: 200, [L ? "left" : "right"]: 420, maxWidth: 900 } as any}>
        <Pop d={b.a - 6}><div style={{ padding: "24px 36px", borderRadius: 34, [L ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 6, background: "#fff", boxShadow: "0 24px 50px rgba(0,0,0,.35)", borderTop: `8px solid ${L ? C.sky : C.sakura}` } as any}>
          {hide ? <div style={{ display: "flex", alignItems: "center", gap: 20 }}><Volume2 size={54} color={C.sakura} /><Wave b={b} w={360} h={60} color={C.sakura} bars={26} /><span style={{ fontFamily: BN, fontSize: 30, color: "#5B6390" }}>শুধু শোনো</span></div>
            : <><KanaKaraoke b={b} text={b.show || b.j!} size={fit(b.show || b.j!, 72, 820)} /><div style={{ fontFamily: EN, fontSize: 32, fontWeight: 700, color: L ? "#1E7FA8" : C.red }}>{b.ro}</div><Bro b={b} size={30} color={L ? "#1E7FA8" : C.red} />{b.bn && <div style={{ fontFamily: BN, fontSize: 32, fontWeight: 600, color: "#4A5280" }}>{b.bn}</div>}</>}
        </div></Pop>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: k, transform: `scale(${1.1 - 0.1 * k})` }}><W /></AbsoluteFill>
      {!scene && <AbsoluteFill style={{ background: "rgba(8,11,36,.55)" }} />}
      <Kicker text={pass2 ? "তোমার পালা — তুমি রাফি!" : `রোলপ্লে · ${s.place || (shop ? "বাকালা (মুদি দোকান)" : "কাজের জায়গা")}`} color={pass2 ? C.red : C.mint} icon={ShoppingBasket} />
      {scene && <>
        <div style={{ position: "absolute", left: 90, bottom: 210, textAlign: "center", transform: `translateY(${(1 - k) * 200}px)` }}>
          <Anime look="rafi" size={300} a={lineAmp(s, f, "M")} mood={cur?.gap ? "wow" : "calm"} />
          <div style={{ marginTop: 8, padding: "6px 20px", borderRadius: 20, background: C.ink, display: "inline-block", fontFamily: BN, fontSize: 30, fontWeight: 800, color: "#fff" }}>{pass2 ? "তুমি (রাফি)" : spec.cast.M.bn}</div>
        </div>
        <div style={{ position: "absolute", right: 90, bottom: 210, textAlign: "center", transform: `translateY(${(1 - k) * 200}px)` }}>
          <Anime look={lookOf(spec, partner)} size={300} a={lineAmp(s, f, partner)} mood={f > (s.beats[s.beats.length - 1].b - 40) ? "happy" : "calm"} />
          <div style={{ marginTop: 8, padding: "6px 20px", borderRadius: 20, background: C.ink, display: "inline-block", fontFamily: BN, fontSize: 30, fontWeight: 800, color: "#fff" }}>{spec.cast[partner]?.bn}{(spec.cast[partner] as any)?.role ? ` · ${(spec.cast[partner] as any).role}` : shop ? " · দোকানি" : ""}</div>
        </div>
        {cur && cur.j && f < cur.b + 30 && bubble(cur)}
        {cur && cur.gap && f < cur.b && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center" }}>
            <Pop d={cur.a}><div style={{ display: "flex", alignItems: "center", gap: 30, padding: "26px 40px", borderRadius: 34, background: C.ink, border: `4px solid ${C.red}`, boxShadow: `0 0 60px ${C.red}88` }}>
              <div style={{ position: "relative", width: 130, height: 130 }}>
                <svg width={130} height={130} style={{ position: "absolute", transform: "rotate(-90deg)" }}><circle cx={65} cy={65} r={58} stroke="rgba(255,255,255,.15)" strokeWidth={9} fill="none" /><circle cx={65} cy={65} r={58} stroke={C.red} strokeWidth={9} fill="none" strokeDasharray={364} strokeDashoffset={364 * (1 - interpolate(f, [cur.a, cur.b], [1, 0], clamp))} strokeLinecap="round" /></svg>
                <div style={{ position: "absolute", inset: 18, borderRadius: "50%", background: C.red, display: "grid", placeItems: "center" }}><Mic size={50} color="#fff" /></div>
              </div>
              <div><div style={{ fontFamily: BN, fontSize: 30, color: C.mute }}>🎤 তোমার পালা — আরবিতে বলো:</div><div style={{ fontFamily: BN, fontSize: 52, fontWeight: 800, color: "#fff" }}>{cur.say}</div></div>
            </div></Pop>
          </div>
        )}
      </>}
      {s.beats.filter((b) => b.j).map((b, i) => <SFX key={i} at={b.a - 6} name="pop" vol={0.15} />)}
      {pass2 && <Confetti at={s.beats[s.beats.length - 1].a} y={300} />}
    </AbsoluteFill>
  );
};

const SQuiz: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const hold = byKey(s, "count")!; const listen = byKey(s, "listen"); const reveal = f >= hold.b;
  const left = Math.max(0, Math.ceil((hold.b - f) / 30)); const bar = interpolate(f, [hold.a, hold.b], [1, 0], clamp);
  const opts = s.o as [string, string][];
  return (
    <AbsoluteFill>
      <Kicker text={s.boss ? "বস চ্যালেঞ্জ!" : `চ্যালেঞ্জ ${bn(s.n)} / ৩`} color={s.boss ? C.red : C.sun} icon={s.boss ? Crown : Gamepad2} />
      <Rise d={6} style={{ position: "absolute", left: 160, right: 160, top: 215, textAlign: "center" }}><div style={{ fontFamily: BN, fontSize: 62, fontWeight: 800, color: "#fff" }}>{s.q}</div></Rise>
      {listen && <div style={{ position: "absolute", left: 0, right: 0, top: 320, display: "flex", justifyContent: "center", alignItems: "center", gap: 26 }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, background: C.sky, display: "grid", placeItems: "center", transform: `scale(${f >= listen.a && f < listen.b ? 1.12 + Math.sin(f / 3) * 0.05 : 1})`, boxShadow: f >= listen.a && f < listen.b ? `0 0 60px ${C.sky}` : "none" }}><Volume2 size={64} color={C.ink} /></div>
        <Wave b={listen} w={520} h={80} color={C.sky} bars={30} />
        {reveal && <Ar t={listen.j!} size={fit(listen.j!, 60, 700)} color="#fff" />}
      </div>}
      <div style={{ position: "absolute", left: 320, right: 320, top: listen ? 480 : s.boss ? 450 : 380, display: "flex", flexDirection: "column", gap: 22 }}>
        {opts.map(([main, sub], i) => {
          const right = reveal && i === s.a; const k = pop(f, fps, hold.b + 2); const jp = /[\u0600-\u06FF]/.test(main);
          return (
            <Rise key={i} d={s.beats[0].a + 10 + i * 6} y={30}>
              <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "18px 30px", borderRadius: 26, background: right ? C.mint : "#fff", opacity: reveal && !right ? 0.35 : 1, transform: right ? `scale(${1 + 0.05 * k})` : "none", boxShadow: right ? `0 0 60px ${C.mint}` : "0 16px 36px rgba(0,0,0,.35)" }}>
                <div style={{ width: 66, height: 66, borderRadius: 33, background: right ? "#fff" : [C.sky, C.sun, C.sakura][i], display: "grid", placeItems: "center", fontFamily: EN, fontWeight: 900, fontSize: 34, color: C.ink, flex: "none" }}>{right ? <Check size={38} color="#0E9F6E" strokeWidth={4} /> : "ABC"[i]}</div>
                <span dir={jp ? "rtl" : undefined} style={{ fontFamily: jp ? AR : BN, fontSize: jp ? (main.length > 28 ? 36 : main.length > 16 ? 44 : 52) : main.length > 30 ? 38 : 46, fontWeight: jp ? 700 : 800, color: C.ink, lineHeight: jp ? 1.55 : 1.25 }}>{main}</span>
                {sub && <span style={{ fontFamily: EN, fontSize: main.length > 12 ? 22 : 30, fontWeight: 700, color: "#5B6390" }}>{sub}</span>}
              </div>
            </Rise>
          );
        })}
      </div>
      {!reveal && f >= hold.a && <div style={{ position: "absolute", left: 460, right: 460, top: 900, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ flex: 1, height: 22, borderRadius: 11, background: "rgba(255,255,255,.15)", overflow: "hidden" }}><div style={{ width: `${bar * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.sun})` }} /></div>
        <div style={{ fontFamily: BN, fontSize: 60, fontWeight: 900, color: C.sun, width: 70, textAlign: "center" }}>{bn(left)}</div>
      </div>}
      {reveal && <div style={{ position: "absolute", right: 260, top: 300, opacity: interpolate(f, [hold.b, hold.b + 8, hold.b + 50, hold.b + 70], [0, 1, 1, 0], clamp), transform: `translateY(${-interpolate(f, [hold.b, hold.b + 70], [0, 120], clamp)}px)`, fontFamily: EN, fontSize: 80, fontWeight: 900, color: C.sun, textShadow: `0 0 30px ${C.sun}` }}>+10 XP</div>}
      <Confetti at={hold.b} y={560} />
      <SFX at={hold.b} name="chime" vol={0.35} />
    </AbsoluteFill>
  );
};

// kana: rows of characters light up as the native voice reads them; then a big card walks through each one with its
// romaji, Bangla sound and memory hint. Spec: rows:[{chars:[{k,ro,bn,hint}]}], beats r<i> (j = the row's characters) + x<i> (teacher hints)
const SKana: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const rows = s.rows as { chars: { k: string; ro: string; bn?: string; hint?: string }[] }[];
  let focus: { k: string; ro: string; bn?: string; hint?: string } | null = null; let fi = -1, fr = -1;
  rows.forEach((r, i) => { const x = byKey(s, `x${i}`); if (x && f >= x.a && f < x.b + 6) { fi = Math.min(r.chars.length - 1, Math.floor(((f - x.a) / x.frames) * r.chars.length)); fr = i; focus = r.chars[fi]; } });
  const n = Math.max(...rows.map((r) => r.chars.length)); const tile = Math.min(150, 1500 / n - 18);
  return (
    <AbsoluteFill>
      <Kicker text={s.head || "নতুন অক্ষর"} color={C.sky} icon={Sparkles} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        {rows.map((r, i) => {
          const say = byKey(s, `r${i}`)!; const st = charStarts(say, r.chars.map((c) => c.k).join(""));
          if (f < say.a - 20) return <div key={i} style={{ height: tile + 50 }} />;
          return (
            <div key={i} style={{ display: "flex", gap: 16 }}>
              {r.chars.map((c, j) => {
                const at = say.a + st[j]; const lit = f >= at; const now = lit && f < at + 10; const foc = fr === i && fi === j;
                return (
                  <Pop key={j} d={say.a - 16 + j * 2}>
                    <div style={{ width: tile, textAlign: "center" }}>
                      <div style={{ height: tile, borderRadius: 22, background: lit ? "#fff" : "rgba(255,255,255,.12)", display: "grid", placeItems: "center", boxShadow: now || foc ? `0 0 0 7px ${C.sun}, 0 0 50px ${C.sun}` : "0 14px 30px rgba(0,0,0,.35)", transform: `translateY(${now || foc ? -12 : 0}px)` }}>
                        <span style={{ fontFamily: MARU, fontSize: tile * 0.66, color: lit ? C.ink : "rgba(255,255,255,.5)" }}>{c.k}</span>
                      </div>
                      <div style={{ marginTop: 8, fontFamily: EN, fontSize: Math.min(34, tile * 0.28), fontWeight: 800, color: lit ? C.sun : C.mute }}>{c.ro}</div>
                    </div>
                  </Pop>
                );
              })}
            </div>
          );
        })}
      </div>
      {focus && <div style={{ position: "absolute", left: 300, right: 300, bottom: 150, display: "flex", alignItems: "center", gap: 36, padding: "24px 40px", borderRadius: 32, background: "rgba(8,11,36,.9)", border: `3px solid ${C.sun}` }}>
        <span style={{ fontFamily: MARU, fontSize: 150, color: "#fff", lineHeight: 1 }}>{(focus as any).k}</span>
        <div><div style={{ fontFamily: EN, fontSize: 48, fontWeight: 900, color: C.sun }}>{(focus as any).ro}{(focus as any).bn ? <span style={{ fontFamily: BN, color: "#fff", marginLeft: 18 }}>({(focus as any).bn})</span> : null}</div>
          {(focus as any).hint && <div style={{ fontFamily: BN, fontSize: 34, color: "#fff", lineHeight: 1.35, marginTop: 6 }}>💡 {(focus as any).hint}</div>}</div>
      </div>}
      {rows.map((_, i) => <SFX key={i} at={byKey(s, `r${i}`)!.a - 16} name="whoosh" vol={0.15} />)}
    </AbsoluteFill>
  );
};

// spaced recall from earlier lessons: prompt → the learner says it during the hold → the native answer
const SRecall: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const items = s.items as { q: string }[];
  return (
    <AbsoluteFill>
      <Kicker text="মনে আছে? আগের ক্লাস" color={C.violet} icon={Sparkles} />
      <div style={{ position: "absolute", left: 220, right: 220, top: 240, display: "flex", flexDirection: "column", gap: 26 }}>
        {items.map((it, i) => {
          const h = byKey(s, `h${i}`)!, j = byKey(s, `j${i}`)!; if (f < h.a - 10) return null;
          const yours = f >= h.a && f < h.b; const shown = f >= j.a;
          return (
            <Rise key={i} d={h.a - 10}>
              <div style={{ display: "flex", alignItems: "center", gap: 30, padding: "24px 34px", borderRadius: 28, background: shown ? "#fff" : "rgba(255,255,255,.08)", border: `3px solid ${shown ? C.mint : yours ? C.red : C.line}` }}>
                <div style={{ flex: 1, fontFamily: BN, fontSize: 40, fontWeight: 700, color: shown ? C.ink : "#fff" }}>{it.q}</div>
                <div style={{ minWidth: 460, textAlign: "right" }}>
                  {shown ? <><KanaKaraoke b={j} text={j.show || j.j!} size={fit(j.show || j.j!, 56, 600)} /><div style={{ fontFamily: EN, fontSize: 28, fontWeight: 700, color: "#0E9F6E" }}>{j.ro}</div><Bro b={j} size={28} color={C.ink} /></>
                    : yours ? <span style={{ fontFamily: BN, fontSize: 40, fontWeight: 800, color: C.red }}>🎤 মনে করে বলো! {bn(Math.ceil((h.b - f) / 30))}</span> : null}
                </div>
              </div>
            </Rise>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// mistake recovery: a wrong version → the learner thinks (hold) → stamp + the right one with why
const SFix: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const rows = s.rows as { wrong: string; wro: string; wbro?: string; right: string; rro: string; rbro?: string; why: string }[];
  return (
    <AbsoluteFill>
      <Kicker text="ভুল ধরো, শুধরে নাও" color={C.red} icon={X} />
      <div style={{ position: "absolute", left: 140, right: 140, top: 240, display: "flex", flexDirection: "column", gap: 40 }}>
        {rows.map((r, i) => {
          const q = byKey(s, `q${i}`)!, h = byKey(s, `h${i}`)!, x = byKey(s, `x${i}`)!;
          if (f < q.a - 6) return null;
          const st = pop(f, fps, h.b); const ok = f >= x.a; const thinking = f >= h.a && f < h.b;
          return (
            <Rise key={i} d={q.a - 6}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
                <div style={{ position: "relative", padding: "28px 36px", borderRadius: 28, background: "rgba(230,57,70,.12)", border: `3px solid ${C.red}88` }}>
                  <Ar t={r.wrong} size={fit(r.wrong, 64, 620)} color="#fff" />
                  <div style={{ fontFamily: EN, fontSize: 32, fontWeight: 800, color: C.sakura }}>{r.wro}</div>{r.wbro && <div style={{ fontFamily: BN, fontSize: 28, fontWeight: 700, color: "#FFD0DA" }}>{r.wbro}</div>}
                  {thinking && <div style={{ position: "absolute", right: 30, top: 30, fontFamily: BN, fontSize: 34, fontWeight: 800, color: C.sun }}>🤔 ভাবো… {bn(Math.ceil((h.b - f) / 30))}</div>}
                  <div style={{ position: "absolute", right: 26, top: "50%", marginTop: -52, width: 104, height: 104, borderRadius: 52, border: `7px solid ${C.red}`, display: "grid", placeItems: "center", color: C.red, fontFamily: BN, fontWeight: 900, fontSize: 34, opacity: f >= h.b ? Math.min(1, st * 2) : 0, transform: `scale(${2.4 - 1.4 * st}) rotate(-14deg)` }}>ভুল</div>
                </div>
                <div style={{ padding: "28px 36px", borderRadius: 28, background: ok ? "#fff" : "rgba(255,255,255,.06)", border: `3px solid ${ok ? C.mint : C.line}` }}>
                  {ok ? <><Ar t={r.right} size={fit(r.right, 64, 620)} /><div style={{ fontFamily: EN, fontSize: 32, fontWeight: 800, color: "#0E9F6E" }}>{r.rro}</div>{r.rbro && <div style={{ fontFamily: BN, fontSize: 28, fontWeight: 700, color: C.ink }}>{r.rbro}</div>}
                    <Rise d={x.a + 12}><div style={{ marginTop: 10, fontFamily: BN, fontSize: 32, fontWeight: 600, color: "#4A5280", lineHeight: 1.35 }}><Check size={30} color="#0E9F6E" strokeWidth={3} style={{ verticalAlign: -5 }} /> {r.why}</div></Rise></>
                    : <div style={{ fontFamily: BN, fontSize: 40, color: C.mute, paddingTop: 30 }}>ঠিকটা কী হবে…?</div>}
                </div>
              </div>
              <SFX at={h.b} name="hit" vol={0.3} /><SFX at={x.a} name="chime" vol={0.2} />
            </Rise>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// context switching: the same phrase in other real places — the learner says it first (hold), then hears it
const PLACE: Record<string, React.FC<any>> = { train: TrainFront, food: UtensilsCrossed, home: Home, taxi: Car, car: Car, work: HardHat, store: StoreIcon, phone: Smartphone, clinic: Stethoscope, office: Landmark, bus: Bus, airport: Plane, money: Wallet, kitchen: CookingPot };
const SContext: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const cards = s.cards as { place: string; icon: string; use: string }[];
  return (
    <AbsoluteFill>
      <Kicker text="এক শব্দ, অনেক জায়গা" color={C.mint} icon={Sparkles} />
      <div style={{ position: "absolute", left: 120, right: 120, top: 260, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 36 }}>
        {cards.map((c, i) => {
          const h = byKey(s, `h${i}`)!, j = byKey(s, `j${i}`)!; const I = PLACE[c.icon] || Home;
          const active = f >= h.a - 6 && f < j.b + 10; const shown = f >= j.a; const yours = f >= h.a && f < h.b;
          return (
            <Pop key={i} d={s.beats[0].a + 10 + i * 8} rot={[-2, 1.5, -1][i]}>
              <div style={{ borderRadius: 32, overflow: "hidden", background: "#fff", boxShadow: active ? `0 0 0 8px ${ACC[i]}, 0 30px 60px rgba(0,0,0,.5)` : "0 24px 50px rgba(0,0,0,.4)", transform: active ? "scale(1.04)" : "none" }}>
                <div style={{ height: 230, background: `linear-gradient(135deg, ${ACC[i]}, ${ACC[(i + 2) % 6]})`, display: "grid", placeItems: "center" }}><I size={120} color="#fff" strokeWidth={1.6} /></div>
                <div style={{ padding: "22px 28px 28px", textAlign: "center" }}>
                  <div style={{ fontFamily: BN, fontSize: 40, fontWeight: 800, color: C.ink }}>{c.place}</div>
                  <div style={{ fontFamily: BN, fontSize: 28, color: "#5B6390" }}>{c.use}</div>
                  <div style={{ marginTop: 14, height: 150, display: "grid", placeItems: "center" }}>
                    {shown ? <div><KanaKaraoke b={j} text={j.j!} size={fit(j.j!, 58, 440)} /><Bro b={j} size={26} color={C.red} /></div> : yours ? <span style={{ fontFamily: BN, fontSize: 36, fontWeight: 800, color: C.red }}>🎤 তুমি বলো! {bn(Math.ceil((h.b - f) / 30))}</span> : <span style={{ fontFamily: AR, fontSize: 64, color: "#D5D9EE" }}>؟</span>}
                  </div>
                </div>
              </div>
            </Pop>
          );
        })}
      </div>
      {cards.map((_, i) => <SFX key={i} at={byKey(s, `j${i}`)!.a - 4} name="pop" vol={0.2} />)}
    </AbsoluteFill>
  );
};

// signature secret: a true life hack / Bangla bridge / insider tip — a golden "key" card, Bangla side vs target-language side
const SSecret: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = s.beats[0]; const k = pop(f, fps, 6);
  const pairs = (s.pairs || []) as [string, string][];
  return (
    <AbsoluteFill>
      <Kicker text={s.kind || "সিক্রেট হ্যাক"} color={C.sun} icon={Sparkles} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 210, display: "flex", justifyContent: "center" }}>
        <div style={{ width: 1400, borderRadius: 40, padding: "40px 56px", background: "linear-gradient(135deg, #3A2A05, #6B4A0A)", border: `4px solid ${C.sun}`, boxShadow: `0 0 ${60 + Math.sin(f / 8) * 20}px ${C.sun}66, 0 40px 80px rgba(0,0,0,.5)`, transform: `scale(${0.85 + 0.15 * k})`, opacity: Math.min(1, k * 1.4) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}><span style={{ fontSize: 80 }}>🔑</span><div style={{ fontFamily: BN, fontSize: 58, fontWeight: 800, color: C.sun, lineHeight: 1.2 }}>{s.head}</div></div>
          {pairs.length > 0 && <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 16 }}>
            {pairs.map(([b, j], i) => (
              <Rise key={i} d={t.a + t.frames * (0.2 + i * 0.18)}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", alignItems: "center" }}>
                  <div style={{ padding: "16px 26px", borderRadius: 20, background: "rgba(255,255,255,.1)", fontFamily: BN, fontSize: 40, fontWeight: 700, color: "#fff" }}>🇧🇩 {b}</div>
                  <div style={{ textAlign: "center", fontFamily: EN, fontSize: 50, fontWeight: 900, color: C.sun }}>=</div>
                  <div dir="rtl" style={{ padding: "4px 26px", borderRadius: 20, background: "#fff", fontFamily: AR, fontWeight: 700, fontSize: 42, lineHeight: 1.6, color: C.ink, textAlign: "right" }}>{j}</div>
                </div>
              </Rise>
            ))}
          </div>}
          {s.why && <Rise d={t.a + t.frames * 0.75} style={{ marginTop: 26 }}><div style={{ fontFamily: BN, fontSize: 32, color: "#FFE9B0", lineHeight: 1.4 }}>💡 {s.why}</div></Rise>}
        </div>
      </div>
      <SFX at={6} name="chime" vol={0.3} />
    </AbsoluteFill>
  );
};

// real-life mission with a tangible output (the learner records themselves after the video)
const SMission: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = s.beats[0]; const xp = pop(f, fps, t.a + t.frames * 0.8);
  return (
    <AbsoluteFill>
      <Kicker text="আজকের মিশন" color={C.mint} icon={Target} />
      <Pop d={8} style={{ position: "absolute", left: 260, right: 260, top: 220 }}>
        <div style={{ borderRadius: 40, padding: "44px 56px", background: `linear-gradient(135deg, ${C.violet}, #3B2A9E)`, boxShadow: "0 40px 80px rgba(0,0,0,.5)", border: "3px solid rgba(255,255,255,.25)", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}><div style={{ width: 84, height: 84, borderRadius: 24, background: C.sun, display: "grid", placeItems: "center" }}><Smartphone size={50} color={C.ink} /></div>
            <div style={{ fontFamily: BN, fontSize: 48, fontWeight: 800, color: "#fff" }}>নিজের গলায় রেকর্ড করো</div></div>
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            {(s.steps as string[]).map((st, i) => (
              <Rise key={i} d={t.a + t.frames * (0.1 + i * 0.16)}>
                <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 22px", borderRadius: 18, background: "rgba(255,255,255,.12)" }}>
                  <div style={{ width: 50, height: 50, borderRadius: 25, background: "#fff", display: "grid", placeItems: "center", fontFamily: BN, fontSize: 28, fontWeight: 900, color: C.violet, flex: "none" }}>{bn(i + 1)}</div>
                  <span style={{ fontFamily: BN, fontSize: 36, fontWeight: 700, color: "#fff" }}>{st}</span>
                </div>
              </Rise>
            ))}
          </div>
          <div style={{ position: "absolute", right: -40, top: -50, width: 170, height: 170, borderRadius: 85, background: C.sun, display: "grid", placeItems: "center", transform: `scale(${xp}) rotate(${(1 - xp) * 180 + 10}deg)`, boxShadow: "0 20px 40px rgba(0,0,0,.4)" }}>
            <div style={{ textAlign: "center", fontFamily: EN, fontWeight: 900, color: C.ink }}><Trophy size={40} /><div style={{ fontSize: 40 }}>+{s.xp || 20}</div><div style={{ fontSize: 22 }}>XP</div></div>
          </div>
        </div>
      </Pop>
      <SFX at={t.a + t.frames * 0.8} name="chime" vol={0.25} />
    </AbsoluteFill>
  );
};

const SReward: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = s.beats[0];
  const xp = Math.round(interpolate(f, [t.a + 20, t.a + 80], [0, 30], clamp));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 220 }}><Pop d={4}><Anime look="sensei" size={360} a={teacherAmp(s, f) || lineAmp(s, f)} mood="happy" wave /></Pop></div>
      <div style={{ position: "absolute", left: 540, right: 100, top: s.before ? 110 : 150 }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Pop d={8}><div style={{ width: 150, height: 150, borderRadius: 75, background: C.sun, display: "grid", placeItems: "center", boxShadow: `0 0 60px ${C.sun}` }}><Trophy size={84} color={C.ink} /></div></Pop>
          <div>
            <Rise d={12}><div style={{ fontFamily: BN, fontSize: 70, fontWeight: 800, color: "#fff" }}>পাঠ শেষ! দারুণ!</div></Rise>
            <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
              {[0, 1, 2].map((i) => <Pop key={i} d={20 + i * 6}><Star size={56} color={C.sun} fill={C.sun} /></Pop>)}
              <Pop d={40}><span style={{ marginLeft: 16, padding: "8px 22px", borderRadius: 26, background: "rgba(255,255,255,.1)", fontFamily: EN, fontSize: 44, fontWeight: 900, color: C.sun }}>+{xp} XP</span></Pop>
              <Pop d={46}><span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 22px", borderRadius: 26, background: "rgba(230,57,70,.2)", fontFamily: BN, fontSize: 38, fontWeight: 800, color: "#fff" }}><Flame size={40} color={C.red} fill={C.red} /> ১ দিনের স্ট্রিক</span></Pop>
            </div>
          </div>
        </div>
        {s.before && <Rise d={t.a + 10} style={{ marginTop: 30 }}><div style={{ display: "flex", alignItems: "stretch", gap: 18 }}>
          <div style={{ flex: 1, padding: "16px 22px", borderRadius: 20, background: "rgba(230,57,70,.14)", border: `2px solid ${C.red}88` }}><div style={{ fontFamily: BN, fontSize: 24, color: C.mute }}>ক্লাসের আগে</div><div style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: "#fff" }}>❌ {s.before}</div></div>
          <ArrowRight size={50} color={C.sun} style={{ alignSelf: "center", flex: "none" }} />
          <div style={{ flex: 1, padding: "16px 22px", borderRadius: 20, background: "rgba(61,220,151,.16)", border: `2px solid ${C.mint}` }}><div style={{ fontFamily: BN, fontSize: 24, color: C.mute }}>এখন</div><div style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: "#fff" }}>✅ {s.after}</div></div>
        </div></Rise>}
        <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {(s.words as [string, string][]).map(([jp, m], i) => (
            <Pop key={i} d={t.a + 30 + i * 10} rot={[-2, 2, -1, 1, -2][i]}>
              <div style={{ padding: s.before ? "8px 18px" : "14px 24px", borderRadius: 18, background: "#fff", boxShadow: "0 14px 30px rgba(0,0,0,.35)" }}><Ar t={jp} size={s.before ? 32 : 40} /><span style={{ fontFamily: BN, fontSize: 28, color: "#5B6390", marginLeft: 14 }}>{m}</span></div>
            </Pop>
          ))}
        </div>
        <Rise d={t.a + t.frames * 0.6} style={{ marginTop: s.before ? 22 : 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 22, padding: "22px 34px", borderRadius: 24, background: "rgba(255,255,255,.08)", border: `2px solid ${C.line}` }}>
            <span style={{ fontFamily: BN, fontSize: 30, color: C.mute }}>পরের পাঠ</span><ArrowRight size={34} color={C.sun} />
            <span style={{ fontFamily: BN, fontSize: 40, fontWeight: 800, color: "#fff" }}>{spec.next.bn}</span><Ar t={spec.next.jp} size={36} color={C.sun} />
          </div>
        </Rise>
        {!s.before && <Rise d={t.a + t.frames * 0.8} style={{ marginTop: 36 }}><Img src={staticFile("brand/logo-dark.png")} style={{ height: 76 }} /></Rise>}
      </div>
      <Confetti at={8} x={1200} y={260} n={90} />
    </AbsoluteFill>
  );
};

const MAP: Record<string, React.FC<P>> = { hook: SHook, title: STitle, learn: SLearn, speak: SSpeak, grammar: SGrammar, kana: SKana, recall: SRecall, fix: SFix, context: SContext, secret: SSecret, roleplay: SRole, quiz: SQuiz, mission: SMission, reward: SReward };
const BIG = new Set(["title", "reward"]);

/* ---------- chrome ---------- */
const Header: React.FC<{ spec: Spec; starts: number[] }> = ({ spec, starts }) => {
  const f = useCurrentFrame(); const k = starts.filter((s) => f >= s).length;
  const xp = spec.scenes.reduce((n, s, i) => { const h = s.type === "quiz" ? byKey(s, "count") : null; return n + (h && f >= starts[i] + h.b ? 10 : 0) + (s.type === "mission" && f >= starts[i] + s.beats[0].a + s.beats[0].frames * 0.8 ? (s.xp || 20) : 0); }, 0);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 92, display: "flex", alignItems: "center", gap: 22, padding: "0 50px", background: "linear-gradient(rgba(8,11,36,.7), transparent)" }}>
      <Img src={staticFile("brand/logo-dark.png")} style={{ height: 50 }} />
      <div style={{ width: 2, height: 34, background: C.line }} />
      <div style={{ fontFamily: BN, fontSize: 26, fontWeight: 700, color: "#fff" }}>{spec.course}</div>
      <div style={{ fontFamily: BN, fontSize: 24, color: C.mute }}>· {spec.lessonNo}</div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, width: 400 }}>{starts.map((_, i) => <div key={i} style={{ flex: 1, height: 9, borderRadius: 5, background: i < k - 1 ? `${C.sun}AA` : i === k - 1 ? C.sun : "rgba(255,255,255,.14)" }} />)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 20, background: "rgba(255,200,69,.15)", fontFamily: EN, fontSize: 26, fontWeight: 900, color: C.sun }}><Zap size={24} fill={C.sun} /> {xp} XP</div>
    </div>
  );
};
const Badge: React.FC<{ spec: Spec; starts: number[] }> = ({ spec, starts }) => {
  const f = useCurrentFrame();
  const i = starts.findIndex((st, j) => f >= st && f < st + spec.scenes[j].len); if (i < 0) return null;
  const s = spec.scenes[i]; if (BIG.has(s.type)) return null; const lf = f - starts[i];
  const a = teacherAmp(s, lf); const talking = a > 0.05; const k = interpolate(lf, [0, 12], [0, 1], { ...clamp, easing: ease });
  return (
    <div style={{ position: "absolute", left: 34, bottom: 30, display: "flex", alignItems: "center", gap: 14, opacity: k, transform: `translateY(${(1 - k) * 30}px)` }}>
      <div style={{ borderRadius: "50%", boxShadow: talking ? `0 0 0 6px ${C.sun}66, 0 0 40px ${C.sun}88` : "0 12px 30px rgba(0,0,0,.5)" }}><Anime look="sensei" size={170} a={a} /></div>
      <div style={{ padding: "6px 14px 8px", borderRadius: 14, background: "rgba(8,11,36,.8)", fontFamily: BN, fontSize: 20, color: C.mute, lineHeight: 1.3 }}><b style={{ color: "#fff", fontSize: 24 }}>উস্তাদ</b><br />এআই প্রশিক্ষক · এআই কণ্ঠ</div>
    </div>
  );
};
const Wipe: React.FC<{ color: string }> = ({ color }) => {
  const f = useCurrentFrame(); if (f > 16) return null;
  const x = interpolate(f, [0, 16], [-2400, 2400], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return <AbsoluteFill style={{ pointerEvents: "none" }}><div style={{ position: "absolute", top: -400, left: x, width: 900, height: 1900, background: `linear-gradient(90deg, ${color}, ${C.red})`, transform: "rotate(14deg)", opacity: 0.95 }} /></AbsoluteFill>;
};
const Fade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [6, 16], [0, 1], { ...clamp, easing: ease }), interpolate(f, [len - 8, len], [1, 0], clamp));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};
// Bangla subtitles for the teacher, split at punctuation and timed by length
const subs = (spec: Spec, starts: number[]) => spec.scenes.flatMap((s, i) => s.beats.filter((b) => b.t).flatMap((b) => {
  const parts = b.t!.split(/(?<=[।?!,])\s+/).reduce<string[]>((acc, x) => { if (acc.length && (acc[acc.length - 1].length < 24 || x.length < 10)) acc[acc.length - 1] += " " + x; else acc.push(x); return acc; }, []);
  const tot = parts.reduce((n, x) => n + x.length, 0); let c = 0; const base = starts[i] + b.a;
  return parts.map((x) => { const from = base + (b.frames * c) / tot; c += x.length; return { s: x, from, to: base + (b.frames * c) / tot }; });
}));

export const ArabicVideo: React.FC<{ spec: Spec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const starts = spec.scenes.reduce<number[]>((a, _, i) => [...a, i ? a[i - 1] + spec.scenes[i - 1].len : 10], []);
  const total = arLen(spec); const sb = subs(spec, starts); const cur = sb.find((x) => f >= x.from && f < x.to + 4);
  const speech = (fr: number) => spec.scenes.some((s, i) => s.beats.some((b) => (b.t || b.j) && fr >= starts[i] + b.a - 4 && fr < starts[i] + b.b + 4));
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <Studio />
      {spec.scenes.map((s, i) => {
        const S = MAP[s.type] || STitle;
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={s.len}>
            <Fade len={s.len}><S s={s} spec={spec} /></Fade>
            {s.beats.filter((b) => b.file).map((b, j) => <Sequence key={j} from={b.a}><Audio src={staticFile(`arabic/${spec.id}/${b.file}`)} /></Sequence>)}
            {i > 0 && <><Wipe color={ACC[i % 6]} /><Sequence from={0} durationInFrames={40}><Audio src={staticFile("aiu2/whoosh.mp3")} volume={0.26} /></Sequence></>}
            {i === 0 && <Sequence from={0} durationInFrames={90}><Audio src={staticFile("aiu2/swell.mp3")} volume={0.3} /></Sequence>}
          </Sequence>
        );
      })}
      <Header spec={spec} starts={starts} />
      <Badge spec={spec} starts={starts} />
      {cur && <div style={{ position: "absolute", left: 440, right: 140, bottom: 40, display: "flex", justifyContent: "center", opacity: interpolate(f, [cur.from, cur.from + 5, cur.to, cur.to + 4], [0, 1, 1, 0], clamp) }}><div style={{ maxWidth: 1300, padding: "10px 28px 14px", borderRadius: 16, background: "rgba(8,11,36,.84)", border: `1px solid ${C.line}`, fontFamily: BN, fontSize: 36, fontWeight: 500, color: "#fff", textAlign: "center", lineHeight: 1.35 }}>{cur.s.replace(/[।,]$/, "")}</div></div>}
      <Audio src={staticFile("aiu2/music.mp3")} volume={(fr) => (speech(fr) ? 0.045 : 0.13) * interpolate(fr, [0, 30, total - 60, total], [0, 1, 1, 0], clamp)} />
    </AbsoluteFill>
  );
};
