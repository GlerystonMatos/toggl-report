import type { ReactNode } from 'react';
import { useConfiguracao } from './useConfiguracao';
import { useNotificacao } from '../../hooks/useNotificacao';
import { ParametrosFormBase } from '../../components/ParametrosFormBase';
import type { DadosParametros } from '../../components/ParametrosFormBase';
import type { AtualizarParametrosRequest, ParametrosConfiguracao } from '../../api/tipos';

interface ParametrosFormProps {
    onSalvo: (config: ParametrosConfiguracao) => void;
    semUsuarios: boolean;
}

export function ParametrosForm({ onSalvo, semUsuarios }: ParametrosFormProps): ReactNode {
    const { carregar, salvar, salvando } = useConfiguracao();
    const { notificarErro, notificarSucesso } = useNotificacao();

    function paraRequisicao({ agrupamento, tags, dataInicio, dataFim }: DadosParametros): AtualizarParametrosRequest {
        return { agrupamento, tagsDetalhadas: tags, dataInicio, dataFim };
    }

    return (
        <ParametrosFormBase
            titulo="Parâmetros do Relatório"
            semUsuarios={semUsuarios}
            salvando={salvando}
            mensagemErroCarregar="Não foi possível carregar a configuração salva"
            carregarInicial={async () => {
                const dados = await carregar();
                return {
                    agrupamento: dados.agrupamento,
                    tags: dados.tagsDetalhadas,
                    dataInicio: dados.dataInicio,
                    dataFim: dados.dataFim,
                };
            }}
            aoConfirmar={async (dados) => {
                try {
                    const atualizado = await salvar(paraRequisicao(dados));
                    notificarSucesso('Parâmetros salvos.');
                    onSalvo(atualizado);
                } catch (erro) {
                    notificarErro(erro, 'Não foi possível salvar os parâmetros');
                }
            }}
            aoContinuar={(dados) => onSalvo(paraRequisicao(dados))} />
    );
}