import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

interface CabecalhoViewProps {
    titulo: string;
    children: ReactNode;
}

export function CabecalhoView({ titulo, children }: CabecalhoViewProps): ReactNode {
    return (
        <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6">{titulo}</Typography>
            <Stack direction="row" spacing={1}>{children}</Stack>
        </Stack>
    );
}