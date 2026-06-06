using AntEnglish.Api.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AntEnglish.Api.Controllers;

[ApiController]
[Route("api")]
public class HealthController : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow });

    /// <summary>Smoke-test that JWT auth is wired correctly.</summary>
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me() =>
        Ok(new { userId = User.GetUserId() });
}
