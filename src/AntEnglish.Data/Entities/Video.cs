namespace AntEnglish.Data.Entities;

public class Video
{
    public Guid Id { get; set; }
    public string YoutubeId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string? ThumbnailUrl { get; set; }
    public int? DurationSeconds { get; set; }
    public string TranscriptStatus { get; set; } = "queued";
    public string? CcType { get; set; }
    public int SentenceCount { get; set; }
    public int? DifficultyScore { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<Sentence> Sentences { get; set; } = [];
    public ICollection<UserVideo> UserVideos { get; set; } = [];
}
