using AntEnglish.Services.Services;

namespace AntEnglish.Tests.Unit;

public class SrtParser_test : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), $"srtparser-test-{Guid.NewGuid()}");

    public SrtParser_test() => Directory.CreateDirectory(_tempDir);

    public void Dispose() => Directory.Delete(_tempDir, recursive: true);

    private string WriteTempVtt(string content)
    {
        var path = Path.Combine(_tempDir, $"{Guid.NewGuid()}.vtt");
        File.WriteAllText(path, content);
        return path;
    }

    [Fact]
    public void Parse_BasicVtt_ReturnsSentences()
    {
        // Arrange
        var path = WriteTempVtt("""
            WEBVTT

            00:00:01.000 --> 00:00:03.000
            Hello world

            00:00:04.000 --> 00:00:06.000
            How are you
            """);

        // Act
        var result = new SrtParser().Parse(path);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Equal("Hello world", result[0].Text);
        Assert.Equal(1000, result[0].StartMs);
        Assert.Equal(3000, result[0].EndMs);
    }

    [Fact]
    public void Parse_DuplicateRollingCues_Deduplicates()
    {
        // Arrange — VTT often emits same text in consecutive cues (rolling captions)
        var path = WriteTempVtt("""
            WEBVTT

            00:00:01.000 --> 00:00:02.000
            Hello

            00:00:01.500 --> 00:00:03.000
            Hello

            00:00:03.000 --> 00:00:05.000
            World
            """);

        // Act
        var result = new SrtParser().Parse(path);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Equal("Hello", result[0].Text);
        Assert.Equal("World", result[1].Text);
    }

    [Fact]
    public void Parse_CueTags_Stripped()
    {
        // Arrange
        var path = WriteTempVtt("""
            WEBVTT

            00:00:01.000 --> 00:00:03.000
            <00:00:01.000><c>Hello</c> <c>world</c>
            """);

        // Act
        var result = new SrtParser().Parse(path);

        // Assert
        Assert.Single(result);
        Assert.Equal("Hello world", result[0].Text);
    }

    [Fact]
    public void Parse_EmptyFile_ReturnsEmpty()
    {
        // Arrange
        var path = WriteTempVtt("WEBVTT\n");

        // Act
        var result = new SrtParser().Parse(path);

        // Assert
        Assert.Empty(result);
    }
}
