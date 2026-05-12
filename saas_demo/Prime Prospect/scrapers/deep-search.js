const puppeteer = require('puppeteer');

async function deepSearchContact(leadName, city) {
    console.log(`[Busca Profunda] Investigando: ${leadName} em ${city}`);
    
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    try {
        // Pesquisa no Google pelo Instagram ou Site da empresa
        const query = `${leadName} ${city} instagram whatsapp`;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
        
        // Tenta encontrar links de redes sociais ou padrões de telefone no texto da busca
        const foundData = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            const phoneMatch = bodyText.match(/\(?\d{2}\)?\s?9\d{4}-?\d{4}/); // Foca em celulares (9 dígitos)
            
            return {
                phone: phoneMatch ? phoneMatch[0] : null,
                hasInstagram: bodyText.toLowerCase().includes('instagram.com')
            };
        });

        return foundData;
    } catch (error) {
        console.error('[Erro na Busca Profunda]', error);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { deepSearchContact };
