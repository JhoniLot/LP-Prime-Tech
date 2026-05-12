require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function scrapeGoogleMaps(query, maxResults = 10) {
    console.log(`[Buscador] Iniciando pesquisa para: "${query}" | Buscando até ${maxResults} leads COM telefone`);
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=pt-BR']
    });

    const context = browser.defaultBrowserContext();
    await context.overridePermissions('https://www.google.com/maps', ['geolocation']);

    const page = await browser.newPage();
    await page.setGeolocation({ latitude: 0, longitude: 0 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

    const results = [];

    try {
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 }).catch(() => {});

        // Pega os links de todos os estabelecimentos na lista
        let placeLinks = [];
        let scrollCount = 0;
        const maxScrolls = 8;

        while (placeLinks.length < maxResults * 2 && scrollCount < maxScrolls) {
            placeLinks = await page.$$eval('a[href*="/maps/place/"]', links =>
                [...new Set(links.map(l => l.href))].filter(h => h.includes('/maps/place/'))
            );

            if (placeLinks.length < maxResults * 2) {
                await page.evaluate(() => {
                    const feed = document.querySelector('div[role="feed"]');
                    if (feed) feed.scrollBy(0, 1500);
                });
                await new Promise(r => setTimeout(r, 2000));
                scrollCount++;
            }
        }

        console.log(`[Buscador] ${placeLinks.length} estabelecimentos encontrados. Abrindo detalhes para pegar telefones...`);

        // Abre cada estabelecimento e extrai o telefone
        const detailPage = await browser.newPage();
        await detailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');

        for (const link of placeLinks) {
            if (results.length >= maxResults) break;

            try {
                await detailPage.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
                await new Promise(r => setTimeout(r, 1500));

                const leadData = await detailPage.evaluate(() => {
                    // Nome
                    const name = document.querySelector('h1')?.innerText?.trim();

                    // Rating
                    const rating = document.querySelector('span[aria-label*="estrelas"]')?.getAttribute('aria-label')?.match(/[\d,]+/)?.[0]
                        || document.querySelector('div[jslog*="rating"]')?.innerText?.trim();

                    // Endereço
                    const addressEl = document.querySelector('[data-item-id="address"] .fontBodyMedium')
                        || document.querySelector('button[data-item-id="address"]');
                    const address = addressEl?.innerText?.trim();

                    // Telefone — tenta múltiplos seletores
                    const phoneEl = document.querySelector('[data-item-id^="phone"] .fontBodyMedium')
                        || document.querySelector('button[data-item-id^="phone"]')
                        || [...document.querySelectorAll('span')].find(s => s.innerText.match(/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/));
                    
                    let phone = phoneEl?.innerText?.trim() || phoneEl?.getAttribute('aria-label');
                    
                    // Filtra apenas celulares (potenciais WhatsApp)
                    if (phone) {
                        let cleaned = phone.replace(/\D/g, '');
                        
                        // Se vier com DDI 55 do Brasil, remove para padronizar
                        if (cleaned.startsWith('55') && cleaned.length > 11) {
                            cleaned = cleaned.substring(2);
                        }

                        // Verifica se é um celular válido (11 dígitos e o terceiro dígito é 9)
                        if (cleaned.length === 11 && cleaned[2] === '9') {
                            // É celular! Vamos reformatar para o padrão internacional do WhatsApp
                            phone = '55' + cleaned;
                        } else {
                            // É telefone fixo ou inválido — descarta
                            phone = null;
                        }
                    }

                    // Website
                    const websiteEl = document.querySelector('a[data-item-id="authority"]')
                        || document.querySelector('a[aria-label*="Website"]')
                        || document.querySelector('a[aria-label*="site"]');
                    const website = websiteEl?.href || null;

                    return { name, rating, address, phone, website };
                });

                if (!leadData.name) continue;

                if (!leadData.phone) {
                    console.log(`[Buscador] ⚠️  Sem telefone: ${leadData.name} — ignorando`);
                    continue;
                }

                console.log(`[Buscador] ✅ Lead com telefone: ${leadData.name} | ${leadData.phone}`);
                results.push({
                    ...leadData,
                    source: 'Google Maps',
                    date: new Date().toISOString()
                });

            } catch (err) {
                console.log(`[Buscador] Erro ao abrir detalhe: ${err.message}`);
                continue;
            }
        }

        await detailPage.close();

        if (results.length > 0) {
            const dataPath = path.join(__dirname, '../data', `leads_${Date.now()}.json`);
            fs.writeFileSync(dataPath, JSON.stringify(results, null, 2));
        }

        console.log(`[Buscador] ✅ ${results.length} leads COM telefone encontrados de ${placeLinks.length} estabelecimentos visitados.`);
        return results;

    } catch (error) {
        console.error('[Erro] Falha no scraper:', error.message);
        return results;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeGoogleMaps };
