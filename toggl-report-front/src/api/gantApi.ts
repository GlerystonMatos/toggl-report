import { http } from './http';

import type {
    ResultadoGant,
    ParametrosGant,
    ConsultarRequest,
    ConsultarResponse,
    AtualizarParametrosGantRequest,
} from './tipos';

export function obterParametrosGant(): Promise<ParametrosGant> {
    return http.get<ParametrosGant>('/api/gant/parametros');
}

export function atualizarParametrosGant(
    dados: AtualizarParametrosGantRequest,
): Promise<ParametrosGant> {
    return http.put<ParametrosGant>('/api/gant/parametros', dados);
}

export function consultarGant(dados: ConsultarRequest): Promise<ConsultarResponse> {
    return http.post<ConsultarResponse>('/api/gant/consultas', dados);
}

export function obterGant(dataInicio: string, dataFim: string, termo?: string): Promise<ResultadoGant> {
    const parametros: Record<string, string> = { dataInicio, dataFim };
    if (termo && termo.trim()) {
        parametros.termo = termo.trim();
    }
    return http.get<ResultadoGant>('/api/gant', parametros);
}