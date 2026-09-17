using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Jira;

namespace RelatorioToggl.Api.Endpoints;

public static class JiraEndpoints
{
    public static void MapJiraEndpoints(this WebApplication app, string caminhoConfiguracoesGerais, string caminhoCacheListasJira, string caminhoCoresJira)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/jira").WithTags("Jira");

        grupo.MapGet("/configuracao", () =>
        {
            ConfiguracaoJira configuracao = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais) ?? new ConfiguracaoJira();
            return Results.Ok(ParaDto(configuracao));
        })
        .WithSummary("Obtém a configuração do Jira salva (API Token mascarado)");

        grupo.MapPut("/configuracao", (SalvarConfiguracaoJiraRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.UrlDominio))
                return Results.BadRequest("URL do domínio é obrigatória.");

            if (string.IsNullOrWhiteSpace(request.Email))
                return Results.BadRequest("E-mail é obrigatório.");

            ConfiguracaoJira configuracao = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais) ?? new ConfiguracaoJira();

            if (string.IsNullOrWhiteSpace(configuracao.ApiToken) && string.IsNullOrWhiteSpace(request.ApiToken))
                return Results.BadRequest("API Token é obrigatório.");

            configuracao.UrlDominio = request.UrlDominio.Trim();
            configuracao.Email = request.Email.Trim();
            if (!string.IsNullOrWhiteSpace(request.ApiToken))
                configuracao.ApiToken = request.ApiToken.Trim();
            configuracao.CampoEstimativaDesenvolvimentoId = request.CampoEstimativaDesenvolvimentoId;
            configuracao.CampoEstimativaDesenvolvimentoNome = request.CampoEstimativaDesenvolvimentoNome;
            configuracao.CampoRevisadoPorId = request.CampoRevisadoPorId;
            configuracao.CampoRevisadoPorNome = request.CampoRevisadoPorNome;
            configuracao.CampoEstimativaRevisaoId = request.CampoEstimativaRevisaoId;
            configuracao.CampoEstimativaRevisaoNome = request.CampoEstimativaRevisaoNome;
            configuracao.CampoEstimativaTestesId = request.CampoEstimativaTestesId;
            configuracao.CampoEstimativaTestesNome = request.CampoEstimativaTestesNome;

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoJiraIni.Salvar(caminhoConfiguracoesGerais, configuracao),
                "Não foi possível salvar a configuração do Jira.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(ParaDto(configuracao));
        })
        .WithSummary("Salva/atualiza a configuração do Jira (URL, e-mail, API Token e campos de estimativa de desenvolvimento, revisão, testes e revisado por)");

        grupo.MapPost("/testar-conexao", async (TestarConexaoJiraRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.UrlDominio) || string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.ApiToken))
                return Results.Ok(new TestarConexaoJiraResponse(false, "Preencha URL do domínio, e-mail e API Token."));

            ClienteApiJira? cliente = CriarCliente(request.UrlDominio, request.Email, request.ApiToken, out string? erroUrl);
            if (cliente is null)
                return Results.Ok(new TestarConexaoJiraResponse(false, erroUrl));

            ResultadoApiJira<bool> resultado = await cliente.TestarConexaoAsync();
            return Results.Ok(new TestarConexaoJiraResponse(resultado.Sucesso, resultado.Sucesso ? "Conexão bem-sucedida." : resultado.MensagemErro));
        })
        .WithSummary("Testa a conexão com o Jira usando as credenciais informadas, sem salvar (GET /rest/api/3/myself)");

        grupo.MapPost("/campos", async (ObterCamposJiraRequest request) =>
        {
            string urlDominio = request.UrlDominio ?? "";
            string email = request.Email ?? "";
            string apiToken = request.ApiToken ?? "";

            if (string.IsNullOrWhiteSpace(urlDominio) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(apiToken))
            {
                ConfiguracaoJira? configuracaoSalva = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais);
                if (configuracaoSalva is null || string.IsNullOrWhiteSpace(configuracaoSalva.ApiToken))
                    return Results.BadRequest("Informe URL do domínio, e-mail e API Token, ou salve a configuração do Jira primeiro.");

                urlDominio = configuracaoSalva.UrlDominio;
                email = configuracaoSalva.Email;
                apiToken = configuracaoSalva.ApiToken;
            }

            ClienteApiJira? cliente = CriarCliente(urlDominio, email, apiToken, out string? erroUrl);
            if (cliente is null)
                return Results.BadRequest(erroUrl);

            ResultadoApiJira<List<CampoJira>> resultado = await cliente.ObterCamposAsync();
            if (!resultado.Sucesso)
                return Results.BadRequest(resultado.MensagemErro);

            List<CampoJiraDto> campos = resultado.Dados!.Select(campo => new CampoJiraDto(campo.Id, campo.Nome)).ToList();
            return Results.Ok(campos);
        })
        .WithSummary("Lista os campos customizados do Jira (GET /rest/api/3/field) para escolher o de estimativa de esforço");

        grupo.MapPost("/issues", async (BuscarIssuesJiraRequest request) =>
        {
            ConfiguracaoJira? configuracaoSalva = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais);
            if (configuracaoSalva is null || string.IsNullOrWhiteSpace(configuracaoSalva.ApiToken))
                return Results.BadRequest("Salve a configuração do Jira primeiro (POST /api/jira/configuracao).");

            ClienteApiJira? cliente = CriarCliente(configuracaoSalva.UrlDominio, configuracaoSalva.Email, configuracaoSalva.ApiToken, out string? erroUrl);
            if (cliente is null)
                return Results.BadRequest(erroUrl);

            ResultadoApiJira<List<IssueJira>> resultado = await cliente.BuscarIssuesAsync(request.Codigos, configuracaoSalva.CampoEstimativaDesenvolvimentoId, configuracaoSalva.CampoRevisadoPorId, configuracaoSalva.CampoEstimativaRevisaoId, configuracaoSalva.CampoEstimativaTestesId);
            if (!resultado.Sucesso)
                return Results.BadRequest(resultado.MensagemErro);

            List<IssueJiraDto> issues = resultado.Dados!
                .Select(issue => new IssueJiraDto(issue.Chave, issue.Prioridade, issue.Situacao, issue.EstimativaDesenvolvimentoHoras, issue.UrlIssue, issue.SituacaoCategoria, issue.Responsavel, issue.RevisadoPor, issue.EstimativaRevisaoHoras, issue.EstimativaTestesHoras))
                .ToList();
            return Results.Ok(issues);
        })
        .WithSummary("Busca em lote (JQL key in (...)) prioridade, situação e estimativas de desenvolvimento/revisão/testes, usando a configuração já salva");

        grupo.MapGet("/status", async (bool forcarAtualizacao) =>
        {
            if (!forcarAtualizacao)
            {
                CacheListaJira? cacheExistente = CarregadorCacheListasJiraIni.CarregarStatus(caminhoCacheListasJira);
                if (cacheExistente is not null)
                    return Results.Ok(new ListaJiraResponse(cacheExistente.Nomes, true, cacheExistente.AtualizadoEm));
            }

            ConfiguracaoJira? configuracaoSalva = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais);
            if (configuracaoSalva is null || string.IsNullOrWhiteSpace(configuracaoSalva.ApiToken))
                return Results.BadRequest("Salve a configuração do Jira primeiro (POST /api/jira/configuracao).");

            ClienteApiJira? cliente = CriarCliente(configuracaoSalva.UrlDominio, configuracaoSalva.Email, configuracaoSalva.ApiToken, out string? erroUrl);
            if (cliente is null)
                return Results.BadRequest(erroUrl);

            ResultadoApiJira<List<string>> resultado = await cliente.ObterStatusAsync();
            if (!resultado.Sucesso)
                return Results.Problem(resultado.MensagemErro, statusCode: StatusCodes.Status502BadGateway);

            string atualizadoEm = DateTime.UtcNow.ToString("O");
            CacheListaJira cache = new() { Nomes = resultado.Dados!, AtualizadoEm = atualizadoEm };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorCacheListasJiraIni.SalvarStatus(caminhoCacheListasJira, cache),
                "Não foi possível salvar o cache de status do Jira.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new ListaJiraResponse(cache.Nomes, false, atualizadoEm));
        })
        .WithSummary("Lista os status reais do Jira (GET /rest/api/3/status), cacheados até atualização manual");

        grupo.MapGet("/prioridades", async (bool forcarAtualizacao) =>
        {
            if (!forcarAtualizacao)
            {
                CacheListaJira? cacheExistente = CarregadorCacheListasJiraIni.CarregarPrioridades(caminhoCacheListasJira);
                if (cacheExistente is not null)
                    return Results.Ok(new ListaJiraResponse(cacheExistente.Nomes, true, cacheExistente.AtualizadoEm));
            }

            ConfiguracaoJira? configuracaoSalva = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais);
            if (configuracaoSalva is null || string.IsNullOrWhiteSpace(configuracaoSalva.ApiToken))
                return Results.BadRequest("Salve a configuração do Jira primeiro (POST /api/jira/configuracao).");

            ClienteApiJira? cliente = CriarCliente(configuracaoSalva.UrlDominio, configuracaoSalva.Email, configuracaoSalva.ApiToken, out string? erroUrl);
            if (cliente is null)
                return Results.BadRequest(erroUrl);

            ResultadoApiJira<List<string>> resultado = await cliente.ObterPrioridadesAsync();
            if (!resultado.Sucesso)
                return Results.Problem(resultado.MensagemErro, statusCode: StatusCodes.Status502BadGateway);

            string atualizadoEm = DateTime.UtcNow.ToString("O");
            CacheListaJira cache = new() { Nomes = resultado.Dados!, AtualizadoEm = atualizadoEm };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorCacheListasJiraIni.SalvarPrioridades(caminhoCacheListasJira, cache),
                "Não foi possível salvar o cache de prioridades do Jira.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new ListaJiraResponse(cache.Nomes, false, atualizadoEm));
        })
        .WithSummary("Lista as prioridades reais do Jira (GET /rest/api/3/priority), cacheadas até atualização manual");

        grupo.MapGet("/usuarios", async (bool forcarAtualizacao) =>
        {
            if (!forcarAtualizacao)
            {
                CacheListaJira? cacheExistente = CarregadorCacheListasJiraIni.CarregarUsuarios(caminhoCacheListasJira);
                if (cacheExistente is not null)
                    return Results.Ok(new ListaJiraResponse(cacheExistente.Nomes, true, cacheExistente.AtualizadoEm));
            }

            ConfiguracaoJira? configuracaoSalva = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais);
            if (configuracaoSalva is null || string.IsNullOrWhiteSpace(configuracaoSalva.ApiToken))
                return Results.BadRequest("Salve a configuração do Jira primeiro (POST /api/jira/configuracao).");

            ClienteApiJira? cliente = CriarCliente(configuracaoSalva.UrlDominio, configuracaoSalva.Email, configuracaoSalva.ApiToken, out string? erroUrl);
            if (cliente is null)
                return Results.BadRequest(erroUrl);

            ResultadoApiJira<List<string>> resultado = await cliente.ObterUsuariosAsync();
            if (!resultado.Sucesso)
                return Results.Problem(resultado.MensagemErro, statusCode: StatusCodes.Status502BadGateway);

            string atualizadoEm = DateTime.UtcNow.ToString("O");
            CacheListaJira cache = new() { Nomes = resultado.Dados!, AtualizadoEm = atualizadoEm };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorCacheListasJiraIni.SalvarUsuarios(caminhoCacheListasJira, cache),
                "Não foi possível salvar o cache de usuários do Jira.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new ListaJiraResponse(cache.Nomes, false, atualizadoEm));
        })
        .WithSummary("Lista os usuários reais do Jira (GET /rest/api/3/users/search, contas Atlassian ativas), cacheados até atualização manual");

        grupo.MapGet("/usuarios-mapeamento", () =>
        {
            ConfiguracaoMapeamentoJiraToggl configuracao = CarregadorConfiguracaoMapeamentoJiraTogglIni.Carregar(caminhoConfiguracoesGerais);
            return Results.Ok(new MapeamentoJiraTogglDto(ParaDto(configuracao.Mapeamento)));
        })
        .WithSummary("Obtém o mapeamento configurável de usuário do Jira (displayName) para usuário do Toggl (Chave), com Sigla/Cor para usuários exclusivos do Jira");

        grupo.MapPut("/usuarios-mapeamento", (AtualizarMapeamentoJiraTogglRequest request) =>
        {
            ConfiguracaoMapeamentoJiraToggl configuracao = new()
            {
                Mapeamento = Normalizar(request.Mapeamento)
            };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoMapeamentoJiraTogglIni.Salvar(caminhoConfiguracoesGerais, configuracao),
                "Não foi possível salvar o mapeamento de usuários Jira/Toggl.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new MapeamentoJiraTogglDto(ParaDto(configuracao.Mapeamento)));
        })
        .WithSummary("Atualiza o mapeamento configurável de usuário do Jira (displayName) para usuário do Toggl (Chave), com Sigla/Cor para usuários exclusivos do Jira");

        grupo.MapGet("/cores", () =>
        {
            ConfiguracaoCoresJira configuracao = CarregadorConfiguracaoCoresJiraIni.Carregar(caminhoCoresJira);
            return Results.Ok(new CoresJiraDto(configuracao.CoresStatus, configuracao.CoresPrioridade));
        })
        .WithSummary("Obtém o mapeamento configurável de cores por status e por prioridade do Jira");

        grupo.MapPut("/cores", (AtualizarCoresJiraRequest request) =>
        {
            ConfiguracaoCoresJira configuracao = new()
            {
                CoresStatus = Normalizar(request.CoresStatus),
                CoresPrioridade = Normalizar(request.CoresPrioridade)
            };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoCoresJiraIni.Salvar(caminhoCoresJira, configuracao),
                "Não foi possível salvar o mapeamento de cores do Jira.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new CoresJiraDto(configuracao.CoresStatus, configuracao.CoresPrioridade));
        })
        .WithSummary("Atualiza o mapeamento configurável de cores por status e por prioridade do Jira");
    }

    private static Dictionary<string, string> Normalizar(Dictionary<string, string>? mapa) =>
        (mapa ?? new Dictionary<string, string>())
            .Where(par => !string.IsNullOrWhiteSpace(par.Key) && !string.IsNullOrWhiteSpace(par.Value))
            .ToDictionary(par => par.Key.Trim(), par => par.Value.Trim(), StringComparer.OrdinalIgnoreCase);

    private static Dictionary<string, EntradaMapeamentoJiraToggl> Normalizar(Dictionary<string, EntradaMapeamentoJiraTogglDto>? mapa) =>
        (mapa ?? new Dictionary<string, EntradaMapeamentoJiraTogglDto>())
            .Where(par => !string.IsNullOrWhiteSpace(par.Key)
                && (!string.IsNullOrWhiteSpace(par.Value.ChaveToggl) || !string.IsNullOrWhiteSpace(par.Value.Sigla)))
            .ToDictionary(
                par => par.Key.Trim(),
                par => new EntradaMapeamentoJiraToggl
                {
                    ChaveToggl = string.IsNullOrWhiteSpace(par.Value.ChaveToggl) ? null : par.Value.ChaveToggl.Trim(),
                    Sigla = string.IsNullOrWhiteSpace(par.Value.Sigla) ? null : par.Value.Sigla.Trim(),
                    Cor = string.IsNullOrWhiteSpace(par.Value.Cor) ? null : par.Value.Cor.Trim(),
                },
                StringComparer.OrdinalIgnoreCase);

    private static Dictionary<string, EntradaMapeamentoJiraTogglDto> ParaDto(Dictionary<string, EntradaMapeamentoJiraToggl> mapeamento) =>
        mapeamento.ToDictionary(
            par => par.Key,
            par => new EntradaMapeamentoJiraTogglDto(par.Value.ChaveToggl, par.Value.Sigla, par.Value.Cor),
            StringComparer.OrdinalIgnoreCase);

    private static ClienteApiJira? CriarCliente(string urlDominio, string email, string apiToken, out string? erro)
    {
        try
        {
            erro = null;
            return new ClienteApiJira(urlDominio, email, apiToken);
        }
        catch (UriFormatException)
        {
            erro = "URL do domínio inválida.";
            return null;
        }
    }

    private static ConfiguracaoJiraDto ParaDto(ConfiguracaoJira configuracao) => new(
        configuracao.UrlDominio,
        configuracao.Email,
        ServicoUsuariosToggl.MascararToken(configuracao.ApiToken),
        configuracao.CampoEstimativaDesenvolvimentoId,
        configuracao.CampoEstimativaDesenvolvimentoNome,
        configuracao.CampoRevisadoPorId,
        configuracao.CampoRevisadoPorNome,
        configuracao.CampoEstimativaRevisaoId,
        configuracao.CampoEstimativaRevisaoNome,
        configuracao.CampoEstimativaTestesId,
        configuracao.CampoEstimativaTestesNome);
}