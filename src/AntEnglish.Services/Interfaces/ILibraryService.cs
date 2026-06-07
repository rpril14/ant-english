namespace AntEnglish.Services.Interfaces;

public record LibraryItem(
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

public interface ILibraryService
{
    Task<List<LibraryItem>> GetLibraryAsync(Guid userId);
    /// <summary>Returns the new IsFavorited value, or null if the video is not in the user's library.</summary>
    Task<bool?> ToggleFavoriteAsync(Guid userId, Guid videoId);
    /// <summary>Returns false if the video is not in the user's library.</summary>
    Task<bool> RemoveAsync(Guid userId, Guid videoId);
}
