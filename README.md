# zap-lista — listas de transmissão com a API oficial do WhatsApp

## Configurar na Meta
1. developers.facebook.com > criar app tipo "Business" > adicionar produto WhatsApp.
2. Em WhatsApp > API Setup: copie o **Phone number ID** e gere um **token permanente** (usuário do sistema).
3. No WhatsApp Manager, crie e aprove um **template** de mensagem (obrigatório para iniciar conversas).
4. Em Configuration > Webhook: URL `https://SEU-DOMINIO/webhook`, token = seu VERIFY_TOKEN, assine o campo `messages`.

## Rodar
    cp .env.example .env   # preencha os valores
    npm install
    npm start              # http://localhost:3000 (login do .env)

Para receber o webhook, publique em HTTPS (Render, Railway, VPS) ou use ngrok em testes.

## Regras importantes
- Só envie para quem deu **consentimento (opt-in)**. Quem responder "SAIR" é bloqueado automaticamente.
- Envio em massa só com **templates aprovados**; a Meta cobra por conversa e limita o volume conforme a qualidade do número.
