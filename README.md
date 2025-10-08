# 🌴 Geoportal de Puerto Rico

Sistema web interactivo para visualización de información geoespacial de Puerto Rico con funcionalidades de comentarios y subida segura de archivos.

![Puerto Rico](https://img.shields.io/badge/Puerto%20Rico-🇵🇷-blue)
![Flask](https://img.shields.io/badge/Flask-3.1.2-green)
![Security](https://img.shields.io/badge/Security-✅%20Validated-success)
![Render](https://img.shields.io/badge/Deploy-Render%20Ready-purple)

## 🚀 Características Principales

### 🗺️ **Mapa Interactivo**
- Visualización de Puerto Rico con Leaflet.js
- Datos GeoJSON con información de municipios y puntos de interés
- Zoom, pan y exploración intuitiva

### 💬 **Sistema de Comentarios**
- Comentarios por ubicación geográfica
- Almacenamiento en base de datos SQLite
- Panel administrativo para gestión

### 🛡️ **Seguridad Avanzada de Archivos**
- **Validación de tamaño**: Límite de 10MB por archivo
- **Filtro de extensiones**: Solo archivos seguros (PDF, imágenes, documentos)
- **Detección de magic numbers**: Previene archivos maliciosos disfrazados
- **Protección path traversal**: Nombres de archivos sanitizados
- **Hash SHA256**: Verificación de integridad
- **Logging completo**: Auditoría de todas las actividades

### 📊 **Panel Administrativo**
- Visualización de todos los comentarios
- Gestión de archivos subidos
- Navegación integrada con el mapa principal

## 🔧 Tecnologías Utilizadas

- **Backend**: Flask 3.1.2 (Python)
- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Mapas**: Leaflet.js 1.9.4
- **Base de datos**: SQLite (desarrollo) / PostgreSQL (producción recomendada)
- **Seguridad**: Werkzeug, Pillow, hashlib
- **Despliegue**: Docker, Gunicorn

## 🚀 Despliegue en Render

### Opción 1: Despliegue Directo (Recomendado)

1. **Conectar repositorio en Render:**
   - Ve a [render.com](https://render.com)
   - Crea una nueva "Web Service"
   - Conecta tu repositorio de GitHub

2. **Configuración en Render:**
   ```
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn --bind 0.0.0.0:$PORT app:app
   ```

3. **Variables de entorno en Render:**
   ```
   FLASK_ENV=production
   FLASK_DEBUG=False
   SECRET_KEY=tu_clave_secreta_muy_segura_aqui
   HOST=0.0.0.0
   PORT=10000
   MAX_FILE_SIZE=10485760
   ```

### Opción 2: Despliegue con Docker

Si prefieres usar Docker en Render:

1. En Render, selecciona "Deploy from Docker"
2. El `Dockerfile` incluido configurará todo automáticamente
3. Render detectará y construirá la imagen automáticamente

## 🛠️ Desarrollo Local

### Requisitos Previos

- Python 3.8+
- pip
- Git

### Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/mmelendezJPPR/Geoportal.git
   cd Geoportal
   ```

2. **Crear entorno virtual:**
   ```bash
   python -m venv .venv
   
   # Windows
   .venv\Scripts\activate
   
   # Linux/Mac
   source .venv/bin/activate
   ```

3. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   # Edita .env con tus configuraciones
   ```

5. **Ejecutar la aplicación:**
   ```bash
   python app.py
   ```

6. **Abrir en navegador:**
   ```
   http://localhost:5000
   ```

## 🔒 Características de Seguridad

### Validación de Archivos Multicapa

```python
# Ejemplo de la validación implementada:
✅ Validación de extensión
✅ Verificación de magic numbers  
✅ Límites de tamaño (10MB máximo)
✅ Sanitización de nombres de archivo
✅ Hash SHA256 para integridad
✅ Logging de todas las actividades
```

### Archivos Permitidos

- **Documentos**: PDF, DOC, DOCX, TXT
- **Imágenes**: PNG, JPG, JPEG, GIF
- **Límite de tamaño**: 10MB por archivo

### Archivos Rechazados Automáticamente

- Ejecutables (.exe, .bat, .sh, .cmd)
- Scripts (.js, .php, .py en uploads)
- Archivos sin extensión o extensión peligrosa
- Archivos con contenido que no coincide con su extensión

## 📁 Estructura del Proyecto

```
Geoportal/
├── app.py                 # Aplicación Flask principal
├── requirements.txt       # Dependencias Python
├── Dockerfile            # Configuración Docker
├── .env.example          # Variables de entorno ejemplo
├── .gitignore           # Archivos ignorados por Git
├── README.md            # Este archivo
├── data.geojson         # Datos geográficos de Puerto Rico
├── templates/           # Plantillas HTML
│   ├── index.html       # Página principal
│   └── adminPanel.html  # Panel administrativo
├── static/             # Archivos estáticos
│   ├── scripts.js      # JavaScript del frontend
│   ├── styles.css      # Estilos CSS (en templates)
│   └── JPlogo.png      # Logo de la Junta de Planificación
├── database/           # Base de datos (creada automáticamente)
├── uploads/            # Archivos subidos (creada automáticamente)
└── logs/              # Logs de seguridad (creada automáticamente)
```

## 🔧 Configuración Avanzada

### Variables de Entorno Disponibles

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `FLASK_ENV` | Entorno de Flask | `development` |
| `FLASK_DEBUG` | Modo debug | `True` |
| `SECRET_KEY` | Clave secreta de Flask | `dev-key-change-in-production` |
| `HOST` | Host del servidor | `127.0.0.1` |
| `PORT` | Puerto del servidor | `5000` |
| `DATABASE_URL` | URL de base de datos | `sqlite:///database/solicitudes.db` |
| `MAX_FILE_SIZE` | Tamaño máximo de archivo | `10485760` (10MB) |
| `UPLOAD_FOLDER` | Carpeta de uploads | `uploads` |

### Migración a PostgreSQL (Producción)

Para usar PostgreSQL en lugar de SQLite:

1. Instalar psycopg2: `pip install psycopg2-binary`
2. Configurar `DATABASE_URL`: `postgresql://user:pass@host:port/dbname`
3. El código se adaptará automáticamente

## 🚨 Monitoreo y Logs

### Logs de Seguridad

Todos los eventos de seguridad se registran en `logs/security.log`:

```
2025-10-08 15:45:22 - INFO - Archivo validado exitosamente: documento.pdf
2025-10-08 15:45:22 - INFO - Archivo subido desde IP 192.168.1.100
2025-10-08 15:45:30 - WARNING - Archivo rechazado: malware.exe (extensión no permitida)
```

### Monitoreo en Tiempo Real

```bash
# Monitorear logs en desarrollo
python monitor_simple.py

# En producción (Linux/Mac)
tail -f logs/security.log
```

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 👥 Equipo

**Junta de Planificación de Puerto Rico**
- Desarrollo y mantenimiento del sistema
- Gestión de datos geoespaciales
- Implementación de medidas de seguridad

## 📞 Soporte

Para soporte técnico o preguntas:

- **Issues**: Usa el sistema de issues de GitHub
- **Email**: [contacto@jp.pr.gov](mailto:contacto@jp.pr.gov)
- **Web**: [www.jp.pr.gov](https://www.jp.pr.gov)

---

## 🎯 Próximas Funcionalidades

- [ ] Autenticación de usuarios
- [ ] API REST completa
- [ ] Exportación de datos
- [ ] Integración con más capas de mapas
- [ ] Dashboard de analytics
- [ ] Notificaciones en tiempo real

---

**¡Hecho con ❤️ para Puerto Rico!** 🇵🇷