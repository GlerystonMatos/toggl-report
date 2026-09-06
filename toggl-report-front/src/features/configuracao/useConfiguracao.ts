import { useCallback, useState } from 'react';
import { atualizarConfiguracao, obterConfiguracao } from '../../api/configuracaoApi';
import type { AtualizarParametrosRequest, ParametrosConfiguracao } from '../../api/tipos';

interface EstadoConfiguracao {
    dados: ParametrosConfiguracao | null;
    carregando: boolean;
    salvando: boolean;
}

interface ResultadoUseConfiguracao extends EstadoConfiguracao {
    carregar: () => Promise<ParametrosConfiguracao>;
    salvar: (dados: AtualizarParametrosRequest) => Promise<ParametrosConfiguracao>;
}

export function useConfiguracao(): ResultadoUseConfiguracao {
    const [estado, setEstado] = useState<EstadoConfiguracao>({
        dados: null,
        carregando: false,
        salvando: false,
    });

    const carregar = useCallback(async (): Promise<ParametrosConfiguracao> => {
        setEstado((atual) => ({ ...atual, carregando: true }));
        try {
            const dados = await obterConfiguracao();
            setEstado({ dados, carregando: false, salvando: false });
            return dados;
        } catch (erro) {
            setEstado((atual) => ({ ...atual, carregando: false }));
            throw erro;
        }
    }, []);

    const salvar = useCallback(
        async (dados: AtualizarParametrosRequest): Promise<ParametrosConfiguracao> => {
            setEstado((atual) => ({ ...atual, salvando: true }));
            try {
                const atualizado = await atualizarConfiguracao(dados);
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