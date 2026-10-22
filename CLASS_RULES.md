# Global Class Rules — every AI University lesson video (all courses)

Owner's standard (2026-10-22). Every new lesson follows these rules, and `python scripts/lesson_check.py <spec.json>` enforces the parts a video can carry. A lesson that fails the check is not rendered. Language engines (Japanese, Arabic, Korean) share the scene type names below; other subjects map them to their own scenes.

## Core
Each lesson is cinematic, interactive, practical and outcome-driven. It is never a lecture-only or talking-head video. Every scene must do at least one of these: teach, demonstrate, test, motivate, or support the objective. No filler.

## Mandatory flow (scene types)
1. `hook`: a 5–15 s cinematic real-life moment (a problem, or an exciting result). It is always the first scene.
2. `title`: the lesson goal. `spec.objective` holds one measurable can-do sentence ("শেষে তুমি … পারবে").
3. `recall`: from lesson 2 onward, a short spaced review of earlier lessons, answered from memory before the answer shows.
4. Watch & understand: `learn` / `grammar` (one concept at a time, visual memory anchors: colour, motion, icon, character).
5. Guided practice: `speak` (listen slow → normal → mic gap; the learner says it before the reveal).
6. `fix`: mistake recovery. Show a wrong version, the learner thinks during a pause, then the right one with *why* and how to retry.
7. `context`: the same skill in 2–3 other real places (context switching).
8. `roleplay`: a real scene, first with subtitles, then "your turn" gaps where the learner speaks before the answer.
9. `quiz` ×3+: timed challenges with countdown and XP. The last one has `"boss": true` and is a real situation that combines the lesson.
10. `mission`: a tangible output the learner makes after the video (record a sentence, a design, code, a clip) plus the real-life mission.
11. `reward`: XP for demonstrated work (not for watching), streak, recap, **before → after**, and the next lesson's teaser.

## Our signature: secrets (owner, 2026-10-22)
Every lesson has at least one `secret` scene: a TRUE life hack, a memory trick, a **Bangla bridge** (something that already matches Bangla in sound, words, grammar or culture), or an insider tip from people who really use the skill. These make our courses different. Each one comes from the course board's hacks researcher and has a source or reason; no fake shortcuts.

## Teaching rules
- Active recall: never reveal an answer before the learner has had a pause (`hold` or `gap`) to answer or speak.
- Explain mistakes constructively and always show the correct retry.
- Retention: important items come back in later lessons (`recall`) and in new contexts.
- Language lessons: native audio, pronunciation lab, listening without subtitles, character dialogue. AI/video lessons: live workflow, guided creation, a rendered output, troubleshooting. Coding lessons: runnable code, debugging, tests, a working deliverable.
- Voice: teacher = Tanvir (real male Bangla voice, ElevenLabs direct, eleven_v4). Native lines use native-language voices.
- Accuracy gate: every foreign-language line, fact and code example is checked (our OpenRouter/EDUCATOR research + a second-model review) before voicing.

## Quality gate (before marking a lesson ready)
Audio is in sync, the kana/letter karaoke is correct, captions are readable, the mouths move, nothing overflows or overlaps, and the last frame is clean. This is checked on stills (`*_stills.mjs`) before the cloud render, and the final MP4 is spot-checked.

## Done outside the video (site / app player)
Pause, replay, speed and transcript (player.js), adaptive difficulty, real XP for learner answers, and learning analytics (`learn_log`, quiz scores) belong to the website or app lesson page. The video only shows the flow; the interactive scoring lives there.
