import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { FONTE_MARCA } from '../utils/tipografia';
import type { SxProps, Theme } from '@mui/material';

interface MarcaTogglReportProps {
    corTexto?: string;
    sxImagem?: SxProps<Theme>;
    sxTitulo?: SxProps<Theme>;
}

export function MarcaTogglReport({ corTexto, sxImagem, sxTitulo }: MarcaTogglReportProps): ReactNode {
    return (
        <>
            <Box
                component="img"
                src="/toggl-report.png"
                alt=""
                sx={[{ height: 32, width: 32 }, sxImagem] as SxProps<Theme>} />
            <Typography variant="h6" component="div" sx={sxTitulo}>
                <Box
                    component="span"
                    sx={{ fontFamily: FONTE_MARCA, fontWeight: 600, letterSpacing: '0.08em', color: corTexto }}>
                    TOGGL
                </Box>{' '}
                <Box
                    component="span"
                    sx={{ fontFamily: FONTE_MARCA, fontWeight: 300, letterSpacing: '0.08em', color: corTexto }}>
                    REPORT
                </Box>
            </Typography>
        </>
    );
}