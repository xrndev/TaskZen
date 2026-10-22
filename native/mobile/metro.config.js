const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Código de dominio compartido con la web (tipos y permisos): vive en ../../src y se importa como `@domain/...`.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../../src')]

module.exports = config
