using AntEnglish.Api.Extensions;
using AntEnglish.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AntEnglish.Api.Controllers;

public record UpsertProgressRequest(Guid SentenceId, int Score, int HintLevelUsed, bool Completed);

[ApiController]
[Route("api/progress")]
[Authorize]
public class ProgressController(IProgressService progress) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertProgressRequest req)
    {
        var result = await progress.UpsertAsync(
            User.GetUserId(), req.SentenceId, req.Score, req.HintLevelUsed, req.Completed);
        return Ok(result);
    }

    [HttpGet("{videoId:guid}")]
    public async Task<IActionResult> GetForVideo(Guid videoId)
    {
        var result = await progress.GetForVideoAsync(User.GetUserId(), videoId);
        return Ok(result);
    }
}
