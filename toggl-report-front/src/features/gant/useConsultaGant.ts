import { useCallback, useState } from 'react';
import { consultarGant } from '../../api/gantApi';
import type { ConsultarResponse } from '../../api/tipos';

interface ResultadoUseConsultaGant {
    resultado: ConsultarResponse | null;
    consultando: boolean;
    executar: (dataInicio: string, dataFim: string, forcarConsultaApi: boolean) => Promise<ConsultarResponse>;
}

export function useConsultaGant(): ResultadoUseConsultaGant {
    const [resultado, setResultado] = useState<ConsultarResponse | null>(null);
    const [consultando, setConsultando] = useState(false);

    const executar = useCallback(
        async (dataInicio: string, dataFim: string, forcarConsultaApi: boolean): Promise<ConsultarResponse> => {
            setConsultando(true);
            try {
                const resposta = await consultarGant({ dataInicio, dataFim, forcarConsultaApi });
                setResultado(resposta);
                return resposta;
            } finally {
                setConsultando(false);
            }
        },
        [],
    );

    return { resultado, consultando, executar };
}