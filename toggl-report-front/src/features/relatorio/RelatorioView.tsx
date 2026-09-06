import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRelatorio } from './useRelatorio';
import { BuscaPanel } from '../busca/BuscaPanel';
import { formatarPeriodo } from '../../utils/datas';
import SearchIcon from '@mui/icons-material/Search';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useNotificacao } from '../../hooks/useNotificacao';
import { RelatorioUsuarioCard } from './RelatorioUsuarioCard';
import { Alert, Box, Skeleton, Stack, Typography } from '@mui/material';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

interface RelatorioViewProps {
    dataInicio: string;
    dataFim: string;
    selecionados: Set<string>;
    onAlternarSelecao: (chave: string) => void;
    onVoltar: () => void;
    veioDoCache: boolean;
}

export function RelatorioView({
    dataInicio,
    dataFim,
    selecionados,
    onAlternarSelecao,
    onVoltar,
    veioDoCache,
}: RelatorioViewProps): ReactNode {
    const { notificarErro } = useNotificacao();
    const [buscaAberta, setBuscaAberta] = useState(false);
    const { relatorio, carregando, carregar } = useRelatorio();
    const [expandido, setExpandido] = useState<Record<string, boolean>>({});

    useEffect(() => {
        carregar(dataInicio, dataFim).catch((erro: unknown) =>
            notificarErro(erro, 'Não foi possível carregar o relatório'),
        );
    }, [dataInicio, dataFim]);

    useEffect(() => {
        if (!relatorio) return;
        setExpandido(Object.fromEntries(relatorio.usuarios.map((usuario) => [usuario.nomeExibicao, false])));
    }, [relatorio]);

    const todosExpandidos = relatorio !== null && relatorio.usuarios.length > 0
        && relatorio.usuarios.every((usuario) => expandido[usuario.nomeExibicao]);

    function alternarTodos(): void {
        if (!relatorio) return;
        const novoValor = !todosExpandidos;
        setExpandido(Object.fromEntries(relatorio.usuarios.map((usuario) => [usuario.nomeExibicao, novoValor])));
    }

    if (buscaAberta) {
        return <BuscaPanel onFechar={() => setBuscaAberta(false)} />;
    }

    return (
        <Stack spacing={2}>
            <Stack
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="h6">
                    Relatório — {formatarPeriodo(dataInicio, dataFim)}
                </Typography>
                <Stack direction="row" spacing={1}>
                    <BotaoComCarregamento
                        startIcon={<SearchIcon />}
                        onClick={() => setBuscaAberta(true)}
                        disabled={!relatorio}>
                        Buscar por descrição
                    </BotaoComCarregamento>
                    <BotaoComCarregamento
                        startIcon={todosExpandidos ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
                        onClick={alternarTodos}
                        disabled={!relatorio || relatorio.usuarios.length === 0}>
                        {todosExpandidos ? 'Colapsar tudo' : 'Expandir tudo'}
                    </BotaoComCarregamento>
                    <BotaoComCarregamento onClick={onVoltar}>Voltar</BotaoComCarregamento>
                </Stack>
            </Stack>

            {veioDoCache ? (
                <Alert icon={<CloudDoneIcon fontSize="inherit" />} severity="info">
                    Resultado servido do cache local (mesmo período e usuários de uma consulta anterior).
                </Alert>
            ) : undefined}

            {carregando && !relatorio ? (
                <Stack spacing={1}>
                    <Skeleton variant="rounded" height={56} />
                    <Skeleton variant="rounded" height={56} />
                </Stack>
            ) : undefined}

            {relatorio && relatorio.usuarios.length === 0 ? (
                <Alert severity="warning">Nenhum usuário com dados para este período.</Alert>
            ) : undefined}

            {relatorio ? (
                <Box>
                    {relatorio.usuarios.map((usuario) => (
                        <RelatorioUsuarioCard
                            key={usuario.nomeExibicao}
                            usuario={usuario}
                            agrupamento={relatorio.agrupamento}
                            expandido={expandido[usuario.nomeExibicao] ?? false}
                            onAlternar={() =>
                                setExpandido((atual) => ({
                                    ...atual,
                                    [usuario.nomeExibicao]: !atual[usuario.nomeExibicao],
                                }))
                            }
                            selecionados={selecionados}
                            onAlternarSelecao={onAlternarSelecao} />
                    ))}
                </Box>
            ) : undefined}
        </Stack>
    );
}