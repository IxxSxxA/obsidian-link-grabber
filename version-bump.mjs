// version-bump.mjs del template
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));

// COPIA da manifest.json a versions.json 🤦
versions[manifest.version] = manifest.minAppVersion;

fs.writeFileSync('versions.json', JSON.stringify(versions, null, 2));