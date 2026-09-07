#!/bin/sh
set -e

mkdir -p /app/dados
chown -R "$APP_UID":"$APP_UID" /app/dados

exec su-exec "$APP_UID" dotnet TogglReport.Api.dll