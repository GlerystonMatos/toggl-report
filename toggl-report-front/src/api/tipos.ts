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
    dataInicio: string;
    dataFim: string;
}

export interface UsuarioResumo {
    chave: string;
    nomeExibicao: string;
    tokenMascarado: string;
    sigla: string;
    cor: string;
    selecionado: boolean;
}

export interface CriarUsuarioRequest {
    nomeExibicao: string;
    tokenApi: string;
    ignorarValidacao?: boolean;
    sigla: string;
    cor: string;
    selecionado?: boolean;
}

export interface EditarUsuarioRequest {
    nomeExibicao?: string | null;
    tokenApi?: string | null;
    ignorarValidacao?: boolean;
    sigla?: string | null;
    cor?: string | null;
    selecionado?: boolean | null;
}

export interface ValidarTokenResponse {
    valido: boolean;
}

export type StatusConsultaUsuario =
    | 'Sucesso'
    | 'Erro'
    | 'LimiteAtingidoComCache'
    | 'LimiteAtingidoSemCache';

export interface EventoConsultaUsuario {
    nomeUsuario: string;
    status: StatusConsultaUsuario;
    mensagem: string | null;
    quantidadeRegistros: number | null;
}

export interface ConsultarRequest {
    dataInicio: string;
    dataFim: string;
    forcarConsultaApi?: boolean;
}

export interface ConsultarResponse {
    dataInicio: string;
    dataFim: string;
    veioDoCache: boolean;
    usuarios: EventoConsultaUsuario[];
}

export interface LinhaDescricao {
    descricao: string;
    segundos: number;
    tag: string | null;
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

export interface RelatorioUsuario {
    nomeExibicao: string;
    porDescricao: LinhaDescricao[];
    porTag: Record<string, number>;
    emAndamento: RegistroTempoBruto[];
    totalSegundos: number;
}

export interface RelatorioResponse {
    dataInicio: string;
    dataFim: string;
    agrupamento: Agrupamento;
    usuarios: RelatorioUsuario[];
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
    dataInicio: string;
    dataFim: string;
    tagsSelecionadas: string[];
    agrupamento: Agrupamento;
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