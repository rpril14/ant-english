using AntEnglish.Services.Interfaces;
using System.Text.RegularExpressions;

namespace AntEnglish.Services.Services;

public class SrtParser : ISrtParser
{
    // Matches VTT/SRT timestamps: 00:00:01.234 or 00:01.234
    private static readonly Regex TimestampLine =
        new(@"(\d{1,2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{3})", RegexOptions.Compiled);

    // Strips VTT cue tags like <00:00:01.000><c>word</c>
    private static readonly Regex CueTag = new(@"<[^>]+>", RegexOptions.Compiled);

    public IReadOnlyList<ParsedSentence> Parse(string filePath)
    {
        var lines = File.ReadAllLines(filePath);
        var sentences = new List<ParsedSentence>();
        int? startMs = null;
        int? endMs = null;
        var textLines = new List<string>();

        foreach (var line in lines)
        {
            var tsMatch = TimestampLine.Match(line);
            if (tsMatch.Success)
            {
                // Flush previous block
                Flush(sentences, startMs, endMs, textLines);
                startMs = ParseMs(tsMatch.Groups[1].Value);
                endMs = ParseMs(tsMatch.Groups[2].Value);
                textLines.Clear();
                continue;
            }

            // Skip VTT header, NOTE blocks, and blank lines between cues
            if (line.StartsWith("WEBVTT") || line.StartsWith("NOTE") || line.StartsWith("STYLE"))
                continue;

            var cleaned = CueTag.Replace(line, "").Trim();
            if (cleaned.Length > 0 && startMs.HasValue)
                textLines.Add(cleaned);
        }

        Flush(sentences, startMs, endMs, textLines);

        return Merge(sentences);
    }

    private static void Flush(List<ParsedSentence> list, int? start, int? end, List<string> lines)
    {
        if (start is null || end is null || lines.Count == 0) return;
        var text = string.Join(" ", lines).Trim();
        if (text.Length > 0)
            list.Add(new ParsedSentence(text, start.Value, end.Value));
    }

    /// <summary>
    /// Merges overlapping/duplicate cue blocks that VTT often emits for rolling captions.
    /// Keeps only cues where text changes and gaps the timestamps cleanly.
    /// </summary>
    private static IReadOnlyList<ParsedSentence> Merge(List<ParsedSentence> raw)
    {
        var merged = new List<ParsedSentence>();
        foreach (var s in raw)
        {
            if (merged.Count > 0 && merged[^1].Text == s.Text)
                continue; // duplicate rolling cue
            merged.Add(s);
        }
        return merged;
    }

    private static int ParseMs(string ts)
    {
        // Normalise comma to dot for SRT format
        ts = ts.Replace(',', '.');
        var parts = ts.Split(':');
        // Could be HH:MM:SS.mmm or MM:SS.mmm
        return parts.Length == 3
            ? (int)(TimeSpan.ParseExact(ts, @"hh\:mm\:ss\.fff", null).TotalMilliseconds)
            : (int)(TimeSpan.ParseExact(ts, @"mm\:ss\.fff", null).TotalMilliseconds);
    }
}
