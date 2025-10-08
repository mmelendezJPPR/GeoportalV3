#!/usr/bin/env python3
"""
Monitorear logs de seguridad en tiempo real
"""
import time
import os

def monitor_security_logs():
    """Mostrar logs de seguridad en tiempo real"""
    log_file = "logs/security.log"
    
    if not os.path.exists(log_file):
        print("❌ Archivo de logs no encontrado. ¿Está corriendo el servidor?")
        return
    
    print("🔍 MONITOREANDO LOGS DE SEGURIDAD")
    print("=" * 50)
    
    # Leer archivo existente
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        # Mostrar las últimas 10 líneas
        print("📋 ÚLTIMAS ACTIVIDADES:")
        for line in lines[-10:]:
            if "WARNING" in line:
                print(f"⚠️  {line.strip()}")
            elif "ERROR" in line:
                print(f"🚨 {line.strip()}")
            elif "Archivo validado exitosamente" in line:
                print(f"✅ {line.strip()}")
            elif "Archivo subido exitosamente" in line:
                print(f"📤 {line.strip()}")
            else:
                print(f"ℹ️  {line.strip()}")
                
        print("\n👆 Ejecuta las pruebas de seguridad para ver más actividad")
        
    except Exception as e:
        print(f"Error leyendo logs: {e}")

if __name__ == "__main__":
    monitor_security_logs()