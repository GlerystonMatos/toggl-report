import { useState } from 'react';
import type { ReactNode } from 'react';
import { formatarPeriodo } from '../../utils/datas';
import { rotularAgrupamento } from '../../utils/rotulos';
import { useNotificacao } from '../../hooks/useNotificacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import type { Agrupamento, ConsultarResponse, UsuarioResumo } from '../../api/tipos';

import {
    Card,
    Chip,
    Alert,
    Stack,
    Divider,
    Checkbox,
    Typography,
    CardContent,
    FormControlLabel,
} from '@mui/material';

interface ConsultaPanelProps {
    dataInicio: string;
    dataFim: string;
    agrupamento?: Agrupamento;
    tagsDetalhadas?: string[];
    usuariosSelecionados: UsuarioResumo[];
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
    usuariosSelecionados,
    resultado,
    consultando,
    executar,
    onVoltar,
    onConcluida,
}: ConsultaPanelProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const [forcarConsultaApi, setForcarConsultaApi] = useState(false);

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

                    <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                            Usuários selecionados:
                        </Typography>
                        {usuariosSelecionados.length === 0 ? (
                            <Alert severity="warning">Nenhum usuário selecionado. Marque ao menos um na aba "Usuários".</Alert>
                        ) : (
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                {usuariosSelecionados.map((usuario) => (
                                    <Chip key={usuario.chave} size="small" label={usuario.nomeExibicao} variant="outlined" />
                                ))}
                            </Stack>
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
                            onClick={() => void consultarAgora()}>
                            Consultar
                        </BotaoComCarregamento>
                    </Stack>

                    {resultado && !temDadoAproveitavel(resultado) ? (
                        <Alert severity="warning">Nenhum usuário retornou dados para este período.</Alert>
                    ) : undefined}
                </Stack>
            </CardContent>
        </Card>
    );
}