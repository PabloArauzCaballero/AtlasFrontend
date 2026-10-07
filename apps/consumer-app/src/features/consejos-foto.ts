/**
 * Los consejos de la foto, por tipo de captura.
 *
 * Viven aparte de la pantalla por la misma razon que `trust-copy`: un texto de ayuda repartido por
 * las pantallas se contradice solo en cuanto alguien toca uno. Aqui hay un solo sitio donde decir
 * «sin reflejos», y lo leen el anverso y el reverso por igual.
 *
 * Cada consejo lleva UN dibujo de lo correcto y UNO de lo incorrecto: la gente compara antes de
 * leer, asi que el texto solo confirma lo que el dibujo ya dijo.
 *
 * Nada de cifras que el motor no mida: «no lo inclines mas de 10 grados» seria una promesa que no
 * podemos comprobar. Se dice lo que se ve —«de frente, sin inclinarlo»—.
 */
import type { Dibujo } from '../ui/consejos-foto-dibujos';

export type Consejo = {
  id: string;
  titulo: string;
  texto: string;
  bien: Dibujo;
  mal: Dibujo;
  /** Lo que lee un lector de pantalla en lugar de los dibujos. */
  bienEtiqueta: string;
  malEtiqueta: string;
};

export type TipoDeFoto = 'carnet' | 'selfie' | 'perfil';

export const CONSEJOS: Record<TipoDeFoto, { titulo: string; resumen: string; consejos: Consejo[] }> = {
  carnet: {
    titulo: 'Consejos para la foto',
    resumen: 'Luz, reflejos, nitidez y ángulo',
    consejos: [
      {
        id: 'luz',
        titulo: 'Buena iluminación',
        texto: 'Busca una luz pareja. Si la foto sale muy oscura o muy brillante, el documento no se puede validar.',
        bien: 'carnet-bien',
        mal: 'carnet-oscuro',
        bienEtiqueta: 'Carnet bien iluminado, se lee todo',
        malEtiqueta: 'Carnet demasiado oscuro, no se lee',
      },
      {
        id: 'reflejos',
        titulo: 'Evita los reflejos',
        texto: 'No uses la linterna. Los reflejos de lámparas o ventanas tapan el número y la fecha.',
        bien: 'carnet-bien',
        mal: 'carnet-reflejo',
        bienEtiqueta: 'Carnet sin reflejos',
        malEtiqueta: 'Carnet con una franja de reflejo sobre el texto',
      },
      {
        id: 'nitidez',
        titulo: 'Enfoque y nitidez',
        texto: 'Sostén firme el teléfono y espera a que enfoque. No debe haber zonas borrosas.',
        bien: 'carnet-bien',
        mal: 'carnet-borroso',
        bienEtiqueta: 'Carnet nítido',
        malEtiqueta: 'Carnet borroso, movido',
      },
      {
        id: 'angulo',
        titulo: 'De frente, sin inclinar',
        texto: 'Apóyalo en una mesa lisa y fotografíalo desde arriba, con el teléfono paralelo al carnet.',
        bien: 'carnet-bien',
        mal: 'carnet-inclinado',
        bienEtiqueta: 'Carnet visto de frente',
        malEtiqueta: 'Carnet inclinado, visto de lado',
      },
    ],
  },
  selfie: {
    titulo: 'Consejos para la selfie',
    resumen: 'Rostro de frente, sin accesorios y con luz',
    consejos: [
      {
        id: 'frente',
        titulo: 'De frente y centrado',
        texto: 'Mira a la cámara con la cabeza recta y la cara dentro del óvalo.',
        bien: 'cara-bien',
        mal: 'cara-ladeada',
        bienEtiqueta: 'Rostro de frente y centrado',
        malEtiqueta: 'Rostro ladeado y fuera del centro',
      },
      {
        id: 'accesorios',
        titulo: 'Sin accesorios',
        texto: 'Quítate los lentes oscuros, la gorra y la mascarilla. Se tiene que ver la cara entera.',
        bien: 'cara-bien',
        mal: 'cara-gafas',
        bienEtiqueta: 'Rostro descubierto',
        malEtiqueta: 'Rostro con lentes oscuros',
      },
      {
        id: 'luz',
        titulo: 'La luz, de frente',
        texto: 'Que la luz te dé en la cara. Con una ventana o una lámpara detrás, la cara sale oscura.',
        bien: 'cara-bien',
        mal: 'cara-contraluz',
        bienEtiqueta: 'Rostro con luz de frente',
        malEtiqueta: 'Rostro a contraluz, oscuro',
      },
    ],
  },
  perfil: {
    titulo: 'Consejos para el perfil',
    resumen: 'Gira la cabeza, sin accesorios y con luz',
    consejos: [
      {
        id: 'giro',
        titulo: 'Gira la cabeza, no el teléfono',
        texto: 'Mantén el teléfono quieto y gira solo la cabeza hasta que se vea tu oreja. No te inclines.',
        bien: 'cara-perfil',
        mal: 'cara-bien',
        bienEtiqueta: 'Rostro de perfil, se ve la oreja',
        malEtiqueta: 'Rostro de frente, falta girar la cabeza',
      },
      {
        id: 'accesorios',
        titulo: 'Sin accesorios',
        texto: 'Quítate los lentes oscuros, la gorra y la mascarilla. La oreja y el contorno tienen que verse.',
        bien: 'cara-perfil',
        mal: 'cara-gafas',
        bienEtiqueta: 'Rostro de perfil descubierto',
        malEtiqueta: 'Rostro con lentes oscuros',
      },
      {
        id: 'luz',
        titulo: 'La luz, de frente',
        texto: 'Que la luz te dé en la cara. Con una ventana o una lámpara detrás, la cara sale oscura.',
        bien: 'cara-bien',
        mal: 'cara-contraluz',
        bienEtiqueta: 'Rostro con luz de frente',
        malEtiqueta: 'Rostro a contraluz, oscuro',
      },
    ],
  },
};
