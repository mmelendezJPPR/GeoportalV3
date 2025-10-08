#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitor de Logs Simple - Geoportal de Seguridad
===============================================
"""

import time
import os

def monitor_logs():
    log_file = "logs/security.log"
    
    if not os.path.exists(log_file):
        print("❌ Archivo de logs no encontrado")
        return
    
    print("🔍 MONITOREANDO LOGS DE SEGURIDAD EN TIEMPO REAL")
    print("=" * 60)
    print("💡 Ve a http://localhost:5000 y prueba subir diferentes archivos")
    print("🎯 Archivos recomendados para probar:")
    print("   ✅ PDFs, imágenes PNG/JPG, documentos TXT")
    print("   🚨 Archivos .exe, .bat, archivos muy grandes")
    print("-" * 60)
    
    # Obtener tamaño inicial
    try:
        initial_size = os.path.getsize(log_file)
    except:
        initial_size = 0
    
    print("⏳ Esperando actividad... (Ctrl+C para salir)")
    print("")
    
    try:
        while True:
            try:
                current_size = os.path.getsize(log_file)
                if current_size > initial_size:
                    # Leer nuevas líneas
                    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                        f.seek(initial_size)
                        new_lines = f.read()
                        if new_lines.strip():
                            print("🔔 NUEVA ACTIVIDAD:")
                            for line in new_lines.strip().split('\n'):
                                if 'validado exitosamente' in line:
                                    print(f"   ✅ {line}")
                                elif 'RECHAZADO' in line or 'ERROR' in line:
                                    print(f"   🚨 {line}")
                                elif 'POST /comment' in line:
                                    print(f"   📤 {line}")
                                elif line.strip():
                                    print(f"   ℹ️  {line}")
                            print("-" * 40)
                    initial_size = current_size
                
                time.sleep(2)
                
            except Exception as e:
                print(f"⚠️ Error leyendo logs: {e}")
                time.sleep(5)
                
    except KeyboardInterrupt:
        print("\n👋 Monitor detenido")

if __name__ == "__main__":
    monitor_logs()