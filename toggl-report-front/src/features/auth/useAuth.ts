import { listarUsuarios } from '../../api/usuariosApi';
import { useCallback, useEffect, useState } from 'react';
import { ErroApi, definirCredencial, limparCredencial, obterCredencial } from '../../api/http';

interface ResultadoUseAuth {
    autenticado: boolean;
    verificando: boolean;
    entrando: boolean;
    erro: string | null;
    entrar: (usuario: string, senha: string) => Promise<void>;
    sair: () => void;
}

export function useAuth(): ResultadoUseAuth {
    const [autenticado, setAutenticado] = useState(() => obterCredencial() !== null);
    const [verificando, setVerificando] = useState(() => obterCredencial() === null);
    const [entrando, setEntrando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    // Sem credencial salva: tenta uma chamada sem header — se o backend não
    // tiver AUTH__USUARIO/AUTH__SENHA configurados (ex.: dev local), a API
    // aceita e pulamos a tela de login; se exigir, cai no catch e mostra login.
    useEffect(() => {
        if (obterCredencial() !== null) {
            return;
        }

        listarUsuarios()
            .then(() => setAutenticado(true))
            .catch(() => setAutenticado(false))
            .finally(() => setVerificando(false));
    }, []);

    useEffect(() => {
        function aoPerderAutenticacao(): void {
            setAutenticado(false);
        }
        window.addEventListener('auth:necessaria', aoPerderAutenticacao);
        return () => window.removeEventListener('auth:necessaria', aoPerderAutenticacao);
    }, []);

    const entrar = useCallback(async (usuario: string, senha: string): Promise<void> => {
        setEntrando(true);
        setErro(null);
        definirCredencial(btoa(`${usuario}:${senha}`));
        try {
            await listarUsuarios();
            setAutenticado(true);
        } catch (erroCapturado) {
            limparCredencial();
            setErro(
                erroCapturado instanceof ErroApi && erroCapturado.status === 401
                    ? 'Usuário ou senha inválidos.'
                    : 'Não foi possível conectar à API.',
            );
        } finally {
            setEntrando(false);
        }
    }, []);

    const sair = useCallback(() => {
        limparCredencial();
        setAutenticado(false);
    }, []);

    return { autenticado, verificando, entrando, erro, entrar, sair };
}