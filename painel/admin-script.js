const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = "segredo_super_secreto_fatal_company";
const app = express();

app.use(cors());
app.use(bodyParser.json());
// Servir a pasta uploads publicamente
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- CONFIGURAÇÃO DE UPLOAD ---
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadDir); },
    filename: (req, file, cb) => {
        const uniqueName = 'prod-' + Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// --- CONEXÃO MONGODB ---
mongoose.connect('mongodb://127.0.0.1:27017/fatalcompany', {
    serverSelectionTimeoutMS: 5000
})
    .then(() => console.log("✅ MongoDB Conectado"))
    .catch(err => console.error("❌ ERRO DE CONEXÃO:", err.message));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true, required: true },
    senha: { type: String, required: true },
    isAdmin: { type: Boolean, default: false }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
    name: String, price: Number, image: String, description: String, sizes: [String], colors: [String]
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    cliente: Object, itens: Array, total: Number, data: { type: Date, default: Date.now }
}));

const Coupon = mongoose.model('Coupon', new mongoose.Schema({
    code: { type: String, uppercase: true, unique: true }, discount: Number, freeShipping: Boolean
}));

// --- MIDDLEWARES ---
function verifyAdmin(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Token ausente" });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.isAdmin) {
            req.user = decoded;
            next();
        } else {
            res.status(403).json({ error: "Acesso negado" });
        }
    } catch (e) { res.status(401).json({ error: "Token inválido" }); }
}

// --- ROTAS DE PRODUTOS ---

// Listar todos
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        const mapped = products.map(p => ({
            _id: p._id,
            nome: p.name,
            preco: p.price,
            imagem: p.image?.startsWith('http') ? p.image : `http://localhost:3000/${p.image}`,
            categoria: p.description,
            sizes: p.sizes,
            colors: p.colors
        }));
        res.json(mapped);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar produtos" }); }
});

// Criar produto
app.post('/api/products', verifyAdmin, async (req, res) => {
    try {
        const p = new Product({
            name: req.body.nome,
            price: req.body.preco,
            image: req.body.imagem,
            description: req.body.categoria,
            sizes: req.body.sizes,
            colors: req.body.colors
        });
        await p.save();
        res.json(p);
    } catch (e) { res.status(400).json({ error: "Erro ao criar produto" }); }
});

// Atualizar produto (PUT) - NECESSÁRIO PARA O ADMIN-SCRIPT
app.put('/api/products/:id', verifyAdmin, async (req, res) => {
    try {
        const updated = await Product.findByIdAndUpdate(req.params.id, {
            name: req.body.nome,
            price: req.body.preco,
            image: req.body.imagem,
            description: req.body.categoria,
            sizes: req.body.sizes,
            colors: req.body.colors
        }, { new: true });
        res.json(updated);
    } catch (e) { res.status(400).json({ error: "Erro ao atualizar produto" }); }
});

// Excluir produto (DELETE) - NECESSÁRIO PARA O ADMIN-SCRIPT
app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Removido com sucesso" });
    } catch (e) { res.status(400).json({ error: "Erro ao excluir" }); }
});

// --- ROTA DE UPLOAD ---
app.post('/api/upload', verifyAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
    res.json({ imageUrl: `uploads/${req.file.filename}` });
});

// --- ROTAS DE CUPONS ---
app.get('/api/coupons', verifyAdmin, async (req, res) => {
    const coupons = await Coupon.find();
    res.json(coupons);
});

app.post('/api/coupons', verifyAdmin, async (req, res) => {
    try {
        const c = new Coupon(req.body);
        await c.save();
        res.json(c);
    } catch (e) { res.status(400).json({ error: "Erro ao criar cupom" }); }
});

app.delete('/api/coupons/:id', verifyAdmin, async (req, res) => {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

// --- DASHBOARD E OUTROS ---
app.get('/api/orders', verifyAdmin, async (req, res) => {
    const orders = await Order.find().sort({ data: -1 });
    res.json(orders);
});

app.get('/api/users', verifyAdmin, async (req, res) => {
    const users = await User.find({}, '-senha'); // Retorna todos menos a senha
    res.json(users);
});

// --- AUTENTICAÇÃO ---
app.post('/api/login', async (req, res) => {
    const { email, senha } = req.body;
    try {
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(senha, user.senha)) {
            const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, nome: user.nome, isAdmin: user.isAdmin });
        } else {
            res.status(401).json({ error: "E-mail ou senha incorretos" });
        }
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
});

app.listen(3000, () => console.log("🚀 Servidor Fatal Company em http://localhost:3000"));