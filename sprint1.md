# Documentação do Projeto - Engenharia de Software II
## Sprint 1: Análise dos Requisitos e Identificação das Classes

---

## 1. Visão Geral da Funcionalidade Principal
A funcionalidade de core escolhida para esta etapa do projeto consiste no envio de **Alertas automáticos de vencimento de certificados**. O objetivo principal é garantir que o sistema monitore de forma autônoma a validade dos certificados cadastrados, notificando os responsáveis antes da expiração.

---

## 2. Análise de Requisitos (Descrição do Fluxo Completo)

### 2.1. Regras de Negócio e Funcionamento Geral
* **Automatização:** O sistema verifica diariamente os certificados cadastrados de forma automática através de uma rotina agendada (*scheduler*), sem necessidade de acionamento manual por parte do usuário.
* **Gatilhos de Alerta:** Uma notificação deve ser gerada se o tempo restante para a expiração do certificado for menor ou igual aos prazos definidos de **60, 30 ou 7 dias**.
* **Canais de Notificação:** Os alertas gerados precisam ser disponibilizados em duas frentes: visualmente no sistema (**dashboard**) e enviados por **e-mail** ao responsável.
* **Persistência do Alerta:** A notificação permanece ativa no painel até que o usuário interaja ou a visualize.
* **Tratamento de Falhas:** Caso ocorra um erro no envio do e-mail, o sistema registra o problema e realiza novas tentativas de envio posteriormente.

### 2.2. Fluxo de Dados e Componentes Acionados
1. **Início:** O *scheduler* inicia a rotina diária.
2. **Consulta:** O sistema acessa o banco de dados via `Repository de certificados` para buscar as datas de vencimento.
3. **Processamento:** A camada de *service* avalia o tempo restante de cada certificado.
4. **Verificação de Duplicidade:** Caso esteja no prazo de vencimento, o *service* checa se já existe um alerta emitido para aquele período.
5. **Registro e Disseminação:** Se for um alerta inédito, ele é salvo via `Repository de alertas` e encaminhado simultaneamente para o serviço de e-mail e para o dashboard.

---

## 3. Mapeamento Técnico e Identificação das Classes

Abaixo estão descritas as principais entidades de domínio identificadas no modelo de análise para suportar o fluxo de requisitos:

### `Certificado`
* **Responsabilidade:** Armazenar os dados brutos do certificado (nome, datas e status).
* **Papel no fluxo:** Atua como a fonte primária de dados para a verificação de prazos.

### `GestaoCertificado`
* **Responsabilidade:** Concentrar a lógica de negócio do domínio.
* **Papel no fluxo:** Realiza os cálculos de data e dita as regras de quando uma notificação deve ser disparada (60, 30 ou 7 dias antes).

### `Notificação`
* **Responsabilidade:** Representar a entidade de alerta, armazenando dados como mensagem, data, tipo, nível de criticidade e status de leitura (visualizado ou não).
* **Papel no fluxo:** Garante o desacoplamento e a organização do sistema de avisos visuais.

### `Usuário`
* **Responsabilidade:** Representar o ator que recebe e interage com os alertas no dashboard ou via e-mail.

### `Log Auditoria`
* **Responsabilidade:** Registrar sistematicamente os eventos disparados pela rotina automática.
* **Papel no fluxo:** Assegurar a rastreabilidade e o histórico das ações tomadas pelo sistema.
