import { http } from './http';

import type { AtualizarStatusFinalSprintRequest, StatusFinalSprint } from './tipos';

export function obterStatusFinalSprint(): Promise<StatusFinalSprint> {
    return http.get<StatusFinalSprint>('/api/sprint/status-final');
}

export function atualizarStatusFinalSprint(
    dados: AtualizarStatusFinalSprintRequest,
): Promise<StatusFinalSprint> {
    return http.put<StatusFinalSprint>('/api/sprint/status-final', dados);
}