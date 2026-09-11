import type { ReactNode } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import { formatarInicioLocal } from '../../utils/datas';
import { BadgeSigla } from '../../components/BadgeSigla';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { curarPorDescricao, ordenarPorTag } from './curadoria';
import type { Agrupamento, RelatorioUsuarioToggl } from '../../api/tipos';

import {
    Chip,
    Stack,
    Table,
    Divider,
    Checkbox,
    TableRow,
    TableBody,
    TableCell,
    TableHead,
    Accordion,
    Typography,
    TableContainer,
    AccordionDetails,
    AccordionSummary,
} from '@mui/material';

interface RelatorioUsuarioCardProps {
    usuario: RelatorioUsuarioToggl;
    agrupamento: Agrupamento;
    expandido: boolean;
    onAlternar: () => void;
    selecionados: Set<string>;
    onAlternarSelecao: (chave: string) => void;
}

const CELULA_TAG = {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
} as const;

export function RelatorioUsuarioCard({
    usuario,
    agrupamento,
    expandido,
    onAlternar,
    selecionados,
    onAlternarSelecao,
}: RelatorioUsuarioCardProps): ReactNode {
    const mostraPorDescricao = agrupamento === 'descricao' || agrupamento === 'ambos';
    const mostraPorTag = agrupamento === 'tag' || agrupamento === 'ambos';

    const linhasDescricao = mostraPorDescricao ? curarPorDescricao(usuario.porDescricao) : [];
    const linhasTag = mostraPorTag ? ordenarPorTag(usuario.porTag) : [];
    const temEmAndamento = usuario.emAndamento.length > 0;
    const semDados = linhasDescricao.length === 0 && linhasTag.length === 0;

    const chaveDescricao = (chaveLinha: string): string => `${usuario.nomeExibicao}::descricao::${chaveLinha}`;
    const chaveTag = (tag: string): string => `${usuario.nomeExibicao}::tag::${tag}`;

    return (
        <Accordion expanded={expandido} onChange={onAlternar} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', width: '100%', pr: 2, flexWrap: 'wrap' }}>
                    <BadgeSigla sigla={usuario.sigla} cor={usuario.cor} nome={usuario.nomeExibicao} />
                    <Typography sx={{ fontWeight: 600, color: 'primary.main', flexGrow: 1, minWidth: 0 }}>
                        {usuario.nomeExibicao}
                    </Typography>
                    <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`Total: ${formatarDuracao(usuario.totalSegundos)}`} />
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={2}>
                    {semDados ? (
                        <Typography variant="body2" color="text.secondary">
                            (nenhum dado)
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table size="small" sx={{ '& th, & td': { py: 0 } }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: '1%', px: 0.5, py: 0.25 }} />
                                        <TableCell sx={{ py: 0.25 }}>Descrição</TableCell>
                                        <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap' }}>Tag</TableCell>
                                        <TableCell align="right" sx={{ py: 0.25, whiteSpace: 'nowrap' }}>Tempo</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {linhasDescricao.map((linha) => {
                                        const chave = chaveDescricao(linha.chave);
                                        const selecionado = selecionados.has(chave);
                                        return (
                                            <TableRow key={`descricao-${linha.chave}`} hover>
                                                <TableCell sx={{ width: '1%', px: 0.5 }}>
                                                    <Checkbox
                                                        size="small"
                                                        checked={selecionado}
                                                        onChange={() => onAlternarSelecao(chave)}
                                                        sx={{ p: 0.25 }} />
                                                </TableCell>
                                                <TableCell
                                                    sx={{ textDecoration: selecionado ? 'line-through' : 'none' }}>
                                                    {linha.descricao}
                                                </TableCell>
                                                <TableCell sx={CELULA_TAG}>{linha.tag}</TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                    {formatarDuracao(linha.segundos)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {linhasTag.map((linha) => {
                                        const chave = chaveTag(linha.tag);
                                        const selecionado = selecionados.has(chave);
                                        return (
                                            <TableRow key={`tag-${linha.tag}`} hover>
                                                <TableCell sx={{ width: '1%', px: 0.5 }}>
                                                    <Checkbox
                                                        size="small"
                                                        checked={selecionado}
                                                        onChange={() => onAlternarSelecao(chave)}
                                                        sx={{ p: 0.25 }} />
                                                </TableCell>
                                                <TableCell>Agrupado por TAG</TableCell>
                                                <TableCell
                                                    sx={{
                                                        ...CELULA_TAG,
                                                        textDecoration: selecionado ? 'line-through' : 'none',
                                                    }}>
                                                    {linha.tag}
                                                </TableCell>
                                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                                    {formatarDuracao(linha.segundos)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {temEmAndamento ? (
                        <>
                            <Divider />
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Em andamento
                                </Typography>
                                {usuario.emAndamento.map((registro) => (
                                    <Typography key={registro.id} variant="body2">
                                        {`"${registro.description?.trim() || '(sem descrição)'}" (iniciado às ${formatarInicioLocal(registro.start)})`}
                                    </Typography>
                                ))}
                            </Stack>
                        </>
                    ) : undefined}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}