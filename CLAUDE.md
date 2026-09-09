# CLAUDE.md

Memória de contexto persistente do repositório **toggl-report**. Serve para orientar
qualquer sessão futura sem precisar reexplicar as decisões já tomadas.

O repositório reúne **dois projetos independentes**:

- **`toggl-report-back/`** — dois projetos **C# / .NET 10** na mesma solução
  (`TogglReport.slnx`): uma Web API com autenticação HTTP Basic opcional que
  expõe as funcionalidades da aplicação (`TogglReport.Api`) e a biblioteca de
  núcleo que ela referencia (`TogglReport.Nucleo`). O console original
  (`TogglReport.Console`) existiu de 2026-09-02 a 2026-09-08 e foi **removido
  por completo** — ver §7, último item do histórico.
- **`toggl-report-front/`** — frontend **React 19 + TypeScript + MUI** (Vite)
  que consome a Web API numa interface gráfica.

Este arquivo cobre os dois. §3–§4 tratam do `toggl-report-back` (núcleo, API);
§5 trata do `toggl-report-front`; §6 em diante são transversais aos dois
(decisões, histórico, `.gitignore`, convenções, projeto irmão). A numeração
de seções pula de §1 para §3 de propósito — a antiga §2 (Console) foi removida
sem renumerar o restante, para preservar as dezenas de referências `§2.x` que
o histórico (§7) já continha antes da remoção.

---

## 1. Visão geral do repositório

Aplicação que gera relatórios de tempo trabalhado a partir da **API v9 do Toggl
Track**, agrupando por descrição e/ou tag, por usuário, em um período informado —
via uma **Web API** (`TogglReport.Api`) consumida por um **frontend web**
(`toggl-report-front`), com um **núcleo compartilhado** (`TogglReport.Nucleo`)
concentrando toda a lógica de negócio e o formato de persistência em INI.

- **Web API** (`toggl-report-back/TogglReport.Api`): expõe as funcionalidades
  da aplicação por HTTP, com autenticação HTTP Basic opcional (§4.8),
  documentada via Swagger, com sua própria pasta `dados/` (parâmetros do
  relatório em `dados/TogglRelatorioParametros.ini`, usuários/tokens em
  `dados/TogglUsuarios.ini` — compartilhado com o Gantt e o Sprint, ver §3).
- **Núcleo compartilhado** (`toggl-report-back/TogglReport.Nucleo`): modelos,
  acesso a INI, cliente HTTP do Toggl e as regras de agrupamento/busca/decisão
  de cache — referenciado pela Web API acima, nenhuma duplicação de lógica de
  negócio.
- **Frontend** (`toggl-report-front`): consome a Web API, com o fluxo
  parâmetros → usuários/tokens → consulta → relatório → busca.
- **Multiusuário**: cada usuário tem seu API Token pessoal; o relatório consolida
  todos.
- **Cache de consulta** (`dados/TogglRelatorioData.ini`, ao lado do executável
  da Web API): guarda o retorno cru da última consulta bem-sucedida de cada
  usuário. Se período e usuários da próxima consulta forem iguais, oferece
  carregar do cache (default) em vez de consultar a API de novo; o
  agrupamento/cálculo sempre roda em runtime sobre o dado, cacheado ou não —
  o cache nunca guarda resultado já processado. Também serve de reserva
  quando o limite de 30 requisições/hora por usuário é atingido (ver §3/§6).
- **Gráfico de Gantt** (Web API + frontend): segunda visualização dos mesmos
  dados, com parâmetros (período + tags a detalhar + agrupamento) e cache
  (`dados/TogglGantData.ini`) **próprios e independentes** dos do relatório —
  a mesma pessoa pode ter um relatório e um Gantt configurados com períodos
  diferentes ao mesmo tempo, e uma consulta não invalida a outra. Ver
  §4.6/§5.5.
- **Sprint** (Web API + frontend, igual ao Gantt): terceira visualização,
  agora com **gestão** (CRUD de sprints) além do acompanhamento. Cada sprint
  tem nome, horas/dia e período próprios (`dados/TogglSprints.ini`); há um
  mapeamento **global** TAG → categoria (`Dev`/`Rev`/`Qa`,
  `dados/TogglSprintCategorias.ini`); cache de consulta dedicado
  (`dados/TogglSprintData.ini`, mesmo formato do relatório/Gantt). A tela de
  acompanhamento calcula a **capacidade por colaborador** e monta um grid
  agrupado por descrição ou por tag (conforme o `Agrupamento` da etapa
  "Parâmetros", regra do `ServicoGant`), mesclando colaboradores que ocupam
  categorias (Dev/Rev/Qa) diferentes de uma mesma descrição/tag numa única
  linha — só abre linhas separadas quando dois colaboradores disputam a
  mesma categoria (ver §4.9). Prioridade e Situação são **valores fixos
  exibidos**
  ("Baixa" / "Pendente"), sem edição nem persistência ("sem integração por
  enquanto"). Molde do Gantt em todas as camadas. Ver §4.9/§5/§7.
- **Usuário ganhou três campos exclusivos da versão web** (`Sigla`, `Cor`,
  `Selecionado`) — persistidos no mesmo `TogglUsuarios.ini`, lidos/gravados
  pelo `CarregadorUsuariosIni` (ver §3). `Selecionado` decide quais usuários
  entram na **próxima consulta** (relatório, Gantt ou Sprint) — os demais nem
  chegam a ser considerados por `ServicoConsulta`.
- **Não há exportação para CSV** — os dados só existem no frontend e no
  cache.
- **Poucas dependências externas** — o núcleo não tem nenhum
  `PackageReference`; a Web API tem uma única dependência
  (`Swashbuckle.AspNetCore`, necessária para o Swagger).
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

## 3. Núcleo compartilhado (`toggl-report-back/TogglReport.Nucleo`)

Biblioteca de classes (`Microsoft.NET.Sdk`, sem `OutputType`) referenciada só
por `TogglReport.Api` via `ProjectReference` (até 2026-09-08 também era
referenciada pelo console, removido — ver §7). **Nunca** referencia
`Console.ForegroundColor` nem qualquer classe de apresentação (confirmado por
grep — regra a manter, mesmo não havendo mais um segundo consumidor). Contém
toda a lógica de negócio e o acesso a INI da aplicação.

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
 │   ├─ BlocoCategoriaSprint.cs    # record: BlocoCategoriaSprint(decimal PreHoras, long ReaSegundos, string? NomeExibicao, string? Sigla, string? Cor) — tempo previsto/realizado de uma categoria (Dev/Rev/Qa) + o colaborador daquele bloco (null = categoria vazia nessa linha; desde 2026-09-08, ver §7)
 │   ├─ LinhaTarefaSprint.cs       # record: Codigo + Descricao + Agrupada (true = linha agregada por tag) + 3 BlocoCategoriaSprint (Dev/Rev/Qa) — o colaborador não é mais 1:1 com a linha (saiu NomeExibicao/Sigla/Cor do nível da linha em 2026-09-08); uma linha pode mesclar até 3 colaboradores, um por bloco
 │   ├─ LinhaColaboradorSprint.cs  # record: NomeExibicao/Sigla/Cor/Td/SegundosRealizados/TarefasPendentes/TarefasConcluidas de um colaborador do sprint (Concluidas sempre 0)
 │   ├─ ResultadoSprint.cs         # record: Cabecalho + Linhas + Colaboradores
 │   └─ ServicoSprint.cs           # static, puro: Montar(sprint, usuariosSelecionados, resultadoConsulta, categorias) → ResultadoSprint (empacotamento guloso por (Chave, Agrupada) mesclando colaboradores de categorias diferentes numa linha — ver texto abaixo; tag-agg roteada p/ QA ou DEV por colaborador; grid ordenada por NumeroCodigo — nº extraído do Codigo, não string)
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
pela API) encapsula a mesma regra de exclusão que antes vivia só dentro do
escritor de relatório do console (removido — ver §7) — devolve a lista já
filtrada e ordenada por segundos decrescente.

`ServicoConsulta` é o ponto mais importante deste projeto: é o que evita que
os fluxos de relatório/Gantt/Sprint da Web API dupliquem a decisão "cache ou
API" e o uso do rate limiter. Cada consumidor decide **quando** chamar cada
método via um parâmetro de requisição (`forcarConsultaApi`) — mas a regra em
si (o que conta como "mesmo período/usuários", quando usar cache, como tratar
o rate limit) só existe aqui.

`Sprint/ServicoSprint.Montar` é o equivalente do `ServicoGant.Montar` para o
Sprint: função pura que recebe a sprint, os usuários selecionados, o
`ResultadoConsulta` (dado cru do cache/API) e o mapeamento de categorias, e
devolve um `ResultadoSprint` (cabeçalho com o cálculo de capacidade + uma
grid de tarefas). `ChaveAgrupamento` devolve `(string Chave, bool Agrupada)` —
linhas de descrição (`Agrupada == false`, `Codigo`/`Descricao` separados por
`SepararCodigo`, regex `^(TEL - \d+)(?: - (.+))?$`) e linhas agregadas por tag
(`Agrupada == true`, só com agrupamento `tag`/`ambos`), estas roteadas para
**um** grupo por colaborador — QA se o colaborador tem ≥ 1 apontamento no
sprint com tag ∈ `categorias.Qa`, senão DEV (REV nunca recebe tag-agg). **Não
há mais campos manuais** (prioridade/situação) — ver item 27, "Ajuste
posterior 7".

**Mesclagem de linhas por categoria** (2026-09-08, ver §7, último item): até
então, cada `(Chave, Agrupada)` produzia **uma `LinhaTarefaSprint` por
colaborador**, mesmo quando dois colaboradores diferentes só ocupavam
categorias diferentes da mesma descrição/tag (ex.: um só com tempo em Dev, o
outro só em Rev) — cada um virava sua própria linha, com os outros 2 blocos
zerados. Isso mudou para um **empacotamento guloso**: dentro de cada grupo
`(Chave, Agrupada)`, os colaboradores são processados na ordem de
`usuariosSelecionados` (ordem de cadastro); para cada um, `Montar` procura,
entre as linhas já abertas para aquele grupo, a primeira cujos slots
(Dev/Rev/Qa) que ele ocupa — onde tem `segundos > 0` — estejam **todos
livres**; se achar, ele entra nessa linha, preenchendo só os slots que ocupa
(sem sobrescrever os já preenchidos por outro colaborador); senão, abre uma
linha nova. Um colaborador sem tempo em nenhuma categoria sempre abre linha
própria (preserva o "–"/"Nenhuma" em todos os blocos). Efeito: colaboradores
em categorias diferentes da mesma descrição/tag **mesclam numa única linha**
(um por bloco); dois colaboradores na **mesma** categoria da mesma
descrição/tag continuam em linhas separadas (conflito, mesmo comportamento de
antes). Cada `BlocoCategoriaSprint` agora carrega seu próprio
`NomeExibicao`/`Sigla`/`Cor` (`null` quando o bloco está vazio); o desempate de
ordenação das linhas tag-agg trocou de "índice do colaborador da linha" para
`MenorIndiceColaborador` (o menor índice entre os colaboradores presentes nos
blocos preenchidos), já que uma linha pode ter mais de um colaborador agora.
A grid é ordenada pelo **número do código** (`ServicoSprint.NumeroCodigo`
extrai os dígitos de `Codigo` — `.ThenBy(t => t.Agrupada ? 0 :
NumeroCodigo(t.Codigo))` antes do desempate por string): `TEL - 994 →
TEL - 1000 → TEL - 1118` (antes era ordenação por string, e `TEL - 1118` vinha
antes de `TEL - 994`); linhas de descrição por nº crescente de código, as sem
código depois, tag-agg por último na ordem de `MenorIndiceColaborador`. Só na
Web API + frontend. O cálculo de capacidade e o formato da tela estão em
§4.9.

### Detalhes de domínio importantes

Regras que valem tanto para quem lê/grava os `.ini` quanto para a Web API que
os consome (até 2026-09-08 também valiam para o console, removido — ver §7):

- **`RegistroTempoDto.Duracao`** (segundos): **valor negativo = timer em
  execução** — isolado por `ServicoAgrupamento.ObterEmAndamento`, fora dos
  totais.
- **`RegistroTempoDto.Tags`**: já resolvidas como nomes pela API do Toggl.
- Rótulos: `(sem descrição)`, `(sem tag)`.
- **Chave do usuário no INI** (`[Usuario:<chave>]`): `nome` só com letras/dígitos,
  minúsculo, sufixo numérico em colisão (`ServicoUsuarios.GerarChaveUnica`).
  `NomeExibicao` é o rótulo dos relatórios.
- **Agrupamento** (interno e no INI): `descricao`, `tag`, `ambos`.
- **`ConfiguracaoApp.TagsDetalhadas`**: lista livre de tags (comparação
  `OrdinalIgnoreCase`); persistida como `TagsDetalhadas=tag1,tag2` no INI (vazia
  = `TagsDetalhadas=`). Com agrupamento "ambos": essas tags aparecem
  detalhadas em "Por descrição" e ficam totalmente fora de "Por tag"; as
  demais tags não aparecem em "Por descrição", só em "Por tag" (nome do campo
  mantido por compatibilidade com o INI).
- **"Por descrição" filtra por `TagsDetalhadas`**: com agrupamento "ambos", só
  entram entradas com pelo menos uma tag em `TagsDetalhadas` (as demais só
  contam no total de "Por tag"); com agrupamento "descricao" puro, entram
  todas (não há "Por tag" para compensar) — regra em
  `ServicoAgrupamento.AgruparPorDescricaoComTag`, consumida por
  `RelatorioEndpoints` (`GET /api/relatorio`). A **ordenação por prefixo
  "TEL"** (TEL primeiro, depois por tempo decrescente) não é feita no
  back-end — é aplicada só na exibição, pelo frontend (`curarPorDescricao`,
  ver §5.3).
- **Descrições "TEL" normalizadas já na chave de agrupamento**: "TEL-0000-AA" /
  "TEL-0000 - AA" / "TEL - 0000 - AA" viram sempre `"TEL - 0000 - AA"` antes de
  somar os tempos — não só na exibição
  (`ServicoAgrupamento.NormalizarDescricaoTel`/`ChaveDescricao`). Só reformata
  quando há dígitos logo após "TEL"; não mexe em "TELA", "TELEFONE" etc.
- **Usuários vivem num arquivo próprio, `TogglUsuarios.ini`, separado dos
  parâmetros do relatório desde 2026-09-07** (`CarregadorUsuariosIni.cs` — só
  as seções `[Usuario:<chave>]`, nada de `[Geral]`).
  `CarregadorConfiguracaoIni.Carregar(caminho, caminhoUsuarios)`/
  `.Salvar(caminho, caminhoUsuarios, configuracao)` delegam a leitura/escrita
  de `configuracao.Usuarios` para `CarregadorUsuariosIni` — o modelo em
  memória (`ConfiguracaoApp.Usuarios`) não muda, só onde ele é persistido.
  **Migração automática, sem intervenção manual**: se `TogglUsuarios.ini`
  ainda não existe mas o arquivo de parâmetros informado tem seções
  `[Usuario:*]` (formato anterior a 2026-09-07), `CarregadorUsuariosIni.
  Carregar` extrai e grava essas seções no novo arquivo na primeira leitura —
  mesmo espírito da migração silenciosa de nome de arquivo do item 18, mas
  aqui é uma migração de **conteúdo** entre dois arquivos, não uma
  renomeação. O arquivo de parâmetros perde as seções `[Usuario:*]` (que
  ficam só como legado, até a migração rodar) na primeira vez que for salvo
  depois disso, já que `Salvar` não as escreve mais ali.
- **`ConfiguracaoUsuario` tem três campos exclusivos da versão web**: `Sigla`
  (string curta, usada como rótulo nas células do Gantt), `Cor` (hex, cor de
  fundo dessas células) e `Selecionado` (`bool`, default `true` — decide se o
  usuário entra na próxima consulta). Persistidos como `Sigla=`/`Cor=`/
  `Selecionado=` na seção `[Usuario:<chave>]` de `TogglUsuarios.ini`, lidos
  com `AnalisadorIni.ObterOuPadrao` (`Selecionado` via `bool.TryParse`,
  default `true` se ausente ou inválido — usuários criados antes desse campo
  existir continuam selecionados). `CarregadorUsuariosIni.Salvar` grava os
  três campos sempre. `ServicoUsuarios.SiglaEmUso` (mesmo padrão de
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
  (`TogglRelatorioData.ini`/`TogglGantData.ini`). Valor gravado com prefixo
  `enc:`; ao ler, se não tiver esse prefixo, trata como texto puro (arquivo
  de antes desta mudança) — migra sozinho pra criptografado no próximo
  `Salvar`, mesmo padrão de migração silenciosa já usado pra renomear
  arquivo (§7, item 18).
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
  ativo e trata o limite que a própria API do Toggl impõe).
- **Erros da API do Toggl não usam exceptions**: `ClienteApiToggl` devolve
  `ResultadoApiToggl<T>` (`Ok`/`Falha`) — 401 vira `Falha` e o consumidor
  (hoje, os endpoints da Api) reporta e pula o usuário, sem abortar a
  consulta inteira; 429 espera `Retry-After` (fallback 5 s) e tenta **uma
  vez** a mais antes de desistir; rede/HTTP não-2xx/JSON inválido também
  viram `Falha` com mensagem.

### `TogglRelatorioParametros.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

```ini
[Geral]
DataInicioAnterior=2026-08-01
DataFimAnterior=2026-08-31
AgrupamentoPadrao=ambos
TagsDetalhadas=Cliente X,Urgente
```

### `TogglUsuarios.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

Compartilhado pelo relatório, pelo Gantt e pelo Sprint (§4.6/§4.9) — não tem
`[Geral]`, só seções `[Usuario:<chave>]`:

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

`AppContext.BaseDirectory` é o diretório do **executável que está rodando** —
hoje só a Web API tem essa pasta `dados/` própria (o console, que também
tinha a sua, foi removido — ver §7).

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
CaminhoCache(AppContext.BaseDirectory)`, o helper do núcleo (§3), com o
`AppContext.BaseDirectory` da própria API.

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
respectivamente, `descricao`/`tag` — senão vêm `[]`/`{}`. **`emAndamento` está em snake_case** (`workspace_id`, `project_id`,
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
Não reordena/normaliza "TEL" — busca opera sobre o texto cru da descrição.

### 4.3 Decisões de arquitetura desta camada

| Decisão | Motivo |
|---|---|
| **Minimal APIs, não Controllers** | Projeto pequeno e focado (12 rotas); evita o boilerplate de MVC. Um arquivo `Map*Endpoints` por grupo em `Endpoints/`. |
| **Stateless entre requisições — nunca mantém registros em memória entre chamadas** | Toda leitura de relatório/busca **relê `TogglRelatorioData.ini`** via `CarregadorCacheIni`/`ServicoConsulta.CarregarRegistrosDoCache`. Isso evita sessão/estado de servidor sem precisar inventar um mecanismo novo. |
| **`GET /api/relatorio`/`GET /api/busca` exigem cache prévio (409 se não bate)** | Em vez de disparar uma consulta implícita, força o cliente (frontend) a chamar `POST /api/consultas` primeiro — mantém explícito quando uma requisição HTTP externa acontece, essencial para respeitar o rate limit. |
| **`PUT /api/configuracao` recarrega a config antes de sobrescrever** | Preserva `Usuarios` (gerido por endpoints próprios) mesmo que o payload do PUT não os inclua. |
| **`ignorarValidacao` em vez de uma pergunta interativa** | Não há como fazer uma pergunta de sim/não em uma chamada HTTP síncrona (o console, quando existia, perguntava "salvar assim mesmo?"); o cliente decide de antemão e sinaliza via flag. |
| **CORS liberado (`AllowAnyOrigin/Header/Method`)** | Uso exclusivamente local; o frontend roda em outra porta (Vite) e precisa chamar sem bloqueio. Não apropriado se a API algum dia for exposta fora de `localhost`. |
| **`JsonStringEnumConverter` global** (`ConfigureHttpJsonOptions`) | Sem isso, `StatusConsultaUsuario` seria serializado como número (`0`/`1`/...); com o conversor, `"Sucesso"`/`"Erro"`/etc. — mais legível no Swagger e no frontend. |
| **`Swashbuckle.AspNetCore`** | Única dependência NuGet do repositório; o pacote `Microsoft.OpenApi` que ele traz (v2.x) usa o namespace `Microsoft.OpenApi.OpenApiInfo` (sem `.Models` — mudou entre versões do OpenApi.NET; atenção ao atualizar o pacote). |
| **Porta fixa 5180** (`launchSettings.json`) | O frontend precisa de uma URL conhecida sem configuração adicional. |
| **`dados/` própria, ao lado do executável** | Simplicidade: a Api só enxerga o `AppContext.BaseDirectory` de si mesma via `CaminhosDados` (§3). |

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
  usado pelos carregadores do núcleo (`AnalisadorIni.Escrever`), mas aqui vira
  erro de resposta (não há como "avisar e seguir" numa requisição síncrona
  que precisava do resultado salvo); mesmo tratamento em
  `POST /api/dados/restaurar` desde o item 25 (antes subia como exceção não
  tratada).

### 4.5 Limitações conhecidas desta camada

- CORS `AllowAny` — adequado só para uso local; não usar essa configuração se
  a API for exposta além de `localhost`.
- Sem autenticação **se `AUTH:USUARIO`/`AUTH:SENHA` não estiverem
  configurados** (default) — qualquer processo com acesso à rede pode chamar
  a API. Ver §4.8 para ligar a autenticação; os tokens em `dados/*.ini` já
  ficam criptografados em repouso independente disso (ver §3).
- Enum documentado no Swagger pode aparecer como inteiro no schema (a
  anotação `[SwaggerDoc]` não propaga automaticamente o
  `JsonStringEnumConverter` para a geração de schema do Swashbuckle) — a
  serialização real da resposta, porém, é sempre string (verificado).
- Mesmas limitações de fundo do núcleo: sem paginação, sem nome de
  projeto/cliente, rate limit só em memória por processo.
- `TogglRelatorioParametros.ini`, `TogglRelatorioData.ini` e
  `TogglUsuarios.ini` guardam dado sensível — o `TokenApi` é criptografado em
  repouso (§3), mas os três são tratados como segredo mesmo assim (todos no
  `.gitignore`, ver §8), dentro de `dados/` ao lado do executável.

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
do Gantt em todas as camadas — só na Web API + frontend. Diferente do
relatório e do Gantt, o Sprint tem **gestão** (CRUD de
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

> As cores de status do Sprint são consts **definidas uma vez** no topo de
> `SprintView.tsx`: `const COR_PENDENTE = CORES.corPendente`,
> `const COR_CONCLUIDO = CORES.corConcluido`, `const COR_TAG = CORES.corTag`.
> **Desde 2026-09-08** (ver §7, último item) essas três cores viraram tokens
> do tema — `theme.ts` ganhou `CORES.corPendente = '#EA4335'` (vermelho),
> `CORES.corConcluido = '#34A853'` (verde) e `CORES.corTag = '#F57C00'`
> (laranja) — em vez de literais hex soltos no `SprintView.tsx`; os valores
> não mudaram, só a origem. Usadas no card, na coluna "Disponível" negativa,
> nas colunas Pendentes/Concluídas da tabela de colaboradores, nas etiquetas
> fixas de Prioridade/Situação do grid (`EtiquetaFixa`) e no badge de
> Prioridade (`BadgeTexto`). Confirmado por grep: nenhuma cor hex solta sobra
> fora de `theme.ts` em todo `src/` do frontend (o mesmo vale para
> `COR_PADRAO_USUARIO` de `UsuarioFormDialog.tsx`, que passou a apontar para
> `CORES.accentAzul`). Ao lado dessas consts há também
> `const LARGURA_CELULA = '2.5rem'` — a largura comum das colunas PRE, REA e
> badge de cada grupo DEV/REV/QA.

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
    `COR_CONCLUIDO`**, **< 0** vermelho `COR_PENDENTE` com `-`, `0` neutro) ·
    Pendentes · Concluídas**; **desde 2026-09-08** (ver §7, último item) as
    três colunas **Disponível, Pendentes e Concluídas** ficam **sempre em
    negrito** (`fontWeight: 700`), mesmo quando o valor é neutro/zero — antes
    "Disponível" só tinha negrito quando positiva/negativa, e
    Pendentes/Concluídas nunca tinham negrito; a cor condicional não mudou.
    Rodapé soma só Pendentes e Concluídas; sem colunas por dia. A 2ª coluna
    usa o **mesmo componente `BadgeSigla`** que o grid de tarefas (extraído,
    não duplicado — ver abaixo).
- **Grid de tarefas** (`List<LinhaTarefaSprint> Linhas`), montada por
  `ServicoSprint.Montar` (sem parâmetro `manuais`).
  `record LinhaTarefaSprint(string Codigo, string Descricao, bool Agrupada,
  BlocoCategoriaSprint Dev, BlocoCategoriaSprint Rev, BlocoCategoriaSprint Qa)`;
  `record BlocoCategoriaSprint(decimal PreHoras, long ReaSegundos, string?
  NomeExibicao, string? Sigla, string? Cor)`. **Desde 2026-09-08** (ver §7,
  último item) o colaborador saiu do nível da linha e passou para cada
  bloco — uma linha pode **mesclar até 3 colaboradores**, um por bloco
  DEV/REV/QA, em vez de sempre uma linha por colaborador (ver o algoritmo de
  empacotamento em §3). `ServicoSprint.ChaveAgrupamento(registro, categorias)`
  devolve `(string Chave, bool Agrupada)`.
  - **Linha de descrição** (`Agrupada == false`): por `(descrição normalizada
    "TEL")`, mesclando colaboradores de categorias diferentes numa linha só
    (§3). `Codigo`/`Descricao` vêm de `SepararCodigo` — regex
    `^(TEL - \d+)(?: - (.+))?$` → `Codigo = "TEL - 0000"`, `Descricao` = o
    resto; **sem casar** → `Codigo = ""`, `Descricao` = o texto inteiro. O
    `ReaSegundos` de cada grupo DEV/REV/QA = tempo **do colaborador daquele
    bloco** nessa descrição cujas tags ∈ `categorias.Dev`/`Rev`/`Qa`
    (`OrdinalIgnoreCase`; tag em mais de uma lista conta em cada).
  - **Linha tag-agg** (`Agrupada == true`, só quando `agrupamento` = `tag` ou
    `ambos` e a tag não está em `TagsDetalhadas`): por `(tag)`, mesma
    mesclagem. `Codigo = ""`, `Descricao` = nome da tag. **Todo** o tempo de
    cada colaborador naquela tag vai para **um único** grupo: **QA** se esse
    colaborador tem ≥ 1 apontamento no sprint com tag ∈ `categorias.Qa`
    (pré-passo `colaboradoresComQa`), senão **DEV**. **REV nunca recebe
    tag-agg.**
  - **Ordenação** (por **número do código**, não string — antes era bug:
    `TEL - 1118` vinha antes de `TEL - 994`): linhas de descrição primeiro (as
    com `Codigo` antes das sem; depois por `NumeroCodigo(Codigo)` crescente —
    helper que extrai só os dígitos de `Codigo` —, depois desempate por
    `Codigo`/`Descricao` string), então as tag-agg (pelo **menor índice entre
    os colaboradores presentes nos blocos preenchidos da linha** —
    `MenorIndiceColaborador`, trocado de "índice do colaborador da linha" em
    2026-09-08 porque uma linha pode ter mais de um colaborador desde a
    mesclagem —, depois por `Descricao`). Resultado:
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
      `codigo∙descricao∙índice-de-ocorrência`, montado por `idLinhaTarefa`) e
      sobrevive a fechar a janela. **Desde 2026-09-08** (ver §7, último item)
      o id trocou o 3º componente de `nomeExibicao` para um **índice de
      ocorrência** daquela `(codigo, descricao)` na lista completa de
      tarefas — a mesclagem de linhas por categoria (§3) tira o "um
      colaborador por linha" que o id antigo assumia; o índice é calculado
      sobre `resultado.tarefas` completo (não a lista filtrada pela busca),
      para não mudar quando a busca liga/desliga. **A marcação é isolada por sprint**: a
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
    - **Código e Descrição em vermelho nas linhas duplicadas por colisão de
      posição** (2026-09-08, ver §7, item 31; Descrição estendida em
      2026-09-09): quando a mesclagem gulosa de `ServicoSprint.Montar` (§3)
      abre **mais de uma linha** para a mesma `(codigo, descricao)` porque
      dois colaboradores disputam a **mesma** posição DEV/REV/QA, o texto das
      colunas **Código e Descrição** dessas linhas fica em `CORES.corPendente`
      (`#EA4335`, o mesmo vermelho de "Pendentes") + `fontWeight: 700` —
      **mesma condição (`codigoDuplicado`) e mesmo token de cor** nas duas
      colunas, sem lógica duplicada; só a coluna Código tem o `<Tooltip>`
      explicando o motivo (a Descrição mantém seu próprio `<Tooltip>` com o
      texto completo). Na Descrição, quando a linha também está **tachada**
      (checkbox marcado), o `line-through`/`text.disabled` do tachado é
      aplicado primeiro e a cor de duplicidade por cima — a linha fica riscada
      e vermelha ao mesmo tempo. Detecção em `calcularColisaoPosicao(tarefas)`
      (`features/sprint/calculos.ts`, função pura): agrupa as linhas por
      `codigo∙descricao∙agrupada` e marca **todas** as linhas de um grupo em
      que alguma posição (`dev`/`rev`/`qa`) tenha `nomeExibicao` preenchido em
      ≥ 2 linhas. Linha extra **vazia** (colaborador sem categoria) **não**
      conta como colisão. Só apresentação — a mesclagem, a ordenação e o
      cálculo de capacidade não mudaram.
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
      **`BadgeSigla`** — a sigla do colaborador **daquele bloco** (`linha.dev`/
      `.rev`/`.qa`, cada um com seu próprio `nomeExibicao`/`sigla`/`cor` desde
      a mesclagem de 2026-09-08 — antes lia da linha inteira), fundo na **cor
      dele**, cantos retos (`borderRadius: 0`, Montserrat, uppercase),
      `Tooltip` com o nome. Só aparece no(s) grupo(s) com `reaSegundos > 0`;
      nos grupos sem tempo aparece **"–"** em preto. É o **mesmo componente**
      usado na coluna de sigla do card de colaboradores.
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
(ver §5.3) — com o fluxo parâmetros → consulta → relatório → busca por
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
Disponível · Pendentes · Concluídas, com rodapé de totais) e um **grid** de
tarefas — uma linha por descrição/tag, **mesclando colaboradores diferentes
numa mesma linha quando ocupam categorias diferentes** (ver §4.9/§7, último
item) — colunas **Prioridade · Situação · Código · Descrição** + grupos
DEV/REV/QA (`PRE · REA · badge de sigla · Sit.`).
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
console — então ainda existente — a replicar). Revisado manualmente após:
tipos em `src/api/tipos.ts` conferidos contra os DTOs/records C# do back-end;
lógica de ordenação "TEL primeiro" (`src/features/relatorio/curadoria.ts`)
conferida contra o escritor de relatório do console da época (removido em
2026-09-08 junto com o console inteiro, ver §7 — a regra sobrevive só no
frontend, ver §3); `npx tsc -b` e `npm run build` rodados e confirmados
limpos por mim, não só reportados pelo subagente.

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
 │   ├─ sprint/             # SprintsPanel.tsx (listagem + seleção de 1 sprint — passo 1 do Stepper), SprintFormDialog.tsx (cadastro/edição em modal, molde UsuarioFormDialog), CategoriasSprintPanel.tsx (etapa "Parâmetros" — passo 2 do Stepper: agrupamento + tags para detalhar por descrição (padrão de ParametrosForm/ParametrosGantForm) + 3 Autocomplete DEV/REV/QA, rodapé Voltar / Continuar / Salvar e continuar — os dois de avanço bloqueados até DEV+REV+QA terem TAG), SprintView.tsx (acompanhamento — card do sprint em linha única com destaques Pendentes/Concluído/Capacidade, card de colaboradores (nome completo · BadgeSigla · Tempo por colaborador · Realizado · Disponível · Pendentes · Concluídas, as 3 últimas sempre em negrito desde 2026-09-08 + rodapé de somas), grid com uma linha por descrição/tag — mesclando colaboradores que ocupam categorias Dev/Rev/Qa diferentes numa mesma linha desde 2026-09-08, ver §4.9 —, rolagem horizontal, linhas divisórias entre todas as colunas + colunas compactadas (Descrição absorve o resto), 1ª coluna de checkbox que risca a descrição e persiste em localStorage (via tachados.ts), colunas Prioridade (badge BadgeTexto verde "Baixa" / laranja "Tag") · Situação (EtiquetaFixa; "Pendente" / "Tag" laranja / "–"/"Nenhuma" nos grupos vazios) · Código · Descrição + grupos DEV/REV/QA (PRE/REA hora resumida + Tooltip, BadgeSigla lendo o colaborador do bloco), botão "Buscar por descrição" (filtro local client-side por Código+Descrição, só a grid, sem consulta/sem view nova) antes do botão "Informações" → modal de cálculo; BadgeSigla, BadgeTexto e EtiquetaFixa são componentes locais reusados; padding da coluna Descrição igualado (px: 0.5), campos do card em h6/primary.main, cores de status (COR_PENDENTE/COR_CONCLUIDO/COR_TAG) lidas de CORES no theme.ts desde 2026-09-08), tachados.ts (lerTachados/gravarTachados/limparTachados/idLinhaTarefa — id agora usa um índice de ocorrência de (codigo, descricao) em vez do nomeExibicao, já que uma linha pode ter vários colaboradores — único uso de localStorage no projeto, tudo em try/catch) + useSprints.ts/useCategoriasSprint.ts/useConsultaSprint.ts/useSprint.ts
 │   └─ dados/              # RodapeDownloads.tsx (rodapé: versão do app + botões "Baixar dados (.zip)" e "Importar dados (.zip)" lado a lado — o de importar abre o ImportarDadosDialog em modo "reimportação" e recarrega a página no fim), ImportarDadosDialog.tsx (upload do .zip via POST /api/dados/restaurar; props opcionais titulo/descricao/rotuloCancelar — defaults = fluxo "nenhum usuário cadastrado" disparado 1×/sessão pelo App.tsx; o RodapeDownloads passa textos de "reimportação sobre dados existentes")
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
 ├─ features/sprint/calculos.ts               # (2026-09-07) formatarHoraResumida / contarDigitos / formatarCodigo / formatarDisponivel — eram locais no SprintView; + calcularColisaoPosicao (2026-09-08) → boolean[] paralelo a tarefas, true nas linhas cujo código deve ficar vermelho (colisão de posição DEV/REV/QA na mesma descrição)
 ├─ theme.ts                 # tema MUI único (claro) — CORES agora exportado (era const privado) — ver §5.5
 └─ App.tsx                  # Tabs "Usuários" (padrão)/"Relatório"/"Gant"/"Sprint"; Relatório e Gant com Stepper de 3 passos, Sprint com Stepper de 4 passos. Modo = 'usuarios'|'relatorio'|'gant'|'sprint'; ETAPAS_SPRINT = ['Sprints','Parâmetros','Consultar','Acompanhamento']; estados etapaSprintAtiva/sprintSelecionado/consultaSprintConcluida/etapaSprintLiberada + parametrosSprint (config { dev, rev, qa, agrupamento, tagsDetalhadas } elevada de CategoriasSprintPanel via onAvancar, junto de configuracao/configuracaoGant; passos 2/3 do Stepper do Sprint só liberam com parametrosSprint !== null; também passado como prop categorias para o ConsultaPanel e o SprintView do Sprint; o onConcluida do ConsultaPanel do Sprint chama limparTachados(sprintSelecionado.chave) quando resposta.veioDoCache === false)
```

### 5.3 Decisões técnicas

- **Wizard (`Stepper`) em vez de React Router**: o fluxo é sequencial —
  cada etapa só é liberada quando a anterior já produziu o que ela
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
  (`features/relatorio/curadoria.ts`) aplica a **ordenação** TEL primeiro,
  depois por segundos decrescente, só para exibição, sem alterar os dados
  recebidos — regra em `ServicoAgrupamento.NormalizarDescricaoTel` (dado,
  §3) e replicada aqui (exibição), simetria que existia com o
  `EscritorRelatorioConsole` do console (removido em 2026-09-08, ver §7) e
  hoje só sobrevive nesta cópia do frontend. **Desde 2026-09-07** (item 28)
  `curarPorDescricao` devolve `{ chave, descricao, tag, segundos }` (era
  `{ chave, texto, segundos }`): a descrição vai **crua** (sem o antigo
  prefixo `(tag) …` nas linhas não-TEL) e a tag numa **coluna própria** na
  view.
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
  `OfereceRestaurarBackupSeNecessario` que o console (removido, ver §7) tinha,
  que também só verificava uma vez, antes do laço principal. Duas opções: escolher um `.zip`
  e importar, ou "Seguir sem importar" (fecha e segue pelo cadastro manual
  já existente). Upload via `http.postArquivo` (novo método em
  `src/api/http.ts`, `dadosApi.ts` → `restaurarDados`) — `FormData` +
  `fetch` próprio, porque o resto do wrapper (`http.get/post/put/delete`)
  sempre serializa o corpo como JSON; mesma lógica de credencial/401 dos
  demais métodos. **Desde 2026-09-08** o diálogo aceita props opcionais
  `titulo`/`descricao`/`rotuloCancelar` (defaults = o fluxo acima) e é
  **reaproveitado pelo `RodapeDownloads`** para reimportar dados **mesmo com
  a pasta `dados/` já populada** (botão "Importar dados (.zip)" ao lado do
  "Baixar dados (.zip)"). O endpoint `POST /api/dados/restaurar` **não
  mudou** — `ZipArchive.ExtractToDirectory(overwriteFiles: true)` sobrescreve
  só os arquivos presentes no `.zip` (os demais, inclusive os 3 caches de
  consulta, ficam intactos), e nenhuma invalidação de cache está atrelada à
  importação (`ServicoConsulta.CacheCorrespondeAosParametros` valida
  período/usuários em tempo de consulta — cache divergente só dispara nova
  consulta ou 409, nunca corrompe). Após a reimportação o `RodapeDownloads`
  chama `window.location.reload()` para o estado em memória (steppers, configs
  carregadas) refletir os arquivos novos.
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
  `COR_PENDENTE`/`COR_CONCLUIDO`, definidas uma vez no topo de
  `SprintView.tsx` — **desde 2026-09-08** apontando para `CORES.corPendente`/
  `CORES.corConcluido` em `theme.ts` (`'#EA4335'`/`'#34A853'`), não mais
  literais hex soltos —, Capacidade em `primary.main`; "Capacidade" era "CT"
  — só o rótulo mudou, valor `cabecalho.ct` intacto); seção **"Colaboradores"**
  (só se `colaboradores.length > 0`, entre o card e o grid) como
  `<Table size="small">` com `<TableFooter>` — colunas **Colab.** (nome
  completo `nomeExibicao`, texto simples) **· (sigla)** (2ª coluna sem título,
  `<Box>` quadrado `borderRadius: 0`, fundo na cor do usuário, texto branco,
  fallback cinza — este `<Box>` é o componente **`BadgeSigla`**, o mesmo do
  grid) **· Tempo por colaborador** (`${td} h`, ex-"Total"/"TD") **· Realizado**
  (`formatarDuracao`) **· Disponível** (Tempo por colaborador − Realizado, `HHhMMmSSs`,
  **derivada no front** — sem campo/DTO novo; **> 0** → verde `COR_CONCLUIDO`,
  **< 0** → `COR_PENDENTE` com prefixo `-`, `0` neutro)
  **· Pendentes · Concluídas** (texto em
  `COR_PENDENTE` / `COR_CONCLUIDO` quando `> 0`, na linha e no rodapé — como
  `TarefasConcluidas` agora é sempre 0, a coluna "Concluídas" fica zerada).
  **Desde 2026-09-08** as três colunas **Disponível, Pendentes e Concluídas**
  ficam **sempre em negrito** (`fontWeight: 700`), mesmo neutras/zeradas —
  antes só "Disponível" tinha negrito condicional e as outras duas nunca
  tinham. Rodapé "Total" somando só Pendentes e Concluídas, sem colunas por
  dia; o **grid tem uma linha por descrição/tag** — **desde 2026-09-08**,
  quando colaboradores diferentes ocupam categorias (Dev/Rev/Qa) diferentes
  da mesma descrição/tag, eles **mesclam numa única linha** (um por bloco);
  só continuam em linhas separadas quando dois colaboradores disputam a
  **mesma** categoria (ver o algoritmo em §3) — dentro de um
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
    `idLinhaTarefa(codigo, descricao, índiceDeOcorrencia)` =
    `codigo∙descricao∙índice-de-ocorrência` — **desde 2026-09-08** o 3º
    componente trocou de `nomeExibicao` para um índice de ocorrência de
    `(codigo, descricao)` na lista completa de tarefas, já que a mesclagem de
    linhas por categoria tira o "um colaborador por linha" que o id antigo
    assumia). **Reset só em consulta real à API**:
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
    **Código e Descrição em vermelho** (`CORES.corPendente` + `fontWeight: 700`,
    mesma condição `codigoDuplicado` e mesmo token nas duas colunas — só o
    Código tem Tooltip explicando o motivo) quando a linha é uma das
    **duplicadas por colisão de posição** — a mesma `(codigo, descricao)`
    aberta em > 1 linha porque 2 colaboradores disputam a mesma posição
    DEV/REV/QA (`calcularColisaoPosicao`, `calculos.ts`); linha extra só vazia
    não conta. Ver §4.9 / §7 (2026-09-08, Descrição estendida em 2026-09-09).
  - **PRE / REA** = largura do badge (`LARGURA_CELULA = '2.5rem'`),
    centralizados, valor no formato **`00h`** (2 dígitos, `padStart`, sem
    "m"/"s") com `<Tooltip>` do `formatarDuracao` completo; PRE sempre `00h`.
    O cabeçalho de PRE/REA tem `<Tooltip>` de título ("Tempo previsto" /
    "Tempo realizado"). **REA com `reaSegundos > 0`** fica na cor
    `primary.main` (a mesma da "Capacidade") + `fontWeight: 600`; REA zero na
    cor padrão.
  - **badge** = **`BadgeSigla`** (sigla do colaborador **daquele bloco** —
    `linha.dev`/`.rev`/`.qa`, cada um com seu próprio `nomeExibicao`/`sigla`/
    `cor` desde a mesclagem de 2026-09-08 —, fundo na cor dele,
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
**O projeto console (`TogglReport.Console`) em si foi removido do repositório
em 2026-09-08** (ver §7, último item) — esta seção fica só como registro
histórico de decisões tomadas quando ele ainda existia; não reflete mais o
estado atual do código.

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
30. **Remoção completa do console, mesclagem de linhas do Sprint por
    categoria, negrito na tabela de colaboradores e centralização das cores
    hardcoded do Sprint no tema** (2026-09-08, 4 mudanças independentes na
    mesma rodada):
    - **(a) Remoção do console**: a pasta `toggl-report-back/TogglReport.Console/`
      foi apagada por inteiro — `Program.cs`, `Apresentacao/` inteira
      (`Paleta`/`Tela`/`Prompt`/`Rotulos`/`AssistenteConfiguracao`/
      `MenuTokenUsuario`), `Relatorios/` do console
      (`EscritorRelatorioConsole`/`EscritorBuscaDescricao`), o `.csproj` e o
      `icon.ico`. `toggl-report-back/TogglReport.slnx` passou a referenciar só
      `TogglReport.Nucleo` e `TogglReport.Api` (2 projetos, não mais 3) — o
      repositório passou a ter, na prática, só Web API + frontend por trás de
      um núcleo compartilhado; "console" deixou de ser uma interface do
      sistema. `dotnet build TogglReport.slnx` confirmado limpo (0 warnings)
      só com Nucleo+Api. As regras de domínio que só estavam documentadas na
      antiga §2.4 (chave do usuário, `TagsDetalhadas`, normalização "TEL",
      `TogglUsuarios.ini`, criptografia de token, cache indexado por `Chave`,
      rate limit por processo) foram preservadas e movidas para dentro de §3,
      já que continuam válidas para o núcleo/API — nada de lógica foi
      perdido, só a camada de apresentação de terminal. Os 3 READMEs
      (`/README.md`, `toggl-report-back/README.md`,
      `toggl-report-front/README.md`) foram atualizados na mesma rodada para
      remover as referências ao console (`toggl-report-infra/README.md` não
      foi tocado — as menções lá são ao Console do GCP, sem relação).
    - **(b) Mesclagem de linhas do Sprint por categoria**
      (`toggl-report-back/TogglReport.Nucleo/Sprint/`): antes, a grid de
      acompanhamento emitia sempre uma `LinhaTarefaSprint` por
      `(descrição/tag, colaborador)`, mesmo quando dois colaboradores só
      ocupavam categorias (Dev/Rev/Qa) **diferentes** da mesma
      descrição/tag — cada um virava linha própria, com os outros 2 blocos
      zerados. `BlocoCategoriaSprint` (era
      `record(decimal PreHoras, long ReaSegundos)`) ganhou
      `string? NomeExibicao, string? Sigla, string? Cor` — o colaborador
      passou a viver **no bloco**, não na linha; `LinhaTarefaSprint` perdeu
      `NomeExibicao`/`Sigla`/`Cor` do nível da linha (ficou
      `record(string Codigo, string Descricao, bool Agrupada,
      BlocoCategoriaSprint Dev, Rev, Qa)`). `ServicoSprint.Montar` trocou a
      etapa de construção das linhas por um **empacotamento guloso** por
      `(Chave, Agrupada)`: os colaboradores são processados na ordem de
      `usuariosSelecionados`; cada um procura, entre as linhas já abertas
      para aquele grupo, a primeira cujos slots (Dev/Rev/Qa) que ele ocupa
      (`segundos > 0`) estejam **todos livres** — se achar, entra nela
      preenchendo só os slots que ocupa; senão, abre uma linha nova. Um
      colaborador sem tempo em nenhuma categoria sempre abre linha própria
      (preserva o "–"/"Nenhuma" em todos os blocos). Efeito: `A` (só Dev) e
      `B` (só Rev) na mesma descrição → **1 linha**, com `Dev.NomeExibicao =
      A` e `Rev.NomeExibicao = B`; `C` (também só Dev, mesma descrição) não
      cabe na linha de `A` (Dev já ocupado) → abre uma 2ª linha — dois
      colaboradores na **mesma** categoria continuam em linhas separadas
      (mesmo comportamento de antes). O desempate de ordenação das linhas
      tag-agg trocou de "índice do colaborador da linha"
      (`indicePorNome[t.NomeExibicao]`) para `MenorIndiceColaborador` (o
      menor índice entre os colaboradores presentes nos blocos preenchidos),
      já que uma linha pode ter mais de um colaborador agora.
      `CabecalhoSprint.TarefasPendentes` e as estatísticas de
      `LinhaColaboradorSprint` continuam calculadas sobre os dados brutos por
      colaborador (antes do empacotamento), sem mudança de comportamento.
      Frontend (`src/api/tipos.ts`, `src/features/sprint/SprintView.tsx`,
      `src/features/sprint/tachados.ts`): tipos espelham o novo formato; os
      badges `BadgeSigla` de cada grupo DEV/REV/QA passaram a ler do
      **bloco** correspondente (`linha.dev.nomeExibicao`/`.sigla`/`.cor`,
      idem `rev`/`qa`) em vez da linha inteira. `idLinhaTarefa` trocou o 3º
      parâmetro de `nomeExibicao` para um **índice de ocorrência** daquela
      `(codigo, descricao)` na lista completa de tarefas (id vira
      `codigo∙descricao∙índice-de-ocorrência`), calculado sobre a lista
      completa — não a filtrada pela busca — para não mudar quando a busca
      liga/desliga; sem isso, o antigo id (baseado em `nomeExibicao`) não
      fazia mais sentido com uma linha carregando vários colaboradores.
      Validado por um teste manual (harness temporário, removido depois).
    - **(c) Negrito nas colunas Pendentes/Concluídas/Disponível**
      (`toggl-report-front/src/features/sprint/SprintView.tsx`, tabela
      "Colaboradores"): as colunas **Disponível**, **Pendentes** e
      **Concluídas** passaram a ter `fontWeight: 700` **sempre** — antes,
      "Disponível" só ficava em negrito quando positiva/negativa (neutra
      ficava sem), e "Pendentes"/"Concluídas" nunca tinham negrito. A cor
      condicional já existente (vermelho/verde conforme o valor) não mudou.
    - **(d) Centralização de cores hardcoded no tema**
      (`toggl-report-front/src/theme.ts`): `CORES` ganhou `corPendente:
      '#EA4335'`, `corConcluido: '#34A853'`, `corTag: '#F57C00'` (mesmos
      valores que já eram usados como consts locais `COR_PENDENTE`/
      `COR_CONCLUIDO`/`COR_TAG` no topo de `SprintView.tsx`) — essas 3 consts
      locais passaram a apontar para `CORES.corPendente`/`corConcluido`/
      `corTag` em vez de repetir o literal. `UsuarioFormDialog.tsx`:
      `COR_PADRAO_USUARIO` (era `'#5B82F6'` literal) passou a referenciar
      `CORES.accentAzul` (token já existente, mesmo valor). Confirmado por
      grep: nenhuma cor hex solta sobra fora de `theme.ts` em todo `src/` do
      frontend. **Isso substitui a afirmação de rodadas anteriores** (§4.9/
      §5.3, já corrigidas nesta atualização) de que as cores de status do
      Sprint eram "hex fixos, não tokens do tema" — hoje são tokens.
31. **Código em vermelho nas linhas duplicadas do Sprint + reimportação de
    dados sobre pasta já populada** (2026-09-08, só frontend — **nenhuma
    mudança de backend, endpoint, contrato ou lógica de cálculo**):
    - **(a) Destaque das linhas duplicadas por colisão de posição**
      (`features/sprint/calculos.ts` + `SprintView.tsx`): a mesclagem gulosa de
      `ServicoSprint.Montar` (item 30b) abre mais de uma `LinhaTarefaSprint`
      para a mesma `(codigo, descricao)` quando dois colaboradores disputam a
      **mesma** posição DEV/REV/QA. Nova função pura
      `calcularColisaoPosicao(tarefas) → boolean[]` (paralelo a `tarefas`):
      agrupa por `codigo∙descricao∙agrupada` e marca `true` **todas** as linhas
      de um grupo em que alguma posição (`dev`/`rev`/`qa`) tenha `nomeExibicao`
      preenchido em ≥ 2 linhas (linha extra só vazia — colaborador sem categoria
      — **não** conta). No `SprintView`, um `useMemo` calcula o array e o
      `tarefasComId` carrega `codigoDuplicado` por linha; a célula da coluna
      **Código** dessas linhas fica em `CORES.corPendente` (`#EA4335`) +
      `fontWeight: 700`, com `<Tooltip>` "Código repetido: mais de um
      colaborador ocupa a mesma posição (DEV/REV/QA) desta descrição.". Bullet
      novo na "Regras da listagem" do modal "Informações". Validado por harness
      temporário (5 cenários — colisão DEV, merge sem colisão, DEV disputado com
      linha mesclada, linha vazia sem disputa, descrições distintas — todos
      corretos) + `npm run build` limpo.
    - **(b) Reimportação de dados existentes** (`ImportarDadosDialog.tsx` +
      `RodapeDownloads.tsx`): `ImportarDadosDialog` ganhou props opcionais
      `titulo`/`descricao`/`rotuloCancelar` (defaults = o fluxo "nenhum usuário
      cadastrado" do `App.tsx`, inalterado). `RodapeDownloads` ganhou um botão
      **"Importar dados (.zip)"** ao lado de "Baixar dados (.zip)", que abre o
      mesmo diálogo com textos de "reimportação sobre dados existentes" e, no
      sucesso, chama `window.location.reload()`. **O endpoint `POST
      /api/dados/restaurar` não mudou** — `ZipArchive.ExtractToDirectory(
      overwriteFiles: true)` sobrescreve só os arquivos presentes no `.zip`;
      os demais (inclusive `TogglRelatorioData.ini`/`TogglGantData.ini`/
      `TogglSprintData.ini`) ficam intactos. Não há invalidação de cache
      atrelada à importação; `ServicoConsulta.CacheCorrespondeAosParametros`
      valida período/usuários em tempo de consulta, então um cache divergente
      só dispara nova consulta ou 409 — nunca corrompe. A descrição do diálogo
      recomenda deixar os arquivos de cache **fora** do `.zip` a menos que se
      queira substituí-los.
32. **Descrição também em vermelho nas linhas duplicadas do Sprint**
    (2026-09-09, só frontend, `SprintView.tsx` — **nenhuma mudança de
    backend, endpoint, contrato ou lógica de cálculo/detecção**): o destaque
    em vermelho do item 31a, até então só na coluna **Código**, foi estendido
    à coluna **Descrição** da mesma linha — **mesma condição** (`codigoDuplicado`,
    já calculada por `calcularColisaoPosicao`) e **mesmo token de cor**
    (`CORES.corPendente` + `fontWeight: 700`), sem duplicar a lógica de
    detecção. Só a célula da Descrição ganhou o spread condicional extra no
    `sx` do `<Box>` interno; o `<Tooltip>` "Código repetido: ..." continua
    exclusivo da coluna Código (a Descrição mantém seu próprio `<Tooltip>` com
    o texto completo, sem duplicar a explicação). Quando a linha também está
    **tachada** (checkbox marcado), o `line-through`/`text.disabled` do
    tachado é aplicado antes do spread de `codigoDuplicado` no objeto `sx` —
    a cor vermelha prevalece sobre `text.disabled`, mas `textDecoration:
    'line-through'` permanece (nenhuma das duas condições sobrescreve a outra
    por completo). Validado com o mesmo caso de teste do item 31a (dois
    colaboradores na mesma posição/descrição → Código e Descrição vermelhos
    na linha) e `npm run build` limpo.

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

### C# (API, núcleo)

- **Tudo em pt-BR**; exceções: `Program`/`Main`, `Task`/`async`,
  `[JsonPropertyName]` com nomes da API, siglas (`Dto`, `Api`, `Ini`, `Http`).
- **Tipo explícito no lugar de `var`** sempre que o tipo puder ser nomeado.
- **Poucas dependências NuGet**: o núcleo não tem nenhum `PackageReference`
  salvo decisão explícita; a API tem a exceção pontual do Swashbuckle
  (necessário para Swagger).
- Novo serviço em `Relatorios/`/`Consultas/` do núcleo: classe estática,
  função pura, **sem** `Console.Write*` nem qualquer I/O de terminal.
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
  `TogglReport.Nucleo` desde as rodadas de 2026-09-05 (itens 11–16 do
  histórico), por pedido explícito do usuário naquela ocasião — o item 16
  estendeu a limpeza aos poucos arquivos do núcleo que ainda tinham XML doc
  comments originais (`ConfiguracaoApp`, `ConfiguracaoUsuario`,
  `ClienteApiToggl`, `RegistroTempoDto`, `ResultadoApiToggl`,
  `LinhaDescricao`).
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

> **Nota (2026-09-08)**: o `toggl-report` **não tem mais um projeto console**
> — `TogglReport.Console` foi removido por completo (ver §7, último item).
> Todo o texto abaixo, que compara o console daqui com o `gerador-chave-nfe`
> (que continua sendo um único executável de console), é **histórico**: reflete
> o estado do repositório entre 2026-09-02 e 2026-09-08 e não descreve mais o
> estado atual deste repositório. Fica preservado como registro de convenções
> de estilo/código que continuam válidas fora do escopo de console (e como
> referência útil para quem for mexer só no `gerador-chave-nfe`), no mesmo
> espírito de §6.

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
