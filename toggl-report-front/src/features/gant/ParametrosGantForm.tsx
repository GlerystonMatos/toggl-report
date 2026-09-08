import type { ReactNode } from 'react';
import { useParametrosGant } from './useParametrosGant';
import { useNotificacao } from '../../hooks/useNotificacao';
import { ParametrosFormBase } from '../../components/ParametrosFormBase';
import type { DadosParametros } from '../../components/ParametrosFormBase';
import type { AtualizarParametrosGantRequest, ParametrosGant } from '../../api/tipos';

interface ParametrosGantFormProps {
    onSalvo: (params: ParametrosGant) => void;
    semUsuarios: boolean;
}

export function ParametrosGantForm({ onSalvo, semUsuarios }: ParametrosGantFormProps): ReactNode {
    const { carregar, salvar, salvando } = useParametrosGant();
    const { notificarErro, notificarSucesso } = useNotificacao();

    function paraRequisicao({ agrupamento, tags, dataInicio, dataFim }: DadosParametros): AtualizarParametrosGantRequest {
        return { dataInicio, dataFim, tagsSelecionadas: tags, agrupamento };
    }

    return (
        <ParametrosFormBase
            titulo="Parâmetros do Gant"
            semUsuarios={semUsuarios}
            salvando={salvando}
            mensagemErroCarregar="Não foi possível carregar os parâmetros do Gant salvos"
            carregarInicial={async () => {
                const dados = await carregar();
                return {
                    agrupamento: dados.agrupamento,
                    tags: dados.tagsSelecionadas,
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