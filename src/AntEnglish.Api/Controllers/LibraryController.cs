using AntEnglish.Api.Extensions;
using AntEnglish.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Controllers;

[ApiController]
[Route("api/library")]
[Authorize]
public class LibraryController(AntDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetLibrary()
    {
        var userId = User.GetUserId();

        var items = await db.UserVideos
            .Where(uv => uv.UserId == userId)
            .Select(uv => new
            {
                VideoId = uv.VideoId,
                Title = uv.Video.Title,
                ThumbnailUrl = uv.Video.ThumbnailUrl,
                DurationSeconds = uv.Video.DurationSeconds,
                TranscriptStatus = uv.Video.TranscriptStatus,
                SentenceCount = uv.Video.SentenceCount,
                PracticedCount = db.UserProgresses
                    .Count(p => p.UserId == userId
                             && p.Sentence.VideoId == uv.VideoId
                             && p.CompletedAt != null),
                IsFavorited = uv.IsFavorited,
                CustomTags = uv.CustomTags,
                AddedAt = uv.AddedAt,
                LastStudiedAt = uv.LastStudiedAt,
            })
            .OrderByDescending(x => x.AddedAt)
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("{videoId:guid}/favorite")]
    public async Task<IActionResult> ToggleFavorite(Guid videoId)
    {
        var userId = User.GetUserId();
        var uv = await db.UserVideos
            .FirstOrDefaultAsync(uv => uv.UserId == userId && uv.VideoId == videoId);

        if (uv is null) return NotFound();

        uv.IsFavorited = !uv.IsFavorited;
        await db.SaveChangesAsync();

        return Ok(new { uv.IsFavorited });
    }

    [HttpDelete("{videoId:guid}")]
    public async Task<IActionResult> RemoveFromLibrary(Guid videoId)
    {
        var userId = User.GetUserId();
        var uv = await db.UserVideos
            .FirstOrDefaultAsync(uv => uv.UserId == userId && uv.VideoId == videoId);

        if (uv is null) return NotFound();

        db.UserVideos.Remove(uv);
        await db.SaveChangesAsync();

        return NoContent();
    }
}
