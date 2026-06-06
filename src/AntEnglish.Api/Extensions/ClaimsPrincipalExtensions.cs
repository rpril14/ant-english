using System.Security.Claims;

namespace AntEnglish.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// Returns the authenticated user's ID from the Supabase JWT `sub` claim.
    /// Throws if the claim is missing — caller must be behind [Authorize].
    /// </summary>
    public static Guid GetUserId(this ClaimsPrincipal user)
    {
        var sub = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? throw new InvalidOperationException("sub claim missing from JWT");

        return Guid.Parse(sub);
    }
}
