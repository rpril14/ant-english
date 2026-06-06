namespace AntEnglish.Data.Entities;

public class SavedSentence
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid SentenceId { get; set; }
    public DateTimeOffset SavedAt { get; set; }
    public string? Note { get; set; }
    public int ReviewInterval { get; set; } = 1;
    public double ReviewEase { get; set; } = 2.5;
    public DateTimeOffset NextReviewAt { get; set; }

    public Sentence Sentence { get; set; } = null!;
}
