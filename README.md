# Compass Events

*Read in [Portuguese](#Compass Events - pt)*


# About
Node.js API for a space reservation system. This API allows the management of users, events, and registrations, with authentication and specific functionalities for different types of users (participants, organizers, administrators).

## Main Features
* **Authentication and Authorization:** Login with email/password and protection of private routes with JWT tokens.
* **User Management:**
    * Creation of users (public) with different roles (participant, organizer, admin).
    * Profile image upload to S3 (with resizing via Lambda).
    * Editing of one's own user data.
    * Listing and searching for users (Admin only).
    * Soft delete of users.
    * Email validation via token.
* **Event Management:**
    * Creation of events by organizers/admins, with image upload to S3.
    * Editing of events by the original organizer or admin.
    * Listing of events with filters (name, date, status) for all authenticated users.
    * Search for an event by ID.
    * Soft delete of events (inactivation).
* **Registration Management:**
    * Participants and Organizers can create registrations for active and future events.
    * Listing of one's own registrations.
    * Cancellation (soft delete) of one's own registration.
* **Email Notifications (AWS SES):**
    * Email validation upon user creation.
    * Confirmation of deleted account.
    * Confirmation of event created (for the organizer).
    * Confirmation of event deleted (for the organizer).
    * Confirmation of registration created (with iCalendar attachment).
    * Confirmation of registration canceled.
* **Administrator Seed:** Script to create a default administrator user.

## Technologies Used
* **Language:** TypeScript
* **Framework:** NestJS
* **Database:** AWS DynamoDB
* **File Storage:** AWS S3 (for images)
* **Serverless Functions:** AWS Lambda (for image resizing)
* **Email Sending:** AWS SES
* **Authentication:** JWT with Passport.js
* **API Documentation:** Swagger (OpenAPI)

## Prerequisites
Before you begin, ensure you have the following installed on your machine:
* [Node.js] (LTS version recommended, e.g., 18.x or 20.x)
* `npm` or `yarn`
* [AWS CLI] Installed and configured with your AWS credentials and default region.
    * Run `aws configure` and provide your Access Key ID, Secret Access Key, and Default Region.
    * The user associated with these credentials must have the necessary permissions to interact with DynamoDB, S3, SES, and Lambda.

## AWS Infrastructure Setup
This project requires the following AWS services to be configured in your account:
1.  **DynamoDB:**
    * Table for Users (`Users`) with GSI for `email` and `role`.
    * Table for Events (`Events`) with GSI for `name` (uniqueness), `organizerId`, and `status`+`eventDate`.
    * Table for Registrations (`Registrations`) with a composite primary key `userId`+`eventId` and GSI for `eventId`.
2.  **S3:**
    * A bucket for original images (e.g., `compass-events-images-originals`).
    * A bucket for resized images (e.g., `compass-events-images-resized`).
3.  **IAM:**
    * An IAM user for local development with permissions for DynamoDB, S3, SES.
    * An IAM Role for the image resizing Lambda with permissions to read from the S3 originals bucket, write to the S3 resized bucket, and for CloudWatch logs.
4.  **Lambda:**
    * A Lambda function configured to be triggered by uploads to the `user-profiles/` and `event-images/` prefixes of the S3 originals bucket.
    * This function should resize the images and save them to the S3 resized bucket.
    * Environment variables configured in Lambda (`S3_DESTINATION_BUCKET_NAME`, `TARGET_WIDTH`, `RESIZED_IMAGE_PREFIX`).
5.  **SES:**
    * Verified sender email identity.
    * If the SES account is in sandbox mode, recipient emails for testing must also be verified.
    * SES region configured correctly.

## How to Run the Project
1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd project-folder-name
    ```
2.  **Install Dependencies:**
    Using npm:
    ```bash
    npm install
    ```
    Or using yarn:
    ```bash
    yarn install
    ```
3.  **Configure Environment Variables:**
    * Copy the `.env.example` file to a new file named `.env`:
        ```bash
        cp .env.example .env
        ```
    * Open your `.env` file and fill in all the necessary variables with your values.
       ```env
        PORT=

        AWS_ACCESS_KEY_ID=
        AWS_SECRET_ACCESS_KEY=
        AWS_SESSION_TOKEN=
        AWS_REGION=

        DYNAMODB_TABLE_USERS=
        DYNAMODB_TABLE_EVENTS=
        DYNAMODB_TABLE_REGISTRATIONS=
        
        TARGET_WIDTH=
        TARGET_HEIGHT=
        RESIZED_IMAGE_PREFIX=""
        
        S3_BUCKET_NAME=
        S3_PROFILE_IMAGE_PATH=
        S3_EVENT_IMAGE_PATH=
        
        JWT_SECRET=
        JWT_EXPIRES_IN=
        
        SES_REGION=
        SES_FROM_EMAIL=
        API_URL=
        
        DEFAULT_ADMIN_NAME=
        DEFAULT_ADMIN_EMAIL=
        DEFAULT_ADMIN_PASSWORD=
        DEFAULT_ADMIN_PHONE=
       ```
4.  **Run the Seed Script (Optional, but recommended to have an admin):**
    * This script will create a default administrator user if one does not already exist.
    ```bash
    npm run seed
    ```
    Or with yarn:
    ```bash
    yarn seed
    ```
5.  **Start the Application in Development Mode:**
    ```bash
    npm run start:dev
    ```
    Or with yarn:
    ```bash
    yarn start:dev
    ```
    The application should start on the port you configured in `.env` (or on port 3000 by default).
6.  **Access Swagger Documentation:**
    * Open your browser and go to: `http://localhost:<port>/api`
        (e.g., `http://localhost:3000/api`)
    * There you can see all API endpoints, their DTOs, and test them. For protected routes, use the "Authorize" button to enter a JWT token obtained after login.

## Useful Scripts
* `npm run start`: Starts the application in production mode (after build).
* `npm run start:dev`: Starts the application in development mode with watch mode.
* `npm run build`: Compiles TypeScript code to JavaScript (to the `dist` folder).
* `npm run test`: Runs unit tests with Jest.
* `npm run test:cov`: Runs unit tests and generates a coverage report.
* `npm run seed`: Runs the database seeding script.

## Project Structure (Main Folders in `src`)
* `auth/`: Authentication logic, DTOs, guards, strategies.
* `aws/`: Services for interaction with AWS SDK (DynamoDB, S3).
* `database/seed/`: Logic and script for database seeding.
* `events/`: Module for event management (controller, service, DTOs, interface).
* `mail/`: Module and service for sending emails via SES.
* `registrations/`: Module for registration management (controller, service, DTOs, interface).
* `users/`: Folder for user management (controller, service, DTOs, interface, enums).
* `main.ts`: Main file of the NestJS application.
* `app.module.ts`: Root module of the application.


## Versão em Português

# Compass Events - pt

# Sobre
API Node.js para um sistema de reservas de espaços. Esta API permite o gerenciamento de usuários, eventos e inscrições, com autenticação e funcionalidades específicas para diferentes tipos de usuários (participantes, organizadores, administradores).

## Funcionalidades Principais

* **Autenticação e Autorização:** Login com email/palavra-passe e proteção de rotas privadas com tokens JWT.
* **Gestão de Usuários:**
    * Criação de Usuários (público) com diferentes funções (participante, organizador, admin).
    * Upload de imagem de perfil para o S3 (com redimensionamento via Lambda).
    * Edição de dados do próprio usuário.
    * Listagem e busca de usuário (apenas Admin).
    * Soft delete de usuários.
    * Validação de e-mail via token.
* **Gestão de Eventos:**
    * Criação de eventos por organizadores/admins, com upload de imagem para o S3.
    * Edição de eventos pelo organizador original ou admin.
    * Listagem de eventos com filtros (nome, data, status) para todos os usuários autenticados.
    * Busca de evento por ID.
    * Soft delete de eventos (inativação).
* **Gestão de Inscrições:**
    * Participantes e Organizadores podem criar inscrições em eventos ativos e futuros.
    * Listagem das próprias inscrições.
    * Cancelamento (soft delete) da própria inscrição.
* **Notificações por E-mail (AWS SES):**
    * Validação de e-mail na criação do usuário.
    * Confirmação de conta deletada.
    * Confirmação de evento criado (para o organizador).
    * Confirmação de evento deletado (para o organizador).
    * Confirmação de inscrição criada (com anexo iCalendar).
    * Confirmação de inscrição cancelada.
* **Seed de Administrador:** Script para criar um usuário administrador padrão.

## Tecnologias Utilizadas

* **Linguagem:** TypeScript
* **Framework:** NestJS
* **Base de Dados:** AWS DynamoDB
* **Armazenamento de Arquivos:** AWS S3 (para imagens)
* **Funções Serverless:** AWS Lambda (para redimensionamento de imagens)
* **Envio de E-mails:** AWS SES
* **Autenticação:** JWT com Passport.js
* **Documentação da API:** Swagger (OpenAPI)

## Pré-requisitos

Antes de começar, certifique-se de que tem o seguinte instalado na sua máquina:

* [Node.js] (versão LTS recomendada, ex: 18.x ou 20.x)
* `npm` ou `yarn`
* [AWS CLI] Instalado e configurado com as suas credenciais AWS e região padrão.
    * Execute `aws configure` e forneça o seu Access Key ID, Secret Access Key e Default Region.
    * O usuário associado a estas credenciais deve ter as permissões necessárias para interagir com DynamoDB, S3, SES e Lambda.

## Configuração da Infraestrutura AWS

Este projeto requer que os seguintes serviços AWS estejam configurados na sua conta:

1.  **DynamoDB:**
    * Tabela para usuários (`Users`) com GSI para `email` e `role`.
    * Tabela para Eventos (`Events`) com GSI para `name` (unicidade), `organizerId` e `status`+`eventDate`.
    * Tabela para Inscrições (`Registrations`) com chave primária composta `userId`+`eventId` e GSI para `eventId`.
2.  **S3:**
    * Um bucket para imagens originais (ex: `compass-events-images-originais`).
    * Um bucket para imagens redimensionadas (ex: `compass-events-images-redimensionadas`).
3.  **IAM:**
    * Um usuário IAM para desenvolvimento local com permissões para DynamoDB, S3, SES.
    * Uma Função IAM para a Lambda de redimensionamento de imagem com permissões para ler do bucket S3 de originais, escrever no bucket S3 de redimensionadas e para logs no CloudWatch.
4.  **Lambda:**
    * Uma função Lambda configurada para ser acionada por uploads nos prefixos `user-profiles/` e `event-images/` do bucket S3 de originais.
    * Esta função deve redimensionar as imagens e salvá-las no bucket S3 de redimensionadas.
    * Variáveis de ambiente configuradas na Lambda (`S3_DESTINATION_BUCKET_NAME`, `TARGET_WIDTH`, `RESIZED_IMAGE_PREFIX`).
5.  **SES:**
    * Identidade de e-mail de remetente verificada.
    * Se a conta SES estiver no sandbox, os emails de destinatário para teste também devem ser verificados.
    * Região do SES configurada corretamente.

## Como Executar o Projeto

1.  **Clone o Repositório:**
    ```bash
    git clone <URL_DO_SEU_REPOSITORIO_GIT>
    cd nome-da-pasta-do-projeto
    ```

2.  **Instale as Dependências:**
    Usando npm:
    ```bash
    npm install
    ```
    Ou usando yarn:
    ```bash
    yarn install
    ```

3.  **Configure as Variáveis de Ambiente:**
    * Copie o arquivo `.env.example` para um novo arquivo chamado `.env`:
        ```bash
        cp .env.example .env
        ```
    * Abra o seu arquivo `.env` e preencha todas as variáveis necessárias com os seus valores.
       ```env
        PORT=

        AWS_ACCESS_KEY_ID=
        AWS_SECRET_ACCESS_KEY=
        AWS_SESSION_TOKEN=
        AWS_REGION=

        DYNAMODB_TABLE_USERS=
        DYNAMODB_TABLE_EVENTS=
        DYNAMODB_TABLE_REGISTRATIONS=

        TARGET_WIDTH=
        TARGET_HEIGHT=
        RESIZED_IMAGE_PREFIX=""

        S3_BUCKET_NAME=
        S3_PROFILE_IMAGE_PATH=
        S3_EVENT_IMAGE_PATH=

        JWT_SECRET=
        JWT_EXPIRES_IN=

        SES_REGION=
        SES_FROM_EMAIL=
        API_URL=

        DEFAULT_ADMIN_NAME=
        DEFAULT_ADMIN_EMAIL=
        DEFAULT_ADMIN_PASSWORD=
        DEFAULT_ADMIN_PHONE=
       ```

4.  **Execute o Script de Seed (Opcional, mas recomendado para ter um admin):**
    * Este script criará um usuário administrador padrão se ele ainda não existir.
    ```bash
    npm run seed
    ```
    Ou com yarn:
    ```bash
    yarn seed
    ```

5.  **Inicie a Aplicação em Modo de Desenvolvimento:**
    ```bash
    npm run start:dev
    ```
    Ou com yarn:
    ```bash
    yarn start:dev
    ```
    A aplicação deverá iniciar na porta que você configurou no `.env` (ou na porta 3000 por padrão).

6.  **Aceda à Documentação Swagger:**
    * Abra o seu navegador e vá para: `http://localhost:<PORTA>/api`
        (ex: `http://localhost:3000/api`)
    * Lá você poderá ver todos os endpoints da API, os seus DTOs e testá-los. Para rotas protegidas, use o botão "Authorize" para inserir um token JWT obtido após o login.

## Scripts Úteis

* `npm run start`: Inicia a aplicação em modo de produção (após o build).
* `npm run start:dev`: Inicia a aplicação em modo de desenvolvimento com watch mode.
* `npm run build`: Compila o código TypeScript para JavaScript (para a pasta `dist`).
* `npm run test`: Executa os testes unitários com Jest.
* `npm run test:cov`: Executa os testes unitários e gera um relatório de cobertura.
* `npm run seed`: Executa o script de seeding do banco de dados.

## Estrutura do Projeto (Principais Pastas em `src`)

* `auth/`: Lógica de autenticação, DTOs, guards, strategies.
* `aws/`: Serviços para interação com AWS SDK (DynamoDB, S3).
* `database/seed/`: Lógica e script para o seeding do banco de dados.
* `events/`: Módulo para gestão de eventos (controller, service, DTOs, interface).
* `mail/`: Módulo e serviço para envio de e-mails via SES.
* `registrations/`: Módulo para gestão de inscrições (controller, service, DTOs, interface).
* `users/`: Pasta para gestão de usuários (controller, service, DTOs, interface, enums).
* `main.ts`: Arquivo principal da aplicação NestJS.
* `app.module.ts`: Módulo raiz da aplicação.
