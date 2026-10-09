// La apariencia que eligió la persona (Perfil › Apariencia), ANTES del primer pintado: si eligió oscuro,
// el documento nace oscuro y no hay destello blanco mientras llega el bundle. La clave y los valores son
// los de `src/theme/preferencia.ts` y los fondos de arranque de `src/theme/temas.ts`.
// Se carga desde `public/index.html` como archivo y no en línea: la CSP no admite scripts en línea.
try {
  if (localStorage.getItem('atlas.apariencia') === 'oscuro') {
    document.documentElement.setAttribute('data-apariencia', 'oscuro');
    document.querySelector('meta[name="theme-color"]').setAttribute('content', '#0A0A0B');
    document.querySelector('meta[name="color-scheme"]').setAttribute('content', 'dark');
  }
} catch (e) {}
