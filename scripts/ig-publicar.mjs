// Publica en Instagram (@countrysandiegolarevista) lo que vence en la cola data/ig-cola.json, con la API oficial de Meta.
// Lo corre GitHub Actions cada media hora (.github/workflows/ig-publicar.yml). Solo publica lo que está en la cola:
// historias aprobadas y, cuando Vicky los apruebe, carruseles.
//
// Variables (secretos de GitHub, nunca en el código): IG_USER_ID, IG_TOKEN.
// Uso:  node scripts/ig-publicar.mjs --estado estado.json [--ensayo] [--verificar] [--ahora 2026-11-16T09:05:00-03:00] [--id <id>]
//   --verificar  solo prueba la conexión con Instagram (no publica).
//   --ensayo  no llama a Meta: muestra qué publicaría.
//   --id      publica esa pieza ya (reintento manual), aunque no sea su hora.
import fs from 'node:fs';
import path from 'node:path';

const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ENSAYO = process.argv.includes('--ensayo');
const ESTADO = arg('--estado') ?? 'estado.json';
const AHORA = arg('--ahora') ? new Date(arg('--ahora')) : new Date();
const SOLO = arg('--id');
const VERIFICAR = process.argv.includes('--verificar');
const SITIO = process.env.SITIO ?? 'https://www.dework.com.ar';
const { IG_USER_ID, IG_TOKEN } = process.env;
// Las claves del "inicio de sesión con Instagram" empiezan con IG y van a graph.instagram.com; las de Facebook, a graph.facebook.com
const GRAPH = (IG_TOKEN?.startsWith('IG') ? 'https://graph.instagram.com/' : 'https://graph.facebook.com/') + (process.env.GRAPH_VERSION ?? 'v21.0');
const ATRASO_MAX = 6 * 60 * 60 * 1000; // si algo se atrasó más de 6 horas, no se publica solo (se avisa)

const DIR = path.dirname(new URL(import.meta.url).pathname);
const cola = JSON.parse(fs.readFileSync(path.join(DIR, '../data/ig-cola.json'), 'utf8'));
const publicadas = fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, 'utf8')) : [];
const hechas = new Set(publicadas.map(p => p.id));

const vencidas = cola.filter(x => x.aprobado && !hechas.has(x.id) && (SOLO ? x.id === SOLO : new Date(x.cuando) <= AHORA));
const tarde = vencidas.filter(x => !SOLO && AHORA - new Date(x.cuando) > ATRASO_MAX);
const aPublicar = vencidas.filter(x => !tarde.includes(x));
for (const x of tarde) console.log(`⚠ ${x.id}: quedó sin publicar (era ${x.cuando}). Para publicarla igual: correr a mano con --id ${x.id}`);
if (VERIFICAR) {
  // prueba de la conexión: solo lee el nombre de la cuenta, no publica nada
  if (!IG_USER_ID || !IG_TOKEN) { console.error('✗ Faltan IG_USER_ID / IG_TOKEN (secretos de GitHub).'); process.exit(1); }
  const u = new URL(`${GRAPH}/${IG_USER_ID}`); u.searchParams.set('fields', 'username,media_count'); u.searchParams.set('access_token', IG_TOKEN);
  const j = await (await fetch(u)).json();
  if (j.error) { console.error('✗ Meta respondió: ' + j.error.message); process.exit(1); }
  console.log(`✓ Conectado a @${j.username} (${j.media_count} publicaciones). Próximas en la cola: ${cola.filter(x => x.aprobado && !hechas.has(x.id) && new Date(x.cuando) > AHORA).slice(0, 3).map(x => x.id + ' ' + x.cuando).join(' · ')}`);
  process.exit(0);
}
if (!aPublicar.length) { console.log(`Nada para publicar a las ${AHORA.toISOString()}.`); process.exit(0); }
if (!ENSAYO && (!IG_USER_ID || !IG_TOKEN)) { console.error('✗ Faltan IG_USER_ID / IG_TOKEN (secretos de GitHub).'); process.exit(1); }

const api = async (ruta, params, metodo = 'POST') => {
  const url = new URL(GRAPH + ruta);
  for (const [k, v] of Object.entries({ ...params, access_token: IG_TOKEN })) url.searchParams.set(k, v);
  const r = await fetch(url, { method: metodo });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`${ruta}: ${j.error?.message ?? r.status}`);
  return j;
};
const esperarListo = async id => {
  for (let i = 0; i < 30; i++) {
    const { status_code } = await api('/' + id, { fields: 'status_code' }, 'GET');
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error('Meta no pudo procesar la imagen (' + status_code + ')');
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('Meta tardó demasiado en procesar la imagen');
};
const urlImagen = async rel => {
  const u = SITIO + rel;
  const r = await fetch(u, { method: 'HEAD' });
  if (!r.ok) throw new Error('La imagen no está en la web: ' + u);
  return u;
};

let errores = 0;
for (const x of aPublicar) {
  try {
    if (ENSAYO) { console.log(`(ensayo) publicaría ${x.tipo} ${x.id} · ${x.imagenes.join(', ')}`); continue; }
    let contenedor;
    if (x.tipo === 'comentario') {
      // comentario de la revista en un posteo ya publicado (p. ej. para mencionar a alguien)
      const { id } = await api(`/${x.media}/comments`, { message: x.texto });
      publicadas.push({ id: x.id, media: id, publicada: new Date().toISOString() });
      fs.writeFileSync(ESTADO, JSON.stringify(publicadas, null, 1) + '\n');
      console.log(`✓ comentario ${x.id} (${id})`);
      continue;
    }
    if (x.tipo === 'historia') {
      ({ id: contenedor } = await api(`/${IG_USER_ID}/media`, { image_url: await urlImagen(x.imagenes[0]), media_type: 'STORIES' }));
    } else if (x.tipo === 'carrusel') {
      const hijos = [];
      for (const [i, rel] of x.imagenes.entries()) {
        // etiquetas de personas en esa placa: [{ placa: 0, usuario: 'soficairo_', x: 0.5, y: 0.4 }]
        const tags = (x.etiquetas ?? []).filter(t => t.placa === i).map(t => ({ username: t.usuario, x: t.x ?? 0.5, y: t.y ?? 0.5 }));
        const { id } = await api(`/${IG_USER_ID}/media`, { image_url: await urlImagen(rel), is_carousel_item: 'true', ...(tags.length ? { user_tags: JSON.stringify(tags) } : {}) });
        await esperarListo(id); hijos.push(id);
      }
      ({ id: contenedor } = await api(`/${IG_USER_ID}/media`, { media_type: 'CAROUSEL', children: hijos.join(','), caption: x.texto ?? '' }));
    } else if (x.tipo === 'post') {
      // una sola imagen en el feed, con su texto
      ({ id: contenedor } = await api(`/${IG_USER_ID}/media`, { image_url: await urlImagen(x.imagenes[0]), caption: x.texto ?? '' }));
    } else throw new Error('tipo desconocido: ' + x.tipo);
    await esperarListo(contenedor);
    const { id: media } = await api(`/${IG_USER_ID}/media_publish`, { creation_id: contenedor });
    publicadas.push({ id: x.id, media, publicada: new Date().toISOString() });
    fs.writeFileSync(ESTADO, JSON.stringify(publicadas, null, 1) + '\n'); // se guarda enseguida: nunca se publica dos veces
    console.log(`✓ publicada ${x.id} (media ${media})`);
  } catch (e) {
    errores++;
    console.error(`✗ ${x.id}: ${e.message}`);
  }
}
process.exit(errores ? 1 : 0);
