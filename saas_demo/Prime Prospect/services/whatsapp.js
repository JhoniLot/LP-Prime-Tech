const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const { generateChatResponse } = require('../ai-agent/chat-bot');
const { getLeads } = require('../db/supabase');

const allowedContacts = new Map();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new', // Modo mais compatível com versões recentes do Puppeteer
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

let isReady = false;
let currentQrCode = null;
let connectionStatus = 'DISCONNECTED';

console.log('[WhatsApp] Configuração reiniciada.');

client.on('qr', async (qr) => {
    connectionStatus = 'QR_READY';
    console.log('\n=========================================================');
    console.log('🤖 ESCANEIE O QR CODE NO PAINEL OU ABAIXO COM O SEU WHATSAPP');
    console.log('=========================================================\n');
    qrcodeTerminal.generate(qr, { small: true });
    
    try {
        currentQrCode = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error('Erro ao gerar imagem do QR code', err);
    }
});

client.on('ready', async () => {
    connectionStatus = 'CONNECTED';
    currentQrCode = null;
    isReady = true;
    console.log('✅ [WhatsApp Bot] Conectado e pronto para operar!');
    await syncAllowedContacts();
});

client.on('disconnected', (reason) => {
    console.log('❌ [WhatsApp Bot] Desconectado:', reason);
    connectionStatus = 'DISCONNECTED';
    isReady = false;
    currentQrCode = null;
    // Tenta reconectar iniciando novamente
    client.initialize();
});

client.on('message', async msg => {
    if (msg.from === 'status@broadcast' || msg.isGroupMsg) return;

    const senderPhone = msg.from.replace('@c.us', '');
    
    if (!allowedContacts.has(senderPhone)) {
        console.log(`[WhatsApp] Mensagem ignorada de contato desconhecido: ${senderPhone}`);
        return;
    }

    const leadData = allowedContacts.get(senderPhone);
    console.log(`\n💬 [WhatsApp] Mensagem recebida de ${leadData.name} (${senderPhone}): ${msg.body}`);

    const chat = await msg.getChat();
    chat.sendStateTyping();

    try {
        const aiResponse = await generateChatResponse(
            senderPhone, 
            leadData.name, 
            leadData.persona, 
            msg.body
        );

        const delay = Math.floor(Math.random() * 3000) + 2000;
        setTimeout(async () => {
            await client.sendMessage(msg.from, aiResponse);
            chat.clearState();
            console.log(`🤖 [WhatsApp] Resposta enviada: ${aiResponse}`);
        }, delay);

    } catch (error) {
        console.error('[WhatsApp] Erro ao responder:', error);
        chat.clearState();
    }
});

async function syncAllowedContacts() {
    try {
        const leads = await getLeads();
        allowedContacts.clear();
        
        leads.forEach(lead => {
            if (lead.phone) {
                const formatted = lead.phone.replace(/\D/g, '');
                allowedContacts.set(formatted, {
                    name: lead.name,
                    persona: lead.persona,
                    id: lead.id
                });
            }
        });
    } catch (error) {
        console.error('[WhatsApp] Erro ao sincronizar contatos:', error);
    }
}

async function sendDirectMessage(phone, text) {
    if (!isReady) throw new Error("Bot do WhatsApp não está conectado.");
    
    // Limpa o número: garante que só tem dígitos e remove o 55 duplicado se houver
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.length === 11 && formattedPhone.startsWith('9')) {
        formattedPhone = '55' + formattedPhone; // Adiciona o DDI se faltar
    } else if (formattedPhone.length === 10) {
        formattedPhone = '55' + formattedPhone;
    }

    const chatId = `${formattedPhone}@c.us`;

    try {
        // Resolve o ID real do usuário no WhatsApp (isso evita o erro de LID)
        const contactId = await client.getNumberId(formattedPhone);
        if (!contactId) {
            throw new Error(`O número ${formattedPhone} não está registrado no WhatsApp.`);
        }

        const chat = await client.getChatById(contactId._serialized);
        await chat.sendMessage(text);
        
        console.log(`🚀 [WhatsApp] Mensagem disparada para ${formattedPhone}`);
        await syncAllowedContacts();
    } catch (error) {
        console.error(`[WhatsApp] Falha ao enviar para ${formattedPhone}:`, error.message);
        
        // Se o erro for de Frame ou Navegador fechado, reinicia o cliente
        if (error.message.includes('detached Frame') || error.message.includes('Target closed')) {
            console.log('⚠️ Erro crítico de navegador detectado. Reiniciando cliente WhatsApp...');
            isReady = false;
            client.initialize();
        }
        
        throw error;
    }
}

function initWhatsApp() {
    console.log('🔄 [WhatsApp] Inicializando cliente...');
    client.initialize();
}

function getWhatsAppStatus() {
    return {
        status: connectionStatus,
        qrCode: currentQrCode
    };
}

module.exports = { initWhatsApp, sendDirectMessage, syncAllowedContacts, getWhatsAppStatus };

// Fim do arquivo
