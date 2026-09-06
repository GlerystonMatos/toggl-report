using RelatorioToggl.Api.Endpoints;
using RelatorioToggl.Configuracao;
using System.Text.Json.Serialization;

const string PoliticaCorsLocal = "PoliticaCorsLocal";

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(opcoes =>
{
    opcoes.AddPolicy(PoliticaCorsLocal, politica =>
        politica.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

builder.Services.ConfigureHttpJsonOptions(opcoes =>
    opcoes.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddHealthChecks();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opcoes =>
{
    opcoes.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo
    {
        Title = "TogglReport",
        Version = "v1",
        Description = "API local, sem autenticação, que expõe as mesmas funcionalidades do console TogglReport: parâmetros, usuários/tokens, consulta com cache, relatório e busca por descrição."
    });
});

WebApplication app = builder.Build();

app.UseCors(PoliticaCorsLocal);

app.UseStaticFiles();

app.MapHealthChecks("/health");

app.UseSwagger();
app.UseSwaggerUI(opcoes =>
{
    opcoes.SwaggerEndpoint("/swagger/v1/swagger.json", "TogglReport API");
    opcoes.RoutePrefix = "swagger";
    opcoes.HeadContent = """
        <style>
        .swagger-ui .info {
          margin-bottom: 0px;
        }

        .swagger-ui .scheme-container {
          margin: 0px;
          padding: 0px;
          background: none;
          box-shadow: none;
        }

        .swagger-ui .scheme-container .schemes .auth-wrapper .authorize {
          margin-right: 0.5rem;
        }

        .swagger-ui .topbar {
          background-color: #363636;
        }

        .swagger-ui .topbar a svg {
          display: none;
        }

        .swagger-ui .topbar a {
          content: url('../images/toggl-report.png');
          height: 2.5rem;
          flex: unset;
        }

        .swagger-ui .topbar .download-url-wrapper .select-label {
          display: none;
        }

        .swagger-ui .btn.authorize {
          margin-bottom: 1rem !important;
        }
        </style>
        """;
});

string caminhoConfiguracao = CaminhosDados.CaminhoConfiguracao(AppContext.BaseDirectory);
string caminhoCache = CaminhosDados.CaminhoCache(AppContext.BaseDirectory);
string caminhoParametrosGant = CaminhosDados.CaminhoParametrosGant(AppContext.BaseDirectory);
string caminhoCacheGant = CaminhosDados.CaminhoCacheGant(AppContext.BaseDirectory);
string pastaDados = CaminhosDados.PastaDados(AppContext.BaseDirectory);

app.MapConfiguracaoEndpoints(caminhoConfiguracao);
app.MapUsuariosEndpoints(caminhoConfiguracao);
app.MapConsultasEndpoints(caminhoConfiguracao, caminhoCache);
app.MapRelatorioEndpoints(caminhoConfiguracao, caminhoCache);
app.MapBuscaEndpoints(caminhoConfiguracao, caminhoCache);
app.MapDadosEndpoints(pastaDados);
app.MapGantEndpoints(caminhoConfiguracao, caminhoParametrosGant, caminhoCacheGant);

app.Run();