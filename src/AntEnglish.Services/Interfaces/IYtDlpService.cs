namespace AntEnglish.Services.Interfaces;

public interface IYtDlpService
{
    /// <summary>
    /// Downloads the English subtitle file for a YouTube video.
    /// Returns the local path to the downloaded SRT/VTT file.
    /// </summary>
    Task<string> DownloadSubtitleAsync(string youtubeId, CancellationToken ct = default);
}
