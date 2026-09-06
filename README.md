# toggl-report  <img alt="caronte" height="20" src="https://github.com/GlerystonMatos/toggl-report/blob/main/toggl-report.png">

Conjunto de aplicações que geram relatórios de tempo trabalhado a partir da **API v9 do Toggl Track**, agrupando por descrição e/ou tag, por usuário, em um período informado — incluindo uma visualização em **Gráfico de Gantt** por usuário/dia (só na versão web).

Este repositório reúne três projetos independentes:

## [`toggl-report-back/`](./toggl-report-back/README.md) — C# / .NET 10

Console interativo original **+** uma Web API local (sem autenticação, documentada via Swagger) que expõe as mesmas funcionalidades, além de uma biblioteca compartilhada entre os dois. Consulta o Toggl Track, faz cache do retorno em INI (`dados/`), agrupa por descrição/tag e permite busca por parte da descrição.

➡️ **[Documentação completa do back-end](./toggl-report-back/README.md)**

## [`toggl-report-front/`](./toggl-report-front/README.md) — React + TypeScript + MUI

Frontend web que consome a Web API acima, replicando o mesmo fluxo do console (parâmetros → usuários/tokens → consulta → relatório → busca) em uma interface gráfica local.

➡️ **[Documentação completa do frontend](./toggl-report-front/README.md)**

## [`toggl-report-infra/`](./toggl-report-infra/README.md) — Terraform + GCP

Infraestrutura de deploy em produção no Google Cloud (Cloud Run + Cloud Build + Artifact Registry), com premissa de custo zero — scale-to-zero, sem banco de dados, e um killswitch de billing isolado num projeto GCP separado para proteger contra estouro de orçamento.

➡️ **[Documentação completa da infra](./toggl-report-infra/README.md)**

## Como rodar os dois juntos

```bash
# 1. Web API (porta fixa 5180)
dotnet run --project toggl-report-back/TogglReport.Api

# 2. Frontend (em outro terminal)
cd toggl-report-front && npm install && npm run dev
```

O console pode ser usado independentemente da API/frontend — veja o [README do back-end](./toggl-report-back/README.md) para rodá-lo sozinho.

## Como rodar com Docker

```bash
cp .env.example .env
```
Preencha `KESTREL_CERT_PASSWORD` com a senha real do certificado em
`./certificado/certificado.pfx` — o `docker-compose.yml` lê essa senha do
`.env` (gitignored), nunca em texto puro no arquivo versionado.

```bash
docker-compose up -d --build
```

Sobe a Api em `http://localhost:5003` e o frontend em `http://localhost:3002`.
O endereço da Api que o frontend consome é fixado **no build da imagem**
(`VITE_API_URL`, ver [README do frontend](./toggl-report-front/README.md#configurando-o-endereço-do-backend)) —
para apontar para outro endereço, ajuste `args.VITE_API_URL` do serviço
`toggl_report_web` em `docker-compose.yml` e rode `docker-compose up -d --build`
de novo.

## Segurança

Os arquivos `TogglRelatorioParametros.ini`/`TogglRelatorioData.ini` (gerados na pasta `dados/` de cada executável) guardam API Tokens do Toggl em **texto puro** e nunca são versionados (`.gitignore`). A Web API não tem autenticação — destinada a uso exclusivamente local.

Revisado (2026-09-06) o conteúdo rastreado pelo Git em busca de segredos antes deste repositório se tornar público: nenhuma chave de API, token do GitHub/GCP, credencial de service account ou dado real de usuário foi encontrado versionado. Dois pontos corrigidos: a senha do certificado HTTPS do `docker-compose.yml` estava em texto puro — movida para `.env` (gitignored, com `.env.example` como template); e os IDs reais dos dois projetos GCP foram substituídos por placeholders (`SEU_PROJETO_APP_ID`/`SEU_PROJETO_FINOPS_ID`) em todo `toggl-report-infra/` e nos READMEs — nenhum identificador real de projeto GCP permanece versionado.

## Licença

`toggl-report` é um projeto livre e de código aberto licenciado sob a [MIT License](./LICENSE).