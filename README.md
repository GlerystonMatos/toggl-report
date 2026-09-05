# toggl-report

Console app em **C# / .NET 10** que gera relatórios de tempo trabalhado a partir da **API v9 do Toggl Track**, agrupando por descrição e/ou tag, por usuário, em um período informado. Totalmente interativo: um assistente guia a configuração (período, agrupamento e API Tokens) e persiste tudo em um `TogglReport.ini` dentro da pasta `dados`, ao lado do executável. O retorno cru de cada consulta bem-sucedida é guardado em `dados/ToggleData.ini`, para reaproveitar os dados sem gastar requisições à API quando o período e os usuários não mudaram.

## Índice

- [toggl-report](#toggl-report)
  - [Índice](#índice)
  - [Funcionalidades](#funcionalidades)
  - [Requisitos](#requisitos)
  - [Instalação](#instalação)
  - [Como usar](#como-usar)
  - [Fluxo de configuração (assistente)](#fluxo-de-configuração-assistente)
  - [Cache de consulta (ToggleData.ini)](#cache-de-consulta-toggledataini)
  - [Relatório no console](#relatório-no-console)
  - [Busca por descrição](#busca-por-descrição)
  - [Arquivo TogglReport.ini](#arquivo-togglreportini)
  - [Saídas geradas](#saídas-geradas)
  - [Estrutura do projeto](#estrutura-do-projeto)
  - [Como obter seu API Token do Toggl](#como-obter-seu-api-token-do-toggl)
  - [Limitações conhecidas](#limitações-conhecidas)
  - [Segurança](#segurança)
  - [Licença](#licença)

## Funcionalidades

- Consulta o Toggl Track (`GET /me/time_entries`) usando o **API Token pessoal** de cada usuário cadastrado.
- Relatório por usuário, agrupado por **descrição**, por **tag**, ou ambos.
- **Tags configuradas aparecem detalhadas em "Por descrição" e saem de "Por tag"**: você escolhe quais tags (com agrupamento "ambos"); as demais ficam de fora de "Por descrição" (só entram no total de "Por tag").
- **Descrições de ticket "TEL" sempre no mesmo formato**: "TEL-0000-AA", "TEL-0000 - AA" etc. viram "TEL - 0000 - AA" — já na hora de somar os tempos, não só na exibição.
- Identifica e lista separadamente entradas com **timer ainda em execução** (não entram nos totais).
- **Cache de consulta** (`dados/ToggleData.ini`): o retorno cru da última consulta de cada usuário fica salvo; se o período e os usuários da próxima execução forem iguais, o app oferece carregar do cache em vez de consultar a API de novo (o agrupamento e os cálculos rodam sempre em cima do dado, cacheado ou não — o cache nunca guarda um resultado já processado).
- **Limite de 30 requisições/hora por usuário**: um contador em memória evita novas chamadas além desse limite dentro da mesma execução; se atingido, usa o cache (quando disponível para o mesmo período) em vez de consultar.
- **Busca por parte da descrição**, agrupada por descrição e detalhada por usuário no mesmo estilo visual do relatório completo (mesmo título "── Por descrição ──", mesma formatação de linha com duração alinhada à direita); depois de cada busca, o app oferece voltar ao relatório completo, fazer nova busca ou continuar o fluxo normal.
- Assistente interativo para cadastrar, editar e remover usuários/tokens, com **validação do token na hora** (chamada a `GET /me`).
- Reaproveita a última configuração salva (período, agrupamento, usuários) a cada execução, perguntando se quer manter ou alterar.
- Interface de console com **tela de boas-vindas**, **carregamento**, **cabeçalho fixo** (resumo dos parâmetros já escolhidos) e **padrão de cores** consistente; toda troca de tela limpa o console e redesenha o cabeçalho antes do novo conteúdo.
- **Moldura adaptada à largura do terminal**: usa o espaço realmente disponível na janela (nunca mais largo que ela, para não quebrar linhas), com um padrão de 100 colunas quando a largura não pode ser detectada (saída redirecionada).
- **Zero dependências externas** — parser de INI e banner feitos à mão, então `dotnet build`/`dotnet run` funcionam sem acesso ao NuGet.org.

## Requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) ou superior
- Um **API Token** pessoal do Toggl Track para cada usuário que você queira incluir no relatório

## Instalação

```bash
git clone https://github.com/GlerystonMatos/toggl-report
cd toggl-report
dotnet build
```

## Como usar

```bash
dotnet run --project TogglReport
```

Na primeira execução, o app vai guiar você por um cadastro inicial (agrupamento padrão, usuários/tokens, período) e cria a pasta `dados` ao lado do executável. Nas execuções seguintes, ele carrega o `dados/TogglReport.ini` já existente e, se houver um `dados/ToggleData.ini` da última consulta com o mesmo período e usuários, oferece reaproveitá-lo.

## Fluxo de configuração (assistente)

O assistente pede, **campo a campo**: **agrupamento** (descrição / tag / ambos), **tags que não devem aparecer em "Por tag"** (só quando o agrupamento inclui tag), **usuários/tokens** (submenu) e **período** (data início / data fim). Para cada campo, se há um valor salvo válido o app pergunta se quer **reaproveitá-lo**; senão, você informa e **confirma** o valor. Ao final, o cabeçalho mostra o resumo (período e agrupamento), a **lista de usuários selecionados** (um por linha, na mesma cor do resumo) é exibida logo abaixo, e você confirma a consulta.

```
╔════════════════════════════════════════════════════════════════════════════════════════════════════╗
║ RELATÓRIO TOGGL · por Gleryston Matos · v1.0.0                                                     ║
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

> A tela de abertura e o cabeçalho usam a mesma moldura, dimensionada para a largura atual do terminal (padrão de 100 colunas quando não é possível detectar, por exemplo com saída redirecionada).

**Gerenciamento de usuários/tokens** (submenu):
```
 Usuários cadastrados:
   1. Joao Silva  (token: abcd...7890)
   2. Maria Souza  (token: 0987...4cba)

 O que deseja fazer?
   [A] Adicionar   [R] Remover   [E] Editar   [C] Concluir
```
Ao adicionar ou editar um token, o app valida contra a API (`GET /me`) antes de salvar; se a validação falhar, pergunta se quer tentar novamente ou salvar mesmo assim.

## Cache de consulta (ToggleData.ini)

Depois de uma consulta bem-sucedida, o app grava o retorno cru da API (as time entries de cada usuário, sem nenhum agrupamento ou cálculo aplicado) em `dados/ToggleData.ini`, ao lado do executável. Na próxima execução, se o período e o conjunto de usuários/tokens confirmados forem **exatamente iguais** aos da última consulta salva, o app pergunta:

```
 Os parâmetros são iguais aos da última consulta salva. Deseja consultar novamente à API? [s/N]:
```

- **Enter (padrão) ou "não"**: carrega os dados do cache — o agrupamento, os cálculos de duração e a normalização de descrições "TEL" continuam rodando normalmente em cima desses dados, só a chamada à API é pulada.
- **"sim"**: consulta a API de novo e sobrescreve o cache com o novo retorno.

Se qualquer parâmetro mudar (período ou usuários), ou não houver cache ainda, o app segue direto para a consulta normal. O cache também é usado como reserva automática quando o **limite de 30 requisições/hora por usuário** é atingido durante uma consulta: nesse caso, o usuário afetado usa o dado em cache (se for do mesmo período) em vez de ficar sem dados.

## Relatório no console

Cada usuário recebe um bloco cujo título (`═══`) e os títulos de seção (`── Por descrição ──` / `── Por tag ──` / `── Em andamento ──`) se estendem pela largura da moldura; entre as seções há só uma quebra de linha, sem separador. As durações mostram horas, minutos **e segundos** (`HHhMMmSSs`); a coluna de descrição é dimensionada linha a linha para que a duração (ou, em "Em andamento", o "iniciado às...") sempre termine bem no fim da linha, truncando com `…` quando necessário. Depois do último usuário, uma linha dupla (`═══...`, mesma cor do título de cada usuário) separa a listagem do restante do fluxo.

- **Por descrição**: só mostra entradas de alguma tag configurada (as que você disse que NÃO devem aparecer em "Por tag" — ver "Fluxo de configuração" acima); as demais (sem tag, ou só com tags fora da lista) não aparecem aqui, só entram no total de "Por tag". *Exceção*: com agrupamento "descrição" (sem "Por tag" na tela), a listagem mostra tudo sem esse filtro, já que não haveria onde totalizar o que ficasse de fora. Entre as que aparecem, as que **começam com "TEL"** vêm primeiro; as demais vêm depois, prefixadas com `(tag)`. Descrições "TEL" em grafias diferentes ("TEL-0000-AA", "TEL-0000 - AA", "TEL-0000-AA") são somadas juntas e sempre exibidas como `TEL - 0000 - AA`.
- **Por tag**: lista as tags, exceto as configuradas acima (essas ficam de fora por completo, sem nem uma linha de total — seus registros aparecem detalhados em "Por descrição" em vez daqui). As tags que aparecem mostram só a tag e o tempo total.

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

No exemplo, "Cliente X" foi configurada para não aparecer em "Por tag" — some da segunda seção por completo; suas entradas (incluindo os dois tickets "TEL", cujas entradas foram lançadas com grafias diferentes e por isso somaram no mesmo total) aparecem detalhadas em "Por descrição". As demais entradas (sem tag, ou tag "Interno") só contam no total de "Por tag", sem aparecer em "Por descrição".

## Busca por descrição

Depois do relatório principal, o app oferece buscas repetidas por parte da descrição, cruzando **todos os usuários já consultados** naquela execução (sem nova chamada à API). O resultado é agrupado por descrição e detalhado por usuário, no mesmo estilo visual (título, indentação e duração alinhada à direita) da seção "Por descrição" do relatório completo:

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

     Reunião de retrospectiva                                                          00h45m00s
       João Silva                                                                      00h45m00s

   Total geral: 08h15m00s

 O que deseja fazer?
   1 - Voltar ao relatório completo   2 - Nova busca por descrição   3 - Continuar
```
- Busca por substring, **case-insensitive**.
- Cada descrição aparece com o total somado de todos os usuários; abaixo dela, uma linha por usuário que tem tempo lançado naquela descrição (usuário sem registro simplesmente não aparece), ordenadas por tempo decrescente. Uma linha em branco separa cada grupo de descrição do próximo.
- A descrição (e o nome de usuário, nas linhas de detalhe) trunca com `…` na medida do necessário para não ultrapassar a largura da moldura — mesma regra do relatório completo.
- Depois de cada busca, três opções: **voltar ao relatório completo** (reexibe o relatório e pergunta de novo se quer buscar), **nova busca por descrição** (pede outro termo direto, sem repetir a pergunta inicial) ou **continuar** (segue para "Deseja executar novamente?").

## Arquivo TogglReport.ini

Gerado/atualizado automaticamente na pasta `dados`, ao lado do executável (`AppContext.BaseDirectory/dados`):

```ini
[Geral]
DataInicioAnterior=2026-08-01
DataFimAnterior=2026-08-31
AgrupamentoPadrao=ambos
TagsDetalhadas=Cliente X,Urgente

[Usuario:joao]
NomeExibicao=Joao Silva
TokenApi=abcdef1234567890

[Usuario:maria]
NomeExibicao=Maria Souza
TokenApi=0987654321fedcba
```

| Campo | Descrição |
|---|---|
| `DataInicioAnterior` / `DataFimAnterior` | Último período consultado, usado como sugestão na próxima execução |
| `AgrupamentoPadrao` | `descricao`, `tag` ou `ambos` |
| `TagsDetalhadas` | Tags (separadas por vírgula) que aparecem detalhadas em "Por descrição" e ficam **fora** de "Por tag" no console (com agrupamento "ambos"); as demais não aparecem em "Por descrição", só em "Por tag" |
| `[Usuario:<chave>]` | Uma seção por usuário cadastrado; `<chave>` é gerada automaticamente a partir do nome |
| `NomeExibicao` | Nome de exibição nos relatórios |
| `TokenApi` | API Token pessoal do Toggl Track do usuário |

`ToggleData.ini`, na mesma pasta `dados`, segue o mesmo estilo (`[Geral]` com `DataInicio`/`DataFim`, uma seção `[Usuario:<chave>]` por usuário com `NomeExibicao`, `TokenApi` e `Registros` — o JSON cru das time entries daquele usuário no período). Ver [Cache de consulta](#cache-de-consulta-toggledataini).

## Saídas geradas

| Arquivo | Onde | Conteúdo |
|---|---|---|
| Console | — | Relatório por usuário (agrupamentos + entradas em andamento + total) e resultado de buscas |
| `TogglReport.ini` | `dados/`, ao lado do executável | Último período/agrupamento/tags/usuários confirmados |
| `ToggleData.ini` | `dados/`, ao lado do executável | Retorno cru (sem agrupamento/cálculo) da última consulta bem-sucedida, por usuário |

## Estrutura do projeto

```
TogglReport/
 ├─ Program.cs                          # Orquestração: boas-vindas → assistente → cache/consulta → relatório → busca
 ├─ Apresentacao/
 │   ├─ Paleta.cs                       # Padrão de cores do console
 │   ├─ Tela.cs                         # Boas-vindas, carregamento, cabeçalho, despedida, dimensionamento da moldura
 │   ├─ Prompt.cs                       # Perguntar / Confirmar / EscolherOpcao (EOF → encerra)
 │   ├─ Rotulos.cs                      # Rótulos de exibição
 │   ├─ AssistenteConfiguracao.cs       # Coleta campo a campo (LerCampo genérico, reaproveitar/confirmar)
 │   └─ MenuTokenUsuario.cs             # Submenu adicionar/remover/editar usuários
 ├─ Configuracao/
 │   ├─ ConfiguracaoApp.cs              # Modelo do TogglReport.ini
 │   ├─ ConfiguracaoUsuario.cs         # Modelo de cada usuário/token
 │   ├─ CarregadorConfiguracaoIni.cs   # Parser/writer do TogglReport.ini
 │   ├─ CacheConsulta.cs               # Modelo do ToggleData.ini (período + lista de usuários cacheados)
 │   ├─ UsuarioCacheado.cs             # Modelo de cada usuário no cache (dado cru da API)
 │   ├─ CarregadorCacheIni.cs          # Parser/writer do ToggleData.ini
 │   └─ AnalisadorIni.cs               # Parser de INI compartilhado (seções + chave=valor)
 ├─ Toggl/
 │   ├─ ClienteApiToggl.cs             # Cliente HTTP (Basic Auth) para api.track.toggl.com/api/v9
 │   ├─ RegistroTempoDto.cs            # DTO de time entry
 │   ├─ ResultadoApiToggl.cs           # Envelope de sucesso/erro das chamadas
 │   └─ LimitadorRequisicoes.cs        # Contador em memória do limite de 30 requisições/hora por usuário
 └─ Relatorios/
     ├─ ServicoAgrupamento.cs          # Agrupamento por descrição (com tag) / tag / entradas em andamento
     ├─ LinhaDescricao.cs              # Record: descrição agrupada + tempo + tag representativa
     ├─ EscritorRelatorioConsole.cs    # Impressão do relatório por usuário (ImprimirLinha reaproveitado pela busca)
     ├─ ServicoBuscaDescricao.cs       # Busca por substring + agrupamento descrição × usuário
     ├─ LinhaBusca.cs                  # Record: descrição buscada + segundos por usuário + total da linha
     ├─ ResultadoBuscaDescricao.cs     # Modelo do resultado da busca (linhas + total geral)
     └─ EscritorBuscaDescricao.cs      # Impressão do resultado da busca, no estilo de "Por descrição"
```

O namespace raiz do código é `RelatorioToggl`; o executável gerado continua
`TogglReport`.

## Como obter seu API Token do Toggl

1. Acesse [track.toggl.com](https://track.toggl.com/) e faça login.
2. Vá em **Profile Settings** (ícone de perfil no canto).
3. Role até o final da página — o **API Token** está lá.
4. Copie e cole quando o assistente pedir.

## Limitações conhecidas

- App interativo — assume um terminal real; com EOF/entrada redirecionada o app **encerra** (não trava), mas não há modo não-interativo.
- Sem paginação: `/me/time_entries` retorna tudo do período numa única chamada. Períodos muito longos podem ser lentos ou esbarrar em limites de histórico de algumas contas (retorna erro 400, exibido na tela).
- As datas escolhidas são tratadas como dias no **fuso local** e convertidas para UTC na chamada à API.
- Não busca nomes de projeto/cliente — agrupamento é só por descrição e tag.
- Rate limit (HTTP 429 da própria API): uma tentativa automática de retry respeitando `Retry-After`; se ocorrer de novo, o erro é reportado e aquele usuário é pulado (os demais continuam). Além disso, o app impõe seu próprio limite de **30 requisições/hora por usuário**, controlado em memória — vale só durante a execução atual do processo, não persiste entre execuções.
- Erros de autenticação (401) em um usuário não interrompem a consulta dos demais.
- A moldura só é medida uma vez, na abertura do app; redimensionar o terminal durante a execução não a readapta (só na próxima vez que o app abrir).

## Segurança

O `TogglReport.ini` e o `ToggleData.ini`, ambos na pasta `dados`, armazenam os API Tokens em **texto puro** (o segundo também guarda o retorno cru das consultas). Recomendações:
- Não versionar esses arquivos (já inclusos no `.gitignore`).
- Tratar como segredo — qualquer pessoa com o token tem acesso de leitura/escrita à conta Toggl correspondente.
- Se precisar compartilhar o projeto, distribua apenas o código-fonte, nunca os arquivos `.ini` gerados.

## Licença

`toggl-report` é um projeto livre e de código aberto licenciado sob a [MIT License](./LICENSE).
