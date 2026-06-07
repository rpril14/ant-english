# US-106 · Save sentences for review

**Epic:** E03 — Library  
**Lane:** normal  
**Status:** implemented  
**Product doc:** [docs/product/saved-sentences.md](../../../product/saved-sentences.md)

## Story

As Sara, I want to bookmark sentences I find difficult, so that I can review them later outside the main practice session.

## Acceptance Criteria

**AC-106-1 — Save during practice**
- Click "Save sentence" → `saved_sentences` row created; toast `"Sentence saved"`; button → filled bookmark

**AC-106-2 — View saved sentences**
- List: sentence text, translation, source video title, personal note

**AC-106-3 — Add personal note**
- Type note, click Save → persisted in `saved_sentences.note`

**AC-106-4 — Remove saved sentence**
- Click filled bookmark → row deleted; toast `"Sentence removed from saved list"`

## Risk Flags

- Data model (`saved_sentences` mutations)
- Public contracts (`POST /api/saved`, `DELETE /api/saved/{sentence_id}`, `GET /api/saved`)

## Validation

- Unit: bookmark toggle state
- Integration: save/delete/note roundtrip

## Proof Status

unit: yes | integration: no | e2e: no | platform: no
