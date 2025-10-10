// Variables globales
let map;
let currentFeature = null;
let mapLayers = {};
let currentLayer = 'satellite';

/  const baseLayers = {
    "🛰️ Satélite": mapLayers.satellite,
    "🗺️ Plan de Usos": mapLayers.planUsos,
    "🏘️ Parcelas": mapLayers.parcelas,
    "💬 Comentarios": mapLayers.comentarios
  };iguración de validación de archivos (lado cliente)
const MAX_FILE_SIZE_CLIENT = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS_CLIENT = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'txt'];

// Funciones globales
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('active');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animar entrada
  setTimeout(() => notification.classList.add('show'), 100);
  
  // Remover después de 5 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// ========== INICIALIZACIÓN DEL MAPA ==========

document.addEventListener('DOMContentLoaded', function() {
  // Inicializar el mapa
  map = L.map('map').setView([18.2208, -66.5901], 9);

  // Configurar capas del mapa
  setupMapLayers();

  // Eventos del mapa
  map.on('click', function(e) {
    // Si se hizo click en un marcador o popup, no hacer nada
    if (e.originalEvent.target.closest('.leaflet-marker-icon') || 
        e.originalEvent.target.closest('.leaflet-popup') ||
        e.originalEvent.target.closest('.leaflet-div-icon')) {
      return;
    }
    
    // Cerrar sidebar si está abierto
    closeSidebar();
    
    // Crear marcador temporal con las coordenadas
    createLocationMarker(e.latlng.lat, e.latlng.lng);
  });

  // Inicializar controles del formulario
  initFormControls();
});

// ========== CONFIGURACIÓN DE CAPAS DEL MAPA ==========

function setupMapLayers() {
  // Capa de satélite por defecto
  mapLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  });

  // Capa Plan de Usos - MIPR (dynamic layer)
  mapLayers.planUsos = L.esri.dynamicMapLayer({
    url: 'https://sige.pr.gov/server/rest/services/MIPR/PUT_v10/MapServer',
    attribution: '&copy; SIGE Puerto Rico - Plan de Usos del Territorio',
    layers: [0],
    opacity: 0.7
  });

  // Capa Parcelas - Colaboración CRIM-JP (dynamic layer)
  mapLayers.parcelas = L.esri.dynamicMapLayer({
    url: 'https://sige.pr.gov/server/rest/services/Crim_collaboration/cali_jp_colaboracion/MapServer',
    attribution: '&copy; SIGE Puerto Rico - Parcelas CRIM-JP',
    layers: [0],
    opacity: 0.8
  });

  // Capa Comentarios PUT (dynamic layer)
  mapLayers.comentarios = L.esri.dynamicMapLayer({
    url: 'https://sige.pr.gov/server/rest/services/cali_clasi/comentarios_put/MapServer',
    attribution: '&copy; SIGE Puerto Rico - Comentarios PUT',
    layers: [0],
    opacity: 0.9
  });

  // Agregar capa por defecto
  mapLayers[currentLayer].addTo(map);

  // Crear control de capas
  const baseLayers = {
    "🛰️ Satélite": mapLayers.satellite,
    "🗺️ Plan de Usos": mapLayers.planUsos,
    "�️ Parcelas": mapLayers.parcelas,
    "� Comentarios": mapLayers.comentarios
  };

  // Agregar control de capas al mapa
  L.control.layers(baseLayers, null, {
    position: 'topright',
    collapsed: true
  }).addTo(map);
}

// ========== FUNCIONES DEL MARCADOR DE UBICACIÓN ==========

function createLocationMarker(lat, lng) {
  // Remover marcador anterior si existe
  if (window.currentLocationMarker) {
    map.removeLayer(window.currentLocationMarker);
  }
  
  // Crear marcador con icono personalizado
    window.currentLocationMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'location-marker',
        html: '<div class="marker-inner"><i class="fas fa-map-pin"></i></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(map);
  
  // Actualizar las coordenadas en el formulario
  updateCoordinateDisplays(lat, lng);
  
  // Scroll suave hacia el formulario si está fuera de vista
  const formSection = document.querySelector('.form-card');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function removeLocationMarker() {
  if (window.currentLocationMarker) {
    map.removeLayer(window.currentLocationMarker);
    window.currentLocationMarker = null;
  }
}

// ========== FUNCIONES DEL FORMULARIO ==========

function updateCoordinateDisplays(lat, lng) {
  // Actualizar los campos de coordenadas en el formulario
  const latDisplay = document.getElementById('lat-display');
  const lngDisplay = document.getElementById('lng-display');
  
  // Validar que lat y lng sean números antes de usar toFixed
  if (latDisplay) latDisplay.value = (typeof lat === 'number' && !isNaN(lat)) ? lat.toFixed(6) : '';
  if (lngDisplay) lngDisplay.value = (typeof lng === 'number' && !isNaN(lng)) ? lng.toFixed(6) : '';
  
  // También actualizar los campos hidden para el envío del formulario
  const latInput = document.querySelector('input[name="lat"]');
  const lngInput = document.querySelector('input[name="lng"]');
  
  if (latInput) latInput.value = (typeof lat === 'number' && !isNaN(lat)) ? lat : '';
  if (lngInput) lngInput.value = (typeof lng === 'number' && !isNaN(lng)) ? lng : '';
}

function resetForm() {
  // Limpiar todos los campos del formulario
  document.getElementById('uploadForm').reset();
  
  // Limpiar las coordenadas
  updateCoordinateDisplays('', '');
  
  // Remover marcador si existe
  if (window.currentLocationMarker) {
    map.removeLayer(window.currentLocationMarker);
    window.currentLocationMarker = null;
  }
  
  // Restaurar el display del upload de archivo
  const fileUploadContent = document.querySelector('.file-upload-content');
  if (fileUploadContent) {
    fileUploadContent.innerHTML = `
      <i class="fas fa-cloud-upload-alt file-upload-icon"></i>
      <div class="file-upload-text">Seleccionar archivo</div>
      <div class="file-upload-hint">Formatos permitidos: PDF, Word, TXT, JPG, PNG, ZIP (máx. 10MB)</div>
    `;
  }
  
  // Enfocar el primer campo
  const nameInput = document.getElementById('name');
  if (nameInput) nameInput.focus();
  
  // Ocultar progreso de seguridad si está visible
  const progressDiv = document.getElementById('securityProgress');
  if (progressDiv) {
    progressDiv.style.display = 'none';
  }
}

// ========== INICIALIZACIÓN DE CONTROLES DEL FORMULARIO ==========

function initFormControls() {
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUploadSubmit);
  }
  
  // Inicializar manejo de archivos
  initFileUpload();
}

function initFileUpload() {
  const fileInput = document.getElementById('file');
  const fileUploadDiv = document.querySelector('.file-upload');
  
  if (fileInput && fileUploadDiv) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      updateFileUploadDisplay(file);
    });
    
    // Manejo de drag & drop
    fileUploadDiv.addEventListener('dragover', function(e) {
      e.preventDefault();
      fileUploadDiv.style.borderColor = 'var(--jp-blue)';
      fileUploadDiv.style.backgroundColor = 'rgba(47, 79, 127, 0.05)';
    });
    
    fileUploadDiv.addEventListener('dragleave', function(e) {
      e.preventDefault();
      fileUploadDiv.style.borderColor = 'var(--border-color)';
      fileUploadDiv.style.backgroundColor = '';
    });
    
    fileUploadDiv.addEventListener('drop', function(e) {
      e.preventDefault();
      fileUploadDiv.style.borderColor = 'var(--border-color)';
      fileUploadDiv.style.backgroundColor = '';
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        updateFileUploadDisplay(files[0]);
      }
    });
  }
}

// ...existing code...

function updateFileUploadDisplay(file) {
  const fileUploadContent = document.querySelector('.file-upload-content');
  const fileUploadArea = document.querySelector('.file-upload-area'); // Referencia al contenedor principal
  
  if (!file) {
    fileUploadContent.innerHTML = `
      <i class="fas fa-cloud-upload-alt file-upload-icon"></i>
      <div class="file-upload-text">Seleccionar archivo</div>
      <div class="file-upload-hint">⚠️ SOLO archivos PDF con texto extraíble (NO imágenes escaneadas)</div>
    `;
    
    // Aplicar borde por defecto
    if (fileUploadArea) {
      fileUploadArea.style.border = "2px dashed #9ca3af";
      fileUploadArea.style.borderRadius = "8px";
      fileUploadArea.style.backgroundColor = "rgba(156, 163, 175, 0.1)";
    }
    return;
  }
  
  // Validaciones para solo PDF
  const maxSize = 10 * 1024 * 1024; // 10MB
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.split('.').pop();
  
  // Solo permitir PDF
  if (fileExtension !== 'pdf') {
    fileUploadContent.innerHTML = `
      <i class="fas fa-exclamation-triangle file-upload-icon" style="color: #dc3545;"></i>
      <div class="file-upload-text" style="color: #dc3545;">Tipo de archivo no permitido</div>
      <div class="file-upload-hint" style="color: #dc3545;">⚠️ SOLO se permiten archivos PDF con texto extraíble</div>
    `;
    
    // Aplicar borde de error
    if (fileUploadArea) {
      fileUploadArea.style.border = "2px solid #dc3545";
      fileUploadArea.style.borderRadius = "8px";
      fileUploadArea.style.backgroundColor = "rgba(220, 53, 69, 0.1)";
    }
    return;
  }
  
  // Verificar tamaño
  if (file.size > maxSize) {
    fileUploadContent.innerHTML = `
      <i class="fas fa-exclamation-triangle file-upload-icon" style="color: #dc3545;"></i>
      <div class="file-upload-text" style="color: #dc3545;">Archivo muy grande</div>
      <div class="file-upload-hint" style="color: #dc3545;">Tamaño máximo: 10MB</div>
    `;
    
    // Aplicar borde de error
    if (fileUploadArea) {
      fileUploadArea.style.border = "2px solid #dc3545";
      fileUploadArea.style.borderRadius = "8px";
      fileUploadArea.style.backgroundColor = "rgba(220, 53, 69, 0.1)";
    }
    return;
  }
  
  // Archivo válido
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  fileUploadContent.innerHTML = `
    <i class="fas fa-file-pdf file-upload-icon" style="color: #28a745;"></i>
    <div class="file-upload-text" style="color: #28a745;">${file.name}</div>
    <div class="file-upload-hint" style="color: #28a745;">${fileSizeMB} MB - PDF válido seleccionado</div>
  `;
  
  // Aplicar borde de éxito
  if (fileUploadArea) {
    fileUploadArea.style.border = "2px solid #28a745";
    fileUploadArea.style.borderRadius = "8px";
    fileUploadArea.style.backgroundColor = "rgba(40, 167, 69, 0.1)";
  }
}

// ...existing code...

function resetForm() {
  // Limpiar todos los campos del formulario
  document.getElementById('uploadForm').reset();
  
  // Limpiar las coordenadas
  updateCoordinateDisplays('', '');
  
  // Remover marcador si existe
  if (window.currentLocationMarker) {
    map.removeLayer(window.currentLocationMarker);
    window.currentLocationMarker = null;
  }
  
  // Restaurar el display del upload de archivo CON BORDE
  const fileUploadContent = document.querySelector('.file-upload-content');
  const fileUploadArea = document.querySelector('.file-upload-area');
  
  if (fileUploadContent) {
    fileUploadContent.innerHTML = `
      <i class="fas fa-cloud-upload-alt file-upload-icon"></i>
      <div class="file-upload-text">Seleccionar archivo</div>
      <div class="file-upload-hint">⚠️ SOLO archivos PDF con texto extraíble (NO imágenes escaneadas)</div>
    `;
  }
  
  // Restaurar borde por defecto
  if (fileUploadArea) {
    fileUploadArea.style.border = "2px dashed #9ca3af";
    fileUploadArea.style.borderRadius = "8px";
    fileUploadArea.style.backgroundColor = "rgba(156, 163, 175, 0.1)";
  }
  
  // Enfocar el primer campo
  const nameInput = document.getElementById('name');
  if (nameInput) nameInput.focus();
  
  // Ocultar progreso de seguridad si está visible
  const progressDiv = document.getElementById('securityProgress');
  if (progressDiv) {
    progressDiv.style.display = 'none';
  }
}

// ...existing code...

function initFileUpload() {
  const fileInput = document.getElementById('file');
  const fileUploadDiv = document.querySelector('.file-upload');
  const fileUploadArea = document.querySelector('.file-upload-area');
  
  if (fileInput && fileUploadDiv) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      updateFileUploadDisplay(file);
    });
    
    // Manejo de drag & drop CON BORDES MEJORADOS
    fileUploadDiv.addEventListener('dragover', function(e) {
      e.preventDefault();
      if (fileUploadArea) {
        fileUploadArea.style.border = '3px solid #6b7280';
        fileUploadArea.style.backgroundColor = 'rgba(107, 114, 128, 0.15)';
        fileUploadArea.style.transform = 'scale(1.02)';
        fileUploadArea.style.transition = 'all 0.2s ease';
      }
    });
    
    fileUploadDiv.addEventListener('dragleave', function(e) {
      e.preventDefault();
      if (fileUploadArea) {
        fileUploadArea.style.border = '2px dashed #9ca3af';
        fileUploadArea.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
        fileUploadArea.style.transform = 'scale(1)';
      }
    });
    
    fileUploadDiv.addEventListener('drop', function(e) {
      e.preventDefault();
      if (fileUploadArea) {
        fileUploadArea.style.border = '2px dashed #9ca3af';
        fileUploadArea.style.backgroundColor = 'rgba(156, 163, 175, 0.1)';
        fileUploadArea.style.transform = 'scale(1)';
      }
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        updateFileUploadDisplay(files[0]);
      }
    });
  }
  
  // Aplicar borde inicial al cargar la página
  if (fileUploadArea) {
    fileUploadArea.style.border = "2px dashed #9ca3af";
    fileUploadArea.style.borderRadius = "8px";
    fileUploadArea.style.backgroundColor = "rgba(156, 163, 175, 0.1)";
    fileUploadArea.style.transition = "all 0.3s ease";
  }
}

// ...existing code...
// ...existing code...

// ========== MANEJO DEL ENVÍO DEL FORMULARIO ==========

function handleUploadSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  // Validar que se haya seleccionado una ubicación
  const latValue = formData.get('lat');
  const lngValue = formData.get('lng');
  
  if (!latValue || !lngValue || latValue === '' || lngValue === '') {
    showNotification('Por favor, haz clic en el mapa para seleccionar una ubicación', 'error');
    return;
  }
  
  // Validar campos requeridos
  const requiredFields = [
    { name: 'name', label: 'Nombre' },
    { name: 'email', label: 'Correo Electrónico' },
    { name: 'municipality', label: 'Municipio' },
    { name: 'entity', label: 'Entidad' },
    { name: 'comments', label: 'Comentarios' }
  ];
  
  for (let field of requiredFields) {
    if (!formData.get(field.name) || formData.get(field.name).trim() === '') {
      showNotification(`El campo ${field.label} es requerido`, 'error');
      const fieldElement = document.getElementById(field.name);
      if (fieldElement) {
        fieldElement.focus();
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
  }
  
  // MOSTRAR PROGRESO INMEDIATAMENTE (ANTES DE CUALQUIER COSA)
  showSecurityProgress();
  showNotification('🔒 Iniciando escaneo de seguridad del archivo...', 'info');
  
  // Cambiar botón a estado de carga
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Escaneando...';
  submitBtn.disabled = true;
  
  // PASO 1: Escanear archivo PRIMERO
  const fileInput = document.getElementById('file');
  if (fileInput && fileInput.files.length > 0) {
    // Crear FormData solo con el archivo para escaneo
    const scanFormData = new FormData();
    scanFormData.append('file', fileInput.files[0]);
    
    fetch('/scan-file', {
      method: 'POST',
      body: scanFormData
    })
    .then(response => response.json())
    .then(scanResult => {
      if (scanResult.status === 'ok') {
        // Archivo aprobado, continuar con progreso de seguridad
        continueSecurityProgress();
        
        // Cambiar botón y enviar formulario completo
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        
        // PASO 2: Enviar formulario completo después de un retraso
        setTimeout(() => {
          fetch('/upload', {
            method: 'POST',
            body: formData
          })
          .then(response => response.json())
          .then(result => {
            if (result.status === 'ok') {
              showNotification('¡Solicitud enviada exitosamente!', 'success');
              
              // Limpiar formulario después del éxito
              resetForm();
              
              // Agregar marcador permanente en la ubicación de la solicitud
              const lat = parseFloat(latValue);
              const lng = parseFloat(lngValue);
              
              if (!isNaN(lat) && !isNaN(lng)) {
                L.marker([lat, lng], {
                  icon: L.divIcon({
                    className: 'user-request-marker',
                    html: '<i class="fas fa-file-alt"></i>',
                    iconSize: [25, 25],
                    iconAnchor: [12, 25]
                  })
                }).addTo(map)
                  .bindPopup('<b>Solicitud enviada</b><br>Tu solicitud ha sido registrada en esta ubicación.');
              }
              
            } else {
              showNotification('Error: ' + (result.error || 'Error desconocido'), 'error');
            }
          })
          .catch(error => {
            console.error('Error enviando solicitud:', error);
            showNotification('Error al enviar la solicitud. Por favor, inténtalo de nuevo.', 'error');
          })
          .finally(() => {
            // Restaurar botón
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            // Ocultar progreso de seguridad
            hideSecurityProgress();
          });
        }, 1000); // Retraso después del escaneo
        
      } else {
        // Archivo rechazado por seguridad - mostrar error en progreso
        failSecurityProgress(scanResult.error);
        showNotification('🚫 ' + (scanResult.error || 'Archivo rechazado por seguridad'), 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        hideSecurityProgress();
      }
    })
    .catch(error => {
      console.error('Error escaneando archivo:', error);
      showNotification('Error al escanear el archivo. Por favor, inténtalo de nuevo.', 'error');
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      hideSecurityProgress();
    });
  } else {
    // No hay archivo, enviar formulario directamente
    fetch('/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(result => {
      if (result.status === 'ok') {
        showNotification('¡Solicitud enviada exitosamente!', 'success');
        resetForm();
      } else {
        showNotification('Error: ' + (result.error || 'Error desconocido'), 'error');
      }
    })
    .catch(error => {
      console.error('Error enviando solicitud:', error);
      showNotification('Error al enviar la solicitud. Por favor, inténtalo de nuevo.', 'error');
    })
    .finally(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      hideSecurityProgress();
    });
  }
}

// ========== FUNCIONES DE CARGA DE DATOS ==========

function loadExistingComments() {
  fetch('/data.geojson')
    .then(response => response.json())
    .then(data => {
      L.geoJSON(data, {
        pointToLayer: function(feature, latlng) {
          return L.marker(latlng, {
              icon: L.divIcon({
                className: 'user-request-marker',
                html: '<div class="marker-inner"><i class="fas fa-comment"></i></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 20]
              })
          });
        },
        onEachFeature: function(feature, layer) {
          if (feature.properties) {
            layer.bindPopup(`
              <div class="comment-popup">
                <h4>${feature.properties.name || 'Comentario'}</h4>
                <p><strong>Municipio:</strong> ${feature.properties.municipality || 'N/A'}</p>
                <p><strong>Entidad:</strong> ${feature.properties.entity || 'N/A'}</p>
                <p><strong>Comentario:</strong> ${feature.properties.comments || 'Sin comentarios'}</p>
                <p><small><strong>Fecha:</strong> ${formatDate(feature.properties.timestamp)}</small></p>
              </div>
            `);
          }
        }
      }).addTo(map);
    })
    .catch(error => {
      console.error('Error cargando comentarios existentes:', error);
    });
}

// Cargar comentarios existentes cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(loadExistingComments, 1000);
});

// ========== FUNCIONES DE PROGRESO DE SEGURIDAD ==========

function showSecurityProgress() {
  const progressDiv = document.getElementById('securityProgress');
  if (progressDiv) {
    progressDiv.style.display = 'block';
    
    // Hacer scroll para asegurar que se vea el progreso
    progressDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Solo mostrar el primer paso como activo
    updateSecurityStep('step-upload', 'active', '⏳');
  }
}

function continueSecurityProgress() {
  // Completar upload y continuar con escaneo
  updateSecurityStep('step-upload', 'completed', '✓');
  
  setTimeout(() => {
    updateSecurityStep('step-clamav', 'active', '🔄');
    setTimeout(() => updateSecurityStep('step-clamav', 'completed', '✓'), 3000);
  }, 500);
  
  setTimeout(() => {
    updateSecurityStep('step-virustotal', 'active', '🔄');
    setTimeout(() => updateSecurityStep('step-virustotal', 'completed', '✓'), 3000);
  }, 4000);
  
  setTimeout(() => {
    updateSecurityStep('step-final', 'active', '🔄');
    setTimeout(() => updateSecurityStep('step-final', 'completed', '✓'), 2000);
  }, 7500);
}

function failSecurityProgress(errorMessage) {
  // Marcar el primer paso como fallido
  updateSecurityStep('step-upload', 'error', '❌');
  
  // Actualizar el texto del paso para mostrar el error
  const uploadStep = document.getElementById('step-upload');
  if (uploadStep) {
    const stepText = uploadStep.querySelector('.step-text');
    if (stepText) {
      stepText.textContent = errorMessage || 'Archivo rechazado';
    }
  }
}

function updateSecurityStep(stepId, status, statusText = '⏳') {
  const step = document.getElementById(stepId);
  if (step) {
    // Remover clases previas
    step.classList.remove('active', 'completed', 'error');
    
    // Añadir nueva clase
    if (status !== 'pending') {
      step.classList.add(status);
    }
    
    // Actualizar texto de estado
    const statusElement = step.querySelector('.step-status');
    if (statusElement) {
      statusElement.textContent = statusText;
    }
  }
}

function hideSecurityProgress() {
  const progressDiv = document.getElementById('securityProgress');
  if (progressDiv) {
    setTimeout(() => {
      progressDiv.style.display = 'none';
      // Resetear todos los pasos
      const steps = ['step-upload', 'step-clamav', 'step-virustotal', 'step-final'];
      steps.forEach(stepId => {
        updateSecurityStep(stepId, 'pending', '⏳');
      });
    }, 5000); // Esperar 5 segundos antes de ocultar
  }
}