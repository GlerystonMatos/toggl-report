import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useUsuarios } from './useUsuarios';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { UsuarioResumo } from '../../api/tipos';
import { UsuarioFormDialog } from './UsuarioFormDialog';
import { useNotificacao } from '../../hooks/useNotificacao';
import { DialogoConfirmacao } from '../../components/DialogoConfirmacao';
import { BotaoComCarregamento } from '../../components/BotaoComCarregamento';

import {
    Card,
    Chip,
    List,
    Alert,
    Stack,
    Checkbox,
    ListItem,
    IconButton,
    Typography,
    CardContent,
    ListItemText,
} from '@mui/material';

interface UsuariosPanelProps {
    onVoltar?: () => void;
    onContinuar?: () => void;
}

export function UsuariosPanel({ onVoltar, onContinuar }: UsuariosPanelProps): ReactNode {
    const [dialogoAberto, setDialogoAberto] = useState(false);
    const { notificarErro, notificarSucesso } = useNotificacao();
    const { usuarios, carregando, carregar, editar, remover } = useUsuarios();
    const [removendoChave, setRemovendoChave] = useState<string | null>(null);
    const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioResumo | null>(null);
    const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<UsuarioResumo | null>(null);

    useEffect(() => {
        carregar().catch((erro: unknown) => notificarErro(erro, 'Não foi possível listar os usuários'));
    }, []);

    function abrirParaCriar(): void {
        setUsuarioEmEdicao(null);
        setDialogoAberto(true);
    }

    function abrirParaEditar(usuario: UsuarioResumo): void {
        setUsuarioEmEdicao(usuario);
        setDialogoAberto(true);
    }

    async function alternarSelecionado(usuario: UsuarioResumo): Promise<void> {
        try {
            await editar(usuario.chave, { selecionado: !usuario.selecionado });
        } catch (erro) {
            notificarErro(erro, 'Não foi possível atualizar a seleção do usuário');
        }
    }

    async function confirmarRemocao(): Promise<void> {
        if (!usuarioParaExcluir) return;
        setRemovendoChave(usuarioParaExcluir.chave);
        try {
            await remover(usuarioParaExcluir.chave);
            notificarSucesso(`Usuário "${usuarioParaExcluir.nomeExibicao}" removido com sucesso.`);
            setUsuarioParaExcluir(null);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível remover o usuário');
        } finally {
            setRemovendoChave(null);
        }
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6">Usuários</Typography>
                        <BotaoComCarregamento
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={abrirParaCriar}>
                            Adicionar
                        </BotaoComCarregamento>
                    </Stack>

                    {usuarios.length === 0 && !carregando ? (
                        <Alert severity="info">
                            Nenhum usuário cadastrado ainda. Cadastre pelo menos um para poder consultar o Toggl.
                        </Alert>
                    ) : undefined}

                    <List disablePadding>
                        {usuarios.map((usuario) => (
                            <ListItem
                                key={usuario.chave}
                                divider
                                secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton edge="end" onClick={() => abrirParaEditar(usuario)} aria-label="editar">
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            edge="end"
                                            onClick={() => setUsuarioParaExcluir(usuario)}
                                            disabled={removendoChave === usuario.chave}
                                            aria-label="remover">
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                }>
                                <Checkbox
                                    edge="start"
                                    checked={usuario.selecionado}
                                    onChange={() => void alternarSelecionado(usuario)}
                                    aria-label="Incluir nas consultas" />
                                <ListItemText
                                    primary={usuario.nomeExibicao}
                                    secondary={
                                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                            <Chip size="small" label={usuario.sigla || '—'} sx={{ bgcolor: usuario.cor || undefined, fontWeight: 600 }} />
                                            <Chip size="small" label={usuario.tokenMascarado} variant="outlined" />
                                        </Stack>
                                    } />
                            </ListItem>
                        ))}
                    </List>

                    {onVoltar || onContinuar ? (
                        <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                            {onVoltar ? <BotaoComCarregamento onClick={onVoltar}>Voltar</BotaoComCarregamento> : undefined}
                            {onContinuar ? (
                                <BotaoComCarregamento
                                    variant="contained"
                                    disabled={usuarios.length === 0}
                                    onClick={onContinuar}>
                                    Continuar
                                </BotaoComCarregamento>
                            ) : undefined}
                        </Stack>
                    ) : undefined}
                </Stack>
            </CardContent>

            <UsuarioFormDialog
                aberto={dialogoAberto}
                usuarioEmEdicao={usuarioEmEdicao}
                onFechar={() => setDialogoAberto(false)}
                onSalvo={(mensagem) => {
                    carregar().catch((erro: unknown) => notificarErro(erro, 'Não foi possível atualizar a lista'));
                    notificarSucesso(mensagem);
                }} />

            <DialogoConfirmacao
                aberto={usuarioParaExcluir !== null}
                titulo="Remover usuário"
                mensagem={`Tem certeza que deseja remover o usuário "${usuarioParaExcluir?.nomeExibicao}"? Essa ação não pode ser desfeita.`}
                textoConfirmar="Remover"
                textoCancelar="Cancelar"
                corConfirmar="error"
                carregando={removendoChave === usuarioParaExcluir?.chave}
                onConfirmar={() => void confirmarRemocao()}
                onCancelar={() => setUsuarioParaExcluir(null)} />
        </Card>
    );
}