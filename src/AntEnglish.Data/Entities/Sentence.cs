namespace AntEnglish.Data.Entities;

public class Sentence
{
    public Guid Id { get; set; }
    public Guid VideoId { get; set; }
    public int Index { get; set; }
    public string Text { get; set; } = null!;
    public string? Translation { get; set; }
    public string[] NamedEntities { get; set; } = [];
    public int StartTimeMs { get; set; }
    public int EndTimeMs { get; set; }

    public Video Video { get; set; } = null!;
    public ICollection<UserProgress> UserProgresses { get; set; } = [];
    public ICollection<SavedSentence> SavedSentences { get; set; } = [];
}
