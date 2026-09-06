import type { ReactNode } from 'react';
import { BotaoComCarregamento } from './BotaoComCarregamento';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';

interface DialogoConfirmacaoProps {
    aberto: boolean;
    titulo: string;
    mensagem: string;
    textoConfirmar?: string;
    textoCancelar?: string;
    corConfirmar?: 'primary' | 'error';
    focoNoCancelar?: boolean;
    carregando?: boolean;
    onConfirmar: () => void;
    onCancelar?: () => void;
}

export function DialogoConfirmacao({
    aberto,
    titulo,
    mensagem,
    textoConfirmar = 'OK',
    textoCancelar,
    corConfirmar = 'primary',
    focoNoCancelar = false,
    carregando = false,
    onConfirmar,
    onCancelar,
}: DialogoConfirmacaoProps): ReactNode {
    return (
        <Dialog open={aberto} onClose={carregando ? undefined : onCancelar} maxWidth="xs" fullWidth>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogContent>
                <DialogContentText>{mensagem}</DialogContentText>
            </DialogContent>
            <DialogActions>
                {textoCancelar ? (
                    <BotaoComCarregamento onClick={onCancelar} disabled={carregando} autoFocus={focoNoCancelar}>
                        {textoCancelar}
                    </BotaoComCarregamento>
                ) : undefined}
                <BotaoComCarregamento
                    variant="contained"
                    color={corConfirmar}
                    carregando={carregando}
                    onClick={onConfirmar}
                    autoFocus={!focoNoCancelar}>
                    {textoConfirmar}
                </BotaoComCarregamento>
            </DialogActions>
        </Dialog>
    );
}