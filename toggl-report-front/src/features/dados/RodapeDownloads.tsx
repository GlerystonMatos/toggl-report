import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '@mui/material';
import { baixarDados } from '../../api/dadosApi';
import { CreditoApp } from '../../components/CreditoApp';
import DownloadIcon from '@mui/icons-material/Download';
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
                mt: 2,
                pt: 2,
                paddingTop: 0.5,
                borderTop: 1,
                borderColor: 'divider',
            }}>
            <CreditoApp sx={{ fontWeight: 700 }} />
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