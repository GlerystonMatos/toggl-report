import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatarPeriodo } from '../../utils/datas';
import { rotularAgrupamento } from '../../utils/rotulos';
import { useNotificacao } from '../../hooks/useNotificacao';
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import type {
    Agrupamento,
    ConsultarResponse,
    OrigemConsultaSprint,
} from '../../api/tipos';

import {
    Card,
    Alert,
    Stack,
    Divider,
    Checkbox,
    Typography,
    CardContent,
    ToggleButton,
    FormControlLabel,
    ToggleButtonGroup,
} from '@mui/material';

interface OrigemConsultaProps {
    valor: OrigemConsultaSprint;
    onChange: (valor: OrigemConsultaSprint) => void;
}

interface ConsultaPanelProps {
    dataInicio: string;
    dataFim: string;
    agrupamento?: Agrupamento;
    tagsDetalhadas?: string[];
    categorias?: { dev: string[]; rev: string[]; qa: string[] };
    responsabilidade?: { statusDev: string[]; statusRev: string[]; statusQa: string[] };
    origemConsulta?: OrigemConsultaProps;
    bloqueado?: boolean;
    resultado: ConsultarResponse | null;
    consultando: boolean;
    executar: (dataInicio: string, dataFim: string, forcarConsultaApi: boolean, origem?: OrigemConsultaSprint) => Promise<ConsultarResponse>;
    onVoltar: () => void;
    onConcluida: (resposta: ConsultarResponse) => void;
}

function temDadoAproveitavel(resposta: ConsultarResponse): boolean {
    return resposta.usuarios.some((usuario) => usuario.quantidadeRegistros !== null);
}

const ROTULO_CONSULTAR: Record<OrigemConsultaSprint, string> = {
    nenhum: 'Consultar',
    toggl: 'Forçar Toggl',
    jira: 'Forçar Jira',
    ambos: 'Forçar Toggl e Jira',
};

export function ConsultaPanel({
    dataInicio,
    dataFim,
    agrupamento,
    tagsDetalhadas,
    categorias,
    responsabilidade,
    origemConsulta,
    bloqueado = false,
    resultado,
    consultando,
    executar,
    onVoltar,
    onConcluida,
}: ConsultaPanelProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const [forcarConsultaApi, setForcarConsultaApi] = useState(false);
    const [confirmandoConsultaForcada, setConfirmandoConsultaForcada] = useState(false);
    const origemEfetiva: OrigemConsultaSprint | undefined = bloqueado ? 'nenhum' : origemConsulta?.valor;
    const rotuloConsultar = origemConsulta === undefined || bloqueado ? 'Consultar' : ROTULO_CONSULTAR[origemConsulta.valor];
    const vaiForcarToggl = bloqueado
        ? false
        : origemConsulta
            ? origemConsulta.valor === 'toggl' || origemConsulta.valor === 'ambos'
            : forcarConsultaApi;

    async function consultarAgora(): Promise<void> {
        try {
            const resposta = await executar(dataInicio, dataFim, bloqueado ? false : forcarConsultaApi, origemEfetiva);
            if (temDadoAproveitavel(resposta)) {
                onConcluida(resposta);
            }
        } catch (erro) {
            notificarErro(erro, 'Não foi possível consultar o Toggl');
        }
    }

    function aoClicarConsultar(): void {
        if (vaiForcarToggl) {
            setConfirmandoConsultaForcada(true);
            return;
        }
        void consultarAgora();
    }

    function confirmarConsultaForcada(): void {
        setConfirmandoConsultaForcada(false);
        void consultarAgora();
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6">Consultar</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Período: {formatarPeriodo(dataInicio, dataFim)}
                    </Typography>
                    {agrupamento !== undefined ? (
                        <Typography variant="body2" color="text.secondary">
                            Agrupamento: {rotularAgrupamento(agrupamento)}
                        </Typography>
                    ) : undefined}
                    {tagsDetalhadas !== undefined ? (
                        <Typography variant="body2" color="text.secondary">
                            Tags para detalhar por descrição: {tagsDetalhadas.length > 0 ? tagsDetalhadas.join(', ') : '(nenhuma)'}
                        </Typography>
                    ) : undefined}
                    {categorias !== undefined ? (
                        <Stack spacing={0.25}>
                            <Typography variant="body2" color="text.secondary">Tags para identificar responsáveis:</Typography>
                            <Typography variant="body2" color="text.secondary">DEV: {categorias.dev.length > 0 ? categorias.dev.join(', ') : '(nenhuma)'}</Typography>
                            <Typography variant="body2" color="text.secondary">REV: {categorias.rev.length > 0 ? categorias.rev.join(', ') : '(nenhuma)'}</Typography>
                            <Typography variant="body2" color="text.secondary">QA: {categorias.qa.length > 0 ? categorias.qa.join(', ') : '(nenhuma)'}</Typography>
                        </Stack>
                    ) : undefined}
                    {responsabilidade !== undefined ? (
                        <Stack spacing={0.25}>
                            <Typography variant="body2" color="text.secondary">Status para identificar responsáveis:</Typography>
                            <Typography variant="body2" color="text.secondary">DEV: {responsabilidade.statusDev.length > 0 ? responsabilidade.statusDev.join(', ') : '(nenhum)'}</Typography>
                            <Typography variant="body2" color="text.secondary">REV: {responsabilidade.statusRev.length > 0 ? responsabilidade.statusRev.join(', ') : '(nenhum)'}</Typography>
                            <Typography variant="body2" color="text.secondary">QA: {responsabilidade.statusQa.length > 0 ? responsabilidade.statusQa.join(', ') : '(nenhum)'}</Typography>
                        </Stack>
                    ) : undefined}

                    {bloqueado ? (
                        <Alert severity="info">
                            Sprint fechado: os dados ficam travados no que foi salvo ao fechar. A consulta sempre usa
                            o cache do Toggl e do Jira, sem chamar a API de novo. Reabra o sprint na listagem para
                            liberar edição e novas consultas.
                        </Alert>
                    ) : origemConsulta !== undefined ? (
                        <Stack spacing={0.5}>
                            <Typography variant="body2" color="text.secondary">Forçar nova consulta em:</Typography>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={origemConsulta.valor}
                                disabled={consultando}
                                onChange={(_evento, valor: OrigemConsultaSprint | null) => {
                                    if (valor) origemConsulta.onChange(valor);
                                }}>
                                <ToggleButton value="nenhum">Nenhum</ToggleButton>
                                <ToggleButton value="toggl">Toggl</ToggleButton>
                                <ToggleButton value="jira">Jira</ToggleButton>
                                <ToggleButton value="ambos">Ambos</ToggleButton>
                            </ToggleButtonGroup>
                            <Typography variant="caption" color="text.secondary">
                                Nenhum: usa o cache do Toggl e do Jira quando disponível. Toggl: força nova consulta
                                ao Toggl (Jira do cache). Jira: força atualização do Jira (Toggl do cache). Ambos:
                                força os dois.
                            </Typography>
                        </Stack>
                    ) : undefined}

                    <Divider />

                    {origemConsulta === undefined && !bloqueado ? (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={forcarConsultaApi}
                                    onChange={(evento) => setForcarConsultaApi(evento.target.checked)}
                                    disabled={consultando} />
                            }
                            label="Forçar nova consulta à API (ignora o cache local)" />
                    ) : undefined}

                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                        <BotaoComCarregamento onClick={onVoltar} disabled={consultando}>
                            Voltar
                        </BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={consultando}
                            onClick={aoClicarConsultar}>
                            {rotuloConsultar}
                        </BotaoComCarregamento>
                    </Stack>

                    {resultado && !temDadoAproveitavel(resultado) ? (
                        <Alert severity="warning">Nenhum usuário do Toggl retornou dados para este período.</Alert>
                    ) : undefined}
                </Stack>
            </CardContent>

            <DialogoConfirmacao
                aberto={confirmandoConsultaForcada}
                titulo="Forçar nova consulta à API?"
                mensagem="Isso ignora o cache local e consulta o Toggl de novo, consumindo o limite de 30 requisições/hora por usuário. Deseja continuar?"
                textoConfirmar="Consultar mesmo assim"
                textoCancelar="Não"
                focoNoCancelar
                onConfirmar={confirmarConsultaForcada}
                onCancelar={() => setConfirmandoConsultaForcada(false)}
            />
        </Card>
    );
}