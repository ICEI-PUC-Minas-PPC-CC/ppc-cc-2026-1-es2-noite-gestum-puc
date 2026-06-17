const STORAGE_KEYS = {
  certificados: "gestum.certificados",
  usuarios: "gestum.usuarios",
  auditoria: "gestum.auditoria",
  seedVersion: "gestum.seedVersion",
};

const SEED_VERSION = "2";

const PRAZO_PROXIMO_DIAS = 30;

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

class Usuario {
  constructor({ idUsuario, nome, email, perfil = "Responsavel", ativo = true }) {
    this.idUsuario = idUsuario;
    this.nome = nome;
    this.email = email;
    this.perfil = perfil;
    this.ativo = ativo;
  }
}

class Certificado {
  constructor({
    idCertificado,
    nome,
    descricao,
    dataEmissao,
    dataVencimento,
    status = "auto",
    idResponsavel,
  }) {
    this.idCertificado = idCertificado;
    this.nome = nome;
    this.descricao = descricao;
    this.dataEmissao = dataEmissao;
    this.dataVencimento = dataVencimento;
    this.status = status;
    this.idResponsavel = idResponsavel;
  }

  calcularDiasParaVencimento(base = new Date()) {
    const hoje = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const vencimento = new Date(`${this.dataVencimento}T00:00:00`);
    const diferenca = vencimento.getTime() - hoje.getTime();
    return Math.ceil(diferenca / 86400000);
  }

  estaVencido() {
    return this.calcularDiasParaVencimento() < 0;
  }

  estaDentroDoPrazoDeAlerta(prazoDias = PRAZO_PROXIMO_DIAS) {
    const dias = this.calcularDiasParaVencimento();
    return dias >= 0 && dias <= prazoDias;
  }

  obterStatusCalculado() {
    if (this.status !== "auto") {
      return this.status;
    }

    if (this.estaVencido()) {
      return "Vencido";
    }

    if (this.estaDentroDoPrazoDeAlerta()) {
      return "Próximo do vencimento";
    }

    return "Ativo";
  }
}

class LogAuditoria {
  constructor({ idLog, acao, descricao, dataHora, resultado, idCertificado = null, idUsuario = null }) {
    this.idLog = idLog;
    this.acao = acao;
    this.descricao = descricao;
    this.dataHora = dataHora;
    this.resultado = resultado;
    this.idCertificado = idCertificado;
    this.idUsuario = idUsuario;
  }
}

class LocalStorageRepository {
  constructor(storageKey) {
    this.storageKey = storageKey;
  }

  buscarTodos() {
    return JSON.parse(localStorage.getItem(this.storageKey) || "[]");
  }

  salvarTodos(items) {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }
}

class UsuarioRepository extends LocalStorageRepository {
  constructor() {
    super(STORAGE_KEYS.usuarios);
  }

  buscarPorId(idUsuario) {
    return this.buscarTodos().find((usuario) => usuario.idUsuario === idUsuario) || null;
  }

  buscarPorEmail(email) {
    return this.buscarTodos().find((usuario) => usuario.email.toLowerCase() === email.toLowerCase()) || null;
  }

  salvar(usuario) {
    const usuarios = this.buscarTodos();
    const existente = usuarios.findIndex((item) => item.idUsuario === usuario.idUsuario);

    if (existente >= 0) {
      usuarios[existente] = usuario;
    } else {
      usuarios.push(usuario);
    }

    this.salvarTodos(usuarios);
    return usuario;
  }
}

class CertificadoRepository extends LocalStorageRepository {
  constructor() {
    super(STORAGE_KEYS.certificados);
  }

  buscarPorId(idCertificado) {
    const item = this.buscarTodos().find((certificado) => certificado.idCertificado === idCertificado);
    return item ? new Certificado(item) : null;
  }

  salvar(certificado) {
    const certificados = this.buscarTodos();
    certificados.push(certificado);
    this.salvarTodos(certificados);
    return certificado;
  }

  atualizar(certificado) {
    const certificados = this.buscarTodos();
    const index = certificados.findIndex((item) => item.idCertificado === certificado.idCertificado);

    if (index < 0) {
      throw new Error("Certificado não encontrado.");
    }

    certificados[index] = certificado;
    this.salvarTodos(certificados);
    return certificado;
  }
}

class LogAuditoriaRepository extends LocalStorageRepository {
  constructor() {
    super(STORAGE_KEYS.auditoria);
  }

  salvar(log) {
    const logs = this.buscarTodos();
    logs.unshift(log);
    this.salvarTodos(logs.slice(0, 20));
    return log;
  }
}

class CertificadoService {
  constructor({ certificadoRepository, usuarioRepository, logAuditoriaRepository }) {
    this.certificadoRepository = certificadoRepository;
    this.usuarioRepository = usuarioRepository;
    this.logAuditoriaRepository = logAuditoriaRepository;
  }

  salvarCertificado(dados) {
    this.validar(dados);

    const usuario = this.obterOuCriarUsuario(dados.responsavel, dados.email);
    const certificado = new Certificado({
      idCertificado: dados.idCertificado || createId(),
      nome: dados.nome.trim(),
      descricao: dados.descricao.trim(),
      dataEmissao: dados.dataEmissao,
      dataVencimento: dados.dataVencimento,
      status: dados.status,
      idResponsavel: usuario.idUsuario,
    });

    const salvo = dados.idCertificado
      ? this.certificadoRepository.atualizar(certificado)
      : this.certificadoRepository.salvar(certificado);

    this.registrarAuditoria({
      acao: dados.idCertificado ? "Atualização" : "Cadastro",
      descricao: `${dados.idCertificado ? "Atualizou" : "Cadastrou"} o certificado ${salvo.nome}.`,
      idCertificado: salvo.idCertificado,
      idUsuario: usuario.idUsuario,
    });

    return this.montarViewModel(salvo);
  }

  listarCertificados() {
    return this.certificadoRepository
      .buscarTodos()
      .map((item) => this.montarViewModel(new Certificado(item)))
      .sort((a, b) => a.diasParaVencimento - b.diasParaVencimento);
  }

  buscarCertificado(idCertificado) {
    const certificado = this.certificadoRepository.buscarPorId(idCertificado);

    if (!certificado) {
      throw new Error("Certificado não encontrado.");
    }

    return this.montarViewModel(certificado);
  }

  obterResumo() {
    const certificados = this.listarCertificados();

    return {
      total: certificados.length,
      ativos: certificados.filter((item) => item.statusCalculado === "Ativo").length,
      proximos: certificados.filter((item) => item.statusCalculado === "Próximo do vencimento").length,
      vencidos: certificados.filter((item) => item.statusCalculado === "Vencido").length,
    };
  }

  validar(dados) {
    if (!dados.nome.trim()) {
      throw new Error("Informe o nome do certificado.");
    }

    if (!dados.responsavel.trim()) {
      throw new Error("Informe o responsavel pelo certificado.");
    }

    if (!dados.email.trim()) {
      throw new Error("Informe o e-mail do responsavel.");
    }

    if (!dados.dataEmissao || !dados.dataVencimento) {
      throw new Error("Informe as datas de emissao e vencimento.");
    }

    if (new Date(dados.dataVencimento) < new Date(dados.dataEmissao)) {
      throw new Error("A data de vencimento deve ser igual ou posterior a data de emissao.");
    }
  }

  obterOuCriarUsuario(nome, email) {
    const existente = this.usuarioRepository.buscarPorEmail(email);
    const usuario = new Usuario({
      idUsuario: existente?.idUsuario || createId(),
      nome: nome.trim(),
      email: email.trim(),
      perfil: existente?.perfil || "Responsável",
      ativo: true,
    });

    return this.usuarioRepository.salvar(usuario);
  }

  montarViewModel(certificado) {
    const usuario = this.usuarioRepository.buscarPorId(certificado.idResponsavel);

    return {
      ...certificado,
      responsavel: usuario?.nome || "Responsável não encontrado",
      email: usuario?.email || "-",
      diasParaVencimento: certificado.calcularDiasParaVencimento(),
      statusCalculado: certificado.obterStatusCalculado(),
    };
  }

  registrarAuditoria({ acao, descricao, idCertificado, idUsuario }) {
    return this.logAuditoriaRepository.salvar(
      new LogAuditoria({
        idLog: createId(),
        acao,
        descricao,
        dataHora: new Date().toISOString(),
        resultado: "Sucesso",
        idCertificado,
        idUsuario,
      }),
    );
  }
}

class CertificadoController {
  constructor({ certificadoService, logAuditoriaRepository }) {
    this.certificadoService = certificadoService;
    this.logAuditoriaRepository = logAuditoriaRepository;
    this.estado = {
      busca: "",
      filtroStatus: "todos",
      selecionadoId: null,
    };

    this.refs = {
      views: Array.from(document.querySelectorAll("[data-view]")),
      navLinks: Array.from(document.querySelectorAll("[data-nav]")),
      modal: document.querySelector("#certificado-modal"),
      modalBackdrop: document.querySelector("[data-close-modal]"),
      novoCertificado: document.querySelector("#novo-certificado"),
      editarCertificadoDetalhe: document.querySelector("#editar-certificado-detalhe"),
      form: document.querySelector("#certificado-form"),
      formTitle: document.querySelector("#form-title"),
      id: document.querySelector("#certificado-id"),
      nome: document.querySelector("#nome"),
      responsavel: document.querySelector("#responsavel"),
      email: document.querySelector("#email"),
      dataEmissao: document.querySelector("#data-emissao"),
      dataVencimento: document.querySelector("#data-vencimento"),
      status: document.querySelector("#status"),
      descricao: document.querySelector("#descricao"),
      feedback: document.querySelector("#form-feedback"),
      limpar: document.querySelector("#limpar-formulario"),
      cancelar: document.querySelector("#cancelar-edicao"),
      busca: document.querySelector("#busca"),
      filtroStatus: document.querySelector("#filtro-status"),
      tbody: document.querySelector("#certificados-tbody"),
      dashboardTbody: document.querySelector("#dashboard-tbody"),
      filtroDataInicio: document.querySelector("#filtro-data-inicio"),
      filtroDataFim: document.querySelector("#filtro-data-fim"),
      graficoVencimentos: document.querySelector("#grafico-vencimentos"),
      graficoTotal: document.querySelector("#grafico-total"),
      graficoEmpty: document.querySelector("#grafico-empty"),
      emptyState: document.querySelector("#empty-state"),
      detalhes: document.querySelector("#detalhes-certificado"),
      detalhesTitulo: document.querySelector("#certificado-detalhe-title"),
      detalhesSubtitulo: document.querySelector("#certificado-detalhe-subtitle"),
      auditoria: document.querySelector("#auditoria-lista"),
      total: document.querySelector("#total-certificados"),
      ativos: document.querySelector("#total-ativos"),
      proximos: document.querySelector("#total-proximos"),
      vencidos: document.querySelector("#total-vencidos"),
      template: document.querySelector("#linha-certificado-template"),
    };
  }

  iniciar() {
    this.semearDadosIniciais();
    this.definirFiltroPadraoDashboard();
    this.vincularEventos();
    this.renderizar();
    this.navegar();
  }

  vincularEventos() {
    window.addEventListener("hashchange", () => this.navegar());

    this.refs.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.salvar();
    });

    this.refs.limpar.addEventListener("click", () => this.limparFormulario());
    this.refs.cancelar.addEventListener("click", () => this.fecharModal());
    this.refs.modalBackdrop.addEventListener("click", () => this.fecharModal());
    this.refs.novoCertificado.addEventListener("click", () => this.abrirModalNovo());
    this.refs.editarCertificadoDetalhe.addEventListener("click", () => {
      if (this.estado.selecionadoId) {
        this.editar(this.estado.selecionadoId);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.refs.modal.hidden) {
        this.fecharModal();
      }
    });

    this.refs.busca.addEventListener("input", (event) => {
      this.estado.busca = event.target.value.toLowerCase();
      this.renderizarTabela();
    });

    this.refs.filtroStatus.addEventListener("change", (event) => {
      this.estado.filtroStatus = event.target.value;
      this.renderizarTabela();
    });

    this.refs.filtroDataInicio.addEventListener("change", () => this.renderizarGraficoVencimentos());
    this.refs.filtroDataFim.addEventListener("change", () => this.renderizarGraficoVencimentos());
  }

  salvar() {
    try {
      const certificado = this.certificadoService.salvarCertificado({
        idCertificado: this.refs.id.value || null,
        nome: this.refs.nome.value,
        responsavel: this.refs.responsavel.value,
        email: this.refs.email.value,
        dataEmissao: this.refs.dataEmissao.value,
        dataVencimento: this.refs.dataVencimento.value,
        status: this.refs.status.value,
        descricao: this.refs.descricao.value,
      });

      this.estado.selecionadoId = certificado.idCertificado;
      this.exibirFeedback("Certificado salvo com sucesso.");
      this.limparFormulario({ manterFeedback: true });
      this.renderizar();
      this.abrirPaginaDetalhes(certificado.idCertificado);
      this.fecharModal();
    } catch (error) {
      this.exibirFeedback(error.message, true);
    }
  }

  editar(idCertificado) {
    const certificado = this.certificadoService.buscarCertificado(idCertificado);
    this.refs.id.value = certificado.idCertificado;
    this.refs.nome.value = certificado.nome;
    this.refs.responsavel.value = certificado.responsavel;
    this.refs.email.value = certificado.email;
    this.refs.dataEmissao.value = certificado.dataEmissao;
    this.refs.dataVencimento.value = certificado.dataVencimento;
    this.refs.status.value = certificado.status;
    this.refs.descricao.value = certificado.descricao;
    this.refs.formTitle.textContent = "Editar certificado";
    this.abrirModal();
  }

  limparFormulario({ manterFeedback = false } = {}) {
    this.refs.form.reset();
    this.refs.id.value = "";
    this.refs.status.value = "auto";
    this.refs.formTitle.textContent = "Novo certificado";

    if (!manterFeedback) {
      this.exibirFeedback("");
    }
  }

  abrirModalNovo() {
    this.limparFormulario();
    this.abrirModal();
  }

  abrirModal() {
    this.refs.modal.hidden = false;
    document.body.classList.add("is-modal-open");
    this.refs.nome.focus();
  }

  fecharModal() {
    this.refs.modal.hidden = true;
    document.body.classList.remove("is-modal-open");
    this.limparFormulario();
  }

  exibirFeedback(mensagem, erro = false) {
    this.refs.feedback.textContent = mensagem;
    this.refs.feedback.classList.toggle("is-error", erro);
  }

  renderizar() {
    this.renderizarResumo();
    this.renderizarGraficoVencimentos();
    this.renderizarDashboard();
    this.renderizarTabela();
    this.renderizarAuditoria();
  }

  navegar() {
    const rota = window.location.hash.replace("#", "") || "dashboard";
    let viewAtiva = this.refs.views.some((view) => view.dataset.view === rota) ? rota : "dashboard";
    let navAtiva = viewAtiva;

    if (rota.startsWith("certificado/")) {
      const idCertificado = decodeURIComponent(rota.replace("certificado/", ""));
      viewAtiva = "certificado-detalhe";
      navAtiva = "certificados";
      this.renderizarDetalhes(idCertificado);
    }

    this.refs.views.forEach((view) => {
      view.hidden = view.dataset.view !== viewAtiva;
    });

    this.refs.navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.dataset.nav === navAtiva);
    });
  }

  renderizarResumo() {
    const resumo = this.certificadoService.obterResumo();
    this.refs.total.textContent = resumo.total;
    this.refs.ativos.textContent = resumo.ativos;
    this.refs.proximos.textContent = resumo.proximos;
    this.refs.vencidos.textContent = resumo.vencidos;
  }

  renderizarTabela() {
    const certificados = this.filtrarCertificados(this.certificadoService.listarCertificados());
    this.refs.tbody.replaceChildren();
    this.refs.emptyState.hidden = certificados.length > 0;

    certificados.forEach((certificado) => {
      const linha = this.refs.template.content.firstElementChild.cloneNode(true);
      linha.querySelector('[data-field="nome"]').textContent = certificado.nome;
      linha.querySelector('[data-field="descricao"]').textContent = certificado.descricao || "Sem descrição";
      linha.querySelector('[data-field="responsavel"]').textContent = certificado.responsavel;
      linha.querySelector('[data-field="email"]').textContent = certificado.email;
      linha.querySelector('[data-field="vencimento"]').textContent = this.formatarData(certificado.dataVencimento);
      linha.querySelector('[data-field="dias"]').textContent = this.formatarDias(certificado.diasParaVencimento);

      const status = linha.querySelector('[data-field="status"]');
      status.textContent = certificado.statusCalculado;
      status.classList.add(this.obterClasseStatus(certificado.statusCalculado));

      linha.querySelector('[data-action="detalhes"]').addEventListener("click", () => {
        this.abrirPaginaDetalhes(certificado.idCertificado);
      });

      linha.querySelector('[data-action="editar"]').addEventListener("click", () => {
        this.editar(certificado.idCertificado);
      });

      this.refs.tbody.appendChild(linha);
    });
  }

  renderizarDashboard() {
    const certificados = this.certificadoService.listarCertificados().slice(0, 5);
    this.refs.dashboardTbody.replaceChildren();

    certificados.forEach((certificado) => {
      const linha = document.createElement("tr");
      const status = document.createElement("span");
      status.className = `status-badge ${this.obterClasseStatus(certificado.statusCalculado)}`;
      status.textContent = certificado.statusCalculado;

      linha.append(
        this.criarCelulaTabela(certificado.nome, certificado.descricao || "Sem descrição"),
        this.criarCelulaTabela(certificado.responsavel, certificado.email),
        this.criarCelulaTabela(this.formatarData(certificado.dataVencimento), this.formatarDias(certificado.diasParaVencimento)),
        this.criarCelulaComElemento(status),
        this.criarCelulaComBotao("Abrir", () => {
          this.abrirPaginaDetalhes(certificado.idCertificado);
        }),
      );

      this.refs.dashboardTbody.appendChild(linha);
    });
  }

  renderizarGraficoVencimentos() {
    const dataInicio = this.criarDataLocal(this.refs.filtroDataInicio.value);
    const dataFim = this.criarDataLocal(this.refs.filtroDataFim.value);

    if (!dataInicio || !dataFim || dataInicio > dataFim) {
      this.refs.graficoTotal.textContent = "0";
      this.refs.graficoVencimentos.replaceChildren();
      this.refs.graficoVencimentos.hidden = true;
      this.refs.graficoEmpty.hidden = false;
      this.refs.graficoEmpty.textContent = "Informe um período válido para visualizar o gráfico.";
      return;
    }

    const certificados = this.certificadoService
      .listarCertificados()
      .filter((certificado) => {
        const vencimento = this.criarDataLocal(certificado.dataVencimento);
        return vencimento >= dataInicio && vencimento <= dataFim;
      });

    const grupos = this.agruparCertificadosPorMes(certificados);
    const maiorValor = Math.max(...grupos.map((grupo) => grupo.total), 1);

    this.refs.graficoTotal.textContent = certificados.length;
    this.refs.graficoVencimentos.replaceChildren();
    this.refs.graficoEmpty.hidden = certificados.length > 0;
    this.refs.graficoEmpty.textContent = "Nenhum certificado vence dentro do período selecionado.";
    this.refs.graficoVencimentos.hidden = certificados.length === 0;

    grupos.forEach((grupo) => {
      const barra = document.createElement("div");
      const label = document.createElement("span");
      const trilho = document.createElement("div");
      const preenchimento = document.createElement("div");
      const valor = document.createElement("strong");

      barra.className = "bar-row";
      label.textContent = grupo.rotulo;
      trilho.className = "bar-track";
      preenchimento.className = "bar-fill";
      preenchimento.style.width = `${Math.max((grupo.total / maiorValor) * 100, grupo.total ? 8 : 0)}%`;
      valor.textContent = grupo.total;

      trilho.appendChild(preenchimento);
      barra.append(label, trilho, valor);
      this.refs.graficoVencimentos.appendChild(barra);
    });
  }

  agruparCertificadosPorMes(certificados) {
    const grupos = new Map();

    certificados.forEach((certificado) => {
      const data = this.criarDataLocal(certificado.dataVencimento);
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
      const rotulo = new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "2-digit",
      }).format(data);

      if (!grupos.has(chave)) {
        grupos.set(chave, { chave, rotulo, total: 0 });
      }

      grupos.get(chave).total += 1;
    });

    return Array.from(grupos.values()).sort((a, b) => a.chave.localeCompare(b.chave));
  }

  definirFiltroPadraoDashboard() {
    const hoje = new Date();
    const fim = new Date(hoje);
    fim.setFullYear(fim.getFullYear() + 1);

    this.refs.filtroDataInicio.value = this.formatarDataInput(hoje);
    this.refs.filtroDataFim.value = this.formatarDataInput(fim);
  }

  filtrarCertificados(certificados) {
    return certificados.filter((certificado) => {
      const texto = `${certificado.nome} ${certificado.responsavel} ${certificado.email} ${certificado.statusCalculado}`.toLowerCase();
      const statusOk = this.estado.filtroStatus === "todos" || certificado.statusCalculado === this.estado.filtroStatus;
      return texto.includes(this.estado.busca) && statusOk;
    });
  }

  renderizarDetalhes(idCertificado) {
    let certificado;

    try {
      certificado = this.certificadoService.buscarCertificado(idCertificado);
    } catch (error) {
      this.estado.selecionadoId = null;
      this.refs.detalhesTitulo.textContent = "Certificado não encontrado";
      this.refs.detalhesSubtitulo.textContent = "Volte para a lista e selecione um certificado cadastrado.";
      this.refs.detalhes.className = "details-placeholder";
      this.refs.detalhes.textContent = error.message;
      return;
    }

    this.estado.selecionadoId = certificado.idCertificado;
    this.refs.detalhesTitulo.textContent = certificado.nome;
    this.refs.detalhesSubtitulo.textContent = `Responsável: ${certificado.responsavel}`;
    this.refs.detalhes.className = "detail-list";
    this.refs.detalhes.replaceChildren(
      this.criarDetalhe("Certificado", certificado.nome),
      this.criarDetalhe("Responsável", `${certificado.responsavel} (${certificado.email})`),
      this.criarDetalhe("Emissão", this.formatarData(certificado.dataEmissao)),
      this.criarDetalhe("Vencimento", this.formatarData(certificado.dataVencimento)),
      this.criarDetalhe("Dias restantes", this.formatarDias(certificado.diasParaVencimento)),
      this.criarDetalhe("Status", certificado.statusCalculado),
      this.criarDetalhe("Descrição", certificado.descricao || "Sem descrição", "p"),
    );
  }

  abrirPaginaDetalhes(idCertificado) {
    window.location.hash = `certificado/${encodeURIComponent(idCertificado)}`;
  }

  criarDetalhe(rotulo, valor, tag = "strong") {
    const item = document.createElement("div");
    const label = document.createElement("span");
    const content = document.createElement(tag);
    item.className = "detail-item";
    label.textContent = rotulo;
    content.textContent = valor;
    item.append(label, content);
    return item;
  }

  criarCelulaTabela(titulo, subtitulo = "") {
    const td = document.createElement("td");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = titulo;
    span.textContent = subtitulo;
    td.append(strong, span);
    return td;
  }

  criarCelulaComElemento(elemento) {
    const td = document.createElement("td");
    td.appendChild(elemento);
    return td;
  }

  criarCelulaComBotao(texto, aoClicar) {
    const td = document.createElement("td");
    const wrapper = document.createElement("div");
    const button = document.createElement("button");
    wrapper.className = "row-actions";
    button.type = "button";
    button.textContent = texto;
    button.addEventListener("click", aoClicar);
    wrapper.appendChild(button);
    td.appendChild(wrapper);
    return td;
  }

  renderizarAuditoria() {
    const logs = this.logAuditoriaRepository.buscarTodos().slice(0, 8);
    this.refs.auditoria.replaceChildren();

    if (!logs.length) {
      const item = document.createElement("li");
      item.textContent = "Nenhuma operação registrada.";
      this.refs.auditoria.appendChild(item);
      return;
    }

    logs.forEach((log) => {
      const item = document.createElement("li");
      const acao = document.createElement("strong");
      acao.textContent = `${log.acao}: `;
      item.append(acao, `${log.descricao} (${this.formatarDataHora(log.dataHora)})`);
      this.refs.auditoria.appendChild(item);
    });
  }

  obterClasseStatus(status) {
    return {
      Ativo: "status-ativo",
      "Proximo do vencimento": "status-proximo",
      Vencido: "status-vencido",
      Renovado: "status-renovado",
    }[status] || "status-ativo";
  }

  formatarData(dataIso) {
    return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${dataIso}T00:00:00`));
  }

  formatarDataInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  criarDataLocal(dataIso) {
    if (!dataIso) {
      return null;
    }

    const data = new Date(`${dataIso}T00:00:00`);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  formatarDataHora(dataIso) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dataIso));
  }

  formatarDias(dias) {
    if (dias < 0) {
      return `Vencido há ${Math.abs(dias)} dia(s)`;
    }

    if (dias === 0) {
      return "Vence hoje";
    }

    return `${dias} dia(s) restantes`;
  }

  semearDadosIniciais() {
    const hoje = new Date();
    const dataRelativa = (dias) => {
      const data = new Date(hoje);
      data.setDate(data.getDate() + dias);
      return data.toISOString().slice(0, 10);
    };

    const exemplos = [
      {
        nome: "Certificado ISO 9001",
        responsavel: "Marina Costa",
        email: "marina.costa@empresa.com",
        dataEmissao: dataRelativa(-320),
        dataVencimento: dataRelativa(120),
        status: "auto",
        descricao: "Certificação de qualidade da unidade principal.",
      },
      {
        nome: "Licença ambiental",
        responsavel: "Rafael Lima",
        email: "rafael.lima@empresa.com",
        dataEmissao: dataRelativa(-350),
        dataVencimento: dataRelativa(18),
        status: "auto",
        descricao: "Documento de operação ambiental.",
      },
      {
        nome: "Treinamento NR-10",
        responsavel: "Paula Martins",
        email: "paula.martins@empresa.com",
        dataEmissao: dataRelativa(-420),
        dataVencimento: dataRelativa(-8),
        status: "auto",
        descricao: "Certificado de treinamento obrigatório.",
      },
      {
        nome: "Alvará de funcionamento",
        responsavel: "Eduardo Rocha",
        email: "eduardo.rocha@empresa.com",
        dataEmissao: dataRelativa(-260),
        dataVencimento: dataRelativa(42),
        status: "auto",
        descricao: "Autorização municipal para funcionamento da unidade.",
      },
      {
        nome: "Certificado do Corpo de Bombeiros",
        responsavel: "Fernanda Alves",
        email: "fernanda.alves@empresa.com",
        dataEmissao: dataRelativa(-500),
        dataVencimento: dataRelativa(75),
        status: "auto",
        descricao: "Documento de conformidade contra incêndio.",
      },
      {
        nome: "Licença sanitária",
        responsavel: "Gustavo Nunes",
        email: "gustavo.nunes@empresa.com",
        dataEmissao: dataRelativa(-180),
        dataVencimento: dataRelativa(12),
        status: "auto",
        descricao: "Licença de vigilância sanitária da operação.",
      },
      {
        nome: "Certificado ISO 14001",
        responsavel: "Helena Moraes",
        email: "helena.moraes@empresa.com",
        dataEmissao: dataRelativa(-290),
        dataVencimento: dataRelativa(220),
        status: "auto",
        descricao: "Certificação de gestão ambiental.",
      },
      {
        nome: "Treinamento NR-35",
        responsavel: "Igor Barbosa",
        email: "igor.barbosa@empresa.com",
        dataEmissao: dataRelativa(-360),
        dataVencimento: dataRelativa(-25),
        status: "auto",
        descricao: "Treinamento para trabalho em altura.",
      },
      {
        nome: "Certificado de calibração",
        responsavel: "Juliana Castro",
        email: "juliana.castro@empresa.com",
        dataEmissao: dataRelativa(-90),
        dataVencimento: dataRelativa(28),
        status: "auto",
        descricao: "Calibração anual de equipamentos de medição.",
      },
      {
        nome: "Registro CREA",
        responsavel: "Leonardo Farias",
        email: "leonardo.farias@empresa.com",
        dataEmissao: dataRelativa(-210),
        dataVencimento: dataRelativa(150),
        status: "auto",
        descricao: "Registro técnico profissional vinculado ao projeto.",
      },
      {
        nome: "Certificado digital A1",
        responsavel: "Marcia Teixeira",
        email: "marcia.teixeira@empresa.com",
        dataEmissao: dataRelativa(-300),
        dataVencimento: dataRelativa(6),
        status: "auto",
        descricao: "Certificado digital para assinatura de documentos.",
      },
      {
        nome: "Licenca de software CAD",
        responsavel: "Nicolas Freitas",
        email: "nicolas.freitas@empresa.com",
        dataEmissao: dataRelativa(-40),
        dataVencimento: dataRelativa(310),
        status: "auto",
        descricao: "Licença anual da ferramenta de projetos.",
      },
      {
        nome: "Certificado LGPD",
        responsavel: "Olivia Ramos",
        email: "olivia.ramos@empresa.com",
        dataEmissao: dataRelativa(-120),
        dataVencimento: dataRelativa(185),
        status: "auto",
        descricao: "Treinamento e conformidade em proteção de dados.",
      },
      {
        nome: "Certificado ISO 45001",
        responsavel: "Ricardo Lopes",
        email: "ricardo.lopes@empresa.com",
        dataEmissao: dataRelativa(-250),
        dataVencimento: dataRelativa(365),
        status: "auto",
        descricao: "Certificação de saúde e segurança ocupacional.",
      },
      {
        nome: "Seguro responsabilidade civil",
        responsavel: "Sofia Cardoso",
        email: "sofia.cardoso@empresa.com",
        dataEmissao: dataRelativa(-330),
        dataVencimento: dataRelativa(-3),
        status: "auto",
        descricao: "Apolice vinculada a responsabilidade técnica.",
      },
    ];

    const versaoAtual = localStorage.getItem(STORAGE_KEYS.seedVersion);

    if (versaoAtual === SEED_VERSION) {
      return;
    }

    const nomesExistentes = new Set(
      this.certificadoService
        .listarCertificados()
        .map((certificado) => certificado.nome.toLowerCase()),
    );

    exemplos
      .filter((exemplo) => !nomesExistentes.has(exemplo.nome.toLowerCase()))
      .forEach((exemplo) => this.certificadoService.salvarCertificado(exemplo));

    localStorage.setItem(STORAGE_KEYS.seedVersion, SEED_VERSION);
  }
}

globalThis.Gestum = {
  Usuario,
  Certificado,
  LogAuditoria,
  UsuarioRepository,
  CertificadoRepository,
  LogAuditoriaRepository,
  CertificadoService,
  CertificadoController,
  createId,
};

if (typeof document !== "undefined") {
  const usuarioRepository = new UsuarioRepository();
  const certificadoRepository = new CertificadoRepository();
  const logAuditoriaRepository = new LogAuditoriaRepository();
  const certificadoService = new CertificadoService({
    certificadoRepository,
    usuarioRepository,
    logAuditoriaRepository,
  });
  const certificadoController = new CertificadoController({
    certificadoService,
    logAuditoriaRepository,
  });

  certificadoController.iniciar();
}
