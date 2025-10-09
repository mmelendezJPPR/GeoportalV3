"""
Security Manager - Coordina escáneres de seguridad
"""

import os
import time
from .scanner import ClamAVScanner
from .virus import VirusTotalScanner

class SecurityManager:
    def __init__(self, upload_folder="uploads"):
        self.upload_folder = upload_folder
        self.clamav_scanner = ClamAVScanner()
        self.virustotal_scanner = VirusTotalScanner()
        
        # Crear directorios necesarios
        self._setup_directories()
    
    def _setup_directories(self):
        """Crear estructura de directorios de seguridad"""
        directories = [
            os.path.join(self.upload_folder, 'temp'),
            os.path.join(self.upload_folder, 'quarantine'),
            os.path.join(self.upload_folder, 'safe')
        ]
        
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
    
    def scan_file(self, file_path):
        """Escanear archivo con ambos escáneres"""
        import logging
        import time
        filename = os.path.basename(file_path)
        
        # Log inicio de escaneo
        print(f"[SECURITY] Iniciando escaneo completo de: {filename}")
        logging.info(f"SECURITY SCAN INICIADO - Archivo: {filename}")
        
        results = {
            'safe': False,
            'clamav_result': None,
            'virustotal_result': None,
            'final_decision': 'pending'
        }
        
        # Retraso para hacer visible el inicio
        time.sleep(1)
        
        # Escaneo con ClamAV
        print(f"[ClamAV] Escaneando {filename}...")
        results['clamav_result'] = self.clamav_scanner.scan_file(file_path)
        clamav_status = results['clamav_result']['status']
        print(f"[ClamAV] Resultado: {clamav_status}")
        
        # Retraso para hacer visible el progreso
        time.sleep(2)
        
        # Escaneo con VirusTotal
        print(f"[VirusTotal] Verificando {filename}...")
        results['virustotal_result'] = self.virustotal_scanner.check_file_reputation(file_path)
        vt_status = results['virustotal_result']['status']
        print(f"[VirusTotal] Resultado: {vt_status}")
        
        # Retraso para hacer visible el progreso
        time.sleep(2)
        
        # Decisión final (por ahora, simple)
        clamav_ok = results['clamav_result']['status'] in ['clean', 'warning']
        vt_ok = results['virustotal_result']['status'] in ['clean', 'no_api_key']
        
        if clamav_ok and vt_ok:
            results['safe'] = True
            results['final_decision'] = 'approved'
            print(f"[SECURITY] {filename} APROBADO - Archivo seguro")
            logging.info(f"SECURITY SCAN COMPLETADO - {filename} APROBADO")
        else:
            results['final_decision'] = 'rejected'
            print(f"[SECURITY] {filename} RECHAZADO - Archivo potencialmente peligroso")
            if results['clamav_result']['status'] == 'infected':
                print(f"[SECURITY] AMENAZA DETECTADA: {results['clamav_result']['message']}")
            logging.warning(f"SECURITY SCAN COMPLETADO - {filename} RECHAZADO")
        
        return results
