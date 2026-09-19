# CLAUDE.md

Memória de contexto persistente do repositório **toggl-report**. Histórico de mudanças
fica no `git log`; este arquivo documenta só o que **não** é derivável do código:
arquitetura, regras de domínio não óbvias e decisões que não devem ser revertidas sem
motivo.

O repositório reúne **dois projetos independentes**:

- **`toggl-report-back/`** — solução **C# / .NET 10** (`TogglReport.slnx`) com dois
  projetos: **`TogglReport.Nucleo`** (biblioteca de classes, toda a lógica de negócio e
  acesso a INI, zero `PackageReference`) e **`TogglReport.Api`** (Web API Minimal APIs,
  `Microsoft.NET.Sdk.Web`, referencia o núcleo, autenticação HTTP Basic opcional). Um
  projeto console (`TogglReport.Console`) chegou a existir e foi **removido por
  completo** — não recriar sem pedido explícito.
- **`toggl-report-front/`** — React 19 + TypeScript + MUI (Vite) que consome a Web API.

Aplicação: gera relatórios de tempo trabalhado a partir da **API v9 do Toggl Track**,
com três visualizações independentes — **Relatório**, **Gráfico de Gant** e
**Sprint** — cada uma com parâmetros e cache de consulta próprios, compartilhando só a
lista de usuários e o serviço de consulta (cache-first + rate limit).

**Tudo em pt-BR**: interface, mensagens, identificadores, pastas, namespaces
(`RelatorioToggl`/`RelatorioToggl.Api`/`RelatorioToggl.Sprints`). Em inglês só o
inevitável (`Program`, `Main`, `Task`/`async`, `[JsonPropertyName]` com nomes da API do
Toggl) e siglas (`Dto`, `Api`, `Ini`, `Http`, `Toggl`). **Sem comentários** em
`TogglReport.Nucleo` (nomes claros no lugar de comentário; regras de domínio não óbvias
ficam aqui, não inline). O frontend usa comentários com moderação.

---

## 1. Conceitos centrais

- **Multiusuário**: cada usuário do Toggl tem seu API Token pessoal; o relatório
  consolida todos. `ConfiguracaoUsuarioToggl` tem `Chave`/`NomeExibicao`/`TokenApi` +
  quatro campos exclusivos da web: `Sigla` (rótulo curto), `Cor` (hex), `Selecionado`
  (`bool`, decide quem entra na **próxima consulta** de relatório/Gant/Sprint) e
  `Administrador` (`bool`, desde 2026-09-13 — marca qual usuário tem seu token usado
  em chamadas sem usuário específico, como listar tags reais do workspace do Toggl).
  **Só um `Administrador` por vez**: `ServicoUsuariosToggl.DesmarcarOutrosAdministradores`
  desmarca o anterior ao marcar um novo, no POST/PUT de `/api/usuarios-toggl` (desde
  2026-09-15).
- **Cache de consulta**: cada visualização tem seu `.ini` de cache próprio
  (`RelatorioData.ini`/`GantData.ini`/`SprintData.ini`, mesmo formato)
  guardando o retorno **cru** da última consulta por usuário. Período+usuários iguais
  → oferece carregar do cache em vez de chamar a API de novo; agrupamento/cálculo
  sempre roda em runtime (o cache nunca guarda resultado processado). Serve também de
  reserva quando o rate limit (ver §2) é atingido. `ServicoConsulta` (núcleo)
  centraliza essa decisão para as 3 visualizações — cada consumidor só decide
  **quando** chamar (parâmetro `forcarConsultaApi`).
- **Sem exportação para CSV** — dados só existem no frontend e no cache.
- **Poucas dependências**: núcleo sem nenhum `PackageReference`; API só com
  `Swashbuckle.AspNetCore` (Swagger).

---

## 2. `TogglReport.Nucleo`

```
Configuracao/    modelos + carregadores/salvadores de todos os .ini, criptografia de token,
                 parser INI compartilhado (AnalisadorIni), helpers (ServicoChaves, DiasUteis,
                 Agrupamento.EhValido), CaminhosDados (monta todos os caminhos dados/*.ini)
Gant/            CelulaGant / LinhaGant / ResultadoGant / ServicoGant.Montar
Sprint/          (namespace RelatorioToggl.Sprints, plural — evita colidir com
                 Configuracao.Sprint) CabecalhoSprint / BlocoCategoriaSprint /
                 LinhaTarefaSprint / LinhaColaboradorSprint / ResultadoSprint / ServicoSprint
Toggl/           ClienteApiToggl (HTTP Basic, api.track.toggl.com/api/v9), RegistroTempoDto,
                 ResultadoApiToggl (Ok/Falha, sem exceptions), LimitadorRequisicoes
Relatorios/      ServicoAgrupamento (por descrição/tag), LinhaDescricao, ServicoBuscaDescricao
Consultas/       ServicoConsulta (cache-first + rate limit), ResultadoConsulta,
                 EventoConsultaUsuarioToggl / StatusConsultaUsuarioToggl
Jira/            ClienteApiJira (HTTP Basic email:apiToken, normaliza a URL do domínio),
                 CampoJira, ResultadoApiJira (Ok/Falha, mesmo padrão do Toggl)
```

### Regras de domínio importantes

- **`RegistroTempoDto.Duracao`** negativo = timer em execução (isolado por
  `ServicoAgrupamento.ObterEmAndamento`, fora dos totais). Rótulos: `(sem descrição)`,
  `(sem tag)`.
- **Descrições "TEL" são normalizadas já na chave de agrupamento** (não só na
  exibição): "TEL-0000-AA" / "TEL-0000 - AA" / "TEL - 0000 - AA" viram sempre
  "TEL - 0000 - AA" antes de somar tempos (`ServicoAgrupamento.NormalizarDescricaoTel`).
  Só reformata quando há dígitos logo após "TEL" (não mexe em "TELA"/"TELEFONE").
- **Agrupamento** (relatório/Gant/Sprint): `descricao` | `tag` | `ambos`. Com
  `TagsDetalhadas`/`TagsSelecionadas` preenchidas e agrupamento "ambos": essas tags
  aparecem detalhadas por descrição e ficam fora do agrupamento por tag; as demais só
  aparecem agregadas por tag. "Por descrição" com agrupamento "descricao" puro traz
  tudo (não filtra por `TagsDetalhadas`).
- **Usuários vivem em `TogglUsuarios.ini`**, separado dos parâmetros do relatório —
  compartilhado por relatório, Gant e Sprint. `TokenApi` é **criptografado em
  repouso** (AES, chave de `CHAVE_CRIPTOGRAFIA`, fallback embutido se a env var não
  estiver configurada — proteção básica, não resiste a quem lê o código-fonte). Prefixo
  `enc:`; texto sem esse prefixo é tratado como legado e migra sozinho no próximo save.
- **Cache indexado por `Chave` de usuário** (não por `NomeExibicao`, que pode mudar).
  Bater os parâmetros exige mesmo período **e** todo usuário atual achar seu par no
  cache por `Chave` + `TokenApi`.
- **Rate limit (30 req/hora/usuário) é só em memória por processo** — reinicia a cada
  execução; não é o mesmo mecanismo do retry de 429 do `ClienteApiToggl` (esse trata o
  limite que a própria API do Toggl impõe, com `Retry-After` e 1 retry).
- **Erros da API do Toggl não usam exceptions** — `ResultadoApiToggl<T>` (Ok/Falha);
  401 reporta e pula o usuário sem abortar a consulta inteira.
- **Renomear/mudar formato de `.ini` não usa mais migração automática** (decisão de
  2026-09-15, revertendo a convenção anterior): o prefixo `Toggl` foi removido de
  a maioria dos nomes de arquivo em disco (`RelatorioParametros.ini`,
  `RelatorioData.ini`, `GantParametros.ini`, `GantData.ini`, `Sprints.ini`,
  `SprintData.ini`, `ConfiguracoesGerais.ini`, `TagsCache.ini`) com um rename manual
  único na pasta `dados/` de produção — sem código de fallback/migração no carregador.
  `TogglUsuarios.ini` manteve o prefixo de propósito (guarda usuários **do Toggl**,
  nome mais claro que só "Usuarios"). Renomear/mudar formato de `.ini` daqui pra
  frente é: trocar a constante, renomear o arquivo real manualmente, sem manter
  nenhuma lógica de compatibilidade no código.
- **Configurações gerais consolidadas em `ConfiguracoesGerais.ini`** (desde
  2026-09-15): `[Jira]`/`[SprintCategorias]`/`[SprintResponsabilidade]`/
  `[JiraTogglMapeamento]` (a 4ª, desde 2026-09-16, mapeia nome do Jira → `Chave` de
  usuário Toggl, ver bloco Jira do Sprint) são seções de um arquivo só
  (carregadores recebem só `caminhoConsolidado`; sem a seção, cada um cai no padrão
  do próprio modelo) — sem fallback de leitura para os antigos arquivos avulsos
  (`JiraConfig.ini` etc.), já migrados e apagados de produção. `TogglUsuarios.ini`/
  `JiraCores.ini` continuam separados.

### Sprint — regras de negócio (não óbvias, decididas com o usuário)

Terceira visualização, com **gestão** (CRUD de sprints) além do acompanhamento.
Arquivos próprios: `Sprints.ini` (`[Sprint:<chave>]`: Nome/HorasPorDia/DataInicio/
DataFim/**Fechado** — bool, desde 2026-09-16, default `False` via `ObterOuPadrao`
para INI antigo sem a chave, sem migração), seção `[SprintCategorias]` de
`ConfiguracoesGerais.ini` (mapeamento
**global** TAG→categoria Dev/Rev/Qa + Agrupamento + TagsDetalhadas + `CorTag` (cor do
badge/label "Tag" no Sprint, editável em Configurações → Toggl: agrupamento e tags —
sem TAG default, `Padrao()` vem vazio, `CorTag` também vem vazio; sem cor configurada,
o frontend usa `CORES.corIndisponivel` (cinza) só na exibição, nunca persiste um
default; ver §2 "Configurações gerais consolidadas"),
`SprintData.ini` (cache — **isolado por sprint** desde 2026-09-13, seções
`[Sprint:<chave>]`/`[Sprint:<chave>:Usuario:<chave>]` via `CarregadorCacheSprintIni`,
diferente do cache único/global do relatório/Gant, que bate só por período+usuários e
se sobrescreve ao trocar de período — decisão deliberada para não perder o cache de
um sprint ao consultar outro). **Não seguem** o padrão `Toggl<Domínio>Parametros/
Data.ini` do relatório/Gant — são arquivos novos, sem "nome antigo" a migrar; a
mudança de formato do cache também não migra automaticamente (não dá pra saber a que
sprint um cache no formato antigo pertencia) — só fica órfão, uma nova consulta
recria no formato novo.

**Fechar/reabrir sprint** (`DadosSprint.Fechado`, desde 2026-09-16): "Fechar" fica na
tela de Acompanhamento (`SprintView`, botão antes de "Informações", com confirmação);
"Reabrir" fica na listagem de sprints (`SprintsPanel`, ícone antes de "Editar", com
confirmação e um `Chip` "Fechado" ao lado do nome). Fechar **não copia/duplica** dado
nenhum — reaproveita o cache por sprint já existente (`SprintData.ini`/
`JiraSprintData.ini`): como uma consulta real nunca mais acontece depois de fechado,
o cache que já estava salvo vira "definitivo" só por não ser mais sobrescrito.
Reabrir só volta `Fechado` para `false`, sem mexer em cache nenhum. Efeitos do
fechamento, sempre reforçados no **backend** (nunca só no frontend, porque o estado
`origem` do hook `useConsultaSprint` não reseta ao trocar de sprint — um resíduo de
seleção anterior não pode furar a trava):
- `PUT /api/sprints/{chave}` (editar Nome/HorasPorDia/Datas) devolve 409 se
  `Fechado`; no frontend, `SprintFormDialog` já nasce com todos os campos
  `disabled` e sem botão "Salvar" quando `sprintEmEdicao.fechado` — o 409 é rede de
  segurança, não o caminho normal.
- `POST /api/sprint/consultas` carrega o sprint pela `ChaveSprint` e, se `Fechado`,
  ignora o `origem` recebido e força `"nenhum"`; se mesmo assim não houver cache do
  Toggl batendo com os parâmetros da consulta, devolve 409 em vez de cair no
  fallback de chamada real à API — nunca busca Toggl/Jira de verdade para um sprint
  fechado. No frontend, `ConsultaPanel` (prop `bloqueado`) esconde o seletor
  "Forçar nova consulta em:" e a checkbox de forçar, mostrando só um aviso.
- `Fechado`/`Reabrir` são as **únicas** formas de mudar esse campo — não dá pra
  setar via `PUT` genérico (`EditarSprintRequest` nem tem esse campo).

**Cálculo de capacidade** (`ServicoSprint.Montar`):
```
diasUteis  = dias úteis (seg–sex) em [DataInicio, DataFim] inclusive
tempoTotal = HorasPorDia * diasUteis
margem     = floor(30% * tempoTotal)
td         = floor(tempoTotal - margem)      # tempo por colaborador
ct         = td * nº de colaboradores selecionados   # capacidade total
```
Não é "70% do total" nem "70% de 70%" — só a fórmula acima é válida.

**Totalizadores do cabeçalho "Pendentes"/"Concluído"** (`CabecalhoSprint`, desde
2026-09-17): duas listas globais de status do Jira —
`ConfiguracaoStatusFinalSprint.StatusConcluido`/`StatusIgnorado` (seção
`[SprintStatusFinal]` de `ConfiguracoesGerais.ini`, editadas em Configurações →
Jira: status e cores, junto das listas DEV/REV/QA — **mutuamente exclusivas**: um
status marcado numa lista some das opções da outra na UI, e o backend rejeita com
400 se as duas chegarem com um status em comum; exibidas também, só leitura, na
etapa **Consultar** do Sprint (`ConsultaPanel`, mesmo padrão de texto de
agrupamento/tags detalhadas/categorias/responsabilidade já exibidos ali — desde
2026-09-19; antes, 2026-09-18, ficavam erradas na tela de Acompanhamento, perto dos
totalizadores). **Concluídas** = descrições distintas (nunca linha de tag) cujo `Situacao` está em
`StatusConcluido`; **Pendentes** = descrições distintas cujo `Situacao` não está em
`StatusConcluido` nem em `StatusIgnorado` — uma descrição em `StatusIgnorado` não
conta em nenhum dos dois. Sem nenhuma das duas listas preenchida (padrão), todas as
descrições contam como `Pendentes`.

**Totalizadores "Quantidade pendentes/concluídas" por colaborador**
(`LinhaColaboradorSprint`, corrigido em 2026-09-18): cálculo **independente** do
cabeçalho acima — não usa `StatusConcluido`/`StatusIgnorado`, reaproveita a mesma
classificação Pendente/Concluído **por grupo** (DEV/REV/QA) da coluna "Situação" da
grid (`GrupoResponsavelStatus`/`SituacaoSemGrupoResponsavel`, ver "Responsabilidade
por status" abaixo) — cada grupo que o colaborador ocupa numa linha de descrição
conta à parte, então DEV e REV da mesma linha podem dar resultados diferentes para
o mesmo colaborador (ex.: DEV pendente, REV concluído). Antes contava por descrição
inteira, sem olhar o grupo — bug real: dois colaboradores em grupos diferentes da
mesma linha sempre contavam igual. Linhas de tag nunca contam, nos dois
totalizadores.

**Grid de tarefas**: uma linha por `(Chave, Agrupada)`, `Chave`/`Agrupada` vindos de
`ChaveAgrupamento` (mesma regra descricao/tag/ambos do Gant, usando
`registro.Tags[0]`). Linha de descrição: `Codigo`/`Descricao` separados via regex
`^(TEL - \d+)(?: - (.+))?$`. Linha de tag: todo o tempo do colaborador vai para **um**
grupo — QA se ele tem ≥1 apontamento com tag ∈ `categorias.Qa`, senão DEV (REV nunca
recebe tag-agg).

- **Mesclagem de colaboradores só em linhas de descrição** (`Agrupada == false`):
  empacotamento guloso — cada colaborador entra na primeira linha aberta cujos slots
  Dev/Rev/Qa que ele ocupa estejam todos livres; senão abre linha nova. Dois
  colaboradores só ocupando categorias diferentes da mesma descrição mesclam numa
  linha (um por bloco); dois na **mesma** categoria ficam em linhas separadas.
- **Linhas de tag (`Agrupada == true`) nunca mesclam** — cada colaborador sempre abre
  sua própria linha, independente da posição DEV/QA (o empacotamento guloso acima só
  vale para linhas de descrição).
- Ordenação por **número do código** (`NumeroCodigo`, dígitos extraídos de `Codigo`),
  não por string — `TEL - 994 → TEL - 1000 → TEL - 1118`.
- **Prioridade/Situação/PRE vêm do Jira quando integrado** (ver bloco Jira abaixo)
  — sem integração ou issue não encontrada, badge de Prioridade e de Situação caem
  em "Nenhuma" (cinza) e PRE cai em "–" em cada grupo sem campo configurado; nunca
  editáveis nem persistidos pelo app.
- **Duplo clique numa linha da grid** abre `SprintDialogDetalheLinha` (`maxWidth`
  "md", desde 2026-09-18 — antes "sm", para caber a descrição completa) — mesmas
  cores/badges da grid, descrição sempre por completo (sem truncar — só a grid
  trunca), valores por extenso em vez de abreviados, grupos DEV/REV/QA em
  **colunas de uma `Table`** (atributo é linha, grupo é coluna — desde 2026-09-17,
  antes era uma `Stack` por grupo). Não é um padrão novo de modal, só reaproveita
  `Dialog`/`DialogTitle`/`DialogContent`/`DialogActions` do MUI, como o
  `SprintDialogInfo`. Clique no checkbox ou no link do código continua com
  `stopPropagation`, não abre o modal.
- **Descrição da grid trunca de forma responsiva** (`SprintView`/
  `SprintLinhaTarefa`, desde 2026-09-18 — antes 30 caracteres fixos,
  `truncarDescricao`, removida): sem limite de caracteres fixo — `ResizeObserver`
  no container da tabela mede a largura já ocupada pelas colunas vizinhas (fixas) e
  calcula o que sobra para a coluna Descrição a cada resize; CSS
  (`overflow:hidden`/`text-overflow:ellipsis`) corta com "…" só quando o texto não
  cabe nesse espaço, mostrando o máximo possível sem gerar rolagem horizontal.
  Tooltip da grid sempre com o texto completo.
- Frontend detecta **duplicidade visual** (`calcularColisaoPosicao`, cliente): quando
  a mesclagem abre >1 linha de descrição para a mesma `(codigo, descricao)` por dois
  colaboradores disputarem a mesma posição, Código+Descrição ficam em vermelho —
  **restrito a linhas de descrição**, nunca em linhas de tag (lá a mesclagem já não
  ocorre, então não há duplicidade a marcar).
- **Tachado (checkbox) persistido em `localStorage`**, isolado por sprint (chave
  `sprint-tachados-<chaveSprint>`), único uso de `localStorage` no projeto. Reset só em
  **nova consulta real à API** (`veioDoCache === false`), nunca ao carregar do cache.

**Integração Jira (opcional, por sprint)**: `POST /api/sprint/consultas` extrai os
códigos TEL de **todos** os registros crus do Toggl recém-buscados (independe do
`Agrupamento` configurado — usa `ServicoAgrupamento.NormalizarDescricaoTel` + o mesmo
regex de `Codigo`), busca em lote (`key in (...)`) via `ClienteApiJira.BuscarIssuesAsync`
e grava em `JiraSprintData.ini` (`[Sprint:<chave>]`, isolado por sprint — mesma ideia
do `SprintData.ini`, também isolado por sprint desde 2026-09-13, mas em arquivo
e carregador (`CarregadorCacheSprintIni`) separados). Só roda quando o Jira está
configurado e há uma consulta real (não em reaproveitamento de cache); falha de
rede/autenticação do Jira nunca quebra a consulta do Toggl. `ServicoSprint.Montar`
aplica o resultado só a linhas de descrição (nunca tag-agg): `Prioridade`/`Situacao`
da linha, e `PreHoras` de **cada** bloco DEV/REV/QA a partir de um campo customizado
do Jira próprio por grupo — `CampoEstimativaDesenvolvimentoId`, `CampoEstimativaRevisaoId`,
`CampoEstimativaTestesId` (`ConfiguracaoJira`, cada um configurável independentemente
em Configurações → Jira: conexão, mesmo mecanismo de descoberta/seleção dos campos
customizados já usado por `CampoRevisadoPorId`) — sem o campo daquele grupo
configurado, `PreHoras` fica 0. A "Estimativa original" (campo nativo
`timeoriginalestimate`) foi **removida por completo** (backend e frontend) desde
2026-09-17 — não tinha uso fora desse tooltip, não recriar sem pedido explícito.
**`GET /rest/api/3/search` foi descontinuado pelo Jira** (410 Gone) —
usar sempre `POST /rest/api/3/search/jql`. `IssueJira.UrlIssue` (`<dominio>/browse/<chave>`) vira link no Código da grid; a cor
de duplicidade é aplicada **direto no link** (`sx` do próprio `<a>`), nunca por
herança de um `TableCell` ancestral — um elemento com `color` próprio não herda do
pai mesmo com `!important` no ancestral.
- **`search/jql` pagina em blocos de até 100 issues** (`nextPageToken`/`isLast` no
  corpo da resposta — campos confirmados só ao vivo contra o Jira real, não
  documentados) — bug real já mordeu o usuário: `BuscarIssuesAsync` mandava
  `maxResults = chaves.Count` numa única chamada, e o Jira Cloud limita esse endpoint
  a 100 resultados/página independente do que é pedido, perdendo issues em silêncio
  em sprints com >100 códigos TEL (confirmado: sprint com 129 códigos, só 100 issues
  voltavam). Corrigido com loop até `isLast == true` ou `nextPageToken` vazio,
  `maxResults` fixo em 100 (nunca mais `chaves.Count`).
- **`IssueJira.Responsavel`/`RevisadoPor`**: `Responsavel` vem sempre do campo nativo
  `assignee` (não configurável); `RevisadoPor` vem de um campo customizado do Jira,
  configurável em Configurações → Jira: conexão (`ConfiguracaoJira.
  CampoRevisadoPorId`/`CampoRevisadoPorNome`, mesmo molde Id+Nome dos três campos de
  estimativa (`CampoEstimativaDesenvolvimentoId`/`CampoEstimativaRevisaoId`/
  `CampoEstimativaTestesId`, ver PRE por grupo acima) — não é hardcoded, é específico
  de cada instância Jira. `RevisadoPor` é extraído do formato "user picker" do Jira
  (`{accountId, displayName, ...}`), só o `displayName` — igual ao `assignee`.
- **Fallback DEV/REV via mapeamento Jira↔Toggl** — regra crítica, já reimplementada
  mais de uma vez em prompts anteriores; **DEV vem de `Responsavel`, REV vem de
  `RevisadoPor`, nunca o contrário**. `ConfiguracaoMapeamentoJiraToggl.Mapeamento`
  (`[JiraTogglMapeamento]` de `ConfiguracoesGerais.ini`, editável no 5º estágio do
  wizard de Configurações) é `Dictionary<string, EntradaMapeamentoJiraToggl>`
  (`displayName do Jira` → entrada) — desde 2026-09-16 cada entrada guarda
  `ChaveToggl`/`Sigla`/`Cor` (não só a chave), suportando usuários **exclusivos do
  Jira** (sem conta Toggl) com Sigla/Cor próprias. `ServicoSprint.Montar`/
  `AplicarFallbackJira` preenche o bloco **DEV** com o usuário mapeado a partir de
  `Responsavel`, e o **REV** a partir de `RevisadoPor` — regra de domínio não óbvia,
  só preenche quando **(a)** nenhuma linha daquela descrição já tem colaborador
  nesse bloco (nunca sobrescreve tempo real de ninguém) e **(b)** se a entrada tem
  `ChaveToggl`, esse usuário precisa estar entre os `usuariosSelecionados` **desta**
  consulta de sprint (deliberadamente não busca fora dos selecionados); se a
  entrada é exclusiva do Jira (sem `ChaveToggl`), usa `Sigla`/`Cor` direto, sem
  exigir seleção nenhuma. Só afeta a 1ª linha de descrição do grupo, nunca linhas
  de tag. É uma sugestão visual (0 segundos) — não conta como `ReaSegundos`/tempo
  realizado, não afeta capacidade nem `TarefasPendentes`/`Concluidas` do
  colaborador. UI de edição (Configurações → Jira ↔ Toggl): tabela de 3 colunas
  (Usuário Jira | Usuário Toggl | Sigla/Cor); Sigla/Cor de um nome exclusivo do
  Jira se edita num modal por linha.
- **`BlocoCategoriaSprint.NomeExibicao` (não `ReaSegundos`) é quem decide "tem
  colaborador" no frontend** (`SprintLinhaTarefa.tsx`, `temColaborador`) — antes do
  fallback acima existir, os dois sempre coincidiam (só havia `NomeExibicao` quando
  havia tempo real), então checar `reaSegundos > 0` "funcionava" por acidente; virou
  bug real quando o fallback passou a setar `NomeExibicao` com `ReaSegundos = 0`
  (corrigido em 2026-09-16). Nas colunas **PRE**/**REA** da grid do Sprint, valor `0`
  vindo do Jira/Toggl mostra `"–"` (mesmo padrão do badge/situação sem colaborador);
  qualquer valor real, mesmo arredondando pra baixo na exibição (`00h` para poucos
  minutos), mostra a hora normalmente — a distinção é sempre "tem valor real vindo do
  Jira/Toggl" vs. "não tem", nunca o texto exibido. Desde 2026-09-16, PRE e REA usam
  a mesma cor de destaque quando têm valor; REA fica vermelho (`corPendente`) quando
  ultrapassa o PRE daquele bloco — só quando há PRE real, nunca em REV/QA (que nunca
  têm PRE).

**Consulta do Sprint — o que forçar** (`origem: "nenhum"|"toggl"|"jira"|"ambos"`,
`POST /api/sprint/consultas`, desde 2026-09-16, default `"nenhum"`): controla o que
é **forçado** a atualizar, não "de onde vêm os dados" — os dois lados sempre podem
rodar, a diferença é se ignoram o cache. `forcarToggl = origem in ("toggl","ambos")`,
`forcarJira = origem in ("jira","ambos")`. Toggl: com `forcarToggl` sempre busca de
novo (ignora cache, como o antigo checkbox "Forçar nova consulta à API"); sem
`forcarToggl`, cache-first normal (só busca se não houver cache válido pro
período/usuários — isso pode acontecer mesmo com `origem = "nenhum"`, não é
"forçar", é a única forma de ter dado). Jira: atualiza (`AtualizarCacheJiraAsync`)
sempre que `forcarJira` for true, **ou** sempre que o Toggl tiver feito uma consulta
real (mesmo sem forçar) — preserva a regra antiga de nunca atualizar o Jira só por
reaproveitar cache do Toggl. Não existe mais bloqueio/409 para "só Jira sem cache
prévio do Toggl": nesse caso o Toggl cai no cache-first normal (busca porque não tem
cache, não porque foi forçado) e o Jira atualiza junto. Na tela (`ConsultaPanel`,
compartilhado com Relatório/Gant), o seletor de 4 opções ("Forçar nova consulta
em:") substitui o checkbox de forçar só para o Sprint — Relatório/Gant continuam
com o checkbox simples de sempre, sem esse seletor.

**Listagem do Sprint — busca, filtros e ordenação** (`SprintView.tsx`): a coluna de
status da tarefa é **"Status"** (renomeada de "Situação"; a "Situação" por bloco
DEV/REV/QA — Pendente/Concluído — continua com esse nome, é outro conceito). O
antigo botão "Buscar por descrição" foi removido — a busca por código/descrição
virou o **primeiro campo dentro do painel "Filtros"** (não é mais um recurso
independente), seguida dos filtros múltiplos de Prioridade/Status/Colaborador e,
desde 2026-09-19, **Situação (DEV/REV/QA)** — um 4º filtro, distinto do "Status"
(esse filtra o texto bruto do Jira; o novo filtra a mesma classificação
Pendente/Concluído/Tag por bloco, `situacaoGrupo` em `calculos.ts`, reaproveitada
da coluna "Situação" da grid — linhas de tag entram na comparação normalmente,
com valor "Tag"; não o `!linha.agrupada` de Prioridade/Status). **Combinado com o
Colaborador** (corrigido no mesmo dia — a 1ª versão comparava "qualquer grupo da
linha", ignorando de quem era o grupo): sem colaborador selecionado, uma linha
atende se **qualquer** grupo DEV/REV/QA com colaborador bater com a situação
escolhida; com colaborador(es) selecionado(s), só conta o(s) grupo(s) **daquele(s)
colaborador(es)** — por isso os dois filtros usam um bloco combinado dedicado
(não dois `if` encadeados) quando ambos estão preenchidos, já que inverter cada um
separadamente dá falso positivo (a linha já teria sido excluída pelo filtro de
Colaborador antes de "Inverter filtros" conseguir agir sobre a Situação). O campo
tem `helperText` dinâmico avisando qual dos dois comportamentos está ativo. Todos
sobre os dados já carregados, sem nova consulta, e, por fim, o checkbox **"Inverter
filtros"** (antes do botão "Limpar") — quando marcado, os 4 filtros de seleção
passam a **excluir** as linhas com os valores escolhidos em vez de restringir a
elas (a busca por texto nunca é afetada pela inversão, sempre inclui). Botão
"Limpar" reseta busca + filtros + inversão juntos. Ordenação clicável nos
cabeçalhos de Prioridade (por severidade) e Status (alfabética), com botão "Limpar
ordenação" separado (reseta só a ordenação) — os dois botões de reset são
deliberadamente independentes, um nunca afeta o outro. A tabela "Colaboradores"
tem um botão "+"/"–" ao lado do título que recolhe/expande a tabela inteira
(estado local, padrão expandido, não persistido). O botão "Informações" abre um
diálogo organizado em **abas** (`Tabs`/`Tab` do MUI, mesmo padrão da navegação
principal em `App.tsx`) — Capacidade, Categorias e Jira, Pré-requisitos e ciclo de
vida, Como a listagem é montada, Como ler cada coluna, Controles da tela.

**Prioridade/Situação/responsabilidade**: a API do Jira não expõe cor por prioridade
dentro da busca de issues (só no endpoint `GET /rest/api/3/priority`, que exigiria
uma chamada extra); status também não tem cor individual — só `statusCategory.key`
(`new`/`indeterminate`/`done`), capturado em
`IssueJira.SituacaoCategoria`. Por isso a cor de cada badge vem de um **mapeamento
configurável por nome exato** (`GET/PUT /api/jira/cores`, `JiraCores.ini`,
`ConfiguracaoCoresJira`/`CarregadorConfiguracaoCoresJiraIni`), alimentado pela
listagem **real** de nomes (`GET /api/jira/status`/`/prioridades`, cacheadas em
`JiraListasCache.ini`); sem cor configurada, **Prioridade** cai numa paleta fixa por
severidade (`Muito alta/Alta/Média/Baixa/Muito baixa`), mas **Status** vai direto
para o mesmo cinza (`corIndisponivel`) do badge "Nenhuma"/tarefa não localizada no
Jira — a paleta intermediária por `SituacaoCategoria` (`new`/`indeterminate`/`done`)
foi removida em 2026-09-16 (o fallback amarelo de "indeterminate" se confundia com
cor configurada de verdade). Badge de
tag usa a `CorTag` de `[SprintCategorias]` (ver acima) — configurável desde
2026-09-16, cinza (`corIndisponivel`) só como exibição quando nada foi configurado,
nunca `accentRoxo` nem um hex fixo no código.
**Responsabilidade por status** (seção `[SprintResponsabilidade]` de
`ConfiguracoesGerais.ini`, `ConfiguracaoResponsabilidadeSprint`/
`CarregadorConfiguracaoResponsabilidadeSprintIni`, mesmo molde de
`[SprintCategorias]`) mapeia status do Jira → DEV/REV/QA;
`ServicoSprint.Montar` calcula `LinhaTarefaSprint.GrupoResponsavelStatus`/
`SituacaoSemGrupoResponsavel` comparando `Situacao` a essas listas — três casos:
(1) bate com um grupo → esse grupo "Pendente", os demais (com colaborador)
"Concluído"; (2) responsabilidade configurada (pelo menos uma lista não vazia) e
tarefa encontrada no Jira, mas o status não bate com nenhuma das três listas →
`SituacaoSemGrupoResponsavel = true`, todo grupo com colaborador mostra "Concluído"
(decidido com o usuário em 2026-09-16 — antes caía no mesmo "Pendente" do caso 3,
misturando "sem responsável definido" com "não há mais nada pendente"); (3) sem
nenhuma responsabilidade configurada, ou tarefa não encontrada no Jira, todo grupo
com colaborador mostra "Pendente" (padrão antigo, preservado). Todo texto de badge
(Prioridade/Situação/TAG/`BadgeSigla`) usa a cor padrão de texto do tema
(`text.primary`), não branco fixo (`common.white`). Os badges de Prioridade/Situação
(`BadgeTexto`) têm **largura fixa** (não só mínima) com `text-overflow: ellipsis` +
`Tooltip` do nome completo — evita que um status longo do Jira alargue só a própria
badge dentro da coluna, deixando badges de tamanhos desiguais na mesma coluna.

---

## 3. `TogglReport.Api`

Minimal APIs (não Controllers), CORS `AllowAny` (uso local), `JsonStringEnumConverter`
global, Swagger em `/swagger` (título "Toggl Report API"). Sobe em
`http://localhost:5180` (porta fixa). `dados/` própria ao lado do executável.

### Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| `GET/PUT` | `/api/configuracao` | agrupamento, tags, período do relatório; `dataInicio`/`dataFim` opcionais no PUT (omitidos preservam o período salvo) |
| `GET/POST/PUT/DELETE` | `/api/usuarios-toggl` | CRUD de usuários do Toggl (inclui `administrador`); `POST .../validar-token` |
| `GET` | `/api/usuarios-toggl/tags?forcarAtualizacao=` | tags reais do workspace via token do usuário `Administrador`, cacheadas (`TagsCache.ini`) |
| `POST` | `/api/consultas` | cache-first via `ServicoConsulta`, grava `RelatorioData.ini` |
| `GET` | `/api/relatorio?dataInicio=&dataFim=` | 409 se não há cache exato p/ o período |
| `GET` | `/api/busca?termo=` | busca por descrição sobre o cache |
| `GET` | `/api/dados/download` | zip de toda a pasta `dados/` |
| `POST` | `/api/dados/restaurar` | restaura `dados/` a partir de um `.zip` |
| `GET/PUT` | `/api/gant/parametros` | parâmetros próprios do Gant; `dataInicio`/`dataFim` opcionais no PUT, mesma regra de `/api/configuracao` |
| `POST` | `/api/gant/consultas` | idem `/api/consultas`, grava `GantData.ini` |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | 409 sem cache; `termo` filtra antes de agrupar |
| `GET/POST/PUT/DELETE` | `/api/sprints` | CRUD de sprints; `PUT` devolve 409 se o sprint estiver fechado |
| `POST` | `/api/sprints/{chave}/fechar` | Marca o sprint como fechado (trava edição e consulta) |
| `POST` | `/api/sprints/{chave}/reabrir` | Marca o sprint como aberto de novo |
| `GET/PUT` | `/api/sprint/categorias` | mapeamento DEV/REV/QA + agrupamento + tags (fonte usada pela aba Configurações) |
| `GET/PUT` | `/api/sprint/responsabilidade` | mapeamento status do Jira → DEV/REV/QA |
| `GET/PUT` | `/api/sprint/status-final` | status do Jira que contam como Concluído/Ignorado nos totalizadores; `PUT` 400 se um status estiver nas duas listas |
| `POST` | `/api/sprint/consultas` | cache-first via `ServicoConsulta`; `chaveSprint` (obrigatório) isola a seção gravada em `SprintData.ini`/`JiraSprintData.ini`; `origem` (`nenhum`\|`toggl`\|`jira`\|`ambos`, default `nenhum`) escolhe o que forçar (não a fonte); sprint fechado ignora `origem` e devolve 409 se não houver cache batendo |
| `GET` | `/api/sprint?chaveSprint=` | 409 sem cache p/ o período do sprint |
| `GET/PUT` | `/api/jira/configuracao` | URL/e-mail/campo de estimativa; token sempre mascarado na resposta |
| `POST` | `/api/jira/testar-conexao` | credenciais explícitas, sem salvar (`GET /rest/api/3/myself`) |
| `POST` | `/api/jira/campos` | credenciais explícitas ou já salvas (`GET /rest/api/3/field`, só customizados) |
| `POST` | `/api/jira/issues` | busca em lote (`key in (...)`) prioridade/situação/estimativas, config salva |
| `GET` | `/api/jira/status?forcarAtualizacao=` | nomes reais de status (`GET /rest/api/3/status`), cacheados (`JiraListasCache.ini`) |
| `GET` | `/api/jira/prioridades?forcarAtualizacao=` | idem, `GET /rest/api/3/priority` |
| `GET/PUT` | `/api/jira/cores` | mapeamento configurável nome→cor por status e por prioridade (`JiraCores.ini`), usado pelas badges do Sprint |
| `GET` | `/api/jira/usuarios?forcarAtualizacao=` | nomes reais de usuários do Jira (`GET /rest/api/3/users/search`, paginado, `accountType == atlassian && active`), cacheados (`JiraListasCache.ini`) |
| `GET/PUT` | `/api/jira/usuarios-mapeamento` | mapeamento configurável `displayName` do Jira → `Chave` do usuário Toggl (`[JiraTogglMapeamento]`), alimenta o fallback DEV/REV do Sprint |

**Erros**: 400 (parâmetros/datas inválidas, agrupamento fora de
`descricao`/`tag`/`ambos`), 404 (recurso não encontrado), 409 (nome em uso; sem cache
correspondente), 500 (`Results.Problem`, falha de I/O). `GET /api/relatorio`/`/busca`/
`/gant`/`/sprint` **exigem cache prévio** — nunca disparam consulta implícita, para
manter explícito quando uma chamada HTTP externa ao Toggl acontece (rate limit).

**Jira tem duas frentes**: (1) config isolada (seção `[Jira]` de
`ConfiguracoesGerais.ini`) — URL do domínio,
e-mail, API Token (criptografado como o do Toggl) e os três campos customizados de
estimativa — Desenvolvimento/Revisão/Testes — mais "Revisado por" (todos descobertos
via `POST /api/jira/campos`, filtrado a `custom: true`); token
nunca volta em texto puro depois de salvo (`ServicoUsuariosToggl.MascararToken`,
reaproveitado); (2) integração real com o Sprint (`POST /api/jira/issues`, embutida em
`POST /api/sprint/consultas`) — busca em lote por JQL prioridade/situação/estimativas,
mais listagem real de status/prioridades + mapeamento configurável de cor (ver tabela
acima e nota de domínio do Sprint).

**`emAndamento` do relatório está em snake_case** (`workspace_id`, `duration`, etc.) —
é o `RegistroTempoDto` cru com `[JsonPropertyName]` batendo na API do Toggl; todo o
resto do contrato é camelCase.

### Autenticação HTTP Basic (opcional)

Desligada por padrão (uso local sem fricção). Liga configurando `AUTH:USUARIO`/
`AUTH:SENHA` (`AUTH__USUARIO`/`AUTH__SENHA`) — usado no deploy público (Cloud Run).
Rotas sempre livres: `/health`, `/swagger`, `/images`. **Sem `WWW-Authenticate`** na
resposta 401 de propósito — evita o popup nativo do navegador; o frontend trata com
`LoginScreen.tsx` própria (`sessionStorage`).

---

## 4. Frontend (`toggl-report-front`)

React 19 + TypeScript + MUI 9, Vite. `VITE_API_URL` configura o endereço da API
(default `http://localhost:5180`). Navegação por `Tabs`: **Configurações** (fixa,
default, primeira posição), **Relatório**, **Gant**, **Sprint** — as três últimas
`disabled` até a configuração obrigatória estar completa, cada uma com `Stepper`
próprio (Sprint tem 3 passos desde 2026-09-13: Sprints → Consultar → Acompanhamento —
a etapa "Parâmetros" foi absorvida pela aba Configurações).

**Aba Configurações** (`features/configuracoes/ConfiguracoesView.tsx`) substituiu as
antigas abas "Usuários do Toggl" e "Jira", centralizando os campos compartilhados por
Relatório/Gant/Sprint. Desde 2026-09-15 é um orquestrador simples
(`modo: 'resumo' | 'wizard'`, default `'resumo'`) entre `ConfiguracoesResumo.tsx`
(tela padrão ao abrir a aba, estilo `ConsultaPanel` — status dos 4 blocos obrigatórios
com ícone completo/incompleto e botão "Configurar") e `ConfiguracoesWizard.tsx`
(`Stepper`/`StepButton` `nonLinear`, mesmo padrão do stepper da aba Sprint, **5**
estágios desde 2026-09-16: **Usuários do Toggl** — CRUD embutido, exige ≥1
`Administrador` para avançar; **Toggl: agrupamento e tags** — inclui a cor da tag do
Sprint (`CorTag`, ver §2); **Jira: conexão** — embutido, `ConfiguracaoJiraPanel`
expõe `forwardRef`/`useImperativeHandle`; **Jira: status e cores** — Status
DEV/REV/QA + `CoresJiraPanel` (também `forwardRef`/`useImperativeHandle`) embutido,
mostra "Avançar" (não mais o último estágio); **Jira ↔ Toggl** (`MapeamentoJiraTogglPanel`,
novo 5º e último estágio) — um `Select` por nome real de usuário do Jira
(`GET /api/jira/usuarios`) escolhendo o usuário Toggl correspondente ou "sem
mapeamento" (`GET/PUT /api/jira/usuarios-mapeamento`), alimenta o fallback DEV/REV do
Sprint (ver §2); é quem mostra "Concluir", sem bloqueio adicional).
`UsuariosTogglModal.tsx`/`ConfiguracaoJiraModal.tsx` foram **removidos** — conteúdo
migrou para os estágios 1 e 3. **Nenhum estágio tem botão "Salvar" próprio** — a
barra de ações de cada estágio é sempre `[Resumo] [Voltar] [Avançar|Concluir]`
(estágio 0, sem "Voltar": `[Resumo] [Avançar]`), e todos os pontos de navegação
(Resumo, Voltar, Avançar/Concluir, e o clique direto no `StepButton` do Stepper do
topo) salvam a etapa atual antes de navegar (`salvarEtapaAtual`, centralizado em
`ConfiguracoesWizard.tsx`) — decisão de 2026-09-15/16, substituindo um botão "Voltar
ao resumo" único e incondicional que ficava fixo no topo do wizard (ver nota abaixo).
A liberação das abas Relatório/Gant/Sprint (`onAlterado`/`configuracaoCompleta`,
calculado independente do modo exibido) depende de 4 campos obrigatórios — Agrupamento,
Tags detalhadas (só exigido quando o agrupamento é "ambos"), Tags DEV/REV/QA do Toggl
e Status DEV/REV/QA do Jira — todos dentro dos estágios 2 ("Toggl: agrupamento e
tags") e 4 ("Jira: status e cores") do wizard. Usuários do Toggl (estágio 1,
cadastro/`Administrador`) e a conexão do Jira (estágio 3, URL/e-mail/token)
aparecem como blocos no resumo mas **não** entram nesse cálculo — só o mapeamento
Jira↔Toggl (estágio 5) é de fato opcional (só habilita o fallback quando
preenchido).

```bash
cd toggl-report-front && npm install && npm run dev   # :5173
npm run build   # tsc -b && vite build
```

### Estrutura

```
src/api/        fetch tipado (http.ts) + tipos espelhando os DTOs/records C#
src/features/   usuarios-toggl, jira (config isolada), configuracao, consulta
                (compartilhado), relatorio, busca, gant, sprint, dados (import/export .zip)
src/components/ peças reusadas entre features (ver lista abaixo)
src/hooks/      bases genéricas de hook (useRecurso, useRecursoEditavel, useColecaoCrud,
                useNotificacao, useExpansao)
src/utils/      duracao.ts (HHhMMmSSs), datas.ts, rotulos.ts, texto.ts, tipografia.ts
theme.ts        tema MUI único, claro — CORES exportado (paleta central)
App.tsx         Tabs + Steppers + estado elevado (configuracao/configuracaoGant/parametrosSprint)
```

**Componentes compartilhados a preferir antes de duplicar**: `BadgeSigla` (tooltip
com nome completo via `nome`, texto na cor padrão do tema (`text.primary`),
replicado no `<Chip>` do Gant; cantos retos por padrão, arredondado (`borderRadius: 1`) em três
lugares: listagem de Usuários do Toggl, `AccordionSummary` do Relatório e tabela
"Colaboradores" do Sprint — grid DEV/REV/QA e grade do Gant seguem quadrados;
`ConsultaPanel` mostra "usuários selecionados" inline, sem tabela/grid),
`SelectListaCacheada` (seleção, não digitação, sobre listagem real cacheada — tags do
Toggl/status do Jira, substituiu `CampoTags`, removido), `MapaCoresLista` (grade de
color pickers por nome real, usado pelo mapeamento de cores do Jira),
`SelectAgrupamento`, `CabecalhoView`, `MarcaTogglReport` (logo+wordmark), `AvisoCache`,
`EsqueletoCarregando`, `DialogoConfirmacao`, `ParametrosFormBase` (hoje só o período —
Agrupamento/Tags saíram para a aba Configurações), `IconeAjuda`
(ícone `HelpOutlined` + `Tooltip`, usado como `endAdornment` de `TextField` — API
Token do Toggl e os três campos da config do Jira).

### Decisões técnicas importantes

- **`fetch` nativo com wrapper tipado** (`src/api/http.ts`), não axios; erros da API
  são strings simples (`ErroApi`).
- **Zero `any`**; sem `enum` do TS (`erasableSyntaxOnly`) — usar union de strings
  literais.
- **Download/upload de `dados/` via `fetch` autenticado + blob**, nunca `<a href>`
  direto — um link de navegação normal não carrega a credencial Basic Auth (a API não
  usa cookie/sessão de propósito).
- **Curadoria de exibição "TEL primeiro" é replicada aqui** (`curarPorDescricao`),
  simetria com a normalização do núcleo — o backend não ordena, só agrupa.
- **Seleção de usuário para consulta não é um passo do wizard** — vem do campo
  `Selecionado` de cada usuário (aba "Usuários do Toggl"), refletido como lista somente-leitura
  em `ConsultaPanel`.
- **`localStorage` só é usado em `features/sprint/tachados.ts`** (tachado de linhas,
  isolado por sprint) — não usar para mais nada sem necessidade equivalente.

### Tema

Tema único claro (`theme.ts`) — um tema escuro chegou a ser implementado e foi
**removido por completo** a pedido do usuário; não reintroduzir sem pedido explícito.
`CORES` é a paleta central (exportada) — nenhuma cor hex deve ficar solta fora de
`theme.ts`. `error` é propositalmente o vermelho padrão do MUI (não sobrescrever).

---

## 5. Convenções

**C# (núcleo/API)**: tipo explícito no lugar de `var`; sem comentários no núcleo
(regra de domínio não óbvia documenta-se aqui); antes de duplicar uma checagem/loop,
ver se há helper em `Configuracao/` (`ServicoChaves`, `DiasUteis`, `Agrupamento.
EhValido`, `AnalisadorIni.Escrever`/`DividirLista`) ou `Api/Endpoints/`
(`ValidacaoDatas`, `TratamentoIo`); fluxos de erro esperados usam
`ResultadoApiToggl<T>`, nunca exceptions; `end_of_line = crlf`, UTF-8 sem BOM;
`dotnet build TogglReport.slnx` deve ficar em **0 warnings**.

**TypeScript/React**: zero `any`; sem `enum` do TS; estrutura por feature; tipos de
request/response em `src/api/tipos.ts` devem espelhar exatamente os DTOs/records C#
— ao mudar um endpoint, atualizar os dois lados; `npm run build` limpo antes de dar
por pronta uma mudança.

---

## 6. Notas rápidas (gotchas)

- **Depois de mudar `TogglReport.Nucleo`, reiniciar o `TogglReport.Api.exe` em
  execução** — o processo trava o próprio `.dll`, e um `dotnet build` que falha só com
  `MSB3026`/`MSB3027` (erro de cópia, não `error CS...`) é esse processo travando o
  arquivo, não um bug de código.
- **Padrões do `.gitignore` para pastas devem ser ancorados com `/` na frente**
  (`/dados/`, `/certificado/`) — sem a barra, o padrão bate em qualquer pasta com esse
  nome em qualquer profundidade, o que já ignorou silenciosamente código-fonte legítimo
  dentro de `toggl-report-front/src/features/dados/`.
- **Nomenclatura "Gant" (um "t" só)** é a correta neste projeto, não "Gant".
- **Mudar a chave padrão embutida de `CHAVE_CRIPTOGRAFIA` rotaciona a criptografia** —
  `.ini` com tokens `enc:` gravados sem a env var configurada precisam ser
  reinseridos após isso.
- Todo `.ini` novo com dado sensível (token) ou de cache precisa entrar no
  `.gitignore`/`.dockerignore` (raiz + `toggl-report-back/`).
- **`http.ts` precisa extrair a mensagem de erro de `ProblemDetails`, não só de
  string simples** — `Results.Problem(mensagem, status)` (ex.: 502 de
  `/api/usuarios-toggl/tags`) devolve um corpo `{type,title,status,detail}`; sem
  `extrairMensagemDeProblemDetails` lendo `detail`/`title`, a UI mostra só
  `resposta.statusText` genérico (ex. "Bad Gateway"), escondendo a causa real.
- **Tags reais do Toggl** usam o token do usuário `Administrador` em `GET /me`; o campo de workspace da resposta é `default_workspace_id` (snake_case). Contas do Toggl com múltiplos workspaces podem devolver esse campo `null` mesmo com token válido (200) — desde 2026-09-15, `ClienteApiToggl.ObterTagsAsync` cai para `GET /workspaces` e usa o primeiro da lista nesse caso, só falhando se a lista vier vazia. `MapaCoresLista` mantém status/prioridades em grade compacta uniforme (swatch fixo de 24px, nome ao lado). Navegação do wizard de Configurações: ver §4 (4 pontos de navegação por estágio, não um botão único no topo — revertido em 2026-09-15/16).

---

## 7. Projeto irmão

`C:\Projetos\gerador-chave-nfe` segue as mesmas convenções de estilo (pt-BR, sem
`var`, zero dependências, .NET 10), mas é só um console — sem Web API/frontend, não
espelha §3–§4. O `CLAUDE.md` de cada repositório é a fonte da verdade daquele projeto.