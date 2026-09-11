import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRelatorio } from './useRelatorio';
import { BuscaPanel } from '../busca/BuscaPanel';
import { Alert, Box, Stack } from '@mui/material';
import { formatarPeriodo } from '../../utils/datas';
import SearchIcon from '@mui/icons-material/Search';
import { useExpansao } from '../../hooks/useExpansao';
import { AvisoCache } from '../../components/AvisoCache';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useNotificacao } from '../../hooks/useNotificacao';
import { RelatorioUsuarioCard } from './RelatorioUsuarioCard';
import { CabecalhoView } from '../../components/CabecalhoView';
import { EsqueletoCarregando } from '../../components/EsqueletoCarregando';
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
    const { expandido, alternarUm, alternarTodos, todosExpandidos } = useExpansao(
        relatorio ? relatorio.usuarios.map((usuario) => usuario.nomeExibicao) : [],
        relatorio,
    );

    useEffect(() => {
        carregar(dataInicio, dataFim).catch((erro: unknown) =>
            notificarErro(erro, 'Não foi possível carregar o relatório'),
        );
    }, [dataInicio, dataFim]);

    if (buscaAberta) {
        return <BuscaPanel onFechar={() => setBuscaAberta(false)} />;
    }

    return (
        <Stack spacing={2}>
            <CabecalhoView titulo={`Relatório — ${formatarPeriodo(dataInicio, dataFim)}`}>
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
            </CabecalhoView>

            {veioDoCache ? <AvisoCache /> : undefined}

            {carregando && !relatorio ? <EsqueletoCarregando /> : undefined}

            {relatorio && relatorio.usuarios.length === 0 ? (
                <Alert severity="warning">Nenhum usuário do Toggl com dados para este período.</Alert>
            ) : undefined}

            {relatorio ? (
                <Box>
                    {relatorio.usuarios.map((usuario) => (
                        <RelatorioUsuarioCard
                            key={usuario.nomeExibicao}
                            usuario={usuario}
                            agrupamento={relatorio.agrupamento}
                            expandido={expandido[usuario.nomeExibicao] ?? false}
                            onAlternar={() => alternarUm(usuario.nomeExibicao)}
                            selecionados={selecionados}
                            onAlternarSelecao={onAlternarSelecao} />
                    ))}
                </Box>
            ) : undefined}
        </Stack>
    );
}