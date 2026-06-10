using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace AntEnglish.Tests.Integration;

[Collection("Integration")]
public class ImportController_test : IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;
    private static readonly Guid TestUserId = new("00000000-0000-0000-0000-000000000001");

    public ImportController_test(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");
    }

    public async Task InitializeAsync() => await _fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    // ── POST /api/videos/import ───────────────────────────────────────────────

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
