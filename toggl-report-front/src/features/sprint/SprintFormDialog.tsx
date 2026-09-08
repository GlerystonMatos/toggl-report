import type { ReactNode } from 'react';
import { useSprints } from './useSprints';
import { useEffect, useState } from 'react';
import type { Sprint } from '../../api/tipos';
import { periodoEhValido } from '../../utils/datas';
import { useNotificacao } from '../../hooks/useNotificacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Stack,
    Dialog,
    TextField,
    DialogTitle,
    DialogActions,
    DialogContent,
} from '@mui/material';

interface SprintFormDialogProps {
    aberto: boolean;
    sprintEmEdicao: Sprint | null;
    onFechar: () => void;
    onSalvo: (mensagem: string) => void;
}

export function SprintFormDialog({ aberto, sprintEmEdicao, onFechar, onSalvo }: SprintFormDialogProps): ReactNode {
    const emEdicao = sprintEmEdicao !== null;
    const { criar, editar } = useSprints();
    const { notificarErro } = useNotificacao();

    const [nome, setNome] = useState('');
    const [horasPorDia, setHorasPorDia] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (aberto) {
            setNome(sprintEmEdicao?.nome ?? '');
            setHorasPorDia(sprintEmEdicao ? String(sprintEmEdicao.horasPorDia) : '');
            setDataInicio(sprintEmEdicao?.dataInicio ?? '');
            setDataFim(sprintEmEdicao?.dataFim ?? '');
        }
    }, [aberto, sprintEmEdicao]);

    function fecharEResetar(): void {
        setNome('');
        setHorasPorDia('');
        setDataInicio('');
        setDataFim('');
        onFechar();
    }

    const horasNumero = Number(horasPorDia.replace(',', '.'));
    const horasValidas = horasPorDia.trim() !== '' && Number.isFinite(horasNumero) && horasNumero > 0;
    const datasPreenchidas = dataInicio !== '' && dataFim !== '';
    const periodoValido = datasPreenchidas && periodoEhValido(dataInicio, dataFim);
    const formValido = nome.trim() !== '' && horasValidas && periodoValido;

    async function salvar(): Promise<void> {
        if (!formValido) {
            notificarErro(new Error('Preencha nome, horas por dia (maior que zero) e um período válido.'));
            return;
        }

        setSalvando(true);
        try {
            if (emEdicao && sprintEmEdicao) {
                await editar(sprintEmEdicao.chave, { nome: nome.trim(), horasPorDia: horasNumero, dataInicio, dataFim });
            } else {
                await criar({ nome: nome.trim(), horasPorDia: horasNumero, dataInicio, dataFim });
            }
            onSalvo(emEdicao ? 'Sprint atualizado com sucesso.' : 'Sprint criado com sucesso.');
            fecharEResetar();
        } catch (erro) {
            notificarErro(erro, 'Não foi possível salvar o sprint');
        } finally {
            setSalvando(false);
        }
    }

    return (
        <Dialog open={aberto} onClose={salvando ? undefined : fecharEResetar} fullWidth maxWidth="sm">
            <DialogTitle>{emEdicao ? 'Editar sprint' : 'Adicionar sprint'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Nome"
                        value={nome}
                        onChange={(evento) => setNome(evento.target.value)}
                        autoFocus
                        fullWidth
                        disabled={salvando} />

                    <TextField
                        label="Horas por dia"
                        type="number"
                        value={horasPorDia}
                        onChange={(evento) => setHorasPorDia(evento.target.value)}
                        error={horasPorDia.trim() !== '' && !horasValidas}
                        helperText={
                            horasPorDia.trim() !== '' && !horasValidas
                                ? 'Informe um número maior que zero (ex.: 7 ou 7.5).'
                                : undefined
                        }
                        slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                        fullWidth
                        disabled={salvando} />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            label="Data início"
                            type="date"
                            value={dataInicio}
                            onChange={(evento) => setDataInicio(evento.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }}
                            fullWidth
                            disabled={salvando} />
                        <TextField
                            label="Data fim"
                            type="date"
                            value={dataFim}
                            onChange={(evento) => setDataFim(evento.target.value)}
                            error={datasPreenchidas && !periodoValido}
                            helperText={
                                datasPreenchidas && !periodoValido
                                    ? 'A data fim não pode ser anterior à data início.'
                                    : undefined
                            }
                            slotProps={{ inputLabel: { shrink: true } }}
                            fullWidth
                            disabled={salvando} />
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <BotaoComCarregamento onClick={fecharEResetar} disabled={salvando}>
                    Cancelar
                </BotaoComCarregamento>
                <BotaoComCarregamento
                    variant="contained"
                    carregando={salvando}
                    disabled={!formValido}
                    onClick={() => void salvar()}>
                    Salvar
                </BotaoComCarregamento>
            </DialogActions>
        </Dialog>
    );
}