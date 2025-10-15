# 🚀 Guía de Configuración en Render

## Problema: No puedo iniciar sesión en Render

La base de datos SQLite es local y no se sube a GitHub. Necesitas crear un usuario administrador directamente en el servidor de Render.

## Solución: Crear Usuario Administrador en Render

### Opción 1: Usar el Shell de Render (RECOMENDADO)

1. **Ve a tu Dashboard de Render**
   - https://dashboard.render.com/
   - Selecciona tu servicio "geoportalv3"

2. **Abre el Shell**
   - En el menú lateral, haz clic en **"Shell"**
   - Esto abrirá una terminal en el servidor

3. **Ejecuta el script de creación de usuario**
   ```bash
   python create_admin.py admin admin@geoportal.pr TuContraseñaSegura123
   ```
   
   Reemplaza:
   - `admin` - con tu nombre de usuario deseado
   - `admin@geoportal.pr` - con tu email
   - `TuContraseñaSegura123` - con una contraseña segura

4. **Verifica que se creó correctamente**
   Deberías ver un mensaje como:
   ```
   ✅ Usuario administrador creado exitosamente!
      ID: 1
      Usuario: admin
      Email: admin@geoportal.pr
   ```

5. **Intenta iniciar sesión**
   - Ve a https://geoportalv3.onrender.com/login
   - Usa las credenciales que acabas de crear

### Opción 2: Modo Interactivo

Si prefieres el modo interactivo, ejecuta:
```bash
python create_admin.py
```

Y sigue las instrucciones en pantalla.

### Opción 3: Crear Localmente y Subir (NO RECOMENDADO)

⚠️ **No recomendado** porque la base de datos en Render se borra en cada despliegue.

## Verificación

Una vez creado el usuario, deberías poder:
1. Ir a https://geoportalv3.onrender.com/login
2. Ingresar tu username y password
3. Acceder al geoportal

## Solución de Problemas

### Error: "ModuleNotFoundError: No module named 'werkzeug'"
No debería ocurrir porque está en requirements.txt, pero si sucede:
```bash
pip install werkzeug
python create_admin.py admin admin@example.com password123
```

### Error: "database is locked"
Si la base de datos está bloqueada, espera unos segundos y vuelve a intentar.

### Error: "El usuario ya existe"
Si el usuario ya existe, puedes:
1. Usar un nombre de usuario diferente
2. O eliminar el usuario existente primero:
```bash
python -c "import sqlite3; conn = sqlite3.connect('database/usuarios.db'); conn.execute('DELETE FROM users WHERE username=\"admin\"'); conn.commit()"
```

## Alternativa: Base de Datos Externa

Para producción, considera usar una base de datos externa como:
- **PostgreSQL** (Render ofrece PostgreSQL gratis)
- **MySQL**
- **MongoDB**

Esto evitará que pierdas los datos en cada despliegue.

### Migrar a PostgreSQL en Render

1. Crea una base de datos PostgreSQL en Render
2. Instala `psycopg2-binary` en requirements.txt
3. Modifica el código para usar PostgreSQL en lugar de SQLite
4. Configura la variable de entorno `DATABASE_URL`

## Notas Importantes

⚠️ **IMPORTANTE**: La base de datos SQLite en Render es **temporal**. Se borra cada vez que:
- Haces un nuevo despliegue
- El servicio se reinicia
- Render mueve tu servicio a otro servidor

Para datos persistentes en producción, **usa PostgreSQL** o **MySQL**.

## Contacto

Si tienes problemas, revisa los logs en:
https://dashboard.render.com/ → tu servicio → "Logs"
