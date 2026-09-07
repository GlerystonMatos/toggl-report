using RelatorioToggl.Apresentacao;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;
using System.IO.Compression;
using System.Text;

namespace RelatorioToggl;

public static class Program
{
    private const string Versao = "1.0.1.0";

    private static readonly string CaminhoConfiguracao = CaminhosDados.CaminhoConfiguracao(AppContext.BaseDirectory);

    private static readonly string CaminhoUsuarios = CaminhosDados.CaminhoUsuarios(AppContext.BaseDirectory);

    private static readonly string CaminhoCache = CaminhosDados.CaminhoCache(AppContext.BaseDirectory);

    public static async Task Main()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Tela.Inicializar();

        Tela.BemVindo(Versao);
        Tela.Carregando();

        OfereceRestaurarBackupSeNecessario();

        await GerarRelatoriosEnquantoUsuarioQuiser();

        Tela.Despedida(Versao);
    }

    private static void OfereceRestaurarBackupSeNecessario()
    {
        if (CarregadorConfiguracaoIni.Carregar(CaminhoConfiguracao, CaminhoUsuarios) is not null)
        {
            return;
        }

        Paleta.EscreverLinha("\n Nenhuma configuração salva foi encontrada nesta pasta.", Paleta.Neutro);
        if (!Prompt.Confirmar(" Restaurar de um backup (.zip da pasta dados)?", padraoSim: false))
        {
            return;
        }

        string caminhoZip = Prompt.Perguntar(" Caminho do arquivo .zip");
        if (string.IsNullOrWhiteSpace(caminhoZip) || !File.Exists(caminhoZip))
        {
            Paleta.EscreverLinha(" Arquivo não encontrado — seguindo sem restaurar.", Paleta.Destaque);
            return;
        }

        try
        {
            string pastaDados = CaminhosDados.PastaDados(AppContext.BaseDirectory);
            Directory.CreateDirectory(pastaDados);
            ZipFile.ExtractToDirectory(caminhoZip, pastaDados, overwriteFiles: true);
            Paleta.EscreverLinha(" Backup restaurado com sucesso.", Paleta.Sucesso);
        }
        catch (Exception excecao) when (excecao is IOException or UnauthorizedAccessException or InvalidDataException)
        {
            Paleta.EscreverLinha($" Não foi possível restaurar o backup: {excecao.Message}", Paleta.Erro);
        }
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
            ConfiguracaoApp? salvos = CarregadorConfiguracaoIni.Carregar(CaminhoConfiguracao, CaminhoUsuarios);
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
            CarregadorConfiguracaoIni.Salvar(CaminhoConfiguracao, CaminhoUsuarios, configuracao);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Paleta.EscreverLinha("\n Não foi possível salvar a configuração para a próxima execução.", Paleta.Erro);
        }
    }

    private static async Task<(Dictionary<string, List<RegistroTempoDto>> registros, List<string> ordem)> ObterRegistrosAsync(
        ConfiguracaoApp configuracao, DateTime inicio, DateTime fim)
    {
        CacheConsulta? cache = ServicoConsulta.CarregarCacheSeExistente(CaminhoCache);

        if (cache is not null && ServicoConsulta.CacheCorrespondeAosParametros(cache, configuracao, inicio, fim))
        {
            Tela.Cabecalho(Versao, configuracao);
            bool consultarNovamente = Prompt.Confirmar(
                "\n Os parâmetros são iguais aos da última consulta salva. Deseja consultar novamente à API?");

            if (!consultarNovamente)
            {
                ResultadoConsulta resultadoCache = ServicoConsulta.CarregarRegistrosDoCache(cache, configuracao);
                return (resultadoCache.RegistrosPorUsuario, resultadoCache.OrdemUsuarios);
            }
        }

        CacheConsulta? cacheParaFallback = cache is not null
            && cache.DataInicio == inicio.ToString("yyyy-MM-dd")
            && cache.DataFim == fim.ToString("yyyy-MM-dd")
                ? cache
                : null;

        Tela.Cabecalho(Versao, configuracao);
        Paleta.EscreverLinha("\n Consultando o Toggl Track...\n", Paleta.Titulo);

        ResultadoConsulta resultado = await ServicoConsulta.ConsultarUsuariosAsync(configuracao, inicio, fim, cacheParaFallback, ImprimirProgressoConsulta);

        if (!ServicoConsulta.SalvarCache(CaminhoCache, configuracao, inicio, fim, resultado.RegistrosPorUsuario, resultado.OrdemUsuarios))
            Paleta.EscreverLinha("\n Não foi possível salvar o cache da consulta.", Paleta.Erro);

        return (resultado.RegistrosPorUsuario, resultado.OrdemUsuarios);
    }

    private static void ImprimirProgressoConsulta(EventoConsultaUsuario evento)
    {
        Paleta.Escrever($"   • {evento.NomeUsuario}: ", Paleta.Info);

        switch (evento.Status)
        {
            case StatusConsultaUsuario.Sucesso:
                Paleta.EscreverLinha($"{evento.QuantidadeRegistros} registro(s)", Paleta.Sucesso);
                break;
            case StatusConsultaUsuario.Erro:
                Paleta.EscreverLinha($"erro — {evento.Mensagem}", Paleta.Erro);
                break;
            default:
                Paleta.EscreverLinha(evento.Mensagem ?? "", Paleta.Erro);
                break;
        }
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