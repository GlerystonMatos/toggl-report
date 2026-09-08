import { http } from './http';

import type { Sprint, CriarSprintRequest, EditarSprintRequest } from './tipos';

export function listarSprints(): Promise<Sprint[]> {
    return http.get<Sprint[]>('/api/sprints');
}

export function criarSprint(dados: CriarSprintRequest): Promise<Sprint> {
    return http.post<Sprint>('/api/sprints', dados);
}

export function editarSprint(chave: string, dados: EditarSprintRequest): Promise<Sprint> {
    return http.put<Sprint>(`/api/sprints/${encodeURIComponent(chave)}`, dados);
}

export function removerSprint(chave: string): Promise<void> {
    return http.delete<void>(`/api/sprints/${encodeURIComponent(chave)}`);
}