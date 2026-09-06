import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useParametrosGant } from './useParametrosGant';
import { OPCOES_AGRUPAMENTO } from '../../utils/rotulos';
import { useNotificacao } from '../../hooks/useNotificacao';
import type { Agrupamento, ParametrosGant } from '../../api/tipos';
import { periodoEhValido, ultimos30Dias } from '../../utils/datas';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Card,
    Stack,
    MenuItem,
    TextField,
    Typography,
    CardContent,
    Autocomplete,
} from '@mui/material';

interface ParametrosGantFormProps {
    onSalvo: (params: ParametrosGant) => void;
    semUsuarios: boolean;
}

export function ParametrosGantForm({ onSalvo, semUsuarios }: ParametrosGantFormProps): ReactNode {
    const [dataFim, setDataFim] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const { carregar, salvar, salvando } = useParametrosGant();
    const { notificarErro, notificarSucesso } = useNotificacao();
    const [carregandoInicial, setCarregandoInicial] = useState(true);
    const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([]);
    const [agrupamento, setAgrupamento] = useState<Agrupamento>('ambos');

    useEffect(() => {
        let cancelado = false;

        async function carregarInicial(): Promise<void> {
            try {
                const dados = await carregar();
                if (cancelado) return;

                setAgrupamento(dados.agrupamento);
                setTagsSelecionadas(dados.tagsSelecionadas);

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
                    notificarErro(erro, 'Não foi possível carregar os parâmetros do Gant salvos');
                    const sugestao = ultimos30Dias();
                    setDataInicio(sugestao.dataInicio);
                    setDataFim(sugestao.dataFim);
                }
            } finally {
                if (!cancelado) setCarregandoInicial(false);
            }
        }

        void carregarInicial();
        return () => {
            cancelado = true;
        };
    }, []);

    const periodoValido = periodoEhValido(dataInicio, dataFim);
    const mostraTagsSelecionadas = agrupamento === 'tag' || agrupamento === 'ambos';

    async function confirmar(): Promise<void> {
        if (!periodoValido) {
            notificarErro(new Error('A data fim não pode ser anterior à data início.'));
            return;
        }

        try {
            const atualizado = await salvar({ dataInicio, dataFim, tagsSelecionadas, agrupamento });
            notificarSucesso('Parâmetros salvos.');
            onSalvo(atualizado);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível salvar os parâmetros');
        }
    }

    function continuarSemSalvar(): void {
        if (!periodoValido) {
            notificarErro(new Error('A data fim não pode ser anterior à data início.'));
            return;
        }

        onSalvo({ dataInicio, dataFim, tagsSelecionadas, agrupamento });
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={3}>
                    <Typography variant="h6">Parâmetros do Gant</Typography>

                    <TextField
                        select
                        label="Agrupamento"
                        value={agrupamento}
                        onChange={(evento) => setAgrupamento(evento.target.value as Agrupamento)}
                        disabled={carregandoInicial}
                        fullWidth                    >
                        {OPCOES_AGRUPAMENTO.map((opcao) => (
                            <MenuItem key={opcao.valor} value={opcao.valor}>
                                {opcao.rotulo}
                            </MenuItem>
                        ))}
                    </TextField>

                    {mostraTagsSelecionadas ? (
                        <Autocomplete
                            multiple
                            freeSolo
                            autoSelect
                            options={[]}
                            value={tagsSelecionadas}
                            onChange={(_evento, novoValor) => setTagsSelecionadas(novoValor as string[])}
                            disabled={carregandoInicial}
                            renderInput={(parametros) => (
                                <TextField
                                    {...parametros}
                                    label="Tags para detalhar por descrição"
                                    placeholder="Digite uma tag e pressione Enter (ou clique fora do campo)"
                                    helperText="Tags nesta lista aparecem detalhadas por descrição, as demais ficam agrupadas por tag" />
                            )} />
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
                            onClick={() => void confirmar()}>
                            Salvar e continuar
                        </BotaoComCarregamento>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}