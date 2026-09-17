import { useRecursoEditavel } from '../../hooks/useRecursoEditavel';
import type { ResultadoUseRecursoEditavel } from '../../hooks/useRecursoEditavel';
import type { AtualizarStatusFinalSprintRequest, StatusFinalSprint } from '../../api/tipos';
import { atualizarStatusFinalSprint, obterStatusFinalSprint } from '../../api/statusFinalSprintApi';

export function useStatusFinalSprint(): ResultadoUseRecursoEditavel<StatusFinalSprint, AtualizarStatusFinalSprintRequest> {
    return useRecursoEditavel(obterStatusFinalSprint, atualizarStatusFinalSprint);
}