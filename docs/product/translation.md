# Product: Translation

Covers US-104.

## Behaviour

- Translation fetched at import time via DeepL API (EN → target language).
- Results cached in `sentences.translation` — no re-fetching per session.
- Displayed below the dictation input in 14 px muted text.

## User Toggle

- "Hide translation" button hides translation for all subsequent sentences.
- Preference stored in `localStorage`, restored on next visit.

## Graceful Degradation

- If DeepL quota is exceeded at import time: `sentences.translation = null`.
- UI shows `"Translation not available"` instead of empty space.
- Practice session remains fully functional without translation.

## Phase 1 Scope

- Target language is Vietnamese (`VI`) — hardcoded in Phase 1.
- Per-user language preference is a Phase 2+ concern.

## Quota Notes

- DeepL free tier: 500,000 chars/month (~10,000 sentences at 50 chars avg).
- At quota exhaustion: sentences stored without translation, import continues.
