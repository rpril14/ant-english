using AntEnglish.Data;
using AntEnglish.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace AntEnglish.Tests.Integration;

[Collection("Integration")]
public class ProgressController_test : IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;
    private static readonly Guid TestUserId = new("00000000-0000-0000-0000-000000000001");

    public ProgressController_test(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");
    }

    public async Task InitializeAsync() => await _fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    // ── POST /api/progress ────────────────────────────────────────────────────

    [Fact]
    public async Task Upsert_NewSentence_CreatesProgressRecord()
    {
        // Arrange
        var (_, sentenceId) = await SeedVideoWithSentenceAsync();
        var req = new { sentenceId, score = 80, hintLevelUsed = 0, completed = true };

        // Act
        var res = await _client.PostAsJsonAsync("/api/progress", req);
        var body = await res.Content.ReadFromJsonAsync<ProgressBody>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(sentenceId, body!.SentenceId);
        Assert.Equal(80, body.Score);
        Assert.NotNull(body.CompletedAt);
    }

    [Fact]
    public async Task Upsert_SameSentenceTwice_UpdatesExistingRecord()
    {
        // Arrange
        var (_, sentenceId) = await SeedVideoWithSentenceAsync();
        var first = new { sentenceId, score = 60, hintLevelUsed = 0, completed = false };
        var second = new { sentenceId, score = 95, hintLevelUsed = 1, completed = true };

        // Act
        await _client.PostAsJsonAsync("/api/progress", first);
        var res = await _client.PostAsJsonAsync("/api/progress", second);
        var body = await res.Content.ReadFromJsonAsync<ProgressBody>();

        // Assert — record updated, not duplicated
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(95, body!.Score);
        Assert.Equal(1, body.HintLevelUsed);
        Assert.NotNull(body.CompletedAt);

        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
        var count = await db.UserProgresses.CountAsync(p => p.SentenceId == sentenceId);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task Upsert_Unauthorised_Returns401()
    {
        // Arrange
        var (_, sentenceId) = await SeedVideoWithSentenceAsync();
        var anonClient = _fixture.CreateClient();
        var req = new { sentenceId, score = 80, hintLevelUsed = 0, completed = true };

        // Act
        var res = await anonClient.PostAsJsonAsync("/api/progress", req);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── GET /api/progress/{videoId} ───────────────────────────────────────────

    [Fact]
    public async Task GetForVideo_WithProgress_ReturnsProgressList()
    {
        // Arrange
        var (videoId, sentenceId) = await SeedVideoWithSentenceAsync();
        await _client.PostAsJsonAsync("/api/progress",
            new { sentenceId, score = 90, hintLevelUsed = 0, completed = true });

        // Act
        var res = await _client.GetAsync($"/api/progress/{videoId}");
        var body = await res.Content.ReadFromJsonAsync<List<ProgressBody>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Single(body!);
        Assert.Equal(sentenceId, body[0].SentenceId);
        Assert.Equal(90, body[0].Score);
    }

    [Fact]
    public async Task GetForVideo_NoProgress_ReturnsEmptyArray()
    {
        // Arrange
        var (videoId, _) = await SeedVideoWithSentenceAsync();

        // Act
        var res = await _client.GetAsync($"/api/progress/{videoId}");
        var body = await res.Content.ReadFromJsonAsync<List<ProgressBody>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Empty(body!);
    }

    [Fact]
    public async Task GetForVideo_OtherUsersProgress_NotReturned()
    {
        // Arrange — seed progress directly as a different user
        var (videoId, sentenceId) = await SeedVideoWithSentenceAsync();
        var otherUserId = Guid.NewGuid();

        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
            db.UserProgresses.Add(new UserProgress
            {
                UserId = otherUserId,
                SentenceId = sentenceId,
                FinalScore = 100,
                CompletedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Act — authenticated as TestUserId, not otherUserId
        var res = await _client.GetAsync($"/api/progress/{videoId}");
        var body = await res.Content.ReadFromJsonAsync<List<ProgressBody>>();

        // Assert — TestUser sees no progress
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Empty(body!);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<(Guid videoId, Guid sentenceId)> SeedVideoWithSentenceAsync()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();

        var video = new Video
        {
            YoutubeId = Guid.NewGuid().ToString()[..11],
            Title = "Test Video",
            TranscriptStatus = "ready"
        };
        db.Videos.Add(video);

        var sentence = new Sentence
        {
            VideoId = video.Id,
            Index = 0,
            Text = "Hello world.",
            StartTimeMs = 0,
            EndTimeMs = 2000,
            NamedEntities = []
        };
        db.Sentences.Add(sentence);
        await db.SaveChangesAsync();

        return (video.Id, sentence.Id);
    }

    private record ProgressBody(
        Guid SentenceId,
        int? Score,
        int HintLevelUsed,
        DateTimeOffset? CompletedAt);
}
