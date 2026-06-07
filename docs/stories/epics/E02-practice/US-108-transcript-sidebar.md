# US-108 · Transcript sidebar navigation

**Epic:** E02 — Practice  
**Lane:** normal  
**Status:** implemented  
**Product doc:** [docs/product/practice.md](../../../product/practice.md)

## Story

As Sara, I want to see all sentences in a sidebar and jump to any one, so that I can skip ahead or revisit a specific sentence quickly.

## Acceptance Criteria

**AC-108-1 — Sidebar sentence list**
- All sentences numbered `#1` to `#N`
- Unseen: blurred `•••`; completed: unblurred text + checkmark

**AC-108-2 — Jump to sentence**
- Click `#12` → player seeks to `sentence[12].start_time_ms`; dictation loads sentence 12

**AC-108-3 — Progress counter**
- Header shows `"X / N"` + progress bar

## Risk Flags

- Existing behavior (interacts with practice session state from US-102)

## Validation

- Unit: sidebar state derivation from `user_progress`
- Integration: click-to-seek triggers player seek + session update

## Proof Status

unit: yes | integration: no | e2e: no | platform: no
