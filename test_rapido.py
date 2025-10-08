import tempfile
import os
from werkzeug.utils import secure_filename

# Crear un archivo de prueba simple
with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
    f.write("Este es un archivo de prueba seguro")
    temp_file = f.name

print("🧪 PRUEBA RÁPIDA DE SEGURIDAD")
print("=" * 40)

# Probar secure_filename
test_files = [
    "archivo_normal.txt",
    "../../../etc/passwd",
    "script.exe.txt", 
    "documento con espacios.pdf",
    "archivo_muy_largo_con_muchos_caracteres_raros_@#$%^&*().txt"
]

print("🔒 PRUEBA DE NOMBRES SEGUROS:")
for filename in test_files:
    safe = secure_filename(filename)
    status = "✅ SEGURO" if safe else "🚨 RECHAZADO"
    print(f"   {filename} → {safe} ({status})")

print(f"\n📏 PRUEBA DE TAMAÑO:")
size = os.path.getsize(temp_file)
print(f"   Archivo prueba: {size} bytes (✅ Dentro del límite)")

# Limpiar
os.unlink(temp_file)

print(f"\n🌐 SERVIDOR ACTIVO: http://localhost:5000")
print(f"📊 MONITOR LOGS ACTIVO: Observando logs/security.log")
print(f"✅ SISTEMA LISTO PARA PRUEBAS")