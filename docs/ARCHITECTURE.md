# Architecture

Stack decision: [docs/decisions/0006-tech-stack.md](decisions/0006-tech-stack.md)

## Repository Structure

```
src/
  AntEnglish.sln
  AntEnglish.Api/               # ASP.NET Core 8 Web API + Hangfire in-process
    Controllers/                # HTTP endpoints (one per product domain)
    Jobs/                       # Hangfire background jobs (CcImportJob, etc.)
    Program.cs                  # DI wiring: EF, Auth, Hangfire, Sentry, FluentValidation
    appsettings.json
  AntEnglish.Services/
    Interfaces/                 # Service contracts
    Services/                   # Business logic implementations
    Extensions/                 # IServiceCollection registration helpers
  AntEnglish.Data/
    Entities/                   # EF Core entity classes
    Migrations/                 # EF Core migrations (generated)
    AntDbContext.cs
  frontend/                     # Next.js 14 App Router
    src/
      app/                      # App Router pages and layouts
      components/               # Shared UI components
      hooks/                    # Custom hooks (e.g. useVideoReady.ts)
      lib/                      # Clients (supabase/client.ts, supabase/server.ts, api.ts)
      store/                    # Zustand stores
supabase/
  migrations/                   # Raw SQL migrations applied via Supabase CLI or MCP
```

## Layering

```
AntEnglish.Data  (entities, DbContext)
    <- AntEnglish.Services  (business logic, interfaces)
        <- AntEnglish.Api   (controllers, jobs, DI root)
```

Frontend talks to the .NET API over HTTP (SWR) and to Supabase directly for Auth and Realtime.

## Key Wiring Points

| Concern | Location |
|---|---|
| DB connection | `Program.cs` → `UseNpgsql` + `UseSnakeCaseNamingConvention` |
| JWT verification | `Program.cs` → `AddJwtBearer`, Authority = Supabase URL |
| Background jobs | `Program.cs` → `AddHangfire` + `AddHangfireServer` (in-process) |
| Job dashboard | `/hangfire` (restrict to admin in production) |
| Swagger UI | `/swagger` — JWT bearer auth via Authorize button (Development only) |
| Health endpoint | `GET /health` → `{ status, timestamp }` |
| Supabase client (FE) | `src/lib/supabase/client.ts` (browser) · `src/lib/supabase/server.ts` (RSC/Route Handlers) |
| Auth guard (FE) | `src/middleware.ts` — redirects unauthenticated requests to `/login` |

## Database

- Supabase PostgreSQL 15, snake_case columns
- EF Core maps via `UseSnakeCaseNamingConvention()` (EFCore.NamingConventions)
- RLS enabled on all tables — see `supabase/migrations/20260606000001_initial_schema.sql`
- Migrations managed via Supabase CLI (`supabase db push`) or Supabase MCP tool

## Dependency Rule

Inner layers must not depend on outer layers.

| Layer | May depend on |
|---|---|
| Data | nothing project-external except EF Core + Npgsql |
| Services | Data |
| Api | Services, Data |
| frontend | API contracts (HTTP) + Supabase client |

## Parse-First Boundary Rule

All HTTP request bodies go through FluentValidation before entering service layer.
`user_id` is always taken from verified JWT — never from request body.
