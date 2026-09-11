using RelatorioToggl.Configuracao;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Consultas;

public static class ServicoConsulta
{
    public static CacheConsulta? CarregarCacheSeExistente(string caminhoCache)
    {
        try
        {
            return CarregadorCacheIni.Carregar(caminhoCache);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public static bool CacheCorrespondeAosParametros(CacheConsulta cache, ConfiguracaoApp configuracao, DateTime inicio, DateTime fim)
    {
        if (cache.DataInicio != inicio.ToString("yyyy-MM-dd") || cache.DataFim != fim.ToString("yyyy-MM-dd"))
            return false;

        if (cache.Usuarios.Count != configuracao.Usuarios.Count)
            return false;

        return configuracao.Usuarios.All(usuario =>
            cache.Usuarios.Any(cacheado => cacheado.Chave == usuario.Chave && cacheado.TokenApi == usuario.TokenApi));
    }

    public static ResultadoConsulta CarregarRegistrosDoCache(CacheConsulta cache, ConfiguracaoApp configuracao)
    {
        Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario = new();
        List<string> ordemUsuarios = new();

        foreach (ConfiguracaoUsuarioToggl usuario in configuracao.Usuarios)
        {
            UsuarioTogglCacheado? cacheado = cache.Usuarios.FirstOrDefault(u => u.Chave == usuario.Chave);
            if (cacheado is null)
                continue;

            registrosPorUsuario[usuario.NomeExibicao] = cacheado.Registros;
            ordemUsuarios.Add(usuario.NomeExibicao);
        }

        return new ResultadoConsulta
        {
            RegistrosPorUsuario = registrosPorUsuario,
            OrdemUsuarios = ordemUsuarios,
            VeioDoCache = true
        };
    }

    public static bool SalvarCache(string caminhoCache, ConfiguracaoApp configuracao, DateTime inicio, DateTime fim,
        Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario, List<string> ordemUsuarios)
    {
        CacheConsulta cache = new()
        {
            DataInicio = inicio.ToString("yyyy-MM-dd"),
            DataFim = fim.ToString("yyyy-MM-dd")
        };

        foreach (string nomeUsuario in ordemUsuarios)
        {
            ConfiguracaoUsuarioToggl? usuario = configuracao.Usuarios.FirstOrDefault(u => u.NomeExibicao == nomeUsuario);
            if (usuario is null)
                continue;

            cache.Usuarios.Add(new UsuarioTogglCacheado
            {
                Chave = usuario.Chave,
                NomeExibicao = usuario.NomeExibicao,
                TokenApi = usuario.TokenApi,
                Registros = registrosPorUsuario[nomeUsuario]
            });
        }

        try
        {
            CarregadorCacheIni.Salvar(caminhoCache, cache);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    public static async Task<ResultadoConsulta> ConsultarUsuariosAsync(ConfiguracaoApp configuracao, DateTime inicio, DateTime fim,
        CacheConsulta? cacheParaFallback, Action<EventoConsultaUsuarioToggl>? aoProgredir = null)
    {
        DateTime inicioUtc = DateTime.SpecifyKind(inicio.Date, DateTimeKind.Local).ToUniversalTime();
        DateTime fimUtc = DateTime.SpecifyKind(fim.Date.AddDays(1).AddSeconds(-1), DateTimeKind.Local).ToUniversalTime();

        Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario = new();
        List<string> ordemUsuarios = new();

        foreach (ConfiguracaoUsuarioToggl usuario in configuracao.Usuarios)
        {
            if (!LimitadorRequisicoes.PodeConsultar(usuario.Chave))
            {
                UsuarioTogglCacheado? cacheado = cacheParaFallback?.Usuarios.FirstOrDefault(u => u.Chave == usuario.Chave && u.TokenApi == usuario.TokenApi);
                if (cacheado is null)
                {
                    aoProgredir?.Invoke(new EventoConsultaUsuarioToggl(usuario.NomeExibicao, StatusConsultaUsuarioToggl.LimiteAtingidoSemCache,
                        $"limite de {LimitadorRequisicoes.MaximoPorHora} requisições/hora atingido e não há cache disponível", null));
                    continue;
                }

                registrosPorUsuario[usuario.NomeExibicao] = cacheado.Registros;
                ordemUsuarios.Add(usuario.NomeExibicao);
                aoProgredir?.Invoke(new EventoConsultaUsuarioToggl(usuario.NomeExibicao, StatusConsultaUsuarioToggl.LimiteAtingidoComCache,
                    $"limite de {LimitadorRequisicoes.MaximoPorHora} requisições/hora atingido — usando dado em cache", cacheado.Registros.Count));
                continue;
            }

            ClienteApiToggl cliente = new(usuario.TokenApi);
            ResultadoApiToggl<List<RegistroTempoDto>> resultado = await cliente.ObterRegistrosTempoAsync(inicioUtc, fimUtc);
            LimitadorRequisicoes.RegistrarConsulta(usuario.Chave);

            if (!resultado.Sucesso)
            {
                aoProgredir?.Invoke(new EventoConsultaUsuarioToggl(usuario.NomeExibicao, StatusConsultaUsuarioToggl.Erro, resultado.MensagemErro, null));
                continue;
            }

            registrosPorUsuario[usuario.NomeExibicao] = resultado.Dados!;
            ordemUsuarios.Add(usuario.NomeExibicao);
            aoProgredir?.Invoke(new EventoConsultaUsuarioToggl(usuario.NomeExibicao, StatusConsultaUsuarioToggl.Sucesso, null, resultado.Dados!.Count));
        }

        return new ResultadoConsulta
        {
            RegistrosPorUsuario = registrosPorUsuario,
            OrdemUsuarios = ordemUsuarios,
            VeioDoCache = false
        };
    }
}