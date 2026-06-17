const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

function createLocalStorageMock() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    clear() {
      store.clear();
    },
  };
}

function dataRelativa(dias) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

const context = {
  console,
  localStorage: createLocalStorageMock(),
  crypto: {
    randomUUID: () => `test-${Math.random().toString(16).slice(2)}`,
  },
  Date,
  Intl,
  Math,
  Error,
};

context.globalThis = context;
vm.createContext(context);

const appPath = path.join(__dirname, "app.js");
vm.runInContext(fs.readFileSync(appPath, "utf8"), context);

const {
  UsuarioRepository,
  CertificadoRepository,
  LogAuditoriaRepository,
  CertificadoService,
} = context.Gestum;

const usuarioRepository = new UsuarioRepository();
const certificadoRepository = new CertificadoRepository();
const logAuditoriaRepository = new LogAuditoriaRepository();
const certificadoService = new CertificadoService({
  usuarioRepository,
  certificadoRepository,
  logAuditoriaRepository,
});

const ativo = certificadoService.salvarCertificado({
  nome: "Certificado ativo",
  responsavel: "Ana Souza",
  email: "ana@empresa.com",
  dataEmissao: dataRelativa(-20),
  dataVencimento: dataRelativa(90),
  status: "auto",
  descricao: "Teste ativo",
});

certificadoService.salvarCertificado({
  nome: "Certificado proximo",
  responsavel: "Bruno Lima",
  email: "bruno@empresa.com",
  dataEmissao: dataRelativa(-20),
  dataVencimento: dataRelativa(10),
  status: "auto",
  descricao: "Teste proximo",
});

certificadoService.salvarCertificado({
  nome: "Certificado vencido",
  responsavel: "Carla Dias",
  email: "carla@empresa.com",
  dataEmissao: dataRelativa(-40),
  dataVencimento: dataRelativa(-2),
  status: "auto",
  descricao: "Teste vencido",
});

const resumo = certificadoService.obterResumo();
assert.equal(resumo.total, 3);
assert.equal(resumo.ativos, 1);
assert.equal(resumo.proximos, 1);
assert.equal(resumo.vencidos, 1);

const atualizado = certificadoService.salvarCertificado({
  idCertificado: ativo.idCertificado,
  nome: "Certificado ativo atualizado",
  responsavel: "Ana Souza",
  email: "ana@empresa.com",
  dataEmissao: dataRelativa(-20),
  dataVencimento: dataRelativa(90),
  status: "Renovado",
  descricao: "Teste atualizado",
});

assert.equal(atualizado.statusCalculado, "Renovado");
assert.equal(certificadoService.buscarCertificado(ativo.idCertificado).nome, "Certificado ativo atualizado");

assert.throws(() => {
  certificadoService.salvarCertificado({
    nome: "Certificado invalido",
    responsavel: "Diego Rocha",
    email: "diego@empresa.com",
    dataEmissao: dataRelativa(10),
    dataVencimento: dataRelativa(-10),
    status: "auto",
    descricao: "Datas invalidas",
  });
}, /data de vencimento/);

assert.equal(logAuditoriaRepository.buscarTodos().length, 4);

console.log("Testes do MVP executados com sucesso.");
