using AntEnglish.Api.Extensions;
using AntEnglish.Data;
using AntEnglish.Data.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Api.Controllers;

public record UpsertNoteRequest(string? Note);

[ApiController]
[Route("api/saved")]
[Authorize]
public class SavedController(AntDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSaved()
    {
        var userId = User.GetUserId();
        var items = await db.SavedSentences
            .Where(ss => ss.UserId == userId)
            .OrderByDescending(ss => ss.SavedAt)
            .Select(ss => new
            {
                SentenceId = ss.SentenceId,
                Text       = ss.Sentence.Text,
                Translation = ss.Sentence.Translation,
                VideoTitle  = ss.Sentence.Video.Title,
                VideoId     = ss.Sentence.VideoId,
                Note        = ss.Note,
                SavedAt     = ss.SavedAt,
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] Guid sentenceId)
    {
        var userId = User.GetUserId();
        var exists = await db.SavedSentences
            .AnyAsync(ss => ss.UserId == userId && ss.SentenceId == sentenceId);

        if (exists) return Conflict();

        db.SavedSentences.Add(new SavedSentence
        {
            UserId     = userId,
            SentenceId = sentenceId,
            SavedAt    = DateTimeOffset.UtcNow,
            NextReviewAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        return Created(string.Empty, null);
    }

    [HttpDelete("{sentenceId:guid}")]
    public async Task<IActionResult> Remove(Guid sentenceId)
    {
        var userId = User.GetUserId();
        var row = await db.SavedSentences
            .FirstOrDefaultAsync(ss => ss.UserId == userId && ss.SentenceId == sentenceId);

        if (row is null) return NotFound();

        db.SavedSentences.Remove(row);
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{sentenceId:guid}/note")]
    public async Task<IActionResult> UpdateNote(Guid sentenceId, [FromBody] UpsertNoteRequest req)
    {
        var userId = User.GetUserId();
        var row = await db.SavedSentences
            .FirstOrDefaultAsync(ss => ss.UserId == userId && ss.SentenceId == sentenceId);

        if (row is null) return NotFound();

        row.Note = req.Note;
        await db.SaveChangesAsync();

        return Ok(new { row.Note });
    }
}
