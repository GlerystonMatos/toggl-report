import { URL_BASE_API } from './http';

export function urlDownloadConfiguracao(): string {
    return `${URL_BASE_API}/api/dados/download/configuracao`;
}

export function urlDownloadCache(): string {
    return `${URL_BASE_API}/api/dados/download/cache`;
}