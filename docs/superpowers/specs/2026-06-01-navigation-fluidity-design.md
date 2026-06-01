# Navegacion Compacta y Fluida

Fecha: 2026-06-01
Estado: aprobado para especificacion

## Objetivo

Mejorar la navegacion de PriceTrack para que sea mas fluida, completa e intuitiva sin romper la linea visual actual del proyecto. La solucion debe mantener el sidebar glass existente, reducir ruido visual y hacer visibles las paginas que ahora estan disponibles principalmente por rutas directas o paleta de comandos.

## Alcance

La navegacion se reorganizara como una estructura compacta por areas con subpaginas anidadas:

- Dashboard: entrada principal.
- Comercial: area principal con subpaginas Ventas, Productos y Clientes.
- Logistica: area principal, reservada para operativa logistica.
- Analisis: area principal con subpaginas Tendencias, Comparar y Predicciones.
- Datos: area principal para consulta, edicion, importacion y exportacion.

La paleta de comandos mantendra todas las rutas navegables. La cabecera mantendra breadcrumb, subtitulo, busqueda y cambio de tema.

## No Alcance

No se cambiaran calculos, hooks de datos, integracion con Supabase, filtros de paginas ni estructura de tablas. No se introducira un nuevo sistema visual, una landing page ni una navegacion secundaria fuera del layout principal.

## Arquitectura

Se introducira una fuente unica de verdad para la navegacion, con metadatos reutilizables por:

- Sidebar: areas y subpaginas.
- TopBar: titulo y subtitulo de la ruta activa.
- CommandPalette: busqueda de todas las paginas.
- Preload: precarga de rutas al pasar el raton o enfocar enlaces.

Esta configuracion vivira en `src/lib/navigation.ts` o un modulo equivalente en `src/lib`, siguiendo el estilo de los helpers actuales (`pagePreloads.ts`, `campaigns.ts`). Evitara duplicar etiquetas, rutas e iconos entre componentes.

## Sidebar

El sidebar mantendra `SidebarProvider`, `Sidebar`, `SidebarMenu` y la estetica actual. Las areas con subpaginas se mostraran con grupos desplegables usando componentes ya presentes en el proyecto, preferiblemente `Collapsible` de shadcn/Radix.

Comportamiento esperado:

- El area activa debe quedar marcada cuando se visita su ruta principal o una subpagina.
- Las subpaginas del area activa deben estar desplegadas por defecto.
- Las subpaginas deben poder abrirse desde el teclado.
- Al pasar el raton o enfocar un enlace se precargara la ruta correspondiente.
- En modo icono colapsado, el sidebar debe seguir siendo usable con tooltips de area.
- Las subpaginas deben tener un estilo mas discreto que las areas para conservar jerarquia visual.

## TopBar

La cabecera usara los mismos metadatos de navegacion para resolver la ruta activa. En subpaginas, el breadcrumb mostrara al menos el nombre de la pagina activa. Si se puede hacer sin sobrecargar la UI, mostrara area y subpagina en dos niveles.

Ejemplos:

- Comercial / Ventas
- Analisis / Tendencias
- Datos

## CommandPalette

La paleta seguira abriendose con Ctrl/Cmd+K. Listara todas las paginas finales y areas navegables usando la configuracion compartida. La seleccion navegara a la ruta, cerrara la paleta y permitira que la precarga existente siga funcionando.

## Transiciones y Fluidez

Se mantendra la animacion `routeEnter` existente. Los cambios deben evitar saltos de layout:

- Dimensiones estables para filas de menu y subitems.
- Sin cards anidadas ni nuevos paneles decorativos.
- Sin texto que desborde en desktop o mobile.
- Respeto de `prefers-reduced-motion` ya definido en CSS.

## Accesibilidad

La navegacion debe conservar semantica de enlaces reales mediante `NavLink`. Los disparadores de secciones desplegables deben tener estados accesibles y foco visible. Las etiquetas deben seguir siendo legibles cuando el sidebar esta expandido y los tooltips deben cubrir el modo colapsado.

## Testing

Se anadiran pruebas unitarias o de componentes si la configuracion de test existe o se puede incorporar de forma ligera. Si el proyecto no tiene runner de tests, se verificara con TypeScript/build y prueba manual en navegador:

- Ruta raiz carga Dashboard.
- Rutas de subpaginas activan su area padre.
- CommandPalette navega a rutas principales y subpaginas.
- Sidebar mantiene estructura compacta y desplegable.
- Build de Vite termina sin errores.

## Riesgos

- Duplicar metadatos podria crear inconsistencias entre sidebar, topbar y comandos; se mitiga con configuracion compartida.
- Un sidebar con demasiados subitems puede sentirse cargado; se mitiga mostrando subpaginas solo bajo areas relevantes.
- Cambios en componentes shadcn pueden afectar estilos activos; se mitigara manteniendo clases existentes y cambios CSS acotados.
