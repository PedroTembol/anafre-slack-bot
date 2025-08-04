#!/usr/bin/env node

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const WhatsAppSlackBot = require('./whatsapp-slack-bot');

const app = express();
const PORT = process.env.PORT || 3000;
const SLACK_VERIFICATION_TOKEN = process.env.SLACK_VERIFICATION_TOKEN;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toLocaleString('es-MX', { 
        timeZone: process.env.TIMEZONE || 'America/Mexico_City'
    });
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'WhatsApp Slack Bot Server'
    });
});

// Slack slash command endpoint
app.post('/slack/anafre', async (req, res) => {
    const { token, team_id, team_domain, channel_id, channel_name, user_id, user_name, command, text, response_url } = req.body;
    
    // Verificar token de Slack (si está configurado)
    if (SLACK_VERIFICATION_TOKEN && token !== SLACK_VERIFICATION_TOKEN) {
        console.log(`[ERROR] Invalid Slack token from user ${user_name}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log(`[INFO] Slash command received from ${user_name} in #${channel_name}: ${command} ${text}`);
    
    // Respuesta inmediata a Slack (dentro de 3 segundos)
    res.json({
        response_type: 'in_channel',
        text: `🔍 Buscando mensajes de Anafre... esto puede tomar unos segundos.`,
        attachments: [{
            color: '#36a64f',
            text: `Solicitado por @${user_name}`,
            ts: Math.floor(Date.now() / 1000)
        }]
    });
    
    // Procesar la petición en background
    processSlashCommand(response_url, user_name, text);
});

async function processSlashCommand(responseUrl, userName, commandText) {
    try {
        console.log(`[INFO] Processing slash command for user ${userName}`);
        
        // Crear instancia del bot
        const bot = new WhatsAppSlackBot();
        
        // Determinar qué buscar basado en el texto del comando
        let searchDate = new Date();
        let dateText = 'hoy';
        
        if (commandText) {
            const lowerText = commandText.toLowerCase().trim();
            
            if (lowerText === 'ayer' || lowerText === 'yesterday') {
                searchDate.setDate(searchDate.getDate() - 1);
                dateText = 'ayer';
            } else if (lowerText.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                // Formato DD/MM/YYYY
                const [day, month, year] = lowerText.split('/');
                searchDate = new Date(year, month - 1, day);
                dateText = lowerText;
            } else if (lowerText.match(/^\d{1,2}\/\d{1,2}$/)) {
                // Formato DD/MM (año actual)
                const [day, month] = lowerText.split('/');
                searchDate = new Date(new Date().getFullYear(), month - 1, day);
                dateText = lowerText;
            }
        }
        
        // Ejecutar búsqueda con fecha específica
        const messages = await bot.runForDate(searchDate);
        
        // Preparar respuesta
        let responseText;
        let color = '#36a64f'; // Verde
        
        if (messages.length === 0) {
            responseText = `No se encontraron mensajes de Anafre para ${dateText} 📭`;
            color = '#ff9500'; // Naranja
        } else {
            const formattedDate = searchDate.toLocaleDateString('es-MX', {
                timeZone: process.env.TIMEZONE || 'America/Mexico_City',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            responseText = `📱 *Mensajes de Anafre* - ${formattedDate}\n\n`;
            messages.forEach((msg, index) => {
                responseText += `*${msg.time}*\n${msg.text}\n\n`;
            });
        }
        
        // Enviar respuesta delayed a Slack
        await sendDelayedResponse(responseUrl, {
            response_type: 'in_channel',
            text: responseText,
            attachments: [{
                color: color,
                text: `✅ Búsqueda completada • Solicitado por @${userName}`,
                ts: Math.floor(Date.now() / 1000)
            }]
        });
        
        console.log(`[INFO] Slash command processed successfully for ${userName}. Found ${messages.length} messages.`);
        
    } catch (error) {
        console.error(`[ERROR] Processing slash command for ${userName}:`, error.message);
        
        // Enviar error a Slack
        await sendDelayedResponse(responseUrl, {
            response_type: 'ephemeral',
            text: `❌ Error procesando la búsqueda: ${error.message}`,
            attachments: [{
                color: 'danger',
                text: `Solicitado por @${userName}`,
                ts: Math.floor(Date.now() / 1000)
            }]
        });
    }
}

async function sendDelayedResponse(responseUrl, payload) {
    try {
        const axios = require('axios');
        await axios.post(responseUrl, payload);
    } catch (error) {
        console.error('[ERROR] Sending delayed response to Slack:', error.message);
    }
}

// Endpoint para testing
app.get('/test', async (req, res) => {
    try {
        const bot = new WhatsAppSlackBot();
        const messages = await bot.runForDate(new Date());
        
        res.json({
            success: true,
            date: new Date().toLocaleDateString('es-MX'),
            messagesFound: messages.length,
            messages: messages
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('[ERROR] Server error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Slack server running on port ${PORT}`);
    console.log(`📡 Slash command endpoint: http://localhost:${PORT}/slack/anafre`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
    
    if (!SLACK_VERIFICATION_TOKEN) {
        console.log('⚠️  SLACK_VERIFICATION_TOKEN not set - slash commands will work without verification');
    }
});

module.exports = app;