using AntEnglish.Data;
using AntEnglish.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace AntEnglish.Tests.Integration;

[Collection("Integration")]
public class LibraryController_test : IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;
    private static readonly Guid TestUserId = new("00000000-0000-0000-0000-000000000001");

    public LibraryController_test(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");
    }

    public async Task InitializeAsync() => await _fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    // ── GET /api/library ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetLibrary_WithVideo_ReturnsItemForThatVideo()
    {
        // Arrange
        var (videoId, _) = await SeedVideoInLibraryAsync("Library Test Video");

        // Act
        var res = await _client.GetAsync("/api/library");
        var body = await res.Content.ReadFromJsonAsync<List<LibraryItemBody>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var item = Assert.Single(body!.Where(x => x.VideoId == videoId));
        Assert.Equal("Library Test Video", item.Title);
        Assert.Equal("ready", item.TranscriptStatus);
        Assert.False(item.IsFavorited);
        Assert.Equal(0, item.PracticedCount);
    }

    [Fact]
    public async Task GetLibrary_OtherUsersVideo_NotInResponse()
    {
        // Arrange — seed a video owned by a different user
        var otherUserId = Guid.NewGuid();
        Guid otherVideoId;
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
            var video = new Video
            {
                YoutubeId = Guid.NewGuid().ToString()[..11],
                Title = "Isolation Test Video",
                TranscriptStatus = "ready"
            };
            db.Videos.Add(video);
            db.UserVideos.Add(new UserVideo { UserId = otherUserId, VideoId = video.Id, AddedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
            otherVideoId = video.Id;
        }

        // Act — authenticated as TestUserId
        var res = await _client.GetAsync("/api/library");
        var body = await res.Content.ReadFromJsonAsync<List<LibraryItemBody>>();

        // Assert — TestUser does not see the other user's video
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.DoesNotContain(body!, x => x.VideoId == otherVideoId);
    }

    // ── POST /api/library/{videoId}/favorite ──────────────────────────────────

    [Fact]
    public async Task ToggleFavorite_UnfavoritedVideo_SetsFavoriteTrue()
    {
        // Arrange
        var (videoId, _) = await SeedVideoInLibraryAsync(isFavorited: false);

        // Act
        var res = await _client.PostAsync($"/api/library/{videoId}/favorite", new StringContent(""));
        var body = await res.Content.ReadFromJsonAsync<FavoriteBody>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.True(body!.IsFavorited);
    }

    [Fact]
    public async Task ToggleFavorite_FavoritedVideo_SetsFavoriteFalse()
    {
        // Arrange
        var (videoId, _) = await SeedVideoInLibraryAsync(isFavorited: true);

        // Act
        var res = await _client.PostAsync($"/api/library/{videoId}/favorite", new StringContent(""));
        var body = await res.Content.ReadFromJsonAsync<FavoriteBody>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.False(body!.IsFavorited);
    }

    [Fact]
    public async Task ToggleFavorite_VideoNotInLibrary_Returns404()
    {
        // Act
        var res = await _client.PostAsync($"/api/library/{Guid.NewGuid()}/favorite", new StringContent(""));

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ── DELETE /api/library/{videoId} ─────────────────────────────────────────

    [Fact]
    public async Task Remove_OwnedVideo_Returns204AndDeletesLink()
    {
        // Arrange
        var (videoId, _) = await SeedVideoInLibraryAsync();

        // Act
        var res = await _client.DeleteAsync($"/api/library/{videoId}");

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
        var stillLinked = await db.UserVideos.AnyAsync(uv => uv.UserId == TestUserId && uv.VideoId == videoId);
        Assert.False(stillLinked);
    }

    [Fact]
    public async Task Remove_VideoNotInLibrary_Returns404()
    {
        // Act
        var res = await _client.DeleteAsync($"/api/library/{Guid.NewGuid()}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<(Guid videoId, Guid userVideoId)> SeedVideoInLibraryAsync(
        string title = "Test Video",
        bool isFavorited = false)
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();

        var video = new Video
        {
            YoutubeId = Guid.NewGuid().ToString()[..11],
            Title = title,
            TranscriptStatus = "ready"
        };
        db.Videos.Add(video);

        var userVideo = new UserVideo
        {
            UserId = TestUserId,
            VideoId = video.Id,
            AddedAt = DateTimeOffset.UtcNow,
            IsFavorited = isFavorited
        };
        db.UserVideos.Add(userVideo);
        await db.SaveChangesAsync();

        return (video.Id, userVideo.Id);
    }

    private record LibraryItemBody(
        Guid VideoId,
        string Title,
        string? ThumbnailUrl,
        int? DurationSeconds,
        string TranscriptStatus,
        int SentenceCount,
        int PracticedCount,
        bool IsFavorited,
        string[] CustomTags,
        DateTimeOffset AddedAt,
        DateTimeOffset? LastStudiedAt);

    private record FavoriteBody(bool IsFavorited);
}
