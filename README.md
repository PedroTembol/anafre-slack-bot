# WhatsApp to Slack Bot

Bot automatizado que reenvía mensajes de WhatsApp de un contacto específico (Anafre) al Slack del equipo, ejecutándose automáticamente de lunes a viernes a las 10:00 AM.

## Características

- 🕙 **Ejecución programada**: Lunes a viernes a las 10:00 AM
- ⚡ **Slash command**: Búsqueda manual con `/anafre` en Slack
- 📱 **WhatsApp Web**: Usa Puppeteer para automatizar WhatsApp Web
- 💬 **Filtrado inteligente**: Solo mensajes del contacto "Anafre" del día actual
- 📅 **Búsqueda por fecha**: Buscar mensajes de días específicos
- 🔗 **Integración Slack**: Envía mensajes formateados via webhook
- 🔒 **Sesión persistente**: Guarda la sesión de WhatsApp para evitar re-autenticación
- 📝 **Logs detallados**: Sistema completo de logging con timestamps
- ⚠️ **Manejo de errores**: Notificaciones automáticas a Slack en caso de fallo

## Instalación

### 1. Clonar y configurar

```bash
# Instalar dependencias
npm install

# Copiar archivo de configuración
cp .env.example .env
```

### 2. Configurar variables de entorno

Edita el archivo `.env`:

```bash
# URL del webhook de Slack (OBLIGATORIO)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/TU/WEBHOOK/URL

# Opcional: nombre del contacto (default: Anafre)
WHATSAPP_CONTACT_NAME=Anafre

# Opcional: zona horaria (default: America/Mexico_City)
TIMEZONE=America/Mexico_City

# Opcional: modo debug (default: false)
DEBUG=false

# Opcional: modo headless (default: true)
HEADLESS=true
```

### 3. Configurar webhook de Slack

1. Ve a https://api.slack.com/apps
2. Crea una nueva app
3. Activa "Incoming Webhooks"
4. Crear webhook para el canal deseado
5. Copia la URL al archivo `.env`

### 4. Configurar Slash Command (Opcional)

Para permitir búsquedas manuales con `/anafre`:

1. En tu Slack App, ve a "Slash Commands"
2. Crea un nuevo comando:
   - **Command**: `/anafre`
   - **Request URL**: `http://localhost:3000/slack/anafre`
   - **Short Description**: "Buscar mensajes de Anafre"
   - **Usage Hint**: `[hoy|ayer|DD/MM/YYYY]`
3. Copia el "Verification Token" al archivo `.env` como `SLACK_VERIFICATION_TOKEN`
4. Instala la app en tu workspace

### 5. Configurar sesión de WhatsApp

```bash
# Ejecutar en modo no-headless para escanear QR
HEADLESS=false npm run test
```

1. Se abrirá Chrome con WhatsApp Web
2. Escanea el código QR con tu teléfono
3. Una vez logueado, cierra el navegador
4. La sesión quedará guardada para futuras ejecuciones

## Uso

### Cron Job Automático
```bash
# Iniciar cron job (se ejecuta L-V a las 10:00 AM)
npm start
```

### Servidor Web para Slash Commands
```bash
# Iniciar servidor web en puerto 3000
npm run server

# Modo desarrollo con auto-reload
npm run dev
```

### Modo de prueba (ejecutar una vez)
```bash
npm run test
```

### Slash Command en Slack

Una vez configurado, puedes usar el comando desde Slack:

```
/anafre                 # Buscar mensajes de hoy
/anafre ayer           # Buscar mensajes de ayer  
/anafre 15/12/2024     # Buscar mensajes de fecha específica
/anafre 15/12          # Buscar mensajes del 15/12 del año actual
```

### Ejecutar en background
```bash
# Bot cron + servidor web
pm2 start ecosystem.config.js

# Solo cron job
nohup npm start > whatsapp-bot.log 2>&1 &

# Solo servidor web
nohup npm run server > slack-server.log 2>&1 &
```

## Configuración del sistema (Opcional)

### Systemd Service (Linux)

Crear `/etc/systemd/system/whatsapp-slack-bot.service`:

```ini
[Unit]
Description=WhatsApp to Slack Bot
After=network.target

[Service]
Type=simple
User=tu-usuario
WorkingDirectory=/ruta/a/anafre
ExecStart=/usr/bin/node whatsapp-slack-bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Activar:
```bash
sudo systemctl enable whatsapp-slack-bot
sudo systemctl start whatsapp-slack-bot
sudo systemctl status whatsapp-slack-bot
```

### PM2 (Recomendado)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar bot
pm2 start whatsapp-slack-bot.js --name "whatsapp-bot"

# Ver logs
pm2 logs whatsapp-bot

# Configurar auto-start
pm2 startup
pm2 save
```

## Estructura del proyecto

```
anafre/
├── whatsapp-slack-bot.js    # Script principal
├── package.json             # Dependencias
├── .env                     # Configuración (crear desde .env.example)
├── .env.example            # Ejemplo de configuración
├── README.md               # Esta documentación
└── whatsapp-session/       # Directorio de sesión (se crea automáticamente)
```

## Troubleshooting

### El bot no encuentra el contacto
- Verifica que el nombre en `WHATSAPP_CONTACT_NAME` coincida exactamente
- Asegúrate de tener conversaciones recientes con el contacto

### Error de sesión de WhatsApp
- Ejecuta `HEADLESS=false npm run test` para re-autenticar
- Elimina la carpeta `whatsapp-session/` y vuelve a escanear el QR

### No llegan mensajes a Slack
- Verifica que la URL del webhook sea correcta
- Revisa que el canal de Slack tenga permisos correctos
- Comprueba los logs para ver errores específicos

### El cron no se ejecuta
- Verifica la zona horaria en `.env`
- Asegúrate de que el proceso esté corriendo continuamente
- Usa `DEBUG=true` para ver logs más detallados

## Logs

El bot genera logs con timestamp mostrando:
- Inicio y fin de ejecuciones
- Mensajes encontrados y enviados
- Errores y advertencias
- Estados de conexión a WhatsApp

Ejemplo:
```
[04/08/2025, 10:00:01] [INFO] Iniciando bot WhatsApp -> Slack
[04/08/2025, 10:00:15] [INFO] WhatsApp Web cargado correctamente
[04/08/2025, 10:00:18] [INFO] Contacto Anafre encontrado y seleccionado
[04/08/2025, 10:00:20] [INFO] Encontrados 2 mensajes de hoy
[04/08/2025, 10:00:22] [INFO] Mensajes enviados a Slack correctamente
```

## Limitaciones

- Requiere que WhatsApp Web esté disponible
- Necesita mantener la sesión de WhatsApp activa
- Solo funciona con mensajes de texto (no archivos multimedia)
- Requiere servidor/computadora corriendo 24/7 para el cron job

## Licencia

MIT