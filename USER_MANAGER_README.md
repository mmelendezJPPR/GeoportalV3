# Script de Gestión de Usuarios - Geoportal

Este script permite gestionar usuarios en la base de datos del sistema de geoportal de manera sencilla desde línea de comandos.

## 🚀 Instalación

El script utiliza las mismas dependencias que la aplicación Flask. Asegúrate de tener instalado:

```bash
pip install werkzeug
```

## 📖 Uso

```bash
python user_manager.py <comando> [argumentos]
```

## 🎯 Comandos Disponibles

### Agregar Usuario
```bash
python user_manager.py add <usuario> <email> <password>
```
**Ejemplo:**
```bash
python user_manager.py add juanperez juan@example.com miClave123
```

### Listar Usuarios
```bash
python user_manager.py list
```
Muestra una tabla con todos los usuarios registrados, incluyendo ID, nombre de usuario, email y fecha de creación.

### Cambiar Contraseña
```bash
python user_manager.py password <usuario> <nueva_password>
```
**Ejemplo:**
```bash
python user_manager.py password juanperez nuevaClave456
```

### Verificar Credenciales
```bash
python user_manager.py verify <usuario> <password>
```
Verifica si un usuario y contraseña son válidos.

### Eliminar Usuario
```bash
python user_manager.py delete <usuario>
```
**Ejemplo:**
```bash
python user_manager.py delete juanperez
```

### Ayuda
```bash
python user_manager.py help
```
Muestra información completa sobre todos los comandos disponibles.

## ⚠️ Notas Importantes

- **Contraseñas**: Deben tener al menos 6 caracteres
- **Unicidad**: Los nombres de usuario y emails deben ser únicos
- **Ubicación**: El script debe ejecutarse desde el directorio raíz del proyecto
- **Base de datos**: Se crea automáticamente si no existe

## 🔐 Seguridad

- Las contraseñas se almacenan hasheadas usando `werkzeug.security`
- Los datos sensibles se manejan de forma segura
- La base de datos incluye índices para búsquedas eficientes

## 📊 Ejemplos de Uso Completo

```bash
# Agregar usuarios
python user_manager.py add admin admin@junta.go.cr admin123
python user_manager.py add operador operador@junta.go.cr op456789

# Listar usuarios
python user_manager.py list

# Cambiar contraseña
python user_manager.py password admin nuevaAdmin123

# Verificar credenciales
python user_manager.py verify admin nuevaAdmin123

# Eliminar usuario (si es necesario)
python user_manager.py delete operador
```

## 🛠️ Solución de Problemas

### Error de importación
Asegúrate de tener instaladas las dependencias:
```bash
pip install werkzeug
```

### Base de datos no encontrada
El script crea automáticamente la base de datos si no existe.

### Usuario ya existe
Cada nombre de usuario y email debe ser único en el sistema.

## 📁 Estructura de Archivos

```
public_geoportal/
├── user_manager.py          # Script de gestión de usuarios
├── database/
│   └── usuarios.db         # Base de datos SQLite de usuarios
└── README.md              # Esta documentación
```