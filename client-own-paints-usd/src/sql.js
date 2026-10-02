// A deliberately small SQL parser for the storefront's database console.
// Supports: SELECT [count(*)|cols] FROM t [WHERE ...] [ORDER BY col [ASC|DESC]]
// [LIMIT n] [OFFSET n] · INSERT INTO t [(cols)] VALUES (...), (...) ·
// UPDATE t SET col = val, ... [WHERE ...] · DELETE FROM t [WHERE ...]
// WHERE clauses support AND / OR / NOT, parentheses, =, !=, <>, >, >=, <, <=,
// LIKE, ILIKE, IN (...), IS [NOT] NULL, and array containment (@>) for text[].

import { PgError } from "./pg-error.js";

const TWO_CHAR_OPS = [">=", "<=", "<>", "!=", "@>"];
const PUNCT = "(),*=<>{}[]";

function tokenize(sql) {
  const out = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < n && sql[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = "";
      i += 1;
      let closed = false;
      while (i < n) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            value += quote;
            i += 2;
            continue;
          }
          i += 1;
          closed = true;
          break;
        }
        value += sql[i];
        i += 1;
      }
      if (!closed) throw new PgError("unterminated quoted string", "42601");
      out.push({ type: "string", value });
      continue;
    }
    const two = sql.slice(i, i + 2);
    if (TWO_CHAR_OPS.includes(two)) {
      out.push({ type: "op", value: two === "<>" ? "!=" : two });
      i += 2;
      continue;
    }
    const number = /^-?\d+(?:\.\d+)?/.exec(sql.slice(i));
    if (number && /[\d.]/.test(ch)) {
      out.push({ type: "number", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(sql.slice(i));
    if (word) {
      out.push({ type: "word", value: word[0] });
      i += word[0].length;
      continue;
    }
    if (PUNCT.includes(ch)) {
      out.push({ type: "punct", value: ch });
      i += 1;
      continue;
    }
    throw new PgError(`syntax error at or near "${ch}"`, "42601");
  }
  return out;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.i + offset];
  }

  next() {
    return this.tokens[this.i++];
  }

  get atEnd() {
    return this.i >= this.tokens.length;
  }

  error(expected) {
    const token = this.peek();
    return new PgError(
      `syntax error at or near "${token ? token.value : "end of input"}"${expected ? ` (expected ${expected})` : ""}`,
      "42601",
    );
  }

  isWord(word, offset = 0) {
    const token = this.peek(offset);
    return !!token && token.type === "word" && token.value.toLowerCase() === word;
  }

  eatWord(word) {
    if (this.isWord(word)) {
      this.next();
      return true;
    }
    return false;
  }

  expectWord(word) {
    if (!this.eatWord(word)) throw this.error(word.toUpperCase());
  }

  isPunct(value) {
    return this.peek() && this.peek().value === value && this.peek().type === "punct";
  }

  eatPunct(value) {
    if (this.isPunct(value)) {
      this.next();
      return true;
    }
    return false;
  }

  expectPunct(value) {
    if (!this.eatPunct(value)) throw this.error(`"${value}"`);
  }

  identifier() {
    const token = this.next();
    if (!token || (token.type !== "word" && !(token.type === "punct" && token.value === "*")))
      throw this.error("identifier");
    return token.value;
  }

  parse() {
    if (this.isWord("select")) return this.parseSelect();
    if (this.isWord("insert")) return this.parseInsert();
    if (this.isWord("update")) return this.parseUpdate();
    if (this.isWord("delete")) return this.parseDelete();
    throw this.error("SELECT, INSERT, UPDATE or DELETE");
  }

  parseSelect() {
    this.expectWord("select");
    const columns = this.parseSelectList();
    this.expectWord("from");
    const table = this.identifier();
    const statement = {
      kind: "select",
      table,
      columns,
      aggregate: /count\s*\(\s*\*\s*\)/i.test(columns) ? "count" : null,
      filter: null,
      orders: [],
      limit: null,
      offset: 0,
    };
    if (this.eatWord("where")) statement.filter = this.parseExpression();
    if (this.isWord("order")) {
      this.next();
      this.expectWord("by");
      do {
        const column = this.identifier();
        const ascending = !this.eatWord("desc");
        if (this.isWord("asc")) this.next();
        statement.orders.push({ column, ascending });
      } while (this.eatPunct(","));
    }
    if (this.eatWord("limit")) statement.limit = this.number();
    if (this.eatWord("offset")) statement.offset = this.number();
    if (!this.atEnd) throw this.error("end of statement");
    return statement;
  }

  parseSelectList() {
    const parts = [];
    let depth = 0;
    while (!this.atEnd) {
      const token = this.peek();
      if (depth === 0 && token.type === "word" && token.value.toLowerCase() === "from") break;
      if (token.value === "(") depth += 1;
      if (token.value === ")") depth -= 1;
      parts.push(token.value);
      this.next();
    }
    if (!parts.length) throw this.error("select list");
    return parts.join("");
  }

  parseInsert() {
    this.expectWord("insert");
    this.expectWord("into");
    const table = this.identifier();
    let columns = null;
    if (this.eatPunct("(")) {
      columns = [];
      do {
        columns.push(this.identifier());
      } while (this.eatPunct(","));
      this.expectPunct(")");
    }
    this.expectWord("values");
    const rows = [];
    do {
      this.expectPunct("(");
      const values = [];
      do {
        values.push(this.parseValue());
      } while (this.eatPunct(","));
      this.expectPunct(")");
      if (columns && columns.length !== values.length)
        throw new PgError("INSERT has more expressions than target columns", "42601");
      if (columns) {
        const row = {};
        columns.forEach((column, index) => (row[column] = values[index]));
        rows.push(row);
      } else {
        rows.push(values[0]);
      }
    } while (this.eatPunct(","));
    if (!this.atEnd) throw this.error("end of statement");
    return { kind: "insert", table, values: rows };
  }

  parseUpdate() {
    this.expectWord("update");
    const table = this.identifier();
    this.expectWord("set");
    const values = {};
    do {
      const column = this.identifier();
      const op = this.next();
      if (!op || op.value !== "=") throw this.error("=");
      values[column] = this.parseValue();
    } while (this.eatPunct(","));
    const filter = this.eatWord("where") ? this.parseExpression() : null;
    if (!this.atEnd) throw this.error("end of statement");
    return { kind: "update", table, values, filter };
  }

  parseDelete() {
    this.expectWord("delete");
    this.expectWord("from");
    const table = this.identifier();
    const filter = this.eatWord("where") ? this.parseExpression() : null;
    if (!this.atEnd) throw this.error("end of statement");
    return { kind: "delete", table, filter };
  }

  parseExpression() {
    let node = this.parseAnd();
    while (this.eatWord("or")) {
      const right = this.parseAnd();
      node = node.type === "or" ? { type: "or", children: [...node.children, right] } : { type: "or", children: [node, right] };
    }
    return node;
  }

  parseAnd() {
    let node = this.parseNot();
    while (this.eatWord("and")) {
      const right = this.parseNot();
      node = node.type === "and" ? { type: "and", children: [...node.children, right] } : { type: "and", children: [node, right] };
    }
    return node;
  }

  parseNot() {
    if (this.eatWord("not")) return { type: "not", child: this.parseNot() };
    if (this.eatPunct("(")) {
      const node = this.parseExpression();
      this.expectPunct(")");
      return node;
    }
    return this.parseCondition();
  }

  parseCondition() {
    const column = this.identifier();
    if (this.eatWord("is")) {
      const negated = this.eatWord("not");
      this.expectWord("null");
      return { type: "cond", column, op: negated ? "is not" : "is", value: null };
    }
    if (this.eatWord("in")) {
      this.expectPunct("(");
      const values = [];
      do {
        values.push(this.parseValue());
      } while (this.eatPunct(","));
      this.expectPunct(")");
      return { type: "cond", column, op: "in", value: values };
    }
    if (this.isWord("like") || this.isWord("ilike")) {
      const op = this.next().value.toLowerCase();
      return { type: "cond", column, op, value: this.parseValue() };
    }
    const token = this.next();
    if (!token || !["op", "punct"].includes(token.type)) throw this.error("comparison operator");
    const op = token.value;
    if (!["=", "!=", ">", ">=", "<", "<=", "@>"].includes(op)) throw this.error("comparison operator");
    return { type: "cond", column, op, value: this.parseValue() };
  }

  parseValue() {
    const token = this.next();
    if (!token) throw this.error("a value");
    if (token.type === "string" || token.type === "number") return token.value;
    if (token.type === "word") {
      const lower = token.value.toLowerCase();
      if (lower === "null") return null;
      if (lower === "true") return true;
      if (lower === "false") return false;
      if (lower === "array") {
        this.expectPunct("[");
        const values = [];
        do {
          values.push(this.parseValue());
        } while (this.eatPunct(","));
        this.expectPunct("]");
        return values;
      }
      if (lower === "now") return new Date().toISOString();
      return token.value;
    }
    if (token.value === "{") {
      const values = [];
      while (!this.isPunct("}")) {
        const inner = this.next();
        if (!inner) throw this.error('"}"');
        if (inner.type === "string" || inner.type === "number") values.push(inner.value);
        else if (inner.type === "word" && inner.value.toLowerCase() !== "null") values.push(inner.value);
      }
      this.expectPunct("}");
      return values.map(String);
    }
    throw this.error("a value");
  }

  number() {
    const token = this.next();
    if (!token || token.type !== "number") throw this.error("a number");
    return token.value;
  }
}

export function parseSql(text) {
  const trimmed = String(text || "").trim().replace(/;\s*$/, "");
  if (!trimmed) throw new PgError("empty query", "42601");
  return new Parser(tokenize(trimmed)).parse();
}

// Flat list of simple conditions inside a tree — used for query planning.
export function flattenConditions(node, out = []) {
  if (!node) return out;
  if (node.type === "cond") out.push({ column: node.column, op: node.op, value: node.value });
  else if (node.type === "and" || node.type === "or") node.children.forEach((child) => flattenConditions(child, out));
  else if (node.type === "not") flattenConditions(node.child, out);
  return out;
}

export function matchesFilter(row, node) {
  if (!node) return true;
  if (Array.isArray(node)) return node.every((child) => matchesFilter(row, child));
  switch (node.type) {
    case "cond":
      return compareValue(row[node.column], node.op, node.value);
    case "and":
      return node.children.every((child) => matchesFilter(row, child));
    case "or":
      return node.children.some((child) => matchesFilter(row, child));
    case "not":
      return !matchesFilter(row, node.child);
    default:
      return true;
  }
}

function likeToRegExp(pattern, caseInsensitive) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

export function compareValue(actual, op, expected) {
  switch (op) {
    case "=":
      if (Array.isArray(actual)) return JSON.stringify(actual) === JSON.stringify(expected);
      if (typeof actual === "boolean") return actual === expected;
      if (typeof actual === "number") return actual === Number(expected);
      return actual != null && String(actual) === String(expected);
    case "!=":
    case "<>":
      return !compareValue(actual, "=", expected);
    case ">":
      return Number(actual) > Number(expected);
    case ">=":
      return Number(actual) >= Number(expected);
    case "<":
      return Number(actual) < Number(expected);
    case "<=":
      return Number(actual) <= Number(expected);
    case "like":
      return actual != null && likeToRegExp(expected, false).test(String(actual));
    case "ilike":
      return actual != null && likeToRegExp(expected, true).test(String(actual));
    case "in":
      return (Array.isArray(expected) ? expected : [expected]).some((value) => compareValue(actual, "=", value));
    case "is":
      return expected === null ? actual === null || actual === undefined : actual === expected;
    case "is not":
      return expected === null ? actual !== null && actual !== undefined : actual !== expected;
    case "@>":
      if (Array.isArray(actual)) {
        const list = Array.isArray(expected) ? expected : [expected];
        return list.every((value) => actual.includes(String(value)));
      }
      return String(actual).includes(String(expected));
    default:
      throw new PgError(`unsupported operator "${op}"`, "42601");
  }
}
