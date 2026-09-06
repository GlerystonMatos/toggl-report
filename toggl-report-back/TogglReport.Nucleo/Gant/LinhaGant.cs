namespace RelatorioToggl.Gant;

public sealed record LinhaGant(string UsuarioChave, string NomeExibicao, string Categoria, string Descricao, double TotalHoras, Dictionary<string, List<CelulaGant>> CelulasPorDia);