import { useState } from 'react';
import { CORES } from '../../theme';
import type { FormEvent, ReactNode } from 'react';
import { CreditoApp } from '../../components/CreditoApp';
import { Alert, Box, Paper, Stack, TextField } from '@mui/material';
import { MarcaTogglReport } from '../../components/MarcaTogglReport';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

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
                bgcolor: CORES.navbarFundo,
            }}>
            <Paper variant="outlined" component="form" onSubmit={aoSubmeter} sx={{ p: 4, width: 360 }}>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', mb: '12px !important', mt: '-5px !important' }}>
                        <MarcaTogglReport corTexto="text.primary" />
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
                    <CreditoApp sx={{ textAlign: 'center' }} />
                </Stack>
            </Paper>
        </Box>
    );
}