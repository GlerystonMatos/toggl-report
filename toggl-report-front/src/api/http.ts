export const URL_BASE_API = 'http://localhost:5180';

export class ErroApi extends Error {
    readonly status: number;

    constructor(mensagem: string, status: number) {
        super(mensagem);
        this.name = 'ErroApi';
        this.status = status;
    }
}

function tentarInterpretarJson(texto: string): unknown {
    try {
        return JSON.parse(texto);
    } catch {
        return texto;
    }
}

interface OpcoesRequisicao {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    corpo?: unknown;
    parametros?: Record<string, string>;
}

function montarUrl(caminho: string, parametros?: Record<string, string>): string {
    const url = new URL(caminho, URL_BASE_API);
    if (parametros) {
        for (const [chave, valor] of Object.entries(parametros)) {
            url.searchParams.set(chave, valor);
        }
    }
    return url.toString();
}

async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
    const url = montarUrl(caminho, opcoes.parametros);

    let resposta: Response;
    try {
        resposta = await fetch(url, {
            method: opcoes.method ?? 'GET',
            headers: opcoes.corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
            body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
        });
    } catch {
        throw new ErroApi(
            `Não foi possível conectar à API em ${URL_BASE_API}. Verifique se ela está em execução.`,
            0,
        );
    }

    if (resposta.status === 204) {
        return undefined as T;
    }

    const textoCorpo = await resposta.text();
    const corpo: unknown = textoCorpo.length > 0 ? tentarInterpretarJson(textoCorpo) : undefined;

    if (!resposta.ok) {
        const mensagem =
            typeof corpo === 'string' && corpo.length > 0
                ? corpo
                : resposta.statusText || `Erro HTTP ${resposta.status}`;
        throw new ErroApi(mensagem, resposta.status);
    }

    return corpo as T;
}

export const http = {
    get: <T>(caminho: string, parametros?: Record<string, string>): Promise<T> =>
        requisitar<T>(caminho, { method: 'GET', parametros }),
    post: <T>(caminho: string, corpo?: unknown): Promise<T> =>
        requisitar<T>(caminho, { method: 'POST', corpo: corpo ?? {} }),
    put: <T>(caminho: string, corpo?: unknown): Promise<T> =>
        requisitar<T>(caminho, { method: 'PUT', corpo: corpo ?? {} }),
    delete: <T>(caminho: string): Promise<T> => requisitar<T>(caminho, { method: 'DELETE' }),
};