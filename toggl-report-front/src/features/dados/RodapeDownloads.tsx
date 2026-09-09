import { useState } from 'react';
import { Stack } from '@mui/material';
import type { ReactNode } from 'react';
import { baixarDados } from '../../api/dadosApi';
import DownloadIcon from '@mui/icons-material/Download';
import { CreditoApp } from '../../components/CreditoApp';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useNotificacao } from '../../hooks/useNotificacao';
import { ImportarDadosDialog } from './ImportarDadosDialog';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

const DESCRICAO_REIMPORTACAO: ReactNode = (
    <>
        Envie um <code>.zip</code> com o conteúdo da pasta <code>dados/</code> (baixe primeiro, ajuste os{' '}
        <code>.ini</code> à mão e reenvie). Os arquivos presentes no <code>.zip</code> substituem os atuais de
        mesmo nome; os demais permanecem intactos. Inclua os arquivos de cache de consulta somente se quiser
        substituí-los — caso contrário, deixe-os de fora do <code>.zip</code>. A página é recarregada ao final.
    </>
);

export function RodapeDownloads(): ReactNode {
    const { notificarErro } = useNotificacao();
    const [baixando, setBaixando] = useState(false);
    const [dialogoImportarAberto, setDialogoImportarAberto] = useState(false);

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
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <BotaoComCarregamento
                    size="small"
                    startIcon={<DownloadIcon />}
                    carregando={baixando}
                    onClick={() => void baixar()}>
                    Baixar dados (.zip)
                </BotaoComCarregamento>
                <BotaoComCarregamento
                    size="small"
                    startIcon={<UploadFileIcon />}
                    onClick={() => setDialogoImportarAberto(true)}>
                    Importar dados (.zip)
                </BotaoComCarregamento>
            </Stack>

            <ImportarDadosDialog
                aberto={dialogoImportarAberto}
                onFechar={() => setDialogoImportarAberto(false)}
                onImportado={() => window.location.reload()}
                titulo="Importar dados (.zip)"
                descricao={DESCRICAO_REIMPORTACAO}
                rotuloCancelar="Cancelar" />
        </Stack>
    );
}