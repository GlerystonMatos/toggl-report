import type { ReactNode } from 'react';
import { Typography } from '@mui/material';
import { FONTE_MARCA } from '../utils/tipografia';
import type { SxProps, Theme } from '@mui/material';

export function CreditoApp({ sx }: { sx?: SxProps<Theme> }): ReactNode {
    return (
        <Typography
            variant="caption"
            color="text.secondary"
            sx={[{ fontSize: '0.80rem', fontFamily: FONTE_MARCA }, sx] as SxProps<Theme>}>
            Toggl Report – Por Gleryston Matos – v{__APP_VERSION__}
        </Typography>
    );
}