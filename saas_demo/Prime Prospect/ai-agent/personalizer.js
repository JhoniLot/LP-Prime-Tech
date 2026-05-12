const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function personalizeProposal(lead, persona) {
    // Fallback também usa a abordagem de "pedir o responsável"
    // Abordagem "Curto e Grosso" - Aumenta muito a resposta
    const fallbackMsg = `Oi! Tudo bem? Com quem eu consigo falar sobre a gestão aí do ${lead.name}?`;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'seu_api_key_aqui') {
        return fallbackMsg;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
Você é um profissional de vendas B2B experiente. Sua meta única é gerar uma resposta (qualquer resposta) do lead.
O estabelecimento é: ${lead.name}.

REGRAS OBRIGATÓRIAS:
- A mensagem deve ter NO MÁXIMO 15 palavras.
- Deve parecer que você escreveu manualmente no celular, com pressa.
- Use apenas UM objetivo: Saber quem é o dono ou responsável.
- NÃO fale de sistema, NÃO fale de tecnologia, NÃO fale de solução.
- NÃO use emojis.

Exemplos de como deve ser:
- "Oi! Tudo bem? Você é o dono do ${lead.name} ou quem cuida da gestão?"
- "Opa, tudo bem? Como eu falo com o responsável pelo ${lead.name}?"

Gere apenas UM exemplo de mensagem curta.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        console.log(`[IA] Copy gerada com sucesso para: ${lead.name}`);
        return text;
    } catch (error) {
        console.error("[IA] Erro ao gerar proposta, usando fallback:", error.message);
        return fallbackMsg;
    }
}

module.exports = { personalizeProposal };
