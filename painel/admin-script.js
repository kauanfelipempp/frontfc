const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const JWT_SECRET = process.env.JWT_SECRET || "segredo_super_secreto_fatal_company";
const app = express();

app.use(cors());
app.use(bodyParser.json());

// --- CONFIGURAÇÃO DO CLOUDINARY ---
// As chaves devem ser configuradas nas variáveis de ambiente do Render
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'fatal_products',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});
const upload = multer({ storage });

// --- CONEXÃO MONGODB ---
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fatalcompany';

mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 })
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
    name: String,
    price: Number,
    image: String,
    description: String,
    sizes: [String],
    colors: [String]
}));

const Category = mongoose.model('Category', new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    order: { type: Number, default: 0 }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
    cliente: Object,
    itens: Array,
    total: Number,
    data: { type: Date, default: Date.now }
}));

const Coupon = mongoose.model('Coupon', new mongoose.Schema({
    code: { type: String, uppercase: true, unique: true },
    discount: Number,
    freeShipping: Boolean
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

app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        const mapped = products.map(p => ({
            _id: p._id,
            nome: p.name,
            preco: p.price,
            // Se a imagem já for um link externo (Cloudinary), usa direto. 
            // Se for antiga (local), tenta montar o link do servidor.
            imagem: p.image?.startsWith('http') ? p.image : `https://serverfc.onrender.com/${p.image}`,
            categoria: p.description,
            sizes: p.sizes,
            colors: p.colors
        }));
        res.json(mapped);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar produtos" }); }
});

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

app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Removido com sucesso" });
    } catch (e) { res.status(400).json({ error: "Erro ao excluir" }); }
});

// --- ROTA DE UPLOAD (CLOUDINARY) ---
app.post('/api/upload', verifyAdmin, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Erro ao subir imagem" });
    // Retorna a URL segura gerada pelo Cloudinary
    res.json({ imageUrl: req.file.path });
});

// --- ROTAS DE CATEGORIAS ---

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1 });
        res.json(categories);
    } catch (e) { res.status(500).json({ error: "Erro ao buscar categorias" }); }
});

app.post('/api/categories', verifyAdmin, async (req, res) => {
    try {
        const cat = new Category(req.body);
        await cat.save();
        res.json(cat);
    } catch (e) { res.status(400).json({ error: "Erro ao criar categoria" }); }
});

app.put('/api/categories/reorder', verifyAdmin, async (req, res) => {
    try {
        const { orderedIds } = req.body;
        for (let i = 0; i < orderedIds.length; i++) {
            await Category.findByIdAndUpdate(orderedIds[i], { order: i });
        }
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Erro ao reordenar" }); }
});

app.delete('/api/categories/:id', verifyAdmin, async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: "Categoria removida" });
    } catch (e) { res.status(400).json({ error: "Erro ao deletar categoria" }); }
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
    const users = await User.find({}, '-senha');
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));