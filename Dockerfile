# Dockerfile para Geoportal Puerto Rico - Render
FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema para Pillow
RUN apt-get update && apt-get install -y \
    gcc \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p uploads logs database

# Configurar permisos
RUN chmod +x app.py

# Exponer puerto
EXPOSE 10000

# Variables de entorno por defecto
ENV FLASK_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000

# Comando para iniciar la aplicación
CMD ["gunicorn", "--bind", "0.0.0.0:10000", "--workers", "2", "--timeout", "120", "app:app"]