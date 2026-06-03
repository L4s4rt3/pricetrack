# PriceTrack Redesign Progresivo

Fecha: 2026-06-03
Estado: aprobado para especificacion

## Objetivo

Redisenar PriceTrack como una herramienta interna rapida, clara y premium para ventas, clientes, logistica, comparativas y administracion de datos. La prioridad principal es que la navegacion se sienta fluida y que ninguna pantalla cargue historico completo salvo que el usuario lo pida de forma explicita.

El redisenyo sera total como destino, pero progresivo en ejecucion para mantener la app util durante el proceso.

## Principios

- Primero fluidez, despues profundidad.
- Cada apartado debe tener una intencion unica.
- El Dashboard muestra contexto reciente, no historico completo.
- El historico se consulta solo despues de elegir que se quiere ver.
- Las tablas grandes usan paginacion en servidor y/o virtualizacion.
- Las graficas y KPIs usan datos agregados siempre que sea posible.
- El diseno debe sentirse WWDC26 oscuro y plateado: premium, sobrio, limpio y con brillo controlado.

## Arquitectura De Producto

La navegacion principal tendra seis apartados:

1. Dashboard
2. Logistica
3. Busqueda
4. Clientes
5. Comparativas
6. Datos

Las rutas actuales podran mantenerse como redirecciones o subrutas durante la transicion para no romper enlaces existentes.

## Dashboard

El Dashboard sera la entrada principal y cargara solo los ultimos 6 meses.

Debe mostrar:

- KPIs mensuales.
- Evolucion de facturacion.
- Precio medio.
- KG vendidos.
- Top clientes.
- Top productos.
- Cambios o alertas relevantes.

Los datos del Dashboard deben venir de consultas o vistas agregadas, no de cargar todas las lineas de venta en el navegador.

Tendra una accion clara de "Ampliar historico". Al pulsarla, la app no cargara el historico automaticamente: primero pedira elegir campana, ano, cliente, producto o rango. Despues de esa eleccion se consulta solo el subconjunto necesario.

## Logistica

Logistica reunira la operativa de transporte:

- CMR.
- Hojas de ruta.
- Clientes logisticos.
- Transportistas.
- Exportacion PDF.
- Exportacion Excel.

La pantalla cargara fichas ligeras de clientes y transportistas. Las plantillas PDF se cargaran solo al exportar.

CMR y hojas de ruta deben mantenerse como flujos separados, aunque compartan buscador de cliente y transportista. Ambos deben pedir solo informacion variable y rellenar automaticamente los datos fijos o guardados.

## Busqueda

Busqueda sera el area para consultar datos concretos sin penalizar la carga inicial.

Al entrar, no debe cargar registros historicos.

Tendra dos modos:

- Busqueda por texto.
- Busqueda por filtros.

La busqueda por texto debe permitir encontrar cliente, producto, factura, documento, referencia u otros campos relevantes.

La busqueda por filtros debe permitir seleccionar combinaciones como campana, mes, cliente, producto, categoria, variedad, calibre, formato o estado segun los datos disponibles.

Los resultados deben venir paginados desde Supabase con limite, rango y orden estable. La tabla no debe filtrar 200.000 filas en React.

## Clientes

Clientes sera una base de datos comercial 360.

La vista inicial cargara un resumen ligero de clientes, no todo el detalle de ventas.

Cada ficha de cliente debe mostrar, cuando existan los datos:

- Informacion general.
- Precio medio.
- Precios por producto.
- Fianza.
- Transporte.
- Volumen de ventas.
- Facturacion.
- KG vendidos.
- Productos principales.
- Evolucion por mes y campana.
- Ultimos movimientos.

El detalle historico del cliente se cargara bajo demanda, con paginacion o filtros.

## Comparativas

Comparativas permitira analizar campanas y meses sin cargar todo el historico por defecto.

Antes de consultar historico, el usuario elegira que quiere comparar:

- Campanas.
- Meses.
- Cliente.
- Producto.
- Categoria.
- Rango temporal.

Las comparativas habituales deben apoyarse en vistas agregadas mensuales o por campana. Las lineas de detalle se consultaran solo cuando el usuario quiera bajar al detalle.

## Datos

Datos sera el area administrativa:

- Importar.
- Modificar.
- Exportar.
- Borrar.
- Validar errores.

Este apartado puede ser el mas pesado, pero tambien debe usar paginacion en servidor y filtros antes de consultar historico amplio.

Las acciones destructivas, como borrar, requeriran confirmacion fuerte. Importaciones y exportaciones grandes deben hacerse por bloques cuando sea necesario.

## Estrategia De Datos

La regla global es que ninguna pantalla cargue el historico completo al entrar.

Capas de rendimiento:

- React Query para cache en memoria durante la navegacion.
- Cache persistente local para datos recientes o ligeros.
- Vistas o tablas agregadas en Supabase para KPIs, dashboard, clientes y comparativas.
- Indices en Postgres sobre columnas usadas para filtro y ordenacion.
- Paginacion en servidor para busqueda y datos.
- Virtualizacion en tablas/listas cuando haya muchas filas visibles.

Consultas recomendadas:

- Dashboard: ultimos 6 meses agregados.
- Busqueda: cero carga inicial, query bajo demanda.
- Clientes: resumen inicial, detalle bajo demanda.
- Comparativas: selector primero, query despues.
- Datos: filtros y paginacion desde Supabase.
- Logistica: fichas ligeras y plantillas bajo demanda.

## Direccion Visual

El estilo sera WWDC26 oscuro y plateado, inspirado en negro, plata, vidrio y brillo controlado.

Paleta:

- Fondo casi negro.
- Superficies grafito y vidrio oscuro.
- Plata y gris frio para texto, bordes y jerarquia.
- Blanco frio para foco.
- Azul hielo o ambar suave solo como acento puntual.
- Evitar paletas coloridas, moradas, azules saturadas o dashboards arcoiris.

UI:

- Sidebar limpio con seis apartados grandes.
- KPIs estilo metal/glass, no tarjetas de colores.
- Tablas compactas, sobrias, con filas estables.
- Graficas ligeras, ejes limpios y pocas series por defecto.
- Formularios densos pero claros.
- Estados de carga inmediatos con skeletons.
- Transiciones suaves sin bloquear interaccion.

Orden visual por pagina:

1. Encabezado con titulo y accion principal.
2. KPIs pequenos.
3. Filtros o selector contextual.
4. Grafica o tabla principal.
5. Detalle secundario.

## Fases De Implementacion

### Fase 1 - Nueva estructura

- Reorganizar navegacion en Dashboard, Logistica, Busqueda, Clientes, Comparativas y Datos.
- Dashboard pasa a ultimos 6 meses agregados.
- Mantener o redirigir rutas antiguas durante la transicion.
- Separar archivos grandes, especialmente Logistica, en modulos mas pequenos.

### Fase 2 - Capa rapida de datos

- Crear consultas especificas para Dashboard.
- Crear Busqueda sin carga inicial.
- Anadir paginacion en servidor para resultados.
- Crear vistas agregadas minimas en Supabase.
- Revisar indices reales de uso.

### Fase 3 - Redisenyo visual oscuro y plateado

- Definir tokens globales.
- Aplicar estilo a layout, sidebar, topbar, cards, tablas, formularios y graficas.
- Reducir color y ruido visual.
- Verificar superposicion, contraste, legibilidad y responsive.

### Fase 4 - Clientes 360

- Crear ficha de cliente completa.
- Incorporar precios medios, producto, fianza, transporte, volumen y evolucion.
- Cargar detalle historico bajo demanda.

### Fase 5 - Datos/Admin

- Mejorar importacion, modificacion, exportacion y borrado.
- Anadir validaciones de datos.
- Hacer operaciones grandes por bloques cuando haga falta.
- Reforzar confirmaciones de acciones destructivas.

## Testing Y Verificacion

Cada fase debe verificarse con:

- Build de Vite.
- Tests existentes de navegacion y rendimiento.
- Pruebas de consultas cuando se anadan vistas o indices.
- QA visual en desktop y mobile cuando el entorno de navegador lo permita.
- Comprobacion de que no se carga historico completo en entrada de Dashboard, Busqueda, Clientes o Comparativas.

## Riesgos

- Redisenar todo a la vez puede romper flujos utiles; se mitiga con fases pequenas.
- Las vistas agregadas pueden no cubrir todos los casos; se mitiga manteniendo detalle bajo demanda.
- Las tablas pueden volver a ser lentas si se filtra en cliente; se mitiga con paginacion en servidor.
- El estilo oscuro puede perder legibilidad; se mitiga con contraste alto y pruebas visuales.
- Logistica puede crecer demasiado; se mitiga separando CMR, hojas de ruta, exportadores y fichas en modulos propios.

## No Alcance Inicial

- No se definira todavia el apartado especial de EDEKA.
- No se cambiara la base completa a otra tecnologia.
- No se cargara historico completo automaticamente para simular fluidez.
- No se hara una landing page; la primera pantalla seguira siendo herramienta util.
