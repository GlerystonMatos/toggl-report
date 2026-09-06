import { useCallback, useState } from 'react';
import { atualizarParametrosGant, obterParametrosGant } from '../../api/gantApi';
import type { AtualizarParametrosGantRequest, ParametrosGant } from '../../api/tipos';

interface EstadoParametrosGant {
    dados: ParametrosGant | null;
    carregando: boolean;
    salvando: boolean;
}

interface ResultadoUseParametrosGant extends EstadoParametrosGant {
    carregar: () => Promise<ParametrosGant>;
    salvar: (dados: AtualizarParametrosGantRequest) => Promise<ParametrosGant>;
}

export function useParametrosGant(): ResultadoUseParametrosGant {
    const [estado, setEstado] = useState<EstadoParametrosGant>({
        dados: null,
        carregando: false,
        salvando: false,
    });

    const carregar = useCallback(async (): Promise<ParametrosGant> => {
        setEstado((atual) => ({ ...atual, carregando: true }));
        try {
            const dados = await obterParametrosGant();
            setEstado({ dados, carregando: false, salvando: false });
            return dados;
        } catch (erro) {
            setEstado((atual) => ({ ...atual, carregando: false }));
            throw erro;
        }
    }, []);

    const salvar = useCallback(
        async (dados: AtualizarParametrosGantRequest): Promise<ParametrosGant> => {
            setEstado((atual) => ({ ...atual, salvando: true }));
            try {
                const atualizado = await atualizarParametrosGant(dados);
                setEstado({ dados: atualizado, carregando: false, salvando: false });
                return atualizado;
            } catch (erro) {
                setEstado((atual) => ({ ...atual, salvando: false }));
                throw erro;
            }
        },
        [],
    );

    return { ...estado, carregar, salvar };
}