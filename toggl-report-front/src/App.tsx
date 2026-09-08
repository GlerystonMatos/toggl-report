import { tema } from './theme';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useAuth } from './features/auth/useAuth';
import { GantView } from './features/gant/GantView';
import LogoutIcon from '@mui/icons-material/Logout';
import { LoginScreen } from './features/auth/LoginScreen';
import { SprintView } from './features/sprint/SprintView';
import { limparTachados } from './features/sprint/tachados';
import { ProvedorNotificacao } from './hooks/useNotificacao';
import { useConsulta } from './features/consulta/useConsulta';
import { useUsuarios } from './features/usuarios/useUsuarios';
import { SprintsPanel } from './features/sprint/SprintsPanel';
import { MarcaTogglReport } from './components/MarcaTogglReport';
import { ConsultaPanel } from './features/consulta/ConsultaPanel';
import { UsuariosPanel } from './features/usuarios/UsuariosPanel';
import { useConsultaGant } from './features/gant/useConsultaGant';
import { RodapeDownloads } from './features/dados/RodapeDownloads';
import { RelatorioView } from './features/relatorio/RelatorioView';
import { useConsultaSprint } from './features/sprint/useConsultaSprint';
import { ParametrosForm } from './features/configuracao/ParametrosForm';
import { ParametrosGantForm } from './features/gant/ParametrosGantForm';
import { BotaoComCarregamento } from './components/BotaoComCarregamento';
import { ImportarDadosDialog } from './features/dados/ImportarDadosDialog';
import { CategoriasSprintPanel } from './features/sprint/CategoriasSprintPanel';

import type {
    Sprint,
    ParametrosGant,
    CategoriasSprint,
    ConsultarResponse,
    ParametrosConfiguracao,
} from './api/tipos';

import {
    Tab,
    Box,
    Step,
    Tabs,
    Alert,
    AppBar,
    Tooltip,
    Stepper,
    Toolbar,
    Container,
    StepButton,
    IconButton,
    CssBaseline,
    ThemeProvider,
} from '@mui/material';

const ETAPAS_RELATORIO = ['Parâmetros', 'Consulta', 'Relatório'] as const;
const ETAPAS_GANT = ['Parâmetros', 'Consulta', 'Gant'] as const;
const ETAPAS_SPRINT = ['Sprints', 'Parâmetros', 'Consultar', 'Acompanhamento'] as const;

type Modo = 'usuarios' | 'relatorio' | 'gant' | 'sprint';

interface AppInternoProps {
    onSair: () => void;
}

function AppInterno({ onSair }: AppInternoProps): ReactNode {
    const [modo, setModo] = useState<Modo>('usuarios');

    const [etapaAtiva, setEtapaAtiva] = useState(0);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [configuracao, setConfiguracao] = useState<ParametrosConfiguracao | null>(null);
    const [consultaConcluida, setConsultaConcluida] = useState<ConsultarResponse | null>(null);

    const [etapaGantAtiva, setEtapaGantAtiva] = useState(0);
    const [configuracaoGant, setConfiguracaoGant] = useState<ParametrosGant | null>(null);
    const [consultaGantConcluida, setConsultaGantConcluida] = useState<ConsultarResponse | null>(null);

    const [etapaSprintAtiva, setEtapaSprintAtiva] = useState(0);
    const [sprintSelecionado, setSprintSelecionado] = useState<Sprint | null>(null);
    const [parametrosSprint, setParametrosSprint] = useState<CategoriasSprint | null>(null);
    const [consultaSprintConcluida, setConsultaSprintConcluida] = useState<ConsultarResponse | null>(null);

    const consulta = useConsulta();
    const consultaGant = useConsultaGant();
    const consultaSprint = useConsultaSprint();

    const { usuarios, carregando: carregandoUsuarios, carregar: carregarUsuarios } = useUsuarios();
    const semUsuarios = !carregandoUsuarios && usuarios.length === 0;

    const [, setVerificacaoInicialFeita] = useState(false);
    const [dialogoImportarAberto, setDialogoImportarAberto] = useState(false);
    const [chaveUsuariosPanel, setChaveUsuariosPanel] = useState(0);

    useEffect(() => {
        carregarUsuarios()
            .then((lista) => {
                setVerificacaoInicialFeita((jaFeita) => {
                    if (!jaFeita && lista.length === 0) {
                        setDialogoImportarAberto(true);
                    }
                    return true;
                });
            })
            .catch(() => { });
    }, [etapaAtiva, etapaGantAtiva, etapaSprintAtiva, modo, carregarUsuarios]);

    function alternarSelecao(chave: string): void {
        setSelecionados((atual) => {
            const novo = new Set(atual);
            if (novo.has(chave)) {
                novo.delete(chave);
            } else {
                novo.add(chave);
            }
            return novo;
        });
    }

    const etapaLiberada = (indice: number): boolean => {
        if (indice <= 0) return true;
        if (indice === 1) return configuracao !== null;
        return configuracao !== null && consultaConcluida !== null;
    };

    const etapaGantLiberada = (indice: number): boolean => {
        if (indice <= 0) return true;
        if (indice === 1) return configuracaoGant !== null;
        return configuracaoGant !== null && consultaGantConcluida !== null;
    };

    const etapaSprintLiberada = (indice: number): boolean => {
        if (indice <= 0) return true;
        if (indice === 1) return sprintSelecionado !== null;
        if (indice === 2) return sprintSelecionado !== null && parametrosSprint !== null;
        return sprintSelecionado !== null && parametrosSprint !== null && consultaSprintConcluida !== null;
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="primary" enableColorOnDark>
                <Toolbar>
                    <MarcaTogglReport sxImagem={{ mr: 1.5 }} sxTitulo={{ flexGrow: 1 }} />
                    <Tooltip title="Sair">
                        <IconButton color="inherit" onClick={onSair} aria-label="sair">
                            <LogoutIcon />
                        </IconButton>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Container maxWidth={false} sx={{ flexGrow: 1, py: 3, px: { xs: 1, sm: 2 } }}>
                <Tabs
                    value={modo}
                    onChange={(_, valor: Modo) => setModo(valor)}
                    sx={{ mb: 2 }}>
                    <Tab label="Usuários" value="usuarios" />
                    <Tab label="Relatório" value="relatorio" />
                    <Tab label="Gant" value="gant" />
                    <Tab label="Sprint" value="sprint" />
                </Tabs>

                {semUsuarios ? (
                    <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                        action={
                            <BotaoComCarregamento
                                size="small"
                                onClick={() => setModo('usuarios')}>
                                Cadastrar usuário
                            </BotaoComCarregamento>
                        }>
                        Nenhum usuário cadastrado. Cadastre pelo menos um usuário antes de continuar.
                    </Alert>
                ) : undefined}

                {modo === 'usuarios' ? (
                    <UsuariosPanel key={chaveUsuariosPanel} />
                ) : undefined}

                {modo === 'relatorio' ? (
                    <>
                        <Stepper nonLinear activeStep={etapaAtiva} sx={{ mb: 3 }}>
                            {ETAPAS_RELATORIO.map((rotulo, indice) => (
                                <Step key={rotulo} completed={etapaLiberada(indice + 1) && indice < etapaAtiva}>
                                    <StepButton disabled={!etapaLiberada(indice)} onClick={() => setEtapaAtiva(indice)}>
                                        {rotulo}
                                    </StepButton>
                                </Step>
                            ))}
                        </Stepper>

                        {etapaAtiva === 0 ? (
                            <ParametrosForm
                                semUsuarios={semUsuarios}
                                onSalvo={(config) => {
                                    setConfiguracao(config);
                                    setEtapaAtiva(1);
                                }} />
                        ) : undefined}

                        {etapaAtiva === 1 && configuracao?.dataInicio && configuracao.dataFim ? (
                            <ConsultaPanel
                                dataInicio={configuracao.dataInicio}
                                dataFim={configuracao.dataFim}
                                agrupamento={configuracao.agrupamento}
                                tagsDetalhadas={configuracao.tagsDetalhadas}
                                usuariosSelecionados={usuarios.filter((usuario) => usuario.selecionado)}
                                resultado={consulta.resultado}
                                consultando={consulta.consultando}
                                executar={consulta.executar}
                                onVoltar={() => setEtapaAtiva(0)}
                                onConcluida={(resposta) => {
                                    setConsultaConcluida(resposta);
                                    if (!resposta.veioDoCache) {
                                        setSelecionados(new Set());
                                    }
                                    setEtapaAtiva(2);
                                }} />
                        ) : undefined}

                        {etapaAtiva === 2 && consultaConcluida ? (
                            <RelatorioView
                                dataInicio={consultaConcluida.dataInicio}
                                dataFim={consultaConcluida.dataFim}
                                selecionados={selecionados}
                                onAlternarSelecao={alternarSelecao}
                                onVoltar={() => setEtapaAtiva(1)}
                                veioDoCache={consultaConcluida.veioDoCache} />
                        ) : undefined}
                    </>
                ) : undefined}

                {modo === 'gant' ? (
                    <>
                        <Stepper nonLinear activeStep={etapaGantAtiva} sx={{ mb: 3 }}>
                            {ETAPAS_GANT.map((rotulo, indice) => (
                                <Step key={rotulo} completed={etapaGantLiberada(indice + 1) && indice < etapaGantAtiva}>
                                    <StepButton disabled={!etapaGantLiberada(indice)} onClick={() => setEtapaGantAtiva(indice)}>
                                        {rotulo}
                                    </StepButton>
                                </Step>
                            ))}
                        </Stepper>

                        {etapaGantAtiva === 0 ? (
                            <ParametrosGantForm
                                semUsuarios={semUsuarios}
                                onSalvo={(params) => {
                                    setConfiguracaoGant(params);
                                    setEtapaGantAtiva(1);
                                }} />
                        ) : undefined}

                        {etapaGantAtiva === 1 && configuracaoGant?.dataInicio && configuracaoGant.dataFim ? (
                            <ConsultaPanel
                                dataInicio={configuracaoGant.dataInicio}
                                dataFim={configuracaoGant.dataFim}
                                agrupamento={configuracaoGant.agrupamento}
                                tagsDetalhadas={configuracaoGant.tagsSelecionadas}
                                usuariosSelecionados={usuarios.filter((usuario) => usuario.selecionado)}
                                resultado={consultaGant.resultado}
                                consultando={consultaGant.consultando}
                                executar={consultaGant.executar}
                                onVoltar={() => setEtapaGantAtiva(0)}
                                onConcluida={(resposta) => {
                                    setConsultaGantConcluida(resposta);
                                    setEtapaGantAtiva(2);
                                }} />
                        ) : undefined}

                        {etapaGantAtiva === 2 && consultaGantConcluida ? (
                            <GantView
                                dataInicio={consultaGantConcluida.dataInicio}
                                dataFim={consultaGantConcluida.dataFim}
                                onVoltar={() => setEtapaGantAtiva(1)}
                                veioDoCache={consultaGantConcluida.veioDoCache} />
                        ) : undefined}
                    </>
                ) : undefined}

                {modo === 'sprint' ? (
                    <>
                        <Stepper nonLinear activeStep={etapaSprintAtiva} sx={{ mb: 3 }}>
                            {ETAPAS_SPRINT.map((rotulo, indice) => (
                                <Step key={rotulo} completed={etapaSprintLiberada(indice + 1) && indice < etapaSprintAtiva}>
                                    <StepButton disabled={!etapaSprintLiberada(indice)} onClick={() => setEtapaSprintAtiva(indice)}>
                                        {rotulo}
                                    </StepButton>
                                </Step>
                            ))}
                        </Stepper>

                        {etapaSprintAtiva === 0 ? (
                            <SprintsPanel
                                sprintSelecionadoChave={sprintSelecionado?.chave ?? null}
                                onSelecionar={setSprintSelecionado}
                                semUsuarios={semUsuarios}
                                onContinuar={() => setEtapaSprintAtiva(1)} />
                        ) : undefined}

                        {etapaSprintAtiva === 1 ? (
                            <CategoriasSprintPanel
                                semUsuarios={semUsuarios}
                                onVoltar={() => setEtapaSprintAtiva(0)}
                                onAvancar={(config) => {
                                    setParametrosSprint(config);
                                    setEtapaSprintAtiva(2);
                                }} />
                        ) : undefined}

                        {etapaSprintAtiva === 2 && sprintSelecionado && parametrosSprint ? (
                            <ConsultaPanel
                                dataInicio={sprintSelecionado.dataInicio}
                                dataFim={sprintSelecionado.dataFim}
                                agrupamento={parametrosSprint.agrupamento}
                                tagsDetalhadas={parametrosSprint.tagsDetalhadas}
                                categorias={{ dev: parametrosSprint.dev, rev: parametrosSprint.rev, qa: parametrosSprint.qa }}
                                usuariosSelecionados={usuarios.filter((usuario) => usuario.selecionado)}
                                resultado={consultaSprint.resultado}
                                consultando={consultaSprint.consultando}
                                executar={consultaSprint.executar}
                                onVoltar={() => setEtapaSprintAtiva(1)}
                                onConcluida={(resposta) => {
                                    setConsultaSprintConcluida(resposta);
                                    if (!resposta.veioDoCache && sprintSelecionado) {
                                        limparTachados(sprintSelecionado.chave);
                                    }
                                    setEtapaSprintAtiva(3);
                                }} />
                        ) : undefined}

                        {etapaSprintAtiva === 3 && sprintSelecionado && consultaSprintConcluida ? (
                            <SprintView
                                chaveSprint={sprintSelecionado.chave}
                                veioDoCache={consultaSprintConcluida.veioDoCache}
                                categorias={parametrosSprint}
                                onVoltar={() => setEtapaSprintAtiva(2)} />
                        ) : undefined}
                    </>
                ) : undefined}

                <RodapeDownloads />
            </Container>

            <ImportarDadosDialog
                aberto={dialogoImportarAberto}
                onFechar={() => setDialogoImportarAberto(false)}
                onImportado={() => {
                    setDialogoImportarAberto(false);
                    carregarUsuarios().catch(() => { });
                    setChaveUsuariosPanel((atual) => atual + 1);
                }} />
        </Box>
    );
}

export default function App(): ReactNode {
    const { autenticado, verificando, entrando, erro, entrar, sair } = useAuth();

    return (
        <ThemeProvider theme={tema}>
            <CssBaseline />
            <ProvedorNotificacao>
                {verificando ? undefined : autenticado ? (
                    <AppInterno onSair={sair} />
                ) : (
                    <LoginScreen entrando={entrando} erro={erro} onEntrar={(usuario, senha) => void entrar(usuario, senha)} />
                )}
            </ProvedorNotificacao>
        </ThemeProvider>
    );
}