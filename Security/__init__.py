"""
Security Module for Geoportal PR
Provides advanced file scanning capabilities
"""

from .scanner import ClamAVScanner
from .virus import VirusTotalScanner
from .pdf_validator import PDFValidator

__version__ = "1.0.0"
__all__ = ['ClamAVScanner', 'VirusTotalScanner', 'PDFValidator']

# Mensaje de inicialización
print("Security module loaded - ClamAV and VirusTotal scanners available")
