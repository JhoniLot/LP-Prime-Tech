const { scrapeGoogleMaps } = require('./scrapers/google-maps');
const { personalizeProposal } = require('./ai-agent/personalizer');

async function startProspecting(niche, city) {
    const query = `${niche} em ${city}`;
    console.log(`\n🚀 Iniciando Operação Prime Prospect: ${query}`);
    
    try {
        const leads = await scrapeGoogleMaps(query, 3); // Buscando 3 para teste rápido
        
        if (leads && leads.length > 0) {
            console.log(`\n🎯 Prospecção finalizada! Encontrados ${leads.length} leads.`);
            
            // Personaliza o primeiro lead como exemplo
            console.log(`\n🤖 IA gerando proposta para: ${leads[0].name}...`);
            const proposal = await personalizeProposal(leads[0]);
            
            console.log("\n--- EXEMPLO DE ABORDAGEM PERSONALIZADA ---");
            console.log(proposal);
            console.log("------------------------------------------\n");

            console.table(leads.map(l => ({ Nome: l.name, Estrelas: l.rating || 'N/A' })));
        } else {
            console.log("\n⚠️ Nenhum lead encontrado. Tente mudar o termo de pesquisa.");
        }
    } catch (err) {
        console.error("Erro na operação:", err);
    }
}

// Para rodar: node index.js "Clínicas de Estética" "São Paulo"
const args = process.argv.slice(2);
const niche = args[0] || "Clínicas de Estética";
const city = args[1] || "São Paulo";

startProspecting(niche, city);
