import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { restaurarDados } from '../../api/dadosApi';
import { useNotificacao } from '../../hooks/useNotificacao';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Stack,
    Dialog,
    Typography,
    DialogTitle,
    DialogActions,
    DialogContent,
    DialogContentText,
} from '@mui/material';

interface ImportarDadosDialogProps {
    aberto: boolean;
    onFechar: () => void;
    onImportado: () => void;
    titulo?: string;
    descricao?: ReactNode;
    rotuloCancelar?: string;
}

const DESCRICAO_PADRAO: ReactNode = (
    <>
        Nenhum usuário cadastrado ainda. Se você já tem um backup (.zip) da pasta <code>dados/</code>, pode
        importá-lo agora — ou seguir sem importar e cadastrar tudo manualmente pelo fluxo normal.
    </>
);

export function ImportarDadosDialog({
    aberto,
    onFechar,
    onImportado,
    titulo = 'Nenhum dado encontrado',
    descricao = DESCRICAO_PADRAO,
    rotuloCancelar = 'Seguir sem importar',
}: ImportarDadosDialogProps): ReactNode {
    const { notificarErro, notificarSucesso } = useNotificacao();
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [importando, setImportando] = useState(false);

    function fecharEResetar(): void {
        setArquivo(null);
        onFechar();
    }

    function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>): void {
        setArquivo(evento.target.files?.[0] ?? null);
    }

    async function importar(): Promise<void> {
        if (!arquivo) return;
        setImportando(true);
        try {
            await restaurarDados(arquivo);
            notificarSucesso('Dados importados com sucesso.');
            setArquivo(null);
            onImportado();
        } catch (erro) {
            notificarErro(erro, 'Não foi possível importar os dados');
        } finally {
            setImportando(false);
        }
    }

    return (
        <Dialog open={aberto} onClose={importando ? undefined : fecharEResetar} maxWidth="xs" fullWidth>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <DialogContentText component="div">{descricao}</DialogContentText>
                    <BotaoComCarregamento
                        component="label"
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        disabled={importando}>
                        Escolher arquivo .zip
                        <input type="file" accept=".zip" hidden onChange={aoEscolherArquivo} />
                    </BotaoComCarregamento>
                    {arquivo ? (
                        <Typography variant="caption" color="text.secondary">
                            {arquivo.name}
                        </Typography>
                    ) : undefined}
                </Stack>
            </DialogContent>
            <DialogActions>
                <BotaoComCarregamento onClick={fecharEResetar} disabled={importando}>
                    {rotuloCancelar}
                </BotaoComCarregamento>
                <BotaoComCarregamento
                    variant="contained"
                    carregando={importando}
                    disabled={!arquivo}
                    onClick={() => void importar()}>
                    Importar
                </BotaoComCarregamento>
            </DialogActions>
        </Dialog>
    );
}
