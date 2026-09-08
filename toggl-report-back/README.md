# toggl-report-back

[← voltar ao README principal](../README.md)

Três projetos **C# / .NET 10** na mesma solução (`TogglReport.slnx`):

| Projeto | Tipo | O que é |
|---|---|---|
| [`TogglReport.Console/`](#console-togglreportconsole) | Console (`Exe`) | O app interativo original |
| [`TogglReport.Api/`](#web-api-togglreportapi) | Web API (Minimal APIs) | Expõe as mesmas funcionalidades por HTTP, com autenticação HTTP Basic opcional |
| [`TogglReport.Nucleo/`](#núcleo-compartilhado-togglreportnucleo) | Biblioteca de classes | Modelos, acesso a INI e regras de negócio comuns aos dois acima |

Console e Web API são interfaces diferentes para a **mesma lógica**: ambos consultam o Toggl Track, fazem cache do retorno cru em arquivos `.ini` dentro de uma pasta `dados/` (ao lado do executável de cada um) e agrupam/buscam sobre esse dado em runtime — nenhum dos dois duplica regra de negócio, tudo que é comum vive em `TogglReport.Nucleo`.

## Índice

- [toggl-report-back](#toggl-report-back)
  - [Índice](#índice)
  - [Requisitos](#requisitos)
  - [Compilar a solução](#compilar-a-solução)
  - [Console (`TogglReport.Console`)](#console-togglreportconsole)
    - [Como usar](#como-usar)
    - [Funcionalidades](#funcionalidades)
    - [Fluxo de configuração (assistente)](#fluxo-de-configuração-assistente)
    - [Cache de consulta (`TogglRelatorioData.ini`)](#cache-de-consulta-togglrelatoriodataini)
    - [Relatório no console](#relatório-no-console)
    - [Busca por descrição](#busca-por-descrição)
    - [Como obter seu API Token do Toggl](#como-obter-seu-api-token-do-toggl)
  - [Núcleo compartilhado (`TogglReport.Nucleo`)](#núcleo-compartilhado-togglreportnucleo)
  - [Web API (`TogglReport.Api`)](#web-api-togglreportapi)
    - [Como rodar](#como-rodar)
    - [Endpoints](#endpoints)
    - [Exemplos de request/response](#exemplos-de-requestresponse)
    - [Gráfico de Gantt](#gráfico-de-gantt)
    - [Sprint](#sprint)
    - [Decisões desta camada](#decisões-desta-camada)
  - [Estrutura de arquivos](#estrutura-de-arquivos)
  - [Segurança](#segurança)
  - [Limitações conhecidas](#limitações-conhecidas)

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) ou superior
- Um **API Token** pessoal do Toggl Track para cada usuário que você queira incluir no relatório ([como obter](#como-obter-seu-api-token-do-toggl))

## Compilar a solução

```bash
cd toggl-report-back
```

```bash
dotnet build TogglReport.slnx
```

Compila os três projetos (`TogglReport.Console`, `TogglReport.Api`, `TogglReport.Nucleo`) de uma vez. `0 warnings` é o padrão esperado.

---

## Console (`TogglReport.Console`)

Console interativo que consulta o Toggl Track (`GET /me/time_entries`) usando o **API Token pessoal** de cada usuário cadastrado, agrupando por **descrição**, por **tag**, ou ambos. Pasta/csproj se chamam `TogglReport.Console` (para bater com o padrão `TogglReport.<X>` dos outros dois projetos), mas o executável gerado continua `TogglReport.exe` (`AssemblyName` inalterado).

### Como usar

```bash
dotnet run --project TogglReport.Console
```

Se não houver nenhuma configuração salva (nem `dados/TogglRelatorioParametros.ini`
nem `dados/TogglUsuarios.ini`), o app pergunta antes de qualquer outra coisa
se você quer restaurar de um backup (`.zip` da pasta `dados/`); recusando ou
sem informar um caminho válido, segue para o cadastro inicial normal.

Na primeira execução, o app guia você por um cadastro inicial (agrupamento padrão, usuários/tokens, período) e cria a pasta `dados/` ao lado do executável. Nas execuções seguintes, carrega `dados/TogglRelatorioParametros.ini` (agrupamento/tags/período) e `dados/TogglUsuarios.ini` (usuários/tokens) já existentes e, se houver um `dados/TogglRelatorioData.ini` da última consulta com o mesmo período e usuários, oferece reaproveitá-lo.

### Funcionalidades

- Relatório por usuário, agrupado por **descrição**, por **tag**, ou ambos.
- **Tags configuradas aparecem detalhadas em "Por descrição" e saem de "Por tag"**: você escolhe quais tags (com agrupamento "ambos"); as demais ficam de fora de "Por descrição" (só entram no total de "Por tag").
- **Descrições de ticket "TEL" sempre no mesmo formato**: "TEL-0000-AA", "TEL-0000 - AA" etc. viram "TEL - 0000 - AA" — já na hora de somar os tempos, não só na exibição.
- Identifica e lista separadamente entradas com **timer ainda em execução** (não entram nos totais).
- **Cache de consulta** (`dados/TogglRelatorioData.ini`): o retorno cru da última consulta de cada usuário fica salvo; se o período e os usuários da próxima execução forem iguais, o app oferece carregar do cache em vez de consultar a API de novo (o agrupamento e os cálculos rodam sempre em cima do dado, cacheado ou não — o cache nunca guarda um resultado já processado).
- **Limite de 30 requisições/hora por usuário**: um contador em memória evita novas chamadas além desse limite dentro da mesma execução; se atingido, usa o cache (quando disponível para o mesmo período) em vez de consultar.
- **Busca por parte da descrição**, agrupada por descrição e detalhada por usuário no mesmo estilo visual do relatório completo; depois de cada busca, o app oferece voltar ao relatório completo, fazer nova busca ou continuar o fluxo normal.
- Assistente interativo para cadastrar, editar e remover usuários/tokens, com **validação do token na hora** (chamada a `GET /me`).
- Reaproveita a última configuração salva (período, agrupamento, usuários) a cada execução, perguntando se quer manter ou alterar.
- Interface de console com **tela de boas-vindas**, **carregamento**, **cabeçalho fixo** e **padrão de cores** consistente; toda troca de tela limpa o console (scrollback incluído) e redesenha o cabeçalho antes do novo conteúdo.
- **Moldura adaptada à largura do terminal**: usa o espaço realmente disponível na janela (nunca mais largo que ela), com um padrão de 100 colunas quando a largura não pode ser detectada.
- **Zero dependências externas** — parser de INI e banner feitos à mão.

### Fluxo de configuração (assistente)

O assistente pede, **campo a campo**: **agrupamento** (descrição / tag / ambos), **tags que não devem aparecer em "Por tag"** (só quando o agrupamento inclui tag), **usuários/tokens** (submenu) e **período** (data início / data fim). Para cada campo, se há um valor salvo válido o app pergunta se quer **reaproveitá-lo**; senão, você informa e **confirma** o valor.

```
╔════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ RELATÓRIO TOGGL · por Gleryston Matos · v1.0.1.0                                                   ║
╠════════════════════════════════════════════════════════════════════════════════════════════════════╣
║ Período: 2026-08-01 a 2026-08-31 · Agrupamento: Ambos                                              ║
╚════════════════════════════════════════════════════════════════════════════════════════════════════╝

 Reaproveitar agrupamento (Ambos)? [S/n]:
 Informe as tags que NÃO devem aparecer na listagem por tag (separadas por vírgula, Enter = nenhuma):
 ...

 Usuários selecionados:
   • Joao Silva
   • Maria Souza

 Confirmar a consulta com os parâmetros acima? [S/n]:
```

**Gerenciamento de usuários/tokens** (submenu):
```
 Usuários cadastrados:
   1. Joao Silva  (token: abcd...7890)
   2. Maria Souza  (token: 0987...4cba)

 O que deseja fazer?
   [A] Adicionar   [R] Remover   [E] Editar   [C] Concluir
```
Ao adicionar ou editar um token, o app valida contra a API (`GET /me`) antes de salvar; se a validação falhar, pergunta se quer tentar novamente ou salvar mesmo assim.

### Cache de consulta (`TogglRelatorioData.ini`)

Depois de uma consulta bem-sucedida, o app grava o retorno cru da API (sem nenhum agrupamento ou cálculo aplicado) em `dados/TogglRelatorioData.ini`. Na próxima execução, se o período e o conjunto de usuários/tokens confirmados forem **exatamente iguais** aos da última consulta salva, o app pergunta:

```
 Os parâmetros são iguais aos da última consulta salva. Deseja consultar novamente à API? [s/N]:
```

- **Enter (padrão) ou "não"**: carrega os dados do cache — agrupamento, cálculos e normalização de "TEL" continuam rodando normalmente, só a chamada à API é pulada.
- **"sim"**: consulta a API de novo e sobrescreve o cache.

O cache também é usado como reserva automática quando o **limite de 30 requisições/hora por usuário** é atingido: o usuário afetado usa o dado em cache (se for do mesmo período) em vez de ficar sem dados.

### Relatório no console

```
 ═══ Joao Silva (2026-08-01 a 2026-08-31) ══════════════════════════════════════════════════════════
   ── Por descrição ── ─────────────────────────────────────────────────────────────────────────────
     TEL - 433 - AA                                                                        01h02m05s
     TEL - 1433 - BB                                                                       00h30m00s
     (Cliente X) Reunião com cliente X                                                     03h30m00s

   ── Por tag ── ───────────────────────────────────────────────────────────────────────────────────
     (sem tag)                                                                             00h21m40s
     Interno                                                                               00h08m20s

   ── Em andamento ── ──────────────────────────────────────────────────────────────────────────────
     "Suporte ao cliente por telefone"                                (iniciado às 14:32)

   Total do período (excluindo em andamento): 05h32m05s
══════════════════════════════════════════════════════════════════════════════════════════════════
```

- **Por descrição**: só mostra entradas de uma tag configurada como "detalhada" (as demais só entram no total de "Por tag"); com agrupamento "descrição" puro, mostra tudo. As que começam com "TEL" vêm primeiro; as demais, prefixadas com `(tag)`. Descrições "TEL" em grafias diferentes são somadas juntas e exibidas como `TEL - 0000 - AA`.
- **Por tag**: lista as tags exceto as configuradas como detalhadas (essas ficam de fora por completo — seus registros aparecem em "Por descrição").

### Busca por descrição

```
 Deseja buscar por parte da descrição? [s/N]: s
 Buscar por parte da descrição: reunião

 ═══ Resultado da busca: "reunião" ══════════════════════════════════════════════════════════════════
   ── Por descrição ── ──────────────────────────────────────────────────────────────────────────────
     Reunião com cliente X                                                             05h30m00s
       João Silva                                                                      03h30m00s
       Maria Souza                                                                     02h00m00s

     Reunião de alinhamento semanal                                                    02h00m00s
       João Silva                                                                      01h00m00s
       Maria Souza                                                                     01h00m00s

   Total geral: 07h30m00s

 O que deseja fazer?
   1 - Voltar ao relatório completo   2 - Nova busca por descrição   3 - Continuar
```

Busca por substring, case-insensitive, sobre os dados **já baixados** (sem nova chamada à API). Cada descrição aparece com o total somado de todos os usuários; abaixo dela, uma linha por usuário que tem tempo lançado ali, todas ordenadas por tempo decrescente. Depois de cada busca: **voltar ao relatório completo**, **nova busca** ou **continuar**.

### Como obter seu API Token do Toggl

1. Acesse [track.toggl.com](https://track.toggl.com/) e faça login.
2. Vá em **Profile Settings** (ícone de perfil no canto).
3. Role até o final da página — o **API Token** está lá.
4. Copie e cole quando o assistente (ou o formulário do frontend) pedir.

---

## Núcleo compartilhado (`TogglReport.Nucleo`)

Biblioteca de classes referenciada pelo `TogglReport.Console` (console) e pelo `TogglReport.Api`. Contém **tudo que não depende de I/O de console nem de HTTP**, evitando duplicar regra de negócio entre as duas interfaces:

| Pasta | Conteúdo |
|---|---|
| `Configuracao/` | `ConfiguracaoApp`/`ConfiguracaoUsuario` (modelo do `[Geral]` de `TogglRelatorioParametros.ini` + usuários em memória), `CarregadorConfiguracaoIni` (agrupamento/tags/período), `CarregadorUsuariosIni` (`TogglUsuarios.ini` — usuários/tokens, compartilhado com o Gantt), `CriptografiaToken` (AES do `TokenApi`), `CacheConsulta`/`UsuarioCacheado` (modelo do `TogglRelatorioData.ini`), `CarregadorCacheIni`, `AnalisadorIni` (parser de INI compartilhado — `Analisar`/`ObterOuPadrao`/`ObterOuNulo` + `Escrever` (grava UTF-8 sem BOM, criando a pasta) e `DividirLista` (split de lista separada por vírgula)), `CaminhosDados` (monta os caminhos `dados/TogglRelatorioParametros.ini`, `dados/TogglUsuarios.ini` e `dados/TogglRelatorioData.ini` a partir do diretório base de quem chama), `ServicoUsuarios` (gerar chave única, checar nome em uso, mascarar token), `ServicoChaves` (`GerarChaveUnica` compartilhado por `ServicoUsuarios`/`ServicoSprints`), `DiasUteis` (`Entre(inicio, fim)` — dias seg–sex, base do `ServicoGant`/`ServicoSprint`), `Agrupamento` (`EhValido` — `descricao`/`tag`/`ambos`, usado pelos 3 endpoints de parâmetros) |
| `Toggl/` | `ClienteApiToggl` (HTTP Basic contra `api.track.toggl.com/api/v9`), `RegistroTempoDto`, `ResultadoApiToggl`, `LimitadorRequisicoes` (limite de 30 req/hora, em memória, por processo) |
| `Relatorios/` | `ServicoAgrupamento` (por descrição/tag, normalização "TEL"), `LinhaDescricao`, `ServicoBuscaDescricao`, `LinhaBusca`, `ResultadoBuscaDescricao` — tudo puro, devolve dados, nunca texto formatado |
| `Consultas/` | `ServicoConsulta` — decide cache×API e aplica o rate limiter; `ResultadoConsulta`, `EventoConsultaUsuario`, `StatusConsultaUsuario` |

`ServicoConsulta` é o ponto mais importante: tanto o console quanto a Web API chamam os mesmos métodos (`CarregarCacheSeExistente`, `CacheCorrespondeAosParametros`, `CarregarRegistrosDoCache`, `ConsultarUsuariosAsync`, `SalvarCache`) — cada um decide sozinho **quando** chamar cada um (o console via prompt interativo, a API via um parâmetro de requisição), mas a regra em si (o que conta como "mesmo período/usuários", quando usar cache, como tratar o rate limit) existe em um único lugar.

Este projeto **nunca** referencia `Console`, `Paleta` ou `Tela` — só lógica pura e acesso a arquivo.

---

## Web API (`TogglReport.Api`)

API HTTP local (Minimal APIs, ASP.NET Core), com autenticação HTTP Basic **opcional** (desligada por padrão, ver [Segurança](#segurança)) — expõe as mesmas funcionalidades do console para consumo do [frontend](../toggl-report-front/README.md) ou de qualquer outro cliente HTTP local.

### Como rodar

```bash
dotnet run --project TogglReport.Api
```

Sobe em `http://localhost:5180` (porta fixa, `Properties/launchSettings.json`). Swagger/OpenAPI em **`http://localhost:5180/swagger`** — documenta todos os endpoints com parâmetros, respostas e exemplos, sem exigir autenticação para navegar. Quando `AUTH__USUARIO`/`AUTH__SENHA` estão configurados, o Swagger ganha um botão **"Authorize"** (esquema HTTP Basic) — informe as credenciais uma vez e as chamadas de teste feitas na própria UI já saem autenticadas.

Cria sua **própria** pasta `dados/` (ao lado do executável da API) — independente da pasta `dados/` do console. Cada processo tem seu próprio `TogglRelatorioParametros.ini`/`TogglUsuarios.ini`/`TogglRelatorioData.ini` e seu próprio contador de rate limit; rodar os dois ao mesmo tempo não compartilha estado.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/configuracao` | Agrupamento, tags detalhadas e último período salvos |
| `PUT` | `/api/configuracao` | Atualiza agrupamento/tags/período; preserva os usuários já cadastrados |
| `GET` | `/api/usuarios` | Lista usuários cadastrados (token mascarado) |
| `POST` | `/api/usuarios` | Cadastra um usuário (valida o token por padrão) |
| `PUT` | `/api/usuarios/{chave}` | Edita nome de exibição e/ou token |
| `DELETE` | `/api/usuarios/{chave}` | Remove um usuário |
| `POST` | `/api/usuarios/validar-token` | Valida um token junto ao Toggl, sem salvar |
| `POST` | `/api/consultas` | Consulta o Toggl (cache-first, respeita o rate limit); salva o retorno cru |
| `GET` | `/api/relatorio?dataInicio=&dataFim=` | Relatório agrupado a partir dos dados em cache |
| `GET` | `/api/busca?termo=` | Busca por descrição sobre os dados em cache |
| `GET` | `/api/dados/download` | Baixa a pasta `dados/` inteira compactada em `dados.zip` (todos os arquivos presentes no momento, sem lista fixa) |
| `POST` | `/api/dados/restaurar` | Restaura a pasta `dados/` a partir de um `.zip` enviado (`multipart/form-data`, campo `arquivo`) — sobrescreve arquivos existentes, criando a pasta se ainda não existir. 400 se algum arquivo do zip estiver dentro de uma pasta (deve compactar o **conteúdo** de `dados/`, não a pasta em si); 500 com mensagem limpa em qualquer outra falha de I/O |
| `GET` | `/api/gant/parametros` | Período, tags a detalhar e agrupamento do **Gantt** (independente do relatório) |
| `PUT` | `/api/gant/parametros` | Atualiza os parâmetros do Gantt — desde 2026-09-07 valida `agrupamento` (400 se fora de `descricao`/`tag`/`ambos`), como os endpoints de parâmetros do relatório e do Sprint já faziam |
| `POST` | `/api/gant/consultas` | Igual a `/api/consultas`, mas grava em `TogglGantData.ini` |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | Gantt agrupado por usuário/categoria/descrição, dia a dia (só dias úteis); `termo` filtra por descrição |
| `GET` | `/api/sprints` | Lista os sprints cadastrados |
| `POST` | `/api/sprints` | Cadastra um sprint (`Nome`, `HorasPorDia`, `DataInicio`, `DataFim`) — 400 (nome vazio, datas inválidas, `fim < inicio`, `HorasPorDia <= 0`) / 409 (nome em uso) |
| `PUT` | `/api/sprints/{chave}` | Edita um sprint (campos `null`/vazios não alteram) |
| `DELETE` | `/api/sprints/{chave}` | Remove um sprint |
| `GET` | `/api/sprint/categorias` | Parâmetros do Sprint: mapeamento global TAG → categoria + agrupamento + tags detalhadas: `{ dev, rev, qa: string[], agrupamento: string, tagsDetalhadas: string[] }` — sem arquivo/chave, as listas vêm vazias e `agrupamento = "ambos"` (`{"dev":[],"rev":[],"qa":[],"agrupamento":"ambos","tagsDetalhadas":[]}`) |
| `PUT` | `/api/sprint/categorias` | Atualiza os parâmetros (normaliza as listas: trim + distinct case-insensitive + descarta vazias; valida `agrupamento` contra `descricao`/`tag`/`ambos`, 400 se inválido). `ServicoSprint.Montar` consome os dois na chave de agrupamento da grid (por descrição ou por tag, regra do `ServicoGant`) |
| `POST` | `/api/sprint/consultas` | Igual a `/api/consultas`, mas grava em `TogglSprintData.ini` |
| `GET` | `/api/sprint?chaveSprint=` | Acompanhamento do sprint: capacidade + card de colaboradores + grid com uma linha por (tarefa × colaborador); 409 se não há consulta salva para o período do sprint |

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

No frontend, cada usuário do Relatório é uma **tabela** (`[checkbox] · Tag · Descrição · Tempo`), com as linhas por descrição e depois as por tag concatenadas, sem títulos de seção; a `tag` fica em coluna própria e a descrição aparece crua (sem prefixo). O console mantém o prefixo `(tag) descrição` e o layout em texto.

**`GET /api/busca?termo=reuniao`** — 409 se não há cache ainda; 200 com `linhas` (descrição, segundos por usuário, total da linha) e `totalGeralSegundos`.

### Gráfico de Gantt

`/api/gant/*` é um segundo fluxo, com parâmetros (`ConfiguracaoGant`: período + tags a detalhar + agrupamento) e cache (`dados/TogglGantData.ini`) **independentes** do relatório — reaproveita a mesma lista de usuários e o mesmo `ServicoConsulta`, só troca o arquivo de cache. `GET /api/gant` devolve `{ dias, linhas }`: `dias` são só os **dias úteis** do período (sábado/domingo ocultos); cada linha pertence a um único usuário, agrupada por categoria (tag) + descrição — tags na lista "a detalhar" viram uma linha por descrição, as demais ficam agregadas numa única linha por tag. O parâmetro opcional `termo` filtra por descrição antes de agrupar (mesma rota, sem endpoint novo). No frontend, a tabela do Gantt mostra a descrição **truncada em 50 caracteres** com um _tooltip_ da descrição completa.

Os usuários ganharam três campos exclusivos da versão web (persistidos no `TogglUsuarios.ini`, ignorados pelo console): `sigla`/`cor` (identificação visual nas células do Gantt) e `selecionado` (`bool`, default `true` — só usuários selecionados entram na próxima consulta, seja do relatório ou do Gantt).

### Sprint

`/api/sprints` e `/api/sprint/*` são a terceira visualização — só na versão web, sem equivalente no console, molde do Gantt. Diferente do relatório e do Gantt, tem **gestão** (CRUD de sprints) além do acompanhamento. Cada sprint tem `Nome`, `HorasPorDia`, `DataInicio` e `DataFim` próprios; um mapeamento **global** (não por sprint) de TAG → categoria (`Dev`/`Rev`/`Qa`); e cache de consulta dedicado. Três arquivos INI novos em `dados/` (todos no `.gitignore`/`.dockerignore`):

| Arquivo | Conteúdo |
|---|---|
| `TogglSprints.ini` | seções `[Sprint:<chave>]` — `Nome`, `HorasPorDia` (decimal, `InvariantCulture`), `DataInicio`, `DataFim` (`yyyy-MM-dd`) |
| `TogglSprintCategorias.ini` | seção `[Geral]` — `Dev`/`Rev`/`Qa` = listas de tags separadas por vírgula, mais `Agrupamento` (`descricao`/`tag`/`ambos`) e `TagsDetalhadas` (lista de tags) da etapa "Parâmetros" do fluxo Sprint. `Carregar` nunca devolve `null`: sem arquivo/chave cai no padrão, que **não tem nenhuma TAG** — `Dev`/`Rev`/`Qa` e `TagsDetalhadas` vazias, só `Agrupamento = ambos`. A etapa "Parâmetros" do frontend obriga o usuário a preencher DEV/REV/QA antes de avançar. `ServicoSprint.Montar` usa `Agrupamento`/`TagsDetalhadas` para decidir a chave de linha da grid (descrição normalizada ou nome da tag), mesma regra do `ServicoGant` |
| `TogglSprintData.ini` | cache de consulta — **mesmo formato** do `TogglRelatorioData.ini`/`TogglGantData.ini` (dado cru, token criptografado) |

> O antigo `TogglSprintTarefas.ini` (campos manuais por tarefa: prioridade + situação por categoria) e o endpoint `PUT /api/sprint/tarefas` **foram removidos** — Prioridade e Situação não são mais editáveis nem persistidas, viraram valores fixos exibidos no frontend ("Baixa" / "Pendente"), "sem integração por enquanto".

`POST /api/sprint/consultas` reaproveita o `ServicoConsulta` inteiro (cache-first, rate limit, filtro por `Selecionado`), só troca o arquivo de cache. `GET /api/sprint` monta o acompanhamento por `ServicoSprint.Montar` (núcleo, `Sprint/`):

- **Capacidade por colaborador**: `diasUteis` = dias do período excluindo sábado/domingo; `tempoTotal` = `HorasPorDia × diasUteis`; `margem` = `floor(30% de tempoTotal)`; `TD` (tempo disponível por colaborador) = `floor(tempoTotal − margem)`; `CT` (capacidade total) = `TD × nº de colaboradores selecionados`. Ex.: `HorasPorDia=7`, `2026-09-01`→`2026-09-24` → `diasUteis=18`, `tempoTotal=126`, `margem=37`, `TD=89`, `CT=89` (1 colaborador). O `CabecalhoSprint` traz `Ct` e (após ele) `Td`, mais `TarefasPendentes` (nº de descrições distintas no grid) e `TarefasConcluidas` (**sempre 0** — não há mais situação). O frontend rotula `CT` como "Capacidade" e `TD` como "Tempo por colaborador" (ex-"Total"), exibe uma coluna "Disponível" derivada no cliente, e um botão "Informações" abre um modal com esses números (também sem os rótulos "TD"/"CT"). Os campos de texto do card do sprint (Sprint, Horas/dia, Dias úteis, Margem, Início, Fim) são renderizados maiores e em azul (`primary.main`, a mesma cor da "Capacidade").
- **Colaboradores** (`ResultadoSprint.Colaboradores`): uma linha por colaborador selecionado — `record LinhaColaboradorSprint(NomeExibicao, Sigla, Cor, Td, SegundosRealizados, TarefasPendentes, TarefasConcluidas)` (inalterado; `TarefasConcluidas` sempre 0). `Td` é igual para todos; `SegundosRealizados` = soma das durações `>= 0` de **todos** os apontamentos do usuário no cache do sprint (com ou sem tag de categoria). Colaborador sem nenhum apontamento entra zerado. Sem detalhamento por dia — isso é o Gantt. A tabela de colaboradores do frontend mostra **Colab. (nome completo) · sigla · Tempo por colaborador (`Td`, ex-"Total") · Realizado · Disponível · Pendentes · Concluídas** com rodapé somando Pendentes/Concluídas — "Disponível" = `Tempo por colaborador − Realizado` é calculada no frontend (verde quando positiva, vermelha quando negativa).
- **Grid de tarefas** — `ServicoSprint.Montar` (sem parâmetro `manuais`) emite **uma linha por (tarefa × colaborador)**: `record LinhaTarefaSprint(string Codigo, string Descricao, string NomeExibicao, string Sigla, string Cor, bool Agrupada, BlocoCategoriaSprint Dev, Rev, Qa)`, `record BlocoCategoriaSprint(decimal PreHoras, long ReaSegundos)`. `ChaveAgrupamento(registro, categorias)` devolve `(string Chave, bool Agrupada)`:
  - **Linha de descrição** (`Agrupada == false`): uma por `(descrição normalizada "TEL" × colaborador)`. `Codigo`/`Descricao` de `SepararCodigo` — regex `^(TEL - \d+)(?: - (.+))?$` → `Codigo = "TEL - 0000"`, `Descricao` = resto; sem casar → `Codigo = ""`, `Descricao` = texto inteiro. `ReaSegundos` de cada grupo DEV/REV/QA = tempo desse colaborador nessa descrição cujas tags ∈ `categorias.Dev`/`Rev`/`Qa`.
  - **Linha tag-agg** (`Agrupada == true`, só com `agrupamento` `tag`/`ambos`): uma por `(tag × colaborador)`, `Codigo = ""`, `Descricao` = nome da tag. **Todo** o tempo do colaborador naquela tag vai para **um** grupo: **QA** se o colaborador tem ≥ 1 apontamento no sprint com tag ∈ `categorias.Qa` (pré-passo `colaboradoresComQa`), senão **DEV**. REV nunca recebe tag-agg.
  - **Ordenação**: por **número do código**, não por string (era bug — `TEL - 1118` vinha antes de `TEL - 994`). Helper `NumeroCodigo(string codigo)` extrai só os dígitos de `Codigo`; a grade fica `.ThenBy(t => t.Agrupada ? 0 : NumeroCodigo(t.Codigo))` antes do desempate por string. Linhas de descrição primeiro (as com `Codigo` antes das sem; por `NumeroCodigo` crescente, depois desempate `Codigo`/`Descricao`), depois as tag-agg (pela ordem do colaborador em `usuariosSelecionados`, depois por `Descricao`). Resultado: `TEL - 994 → TEL - 1000 → TEL - 1118`.
  - Frontend: 1ª coluna de **checkbox** (risca a descrição da linha; a marcação fica salva no `localStorage` do navegador **isolada por sprint** — a chave inclui o `chaveSprint` — e só é apagada numa nova consulta real à API, não ao carregar do cache), depois colunas **Prioridade · Situação · Código · Descrição** + grupos DEV/REV/QA (`PRE · REA · badge de sigla · Sit.`). A **linha 1 do cabeçalho de cada grupo** mostra o nome por extenso (**Desenvolvimento / Revisão / Qualidade**); a linha 2 e os dados seguem com DEV/REV/QA / a sigla. O **bloco esquerdo** (Checkbox · Prioridade · Situação · Código · Descrição) **não tem divisória vertical** — a 1ª borda aparece só em Descrição → DEV; as bordas entre/dentro dos grupos DEV/REV/QA continuam. Colunas compactadas (só "Descrição" cresce, com o mesmo `px: 0.5` das demais), **linhas mais baixas** (padding vertical reduzido) e **Situação / PRE / REA / badges centralizados**. **Prioridade** é um badge (componente `BadgeTexto`, mesmo visual do `BadgeSigla`): verde "Baixa" nas linhas normais, laranja "Tag" nas linhas de agrupamento por tag. **Situação** (componente `EtiquetaFixa`): "Pendente" vermelho nas normais, "Tag" laranja nas de agrupamento por tag. A regra **"–" no badge / "Nenhuma" (preto) na situação do grupo** vale para **qualquer linha** cujo grupo DEV/REV/QA não tenha tempo do colaborador (`reaSegundos === 0`) — antes só as linhas de agrupamento por tag; nesses grupos PRE/REA ficam "00h". Nada é editável nem persistido. PRE/REA usam a largura do badge e exibem `00h` (2 dígitos) com `Tooltip` da duração completa; PRE sempre `00h`; o **cabeçalho** de PRE/REA tem `Tooltip` ("Tempo previsto" / "Tempo realizado"). Quando **REA > 0**, o valor fica na cor da Capacidade (`primary.main`) e em negrito. A coluna **Código** é **centralizada** e recebe **zeros à esquerda dinâmicos** — preenchida até o nº de dígitos do maior código do sprint (linhas sem código ficam "—"). O badge de sigla é o componente `BadgeSigla` (sigla colorida, cantos retos), o mesmo do card de colaboradores. Um botão **"Buscar por descrição"** no header (antes do "Informações") abre um filtro **local, client-side** sobre a lista já carregada (colunas Código + Descrição) — sem nova chamada à API e sem trocar de tela, filtrando só a grid de tarefas; difere do Relatório (que abre uma busca própria) e do Gantt (que reconsulta `GET /api/gant?termo=`).

> Melhoria futura (não implementada): a planilha de referência tem também um gráfico de pizza Concluído/Pendente e um gráfico de barras por colaborador.

### Decisões desta camada

- **Minimal APIs**, um arquivo por grupo de endpoints em `Endpoints/` (`Map*Endpoints(this WebApplication app, ...)`), DTOs em `Dtos/` — nenhuma duplicação de lógica: todo endpoint delega para `TogglReport.Nucleo`.
- **Helpers de endpoint extraídos pela auditoria de 2026-09-07** (não são rotas): `ValidacaoDatas.Tenta` (parse de datas + `fim < inicio`, 7 handlers — `GET /api/gant` fora, só faz parse) e `TratamentoIo.Executar` (converte `IOException`/`UnauthorizedAccessException` em `500` com mensagem limpa, 9 sites — `DadosEndpoints` fora, o `try` de lá é mais complexo). Ver `CLAUDE.md` §4.2/§7 item 29.
- **Stateless entre requisições**: a API nunca mantém os registros baixados em memória entre chamadas — toda leitura de relatório/busca **relê o `TogglRelatorioData.ini`**. Isso é o que permite reaproveitar o cache do jeito mais simples possível, sem sessão.
- **CORS liberado** (`AllowAnyOrigin/Header/Method`) — uso exclusivamente local, sem dado sensível trafegando entre origens que importe proteger.
- **Enums serializados como string** (`JsonStringEnumConverter`) — `status` de `/api/consultas` aparece como texto no JSON, não como número.
- **Swashbuckle.AspNetCore** — única dependência NuGet do repositório (necessária para o Swagger; o console continua com zero dependências). A UI do Swagger tem CSS próprio injetado (`SwaggerUIOptions.HeadContent`) e usa o ícone do projeto (servido via `app.UseStaticFiles()`, a única pasta estática da API). Não tem tema escuro nativo — segue o SO/navegador do usuário; uma tentativa de forçar tema claro via `color-scheme` foi testada e revertida por não funcionar na prática (ver `CLAUDE.md` §4.7). Quando a autenticação Basic está ligada, `AddSecurityDefinition`/`AddSecurityRequirement` registram o esquema `basic` só nesse caso (mesma condição do middleware) — é o que faz o botão "Authorize" aparecer no Swagger UI.
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
 ├─ TogglReport.Console/                # console (assembly gerado: TogglReport.exe)
 │   ├─ Program.cs
 │   ├─ Apresentacao/                   # Paleta, Tela, Prompt, Rotulos, AssistenteConfiguracao, MenuTokenUsuario
 │   └─ Relatorios/                     # EscritorRelatorioConsole, EscritorBuscaDescricao (só formatação de texto)
 ├─ TogglReport.Api/                    # Web API
 │   ├─ Program.cs
 │   ├─ Dtos/                           # um record por request/response
 │   ├─ Endpoints/                      # um Map*Endpoints por grupo de rotas (inclui GantEndpoints) + helpers internos ValidacaoDatas (TryParse + fim<inicio) e TratamentoIo (500 em IOException/UnauthorizedAccessException)
 │   ├─ Properties/launchSettings.json
 │   └─ wwwroot/                        # só o ícone do Swagger (images/) e seus favicons
 └─ TogglReport.Nucleo/                 # comum aos dois acima
     ├─ Configuracao/                   # inclui ConfiguracaoGant/CarregadorConfiguracaoGantIni + Sprint/ServicoSprints/CarregadorSprintsIni/ConfiguracaoCategoriasSprint/CarregadorConfiguracaoCategoriasSprintIni + helpers ServicoChaves/DiasUteis/Agrupamento
     ├─ Toggl/
     ├─ Relatorios/
     ├─ Consultas/
     ├─ Gant/                          # ServicoGant + LinhaGant/CelulaGant/ResultadoGant
     └─ Sprint/                        # ServicoSprint + CabecalhoSprint/BlocoCategoriaSprint/LinhaTarefaSprint/LinhaColaboradorSprint/ResultadoSprint (namespace RelatorioToggl.Sprints)
```

## Segurança

`TogglUsuarios.ini`, `TogglRelatorioData.ini`, `TogglGantData.ini` e `TogglSprintData.ini` (gerados por **cada** executável em sua própria pasta `dados/`) guardam API Tokens **criptografados** (AES; chave via `CHAVE_CRIPTOGRAFIA` — renomeada de `TOGGL_CHAVE_CRIPTOGRAFIA` em 2026-09-07, quando a chave padrão embutida também foi rotacionada: tokens gravados sem env var configurada precisam ser reinseridos; ver `CLAUDE.md` §2.4) — os três de cache também o retorno cru das consultas, esse não criptografado. `TogglRelatorioParametros.ini` (agrupamento/tags/período) e os dois demais do Sprint (`TogglSprints.ini`, `TogglSprintCategorias.ini`) não têm dado sensível. Não versione nenhum desses arquivos (já estão no `.gitignore`/`.dockerignore`, em qualquer profundidade de pasta) e trate os que têm token como segredo mesmo assim.

### Variáveis de ambiente em dev (Visual Studio)

As três env vars da API — `AUTH__USUARIO`, `AUTH__SENHA` (autenticação Basic opcional, ambas vazias = sem autenticação) e `CHAVE_CRIPTOGRAFIA` (chave de criptografia dos tokens, vazia = chave padrão embutida) — vão no bloco `environmentVariables` de `TogglReport.Api/Properties/launchSettings.json`, já presentes lá com valor vazio como template. Pela IDE: **Propriedades do projeto → Depurar → "Abrir interface do usuário de perfis de inicialização de depuração" → Variáveis de ambiente**. `AUTH:*` são lidas via `IConfiguration` (o provider de env vars mapeia `AUTH__USUARIO` → `AUTH:USUARIO`); `CHAVE_CRIPTOGRAFIA` é lida direto via `Environment.GetEnvironmentVariable`. Como `launchSettings.json` é versionado, para guardar valores reais sem commitar: `git update-index --skip-worktree toggl-report-back/TogglReport.Api/Properties/launchSettings.json` ou defina as variáveis no ambiente do Windows (o VS herda). Fora de dev, o `docker-compose.yml` lê as três do `.env` da raiz (gitignored; `.env.example` é o template).

## Limitações conhecidas

- App console assume terminal real; com EOF/entrada redirecionada, encerra (não trava), mas não há modo não-interativo.
- Sem paginação: `/me/time_entries` traz tudo do período numa única chamada — períodos muito longos podem ser lentos ou esbarrar em limites de histórico da conta (erro 400).
- Datas são tratadas como dias no fuso local e convertidas para UTC na chamada à API.
- Não resolve nome de projeto/cliente — agrupamento é só por descrição e tag.
- Limite de 30 requisições/hora por usuário é só em memória, **por processo** — console e API têm contadores independentes, e nenhum dos dois persiste entre reinícios.
- A moldura do console só é medida uma vez, na abertura; redimensionar o terminal durante a execução não a readapta.
- Sem testes automatizados.