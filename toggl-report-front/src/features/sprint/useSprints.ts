import { useColecaoCrud } from '../../hooks/useColecaoCrud';
import type { CriarSprintRequest, EditarSprintRequest, Sprint } from '../../api/tipos';
import { criarSprint, editarSprint, listarSprints, removerSprint } from '../../api/sprintsApi';

interface ResultadoUseSprints {
    sprints: Sprint[];
    carregando: boolean;
    carregar: () => Promise<Sprint[]>;
    criar: (dados: CriarSprintRequest) => Promise<Sprint>;
    editar: (chave: string, dados: EditarSprintRequest) => Promise<Sprint>;
    remover: (chave: string) => Promise<void>;
}

export function useSprints(): ResultadoUseSprints {
    const { itens, ...resto } = useColecaoCrud<Sprint, CriarSprintRequest, EditarSprintRequest>({
        listar: listarSprints,
        criar: criarSprint,
        editar: editarSprint,
        remover: removerSprint,
    });
    return { sprints: itens, ...resto };
}