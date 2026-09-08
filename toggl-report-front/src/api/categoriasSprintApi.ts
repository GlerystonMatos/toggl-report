import { http } from './http';

import type { AtualizarCategoriasSprintRequest, CategoriasSprint } from './tipos';

export function obterCategoriasSprint(): Promise<CategoriasSprint> {
    return http.get<CategoriasSprint>('/api/sprint/categorias');
}

export function atualizarCategoriasSprint(
    dados: AtualizarCategoriasSprintRequest,
): Promise<CategoriasSprint> {
    return http.put<CategoriasSprint>('/api/sprint/categorias', dados);
}