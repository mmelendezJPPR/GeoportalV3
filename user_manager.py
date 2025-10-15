#!/usr/bin/env python3
"""
Script de Gestión de Usuarios para Geoportal
Permite agregar, listar, eliminar y gestionar usuarios en la base de datos.
"""

import sqlite3
import sys
import os
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

# Configuración de la base de datos
DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'usuarios.db')

def get_db_connection():
    """Obtener conexión a la base de datos de usuarios"""
    return sqlite3.connect(DB_PATH)

def init_database():
    """Inicializar la base de datos si no existe"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    conn = get_db_connection()
    cursor = conn.cursor()

    # Crear tabla de usuarios si no existe
    cursor.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    )''')

    # Crear índice para búsquedas rápidas
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')

    conn.commit()
    conn.close()

def agregar_usuario(username, email, password):
    """Agregar un nuevo usuario"""
    if len(password) < 6:
        print("❌ Error: La contraseña debe tener al menos 6 caracteres")
        return False

    password_hash = generate_password_hash(password)
    created_at = datetime.now().isoformat()

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('''INSERT INTO users (username, email, password_hash, created_at)
                         VALUES (?, ?, ?, ?)''',
                      (username, email, password_hash, created_at))

        conn.commit()
        conn.close()

        print(f"✅ Usuario '{username}' agregado exitosamente")
        return True

    except sqlite3.IntegrityError as e:
        if 'username' in str(e):
            print(f"❌ Error: El usuario '{username}' ya existe")
        elif 'email' in str(e):
            print(f"❌ Error: El email '{email}' ya está registrado")
        else:
            print(f"❌ Error de integridad: {e}")
        return False
    except Exception as e:
        print(f"❌ Error al agregar usuario: {e}")
        return False

def listar_usuarios():
    """Listar todos los usuarios"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT id, username, email, created_at FROM users ORDER BY username')
        usuarios = cursor.fetchall()

        conn.close()

        if not usuarios:
            print("📝 No hay usuarios registrados")
            return

        print("\n👥 Lista de Usuarios:")
        print("-" * 70)
        print(f"{'ID':<3} {'Usuario':<20} {'Email':<30} {'Creado':<15}")
        print("-" * 70)

        for usuario in usuarios:
            user_id, username, email, created_at = usuario
            # Formatear fecha
            fecha = created_at.split('T')[0] if 'T' in created_at else created_at
            print(f"{user_id:<3} {username:<20} {email:<30} {fecha:<15}")

        print(f"\n📊 Total de usuarios: {len(usuarios)}")

    except Exception as e:
        print(f"❌ Error al listar usuarios: {e}")

def eliminar_usuario(username):
    """Eliminar un usuario"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar que el usuario existe
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        usuario = cursor.fetchone()

        if not usuario:
            print(f"❌ Error: Usuario '{username}' no encontrado")
            conn.close()
            return False

        # Eliminar usuario
        cursor.execute('DELETE FROM users WHERE username = ?', (username,))
        conn.commit()
        conn.close()

        print(f"✅ Usuario '{username}' eliminado exitosamente")
        return True

    except Exception as e:
        print(f"❌ Error al eliminar usuario: {e}")
        return False

def cambiar_password(username, new_password):
    """Cambiar la contraseña de un usuario"""
    if len(new_password) < 6:
        print("❌ Error: La contraseña debe tener al menos 6 caracteres")
        return False

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar que el usuario existe
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        usuario = cursor.fetchone()

        if not usuario:
            print(f"❌ Error: Usuario '{username}' no encontrado")
            conn.close()
            return False

        # Actualizar contraseña
        password_hash = generate_password_hash(new_password)
        cursor.execute('UPDATE users SET password_hash = ? WHERE username = ?',
                      (password_hash, username))

        conn.commit()
        conn.close()

        print(f"✅ Contraseña de '{username}' cambiada exitosamente")
        return True

    except Exception as e:
        print(f"❌ Error al cambiar contraseña: {e}")
        return False

def verificar_usuario(username, password):
    """Verificar credenciales de usuario"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT password_hash FROM users WHERE username = ?', (username,))
        usuario = cursor.fetchone()

        conn.close()

        if not usuario:
            print(f"❌ Usuario '{username}' no encontrado")
            return False

        if check_password_hash(usuario[0], password):
            print(f"✅ Credenciales válidas para '{username}'")
            return True
        else:
            print(f"❌ Contraseña incorrecta para '{username}'")
            return False

    except Exception as e:
        print(f"❌ Error al verificar usuario: {e}")
        return False

def mostrar_ayuda():
    """Mostrar ayuda del script"""
    print("""
🚀 Script de Gestión de Usuarios - Geoportal

📖 Uso: python user_manager.py <comando> [argumentos]

🎯 Comandos disponibles:

  add <usuario> <email> <password>    - Agregar nuevo usuario
  list                                - Listar todos los usuarios
  delete <usuario>                   - Eliminar usuario
  password <usuario> <nueva_pass>    - Cambiar contraseña
  verify <usuario> <password>        - Verificar credenciales
  help                               - Mostrar esta ayuda

📝 Ejemplos:
  python user_manager.py add admin admin@example.com admin123
  python user_manager.py list
  python user_manager.py delete admin
  python user_manager.py password admin nueva123
  python user_manager.py verify admin admin123

⚠️  Notas:
  - Las contraseñas deben tener al menos 6 caracteres
  - Los nombres de usuario y emails deben ser únicos
  - El script debe ejecutarse desde el directorio raíz del proyecto
""")

def main():
    """Función principal"""
    if len(sys.argv) < 2:
        mostrar_ayuda()
        sys.exit(1)

    comando = sys.argv[1].lower()

    # Inicializar base de datos
    init_database()

    if comando == 'add' and len(sys.argv) == 5:
        username, email, password = sys.argv[2], sys.argv[3], sys.argv[4]
        agregar_usuario(username, email, password)

    elif comando == 'list':
        listar_usuarios()

    elif comando == 'delete' and len(sys.argv) == 3:
        username = sys.argv[2]
        eliminar_usuario(username)

    elif comando == 'password' and len(sys.argv) == 4:
        username, new_password = sys.argv[2], sys.argv[3]
        cambiar_password(username, new_password)

    elif comando == 'verify' and len(sys.argv) == 4:
        username, password = sys.argv[2], sys.argv[3]
        verificar_usuario(username, password)

    elif comando == 'help':
        mostrar_ayuda()

    else:
        print("❌ Comando inválido o argumentos insuficientes")
        mostrar_ayuda()
        sys.exit(1)

if __name__ == '__main__':
    main()