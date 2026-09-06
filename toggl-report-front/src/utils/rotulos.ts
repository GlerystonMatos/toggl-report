import type { Agrupamento } from '../api/tipos';

export const OPCOES_AGRUPAMENTO: { valor: Agrupamento; rotulo: string }[] = [
    { valor: 'descricao', rotulo: 'Por descrição' },
    { valor: 'tag', rotulo: 'Por tag' },
    { valor: 'ambos', rotulo: 'Ambos' },
];

export function rotularAgrupamento(valor: Agrupamento): string {
    return OPCOES_AGRUPAMENTO.find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
}