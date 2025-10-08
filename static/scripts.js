// Variables globales
let map;
let currentFeature = null;

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
  map = L.map('map').setView([18.45, -66.1], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Datos © OpenStreetMap'
  }).addTo(map);

  // Cargar datos GeoJSON
  fetch('/data.geojson')
    .then(r => r.json())
    .then(geojson => {
      const layer = L.geoJSON(geojson, {
        onEachFeature: function(feat, layer) {
          layer.bindPopup(`<b>${feat.properties.title}</b><br>${feat.properties.description}`);
          layer.on('click', () => openSidebar(feat));
        }
      }).addTo(map);
      map.fitBounds(layer.getBounds());
      
      // Verificar si hay un feature específico en la URL
      const urlParams = new URLSearchParams(window.location.search);
      const targetFeatureId = urlParams.get('feature');
      
      if (targetFeatureId) {
        // Buscar el feature correspondiente
        const targetFeature = geojson.features.find(feature => 
          feature.properties.feature_uid === targetFeatureId
        );
        
        if (targetFeature) {
          // Centrar el mapa en esa ubicación
          const coords = targetFeature.geometry.coordinates;
          map.setView([coords[1], coords[0]], 15);
          
          // Abrir el sidebar automáticamente
          setTimeout(() => {
            openSidebar(targetFeature);
            showNotification('Ubicación encontrada desde el panel de administración', 'success');
          }, 500);
        } else {
          showNotification('Ubicación no encontrada', 'error');
        }
      }
    })
    .catch(error => {
      console.error('Error cargando GeoJSON:', error);
      showNotification('Error cargando los datos del mapa', 'error');
    });

  // Cerrar sidebar al hacer clic en el mapa
  map.on('click', function(e) {
    if (!e.originalEvent.target.closest('.leaflet-marker-icon')) {
      closeSidebar();
    }
  });
});

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
            <label for="user">Nombre (opcional)</label>
            <input type="text" id="user" name="user" placeholder="Tu nombre...">
          </div>
          
          <div class="input-group">
            <label for="text">Comentario</label>
            <textarea id="text" name="text" rows="3" placeholder="Escribe tu comentario..."></textarea>
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