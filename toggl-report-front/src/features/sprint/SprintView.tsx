import type { ReactNode } from 'react';
import { useSprint } from './useSprint';
import { formatarData } from '../../utils/datas';
import SearchIcon from '@mui/icons-material/Search';
import { FONTE_MARCA } from '../../utils/tipografia';
import { Fragment, useEffect, useState } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import type { CategoriasSprint } from '../../api/tipos';
import { AvisoCache } from '../../components/AvisoCache';
import { BadgeSigla } from '../../components/BadgeSigla';
import { useNotificacao } from '../../hooks/useNotificacao';
import { CabecalhoView } from '../../components/CabecalhoView';
import { lerTachados, gravarTachados, idLinhaTarefa } from './tachados';
import { EsqueletoCarregando } from '../../components/EsqueletoCarregando';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';
import { contarDigitos, formatarCodigo, formatarDisponivel, formatarHoraResumida } from './calculos';

import {
    Box,
    Table,
    Alert,
    Stack,
    Dialog,
    Button,
    Tooltip,
    Checkbox,
    TableRow,
    TextField,
    TableBody,
    TableCell,
    TableHead,
    Typography,
    DialogTitle,
    TableFooter,
    DialogContent,
    DialogActions,
    TableContainer,
} from '@mui/material';

interface SprintViewProps {
    chaveSprint: string;
    onVoltar: () => void;
    veioDoCache?: boolean;
    categorias?: CategoriasSprint | null;
}

const COR_PENDENTE = '#EA4335';
const COR_CONCLUIDO = '#34A853';
const COR_TAG = '#F57C00';

const LARGURA_CELULA = '2.5rem';

const GRUPOS: { rotulo: string; nomeLongo: string; bloco: 'dev' | 'rev' | 'qa' }[] = [
    { rotulo: 'DEV', nomeLongo: 'Desenvolvimento', bloco: 'dev' },
    { rotulo: 'REV', nomeLongo: 'Revisão', bloco: 'rev' },
    { rotulo: 'QA', nomeLongo: 'Qualidade', bloco: 'qa' },
];

function BadgeTexto({ texto, cor }: { texto: string; cor: string }): ReactNode {
    return (
        <Box
            component="span"
            sx={{
                px: 0.75,
                py: 0.1,
                borderRadius: 0,
                fontWeight: 700,
                minWidth: '3rem',
                fontSize: '0.75rem',
                textAlign: 'center',
                display: 'inline-block',
                textTransform: 'uppercase',
                fontFamily: FONTE_MARCA,
                bgcolor: cor,
                color: 'common.black',
            }}>
            {texto}
        </Box>
    );
}

function EtiquetaFixa({ texto, cor }: { texto: string; cor: string }): ReactNode {
    return (
        <Typography variant="body2" sx={{ color: cor, whiteSpace: 'nowrap' }}>
            {texto}
        </Typography>
    );
}

function ParInfo({ rotulo, valor }: { rotulo: string; valor: string }): ReactNode {
    return (
        <Stack spacing={0} sx={{ flexShrink: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                {rotulo}
            </Typography>
            <Typography
                variant="h6"
                sx={{ color: 'primary.main', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {valor}
            </Typography>
        </Stack>
    );
}

function DestaqueInfo({ rotulo, valor, cor }: { rotulo: string; valor: string; cor: string }): ReactNode {
    return (
        <Box
            sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                border: 2,
                borderColor: cor,
                minWidth: 96,
                flexShrink: 0,
            }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', whiteSpace: 'nowrap' }}>
                {rotulo}
            </Typography>
            <Typography variant="h6" sx={{ color: cor, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                {valor}
            </Typography>
        </Box>
    );
}

export function SprintView({ chaveSprint, onVoltar, veioDoCache = false, categorias }: SprintViewProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const { resultado, carregando, carregar } = useSprint();
    const [dialogoInfoAberto, setDialogoInfoAberto] = useState(false);
    const [buscaAberta, setBuscaAberta] = useState(false);
    const [termoBusca, setTermoBusca] = useState('');
    const [tachados, setTachados] = useState<Set<string>>(() => lerTachados(chaveSprint));

    useEffect(() => {
        carregar(chaveSprint).catch((erro: unknown) =>
            notificarErro(erro, 'Não foi possível carregar o acompanhamento do sprint'),
        );
    }, [chaveSprint]);

    useEffect(() => {
        setTachados(lerTachados(chaveSprint));
    }, [chaveSprint]);

    function alternarTachado(id: string): void {
        setTachados((atual) => {
            const novo = new Set(atual);
            if (novo.has(id)) {
                novo.delete(id);
            } else {
                novo.add(id);
            }
            gravarTachados(chaveSprint, novo);
            return novo;
        });
    }

    const cabecalho = resultado?.cabecalho;
    const tarefas = resultado?.tarefas ?? [];
    const larguraCodigo = tarefas.reduce((maximo, tarefa) => Math.max(maximo, contarDigitos(tarefa.codigo)), 0);
    const tarefasFiltradas = termoBusca.trim()
        ? tarefas.filter((t) =>
            `${t.codigo} ${t.descricao}`.toLowerCase().includes(termoBusca.trim().toLowerCase()),
        )
        : tarefas;
    const colaboradores = resultado?.colaboradores ?? [];
    const totalPendentes = colaboradores.reduce((soma, colaborador) => soma + colaborador.tarefasPendentes, 0);
    const totalConcluidas = colaboradores.reduce((soma, colaborador) => soma + colaborador.tarefasConcluidas, 0);

    return (
        <Stack spacing={2}>
            <CabecalhoView titulo="Acompanhamento do sprint">
                <Button variant="outlined" onClick={() => setDialogoInfoAberto(true)}>
                    Informações
                </Button>
                <BotaoComCarregamento
                    startIcon={<SearchIcon />}
                    onClick={() => {
                        if (buscaAberta) {
                            setTermoBusca('');
                        }
                        setBuscaAberta((a) => !a);
                    }}>
                    {buscaAberta ? 'Fechar busca' : 'Buscar por descrição'}
                </BotaoComCarregamento>
                <BotaoComCarregamento onClick={onVoltar}>Voltar</BotaoComCarregamento>
            </CabecalhoView>

            {buscaAberta ? (
                <TextField
                    label="Filtrar por código ou descrição"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    size="small"
                    fullWidth
                    autoFocus />
            ) : undefined}

            {cabecalho ? (
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'nowrap',
                        gap: 3,
                        p: 1.5,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        alignItems: 'center',
                        overflowX: 'auto',
                    }}>
                    <ParInfo rotulo="Sprint" valor={cabecalho.nome} />
                    <ParInfo rotulo="Horas/dia" valor={String(cabecalho.horasPorDia)} />
                    <ParInfo rotulo="Dias úteis" valor={String(cabecalho.diasUteis)} />
                    <ParInfo rotulo="Margem" valor={`${cabecalho.margem} h`} />
                    <ParInfo rotulo="Início" valor={formatarData(cabecalho.dataInicio)} />
                    <ParInfo rotulo="Fim" valor={formatarData(cabecalho.dataFim)} />
                    <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 1.5, ml: 'auto', flexShrink: 0 }}>
                        <DestaqueInfo
                            rotulo="Pendentes"
                            valor={String(cabecalho.tarefasPendentes)}
                            cor={COR_PENDENTE} />
                        <DestaqueInfo
                            rotulo="Concluído"
                            valor={String(cabecalho.tarefasConcluidas)}
                            cor={COR_CONCLUIDO} />
                        <DestaqueInfo
                            rotulo="Capacidade"
                            valor={`${cabecalho.ct} h`}
                            cor="primary.main" />
                    </Box>
                </Box>
            ) : undefined}

            {veioDoCache ? <AvisoCache /> : undefined}

            {carregando && !resultado ? <EsqueletoCarregando /> : undefined}

            {colaboradores.length > 0 ? (
                <Stack spacing={1}>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                        Colaboradores
                    </Typography>
                    <TableContainer sx={{ overflowX: 'auto' }}>
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
                                                <BadgeSigla sigla={colaborador.sigla} cor={colaborador.cor} />
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
                                                    fontWeight:
                                                        disponivel.negativo || disponivel.positivo ? 700 : undefined,
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
                </Stack>
            ) : undefined}

            {resultado && tarefas.length === 0 ? (
                <Alert severity="warning">Nenhum apontamento encontrado para este sprint.</Alert>
            ) : undefined}

            {resultado && tarefas.length > 0 && tarefasFiltradas.length === 0 && termoBusca.trim() ? (
                <Alert severity="info">Nenhuma linha corresponde ao filtro.</Alert>
            ) : undefined}

            {resultado && tarefasFiltradas.length > 0 ? (
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table
                        size="small"
                        sx={{
                            '& th, & td': { borderRight: 1, borderColor: 'divider', py: 0 },
                            '& th:last-of-type, & td:last-of-type': { borderRight: 0 },
                            '& tbody td:nth-of-type(-n+5), & thead tr:first-of-type th:nth-of-type(-n+5)': { borderRight: 0 },
                        }}>
                        <TableHead>
                            <TableRow>
                                <TableCell rowSpan={2} sx={{ py: 0.25, width: '1%', px: 0.5 }} />
                                <TableCell rowSpan={2} sx={{ py: 0.25, width: '1%', px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>Prioridade</TableCell>
                                <TableCell rowSpan={2} align="center" sx={{ py: 0.25, width: '1%', px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>Situação</TableCell>
                                <TableCell rowSpan={2} align="center" sx={{ py: 0.25, width: '1%', px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>Código</TableCell>
                                <TableCell rowSpan={2} sx={{ py: 0.25, px: 0.8, verticalAlign: 'bottom' }}>Descrição</TableCell>
                                {GRUPOS.map((grupo) => (
                                    <TableCell
                                        key={grupo.rotulo}
                                        colSpan={4}
                                        align="center"
                                        sx={{ py: 0.25, borderLeft: 1, borderColor: 'divider' }}>
                                        {grupo.nomeLongo}
                                    </TableCell>
                                ))}
                            </TableRow>
                            <TableRow>
                                {GRUPOS.map((grupo) => [
                                    <TableCell
                                        key={`${grupo.rotulo}-pre`}
                                        align="center"
                                        sx={{ py: 0.25, px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap', borderLeft: 1, borderColor: 'divider' }}>
                                        <Tooltip title="Tempo previsto">
                                            <Box component="span">PRE</Box>
                                        </Tooltip>
                                    </TableCell>,
                                    <TableCell key={`${grupo.rotulo}-rea`} align="center" sx={{ py: 0.25, px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap' }}>
                                        <Tooltip title="Tempo realizado">
                                            <Box component="span">REA</Box>
                                        </Tooltip>
                                    </TableCell>,
                                    <TableCell key={`${grupo.rotulo}-badge`} align="center" sx={{ py: 0.25, px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap' }}>{grupo.rotulo}</TableCell>,
                                    <TableCell key={`${grupo.rotulo}-sit`} align="center" sx={{ py: 0.25, px: 0.5, width: '1%', whiteSpace: 'nowrap' }}>Situação</TableCell>,
                                ])}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tarefasFiltradas.map((linha, i) => {
                                const id = idLinhaTarefa(linha.codigo, linha.descricao, linha.nomeExibicao);
                                const riscada = tachados.has(id);
                                return (
                                    <TableRow key={`${id}|${i}`} hover>
                                        <TableCell sx={{ width: '1%', px: 0.5 }}>
                                            <Checkbox
                                                size="small"
                                                checked={riscada}
                                                onChange={() => alternarTachado(id)}
                                                sx={{ p: 0.25 }} />
                                        </TableCell>
                                        <TableCell align="center" sx={{ width: '1%', px: 0.5, whiteSpace: 'nowrap' }}>
                                            {linha.agrupada ? (
                                                <BadgeTexto texto="Tag" cor={COR_TAG} />
                                            ) : (
                                                <BadgeTexto texto="Baixa" cor={COR_CONCLUIDO} />
                                            )}
                                        </TableCell>
                                        <TableCell align="center" sx={{ width: '1%', px: 0.5, whiteSpace: 'nowrap' }}>
                                            {linha.agrupada ? (
                                                <EtiquetaFixa texto="Tag" cor={COR_TAG} />
                                            ) : (
                                                <EtiquetaFixa texto="Pendente" cor={COR_PENDENTE} />
                                            )}
                                        </TableCell>
                                        <TableCell align="center" sx={{ width: '1%', px: 0.5, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                            {formatarCodigo(linha.codigo, larguraCodigo)}
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 360, px: 0.8 }}>
                                            <Tooltip title={linha.descricao}>
                                                <Box
                                                    sx={{
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        ...(riscada
                                                            ? { textDecoration: 'line-through', color: 'text.disabled' }
                                                            : {}),
                                                    }}>
                                                    {linha.descricao || '(sem descrição)'}
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                        {GRUPOS.map((grupo) => {
                                            const bloco = linha[grupo.bloco];
                                            const temColaborador = bloco.reaSegundos > 0;
                                            return (
                                                <Fragment key={grupo.rotulo}>
                                                    <TableCell align="center" sx={{ px: 0.5, width: LARGURA_CELULA, borderLeft: 1, borderColor: 'divider', whiteSpace: 'nowrap' }}>
                                                        <Tooltip title={formatarDuracao(Math.round(bloco.preHoras * 3600))}>
                                                            <Box component="span">{formatarHoraResumida(bloco.preHoras * 3600)}</Box>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap' }}>
                                                        <Tooltip title={formatarDuracao(bloco.reaSegundos)}>
                                                            <Box
                                                                component="span"
                                                                sx={
                                                                    bloco.reaSegundos > 0
                                                                        ? { color: 'primary.main', fontWeight: 600 }
                                                                        : undefined
                                                                }>
                                                                {formatarHoraResumida(bloco.reaSegundos)}
                                                            </Box>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ px: 0.5, width: LARGURA_CELULA, whiteSpace: 'nowrap' }}>
                                                        {temColaborador ? (
                                                            <BadgeSigla
                                                                sigla={linha.sigla}
                                                                cor={linha.cor}
                                                                nome={linha.nomeExibicao} />
                                                        ) : (
                                                            <EtiquetaFixa texto="–" cor="text.primary" />
                                                        )}
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ px: 0.5, width: '1%', whiteSpace: 'nowrap' }}>
                                                        {temColaborador ? (
                                                            <EtiquetaFixa
                                                                texto={linha.agrupada ? 'Tag' : 'Pendente'}
                                                                cor={linha.agrupada ? COR_TAG : COR_PENDENTE} />
                                                        ) : (
                                                            <EtiquetaFixa texto="Nenhuma" cor="text.primary" />
                                                        )}
                                                    </TableCell>
                                                </Fragment>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : undefined}

            <Dialog
                open={dialogoInfoAberto}
                onClose={() => setDialogoInfoAberto(false)}
                fullWidth
                maxWidth="sm">
                <DialogTitle>Como este sprint é calculado</DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        {cabecalho ? (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Capacidade</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Tempo Total = Horas/dia × Dias úteis = {cabecalho.horasPorDia} × {cabecalho.diasUteis} ={' '}
                                    {cabecalho.horasPorDia * cabecalho.diasUteis} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Margem = floor(30% × Tempo Total) = {cabecalho.margem} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Tempo por colaborador = Tempo Total − Margem = {cabecalho.td} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Capacidade = Tempo por colaborador × nº de colaboradores = {cabecalho.ct} h
                                </Typography>
                            </Stack>
                        ) : undefined}

                        {categorias ? (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Categorias</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    DEV: {categorias.dev.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    REV: {categorias.rev.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    QA: {categorias.qa.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Agrupamento: {categorias.agrupamento}
                                </Typography>
                            </Stack>
                        ) : undefined}

                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2">Regras da listagem</Typography>
                            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Cada linha é uma tarefa (ou tag) de um colaborador — o badge mostra a sigla dele.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Agrupamento por descrição: uma linha por (descrição × colaborador). Por tag: uma linha
                                    por (tag × colaborador), com o tempo na coluna QA se o colaborador tem algum
                                    apontamento QA no sprint, senão na coluna DEV; REV não recebe agrupamento por tag.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Em qualquer linha, um grupo (DEV/REV/QA) sem tempo do colaborador aparece com "–" na
                                    coluna do colaborador e "Nenhuma" na situação; PRE e REA ficam "00h".
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    PRE = tempo previsto, REA = tempo realizado (Toggl) — passe o mouse nos títulos das
                                    colunas para ver a legenda, e nos valores para ver a hora completa. PRE = 0 por
                                    enquanto, sem integração. Um REA maior que zero fica na cor da Capacidade.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    O código (TEL - 0000) é preenchido com zeros à esquerda até o tamanho do maior código
                                    da lista deste sprint (o número de zeros varia conforme a listagem).
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Situação e Prioridade são fixas — "Baixa" / "Pendente" nas linhas normais, "Tag"
                                    (laranja) nas linhas de agrupamento por tag. Sem integração por enquanto.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    A caixa de seleção antes da Prioridade risca a descrição da linha. A marcação fica
                                    salva no navegador (localStorage), é isolada por sprint (cada sprint tem a sua) e só
                                    é apagada quando uma nova consulta real à API do Toggl é feita (não ao carregar do cache).
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Dias úteis excluem sábado e domingo.
                                </Typography>
                            </Box>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogoInfoAberto(false)}>Fechar</Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}