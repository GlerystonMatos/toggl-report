import type { ReactNode } from 'react';
import { urlDownloadDados } from '../../api/dadosApi';
import DownloadIcon from '@mui/icons-material/Download';
import { Button, Stack, Typography } from '@mui/material';

export function RodapeDownloads(): ReactNode {
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
            <Typography variant="caption" color="text.secondary">
                Toggl Report – Por Gleryston Matos – v{__APP_VERSION__}
            </Typography>
            <Button size="small" startIcon={<DownloadIcon />} component="a" href={urlDownloadDados()}>
                Baixar dados (.zip)
            </Button>
        </Stack>
    );
}