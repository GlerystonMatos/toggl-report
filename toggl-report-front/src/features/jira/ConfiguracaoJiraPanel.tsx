import type { ReactNode } from 'react';
import type { CampoJira } from '../../api/tipos';
import ErrorIcon from '@mui/icons-material/Error';
import { IconeAjuda } from '../../components/IconeAjuda';
import { useConfiguracaoJira } from './useConfiguracaoJira';
import { useNotificacao } from '../../hooks/useNotificacao';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Card,
    Alert,
    Stack,
    Divider,
    TextField,
    Typography,
    CardContent,
    Autocomplete,
    InputAdornment,
} from '@mui/material';

interface ConfiguracaoJiraPanelProps {
    onValidoChange?: (valido: boolean) => void;
}

export interface ConfiguracaoJiraPanelHandle {
    salvar: () => Promise<boolean>;
}

export const ConfiguracaoJiraPanel = forwardRef<ConfiguracaoJiraPanelHandle, ConfiguracaoJiraPanelProps>(
    function ConfiguracaoJiraPanel({ onValidoChange }, ref): ReactNode {
        const { carregando, carregar, salvar, testarConexao, listarCampos } = useConfiguracaoJira();
        const { notificarErro, notificarSucesso } = useNotificacao();

        const [urlDominio, setUrlDominio] = useState('');
        const [email, setEmail] = useState('');
        const [apiToken, setApiToken] = useState('');
        const [tokenMascarado, setTokenMascarado] = useState('');

        const [campoEstimativaDev, setCampoEstimativaDev] = useState<CampoJira | null>(null);
        const [campoEstimativaRev, setCampoEstimativaRev] = useState<CampoJira | null>(null);
        const [campoEstimativaTestes, setCampoEstimativaTestes] = useState<CampoJira | null>(null);
        const [campoRevisadoPorSelecionado, setCampoRevisadoPorSelecionado] = useState<CampoJira | null>(null);
        const [campos, setCampos] = useState<CampoJira[]>([]);
        const [buscandoCampos, setBuscandoCampos] = useState(false);

        const [testando, setTestando] = useState(false);
        const [resultadoTeste, setResultadoTeste] = useState<{ sucesso: boolean; mensagem: string | null } | null>(null);

        useEffect(() => {
            carregar()
                .then((dados) => {
                    setUrlDominio(dados.urlDominio);
                    setEmail(dados.email);
                    setTokenMascarado(dados.tokenMascarado);
                    if (dados.campoEstimativaDesenvolvimentoId) {
                        setCampoEstimativaDev({ id: dados.campoEstimativaDesenvolvimentoId, nome: dados.campoEstimativaDesenvolvimentoNome });
                    }
                    if (dados.campoRevisadoPorId) {
                        setCampoRevisadoPorSelecionado({ id: dados.campoRevisadoPorId, nome: dados.campoRevisadoPorNome });
                    }
                    if (dados.campoEstimativaRevisaoId) {
                        setCampoEstimativaRev({ id: dados.campoEstimativaRevisaoId, nome: dados.campoEstimativaRevisaoNome });
                    }
                    if (dados.campoEstimativaTestesId) {
                        setCampoEstimativaTestes({ id: dados.campoEstimativaTestesId, nome: dados.campoEstimativaTestesNome });
                    }
                })
                .catch((erro: unknown) => notificarErro(erro, 'Não foi possível carregar a configuração do Jira'));
        }, []);

        function limparResultadoTeste(): void {
            setResultadoTeste(null);
        }

        async function testar(): Promise<void> {
            setTestando(true);
            setResultadoTeste(null);
            try {
                const resposta = await testarConexao({ urlDominio: urlDominio.trim(), email: email.trim(), apiToken: apiToken.trim() });
                setResultadoTeste({ sucesso: resposta.sucesso, mensagem: resposta.mensagem });
            } catch (erro) {
                notificarErro(erro, 'Não foi possível testar a conexão com o Jira');
            } finally {
                setTestando(false);
            }
        }

        async function buscarCampos(): Promise<void> {
            setBuscandoCampos(true);
            try {
                const credenciaisDigitadas = urlDominio.trim() && email.trim() && apiToken.trim()
                    ? { urlDominio: urlDominio.trim(), email: email.trim(), apiToken: apiToken.trim() }
                    : {};
                const lista = await listarCampos(credenciaisDigitadas);
                setCampos(lista);
                if (lista.length === 0) {
                    notificarErro(new Error('Nenhum campo customizado foi encontrado no Jira.'));
                }
            } catch (erro) {
                notificarErro(erro, 'Não foi possível buscar os campos do Jira');
            } finally {
                setBuscandoCampos(false);
            }
        }

        async function salvarConfiguracao(): Promise<boolean> {
            try {
                const atualizado = await salvar({
                    urlDominio: urlDominio.trim(),
                    email: email.trim(),
                    apiToken: apiToken.trim() !== '' ? apiToken.trim() : null,
                    campoEstimativaDesenvolvimentoId: campoEstimativaDev?.id ?? '',
                    campoEstimativaDesenvolvimentoNome: campoEstimativaDev?.nome ?? '',
                    campoRevisadoPorId: campoRevisadoPorSelecionado?.id ?? '',
                    campoRevisadoPorNome: campoRevisadoPorSelecionado?.nome ?? '',
                    campoEstimativaRevisaoId: campoEstimativaRev?.id ?? '',
                    campoEstimativaRevisaoNome: campoEstimativaRev?.nome ?? '',
                    campoEstimativaTestesId: campoEstimativaTestes?.id ?? '',
                    campoEstimativaTestesNome: campoEstimativaTestes?.nome ?? '',
                });
                setTokenMascarado(atualizado.tokenMascarado);
                setApiToken('');
                notificarSucesso('Configuração do Jira salva.');
                return true;
            } catch (erro) {
                notificarErro(erro, 'Não foi possível salvar a configuração do Jira');
                return false;
            }
        }

        useImperativeHandle(ref, () => ({ salvar: salvarConfiguracao }));

        const camposObrigatoriosPreenchidos = urlDominio.trim().length > 0 && email.trim().length > 0;
        const podeTestar = camposObrigatoriosPreenchidos && apiToken.trim().length > 0;
        const tokenJaSalvo = tokenMascarado !== '' && tokenMascarado !== '****';

        useEffect(() => {
            onValidoChange?.(camposObrigatoriosPreenchidos);
        }, [camposObrigatoriosPreenchidos]);

        return (
            <Card variant="outlined">
                <CardContent>
                    <Stack spacing={3}>
                        <Typography variant="h6">Configuração</Typography>

                        <TextField
                            label="URL do domínio"
                            value={urlDominio}
                            onChange={(evento) => setUrlDominio(evento.target.value)}
                            placeholder="empresa.atlassian.net"
                            slotProps={{
                                input: {
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconeAjuda titulo="URL do seu site Jira, ex.: suaempresa.atlassian.net — é o endereço que aparece no navegador ao acessar o Jira." />
                                        </InputAdornment>
                                    ),
                                },
                            }}
                            disabled={carregando}
                            fullWidth />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="E-mail"
                                value={email}
                                onChange={(evento) => setEmail(evento.target.value)}
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconeAjuda titulo="E-mail de login da conta Atlassian usada para gerar o API Token ao lado." />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                disabled={carregando}
                                fullWidth />
                            <TextField
                                label="API Token"
                                type="password"
                                value={apiToken}
                                onChange={(evento) => {
                                    setApiToken(evento.target.value);
                                    limparResultadoTeste();
                                }}
                                placeholder={tokenJaSalvo ? `Atual: ${tokenMascarado} (deixe em branco para manter)` : undefined}
                                helperText="Gerado em id.atlassian.com/manage-profile/security/api-tokens"
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconeAjuda titulo="Acesse id.atlassian.com → Security → API tokens → Create API token, dê um nome e copie o valor gerado." />
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                                disabled={carregando}
                                fullWidth />
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: '0rem !important' }}>
                            <BotaoComCarregamento
                                variant="outlined"
                                carregando={testando}
                                disabled={!podeTestar || carregando}
                                onClick={() => void testar()}>
                                Testar conexão
                            </BotaoComCarregamento>
                            {resultadoTeste?.sucesso === true ? (
                                <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ py: 0 }}>
                                    {resultadoTeste.mensagem ?? 'Conexão bem-sucedida.'}
                                </Alert>
                            ) : undefined}
                            {resultadoTeste?.sucesso === false ? (
                                <Alert icon={<ErrorIcon fontSize="inherit" />} severity="warning" sx={{ py: 0 }}>
                                    {resultadoTeste.mensagem ?? 'Não foi possível conectar.'}
                                </Alert>
                            ) : undefined}
                        </Stack>

                        <Divider />
                        <Stack spacing={0.5}>
                            <Typography variant="subtitle1">Mapeamento de Campos</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Campos customizados do Jira usados pelo Sprint: cada estimativa alimenta o PRE do
                                grupo correspondente (Desenvolvimento/Revisão/Testes); "Revisado por" alimenta o
                                fallback automático de colaborador. Todos são opcionais e configuráveis
                                independentemente.
                            </Typography>
                        </Stack>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <Autocomplete
                                sx={{ flexGrow: 1 }}
                                options={campos}
                                value={campoEstimativaDev}
                                onChange={(_, valor) => setCampoEstimativaDev(valor)}
                                getOptionLabel={(campo) => campo.nome}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                disabled={carregando}
                                noOptionsText='Clique em "Buscar campos" para listar os campos customizados do Jira'
                                renderInput={(params) => (
                                    <TextField {...params} label="Estimativa do desenvolvimento" placeholder="Selecione o campo customizado" />
                                )} />
                            <Autocomplete
                                sx={{ flexGrow: 1 }}
                                options={campos}
                                value={campoEstimativaRev}
                                onChange={(_, valor) => setCampoEstimativaRev(valor)}
                                getOptionLabel={(campo) => campo.nome}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                disabled={carregando}
                                noOptionsText='Clique em "Buscar campos" para listar os campos customizados do Jira'
                                renderInput={(params) => (
                                    <TextField {...params} label="Estimativa da revisão" placeholder="Selecione o campo customizado" />
                                )} />
                            <Autocomplete
                                sx={{ flexGrow: 1 }}
                                options={campos}
                                value={campoEstimativaTestes}
                                onChange={(_, valor) => setCampoEstimativaTestes(valor)}
                                getOptionLabel={(campo) => campo.nome}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                disabled={carregando}
                                noOptionsText='Clique em "Buscar campos" para listar os campos customizados do Jira'
                                renderInput={(params) => (
                                    <TextField {...params} label="Estimativa dos testes" placeholder="Selecione o campo customizado" />
                                )} />
                        </Stack>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                            <Autocomplete
                                sx={{ flexGrow: 1 }}
                                options={campos}
                                value={campoRevisadoPorSelecionado}
                                onChange={(_, valor) => setCampoRevisadoPorSelecionado(valor)}
                                getOptionLabel={(campo) => campo.nome}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                disabled={carregando}
                                noOptionsText='Clique em "Buscar campos" para listar os campos customizados do Jira'
                                renderInput={(params) => (
                                    <TextField {...params} label="Revisado por" placeholder="Selecione o campo customizado" />
                                )} />
                            <BotaoComCarregamento
                                variant="outlined"
                                carregando={buscandoCampos}
                                disabled={!camposObrigatoriosPreenchidos || carregando}
                                onClick={() => void buscarCampos()}>
                                Buscar campos
                            </BotaoComCarregamento>
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        );
    },
);