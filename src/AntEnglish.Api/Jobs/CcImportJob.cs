using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Jobs;

public class CcImportJob(
    AntDbContext db,
    IYtDlpService ytDlp,
    ISrtParser parser,
    IDeepLService deepL,
    ILogger<CcImportJob> logger)
{
    public async Task RunAsync(Guid videoId)
    {
        await db.Videos
            .Where(v => v.Id == videoId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "processing"));

        string? subtitleFile = null;
        try
        {
            var video = await db.Videos.FindAsync(videoId)
                ?? throw new InvalidOperationException($"Video {videoId} not found");

            // 1. Download subtitle
            subtitleFile = await ytDlp.DownloadSubtitleAsync(video.YoutubeId);

            // 2. Parse into sentences
            var parsed = parser.Parse(subtitleFile);
            if (parsed.Count == 0)
                throw new InvalidOperationException("Subtitle file contained no parseable sentences");

            // 3. Translate (degrades gracefully on quota exceeded)
            var translations = await deepL.TranslateBatchAsync(
                parsed.Select(s => s.Text).ToList());

            // 4. Bulk insert sentences
            var sentences = parsed.Select((s, i) => new Sentence
            {
                VideoId     = videoId,
                Index       = i,
                Text        = s.Text,
                Translation = translations[i],
                StartTimeMs = s.StartMs,
                EndTimeMs   = s.EndMs
            }).ToList();

            await db.Sentences.AddRangeAsync(sentences);

            // 5. Mark ready
            await db.Videos
                .Where(v => v.Id == videoId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(v => v.TranscriptStatus, "ready")
                    .SetProperty(v => v.SentenceCount, parsed.Count));

            await db.SaveChangesAsync();

            logger.LogInformation("Import complete: {VideoId} — {Count} sentences", videoId, parsed.Count);

            // 6. Broadcast via Supabase Realtime (frontend card update without page refresh)
            await BroadcastReadyAsync(videoId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "CcImportJob failed for {VideoId}", videoId);

            await db.Videos
                .Where(v => v.Id == videoId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "failed"));

            await db.SaveChangesAsync();
            throw; // Hangfire will retry per its retry policy
        }
        finally
        {
            // Clean up temp subtitle file
            if (subtitleFile is not null && File.Exists(subtitleFile))
                File.Delete(subtitleFile);
        }
    }

    private async Task BroadcastReadyAsync(Guid videoId)
    {
        // Supabase Realtime broadcast via REST API
        // Frontend useVideoReady hook listens on channel video:{videoId}
        try
        {
            var supabaseUrl = db.Database.GetConnectionString(); // placeholder
            // Real broadcast is done via supabase-js on the frontend subscription;
            // the DB status change to "ready" is what triggers the poll/realtime update.
            // For a proper server-side broadcast, use Supabase REST broadcast API.
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            // Non-fatal — frontend polling fallback handles this case
            logger.LogWarning(ex, "Supabase broadcast failed for {VideoId} — frontend will poll", videoId);
        }
    }
}
