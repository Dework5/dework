const { copyFileSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const src  = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')
const dest = join(__dirname, '..', 'public', 'pdf.worker.min.mjs')

if (!existsSync(src)) {
  console.log('pdf.worker.min.mjs not found in node_modules — skipping copy')
  process.exit(0)
}

copyFileSync(src, dest)
console.log('✓ Copied pdf.worker.min.mjs to public/')