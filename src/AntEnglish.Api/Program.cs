using AntEnglish.Data;
using FluentValidation;
using Hangfire;
using Hangfire.InMemory;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseSentry(o =>
{
    o.Dsn = builder.Configuration["Sentry:Dsn"];
    o.TracesSampleRate = 0.1;
});

builder.Services.AddControllers();

builder.Services.AddDbContext<AntDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsql => npgsql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery))
    .UseSnakeCaseNamingConvention());

var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? throw new InvalidOperationException("Supabase:Url is required");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Supabase exposes OIDC discovery at {url}/auth/v1/.well-known/openid-configuration
        // .NET fetches the JWKS automatically — no secret needed in config
        options.Authority = $"{supabaseUrl}/auth/v1";
        options.Audience = "authenticated";
        options.TokenValidationParameters.ValidateIssuerSigningKey = true;
        options.TokenValidationParameters.ValidIssuer = $"{supabaseUrl}/auth/v1";
    });

builder.Services.AddAuthorization();

builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddHangfire(config =>
    config.UseInMemoryStorage());
builder.Services.AddHangfireServer();

var app = builder.Build();

app.UseSentryTracing();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }));
app.UseHangfireDashboard("/hangfire");

app.Run();
