const axios = require('axios');
require('dotenv').config();

async function sendWhatsAppMessage(number, message) {
    const url = `${process.env.WHATSAPP_INSTANCE_URL}/message/sendText/${process.env.WHATSAPP_INSTANCE_NAME}`;
    
    const data = {
        number: number, // formato: 5511999999999
        text: message
    };

    const config = {
        headers: {
            'apikey': process.env.WHATSAPP_INSTANCE_TOKEN
        }
    };

    try {
        // const response = await axios.post(url, data, config);
        // console.log(`[WhatsApp] Mensagem enviada para ${number}`);
        // return response.data;
        
        console.log(`[Simulação] Enviando para ${number}: ${message.substring(0, 50)}...`);
        return { status: "success (simulated)" };
    } catch (error) {
        console.error(`[Erro WhatsApp] Falha ao enviar para ${number}:`, error.message);
    }
}

module.exports = { sendWhatsAppMessage };
