"""
Configuración de Gunicorn para Render
"""
import os

# Bind to PORT environment variable (Render provides this)
bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"

# Worker configuration
workers = 2
worker_class = 'sync'
timeout = 120

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190
