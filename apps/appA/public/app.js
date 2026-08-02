const API_BASE = '/api/workspaces';

// State
let workspaces = [];
let editingId = null;
let deletingId = null;

// DOM Elements
const workspaceList = document.getElementById('workspaceList');
const createBtn = document.getElementById('createBtn');
const modal = document.getElementById('modal');
const deleteModal = document.getElementById('deleteModal');
const modalTitle = document.getElementById('modalTitle');
const workspaceForm = document.getElementById('workspaceForm');
const nameInput = document.getElementById('nameInput');
const descInput = document.getElementById('descInput');
const nameError = document.getElementById('nameError');
const cancelBtn = document.getElementById('cancelBtn');
const deleteName = document.getElementById('deleteName');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');

// Load workspaces
async function loadWorkspaces() {
  try {
    const res = await fetch(API_BASE);
    workspaces = await res.json();
    renderWorkspaces();
  } catch (err) {
    workspaceList.innerHTML = '<div class="loading">Failed to load workspaces. Make sure the server is running.</div>';
  }
}

// Render workspace list
function renderWorkspaces() {
  if (workspaces.length === 0) {
    workspaceList.innerHTML = `
      <div class="empty-state">
        <p>No workspaces yet. Create one to get started!</p>
        <button class="btn btn-primary" onclick="openCreateModal()">+ Create Workspace</button>
      </div>`;
    return;
  }

  workspaceList.innerHTML = workspaces.map(ws => `
    <div class="workspace-card">
      <div class="workspace-info" onclick="navigateToWorkspace('${ws.id}')">
        <h3>${escapeHtml(ws.name)}</h3>
        ${ws.description ? `<p>${escapeHtml(ws.description)}</p>` : ''}
        <div class="workspace-meta">Created ${formatDate(ws.created_at)}</div>
      </div>
      <div class="workspace-actions">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); openEditModal('${ws.id}')">✏️ Rename</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); openDeleteModal('${ws.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Create workspace
async function createWorkspace(name, description) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create workspace');
  }
  return res.json();
}

// Update workspace
async function updateWorkspace(id, name) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to update workspace');
  return res.json();
}

// Delete workspace
async function deleteWorkspace(id) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete workspace');
}

// Modal handlers
function openCreateModal() {
  editingId = null;
  modalTitle.textContent = 'Create Workspace';
  nameInput.value = '';
  descInput.value = '';
  nameError.classList.add('hidden');
  modal.classList.remove('hidden');
  nameInput.focus();
}

function openEditModal(id) {
  const ws = workspaces.find(w => w.id === id);
  if (!ws) return;
  editingId = id;
  modalTitle.textContent = 'Rename Workspace';
  nameInput.value = ws.name;
  descInput.value = ws.description || '';
  nameError.classList.add('hidden');
  modal.classList.remove('hidden');
  nameInput.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

function openDeleteModal(id) {
  const ws = workspaces.find(w => w.id === id);
  if (!ws) return;
  deletingId = id;
  deleteName.textContent = ws.name;
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  deletingId = null;
}

// Form submit
workspaceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();

  if (!name) {
    nameError.classList.remove('hidden');
    return;
  }
  nameError.classList.add('hidden');

  try {
    if (editingId) {
      await updateWorkspace(editingId, name);
    } else {
      await createWorkspace(name, descInput.value.trim());
    }
    closeModal();
    await loadWorkspaces();
  } catch (err) {
    nameError.textContent = err.message;
    nameError.classList.remove('hidden');
  }
});

// Delete confirmation
deleteConfirmBtn.addEventListener('click', async () => {
  if (!deletingId) return;
  try {
    await deleteWorkspace(deletingId);
    closeDeleteModal();
    await loadWorkspaces();
  } catch (err) {
    alert('Failed to delete workspace: ' + err.message);
  }
});

// Event listeners
createBtn.addEventListener('click', openCreateModal);
cancelBtn.addEventListener('click', closeModal);
deleteCancelBtn.addEventListener('click', closeDeleteModal);

// Close modals on overlay click
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
  }
});

// Navigate to workspace
function navigateToWorkspace(id) {
  window.location.href = `/workspace.html?id=${id}`;
}

// Utility: escape HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Utility: format date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Initial load
loadWorkspaces();
