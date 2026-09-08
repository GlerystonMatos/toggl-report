import { useCallback, useState } from 'react';

interface EstadoRecurso<T> {
    dados: T | null;
    carregando: boolean;
    salvando: boolean;
}

export interface ResultadoUseRecursoEditavel<T, TReq> extends EstadoRecurso<T> {
    carregar: () => Promise<T>;
    salvar: (dados: TReq) => Promise<T>;
}

export function useRecursoEditavel<T, TReq>(
    obter: () => Promise<T>,
    atualizar: (dados: TReq) => Promise<T>,
): ResultadoUseRecursoEditavel<T, TReq> {
    const [estado, setEstado] = useState<EstadoRecurso<T>>({
        dados: null,
        carregando: false,
        salvando: false,
    });

    const carregar = useCallback(async (): Promise<T> => {
        setEstado((atual) => ({ ...atual, carregando: true }));
        try {
            const dados = await obter();
            setEstado({ dados, carregando: false, salvando: false });
            return dados;
        } catch (erro) {
            setEstado((atual) => ({ ...atual, carregando: false }));
            throw erro;
        }
    }, [obter]);

    const salvar = useCallback(
        async (dados: TReq): Promise<T> => {
            setEstado((atual) => ({ ...atual, salvando: true }));
            try {
                const atualizado = await atualizar(dados);
                setEstado({ dados: atualizado, carregando: false, salvando: false });
                return atualizado;
            } catch (erro) {
                setEstado((atual) => ({ ...atual, salvando: false }));
                throw erro;
            }
        },
        [atualizar],
    );

    return { ...estado, carregar, salvar };
}