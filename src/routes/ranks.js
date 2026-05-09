const express = require('express');
const { body, validationResult } = require('express-validator');
const Rank = require('../models/Rank');
const Insignia = require('../models/Insignia');
const Audit = require('../models/Audit');
const { auth, authorize } = require('../middlewares/auth');

const router = express.Router();

// Listar todos os ranks
router.get('/', async (req, res) => {
  try {
    const ranks = await Rank.find({ isActive: true }).populate('insignia').sort('level');
    res.json(ranks);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao listar ranks', error: error.message });
  }
});

// Obter um rank específico
router.get('/:id', async (req, res) => {
  try {
    const rank = await Rank.findById(req.params.id).populate('insignia');

    if (!rank) {
      return res.status(404).json({ message: 'Rank não encontrado' });
    }

    res.json(rank);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao obter rank', error: error.message });
  }
});

// Criar novo rank
router.post(
  '/',
  auth,
  authorize('create_rank'),
  [
    body('name').trim().notEmpty(),
    body('abbreviation').trim().notEmpty(),
    body('level').isInt(),
    body('hierarchy').isIn([1, 2, 3, 4, 5, 6, 7]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, abbreviation, level, hierarchy, description, permissions, color, salary, insignia } = req.body;

      const rank = new Rank({
        name,
        abbreviation,
        level,
        hierarchy,
        description,
        permissions,
        color,
        salary,
        insignia,
      });

      await rank.save();

      await Audit.create({
        action: 'Rank criado',
        performedBy: req.user._id,
        category: 'rank',
        description: `Novo rank: ${name}`,
        changes: rank,
      });

      res.status(201).json({ message: 'Rank criado com sucesso', rank });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao criar rank', error: error.message });
    }
  }
);

// Editar rank
router.put(
  '/:id',
  auth,
  authorize('edit_rank'),
  async (req, res) => {
    try {
      const rank = await Rank.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).populate('insignia');

      if (!rank) {
        return res.status(404).json({ message: 'Rank não encontrado' });
      }

      await Audit.create({
        action: 'Rank atualizado',
        performedBy: req.user._id,
        category: 'rank',
        description: `Rank atualizado: ${rank.name}`,
        changes: req.body,
      });

      res.json({ message: 'Rank atualizado com sucesso', rank });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar rank', error: error.message });
    }
  }
);

// Deletar rank
router.delete(
  '/:id',
  auth,
  authorize('delete_rank'),
  async (req, res) => {
    try {
      const rank = await Rank.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!rank) {
        return res.status(404).json({ message: 'Rank não encontrado' });
      }

      await Audit.create({
        action: 'Rank desativado',
        performedBy: req.user._id,
        category: 'rank',
        description: `Rank desativado: ${rank.name}`,
      });

      res.json({ message: 'Rank deletado com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao deletar rank', error: error.message });
    }
  }
);

module.exports = router;
