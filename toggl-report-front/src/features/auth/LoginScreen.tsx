import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';
import { Alert, Box, Paper, Stack, TextField, Typography } from '@mui/material';

interface LoginScreenProps {
    entrando: boolean;
    erro: string | null;
    onEntrar: (usuario: string, senha: string) => void;
}

export function LoginScreen({ entrando, erro, onEntrar }: LoginScreenProps): ReactNode {
    const [usuario, setUsuario] = useState('');
    const [senha, setSenha] = useState('');

    function aoSubmeter(evento: FormEvent): void {
        evento.preventDefault();
        onEntrar(usuario, senha);
    }

    return (
        <Box
            sx={{
                display: 'flex',
                minHeight: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#1A1A32',
            }}>
            <Paper variant="outlined" component="form" onSubmit={aoSubmeter} sx={{ p: 4, width: 360 }}>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', mb: '12px !important', mt: '-5px !important' }}>
                        <Box
                            component="img"
                            src="/toggl-report.png"
                            alt=""
                            sx={{ height: 32, width: 32 }} />
                        <Typography variant="h6" component="div">
                            <Box
                                component="span"
                                sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 600, letterSpacing: '0.08em', color: 'text.primary' }}>
                                TOGGL
                            </Box>{' '}
                            <Box
                                component="span"
                                sx={{ fontFamily: '"Montserrat", sans-serif', fontWeight: 300, letterSpacing: '0.08em', color: 'text.primary' }}>
                                REPORT
                            </Box>
                        </Typography>
                    </Stack>
                    <TextField
                        label="Usuário"
                        value={usuario}
                        onChange={(evento) => setUsuario(evento.target.value)}
                        autoFocus
                        fullWidth
                        disabled={entrando} />
                    <TextField
                        label="Senha"
                        type="password"
                        value={senha}
                        onChange={(evento) => setSenha(evento.target.value)}
                        fullWidth
                        disabled={entrando} />
                    {erro ? <Alert severity="error">{erro}</Alert> : undefined}
                    <BotaoComCarregamento
                        type="submit"
                        variant="contained"
                        carregando={entrando}
                        disabled={!usuario || !senha}>
                        Entrar
                    </BotaoComCarregamento>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ textAlign: 'center', fontSize: '0.80rem', fontFamily: '"Montserrat", sans-serif' }}>
                        Toggl Report – Por Gleryston Matos – v{__APP_VERSION__}
                    </Typography>
                </Stack>
            </Paper>
        </Box>
    );
}