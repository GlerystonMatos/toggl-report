import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useUsuariosToggl } from './useUsuariosToggl';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { UsuarioTogglResumo } from '../../api/tipos';
import { UsuarioTogglFormDialog } from './UsuarioTogglFormDialog';
import { BadgeSigla } from '../../components/BadgeSigla';
import { useNotificacao } from '../../hooks/useNotificacao';
import { CabecalhoView } from '../../components/CabecalhoView';
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
    Typography,
    IconButton,
    CardContent,
    ListItemText,
} from '@mui/material';

export function UsuariosTogglPanel(): ReactNode {
    const [dialogoAberto, setDialogoAberto] = useState(false);
    const { notificarErro, notificarSucesso } = useNotificacao();
    const { usuarios, carregando, carregar, editar, remover } = useUsuariosToggl();
    const [removendoChave, setRemovendoChave] = useState<string | null>(null);
    const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioTogglResumo | null>(null);
    const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<UsuarioTogglResumo | null>(null);

    useEffect(() => {
        carregar().catch((erro: unknown) => notificarErro(erro, 'Não foi possível listar os usuários do Toggl'));
    }, []);

    function abrirParaCriar(): void {
        setUsuarioEmEdicao(null);
        setDialogoAberto(true);
    }

    function abrirParaEditar(usuario: UsuarioTogglResumo): void {
        setUsuarioEmEdicao(usuario);
        setDialogoAberto(true);
    }

    async function alternarSelecionado(usuario: UsuarioTogglResumo): Promise<void> {
        try {
            await editar(usuario.chave, { selecionado: !usuario.selecionado });
        } catch (erro) {
            notificarErro(erro, 'Não foi possível atualizar a seleção do usuário do Toggl');
        }
    }

    async function confirmarRemocao(): Promise<void> {
        if (!usuarioParaExcluir) return;
        setRemovendoChave(usuarioParaExcluir.chave);
        try {
            await remover(usuarioParaExcluir.chave);
            notificarSucesso(`Usuário do Toggl "${usuarioParaExcluir.nomeExibicao}" removido com sucesso.`);
            setUsuarioParaExcluir(null);
        } catch (erro) {
            notificarErro(erro, 'Não foi possível remover o usuário do Toggl');
        } finally {
            setRemovendoChave(null);
        }
    }

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack spacing={2}>
                    <CabecalhoView titulo="Usuários do Toggl">
                        <BotaoComCarregamento
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={abrirParaCriar}>
                            Adicionar
                        </BotaoComCarregamento>
                    </CabecalhoView>

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
                                    primary={
                                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                            <Typography component="span">{usuario.nomeExibicao}</Typography>
                                            <BadgeSigla sigla={usuario.sigla} cor={usuario.cor} />
                                            <Chip size="small" label={usuario.tokenMascarado} variant="outlined" />
                                        </Stack>
                                    } />
                            </ListItem>
                        ))}
                    </List>
                </Stack>
            </CardContent>

            <UsuarioTogglFormDialog
                aberto={dialogoAberto}
                usuarioEmEdicao={usuarioEmEdicao}
                onFechar={() => setDialogoAberto(false)}
                onSalvo={(mensagem) => {
                    carregar().catch((erro: unknown) => notificarErro(erro, 'Não foi possível atualizar a lista'));
                    notificarSucesso(mensagem);
                }} />

            <DialogoConfirmacao
                aberto={usuarioParaExcluir !== null}
                titulo="Remover usuário do Toggl"
                mensagem={`Tem certeza que deseja remover o usuário do Toggl "${usuarioParaExcluir?.nomeExibicao}"? Essa ação não pode ser desfeita.`}
                textoConfirmar="Remover"
                textoCancelar="Cancelar"
                corConfirmar="error"
                carregando={removendoChave === usuarioParaExcluir?.chave}
                onConfirmar={() => void confirmarRemocao()}
                onCancelar={() => setUsuarioParaExcluir(null)} />
        </Card>
    );
}