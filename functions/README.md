# Publicación automática de Instante Trips

El editor se sirve en Vercel. Los borradores, notas y fotografías comprimidas se guardan en colecciones privadas de Firestore por medio de `/api/editor`, autenticada con Firebase Auth. La API admite al administrador existente; otros redactores requieren `editor_members/{uid}` con `active: true` y rol `editor` o `admin`.

## Activar el servicio programado

1. Vincular facturación Blaze al proyecto `instantetrips-editor` y configurar alertas de presupuesto. No se activa facturación desde el código.
2. Iniciar sesión con Firebase CLI como propietario del proyecto.
3. Desde la raíz del repositorio, instalar las dependencias de `functions` y desplegar solo la función:

   npm --prefix functions ci
   firebase deploy --only functions:publishEditorialCalendar --project instantetrips-editor

4. Esperar la primera ejecución y confirmar que `editor_system/scheduler.lastHeartbeat` cambia cada minuto. La interfaz habilita Programar únicamente cuando la última ejecución es reciente.
5. Programar una publicación de prueba autorizada. Verificar la zona horaria, cerrar el editor y comprobar en GitHub un solo commit, y en la web el marcador `editor-revision` correspondiente. Solo entonces el estado pasa a Publicado.

La función utiliza las credenciales administradas de Firebase y la conexión GitHub privada en `server_config/main`. El admin migra la configuración antigua a esa colección privada y deja solo metadatos públicos en `config/main`. El editor accede a GitHub mediante la API del servidor; también se admite `EDITOR_GITHUB_TOKEN` como secreto de Vercel. No copiar credenciales a archivos de código.

## Vercel

Mantener la variable privada existente `FIREBASE_SERVICE_ACCOUNT`. Variables opcionales:

- `EDITOR_ADMIN_EMAILS`: administradores separados por comas; valor predeterminado: administrador actual.
- `EDITOR_GITHUB_TOKEN`: conexión GitHub del servidor; prevalece sobre la configuración heredada.
- `EDITOR_USE_STORAGE=true`: guardar nuevas fotografías en el bucket privado en vez de Firestore. Activar solo cuando el bucket esté creado y el servidor tenga acceso.
- `EDITOR_STORAGE_BUCKET`: bucket privado; predeterminado: `instantetrips-editor.firebasestorage.app`.

## Privacidad y límites

Las colecciones `editor_*` no deben permitir acceso directo desde clientes. El servidor comprueba sesión, membresía y propietario. Las imágenes de la primera versión se comprimen a unos 420 KB (límite de 460.000 bytes) y se mantienen privadas en Firestore, disponible con Spark. El consumo está sujeto a las cuotas de Firebase; para bibliotecas grandes, habilitar Storage antes de crecer.

La biblioteca inicial muestra hasta 250 imágenes, y la lista hasta 500 artículos. Los resultados resumen hasta 1.500 eventos de los últimos 30 días e indican si se alcanzó ese límite. No representan usuarios únicos.

Los borradores y programados no se escriben en `src/pages/posts` hasta publicar. Las publicaciones actualizadas conservan su dirección. La fecha programada inicia el trabajo; el tiempo de compilación de Vercel se suma al intervalo del planificador.

Los conflictos de versiones detienen el guardado. Los conflictos con cambios externos en GitHub requieren recargar/importar la versión correcta; no se sobrescriben automáticamente. Hay hasta cinco intentos para fallos transitorios de publicaciones programadas.

El asistente ofrece estructura, títulos orientativos y revisión basada en el texto. La integración opcional con Gemini se habilita únicamente al configurar `EDITOR_GEMINI_API_KEY` y `EDITOR_GEMINI_MODEL` en el servidor de Vercel. Usar un modelo disponible en la cuenta y revisar sus condiciones y precios: https://ai.google.dev/gemini-api/docs/models . No reutilizar la clave pública de Firebase. Hasta configurar estas variables, la generación permanece desactivada.

Cada generación requiere confirmar en la interfaz el envío del título y relato a Gemini. Se limita el texto a 20.000 caracteres y a 20 solicitudes por cuenta y día. La respuesta se muestra como texto y solo se inserta tras una acción explícita; nunca se publica automáticamente. La IA no verifica hechos y el autor debe revisar la propuesta.

## Validación

npm run test:editor
npm run build

Las pruebas usan datos aislados y un GitHub simulado; no publican artículos reales. La prueba final del servicio automático requiere la activación y comprobación indicadas arriba.


## Herramientas editoriales y medición (octubre de 2026)

- El resumen rápido es opcional y pertenece a cada artículo. El editor conserva `quickSummary` al guardar/publicar; no se rellenan presupuestos ni descargas de ejemplo.
- Afiliados y recursos se administran en los ajustes del sitio. Usar enlaces completos oficiales, verificar las condiciones y marcar la confirmación. No se generan IDs, comisiones ni descuentos. Los enlaces insertados con `data-catalog-id` se resuelven durante la compilación; una ficha desactivada conserva su texto sin enlace.
- PDF: hasta 1.500.000 bytes, preparado de forma privada. Solo se publica si su URL forma parte del catálogo al publicar los ajustes. Se sirve como archivo adjunto. Mantener hasta 30 grupos de archivos pendientes por publicación.
- El manifiesto ahora forma parte de las cinco páginas informativas editables.
- Los guardados de artículos conservan la versión previa desde esta actualización. Historial recupera como borrador; no publica. Papelera sigue siendo independiente.
- Respaldos del editor: JSON descargado en el dispositivo, hasta 500 artículos y 250 fotos privadas, más notas activas. Las imágenes externas/publicadas se conservan como enlaces. Importar crea nuevos borradores y copias de las fotos incluidas, nunca publica ni restablece programaciones. Respaldos del admin: ajustes y cinco páginas, sin secretos ni archivos del alojamiento; recuperar reemplaza borradores tras confirmación. Guardar los JSON en un lugar privado.
- La medición v2 espera permiso, respeta No rastrear y agrupa página/tipo/referencia por día. No mezcla los registros antiguos de `analytics_events`. El endpoint valida origen, tipo, ruta, tamaño e IDs; limita frecuencia con Firestore, deduplica reintentos recientes y aplica un cupo global diario. Los límites reducen abuso; no sustituyen la protección de infraestructura.
- Los agregados caducan a los 90 días y las cuotas a los dos días. Se limpian hasta 20 documentos de cada colección cada 20 eventos aceptados; no es una tarea programada ni una garantía de borrado exacto en ausencia de tráfico. No se guardan IP, user-agent ni referrer en los nuevos registros. La clave privada del servidor se usa para derivar una huella diaria de control de abuso; no se exporta al navegador.
- RSS y búsqueda se regeneran desde los artículos publicados. La suscripción por correo solo aparece al configurar un formulario https real desde Audiencia; el sitio no mantiene una lista de correos propia.
- El calendario automático continúa desactivado hasta configurar y comprobar el servicio. Esta entrega no activa facturación ni IA.
