import { useCallback } from 'react';
import { useColecaoCrud } from '../../hooks/useColecaoCrud';
import type { CriarUsuarioRequest, EditarUsuarioRequest, UsuarioResumo } from '../../api/tipos';

import {
    criarUsuario,
    validarToken,
    editarUsuario,
    listarUsuarios,
    removerUsuario,
} from '../../api/usuariosApi';

interface ResultadoUseUsuarios {
    usuarios: UsuarioResumo[];
    carregando: boolean;
    carregar: () => Promise<UsuarioResumo[]>;
    criar: (dados: CriarUsuarioRequest) => Promise<UsuarioResumo>;
    editar: (chave: string, dados: EditarUsuarioRequest) => Promise<UsuarioResumo>;
    remover: (chave: string) => Promise<void>;
    validar: (tokenApi: string) => Promise<boolean>;
}

export function useUsuarios(): ResultadoUseUsuarios {
    const { itens, ...resto } = useColecaoCrud<UsuarioResumo, CriarUsuarioRequest, EditarUsuarioRequest>({
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