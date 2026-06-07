using AntEnglish.Services.Interfaces;

namespace AntEnglish.Api.Jobs;

public class CcImportJob(IVideoImportService importService)
{
    public Task RunAsync(Guid videoId) => importService.ProcessImportAsync(videoId);
}
