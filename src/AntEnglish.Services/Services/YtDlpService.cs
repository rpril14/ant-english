using AntEnglish.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace AntEnglish.Services.Services;

public class YtDlpService(IConfiguration config, ILogger<YtDlpService> logger) : IYtDlpService
{
    public async Task<string> DownloadSubtitleAsync(string youtubeId, CancellationToken ct = default)
    {
        var outputDir = Path.Combine(Path.GetTempPath(), "ant-english-subs");
        Directory.CreateDirectory(outputDir);

        var outputTemplate = Path.Combine(outputDir, $"{youtubeId}.%(ext)s");
        var executable = config["YtDlp:ExecutablePath"] ?? "yt-dlp";

        // Download English subtitle only (prefer manual over auto-generated)
        var args = string.Join(" ",
            $"--write-sub",
            $"--write-auto-sub",
            $"--sub-lang en",
            $"--sub-format vtt",
            $"--skip-download",
            $"--output \"{outputTemplate}\"",
            $"https://www.youtube.com/watch?v={youtubeId}"
        );

        logger.LogInformation("yt-dlp {YoutubeId}", youtubeId);

        var psi = new ProcessStartInfo
        {
            FileName = executable,
            Arguments = args,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start yt-dlp");

        await process.WaitForExitAsync(ct);

        if (process.ExitCode != 0)
        {
            var err = await process.StandardError.ReadToEndAsync(ct);
            throw new InvalidOperationException($"yt-dlp failed (exit {process.ExitCode}): {err}");
        }

        // Find the downloaded subtitle file
        var subtitleFile = Directory.GetFiles(outputDir, $"{youtubeId}*.vtt").FirstOrDefault()
            ?? Directory.GetFiles(outputDir, $"{youtubeId}*.srt").FirstOrDefault();

        return subtitleFile
            ?? throw new FileNotFoundException($"No subtitle file found for {youtubeId}");
    }
}
