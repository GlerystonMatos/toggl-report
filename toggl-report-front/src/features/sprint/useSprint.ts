import { obterSprint } from '../../api/sprintApi';
import { useRecurso } from '../../hooks/useRecurso';
import type { ResultadoSprint } from '../../api/tipos';

interface ResultadoUseSprint {
    resultado: ResultadoSprint | null;
    carregando: boolean;
    carregar: (chaveSprint: string) => Promise<ResultadoSprint>;
}

export function useSprint(): ResultadoUseSprint {
    const { dados, carregando, carregar } = useRecurso(obterSprint);
    return { resultado: dados, carregando, carregar };
}