import { useCallback, useState } from 'react';

export interface ResultadoUseRecurso<TArgs extends unknown[], TResp> {
    dados: TResp | null;
    carregando: boolean;
    carregar: (...args: TArgs) => Promise<TResp>;
}

export function useRecurso<TArgs extends unknown[], TResp>(
    fn: (...args: TArgs) => Promise<TResp>,
): ResultadoUseRecurso<TArgs, TResp> {
    const [dados, setDados] = useState<TResp | null>(null);
    const [carregando, setCarregando] = useState(false);

    const carregar = useCallback(
        async (...args: TArgs): Promise<TResp> => {
            setCarregando(true);
            try {
                const resultado = await fn(...args);
                setDados(resultado);
                return resultado;
            } finally {
                setCarregando(false);
            }
        },
        [fn],
    );

    return { dados, carregando, carregar };
}