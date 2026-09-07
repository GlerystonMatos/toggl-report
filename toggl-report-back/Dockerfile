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

RUN apk add --no-cache su-exec

COPY --chown=$APP_UID:$APP_UID --from=build /app/TogglReport.Api/out .
RUN chown $APP_UID:$APP_UID /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

ENTRYPOINT [ "/entrypoint.sh" ]