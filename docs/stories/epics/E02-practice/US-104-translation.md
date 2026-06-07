# US-104 · View translation

**Epic:** E02 — Practice  
**Lane:** normal  
**Status:** implemented  
**Product doc:** [docs/product/translation.md](../../../product/translation.md)

## Story

As Tom, I want to see a translation of each sentence in my native language, so that I understand the meaning even when I cannot catch all the words.

## Acceptance Criteria

**AC-104-1 — Translation toggle**
- "Hide translation" hides row for all subsequent sentences
- Preference saved to `localStorage`, restored on next visit

**AC-104-2 — Translation at session start**
- Toggle ON: translation below input in 14 px muted text

**AC-104-3 — Translation unavailable — graceful degradation**
- `sentences.translation = null`: shows `"Translation not available"`
- Session fully functional

## Risk Flags

- External systems (DeepL — handled at import, not at session time)

## Validation

- Unit: localStorage toggle persistence
- Integration: null translation → graceful UI

## Proof Status

unit: yes | integration: no | e2e: no | platform: no
