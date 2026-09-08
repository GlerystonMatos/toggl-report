import { useRecursoEditavel } from '../../hooks/useRecursoEditavel';
import type { ResultadoUseRecursoEditavel } from '../../hooks/useRecursoEditavel';
import type { AtualizarCategoriasSprintRequest, CategoriasSprint } from '../../api/tipos';
import { atualizarCategoriasSprint, obterCategoriasSprint } from '../../api/categoriasSprintApi';

export function useCategoriasSprint(): ResultadoUseRecursoEditavel<CategoriasSprint, AtualizarCategoriasSprintRequest> {
    return useRecursoEditavel(obterCategoriasSprint, atualizarCategoriasSprint);
}