# 0006 Application Tech Stack

Date: 2026-06-06

## Status

Accepted

## Context

The project spec (SPEC.md v2.1) prescribes a full-stack web application for English listening practice. A concrete, locked stack is needed before any scaffolding or story implementation begins.

## Decision

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Zustand, SWR, Tailwind CSS, Framer Motion, react-player |
| Backend | ASP.NET Core 8 Web API, Entity Framework Core + Npgsql, FluentValidation |
| Background jobs | Hangfire (in-process with API — see 0007) |
| Database | Supabase PostgreSQL 15, snake_case columns |
| Auth | Supabase Auth — Google OAuth |
| Realtime | Supabase Realtime (WebSocket) |
| File storage | Supabase Storage (thumbnails only, Phase 1) |
| Cache / queue | Upstash Redis (Hangfire job queue backend) |
| External services | YouTube Data API v3, yt-dlp CLI, DeepL API |
| Error tracking | Sentry (Next.js + .NET) |
| Frontend deploy | Vercel |
| Backend deploy | Railway (Docker container) |
| CI/CD | GitHub Actions |

## Alternatives Considered

1. Node.js backend (Express / NestJS) — rejected; spec explicitly chose ASP.NET Core 8.
2. Separate worker process for Hangfire — deferred to Phase 2 (see 0007).
3. Self-hosted PostgreSQL — rejected in favour of Supabase for integrated Auth + Realtime + RLS.

## Consequences

Positive:
- Supabase provides Auth, Realtime, RLS, and Storage in one service — reduces integration surface.
- Hangfire in-process means one Railway container in Phase 1.
- Next.js on Vercel gives preview URLs per PR out of the box.

Tradeoffs:
- Two languages (TypeScript + C#) require broader knowledge to maintain.
- Railway + Vercel + Supabase + Upstash = four managed services to configure and monitor.

## Follow-Up

- Scaffold Next.js 14 App Router project under `src/frontend/`.
- Scaffold ASP.NET Core 8 solution under `src/`.
- Record stack in `docs/ARCHITECTURE.md` once scaffolding exists.
