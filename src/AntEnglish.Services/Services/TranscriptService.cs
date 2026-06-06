using AntEnglish.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Web;

namespace AntEnglish.Services.Services;

public class TranscriptService(IConfiguration config, ILogger<TranscriptService> logger) : ITranscriptService
{
    public async Task<IReadOnlyList<TranscriptLine>> GetTranscriptAsync(string youtubeId, CancellationToken ct = default)
    {
        var python = config["TranscriptService:PythonPath"] ?? "python";
        var cookiesFile = config["TranscriptService:CookiesFile"];

        // Try English first, fall back to any available transcript
        var json = await RunAsync(python, youtubeId, ["en", "en-US", "en-GB"], cookiesFile, ct)
                ?? await RunAsync(python, youtubeId, [], cookiesFile, ct)
                ?? throw new InvalidOperationException($"Could not retrieve transcript for {youtubeId}");

        return ParseJson(json);
    }

    private async Task<string?> RunAsync(
        string python, string youtubeId,
        string[] languages, string? cookiesFile,
        CancellationToken ct)
    {
        var args = new List<string>
        {
            "-m", "youtube_transcript_api",
            youtubeId,
            "--format", "json"
        };

        if (languages.Length > 0)
        {
            args.Add("--languages");
            args.AddRange(languages);
        }

        if (!string.IsNullOrEmpty(cookiesFile))
        {
            args.Add("--cookies");
            args.Add(cookiesFile);
        }

        var psi = new ProcessStartInfo
        {
            FileName = python,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        foreach (var arg in args) psi.ArgumentList.Add(arg);

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start Python");

        var stdout = await process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
        {
            var err = await process.StandardError.ReadToEndAsync(ct);
            logger.LogWarning("youtube-transcript-api failed (exit {Code}): {Error}", process.ExitCode, err);
            return null;
        }

        return stdout;
    }

    private static IReadOnlyList<TranscriptLine> ParseJson(string json)
    {
        var entries = JsonSerializer.Deserialize<TranscriptEntry[]>(json)
            ?? throw new InvalidOperationException("Empty transcript response");

        return entries
            .Where(e => !string.IsNullOrWhiteSpace(e.Text))
            .Select(e => new TranscriptLine(
                Text: HttpUtility.HtmlDecode(e.Text).Trim(),
                StartMs: (int)(e.Start * 1000),
                EndMs: (int)((e.Start + e.Duration) * 1000)))
            .ToList();
    }

    private record TranscriptEntry(
        [property: JsonPropertyName("text")] string Text,
        [property: JsonPropertyName("start")] double Start,
        [property: JsonPropertyName("duration")] double Duration);
}
