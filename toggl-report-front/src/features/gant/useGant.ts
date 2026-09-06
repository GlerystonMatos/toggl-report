import { useCallback, useState } from 'react';
import { obterGant } from '../../api/gantApi';
import type { ResultadoGant } from '../../api/tipos';

interface ResultadoUseGant {
    gant: ResultadoGant | null;
    carregando: boolean;
    carregar: (dataInicio: string, dataFim: string, termo?: string) => Promise<ResultadoGant>;
}

export function useGant(): ResultadoUseGant {
    const [gant, setGant] = useState<ResultadoGant | null>(null);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(async (dataInicio: string, dataFim: string, termo?: string): Promise<ResultadoGant> => {
        setCarregando(true);
        try {
            const dados = await obterGant(dataInicio, dataFim, termo);
            setGant(dados);
            return dados;
        } finally {
            setCarregando(false);
        }
    }, []);

    return { gant, carregando, carregar };
}