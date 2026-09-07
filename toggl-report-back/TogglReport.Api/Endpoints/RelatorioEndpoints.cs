using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Api.Endpoints;

public static class RelatorioEndpoints
{
    public static void MapRelatorioEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios, string caminhoCache)
    {
        app.MapGet("/api/relatorio", (string dataInicio, string dataFim) =>
        {
            if (!DateTime.TryParse(dataInicio, out _) || !DateTime.TryParse(dataFim, out _))
                return Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário cadastrado.");

            CacheConsulta? cache = CarregadorCacheIni.Carregar(caminhoCache);
            if (cache is null || cache.DataInicio != dataInicio || cache.DataFim != dataFim)
                return Results.Conflict("Não há consulta salva para esse período. Chame POST /api/consultas primeiro.");

            ResultadoConsulta dados = ServicoConsulta.CarregarRegistrosDoCache(cache, configuracao);

            List<RelatorioUsuarioDto> usuarios = new();
            foreach (string nomeUsuario in dados.OrdemUsuarios)
            {
                List<RegistroTempoDto> registros = dados.RegistrosPorUsuario[nomeUsuario];

                List<LinhaDescricao> porDescricao = configuracao.AgrupamentoPadrao is "descricao" or "ambos"
                    ? (configuracao.AgrupamentoPadrao == "ambos"
                        ? ServicoAgrupamento.AgruparPorDescricaoComTag(registros, configuracao.TagsDetalhadas)
                        : ServicoAgrupamento.AgruparPorDescricaoComTag(registros))
                    : new List<LinhaDescricao>();

                Dictionary<string, long> porTag = configuracao.AgrupamentoPadrao is "tag" or "ambos"
                    ? ServicoAgrupamento.AgruparPorTagFiltrada(registros, configuracao.TagsDetalhadas).ToDictionary(par => par.Key, par => par.Value)
                    : new Dictionary<string, long>();

                usuarios.Add(new RelatorioUsuarioDto(
                    nomeUsuario,
                    porDescricao,
                    porTag,
                    ServicoAgrupamento.ObterEmAndamento(registros),
                    ServicoAgrupamento.ObterTotalSegundos(registros)));
            }

            return Results.Ok(new RelatorioResponse(dataInicio, dataFim, configuracao.AgrupamentoPadrao, usuarios));
        })
        .WithTags("Relatório")
        .WithSummary("Devolve o relatório agrupado (por descrição/tag/em andamento) a partir dos dados em cache");
    }
}