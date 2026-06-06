# Product: Dictation Practice

Covers US-102, US-103, US-108.

## Practice Loop

1. Video player syncs to `sentence[i].start_time_ms` as playback advances.
2. Learner types what they hear in the dictation input.
3. Word diff updates within 50 ms per keystroke.
4. At ≥ 95% match: sentence auto-completes, `user_progress` upserted.
5. Below 95%: learner presses Enter or clicks Next to manually advance.

## Word Matching

- Normalisation: lowercase, smart-apostrophe → `'`, strip punctuation except `'`, split on spaces.
- LCS-based word diff.
- Proper names (from `sentences.named_entities`) excluded from scoreable words.
- If all words are proper names: match% = 100.
- `input = "im here to learn english"` matches `"I'm here to learn English."` at 100%.

## Hint System

| Level | Trigger | Effect | Score cap |
|---|---|---|---|
| 0 | No hint | Full score available | 100% |
| 1 | Alt+H / "1st letter" | Each unrevealed word shows first letter | None |
| 2 | Alt+R / "Reveal word" | Next unrevealed word shown fully | None |
| 3 | "Show all" | All words shown | 60% |

`hint_level_used` stored in `user_progress`.

## Transcript Sidebar (US-108)

- All sentences numbered `#1` to `#N`.
- Unseen sentences show blurred `•••`.
- Completed sentences show unblurred text + checkmark.
- Click sentence → player seeks to that sentence's `start_time_ms`.
- Header shows `"X / N"` progress counter + progress bar.

## Controls

| Action | Shortcut |
|---|---|
| Replay sentence | Ctrl+R or Replay button |
| Next sentence | Enter or Next button |
| First letter hint | Alt+H |
| Reveal word | Alt+R |

## Auto-Advance

- Toggle ON: session advances automatically when player reaches `sentence[i+1].start_time_ms`.
- Toggle OFF: waits for manual advance regardless of playback.

## Progress Persistence

- `user_progress` upserted per `(user_id, sentence_id)` on every advance.
- On page refresh: session resumes at first incomplete sentence.
- Previously completed sentences show saved scores.

## Edge Cases

| Situation | Behaviour |
|---|---|
| Sentence > 30 words | Hint available from attempt 1; no score penalty |
| Sentence contains only proper nouns | match% = 100 |
| Extra whitespace in input | Normalised before matching |
| Two sentences with identical text | Matched by `sentence_id`, not text |
