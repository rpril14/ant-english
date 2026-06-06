using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Jobs;

public class CcImportJob(
    AntDbContext db,
    ITranscriptService transcript,
    IDeepLService deepL,
    ILogger<CcImportJob> logger)
{
    public async Task RunAsync(Guid videoId)
    {
        await db.Videos
            .Where(v => v.Id == videoId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "processing"));

        try
        {
            var video = await db.Videos.FindAsync(videoId)
                ?? throw new InvalidOperationException($"Video {videoId} not found");

            // 1. Fetch transcript lines
            var lines = await transcript.GetTranscriptAsync(video.YoutubeId);
            if (lines.Count == 0)
                throw new InvalidOperationException("No transcript lines returned");

            // 2. Translate (degrades gracefully on quota exceeded)
            var translations = await deepL.TranslateBatchAsync(
                lines.Select(l => l.Text).ToList());

            // 3. Bulk insert sentences
            var sentences = lines.Select((l, i) => new Sentence
            {
                VideoId     = videoId,
                Index       = i,
                Text        = l.Text,
                Translation = translations[i],
                StartTimeMs = l.StartMs,
                EndTimeMs   = l.EndMs
            }).ToList();

            await db.Sentences.AddRangeAsync(sentences);

            // 4. Mark ready
            await db.Videos
                .Where(v => v.Id == videoId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(v => v.TranscriptStatus, "ready")
                    .SetProperty(v => v.SentenceCount, lines.Count));

            await db.SaveChangesAsync();

            logger.LogInformation("Import complete: {VideoId} — {Count} sentences", videoId, lines.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "CcImportJob failed for {VideoId}", videoId);

            await db.Videos
                .Where(v => v.Id == videoId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "failed"));

            await db.SaveChangesAsync();
            throw;
        }
    }
}
