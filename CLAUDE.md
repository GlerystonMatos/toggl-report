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
com três visualizações independentes — **Relatório**, **Gráfico de Gantt** e
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
  três campos exclusivos da web: `Sigla` (rótulo curto), `Cor` (hex) e `Selecionado`
  (`bool`, decide quem entra na **próxima consulta** de relatório/Gantt/Sprint).
- **Cache de consulta**: cada visualização tem seu `.ini` de cache próprio
  (`TogglRelatorioData.ini`/`TogglGantData.ini`/`TogglSprintData.ini`, mesmo formato)
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
```

### Regras de domínio importantes

- **`RegistroTempoDto.Duracao`** negativo = timer em execução (isolado por
  `ServicoAgrupamento.ObterEmAndamento`, fora dos totais). Rótulos: `(sem descrição)`,
  `(sem tag)`.
- **Descrições "TEL" são normalizadas já na chave de agrupamento** (não só na
  exibição): "TEL-0000-AA" / "TEL-0000 - AA" / "TEL - 0000 - AA" viram sempre
  "TEL - 0000 - AA" antes de somar tempos (`ServicoAgrupamento.NormalizarDescricaoTel`).
  Só reformata quando há dígitos logo após "TEL" (não mexe em "TELA"/"TELEFONE").
- **Agrupamento** (relatório/Gantt/Sprint): `descricao` | `tag` | `ambos`. Com
  `TagsDetalhadas`/`TagsSelecionadas` preenchidas e agrupamento "ambos": essas tags
  aparecem detalhadas por descrição e ficam fora do agrupamento por tag; as demais só
  aparecem agregadas por tag. "Por descrição" com agrupamento "descricao" puro traz
  tudo (não filtra por `TagsDetalhadas`).
- **Usuários vivem em `TogglUsuarios.ini`**, separado dos parâmetros do relatório —
  compartilhado por relatório, Gantt e Sprint. `TokenApi` é **criptografado em
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
- **Renomear/mudar formato de `.ini` sempre exige migração automática**: o carregador
  correspondente detecta o arquivo antigo na primeira leitura e migra sozinho
  (renomeia ou extrai seções) — nunca exigir ação manual do usuário.

### Sprint — regras de negócio (não óbvias, decididas com o usuário)

Terceira visualização, com **gestão** (CRUD de sprints) além do acompanhamento.
Arquivos próprios: `TogglSprints.ini` (`[Sprint:<chave>]`: Nome/HorasPorDia/DataInicio/
DataFim), `TogglSprintCategorias.ini` (`[Geral]`: mapeamento **global** TAG→categoria
Dev/Rev/Qa + Agrupamento + TagsDetalhadas — sem TAG default, `Padrao()` vem vazio),
`TogglSprintData.ini` (cache, mesmo formato do relatório/Gantt). **Não seguem** o
padrão `Toggl<Domínio>Parametros/Data.ini` do relatório/Gantt — são arquivos novos,
sem "nome antigo" a migrar.

**Cálculo de capacidade** (`ServicoSprint.Montar`):
```
diasUteis  = dias úteis (seg–sex) em [DataInicio, DataFim] inclusive
tempoTotal = HorasPorDia * diasUteis
margem     = floor(30% * tempoTotal)
td         = floor(tempoTotal - margem)      # tempo por colaborador
ct         = td * nº de colaboradores selecionados   # capacidade total
```
Não é "70% do total" nem "70% de 70%" — só a fórmula acima é válida.

**Grid de tarefas**: uma linha por `(Chave, Agrupada)`, `Chave`/`Agrupada` vindos de
`ChaveAgrupamento` (mesma regra descricao/tag/ambos do Gantt, usando
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
- Prioridade/Situação são **valores fixos exibidos** ("Baixa"/"Pendente"), sem edição
  nem persistência.
- Frontend detecta **duplicidade visual** (`calcularColisaoPosicao`, cliente): quando
  a mesclagem abre >1 linha de descrição para a mesma `(codigo, descricao)` por dois
  colaboradores disputarem a mesma posição, Código+Descrição ficam em vermelho —
  **restrito a linhas de descrição**, nunca em linhas de tag (lá a mesclagem já não
  ocorre, então não há duplicidade a marcar).
- **Tachado (checkbox) persistido em `localStorage`**, isolado por sprint (chave
  `sprint-tachados-<chaveSprint>`), único uso de `localStorage` no projeto. Reset só em
  **nova consulta real à API** (`veioDoCache === false`), nunca ao carregar do cache.

---

## 3. `TogglReport.Api`

Minimal APIs (não Controllers), CORS `AllowAny` (uso local), `JsonStringEnumConverter`
global, Swagger em `/swagger` (título "Toggl Report API"). Sobe em
`http://localhost:5180` (porta fixa). `dados/` própria ao lado do executável.

### Endpoints principais

| Método | Rota | Descrição |
|---|---|---|
| `GET/PUT` | `/api/configuracao` | parâmetros do relatório (agrupamento, tags, período) |
| `GET/POST/PUT/DELETE` | `/api/usuarios-toggl` | CRUD de usuários do Toggl; `POST .../validar-token` |
| `POST` | `/api/consultas` | cache-first via `ServicoConsulta`, grava `TogglRelatorioData.ini` |
| `GET` | `/api/relatorio?dataInicio=&dataFim=` | 409 se não há cache exato p/ o período |
| `GET` | `/api/busca?termo=` | busca por descrição sobre o cache |
| `GET` | `/api/dados/download` | zip de toda a pasta `dados/` |
| `POST` | `/api/dados/restaurar` | restaura `dados/` a partir de um `.zip` |
| `GET/PUT` | `/api/gant/parametros` | parâmetros próprios do Gantt |
| `POST` | `/api/gant/consultas` | idem `/api/consultas`, grava `TogglGantData.ini` |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | 409 sem cache; `termo` filtra antes de agrupar |
| `GET/POST/PUT/DELETE` | `/api/sprints` | CRUD de sprints |
| `GET/PUT` | `/api/sprint/categorias` | mapeamento DEV/REV/QA + agrupamento + tags |
| `POST` | `/api/sprint/consultas` | idem, grava `TogglSprintData.ini` |
| `GET` | `/api/sprint?chaveSprint=` | 409 sem cache p/ o período do sprint |

**Erros**: 400 (parâmetros/datas inválidas, agrupamento fora de
`descricao`/`tag`/`ambos`), 404 (recurso não encontrado), 409 (nome em uso; sem cache
correspondente), 500 (`Results.Problem`, falha de I/O). `GET /api/relatorio`/`/busca`/
`/gant`/`/sprint` **exigem cache prévio** — nunca disparam consulta implícita, para
manter explícito quando uma chamada HTTP externa ao Toggl acontece (rate limit).

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
(default `http://localhost:5180`). Navegação por `Tabs`: **Usuários** (fixa,
default), **Relatório**, **Gant**, **Sprint** — os três últimos com `Stepper` próprio
(Sprint tem 4 passos: Sprints → Parâmetros → Consultar → Acompanhamento).

```bash
cd toggl-report-front && npm install && npm run dev   # :5173
npm run build   # tsc -b && vite build
```

### Estrutura

```
src/api/        fetch tipado (http.ts) + tipos espelhando os DTOs/records C#
src/features/   usuariosToggl, configuracao, consulta (compartilhado), relatorio,
                busca, gant, sprint, dados (import/export .zip)
src/components/ peças reusadas entre features (ver lista abaixo)
src/hooks/      bases genéricas de hook (useRecurso, useRecursoEditavel, useColecaoCrud,
                useNotificacao, useExpansao)
src/utils/      duracao.ts (HHhMMmSSs), datas.ts, rotulos.ts, texto.ts, tipografia.ts
theme.ts        tema MUI único, claro — CORES exportado (paleta central)
App.tsx         Tabs + Steppers + estado elevado (configuracao/configuracaoGant/parametrosSprint)
```

**Componentes compartilhados a preferir antes de duplicar**: `BadgeSigla` (badge de
sigla — padrão único do app, cantos retos por default; a tabela "Usuários
selecionados" do `ConsultaPanel` é a única exceção com `sx={{ borderRadius: 1 }}` +
colunas mais próximas — grid DEV/REV/QA e "Colaboradores" do Sprint e o
`AccordionSummary` do Relatório usam o badge padrão; a grade de dias do Gantt usa seu
próprio `<Chip>`, nunca `BadgeSigla`), `CampoTags`, `SelectAgrupamento`, `CabecalhoView`,
`MarcaTogglReport` (logo+wordmark), `AvisoCache`, `EsqueletoCarregando`,
`DialogoConfirmacao`, `ParametrosFormBase`.

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
  `Selecionado` de cada usuário (aba "Usuários"), refletido como lista somente-leitura
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
- **Nomenclatura "Gant" (um "t" só)** é a correta neste projeto, não "Gantt".
- **Mudar a chave padrão embutida de `CHAVE_CRIPTOGRAFIA` rotaciona a criptografia** —
  `.ini` com tokens `enc:` gravados sem a env var configurada precisam ser
  reinseridos após isso.
- Todo `.ini` novo com dado sensível (token) ou de cache precisa entrar no
  `.gitignore`/`.dockerignore` (raiz + `toggl-report-back/`).

---

## 7. Projeto irmão

`C:\Projetos\gerador-chave-nfe` segue as mesmas convenções de estilo (pt-BR, sem
`var`, zero dependências, .NET 10), mas é só um console — sem Web API/frontend, não
espelha §3–§4. O `CLAUDE.md` de cada repositório é a fonte da verdade daquele projeto.
