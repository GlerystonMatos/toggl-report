namespace RelatorioToggl.Api.Endpoints;

public static class TratamentoIo
{
    public static IResult? Executar(Action acao, string mensagemErro)
    {
        try
        {
            acao();
            return null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Results.Problem(mensagemErro, statusCode: 500);
        }
    }
}