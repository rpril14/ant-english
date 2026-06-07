using AntEnglish.Api.Extensions;
using AntEnglish.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AntEnglish.Api.Controllers;

[ApiController]
[Route("api/jobs")]
[Authorize]
public class JobsController(IVideoImportService importService) : ControllerBase
{
    /// <summary>Polling fallback when Supabase Realtime WebSocket disconnects.</summary>
    [HttpGet("{jobId:guid}/status")]
    public async Task<IActionResult> GetStatus(Guid jobId)
    {
        var result = await importService.GetJobStatusAsync(User.GetUserId(), jobId);
        if (result is null) return NotFound();
        return Ok(new { jobId = result.Value.Id, status = result.Value.TranscriptStatus });
    }
}
