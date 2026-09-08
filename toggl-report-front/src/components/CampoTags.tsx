import type { ReactNode } from 'react';
import { Autocomplete, TextField } from '@mui/material';

interface CampoTagsProps {
    value: string[];
    onChange: (valor: string[]) => void;
    label: string;
    placeholder?: string;
    helperText?: string;
    disabled?: boolean;
}

export function CampoTags({ value, onChange, label, placeholder, helperText, disabled }: CampoTagsProps): ReactNode {
    return (
        <Autocomplete
            multiple
            freeSolo
            autoSelect
            options={[]}
            value={value}
            onChange={(_evento, novoValor) => onChange(novoValor as string[])}
            disabled={disabled}
            renderInput={(parametros) => (
                <TextField
                    {...parametros}
                    label={label}
                    placeholder={placeholder}
                    helperText={helperText} />
            )} />
    );
}