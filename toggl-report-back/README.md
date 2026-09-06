# toggl-report-back

[← voltar ao README principal](../README.md)

Três projetos **C# / .NET 10** na mesma solução (`TogglReport.slnx`):

| Projeto | Tipo | O que é |
|---|---|---|
| [`TogglReport.Console/`](#console-togglreportconsole) | Console (`Exe`) | O app interativo original |
| [`TogglReport.Api/`](#web-api-togglreportapi) | Web API (Minimal APIs) | Expõe as mesmas funcionalidades por HTTP, sem autenticação |
| [`TogglReport.Nucleo/`](#núcleo-compartilhado-togglreportnucleo) | Biblioteca de classes | Modelos, acesso a INI e regras de negócio comuns aos dois acima |

Console e Web API são interfaces diferentes para a **mesma lógica**: ambos consultam o Toggl Track, fazem cache do retorno cru em arquivos `.ini` dentro de uma pasta `dados/` (ao lado do executável de cada um) e agrupam/buscam sobre esse dado em runtime — nenhum dos dois duplica regra de negócio, tudo que é comum vive em `TogglReport.Nucleo`.

## Índice

- [Requisitos](#requisitos)
- [Compilar a solução](#compilar-a-solução)
- [Console (`TogglReport.Console`)](#console-togglreportconsole)
- [Núcleo compartilhado (`TogglReport.Nucleo`)](#núcleo-compartilhado-togglreportnucleo)
- [Web API (`TogglReport.Api`)](#web-api-togglreportapi)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Segurança](#segurança)
- [Limitações conhecidas](#limitações-conhecidas)

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) ou superior
- Um **API Token** pessoal do Toggl Track para cada usuário que você queira incluir no relatório ([como obter](#como-obter-seu-api-token-do-toggl))

## Compilar a solução

```bash
cd toggl-report-back
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

Na primeira execução, o app guia você por um cadastro inicial (agrupamento padrão, usuários/tokens, período) e cria a pasta `dados/` ao lado do executável. Nas execuções seguintes, carrega o `dados/TogglReport.ini` já existente e, se houver um `dados/ToggleData.ini` da última consulta com o mesmo período e usuários, oferece reaproveitá-lo.

### Funcionalidades

- Relatório por usuário, agrupado por **descrição**, por **tag**, ou ambos.
- **Tags configuradas aparecem detalhadas em "Por descrição" e saem de "Por tag"**: você escolhe quais tags (com agrupamento "ambos"); as demais ficam de fora de "Por descrição" (só entram no total de "Por tag").
- **Descrições de ticket "TEL" sempre no mesmo formato**: "TEL-0000-AA", "TEL-0000 - AA" etc. viram "TEL - 0000 - AA" — já na hora de somar os tempos, não só na exibição.
- Identifica e lista separadamente entradas com **timer ainda em execução** (não entram nos totais).
- **Cache de consulta** (`dados/ToggleData.ini`): o retorno cru da última consulta de cada usuário fica salvo; se o período e os usuários da próxima execução forem iguais, o app oferece carregar do cache em vez de consultar a API de novo (o agrupamento e os cálculos rodam sempre em cima do dado, cacheado ou não — o cache nunca guarda um resultado já processado).
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
║ RELATÓRIO TOGGL · por Gleryston Matos · v1.0.0.0                                                   ║
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

### Cache de consulta (`ToggleData.ini`)

Depois de uma consulta bem-sucedida, o app grava o retorno cru da API (sem nenhum agrupamento ou cálculo aplicado) em `dados/ToggleData.ini`. Na próxima execução, se o período e o conjunto de usuários/tokens confirmados forem **exatamente iguais** aos da última consulta salva, o app pergunta:

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

Busca por substring, case-insensitive, sobre os dados **já baixados** (sem nova chamada à API). Cada descrição aparece com o total somado de todos os usuários; abaixo dela, uma linha por usuário que tem tempo lançado ali, ordenadas por tempo decrescente. Depois de cada busca: **voltar ao relatório completo**, **nova busca** ou **continuar**.

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
| `Configuracao/` | `ConfiguracaoApp`/`ConfiguracaoUsuario` (modelo do `TogglReport.ini`), `CarregadorConfiguracaoIni`, `CacheConsulta`/`UsuarioCacheado` (modelo do `ToggleData.ini`), `CarregadorCacheIni`, `AnalisadorIni` (parser de INI compartilhado), `CaminhosDados` (monta os caminhos `dados/TogglReport.ini` e `dados/ToggleData.ini` a partir do diretório base de quem chama), `ServicoUsuarios` (gerar chave única, checar nome em uso, mascarar token) |
| `Toggl/` | `ClienteApiToggl` (HTTP Basic contra `api.track.toggl.com/api/v9`), `RegistroTempoDto`, `ResultadoApiToggl`, `LimitadorRequisicoes` (limite de 30 req/hora, em memória, por processo) |
| `Relatorios/` | `ServicoAgrupamento` (por descrição/tag, normalização "TEL"), `LinhaDescricao`, `ServicoBuscaDescricao`, `LinhaBusca`, `ResultadoBuscaDescricao` — tudo puro, devolve dados, nunca texto formatado |
| `Consultas/` | `ServicoConsulta` — decide cache×API e aplica o rate limiter; `ResultadoConsulta`, `EventoConsultaUsuario`, `StatusConsultaUsuario` |

`ServicoConsulta` é o ponto mais importante: tanto o console quanto a Web API chamam os mesmos métodos (`CarregarCacheSeExistente`, `CacheCorrespondeAosParametros`, `CarregarRegistrosDoCache`, `ConsultarUsuariosAsync`, `SalvarCache`) — cada um decide sozinho **quando** chamar cada um (o console via prompt interativo, a API via um parâmetro de requisição), mas a regra em si (o que conta como "mesmo período/usuários", quando usar cache, como tratar o rate limit) existe em um único lugar.

Este projeto **nunca** referencia `Console`, `Paleta` ou `Tela` — só lógica pura e acesso a arquivo.

---

## Web API (`TogglReport.Api`)

API HTTP local (Minimal APIs, ASP.NET Core), **sem autenticação** — expõe as mesmas funcionalidades do console para consumo do [frontend](../toggl-report-front/README.md) ou de qualquer outro cliente HTTP local.

### Como rodar

```bash
dotnet run --project TogglReport.Api
```

Sobe em `http://localhost:5180` (porta fixa, `Properties/launchSettings.json`). Swagger/OpenAPI em **`http://localhost:5180/swagger`** — documenta todos os endpoints com parâmetros, respostas e exemplos, sem exigir autenticação.

Cria sua **própria** pasta `dados/` (ao lado do executável da API) — independente da pasta `dados/` do console. Cada processo tem seu próprio arquivo `TogglReport.ini`/`ToggleData.ini` e seu próprio contador de rate limit; rodar os dois ao mesmo tempo não compartilha estado.

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
| `GET` | `/api/dados/download/configuracao` | Baixa o `TogglReport.ini` cru |
| `GET` | `/api/dados/download/cache` | Baixa o `ToggleData.ini` cru |
| `GET` | `/api/gant/parametros` | Período, tags a detalhar e agrupamento do **Gantt** (independente do relatório) |
| `PUT` | `/api/gant/parametros` | Atualiza os parâmetros do Gantt |
| `POST` | `/api/gant/consultas` | Igual a `/api/consultas`, mas grava em `ToggleGantData.ini` |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | Gantt agrupado por usuário/categoria/descrição, dia a dia (só dias úteis); `termo` filtra por descrição |

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

**`GET /api/relatorio?dataInicio=2026-08-01&dataFim=2026-08-31`** — 409 se não houver consulta salva para esse período exato (chame `POST /api/consultas` primeiro); 200 com, por usuário, `porDescricao`, `porTag`, `emAndamento` e `totalSegundos`. **Atenção**: os itens de `emAndamento` vêm em **snake_case** (`workspace_id`, `project_id`, `description`, `duration`, `start`, `stop`) — é o DTO cru reaproveitado do Toggl, diferente do resto da API que é camelCase.

**`GET /api/busca?termo=reuniao`** — 409 se não há cache ainda; 200 com `linhas` (descrição, segundos por usuário, total da linha) e `totalGeralSegundos`.

### Gráfico de Gantt

`/api/gant/*` é um segundo fluxo, com parâmetros (`ConfiguracaoGant`: período + tags a detalhar + agrupamento) e cache (`dados/ToggleGantData.ini`) **independentes** do relatório — reaproveita a mesma lista de usuários e o mesmo `ServicoConsulta`, só troca o arquivo de cache. `GET /api/gant` devolve `{ dias, linhas }`: `dias` são só os **dias úteis** do período (sábado/domingo ocultos); cada linha pertence a um único usuário, agrupada por categoria (tag) + descrição — tags na lista "a detalhar" viram uma linha por descrição, as demais ficam agregadas numa única linha por tag. O parâmetro opcional `termo` filtra por descrição antes de agrupar (mesma rota, sem endpoint novo).

Os usuários ganharam três campos exclusivos da versão web (persistidos no mesmo `TogglReport.ini`, ignorados pelo console): `sigla`/`cor` (identificação visual nas células do Gantt) e `selecionado` (`bool`, default `true` — só usuários selecionados entram na próxima consulta, seja do relatório ou do Gantt).

### Decisões desta camada

- **Minimal APIs**, um arquivo por grupo de endpoints em `Endpoints/` (`Map*Endpoints(this WebApplication app, ...)`), DTOs em `Dtos/` — nenhuma duplicação de lógica: todo endpoint delega para `TogglReport.Nucleo`.
- **Stateless entre requisições**: a API nunca mantém os registros baixados em memória entre chamadas — toda leitura de relatório/busca **relê o `ToggleData.ini`**. Isso é o que permite reaproveitar o cache do jeito mais simples possível, sem sessão.
- **CORS liberado** (`AllowAnyOrigin/Header/Method`) — uso exclusivamente local, sem dado sensível trafegando entre origens que importe proteger.
- **Enums serializados como string** (`JsonStringEnumConverter`) — `status` de `/api/consultas` aparece como texto no JSON, não como número.
- **Swashbuckle.AspNetCore** — única dependência NuGet do repositório (necessária para o Swagger; o console continua com zero dependências). A UI do Swagger tem CSS próprio injetado (`SwaggerUIOptions.HeadContent`) e usa o ícone do projeto (servido via `app.UseStaticFiles()`, a única pasta estática da API).
- **Sem autenticação/autorização** — por design, para uso local.

---

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
 │   ├─ Endpoints/                      # um Map*Endpoints por grupo de rotas (inclui GantEndpoints)
 │   ├─ Properties/launchSettings.json
 │   └─ wwwroot/                        # só o ícone do Swagger (images/) e seus favicons
 └─ TogglReport.Nucleo/                 # comum aos dois acima
     ├─ Configuracao/                   # inclui ConfiguracaoGant/CarregadorConfiguracaoGantIni
     ├─ Toggl/
     ├─ Relatorios/
     ├─ Consultas/
     └─ Gant/                          # ServicoGant + LinhaGant/CelulaGant/ResultadoGant
```

## Segurança

`TogglReport.ini` e `ToggleData.ini` (gerados por **cada** executável em sua própria pasta `dados/`) guardam API Tokens em **texto puro** (o segundo também o retorno cru das consultas). Não versione esses arquivos (já estão no `.gitignore`, em qualquer profundidade de pasta) e trate-os como segredo.

## Limitações conhecidas

- App console assume terminal real; com EOF/entrada redirecionada, encerra (não trava), mas não há modo não-interativo.
- Sem paginação: `/me/time_entries` traz tudo do período numa única chamada — períodos muito longos podem ser lentos ou esbarrar em limites de histórico da conta (erro 400).
- Datas são tratadas como dias no fuso local e convertidas para UTC na chamada à API.
- Não resolve nome de projeto/cliente — agrupamento é só por descrição e tag.
- Limite de 30 requisições/hora por usuário é só em memória, **por processo** — console e API têm contadores independentes, e nenhum dos dois persiste entre reinícios.
- A moldura do console só é medida uma vez, na abertura; redimensionar o terminal durante a execução não a readapta.
- Sem testes automatizados.
