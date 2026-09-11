using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Api.Endpoints;

public static class UsuariosTogglEndpoints
{
    public static void MapUsuariosTogglEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/usuarios-toggl").WithTags("Usuários do Toggl");

        grupo.MapGet("/", () =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            List<UsuarioTogglResumoDto> usuarios = configuracao.Usuarios
                .Select(u => new UsuarioTogglResumoDto(u.Chave, u.NomeExibicao, ServicoUsuariosToggl.MascararToken(u.TokenApi), u.Sigla, u.Cor, u.Selecionado))
                .ToList();
            return Results.Ok(usuarios);
        })
        .WithSummary("Lista os usuários do Toggl cadastrados (token mascarado)");

        grupo.MapPost("/validar-token", async (ValidarTokenRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.TokenApi))
                return Results.Ok(new ValidarTokenResponse(false));

            ClienteApiToggl cliente = new(request.TokenApi);
            bool valido = await cliente.ValidarTokenAsync();
            return Results.Ok(new ValidarTokenResponse(valido));
        })
        .WithSummary("Valida um API Token de usuário do Toggl junto ao Toggl (GET /me), sem salvar");

        grupo.MapPost("/", async (CriarUsuarioTogglRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.NomeExibicao))
                return Results.BadRequest("Nome de exibição é obrigatório.");

            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();

            if (ServicoUsuariosToggl.NomeEmUso(configuracao.Usuarios, request.NomeExibicao, ignorar: null))
                return Results.Conflict($"Já existe um usuário do Toggl chamado '{request.NomeExibicao}'.");

            if (ServicoUsuariosToggl.TokenEmUso(configuracao.Usuarios, request.TokenApi, ignorar: null))
                return Results.Conflict("Esse API Token já está cadastrado para outro usuário do Toggl.");

            if (!string.IsNullOrWhiteSpace(request.Sigla) && ServicoUsuariosToggl.SiglaEmUso(configuracao.Usuarios, request.Sigla, ignorar: null))
                return Results.Conflict($"A sigla '{request.Sigla}' já está em uso por outro usuário do Toggl.");

            if (!request.IgnorarValidacao)
            {
                ClienteApiToggl cliente = new(request.TokenApi);
                if (!await cliente.ValidarTokenAsync())
                    return Results.BadRequest("Não foi possível validar o token. Envie ignorarValidacao=true para salvar mesmo assim.");
            }

            string chave = ServicoUsuariosToggl.GerarChaveUnica(request.NomeExibicao, configuracao.Usuarios);
            ConfiguracaoUsuarioToggl usuario = new() { Chave = chave, NomeExibicao = request.NomeExibicao, TokenApi = request.TokenApi, Sigla = request.Sigla, Cor = request.Cor, Selecionado = request.Selecionado };
            configuracao.Usuarios.Add(usuario);

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoIni.Salvar(caminhoConfiguracao, caminhoUsuarios, configuracao),
                "Não foi possível salvar a configuração.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Created($"/api/usuarios-toggl/{chave}",
                new UsuarioTogglResumoDto(chave, usuario.NomeExibicao, ServicoUsuariosToggl.MascararToken(usuario.TokenApi), usuario.Sigla, usuario.Cor, usuario.Selecionado));
        })
        .WithSummary("Cadastra um usuário do Toggl (valida o token por padrão)");

        grupo.MapPut("/{chave}", async (string chave, EditarUsuarioTogglRequest request) =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            ConfiguracaoUsuarioToggl? usuario = configuracao.Usuarios.FirstOrDefault(u => u.Chave == chave);
            if (usuario is null)
                return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(request.NomeExibicao))
            {
                if (ServicoUsuariosToggl.NomeEmUso(configuracao.Usuarios, request.NomeExibicao, ignorar: usuario))
                    return Results.Conflict($"Já existe um usuário do Toggl chamado '{request.NomeExibicao}'.");

                usuario.NomeExibicao = request.NomeExibicao;
            }

            if (!string.IsNullOrWhiteSpace(request.TokenApi))
            {
                if (ServicoUsuariosToggl.TokenEmUso(configuracao.Usuarios, request.TokenApi, ignorar: usuario))
                    return Results.Conflict("Esse API Token já está cadastrado para outro usuário do Toggl.");

                if (!request.IgnorarValidacao)
                {
                    ClienteApiToggl cliente = new(request.TokenApi);
                    if (!await cliente.ValidarTokenAsync())
                        return Results.BadRequest("Não foi possível validar o token. Envie ignorarValidacao=true para salvar mesmo assim.");
                }

                usuario.TokenApi = request.TokenApi;
            }

            if (!string.IsNullOrWhiteSpace(request.Sigla))
            {
                if (ServicoUsuariosToggl.SiglaEmUso(configuracao.Usuarios, request.Sigla, ignorar: usuario))
                    return Results.Conflict($"A sigla '{request.Sigla}' já está em uso por outro usuário do Toggl.");

                usuario.Sigla = request.Sigla;
            }

            if (!string.IsNullOrWhiteSpace(request.Cor))
                usuario.Cor = request.Cor;

            if (request.Selecionado is not null)
                usuario.Selecionado = request.Selecionado.Value;

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoIni.Salvar(caminhoConfiguracao, caminhoUsuarios, configuracao),
                "Não foi possível salvar a configuração.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new UsuarioTogglResumoDto(usuario.Chave, usuario.NomeExibicao, ServicoUsuariosToggl.MascararToken(usuario.TokenApi), usuario.Sigla, usuario.Cor, usuario.Selecionado));
        })
        .WithSummary("Edita nome de exibição e/ou token de um usuário do Toggl");

        grupo.MapDelete("/{chave}", (string chave) =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            ConfiguracaoUsuarioToggl? usuario = configuracao.Usuarios.FirstOrDefault(u => u.Chave == chave);
            if (usuario is null)
                return Results.NotFound();

            configuracao.Usuarios.Remove(usuario);

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoIni.Salvar(caminhoConfiguracao, caminhoUsuarios, configuracao),
                "Não foi possível salvar a configuração.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.NoContent();
        })
        .WithSummary("Remove um usuário do Toggl cadastrado");
    }
}