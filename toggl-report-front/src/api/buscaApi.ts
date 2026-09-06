import { http } from './http';
import type { ResultadoBuscaDescricao } from './tipos';

export function buscarPorDescricao(termo: string): Promise<ResultadoBuscaDescricao> {
    return http.get<ResultadoBuscaDescricao>('/api/busca', { termo });
}