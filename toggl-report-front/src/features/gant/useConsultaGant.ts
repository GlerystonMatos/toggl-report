import { consultarGant } from '../../api/gantApi';
import { useConsultaGenerica } from '../consulta/useConsultaGenerica';
import type { ResultadoUseConsulta } from '../consulta/useConsultaGenerica';

export function useConsultaGant(): ResultadoUseConsulta {
    return useConsultaGenerica(consultarGant);
}