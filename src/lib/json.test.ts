import { describe, expect, it } from "vitest";

import {
  beautifyJson,
  compactJson,
  convertJsonToString,
  convertStringToJson,
  parseJson,
} from "./json";

describe("convertStringToJson", () => {
  it("normaliza JSON compacto", () => {
    expect(convertStringToJson('{ "nombre": "Ana", "activo": true }')).toEqual({
      ok: true,
      value: '{"nombre":"Ana","activo":true}',
    });
  });

  it("deserializa un string que contiene JSON", () => {
    const input = JSON.stringify('{"nombre":"Ana","roles":["admin"]}');

    expect(convertStringToJson(input)).toEqual({
      ok: true,
      value: '{"nombre":"Ana","roles":["admin"]}',
    });
  });

  it("acepta arrays y valores primitivos", () => {
    expect(convertStringToJson("[1,true,null]")).toEqual({
      ok: true,
      value: "[1,true,null]",
    });
    expect(convertStringToJson("42")).toEqual({ ok: true, value: "42" });
  });

  it("mantiene un string JSON cuando su contenido no es otro JSON", () => {
    expect(convertStringToJson('"texto normal"')).toEqual({
      ok: true,
      value: '"texto normal"',
    });
  });

  it("permite forzar el modo serializado para detectar JSON interno inválido", () => {
    const result = convertStringToJson(
      JSON.stringify('{"nombre":}'),
      "serialized",
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.message).toContain("JSON interno no válido");
      expect(result.error.position).toBeGreaterThan(1);
    }
  });

  it("permite preservar un string JSON ambiguo en modo directo", () => {
    expect(convertStringToJson('"true"', "json")).toEqual({
      ok: true,
      value: '"true"',
    });
    expect(convertStringToJson('"true"', "auto")).toEqual({
      ok: true,
      value: "true",
    });
  });

  it("preserva números que JavaScript no puede representar sin pérdidas", () => {
    const input = '{ "id": 9007199254740993, "overflow": 1e400 }';

    expect(convertStringToJson(input)).toEqual({
      ok: true,
      value: '{"id":9007199254740993,"overflow":1e400}',
    });
  });

  it("conserva caracteres unicode", () => {
    expect(convertStringToJson('{"saludo":"¡Hola, 世界!"}')).toEqual({
      ok: true,
      value: '{"saludo":"¡Hola, 世界!"}',
    });
  });
});

describe("formato y compactación", () => {
  it("embellece usando la indentación seleccionada", () => {
    expect(beautifyJson('{"a":1,"b":{"c":true}}', 2)).toEqual({
      ok: true,
      value: '{\n  "a": 1,\n  "b": {\n    "c": true\n  }\n}',
    });
  });

  it("compacta JSON editado", () => {
    expect(compactJson('{\n    "a": 1,\n    "b": false\n}')).toEqual({
      ok: true,
      value: '{"a":1,"b":false}',
    });
  });

  it("conserva claves duplicadas y lexemas numéricos al formatear", () => {
    expect(beautifyJson('{"id":1,"id":2,"decimal":1.2300e+4}', 2)).toEqual({
      ok: true,
      value:
        '{\n  "id": 1,\n  "id": 2,\n  "decimal": 1.2300e+4\n}',
    });
  });
});

describe("convertJsonToString", () => {
  it("serializa el documento compacto como string escapado", () => {
    expect(convertJsonToString('{\n  "nombre": "Ana"\n}')).toEqual({
      ok: true,
      value: '"{\\"nombre\\":\\"Ana\\"}"',
    });
  });

  it("permite una conversión completa de ida y vuelta", () => {
    const original = '{"mensaje":"línea\\nnueva","valor":7}';
    const asString = convertJsonToString(original);

    expect(asString.ok).toBe(true);

    if (asString.ok) {
      expect(convertStringToJson(asString.value)).toEqual({
        ok: true,
        value: original,
      });
    }
  });
});

describe("parseJson", () => {
  it("ubica errores en documentos multilínea", () => {
    const result = parseJson('{\n  "a": 1,\n  "b":,\n  "c": 3\n}');

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.line).toBe(3);
      expect(result.error.column).toBeGreaterThan(1);
      expect(result.error.position).toBeGreaterThan(0);
    }
  });

  it("devuelve un error útil para una entrada vacía", () => {
    expect(parseJson("   ")).toEqual({
      ok: false,
      error: {
        message: "Ingresa contenido JSON antes de continuar.",
        line: 1,
        column: 1,
        position: 0,
      },
    });
  });

  it("rechaza comas finales", () => {
    expect(parseJson('{"a":1,}').ok).toBe(false);
  });

  it("interpreta retornos de carro como saltos de línea", () => {
    const result = parseJson('{\r"a":,\r"b":2}');

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.line).toBe(2);
    }
  });

  it("no confunde contenido del usuario con metadatos de posición", () => {
    const result = parseJson('{"texto":"line 9 column 8","valor":}');

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.line).toBe(1);
      expect(result.error.position).toBeGreaterThan(20);
    }
  });
});
