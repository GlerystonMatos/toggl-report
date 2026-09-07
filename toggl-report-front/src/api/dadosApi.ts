import { http } from './http';

export async function baixarDados(): Promise<void> {
    const { blob, nomeArquivo } = await http.getArquivo('/api/dados/download', 'dados.zip');
    const url = URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
    } finally {
        URL.revokeObjectURL(url);
    }
}

export function restaurarDados(arquivo: File): Promise<void> {
    return http.postArquivo('/api/dados/restaurar', 'arquivo', arquivo);
}