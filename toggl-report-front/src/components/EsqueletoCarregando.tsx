import type { ReactNode } from 'react';
import { Skeleton, Stack } from '@mui/material';

export function EsqueletoCarregando(): ReactNode {
    return (
        <Stack spacing={1}>
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
        </Stack>
    );
}