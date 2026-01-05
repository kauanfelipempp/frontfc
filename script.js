// ================== CONFIG ==================
const LOJA_API_URL = 'https://serverfc.onrender.com/api';

// Inicializa o carrinho globalmente
let cart = JSON.parse(localStorage.getItem('fatalCart')) || [];
let currentFrete = 0;
let currentDiscount = 0;

// Variável Global de Produtos
let allProducts = [];








// ================== ACABANDO COM AS ALERT BOX  ==================
/* --- SISTEMA DE NOTIFICAÇÕES (UI CUSTOMIZADA) --- */

// 1. Cria o container no HTML se não existir
function ensureToastContainer() {
    if (!document.getElementById('toast-container')) {
        const div = document.createElement('div');
        div.id = 'toast-container';
        document.body.appendChild(div);
    }
}

// 2. Função SHOW TOAST (Substitui alert simples)
window.showToast = function (message, type = 'success') {
    ensureToastContainer();
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    // Remove automaticamente após 3 segundos
    setTimeout(() => {
        toast.classList.add('toast-closing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
};

// 3. Função CONFIRM CUSTOMIZADO (Retorna uma Promise)
// Uso: if (await showConfirm("Tem certeza?")) { ... }
window.showConfirm = function (title, text) {
    return new Promise((resolve) => {
        // Cria o HTML do modal dinamicamente
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
            resolve(result); // Retorna true ou false
        }

        btnOk.addEventListener('click', () => close(true));
        btnCancel.addEventListener('click', () => close(false));
    });
};

// 4. Função PROMPT CUSTOMIZADO (Para o código de rastreio)
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
            resolve(value); // Retorna o texto ou null
        }

        btnOk.addEventListener('click', () => close(input.value));
        btnCancel.addEventListener('click', () => close(null));

        // Aceitar Enter
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') close(input.value);
        });
    });
};


// ================== FUNÇÃO TOAST (NOTIFICAÇÕES) ==================

function showToast(message, type = 'success') {
    // 1. Cria o container se não existir
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // 2. Cria o elemento do toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    // 3. Adiciona ao container
    container.appendChild(toast);

    // 4. Trigger da animação (pequeno delay para o CSS transition funcionar)
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 5. Remove após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        // Espera a animação de saída terminar para remover do DOM
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// ================== 1. PRODUTOS & CATEGORIAS ==================

async function initShop() {
    await loadCategoriesMenu();
    await fetchProducts();
}

async function loadCategoriesMenu() {
    try {
        const res = await fetch(`${LOJA_API_URL}/categories`);
        const categories = await res.json();

        const menu = document.getElementById('category-filters');
        if (!menu) return;

        let html = `<button class="cat-btn active" onclick="filterProducts('all', this)">TODOS</button>`;

        categories.forEach(cat => {
            const titulo = cat.title || cat.nome || "Categoria";
            html += `<button class="cat-btn" onclick="filterProducts('${titulo}', this)">${titulo.toUpperCase()}</button>`;
        });

        menu.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar categorias:", e);
        const menu = document.getElementById('category-filters');
        if (menu) menu.innerHTML = `<button class="cat-btn active">TODOS</button>`;
    }
}

async function fetchProducts() {
    try {
        const response = await fetch(`${LOJA_API_URL}/products`);
        allProducts = await response.json();
        renderProducts(allProducts);
    } catch (err) {
        console.error('Erro ao carregar produtos:', err);
        showToast('Erro ao carregar produtos.', 'error');
    }
}

function renderProducts(listaProdutos) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!listaProdutos || listaProdutos.length === 0) {
        grid.innerHTML = '<p style="color:#666; width:100%; text-align:center; padding: 20px;">Nenhum produto encontrado nesta categoria.</p>';
        return;
    }

    listaProdutos.forEach(p => {
        const precoNumerico = Number(p.preco || p.price || 0);
        const nomeProduto = p.nome || p.name || "Produto";
        let imgPath = p.imagem || p.image;
        if (!imgPath || imgPath === "undefined" || imgPath === "") {
            imgPath = 'https://placehold.co/400x500?text=IMAGEM+INDISPONIVEL';
        }

        const sizeOpts = (p.sizes || []).map(s => `<option value="${s}">${s}</option>`).join('');
        const colorOpts = (p.colors || []).map(c => `<option value="${c}">${c}</option>`).join('');

        const card = document.createElement('div');
        card.className = 'card reveal active';
        card.innerHTML = `
            <div class="card-image">
                <img src="${imgPath}" onerror="this.src='https://placehold.co/400x500?text=ERRO'">
            </div>
            <div class="card-info">
                <span class="product-name" style="color:white; display:block;">${nomeProduto}</span>
                <span class="product-price" style="color:#888;">R$ ${precoNumerico.toFixed(2)}</span>
            </div>
            
            <div class="variant-selectors" style="display:flex; gap:5px; padding:10px;">
                <select id="size-${p._id}" class="v-sel" style="flex:1; background:#111; color:white; border:1px solid #333; padding:5px;">
                    <option value="">TAM</option>
                    ${sizeOpts || '<option value="U">Único</option>'}
                </select>

                <select id="color-${p._id}" class="v-sel" style="flex:1; background:#111; color:white; border:1px solid #333; padding:5px;">
                    <option value="">COR</option>
                    ${colorOpts || '<option value="N/A">N/A</option>'}
                </select>
            </div>

            <button class="add-btn" style="width:100%; padding:15px; background:white; color:black; font-weight:bold; border:none; cursor:pointer;"
                onclick="addToCart('${p._id}', '${nomeProduto}', ${precoNumerico}, '${imgPath}')">
                ADICIONAR
            </button>
        `;
        grid.appendChild(card);
    });
}

window.filterProducts = function (category, btnElement) {
    const buttons = document.querySelectorAll('.cat-btn');
    buttons.forEach(b => b.classList.remove('active'));

    if (btnElement) {
        btnElement.classList.add('active');
    }

    if (category === 'all') {
        renderProducts(allProducts);
    } else {
        const filtered = allProducts.filter(p => p.categoria === category);
        renderProducts(filtered);
    }
};

// ================== 2. LÓGICA DO CARRINHO ==================

function updateCartIconCount() {
    const storedCart = JSON.parse(localStorage.getItem('fatalCart')) || [];
    const totalCount = storedCart.reduce((sum, item) => sum + item.qty, 0);
    cart = storedCart;

    const countEl = document.getElementById('cart-count');
    if (countEl) {
        countEl.textContent = totalCount;
        countEl.style.display = totalCount > 0 ? 'flex' : 'none';
    }

    const desktopText = document.querySelector('.cart-icon-desktop');
    if (desktopText) desktopText.textContent = `CARRINHO (${totalCount})`;
}

function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');

    if (sidebar && overlay) {
        const isActive = sidebar.classList.toggle('open');
        overlay.style.display = isActive ? 'block' : 'none';
        if (isActive) renderCartItems();
    }
}

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total');
    const storedCart = JSON.parse(localStorage.getItem('fatalCart')) || [];

    if (storedCart.length === 0) {
        container.innerHTML = '<div class="cart-empty-msg" style="padding:20px; text-align:center;">Sua sacola está vazia.</div>';
        if (totalEl) totalEl.textContent = 'R$ 0,00';
        return;
    }

    let total = 0;
    container.innerHTML = storedCart.map(item => {
        total += Number(item.preco) * item.qty;
        const img = item.imagem && item.imagem !== "undefined" ? item.imagem : 'https://placehold.co/100';

        return `
            <div class="cart-item" style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid #222; padding:10px;">
                <img src="${img}" alt="${item.nome}" style="width:50px; height:70px; object-fit:cover;">
                <div class="cart-item-details" style="flex:1; color:white;">
                    <div class="cart-item-title" style="font-weight:bold;">${item.nome}</div>
                    <div style="font-size:0.8rem; color:#888;">${item.size} / ${item.color}</div>
                    
                    <div class="qty-selector" style="margin-top:5px; display:flex; align-items:center; gap:10px;">
                        <button class="qty-btn qty-minus" data-id="${item.cartId}" style="background:#333; color:white; border:none; padding:2px 8px; cursor:pointer;">-</button>
                        <span class="qty-number">${item.qty}</span>
                        <button class="qty-btn qty-plus" data-id="${item.cartId}" style="background:#333; color:white; border:none; padding:2px 8px; cursor:pointer;">+</button>
                        <button class="qty-remove" data-id="${item.cartId}" style="margin-left:auto; color:#ff4444; background:none; border:none; cursor:pointer; font-size:12px; text-decoration:underline;">Remover</button>
                    </div>
                </div>
                <div class="cart-item-price" style="font-weight:bold; color:white;">R$ ${(Number(item.preco) * item.qty).toFixed(2)}</div>
            </div>
        `;
    }).join('');

    if (totalEl) {
        totalEl.textContent = `R$ ${total.toFixed(2)}`;
    }
}

window.addToCart = function (id, nome, preco, imagem) {
    const size = document.getElementById(`size-${id}`).value;
    const color = document.getElementById(`color-${id}`).value;

    if (!size || !color) {
        // [ALTERADO] Substituido alert por Toast de Erro
        showToast('Selecione Tamanho e Cor antes de adicionar!', 'error');
        return;
    }

    let storedCart = JSON.parse(localStorage.getItem('fatalCart')) || [];
    const cartId = `${id}-${size}-${color}`;
    const existing = storedCart.find(item => item.cartId === cartId);

    if (existing) {
        existing.qty++;
    } else {
        storedCart.push({ cartId, id, nome, preco, imagem, size, color, qty: 1 });
    }

    localStorage.setItem('fatalCart', JSON.stringify(storedCart));
    updateCartIconCount();

    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.style.display = 'block';

    renderCartItems();

    // [ADICIONADO] Toast de Sucesso
    showToast(`${nome} adicionado à sacola!`, 'success');
};

// ================== 3. CHECKOUT UI & FRETE ==================
window.openCheckout = function () {
    cart = JSON.parse(localStorage.getItem('fatalCart')) || [];
    if (cart.length === 0) {
        // [ALTERADO] Substituido alert por Toast de Erro
        showToast('Sua sacola está vazia!', 'error');
        return;
    }

    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';

    document.getElementById('checkout-modal').style.display = 'flex';
    updateSummary();
};

window.closeCheckout = function () {
    document.getElementById('checkout-modal').style.display = 'none';
};

window.aplicarCupom = async function () {
    const input = document.getElementById('chk-cupom');
    const msgEl = document.getElementById('cupom-msg');
    if (!input || !input.value) return;

    const code = input.value.toUpperCase();

    try {
        const res = await fetch(`${LOJA_API_URL}/validate-coupon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await res.json();

        if (data.valid) {
            const subtotal = cart.reduce((sum, i) => sum + (i.preco * i.qty), 0);
            currentDiscount = (subtotal * data.discount) / 100;

            if (data.freeShipping) {
                currentFrete = 0;
                const freteDisplay = document.getElementById('chk-frete-display');
                if (freteDisplay) freteDisplay.value = "GRÁTIS (CUPOM)";
            }

            msgEl.textContent = `Cupom aplicado: ${data.discount}% OFF!`;
            msgEl.style.color = "#0f0";

            // [ADICIONADO] Toast de confirmação
            showToast(`Cupom de ${data.discount}% aplicado!`, 'success');

            updateSummary();
        } else {
            msgEl.textContent = "Cupom inválido.";
            msgEl.style.color = "#f00";
            currentDiscount = 0;

            // [ADICIONADO] Toast de erro
            showToast("Cupom inválido ou expirado.", "error");

            updateSummary();
        }
    } catch (e) {
        console.error("Erro cupom:", e);
        showToast("Erro ao validar cupom.", "error");
    }
};

window.calcularFrete = async function (cep) {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    const display = document.getElementById('chk-frete-display');
    const enderecoInput = document.getElementById('chk-endereco');

    try {
        const viacepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const viacepData = await viacepRes.json();
        if (!viacepData.erro && enderecoInput) {
            enderecoInput.value = `${viacepData.logradouro}, ${viacepData.bairro} - ${viacepData.localidade}/${viacepData.uf}`;
        }
    } catch (e) { console.error("Erro endereço via CEP"); }

    if (display) display.value = "Calculando...";
    try {
        const res = await fetch(`${LOJA_API_URL}/shipping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cep: cleanCep })
        });

        const data = await res.json();
        currentFrete = data.price || 0;

        if (display) display.value = `R$ ${currentFrete.toFixed(2)}`;
        updateSummary();
    } catch (e) {
        if (display) display.value = "R$ 0,00";
        currentFrete = 0;
        updateSummary();
    }
};

function updateSummary() {
    const subtotal = cart.reduce((sum, i) => sum + (i.preco * i.qty), 0);
    const total = subtotal + currentFrete - currentDiscount;

    const subEl = document.getElementById('summary-subtotal');
    const totEl = document.getElementById('summary-total');
    const freteEl = document.getElementById('summary-frete');
    const descEl = document.getElementById('summary-desconto');

    if (subEl) subEl.textContent = `R$ ${subtotal.toFixed(2)}`;
    if (freteEl) freteEl.textContent = `R$ ${currentFrete.toFixed(2)}`;
    if (descEl) descEl.textContent = `- R$ ${currentDiscount.toFixed(2)}`;
    if (totEl) totEl.textContent = `R$ ${Math.max(0, total).toFixed(2)}`;
}

// ================== 4. SCROLL ANIMATION ==================
function initScrollAnimation() {
    const reveals = document.querySelectorAll('.reveal');

    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const elementVisible = 150;

        reveals.forEach((reveal) => {
            const elementTop = reveal.getBoundingClientRect().top;
            if (elementTop < windowHeight - elementVisible) {
                reveal.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll();
}

// ================== 5. EVENTOS E INICIALIZAÇÃO ==================
document.addEventListener('DOMContentLoaded', () => {

    // Inicia funções principais
    initShop();
    updateCartIconCount();
    initScrollAnimation();

    // Eventos do Carrinho (Delegation)
    const cartContainer = document.getElementById('cart-items-container');
    if (cartContainer) {
        cartContainer.addEventListener('click', (e) => {
            const target = e.target;
            const prodId = target.getAttribute('data-id');

            if (!prodId) return;

            let storedCart = JSON.parse(localStorage.getItem('fatalCart')) || [];
            const itemIndex = storedCart.findIndex(item => item.cartId === prodId);

            if (itemIndex > -1) {
                if (target.classList.contains('qty-plus')) {
                    storedCart[itemIndex].qty++;
                } else if (target.classList.contains('qty-minus')) {
                    if (storedCart[itemIndex].qty > 1) {
                        storedCart[itemIndex].qty--;
                    } else {
                        storedCart.splice(itemIndex, 1);
                    }
                } else if (target.classList.contains('qty-remove')) {
                    storedCart.splice(itemIndex, 1);
                }

                localStorage.setItem('fatalCart', JSON.stringify(storedCart));
                cart = storedCart; // Sincroniza global

                renderCartItems();
                updateCartIconCount();
            }
        });
    }

    // Fechar Sidebar/Modal no Overlay
    const overlay = document.getElementById('cart-overlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            const sidebar = document.getElementById('cart-sidebar');
            if (sidebar) sidebar.classList.remove('open');
            overlay.style.display = 'none';
            document.getElementById('checkout-modal').style.display = 'none';
        });
    }

    // Submit do Checkout
    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
        checkoutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.querySelector('.btn-finalizar');
            const btnOriginalText = btn.textContent;

            btn.textContent = "PROCESSANDO...";
            btn.disabled = true;

            cart = JSON.parse(localStorage.getItem('fatalCart')) || [];

            // AQUI ESTÁ A ALTERAÇÃO:
            const pedido = {
                cliente: {
                    nome: document.getElementById('chk-nome').value,
                    email: document.getElementById('chk-email').value,
                    // Captura o CPF e remove caracteres não numéricos
                    cpf: document.getElementById('chk-cpf').value.replace(/\D/g, ''),
                    endereco: document.getElementById('chk-endereco').value
                },
                itens: cart,
                frete: currentFrete,
                desconto: currentDiscount,
                total: cart.reduce((acc, i) => acc + (i.preco * i.qty), 0) + currentFrete - currentDiscount
            };

            try {
                const res = await fetch(`${LOJA_API_URL}/checkout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pedido)
                });

                const data = await res.json();

                if (data.success && data.url) {
                    cart = [];
                    localStorage.removeItem('fatalCart');
                    showToast('Redirecionando para pagamento...', 'success');
                    window.location.href = data.url;
                } else {
                    // [ALTERADO] Toast de Erro
                    showToast(data.error || "Erro ao processar. Tente novamente.", "error");
                    btn.textContent = btnOriginalText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error(error);
                // [ALTERADO] Toast de Erro de conexão
                showToast("Erro de conexão com o servidor.", "error");
                btn.textContent = btnOriginalText;
                btn.disabled = false;
            }
        });
    }
});