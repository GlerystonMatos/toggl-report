import { useGant } from './useGant';
import type { ReactNode } from 'react';
import { truncar } from '../../utils/texto';
import SearchIcon from '@mui/icons-material/Search';
import { FONTE_MARCA } from '../../utils/tipografia';
import { Fragment, useEffect, useState } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import { useExpansao } from '../../hooks/useExpansao';
import { AvisoCache } from '../../components/AvisoCache';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useNotificacao } from '../../hooks/useNotificacao';
import { CabecalhoView } from '../../components/CabecalhoView';
import { formatarDiaCurto, formatarPeriodo } from '../../utils/datas';
import { EsqueletoCarregando } from '../../components/EsqueletoCarregando';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Box,
    Chip,
    Table,
    Alert,
    Stack,
    Tooltip,
    TableRow,
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

export function GantView({ dataInicio, dataFim, onVoltar, veioDoCache }: GantViewProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const { gant, carregando, carregar } = useGant();
    const [termoBusca, setTermoBusca] = useState('');
    const [buscaAberta, setBuscaAberta] = useState(false);
    const [termoAtivo, setTermoAtivo] = useState<string | undefined>(undefined);

    useEffect(() => {
        carregar(dataInicio, dataFim, termoAtivo).catch((erro: unknown) => notificarErro(erro, 'Não foi possível carregar o Gant'));
    }, [dataInicio, dataFim, termoAtivo]);

    const usuariosDistintos = gant
        ? Array.from(new Map(gant.linhas.map((linha) => [linha.usuarioChave, linha.nomeExibicao])).entries())
        : [];

    const { expandido, alternarUm, alternarTodos, todosExpandidos } = useExpansao(
        usuariosDistintos.map(([usuarioChave]) => usuarioChave),
        gant,
    );

    const totalColunas = 3 + (gant?.dias.length ?? 0);

    return (
        <Stack spacing={2}>
            <CabecalhoView titulo={`Gant — ${formatarPeriodo(dataInicio, dataFim)}`}>
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
            </CabecalhoView>

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

            {veioDoCache ? <AvisoCache /> : undefined}

            {carregando && !gant ? <EsqueletoCarregando /> : undefined}

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
                                <TableCell sx={{ py: 0.25 }}>Categoria</TableCell>
                                <TableCell sx={{ py: 0.25 }}>Descrição</TableCell>
                                <TableCell sx={{ py: 0.25 }}>Total</TableCell>
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
                                                onClick={() => alternarUm(linha.usuarioChave)}
                                                sx={{ cursor: 'pointer', bgcolor: 'action.hover' }}>
                                                <TableCell colSpan={totalColunas} sx={{ py: 0 }}>
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
                                                <TableCell sx={{ py: 0 }}>{linha.categoria}</TableCell>
                                                <TableCell sx={{ py: 0, whiteSpace: 'nowrap' }}>
                                                    <Tooltip title={linha.descricao}>
                                                        <Box component="span">{truncar(linha.descricao, 50)}</Box>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell sx={{ py: 0 }}>{formatarDuracao(Math.round(linha.totalHoras * 3600))}</TableCell>
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
                                                                                    py: 0.20,
                                                                                    borderRadius: 0,
                                                                                    fontWeight: 700,
                                                                                    fontSize: '0.85rem',
                                                                                    textAlign: 'center',
                                                                                    display: 'inline-block',
                                                                                    textTransform: 'uppercase',
                                                                                    fontFamily: FONTE_MARCA,
                                                                                    bgcolor: celula.cor || 'action.selected',
                                                                                }} />
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