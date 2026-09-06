import type { ReactNode } from 'react';
import type { ButtonProps } from '@mui/material';
import { Button, CircularProgress } from '@mui/material';

interface BotaoComCarregamentoProps extends ButtonProps {
    carregando?: boolean;
}

export function BotaoComCarregamento({
    carregando = false,
    disabled,
    startIcon,
    children,
    ...outrasProps
}: BotaoComCarregamentoProps): ReactNode {
    return (
        <Button
            {...outrasProps}
            disabled={disabled || carregando}
            startIcon={carregando ? <CircularProgress size={16} color="inherit" /> : startIcon}
        >
            {children}
        </Button>
    );
}