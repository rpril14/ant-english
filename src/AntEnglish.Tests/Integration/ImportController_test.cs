using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.EntityFrameworkCore.InMemory.Infrastructure.Internal;
using Microsoft.Extensions.Configuration;

namespace AntEnglish.Tests.Integration;

/// <summary>
/// Spins up the real ASP.NET pipeline with an in-memory DB and mocked external services.
/// JWT auth is disabled so tests can focus on controller logic.
/// </summary>
public class ImportController_test : IClassFixture<ImportControllerFixture>
{
    private readonly HttpClient _client;
    private readonly ImportControllerFixture _fixture;
    private static readonly Guid TestUserId = new("00000000-0000-0000-0000-000000000001");

    public ImportController_test(ImportControllerFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
        // Inject a fake JWT so [Authorize] passes
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Test");
    }

    [Fact]
    public async Task Import_InvalidUrl_Returns400WithMessage()
    {
        // Arrange
        var req = new { url = "https://vimeo.com/123456" };

        // Act
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);
        var body = await res.Content.ReadFromJsonAsync<ErrorBody>();

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("Invalid URL — please paste a YouTube link", body!.Message);
    }

    [Fact]
    public async Task Import_VideoNotFound_Returns404()
    {
        // Arrange
        _fixture.YouTube.GetVideoMetaAsync(Arg.Any<string>()).Returns((VideoMeta?)null);
        var req = new { url = "https://youtu.be/notfound1234" };

        // Act
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    [Fact]
    public async Task Import_PrivateVideo_Returns403()
    {
        // Arrange
        _fixture.YouTube.GetVideoMetaAsync(Arg.Any<string>()).Returns(
            new VideoMeta("Private Video", null, 120, IsPublic: false, HasEnglishCc: true, CcType: "standard"));
        var req = new { url = "https://youtu.be/private1234" };

        // Act
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task Import_NoEnglishCc_Returns400()
    {
        // Arrange
        _fixture.YouTube.GetVideoMetaAsync(Arg.Any<string>()).Returns(
            new VideoMeta("No CC Video", null, 120, IsPublic: true, HasEnglishCc: false, CcType: null));
        var req = new { url = "https://youtu.be/nocc1234567" };

        // Act
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);
        var body = await res.Content.ReadFromJsonAsync<ErrorBody>();

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("no English captions", body!.Message);
    }

    [Fact]
    public async Task Import_ValidVideo_Returns200WithJobId()
    {
        // Arrange
        _fixture.YouTube.GetVideoMetaAsync(Arg.Any<string>()).Returns(
            new VideoMeta("Test Video", "https://img.youtube.com/thumb.jpg", 300,
                IsPublic: true, HasEnglishCc: true, CcType: "standard"));
        var req = new { url = "https://youtu.be/validvideo1" };

        // Act
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);
        var body = await res.Content.ReadFromJsonAsync<ImportBody>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.NotEqual(Guid.Empty, body!.JobId);
        Assert.Equal("queued", body.Status);
    }

    [Fact]
    public async Task Import_DuplicateQueuedVideo_ReturnsExistingJobId()
    {
        // Arrange — import once to create the queued record
        var youtubeId = "dupQueue001";
        _fixture.YouTube.GetVideoMetaAsync(Arg.Any<string>()).Returns(
            new VideoMeta("Dup Video", null, 120, IsPublic: true, HasEnglishCc: true, CcType: "standard"));

        var req = new { url = $"https://youtu.be/{youtubeId}" };
        var first = await _client.PostAsJsonAsync("/api/videos/import", req);
        var firstBody = await first.Content.ReadFromJsonAsync<ImportBody>();

        // Act — import the same URL again
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);
        var body = await res.Content.ReadFromJsonAsync<ImportBody>();

        // Assert — same job ID returned, status still queued
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("queued", body!.Status);
        Assert.Equal(firstBody!.JobId, body.JobId);
    }

    [Fact]
    public async Task Import_DuplicateQueuedVideo_LinksCurrentUserToExistingJob()
    {
        // Arrange - an existing queued import created by another user
        var youtubeId = "linkQueue01";
        var otherUserId = Guid.NewGuid();
        Guid videoId;

        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
            var video = new Video
            {
                YoutubeId = youtubeId,
                Title = "Shared queued video",
                TranscriptStatus = "queued"
            };

            db.Videos.Add(video);
            db.UserVideos.Add(new UserVideo { UserId = otherUserId, VideoId = video.Id });
            await db.SaveChangesAsync();
            videoId = video.Id;
        }

        // Act
        var res = await _client.PostAsJsonAsync("/api/videos/import", new { url = $"https://youtu.be/{youtubeId}" });

        // Assert
        var body = await res.Content.ReadFromJsonAsync<ImportBody>();
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(videoId, body!.JobId);

        using var assertScope = _fixture.Services.CreateScope();
        var assertDb = assertScope.ServiceProvider.GetRequiredService<AntDbContext>();
        var linked = await assertDb.UserVideos
            .AnyAsync(uv => uv.UserId == TestUserId && uv.VideoId == videoId);
        Assert.True(linked);
    }

    [Fact]
    public async Task Import_DuplicateReadyVideo_ReturnsReadyImmediately()
    {
        // Arrange — import once, then manually mark as ready via EF
        var youtubeId = "dupReady001";
        _fixture.YouTube.GetVideoMetaAsync(Arg.Any<string>()).Returns(
            new VideoMeta("Ready Video", null, 120, IsPublic: true, HasEnglishCc: true, CcType: "standard"));

        var req = new { url = $"https://youtu.be/{youtubeId}" };
        await _client.PostAsJsonAsync("/api/videos/import", req);

        // Update status to "ready" in the same in-memory DB the HTTP pipeline uses
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
            var video = await db.Videos.FirstOrDefaultAsync(v => v.YoutubeId == youtubeId);
            Assert.NotNull(video);
            video.TranscriptStatus = "ready";
            await db.SaveChangesAsync();
        }

        // Act — import same URL again
        var res = await _client.PostAsJsonAsync("/api/videos/import", req);
        var body = await res.Content.ReadFromJsonAsync<ImportBody>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("ready", body!.Status);
    }

    [Fact]
    public async Task GetJobStatus_UnownedJob_Returns404()
    {
        // Arrange
        Guid videoId;
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
            var video = new Video
            {
                YoutubeId = "unownedjob1",
                Title = "Unowned job",
                TranscriptStatus = "processing"
            };

            db.Videos.Add(video);
            db.UserVideos.Add(new UserVideo { UserId = Guid.NewGuid(), VideoId = video.Id });
            await db.SaveChangesAsync();
            videoId = video.Id;
        }

        // Act
        var res = await _client.GetAsync($"/api/jobs/{videoId}/status");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    private record ErrorBody(string Message);
    private record ImportBody(Guid JobId, Guid? VideoId, string Status);
}

public class ImportControllerFixture : WebApplicationFactory<Program>
{
    public IYouTubeService YouTube { get; } = Substitute.For<IYouTubeService>();
    private static readonly Microsoft.EntityFrameworkCore.Storage.InMemoryDatabaseRoot _dbRoot = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Supabase:Url"] = "https://test.supabase.co",
                ["ConnectionStrings:DefaultConnection"] = "DataSource=:memory:",
            });
        });
        builder.ConfigureServices(services =>
        {
            // Remove all AntDbContext and DbContextOptions registrations so AddDbContext below wins
            var toRemove = services
                .Where(d => d.ServiceType == typeof(DbContextOptions<AntDbContext>)
                         || d.ServiceType == typeof(AntDbContext))
                .ToList();
            foreach (var d in toRemove) services.Remove(d);

            services.AddDbContext<AntDbContext>(options =>
                options.UseInMemoryDatabase("TestDb", _dbRoot));

            // Replace real YouTube service with mock
            var ytDescriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(IYouTubeService));
            if (ytDescriptor != null) services.Remove(ytDescriptor);
            services.AddSingleton(YouTube);

            // Replace JWT with a test scheme that always authenticates as a fixed user
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
