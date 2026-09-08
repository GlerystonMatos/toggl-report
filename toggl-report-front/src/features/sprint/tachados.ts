const prefixo = 'sprint-tachados-';

export function lerTachados(chaveSprint: string): Set<string> {
    try {
        const bruto = localStorage.getItem(prefixo + chaveSprint);
        return bruto ? new Set<string>(JSON.parse(bruto) as string[]) : new Set<string>();
    } catch {
        return new Set<string>();
    }
}

export function gravarTachados(chaveSprint: string, ids: Set<string>): void {
    try {
        localStorage.setItem(prefixo + chaveSprint, JSON.stringify([...ids]));
    } catch {
        /* ignore */
    }
}

export function limparTachados(chaveSprint: string): void {
    try {
        localStorage.removeItem(prefixo + chaveSprint);
    } catch {
        /* ignore */
    }
}

export function idLinhaTarefa(codigo: string, descricao: string, nomeExibicao: string): string {
    return `${codigo}∙${descricao}∙${nomeExibicao}`;
}