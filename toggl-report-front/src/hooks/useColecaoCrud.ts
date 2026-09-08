import { useCallback, useState } from 'react';

interface OperacoesColecao<T, TCriar, TEditar> {
    listar: () => Promise<T[]>;
    criar: (dados: TCriar) => Promise<T>;
    editar: (chave: string, dados: TEditar) => Promise<T>;
    remover: (chave: string) => Promise<void>;
}

export interface ResultadoUseColecaoCrud<T, TCriar, TEditar> {
    itens: T[];
    carregando: boolean;
    carregar: () => Promise<T[]>;
    criar: (dados: TCriar) => Promise<T>;
    editar: (chave: string, dados: TEditar) => Promise<T>;
    remover: (chave: string) => Promise<void>;
}

export function useColecaoCrud<T extends { chave: string }, TCriar, TEditar>({
    listar,
    criar: criarApi,
    editar: editarApi,
    remover: removerApi,
}: OperacoesColecao<T, TCriar, TEditar>): ResultadoUseColecaoCrud<T, TCriar, TEditar> {
    const [itens, setItens] = useState<T[]>([]);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(async (): Promise<T[]> => {
        setCarregando(true);
        try {
            const lista = await listar();
            setItens(lista);
            return lista;
        } finally {
            setCarregando(false);
        }
    }, [listar]);

    const criar = useCallback(async (dados: TCriar): Promise<T> => {
        const criado = await criarApi(dados);
        setItens((atual) => [...atual, criado]);
        return criado;
    }, [criarApi]);

    const editar = useCallback(
        async (chave: string, dados: TEditar): Promise<T> => {
            const atualizado = await editarApi(chave, dados);
            setItens((atual) => atual.map((item) => (item.chave === chave ? atualizado : item)));
            return atualizado;
        },
        [editarApi],
    );

    const remover = useCallback(
        async (chave: string): Promise<void> => {
            await removerApi(chave);
            setItens((atual) => atual.filter((item) => item.chave !== chave));
        },
        [removerApi],
    );

    return { itens, carregando, carregar, criar, editar, remover };
}