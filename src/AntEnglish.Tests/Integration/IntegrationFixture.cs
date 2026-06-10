using AntEnglish.Data;
using AntEnglish.Services.Extensions;
using AntEnglish.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;
using NSubstitute;
using Respawn;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace AntEnglish.Tests.Integration;

[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<IntegrationFixture> { }

public class IntegrationFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Override with ANTENG_TEST_DB env var in CI or non-default local setups
    private static readonly string ConnectionString =
        Environment.GetEnvironmentVariable("ANTENG_TEST_DB")
        ?? "Host=localhost;Port=5433;Database=anteng_test;Username=postgres;Password=postgres";

    private Respawner _respawner = null!;

    public IYouTubeService YouTube { get; } = Substitute.For<IYouTubeService>();

    async Task IAsyncLifetime.InitializeAsync()
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
        await db.Database.EnsureCreatedAsync();

        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"]
        });
    }

    async Task IAsyncLifetime.DisposeAsync() => Dispose();

    public async Task ResetAsync()
    {
        await using var conn = new NpgsqlConnection(ConnectionString);
        await conn.OpenAsync();
        await _respawner.ResetAsync(conn);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Supabase:Url"] = "https://test.supabase.co",
                ["ConnectionStrings:DefaultConnection"] = ConnectionString,
            });
        });
        builder.ConfigureServices(services =>
        {
            var toRemove = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AntDbContext>)
                         || d.ServiceType == typeof(AntDbContext))
                .ToList();
            foreach (var d in toRemove) services.Remove(d);

            services.AddAntEnglishData(ConnectionString);

            var ytDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IYouTubeService));
            if (ytDescriptor != null) services.Remove(ytDescriptor);
            services.AddSingleton(YouTube);

            services.AddAuthentication("Test")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });
        });
    }
}

public class TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.ContainsKey("Authorization"))
            return Task.FromResult(AuthenticateResult.NoResult());

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "00000000-0000-0000-0000-000000000001"),
            new Claim("sub", "00000000-0000-0000-0000-000000000001"),
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "Test");
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
