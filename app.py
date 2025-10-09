from flask import Flask, request, jsonify, send_from_directory, abort, render_template, make_response
import os, uuid, sqlite3, hashlib, logging, time
from datetime import datetime
from werkzeug.utils import secure_filename
import PyPDF2
import pdfplumber
import io

# Importar módulo de seguridad avanzada
try:
    from Security.security_manager import SecurityManager
    SECURITY_AVAILABLE = True
    print("Modulo de seguridad avanzada cargado exitosamente")
except ImportError:
    SECURITY_AVAILABLE = False
    print("Modulo de seguridad no disponible - usando validacion basica")

# Intentar importar PIL, si no está disponible, usar validación básica
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# Configuración para diferentes entornos
def get_config():
    return {
        'UPLOAD_FOLDER': os.getenv('UPLOAD_FOLDER', 'uploads'),
        'GEOJSON_FILE': os.getenv('GEOJSON_FILE', 'data.geojson'),
        'DB_FILE': os.getenv('DATABASE_URL', 'database/solicitudes.db').replace('sqlite:///', ''),
        'HOST': os.getenv('HOST', '127.0.0.1'),
        'PORT': int(os.getenv('PORT', 5000)),
        'DEBUG': os.getenv('FLASK_DEBUG', 'False').lower() == 'true',
        'SECRET_KEY': os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    }

config = get_config()
UPLOAD_FOLDER = config['UPLOAD_FOLDER']
GEOJSON_FILE = config['GEOJSON_FILE']
DB_FILE = config['DB_FILE']

# Configuración de seguridad para archivos
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {
    'pdf': 'application/pdf'
}

# Firmas de archivos (magic numbers) para validación
FILE_SIGNATURES = {
    b'\x89PNG\r\n\x1a\n': 'png',
    b'\xff\xd8\xff': 'jpg',
    b'GIF87a': 'gif',
    b'GIF89a': 'gif',
    b'%PDF': 'pdf',
    b'\xd0\xcf\x11\xe0': 'doc',  # MS Office
    b'PK\x03\x04': 'docx'  # ZIP-based (docx, xlsx, etc)
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs("logs", exist_ok=True)

# Configurar logging de seguridad
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/security.log'),
        logging.StreamHandler()
    ]
)

# Inicializar SecurityManager si está disponible
if SECURITY_AVAILABLE:
    security_manager = SecurityManager(UPLOAD_FOLDER)
    logging.info("SecurityManager inicializado con ClamAV y VirusTotal")
else:
    security_manager = None
    logging.warning("SecurityManager no disponible - usando validacion basica")

def init_database():
    """Initialize database - create directories and tables if they don't exist"""
    try:
        # Crear directorio de la base de datos si no existe
        db_dir = os.path.dirname(DB_FILE)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        
        # Crear tabla si no existe
        conn = sqlite3.connect(DB_FILE)
        conn.execute('''CREATE TABLE IF NOT EXISTS solicitudes (
            id TEXT PRIMARY KEY,
            feature_id TEXT,
            user TEXT,
            email TEXT,
            municipality TEXT,
            entity TEXT,
            text TEXT,
            file_path TEXT,
            created_at TEXT
        )''')
        
        # Verificar si necesitamos agregar las nuevas columnas (para compatibilidad con DBs existentes)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(solicitudes)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Agregar columnas nuevas si no existen
        if 'email' not in columns:
            conn.execute('ALTER TABLE solicitudes ADD COLUMN email TEXT')
        if 'municipality' not in columns:
            conn.execute('ALTER TABLE solicitudes ADD COLUMN municipality TEXT')
        if 'entity' not in columns:
            conn.execute('ALTER TABLE solicitudes ADD COLUMN entity TEXT')
        if 'status' not in columns:
            conn.execute('ALTER TABLE solicitudes ADD COLUMN status TEXT DEFAULT "new"')
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logging.error(f"Error inicializando base de datos: {e}")
        return False

def get_db_connection():
    """Get database connection, initializing if necessary"""
    init_database()  # Asegurar que la DB existe
    return sqlite3.connect(DB_FILE)

def validate_pdf_with_text(file):
    """
    Validación ESTRICTA de PDF - Solo acepta PDFs reales con texto extraíble.
    Rechaza PDFs de imagen escaneada y archivos falsos.
    """
    try:
        file.seek(0)
        file_content = file.read()
        file.seek(0)
        
        # 1. Verificar cabecera PDF válida
        if not file_content.startswith(b'%PDF-'):
            return False, "🚫 NO ES UN PDF VÁLIDO: Falta cabecera %PDF-"
        
        # 2. Verificar estructura básica PDF
        if b'%%EOF' not in file_content:
            return False, "🚫 PDF CORRUPTO: Falta marcador de fin de archivo"
        
        # 3. Usar PyPDF2 para validar estructura
        try:
            pdf_stream = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_stream)
            
            if len(pdf_reader.pages) == 0:
                return False, "🚫 PDF VACÍO: No contiene páginas"
                
        except Exception as e:
            return False, f"🚫 PDF INVÁLIDO: Error de estructura - {str(e)}"
        
        # 4. VALIDACIÓN CRÍTICA: Verificar que contiene texto extraíble
        try:
            # Reiniciar stream para pdfplumber
            pdf_stream = io.BytesIO(file_content)
            
            with pdfplumber.open(pdf_stream) as pdf:
                total_text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        total_text += page_text.strip()
                
                # Verificar que hay texto significativo (al menos 10 caracteres)
                if len(total_text.strip()) < 10:
                    return False, "🚫 PDF SIN TEXTO: Solo acepta documentos con texto, no imágenes escaneadas"
                
                # Verificar que no es solo espacios o caracteres especiales
                text_words = total_text.split()
                if len(text_words) < 3:
                    return False, "🚫 PDF INSUFICIENTE: Debe contener al menos 3 palabras de texto"
                
                logging.info(f"✅ PDF VÁLIDO: {len(total_text)} caracteres, {len(text_words)} palabras extraídas")
                print(f"✅ PDF VÁLIDO: {len(total_text)} caracteres, {len(text_words)} palabras extraídas")
                return True, f"✅ PDF válido con {len(text_words)} palabras de texto"
                
        except Exception as e:
            return False, f"🚫 ERROR EXTRAYENDO TEXTO: {str(e)} - Verifique que es un PDF válido"
            
    except Exception as e:
        return False, f"🚫 ERROR VALIDANDO PDF: {str(e)}"

def validate_file_security(file):
    """Validar archivo por seguridad - versión mejorada con SecurityManager"""
    try:
        logging.info("🔍 INICIANDO validate_file_security()")
        print("🔍 INICIANDO validate_file_security()")
        
        # Validaciones básicas primero
        file.seek(0, 2)  # Ir al final del archivo
        file_size = file.tell()
        file.seek(0)  # Volver al inicio
        
        logging.info(f"🔍 Archivo: {file.filename}, Tamaño: {file_size} bytes")
        print(f"🔍 Archivo: {file.filename}, Tamaño: {file_size} bytes")
        
        if file_size > MAX_FILE_SIZE:
            logging.warning(f"Archivo rechazado por tamaño excesivo: {file_size} bytes")
            return False, "Archivo demasiado grande (máximo 10MB)"
        
        if file_size == 0:
            logging.warning("Archivo rechazado por estar vacío")
            return False, "Archivo vacío"
        
        # Sanitizar nombre de archivo
        filename = secure_filename(file.filename)
        if not filename:
            logging.warning("Archivo rechazado por nombre inválido")
            return False, "Nombre de archivo inválido"
        
        logging.info(f"🔍 Nombre sanitizado: {filename}")
        print(f"🔍 Nombre sanitizado: {filename}")
        
        # Validar extensión
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            logging.warning(f"Archivo rechazado por extensión no permitida: {ext}")
            return False, f"Tipo de archivo no permitido. Permitidos: {', '.join(ALLOWED_EXTENSIONS.keys())}"
        
        # VALIDACIONES BÁSICAS DE SEGURIDAD ANTES DEL ESCANEO AVANZADO
        # 1. Extensiones ejecutables peligrosas (lista más completa)
        dangerous_extensions = [
            'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
            'app', 'deb', 'pkg', 'dmg', 'rpm', 'msi', 'run', 'sh', 'pl'
        ]
        
        if ext in dangerous_extensions:
            logging.warning(f"🚫 ARCHIVO EJECUTABLE RECHAZADO: {ext}")
            print(f"🚫 ARCHIVO EJECUTABLE RECHAZADO: {ext}")
            return False, f"🚫 ARCHIVO EJECUTABLE BLOQUEADO: .{ext} no está permitido por seguridad"
        
        # VALIDACIÓN ESTRICTA ESPECÍFICA POR TIPO DE ARCHIVO
        if ext == 'pdf':
            # Usar validación PDF estricta que requiere texto extraíble
            is_valid, message = validate_pdf_with_text(file)
            if not is_valid:
                logging.warning(f"🚫 PDF RECHAZADO: {message}")
                print(f"🚫 PDF RECHAZADO: {message}")
                return False, message
        
        # 2. Leer primeros bytes para detectar archivos malformados/corruptos
        file.seek(0)
        try:
            first_bytes = file.read(512)  # Leer primeros 512 bytes
            file.seek(0)  # Volver al inicio
            
            logging.info(f"DEBUG: Primeros 10 bytes de {filename}: {[hex(b) for b in first_bytes[:10]]}")
            
            # Detectar archivos con datos binarios sospechosos en extensiones de texto
            if ext in ['txt', 'csv'] and len(first_bytes) > 0:
                # Verificar si hay demasiados bytes no-ASCII (posible archivo binario con extensión falsa)
                non_ascii_count = sum(1 for byte in first_bytes if byte > 127 or (byte < 32 and byte not in [9, 10, 13]))
                ascii_percentage = (len(first_bytes) - non_ascii_count) / len(first_bytes) if len(first_bytes) > 0 else 0
                
                logging.info(f"DEBUG: {filename} - Bytes no-ASCII: {non_ascii_count}/{len(first_bytes)} ({ascii_percentage:.2%} ASCII)")
                
                if non_ascii_count > len(first_bytes) * 0.3:  # Más del 30% son caracteres raros
                    logging.warning(f"ARCHIVO SOSPECHOSO: {filename} - Demasiados caracteres binarios en archivo de texto")
                    return False, f"🚫 ARCHIVO CORRUPTO: El archivo parece contener datos binarios malformados"
            
            # Detectar archivos con firmas de ejecutables (magic numbers)
            dangerous_signatures = [
                (b'MZ', 'Ejecutable Windows'),      # Ejecutables Windows (.exe)
                (b'\x7fELF', 'Ejecutable Linux'),   # Ejecutables Linux (ELF)
                (b'PK\x03\x04', 'Archivo ZIP'),    # ZIP (puede contener ejecutables)
                (b'\xd0\xcf\x11\xe0', 'MS Office'), # Microsoft Office (puede contener macros)
            ]
            
            logging.info(f"🔍 Verificando firmas ejecutables para {filename}...")
            print(f"🔍 Verificando firmas ejecutables para {filename}...")
            
            for signature, desc in dangerous_signatures:
                logging.info(f"🔍 Comparando con {desc}: {signature} vs {first_bytes[:len(signature)]}")
                print(f"🔍 Comparando con {desc}: {signature} vs {first_bytes[:len(signature)]}")
                
                if first_bytes.startswith(signature):
                    logging.warning(f"🚫 FIRMA EJECUTABLE DETECTADA en {filename}: {desc}")
                    print(f"🚫 FIRMA EJECUTABLE DETECTADA en {filename}: {desc}")
                    return False, f"🚫 ARCHIVO EJECUTABLE DETECTADO: {desc} encontrado"
            
            logging.info(f"✅ No se detectaron firmas ejecutables en {filename}")
            print(f"✅ No se detectaron firmas ejecutables en {filename}")
                    
        except Exception as e:
            logging.warning(f"Error leyendo archivo {filename}: {e}")
            return False, f"🚫 ARCHIVO CORRUPTO: No se puede leer correctamente"
        
        # DESPUÉS DE VALIDACIONES BÁSICAS, PROCEDER CON ESCANEO AVANZADO
        # Si SecurityManager está disponible, usar escaneo avanzado
        if SECURITY_AVAILABLE and security_manager:
            print(f"[GEOPORTAL] Activando escaneo avanzado para: {filename}")
            logging.info(f"ACTIVANDO ESCANEO AVANZADO - Archivo: {filename}")
            
            # Guardar archivo temporalmente para escaneo
            temp_filename = f"temp_{int(time.time())}_{filename}"
            temp_path = os.path.join(UPLOAD_FOLDER, 'temp', temp_filename)
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            
            print(f"[GEOPORTAL] Guardando {filename} temporalmente para escaneo...")
            file.seek(0)
            file.save(temp_path)
            
            try:
                # Escaneo avanzado con SecurityManager
                scan_results = security_manager.scan_file(temp_path)
                
                if scan_results['final_decision'] == 'approved':
                    logging.info(f"Archivo aprobado por SecurityManager: {filename}")
                    # Mover archivo de temp a uploads principales
                    final_path = os.path.join(UPLOAD_FOLDER, filename)
                    if os.path.exists(final_path):
                        os.remove(final_path)
                    os.rename(temp_path, final_path)
                    
                    return True, {
                        "filename": filename, 
                        "type": ext, 
                        "scan_results": scan_results,
                        "security_level": "advanced"
                    }
                else:
                    logging.warning(f"Archivo rechazado por SecurityManager: {filename}")
                    # Limpiar archivo temporal
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
                    
                    return False, f"Archivo rechazado por motivos de seguridad: {scan_results['final_decision']}"
            
            except Exception as e:
                # En caso de error, limpiar y fallar de forma segura
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                logging.error(f"Error en escaneo avanzado: {e}")
                return False, "Error en validación de seguridad avanzada"
        
        else:
            # Usar validación básica original si SecurityManager no está disponible
            logging.info("Usando validación básica (SecurityManager no disponible)")
            
            # Validación básica de firmas de archivos
            file_header = file.read(512)
            file.seek(0)
            
            signature_valid = False
            detected_type = ext
            
            for signature, file_type in FILE_SIGNATURES.items():
                if file_header.startswith(signature):
                    detected_type = file_type
                    signature_valid = True
                    break
            
            if not signature_valid and ext == 'txt':
                try:
                    file_header.decode('utf-8')
                    signature_valid = True
                    detected_type = 'txt'
                except UnicodeDecodeError:
                    logging.warning("Archivo de texto con encoding inválido")
                    return False, "Archivo de texto con codificación inválida"
            
            if not signature_valid:
                logging.warning(f"Archivo sin firma reconocida pero extensión permitida: {ext}")
                signature_valid = True
            
            # Validaciones de imagen con PIL si está disponible
            if PIL_AVAILABLE and ext in ['png', 'jpg', 'jpeg', 'gif']:
                try:
                    file.seek(0)
                    with Image.open(file) as img:
                        img.verify()
                    file.seek(0)
                except Exception as e:
                    logging.warning(f"Imagen corrupta rechazada: {str(e)}")
                    return False, "Imagen corrupta o inválida"
            
            # Calcular hash para logging
            file.seek(0)
            file_hash = hashlib.sha256(file.read()).hexdigest()
            file.seek(0)
            
            logging.info(f"Archivo validado con método básico: {filename}, Hash: {file_hash[:16]}...")
            
            return True, {
                "filename": filename, 
                "type": detected_type, 
                "hash": file_hash, 
                "size": file_size,
                "security_level": "basic"
            }
    
    except Exception as e:
        logging.error(f"Error en validación de archivo: {str(e)}")
        return False, "Error interno en la validación del archivo"

# Crear aplicación Flask con configuración
app = Flask(__name__, static_folder="static", static_url_path="/static")

# Configurar Flask para producción
app.config.update({
    'SECRET_KEY': config['SECRET_KEY'],
    'UPLOAD_FOLDER': UPLOAD_FOLDER,
    'MAX_CONTENT_LENGTH': MAX_FILE_SIZE,
    'DEBUG': config['DEBUG']
})

# Crear directorios necesarios al inicializar la app
def create_directories():
    """Crear directorios necesarios para la aplicación"""
    directories = [
        config['UPLOAD_FOLDER'],
        'logs',
        os.path.dirname(DB_FILE) if os.path.dirname(DB_FILE) else None
    ]
    
    for directory in directories:
        if directory:
            try:
                os.makedirs(directory, exist_ok=True)
            except Exception as e:
                print(f"Warning: No se pudo crear directorio {directory}: {e}")

# Crear directorios al importar el módulo
create_directories()

@app.route("/")
def index():
    response = make_response(render_template("index.html"))
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route("/test")
def test():
    from datetime import datetime
    response = make_response(render_template("test.html", current_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    response.headers['Content-Type'] = 'text/html; charset=utf-8'
    return response

@app.route("/admin")
def admin_panel():
    return render_template("adminPanel.html")

@app.route("/data.geojson")
def geojson():
    if os.path.exists(GEOJSON_FILE):
        return send_from_directory(".", GEOJSON_FILE)
    abort(404)

@app.route("/comments/<feature_id>", methods=["GET"])
def get_comments(feature_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, feature_id, user, email, municipality, entity, text, file_path, created_at FROM solicitudes WHERE feature_id = ?", (feature_id,))
    rows = cursor.fetchall()
    conn.close()
    # Convert to dict format
    result = []
    for row in rows:
        result.append({
            "comment_id": row[0],
            "feature_id": row[1],
            "user": row[2],
            "email": row[3],
            "municipality": row[4],
            "entity": row[5],
            "text": row[6],
            "file_path": row[7],
            "created_at": row[8]
        })
    return jsonify(result)

@app.route("/comment", methods=["POST"])
def post_comment():
    feature_id = request.form.get("feature_id")
    user = request.form.get("user", "")
    email = request.form.get("email", "")
    municipality = request.form.get("municipality", "")
    entity = request.form.get("entity", "")
    text = request.form.get("text", "")
    
    if not feature_id:
        return jsonify({"error":"feature_id requerido"}), 400
    if not user:
        return jsonify({"error":"Nombre es requerido"}), 400
    if not email:
        return jsonify({"error":"Correo electrónico es requerido"}), 400
    if not municipality:
        return jsonify({"error":"Municipio de residencia es requerido"}), 400
    if not text:
        return jsonify({"error":"Comentarios son requeridos"}), 400

    file_path = ""
    if 'file' in request.files:
        f = request.files['file']
        if f.filename:
            # Validar archivo por seguridad
            is_valid, validation_result = validate_file_security(f)
            
            if not is_valid:
                # Log intento malicioso
                client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
                logging.warning(f"Intento de subida maliciosa desde IP {client_ip}: {validation_result}")
                return jsonify({"error": f"Archivo rechazado: {validation_result}"}), 400
            
            # Archivo válido - proceder con la subida
            file_info = validation_result
            safe_filename = file_info['filename']
            file_ext = safe_filename.rsplit('.', 1)[1].lower()
            
            # Generar nombre único pero conservando la extensión original
            unique_name = f"{uuid.uuid4().hex}.{file_ext}"
            save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
            
            # Guardar archivo
            f.seek(0)  # Asegurar que estamos al inicio del archivo
            f.save(save_path)
            file_path = save_path
            
            # Log subida exitosa
            client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
            logging.info(f"Archivo subido exitosamente desde IP {client_ip}: {safe_filename} -> {unique_name}")

    comment_id = uuid.uuid4().hex
    created_at = datetime.utcnow().isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""INSERT INTO solicitudes 
                      (id, feature_id, user, email, municipality, entity, text, file_path, created_at) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                   (comment_id, feature_id, user, email, municipality, entity, text, file_path, created_at))
    conn.commit()
    conn.close()

    return jsonify({"status":"ok","comment_id":comment_id})

@app.route('/api/comments', methods=["GET"])
def get_all_comments():
    """Obtener todos los comentarios para el panel de admin"""
    import json
    
    # Cargar datos GeoJSON para obtener los títulos y coordenadas
    feature_data = {}
    if os.path.exists(GEOJSON_FILE):
        with open(GEOJSON_FILE, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
            for feature in geojson_data.get('features', []):
                feature_uid = feature.get('properties', {}).get('feature_uid')
                title = feature.get('properties', {}).get('title', 'Sin título')
                coordinates = feature.get('geometry', {}).get('coordinates', [])
                if feature_uid:
                    feature_data[feature_uid] = {
                        'title': title,
                        'coordinates': coordinates  # [lng, lat]
                    }
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, feature_id, user, email, municipality, entity, text, file_path, created_at, status FROM solicitudes ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        feature_id = row[1]
        feature_info = feature_data.get(feature_id, {})
        feature_title = feature_info.get('title', f"Ubicación {feature_id}")
        coordinates = feature_info.get('coordinates', [])
        
        result.append({
            "comment_id": row[0],
            "feature_id": feature_id,
            "feature_title": feature_title,
            "user": row[2],
            "email": row[3],
            "municipality": row[4],
            "entity": row[5],
            "text": row[6],
            "file_path": row[7],
            "created_at": row[8],
            "coordinates": coordinates,  # [lng, lat]
            "lat": coordinates[1] if len(coordinates) >= 2 else None,
            "lng": coordinates[0] if len(coordinates) >= 2 else None,
            "status": row[9] if row[9] else "new"  # Usar status de la base de datos o "new" por defecto
        })
    return jsonify(result)

@app.route('/api/comments/<comment_id>/status', methods=["PUT"])
def update_comment_status(comment_id):
    """Actualizar el estado de un comentario"""
    data = request.get_json()
    status = data.get('status', 'pending')
    
    # Por ahora solo devolvemos éxito, puedes implementar la lógica de actualización después
    return jsonify({"status": "ok", "message": f"Estado actualizado a {status}"})

@app.route('/api/comments/<comment_id>', methods=["DELETE"])
def delete_comment(comment_id):
    """Eliminar un comentario/solicitud por ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Primero obtener información del archivo asociado antes de eliminar
        cursor.execute("SELECT file_path FROM solicitudes WHERE id = ?", (comment_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return jsonify({"status": "error", "message": "Solicitud no encontrada"}), 404
        
        file_path = result[0]
        
        # Eliminar el registro de la base de datos
        cursor.execute("DELETE FROM solicitudes WHERE id = ?", (comment_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({"status": "error", "message": "No se pudo eliminar la solicitud"}), 400
        
        conn.commit()
        conn.close()
        
        # Eliminar archivo asociado si existe
        if file_path:
            full_file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_path)
            try:
                if os.path.exists(full_file_path):
                    os.remove(full_file_path)
                    logging.info(f"Archivo eliminado: {full_file_path}")
            except OSError as e:
                logging.error(f"Error eliminando archivo {full_file_path}: {e}")
                # No fallar la operación si no se puede eliminar el archivo
        
        logging.info(f"Solicitud eliminada: {comment_id}")
        return jsonify({"status": "ok", "message": "Solicitud eliminada correctamente"})
        
    except Exception as e:
        logging.error(f"Error eliminando solicitud {comment_id}: {e}")
        return jsonify({"status": "error", "message": "Error interno del servidor"}), 500

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Ruta explícita para CSS (debug)
@app.route('/static/styles.css')
def css_file():
    return send_from_directory('static', 'styles.css', mimetype='text/css')

# Ruta explícita para JS (debug)
@app.route('/static/scripts.js')
def js_file():
    return send_from_directory('static', 'scripts.js', mimetype='application/javascript')

# Ruta para escanear archivo ANTES de envío
@app.route('/scan-file', methods=['POST'])
def scan_file():
    """Escanea un archivo por seguridad ANTES de procesar la solicitud"""
    logging.info("🔍 Endpoint /scan-file llamado")
    try:
        # Verificar que se recibió un archivo
        if 'file' not in request.files:
            logging.warning("No se recibió archivo en request.files")
            return jsonify({"status": "error", "error": "No se recibió archivo"}), 400
        
        file = request.files['file']
        logging.info(f"Archivo recibido: {file.filename}")
        
        if file.filename == '':
            logging.warning("Archivo sin nombre")
            return jsonify({"status": "error", "error": "No se seleccionó archivo"}), 400
        
        # Validar archivo
        logging.info("Iniciando validación de seguridad...")
        is_valid, result = validate_file_security(file)
        logging.info(f"Resultado validación: {is_valid}, {result}")
        
        if is_valid:
            return jsonify({
                "status": "ok", 
                "message": "Archivo escaneado exitosamente",
                "scan_results": result,
                "file_data": {
                    "filename": result["filename"],
                    "type": result["type"],
                    "security_level": result["security_level"]
                }
            })
        else:
            return jsonify({"status": "error", "error": result}), 400
            
    except Exception as e:
        logging.error(f"Error escaneando archivo: {str(e)}")
        return jsonify({"status": "error", "error": f"Error interno: {str(e)}"}), 500

# Ruta para manejar el envío del formulario público
@app.route('/upload', methods=['POST'])
def upload_request():
    """Recibe la solicitud del formulario con lat/lng y datos del usuario.
    - Guarda archivo (opcional) con validación de seguridad
    - Inserta registro en SQLite
    - Anexa punto al GeoJSON para visualizarlo en el mapa
    """
    try:
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        municipality = request.form.get('municipality', '').strip()
        entity = request.form.get('entity', '').strip()
        comments = request.form.get('comments', '').strip()
        lat = request.form.get('lat', '').strip()
        lng = request.form.get('lng', '').strip()

        # Validaciones básicas
        required = {
            'name': name,
            'email': email,
            'municipality': municipality,
            'entity': entity,
            'comments': comments,
            'lat': lat,
            'lng': lng,
        }
        for key, value in required.items():
            if not value:
                return jsonify({"error": f"Campo requerido faltante: {key}"}), 400

        try:
            lat_f = float(lat)
            lng_f = float(lng)
        except ValueError:
            return jsonify({"error": "Coordenadas inválidas"}), 400

        # Manejo de archivo (opcional) - archivo ya fue escaneado en /scan-file
        saved_file_path = ''
        security_info = None
        
        if 'file' in request.files:
            f = request.files['file']
            if f and f.filename:
                # El archivo ya fue validado en /scan-file, solo guardarlo
                safe_filename = secure_filename(f.filename)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                safe_filename = f"{timestamp}_{safe_filename}"
                file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
                f.save(file_path)
                saved_file_path = file_path
                
                security_info = {
                    'security_level': 'pre-scanned',
                    'scanned': True,
                    'filename': safe_filename
                }

        # Preparar IDs y timestamp
        comment_id = uuid.uuid4().hex
        feature_hash = hashlib.sha1(f"{lat_f},{lng_f}".encode('utf-8')).hexdigest()[:12]
        feature_id = f"point-{feature_hash}"
        created_at = datetime.utcnow().isoformat()

        # Guardar en SQLite
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO solicitudes (id, feature_id, user, email, municipality, entity, text, file_path, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (comment_id, feature_id, name, email, municipality, entity, comments, saved_file_path, created_at)
        )
        conn.commit()
        conn.close()

        # Anexar al GeoJSON para visualización (no bloqueante)
        try:
            import json
            geojson_path = GEOJSON_FILE
            if not os.path.exists(geojson_path):
                base = {"type": "FeatureCollection", "features": []}
            else:
                with open(geojson_path, 'r', encoding='utf-8') as f:
                    base = json.load(f)
                    if base.get('type') != 'FeatureCollection':
                        base = {"type": "FeatureCollection", "features": []}

            feature = {
                "type": "Feature",
                "properties": {
                    "feature_uid": feature_id,
                    "title": entity or municipality or name,
                    "name": name,
                    "municipality": municipality,
                    "entity": entity,
                    "comments": comments,
                    "timestamp": created_at
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [lng_f, lat_f]
                }
            }
            base.setdefault('features', []).append(feature)
            with open(geojson_path, 'w', encoding='utf-8') as f:
                json.dump(base, f, ensure_ascii=False, indent=2)
        except Exception as geo_err:
            logging.warning(f"No se pudo escribir en GeoJSON: {geo_err}")

        # Crear respuesta con información de seguridad
        response_data = {
            "status": "ok",
            "comment_id": comment_id,
            "feature_id": feature_id,
            "lat": lat_f,
            "lng": lng_f
        }
        
        # Agregar información de seguridad si se escaneó un archivo
        if security_info:
            response_data["security"] = {
                "scanned": True,
                "level": security_info['security_level'],
                "message": f"🛡️ Archivo escaneado con seguridad {security_info['security_level']}"
            }
            logging.info(f"✅ SOLICITUD COMPLETADA CON SEGURIDAD - ID: {comment_id}, Archivo: {security_info['filename']}")
        else:
            logging.info(f"✅ SOLICITUD COMPLETADA - ID: {comment_id} (sin archivo)")
        
        return jsonify(response_data)

    except Exception:
        logging.exception("Error procesando /upload")
        return jsonify({"error": "Error interno"}), 500

if __name__ == "__main__":
    # Asegurar que los directorios existen
    os.makedirs(config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    os.makedirs('database', exist_ok=True)
    
    # Ejecutar la aplicación
    app.run(
        host=config['HOST'], 
        port=config['PORT'], 
        debug=config['DEBUG']
    )
