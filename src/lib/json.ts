import { jsonLanguage } from "@codemirror/lang-json";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface JsonSyntaxIssue {
  message: string;
  line: number;
  column: number;
  position: number;
}

export type JsonResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: JsonSyntaxIssue };

export type Indentation = 2 | 4;
export type StringInputMode = "auto" | "json" | "serialized";

const success = <T>(value: T): JsonResult<T> => ({ ok: true, value });

const failure = (error: JsonSyntaxIssue): JsonResult<never> => ({
  ok: false,
  error,
});

function positionFromLineColumn(
  text: string,
  line: number,
  column: number,
): number {
  let position = 0;
  let currentLine = 1;

  while (position < text.length && currentLine < line) {
    if (text[position] === "\r") {
      if (text[position + 1] === "\n") {
        position += 1;
      }
      currentLine += 1;
    } else if (text[position] === "\n") {
      currentLine += 1;
    }

    position += 1;
  }

  if (currentLine < line) return text.length;

  return Math.min(position + Math.max(column - 1, 0), text.length);
}

function lineColumnFromPosition(
  text: string,
  rawPosition: number,
): Pick<JsonSyntaxIssue, "line" | "column" | "position"> {
  const position = Math.min(Math.max(rawPosition, 0), text.length);
  let line = 1;
  let column = 1;

  for (let index = 0; index < position; index += 1) {
    if (text[index] === "\r") {
      if (text[index + 1] === "\n" && index + 1 < position) {
        index += 1;
      }
      line += 1;
      column = 1;
    } else if (text[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return {
    line,
    column,
    position,
  };
}

function firstSyntaxErrorPosition(text: string): number {
  let position = text.length;
  let found = false;

  jsonLanguage.parser.parse(text).iterate({
    enter(node) {
      if (!found && node.type.isError) {
        position = node.from;
        found = true;
      }
    },
  });

  return position;
}

function outerStringPosition(text: string, innerPosition: number): number {
  const openingQuote = text.indexOf('"');

  if (openingQuote === -1) {
    return 0;
  }

  let decodedPosition = 0;
  let sourcePosition = openingQuote + 1;

  while (sourcePosition < text.length && decodedPosition < innerPosition) {
    if (text[sourcePosition] !== "\\") {
      sourcePosition += 1;
      decodedPosition += 1;
      continue;
    }

    sourcePosition += text[sourcePosition + 1] === "u" ? 6 : 2;
    decodedPosition += 1;
  }

  return Math.min(sourcePosition, text.length);
}

function syntaxIssueFromError(text: string, error: unknown): JsonSyntaxIssue {
  const nativeMessage =
    error instanceof Error ? error.message : "Error de sintaxis desconocido";
  const lineColumnMatch = nativeMessage.match(
    /(?:at\s+)?line\s+(\d+)\s+column\s+(\d+)(?:\s+of\s+(?:the\s+)?JSON\s+data)?\)?\s*$/i,
  );

  let location: Pick<JsonSyntaxIssue, "line" | "column" | "position">;

  if (lineColumnMatch) {
    const line = Number(lineColumnMatch[1]);
    const column = Number(lineColumnMatch[2]);

    location = {
      line,
      column,
      position: positionFromLineColumn(text, line, column),
    };
  } else {
    const positionMatch = nativeMessage.match(/at\s+position\s+(\d+)\s*$/i);
    const position = positionMatch
      ? Number(positionMatch[1])
      : firstSyntaxErrorPosition(text);
    location = lineColumnFromPosition(text, position);
  }

  const detail = nativeMessage
    .replace(/^JSON\.parse:\s*/i, "")
    .replace(/\s+at position\s+\d+(?:\s+\(line\s+\d+\s+column\s+\d+\))?\s*$/i, "")
    .replace(/\s+at line\s+\d+\s+column\s+\d+(?:\s+of\s+(?:the\s+)?JSON\s+data)?\s*$/i, "")
    .trim();

  return {
    message: detail
      ? `JSON no válido: ${detail}`
      : "El contenido no tiene una sintaxis JSON válida.",
    ...location,
  };
}

function nextNonWhitespace(text: string, start: number): string | undefined {
  for (let index = start; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) return text[index];
  }

  return undefined;
}

function transformWhitespace(text: string, indentation?: Indentation): string {
  const indentUnit = indentation ? " ".repeat(indentation) : "";
  let output = "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  let previousSignificant = "";

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      output += character;

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
        previousSignificant = character;
      }

      continue;
    }

    if (/\s/.test(character)) continue;

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }

    if (!indentation) {
      output += character;
      previousSignificant = character;
      continue;
    }

    if (character === "{" || character === "[") {
      output += character;
      depth += 1;

      const closingCharacter = character === "{" ? "}" : "]";

      if (nextNonWhitespace(text, index + 1) !== closingCharacter) {
        output += `\n${indentUnit.repeat(depth)}`;
      }
    } else if (character === "}" || character === "]") {
      depth = Math.max(depth - 1, 0);

      const openingCharacter = character === "}" ? "{" : "[";

      if (previousSignificant !== openingCharacter) {
        output += `\n${indentUnit.repeat(depth)}`;
      }

      output += character;
    } else if (character === ",") {
      output += `,\n${indentUnit.repeat(depth)}`;
    } else if (character === ":") {
      output += ": ";
    } else {
      output += character;
    }

    previousSignificant = character;
  }

  return output;
}

export function parseJson(text: string): JsonResult<JsonValue> {
  if (text.trim().length === 0) {
    return failure({
      message: "Ingresa contenido JSON antes de continuar.",
      line: 1,
      column: 1,
      position: 0,
    });
  }

  try {
    return success(JSON.parse(text) as JsonValue);
  } catch (error) {
    return failure(syntaxIssueFromError(text, error));
  }
}

export function convertStringToJson(
  text: string,
  mode: StringInputMode = "auto",
): JsonResult<string> {
  const parsed = parseJson(text);

  if (!parsed.ok) {
    return parsed;
  }

  if (mode === "json") {
    return success(transformWhitespace(text));
  }

  if (typeof parsed.value !== "string") {
    if (mode === "serialized") {
      return failure({
        message: "La entrada no es un string JSON serializado.",
        line: 1,
        column: 1,
        position: 0,
      });
    }

    return success(transformWhitespace(text));
  }

  const nested = parseJson(parsed.value);

  if (nested.ok) {
    return success(transformWhitespace(parsed.value));
  }

  if (mode === "serialized") {
    const position = outerStringPosition(text, nested.error.position);
    const detail = nested.error.message.replace(/^JSON no válido:\s*/i, "");

    return failure({
      message: `El string contiene JSON interno no válido: ${detail}`,
      ...lineColumnFromPosition(text, position),
    });
  }

  return success(transformWhitespace(text));
}

export function beautifyJson(
  text: string,
  indentation: Indentation,
): JsonResult<string> {
  const parsed = parseJson(text);

  return parsed.ok ? success(transformWhitespace(text, indentation)) : parsed;
}

export function compactJson(text: string): JsonResult<string> {
  const parsed = parseJson(text);

  return parsed.ok ? success(transformWhitespace(text)) : parsed;
}

export function convertJsonToString(text: string): JsonResult<string> {
  const compacted = compactJson(text);

  return compacted.ok
    ? success(JSON.stringify(compacted.value))
    : compacted;
}
