using AntEnglish.Services.Interfaces;
using AntEnglish.Services.Services;

namespace AntEnglish.Tests.Unit;

public class MatchingService_test
{
    private readonly IMatchingService _sut = new MatchingService();

    // ── Normalisation ────────────────────────────────────────────────────────

    [Fact]
    public void Match_NormalisedInput_FullMatchReturns100()
    {
        // Arrange — AC-102-3: smart apostrophe, punctuation, mixed case
        // Act
        var result = _sut.Match("im here to learn english", "I'm here to learn English.", []);

        // Assert
        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void Match_ExtraWhitespace_Normalised()
    {
        // Arrange
        // Act
        var result = _sut.Match("hello  world", "hello world", []);

        // Assert
        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void Match_SmartApostrophe_TreatedAsApostrophe()
    {
        // Arrange — ’ is the "right single quotation mark"
        // Act
        var result = _sut.Match("it’s fine", "It's fine", []);

        // Assert
        Assert.Equal(100, result.Score);
    }

    // ── Word status ──────────────────────────────────────────────────────────

    [Fact]
    public void Match_ExactInput_AllWordsCorrect()
    {
        // Arrange
        // Act
        var result = _sut.Match("hello world", "Hello world.", []);

        // Assert
        Assert.All(result.Words, w => Assert.Equal(WordStatus.Correct, w.Status));
    }

    [Fact]
    public void Match_InputShorterThanReference_TrailingWordsMissing()
    {
        // Arrange
        // Act
        var result = _sut.Match("hello", "hello world", []);

        // Assert
        Assert.Equal(WordStatus.Correct, result.Words[0].Status);
        Assert.Equal(WordStatus.Missing, result.Words[1].Status);
    }

    [Fact]
    public void Match_WrongWordAtPosition_WordIsIncorrect()
    {
        // Arrange
        // Act
        var result = _sut.Match("hello xyz", "hello world", []);

        // Assert
        Assert.Equal(WordStatus.Correct, result.Words[0].Status);
        Assert.Equal(WordStatus.Incorrect, result.Words[1].Status);
    }

    [Fact]
    public void Match_EmptyInput_AllWordsMissing()
    {
        // Arrange
        // Act
        var result = _sut.Match("", "hello world", []);

        // Assert
        Assert.All(result.Words, w => Assert.Equal(WordStatus.Missing, w.Status));
        Assert.Equal(0, result.Score);
    }

    // ── Score calculation ────────────────────────────────────────────────────

    [Fact]
    public void Match_HalfCorrect_Returns50()
    {
        // Arrange
        // Act
        var result = _sut.Match("hello", "hello world", []);

        // Assert
        Assert.Equal(50, result.Score);
    }

    [Fact]
    public void Match_NoneCorrect_Returns0()
    {
        // Arrange
        // Act
        var result = _sut.Match("foo bar", "hello world", []);

        // Assert
        Assert.Equal(0, result.Score);
    }

    // ── Named entity exclusion ───────────────────────────────────────────────

    [Fact]
    public void Match_NamedEntityIncorrect_NotPenalisedInScore()
    {
        // Arrange — "London" is a proper noun; user typed it wrong but score ignores it
        // Act
        var result = _sut.Match("i live in paris", "I live in London.", ["London"]);

        // Assert — only "i", "live", "in" are scoreable; all correct → 100
        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void Match_AllProperNouns_Returns100()
    {
        // Arrange
        // Act
        var result = _sut.Match("", "London Paris", ["London", "Paris"]);

        // Assert
        Assert.Equal(100, result.Score);
    }

    [Fact]
    public void Match_NamedEntityCaseInsensitiveExclusion_Excluded()
    {
        // Arrange — named entities list stores original case; comparison normalised
        // Act
        var result = _sut.Match("hello world", "Hello London.", ["London"]);

        // Assert — only "hello" is scoreable; correct → 100
        Assert.Equal(100, result.Score);
    }
}
