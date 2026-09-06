import type { LinhaDescricao } from '../../api/tipos';

export interface LinhaDescricaoExibicao {
    chave: string;
    texto: string;
    segundos: number;
}

export function curarPorDescricao(linhas: LinhaDescricao[]): LinhaDescricaoExibicao[] {
    const decorado = linhas.map((linha, indice) => ({
        linha,
        indice,
        ehTel: /^TEL/i.test(linha.descricao),
    }));

    const porTempoDecrescente = (
        a: (typeof decorado)[number],
        b: (typeof decorado)[number],
    ): number => b.linha.segundos - a.linha.segundos;

    const doTel = decorado.filter((item) => item.ehTel).sort(porTempoDecrescente);
    const demais = decorado.filter((item) => !item.ehTel).sort(porTempoDecrescente);

    return [...doTel, ...demais].map((item) => ({
        chave: `${item.ehTel ? 'tel' : 'outro'}-${item.indice}`,
        texto: item.ehTel ? item.linha.descricao : `(${item.linha.tag ?? 'sem tag'}) ${item.linha.descricao}`,
        segundos: item.linha.segundos,
    }));
}

export function ordenarPorTag(porTag: Record<string, number>): { tag: string; segundos: number }[] {
    return Object.entries(porTag)
        .map(([tag, segundos]) => ({ tag, segundos }))
        .sort((a, b) => b.segundos - a.segundos);
}