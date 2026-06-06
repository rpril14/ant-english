using AntEnglish.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace AntEnglish.Data;

public class AntDbContext(DbContextOptions<AntDbContext> options) : DbContext(options)
{
    public DbSet<Video> Videos => Set<Video>();
    public DbSet<Sentence> Sentences => Set<Sentence>();
    public DbSet<UserVideo> UserVideos => Set<UserVideo>();
    public DbSet<UserProgress> UserProgresses => Set<UserProgress>();
    public DbSet<SavedSentence> SavedSentences => Set<SavedSentence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Video>(e =>
        {
            e.HasIndex(v => v.YoutubeId).IsUnique();
            e.Property(v => v.TranscriptStatus).HasDefaultValue("queued");
            e.Property(v => v.SentenceCount).HasDefaultValue(0);
            e.Property(v => v.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<Sentence>(e =>
        {
            e.Property(s => s.NamedEntities).HasColumnType("text[]").HasDefaultValue(Array.Empty<string>());
            e.HasOne(s => s.Video).WithMany(v => v.Sentences).HasForeignKey(s => s.VideoId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserVideo>(e =>
        {
            e.HasIndex(uv => new { uv.UserId, uv.VideoId }).IsUnique();
            e.Property(uv => uv.AddedAt).HasDefaultValueSql("now()");
            e.Property(uv => uv.IsFavorited).HasDefaultValue(false);
            e.Property(uv => uv.CustomTags).HasColumnType("text[]").HasDefaultValue(Array.Empty<string>());
        });

        modelBuilder.Entity<UserProgress>(e =>
        {
            e.HasIndex(up => new { up.UserId, up.SentenceId }).IsUnique();
            e.Property(up => up.Attempts).HasDefaultValue(0);
            e.Property(up => up.HintLevelUsed).HasDefaultValue(0);
            e.HasOne(up => up.Sentence).WithMany(s => s.UserProgresses).HasForeignKey(up => up.SentenceId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavedSentence>(e =>
        {
            e.HasIndex(ss => new { ss.UserId, ss.SentenceId }).IsUnique();
            e.Property(ss => ss.SavedAt).HasDefaultValueSql("now()");
            e.Property(ss => ss.ReviewInterval).HasDefaultValue(1);
            e.Property(ss => ss.ReviewEase).HasDefaultValue(2.5);
            e.Property(ss => ss.NextReviewAt).HasDefaultValueSql("now()");
            e.HasOne(ss => ss.Sentence).WithMany(s => s.SavedSentences).HasForeignKey(ss => ss.SentenceId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
