import { createTheme, alpha } from '@mui/material/styles';

const CORES = {
    navbarFundo: '#1A1A32',
    fundoClaro: '#F8F9FA',
    textoEscuro: '#121216',
    bordaCinza: '#d4d2d2',
    accentAzul: '#5B82F6',
    accentAzulEscuro: '#4B65F6',
    accentMoonGold: '#F5DFA0',
    accentRoxo: '#9A669F',
    creme: '#F8F9FA',
} as const;

export const tema = createTheme({
    palette: {
        mode: 'light',
        primary: { main: CORES.accentAzul, dark: CORES.accentAzulEscuro, contrastText: CORES.creme },
        secondary: { main: CORES.accentRoxo },
        success: { main: CORES.accentMoonGold, contrastText: CORES.textoEscuro },
        warning: { main: CORES.accentRoxo },
        info: { main: CORES.accentAzul },
        background: { default: CORES.fundoClaro, paper: '#FFFFFF' },
        text: { primary: CORES.textoEscuro },
    },
    shape: { borderRadius: 8 },
    components: {
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: CORES.navbarFundo,
                    color: CORES.creme,
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
                        borderColor: CORES.accentAzul,
                    },
                },
            },
        },
        MuiFormControl: {
            styleOverrides: {
                root: {
                    '&:hover .MuiInputLabel-root:not(.Mui-disabled):not(.Mui-error)': {
                        color: CORES.accentAzul,
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    border: `1px solid ${CORES.bordaCinza}`,
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                outlined: {
                    borderColor: CORES.accentAzul,
                    backgroundColor: 'transparent',
                    color: CORES.accentAzul,
                },
            },
        },
        MuiStepButton: {
            styleOverrides: {
                root: {
                    '&[aria-selected="true"]': {
                        backgroundColor: alpha(CORES.accentAzul, 0.15),
                        borderLeft: `3px solid ${CORES.accentAzul}`,
                    },
                },
            },
        },
    },
});