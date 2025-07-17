# Events API

![NestJS](https://img.shields.io/badge/NestJS-v10.0.0-red?style=for-the-badge&logo=nestjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1.3-blue?style=for-the-badge&logo=typescript)
![AWS](https://img.shields.io/badge/AWS-DynamoDB%20%7C%20S3%20%7C%20Lambda%20%7C%20SES-orange?style=for-the-badge&logo=amazon-aws)
![JWT](https://img.shields.io/badge/JWT-Auth-black?style=for-the-badge&logo=jsonwebtokens)
![Jest](https://img.shields.io/badge/Jest-Tests-C21325?style=for-the-badge&logo=jest)

API Node.js para um sistema de criação e inscrição de eventos. Esta API permite o gerenciamento de usuários, eventos e inscrições, com autenticação e funcionalidades específicas para diferentes tipos de usuários (participantes, organizadores, administradores).

## Funcionalidades Principais

* **Autenticação e Autorização:** Login com email/palavra-passe e proteção de rotas privadas com tokens JWT. Controle de acesso baseado em funções.
* **Gestão de Usuários:** Operações CRUD para usuários, upload de imagem de perfil para o S3 (com redimensionamento via Lambda), validação de email e soft delete.
* **Gestão de Eventos:** CRUD para eventos, incluindo upload de imagem, filtros e paginação.
* **Gestão de Inscrições:** Permite que usuários se inscrevam em eventos e gerenciem suas inscrições.
* **Notificações por Email (AWS SES):** Emails automáticos para validação de usuário, alterações de conta, criação/deleção de eventos e confirmações de inscrição (com anexo iCalendar).
* **Seed de Administrador:** Script para criar um usuário administrador padrão.
* **Documentação da API:** Documentação com Swagger (OpenAPI).

## Tecnologias Utilizadas

* [TypeScript](https://www.typescriptlang.org/)
* [NestJS](https://nestjs.com/)
* [AWS DynamoDB](https://aws.amazon.com/dynamodb/)
* [AWS S3](https://aws.amazon.com/s3/)
* [AWS Lambda](https://aws.amazon.com/lambda/)
* [AWS SES](https://aws.amazon.com/ses/)
* [Passport.js](http://www.passportjs.org/) para Autenticação JWT
* [Swagger (OpenAPI)](https://swagger.io/) para Documentação da API
* [Jest](https://jestjs.io/) para Testes Unitários

## Pré-requisitos

Antes de começar, certifique-se de que tem o seguinte instalado na sua máquina:

* [Node.js](https://nodejs.org/en) (versão LTS recomendada, ex: 18.x ou 20.x)
* `npm` ou `yarn`
* [AWS CLI](https://aws.amazon.com/cli/) instalado e configurado.
    * Execute `aws configure` e forneça o seu Access Key ID, Secret Access Key e Região Padrão. O usuário IAM associado a estas credenciais deve ter as permissões necessárias para DynamoDB, S3 e SES.

## Instalação e Configuração

1.  **Clone o Repositório:**
    ```bash
    git clone https://github.com/GmfSouza/Events-API.git
    cd Events-API
    ```

2.  **Instale as Dependências:**
    ```bash
    npm install
    ```
    ou
    ```bash
    yarn install
    ```

3.  **Configure as Variáveis de Ambiente:**
    * Copie o arquivo de exemplo `.env.example` para um novo arquivo chamado `.env`.
    * Abra o arquivo `.env` e preencha todas as variáveis necessárias com os seus valores.

    ```dotenv
    # .env.example
    
    # Aplicação
    PORT=3000
    API_URL=http://localhost:3000

    # Credenciais AWS (para desenvolvimento local)
    AWS_ACCESS_KEY_ID=SUA_AWS_ACCESS_KEY_ID_AQUI
    AWS_SECRET_ACCESS_KEY=SUA_AWS_SECRET_ACCESS_KEY_AQUI
    AWS_SESSION_TOKEN=SUA_AWS_SESSION_TOKEN_AQUI
    AWS_REGION=us-east-1 # ex: us-east-1, sa-east-1
    
    # Nomes das Tabelas DynamoDB
    DYNAMODB_TABLE_USERS=Users
    DYNAMODB_TABLE_EVENTS=Events
    DYNAMODB_TABLE_REGISTRATIONS=Registrations

    # Configuração S3
    S3_BUCKET_NAME=seu-bucket-de-originais # Bucket para imagens originais
    S3_PROFILE_IMAGE_PATH=user-profiles/
    S3_EVENT_IMAGE_PATH=events-images/
    
    # Variáveis de Ambiente da Lambda (para referência, configuradas na AWS)
    # DESTINATION_BUCKET_NAME=seu-bucket-de-redimensionadas
    # TARGET_WIDTH=200
    # TARGET_HEIGHT=200
    # RESIZED_IMAGE_PREFIX=resized/
    
    # Autenticação JWT
    JWT_SECRET=SUA_CHAVE_JWT_SECRETA
    JWT_EXPIRATION_TIME=3600s # ex: 1h, 7d, 3600 (segundos)
        
    # AWS SES (Serviço de Email)
    SES_REGION=us-east-1 # Região onde a sua identidade SES está verificada
    SES_FROM_EMAIL="Compass Events <noreply@seu-dominio-verificado.com>"

    # Usuário Administrador Padrão para Seeding
    DEFAULT_ADMIN_NAME=Admin
    DEFAULT_ADMIN_EMAIL=admin@gmail.com
    DEFAULT_ADMIN_PASSWORD=SuaSenhaAdminForte123!
    DEFAULT_ADMIN_PHONE=+5511999999999
    ```

4.  **Provisione as Tabelas da Base de Dados:**
    * Este script criará as tabelas DynamoDB necessárias na sua Região AWS configurada.
    ```bash
    npm run provision:db
    ```
    Ou
    ```bash
    yarn provision:db
    ```

5.  **Execute o Script de Seed (Opcional, mas recomendado):**
    * Este script criará um usuário administrador padrão se ele ainda não existir.
    ```bash
    npm run seed
    ```
    Ou
    ```bash
    yarn seed
    ```

6.  **Inicie a Aplicação:**
    ```bash
    npm run start:dev
    ```
    Ou
    ```bash
    yarn start:dev
    ```
    A aplicação será executada em `http://localhost:<PORT>`.

## Documentação da API

Quando a aplicação estiver em execução, você pode acessar a documentação da API (Swagger UI) em:

**`http://localhost:<PORT>/api`** ou (Porta `3000` por padrão)

A partir daí, você pode visualizar todos os endpoints, os seus DTOs, e testá-los diretamente. Para rotas protegidas, use o botão "Authorize" para inserir um token JWT obtido após o login.

# Arquitetura de Imagens com S3 e Lambda

Para o gerenciamento de imagens de perfil e de eventos, o projeto utiliza uma arquitetura serverless com os serviços **AWS S3** e **AWS Lambda**, garantindo que as imagens sejam armazenadas de forma segura e otimizada.

## 1. Estratégia de Armazenamento com S3

Nesse projeto, foi utilizada uma abordagem com **dois buckets S3** para separar claramente as imagens originais das processadas:

### Bucket de Originais (ex: `events-images-originais`)

- Este bucket recebe todas as imagens brutas carregadas pela API (seja no momento da criação de um usuário ou de um evento).
- Os arquivos são organizados usando **prefixos** (que funcionam como pastas):

  - `user-profiles/`: Para imagens de perfil dos usuários.
  - `events-images/`: Para imagens de capa dos eventos.

- Este bucket é configurado para ser **privado**. O acesso para escrita é concedido apenas à API NestJS através de permissões IAM.

### Bucket de Redimensionadas (ex: `events-images-redimensionadas`)

- Este bucket armazena as **versões otimizadas e redimensionadas** das imagens, que foram processadas pela função Lambda.
- A estrutura de prefixos do bucket de originais é **replicada** aqui para manter a organização.

---

## 2. Função Lambda para Redimensionamento de Imagens

Uma função Lambda é o cérebro por trás do processamento de imagens.

- **Função**: Redimensionar automaticamente qualquer nova imagem carregada para um tamanho padrão e otimizado.
- **Tecnologia**: Escrita em TypeScript e executada em um ambiente Node.js, utilizando a biblioteca`sharp` para o processamento de imagens.

### Lógica:

1. Recebe um evento de notificação do S3.
2. Identifica o bucket e o arquivo da imagem original que foi carregado.
3. Faz o download da imagem original para a memória da função Lambda.
4. Usa a biblioteca `sharp` para redimensionar a imagem para dimensões padrão (configuradas via variáveis de ambiente na Lambda, ex: `200x200` pixels).
5. Faz o upload da nova imagem redimensionada para o bucket de destino (bucket de redimensionadas).

---

## 3. Gatilhos (Triggers) S3

A automação do processo é garantida por **gatilhos S3** configurados no bucket de originais.

- **Como Funciona**: O bucket de originais está configurado para enviar uma notificação para a função Lambda sempre que um novo objeto é criado (`s3:ObjectCreated:*`).
- **Filtros de Prefixo**: Para garantir que a Lambda só seja acionada por imagens relevantes, os gatilhos são filtrados para observar apenas os prefixos:

  - `user-profiles/`
  - `events-images/`

> Isso evita que a Lambda seja acionada por outros arquivos que possam ser colocados no bucket e também previne loops recursivos, já que a Lambda escreve em um bucket diferente.

---

## Fluxo de Upload e Redimensionamento

O processo completo, do upload à exibição, funciona da seguinte forma:

1. Um usuário (ou organizador) envia um formulário através da API NestJS para criar/atualizar um perfil ou evento, anexando um arquivo de imagem.
2. A API NestJS (`S3Service`) faz o upload da imagem original para o bucket de originais no S3, dentro do prefixo apropriado (ex: `user-profiles/resized/imagem.jpg`).
3. O S3 detecta a criação deste novo objeto e, como corresponde a um dos prefixos configurados, aciona a função Lambda, enviando os detalhes do arquivo.
4. A função Lambda é executada, faz o download da imagem original, redimensiona-a e faz o upload da versão otimizada para o bucket de redimensionadas, mantendo a estrutura de pastas (ex: `user-profiles/resized/imagem.jpg`).
5. A API NestJS, no momento da criação/atualização, salva a **URL da imagem** (seja a original ou, idealmente, a URL esperada da imagem redimensionada) no registro correspondente no **DynamoDB**.

Para maiores detalhes sobre a configuração do S3 e Lambda, consulte a documentação oficial da AWS:
- [AWS S3](https://docs.aws.amazon.com/pt_br/lambda/latest/dg/with-s3-tutorial.html)

## Lógica de Envio de Emails com AWS SES

A API está configurada para enviar emails transacionais em momentos chave do fluxo da aplicação, utilizando o Amazon Simple Email Service (SES).

## Configuração

O serviço de email (`MailService`) é projetado para ser flexível e resiliente. A sua configuração é controlada por variáveis de ambiente no arquivo `.env`:

- `SES_REGION`: A região da AWS onde o seu serviço SES está configurado e as suas identidades de email estão verificadas.
- `SES_FROM_EMAIL`: O endereço de email remetente que aparecerá nos emails. Este endereço deve ser verificado na sua conta AWS SES.

### Credenciais (Opcional)

- `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`: Credenciais globais da AWS que serão usadas se as credenciais específicas do SES não forem fornecidas.

## Comportamento de Envio Opcional

O envio de emails é opcional e será ignorado silenciosamente (apenas um aviso será logado no console da API) se as configurações mínimas não forem fornecidas. O envio de emails é desabilitado se:

- `SES_REGION` ou `SES_FROM_EMAIL` não estiverem definidos no arquivo `.env`.
- Nenhuma credencial AWS for encontrada no `.env` **e** a aplicação não estiver sendo executada em um ambiente AWS com uma IAM Role que conceda permissões ao SES.

Isso permite que o projeto seja executado em ambientes de desenvolvimento sem a necessidade de configurar o envio de emails.

## Modo Sandbox do AWS SES

Por padrão, novas contas AWS SES estão em modo "sandbox". Isto significa que:

- Você só pode enviar emails **DE** endereços e domínios verificados.
- Você só pode enviar emails **PARA** endereços e domínios que também foram verificados na sua conta SES.

Para testar o fluxo de emails, certifique-se de que os emails dos destinatários de teste também estão verificados no seu console do SES.

## Emails Automáticos

A API envia os seguintes emails automáticos:

- **Validar a conta de um usuário**: Enviado após um novo usuário se registrar. Contém um link único para verificar o endereço de email.
- **Conta Deletada (Soft Delete)**: Enviado ao usuário quando a sua conta é desativada.
- **Evento Criado**: Enviado ao organizador para confirmar que o seu evento foi criado com sucesso.
- **Evento Deletado (Soft Delete)**: Enviado ao organizador quando o seu evento é desativado.
- **Inscrição Criada**: Enviado ao participante para confirmar a sua inscrição num evento. Este email inclui um anexo iCalendar (`.ics`) para que o participante possa adicionar facilmente o evento ao seu calendário.
- **Inscrição Cancelada**: Enviado ao participante para confirmar que a sua inscrição foi cancelada.

---

# Funções e Permissões (Lógica de Negócio)

A API implementa um sistema de **Controle de Acesso Baseado em Funções** (RBAC - *Role-Based Access Control*) para garantir que os usuários só possam realizar as ações permitidas para sua função.  
As principais funções são: **Participant**, **Organizer** e **Admin**.

---

## Gestão de Usuários (`/users`)

As permissões para gerenciar usuários são estritas para proteger os dados sensíveis.

### `GET /users/:id` - Obter Usuário por ID
  
Um **Admin** pode obter o perfil de qualquer usuário.  
Um usuário normal (**PARTICIPANT** ou **ORGANIZER**) só pode obter o **próprio** perfil.
A resposta inclui dados do usuário, sem senha.
- **Exemplo de Sucesso (Dono)**  
  Participant com ID `user-123` faz uma requisição `GET /users/user-123`.  
  **Resposta**: `200 OK` com os dados do usuário.

  #### Exemplo de Resposta
  ```json
  {
    "id": "user-123",
    "name": "Participant user",
    "email": "participant@example.com",
    "phone": "+55998887766",
    "role": "PARTICIPANT",
    "profileImageUrl": "https://example.com/profile.jpg",
    "createdAt": "2025-06-04T17:46:34.746Z",
    "updatedAt": "2025-06-04T17:46:34.746Z",
    "isActive": true,
  }
  ```

- **Exemplo de Sucesso (Admin)**  
  Admin faz uma requisição `GET /users/user-123`.  
  **Resposta**: `200 OK` com os dados do usuário.
    #### Exemplo de Resposta
    ```json
    {
        "id": "user-123",
        "name": "Participant User",
        "email": "participant@example.com",
        "phone": "+55998887766",
        "role": "PARTICIPANT",
        "profileImageUrl": "https://example.com/profile.jpg",
        "createdAt": "2025-06-04T17:46:34.746Z",
        "updatedAt": "2025-06-04T17:46:34.746Z",
        "isActive": true,
      }
    ```

- **Exemplo de Falha (Não é Dono/Admin)**  
  Participant com ID `user-456` faz uma requisição `GET /users/user-123`.  
  **Resposta**: `403 Forbidden`  
  ```json
  {
    "message": "You do not have permission to access this resource",
    "error": "Forbidden",
    "statusCode": 403
  }
  ```

---

### `PATCH /users/:id` - Atualizar Usuário

**Regra**:  
Um usuário só pode atualizar os **próprios** dados.

- **Exemplo de Sucesso (Dono)**  
  Usuário `user-123` envia uma requisição `PATCH /users/user-123`.  
  **Resposta**: `200 OK` com os dados atualizados.
    #### Exemplo de Resposta
    ```json
    {
        "id": "user-123",
        "name": "Updated User",
        "email": "updated.user@example.com",
        "phone": "+55998887766",
        "role": "PARTICIPANT",
        "profileImageUrl": "https://example.com/profile-updated.jpg",
        "createdAt": "2025-06-04T17:46:34.746Z",
        "updatedAt": "2025-06-04T17:46:34.746Z",
        "isActive": true
      }
    ```

- **Exemplo de Falha (Não é Dono)**  
  Usuário `user-456` envia uma requisição `PATCH /users/user-123`.  
  **Resposta**: `403 Forbidden`  
  ```json
    {
        "message": "You do not have permission to access this resource",
        "error": "Forbidden",
        "statusCode": 403
    }
  ```

---

### `GET /users` - Listar Todos os Usuários

**Regra**:  
Apenas usuários com a função **Admin** podem listar todos os usuários.

- **Exemplo de Sucesso (Admin)**  
  Admin faz uma requisição `GET /users`.  
  **Resposta**: `200 OK` com a lista de usuários.

- **Exemplo de Falha (Não é Admin)**  
  Organizer ou Participant faz uma requisição `GET /users`.  
  **Resposta**: `403 Forbidden`  
  ```json
  {
    "message": "You do not have permission to access this resource",
    "error": "Forbidden",
    "statusCode": 403
  }
  ```

---

## Gestão de Eventos (`/events`)

A criação e gestão de eventos são restritas a **Organizadores** e **Administradores**.

### `POST /events` - Criar Evento

**Regra**:  
Apenas usuários com a função **Organizer** ou **Admin** podem criar eventos.

- **Exemplo de Sucesso (Organizer)**  
  Organizer envia uma requisição `POST /events`.  
  **Resposta**: `201 Created` com os dados do novo evento.
  Para criar um evento, o usuário deve preencher os seguintes campos de um form-data:
  - `name`: Título do evento.
  - `description`: Descrição do evento.
  - `date`: Data e hora do evento (formato: `YYYY-MM-DDTHH:mm:ssZ`).
  - `eventImage`: Arquivo de imagem do evento.

- **Exemplo de Falha (Participant)**  
  Participant envia uma requisição `POST /events`.  
  **Resposta**: `403 Forbidden`  
  ```json
  {
    "message": "You do not have permission to access this resource",
    "error": "Forbidden",
    "statusCode": 403
  }
  ```

---

### `PATCH /events/:id` - Atualizar Evento

**Regra**:  
Um **Admin** pode atualizar qualquer evento, incluindo alterar o organizador.  
Um **Organizer** só pode atualizar os eventos que ele próprio criou, mas não pode alterar o organizador.

- **Exemplo de Sucesso (Dono)**  
  Organizer `org-123` (criador do evento com ID `evt-abc`) envia `PATCH /events/evt-abc`, num JSON ou form-data com os campos a serem atualizados.  
  **Resposta**: `200 OK` com os dados atualizados.

- **Exemplo de Sucesso (Admin)**  
  Admin envia `PATCH /events/evt-abc`, num JSON ou form-data com os campos a serem atualizados.  
  **Resposta**: `200 OK` com os dados atualizados.

- **Exemplo de Sucesso (Admin)**
  Admin envia uma requisição PATCH /events/evt-abc para alterar o organizerId passado num JSON ou form-data para um novo organizador.
  **Resposta**: `200 OK` com os dados atualizados

- **Exemplo de Falha (Organizador )**
  Organizador org-123 envia uma requisição PATCH /events/evt-abc tentando alterar o organizerId.
  **Resposta**: `403 Forbidden`
  ```json
  {
     "message": "Only admins can change the organizer.",
     "error": "Forbidden",
     "statusCode": 403
  }
  ```
  ---

- **Exemplo de Falha (Não é Dono)**  
  Organizer `org-456` tenta atualizar evento criado por `org-123`.  
  **Resposta**: `403 Forbidden`  
  ```json
  {
    "message": "You do not have permission to access this resource",
    "error": "Forbidden",
    "statusCode": 403
  }
  ```

---

### `DELETE /events/:id` - Desativar Evento (Soft Delete)

**Regra**:  
Apenas um **Admin** ou o **Organizer que criou o evento** pode desativá-lo.

- **Exemplo de Sucesso (Dono)**  
  Organizer `org-123` envia `DELETE /events/evt-abc`.  
  **Resposta**: `204 No Content`.

- **Exemplo de Falha (Não é Dono)**  
  Organizer `org-456` envia `DELETE /events/evt-abc`.  
  **Resposta**: `403 Forbidden`.
  ```json
  {
    "message": "You do not have permission to access this resource",
    "error": "Forbidden",
    "statusCode": 403
  }
  ```

---

## Gestão de Inscrições (`/registrations`)

As operações de inscrição são focadas no usuário autenticado.

### `POST /registrations` - Criar Inscrição

**Regra**:  
Qualquer usuário autenticado independente de sua função pode se inscrever num evento **ativo** e **ainda não ocorrido**.

- **Exemplo de Sucesso**  
  Usuário envia `POST /registrations` com `eventId` válido passado no corpo da requisição.  
  **Resposta**: `201 Created` com os detalhes da inscrição.

- **Exemplo de Falha**  
  Tentativa de inscrição num evento com status `inactive`.  
  **Resposta**: `400 Bad Request`  
  ```json
  {
    "message": "'You cannot register for an event that is not active'",
    "error": "Bad Request",
    "statusCode": 400
  }
  ```

---

### `GET /registrations` - Lista as Inscrições do Usuário autenticado

**Regra**:  
O usuário só pode listar **suas próprias** inscrições.

- **Exemplo de Sucesso**  
  Usuário `user-123` faz `GET /registrations`.  
  **Resposta**: `200 OK` com a lista de inscrições do `user-123`.
  ```json
  {
    "registrationsWithEventDetails": [
        {
            "id": "registration-123",
            "userId": "user-123",
            "eventId": "event-abc",
            "registrationDate": "2025-07-16T22:06:31.984Z",
            "status": "ACTIVE",
            "updatedAt": "2025-07-16T22:06:31.984Z",
            "event": {
                "id": "event-abc",
                "name": "Technology Conference",
                "description": "A conference about technology.",
                "date": "2026-07-10T19:00:00Z",
                "imageUrl": "https://example.com/event-image.jpg",
                "status": "ACTIVE",
                "createdAt": "2025-07-16T20:14:36.843Z",
                "updatedAt": "2025-07-16T20:14:36.843Z"
            },
            "organizer": {
                "id": "admin-123",
                "name": "Admin"
            }
        },
        {
            "id": "registration-456",
            "userId": "user-123",
            "eventId": "event-456",
            "registrationDate": "2025-07-17T00:14:54.298Z",
            "status": "ACTIVE",
            "updatedAt": "2025-07-17T00:14:54.298Z",
            "event": {
                "id": "event-456",
                "name": "Music Festival",
                "description": "A festival celebrating music.",
                "date": "2026-06-04T15:10:00Z",
                "imageUrl": "https://example.com/event-image-2.jpg",
                "status": "ACTIVE",
                "createdAt": "2025-07-16T20:09:37.455Z",
                "updatedAt": "2025-07-16T20:09:37.455Z"
            },
            "organizer": {
                "id": "organizer-456",
                "name": "Organizer"
            }
        }
    ],
    "total": 2
  }
    ```

---

### `DELETE /registrations/:eventId` - Cancelar Inscrição

**Regra**:  
O usuário só pode cancelar **sua própria inscrição**.  
A lógica da API usa o `userId` extraído do token JWT para identificar a inscrição.

- **Exemplo de Sucesso (Dono)**  
  Usuário `user-123`, inscrito no evento `evt-abc`, envia `DELETE /registrations/evt-abc`.  
  **Resposta**: `204 No Content`.

- **Exemplo de Falha (Implícita)**  
  Usuário `user-456` tenta cancelar a inscrição de `user-123`.  
  **Resposta**: `404 Not Found`  
  *(A API buscará uma inscrição com o par `userId: user-456`, `eventId: evt-abc`, que não existe.)*
    ```json
    {
        "message": "Registration not found",
        "error": "Not Found",
        "statusCode": 404
    }
    ```

---

## Endpoints da API

| Método | Endpoint                            | Descrição                                          | Acesso                   |
| :----- | :---------------------------------- | :------------------------------------------------- | :----------------------- |
| `POST` | `/auth/login`                       | Autentica um usuário e retorna um JWT.             | Público                  |
| `GET`  | `/auth/validate-email`              | Valida o email de um usuário via token.           | Público                  |
| `POST` | `/users`                            | Cria um novo usuário.                              | Público                  |
| `GET`  | `/users`                            | Lista todos os usuários com filtros.               | Privado (Admin)          |
| `GET`  | `/users/:id`                        | Obtém um usuário específico por ID.                | Privado (Admin, Dono)    |
| `PATCH`| `/users/:id`                        | Atualiza os dados do próprio usuário.              | Privado (Dono)           |
| `DELETE`| `/users/:id`                       | Desativa (soft delete) um usuário.                 | Privado (Admin, Dono)    |
| `POST` | `/events`                           | Cria um novo evento.                               | Privado (Admin, Org)     |
| `GET`  | `/events`                           | Lista todos os eventos com filtros.                | Privado (JWT)            |
| `GET`  | `/events/:id`                       | Obtém um evento específico por ID.                 | Privado (JWT)            |
| `PATCH`| `/events/:id`                       | Atualiza um evento.                                | Privado (Admin, Dono)    |
| `DELETE`| `/events/:id`                      | Desativa (soft delete) um evento.                  | Privado (Admin, Dono)    |
| `POST` | `/registrations`                    | Inscreve o usuário autenticado num evento.         | Privado (JWT)            |
| `GET`  | `/registrations`                    | Lista todas as inscrições do usuário autenticado   | Privado (JWT)            |
| `DELETE`| `/registrations/:eventId`          | Cancela uma inscrição do usuário autenticado.      | Privado (JWT)            |

# Exemplos de Requisições da API (JSON)
---

### 1. Criar um Usuário (`POST /users`)

Este endpoint utiliza `multipart/form-data` porque pode incluir um arquivo de imagem. Não é um único payload JSON. Os dados são enviados como campos de formulário separados.

* **Content-Type:** `multipart/form-data`
* **Campos do Formulário (no Postman, na aba "Body" -> "form-data"):**
    * `name` (texto): `João da Silva`
    * `email` (texto): `joao.silva@example.com`
    * `password` (texto): `SenhaForte123!`
    * `phone` (texto): `+5511999998888`
    * `role` (texto): `PARTICIPANT` (ou `ORGANIZER`, `ADMIN`)
    * `profileImage` (arquivo): `(Selecione um arquivo de imagem aqui (JPG, JPEG, PNG, WEBP))` # opcional

---

### 2. Login de Usuário (`POST /auth/login`)

Este endpoint espera um corpo de requisição no formato `application/json`.

* **Content-Type:** `application/json`
* **Corpo da Requisição (JSON):**

    ```json
    {
      "email": "joao.silva@example.com",
      "password": "SenhaForte123!"
    }
    ```

* **Resposta de Sucesso (Exemplo):**

    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ..."
    }
    ```

---

### 3. Acessar uma Rota Protegida (ex: `GET /events`)

Para acessar a qualquer endpoint privado, você precisa de incluir o `access_token` obtido no login no cabeçalho `Authorization`.

* **Cabeçalho da Requisição:**

    ```json
    {
      "Authorization": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ..."
    }
    ```

---

### 4. Criar um Evento (Somente Admin ou Organizador) (`POST /events`)

Similar à criação de usuário, este endpoint usa `multipart/form-data` para permitir o upload de uma imagem do evento.

* **Content-Type:** `multipart/form-data`
* **Cabeçalho:** `Authorization: Bearer SEU_TOKEN_JWT_AQUI`
* **Campos do Formulário:**
    * `name` (texto): `Conferência Anual de Tecnologia`
    * `description` (texto): `Uma conferência sobre as últimas novidades em desenvolvimento de software e IA.`
    * `date` (texto): `2025-12-01T14:00:00Z`
    * `eventImage` (arquivo): `(anexar o arquivo de imagem aqui)`

---

### 5. Atualizar um Usuário (Somente o próprio Usuário autenticado pode atualizar seus dados) (`PATCH /users/:id`)

Este endpoint espera um corpo `application/json` com os campos que deseja atualizar.

* **Content-Type:** `application/json`
* **Cabeçalho:** `Authorization: Bearer SEU_TOKEN_JWT_AQUI`
* **Corpo da Requisição (JSON - Exemplo):**

    ```json
    {
      "name": "João da Silva Santos",
      "phone": "+5511988887777"
    }
    ```

---

### 6. Inscrever-se num Evento (Qualquer Usuário Autenticado) (`POST /registrations`)

Este endpoint espera um corpo `application/json` contendo apenas o ID do evento.

* **Content-Type:** `application/json`
* **Cabeçalho:** `Authorization: Bearer SEU_TOKEN_JWT_AQUI`
* **Corpo da Requisição (JSON):**

    ```json
    {
      "eventId": "a1b2c3d4-e5f6-7890-1234-567890abcdef"
    }
    ```
---

# Exemplos de Requisições Paginadas e com Filtros

Exemplos de requisições GET para os endpoints de listagem (`/users` e `/events`) que suportam filtros e paginação. Os exemplos são mostrados como se fossem URLs de requisição, seguidos pela resposta JSON esperada.

---

### 1. Paginação Simples

A paginação é controlada pelos parâmetros de query `limit` e `lastEvaluatedKey`.

#### Exemplo 1: Obter a primeira página de eventos

Esta requisição busca os 2 primeiros eventos ativos.

* **Requisição:**
  `GET /events?status=ACTIVE&limit=2`

* **Resposta JSON de Exemplo (quando há mais páginas):**

  ```json
  {
    "events": [
      {
        "id": "evt-uuid-001",
        "name": "Conferência de Tecnologia 2025",
        "description": "Uma conferência sobre as últimas novidades em tecnologia.",
        "date": "2025-10-20T19:00:00Z",
        "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/evt-uuid-001.jpg",
        "status": "active",
        "createdAt": "2025-09-01T12:00:00Z",
        "updatedAt": "2025-09-01T12:00:00Z",
      },
      {
        "id": "evt-uuid-002",
        "name": "Workshop de Design",
        "description": "Um workshop sobre design de interfaces.",
        "date": "2025-11-05T14:00:00Z",
        "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/evt-uuid-002.jpg",
        "status": "active",
        "createdAt": "2025-10-01T12:00:00Z",
        "updatedAt": "2025-10-01T12:00:00Z"
      }
    ],
    "count": 2,
    "lastEvaluatedKey": {
      "id": "evt-uuid-002",
    }
  }
    ```
---

#### Exemplo 2: Obter a segunda página de eventos

Para obter a próxima página, use o `lastEvaluatedKey` da resposta anterior.

```json
{
  "id": "evt-uuid-002",
}
```

**Requisição:**
`GET /events?status=active&limit=2&lastEvaluatedKey={"id":"evt-uuid-002"}`

(Nota: O objeto JSON no lastEvaluatedKey deve ser codificado para URL, mas ferramentas como o Postman fazem isso automaticamente).

**Resposta JSON de Exemplo (última página):**

```json
{
  "events": [
    {
      "id": "evt-uuid-003",
      "name": "Meetup de Desenvolvedores",
      "description": "Encontro mensal para desenvolvedores.",
      "date": "2025-11-15T18:30:00Z",
      "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/evt-uuid-003.jpg",
      "status": "active",
      "createdAt": "2025-10-15T12:00:00Z",
      "updatedAt": "2025-10-15T12:00:00Z"
    },
    {
        "id": "evt-uuid-004",
        "name": "Palestra sobre IA",
        "description": "Uma palestra sobre as últimas tendências em inteligência artificial.",
        "date": "2025-11-20T10:00:00Z",
        "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/evt-uuid-004.jpg",
        "status": "active",
        "createdAt": "2025-10-20T12:00:00Z",
        "updatedAt": "2025-10-20T12:00:00Z"
    }
  ],
  "count": 2,
  "lastEvaluatedKey": null
}
```
---

#### Exemplo 3: Listar inscrições do usuário autenticado
Esta requisição busca todas as inscrições do usuário autenticado, com paginação e detalhes do evento e seu organizador.
**Requisição:**
`GET /registrations?limit=5`

**Resposta JSON de Exemplo:**
```json
{
  "registrationsWithEventDetails": [
    {
      "id": "ebfb2597-ebac-4b4c-88da-d336a5f06f2b",
      "userId": "82177f52-9c9d-4737-ab59-af2096d9cf2a",
      "eventId": "9b06cf85-a283-4170-a5cd-dad7e6fbd1a7",
      "registrationDate": "2025-07-16T22:06:31.984Z",
      "status": "ACTIVE",
      "updatedAt": "2025-07-16T22:06:31.984Z",
      "event": {
        "id": "9b06cf85-a283-4170-a5cd-dad7e6fbd1a7",
        "name": "Technology Conference",
        "description": "A conference about technology.",
        "date": "2026-07-10T19:00:00Z",
        "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/9b06cf85-a283-4170-a5cd-dad7e6fbd1a7.jpg",
        "status": "ACTIVE",
        "createdAt": "2025-07-16T20:14:36.843Z",
        "updatedAt": "2025-07-16T20:14:36.843Z"
      },
      "organizer": {
        "id": "82177f52-9c9d-4737-ab59-af2096d9cf2a",
        "name": "Carlos"
      }
    },
    {
      "id": "c3d2f1e0-4b5a-4c8b-9f3e-6d7e8f9a0b1c",
      "userId": "82177f52-9c9d-4737-ab59-af2096d9cf2a",
      "eventId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "registrationDate": "2025-07-17T10:00:00.000Z",
      "status": "ACTIVE",
      "updatedAt": "2025-07-17T10:00:00.000Z",
      "event": {
        "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
        "name": "Workshop on AI",
        "description": "A workshop on artificial intelligence.",
        "date": "2026-08-15T14:00:00Z",
        "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/a1b2c3d4-e5f6-7890-1234-567890abcdef.jpg",
        "status": "ACTIVE",
        "createdAt": "2025-07-17T09:00:00.000Z",
        "updatedAt": "2025-07-17T09:00:00.000Z"
      },
      "organizer": {
        "id": "9c9d4737-ab59-af2096d9cf2a-82177f52",
        "name": "Lucas"
      }
    }
  ],
  "total": 1
}
```
---

## 2. Requisições com Filtros
Os filtros são adicionados como parâmetros de query. Eles podem ser combinados com a paginação.
```
# No exemplo abaixo, temos uma requisição GET /users, então podemos adicionar filtros como `name`, `role` e `email`.
# O parâmetro `role` pode ser usado para filtrar usuários por função (ADMIN, ORGANIZER, PARTICIPANT).
# Aqui, por ser uma requisição GET /users, apenas um usuario com a função de administrador pode listar todos os utilizadores.
# Um usuário autenticado com função diferente só pode fazer requisições para obter os seus próprios dados numa requisição GET /users/{id}.
```
---

#### Exemplo 1: Listar usuários com filtro por nome
Esta requisição busca usuários cujo nome contém "ana". O parâmetro `name` é opcional e pode ser usado para filtrar usuários por parte do nome.
**Requisição:**
`GET /users?name=ana`

**Resposta JSON de Exemplo:**

```json
{
  "users": [
    {
      "id": "user-uuid-123",
      "name": "Ana paula",
      "email": "ana.org@email.com",
      "phone": "+5511999999999",
      "role": "ORGANIZER",
      "isActive": true
    },
    {
      "id": "user-uuid-456",
      "name": "Mariana Costa",
      "email": "mari.coord@email.com",
      "phone": "+5511988888888",
      "role": "ORGANIZER",
      "isActive": true,
      "isEmailValidated": false,
      "emailValidationToken": "b495cdd6-332e-455a-b80e-fb140e0f6e38",
      "emailValidationTokenExpires": "2025-06-15T18:58:22.106Z"
    }
  ],
  "count": 2,
  "lastEvaluatedKey": null
}
```
---

#### Exemplo 2: Listar eventos ativos em Novembro de 2025 com "Workshop" no nome
Esta requisição combina múltiplos filtros: status, dateAfter, dateBefore, e name. Todos os parametros são opcionais.

**Requisição:**
`GET /events?status=ACTIVE&name=Workshop&dateAfter=2025-11-01&dateBefore=2025-11-30`

**Resposta JSON de Exemplo:**
```json

{
  "events": [
    {
      "id": "evt-uuid-002",
      "name": "Workshop de Design",
      "description": "Um workshop sobre design de interfaces.",
      "date": "2025-11-05T14:00:00Z",
      "imageUrl": "https://s3.amazonaws.com/your-bucket/event-images/evt-uuid-002.jpg",
      "status": "active",
      "createdAt": "2025-10-01T12:00:00Z",
      "updatedAt": "2025-10-01T12:00:00Z"
    }
  ],
  "count": 1,
  "lastEvaluatedKey": null
}
```
---

```
Para mais detalhes sobre os endpoints, consulte a documentação da API (Swagger UI) em `https://localhost:3000/api`.
```
---
## Scripts Úteis

* `npm run start:dev`: Inicia a aplicação em modo de desenvolvimento.
* `npm run build`: Compila o código TypeScript para JavaScript.
* `npm run test`: Executa os testes unitários.
* `npm run test:cov`: Executa os testes e gera um relatório de cobertura.
* `npm run provision:db`: Executa o script para criar as tabelas no DynamoDB.
* `npm run seed`: Executa o script para criar o usuário administrador padrão.
