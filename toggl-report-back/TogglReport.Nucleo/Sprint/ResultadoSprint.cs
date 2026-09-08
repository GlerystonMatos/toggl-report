namespace RelatorioToggl.Sprints;

public record ResultadoSprint(CabecalhoSprint Cabecalho, List<LinhaTarefaSprint> Tarefas, List<LinhaColaboradorSprint> Colaboradores);