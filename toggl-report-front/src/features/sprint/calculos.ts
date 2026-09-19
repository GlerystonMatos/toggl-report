import { CORES } from '../../theme';
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
        if (linhas[indices[0]].agrupada) continue;
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

export const COR_INDISPONIVEL = CORES.corIndisponivel;

export const PRIORIDADES: Record<string, string> = {
    'muito alta': CORES.corPrioridadeMuitoAlta,
    'alta': CORES.corPrioridadeAlta,
    'média': CORES.corPrioridadeMedia,
    'media': CORES.corPrioridadeMedia,
    'baixa': CORES.corPrioridadeBaixa,
    'muito baixa': CORES.corPrioridadeMuitoBaixa,
};

export function infoPrioridade(prioridade: string | null, coresPrioridade: Record<string, string>): { texto: string; cor: string } {
    if (prioridade === null) return { texto: 'Nenhuma', cor: COR_INDISPONIVEL };
    const corConfigurada = coresPrioridade[prioridade];
    const corPadrao = PRIORIDADES[prioridade.trim().toLowerCase()];
    return { texto: prioridade, cor: corConfigurada ?? corPadrao ?? COR_INDISPONIVEL };
}

export function corDaSituacao(situacao: string | null, coresStatus: Record<string, string>): string {
    if (situacao === null) return COR_INDISPONIVEL;
    return coresStatus[situacao] ?? COR_INDISPONIVEL;
}

const ORDEM_PRIORIDADE = ['muito alta', 'alta', 'média', 'baixa', 'muito baixa'];

export function ordemPrioridade(prioridade: string | null): number {
    if (prioridade === null) return ORDEM_PRIORIDADE.length;
    const indice = ORDEM_PRIORIDADE.indexOf(prioridade.trim().toLowerCase());
    return indice === -1 ? ORDEM_PRIORIDADE.length : indice;
}

export const GRUPOS: { rotulo: string; nomeLongo: string; bloco: 'dev' | 'rev' | 'qa' }[] = [
    { rotulo: 'DEV', nomeLongo: 'Desenvolvimento', bloco: 'dev' },
    { rotulo: 'REV', nomeLongo: 'Revisão', bloco: 'rev' },
    { rotulo: 'QA', nomeLongo: 'Qualidade', bloco: 'qa' },
];

type LinhaSituacaoGrupo = {
    agrupada: boolean;
    grupoResponsavelStatus: 'dev' | 'rev' | 'qa' | null;
    situacaoSemGrupoResponsavel: boolean;
};

export function situacaoGrupo(linha: LinhaSituacaoGrupo, grupo: 'dev' | 'rev' | 'qa'): 'Tag' | 'Pendente' | 'Concluído' {
    if (linha.agrupada) return 'Tag';
    if (linha.grupoResponsavelStatus) return grupo === linha.grupoResponsavelStatus ? 'Pendente' : 'Concluído';
    return linha.situacaoSemGrupoResponsavel ? 'Concluído' : 'Pendente';
}