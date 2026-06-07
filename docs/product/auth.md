# Product: Authentication & Authorization

Covers US-107.

## Authentication

- Provider: Google OAuth via Supabase Auth.
- First-time login: library empty, onboarding prompt shown.
- Session persists across browser closes within Supabase session TTL.
- Sign-out: session invalidated, redirect to landing page.
- Protected routes redirect to sign-in if accessed without session.

## Data Isolation (RLS)

All user-scoped tables have Supabase Row-Level Security policies enforced at the database level.

| Table | Policy |
|---|---|
| `user_videos` | `auth.uid() = user_id` — ALL operations |
| `user_progress` | `auth.uid() = user_id` — ALL operations |
| `saved_sentences` | `auth.uid() = user_id` — ALL operations |
| `videos` | `auth.role() = 'authenticated'` — SELECT only |

No user can read or write rows belonging to another user. Shared `videos` and `sentences` rows are readable by all authenticated users; writes are service-role only.

## Backend Auth

- All API endpoints except public health check require a valid Supabase JWT.
- The .NET API verifies JWTs using Supabase's JWKS endpoint.
- `user_id` is always taken from the verified JWT, never from request body.
- Job status polling is scoped through `user_videos`; users can poll only import jobs linked to their own library.
