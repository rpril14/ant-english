namespace AntEnglish.Services.Interfaces;

public record ProgressResult(
    Guid SentenceId,
    int Score,
    int HintLevelUsed,
    DateTimeOffset? CompletedAt);

public interface IProgressService
{
    Task<ProgressResult> UpsertAsync(Guid userId, Guid sentenceId, int score, int hintLevelUsed, bool completed);
    Task<List<ProgressResult>> GetForVideoAsync(Guid userId, Guid videoId);
}
