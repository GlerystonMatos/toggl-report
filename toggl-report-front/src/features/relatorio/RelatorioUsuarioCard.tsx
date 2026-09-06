import type { ReactNode } from 'react';
import { formatarDuracao } from '../../utils/duracao';
import { formatarInicioLocal } from '../../utils/datas';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { curarPorDescricao, ordenarPorTag } from './curadoria';
import type { Agrupamento, RelatorioUsuario } from '../../api/tipos';

import {
    Chip,
    List,
    Stack,
    Divider,
    Checkbox,
    ListItem,
    Accordion,
    Typography,
    ListItemText,
    AccordionDetails,
    AccordionSummary,
} from '@mui/material';

interface RelatorioUsuarioCardProps {
    usuario: RelatorioUsuario;
    agrupamento: Agrupamento;
    expandido: boolean;
    onAlternar: () => void;
    selecionados: Set<string>;
    onAlternarSelecao: (chave: string) => void;
}

export function RelatorioUsuarioCard({
    usuario,
    agrupamento,
    expandido,
    onAlternar,
    selecionados,
    onAlternarSelecao,
}: RelatorioUsuarioCardProps): ReactNode {
    const mostraPorDescricao = agrupamento === 'descricao' || agrupamento === 'ambos';
    const mostraPorTag = agrupamento === 'tag' || agrupamento === 'ambos';

    const linhasDescricao = mostraPorDescricao ? curarPorDescricao(usuario.porDescricao) : [];
    const linhasTag = mostraPorTag ? ordenarPorTag(usuario.porTag) : [];
    const temEmAndamento = usuario.emAndamento.length > 0;

    const chaveDescricao = (chaveLinha: string): string => `${usuario.nomeExibicao}::descricao::${chaveLinha}`;
    const chaveTag = (tag: string): string => `${usuario.nomeExibicao}::tag::${tag}`;

    return (
        <Accordion expanded={expandido} onChange={onAlternar} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', width: '100%', pr: 2, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }}>{usuario.nomeExibicao}</Typography>
                    <Chip
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={`Total: ${formatarDuracao(usuario.totalSegundos)}`} />
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={2}>
                    {mostraPorDescricao ? (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Por descrição
                            </Typography>
                            {linhasDescricao.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    (nenhum dado)
                                </Typography>
                            ) : (
                                <List dense disablePadding>
                                    {linhasDescricao.map((linha) => {
                                        const chave = chaveDescricao(linha.chave);
                                        const selecionado = selecionados.has(chave);
                                        return (
                                            <ListItem key={linha.chave} disableGutters sx={{ pl: 0 }}>
                                                <Checkbox
                                                    size="small"
                                                    checked={selecionado}
                                                    onChange={() => onAlternarSelecao(chave)}
                                                    sx={{ p: 0.5, mr: 0.5 }} />
                                                <ListItemText
                                                    primary={linha.texto}
                                                    sx={{ textDecoration: selecionado ? 'line-through' : 'none' }} />
                                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', pl: 2 }}>
                                                    {formatarDuracao(linha.segundos)}
                                                </Typography>
                                            </ListItem>
                                        );
                                    })}
                                </List>
                            )}
                        </Stack>
                    ) : undefined}

                    {mostraPorDescricao && mostraPorTag ? <Divider /> : undefined}

                    {mostraPorTag ? (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Por tag
                            </Typography>
                            {linhasTag.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    (nenhum dado)
                                </Typography>
                            ) : (
                                <List dense disablePadding>
                                    {linhasTag.map((linha) => {
                                        const chave = chaveTag(linha.tag);
                                        const selecionado = selecionados.has(chave);
                                        return (
                                            <ListItem key={linha.tag} disableGutters sx={{ pl: 0 }}>
                                                <Checkbox
                                                    size="small"
                                                    checked={selecionado}
                                                    onChange={() => onAlternarSelecao(chave)}
                                                    sx={{ p: 0.5, mr: 0.5 }} />
                                                <ListItemText
                                                    primary={linha.tag}
                                                    sx={{ textDecoration: selecionado ? 'line-through' : 'none' }} />
                                                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', pl: 2 }}>
                                                    {formatarDuracao(linha.segundos)}
                                                </Typography>
                                            </ListItem>
                                        );
                                    })}
                                </List>
                            )}
                        </Stack>
                    ) : undefined}

                    {temEmAndamento ? (
                        <>
                            <Divider />
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Em andamento
                                </Typography>
                                <List dense disablePadding>
                                    {usuario.emAndamento.map((registro) => (
                                        <ListItem key={registro.id} disableGutters>
                                            <ListItemText
                                                primary={`"${registro.description?.trim() || '(sem descrição)'}" (iniciado às ${formatarInicioLocal(registro.start)})`} />
                                        </ListItem>
                                    ))}
                                </List>
                            </Stack>
                        </>
                    ) : undefined}
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}