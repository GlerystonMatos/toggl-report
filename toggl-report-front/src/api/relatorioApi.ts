import { http } from './http';
import type { RelatorioResponse } from './tipos';

export function obterRelatorio(dataInicio: string, dataFim: string): Promise<RelatorioResponse> {
    return http.get<RelatorioResponse>('/api/relatorio', { dataInicio, dataFim });
}