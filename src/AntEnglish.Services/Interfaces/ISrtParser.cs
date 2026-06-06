namespace AntEnglish.Services.Interfaces;

public record ParsedSentence(string Text, int StartMs, int EndMs);

public interface ISrtParser
{
    IReadOnlyList<ParsedSentence> Parse(string filePath);
}
