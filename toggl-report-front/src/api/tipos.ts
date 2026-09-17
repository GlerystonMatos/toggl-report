export type Agrupamento = 'descricao' | 'tag' | 'ambos';

export interface ParametrosConfiguracao {
    agrupamento: Agrupamento;
    tagsDetalhadas: string[];
    dataInicio: string | null;
    dataFim: string | null;
}

export interface AtualizarParametrosRequest {
    agrupamento: Agrupamento;
    tagsDetalhadas: string[];
    dataInicio: string | null;
    dataFim: string | null;
}

export interface UsuarioTogglResumo {
    chave: string;
    nomeExibicao: string;
    tokenMascarado: string;
    sigla: string;
    cor: string;
    selecionado: boolean;
    administrador: boolean;
}

export interface CriarUsuarioTogglRequest {
    nomeExibicao: string;
    tokenApi: string;
    ignorarValidacao?: boolean;
    sigla: string;
    cor: string;
    selecionado?: boolean;
    administrador?: boolean;
}

export interface EditarUsuarioTogglRequest {
    nomeExibicao?: string | null;
    tokenApi?: string | null;
    ignorarValidacao?: boolean;
    sigla?: string | null;
    cor?: string | null;
    selecionado?: boolean | null;
    administrador?: boolean | null;
}

export interface TagsTogglResponse {
    tags: string[];
    veioDoCache: boolean;
    atualizadoEm: string;
}

export interface ListaJiraResponse {
    nomes: string[];
    veioDoCache: boolean;
    atualizadoEm: string;
}

export interface CoresJira {
    coresStatus: Record<string, string>;
    coresPrioridade: Record<string, string>;
}

export interface AtualizarCoresJiraRequest {
    coresStatus?: Record<string, string> | null;
    coresPrioridade?: Record<string, string> | null;
}

export interface ValidarTokenResponse {
    valido: boolean;
}

export type StatusConsultaUsuarioToggl =
    | 'Sucesso'
    | 'Erro'
    | 'LimiteAtingidoComCache'
    | 'LimiteAtingidoSemCache';

export interface EventoConsultaUsuarioToggl {
    nomeUsuario: string;
    status: StatusConsultaUsuarioToggl;
    mensagem: string | null;
    quantidadeRegistros: number | null;
}

export interface ConsultarRequest {
    dataInicio: string;
    dataFim: string;
    forcarConsultaApi?: boolean;
}

export type OrigemConsultaSprint = 'nenhum' | 'toggl' | 'jira' | 'ambos';

export interface ConsultarSprintRequest extends ConsultarRequest {
    chaveSprint: string;
    origem?: OrigemConsultaSprint;
}

export interface ConsultarResponse {
    dataInicio: string;
    dataFim: string;
    veioDoCache: boolean;
    usuarios: EventoConsultaUsuarioToggl[];
}

export interface LinhaDescricao {
    descricao: string;
    segundos: number;
    tag: string | null;
}

export interface ConfiguracaoJira {
    urlDominio: string;
    email: string;
    tokenMascarado: string;
    campoEstimativaDesenvolvimentoId: string;
    campoEstimativaDesenvolvimentoNome: string;
    campoRevisadoPorId: string;
    campoRevisadoPorNome: string;
    campoEstimativaRevisaoId: string;
    campoEstimativaRevisaoNome: string;
    campoEstimativaTestesId: string;
    campoEstimativaTestesNome: string;
}

export interface SalvarConfiguracaoJiraRequest {
    urlDominio: string;
    email: string;
    apiToken?: string | null;
    campoEstimativaDesenvolvimentoId: string;
    campoEstimativaDesenvolvimentoNome: string;
    campoRevisadoPorId: string;
    campoRevisadoPorNome: string;
    campoEstimativaRevisaoId: string;
    campoEstimativaRevisaoNome: string;
    campoEstimativaTestesId: string;
    campoEstimativaTestesNome: string;
}

export interface EntradaMapeamentoJiraToggl {
    chaveToggl: string | null;
    sigla: string | null;
    cor: string | null;
}

export interface MapeamentoJiraToggl {
    mapeamento: Record<string, EntradaMapeamentoJiraToggl>;
}

export interface AtualizarMapeamentoJiraTogglRequest {
    mapeamento?: Record<string, EntradaMapeamentoJiraToggl> | null;
}

export interface TestarConexaoJiraRequest {
    urlDominio: string;
    email: string;
    apiToken: string;
}

export interface TestarConexaoJiraResponse {
    sucesso: boolean;
    mensagem: string | null;
}

export interface ObterCamposJiraRequest {
    urlDominio?: string;
    email?: string;
    apiToken?: string;
}

export interface CampoJira {
    id: string;
    nome: string;
}

export interface RegistroTempoBruto {
    id: number;
    workspace_id: number;
    project_id: number | null;
    description: string | null;
    duration: number;
    tags: string[] | null;
    start: string;
    stop: string | null;
}

export interface RelatorioUsuarioToggl {
    nomeExibicao: string;
    sigla: string;
    cor: string;
    porDescricao: LinhaDescricao[];
    porTag: Record<string, number>;
    emAndamento: RegistroTempoBruto[];
    totalSegundos: number;
}

export interface RelatorioResponse {
    dataInicio: string;
    dataFim: string;
    agrupamento: Agrupamento;
    usuarios: RelatorioUsuarioToggl[];
}

export interface LinhaBusca {
    descricao: string;
    segundosPorUsuario: Record<string, number>;
    totalSegundosLinha: number;
}

export interface ResultadoBuscaDescricao {
    linhas: LinhaBusca[];
    totalGeralSegundos: number;
}

export interface ParametrosGant {
    dataInicio: string | null;
    dataFim: string | null;
    tagsSelecionadas: string[];
    agrupamento: Agrupamento;
}

export interface AtualizarParametrosGantRequest {
    tagsSelecionadas: string[];
    agrupamento: Agrupamento;
    dataInicio: string | null;
    dataFim: string | null;
}

export interface Sprint {
    chave: string;
    nome: string;
    horasPorDia: number;
    dataInicio: string;
    dataFim: string;
    fechado: boolean;
}

export interface CriarSprintRequest {
    nome: string;
    horasPorDia: number;
    dataInicio: string;
    dataFim: string;
}

export interface EditarSprintRequest {
    nome?: string | null;
    horasPorDia?: number | null;
    dataInicio?: string | null;
    dataFim?: string | null;
}

export interface CategoriasSprint {
    dev: string[];
    rev: string[];
    qa: string[];
    agrupamento: Agrupamento;
    tagsDetalhadas: string[];
    corTag: string;
}

export interface AtualizarCategoriasSprintRequest {
    dev: string[];
    rev: string[];
    qa: string[];
    agrupamento: Agrupamento;
    tagsDetalhadas: string[];
    corTag: string;
}

export interface CelulaGant {
    usuarioChave: string;
    nomeExibicao: string;
    sigla: string;
    cor: string;
    horas: number;
}

export interface LinhaGant {
    usuarioChave: string;
    nomeExibicao: string;
    categoria: string;
    descricao: string;
    totalHoras: number;
    celulasPorDia: Record<string, CelulaGant[]>;
}

export interface ResultadoGant {
    dias: string[];
    linhas: LinhaGant[];
}

export interface BlocoCategoriaSprint {
    preHoras: number;
    reaSegundos: number;
    nomeExibicao: string | null;
    sigla: string | null;
    cor: string | null;
}

export interface LinhaTarefaSprint {
    codigo: string;
    descricao: string;
    agrupada: boolean;
    dev: BlocoCategoriaSprint;
    rev: BlocoCategoriaSprint;
    qa: BlocoCategoriaSprint;
    prioridade: string | null;
    situacao: string | null;
    urlJira: string | null;
    jiraIndisponivel: boolean;
    situacaoCategoria: string | null;
    grupoResponsavelStatus: 'dev' | 'rev' | 'qa' | null;
    situacaoSemGrupoResponsavel: boolean;
}

export interface ResponsabilidadeSprint {
    statusDev: string[];
    statusRev: string[];
    statusQa: string[];
}

export interface AtualizarResponsabilidadeSprintRequest {
    statusDev: string[];
    statusRev: string[];
    statusQa: string[];
}

export interface StatusFinalSprint {
    statusConcluido: string[];
    statusIgnorado: string[];
}

export interface AtualizarStatusFinalSprintRequest {
    statusConcluido: string[];
    statusIgnorado: string[];
}

export interface CabecalhoSprint {
    nome: string;
    horasPorDia: number;
    diasUteis: number;
    margem: number;
    dataInicio: string;
    dataFim: string;
    ct: number;
    td: number;
    tarefasPendentes: number;
    tarefasConcluidas: number;
}

export interface LinhaColaboradorSprint {
    nomeExibicao: string;
    sigla: string;
    cor: string;
    td: number;
    segundosRealizados: number;
    tarefasPendentes: number;
    tarefasConcluidas: number;
}

export interface ResultadoSprint {
    cabecalho: CabecalhoSprint;
    tarefas: LinhaTarefaSprint[];
    colaboradores: LinhaColaboradorSprint[];
}