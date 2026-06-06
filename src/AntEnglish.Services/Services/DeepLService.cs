using AntEnglish.Services.Interfaces;
using DeepL;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AntEnglish.Services.Services;

public class DeepLService(IConfiguration config, ILogger<DeepLService> logger) : IDeepLService
{
    public async Task<IReadOnlyList<string?>> TranslateBatchAsync(IReadOnlyList<string> texts)
    {
        if (texts.Count == 0) return [];

        try
        {
            var apiKey = config["DeepL:ApiKey"]
                ?? throw new InvalidOperationException("DeepL:ApiKey is required");

            using var translator = new Translator(apiKey);
            var results = await translator.TranslateTextAsync(
                texts,
                sourceLanguageCode: LanguageCode.English,
                targetLanguageCode: LanguageCode.Vietnamese
            );

            return results.Select(r => (string?)r.Text).ToList();
        }
        catch (QuotaExceededException)
        {
            logger.LogWarning("DeepL quota exceeded — storing sentences without translation");
            return Enumerable.Repeat<string?>(null, texts.Count).ToList();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "DeepL translation failed — storing sentences without translation");
            return Enumerable.Repeat<string?>(null, texts.Count).ToList();
        }
    }
}
