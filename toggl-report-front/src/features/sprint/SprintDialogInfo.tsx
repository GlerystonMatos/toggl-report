import { useState, type ReactNode } from 'react';
import type { CabecalhoSprint, CategoriasSprint, ResponsabilidadeSprint } from '../../api/tipos';

import {
    Box,
    Tab,
    Tabs,
    Stack,
    Button,
    Dialog,
    Typography,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';

interface SprintDialogInfoProps {
    aberto: boolean;
    onFechar: () => void;
    cabecalho?: CabecalhoSprint;
    categorias?: CategoriasSprint | null;
    responsabilidade?: ResponsabilidadeSprint | null;
}

type AbaInfo = 'capacidade' | 'categorias' | 'prerequisitos' | 'listagem' | 'colunas' | 'controles';

export function SprintDialogInfo({ aberto, onFechar, cabecalho, categorias, responsabilidade }: SprintDialogInfoProps): ReactNode {
    const [aba, setAba] = useState<AbaInfo>('capacidade');

    return (
        <Dialog
            open={aberto}
            onClose={onFechar}
            maxWidth={false}
            sx={{ '& .MuiDialog-paper': { width: '95vw', maxWidth: '95vw' } }}>
            <DialogTitle>Como este sprint é calculado</DialogTitle>
            <DialogContent>
                <Tabs value={aba} onChange={(_, valor: AbaInfo) => setAba(valor)} sx={{ mb: 2 }}>
                    <Tab label="Capacidade" value="capacidade" />
                    <Tab label="Categorias e Jira" value="categorias" />
                    <Tab label="Pré-requisitos e ciclo de vida" value="prerequisitos" />
                    <Tab label="Como a listagem é montada" value="listagem" />
                    <Tab label="Como ler cada coluna" value="colunas" />
                    <Tab label="Controles da tela" value="controles" />
                </Tabs>

                {aba === 'capacidade' ? (
                    <Stack spacing={2}>
                        {cabecalho ? (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Capacidade</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Tempo Total = Horas/dia × Dias úteis = {cabecalho.horasPorDia} × {cabecalho.diasUteis} ={' '}
                                    {cabecalho.horasPorDia * cabecalho.diasUteis} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Margem = floor(30% × Tempo Total) = {cabecalho.margem} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Tempo por colaborador (TD) = Tempo Total − Margem = {cabecalho.td} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Capacidade (CT) = TD × nº de colaboradores selecionados = {cabecalho.ct} h
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Ao lado da Capacidade, o cabeçalho mostra "Pendentes" ({cabecalho.tarefasPendentes})
                                    e "Concluído" ({cabecalho.tarefasConcluidas}): quantidade de descrições distintas
                                    (tarefas, sem contar linhas de tag) cujo status atual no Jira está nas listas
                                    configuráveis "Concluído"/"Ignorado" (Configurações → Jira: status e cores,
                                    mostradas em texto logo abaixo desta tela) — uma descrição sem status na lista
                                    "Concluído" conta como "Pendentes", a menos que esteja na lista "Ignorado" (aí não
                                    conta em nenhum dos dois); sem nenhuma das duas listas configuradas, todas as
                                    descrições contam como "Pendentes".
                                </Typography>
                            </Stack>
                        ) : undefined}

                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2">Colaboradores</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Uma linha por usuário do Toggl selecionado nesta consulta: Capacidade repete o TD do
                                cabeçalho (igual para todos); Tempo realizado soma toda a duração apontada por esse
                                colaborador no período (todos os apontamentos, mesmo os sem tag DEV/REV/QA — diferente do
                                REA por tarefa na grid, que só soma o que tem tag da categoria); Tempo disponível = TD ×
                                3600 − segundos realizados, em vermelho quando negativo (estourou a capacidade) e em
                                verde quando positivo (ainda sobra), sem cor quando exatamente zero.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Quantidade pendentes/concluídas usa um cálculo diferente do "Pendentes"/"Concluído" do
                                cabeçalho: conta, por grupo (DEV/REV/QA) em que esse colaborador aparece numa linha de
                                descrição, a mesma classificação "Pendente"/"Concluído" mostrada na coluna Situação da
                                grid (ver aba "Como ler cada coluna") — quem ocupa o grupo responsável pelo status
                                atual conta como pendente, os demais grupos com colaborador da mesma linha contam como
                                concluído; um colaborador em dois grupos da mesma linha (ex.: DEV e REV) pode contar
                                uma vez em cada coluna. Linhas de tag nunca contam. A linha "Total" no rodapé soma as
                                duas colunas de todos os colaboradores. Tempo realizado/disponível são mostrados com
                                precisão de segundos (ex.: "12h34m56s"), diferente do PRE/REA da grid de tarefas, que
                                arredondam para baixo em horas cheias (ex.: "12h").
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Um botão "+"/"–" ao lado do título "Colaboradores" recolhe/expande essa tabela; o
                                padrão ao abrir a tela é expandido.
                            </Typography>
                        </Stack>
                    </Stack>
                ) : undefined}

                {aba === 'categorias' ? (
                    <Stack spacing={2}>
                        {categorias ? (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Categorias e agrupamento</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Tags que identificam responsável por tempo apontado — DEV: {categorias.dev.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    REV: {categorias.rev.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    QA: {categorias.qa.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Agrupamento: {categorias.agrupamento} — "descricao" detalha tudo por descrição,
                                    "tag" agrupa tudo por tag, "ambos" detalha por descrição só as tags marcadas abaixo
                                    (as demais viram linha de tag).
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Tags detalhadas por descrição (só relevante com agrupamento "ambos"):{' '}
                                    {categorias.tagsDetalhadas.join(', ') || '(nenhuma)'}
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Cor do badge "Tag" no Sprint:
                                    </Typography>
                                    {categorias.corTag ? (
                                        <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: categorias.corTag, border: 1, borderColor: 'divider' }} />
                                    ) : undefined}
                                    <Typography variant="body2" color="text.secondary">
                                        {categorias.corTag || '(nenhuma — usa cinza neutro na exibição)'}
                                    </Typography>
                                </Stack>
                            </Stack>
                        ) : (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Categorias e agrupamento</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Sem dados de categorias carregados para este sprint.
                                </Typography>
                            </Stack>
                        )}

                        {responsabilidade ? (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Responsabilidade por status (Jira)</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Status do Jira que marcam a tarefa como pendência de cada grupo — DEV:{' '}
                                    {responsabilidade.statusDev.join(', ') || '(nenhum)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    REV: {responsabilidade.statusRev.join(', ') || '(nenhum)'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    QA: {responsabilidade.statusQa.join(', ') || '(nenhum)'}
                                </Typography>
                            </Stack>
                        ) : (
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle2">Responsabilidade por status (Jira)</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Sem dados de responsabilidade por status carregados para este sprint.
                                </Typography>
                            </Stack>
                        )}

                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2">Outras configurações consideradas</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Nome, Horas/dia e período (Início/Fim) vêm do cadastro do sprint (aba Sprints). Só
                                entram no cálculo os usuários do Toggl marcados como "Selecionado" na consulta. Tags do
                                Toggl e status do Jira usados nas telas de configuração são escolhidos por seleção (não
                                digitação), a partir de listagens reais e cacheadas — a lista de tags usa o token do
                                usuário do Toggl marcado como Administrador. As cores de Prioridade/Status do Jira e o
                                mapeamento Jira ↔ Toggl (usado no fallback DEV/REV abaixo) ficam na aba Configurações e
                                valem também para Relatório e Gant, quando aplicável.
                            </Typography>
                        </Stack>
                    </Stack>
                ) : undefined}

                {aba === 'prerequisitos' ? (
                    <Stack spacing={2}>
                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2">Pré-requisitos para usar o Sprint</Typography>
                            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Pelo menos um <strong>usuário do Toggl</strong> cadastrado (aba Configurações →
                                    Usuários do Toggl), com um deles marcado como <strong>Administrador</strong> — o
                                    token desse usuário é quem lista as tags reais do workspace, usadas na etapa
                                    seguinte.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Quatro campos obrigatórios em Configurações, sem os quais as abas Relatório/Gant/
                                    Sprint ficam desabilitadas: Agrupamento, Tags detalhadas por descrição (só exigido
                                    quando o agrupamento é "ambos"), Tags DEV/REV/QA do Toggl e Status DEV/REV/QA do
                                    Jira (responsabilidade por status).
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    A conexão com o Jira (URL/e-mail/token) e o mapeamento Jira ↔ Toggl são{' '}
                                    <strong>opcionais</strong>: sem eles, o Sprint funciona só com dados do Toggl —
                                    Prioridade e Situação de cada tarefa ficam sempre "Nenhuma", os três PREs (DEV/REV/
                                    QA) ficam sempre "–" e o fallback automático de colaborador DEV/REV não é aplicado.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Com o Jira conectado, o PRE de cada grupo depende de um campo próprio, configurado
                                    em Configurações → Jira: conexão — "Estimativa do desenvolvimento" (DEV),
                                    "Estimativa da revisão" (REV) e "Estimativa dos testes" (QA) — e de a tarefa ser
                                    encontrada no Jira. Os três campos são independentes: dá para configurar só um
                                    deles (ex.: "Estimativa do desenvolvimento") e deixar os outros dois em branco —
                                    nesse caso só o PRE de DEV mostra valor real, REV e QA continuam "–" até terem seu
                                    próprio campo configurado.
                                </Typography>
                            </Box>
                        </Stack>

                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2">Fechar e reabrir o sprint</Typography>
                            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    O botão <strong>"Fechar"</strong> fica nesta tela (antes de "Informações", com
                                    confirmação); <strong>"Reabrir"</strong> fica na listagem de Sprints (ícone antes de
                                    "Editar", com confirmação) e mostra um selo "Fechado" ao lado do nome enquanto o
                                    sprint estiver fechado.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Fechar não copia nem apaga nenhum dado — só reaproveita para sempre o cache do Toggl
                                    e do Jira já salvo para este sprint: como não há mais consulta real depois de
                                    fechado, o que já estava salvo vira definitivo.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Com o sprint fechado: editar Nome/Horas por dia/Datas fica bloqueado (formulário some
                                    com todos os campos desabilitados e sem botão "Salvar"); e a consulta perde o
                                    seletor "Forçar nova consulta em:", rodando sempre sem forçar nada — se não houver
                                    cache salvo batendo com o período consultado, a consulta falha em vez de chamar o
                                    Toggl/Jira de verdade.
                                </Typography>
                                <Typography component="li" variant="body2" color="text.secondary">
                                    Reabrir só devolve a edição e a consulta normal — não mexe em nenhum cache salvo.
                                </Typography>
                            </Box>
                        </Stack>
                    </Stack>
                ) : undefined}

                {aba === 'listagem' ? (
                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Como a listagem é montada</Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            <Typography component="li" variant="body2" color="text.secondary">
                                A consulta (etapa anterior) escolhe o que forçar: "Nenhum" (padrão) reaproveita
                                o cache do Toggl e do Jira quando possível; "Toggl" força nova consulta ao Toggl
                                (Jira continua vindo do cache); "Jira" força atualização de Prioridade/Status/PRE do
                                Jira sem gastar o limite de requisições do Toggl (Toggl continua vindo do cache); e
                                "Ambos" força os dois. Mesmo sem forçar nada, se não houver cache do Toggl para o
                                período (primeira consulta), o Toggl é consultado e o Jira atualiza junto.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Cada linha é uma tarefa (linha de descrição) ou uma tag agrupada (linha de tag) — as
                                duas seguem regras de mesclagem diferentes, descritas abaixo.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                <strong>Linhas de descrição</strong>: os grupos DEV/REV/QA de uma mesma linha podem
                                vir de colaboradores diferentes — colaboradores que ocupam posições diferentes da
                                mesma descrição são mesclados numa única linha; só abrem linhas separadas quando
                                dois colaboradores disputam a mesma posição.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                <strong>Linhas de tag</strong>: cada colaborador sempre ocupa a sua própria linha —
                                nunca mescla com outro colaborador, mesmo que ocupem posições diferentes (ex.: um em
                                DEV e outro em QA da mesma tag). Todo o tempo do colaborador naquela tag vai para a
                                coluna QA (se ele tem algum apontamento QA em qualquer tarefa do sprint) ou DEV
                                (senão); REV nunca recebe agrupamento por tag.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                <strong>Fallback DEV/REV via Jira</strong> (regra crítica, não pode ser perdida): se o
                                grupo DEV de uma linha de descrição fica sem colaborador (ninguém apontou tempo
                                nele), o Sprint tenta preencher automaticamente a partir do "Responsável" (assignee)
                                da tarefa no Jira; o mesmo vale para REV a partir do campo "Revisado por" (campo
                                customizado, configurado em Configurações → Jira: Conexão). O badge exibido vem
                                sempre do mapeamento salvo em Configurações → Jira ↔ Toggl para aquele nome do Jira:
                                se o nome está vinculado a um usuário do Toggl, só preenche quando esse usuário está
                                selecionado neste sprint; se o nome é exclusivo do Jira (sem conta Toggl), usa a
                                Sigla/Cor cadastradas diretamente para ele em Jira ↔ Toggl, sem depender de nenhuma
                                seleção. Sem mapeamento para aquele nome, ou se já havia alguém no grupo, o
                                comportamento não muda — nunca sobrescreve tempo real. Esse preenchimento é uma
                                sugestão — REA fica "–" (nenhum tempo real foi apontado) e não conta na capacidade
                                nem nos totais do colaborador.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                <strong>Ordem das linhas</strong>: primeiro todas as linhas de descrição, depois
                                todas as de tag. Entre as de descrição: primeiro as que têm código "TEL - 0000"
                                reconhecido, depois as que não têm; entre as com código, por número (TEL - 994 antes
                                de TEL - 1000, comparado como número, não como texto); por fim, por descrição em
                                ordem alfabética (desempate). Entre as de tag, pela posição do primeiro colaborador
                                selecionado que aparece na linha (ordem de seleção da consulta) e depois por
                                descrição (nome da tag).
                            </Typography>
                        </Box>
                    </Stack>
                ) : undefined}

                {aba === 'colunas' ? (
                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Como ler cada coluna</Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Em qualquer linha, um grupo (DEV/REV/QA) sem colaborador aparece com "–" na coluna
                                do colaborador e "–" na situação; PRE e REA também ficam "–" quando não há valor
                                vindo do Jira/Toggl para aquele grupo (um valor real, mesmo pequeno, sempre aparece
                                como hora — ex.: "00h" para poucos minutos apontados).
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                PRE = tempo previsto, REA = tempo realizado (Toggl) — passe o mouse nos títulos das
                                colunas para ver a legenda, e nos valores para ver a hora completa. Cada grupo
                                (DEV/REV/QA) tem seu próprio campo de estimativa configurável em Configurações →
                                Jira: conexão — "Estimativa do desenvolvimento" (DEV), "Estimativa da revisão" (REV)
                                e "Estimativa dos testes" (QA); sem esse campo configurado para aquele grupo, sem
                                integração do Jira ou sem a tarefa encontrada, o PRE daquele grupo específico fica
                                "–" — os três grupos são independentes entre si. PRE e REA usam a mesma cor de destaque quando têm valor; se o tempo
                                realizado (REA) ultrapassa o PRE daquele mesmo grupo, o REA fica em vermelho (mesmo
                                tom de alerta usado no resto do Sprint) e o tooltip avisa o excesso — só ocorre
                                quando há PRE real para aquele grupo.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Prioridade e Status (badges coloridos no topo da linha) vêm do Jira quando
                                disponíveis; a cor vem do mapeamento configurado em Configurações → Jira → "Cores de
                                status e prioridade" por nome exato. Sem cor configurada, Prioridade cai numa
                                paleta fixa por severidade (Muito alta → Muito baixa); Status cai direto no mesmo
                                cinza neutro do badge "Nenhuma" (tarefa não encontrada no Jira) — sem paleta
                                intermediária por categoria de status. O texto do badge usa a cor padrão de texto do
                                tema, não branco fixo.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Nas colunas Situação por grupo (DEV/REV/QA), três situações possíveis: (1) com
                                responsabilidade por status configurada e a tarefa encontrada no Jira, se o status
                                atual pertence à responsabilidade de um dos grupos, esse grupo aparece "Pendente" e
                                os demais grupos com colaborador aparecem "Concluído"; (2) com responsabilidade
                                configurada e tarefa encontrada, mas o status atual não pertence à responsabilidade
                                de nenhum grupo (DEV/REV/QA) — todos os grupos com colaborador aparecem "Concluído";
                                (3) sem responsabilidade configurada (ou tarefa não encontrada no Jira), todo grupo
                                com colaborador aparece "Pendente", como antes. Nas linhas de tag, essa coluna sempre
                                mostra o badge "Tag" (texto colorido, sem caixa de fundo), ao contrário do badge
                                "Tag" de Prioridade/Status (caixa colorida) — mesmo nome, estilos diferentes.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                O código (TEL - 0000) é preenchido com zeros à esquerda até o tamanho do maior código
                                da lista deste sprint (o número de zeros varia conforme a listagem); linhas de tag
                                mostram um travessão "—" no lugar do código.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Quando dois colaboradores disputam a mesma posição (DEV/REV/QA) da mesma descrição, a
                                tarefa abre em linhas separadas e o código e a descrição dessas linhas ficam em
                                vermelho. Essa marcação existe só para linhas de descrição — nas linhas de tag cada
                                colaborador já tem sua própria linha por definição, então nunca há destaque de
                                duplicidade ali.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Duplo clique em qualquer ponto de uma linha (fora da caixa de seleção e do link do
                                código) abre um modal com todas as informações daquela linha de forma mais clara —
                                mesmas cores e badges da grid, mas com os valores por extenso em vez de abreviados.
                            </Typography>
                        </Box>
                    </Stack>
                ) : undefined}

                {aba === 'controles' ? (
                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Controles da tela</Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                            <Typography component="li" variant="body2" color="text.secondary">
                                O botão "Filtros" abre um painel com busca por código/descrição (primeiro campo,
                                filtra a listagem já carregada sem nova consulta) seguida de um filtro múltiplo por
                                Prioridade, Status e Colaborador; linhas de tag ficam fora quando um filtro de
                                Prioridade ou Status está ativo, pois não têm esses valores. Uma opção já
                                selecionada some da lista de opções e só volta quando é removida da seleção.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                O checkbox "Inverter filtros", entre os três filtros de seleção e o botão "Limpar",
                                inverte o efeito de Prioridade/Status/Colaborador: em vez de restringir a listagem
                                aos valores selecionados, passa a excluir as linhas que têm esses valores. A busca
                                por código/descrição nunca é afetada pela inversão — sempre inclui o que bate com o
                                texto digitado. O botão "Limpar" reseta os três filtros de seleção e a inversão.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Os cabeçalhos de Prioridade e Status podem ser clicados para ordenar a listagem
                                (ciclo: crescente → decrescente → ordem padrão do sprint, por código) — Prioridade
                                ordena por severidade (Muito alta → Muito baixa), Status por ordem alfabética. O
                                botão "Limpar ordenação" volta direto à ordem padrão, sem afetar busca ou filtros.
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Clicar (um clique) em qualquer ponto da linha (fora da caixa de seleção e do link do
                                código) apenas destaca essa linha visualmente — é só uma marcação de tela, não é
                                salva em lugar nenhum; duplo clique tem outro efeito, ver aba "Como ler cada coluna".
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                A caixa de seleção antes da Prioridade risca a descrição da linha. A marcação fica
                                salva no navegador (localStorage), é isolada por sprint (cada sprint tem a sua) e só
                                é apagada quando uma nova consulta real à API do Toggl é feita (não ao carregar do
                                cache).
                            </Typography>
                            <Typography component="li" variant="body2" color="text.secondary">
                                Dias úteis excluem sábado e domingo.
                            </Typography>
                        </Box>
                    </Stack>
                ) : undefined}
            </DialogContent>
            <DialogActions>
                <Button onClick={onFechar}>Fechar</Button>
            </DialogActions>
        </Dialog>
    );
}