FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["AntEnglish.Api/AntEnglish.Api.csproj", "AntEnglish.Api/"]
COPY ["AntEnglish.Services/AntEnglish.Services.csproj", "AntEnglish.Services/"]
COPY ["AntEnglish.Data/AntEnglish.Data.csproj", "AntEnglish.Data/"]
RUN dotnet restore "AntEnglish.Api/AntEnglish.Api.csproj"
COPY . .
RUN dotnet publish "AntEnglish.Api/AntEnglish.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AntEnglish.Api.dll"]
