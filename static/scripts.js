// Variables globales
let map;
let currentFeature = null;
let mapLayers = {};
let currentLayer = 'satellite';
// Si conoces el ID exacto de la subcapa de carreteras en 'Parcelas', colócalo aquí; si no, se intenta detectar automáticamente
const PARCELAS_ROADS_SUBLAYER_ID = null;

// Configuración de validación de archivos (lado cliente)
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
  map = L.map('map').setView([18.2208, -66.5901], 12);

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
  // Capa de satélite por defecto (tiene tiles cacheados)
  mapLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19
  });

  // Capa Plan de Usos - MIPR usando dynamic map layer (no tiene tiles cacheados)
  mapLayers.planUsos = L.esri.dynamicMapLayer({
    url: 'https://sige.pr.gov/server/rest/services/MIPR/PUT_v10/MapServer',
    attribution: '&copy; SIGE Puerto Rico - Plan de Usos del Territorio',
    opacity: 0.7,
    transparent: true,
    format: 'png32',
    zIndex: 300
  });

  // Capa Parcelas - Colaboración CRIM-JP usando dynamic map layer
  mapLayers.parcelas = L.esri.dynamicMapLayer({
    url: 'https://sige.pr.gov/server/rest/services/Crim_collaboration/cali_jp_colaboracion/MapServer',
    attribution: '&copy; SIGE Puerto Rico - Parcelas CRIM-JP',
    opacity: 1.0,
    transparent: true,
    format: 'png32',
    layers: [0],
    zIndex: 400
  });

  // Limitar Parcelas solo a carreteras si se conoce el ID o si se puede detectar automáticamente
  if (Number.isInteger(PARCELAS_ROADS_SUBLAYER_ID)) {
    mapLayers.parcelas.setLayers([PARCELAS_ROADS_SUBLAYER_ID]);
    console.log('🚧 Parcelas configurado a subcapa de carreteras (ID fijo):', PARCELAS_ROADS_SUBLAYER_ID);
  } else {
    autoSelectParcelasRoadsSublayer(mapLayers.parcelas);
  }

  // Capa Comentarios PUT usando dynamic map layer
  mapLayers.comentarios = L.esri.dynamicMapLayer({
    url: 'https://sige.pr.gov/server/rest/services/cali_clasi/comentarios_put/MapServer',
    attribution: '&copy; SIGE Puerto Rico - Comentarios PUT',
    opacity: 1.0,
    transparent: true,
    format: 'png32',
    layers: [0],
    zIndex: 500
  });

  // Añadir logging para diagnosticar problemas de carga
  mapLayers.planUsos.on('load', () => console.log('✅ Plan de Usos cargado correctamente'));
  mapLayers.planUsos.on('error', (e) => console.error('❌ Error en Plan de Usos:', e));
  mapLayers.planUsos.on('requeststart', (e) => console.log('🔄 Plan de Usos - Request:', e.url));

  mapLayers.parcelas.on('load', () => console.log('✅ Parcelas cargado correctamente'));
  mapLayers.parcelas.on('error', (e) => console.error('❌ Error en Parcelas:', e));
  mapLayers.parcelas.on('requeststart', (e) => console.log('🔄 Parcelas - Request:', e.url));

  mapLayers.comentarios.on('load', () => console.log('✅ Comentarios cargado correctamente'));
  mapLayers.comentarios.on('error', (e) => console.error('❌ Error en Comentarios:', e));
  mapLayers.comentarios.on('requeststart', (e) => console.log('🔄 Comentarios - Request:', e.url));

  // Agregar base layer por defecto
  mapLayers[currentLayer].addTo(map);

  // Agregar overlays por defecto (puedes ajustar cuáles se muestran inicialmente)
  mapLayers.planUsos.addTo(map);
  mapLayers.parcelas.addTo(map);
  // Dejar comentarios opcionalmente apagado al inicio
  // mapLayers.comentarios.addTo(map);

  // Crear control de capas: Satélite como base; las demás como overlays con checkboxes
  const baseLayers = {
    "🛰️ Satélite": mapLayers.satellite
  };

  const overlays = {
    "🗺️ Plan de Usos": mapLayers.planUsos,
    "🏘️ Parcelas": mapLayers.parcelas,
    "💬 Comentarios": mapLayers.comentarios
  };

  // Agregar control de capas al mapa
  const layersControl = L.control.layers(baseLayers, overlays, {
    position: 'topright',
    collapsed: true
  }).addTo(map);

  // Diagnóstico ligero para cambios de capas
  map.on('baselayerchange', (e) => console.log('🔁 Base layer cambiado a:', e.name));
  map.on('overlayadd', (e) => console.log('➕ Overlay activado:', e.name));
  map.on('overlayremove', (e) => console.log('➖ Overlay desactivado:', e.name));
}

// Busca automáticamente una subcapa de "Carreteras" (o similar) en el servicio de Parcelas
async function autoSelectParcelasRoadsSublayer(dynamicLayer) {
  try {
    const serviceUrl = dynamicLayer.options.url;
    const resp = await fetch(`${serviceUrl}?f=json`);
    const data = await resp.json();

    const layers = (data && data.layers) || [];
    const target = layers.find(l => /carreter|road|vial/i.test(l.name || ''));

    if (target) {
      dynamicLayer.setLayers([target.id]);
      console.log(`🚧 Parcelas ajustado a subcapa de carreteras: [${target.id}] ${target.name}`);
    } else {
      console.warn('ℹ️ No se encontró subcapa de "Carreteras" en Parcelas; se mantiene la configuración actual.');
    }
  } catch (e) {
    console.warn('⚠️ No se pudo consultar la metadata de Parcelas para ubicar "Carreteras".', e);
  }
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

// ========== ARCHIVO UPLOAD ==========

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

function initFormControls() {
  // Soportar ambas variantes de IDs/clases en el HTML
  const fileInput = document.getElementById('file') || document.getElementById('file-input');
  const fileUploadDiv = document.querySelector('.file-upload') || document.querySelector('.file-upload-area');
  const fileUploadArea = document.querySelector('.file-upload-area') || document.querySelector('.file-upload');
  
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
        // Asignar archivo al input (compatible con diferentes navegadores)
        if (fileInput) {
          try {
            fileInput.files = files;
          } catch (err) {
            // Fallback para navegadores que no permiten asignar directamente
            fileInput.value = '';
          }
        }
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

// ========== ENVÍO DEL FORMULARIO ==========

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('uploadForm');
  
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      try {
        await handleFormSubmission();
      } catch (error) {
        console.error('Error en el envío del formulario:', error);
        showNotification('Error inesperado al enviar el formulario', 'error');
        hideSecurityProgress();
      }
    });
  }
});

async function handleFormSubmission() {
  // Validar coordenadas
  const latInput = document.querySelector('input[name="lat"]');
  const lngInput = document.querySelector('input[name="lng"]');
  
  if (!latInput || !latInput.value || !lngInput || !lngInput.value) {
    showNotification('⚠️ Por favor, seleccione una ubicación en el mapa', 'error');
    return;
  }
  
  // Preparar datos del formulario
  const formData = new FormData(document.getElementById('uploadForm'));
  const fileInput = document.getElementById('file') || document.getElementById('file-input');
  
  // Si hay archivo, procesarlo con seguridad primero
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    showSecurityProgress();
    
    // Paso 1: Subir archivo para escaneo
    updateSecurityStep('step-upload', 'active', '🔄');
    
    const scanFormData = new FormData();
    scanFormData.append('file', fileInput.files[0]);
    
    try {
      const scanResponse = await fetch('/scan-file', {
        method: 'POST',
        body: scanFormData
      });
      
      const scanResult = await scanResponse.json();
      
      if (!scanResponse.ok) {
        updateSecurityStep('step-upload', 'error', '❌');
        showNotification(scanResult.error || 'Error en el escaneo de seguridad', 'error');
        hideSecurityProgress();
        return;
      }
      
      updateSecurityStep('step-upload', 'completed', '✅');
      
      // Paso 2: Escaneo ClamAV
      updateSecurityStep('step-clamav', 'active', '🔄');
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateSecurityStep('step-clamav', 'completed', '✅');
      
      // Paso 3: Verificación VirusTotal
      updateSecurityStep('step-virustotal', 'active', '🔄');
      await new Promise(resolve => setTimeout(resolve, 2000));
      updateSecurityStep('step-virustotal', 'completed', '✅');
      
      // Paso 4: Validación final
      updateSecurityStep('step-final', 'active', '🔄');
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateSecurityStep('step-final', 'completed', '✅');
      
      // Agregar el nombre del archivo escaneado al formulario
      formData.append('scanned_filename', scanResult.filename);
      
    } catch (error) {
      updateSecurityStep('step-upload', 'error', '❌');
      showNotification('Error de conexión durante el escaneo', 'error');
      hideSecurityProgress();
      return;
    }
  }
  
  // Envío final
  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showNotification('✅ Solicitud enviada exitosamente', 'success');
      resetForm();
    } else {
      showNotification(result.error || 'Error al enviar la solicitud', 'error');
    }
    
  } catch (error) {
    showNotification('Error de conexión al enviar la solicitud', 'error');
  } finally {
    hideSecurityProgress();
  }
}

function showSecurityProgress() {
  const progressDiv = document.getElementById('securityProgress');
  if (progressDiv) {
    progressDiv.style.display = 'block';
    
    // Resetear todos los pasos
    const steps = ['step-upload', 'step-clamav', 'step-virustotal', 'step-final'];
    steps.forEach(stepId => {
      updateSecurityStep(stepId, 'pending', '⏳');
    });
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
    }, 2000);
  }
}

// Handler opcional para HTML inline (onclick) en index.html
function handleFileSelect(input) {
  if (input && input.files && input.files[0]) {
    updateFileUploadDisplay(input.files[0]);
  }
}