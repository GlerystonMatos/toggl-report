# toggl-report-back

[← voltar ao README principal](../README.md)

Dois projetos **C# / .NET 10** na mesma solução (`TogglReport.slnx`):

| Projeto | Tipo | O que é |
|---|---|---|
| [`TogglReport.Api/`](#web-api-togglreportapi) | Web API (Minimal APIs) | Expõe as funcionalidades da aplicação por HTTP, com autenticação HTTP Basic opcional |
| [`TogglReport.Nucleo/`](#núcleo-compartilhado-togglreportnucleo) | Biblioteca de classes | Modelos, acesso a INI e regras de negócio comuns |

A Web API consulta o Toggl Track, faz cache do retorno cru em arquivos `.ini` dentro de uma pasta `dados/` (ao lado do executável) e agrupa/busca sobre esse dado em runtime — toda a regra de negócio vive em `TogglReport.Nucleo`, referenciado pela API.

## Índice

- [toggl-report-back](#toggl-report-back)
  - [Índice](#índice)
  - [Requisitos](#requisitos)
  - [Compilar a solução](#compilar-a-solução)
  - [Como obter seu API Token do Toggl](#como-obter-seu-api-token-do-toggl)
  - [Como obter seu API Token do Jira](#como-obter-seu-api-token-do-jira)
  - [Núcleo compartilhado (`TogglReport.Nucleo`)](#núcleo-compartilhado-togglreportnucleo)
  - [Web API (`TogglReport.Api`)](#web-api-togglreportapi)
    - [Como rodar](#como-rodar)
    - [Endpoints](#endpoints)
    - [Exemplos de request/response](#exemplos-de-requestresponse)
    - [Gráfico de Gant](#gráfico-de-Gant)
    - [Sprint](#sprint)
    - [Jira](#jira)
    - [Decisões desta camada](#decisões-desta-camada)
  - [Estrutura de arquivos](#estrutura-de-arquivos)
  - [Segurança](#segurança)
  - [Limitações conhecidas](#limitações-conhecidas)

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) ou superior
- Um **API Token** pessoal do Toggl Track para cada usuário que você queira incluir no relatório ([como obter](#como-obter-seu-api-token-do-toggl))
- Opcional: um **API Token** do Jira Cloud, só se for usar a aba Jira ([como obter](#como-obter-seu-api-token-do-jira))

## Compilar a solução

```bash
cd toggl-report-back
```

```bash
dotnet build TogglReport.slnx
```

Compila os dois projetos (`TogglReport.Api`, `TogglReport.Nucleo`) de uma vez. `0 warnings` é o padrão esperado.

---

## Como obter seu API Token do Toggl

1. Acesse [track.toggl.com](https://track.toggl.com/) e faça login.
2. Vá em **Profile Settings** (ícone de perfil no canto).
3. Role até o final da página — o **API Token** está lá.
4. Copie e cole no formulário de usuários do frontend.

---

## Como obter seu API Token do Jira

1. Acesse [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) logado com a conta Atlassian usada no seu Jira Cloud.
2. **Create API token**, dê um nome (ex.: "toggl-report") e copie o valor exibido — ele não aparece de novo depois.
3. Cole na aba **Jira** do frontend junto com a URL do domínio (`empresa.atlassian.net`) e o e-mail da mesma conta.

---

## Núcleo compartilhado (`TogglReport.Nucleo`)

Biblioteca de classes referenciada pelo `TogglReport.Api`. Contém **tudo que não depende de HTTP**, isolando toda a regra de negócio numa camada só:

| Pasta | Conteúdo |
|---|---|
| `Configuracao/` | `ConfiguracaoApp`/`ConfiguracaoUsuarioToggl` (modelo do `[Geral]` de `RelatorioParametros.ini` + usuários em memória, inclui `Administrador`), `CarregadorConfiguracaoIni` (agrupamento/tags/período), `CarregadorUsuariosTogglIni` (`TogglUsuarios.ini` — usuários/tokens, compartilhado com o Gant), `CriptografiaToken` (AES do `TokenApi`), `CacheConsulta`/`UsuarioTogglCacheado` (modelo do `RelatorioData.ini`), `CarregadorCacheIni` (cache único do relatório/Gant), `CarregadorCacheSprintIni` (mesmo `CacheConsulta`, mas isolado por sprint em `SprintData.ini`), `AnalisadorIni` (parser de INI compartilhado — `Analisar`/`ObterOuPadrao`/`ObterOuNulo` + `Escrever` (grava UTF-8 sem BOM, criando a pasta) e `DividirLista` (split de lista separada por vírgula)), `CaminhosDados` (monta os caminhos `dados/*.ini` a partir do diretório base de quem chama, incluindo `CaminhoConfiguracoesGerais` → `dados/ConfiguracoesGerais.ini`), `ServicoUsuariosToggl` (gerar chave única, checar nome em uso, mascarar token, `DesmarcarOutrosAdministradores` — garante um só `Administrador` por vez), `CarregadorConfiguracaoJiraIni`/`CarregadorConfiguracaoCategoriasSprintIni`/`CarregadorConfiguracaoResponsabilidadeSprintIni` (cada um lê/grava sua seção de `ConfiguracoesGerais.ini` — ver [Segurança](#segurança)), `ServicoChaves` (`GerarChaveUnica` compartilhado por `ServicoUsuariosToggl`/`ServicoSprints`), `DiasUteis` (`Entre(inicio, fim)` — dias seg–sex, base do `ServicoGant`/`ServicoSprint`), `Agrupamento` (`EhValido` — `descricao`/`tag`/`ambos`, usado pelos 3 endpoints de parâmetros) |
| `Toggl/` | `ClienteApiToggl` (HTTP Basic contra `api.track.toggl.com/api/v9`, inclui `ObterTagsAsync` — resolve o workspace via `GET /me` (`default_workspace_id`) e, se vier `null` (conta com múltiplos workspaces), cai para `GET /workspaces` e usa o primeiro da lista, antes de listar `GET /workspaces/{id}/tags`), `RegistroTempoDto`, `ResultadoApiToggl`, `LimitadorRequisicoes` (limite de 30 req/hora, em memória, por processo) |
| `Relatorios/` | `ServicoAgrupamento` (por descrição/tag, normalização "TEL"), `LinhaDescricao`, `ServicoBuscaDescricao`, `LinhaBusca`, `ResultadoBuscaDescricao` — tudo puro, devolve dados, nunca texto formatado |
| `Consultas/` | `ServicoConsulta` — decide cache×API e aplica o rate limiter; `ResultadoConsulta`, `EventoConsultaUsuarioToggl`, `StatusConsultaUsuarioToggl` |

`ServicoConsulta` é o ponto mais importante: a Web API chama sempre os mesmos métodos (`CarregarCacheSeExistente`, `CacheCorrespondeAosParametros`, `CarregarRegistrosDoCache`, `ConsultarUsuariosAsync`, `SalvarCache`) — cada endpoint decide **quando** chamar cada um (via um parâmetro de requisição, `forcarConsultaApi`), mas a regra em si (o que conta como "mesmo período/usuários", quando usar cache, como tratar o rate limit) existe em um único lugar.

Este projeto **nunca** referencia tipos de apresentação HTTP (`Endpoints/`, `Dtos/`) — só lógica pura e acesso a arquivo.

---

## Web API (`TogglReport.Api`)

API HTTP local (Minimal APIs, ASP.NET Core), com autenticação HTTP Basic **opcional** (desligada por padrão, ver [Segurança](#segurança)) — expõe as funcionalidades da aplicação para consumo do [frontend](../toggl-report-front/README.md) ou de qualquer outro cliente HTTP local.

### Como rodar

```bash
dotnet run --project TogglReport.Api
```

Sobe em `http://localhost:5180` (porta fixa, `Properties/launchSettings.json`). Swagger/OpenAPI em **`http://localhost:5180/swagger`** — documenta todos os endpoints com parâmetros, respostas e exemplos, sem exigir autenticação para navegar. Quando `AUTH__USUARIO`/`AUTH__SENHA` estão configurados, o Swagger ganha um botão **"Authorize"** (esquema HTTP Basic) — informe as credenciais uma vez e as chamadas de teste feitas na própria UI já saem autenticadas.

Cria sua pasta `dados/` (ao lado do executável da API), com `RelatorioParametros.ini`/`TogglUsuarios.ini`/`RelatorioData.ini` e seu próprio contador de rate limit em memória.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/configuracao` | Agrupamento, tags detalhadas e último período salvos |
| `PUT` | `/api/configuracao` | Atualiza agrupamento/tags/período; preserva os usuários já cadastrados. `dataInicio`/`dataFim` são opcionais desde 2026-09-13 — omitidos, preservam o período já salvo (usado pela aba Configurações para atualizar só agrupamento/tags sem mexer no período do Relatório) |
| `GET` | `/api/usuarios-toggl` | Lista usuários do Toggl cadastrados (token mascarado, inclui `administrador`) |
| `POST` | `/api/usuarios-toggl` | Cadastra um usuário do Toggl (valida o token por padrão); marcar `administrador: true` desmarca automaticamente qualquer outro administrador existente |
| `PUT` | `/api/usuarios-toggl/{chave}` | Edita nome de exibição, token e/ou `administrador` de um usuário do Toggl; `tokenApi` omitido/vazio mantém o já salvo; marcar `administrador: true` desmarca automaticamente qualquer outro administrador existente (só pode haver um por vez) |
| `DELETE` | `/api/usuarios-toggl/{chave}` | Remove um usuário do Toggl cadastrado |
| `POST` | `/api/usuarios-toggl/validar-token` | Valida um API Token de usuário do Toggl, sem salvar |
| `GET` | `/api/usuarios-toggl/tags?forcarAtualizacao=` | Lista as tags reais do workspace do Toggl (`GET /me` para ler `default_workspace_id`, com fallback para `GET /workspaces` — usa o primeiro da lista — quando esse campo vem `null`, seguido de `GET /workspaces/{id}/tags`), usando o token do usuário marcado como `administrador`; cacheada em `TagsCache.ini` até `forcarAtualizacao=true`; 400 se nenhum usuário é administrador |
| `POST` | `/api/consultas` | Consulta o Toggl (cache-first, respeita o rate limit); salva o retorno cru |
| `GET` | `/api/relatorio?dataInicio=&dataFim=` | Relatório agrupado a partir dos dados em cache |
| `GET` | `/api/busca?termo=` | Busca por descrição sobre os dados em cache |
| `GET` | `/api/dados/download` | Baixa a pasta `dados/` inteira compactada em `dados.zip` (todos os arquivos presentes no momento, sem lista fixa) |
| `POST` | `/api/dados/restaurar` | Restaura a pasta `dados/` a partir de um `.zip` enviado (`multipart/form-data`, campo `arquivo`) — `ExtractToDirectory(overwriteFiles: true)`: sobrescreve **só** os arquivos presentes no `.zip` (os demais, inclusive os caches de consulta, ficam intactos), criando a pasta se ainda não existir. Serve tanto para o primeiro uso quanto para reimportar sobre dados já existentes (o frontend tem um botão no rodapé, ver README do front). Nenhuma invalidação de cache está atrelada à importação. 400 se algum arquivo do zip estiver dentro de uma pasta (deve compactar o **conteúdo** de `dados/`, não a pasta em si); 500 com mensagem limpa em qualquer outra falha de I/O |
| `GET` | `/api/gant/parametros` | Período, tags a detalhar e agrupamento do **Gant** (independente do relatório) |
| `PUT` | `/api/gant/parametros` | Atualiza os parâmetros do Gant — valida `agrupamento` (400 se fora de `descricao`/`tag`/`ambos`); `dataInicio`/`dataFim` opcionais desde 2026-09-13, mesma regra de `/api/configuracao` |
| `POST` | `/api/gant/consultas` | Igual a `/api/consultas`, mas grava em `GantData.ini` |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | Gant agrupado por usuário/categoria/descrição, dia a dia (só dias úteis); `termo` filtra por descrição |
| `GET` | `/api/sprints` | Lista os sprints cadastrados (inclui `Fechado`) |
| `POST` | `/api/sprints` | Cadastra um sprint (`Nome`, `HorasPorDia`, `DataInicio`, `DataFim`) — 400 (nome vazio, datas inválidas, `fim < inicio`, `HorasPorDia <= 0`) / 409 (nome em uso); nasce `Fechado = false` |
| `PUT` | `/api/sprints/{chave}` | Edita um sprint (campos `null`/vazios não alteram) — 409 se o sprint estiver fechado |
| `DELETE` | `/api/sprints/{chave}` | Remove um sprint |
| `POST` | `/api/sprints/{chave}/fechar` | Marca `Fechado = true`; trava edição e faz `/api/sprint/consultas` sempre usar o cache |
| `POST` | `/api/sprints/{chave}/reabrir` | Marca `Fechado = false`; libera edição e consulta real de novo |
| `GET` | `/api/sprint/categorias` | Parâmetros do Sprint: mapeamento global TAG → categoria + agrupamento + tags detalhadas + cor da tag: `{ dev, rev, qa: string[], agrupamento: string, tagsDetalhadas: string[], corTag: string }` — sem arquivo/chave, as listas e `corTag` vêm vazios e `agrupamento = "ambos"` |
| `PUT` | `/api/sprint/categorias` | Atualiza os parâmetros (normaliza as listas: trim + distinct case-insensitive + descarta vazias; valida `agrupamento` contra `descricao`/`tag`/`ambos`, 400 se inválido). `ServicoSprint.Montar` consome os dois na chave de agrupamento da grid (por descrição ou por tag, regra do `ServicoGant`) |
| `GET/PUT` | `/api/sprint/responsabilidade` | Mapeamento global de status do Jira por grupo responsável (`{ statusDev, statusRev, statusQa: string[] }`), mesmo molde de `/api/sprint/categorias`. Seção `[SprintResponsabilidade]` de `ConfiguracoesGerais.ini` |
| `GET/PUT` | `/api/sprint/status-final` | Mapeamento global de status do Jira usados nos totalizadores Pendentes/Concluídas do Sprint (`{ statusConcluido, statusIgnorado: string[] }`), desde 2026-09-17. `PUT` normaliza as listas (trim + distinct case-insensitive) e devolve 400 se o mesmo status aparecer nas duas. Seção `[SprintStatusFinal]` de `ConfiguracoesGerais.ini` |
| `POST` | `/api/sprint/consultas` | Igual a `/api/consultas`, mas grava a seção do sprint em `SprintData.ini` (`chaveSprint` obrigatório no corpo, `CarregadorCacheSprintIni`); também atualiza a seção do sprint em `JiraSprintData.ini` (prioridade/situação/estimativas) quando o Jira está configurado. `origem` (`nenhum`\|`toggl`\|`jira`\|`ambos`, default `nenhum`) escolhe o que **forçar** a atualizar, não a fonte — sprint fechado ignora `origem`, sempre usa `"nenhum"`, e devolve 409 se não houver cache batendo com os parâmetros (nunca chama o Toggl/Jira de verdade) |
| `GET` | `/api/sprint?chaveSprint=` | Acompanhamento do sprint: capacidade + card de colaboradores + grid com uma linha por descrição/tag (só em linhas de descrição, colaboradores de categorias diferentes mesclam numa linha só; linhas de tag nunca mesclam); 409 se não há consulta salva para o período do sprint |
| `GET` | `/api/jira/configuracao` | URL do domínio, e-mail, os três campos de estimativa (desenvolvimento/revisão/testes), o campo "revisado por" e token mascarado (`****` se nunca configurado) |
| `PUT` | `/api/jira/configuracao` | Salva a configuração; `apiToken` omitido/vazio mantém o já salvo (400 se nunca houve um) |
| `POST` | `/api/jira/testar-conexao` | Testa `email`/`urlDominio`/`apiToken` informados **sem salvar** (`GET /rest/api/3/myself`) — sempre `200` com `{ sucesso, mensagem }` |
| `POST` | `/api/jira/campos` | Lista os campos **customizados** do Jira (`GET /rest/api/3/field`, filtra `custom: true`, ordena por nome); credenciais no corpo são opcionais — se omitidas, usa a configuração já salva (400 se nenhuma das duas existir) |
| `POST` | `/api/jira/issues` | Busca em lote (JQL `key in (...)`, `POST /rest/api/3/search/jql`, paginando em blocos de até 100 issues via `nextPageToken`/`isLast`) prioridade, situação, as três estimativas por grupo — desenvolvimento/revisão/testes (campos customizados configurados individualmente), responsável (`assignee`, nativo) e revisado por (campo customizado configurável); usa sempre a configuração já salva; issue não encontrada só fica ausente do resultado, nunca gera erro |
| `GET` | `/api/jira/status?forcarAtualizacao=` | Lista os nomes reais de status do Jira (`GET /rest/api/3/status`); cacheada em `JiraListasCache.ini` até `forcarAtualizacao=true`; 400 se a configuração do Jira não está salva |
| `GET` | `/api/jira/prioridades?forcarAtualizacao=` | Idem, para `GET /rest/api/3/priority` |
| `GET/PUT` | `/api/jira/cores` | Mapeamento configurável de cor (hex) por nome de status e por nome de prioridade (`{ coresStatus, coresPrioridade }`, ambos `Record<string,string>`), persistido em `JiraCores.ini`; usado pelo Sprint para colorir as badges de Situação/Prioridade no lugar da paleta fixa quando o nome tem cor configurada |
| `GET` | `/api/jira/usuarios?forcarAtualizacao=` | Lista os nomes reais de usuários da instância Jira (`GET /rest/api/3/users/search`, paginado, filtra `accountType == "atlassian" && active == true`); cacheada em `JiraListasCache.ini` até `forcarAtualizacao=true`; 400 se a configuração do Jira não está salva |
| `GET/PUT` | `/api/jira/usuarios-mapeamento` | Mapeamento configurável `displayName` do Jira → `Chave` de usuário Toggl (`{ mapeamento: Record<string,string> }`), persistido em `[JiraTogglMapeamento]` de `ConfiguracoesGerais.ini`; alimenta o fallback DEV/REV do Sprint (ver seção Sprint) |

### Exemplos de request/response

**`POST /api/consultas`**
```json
// Request
{ "dataInicio": "2026-08-01", "dataFim": "2026-08-31", "forcarConsultaApi": false }

// Response 200
{
  "dataInicio": "2026-08-01", "dataFim": "2026-08-31", "veioDoCache": true,
  "usuarios": [
    { "nomeUsuario": "Joao Silva", "status": "Sucesso", "mensagem": null, "quantidadeRegistros": 12 }
  ]
}
```
`status` é sempre uma string: `Sucesso`, `Erro`, `LimiteAtingidoComCache` ou `LimiteAtingidoSemCache`.

**`GET /api/relatorio?dataInicio=2026-08-01&dataFim=2026-08-31`** — 409 se não houver consulta salva para esse período exato (chame `POST /api/consultas` primeiro); 200 com, por usuário, `porDescricao` (cada item traz `descricao`, `segundos` e `tag`), `porTag`, `emAndamento` e `totalSegundos`. **Atenção**: os itens de `emAndamento` vêm em **snake_case** (`workspace_id`, `project_id`, `description`, `duration`, `start`, `stop`) — é o DTO cru reaproveitado do Toggl, diferente do resto da API que é camelCase.

No frontend, cada usuário do Relatório é uma **tabela** (`[checkbox] · Tag · Descrição · Tempo`), com as linhas por descrição e depois as por tag concatenadas, sem títulos de seção; a `tag` fica em coluna própria e a descrição aparece crua (sem prefixo).

**`GET /api/busca?termo=reuniao`** — 409 se não há cache ainda; 200 com `linhas` (descrição, segundos por usuário, total da linha) e `totalGeralSegundos`.

### Gráfico de Gant

`/api/gant/*` é um segundo fluxo, com parâmetros (`ConfiguracaoGant`: período + tags a detalhar + agrupamento) e cache (`dados/GantData.ini`) **independentes** do relatório — reaproveita a mesma lista de usuários e o mesmo `ServicoConsulta`, só troca o arquivo de cache. `GET /api/gant` devolve `{ dias, linhas }`: `dias` são só os **dias úteis** do período (sábado/domingo ocultos); cada linha pertence a um único usuário, agrupada por categoria (tag) + descrição — tags na lista "a detalhar" viram uma linha por descrição, as demais ficam agregadas numa única linha por tag. O parâmetro opcional `termo` filtra por descrição antes de agrupar (mesma rota, sem endpoint novo). No frontend, a tabela do Gant mostra a descrição **truncada em 50 caracteres** com um _tooltip_ da descrição completa.

Os usuários têm quatro campos próprios (persistidos no `TogglUsuarios.ini`): `sigla`/`cor` (identificação visual nas células do Gant), `selecionado` (`bool`, default `true` — só usuários selecionados entram na próxima consulta, seja do relatório ou do Gant) e `administrador` (`bool`, default `false`, desde 2026-09-13 — marca qual usuário do Toggl tem seu token usado nas chamadas que não são de uma pessoa específica, como `GET /api/usuarios-toggl/tags`; cada usuário já tinha seu próprio token pessoal para as consultas normais). Desde 2026-09-15, só pode haver **um** `administrador` por vez: `ServicoUsuariosToggl.DesmarcarOutrosAdministradores` desmarca o anterior automaticamente sempre que um novo é marcado (POST/PUT de `/api/usuarios-toggl`).

### Sprint

`/api/sprints` e `/api/sprint/*` são a terceira visualização, molde do Gant. Diferente do relatório e do Gant, tem **gestão** (CRUD de sprints) além do acompanhamento. Cada sprint tem `Nome`, `HorasPorDia`, `DataInicio` e `DataFim` próprios; um mapeamento **global** (não por sprint) de TAG → categoria (`Dev`/`Rev`/`Qa`); e cache de consulta dedicado. Arquivos em `dados/` (todos no `.gitignore`/`.dockerignore`):

| Arquivo | Conteúdo |
|---|---|
| `Sprints.ini` | seções `[Sprint:<chave>]` — `Nome`, `HorasPorDia` (decimal, `InvariantCulture`), `DataInicio`, `DataFim` (`yyyy-MM-dd`), `Fechado` (bool, desde 2026-09-16, default `False` para INI antigo sem a chave) |
| `ConfiguracoesGerais.ini` — seção `[SprintCategorias]` | `Dev`/`Rev`/`Qa` = listas de tags separadas por vírgula, mais `Agrupamento` (`descricao`/`tag`/`ambos`), `TagsDetalhadas` (lista de tags) e `CorTag` (hex da cor do badge/label "Tag" no Sprint, desde 2026-09-16) da etapa "Toggl: agrupamento e tags" do wizard de Configurações. `Carregar` nunca devolve `null`: sem arquivo/seção cai no padrão, que **não tem nenhuma TAG nem cor** — `Dev`/`Rev`/`Qa`/`TagsDetalhadas`/`CorTag` vazios, só `Agrupamento = ambos`; sem `CorTag` configurada, o frontend usa cinza (`corIndisponivel`) só na exibição, nunca grava um valor default. O wizard obriga o usuário a preencher DEV/REV/QA antes de avançar. `ServicoSprint.Montar` usa `Agrupamento`/`TagsDetalhadas` para decidir a chave de linha da grid (descrição normalizada ou nome da tag), mesma regra do `ServicoGant`. Consolidada desde 2026-09-15 (antes, arquivo próprio `TogglSprintCategorias.ini`, seção `[Geral]`) |
| `SprintData.ini` | cache de consulta — dado cru, token criptografado, **isolado por sprint** desde 2026-09-13 (seções `[Sprint:<chave>]`/`[Sprint:<chave>:Usuario:<chave>]` via `CarregadorCacheSprintIni`), diferente do `RelatorioData.ini`/`GantData.ini` (cache único, bate só por período+usuários — trocar de período sobrescreve). Sem migração automática do formato antigo: um cache salvo antes dessa mudança fica órfão (o formato antigo não guardava a chave do sprint), uma nova consulta recria no formato novo |
| `ConfiguracoesGerais.ini` — seção `[SprintResponsabilidade]` | `StatusDev`/`StatusRev`/`StatusQa` = listas de nomes de status do Jira separadas por vírgula (mesmo molde de `[SprintCategorias]`, `Padrao()` vazio). Opcional — sem nenhuma lista preenchida (ou tarefa não encontrada no Jira), `ServicoSprint.Montar` cai no comportamento anterior (todo grupo com colaborador mostra "Pendente"); com pelo menos uma lista preenchida e tarefa encontrada mas o status não bate com nenhuma das três, todo grupo com colaborador mostra "Concluído" (`LinhaTarefaSprint.SituacaoSemGrupoResponsavel`, desde 2026-09-16 — antes confundia esse caso com "sem responsabilidade configurada"). Consolidada desde 2026-09-15 (antes, arquivo próprio `TogglSprintResponsabilidade.ini`, seção `[Geral]`) |
| `ConfiguracoesGerais.ini` — seção `[SprintStatusFinal]` | `StatusConcluido`/`StatusIgnorado` = listas de nomes de status do Jira separadas por vírgula (mesmo molde de `[SprintCategorias]`/`[SprintResponsabilidade]`, `Padrao()` vazio), desde 2026-09-17 — controlam os totalizadores Pendentes/Concluídas do cabeçalho e de cada colaborador (ver abaixo). Mutuamente exclusivas: `PUT /api/sprint/status-final` devolve 400 se o mesmo status aparecer nas duas. Opcional; sem nenhuma lista preenchida, o comportamento é idêntico ao anterior à sua existência. Nasceu direto no arquivo consolidado, sem arquivo legado próprio a migrar |

**Fechar/reabrir sprint** (`DadosSprint.Fechado`, desde 2026-09-16): `POST /api/sprints/{chave}/fechar` marca `Fechado = true`; `POST /api/sprints/{chave}/reabrir` volta para `false` — nenhum dos dois mexe em cache, só reaproveitam `CarregadorSprintsIni.Salvar`. Fechar não "congela" dado nenhum ativamente: como `POST /api/sprint/consultas` para de aceitar consulta real nesse sprint, o que já estava salvo em `SprintData.ini`/`JiraSprintData.ini` simplesmente nunca mais é sobrescrito. Dois pontos de trava, sempre no backend (o frontend também bloqueia a UI, mas isso é só UX — a garantia real é aqui): `PUT /api/sprints/{chave}` devolve 409 se `Fechado`; `POST /api/sprint/consultas` carrega o sprint pela `ChaveSprint`, ignora o `origem` recebido e força `"nenhum"` quando `Fechado`, e devolve 409 (em vez de cair no fallback de chamada real) se mesmo assim não houver cache batendo com os parâmetros da consulta.

> O antigo campo manual de tarefa (prioridade + situação por categoria) e o endpoint `PUT /api/sprint/tarefas` **foram removidos** — Prioridade e Situação não são mais editáveis nem persistidas pelo usuário. Desde a integração com o Jira (ver seção Jira), quando configurada, elas passam a ser **lidas** (somente leitura, nunca gravadas de volta) de `JiraSprintData.ini`; sem integração ou issue não encontrada, o badge de Prioridade e o de Situação caem em "Nenhuma" (cinza) e o PRE do bloco DEV cai em "–".

`POST /api/sprint/consultas` reaproveita o `ServicoConsulta` inteiro (cache-first, rate limit, filtro por `Selecionado`), só troca o arquivo de cache. `GET /api/sprint` monta o acompanhamento por `ServicoSprint.Montar` (núcleo, `Sprint/`):

- **Capacidade por colaborador**: `diasUteis` = dias do período excluindo sábado/domingo; `tempoTotal` = `HorasPorDia × diasUteis`; `margem` = `floor(30% de tempoTotal)`; `TD` (tempo disponível por colaborador) = `floor(tempoTotal − margem)`; `CT` (capacidade total) = `TD × nº de colaboradores selecionados`. Ex.: `HorasPorDia=7`, `2026-09-01`→`2026-09-24` → `diasUteis=18`, `tempoTotal=126`, `margem=37`, `TD=89`, `CT=89` (1 colaborador). O `CabecalhoSprint` traz `Ct` e (após ele) `Td`, mais `TarefasPendentes`/`TarefasConcluidas` — desde 2026-09-17, calculados por `ContarPendentesEConcluidas` a partir das duas listas globais e opcionais `[SprintStatusFinal]` (`ConfiguracaoStatusFinalSprint.StatusConcluido`/`StatusIgnorado`, ver tabela acima): **Concluídas** = nº de descrições distintas (nunca linha de tag) cujo `Situacao` está em `StatusConcluido`; **Pendentes** = nº de descrições distintas cujo `Situacao` não está em `StatusConcluido` **nem** em `StatusIgnorado` (uma descrição em `StatusIgnorado` não conta em nenhum dos dois totalizadores). Sem nenhuma das duas listas preenchida, o comportamento é idêntico ao anterior à sua existência: `TarefasConcluidas = 0` e `TarefasPendentes` = todas as descrições distintas. O frontend rotula `CT` como "Capacidade" e `TD` como "Tempo por colaborador" (ex-"Total"), exibe uma coluna "Disponível" derivada no cliente, e um botão "Informações" abre um modal com esses números (também sem os rótulos "TD"/"CT"). Os campos de texto do card do sprint (Sprint, Horas/dia, Dias úteis, Margem, Início, Fim) são renderizados maiores e em azul (`primary.main`, a mesma cor da "Capacidade").
- **Colaboradores** (`ResultadoSprint.Colaboradores`): uma linha por colaborador selecionado — `record LinhaColaboradorSprint(NomeExibicao, Sigla, Cor, Td, SegundosRealizados, TarefasPendentes, TarefasConcluidas)`, mesmo cálculo de `ContarPendentesEConcluidas` do `CabecalhoSprint` acima, restrito às descrições em que aquele colaborador aparece (sem `[SprintStatusFinal]` configurado, `TarefasConcluidas` continua sempre 0). `Td` é igual para todos; `SegundosRealizados` = soma das durações `>= 0` de **todos** os apontamentos do usuário no cache do sprint (com ou sem tag de categoria). Colaborador sem nenhum apontamento entra zerado. Sem detalhamento por dia — isso é o Gant. A tabela de colaboradores do frontend mostra **Colab. (nome completo) · sigla · Tempo por colaborador (`Td`, ex-"Total") · Realizado · Disponível · Pendentes · Concluídas** com rodapé somando Pendentes/Concluídas — "Disponível" = `Tempo por colaborador − Realizado` é calculada no frontend (verde quando positiva, vermelha quando negativa, neutra em zero); desde 2026-09-08 as colunas **Disponível, Pendentes e Concluídas** ficam **sempre em negrito**, mesmo neutras/zeradas (antes só "Disponível" tinha negrito condicional).
- **Grid de tarefas** — `ServicoSprint.Montar` (sem parâmetro `manuais`) emite uma linha por descrição/tag: `record LinhaTarefaSprint(string Codigo, string Descricao, bool Agrupada, BlocoCategoriaSprint Dev, Rev, Qa, string? Prioridade = null, string? Situacao = null)`, `record BlocoCategoriaSprint(decimal PreHoras, long ReaSegundos, string? NomeExibicao, string? Sigla, string? Cor)` — os campos de Jira só são preenchidos quando `Montar` recebe `issuesPorCodigo` (ver seção Jira). `ChaveAgrupamento(registro, categorias)` devolve `(string Chave, bool Agrupada)`. **Desde 2026-09-08** o colaborador saiu do nível da linha e passou para cada bloco — uma **linha de descrição** pode **mesclar até 3 colaboradores**, um por bloco DEV/REV/QA: `Montar` empacota os colaboradores de um mesmo grupo `(Chave, Agrupada == false)` de forma gulosa, na ordem de `usuariosSelecionados` — cada um entra na primeira linha já aberta cujos slots que ele ocupa (`segundos > 0`) estejam todos livres; senão abre uma linha nova. Dois colaboradores que disputam a **mesma** categoria da mesma descrição continuam em linhas separadas; colaboradores em categorias **diferentes** da mesma descrição mesclam numa linha só. **Linhas de tag (`Agrupada == true`) nunca mesclam** (corrigido em 2026-09-10 — até então reaproveitavam o mesmo empacotamento guloso e podiam mesclar indevidamente dois colaboradores, ex.: um em DEV e outro em QA da mesma tag): `Montar` pula a busca por linha compatível quando `agrupada == true`, então cada colaborador sempre abre sua própria linha.
  - **Linha de descrição** (`Agrupada == false`): por descrição normalizada "TEL". `Codigo`/`Descricao` de `SepararCodigo` — regex `^(TEL - \d+)(?: - (.+))?$` → `Codigo = "TEL - 0000"`, `Descricao` = resto; sem casar → `Codigo = ""`, `Descricao` = texto inteiro. `ReaSegundos` de cada grupo DEV/REV/QA = tempo do colaborador daquele bloco nessa descrição cujas tags ∈ `categorias.Dev`/`Rev`/`Qa`.
  - **Linha tag-agg** (`Agrupada == true`, só com `agrupamento` `tag`/`ambos`): por tag, `Codigo = ""`, `Descricao` = nome da tag, **sempre 1 colaborador por linha**. **Todo** o tempo de cada colaborador naquela tag vai para **um** grupo: **QA** se o colaborador tem ≥ 1 apontamento no sprint com tag ∈ `categorias.Qa` (pré-passo `colaboradoresComQa`), senão **DEV**. REV nunca recebe tag-agg.
  - **Ordenação**: por **número do código**, não por string (era bug — `TEL - 1118` vinha antes de `TEL - 994`). Helper `NumeroCodigo(string codigo)` extrai só os dígitos de `Codigo`; a grade fica `.ThenBy(t => t.Agrupada ? 0 : NumeroCodigo(t.Codigo))` antes do desempate por string. Linhas de descrição primeiro (as com `Codigo` antes das sem; por `NumeroCodigo` crescente, depois desempate `Codigo`/`Descricao`), depois as tag-agg (pelo índice do único colaborador da linha — `MenorIndiceColaborador` —, depois por `Descricao`). Resultado: `TEL - 994 → TEL - 1000 → TEL - 1118`.
  - Frontend: 1ª coluna de **checkbox** (risca a descrição da linha; a marcação fica salva no `localStorage` do navegador **isolada por sprint** — a chave inclui o `chaveSprint` — e só é apagada numa nova consulta real à API, não ao carregar do cache; o id da linha usa um índice de ocorrência de `(codigo, descricao)` na lista completa em vez do `nomeExibicao`, desde 2026-09-08, já que uma linha pode ter mais de um colaborador), depois colunas **Prioridade · Situação · Código · Descrição** + grupos DEV/REV/QA (`PRE · REA · badge de sigla · Sit.` — o badge lê o colaborador do bloco correspondente, não mais da linha). A **linha 1 do cabeçalho de cada grupo** mostra o nome por extenso (**Desenvolvimento / Revisão / Qualidade**); a linha 2 e os dados seguem com DEV/REV/QA / a sigla. O **bloco esquerdo** (Checkbox · Prioridade · Situação · Código · Descrição) **não tem divisória vertical** — a 1ª borda aparece só em Descrição → DEV; as bordas entre/dentro dos grupos DEV/REV/QA continuam. Colunas compactadas (só "Descrição" cresce, com o mesmo `px: 0.5` das demais), **linhas mais baixas** (padding vertical reduzido) e **Situação / PRE / REA / badges centralizados**. **Prioridade** e **Situação** (badges `BadgeTexto`, texto na cor padrão do tema — não branco fixo — e largura fixa com `Tooltip` do nome completo): valor do Jira (`linha.Prioridade`/`linha.Situacao`) quando a tarefa é encontrada, senão "Nenhuma" (cinza); nas linhas de agrupamento por tag, os dois mostram "Tag" na cor configurável `CorTag`. Cada grupo **DEV/REV/QA** tem sua própria coluna de situação (`EtiquetaFixa`, três casos — ver `SituacaoSemGrupoResponsavel` acima) e seu próprio **PRE/REA**: sem valor real (do Jira ou do Toggl) mostram "–"; com valor real, mesmo pequeno, mostram a hora arredondada para baixo com `Tooltip` da duração exata — desde a introdução das três estimativas por grupo, **PRE é preenchido para os três grupos**: DEV vem de "Estimativa do desenvolvimento", REV vem de "Estimativa da revisão" e QA vem de "Estimativa dos testes" — cada um seu próprio campo customizado do Jira, configurado independentemente (antes só DEV tinha PRE real; REV/QA eram sempre 0). REA fica em vermelho quando ultrapassa o PRE daquele bloco — agora possível nos três grupos, não só DEV. Nada é editável nem persistido pelo usuário. A coluna **Código** é **centralizada** e recebe **zeros à esquerda dinâmicos** — preenchida até o nº de dígitos do maior código do sprint (linhas sem código ficam "—"; quando dois colaboradores disputam a mesma posição da mesma descrição, Código e Descrição dessas linhas ficam em vermelho). O badge de sigla é o componente `BadgeSigla` (sigla colorida, cantos retos), o mesmo do card de colaboradores. Busca por código/descrição, filtro múltiplo (Prioridade/Status/Colaborador, com inversão opcional) e ordenação por Prioridade/Status são todos **client-side**, sobre a lista já carregada — sem nova chamada à API; difere do Relatório (que abre uma busca própria) e do Gant (que reconsulta `GET /api/gant?termo=`). A Descrição é truncada em 30 caracteres na grid (com `Tooltip` do texto completo); duplo clique numa linha abre um modal com o detalhe completo dela (desde 2026-09-17, grupos DEV/REV/QA em colunas de uma tabela) — ver detalhes de UI completos no [README do frontend](../toggl-report-front/README.md#fluxo-da-aplicação).

> Melhoria futura (não implementada): a planilha de referência tem também um gráfico de pizza Concluído/Pendente e um gráfico de barras por colaborador.

### Jira

`/api/jira/*` guarda a configuração (seção `[Jira]` de `ConfiguracoesGerais.ini` desde 2026-09-15 — antes, arquivo próprio `JiraConfig.ini`, seção `[Geral]`; `ConfiguracaoJira`/`CarregadorConfiguracaoJiraIni`), com `ApiToken` criptografado do mesmo jeito que o `TokenApi` do Toggl e mascarado (`ServicoUsuariosToggl.MascararToken`) em toda resposta que sai da API. `ClienteApiJira` autentica com Basic `email:apiToken` (não `token:api_token` como o Toggl) contra `https://<dominio>/rest/api/3/`, normalizando a URL informada (aceita com ou sem `https://`). `POST /api/jira/testar-conexao` sempre exige as três credenciais no corpo (nunca reaproveita a configuração salva, para validar exatamente o que está na tela); `POST /api/jira/campos` aceita credenciais no corpo **ou** cai para a configuração salva quando o corpo vem vazio, e filtra a resposta do Jira a `custom: true` — a lista serve para popular **quatro** seletores no frontend: os três campos de estimativa por grupo ("Estimativa do desenvolvimento"/"Estimativa da revisão"/"Estimativa dos testes", configuráveis independentemente) e "Revisado por", cada um seu próprio `Autocomplete` sobre a mesma lista de campos customizados.

**Integração com o Sprint** (`POST /api/jira/issues`, e embutida em `POST /api/sprint/consultas`): busca em lote via JQL `key in (TEL-994,TEL-718,...)` — nunca uma chamada por tarefa. `ClienteApiJira.BuscarIssuesAsync` pede os campos `priority`, `status`, `assignee` (responsável, nativo) e **quatro** campos customizados configuráveis independentemente — estimativa do desenvolvimento (`CampoEstimativaDesenvolvimentoId`), estimativa da revisão (`CampoEstimativaRevisaoId`), estimativa dos testes (`CampoEstimativaTestesId`) e "revisado por" (`CampoRevisadoPorId`); os três campos de estimativa (cada um se numérico ou `{"value": ...}`) são convertidos para horas, `assignee`/"revisado por" extraem só o `displayName`. O campo nativo `timeoriginalestimate` ("Estimativa original") chegou a ser buscado só para exibição num tooltip do PRE de DEV e foi **removido por completo** (backend e frontend) em 2026-09-17 — não tinha nenhum outro uso. **Pagina em blocos de até 100 issues** (`nextPageToken`/`isLast` no corpo da resposta — campos confirmados só ao vivo contra o Jira real, não documentados): até 2026-09, `BuscarIssuesAsync` mandava `maxResults = chaves.Count` numa única chamada, e o Jira Cloud limita esse endpoint a 100 resultados/página independente do valor pedido — perdia issues em silêncio em sprints com mais de 100 códigos TEL (confirmado com um sprint real de 129 códigos, só 100 issues voltavam). Corrigido com um loop até `isLast == true` ou `nextPageToken` vazio, `maxResults` fixo em 100. Issue não encontrada pelo JQL simplesmente não aparece no resultado — sem erro; falha de rede/autenticação com o Jira derruba só a atualização do cache do Jira, nunca a consulta do Toggl. `SprintConsultasEndpoints` extrai os códigos direto dos registros crus do Toggl (`ServicoSprint.ExtrairCodigosJira`, independente do `Agrupamento` configurado) e grava o resultado em `JiraSprintData.ini` (`[Sprint:<chaveSprint>]`, isolado por sprint — mesma ideia do `SprintData.ini`, mas em arquivo/carregador (`CarregadorCacheSprintIni`) separado). `GET /api/sprint` carrega esse cache e passa a `ServicoSprint.Montar`, que aplica Prioridade/Situação só às linhas de descrição (nunca tag-agg) e as três estimativas (`EstimativaDesenvolvimentoHoras`/`EstimativaRevisaoHoras`/`EstimativaTestesHoras`) a cada bloco correspondente — DEV/REV/QA todos passam a ter PRE real quando a issue tem o campo configurado (antes só DEV). `Responsavel`/`RevisadoPor` alimentam o fallback DEV/REV descrito abaixo.

**Fallback DEV/REV e mapeamento Jira↔Toggl** (desde 2026-09-16): `ConfiguracaoMapeamentoJiraToggl` (seção `[JiraTogglMapeamento]` de `ConfiguracoesGerais.ini`, mapeamento configurável `displayName` do Jira → `Chave` de usuário Toggl, editável no 5º estágio do wizard de Configurações do frontend, alimentado por `GET /api/jira/usuarios`) permite que `ServicoSprint.Montar` preencha automaticamente o bloco **DEV** de uma linha de descrição com o usuário mapeado a partir de `Responsavel` (assignee), e o **REV** a partir de `RevisadoPor` — só quando nenhuma linha daquela descrição já tem colaborador nesse bloco (nunca sobrescreve tempo real apontado) e o usuário mapeado está entre os usuários selecionados da consulta atual (nunca busca fora dos selecionados). É só uma sugestão visual (0 segundos) — não conta como tempo realizado nem afeta capacidade/pendências.

A API do Jira **não expõe cor por prioridade dentro da busca de issues** — só no endpoint dedicado `GET /rest/api/3/priority` (exigiria chamada extra); status também não tem cor individual, só `statusCategory.key` (`new`/`indeterminate`/`done`) — capturado em `IssueJira.SituacaoCategoria`. Por isso, desde 2026-09-13, a cor de cada badge de Prioridade/Situação no Sprint vem de um **mapeamento configurável por nome** (`GET/PUT /api/jira/cores`, `JiraCores.ini`), populado a partir da listagem **real** de nomes (`GET /api/jira/status`/`/prioridades`, cacheados) — sem cor configurada para aquele nome exato, Prioridade cai numa paleta fixa por severidade (Muito alta → Muito baixa); Status vai direto para cinza (`corIndisponivel`), o mesmo tom do badge "Nenhuma" — a paleta intermediária por `SituacaoCategoria` (`new`/`indeterminate`/`done`) foi removida em 2026-09-16 (o fallback amarelo de "indeterminate" se confundia com cor configurada de verdade). A seção `[SprintResponsabilidade]` de `ConfiguracoesGerais.ini` (`ConfiguracaoResponsabilidadeSprint`) mapeia status → DEV/REV/QA; `ServicoSprint.Montar` compara `Situacao` a essas listas e preenche `LinhaTarefaSprint.GrupoResponsavelStatus`/`SituacaoSemGrupoResponsavel` — três casos: (1) bate com um grupo → esse grupo "tem a bola" e mostra "Pendente", os demais (com colaborador) mostram "Concluído"; (2) responsabilidade configurada (≥1 lista não vazia) e tarefa encontrada no Jira, mas o status não bate com nenhuma das três listas → todo grupo com colaborador mostra "Concluído" (`SituacaoSemGrupoResponsavel = true`, desde 2026-09-16); (3) sem nenhuma lista preenchida, ou tarefa não encontrada, todo grupo com colaborador mostra "Pendente" (comportamento anterior, preservado como padrão).

> **`GET`/`POST /rest/api/3/search` foi descontinuado pelo Jira** (confirmado com `410 Gone` num teste real em 2026-09-13, apontando para o substituto) — `BuscarIssuesAsync` já usa `POST /rest/api/3/search/jql`. Se a Atlassian migrar de novo, é só nesse método que muda.

### Decisões desta camada

- **Minimal APIs**, um arquivo por grupo de endpoints em `Endpoints/` (`Map*Endpoints(this WebApplication app, ...)`), DTOs em `Dtos/` — nenhuma duplicação de lógica: todo endpoint delega para `TogglReport.Nucleo`.
- **Helpers de endpoint extraídos pela auditoria de 2026-09-07** (não são rotas): `ValidacaoDatas.Tenta` (parse de datas + `fim < inicio`, 7 handlers — `GET /api/gant` fora, só faz parse) e `TratamentoIo.Executar` (converte `IOException`/`UnauthorizedAccessException` em `500` com mensagem limpa, 9 sites — `DadosEndpoints` fora, o `try` de lá é mais complexo). Ver `CLAUDE.md` §4.2/§7 item 29.
- **Stateless entre requisições**: a API nunca mantém os registros baixados em memória entre chamadas — toda leitura de relatório/busca **relê o `RelatorioData.ini`**. Isso é o que permite reaproveitar o cache do jeito mais simples possível, sem sessão.
- **CORS liberado** (`AllowAnyOrigin/Header/Method`) — uso exclusivamente local, sem dado sensível trafegando entre origens que importe proteger.
- **Enums serializados como string** (`JsonStringEnumConverter`) — `status` de `/api/consultas` aparece como texto no JSON, não como número.
- **Swashbuckle.AspNetCore** — única dependência NuGet do repositório (necessária para o Swagger). A UI do Swagger tem CSS próprio injetado (`SwaggerUIOptions.HeadContent`) e usa o ícone do projeto (servido via `app.UseStaticFiles()`, a única pasta estática da API). Não tem tema escuro nativo — segue o SO/navegador do usuário; uma tentativa de forçar tema claro via `color-scheme` foi testada e revertida por não funcionar na prática (ver `CLAUDE.md` §4.7). Quando a autenticação Basic está ligada, `AddSecurityDefinition`/`AddSecurityRequirement` registram o esquema `basic` só nesse caso (mesma condição do middleware) — é o que faz o botão "Authorize" aparecer no Swagger UI.
- **Autenticação HTTP Basic opcional** — desligada por padrão (uso local);
  liga configurando `AUTH__USUARIO`/`AUTH__SENHA` (produção). `/health`,
  `/swagger` e `/images` (ícone da topbar do Swagger) nunca exigem. Sem popup
  nativo do navegador — 401 sem `WWW-Authenticate`, tela de login própria no
  frontend.

---

## Docker

A imagem (`Dockerfile`, base `aspnet:10.0-alpine`) roda o processo `dotnet`
como usuário **não-root** (`$APP_UID`, padrão das imagens .NET 8+) — mas os
volumes `dados/`/`certificado/` são **bind mounts** do host, e o Docker cria
o ponto de montagem como `root:root` por padrão quando o container sobe, o
que bloqueava qualquer escrita nessas pastas pelo usuário não-root (ex.:
`POST /api/dados/restaurar` falhava com `UnauthorizedAccessException` —
leitura funcionava, só escrita não). Corrigido com um `entrypoint.sh`: o
container agora inicia como `root`, `chown`s `dados/`/`certificado/` para
`$APP_UID`, e só então troca de usuário via `su-exec` antes de rodar o
`dotnet TogglReport.Api.dll` — o processo da aplicação continua não-root,
só o passo de ajuste de permissão do volume roda como root, uma vez, no
início do container.

## Estrutura de arquivos

```
toggl-report-back/
 ├─ TogglReport.slnx
 ├─ TogglReport.Api/                    # Web API
 │   ├─ Program.cs
 │   ├─ Dtos/                           # um record por request/response
 │   ├─ Endpoints/                      # um Map*Endpoints por grupo de rotas (inclui GantEndpoints) + helpers internos ValidacaoDatas (TryParse + fim<inicio) e TratamentoIo (500 em IOException/UnauthorizedAccessException)
 │   ├─ Properties/launchSettings.json
 │   └─ wwwroot/                        # só o ícone do Swagger (images/) e seus favicons
 └─ TogglReport.Nucleo/                 # referenciado pela Api
     ├─ Configuracao/                   # inclui ConfiguracaoGant/CarregadorConfiguracaoGantIni + Sprint/ServicoSprints/CarregadorSprintsIni/ConfiguracaoCategoriasSprint/CarregadorConfiguracaoCategoriasSprintIni/ConfiguracaoResponsabilidadeSprint/CarregadorConfiguracaoResponsabilidadeSprintIni/ConfiguracaoStatusFinalSprint/CarregadorConfiguracaoStatusFinalSprintIni/CarregadorCacheSprintIni + ConfiguracaoJira/CarregadorConfiguracaoJiraIni + ConfiguracaoMapeamentoJiraToggl/CarregadorConfiguracaoMapeamentoJiraTogglIni (5 carregadores lêem/gravam ConfiguracoesGerais.ini) + ConfiguracaoCoresJira/CarregadorConfiguracaoCoresJiraIni + CarregadorCacheTagsTogglIni/CarregadorCacheListasJiraIni + helpers ServicoChaves/DiasUteis/Agrupamento
     ├─ Toggl/
     ├─ Relatorios/
     ├─ Consultas/
     ├─ Gant/                          # ServicoGant + LinhaGant/CelulaGant/ResultadoGant
     ├─ Sprint/                        # ServicoSprint + CabecalhoSprint/BlocoCategoriaSprint/LinhaTarefaSprint/LinhaColaboradorSprint/ResultadoSprint (namespace RelatorioToggl.Sprints)
     └─ Jira/                          # ClienteApiJira (inclui ObterStatusAsync/ObterPrioridadesAsync/ObterUsuariosAsync, paginado) + CampoJira/IssueJira/ResultadoApiJira/CacheJiraSprint/UsuarioJiraBruto
```

## Segurança

`TogglUsuarios.ini`, `ConfiguracoesGerais.ini`, `RelatorioData.ini`, `GantData.ini` e `SprintData.ini` (gerados por **cada** executável em sua própria pasta `dados/`) guardam API Tokens **criptografados** (AES; chave via `CHAVE_CRIPTOGRAFIA` — renomeada de `TOGGL_CHAVE_CRIPTOGRAFIA` em 2026-09-07, quando a chave padrão embutida também foi rotacionada: tokens gravados sem env var configurada precisam ser reinseridos; ver `CLAUDE.md` §2.4) — os três de cache também o retorno cru das consultas, esse não criptografado.

**`ConfiguracoesGerais.ini`** (desde 2026-09-15) consolida em seções separadas — `[Jira]` (URL/e-mail/token do Jira, criptografado, antes em `JiraConfig.ini`), `[SprintCategorias]` (mapeamento DEV/REV/QA + agrupamento + tags, antes em `TogglSprintCategorias.ini`) e `[SprintResponsabilidade]` (status→DEV/REV/QA, antes em `TogglSprintResponsabilidade.ini`) — três arquivos antes independentes; entra na lista de arquivos sensíveis por causa da seção `[Jira]`, mesmo as outras duas não tendo dado sensível. A migração lazy desses três arquivos legados para o consolidado já foi concluída em produção e o fallback de leitura foi removido do código; os três arquivos ficaram órfãos e foram apagados manualmente da pasta `dados/`.

`RelatorioParametros.ini` (agrupamento/tags/período), `Sprints.ini`, `JiraSprintData.ini` (cache de prioridade/situação/estimativas, sem token), `TagsCache.ini` (cache de nomes de tags), `JiraListasCache.ini` (cache de nomes de status/prioridades) e `JiraCores.ini` (mapeamento nome → cor) não têm dado sensível. Não versione nenhum desses arquivos (já estão no `.gitignore`/`.dockerignore`, em qualquer profundidade de pasta) e trate os que têm token como segredo mesmo assim.

### Variáveis de ambiente em dev (Visual Studio)

As três env vars da API — `AUTH__USUARIO`, `AUTH__SENHA` (autenticação Basic opcional, ambas vazias = sem autenticação) e `CHAVE_CRIPTOGRAFIA` (chave de criptografia dos tokens, vazia = chave padrão embutida) — vão no bloco `environmentVariables` de `TogglReport.Api/Properties/launchSettings.json`, já presentes lá com valor vazio como template. Pela IDE: **Propriedades do projeto → Depurar → "Abrir interface do usuário de perfis de inicialização de depuração" → Variáveis de ambiente**. `AUTH:*` são lidas via `IConfiguration` (o provider de env vars mapeia `AUTH__USUARIO` → `AUTH:USUARIO`); `CHAVE_CRIPTOGRAFIA` é lida direto via `Environment.GetEnvironmentVariable`. Como `launchSettings.json` é versionado, para guardar valores reais sem commitar: `git update-index --skip-worktree toggl-report-back/TogglReport.Api/Properties/launchSettings.json` ou defina as variáveis no ambiente do Windows (o VS herda). Fora de dev, o `docker-compose.yml` lê as três do `.env` da raiz (gitignored; `.env.example` é o template).

## Limitações conhecidas

- Sem paginação: `/me/time_entries` traz tudo do período numa única chamada — períodos muito longos podem ser lentos ou esbarrar em limites de histórico da conta (erro 400).
- Datas são tratadas como dias no fuso local e convertidas para UTC na chamada à API.
- Não resolve nome de projeto/cliente — agrupamento é só por descrição e tag.
- Limite de 30 requisições/hora por usuário do Toggl é só em memória, **por processo** — não persiste entre reinícios da API.
- Sem testes automatizados.