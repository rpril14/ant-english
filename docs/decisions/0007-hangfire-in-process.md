# 0007 Hangfire Jobs Run In-Process with API

Date: 2026-06-06

## Status

Accepted

## Context

Background jobs (transcript fetch via youtube-transcript-api, DeepL translate) need a reliable queue with retries and a dashboard. The question is whether to run Hangfire in the same ASP.NET Core process as the API or in a separate Worker project.

## Decision

Run Hangfire in-process with the API host. One Railway container, one deployment. The API project calls `AddHangfire()`, `UseHangfireDashboard()`, and `AddHangfireServer()` in `Program.cs`.

## Alternatives Considered

1. Separate `AntEnglish.Worker` project — possible if Phase 2 Whisper transcription requires independent CPU scaling; deferred.
2. Azure Service Bus / AWS SQS — out of scope for Phase 1 infrastructure budget.

## Consequences

Positive:
- Simpler deployment and local dev (one `dotnet run`).
- Job code shares the same DI container as API services.

Tradeoffs:
- A CPU-intensive Whisper job would compete with API request handling; mitigated by deferring Whisper to Phase 2.
- Scaling the API also scales the job worker — no independent scaling.

## Follow-Up

- Revisit in Phase 2 when Whisper transcription requires CPU isolation.
