using System.Collections.Concurrent;
using AntEnglish.Data;
using AntEnglish.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Workers;

public class ImportWorker(IServiceScopeFactory scopeFactory, ILogger<ImportWorker> logger) : BackgroundService
{
    private const int PollIntervalMs = 5000;
    private const int BatchSize = 10;
    private readonly ConcurrentDictionary<Guid, bool> _inFlight = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ResetStuckJobsAsync();

        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();

            var pending = await db.Videos
                .Where(v => v.TranscriptStatus == "queued")
                .OrderBy(v => v.CreatedAt)
                .Select(v => v.Id)
                .Take(BatchSize)
                .ToListAsync(stoppingToken);

            var newJobs = pending.Where(id => !_inFlight.ContainsKey(id)).ToList();

            if (newJobs.Count == 0)
            {
                await Task.Delay(PollIntervalMs, stoppingToken);
                continue;
            }

            foreach (var videoId in newJobs)
            {
                if (_inFlight.TryAdd(videoId, true))
                    _ = ProcessAsync(videoId, stoppingToken);
            }
        }
    }

    private async Task ProcessAsync(Guid videoId, CancellationToken stoppingToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var importService = scope.ServiceProvider.GetRequiredService<IVideoImportService>();
            await importService.ProcessImportAsync(videoId);
            logger.LogInformation("Completed import for video {VideoId}", videoId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Import failed for video {VideoId}", videoId);
        }
        finally
        {
            _inFlight.TryRemove(videoId, out _);
        }
    }

    private async Task ResetStuckJobsAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AntDbContext>();

        var count = await db.Videos
            .Where(v => v.TranscriptStatus == "processing")
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.TranscriptStatus, "queued"));

        if (count > 0)
            logger.LogInformation("Reset {Count} stuck jobs on startup", count);
    }
}
