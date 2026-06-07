namespace AntEnglish.Services.Interfaces;

public record SavedItem(
    Guid SentenceId,
    string Text,
    string? Translation,
    string VideoTitle,
    Guid VideoId,
    string? Note,
    DateTimeOffset SavedAt);

public interface ISavedService
{
    Task<List<SavedItem>> GetSavedAsync(Guid userId);
    /// <summary>Returns false if the sentence is already saved (conflict).</summary>
    Task<bool> SaveAsync(Guid userId, Guid sentenceId);
    /// <summary>Returns false if the saved sentence was not found.</summary>
    Task<bool> RemoveAsync(Guid userId, Guid sentenceId);
    /// <summary>Returns false if the saved sentence was not found.</summary>
    Task<bool> UpdateNoteAsync(Guid userId, Guid sentenceId, string? note);
}
