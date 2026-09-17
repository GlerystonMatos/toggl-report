import { CORES } from '../../theme';
import type { ReactNode } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import type { LinhaTarefaSprint } from '../../api/tipos';
import { BadgeSigla } from '../../components/BadgeSigla';
import { BadgeTexto, EtiquetaFixa } from './SprintBadges';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { GRUPOS, corDaSituacao, formatarCodigo, infoPrioridade } from './calculos';

import {
    Box,
    Link,
    Stack,
    Button,
    Dialog,
    Divider,
    Typography,
    DialogTitle,
    DialogContent,
    DialogActions,
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
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={codigoDuplicado ? { color: COR_PENDENTE, fontWeight: 700 } : undefined}>
                        {linha.descricao || '(sem descrição)'}
                    </Typography>
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

                    <Stack spacing={2}>
                        {GRUPOS.map((grupo) => {
                            const bloco = linha[grupo.bloco];
                            const temColaborador = bloco.nomeExibicao !== null;
                            const preSegundos = Math.round(bloco.preHoras * 3600);
                            const reaExcedePre = preSegundos > 0 && bloco.reaSegundos > preSegundos;

                            return (
                                <Stack key={grupo.rotulo} spacing={1}>
                                    <Typography variant="subtitle2">{grupo.nomeLongo}</Typography>
                                    <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                        <Stack spacing={0.25}>
                                            <Typography variant="caption" color="text.secondary">
                                                Colaborador
                                            </Typography>
                                            {temColaborador ? (
                                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                    <BadgeSigla
                                                        sigla={bloco.sigla ?? ''}
                                                        cor={bloco.cor ?? undefined}
                                                        nome={bloco.nomeExibicao ?? undefined} />
                                                    <Typography variant="body2">{bloco.nomeExibicao}</Typography>
                                                </Stack>
                                            ) : (
                                                <EtiquetaFixa texto="–" cor="text.primary" />
                                            )}
                                        </Stack>

                                        <Stack spacing={0.25}>
                                            <Typography variant="caption" color="text.secondary">
                                                PRE (previsto)
                                            </Typography>
                                            {bloco.preHoras > 0 ? (
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ color: 'primary.main', fontWeight: 600 }}>
                                                        {formatarDuracao(preSegundos)}
                                                    </Typography>
                                                    {grupo.bloco === 'dev' && bloco.estimativaOriginalHoras !== null ? (
                                                        <Typography variant="caption" color="text.secondary">
                                                            Estimativa original:{' '}
                                                            {formatarDuracao(Math.round(bloco.estimativaOriginalHoras * 3600))}
                                                        </Typography>
                                                    ) : undefined}
                                                </Box>
                                            ) : (
                                                <EtiquetaFixa texto="–" cor="text.primary" />
                                            )}
                                        </Stack>

                                        <Stack spacing={0.25}>
                                            <Typography variant="caption" color="text.secondary">
                                                REA (realizado)
                                            </Typography>
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
                                        </Stack>

                                        <Stack spacing={0.25}>
                                            <Typography variant="caption" color="text.secondary">
                                                Situação
                                            </Typography>
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
                                        </Stack>
                                    </Stack>
                                </Stack>
                            );
                        })}
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onFechar}>Fechar</Button>
            </DialogActions>
        </Dialog>
    );
}