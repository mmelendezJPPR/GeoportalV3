# 🚀 Configuración Simple en Render

## ✅ Sistema de Login Simplificado (Sin Base de Datos de Usuarios)

Tu aplicación ahora usa un **sistema de login simple** con credenciales configuradas mediante **variables de entorno**. 
**No necesitas crear usuarios en SQLite ni PostgreSQL.**

---

## 📝 Configurar Credenciales en Render

### Paso 1: Ve a tu Dashboard de Render
1. Abre https://dashboard.render.com/
2. Selecciona tu servicio **"geoportalv3"**

### Paso 2: Configurar Variables de Entorno
1. En el menú lateral, haz clic en **"Environment"**
2. Agrega estas variables:

```
ADMIN_USERNAME = tu_usuario_admin
ADMIN_PASSWORD = tu_contraseña_segura_123
SECRET_KEY = clave-secreta-para-sesiones-cambiar
```

**Ejemplo:**
```
ADMIN_USERNAME = AdminJP
ADMIN_PASSWORD = GeoportalPR2025!
SECRET_KEY = jp-geoportal-secret-key-2025-render
```

3. Haz clic en **"Save Changes"**
4. El servicio se **redesplegará automáticamente** (2-3 minutos)

### Paso 3: ¡Listo! Prueba el Login
1. Ve a https://geoportalv3.onrender.com/login
2. Ingresa el usuario y contraseña que configuraste
3. ¡Deberías poder entrar! 🎉

---

## 🔐 Recomendaciones de Seguridad

### Contraseña Segura
✅ **Usa una contraseña fuerte:**
- Mínimo 12 caracteres
- Combina mayúsculas, minúsculas, números y símbolos
- Ejemplo: `Geoportal#PR_2025!Admin`

### Secret Key
✅ **Genera una clave secreta aleatoria:**
```bash
# En tu terminal local:
python -c "import secrets; print(secrets.token_urlsafe(32))"
```
Copia el resultado y úsalo como `SECRET_KEY`

---

## 🆘 Solución de Problemas

### No puedo iniciar sesión
1. Verifica que las variables `ADMIN_USERNAME` y `ADMIN_PASSWORD` estén configuradas en Render
2. Asegúrate de que no haya espacios extra en el username o password
3. Revisa los logs en Render: Dashboard → tu servicio → "Logs"
4. Busca mensajes como: `⚠️ Intento de login fallido`

### El sitio me redirige a /login constantemente
- Verifica que `SECRET_KEY` esté configurada
- Prueba en modo incógnito (las cookies pueden estar corruptas)
- Limpia las cookies del navegador para el sitio

---

## 📊 Base de Datos de Solicitudes

### SQLite (Actual - TEMPORAL)
- Las solicitudes de usuarios se guardan en SQLite
- ⚠️ **Se pierden en cada redespliegue**
- Solo para desarrollo/testing

### PostgreSQL (Recomendado para Producción)
Si quieres que las solicitudes sean permanentes:
1. En Render: Dashboard → New → PostgreSQL
2. Conecta la base de datos PostgreSQL a tu servicio
3. Render configurará automáticamente `DATABASE_URL`
4. El código detectará PostgreSQL y lo usará automáticamente

---

## 📞 Contacto

Si tienes problemas, revisa los logs en:
https://dashboard.render.com/ → tu servicio → "Logs"

Busca mensajes de error o líneas que digan:
- `✅ Login exitoso` → Login funcionó correctamente
- `⚠️ Intento de login fallido` → Credenciales incorrectas

⚠️ **IMPORTANTE**: La base de datos SQLite en Render es **temporal**. Se borra cada vez que:
- Haces un nuevo despliegue
- El servicio se reinicia
- Render mueve tu servicio a otro servidor

Para datos persistentes en producción, **usa PostgreSQL** o **MySQL**.

## Contacto

Si tienes problemas, revisa los logs en:
https://dashboard.render.com/ → tu servicio → "Logs"
