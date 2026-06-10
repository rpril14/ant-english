using AntEnglish.Data;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Services.Services;

public class LibraryService(AntDbContext db) : ILibraryService
{
    public Task<List<LibraryItem>> GetLibraryAsync(Guid userId) =>
        db.UserVideos
            .Where(uv => uv.UserId == userId)
            .OrderByDescending(uv => uv.AddedAt)
            .Select(uv => new LibraryItem(
                uv.VideoId,
                uv.Video.Title,
                uv.Video.ThumbnailUrl,
                uv.Video.DurationSeconds,
                uv.Video.TranscriptStatus,
                uv.Video.SentenceCount,
                db.UserProgresses.Count(p =>
                    p.UserId == userId &&
                    p.Sentence.VideoId == uv.VideoId &&
                    p.CompletedAt != null),
                uv.IsFavorited,
                uv.CustomTags,
                uv.AddedAt,
                uv.LastStudiedAt))
            .ToListAsync();

    public async Task<bool?> ToggleFavoriteAsync(Guid userId, Guid videoId)
    {
        var uv = await db.UserVideos
            .FirstOrDefaultAsync(uv => uv.UserId == userId && uv.VideoId == videoId);

        if (uv is null) return null;

        uv.IsFavorited = !uv.IsFavorited;
        await db.SaveChangesAsync();
        return uv.IsFavorited;
    }

    public async Task<bool> RemoveAsync(Guid userId, Guid videoId)
    {
        var uv = await db.UserVideos
            .FirstOrDefaultAsync(uv => uv.UserId == userId && uv.VideoId == videoId);

        if (uv is null) return false;

        var sentenceIds = await db.Sentences
            .Where(s => s.VideoId == videoId)
            .Select(s => s.Id)
            .ToListAsync();

        if (sentenceIds.Count > 0)
        {
            await db.UserProgresses
                .Where(up => up.UserId == userId && sentenceIds.Contains(up.SentenceId))
                .ExecuteDeleteAsync();

            await db.SavedSentences
                .Where(ss => ss.UserId == userId && sentenceIds.Contains(ss.SentenceId))
                .ExecuteDeleteAsync();
        }

        db.UserVideos.Remove(uv);
        await db.SaveChangesAsync();

        return true;
    }
}
