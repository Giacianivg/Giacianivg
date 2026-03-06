'use strict';

/**
 * System prompt da Luna — Pousada Luz da Lua
 * Carregado de .txt para evitar problemas com caracteres especiais em template literals.
 */

const path = require('path');
const fs = require('fs');

module.exports = fs.readFileSync(path.join(__dirname, 'luna-system-prompt.txt'), 'utf8');
