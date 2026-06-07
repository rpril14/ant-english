# Product: Dictation Practice

Covers US-102, US-103, US-108.

## Practice Loop

1. Player seeks to `sentence[i].start_time_ms` and plays.
2. Player reaches `sentence[i].end_time_ms` → **pauses automatically**.
3. Learner types what they heard in the dictation input.
4. Word diff updates within 50 ms per keystroke.
5. At ≥ 95% match: sentence auto-completes (`user_progress` upserted, chips turn green, translation revealed) — session **waits** for manual advance.
6. Learner presses Enter or clicks Next to advance. Blocked with red chip flash if sentence is not yet completed. On advance, player **auto-plays** the next sentence immediately.

## Word Matching

- Normalisation: lowercase, smart-apostrophe → straight apostrophe, strip all punctuation (including apostrophes), split on spaces.
- Positional word diff (word at input position `i` compared to reference word `i`).
- Proper names (from `sentences.named_entities`) excluded from scoreable words.
- If all words are proper names: match% = 100.
- `input = "im here to learn english"` matches `"I'm here to learn English."` at 100%.

## Word Chip States

Each reference word is shown as a chip. Chip states update in real-time as the learner types:

| State | Colour | Content |
|---|---|---|
| Pending (not yet reached) | Gray | Dots — one dot per letter in the word |
| Active, prefix correct | Yellow | Typed letters + dots for remaining letters |
| Active, wrong letter | Red | Typed letters + dots for remaining letters |
| Completed correct (space pressed) | Green | Reference word |
| Completed wrong (space pressed) | Red | Typed text (reference word never revealed) |

## Hint System

| Level | Trigger | Effect | Score cap |
|---|---|---|---|
| 0 | No hint | Full score available | 100% |
| 1 | Alt+H / "1st letter" button | Reveals first letter of next pending word (one word per press) | None |
| 2 | Click any non-correct chip (pending, incorrect, or active) | Reveals that specific word in full (blue chip) | None |

`hint_level_used` stored in `user_progress`.

Hints are additive: level 2 does not reset level 1 hints already shown.

## Transcript Sidebar (US-108)

- All sentences numbered `#1` to `#N`.
- Unseen sentences show blurred `•••`.
- Completed sentences show unblurred text + checkmark.
- Click sentence → player seeks to that sentence's `start_time_ms`.
- Header shows `"X / N"` progress counter + progress bar.

## Controls

| Action | Shortcut / Method |
|---|---|
| Replay sentence | Ctrl+R or Replay button |
| Next sentence | Enter or Next button (only when sentence completed) |
| First letter hint | Alt+H |
| Replay via video controls | Clicking play on the video player while paused at a sentence boundary replays from `start_time_ms` |

Clicking any control button does not steal focus from the dictation input; the learner can type immediately after clicking.

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
| Navigate back to a completed sentence | Input filled with sentence text; all chips shown green |
