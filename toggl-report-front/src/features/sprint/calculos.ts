import { formatarDuracao } from '../../utils/duracao';
import type { BlocoCategoriaSprint } from '../../api/tipos';

type LinhaColisao = {
    codigo: string;
    descricao: string;
    agrupada: boolean;
    dev: BlocoCategoriaSprint;
    rev: BlocoCategoriaSprint;
    qa: BlocoCategoriaSprint;
};

export function calcularColisaoPosicao(linhas: LinhaColisao[]): boolean[] {
    const indicesPorGrupo = new Map<string, number[]>();
    linhas.forEach((linha, indice) => {
        const chave = `${linha.codigo}∙${linha.descricao}∙${linha.agrupada}`;
        const lista = indicesPorGrupo.get(chave) ?? [];
        lista.push(indice);
        indicesPorGrupo.set(chave, lista);
    });

    const flags = new Array<boolean>(linhas.length).fill(false);
    for (const indices of indicesPorGrupo.values()) {
        if (indices.length < 2) continue;
        const posicaoDisputada = (['dev', 'rev', 'qa'] as const).some(
            (posicao) => indices.filter((i) => linhas[i][posicao].nomeExibicao !== null).length >= 2,
        );
        if (posicaoDisputada) {
            for (const i of indices) flags[i] = true;
        }
    }
    return flags;
}

export function formatarHoraResumida(segundos: number): string {
    return `${String(Math.floor(Math.max(0, segundos) / 3600)).padStart(2, '0')}h`;
}

export function contarDigitos(codigo: string): number {
    return codigo.replace(/\D/g, '').length;
}

export function formatarCodigo(codigo: string, largura: number): string {
    if (!codigo) {
        return '—';
    }
    return codigo.replace(/\d+/, (numero) => numero.padStart(largura, '0'));
}

export function formatarDisponivel(
    totalHoras: number,
    segundosRealizados: number,
): { texto: string; negativo: boolean; positivo: boolean } {
    const segundos = totalHoras * 3600 - segundosRealizados;
    const negativo = segundos < 0;
    const positivo = segundos > 0;
    return { texto: `${negativo ? '-' : ''}${formatarDuracao(Math.abs(segundos))}`, negativo, positivo };
}