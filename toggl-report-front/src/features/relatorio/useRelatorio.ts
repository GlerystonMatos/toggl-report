import { useCallback, useState } from 'react';
import { obterRelatorio } from '../../api/relatorioApi';
import type { RelatorioResponse } from '../../api/tipos';

interface ResultadoUseRelatorio {
    relatorio: RelatorioResponse | null;
    carregando: boolean;
    carregar: (dataInicio: string, dataFim: string) => Promise<RelatorioResponse>;
}

export function useRelatorio(): ResultadoUseRelatorio {
    const [relatorio, setRelatorio] = useState<RelatorioResponse | null>(null);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(async (dataInicio: string, dataFim: string): Promise<RelatorioResponse> => {
        setCarregando(true);
        try {
            const dados = await obterRelatorio(dataInicio, dataFim);
            setRelatorio(dados);
            return dados;
        } finally {
            setCarregando(false);
        }
    }, []);

    return { relatorio, carregando, carregar };
}