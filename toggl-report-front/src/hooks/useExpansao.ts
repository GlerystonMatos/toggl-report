import { useCallback, useEffect, useState } from 'react';

interface ResultadoUseExpansao {
    expandido: Record<string, boolean>;
    alternarUm: (chave: string) => void;
    alternarTodos: () => void;
    todosExpandidos: boolean;
}

export function useExpansao(chaves: string[], gatilhoReset?: unknown): ResultadoUseExpansao {
    const chaveConjunto = JSON.stringify(chaves);
    const [expandido, setExpandido] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const proximas: string[] = JSON.parse(chaveConjunto);
        setExpandido(Object.fromEntries(proximas.map((chave) => [chave, false])));
    }, [chaveConjunto, gatilhoReset]);

    const todosExpandidos = chaves.length > 0 && chaves.every((chave) => expandido[chave]);

    const alternarUm = useCallback((chave: string) => {
        setExpandido((atual) => ({ ...atual, [chave]: !atual[chave] }));
    }, []);

    function alternarTodos(): void {
        const novoValor = !todosExpandidos;
        setExpandido(Object.fromEntries(chaves.map((chave) => [chave, novoValor])));
    }

    return { expandido, alternarUm, alternarTodos, todosExpandidos };
}