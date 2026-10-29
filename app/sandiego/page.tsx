import { redirect } from 'next/navigation'
import { EDICIONES_SD } from '@/lib/estatico'

// dework.com.ar/sandiego -> siempre la última edición de San Diego La Revista.
// Es la dirección corta y fija que se comparte por WhatsApp e impresa en la revista (QR).
export default function SanDiegoUltima() {
  redirect(`/revistas/san-diego-la-revista/${EDICIONES_SD[0].issue_number}`)
}
