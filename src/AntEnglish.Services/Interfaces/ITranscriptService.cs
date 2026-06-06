namespace AntEnglish.Services.Interfaces;

public record TranscriptLine(string Text, int StartMs, int EndMs);

public interface ITranscriptService
{
    /// <summary>
    /// Returns ordered transcript lines for a YouTube video.
    /// Throws if the transcript cannot be retrieved.
    /// </summary>
    Task<IReadOnlyList<TranscriptLine>> GetTranscriptAsync(string youtubeId, CancellationToken ct = default);
}
