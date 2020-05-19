"use strict";

const Operation = function (opType, opFnc, ...operands) {
  this.operands = operands;
  this.opType = opType;
  this.opFnc = opFnc;
};

Operation.prototype.prefix = function () {
  return `(${this.opType} ${this.operands.map((i) => i.prefix()).join(" ")})`;
};

Operation.prototype.evaluate = function (...args) {
  return this.opFnc.apply(
    this,
    this.operands.map((op) => op.evaluate(...args))
  );
};

Operation.prototype.toString = function () {
  return `${this.operands.join(" ")} ${this.opType}`;
};

function make(sign, op, argNum) {
  function fnc(...args) {
    Operation.call(this, sign, op, ...args);
  }
  fnc.prototype = Object.create(Operation.prototype);
  fnc.argNum = argNum;
  return fnc;
}

const Add = make("+", (a, b) => a + b, 2);
const Subtract = make("-", (a, b) => a - b, 2);
const Multiply = make("*", (a, b) => a * b, 2);
const Divide = make("/", (a, b) => a / b, 2);
const Negate = make("negate", (x) => -x, 1);
const Min3 = make("min3", (a, b, c) => Math.min(a, Math.min(b, c)), 3);
const Max5 = make(
  "max5",
  (a, b, c, d, e) => Math.max(a, Math.max(b, Math.max(c, Math.max(d, e)))),
  5
);
const Exp = make("exp", (a) => Math.exp(a), 1);
const ArcTan = make("atan", (a) => Math.atan(a), 1);

function Variable(varName) {
  this.varName = varName;
}
Variable.prototype.evaluate = function (...args) {
  this.pos = "xyz".indexOf(this.varName);
  return args[this.pos];
};
Variable.prototype.toString = function () {
  return this.varName;
};
Variable.prototype.prefix = function () {
  return this.varName;
};

function Const(val) {
  this.val = val;
}
Const.prototype.evaluate = function (...args) {
  return this.val;
};
Const.prototype.toString = function () {
  return this.val.toString();
};
Const.prototype.prefix = function () {
  return this.val.toString();
};

const parsePrefix = (() => {
  let source;

  const opMap = {
    "+": Add,
    "-": Subtract,
    "/": Divide,
    "*": Multiply,
    negate: Negate,
    exp: Exp,
    atan: ArcTan,
  };

  const parsePrefix = (str) => {
    source = str;
    exceptionHablers.errorThrower(str.length === 0, "EmptyInput");
    exceptionHablers.checkBrecketSequence();
    return parse(0, source.length);
  };

  const skipWhitespaces = (l) => {
    while (source[l] === " ") {
      l++;
    }
    return l;
  };

  const parseComplexOp = (l, r) => {
    let res = "";
    while (l < r && source[l] !== " " && !exceptionHablers.isBraket(source[l]))
      res += source[l++];
    return res;
  };

  const getOp = (l, r) => {
    l = skipWhitespaces(l);
    const res = parseComplexOp(l, r);
    if (res in opMap && !(res === "-" && exceptionHablers.isDigit(res))) {
      return { op: opMap[res], end: skipWhitespaces(l + res.length) };
    }
    exceptionHablers.checkUnacceptableSymbols(l, l);
    return undefined;
  };

  const skipBrackets = (l, r, rstrict = false) => {
    let firstIn = true;
    let bracketCount = 0;
    if (l > 0 && source[l - 1] === "(") bracketCount++;
    for (; l <= r; l++) {
      if (bracketCount === 0 && !rstrict && !firstIn) break;
      if (firstIn) firstIn = false;
      if (source[l] === "(") bracketCount++;
      if (source[l] === ")") bracketCount--;
      if (bracketCount < 0) {
        break;
      }
    }
    exceptionHablers.errorThrower(
      bracketCount !== 0,
      new Error("wrong bracket sequence")
    );
    return l - 1;
  };

  const parseNumStr = (l) => {
    let res = "";
    for (; exceptionHablers.isDigit(source[l]) || source[l] === "-"; l++) {
      res += source[l];
    }
    exceptionHablers.errorThrower(res.length === 0, new Error("NaN"));
    return res;
  };

  const getArg = (l, r) => {
    l = skipWhitespaces(l);
    while (source[l] === ")") {
      l = skipWhitespaces(l + 1);
    }
    if (source[l] === "(") {
      const end = skipBrackets(l, r);
      return { res: parse(l, end), end: skipWhitespaces(end) };
    } else if (exceptionHablers.isAcceptableLetter(source[l])) {
      exceptionHablers.checkPlaceholder(l, l, true);
      return { res: new Variable(source[l]), end: skipWhitespaces(l + 1) };
    } else if (exceptionHablers.isDigit(source[l]) || source[l] === "-") {
      const res = parseNumStr(l, r);
      exceptionHablers.checkPlaceholder(l, l + res.length - 1);
      return {
        res: new Const(parseInt(res)),
        end: skipWhitespaces(l + res.length),
      };
    }
    exceptionHablers.checkUnacceptableSymbols(l, l);
  };

  const isUndefined = (val) => val === undefined;

  const parse = (l, r) => {
    if (source[l] === "(") l++;
    const op = getOp(l, r);
    const operands = [];
    let start = isUndefined(op) ? l : op.end;
    let end = r;
    for (let i = 0; i < (isUndefined(op) ? 1 : op.op.argNum); i++) {
      let arg = getArg(start, end);
      operands.push(arg.res);
      start = arg.end;
    }
    exceptionHablers.checkSingle(start, r);
    return isUndefined(op) ? operands[0] : new op.op(...operands);
  };

  const exceptionHablers = (() => {
    const isLetter = (ch) => {
      try {
        return ch.toUpperCase() !== ch.toLowerCase();
      } catch (e) {
        throw new Error("Wrong Number of Arguments");
      }
    };
    const isDigit = (ch) => ch <= "9" && ch >= "0";
    const isBraket = (ch) => ch === "(" || ch === ")";
    const isAcceptableLetter = (ch) => ch === "x" || ch === "y" || ch === "z";

    const checkBrecketSequence = () => skipBrackets(0, source.length, true);

    const checkSingle = (l, r) => {
      let i = l;
      if (source[i] === ")") i++;
      for (; i < r && source[i] === " "; i++);
      if (source[i] !== ")" && i !== source.length && i <= r) {
        throw new Error("Operands without operator");
      }
    };

    const checkBareBrackets = (l, r) =>
      errorThrower(
        l > 0 &&
          source[l - 1] === "(" &&
          r < source.length - 1 &&
          source[r + 1] === ")",
        new Error("Bare brackets")
      );

    const checkPlaceholder = (l, r, isVar = false) => {
      exceptionHablers.errorThrower(
        (l > 0 &&
          source[l - 1] !== " " &&
          source[l - 1] !== ")" &&
          source[l - 1] !== "(" &&
          (source[l - 1] !== "-" || isVar)) ||
          (r < source.length - 1 &&
            source[r + 1] !== " " &&
            source[r + 1] !== ")" &&
            source[r + 1] !== "("),
        new Error(`Wrong ${isVar ? "Variable" : "Number"}`)
      );
      checkBareBrackets(l, r);
    };

    const checkUnacceptableSymbols = (l, r) => {
      if (
        !isDigit(source[l]) &&
        !isBraket(source[l]) &&
        !isAcceptableLetter(source[l]) &&
        source[l] !== " " &&
        !(source[l] in opMap)
      ) {
        if (isLetter(source[l])) {
          const res = parseComplexOp(l, r);
          exceptionHablers.errorThrower(
            !(res in opMap),
            new Error(`Unacceptable symbol ${res} at position ${l}`)
          );
        }
        exceptionHablers.errorThrower(
          true,
          `Unacceptable symbol ${source[l]} at position ${l}`
        );
      }
    };
    const errorThrower = (cond, err) => {
      if (cond) throw err;
    };
    return {
      checkUnacceptableSymbols,
      checkBrecketSequence,
      checkSingle,
      isBraket,
      checkPlaceholder,
      isDigit,
      isAcceptableLetter,
      errorThrower,
    };
  })();
  return parsePrefix;
})();
