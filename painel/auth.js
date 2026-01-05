// auth.js

// SOLUÇÃO DO ERRO: Vamos definir a URL aqui dentro para garantir.
// Não use 'const' se estiver com medo de conflito, use 'var' ou direto na string.
var AUTH_API_URL = 'https://serverfc.onrender.com/api';

console.log("✅ Auth.js carregado!");

// Função Check Login
window.checkLoginStatus = function () {
    const user = localStorage.getItem('user');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    const navLinks = document.querySelector('.nav-links');

    // Remove botão antigo
    const oldBtn = document.getElementById('dynamic-auth-btn');
    if (oldBtn) oldBtn.remove();

    const loginLi = document.createElement('li');
    loginLi.id = 'dynamic-auth-btn';

    if (user) {
        let html = `<a href="#" onclick="logout()" style="color: #00ff00;">Olá, ${user} (Sair)</a>`;
        // Se for admin, adiciona botão do painel
        if (isAdmin) {
            html = `<a href="admin.html" style="color: red; font-weight: bold;">PAINEL ADMIN</a> ` + html;
        }
        loginLi.innerHTML = html;
    } else {
        loginLi.innerHTML = `<a href="login.html">LOGIN</a>`;
    }

    if (navLinks) navLinks.appendChild(loginLi);
}

window.logout = function () {
    localStorage.clear(); // Limpa tudo (token, user, admin status)
    window.location.href = 'admin.html';
}

// LOGIN
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const senha = document.getElementById('password').value;

        try {
            const res = await fetch(`${AUTH_API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', data.nome);
                localStorage.setItem('isAdmin', data.isAdmin); // Salva se é admin

                // Redirecionamento Inteligente
                if (data.isAdmin) {
                    alert("Bem-vindo, Chefe! Redirecionando para o Painel.");
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'admin.html';
                }
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error(error);
            alert("Erro de conexão.");
        }
    });
}

// REGISTRO
const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const senha = document.getElementById('reg-password').value;

        try {
            const res = await fetch(`${AUTH_API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, email, senha })
            });

            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('isAdmin', data.isAdmin);
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (error) {
            console.error("Erro no registro:", error);
        }
    });
}