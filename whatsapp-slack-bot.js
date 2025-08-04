#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

class WhatsAppSlackBot {
    constructor() {
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        this.contactName = process.env.WHATSAPP_CONTACT_NAME || 'Anafre';
        this.timezone = process.env.TIMEZONE || 'America/Mexico_City';
        this.debug = process.env.DEBUG === 'true';
        this.headless = process.env.HEADLESS !== 'false';
        this.sessionPath = path.join(__dirname, 'whatsapp-session');
        
        if (!this.slackWebhookUrl) {
            throw new Error('SLACK_WEBHOOK_URL es requerido en el archivo .env');
        }
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleString('es-MX', { 
            timeZone: this.timezone 
        });
        const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
        console.log(`${prefix} ${message}`);
    }

    async ensureSessionDir() {
        try {
            await fs.access(this.sessionPath);
        } catch {
            await fs.mkdir(this.sessionPath, { recursive: true });
            this.log('Directorio de sesión creado');
        }
    }

    async launchBrowser() {
        this.log('Iniciando navegador...');
        
        const browser = await puppeteer.launch({
            headless: this.headless,
            userDataDir: this.sessionPath,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
            timeout: 30000
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
        
        return { browser, page };
    }

    async waitForWhatsAppLoad(page) {
        this.log('Cargando WhatsApp Web...');
        await page.goto('https://web.whatsapp.com', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // Esperar a que cargue completamente
        try {
            // Si aparece el QR, significa que no hay sesión guardada
            await page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 10000 });
            this.log('Se requiere escanear código QR. Ejecuta el bot en modo no-headless primero.');
            throw new Error('Sesión de WhatsApp no encontrada. Escanea el código QR primero.');
        } catch (error) {
            if (error.message.includes('Sesión de WhatsApp')) {
                throw error;
            }
            // Si no aparece el QR, probablemente ya está logueado
            this.log('Sesión de WhatsApp detectada, continuando...');
        }

        // Esperar a que cargue la interfaz principal
        await page.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 });
        this.log('WhatsApp Web cargado correctamente');
    }

    async findContact(page, contactName) {
        this.log(`Buscando contacto: ${contactName}`);
        
        // Hacer clic en el cuadro de búsqueda
        await page.click('[data-testid="search-input"]');
        await page.type('[data-testid="search-input"]', contactName);
        
        // Esperar un poco para que aparezcan los resultados
        await page.waitForTimeout(2000);
        
        // Buscar el contacto en los resultados
        const contactSelector = `[data-testid="chat-list"] [title*="${contactName}"]`;
        
        try {
            await page.waitForSelector(contactSelector, { timeout: 5000 });
            await page.click(contactSelector);
            this.log(`Contacto ${contactName} encontrado y seleccionado`);
            return true;
        } catch (error) {
            this.log(`Contacto ${contactName} no encontrado`, 'error');
            return false;
        }
    }

    async getMessagesForDate(page, targetDate = new Date()) {
        const dateStr = targetDate.toLocaleDateString('es-MX', { 
            timeZone: this.timezone,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        this.log(`Obteniendo mensajes del ${dateStr}...`);
        
        // Esperar a que carguen los mensajes
        await page.waitForSelector('[data-testid="msg-container"]', { timeout: 10000 });
        
        this.log(`Buscando mensajes de: ${dateStr}`);
        
        // Extraer mensajes del día específico
        const messages = await page.evaluate((targetDateStr) => {
            const messageContainers = document.querySelectorAll('[data-testid="msg-container"]');
            const dayMessages = [];
            
            messageContainers.forEach(container => {
                // Buscar fecha en el mensaje
                const dateElement = container.querySelector('[data-testid="date-trans"]');
                if (dateElement) {
                    const messageDate = dateElement.textContent.trim();
                    // Si coincide con la fecha objetivo, extraer el texto del mensaje
                    if (messageDate === targetDateStr) {
                        const textElement = container.querySelector('[data-testid="msg-text"]');
                        if (textElement) {
                            dayMessages.push({
                                text: textElement.textContent.trim(),
                                time: container.querySelector('[data-testid="msg-time"]')?.textContent || '',
                                date: messageDate
                            });
                        }
                    }
                }
            });
            
            return dayMessages;
        }, dateStr);
        
        this.log(`Encontrados ${messages.length} mensajes del ${dateStr}`);
        return messages;
    }

    // Método legacy para compatibilidad
    async getTodayMessages(page) {
        return this.getMessagesForDate(page, new Date());
    }

    async sendToSlack(messages) {
        if (messages.length === 0) {
            this.log('No hay mensajes para enviar a Slack');
            return;
        }

        this.log(`Enviando ${messages.length} mensajes a Slack...`);
        
        const today = new Date().toLocaleDateString('es-MX', { 
            timeZone: this.timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let slackMessage = `📱 *Mensajes de ${this.contactName}* - ${today}\n\n`;
        
        messages.forEach((msg, index) => {
            slackMessage += `*${msg.time}*\n${msg.text}\n\n`;
        });

        try {
            await axios.post(this.slackWebhookUrl, {
                text: slackMessage,
                username: 'WhatsApp Bot',
                icon_emoji: ':speech_balloon:'
            });
            
            this.log('Mensajes enviados a Slack correctamente');
        } catch (error) {
            this.log(`Error enviando a Slack: ${error.message}`, 'error');
            throw error;
        }
    }

    async runForDate(targetDate = new Date()) {
        let browser = null;
        
        try {
            const dateStr = targetDate.toLocaleDateString('es-MX', { 
                timeZone: this.timezone,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            
            this.log(`Iniciando búsqueda de mensajes para ${dateStr}`);
            
            await this.ensureSessionDir();
            const { browser: br, page } = await this.launchBrowser();
            browser = br;
            
            await this.waitForWhatsAppLoad(page);
            
            const contactFound = await this.findContact(page, this.contactName);
            if (!contactFound) {
                throw new Error(`No se pudo encontrar el contacto ${this.contactName}`);
            }
            
            const messages = await this.getMessagesForDate(page, targetDate);
            
            this.log(`Búsqueda completada. Encontrados ${messages.length} mensajes.`);
            return messages;
            
        } catch (error) {
            this.log(`Error durante la búsqueda: ${error.message}`, 'error');
            throw error;
        } finally {
            if (browser) {
                await browser.close();
                this.log('Navegador cerrado');
            }
        }
    }

    async run() {
        let browser = null;
        
        try {
            this.log('Iniciando bot WhatsApp -> Slack');
            
            await this.ensureSessionDir();
            const { browser: br, page } = await this.launchBrowser();
            browser = br;
            
            await this.waitForWhatsAppLoad(page);
            
            const contactFound = await this.findContact(page, this.contactName);
            if (!contactFound) {
                throw new Error(`No se pudo encontrar el contacto ${this.contactName}`);
            }
            
            const messages = await this.getTodayMessages(page);
            await this.sendToSlack(messages);
            
            this.log('Ejecución completada exitosamente');
            
        } catch (error) {
            this.log(`Error durante la ejecución: ${error.message}`, 'error');
            
            // Enviar notificación de error a Slack
            try {
                await axios.post(this.slackWebhookUrl, {
                    text: `🚨 *Error en WhatsApp Bot*\n\`\`\`${error.message}\`\`\``,
                    username: 'WhatsApp Bot',
                    icon_emoji: ':warning:'
                });
            } catch (slackError) {
                this.log(`Error enviando notificación de error a Slack: ${slackError.message}`, 'error');
            }
            
            throw error;
        } finally {
            if (browser) {
                await browser.close();
                this.log('Navegador cerrado');
            }
        }
    }

    setupCron() {
        this.log('Configurando cron job para L-V a las 10:00 AM');
        
        // Ejecutar de lunes a viernes a las 10:00 AM
        cron.schedule('0 10 * * 1-5', async () => {
            this.log('Ejecutando tarea programada...');
            try {
                await this.run();
            } catch (error) {
                this.log(`Error en tarea programada: ${error.message}`, 'error');
            }
        }, {
            timezone: this.timezone
        });
        
        this.log(`Cron job configurado. Próxima ejecución: L-V 10:00 AM (${this.timezone})`);
    }
}

// Punto de entrada principal
async function main() {
    const bot = new WhatsAppSlackBot();
    
    // Si se pasa --test, ejecutar una vez
    if (process.argv.includes('--test')) {
        console.log('Modo de prueba activado');
        try {
            await bot.run();
            process.exit(0);
        } catch (error) {
            console.error('Error en modo de prueba:', error.message);
            process.exit(1);
        }
    } else {
        // Modo normal: configurar cron job
        bot.setupCron();
        console.log('Bot iniciado. Presiona Ctrl+C para detener.');
        
        // Mantener el proceso vivo
        process.on('SIGINT', () => {
            console.log('\nBot detenido.');
            process.exit(0);
        });
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = WhatsAppSlackBot;