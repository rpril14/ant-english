using AntEnglish.Services.Interfaces;
using AntEnglish.Services.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AntEnglish.Services.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAntEnglishServices(this IServiceCollection services)
    {
        services.AddScoped<IYouTubeService, YouTubeService>();
        services.AddScoped<ITranscriptService, TranscriptService>();
        services.AddScoped<IDeepLService, DeepLService>();
        return services;
    }
}
