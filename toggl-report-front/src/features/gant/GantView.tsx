import { useGant } from './useGant';
import type { ReactNode } from 'react';
import { formatarPeriodo } from '../../utils/datas';
import SearchIcon from '@mui/icons-material/Search';
import { Fragment, useEffect, useState } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useNotificacao } from '../../hooks/useNotificacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Chip,
    Table,
    Alert,
    Stack,
    Tooltip,
    TableRow,
    Skeleton,
    TextField,
    TableBody,
    TableCell,
    TableHead,
    Typography,
    TableContainer,
} from '@mui/material';

interface GantViewProps {
    dataInicio: string;
    dataFim: string;
    onVoltar: () => void;
    veioDoCache: boolean;
}

function formatarDiaCurto(dia: string): string {
    const [, mes, diaDoMes] = dia.split('-');
    return `${diaDoMes}/${mes}`;
}

export function GantView({ dataInicio, dataFim, onVoltar, veioDoCache }: GantViewProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const { gant, carregando, carregar } = useGant();
    const [termoBusca, setTermoBusca] = useState('');
    const [buscaAberta, setBuscaAberta] = useState(false);
    const [expandido, setExpandido] = useState<Record<string, boolean>>({});
    const [termoAtivo, setTermoAtivo] = useState<string | undefined>(undefined);

    useEffect(() => {
        carregar(dataInicio, dataFim, termoAtivo).catch((erro: unknown) => notificarErro(erro, 'Não foi possível carregar o Gant'));
    }, [dataInicio, dataFim, termoAtivo]);

    const usuariosDistintos = gant
        ? Array.from(new Map(gant.linhas.map((linha) => [linha.usuarioChave, linha.nomeExibicao])).entries())
        : [];

    useEffect(() => {
        if (!gant) return;
        setExpandido(Object.fromEntries(usuariosDistintos.map(([usuarioChave]) => [usuarioChave, false])));
    }, [gant]);

    const todosExpandidos = usuariosDistintos.length > 0
        && usuariosDistintos.every(([usuarioChave]) => expandido[usuarioChave]);

    function alternarTodos(): void {
        if (usuariosDistintos.length === 0) return;
        const novoValor = !todosExpandidos;
        setExpandido(Object.fromEntries(usuariosDistintos.map(([usuarioChave]) => [usuarioChave, novoValor])));
    }

    const totalColunas = 3 + (gant?.dias.length ?? 0);

    return (
        <Stack spacing={2}>
            <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6">
                    Gant — {formatarPeriodo(dataInicio, dataFim)}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <BotaoComCarregamento
                        startIcon={<SearchIcon />}
                        onClick={() => {
                            if (buscaAberta) {
                                setTermoBusca('');
                                setTermoAtivo(undefined);
                            }
                            setBuscaAberta((atual) => !atual);
                        }}>
                        {buscaAberta ? 'Fechar busca' : 'Buscar por descrição'}
                    </BotaoComCarregamento>
                    <BotaoComCarregamento
                        startIcon={todosExpandidos ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                        onClick={alternarTodos}
                        disabled={usuariosDistintos.length === 0}>
                        {todosExpandidos ? 'Colapsar tudo' : 'Expandir tudo'}
                    </BotaoComCarregamento>
                    <BotaoComCarregamento onClick={onVoltar}>Voltar</BotaoComCarregamento>
                </Stack>
            </Stack>

            {buscaAberta ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                        label="Buscar por parte da descrição"
                        value={termoBusca}
                        onChange={(evento) => setTermoBusca(evento.target.value)}
                        onKeyDown={(evento) => {
                            if (evento.key === 'Enter') setTermoAtivo(termoBusca.trim() || undefined);
                        }}
                        size="small"
                        fullWidth
                        autoFocus />
                    <BotaoComCarregamento
                        variant="contained"
                        disabled={!termoBusca.trim()}
                        onClick={() => setTermoAtivo(termoBusca.trim() || undefined)}>
                        Buscar
                    </BotaoComCarregamento>
                    <BotaoComCarregamento
                        variant="outlined"
                        disabled={!termoBusca && termoAtivo === undefined}
                        onClick={() => {
                            setTermoBusca('');
                            setTermoAtivo(undefined);
                        }}>
                        Limpar
                    </BotaoComCarregamento>
                </Stack>
            ) : undefined}

            {veioDoCache ? (
                <Alert icon={<CloudDoneIcon fontSize="inherit" />} severity="info">
                    Resultado servido do cache local (mesmo período e usuários de uma consulta anterior).
                </Alert>
            ) : undefined}

            {carregando && !gant ? (
                <Stack spacing={1}>
                    <Skeleton variant="rounded" height={56} />
                    <Skeleton variant="rounded" height={56} />
                </Stack>
            ) : undefined}

            {gant && gant.linhas.length === 0 ? (
                <Alert severity="warning">
                    {termoAtivo !== undefined
                        ? 'Nenhuma descrição encontrada para esse termo.'
                        : 'Nenhum apontamento encontrado para este período.'}
                </Alert>
            ) : undefined}

            {gant && gant.linhas.length > 0 ? (
                <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ py: 0.5 }}>Categoria</TableCell>
                                <TableCell sx={{ py: 0.5 }}>Descrição</TableCell>
                                <TableCell sx={{ py: 0.5 }}>Total</TableCell>
                                {gant.dias.map((dia) => (
                                    <TableCell
                                        key={dia}
                                        sx={{ p: 0.25, textAlign: 'center', borderLeft: 1, borderColor: 'divider' }}>
                                        {formatarDiaCurto(dia)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {gant.linhas.map((linha, indice) => {
                                const linhaAnterior = indice > 0 ? gant.linhas[indice - 1] : null;
                                const primeiraDoUsuario = linhaAnterior === null || linha.usuarioChave !== linhaAnterior.usuarioChave;
                                const usuarioExpandido = expandido[linha.usuarioChave] ?? false;

                                return (
                                    <Fragment key={`${linha.usuarioChave}-${linha.categoria}-${linha.descricao}-${indice}`}>
                                        {primeiraDoUsuario ? (
                                            <TableRow
                                                key={`cabecalho-${linha.usuarioChave}`}
                                                onClick={() =>
                                                    setExpandido((atual) => ({
                                                        ...atual,
                                                        [linha.usuarioChave]: !atual[linha.usuarioChave],
                                                    }))
                                                }
                                                sx={{ cursor: 'pointer', bgcolor: 'action.hover' }}>
                                                <TableCell colSpan={totalColunas} sx={{ py: 0.25 }}>
                                                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                                        {usuarioExpandido ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {linha.nomeExibicao}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ) : undefined}
                                        {usuarioExpandido ? (
                                            <TableRow>
                                                <TableCell sx={{ py: 0.25 }}>{linha.categoria}</TableCell>
                                                <TableCell sx={{ py: 0.25, whiteSpace: 'nowrap' }}>{linha.descricao}</TableCell>
                                                <TableCell sx={{ py: 0.25 }}>{formatarDuracao(Math.round(linha.totalHoras * 3600))}</TableCell>
                                                {gant.dias.map((dia) => {
                                                    const celulas = linha.celulasPorDia[dia];
                                                    const pintarCelula = celulas && celulas.length > 0;
                                                    return (
                                                        <TableCell
                                                            key={dia}
                                                            sx={{
                                                                p: 0.25,
                                                                textAlign: 'center',
                                                                borderLeft: 1,
                                                                borderColor: 'divider',
                                                                bgcolor: pintarCelula ? celulas[0].cor || 'action.disabledBackground' : undefined,
                                                            }}>
                                                            {celulas && celulas.length > 0 ? (
                                                                <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                                                                    {celulas.map((celula) => (
                                                                        <Tooltip
                                                                            key={celula.usuarioChave}
                                                                            title={`${celula.nomeExibicao} — ${formatarDuracao(Math.round(celula.horas * 3600))}`}>
                                                                            <Chip
                                                                                size="small"
                                                                                label={celula.sigla || '?'}
                                                                                sx={{
                                                                                    bgcolor: celula.cor || 'action.disabledBackground',
                                                                                    fontWeight: 600,
                                                                                    fontSize: '0.65rem',
                                                                                    height: 20,
                                                                                }}
                                                                            />
                                                                        </Tooltip>
                                                                    ))}
                                                                </Stack>
                                                            ) : undefined}
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ) : undefined}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : undefined}
        </Stack>
    );
}