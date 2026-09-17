import { Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useCoresJira } from './useCoresJira';
import { useNotificacao } from '../../hooks/useNotificacao';
import { ConfiguracoesResumo } from './ConfiguracoesResumo';
import { ConfiguracoesWizard } from './ConfiguracoesWizard';
import { useParametrosGant } from '../gant/useParametrosGant';
import { useConfiguracao } from '../configuracao/useConfiguracao';
import { useConfiguracaoJira } from '../jira/useConfiguracaoJira';
import { useMapeamentoJiraToggl } from './useMapeamentoJiraToggl';
import { useCategoriasSprint } from '../sprint/useCategoriasSprint';
import { useUsuariosToggl } from '../usuarios-toggl/useUsuariosToggl';
import { useResponsabilidadeSprint } from '../sprint/useResponsabilidadeSprint';
import { useStatusFinalSprint } from '../sprint/useStatusFinalSprint';
import { togglObrigatorioCompleto, configuracaoObrigatoriaCompleta } from './completude';
import type { Agrupamento, CategoriasSprint, UsuarioTogglResumo, EntradaMapeamentoJiraToggl } from '../../api/tipos';

interface ConfiguracoesViewProps {
    onAlterado?: (completa: boolean) => void;
}

export function ConfiguracoesView({ onAlterado }: ConfiguracoesViewProps): ReactNode {
    const { carregar, salvar, carregando, salvando } = useCategoriasSprint();

    const {
        carregar: carregarResponsabilidade,
        salvar: salvarResponsabilidade,
        carregando: carregandoResponsabilidade,
        salvando: salvandoResponsabilidade,
    } = useResponsabilidadeSprint();

    const {
        carregar: carregarStatusFinal,
        salvar: salvarStatusFinal,
        carregando: carregandoStatusFinal,
        salvando: salvandoStatusFinal,
    } = useStatusFinalSprint();

    const { salvar: salvarConfiguracao, salvando: salvandoConfiguracao } = useConfiguracao();
    const { salvar: salvarParametrosGant, salvando: salvandoParametrosGant } = useParametrosGant();
    const { carregar: carregarUsuarios } = useUsuariosToggl();
    const { configuracao: configuracaoJira, carregar: carregarConfiguracaoJira } = useConfiguracaoJira();
    const { dados: coresJira, carregar: carregarCoresJira } = useCoresJira();
    const { carregar: carregarMapeamentoJiraToggl } = useMapeamentoJiraToggl();
    const { notificarErro } = useNotificacao();

    const [modo, setModo] = useState<'resumo' | 'wizard'>('resumo');

    const [agrupamento, setAgrupamento] = useState<Agrupamento>('ambos');
    const [tagsDetalhadas, setTagsDetalhadas] = useState<string[]>([]);
    const [dev, setDev] = useState<string[]>([]);
    const [rev, setRev] = useState<string[]>([]);
    const [qa, setQa] = useState<string[]>([]);
    const [corTag, setCorTag] = useState<string>('');
    const [statusDev, setStatusDev] = useState<string[]>([]);
    const [statusRev, setStatusRev] = useState<string[]>([]);
    const [statusQa, setStatusQa] = useState<string[]>([]);
    const [statusConcluido, setStatusConcluido] = useState<string[]>([]);
    const [statusIgnorado, setStatusIgnorado] = useState<string[]>([]);

    const [usuarios, setUsuarios] = useState<UsuarioTogglResumo[]>([]);
    const [mapeamentoJira, setMapeamentoJira] = useState<Record<string, EntradaMapeamentoJiraToggl>>({});
    const [jiraConexaoValida, setJiraConexaoValida] = useState(false);

    useEffect(() => {
        let cancelado = false;

        carregar()
            .then((dados: CategoriasSprint) => {
                if (cancelado) return;
                setAgrupamento(dados.agrupamento);
                setTagsDetalhadas(dados.tagsDetalhadas);
                setDev(dados.dev);
                setRev(dados.rev);
                setQa(dados.qa);
                setCorTag(dados.corTag);
            })
            .catch((erro: unknown) => {
                if (!cancelado) notificarErro(erro, 'Não foi possível carregar as configurações');
            });

        carregarResponsabilidade()
            .then((dados) => {
                if (cancelado) return;
                setStatusDev(dados.statusDev);
                setStatusRev(dados.statusRev);
                setStatusQa(dados.statusQa);
            })
            .catch((erro: unknown) => {
                if (!cancelado) notificarErro(erro, 'Não foi possível carregar o status por responsável');
            });

        carregarStatusFinal()
            .then((dados) => {
                if (cancelado) return;
                setStatusConcluido(dados.statusConcluido);
                setStatusIgnorado(dados.statusIgnorado);
            })
            .catch((erro: unknown) => {
                if (!cancelado) notificarErro(erro, 'Não foi possível carregar os status finais');
            });

        return () => {
            cancelado = true;
        };
    }, []);

    useEffect(() => {
        if (modo !== 'resumo') return;
        let cancelado = false;

        carregarUsuarios()
            .then((lista) => {
                if (!cancelado) setUsuarios(lista);
            })
            .catch((erro: unknown) => {
                if (!cancelado) notificarErro(erro, 'Não foi possível listar os usuários do Toggl');
            });

        carregarConfiguracaoJira().catch((erro: unknown) => {
            if (!cancelado) notificarErro(erro, 'Não foi possível carregar a configuração do Jira');
        });

        carregarCoresJira().catch((erro: unknown) => {
            if (!cancelado) notificarErro(erro, 'Não foi possível carregar o mapeamento de cores do Jira');
        });

        carregarMapeamentoJiraToggl()
            .then((dados) => {
                if (!cancelado) setMapeamentoJira(dados.mapeamento);
            })
            .catch((erro: unknown) => {
                if (!cancelado) notificarErro(erro, 'Não foi possível carregar o mapeamento Jira ↔ Toggl');
            });

        return () => {
            cancelado = true;
        };
    }, [modo]);

    const carregandoTudo = carregando || carregandoResponsabilidade || carregandoStatusFinal;
    const existeUsuarioAdministrador = usuarios.some((usuario) => usuario.administrador);
    const togglCompleto = togglObrigatorioCompleto({ agrupamento, tagsDetalhadas, dev, rev, qa });
    const completa = configuracaoObrigatoriaCompleta({ agrupamento, tagsDetalhadas, dev, rev, qa, statusDev, statusRev, statusQa });
    const jiraConfigurado = Boolean(configuracaoJira && configuracaoJira.urlDominio.trim() !== '' && configuracaoJira.email.trim() !== '');
    const quantidadeCoresStatus = coresJira ? Object.keys(coresJira.coresStatus).length : 0;
    const quantidadeCoresPrioridade = coresJira ? Object.keys(coresJira.coresPrioridade).length : 0;

    useEffect(() => {
        if (!carregandoTudo) onAlterado?.(completa);
    }, [carregandoTudo, completa]);

    return (
        <Stack spacing={2}>
            {modo === 'resumo' ? (
                <ConfiguracoesResumo
                    usuarios={usuarios}
                    togglCompleto={togglCompleto}
                    agrupamento={agrupamento}
                    tagsDetalhadas={tagsDetalhadas}
                    dev={dev}
                    rev={rev}
                    qa={qa}
                    statusDev={statusDev}
                    statusRev={statusRev}
                    statusQa={statusQa}
                    jiraConfigurado={jiraConfigurado}
                    jiraUrlDominio={configuracaoJira?.urlDominio ?? ''}
                    quantidadeCoresStatus={quantidadeCoresStatus}
                    quantidadeCoresPrioridade={quantidadeCoresPrioridade}
                    mapeamentoJira={mapeamentoJira}
                    aoConfigurar={() => setModo('wizard')} />
            ) : (
                <ConfiguracoesWizard
                    agrupamento={agrupamento}
                    setAgrupamento={setAgrupamento}
                    tagsDetalhadas={tagsDetalhadas}
                    setTagsDetalhadas={setTagsDetalhadas}
                    dev={dev}
                    setDev={setDev}
                    rev={rev}
                    setRev={setRev}
                    qa={qa}
                    setQa={setQa}
                    corTag={corTag}
                    setCorTag={setCorTag}
                    statusDev={statusDev}
                    setStatusDev={setStatusDev}
                    statusRev={statusRev}
                    setStatusRev={setStatusRev}
                    statusQa={statusQa}
                    setStatusQa={setStatusQa}
                    statusConcluido={statusConcluido}
                    setStatusConcluido={setStatusConcluido}
                    statusIgnorado={statusIgnorado}
                    setStatusIgnorado={setStatusIgnorado}
                    existeUsuarioAdministrador={existeUsuarioAdministrador}
                    onUsuariosAlterados={setUsuarios}
                    jiraConexaoValida={jiraConexaoValida}
                    setJiraConexaoValida={setJiraConexaoValida}
                    carregandoTudo={carregandoTudo}
                    togglCompleto={togglCompleto}
                    completa={completa}
                    salvando={salvando}
                    salvandoConfiguracao={salvandoConfiguracao}
                    salvandoParametrosGant={salvandoParametrosGant}
                    salvandoResponsabilidade={salvandoResponsabilidade}
                    salvandoStatusFinal={salvandoStatusFinal}
                    salvarCategorias={salvar}
                    salvarConfiguracao={salvarConfiguracao}
                    salvarParametrosGant={salvarParametrosGant}
                    salvarResponsabilidade={salvarResponsabilidade}
                    salvarStatusFinal={salvarStatusFinal}
                    aoConcluir={() => setModo('resumo')}
                    aoVoltarResumo={() => setModo('resumo')} />
            )}
        </Stack>
    );
}