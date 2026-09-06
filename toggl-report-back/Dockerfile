FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

COPY TogglReport.Api/*.csproj ./TogglReport.Api/
COPY TogglReport.Nucleo/*.csproj ./TogglReport.Nucleo/

RUN dotnet restore TogglReport.Api/TogglReport.Api.csproj

COPY TogglReport.Api/. ./TogglReport.Api/
COPY TogglReport.Nucleo/. ./TogglReport.Nucleo/

WORKDIR /app/TogglReport.Api
RUN dotnet publish -c Release -o out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine
WORKDIR /app

COPY --chown=$APP_UID:$APP_UID --from=build /app/TogglReport.Api/out .
RUN chown $APP_UID:$APP_UID /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

USER $APP_UID

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT [ "dotnet", "TogglReport.Api.dll" ]