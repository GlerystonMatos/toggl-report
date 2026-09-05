# CLAUDE.md

Memória de contexto persistente do projeto **toggl-report**. Serve para orientar
qualquer sessão futura sem precisar reexplicar as decisões já tomadas.

---

## 1. Visão geral

Aplicação **console em C# / .NET 10** que gera relatórios de tempo trabalhado a
partir da **API v9 do Toggl Track**, agrupando por descrição e/ou tag, por usuário,
em um período informado.

- Totalmente **interativo**: um assistente guia a configuração (período, agrupamento
  e API Tokens) e persiste tudo em um `TogglReport.ini` dentro da pasta `dados`, ao
  lado do executável.
- **Multiusuário**: cada usuário tem seu API Token pessoal; o relatório consolida todos.
- **Cache de consulta** (`dados/ToggleData.ini`, ao lado do executável): guarda o
  retorno cru da última consulta bem-sucedida de cada usuário. Se período e usuários
  da próxima execução forem iguais, o app oferece carregar do cache (default) em vez
  de consultar a API de novo; o agrupamento/cálculo sempre roda em runtime sobre o
  dado, cacheado ou não — o cache nunca guarda resultado já processado. Também serve
  de reserva quando o limite de 30 requisições/hora por usuário é atingido (ver §4/§6).
  **Não há mais exportação para CSV** — os dados só existem no console e no cache.
- **Zero dependências externas** — nenhum `PackageReference`. Parser de INI e banner
  feitos à mão; `dotnet build`/`run` funcionam offline.
- **Interface de console** com tela de boas-vindas, animação de carregamento,
  cabeçalho fixo (redesenhado a cada passo, com o resumo já escolhido), padrão de
  cores centralizado e tela de despedida. Toda troca de tela (relatório completo,
  resultado de busca, menu pós-busca) limpa o console (via sequência ANSI, não só
  `Console.Clear()`) e redesenha o cabeçalho antes do novo conteúdo, via
  `Tela.ExibirComCabecalho`. Moldura dimensionada para a largura real do terminal, sem
  nunca ultrapassá-la (ver §4, item "Moldura dinâmica"). O mesmo estilo geral do
  projeto irmão `gerador-chave-nfe` (ver §10).
- **Tudo em pt-BR**: interface, mensagens, identificadores, pastas e namespace. Em
  inglês só o inevitável (`Program`, `Main`, `Task`/`async`, `[JsonPropertyName("...")]`
  com nomes da API) e siglas (`Dto`, `Api`, `Ini`, `Http`, `Toggl`). **Sem comentários**
  no código tocado pelas rodadas de 2026-09-05 (itens 11 a 13 do histórico) — nomes
  claros e funções pequenas no lugar de comentário; regras de domínio não óbvias
  ficam documentadas aqui, não inline.

---

## 2. Como compilar e rodar

```bash
dotnet build          # a partir da raiz do repositório
dotnet run --project TogglReport
```

- SDK: **.NET 10** (`net10.0`). `LangVersion=latest`, `ImplicitUsings=enable`,
  `Nullable=enable`. Versão atual (`<Version>` e `Program.Versao`): **1.0.0**.
- Solução: `TogglReport.slnx` → `TogglReport/TogglReport.csproj`.
- **Namespace raiz**: `RelatorioToggl`. **Assembly/executável e pasta do projeto**
  continuam `TogglReport` (nome do produto, casa com o repo GitHub).
- **Não há testes automatizados.** Após mudanças: `dotnet build`, manter **0
  warnings**, e validar o fluxo interativo manualmente.
- A limpeza de tela é encapsulada em `Tela.Limpar()`: sai cedo se
  `Console.IsOutputRedirected` (não escreve nada) e, senão, escreve a sequência
  ANSI `Tela.SequenciaLimparTela` seguida de `Console.Clear()` (engolindo
  `IOException`) — dá para "pipar" o app em testes rápidos (os laços de entrada,
  porém, assumem terminal real; ver §7).

### Estado da compilação

- **`Build succeeded` — 0 erros, 0 warnings.**
- Todo código vive sob `TogglReport/` (o SDK só faz glob dos `.cs` sob o `.csproj`).

### Histórico de mudanças estruturais (2026-09-02, exceto os itens 8, 9 e 10, de 2026-09-04)

1. **Correção do build:** `Program.cs` estava na raiz do repо, fora de
   `TogglReport/` (`CS5001`). `git mv Program.cs TogglReport/Program.cs`.
2. **Tradução completa para pt-BR:** identificadores, pastas
   (`Config`→`Configuracao`, `Wizard`→`Assistente`, `Reporting`→`Relatorios`),
   namespace `TogglReport`→`RelatorioToggl`, e o **esquema do arquivo de config**
   (`[Geral]`, `DataInicioAnterior`, `AgrupamentoPadrao=descricao|tag|ambos`,
   `[Usuario:x]`, `NomeExibicao`, `TokenApi`). Sem retrocompatibilidade — o projeto
   ainda não foi distribuído. `var` → tipo explícito. `<Nullable>` → `enable`.
   `<NeutralLanguage>` `pt-GW` → `pt-BR`.
3. **Interface visual** alinhada ao `gerador-chave-nfe`: nova pasta
   `Apresentacao/` (`Paleta`, `Tela`, `Prompt`, `Rotulos` + `AssistenteConfiguracao`
   e `MenuTokenUsuario`, movidos de `Assistente/`). Banner de boas-vindas em
   moldura Unicode, `Tela.Carregando`, `Tela.Cabecalho` redesenhado a cada passo,
   `Tela.Despedida`. `Program` reorganizado: fase de consulta (com progresso)
   separada da fase de impressão.
4. **Limpeza de comentários**: removidos os que apenas repetiam o código; mantidos
   só os que explicam um *porquê* ou uma regra de domínio não óbvia.
5. **Revisão por agentes independentes + correções**: fuso local→UTC na
   normalização de datas; validação de `NomeExibicao` único (evitava colisão e
   `ArgumentException` na busca com nomes repetidos); validação de período
   (`fim >= inicio`); aviso quando nenhum usuário retorna dados; `HttpClient` com
   `Timeout` de 30 s; `usings` redundantes removidos (o `ImplicitUsings` cobre
   `System`, `System.Linq`, `System.IO`, `System.Collections.Generic`,
   `System.Net.Http`, `System.Threading.Tasks`); `.gitattributes`
   (`* text=auto eol=crlf`, `core.autocrlf=false`) e todos os arquivos em CRLF.
6. **Padronização final da moldura** (paridade total com o `gerador-chave-nfe`):
   `Tela` passou a usar uma **caixa única** (`╔═╗ ║ ╠═╣ ║ ╚═╝`, `Largura = 100`) —
   a tela de abertura e o cabeçalho têm exatamente a mesma largura e o mesmo
   estilo, via os helpers `Borda` / `LinhaCentralizada` / `LinhaTexto` /
   `Centralizar` / `Ajustar` (que trunca com `…`). O **resumo do cabeçalho ficou
   em uma única linha** (`Período · Agrupamento · Usuários`). `Carregando` e
   `Despedida` idênticos aos do projeto irmão.
7. **Alinhamento de arquitetura/funcionamento com o `gerador-chave-nfe`** (escolhida
   a melhor opção entre os dois e replicada nos dois):
   - `AssistenteConfiguracao` reescrito no mesmo padrão do `AssistenteParametros`:
     método genérico `LerCampo` (ler → validar → confirmar), `PodeReaproveitar` /
     `OfereceValorSalvo` — **reaproveitamento e confirmação campo a campo** (antes
     era "usar tudo como está?"). O laço de confirmação final (`Confirmar a consulta
     com os parâmetros acima?`) vive em `Program.ColetarConfiguracaoConfirmadaAsync`.
   - `Prompt.EscolherOpcao` (lista em colunas) adicionado; o agrupamento usa-o.
   - **Config persistido**: `config.ini` no cwd → **`TogglReport.ini` em
     `AppContext.BaseDirectory`** (padrão `<AssemblyName>.ini`, igual ao irmão).
   - **Falha ao salvar** o config agora é tratada (`try/catch` em
     `Program.SalvarConfiguracao`, aviso não-fatal).
   - `Prompt.LerEntrada` → em **EOF** (stdin fechado) o app **encerra** com
     `Environment.Exit(0)` em vez de entrar em laço infinito.
   - Prompt de reaproveitar valor salvo e de confirmar tudo: `padraoSim` (Enter = sim).
8. **Ajustes de exibição do relatório + tags detalhadas** (pedido do usuário, correções após
   revisão por 2 agentes independentes):
   - **Lista de usuários antes da confirmação final**: `Tela.ListarUsuariosSelecionados`
     imprime um usuário por linha (cor `Paleta.Info`, igual ao resumo do cabeçalho), chamada em
     `Program.ColetarConfiguracaoConfirmadaAsync` logo antes do `Confirmar a consulta...`.
   - **Larguras fixas na largura da moldura**: `Tela.LinhaPreenchida` (novo helper público) gera
     uma linha de título completando com um caractere até `Tela.Largura` (100) — usado no título
     `═══ <usuário> ═══` e nos títulos de seção `── Por descrição ──` / `── Por tag ──` de
     `EscritorRelatorioConsole`. (A linha `-` que nesta rodada separava as duas seções foi
     removida no item 9 — hoje é só uma quebra de linha.)
   - **Duração com segundos**: `EscritorRelatorioConsole.FormatarDuracao` passou de `HHhMMm`
     para `HHhMMmSSs` (ex.: `03h34m05s`) — usado também pelo CSV (mesma função) e pela tabela
     de busca.
   - **Truncamento de descrição só no console**: `Tela.Ajustar(texto, largura)` (nova
     sobrecarga pública, com o mesmo corte `…` de sempre) trunca a descrição exibida no
     relatório e na tabela de busca; o CSV (`ServicoAgrupamento`/`Program.ExportarCsv`,
     `EscritorTabelaBusca.ExportarCsv`) sempre grava o texto completo, sem passar pelo Ajustar.
   - **Tags detalhadas** (`ConfiguracaoApp.TagsDetalhadas`, persistido no INI): tags nessa
     lista mostravam descrição e tempo de cada entrada abaixo do total da tag
     (`ServicoAgrupamento.AgruparPorDescricaoDentroDaTag`); as demais mostravam só a tag e o
     total. Coletado pelo assistente (`AssistenteConfiguracao.LerTagsDetalhadas`) só quando o
     agrupamento é `tag`/`ambos`. **Esse comportamento no console foi substituído no item 9**
     (a tag passou a ficar totalmente fora de "Por tag", em vez de aparecer detalhada nele); o
     CSV principal ainda grava `TagDescricao` para essas tags (ver item 9).
   - **Bug corrigido nessa mudança**: `ServicoAgrupamento.AgruparPorTag` usava dicionário
     case-sensitive, enquanto o casamento de "é uma tag detalhada?" e
     `AgruparPorDescricaoDentroDaTag` são `OrdinalIgnoreCase` — uma tag gravada como `"Cliente"`
     e `"cliente"` em entradas diferentes virava dois grupos com totais que não batiam com o
     detalhamento. `AgruparPorTag` passou a usar
     `new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase)`.
   - **Tabela de busca (`EscritorTabelaBusca`) não estourava só a linha `-`, estourava a
     largura toda**: a coluna de descrição agora ocupa só o que sobra depois das colunas fixas
     (usuários + total), sem piso mínimo (antes havia um `Math.Max(9, ...)` que furava a
     garantia); nomes de usuário muito longos são truncados a até 20 colunas
     (`LarguraMaximaColunaUsuario`) para não consumirem o orçamento sozinhos. Ver §7 para o
     caso extremo em que isso ainda não é suficiente (muitos usuários de nomes longos ao mesmo
     tempo).
   - Antes da pergunta "Buscar por parte da descrição:" (dentro do laço de busca), uma linha em
     branco (`Console.WriteLine()`) foi adicionada em `Program.ExecutarLoopBuscaDescricao`.
9. **Segunda rodada de ajustes no relatório do console** (2026-09-04, mesmo dia do item 8;
   pedido do usuário, correções após revisão por 2 agentes independentes):
   - **Cabeçalho sem a lista de usuários**: `Tela.Resumo` voltou a mostrar só
     `Período: ... · Agrupamento: ...` — a lista em si já aparece detalhada (um por linha) em
     `Tela.ListarUsuariosSelecionados`, que continua chamada antes da confirmação final; ficar
     nos dois lugares era redundante.
   - **Sem separador entre as seções**: a linha `-` entre "Por descrição" e "Por tag" (item 8)
     foi removida — hoje é só a quebra de linha que `ImprimirSecaoDescricao` já deixava no final.
   - **Largura da linha calculada por linha, não mais fixa**: `EscritorRelatorioConsole` ganhou
     `ImprimirLinha(texto, segundos)`, que calcula a largura da descrição como
     `Tela.Largura - indentação - 1 - duração.Length` a cada chamada, em vez de uma constante
     fixa (`LarguraDescricao = 85`, que quebrava a garantia de 100 colunas para totais ≥ 100h,
     já que `FormatarDuracao` não tem tamanho fixo — `:00` é um piso, não um teto). Com isso a
     duração sempre termina exatamente no fim da linha, com um espaço antes dela.
   - **"Por tag" só lista tags fora de `TagsDetalhadas`, sem detalhamento algum**: o mecanismo de
     detalhamento aninhado do item 8 foi removido de `EscritorRelatorioConsole.ImprimirSecaoTag`
     — uma tag em `TagsDetalhadas` some inteiramente da listagem "Por tag" (não aparece nem como
     total); as demais aparecem só com tag + total, como sempre. O prompt do assistente mudou de
     "tags que devem detalhar descrição e tempo" para **"tags que NÃO devem aparecer na listagem
     por tag"** (`AssistenteConfiguracao.LerTagsDetalhadas`), refletindo o novo sentido do campo
     (o nome `TagsDetalhadas` no código/INI não mudou, para não mexer no formato do arquivo).
     (No item 10, "Por descrição" passou a filtrar exatamente por essa mesma lista — a ressalva
     que estava aqui sobre tags sumirem do relatório inteiro não vale mais; ver item 10.)
   - **"Por descrição" ordena por prefixo "TEL"**: `ServicoAgrupamento.AgruparPorDescricaoComTag`
     (novo; devolve `List<LinhaDescricao>`, `Relatorios/LinhaDescricao.cs`) agrupa por descrição
     guardando também uma tag representativa (a primeira tag não nula entre as entradas daquela
     descrição — critério simples, documentado no XML doc do método; entradas com a mesma
     descrição e tags diferentes ficam com a tag da que for somada primeiro, sem significado
     especial). `EscritorRelatorioConsole.ImprimirSecaoDescricao` separa as entradas cuja
     descrição começa com "TEL" (`OrdinalIgnoreCase`) — essas vêm primeiro, ordenadas por tempo
     decrescente; as demais vêm depois, também por tempo decrescente, prefixadas com
     `"(tag) descrição"` (`"(sem tag)"` vira `"sem tag"` sem parênteses duplicados).
   - **CSV ajustado para não contradizer o novo texto do assistente**: `Program.ExportarCsv`
     agora só grava a linha `Tag` (total) para tags **fora** de `TagsDetalhadas`; para as tags
     detalhadas, grava só as linhas `TagDescricao` (por descrição), nunca as duas — antes gravava
     as duas para toda tag detalhada, o que contradizia a promessa do assistente ("NÃO devem
     aparecer na listagem por tag") no CSV. `AgruparPorDescricao`/`AgruparPorTag` continuam sendo
     a base do CSV (sem a ordenação por "TEL" nem o prefixo de tag do console — o CSV é a visão
     "crua"/completa, a curadoria fica só no console).
   - **Despedida com moldura completa**: `Tela.Despedida` passou a envolver "Até a próxima!" com
     `Borda('╔','╗')`/`Borda('╚','╝')` (mesmo estilo do título), não só os `║` das laterais.
   - **Bug corrigido nessa mudança**: `AssistenteConfiguracao.ColetarAsync` zerava
     `TagsDetalhadas` sempre que o agrupamento não incluía tag (`descricao`); como
     `Program.SalvarConfiguracao` grava a configuração inteira a cada execução confirmada, uma
     única consulta com agrupamento "descricao" apagava a lista salva. Passou a preservar o
     valor salvo (`salvos?.TagsDetalhadas`) quando não pergunta de novo, em vez de zerar.
   - **Divergência com o projeto irmão** (ver §10): a `Despedida` do `gerador-chave-nfe` **não**
     foi atualizada para a moldura completa — ficou só com os `║` das laterais, como a versão
     anterior daqui. Verificar se cabe replicar lá.
10. **Terceira rodada — "Por descrição" filtra por tag, normalização de "TEL", acabamentos visuais**
    (2026-09-04, mesmo dia dos itens 8 e 9; pedido do usuário, correções após revisão por 2 agentes
    independentes):
    - **"Por descrição" agora só mostra entradas de uma tag em `TagsDetalhadas`** (com agrupamento
      "ambos"): `ServicoAgrupamento.AgruparPorDescricaoComTag(registros, tagsDetalhadas)` pula
      qualquer entrada cujas tags não intersectem a lista — essas só entram no total agregado de
      `AgruparPorTag`. Isso fecha o ciclo do item 9: uma tag em `TagsDetalhadas` ganha detalhe por
      descrição aqui e por isso não precisa de uma linha de total redundante em "Por tag".
      **Exceção**: com agrupamento **"descricao"** puro (sem seção "Por tag" para totalizar o que
      ficaria de fora), usa-se a sobrecarga sem filtro `AgruparPorDescricaoComTag(registros)` — ver
      "bug corrigido" abaixo.
    - **Normalização de descrições "TEL"**: `ServicoAgrupamento.NormalizarDescricaoTel` (regex
      `^TEL\s*-?\s*(\d+)\s*-?\s*(.*)$`, case-insensitive) uniformiza "TEL-0000-AA" / "TEL-0000 - AA"
      / "TEL-0000-AA" (com ou sem separador) para sempre `"TEL - 0000 - AA"`. **Aplicada já na chave
      de agrupamento** (`ChaveDescricao`, privado), não só na exibição — ver "bug corrigido" abaixo.
      Só reformata quando há dígitos logo após "TEL" (com no máximo um espaço/hífen no meio); não
      confunde com palavras como "TELA", "TELEFONE" ou "TELEFONEMA" (não têm dígito colado a "TEL").
      Não se aplica a nenhum caminho de CSV (`AgruparPorDescricao`/`AgruparPorDescricaoDentroDaTag`
      continuam com o texto cru) — mantém "CSV = visão crua" (item 9).
    - **"Em andamento" com a mesma largura total das outras seções**: o título
      (`Tela.LinhaPreenchida`) já ficou igual a "Por descrição"/"Por tag"; agora cada **linha** de
      entrada também é dimensionada para terminar em `Tela.Largura` — a descrição entre aspas ocupa
      o espaço que sobra depois do sufixo fixo `" (iniciado às ...)"` (que nunca é cortado), truncando
      com `…` se necessário. Mesma ideia do `ImprimirLinha` das outras seções, mas preservando o
      sufixo em vez da duração.
    - **Linha dupla `═` depois do último colaborador**: `Program.ImprimirRelatorios` imprime
      `new string('═', Tela.Largura)` em `Paleta.Titulo` (mesma cor do título `"═══ <usuário> ═══"`)
      uma única vez, após o `foreach` de todos os usuários (não por usuário), só se houve algum —
      separando a listagem da mensagem "CSV gerado em..." que vem a seguir.
    - **Mensagens "CSV gerado em..."/"CSV da busca gerado em..." na cor dos parâmetros**:
      `Program.ExportarCsv` e `Program.ExecutarLoopBuscaDescricao` trocaram `Paleta.Sucesso` por
      `Paleta.Info` (mesma cor do resumo do cabeçalho e de `ListarUsuariosSelecionados`).
    - **Sem mudança necessária**: a pergunta "Deseja buscar por parte da descrição?" já usava
      `Prompt.Confirmar` — o mesmo método/cor (`Paleta.Sucesso`) de toda pergunta de sim/não do app
      (não há parâmetro de cor por chamada em `Prompt.Confirmar`). Confirmado por grep de todo o
      `TogglReport/`: nenhuma chamada usa uma cor diferente.
    - **Bugs corrigidos nessa mudança** (achados pelos 2 agentes de revisão):
      1. *Filtro sem válvula de escape para agrupamento "descricao"*: `EscritorRelatorioConsole`
         chamava a versão filtrada de `AgruparPorDescricaoComTag` incondicionalmente; com
         agrupamento "descricao" (que nunca coleta `TagsDetalhadas` — só pergunta quando é
         `tag`/`ambos`) e nenhuma seção "Por tag" para compensar, o relatório inteiro virava
         "(nenhum dado)". Corrigido com a sobrecarga sem filtro `AgruparPorDescricaoComTag(registros)`
         usada quando `agrupamento != "ambos"`.
      2. *Normalização só na exibição, não na chave*: a primeira versão chamava
         `NormalizarDescricaoTel` só na hora de imprimir; duas entradas do mesmo ticket gravadas com
         grafias diferentes ("TEL-100-AA" e "TEL - 100 - AA") formavam **dois grupos** que exibiam o
         mesmo texto normalizado com totais **separados** (o problema que a própria normalização
         deveria resolver). Corrigido movendo `NormalizarDescricaoTel` para `ServicoAgrupamento`
         (pública) e aplicando-a já na chave de agrupamento (`ChaveDescricao`); a exibição não
         precisa mais normalizar de novo.
11. **Cache de consulta, remoção do CSV, UX de busca/pós-busca e moldura dinâmica** (2026-09-05,
    pedido do usuário; mapeamento inicial feito por um subagente somente-leitura, implementação
    revisada e ajustada em seguida):
    - **Cache `ToggleData.ini`** (`Configuracao/CacheConsulta.cs` + `Configuracao/CarregadorCacheIni.cs`):
      guarda, por usuário (`UsuarioCacheado`: `Chave`, `NomeExibicao`, `TokenApi`, `Registros`), o
      `List<RegistroTempoDto>` cru retornado pela API — sem nenhum agrupamento/cálculo — mais
      `DataInicio`/`DataFim` da consulta em `[Geral]`. Mesmo estilo de seções do `TogglReport.ini`
      (`[Usuario:<chave>]`), `Registros` serializado como JSON compacto (`System.Text.Json`, uma
      linha) no valor da chave — o parser de INI já preserva qualquer caractere após o primeiro `=`,
      então não precisou de escaping novo. Salvo (`Program.SalvarCache`, com `try/catch` não-fatal,
      igual a `SalvarConfiguracao`) depois de toda consulta que efetivamente chamou a API.
    - **`Configuracao/AnalisadorIni.cs`** (novo): o parser de seções/`chave=valor` que antes vivia
      privado em `CarregadorConfiguracaoIni` foi extraído para cá (`Analisar`/`ObterOuPadrao`/
      `ObterOuNulo`, todos públicos) — reaproveitado por `CarregadorConfiguracaoIni` (TogglReport.ini)
      e `CarregadorCacheIni` (ToggleData.ini), já que os dois arquivos têm o mesmo formato de seções.
      Refatoração comportamentalmente idêntica ao parser anterior.
    - **Fluxo de abertura decide cache vs. API** (`Program.ObterRegistrosAsync`): depois de confirmada
      a configuração, carrega o `ToggleData.ini` (se existir) e compara com
      `CacheCorrespondeAosParametros` — **mesmo período** (`DataInicio`/`DataFim`) e **mesmo conjunto
      de usuários** (todo `ConfiguracaoUsuario.Chave` + `TokenApi` da configuração atual precisa achar
      um `UsuarioCacheado` correspondente no cache, e vice-versa em tamanho). Se bater, pergunta
      "Deseja consultar novamente à API?" com **padrão não** (Enter = carregar do cache,
      `Prompt.Confirmar` sem `padraoSim`) — carregar do cache não pula o agrupamento/cálculo, só a
      chamada HTTP (`CarregarRegistrosDoCache` devolve os mesmos `RegistroTempoDto` crus, e
      `EscritorRelatorioConsole`/`ServicoAgrupamento` rodam normalmente em cima deles). Se os
      parâmetros mudaram, não há cache, ou o usuário pediu para consultar de novo, segue para
      `ConsultarUsuarios` e depois regrava o cache.
    - **Limite de 30 requisições/hora por usuário** (`Toggl/LimitadorRequisicoes.cs`, novo): contador
      **em memória**, por `Chave` de usuário — `PodeConsultar`/`RegistrarConsulta`, janela deslizante
      de 1 hora (`RemoverRequisicoesAntigas`). Só vale durante a execução atual do processo (não
      persiste em disco); é uma camada extra de segurança além do retry de 429 que `ClienteApiToggl`
      já fazia (esse continua intocado). Em `Program.ConsultarUsuarios`, se o limite foi atingido
      para um usuário, o app tenta usar o `UsuarioCacheado` daquele usuário **só se o cache for do
      mesmo período e do mesmo token** (evita misturar dado de um período diferente no relatório);
      sem cache utilizável, o usuário é pulado e reportado, como uma falha comum de consulta.
    - **CSV removido por completo**: `Relatorios/EscritorRelatorioCsv.cs` e `Relatorios/LinhaCsv.cs`
      apagados; `EscritorTabelaBusca.ExportarCsv`/`Escapar` removidos; `Program.ExportarCsv` e
      `SanitizarNomeArquivo` removidos (não havia mais nenhum chamador). Os dois métodos de
      `ServicoAgrupamento` que só existiam para alimentar o CSV "cru" (`AgruparPorDescricao` sem
      normalização de "TEL", e `AgruparPorDescricaoDentroDaTag`) ficaram sem chamador e foram
      removidos também — **as referências a eles em itens 8/9/10 acima são histórico do que existia
      naquela época**, não refletem mais o código atual. `.gitignore`: `relatorio_*.csv`/`busca_*.csv`
      removidos, `ToggleData.ini` adicionado ao lado de `TogglReport.ini` (mesmo motivo: guarda
      tokens, agora também dado bruto da conta Toggl).
    - **Busca reaproveita a formatação do relatório**: `EscritorTabelaBusca` já reaproveitava
      `EscritorRelatorioConsole.FormatarDuracao` e `Tela.Ajustar`; o cálculo de largura restante que
      cada um fazia com sua própria conta (`Math.Max(1, Tela.Largura - X)`) virou o helper
      `Tela.LarguraRestante(int larguraConsumida)`, usado pelos três pontos que precisavam disso
      (`EscritorRelatorioConsole.ImprimirLinha`/`ImprimirEmAndamento`, `EscritorTabelaBusca`). O
      pivô descrição × usuário da busca continua sendo uma visão diferente do relatório por usuário
      (ver próximo item) — "reaproveitar a formatação" aqui é sobre as funções de baixo nível, não
      sobre unificar as duas telas em uma só.
    - **Menu de três opções depois de cada busca** (`Program.ExecutarCicloDeBusca` +
      `PerguntarProximaAcaoPosBusca`): "1 - Voltar ao relatório completo" reexibe o relatório
      completo (`ExibirRelatorioCompleto`) e volta a perguntar "Deseja buscar por parte da
      descrição?"; "2 - Nova busca por descrição" pula direto para pedir um novo termo, sem repetir
      essa pergunta; "3 - Continuar" (ou qualquer entrada não reconhecida como 1/2) encerra o laço de
      busca e segue para "Deseja executar novamente?". Substituiu o antigo laço
      `while (Prompt.Confirmar("Deseja buscar..."))` que só permitia buscar de novo ou parar.
    - **Tela limpa + cabeçalho antes de cada conteúdo novo** (`Tela.ExibirComCabecalho(versao,
      configuracao, Action conteudo)`, novo): centraliza o padrão "limpar, redesenhar cabeçalho,
      depois imprimir o conteúdo", já usado em `ExibirRelatorioCompleto` e a cada resultado de busca.
      A pergunta "Deseja buscar por parte da descrição?" logo após o relatório **não** limpa a tela
      (fica anexada abaixo do relatório recém-exibido, para o usuário ainda vê-lo); já pedir um novo
      termo de busca (primeira vez ou via "nova busca") sempre limpa e redesenha o cabeçalho antes —
      é uma escolha de UX (preservar a última tela "grande" enquanto a pergunta imediata seguinte
      ainda se refere a ela; limpar só quando de fato há conteúdo novo substituindo o anterior).
    - **Moldura dimensionada pelo terminal** (`Tela.Inicializar`, chamado uma vez no início de
      `Program.Main`, antes de `Tela.BemVindo`): `Tela.Largura` deixou de ser `const int` fixo em 100
      e virou `static int { get; private set; }`, calculado como
      `Math.Max(100, Console.WindowWidth - 1)` (nunca abaixo do padrão anterior; cresce se o terminal
      for mais largo). `IOException` (saída redirecionada/sem console real) mantém o padrão de 100 —
      mesmo padrão de tolerância que `Tela.Limpar()` já usava para `Console.Clear()`. `LinhaCheia`
      (a barra `═` da moldura) virou uma propriedade computada em vez de `static readonly` fixo, para
      refletir o `Largura` já ajustado por `Inicializar` em vez do valor de quando o campo antigo foi
      inicializado.
    - **Comentários removidos do código tocado nesta rodada**: por pedido explícito do usuário, todos
      os arquivos criados/reescritos nesta mudança (`AnalisadorIni`, `CacheConsulta`,
      `CarregadorCacheIni`, `CarregadorConfiguracaoIni`, `LimitadorRequisicoes`, `Program`, `Tela`,
      `EscritorRelatorioConsole`, `EscritorTabelaBusca`, `ServicoAgrupamento`) ficaram sem nenhum
      comentário — inclusive os que normalmente a convenção do projeto (§9) manteria por explicarem
      um *porquê*. Essas explicações foram preservadas aqui neste histórico e na tabela de decisões
      (§4) em vez de inline; arquivos **não** tocados nesta rodada (`AssistenteConfiguracao`,
      `MenuTokenUsuario`, `Prompt`, `ClienteApiToggl`, DTOs, etc.) continuam com seus comentários
      originais — a convenção geral do §9 não mudou, só foi levada ao extremo nos arquivos desta
      mudança específica.
12. **Correções de acabamento sobre o item 11** (2026-09-05, mesmo dia; pedido do usuário depois de
    rodar o app de verdade — 5 ajustes pontuais):
    - **`TogglReport.ini` e `ToggleData.ini` movidos para `dados/`**: antes ficavam soltos direto em
      `AppContext.BaseDirectory`; agora ficam em `AppContext.BaseDirectory/dados/` (constante
      `Program.PastaDados`). `CarregadorConfiguracaoIni.Salvar` e `CarregadorCacheIni.Salvar` chamam
      `Directory.CreateDirectory(Path.GetDirectoryName(caminho)!)` antes de gravar — a pasta é criada
      sozinha na primeira execução, sem passo manual. Nenhuma mudança de formato dentro dos arquivos,
      só de localização.
    - **`CacheConsulta`/`UsuarioCacheado` e `LinhaBusca`/`ResultadoBuscaDescricao` separados em
      arquivos próprios** (`Configuracao/CacheConsulta.cs` + `Configuracao/UsuarioCacheado.cs`,
      `Relatorios/LinhaBusca.cs` + `Relatorios/ResultadoBuscaDescricao.cs`) — pedido geral do usuário
      de "cada classe em um arquivo independente"; eram os dois únicos arquivos do projeto com mais
      de um tipo público (confirmado por grep de `^public (class|record|static class)` em todo o
      `TogglReport/`).
    - **Bug real na largura da moldura**: `Tela.Inicializar` fazia
      `Math.Max(LarguraPadrao, Console.WindowWidth - 1)` — ou seja, **nunca ficava abaixo de 100**
      mesmo quando o terminal real era mais estreito que isso, fazendo a moldura estourar a janela e
      quebrar linhas. Corrigido para `Largura = Console.WindowWidth - 2` sempre que a leitura for
      possível (só cai para `LarguraPadrao` = 100 no `catch (IOException)`, i.e. quando não há
      terminal real para medir) — a moldura agora nunca é mais larga que a janela atual, e ainda
      aproveita o espaço quando ela é maior que 100.
    - **`Tela.Limpar()` não limpava de fato em alguns terminais**: `Console.Clear()` sozinho se
      mostrou pouco confiável para limpar a tela visível em certas emulações de terminal Windows.
      Trocado por escrever a sequência ANSI/VT100 de limpar tela + cursor no início
      (`"[2J[H"`, constante `Tela.SequenciaLimparTela`) antes de `Console.Clear()`; a
      checagem vira `Console.IsOutputRedirected` no início do método (em vez de só
      `catch (IOException)`) para não escrever códigos de escape quando a saída está redirecionada
      para um arquivo/pipe (isso poluiria a saída "pipável" usada em testes rápidos — ver §2).
    - **Busca por descrição reformulada**: não é mais uma tabela-pivô (descrição × usuário em
      colunas); agora agrupa por descrição e detalha por usuário no **mesmo estilo visual** da seção
      "Por descrição" do relatório — mesmo título (`EscritorRelatorioConsole.TituloSecaoDescricao`,
      agora público) e mesma rotina de linha (`EscritorRelatorioConsole.ImprimirLinha`, que passou a
      receber a indentação como parâmetro em vez de usar a constante privada direto — agora também
      pública, `EscritorRelatorioConsole.Indentacao`). Uma linha por descrição encontrada (com o total
      somado de todos os usuários), e abaixo dela, indentada mais um nível
      (`EscritorRelatorioConsole.Indentacao + "  "`), uma linha por usuário que tem tempo naquela
      descrição, ordenadas por tempo decrescente (usuário sem registro simplesmente não aparece —
      não há mais célula "-"). `EscritorTabelaBusca.cs` foi apagado e virou
      `Relatorios/EscritorBuscaDescricao.cs`; os campos `Usuarios` e `TotaisColunaSegundos` de
      `ResultadoBuscaDescricao` (e o cálculo correspondente em `ServicoBuscaDescricao.Buscar`) foram
      removidos por ficarem sem nenhum consumidor — o agrupamento/soma por descrição em si (que
      define quais entradas aparecem e o valor de cada total) **não mudou**, só o que era exposto e
      como é impresso. O título de abertura da busca (`" ═══ Resultado da busca: ... ═══"`) também
      passou a usar `Tela.LinhaPreenchida` (largura cheia, igual ao título "═══ <usuário> ═══" do
      relatório), em vez de uma string sem preenchimento até a borda.
13. **Limpeza real do console + espaçamento na busca** (2026-09-05, mesmo dia; pedido do usuário
    depois de testar o app de verdade de novo — 2 ajustes pontuais, mudança cirúrgica):
    - **`Tela.SequenciaLimparTela` ganhou um terceiro código ANSI**: a sequência do item 12
      (`\x1b[2J\x1b[H` — apaga a tela visível e reposiciona o cursor) não apagava o *scrollback*:
      rolando a barra pra cima ainda dava pra ver telas anteriores em alguns terminais (Windows
      Terminal em especial, que mantém scrollback próprio, separado da "tela" que o processo
      enxerga). A sequência virou `\x1b[2J\x1b[3J\x1b[H` — `\x1b[3J` é a extensão xterm "erase
      saved lines" (apaga o scrollback), suportada por Windows Terminal e ConHost modernos.
      `Console.Clear()` continua chamado logo depois, como reforço para hosts sem VT (a checagem
      `Console.IsOutputRedirected` do item 12 continua igual — não escreve nada em saída
      redirecionada).
    - **Linha em branco entre grupos de descrição na busca** (`EscritorBuscaDescricao.ImprimirNoConsole`):
      um `Console.WriteLine()` a mais no final de cada iteração do `foreach (LinhaBusca linha in
      resultado.Linhas)`, depois do detalhamento por usuário — só espaçamento, nenhuma mudança na
      lógica de agrupamento/soma (mesma rotina de sempre, sem duplicar nada).

---

## 3. Fluxo funcional (o que `Program.Main` faz)

1. `Console.OutputEncoding = UTF8`; `Tela.Inicializar` (dimensiona `Tela.Largura` pelo
   terminal); `Tela.BemVindo` (banner) + `Tela.Carregando` (animação ~1 s).
2. **`GerarRelatoriosEnquantoUsuarioQuiser`** — laço `while (executarNovamente)`:
   1. **`ColetarConfiguracaoConfirmadaAsync`** — laço até o usuário confirmar:
      - `CarregadorConfiguracaoIni.Carregar(TogglReport.ini)` (uma vez por ciclo) e
        um `ConfiguracaoApp` novo.
      - `AssistenteConfiguracao.ColetarAsync(atual, salvos)` — campo a campo:
        **agrupamento** (`EscolherOpcao` + confirmar, ou reaproveitar o salvo),
        **tags detalhadas** (só se agrupamento é `tag`/`ambos`; lista livre separada por
        vírgula, ou reaproveitar a salva), **usuários** (submenu `MenuTokenUsuario`; obriga
        ≥ 1), **período** (data início/fim — reaproveitar salvo ou informar+confirmar; valida
        `fim >= inicio`).
      - Cabeçalho com o resumo, seguido da **lista de usuários selecionados** (um por linha,
        `Tela.ListarUsuariosSelecionados`) → `Confirmar a consulta com os parâmetros acima?`.
        Se recusado, recomeça. Se aceito, grava o `TogglReport.ini` (com `try/catch`).
   2. **`ObterRegistrosAsync`** — decide entre cache e API:
      - Carrega `ToggleData.ini` (`CarregarCacheSeExistente`, com `try/catch`). Se existe e
        `CacheCorrespondeAosParametros` (mesmo período + mesmo conjunto de usuários/tokens),
        pergunta "Deseja consultar novamente à API?" (padrão **não** — Enter carrega do cache
        via `CarregarRegistrosDoCache`, sem chamar a API).
      - Caso contrário (parâmetros diferentes, sem cache, ou usuário pediu para consultar de
        novo): **`ConsultarUsuarios`** — para cada usuário, se `LimitadorRequisicoes.PodeConsultar`
        (limite de 30/hora, em memória) permitir, `ClienteApiToggl.ObterRegistrosTempoAsync`;
        senão, tenta o `UsuarioCacheado` daquele usuário no cache **só se for do mesmo período e
        token** (senão pula, reportado como falha). Progresso impresso por usuário
        (`• Nome: N registro(s)` / `erro — …` / `limite de 30 requisições/hora atingido — …`).
        Quem falha é **ignorado**; os demais seguem. Datas: o usuário escolhe dias no **fuso
        local**, e as bordas são convertidas para UTC (`SpecifyKind(…, Local).ToUniversalTime()`);
        fim inclusivo = 23:59:59 do último dia. Ao final, `SalvarCache` regrava o `ToggleData.ini`
        com o retorno cru (com `try/catch`).
      - Retorna `(Dictionary<nome,registros>, List<string> ordem)` — mesmo formato venha do
        cache ou da API; o passo seguinte não sabe nem precisa saber qual foi a origem.
   3. Se **ninguém** retornou dados, mostra um aviso **sem limpar a tela** — a intenção é preservar
      visíveis as linhas de progresso/erro por usuário que `ConsultarUsuarios` acabou de imprimir
      logo acima. Senão:
      - **`ImprimirConteudoRelatorio`** — pelo mesmo motivo, a **primeira** exibição do relatório
        (`EscritorRelatorioConsole.ImprimirRelatorioUsuario` por usuário, ordem consultada, passando
        `configuracao.TagsDetalhadas`, + a linha dupla final) também **não limpa a tela** — fica
        anexada logo abaixo da consulta. `ExibirRelatorioCompleto` (que envolve a mesma impressão em
        `Tela.ExibirComCabecalho`, limpando antes) só é usado quando o usuário escolhe "voltar ao
        relatório completo" a partir do menu pós-busca (ver abaixo) — aí sim é uma troca de tela
        genuína, sem nada relevante para preservar da tela anterior.
      - **`ExecutarFluxoBusca`** — pergunta "Deseja buscar por parte da descrição?" (sem limpar,
        logo abaixo do relatório). Se sim, **`ExecutarCicloDeBusca`** em laço: limpa + cabeçalho,
        pede o termo, `ServicoBuscaDescricao.Buscar` (substring case-insensitive sobre os dados já
        baixados, sem nova chamada à API) → `EscritorBuscaDescricao.ImprimirNoConsole` (limpa +
        cabeçalho antes) → `PerguntarProximaAcaoPosBusca` (1 = `ExibirRelatorioCompleto` — limpa,
        reexibe o relatório completo e volta a perguntar se quer buscar; 2 = pede novo termo direto,
        sem repetir a pergunta; 3/outro = encerra o laço de busca).
   4. "Executar novamente?" decide se repete.
3. `Tela.Despedida`.

---

## 4. Decisões de arquitetura

| Decisão | Motivo |
|---|---|
| **Sem NuGet / sem DI / sem libs** | Build offline; projeto pequeno. |
| **`Apresentacao/` isola toda a I/O de console** | `Paleta` (cores), `Tela` (telas fixas), `Prompt` (entrada + `EscolherOpcao`). Nenhuma outra classe mexe em `Console.ForegroundColor` direto (exceto os escritores de relatório, que usam `Paleta`). |
| **`AssistenteConfiguracao.LerCampo` genérico + `PodeReaproveitar`/`OfereceValorSalvo`** | Mesmo padrão do `AssistenteParametros` do irmão: cada campo é reaproveitado do salvo ou informado/validado/confirmado individualmente. O laço "confirmar tudo" fica no `Program`. |
| **`Prompt.LerEntrada` encerra em EOF** | `Environment.Exit(0)` quando o stdin fecha — sem laço infinito. |
| **`Tela.Cabecalho` recebe `ConfiguracaoApp`** | Deriva o resumo (período/agrupamento/usuários) em **uma única linha**; campos ainda não escolhidos aparecem como `—`. |
| **Moldura de largura dinâmica, estilo `╔═╗ ║ ╠═╣ ║ ╚═╝`** | `Tela.Largura` (`static int`, não mais `const`) é calculado por `Tela.Inicializar()` como `Console.WindowWidth - 2` sempre que der para ler — **nunca mais larga que a janela real** (bug corrigido no item 12: a versão anterior forçava um mínimo de 100 mesmo em terminais mais estreitos, estourando a moldura); só cai para `LarguraPadrao` = 100 no `catch (IOException)` (saída redirecionada, sem terminal real). Abertura e cabeçalho continuam com a mesma largura e estilo entre si; helpers `Borda`/`LinhaCentralizada`/`LinhaTexto`/`Centralizar`/`Ajustar`. `Tela.Largura`, `Tela.Ajustar(texto, largura)`, `Tela.LarguraRestante(int)` e `Tela.LinhaPreenchida` são públicos para os escritores de `Relatorios/` reaproveitarem a mesma largura fora da moldura. |
| **`Tela.Limpar()` limpa via sequência ANSI (incluindo scrollback) + `Console.Clear()`, só quando não redirecionado** | `Console.Clear()` sozinho se mostrou pouco confiável para limpar a tela visível em alguns terminais Windows (item 12); a sequência inicial (dois codigos VT: apaga tela + reposiciona cursor) não apagava o *scrollback* — dava pra rolar pra cima e ver telas antigas (item 13). `Tela.SequenciaLimparTela` ganhou um terceiro código VT ("erase saved lines", apaga o scrollback) entre os dois. `Console.IsOutputRedirected` no início evita escrever códigos de escape numa saída redirecionada (mantém o app "pipeável" — ver §2). |
| **`Tela.ExibirComCabecalho(versao, configuracao, Action conteudo)`** | Centraliza "limpar + redesenhar cabeçalho + imprimir conteúdo" num único ponto, reaproveitado pelo relatório completo e por cada resultado de busca — em vez de cada chamador lembrar de chamar `Tela.Cabecalho` antes do próprio conteúdo. |
| **Nem toda impressão de conteúdo limpa a tela — só troca de tela genuína** | `ImprimirConteudoRelatorio` (primeira exibição do relatório) e o aviso de "nenhum usuário retornou dados" **não** limpam — ficam anexados logo abaixo das linhas de progresso/erro por usuário que `ConsultarUsuarios` acabou de imprimir, para não escondê-las. Só quando o usuário pede explicitamente para trocar de tela (voltar ao relatório a partir do menu pós-busca, nova busca) é que `Tela.ExibirComCabecalho`/`Tela.Cabecalho` limpam antes. Ver §3. |
| **Parser de INI compartilhado** (`AnalisadorIni.Analisar`) | `TogglReport.ini` e `ToggleData.ini` têm o mesmo formato de seções/`chave=valor`; extrair o parser evita duas implementações idênticas. `CarregadorConfiguracaoIni` e `CarregadorCacheIni` só cuidam do mapeamento de/para seus próprios modelos. |
| **`TogglReport.ini` e `ToggleData.ini` como único estado persistente, dentro de `dados/`** | Em `AppContext.BaseDirectory/dados` (ao lado do exe — item 12 moveu os dois da raiz do executável para essa subpasta, criada por `Directory.CreateDirectory` na primeira gravação), sem banco; legíveis/editáveis à mão. Gravação com `try/catch` em ambos (falha não é fatal). `ToggleData.ini` guarda o retorno **cru** da API (sem agrupamento/cálculo) — carregar do cache nunca pula a etapa de processamento, só a chamada HTTP. |
| **Limite de 30 requisições/hora por usuário em memória** (`Toggl/LimitadorRequisicoes`) | Camada extra de segurança além do retry de 429 já existente em `ClienteApiToggl`; não persiste entre execuções (só durante o processo atual) — ver §7. Quando atingido, cai para o cache daquele usuário **somente se for do mesmo período e token**, para não misturar dado de outro período no relatório sem avisar. |
| **`ResultadoApiToggl<T>`** (`Ok`/`Falha`) | Erros esperados (401, 429, rede) não usam exceptions. |
| **Um `HttpClient` por `ClienteApiToggl` por usuário** | Basic Auth próprio; app de vida curta. |
| **Busca opera sobre dados em memória** | Já baixados (do cache ou da API); não repetir chamadas nem gastar rate limit. |
| **Classes estáticas nos serviços de `Relatorios`** | Sem estado; funções puras. |
| **Tipo explícito no lugar de `var`** | Preferência do projeto. |
| **Sem exportação para CSV** | Removida por completo (2026-09-05) — os dados só existem no console e no cache (`ToggleData.ini`); ver item 11 do histórico. |
| **Duração `HHhMMmSSs`** | Ex.: `03h30m15s`; horas podem passar de 24. |
| **Tag com N valores conta para cada tag** | Igual ao Toggl nativo; soma da visão "por tag" pode exceder o total. |
| **`AgruparPorTag` é case-insensitive** (`StringComparer.OrdinalIgnoreCase`) | Precisa bater com o casamento de "tag está em `TagsDetalhadas`?" (também `OrdinalIgnoreCase`); senão `"Cliente"` e `"cliente"` viravam grupos diferentes com totais que não fechavam com o detalhamento por descrição. |
| **Descrição truncada com `…` só na exibição** (`Tela.Ajustar(texto, largura)`) | Usado por `EscritorRelatorioConsole` e `EscritorBuscaDescricao` para caber na moldura; o dado cru (console via `RegistroTempoDto`/cache) nunca é truncado, só a exibição. |
| **Busca por descrição reaproveita `EscritorRelatorioConsole.ImprimirLinha`/`Indentacao`/`TituloSecaoDescricao`, não duplica** (item 12) | Antes era uma tabela-pivô com layout de colunas próprio (`EscritorTabelaBusca`, removida); agora é uma lista agrupada por descrição com detalhe por usuário indentado (`EscritorBuscaDescricao`), no mesmo estilo visual de "Por descrição" — reaproveita a mesma rotina de imprimir linha (`ImprimirLinha`, que passou a receber a indentação como parâmetro) em vez de calcular largura de coluna por conta própria. |
| **Normalização de "TEL" na chave de agrupamento, não só na exibição** (`ServicoAgrupamento.ChaveDescricao`/`NormalizarDescricaoTel`) | Fazer só na exibição faria a mesma descrição em grafias diferentes ("TEL-100-AA" / "TEL - 100 - AA") virar duas linhas idênticas na tela com totais separados — bug encontrado e corrigido no item 10. |
| **"Por descrição" tem duas versões de `AgruparPorDescricaoComTag`** (com e sem filtro por `tagsDetalhadas`) | Filtrar incondicionalmente deixaria o agrupamento "descricao" puro (sem "Por tag" para compensar) sempre vazio — bug encontrado e corrigido no item 10. |

---

## 5. Estrutura de arquivos

```
toggl-report/
 ├─ CLAUDE.md                          # este arquivo
 ├─ README.md                          # documentação para usuário final (pt-BR)
 ├─ LICENSE · .editorconfig · .gitattributes · TogglReport.slnx
 └─ TogglReport/
     ├─ Program.cs                     # orquestração: boas-vindas → coleta → cache/consulta → relatório → busca
     ├─ TogglReport.csproj             # net10.0, Exe, RootNamespace=RelatorioToggl, sem PackageReference
     ├─ icon.ico
     ├─ Apresentacao/
     │   ├─ Paleta.cs                  # cores (papéis fixos) + Escrever / EscreverLinha
     │   ├─ Tela.cs                    # BemVindo / Carregando / Cabecalho / ExibirComCabecalho / Despedida / Limpar / Inicializar
     │   ├─ Prompt.cs                  # Perguntar / Confirmar / EscolherOpcao (EOF → encerra)
     │   ├─ Rotulos.cs                 # Agrupamento(valor) → texto de exibição
     │   ├─ AssistenteConfiguracao.cs  # ColetarAsync + LerCampo genérico (1 método por campo)
     │   └─ MenuTokenUsuario.cs        # submenu [A]dicionar / [R]emover / [E]ditar / [C]oncluir
     ├─ Configuracao/
     │   ├─ ConfiguracaoApp.cs         # modelo do TogglReport.ini
     │   ├─ ConfiguracaoUsuario.cs     # Chave / NomeExibicao / TokenApi
     │   ├─ CarregadorConfiguracaoIni.cs  # Carregar / Salvar do dados/TogglReport.ini
     │   ├─ CacheConsulta.cs           # modelo do ToggleData.ini: período + List<UsuarioCacheado>
     │   ├─ UsuarioCacheado.cs         # Chave / NomeExibicao / TokenApi / Registros (dado cru)
     │   ├─ CarregadorCacheIni.cs      # Carregar / Salvar do dados/ToggleData.ini
     │   └─ AnalisadorIni.cs           # parser de INI compartilhado (Analisar/ObterOuPadrao/ObterOuNulo)
     ├─ Toggl/
     │   ├─ ClienteApiToggl.cs         # HTTP Basic contra api.track.toggl.com/api/v9
     │   ├─ RegistroTempoDto.cs        # DTO de time entry
     │   ├─ ResultadoApiToggl.cs       # envelope Ok/Falha
     │   └─ LimitadorRequisicoes.cs    # contador em memória do limite de 30 req/hora por usuário
     └─ Relatorios/
         ├─ ServicoAgrupamento.cs      # AgruparPorDescricaoComTag(filtrada e não)/Tag, NormalizarDescricaoTel, ObterConcluidos/EmAndamento, ObterTotalSegundos
         ├─ LinhaDescricao.cs          # record: descrição agrupada + tempo + tag representativa
         ├─ EscritorRelatorioConsole.cs# ImprimirRelatorioUsuario + ImprimirLinha/Indentacao/TituloSecaoDescricao (públicos) + FormatarDuracao (HHhMMmSSs)
         ├─ ServicoBuscaDescricao.cs   # Buscar(): agrupamento descrição → segundos por usuário
         ├─ LinhaBusca.cs              # record: descrição + segundos por usuário + total da linha
         ├─ ResultadoBuscaDescricao.cs # Linhas + TotalGeralSegundos
         └─ EscritorBuscaDescricao.cs  # imprime o resultado da busca no estilo de "Por descrição"
```

### Detalhes de domínio importantes

- **`RegistroTempoDto.Duracao`** (segundos): **valor negativo = timer em execução**
  — isolado por `ServicoAgrupamento.ObterEmAndamento`, fora dos totais.
- **`RegistroTempoDto.Tags`**: já resolvidas como nomes pela API.
- Rótulos: `(sem descrição)`, `(sem tag)`.
- **Chave do usuário no INI** (`[Usuario:<chave>]`): `nome` só com letras/dígitos,
  minúsculo, sufixo numérico em colisão. `NomeExibicao` é o rótulo dos relatórios.
- **Agrupamento** (interno e no INI): `descricao`, `tag`, `ambos`.
- **`ConfiguracaoApp.TagsDetalhadas`**: lista livre de tags (comparação `OrdinalIgnoreCase`);
  persistida como `TagsDetalhadas=tag1,tag2` no INI (vazia = `TagsDetalhadas=`). Só coletada
  pelo assistente quando o agrupamento inclui tag; preservada (não zerada) quando não coletada
  de novo. Com agrupamento "ambos": essas tags aparecem detalhadas em "Por descrição" e ficam
  totalmente fora de "Por tag"; as demais tags não aparecem em "Por descrição", só em "Por tag"
  (nome do campo mantido por compatibilidade com o INI — ver itens 9 e 10 do histórico).
- **"Por descrição" filtra por `TagsDetalhadas` e ordena por prefixo `"TEL"`**: com agrupamento
  "ambos", só entram entradas com pelo menos uma tag em `TagsDetalhadas` (as demais só contam no
  total de "Por tag"); com agrupamento "descricao" puro, entram todas (não há "Por tag" para
  compensar). Entre as que entram, as que começam com `TEL` (`OrdinalIgnoreCase`) vêm primeiro; as
  demais vêm depois, prefixadas com `"(tag) descrição"`
  (`ServicoAgrupamento.AgruparPorDescricaoComTag` / `EscritorRelatorioConsole.ImprimirSecaoDescricao`).
- **Descrições "TEL" normalizadas já na chave de agrupamento**: "TEL-0000-AA" / "TEL-0000 - AA" /
  "TEL - 0000 - AA" viram sempre `"TEL - 0000 - AA"` antes de somar os tempos — não só na exibição
  (`ServicoAgrupamento.NormalizarDescricaoTel`/`ChaveDescricao`). Só reformata quando há dígitos
  logo após "TEL"; não mexe em "TELA", "TELEFONE" etc.
- **Cache (`CacheConsulta`/`UsuarioCacheado`) guarda dado cru, indexado por `Chave` de usuário**
  (não por `NomeExibicao`, que pode ser editado): `DataInicio`/`DataFim` da consulta em `[Geral]`,
  e uma seção `[Usuario:<chave>]` por usuário com `NomeExibicao`, `TokenApi` e `Registros` (JSON
  compacto do `List<RegistroTempoDto>`, sem nenhum agrupamento aplicado). Bater os parâmetros
  (`CacheCorrespondeAosParametros`) exige mesmo período **e** todo usuário atual achar seu par no
  cache por `Chave` + `TokenApi` (mesmo tamanho de lista dos dois lados).
- **Limite de 30 requisições/hora é por processo, não persistido**: `LimitadorRequisicoes` guarda
  os timestamps em memória (`Dictionary<string, List<DateTime>>` estático); reinicia a cada execução
  do app. Não é o mesmo mecanismo do retry de 429 em `ClienteApiToggl` (esse continua ativo e trata
  o limite que a própria API do Toggl impõe).

### `TogglReport.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

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

### `ToggleData.ini` (exemplo) — em `AppContext.BaseDirectory/dados`

```ini
[Geral]
DataInicio=2026-08-01
DataFim=2026-08-31

[Usuario:joao]
NomeExibicao=Joao Silva
TokenApi=abcdef1234567890
Registros=[{"id":123456789,"workspace_id":1,"project_id":null,"description":"TEL-0433-AA","duration":3725,"tags":["Cliente X"],"start":"2026-08-01T13:00:00Z","stop":"2026-08-01T14:02:05Z"}]
```

### Arquivos gerados em runtime

| Arquivo | Onde | Conteúdo |
|---|---|---|
| `TogglReport.ini` | `AppContext.BaseDirectory/dados` | último período/agrupamento/tags/usuários confirmados |
| `ToggleData.ini` | `AppContext.BaseDirectory/dados` | retorno cru (sem agrupamento/cálculo) da última consulta bem-sucedida, por usuário |

A pasta `dados/` é criada sozinha (`Directory.CreateDirectory`) na primeira gravação, se ainda não
existir. Ambos no `.gitignore` (`TogglReport.ini`, `ToggleData.ini` — o padrão bate em qualquer
profundidade de pasta) — os dois guardam `TokenApi` em texto puro. Não há mais nenhum arquivo CSV
gerado (removido em 2026-09-05, item 11 do histórico).

---

## 6. Tratamento de erros (contratos — respeitar)

- **401 num usuário**: `ClienteApiToggl` devolve `Falha`; `ConsultarUsuarios`
  imprime `erro — …` e **pula o usuário**. Nunca aborta a execução.
- **429**: espera `Retry-After` (fallback 5 s) e tenta **uma vez** (`ehNovaTentativa`);
  se falhar de novo, reporta e pula.
- **Rede / HTTP não-2xx / JSON inválido**: `Falha` com a mensagem; usuário pulado.
- **Validação de token** (`MenuTokenUsuario`): `GET /me`. Se falhar: tentar de novo?
  Se não, "salvar assim mesmo, sem validação?".
- **`NomeExibicao` duplicado**: rejeitado no cadastro e na edição (é a chave dos
  dicionários de resultado; nomes iguais quebrariam relatório e busca).
- **Período com `fim < inicio`**: `AssistenteConfiguracao` repete a pergunta.
- **EOF (stdin fechado)**: `Prompt.LerEntrada` chama `Environment.Exit(0)` — o app
  encerra em vez de entrar em laço.
- **Falha ao carregar/salvar `ToggleData.ini`**: `try/catch (IOException or UnauthorizedAccessException)`
  em `CarregarCacheSeExistente`/`SalvarCache`, igual ao tratamento já existente para
  `TogglReport.ini` — não é fatal; sem cache utilizável, o app cai para a consulta normal.
- **Limite de 30 requisições/hora atingido para um usuário**: `ConsultarUsuarios` usa o
  `UsuarioCacheado` daquele usuário **só se for do mesmo período e token**; senão, reporta e pula o
  usuário (mesmo tratamento de uma falha comum de consulta — os demais usuários seguem).

---

## 7. Limitações conhecidas (assumidas — não são bugs)

- **App interativo**: assume terminal real. Com EOF/entrada redirecionada o app
  **encerra** (não trava mais), mas não há modo "batch"/não-interativo.
- **Sem paginação**: `GET /me/time_entries` traz tudo numa chamada; períodos longos
  podem dar **400** (limite de histórico da conta).
- **Não resolve nome de projeto/cliente** — só descrição e tag. `IdProjeto` existe
  no DTO mas não é usado.
- **`TogglReport.ini` e `ToggleData.ini` guardam os tokens em texto puro** — tratados como
  segredo, ambos no `.gitignore`, dentro da pasta `dados/` ao lado do executável.
- **`Tela.Inicializar()` mede a largura uma única vez, na abertura**: se o usuário redimensionar o
  terminal durante a execução, a moldura não se readapta — só na próxima vez que o app abrir.
- **Limite de 30 requisições/hora é só em memória, por processo**: reinicia a cada execução do
  app; não há persistência de quantas requisições já foram feitas entre uma execução e outra.
- Sem testes automatizados.

---

## 8. `.gitignore`

`TogglReport.ini` foi adicionado em 2026-09-02 (o `README` antigo dizia que o config já estava
ignorado, mas não estava). `ToggleData.ini` foi adicionado em 2026-09-05 junto com a criação do
cache (mesmo motivo — guarda tokens em texto puro, agora também dado bruto da conta Toggl). As
entradas `relatorio_*.csv`/`busca_*.csv` (de 2026-09-02) foram removidas em 2026-09-05 junto com a
exportação CSV (item 11 do histórico). Se o `.gitignore` for regenerado do template do GitHub,
**reaplicar as linhas de `TogglReport.ini` e `ToggleData.ini`**.

---

## 9. Convenções ao continuar o projeto

- **Tudo em pt-BR**; exceções: `Program`/`Main`, `Task`/`async`, `[JsonPropertyName]`
  com nomes da API, siglas (`Dto`, `Api`, `Ini`, `Http`).
- **Tipo explícito no lugar de `var`** sempre que o tipo puder ser nomeado.
- **Zero dependências NuGet** salvo decisão explícita.
- Toda saída/entrada de console passa por `Apresentacao/` (`Paleta`/`Tela`/`Prompt`)
  — nunca `Console.ForegroundColor` solto (escritores de relatório usam `Paleta`).
- Novo serviço em `Relatorios/`: classe estática, função pura.
- Fluxos de erro esperados: `ResultadoApiToggl<T>`, não exceptions.
- Comentário só quando explica um *porquê* ou regra de domínio não óbvia.
- `using` só para namespaces **não** cobertos pelo `ImplicitUsings` (ex.:
  `System.Text`, `System.Net`, `System.Text.Json*`). Não repetir `System`,
  `System.Linq`, `System.IO`, `System.Collections.Generic`, etc.
- `end_of_line = crlf` (via `.editorconfig` + `.gitattributes`), `charset = utf-8`
  (sem BOM em `.cs`).
- `dotnet build` após mudanças; manter **0 warnings**. Todo código sob
  `TogglReport/`; namespace começa com `RelatorioToggl`.

---

## 10. Projeto irmão

`C:\Projetos\gerador-chave-nfe\GeradorChaveNFe` segue as **mesmas convenções e o
mesmo funcionamento**: `Paleta.cs`, `Prompt.cs` e os helpers de moldura de `Tela.cs`
(`Borda`/`LinhaCentralizada`/`LinhaTexto`/`Centralizar`/`Ajustar`, `Carregando`, EOF → encerra) são
**idênticos**; o assistente (`LerCampo` genérico + reaproveitar/confirmar campo a
campo + confirmação final no `Program`) e a nomenclatura (`Gerar<X>EnquantoUsuarioQuiser`) foram
alinhados nos dois. Ao mudar uma convenção aqui, verificar se cabe lá. O `CLAUDE.md` de cada repо é
a fonte da verdade daquele projeto.

> **Pendência aberta (2026-09-04)**: `Despedida` deixou de ser idêntica — aqui ela envolve
> "Até a próxima!" numa moldura completa (item 9 do histórico); no `gerador-chave-nfe` ainda é
> só com os `║` das laterais. Replicar lá se fizer sentido para aquele projeto.

> **Pendência aberta (2026-09-05)**: dois pontos que eram idênticos entre os dois projetos deixaram
> de ser (item 12 do histórico) — verificar se cabe replicar no `gerador-chave-nfe`:
> 1. `Tela.Largura` aqui é dinâmica (`Tela.Inicializar()` mede `Console.WindowWidth`); lá continua
>    `const int Largura = 100` fixo.
> 2. O arquivo de config aqui foi movido para uma subpasta `dados/` (`AppContext.BaseDirectory/dados`);
>    lá continua solto direto em `AppContext.BaseDirectory` (`<AssemblyName>.ini`).

### Diferenças que permanecem (justificadas pelos domínios — não são pendências)

| Ponto | Aqui (toggl-report) | Lá (gerador-chave-nfe) | Por quê |
|---|---|---|---|
| Versão | `1.0.0` (`X.Y.Z`) | `1.0.3.0` (`X.Y.Z.W`) | Cada projeto tem a sua (decisão do autor). |
| `Main` | `async Task Main()` | `void Main()` | toggl faz chamadas HTTP. |
| Camada de saída | `Relatorios/` (agrupamento, escritores console/CSV, busca) | não há (só `ExibirChaves`) | toggl produz relatórios e CSV; o gerador só imprime chaves. |
| Integração externa | pasta `Toggl/` (`ClienteApiToggl` + DTOs) | não há | só o toggl fala com uma API. |
| Descrição de exibição | `Rotulos.Agrupamento` (o agrupamento é uma string de 3 valores, sem tipo) | `Uf.Descricao` / `TipoEmissao.Descricao` / `Competencia.Descrever` (há tipos de domínio) | onde há tipo, o rótulo mora nele; onde não há, num helper. |
| Nomes de pastas | `Configuracao/` · `Toggl/` · `Relatorios/` | `Dominio/` · `Geracao/` · `Persistencia/` | domínios de tamanho diferente; ambos coerentes internamente. |
