using AntEnglish.Data;
using AntEnglish.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace AntEnglish.Tests.Integration;

[Collection("Integration")]
public class SavedController_test : IAsyncLifetime
{
    private readonly IntegrationFixture _fixture;
    private readonly HttpClient _client;
    private static readonly Guid TestUserId = new("00000000-0000-0000-0000-000000000001");

    public SavedController_test(IntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.CreateClient();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");
    }

    public async Task InitializeAsync() => await _fixture.ResetAsync();
    public Task DisposeAsync() => Task.CompletedTask;

    // ── GET /api/saved ────────────────────────────────────────────────────────

    [Fact]
    public async Task GetSaved_WithSavedSentence_ReturnsItemForThatSentence()
    {
        // Arrange
        var (sentenceId, videoId) = await SeedSentenceAsync("Hello world.");
        await SaveSentenceAsync(sentenceId);

        // Act
        var res = await _client.GetAsync("/api/saved");
        var body = await res.Content.ReadFromJsonAsync<List<SavedItemBody>>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var item = Assert.Single(body!.Where(x => x.SentenceId == sentenceId));
        Assert.Equal("Hello world.", item.Text);
        Assert.Equal(videoId, item.VideoId);
        Assert.Null(item.Note);
    }

    [Fact]
    public async Task GetSaved_OtherUsersSentence_NotInResponse()
    {
        // Arrange — seed a saved sentence for another user directly via EF
        var (sentenceId, _) = await SeedSentenceAsync();
        var otherUserId = Guid.NewGuid();
        using (var scope = _fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
            db.SavedSentences.Add(new SavedSentence
            {
                UserId = otherUserId,
                SentenceId = sentenceId,
                SavedAt = DateTimeOffset.UtcNow,
                NextReviewAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        // Act — authenticated as TestUserId
        var res = await _client.GetAsync("/api/saved");
        var body = await res.Content.ReadFromJsonAsync<List<SavedItemBody>>();

        // Assert — TestUser does not see the other user's saved sentence
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.DoesNotContain(body!, x => x.SentenceId == sentenceId);
    }

    // ── POST /api/saved ───────────────────────────────────────────────────────

    [Fact]
    public async Task Save_ValidSentence_Returns201()
    {
        // Arrange
        var (sentenceId, _) = await SeedSentenceAsync();

        // Act
        var res = await _client.PostAsJsonAsync("/api/saved", sentenceId);

        // Assert
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
        var saved = await db.SavedSentences.AnyAsync(
            ss => ss.UserId == TestUserId && ss.SentenceId == sentenceId);
        Assert.True(saved);
    }

    [Fact]
    public async Task Save_AlreadySaved_Returns409()
    {
        // Arrange
        var (sentenceId, _) = await SeedSentenceAsync();
        await SaveSentenceAsync(sentenceId);

        // Act — save the same sentence again
        var res = await _client.PostAsJsonAsync("/api/saved", sentenceId);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
    }

    // ── DELETE /api/saved/{sentenceId} ────────────────────────────────────────

    [Fact]
    public async Task Remove_SavedSentence_Returns204AndDeletesRow()
    {
        // Arrange
        var (sentenceId, _) = await SeedSentenceAsync();
        await SaveSentenceAsync(sentenceId);

        // Act
        var res = await _client.DeleteAsync($"/api/saved/{sentenceId}");

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
        var stillSaved = await db.SavedSentences.AnyAsync(
            ss => ss.UserId == TestUserId && ss.SentenceId == sentenceId);
        Assert.False(stillSaved);
    }

    [Fact]
    public async Task Remove_SentenceNotSaved_Returns404()
    {
        // Arrange — a sentence that exists but was never saved
        var (sentenceId, _) = await SeedSentenceAsync();

        // Act
        var res = await _client.DeleteAsync($"/api/saved/{sentenceId}");

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ── PATCH /api/saved/{sentenceId}/note ────────────────────────────────────

    [Fact]
    public async Task UpdateNote_SavedSentence_PersistsNote()
    {
        // Arrange
        var (sentenceId, _) = await SeedSentenceAsync();
        await SaveSentenceAsync(sentenceId);

        // Act
        var res = await _client.PatchAsJsonAsync(
            $"/api/saved/{sentenceId}/note",
            new { note = "my vocabulary note" });
        var body = await res.Content.ReadFromJsonAsync<NoteBody>();

        // Assert
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal("my vocabulary note", body!.Note);

        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();
        var row = await db.SavedSentences.SingleAsync(
            ss => ss.UserId == TestUserId && ss.SentenceId == sentenceId);
        Assert.Equal("my vocabulary note", row.Note);
    }

    [Fact]
    public async Task UpdateNote_SentenceNotSaved_Returns404()
    {
        // Arrange — a sentence that exists but was never saved
        var (sentenceId, _) = await SeedSentenceAsync();

        // Act
        var res = await _client.PatchAsJsonAsync(
            $"/api/saved/{sentenceId}/note",
            new { note = "should not persist" });

        // Assert
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<(Guid sentenceId, Guid videoId)> SeedSentenceAsync(string text = "Test sentence.")
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
            Text = text,
            StartTimeMs = 0,
            EndTimeMs = 2000,
            NamedEntities = []
        };
        db.Sentences.Add(sentence);
        await db.SaveChangesAsync();

        return (sentence.Id, video.Id);
    }

    private async Task SaveSentenceAsync(Guid sentenceId)
    {
        var res = await _client.PostAsJsonAsync("/api/saved", sentenceId);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }

    private record SavedItemBody(
        Guid SentenceId,
        string Text,
        string? Translation,
        string VideoTitle,
        Guid VideoId,
        string? Note,
        DateTimeOffset SavedAt);

    private record NoteBody(string? Note);
}
