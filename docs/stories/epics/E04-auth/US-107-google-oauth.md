# US-107 · Sign in and own my data

**Epic:** E04 — Auth  
**Lane:** high-risk  
**Status:** implemented  
**Product doc:** [docs/product/auth.md](../../../product/auth.md)

## Story

As Alex, I want to sign in with Google and have my library and progress tied to my account, so that my data is safe and accessible on any device.

## Acceptance Criteria

**AC-107-1 — Google sign-in**
- Click "Sign in with Google" → Google OAuth consent → redirect back with active session

**AC-107-2 — New user onboarding**
- First login: empty library + prompt `"Paste your first YouTube link below to get started"`

**AC-107-3 — Data isolation**
- Cannot read or write `user_videos`, `user_progress`, `saved_sentences` rows of another user
- Blocked at DB level via Supabase RLS

**AC-107-4 — Session persistence**
- Browser close + reopen within TTL → still signed in

**AC-107-5 — Sign out**
- Session invalidated; redirect to landing page; protected routes → sign-in

## Risk Flags

- Auth (hard gate — high-risk)
- Authorization (RLS policies)
- Audit/security (JWT verification in .NET API)

## Validation

- Unit: JWT extraction, `user_id` from verified token (never from body)
- Integration: Supabase Auth flow; RLS policy enforcement
- E2E: sign-in → library → sign-out → protected route redirect

## Proof Status

unit: no | integration: no | e2e: no | platform: no

## Implementation Notes

- `/auth/callback` route exchanges OAuth code for session via `exchangeCodeForSession`
- Middleware protects all routes except `/`, `/login`, `/auth/*`; redirects unauthenticated users to `/login?next=<path>`
- RLS policies confirmed on all tables: user-scoped tables (`user_videos`, `user_progress`, `saved_sentences`) enforce `auth.uid() = user_id`; shared tables (`videos`, `sentences`) allow authenticated read
- API uses direct Postgres connection (service role) — bypasses RLS correctly; `user_id` always sourced from verified JWT `sub` claim
