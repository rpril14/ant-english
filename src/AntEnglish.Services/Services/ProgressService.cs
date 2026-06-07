using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Services.Services;

public class ProgressService(AntDbContext db) : IProgressService
{
    public async Task<ProgressResult> UpsertAsync(
        Guid userId, Guid sentenceId, int score, int hintLevelUsed, bool completed)
    {
        var progress = await db.UserProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.SentenceId == sentenceId);

        if (progress is null)
        {
            progress = new UserProgress
            {
                UserId        = userId,
                SentenceId    = sentenceId,
                Attempts      = 1,
                FinalScore    = score,
                HintLevelUsed = hintLevelUsed,
                CompletedAt   = completed ? DateTimeOffset.UtcNow : null,
            };
            db.UserProgresses.Add(progress);
        }
        else
        {
            progress.Attempts++;
            progress.FinalScore    = score;
            progress.HintLevelUsed = hintLevelUsed;
            if (completed) progress.CompletedAt ??= DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        return new ProgressResult(progress.SentenceId, progress.FinalScore ?? 0, progress.HintLevelUsed, progress.CompletedAt);
    }

    public Task<List<ProgressResult>> GetForVideoAsync(Guid userId, Guid videoId) =>
        db.UserProgresses
            .Where(p => p.UserId == userId && p.Sentence.VideoId == videoId)
            .Select(p => new ProgressResult(p.SentenceId, p.FinalScore ?? 0, p.HintLevelUsed, p.CompletedAt))
            .ToListAsync();
}
