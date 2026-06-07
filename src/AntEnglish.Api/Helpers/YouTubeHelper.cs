using System.Text.RegularExpressions;

namespace AntEnglish.Api.Helpers;

public static class YouTubeHelper
{
    private static readonly Regex[] Patterns =
    [
        new(@"youtu\.be/([a-zA-Z0-9_-]{11})", RegexOptions.Compiled),
        new(@"youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})", RegexOptions.Compiled),
        new(@"youtube\.com/shorts/([a-zA-Z0-9_-]{11})", RegexOptions.Compiled),
    ];

    public static string? ExtractVideoId(string url)
    {
        foreach (var pattern in Patterns)
        {
            var m = pattern.Match(url);
            if (m.Success) return m.Groups[1].Value;
        }
        return null;
    }
}
