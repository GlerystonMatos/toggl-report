# CLAUDE.md

Memória de contexto persistente do repositório **toggl-report**. Serve para orientar
qualquer sessão futura sem precisar reexplicar as decisões já tomadas.

O repositório reúne **dois projetos independentes**:

- **`toggl-report-back/`** — três projetos **C# / .NET 10** na mesma solução
  (`TogglReport.slnx`): o console original (`TogglReport.Console`), uma Web API sem
  autenticação que expõe as mesmas funcionalidades (`TogglReport.Api`), e uma
  biblioteca comum aos dois (`TogglReport.Nucleo`).
- **`toggl-report-front/`** — frontend **React 19 + TypeScript + MUI** (Vite) que
  consome a Web API, replicando o fluxo do console numa interface gráfica.

Este arquivo cobre os dois. §2–§4 tratam do `toggl-report-back` (console, núcleo,
API); §5 trata do `toggl-report-front`; §6 em diante são transversais aos dois
(decisões, histórico, `.gitignore`, convenções, projeto irmão).

---

## 1. Visão geral do repositório

Aplicação que gera relatórios de tempo trabalhado a partir da **API v9 do Toggl
Track**, agrupando por descrição e/ou tag, por usuário, em um período informado —
hoje com **duas interfaces** para a mesma funcionalidade (console e Web API +
frontend web), compartilhando a mesma lógica de negócio e o mesmo formato de
persistência em INI.

- **Console** (`toggl-report-back/TogglReport.Console`, assembly `TogglReport`): totalmente interativo, um
  assistente guia a configuração e persiste tudo em `dados/TogglRelatorioParametros.ini`, ao
  lado do executável.
- **Web API** (`toggl-report-back/TogglReport.Api`): mesmas funcionalidades por
  HTTP, sem autenticação, documentada via Swagger, com sua **própria** pasta
  `dados/`.
- **Núcleo compartilhado** (`toggl-report-back/TogglReport.Nucleo`): modelos,
  acesso a INI, cliente HTTP do Toggl e as regras de agrupamento/busca/decisão de
  cache — referenciado pelos dois acima, nenhuma duplicação de lógica de negócio.
- **Frontend** (`toggl-report-front`): consome a Web API, replicando o mesmo
  fluxo do console (parâmetros → usuários/tokens → consulta → relatório → busca).
- **Multiusuário**: cada usuário tem seu API Token pessoal; o relatório consolida
  todos.
- **Cache de consulta** (`dados/TogglRelatorioData.ini`, ao lado de cada executável):
  guarda o retorno cru da última consulta bem-sucedida de cada usuário. Se
  período e usuários da próxima consulta forem iguais, oferece carregar do cache
  (default) em vez de consultar a API de novo; o agrupamento/cálculo sempre roda
  em runtime sobre o dado, cacheado ou não — o cache nunca guarda resultado já
  processado. Também serve de reserva quando o limite de 30 requisições/hora por
  usuário é atingido (ver §3/§6).
- **Gráfico de Gantt** (só na Web API + frontend, sem equivalente no console):
  segunda visualização dos mesmos dados, com parâmetros (período + tags a
  detalhar + agrupamento) e cache (`dados/TogglGantData.ini`) **próprios e
  independentes** dos do relatório — a mesma pessoa pode ter um relatório e um
  Gantt configurados com períodos diferentes ao mesmo tempo, e uma consulta
  não invalida a outra. Ver §4.6/§5.5.
- **Usuário ganhou três campos exclusivos da versão web** (`Sigla`, `Cor`,
  `Selecionado`) — persistidos no mesmo `TogglRelatorioParametros.ini`, lidos/gravados pelo
  mesmo `CarregadorConfiguracaoIni` que o console usa; o console não tem UI
  para editá-los, mas preserva os valores ao resalvar a configuração (ver
  §2.4). `Selecionado` decide quais usuários entram na **próxima consulta**
  (relatório ou Gantt) — os demais nem chegam a ser considerados por
  `ServicoConsulta`.
- **Não há exportação para CSV** — os dados só existem no console/frontend e no
  cache.
- **Zero dependências externas no console** — nenhum `PackageReference`; parser
  de INI e banner feitos à mão. A Web API tem uma única dependência
  (`Swashbuckle.AspNetCore`, necessária para o Swagger).
- **Console**: tela de boas-vindas, animação de carregamento, cabeçalho fixo
  (redesenhado a cada passo), padrão de cores centralizado e tela de despedida.
  Toda troca de tela limpa o console (via sequência ANSI, não só
  `Console.Clear()`) e redesenha o cabeçalho antes do novo conteúdo, via
  `Tela.ExibirComCabecalho`. Moldura dimensionada para a largura real do
  terminal, sem nunca ultrapassá-la. O mesmo estilo geral do projeto irmão
  `gerador-chave-nfe` (ver §11).
- **Tudo em pt-BR**: interface, mensagens, identificadores, pastas e namespace
  (`RelatorioToggl`/`RelatorioToggl.Api`), tanto no back quanto no front. Em
  inglês só o inevitável (`Program`, `Main`, `Task`/`async`,
  `[JsonPropertyName("...")]` com nomes da API do Toggl) e siglas (`Dto`, `Api`,
  `Ini`, `Http`, `Toggl`). **Sem comentários** no código C# tocado pelas rodadas
  de 2026-09-05 (itens 11 a 16 do histórico, §7) — nomes claros e funções
  pequenas no lugar de comentário; regras de domínio não óbvias ficam
  documentadas aqui, não inline. O item 16 estendeu essa regra a **todo**
  `TogglReport.Nucleo` (inclusive arquivos que até então mantinham seus XML
  doc comments originais, por não terem sido tocados nas rodadas anteriores).
  O frontend (TypeScript) usa comentários com moderação, só onde uma regra não
  é óbvia pelo nome (ver §5).

---

## 2. Console (`toggl-report-back/TogglReport.Console`)

### 2.1 Como compilar e rodar

```bash
cd toggl-report-back
dotnet build TogglReport.slnx      # compila console + API + núcleo de uma vez
dotnet run --project TogglReport.Console
```

- SDK: **.NET 10** (`net10.0`). `LangVersion=latest`, `ImplicitUsings=enable`,
  `Nullable=enable`. Versão atual (`<Version>` e `Program.Versao`): **1.0.0.0**.
- Solução: `toggl-report-back/TogglReport.slnx` → referencia os três `.csproj`
  (`TogglReport.Console`, `TogglReport.Api`, `TogglReport.Nucleo`), todos dentro
  de `toggl-report-back/`.
- **Namespace raiz do console**: `RelatorioToggl`. **Assembly/executável**
  continua `TogglReport` (nome do produto, `AssemblyName` inalterado desde
  antes da reestruturação) — só a **pasta e o nome do `.csproj`** viraram
  `TogglReport.Console` (item 16 do histórico), para bater com o padrão
  `TogglReport.<X>` de `TogglReport.Api`/`TogglReport.Nucleo`.
- **Não há testes automatizados.** Após mudanças: `dotnet build`, manter **0
  warnings**, e validar o fluxo interativo manualmente.
- A limpeza de tela é encapsulada em `Tela.Limpar()`: sai cedo se
  `Console.IsOutputRedirected` (não escreve nada) e, senão, escreve a sequência
  ANSI `Tela.SequenciaLimparTela` seguida de `Console.Clear()` (engolindo
  `IOException`) — dá para "pipar" o app em testes rápidos (os laços de entrada,
  porém, assumem terminal real; ver §2.7).

### 2.2 Fluxo funcional (o que `Program.Main` faz)

1. `Console.OutputEncoding = UTF8`; `Tela.Inicializar` (dimensiona `Tela.Largura`
   pelo terminal); `Tela.BemVindo` (banner) + `Tela.Carregando` (animação ~1 s).
2. **`GerarRelatoriosEnquantoUsuarioQuiser`** — laço `while (executarNovamente)`:
   1. **`ColetarConfiguracaoConfirmadaAsync`** — laço até o usuário confirmar:
      - `CarregadorConfiguracaoIni.Carregar(TogglRelatorioParametros.ini)` (uma vez por
        ciclo) e um `ConfiguracaoApp` novo.
      - `AssistenteConfiguracao.ColetarAsync(atual, salvos)` — campo a campo:
        **agrupamento** (`EscolherOpcao` + confirmar, ou reaproveitar o salvo),
        **tags detalhadas** (só se agrupamento é `tag`/`ambos`; lista livre
        separada por vírgula, ou reaproveitar a salva), **usuários** (submenu
        `MenuTokenUsuario`; obriga ≥ 1), **período** (data início/fim —
        reaproveitar salvo ou informar+confirmar; valida `fim >= inicio`).
      - Cabeçalho com o resumo, seguido da **lista de usuários selecionados**
        (um por linha, `Tela.ListarUsuariosSelecionados`) → `Confirmar a
        consulta com os parâmetros acima?`. Se recusado, recomeça. Se aceito,
        grava o `TogglRelatorioParametros.ini` (com `try/catch`).
   2. **`ObterRegistrosAsync`** — decide entre cache e API (delega para
      `ServicoConsulta`, §3):
      - Carrega `TogglRelatorioData.ini` (`ServicoConsulta.CarregarCacheSeExistente`,
        com `try/catch`). Se existe e
        `ServicoConsulta.CacheCorrespondeAosParametros` (mesmo período + mesmo
        conjunto de usuários/tokens), pergunta "Deseja consultar novamente à
        API?" (padrão **não** — Enter carrega do cache via
        `ServicoConsulta.CarregarRegistrosDoCache`, sem chamar a API).
      - Caso contrário (parâmetros diferentes, sem cache, ou usuário pediu para
        consultar de novo): `ServicoConsulta.ConsultarUsuariosAsync` — para
        cada usuário, se `LimitadorRequisicoes.PodeConsultar` (limite de
        30/hora, em memória) permitir, `ClienteApiToggl.ObterRegistrosTempoAsync`;
        senão, tenta o `UsuarioCacheado` daquele usuário no cache **só se for
        do mesmo período e token** (senão pula, reportado como falha). O
        console passa um callback (`ImprimirProgressoConsulta`) que traduz cada
        `EventoConsultaUsuario` em uma linha colorida
        (`• Nome: N registro(s)` / `erro — …` /
        `limite de 30 requisições/hora atingido — …`). Quem falha é
        **ignorado**; os demais seguem. Datas: o usuário escolhe dias no
        **fuso local**, e as bordas são convertidas para UTC
        (`SpecifyKind(…, Local).ToUniversalTime()`); fim inclusivo = 23:59:59
        do último dia. Ao final, `ServicoConsulta.SalvarCache` regrava o
        `TogglRelatorioData.ini` com o retorno cru.
      - Retorna `(Dictionary<nome,registros>, List<string> ordem)` — mesmo
        formato venha do cache ou da API; o passo seguinte não sabe nem
        precisa saber qual foi a origem.
   3. Se **ninguém** retornou dados, mostra um aviso **sem limpar a tela** — a
      intenção é preservar visíveis as linhas de progresso/erro por usuário que
      acabaram de ser impressas. Senão:
      - **`ImprimirConteudoRelatorio`** — pelo mesmo motivo, a **primeira**
        exibição do relatório (`EscritorRelatorioConsole.ImprimirRelatorioUsuario`
        por usuário, ordem consultada, + a linha dupla final) também **não
        limpa a tela** — fica anexada logo abaixo da consulta.
        `ExibirRelatorioCompleto` (que envolve a mesma impressão em
        `Tela.ExibirComCabecalho`, limpando antes) só é usado quando o usuário
        escolhe "voltar ao relatório completo" a partir do menu pós-busca — aí
        sim é uma troca de tela genuína.
      - **`ExecutarFluxoBusca`** — pergunta "Deseja buscar por parte da
        descrição?" (sem limpar, logo abaixo do relatório). Se sim,
        **`ExecutarCicloDeBusca`** em laço: limpa + cabeçalho, pede o termo,
        `ServicoBuscaDescricao.Buscar` (substring case-insensitive sobre os
        dados já baixados, sem nova chamada à API) →
        `EscritorBuscaDescricao.ImprimirNoConsole` (limpa + cabeçalho antes) →
        `PerguntarProximaAcaoPosBusca` (1 = `ExibirRelatorioCompleto` — limpa,
        reexibe o relatório completo e volta a perguntar se quer buscar; 2 =
        pede novo termo direto, sem repetir a pergunta; 3/outro = encerra o
        laço de busca).
   4. "Executar novamente?" decide se repete.
3. `Tela.Despedida`.

### 2.3 Estrutura de arquivos

```
toggl-report-back/TogglReport.Console/
 ├─ Program.cs                     # orquestração: boas-vindas → coleta → ServicoConsulta → relatório → busca
 ├─ TogglReport.Console.csproj     # net10.0, Exe, AssemblyName=TogglReport, RootNamespace=RelatorioToggl, referencia TogglReport.Nucleo
 ├─ icon.ico
 ├─ Apresentacao/
 │   ├─ Paleta.cs                  # cores (papéis fixos) + Escrever / EscreverLinha
 │   ├─ Tela.cs                    # BemVindo / Carregando / Cabecalho / ExibirComCabecalho / Despedida / Limpar / Inicializar
 │   ├─ Prompt.cs                  # Perguntar / Confirmar / EscolherOpcao (EOF → encerra)
 │   ├─ Rotulos.cs                 # Agrupamento(valor) → texto de exibição
 │   ├─ AssistenteConfiguracao.cs  # ColetarAsync + LerCampo genérico (1 método por campo)
 │   └─ MenuTokenUsuario.cs        # submenu [A]dicionar / [R]emover / [E]ditar / [C]oncluir (delega a ServicoUsuarios do núcleo)
 └─ Relatorios/
     ├─ EscritorRelatorioConsole.cs# ImprimirRelatorioUsuario + ImprimirLinha/Indentacao/TituloSecaoDescricao (públicos) + FormatarDuracao
     └─ EscritorBuscaDescricao.cs  # imprime o resultado da busca no estilo de "Por descrição"
```

Todo o resto (modelos, INI, cliente HTTP, agrupamento, busca, decisão de
cache/rate-limit) vive em `toggl-report-back/TogglReport.Nucleo/` — ver §3.

### 2.4 Detalhes de domínio importantes

- **`RegistroTempoDto.Duracao`** (segundos): **valor negativo = timer em
  execução** — isolado por `ServicoAgrupamento.ObterEmAndamento`, fora dos
  totais.
- **`RegistroTempoDto.Tags`**: já resolvidas como nomes pela API.
- Rótulos: `(sem descrição)`, `(sem tag)`.
- **Chave do usuário no INI** (`[Usuario:<chave>]`): `nome` só com letras/dígitos,
  minúsculo, sufixo numérico em colisão (`ServicoUsuarios.GerarChaveUnica`, no
  núcleo). `NomeExibicao` é o rótulo dos relatórios.
- **Agrupamento** (interno e no INI): `descricao`, `tag`, `ambos`.
- **`ConfiguracaoApp.TagsDetalhadas`**: lista livre de tags (comparação
  `OrdinalIgnoreCase`); persistida como `TagsDetalhadas=tag1,tag2` no INI (vazia
  = `TagsDetalhadas=`). Só coletada pelo assistente quando o agrupamento inclui
  tag; preservada (não zerada) quando não coletada de novo. Com agrupamento
  "ambos": essas tags aparecem detalhadas em "Por descrição" e ficam totalmente
  fora de "Por tag"; as demais tags não aparecem em "Por descrição", só em "Por
  tag" (nome do campo mantido por compatibilidade com o INI).
- **"Por descrição" filtra por `TagsDetalhadas` e ordena por prefixo `"TEL"`**:
  com agrupamento "ambos", só entram entradas com pelo menos uma tag em
  `TagsDetalhadas` (as demais só contam no total de "Por tag"); com agrupamento
  "descricao" puro, entram todas (não há "Por tag" para compensar). Entre as
  que entram, as que começam com `TEL` (`OrdinalIgnoreCase`) vêm primeiro; as
  demais vêm depois, prefixadas com `"(tag) descrição"`
  (`ServicoAgrupamento.AgruparPorDescricaoComTag` /
  `EscritorRelatorioConsole.ImprimirSecaoDescricao`).
- **Descrições "TEL" normalizadas já na chave de agrupamento**: "TEL-0000-AA" /
  "TEL-0000 - AA" / "TEL - 0000 - AA" viram sempre `"TEL - 0000 - AA"` antes de
  somar os tempos — não só na exibição
  (`ServicoAgrupamento.NormalizarDescricaoTel`/`ChaveDescricao`). Só reformata
  quando há dígitos logo após "TEL"; não mexe em "TELA", "TELEFONE" etc.
- **`ConfiguracaoUsuario` tem três campos exclusivos da versão web**: `Sigla`
  (string curta, usada como rótulo nas células do Gantt), `Cor` (hex, cor de
  fundo dessas células) e `Selecionado` (`bool`, default `true` — decide se o
  usuário entra na próxima consulta). Persistidos como `Sigla=`/`Cor=`/
  `Selecionado=` na seção `[Usuario:<chave>]`, lidos com `AnalisadorIni.
  ObterOuPadrao` (`Selecionado` via `bool.TryParse`, default `true` se ausente
  ou inválido — usuários criados antes desse campo existir continuam
  selecionados). **Importante**: `CarregadorConfiguracaoIni.Salvar` grava os
  três campos sempre, mesmo quando quem chama é o console (que não tem UI para
  eles) — é o que evita perdê-los quando o console resalva a configuração.
  `ServicoUsuarios.SiglaEmUso` (mesmo padrão de `NomeEmUso`/`TokenEmUso`, mas
  ignorando siglas vazias) valida unicidade na Web API.
- **Cache (`CacheConsulta`/`UsuarioCacheado`) guarda dado cru, indexado por
  `Chave` de usuário** (não por `NomeExibicao`, que pode ser editado):
  `DataInicio`/`DataFim` da consulta em `[Geral]`, e uma seção
  `[Usuario:<chave>]` por usuário com `NomeExibicao`, `TokenApi` e `Registros`
  (JSON compacto do `List<RegistroTempoDto>`, sem nenhum agrupamento aplicado).
  Bater os parâmetros (`ServicoConsulta.CacheCorrespondeAosParametros`) exige
  mesmo período **e** todo usuário atual achar seu par no cache por `Chave` +
  `TokenApi` (mesmo tamanho de lista dos dois lados).
- **Limite de 30 requisições/hora é por processo, não persistido**:
  `LimitadorRequisicoes` guarda os timestamps em memória
  (`Dictionary<string, List<DateTime>>` estático); reinicia a cada execução.
  Não é o mesmo mecanismo do retry de 429 em `ClienteApiToggl` (esse continua
  ativo e trata o limite que a própria API do Toggl impõe). Console e Web API
  têm contadores **independentes** (processos separados).

### `TogglRelatorioParametros.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

```ini
[Geral]
DataInicioAnterior=2026-08-01
DataFimAnterior=2026-08-31
AgrupamentoPadrao=ambos
TagsDetalhadas=Cliente X,Urgente

[Usuario:joao]
NomeExibicao=Joao Silva
TokenApi=abcdef1234567890
```

### `TogglRelatorioData.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

```ini
[Geral]
DataInicio=2026-08-01
DataFim=2026-08-31

[Usuario:joao]
NomeExibicao=Joao Silva
TokenApi=abcdef1234567890
Registros=[{"id":123456789,"workspace_id":1,"project_id":null,"description":"TEL-0433-AA","duration":3725,"tags":["Cliente X"],"start":"2026-08-01T13:00:00Z","stop":"2026-08-01T14:02:05Z"}]
```

`AppContext.BaseDirectory` é o diretório do **executável que está rodando** — o
console e a Web API, sendo executáveis diferentes, têm cada um a sua própria
pasta `dados/`, mesmo formato, sem compartilhar arquivo físico.

### 2.5 Tratamento de erros (contratos — respeitar)

- **401 num usuário**: `ClienteApiToggl` devolve `Falha`; o consumidor (console
  ou API) reporta e **pula o usuário**. Nunca aborta a execução/requisição
  inteira.
- **429**: `ClienteApiToggl` espera `Retry-After` (fallback 5 s) e tenta **uma
  vez** (`ehNovaTentativa`); se falhar de novo, reporta e pula.
- **Rede / HTTP não-2xx / JSON inválido**: `Falha` com a mensagem; usuário
  pulado.
- **Validação de token** (`MenuTokenUsuario` no console; `POST
  /api/usuarios`/`validar-token` na API): `GET /me`. No console, se falhar:
  tentar de novo? Se não, "salvar assim mesmo, sem validação?". Na API, a
  mesma decisão vira o parâmetro `ignorarValidacao` (ver §4).
- **`NomeExibicao` duplicado**: rejeitado no cadastro e na edição, tanto no
  console quanto na API (`ServicoUsuarios.NomeEmUso`, no núcleo) — é a chave
  dos dicionários de resultado; nomes iguais quebrariam relatório e busca.
- **Período com `fim < inicio`**: rejeitado nos dois (console repete a
  pergunta; API devolve 400).
- **EOF (stdin fechado, só console)**: `Prompt.LerEntrada` chama
  `Environment.Exit(0)` — o app encerra em vez de entrar em laço.
- **Falha ao carregar/salvar `TogglRelatorioData.ini`/`TogglRelatorioParametros.ini`**:
  `try/catch (IOException or UnauthorizedAccessException)` — não é fatal; sem
  cache utilizável, o app cai para a consulta normal.
- **Limite de 30 requisições/hora atingido para um usuário**: usa o
  `UsuarioCacheado` daquele usuário **só se for do mesmo período e token**;
  senão, reporta e pula o usuário (mesmo tratamento de uma falha comum de
  consulta — os demais usuários seguem).

### 2.6 Limitações conhecidas (assumidas — não são bugs)

- **App interativo**: assume terminal real. Com EOF/entrada redirecionada o app
  **encerra** (não trava), mas não há modo "batch"/não-interativo.
- **Sem paginação**: `GET /me/time_entries` traz tudo numa chamada; períodos
  longos podem dar **400** (limite de histórico da conta).
- **Não resolve nome de projeto/cliente** — só descrição e tag. `IdProjeto`
  existe no DTO mas não é usado.
- **`TogglRelatorioParametros.ini` e `TogglRelatorioData.ini` guardam os tokens em texto puro** —
  tratados como segredo, ambos no `.gitignore` (ver §8), dentro de `dados/` ao
  lado de cada executável.
- **`Tela.Inicializar()` mede a largura uma única vez, na abertura**: se o
  usuário redimensionar o terminal durante a execução, a moldura não se
  readapta.
- **Limite de 30 requisições/hora é só em memória, por processo**: reinicia a
  cada execução; console e API não compartilham contador.
- Sem testes automatizados.

---

## 3. Núcleo compartilhado (`toggl-report-back/TogglReport.Nucleo`)

Biblioteca de classes (`Microsoft.NET.Sdk`, sem `OutputType`) referenciada por
`TogglReport` e `TogglReport.Api` via `ProjectReference`. **Nunca** referencia
`Console`, `Paleta` ou `Tela` (confirmado por grep — regra a manter). Contém
tudo que é lógica de negócio ou acesso a INI, independente de qual interface
(console ou HTTP) está chamando.

```
toggl-report-back/TogglReport.Nucleo/
 ├─ Configuracao/
 │   ├─ ConfiguracaoApp.cs         # modelo do TogglRelatorioParametros.ini
 │   ├─ ConfiguracaoUsuario.cs     # Chave / NomeExibicao / TokenApi
 │   ├─ CarregadorConfiguracaoIni.cs  # Carregar / Salvar do dados/TogglRelatorioParametros.ini
 │   ├─ CacheConsulta.cs           # modelo do TogglRelatorioData.ini: período + List<UsuarioCacheado>
 │   ├─ UsuarioCacheado.cs         # Chave / NomeExibicao / TokenApi / Registros (dado cru)
 │   ├─ CarregadorCacheIni.cs      # Carregar / Salvar do dados/TogglRelatorioData.ini
 │   ├─ AnalisadorIni.cs           # parser de INI compartilhado (Analisar/ObterOuPadrao/ObterOuNulo)
 │   ├─ CaminhosDados.cs           # monta dados/TogglRelatorioParametros.ini, TogglRelatorioData.ini, TogglGantParametros.ini e TogglGantData.ini a partir de um diretório base
 │   ├─ ConfiguracaoGant.cs        # modelo do TogglGantParametros.ini: DataInicio/DataFim/TagsSelecionadas/Agrupamento
 │   ├─ CarregadorConfiguracaoGantIni.cs  # Carregar / Salvar do dados/TogglGantParametros.ini
 │   └─ ServicoUsuarios.cs         # GerarChaveUnica / NomeEmUso / TokenEmUso / SiglaEmUso / MascararToken
 ├─ Gant/                          # exclusivo do Gantt (nome com um "t" só — ver nota no item 18 do histórico)
 │   ├─ CelulaGant.cs              # record: UsuarioChave/NomeExibicao/Sigla/Cor/Horas de um usuário num dia
 │   ├─ LinhaGant.cs               # record: UsuarioChave/NomeExibicao/Categoria/Descricao/TotalHoras/CelulasPorDia
 │   ├─ ResultadoGant.cs           # record: Dias (dias úteis do período) + Linhas
 │   └─ ServicoGant.cs             # Montar(): agrupa o cache por usuário→categoria→descrição, dia a dia
 ├─ Toggl/
 │   ├─ ClienteApiToggl.cs         # HTTP Basic contra api.track.toggl.com/api/v9
 │   ├─ RegistroTempoDto.cs        # DTO de time entry
 │   ├─ ResultadoApiToggl.cs       # envelope Ok/Falha
 │   └─ LimitadorRequisicoes.cs    # contador em memória do limite de 30 req/hora por usuário
 ├─ Relatorios/
 │   ├─ ServicoAgrupamento.cs      # AgruparPorDescricaoComTag(filtrada e não)/Tag/TagFiltrada, NormalizarDescricaoTel, ObterConcluidos/EmAndamento, ObterTotalSegundos
 │   ├─ LinhaDescricao.cs          # record: descrição agrupada + tempo + tag representativa
 │   ├─ ServicoBuscaDescricao.cs   # Buscar(): agrupamento descrição → segundos por usuário
 │   ├─ LinhaBusca.cs              # record: descrição + segundos por usuário + total da linha
 │   └─ ResultadoBuscaDescricao.cs # Linhas + TotalGeralSegundos
 └─ Consultas/
     ├─ ServicoConsulta.cs         # CarregarCacheSeExistente / CacheCorrespondeAosParametros / CarregarRegistrosDoCache / ConsultarUsuariosAsync / SalvarCache
     ├─ ResultadoConsulta.cs       # RegistrosPorUsuario / OrdemUsuarios / VeioDoCache
     ├─ EventoConsultaUsuario.cs   # NomeUsuario / Status / Mensagem / QuantidadeRegistros (progresso por usuário)
     └─ StatusConsultaUsuario.cs   # enum: Sucesso / Erro / LimiteAtingidoComCache / LimiteAtingidoSemCache
```

`ServicoAgrupamento.AgruparPorTagFiltrada(registros, tagsDetalhadas)` (usado
pelo console e pela API) encapsula a mesma regra de exclusão que antes vivia
só dentro de `EscritorRelatorioConsole.ImprimirSecaoTag` — devolve a lista já
filtrada e ordenada por segundos decrescente.

`ServicoConsulta` é o ponto mais importante deste projeto: é o que evita que
console e Web API dupliquem a decisão "cache ou API" e o uso do rate limiter.
Cada consumidor decide **quando** chamar cada método — o console via pergunta
interativa (`Prompt.Confirmar`), a API via um parâmetro de requisição
(`forcarConsultaApi`) — mas a regra em si (o que conta como "mesmo
período/usuários", quando usar cache, como tratar o rate limit) só existe
aqui.

---

## 4. Web API (`toggl-report-back/TogglReport.Api`)

### 4.1 Visão geral

ASP.NET Core, **Minimal APIs** (não Controllers — projeto pequeno e focado),
`Microsoft.NET.Sdk.Web`, referencia `TogglReport.Nucleo`. **Sem
autenticação/autorização** — uso exclusivamente local.

```bash
dotnet run --project toggl-report-back/TogglReport.Api
```

Sobe em `http://localhost:5180` (porta fixa,
`TogglReport.Api/Properties/launchSettings.json` — perfil único `http`).
Swagger/OpenAPI em `http://localhost:5180/swagger`
(`Swashbuckle.AspNetCore` 10.2.3 — única dependência NuGet do repositório;
gerada via `AddEndpointsApiExplorer` + `AddSwaggerGen`/`UseSwagger`/
`UseSwaggerUI`, `RoutePrefix = "swagger"`).

Cria sua **própria** pasta `dados/` via `CaminhosDados.CaminhoConfiguracao/
CaminhoCache(AppContext.BaseDirectory)` — mesmo helper do núcleo que o console
usa, mas com o `AppContext.BaseDirectory` da própria API (pasta diferente do
console).

### 4.2 Endpoints

Organizados em `Endpoints/` — um arquivo estático por grupo de rotas, cada um
com um método `Map*Endpoints(this WebApplication app, ...)` chamado do
`Program.cs`. DTOs de request/response em `Dtos/` (um `record` por arquivo).

| Método | Rota | Arquivo | Descrição |
|---|---|---|---|
| `GET` | `/api/configuracao` | `ConfiguracaoEndpoints` | `{ agrupamento, tagsDetalhadas, dataInicio, dataFim }` |
| `PUT` | `/api/configuracao` | `ConfiguracaoEndpoints` | Atualiza os 4 campos acima; carrega a config existente antes para preservar `Usuarios` |
| `GET` | `/api/usuarios` | `UsuariosEndpoints` | `[{ chave, nomeExibicao, tokenMascarado }]` |
| `POST` | `/api/usuarios` | `UsuariosEndpoints` | `{ nomeExibicao, tokenApi, ignorarValidacao? }` → 201 / 400 (nome vazio ou token inválido) / 409 (nome em uso) |
| `PUT` | `/api/usuarios/{chave}` | `UsuariosEndpoints` | Campos opcionais (`null`/omitido = não altera) → 200 / 404 / 409 / 400 |
| `DELETE` | `/api/usuarios/{chave}` | `UsuariosEndpoints` | 204 / 404 |
| `POST` | `/api/usuarios/validar-token` | `UsuariosEndpoints` | `{ tokenApi }` → `{ valido: bool }`, sem salvar |
| `POST` | `/api/consultas` | `ConsultasEndpoints` | `{ dataInicio, dataFim, forcarConsultaApi? }` → cache-first via `ServicoConsulta`; sempre grava o cache ao final |
| `GET` | `/api/relatorio?dataInicio=&dataFim=` | `RelatorioEndpoints` | 409 se não há cache **exatamente** para esse período; senão `{ dataInicio, dataFim, agrupamento, usuarios: [...] }` |
| `GET` | `/api/busca?termo=` | `BuscaEndpoints` | 409 se não há cache; senão o `ResultadoBuscaDescricao` do núcleo, serializado direto |
| `GET` | `/api/dados/download` | `DadosEndpoints` | Compacta a pasta `dados/` inteira (todos os arquivos presentes no momento da requisição, sem lista fixa) em `dados.zip` via `System.IO.Compression.ZipArchive` (nativo do .NET, sem pacote NuGet) e devolve o zip; 404 se a pasta não existir ou estiver vazia |
| `GET` | `/api/gant/parametros` | `GantEndpoints` | `{ dataInicio, dataFim, tagsSelecionadas, agrupamento }` do Gantt (independente do relatório) |
| `PUT` | `/api/gant/parametros` | `GantEndpoints` | Atualiza os 4 campos acima |
| `POST` | `/api/gant/consultas` | `GantEndpoints` | Igual a `POST /api/consultas`, mas grava em `TogglGantData.ini` — reaproveita `ServicoConsulta` inteiro, só troca o caminho do cache |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | `GantEndpoints` | 409 se não há cache do Gantt para esse período; senão `{ dias, linhas }` já agrupado por `ServicoGant.Montar` — `termo` (opcional) filtra por descrição antes de agrupar |

### Formato exato das respostas (testado manualmente com `curl`, inclusive com
### dados fictícios de cache)

**`POST /api/consultas`** — `ConsultarResponse`:
```json
{
  "dataInicio": "2026-08-01", "dataFim": "2026-08-31", "veioDoCache": true,
  "usuarios": [
    { "nomeUsuario": "Joao Silva", "status": "Sucesso", "mensagem": null, "quantidadeRegistros": 12 },
    { "nomeUsuario": "Maria Souza", "status": "Erro", "mensagem": "Token inválido ou expirado (401 Unauthorized).", "quantidadeRegistros": null }
  ]
}
```
Quando vem do cache (`veioDoCache: true`), a lista de `usuarios` é sintetizada
a partir de `ServicoConsulta.CarregarRegistrosDoCache` — todos aparecem como
`"Sucesso"` com a contagem de registros de cada um (não há, nesse caminho,
diferenciação por status vindo da API externa, já que ela não foi chamada).

**`GET /api/relatorio?...`** — `RelatorioResponse`:
```json
{
  "dataInicio": "2026-08-01", "dataFim": "2026-08-31", "agrupamento": "ambos",
  "usuarios": [{
    "nomeExibicao": "Joao Silva",
    "porDescricao": [{ "descricao": "TEL - 100 - AA", "segundos": 3600, "tag": "Cliente X" }],
    "porTag": { "Interno": 1800 },
    "emAndamento": [{ "id": 3, "workspace_id": 1, "project_id": null, "description": "Em andamento agora", "duration": -1, "tags": null, "start": "2026-08-05T09:00:00+00:00", "stop": null }],
    "totalSegundos": 5400
  }]
}
```
`porDescricao`/`porTag` só vêm preenchidos se o `agrupamento` salvo incluir,
respectivamente, `descricao`/`tag` (mesma condicional do console) — senão vêm
`[]`/`{}`. **`emAndamento` está em snake_case** (`workspace_id`, `project_id`,
`description`, `duration`, `tags`, `start`, `stop`) — é o `RegistroTempoDto`
cru, cujos `[JsonPropertyName]` batem com a API do Toggl e por isso **não**
seguem a política camelCase do resto da API (System.Text.Json respeita o
atributo explícito por cima da política global). Todo o resto do contrato é
camelCase.

**`GET /api/busca?termo=...`** — o próprio `ResultadoBuscaDescricao` do
núcleo:
```json
{
  "linhas": [{ "descricao": "Reunião com cliente X", "segundosPorUsuario": { "Joao Silva": 3600 }, "totalSegundosLinha": 3600 }],
  "totalGeralSegundos": 3600
}
```
Não reordena/normaliza "TEL" (mesmo comportamento do console — busca opera
sobre o texto cru da descrição).

### 4.3 Decisões de arquitetura desta camada

| Decisão | Motivo |
|---|---|
| **Minimal APIs, não Controllers** | Projeto pequeno e focado (12 rotas); evita o boilerplate de MVC. Um arquivo `Map*Endpoints` por grupo em `Endpoints/`. |
| **Stateless entre requisições — nunca mantém registros em memória entre chamadas** | Toda leitura de relatório/busca **relê `TogglRelatorioData.ini`** via `CarregadorCacheIni`/`ServicoConsulta.CarregarRegistrosDoCache`. Isso evita sessão/estado de servidor e reaproveita o mesmo cache do console sem precisar inventar um mecanismo novo. |
| **`GET /api/relatorio`/`GET /api/busca` exigem cache prévio (409 se não bate)** | Em vez de disparar uma consulta implícita, força o cliente (frontend) a chamar `POST /api/consultas` primeiro — mantém explícito quando uma requisição HTTP externa acontece, essencial para respeitar o rate limit. |
| **`PUT /api/configuracao` recarrega a config antes de sobrescrever** | Preserva `Usuarios` (gerido por endpoints próprios) mesmo que o payload do PUT não os inclua. |
| **`ignorarValidacao` no lugar do prompt "salvar assim mesmo?" do console** | Não há como fazer uma pergunta de sim/não em uma chamada HTTP síncrona; o cliente decide de antemão e sinaliza via flag. |
| **CORS liberado (`AllowAnyOrigin/Header/Method`)** | Uso exclusivamente local; o frontend roda em outra porta (Vite) e precisa chamar sem bloqueio. Não apropriado se a API algum dia for exposta fora de `localhost`. |
| **`JsonStringEnumConverter` global** (`ConfigureHttpJsonOptions`) | Sem isso, `StatusConsultaUsuario` seria serializado como número (`0`/`1`/...); com o conversor, `"Sucesso"`/`"Erro"`/etc. — mais legível no Swagger e no frontend. |
| **`Swashbuckle.AspNetCore`** | Única dependência NuGet do repositório; o pacote `Microsoft.OpenApi` que ele traz (v2.x) usa o namespace `Microsoft.OpenApi.OpenApiInfo` (sem `.Models` — mudou entre versões do OpenApi.NET; atenção ao atualizar o pacote). |
| **Porta fixa 5180** (`launchSettings.json`) | O frontend precisa de uma URL conhecida sem configuração adicional. |
| **`dados/` própria, independente da do console** | Simplicidade: cada executável só enxerga `AppContext.BaseDirectory` de si mesmo; replicar o comportamento (não o arquivo físico) é o que a consigna pediu. |

### 4.4 Tratamento de erros HTTP

- **400 Bad Request** (corpo = string com a mensagem): parâmetros inválidos —
  agrupamento fora de `descricao`/`tag`/`ambos`, datas não parseáveis,
  `fim < inicio`, nome de usuário vazio, nenhum usuário cadastrado ao
  consultar/relatar/buscar, token que não valida (sem `ignorarValidacao`),
  termo de busca vazio.
- **404 Not Found**: usuário (`chave`) não encontrado em `PUT`/`DELETE
  /api/usuarios/{chave}`; arquivo `.ini` inexistente nos endpoints de
  download.
- **409 Conflict**: nome de usuário já em uso (cadastro/edição); `GET
  /api/relatorio`/`GET /api/busca` sem cache correspondente ao período pedido.
- **500** (`Results.Problem`): falha de I/O ao gravar o `.ini`
  (`IOException`/`UnauthorizedAccessException`) — mesmo `try/catch` não-fatal
  do console, mas aqui vira erro de resposta (não há como "avisar e seguir"
  numa requisição síncrona que precisava do resultado salvo).

### 4.5 Limitações conhecidas desta camada

- CORS `AllowAny` — adequado só para uso local; não usar essa configuração se
  a API for exposta além de `localhost`.
- Sem autenticação — qualquer processo na máquina pode chamar a API e ler/
  alterar `dados/TogglRelatorioParametros.ini` (inclusive tokens) e `dados/TogglRelatorioData.ini`.
- Enum documentado no Swagger pode aparecer como inteiro no schema (a
  anotação `[SwaggerDoc]` não propaga automaticamente o
  `JsonStringEnumConverter` para a geração de schema do Swashbuckle) — a
  serialização real da resposta, porém, é sempre string (verificado).
- Mesmas limitações de fundo do núcleo/console: sem paginação, sem nome de
  projeto/cliente, rate limit só em memória por processo.

### 4.6 Gráfico de Gantt (`GantEndpoints`/`TogglReport.Nucleo/Gant`)

Segunda visualização dos mesmos dados do Toggl, com parâmetros e cache
**totalmente independentes** do relatório (ver §4.2 para as rotas). O
único ponto compartilhado com o relatório é a lista de usuários
(`TogglRelatorioParametros.ini`) e `ServicoConsulta` (reaproveitado sem alteração — só o
caminho do arquivo de cache muda, de `TogglRelatorioData.ini` para
`TogglGantData.ini`).

- **`ConfiguracaoGant`** (`dados/TogglGantParametros.ini`, mesmo formato de
  seção `[Geral]` do `TogglRelatorioParametros.ini`): `DataInicio`, `DataFim`,
  `TagsSelecionadas` (mesmo conceito de `TagsDetalhadas` do relatório — tags
  que ficam detalhadas por descrição, as demais são agregadas por tag) e
  `Agrupamento` (`descricao`/`tag`/`ambos`, mesmos 3 valores do relatório).
- **`ServicoGant.Montar(cache, usuarios, inicio, fim, tagsSelecionadas,
  agrupamento, termo?)`** — o algoritmo de agrupamento do Gantt, em
  `TogglReport.Nucleo/Gant/ServicoGant.cs`:
  1. **Dias**: um por dia do período, **exceto sábados e domingos**
     (`DayOfWeek.Saturday`/`Sunday` pulados na montagem de `Dias`) — o total
     por linha continua somando o período inteiro; só a coluna daquele dia
     não aparece na grade.
  2. **Linhas agrupadas por usuário primeiro**: a chave interna é
     `(UsuarioChave, Categoria, Descricao)`, não só `(Categoria, Descricao)`
     — todas as linhas de um usuário ficam juntas antes de passar para o
     próximo (ordenado pela posição do usuário em `configuracao.Usuarios`,
     a mesma ordem de cadastro que o relatório usa — **não** é alfabética).
  3. Dentro do bloco de cada usuário: entradas cuja tag está em
     `tagsSelecionadas` (ou `agrupamento == "descricao"`) viram uma linha por
     descrição (`Categoria` = tag, `Descricao` = a descrição real,
     normalizada como "TEL" via `ServicoAgrupamento.NormalizarDescricaoTel`)
     e vêm **primeiro**; entradas de tags fora da lista (ou
     `agrupamento == "tag"`) ficam **agregadas numa única linha por tag**
     (`Descricao` = o próprio nome da tag, para a coluna nunca ficar em
     branco) e vêm **depois**, dentro do mesmo bloco.
  4. **`termo`** (busca por descrição, opcional): filtra os registros crus
     por `Descricao.Contains(termo, OrdinalIgnoreCase)` **antes** de agrupar
     — mesmo endpoint `GET /api/gant`, sem rota nova. Quando `termo` está
     presente, a entrada é **sempre** tratada como detalhada (passo 3 acima),
     mesmo que a tag não esteja em `tagsSelecionadas`/`agrupamento == "tag"`
     — sem isso, um resultado poderia cair numa linha agregada (rótulo = nome
     da tag) sem nenhum traço do texto buscado, parecendo que a busca não
     achou nada (bug real, corrigido).
- **Célula** (`CelulaGant`): usuário + sigla + cor + horas daquele dia. Uma
  linha (pós-agrupamento por usuário) só tem células de **um** usuário — o
  campo continua sendo uma lista por compatibilidade com o formato anterior
  do DTO, mas na prática nunca tem mais de 1 item.
- **`POST /api/gant/consultas`** e **`GET /api/gant`** filtram
  `configuracao.Usuarios` por `Selecionado` (ver §1) **antes** de repassar
  para `ServicoConsulta`/`ServicoGant` — só usuários selecionados entram na
  consulta e no cache.

### 4.7 Swagger customizado

`Program.cs` injeta CSS próprio no Swagger via `SwaggerUIOptions.HeadContent`
(um `<style>` cru, sem precisar de arquivo `.css` separado) e serve uma
imagem (`wwwroot/images/toggl-report.png`, o mesmo ícone do frontend) via
`app.UseStaticFiles()` — a única pasta estática que a API expõe, criada só
para esse propósito. O CSS troca o logo padrão do Swagger pelo ícone do
projeto na topbar e ajusta espaçamentos (`.info`, `.scheme-container`,
`.btn.authorize`).

**Tentativa de forçar tema claro, revertida (2026-09-06)**: o Swagger UI
empacotado no Swashbuckle (10.2.3) não tem suporte nativo a tema claro/escuro
nem segue `prefers-color-scheme` (confirmado inspecionando os recursos
embutidos — nenhuma ocorrência de `color-scheme`/`dark` no CSS do próprio
Swagger UI); "tema" ali é só o CSS que já injetamos. Chegou a ser adicionado
`:root { color-scheme: light }` e depois `color-scheme: only light` ao
`<style>` injetado, para impedir o navegador de repintar controles nativos
(scrollbar, `<select>`) no escuro quando o SO/navegador está em modo escuro
— mas na prática, testado pelo usuário, **nenhuma das duas variantes
mudou o comportamento observado** (o navegador/SO em questão continuou
aplicando o próprio esquema escuro por cima). Revertido — nenhum ajuste de
`color-scheme` está presente hoje no CSS injetado. Não foi investigada a
causa raiz exata (qual navegador/mecanismo específico ignorou a declaração);
se o pedido voltar, vale primeiro identificar o navegador/versão usado antes
de tentar de novo.

---

## 5. Frontend (`toggl-report-front`)

### 5.1 Visão geral

React 19 + TypeScript + MUI 9, via Vite. Consome a Web API — por padrão em
`http://localhost:5180`, configurável via a variável de ambiente `VITE_API_URL`
(ver §5.3) — replicando o fluxo do console: parâmetros → consulta → relatório → busca por
descrição — mais um segundo fluxo equivalente para o Gantt. Navegação por
`Tabs`: **"Usuários"** (aba fixa, selecionada por padrão na abertura — sem
usuário cadastrado, os dois outros fluxos ficam bloqueados), **"Relatório"**
e **"Gant"**, cada um dos dois últimos com seu próprio `Stepper` de 3 passos
(Parâmetros → Consultar → Relatório/Gant — o passo "Usuários" que existia
antes dentro de cada Stepper foi removido quando virou aba própria).

```bash
cd toggl-report-front
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
```

Criado por um subagente a partir de um briefing detalhado com o contrato
completo da API (endpoints, formatos exatos de request/response, a
peculiaridade do snake_case em `emAndamento`, as regras de curadoria visual do
console a replicar). Revisado manualmente após: tipos em `src/api/tipos.ts`
conferidos contra os DTOs/records C# do back-end; lógica de ordenação "TEL
primeiro" (`src/features/relatorio/curadoria.ts`) conferida contra
`EscritorRelatorioConsole.ImprimirSecaoDescricao`; `npx tsc -b` e
`npm run build` rodados e confirmados limpos por mim, não só reportados pelo
subagente.

### 5.2 Estrutura

```
toggl-report-front/src/
 ├─ api/
 │   ├─ http.ts             # fetch tipado + ErroApi (corpos de erro da API são strings simples)
 │   ├─ tipos.ts             # espelha os DTOs/records de toggl-report-back/TogglReport.Api/Dtos e TogglReport.Nucleo
 │   ├─ configuracaoApi.ts, usuariosApi.ts, consultasApi.ts, relatorioApi.ts, buscaApi.ts, dadosApi.ts, gantApi.ts
 ├─ features/
 │   ├─ configuracao/       # ParametrosForm.tsx + useConfiguracao.ts
 │   ├─ usuarios/           # UsuariosPanel.tsx (aba fixa, sem onVoltar/onContinuar quando avulsa), UsuarioFormDialog.tsx + useUsuarios.ts
 │   ├─ consulta/           # ConsultaPanel.tsx (compartilhado por relatório e Gantt, recebe resultado/consultando/executar como props) + useConsulta.ts
 │   ├─ relatorio/          # RelatorioView.tsx, RelatorioUsuarioCard.tsx, curadoria.ts + useRelatorio.ts
 │   ├─ busca/              # BuscaPanel.tsx + useBusca.ts (busca do relatório — layout de lista)
 │   ├─ gant/               # ParametrosGantForm.tsx, GantView.tsx (tabela própria, com busca embutida) + useParametrosGant.ts/useConsultaGant.ts/useGant.ts
 │   └─ dados/              # RodapeDownloads.tsx (download único da pasta dados/ compactada + versão do app)
 ├─ components/
 │   ├─ BotaoComCarregamento.tsx
 │   └─ DialogoConfirmacao.tsx  # Dialog genérico (confirmação com Cancelar, ou só informativo com OK) — reaproveitado pela exclusão de usuário
 ├─ hooks/useNotificacao.tsx # snackbar/contexto global para erros de API
 ├─ utils/duracao.ts         # formata segundos como HHhMMmSSs
 ├─ utils/datas.ts           # ISO, "últimos 30 dias" default, "iniciado às..." em horário local
 ├─ theme.ts                 # tema MUI único (claro) — ver §5.5
 └─ App.tsx                  # Tabs "Usuários" (padrão)/"Relatório"/"Gant", cada um dos dois últimos com seu próprio Stepper de 3 passos
```

### 5.3 Decisões técnicas

- **Wizard (`Stepper`) em vez de React Router**: o fluxo é sequencial como o
  do console; cada etapa só é liberada quando a anterior já produziu o que ela
  precisa (`etapaLiberada` em `App.tsx`).
- **`fetch` nativo com wrapper tipado** (`src/api/http.ts`), não axios — sem
  dependência extra; trata os corpos de erro (strings simples, não objetos)
  com uma classe `ErroApi` própria.
- **Endereço da Web API configurável via `VITE_API_URL`** (`src/api/http.ts`,
  `URL_BASE_API = import.meta.env.VITE_API_URL ?? 'http://localhost:5180'`):
  mecanismo padrão do Vite (variável de build, prefixo `VITE_` obrigatório —
  só existe no bundle se estiver presente **no momento do `vite build`**, não
  dá para trocar depois num build já gerado). Sem a variável definida, cai no
  valor de sempre (`http://localhost:5180`, a porta fixa da Api local). Documentada
  em `.env.example` (raiz de `toggl-report-front/`, não versionado como `.env`
  real — só o `.example` é commitado). No `docker-compose.yml` da raiz do
  repositório, é passada como **build arg** (`args: VITE_API_URL` no serviço
  `toggl_report_web`) apontando para a porta que a Api publica no **host**
  (`http://localhost:5003`) — não para o nome do serviço na rede interna do
  Compose (`toggl_report_api`), porque o `fetch` roda no navegador do usuário,
  que não resolve nomes de serviço Docker.
- **Curadoria de exibição replicada aqui, não pedida ao back-end**:
  `porDescricao` chega cru (sem ordenação especial); `curarPorDescricao`
  (`features/relatorio/curadoria.ts`) aplica a mesma regra do console (TEL
  primeiro, ordenado por segundos decrescente; demais depois, prefixados
  `(tag) descrição`) só para exibição, sem alterar os dados recebidos —
  simetria deliberada com a separação `ServicoAgrupamento` (dado) /
  `EscritorRelatorioConsole` (exibição) do back-end.
- **Zero `any`** (confirmado por grep): tipos explícitos em `src/api/tipos.ts`
  para todo request/response; sem `enum` do TypeScript
  (`erasableSyntaxOnly` ativo no `tsconfig.app.json` gerado pelo template) —
  `StatusConsultaUsuario` é uma union de strings literais.
  `RegistroTempoBruto` documenta explicitamente por que seus campos são
  snake_case (comentário no próprio arquivo — uma das poucas exceções à regra
  de "nomes em vez de comentário", porque aqui o "porquê" não é dedutível só
  pelo nome dos campos).
- **MUI 9.4.0** (mais novo que o esperado no momento em que o frontend foi
  criado): `Stack` não aceita mais `justifyContent`/`alignItems`/`flexWrap`/
  `gap` como props diretas, só via `sx` — ajustado em 8 arquivos. Não existe
  `@mui/lab` para essa versão; `BotaoComCarregamento` é um wrapper próprio em
  vez de usar `LoadingButton` da lib.
- **`ConsultaPanel` é compartilhado entre relatório e Gantt**: não chama mais
  `useConsulta()` internamente — recebe `resultado`/`consultando`/`executar`
  como props (cada chamador injeta o hook certo, `useConsulta`/`useConsultaGant`)
  e `agrupamento`/`tagsDetalhadas` como opcionais (`undefined` = não exibe a
  linha, usado pelo Gantt antes de ganhar esses campos). Evita duplicar o
  componente entre os dois fluxos.
- **Seleção de usuário para consulta não existe mais dentro do fluxo** — foi
  substituída pelo campo `Selecionado` do próprio usuário (aba "Usuários"),
  refletido em `ConsultaPanel` como uma lista somente-leitura de "Usuários
  selecionados" (`usuariosSelecionados`, filtrado em `App.tsx` a partir da
  mesma busca de usuários já usada para o aviso de "nenhum usuário
  cadastrado" — sem chamada duplicada).

### 5.4 Limitações conhecidas desta camada

- Depende da Web API estar rodando no endereço configurado (`VITE_API_URL`,
  padrão `http://localhost:5180`); sem ela, toda chamada falha com um aviso
  (snackbar), mas o app não trava.
- Sem autenticação (a API não tem) — não é para uso além de `localhost`.
- Não há testes automatizados (mesma limitação do resto do repositório).

### 5.5 Tema, tipografia e ícone

- **Um único tema, claro** (`theme.ts`, `createTheme` sem alternância) — um
  tema escuro chegou a ser implementado (com detecção de `prefers-color-scheme`
  e persistência em `localStorage`) e depois **removido por completo** a
  pedido do usuário; não reintroduzir sem pedido explícito.
- **Paleta central** (`CORES` em `theme.ts`): azul de destaque (`primary`/
  `info`), roxo (`secondary`/`warning`), cinza claro (`success`) — `error` é
  **propositalmente** deixado no vermelho padrão do MUI (nenhuma cor de erro
  foi pedida; sobrescrever removeria a distinção visual de falhas reais).
  `palette.action.hover` não é sobrescrito globalmente (isso afetava até o
  Stepper, indesejado) — o destaque de hover em campos de formulário
  (`TextField`/`Select`/`Autocomplete`, todos baseados em `OutlinedInput`) é
  feito via `components.MuiOutlinedInput`/`MuiFormControl` (borda + label na
  cor de destaque), não como preenchimento de fundo.
- **Título "TOGGL REPORT"** na `AppBar`: fonte Montserrat (Google Fonts,
  `index.html`), "TOGGL" em Semi-Bold (600) e "REPORT" em Light (300), com
  `letterSpacing` expandido — dois `<Box component="span">` dentro do mesmo
  `Typography`, estilo só local (não é `typography` global do tema). Ícone
  `toggl-report.png` (mesmo arquivo usado no Swagger, §4.7) antes do título;
  `icons.svg` (órfão, sem nenhuma referência) foi removido de `public/`.
- **Diálogo de confirmação genérico** (`DialogoConfirmacao.tsx`): só para
  confirmar uma ação antes de executá-la (Cancelar/Remover antes de excluir
  um usuário; Não/Consultar mesmo assim antes de forçar nova consulta à API,
  ver §5.3) — nunca para comunicar o *resultado* de uma ação. Mensagens de
  sucesso/aviso/erro (criar/editar/excluir usuário com sucesso, incluídas)
  usam sempre `useNotificacao` (`notificarSucesso`/`notificarErro`/
  `notificarInfo` — `Snackbar`+`Alert` global, cor por `severity` do MUI),
  o mesmo padrão de "Parâmetros salvos" do relatório/Gantt — nenhum diálogo
  modal exibe mensagem de resultado neste projeto.

---

## 6. Decisões de arquitetura (console — histórico original)

Tabela preservada do console antes da expansão para Web API/frontend
(2026-09-05). Decisões específicas do núcleo/API/frontend estão em §3/§4.3/§5.3.

| Decisão | Motivo |
|---|---|
| **Sem NuGet / sem DI / sem libs no console** | Build offline; projeto pequeno. (A Web API tem uma exceção pontual — `Swashbuckle.AspNetCore`, ver §4.3.) |
| **`Apresentacao/` isola toda a I/O de console** | `Paleta` (cores), `Tela` (telas fixas), `Prompt` (entrada + `EscolherOpcao`). Nenhuma outra classe mexe em `Console.ForegroundColor` direto (exceto os escritores de relatório, que usam `Paleta`). |
| **`AssistenteConfiguracao.LerCampo` genérico + `PodeReaproveitar`/`OfereceValorSalvo`** | Mesmo padrão do `AssistenteParametros` do irmão: cada campo é reaproveitado do salvo ou informado/validado/confirmado individualmente. O laço "confirmar tudo" fica no `Program`. |
| **`Prompt.LerEntrada` encerra em EOF** | `Environment.Exit(0)` quando o stdin fecha — sem laço infinito. |
| **`Tela.Cabecalho` recebe `ConfiguracaoApp`** | Deriva o resumo (período/agrupamento/usuários) em **uma única linha**; campos ainda não escolhidos aparecem como `—`. |
| **Moldura de largura dinâmica, estilo `╔═╗ ║ ╠═╣ ║ ╚═╝`** | `Tela.Largura` (`static int`, não mais `const`) é calculado por `Tela.Inicializar()` como `Console.WindowWidth - 2` sempre que der para ler — nunca mais larga que a janela real; só cai para `LarguraPadrao` = 100 no `catch (IOException)`. Helpers `Borda`/`LinhaCentralizada`/`LinhaTexto`/`Centralizar`/`Ajustar`; `Tela.Largura`, `Tela.Ajustar(texto, largura)`, `Tela.LarguraRestante(int)` e `Tela.LinhaPreenchida` são públicos para os escritores de `Relatorios/` reaproveitarem. |
| **`Tela.Limpar()` limpa via sequência ANSI (incluindo scrollback) + `Console.Clear()`, só quando não redirecionado** | `Console.Clear()` sozinho se mostrou pouco confiável para limpar a tela visível em alguns terminais Windows; a sequência inicial (dois códigos VT: apaga tela + reposiciona cursor) não apagava o *scrollback*. `Tela.SequenciaLimparTela` ganhou um terceiro código VT ("erase saved lines") entre os dois. `Console.IsOutputRedirected` no início evita escrever códigos de escape numa saída redirecionada. |
| **`Tela.ExibirComCabecalho(versao, configuracao, Action conteudo)`** | Centraliza "limpar + redesenhar cabeçalho + imprimir conteúdo" num único ponto. |
| **Nem toda impressão de conteúdo limpa a tela — só troca de tela genuína** | `ImprimirConteudoRelatorio` (primeira exibição do relatório) e o aviso de "nenhum usuário retornou dados" **não** limpam — ficam anexados logo abaixo das linhas de progresso/erro por usuário. Só quando o usuário pede explicitamente para trocar de tela é que `Tela.ExibirComCabecalho`/`Tela.Cabecalho` limpam antes. |
| **Parser de INI compartilhado** (`AnalisadorIni.Analisar`) | `TogglRelatorioParametros.ini` e `TogglRelatorioData.ini` têm o mesmo formato de seções/`chave=valor`; extrair o parser evita duas implementações idênticas. |
| **`TogglRelatorioParametros.ini` e `TogglRelatorioData.ini` como único estado persistente, dentro de `dados/`** | Em `AppContext.BaseDirectory/dados` (ao lado do exe), sem banco; legíveis/editáveis à mão. `TogglRelatorioData.ini` guarda o retorno **cru** da API — carregar do cache nunca pula a etapa de processamento, só a chamada HTTP. |
| **Limite de 30 requisições/hora por usuário em memória** (`Toggl/LimitadorRequisicoes`) | Camada extra de segurança além do retry de 429 já existente em `ClienteApiToggl`; não persiste entre execuções. Quando atingido, cai para o cache daquele usuário **somente se for do mesmo período e token**. |
| **`ResultadoApiToggl<T>`** (`Ok`/`Falha`) | Erros esperados (401, 429, rede) não usam exceptions. |
| **Um `HttpClient` por `ClienteApiToggl` por usuário** | Basic Auth próprio; app de vida curta. |
| **Busca opera sobre dados em memória** (console) / **relidos do cache** (API) | Já baixados; não repetir chamadas nem gastar rate limit. |
| **Classes estáticas nos serviços de `Relatorios`/`Consultas`** | Sem estado (exceto `LimitadorRequisicoes`, que precisa de estado por design); funções puras. |
| **Tipo explícito no lugar de `var`** | Preferência do projeto (console e API C#; ver equivalente em TS no §5.3). |
| **Sem exportação para CSV** | Removida por completo — os dados só existem no console/frontend e no cache. |
| **Duração `HHhMMmSSs`** | Ex.: `03h30m15s`; horas podem passar de 24. Replicada em TS (`utils/duracao.ts`) no frontend. |
| **Tag com N valores conta para cada tag** | Igual ao Toggl nativo; soma da visão "por tag" pode exceder o total. |
| **`AgruparPorTag` é case-insensitive** (`StringComparer.OrdinalIgnoreCase`) | Precisa bater com o casamento de "tag está em `TagsDetalhadas`?" (também `OrdinalIgnoreCase`). |
| **Descrição truncada com `…` só na exibição** (`Tela.Ajustar(texto, largura)`) | Usado por `EscritorRelatorioConsole` e `EscritorBuscaDescricao`; o dado cru (console/API/cache) nunca é truncado. |
| **Busca por descrição reaproveita `EscritorRelatorioConsole.ImprimirLinha`/`Indentacao`/`TituloSecaoDescricao`, não duplica** | Lista agrupada por descrição com detalhe por usuário indentado, no mesmo estilo visual de "Por descrição". |
| **Normalização de "TEL" na chave de agrupamento, não só na exibição** | Fazer só na exibição faria a mesma descrição em grafias diferentes virar duas linhas idênticas com totais separados. |
| **"Por descrição" tem duas versões de `AgruparPorDescricaoComTag`** (com e sem filtro por `tagsDetalhadas`) | Filtrar incondicionalmente deixaria o agrupamento "descricao" puro sempre vazio. |

---

## 7. Histórico de mudanças estruturais

Itens 1–13 são de 2026-09-02 e 2026-09-04/05, **anteriores** à criação da Web
API e do frontend — todos os caminhos citados neles (`TogglReport/...`) eram
válidos naquele momento (raiz do repositório). Depois da reestruturação em
`toggl-report-back/` (itens 14–15), os mesmos arquivos vivem em
`toggl-report-back/TogglReport/...` (console) ou
`toggl-report-back/TogglReport.Nucleo/...` (o que virou compartilhado) — texto
histórico mantido como estava escrito, sem reescrever caminhos.

1. **Correção do build:** `Program.cs` estava na raiz do repо, fora de
   `TogglReport/` (`CS5001`). `git mv Program.cs TogglReport/Program.cs`.
2. **Tradução completa para pt-BR:** identificadores, pastas
   (`Config`→`Configuracao`, `Wizard`→`Assistente`, `Reporting`→`Relatorios`),
   namespace `TogglReport`→`RelatorioToggl`, e o **esquema do arquivo de
   config** (`[Geral]`, `DataInicioAnterior`, `AgrupamentoPadrao=descricao|tag|
   ambos`, `[Usuario:x]`, `NomeExibicao`, `TokenApi`). Sem retrocompatibilidade
   — o projeto ainda não foi distribuído. `var` → tipo explícito.
   `<Nullable>` → `enable`. `<NeutralLanguage>` `pt-GW` → `pt-BR`.
3. **Interface visual** alinhada ao `gerador-chave-nfe`: nova pasta
   `Apresentacao/` (`Paleta`, `Tela`, `Prompt`, `Rotulos` +
   `AssistenteConfiguracao` e `MenuTokenUsuario`, movidos de `Assistente/`).
   Banner de boas-vindas em moldura Unicode, `Tela.Carregando`,
   `Tela.Cabecalho` redesenhado a cada passo, `Tela.Despedida`. `Program`
   reorganizado: fase de consulta (com progresso) separada da fase de
   impressão.
4. **Limpeza de comentários**: removidos os que apenas repetiam o código;
   mantidos só os que explicam um *porquê* ou uma regra de domínio não óbvia.
5. **Revisão por agentes independentes + correções**: fuso local→UTC na
   normalização de datas; validação de `NomeExibicao` único; validação de
   período (`fim >= inicio`); aviso quando nenhum usuário retorna dados;
   `HttpClient` com `Timeout` de 30 s; `usings` redundantes removidos;
   `.gitattributes` (`* text=auto eol=crlf`, `core.autocrlf=false`) e todos os
   arquivos em CRLF.
6. **Padronização final da moldura** (paridade total com o
   `gerador-chave-nfe`): `Tela` passou a usar uma **caixa única**
   (`╔═╗ ║ ╠═╣ ║ ╚═╝`, `Largura = 100`) — a tela de abertura e o cabeçalho têm
   exatamente a mesma largura e o mesmo estilo. O resumo do cabeçalho ficou em
   uma única linha (`Período · Agrupamento · Usuários`). `Carregando` e
   `Despedida` idênticos aos do projeto irmão.
7. **Alinhamento de arquitetura/funcionamento com o `gerador-chave-nfe`**:
   `AssistenteConfiguracao` reescrito com `LerCampo` genérico,
   `PodeReaproveitar`/`OfereceValorSalvo`; `Prompt.EscolherOpcao` adicionado;
   config persistido em `TogglReport.ini` em `AppContext.BaseDirectory`; falha
   ao salvar tratada; EOF encerra o app; prompts com `padraoSim`.
8. **Ajustes de exibição do relatório + tags detalhadas** (pedido do usuário,
   correções após revisão por 2 agentes independentes): lista de usuários
   antes da confirmação final; larguras fixas na largura da moldura; duração
   com segundos (`HHhMMmSSs`); truncamento só no console (o CSV, já removido,
   gravava o texto completo); tags detalhadas mostravam descrição/tempo por
   entrada (comportamento **substituído no item 9**); bug de
   `AgruparPorTag` case-sensitive corrigido; tabela de busca (já removida)
   ajustada para não estourar a largura; linha em branco antes da pergunta de
   busca.
9. **Segunda rodada de ajustes no relatório** (mesmo dia do item 8): cabeçalho
   sem lista de usuários (só no resumo); sem separador `-` entre seções;
   largura calculada por linha em vez de fixa; "Por tag" passou a listar só
   tags fora de `TagsDetalhadas`, sem detalhamento; "Por descrição" ganhou
   ordenação por prefixo "TEL"; CSV (já removido) ajustado; despedida com
   moldura completa; bug de `TagsDetalhadas` zerada com agrupamento
   "descricao" corrigido.
10. **Terceira rodada** (mesmo dia dos itens 8 e 9): "Por descrição" passou a
    filtrar por `TagsDetalhadas` também com agrupamento "ambos"; normalização
    de "TEL" aplicada já na chave de agrupamento; "Em andamento" com a mesma
    largura das outras seções; linha dupla `═` após o último colaborador;
    cores de mensagens ajustadas; 2 bugs corrigidos (filtro sem válvula de
    escape para agrupamento "descricao"; normalização só na exibição, não na
    chave).
11. **Cache de consulta, remoção do CSV, UX de busca/pós-busca e moldura
    dinâmica** (2026-09-05, mapeamento inicial por um subagente
    somente-leitura): cache `ToggleData.ini` introduzido;
    `Configuracao/AnalisadorIni.cs` extraído; fluxo de abertura passou a
    decidir cache vs. API; limite de 30 requisições/hora introduzido
    (`LimitadorRequisicoes`); CSV removido por completo (`EscritorRelatorioCsv`,
    `LinhaCsv`, `EscritorTabelaBusca.ExportarCsv`, `Program.ExportarCsv`,
    `SanitizarNomeArquivo`, e os métodos de `ServicoAgrupamento` que só
    alimentavam o CSV cru); busca passou a reaproveitar
    `Tela.LarguraRestante`; menu de três opções pós-busca; `Tela.ExibirComCabecalho`
    centralizou limpar+cabeçalho+conteúdo; moldura passou a ser dimensionada
    pelo terminal; comentários removidos do código tocado nesta rodada.
12. **Correções de acabamento sobre o item 11** (mesmo dia, 5 ajustes
    pontuais): `TogglReport.ini`/`ToggleData.ini` movidos para `dados/`;
    `CacheConsulta`/`UsuarioCacheado` e `LinhaBusca`/`ResultadoBuscaDescricao`
    separados em arquivos próprios; bug real na largura da moldura corrigido
    (`Math.Max(100, ...)` forçava mínimo mesmo em terminais mais estreitos);
    `Tela.Limpar()` trocado para ANSI + `Console.Clear()`; busca por
    descrição reformulada de tabela-pivô para lista agrupada por descrição
    (`EscritorTabelaBusca` → `EscritorBuscaDescricao`).
13. **Limpeza real do console + espaçamento na busca** (mesmo dia, 2 ajustes
    pontuais): `Tela.SequenciaLimparTela` ganhou o terceiro código ANSI
    (`\x1b[3J`, apaga scrollback); linha em branco entre grupos de descrição
    na busca (`EscritorBuscaDescricao.ImprimirNoConsole`).
14. **Web API + frontend + reestruturação do repositório em `toggl-report-back`/
    `toggl-report-front`** (2026-09-05, mesmo dia; pedido do usuário, em 5
    fases):
    - **Fase 0 (mapeamento, somente leitura)**: identificado o que era puro
      (`Configuracao/`, `Toggl/`, parte de `Relatorios/`) vs. console-only
      (`Apresentacao/`, os escritores de texto) vs. lógica de orquestração
      presa no `Program.cs` (decisão cache×API + rate limit) que precisava
      virar serviço comum para não duplicar entre console e API.
    - **Fase 1 (reestruturação)**: todo o conteúdo de `TogglReport/` (raiz)
      movido para `toggl-report-back/` (`git mv` arquivo a arquivo — o `git
      mv` da pasta inteira falhou por um handle de arquivo travado em
      `TogglReport/bin/Debug/net10.0`, provavelmente o Visual Studio aberto;
      contornado movendo cada arquivo/subpasta individualmente).
      `Configuracao/`, `Toggl/` e as partes puras de `Relatorios/` extraídas
      para um novo projeto `TogglReport.Nucleo` (biblioteca de classes,
      mesmos namespaces `RelatorioToggl.*` preservados — sem renomear, para
      minimizar o diff). Nova classe `Consultas/ServicoConsulta` no núcleo,
      extraída de `Program.cs` (`ObterRegistrosAsync`/`ConsultarUsuarios`/
      `CarregarCacheSeExistente`/`CacheCorrespondeAosParametros`/
      `CarregarRegistrosDoCache`/`SalvarCache`), com progresso reportado via
      `Action<EventoConsultaUsuario>` em vez de `Paleta`/`Tela` diretos — o
      console passou a fornecer esse callback (`ImprimirProgressoConsulta`)
      para imprimir como antes. Nova `Configuracao/CaminhosDados` (monta os
      caminhos `dados/*.ini` a partir de um diretório base, reaproveitada por
      console e API). Também extraída `Configuracao/ServicoUsuarios`
      (`GerarChaveUnica`/`NomeEmUso`/`MascararToken`, antes privados em
      `MenuTokenUsuario`) e `ServicoAgrupamento.AgruparPorTagFiltrada` (antes
      um filtro inline em `EscritorRelatorioConsole.ImprimirSecaoTag`) — as
      duas reaproveitadas pela Web API sem duplicar a regra.
    - **Fase 2 (Web API)**: novo projeto `TogglReport.Api` (Minimal APIs),
      endpoints listados em §4.2, testados manualmente com `curl` (inclusive
      com um `ToggleData.ini`/`TogglReport.ini` fictício criado à mão para
      confirmar o formato exato do JSON de `/api/relatorio`/`/api/busca`,
      incluindo a peculiaridade do snake_case em `emAndamento`).
    - **Fase 3 (Swagger)**: `Swashbuckle.AspNetCore` adicionado (única
      dependência NuGet do repositório); durante a configuração, um erro de
      compilação (`Microsoft.OpenApi.Models` não existe nessa versão do
      pacote) revelou que a versão 10.x do Swashbuckle traz `Microsoft.OpenApi`
      2.x, que moveu `OpenApiInfo` para o namespace `Microsoft.OpenApi` (sem
      `.Models`) — corrigido. `JsonStringEnumConverter` adicionado global para
      status aparecer como string, não número.
    - **Fase 4 (frontend)**: `toggl-report-front/` criado por um subagente a
      partir de um briefing com o contrato completo da API — revisão manual
      confirmou tipos, curadoria de exibição e build (ver §5.1).
    - **Fase 5 (validação)**: `dotnet build` dos três projetos C# e
      `npm run build`/`npx tsc -b` do frontend confirmados limpos.
    - Durante o trabalho, o usuário esclareceu que a intenção original (Fase
      1) estava errada: `TogglReport.Nucleo` e `TogglReport.Api` deveriam
      ficar **dentro** de `toggl-report-back/`, não como pastas irmãs na raiz
      — corrigido no item 15.
15. **Correção de estrutura: `Nucleo`/`Api` movidos para dentro de
    `toggl-report-back`** (2026-09-05, mesmo dia, logo após o item 14):
    "todos os arquivos dos projetos C# devem ficar em `toggl-report-back`,
    tanto os da API como os do console; só o que puder ser comum a back e
    front fica na raiz do repositório" — como back (C#) e front (TypeScript)
    não compartilham código-fonte, isso significa que a raiz do repositório
    não tem nenhum projeto C#, só documentação/config genéricos. Movido:
    `toggl-report-nucleo/` → `toggl-report-back/TogglReport.Nucleo/`;
    `toggl-report-api/` → `toggl-report-back/TogglReport.Api/` (com `mv`
    simples — a API nunca tinha sido adicionada ao índice do git, então
    `git mv` falhava com "source directory is empty"); o console, antes
    solto direto em `toggl-report-back/`, ganhou sua própria subpasta
    `toggl-report-back/TogglReport/`; `TogglReport.slnx` movido de volta para
    dentro de `toggl-report-back/` (referenciando os 3 projetos com caminhos
    relativos a ele mesmo agora). `ProjectReference` do console e da API
    ajustadas (`../TogglReport.Nucleo/...`); caminhos `..\GM.png`/
    `..\README.md` do `.csproj` do console ajustados para `..\..\` (o projeto
    ficou uma pasta mais profundo). Build validado do zero após a correção.
    Depois desta correção, o `CLAUDE.md` e os `README.md` (um breve na raiz
    linkando para um detalhado em cada pasta `toggl-report-back/`/
    `toggl-report-front/`) foram escritos/reescritos para refletir a
    estrutura final — este arquivo é o resultado disso.
16. **Console renomeado para `TogglReport.Console`; limpeza de comentários
    estendida a todo o núcleo** (2026-09-05, mesmo dia, feito diretamente pelo
    usuário — provavelmente via Visual Studio, a julgar pela pasta `.vs/` e
    pela reformatação de indentação em `launchSettings.json`): a pasta e o
    arquivo `.csproj` do console foram renomeados de `TogglReport`/
    `TogglReport.csproj` para `TogglReport.Console`/`TogglReport.Console.csproj`
    — **sem** alterar `AssemblyName` (`TogglReport`) nem `RootNamespace`
    (`RelatorioToggl`), então o executável gerado continua `TogglReport.exe`;
    a mudança é só de nome de pasta/arquivo de projeto, para bater com o
    padrão `TogglReport.<X>` que `TogglReport.Api`/`TogglReport.Nucleo` já
    seguiam. `TogglReport.slnx` atualizado para o novo caminho. Nos arquivos
    do núcleo que ainda tinham XML doc comments originais (não cobertos pelas
    rodadas 11–15, por terem sido só movidos, não reescritos, na Fase 1 do
    item 14) — `ConfiguracaoApp.cs`, `ConfiguracaoUsuario.cs`,
    `ClienteApiToggl.cs`, `RegistroTempoDto.cs`, `ResultadoApiToggl.cs`,
    `LinhaDescricao.cs` — os comentários foram removidos, estendendo a regra
    "sem comentários" a todo o `TogglReport.Nucleo`. `.gitattributes` ganhou
    declarações `text` explícitas para `.cs`/`.json`/`.ts`/`.tsx`/`.html`/
    `.css` (reforçando o `* text=auto eol=crlf` já existente).
    `launchSettings.json` da API teve o nome do profile trocado de `"http"`
    para `"toggl-report"` e a indentação normalizada (sem mudança de porta —
    continua `5180`). Nenhuma mudança de comportamento/lógica em nenhum dos
    dois — confirmado por `git diff` arquivo a arquivo antes de atualizar esta
    documentação, e por rebuild dos projetos afetados
    (`TogglReport.Nucleo`/`TogglReport.Console`; `TogglReport.Api` não pôde
    ser recompilado no momento por estar rodando/travado pelo próprio usuário,
    mas sua compilação já havia terminado com sucesso antes da falha de cópia
    do `.exe` travado — só a etapa de cópia falhou, não a compilação).
    `README.md`/`CLAUDE.md` atualizados para os novos caminhos/nomes.
17. **Gráfico de Gantt** (2026-09-05/06, várias rodadas em fases — Fase 0
    sempre somente leitura, com exemplo concreto de agrupamento confirmado
    pelo usuário antes de mexer na lógica mais ambígua):
    - **Parâmetros e cache próprios**: `ConfiguracaoGant`/`ToggleGantParametros.ini`
      (período + `TagsSelecionadas` + `Agrupamento`, mesmo formato/conceito do
      `TogglReport.ini`) e `ToggleGantData.ini` (cache cru, mesmo formato de
      `CacheConsulta`/`UsuarioCacheado` do relatório — `CarregadorCacheIni` já
      era genérico o bastante para reaproveitar sem mudar nada). `CaminhosDados`
      ganhou `CaminhoParametrosGant`/`CaminhoCacheGant`. `POST /api/gant/consultas`
      reaproveita `ServicoConsulta` inteiro (cache-first, rate limit, fallback),
      só trocando o arquivo de cache — nenhuma lógica de consulta duplicada.
    - **Reaproveitamento da listagem de usuários**: o cadastro (antes um modal
      aberto por um ícone na `AppBar`) virou uma **aba fixa** ("Usuários",
      primeira aba, selecionada por padrão), usada tanto pelo fluxo do
      relatório quanto pelo do Gantt — `UsuariosPanel` ganhou botões de
      rodapé opcionais (`onVoltar`/`onContinuar`) para funcionar tanto solto
      na aba quanto embutido num Stepper.
    - **Seleção de usuário para consulta** (`ConfiguracaoUsuario.Selecionado`,
      §1/§2.4): campo novo, checkbox na listagem de usuários, filtrado em
      `POST /api/consultas` e `POST /api/gant/consultas` antes de consultar.
    - **Sigla e cor do usuário** (`ConfiguracaoUsuario.Sigla`/`Cor`, §1/§2.4):
      campos exclusivos da web, usados para identificar visualmente cada
      usuário nas células do Gantt.
    - **`ServicoGant.Montar`** (`TogglReport.Nucleo/Gant/`, ver §4.6):
      agrupamento por usuário → categoria (tag) → descrição, respeitando
      `TagsSelecionadas`/`Agrupamento`; dias úteis apenas (sábado/domingo
      ocultos); busca por termo sem endpoint novo (parâmetro opcional em
      `GET /api/gant`).
    - **`GantView.tsx`** (frontend): tabela única (não cards) com colunas de
      dia + grade (`borderLeft`/`divider` entre colunas de dia), célula
      colorida com a sigla do usuário — **preenchimento de fundo idêntico**
      em qualquer visão (normal ou resultado de busca, mesmo código, sem
      distinção); colapsar/expandir por usuário (mesmo padrão de estado
      `expandido`/`alternarTodos` do `RelatorioView`, adaptado para uma linha
      de cabeçalho clicável em vez de `Accordion`, já que é uma tabela
      contínua) — inicia **colapsado**, igual ao relatório; busca por
      descrição embutida na própria view (não usa o layout de lista do
      `BuscaPanel` do relatório — o resultado tem que aparecer na mesma
      grade/cores/colapso do Gantt, então reexecuta `GET /api/gant` com
      `termo` e renderiza a mesma tabela, sem componente de resultado
      separado); duração no mesmo formato do relatório (`formatarDuracao`,
      não decimal); ordenação de usuários igual à do relatório (ordem de
      cadastro, não alfabética).
    - **Bugs corrigidos durante as rodadas**: (a) categoria ficando em branco
      por colapso indevido entre linhas — removido, a coluna sempre mostra a
      categoria; (b) busca retornando resultado que caía numa linha agregada
      (rótulo = nome da tag, sem o texto buscado) — corrigido forçando
      `tagSelecionada = true` sempre que há termo de busca ativo; (c) um
      diagnóstico à parte revelou que várias "correções sem efeito" eram na
      verdade o `TogglReport.Api.exe` do usuário rodando com um
      `TogglReport.Nucleo.dll` desatualizado — o processo trava o próprio
      arquivo, impedindo o `dotnet build` de copiar a versão nova para o
      `bin/` da API; confirmado comparando os timestamps do `.dll` fonte vs.
      o copiado. **Lição para sessões futuras**: depois de qualquer mudança
      em `TogglReport.Nucleo`, o `TogglReport.Api.exe` em execução precisa
      ser reiniciado para carregá-la — um `dotnet build` que só falha com
      `MSB3026`/`MSB3027` (erro de cópia, não `error CS...`) não é um bug de
      código, é esse processo travando o próprio arquivo.
    - **Simplificação da tela "Consultar"** (compartilhada pelos dois
      fluxos): removida a lista de usuários cadastrados (virou obsoleta com
      a seleção acima) e a contagem de registros por usuário; a mensagem
      "Resultado servido do cache local..." saiu daqui e passou a aparecer
      no Relatório/Gantt (`veioDoCache` repassado por `App.tsx`, mesmo texto/
      ícone reaproveitados).
    - **Diálogos de confirmação** (`DialogoConfirmacao.tsx`, §5.5): antes de
      excluir um usuário e depois de criar/editar/excluir com sucesso.
    - **Bug corrigido no formulário de usuário**: `nomeExibicao` não
      atualizava ao trocar entre "criar"/"editar" porque o `useState` só lê o
      valor inicial na primeira montagem e o diálogo nunca desmonta — corrigido
      com um `useEffect` que repopula os campos toda vez que `aberto`/
      `usuarioEmEdicao` mudam.
    - **Nomenclatura "Gant" (um "t" só) é a correta neste projeto** — não
      "Gantt" (grafia em inglês do gráfico). Já houve uma rodada inteira
      trocando "Gantt" → "Gant" em identificadores/rotas/arquivos (mantendo
      as strings de nome de arquivo `ToggleGantData.ini`/
      `ToggleGantParametros.ini`, que já estavam certas desde o início) — ao
      criar código novo para essa funcionalidade, seguir "Gant".
    - Tema/tipografia/ícone da aplicação (tema único claro, título
      "TOGGL REPORT" em Montserrat, ícone na `AppBar`, Swagger customizado)
      foram trabalhados em paralelo a essas rodadas — ver §5.5/§4.7, sem
      relação direta com o Gantt além de terem acontecido na mesma janela de
      tempo.
18. **Correção da grafia "Toggle" → "Toggl" nos 4 arquivos de dados + unificação
    do padrão de nomes entre relatório e Gantt** (2026-09-06, mapeamento por
    ocorrência com classificação de risco antes de qualquer edição — nenhuma
    ocorrência de baixo risco foi encontrada; as únicas menções a "Toggle" no
    projeto inteiro, fora do `node_modules` do MUI, `ToggleButton`/`ToggleOn`/
    `ToggleOff`, termo genérico de terceiros sem relação com a marca, eram os
    3 nomes de arquivo abaixo e suas referências em docs/ignore-files):
    `TogglReport.ini` → `TogglRelatorioParametros.ini`, `ToggleData.ini` →
    `TogglRelatorioData.ini`, `ToggleGantParametros.ini` →
    `TogglGantParametros.ini`, `ToggleGantData.ini` → `TogglGantData.ini` —
    os 4 nomes passaram a seguir o mesmo padrão `Toggl<Domínio>Parametros.ini`/
    `Toggl<Domínio>Data.ini` (`Domínio` ∈ {`Relatorio`, `Gant`}), unificando o
    que antes só existia para o Gantt. **Migração automática, sem intervenção
    manual**: `CaminhosDados` (único ponto por onde console e Api resolvem
    esses 4 caminhos) passou a checar, antes de devolver o caminho novo, se o
    arquivo com o nome antigo existe e o novo ainda não — se sim, renomeia
    (`File.Move`) o antigo para o novo silenciosamente, com o mesmo
    `try/catch (IOException or UnauthorizedAccessException)` não-fatal que o
    projeto já usa para falhas de I/O em INI. Efeito: quem já tinha cache/
    config gravado com os nomes antigos continua enxergando os mesmos dados,
    sob o nome novo, na primeira execução após a atualização — sem perda.
    `.gitignore` (raiz e `toggl-report-back/`) e `.dockerignore`
    (`toggl-report-back/`) mantiveram as 4 entradas antigas (para quem ainda
    não rodou a migração) e ganharam as 4 novas. Nenhuma rota HTTP foi afetada —
    `GET /api/dados/download` (que zipa a pasta `dados/` inteira, ver §4.2) já
    lista o que existir em tempo de requisição, sem nomes de arquivo fixos.

---

## 8. `.gitignore`

`TogglReport.ini` foi adicionado em 2026-09-02 (o `README` antigo dizia que o
config já estava ignorado, mas não estava). `ToggleData.ini` foi adicionado em
2026-09-05 junto com a criação do cache. As entradas `relatorio_*.csv`/
`busca_*.csv` (de 2026-09-02) foram removidas em 2026-09-05 junto com a
exportação CSV. `node_modules/`/`dist/` (frontend) já estavam cobertos por
padrões genéricos preexistentes (seção "Node.js Tools for Visual Studio"), sem
precisar de entrada nova. Os padrões de `TogglReport.ini`/`ToggleData.ini` são
bare filenames — batem em qualquer profundidade de pasta (`bin/Debug/.../dados/
TogglReport.ini`, `toggl-report-back/TogglReport.Api/bin/.../dados/
ToggleData.ini`, etc.), então a reestruturação em `toggl-report-back/` não
exigiu nenhum ajuste aqui. `ToggleGantParametros.ini`/`ToggleGantData.ini`
(item 17 do histórico) foram adicionados ao lado dos outros dois pelo mesmo
motivo (tokens/dado cru). Os 4 nomes acima são os que existiam até o item 18
do histórico — a correção de grafia + unificação de padrão daquele item
renomeou os 4 arquivos (`TogglReport.ini` → `TogglRelatorioParametros.ini`,
`ToggleData.ini` → `TogglRelatorioData.ini`, `ToggleGantParametros.ini` →
`TogglGantParametros.ini`, `ToggleGantData.ini` → `TogglGantData.ini`); as 4
entradas antigas foram mantidas no `.gitignore` (não removidas), já que
`CaminhosDados` migra sozinho o arquivo antigo para o nome novo no primeiro
uso, mas só depois de encontrá-lo — até lá, ele ainda existe em disco com o
nome antigo. Se o `.gitignore` for regenerado do template do GitHub,
**reaplicar as linhas dos oito nomes** (`TogglRelatorioParametros.ini`,
`TogglRelatorioData.ini`, `TogglGantParametros.ini`, `TogglGantData.ini`, e os
4 antigos acima).

---

## 9. Convenções ao continuar o projeto

### C# (console, API, núcleo)

- **Tudo em pt-BR**; exceções: `Program`/`Main`, `Task`/`async`,
  `[JsonPropertyName]` com nomes da API, siglas (`Dto`, `Api`, `Ini`, `Http`).
- **Tipo explícito no lugar de `var`** sempre que o tipo puder ser nomeado.
- **Zero dependências NuGet no console** salvo decisão explícita; a API tem
  a exceção pontual do Swashbuckle (necessário para Swagger).
- Toda saída/entrada de console passa por `Apresentacao/`
  (`Paleta`/`Tela`/`Prompt`) — nunca `Console.ForegroundColor` solto.
- Novo serviço em `Relatorios/`/`Consultas/` do núcleo: classe estática,
  função pura, **sem** `Console`/`Paleta`/`Tela`.
- Fluxos de erro esperados: `ResultadoApiToggl<T>` (nunca exceptions) no
  cliente HTTP; a Web API usa `Results.BadRequest`/`NotFound`/`Conflict`/
  `Problem` para os equivalentes HTTP.
- Comentário só quando explica um *porquê* ou regra de domínio não óbvia —
  regra geral do projeto; **suspensa por completo** em todo o
  `TogglReport.Nucleo` e nos arquivos do console/API tocados pelas rodadas de
  2026-09-05 (itens 11–16 do histórico), por pedido explícito do usuário
  naquela ocasião — o item 16 estendeu a limpeza aos poucos arquivos do
  núcleo que ainda tinham XML doc comments originais (`ConfiguracaoApp`,
  `ConfiguracaoUsuario`, `ClienteApiToggl`, `RegistroTempoDto`,
  `ResultadoApiToggl`, `LinhaDescricao`). Arquivos do console **não** tocados
  nessas rodadas (`AssistenteConfiguracao`, `MenuTokenUsuario`, `Prompt`)
  mantêm seus comentários originais.
- `using` só para namespaces **não** cobertos pelo `ImplicitUsings`.
- `end_of_line = crlf` (via `.editorconfig` + `.gitattributes`),
  `charset = utf-8` (sem BOM em `.cs`).
- `dotnet build TogglReport.slnx` (dentro de `toggl-report-back/`) após
  mudanças; manter **0 warnings**.

### TypeScript/React (frontend)

- **Zero `any`** — tipos explícitos ou `unknown` com narrowing.
- Sem `enum` do TypeScript (`erasableSyntaxOnly` no `tsconfig`) — usar union
  types de string literais.
- Estrutura por feature (`features/<nome>/`), hooks separados dos
  componentes visuais, chamadas HTTP isoladas em `src/api/`.
- Tipos de request/response em `src/api/tipos.ts` devem espelhar
  exatamente os DTOs/records C# — ao mudar um endpoint da API, atualizar os
  dois lados.
- `npm run build` (que já roda `tsc -b`) e idealmente `npm run dev` com o
  console do navegador limpo antes de considerar uma mudança pronta.

---

## 10. Projeto irmão

`C:\Projetos\gerador-chave-nfe\GeradorChaveNFe` segue as **mesmas convenções e
o mesmo funcionamento** do console: `Paleta.cs`, `Prompt.cs` e os helpers de
moldura de `Tela.cs` (`Borda`/`LinhaCentralizada`/`LinhaTexto`/`Centralizar`/
`Ajustar`, `Carregando`, EOF → encerra) são **idênticos**; o assistente
(`LerCampo` genérico + reaproveitar/confirmar campo a campo + confirmação
final no `Program`) e a nomenclatura (`Gerar<X>EnquantoUsuarioQuiser`) foram
alinhados nos dois. Ao mudar uma convenção do **console** aqui, verificar se
cabe lá — o `gerador-chave-nfe` **não tem** Web API nem frontend, então §3–§5
deste arquivo não têm equivalente por lá. O `CLAUDE.md` de cada repо é a fonte
da verdade daquele projeto.

> **Pendência aberta (2026-09-04)**: `Despedida` deixou de ser idêntica — aqui
> ela envolve "Até a próxima!" numa moldura completa; no `gerador-chave-nfe`
> ainda é só com os `║` das laterais.

> **Pendência aberta (2026-09-05)**: dois pontos que eram idênticos entre os
> dois projetos deixaram de ser:
> 1. `Tela.Largura` aqui é dinâmica (`Tela.Inicializar()` mede
>    `Console.WindowWidth`); lá continua `const int Largura = 100` fixo.
> 2. O arquivo de config aqui foi movido para uma subpasta `dados/`; lá
>    continua solto direto em `AppContext.BaseDirectory`.
>
> Um terceiro ponto, novo: aqui o console agora é **um de três projetos** em
> `toggl-report-back/` (mais Web API e núcleo compartilhado) e há um frontend
> React (`toggl-report-front/`); o `gerador-chave-nfe` continua sendo um único
> executável. Isso não é uma "pendência" a replicar — é uma divergência de
> escopo entre os dois projetos, registrada aqui só para contexto.

### Diferenças que permanecem (justificadas pelos domínios — não são
### pendências)

| Ponto | Aqui (toggl-report, console) | Lá (gerador-chave-nfe) | Por quê |
|---|---|---|---|
| Versão | `1.0.0.0` (`X.Y.Z.W`) | `1.0.3.0` (`X.Y.Z.W`) | Cada projeto tem a sua. |
| `Main` | `async Task Main()` | `void Main()` | toggl faz chamadas HTTP. |
| Camada de saída | `Relatorios/` (agrupamento, escritor de console, busca) | não há (só `ExibirChaves`) | toggl produz relatórios; o gerador só imprime chaves. |
| Integração externa | núcleo compartilhado (`ClienteApiToggl` + DTOs) | não há | só o toggl fala com uma API. |
| Descrição de exibição | `Rotulos.Agrupamento` (string de 3 valores, sem tipo) | `Uf.Descricao`/`TipoEmissao.Descricao`/`Competencia.Descrever` (tipos de domínio) | onde há tipo, o rótulo mora nele; onde não há, num helper. |
| Nomes de pastas | `Configuracao/` · `Toggl/` · `Relatorios/` (+ `Consultas/` no núcleo) | `Dominio/` · `Geracao/` · `Persistencia/` | domínios de tamanho diferente; ambos coerentes internamente. |
