using AntEnglish.Api.Extensions;
using AntEnglish.Data;
using AntEnglish.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Controllers;

public record UpsertProgressRequest(Guid SentenceId, int Score, int HintLevelUsed, bool Completed);

[ApiController]
[Route("api/progress")]
[Authorize]
public class ProgressController(AntDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Upsert([FromBody] UpsertProgressRequest req)
    {
        var userId = User.GetUserId();
        var progress = await db.UserProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.SentenceId == req.SentenceId);

        if (progress is null)
        {
            progress = new UserProgress
            {
                UserId = userId,
                SentenceId = req.SentenceId,
                Attempts = 1,
                FinalScore = req.Score,
                HintLevelUsed = req.HintLevelUsed,
                CompletedAt = req.Completed ? DateTimeOffset.UtcNow : null
            };
            db.UserProgresses.Add(progress);
        }
        else
        {
            progress.Attempts++;
            progress.FinalScore = req.Score;
            progress.HintLevelUsed = req.HintLevelUsed;
            if (req.Completed) progress.CompletedAt ??= DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        return Ok(new
        {
            progress.SentenceId,
            Score = progress.FinalScore,
            progress.HintLevelUsed,
            progress.CompletedAt
        });
    }

    [HttpGet("{videoId:guid}")]
    public async Task<IActionResult> GetForVideo(Guid videoId)
    {
        var userId = User.GetUserId();
        var result = await db.UserProgresses
            .Where(p => p.UserId == userId && p.Sentence.VideoId == videoId)
            .Select(p => new
            {
                p.SentenceId,
                Score = p.FinalScore,
                p.HintLevelUsed,
                p.CompletedAt
            })
            .ToListAsync();

        return Ok(result);
    }
}
