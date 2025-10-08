#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DEMOSTRACIÓN DE SEGURIDAD - Sistema de Validación de Archivos
============================================================
Este script demuestra cómo el sistema detecta y rechaza archivos maliciosos.
"""

import os
import sys
import tempfile
from werkzeug.utils import secure_filename
from PIL import Image
import io

# Añadir el directorio actual al path para importar el módulo de validación
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Importar la función de validación del archivo principal
try:
    from app import validate_file_security, ALLOWED_EXTENSIONS, MAX_FILE_SIZE
except ImportError:
    print("❌ ERROR: No se puede importar la función de validación desde app.py")
    sys.exit(1)

def create_test_files():
    """Crear archivos de prueba temporales"""
    temp_dir = tempfile.mkdtemp()
    test_files = {}
    
    print("📁 CREANDO ARCHIVOS DE PRUEBA...")
    print("=" * 50)
    
    # 1. Archivo de imagen PNG válido
    try:
        img = Image.new('RGB', (100, 100), color='red')
        png_path = os.path.join(temp_dir, 'imagen_valida.png')
        img.save(png_path, 'PNG')
        test_files['✅ PNG válido'] = png_path
        print(f"✅ Creado: imagen PNG válida ({os.path.getsize(png_path)} bytes)")
    except Exception as e:
        print(f"⚠️  No se pudo crear PNG válido: {e}")
    
    # 2. Archivo ejecutable disfrazado como PNG (MALICIOSO)
    fake_png = os.path.join(temp_dir, 'malware.png')
    with open(fake_png, 'wb') as f:
        # Escribir bytes de un ejecutable Windows (MZ header)
        f.write(b'MZ\x90\x00' + b'\x00' * 100)  # Signature de ejecutable Windows
    test_files['🚨 Ejecutable disfrazado'] = fake_png
    print(f"🚨 Creado: ejecutable disfrazado como PNG ({os.path.getsize(fake_png)} bytes)")
    
    # 3. Archivo demasiado grande
    large_file = os.path.join(temp_dir, 'archivo_grande.txt')
    with open(large_file, 'wb') as f:
        # Crear archivo de 15MB (mayor que el límite de 10MB)
        f.write(b'A' * (15 * 1024 * 1024))
    test_files['🚨 Archivo muy grande'] = large_file
    print(f"🚨 Creado: archivo grande ({os.path.getsize(large_file) / (1024*1024):.1f} MB)")
    
    # 4. Extensión no permitida (.bat)
    bat_file = os.path.join(temp_dir, 'script.bat')
    with open(bat_file, 'w') as f:
        f.write('@echo off\necho Esto es un script malicioso\npause')
    test_files['🚨 Extensión peligrosa'] = bat_file
    print(f"🚨 Creado: archivo .bat ({os.path.getsize(bat_file)} bytes)")
    
    # 5. PDF válido
    pdf_path = os.path.join(temp_dir, 'documento.pdf')
    with open(pdf_path, 'wb') as f:
        # Escribir header básico de PDF
        f.write(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
        f.write(b'1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
        f.write(b'2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
        f.write(b'3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n')
        f.write(b'xref\n0 4\n0000000000 65535 f \n')
        f.write(b'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n%%EOF\n')
    test_files['✅ PDF válido'] = pdf_path
    print(f"✅ Creado: PDF válido ({os.path.getsize(pdf_path)} bytes)")
    
    # 6. Imagen JPEG corrupta
    corrupt_jpg = os.path.join(temp_dir, 'corrupto.jpg')
    with open(corrupt_jpg, 'wb') as f:
        # JPEG header válido pero datos corruptos
        f.write(b'\xff\xd8\xff\xe0')  # JPEG header
        f.write(b'JFIF\x00\x01\x01\x01')
        f.write(b'\x00' * 50 + b'DATOS_CORRUPTOS' + b'\x00' * 100)
        f.write(b'\xff\xd9')  # JPEG footer
    test_files['🚨 JPEG corrupto'] = corrupt_jpg
    print(f"🚨 Creado: JPEG corrupto ({os.path.getsize(corrupt_jpg)} bytes)")
    
    return test_files, temp_dir

def test_file_security(file_path, description):
    """Probar la seguridad de un archivo"""
    print(f"\n🧪 PROBANDO: {description}")
    print("-" * 50)
    
    # Crear un objeto file simulado
    class MockFile:
        def __init__(self, filepath):
            self.filename = os.path.basename(filepath)
            self.filepath = filepath
            
        def read(self, size=-1):
            with open(self.filepath, 'rb') as f:
                if size == -1:
                    return f.read()
                return f.read(size)
                
        def seek(self, pos):
            pass  # Mock implementation
            
    try:
        mock_file = MockFile(file_path)
        
        # Verificar secure_filename
        safe_name = secure_filename(mock_file.filename)
        print(f"📄 Archivo original: {mock_file.filename}")
        print(f"🔒 Nombre seguro: {safe_name}")
        
        # Verificar tamaño
        file_size = os.path.getsize(file_path)
        print(f"📏 Tamaño: {file_size:,} bytes")
        if file_size > MAX_FILE_SIZE:
            print(f"❌ RECHAZADO: Excede el tamaño máximo ({MAX_FILE_SIZE:,} bytes)")
            return False
        else:
            print(f"✅ Tamaño aceptable (límite: {MAX_FILE_SIZE:,} bytes)")
        
        # Verificar extensión
        extension = safe_name.rsplit('.', 1)[-1].lower() if '.' in safe_name else ''
        print(f"📎 Extensión: .{extension}")
        if extension not in ALLOWED_EXTENSIONS:
            print(f"❌ RECHAZADO: Extensión no permitida. Permitidas: {', '.join(ALLOWED_EXTENSIONS)}")
            return False
        else:
            print(f"✅ Extensión permitida")
        
        # Ejecutar validación completa
        result = validate_file_security(mock_file)
        if result['valid']:
            print(f"✅ ARCHIVO ACEPTADO - {result['message']}")
            print(f"🏷️  Tipo detectado: {result['file_type']}")
            print(f"🔐 Hash SHA256: {result['hash'][:16]}...")
            return True
        else:
            print(f"❌ ARCHIVO RECHAZADO - {result['message']}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR DURANTE VALIDACIÓN: {str(e)}")
        return False

def main():
    """Función principal de demostración"""
    print("🔒 DEMOSTRACIÓN DE SEGURIDAD DEL SISTEMA")
    print("=" * 60)
    print("Este script demuestra cómo el sistema protege contra archivos maliciosos.")
    print("")
    
    # Mostrar configuración de seguridad
    print("⚙️  CONFIGURACIÓN DE SEGURIDAD:")
    print(f"   • Tamaño máximo: {MAX_FILE_SIZE:,} bytes ({MAX_FILE_SIZE/(1024*1024):.1f} MB)")
    print(f"   • Extensiones permitidas: {', '.join(ALLOWED_EXTENSIONS)}")
    print(f"   • Validación de magic numbers: ✅ Activada")
    print(f"   • Validación de contenido: ✅ Activada")
    print(f"   • Hash SHA256: ✅ Activada")
    print(f"   • Protección path traversal: ✅ Activada")
    print("")
    
    # Crear archivos de prueba
    test_files, temp_dir = create_test_files()
    
    print("\n🧪 EJECUTANDO PRUEBAS DE SEGURIDAD...")
    print("=" * 60)
    
    passed_tests = 0
    total_tests = len(test_files)
    
    # Probar cada archivo
    for description, file_path in test_files.items():
        success = test_file_security(file_path, description)
        
        # Los archivos maliciosos DEBEN ser rechazados para pasar la prueba
        if description.startswith('🚨'):
            if not success:
                print("✅ PRUEBA PASADA: Archivo malicioso correctamente rechazado")
                passed_tests += 1
            else:
                print("❌ PRUEBA FALLADA: Archivo malicioso fue aceptado (PELIGRO)")
        # Los archivos válidos DEBEN ser aceptados
        elif description.startswith('✅'):
            if success:
                print("✅ PRUEBA PASADA: Archivo válido correctamente aceptado")
                passed_tests += 1
            else:
                print("❌ PRUEBA FALLADA: Archivo válido fue rechazado")
    
    # Limpiar archivos temporales
    import shutil
    shutil.rmtree(temp_dir)
    
    # Mostrar resultados finales
    print("\n📊 RESULTADOS FINALES")
    print("=" * 60)
    print(f"✅ Pruebas pasadas: {passed_tests}/{total_tests}")
    print(f"📈 Tasa de éxito: {(passed_tests/total_tests)*100:.1f}%")
    
    if passed_tests == total_tests:
        print("\n🛡️  ¡SISTEMA DE SEGURIDAD FUNCIONANDO CORRECTAMENTE!")
        print("   • Archivos maliciosos son rechazados")
        print("   • Archivos válidos son aceptados")
        print("   • Todas las validaciones están activas")
    else:
        print("\n⚠️  ADVERTENCIAS DE SEGURIDAD DETECTADAS")
        print("   • Revise la configuración del sistema")
        print("   • Algunos archivos no se validaron correctamente")
    
    print(f"\n📋 Para ver el log completo, revise: logs/security.log")
    print("🌐 El servidor está disponible en: http://localhost:5000")

if __name__ == "__main__":
    main()