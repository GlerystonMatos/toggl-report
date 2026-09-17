import { useCallback } from 'react';
import { useColecaoCrud } from '../../hooks/useColecaoCrud';
import type { CriarSprintRequest, EditarSprintRequest, Sprint } from '../../api/tipos';
import { criarSprint, editarSprint, listarSprints, removerSprint, reabrirSprint } from '../../api/sprintsApi';

interface ResultadoUseSprints {
    sprints: Sprint[];
    carregando: boolean;
    carregar: () => Promise<Sprint[]>;
    criar: (dados: CriarSprintRequest) => Promise<Sprint>;
    editar: (chave: string, dados: EditarSprintRequest) => Promise<Sprint>;
    remover: (chave: string) => Promise<void>;
    reabrir: (chave: string) => Promise<Sprint>;
}

export function useSprints(): ResultadoUseSprints {
    const { itens, carregar, ...resto } = useColecaoCrud<Sprint, CriarSprintRequest, EditarSprintRequest>({
        listar: listarSprints,
        criar: criarSprint,
        editar: editarSprint,
        remover: removerSprint,
    });

    const reabrir = useCallback(
        async (chave: string): Promise<Sprint> => {
            const atualizado = await reabrirSprint(chave);
            await carregar();
            return atualizado;
        },
        [carregar],
    );

    return { sprints: itens, carregar, reabrir, ...resto };
}