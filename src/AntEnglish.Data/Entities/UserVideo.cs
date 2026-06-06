namespace AntEnglish.Data.Entities;

public class UserVideo
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid VideoId { get; set; }
    public DateTimeOffset AddedAt { get; set; }
    public DateTimeOffset? LastStudiedAt { get; set; }
    public bool IsFavorited { get; set; }
    public string[] CustomTags { get; set; } = [];

    public Video Video { get; set; } = null!;
}
