# 0011 Job Status Ownership

Date: 2026-06-07

## Status

Accepted

## Context

`GET /api/jobs/{job_id}/status` is an authenticated fallback for import progress polling. Import jobs are represented by shared `videos` rows, but library membership and user ownership are represented by `user_videos`.

If status lookup reads `videos` directly, any authenticated user with a video/job id can observe the import status for a job that is not in their library.

## Decision

Job status lookup must be scoped through `user_videos` using the authenticated `user_id`.

Duplicate imports for videos already in `queued` or `processing` state must create the missing `user_videos` link for the current user before returning the existing job id.

## Alternatives Considered

1. Keep job status readable to all authenticated users because `videos` are shared.
2. Return job status only for the user who originally created the import.

## Consequences

Positive:

- Polling behavior now matches user-scoped library ownership.
- A second user importing the same queued video sees the card in their own library.
- The endpoint no longer leaks import status for unlinked jobs.

Tradeoffs:

- Shared video status still exists globally, but access to the polling endpoint now depends on library membership.

## Follow-Up

- Consider applying the same explicit library-membership rule to progress and saved-sentence writes if product scope requires users to act only on sentences from their own library.
