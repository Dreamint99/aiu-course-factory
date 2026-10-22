// AI University — Korean course lesson video engine ("কোরিয়ান ভাষা · EPS-TOPIK-এর পথে"), copied from japanese/JapaneseEngine.tsx
// and adapted for Hangul: Noto Sans KR, syllable blocks with a jamo "build" panel, Seoul street hook, factory roleplay (EPS workers).
// Owner's brief: not a classroom video but Duolingo + anime + cinematic motion graphics + a game. Learner listens, speaks
// (mic gaps), makes mistakes, retries — and is never bored. Ideas taken from EnglishEngine (karaoke, mic countdown, quiz, confetti).
// One spec per lesson: src/korean/specs/<id>.json, voiced and timed by scripts/korean_make.py (every beat has a/b frames;
// Korean lines carry per-character start frames `cs` from ElevenLabs /with-timestamps, so each Hangul block lights up when it is spoken).
// Owner's default flow for EVERY lesson (korean_make.py checks it): cinematic hook in a real place (5–15 s) → title/goals →
// learn (listen → see each block built from jamo) → speak (slow, normal, mic gap) → grammar blocks → fix → context → roleplay (subtitled, then
// 'your turn') → 3+ challenges (last = boss) → mission → reward (before/after) + next-lesson teaser. Never a talking-head classroom.
// Scene types: hook · title · recall · hangul · learn · speak · grammar · secret · fix · context · roleplay · quiz (last: boss) · mission · reward (CLASS_RULES.md)
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing, delayRender, continueRender, random } from "remotion";
import { Check, Mic, Headphones, Sparkles, Zap, Volume2, Trophy, Flame, Star, Sun, Heart, Hand, ArrowRight, Turtle, Gauge, Blocks, HardHat, Gamepad2, Target, X, Wrench, Brain, MapPin, UtensilsCrossed, TrainFront, Store } from "lucide-react";

/* ---------- design tokens ---------- */
const C = {
  bg0: "#080B24", bg1: "#151A4D", ink: "#10142E", white: "#FFFFFF", mute: "#AEB5E2", line: "rgba(255,255,255,.13)",
  red: "#E63946", sakura: "#FF8FB1", sun: "#FFC845", mint: "#3DDC97", sky: "#4CC9F0", violet: "#8B5CF6", cream: "#FFF7E8",
};
const ACC = [C.sky, C.sun, C.sakura, C.mint, C.violet, C.red];
const BN = "Anek", EN = "Montserrat", JP = "NotoKR", MARU = "NotoKR";
if (typeof document !== "undefined") {
  for (const [n, u] of [["Anek", "fonts/AnekBangla.ttf"], ["Montserrat", "fonts/Montserrat.ttf"], ["NotoKR", "fonts/NotoSansKR.ttf"]]) {
    const h = delayRender(`font ${n}`);
    const f = new FontFace(n, `url(${staticFile(u)})`, { weight: "100 900" });
    f.load().then(() => { document.fonts.add(f); continueRender(h); }).catch(() => continueRender(h));
  }
}
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const HAN = /([\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]+)/;
const mix = (t: string) => t.split(HAN).map((x, i) => (i % 2 ? <span key={i} style={{ fontFamily: "NotoKR", fontWeight: 800 }}>{x}</span> : x));
const ease = Easing.bezier(0.16, 1, 0.3, 1);
const bn = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const ent = (f: number, fps: number, d: number, dur = 22) => spring({ frame: f - d, fps, config: { damping: 200 }, durationInFrames: dur });
const pop = (f: number, fps: number, d: number) => spring({ frame: f - d, fps, config: { damping: 11, mass: 0.6 } });

/* ---------- spec (timed by korean_make.py) ---------- */
export type Beat = { t?: string; j?: string; show?: string; who?: string; ro?: string; bn?: string; slow?: boolean; gap?: boolean; say?: string; hold?: number; key?: string; file?: string; frames: number; a: number; b: number; amp?: string; cs?: number[]; cc?: string };
export type Scene = { type: string; beats: Beat[]; len: number; [k: string]: any };
export type Spec = { id: string; course: string; lessonNo: string; title: string; titleJp: string; next: { bn: string; jp: string }; cast: Record<string, { name: string; bn: string; voice: string }>; scenes: Scene[]; total: number };
export const koLen = (spec: Spec) => spec.total || spec.scenes.reduce((n, s) => n + s.len, 0) + 20;
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
const Confetti: React.FC<{ at: number; x?: number; y?: number; n?: number }> = ({ at, x = 960, y = 500, n = 70 }) => {
  const f = useCurrentFrame(); const t = f - at; if (t < 0 || t > 70) return null;
  return <>{Array.from({ length: n }, (_, i) => {
    const ang = random(`a${i}`) * Math.PI * 2, sp = 10 + random(`s${i}`) * 22;
    return <div key={i} style={{ position: "absolute", left: x + Math.cos(ang) * sp * t, top: y + Math.sin(ang) * sp * t + 0.6 * t * t, width: 14, height: 22, borderRadius: 3, background: ACC[i % 6], transform: `rotate(${t * 12 + i * 30}deg)`, opacity: interpolate(t, [50, 70], [1, 0], clamp) }} />;
  })}</>;
};
// live waveform: bars from the line's loudness envelope, drawn up to the current frame
const Wave: React.FC<{ b?: Beat; w: number; h: number; color?: string; bars?: number }> = ({ b, w, h, color = C.sky, bars = 48 }) => {
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
// Korean text that lights up syllable block by block exactly when spoken
const KanaKaraoke: React.FC<{ b: Beat; text: string; size: number; color?: string; dim?: string; font?: string; glow?: string }> = ({ b, text, size, color = C.ink, dim = "rgba(16,20,46,.28)", font = MARU, glow = C.red }) => {
  const f = useCurrentFrame(); const st = charStarts(b, text);
  return <span style={{ fontFamily: font, fontSize: size, fontWeight: 800, lineHeight: 1.25, whiteSpace: "nowrap" }}>{[...text].map((ch, i) => {
    const t = b.a + st[i]; const on = f >= t; const k = interpolate(f, [t, t + 6], [0, 1], clamp); const now = on && f < t + 8 && f < b.b;
    return ch === " " ? <span key={i} style={{ display: "inline-block", width: size * 0.28 }} /> : <span key={i} style={{ display: "inline-block", color: on ? color : dim, transform: `translateY(${now ? -size * 0.08 : 0}px) scale(${1 + (now ? 0.1 * (1 - k * 0.5) : 0)})`, textShadow: now ? `0 0 ${size * 0.3}px ${glow}` : "none" }}>{ch}</span>;
  })}</span>;
};

/* ---------- anime characters ---------- */
type Look = "sensei" | "yui" | "rafi" | "boss";
const LOOKS: Record<Look, { skin: string; hair: string; iris: string; top: string; top2: string }> = {
  sensei: { skin: "#E0A77E", hair: "#16121F", iris: "#5B3A29", top: "#23306B", top2: "#FFFFFF" },
  yui: { skin: "#F6D2B8", hair: "#6B3A2A", iris: "#8A4B2E", top: "#2D9CDB", top2: "#FFFFFF" },
  rafi: { skin: "#C98B62", hair: "#120E18", iris: "#3B2618", top: "#1F9D6B", top2: "#0E5E40" },
  boss: { skin: "#EFC9A8", hair: "#5F6170", iris: "#3B2E2A", top: "#2B2F3A", top2: "#FFFFFF" },
};
const DEF_LOOK: Record<string, Look> = { F: "yui", M: "rafi", B: "boss" };
const lookOf = (spec: Spec, k: string): Look => ((spec.cast[k] as any)?.look as Look) || DEF_LOOK[k] || "yui";
export const Anime: React.FC<{ look: Look; size: number; a: number; mood?: "calm" | "happy" | "wow"; wave?: boolean; bg?: string }> = ({ look, size, a, mood = "calm", wave, bg }) => {
  const f = useCurrentFrame(); const L = LOOKS[look]; const id = `${look}${size}`;
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
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block" }}>
      <defs><clipPath id={`c${id}`}><circle cx="100" cy="100" r="96" /></clipPath>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={bg || (look === "sensei" ? C.sun : look === "yui" ? C.sakura : C.sky)} /><stop offset="1" stopColor={look === "sensei" ? C.red : look === "yui" ? C.violet : C.mint} /></linearGradient></defs>
      <circle cx="100" cy="100" r="96" fill={`url(#g${id})`} />
      <g clipPath={`url(#c${id})`}>
        {look === "yui" && <path d="M46 100 C40 46 160 46 154 100 L150 150 L50 150 Z" fill={L.hair} />}
        {wave && <g transform={`rotate(${-18 + Math.sin(f / 4) * 14} 150 170)`}><rect x="146" y="96" width="22" height="78" rx="11" fill={L.top} /><circle cx="157" cy="92" r="13" fill={L.skin} /></g>}
        <g transform={`translate(0 ${-bob * 0.4})`}>
          <path d="M28 205 C32 162 62 148 100 148 C138 148 168 162 172 205 Z" fill={L.top} />
          {look === "sensei" && <><path d="M86 148 L100 170 L114 148 Z" fill={L.top2} /><path d="M97 158 L100 192 L103 158 Z" fill={C.red} /></>}
          {look === "yui" && <><rect x="72" y="160" width="56" height="44" rx="6" fill={L.top2} opacity={0.9} /><rect x="80" y="168" width="22" height="8" rx="3" fill={C.red} /><path d="M28 205 C34 176 50 166 70 160 L70 205 Z" fill="#1E6FB0" /><path d="M172 205 C166 176 150 166 130 160 L130 205 Z" fill="#1E6FB0" /></>}
          {look === "rafi" && <><path d="M74 150 Q100 176 126 150" stroke={L.top2} strokeWidth={8} fill="none" /><rect x="58" y="160" width="10" height="45" rx="5" fill="#2B2B3A" /><rect x="132" y="160" width="10" height="45" rx="5" fill="#2B2B3A" /></>}
          <rect x="89" y="128" width="22" height="24" rx="9" fill={L.skin} />
        </g>
        <g transform={`translate(0 ${-bob}) rotate(${Math.sin(f / 23) * 2 + a * 2} 100 100)`}>
          <ellipse cx="59" cy="100" rx="7" ry="11" fill={L.skin} /><ellipse cx="141" cy="100" rx="7" ry="11" fill={L.skin} />
          <path d="M60 84 C58 52 80 40 100 40 C120 40 142 52 140 84 L138 112 C134 136 116 146 100 146 C84 146 66 136 62 112 Z" fill={L.skin} />
          {look === "sensei" && <path d="M56 92 C50 44 82 30 104 32 C130 32 152 48 146 92 C142 72 132 62 118 58 C114 70 96 66 86 58 C74 62 62 72 56 92 Z" fill={L.hair} />}
          {look === "yui" && <><path d="M54 104 C46 44 154 44 146 104 C140 72 126 62 110 60 C104 72 86 72 80 60 C68 64 58 78 54 104 Z" fill={L.hair} /><circle cx="134" cy="66" r="7" fill={C.red} /><circle cx="142" cy="72" r="5" fill={C.sakura} /></>}
          {look === "rafi" && <path d="M58 90 C52 46 82 34 102 34 C126 34 150 48 144 90 C140 70 130 58 120 56 L116 66 L106 56 L96 68 L88 56 C72 60 62 72 58 90 Z" fill={L.hair} />}
          {eye(82)}{eye(118)}
          {look === "sensei" && <><rect x="66" y="84" width="32" height="26" rx="12" fill="none" stroke="#1A1424" strokeWidth={3} /><rect x="102" y="84" width="32" height="26" rx="12" fill="none" stroke="#1A1424" strokeWidth={3} /><path d="M98 95 L102 95" stroke="#1A1424" strokeWidth={3} /></>}
          <ellipse cx="72" cy="118" rx="8" ry="4.5" fill="#FF7E9A" opacity={0.45} /><ellipse cx="128" cy="118" rx="8" ry="4.5" fill="#FF7E9A" opacity={0.45} />
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
    return <div key={i} style={{ position: "absolute", left: ((x % 2100) + 2100) % 2100 - 60, top: y, width: 18, height: 12, borderRadius: "60% 0 60% 0", background: C.sakura, opacity: op * (0.5 + random(`o${i}`) * 0.5), transform: `rotate(${f * 3 * sp + i * 40}deg)` }} />;
  })}</>;
};
const SIGNS = ["서울", "치킨", "노래방", "약국", "편의점", "김밥", "카페"];
const Street: React.FC = () => {
  const f = useCurrentFrame(); const z = interpolate(f, [0, 500], [1.04, 1.16]);
  const train = interpolate(f % 360, [0, 160], [2200, -2600], clamp);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#0B0A2E 0%, #2A1550 55%, #5A1E5C 100%)", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: "50% 60%" }}>
        {Array.from({ length: 16 }, (_, i) => { const w = 110 + random(`bw${i}`) * 120, h = 360 + random(`bh${i}`) * 420, x = i * 128 - 40;
          return <div key={i} style={{ position: "absolute", left: x, bottom: 250, width: w, height: h, background: i % 2 ? "#141236" : "#1B1842", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04)" }}>
            {Array.from({ length: 30 }, (_, k) => <div key={k} style={{ position: "absolute", left: 12 + (k % 4) * (w / 4.4), top: 20 + Math.floor(k / 4) * 46, width: w / 7, height: 18, background: random(`w${i}-${k}`) > 0.55 ? "#FFD98A" : "transparent", opacity: 0.55 }} />)}
          </div>; })}
        <div style={{ position: "absolute", left: 1460, bottom: 640, width: 0, height: 0 }}>
          <div style={{ position: "absolute", left: -180, top: 60, width: 360, height: 120, borderRadius: "50% 50% 0 0", background: "#1F1A48" }} />
          <div style={{ position: "absolute", left: -9, top: -300, width: 18, height: 380, background: "linear-gradient(#E9ECF5, #8C93B8)" }} />
          <div style={{ position: "absolute", left: -44, top: -230, width: 88, height: 46, borderRadius: 14, background: "#C9CFE6", boxShadow: `0 0 30px ${C.sky}` }} />
          <div style={{ position: "absolute", left: -3, top: -380, width: 6, height: 90, background: "#fff" }} />
          <div style={{ position: "absolute", left: -7, top: -392, width: 14, height: 14, borderRadius: 7, background: C.red, opacity: 0.5 + 0.5 * Math.sin(f / 6), boxShadow: `0 0 20px ${C.red}` }} />
        </div>
        {SIGNS.map((s, i) => { const c = [C.sakura, C.sky, C.sun, C.red, C.mint][i % 5]; const fl = 0.85 + Math.sin(f / (5 + i) + i) * 0.15;
          return <div key={i} style={{ position: "absolute", left: 90 + i * 270, top: 170 + (i % 3) * 70, padding: "14px 12px", border: `4px solid ${c}`, borderRadius: 10, writingMode: s.length > 1 ? "vertical-rl" : undefined, textOrientation: "upright", fontFamily: JP, fontWeight: 800, fontSize: 46, color: "#fff", textShadow: `0 0 18px ${c}, 0 0 36px ${c}`, boxShadow: `0 0 30px ${c}88, inset 0 0 20px ${c}55`, opacity: fl, background: "rgba(10,8,30,.55)" }}>{s}</div>; })}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 300, height: 22, background: "#2C2650" }} />
        <div style={{ position: "absolute", left: train, bottom: 322, width: 2200, height: 80, borderRadius: 16, background: "linear-gradient(#E9ECF5, #B7BED6)", display: "flex", gap: 26, padding: "16px 30px", boxSizing: "border-box" }}>
          {Array.from({ length: 22 }, (_, k) => <div key={k} style={{ flex: "none", width: 70, height: 34, borderRadius: 6, background: "#FFE7A8", boxShadow: "0 0 18px #FFE7A8" }} />)}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, height: 6, background: C.mint }} />
        </div>
        <div style={{ position: "absolute", left: -200, right: -200, bottom: 0, height: 300, background: "linear-gradient(#24203F, #0E0C22)" }}>
          {Array.from({ length: 12 }, (_, k) => <div key={k} style={{ position: "absolute", left: 120 + k * 190, top: 120, width: 110, height: 150, background: "rgba(255,255,255,.75)", transform: "perspective(400px) rotateX(60deg)" }} />)}
        </div>
      </AbsoluteFill>
      <Petals n={30} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,.6) 100%)" }} />
    </AbsoluteFill>
  );
};
// EPS workers mostly start in factories: steel hall, conveyor with moving boxes, hazard stripes, "안전제일" (safety first) banner
const Factory: React.FC = () => {
  const f = useCurrentFrame();
  const box = (k: number) => ((f * 3 + k * 260) % 2080) - 180;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#3A4566, #59648A 55%, #6E7896)", overflow: "hidden" }}>
      {Array.from({ length: 7 }, (_, i) => <div key={i} style={{ position: "absolute", left: i * 320 - 40, top: 0, width: 36, height: 760, background: "linear-gradient(90deg, #2A3250, #46507A)" }} />)}
      {Array.from({ length: 3 }, (_, i) => <div key={i} style={{ position: "absolute", left: 0, right: 0, top: 40 + i * 70, height: 16, background: "#2A3250" }} />)}
      {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ position: "absolute", left: 140 + i * 380, top: 230, width: 140, height: 18, borderRadius: 9, background: "#FFF6D8", boxShadow: "0 30px 120px 40px rgba(255,240,190,.35)" }} />)}
      <div style={{ position: "absolute", left: 800, top: 100, padding: "6px 36px", borderRadius: 10, background: "#fff", border: `6px solid ${C.mint}`, fontFamily: JP, fontWeight: 900, fontSize: 50, color: "#0E7A4E", boxShadow: "0 16px 40px rgba(0,0,0,.3)" }}>안전제일</div>
      <div style={{ position: "absolute", left: 60, top: 330, width: 230, height: 300, background: "#2B6CB0", borderRadius: 8, boxShadow: "inset 0 0 0 10px #22558C" }}>{[0, 1, 2].map((k) => <div key={k} style={{ margin: "26px 30px 0", height: 60, borderRadius: 6, background: "#C9A26B" }} />)}</div>
      <div style={{ position: "absolute", right: 70, top: 380, width: 280, height: 250, background: "repeating-linear-gradient(-45deg, #FFC845 0 30px, #1A1A1A 30px 60px)", borderRadius: 10, opacity: 0.9 }} />
      <div style={{ position: "absolute", left: -20, right: -20, top: 640, height: 60, background: "#2B2F45", borderTop: "8px solid #8C93B8" }}>
        {Array.from({ length: 30 }, (_, k) => <div key={k} style={{ position: "absolute", left: ((k * 70 - f * 3) % 2100 + 2100) % 2100, top: 18, width: 26, height: 26, borderRadius: 13, background: "#555B78" }} />)}
      </div>
      {Array.from({ length: 8 }, (_, k) => <div key={k} style={{ position: "absolute", left: box(k), top: 560, width: 110, height: 86, borderRadius: 6, background: "#C9A26B", boxShadow: "inset 0 -12px 0 rgba(0,0,0,.15)" }}><div style={{ margin: "0 auto", width: 22, height: 86, background: "#E8D2A6" }} /></div>)}
      <div style={{ position: "absolute", left: -20, right: -20, bottom: 0, height: 380, background: "linear-gradient(#7A8094, #5C6176)" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 40, height: 22, background: "repeating-linear-gradient(-45deg, #FFC845 0 26px, #1A1A1A 26px 52px)" }} />
      </div>
    </AbsoluteFill>
  );
};
const Mart: React.FC = () => {
  const prods = ["#FF5E5B", "#FFC845", "#4CC9F0", "#3DDC97", "#FF8FB1", "#8B5CF6"];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#FFF7E8, #F3E6CF)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120, background: "linear-gradient(90deg, #3DDC97 0 33%, #FFFFFF 33% 36%, #2D9CDB 36% 100%)" }} />
      <div style={{ position: "absolute", left: 760, top: 26, padding: "8px 30px", borderRadius: 14, background: "#fff", fontFamily: JP, fontWeight: 900, fontSize: 52, color: "#2D9CDB", boxShadow: "0 8px 20px rgba(0,0,0,.15)" }}>편의점</div>
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
const WORLDS: Record<string, React.FC> = { street: () => <Street />, store: () => <Mart />, work: () => <Factory /> };

const Studio: React.FC = () => {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, r: number, c: string, ph: number) => <div style={{ position: "absolute", left: x + Math.sin(f / 90 + ph) * 80, top: y + Math.cos(f / 110 + ph) * 60, width: r, height: r, borderRadius: "50%", background: c, filter: "blur(120px)", opacity: 0.35 }} />;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(1400px 900px at 50% 40%, ${C.bg1}, ${C.bg0})`, overflow: "hidden" }}>
      {blob(-200, -200, 700, C.violet, 0)}{blob(1400, -120, 600, C.sakura, 2)}{blob(1300, 700, 700, C.red, 4)}{blob(-100, 760, 600, C.sky, 1)}
      <div style={{ position: "absolute", right: -120, top: 120, width: 520, height: 520, borderRadius: "50%", background: `linear-gradient(${f / 6}deg, ${C.red} 50%, #2D5BD6 50%)`, opacity: 0.12 }} />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(circle at 50% 100%, transparent 36%, rgba(255,255,255,.05) 37%, transparent 40%, transparent 54%, rgba(255,255,255,.05) 55%, transparent 58%)", backgroundSize: "120px 60px" }} />
      <Petals n={14} op={0.45} />
    </AbsoluteFill>
  );
};

/* ---------- scenes ---------- */
const SHook: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const j = s.beats.find((b) => b.j)!; const t = s.beats.find((b) => b.t)!;
  const q = ((s.question as string) || "Can you understand Korean?").split(" "); const W = WORLDS[s.world || "street"] || Street;
  const who = j.who || "F";
  return (
    <AbsoluteFill>
      <W />
      <div style={{ position: "absolute", right: 170, bottom: 120, transform: `translateY(${(1 - ent(f, fps, j.a - 26)) * 300}px)` }}>
        <Anime look={lookOf(spec, who)} size={360} a={lineAmp(s, f, who)} mood={f > j.b ? "happy" : "calm"} wave={f >= j.a && f < j.b + 30} />
      </div>
      {f >= j.a - 4 && <div style={{ position: "absolute", right: 480, bottom: 380 }}>
        <Pop d={j.a - 4}><div style={{ padding: "26px 44px", borderRadius: 40, borderBottomRightRadius: 6, background: "#fff", boxShadow: "0 30px 60px rgba(0,0,0,.5)" }}><KanaKaraoke b={j} text={j.show || j.j!} size={[...(j.show || j.j!)].length > 9 ? 74 : 104} /><div style={{ fontFamily: EN, fontSize: 34, fontWeight: 700, color: "#5B6390", marginTop: 4 }}>{j.ro}</div></div></Pop>
      </div>}
      <div style={{ position: "absolute", left: 70, top: 150, width: 800, padding: "36px 40px 44px", borderRadius: 36, background: "rgba(8,6,28,.72)", boxShadow: "0 30px 80px rgba(0,0,0,.5)", opacity: interpolate(f, [j.b, j.b + 10], [0, 1], clamp) }}>
        <div style={{ fontFamily: EN, fontSize: 88, fontWeight: 900, color: "#fff", lineHeight: 1.08, textShadow: "0 10px 40px rgba(0,0,0,.6)" }}>
          {q.map((w, i) => { const d = j.b + 8 + i * 5; const k = pop(f, fps, d); return <span key={i} style={{ display: "inline-block", marginRight: 26, opacity: Math.min(1, k * 1.4), transform: `translateY(${(1 - k) * 60}px) rotate(${(1 - k) * -8}deg)`, color: i === q.length - 1 ? C.sun : "#fff" }}>{w}</span>; })}
        </div>
        <Rise d={t.a + 10} style={{ marginTop: 22 }}><span style={{ padding: "10px 26px", borderRadius: 30, background: C.red, fontFamily: BN, fontSize: 44, fontWeight: 800, color: "#fff" }}>{s.questionBn || "তুমি কি কোরিয়ান বোঝো?"}</span></Rise>
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
        <Rise d={14} style={{ marginTop: -24, display: "flex", justifyContent: "center" }}><span style={{ padding: "10px 26px", borderRadius: 30, background: "#fff", fontFamily: BN, fontSize: 30, fontWeight: 800, color: C.ink }}>সনসেংনিম · <span style={{ color: C.red }}>এআই প্রশিক্ষক</span></span></Rise></div>
      <div style={{ position: "absolute", left: 640, right: 100, top: 190 }}>
        <Rise d={4}><span style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: C.sky }}>{spec.course} · {spec.lessonNo}</span></Rise>
        <Rise d={8} style={{ marginTop: 10 }}><div style={{ fontFamily: BN, fontSize: 100, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>{spec.title}</div></Rise>
        <Rise d={14}><div style={{ fontFamily: MARU, fontSize: 52, color: C.sakura }}>{spec.titleJp}</div></Rise>
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
        {(spec as any).objective && <Rise d={t.a + t.frames * 0.85} style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 16 }}><Target size={40} color={C.mint} style={{ flex: "none" }} /><span style={{ fontFamily: BN, fontSize: 32, fontWeight: 600, color: "#fff", lineHeight: 1.35 }}>{(spec as any).objective}</span></Rise>}
      </div>
    </AbsoluteFill>
  );
};

const WHEN: Record<string, React.FC<any>> = { sun: Sun, heart: Heart, hand: Hand };
// how a Hangul block is built: jamo pieces pop in one by one (+), then merge into the block
const Build: React.FC<{ s: Scene; at: number; block: string; step: number }> = ({ s, at, block, step }) => {
  const f = useCurrentFrame(); const parts = s.build.parts as [string, string][]; const done = at + step * parts.length;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 500, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
      <span style={{ fontFamily: BN, fontSize: 30, fontWeight: 700, color: C.mint, marginRight: 10 }}>ব্লক বানাই:</span>
      {parts.map(([j, b], i) => (
        <React.Fragment key={i}>
          {i > 0 && <Pop d={at + step * i - 2}><span style={{ fontFamily: EN, fontSize: 52, fontWeight: 900, color: C.sun }}>+</span></Pop>}
          <Pop d={at + step * i} rot={i % 2 ? 4 : -4}><div style={{ width: 110, textAlign: "center" }}>
            <div style={{ height: 100, borderRadius: 20, background: ACC[i], display: "grid", placeItems: "center", fontFamily: JP, fontSize: 70, fontWeight: 800, color: C.ink, boxShadow: "0 12px 30px rgba(0,0,0,.35)" }}>{j}</div>
            <div style={{ marginTop: 6, fontFamily: BN, fontSize: 26, fontWeight: 700, color: "#fff" }}>{b}</div>
          </div></Pop>
        </React.Fragment>
      ))}
      <Pop d={done}><span style={{ fontFamily: EN, fontSize: 52, fontWeight: 900, color: C.sun, margin: "0 6px" }}>=</span></Pop>
      <Pop d={done + 4}><div style={{ width: 120, height: 120, borderRadius: 24, background: "#fff", display: "grid", placeItems: "center", fontFamily: JP, fontSize: 84, fontWeight: 800, color: C.ink, boxShadow: `0 0 0 6px ${C.mint}, 0 0 50px ${C.mint}` }}>{block}</div></Pop>
      <SFX at={done + 4} name="chime" vol={0.18} />
    </div>
  );
};
const SLearn: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const main = byKey(s, "main")!; const ex = s.beats[s.beats.length - 1];
  const kana = s.kana as [string, string][]; const text = kana.map((k) => k[0]).join(""); const st = charStarts(main, text);
  const n = kana.length; const tw = Math.min(170, 1500 / n - 16);
  const I = WHEN[s.icon] || Sun; const exP = (x: number) => ex.a + ex.frames * x;
  return (
    <AbsoluteFill>
      <Kicker text={`জাদুর শব্দ ${bn(s.n)} / ${bn(spec.scenes.filter((x) => x.type === "learn").length)}`} color={ACC[s.n - 1]} icon={Sparkles} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 220, display: "flex", justifyContent: "center", gap: 16 }}>
        {kana.map(([k, r], i) => {
          const at = main.a + st[i]; const lit = f >= at; const now = lit && f < at + 10; const mark = s.mark?.i === i && f >= exP(s.mark.at ?? 0.45); const built = s.build?.i === i && f >= exP(s.build.at ?? 0.3) && f < exP((s.build.at ?? 0.3) + 0.3); const long = (s.long || []).includes(i) && f >= exP(0.35);
          return (
            <Pop key={i} d={s.beats[0].a + 4 + i * 3} rot={0}>
              <div style={{ width: tw, textAlign: "center" }}>
                <div style={{ height: tw * 1.15, borderRadius: 24, background: lit ? "#fff" : "rgba(255,255,255,.12)", display: "grid", placeItems: "center", boxShadow: now ? `0 0 0 8px ${C.sun}, 0 0 60px ${C.sun}` : built ? `0 0 0 8px ${C.mint}, 0 0 50px ${C.mint}` : mark ? `0 0 0 8px ${C.red}` : "0 18px 40px rgba(0,0,0,.4)", transform: `translateY(${now ? -16 : 0}px)`, transition: "none" }}>
                  <span style={{ fontFamily: MARU, fontSize: tw * 0.7, color: lit ? (mark ? C.red : C.ink) : "rgba(255,255,255,.5)" }}>{k}</span>
                </div>
                <div style={{ marginTop: 12, fontFamily: EN, fontSize: Math.min(40, tw * 0.3), fontWeight: 800, color: mark ? C.red : long ? C.sun : lit ? C.sun : C.mute }}>{r}</div>
                {long && <div style={{ height: 8, borderRadius: 4, background: C.sun, marginTop: 4 }} />}
              </div>
            </Pop>
          );
        })}
      </div>
      {(!s.build || f < exP(s.build.at ?? 0.3) - 6) ? <div style={{ position: "absolute", left: 460, right: 460, top: 530, display: "flex", alignItems: "center", gap: 20 }}>
        <Volume2 size={40} color={f >= main.a && f < main.b ? C.sun : C.mute} /><Wave b={main} w={900} h={70} color={C.sun} />
      </div> : <Build s={s} at={exP(s.build.at ?? 0.3)} block={kana[s.build.i][0]} step={ex.frames * 0.06} />}
      <div style={{ position: "absolute", left: 0, right: 0, top: 680, display: "flex", justifyContent: "center", gap: 30 }}>
        <Pop d={exP(0.04)}><div style={{ padding: "20px 40px", borderRadius: 26, background: C.red, fontFamily: BN, fontSize: 52, fontWeight: 800, color: "#fff", boxShadow: `0 20px 50px ${C.red}66` }}>{s.mean}</div></Pop>
        <Pop d={exP(0.25)}><div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 30px", borderRadius: 26, background: "rgba(255,255,255,.1)", border: `2px solid ${C.line}`, fontFamily: BN, fontSize: 36, fontWeight: 600, color: "#fff" }}><I size={40} color={C.sun} /> {s.when}</div></Pop>
      </div>
      {s.mark && <Rise d={exP(s.mark.at ?? 0.45)} style={{ position: "absolute", left: 0, right: 0, top: 820, display: "flex", justifyContent: "center" }}><div style={{ padding: "14px 30px", borderRadius: 20, background: "rgba(230,57,70,.18)", border: `2px solid ${C.red}`, fontFamily: BN, fontSize: 34, fontWeight: 700, color: "#fff" }}>⚠️ {mix(s.mark.text)}</div></Rise>}
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
            <KanaKaraoke b={line} text={line.j!} size={120} />
            <div style={{ fontFamily: EN, fontSize: 44, fontWeight: 800, color: C.red, marginTop: 6 }}>{line.ro}</div>
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
          <div style={{ display: "flex", gap: 14 }}>{Array.from({ length: Math.ceil(js.length / 2) }, (_, j) => j).map((j) => <div key={j} style={{ width: j === phrase ? 54 : 18, height: 18, borderRadius: 9, background: j < phrase ? C.mint : j === phrase ? C.sun : C.line }} />)}</div>
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
          const text = row.blocks.map((b) => b[0]).join(""); const st = charStarts(say, text); let ci = 0; const big = [...text].length <= 8;
          return (
            <div key={r} style={{ height: 260 }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 26 }}>
                {row.blocks.map(([jp, ro, mean, col], i) => {
                  const at = say.a + st[ci]; ci += [...jp].length; const lab = ex.a + ex.frames * ((i + 0.6) / (row.blocks.length + 1.2));
                  const hot = f >= lab && f < lab + ex.frames / (row.blocks.length + 1);
                  return (
                    <Pop key={i} d={at - 4} rot={[-3, 2, -2][i % 3]}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ padding: big ? "20px 44px" : "18px 28px", borderRadius: 26, background: col, boxShadow: hot ? `0 0 0 8px #fff, 0 0 60px ${col}` : `0 16px 0 rgba(0,0,0,.25), 0 26px 50px rgba(0,0,0,.4)`, transform: `translateY(${hot ? -10 : 0}px)` }}>
                          <div style={{ fontFamily: MARU, fontSize: big ? 96 : 76, fontWeight: 800, color: C.ink, lineHeight: 1.15, whiteSpace: "nowrap" }}>{jp}</div>
                          <div style={{ fontFamily: EN, fontSize: 34, fontWeight: 800, color: "rgba(16,20,46,.7)" }}>{ro}</div>
                        </div>
                        <div style={{ marginTop: 16, fontFamily: BN, fontSize: 34, fontWeight: 700, color: "#fff", opacity: interpolate(f, [lab, lab + 10], [0, 1], clamp), transform: `translateY(${interpolate(f, [lab, lab + 10], [16, 0], clamp)}px)` }}>{mean}</div>
                      </div>
                    </Pop>
                  );
                })}
                <Pop d={ex.a + ex.frames * 0.82}><div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 16 }}><ArrowRight size={56} color={C.sun} /><span style={{ padding: "18px 30px", borderRadius: 22, background: "#fff", fontFamily: BN, fontSize: big ? 46 : 40, fontWeight: 800, color: C.ink }}>{row.bn}</span></div></Pop>
              </div>
            </div>
          );
        })}
      </div>
      {(() => { const e0 = byKey(s, "e0")!; const at = e0.a + e0.frames * 0.74; return f >= at && f < e0.b + 20 ? <Rise d={at} style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center" }}><div style={{ padding: "12px 30px", borderRadius: 20, background: "rgba(255,200,69,.16)", border: `2px solid ${C.sun}`, fontFamily: BN, fontSize: 34, fontWeight: 700, color: "#fff" }}>💡 আসল কাজের শব্দ শেষে — বাংলার মতো!</div></Rise> : null; })()}
    </AbsoluteFill>
  );
};

const SRole: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const pass2 = s.pass === 2;
  const intro = s.beats[0]; const scene = f >= intro.b - 10;
  const cur = s.beats.filter((b) => (b.j || b.gap) && f >= b.a - 6).pop();
  const k = ent(f, fps, intro.b - 10, 30);
  const world = s.world || "work"; const W = WORLDS[world] || Factory; const fac = world === "work";
  const partner = s.beats.find((b) => b.j && b.who !== "M")?.who || "F";
  const helmet = fac ? s.beats.find((b) => b.j?.includes("안전모")) : undefined; const boxLine = fac ? s.beats.find((b) => b.j?.startsWith("박스")) : undefined;
  const bubble = (b: Beat) => {
    const L = b.who === "M"; const hide = pass2 && !L;
    return (
      <div key={b.a} style={{ position: "absolute", top: 210, [L ? "left" : "right"]: 380, maxWidth: 1080 } as any}>
        <Pop d={b.a - 6}><div style={{ padding: "24px 36px", borderRadius: 34, [L ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: 6, background: "#fff", boxShadow: "0 24px 50px rgba(0,0,0,.35)", borderTop: `8px solid ${L ? C.sky : C.sakura}` } as any}>
          {hide ? <div style={{ display: "flex", alignItems: "center", gap: 20 }}><Volume2 size={54} color={C.sakura} /><Wave b={b} w={360} h={60} color={C.sakura} bars={26} /><span style={{ fontFamily: BN, fontSize: 30, color: "#5B6390" }}>শুধু শোনো</span></div>
            : <><KanaKaraoke b={b} text={b.show || b.j!} size={[...(b.show || b.j!)].length > 14 ? 58 : 74} /><div style={{ fontFamily: EN, fontSize: 32, fontWeight: 700, color: L ? "#1E7FA8" : C.red }}>{b.ro}</div>{b.bn && <div style={{ fontFamily: BN, fontSize: 32, fontWeight: 600, color: "#4A5280" }}>{b.bn}</div>}</>}
        </div></Pop>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: k, transform: `scale(${1.1 - 0.1 * k})` }}><W /></AbsoluteFill>
      {!scene && <AbsoluteFill style={{ background: "rgba(8,11,36,.55)" }} />}
      <Kicker text={pass2 ? "তোমার পালা — তুমি রাফি!" : `রোলপ্লে · ${s.place || (fac ? "কারখানায় প্রথম দিন" : world === "store" ? "কনভিনিয়েন্স স্টোর" : "রাস্তায়")}`} color={pass2 ? C.red : C.mint} icon={HardHat} />
      {scene && <>
        <div style={{ position: "absolute", left: 90, bottom: 210, textAlign: "center", transform: `translateY(${(1 - k) * 200}px)` }}>
          <div style={{ position: "relative" }}>
            <Anime look="rafi" size={300} a={lineAmp(s, f, "M")} mood={cur?.gap ? "wow" : "calm"} />
            {helmet && f >= helmet.b + 4 && <div style={{ position: "absolute", left: 66, top: interpolate(f, [helmet.b + 4, helmet.b + 16], [-160, 2], { ...clamp, easing: ease }), width: 168, height: 84, borderRadius: "84px 84px 12px 12px", background: `linear-gradient(${C.sun}, #E0A800)`, boxShadow: "0 8px 0 #B88A00, 0 16px 30px rgba(0,0,0,.35)" }}><div style={{ position: "absolute", left: 76, top: 6, width: 16, height: 70, borderRadius: 8, background: "rgba(255,255,255,.45)" }} /></div>}
          </div>
          <div style={{ marginTop: 8, padding: "6px 20px", borderRadius: 20, background: C.ink, display: "inline-block", fontFamily: BN, fontSize: 30, fontWeight: 800, color: "#fff" }}>{pass2 ? "তুমি (রাফি)" : spec.cast.M.bn}</div>
        </div>
        <div style={{ position: "absolute", right: 90, bottom: 210, textAlign: "center", transform: `translateY(${(1 - k) * 200}px)` }}>
          <Anime look={lookOf(spec, partner)} size={300} a={lineAmp(s, f, partner)} mood={f > (s.beats[s.beats.length - 1].b - 40) ? "happy" : "calm"} />
          <div style={{ marginTop: 8, padding: "6px 20px", borderRadius: 20, background: C.ink, display: "inline-block", fontFamily: BN, fontSize: 30, fontWeight: 800, color: "#fff" }}>{spec.cast[partner]?.bn}{(spec.cast[partner] as any)?.role ? ` · ${(spec.cast[partner] as any).role}` : ""}</div>
        </div>
        {boxLine && f >= boxLine.a && f < boxLine.b + 50 && <Pop d={boxLine.a + 4} style={{ position: "absolute", left: 780, bottom: 300 }} rot={-4}><div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 120, height: 92, borderRadius: 8, background: "#C9A26B", boxShadow: "inset 0 -12px 0 rgba(0,0,0,.15), 0 14px 30px rgba(0,0,0,.3)" }}><div style={{ margin: "0 auto", width: 24, height: 92, background: "#E8D2A6" }} /></div>
          <ArrowRight size={70} color={C.sun} strokeWidth={3} style={{ transform: `translateX(${Math.sin(f / 5) * 10}px)` }} />
          <div style={{ padding: "10px 20px", borderRadius: 14, background: C.sun, fontFamily: JP, fontSize: 40, fontWeight: 900, color: C.ink }}>저기</div>
        </div></Pop>}
        {cur && cur.j && f < cur.b + 30 && bubble(cur)}
        {cur && cur.gap && f < cur.b && (
          <div style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", justifyContent: "center" }}>
            <Pop d={cur.a}><div style={{ display: "flex", alignItems: "center", gap: 30, padding: "26px 40px", borderRadius: 34, background: C.ink, border: `4px solid ${C.red}`, boxShadow: `0 0 60px ${C.red}88` }}>
              <div style={{ position: "relative", width: 130, height: 130 }}>
                <svg width={130} height={130} style={{ position: "absolute", transform: "rotate(-90deg)" }}><circle cx={65} cy={65} r={58} stroke="rgba(255,255,255,.15)" strokeWidth={9} fill="none" /><circle cx={65} cy={65} r={58} stroke={C.red} strokeWidth={9} fill="none" strokeDasharray={364} strokeDashoffset={364 * (1 - interpolate(f, [cur.a, cur.b], [1, 0], clamp))} strokeLinecap="round" /></svg>
                <div style={{ position: "absolute", inset: 18, borderRadius: "50%", background: C.red, display: "grid", placeItems: "center" }}><Mic size={50} color="#fff" /></div>
              </div>
              <div><div style={{ fontFamily: BN, fontSize: 30, color: C.mute }}>🎤 তোমার পালা — কোরিয়ানে বলো:</div><div style={{ fontFamily: BN, fontSize: 52, fontWeight: 800, color: "#fff" }}>{mix(cur.say || "")}</div></div>
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
      <Kicker text={s.boss ? "বস চ্যালেঞ্জ!" : `চ্যালেঞ্জ ${bn(s.n)}`} color={s.boss ? C.red : C.sun} icon={s.boss ? Flame : Gamepad2} />
      <Rise d={6} style={{ position: "absolute", left: 160, right: 160, top: 215, textAlign: "center" }}><div style={{ fontFamily: BN, fontSize: 62, fontWeight: 800, color: "#fff" }}>{s.q}</div></Rise>
      {listen && <div style={{ position: "absolute", left: 0, right: 0, top: 320, display: "flex", justifyContent: "center", alignItems: "center", gap: 26 }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, background: C.sky, display: "grid", placeItems: "center", transform: `scale(${f >= listen.a && f < listen.b ? 1.12 + Math.sin(f / 3) * 0.05 : 1})`, boxShadow: f >= listen.a && f < listen.b ? `0 0 60px ${C.sky}` : "none" }}><Volume2 size={64} color={C.ink} /></div>
        <Wave b={listen} w={520} h={80} color={C.sky} bars={30} />
        {reveal && <span style={{ fontFamily: MARU, fontSize: 64, color: "#fff" }}>{listen.j}</span>}
      </div>}
      <div style={{ position: "absolute", left: 320, right: 320, top: listen ? 480 : 380, display: "flex", flexDirection: "column", gap: 22 }}>
        {opts.map(([main, sub], i) => {
          const right = reveal && i === s.a; const k = pop(f, fps, hold.b + 2); const jp = /[\u3131-\u318E\uAC00-\uD7A3]/.test(main);
          return (
            <Rise key={i} d={s.beats[0].a + 10 + i * 6} y={30}>
              <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "18px 30px", borderRadius: 26, background: right ? C.mint : "#fff", opacity: reveal && !right ? 0.35 : 1, transform: right ? `scale(${1 + 0.05 * k})` : "none", boxShadow: right ? `0 0 60px ${C.mint}` : "0 16px 36px rgba(0,0,0,.35)" }}>
                <div style={{ width: 66, height: 66, borderRadius: 33, background: right ? "#fff" : [C.sky, C.sun, C.sakura][i], display: "grid", placeItems: "center", fontFamily: EN, fontWeight: 900, fontSize: 34, color: C.ink, flex: "none" }}>{right ? <Check size={38} color="#0E9F6E" strokeWidth={4} /> : "ABC"[i]}</div>
                <div style={{ display: "flex", flexDirection: [...main].length > 8 ? "column" : "row", alignItems: [...main].length > 8 ? "flex-start" : "baseline", columnGap: 24 }}>
                  <span style={{ fontFamily: jp ? MARU : BN, fontSize: jp ? ([...main].length > 8 ? 46 : 54) : 48, fontWeight: 800, color: C.ink, whiteSpace: "nowrap" }}>{main}</span>
                  {sub && <span style={{ fontFamily: EN, fontSize: [...main].length > 8 ? 26 : 30, fontWeight: 700, color: "#5B6390" }}>{sub}</span>}
                </div>
              </div>
            </Rise>
          );
        })}
      </div>
      {!reveal && f >= hold.a && <div style={{ position: "absolute", left: 460, right: 460, top: 900, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ flex: 1, height: 22, borderRadius: 11, background: "rgba(255,255,255,.15)", overflow: "hidden" }}><div style={{ width: `${bar * 100}%`, height: "100%", background: `linear-gradient(90deg, ${C.red}, ${C.sun})` }} /></div>
        <div style={{ fontFamily: BN, fontSize: 60, fontWeight: 900, color: C.sun, width: 70, textAlign: "center" }}>{bn(left)}</div>
      </div>}
      {reveal && <div style={{ position: "absolute", right: 260, top: 300, opacity: interpolate(f, [hold.b, hold.b + 8, hold.b + 50, hold.b + 70], [0, 1, 1, 0], clamp), transform: `translateY(${-interpolate(f, [hold.b, hold.b + 70], [0, 120], clamp)}px)`, fontFamily: EN, fontSize: 80, fontWeight: 900, color: C.sun, textShadow: `0 0 30px ${C.sun}` }}>+{s.boss ? 20 : 10} XP</div>}
      <Confetti at={hold.b} y={560} />
      <SFX at={hold.b} name="chime" vol={0.35} />
    </AbsoluteFill>
  );
};

const SReward: React.FC<P> = ({ s, spec }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = s.beats[0];
  const XP = spec.scenes.reduce((n, x) => n + (x.type === "quiz" ? (x.boss ? 20 : 10) : 0), 0); const xp = Math.round(interpolate(f, [t.a + 20, t.a + 80], [0, XP], clamp));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 100, top: 220 }}><Pop d={4}><Anime look="sensei" size={360} a={teacherAmp(s, f) || lineAmp(s, f)} mood="happy" wave /></Pop></div>
      <div style={{ position: "absolute", left: 540, right: 100, top: 124 }}>
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
        {s.before && <div style={{ marginTop: 22, display: "flex", alignItems: "stretch", gap: 18 }}>
          <Rise d={t.a + 16} y={20}><div style={{ height: "100%", boxSizing: "border-box", padding: "14px 24px", borderRadius: 20, background: "rgba(255,255,255,.07)", border: `2px solid ${C.line}` }}><div style={{ fontFamily: BN, fontSize: 24, color: C.mute }}>আগে</div><div style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: C.mute, textDecoration: "line-through", textDecorationColor: C.red }}>{s.before}</div></div></Rise>
          <Pop d={t.a + 26}><ArrowRight size={50} color={C.sun} style={{ marginTop: 26 }} /></Pop>
          <Rise d={t.a + 30} y={20}><div style={{ height: "100%", boxSizing: "border-box", padding: "14px 24px", borderRadius: 20, background: "rgba(61,220,151,.14)", border: `2px solid ${C.mint}` }}><div style={{ fontFamily: BN, fontSize: 24, color: C.mint }}>এখন</div><div style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: "#fff" }}>{s.after}</div></div></Rise>
        </div>}
        <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 14 }}>
          {(s.words as [string, string][]).map(([jp, m], i) => (
            <Pop key={i} d={t.a + 30 + i * 10} rot={[-2, 2, -1, 1, -2][i]}>
              <div style={{ padding: "14px 24px", borderRadius: 20, background: "#fff", boxShadow: "0 14px 30px rgba(0,0,0,.35)" }}><span style={{ fontFamily: MARU, fontSize: 40, fontWeight: 800, color: C.ink }}>{jp}</span><span style={{ fontFamily: BN, fontSize: 28, color: "#5B6390", marginLeft: 14 }}>{m}</span></div>
            </Pop>
          ))}
        </div>
        <Rise d={t.a + t.frames * 0.6} style={{ marginTop: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 22, padding: "22px 34px", borderRadius: 24, background: "rgba(255,255,255,.08)", border: `2px solid ${C.line}` }}>
            <span style={{ fontFamily: BN, fontSize: 30, color: C.mute }}>পরের পাঠ</span><ArrowRight size={34} color={C.sun} />
            <span style={{ fontFamily: BN, fontSize: 40, fontWeight: 800, color: "#fff" }}>{spec.next.bn}</span><span style={{ fontFamily: MARU, fontSize: 38, color: C.sakura }}>{spec.next.jp}</span>
          </div>
        </Rise>
        {s.mission && <Rise d={t.a + t.frames * 0.7} style={{ marginTop: 22 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 16, padding: "16px 28px", borderRadius: 22, background: "rgba(61,220,151,.14)", border: `2px solid ${C.mint}` }}><Target size={40} color={C.mint} /><span style={{ fontFamily: BN, fontSize: 32, fontWeight: 700, color: "#fff" }}>{(s.mission as string).split(/([\uAC00-\uD7A3]+)/).map((x, i) => <span key={i} style={/[\uAC00-\uD7A3]/.test(x) ? { fontFamily: JP, fontWeight: 800, color: C.sun } : {}}>{x}</span>)}</span></div></Rise>}
        {!s.before && <Rise d={t.a + t.frames * 0.8} style={{ marginTop: 30 }}><Img src={staticFile("brand/logo-dark.png")} style={{ height: 76 }} /></Rise>}
      </div>
      <Confetti at={8} x={1200} y={260} n={90} />
    </AbsoluteFill>
  );
};

// fix — mistake recovery: wrong line → learner thinks (hold, countdown) → ✗ + why → right line ✓ → learner retries (gap)
const Ring: React.FC<{ a: number; b: number; size: number; color: string; children?: React.ReactNode }> = ({ a, b, size, color, children }) => {
  const f = useCurrentFrame(); const r = size / 2 - 7; const L = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ position: "absolute", transform: "rotate(-90deg)" }}><circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.15)" strokeWidth={9} fill="none" /><circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={9} fill="none" strokeDasharray={L} strokeDashoffset={L * (1 - interpolate(f, [a, b], [1, 0], clamp))} strokeLinecap="round" /></svg>
      <div style={{ position: "absolute", inset: 18, borderRadius: "50%", background: color, display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
};
const SFix: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const wrong = byKey(s, "wrong")!; const think = byKey(s, "think")!; const why = byKey(s, "why")!; const right = byKey(s, "right")!; const gap = s.beats.find((b) => b.gap);
  const W = s.wrong as { text: string; ro: string; bn: string }; const G = s.right as { text: string; ro: string; bn: string };
  const card = (b: Beat, x: { text: string; ro: string; bn: string }, ok: boolean, show: boolean) => (
    <div style={{ position: "relative", padding: "26px 50px", borderRadius: 34, background: "#fff", borderLeft: `14px solid ${show ? (ok ? C.mint : C.red) : "#C9CEE6"}`, boxShadow: show ? `0 0 0 6px ${ok ? C.mint : C.red}55, 0 30px 60px rgba(0,0,0,.4)` : "0 30px 60px rgba(0,0,0,.4)" }}>
      <KanaKaraoke b={b} text={x.text} size={96} />
      <div style={{ fontFamily: EN, fontSize: 36, fontWeight: 800, color: ok ? "#0E9F6E" : C.red }}>{x.ro}</div>
      <div style={{ fontFamily: BN, fontSize: 32, color: "#5B6390" }}>{x.bn}</div>
      {show && <Pop d={ok ? right.a : why.a} style={{ position: "absolute", right: -40, top: -40 }} rot={ok ? 0 : -14}><div style={{ width: 100, height: 100, borderRadius: 50, background: ok ? C.mint : C.red, display: "grid", placeItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>{ok ? <Check size={62} color="#fff" strokeWidth={4} /> : <X size={62} color="#fff" strokeWidth={4} />}</div></Pop>}
    </div>
  );
  return (
    <AbsoluteFill>
      <Kicker text="ভুল ধরো · ঠিক করো" color={C.red} icon={Wrench} />
      <div style={{ position: "absolute", left: 110, top: 300, textAlign: "center" }}>
        <Pop d={4}><Anime look="rafi" size={300} a={lineAmp(s, f, "M")} mood={f >= why.a && f < right.a ? "wow" : f >= right.b ? "happy" : "calm"} /></Pop>
        <Rise d={10} style={{ marginTop: 10 }}><span style={{ padding: "8px 22px", borderRadius: 20, background: C.ink, fontFamily: BN, fontSize: 28, fontWeight: 800, color: "#fff" }}>রাফি → বস</span></Rise>
      </div>
      <div style={{ position: "absolute", left: 560, right: 140, top: 210, display: "flex", flexDirection: "column", gap: 40, alignItems: "flex-start" }}>
        {f >= wrong.a - 6 && <Pop d={wrong.a - 6} rot={-2}>{card(wrong, W, false, f >= why.a)}</Pop>}
        {f >= think.a && f < think.b && <Rise d={think.a} y={20}><div style={{ display: "flex", alignItems: "center", gap: 26, padding: "18px 34px", borderRadius: 30, background: C.ink, border: `3px solid ${C.sun}` }}>
          <Ring a={think.a} b={think.b} size={110} color={C.sun}><Brain size={44} color={C.ink} /></Ring>
          <span style={{ fontFamily: BN, fontSize: 50, fontWeight: 800, color: "#fff" }}>কোথায় ভুল? <span style={{ color: C.sun }}>ভাবো…</span></span>
        </div></Rise>}
        {f >= why.a && f < right.a - 6 && <Rise d={why.a + 10} y={20}><div style={{ padding: "16px 30px", borderRadius: 22, background: "rgba(230,57,70,.18)", border: `2px solid ${C.red}`, fontFamily: BN, fontSize: 38, fontWeight: 700, color: "#fff" }}>💡 {s.why}</div></Rise>}
        {f >= right.a - 6 && <Pop d={right.a - 6} rot={2}>{card(right, G, true, true)}</Pop>}
        {gap && f >= gap.a && f < gap.b && <Rise d={gap.a} y={20}><div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Ring a={gap.a} b={gap.b} size={120} color={C.red}><Mic size={48} color="#fff" /></Ring>
          <span style={{ fontFamily: BN, fontSize: 52, fontWeight: 800, color: "#fff" }}>এবার <span style={{ color: C.red }}>তুমি</span> ঠিকটা বলো!</span>
        </div></Rise>}
      </div>
      <SFX at={why.a} name="pop" vol={0.3} /><SFX at={right.a} name="chime" vol={0.3} />
      {gap && <Confetti at={gap.b} y={480} n={50} />}
    </AbsoluteFill>
  );
};

// context — the same phrases in other real places: card shows the situation, learner answers in a hold, then the native answer plays
const PLACE: Record<string, React.FC<any>> = { food: UtensilsCrossed, train: TrainFront, store: Store, pin: MapPin };
const SContext: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame();
  const cards = s.cards as { place: string; ko: string; icon: string; sit: string }[];
  return (
    <AbsoluteFill>
      <Kicker text="অন্য জায়গায়, একই শব্দ" color={C.sky} icon={MapPin} />
      <div style={{ position: "absolute", left: 90, right: 90, top: 220, display: "flex", gap: 40, justifyContent: "center" }}>
        {cards.map((c, i) => {
          const q = byKey(s, `c${i}`)!; const ans = byKey(s, `a${i}`)!; const I = PLACE[c.icon] || MapPin;
          const active = f >= q.a - 6 && f < ans.b + 10; const done = f >= ans.a;
          return (
            <Pop key={i} d={s.beats[0].a + 6 + i * 8} rot={[-2, 1, 2][i]} style={{ flex: 1, maxWidth: 540 }}>
              <div style={{ height: 600, borderRadius: 36, padding: 34, boxSizing: "border-box", background: active || done ? "#fff" : "rgba(255,255,255,.1)", border: `3px solid ${active || done ? ACC[i] : C.line}`, boxShadow: active ? `0 0 60px ${ACC[i]}88` : "none", transform: `scale(${active ? 1.04 : 0.96})`, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 16 }}>
                <div style={{ width: 130, height: 130, borderRadius: 65, background: ACC[i], display: "grid", placeItems: "center" }}><I size={70} color={C.ink} strokeWidth={2.2} /></div>
                <div style={{ fontFamily: BN, fontSize: 44, fontWeight: 800, color: active || done ? C.ink : "#fff" }}>{c.place}</div>
                <div style={{ fontFamily: JP, fontSize: 34, fontWeight: 700, color: active || done ? "#5B6390" : C.mute }}>{c.ko}</div>
                <div style={{ fontFamily: BN, fontSize: 34, fontWeight: 600, color: active || done ? "#3A4170" : C.mute, lineHeight: 1.3 }}>{c.sit}</div>
                <div style={{ marginTop: "auto", minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  {f >= q.a && !done && <div style={{ display: "flex", alignItems: "center", gap: 24 }}><Ring a={q.a} b={q.b} size={96} color={C.red}><Mic size={38} color="#fff" /></Ring><span style={{ fontFamily: BN, fontSize: 36, fontWeight: 800, color: C.ink }}>তুমি কী বলবে?</span></div>}
                  {done && <Pop d={ans.a}><div><KanaKaraoke b={ans} text={ans.j!} size={72} /><div style={{ fontFamily: EN, fontSize: 28, fontWeight: 800, color: "#0E9F6E" }}>{ans.ro}</div><div style={{ fontFamily: BN, fontSize: 28, color: "#5B6390" }}>{ans.bn}</div></div></Pop>}
                </div>
              </div>
            </Pop>
          );
        })}
      </div>
      {cards.map((_, i) => { const ans = byKey(s, `a${i}`)!; return <SFX key={i} at={ans.a - 2} name="pop" vol={0.2} />; })}
    </AbsoluteFill>
  );
};

// mission — a tangible output after the video: record yourself on the phone, plus a real-life mission
const SMission: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const t = s.beats[0]; const lines = s.record as string[];
  const sec = Math.max(0, Math.floor((f - t.a) / 30));
  return (
    <AbsoluteFill>
      <Kicker text="তোমার মিশন" color={C.mint} icon={Target} />
      <div style={{ position: "absolute", left: 190, top: 190 }}>
        <Pop d={4} rot={-4}><div style={{ width: 380, height: 700, borderRadius: 56, background: "#0B0E26", border: "10px solid #2A2F55", boxShadow: "0 40px 80px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 30px", boxSizing: "border-box", gap: 30 }}>
          <div style={{ fontFamily: EN, fontSize: 56, fontWeight: 800, color: "#fff" }}>0:{String(sec % 60).padStart(2, "0")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, height: 120 }}>{Array.from({ length: 22 }, (_, i) => <div key={i} style={{ width: 8, height: 14 + Math.abs(Math.sin(f / 4 + i * 0.9)) * 90 * (0.4 + random(`m${i}`) * 0.6), borderRadius: 4, background: C.mint }} />)}</div>
          <div style={{ marginTop: "auto", width: 140, height: 140, borderRadius: 70, border: "8px solid #fff", display: "grid", placeItems: "center" }}><div style={{ width: 90, height: 90, borderRadius: 45, background: C.red, transform: `scale(${1 + Math.sin(f / 5) * 0.08})`, boxShadow: `0 0 ${30 + Math.sin(f / 5) * 20}px ${C.red}` }} /></div>
        </div></Pop>
      </div>
      <div style={{ position: "absolute", left: 680, right: 120, top: 210 }}>
        <Rise d={8}><div style={{ fontFamily: BN, fontSize: 52, fontWeight: 800, color: "#fff" }}>নিজের গলায় রেকর্ড করো</div></Rise>
        <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 18 }}>
          {lines.map((x, i) => { const d = t.a + 20 + i * 24; const on = f >= t.a + t.frames * 0.25 + i * 20;
            return <Rise key={i} d={d} y={20}><div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 26px", borderRadius: 22, background: "#fff", boxShadow: "0 14px 30px rgba(0,0,0,.3)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: on ? C.mint : "#E3E6F5", display: "grid", placeItems: "center", flex: "none" }}>{on ? <Check size={32} color="#fff" strokeWidth={4} /> : <span style={{ fontFamily: EN, fontWeight: 900, fontSize: 26, color: "#8A90B8" }}>{i + 1}</span>}</div>
              <span style={{ fontFamily: JP, fontSize: 46, fontWeight: 800, color: C.ink, whiteSpace: "nowrap" }}>{x}</span>
            </div></Rise>; })}
        </div>
        <Rise d={t.a + t.frames * 0.55} style={{ marginTop: 40 }}><div style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "20px 30px", borderRadius: 24, background: "rgba(61,220,151,.14)", border: `2px solid ${C.mint}` }}><Target size={44} color={C.mint} /><span style={{ fontFamily: BN, fontSize: 38, fontWeight: 700, color: "#fff" }}>{s.real}</span></div></Rise>
      </div>
    </AbsoluteFill>
  );
};

// signature secret: a true life hack / Bangla bridge / insider tip — a golden "key" card, Bangla side vs target-language side
const SSecret: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig(); const t = s.beats[0]; const k = pop(f, fps, 6);
  const pairs = (s.pairs || []) as [string, string][]; const jb = s.beats.find((x) => x.j); const said = !!jb && f >= jb.a - 6;
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
                  <div style={{ padding: "16px 26px", borderRadius: 20, background: "rgba(255,255,255,.1)", fontFamily: BN, fontSize: 40, fontWeight: 700, color: "#fff" }}>{b}</div>
                  <div style={{ textAlign: "center", fontFamily: EN, fontSize: 50, fontWeight: 900, color: C.sun }}>=</div>
                  <div style={{ padding: "16px 26px", borderRadius: 20, background: "#fff", fontFamily: MARU, fontSize: 40, fontWeight: 800, color: C.ink }}>{j}</div>
                </div>
              </Rise>
            ))}
          </div>}
          {said && jb && <Pop d={jb.a - 6} style={{ marginTop: 26, display: "flex", justifyContent: "center" }}><div style={{ padding: "14px 40px", borderRadius: 26, background: "#fff", textAlign: "center" }}><KanaKaraoke b={jb} text={jb.j!} size={60} /><div style={{ fontFamily: EN, fontSize: 26, fontWeight: 800, color: C.red }}>{jb.ro} <span style={{ fontFamily: BN, color: "#5B6390" }}>· {jb.bn}</span></div></div></Pop>}
          {s.why && !said && <Rise d={t.a + t.frames * 0.75} style={{ marginTop: 26 }}><div style={{ fontFamily: BN, fontSize: 32, color: "#FFE9B0", lineHeight: 1.4 }}>💡 {mix(s.why)}</div></Rise>}
        </div>
      </div>
      <SFX at={6} name="chime" vol={0.3} />
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
                <div style={{ flex: 1, fontFamily: BN, fontSize: 40, fontWeight: 700, color: shown ? C.ink : "#fff" }}>{mix(it.q)}</div>
                <div style={{ minWidth: 460, textAlign: "right" }}>
                  {shown ? <><KanaKaraoke b={j} text={j.show || j.j!} size={58} /><div style={{ fontFamily: EN, fontSize: 28, fontWeight: 700, color: "#0E9F6E" }}>{j.ro}</div></>
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

// hangul (letters lessons): rows of syllables (e.g. 아 어 오) light up as the native voice reads them; then a big card walks through each one with its
// romaji, Bangla sound and memory hint. Spec: rows:[{chars:[{k (syllable),jamo?,ro,bn,hint}]}], beats r<i> (j = the row's characters) + x<i> (teacher hints)
const SHangul: React.FC<P> = ({ s }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const rows = s.rows as { chars: { k: string; jamo?: string; ro: string; bn?: string; hint?: string }[] }[];
  let focus: { k: string; jamo?: string; ro: string; bn?: string; hint?: string } | null = null; let fi = -1, fr = -1;
  rows.forEach((r, i) => { const x = byKey(s, `x${i}`); if (x && f >= x.a && f < x.b + 6) { fi = Math.min(r.chars.length - 1, Math.floor(((f - x.a) / x.frames) * r.chars.length)); fr = i; focus = r.chars[fi]; } });
  const n = Math.max(...rows.map((r) => r.chars.length)); const tile = Math.min(150, 1500 / n - 18);
  return (
    <AbsoluteFill>
      <Kicker text={s.head || "নতুন হাংগুল অক্ষর"} color={C.sky} icon={Sparkles} />
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
                      <div style={{ marginTop: 8, fontFamily: EN, fontSize: Math.min(34, tile * 0.28), fontWeight: 800, color: lit ? C.sun : C.mute }}>{c.jamo ? <span style={{ fontFamily: MARU, marginRight: 8 }}>{c.jamo}</span> : null}{c.ro}</div>
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
          {(focus as any).hint && <div style={{ fontFamily: BN, fontSize: 34, color: "#fff", lineHeight: 1.35, marginTop: 6 }}>💡 {mix((focus as any).hint)}</div>}</div>
      </div>}
      {rows.map((_, i) => <SFX key={i} at={byKey(s, `r${i}`)!.a - 16} name="whoosh" vol={0.15} />)}
    </AbsoluteFill>
  );
};

const MAP: Record<string, React.FC<P>> = { hook: SHook, title: STitle, learn: SLearn, speak: SSpeak, grammar: SGrammar, secret: SSecret, recall: SRecall, hangul: SHangul, fix: SFix, context: SContext, roleplay: SRole, quiz: SQuiz, mission: SMission, reward: SReward };
const BIG = new Set(["title", "reward"]);

/* ---------- chrome ---------- */
const Header: React.FC<{ spec: Spec; starts: number[] }> = ({ spec, starts }) => {
  const f = useCurrentFrame(); const k = starts.filter((s) => f >= s).length;
  const xp = spec.scenes.reduce((n, s, i) => { const h = s.type === "quiz" ? byKey(s, "count") : null; return n + (h && f >= starts[i] + h.b ? (s.boss ? 20 : 10) : 0); }, 0);
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
      <div style={{ padding: "6px 14px 8px", borderRadius: 14, background: "rgba(8,11,36,.8)", fontFamily: BN, fontSize: 20, color: C.mute, lineHeight: 1.3 }}><b style={{ color: "#fff", fontSize: 24 }}>সনসেংনিম</b><br />এআই প্রশিক্ষক · এআই কণ্ঠ</div>
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

export const KoreanVideo: React.FC<{ spec: Spec }> = ({ spec }) => {
  const f = useCurrentFrame();
  const starts = spec.scenes.reduce<number[]>((a, _, i) => [...a, i ? a[i - 1] + spec.scenes[i - 1].len : 10], []);
  const total = koLen(spec); const sb = subs(spec, starts); const cur = sb.find((x) => f >= x.from && f < x.to + 4);
  const speech = (fr: number) => spec.scenes.some((s, i) => s.beats.some((b) => (b.t || b.j) && fr >= starts[i] + b.a - 4 && fr < starts[i] + b.b + 4));
  return (
    <AbsoluteFill style={{ background: C.bg0 }}>
      <Studio />
      {spec.scenes.map((s, i) => {
        const S = MAP[s.type] || STitle;
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={s.len}>
            <Fade len={s.len}><S s={s} spec={spec} /></Fade>
            {s.beats.filter((b) => b.file).map((b, j) => <Sequence key={j} from={b.a}><Audio src={staticFile(`korean/${spec.id}/${b.file}`)} /></Sequence>)}
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

// re-exported for the course promo (src/koreanpromo/KoreanPromo.tsx); behaviour unchanged
export { WORLDS, Studio, KanaKaraoke, Confetti, mix };
export type { Look };
