using AntEnglish.Services.Interfaces;
using System.Text.RegularExpressions;

namespace AntEnglish.Services.Services;

public class MatchingService : IMatchingService
{
    // Keep only lowercase letters, digits, and spaces — apostrophes stripped so "i'm" == "im"
    private static readonly Regex StripPunctuation = new(@"[^a-z0-9\s]", RegexOptions.Compiled);

    public MatchResult Match(string input, string reference, string[] namedEntities)
    {
        var refWords = Tokenise(reference);
        var inputWords = Tokenise(input);

        var namedSet = namedEntities
            .Select(e => Normalise(e))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var words = new List<WordResult>(refWords.Count);
        for (var i = 0; i < refWords.Count; i++)
        {
            if (i >= inputWords.Count)
            {
                words.Add(new WordResult(refWords[i], WordStatus.Missing));
            }
            else if (inputWords[i] == refWords[i])
            {
                words.Add(new WordResult(refWords[i], WordStatus.Correct));
            }
            else
            {
                words.Add(new WordResult(refWords[i], WordStatus.Incorrect));
            }
        }

        var score = CalculateScore(words, namedSet);
        return new MatchResult(words, score);
    }

    private static int CalculateScore(List<WordResult> words, HashSet<string> namedSet)
    {
        var scoreable = words.Where(w => !namedSet.Contains(w.Word)).ToList();
        if (scoreable.Count == 0) return 100;

        var correct = scoreable.Count(w => w.Status == WordStatus.Correct);
        return (int)Math.Round(correct * 100.0 / scoreable.Count);
    }

    private static List<string> Tokenise(string text)
    {
        var normalised = Normalise(text);
        return normalised
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .ToList();
    }

    private static string Normalise(string text) =>
        StripPunctuation
            .Replace(
                text.ToLowerInvariant()
                    .Replace('’', '\'')   // right single quotation mark → apostrophe
                    .Replace('‘', '\''),  // left single quotation mark → apostrophe
                "")
            .Trim();
}
