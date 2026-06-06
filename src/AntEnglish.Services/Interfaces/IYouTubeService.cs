namespace AntEnglish.Services.Interfaces;

public record VideoMeta(
    string Title,
    string? ThumbnailUrl,
    int? DurationSeconds,
    bool IsPublic,
    bool HasEnglishCc,
    string? CcType  // "standard" | "asr" | null
);

public interface IYouTubeService
{
    /// <summary>Returns null if video is not found or not accessible.</summary>
    Task<VideoMeta?> GetVideoMetaAsync(string youtubeId);
}
