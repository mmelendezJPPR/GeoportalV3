// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar mapa
    const map = L.map('map').setView([18.45, -66.1], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'Datos © OpenStreetMap'
    }).addTo(map);

    let currentFeature = null;

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
          
          <div id="comments">
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
              <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 1rem;"></i>
              <p>Cargando comentarios...</p>
            </div>
          </div>
          
          <div class="comment-form">
            <div class="form-title">
              <i class="fas fa-comment-plus"></i>
              Agregar comentario
            </div>
            <form id="commentForm" enctype="multipart/form-data">
              <input type="hidden" name="feature_id" value="${fid}"/>
              
              <div class="form-group">
                <label class="form-label">Nombre</label>
                <input class="form-input" name="user" placeholder="Tu nombre" required/>
              </div>
              
              <div class="form-group">
                <label class="form-label">Comentario</label>
                <textarea class="form-input form-textarea" name="text" placeholder="Escribe tu comentario..." required></textarea>
              </div>
              
              <div class="form-group">
                <label class="form-label">Archivo adjunto (opcional)</label>
                <div class="file-input-wrapper">
                  <input type="file" name="file" class="file-input" id="fileInput"/>
                  <label for="fileInput" class="file-input-label">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>Seleccionar archivo</span>
                  </label>
                </div>
              </div>
              
              <button type="submit" class="submit-btn">
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
      
      // Configurar formulario
      setupCommentForm();
      
      // Actualizar texto del input de archivo
      document.getElementById('fileInput').addEventListener('change', function(e) {
        const label = document.querySelector('.file-input-label span');
        if (e.target.files.length > 0) {
          label.textContent = e.target.files[0].name;
        } else {
          label.textContent = 'Seleccionar archivo';
        }
      });
    }

    function loadComments(featureId) {
      fetch(`/comments/${featureId}`)
        .then(r => r.json())
        .then(data => {
          const cdiv = document.getElementById('comments');
          if (data.length === 0) {
            cdiv.innerHTML = `
              <div class="empty-state">
                <i class="fas fa-comments"></i>
                <h3>No hay comentarios</h3>
                <p>Sé el primero en comentar sobre este lugar.</p>
              </div>
            `;
          } else {
            cdiv.innerHTML = data.map(c => `
              <div class="comment fade-in">
                <div class="comment-header">
                  <div class="comment-author">
                    <i class="fas fa-user-circle"></i>
                    ${c.user}
                  </div>
                  <div class="comment-date">${formatDate(c.created_at)}</div>
                </div>
                <div class="comment-text">${c.text}</div>
                ${c.file_path ? `
                  <a href='/${c.file_path}' target='_blank' class="comment-attachment">
                    <i class="fas fa-paperclip"></i>
                    Ver adjunto
                  </a>
                ` : ''}
              </div>
            `).join('');
          }
        })
        .catch(err => {
          console.error('Error loading comments:', err);
          document.getElementById('comments').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
              <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 1rem;"></i>
              <p>Error al cargar comentarios</p>
            </div>
          `;
        });
    }

    function setupCommentForm() {
      const form = document.getElementById('commentForm');
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        // Mostrar estado de carga
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        submitBtn.disabled = true;
        
        const fd = new FormData(form);
        fetch('/comment', { method: 'POST', body: fd })
          .then(r => r.json())
          .then(resp => {
            if (resp.status == "ok") {
              showNotification("Comentario enviado correctamente", "success");
              form.reset();
              document.querySelector('.file-input-label span').textContent = 'Seleccionar archivo';
              loadComments(currentFeature.properties.feature_uid);
            } else {
              showNotification("Error al enviar comentario: " + JSON.stringify(resp), "error");
            }
          })
          .catch(err => {
            showNotification("Error de conexión", "error");
          })
          .finally(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
          });
      });
    }

    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('active');
    }

    function toggleInfo() {
      // Función para mostrar información de la app
      showNotification("Haz clic en cualquier punto del mapa para ver y agregar comentarios", "success");
    }

    function formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    function showNotification(message, type = 'success') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
          <span>${message}</span>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => notification.classList.add('show'), 100);
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
      }, 3000);
    }

    // Cerrar sidebar al hacer clic en el mapa
    map.on('click', function(e) {
      if (!e.originalEvent.target.closest('.leaflet-marker-icon')) {
        closeSidebar();
      }
    });

}); // Fin del DOMContentLoaded