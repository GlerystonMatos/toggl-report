import { tema } from './theme';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { GantView } from './features/gant/GantView';
import { ProvedorNotificacao } from './hooks/useNotificacao';
import { useConsulta } from './features/consulta/useConsulta';
import { useUsuarios } from './features/usuarios/useUsuarios';
import { ConsultaPanel } from './features/consulta/ConsultaPanel';
import { UsuariosPanel } from './features/usuarios/UsuariosPanel';
import { useConsultaGant } from './features/gant/useConsultaGant';
import { RodapeDownloads } from './features/dados/RodapeDownloads';
import { RelatorioView } from './features/relatorio/RelatorioView';
import { ParametrosForm } from './features/configuracao/ParametrosForm';
import { ParametrosGantForm } from './features/gant/ParametrosGantForm';
import { BotaoComCarregamento } from './components/BotaoComCarregamento';

import type {
    ConsultarResponse,
    ParametrosConfiguracao,
    ParametrosGant,
} from './api/tipos';

import {
    Tab,
    Box,
    Step,
    Tabs,
    Alert,
    AppBar,
    Stepper,
    Toolbar,
    Container,
    StepButton,
    Typography,
    CssBaseline,
    ThemeProvider,
} from '@mui/material';

const ETAPAS_RELATORIO = ['Parâmetros', 'Consulta', 'Resultado'] as const;
const ETAPAS_GANT = ['Parâmetros', 'Consulta', 'Resultado'] as const;

function AppInterno(): ReactNode {
    const [modo, setModo] = useState<'usuarios' | 'relatorio' | 'gant'>('usuarios');

    const [etapaAtiva, setEtapaAtiva] = useState(0);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [configuracao, setConfiguracao] = useState<ParametrosConfiguracao | null>(null);
    const [consultaConcluida, setConsultaConcluida] = useState<ConsultarResponse | null>(null);

    const [etapaGantAtiva, setEtapaGantAtiva] = useState(0);
    const [configuracaoGant, setConfiguracaoGant] = useState<ParametrosGant | null>(null);
    const [consultaGantConcluida, setConsultaGantConcluida] = useState<ConsultarResponse | null>(null);

    const consulta = useConsulta();
    const consultaGant = useConsultaGant();

    const { usuarios, carregando: carregandoUsuarios, carregar: carregarUsuarios } = useUsuarios();
    const semUsuarios = !carregandoUsuarios && usuarios.length === 0;

    useEffect(() => {
        carregarUsuarios().catch(() => { });
    }, [etapaAtiva, etapaGantAtiva, modo, carregarUsuarios]);

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

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <AppBar position="static" color="primary" enableColorOnDark>
                <Toolbar>
                    <Box
                        component="img"
                        src="/toggl-report.png"
                        alt=""
                        sx={{ height: 32, width: 32, mr: 1.5 }} />
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        <Box
                            component="span"
                            sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 600, letterSpacing: '0.08em' }}>
                            TOGGL
                        </Box>{' '}
                        <Box
                            component="span"
                            sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 300, letterSpacing: '0.08em' }}>
                            REPORT
                        </Box>
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth={false} sx={{ flexGrow: 1, py: 3, px: { xs: 1, sm: 2 } }}>
                <Tabs
                    value={modo}
                    onChange={(_, valor: 'usuarios' | 'relatorio' | 'gant') => setModo(valor)}
                    sx={{ mb: 2 }}>
                    <Tab label="Usuários" value="usuarios" />
                    <Tab label="Relatório" value="relatorio" />
                    <Tab label="Gant" value="gant" />
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
                    <UsuariosPanel />
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
                                }}
                            />
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
                                }}
                            />
                        ) : undefined}

                        {etapaAtiva === 2 && consultaConcluida ? (
                            <RelatorioView
                                dataInicio={consultaConcluida.dataInicio}
                                dataFim={consultaConcluida.dataFim}
                                selecionados={selecionados}
                                onAlternarSelecao={alternarSelecao}
                                onVoltar={() => setEtapaAtiva(1)}
                                veioDoCache={consultaConcluida.veioDoCache}
                            />
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
                                }}
                            />
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
                                }}
                            />
                        ) : undefined}

                        {etapaGantAtiva === 2 && consultaGantConcluida ? (
                            <GantView
                                dataInicio={consultaGantConcluida.dataInicio}
                                dataFim={consultaGantConcluida.dataFim}
                                onVoltar={() => setEtapaGantAtiva(1)}
                                veioDoCache={consultaGantConcluida.veioDoCache}
                            />
                        ) : undefined}
                    </>
                ) : undefined}

                <RodapeDownloads />
            </Container>
        </Box>
    );
}

export default function App(): ReactNode {
    return (
        <ThemeProvider theme={tema}>
            <CssBaseline />
            <ProvedorNotificacao>
                <AppInterno />
            </ProvedorNotificacao>
        </ThemeProvider>
    );
}