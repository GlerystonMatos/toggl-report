import { useCallback, useState } from 'react';
import type { ConsultarRequest, ConsultarResponse } from '../../api/tipos';

export interface ResultadoUseConsulta {
    resultado: ConsultarResponse | null;
    consultando: boolean;
    executar: (dataInicio: string, dataFim: string, forcarConsultaApi: boolean) => Promise<ConsultarResponse>;
}

export function useConsultaGenerica(
    consultar: (dados: ConsultarRequest) => Promise<ConsultarResponse>,
): ResultadoUseConsulta {
    const [resultado, setResultado] = useState<ConsultarResponse | null>(null);
    const [consultando, setConsultando] = useState(false);

    const executar = useCallback(
        async (dataInicio: string, dataFim: string, forcarConsultaApi: boolean): Promise<ConsultarResponse> => {
            setConsultando(true);
            try {
                const resposta = await consultar({ dataInicio, dataFim, forcarConsultaApi });
                setResultado(resposta);
                return resposta;
            } finally {
                setConsultando(false);
            }
        },
        [consultar],
    );

    return { resultado, consultando, executar };
}