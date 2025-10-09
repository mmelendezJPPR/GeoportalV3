from flask import Flask, request, jsonify, send_from_directory, abort, render_template, make_response
import os, uuid, sqlite3, hashlib, logging
from datetime import datetime
from werkzeug.utils import secure_filename

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
    'txt': 'text/plain',
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
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

def validate_file_security(file):
    """Validar archivo por seguridad - detectar archivos corruptos o maliciosos"""
    try:
        # 1. Validar tamaño del archivo
        file.seek(0, 2)  # Ir al final del archivo
        file_size = file.tell()
        file.seek(0)  # Volver al inicio
        
        if file_size > MAX_FILE_SIZE:
            logging.warning(f"Archivo rechazado por tamaño excesivo: {file_size} bytes")
            return False, "Archivo demasiado grande (máximo 10MB)"
        
        if file_size == 0:
            logging.warning("Archivo rechazado por estar vacío")
            return False, "Archivo vacío"
        
        # 2. Sanitizar nombre de archivo
        filename = secure_filename(file.filename)
        if not filename:
            logging.warning("Archivo rechazado por nombre inválido")
            return False, "Nombre de archivo inválido"
        
        # 3. Validar extensión
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        if ext not in ALLOWED_EXTENSIONS:
            logging.warning(f"Archivo rechazado por extensión no permitida: {ext}")
            return False, f"Tipo de archivo no permitido. Permitidos: {', '.join(ALLOWED_EXTENSIONS.keys())}"
        
        # 4. Leer los primeros bytes para validar firma básica
        file_header = file.read(512)
        file.seek(0)  # Volver al inicio
        
        # Validar firma del archivo (básica)
        signature_valid = False
        detected_type = ext  # Por defecto usar la extensión
        
        for signature, file_type in FILE_SIGNATURES.items():
            if file_header.startswith(signature):
                detected_type = file_type
                signature_valid = True
                break
        
        # Para archivos de texto, permitir si no tienen firma binaria específica
        if not signature_valid and ext == 'txt':
            try:
                file_header.decode('utf-8')
                signature_valid = True
                detected_type = 'txt'
            except UnicodeDecodeError:
                logging.warning("Archivo de texto con encoding inválido")
                return False, "Archivo de texto con codificación inválida"
        
        # Para otros tipos, ser más permisivo pero registrar
        if not signature_valid:
            logging.warning(f"Archivo sin firma reconocida pero extensión permitida: {ext}")
            signature_valid = True  # Permitir pero con advertencia
        
        # 5. Validaciones específicas para imágenes (si PIL está disponible)
        if PIL_AVAILABLE and ext in ['png', 'jpg', 'jpeg', 'gif']:
            try:
                file.seek(0)
                with Image.open(file) as img:
                    # Verificar que la imagen se puede abrir correctamente
                    img.verify()
                file.seek(0)
            except Exception as e:
                logging.warning(f"Imagen corrupta rechazada: {str(e)}")
                return False, "Imagen corrupta o inválida"
        
        # 6. Calcular hash para logging
        file.seek(0)
        file_hash = hashlib.sha256(file.read()).hexdigest()
        file.seek(0)
        
        # Log exitoso
        logging.info(f"Archivo validado exitosamente: {filename}, Tipo: {detected_type}, Hash: {file_hash[:16]}...")
        
        return True, {"filename": filename, "type": detected_type, "hash": file_hash, "size": file_size}
    
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

        # Manejo de archivo (opcional)
        saved_file_path = ''
        if 'file' in request.files:
            f = request.files['file']
            if f and f.filename:
                is_valid, validation_result = validate_file_security(f)
                if not is_valid:
                    client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)
                    logging.warning(f"Intento de subida maliciosa desde IP {client_ip}: {validation_result}")
                    return jsonify({"error": f"Archivo rechazado: {validation_result}"}), 400

                safe_filename = validation_result['filename']
                file_ext = safe_filename.rsplit('.', 1)[1].lower() if '.' in safe_filename else ''
                unique_name = f"{uuid.uuid4().hex}.{file_ext}" if file_ext else uuid.uuid4().hex
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
                f.seek(0)
                f.save(save_path)
                saved_file_path = save_path

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

        return jsonify({
            "status": "ok",
            "comment_id": comment_id,
            "feature_id": feature_id,
            "lat": lat_f,
            "lng": lng_f
        })

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
