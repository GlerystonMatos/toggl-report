import { useCallback, useState } from 'react';
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
    const [usuarios, setUsuarios] = useState<UsuarioResumo[]>([]);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(async (): Promise<UsuarioResumo[]> => {
        setCarregando(true);
        try {
            const lista = await listarUsuarios();
            setUsuarios(lista);
            return lista;
        } finally {
            setCarregando(false);
        }
    }, []);

    const criar = useCallback(async (dados: CriarUsuarioRequest): Promise<UsuarioResumo> => {
        const criado = await criarUsuario(dados);
        setUsuarios((atual) => [...atual, criado]);
        return criado;
    }, []);

    const editar = useCallback(
        async (chave: string, dados: EditarUsuarioRequest): Promise<UsuarioResumo> => {
            const atualizado = await editarUsuario(chave, dados);
            setUsuarios((atual) => atual.map((usuario) => (usuario.chave === chave ? atualizado : usuario)));
            return atualizado;
        },
        [],
    );

    const remover = useCallback(async (chave: string): Promise<void> => {
        await removerUsuario(chave);
        setUsuarios((atual) => atual.filter((usuario) => usuario.chave !== chave));
    }, []);

    const validar = useCallback(async (tokenApi: string): Promise<boolean> => {
        const resultado = await validarToken(tokenApi);
        return resultado.valido;
    }, []);

    return { usuarios, carregando, carregar, criar, editar, remover, validar };
}