import { useState } from 'react';
import type { ReactNode } from 'react';
import { baixarDados } from '../../api/dadosApi';
import DownloadIcon from '@mui/icons-material/Download';
import { Stack, Typography } from '@mui/material';
import { useNotificacao } from '../../hooks/useNotificacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

export function RodapeDownloads(): ReactNode {
    const { notificarErro } = useNotificacao();
    const [baixando, setBaixando] = useState(false);

    async function baixar(): Promise<void> {
        setBaixando(true);
        try {
            await baixarDados();
        } catch (erro) {
            notificarErro(erro, 'Não foi possível baixar os dados');
        } finally {
            setBaixando(false);
        }
    }

    return (
        <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                mt: 4,
                pt: 2,
                borderTop: 1,
                borderColor: 'divider',
            }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: '"Montserrat", sans-serif' }}>
                Toggl Report – Por Gleryston Matos – v{__APP_VERSION__}
            </Typography>
            <BotaoComCarregamento
                size="small"
                startIcon={<DownloadIcon />}
                carregando={baixando}
                onClick={() => void baixar()}>
                Baixar dados (.zip)
            </BotaoComCarregamento>
        </Stack>
    );
}