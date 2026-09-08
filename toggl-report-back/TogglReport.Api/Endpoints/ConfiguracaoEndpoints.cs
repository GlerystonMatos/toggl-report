using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;

namespace RelatorioToggl.Api.Endpoints;

public static class ConfiguracaoEndpoints
{
    public static void MapConfiguracaoEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/configuracao").WithTags("Configuração");

        grupo.MapGet("/", () =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            return Results.Ok(new ParametrosConfiguracaoDto(
                configuracao.AgrupamentoPadrao, configuracao.TagsDetalhadas, configuracao.DataInicioAnterior, configuracao.DataFimAnterior));
        })
        .WithSummary("Obtém agrupamento, tags detalhadas e último período salvos");

        grupo.MapPut("/", (AtualizarParametrosRequest request) =>
        {
            if (!Agrupamento.EhValido(request.Agrupamento))
                return Results.BadRequest("Agrupamento deve ser 'descricao', 'tag' ou 'ambos'.");

            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios) ?? new ConfiguracaoApp();
            configuracao.AgrupamentoPadrao = request.Agrupamento;
            configuracao.TagsDetalhadas = request.TagsDetalhadas;
            configuracao.DataInicioAnterior = inicio.ToString("yyyy-MM-dd");
            configuracao.DataFimAnterior = fim.ToString("yyyy-MM-dd");

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoIni.Salvar(caminhoConfiguracao, caminhoUsuarios, configuracao),
                "Não foi possível salvar a configuração.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new ParametrosConfiguracaoDto(
                configuracao.AgrupamentoPadrao, configuracao.TagsDetalhadas, configuracao.DataInicioAnterior, configuracao.DataFimAnterior));
        })
        .WithSummary("Atualiza agrupamento, tags detalhadas e período; preserva os usuários já cadastrados");
    }
}