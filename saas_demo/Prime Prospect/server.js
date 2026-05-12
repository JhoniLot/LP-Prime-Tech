const express = require('express');
const path = require('path');
const { scrapeGoogleMaps } = require('./scrapers/google-maps');
const { personalizeProposal } = require('./ai-agent/personalizer');
const { saveLeads, getLeads, updateStatus } = require('./db/supabase');
const { deepSearchContact } = require('./scrapers/deep-search');

const app = express();
const PORT = 5001;

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; font-src *; connect-src *;");
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── BUSCA E SALVA LEADS ───────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
    const { niche, city, limit } = req.query;
    if (!niche || !city) return res.status(400).json({ error: "Nicho e Cidade são obrigatórios" });

    try {
        const query = `${niche} em ${city}, Brasil`;
        console.log(`\n[BUSCA] Query: "${query}" | Limite: ${limit}`);

        const scrapedLeads = await scrapeGoogleMaps(query, parseInt(limit) || 10);
        console.log(`[BUSCA] ${scrapedLeads.length} leads encontrados pelo scraper.`);

        if (scrapedLeads.length === 0) {
            return res.json([]);
        }

        // 3. Identifica o que é novo e salva no banco
        const existingLeads = await getLeads();
        const existingMap = new Map(existingLeads.map(l => [l.name.toLowerCase().trim(), l]));
        
        const newLeads = scrapedLeads.filter(l => !existingMap.has(l.name.toLowerCase().trim()));
        
        if (newLeads.length > 0) {
            await saveLeads(newLeads, niche);
        }

        // 4. Busca novamente para garantir que todos tenham IDs do banco e retorna a lista completa da busca
        const updatedLeads = await getLeads();
        const finalResults = scrapedLeads.map(scraped => {
            const match = updatedLeads.find(db => db.name.toLowerCase().trim() === scraped.name.toLowerCase().trim());
            return match || scraped;
        });

        console.log(`[BUSCA] ${newLeads.length} novos | ${finalResults.length} exibidos.`);
        res.json(finalResults);
    } catch (error) {
        console.error('[ERRO na busca]', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── BUSCA TODOS OS LEADS DO BANCO ────────────────────────────────────────
app.get('/api/leads', async (req, res) => {
    const { persona } = req.query;
    try {
        const leads = await getLeads(persona);
        res.json(leads);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── ATUALIZA STATUS ────────────────────────────────────────────────────────
app.put('/api/leads/status', async (req, res) => {
    const { id, status } = req.body;
    try {
        const success = await updateStatus(id, status);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── BUSCA PROFUNDA ─────────────────────────────────────────────────────────
app.post('/api/deep-search', async (req, res) => {
    const { name, city, id } = req.body;
    try {
        const result = await deepSearchContact(name, city);
        if (result && result.phone) {
            await updateStatus(id, 'Leads novos', result.phone);
            return res.json({ success: true, phone: result.phone });
        }
        res.json({ success: false, message: 'Nenhum contato novo encontrado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── PERSONALIZA PROPOSTA ───────────────────────────────────────────────────
app.post('/api/personalize', async (req, res) => {
    const { lead, persona } = req.body;
    if (!lead) return res.status(400).json({ error: "Dados do lead são obrigatórios" });
    try {
        const proposal = await personalizeProposal(lead, persona || 'estética');
        res.json({ proposal });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── ESTATÍSTICAS ────────────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
    try {
        const leads = await getLeads();
        const today = new Date().toISOString().split('T')[0];
        const leadsToday = leads.filter(l => l.created_at && l.created_at.split('T')[0] === today).length;
        res.json({ totalLeads: leads.length, leadsToday, searches: 'N/A' });
    } catch(e) {
        res.json({ totalLeads: 0, leadsToday: 0, searches: 0 });
    }
});

// ─── WHATSAPP API ────────────────────────────────────────────────────────────
const { initWhatsApp, sendDirectMessage, getWhatsAppStatus } = require('./services/whatsapp');

app.get('/api/whatsapp/status', (req, res) => {
    try {
        res.json(getWhatsAppStatus());
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    const { phone, text, id } = req.body;
    if (!phone || !text) return res.status(400).json({ error: "Telefone e texto são obrigatórios." });

    try {
        await sendDirectMessage(phone, text);
        if (id) await updateStatus(id, 'Mensagem enviada');
        res.json({ success: true });
    } catch (error) {
        console.error('[ERRO DISPARO WPP]', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Prime Prospect rodando em: http://localhost:${PORT}\n`);
    initWhatsApp(); // Inicializa o bot do WhatsApp
});
