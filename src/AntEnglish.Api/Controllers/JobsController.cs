using AntEnglish.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Controllers;

[ApiController]
[Route("api/jobs")]
[Authorize]
public class JobsController(AntDbContext db) : ControllerBase
{
    /// <summary>Polling fallback when Supabase Realtime WebSocket disconnects.</summary>
    [HttpGet("{jobId:guid}/status")]
    public async Task<IActionResult> GetStatus(Guid jobId)
    {
        var video = await db.Videos
            .Where(v => v.Id == jobId)
            .Select(v => new { v.Id, v.TranscriptStatus })
            .FirstOrDefaultAsync();

        if (video is null) return NotFound();

        return Ok(new { jobId = video.Id, status = video.TranscriptStatus });
    }
}
