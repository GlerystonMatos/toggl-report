using RelatorioToggl.Apresentacao;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;
using System.Text;

namespace RelatorioToggl;

public static class Program
{
    private const string Versao = "1.0.0.0";

    private static readonly string PastaDados = Path.Combine(AppContext.BaseDirectory, "dados");

    private static readonly string CaminhoConfiguracao = Path.Combine(PastaDados, "TogglReport.ini");

    private static readonly string CaminhoCache = Path.Combine(PastaDados, "ToggleData.ini");

    public static async Task Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Tela.Inicializar();

        Tela.BemVindo(Versao);
        Tela.Carregando();

        await GerarRelatoriosEnquantoUsuarioQuiser();

        Tela.Despedida(Versao);
    }

    private static async Task GerarRelatoriosEnquantoUsuarioQuiser()
    {
        AssistenteConfiguracao assistente = new(Versao);
        bool executarNovamente = true;

        while (executarNovamente)
        {
            (ConfiguracaoApp configuracao, DateTime inicio, DateTime fim) =
                await ColetarConfiguracaoConfirmadaAsync(assistente);

            (Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario, List<string> ordemUsuarios) =
                await ObterRegistrosAsync(configuracao, inicio, fim);

            if (ordemUsuarios.Count == 0)
            {
                Paleta.EscreverLinha("\n Nenhum usuário retornou dados — verifique os tokens e o período.", Paleta.Erro);
            }
            else
            {
                ImprimirConteudoRelatorio(ordemUsuarios, registrosPorUsuario, inicio, fim, configuracao.AgrupamentoPadrao, configuracao.TagsDetalhadas);
                ExecutarFluxoBusca(configuracao, inicio, fim, ordemUsuarios, registrosPorUsuario);
            }

            Console.WriteLine();
            executarNovamente = Prompt.Confirmar(" Deseja executar novamente (novo período/consulta)?");
        }
    }

    private static async Task<(ConfiguracaoApp configuracao, DateTime inicio, DateTime fim)> ColetarConfiguracaoConfirmadaAsync(AssistenteConfiguracao assistente)
    {
        while (true)
        {
            ConfiguracaoApp? salvos = CarregadorConfiguracaoIni.Carregar(CaminhoConfiguracao);
            ConfiguracaoApp configuracao = new();

            Tela.Cabecalho(Versao, configuracao);
            Paleta.EscreverLinha("\n Informe os parâmetros da consulta ao Toggl.", Paleta.Neutro);

            (DateTime inicio, DateTime fim) = await assistente.ColetarAsync(configuracao, salvos);
            configuracao.DataInicioAnterior = inicio.ToString("yyyy-MM-dd");
            configuracao.DataFimAnterior = fim.ToString("yyyy-MM-dd");

            Tela.Cabecalho(Versao, configuracao);
            Tela.ListarUsuariosSelecionados(configuracao.Usuarios);
            if (Prompt.Confirmar("\n Confirmar a consulta com os parâmetros acima?", padraoSim: true))
            {
                SalvarConfiguracao(configuracao);
                return (configuracao, inicio, fim);
            }
        }
    }

    private static void SalvarConfiguracao(ConfiguracaoApp configuracao)
    {
        try
        {
            CarregadorConfiguracaoIni.Salvar(CaminhoConfiguracao, configuracao);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Paleta.EscreverLinha("\n Não foi possível salvar a configuração para a próxima execução.", Paleta.Erro);
        }
    }

    private static async Task<(Dictionary<string, List<RegistroTempoDto>> registros, List<string> ordem)> ObterRegistrosAsync(
        ConfiguracaoApp configuracao, DateTime inicio, DateTime fim)
    {
        CacheConsulta? cache = CarregarCacheSeExistente();

        if (cache is not null && CacheCorrespondeAosParametros(cache, configuracao, inicio, fim))
        {
            Tela.Cabecalho(Versao, configuracao);
            bool consultarNovamente = Prompt.Confirmar(
                "\n Os parâmetros são iguais aos da última consulta salva. Deseja consultar novamente à API?");

            if (!consultarNovamente)
                return CarregarRegistrosDoCache(cache, configuracao);
        }

        CacheConsulta? cacheParaFallback = cache is not null
            && cache.DataInicio == inicio.ToString("yyyy-MM-dd")
            && cache.DataFim == fim.ToString("yyyy-MM-dd")
                ? cache
                : null;

        (Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario, List<string> ordemUsuarios) =
            await ConsultarUsuarios(configuracao, inicio, fim, cacheParaFallback);
        SalvarCache(configuracao, inicio, fim, registrosPorUsuario, ordemUsuarios);
        return (registrosPorUsuario, ordemUsuarios);
    }

    private static CacheConsulta? CarregarCacheSeExistente()
    {
        try
        {
            return CarregadorCacheIni.Carregar(CaminhoCache);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static bool CacheCorrespondeAosParametros(CacheConsulta cache, ConfiguracaoApp configuracao, DateTime inicio, DateTime fim)
    {
        if (cache.DataInicio != inicio.ToString("yyyy-MM-dd") || cache.DataFim != fim.ToString("yyyy-MM-dd"))
            return false;

        if (cache.Usuarios.Count != configuracao.Usuarios.Count)
            return false;

        return configuracao.Usuarios.All(usuario =>
            cache.Usuarios.Any(cacheado => cacheado.Chave == usuario.Chave && cacheado.TokenApi == usuario.TokenApi));
    }

    private static (Dictionary<string, List<RegistroTempoDto>> registros, List<string> ordem) CarregarRegistrosDoCache(
        CacheConsulta cache, ConfiguracaoApp configuracao)
    {
        Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario = new();
        List<string> ordemUsuarios = new();

        foreach (ConfiguracaoUsuario usuario in configuracao.Usuarios)
        {
            UsuarioCacheado? cacheado = cache.Usuarios.FirstOrDefault(u => u.Chave == usuario.Chave);
            if (cacheado is null)
                continue;

            registrosPorUsuario[usuario.NomeExibicao] = cacheado.Registros;
            ordemUsuarios.Add(usuario.NomeExibicao);
        }

        return (registrosPorUsuario, ordemUsuarios);
    }

    private static void SalvarCache(ConfiguracaoApp configuracao, DateTime inicio, DateTime fim,
        Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario, List<string> ordemUsuarios)
    {
        CacheConsulta cache = new()
        {
            DataInicio = inicio.ToString("yyyy-MM-dd"),
            DataFim = fim.ToString("yyyy-MM-dd")
        };

        foreach (string nomeUsuario in ordemUsuarios)
        {
            ConfiguracaoUsuario? usuario = configuracao.Usuarios.FirstOrDefault(u => u.NomeExibicao == nomeUsuario);
            if (usuario is null)
                continue;

            cache.Usuarios.Add(new UsuarioCacheado
            {
                Chave = usuario.Chave,
                NomeExibicao = usuario.NomeExibicao,
                TokenApi = usuario.TokenApi,
                Registros = registrosPorUsuario[nomeUsuario]
            });
        }

        try
        {
            CarregadorCacheIni.Salvar(CaminhoCache, cache);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Paleta.EscreverLinha("\n Não foi possível salvar o cache da consulta.", Paleta.Erro);
        }
    }

    private static async Task<(Dictionary<string, List<RegistroTempoDto>> registros, List<string> ordem)> ConsultarUsuarios(
        ConfiguracaoApp configuracao, DateTime inicio, DateTime fim, CacheConsulta? cacheParaFallback)
    {
        DateTime inicioUtc = DateTime.SpecifyKind(inicio.Date, DateTimeKind.Local).ToUniversalTime();
        DateTime fimUtc = DateTime.SpecifyKind(fim.Date.AddDays(1).AddSeconds(-1), DateTimeKind.Local).ToUniversalTime();

        Tela.Cabecalho(Versao, configuracao);
        Paleta.EscreverLinha("\n Consultando o Toggl Track...\n", Paleta.Titulo);

        Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario = new();
        List<string> ordemUsuarios = new();

        foreach (ConfiguracaoUsuario usuario in configuracao.Usuarios)
        {
            Paleta.Escrever($"   • {usuario.NomeExibicao}: ", Paleta.Info);

            if (!LimitadorRequisicoes.PodeConsultar(usuario.Chave))
            {
                UsuarioCacheado? cacheado = cacheParaFallback?.Usuarios.FirstOrDefault(u => u.Chave == usuario.Chave && u.TokenApi == usuario.TokenApi);
                if (cacheado is null)
                {
                    Paleta.EscreverLinha($"limite de {LimitadorRequisicoes.MaximoPorHora} requisições/hora atingido e não há cache disponível", Paleta.Erro);
                    continue;
                }

                registrosPorUsuario[usuario.NomeExibicao] = cacheado.Registros;
                ordemUsuarios.Add(usuario.NomeExibicao);
                Paleta.EscreverLinha($"limite de {LimitadorRequisicoes.MaximoPorHora} requisições/hora atingido — usando dado em cache", Paleta.Erro);
                continue;
            }

            ClienteApiToggl cliente = new(usuario.TokenApi);
            ResultadoApiToggl<List<RegistroTempoDto>> resultado =
                await cliente.ObterRegistrosTempoAsync(inicioUtc, fimUtc);
            LimitadorRequisicoes.RegistrarConsulta(usuario.Chave);

            if (!resultado.Sucesso)
            {
                Paleta.EscreverLinha($"erro — {resultado.MensagemErro}", Paleta.Erro);
                continue;
            }

            registrosPorUsuario[usuario.NomeExibicao] = resultado.Dados!;
            ordemUsuarios.Add(usuario.NomeExibicao);
            Paleta.EscreverLinha($"{resultado.Dados!.Count} registro(s)", Paleta.Sucesso);
        }

        return (registrosPorUsuario, ordemUsuarios);
    }

    private static void ImprimirConteudoRelatorio(List<string> ordemUsuarios, Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario,
        DateTime inicio, DateTime fim, string agrupamento, List<string> tagsDetalhadas)
    {
        foreach (string nomeUsuario in ordemUsuarios)
            EscritorRelatorioConsole.ImprimirRelatorioUsuario(nomeUsuario, inicio, fim, agrupamento, registrosPorUsuario[nomeUsuario], tagsDetalhadas);

        Console.WriteLine();
        Paleta.EscreverLinha(new string('═', Tela.Largura), Paleta.Titulo);
    }

    private static void ExibirRelatorioCompleto(ConfiguracaoApp configuracao, DateTime inicio, DateTime fim,
        List<string> ordemUsuarios, Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario)
    {
        Tela.ExibirComCabecalho(Versao, configuracao, () =>
            ImprimirConteudoRelatorio(ordemUsuarios, registrosPorUsuario, inicio, fim, configuracao.AgrupamentoPadrao, configuracao.TagsDetalhadas));
    }

    private static void ExecutarFluxoBusca(ConfiguracaoApp configuracao, DateTime inicio, DateTime fim,
        List<string> ordemUsuarios, Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario)
    {
        Console.WriteLine();
        bool continuarPerguntandoSeBusca = Prompt.Confirmar(" Deseja buscar por parte da descrição?");

        while (continuarPerguntandoSeBusca)
            continuarPerguntandoSeBusca = ExecutarCicloDeBusca(configuracao, inicio, fim, ordemUsuarios, registrosPorUsuario);
    }

    private static bool ExecutarCicloDeBusca(ConfiguracaoApp configuracao, DateTime inicio, DateTime fim,
        List<string> ordemUsuarios, Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario)
    {
        Tela.Cabecalho(Versao, configuracao);
        Console.WriteLine();
        string termo = Prompt.Perguntar(" Buscar por parte da descrição:");

        if (string.IsNullOrWhiteSpace(termo))
        {
            Paleta.EscreverLinha(" Termo de busca vazio. Tente novamente.", Paleta.Erro);
            return true;
        }

        ResultadoBuscaDescricao resultado = ServicoBuscaDescricao.Buscar(ordemUsuarios, registrosPorUsuario, termo);
        Tela.ExibirComCabecalho(Versao, configuracao, () => EscritorBuscaDescricao.ImprimirNoConsole(resultado, termo));

        switch (PerguntarProximaAcaoPosBusca())
        {
            case "1":
                ExibirRelatorioCompleto(configuracao, inicio, fim, ordemUsuarios, registrosPorUsuario);
                Console.WriteLine();
                return Prompt.Confirmar(" Deseja buscar por parte da descrição?");
            case "2":
                return true;
            default:
                return false;
        }
    }

    private static string PerguntarProximaAcaoPosBusca()
    {
        string[] opcoes = { "1 - Voltar ao relatório completo", "2 - Nova busca por descrição", "3 - Continuar" };

        while (true)
        {
            string escolha = Prompt.EscolherOpcao("\n O que deseja fazer?", opcoes).Trim();
            if (escolha is "1" or "2" or "3")
                return escolha;

            Paleta.EscreverLinha(" Opção inválida. Escolha 1, 2 ou 3.", Paleta.Erro);
        }
    }
}