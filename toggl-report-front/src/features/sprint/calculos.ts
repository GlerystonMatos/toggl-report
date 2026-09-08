import { formatarDuracao } from '../../utils/duracao';

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