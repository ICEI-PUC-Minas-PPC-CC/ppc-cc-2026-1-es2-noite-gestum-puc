# Sprint 5: Implementação do MVP

## 1. Resumo

Nesta sprint foi implementada uma versão funcional do MVP planejado na Sprint 4. O MVP escolhido foi o **gerenciamento básico de certificados**, com foco em permitir o cadastro, consulta, edição, acompanhamento de status e visualização resumida dos certificados registrados.

A implementação foi feita como uma aplicação web estática em HTML, CSS e JavaScript, utilizando `localStorage` para simular a camada de persistência. Essa escolha permite demonstrar o fluxo completo do MVP sem depender de backend.

---

## 2. Funcionalidades Implementadas

O MVP implementado contempla:

* cadastro de certificados;
* associação do certificado a um responsável;
* listagem dos certificados cadastrados;
* consulta de detalhes de um certificado;
* edição de dados básicos;
* cálculo de dias restantes até o vencimento;
* classificação de status como ativo, atenção, vencido ou renovado;
* filtro por status;
* busca por nome, responsável, e-mail ou status;
* dashboard com totais de certificados;
* gráfico de certificados por vencimento com filtro de data inicial e final;
* tabela de vencimentos mais próximos no dashboard;
* log básico de auditoria para cadastros e atualizações.

---

## 3. Fluxo de Funcionamento

O fluxo principal do MVP acontece da seguinte forma:

1. O usuário preenche o formulário de cadastro de certificado.
2. A interface envia os dados para o `CertificadoController`.
3. O controller aciona o `CertificadoService`.
4. O service valida os campos obrigatórios e as datas informadas.
5. O service cria ou atualiza o responsável usando o `UsuarioRepository`.
6. O certificado é salvo pelo `CertificadoRepository`.
7. A operação é registrada pelo `LogAuditoriaRepository`.
8. A interface atualiza a listagem, o dashboard e os detalhes do certificado.

Esse fluxo representa entrada, processamento e saída dentro do escopo do MVP.

---

## 4. Relação com a Arquitetura

A implementação respeita a arquitetura planejada em camadas:

| Camada | Implementação no MVP |
|---|---|
| Apresentação | `index.html` e `styles.css` |
| Controller | Classe `CertificadoController` |
| Service | Classe `CertificadoService` |
| Repository | Classes `CertificadoRepository`, `UsuarioRepository` e `LogAuditoriaRepository` |
| Persistência | `localStorage` do navegador |
| Domínio | Classes `Certificado`, `Usuario` e `LogAuditoria` |

Como o MVP não exige backend completo, as camadas foram implementadas no JavaScript do navegador. Mesmo assim, a separação de responsabilidades foi mantida para demonstrar coerência com a modelagem e a arquitetura das sprints anteriores.

---

## 5. Relação com a Modelagem de Classes

As classes modeladas nas sprints anteriores foram aproveitadas da seguinte forma:

* `Certificado`: armazena os dados principais e calcula dias até o vencimento.
* `Usuario`: representa o responsável pelo certificado.
* `LogAuditoria`: registra operações relevantes.
* `GestaoCertificado`: sua responsabilidade foi representada no `CertificadoService`, que concentra as regras de negócio do MVP.

As classes `Notificacao`, `ServicoEmail` e `Scheduler` permanecem previstas para evolução futura, pois o escopo do MVP foi definido como gerenciamento básico de certificados, sem alertas automáticos.

---

## 6. Arquivos Implementados

| Arquivo | Descrição |
|---|---|
| `src/index.html` | Estrutura da aplicação e telas do MVP. |
| `src/styles.css` | Estilos visuais, layout responsivo e estados de status. |
| `src/app.js` | Classes de domínio, repositories, service, controller e interações da aplicação. |

---

## 7. Como Executar

Como o projeto é estático, basta abrir o arquivo:

`src/index.html`

Também é possível servir a pasta `src` por um servidor local simples.

---

## 8. Testes Básicos Realizados

Foram considerados os seguintes testes básicos:

* abrir a aplicação e verificar se os certificados iniciais aparecem;
* cadastrar um novo certificado com dados válidos;
* tentar cadastrar certificado com data de vencimento anterior à emissão;
* editar um certificado existente;
* filtrar certificados por status;
* buscar certificados por texto;
* consultar detalhes de um certificado;
* verificar atualização dos totais no dashboard;
* alterar o filtro de datas do dashboard e verificar atualização do gráfico;
* verificar registro de operações no log de auditoria.

---

## 9. Conclusão

A Sprint 5 entrega uma evolução real em relação às sprints anteriores, transformando o planejamento técnico do MVP em uma aplicação funcional.

O sistema ainda não implementa alertas automáticos, envio de e-mail ou scheduler, pois esses itens ficaram fora do escopo do MVP. A base implementada permite evoluir o projeto para essas funcionalidades posteriormente.
