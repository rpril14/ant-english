using AntEnglish.Data;
using AntEnglish.Services.Interfaces;
using AntEnglish.Services.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace AntEnglish.Services.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddAntEnglishData(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AntDbContext>(options =>
            options.UseNpgsql(
                connectionString,
                npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
            .UseSnakeCaseNamingConvention());
        return services;
    }

    public static IServiceCollection AddAntEnglishServices(this IServiceCollection services)
    {
        services.AddScoped<IYouTubeService, YouTubeService>();
        services.AddScoped<ITranscriptService, TranscriptService>();
        services.AddScoped<IDeepLService, DeepLService>();
        services.AddSingleton<IMatchingService, MatchingService>();
        services.AddScoped<ILibraryService, LibraryService>();
        services.AddScoped<ISavedService, SavedService>();
        services.AddScoped<IProgressService, ProgressService>();
        services.AddScoped<IVideoImportService, VideoImportService>();
        return services;
    }
}
