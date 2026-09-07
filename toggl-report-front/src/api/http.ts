export const URL_BASE_API = import.meta.env.VITE_API_URL ?? 'http://localhost:5180';

const CHAVE_CREDENCIAL = 'toggl-report:credencial';

export function obterCredencial(): string | null {
    try {
        return sessionStorage.getItem(CHAVE_CREDENCIAL);
    } catch {
        return null;
    }
}

export function definirCredencial(credencial: string): void {
    try {
        sessionStorage.setItem(CHAVE_CREDENCIAL, credencial);
    } catch {
        // sessionStorage indisponível (ex.: modo privado) — segue sem persistir
    }
}

export function limparCredencial(): void {
    try {
        sessionStorage.removeItem(CHAVE_CREDENCIAL);
    } catch {
        // ignorar
    }
}

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

function montarHeaders(temCorpo: boolean): HeadersInit | undefined {
    const credencial = obterCredencial();
    if (!temCorpo && !credencial) {
        return undefined;
    }

    const headers: Record<string, string> = {};
    if (temCorpo) {
        headers['Content-Type'] = 'application/json';
    }
    if (credencial) {
        headers['Authorization'] = `Basic ${credencial}`;
    }
    return headers;
}

async function requisitar<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
    const url = montarUrl(caminho, opcoes.parametros);

    let resposta: Response;
    try {
        resposta = await fetch(url, {
            method: opcoes.method ?? 'GET',
            headers: montarHeaders(opcoes.corpo !== undefined),
            body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
        });
    } catch {
        throw new ErroApi(
            `Não foi possível conectar à API em ${URL_BASE_API}. Verifique se ela está em execução.`,
            0,
        );
    }

    if (resposta.status === 401) {
        limparCredencial();
        window.dispatchEvent(new Event('auth:necessaria'));
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

async function requisitarArquivo(caminho: string, campo: string, arquivo: File): Promise<void> {
    const url = montarUrl(caminho);
    const credencial = obterCredencial();
    const headers: Record<string, string> = {};
    if (credencial) {
        headers['Authorization'] = `Basic ${credencial}`;
    }

    const corpo = new FormData();
    corpo.append(campo, arquivo);

    let resposta: Response;
    try {
        resposta = await fetch(url, { method: 'POST', headers, body: corpo });
    } catch {
        throw new ErroApi(
            `Não foi possível conectar à API em ${URL_BASE_API}. Verifique se ela está em execução.`,
            0,
        );
    }

    if (resposta.status === 401) {
        limparCredencial();
        window.dispatchEvent(new Event('auth:necessaria'));
    }

    if (resposta.status === 204) {
        return;
    }

    const textoCorpo = await resposta.text();
    if (!resposta.ok) {
        const mensagem = textoCorpo.length > 0 ? textoCorpo : resposta.statusText || `Erro HTTP ${resposta.status}`;
        throw new ErroApi(mensagem, resposta.status);
    }
}

export interface ArquivoBaixado {
    blob: Blob;
    nomeArquivo: string;
}

async function requisitarDownload(caminho: string, nomePadrao: string): Promise<ArquivoBaixado> {
    const url = montarUrl(caminho);
    const credencial = obterCredencial();
    const headers: Record<string, string> = {};
    if (credencial) {
        headers['Authorization'] = `Basic ${credencial}`;
    }

    let resposta: Response;
    try {
        resposta = await fetch(url, { headers });
    } catch {
        throw new ErroApi(
            `Não foi possível conectar à API em ${URL_BASE_API}. Verifique se ela está em execução.`,
            0,
        );
    }

    if (resposta.status === 401) {
        limparCredencial();
        window.dispatchEvent(new Event('auth:necessaria'));
    }

    if (!resposta.ok) {
        const textoCorpo = await resposta.text();
        const mensagem = textoCorpo.length > 0 ? textoCorpo : resposta.statusText || `Erro HTTP ${resposta.status}`;
        throw new ErroApi(mensagem, resposta.status);
    }

    const disposicao = resposta.headers.get('Content-Disposition') ?? '';
    const nomeArquivo = /filename="?([^";]+)"?/.exec(disposicao)?.[1] ?? nomePadrao;
    const blob = await resposta.blob();
    return { blob, nomeArquivo };
}

export const http = {
    get: <T>(caminho: string, parametros?: Record<string, string>): Promise<T> =>
        requisitar<T>(caminho, { method: 'GET', parametros }),
    post: <T>(caminho: string, corpo?: unknown): Promise<T> =>
        requisitar<T>(caminho, { method: 'POST', corpo: corpo ?? {} }),
    put: <T>(caminho: string, corpo?: unknown): Promise<T> =>
        requisitar<T>(caminho, { method: 'PUT', corpo: corpo ?? {} }),
    delete: <T>(caminho: string): Promise<T> => requisitar<T>(caminho, { method: 'DELETE' }),
    postArquivo: (caminho: string, campo: string, arquivo: File): Promise<void> =>
        requisitarArquivo(caminho, campo, arquivo),
    getArquivo: (caminho: string, nomePadrao: string): Promise<ArquivoBaixado> =>
        requisitarDownload(caminho, nomePadrao),
};