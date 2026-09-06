using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Api.Dtos;

public record RelatorioUsuarioDto(
    string NomeExibicao,
    List<LinhaDescricao> PorDescricao,
    Dictionary<string, long> PorTag,
    List<RegistroTempoDto> EmAndamento,
    long TotalSegundos);