export function truncar(texto: string, limite: number): string {
    return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}