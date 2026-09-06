using RelatorioToggl.Configuracao;

namespace RelatorioToggl.Apresentacao;

public static class Tela
{
    private const int LarguraPadrao = 100;

    private const string Autor = "por Gleryston Matos";

    private const string SequenciaLimparTela = "[2J[3J[H";

    public static int Largura { get; private set; } = LarguraPadrao;

    private static string LinhaCheia => new('═', Largura);

    public static void Inicializar()
    {
        try
        {
            int larguraJanela = Console.WindowWidth;
            Largura = larguraJanela > 0 ? Math.Max(1, larguraJanela - 2) : LarguraPadrao;
        }
        catch (IOException)
        {
            Largura = LarguraPadrao;
        }
    }

    public static void BemVindo(string versao)
    {
        Limpar();
        Paleta.EscreverLinha(Borda('╔', '╗'), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaCentralizada(""), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaCentralizada("T O G G L   ·   R E L A T Ó R I O   D E   T E M P O"), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaCentralizada(""), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaCentralizada($"{Autor}   ·   versão {versao}"), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaCentralizada(""), Paleta.Titulo);
        Paleta.EscreverLinha(Borda('╚', '╝'), Paleta.Titulo);
        Console.WriteLine();
    }

    public static void Carregando()
    {
        Paleta.Escrever(" Carregando ", Paleta.Sucesso);
        for (int i = 0; i < 20; i++)
        {
            Paleta.Escrever("▪", Paleta.Sucesso);
            Thread.Sleep(70);
        }
        Console.WriteLine();
        Console.WriteLine();
    }

    public static void Cabecalho(string versao, ConfiguracaoApp configuracao)
    {
        Limpar();
        Paleta.EscreverLinha(Borda('╔', '╗'), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaTexto($" RELATÓRIO TOGGL · {Autor} · v{versao}"), Paleta.Titulo);
        Paleta.EscreverLinha(Borda('╠', '╣'), Paleta.Titulo);
        Paleta.EscreverLinha(LinhaTexto(Resumo(configuracao)), Paleta.Info);
        Paleta.EscreverLinha(Borda('╚', '╝'), Paleta.Titulo);
    }

    public static void ExibirComCabecalho(string versao, ConfiguracaoApp configuracao, Action conteudo)
    {
        Cabecalho(versao, configuracao);
        conteudo();
    }

    public static void ListarUsuariosSelecionados(List<ConfiguracaoUsuario> usuarios)
    {
        if (usuarios.Count == 0)
            return;

        Console.WriteLine();
        Paleta.EscreverLinha(" Usuários selecionados:", Paleta.Neutro);
        foreach (ConfiguracaoUsuario usuario in usuarios)
            Paleta.EscreverLinha($"   • {usuario.NomeExibicao}", Paleta.Info);
    }

    public static void Despedida(string versao)
    {
        BemVindo(versao);
        Paleta.EscreverLinha(Borda('╔', '╗'), Paleta.Sucesso);
        Paleta.EscreverLinha(LinhaCentralizada("Até a próxima!"), Paleta.Sucesso);
        Paleta.EscreverLinha(Borda('╚', '╝'), Paleta.Sucesso);
        Console.WriteLine();
        Thread.Sleep(1200);
        Console.ResetColor();
    }

    private static string Resumo(ConfiguracaoApp c)
    {
        string periodo = string.IsNullOrWhiteSpace(c.DataInicioAnterior) || string.IsNullOrWhiteSpace(c.DataFimAnterior)
            ? "—"
            : $"{Rotulos.Data(DateTime.Parse(c.DataInicioAnterior))} a {Rotulos.Data(DateTime.Parse(c.DataFimAnterior))}";

        return $" Período: {periodo} · Agrupamento: {Rotulos.Agrupamento(c.AgrupamentoPadrao)}";
    }

    private static string Borda(char inicio, char fim) => $"{inicio}{LinhaCheia}{fim}";

    private static string LinhaCentralizada(string texto) => $"║{Centralizar(texto)}║";

    private static string LinhaTexto(string texto) => $"║{Ajustar(texto)}║";

    private static string Centralizar(string texto)
    {
        if (texto.Length >= Largura)
            return texto[..Largura];

        int espacos = Largura - texto.Length;
        int esquerda = espacos / 2;
        return new string(' ', esquerda) + texto + new string(' ', espacos - esquerda);
    }

    private static string Ajustar(string texto) => Ajustar(texto, Largura);

    public static string Ajustar(string texto, int largura) =>
        texto.Length > largura ? texto[..(largura - 1)] + "…" : texto.PadRight(largura);

    public static int LarguraRestante(int larguraConsumida) => Math.Max(1, Largura - larguraConsumida);

    public static string LinhaPreenchida(string prefixo, char preenchimento)
    {
        if (prefixo.Length >= Largura)
            return prefixo[..(Largura - 1)] + "…";

        return prefixo + new string(preenchimento, Largura - prefixo.Length);
    }

    private static void Limpar()
    {
        if (Console.IsOutputRedirected)
            return;

        try
        {
            Console.Write(SequenciaLimparTela);
            Console.Clear();
        }
        catch (IOException)
        {
        }
    }
}