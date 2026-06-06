# US-102 · Practice dictation on a sentence

**Epic:** E02 — Practice  
**Lane:** high-risk  
**Status:** planned  
**Product doc:** [docs/product/practice.md](../../../product/practice.md)

## Story

As Alex, I want to type what I hear sentence by sentence and see which words I got right or wrong, so that I know exactly where my listening breaks down.

## Acceptance Criteria

**AC-102-1 — Player syncs to current sentence**
- Player `currentTime` reaches `sentence[i].start_time_ms` → sentence `i` becomes active
- Transcript sidebar scrolls to highlight sentence `i`

**AC-102-2 — Real-time word matching**
- Word diff updates within 50 ms per keystroke
- Correct words: green chips; incorrect: red chips; missing: gray placeholder chips

**AC-102-3 — Normalisation**
- `"im here to learn english"` matches `"I'm here to learn English."` at 100%

**AC-102-4 — Sentence completion**
- ≥ 95% match → auto-complete; `user_progress` upserted

**AC-102-5 — Manual advance**
- Enter or Next → advance regardless of score; progress saved

**AC-102-6 — Replay sentence**
- Ctrl+R → seeks to `sentence[i].start_time_ms`; input preserved

**AC-102-7 — Auto-advance toggle**
- ON: auto-advance at `sentence[i+1].start_time_ms`
- OFF: wait for manual advance

**AC-102-8 — Progress persists on refresh**
- Resumes at first incomplete sentence; completed sentences show saved scores

## Risk Flags

- Data model (upserts `user_progress`)
- Public contracts (`POST /api/progress`, `GET /api/progress/{video_id}`)
- Existing behavior (matching engine is a core correctness surface)

## Validation

- Unit: normalisation rules, LCS matching, score calculation, proper-name exclusion
- Integration: progress upsert → read-back; resume-on-refresh
- E2E: full dictation session, completion, refresh-resume

## Proof Status

unit: no | integration: no | e2e: no | platform: no
