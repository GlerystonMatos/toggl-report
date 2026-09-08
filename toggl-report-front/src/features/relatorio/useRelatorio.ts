import { useRecurso } from '../../hooks/useRecurso';
import { obterRelatorio } from '../../api/relatorioApi';
import type { RelatorioResponse } from '../../api/tipos';

interface ResultadoUseRelatorio {
    relatorio: RelatorioResponse | null;
    carregando: boolean;
    carregar: (dataInicio: string, dataFim: string) => Promise<RelatorioResponse>;
}

export function useRelatorio(): ResultadoUseRelatorio {
    const { dados, carregando, carregar } = useRecurso(obterRelatorio);
    return { relatorio: dados, carregando, carregar };
}