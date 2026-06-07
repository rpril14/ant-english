# Story Backlog

## Epics

| Epic | Description | Status |
| --- | --- | --- |
| E01 — Import | Import YouTube videos via CC transcript | done |
| E02 — Practice | Dictation practice loop with hints and sidebar | in progress |
| E03 — Library | Video library management and saved sentences | planned |
| E04 — Auth | Google OAuth sign-in and data isolation | done |

---

## E01 — Import

| Story | Title | Status | Unit | Integ | E2E |
| --- | --- | --- | --- | --- | --- |
| US-101 | Import a YouTube video (CC-only) | ✅ implemented | ✅ | ✅ | — |

---

## E02 — Practice

| Story | Title | Status | Unit | Integ | E2E |
| --- | --- | --- | --- | --- | --- |
| US-102 | Practice dictation on a sentence | ✅ implemented | ✅ | ✅ | — |
| US-103 | Use hints when stuck | ✅ implemented | ✅ | — | — |
| US-104 | View translation | planned | — | — | — |
| US-108 | Transcript sidebar navigation | planned | — | — | — |

---

## E03 — Library

| Story | Title | Status | Unit | Integ | E2E |
| --- | --- | --- | --- | --- | --- |
| US-105 | Manage video library | planned | — | — | — |
| US-106 | Save sentences for review | planned | — | — | — |

---

## E04 — Auth

| Story | Title | Status | Unit | Integ | E2E |
| --- | --- | --- | --- | --- | --- |
| US-107 | Sign in with Google OAuth | ✅ implemented | ✅ | — | — |

---

## Notes

- E2E tests require Playwright setup — deferred until core stories are complete.
- US-107 integration tests (Supabase RLS) deferred pending Supabase local stack setup.
- US-103 integration tests deferred (hint state is frontend-only; no new API surface).
