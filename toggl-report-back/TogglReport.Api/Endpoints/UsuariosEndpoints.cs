using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Api.Endpoints;

public static class UsuariosEndpoints
{
    public static void MapUsuariosEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/usuarios").WithTags("Usuários");

        grupo.MapGet("/", () =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            List<UsuarioResumoDto> usuarios = configuracao.Usuarios
                .Select(u => new UsuarioResumoDto(u.Chave, u.NomeExibicao, ServicoUsuarios.MascararToken(u.TokenApi), u.Sigla, u.Cor, u.Selecionado))
                .ToList();
            return Results.Ok(usuarios);
        })
        .WithSummary("Lista os usuários cadastrados (token mascarado)");

        grupo.MapPost("/validar-token", async (ValidarTokenRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.TokenApi))
                return Results.Ok(new ValidarTokenResponse(false));

            ClienteApiToggl cliente = new(request.TokenApi);
            bool valido = await cliente.ValidarTokenAsync();
            return Results.Ok(new ValidarTokenResponse(valido));
        })
        .WithSummary("Valida um API Token junto ao Toggl (GET /me), sem salvar");

        grupo.MapPost("/", async (CriarUsuarioRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.NomeExibicao))
                return Results.BadRequest("Nome de exibição é obrigatório.");

            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();

            if (ServicoUsuarios.NomeEmUso(configuracao.Usuarios, request.NomeExibicao, ignorar: null))
                return Results.Conflict($"Já existe um usuário chamado '{request.NomeExibicao}'.");

            if (ServicoUsuarios.TokenEmUso(configuracao.Usuarios, request.TokenApi, ignorar: null))
                return Results.Conflict("Esse API Token já está cadastrado para outro usuário.");

            if (!string.IsNullOrWhiteSpace(request.Sigla) && ServicoUsuarios.SiglaEmUso(configuracao.Usuarios, request.Sigla, ignorar: null))
                return Results.Conflict($"A sigla '{request.Sigla}' já está em uso por outro usuário.");

            if (!request.IgnorarValidacao)
            {
                ClienteApiToggl cliente = new(request.TokenApi);
                if (!await cliente.ValidarTokenAsync())
                    return Results.BadRequest("Não foi possível validar o token. Envie ignorarValidacao=true para salvar mesmo assim.");
            }

            string chave = ServicoUsuarios.GerarChaveUnica(request.NomeExibicao, configuracao.Usuarios);
            ConfiguracaoUsuario usuario = new() { Chave = chave, NomeExibicao = request.NomeExibicao, TokenApi = request.TokenApi, Sigla = request.Sigla, Cor = request.Cor, Selecionado = request.Selecionado };
            configuracao.Usuarios.Add(usuario);

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoIni.Salvar(caminhoConfiguracao, caminhoUsuarios, configuracao),
                "Não foi possível salvar a configuração.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Created($"/api/usuarios/{chave}",
                new UsuarioResumoDto(chave, usuario.NomeExibicao, ServicoUsuarios.MascararToken(usuario.TokenApi), usuario.Sigla, usuario.Cor, usuario.Selecionado));
        })
        .WithSummary("Cadastra um usuário (valida o token por padrão)");

        grupo.MapPut("/{chave}", async (string chave, EditarUsuarioRequest request) =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            ConfiguracaoUsuario? usuario = configuracao.Usuarios.FirstOrDefault(u => u.Chave == chave);
            if (usuario is null)
                return Results.NotFound();

            if (!string.IsNullOrWhiteSpace(request.NomeExibicao))
            {
                if (ServicoUsuarios.NomeEmUso(configuracao.Usuarios, request.NomeExibicao, ignorar: usuario))
                    return Results.Conflict($"Já existe um usuário chamado '{request.NomeExibicao}'.");

                usuario.NomeExibicao = request.NomeExibicao;
            }

            if (!string.IsNullOrWhiteSpace(request.TokenApi))
            {
                if (ServicoUsuarios.TokenEmUso(configuracao.Usuarios, request.TokenApi, ignorar: usuario))
                    return Results.Conflict("Esse API Token já está cadastrado para outro usuário.");

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
                if (ServicoUsuarios.SiglaEmUso(configuracao.Usuarios, request.Sigla, ignorar: usuario))
                    return Results.Conflict($"A sigla '{request.Sigla}' já está em uso por outro usuário.");

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

            return Results.Ok(new UsuarioResumoDto(usuario.Chave, usuario.NomeExibicao, ServicoUsuarios.MascararToken(usuario.TokenApi), usuario.Sigla, usuario.Cor, usuario.Selecionado));
        })
        .WithSummary("Edita nome de exibição e/ou token de um usuário");

        grupo.MapDelete("/{chave}", (string chave) =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            ConfiguracaoUsuario? usuario = configuracao.Usuarios.FirstOrDefault(u => u.Chave == chave);
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
        .WithSummary("Remove um usuário cadastrado");
    }
}