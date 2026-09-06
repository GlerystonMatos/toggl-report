import { http } from './http';
import type { ConsultarRequest, ConsultarResponse } from './tipos';

export function consultar(dados: ConsultarRequest): Promise<ConsultarResponse> {
    return http.post<ConsultarResponse>('/api/consultas', dados);
}