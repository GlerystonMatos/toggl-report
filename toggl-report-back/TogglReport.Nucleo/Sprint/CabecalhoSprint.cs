namespace RelatorioToggl.Sprints;

public record CabecalhoSprint(string Nome, decimal HorasPorDia, int DiasUteis, int Margem, string DataInicio, string DataFim, int Ct, int Td, int TarefasPendentes, int TarefasConcluidas);