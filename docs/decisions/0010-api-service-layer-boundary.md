# 0010 API–Service Layer Boundary

Date: 2026-06-07

## Status

Accepted

## Context

The initial controllers (`LibraryController`, `SavedController`, `ProgressController`,
`ImportController`, `JobsController`) injected `AntDbContext` directly, and
`AntEnglish.Api.csproj` held a `ProjectReference` to `AntEnglish.Data`. This made
the Api project implicitly aware of EF Core internals, and meant controllers were
impossible to unit-test in isolation — every test touching controller logic needed a
real or in-memory database.

## Decision

- `AntEnglish.Api` references only `AntEnglish.Services`. The direct reference to
  `AntEnglish.Data` is removed.
- All database access lives in `AntEnglish.Services`. Controllers receive results
  through service interfaces and return HTTP responses only.
- Four new service interfaces were introduced: `ILibraryService`, `ISavedService`,
  `IProgressService`, `IVideoImportService`.
- `AddDbContext<AntDbContext>` registration moved from `Program.cs` into
  `ServiceCollectionExtensions.AddAntEnglishData()` in the Services project.
- `CcImportJob` (Hangfire) became a thin delegate to `IVideoImportService.ProcessImportAsync`.
- `YouTubeHelper` moved to `AntEnglish.Api.Helpers` (was co-located with controllers).
- `HealthController` removed; the `/health` minimal API endpoint in `Program.cs` covers
  uptime checks without the extra controller overhead.

## Alternatives Considered

1. **Repository pattern** — add a `Repository` layer between Services and Data. Rejected:
   adds abstraction with no benefit given EF Core's `DbContext` is already a unit-of-work
   and can be swapped for `InMemory` in integration tests.

2. **Keep Api referencing Data, add service wrappers anyway** — rejected: the explicit
   `ProjectReference` would still allow controllers to bypass the service layer by
   accident; removing the reference enforces the boundary at compile time.

## Consequences

Positive:

- Service classes can be unit-tested by mocking the interface — no database required.
- Compile-time enforcement: controllers cannot access `AntDbContext` even by mistake.
- Business logic is co-located with data access in one layer, not split across two.

Tradeoffs:

- `AntEnglish.Services.csproj` now owns both business logic and DB registration;
  a future split into a separate `AntEnglish.Infrastructure` project is straightforward
  if the project grows.

## Follow-Up

- Write unit tests for the four new service classes using `NSubstitute` mocks.
- Consider moving `ClaimsPrincipalExtensions` and `YouTubeHelper` to Services if
  they grow beyond API-layer concerns.
