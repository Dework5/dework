// Datos de la web guardados en el propio sitio (no dependen de Supabase).
// San Diego La Revista: las dos últimas ediciones completas. Otras revistas: solo la tapa.
// Se regeneran con `node scripts/estatico.mjs` desde los archivos del estudio.
import sd144 from '@/data/sd-144.json'
import sd143 from '@/data/sd-143.json'

const SD_ID = '13374b20-d409-4ce0-a493-6a0dc7816eef'

export const EDICIONES_SD = [
  { id: '5cce10e3-c75a-417d-8079-e8902a81daba', publication_id: SD_ID, is_published: true, images_status: 'ready', ...sd144 },
  { id: '0e08e70c-f85c-46f7-9ff4-0f3076aeaab5', publication_id: SD_ID, is_published: true, images_status: 'ready', ...sd143 },
] as any[]

const pub = (id: string, slug: string, name: string, short: string, description: string, ultima: number, tapa: string) => ({
  id, slug, name, short_name: short, shortName: short, description, is_active: true, accent_color: '#A88650',
  latest_issue: { issue_number: ultima, cover_url: tapa },
})

export const PUBLICACIONES = [
  { ...pub(SD_ID, 'san-diego-la-revista', 'San Diego La Revista', 'SDLR', 'La revista exclusiva del country San Diego. Edición mensual desde 2014.', 144, '/tapas/san-diego-144.jpg'), latest_issue: EDICIONES_SD[0] },
  pub('58ad9f68-9127-4b82-aaf6-54c06b937cbc', 'haras-del-pilar', 'Haras del Pilar', 'HDP', 'La revista del mundo ecuestre y country de Pilar.', 7, '/tapas/haras-del-pilar.jpg'),
  pub('cc48ef33-ef6e-4568-9b90-100f3ed95859', 'pilara-magazine', 'Pilará Magazine', 'PM', 'Moda, cultura y tendencias de Pilará y alrededores.', 6, '/tapas/pilara-magazine.jpg'),
  pub('ab008fd8-3d92-4d20-a14d-0e4662cefab0', 'los-lagartos', 'Los Lagartos', 'LL', 'Revista del country Los Lagartos.', 7, '/tapas/los-lagartos.jpg'),
  pub('8d782298-1e46-4a6e-93f5-0b2ff8678556', 'campo-chico', 'Campo Chico', 'CC', 'La vida en el campo chico de zona norte.', 2, '/tapas/campo-chico.jpg'),
  pub('81814827-7d75-4610-929b-ed19b1ed272b', 'olivos-golf-club', 'Olivos Golf Club Magazine', 'OGC', 'La revista del Olivos Golf Club.', 1, '/tapas/olivos-golf-club.jpg'),
] as any[]

export const SLUG_SD = 'san-diego-la-revista'
export const publicacion = (slug: string) => PUBLICACIONES.find(p => p.slug === slug) ?? null
export const edicion = (slug: string, numero: number) => (slug === SLUG_SD ? EDICIONES_SD.find(e => e.issue_number === numero) ?? null : null)
