import { useState } from 'react';
import { CORES } from '../../theme';
import type { ReactNode } from 'react';
import { formatarDisponivel } from './calculos';
import { formatarDuracao } from '../../utils/duracao';
import { BadgeSigla } from '../../components/BadgeSigla';
import type { LinhaColaboradorSprint } from '../../api/tipos';

import {
    Table,
    Stack,
    TableRow,
    TableBody,
    TableCell,
    TableHead,
    IconButton,
    Typography,
    TableFooter,
    TableContainer,
} from '@mui/material';

const COR_PENDENTE = CORES.corPendente;
const COR_CONCLUIDO = CORES.corConcluido;

interface SprintCardColaboradoresProps {
    colaboradores: LinhaColaboradorSprint[];
}

export function SprintCardColaboradores({ colaboradores }: SprintCardColaboradoresProps): ReactNode {
    const [expandido, setExpandido] = useState(true);
    const totalPendentes = colaboradores.reduce((soma, colaborador) => soma + colaborador.tarefasPendentes, 0);
    const totalConcluidas = colaboradores.reduce((soma, colaborador) => soma + colaborador.tarefasConcluidas, 0);

    return (
        <Stack spacing={1}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                    Colaboradores
                </Typography>
                <IconButton
                    size="small"
                    onClick={() => setExpandido((atual) => !atual)}
                    aria-label={expandido ? 'Recolher colaboradores' : 'Expandir colaboradores'}>
                    {expandido ? '–' : '+'}
                </IconButton>
            </Stack>
            {expandido && (
                <TableContainer sx={{ overflowX: 'auto', mt: '0rem !important' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ py: 0.5 }}>Nome</TableCell>
                                <TableCell sx={{ py: 0.5 }}>Sigla</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">Capacidade</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">Tempo realizado</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">Tempo disponível</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">Quantidade pendentes</TableCell>
                                <TableCell sx={{ py: 0.5 }} align="right">Quantidade concluídas</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {colaboradores.map((colaborador) => {
                                const disponivel = formatarDisponivel(colaborador.td, colaborador.segundosRealizados);
                                return (
                                    <TableRow key={colaborador.nomeExibicao} hover>
                                        <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap' }}>
                                            {colaborador.nomeExibicao}
                                        </TableCell>
                                        <TableCell sx={{ py: 0.25 }}>
                                            <BadgeSigla sigla={colaborador.sigla} cor={colaborador.cor} nome={colaborador.nomeExibicao} sx={{ borderRadius: 1 }} />
                                        </TableCell>
                                        <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap' }} align="right">
                                            {`${colaborador.td} h`}
                                        </TableCell>
                                        <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap' }} align="right">
                                            {formatarDuracao(colaborador.segundosRealizados)}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                py: 0.25,
                                                whiteSpace: 'nowrap',
                                                color: disponivel.negativo
                                                    ? COR_PENDENTE
                                                    : disponivel.positivo
                                                        ? COR_CONCLUIDO
                                                        : undefined,
                                            }}
                                            align="right">
                                            {disponivel.texto}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                py: 0.25,
                                                color: colaborador.tarefasPendentes > 0 ? COR_PENDENTE : undefined,
                                            }}
                                            align="right">
                                            {colaborador.tarefasPendentes}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                py: 0.25,
                                                color: colaborador.tarefasConcluidas > 0 ? COR_CONCLUIDO : undefined,
                                            }}
                                            align="right">
                                            {colaborador.tarefasConcluidas}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    align="right"
                                    sx={{ py: 0.5, fontWeight: 700, color: 'text.primary', borderTop: 2, borderColor: 'divider' }}>
                                    Total
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontWeight: 700, color: totalPendentes > 0 ? COR_PENDENTE : 'text.primary', borderTop: 2, borderColor: 'divider' }}>
                                    {totalPendentes}
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{ py: 0.5, fontWeight: 700, color: totalConcluidas > 0 ? COR_CONCLUIDO : 'text.primary', borderTop: 2, borderColor: 'divider' }}>
                                    {totalConcluidas}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </TableContainer>
            )}
        </Stack>
    );
}