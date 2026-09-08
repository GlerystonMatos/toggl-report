import { useRecursoEditavel } from '../../hooks/useRecursoEditavel';
import type { ResultadoUseRecursoEditavel } from '../../hooks/useRecursoEditavel';
import { atualizarConfiguracao, obterConfiguracao } from '../../api/configuracaoApi';
import type { AtualizarParametrosRequest, ParametrosConfiguracao } from '../../api/tipos';

export function useConfiguracao(): ResultadoUseRecursoEditavel<ParametrosConfiguracao, AtualizarParametrosRequest> {
    return useRecursoEditavel(obterConfiguracao, atualizarConfiguracao);
}