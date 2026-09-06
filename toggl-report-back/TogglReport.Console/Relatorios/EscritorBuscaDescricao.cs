using RelatorioToggl.Apresentacao;

namespace RelatorioToggl.Relatorios;

public static class EscritorBuscaDescricao
{
    private const string IndentacaoUsuario = EscritorRelatorioConsole.Indentacao + "  ";

    public static void ImprimirNoConsole(ResultadoBuscaDescricao resultado, string termoBusca)
    {
        Console.WriteLine();
        Paleta.EscreverLinha(Tela.LinhaPreenchida($" ═══ Resultado da busca: \"{termoBusca}\" ", '═'), Paleta.Titulo);

        if (resultado.Linhas.Count == 0)
        {
            Paleta.EscreverLinha("   Nenhuma descrição encontrada com esse termo.", Paleta.Info);
            return;
        }

        Paleta.EscreverLinha(Tela.LinhaPreenchida(EscritorRelatorioConsole.TituloSecaoDescricao, '─'), Paleta.Neutro);

        foreach (LinhaBusca linha in resultado.Linhas)
        {
            Console.WriteLine();

            EscritorRelatorioConsole.ImprimirLinha(EscritorRelatorioConsole.Indentacao, linha.Descricao, linha.TotalSegundosLinha);

            foreach (KeyValuePair<string, long> porUsuario in linha.SegundosPorUsuario.OrderByDescending(par => par.Value))
                EscritorRelatorioConsole.ImprimirLinha(IndentacaoUsuario, porUsuario.Key, porUsuario.Value);

            Console.WriteLine();
        }

        Paleta.EscreverLinha($"   Total geral: {EscritorRelatorioConsole.FormatarDuracao(resultado.TotalGeralSegundos)}", Paleta.Sucesso);
    }
}