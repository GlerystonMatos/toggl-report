import type { ReactNode } from 'react';
import { useSprints } from './useSprints';
import { useEffect, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import type { Sprint } from '../../api/tipos';
import EditIcon from '@mui/icons-material/Edit';
import { formatarPeriodo } from '../../utils/datas';
import DeleteIcon from '@mui/icons-material/Delete';
import { SprintFormDialog } from './SprintFormDialog';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useNotificacao } from '../../hooks/useNotificacao';
import { CabecalhoView } from '../../components/CabecalhoView';
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Chip,
    Card,
    List,
    Radio,
    Alert,
    Stack,
    ListItem,
    IconButton,
    CardContent,
    ListItemText,
    ListItemButton,
} from '@mui/material';

interface SprintsPanelProps {
    sprintSelecionadoChave: string | null;
    onSelecionar: (sprint: Sprint) => void;
    onContinuar?: () => void;
    semUsuarios?: boolean;
}

export function SprintsPanel({ sprintSelecionadoChave, onSelecionar, onContinuar, semUsuarios = false }: SprintsPanelProps): ReactNode {
    const { notificarErro, notificarSucesso } = useNotificacao();
    const { sprints, carregando, carregar, remover, reabrir } = useSprints();

    const [dialogoAberto, setDialogoAberto] = useState(false);
    const [sprintEmEdicao, setSprintEmEdicao] = useState<Sprint | null>(null);

    const [sprintParaExcluir, setSprintParaExcluir] = useState<Sprint | null>(null);
    const [removendoChave, setRemovendoChave] = useState<string | null>(null);

    const [sprintParaReabrir, setSprintParaReabrir] = useState<Sprint | null>(null);
    const [reabrindoChave, setReabrindoChave] = useState<string | null>(null);

    useEffect(() => {
        carregar().catch((erro: unknown) => notificarErro(erro, 'Não foi possível listar os sprints'));
    }, []);

    function abrirParaCriar(): void {
        setSprintEmEdicao(null);
        setDialogoAberto(true);
    }

    function abrirParaEditar(sprint: Sprint): void {
        setSprintEmEdicao(sprint);
        setDialogoAberto(true);
    }

    async function confirmarRemocao(): Promise<void> {
        if (!sprintParaExcluir) return;
        setRemovendoChave(sprintParaExcluir.chave);
        try {
            await remover(sprintParaExcluir.chave);
            notificarSucesso(`Sprint "${sprintParaExcluir.nome}" removido com sucesso.`);
            setSprintParaExcluir(null);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível remover o sprint');
        } finally {
            setRemovendoChave(null);
        }
    }

    async function confirmarReabertura(): Promise<void> {
        if (!sprintParaReabrir) return;
        setReabrindoChave(sprintParaReabrir.chave);
        try {
            const atualizado = await reabrir(sprintParaReabrir.chave);
            notificarSucesso(`Sprint "${sprintParaReabrir.nome}" reaberto.`);
            if (sprintSelecionadoChave === atualizado.chave) {
                onSelecionar(atualizado);
            }
            setSprintParaReabrir(null);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível reabrir o sprint');
        } finally {
            setReabrindoChave(null);
        }
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <CabecalhoView titulo="Sprints">
                        <BotaoComCarregamento
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={abrirParaCriar}>
                            Adicionar
                        </BotaoComCarregamento>
                    </CabecalhoView>

                    {sprints.length === 0 && !carregando ? (
                        <Alert severity="info">
                            Nenhum sprint cadastrado ainda. Cadastre um sprint para poder acompanhar a capacidade.
                        </Alert>
                    ) : undefined}

                    <List disablePadding>
                        {sprints.map((sprint) => (
                            <ListItem
                                key={sprint.chave}
                                divider
                                disablePadding
                                secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                        {sprint.fechado ? (
                                            <IconButton
                                                edge="end"
                                                onClick={() => setSprintParaReabrir(sprint)}
                                                disabled={reabrindoChave === sprint.chave}
                                                aria-label="reabrir">
                                                <LockOpenIcon fontSize="small" />
                                            </IconButton>
                                        ) : undefined}
                                        <IconButton edge="end" onClick={() => abrirParaEditar(sprint)} aria-label="editar">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            edge="end"
                                            onClick={() => setSprintParaExcluir(sprint)}
                                            disabled={removendoChave === sprint.chave}
                                            aria-label="remover">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                }>
                                <ListItemButton
                                    selected={sprintSelecionadoChave === sprint.chave}
                                    onClick={() => onSelecionar(sprint)}>
                                    <Radio
                                        edge="start"
                                        checked={sprintSelecionadoChave === sprint.chave}
                                        tabIndex={-1}
                                        aria-label="Selecionar sprint" />
                                    <ListItemText
                                        primary={
                                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                <span>{sprint.nome}</span>
                                                {sprint.fechado ? <Chip label="Fechado" size="small" /> : undefined}
                                            </Stack>
                                        }
                                        secondary={`${formatarPeriodo(sprint.dataInicio, sprint.dataFim)} · ${sprint.horasPorDia}h/dia`} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    {onContinuar ? (
                        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                            <BotaoComCarregamento
                                variant="contained"
                                disabled={sprintSelecionadoChave === null || semUsuarios}
                                onClick={onContinuar}>
                                Continuar
                            </BotaoComCarregamento>
                        </Stack>
                    ) : undefined}
                </Stack>
            </CardContent>

            <SprintFormDialog
                aberto={dialogoAberto}
                sprintEmEdicao={sprintEmEdicao}
                onFechar={() => setDialogoAberto(false)}
                onSalvo={(mensagem) => {
                    carregar()
                        .then((lista) => {
                            const atualizado = sprintEmEdicao && lista.find((s) => s.chave === sprintEmEdicao.chave);
                            if (atualizado && sprintSelecionadoChave === atualizado.chave) {
                                onSelecionar(atualizado);
                            }
                        })
                        .catch((erro: unknown) => notificarErro(erro, 'Não foi possível atualizar a lista'));
                    notificarSucesso(mensagem);
                }} />

            <DialogoConfirmacao
                aberto={sprintParaExcluir !== null}
                titulo="Remover sprint"
                mensagem={`Tem certeza que deseja remover o sprint "${sprintParaExcluir?.nome}"? Essa ação não pode ser desfeita.`}
                textoConfirmar="Remover"
                textoCancelar="Cancelar"
                corConfirmar="error"
                carregando={removendoChave === sprintParaExcluir?.chave}
                onConfirmar={() => void confirmarRemocao()}
                onCancelar={() => setSprintParaExcluir(null)} />

            <DialogoConfirmacao
                aberto={sprintParaReabrir !== null}
                titulo="Reabrir sprint"
                mensagem={`Tem certeza que deseja reabrir o sprint "${sprintParaReabrir?.nome}"? A edição e novas consultas à API voltam a ser permitidas.`}
                textoConfirmar="Reabrir"
                textoCancelar="Cancelar"
                carregando={reabrindoChave === sprintParaReabrir?.chave}
                onConfirmar={() => void confirmarReabertura()}
                onCancelar={() => setSprintParaReabrir(null)} />
        </Card>
    );
}