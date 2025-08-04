#!/bin/bash

echo "🚀 Configurando WhatsApp to Slack Bot..."

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instálalo desde https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js encontrado: $(node --version)"

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error instalando dependencias"
    exit 1
fi

echo "✅ Dependencias instaladas correctamente"

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    echo "⚙️ Creando archivo de configuración..."
    cp .env.example .env
    echo "✅ Archivo .env creado. Por favor editarlo con tus configuraciones."
    echo ""
    echo "📝 Pasos siguientes:"
    echo "1. Edita el archivo .env con tu webhook de Slack"
    echo "2. Ejecuta 'HEADLESS=false npm run test' para configurar WhatsApp"
    echo "3. Escanea el código QR con tu teléfono"
    echo "4. Ejecuta 'npm start' para iniciar el bot"
else
    echo "⚠️ El archivo .env ya existe, no se sobrescribió"
fi

echo ""
echo "🎉 Setup completado!"
echo ""
echo "Comandos útiles:"
echo "  npm run test  - Ejecutar una vez (modo prueba)"
echo "  npm start     - Iniciar bot con cron job"
echo ""
echo "Para más información, consulta el README.md"