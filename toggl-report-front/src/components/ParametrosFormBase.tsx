import type { ReactNode } from 'react';
import { CampoTags } from './CampoTags';
import { useEffect, useState } from 'react';
import type { Agrupamento } from '../api/tipos';
import { SelectAgrupamento } from './SelectAgrupamento';
import { useNotificacao } from '../hooks/useNotificacao';
import { BotaoComCarregamento } from './BotaoComCarregamento';
import { periodoEhValido, ultimos30Dias } from '../utils/datas';

import {
    Card,
    Stack,
    TextField,
    Typography,
    CardContent,
} from '@mui/material';

export interface DadosParametros {
    agrupamento: Agrupamento;
    tags: string[];
    dataInicio: string;
    dataFim: string;
}

interface ParametrosCarregados {
    agrupamento: Agrupamento;
    tags: string[];
    dataInicio: string | null;
    dataFim: string | null;
}

interface ParametrosFormBaseProps {
    titulo: string;
    semUsuarios: boolean;
    salvando: boolean;
    mensagemErroCarregar: string;
    carregarInicial: () => Promise<ParametrosCarregados>;
    aoConfirmar: (dados: DadosParametros) => void;
    aoContinuar: (dados: DadosParametros) => void;
}

export function ParametrosFormBase({
    titulo,
    semUsuarios,
    salvando,
    mensagemErroCarregar,
    carregarInicial,
    aoConfirmar,
    aoContinuar,
}: ParametrosFormBaseProps): ReactNode {
    const [dataFim, setDataFim] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const { notificarErro } = useNotificacao();
    const [carregandoInicial, setCarregandoInicial] = useState(true);
    const [tags, setTags] = useState<string[]>([]);
    const [agrupamento, setAgrupamento] = useState<Agrupamento>('ambos');

    useEffect(() => {
        let cancelado = false;

        async function executar(): Promise<void> {
            try {
                const dados = await carregarInicial();
                if (cancelado) return;

                setAgrupamento(dados.agrupamento);
                setTags(dados.tags);

                if (dados.dataInicio && dados.dataFim) {
                    setDataInicio(dados.dataInicio);
                    setDataFim(dados.dataFim);
                } else {
                    const sugestao = ultimos30Dias();
                    setDataInicio(sugestao.dataInicio);
                    setDataFim(sugestao.dataFim);
                }
            } catch (erro) {
                if (!cancelado) {
                    notificarErro(erro, mensagemErroCarregar);
                    const sugestao = ultimos30Dias();
                    setDataInicio(sugestao.dataInicio);
                    setDataFim(sugestao.dataFim);
                }
            } finally {
                if (!cancelado) setCarregandoInicial(false);
            }
        }

        void executar();
        return () => {
            cancelado = true;
        };
    }, []);

    const periodoValido = periodoEhValido(dataInicio, dataFim);
    const mostraTags = agrupamento === 'tag' || agrupamento === 'ambos';

    function confirmar(): void {
        if (!periodoValido) {
            notificarErro(new Error('A data fim não pode ser anterior à data início.'));
            return;
        }
        aoConfirmar({ agrupamento, tags, dataInicio, dataFim });
    }

    function continuarSemSalvar(): void {
        if (!periodoValido) {
            notificarErro(new Error('A data fim não pode ser anterior à data início.'));
            return;
        }
        aoContinuar({ agrupamento, tags, dataInicio, dataFim });
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={3}>
                    <Typography variant="h6">{titulo}</Typography>

                    <SelectAgrupamento
                        value={agrupamento}
                        onChange={setAgrupamento}
                        disabled={carregandoInicial} />

                    {mostraTags ? (
                        <CampoTags
                            value={tags}
                            onChange={setTags}
                            disabled={carregandoInicial}
                            label="Tags para detalhar por descrição"
                            placeholder="Digite uma tag e pressione Enter (ou clique fora do campo)"
                            helperText="Tags nesta lista aparecem detalhadas por descrição, as demais ficam agrupadas por tag" />
                    ) : undefined}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            label="Data início"
                            type="date"
                            value={dataInicio}
                            onChange={(evento) => setDataInicio(evento.target.value)}
                            disabled={carregandoInicial}
                            slotProps={{ inputLabel: { shrink: true } }}
                            fullWidth />
                        <TextField
                            label="Data fim"
                            type="date"
                            value={dataFim}
                            onChange={(evento) => setDataFim(evento.target.value)}
                            disabled={carregandoInicial}
                            error={dataInicio !== '' && dataFim !== '' && !periodoValido}
                            helperText={
                                dataInicio !== '' && dataFim !== '' && !periodoValido
                                    ? 'A data fim não pode ser anterior à data início.'
                                    : undefined
                            }
                            slotProps={{ inputLabel: { shrink: true } }}
                            fullWidth />
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento
                            variant="outlined"
                            disabled={carregandoInicial || !periodoValido || semUsuarios}
                            onClick={continuarSemSalvar}>
                            Continuar
                        </BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={salvando}
                            disabled={carregandoInicial || !periodoValido || semUsuarios}
                            onClick={confirmar}>
                            Salvar e continuar
                        </BotaoComCarregamento>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}