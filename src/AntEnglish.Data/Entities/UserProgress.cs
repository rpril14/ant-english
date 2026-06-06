namespace AntEnglish.Data.Entities;

public class UserProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid SentenceId { get; set; }
    public int Attempts { get; set; }
    public int? FinalScore { get; set; }
    public int HintLevelUsed { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public Sentence Sentence { get; set; } = null!;
}
