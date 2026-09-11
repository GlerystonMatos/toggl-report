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
    Table,
    Alert,
    Stack,
    Checkbox,
    TableRow,
    TableBody,
    TableCell,
    TableHead,
    IconButton,
    CardContent,
    TableContainer,
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

                    {usuarios.length > 0 ? (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox" />
                                        <TableCell>Nome</TableCell>
                                        <TableCell>Sigla</TableCell>
                                        <TableCell>Token</TableCell>
                                        <TableCell align="right">Ações</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {usuarios.map((usuario) => (
                                        <TableRow key={usuario.chave}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={usuario.selecionado}
                                                    onChange={() => void alternarSelecionado(usuario)}
                                                    aria-label="Incluir nas consultas" />
                                            </TableCell>
                                            <TableCell>{usuario.nomeExibicao}</TableCell>
                                            <TableCell>
                                                <BadgeSigla sigla={usuario.sigla} cor={usuario.cor} />
                                            </TableCell>
                                            <TableCell>
                                                <Chip size="small" label={usuario.tokenMascarado} variant="outlined" />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
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
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : undefined}
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