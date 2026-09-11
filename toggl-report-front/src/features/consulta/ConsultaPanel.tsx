import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatarPeriodo } from '../../utils/datas';
import { rotularAgrupamento } from '../../utils/rotulos';
import { BadgeSigla } from '../../components/BadgeSigla';
import { useNotificacao } from '../../hooks/useNotificacao';
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import type {
    Agrupamento,
    UsuarioTogglResumo,
    ConsultarResponse,
} from '../../api/tipos';

import {
    Card,
    Alert,
    Stack,
    Table,
    Divider,
    Checkbox,
    TableRow,
    TableBody,
    TableCell,
    Typography,
    CardContent,
    TableContainer,
    FormControlLabel,
} from '@mui/material';

interface ConsultaPanelProps {
    dataInicio: string;
    dataFim: string;
    agrupamento?: Agrupamento;
    tagsDetalhadas?: string[];
    categorias?: { dev: string[]; rev: string[]; qa: string[] };
    usuariosSelecionados: UsuarioTogglResumo[];
    resultado: ConsultarResponse | null;
    consultando: boolean;
    executar: (dataInicio: string, dataFim: string, forcarConsultaApi: boolean) => Promise<ConsultarResponse>;
    onVoltar: () => void;
    onConcluida: (resposta: ConsultarResponse) => void;
}

function temDadoAproveitavel(resposta: ConsultarResponse): boolean {
    return resposta.usuarios.some((usuario) => usuario.quantidadeRegistros !== null);
}

export function ConsultaPanel({
    dataInicio,
    dataFim,
    agrupamento,
    tagsDetalhadas,
    categorias,
    usuariosSelecionados,
    resultado,
    consultando,
    executar,
    onVoltar,
    onConcluida,
}: ConsultaPanelProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const [forcarConsultaApi, setForcarConsultaApi] = useState(false);
    const [confirmandoConsultaForcada, setConfirmandoConsultaForcada] = useState(false);

    async function consultarAgora(): Promise<void> {
        try {
            const resposta = await executar(dataInicio, dataFim, forcarConsultaApi);
            if (temDadoAproveitavel(resposta)) {
                onConcluida(resposta);
            }
        } catch (erro) {
            notificarErro(erro, 'Não foi possível consultar o Toggl');
        }
    }

    function aoClicarConsultar(): void {
        if (forcarConsultaApi) {
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
                            Tags detalhadas: {tagsDetalhadas.length > 0 ? tagsDetalhadas.join(', ') : '(nenhuma)'}
                        </Typography>
                    ) : undefined}
                    {categorias !== undefined ? (
                        <Stack spacing={0.25}>
                            <Typography variant="body2" color="text.secondary">Categorias de tarefa:</Typography>
                            <Typography variant="body2" color="text.secondary">DEV: {categorias.dev.length > 0 ? categorias.dev.join(', ') : '(nenhuma)'}</Typography>
                            <Typography variant="body2" color="text.secondary">REV: {categorias.rev.length > 0 ? categorias.rev.join(', ') : '(nenhuma)'}</Typography>
                            <Typography variant="body2" color="text.secondary">QA: {categorias.qa.length > 0 ? categorias.qa.join(', ') : '(nenhuma)'}</Typography>
                        </Stack>
                    ) : undefined}

                    <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                            Usuários do Toggl selecionados:
                        </Typography>
                        {usuariosSelecionados.length === 0 ? (
                            <Alert severity="warning">Nenhum usuário do Toggl selecionado. Marque ao menos um na aba "Usuários".</Alert>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableBody>
                                        {usuariosSelecionados.map((usuario) => (
                                            <TableRow key={usuario.chave}>
                                                <TableCell sx={{ py: 0.5 }}>{usuario.nomeExibicao}</TableCell>
                                                <TableCell sx={{ py: 0.5, width: '1%' }}>
                                                    <BadgeSigla sigla={usuario.sigla} cor={usuario.cor} nome={usuario.nomeExibicao} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Stack>

                    <Divider />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={forcarConsultaApi}
                                onChange={(evento) => setForcarConsultaApi(evento.target.checked)}
                                disabled={consultando} />
                        }
                        label="Forçar nova consulta à API (ignora o cache local)" />

                    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                        <BotaoComCarregamento onClick={onVoltar} disabled={consultando}>
                            Voltar
                        </BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={consultando}
                            onClick={aoClicarConsultar}>
                            Consultar
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