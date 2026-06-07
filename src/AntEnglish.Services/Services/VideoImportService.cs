using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AntEnglish.Services.Services;

public class VideoImportService(
    AntDbContext db,
    ITranscriptService transcript,
    IDeepLService deepL,
    ILogger<VideoImportService> logger) : IVideoImportService
{
    public async Task<ExistingVideoInfo?> FindExistingAsync(string youtubeId)
    {
        var video = await db.Videos
            .Where(v => v.YoutubeId == youtubeId)
            .Select(v => new { v.Id, v.TranscriptStatus })
            .FirstOrDefaultAsync();

        return video is null ? null : new ExistingVideoInfo(video.Id, video.TranscriptStatus);
    }

    public async Task EnsureUserLinkAsync(Guid userId, Guid videoId)
    {
        var exists = await db.UserVideos
            .AnyAsync(uv => uv.UserId == userId && uv.VideoId == videoId);

        if (exists) return;

        db.UserVideos.Add(new UserVideo { UserId = userId, VideoId = videoId });
        await db.SaveChangesAsync();
    }

    public async Task<Guid> CreateAndLinkAsync(
        Guid userId, string youtubeId, string title, string? thumbnailUrl, int? durationSeconds, string? ccType)
    {
        var video = new Video
        {
            YoutubeId        = youtubeId,
            Title            = title,
            ThumbnailUrl     = thumbnailUrl,
            DurationSeconds  = durationSeconds,
            CcType           = ccType,
            TranscriptStatus = "queued",
        };

        db.Videos.Add(video);
        db.UserVideos.Add(new UserVideo { UserId = userId, VideoId = video.Id });
        await db.SaveChangesAsync();

        return video.Id;
    }

    public async Task<(Guid Id, string TranscriptStatus)?> GetJobStatusAsync(Guid userId, Guid jobId)
    {
        var video = await db.UserVideos
            .Where(uv => uv.UserId == userId && uv.VideoId == jobId)
            .Select(uv => new { uv.Video.Id, uv.Video.TranscriptStatus })
            .FirstOrDefaultAsync();

        return video is null ? null : (video.Id, video.TranscriptStatus);
    }

    public async Task ProcessImportAsync(Guid videoId)
    {
        await db.Videos
            .Where(v => v.Id == videoId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "processing"));

        try
        {
            var video = await db.Videos.FindAsync(videoId)
                ?? throw new InvalidOperationException($"Video {videoId} not found");

            var lines = await transcript.GetTranscriptAsync(video.YoutubeId);
            if (lines.Count == 0)
                throw new InvalidOperationException("No transcript lines returned");

            var translations = await deepL.TranslateBatchAsync(lines.Select(l => l.Text).ToList());

            var sentences = lines.Select((l, i) => new Sentence
            {
                VideoId     = videoId,
                Index       = i,
                Text        = l.Text,
                Translation = translations[i],
                StartTimeMs = l.StartMs,
                EndTimeMs   = l.EndMs,
            }).ToList();

            await db.Sentences.AddRangeAsync(sentences);

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
            logger.LogError(ex, "Import failed for {VideoId}", videoId);

            await db.Videos
                .Where(v => v.Id == videoId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "failed"));

            await db.SaveChangesAsync();
            throw;
        }
    }
}
