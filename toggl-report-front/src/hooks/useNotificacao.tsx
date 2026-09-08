import type { ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Severidade = 'success' | 'error' | 'info' | 'warning';

interface Notificacao {
    chave: number;
    mensagem: string;
    severidade: Severidade;
}

interface ContextoNotificacao {
    notificarErro: (erro: unknown, prefixo?: string) => void;
    notificarSucesso: (mensagem: string) => void;
    notificarInfo: (mensagem: string) => void;
}

const Contexto = createContext<ContextoNotificacao | null>(null);

export function mensagemDeErro(erro: unknown): string {
    if (erro instanceof Error) {
        return erro.message;
    }
    return 'Ocorreu um erro inesperado.';
}

export function ProvedorNotificacao({ children }: { children: ReactNode }): ReactNode {
    const [notificacao, setNotificacao] = useState<Notificacao | null>(null);

    const notificar = useCallback((mensagem: string, severidade: Severidade) => {
        setNotificacao({ chave: Date.now(), mensagem, severidade });
    }, []);

    const notificarErro = useCallback(
        (erro: unknown, prefixo?: string) => {
            const mensagem = mensagemDeErro(erro);
            notificar(prefixo ? `${prefixo}: ${mensagem}` : mensagem, 'error');
        },
        [notificar],
    );

    const notificarSucesso = useCallback((mensagem: string) => notificar(mensagem, 'success'), [notificar]);
    const notificarInfo = useCallback((mensagem: string) => notificar(mensagem, 'info'), [notificar]);

    const valor = useMemo<ContextoNotificacao>(
        () => ({ notificarErro, notificarSucesso, notificarInfo }),
        [notificarErro, notificarSucesso, notificarInfo],
    );

    return (
        <Contexto.Provider value={valor}>
            {children}
            <Snackbar
                key={notificacao?.chave}
                open={notificacao !== null}
                autoHideDuration={6000}
                onClose={() => setNotificacao(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                {notificacao ? (
                    <Alert severity={notificacao.severidade} onClose={() => setNotificacao(null)} variant="filled">
                        {notificacao.mensagem}
                    </Alert>
                ) : undefined}
            </Snackbar>
        </Contexto.Provider>
    );
}

export function useNotificacao(): ContextoNotificacao {
    const contexto = useContext(Contexto);
    if (!contexto) {
        throw new Error('useNotificacao precisa estar dentro de <ProvedorNotificacao>.');
    }
    return contexto;
}