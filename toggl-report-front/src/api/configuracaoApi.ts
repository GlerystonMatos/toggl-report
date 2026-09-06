import { http } from './http';
import type { AtualizarParametrosRequest, ParametrosConfiguracao } from './tipos';

export function obterConfiguracao(): Promise<ParametrosConfiguracao> {
    return http.get<ParametrosConfiguracao>('/api/configuracao');
}

export function atualizarConfiguracao(
    dados: AtualizarParametrosRequest,
): Promise<ParametrosConfiguracao> {
    return http.put<ParametrosConfiguracao>('/api/configuracao', dados);
}