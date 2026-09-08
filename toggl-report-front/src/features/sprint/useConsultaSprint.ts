import { consultarSprint } from '../../api/sprintApi';
import { useConsultaGenerica } from '../consulta/useConsultaGenerica';
import type { ResultadoUseConsulta } from '../consulta/useConsultaGenerica';

export function useConsultaSprint(): ResultadoUseConsulta {
    return useConsultaGenerica(consultarSprint);
}