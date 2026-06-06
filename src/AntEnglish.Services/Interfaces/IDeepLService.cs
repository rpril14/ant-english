namespace AntEnglish.Services.Interfaces;

public interface IDeepLService
{
    /// <summary>
    /// Translates a batch of English texts to Vietnamese.
    /// Returns null entries for any text that failed (quota exceeded, etc).
    /// Never throws — degrades gracefully.
    /// </summary>
    Task<IReadOnlyList<string?>> TranslateBatchAsync(IReadOnlyList<string> texts);
}
