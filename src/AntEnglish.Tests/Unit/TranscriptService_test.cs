using AntEnglish.Services.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace AntEnglish.Tests.Unit;

public class TranscriptService_test
{
    private static TranscriptService BuildService(Dictionary<string, string?>? config = null)
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(config ?? [])
            .Build();
        return new TranscriptService(cfg, NullLogger<TranscriptService>.Instance);
    }

    [Fact]
    public void ParseJson_ValidEntries_ReturnsMappedLines()
    {
        // Arrange
        var json = """
            [
              {"text": "Hello world", "start": 1.0, "duration": 2.5},
              {"text": "How are you", "start": 4.0, "duration": 3.0}
            ]
            """;

        // Act
        var result = InvokeParseJson(json);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Equal("Hello world", result[0].Text);
        Assert.Equal(1000, result[0].StartMs);
        Assert.Equal(3500, result[0].EndMs);
        Assert.Equal(4000, result[1].StartMs);
        Assert.Equal(7000, result[1].EndMs);
    }

    [Fact]
    public void ParseJson_HtmlEntities_Decoded()
    {
        // Arrange — youtube-transcript-api returns HTML-encoded text
        var json = """
            [{"text": "it&#39;s a &amp; b", "start": 0.0, "duration": 2.0}]
            """;

        // Act
        var result = InvokeParseJson(json);

        // Assert
        Assert.Single(result);
        Assert.Equal("it's a & b", result[0].Text);
    }

    [Fact]
    public void ParseJson_BlankLines_Skipped()
    {
        // Arrange
        var json = """
            [
              {"text": "  ", "start": 0.0, "duration": 1.0},
              {"text": "Hello", "start": 1.0, "duration": 2.0}
            ]
            """;

        // Act
        var result = InvokeParseJson(json);

        // Assert
        Assert.Single(result);
        Assert.Equal("Hello", result[0].Text);
    }

    // ParseJson is private — invoke via reflection for unit testing
    private static IReadOnlyList<AntEnglish.Services.Interfaces.TranscriptLine> InvokeParseJson(string json)
    {
        var method = typeof(TranscriptService)
            .GetMethod("ParseJson", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)
            ?? throw new InvalidOperationException("ParseJson method not found");

        return (IReadOnlyList<AntEnglish.Services.Interfaces.TranscriptLine>)method.Invoke(null, [json])!;
    }
}
