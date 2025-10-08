#!/usr/bin/env python3
"""
Script para probar la seguridad del validador de archivos
"""
import os
import requests
import tempfile

# URL del servidor
BASE_URL = "http://localhost:5000"

def test_file_upload(filename, content, description):
    """Probar subida de archivo y ver respuesta"""
    print(f"\n🧪 PRUEBA: {description}")
    print(f"📁 Archivo: {filename}")
    
    try:
        # Crear archivo temporal
        with tempfile.NamedTemporaryFile(mode='wb', suffix=filename, delete=False) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        
        # Intentar subirlo
        with open(temp_path, 'rb') as f:
            files = {'file': (filename, f)}
            data = {
                'feature_id': 'feat-001',
                'user': 'Test Security',
                'text': f'Prueba de seguridad: {description}'
            }
            
            response = requests.post(f"{BASE_URL}/comment", files=files, data=data)
            
        # Limpiar archivo temporal
        os.unlink(temp_path)
        
        # Mostrar resultado
        if response.status_code == 200:
            print("✅ ARCHIVO ACEPTADO")
            print(f"   Respuesta: {response.json()}")
        else:
            print("❌ ARCHIVO RECHAZADO")
            print(f"   Razón: {response.json().get('error', 'Error desconocido')}")
    
    except Exception as e:
        print(f"🚨 ERROR EN PRUEBA: {str(e)}")

def run_security_tests():
    """Ejecutar todas las pruebas de seguridad"""
    print("🔒 INICIANDO PRUEBAS DE SEGURIDAD")
    print("=" * 50)
    
    # 1. Archivo válido (PNG real)
    png_header = b'\x89PNG\r\n\x1a\n' + b'IHDR' + b'\x00' * 100
    test_file_upload("imagen_valida.png", png_header, "Imagen PNG válida")
    
    # 2. Archivo disfrazado (ejecutable como PNG)
    fake_png = b'MZ' + b'\x00' * 100  # Signature de ejecutable Windows
    test_file_upload("malware.png", fake_png, "🚨 Ejecutable disfrazado como PNG")
    
    # 3. Archivo demasiado grande
    large_file = b'A' * (11 * 1024 * 1024)  # 11MB
    test_file_upload("archivo_grande.txt", large_file, "🚨 Archivo mayor a 10MB")
    
    # 4. Extensión no permitida
    script_content = b'echo "Hola mundo"'
    test_file_upload("script.bat", script_content, "🚨 Archivo BAT (no permitido)")
    
    # 5. PDF válido
    pdf_content = b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj'
    test_file_upload("documento.pdf", pdf_content, "Documento PDF válido")
    
    # 6. Archivo corrupto
    corrupt_content = b'\x00' * 50
    test_file_upload("corrupto.jpg", corrupt_content, "🚨 Imagen JPEG corrupta")
    
    # 7. Texto válido
    text_content = "Este es un archivo de texto válido.".encode('utf-8')
    test_file_upload("texto.txt", text_content, "Archivo de texto válido")
    
    # 8. Nombre de archivo malicioso
    malicious_name = "../../../etc/passwd"
    test_file_upload(malicious_name, b"contenido", "🚨 Path traversal attack")
    
    print("\n" + "=" * 50)
    print("🔒 PRUEBAS DE SEGURIDAD COMPLETADAS")
    print("\n📋 REVISA EL ARCHIVO logs/security.log para ver todos los intentos")

if __name__ == "__main__":
    print("⚠️  ASEGÚRATE DE QUE EL SERVIDOR ESTÉ CORRIENDO EN http://localhost:5000")
    input("Presiona ENTER para continuar...")
    run_security_tests()