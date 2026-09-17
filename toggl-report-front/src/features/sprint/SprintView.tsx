import { CORES } from '../../theme';
import type { ReactNode } from 'react';
import { useSprint } from './useSprint';
import { fecharSprint } from '../../api/sprintsApi';
import { useEffect, useMemo, useState } from 'react';
import { SprintDialogInfo } from './SprintDialogInfo';
import { obterCoresJira } from '../../api/coresJiraApi';
import { SprintLinhaTarefa } from './SprintLinhaTarefa';
import { AvisoCache } from '../../components/AvisoCache';
import { useNotificacao } from '../../hooks/useNotificacao';
import { SprintCardCapacidade } from './SprintCardCapacidade';
import { CabecalhoView } from '../../components/CabecalhoView';
import { SprintCardColaboradores } from './SprintCardColaboradores';
import { SprintDialogDetalheLinha } from './SprintDialogDetalheLinha';
import { lerTachados, gravarTachados, idLinhaTarefa } from './tachados';
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao';
import { EsqueletoCarregando } from '../../components/EsqueletoCarregando';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';
import { GRUPOS, contarDigitos, ordemPrioridade, calcularColisaoPosicao } from './calculos';
import type { Sprint, CategoriasSprint, ResponsabilidadeSprint, LinhaTarefaSprint } from '../../api/tipos';

import {
    Box,
    Table,
    Alert,
    Stack,
    Button,
    Tooltip,
    Checkbox,
    TableRow,
    TextField,
    TableBody,
    TableCell,
    TableHead,
    Autocomplete,
    TableSortLabel,
    TableContainer,
    FormControlLabel,
} from '@mui/material';

type CampoOrdenacao = 'prioridade' | 'situacao';
const NENHUMA = 'Nenhuma';

interface SprintViewProps {
    chaveSprint: string;
    onVoltar: () => void;
    veioDoCache?: boolean;
    categorias?: CategoriasSprint | null;
    responsabilidade?: ResponsabilidadeSprint | null;
    fechado?: boolean;
    onFechado?: (sprint: Sprint) => void;
}

const LARGURA_CELULA = '2.5rem';

export function SprintView({ chaveSprint, onVoltar, veioDoCache = false, categorias, responsabilidade, fechado = false, onFechado }: SprintViewProps): ReactNode {
    const [fechando, setFechando] = useState(false);
    const [termoBusca, setTermoBusca] = useState('');
    const { resultado, carregando, carregar } = useSprint();
    const corTag = categorias?.corTag || CORES.corIndisponivel;
    const [filtrosAbertos, setFiltrosAbertos] = useState(false);
    const { notificarErro, notificarSucesso } = useNotificacao();
    const [inverterFiltros, setInverterFiltros] = useState(false);
    const [dialogoInfoAberto, setDialogoInfoAberto] = useState(false);
    const [confirmandoFechar, setConfirmandoFechar] = useState(false);
    const [destacadas, setDestacadas] = useState<Set<string>>(new Set());
    const [filtroSituacoes, setFiltroSituacoes] = useState<string[]>([]);
    const [filtroPrioridades, setFiltroPrioridades] = useState<string[]>([]);
    const [coresStatus, setCoresStatus] = useState<Record<string, string>>({});
    const [filtroColaboradores, setFiltroColaboradores] = useState<string[]>([]);
    const [coresPrioridade, setCoresPrioridade] = useState<Record<string, string>>({});
    const [tachados, setTachados] = useState<Set<string>>(() => lerTachados(chaveSprint));
    const [ordenacao, setOrdenacao] = useState<{ campo: CampoOrdenacao; direcao: 'asc' | 'desc' } | null>(null);
    const [linhaDetalhe, setLinhaDetalhe] = useState<{ linha: LinhaTarefaSprint; codigoDuplicado: boolean } | null>(null);

    useEffect(() => {
        obterCoresJira()
            .then((dados) => {
                setCoresStatus(dados.coresStatus);
                setCoresPrioridade(dados.coresPrioridade);
            })
            .catch(() => { });
    }, []);

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

    function alternarDestaque(id: string): void {
        setDestacadas((atual) => {
            const novo = new Set(atual);
            if (novo.has(id)) {
                novo.delete(id);
            } else {
                novo.add(id);
            }
            return novo;
        });
    }

    async function confirmarFechar(): Promise<void> {
        setFechando(true);
        try {
            const sprintAtualizado = await fecharSprint(chaveSprint);
            notificarSucesso('Sprint fechado. Os dados ficam travados e a consulta sempre usará o cache.');
            onFechado?.(sprintAtualizado);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível fechar o sprint');
        } finally {
            setFechando(false);
            setConfirmandoFechar(false);
        }
    }

    const cabecalho = resultado?.cabecalho;
    const tarefas = resultado?.tarefas ?? [];
    const larguraCodigo = tarefas.reduce((maximo, tarefa) => Math.max(maximo, contarDigitos(tarefa.codigo)), 0);

    const colisaoPorLinha = useMemo(() => calcularColisaoPosicao(tarefas), [tarefas]);

    const tarefasComId = useMemo(() => {
        const ocorrenciasPorChave = new Map<string, number>();
        return tarefas.map((linha, indice) => {
            const chaveGrupo = `${linha.codigo}∙${linha.descricao}`;
            const indiceNoGrupo = ocorrenciasPorChave.get(chaveGrupo) ?? 0;
            ocorrenciasPorChave.set(chaveGrupo, indiceNoGrupo + 1);
            return {
                linha,
                id: idLinhaTarefa(linha.codigo, linha.descricao, indiceNoGrupo),
                codigoDuplicado: colisaoPorLinha[indice],
            };
        });
    }, [tarefas, colisaoPorLinha]);

    const opcoesPrioridade = useMemo(() => {
        const vistos = new Set<string>();
        tarefas.forEach((linha) => { if (!linha.agrupada) vistos.add(linha.prioridade ?? NENHUMA); });
        return Array.from(vistos).sort(
            (a, b) => ordemPrioridade(a === NENHUMA ? null : a) - ordemPrioridade(b === NENHUMA ? null : b),
        );
    }, [tarefas]);

    const opcoesSituacao = useMemo(() => {
        const vistos = new Set<string>();
        tarefas.forEach((linha) => { if (!linha.agrupada) vistos.add(linha.situacao ?? NENHUMA); });
        return Array.from(vistos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [tarefas]);

    const opcoesColaborador = useMemo(() => {
        const vistos = new Set<string>();
        tarefas.forEach((linha) => {
            [linha.dev, linha.rev, linha.qa].forEach((bloco) => {
                if (bloco.nomeExibicao) vistos.add(bloco.nomeExibicao);
            });
        });
        return Array.from(vistos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [tarefas]);

    const filtrosVazios = termoBusca.trim() === ''
        && filtroPrioridades.length === 0
        && filtroSituacoes.length === 0
        && filtroColaboradores.length === 0
        && !inverterFiltros;

    function limparFiltros(): void {
        setTermoBusca('');
        setFiltroPrioridades([]);
        setFiltroSituacoes([]);
        setFiltroColaboradores([]);
        setInverterFiltros(false);
    }

    function limparOrdenacao(): void {
        setOrdenacao(null);
    }

    function alternarOrdenacao(campo: CampoOrdenacao): void {
        setOrdenacao((atual) => {
            if (!atual || atual.campo !== campo) return { campo, direcao: 'asc' };
            if (atual.direcao === 'asc') return { campo, direcao: 'desc' };
            return null;
        });
    }

    const tarefasFiltradas = useMemo(() => {
        let lista = termoBusca.trim()
            ? tarefasComId.filter(({ linha }) =>
                `${linha.codigo} ${linha.descricao}`.toLowerCase().includes(termoBusca.trim().toLowerCase()),
            )
            : tarefasComId;

        if (filtroPrioridades.length > 0) {
            lista = inverterFiltros
                ? lista.filter(({ linha }) => !linha.agrupada && !filtroPrioridades.includes(linha.prioridade ?? NENHUMA))
                : lista.filter(({ linha }) => !linha.agrupada && filtroPrioridades.includes(linha.prioridade ?? NENHUMA));
        }
        if (filtroSituacoes.length > 0) {
            lista = inverterFiltros
                ? lista.filter(({ linha }) => !linha.agrupada && !filtroSituacoes.includes(linha.situacao ?? NENHUMA))
                : lista.filter(({ linha }) => !linha.agrupada && filtroSituacoes.includes(linha.situacao ?? NENHUMA));
        }
        if (filtroColaboradores.length > 0) {
            lista = inverterFiltros
                ? lista.filter(({ linha }) =>
                    [linha.dev, linha.rev, linha.qa].every((bloco) => !bloco.nomeExibicao || !filtroColaboradores.includes(bloco.nomeExibicao)),
                )
                : lista.filter(({ linha }) =>
                    [linha.dev, linha.rev, linha.qa].some((bloco) => bloco.nomeExibicao && filtroColaboradores.includes(bloco.nomeExibicao)),
                );
        }

        if (ordenacao) {
            const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
            lista = [...lista].sort((a, b) => ordenacao.campo === 'prioridade'
                ? sinal * (ordemPrioridade(a.linha.prioridade) - ordemPrioridade(b.linha.prioridade))
                : sinal * (a.linha.situacao ?? '').localeCompare(b.linha.situacao ?? '', 'pt-BR'));
        }

        return lista;
    }, [tarefasComId, termoBusca, filtroPrioridades, filtroSituacoes, filtroColaboradores, inverterFiltros, ordenacao]);

    const colaboradores = resultado?.colaboradores ?? [];

    return (
        <Stack spacing={2}>
            <CabecalhoView titulo="Acompanhamento do Sprint">
                {!fechado ? (
                    <BotaoComCarregamento
                        variant="outlined"
                        carregando={fechando}
                        onClick={() => setConfirmandoFechar(true)}>
                        Fechar
                    </BotaoComCarregamento>
                ) : undefined}
                <Button variant="outlined" onClick={() => setDialogoInfoAberto(true)}>
                    Informações
                </Button>
                <Button variant="outlined" onClick={limparOrdenacao} disabled={ordenacao === null}>
                    Limpar ordenação
                </Button>
                <BotaoComCarregamento onClick={() => setFiltrosAbertos((a) => !a)}>
                    {filtrosAbertos ? 'Fechar filtros' : 'Filtros'}
                </BotaoComCarregamento>
                <BotaoComCarregamento onClick={onVoltar}>Voltar</BotaoComCarregamento>
            </CabecalhoView>

            {filtrosAbertos ? (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    <TextField
                        label="Filtrar por código ou descrição"
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        size="small"
                        sx={{ minWidth: 220, flex: 1 }} />
                    <Autocomplete
                        multiple
                        size="small"
                        options={opcoesPrioridade.filter((opcao) => !filtroPrioridades.includes(opcao))}
                        value={filtroPrioridades}
                        onChange={(_evento, valor) => setFiltroPrioridades(valor)}
                        sx={{ minWidth: 220, flex: 1 }}
                        renderInput={(parametros) => <TextField {...parametros} label="Prioridade" placeholder="Todas" />} />
                    <Autocomplete
                        multiple
                        size="small"
                        options={opcoesSituacao.filter((opcao) => !filtroSituacoes.includes(opcao))}
                        value={filtroSituacoes}
                        onChange={(_evento, valor) => setFiltroSituacoes(valor)}
                        sx={{ minWidth: 220, flex: 1 }}
                        renderInput={(parametros) => <TextField {...parametros} label="Status" placeholder="Todos" />} />
                    <Autocomplete
                        multiple
                        size="small"
                        options={opcoesColaborador.filter((opcao) => !filtroColaboradores.includes(opcao))}
                        value={filtroColaboradores}
                        onChange={(_evento, valor) => setFiltroColaboradores(valor)}
                        sx={{ minWidth: 220, flex: 1 }}
                        renderInput={(parametros) => <TextField {...parametros} label="Colaborador" placeholder="Todos" />} />
                    <FormControlLabel
                        control={<Checkbox checked={inverterFiltros} onChange={(e) => setInverterFiltros(e.target.checked)} />}
                        label="Inverter filtros" />
                    <Button variant="outlined" onClick={limparFiltros} disabled={filtrosVazios}>
                        Limpar
                    </Button>
                </Stack>
            ) : undefined}

            {cabecalho ? <SprintCardCapacidade cabecalho={cabecalho} /> : undefined}

            {veioDoCache ? <AvisoCache /> : undefined}

            {carregando && !resultado ? <EsqueletoCarregando /> : undefined}

            {colaboradores.length > 0 ? <SprintCardColaboradores colaboradores={colaboradores} /> : undefined}

            {resultado && tarefas.length === 0 ? (
                <Alert severity="warning">Nenhum apontamento encontrado para este sprint.</Alert>
            ) : undefined}

            {resultado && tarefas.length > 0 && tarefasFiltradas.length === 0 && !filtrosVazios ? (
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
                                <TableCell rowSpan={2} sx={{ py: 0.25, width: '1%', px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                    <TableSortLabel
                                        active={ordenacao?.campo === 'prioridade'}
                                        direction={ordenacao?.campo === 'prioridade' ? ordenacao.direcao : 'asc'}
                                        onClick={() => alternarOrdenacao('prioridade')}>
                                        Prioridade
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell rowSpan={2} align="center" sx={{ py: 0.25, width: '1%', px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                    <TableSortLabel
                                        active={ordenacao?.campo === 'situacao'}
                                        direction={ordenacao?.campo === 'situacao' ? ordenacao.direcao : 'asc'}
                                        onClick={() => alternarOrdenacao('situacao')}>
                                        Status
                                    </TableSortLabel>
                                </TableCell>
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
                            {tarefasFiltradas.map(({ linha, id, codigoDuplicado }) => (
                                <SprintLinhaTarefa
                                    key={id}
                                    linha={linha}
                                    id={id}
                                    codigoDuplicado={codigoDuplicado}
                                    riscada={tachados.has(id)}
                                    onAlternarTachado={alternarTachado}
                                    destacada={destacadas.has(id)}
                                    onAlternarDestaque={alternarDestaque}
                                    onDuploClique={() => setLinhaDetalhe({ linha, codigoDuplicado })}
                                    larguraCodigo={larguraCodigo}
                                    coresStatus={coresStatus}
                                    coresPrioridade={coresPrioridade}
                                    corTag={corTag} />
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : undefined}

            <SprintDialogInfo
                aberto={dialogoInfoAberto}
                onFechar={() => setDialogoInfoAberto(false)}
                cabecalho={cabecalho}
                categorias={categorias}
                responsabilidade={responsabilidade} />

            <SprintDialogDetalheLinha
                aberto={linhaDetalhe !== null}
                onFechar={() => setLinhaDetalhe(null)}
                linha={linhaDetalhe?.linha ?? null}
                codigoDuplicado={linhaDetalhe?.codigoDuplicado ?? false}
                larguraCodigo={larguraCodigo}
                coresStatus={coresStatus}
                coresPrioridade={coresPrioridade}
                corTag={corTag} />

            <DialogoConfirmacao
                aberto={confirmandoFechar}
                titulo="Fechar sprint"
                mensagem="Isso trava os dados atuais (Toggl e Jira) como definitivos para este sprint: novas consultas sempre usarão o cache já salvo, sem chamar a API de novo. Você pode reabrir depois na listagem de sprints. Deseja continuar?"
                textoConfirmar="Fechar"
                textoCancelar="Cancelar"
                focoNoCancelar
                carregando={fechando}
                onConfirmar={() => void confirmarFechar()}
                onCancelar={() => setConfirmandoFechar(false)} />
        </Stack>
    );
}