using AntEnglish.Api.Extensions;
using AntEnglish.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AntEnglish.Api.Controllers;

public record UpsertNoteRequest(string? Note);

[ApiController]
[Route("api/saved")]
[Authorize]
public class SavedController(ISavedService saved) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSaved()
    {
        var items = await saved.GetSavedAsync(User.GetUserId());
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] Guid sentenceId)
    {
        if (!await saved.SaveAsync(User.GetUserId(), sentenceId)) return Conflict();
        return Created(string.Empty, null);
    }

    [HttpDelete("{sentenceId:guid}")]
    public async Task<IActionResult> Remove(Guid sentenceId)
    {
        if (!await saved.RemoveAsync(User.GetUserId(), sentenceId)) return NotFound();
        return NoContent();
    }

    [HttpPatch("{sentenceId:guid}/note")]
    public async Task<IActionResult> UpdateNote(Guid sentenceId, [FromBody] UpsertNoteRequest req)
    {
        if (!await saved.UpdateNoteAsync(User.GetUserId(), sentenceId, req.Note)) return NotFound();
        return Ok(new { note = req.Note });
    }
}
