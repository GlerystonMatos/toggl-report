import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { CampoTags } from '../../components/CampoTags';
import { useCategoriasSprint } from './useCategoriasSprint';
import { useNotificacao } from '../../hooks/useNotificacao';
import type { Agrupamento, CategoriasSprint } from '../../api/tipos';
import { SelectAgrupamento } from '../../components/SelectAgrupamento';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Card,
    Alert,
    Stack,
    Divider,
    Typography,
    CardContent,
} from '@mui/material';

interface CategoriasSprintPanelProps {
    onVoltar?: () => void;
    onAvancar?: (config: CategoriasSprint) => void;
    semUsuarios?: boolean;
}

export function CategoriasSprintPanel({ onVoltar, onAvancar, semUsuarios = false }: CategoriasSprintPanelProps): ReactNode {
    const { carregar, salvar, carregando, salvando } = useCategoriasSprint();
    const { notificarErro, notificarSucesso } = useNotificacao();

    const [dev, setDev] = useState<string[]>([]);
    const [rev, setRev] = useState<string[]>([]);
    const [qa, setQa] = useState<string[]>([]);
    const [agrupamento, setAgrupamento] = useState<Agrupamento>('ambos');
    const [tagsDetalhadas, setTagsDetalhadas] = useState<string[]>([]);

    useEffect(() => {
        let cancelado = false;

        carregar()
            .then((dados) => {
                if (cancelado) return;
                setDev(dados.dev);
                setRev(dados.rev);
                setQa(dados.qa);
                setAgrupamento(dados.agrupamento);
                setTagsDetalhadas(dados.tagsDetalhadas);
            })
            .catch((erro: unknown) => {
                if (!cancelado) notificarErro(erro, 'Não foi possível carregar as categorias');
            });

        return () => {
            cancelado = true;
        };
    }, []);

    const mostraTagsDetalhadas = agrupamento === 'tag' || agrupamento === 'ambos';

    const categoriasCompletas = dev.length > 0 && rev.length > 0 && qa.length > 0;
    const podeProsseguir = !carregando && !semUsuarios && categoriasCompletas;

    function avancarSemSalvar(): void {
        if (!podeProsseguir) return;
        onAvancar?.({ dev, rev, qa, agrupamento, tagsDetalhadas });
    }

    async function salvarEAvancar(): Promise<void> {
        if (!podeProsseguir) return;
        try {
            const atualizado = await salvar({ dev, rev, qa, agrupamento, tagsDetalhadas });
            setDev(atualizado.dev);
            setRev(atualizado.rev);
            setQa(atualizado.qa);
            setAgrupamento(atualizado.agrupamento);
            setTagsDetalhadas(atualizado.tagsDetalhadas);
            notificarSucesso('Parâmetros salvos.');
            onAvancar?.(atualizado);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível salvar os parâmetros');
        }
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={3}>
                    <Typography variant="h6">Parâmetros do Sprint</Typography>

                    <SelectAgrupamento
                        value={agrupamento}
                        onChange={setAgrupamento}
                        disabled={carregando} />

                    {mostraTagsDetalhadas ? (
                        <CampoTags
                            value={tagsDetalhadas}
                            onChange={setTagsDetalhadas}
                            disabled={carregando}
                            label="Tags para detalhar por descrição"
                            placeholder="Digite uma tag e pressione Enter (ou clique fora do campo)"
                            helperText="Tags nesta lista aparecem detalhadas por descrição, as demais ficam agrupadas por tag" />
                    ) : undefined}

                    <Divider />

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle1">Categorias de tarefa (DEV / REV / QA)</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Cada apontamento é classificado pela sua TAG do Toggl. A comparação ignora maiúsculas e minúsculas.
                        </Typography>
                    </Stack>

                    <CampoTags
                        value={dev}
                        onChange={setDev}
                        disabled={carregando}
                        label="Tags DEV"
                        placeholder="Digite uma tag e pressione Enter" />

                    <CampoTags
                        value={rev}
                        onChange={setRev}
                        disabled={carregando}
                        label="Tags REV"
                        placeholder="Digite uma tag e pressione Enter" />

                    <CampoTags
                        value={qa}
                        onChange={setQa}
                        disabled={carregando}
                        label="Tags QA"
                        placeholder="Digite uma tag e pressione Enter" />

                    {!categoriasCompletas ? (
                        <Alert severity="info">
                            Informe ao menos uma TAG para DEV, REV e QA para prosseguir.
                        </Alert>
                    ) : undefined}

                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                        <BotaoComCarregamento variant="text" onClick={onVoltar}>
                            Voltar
                        </BotaoComCarregamento>
                        <Stack direction="row" spacing={1}>
                            <BotaoComCarregamento
                                variant="outlined"
                                disabled={!podeProsseguir}
                                onClick={avancarSemSalvar}>
                                Continuar
                            </BotaoComCarregamento>
                            <BotaoComCarregamento
                                variant="contained"
                                carregando={salvando}
                                disabled={!podeProsseguir}
                                onClick={() => void salvarEAvancar()}>
                                Salvar e continuar
                            </BotaoComCarregamento>
                        </Stack>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}