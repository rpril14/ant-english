namespace AntEnglish.Services.Interfaces;

public record ExistingVideoInfo(Guid Id, string TranscriptStatus);

public interface IVideoImportService
{
    Task<ExistingVideoInfo?> FindExistingAsync(string youtubeId);
    Task EnsureUserLinkAsync(Guid userId, Guid videoId);
    Task<Guid> CreateAndLinkAsync(Guid userId, string youtubeId, string title, string? thumbnailUrl, int? durationSeconds, string? ccType);
    Task ProcessImportAsync(Guid videoId);
    Task<(Guid Id, string TranscriptStatus)?> GetJobStatusAsync(Guid jobId);
}
