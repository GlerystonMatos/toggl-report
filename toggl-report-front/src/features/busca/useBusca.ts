import { useCallback, useState } from 'react';
import { buscarPorDescricao } from '../../api/buscaApi';
import type { ResultadoBuscaDescricao } from '../../api/tipos';

interface ResultadoUseBusca {
    resultado: ResultadoBuscaDescricao | null;
    buscando: boolean;
    buscar: (termo: string) => Promise<ResultadoBuscaDescricao>;
    limpar: () => void;
}

export function useBusca(): ResultadoUseBusca {
    const [resultado, setResultado] = useState<ResultadoBuscaDescricao | null>(null);
    const [buscando, setBuscando] = useState(false);

    const buscar = useCallback(async (termo: string): Promise<ResultadoBuscaDescricao> => {
        setBuscando(true);
        try {
            const dados = await buscarPorDescricao(termo);
            setResultado(dados);
            return dados;
        } finally {
            setBuscando(false);
        }
    }, []);

    const limpar = useCallback(() => setResultado(null), []);

    return { resultado, buscando, buscar, limpar };
}