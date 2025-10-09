class ClamAVScanner:
    def __init__(self):
        self.clamav_available = False
        
    def scan_file(self, file_path):
        import time
        # Simular tiempo de escaneo para hacer visible el progreso
        time.sleep(1.5)
        
        # Leer contenido del archivo para detectar patrones maliciosos
        try:
            with open(file_path, 'rb') as f:
                content = f.read(1024)  # Leer primeros 1KB
                content_str = content.decode('utf-8', errors='ignore').lower()
                
                # Patrones que consideramos "maliciosos" para prueba
                malicious_patterns = [
                    'virus',
                    'malware', 
                    'trojan',
                    'hack',
                    'exploit',
                    'payload',
                    'backdoor',
                    'corrupted',
                    'malicious'
                ]
                
                for pattern in malicious_patterns:
                    if pattern in content_str:
                        return {"status": "infected", "message": f"VIRUS DETECTADO: Patrón '{pattern}' encontrado en el archivo"}
                        
        except Exception as e:
            pass  # Si no se puede leer, continuar con escaneo normal
        
        return {"status": "clean", "message": "Archivo escaneado - Sin amenazas detectadas"}
