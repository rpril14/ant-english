using AntEnglish.Api.Extensions;
using AntEnglish.Api.Helpers;
using AntEnglish.Api.Jobs;
using AntEnglish.Services.Interfaces;
using FluentValidation;
using Hangfire;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AntEnglish.Api.Controllers;

public record ImportRequest(string Url);

public class ImportRequestValidator : AbstractValidator<ImportRequest>
{
    public ImportRequestValidator()
    {
        RuleFor(x => x.Url)
            .NotEmpty()
            .Must(url => YouTubeHelper.ExtractVideoId(url) is not null)
            .WithMessage("Invalid URL — please paste a YouTube link");
    }
}

[ApiController]
[Route("api/videos")]
[Authorize]
public class ImportController(
    IVideoImportService importService,
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

        var youtubeId = YouTubeHelper.ExtractVideoId(req.Url)!;
        var userId = User.GetUserId();

        var existing = await importService.FindExistingAsync(youtubeId);
        if (existing is not null)
        {
            if (existing.TranscriptStatus == "ready")
            {
                await importService.EnsureUserLinkAsync(userId, existing.Id);
                return Ok(new { videoId = existing.Id, status = "ready" });
            }
            if (existing.TranscriptStatus is "queued" or "processing")
            {
                await importService.EnsureUserLinkAsync(userId, existing.Id);
                return Ok(new { jobId = existing.Id, status = existing.TranscriptStatus });
            }
        }

        var meta = await youtube.GetVideoMetaAsync(youtubeId);
        if (meta is null)
            return NotFound(new { message = "Video not found or has been removed" });
        if (!meta.IsPublic)
            return StatusCode(403, new { message = "This video is not publicly accessible" });
        if (!meta.HasEnglishCc)
            return BadRequest(new { message = "This video has no English captions — Phase 1 only supports CC-enabled videos" });

        var videoId = await importService.CreateAndLinkAsync(
            userId, youtubeId, meta.Title, meta.ThumbnailUrl, meta.DurationSeconds, meta.CcType);

        jobs.Enqueue<CcImportJob>(j => j.RunAsync(videoId));

        return Ok(new { jobId = videoId, status = "queued" });
    }
}
