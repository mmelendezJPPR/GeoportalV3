import requests
import hashlib
import time
import logging
import os
from typing import Dict, Optional

class VirusTotalScanner:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('VIRUSTOTAL_API_KEY')
        self.base_url = 'https://www.virustotal.com/api/v3'
        self.session = requests.Session()
        self.session.headers.update({
            'x-apikey': self.api_key,
            'User-Agent': 'GeoportalPR-SecurityScanner/1.0'
        })
        
    def get_file_hash(self, file_path: str) -> str:
        """Calcular SHA256 del archivo"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    
    def check_file_reputation(self, file_path: str) -> Dict:
        """Verificar reputación del archivo por hash"""
        # Simular tiempo de consulta para hacer visible el progreso
        time.sleep(1.5)
        
        if not self.api_key:
            return {'status': 'no_api_key', 'message': 'API key no configurada - archivo procesado localmente'}
        
        try:
            file_hash = self.get_file_hash(file_path)
            
            # Buscar por hash primero (más rápido)
            response = self.session.get(f'{self.base_url}/files/{file_hash}')
            
            if response.status_code == 200:
                data = response.json()
                stats = data['data']['attributes']['last_analysis_stats']
                
                malicious = stats.get('malicious', 0)
                suspicious = stats.get('suspicious', 0)
                total_scans = sum(stats.values())
                
                if malicious > 0:
                    return {
                        'status': 'malicious',
                        'message': f'Detectado como malicioso por {malicious}/{total_scans} motores',
                        'details': stats
                    }
                elif suspicious > 0:
                    return {
                        'status': 'suspicious',
                        'message': f'Marcado como sospechoso por {suspicious}/{total_scans} motores',
                        'details': stats
                    }
                else:
                    return {
                        'status': 'clean',
                        'message': f'Archivo limpio según {total_scans} motores',
                        'details': stats
                    }
            
            elif response.status_code == 404:
                # Archivo no conocido, enviar para análisis
                return self.upload_file_for_analysis(file_path)
            
            else:
                return {
                    'status': 'error',
                    'message': f'Error API: {response.status_code}'
                }
                
        except Exception as e:
            logging.error(f"Error VirusTotal: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def upload_file_for_analysis(self, file_path: str) -> Dict:
        """Subir archivo para análisis (archivos nuevos)"""
        try:
            file_size = os.path.getsize(file_path)
            
            # VirusTotal tiene límite de 32MB para API gratuita
            if file_size > 32 * 1024 * 1024:
                return {
                    'status': 'too_large',
                    'message': 'Archivo muy grande para VirusTotal (>32MB)'
                }
            
            with open(file_path, 'rb') as f:
                files = {'file': f}
                response = self.session.post(f'{self.base_url}/files', files=files)
            
            if response.status_code == 200:
                analysis_id = response.json()['data']['id']
                
                # Esperar resultado (máximo 2 minutos)
                return self.wait_for_analysis(analysis_id)
            else:
                return {
                    'status': 'upload_error',
                    'message': f'Error subiendo: {response.status_code}'
                }
                
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def wait_for_analysis(self, analysis_id: str, max_wait: int = 120) -> Dict:
        """Esperar resultado del análisis"""
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            try:
                response = self.session.get(f'{self.base_url}/analyses/{analysis_id}')
                
                if response.status_code == 200:
                    data = response.json()
                    
                    if data['data']['attributes']['status'] == 'completed':
                        stats = data['data']['attributes']['stats']
                        
                        malicious = stats.get('malicious', 0)
                        suspicious = stats.get('suspicious', 0)
                        total_scans = sum(stats.values())
                        
                        if malicious > 0:
                            return {
                                'status': 'malicious',
                                'message': f'NUEVO archivo detectado como malicioso por {malicious}/{total_scans} motores',
                                'details': stats
                            }
                        elif suspicious > 0:
                            return {
                                'status': 'suspicious',
                                'message': f'NUEVO archivo marcado como sospechoso por {suspicious}/{total_scans} motores',
                                'details': stats
                            }
                        else:
                            return {
                                'status': 'clean',
                                'message': f'NUEVO archivo limpio según {total_scans} motores',
                                'details': stats
                            }
                
                time.sleep(5)  # Esperar 5 segundos antes de verificar nuevamente
                
            except Exception as e:
                logging.error(f"Error esperando análisis: {e}")
                break
        
        return {
            'status': 'timeout',
            'message': 'Timeout esperando análisis de VirusTotal'
        }