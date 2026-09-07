using System.Text;

namespace RelatorioToggl.Api.Autenticacao;

public static class AutenticacaoBasicaMiddleware
{
    private const string CaminhoLivre = "/health";

    private const string PrefixoSwaggerLivre = "/swagger";

    private const string PrefixoImagensSwaggerLivre = "/images";

    public static void UseAutenticacaoBasica(this WebApplication app)
    {
        string? usuarioEsperado = app.Configuration["AUTH:USUARIO"];
        string? senhaEsperada = app.Configuration["AUTH:SENHA"];

        if (string.IsNullOrEmpty(usuarioEsperado) || string.IsNullOrEmpty(senhaEsperada))
        {
            return;
        }

        app.Use(async (context, next) =>
        {
            if (context.Request.Path == CaminhoLivre
                || context.Request.Path.StartsWithSegments(PrefixoSwaggerLivre)
                || context.Request.Path.StartsWithSegments(PrefixoImagensSwaggerLivre))
            {
                await next();
                return;
            }

            if (CredencialValida(context.Request.Headers["Authorization"], usuarioEsperado, senhaEsperada))
            {
                await next();
                return;
            }

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsync("Não autenticado.");
        });
    }

    private static bool CredencialValida(string? cabecalho, string usuarioEsperado, string senhaEsperada)
    {
        if (cabecalho is null || !cabecalho.StartsWith("Basic ", StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            string credencial = Encoding.UTF8.GetString(Convert.FromBase64String(cabecalho["Basic ".Length..]));
            int indice = credencial.IndexOf(':');
            if (indice < 0)
            {
                return false;
            }

            string usuario = credencial[..indice];
            string senha = credencial[(indice + 1)..];
            return usuario == usuarioEsperado && senha == senhaEsperada;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}