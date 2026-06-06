using AntEnglish.Api.Controllers;

namespace AntEnglish.Tests.Unit;

public class YouTubeHelper_test
{
    [Theory]
    [InlineData("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ")]
    [InlineData("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ")]
    public void ExtractVideoId_ValidUrl_ReturnsId(string url, string expected)
    {
        // Arrange + Act
        var result = YouTubeHelper.ExtractVideoId(url);

        // Assert
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("https://vimeo.com/123456")]
    [InlineData("not-a-url")]
    [InlineData("https://youtube.com/channel/UCxxx")]
    [InlineData("")]
    public void ExtractVideoId_InvalidUrl_ReturnsNull(string url)
    {
        // Arrange + Act
        var result = YouTubeHelper.ExtractVideoId(url);

        // Assert
        Assert.Null(result);
    }
}
