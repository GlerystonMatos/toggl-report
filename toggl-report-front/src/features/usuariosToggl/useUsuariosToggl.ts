import { useCallback } from 'react';
import { useColecaoCrud } from '../../hooks/useColecaoCrud';
import type { CriarUsuarioTogglRequest, EditarUsuarioTogglRequest, UsuarioTogglResumo } from '../../api/tipos';

import {
    criarUsuario,
    validarToken,
    editarUsuario,
    listarUsuarios,
    removerUsuario,
} from '../../api/usuariosTogglApi';

interface ResultadoUseUsuariosToggl {
    usuarios: UsuarioTogglResumo[];
    carregando: boolean;
    carregar: () => Promise<UsuarioTogglResumo[]>;
    criar: (dados: CriarUsuarioTogglRequest) => Promise<UsuarioTogglResumo>;
    editar: (chave: string, dados: EditarUsuarioTogglRequest) => Promise<UsuarioTogglResumo>;
    remover: (chave: string) => Promise<void>;
    validar: (tokenApi: string) => Promise<boolean>;
}

export function useUsuariosToggl(): ResultadoUseUsuariosToggl {
    const { itens, ...resto } = useColecaoCrud<UsuarioTogglResumo, CriarUsuarioTogglRequest, EditarUsuarioTogglRequest>({
        listar: listarUsuarios,
        criar: criarUsuario,
        editar: editarUsuario,
        remover: removerUsuario,
    });

    const validar = useCallback(async (tokenApi: string): Promise<boolean> => {
        const resultado = await validarToken(tokenApi);
        return resultado.valido;
    }, []);

    return { usuarios: itens, ...resto, validar };
}