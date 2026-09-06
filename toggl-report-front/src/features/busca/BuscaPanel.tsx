import { useState } from 'react';
import { useBusca } from './useBusca';
import type { ReactNode } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import { formatarDuracao } from '../../utils/duracao';
import { useNotificacao } from '../../hooks/useNotificacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Card,
    Alert,
    Stack,
    Divider,
    TextField,
    Typography,
    CardContent,
} from '@mui/material';

interface BuscaPanelProps {
    onFechar: () => void;
}

export function BuscaPanel({ onFechar }: BuscaPanelProps): ReactNode {
    const { resultado, buscando, buscar, limpar } = useBusca();
    const { notificarErro } = useNotificacao();
    const [termo, setTermo] = useState('');

    async function executarBusca(): Promise<void> {
        if (!termo.trim()) return;
        try {
            await buscar(termo.trim());
        } catch (erro) {
            notificarErro(erro, 'Não foi possível buscar');
        }
    }

    function limparBusca(): void {
        limpar();
        setTermo('');
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Typography variant="h6">Buscar por parte da descrição</Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                            label="Buscar por parte da descrição"
                            value={termo}
                            onChange={(evento) => setTermo(evento.target.value)}
                            onKeyDown={(evento) => {
                                if (evento.key === 'Enter') void executarBusca();
                            }}
                            fullWidth
                            size="small"
                            autoFocus />
                        <BotaoComCarregamento
                            variant="contained"
                            startIcon={<SearchIcon />}
                            carregando={buscando}
                            disabled={!termo.trim()}
                            onClick={() => void executarBusca()}>
                            Buscar
                        </BotaoComCarregamento>
                        <BotaoComCarregamento
                            variant="outlined"
                            disabled={!termo && !resultado}
                            onClick={limparBusca}>
                            Limpar
                        </BotaoComCarregamento>
                    </Stack>

                    {resultado ? (
                        <Stack spacing={2} divider={<Divider />}>
                            {resultado.linhas.length === 0 ? (
                                <Alert severity="info">Nenhuma descrição encontrada para "{termo}".</Alert>
                            ) : (
                                resultado.linhas.map((linha) => (
                                    <Stack key={linha.descricao} spacing={0.5}>
                                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                                            <Typography sx={{ fontWeight: 600 }}>{linha.descricao}</Typography>
                                            <Typography sx={{ fontWeight: 600 }}>
                                                {formatarDuracao(linha.totalSegundosLinha)}
                                            </Typography>
                                        </Stack>
                                        <Stack spacing={0.25} sx={{ pl: 2 }}>
                                            {Object.entries(linha.segundosPorUsuario)
                                                .sort((a, b) => b[1] - a[1])
                                                .map(([nomeUsuario, segundos]) => (
                                                    <Stack key={nomeUsuario} direction="row" sx={{ justifyContent: 'space-between' }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {nomeUsuario}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {formatarDuracao(segundos)}
                                                        </Typography>
                                                    </Stack>
                                                ))}
                                        </Stack>
                                    </Stack>
                                ))
                            )}

                            {resultado.linhas.length > 0 ? (
                                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                                    <Typography sx={{ fontWeight: 700 }}>Total geral</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>
                                        {formatarDuracao(resultado.totalGeralSegundos)}
                                    </Typography>
                                </Stack>
                            ) : undefined}
                        </Stack>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                        <BotaoComCarregamento variant="contained" onClick={onFechar}>
                            Voltar
                        </BotaoComCarregamento>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}