# US-103 · Use hints when stuck

**Epic:** E02 — Practice  
**Lane:** normal  
**Status:** planned  
**Product doc:** [docs/product/practice.md](../../../product/practice.md)

## Story

As Tom, I want to get a small hint without seeing the full answer, so that I can keep practicing without giving up on a hard sentence.

## Acceptance Criteria

**AC-103-1 — First letter hint (Alt+H)**
- Each unrevealed word shows first letter as chip (e.g. `H___` for "Hello")
- `hint_level = 1` recorded

**AC-103-2 — Reveal next word (Alt+R)**
- Next unrevealed word shown fully in chip row
- Input field not modified; `hint_level = 2` recorded

**AC-103-3 — Show all words**
- All words shown as chips
- Score capped at 60%; notice: `"Score capped at 60% — answer revealed"`

**AC-103-4 — Proper names not penalised**
- Proper name shows as separate orange chip below input
- Skipping it does not reduce match%

**AC-103-5 — No hint = full score**
- Without any hint, score can reach 100%

## Risk Flags

- Existing behavior (interacts with matching engine from US-102)

## Validation

- Unit: hint level state machine, score cap logic
- Integration: hint + progress save; proper-name chip rendering

## Proof Status

unit: no | integration: no | e2e: no | platform: no
