import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { CoresJiraPanel } from './CoresJiraPanel';
import { BotaoVoltarResumo } from './BotaoVoltarResumo';
import { listarTagsToggl } from '../../api/tagsTogglApi';
import { listarStatusJira } from '../../api/jiraListasApi';
import { useNotificacao } from '../../hooks/useNotificacao';
import type { CoresJiraPanelHandle } from './CoresJiraPanel';
import { MapaCoresLista } from '../../components/MapaCoresLista';
import { ConfiguracaoJiraPanel } from '../jira/ConfiguracaoJiraPanel';
import { MapeamentoJiraTogglPanel } from './MapeamentoJiraTogglPanel';
import { SelectAgrupamento } from '../../components/SelectAgrupamento';
import { UsuariosTogglPanel } from '../usuarios-toggl/UsuariosTogglPanel';
import { SelectListaCacheada } from '../../components/SelectListaCacheada';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';
import type { ConfiguracaoJiraPanelHandle } from '../jira/ConfiguracaoJiraPanel';
import type { MapeamentoJiraTogglPanelHandle } from './MapeamentoJiraTogglPanel';

import type {
    Agrupamento,
    ParametrosGant,
    CategoriasSprint,
    StatusFinalSprint,
    UsuarioTogglResumo,
    ResponsabilidadeSprint,
    ParametrosConfiguracao,
    AtualizarParametrosRequest,
    AtualizarParametrosGantRequest,
    AtualizarCategoriasSprintRequest,
    AtualizarStatusFinalSprintRequest,
    AtualizarResponsabilidadeSprintRequest,
} from '../../api/tipos';

import {
    Box,
    Card,
    Step,
    Alert,
    Stack,
    Divider,
    Stepper,
    StepButton,
    Typography,
    CardContent,
} from '@mui/material';

const ETAPAS = ['Usuários do Toggl', 'Toggl: Agrupamento e Tags', 'Jira: Conexão', 'Jira: Status e Cores', 'Jira ↔ Toggl'] as const;

interface ConfiguracoesWizardProps {
    agrupamento: Agrupamento;
    setAgrupamento: (valor: Agrupamento) => void;
    tagsDetalhadas: string[];
    setTagsDetalhadas: (valor: string[]) => void;
    dev: string[];
    setDev: (valor: string[]) => void;
    rev: string[];
    setRev: (valor: string[]) => void;
    qa: string[];
    setQa: (valor: string[]) => void;
    corTag: string;
    setCorTag: (valor: string) => void;
    statusDev: string[];
    setStatusDev: (valor: string[]) => void;
    statusRev: string[];
    setStatusRev: (valor: string[]) => void;
    statusQa: string[];
    setStatusQa: (valor: string[]) => void;
    statusConcluido: string[];
    setStatusConcluido: (valor: string[]) => void;
    statusIgnorado: string[];
    setStatusIgnorado: (valor: string[]) => void;

    existeUsuarioAdministrador: boolean;
    onUsuariosAlterados: (usuarios: UsuarioTogglResumo[]) => void;
    jiraConexaoValida: boolean;
    setJiraConexaoValida: (valido: boolean) => void;

    carregandoTudo: boolean;
    togglCompleto: boolean;
    completa: boolean;

    salvando: boolean;
    salvandoConfiguracao: boolean;
    salvandoParametrosGant: boolean;
    salvandoResponsabilidade: boolean;
    salvandoStatusFinal: boolean;

    salvarCategorias: (dados: AtualizarCategoriasSprintRequest) => Promise<CategoriasSprint>;
    salvarConfiguracao: (dados: AtualizarParametrosRequest) => Promise<ParametrosConfiguracao>;
    salvarParametrosGant: (dados: AtualizarParametrosGantRequest) => Promise<ParametrosGant>;
    salvarResponsabilidade: (dados: AtualizarResponsabilidadeSprintRequest) => Promise<ResponsabilidadeSprint>;
    salvarStatusFinal: (dados: AtualizarStatusFinalSprintRequest) => Promise<StatusFinalSprint>;

    aoConcluir: () => void;
    aoVoltarResumo: () => void;
}

export function ConfiguracoesWizard({
    agrupamento,
    setAgrupamento,
    tagsDetalhadas,
    setTagsDetalhadas,
    dev,
    setDev,
    rev,
    setRev,
    qa,
    setQa,
    corTag,
    setCorTag,
    statusDev,
    setStatusDev,
    statusRev,
    setStatusRev,
    statusQa,
    setStatusQa,
    statusConcluido,
    setStatusConcluido,
    statusIgnorado,
    setStatusIgnorado,
    existeUsuarioAdministrador,
    onUsuariosAlterados,
    jiraConexaoValida,
    setJiraConexaoValida,
    carregandoTudo,
    togglCompleto,
    completa,
    salvando,
    salvandoConfiguracao,
    salvandoParametrosGant,
    salvandoResponsabilidade,
    salvandoStatusFinal,
    salvarCategorias,
    salvarConfiguracao,
    salvarParametrosGant,
    salvarResponsabilidade,
    salvarStatusFinal,
    aoConcluir,
    aoVoltarResumo,
}: ConfiguracoesWizardProps): ReactNode {
    const [etapaAtiva, setEtapaAtiva] = useState(0);
    const [avancandoJira, setAvancandoJira] = useState(false);
    const [salvandoCores, setSalvandoCores] = useState(false);
    const refPainelCores = useRef<CoresJiraPanelHandle>(null);
    const { notificarErro, notificarSucesso } = useNotificacao();
    const refPainelJira = useRef<ConfiguracaoJiraPanelHandle>(null);
    const [salvandoMapeamento, setSalvandoMapeamento] = useState(false);
    const refPainelMapeamento = useRef<MapeamentoJiraTogglPanelHandle>(null);

    const mostraTagsDetalhadas = agrupamento === 'tag' || agrupamento === 'ambos';

    const etapaLiberada = (indice: number): boolean => {
        if (indice <= 0) return true;
        if (indice === 1) return existeUsuarioAdministrador;
        if (indice === 2) return existeUsuarioAdministrador && togglCompleto;
        return existeUsuarioAdministrador && togglCompleto && jiraConexaoValida;
    };

    async function salvarMapeamentoJiraToggl(): Promise<boolean> {
        setSalvandoMapeamento(true);
        try {
            const sucesso = await refPainelMapeamento.current?.salvar();
            return sucesso ?? false;
        } finally {
            setSalvandoMapeamento(false);
        }
    }

    async function salvarTogglTagsAgrupamento(): Promise<boolean> {
        try {
            await Promise.all([
                salvarCategorias({ dev, rev, qa, agrupamento, tagsDetalhadas, corTag }),
                salvarConfiguracao({ agrupamento, tagsDetalhadas, dataInicio: null, dataFim: null }),
                salvarParametrosGant({ agrupamento, tagsSelecionadas: tagsDetalhadas, dataInicio: null, dataFim: null }),
            ]);
            notificarSucesso('Agrupamento e tags salvos.');
            return true;
        } catch (erro) {
            notificarErro(erro, 'Não foi possível salvar agrupamento e tags');
            return false;
        }
    }

    async function salvarJiraConexao(): Promise<boolean> {
        setAvancandoJira(true);
        try {
            const sucesso = await refPainelJira.current?.salvar();
            return sucesso ?? false;
        } finally {
            setAvancandoJira(false);
        }
    }

    async function salvarStatusResponsaveis(): Promise<boolean> {
        try {
            await salvarResponsabilidade({ statusDev, statusRev, statusQa });
            return true;
        } catch (erro) {
            notificarErro(erro, 'Não foi possível salvar o status por responsável');
            return false;
        }
    }

    async function salvarStatusFinalConfigurado(): Promise<boolean> {
        try {
            await salvarStatusFinal({ statusConcluido, statusIgnorado });
            return true;
        } catch (erro) {
            notificarErro(erro, 'Não foi possível salvar os status finais');
            return false;
        }
    }

    async function salvarStatusECores(): Promise<boolean> {
        setSalvandoCores(true);
        try {
            const [statusOk, statusFinalOk, coresOk] = await Promise.all([
                salvarStatusResponsaveis(),
                salvarStatusFinalConfigurado(),
                refPainelCores.current?.salvar() ?? Promise.resolve(true),
            ]);
            const sucesso = statusOk && statusFinalOk && coresOk;
            if (sucesso) notificarSucesso('Configurações salvas.');
            return sucesso;
        } finally {
            setSalvandoCores(false);
        }
    }

    async function salvarEtapaAtual(etapaParaSalvar: number): Promise<boolean> {
        if (etapaParaSalvar === 1) return salvarTogglTagsAgrupamento();
        if (etapaParaSalvar === 2) return salvarJiraConexao();
        if (etapaParaSalvar === 3) return salvarStatusECores();
        if (etapaParaSalvar === 4) return salvarMapeamentoJiraToggl();
        return true;
    }

    async function salvarEAvancarTogglTagsAgrupamento(): Promise<void> {
        const sucesso = await salvarEtapaAtual(1);
        if (sucesso) setEtapaAtiva(2);
    }

    async function salvarEAvancarJiraConexao(): Promise<void> {
        const sucesso = await salvarEtapaAtual(2);
        if (sucesso) setEtapaAtiva(3);
    }

    async function salvarEAvancarStatusResponsaveis(): Promise<void> {
        const sucesso = await salvarEtapaAtual(3);
        if (sucesso) setEtapaAtiva(4);
    }

    async function salvarEConcluirMapeamento(): Promise<void> {
        const sucesso = await salvarEtapaAtual(4);
        if (sucesso) aoConcluir();
    }

    async function irParaResumo(): Promise<void> {
        const sucesso = await salvarEtapaAtual(etapaAtiva);
        if (sucesso) aoVoltarResumo();
    }

    async function voltarEtapa(): Promise<void> {
        const sucesso = await salvarEtapaAtual(etapaAtiva);
        if (sucesso) setEtapaAtiva(etapaAtiva - 1);
    }

    async function selecionarEtapa(indice: number): Promise<void> {
        if (indice === etapaAtiva) return;
        const sucesso = await salvarEtapaAtual(etapaAtiva);
        if (sucesso) setEtapaAtiva(indice);
    }

    const salvandoEtapaAtual =
        etapaAtiva === 1
            ? salvando || salvandoConfiguracao || salvandoParametrosGant
            : etapaAtiva === 2
                ? avancandoJira
                : etapaAtiva === 3
                    ? salvandoResponsabilidade || salvandoStatusFinal || salvandoCores
                    : etapaAtiva === 4
                        ? salvandoMapeamento
                        : false;

    return (
        <Stack spacing={2}>
            <Stepper nonLinear activeStep={etapaAtiva} sx={{ mb: 1 }}>
                {ETAPAS.map((rotulo, indice) => (
                    <Step key={rotulo} completed={etapaLiberada(indice + 1) && indice < etapaAtiva}>
                        <StepButton disabled={!etapaLiberada(indice)} onClick={() => void selecionarEtapa(indice)}>
                            {rotulo}
                        </StepButton>
                    </Step>
                ))}
            </Stepper>

            {etapaAtiva === 0 ? (
                <Stack spacing={2}>
                    <UsuariosTogglPanel onUsuariosAlterados={onUsuariosAlterados} />

                    {!existeUsuarioAdministrador ? (
                        <Alert severity="info">
                            Cadastre pelo menos um usuário do Toggl marcado como Administrador para avançar — o token dele é
                            usado para listar as tags reais do workspace do Toggl.
                        </Alert>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento variant="contained" disabled={!existeUsuarioAdministrador} onClick={() => setEtapaAtiva(1)}>
                            Avançar
                        </BotaoComCarregamento>
                        <BotaoVoltarResumo carregando={salvandoEtapaAtual} onClick={() => void irParaResumo()} />
                    </Stack>
                </Stack>
            ) : undefined}

            {etapaAtiva === 1 ? (
                <Stack spacing={2}>
                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Toggl: agrupamento e tags</Typography>

                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectAgrupamento value={agrupamento} onChange={setAgrupamento} disabled={carregandoTudo} />
                                    </Box>
                                    {mostraTagsDetalhadas ? (
                                        <Box sx={{ flex: 2, minWidth: 0 }}>
                                            <SelectListaCacheada
                                                value={tagsDetalhadas}
                                                onChange={setTagsDetalhadas}
                                                disabled={carregandoTudo}
                                                label="Tags para detalhar por descrição"
                                                helperText="Tags nesta lista aparecem detalhadas por descrição, as demais ficam agrupadas por tag"
                                                obterOpcoes={async (forcar) => {
                                                    const resposta = await listarTagsToggl(forcar);
                                                    return { itens: resposta.tags, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                                }} />
                                        </Box>
                                    ) : undefined}
                                </Stack>

                                <Divider />

                                <Stack spacing={0.5}>
                                    <Typography variant="subtitle1">Tags para identificar responsáveis (DEV / REV / QA)</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Cada apontamento é classificado pela sua TAG do Toggl. A comparação ignora maiúsculas e minúsculas.
                                    </Typography>
                                </Stack>

                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={dev}
                                            onChange={setDev}
                                            disabled={carregandoTudo}
                                            label="Tags DEV"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarTagsToggl(forcar);
                                                return { itens: resposta.tags, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                            }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={rev}
                                            onChange={setRev}
                                            disabled={carregandoTudo}
                                            label="Tags REV"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarTagsToggl(forcar);
                                                return { itens: resposta.tags, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                            }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={qa}
                                            onChange={setQa}
                                            disabled={carregandoTudo}
                                            label="Tags QA"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarTagsToggl(forcar);
                                                return { itens: resposta.tags, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                            }} />
                                    </Box>
                                </Stack>

                                <Divider />

                                <Stack spacing={0.5}>
                                    <Typography variant="subtitle1">Cor da tag no Sprint</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Cor usada no badge e nas labels de tag do acompanhamento do Sprint (linhas agrupadas por tag).
                                    </Typography>
                                </Stack>

                                <MapaCoresLista
                                    titulo="Cor da tag:"
                                    nomes={['Tag']}
                                    cores={{ Tag: corTag }}
                                    disabled={carregandoTudo}
                                    onChange={(_, cor) => setCorTag(cor)} />
                            </Stack>
                        </CardContent>
                    </Card>

                    {!togglCompleto ? (
                        <Alert severity="info">
                            Preencha Agrupamento, Tags para detalhar por descrição (quando aplicável) e Tags DEV/REV/QA para avançar.
                        </Alert>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento carregando={salvandoEtapaAtual} onClick={() => void voltarEtapa()}>Voltar</BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={salvandoEtapaAtual}
                            disabled={carregandoTudo || !togglCompleto}
                            onClick={() => void salvarEAvancarTogglTagsAgrupamento()}>
                            Avançar
                        </BotaoComCarregamento>
                        <BotaoVoltarResumo carregando={salvandoEtapaAtual} onClick={() => void irParaResumo()} />
                    </Stack>
                </Stack>
            ) : undefined}

            {etapaAtiva === 2 ? (
                <Stack spacing={2}>
                    <ConfiguracaoJiraPanel ref={refPainelJira} onValidoChange={setJiraConexaoValida} />

                    {!jiraConexaoValida ? (
                        <Alert severity="info">Preencha URL do domínio e e-mail para avançar.</Alert>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento carregando={salvandoEtapaAtual} onClick={() => void voltarEtapa()}>Voltar</BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={avancandoJira}
                            disabled={!jiraConexaoValida}
                            onClick={() => void salvarEAvancarJiraConexao()}>
                            Avançar
                        </BotaoComCarregamento>
                        <BotaoVoltarResumo carregando={salvandoEtapaAtual} onClick={() => void irParaResumo()} />
                    </Stack>
                </Stack>
            ) : undefined}

            {etapaAtiva === 3 ? (
                <Stack spacing={2}>
                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Jira: status e cores</Typography>

                                <Stack spacing={0.5}>
                                    <Typography variant="subtitle1">Status para identificar responsáveis (DEV / REV / QA)</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Define, para cada tarefa integrada ao Jira, qual grupo está com a bola — esse grupo aparece
                                        como "Pendente" e os demais como "Concluído" no acompanhamento do Sprint.
                                    </Typography>
                                </Stack>

                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={statusDev}
                                            onChange={setStatusDev}
                                            disabled={carregandoTudo}
                                            label="Status DEV"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarStatusJira(forcar);
                                                return { itens: resposta.nomes, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                            }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={statusRev}
                                            onChange={setStatusRev}
                                            disabled={carregandoTudo}
                                            label="Status REV"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarStatusJira(forcar);
                                                return { itens: resposta.nomes, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                            }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={statusQa}
                                            onChange={setStatusQa}
                                            disabled={carregandoTudo}
                                            label="Status QA"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarStatusJira(forcar);
                                                return { itens: resposta.nomes, veioDoCache: resposta.veioDoCache, atualizadoEm: resposta.atualizadoEm };
                                            }} />
                                    </Box>
                                </Stack>
                                <Divider />

                                <Stack spacing={0.5}>
                                    <Typography variant="subtitle1">Status finais (para os totalizadores do Sprint)</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Define quais status do Jira contam como "Concluído" e quais são ignorados (não
                                        contam nem como pendente, nem como concluído) nos totalizadores do cabeçalho do
                                        Sprint. Um status marcado numa lista some das opções da outra até ser desmarcado.
                                        Opcional — sem configuração, o comportamento atual é preservado.
                                    </Typography>
                                </Stack>

                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={statusConcluido}
                                            onChange={setStatusConcluido}
                                            disabled={carregandoTudo}
                                            label="Status Concluído"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarStatusJira(forcar);
                                                return {
                                                    itens: resposta.nomes.filter((nome) => !statusIgnorado.includes(nome)),
                                                    veioDoCache: resposta.veioDoCache,
                                                    atualizadoEm: resposta.atualizadoEm,
                                                };
                                            }} />
                                    </Box>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <SelectListaCacheada
                                            value={statusIgnorado}
                                            onChange={setStatusIgnorado}
                                            disabled={carregandoTudo}
                                            label="Status Ignorado"
                                            obterOpcoes={async (forcar) => {
                                                const resposta = await listarStatusJira(forcar);
                                                return {
                                                    itens: resposta.nomes.filter((nome) => !statusConcluido.includes(nome)),
                                                    veioDoCache: resposta.veioDoCache,
                                                    atualizadoEm: resposta.atualizadoEm,
                                                };
                                            }} />
                                    </Box>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </Card>

                    <CoresJiraPanel ref={refPainelCores} />

                    {!completa ? (
                        <Alert severity="info">
                            Preencha Agrupamento, Tags para detalhar por descrição (quando aplicável), Tags e Status para identificar
                            responsáveis (DEV/REV/QA) para liberar Relatório, Gant e Sprint.
                        </Alert>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento carregando={salvandoEtapaAtual} onClick={() => void voltarEtapa()}>Voltar</BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={salvandoEtapaAtual}
                            disabled={carregandoTudo}
                            onClick={() => void salvarEAvancarStatusResponsaveis()}>
                            Avançar
                        </BotaoComCarregamento>
                        <BotaoVoltarResumo carregando={salvandoEtapaAtual} onClick={() => void irParaResumo()} />
                    </Stack>
                </Stack>
            ) : undefined}

            {etapaAtiva === 4 ? (
                <Stack spacing={2}>
                    <Card variant="outlined">
                        <CardContent>
                            <Stack spacing={2}>
                                <Typography variant="h6">Jira ↔ Toggl</Typography>
                                <MapeamentoJiraTogglPanel ref={refPainelMapeamento} />
                            </Stack>
                        </CardContent>
                    </Card>

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento carregando={salvandoEtapaAtual} onClick={() => void voltarEtapa()}>Voltar</BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="contained"
                            carregando={salvandoEtapaAtual}
                            disabled={carregandoTudo}
                            onClick={() => void salvarEConcluirMapeamento()}>
                            Concluir
                        </BotaoComCarregamento>
                        <BotaoVoltarResumo carregando={salvandoEtapaAtual} onClick={() => void irParaResumo()} />
                    </Stack>
                </Stack>
            ) : undefined}
        </Stack>
    );
}