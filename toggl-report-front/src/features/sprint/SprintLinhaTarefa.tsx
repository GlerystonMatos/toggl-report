import { CORES } from '../../theme';
import { Fragment, type ReactNode } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import type { LinhaTarefaSprint } from '../../api/tipos';
import { BadgeSigla } from '../../components/BadgeSigla';
import { BadgeTexto, EtiquetaFixa } from './SprintBadges';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';

import {
    GRUPOS,
    corDaSituacao,
    situacaoGrupo,
    formatarCodigo,
    infoPrioridade,
    formatarHoraResumida,
} from './calculos';

import { Box, Stack, Tooltip, Checkbox, TableRow, TableCell } from '@mui/material';

const COR_PENDENTE = CORES.corPendente;
const COR_CONCLUIDO = CORES.corConcluido;

const LARGURA_CELULA = '2.5rem';
const LARGURA_BADGE_STATUS = '6.5rem';

interface SprintLinhaTarefaProps {
    linha: LinhaTarefaSprint;
    id: string;
    codigoDuplicado: boolean;
    riscada: boolean;
    onAlternarTachado: (id: string) => void;
    destacada: boolean;
    onAlternarDestaque: (id: string) => void;
    onDuploClique: () => void;
    larguraCodigo: number;
    larguraDescricao?: number;
    coresStatus: Record<string, string>;
    coresPrioridade: Record<string, string>;
    corTag: string;
}

export function SprintLinhaTarefa({
    linha,
    id,
    codigoDuplicado,
    riscada,
    onAlternarTachado,
    destacada,
    onAlternarDestaque,
    onDuploClique,
    larguraCodigo,
    larguraDescricao,
    coresStatus,
    coresPrioridade,
    corTag,
}: SprintLinhaTarefaProps): ReactNode {
    const conteudoCodigo = linha.urlJira ? (
        <Box
            component="a"
            href={linha.urlJira}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(evento) => evento.stopPropagation()}
            onDoubleClick={(evento) => evento.stopPropagation()}
            sx={{
                color: codigoDuplicado ? COR_PENDENTE : 'primary.main',
                textDecoration: 'underline',
                fontWeight: codigoDuplicado ? 700 : undefined,
            }}>
            {formatarCodigo(linha.codigo, larguraCodigo)}
        </Box>
    ) : (
        formatarCodigo(linha.codigo, larguraCodigo)
    );
    const prioridade = infoPrioridade(linha.prioridade, coresPrioridade);

    return (
        <TableRow
            hover
            selected={destacada}
            onClick={() => onAlternarDestaque(id)}
            onDoubleClick={onDuploClique}
            sx={{ cursor: 'pointer' }}>
            <TableCell sx={{ width: '1%', px: 0.5 }}>
                <Checkbox
                    size="small"
                    checked={riscada}
                    onChange={() => onAlternarTachado(id)}
                    onClick={(evento) => evento.stopPropagation()}
                    onDoubleClick={(evento) => evento.stopPropagation()}
                    sx={{ p: 0.25 }} />
            </TableCell>
            <TableCell align="center" sx={{ width: '1%', px: 0.5, whiteSpace: 'nowrap' }}>
                {linha.agrupada ? (
                    <BadgeTexto texto="Tag" cor={corTag} largura={LARGURA_BADGE_STATUS} />
                ) : (
                    <BadgeTexto
                        texto={prioridade.texto}
                        cor={prioridade.cor}
                        largura={LARGURA_BADGE_STATUS} />
                )}
            </TableCell>
            <TableCell align="center" sx={{ width: '1%', px: 0.5, whiteSpace: 'nowrap' }}>
                {linha.agrupada ? (
                    <BadgeTexto texto="Tag" cor={corTag} largura={LARGURA_BADGE_STATUS} />
                ) : (
                    <BadgeTexto
                        texto={linha.situacao ?? 'Nenhuma'}
                        cor={corDaSituacao(linha.situacao, coresStatus)}
                        largura={LARGURA_BADGE_STATUS} />
                )}
            </TableCell>
            <TableCell
                align="center"
                sx={{
                    width: '1%',
                    px: 0.5,
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    ...(codigoDuplicado
                        ? { color: COR_PENDENTE + ' !important', fontWeight: 700 }
                        : {}),
                }}>
                <Stack direction="row" spacing={0.3} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                    {codigoDuplicado ? (
                        <Tooltip title="Código repetido: mais de um colaborador ocupa a mesma posição (DEV/REV/QA) desta descrição.">
                            <Box component="span">
                                {conteudoCodigo}
                            </Box>
                        </Tooltip>
                    ) : (
                        conteudoCodigo
                    )}
                    {linha.jiraIndisponivel ? (
                        <Tooltip title="Não foi possível carregar os dados desta tarefa no Jira.">
                            <ErrorOutlineIcon fontSize="inherit" sx={{ color: COR_PENDENTE, ml: '0.5rem !important' }} />
                        </Tooltip>
                    ) : undefined}
                </Stack>
            </TableCell>
            <TableCell
                sx={{
                    px: 0.8,
                    ...(larguraDescricao !== undefined
                        ? { width: larguraDescricao, maxWidth: larguraDescricao }
                        : { maxWidth: 360 }),
                }}>
                <Tooltip title={linha.descricao}>
                    <Box
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            ...(riscada
                                ? { textDecoration: 'line-through', color: 'text.disabled' }
                                : {}),
                            ...(codigoDuplicado
                                ? { color: COR_PENDENTE, fontWeight: 700 }
                                : {}),
                        }}>
                        {linha.descricao || '(sem descrição)'}
                    </Box>
                </Tooltip>
            </TableCell>
            {GRUPOS.map((grupo) => {
                const bloco = linha[grupo.bloco];
                const temColaborador = bloco.nomeExibicao !== null;
                const situacao = situacaoGrupo(linha, grupo.bloco);
                const corSituacao = situacao === 'Tag' ? corTag : situacao === 'Concluído' ? COR_CONCLUIDO : COR_PENDENTE;
                const preSegundos = Math.round(bloco.preHoras * 3600);
                const reaExcedePre = preSegundos > 0 && bloco.reaSegundos > preSegundos;
                const tooltipPre = formatarDuracao(preSegundos);
                const tooltipRea = reaExcedePre
                    ? `${formatarDuracao(bloco.reaSegundos)} — excede a estimativa (${formatarDuracao(preSegundos)})`
                    : formatarDuracao(bloco.reaSegundos);
                return (
                    <Fragment key={grupo.rotulo}>
                        <TableCell align="center" sx={{ px: 0.5, width: LARGURA_CELULA, borderLeft: 1, borderColor: 'divider', whiteSpace: 'nowrap' }}>
                            {bloco.preHoras > 0 ? (
                                <Tooltip title={tooltipPre}>
                                    <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                                        {formatarHoraResumida(preSegundos)}
                                    </Box>
                                </Tooltip>
                            ) : (
                                <EtiquetaFixa texto="–" cor="text.primary" />
                            )}
                        </TableCell>
                        <TableCell align="center" sx={{ px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap' }}>
                            {bloco.reaSegundos > 0 ? (
                                <Tooltip title={tooltipRea}>
                                    <Box component="span" sx={{ color: reaExcedePre ? COR_PENDENTE : 'primary.main', fontWeight: 600 }}>
                                        {formatarHoraResumida(bloco.reaSegundos)}
                                    </Box>
                                </Tooltip>
                            ) : (
                                <EtiquetaFixa texto="–" cor="text.primary" />
                            )}
                        </TableCell>
                        <TableCell align="center" sx={{ px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap' }}>
                            {temColaborador ? (
                                <BadgeSigla
                                    sigla={bloco.sigla ?? ''}
                                    cor={bloco.cor ?? undefined}
                                    nome={bloco.nomeExibicao ?? undefined} />
                            ) : (
                                <EtiquetaFixa texto="–" cor="text.primary" />
                            )}
                        </TableCell>
                        <TableCell align="center" sx={{ px: 0.5, width: '1%', whiteSpace: 'nowrap' }}>
                            {temColaborador ? (
                                <EtiquetaFixa texto={situacao} cor={corSituacao} />
                            ) : (
                                <EtiquetaFixa texto="–" cor="text.primary" />
                            )}
                        </TableCell>
                    </Fragment>
                );
            })}
        </TableRow>
    );
}