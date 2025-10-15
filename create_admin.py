#!/usr/bin/env python3
"""
Script para crear usuario administrador en la base de datos
Puede ser ejecutado localmente o en Render
"""
import sqlite3
import os
import sys
from datetime import datetime
from werkzeug.security import generate_password_hash

def get_config():
    """Obtener configuración de la base de datos"""
    return {
        'USERS_DB_FILE': os.getenv('USERS_DATABASE_URL', 'database/usuarios.db').replace('sqlite:///', '')
    }

def create_admin_user(username, email, password):
    """Crear usuario administrador en la base de datos"""
    try:
        config = get_config()
        db_file = config['USERS_DB_FILE']
        
        # Crear directorio si no existe
        db_dir = os.path.dirname(db_file)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)
        
        # Conectar a la base de datos
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Crear tabla si no existe
        cursor.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )''')
        
        # Crear índice
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')
        
        # Verificar si el usuario ya existe
        cursor.execute('SELECT id FROM users WHERE username = ? OR email = ?', (username, email))
        existing_user = cursor.fetchone()
        
        if existing_user:
            print(f"⚠️  El usuario '{username}' o email '{email}' ya existe.")
            print(f"   Si deseas cambiar la contraseña, elimina primero el usuario existente.")
            conn.close()
            return False
        
        # Hash de la contraseña
        password_hash = generate_password_hash(password)
        created_at = datetime.utcnow().isoformat()
        
        # Insertar usuario
        cursor.execute(
            'INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
            (username, email, password_hash, created_at)
        )
        
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        
        print(f"✅ Usuario administrador creado exitosamente!")
        print(f"   ID: {user_id}")
        print(f"   Usuario: {username}")
        print(f"   Email: {email}")
        print(f"   Fecha: {created_at}")
        print(f"\n🔐 Credenciales de acceso:")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print(f"\n⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creando usuario administrador: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Función principal"""
    print("=" * 60)
    print("  CREADOR DE USUARIO ADMINISTRADOR - GEOPORTAL V3")
    print("=" * 60)
    print()
    
    # Obtener credenciales
    if len(sys.argv) >= 4:
        # Argumentos desde línea de comandos
        username = sys.argv[1]
        email = sys.argv[2]
        password = sys.argv[3]
    else:
        # Modo interactivo
        print("Ingresa los datos del usuario administrador:")
        print()
        username = input("Username: ").strip()
        email = input("Email: ").strip()
        password = input("Password: ").strip()
    
    # Validaciones básicas
    if not username or not email or not password:
        print("❌ Error: Todos los campos son requeridos")
        sys.exit(1)
    
    if len(password) < 6:
        print("❌ Error: La contraseña debe tener al menos 6 caracteres")
        sys.exit(1)
    
    print()
    print(f"Creando usuario: {username} ({email})...")
    print()
    
    # Crear usuario
    success = create_admin_user(username, email, password)
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
