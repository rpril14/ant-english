namespace AntEnglish.Services.Interfaces;

public enum WordStatus { Correct, Incorrect, Missing }

public record WordResult(string Word, WordStatus Status);

public record MatchResult(IReadOnlyList<WordResult> Words, int Score);

public interface IMatchingService
{
    /// <summary>
    /// Compares normalised input against a reference sentence.
    /// namedEntities are excluded from scoring; if all words are proper nouns, score = 100.
    /// </summary>
    MatchResult Match(string input, string reference, string[] namedEntities);
}
