import { http } from './http';

import type {
    UsuarioResumo,
    CriarUsuarioRequest,
    EditarUsuarioRequest,
    ValidarTokenResponse,
} from './tipos';

export function listarUsuarios(): Promise<UsuarioResumo[]> {
    return http.get<UsuarioResumo[]>('/api/usuarios');
}

export function validarToken(tokenApi: string): Promise<ValidarTokenResponse> {
    return http.post<ValidarTokenResponse>('/api/usuarios/validar-token', { tokenApi });
}

export function criarUsuario(dados: CriarUsuarioRequest): Promise<UsuarioResumo> {
    return http.post<UsuarioResumo>('/api/usuarios', dados);
}

export function editarUsuario(chave: string, dados: EditarUsuarioRequest): Promise<UsuarioResumo> {
    return http.put<UsuarioResumo>(`/api/usuarios/${encodeURIComponent(chave)}`, dados);
}

export function removerUsuario(chave: string): Promise<void> {
    return http.delete<void>(`/api/usuarios/${encodeURIComponent(chave)}`);
}