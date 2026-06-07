using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Services.Services;

public class SavedService(AntDbContext db) : ISavedService
{
    public Task<List<SavedItem>> GetSavedAsync(Guid userId) =>
        db.SavedSentences
            .Where(ss => ss.UserId == userId)
            .OrderByDescending(ss => ss.SavedAt)
            .Select(ss => new SavedItem(
                ss.SentenceId,
                ss.Sentence.Text,
                ss.Sentence.Translation,
                ss.Sentence.Video.Title,
                ss.Sentence.VideoId,
                ss.Note,
                ss.SavedAt))
            .ToListAsync();

    public async Task<bool> SaveAsync(Guid userId, Guid sentenceId)
    {
        var exists = await db.SavedSentences
            .AnyAsync(ss => ss.UserId == userId && ss.SentenceId == sentenceId);

        if (exists) return false;

        db.SavedSentences.Add(new SavedSentence
        {
            UserId       = userId,
            SentenceId   = sentenceId,
            SavedAt      = DateTimeOffset.UtcNow,
            NextReviewAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveAsync(Guid userId, Guid sentenceId)
    {
        var row = await db.SavedSentences
            .FirstOrDefaultAsync(ss => ss.UserId == userId && ss.SentenceId == sentenceId);

        if (row is null) return false;

        db.SavedSentences.Remove(row);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateNoteAsync(Guid userId, Guid sentenceId, string? note)
    {
        var row = await db.SavedSentences
            .FirstOrDefaultAsync(ss => ss.UserId == userId && ss.SentenceId == sentenceId);

        if (row is null) return false;

        row.Note = note;
        await db.SaveChangesAsync();
        return true;
    }
}
