import { CORES } from '../../theme';
import type { ReactNode } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import type { LinhaTarefaSprint } from '../../api/tipos';
import { BadgeSigla } from '../../components/BadgeSigla';
import { BadgeTexto, EtiquetaFixa } from './SprintBadges';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { GRUPOS, corDaSituacao, formatarCodigo, infoPrioridade, truncarDescricao } from './calculos';

import {
    Box,
    Link,
    Table,
    Stack,
    Button,
    Dialog,
    Tooltip,
    Divider,
    TableRow,
    TableBody,
    TableHead,
    TableCell,
    Typography,
    DialogTitle,
    DialogContent,
    DialogActions,
    TableContainer,
} from '@mui/material';

const COR_PENDENTE = CORES.corPendente;
const COR_CONCLUIDO = CORES.corConcluido;

interface SprintDialogDetalheLinhaProps {
    aberto: boolean;
    onFechar: () => void;
    linha: LinhaTarefaSprint | null;
    codigoDuplicado: boolean;
    larguraCodigo: number;
    coresStatus: Record<string, string>;
    coresPrioridade: Record<string, string>;
    corTag: string;
}

export function SprintDialogDetalheLinha({
    aberto,
    onFechar,
    linha,
    codigoDuplicado,
    larguraCodigo,
    coresStatus,
    coresPrioridade,
    corTag,
}: SprintDialogDetalheLinhaProps): ReactNode {
    if (!linha) {
        return <Dialog open={false} onClose={onFechar} />;
    }

    const prioridade = infoPrioridade(linha.prioridade, coresPrioridade);
    const codigo = linha.agrupada ? 'Tag' : formatarCodigo(linha.codigo, larguraCodigo);

    return (
        <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Stack spacing={0.5}>
                    <Typography
                        variant="h6"
                        sx={codigoDuplicado ? { color: COR_PENDENTE, fontWeight: 700 } : undefined}>
                        {codigo}
                    </Typography>
                    <Tooltip title={linha.descricao || '(sem descrição)'}>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={codigoDuplicado ? { color: COR_PENDENTE, fontWeight: 700 } : undefined}>
                            {truncarDescricao(linha.descricao || '(sem descrição)')}
                        </Typography>
                    </Tooltip>
                </Stack>
            </DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    {codigoDuplicado ? (
                        <Typography variant="body2" sx={{ color: COR_PENDENTE, fontWeight: 700 }}>
                            Código repetido: mais de um colaborador ocupa a mesma posição (DEV/REV/QA) desta
                            descrição.
                        </Typography>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        {linha.agrupada ? (
                            <BadgeTexto texto="Tag" cor={corTag} largura="6.5rem" />
                        ) : (
                            <>
                                <BadgeTexto texto={prioridade.texto} cor={prioridade.cor} largura="6.5rem" />
                                <BadgeTexto
                                    texto={linha.situacao ?? 'Nenhuma'}
                                    cor={corDaSituacao(linha.situacao, coresStatus)}
                                    largura="6.5rem" />
                            </>
                        )}
                        {linha.jiraIndisponivel ? (
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                <ErrorOutlineIcon fontSize="small" sx={{ color: COR_PENDENTE }} />
                                <Typography variant="body2" sx={{ color: COR_PENDENTE }}>
                                    Não foi possível carregar os dados desta tarefa no Jira.
                                </Typography>
                            </Stack>
                        ) : undefined}
                    </Stack>

                    {linha.urlJira ? (
                        <Link href={linha.urlJira} target="_blank" rel="noopener noreferrer" variant="body2">
                            Abrir no Jira
                        </Link>
                    ) : undefined}

                    <Divider />

                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell />
                                    {GRUPOS.map((grupo) => (
                                        <TableCell key={grupo.rotulo} align="center">
                                            {grupo.nomeLongo}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell sx={{ color: 'text.secondary' }}>Colaborador</TableCell>
                                    {GRUPOS.map((grupo) => {
                                        const bloco = linha[grupo.bloco];
                                        const temColaborador = bloco.nomeExibicao !== null;
                                        return (
                                            <TableCell key={grupo.rotulo} align="center">
                                                {temColaborador ? (
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center' }}>
                                                        <BadgeSigla
                                                            sigla={bloco.sigla ?? ''}
                                                            cor={bloco.cor ?? undefined}
                                                            nome={bloco.nomeExibicao ?? undefined} />
                                                        <Typography variant="body2">{bloco.nomeExibicao}</Typography>
                                                    </Stack>
                                                ) : (
                                                    <EtiquetaFixa texto="–" cor="text.primary" />
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>

                                <TableRow>
                                    <TableCell sx={{ color: 'text.secondary' }}>PRE (previsto)</TableCell>
                                    {GRUPOS.map((grupo) => {
                                        const bloco = linha[grupo.bloco];
                                        const preSegundos = Math.round(bloco.preHoras * 3600);
                                        return (
                                            <TableCell key={grupo.rotulo} align="center">
                                                {bloco.preHoras > 0 ? (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ color: 'primary.main', fontWeight: 600 }}>
                                                        {formatarDuracao(preSegundos)}
                                                    </Typography>
                                                ) : (
                                                    <EtiquetaFixa texto="–" cor="text.primary" />
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>

                                <TableRow>
                                    <TableCell sx={{ color: 'text.secondary' }}>REA (realizado)</TableCell>
                                    {GRUPOS.map((grupo) => {
                                        const bloco = linha[grupo.bloco];
                                        const preSegundos = Math.round(bloco.preHoras * 3600);
                                        const reaExcedePre = preSegundos > 0 && bloco.reaSegundos > preSegundos;
                                        return (
                                            <TableCell key={grupo.rotulo} align="center">
                                                {bloco.reaSegundos > 0 ? (
                                                    <Box>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                color: reaExcedePre ? COR_PENDENTE : 'primary.main',
                                                                fontWeight: 600,
                                                            }}>
                                                            {formatarDuracao(bloco.reaSegundos)}
                                                        </Typography>
                                                        {reaExcedePre ? (
                                                            <Typography variant="caption" sx={{ color: COR_PENDENTE }}>
                                                                Excede a estimativa ({formatarDuracao(preSegundos)})
                                                            </Typography>
                                                        ) : undefined}
                                                    </Box>
                                                ) : (
                                                    <EtiquetaFixa texto="–" cor="text.primary" />
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>

                                <TableRow>
                                    <TableCell sx={{ color: 'text.secondary' }}>Situação</TableCell>
                                    {GRUPOS.map((grupo) => {
                                        const bloco = linha[grupo.bloco];
                                        const temColaborador = bloco.nomeExibicao !== null;
                                        return (
                                            <TableCell key={grupo.rotulo} align="center">
                                                {temColaborador ? (
                                                    linha.agrupada ? (
                                                        <EtiquetaFixa texto="Tag" cor={corTag} />
                                                    ) : linha.grupoResponsavelStatus ? (
                                                        <EtiquetaFixa
                                                            texto={grupo.bloco === linha.grupoResponsavelStatus ? 'Pendente' : 'Concluído'}
                                                            cor={grupo.bloco === linha.grupoResponsavelStatus ? COR_PENDENTE : COR_CONCLUIDO} />
                                                    ) : linha.situacaoSemGrupoResponsavel ? (
                                                        <EtiquetaFixa texto="Concluído" cor={COR_CONCLUIDO} />
                                                    ) : (
                                                        <EtiquetaFixa texto="Pendente" cor={COR_PENDENTE} />
                                                    )
                                                ) : (
                                                    <EtiquetaFixa texto="–" cor="text.primary" />
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onFechar}>Fechar</Button>
            </DialogActions>
        </Dialog>
    );
}