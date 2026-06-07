# US-103 · Use hints when stuck

**Epic:** E02 — Practice  
**Lane:** normal  
**Status:** implemented  
**Product doc:** [docs/product/practice.md](../../../product/practice.md)

## Story

As Tom, I want to get a small hint without seeing the full answer, so that I can keep practicing without giving up on a hard sentence.

## Acceptance Criteria

**AC-103-1 — First letter hint (Alt+H)**
- Each press of Alt+H or "1st letter" button reveals the first letter of the next pending word (one word per press)
- Chip shows `H···` format (first letter + dots for remaining letters)
- `hint_level = 1` recorded

**AC-103-2 — Click chip to reveal word**
- Clicking any non-correct chip (pending, incorrect, or active) reveals that specific word in full (blue chip)
- Input field not modified; `hint_level = 2` recorded

**AC-103-3 — Proper names not penalised**
- Proper names show as separate orange chips below the input
- Skipping them does not reduce match%

**AC-103-4 — No hint = full score**
- Without any hint, score can reach 100%

## Risk Flags

- Existing behavior (interacts with matching engine from US-102)

## Validation

- Unit: score cap logic (`applyScoreCap`), proper-name exclusion, `isComplete` threshold
- Integration: hint + progress save; proper-name chip rendering

## Proof Status

unit: yes | integration: no | e2e: no | platform: no
