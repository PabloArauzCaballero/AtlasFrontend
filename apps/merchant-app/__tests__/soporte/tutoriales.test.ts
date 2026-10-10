/**
 * El contenido de los tutoriales del comercio, portado de la web. Si alguien recorta una guía o
 * cambia el recorrido sin querer, aquí se nota antes que en el teléfono de un comercio.
 */
import { GUIAS_PORTAL } from '@/features/soporte/guias-portal';
import { GUIA_PDF, TUTORIAL_PRIMEROS_PASOS, guiasDelComercio, urlDeLaGuiaPdf } from '@/features/soporte/tutoriales';

it('trae las seis guías del portal con todas sus secciones (las de la web el 2026-10-09)', () => {
  const secciones = Object.fromEntries(Object.entries(GUIAS_PORTAL).map(([ruta, guia]) => [ruta, guia.sections.length]));
  expect(secciones).toEqual({
    '/portal-comercio/gestion-pos': 8,
    '/portal-comercio/cartera': 4,
    '/portal-comercio/facturacion': 3,
    '/portal-comercio/expediente': 11,
    '/portal-comercio/soporte': 4,
    '/portal-comercio/cuenta': 2,
  });
});

it('las enseña en el orden de las pestañas, con «Mi cuenta» al final', () => {
  expect(guiasDelComercio().map(({ guia }) => guia.title)).toEqual([
    'Gestión POS',
    'Mi cartera',
    'Consumo y facturación',
    'Mi empresa',
    'Soporte y tutoriales',
    'Mi cuenta',
  ]);
});

it('el recorrido del comercio es «Tu portal, de un vistazo», con sus tres pasos', () => {
  expect(TUTORIAL_PRIMEROS_PASOS.title).toBe('Tu portal, de un vistazo');
  expect(TUTORIAL_PRIMEROS_PASOS.steps.map((paso) => paso.id)).toEqual(['menu', 'gestion-pos', 'ayuda']);
});

it('la guía en PDF se baja del origen del portal, no de la API', () => {
  expect(urlDeLaGuiaPdf('https://atlas.erp.test.arauzsoftware.com/api/v1')).toBe(
    'https://atlas.erp.test.arauzsoftware.com/guias/ATLAS-Guia-del-portal-del-comercio.pdf',
  );
  expect(GUIA_PDF.archivo).toBe('ATLAS-Guia-del-portal-del-comercio.pdf');
});
