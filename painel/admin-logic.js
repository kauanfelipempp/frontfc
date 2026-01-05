// admin-logic.js
var API_URL_ADMIN = 'https://serverfc.onrender.com/api';

// Variáveis de Estado
let editingProductId = null;
let ordersData = []; // Lista global de pedidos
let categoriesData = []; // Lista global de categorias
let currentOrderId = null; // ID do pedido aberto no modal

/* --- SISTEMA DE NOTIFICAÇÕES (UI CUSTOMIZADA) --- */

function ensureToastContainer() {
    if (!document.getElementById('toast-container')) {
        const div = document.createElement('div');
        div.id = 'toast-container';
        document.body.appendChild(div);
    }
}

window.showToast = function (message, type = 'success') {
    ensureToastContainer();
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-closing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};

window.showConfirm = function (title, text) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay active';
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <h3 class="custom-modal-title">${title}</h3>
                <p class="custom-modal-text">${text}</p>
                <div class="custom-modal-buttons">
                    <button class="btn-modal btn-cancel" id="modal-cancel">Cancelar</button>
                    <button class="btn-modal btn-confirm" id="modal-ok">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const btnOk = overlay.querySelector('#modal-ok');
        const btnCancel = overlay.querySelector('#modal-cancel');

        function close(result) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(result);
        }

        btnOk.addEventListener('click', () => close(true));
        btnCancel.addEventListener('click', () => close(false));
    });
};

window.showPrompt = function (title, text) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay active';
        overlay.innerHTML = `
            <div class="custom-modal-box">
                <h3 class="custom-modal-title">${title}</h3>
                <p class="custom-modal-text">${text}</p>
                <input type="text" class="custom-modal-input" id="modal-input" placeholder="Digite aqui...">
                <div class="custom-modal-buttons">
                    <button class="btn-modal btn-cancel" id="modal-cancel">Cancelar</button>
                    <button class="btn-modal btn-confirm" id="modal-ok">Salvar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#modal-input');
        const btnOk = overlay.querySelector('#modal-ok');
        const btnCancel = overlay.querySelector('#modal-cancel');

        input.focus();

        function close(value) {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
            resolve(value);
        }

        btnOk.addEventListener('click', () => close(input.value));
        btnCancel.addEventListener('click', () => close(null));

        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') close(input.value);
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const isAdmin = localStorage.getItem('isAdmin');

    if (!token || isAdmin !== 'true') {
        alert("Acesso restrito a administradores. Faça login novamente.");
        window.location.href = '../login.html';
        return;
    }

    setupImagePreview();
    setupListeners();
    loadData();
});

function setupListeners() {
    const prodForm = document.getElementById('add-product-form');
    if (prodForm) prodForm.addEventListener('submit', handleProductSubmit);

    const couponForm = document.getElementById('add-coupon-form');
    if (couponForm) couponForm.addEventListener('submit', handleCouponSubmit);

    const catForm = document.getElementById('add-category-form');
    if (catForm) {
        catForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('token');
            const data = {
                title: document.getElementById('cat-title').value,
                description: document.getElementById('cat-desc').value
            };

            try {
                await fetch(`${API_URL_ADMIN}/categories`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': token },
                    body: JSON.stringify(data)
                });

                catForm.reset();
                loadCategories();
                showToast("Categoria criada com sucesso!", "success");
            } catch (err) {
                console.error(err);
                showToast("Erro ao criar categoria.", "error");
            }
        });
    }

    const searchInput = document.getElementById('search-order-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', window.filterOrders);
    }
}

function loadData() {
    loadDashboard();
    loadCategories();
    loadProducts();
    loadOrders();
    loadUsers();
    loadCoupons();
}

// --- DASHBOARD ---
async function loadDashboard() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL_ADMIN}/orders`, {
            headers: { 'Authorization': token }
        });
        if (!res.ok) return;

        const orders = await res.json();

        const kpiOrders = document.getElementById('kpi-orders');
        const kpiMoney = document.getElementById('kpi-money');

        if (kpiOrders) kpiOrders.textContent = orders.length;
        if (kpiMoney) {
            const total = orders.reduce((acc, o) => acc + (o.total || 0), 0);
            kpiMoney.textContent = `R$ ${total.toFixed(2)}`;
        }
    } catch (e) { console.error("Erro dashboard:", e); }
}

// --- CATEGORIAS ---

async function loadCategories() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL_ADMIN}/categories`, { headers: { 'Authorization': token } });
        if (res.ok) {
            categoriesData = await res.json();
            renderCategoryList();
            updateProductSelect();
        }
    } catch (e) { console.error(e); }
}

function renderCategoryList() {
    const list = document.getElementById('category-list');
    if (!list) return; // CORREÇÃO: Verifica se o elemento existe

    list.innerHTML = categoriesData.map((cat, index) => `
        <div class="list-item" id="cat-${cat._id}" style="display:flex; align-items:center; gap:10px; background:#1a1a1a;">
            <div style="display:flex; flex-direction:column; gap:2px;">
                <button onclick="moveCategory(${index}, -1)" style="cursor:pointer; background:none; border:none; color:white;">⬆️</button>
                <button onclick="moveCategory(${index}, 1)" style="cursor:pointer; background:none; border:none; color:white;">⬇️</button>
            </div>
            <div class="list-info">
                <strong>${cat.title}</strong>
                <p style="font-size:0.8rem; color:#888;">${cat.description || ''}</p>
            </div>
            <button class="delete-btn" onclick="deleteCategory('${cat._id}')">X</button>
        </div>
    `).join('');
}

window.deleteCategory = async function (id) {
    const confirmou = await showConfirm("Apagar categoria?", "Produtos nesta categoria ficarão 'sem categoria'.");
    if (!confirmou) return;

    const token = localStorage.getItem('token');
    await fetch(`${API_URL_ADMIN}/categories/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });

    loadCategories();
    showToast("Categoria removida!", "success");
};

window.moveCategory = function (index, direction) {
    if (index + direction < 0 || index + direction >= categoriesData.length) return;
    const temp = categoriesData[index];
    categoriesData[index] = categoriesData[index + direction];
    categoriesData[index + direction] = temp;
    renderCategoryList();
};

window.saveCategoryOrder = async function () {
    const token = localStorage.getItem('token');
    const orderedIds = categoriesData.map(c => c._id);

    const res = await fetch(`${API_URL_ADMIN}/categories/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ orderedIds })
    });

    if (res.ok) showToast("Ordem das categorias atualizada!", "success");
    else showToast("Erro ao salvar ordem.", "error");
};

function updateProductSelect() {
    const select = document.getElementById('prod-cat');
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';

    categoriesData.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.title;
        option.textContent = cat.title;
        select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
}

// --- PRODUTOS ---

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL_ADMIN}/products`);
        const products = await res.json();
        const list = document.getElementById('admin-product-list');

        if (list) { // CORREÇÃO: Verifica se o elemento existe
            list.innerHTML = products.map(p => {
                const pString = encodeURIComponent(JSON.stringify(p));
                return `
                <div class="list-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${p.imagem}" style="width:40px; height:40px; object-fit:cover;">
                        <div class="list-info">
                            <strong>${p.nome}</strong>
                            <small>R$ ${Number(p.preco).toFixed(2)}</small>
                        </div>
                    </div>
                    <div>
                        <button class="edit-btn" onclick="startEdit('${pString}')" style="margin-right:5px; cursor:pointer;">✏️</button>
                        <button class="delete-btn" onclick="deleteProduct('${p._id}')">X</button>
                    </div>
                </div>`;
            }).join('');
        }

        const kpiProd = document.getElementById('kpi-products');
        if (kpiProd) kpiProd.textContent = products.length;

    } catch (e) { console.error(e); }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const fileInput = document.getElementById('prod-file');
    const nome = document.getElementById('prod-nome').value;
    const preco = document.getElementById('prod-preco').value;
    const categoria = document.getElementById('prod-cat').value;
    const sizes = Array.from(document.querySelectorAll('input[name="size"]:checked')).map(el => el.value);
    const colors = document.getElementById('colors').value.split(',').map(c => c.trim());

    let imageUrl = document.getElementById('prod-imagem-hidden')?.value || "";

    try {
        if (fileInput.files.length > 0) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);

            const upRes = await fetch(`${API_URL_ADMIN}/upload`, {
                method: 'POST',
                headers: { 'Authorization': token },
                body: formData
            });
            const upData = await upRes.json();
            if (upRes.ok) imageUrl = upData.imageUrl;
        }

        const productData = { nome, preco, imagem: imageUrl, categoria, sizes, colors };

        let url = `${API_URL_ADMIN}/products`;
        let method = 'POST';

        if (editingProductId) {
            url = `${API_URL_ADMIN}/products/${editingProductId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify(productData)
        });

        if (res.ok) {
            showToast(editingProductId ? "Produto atualizado!" : "Produto criado com sucesso!", "success");
            cancelEdit();
            loadProducts();
        } else {
            showToast("Erro ao salvar produto.", "error");
        }
    } catch (err) { console.error(err); }
}

window.startEdit = function (productStr) {
    const p = JSON.parse(decodeURIComponent(productStr));
    editingProductId = p._id;

    document.getElementById('prod-nome').value = p.nome;
    document.getElementById('prod-preco').value = p.preco;

    updateProductSelect();
    document.getElementById('prod-cat').value = p.categoria || "";
    document.getElementById('prod-imagem-hidden').value = p.imagem;
    document.getElementById('colors').value = p.colors ? p.colors.join(', ') : "";

    document.querySelectorAll('input[name="size"]').forEach(cb => {
        cb.checked = p.sizes && p.sizes.includes(cb.value);
    });

    const btn = document.querySelector('#add-product-form button');
    if (btn) {
        btn.textContent = "SALVAR ALTERAÇÕES";
        btn.style.background = "#ff9900";
    }

    const preview = document.getElementById('preview-img');
    if (preview) {
        preview.src = p.imagem;
        preview.style.display = 'block';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function cancelEdit() {
    editingProductId = null;
    const form = document.getElementById('add-product-form');
    if (form) form.reset();

    const preview = document.getElementById('preview-img');
    if (preview) preview.style.display = 'none';

    const btn = document.querySelector('#add-product-form button');
    if (btn) {
        btn.textContent = "CADASTRAR PRODUTO";
        btn.style.background = "white";
    }
}

window.deleteProduct = async function (id) {
    const confirmou = await showConfirm("Excluir Produto?", "Essa ação não pode ser desfeita.");
    if (!confirmou) return;

    const token = localStorage.getItem('token');
    await fetch(`${API_URL_ADMIN}/products/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });

    loadProducts();
    showToast("Produto removido!", "success");
};

// --- PEDIDOS ---

async function loadOrders() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL_ADMIN}/orders`, { headers: { 'Authorization': token } });
        if (!res.ok) return;

        ordersData = await res.json();
        renderOrderList(ordersData);

        const kpiOrders = document.getElementById('kpi-orders');
        if (kpiOrders) kpiOrders.textContent = ordersData.length;

        const total = ordersData.reduce((acc, o) => acc + (o.total || 0), 0);
        const kpiMoney = document.getElementById('kpi-money');
        if (kpiMoney) kpiMoney.textContent = `R$ ${total.toFixed(2)}`;

    } catch (e) { console.error("Erro orders", e); }
}

function renderOrderList(lista) {
    const listEl = document.getElementById('order-list');
    if (!listEl) return; // CORREÇÃO: Verifica se o elemento existe

    if (lista.length === 0) {
        listEl.innerHTML = '<p style="color:#666; text-align:center; padding:20px;">Nenhum pedido encontrado.</p>';
        return;
    }

    listEl.innerHTML = lista.map((o) => {
        const originalIndex = ordersData.indexOf(o);
        let statusColor = '#ffd700';
        if (o.status === 'Preparando') statusColor = 'orange';
        if (o.status === 'Enviado') statusColor = '#00bfff';
        if (o.status === 'Entregue') statusColor = '#00ff7f';
        if (o.status === 'Cancelado') statusColor = '#ff4444';

        return `
        <div class="list-item" style="flex-wrap:wrap; align-items:center;">
            <div class="list-info">
                <strong>#${o._id.slice(-6).toUpperCase()}</strong>
                <small>${new Date(o.data).toLocaleDateString()} - ${o.cliente?.nome || 'Cliente'}</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:${statusColor}20; border:1px solid ${statusColor}; color:${statusColor}; padding:2px 8px; border-radius:4px; font-size:0.8rem; font-weight:bold;">
                    ${o.status || 'Pendente'}
                </span>
                <span style="font-weight:bold;">R$ ${(o.total || 0).toFixed(2)}</span>
                <button class="edit-btn" onclick="openOrderModal(${originalIndex})" style="cursor:pointer; padding:5px 10px;">👁️ Detalhes</button>
            </div>
        </div>`;
    }).join('');
}

window.filterOrders = function () {
    const input = document.getElementById('search-order-input');
    if (!input) return;
    const term = input.value.toLowerCase();
    const filtered = ordersData.filter(o =>
        o._id.toLowerCase().includes(term) ||
        (o.cliente && o.cliente.nome.toLowerCase().includes(term))
    );
    renderOrderList(filtered);
};

window.openOrderModal = function (index) {
    const order = ordersData[index];
    currentOrderId = order._id;

    document.getElementById('modal-order-id').textContent = `PEDIDO #${order._id.slice(-6).toUpperCase()}`;
    document.getElementById('modal-status-select').value = order.status || 'Pendente';
    document.getElementById('modal-client-name').textContent = order.cliente.nome;
    document.getElementById('modal-client-email').textContent = order.cliente.email;
    document.getElementById('modal-client-address').textContent = order.cliente.endereco;
    document.getElementById('modal-date').textContent = new Date(order.data).toLocaleString();
    document.getElementById('modal-total').textContent = `R$ ${order.total.toFixed(2)}`;

    const itemsContainer = document.getElementById('modal-items-list');
    const listaItens = order.itens || order.items || [];

    if (itemsContainer) {
        itemsContainer.innerHTML = listaItens.map(i => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:10px 0;">
                <div style="display:flex; gap:10px; align-items:center;">
                    <div style="background:#222; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:4px; color: white;">
                        ${i.qty}x
                    </div>
                    <div>
                        <div style="color:white; font-weight:bold;">${i.nome}</div>
                        <div style="color:#888; font-size:0.8rem;">Tam: ${i.size || 'U'} | Cor: ${i.color || 'N/A'}</div>
                    </div>
                </div>
                <div style="font-weight:bold;">R$ ${(i.preco * i.qty).toFixed(2)}</div>
            </div>
        `).join('');
    }

    const modal = document.getElementById('order-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeOrderModal = function () {
    const modal = document.getElementById('order-modal');
    if (modal) modal.style.display = 'none';
};

window.updateOrderStatus = async function () {
    const statusSelect = document.getElementById('modal-status-select');
    if (!statusSelect) return;

    const newStatus = statusSelect.value;
    const token = localStorage.getItem('token');
    let trackingCode = "";

    if (newStatus === 'Enviado') {
        trackingCode = await showPrompt("Rastreio", "Digite o código dos Correios (ou deixe vazio):");
        if (trackingCode === null) return;
    }

    const bodyData = { status: newStatus };
    if (trackingCode) bodyData.trackingCode = trackingCode;

    try {
        const res = await fetch(`${API_URL_ADMIN}/orders/${currentOrderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify(bodyData)
        });

        if (res.ok) {
            showToast("Status atualizado com sucesso!", "success");
            loadOrders();
            statusSelect.style.borderColor = '#00ff00';
            setTimeout(() => statusSelect.style.borderColor = '#333', 1000);
        } else {
            showToast("Erro ao atualizar status", "error");
        }
    } catch (e) { console.error(e); }
};

// --- USUÁRIOS E CUPONS ---

async function loadUsers() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL_ADMIN}/users`, { headers: { 'Authorization': token } });
        const users = await res.json();

        const list = document.getElementById('user-list');
        if (!list) return; // CORREÇÃO: Verifica se o elemento existe

        list.innerHTML = users.map(u =>
            `<div class="list-item">
                <div class="list-info"><strong>${u.nome}</strong><small>${u.email}</small></div>
                <span class="tag ${u.isAdmin ? 'tag-admin' : 'tag-client'}">${u.isAdmin ? 'ADMIN' : 'CLIENTE'}</span>
            </div>`
        ).join('');
    } catch (e) { console.error(e); }
}

async function handleCouponSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const data = {
        code: document.getElementById('coupon-code').value,
        discount: document.getElementById('coupon-discount').value,
        freeShipping: document.getElementById('coupon-free-shipping').checked
    };
    await fetch(`${API_URL_ADMIN}/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(data)
    });

    showToast("Cupom criado com sucesso!", "success");
    e.target.reset();
    loadCoupons();
}

async function loadCoupons() {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL_ADMIN}/coupons`, { headers: { 'Authorization': token } });
        const coupons = await res.json();

        const list = document.getElementById('coupon-list');
        if (!list) return; // CORREÇÃO: Verifica se o elemento existe

        list.innerHTML = coupons.map(c => {
            const freeShippingBadge = c.freeShipping
                ? `<span style="background:#004d00; color:#0f0; padding:2px 6px; font-size:0.7rem; border-radius:4px; margin-left:10px;">🚚 FRETE GRÁTIS</span>`
                : '';

            return `
            <div class="list-item">
                <div class="list-info">
                    <div style="display:flex; align-items:center;">
                        <strong style="font-size:1.1rem; margin-right:5px;">${c.code}</strong>
                        ${freeShippingBadge}
                    </div>
                    <small style="color:#aaa;">${c.discount}% de Desconto</small>
                </div>
                <button class="delete-btn" onclick="deleteCoupon('${c._id}')">X</button>
            </div>
            `;
        }).join('');
    } catch (e) { console.error(e); }
}

window.deleteCoupon = async function (id) {
    const confirmou = await showConfirm("Apagar cupom?", "Essa ação é irreversível.");
    if (!confirmou) return;

    const token = localStorage.getItem('token');
    await fetch(`${API_URL_ADMIN}/coupons/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });

    loadCoupons();
    showToast("Cupom deletado!", "success");
};

function setupImagePreview() {
    const fileInput = document.getElementById('prod-file');
    const previewImg = document.getElementById('preview-img');
    if (fileInput && previewImg) {
        fileInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = e => {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}