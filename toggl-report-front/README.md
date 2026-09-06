# toggl-report-front

[← voltar ao README principal](../README.md)

Frontend em **React 19 + TypeScript + MUI** (via Vite) que consome a [Web API do `toggl-report-back`](../toggl-report-back/README.md#web-api-togglreportapi), replicando o mesmo fluxo do console em uma interface gráfica local: parâmetros → consulta → relatório → busca por descrição — mais uma segunda visualização em **Gráfico de Gantt**, com parâmetros e cache próprios.

## Requisitos

- [Node.js](https://nodejs.org/) 20+ e `npm`
- A [Web API](../toggl-report-back/README.md#web-api-togglreportapi) rodando e alcançável no endereço configurado (padrão `http://localhost:5180`; sem ela, as chamadas falham com um aviso na tela — o app não trava)

## Como rodar

```bash
npm install
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
npm run preview   # serve o build de produção localmente
npm run lint      # oxlint
```

## Fluxo da aplicação

Navegação por `Tabs` (MUI): **"Usuários"** (aba fixa, selecionada por padrão na abertura), **"Relatório"** e **"Gant"** — os dois últimos com seu próprio `Stepper` não-linear de 3 etapas, cada uma só liberada depois que a anterior tem o que ela precisa.

**Aba "Usuários"** — lista/adiciona/edita/remove usuários e tokens (`/api/usuarios`), com validação do token contra o Toggl antes de salvar (oferece "salvar mesmo assim" se a validação falhar, igual ao console). Cada usuário tem uma **sigla** e uma **cor** (usadas no Gantt) e um checkbox **"selecionado"** — só usuários selecionados entram na próxima consulta, seja do relatório ou do Gantt. Diálogo de confirmação (`DialogoConfirmacao`) só antes de excluir; sucesso/aviso/erro de criar/editar/excluir usam a notificação global (`useNotificacao`), o mesmo padrão de "Parâmetros salvos" do relatório/Gantt.

**Fluxo "Relatório"**:
1. **Parâmetros** — agrupamento (descrição/tag/ambos), tags detalhadas, período. Carrega `GET /api/configuracao` ao abrir e salva com `PUT /api/configuracao`.
2. **Consultar** — dispara `POST /api/consultas` (com opção "forçar nova consulta à API"); mostra os usuários selecionados que serão consultados.
3. **Relatório** — busca `GET /api/relatorio` automaticamente após a consulta; mostra por descrição/por tag/em andamento por usuário, com indicação se veio do cache. A partir daqui, também é possível buscar por parte da descrição (`GET /api/busca`).

**Fluxo "Gant"** — mesmo esqueleto (Parâmetros → Consultar → Gant), com parâmetros e cache **independentes** do relatório: período + tags a detalhar + agrupamento próprios, consulta em `POST /api/gant/consultas`. A visualização final é uma tabela (não uma lista): linhas agrupadas por usuário → categoria (tag) → descrição, colunas de **dias úteis** (sábado/domingo ocultos), células coloridas com a sigla do usuário. Colapsar/expandir por usuário (inicia colapsado) + "Expandir/Colapsar tudo"; busca por descrição embutida na própria tabela (mesmas cores/colunas/colapso do resultado filtrado, sem layout separado).

`ConsultaPanel` é o **mesmo componente** nos dois fluxos (recebe `resultado`/`consultando`/`executar` como props, e `agrupamento`/`tagsDetalhadas` como opcionais) — não há duplicação entre relatório e Gantt.

Um rodapé (`RodapeDownloads`) linka o download da pasta `dados/` inteira (compactada em `.zip`) e mostra a versão do app.

## Estrutura

```
src/
 ├─ api/            # client HTTP tipado — um módulo por grupo de endpoints (inclui gantApi.ts), + tipos.ts (espelha os DTOs da API)
 ├─ features/        # configuracao/ usuarios/ consulta/ relatorio/ busca/ gant/ dados/ — cada um com hook(s) + componente(s)
 ├─ components/      # peças reutilizáveis entre features (BotaoComCarregamento, DialogoConfirmacao)
 ├─ hooks/            # useNotificacao — snackbar global para erros de API
 ├─ utils/            # duracao.ts (HHhMMmSSs), datas.ts (ISO, "últimos 30 dias", "iniciado às...")
 ├─ theme.ts          # tema MUI único (claro)
 └─ App.tsx           # Tabs (Usuários/Relatório/Gant) + os dois Steppers e a orquestração entre features
```

## Decisões técnicas

- **Wizard (`Stepper`) em vez de rotas** — o fluxo é sequencial como o do console; não há necessidade de navegação livre por URL.
- **`fetch` nativo com wrapper tipado** (`src/api/http.ts`) em vez de uma lib de HTTP — os corpos de erro da API são strings simples (não objetos), tratadas por uma classe `ErroApi` própria.
- **Curadoria de exibição replicada do console, não do back-end**: a API devolve os dados agrupados **crus** (sem ordenação especial); a ordenação "TEL primeiro" e o prefixo `(tag) descrição` de "Por descrição" são calculados no componente (`features/relatorio/curadoria.ts`), nunca alterando os dados vindos da API — mesma separação de responsabilidade que existe entre `ServicoAgrupamento` (dado) e `EscritorRelatorioConsole` (exibição) no back-end.
- **Zero `any`** — todos os formatos de request/response da API estão tipados em `src/api/tipos.ts` (interfaces/union types; sem `enum` do TypeScript, pois `erasableSyntaxOnly` está ativo no `tsconfig`).
- **`RegistroTempoBruto`** (usado em `emAndamento` do relatório) tem campos em **snake_case** (`workspace_id`, `description`, `duration`, ...) — reflete o DTO cru que a API reaproveita do Toggl; todo o resto do contrato é camelCase.
- **Tema único, claro** — sem alternância dia/noite (um tema escuro chegou a existir e foi removido a pedido). Título "TOGGL REPORT" em Montserrat (Semi-Bold + Light), ícone do app na `AppBar`.
- **Gantt não duplica o relatório**: `ConsultaPanel` é compartilhado entre os dois fluxos (props em vez de estado interno); o resultado da busca por descrição do Gantt reaproveita a própria tabela do Gantt (mesmas cores/colunas/colapso), diferente do `BuscaPanel` do relatório, que é uma lista.

## Contrato consumido

A lista completa de endpoints, formatos e códigos de erro está documentada no [README do back-end](../toggl-report-back/README.md#endpoints) — este projeto não duplica essa documentação, só a consome.