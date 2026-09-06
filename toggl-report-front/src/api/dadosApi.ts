import { URL_BASE_API } from './http';

export function urlDownloadDados(): string {
    return `${URL_BASE_API}/api/dados/download`;
}