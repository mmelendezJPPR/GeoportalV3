// Variables globales
let map;
let currentFeature = null;
let mapLayers = {};
let currentLayer = 'satellite';
let searchMarker = null;
let coordinatesMarker = null;

// Configuración de validación de archivos (lado cliente)
const MAX_FILE_SIZE_CLIENT = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS_CLIENT = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'txt'];

// Funciones de validación de archivos (lado cliente)
function validateFileClient(input) {
  const messageDiv = document.getElementById('file-validation-message');
  const file = input.files[0];
  
  if (!file) {
    hideValidationMessage();
    return true;
  }
  
  // Validar tamaño
  if (file.size > MAX_FILE_SIZE_CLIENT) {
    showValidationMessage(`El archivo es demasiado grande. Máximo permitido: ${(MAX_FILE_SIZE_CLIENT / 1024 / 1024).toFixed(1)}MB`, 'error');
    input.value = '';
    return false;
  }
  
  // Validar extensión
  const fileName = file.name.toLowerCase();
  const extension = fileName.split('.').pop();
  
  if (!ALLOWED_EXTENSIONS_CLIENT.includes(extension)) {
    showValidationMessage(`Tipo de archivo no permitido. Permitidos: ${ALLOWED_EXTENSIONS_CLIENT.join(', ').toUpperCase()}`, 'error');
    input.value = '';
    return false;
  }
  
  // Validación exitosa
  showValidationMessage(`✓ Archivo válido: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'success');
  return true;
}

function showValidationMessage(message, type) {
  const messageDiv = document.getElementById('file-validation-message');
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';
  
  if (type === 'error') {
    messageDiv.style.backgroundColor = '#fee2e2';
    messageDiv.style.color = '#dc2626';
    messageDiv.style.border = '1px solid #fecaca';
  } else if (type === 'success') {
    messageDiv.style.backgroundColor = '#dcfce7';
    messageDiv.style.color = '#16a34a';
    messageDiv.style.border = '1px solid #bbf7d0';
  }
}

function hideValidationMessage() {
  const messageDiv = document.getElementById('file-validation-message');
  messageDiv.style.display = 'none';
}

// Funciones globales (necesarias para los eventos HTML)
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('active');
}

function toggleInfo() {
  // Función para mostrar información de la app
  showNotification("Haz clic en cualquier punto del mapa para ver y agregar comentarios", "success");
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
  
  // Remover después de 3 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => document.body.removeChild(notification), 300);
  }, 3000);
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar mapa
  map = L.map('map', {
    zoomControl: false // Remover controles por defecto para usar los nuestros
  }).setView([18.45, -66.1], 11);
  
  // Definir capas de mapa más realistas
  mapLayers = {
    street: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, HERE, Garmin, FAO, NOAA, USGS',
      maxZoom: 20
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, Maxar, Earthstar Geographics',
      maxZoom: 20
    }),
    hybrid: L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 20
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 20,
        opacity: 0.8
      })
    ]),
    terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL',
      maxZoom: 20
    }),
    planning: L.layerGroup([
      // Capa base más detallada para planificación
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, HERE, Garmin',
        maxZoom: 20
      }),
      // Capa de límites y zonificación (simulada - puedes reemplazar con datos reales de JP)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 20,
        opacity: 0.6
      })
    ])
  };
  
  // Agregar capa por defecto
  mapLayers[currentLayer].addTo(map);
  
  // Agregar control de zoom personalizado
  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  // Agregar escala al mapa
  L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
  }).addTo(map);

  // Mapa limpio - sin datos predefinidos
  // Los usuarios crearán sus propios marcadores haciendo click
  
  // Inicializar eventos del mapa
  // Centrar el mapa en Puerto Rico
  map.setView([18.2208, -66.5901], 9);

  // Manejar clicks en el mapa
  map.on('click', function(e) {
    // Si se hizo click en un marcador o popup, no hacer nada
    if (e.originalEvent.target.closest('.leaflet-marker-icon') || 
        e.originalEvent.target.closest('.leaflet-popup') ||
        e.originalEvent.target.closest('.leaflet-div-icon')) {
      return;
    }
    
    // Cerrar sidebar si está abierto
    closeSidebar();
    
    // Crear marcador temporal con botón para formulario
    createLocationMarker(e.latlng.lat, e.latlng.lng);
  });

  // Inicializar controles del mapa
  initMapControls();
});

// ========== FUNCIONES DE CONTROLES DEL MAPA ==========

function initMapControls() {
  // Solo inicializar los controles que existen en el nuevo diseño
  initMapEvents();
  // Los otros controles (búsqueda, coordenadas, capas, geolocalización) fueron removidos en el nuevo diseño
}

// Búsqueda de direcciones - DESHABILITADO en el nuevo diseño
/*
function initAddressSearch() {
  const searchInput = document.getElementById('addressSearch');
  const searchResults = document.getElementById('searchResults');
  const clearBtn = document.getElementById('clearSearch');
  let searchTimeout;

  searchInput.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length < 3) {
      searchResults.style.display = 'none';
      clearBtn.style.display = 'none';
      return;
    }

    clearBtn.style.display = 'block';
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
      searchAddress(query);
    }, 300);
  });

  clearBtn.addEventListener('click', function() {
    searchInput.value = '';
    searchResults.style.display = 'none';
    clearBtn.style.display = 'none';
    if (searchMarker) {
      map.removeLayer(searchMarker);
      searchMarker = null;
    }
  });

  // Cerrar resultados al hacer clic fuera
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-container')) {
      searchResults.style.display = 'none';
    }
  });
}

async function searchAddress(query) {
  try {
    // Buscar en Puerto Rico específicamente
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Puerto Rico')}&limit=5&addressdetails=1&bounded=1&viewbox=-67.3,18.6,-65.2,17.9`);
    const results = await response.json();

    showSearchResults(results);
  } catch (error) {
    console.error('Error en búsqueda:', error);
    showNotification('Error en la búsqueda de direcciones', 'error');
  }
}

function showSearchResults(results) {
  const searchResults = document.getElementById('searchResults');
  
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-result">No se encontraron resultados</div>';
    searchResults.style.display = 'block';
    return;
  }

  const html = results.map(result => `
    <div class="search-result" onclick="selectSearchResult(${result.lat}, ${result.lon}, '${result.display_name.replace(/'/g, "\\'")}')">
      <div style="font-weight: 500; margin-bottom: 0.25rem;">${result.display_name.split(',')[0]}</div>
      <div style="font-size: 0.75rem; color: var(--text-secondary);">${result.display_name}</div>
    </div>
  `).join('');

  searchResults.innerHTML = html;
  searchResults.style.display = 'block';
}

function selectSearchResult(lat, lon, name) {
  // Centrar mapa en resultado
  map.setView([lat, lon], 16);
  
  // Agregar/actualizar marcador
  if (searchMarker) {
    map.removeLayer(searchMarker);
  }
  
  searchMarker = L.marker([lat, lon])
    .addTo(map)
    .bindPopup(`📍 ${name}`)
    .openPopup();

  // Actualizar coordenadas
  updateCoordinateInputs(lat, lon);
  
  // Ocultar resultados
  document.getElementById('searchResults').style.display = 'none';
  
  showNotification(`Ubicación encontrada: ${name.split(',')[0]}`, 'success');
}

// Control de coordenadas
function initCoordinatesControl() {
  const latInput = document.getElementById('latitude');
  const lonInput = document.getElementById('longitude');
  const goBtn = document.getElementById('goToCoordinates');

  // Actualizar coordenadas al mover el mapa
  map.on('moveend', function() {
    const center = map.getCenter();
    if (!latInput.matches(':focus') && !lonInput.matches(':focus')) {
      updateCoordinateInputs(center.lat, center.lng);
    }
  });

  // Ir a coordenadas específicas
  goBtn.addEventListener('click', function() {
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);

    if (isNaN(lat) || isNaN(lon)) {
      showNotification('Por favor ingrese coordenadas válidas', 'error');
      return;
    }

    // Verificar que esté en Puerto Rico
    if (lat < 17.9 || lat > 18.6 || lon < -67.3 || lon > -65.2) {
      showNotification('Las coordenadas deben estar dentro de Puerto Rico', 'error');
      return;
    }

    map.setView([lat, lon], 16);
    
    // Agregar marcador temporal
    if (coordinatesMarker) {
      map.removeLayer(coordinatesMarker);
    }
    
    coordinatesMarker = L.marker([lat, lon])
      .addTo(map)
      .bindPopup(`📍 Coordenadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`)
      .openPopup();

    showNotification(`Navegando a coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
  });

  // Validar entrada de coordenadas
  [latInput, lonInput].forEach(input => {
    input.addEventListener('input', function() {
      const value = parseFloat(this.value);
      if (!isNaN(value)) {
        if (input === latInput && (value < 17.9 || value > 18.6)) {
          this.style.borderColor = 'var(--danger-color)';
        } else if (input === lonInput && (value < -67.3 || value > -65.2)) {
          this.style.borderColor = 'var(--danger-color)';
        } else {
          this.style.borderColor = 'var(--border-color)';
        }
      }
    });
  });
}

function updateCoordinateInputs(lat, lon) {
  // Ya no usamos los controles de coordenadas flotantes en el nuevo diseño
  // Esta función se mantiene por compatibilidad pero podría ser removida
  console.log(`Coordenadas actualizadas: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
}

// Control de capas
function initLayersControl() {
  const layersToggle = document.getElementById('layersToggle');
  const layersMenu = document.getElementById('layersMenu');
  const layerOptions = document.querySelectorAll('.layer-option');

  layersToggle.addEventListener('click', function() {
    layersMenu.style.display = layersMenu.style.display === 'block' ? 'none' : 'block';
  });

  layerOptions.forEach(option => {
    option.addEventListener('click', function() {
      const layerType = this.dataset.layer;
      switchMapLayer(layerType);
      
      // Actualizar botón activo
      layerOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');
      
      layersMenu.style.display = 'none';
    });
  });

  // Cerrar menú al hacer clic fuera
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.layers-container')) {
      layersMenu.style.display = 'none';
    }
  });
}

function switchMapLayer(layerType) {
  if (mapLayers[currentLayer]) {
    map.removeLayer(mapLayers[currentLayer]);
  }
  
  if (mapLayers[layerType]) {
    mapLayers[layerType].addTo(map);
    currentLayer = layerType;
    showNotification(`Capa cambiada a: ${getLayerName(layerType)}`, 'success');
  }
}

function getLayerName(layerType) {
  const names = {
    planning: 'Planificación',
    street: 'Calles',
    satellite: 'Satélite',
    hybrid: 'Híbrido',
    terrain: 'Terreno'
  };
  return names[layerType] || layerType;
}

// Geolocalización
function initGeolocation() {
  const locationBtn = document.getElementById('myLocation');

  locationBtn.addEventListener('click', function() {
    if (!navigator.geolocation) {
      showNotification('La geolocalización no está disponible en este navegador', 'error');
      return;
    }

    locationBtn.classList.add('loading');
    locationBtn.innerHTML = '<i class="fas fa-spinner"></i>';

    navigator.geolocation.getCurrentPosition(
      function(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        // Verificar que esté en Puerto Rico o cerca
        if (lat < 17.5 || lat > 19.0 || lon < -68.0 || lon > -65.0) {
          showNotification('Tu ubicación parece estar fuera de Puerto Rico', 'warning');
        }

        map.setView([lat, lon], 16);
        updateCoordinateInputs(lat, lon);

        // Agregar marcador de ubicación
        if (coordinatesMarker) {
          map.removeLayer(coordinatesMarker);
        }
        
        coordinatesMarker = L.marker([lat, lon])
          .addTo(map)
          .bindPopup('📍 Tu ubicación actual')
          .openPopup();

        showNotification('Ubicación encontrada exitosamente', 'success');
        
        locationBtn.classList.remove('loading');
        locationBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
      },
      function(error) {
        let message = 'Error obteniendo ubicación';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permiso de ubicación denegado';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Ubicación no disponible';
            break;
          case error.TIMEOUT:
            message = 'Tiempo agotado obteniendo ubicación';
            break;
        }
        
        showNotification(message, 'error');
        locationBtn.classList.remove('loading');
        locationBtn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

// Eventos del mapa
function initMapEvents() {
  // Actualizar coordenadas al hacer clic en el mapa
  map.on('click', function(e) {
    updateCoordinateInputs(e.latlng.lat, e.latlng.lng);
  });

  // Guardar última vista del mapa
  map.on('moveend zoomend', function() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    localStorage.setItem('mapView', JSON.stringify({
      lat: center.lat,
      lng: center.lng,
      zoom: zoom
    }));
  });

  // Restaurar vista del mapa
  const savedView = localStorage.getItem('mapView');
  if (savedView) {
    try {
      const view = JSON.parse(savedView);
      map.setView([view.lat, view.lng], view.zoom);
    } catch (e) {
      console.log('Error restaurando vista del mapa');
    }
  }
}

function openSidebar(feature) {
  currentFeature = feature;
  const fid = feature.properties.feature_uid;
  
  // Actualizar título
  document.getElementById('sidebarTitle').textContent = feature.properties.title;
  
  // Mostrar sidebar
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.add('active');
  
  // Contenido del sidebar
  const html = `
    <div class="fade-in">
      <div style="margin-bottom: 1.5rem;">
        <p style="color: var(--text-secondary); line-height: 1.6;">${feature.properties.description}</p>
      </div>
      
      <div class="comment-form">
        <div class="form-title">
          <i class="fas fa-comment-plus"></i>
          Agregar comentario
        </div>
        <form onsubmit="submitComment(event)">
          <div class="input-group">
            <label for="user">Nombre</label>
            <input type="text" id="user" name="user" placeholder="Ingrese su nombre completo" required>
          </div>

          <div class="input-group">
            <label for="email">Correo Electrónico</label>
            <input type="email" id="email" name="email" placeholder="ejemplo@email.com" required>
          </div>
          
          <div class="input-group">
            <label for="municipality">Municipio de Residencia <span style="color: red;">*</span></label>
            <select id="municipality" name="municipality" required>
              <option value="">-Please select-</option>
              <option value="Adjuntas">Adjuntas</option>
              <option value="Aguada">Aguada</option>
              <option value="Aguadilla">Aguadilla</option>
              <option value="Aguas Buenas">Aguas Buenas</option>
              <option value="Aibonito">Aibonito</option>
              <option value="Arecibo">Arecibo</option>
              <option value="Arroyo">Arroyo</option>
              <option value="Barceloneta">Barceloneta</option>
              <option value="Barranquitas">Barranquitas</option>
              <option value="Bayamón">Bayamón</option>
              <option value="Cabo Rojo">Cabo Rojo</option>
              <option value="Caguas">Caguas</option>
              <option value="Camuy">Camuy</option>
              <option value="Canóvanas">Canóvanas</option>
              <option value="Carolina">Carolina</option>
              <option value="Cataño">Cataño</option>
              <option value="Cayey">Cayey</option>
              <option value="Cidra">Cidra</option>
              <option value="Coamo">Coamo</option>
              <option value="Comerío">Comerío</option>
              <option value="Corozal">Corozal</option>
              <option value="Culebra">Culebra</option>
              <option value="Dorado">Dorado</option>
              <option value="Fajardo">Fajardo</option>
              <option value="Florida">Florida</option>
              <option value="Guánica">Guánica</option>
              <option value="Guayama">Guayama</option>
              <option value="Guayanilla">Guayanilla</option>
              <option value="Guaynabo">Guaynabo</option>
              <option value="Gurabo">Gurabo</option>
              <option value="Hatillo">Hatillo</option>
              <option value="Hormigueros">Hormigueros</option>
              <option value="Humacao">Humacao</option>
              <option value="Isabela">Isabela</option>
              <option value="Jayuya">Jayuya</option>
              <option value="Juana Díaz">Juana Díaz</option>
              <option value="Juncos">Juncos</option>
              <option value="Lajas">Lajas</option>
              <option value="Lares">Lares</option>
              <option value="Las Marías">Las Marías</option>
              <option value="Las Piedras">Las Piedras</option>
              <option value="Loíza">Loíza</option>
              <option value="Luquillo">Luquillo</option>
              <option value="Manatí">Manatí</option>
              <option value="Maricao">Maricao</option>
              <option value="Maunabo">Maunabo</option>
              <option value="Mayagüez">Mayagüez</option>
              <option value="Moca">Moca</option>
              <option value="Morovis">Morovis</option>
              <option value="Naguabo">Naguabo</option>
              <option value="Naranjito">Naranjito</option>
              <option value="Orocovis">Orocovis</option>
              <option value="Patillas">Patillas</option>
              <option value="Peñuelas">Peñuelas</option>
              <option value="Ponce">Ponce</option>
              <option value="Quebradillas">Quebradillas</option>
              <option value="Rincón">Rincón</option>
              <option value="Río Grande">Río Grande</option>
              <option value="Sabana Grande">Sabana Grande</option>
              <option value="Salinas">Salinas</option>
              <option value="San Germán">San Germán</option>
              <option value="San Juan">San Juan</option>
              <option value="San Lorenzo">San Lorenzo</option>
              <option value="San Sebastián">San Sebastián</option>
              <option value="Santa Isabel">Santa Isabel</option>
              <option value="Toa Alta">Toa Alta</option>
              <option value="Toa Baja">Toa Baja</option>
              <option value="Trujillo Alto">Trujillo Alto</option>
              <option value="Utuado">Utuado</option>
              <option value="Vega Alta">Vega Alta</option>
              <option value="Vega Baja">Vega Baja</option>
              <option value="Vieques">Vieques</option>
              <option value="Villalba">Villalba</option>
              <option value="Yabucoa">Yabucoa</option>
              <option value="Yauco">Yauco</option>
            </select>
          </div>
          
          <div class="input-group">
            <label for="entity">Entidad</label>
            <input type="text" id="entity" name="entity" placeholder="Nombre de la organización o entidad">
          </div>
          
          <div class="input-group">
            <label for="text">Comentarios <span style="color: red;">*</span></label>
            <textarea id="text" name="text" rows="4" placeholder="Escriba sus comentarios aquí..." required maxlength="1000"></textarea>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; text-align: right;">
              <span id="char-counter">0</span>/1000
            </div>
          </div>
          
          <div class="input-group">
            <label for="file">Archivo adjunto (opcional)</label>
            <input type="file" id="file" name="file" accept=".png,.jpg,.jpeg,.gif,.pdf,.doc,.docx,.txt" onchange="validateFileClient(this)">
            <div class="file-validation-info" style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">
              <i class="fas fa-info-circle"></i>
              Tipos permitidos: PNG, JPG, GIF, PDF, DOC, DOCX, TXT (máx. 10MB)
            </div>
            <div id="file-validation-message" style="display: none; margin-top: 0.5rem; padding: 0.5rem; border-radius: 4px;"></div>
          </div>
          
          <button type="submit" class="btn btn-primary">
            <i class="fas fa-paper-plane"></i>
            Enviar comentario
          </button>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('sidebarContent').innerHTML = html;
  
  // Configurar contador de caracteres para el textarea
  const textArea = document.getElementById('text');
  const charCounter = document.getElementById('char-counter');
  
  if (textArea && charCounter) {
    textArea.addEventListener('input', function() {
      const currentLength = this.value.length;
      charCounter.textContent = currentLength;
      
      // Cambiar color si se acerca al límite
      if (currentLength > 900) {
        charCounter.style.color = '#dc2626'; // Rojo
      } else if (currentLength > 750) {
        charCounter.style.color = '#f59e0b'; // Amarillo
      } else {
        charCounter.style.color = 'var(--text-secondary)'; // Color normal
      }
    });
  }
  
  // Cargar comentarios
  loadComments(fid);
}

function loadComments(featureId) {
  fetch(`/comments/${featureId}`)
    .then(r => r.json())
    .then(comments => {
      const commentsDiv = document.getElementById('comments');
      
      if (comments.length === 0) {
        commentsDiv.innerHTML = `
          <div class="empty-comments">
            <i class="fas fa-comments"></i>
            <h4>Sin comentarios</h4>
            <p>Sé el primero en comentar sobre esta ubicación</p>
          </div>
        `;
      } else {
        let html = '<div class="comments-title"><i class="fas fa-comments"></i> Comentarios</div>';
        comments.forEach(comment => {
          html += `
            <div class="comment-card">
              <div class="comment-header">
                <div class="comment-user">
                  <i class="fas fa-user-circle"></i>
                  <span>${comment.user}</span>
                </div>
                <div class="comment-date">${formatDate(comment.created_at)}</div>
              </div>
              <div class="comment-text">${comment.text}</div>
              ${comment.file_path ? `
                <div class="comment-attachment">
                  <i class="fas fa-paperclip"></i>
                  <a href="/${comment.file_path}" target="_blank">Ver archivo adjunto</a>
                </div>
              ` : ''}
            </div>
          `;
        });
        commentsDiv.innerHTML = html;
      }
    })
    .catch(error => {
      console.error('Error cargando comentarios:', error);
      document.getElementById('comments').innerHTML = `
        <div class="error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error cargando comentarios</p>
        </div>
      `;
    });
}

function submitComment(event) {
  event.preventDefault();
  
  if (!currentFeature) return;
  
  const form = event.target;
  const formData = new FormData(form);
  formData.append('feature_id', currentFeature.properties.feature_uid);
  
  // Cambiar botón a estado de carga
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  submitBtn.disabled = true;
  
  fetch('/comment', {
    method: 'POST',
    body: formData
  })
  .then(r => r.json())
  .then(result => {
    if (result.status === 'ok') {
      showNotification('Comentario enviado exitosamente', 'success');
      form.reset();
      loadComments(currentFeature.properties.feature_uid);
    } else {
      showNotification('Error enviando comentario: ' + (result.error || 'Error desconocido'), 'error');
    }
  })
  .catch(error => {
    console.error('Error enviando comentario:', error);
    showNotification('Error enviando comentario', 'error');
  })
  .finally(() => {
    // Restaurar botón
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  });
}

// Crear marcador en ubicación seleccionada
function createLocationMarker(lat, lng) {
  // Remover marcador anterior si existe
  if (window.currentLocationMarker) {
    map.removeLayer(window.currentLocationMarker);
  }
  
  // Crear marcador con icono personalizado
  window.currentLocationMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'location-marker',
      html: '<i class="fas fa-map-pin"></i>',
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

// Funciones del formulario de solicitudes
function updateCoordinateDisplays(lat, lng) {
  // Actualizar los campos de coordenadas en el formulario
  const latDisplay = document.getElementById('lat-display');
  const lngDisplay = document.getElementById('lng-display');
  
  if (latDisplay) latDisplay.value = lat.toFixed(6);
  if (lngDisplay) lngDisplay.value = lng.toFixed(6);
  
  // También actualizar los campos hidden para el envío del formulario
  const latInput = document.querySelector('input[name="lat"]');
  const lngInput = document.querySelector('input[name="lng"]');
  
  if (latInput) latInput.value = lat;
  if (lngInput) lngInput.value = lng;
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
  
  // Enfocar el primer campo
  const nameInput = document.getElementById('name');
  if (nameInput) nameInput.focus();
}

function showCommentForm() {
  // Esta función ya no es necesaria porque el formulario siempre está visible
  // Solo enfocar el primer campo
  const nameInput = document.getElementById('name');
  if (nameInput) nameInput.focus();
}

function showCommentFormAtLocation(lat, lng) {
  // Actualizar coordenadas y enfocar formulario
  updateCoordinateDisplays(lat, lng);
  
  // Scroll hacia el formulario
  const formSection = document.querySelector('.form-card');
  if (formSection) {
    formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  // Enfocar el primer campo
  setTimeout(() => {
    const nameInput = document.getElementById('name');
    if (nameInput) nameInput.focus();
  }, 100);
}

function hideCommentForm() {
  // Esta función ya no es necesaria porque el formulario siempre está visible
  // Solo limpiar el formulario
  resetForm();
}

// Manejo del formulario de upload
document.addEventListener('DOMContentLoaded', function() {
  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUploadSubmit);
  }
  
  // Inicializar manejo de archivos
  initFileUpload();
});

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

function updateFileUploadDisplay(file) {
  const fileUploadContent = document.querySelector('.file-upload-content');
  
  if (!file) {
    // Restaurar estado inicial
    fileUploadContent.innerHTML = `
      <i class="fas fa-cloud-upload-alt file-upload-icon"></i>
      <div class="file-upload-text">Seleccionar archivo</div>
      <div class="file-upload-hint">Formatos permitidos: PDF, Word, TXT, JPG, PNG, ZIP (máx. 10MB)</div>
    `;
    return;
  }
  
  // Validar archivo
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  
  if (file.size > maxSize) {
    fileUploadContent.innerHTML = `
      <i class="fas fa-exclamation-triangle file-upload-icon" style="color: #dc3545;"></i>
      <div class="file-upload-text" style="color: #dc3545;">Archivo muy grande</div>
      <div class="file-upload-hint">El archivo debe ser menor a 10MB</div>
    `;
    document.getElementById('file').value = '';
    return;
  }
  
  if (!allowedTypes.includes(fileExtension)) {
    fileUploadContent.innerHTML = `
      <i class="fas fa-exclamation-triangle file-upload-icon" style="color: #dc3545;"></i>
      <div class="file-upload-text" style="color: #dc3545;">Tipo de archivo no permitido</div>
      <div class="file-upload-hint">Formatos permitidos: PDF, Word, TXT, JPG, PNG, ZIP</div>
    `;
    document.getElementById('file').value = '';
    return;
  }
  
  // Mostrar archivo seleccionado
  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  fileUploadContent.innerHTML = `
    <i class="fas fa-file file-upload-icon" style="color: var(--success);"></i>
    <div class="file-upload-text" style="color: var(--success);">${file.name}</div>
    <div class="file-upload-hint">${fileSize} MB - Haz clic para cambiar</div>
  `;
}

function handleUploadSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  // Validar que se haya seleccionado una ubicación
  const latValue = formData.get('lat');
  const lngValue = formData.get('lng');
  
  if (!latValue || !lngValue) {
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
  
  // Cambiar botón a estado de carga
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  submitBtn.disabled = true;
  
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
  });
}