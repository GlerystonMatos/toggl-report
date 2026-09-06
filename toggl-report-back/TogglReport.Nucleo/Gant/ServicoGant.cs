using RelatorioToggl.Configuracao;
using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Gant;

public static class ServicoGant
{
    public static ResultadoGant Montar(CacheConsulta cache, List<ConfiguracaoUsuario> usuarios, DateTime inicio, DateTime fim, List<string> tagsSelecionadas, string agrupamento, string? termo = null)
    {
        List<string> dias = new();
        for (DateTime dia = inicio.Date; dia <= fim.Date; dia = dia.AddDays(1))
        {
            if (dia.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                continue;

            dias.Add(dia.ToString("yyyy-MM-dd"));
        }

        Dictionary<string, ConfiguracaoUsuario> usuariosPorChave = usuarios.ToDictionary(u => u.Chave);
        Dictionary<string, int> ordemPorChave = usuarios
            .Select((usuario, indice) => (usuario.Chave, indice))
            .ToDictionary(par => par.Chave, par => par.indice);

        Dictionary<(string UsuarioChave, string Categoria, string Descricao), Dictionary<string, double>> horasPorDiaNaLinha = new();
        Dictionary<(string UsuarioChave, string Categoria, string Descricao), double> totalPorLinha = new();
        Dictionary<(string UsuarioChave, string Categoria, string Descricao), bool> detalhadaPorLinha = new();

        foreach (UsuarioCacheado usuarioCacheado in cache.Usuarios)
        {
            if (!usuariosPorChave.TryGetValue(usuarioCacheado.Chave, out ConfiguracaoUsuario? usuario))
                continue;

            foreach (RegistroTempoDto registro in ServicoAgrupamento.ObterConcluidos(usuarioCacheado.Registros))
            {
                if (!string.IsNullOrWhiteSpace(termo) && !(registro.Descricao?.Contains(termo, StringComparison.OrdinalIgnoreCase) ?? false))
                    continue;

                if (registro.Inicio is not DateTimeOffset inicioRegistro)
                    continue;

                string dia = inicioRegistro.ToLocalTime().Date.ToString("yyyy-MM-dd");
                string categoria = registro.Tags is { Count: > 0 } ? registro.Tags[0] : "(sem tag)";
                bool tagSelecionada = !string.IsNullOrWhiteSpace(termo) || (agrupamento switch
                {
                    "descricao" => true,
                    "tag" => false,
                    _ => tagsSelecionadas.Contains(categoria, StringComparer.OrdinalIgnoreCase),
                });
                string descricao = tagSelecionada
                    ? (string.IsNullOrWhiteSpace(registro.Descricao) ? "(sem descrição)" : ServicoAgrupamento.NormalizarDescricaoTel(registro.Descricao.Trim()))
                    : categoria;
                double horas = registro.Duracao / 3600.0;

                (string UsuarioChave, string Categoria, string Descricao) chaveLinha = (usuario.Chave, categoria, descricao);

                if (!horasPorDiaNaLinha.TryGetValue(chaveLinha, out Dictionary<string, double>? porDia))
                {
                    porDia = new Dictionary<string, double>();
                    horasPorDiaNaLinha[chaveLinha] = porDia;
                }
                porDia[dia] = porDia.GetValueOrDefault(dia) + horas;
                totalPorLinha[chaveLinha] = totalPorLinha.GetValueOrDefault(chaveLinha) + horas;
                detalhadaPorLinha[chaveLinha] = tagSelecionada;
            }
        }

        List<(string UsuarioChave, string Categoria, string Descricao)> chavesOrdenadas = horasPorDiaNaLinha.Keys
            .OrderBy(k => ordemPorChave[k.UsuarioChave])
            .ThenByDescending(k => detalhadaPorLinha[k])
            .ThenBy(k => k.Categoria, StringComparer.OrdinalIgnoreCase)
            .ThenBy(k => k.Descricao, StringComparer.OrdinalIgnoreCase)
            .ToList();

        List<LinhaGant> linhas = new();
        foreach ((string UsuarioChave, string Categoria, string Descricao) chave in chavesOrdenadas)
        {
            ConfiguracaoUsuario usuario = usuariosPorChave[chave.UsuarioChave];
            Dictionary<string, List<CelulaGant>> celulasPorDia = new();
            foreach ((string dia, double horas) in horasPorDiaNaLinha[chave])
                celulasPorDia[dia] = new List<CelulaGant> { new CelulaGant(usuario.Chave, usuario.NomeExibicao, usuario.Sigla, usuario.Cor, horas) };

            linhas.Add(new LinhaGant(usuario.Chave, usuario.NomeExibicao, chave.Categoria, chave.Descricao, totalPorLinha[chave], celulasPorDia));
        }

        return new ResultadoGant(dias, linhas);
    }
}