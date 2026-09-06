# JSON Forge

Convertidor, editor, formateador y validador JSON construido con Astro y TypeScript.
Todo el procesamiento ocurre localmente en el navegador.

## Funciones

- Convierte JSON directo o serializado desde un string.
- Editor CodeMirror con resaltado, líneas, lint y navegación al error.
- Embellece con 2 o 4 espacios sin alterar números, claves ni escapes.
- Valida y muestra la línea y columna del primer error.
- Compacta y convierte el documento nuevamente a un string escapado.
- Funciona en escritorio y dispositivos móviles.

## Requisitos

- Node.js 22.12 o superior.
- pnpm 11.17 o superior.

## Desarrollo

```sh
pnpm install
pnpm dev
```

Astro mostrará la URL local, normalmente `http://localhost:4321`.

## Verificación

```sh
pnpm test
pnpm check
pnpm build
```

## Formatos de entrada

El selector del panel String permite elegir entre tres modos:

- `Detectar`: interpreta automáticamente JSON directo o un string que contenga JSON.
- `JSON directo`: conserva los valores string que también podrían interpretarse como JSON.
- `String escapado`: exige que la entrada sea un string serializado y valida su contenido interno.

El formateo es léxico y sin pérdidas. Por ejemplo, conserva enteros mayores que
`Number.MAX_SAFE_INTEGER`, exponentes grandes y claves duplicadas.

## Seguridad

El proyecto no tiene backend ni envía el contenido de los editores por red. La
configuración de pnpm bloquea scripts de instalación no revisados y autoriza
únicamente el build de `esbuild`, requerido por Astro y Vite.
