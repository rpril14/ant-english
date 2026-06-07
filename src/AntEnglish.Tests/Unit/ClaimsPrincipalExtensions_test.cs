using AntEnglish.Api.Extensions;
using System.Security.Claims;

namespace AntEnglish.Tests.Unit;

public class ClaimsPrincipalExtensions_test
{
    private static ClaimsPrincipal WithClaims(params Claim[] claims) =>
        new(new ClaimsIdentity(claims));

    [Fact]
    public void GetUserId_NameIdentifierClaim_ReturnsGuid()
    {
        // Arrange
        var id = Guid.NewGuid();
        var user = WithClaims(new Claim(ClaimTypes.NameIdentifier, id.ToString()));

        // Act
        var result = user.GetUserId();

        // Assert
        Assert.Equal(id, result);
    }

    [Fact]
    public void GetUserId_SubClaimFallback_ReturnsGuid()
    {
        // Arrange — Supabase JWTs use "sub" not ClaimTypes.NameIdentifier
        var id = Guid.NewGuid();
        var user = WithClaims(new Claim("sub", id.ToString()));

        // Act
        var result = user.GetUserId();

        // Assert
        Assert.Equal(id, result);
    }

    [Fact]
    public void GetUserId_NoSubClaim_ThrowsInvalidOperationException()
    {
        // Arrange
        var user = WithClaims(new Claim("email", "test@example.com"));

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => user.GetUserId());
    }

    [Fact]
    public void GetUserId_MalformedSubClaim_ThrowsFormatException()
    {
        // Arrange — sub present but not a valid GUID
        var user = WithClaims(new Claim("sub", "not-a-guid"));

        // Act & Assert
        Assert.Throws<FormatException>(() => user.GetUserId());
    }
}
