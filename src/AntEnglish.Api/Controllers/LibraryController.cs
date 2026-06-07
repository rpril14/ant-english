using AntEnglish.Api.Extensions;
using AntEnglish.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AntEnglish.Api.Controllers;

[ApiController]
[Route("api/library")]
[Authorize]
public class LibraryController(ILibraryService library) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetLibrary()
    {
        var items = await library.GetLibraryAsync(User.GetUserId());
        return Ok(items);
    }

    [HttpPost("{videoId:guid}/favorite")]
    public async Task<IActionResult> ToggleFavorite(Guid videoId)
    {
        var result = await library.ToggleFavoriteAsync(User.GetUserId(), videoId);
        if (result is null) return NotFound();
        return Ok(new { isFavorited = result });
    }

    [HttpDelete("{videoId:guid}")]
    public async Task<IActionResult> RemoveFromLibrary(Guid videoId)
    {
        if (!await library.RemoveAsync(User.GetUserId(), videoId)) return NotFound();
        return NoContent();
    }
}
