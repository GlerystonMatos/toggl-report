import { consultar } from '../../api/consultasApi';
import { useConsultaGenerica } from './useConsultaGenerica';
import type { ResultadoUseConsulta } from './useConsultaGenerica';

export function useConsulta(): ResultadoUseConsulta {
    return useConsultaGenerica(consultar);
}