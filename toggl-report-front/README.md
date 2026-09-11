# toggl-report-front

[← voltar ao README principal](../README.md)

Frontend em **React 19 + TypeScript + MUI** (via Vite) que consome a [Web API do `toggl-report-back`](../toggl-report-back/README.md#web-api-togglreportapi), com o fluxo completo em uma interface gráfica local: parâmetros → consulta → relatório → busca por descrição — mais uma segunda visualização em **Gráfico de Gantt** e uma terceira em **Sprint** (gestão de sprints + acompanhamento de capacidade e tarefas), cada uma com parâmetros e cache próprios.

## Requisitos

- [Node.js](https://nodejs.org/) 20+ e `npm`
- A [Web API](../toggl-report-back/README.md#web-api-togglreportapi) rodando e alcançável no endereço configurado (padrão `http://localhost:5180`; sem ela, as chamadas falham com um aviso na tela — o app não trava)

## Como rodar

```bash
npm install
```

```bash
npm run dev       # http://localhost:5173, com hot reload
```

### Configurando o endereço do backend

O endereço da Web API é lido da variável de ambiente `VITE_API_URL` (mecanismo
padrão do Vite — só tem efeito se estiver definida **antes** do build/dev
server subir). Sem ela, o app usa `http://localhost:5180`.

Para desenvolvimento local com um endereço diferente, copie `.env.example`
para `.env` e ajuste o valor:

```bash
cp .env.example .env
```

Via Docker (`docker-compose.yml` na raiz do repositório), a variável é passada
como **build arg** do serviço `toggl_report_web`, apontando para a porta que
a Api publica no host (`http://localhost:5003`) — não para o nome do serviço
na rede interna do Compose, já que as chamadas partem do navegador do
usuário, não de dentro do container.

Outros scripts:

```bash
npm run build     # tsc -b && vite build — gera dist/
```

```bash
npm run preview   # serve o build de produção localmente
```

```bash
npm run lint      # oxlint
```

## Fluxo da aplicação

Se a Web API exigir autenticação (`AUTH__USUARIO`/`AUTH__SENHA` configurados —
não é o padrão, ver [README do back-end](../toggl-report-back/README.md#segurança)),
o app mostra uma tela de login própria antes de tudo (`src/features/auth/`)
— sem autenticação configurada na API, pula direto para o fluxo normal. A
tela de login reaproveita o mesmo cabeçalho (`AppBar`) da aplicação — mesma
cor de fundo, logo ao lado do nome "TOGGL REPORT" na mesma fonte (Montserrat
Semi-Bold + Light) — em vez de um estilo próprio.

Se não houver nenhum usuário cadastrado na primeira verificação após abrir o
app, um diálogo (`ImportarDadosDialog`, `src/features/dados/`) oferece
restaurar a pasta `dados/` a partir de um backup `.zip`
(`POST /api/dados/restaurar`) ou seguir sem importar e cadastrar tudo
manualmente pelo fluxo normal — só aparece uma vez por sessão, não a cada
vez que a lista de usuários fica vazia. O `.zip` precisa ter os arquivos
direto na raiz (não uma pasta `dados/` por dentro) — a API rejeita com 400
caso contrário.

O mesmo `ImportarDadosDialog` também é reaproveitado pelo rodapé (botão
**"Importar dados (.zip)"** ao lado de "Baixar dados (.zip)") para reimportar
**mesmo com a pasta `dados/` já populada** — ajuste os `.ini` à mão e reenvie.
`POST /api/dados/restaurar` sobrescreve só os arquivos presentes no `.zip`
(os demais, inclusive os caches de consulta `TogglRelatorioData.ini` /
`TogglGantData.ini` / `TogglSprintData.ini`, ficam intactos), e não há
invalidação de cache atrelada à importação — deixe os arquivos de cache fora
do `.zip` a menos que queira substituí-los. Ao concluir, o rodapé recarrega a
página para o estado em memória refletir os arquivos novos.

Navegação por `Tabs` (MUI): **"Usuários"** (aba fixa, selecionada por padrão na abertura), **"Relatório"**, **"Gant"** e **"Sprint"** — os três últimos com seu próprio `Stepper` não-linear, cada etapa só liberada depois que a anterior tem o que ela precisa (Relatório e Gant têm 3 etapas; Sprint tem 4).

**Aba "Usuários"** — lista/adiciona/edita/remove **usuários do Toggl** e seus tokens (`/api/usuarios-toggl`), com validação do token contra o Toggl antes de salvar (oferece "salvar mesmo assim" se a validação falhar). A listagem é uma **tabela** (`<Table>`) com colunas próprias — checkbox "selecionado" · Nome · Sigla (badge `BadgeSigla`) · Token (`Chip`) · Ações (editar/remover). A sigla/cor de cada usuário aparece hoje em toda a aplicação (não só no Gantt): na tabela "Colaboradores"/grid do Sprint, na tabela "Usuários selecionados" da tela de consulta (Relatório/Gantt/Sprint) e ao lado do nome nos grupos do Relatório — sempre com o mesmo componente `BadgeSigla` de cantos retos (`borderRadius: 0`), **exceto** a tabela "Usuários selecionados", que aplica um leve arredondamento (`borderRadius: 1`) e colunas mais próximas — e a grade de dias do Gantt, que usa sua própria célula colorida (`<Chip>`), não `BadgeSigla`. Diálogo de confirmação (`DialogoConfirmacao`) só antes de excluir; sucesso/aviso/erro de criar/editar/excluir usam a notificação global (`useNotificacao`), o mesmo padrão de "Parâmetros salvos" do relatório/Gantt.

**Fluxo "Relatório"**:
1. **Parâmetros** — agrupamento (descrição/tag/ambos), tags detalhadas, período. Carrega `GET /api/configuracao` ao abrir e salva com `PUT /api/configuracao`.
2. **Consultar** — dispara `POST /api/consultas` (com opção "forçar nova consulta à API"); mostra os usuários selecionados que serão consultados.
3. **Relatório** — busca `GET /api/relatorio` automaticamente após a consulta; um `<Accordion>` por usuário (badge de sigla + nome destacado em azul + Chip do total), com indicação se veio do cache. A partir daqui, também é possível buscar por parte da descrição (`GET /api/busca`). O corpo de cada usuário é **uma tabela real** (`<Table>` compacta, estilo Sprint/Gantt), **sem títulos de seção "Por descrição"/"Por tag"**: colunas fixas `[checkbox] · Tag · Descrição · Tempo`, com as linhas agregadas **por descrição** primeiro e depois as **por tag** (essas com a Descrição vazia — só Tag + Tempo), conforme o agrupamento escolhido. A descrição aparece crua (sem prefixo) e **célula sem valor fica vazia** (sem `"—"`). Registros **em andamento** ficam num bloco pequeno abaixo da tabela.

**Fluxo "Gant"** — mesmo esqueleto (Parâmetros → Consultar → Gant), com parâmetros e cache **independentes** do relatório: período + tags a detalhar + agrupamento próprios, consulta em `POST /api/gant/consultas`. A visualização final é uma tabela (não uma lista): linhas agrupadas por usuário → categoria (tag) → descrição, colunas de **dias úteis** (sábado/domingo ocultos), células coloridas com a sigla do usuário. Colapsar/expandir por usuário (inicia colapsado) + "Expandir/Colapsar tudo"; busca por descrição embutida na própria tabela (mesmas cores/colunas/colapso do resultado filtrado, sem layout separado). Linhas mais compactas e descrição **truncada em 50 caracteres** com um _tooltip_ da descrição completa.

**Fluxo "Sprint"** — mesmo esqueleto do Gantt, mas com **gestão** e uma etapa a mais (Sprints → Parâmetros → Consultar → Acompanhamento):
1. **Sprints** — CRUD de sprints (listagem na tela, cadastro/edição em modal — `SprintFormDialog`, mesmo padrão do cadastro de usuários) e seleção de **1** sprint (radio/linha clicável). Cada sprint tem nome, horas/dia e período próprios (`/api/sprints`).
2. **Parâmetros** — o agrupamento (`descrição`/`tag`/`ambos`) e as tags para detalhar por descrição (mesmo padrão do Relatório/Gantt), mais o mapeamento **global** TAG → categoria (DEV/REV/QA, 3 `Autocomplete`), numa etapa própria. Tudo vem de `/api/sprint/categorias` (sem config, as listas vêm **vazias** e o agrupamento `ambos`) e vale para todos os sprints; o **agrupamento** decide se a grid do acompanhamento lista por descrição ou por tag (as **tags detalhadas** entram só quando o agrupamento é `ambos`), mesma regra do Gantt. Rodapé molde `ParametrosForm`/`ParametrosGantForm` do Relatório/Gantt: **Voltar** / **Continuar** (só navega) / **Salvar e continuar** (`PUT /api/sprint/categorias` e avança) — os dois de avanço ficam **bloqueados** enquanto DEV, REV ou QA estiver sem nenhuma TAG (um aviso pede o preenchimento das 3), além de sem usuário cadastrado.
3. **Consultar** — `POST /api/sprint/consultas`, cache próprio (`TogglSprintData.ini`), independente do relatório/Gantt. A tela mostra o agrupamento, as tags detalhadas e as categorias configuradas (DEV / REV / QA).
4. **Acompanhamento** — `GET /api/sprint`: card do sprint em **linha única** (rola na horizontal quando não cabe) com o resumo (horas/dia, dias úteis, margem, início/fim — cada valor em fonte maior e azul, a mesma cor da "Capacidade") e três destaques — **Pendentes** e **Concluído** (vermelho/verde, vindas de tokens no tema — `CORES.corPendente`/`corConcluido` em `theme.ts`; "Concluído" fica sempre 0 — situação fixa "por enquanto") e **Capacidade** (ex-"CT", mesmo valor); um **card de colaboradores** (nome completo · sigla colorida quadrada · **Tempo por colaborador** (ex-"Total"/"TD") · Realizado · **Disponível** · Pendentes · Concluídas, sem colunas por dia — "Disponível" = Tempo por colaborador − Realizado, calculada no frontend, verde quando positiva, vermelha quando negativa, neutra em zero; as colunas **Disponível, Pendentes e Concluídas** ficam **sempre em negrito**, mesmo neutras/zeradas; rodapé com a soma de Pendentes e Concluídas); e um **grid** de tarefas — uma linha por descrição/tag; **só em linhas de descrição** colaboradores diferentes que ocupam categorias (DEV/REV/QA) diferentes mesclam numa mesma linha (só continuam separados quando dois disputam a mesma categoria) — **linhas de agrupamento por tag nunca mesclam colaboradores**, cada um sempre com sua própria linha, independente da posição —, com rolagem horizontal, **mais compacto** (linhas mais baixas, só "Descrição" cresce, com o mesmo padding horizontal das demais colunas), uma 1ª coluna de **checkbox** e as colunas **Prioridade · Situação · Código · Descrição** + grupos **DEV / REV / QA** (`PRE`, `REA`, badge com a sigla de quem apontou, situação). A **linha 1 do cabeçalho de cada grupo** mostra o nome por extenso — **Desenvolvimento / Revisão / Qualidade**; a linha 2 e as células de dados seguem com DEV/REV/QA / a sigla. Os títulos **Prioridade, Situação, Código e Descrição** ficam alinhados na parte de baixo da célula de cabeçalho. O **bloco esquerdo** (Checkbox · Prioridade · Situação · Código · Descrição) **não tem divisória vertical entre suas colunas** — a 1ª borda da grid aparece só em Descrição → DEV; as bordas entre e dentro dos grupos DEV/REV/QA continuam. As colunas **Situação, PRE, REA e os badges DEV/REV/QA** têm o conteúdo **centralizado**. O **checkbox** risca a descrição da linha; a marcação fica **salva no navegador** (`localStorage`) **isolada por sprint** (a chave inclui o identificador do sprint) e só é apagada numa **nova consulta real à API do Toggl** (não ao carregar do cache local). **Prioridade** virou um **badge** (mesmo visual do badge de sigla), centralizado: verde "Baixa" nas linhas normais, laranja "Tag" nas linhas de agrupamento por tag. **Situação** (geral e por grupo) é um valor fixo exibido: vermelho "Pendente" nas linhas normais, laranja "Tag" nas de agrupamento por tag. A regra **"–" no badge / "Nenhuma" (preto) na situação do grupo** vale para **qualquer linha** cujo grupo DEV/REV/QA não tenha tempo do colaborador (antes só as de agrupamento por tag); nesses grupos PRE/REA ficam `00h`. Nada é editável nem persistido ("sem integração por enquanto"). **PRE** e **REA** usam a largura da coluna de badge e mostram o valor como `00h` (2 dígitos) com um _tooltip_ da duração completa — PRE é sempre `00h`; o **cabeçalho** de PRE/REA também tem _tooltip_ ("Tempo previsto" / "Tempo realizado"). Quando **REA é maior que zero**, o valor fica na **cor da Capacidade** (`primary.main`, `#5B82F6`) e em negrito. **Código** e **Descrição** são colunas separadas (não há coluna "Tag" — nas linhas agregadas por tag o nome da tag aparece na "Descrição"); a coluna **Código** é **centralizada** e recebe **zeros à esquerda dinâmicos** — cada número é preenchido até o nº de dígitos do maior código presente naquele sprint (ex.: com o maior em `TEL - 1118`, aparecem `TEL - 0994`, `TEL - 1000`, `TEL - 1118`); linhas sem código ficam `"—"`. Quando a mesma descrição aparece em **mais de uma linha** porque dois colaboradores disputam a **mesma** posição DEV/REV/QA, o **código e a descrição dessas linhas ficam em vermelho** (o mesmo token de "Pendentes", mesma condição nas duas colunas) — só o código tem um _tooltip_ explicando o motivo — detecção em `calcularColisaoPosicao` (`features/sprint/calculos.ts`); linha extra só vazia não conta. A grid é ordenada pelo **número do código** (ex.: `TEL - 994` antes de `TEL - 1118`). Um botão **"Buscar por descrição"** no cabeçalho (antes do "Informações") abre um campo "Filtrar por código ou descrição" — é um **filtro local, no cliente**, sobre a lista já carregada (colunas **Código** e **Descrição**), **sem nova consulta à API** e **sem trocar de tela**: só a grid de tarefas é filtrada (o card do sprint e o card de colaboradores não), e sem correspondência aparece um aviso "Nenhuma linha corresponde ao filtro". Difere do Relatório (que abre a busca própria) e do Gantt (que reconsulta `GET /api/gant?termo=`). Um botão **"Informações"** no cabeçalho abre um diálogo "Como este sprint é calculado" com os números reais do sprint (Tempo Total, Margem, Tempo por colaborador, Capacidade), as categorias DEV/REV/QA + agrupamento e as regras de montagem da grid (inclui os tooltips de PRE/REA, o REA destacado na cor da Capacidade, o zero-padding do código e a busca local).

`ConsultaPanel` é o **mesmo componente** nos três fluxos (recebe `resultado`/`consultando`/`executar` como props, e `agrupamento`/`tagsDetalhadas`/`categorias` como opcionais — `categorias` = `{ dev, rev, qa }`, só o Sprint passa) — não há duplicação entre relatório, Gantt e Sprint.

Um rodapé (`RodapeDownloads`) baixa a pasta `dados/` inteira (compactada em `.zip`) e mostra a versão do app — via `fetch` autenticado + blob (não um link direto: sem isso, a credencial nunca é anexada e o download falha com 401, já que a API não usa `WWW-Authenticate`/cookie). Ao lado dele há o botão **"Importar dados (.zip)"**, que reaproveita o `ImportarDadosDialog` para reimportar sobre a pasta `dados/` já populada (ver acima).

## Estrutura

```
src/
 ├─ api/            # client HTTP tipado — um módulo por grupo de endpoints (inclui gantApi.ts, sprintsApi.ts, categoriasSprintApi.ts, sprintApi.ts), + tipos.ts (espelha os DTOs da API)
 ├─ features/        # configuracao/ usuariosToggl/ consulta/ relatorio/ busca/ gant/ sprint/ (SprintsPanel + SprintFormDialog + CategoriasSprintPanel + SprintView + tachados.ts — único uso de localStorage do projeto) dados/ (RodapeDownloads + ImportarDadosDialog) — cada um com hook(s) + componente(s)
 ├─ components/      # peças reutilizáveis entre features — BotaoComCarregamento, DialogoConfirmacao, e (extraídos na auditoria de 2026-09-07) AvisoCache, EsqueletoCarregando, CreditoApp, MarcaTogglReport (logo + wordmark), BadgeSigla, CabecalhoView, CampoTags, SelectAgrupamento, ParametrosFormBase (corpo compartilhado do form de Parâmetros — ParametrosForm/ParametrosGantForm viraram wrappers finos)
 ├─ hooks/            # useNotificacao (snackbar global) + base compartilhada de recurso (2026-09-07): useRecurso (useRelatorio/useGant/useSprint), useRecursoEditavel (useConfiguracao/useParametrosGant/useCategoriasSprint), useColecaoCrud (useUsuariosToggl/useSprints), useExpansao (RelatorioView/GantView); useConsultaGenerica fica em features/consulta/
 ├─ utils/            # duracao.ts (HHhMMmSSs), datas.ts (ISO, "últimos 30 dias", "iniciado às...", formatarDiaCurto), rotulos.ts (OPCOES_AGRUPAMENTO), texto.ts (truncar), tipografia.ts (FONTE_MARCA)
 ├─ theme.ts          # tema MUI único (claro) — exporta CORES (era privado)
 └─ App.tsx           # Tabs (Usuários/Relatório/Gant/Sprint) + os três Steppers e a orquestração entre features
```

## Decisões técnicas

- **Wizard (`Stepper`) em vez de rotas** — o fluxo é sequencial; não há necessidade de navegação livre por URL.
- **`fetch` nativo com wrapper tipado** (`src/api/http.ts`) em vez de uma lib de HTTP — os corpos de erro da API são strings simples (não objetos), tratadas por uma classe `ErroApi` própria.
- **Curadoria de exibição replicada aqui, não pedida ao back-end**: a API devolve os dados agrupados **crus** (sem ordenação especial); a ordenação "TEL primeiro" de "Por descrição" é calculada no componente (`features/relatorio/curadoria.ts`), nunca alterando os dados vindos da API — mesma separação de responsabilidade que existe entre `ServicoAgrupamento` (dado) e a camada de exibição no back-end. O frontend mostra a descrição crua e a tag numa coluna própria — `curarPorDescricao` devolve `{ chave, descricao, tag, segundos }`. A exibição (`RelatorioUsuarioCard`) é uma `<Table>` — a curadoria/ordenação/agrupamento não mudou, só a forma de renderizar.
- **Zero `any`** — todos os formatos de request/response da API estão tipados em `src/api/tipos.ts` (interfaces/union types; sem `enum` do TypeScript, pois `erasableSyntaxOnly` está ativo no `tsconfig`).
- **`RegistroTempoBruto`** (usado em `emAndamento` do relatório) tem campos em **snake_case** (`workspace_id`, `description`, `duration`, ...) — reflete o DTO cru que a API reaproveita do Toggl; todo o resto do contrato é camelCase.
- **Tema único, claro** — sem alternância dia/noite (um tema escuro chegou a existir e foi removido a pedido). Título "TOGGL REPORT" em Montserrat (Semi-Bold + Light), ícone do app na `AppBar`.
- **Gantt não duplica o relatório**: `ConsultaPanel` é compartilhado entre os dois fluxos (props em vez de estado interno); o resultado da busca por descrição do Gantt reaproveita a própria tabela do Gantt (mesmas cores/colunas/colapso), diferente do `BuscaPanel` do relatório, que é uma lista.
- **Login sem popup nativo do navegador**: a API nunca manda `WWW-Authenticate` no 401, então o navegador não abre o prompt padrão de Basic Auth — o app trata o 401 e mostra `LoginScreen` própria, com o mesmo cabeçalho (`MarcaTogglReport`) do resto do app, não um estilo à parte. Credencial fica em `sessionStorage` (não `localStorage`) — some ao fechar a aba.
- **Base compartilhada de hooks e forms (auditoria de 2026-09-07)**: os hooks de recurso/consulta/coleção têm um núcleo comum (`useRecurso`/`useRecursoEditavel`/`useColecaoCrud`/`useConsultaGenerica`/`useExpansao`) e cada hook antigo virou um wrapper fino; o corpo do form de Parâmetros virou `ParametrosFormBase`, com `ParametrosForm`/`ParametrosGantForm` só mapeando `tagsDetalhadas` ⇄ `tagsSelecionadas`. Não foram unificados `useBusca` (assinatura divergente) nem `SprintsPanel`/`UsuariosTogglPanel` (a abstração genérica seria quase toda encanamento, risco em 2 telas centrais). Antes de duplicar um hook/componente, procurar em `src/components`/`src/hooks`/`src/utils`. Ver `CLAUDE.md` §5.3/§7 item 29.
- **Upload de `.zip` reaproveita o wrapper HTTP, não uma lib nova**: `http.postArquivo` (`src/api/http.ts`) monta um `FormData` e faz o próprio `fetch`, porque o restante do wrapper (`http.get/post/put/delete`) sempre serializa o corpo como JSON — mas segue a mesma lógica de credencial/401 dos demais métodos.
- **Download também é `fetch` próprio (`http.getArquivo`), não um `<a href>` simples**: lê o corpo como `Blob` e o nome do arquivo do header `Content-Disposition`, e `dadosApi.baixarDados` dispara o download via `URL.createObjectURL` + um `<a>` temporário — necessário porque um link de navegação direta nunca carrega a credencial (mesmo motivo do login sem popup nativo, ver `LoginScreen`).

## Contrato consumido

A lista completa de endpoints, formatos e códigos de erro está documentada no [README do back-end](../toggl-report-back/README.md#endpoints) — este projeto não duplica essa documentação, só a consome.