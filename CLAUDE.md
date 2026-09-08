# CLAUDE.md

Memória de contexto persistente do repositório **toggl-report**. Serve para orientar
qualquer sessão futura sem precisar reexplicar as decisões já tomadas.

O repositório reúne **dois projetos independentes**:

- **`toggl-report-back/`** — três projetos **C# / .NET 10** na mesma solução
  (`TogglReport.slnx`): o console original (`TogglReport.Console`), uma Web API com
  autenticação HTTP Basic opcional que expõe as mesmas funcionalidades (`TogglReport.Api`), e uma
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
  assistente guia a configuração e persiste em `dados/TogglRelatorioParametros.ini`
  (parâmetros do relatório) e `dados/TogglUsuarios.ini` (usuários/tokens,
  compartilhado com o Gantt — ver §2.4), ao lado do executável.
- **Web API** (`toggl-report-back/TogglReport.Api`): mesmas funcionalidades por
  HTTP, com autenticação HTTP Basic opcional (§4.8), documentada via Swagger, com sua **própria** pasta
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
- **Sprint** (só na Web API + frontend, sem equivalente no console, igual ao
  Gantt): terceira visualização, agora com **gestão** (CRUD de sprints) além do
  acompanhamento. Cada sprint tem nome, horas/dia e período próprios
  (`dados/TogglSprints.ini`); há um mapeamento **global** TAG → categoria
  (`Dev`/`Rev`/`Qa`, `dados/TogglSprintCategorias.ini`); cache de consulta
  dedicado (`dados/TogglSprintData.ini`, mesmo formato do relatório/Gantt). A
  tela de acompanhamento calcula a **capacidade por colaborador** e monta um
  grid com **uma linha por (tarefa × colaborador)**, agrupando por descrição
  ou por tag (conforme o `Agrupamento` da etapa "Parâmetros", regra do
  `ServicoGant`). Prioridade e Situação são **valores fixos exibidos**
  ("Baixa" / "Pendente"), sem edição nem persistência ("sem integração por
  enquanto"). Molde do Gantt em todas as camadas. Ver §4.9/§5/§7-item-27.
- **Usuário ganhou três campos exclusivos da versão web** (`Sigla`, `Cor`,
  `Selecionado`) — persistidos no mesmo `TogglUsuarios.ini`, lidos/gravados pelo
  `CarregadorUsuariosIni` (ver §2.4); o console não tem UI
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
  `Nullable=enable`. Versão atual (`<Version>` e `Program.Versao`): **1.0.1.0**.
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
2. **`OfereceRestaurarBackupSeNecessario`** (2026-09-06): se
   `CarregadorConfiguracaoIni.Carregar(...)` devolve `null` (nem
   `TogglRelatorioParametros.ini` nem `TogglUsuarios.ini` têm conteúdo —
   checagem única, antes do laço principal), pergunta se quer restaurar de
   um `.zip` da pasta `dados/` (caminho informado via `Prompt.Perguntar`,
   `ZipFile.ExtractToDirectory` na pasta); recusando ou não achando o
   arquivo, segue para o fluxo normal (cadastro do zero, já existente —
   opção "b" do pedido original já era o comportamento padrão).
3. **`GerarRelatoriosEnquantoUsuarioQuiser`** — laço `while (executarNovamente)`:
   1. **`ColetarConfiguracaoConfirmadaAsync`** — laço até o usuário confirmar:
      - `CarregadorConfiguracaoIni.Carregar(TogglRelatorioParametros.ini,
        TogglUsuarios.ini)` (uma vez por ciclo) e um `ConfiguracaoApp` novo —
        o loader combina o `[Geral]` de um arquivo com os `[Usuario:*]` do
        outro num único objeto em memória (ver §2.4).
      - `AssistenteConfiguracao.ColetarAsync(atual, salvos)` — campo a campo:
        **agrupamento** (`EscolherOpcao` + confirmar, ou reaproveitar o salvo),
        **tags detalhadas** (só se agrupamento é `tag`/`ambos`; lista livre
        separada por vírgula, ou reaproveitar a salva), **usuários** (submenu
        `MenuTokenUsuario`; obriga ≥ 1), **período** (data início/fim —
        reaproveitar salvo ou informar+confirmar; valida `fim >= inicio`).
      - Cabeçalho com o resumo, seguido da **lista de usuários selecionados**
        (um por linha, `Tela.ListarUsuariosSelecionados`) → `Confirmar a
        consulta com os parâmetros acima?`. Se recusado, recomeça. Se aceito,
        grava `TogglRelatorioParametros.ini` e `TogglUsuarios.ini` (com
        `try/catch`).
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
- **Usuários vivem num arquivo próprio, `TogglUsuarios.ini`, separado dos
  parâmetros do relatório desde 2026-09-07** (`CarregadorUsuariosIni.cs`,
  `TogglUsuarios.ini` — pedido do usuário: só as seções `[Usuario:<chave>]`,
  nada de `[Geral]`). `CarregadorConfiguracaoIni.Carregar(caminho,
  caminhoUsuarios)`/`.Salvar(caminho, caminhoUsuarios, configuracao)`
  delegam a leitura/escrita de `configuracao.Usuarios` para
  `CarregadorUsuariosIni` — o modelo em memória (`ConfiguracaoApp.Usuarios`)
  não mudou, só onde ele é persistido; nenhum consumidor de `ConfiguracaoApp`
  (`ServicoConsulta`, `ServicoGant`, `Tela`, `AssistenteConfiguracao`,
  `MenuTokenUsuario`) precisou mudar. **Migração automática, sem intervenção
  manual**: se `TogglUsuarios.ini` ainda não existe mas o arquivo de
  parâmetros informado tem seções `[Usuario:*]` (formato anterior a
  2026-09-07), `CarregadorUsuariosIni.Carregar` extrai e grava essas seções
  no novo arquivo na primeira leitura — mesmo espírito da migração
  silenciosa de nome de arquivo do item 18, mas aqui é uma migração de
  **conteúdo** entre dois arquivos, não uma renomeação. O arquivo de
  parâmetros perde as seções `[Usuario:*]` (que ficam só como legado, até
  a migração rodar) na primeira vez que for salvo depois disso, já que
  `Salvar` não as escreve mais ali.
- **`ConfiguracaoUsuario` tem três campos exclusivos da versão web**: `Sigla`
  (string curta, usada como rótulo nas células do Gantt), `Cor` (hex, cor de
  fundo dessas células) e `Selecionado` (`bool`, default `true` — decide se o
  usuário entra na próxima consulta). Persistidos como `Sigla=`/`Cor=`/
  `Selecionado=` na seção `[Usuario:<chave>]` de `TogglUsuarios.ini`, lidos
  com `AnalisadorIni.ObterOuPadrao` (`Selecionado` via `bool.TryParse`,
  default `true` se ausente ou inválido — usuários criados antes desse campo
  existir continuam selecionados). **Importante**: `CarregadorUsuariosIni.
  Salvar` grava os três campos sempre, mesmo quando quem chama é o console
  (que não tem UI para eles) — é o que evita perdê-los quando o console
  resalva a configuração. `ServicoUsuarios.SiglaEmUso` (mesmo padrão de
  `NomeEmUso`/`TokenEmUso`, mas ignorando siglas vazias) valida unicidade na
  Web API.
- **`TokenApi` é criptografado em repouso desde 2026-09-06**
  (`CriptografiaToken.Criptografar`/`Descriptografar`, AES, chave derivada de
  `CHAVE_CRIPTOGRAFIA` — renomeada de `TOGGL_CHAVE_CRIPTOGRAFIA` em 2026-09-07
  — ou uma chave padrão embutida se a env var não estiver configurada —
  proteção básica, não resiste a quem lê o código-fonte público). A env var é
  lida via `Environment.GetEnvironmentVariable` (não `IConfiguration`), então
  em dev no Visual Studio vai no bloco `environmentVariables` do
  `launchSettings.json` (ver §4.8). No mesmo rename de 2026-09-07 a
  string-semente de `CriptografiaToken.ChavePadrao` também passou a citar
  `CHAVE_CRIPTOGRAFIA` — isso **rotacionou a chave padrão embutida**, então
  `.ini` com tokens `enc:` gravados **sem** env var configurada (chave padrão
  antiga) precisam ter os tokens reinseridos. Não afeta quem usa
  `CHAVE_CRIPTOGRAFIA`/`TOGGL_CHAVE_CRIPTOGRAFIA` com o mesmo valor de antes,
  nem o Cloud Run (onde `dados/` é efêmero de qualquer jeito, ver
  `toggl-report-infra`). Aplicado em `CarregadorUsuariosIni` (`TogglUsuarios.ini`, desde
  2026-09-07 — antes era `CarregadorConfiguracaoIni`) e `CarregadorCacheIni`
  (`TogglRelatorioData.ini`/`TogglGantData.ini`, e vale pro console também —
  é o mesmo núcleo). Valor gravado com prefixo `enc:`; ao ler, se não tiver
  esse prefixo, trata como texto puro (arquivo de antes desta mudança) —
  migra sozinho pra criptografado no próximo `Salvar`, mesmo padrão de
  migração silenciosa já usado pra renomear arquivo (§7, item 18).
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
```

### `TogglUsuarios.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

Compartilhado pelo relatório e pelo Gantt (§4.6) — não tem `[Geral]`, só
seções `[Usuario:<chave>]`:

```ini
[Usuario:joao]
NomeExibicao=Joao Silva
TokenApi=enc:abcdef1234567890...
Sigla=JS
Cor=#5B82F6
Selecionado=True
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
- **Falha ao carregar/salvar `TogglRelatorioData.ini`/`TogglRelatorioParametros.ini`/`TogglUsuarios.ini`**:
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
- **`TogglRelatorioParametros.ini`, `TogglRelatorioData.ini` e `TogglUsuarios.ini`
  guardam dado sensível** — o `TokenApi` é criptografado em repouso (§2.4),
  mas os três são tratados como segredo mesmo assim (todos no `.gitignore`,
  ver §8), dentro de `dados/` ao lado de cada executável.
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
 │   ├─ ConfiguracaoApp.cs         # modelo do TogglRelatorioParametros.ini (Geral) + Usuarios em memória
 │   ├─ ConfiguracaoUsuario.cs     # Chave / NomeExibicao / TokenApi / Sigla / Cor / Selecionado
 │   ├─ CarregadorConfiguracaoIni.cs  # Carregar / Salvar do [Geral] de TogglRelatorioParametros.ini; delega Usuarios a CarregadorUsuariosIni
 │   ├─ CarregadorUsuariosIni.cs   # Carregar / Salvar do dados/TogglUsuarios.ini (seções [Usuario:*], compartilhado com o Gantt); migra sozinho de um TogglRelatorioParametros.ini antigo com usuários embutidos
 │   ├─ CriptografiaToken.cs       # Criptografar/Descriptografar (AES) do TokenApi, prefixo enc:
 │   ├─ CacheConsulta.cs           # modelo do TogglRelatorioData.ini: período + List<UsuarioCacheado>
 │   ├─ UsuarioCacheado.cs         # Chave / NomeExibicao / TokenApi / Registros (dado cru)
 │   ├─ CarregadorCacheIni.cs      # Carregar / Salvar do dados/TogglRelatorioData.ini
 │   ├─ AnalisadorIni.cs           # parser de INI compartilhado (Analisar/ObterOuPadrao/ObterOuNulo) + Escrever (CreateDirectory + WriteAllText UTF8 sem BOM, usado pelos 6 carregadores) + DividirLista (split por vírgula, RemoveEmptyEntries|TrimEntries, usado pelos 3 carregadores de lista)
 │   ├─ CaminhosDados.cs           # monta dados/TogglRelatorioParametros.ini, TogglUsuarios.ini, TogglRelatorioData.ini, TogglGantParametros.ini, TogglGantData.ini e os 3 do Sprint (TogglSprints / TogglSprintCategorias / TogglSprintData) a partir de um diretório base
 │   ├─ ServicoChaves.cs           # static: GerarChaveUnica(nome, chavesExistentes, fallback) — base compartilhada de ServicoUsuarios.GerarChaveUnica (fallback "usuario") e ServicoSprints.GerarChaveUnica (fallback "sprint"); NomeEmUso NÃO foi unificado (difere por tipo iterado + checagem de identidade)
 │   ├─ DiasUteis.cs               # static: Entre(inicio, fim) → IEnumerable<DateTime> (dias seg–sex de um intervalo inclusivo); ServicoGant e ServicoSprint.ContarDiasUteis consomem em vez de cada um ter seu loop com skip de sábado/domingo
 │   ├─ Agrupamento.cs             # static: EhValido(valor) → bool (descricao/tag/ambos); usado nos 3 endpoints de parâmetros
 │   ├─ ConfiguracaoGant.cs        # modelo do TogglGantParametros.ini: DataInicio/DataFim/TagsSelecionadas/Agrupamento
 │   ├─ CarregadorConfiguracaoGantIni.cs  # Carregar / Salvar do dados/TogglGantParametros.ini
 │   ├─ Sprint.cs                  # modelo do TogglSprints.ini: Nome/HorasPorDia/DataInicio/DataFim (classe mutável)
 │   ├─ ServicoSprints.cs          # static: NomeEmUso / GerarChaveUnica (delega a ServicoChaves, fallback "sprint")
 │   ├─ CarregadorSprintsIni.cs    # Carregar / Salvar das seções [Sprint:*] de dados/TogglSprints.ini
 │   ├─ ConfiguracaoCategoriasSprint.cs   # modelo do TogglSprintCategorias.ini: List<string> Dev/Rev/Qa
 │   ├─ CarregadorConfiguracaoCategoriasSprintIni.cs  # Carregar (nunca null — Padrao() se falta arquivo/chave; Padrao() vem SEM nenhuma TAG: Dev/Rev/Qa vazias, só Agrupamento="ambos") / Salvar do [Geral] de dados/TogglSprintCategorias.ini
 │   └─ ServicoUsuarios.cs         # GerarChaveUnica (delega a ServicoChaves, fallback "usuario") / NomeEmUso / TokenEmUso / SiglaEmUso / MascararToken
 ├─ Gant/                          # exclusivo do Gantt (nome com um "t" só — ver nota no item 18 do histórico)
 │   ├─ CelulaGant.cs              # record: UsuarioChave/NomeExibicao/Sigla/Cor/Horas de um usuário num dia
 │   ├─ LinhaGant.cs               # record: UsuarioChave/NomeExibicao/Categoria/Descricao/TotalHoras/CelulasPorDia
 │   ├─ ResultadoGant.cs           # record: Dias (dias úteis do período) + Linhas
 │   └─ ServicoGant.cs             # Montar(): agrupa o cache por usuário→categoria→descrição, dia a dia
 ├─ Sprint/                        # exclusivo do Sprint (namespace RelatorioToggl.Sprints — plural de propósito, ver item 27)
 │   ├─ CabecalhoSprint.cs         # record: resumo da sprint (nome, horas/dia, dias úteis, margem, período, Ct, Td) + TarefasPendentes/TarefasConcluidas (Concluidas sempre 0 — sem situação)
 │   ├─ BlocoCategoriaSprint.cs    # record: BlocoCategoriaSprint(decimal PreHoras, long ReaSegundos) — tempo previsto/realizado de uma categoria (Dev/Rev/Qa)
 │   ├─ LinhaTarefaSprint.cs       # record: Codigo + Descricao + NomeExibicao/Sigla/Cor do colaborador + Agrupada (true = linha agregada por tag) + 3 BlocoCategoriaSprint (Dev/Rev/Qa) — uma linha por (tarefa × colaborador)
 │   ├─ LinhaColaboradorSprint.cs  # record: NomeExibicao/Sigla/Cor/Td/SegundosRealizados/TarefasPendentes/TarefasConcluidas de um colaborador do sprint (Concluidas sempre 0)
 │   ├─ ResultadoSprint.cs         # record: Cabecalho + Linhas + Colaboradores
 │   └─ ServicoSprint.cs           # static, puro: Montar(sprint, usuariosSelecionados, resultadoConsulta, categorias) → ResultadoSprint (uma linha por tarefa × colaborador; tag-agg roteada p/ QA ou DEV por colaborador; grid ordenada por NumeroCodigo — nº extraído do Codigo, não string)
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

`Sprint/ServicoSprint.Montar` é o equivalente do `ServicoGant.Montar` para o
Sprint: função pura que recebe a sprint, os usuários selecionados, o
`ResultadoConsulta` (dado cru do cache/API) e o mapeamento de categorias, e
devolve um `ResultadoSprint` (cabeçalho com o cálculo de capacidade + uma
linha de tarefa por **(tarefa × colaborador)**). `ChaveAgrupamento` devolve
`(string Chave, bool Agrupada)` — linhas de descrição (`Agrupada == false`,
`Codigo`/`Descricao` separados por `SepararCodigo`, regex
`^(TEL - \d+)(?: - (.+))?$`) e linhas agregadas por tag (`Agrupada == true`,
só com agrupamento `tag`/`ambos`), estas roteadas para **um** grupo por
colaborador — QA se o colaborador tem ≥ 1 apontamento no sprint com tag ∈
`categorias.Qa`, senão DEV (REV nunca recebe tag-agg). **Não há mais campos
manuais** (prioridade/situação) — ver item 27, "Ajuste posterior 7". A grid é
ordenada pelo **número do código** (`ServicoSprint.NumeroCodigo` extrai os
dígitos de `Codigo` — `.ThenBy(t => t.Agrupada ? 0 : NumeroCodigo(t.Codigo))`
antes do desempate por string): `TEL - 994 → TEL - 1000 → TEL - 1118` (antes
era ordenação por string, e `TEL - 1118` vinha antes de `TEL - 994`); linhas
de descrição por nº crescente de código, as sem código depois, tag-agg por
último na ordem dos colaboradores. Só na Web API + frontend. O cálculo de
capacidade e o formato da tela estão em §4.9.

---

## 4. Web API (`toggl-report-back/TogglReport.Api`)

### 4.1 Visão geral

ASP.NET Core, **Minimal APIs** (não Controllers — projeto pequeno e focado),
`Microsoft.NET.Sdk.Web`, referencia `TogglReport.Nucleo`. **Autenticação HTTP
Basic opcional** (§4.8) — desligada por padrão (uso local sem fricção),
ligada configurando `AUTH:USUARIO`/`AUTH:SENHA` (produção).

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

Dois helpers internos em `Endpoints/` (não são rotas, extraídos pela auditoria
de 2026-09-07 — item 29):

- **`ValidacaoDatas.Tenta(dataInicio, dataFim, out inicio, out fim, out erro)`**
  — consolida `DateTime.TryParse` + `fim < inicio` (mensagens `"Datas inválidas.
  Use o formato AAAA-MM-DD."` / `"A data fim não pode ser anterior à data
  início."`), usado em 7 handlers (`ConfiguracaoEndpoints`, `ConsultasEndpoints`,
  `GantEndpoints` PUT /parametros + POST /consultas, `SprintConsultasEndpoints`,
  `SprintsEndpoints` POST + PUT). **`GET /api/gant` ficou de fora** — só faz
  `TryParse`, sem `fim < inicio`, por design.
- **`TratamentoIo.Executar(acao, mensagemErro)` → `IResult?`** — `null` em
  sucesso; `Results.Problem(mensagemErro, 500)` em `IOException`/
  `UnauthorizedAccessException`. Usado em 9 sites (`ConfiguracaoEndpoints`,
  `GantEndpoints` PUT, `SprintCategoriasEndpoints`, `SprintsEndpoints` 3×,
  `UsuariosEndpoints` 3×). **`DadosEndpoints` ficou de fora** — o `try` ali
  também envolve `Directory.CreateDirectory` + validação de estrutura do zip
  (com `BadRequest` no meio) e um `catch (InvalidDataException)` precedente.

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
| `POST` | `/api/dados/restaurar` | `DadosEndpoints` | Recebe um `.zip` (`multipart/form-data`, campo `arquivo`) e extrai (`ZipArchive.ExtractToDirectory`, sobrescreve) na pasta `dados/` — cria a pasta se não existir. Não valida se a pasta já tinha dados; quem decide quando oferecer é quem chama (Fase 2 de 2026-09-06: pensado para "config ausente" no primeiro uso). **400 se alguma entrada do zip estiver dentro de uma pasta** (`entrada.FullName != entrada.Name`) — o zip precisa ter os arquivos direto na raiz, não uma pasta `dados/` (ou qualquer outra) por dentro; entradas de diretório puro (`Name` vazio) são ignoradas, não rejeitadas (2026-09-07). **500 com mensagem limpa** em qualquer `IOException`/`UnauthorizedAccessException` real (item 25 do histórico) |
| `GET` | `/api/gant/parametros` | `GantEndpoints` | `{ dataInicio, dataFim, tagsSelecionadas, agrupamento }` do Gantt (independente do relatório) |
| `PUT` | `/api/gant/parametros` | `GantEndpoints` | Atualiza os 4 campos acima |
| `POST` | `/api/gant/consultas` | `GantEndpoints` | Igual a `POST /api/consultas`, mas grava em `TogglGantData.ini` — reaproveita `ServicoConsulta` inteiro, só troca o caminho do cache |
| `GET` | `/api/gant?dataInicio=&dataFim=&termo=` | `GantEndpoints` | 409 se não há cache do Gantt para esse período; senão `{ dias, linhas }` já agrupado por `ServicoGant.Montar` — `termo` (opcional) filtra por descrição antes de agrupar |

Os endpoints do **Sprint** (`/api/sprints`, `/api/sprint/categorias`,
`/api/sprint/consultas`, `/api/sprint`) estão na tabela própria de §4.9.

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
  agrupamento fora de `descricao`/`tag`/`ambos` (validado por
  `Agrupamento.EhValido` nos **3** endpoints de parâmetros — `PUT
  /api/configuracao`, `PUT /api/gant/parametros` e `PUT /api/sprint/categorias`;
  desde 2026-09-07 o do Gantt também valida, antes não — ver §4.6), datas não
  parseáveis, `fim < inicio` (ambos via `ValidacaoDatas.Tenta`), nome de
  usuário vazio, nenhum usuário cadastrado ao consultar/relatar/buscar, token
  que não valida (sem `ignorarValidacao`), termo de busca vazio, `.zip` de
  `POST /api/dados/restaurar` com arquivos dentro de uma pasta em vez de na
  raiz (§4.2, item 23) ou que não é um `.zip` válido.
- **404 Not Found**: usuário (`chave`) não encontrado em `PUT`/`DELETE
  /api/usuarios/{chave}`; arquivo `.ini` inexistente nos endpoints de
  download.
- **409 Conflict**: nome de usuário já em uso (cadastro/edição); `GET
  /api/relatorio`/`GET /api/busca` sem cache correspondente ao período pedido.
- **500** (`Results.Problem`): falha de I/O ao gravar o `.ini`
  (`IOException`/`UnauthorizedAccessException`) — mesmo `try/catch` não-fatal
  do console, mas aqui vira erro de resposta (não há como "avisar e seguir"
  numa requisição síncrona que precisava do resultado salvo); mesmo
  tratamento em `POST /api/dados/restaurar` desde o item 25 (antes subia
  como exceção não tratada).

### 4.5 Limitações conhecidas desta camada

- CORS `AllowAny` — adequado só para uso local; não usar essa configuração se
  a API for exposta além de `localhost`.
- Sem autenticação **se `AUTH:USUARIO`/`AUTH:SENHA` não estiverem
  configurados** (default) — qualquer processo com acesso à rede pode chamar
  a API. Ver §4.8 para ligar a autenticação; os tokens em `dados/*.ini` já
  ficam criptografados em repouso independente disso (ver §2.4).
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
(`TogglUsuarios.ini`, desde 2026-09-07 — antes vivia dentro do
`TogglRelatorioParametros.ini`) e `ServicoConsulta` (reaproveitado sem
alteração — só o caminho do arquivo de cache muda, de
`TogglRelatorioData.ini` para `TogglGantData.ini`).

- **`ConfiguracaoGant`** (`dados/TogglGantParametros.ini`, mesmo formato de
  seção `[Geral]` do `TogglRelatorioParametros.ini`): `DataInicio`, `DataFim`,
  `TagsSelecionadas` (mesmo conceito de `TagsDetalhadas` do relatório — tags
  que ficam detalhadas por descrição, as demais são agregadas por tag) e
  `Agrupamento` (`descricao`/`tag`/`ambos`, mesmos 3 valores do relatório).
  **Desde 2026-09-07** `PUT /api/gant/parametros` valida `Agrupamento` e
  devolve `400 "Agrupamento deve ser 'descricao', 'tag' ou 'ambos'."` como os
  outros 2 endpoints de parâmetros já faziam — era uma inconsistência real
  (o Gantt gravava qualquer string), corrigida na auditoria (item 29).
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

Título do documento OpenAPI (`SwaggerDoc`) é **"Toggl Report API"**
(`opcoes.Title`, `Program.cs`) — alterado de `"TogglReport"` em 2026-09-06,
sem tocar em mais nenhuma configuração do Swagger.

`Program.cs` injeta CSS próprio no Swagger via `SwaggerUIOptions.HeadContent`
(um `<style>` cru, sem precisar de arquivo `.css` separado) e serve uma
imagem (`wwwroot/images/toggl-report.png`, o mesmo ícone do frontend) via
`app.UseStaticFiles()` — a única pasta estática que a API expõe, criada só
para esse propósito. O CSS troca o logo padrão do Swagger pelo ícone do
projeto na topbar e ajusta espaçamentos (`.info`, `.scheme-container`,
`.btn.authorize`).

**Botão "Authorize" (2026-09-06)**: registrado só quando `AUTH:USUARIO`/
`AUTH:SENHA` estão configurados (mesma condição do middleware, checada de
novo em `AddSwaggerGen` antes do `Build()`) — `AddSecurityDefinition("basic",
...)` (`SecuritySchemeType.Http`, `Scheme = "basic"`) e
`AddSecurityRequirement(...)`. A API `Microsoft.OpenApi` 2.x não tem mais a
classe solta `OpenApiReference`/pattern de `Reference` em cima de
`OpenApiSecurityScheme` — o jeito novo é `OpenApiSecuritySchemeReference(id,
documento)`, e `OpenApiSecurityRequirement` é literalmente um
`Dictionary<OpenApiSecuritySchemeReference, List<string>>` (confirmado por
reflexão sobre o pacote instalado, não documentação — mesmo cuidado que essa
versão do `Microsoft.OpenApi` já exigiu antes, ver §4.3). Sem autenticação
configurada, nada disso é registrado — Swagger sem botão "Authorize", como
sempre foi.

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

### 4.8 Autenticação HTTP Basic (opcional)

Adicionada em 2026-09-06 para viabilizar o deploy público no Cloud Run
(`toggl-report-infra/`) sem reabrir a API pra internet sem nenhuma barreira.

- **`Api/Autenticacao/AutenticacaoBasicaMiddleware.cs`**: middleware
  registrado logo após `UseCors`, antes de tudo o mais (Swagger e
  `wwwroot/` inclusos). Lê `AUTH:USUARIO`/`AUTH:SENHA` da configuração (env
  vars `AUTH__USUARIO`/`AUTH__SENHA`) uma vez no startup — **se qualquer um
  dos dois estiver vazio/ausente, o middleware não registra o gate** (API
  fica exatamente como antes, sem fricção no dev local). Quando configurado,
  toda rota exige `Authorization: Basic base64(usuario:senha)` **exceto**:
  `/health` (sempre livre — é o que o `HEALTHCHECK` do Dockerfile e o
  healthcheck do Cloud Run/Cloud Build chamam); `/swagger` (o Swagger em si
  deve ficar navegável sem credencial); e `/images` (só serve
  `wwwroot/images/toggl-report.png`, o ícone usado na própria topbar do
  Swagger — sem função fora dele, então some junto).
- **Sem `WWW-Authenticate` na resposta 401** — de propósito: isso é o que
  dispara o popup nativo do navegador; omitindo o header, o 401 vira só uma
  resposta HTTP comum, que o frontend trata com uma tela de login própria
  em vez do prompt do navegador.
- **Frontend** (`src/features/auth/`): `useAuth.ts` guarda a credencial em
  `sessionStorage` (não `localStorage` — soma até fechar a aba, decisão do
  usuário) via `src/api/http.ts` (`definirCredencial`/`obterCredencial`/
  `limparCredencial`), que já anexa `Authorization: Basic ...` em toda
  chamada quando existe credencial salva. Ao montar, sem credencial salva,
  tenta uma chamada muda (`GET /api/usuarios`) — se a API aceitar (gate
  desligado), pula a tela de login automaticamente; se vier 401, mostra
  `LoginScreen.tsx`. Qualquer 401 subsequente (ex.: credencial revogada em
  produção) limpa a credencial e devolve à tela de login (evento
  `auth:necessaria`, disparado em `http.ts`). Botão "Sair" na `AppBar`
  (`App.tsx`) limpa a credencial manualmente.
- **`LoginScreen.tsx` reaproveita o `AppBar` da aplicação (2026-09-06)**: em
  vez de um cabeçalho próprio, renderiza o mesmo `<AppBar>`/`<Toolbar>` com a
  logo e o título "TOGGL REPORT" (mesma fonte Montserrat Semi-Bold+Light,
  ver §5.5) que `App.tsx` usa — cor de fundo idêntica (vem do
  `MuiAppBar.styleOverrides` global do tema, não de um valor hardcoded na
  tela de login), formulário de usuário/senha centralizado abaixo. O markup
  foi originalmente **copiado** do `AppBar` de `App.tsx`, sem virar componente
  — pedido explícito do usuário para não inventar estilo. **Superado em
  2026-09-07 (item 29)**: com autorização do usuário, o logo + wordmark virou
  `components/MarcaTogglReport.tsx`, agora usado tanto pelo `App.tsx` quanto
  pelo `LoginScreen` (a nota "copiar, não componentizar" não vale mais).
- **Nada disso é Terraform/infra** — `AUTH:USUARIO`/`AUTH:SENHA` são
  configurados como variável de ambiente do serviço Cloud Run
  (`gcloud run services update --set-env-vars=...`), o mesmo mecanismo já
  usado para `VITE_API_URL`/senha do Kestrel — nenhum `.tf` precisa mudar.
- **Em dev no Visual Studio** as três env vars (`AUTH__USUARIO`, `AUTH__SENHA`
  e `CHAVE_CRIPTOGRAFIA`) vão no bloco `environmentVariables` do
  `TogglReport.Api/Properties/launchSettings.json` (Propriedades do projeto →
  Depurar → "Abrir interface do usuário de perfis de inicialização de
  depuração" → Variáveis de ambiente). As três chaves já estão lá **com valor
  vazio** como template — `AUTH__*` vazias = API sem autenticação (padrão),
  `CHAVE_CRIPTOGRAFIA` vazia = chave padrão embutida. `launchSettings.json` é
  versionado: para pôr valores reais sem commitar, use
  `git update-index --skip-worktree <caminho>` ou defina as variáveis no
  ambiente do Windows (o VS herda). Fora de dev, `docker-compose.yml` lê as
  três do `.env` da raiz (gitignored; `.env.example` é o template).

### 4.9 Sprint (`SprintsEndpoints`/`SprintCategoriasEndpoints`/`SprintConsultasEndpoints`/`SprintAcompanhamentoEndpoints`, `TogglReport.Nucleo/Sprint`)

Terceira visualização dos mesmos dados do Toggl (2026-09-07), seguindo o molde
do Gantt em todas as camadas — só na Web API + frontend, sem equivalente no
console. Diferente do relatório e do Gantt, o Sprint tem **gestão** (CRUD de
sprints) além do acompanhamento. Parâmetros e cache são próprios e
independentes dos do relatório/Gantt; o único ponto compartilhado é a lista de
usuários (`TogglUsuarios.ini`, filtrada por `Selecionado` antes de repassar
para `ServicoConsulta`/`ServicoSprint`) e `ServicoConsulta` (reaproveitado sem
alteração — só troca o caminho do cache para `TogglSprintData.ini`).

**Persistência** — todos os arquivos em `dados/`, ao lado do executável, todos
no `.gitignore` (raiz + `toggl-report-back/`) e no `.dockerignore`
(`toggl-report-back/`), ver §8. São arquivos novos, sem migração de nome
antigo. Nenhum precisa de criptografia (não há segredo) **exceto** o cache,
que segue o mesmo núcleo do relatório (`TokenApi` criptografado em repouso):

| Arquivo | Formato | Conteúdo |
|---|---|---|
| `TogglSprints.ini` | seções `[Sprint:<chave>]` (molde `TogglUsuarios.ini`) | `Nome`, `HorasPorDia` (decimal, `InvariantCulture`), `DataInicio`, `DataFim` (ambos `yyyy-MM-dd`). Chave gerada do nome (molde `ServicoUsuarios.GerarChaveUnica`, fallback `"sprint"`). |
| `TogglSprintCategorias.ini` | seção `[Geral]` única (molde `TogglGantParametros.ini`) | `Dev`/`Rev`/`Qa` = listas de tags separadas por vírgula — mapeamento **global** (não por sprint) TAG → categoria. `CarregadorConfiguracaoCategoriasSprintIni.Carregar` **nunca devolve `null`**: se o arquivo ou uma chave falta, cai em `Padrao()` — que **não tem nenhuma TAG default** (`Dev`/`Rev`/`Qa` **vazias**, `TagsDetalhadas` vazia, só `Agrupamento = "ambos"`, o mesmo default do Relatório/Gantt). Sem arquivo, `GET /api/sprint/categorias` devolve `{"dev":[],"rev":[],"qa":[],"agrupamento":"ambos","tagsDetalhadas":[]}` e a etapa "Parâmetros" do frontend obriga o usuário a preencher DEV/REV/QA antes de avançar (§5.1/§5.3). A mesma seção `[Geral]` também guarda `Agrupamento` (`descricao`/`tag`/`ambos`) e `TagsDetalhadas` (lista de tags separada por vírgula) — parâmetros da etapa "Parâmetros" do fluxo Sprint, mesmo par que o Relatório/Gantt. **`ServicoSprint.Montar` consome os dois** (desde 2026-09-07, item 27 "Ajuste posterior 6"): a chave de linha da grid é a descrição normalizada quando "detalhar", ou o nome da tag (`registro.Tags[0]`) quando "agregar", pela mesma regra do `ServicoGant` (`"descricao"` → sempre por descrição; `"tag"` → sempre por tag; `"ambos"` → por descrição só se `Tags[0]` ∈ `TagsDetalhadas`, senão por tag). |
| `TogglSprintData.ini` | mesmo formato de `CacheConsulta`/`UsuarioCacheado` do relatório/Gantt | Cache de consulta dedicado. `CarregadorCacheIni` reaproveitado sem alteração — só o caminho muda. Dado cru; o agrupamento/cálculo sempre roda em runtime. |

O antigo `TogglSprintTarefas.ini` (seções `[Tarefa:<chaveSprint>:<descrição
normalizada>]` com `Prioridade`/`SituacaoDev`/`SituacaoRev`/`SituacaoQa`)
**foi removido** junto com o "manual de tarefas" (item 27, "Ajuste posterior
7"), inclusive as entradas nos `.gitignore`/`.dockerignore` — Prioridade e
Situação não são mais editáveis nem persistidas.

`CaminhosDados` tem 3 métodos do Sprint — `CaminhoSprints`,
`CaminhoCategoriasSprint`, `CaminhoCacheSprint` — todos `Path.Combine` puro
sobre a pasta `dados/`, sem `CaminhoComMigracao` (arquivos novos). O
`CaminhoTarefasSprint` foi removido com o "manual de tarefas".

**Endpoints** — Minimal APIs, um arquivo em `Endpoints/` por grupo com um
`Map*Endpoints(this WebApplication app, ...)` chamado no `Program.cs`; DTOs em
`Dtos/`. Tags Swagger: `Sprints` (o CRUD) e `Sprint` (categorias / consultas /
acompanhamento):

| Método | Rota | Arquivo | Descrição |
|---|---|---|---|
| `GET` | `/api/sprints` | `SprintsEndpoints` | lista `SprintDto` |
| `POST` | `/api/sprints` | `SprintsEndpoints` | `CriarSprintRequest(Nome, HorasPorDia, DataInicio, DataFim)` → 201 / 400 (nome vazio, datas inválidas, `fim < inicio`, `HorasPorDia <= 0`) / 409 (nome em uso) |
| `PUT` | `/api/sprints/{chave}` | `SprintsEndpoints` | `EditarSprintRequest` (campos `null`/vazios = não altera; `HorasPorDia` distingue `null`) → 200 / 404 / 409 / 400 |
| `DELETE` | `/api/sprints/{chave}` | `SprintsEndpoints` | 204 / 404 |
| `GET` | `/api/sprint/categorias` | `SprintCategoriasEndpoints` | `{ dev, rev, qa: string[], agrupamento: string, tagsDetalhadas: string[] }` — sem arquivo/chave, as listas vêm **vazias** e `agrupamento = "ambos"` (`{"dev":[],"rev":[],"qa":[],"agrupamento":"ambos","tagsDetalhadas":[]}`) |
| `PUT` | `/api/sprint/categorias` | `SprintCategoriasEndpoints` | mesmo shape; normaliza `dev`/`rev`/`qa`/`tagsDetalhadas` (trim + `Distinct(OrdinalIgnoreCase)` mantendo a 1ª grafia + descarta vazias); valida `agrupamento` contra `descricao`/`tag`/`ambos` (400 se inválido) → 200 / 400 / 500. `Agrupamento`/`TagsDetalhadas` são consumidos por `ServicoSprint.Montar` na chave de agrupamento da grid (item 27, "Ajuste posterior 6"). |
| `POST` | `/api/sprint/consultas` | `SprintConsultasEndpoints` | `ConsultarRequest(DataInicio, DataFim, ForcarConsultaApi?)` (DTO reaproveitado do relatório) → cache-first via `ServicoConsulta`, grava `TogglSprintData.ini`; filtra `Selecionado`; 400 "Nenhum usuário selecionado..." / 400 datas inválidas |
| `GET` | `/api/sprint?chaveSprint=` | `SprintAcompanhamentoEndpoints` | 400 (chave vazia) / 404 "Sprint não encontrado." / 400 "Nenhum usuário cadastrado." / **409** "Não há consulta salva para esse período. Chame POST /api/sprint/consultas primeiro." (cache ausente ou período ≠ do sprint) / senão o `ResultadoSprint` do núcleo, serializado direto (como `GET /api/gant`) |

`MapSprintAcompanhamentoEndpoints` mapeia só o `GET` — o antigo
`PUT /api/sprint/tarefas` (campos manuais por tarefa) e seu parâmetro
`caminhoTarefasSprint` foram removidos com o "manual de tarefas" (item 27,
"Ajuste posterior 7"). Também saíram os DTOs `AtualizarTarefaSprintRequest` e o
record `TarefaManualSprint`.

**Cálculo de capacidade** (`ServicoSprint.Montar`, validado com o usuário por `curl`):

```
diasUteis   = dias em [DataInicio, DataFim] inclusive, excluindo sábado e domingo (molde ServicoGant)
tempoTotal  = sprint.HorasPorDia * diasUteis           (decimal)
margem      = (int)Math.Floor(0.30m * tempoTotal)      (int)
tdPorColab  = (int)Math.Floor(tempoTotal - margem)     (int — "TD", tempo disponível por colaborador)
ct          = tdPorColab * (nº de colaboradores selecionados)   (int — "CT", capacidade total)
```

Exemplo conferido: `HorasPorDia = 7`, período `2026-09-01`→`2026-09-24` →
`diasUteis = 18`, `tempoTotal = 126`, `margem = floor(37,8) = 37`,
`td = floor(89) = 89`, `ct` (1 colaborador) `= 89`. **A fórmula é
`margem = 30% do total` (floor) e `TD = total − margem`** — a descrição
original do pedido falava em "70% do total" e "70% de 70%", mas isso **não**
se aplica.

**Tela de acompanhamento** (`GET /api/sprint`, montada por `ServicoSprint.Montar`,
que devolve o `ResultadoSprint` — `Cabecalho` + `Linhas` (tarefas) +
`Colaboradores`):

> As cores de status do Sprint são hex fixos **definidos uma vez** no topo de
> `SprintView.tsx` — não são tokens do tema (o `success` do tema é dourado):
> `const COR_PENDENTE = '#EA4335'` (vermelho), `const COR_CONCLUIDO = '#34A853'`
> (verde) e `const COR_TAG = '#F57C00'` (laranja, usada nas linhas de
> agrupamento por tag). Usadas no card, na coluna "Disponível" negativa, nas
> colunas Pendentes/Concluídas da tabela de colaboradores, nas etiquetas
> fixas de Prioridade/Situação do grid (`EtiquetaFixa`) e no badge de
> Prioridade (`BadgeTexto`). Não repetir o hex solto em nenhum outro lugar.
> Ao lado dessas consts há também `const LARGURA_CELULA = '2.5rem'` — a
> largura comum das colunas PRE, REA e badge de cada grupo DEV/REV/QA.

- **Card do sprint** (`CabecalhoSprint`): Sprint ·
  Horas/dia · Dias úteis · Margem, mais **`Início`** e **`Fim`** como campos
  separados; tudo numa **linha única** (`flexWrap: nowrap` + `overflowX: auto`).
  Desde 2026-09-07 ("Ajuste posterior 11") os campos de texto do resumo
  (`ParInfo`: Sprint, Horas/dia, Dias úteis, Margem, Início, Fim) têm o **valor**
  em `<Typography variant="h6" color="primary.main">` — fonte maior + a mesma
  cor azul da "Capacidade" —, alinhado ao centro da barra, visualmente próximo
  dos totalizadores. Os **totalizadores** (Pendentes/Concluído/Capacidade)
  **não mudaram**.
  À direita, três blocos de destaque diferenciados por cor — **Pendentes**
  (vermelho `COR_PENDENTE`), **Concluído** (verde `COR_CONCLUIDO`) e
  **Capacidade** (`primary.main`, `cabecalho.ct`, exibido como `${ct} h`). O
  record tem `int Ct` e, **após ele, `int Td`** (o TD por colaborador, que
  antes só aparecia em cada `LinhaColaboradorSprint`) — usado pelo modal
  "Informações" (abaixo). `int TarefasConcluidas` **agora é sempre 0** (não há
  mais situação); `int TarefasPendentes` = **nº de descrições distintas** no
  grid. A fórmula de capacidade (`margem`/`TD`/`CT`) **não mudou**.
- **Card de colaboradores** (`List<LinhaColaboradorSprint> Colaboradores`,
  entre o card do sprint e o grid; no frontend só renderizado se houver ≥ 1) —
  **mantido como estava**. `record LinhaColaboradorSprint(string NomeExibicao,
  string Sigla, string Cor, int Td, long SegundosRealizados,
  int TarefasPendentes, int TarefasConcluidas)` — **inalterado**, mas
  `TarefasConcluidas` **agora é sempre 0** (situação fixa "por enquanto"), então
  a coluna "Concluídas" e o destaque verde ficam sempre zerados.
  - **`Td`** = `tdPorColaborador` — o mesmo para todos.
  - **`SegundosRealizados`** = soma de `Duracao` (só `>= 0`) de **todos** os
    apontamentos daquele usuário no cache do sprint.
  - Frontend: `<Table size="small">` com `<TableFooter>`, colunas **Colab.
    (nome completo) · (sigla, `BadgeSigla`) · Tempo por colaborador (`${td} h`,
    ex-"Total") · Realizado (`formatarDuracao`) · Disponível (Tempo por
    colaborador − Realizado, derivada no front; quando **> 0** texto **verde
    `COR_CONCLUIDO`** + bold — mesmo tom de "Concluídas" —, **< 0** vermelho
    `COR_PENDENTE` + bold com `-`, `0` neutro) · Pendentes · Concluídas**;
    rodapé soma só Pendentes e
    Concluídas; sem colunas por dia. A 2ª coluna usa o **mesmo componente
    `BadgeSigla`** que o grid de tarefas (extraído, não duplicado — ver
    abaixo).
- **Grid de tarefas** (`List<LinhaTarefaSprint> Linhas`) — **uma linha por
  (tarefa × colaborador)**, montada por `ServicoSprint.Montar` (sem parâmetro
  `manuais`).
  `record LinhaTarefaSprint(string Codigo, string Descricao, string
  NomeExibicao, string Sigla, string Cor, bool Agrupada,
  BlocoCategoriaSprint Dev, BlocoCategoriaSprint Rev, BlocoCategoriaSprint Qa)`;
  `record BlocoCategoriaSprint(decimal PreHoras, long ReaSegundos)`.
  `ServicoSprint.ChaveAgrupamento(registro, categorias)` devolve
  `(string Chave, bool Agrupada)`.
  - **Linha de descrição** (`Agrupada == false`): uma por `(descrição
    normalizada "TEL" × colaborador)`. `Codigo`/`Descricao` vêm de
    `SepararCodigo` — regex `^(TEL - \d+)(?: - (.+))?$` → `Codigo = "TEL - 0000"`,
    `Descricao` = o resto; **sem casar** → `Codigo = ""`, `Descricao` = o texto
    inteiro. O `ReaSegundos` de cada grupo DEV/REV/QA = tempo **desse
    colaborador** nessa descrição cujas tags ∈ `categorias.Dev`/`Rev`/`Qa`
    (`OrdinalIgnoreCase`; tag em mais de uma lista conta em cada).
  - **Linha tag-agg** (`Agrupada == true`, só quando `agrupamento` = `tag` ou
    `ambos` e a tag não está em `TagsDetalhadas`): uma por `(tag ×
    colaborador)`. `Codigo = ""`, `Descricao` = nome da tag. **Todo** o tempo
    do colaborador naquela tag vai para **um único** grupo: **QA** se esse
    colaborador tem ≥ 1 apontamento no sprint com tag ∈ `categorias.Qa`
    (pré-passo `colaboradoresComQa`), senão **DEV**. **REV nunca recebe
    tag-agg.**
  - **Ordenação** (por **número do código**, não string — antes era bug:
    `TEL - 1118` vinha antes de `TEL - 994`): linhas de descrição primeiro (as
    com `Codigo` antes das sem; depois por `NumeroCodigo(Codigo)` crescente —
    helper que extrai só os dígitos de `Codigo` —, depois desempate por
    `Codigo`/`Descricao` string), então as tag-agg (pela ordem do colaborador
    em `usuariosSelecionados`, depois por `Descricao`). Resultado:
    `TEL - 994 → TEL - 1000 → TEL - 1118`.
  - Timers em andamento (`Duracao < 0`) ignorados. Cálculo de capacidade
    (`margem`/`td`/`ct`) **intacto**.
  - **Frontend** (`SprintView.tsx`, dentro de um `TableContainer` de rolagem
    horizontal): 1ª coluna de **checkbox** (sem título), depois cabeçalho
    **Prioridade · Situação · Código · Descrição** + grupos **DEV / REV / QA**
    (cada grupo: **PRE · REA · (badge) · Sit.**). **A linha 1 do cabeçalho dos
    grupos** (o `<TableCell colSpan={4}>` de cada grupo) mostra o nome por
    extenso — **Desenvolvimento / Revisão / Qualidade** (`GRUPOS[].nomeLongo`);
    a **linha 2** (sub-título da coluna de badge) e as **células de dados**
    (badge de sigla do colaborador) seguem com **DEV / REV / QA** / a sigla.
    As células de cabeçalho **Prioridade · Situação · Código · Descrição** (com
    `rowSpan={2}`) usam `verticalAlign: 'bottom'` — os títulos ficam colados na
    parte de baixo da célula, junto dos dados. **O bloco esquerdo —
    Checkbox · Prioridade · Situação · Código · Descrição — não tem nenhuma
    divisória vertical entre suas colunas**: a 1ª divisória da grid aparece só
    na fronteira **Descrição → DEV**; as bordas entre e dentro dos grupos
    DEV/REV/QA (PRE · REA · badge · Sit.) continuam. Implementado com
    `& tbody td:nth-of-type(-n+5)` / `& thead tr:first-of-type th:nth-of-type(-n+5)`
    zerando o `borderRight` no `sx` do `<Table>` (o resto usa o token `divider`,
    adapta a tema claro/escuro). **Colunas compactadas**: Prioridade, Situação,
    Código, o checkbox e a coluna "Sit." de cada grupo usam `width: '1%'` +
    `whiteSpace: nowrap` + padding menor; PRE, REA e o badge de cada grupo
    ficam na largura fixa `LARGURA_CELULA` (`'2.5rem'`) — só "Descrição" absorve
    o espaço restante (`maxWidth: 360`, com elipse + `Tooltip`); o **padding
    horizontal da coluna "Descrição"** foi igualado ao das demais (`px: 0.5`,
    "Ajuste posterior 11"). **Linhas mais baixas**:
    padding vertical reduzido nas células da grid (`py: 0`), `Checkbox` com
    `p: 0.25`, badges com `py: 0.1`. **Conteúdo centralizado** (`align="center"`)
    em: **Situação** (a geral e as 3 "Sit." de cada grupo), **PRE**, **REA** e
    as 3 colunas de badge (DEV/REV/QA).
    - **Checkbox + tachado persistente** (1ª coluna, antes de Prioridade):
      marcar risca a **descrição** da linha (`line-through` + `color:
      text.disabled`). O conjunto de linhas marcadas é persistido em
      `localStorage` (chave `sprint-tachados-<chaveSprint>`, id da linha =
      `codigo∙descricao∙nomeExibicao`, montado por `idLinhaTarefa`) e
      sobrevive a fechar a janela. **A marcação é isolada por sprint**: a
      chave inclui `chaveSprint` (o identificador único de `[Sprint:<chave>]`
      de `TogglSprints.ini`), então cada sprint tem seu próprio conjunto de
      linhas riscadas e trocar de sprint no passo "Sprints" troca a chave —
      sem mistura. **Reset**: a marcação só é apagada quando
      uma **nova consulta real à API do Toggl** é feita — `App.tsx` chama
      `limparTachados(chaveSprint)` no `onConcluida` do `ConsultaPanel` do
      Sprint quando `resposta.veioDoCache === false`; carregar do cache local
      **não** limpa. Módulo novo `src/features/sprint/tachados.ts`
      (`lerTachados`/`gravarTachados`/`limparTachados`/`idLinhaTarefa`, tudo
      em `try/catch`) — o **único** uso de `localStorage` no projeto.
    - **Prioridade** virou um **badge** (`BadgeTexto`, componente local novo —
      mesmo visual do `BadgeSigla`: `borderRadius: 0`, Montserrat, uppercase),
      **centralizado**. Linha normal: fundo **verde `#34A853`**
      (`COR_CONCLUIDO`), texto **preto**, **"Baixa"**. Linha tag-agg
      (`linha.agrupada`): fundo **laranja `#F57C00`** (`COR_TAG`), texto
      preto, **"Tag"**.
    - **Situação** (geral e por grupo, via `EtiquetaFixa` — texto bold
      colorido, **centralizada**): a Situação geral da linha normal =
      **"Pendente"** em vermelho `#EA4335` (`COR_PENDENTE`); da linha tag-agg
      = **"Tag"** em laranja `#F57C00` (`COR_TAG`). **A regra "–" / "Nenhuma"
      vale para qualquer linha** (descrição ou tag-agg): em todo grupo
      DEV/REV/QA **sem tempo do colaborador** (`reaSegundos === 0`) → **"–"**
      no badge e **"Nenhuma"** na Situação do grupo, ambos em **preto**
      (`text.primary`), e PRE/REA ficam **"00h"**. Nos grupos **com tempo**
      (`reaSegundos > 0`): badge de sigla + Situação **"Pendente"** (linha
      normal) ou **"Tag"** laranja (linha tag-agg). Nada é editável nem
      persistido ("sem integração por enquanto").
    - **Código / Descrição**: colunas **separadas** (a antiga coluna
      "Descrição" única foi partida). Coluna **Código centralizada** e com
      **zero-padding dinâmico**: cada número é preenchido com zeros à esquerda
      até o número de dígitos do **maior código presente na listagem daquele
      sprint** — calculado em runtime a partir de `resultado.tarefas` (não é
      fixo). Ex.: maior código `TEL - 1118` → `TEL - 0994`, `TEL - 1000`,
      `TEL - 1118`. Linhas sem código continuam **`"—"`**. Helpers novos
      `contarDigitos` / `formatarCodigo` + `larguraCodigo` (reduce sobre
      `tarefas`). **Não há coluna "Tag"** — nas linhas tag-agg o nome da tag
      aparece na própria "Descrição", com "Código" vazio.
    - **PRE / REA** por grupo: mesma **largura da coluna de badge**
      (`LARGURA_CELULA = '2.5rem'`), conteúdo **centralizado**. Exibem a hora
      no formato **`00h`** (2 dígitos com `padStart`, sem "m"/"s"), com
      **`<Tooltip>`** mostrando o `formatarDuracao` completo (`00h00m00s`).
      O cabeçalho de **PRE** e **REA** tem `<Tooltip>` de título — "Tempo
      previsto" em PRE, "Tempo realizado" em REA (mesmo `<Tooltip>` do MUI já
      usado no resto). **PRE é sempre `00h`** (sem integração de tempo
      previsto). Quando `bloco.reaSegundos > 0`, o valor da coluna **REA** fica
      na cor **`primary.main`** (o **mesmo token** do destaque "Capacidade" no
      card do sprint — `#5B82F6`) + `fontWeight: 600`; REA zero fica na cor
      padrão.
    - **badge** (coluna sem título de cada grupo, **centralizada**): componente
      **`BadgeSigla`** — a sigla do colaborador da linha, fundo na **cor dele**,
      cantos retos (`borderRadius: 0`, Montserrat, uppercase), `Tooltip` com o
      nome. Só aparece no(s) grupo(s) com `reaSegundos > 0`; nos grupos sem
      tempo aparece **"–"** em preto. É o **mesmo componente** usado na coluna
      de sigla do card de colaboradores.
- **Busca por descrição** ("Ajuste posterior 11", 2026-09-07): botão **"Buscar
  por descrição"** no topo do acompanhamento, **antes** do "Informações" (mesmo
  estilo do botão de busca do Gantt); ao abrir, mostra um `<TextField>`
  "Filtrar por código ou descrição" logo abaixo do header. É **filtro local,
  client-side** sobre a lista já carregada — casa pelas colunas **Código e
  Descrição**, **sem nova consulta à API** e **sem trocar de view** (diferente
  do Relatório, que abre `BuscaPanel`, e do Gantt, que reconsulta
  `GET /api/gant?termo=`). Só a **grid de tarefas** é filtrada — card do sprint
  e card de colaboradores não. Sem correspondência →
  `<Alert severity="info">Nenhuma linha corresponde ao filtro.</Alert>`.
- **Botão "Informações"** (antes do "Voltar", no header do acompanhamento) →
  `<Dialog>` **"Como este sprint é calculado"** com os **números reais deste
  sprint** (Tempo Total = Horas/dia × Dias úteis; Margem = `floor(30% × Tempo
  Total)`; **Tempo por colaborador** = Tempo Total − Margem; **Capacidade** =
  Tempo por colaborador × nº de colaboradores — os rótulos "TD"/"CT" não
  aparecem mais), as **categorias** configuradas (DEV/REV/QA + Agrupamento) e
  o texto das **regras**: uma linha por tarefa × colaborador; agrupamento por
  descrição vs. por tag (tag-agg roteada para QA ou DEV por colaborador, REV
  nunca); **em qualquer linha, um grupo (DEV/REV/QA) sem tempo do colaborador
  aparece com "–" no badge e "Nenhuma" na situação, e PRE/REA ficam "00h"**;
  o item de **PRE / REA** explica os `<Tooltip>` de título ("Tempo previsto" /
  "Tempo realizado") e de valor (`00h00m00s` completo), que **PRE = 0** sem
  integração, e que **um REA maior que zero fica na cor da Capacidade**
  (`primary.main`); item novo sobre o **zero-padding dinâmico do código**
  (zeros à esquerda até o nº de dígitos do maior código da listagem);
  Situação/Prioridade fixas ("Baixa"/"Pendente" nas
  normais, "Tag" laranja nas de agrupamento por tag); a caixa de seleção risca
  a descrição e fica salva no navegador (`localStorage`) **isolada por sprint**,
  até nova consulta real à API; item novo sobre a **busca local** (filtra a
  lista já carregada por Código/Descrição, sem nova consulta à API); dias úteis
  sem fim de semana. `SprintView`
  recebe a prop `categorias?: CategoriasSprint | null` (de `parametrosSprint`
  no `App.tsx`).

> **Melhoria futura (não implementada)**: a planilha de referência tem também
> um gráfico de pizza (Concluído/Pendente) e um gráfico de barras por
> colaborador — não foram feitos nesta rodada.

---

## 5. Frontend (`toggl-report-front`)

### 5.1 Visão geral

React 19 + TypeScript + MUI 9, via Vite. Consome a Web API — por padrão em
`http://localhost:5180`, configurável via a variável de ambiente `VITE_API_URL`
(ver §5.3) — replicando o fluxo do console: parâmetros → consulta → relatório → busca por
descrição — mais fluxos equivalentes para o Gantt e para o Sprint. Navegação
por `Tabs`: **"Usuários"** (aba fixa, selecionada por padrão na abertura — sem
usuário cadastrado, os outros fluxos ficam bloqueados), **"Relatório"**,
**"Gant"** e **"Sprint"**, cada um dos três últimos com seu próprio `Stepper`
de 3 passos (Parâmetros → Consultar → Relatório/Gant; no Sprint são **4
passos**, **Sprints → Parâmetros → Consultar → Acompanhamento**: o passo
"Sprints" é um CRUD + seleção de 1 sprint e "Parâmetros" (antes "Categorias")
traz a seleção de tags para detalhar por descrição + o agrupamento (mesmo
padrão do Relatório/Gantt), além do mapeamento DEV/REV/QA numa etapa própria
— ver §4.9). O passo "Parâmetros" do Sprint tem rodapé "Voltar" / "Continuar"
(`outlined` — só avança) / "Salvar e continuar" (`contained` — `PUT
/api/sprint/categorias` e avança), molde de `ParametrosForm`/`ParametrosGantForm`
do Relatório/Gantt (mensagem de sucesso "Parâmetros salvos."); "Continuar" e
"Salvar e continuar" ficam **desabilitados** enquanto qualquer uma das 3
categorias (DEV, REV, QA) estiver sem nenhuma TAG (um `Alert` "info" pede o
preenchimento das 3 enquanto incompleto), além de `carregando`/sem usuário
cadastrado. O passo "Usuários" que
existia antes dentro de cada Stepper foi removido quando virou aba própria.
O passo "Acompanhamento" do Sprint mostra o card do sprint (em linha única,
com **Pendentes**, **Concluído** e **Capacidade** em destaque), um card de
**colaboradores** (nome completo · sigla colorida · Total · Realizado ·
Disponível · Pendentes · Concluídas, com rodapé de totais) e um **grid com
uma linha por (tarefa × colaborador)** — colunas **Prioridade · Situação ·
Código · Descrição** + grupos DEV/REV/QA (`PRE · REA · badge de sigla · Sit.`).
Prioridade ("Baixa") e Situação ("Pendente") são **valores fixos coloridos**,
sem edição. Um botão **"Buscar por descrição"** no header abre um filtro local
(client-side, por Código + Descrição, sem consulta à API e sem trocar de view —
só a grid é filtrada), e um botão **"Informações"** abre um modal com os
cálculos do sprint. Ver §4.9/§5.3.

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
 │   ├─ sprintsApi.ts (CRUD), categoriasSprintApi.ts, sprintApi.ts (consultarSprint + obterSprint)
 ├─ features/
 │   ├─ configuracao/       # ParametrosForm.tsx + useConfiguracao.ts
 │   ├─ usuarios/           # UsuariosPanel.tsx (aba fixa, sem onVoltar/onContinuar quando avulsa), UsuarioFormDialog.tsx + useUsuarios.ts
 │   ├─ consulta/           # ConsultaPanel.tsx (compartilhado por relatório, Gantt e Sprint, recebe resultado/consultando/executar como props; props opcionais agrupamento?/tagsDetalhadas?/categorias? — categorias? = { dev, rev, qa } só o Sprint passa, exibe "DEV/REV/QA" na tela) + useConsulta.ts
 │   ├─ relatorio/          # RelatorioView.tsx, RelatorioUsuarioCard.tsx (Accordion por usuário → <Table> única no corpo: colunas [checkbox] · Tag · Descrição · Tempo, linhas "por descrição" e depois "por tag" concatenadas, sem títulos de seção, célula vazia sem placeholder; "Em andamento" num bloco à parte), curadoria.ts (curarPorDescricao → { chave, descricao, tag, segundos }) + useRelatorio.ts
 │   ├─ busca/              # BuscaPanel.tsx + useBusca.ts (busca do relatório — layout de lista)
 │   ├─ gant/               # ParametrosGantForm.tsx, GantView.tsx (tabela própria, com busca embutida; linhas compactas, descrição truncada em 50 chars + Tooltip) + useParametrosGant.ts/useConsultaGant.ts/useGant.ts
 │   ├─ sprint/             # SprintsPanel.tsx (listagem + seleção de 1 sprint — passo 1 do Stepper), SprintFormDialog.tsx (cadastro/edição em modal, molde UsuarioFormDialog), CategoriasSprintPanel.tsx (etapa "Parâmetros" — passo 2 do Stepper: agrupamento + tags para detalhar por descrição (padrão de ParametrosForm/ParametrosGantForm) + 3 Autocomplete DEV/REV/QA, rodapé Voltar / Continuar / Salvar e continuar — os dois de avanço bloqueados até DEV+REV+QA terem TAG), SprintView.tsx (acompanhamento — card do sprint em linha única com destaques Pendentes/Concluído/Capacidade, card de colaboradores (nome completo · BadgeSigla · Tempo por colaborador · Realizado · Disponível · Pendentes · Concluídas + rodapé de somas), grid com uma linha por (tarefa × colaborador), rolagem horizontal, linhas divisórias entre todas as colunas + colunas compactadas (Descrição absorve o resto), 1ª coluna de checkbox que risca a descrição e persiste em localStorage (via tachados.ts), colunas Prioridade (badge BadgeTexto verde "Baixa" / laranja "Tag") · Situação (EtiquetaFixa; "Pendente" / "Tag" laranja / "–"/"Nenhuma" nos grupos vazios) · Código · Descrição + grupos DEV/REV/QA (PRE/REA hora resumida + Tooltip, BadgeSigla), botão "Buscar por descrição" (filtro local client-side por Código+Descrição, só a grid, sem consulta/sem view nova) antes do botão "Informações" → modal de cálculo; BadgeSigla, BadgeTexto e EtiquetaFixa são componentes locais reusados; padding da coluna Descrição igualado (px: 0.5), campos do card em h6/primary.main, "Disponível" verde quando > 0), tachados.ts (lerTachados/gravarTachados/limparTachados/idLinhaTarefa — único uso de localStorage no projeto, tudo em try/catch) + useSprints.ts/useCategoriasSprint.ts/useConsultaSprint.ts/useSprint.ts
 │   └─ dados/              # RodapeDownloads.tsx (download único da pasta dados/ compactada + versão do app), ImportarDadosDialog.tsx (upload do .zip quando não há usuário cadastrado)
 ├─ components/              # peças reutilizáveis entre features — as marcadas (2026-09-07) saíram de views por extração na auditoria (item 29)
 │   ├─ BotaoComCarregamento.tsx
 │   ├─ DialogoConfirmacao.tsx  # Dialog genérico (confirmação com Cancelar, ou só informativo com OK) — reaproveitado pela exclusão de usuário
 │   ├─ AvisoCache.tsx          # (2026-09-07) <Alert icon={CloudDoneIcon}>Resultado servido do cache local…</Alert> — era verbatim em RelatorioView/GantView/SprintView
 │   ├─ EsqueletoCarregando.tsx # (2026-09-07) <Stack> com 2 <Skeleton height={56}/> — idem 3 views
 │   ├─ CreditoApp.tsx          # (2026-09-07) linha "Toggl Report – Por Gleryston Matos – v{versão}" (prop sx?; RodapeDownloads passa {fontWeight:700}, LoginScreen {textAlign:'center'})
 │   ├─ MarcaTogglReport.tsx    # (2026-09-07) logo + wordmark "TOGGL REPORT" (props corTexto?/sxImagem?/sxTitulo?) — extração autorizada nesta rodada (antes o §4.8/item 21 registrava "copiar markup, não criar componente")
 │   ├─ BadgeSigla.tsx          # (2026-09-07) badge quadrado de sigla (prop sx?) — era local não-exportado do SprintView; usado no SprintView (grid + card) e no GantView (o <Chip> de UsuariosPanel NÃO foi tocado)
 │   ├─ CabecalhoView.tsx       # (2026-09-07) linha de cabeçalho de view (titulo + children de ações) — RelatorioView/GantView/SprintView/SprintsPanel/UsuariosPanel
 │   ├─ CampoTags.tsx           # (2026-09-07) <Autocomplete multiple freeSolo autoSelect options={[]}> — 3 telas de parâmetros + os 3 campos DEV/REV/QA do Sprint
 │   ├─ SelectAgrupamento.tsx   # (2026-09-07) <TextField select label="Agrupamento"> sobre OPCOES_AGRUPAMENTO (utils/rotulos.ts)
 │   └─ ParametrosFormBase.tsx  # (2026-09-07) corpo compartilhado do form de Parâmetros (estado local, validação de período, effect de carga, rodapé Voltar/Continuar/Salvar); ParametrosForm e ParametrosGantForm viraram wrappers ~45 linhas que mapeiam tagsDetalhadas ⇄ tagsSelecionadas
 ├─ hooks/
 │   ├─ useNotificacao.tsx      # snackbar/contexto global para erros de API
 │   ├─ useExpansao.ts          # (2026-09-07) useExpansao(chaves, gatilhoReset?) → { expandido, alternarUm, alternarTodos, todosExpandidos }; recolapsa quando gatilhoReset (o objeto relatorio/gant) ou o conjunto de chaves muda — RelatorioView/GantView
 │   ├─ useRecurso.ts           # (2026-09-07) useRecurso(fn) → { dados, carregando, carregar }; useRelatorio/useGant/useSprint são wrappers (useBusca NÃO — nomes de campo diferentes + limpar extra)
 │   ├─ useRecursoEditavel.ts   # (2026-09-07) useRecursoEditavel(obter, atualizar) → { dados, carregando, salvando, carregar, salvar }; useConfiguracao/useParametrosGant/useCategoriasSprint são wrappers
 │   └─ useColecaoCrud.ts       # (2026-09-07) useColecaoCrud<T extends {chave}>({listar,criar,editar,remover}) → { itens, carregando, carregar, criar, editar, remover }; useUsuarios (que ainda adiciona validar) e useSprints são wrappers
 ├─ utils/duracao.ts         # formata segundos como HHhMMmSSs
 ├─ utils/datas.ts           # ISO, "últimos 30 dias" default, "iniciado às..." em horário local, formatarDiaCurto (2026-09-07 — era local em GantView)
 ├─ utils/rotulos.ts         # OPCOES_AGRUPAMENTO + rotularAgrupamento
 ├─ utils/texto.ts           # (2026-09-07) truncar(texto, limite) — era local em GantView
 ├─ utils/tipografia.ts      # (2026-09-07) FONTE_MARCA = '"Montserrat", sans-serif' — era literal em 9 lugares
 ├─ features/consulta/useConsultaGenerica.ts  # (2026-09-07) useConsultaGenerica(fn) → { resultado, consultando, executar }; useConsulta/useConsultaGant/useConsultaSprint são one-liners
 ├─ features/sprint/calculos.ts               # (2026-09-07) formatarHoraResumida / contarDigitos / formatarCodigo / formatarDisponivel — eram locais no SprintView
 ├─ theme.ts                 # tema MUI único (claro) — CORES agora exportado (era const privado) — ver §5.5
 └─ App.tsx                  # Tabs "Usuários" (padrão)/"Relatório"/"Gant"/"Sprint"; Relatório e Gant com Stepper de 3 passos, Sprint com Stepper de 4 passos. Modo = 'usuarios'|'relatorio'|'gant'|'sprint'; ETAPAS_SPRINT = ['Sprints','Parâmetros','Consultar','Acompanhamento']; estados etapaSprintAtiva/sprintSelecionado/consultaSprintConcluida/etapaSprintLiberada + parametrosSprint (config { dev, rev, qa, agrupamento, tagsDetalhadas } elevada de CategoriasSprintPanel via onAvancar, junto de configuracao/configuracaoGant; passos 2/3 do Stepper do Sprint só liberam com parametrosSprint !== null; também passado como prop categorias para o ConsultaPanel e o SprintView do Sprint; o onConcluida do ConsultaPanel do Sprint chama limparTachados(sprintSelecionado.chave) quando resposta.veioDoCache === false)
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
  (`features/relatorio/curadoria.ts`) aplica a mesma **ordenação** do console
  (TEL primeiro, depois por segundos decrescente) só para exibição, sem alterar
  os dados recebidos — simetria deliberada com a separação `ServicoAgrupamento`
  (dado) / `EscritorRelatorioConsole` (exibição) do back-end. **Desde
  2026-09-07** (item 28) `curarPorDescricao` devolve
  `{ chave, descricao, tag, segundos }` (era `{ chave, texto, segundos }`): a
  descrição vai **crua** (sem o antigo prefixo `(tag) …` nas linhas não-TEL) e
  a tag numa **coluna própria** na view. O **console mantém** o prefixo
  `(tag) descrição` em "Por descrição" (`EscritorRelatorioConsole`, §2.4) — a
  mudança foi só no frontend.
- **`RelatorioUsuarioCard` — tabela real** (2026-09-07, item 28 + refinamento):
  cada usuário continua num `<Accordion>` (nome em `color: 'primary.main'` —
  mesmo token do `<Chip color="primary">` de "Total: …" — + Chip do total no
  `AccordionSummary`), mas o conteúdo (`AccordionDetails`) deixou de ser
  `<List>`/linha corrida e virou **uma `<Table size="small">` única** (estilo
  compacto do Sprint/Gantt, `py: 0`), **sem os títulos de seção "Por
  descrição" / "Por tag"** e sem `<Divider>` entre elas. Colunas fixas:
  **`[checkbox] · Tag · Descrição · Tempo`**. Linhas: primeiro as agregadas
  **por descrição** (Tag + Descrição + Tempo), depois as **por tag** (Tag +
  **Descrição vazia** + Tempo) — as duas listas concatenadas numa tabela só
  (`agrupamento` decide quais aparecem, como antes). **Sem placeholder**:
  célula sem valor fica **vazia** (o antigo `"—"` da coluna Tag saiu).
  **"Em andamento"** continua num bloco pequeno abaixo da tabela (timers em
  execução — formato distinto, sem total; mantém o rótulo). `curadoria.ts`
  (`curarPorDescricao`) e a ordenação/agrupamento **não mudaram**; `selecionados`
  (tachado) preservado. **Não há botão "Informações" no Relatório** (só no
  Sprint).
- **`GantView` — compactação e truncamento** (2026-09-07, item 28): linhas mais
  compactas (`py` reduzido no head e a `0` nas células de dados e no cabeçalho
  de usuário); descrição **truncada em 50 caracteres** (helper `truncar()`, "…"
  ao exceder) com um `<Tooltip>` **sempre presente** mostrando a descrição
  completa. Só apresentação — agrupamento/colunas/cores/busca intactos.
- **Zero `any`** (confirmado por grep): tipos explícitos em `src/api/tipos.ts`
  para todo request/response; sem `enum` do TypeScript
  (`erasableSyntaxOnly` ativo no `tsconfig.app.json` gerado pelo template) —
  `StatusConsultaUsuario` é uma union de strings literais.
  `RegistroTempoBruto` documenta explicitamente por que seus campos são
  snake_case (comentário no próprio arquivo — uma das poucas exceções à regra
  de "nomes em vez de comentário", porque aqui o "porquê" não é dedutível só
  pelo nome dos campos).
- **`ImportarDadosDialog` (2026-09-06) fecha a ponta que faltava no frontend
  para `POST /api/dados/restaurar`** — o endpoint já existia (§4.2), só não
  tinha UI. `App.tsx` dispara o diálogo **uma única vez por sessão**, num
  `useEffect` gated por `verificacaoInicialFeita`, quando a primeira
  checagem de `GET /api/usuarios` (já feita para o aviso "nenhum usuário
  cadastrado") vem vazia — não reabre depois se o usuário excluir todos os
  usuários manualmente, mesmo espírito do
  `OfereceRestaurarBackupSeNecessario` do console (§2.2), que também só
  verifica uma vez, antes do laço principal. Duas opções: escolher um `.zip`
  e importar, ou "Seguir sem importar" (fecha e segue pelo cadastro manual
  já existente). Upload via `http.postArquivo` (novo método em
  `src/api/http.ts`, `dadosApi.ts` → `restaurarDados`) — `FormData` +
  `fetch` próprio, porque o resto do wrapper (`http.get/post/put/delete`)
  sempre serializa o corpo como JSON; mesma lógica de credencial/401 dos
  demais métodos.
- **`RodapeDownloads` baixa via `fetch` autenticado + blob, não `<a href>` direto (2026-09-07)**:
  um link simples navegando para `/api/dados/download` nunca carrega a
  credencial — o app deliberadamente não usa cookie/sessão nem deixa o
  navegador cachear Basic Auth (não manda `WWW-Authenticate`, §4.8), então só
  o `fetch` da própria SPA sabe anexar `Authorization`. `http.getArquivo`
  (novo em `src/api/http.ts`) baixa como `Blob`, lê o nome do arquivo do
  `Content-Disposition`, e `dadosApi.baixarDados` cria um `<a>` temporário
  com `URL.createObjectURL` para disparar o download do lado do cliente —
  mesmo resultado de UX de um link normal, mas com a credencial correta.
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
- **`features/sprint/` segue o molde do Gantt** (hooks
  `useSprints`/`useCategoriasSprint`/`useConsultaSprint`/`useSprint`,
  `ConsultaPanel` compartilhado). Diferenças próprias: o CRUD segue o mesmo
  padrão do de usuários — `SprintsPanel` fica com a listagem + seleção +
  botões "Adicionar"/editar/excluir, e o cadastro/edição vai para o modal
  `SprintFormDialog` (molde `UsuarioFormDialog`: `useEffect` repopula os
  campos ao abrir/trocar alvo, `onSalvo` recarrega a lista e o próprio
  diálogo se fecha no sucesso). `SprintsPanel` usa `Radio`/linha clicável
  para selecionar 1 sprint, exclusão via `DialogoConfirmacao`, mensagens via
  `useNotificacao`; o botão "Continuar"
  fica `disabled` sem sprint selecionado **ou** com `semUsuarios` (mesmo
  bloqueio do Relatório/Gantt). `CategoriasSprintPanel` (nome de arquivo e
  componente mantidos) é a etapa **"Parâmetros"** — **passo 2 do Stepper**
  (etapa própria, entre "Sprints" e "Consultar"): além dos 3 `Autocomplete
  multiple freeSolo` DEV/REV/QA, traz um `TextField select` de agrupamento
  e um `Autocomplete` de tags para detalhar por descrição (só quando o
  agrupamento é `tag`/`ambos`), reaproveitando o mesmo padrão de
  `ParametrosForm`/`ParametrosGantForm` — os dois campos são persistidos no
  mesmo `TogglSprintCategorias.ini`, ainda não consumidos pelo acompanhamento
  (ver §4.9). O rodapé segue o molde de `ParametrosForm`/`ParametrosGantForm`:
  "Voltar" + "Continuar" (`outlined` — só avança, sem persistir) + "Salvar e
  continuar" (`contained` — `PUT /api/sprint/categorias` e depois avança;
  mensagem "Parâmetros salvos."). "Continuar" e "Salvar e continuar" ficam
  `disabled` enquanto `carregando`, `semUsuarios` ou **qualquer uma das 3
  categorias (DEV/REV/QA) estiver sem TAG** — enquanto incompleto, um `Alert`
  "info" ("Informe ao menos uma TAG para DEV, REV e QA para prosseguir.")
  aparece. A config (`{ dev, rev, qa, agrupamento, tagsDetalhadas }`) é elevada
  ao `App.tsx` via a prop `onAvancar` (guardada no estado `parametrosSprint`,
  que libera os passos 2/3 do Stepper). Fora do Stepper (`onAvancar` ausente)
  o painel só persiste. `ConsultaPanel` do Sprint recebe `agrupamento`,
  `tagsDetalhadas` **e** `categorias` (de `parametrosSprint`) e exibe as
  linhas "Agrupamento" / "Tags detalhadas" / "Categorias de tarefa" (DEV/REV/QA)
  — Relatório e Gantt não passam `categorias`. `SprintView` (acompanhamento):
  card do sprint em **linha única** (`flexWrap: nowrap` + `overflowX: auto`)
  com o resumo (Sprint · Horas/dia · Dias úteis · Margem · `Início` · `Fim` —
  cada valor em `<Typography variant="h6" color="primary.main">`, "Ajuste
  posterior 11") e três blocos de destaque à direita — **Pendentes** /
  **Concluído** /
  **Capacidade** (mesmo layout; Pendentes/Concluído nas consts
  `COR_PENDENTE = '#EA4335'` / `COR_CONCLUIDO = '#34A853'` — definidas uma vez
  no topo de `SprintView.tsx`, não tokens do tema —, Capacidade em
  `primary.main`; "Capacidade" era "CT" — só o rótulo mudou, valor
  `cabecalho.ct` intacto); seção **"Colaboradores"**
  (só se `colaboradores.length > 0`, entre o card e o grid) como
  `<Table size="small">` com `<TableFooter>` — colunas **Colab.** (nome
  completo `nomeExibicao`, texto simples) **· (sigla)** (2ª coluna sem título,
  `<Box>` quadrado `borderRadius: 0`, fundo na cor do usuário, texto branco,
  fallback cinza — este `<Box>` é o componente **`BadgeSigla`**, o mesmo do
  grid) **· Tempo por colaborador** (`${td} h`, ex-"Total"/"TD") **· Realizado**
  (`formatarDuracao`) **· Disponível** (Tempo por colaborador − Realizado, `HHhMMmSSs`,
  **derivada no front** — sem campo/DTO novo; **> 0** → verde `COR_CONCLUIDO` +
  bold, **< 0** → `COR_PENDENTE` + bold com prefixo `-`, `0` neutro)
  **· Pendentes · Concluídas** (texto em
  `COR_PENDENTE` / `COR_CONCLUIDO` quando `> 0`, na linha e no rodapé — como
  `TarefasConcluidas` agora é sempre 0, a coluna "Concluídas" fica zerada),
  rodapé "Total" somando só Pendentes e Concluídas, sem colunas por dia; o
  **grid tem uma linha por (tarefa × colaborador)**, dentro de um
  `TableContainer` de rolagem horizontal, com **1ª coluna de checkbox** e
  colunas **Prioridade · Situação · Código · Descrição** + grupos DEV/REV/QA
  em duas linhas de `TableHead` (`rowSpan`/`colSpan`), cada grupo **PRE · REA ·
  badge · Sit.**. A **linha 1 do cabeçalho dos grupos** mostra o nome por
  extenso — **Desenvolvimento / Revisão / Qualidade** (`GRUPOS[].nomeLongo`);
  a linha 2 e as células de dados seguem com DEV/REV/QA / a sigla. As células
  de cabeçalho **Prioridade · Situação · Código · Descrição** (`rowSpan={2}`)
  usam `verticalAlign: 'bottom'`. **Sem divisória vertical no bloco esquerdo** (Checkbox ·
  Prioridade · Situação · Código · Descrição — regra `:nth-of-type(-n+5)`
  zerando o `borderRight`); a 1ª divisória aparece só em **Descrição → DEV**, e
  as bordas entre/dentro dos grupos DEV/REV/QA continuam (`borderRight` via
  token `divider` no `sx` do `<Table>`). **Colunas compactadas** (`width: '1%'`
  + `nowrap` + padding menor em tudo exceto "Descrição", que fica com
  `maxWidth: 360` + elipse) e **linhas mais baixas** (`py: 0` nas células,
  `Checkbox` `p: 0.25`, badges `py: 0.1`). **Centralizados** (`align="center"`):
  Situação (geral e as 3 "Sit."), PRE, REA e os 3 badges DEV/REV/QA:
  - **Checkbox** (1ª coluna): marca a linha e risca a **descrição**
    (`line-through` + `color: text.disabled`). Estado persistido em
    `localStorage` por `tachados.ts` (chave `sprint-tachados-<chaveSprint>` —
    **isolada por sprint**, o `chaveSprint` no fim; id da linha =
    `idLinhaTarefa(codigo, descricao, nomeExibicao)` =
    `codigo∙descricao∙nomeExibicao`). **Reset só em consulta real à API**:
    `App.tsx` chama `limparTachados` no `onConcluida` do `ConsultaPanel` do
    Sprint quando `resposta.veioDoCache === false` — carregar do cache não
    limpa. `tachados.ts` (`lerTachados`/`gravarTachados`/`limparTachados`/
    `idLinhaTarefa`, tudo em `try/catch`) é o **único** uso de `localStorage`
    no projeto.
  - **Prioridade** = **badge** `BadgeTexto` (componente local novo, mesmo
    visual do `BadgeSigla` — `borderRadius: 0`, Montserrat, uppercase),
    **centralizado**: linha normal = fundo verde `#34A853` (`COR_CONCLUIDO`),
    texto preto, "Baixa"; linha tag-agg (`linha.agrupada`) = fundo laranja
    `#F57C00` (`COR_TAG`), texto preto, "Tag".
  - **Situação** (via `EtiquetaFixa`, texto bold colorido): Situação geral da
    linha normal = "Pendente" (`COR_PENDENTE`); da linha tag-agg = "Tag"
    (`COR_TAG`, laranja). **Em qualquer linha**, o grupo DEV/REV/QA **sem
    tempo do colaborador** (`reaSegundos === 0`) = **"–"** no badge e
    **"Nenhuma"** na Situação, ambos em preto (`text.primary`), com PRE/REA
    **"00h"**; o grupo **com tempo** (`reaSegundos > 0`) = badge de sigla +
    "Pendente" (normal) / "Tag" laranja (tag-agg). Nada editável nem
    persistido.
  - **Código / Descrição** = colunas separadas; **Código centralizado** e com
    **zero-padding dinâmico** — zeros à esquerda até o nº de dígitos do maior
    código da listagem daquele sprint (calculado em runtime sobre
    `resultado.tarefas`; helpers `contarDigitos`/`formatarCodigo` +
    `larguraCodigo`); linhas sem código = `"—"`. **Sem coluna "Tag"** — nas
    linhas tag-agg o nome da tag vai em "Descrição" e "Código" fica vazio.
  - **PRE / REA** = largura do badge (`LARGURA_CELULA = '2.5rem'`),
    centralizados, valor no formato **`00h`** (2 dígitos, `padStart`, sem
    "m"/"s") com `<Tooltip>` do `formatarDuracao` completo; PRE sempre `00h`.
    O cabeçalho de PRE/REA tem `<Tooltip>` de título ("Tempo previsto" /
    "Tempo realizado"). **REA com `reaSegundos > 0`** fica na cor
    `primary.main` (a mesma da "Capacidade") + `fontWeight: 600`; REA zero na
    cor padrão.
  - **badge** = **`BadgeSigla`** (sigla do colaborador, fundo na cor dele,
    `borderRadius: 0`, Montserrat uppercase, `Tooltip` com o nome), só nos
    grupos com `reaSegundos > 0` (nos demais, "–").
  - **Ordenação** = por número do código (`ServicoSprint.NumeroCodigo` no
    backend — antes era string, `TEL - 1118` vinha antes de `TEL - 994`).
  Removida toda a lógica de combos editáveis (`Select`, `salvarCampo`,
  `derivarSituacao`) e o update otimista. `SprintView` recebe a prop
  `categorias?: CategoriasSprint | null`. Um botão **"Buscar por descrição"** no
  header (antes do "Informações", "Ajuste posterior 11") abre um `<TextField>`
  "Filtrar por código ou descrição" abaixo do header — **filtro local
  client-side** sobre `resultado.tarefas` já carregado (colunas Código +
  Descrição), **sem chamada à API e sem trocar de view** (≠ `BuscaPanel` do
  Relatório e ≠ `GET /api/gant?termo=` do Gantt); filtra só a grid de tarefas
  (card do sprint / card de colaboradores não), com
  `<Alert severity="info">Nenhuma linha corresponde ao filtro.</Alert>` quando
  vazio. Um botão **"Informações"** no header
  (antes do "Voltar") abre um `<Dialog>` "Como este sprint é calculado" com os
  números reais do sprint (Tempo Total / Margem / **Tempo por colaborador** /
  **Capacidade** — os rótulos "TD"/"CT" não aparecem mais), as categorias
  DEV/REV/QA + Agrupamento e o texto das regras (inclui a regra geral
  "–"/"Nenhuma" + PRE/REA "00h" em qualquer grupo sem tempo do colaborador; o
  item de PRE/REA explica os tooltips de título ("Tempo previsto"/"Tempo
  realizado") e de valor, PRE = 0, e que um REA maior que zero fica na cor da
  Capacidade; item novo sobre o zero-padding dinâmico do código;
  o checkbox isolado por sprint; e um item sobre a **busca local** — filtra a
  lista já carregada por Código/Descrição, sem nova consulta à API). Aviso
  "servido do cache" reaproveitado. Tipos em `src/api/tipos.ts`: `Sprint`, `CriarSprintRequest`,
  `EditarSprintRequest`, `CategoriasSprint`, `AtualizarCategoriasSprintRequest`,
  `ResultadoSprint`, `CabecalhoSprint`, `LinhaTarefaSprint`,
  `LinhaColaboradorSprint`, `BlocoCategoriaSprint`. **Removidos**:
  `TarefaManualSprint`, `AtualizarTarefaSprintRequest`, as consts `PRIORIDADES`
  / `SITUACOES_CATEGORIA` e `atualizarTarefaSprint` de `sprintApi.ts`.
- **Base compartilhada de hooks e forms (auditoria de 2026-09-07, item 29)** —
  os hooks de recurso do frontend passaram a ter um núcleo comum, cada hook
  antigo virou um wrapper fino em cima dele: `useConsultaGenerica`
  (relatório/Gantt/Sprint), `useRecurso` (`useRelatorio`/`useGant`/`useSprint`),
  `useRecursoEditavel` (`useConfiguracao`/`useParametrosGant`/
  `useCategoriasSprint`), `useColecaoCrud` (`useUsuarios`/`useSprints`),
  `useExpansao` (`RelatorioView`/`GantView`). O corpo do formulário de
  Parâmetros virou `ParametrosFormBase`, com `ParametrosForm` e
  `ParametrosGantForm` como wrappers que só mapeiam `tagsDetalhadas` ⇄
  `tagsSelecionadas`. **Não** foram unificados: `useBusca` (assinatura
  divergente — `buscando`/`buscar` + `limpar` extra), `SprintsPanel` ≈
  `UsuariosPanel` (só o `CabecalhoView` foi extraído — uma abstração
  `PainelColecao` genérica seria quase toda encanamento e arriscada em 2 telas
  centrais), e os pares Request/Response DTO quase idênticos
  (`CategoriasSprintDto` ≡ `AtualizarCategoriasSprintRequest` etc. — convenção
  proposital de separar entrada/saída).

### 5.4 Limitações conhecidas desta camada

- Depende da Web API estar rodando no endereço configurado (`VITE_API_URL`,
  padrão `http://localhost:5180`); sem ela, toda chamada falha com um aviso
  (snackbar), mas o app não trava.
- Sem tela de login se a API não exigir autenticação (default, uso local);
  quando a API exige (`AUTH:USUARIO`/`AUTH:SENHA` configurados), mostra
  `LoginScreen` — ver §4.8 e §5.3.
- Não há testes automatizados (mesma limitação do resto do repositório).

### 5.5 Tema, tipografia e ícone

- **Um único tema, claro** (`theme.ts`, `createTheme` sem alternância) — um
  tema escuro chegou a ser implementado (com detecção de `prefers-color-scheme`
  e persistência em `localStorage`) e depois **removido por completo** a
  pedido do usuário; não reintroduzir sem pedido explícito.
- **Paleta central** (`CORES` em `theme.ts`, **exportado** desde 2026-09-07 —
  era `const` privado; `LoginScreen` usa `CORES.navbarFundo` em vez do literal
  `'#1A1A32'`): azul de destaque (`primary`/
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
  `icons.svg` (órfão, sem nenhuma referência) foi removido de `public/`. Desde
  2026-09-07 (item 29) esse markup vive em `components/MarcaTogglReport.tsx`
  (extração autorizada pelo usuário — o §4.8 e o item 21 do histórico
  registravam que ele fora **copiado** de propósito, sem virar componente), e
  a família da fonte é a const `FONTE_MARCA` (`utils/tipografia.ts`), antes
  repetida como literal em 9 lugares (barra de título, `LoginScreen`, rodapé).
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
19. **Revisão de segredos antes do repositório se tornar público**
    (2026-09-06): auditoria de todo o conteúdo rastreado pelo Git (não só
    arquivos atuais — `git ls-files` + busca por padrões de chave de
    API/token/private key) antes de abrir o repositório para a comunidade.
    Nenhuma credencial de GCP/GitHub, token real do Toggl ou dado pessoal
    encontrado versionado (`dados/`, `dados.rar`, `certificado/`, `*.tfstate`,
    `terraform.tfvars` reais — todos corretamente fora do controle de
    versão). **Um problema real corrigido**: `docker-compose.yml` tinha
    `Kestrel__Certificates__Default__Password=1234` em texto puro, rastreado
    — movido para `${KESTREL_CERT_PASSWORD}`, lido de um `.env` na raiz
    (gitignored; `.env.example` como template, ver §8). Os IDs reais dos dois
    projetos GCP, inicialmente deixados em texto claro por decisão
    deliberada (não são credencial), foram substituídos a pedido do usuário
    por `SEU_PROJETO_APP_ID`/`SEU_PROJETO_FINOPS_ID` em todo `toggl-report-infra/`
    e nos dois READMEs — nenhum identificador real de projeto GCP permanece
    versionado.
20. **Título do Swagger, fallback de configuração ausente, autenticação HTTP
    Basic opcional e criptografia de tokens** (2026-09-06, 5 fases — Fase 3
    só investigou e propôs opções, aguardando aprovação antes da Fase 4):
    - Título do `SwaggerDoc` → "Toggl Report API" (§4.7).
    - `OfereceRestaurarBackupSeNecessario` no console (§2.2) e
      `POST /api/dados/restaurar` na Api (§4.2) — oferece restaurar a pasta
      `dados/` de um `.zip` quando a configuração não é encontrada, sem
      criar nenhuma camada de configuração genérica nova.
    - Investigação (Fase 3): API sem autenticação nenhuma, CORS `AllowAny`,
      Cloud Run com `allUsers` público nos dois serviços — IAP descartado
      (exigiria Load Balancer, já fora do escopo da infra) e allowlist de
      CORS descartada (não protege chamada direta fora do navegador; API
      não usa cookie/sessão). Escolhida Basic Auth com **tela de login
      própria** em vez do popup nativo do navegador (§4.8) — o pulo do gato é
      simplesmente não mandar o header `WWW-Authenticate` na resposta 401.
    - Criptografia de `TokenApi` nos `.ini` (AES, §2.4) como camada extra,
      independente da autenticação.
    - Nenhuma mudança em `toggl-report-infra/` — autenticação liga via env
      vars do Cloud Run (`AUTH__USUARIO`/`AUTH__SENHA`), configuradas por
      fora do Terraform, mesmo mecanismo já usado por `VITE_API_URL`.
21. **Exceção de `/swagger`/`/images` no gate de auth, botão "Authorize" no
    Swagger, `LoginScreen` reaproveitando o `AppBar`, e import de `.zip` no
    frontend** (2026-09-06, 4 ajustes pontuais, mesmo dia do item 20):
    - `AutenticacaoBasicaMiddleware` passou a liberar também `/swagger` e
      `/images` (antes só `/health`) — pedido explícito do usuário para o
      Swagger continuar navegável sem credencial mesmo com a autenticação
      ligada (§4.8).
    - Swagger ganhou o botão **"Authorize"** (§4.7) — investigado antes de
      implementar: a autenticação da API é um middleware manual (parsing
      bruto do header `Authorization: Basic ...`), não
      `AddAuthentication`/`AddJwtBearer` do ASP.NET Core; `AddSecurityDefinition`/
      `AddSecurityRequirement` com esquema `basic` foram registrados só
      quando `AUTH:USUARIO`/`AUTH:SENHA` estão configurados, usando a API de
      referências nova do `Microsoft.OpenApi` 2.x (`OpenApiSecuritySchemeReference`),
      confirmada por reflexão sobre o pacote instalado.
    - `LoginScreen.tsx` (frontend) passou a renderizar o mesmo `AppBar` da
      aplicação (cor de fundo + logo + título "TOGGL REPORT" na mesma fonte)
      em vez de um cabeçalho próprio — pedido explícito para reaproveitar o
      estilo existente, não criar um novo (§4.8/§5.5). **Nota superada pelo
      item 29 (2026-09-07)**: o usuário autorizou extrair o logo + wordmark
      para `components/MarcaTogglReport.tsx`, então hoje `LoginScreen` e
      `App.tsx` compartilham esse componente.
    - `ImportarDadosDialog.tsx` (frontend, novo) fechou a ponta que faltava
      para `POST /api/dados/restaurar`: o endpoint já existia desde o item
      20, só faltava UI. Aparece uma vez por sessão quando a checagem
      inicial de usuários vem vazia; upload via `http.postArquivo`, método
      novo em `src/api/http.ts` (§5.3).
    - Tela de login (`LoginScreen.tsx`) ajustada de novo a pedido do
      usuário: em vez do `AppBar` escuro completo, o nome "TOGGL REPORT"
      (mesma fonte/pesos Montserrat) passou para **dentro** do card branco,
      acima do campo "Usuário", com a cor do texto trocada para
      `text.primary` (legível no fundo claro). Abaixo do botão "Entrar",
      adicionado o mesmo texto do rodapé da aplicação
      ("Toggl Report – Por Gleryston Matos – v{versão}"), e o rodapé
      (`RodapeDownloads.tsx`) passou a usar a mesma fonte Montserrat nesse
      texto — as três aparições do nome do app (barra de título, login,
      rodapé) usam a mesma família tipográfica.
22. **Correção de permissão de escrita em `dados/` no Docker da Api**
    (2026-09-07): `POST /api/dados/restaurar` (item 20) falhava em
    produção local com `UnauthorizedAccessException` ao extrair o `.zip` —
    a leitura (`GET /api/dados/download`) funcionava normalmente, só a
    escrita. Causa: a imagem roda o `dotnet` como usuário não-root
    (`$APP_UID`, padrão .NET 8+), mas `dados/` é um **bind mount** do host
    (`docker-compose.yml`) — o Docker cria o ponto de montagem como
    `root:root` (`755`) por padrão ao subir o container, o que o usuário
    não-root só consegue ler, não escrever (confirmado inspecionando
    `ls -la` dentro do container antes/depois da correção; `certificado/`
    — outro bind mount do mesmo compose — não precisou do mesmo ajuste
    porque a Api só **lê** o `.pfx` de lá, e `755` já permite leitura por
    quem não é dono). Corrigido com `toggl-report-back/entrypoint.sh`: o
    container passou a iniciar como `root` (removida a linha
    `USER $APP_UID` do `Dockerfile`), o script faz `mkdir -p`/`chown` de
    `dados/` para `$APP_UID` (disponível como env var em runtime, herdada da imagem base)
    e só então troca de usuário via `su-exec` (pacote Alpine, instalado no
    `Dockerfile`) antes de `exec dotnet TogglReport.Api.dll` — o processo
    da aplicação continua rodando como não-root (confirmado via
    `/proc/1/status`), só o ajuste de permissão do volume roda como root,
    uma vez, no início do container. `.gitattributes` ganhou `*.sh text
    eol=lf` (sem isso, o checkout no Windows normalizaria o script para
    CRLF, quebrando o shebang dentro do container Linux). **A CRLF voltou
    uma vez, depois de corrigida** (`exec /entrypoint.sh: no such file or
    directory` — o erro clássico de shebang com `\r`): causa era o
    `.editorconfig` raiz, cujo `[*] end_of_line = crlf` global não tinha
    exceção para `.sh` — qualquer editor que o respeite (Visual Studio
    incluso) reescreve o arquivo em CRLF ao salvar, e `.gitattributes`
    só normaliza em operações do Git (`add`/`checkout`), não no que um
    editor grava direto no working tree. Corrigido de vez com
    `[*.sh] end_of_line = lf` no `.editorconfig` (mesmo padrão já usado
    para `Dockerfile`/`.dockerignore`/`.yml`).
23. **Correção de corrida no diálogo de importação, download autenticado,
    e validação de estrutura do `.zip` restaurado** (2026-09-07, mesmo dia
    dos itens 21/22, 3 ajustes pontuais):
    - **Corrida no `useEffect` do `ImportarDadosDialog`** (App.tsx, item
      21): a checagem "tem usuário cadastrado?" rodava no mesmo commit que
      disparava `carregarUsuarios()`, então via sempre `carregando=false`/
      `usuarios=[]` (valores iniciais, antes do fetch resolver) — o diálogo
      aparecia **sempre** na primeira carga, mesmo com dados reais já
      importados, e a checagem "só uma vez" nunca mais rodava de verdade.
      Corrigido reagindo ao valor **resolvido** da própria promise
      (`carregarUsuarios().then(lista => ...)`) em vez do estado reativo
      `usuarios`/`carregando`, eliminando a corrida.
    - **`RodapeDownloads` devolvia 401 ao baixar**: o botão usava um
      `<a href={...}>` de navegação direta — nunca carrega a credencial
      (a API não usa `WWW-Authenticate`/cookie de propósito, §4.8), então
      o download sempre caía sem `Authorization`. Trocado por
      `http.getArquivo` (novo, `src/api/http.ts`) + `dadosApi.baixarDados`
      (blob + `URL.createObjectURL`, ver §5.3).
    - **`POST /api/dados/restaurar` ganhou validação de estrutura**: 400 se
      alguma entrada do zip estiver dentro de uma pasta
      (`entrada.FullName != entrada.Name`) — o `.zip` precisa ter os
      arquivos direto na raiz (compactar o **conteúdo** de `dados/`, não a
      pasta em si); entradas de diretório puro (`Name` vazio) são
      ignoradas, não rejeitadas (§4.2).
24. **Usuários separados num arquivo próprio, `TogglUsuarios.ini`** (2026-09-07,
    pedido do usuário: "reorganizei e padronizei a estrutura dos ini do
    projeto... criei um ini novo separado apenas para os usuários"):
    - Novo `TogglReport.Nucleo/Configuracao/CarregadorUsuariosIni.cs`
      (`Carregar`/`Salvar` das seções `[Usuario:*]`, mesma lógica que antes
      vivia dentro de `CarregadorConfiguracaoIni`) e `CaminhosDados.
      CaminhoUsuarios` (novo, `dados/TogglUsuarios.ini`, sem "nome antigo"
      porque é um arquivo novo, não uma renomeação).
    - `CarregadorConfiguracaoIni.Carregar`/`.Salvar` ganharam um segundo
      parâmetro (`caminhoUsuarios`) e passaram a delegar `Usuarios` para
      `CarregadorUsuariosIni` — o `[Geral]` (agrupamento/tags/período)
      continua em `TogglRelatorioParametros.ini`. `ConfiguracaoApp.Usuarios`
      **não mudou de forma nenhuma** como propriedade em memória — só onde
      é persistido — então nenhum consumidor (`ServicoConsulta`,
      `ServicoGant`, `Tela`, `AssistenteConfiguracao`, `MenuTokenUsuario`,
      DTOs da API) precisou de qualquer alteração; só o `Program.cs`
      (console e API) e os 6 arquivos de `Endpoints/` que já chamavam
      `CarregadorConfiguracaoIni` ganharam o parâmetro extra (mecânico, sem
      lógica nova).
    - **Migração automática, sem intervenção manual** (mesmo espírito do
      item 18, mas migrando **conteúdo** entre dois arquivos, não
      renomeando um arquivo inteiro): `CarregadorUsuariosIni.Carregar`
      recebe o caminho do arquivo de parâmetros como "migração legada" — se
      `TogglUsuarios.ini` ainda não existe mas esse arquivo tem seções
      `[Usuario:*]` (formato anterior), extrai e grava no arquivo novo na
      primeira leitura; o arquivo de parâmetros perde essas seções
      sozinho na próxima vez que for salvo (já que `Salvar` não as escreve
      mais ali). Validado com um projeto de teste isolado (fora do
      repositório de dados reais): arquivo legado com um usuário embutido
      → `TogglUsuarios.ini` criado automaticamente com o token já
      criptografado, sem intervenção manual.
    - `CarregadorConfiguracaoIni.Carregar` agora só devolve `null` quando
      **nem** o arquivo de parâmetros **nem** `TogglUsuarios.ini` têm
      conteúdo (antes, `null` só dependia de `TogglRelatorioParametros.ini`)
      — mais preciso para decidir "existe alguma configuração salva?"
      (usado por `OfereceRestaurarBackupSeNecessario` no console, ver §2.2).
    - `.gitignore` (raiz e `toggl-report-back/`) e `.dockerignore`
      (`toggl-report-back/`) ganharam a entrada `TogglUsuarios.ini`, ao lado
      das outras — contém `TokenApi` criptografado, tratado como segredo
      igual aos demais.
    - Nenhuma rota HTTP mudou de contrato — `GET /api/dados/download` (zipa
      `dados/` inteira, sem lista fixa) já inclui `TogglUsuarios.ini`
      automaticamente, sem mudança de código.
25. **`POST /api/dados/restaurar` sem tratamento de erro de I/O** (2026-09-07):
    reportado pelo usuário como "erro ao importar quando a pasta não existe" —
    investigado a fundo (3 containers Docker isolados, pasta `dados/` nunca
    criada no host antes de subir, incluindo o caso do próprio `docker run`
    tendo que criar o bind mount do zero) sem conseguir reproduzir uma falha
    de "pasta ausente" isolada, já que `Directory.CreateDirectory` já
    existia ali desde o item 20. O bug real, porém, estava logo ao lado:
    esse `Directory.CreateDirectory(pastaDados)` ficava **fora** do
    `try/catch`, e o `catch` só tratava `InvalidDataException` (zip
    inválido) — qualquer `IOException`/`UnauthorizedAccessException` real
    (a mesma classe de erro do item 22, se acontecer de novo por qualquer
    outro motivo) subia como exceção não tratada (500 cru, stack trace na
    resposta), fugindo do padrão `catch (Exception ex) when (ex is
    IOException or UnauthorizedAccessException) → Results.Problem(...)`
    que todo o resto da API já segue (`UsuariosEndpoints`,
    `ConfiguracaoEndpoints`, `GantEndpoints`). Corrigido: `Directory.
    CreateDirectory` movido para dentro do `try`, e um segundo `catch`
    adicionado para esses dois tipos, devolvendo 500 com mensagem limpa em
    vez de um erro cru. Revalidado nos mesmos 3 cenários isolados — todos
    continuam `204`.
26. **`.gitignore` da raiz ignorava sem querer uma pasta de código-fonte do
    frontend** (2026-09-07): o deploy (Cloud Build, passo `test-frontend`)
    quebrou com `error TS2307: Cannot find module
    './features/dados/ImportarDadosDialog'` — o arquivo existia em disco e
    compilava localmente, mas nunca tinha sido versionado. Causa: `.gitignore`
    da raiz tinha `dados/` e `certificado/` **sem `/` na frente** — um
    padrão assim no Git bate em qualquer pasta com esse nome, em qualquer
    profundidade da árvore, não só na raiz. Isso incluía silenciosamente
    `toggl-report-front/src/features/dados/` (pasta de código-fonte
    legítima, item 17 do histórico) — qualquer arquivo **novo** criado ali
    era ignorado por `git add` sem aviso (arquivos **já rastreados antes**
    da regra existir, como `RodapeDownloads.tsx`, não são afetados
    retroativamente — só isso escondeu o problema até agora). Corrigido
    ancorando os dois padrões (`/dados/`, `/certificado/`, só a pasta da
    raiz) e recuperando o arquivo com `git add -f`. **Lição para sessões
    futuras**: ao criar um arquivo novo dentro de uma pasta chamada
    `dados/`, `certificado/`, ou qualquer nome que também exista como pasta
    de runtime na raiz do repo, confirmar com `git status`/`git check-ignore
    -v <arquivo>` que ele não está sendo silenciosamente ignorado antes de
    dar o trabalho por commitado.
27. **Sprint — terceira visualização, com gestão (CRUD) + acompanhamento**
    (2026-09-07, 6 fases, molde do Gantt em todas as camadas — Fase 0 sempre
    somente leitura, com o cálculo de capacidade confirmado com o usuário por
    `curl` antes de mexer na lógica; validado por `dotnet build` + `curl`):
    - **Persistência** (§4.9): 4 arquivos INI novos em `dados/`, todos no
      `.gitignore` (raiz + `toggl-report-back/`) e no `.dockerignore` —
      `TogglSprints.ini` (seções `[Sprint:<chave>]`, molde `TogglUsuarios.ini`),
      `TogglSprintCategorias.ini` (`[Geral]` único, molde
      `TogglGantParametros.ini`, mapeamento **global** TAG → categoria
      `Dev`/`Rev`/`Qa` — `Carregar` nunca devolve `null`, cai em `Padrao()`,
      hoje sem nenhuma TAG default, ver "Ajuste posterior 2" abaixo),
      `TogglSprintData.ini` (cache dedicado, **mesmo formato** de
      `CacheConsulta`/`UsuarioCacheado` — `CarregadorCacheIni` reaproveitado
      sem alteração) e `TogglSprintTarefas.ini` (campos manuais por tarefa —
      **removido no "Ajuste posterior 7"**, junto com `CaminhoTarefasSprint`).
      São arquivos novos, sem migração de nome antigo. `CaminhosDados` ganhou
      métodos `Path.Combine` puro (`CaminhoSprints`/`CaminhoCategoriasSprint`/
      `CaminhoCacheSprint`; `CaminhoTarefasSprint` depois removido), sem
      `CaminhoComMigracao`.
    - **Núcleo**: `Configuracao/Sprint.cs` (classe mutável),
      `ServicoSprints.cs` (static — `NomeEmUso`/`GerarChaveUnica`, fallback
      `"sprint"`), `CarregadorSprintsIni.cs`,
      `ConfiguracaoCategoriasSprint.cs`,
      `CarregadorConfiguracaoCategoriasSprintIni.cs` (com `Padrao()`),
      `CarregadorTarefasSprintIni.cs` (**removido no "Ajuste posterior 7"**).
      E a pasta `Sprint/` no namespace
      **`RelatorioToggl.Sprints`** — **plural de propósito**: `RelatorioToggl.
      Sprint` colidiria com o tipo `RelatorioToggl.Configuracao.Sprint` e
      quebraria `List<Sprint>` em código existente. Records
      `CabecalhoSprint`/`BlocoCategoriaSprint`/`LinhaTarefaSprint`/
      `ResultadoSprint`/`TarefaManualSprint` (o último **removido no "Ajuste
      posterior 7"**) + `ServicoSprint.Montar` (static, puro — capacidade +
      tarefas; à época agrupadas só por descrição).
    - **Cálculo de capacidade** (§4.9): `margem = floor(30% do total)`,
      `TD = floor(total − margem)` por colaborador, `CT = TD × nº de
      colaboradores selecionados`. **A descrição original do pedido falava em
      "70% do total" e "70% de 70%" — isso NÃO se aplica**; o esclarecimento
      veio do usuário e foi conferido por `curl` (HorasPorDia=7,
      2026-09-01→2026-09-24 → diasUteis=18, tempoTotal=126, margem=37, TD=89,
      CT=89 para 1 colaborador).
    - **Web API**: 4 arquivos em `Endpoints/` (`SprintsEndpoints`,
      `SprintCategoriasEndpoints`, `SprintConsultasEndpoints`,
      `SprintAcompanhamentoEndpoints`), tabela em §4.9; tags Swagger `Sprints`
      (CRUD) e `Sprint` (categorias/consultas/acompanhamento). `POST
      /api/sprint/consultas` reaproveita `ServicoConsulta` inteiro, só troca o
      caminho do cache e filtra `Selecionado` — mesma decisão do Gantt.
      `GET /api/sprint` devolve o `ResultadoSprint` do núcleo serializado
      direto (como `GET /api/gant`), com **409** se não há cache para o
      período do sprint.
    - **Frontend**: aba "Sprint" (4ª aba), `src/features/sprint/` +
      `src/api/sprintsApi.ts`/`categoriasSprintApi.ts`/`sprintApi.ts` + tipos
      novos em `src/api/tipos.ts` (ver §5.2/§5.3). Stepper de **4 passos**
      (Sprints → Categorias → Consultar → Acompanhamento): "Sprints" é o CRUD +
      seleção de 1 sprint e "Categorias" é a configuração do mapeamento
      DEV/REV/QA numa **etapa própria** (`CategoriasSprintPanel` com rodapé
      Voltar/Salvar/Continuar — `Salvar` só persiste, `Continuar` só navega e
      fica `disabled` com `semUsuarios`; rodapé revisto no "Ajuste posterior 2"
      abaixo); `etapaSprintLiberada` libera
      "Categorias" e "Consultar" com sprint selecionado, "Acompanhamento" só
      com a consulta concluída. `ConsultaPanel` compartilhado sem alteração
      nesta fase (ganhou a prop `categorias?` no "Ajuste posterior 2" abaixo).
      `SprintsPanel` faz a listagem + seleção e delega o cadastro/edição ao
      modal `SprintFormDialog` (mesmo padrão do CRUD de usuários,
      `UsuarioFormDialog`); `SprintView` é uma tabela com rolagem horizontal
      e combos inline por célula (update otimista + reversão em erro).
    - **Ajuste posterior (2026-09-07)**: a etapa "Categorias" foi renomeada
      para "Parâmetros" e recebeu, no mesmo `CategoriasSprintPanel`, os campos
      de agrupamento + tags para detalhar por descrição (padrão de
      `ParametrosForm`/`ParametrosGantForm`), persistidos na seção `[Geral]`
      do mesmo `TogglSprintCategorias.ini` (`Agrupamento`/`TagsDetalhadas`
      nos DTOs `CategoriasSprintDto`/`AtualizarCategoriasSprintRequest`,
      `agrupamento` validado contra `descricao`/`tag`/`ambos`) — sem
      renomear arquivo INI, rota, classe ou tipo. Nesta rodada ainda eram
      **só persistidos**; passaram a ser consumidos no "Ajuste posterior 6".
    - **Ajuste posterior 2 (2026-09-07)**: (a) `Padrao()` de
      `CarregadorConfiguracaoCategoriasSprintIni` perdeu as TAGs default —
      antes `Dev = [IMPLEMENTACAO, BUG]`, `Rev = [REVISAO]`, `Qa = [QA]`;
      agora as 3 listas vêm **vazias** (`Agrupamento = "ambos"` mantido, não é
      TAG). Sem arquivo/chave, `GET /api/sprint/categorias` →
      `{"dev":[],"rev":[],"qa":[],"agrupamento":"ambos","tagsDetalhadas":[]}`
      (conferido por `curl`). (b) A etapa "Parâmetros" ganhou o rodapé molde
      `ParametrosForm`/`ParametrosGantForm`: "Voltar" / "Continuar"
      (`outlined`, só avança) / "Salvar e continuar" (`contained`, `PUT` +
      avança) — os dois de avanço `disabled` enquanto DEV, REV **ou** QA
      estiver sem nenhuma TAG (`Alert` "info" enquanto incompleto), além de
      `carregando`/sem usuário. A config é elevada ao `App.tsx`
      (`onAvancar`, estado `parametrosSprint`), que libera os passos
      Consultar/Acompanhamento só com `parametrosSprint !== null`. (c)
      `ConsultaPanel` (compartilhado) ganhou a prop opcional `categorias?`
      (`{ dev, rev, qa }`); o fluxo Sprint agora passa `agrupamento`,
      `tagsDetalhadas` e `categorias` — a tela "Consultar" do Sprint exibe
      essas linhas (antes o Sprint não passava nenhuma); Relatório e Gantt
      não passam `categorias`.
    - **Ajuste posterior 3 (2026-09-07)**: acompanhamento aproximado da
      planilha de referência. (a) `CabecalhoSprint` ganhou
      `TarefasPendentes`/`TarefasConcluidas` (contagem das linhas do grid pela
      `Situacao` geral) e o card passou a mostrar **Pendentes** / **Concluído** /
      **CT** em três blocos de destaque, com `Início`/`Fim` como campos
      separados — a fórmula de capacidade não mudou. (b) Grid reordenado para
      **`Situação │ Descrição │ Prioridade`** (a "Situação" geral derivada virou
      a 1ª coluna) e a 3ª subcoluna de cada grupo passou de **"Resp."** para
      **`DEV`/`REV`/`QA`** (só o rótulo do cabeçalho + `Tooltip`; o dado — a(s)
      sigla(s) de quem apontou — não mudou); o padrão de cada grupo é
      **`PRE │ REA │ DEV │ Situação`**. (c) Novo
      `record LinhaColaboradorSprint(NomeExibicao, Sigla, Cor, Td,
      SegundosRealizados, TarefasPendentes, TarefasConcluidas)` + 3º parâmetro
      `Colaboradores` em `ResultadoSprint`; `ServicoSprint.Montar` monta uma
      linha por usuário selecionado (`Td` igual para todos,
      `SegundosRealizados` = soma de `Duracao >= 0` de **todos** os apontamentos
      do usuário no cache, pendentes/concluídas contadas pelas descrições do
      grid; usuário sem apontamento entra zerado) e o `SprintView` renderiza um
      card "Colaboradores" (`Colab. · TD · Realizado · Pendentes · Concluídas`)
      entre o card do sprint e o grid — **sem colunas por dia** (isso é o
      Gantt). **Fora de escopo, anotado como melhoria futura** (§4.9): gráfico
      de pizza (Concluído/Pendente) e gráfico de barras por colaborador da
      planilha de referência não foram implementados.
    - **Ajuste posterior 4 (2026-09-07)**: acabamento visual do
      acompanhamento (só `SprintView.tsx`, sem backend). Card do sprint em
      **linha única** (`flexWrap: nowrap` + `overflowX: auto`, rola em vez de
      quebrar); blocos de destaque **Pendentes**/**Concluído** com cor hex
      fixa `#EA4335` / `#34A853` (não mais token de tema) e **"CT" renomeado
      para "Capacidade"** (valor `cabecalho.ct` inalterado). Tabela de
      colaboradores: **Colab.** passou a mostrar o nome completo
      (`nomeExibicao`) em texto simples; nova 2ª coluna sem título com a
      **sigla** num `<Box>` quadrado (`borderRadius: 0`) colorido pela cor do
      usuário; **"TD" → "Total"**; nova coluna **"Disponível"** (Total −
      Realizado, `HHhMMmSSs`, vermelho `#EA4335` bold quando negativa,
      **derivada no frontend** — `ServicoSprint`/`ResultadoSprint`/
      `LinhaColaboradorSprint`/DTOs **não mudaram**); e **rodapé**
      `<TableFooter>` somando só as colunas Pendentes e Concluídas. Nenhuma
      mudança em `TD`/`Margem`/`CT` — só rótulos e uma coluna calculada no
      cliente.
    - **Ajuste posterior 5 (2026-09-07)**: as duas cores de status
      (`#EA4335` / `#34A853`) viraram as consts `COR_PENDENTE` /
      `COR_CONCLUIDO` no topo de `SprintView.tsx` (uma definição, reusada no
      card, na "Disponível" negativa e nas colunas Pendentes/Concluídas). As
      colunas **Pendentes** e **Concluídas** da tabela de colaboradores agora
      têm **destaque condicional de cor** quando `> 0` (`COR_PENDENTE` /
      `COR_CONCLUIDO`), tanto na linha de cada colaborador quanto no total do
      rodapé. Só estilo — nenhum valor mudou.
    - **Ajuste posterior 6 (2026-09-07)**: a grid do Sprint passou a **respeitar
      o `Agrupamento`** da etapa "Parâmetros" (bug: era ignorado — o
      agrupamento por descrição fixo do `ServicoSprint.Montar` foi codificado
      na Fase 5/6 original, antes de o seletor existir; o "Ajuste posterior 1"
      só persistia o valor). Correção cirúrgica em `ServicoSprint.cs`: a chave
      fixa `NormalizarDescricaoTel(descricao)` virou `ChaveAgrupamento(registro,
      categorias)` — descrição normalizada quando "detalhar", `registro.Tags[0]`
      quando "agregar", **idêntico ao `ServicoGant`** (`"descricao"` → por
      descrição; `"tag"` → por tag; `"ambos"` → por descrição só se `Tags[0]` ∈
      `TagsDetalhadas`, senão por tag). Cálculo de capacidade, colunas
      DEV/REV/QA (classificação por registro), cores e cabeçalho **intactos**;
      nada no frontend. Conferido por `curl` nos 3 modos. **Atenção**: com o
      default (`Agrupamento = "ambos"`, `TagsDetalhadas = []`) a grid agora
      agrega **tudo por tag** — para ver por descrição, escolher `"descricao"`.
    - **Ajuste posterior 7 (2026-09-07)**: reestruturação completa da tela de
      acompanhamento **e remoção do "manual de tarefas"** (§3/§4.9/§5).
      - **Grid por (tarefa × colaborador)**: `ServicoSprint.Montar` perdeu o
        parâmetro `manuais` e passou a emitir **uma linha por par (tarefa,
        colaborador)**. `ChaveAgrupamento` agora devolve
        `(string Chave, bool Agrupada)`. Linhas de descrição (`Agrupada ==
        false`) têm `Codigo`/`Descricao` separados por `SepararCodigo` (regex
        `^(TEL - \d+)(?: - (.+))?$`); linhas tag-agg (`Agrupada == true`, só
        com `agrupamento` `tag`/`ambos`) roteiam **todo** o tempo do
        colaborador naquela tag para **um** grupo — **QA** se o colaborador
        tem ≥ 1 apontamento no sprint com tag ∈ `categorias.Qa` (pré-passo
        `colaboradoresComQa`), senão **DEV** (REV nunca). Ordenação: linhas de
        descrição (com `Codigo` antes das sem, depois por `Codigo`/`Descricao`)
        e então as tag-agg (pela ordem do colaborador, depois por `Descricao`).
        Cálculo de capacidade **intacto**.
      - **Records**: `BlocoCategoriaSprint` virou
        `(decimal PreHoras, long ReaSegundos)` — perdeu `Colaboradores` e
        `Situacao`. `LinhaTarefaSprint` virou `(Codigo, Descricao,
        NomeExibicao, Sigla, Cor, Agrupada, Dev, Rev, Qa)` — perdeu
        `Prioridade`/`Situacao`, ganhou os campos de código/colaborador/
        `Agrupada`. `CabecalhoSprint` ganhou `int Td` (após `Ct`);
        `TarefasConcluidas` **agora é sempre 0** e `TarefasPendentes` = nº de
        descrições distintas. `LinhaColaboradorSprint` inalterado
        (`TarefasConcluidas` sempre 0).
      - **Removido o manual de tarefas**: deletados `CarregadorTarefasSprintIni.cs`,
        `TarefaManualSprint.cs`, `AtualizarTarefaSprintRequest.cs`; removidos o
        endpoint **`PUT /api/sprint/tarefas`** (e o parâmetro
        `caminhoTarefasSprint` de `MapSprintAcompanhamentoEndpoints`), o
        arquivo **`TogglSprintTarefas.ini`** (e suas entradas no `.gitignore`
        da raiz + `toggl-report-back/.gitignore` + `.dockerignore`) e
        `CaminhosDados.CaminhoTarefasSprint`. Prioridade e Situação **não são
        mais editáveis nem persistidas** — viraram valores fixos exibidos no
        frontend ("Baixa" / "Pendente"), "sem integração por enquanto".
      - **Frontend** (`SprintView.tsx`): grid nova com cabeçalho
        **Prioridade · Situação · Código · Descrição** + grupos DEV/REV/QA
        (`PRE · REA · badge · Sit.`); Prioridade/Situação por `EtiquetaFixa`
        (texto bold colorido, verde `#34A853` / vermelho `#EA4335`);
        Código/Descrição em colunas separadas, sem coluna "Tag"; PRE/REA só a
        hora resumida `Nh` (`formatarHoraResumida`) com `Tooltip` do
        `formatarDuracao`; `BadgeSigla` (sigla colorida, cantos retos) na
        coluna sem título de cada grupo, extraído e reusado no card de
        colaboradores. Novo botão **"Informações"** no header → `<Dialog>`
        "Como este sprint é calculado" com os números reais do sprint
        (Tempo Total / Margem / TD / CT), as categorias + Agrupamento e as
        regras. `SprintView` recebe `categorias?: CategoriasSprint | null`.
        Removidos `atualizarTarefaSprint`, tipos `TarefaManualSprint`/
        `AtualizarTarefaSprintRequest`, consts `PRIORIDADES`/
        `SITUACOES_CATEGORIA` e toda a lógica de combos editáveis (`Select`,
        `salvarCampo`, `derivarSituacao`). Card do sprint e card de
        colaboradores **mantidos** — "Concluído"/"Concluídas" ficam sempre 0.
      - Builds C# e frontend limpos.
    - **Ajuste posterior 8 (2026-09-07)**: 9 ajustes na tela de acompanhamento
      (backend só `ServicoSprint.cs`, resto em `SprintView.tsx`/`App.tsx` +
      `src/features/sprint/tachados.ts` novo).
      - **Ordenação por número de código** (era bug: ordenava por string,
        `TEL - 1118` antes de `TEL - 994`). Helper `NumeroCodigo(string codigo)`
        extrai os dígitos de `Codigo`; a ordenação usa
        `.ThenBy(t => t.Agrupada ? 0 : NumeroCodigo(t.Codigo))` antes do
        desempate por string → `TEL - 994 → TEL - 1000 → TEL - 1118`. Nada
        mais mudou no backend.
      - **Rótulos**: tabela de colaboradores "Total" → **"Tempo por
        colaborador"**; modal "Informações" `"TD (...) = Tempo Total − Margem"`
        → `"Tempo por colaborador = Tempo Total − Margem"` e
        `"CT (capacidade total) = ..."` → `"Capacidade = Tempo por colaborador
        × nº de colaboradores"`. Não há mais "TD"/"CT" como rótulo.
      - **Linhas divisórias** entre todas as colunas da grid (`borderRight`
        via token `divider`, adapta a tema claro/escuro).
      - **Colunas compactadas**: Prioridade, Situação, Código, checkbox e as 4
        de cada grupo com `width: '1%'` + `nowrap` + padding menor; "Descrição"
        absorve o resto (`maxWidth` 360).
      - **Estilo das linhas de agrupamento por tag** (`linha.agrupada`):
        Prioridade e Situação geral = **"Tag"** em laranja `#F57C00`
        (`COR_TAG`). Nos grupos DEV/REV/QA: o grupo com o colaborador
        (`reaSegundos > 0`) = badge de sigla + Situação "Tag" laranja; os
        grupos sem colaborador = **"–"** no badge e **"Nenhuma"** na Situação,
        em preto (`text.primary`). PRE/REA continuam `0h`.
      - **Prioridade como badge** (`BadgeTexto`, componente local novo — mesmo
        visual do `BadgeSigla`, `borderRadius: 0`, Montserrat, uppercase),
        centralizado: linha normal = fundo verde `#34A853`, texto preto,
        "Baixa"; linha tag-agg = fundo laranja `#F57C00`, texto preto, "Tag".
      - **Checkbox + tachado persistente**: nova 1ª coluna com um `Checkbox`;
        marcar risca a descrição (`line-through` + cor esmaecida). Conjunto
        persistido em `localStorage` (chave `sprint-tachados-<chaveSprint>`,
        id da linha = `codigo∙descricao∙nomeExibicao`). **Reset só em nova
        consulta real à API**: `App.tsx` chama `limparTachados(chaveSprint)` no
        `onConcluida` do `ConsultaPanel` quando `resposta.veioDoCache ===
        false` — não ao carregar do cache. Módulo novo
        `src/features/sprint/tachados.ts` (`lerTachados`/`gravarTachados`/
        `limparTachados`/`idLinhaTarefa`, tudo em `try/catch`) — **único** uso
        de `localStorage` no projeto.
      - **Modal "Informações" ampliado**: itens sobre prioridade/situação
        fixas, "Tag" laranja nas linhas de agrupamento por tag, "–"/"Nenhuma"
        nos grupos vazios, e o comportamento do checkbox.
      - Nova const `COR_TAG = '#F57C00'` ao lado de `COR_PENDENTE`/
        `COR_CONCLUIDO` no topo de `SprintView.tsx`.
    - **Ajuste posterior 9 (2026-09-07)**: 6 ajustes finos na grid de
      acompanhamento — só visual + uma unificação de regra, **nenhuma lógica de
      agrupamento/cálculo/persistência mudou** (só `SprintView.tsx`).
      - **Divisórias removidas no bloco esquerdo**: as colunas Checkbox ·
        Prioridade · Situação · Código · Descrição não têm mais borda vertical
        entre si. A 1ª divisória da grid aparece só em **Descrição → DEV**; as
        bordas entre e dentro dos grupos DEV/REV/QA (PRE · REA · badge · Sit.)
        continuam. Feito com `& tbody td:nth-of-type(-n+5)` /
        `& thead tr:first-of-type th:nth-of-type(-n+5)` zerando o `borderRight`
        no `sx` do `<Table>`.
      - **Colunas centralizadas** (`align="center"`): Situação (a geral **e**
        as 3 "Sit." de cada grupo), PRE, REA e as 3 colunas de badge
        (DEV/REV/QA).
      - **Regra "–" / "Nenhuma" unificada**: antes só as linhas de agrupamento
        por tag mostravam "–" (badge) e "Nenhuma" (situação do grupo) quando o
        grupo não tinha colaborador. **Agora vale para qualquer linha**
        (inclusive as de descrição): em todo grupo DEV/REV/QA sem tempo do
        colaborador (`reaSegundos === 0`) → "–" no badge e "Nenhuma" (preto) na
        situação do grupo, PRE/REA = "00h". Grupos com tempo
        (`reaSegundos > 0`) mantêm o badge de sigla + situação "Pendente"
        (normal) / "Tag" (agrupada).
      - **PRE/REA: largura e formato**: passaram à mesma largura da coluna de
        badge (nova const `LARGURA_CELULA = '2.5rem'` ao lado de `COR_*`), com
        o valor exibido como **`00h`** (2 dígitos, `padStart`, sem "m"/"s"),
        centralizado; o `<Tooltip>` com o valor completo (`00h00m00s`) foi
        mantido.
      - **Linhas mais baixas**: padding vertical das células da grid reduzido
        (`py: 0` nas células, `Checkbox` com `p: 0.25`, badges com `py: 0.1`).
      - **Checkbox isolado por sprint** — confirmação, sem mudança de código: a
        chave do `localStorage` já era `sprint-tachados-<chaveSprint>`, e
        `chaveSprint` é o identificador único do sprint (`[Sprint:<chave>]` de
        `TogglSprints.ini`); cada sprint tem seu conjunto de linhas riscadas e
        trocar de sprint troca a chave — sem risco de mistura.
      - **Modal "Informações" atualizado**: item novo "Em qualquer linha, um
        grupo (DEV/REV/QA) sem tempo do colaborador aparece com '–' ... e
        'Nenhuma' ...; PRE e REA ficam '00h'"; o item do checkbox passou a
        dizer que a marcação é **isolada por sprint**.
    - **Ajuste posterior 10 (2026-09-07)**: 5 ajustes finos na grid de
      acompanhamento — só apresentação, **nenhuma lógica de agrupamento/
      cálculo/persistência mudou** (só `SprintView.tsx`).
      - **Coluna Código centralizada + zero-padding dinâmico**: cada número é
        preenchido com zeros à esquerda até o nº de dígitos do **maior código
        presente na listagem daquele sprint** — calculado em runtime a partir
        de `resultado.tarefas` (não fixo). Ex.: maior `TEL - 1118` →
        `TEL - 0994`, `TEL - 1000`, `TEL - 1118`. Linhas sem código continuam
        `"—"`. Helpers novos `contarDigitos` / `formatarCodigo` +
        `larguraCodigo` (reduce sobre `tarefas`).
      - **Destaque de REA > 0**: quando `bloco.reaSegundos > 0`, o valor da
        coluna REA fica na cor `primary.main` (o **mesmo token** do destaque
        "Capacidade" no card do sprint — `#5B82F6`) + `fontWeight: 600`; REA
        zero fica na cor padrão.
      - **Rótulos de grupo expandidos só na linha 1 do cabeçalho**: o
        `<TableCell colSpan={4}>` de cada grupo passou a mostrar
        **"Desenvolvimento" / "Revisão" / "Qualidade"** (`GRUPOS[].nomeLongo`)
        em vez de "DEV" / "REV" / "QA". A **linha 2 do cabeçalho** (sub-título
        da coluna de badge) e as **células de dados** (badge de sigla)
        continuam com "DEV"/"REV"/"QA" / a sigla.
      - **Alinhamento dos títulos**: as células de cabeçalho **Prioridade,
        Situação, Código e Descrição** (com `rowSpan={2}`) ganharam
        `verticalAlign: 'bottom'` — os títulos ficam colados na parte de baixo
        da célula, perto dos dados.
      - **Tooltip no cabeçalho de PRE/REA**: o título **PRE** mostra "Tempo
        previsto"; **REA**, "Tempo realizado" (mesmo `<Tooltip>` do MUI já
        usado no resto — o tooltip do valor completo nas células de PRE/REA
        continua).
      - **Modal "Informações" atualizado**: (a) o item de PRE/REA agora
        explica os tooltips de título e de valor, PRE = 0, e que "um REA maior
        que zero fica na cor da Capacidade"; (b) item novo sobre o
        zero-padding dinâmico do código.
    - **Ajuste posterior 11 (2026-09-07)**: 6 ajustes de apresentação na tela de
      acompanhamento do Sprint — **nenhuma lógica de agrupamento/cálculo/
      persistência/API mudou** (`SprintView.tsx` + `RodapeDownloads.tsx`).
      - **Padding da coluna "Descrição"** da grid de tarefas igualado ao das
        demais (`px: 0.5`).
      - **Campos de texto do card do sprint** (`ParInfo`: Sprint, Horas/dia,
        Dias úteis, Margem, Início, Fim): o valor virou
        `<Typography variant="h6" color="primary.main">` (fonte maior + a mesma
        cor azul da "Capacidade"), alinhado ao centro da barra — visualmente
        próximo dos totalizadores. Os **totalizadores** (Pendentes vermelho /
        Concluído verde / Capacidade azul) **não mudaram**.
      - **Coluna "Disponível"** (tabela de colaboradores): quando **> 0**, texto
        **verde `COR_CONCLUIDO`** + bold (mesmo tom de "Concluídas"); **< 0**
        continua vermelho `COR_PENDENTE`; `0` neutro.
      - **Busca por descrição** (nova): botão "Buscar por descrição" no topo,
        **antes** do "Informações" (mesmo estilo do botão de busca do Gantt);
        abre um `<TextField>` "Filtrar por código ou descrição" abaixo do
        header. É **filtro local, client-side** sobre a lista já carregada
        (colunas **Código e Descrição**), **sem nova consulta à API** e **sem
        trocar de view** — diferente do Relatório (abre `BuscaPanel`) e do Gantt
        (reconsulta `GET /api/gant?termo=`). Só a grid de tarefas é filtrada
        (card do sprint e card de colaboradores não). Sem correspondência →
        `<Alert severity="info">Nenhuma linha corresponde ao filtro.</Alert>`.
      - **Rodapé** (`RodapeDownloads`): margem superior `mt: 4` → `mt: 2`
        (metade).
      - **Modal "Informações"**: item novo explicando a busca local (filtra a
        lista carregada por Código/Descrição, sem nova consulta à API).
28. **Ajustes de apresentação em "Relatório" e "Gant"** (2026-09-07, só
    frontend — **nenhuma lógica de agrupamento/cálculo/persistência/API mudou**):
    - **Relatório** (`RelatorioUsuarioCard.tsx` + `curadoria.ts`): a seção "Por
      descrição" ganhou uma **coluna "Tag"** (`<Typography variant="body2"
      color="text.secondary">` com ellipsis) entre o checkbox e a descrição,
      cabeçalho `Tag · Descrição · Tempo`. `curarPorDescricao` passou a devolver
      `{ chave, descricao, tag, segundos }` (era `{ chave, texto, segundos }`) —
      a descrição agora é **crua** (sem o antigo prefixo `(tag) …` nas linhas
      não-TEL). A **ordenação** (TEL primeiro, depois por tempo decrescente)
      **não mudou**; a seção "Por tag" **não** ganhou coluna Tag (a tag já é o
      conteúdo). O **console mantém** o prefixo `(tag) descrição` em
      `EscritorRelatorioConsole` (§2.4) — só o frontend mudou. O nome do
      usuário no `AccordionSummary` passou a `color: 'primary.main'` (mesmo
      token do `<Chip color="primary">` de "Total: …").
    - **Relatório — conversão para tabela** (2026-09-07, refinamento sobre o
      item acima): o corpo de cada `<Accordion>` (por usuário — esse
      agrupamento **fica**) deixou de ser `<List>`/linha corrida e virou **uma
      `<Table size="small">` única** (estilo compacto do Sprint/Gantt), **sem
      os títulos "Por descrição" / "Por tag"** e sem `<Divider>` entre elas.
      Colunas fixas `[checkbox] · Tag · Descrição · Tempo`; linhas = as
      agregadas por descrição primeiro, depois as por tag (Descrição vazia
      nessas), concatenadas na mesma tabela. **Célula sem valor fica vazia**
      (o `"—"` da coluna Tag saiu). "Em andamento" segue num bloco pequeno
      abaixo da tabela. `curadoria.ts` e ordenação/agrupamento **não mudaram**;
      seleção/tachado preservados. **Não há botão "Informações" no Relatório**
      (só no Sprint) — a doc dessa exibição fica no CLAUDE.md/README.
    - **Gant** (`GantView.tsx`): linhas mais compactas (`py` reduzido no head e
      a `0` nas células de dados e no cabeçalho de usuário); descrição
      **truncada em 50 caracteres** (helper `truncar()`, "…" ao exceder) com um
      `<Tooltip>` **sempre presente** mostrando a descrição completa.
29. **Auditoria de duplicação + refatoração de baixo risco** (2026-09-07):
    varredura dos 3 projetos (console, Web API, frontend) atrás de duplicação
    de configuração, lógica repetida e código morto. Duas listas reportadas
    (**baixo risco** / **alto risco**); **tudo de baixo risco foi aplicado**,
    o de alto risco só foi listado como dívida técnica (abaixo). Build C#
    (`dotnet build TogglReport.slnx -c Release`) e `npm run build` limpos (0
    warnings; bundle do front 69,1 → 64,6 kB); validado e2e por `curl` — a
    fórmula de capacidade do Sprint continua intacta (diasUteis=18, margem=37,
    td=89 no cenário de teste). **Nenhuma mudança visível ao usuário**, exceto
    uma correção de comportamento (abaixo).
    - **Backend — 6 itens.** Núcleo: `Configuracao/ServicoChaves.cs`
      (`GerarChaveUnica(nome, chavesExistentes, fallback)` — `ServicoUsuarios`/
      `ServicoSprints` delegam, fallbacks `"usuario"`/`"sprint"`; `NomeEmUso`
      **não** unificado, difere por tipo iterado + checagem de identidade
      `ignorar`); `Configuracao/DiasUteis.cs` (`Entre(inicio, fim) →
      IEnumerable<DateTime>` seg–sex inclusivo — `ServicoGant` faz
      `.Select(...).ToList()`, `ServicoSprint.ContarDiasUteis` faz `.Count()`,
      antes cada um tinha seu `for` com skip de sábado/domingo);
      `Configuracao/Agrupamento.cs` (`EhValido(valor)` — usado nos 3 endpoints
      de parâmetros); `AnalisadorIni` ganhou `Escrever` (`CreateDirectory` +
      `File.WriteAllText` UTF-8 sem BOM — usado pelos 6 carregadores) e
      `DividirLista` (split por vírgula `RemoveEmptyEntries|TrimEntries` — usado
      pelos 3 carregadores de lista). Web API: `Endpoints/ValidacaoDatas.cs`
      (`Tenta(...)` — `TryParse` + `fim < inicio` em 7 handlers; `GET /api/gant`
      fora, só tem `TryParse` por design) e `Endpoints/TratamentoIo.cs`
      (`Executar(acao, mensagemErro) → IResult?` — `null`/`Results.Problem 500`
      em `IOException`/`UnauthorizedAccessException`, em 9 sites; `DadosEndpoints`
      fora, o `try` de lá é mais complexo). **Correção de comportamento** (era
      inconsistência real): `PUT /api/gant/parametros` passou a validar
      `Agrupamento` e devolve `400 "Agrupamento deve ser 'descricao', 'tag' ou
      'ambos'."` como `PUT /api/configuracao` e `PUT /api/sprint/categorias` já
      faziam — ver §4.4/§4.6.
    - **Frontend — ~20 itens** (`src/components/`, `src/hooks/`, `src/utils/`
      novos, todos listados em §5.2; base compartilhada de hooks/forms em
      §5.3). `theme.ts` exporta `CORES` (era privado; `LoginScreen` usa
      `CORES.navbarFundo`). `UsuarioFormDialog` ganhou `COR_PADRAO_USUARIO`
      (literal 3×). `UsuariosPanel` perdeu props mortas `onVoltar`/`onContinuar`
      + rodapé (sobra de quando "Usuários" era passo de Stepper).
      `useNotificacao` perdeu um branch morto (`if (erro instanceof ErroApi)`
      redundante). **Regressão pega na validação manual**: a extração de
      `useExpansao` inicialmente perdeu o "recolapsar a cada nova consulta" —
      o hook só resetava quando o conjunto de chaves mudava, não quando os
      dados eram substituídos por um novo objeto. Corrigido com o parâmetro
      `gatilhoReset` (o objeto `relatorio`/`gant`), incluído nas deps do
      `useEffect` de reset.
    - **Análise — não aplicado (frontend)**: item 17 parcial — `useBusca`
      (assinatura divergente `buscando`/`buscar` + `limpar`); item 21 —
      `SprintsPanel` ≈ `UsuariosPanel` (uma abstração `PainelColecao` genérica
      seria quase toda encanamento — modelo de item, seleção via `Radio` só no
      Sprint, `FormDialog` incompatível —, risco de regressão em 2 telas
      centrais maior que o ganho; só o `CabecalhoView` foi extraído); item 28 —
      pares Request/Response DTO quase idênticos (`CategoriasSprintDto` ≡
      `AtualizarCategoriasSprintRequest` etc., convenção proposital de separar
      entrada/saída).
    - **Alto risco — listado, NÃO aplicado (dívida técnica / melhoria futura)**:
      **(A)** a orquestração cache-first (`carregar cache →
      CacheCorrespondeAosParametros → ConsultarUsuariosAsync → SalvarCache`)
      está copiada em `ConsultasEndpoints`, `GantEndpoints`,
      `SprintConsultasEndpoints` e no `Program.cs` do console
      (`ObterRegistrosAsync`) — `ServicoConsulta` centralizou as *peças* mas
      não o *fluxo* que as costura; unificar exigiria retestar os 4 fluxos
      (rate-limit 30 req/h, fallback de cache, gravação dos 3 arquivos de
      cache) e preservar o ponto de decisão console (pergunta interativa) vs
      API (flag `ForcarConsultaApi`). **(B)** a regra "detalhar por tag /
      agregar" (`switch` de `descricao`/`tag`/`ambos`) está em
      `ServicoAgrupamento`, `ServicoGant` e `ServicoSprint` com semântica
      sutilmente diferente — Gant/Sprint usam `registro.Tags[0]` como tag
      principal, `ServicoAgrupamento` usa `Tags.FirstOrDefault(t =>
      tagsDetalhadas.Contains(t))` (qualquer tag que bata), e o Gant ainda
      força detalhe quando há termo de busca; unificar precisa de decisão de
      produto sobre qual regra é a "certa". **(E)** a condicional "qual seção
      mostrar por agrupamento" existe em `RelatorioEndpoints.cs` (back) e
      `RelatorioUsuarioCard.tsx` (front) — é contrato de API, mudar os valores
      de `Agrupamento` exige tocar os dois lados. **Parece duplicação e não é**:
      os 2 regex de "TEL" (`ServicoAgrupamento.RegexTel` normaliza texto cru;
      `ServicoSprint.PadraoCodigo` separa código de string já normalizada) e
      `curadoria.ts` replicando `EscritorRelatorioConsole` de propósito
      (cross-language, simetria dado/exibição).
    - **Correções de doc desatualizada**: `Program.Versao` era `1.0.1.0` no
      código mas `1.0.0.0` no §2.1 — corrigido. Registrado o desvio de
      nomenclatura dos INI do Sprint (`TogglSprints.ini` /
      `TogglSprintCategorias.ini` / `TogglSprintData.ini` não seguem o padrão
      `Toggl<Dominio>Parametros.ini`/`Toggl<Dominio>Data.ini` do item 18 — não
      é bug, são arquivos novos, ver §8).

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
4 antigos acima) **mais `TogglUsuarios.ini`** (item 24 do histórico — arquivo
novo, não renomeação, então sem "nome antigo" equivalente) **mais os 3 do
Sprint** (`TogglSprints.ini`, `TogglSprintCategorias.ini`,
`TogglSprintData.ini` — item 27, também arquivos novos, sem "nome antigo"; o
`TogglSprintTarefas.ini` chegou a existir mas foi removido junto com o "manual
de tarefas" no "Ajuste posterior 7", e sua entrada saiu dos três ignore-files).
Todos esses quatro últimos entraram no `.gitignore` da raiz e no de
`toggl-report-back/`, e no `.dockerignore` de `toggl-report-back/`.

**Desvio de nomenclatura conhecido** (não é bug, só registro): os 3 INI do
Sprint (`TogglSprints.ini`/`TogglSprintCategorias.ini`/`TogglSprintData.ini`)
**não** seguem o padrão `Toggl<Dominio>Parametros.ini`/`Toggl<Dominio>Data.ini`
que o item 18 uniformizou para relatório e Gantt — são arquivos novos (item
27), nomeados no molde `TogglUsuarios.ini`/domínio, e `CaminhosDados` os
resolve com `Path.Combine` puro (sem `CaminhoComMigracao`).

`.env`/`!.env.example` (raiz, item 19 do histórico) foram adicionados junto
da correção da senha do certificado Kestrel — `docker-compose.yml` passou a
ler `KESTREL_CERT_PASSWORD` de um `.env` local em vez de ter o valor em
texto puro no arquivo versionado.

`/dados/` e `/certificado/` (raiz) são **ancorados** (`/` na frente) desde o
item 26 do histórico — sem a barra, o padrão batia em qualquer pasta com
esse nome na árvore inteira, o que silenciosamente ignorava arquivos novos
dentro de `toggl-report-front/src/features/dados/` (pasta de código-fonte
legítima) e quebrou um deploy. Os padrões de nome de arquivo bare
(`TogglRelatorioParametros.ini` e os demais logo abaixo) **não** têm esse
problema — não existe hoje nenhum arquivo de código-fonte com esses nomes
exatos —, mas o cuidado vale para qualquer padrão novo adicionado aqui que
seja também um nome plausível de pasta/arquivo dentro de `toggl-report-front/`
ou `toggl-report-back/`.

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
- Antes de duplicar uma checagem/loop de configuração, ver se há helper no
  núcleo (`ServicoChaves`, `DiasUteis`, `Agrupamento.EhValido`,
  `AnalisadorIni.Escrever`/`DividirLista`) ou em `Api/Endpoints/`
  (`ValidacaoDatas`, `TratamentoIo`) — extraídos pela auditoria de 2026-09-07
  (item 29).
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
- **Antes de duplicar um hook, componente ou helper, ver se há base
  compartilhada em `src/components/`, `src/hooks/` ou `src/utils/`** (item 29
  extraiu `useRecurso`/`useRecursoEditavel`/`useColecaoCrud`/
  `useConsultaGenerica`/`useExpansao`, `ParametrosFormBase`, `CampoTags`,
  `SelectAgrupamento`, `CabecalhoView`, `MarcaTogglReport`, `BadgeSigla`,
  `AvisoCache`, `EsqueletoCarregando`, `FONTE_MARCA` etc.) — os hooks de
  recurso e o form de Parâmetros já têm um núcleo comum, cada wrapper só
  adapta nomes de campo.
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
| Versão | `1.0.1.0` (`X.Y.Z.W`) | `1.0.3.0` (`X.Y.Z.W`) | Cada projeto tem a sua. |
| `Main` | `async Task Main()` | `void Main()` | toggl faz chamadas HTTP. |
| Camada de saída | `Relatorios/` (agrupamento, escritor de console, busca) | não há (só `ExibirChaves`) | toggl produz relatórios; o gerador só imprime chaves. |
| Integração externa | núcleo compartilhado (`ClienteApiToggl` + DTOs) | não há | só o toggl fala com uma API. |
| Descrição de exibição | `Rotulos.Agrupamento` (string de 3 valores, sem tipo) | `Uf.Descricao`/`TipoEmissao.Descricao`/`Competencia.Descrever` (tipos de domínio) | onde há tipo, o rótulo mora nele; onde não há, num helper. |
| Nomes de pastas | `Configuracao/` · `Toggl/` · `Relatorios/` (+ `Consultas/` no núcleo) | `Dominio/` · `Geracao/` · `Persistencia/` | domínios de tamanho diferente; ambos coerentes internamente. |
