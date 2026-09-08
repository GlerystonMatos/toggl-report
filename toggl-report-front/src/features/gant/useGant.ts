import { obterGant } from '../../api/gantApi';
import { useRecurso } from '../../hooks/useRecurso';
import type { ResultadoGant } from '../../api/tipos';

interface ResultadoUseGant {
    gant: ResultadoGant | null;
    carregando: boolean;
    carregar: (dataInicio: string, dataFim: string, termo?: string) => Promise<ResultadoGant>;
}

export function useGant(): ResultadoUseGant {
    const { dados, carregando, carregar } = useRecurso(obterGant);
    return { gant: dados, carregando, carregar };
}