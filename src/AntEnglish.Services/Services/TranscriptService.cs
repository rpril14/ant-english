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

        // Try English first, fall back to any available transcript
        var json = await RunAsync(python, youtubeId, ["en", "en-US", "en-GB"], ct)
                ?? await RunAsync(python, youtubeId, [], ct)
                ?? throw new InvalidOperationException($"Could not retrieve transcript for {youtubeId}");

        return ParseJson(json);
    }

    private async Task<string?> RunAsync(
        string python, string youtubeId, string[] languages, CancellationToken ct)
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

        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        var stderrTask = process.StandardError.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);

        var stdout = await stdoutTask;
        var stderr = await stderrTask;

        if (process.ExitCode != 0)
        {
            logger.LogWarning("youtube-transcript-api failed (exit {Code}): {Error}", process.ExitCode, stderr);
            return null;
        }

        return stdout;
    }

    private static IReadOnlyList<TranscriptLine> ParseJson(string json)
    {
        // CLI returns [[{...}]] — outer array is per-video, inner array is entries
        var outer = JsonSerializer.Deserialize<TranscriptEntry[][]>(json)
            ?? throw new InvalidOperationException("Empty transcript response");

        var entries = outer.Length > 0 ? outer[0] : [];

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
