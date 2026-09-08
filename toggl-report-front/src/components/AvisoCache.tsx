import { Alert } from '@mui/material';
import type { ReactNode } from 'react';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

export function AvisoCache(): ReactNode {
    return (
        <Alert icon={<CloudDoneIcon fontSize="inherit" />} severity="info">
            Resultado servido do cache local (mesmo período e usuários de uma consulta anterior).
        </Alert>
    );
}