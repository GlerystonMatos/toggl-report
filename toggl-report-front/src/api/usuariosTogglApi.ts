import { http } from './http';

import type {
    UsuarioTogglResumo,
    CriarUsuarioTogglRequest,
    EditarUsuarioTogglRequest,
    ValidarTokenResponse,
} from './tipos';

export function listarUsuarios(): Promise<UsuarioTogglResumo[]> {
    return http.get<UsuarioTogglResumo[]>('/api/usuarios-toggl');
}

export function validarToken(tokenApi: string): Promise<ValidarTokenResponse> {
    return http.post<ValidarTokenResponse>('/api/usuarios-toggl/validar-token', { tokenApi });
}

export function criarUsuario(dados: CriarUsuarioTogglRequest): Promise<UsuarioTogglResumo> {
    return http.post<UsuarioTogglResumo>('/api/usuarios-toggl', dados);
}

export function editarUsuario(chave: string, dados: EditarUsuarioTogglRequest): Promise<UsuarioTogglResumo> {
    return http.put<UsuarioTogglResumo>(`/api/usuarios-toggl/${encodeURIComponent(chave)}`, dados);
}

export function removerUsuario(chave: string): Promise<void> {
    return http.delete<void>(`/api/usuarios-toggl/${encodeURIComponent(chave)}`);
}