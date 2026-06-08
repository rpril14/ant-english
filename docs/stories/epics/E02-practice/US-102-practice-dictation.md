# US-102 · Practice dictation on a sentence

**Epic:** E02 — Practice  
**Lane:** high-risk  
**Status:** implemented  
**Product doc:** [docs/product/practice.md](../../../product/practice.md)

## Story

As Alex, I want to type what I hear sentence by sentence and see which words I got right or wrong, so that I know exactly where my listening breaks down.

## Acceptance Criteria

**AC-102-1 — Player pauses at sentence boundary**
- Player seeks to `sentence[i].start_time_ms` and plays
- Player reaches `sentence[i].end_time_ms` → pauses automatically so learner can type
- Transcript sidebar scrolls to highlight sentence `i` (US-108)

**AC-102-2 — Real-time word chip feedback**
- Chips update within 50 ms per keystroke
- Pending words: gray chips with one dot per letter
- Active word (typing in progress, prefix correct): yellow chip with typed letters + dots for remaining
- Active word (wrong letter typed): red chip with typed letters + dots for remaining
- Completed correct word: green chip showing the word
- Completed wrong word: red chip showing the typed text (reference word not revealed)

**AC-102-3 — Normalisation**
- `"im here to learn english"` matches `"I'm here to learn English."` at 100%

**AC-102-4 — Sentence completion**
- ≥ 95% match → chips turn green, `user_progress` upserted, translation revealed — session waits for manual Next

**AC-102-5 — Manual advance**
- Enter or Next → advances only if sentence is completed; otherwise chips flash red
- Progress saved on advance
- Player auto-plays the next sentence immediately on advance
- Input field auto-focuses on the new sentence so the learner can type immediately

**AC-102-6 — Replay sentence**
- Ctrl+R or Replay button → seeks to `sentence[i].start_time_ms`; input preserved
- Clicking play on the video player while paused at a sentence boundary also seeks to `sentence[i].start_time_ms` and replays

**AC-102-7 — No auto-advance**
- Session never advances automatically; Enter or Next always required after sentence completion

**AC-102-8 — Progress persists on refresh**
- Resumes at first incomplete sentence; completed sentences show saved scores
- Navigating back to a completed sentence fills input with sentence text so all chips display green

## Risk Flags

- Data model (upserts `user_progress`)
- Public contracts (`POST /api/progress`, `GET /api/progress/{video_id}`)
- Existing behavior (matching engine is a core correctness surface)

## Validation

- Unit: normalisation rules, positional word diff, score calculation, proper-name exclusion
- Integration: progress upsert → read-back; resume-on-refresh
- E2E: full dictation session, completion, refresh-resume

## Proof Status

unit: yes | integration: yes | e2e: no | platform: no
