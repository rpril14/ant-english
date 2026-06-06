using AntEnglish.Api.Extensions;
using AntEnglish.Api.Jobs;
using AntEnglish.Data;
using AntEnglish.Data.Entities;
using AntEnglish.Services.Interfaces;
using FluentValidation;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace AntEnglish.Api.Controllers;

public record ImportRequest(string Url);

public class ImportRequestValidator : AbstractValidator<ImportRequest>
{
    public ImportRequestValidator()
    {
        RuleFor(x => x.Url)
            .NotEmpty()
            .Must(BeValidYouTubeUrl)
            .WithMessage("Invalid URL — please paste a YouTube link");
    }

    private static bool BeValidYouTubeUrl(string url) =>
        YouTubeHelper.ExtractVideoId(url) is not null;
}

[ApiController]
[Route("api/videos")]
[Authorize]
public class ImportController(
    AntDbContext db,
    IYouTubeService youtube,
    IBackgroundJobClient jobs,
    IValidator<ImportRequest> validator) : ControllerBase
{
    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] ImportRequest req)
    {
        var validation = await validator.ValidateAsync(req);
        if (!validation.IsValid)
            return BadRequest(new { message = validation.Errors[0].ErrorMessage });

        var videoId = YouTubeHelper.ExtractVideoId(req.Url)!;
        var userId = User.GetUserId();

        // Duplicate check
        var existing = await db.Videos.FirstOrDefaultAsync(v => v.YoutubeId == videoId);

        if (existing is not null)
        {
            if (existing.TranscriptStatus == "ready")
            {
                await LinkVideoToUserAsync(userId, existing.Id);
                return Ok(new { videoId = existing.Id, status = "ready" });
            }
            if (existing.TranscriptStatus is "queued" or "processing")
                return Ok(new { jobId = existing.Id, status = existing.TranscriptStatus });
        }

        // Fetch YouTube metadata + CC check
        var meta = await youtube.GetVideoMetaAsync(videoId);
        if (meta is null)
            return NotFound(new { message = "Video not found or has been removed" });
        if (!meta.IsPublic)
            return StatusCode(403, new { message = "This video is not publicly accessible" });
        if (!meta.HasEnglishCc)
            return BadRequest(new { message = "This video has no English captions — Phase 1 only supports CC-enabled videos" });

        // Create video record + link to user + enqueue job
        var video = new Video
        {
            YoutubeId        = videoId,
            Title            = meta.Title,
            ThumbnailUrl     = meta.ThumbnailUrl,
            DurationSeconds  = meta.DurationSeconds,
            CcType           = meta.CcType,
            TranscriptStatus = "queued"
        };

        await db.Videos.AddAsync(video);
        await LinkVideoToUserAsync(userId, video.Id, video);
        await db.SaveChangesAsync();

        jobs.Enqueue<CcImportJob>(j => j.RunAsync(video.Id));

        return Ok(new { jobId = video.Id, status = "queued" });
    }

    private async Task LinkVideoToUserAsync(Guid userId, Guid videoId, Video? newVideo = null)
    {
        var exists = await db.UserVideos.AnyAsync(uv => uv.UserId == userId && uv.VideoId == videoId);
        if (exists) return;

        var uv = new UserVideo { UserId = userId, VideoId = videoId };
        if (newVideo is not null)
            uv.VideoId = newVideo.Id;

        await db.UserVideos.AddAsync(uv);
    }
}

public static class YouTubeHelper
{
    private static readonly Regex[] Patterns =
    [
        new(@"youtu\.be/([a-zA-Z0-9_-]{11})", RegexOptions.Compiled),
        new(@"youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})", RegexOptions.Compiled),
        new(@"youtube\.com/shorts/([a-zA-Z0-9_-]{11})", RegexOptions.Compiled),
    ];

    public static string? ExtractVideoId(string url)
    {
        foreach (var pattern in Patterns)
        {
            var m = pattern.Match(url);
            if (m.Success) return m.Groups[1].Value;
        }
        return null;
    }
}
