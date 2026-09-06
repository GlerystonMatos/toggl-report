export function formatarDuracao(segundosTotais: number): string {
    const segundos = Math.max(0, Math.trunc(segundosTotais));
    const horas = Math.floor(segundos / 3600);
    const minutosRestantes = Math.floor((segundos % 3600) / 60);
    const segundosRestantes = segundos % 60;

    const dois = (valor: number): string => valor.toString().padStart(2, '0');

    return `${dois(horas)}h${dois(minutosRestantes)}m${dois(segundosRestantes)}s`;
}