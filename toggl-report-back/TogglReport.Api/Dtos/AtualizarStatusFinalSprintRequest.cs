namespace RelatorioToggl.Api.Dtos;

public record AtualizarStatusFinalSprintRequest(List<string> StatusConcluido, List<string> StatusIgnorado);