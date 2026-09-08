namespace RelatorioToggl.Api.Endpoints;

public static class ValidacaoDatas
{
    public static bool Tenta(string? dataInicio, string? dataFim, out DateTime inicio, out DateTime fim, out IResult? erro)
    {
        bool inicioValido = DateTime.TryParse(dataInicio, out inicio);
        bool fimValido = DateTime.TryParse(dataFim, out fim);

        if (!inicioValido || !fimValido)
        {
            erro = Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");
            return false;
        }

        if (fim < inicio)
        {
            erro = Results.BadRequest("A data fim não pode ser anterior à data início.");
            return false;
        }

        erro = null;
        return true;
    }
}