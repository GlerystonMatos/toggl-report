using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Api.Dtos;

public record RelatorioUsuarioTogglDto(
    string NomeExibicao,
    string Sigla,
    string Cor,
    List<LinhaDescricao> PorDescricao,
    Dictionary<string, long> PorTag,
    List<RegistroTempoDto> EmAndamento,
    long TotalSegundos);