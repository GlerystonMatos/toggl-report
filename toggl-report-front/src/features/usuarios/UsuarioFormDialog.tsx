import type { ReactNode } from 'react';
import { ErroApi } from '../../api/http';
import { useEffect, useState } from 'react';
import { useUsuarios } from './useUsuarios';
import ErrorIcon from '@mui/icons-material/Error';
import type { UsuarioResumo } from '../../api/tipos';
import { useNotificacao } from '../../hooks/useNotificacao';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Alert,
    Stack,
    Dialog,
    TextField,
    DialogTitle,
    DialogActions,
    DialogContent,
} from '@mui/material';

const COR_PADRAO_USUARIO = '#5B82F6';

interface UsuarioFormDialogProps {
    aberto: boolean;
    usuarioEmEdicao: UsuarioResumo | null;
    onFechar: () => void;
    onSalvo: (mensagem: string) => void;
}

export function UsuarioFormDialog({
    aberto,
    usuarioEmEdicao,
    onFechar,
    onSalvo,
}: UsuarioFormDialogProps): ReactNode {
    const emEdicao = usuarioEmEdicao !== null;
    const { notificarErro } = useNotificacao();
    const [tokenApi, setTokenApi] = useState('');
    const [salvando, setSalvando] = useState(false);
    const { criar, editar, validar } = useUsuarios();
    const [validando, setValidando] = useState(false);
    const [sigla, setSigla] = useState(usuarioEmEdicao?.sigla ?? '');
    const [cor, setCor] = useState(usuarioEmEdicao?.cor ?? COR_PADRAO_USUARIO);
    const [avisoSemValidacao, setAvisoSemValidacao] = useState<string | null>(null);
    const [resultadoValidacao, setResultadoValidacao] = useState<boolean | null>(null);
    const [nomeExibicao, setNomeExibicao] = useState(usuarioEmEdicao?.nomeExibicao ?? '');

    useEffect(() => {
        if (aberto) {
            setNomeExibicao(usuarioEmEdicao?.nomeExibicao ?? '');
            setTokenApi('');
            setSigla(usuarioEmEdicao?.sigla ?? '');
            setCor(usuarioEmEdicao ? usuarioEmEdicao.cor : COR_PADRAO_USUARIO);
            setResultadoValidacao(null);
            setAvisoSemValidacao(null);
        }
    }, [aberto, usuarioEmEdicao]);

    function fecharEResetar(): void {
        setNomeExibicao('');
        setTokenApi('');
        setSigla('');
        setCor(COR_PADRAO_USUARIO);
        setResultadoValidacao(null);
        setAvisoSemValidacao(null);
        onFechar();
    }

    async function validarTokenDigitado(): Promise<void> {
        if (!tokenApi.trim()) return;
        setValidando(true);
        setResultadoValidacao(null);
        try {
            const valido = await validar(tokenApi.trim());
            setResultadoValidacao(valido);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível validar o token');
        } finally {
            setValidando(false);
        }
    }

    async function salvar(ignorarValidacao: boolean): Promise<void> {
        setSalvando(true);
        setAvisoSemValidacao(null);
        try {
            if (emEdicao && usuarioEmEdicao) {
                await editar(usuarioEmEdicao.chave, {
                    nomeExibicao: nomeExibicao.trim() !== usuarioEmEdicao.nomeExibicao ? nomeExibicao.trim() : null,
                    tokenApi: tokenApi.trim() !== '' ? tokenApi.trim() : null,
                    ignorarValidacao,
                    sigla: sigla.trim(),
                    cor,
                });
            } else {
                await criar({
                    nomeExibicao: nomeExibicao.trim(),
                    tokenApi: tokenApi.trim(),
                    ignorarValidacao,
                    sigla: sigla.trim(),
                    cor,
                    selecionado: true,
                });
            }
            onSalvo(emEdicao ? 'Usuário atualizado com sucesso.' : 'Usuário cadastrado com sucesso.');
            fecharEResetar();
        } catch (erro) {
            if (erro instanceof ErroApi && erro.status === 400 && !ignorarValidacao) {
                setAvisoSemValidacao(erro.message);
            } else {
                notificarErro(erro, 'Não foi possível salvar o usuário');
            }
        } finally {
            setSalvando(false);
        }
    }

    const nomeValido = nomeExibicao.trim().length > 0;
    const tokenObrigatorioAusente = !emEdicao && tokenApi.trim().length === 0;
    const podeSalvar = nomeValido && !tokenObrigatorioAusente;

    return (
        <Dialog open={aberto} onClose={salvando ? undefined : fecharEResetar} fullWidth maxWidth="sm">
            <DialogTitle>{emEdicao ? 'Editar usuário' : 'Adicionar usuário'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Nome de exibição"
                        value={nomeExibicao}
                        onChange={(evento) => setNomeExibicao(evento.target.value)}
                        autoFocus
                        fullWidth
                        disabled={salvando} />
                    <TextField
                        label="API Token"
                        type="password"
                        value={tokenApi}
                        onChange={(evento) => {
                            setTokenApi(evento.target.value);
                            setResultadoValidacao(null);
                        }}
                        placeholder={emEdicao ? `Atual: ${usuarioEmEdicao?.tokenMascarado} (deixe em branco para manter)` : undefined}
                        fullWidth
                        disabled={salvando} />

                    <Stack direction="row" spacing={2}>
                        <TextField
                            label="Sigla"
                            value={sigla}
                            onChange={(evento) => setSigla(evento.target.value)}
                            helperText="Ex.: JS, MRC — usada nas células do Gant"
                            fullWidth
                            disabled={salvando} />
                        <TextField
                            label="Cor"
                            type="color"
                            value={cor}
                            onChange={(evento) => setCor(evento.target.value)}
                            sx={{ width: 120 }}
                            disabled={salvando} />
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <BotaoComCarregamento
                            size="small"
                            variant="outlined"
                            carregando={validando}
                            disabled={!tokenApi.trim() || salvando}
                            onClick={() => void validarTokenDigitado()}>
                            Validar token
                        </BotaoComCarregamento>
                        {resultadoValidacao === true ? (
                            <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ py: 0 }}>
                                Token válido
                            </Alert>
                        ) : undefined}
                        {resultadoValidacao === false ? (
                            <Alert icon={<ErrorIcon fontSize="inherit" />} severity="warning" sx={{ py: 0 }}>
                                Token inválido
                            </Alert>
                        ) : undefined}
                    </Stack>

                    {avisoSemValidacao ? (
                        <Alert
                            severity="warning"
                            action={
                                <BotaoComCarregamento
                                    color="inherit"
                                    size="small"
                                    carregando={salvando}
                                    onClick={() => void salvar(true)}>
                                    Salvar mesmo assim
                                </BotaoComCarregamento>
                            }>
                            {avisoSemValidacao}
                        </Alert>
                    ) : undefined}
                </Stack>
            </DialogContent>
            <DialogActions>
                <BotaoComCarregamento onClick={fecharEResetar} disabled={salvando}>
                    Cancelar
                </BotaoComCarregamento>
                <BotaoComCarregamento
                    variant="contained"
                    carregando={salvando}
                    disabled={!podeSalvar}
                    onClick={() => void salvar(false)}>
                    Salvar
                </BotaoComCarregamento>
            </DialogActions>
        </Dialog>
    );
}