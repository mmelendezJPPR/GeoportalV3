# 🔐 Cambiar Usuario y Contraseña del Geoportal

## 📍 OPCIÓN 1: En Render (Producción) ⭐ RECOMENDADO

### Paso a Paso:

1. **Abre Render Dashboard:**
   - Ve a https://dashboard.render.com/
   - Inicia sesión con tu cuenta

2. **Selecciona tu servicio:**
   - Haz clic en **"geoportalv3"**

3. **Ve a Environment:**
   - En el menú lateral izquierdo, haz clic en **"Environment"**

4. **Agrega o edita estas variables:**
   ```
   ADMIN_USERNAME = AdminJP
   ADMIN_PASSWORD = TuContraseñaSegura123!
   SECRET_KEY = clave-secreta-aleatoria-cambiar
   ```

5. **Guarda los cambios:**
   - Haz clic en **"Save Changes"**
   - Render redesplegará automáticamente (2-3 minutos)

6. **Prueba el login:**
   - Ve a https://geoportalv3.onrender.com/login
   - Usa las credenciales que acabas de configurar

---

## 💻 OPCIÓN 2: En tu Computadora (Desarrollo Local)

### Método Fácil: Editar archivo .env

1. **Abre el archivo `.env`** en la raíz del proyecto:
   ```
   c:\Users\...\public_geoportal\.env
   ```

2. **Edita estas líneas:**
   ```bash
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin123
   ```

3. **Cambia los valores:**
   ```bash
   ADMIN_USERNAME=MiUsuario
   ADMIN_PASSWORD=MiContraseña123
   ```

4. **Guarda el archivo** (Ctrl + S)

5. **Reinicia la aplicación:**
   - Detén el servidor (Ctrl + C si está corriendo)
   - Ejecuta nuevamente: `python app.py`

---

## 🔒 Recomendaciones de Seguridad

### ✅ Contraseña Segura
- Mínimo 12 caracteres
- Combina mayúsculas, minúsculas, números y símbolos
- Ejemplo: `Geoportal#PR_2025!Admin`

### ✅ Secret Key Aleatoria
Para generar una clave secreta fuerte:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copia el resultado y úsalo como `SECRET_KEY`

---

## ⚠️ IMPORTANTE

### El archivo .env NO se sube a GitHub
- El archivo `.env` está en `.gitignore`
- Esto protege tus credenciales
- Cada entorno (local, Render) tiene sus propias credenciales

### En Render usa Environment Variables
- **NO pongas contraseñas en el código**
- Siempre usa las variables de entorno en Render
- Las variables de entorno son más seguras

---

## 🧪 Probar que funcionó

### Local:
1. Ejecuta: `python app.py`
2. Ve a http://127.0.0.1:5000/login
3. Ingresa tu usuario y contraseña
4. Deberías poder entrar ✅

### Render:
1. Ve a https://geoportalv3.onrender.com/login
2. Ingresa las credenciales que configuraste en Environment
3. Deberías poder entrar ✅

---

## 📋 Resumen Rápido

| Dónde | Cómo cambiar |
|-------|--------------|
| **Render** | Dashboard → Environment → Agregar `ADMIN_USERNAME` y `ADMIN_PASSWORD` |
| **Local** | Editar archivo `.env` en la raíz del proyecto |
| **Código** | ⚠️ NO CAMBIAR (usa variables de entorno) |

---

## 🆘 ¿Problemas?

### No puedo entrar después de cambiar
- Verifica que no haya espacios extra en usuario/contraseña
- Prueba en modo incógnito del navegador
- Revisa los logs de Render

### ¿Olvidé mi contraseña?
- En Render: Cambia la variable `ADMIN_PASSWORD`
- En Local: Edita el archivo `.env`
- No hay forma de "recuperar" la contraseña, solo cambiarla

### ¿Dónde veo los logs?
- Render: Dashboard → tu servicio → "Logs"
- Local: En la consola donde ejecutaste `python app.py`
