FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
RUN apt-get update && apt-get install -y python3 python3-pip \
    && pip3 install youtube-transcript-api --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /repo
COPY ["src/AntEnglish.Api/AntEnglish.Api.csproj", "src/AntEnglish.Api/"]
COPY ["src/AntEnglish.Services/AntEnglish.Services.csproj", "src/AntEnglish.Services/"]
COPY ["src/AntEnglish.Data/AntEnglish.Data.csproj", "src/AntEnglish.Data/"]
RUN dotnet restore "src/AntEnglish.Api/AntEnglish.Api.csproj"
COPY . .
RUN dotnet publish "src/AntEnglish.Api/AntEnglish.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AntEnglish.Api.dll"]
