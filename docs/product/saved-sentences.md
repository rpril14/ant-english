# Product: Saved Sentences

Covers US-106.

## Save During Practice

- "Save sentence" button during practice creates `saved_sentences` row for `(user_id, sentence_id)`.
- Toast confirms: `"Sentence saved"`.
- Button changes to filled bookmark icon.
- Clicking again deletes the row; toast confirms: `"Sentence removed from saved list"`.

## Saved Sentences View

- Lists all saved sentences with: sentence text, translation, source video title, personal note.

## Personal Notes

- User can add a freetext note to any saved sentence.
- Note stored in `saved_sentences.note`.
- Persists across sessions.

## Phase 3 Extension

`saved_sentences` table already includes SM-2 fields (`review_interval`, `review_ease`, `next_review_at`) for spaced repetition review in Phase 3. These are not surfaced in Phase 1 UI.
