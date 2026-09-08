import type { ReactNode } from 'react';
import { Box, Tooltip } from '@mui/material';
import { FONTE_MARCA } from '../utils/tipografia';
import type { SxProps, Theme } from '@mui/material';

interface BadgeSiglaProps {
    sigla: string;
    cor?: string;
    nome?: string;
    sx?: SxProps<Theme>;
}

export function BadgeSigla({ sigla, cor, nome, sx }: BadgeSiglaProps): ReactNode {
    const badge = (
        <Box
            component="span"
            sx={[
                {
                    px: 0.75,
                    py: 0.1,
                    borderRadius: 0,
                    fontWeight: 700,
                    width: '2.5rem',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    display: 'inline-block',
                    textTransform: 'uppercase',
                    fontFamily: FONTE_MARCA,
                    bgcolor: cor || 'action.selected',
                },
                sx,
            ] as SxProps<Theme>}>
            {sigla || '—'}
        </Box>
    );
    return nome ? <Tooltip title={nome}>{badge}</Tooltip> : badge;
}