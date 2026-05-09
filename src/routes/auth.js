const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Audit = require('../models/Audit');
const { auth } = require('../middlewares/auth');

const router = express.Router();

// Registrar novo usuário
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('inGameName').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, inGameName, rank } = req.body;

      let user = await User.findOne({ $or: [{ email }, { username }] });
      if (user) {
        return res.status(400).json({ message: 'Usuário já existe' });
      }

      user = new User({
        username,
        email,
        password,
        inGameName,
        rank: rank || '65abc123def456ghi789jklm',
      });

      await user.save();

      await Audit.create({
        action: 'Usuário registrado',
        performedBy: user._id,
        category: 'user',
        description: `Novo usuário: ${username}`,
      });

      res.status(201).json({
        message: 'Usuário registrado com sucesso',
        user: { id: user._id, username, email, inGameName },
      });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao registrar usuário', error: error.message });
    }
  }
);

// Login
router.post(
  '/login',
  [body('username').notEmpty(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      const user = await User.findOne({ username }).select('+password').populate('rank');
      if (!user) {
        return res.status(400).json({ message: 'Usuário não encontrado' });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Senha incorreta' });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'sua_chave_secreta', {
        expiresIn: process.env.JWT_EXPIRE || '7d',
      });

      await Audit.create({
        action: 'Login realizado',
        performedBy: user._id,
        category: 'system',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        message: 'Login realizado com sucesso',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          inGameName: user.inGameName,
          rank: user.rank,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao fazer login', error: error.message });
    }
  }
);

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    await Audit.create({
      action: 'Logout realizado',
      performedBy: req.user._id,
      category: 'system',
    });

    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao fazer logout', error: error.message });
  }
});

// Obter perfil
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('rank')
      .populate('medals.medal')
      .populate('medals.awardedBy', 'username inGameName');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter perfil', error: error.message });
  }
});

module.exports = router;
