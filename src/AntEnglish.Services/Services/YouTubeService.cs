using AntEnglish.Services.Interfaces;
using Google.Apis.Services;
using Google.Apis.YouTube.v3;
using Microsoft.Extensions.Configuration;

namespace AntEnglish.Services.Services;

public class YouTubeService(IConfiguration config) : IYouTubeService
{
    public async Task<VideoMeta?> GetVideoMetaAsync(string youtubeId)
    {
        using var youtube = new Google.Apis.YouTube.v3.YouTubeService(new BaseClientService.Initializer
        {
            ApiKey = config["YouTube:ApiKey"],
            ApplicationName = "AntEnglish"
        });

        // Fetch video metadata
        var videoReq = youtube.Videos.List("snippet,contentDetails,status");
        videoReq.Id = youtubeId;
        var videoResp = await videoReq.ExecuteAsync();
        var video = videoResp.Items?.FirstOrDefault();

        if (video is null) return null;
        if (video.Status.PrivacyStatus != "public") return null;

        // Fetch caption tracks
        var captionReq = youtube.Captions.List("snippet", youtubeId);
        var captionResp = await captionReq.ExecuteAsync();
        var englishCc = captionResp.Items?
            .FirstOrDefault(c => c.Snippet.Language.StartsWith("en", StringComparison.OrdinalIgnoreCase));

        var duration = ParseIsoDuration(video.ContentDetails.Duration);
        var thumbnail = video.Snippet.Thumbnails?.Medium?.Url
            ?? video.Snippet.Thumbnails?.Default__?.Url;

        return new VideoMeta(
            Title: video.Snippet.Title,
            ThumbnailUrl: thumbnail,
            DurationSeconds: duration,
            IsPublic: true,
            HasEnglishCc: englishCc is not null,
            CcType: englishCc?.Snippet.TrackKind == "asr" ? "asr" : englishCc is not null ? "standard" : null
        );
    }

    private static int? ParseIsoDuration(string? iso)
    {
        if (iso is null) return null;
        var ts = System.Xml.XmlConvert.ToTimeSpan(iso);
        return (int)ts.TotalSeconds;
    }
}
