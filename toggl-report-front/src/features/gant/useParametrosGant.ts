import { useRecursoEditavel } from '../../hooks/useRecursoEditavel';
import type { ResultadoUseRecursoEditavel } from '../../hooks/useRecursoEditavel';
import { atualizarParametrosGant, obterParametrosGant } from '../../api/gantApi';
import type { AtualizarParametrosGantRequest, ParametrosGant } from '../../api/tipos';

export function useParametrosGant(): ResultadoUseRecursoEditavel<ParametrosGant, AtualizarParametrosGantRequest> {
    return useRecursoEditavel(obterParametrosGant, atualizarParametrosGant);
}