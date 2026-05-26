// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const express = require('express');

const authRoutes = require('./auth');
const projectRoutes = require('./projects');
const { router: aiRoutes } = require('./ai');
const podcastRoutes = require('./podcasts');
const dialogueRoutes = require('./dialogues');
const exportRoutes = require('./export');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/ai', aiRoutes);
router.use('/podcasts', podcastRoutes);
router.use('/dialogues', dialogueRoutes);
router.use('/export', exportRoutes);

module.exports = router;
