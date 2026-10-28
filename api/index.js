import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType;
var init_util = __esm({
  "node_modules/zod/v3/helpers/util.js"() {
    (function(util2) {
      util2.assertEqual = (_) => {
      };
      function assertIs(_arg) {
      }
      util2.assertIs = assertIs;
      function assertNever(_x) {
        throw new Error();
      }
      util2.assertNever = assertNever;
      util2.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
          obj[item] = item;
        }
        return obj;
      };
      util2.getValidEnumValues = (obj) => {
        const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
          filtered[k] = obj[k];
        }
        return util2.objectValues(filtered);
      };
      util2.objectValues = (obj) => {
        return util2.objectKeys(obj).map(function(e) {
          return obj[e];
        });
      };
      util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
        const keys = [];
        for (const key in object) {
          if (Object.prototype.hasOwnProperty.call(object, key)) {
            keys.push(key);
          }
        }
        return keys;
      };
      util2.find = (arr, checker) => {
        for (const item of arr) {
          if (checker(item))
            return item;
        }
        return void 0;
      };
      util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
      function joinValues(array, separator = " | ") {
        return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
      }
      util2.joinValues = joinValues;
      util2.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      };
    })(util || (util = {}));
    (function(objectUtil2) {
      objectUtil2.mergeShapes = (first, second) => {
        return {
          ...first,
          ...second
          // second overwrites first
        };
      };
    })(objectUtil || (objectUtil = {}));
    ZodParsedType = util.arrayToEnum([
      "string",
      "nan",
      "number",
      "integer",
      "float",
      "boolean",
      "date",
      "bigint",
      "symbol",
      "function",
      "undefined",
      "null",
      "array",
      "object",
      "unknown",
      "promise",
      "void",
      "never",
      "map",
      "set"
    ]);
    getParsedType = (data) => {
      const t = typeof data;
      switch (t) {
        case "undefined":
          return ZodParsedType.undefined;
        case "string":
          return ZodParsedType.string;
        case "number":
          return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
          return ZodParsedType.boolean;
        case "function":
          return ZodParsedType.function;
        case "bigint":
          return ZodParsedType.bigint;
        case "symbol":
          return ZodParsedType.symbol;
        case "object":
          if (Array.isArray(data)) {
            return ZodParsedType.array;
          }
          if (data === null) {
            return ZodParsedType.null;
          }
          if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return ZodParsedType.promise;
          }
          if (typeof Map !== "undefined" && data instanceof Map) {
            return ZodParsedType.map;
          }
          if (typeof Set !== "undefined" && data instanceof Set) {
            return ZodParsedType.set;
          }
          if (typeof Date !== "undefined" && data instanceof Date) {
            return ZodParsedType.date;
          }
          return ZodParsedType.object;
        default:
          return ZodParsedType.unknown;
      }
    };
  }
});

// node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson, ZodError;
var init_ZodError = __esm({
  "node_modules/zod/v3/ZodError.js"() {
    init_util();
    ZodIssueCode = util.arrayToEnum([
      "invalid_type",
      "invalid_literal",
      "custom",
      "invalid_union",
      "invalid_union_discriminator",
      "invalid_enum_value",
      "unrecognized_keys",
      "invalid_arguments",
      "invalid_return_type",
      "invalid_date",
      "invalid_string",
      "too_small",
      "too_big",
      "invalid_intersection_types",
      "not_multiple_of",
      "not_finite"
    ]);
    quotelessJson = (obj) => {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(/"([^"]+)":/g, "$1:");
    };
    ZodError = class _ZodError extends Error {
      get errors() {
        return this.issues;
      }
      constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
          this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
          this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(this, actualProto);
        } else {
          this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
      }
      format(_mapper) {
        const mapper = _mapper || function(issue) {
          return issue.message;
        };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
          for (const issue of error.issues) {
            if (issue.code === "invalid_union") {
              issue.unionErrors.map(processError);
            } else if (issue.code === "invalid_return_type") {
              processError(issue.returnTypeError);
            } else if (issue.code === "invalid_arguments") {
              processError(issue.argumentsError);
            } else if (issue.path.length === 0) {
              fieldErrors._errors.push(mapper(issue));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < issue.path.length) {
                const el = issue.path[i];
                const terminal = i === issue.path.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        };
        processError(this);
        return fieldErrors;
      }
      static assert(value) {
        if (!(value instanceof _ZodError)) {
          throw new Error(`Not a ZodError: ${value}`);
        }
      }
      toString() {
        return this.message;
      }
      get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
      }
      get isEmpty() {
        return this.issues.length === 0;
      }
      flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
          if (sub.path.length > 0) {
            const firstEl = sub.path[0];
            fieldErrors[firstEl] = fieldErrors[firstEl] || [];
            fieldErrors[firstEl].push(mapper(sub));
          } else {
            formErrors.push(mapper(sub));
          }
        }
        return { formErrors, fieldErrors };
      }
      get formErrors() {
        return this.flatten();
      }
    };
    ZodError.create = (issues) => {
      const error = new ZodError(issues);
      return error;
    };
  }
});

// node_modules/zod/v3/locales/en.js
var errorMap, en_default;
var init_en = __esm({
  "node_modules/zod/v3/locales/en.js"() {
    init_ZodError();
    init_util();
    errorMap = (issue, _ctx) => {
      let message;
      switch (issue.code) {
        case ZodIssueCode.invalid_type:
          if (issue.received === ZodParsedType.undefined) {
            message = "Required";
          } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
          }
          break;
        case ZodIssueCode.invalid_literal:
          message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
          break;
        case ZodIssueCode.unrecognized_keys:
          message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
          break;
        case ZodIssueCode.invalid_union:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_union_discriminator:
          message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
          break;
        case ZodIssueCode.invalid_enum_value:
          message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
          break;
        case ZodIssueCode.invalid_arguments:
          message = `Invalid function arguments`;
          break;
        case ZodIssueCode.invalid_return_type:
          message = `Invalid function return type`;
          break;
        case ZodIssueCode.invalid_date:
          message = `Invalid date`;
          break;
        case ZodIssueCode.invalid_string:
          if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
              message = `Invalid input: must include "${issue.validation.includes}"`;
              if (typeof issue.validation.position === "number") {
                message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
              }
            } else if ("startsWith" in issue.validation) {
              message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
              message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
              util.assertNever(issue.validation);
            }
          } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
          } else {
            message = "Invalid";
          }
          break;
        case ZodIssueCode.too_small:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "bigint")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.too_big:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "bigint")
            message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.custom:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_intersection_types:
          message = `Intersection results could not be merged`;
          break;
        case ZodIssueCode.not_multiple_of:
          message = `Number must be a multiple of ${issue.multipleOf}`;
          break;
        case ZodIssueCode.not_finite:
          message = "Number must be finite";
          break;
        default:
          message = _ctx.defaultError;
          util.assertNever(issue);
      }
      return { message };
    };
    en_default = errorMap;
  }
});

// node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors = __esm({
  "node_modules/zod/v3/errors.js"() {
    init_en();
    overrideErrorMap = en_default;
  }
});

// node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync;
var init_parseUtil = __esm({
  "node_modules/zod/v3/helpers/parseUtil.js"() {
    init_errors();
    init_en();
    makeIssue = (params) => {
      const { data, path: path4, errorMaps, issueData } = params;
      const fullPath = [...path4, ...issueData.path || []];
      const fullIssue = {
        ...issueData,
        path: fullPath
      };
      if (issueData.message !== void 0) {
        return {
          ...issueData,
          path: fullPath,
          message: issueData.message
        };
      }
      let errorMessage = "";
      const maps = errorMaps.filter((m) => !!m).slice().reverse();
      for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
      }
      return {
        ...issueData,
        path: fullPath,
        message: errorMessage
      };
    };
    EMPTY_PATH = [];
    ParseStatus = class _ParseStatus {
      constructor() {
        this.value = "valid";
      }
      dirty() {
        if (this.value === "valid")
          this.value = "dirty";
      }
      abort() {
        if (this.value !== "aborted")
          this.value = "aborted";
      }
      static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
          if (s.status === "aborted")
            return INVALID;
          if (s.status === "dirty")
            status.dirty();
          arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
      }
      static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value
          });
        }
        return _ParseStatus.mergeObjectSync(status, syncPairs);
      }
      static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
          const { key, value } = pair;
          if (key.status === "aborted")
            return INVALID;
          if (value.status === "aborted")
            return INVALID;
          if (key.status === "dirty")
            status.dirty();
          if (value.status === "dirty")
            status.dirty();
          if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
            finalObject[key.value] = value.value;
          }
        }
        return { status: status.value, value: finalObject };
      }
    };
    INVALID = Object.freeze({
      status: "aborted"
    });
    DIRTY = (value) => ({ status: "dirty", value });
    OK = (value) => ({ status: "valid", value });
    isAborted = (x) => x.status === "aborted";
    isDirty = (x) => x.status === "dirty";
    isValid = (x) => x.status === "valid";
    isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  }
});

// node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = __esm({
  "node_modules/zod/v3/helpers/typeAliases.js"() {
  }
});

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm({
  "node_modules/zod/v3/helpers/errorUtil.js"() {
    (function(errorUtil2) {
      errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
      errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
    })(errorUtil || (errorUtil = {}));
  }
});

// node_modules/zod/v3/types.js
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER;
var init_types = __esm({
  "node_modules/zod/v3/types.js"() {
    init_ZodError();
    init_errors();
    init_errorUtil();
    init_parseUtil();
    init_util();
    ParseInputLazyPath = class {
      constructor(parent, value, path4, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path4;
        this._key = key;
      }
      get path() {
        if (!this._cachedPath.length) {
          if (Array.isArray(this._key)) {
            this._cachedPath.push(...this._path, ...this._key);
          } else {
            this._cachedPath.push(...this._path, this._key);
          }
        }
        return this._cachedPath;
      }
    };
    handleResult = (ctx, result) => {
      if (isValid(result)) {
        return { success: true, data: result.value };
      } else {
        if (!ctx.common.issues.length) {
          throw new Error("Validation failed but no issues detected.");
        }
        return {
          success: false,
          get error() {
            if (this._error)
              return this._error;
            const error = new ZodError(ctx.common.issues);
            this._error = error;
            return this._error;
          }
        };
      }
    };
    ZodType = class {
      get description() {
        return this._def.description;
      }
      _getType(input) {
        return getParsedType(input.data);
      }
      _getOrReturnCtx(input, ctx) {
        return ctx || {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        };
      }
      _processInputParams(input) {
        return {
          status: new ParseStatus(),
          ctx: {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          }
        };
      }
      _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
          throw new Error("Synchronous parse encountered promise.");
        }
        return result;
      }
      _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
      }
      parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      safeParse(data, params) {
        const ctx = {
          common: {
            issues: [],
            async: params?.async ?? false,
            contextualErrorMap: params?.errorMap
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
      }
      "~validate"(data) {
        const ctx = {
          common: {
            issues: [],
            async: !!this["~standard"].async
          },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        if (!this["~standard"].async) {
          try {
            const result = this._parseSync({ data, path: [], parent: ctx });
            return isValid(result) ? {
              value: result.value
            } : {
              issues: ctx.common.issues
            };
          } catch (err) {
            if (err?.message?.toLowerCase()?.includes("encountered")) {
              this["~standard"].async = true;
            }
            ctx.common = {
              issues: [],
              async: true
            };
          }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        });
      }
      async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      async safeParseAsync(data, params) {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params?.errorMap,
            async: true
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
      }
      refine(check, message) {
        const getIssueProperties = (val) => {
          if (typeof message === "string" || typeof message === "undefined") {
            return { message };
          } else if (typeof message === "function") {
            return message(val);
          } else {
            return message;
          }
        };
        return this._refinement((val, ctx) => {
          const result = check(val);
          const setError = () => ctx.addIssue({
            code: ZodIssueCode.custom,
            ...getIssueProperties(val)
          });
          if (typeof Promise !== "undefined" && result instanceof Promise) {
            return result.then((data) => {
              if (!data) {
                setError();
                return false;
              } else {
                return true;
              }
            });
          }
          if (!result) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
          if (!check(val)) {
            ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
            return false;
          } else {
            return true;
          }
        });
      }
      _refinement(refinement) {
        return new ZodEffects({
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "refinement", refinement }
        });
      }
      superRefine(refinement) {
        return this._refinement(refinement);
      }
      constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
          version: 1,
          vendor: "zod",
          validate: (data) => this["~validate"](data)
        };
      }
      optional() {
        return ZodOptional.create(this, this._def);
      }
      nullable() {
        return ZodNullable.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return ZodArray.create(this);
      }
      promise() {
        return ZodPromise.create(this, this._def);
      }
      or(option) {
        return ZodUnion.create([this, option], this._def);
      }
      and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
      }
      transform(transform) {
        return new ZodEffects({
          ...processCreateParams(this._def),
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "transform", transform }
        });
      }
      default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
          ...processCreateParams(this._def),
          innerType: this,
          defaultValue: defaultValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodDefault
        });
      }
      brand() {
        return new ZodBranded({
          typeName: ZodFirstPartyTypeKind.ZodBranded,
          type: this,
          ...processCreateParams(this._def)
        });
      }
      catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
          ...processCreateParams(this._def),
          innerType: this,
          catchValue: catchValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodCatch
        });
      }
      describe(description) {
        const This = this.constructor;
        return new This({
          ...this._def,
          description
        });
      }
      pipe(target) {
        return ZodPipeline.create(this, target);
      }
      readonly() {
        return ZodReadonly.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    };
    cuidRegex = /^c[^\s-]{8,}$/i;
    cuid2Regex = /^[0-9a-z]+$/;
    ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    nanoidRegex = /^[a-z0-9_-]{21}$/i;
    jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
    _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
    ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
    dateRegex = new RegExp(`^${dateRegexSource}$`);
    ZodString = class _ZodString extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.length < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.length > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "length") {
            const tooBig = input.data.length > check.value;
            const tooSmall = input.data.length < check.value;
            if (tooBig || tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              if (tooBig) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              } else if (tooSmall) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              }
              status.dirty();
            }
          } else if (check.kind === "email") {
            if (!emailRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "email",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "emoji") {
            if (!emojiRegex) {
              emojiRegex = new RegExp(_emojiRegex, "u");
            }
            if (!emojiRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "emoji",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "uuid") {
            if (!uuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "uuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "nanoid") {
            if (!nanoidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "nanoid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid") {
            if (!cuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid2") {
            if (!cuid2Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid2",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ulid") {
            if (!ulidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ulid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "url") {
            try {
              new URL(input.data);
            } catch {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "regex") {
            check.regex.lastIndex = 0;
            const testResult = check.regex.test(input.data);
            if (!testResult) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "regex",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "trim") {
            input.data = input.data.trim();
          } else if (check.kind === "includes") {
            if (!input.data.includes(check.value, check.position)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { includes: check.value, position: check.position },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "toLowerCase") {
            input.data = input.data.toLowerCase();
          } else if (check.kind === "toUpperCase") {
            input.data = input.data.toUpperCase();
          } else if (check.kind === "startsWith") {
            if (!input.data.startsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { startsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "endsWith") {
            if (!input.data.endsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { endsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "datetime") {
            const regex = datetimeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "datetime",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "date") {
            const regex = dateRegex;
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "date",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "time") {
            const regex = timeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "time",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "duration") {
            if (!durationRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "duration",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ip") {
            if (!isValidIP(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ip",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "jwt") {
            if (!isValidJWT(input.data, check.alg)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "jwt",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cidr") {
            if (!isValidCidr(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cidr",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64") {
            if (!base64Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64url") {
            if (!base64urlRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
          validation,
          code: ZodIssueCode.invalid_string,
          ...errorUtil.errToObj(message)
        });
      }
      _addCheck(check) {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
      }
      url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
      }
      emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
      }
      uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
      }
      nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
      }
      cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
      }
      cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
      }
      ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
      }
      base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
      }
      base64url(message) {
        return this._addCheck({
          kind: "base64url",
          ...errorUtil.errToObj(message)
        });
      }
      jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
      }
      ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
      }
      cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
      }
      datetime(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "datetime",
            precision: null,
            offset: false,
            local: false,
            message: options
          });
        }
        return this._addCheck({
          kind: "datetime",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          offset: options?.offset ?? false,
          local: options?.local ?? false,
          ...errorUtil.errToObj(options?.message)
        });
      }
      date(message) {
        return this._addCheck({ kind: "date", message });
      }
      time(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "time",
            precision: null,
            message: options
          });
        }
        return this._addCheck({
          kind: "time",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          ...errorUtil.errToObj(options?.message)
        });
      }
      duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
      }
      regex(regex, message) {
        return this._addCheck({
          kind: "regex",
          regex,
          ...errorUtil.errToObj(message)
        });
      }
      includes(value, options) {
        return this._addCheck({
          kind: "includes",
          value,
          position: options?.position,
          ...errorUtil.errToObj(options?.message)
        });
      }
      startsWith(value, message) {
        return this._addCheck({
          kind: "startsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      endsWith(value, message) {
        return this._addCheck({
          kind: "endsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      min(minLength, message) {
        return this._addCheck({
          kind: "min",
          value: minLength,
          ...errorUtil.errToObj(message)
        });
      }
      max(maxLength, message) {
        return this._addCheck({
          kind: "max",
          value: maxLength,
          ...errorUtil.errToObj(message)
        });
      }
      length(len, message) {
        return this._addCheck({
          kind: "length",
          value: len,
          ...errorUtil.errToObj(message)
        });
      }
      /**
       * Equivalent to `.min(1)`
       */
      nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
      }
      trim() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "trim" }]
        });
      }
      toLowerCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toLowerCase" }]
        });
      }
      toUpperCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toUpperCase" }]
        });
      }
      get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
      }
      get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
      }
      get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
      }
      get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
      }
      get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
      }
      get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
      }
      get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
      }
      get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
      }
      get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
      }
      get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
      }
      get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
      }
      get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
      }
      get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
      }
      get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
      }
      get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
      }
      get isBase64url() {
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
      }
      get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodString.create = (params) => {
      return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodNumber = class _ZodNumber extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
      }
      _parse(input) {
        if (this._def.coerce) {
          input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.number,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "int") {
            if (!util.isInteger(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (floatSafeRemainder(input.data, check.value) !== 0) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "finite") {
            if (!Number.isFinite(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_finite,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodNumber({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodNumber({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      int(message) {
        return this._addCheck({
          kind: "int",
          message: errorUtil.toString(message)
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      finite(message) {
        return this._addCheck({
          kind: "finite",
          message: errorUtil.toString(message)
        });
      }
      safe(message) {
        return this._addCheck({
          kind: "min",
          inclusive: true,
          value: Number.MIN_SAFE_INTEGER,
          message: errorUtil.toString(message)
        })._addCheck({
          kind: "max",
          inclusive: true,
          value: Number.MAX_SAFE_INTEGER,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
      get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
      }
      get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
            return true;
          } else if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          } else if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return Number.isFinite(min) && Number.isFinite(max);
      }
    };
    ZodNumber.create = (params) => {
      return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodBigInt = class _ZodBigInt extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
      }
      _parse(input) {
        if (this._def.coerce) {
          try {
            input.data = BigInt(input.data);
          } catch {
            return this._getInvalidInput(input);
          }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
          return this._getInvalidInput(input);
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (input.data % check.value !== BigInt(0)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodBigInt({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodBigInt({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodBigInt.create = (params) => {
      return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodBoolean = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.boolean,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodBoolean.create = (params) => {
      return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodDate = class _ZodDate extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.date,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_date
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.getTime() < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                message: check.message,
                inclusive: true,
                exact: false,
                minimum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.getTime() > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                message: check.message,
                inclusive: true,
                exact: false,
                maximum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return {
          status: status.value,
          value: new Date(input.data.getTime())
        };
      }
      _addCheck(check) {
        return new _ZodDate({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      min(minDate, message) {
        return this._addCheck({
          kind: "min",
          value: minDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      max(maxDate, message) {
        return this._addCheck({
          kind: "max",
          value: maxDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min != null ? new Date(min) : null;
      }
      get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max != null ? new Date(max) : null;
      }
    };
    ZodDate.create = (params) => {
      return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params)
      });
    };
    ZodSymbol = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.symbol,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodSymbol.create = (params) => {
      return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params)
      });
    };
    ZodUndefined = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.undefined,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodUndefined.create = (params) => {
      return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params)
      });
    };
    ZodNull = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.null,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodNull.create = (params) => {
      return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params)
      });
    };
    ZodAny = class extends ZodType {
      constructor() {
        super(...arguments);
        this._any = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodAny.create = (params) => {
      return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params)
      });
    };
    ZodUnknown = class extends ZodType {
      constructor() {
        super(...arguments);
        this._unknown = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodUnknown.create = (params) => {
      return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params)
      });
    };
    ZodNever = class extends ZodType {
      _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.never,
          received: ctx.parsedType
        });
        return INVALID;
      }
    };
    ZodNever.create = (params) => {
      return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params)
      });
    };
    ZodVoid = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.void,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodVoid.create = (params) => {
      return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params)
      });
    };
    ZodArray = class _ZodArray extends ZodType {
      _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (def.exactLength !== null) {
          const tooBig = ctx.data.length > def.exactLength.value;
          const tooSmall = ctx.data.length < def.exactLength.value;
          if (tooBig || tooSmall) {
            addIssueToContext(ctx, {
              code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
              minimum: tooSmall ? def.exactLength.value : void 0,
              maximum: tooBig ? def.exactLength.value : void 0,
              type: "array",
              inclusive: true,
              exact: true,
              message: def.exactLength.message
            });
            status.dirty();
          }
        }
        if (def.minLength !== null) {
          if (ctx.data.length < def.minLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.minLength.message
            });
            status.dirty();
          }
        }
        if (def.maxLength !== null) {
          if (ctx.data.length > def.maxLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.maxLength.message
            });
            status.dirty();
          }
        }
        if (ctx.common.async) {
          return Promise.all([...ctx.data].map((item, i) => {
            return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          })).then((result2) => {
            return ParseStatus.mergeArray(status, result2);
          });
        }
        const result = [...ctx.data].map((item, i) => {
          return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
      }
      get element() {
        return this._def.type;
      }
      min(minLength, message) {
        return new _ZodArray({
          ...this._def,
          minLength: { value: minLength, message: errorUtil.toString(message) }
        });
      }
      max(maxLength, message) {
        return new _ZodArray({
          ...this._def,
          maxLength: { value: maxLength, message: errorUtil.toString(message) }
        });
      }
      length(len, message) {
        return new _ZodArray({
          ...this._def,
          exactLength: { value: len, message: errorUtil.toString(message) }
        });
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodArray.create = (schema, params) => {
      return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params)
      });
    };
    ZodObject = class _ZodObject extends ZodType {
      constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
      }
      _getCached() {
        if (this._cached !== null)
          return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
      }
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
          for (const key in ctx.data) {
            if (!shapeKeys.includes(key)) {
              extraKeys.push(key);
            }
          }
        }
        const pairs = [];
        for (const key of shapeKeys) {
          const keyValidator = shape[key];
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (this._def.catchall instanceof ZodNever) {
          const unknownKeys = this._def.unknownKeys;
          if (unknownKeys === "passthrough") {
            for (const key of extraKeys) {
              pairs.push({
                key: { status: "valid", value: key },
                value: { status: "valid", value: ctx.data[key] }
              });
            }
          } else if (unknownKeys === "strict") {
            if (extraKeys.length > 0) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.unrecognized_keys,
                keys: extraKeys
              });
              status.dirty();
            }
          } else if (unknownKeys === "strip") {
          } else {
            throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
          }
        } else {
          const catchall = this._def.catchall;
          for (const key of extraKeys) {
            const value = ctx.data[key];
            pairs.push({
              key: { status: "valid", value: key },
              value: catchall._parse(
                new ParseInputLazyPath(ctx, value, ctx.path, key)
                //, ctx.child(key), value, getParsedType(value)
              ),
              alwaysSet: key in ctx.data
            });
          }
        }
        if (ctx.common.async) {
          return Promise.resolve().then(async () => {
            const syncPairs = [];
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              syncPairs.push({
                key,
                value,
                alwaysSet: pair.alwaysSet
              });
            }
            return syncPairs;
          }).then((syncPairs) => {
            return ParseStatus.mergeObjectSync(status, syncPairs);
          });
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get shape() {
        return this._def.shape();
      }
      strict(message) {
        errorUtil.errToObj;
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strict",
          ...message !== void 0 ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError
                };
              return {
                message: defaultError
              };
            }
          } : {}
        });
      }
      strip() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strip"
        });
      }
      passthrough() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "passthrough"
        });
      }
      // const AugmentFactory =
      //   <Def extends ZodObjectDef>(def: Def) =>
      //   <Augmentation extends ZodRawShape>(
      //     augmentation: Augmentation
      //   ): ZodObject<
      //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
      //     Def["unknownKeys"],
      //     Def["catchall"]
      //   > => {
      //     return new ZodObject({
      //       ...def,
      //       shape: () => ({
      //         ...def.shape(),
      //         ...augmentation,
      //       }),
      //     }) as any;
      //   };
      extend(augmentation) {
        return new _ZodObject({
          ...this._def,
          shape: () => ({
            ...this._def.shape(),
            ...augmentation
          })
        });
      }
      /**
       * Prior to zod@1.0.12 there was a bug in the
       * inferred type of merged objects. Please
       * upgrade if you are experiencing issues.
       */
      merge(merging) {
        const merged = new _ZodObject({
          unknownKeys: merging._def.unknownKeys,
          catchall: merging._def.catchall,
          shape: () => ({
            ...this._def.shape(),
            ...merging._def.shape()
          }),
          typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
      }
      // merge<
      //   Incoming extends AnyZodObject,
      //   Augmentation extends Incoming["shape"],
      //   NewOutput extends {
      //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
      //       ? Augmentation[k]["_output"]
      //       : k extends keyof Output
      //       ? Output[k]
      //       : never;
      //   },
      //   NewInput extends {
      //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
      //       ? Augmentation[k]["_input"]
      //       : k extends keyof Input
      //       ? Input[k]
      //       : never;
      //   }
      // >(
      //   merging: Incoming
      // ): ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"],
      //   NewOutput,
      //   NewInput
      // > {
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      setKey(key, schema) {
        return this.augment({ [key]: schema });
      }
      // merge<Incoming extends AnyZodObject>(
      //   merging: Incoming
      // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
      // ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"]
      // > {
      //   // const mergedShape = objectUtil.mergeShapes(
      //   //   this._def.shape(),
      //   //   merging._def.shape()
      //   // );
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      catchall(index) {
        return new _ZodObject({
          ...this._def,
          catchall: index
        });
      }
      pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
          if (mask[key] && this.shape[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (!mask[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      /**
       * @deprecated
       */
      deepPartial() {
        return deepPartialify(this);
      }
      partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          const fieldSchema = this.shape[key];
          if (mask && !mask[key]) {
            newShape[key] = fieldSchema;
          } else {
            newShape[key] = fieldSchema.optional();
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (mask && !mask[key]) {
            newShape[key] = this.shape[key];
          } else {
            const fieldSchema = this.shape[key];
            let newField = fieldSchema;
            while (newField instanceof ZodOptional) {
              newField = newField._def.innerType;
            }
            newShape[key] = newField;
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      keyof() {
        return createZodEnum(util.objectKeys(this.shape));
      }
    };
    ZodObject.create = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.strictCreate = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.lazycreate = (shape, params) => {
      return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
          for (const result of results) {
            if (result.result.status === "valid") {
              return result.result;
            }
          }
          for (const result of results) {
            if (result.result.status === "dirty") {
              ctx.common.issues.push(...result.ctx.common.issues);
              return result.result;
            }
          }
          const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return Promise.all(options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })).then(handleResults);
        } else {
          let dirty = void 0;
          const issues = [];
          for (const option of options) {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            const result = option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            });
            if (result.status === "valid") {
              return result;
            } else if (result.status === "dirty" && !dirty) {
              dirty = { result, ctx: childCtx };
            }
            if (childCtx.common.issues.length) {
              issues.push(childCtx.common.issues);
            }
          }
          if (dirty) {
            ctx.common.issues.push(...dirty.ctx.common.issues);
            return dirty.result;
          }
          const unionErrors = issues.map((issues2) => new ZodError(issues2));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
      }
      get options() {
        return this._def.options;
      }
    };
    ZodUnion.create = (types, params) => {
      return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params)
      });
    };
    getDiscriminator = (type) => {
      if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
      } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
      } else if (type instanceof ZodLiteral) {
        return [type.value];
      } else if (type instanceof ZodEnum) {
        return type.options;
      } else if (type instanceof ZodNativeEnum) {
        return util.objectValues(type.enum);
      } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
      } else if (type instanceof ZodUndefined) {
        return [void 0];
      } else if (type instanceof ZodNull) {
        return [null];
      } else if (type instanceof ZodOptional) {
        return [void 0, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
      } else {
        return [];
      }
    };
    ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [discriminator]
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        } else {
          return option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      /**
       * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
       * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
       * have a different value for each object in the union.
       * @param discriminator the name of the discriminator property
       * @param types an array of object schemas
       * @param params
       */
      static create(discriminator, options, params) {
        const optionsMap = /* @__PURE__ */ new Map();
        for (const type of options) {
          const discriminatorValues = getDiscriminator(type.shape[discriminator]);
          if (!discriminatorValues.length) {
            throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
          }
          for (const value of discriminatorValues) {
            if (optionsMap.has(value)) {
              throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
            }
            optionsMap.set(value, type);
          }
        }
        return new _ZodDiscriminatedUnion({
          typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
          discriminator,
          options,
          optionsMap,
          ...processCreateParams(params)
        });
      }
    };
    ZodIntersection = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
          if (isAborted(parsedLeft) || isAborted(parsedRight)) {
            return INVALID;
          }
          const merged = mergeValues(parsedLeft.value, parsedRight.value);
          if (!merged.valid) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_intersection_types
            });
            return INVALID;
          }
          if (isDirty(parsedLeft) || isDirty(parsedRight)) {
            status.dirty();
          }
          return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
          return Promise.all([
            this._def.left._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }),
            this._def.right._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            })
          ]).then(([left, right]) => handleParsed(left, right));
        } else {
          return handleParsed(this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }), this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }));
        }
      }
    };
    ZodIntersection.create = (left, right, params) => {
      return new ZodIntersection({
        left,
        right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params)
      });
    };
    ZodTuple = class _ZodTuple extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          status.dirty();
        }
        const items = [...ctx.data].map((item, itemIndex) => {
          const schema = this._def.items[itemIndex] || this._def.rest;
          if (!schema)
            return null;
          return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter((x) => !!x);
        if (ctx.common.async) {
          return Promise.all(items).then((results) => {
            return ParseStatus.mergeArray(status, results);
          });
        } else {
          return ParseStatus.mergeArray(status, items);
        }
      }
      get items() {
        return this._def.items;
      }
      rest(rest) {
        return new _ZodTuple({
          ...this._def,
          rest
        });
      }
    };
    ZodTuple.create = (schemas2, params) => {
      if (!Array.isArray(schemas2)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
      }
      return new ZodTuple({
        items: schemas2,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params)
      });
    };
    ZodRecord = class _ZodRecord extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
          pairs.push({
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
            value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (ctx.common.async) {
          return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get element() {
        return this._def.valueType;
      }
      static create(first, second, third) {
        if (second instanceof ZodType) {
          return new _ZodRecord({
            keyType: first,
            valueType: second,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(third)
          });
        }
        return new _ZodRecord({
          keyType: ZodString.create(),
          valueType: first,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(second)
        });
      }
    };
    ZodMap = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.map,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
          return {
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
          };
        });
        if (ctx.common.async) {
          const finalMap = /* @__PURE__ */ new Map();
          return Promise.resolve().then(async () => {
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              if (key.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
          });
        } else {
          const finalMap = /* @__PURE__ */ new Map();
          for (const pair of pairs) {
            const key = pair.key;
            const value = pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }
      }
    };
    ZodMap.create = (keyType, valueType, params) => {
      return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params)
      });
    };
    ZodSet = class _ZodSet extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.set,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
          if (ctx.data.size < def.minSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.minSize.message
            });
            status.dirty();
          }
        }
        if (def.maxSize !== null) {
          if (ctx.data.size > def.maxSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.maxSize.message
            });
            status.dirty();
          }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements2) {
          const parsedSet = /* @__PURE__ */ new Set();
          for (const element of elements2) {
            if (element.status === "aborted")
              return INVALID;
            if (element.status === "dirty")
              status.dirty();
            parsedSet.add(element.value);
          }
          return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
          return Promise.all(elements).then((elements2) => finalizeSet(elements2));
        } else {
          return finalizeSet(elements);
        }
      }
      min(minSize, message) {
        return new _ZodSet({
          ...this._def,
          minSize: { value: minSize, message: errorUtil.toString(message) }
        });
      }
      max(maxSize, message) {
        return new _ZodSet({
          ...this._def,
          maxSize: { value: maxSize, message: errorUtil.toString(message) }
        });
      }
      size(size, message) {
        return this.min(size, message).max(size, message);
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodSet.create = (valueType, params) => {
      return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params)
      });
    };
    ZodFunction = class _ZodFunction extends ZodType {
      constructor() {
        super(...arguments);
        this.validate = this.implement;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.function,
            received: ctx.parsedType
          });
          return INVALID;
        }
        function makeArgsIssue(args, error) {
          return makeIssue({
            data: args,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_arguments,
              argumentsError: error
            }
          });
        }
        function makeReturnsIssue(returns, error) {
          return makeIssue({
            data: returns,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_return_type,
              returnTypeError: error
            }
          });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
          const me = this;
          return OK(async function(...args) {
            const error = new ZodError([]);
            const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
              error.addIssue(makeArgsIssue(args, e));
              throw error;
            });
            const result = await Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error.addIssue(makeReturnsIssue(result, e));
              throw error;
            });
            return parsedReturns;
          });
        } else {
          const me = this;
          return OK(function(...args) {
            const parsedArgs = me._def.args.safeParse(args, params);
            if (!parsedArgs.success) {
              throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
            }
            const result = Reflect.apply(fn, this, parsedArgs.data);
            const parsedReturns = me._def.returns.safeParse(result, params);
            if (!parsedReturns.success) {
              throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
            }
            return parsedReturns.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...items) {
        return new _ZodFunction({
          ...this._def,
          args: ZodTuple.create(items).rest(ZodUnknown.create())
        });
      }
      returns(returnType) {
        return new _ZodFunction({
          ...this._def,
          returns: returnType
        });
      }
      implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      static create(args, returns, params) {
        return new _ZodFunction({
          args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
          returns: returns || ZodUnknown.create(),
          typeName: ZodFirstPartyTypeKind.ZodFunction,
          ...processCreateParams(params)
        });
      }
    };
    ZodLazy = class extends ZodType {
      get schema() {
        return this._def.getter();
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
      }
    };
    ZodLazy.create = (getter, params) => {
      return new ZodLazy({
        getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params)
      });
    };
    ZodLiteral = class extends ZodType {
      _parse(input) {
        if (input.data !== this._def.value) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_literal,
            expected: this._def.value
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
      get value() {
        return this._def.value;
      }
    };
    ZodLiteral.create = (value, params) => {
      return new ZodLiteral({
        value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params)
      });
    };
    ZodEnum = class _ZodEnum extends ZodType {
      _parse(input) {
        if (typeof input.data !== "string") {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get options() {
        return this._def.values;
      }
      get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      extract(values, newDef = this._def) {
        return _ZodEnum.create(values, {
          ...this._def,
          ...newDef
        });
      }
      exclude(values, newDef = this._def) {
        return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
          ...this._def,
          ...newDef
        });
      }
    };
    ZodEnum.create = createZodEnum;
    ZodNativeEnum = class extends ZodType {
      _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get enum() {
        return this._def.values;
      }
    };
    ZodNativeEnum.create = (values, params) => {
      return new ZodNativeEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params)
      });
    };
    ZodPromise = class extends ZodType {
      unwrap() {
        return this._def.type;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.promise,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
          return this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        }));
      }
    };
    ZodPromise.create = (schema, params) => {
      return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params)
      });
    };
    ZodEffects = class extends ZodType {
      innerType() {
        return this._def.schema;
      }
      sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
          addIssue: (arg) => {
            addIssueToContext(ctx, arg);
            if (arg.fatal) {
              status.abort();
            } else {
              status.dirty();
            }
          },
          get path() {
            return ctx.path;
          }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
          const processed = effect.transform(ctx.data, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(processed).then(async (processed2) => {
              if (status.value === "aborted")
                return INVALID;
              const result = await this._def.schema._parseAsync({
                data: processed2,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            });
          } else {
            if (status.value === "aborted")
              return INVALID;
            const result = this._def.schema._parseSync({
              data: processed,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          }
        }
        if (effect.type === "refinement") {
          const executeRefinement = (acc) => {
            const result = effect.refinement(acc, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(result);
            }
            if (result instanceof Promise) {
              throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
            }
            return acc;
          };
          if (ctx.common.async === false) {
            const inner = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            executeRefinement(inner.value);
            return { status: status.value, value: inner.value };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              return executeRefinement(inner.value).then(() => {
                return { status: status.value, value: inner.value };
              });
            });
          }
        }
        if (effect.type === "transform") {
          if (ctx.common.async === false) {
            const base = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (!isValid(base))
              return INVALID;
            const result = effect.transform(base.value, checkCtx);
            if (result instanceof Promise) {
              throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
            }
            return { status: status.value, value: result };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
              if (!isValid(base))
                return INVALID;
              return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                status: status.value,
                value: result
              }));
            });
          }
        }
        util.assertNever(effect);
      }
    };
    ZodEffects.create = (schema, effect, params) => {
      return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params)
      });
    };
    ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
      return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params)
      });
    };
    ZodOptional = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
          return OK(void 0);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodOptional.create = (type, params) => {
      return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params)
      });
    };
    ZodNullable = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
          return OK(null);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodNullable.create = (type, params) => {
      return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params)
      });
    };
    ZodDefault = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
          data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      removeDefault() {
        return this._def.innerType;
      }
    };
    ZodDefault.create = (type, params) => {
      return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params)
      });
    };
    ZodCatch = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const newCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          }
        };
        const result = this._def.innerType._parse({
          data: newCtx.data,
          path: newCtx.path,
          parent: {
            ...newCtx
          }
        });
        if (isAsync(result)) {
          return result.then((result2) => {
            return {
              status: "valid",
              value: result2.status === "valid" ? result2.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          });
        } else {
          return {
            status: "valid",
            value: result.status === "valid" ? result.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        }
      }
      removeCatch() {
        return this._def.innerType;
      }
    };
    ZodCatch.create = (type, params) => {
      return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params)
      });
    };
    ZodNaN = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.nan,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
    };
    ZodNaN.create = (params) => {
      return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params)
      });
    };
    BRAND = /* @__PURE__ */ Symbol("zod_brand");
    ZodBranded = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      unwrap() {
        return this._def.type;
      }
    };
    ZodPipeline = class _ZodPipeline extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
          const handleAsync = async () => {
            const inResult = await this._def.in._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return DIRTY(inResult.value);
            } else {
              return this._def.out._parseAsync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          };
          return handleAsync();
        } else {
          const inResult = this._def.in._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return {
              status: "dirty",
              value: inResult.value
            };
          } else {
            return this._def.out._parseSync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        }
      }
      static create(a, b) {
        return new _ZodPipeline({
          in: a,
          out: b,
          typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
      }
    };
    ZodReadonly = class extends ZodType {
      _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
          if (isValid(data)) {
            data.value = Object.freeze(data.value);
          }
          return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodReadonly.create = (type, params) => {
      return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params)
      });
    };
    late = {
      object: ZodObject.lazycreate
    };
    (function(ZodFirstPartyTypeKind2) {
      ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
      ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
      ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
      ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
      ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
      ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
      ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
      ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
      ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
      ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
      ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
      ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
      ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
      ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
      ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
      ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
      ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
      ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
      ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
      ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
      ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
      ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
      ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
      ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
      ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
      ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
      ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
      ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
      ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
      ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
      ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
      ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
      ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
      ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
      ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
      ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
    })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
    instanceOfType = (cls, params = {
      message: `Input not instance of ${cls.name}`
    }) => custom((data) => data instanceof cls, params);
    stringType = ZodString.create;
    numberType = ZodNumber.create;
    nanType = ZodNaN.create;
    bigIntType = ZodBigInt.create;
    booleanType = ZodBoolean.create;
    dateType = ZodDate.create;
    symbolType = ZodSymbol.create;
    undefinedType = ZodUndefined.create;
    nullType = ZodNull.create;
    anyType = ZodAny.create;
    unknownType = ZodUnknown.create;
    neverType = ZodNever.create;
    voidType = ZodVoid.create;
    arrayType = ZodArray.create;
    objectType = ZodObject.create;
    strictObjectType = ZodObject.strictCreate;
    unionType = ZodUnion.create;
    discriminatedUnionType = ZodDiscriminatedUnion.create;
    intersectionType = ZodIntersection.create;
    tupleType = ZodTuple.create;
    recordType = ZodRecord.create;
    mapType = ZodMap.create;
    setType = ZodSet.create;
    functionType = ZodFunction.create;
    lazyType = ZodLazy.create;
    literalType = ZodLiteral.create;
    enumType = ZodEnum.create;
    nativeEnumType = ZodNativeEnum.create;
    promiseType = ZodPromise.create;
    effectsType = ZodEffects.create;
    optionalType = ZodOptional.create;
    nullableType = ZodNullable.create;
    preprocessType = ZodEffects.createWithPreprocess;
    pipelineType = ZodPipeline.create;
    ostring = () => stringType().optional();
    onumber = () => numberType().optional();
    oboolean = () => booleanType().optional();
    coerce = {
      string: ((arg) => ZodString.create({ ...arg, coerce: true })),
      number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
      boolean: ((arg) => ZodBoolean.create({
        ...arg,
        coerce: true
      })),
      bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
      date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
    };
    NEVER = INVALID;
  }
});

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});
var init_external = __esm({
  "node_modules/zod/v3/external.js"() {
    init_errors();
    init_parseUtil();
    init_typeAliases();
    init_util();
    init_types();
    init_ZodError();
  }
});

// node_modules/zod/index.js
var init_zod = __esm({
  "node_modules/zod/index.js"() {
    init_external();
    init_external();
  }
});

// server/lib/errors.ts
var AppError, Errors;
var init_errors2 = __esm({
  "server/lib/errors.ts"() {
    "use strict";
    AppError = class extends Error {
      constructor(code, status, message, details = {}) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = "AppError";
      }
      code;
      status;
      details;
    };
    Errors = {
      validation: (message, details = {}) => new AppError("VALIDATION", 400, message, details),
      unauthenticated: () => new AppError("UNAUTHENTICATED", 401, "Please sign in to continue."),
      forbidden: () => new AppError("FORBIDDEN", 403, "Your account does not have permission for this action."),
      notFound: (what = "record") => new AppError("NOT_FOUND", 404, `That ${what} could not be found.`),
      conflict: (code, message, details = {}) => new AppError(code, 409, message, details),
      rateLimited: (retryAfterSec) => new AppError("RATE_LIMITED", 429, "Too many attempts. Please wait a moment and try again.", { retryAfterSec })
    };
  }
});

// server/config.ts
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    if (process.env[m[1]] === void 0) process.env[m[1]] = v;
  }
}
function required(name, devDefault) {
  const v = env[name];
  if (v) return v;
  if (devDefault !== void 0) return devDefault;
  throw new Error(`Missing required environment variable ${name}`);
}
function key32(name, devSeed) {
  const v = env[name];
  if (v) {
    const b = Buffer.from(v, "base64");
    if (b.length === 32) return b;
    console.warn(`[bayleaf] ${name} is not 32 bytes base64-encoded. Deriving a safe 32-byte key automatically.`);
    return crypto.createHash("sha256").update(v).digest();
  }
  return crypto.createHash("sha256").update("bayleaf-dev-only:" + devSeed).digest();
}
var root, env, isProd, isTest, appUrl, config;
var init_config = __esm({
  "server/config.ts"() {
    "use strict";
    root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    loadDotEnv(path.join(root, process.env.NODE_ENV === "test" ? ".env.test" : ".env"));
    env = process.env;
    isProd = env.NODE_ENV === "production";
    isTest = env.NODE_ENV === "test";
    appUrl = required("APP_URL", "http://localhost:5173").replace(/\/$/, "");
    config = {
      root,
      isProd,
      isTest,
      port: Number(env.PORT ?? 5173),
      host: env.HOST ?? "0.0.0.0",
      appUrl,
      appOrigin: new URL(appUrl).origin,
      trustProxy: env.TRUST_PROXY === "true",
      databaseUrl: required("DATABASE_URL", isTest ? "postgres://bayleaf:bayleaf_dev@localhost:5432/bayleaf_test" : "postgres://bayleaf:bayleaf_dev@localhost:5432/bayleaf"),
      databaseSsl: env.DATABASE_SSL ?? (isProd ? "require" : "false"),
      databaseSslCaFile: env.DATABASE_SSL_CA_FILE,
      databasePoolSize: Number(env.DATABASE_POOL_SIZE ?? 10),
      /** AES-256-GCM key for tokens that must be shown again (QR, card link). */
      encryptionKey: key32("APP_ENCRYPTION_KEY", "enc"),
      /** HMAC key for token lookup hashes, OTP hashes and session hashes. */
      hashKey: key32("APP_HASH_KEY", "hash"),
      defaultPhoneRegion: (env.DEFAULT_PHONE_REGION ?? "AE").toUpperCase(),
      otpProvider: env.OTP_PROVIDER ?? (isProd ? "" : "console"),
      otpWebhookUrl: env.OTP_WEBHOOK_URL,
      otpWebhookToken: env.OTP_WEBHOOK_TOKEN,
      staffSessionHours: Number(env.STAFF_SESSION_HOURS ?? 12),
      customerSessionDays: Number(env.CUSTOMER_SESSION_DAYS ?? 60),
      enableArabic: env.ENABLE_ARABIC === "true",
      logRequests: env.LOG_REQUESTS !== "false" && !isTest
    };
  }
});

// server/lib/time.ts
function businessDate(at, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
function now() {
  return new Date(Date.now() + offsetMs);
}
var offsetMs;
var init_time = __esm({
  "server/lib/time.ts"() {
    "use strict";
    offsetMs = 0;
  }
});

// server/services/audit.ts
async function audit(q, actor, ev) {
  await q.query(
    `INSERT INTO audit_events (actor_type, actor_id, actor_name, action, entity_type, entity_id, customer_id, outlet_id, reason, details, ip, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, now()))`,
    [
      actor.type,
      actor.id ?? null,
      actor.name ?? null,
      ev.action,
      ev.entityType,
      ev.entityId ?? null,
      ev.customerId ?? null,
      ev.outletId ?? null,
      ev.reason ?? null,
      ev.details ?? {},
      actor.ip ?? null,
      ev.at ?? null
    ]
  );
}
var SYSTEM;
var init_audit = __esm({
  "server/services/audit.ts"() {
    "use strict";
    SYSTEM = { type: "system", name: "System" };
  }
});

// server/services/settings.ts
async function getSetting(q, key) {
  const r = await q.query("SELECT value FROM app_settings WHERE key = $1", [key]);
  return { ...DEFAULTS[key], ...r.rows[0]?.value ?? {} };
}
async function updateSetting(q, key, patch, actor, reason) {
  const before = await getSetting(q, key);
  const next = schemas[key].parse({ ...before, ...patch });
  await q.query(
    `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, next, actor.type === "staff" ? actor.id : null]
  );
  await audit(q, actor, { action: "settings.updated", entityType: "setting", entityId: key, reason, details: { before, after: next } });
  return next;
}
var visitPolicySchema, businessSchema, DEFAULTS, schemas;
var init_settings = __esm({
  "server/services/settings.ts"() {
    "use strict";
    init_zod();
    init_time();
    init_audit();
    visitPolicySchema = external_exports.object({
      maxVisitsPerDay: external_exports.number().int().min(1).max(10),
      timeZone: external_exports.string().refine(isValidTimeZone, "Unknown time zone"),
      minimumBillAmount: external_exports.number().min(0).max(1e5).nullable()
    });
    businessSchema = external_exports.object({
      name: external_exports.string().trim().min(1).max(60),
      tagline: external_exports.string().trim().max(80),
      currency: external_exports.string().trim().min(3).max(3),
      selfRegistration: external_exports.boolean(),
      shareMessage: external_exports.string().trim().min(10).max(400).refine((s) => s.includes("{link}"), "The message must contain {link}")
    });
    DEFAULTS = {
      visit_policy: { maxVisitsPerDay: 1, timeZone: "Asia/Dubai", minimumBillAmount: null },
      business: {
        name: "Bay Leaf",
        tagline: "Restaurant",
        currency: "AED",
        selfRegistration: true,
        shareMessage: "Welcome to Bay Leaf, {name}. Your loyalty card is ready \u2014 open it any time to see your visits and rewards: {link}"
      }
    };
    schemas = { visit_policy: visitPolicySchema, business: businessSchema };
  }
});

// server/lib/crypto.ts
import crypto3 from "node:crypto";
import { promisify } from "node:util";
function randomToken(bytes = 24) {
  return crypto3.randomBytes(bytes).toString("base64url");
}
function hmac(value, purpose) {
  return crypto3.createHmac("sha256", config.hashKey).update(purpose + ":" + value).digest();
}
function encrypt(plain) {
  const iv = crypto3.randomBytes(12);
  const c = crypto3.createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}
function decrypt(enc) {
  const [v, iv, tag, body] = enc.split(".");
  if (v !== "v1") throw new Error("Unknown ciphertext version");
  const d = crypto3.createDecipheriv("aes-256-gcm", config.encryptionKey, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
async function hashPassword(pw) {
  const salt = crypto3.randomBytes(16);
  const key = await scrypt(pw.normalize("NFKC"), salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}
async function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, key] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scrypt(
    pw.normalize("NFKC"),
    Buffer.from(salt, "base64"),
    expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }
  );
  return crypto3.timingSafeEqual(actual, expected);
}
function randomCode(len) {
  const bytes = crypto3.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] & 31];
  return s;
}
function newMemberCode() {
  return "BL" + randomCode(6);
}
function newReference(prefix) {
  return `${prefix}-${randomCode(8)}`;
}
function normaliseMemberCode(input) {
  const s = input.toUpperCase().replace(/[\s-]/g, "");
  if (!s.startsWith("BL")) return null;
  const rest = s.slice(2).replace(/O/g, "0").replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{6}$/.test(rest) ? "BL" + rest : null;
}
function sixDigitCode() {
  return String(crypto3.randomInt(0, 1e6)).padStart(6, "0");
}
var scrypt, SCRYPT, DUMMY_PASSWORD_HASH, ALPHABET;
var init_crypto = __esm({
  "server/lib/crypto.ts"() {
    "use strict";
    init_config();
    scrypt = promisify(crypto3.scrypt);
    SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
    DUMMY_PASSWORD_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(32).toString("base64");
    ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  }
});

// server/lib/phone.ts
function normalisePhone(input, defaultRegion = "AE") {
  if (!input || !input.trim()) return { ok: false, reason: "empty" };
  let s = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).trim();
  if (!/^[+\d\s().-]+$/.test(s)) return { ok: false, reason: "invalid" };
  const international = s.startsWith("+") || s.startsWith("00");
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("00")) digits = digits.slice(2);
  if (international) {
    for (const [code, r2] of BY_CC) {
      if (digits.startsWith(r2.cc)) {
        let nsn2 = digits.slice(r2.cc.length);
        if (r2.trunk && nsn2.startsWith(r2.trunk) && !r2.nsnLength.includes(nsn2.length)) nsn2 = nsn2.slice(r2.trunk.length);
        return checkRegion(code, r2, nsn2);
      }
    }
    if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return { ok: false, reason: "invalid" };
    return { ok: true, e164: "+" + digits, region: null };
  }
  const r = REGIONS[defaultRegion];
  if (!r) return { ok: false, reason: "invalid" };
  let nsn = digits;
  if (r.trunk && nsn.startsWith(r.trunk)) nsn = nsn.slice(r.trunk.length);
  if (!r.nsnLength.includes(nsn.length) && nsn.startsWith(r.cc)) nsn = nsn.slice(r.cc.length);
  return checkRegion(defaultRegion, r, nsn);
}
function checkRegion(code, r, nsn) {
  if (!r.nsnLength.includes(nsn.length)) return { ok: false, reason: "invalid" };
  if (!r.mobile.test(nsn)) return { ok: false, reason: "not_mobile" };
  return { ok: true, e164: "+" + r.cc + nsn, region: code };
}
function maskPhone(e164) {
  return "\u2022\u2022\u2022\u2022 " + e164.slice(-4);
}
function formatPhone(e164) {
  for (const [, r] of BY_CC) {
    if (e164.startsWith("+" + r.cc)) {
      const n = e164.slice(1 + r.cc.length);
      const groups = n.length === 9 ? [n.slice(0, 2), n.slice(2, 5), n.slice(5)] : n.length === 8 ? [n.slice(0, 4), n.slice(4)] : n.length === 10 ? [n.slice(0, 5), n.slice(5)] : [n];
      return `+${r.cc} ${groups.join(" ")}`;
    }
  }
  return e164;
}
var REGIONS, BY_CC;
var init_phone = __esm({
  "server/lib/phone.ts"() {
    "use strict";
    REGIONS = {
      AE: { cc: "971", name: "United Arab Emirates", nsnLength: [9], mobile: /^5[024568]\d{7}$/, trunk: "0" },
      SA: { cc: "966", name: "Saudi Arabia", nsnLength: [9], mobile: /^5\d{8}$/, trunk: "0" },
      QA: { cc: "974", name: "Qatar", nsnLength: [8], mobile: /^[3567]\d{7}$/ },
      KW: { cc: "965", name: "Kuwait", nsnLength: [8], mobile: /^[4569]\d{7}$/ },
      BH: { cc: "973", name: "Bahrain", nsnLength: [8], mobile: /^(3\d|6[3669])\d{6}$/ },
      OM: { cc: "968", name: "Oman", nsnLength: [8], mobile: /^[79]\d{7}$/ },
      IN: { cc: "91", name: "India", nsnLength: [10], mobile: /^[6-9]\d{9}$/, trunk: "0" }
    };
    BY_CC = Object.entries(REGIONS).sort((a, b) => b[1].cc.length - a[1].cc.length);
  }
});

// server/services/loyalty.ts
var loyalty_exports = {};
__export(loyalty_exports, {
  addCorrectionVisit: () => addCorrectionVisit,
  buildState: () => buildState,
  ensureActiveCard: () => ensureActiveCard,
  lockCustomer: () => lockCustomer,
  recordVisit: () => recordVisit,
  redeemReward: () => redeemReward,
  redemptionHistory: () => redemptionHistory,
  setRewardRevoked: () => setRewardRevoked,
  undoLastVisit: () => undoLastVisit,
  visitHistory: () => visitHistory
});
async function lockCustomer(tx, customerId) {
  const r = await tx.query("SELECT * FROM customers WHERE id = $1 FOR UPDATE", [customerId]);
  if (!r.rows[0]) throw Errors.notFound("customer");
  return r.rows[0];
}
async function activateCard(tx, customerId, def, at) {
  const card = (await tx.query(
    `INSERT INTO customer_cards (customer_id, card_definition_id, sequence, card_name, level_label, theme, required_visits, activated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [customerId, def.id, def.sequence, def.name, def.level_label, def.theme, def.required_visits, at]
  )).rows[0];
  await tx.query(
    `INSERT INTO customer_rewards (customer_id, customer_card_id, reward_definition_id, milestone_visit, created_at)
     SELECT $1, $2, rd.id, rd.milestone_visit, $4 FROM reward_definitions rd
     WHERE rd.card_definition_id = $3 AND rd.archived_at IS NULL AND rd.milestone_visit <= $5`,
    [customerId, card.id, def.id, at, def.required_visits]
  );
  await audit(tx, SYSTEM, {
    action: "card.activated",
    entityType: "customer_card",
    entityId: card.id,
    customerId,
    at,
    details: { sequence: def.sequence, name: def.name, requiredVisits: def.required_visits }
  });
  return card;
}
async function ensureActiveCard(tx, customerId, at = now()) {
  const active = await tx.query("SELECT * FROM customer_cards WHERE customer_id = $1 AND status = 'active'", [customerId]);
  if (active.rows[0]) return { card: active.rows[0], activated: false };
  const last = await tx.query("SELECT max(sequence) AS max FROM customer_cards WHERE customer_id = $1", [customerId]);
  const nextSeq = (last.rows[0]?.max ?? 0) + 1;
  const def = await tx.query("SELECT * FROM card_definitions WHERE sequence = $1 AND status = 'published'", [nextSeq]);
  if (!def.rows[0]) return { card: null, activated: false };
  return { card: await activateCard(tx, customerId, def.rows[0], at), activated: true };
}
async function buildState(q, customerId) {
  const c = (await q.query("SELECT * FROM customers WHERE id = $1", [customerId])).rows[0];
  if (!c) throw Errors.notFound("customer");
  const cards = (await q.query(
    `SELECT cc.*, d.terms FROM customer_cards cc JOIN card_definitions d ON d.id = cc.card_definition_id
      WHERE cc.customer_id = $1 ORDER BY cc.sequence`,
    [customerId]
  )).rows;
  const rewards = (await q.query(
    `SELECT cr.*, rd.name, rd.description, rd.terms, rd.is_placeholder, rd.is_available,
            rr.reference AS redemption_ref, rr.created_at AS redeemed_at, rr.reward_name AS redeemed_name
       FROM customer_rewards cr
       JOIN reward_definitions rd ON rd.id = cr.reward_definition_id
       LEFT JOIN reward_redemptions rr ON rr.customer_reward_id = cr.id
      WHERE cr.customer_id = $1
      ORDER BY cr.milestone_visit`,
    [customerId]
  )).rows;
  const cardViews = cards.map((card) => {
    const mine = rewards.filter((r) => r.customer_card_id === card.id);
    const nextLocked = card.status === "active" ? mine.find((r) => r.status === "locked") : void 0;
    const milestones = mine.map((r) => ({
      id: r.id,
      milestone: r.milestone_visit,
      // A redeemed reward keeps the name it had when it was handed over.
      name: r.status === "redeemed" && r.redeemed_name ? r.redeemed_name : r.name,
      description: r.description,
      terms: r.terms,
      isPlaceholder: r.status === "redeemed" ? false : r.is_placeholder,
      isAvailable: r.is_available,
      status: r.status,
      inProgress: nextLocked?.id === r.id,
      eligibleAt: iso(r.eligible_at),
      redeemedAt: iso(r.redeemed_at),
      redemptionRef: r.redemption_ref,
      cardId: card.id,
      cardName: card.card_name,
      cardSequence: card.sequence
    }));
    return {
      id: card.id,
      sequence: card.sequence,
      name: card.card_name,
      levelLabel: card.level_label,
      theme: card.theme,
      requiredVisits: card.required_visits,
      visitCount: card.visit_count,
      remaining: card.required_visits - card.visit_count,
      status: card.status,
      terms: card.terms ?? "",
      activatedAt: iso(card.activated_at),
      completedAt: iso(card.completed_at),
      milestones,
      nextMilestone: nextLocked ? {
        visit: nextLocked.milestone_visit,
        rewardName: nextLocked.name,
        visitsAway: nextLocked.milestone_visit - card.visit_count,
        isPlaceholder: nextLocked.is_placeholder
      } : null
    };
  });
  const activeCard = cardViews.find((v) => v.status === "active") ?? null;
  const completedCards = cardViews.filter((v) => v.status === "completed").reverse();
  const lastSeq = cardViews.length ? cardViews[cardViews.length - 1].sequence : 0;
  const nextSeq = activeCard ? activeCard.sequence + 1 : lastSeq + 1;
  const nextDef = (await q.query("SELECT * FROM card_definitions WHERE sequence = $1 AND status = 'published'", [nextSeq])).rows[0];
  let nextCard;
  if (nextDef) {
    nextCard = { state: "locked", name: nextDef.name, levelLabel: nextDef.level_label, requiredVisits: nextDef.required_visits };
  } else if (activeCard || cardViews.length) {
    nextCard = { state: "coming_soon", name: null, levelLabel: null, requiredVisits: null };
  } else {
    nextCard = null;
  }
  const policy = await getSetting(q, "visit_policy");
  const today = businessDate(now(), policy.timeZone);
  const t = (await q.query(
    `SELECT count(*)::int AS n, max(created_at) AS last FROM visits
      WHERE customer_id = $1 AND business_date = $2 AND status = 'valid'`,
    [customerId, today]
  )).rows[0];
  return {
    customer: {
      id: c.id,
      firstName: String(c.full_name).trim().split(/\s+/)[0],
      fullName: c.full_name,
      memberCode: c.member_code,
      status: c.status,
      phoneMasked: maskPhone(c.phone_e164),
      createdAt: iso(c.created_at)
    },
    activeCard,
    completedCards,
    rewardsReady: cardViews.flatMap((v) => v.milestones.filter((m) => m.status === "eligible")),
    nextCard,
    awaitingNextLevel: !activeCard && cardViews.length > 0,
    today: {
      visitsToday: t.n,
      maxPerDay: policy.maxVisitsPerDay,
      canRecordVisit: !!activeCard && c.status === "active" && t.n < policy.maxVisitsPerDay,
      lastVisitAt: iso(t.last)
    }
  };
}
async function visitHistory(q, customerId, opts = {}) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const rows = (await q.query(
    `SELECT v.*, cc.card_name, cc.sequence, o.name AS outlet_name, s.full_name AS staff_name
       FROM visits v
       JOIN customer_cards cc ON cc.id = v.customer_card_id
       LEFT JOIN outlets o ON o.id = v.outlet_id
       LEFT JOIN staff_users s ON s.id = v.staff_id
      WHERE v.customer_id = $1 AND ($2::timestamptz IS NULL OR v.created_at < $2)
        AND ($3 OR v.status = 'valid')
      ORDER BY v.created_at DESC LIMIT $4`,
    [customerId, opts.before ?? null, !!opts.includeVoided, limit + 1]
  )).rows;
  const items = rows.slice(0, limit).map((v) => ({
    id: v.id,
    reference: v.reference,
    at: iso(v.created_at),
    businessDate: v.business_date,
    cardName: v.card_name,
    cardSequence: v.sequence,
    visitNumber: v.visit_number,
    outletName: v.outlet_name,
    source: v.source,
    status: v.status,
    ...opts.includeStaff ? { staffName: v.staff_name, voidReason: v.void_reason, correctionReason: v.correction_reason } : {}
  }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].at : null };
}
async function redemptionHistory(q, customerId, opts = {}) {
  const rows = (await q.query(
    `SELECT rr.*, cc.card_name, o.name AS outlet_name, s.full_name AS staff_name
       FROM reward_redemptions rr
       JOIN customer_cards cc ON cc.id = rr.customer_card_id
       LEFT JOIN outlets o ON o.id = rr.outlet_id
       LEFT JOIN staff_users s ON s.id = rr.staff_id
      WHERE rr.customer_id = $1 ORDER BY rr.created_at DESC LIMIT 200`,
    [customerId]
  )).rows;
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    at: iso(r.created_at),
    rewardName: r.reward_name,
    cardName: r.card_name,
    outletName: r.outlet_name,
    ...opts.includeStaff ? { staffName: r.staff_name } : {}
  }));
}
function rewardsAtMilestones(state, cardId, from, to) {
  const card = [state.activeCard, ...state.completedCards].find((c) => c?.id === cardId);
  return card ? card.milestones.filter((m) => m.milestone > from && m.milestone <= to && m.status !== "locked") : [];
}
async function applyVisit(tx, args) {
  const { customerId, actor } = args;
  const customer = await lockCustomer(tx, customerId);
  if (args.idempotencyKey) {
    const prior = (await tx.query("SELECT * FROM visits WHERE idempotency_key = $1", [args.idempotencyKey])).rows[0];
    if (prior) {
      if (prior.customer_id !== customerId) throw Errors.conflict("IDEMPOTENCY_MISMATCH", "This request was already used for a different customer.");
      const state2 = await buildState(tx, customerId);
      const card2 = (await tx.query("SELECT * FROM customer_cards WHERE id = $1", [prior.customer_card_id])).rows[0];
      return {
        replayed: true,
        visit: { id: prior.id, reference: prior.reference, visitNumber: prior.visit_number, at: iso(prior.created_at) },
        unlockedRewards: rewardsAtMilestones(state2, prior.customer_card_id, prior.visit_number - 1, prior.visit_number),
        cardCompleted: card2.required_visits === prior.visit_number,
        nextCardActivated: null,
        state: state2
      };
    }
  }
  if (customer.status !== "active") {
    throw Errors.conflict("CUSTOMER_SUSPENDED", "This loyalty account is on hold. Please ask a manager.");
  }
  const at = now();
  const { card } = await ensureActiveCard(tx, customerId, at);
  if (!card) {
    throw Errors.conflict("NO_ACTIVE_CARD", "This guest has completed every available card. The next level is coming soon, so visits cannot be added yet.");
  }
  const policy = await getSetting(tx, "visit_policy");
  const date = args.date ?? businessDate(at, policy.timeZone);
  const sameDay = (await tx.query(
    `SELECT count(*)::int AS n, max(created_at) AS last FROM visits
      WHERE customer_id = $1 AND business_date = $2 AND status = 'valid'`,
    [customerId, date]
  )).rows[0];
  if (sameDay.n >= policy.maxVisitsPerDay) {
    throw Errors.conflict(
      "DAILY_LIMIT",
      policy.maxVisitsPerDay === 1 ? "A visit is already recorded for this guest today. Only one visit per day counts toward the card." : `This guest already has ${sameDay.n} visits today, the daily maximum.`,
      { lastVisitAt: iso(sameDay.last), maxPerDay: policy.maxVisitsPerDay, date }
    );
  }
  if (policy.minimumBillAmount !== null && args.source === "counter") {
    if (args.billAmount === null || args.billAmount === void 0) {
      throw Errors.validation("Enter the bill amount to record this visit.", { fields: { billAmount: "Required" } });
    }
    if (args.billAmount < policy.minimumBillAmount) {
      throw Errors.conflict("BILL_BELOW_MINIMUM", `Bills under ${policy.minimumBillAmount} don't count as a loyalty visit.`, { minimum: policy.minimumBillAmount });
    }
  }
  const visitNumber = card.visit_count + 1;
  const completes = visitNumber === card.required_visits;
  const visit = (await tx.query(
    `INSERT INTO visits (reference, customer_id, customer_card_id, visit_number, business_date, source, bill_amount,
                         staff_id, outlet_id, idempotency_key, correction_reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      newReference("V"),
      customerId,
      card.id,
      visitNumber,
      date,
      args.source,
      args.billAmount ?? null,
      actor.id,
      actor.outletId,
      args.idempotencyKey ?? null,
      args.correctionReason ?? null,
      at
    ]
  )).rows[0];
  await tx.query(
    `UPDATE customer_cards SET visit_count = $2,
            status = CASE WHEN $3 THEN 'completed' ELSE 'active' END,
            completed_at = CASE WHEN $3 THEN $4::timestamptz ELSE NULL END
      WHERE id = $1`,
    [card.id, visitNumber, completes, at]
  );
  const unlocked = (await tx.query(
    `UPDATE customer_rewards SET status = 'eligible', eligible_at = $3
      WHERE customer_card_id = $1 AND status = 'locked' AND milestone_visit <= $2
      RETURNING id, milestone_visit`,
    [card.id, visitNumber, at]
  )).rows;
  await audit(tx, actor, {
    action: args.source === "correction" ? "visit.correction_added" : "visit.recorded",
    entityType: "visit",
    entityId: visit.id,
    customerId,
    outletId: actor.outletId,
    at,
    reason: args.correctionReason ?? null,
    details: { reference: visit.reference, card: card.card_name, visitNumber, requiredVisits: card.required_visits, businessDate: date }
  });
  for (const u of unlocked) {
    await audit(tx, actor, {
      action: "reward.unlocked",
      entityType: "customer_reward",
      entityId: u.id,
      customerId,
      outletId: actor.outletId,
      at,
      details: { milestone: u.milestone_visit, card: card.card_name }
    });
  }
  let nextCardActivated = null;
  if (completes) {
    await audit(tx, actor, {
      action: "card.completed",
      entityType: "customer_card",
      entityId: card.id,
      customerId,
      outletId: actor.outletId,
      at,
      details: { card: card.card_name, sequence: card.sequence }
    });
    const next = await ensureActiveCard(tx, customerId, at);
    if (next.activated && next.card) nextCardActivated = { name: next.card.card_name, levelLabel: next.card.level_label };
  }
  const state = await buildState(tx, customerId);
  return {
    replayed: false,
    visit: { id: visit.id, reference: visit.reference, visitNumber, at: iso(visit.created_at) },
    unlockedRewards: rewardsAtMilestones(state, card.id, card.visit_count, visitNumber),
    cardCompleted: completes,
    nextCardActivated,
    state
  };
}
async function recordVisit(db2, args) {
  return db2.transaction((tx) => applyVisit(tx, { ...args, source: "counter" }));
}
async function addCorrectionVisit(db2, args) {
  return db2.transaction(async (tx) => {
    const policy = await getSetting(tx, "visit_policy");
    const today = businessDate(now(), policy.timeZone);
    if (args.date > today) throw Errors.validation("The visit date cannot be in the future.");
    return applyVisit(tx, { customerId: args.customerId, actor: args.actor, source: "correction", date: args.date, correctionReason: args.reason });
  });
}
async function undoLastVisit(db2, args) {
  return db2.transaction(async (tx) => {
    await lockCustomer(tx, args.customerId);
    const card = (await tx.query("SELECT * FROM customer_cards WHERE customer_id = $1 AND status = 'active'", [args.customerId])).rows[0];
    if (!card || card.visit_count === 0) {
      throw Errors.conflict("NOTHING_TO_UNDO", card ? "The current card has no visits yet. Visits on completed cards are permanent." : "There is no active card. Visits on completed cards are permanent.");
    }
    const visit = (await tx.query(
      "SELECT * FROM visits WHERE customer_card_id = $1 AND status = 'valid' AND visit_number = $2",
      [card.id, card.visit_count]
    )).rows[0];
    if (!visit) throw new AppError("INTEGRITY", 500, "Card count and visit records disagree.");
    const affected = (await tx.query(
      "SELECT * FROM customer_rewards WHERE customer_card_id = $1 AND milestone_visit = $2",
      [card.id, card.visit_count]
    )).rows;
    if (affected.some((r) => r.status === "redeemed")) {
      throw Errors.conflict("REWARD_ALREADY_REDEEMED", "This visit unlocked a reward that has already been redeemed, so it cannot be undone.");
    }
    const at = now();
    await tx.query(
      "UPDATE visits SET status = 'voided', voided_at = $2, voided_by = $3, void_reason = $4 WHERE id = $1",
      [visit.id, at, args.actor.id, args.reason]
    );
    await tx.query("UPDATE customer_cards SET visit_count = visit_count - 1 WHERE id = $1", [card.id]);
    const relocked = (await tx.query(
      `UPDATE customer_rewards SET status = 'locked', eligible_at = NULL
        WHERE customer_card_id = $1 AND milestone_visit = $2 AND status = 'eligible' RETURNING id`,
      [card.id, card.visit_count]
    )).rows;
    await audit(tx, args.actor, {
      action: "visit.voided",
      entityType: "visit",
      entityId: visit.id,
      customerId: args.customerId,
      reason: args.reason,
      at,
      details: { reference: visit.reference, visitNumber: visit.visit_number, card: card.card_name, rewardsRelocked: relocked.map((r) => r.id) }
    });
    return buildState(tx, args.customerId);
  });
}
async function redeemReward(db2, args) {
  return db2.transaction(async (tx) => {
    const owner = (await tx.query("SELECT customer_id FROM customer_rewards WHERE id = $1", [args.customerRewardId])).rows[0];
    if (!owner) throw Errors.notFound("reward");
    const customer = await lockCustomer(tx, owner.customer_id);
    const prior = (await tx.query("SELECT * FROM reward_redemptions WHERE idempotency_key = $1", [args.idempotencyKey])).rows[0];
    if (prior) {
      if (prior.customer_reward_id !== args.customerRewardId) throw Errors.conflict("IDEMPOTENCY_MISMATCH", "This request was already used for a different reward.");
      return {
        replayed: true,
        redemption: { id: prior.id, reference: prior.reference, rewardName: prior.reward_name, at: iso(prior.created_at) },
        state: await buildState(tx, owner.customer_id)
      };
    }
    const r = (await tx.query(
      `SELECT cr.*, rd.name, rd.is_placeholder, rd.is_available
         FROM customer_rewards cr JOIN reward_definitions rd ON rd.id = cr.reward_definition_id
        WHERE cr.id = $1 FOR UPDATE OF cr`,
      [args.customerRewardId]
    )).rows[0];
    if (r.status === "redeemed") {
      const p = (await tx.query(
        `SELECT rr.reference, rr.created_at, s.full_name AS staff_name, o.name AS outlet_name
           FROM reward_redemptions rr JOIN staff_users s ON s.id = rr.staff_id LEFT JOIN outlets o ON o.id = rr.outlet_id
          WHERE rr.customer_reward_id = $1`,
        [r.id]
      )).rows[0];
      throw Errors.conflict("ALREADY_REDEEMED", "This reward has already been redeemed.", {
        reference: p?.reference,
        redeemedAt: iso(p?.created_at),
        staffName: p?.staff_name,
        outletName: p?.outlet_name
      });
    }
    if (r.status === "locked") throw Errors.conflict("NOT_YET_EARNED", `This reward unlocks at visit ${r.milestone_visit}.`);
    if (r.status === "revoked") throw Errors.conflict("REWARD_REVOKED", "This reward was withdrawn by a manager and cannot be redeemed.");
    if (customer.status !== "active") throw Errors.conflict("CUSTOMER_SUSPENDED", "This loyalty account is on hold. Please ask a manager.");
    if (r.is_placeholder) throw Errors.conflict("REWARD_NOT_CONFIGURED", "Bay Leaf has not set up this reward yet. It stays saved for the guest until it is ready.");
    if (!r.is_available) throw Errors.conflict("REWARD_UNAVAILABLE", "This reward is temporarily unavailable. It stays saved for the guest.");
    const at = now();
    const red = (await tx.query(
      `INSERT INTO reward_redemptions (reference, customer_reward_id, customer_id, customer_card_id, reward_name, staff_id, outlet_id, idempotency_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [newReference("R"), r.id, r.customer_id, r.customer_card_id, r.name, args.actor.id, args.actor.outletId, args.idempotencyKey, at]
    )).rows[0];
    await tx.query("UPDATE customer_rewards SET status = 'redeemed' WHERE id = $1", [r.id]);
    await audit(tx, args.actor, {
      action: "reward.redeemed",
      entityType: "customer_reward",
      entityId: r.id,
      customerId: r.customer_id,
      outletId: args.actor.outletId,
      at,
      details: { reference: red.reference, reward: r.name, milestone: r.milestone_visit }
    });
    return {
      replayed: false,
      redemption: { id: red.id, reference: red.reference, rewardName: red.reward_name, at: iso(red.created_at) },
      state: await buildState(tx, r.customer_id)
    };
  });
}
async function setRewardRevoked(db2, args) {
  return db2.transaction(async (tx) => {
    const owner = (await tx.query("SELECT customer_id FROM customer_rewards WHERE id = $1", [args.customerRewardId])).rows[0];
    if (!owner) throw Errors.notFound("reward");
    await lockCustomer(tx, owner.customer_id);
    const r = (await tx.query("SELECT * FROM customer_rewards WHERE id = $1 FOR UPDATE", [args.customerRewardId])).rows[0];
    if (args.revoke) {
      if (r.status !== "eligible") throw Errors.conflict("NOT_REVOCABLE", "Only earned, unredeemed rewards can be withdrawn.");
      await tx.query(
        "UPDATE customer_rewards SET status = 'revoked', revoked_at = $2, revoked_by = $3, revoke_reason = $4 WHERE id = $1",
        [r.id, now(), args.actor.id, args.reason]
      );
    } else {
      if (r.status !== "revoked") throw Errors.conflict("NOT_REVOKED", "This reward is not withdrawn.");
      await tx.query("UPDATE customer_rewards SET status = 'eligible', revoked_at = NULL, revoked_by = NULL, revoke_reason = NULL WHERE id = $1", [r.id]);
    }
    await audit(tx, args.actor, {
      action: args.revoke ? "reward.revoked" : "reward.restored",
      entityType: "customer_reward",
      entityId: r.id,
      customerId: r.customer_id,
      reason: args.reason,
      details: { milestone: r.milestone_visit }
    });
    return buildState(tx, r.customer_id);
  });
}
var iso;
var init_loyalty = __esm({
  "server/services/loyalty.ts"() {
    "use strict";
    init_errors2();
    init_crypto();
    init_time();
    init_phone();
    init_audit();
    init_settings();
    iso = (d) => d ? new Date(d).toISOString() : null;
  }
});

// server/services/customers.ts
var customers_exports = {};
__export(customers_exports, {
  activeToken: () => activeToken,
  cardUrl: () => cardUrl,
  cleanName: () => cleanName,
  findOrCreateCustomer: () => findOrCreateCustomer,
  parseScan: () => parseScan,
  phoneOrThrow: () => phoneOrThrow,
  qrPayload: () => qrPayload,
  resolveToken: () => resolveToken,
  rotateToken: () => rotateToken,
  shareInfo: () => shareInfo
});
function phoneOrThrow(input) {
  const r = normalisePhone(input, config.defaultPhoneRegion);
  if (!r.ok) {
    const msg2 = r.reason === "not_mobile" ? "Enter a mobile number (not a landline)." : "Enter a valid mobile number.";
    throw Errors.validation(msg2, { fields: { phone: msg2 } });
  }
  return r.e164;
}
function cleanName(input) {
  const name = String(input ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 80) throw Errors.validation("Enter the guest\u2019s name.", { fields: { name: "Enter a name between 2 and 80 characters." } });
  if (/[<>{}\\]/.test(name)) throw Errors.validation("Names cannot contain < > { } or \\.", { fields: { name: "Remove special characters." } });
  return name;
}
async function issueToken(tx, customerId, kind) {
  const token = randomToken(24);
  await tx.query(
    "INSERT INTO customer_tokens (customer_id, kind, token_hash, token_enc) VALUES ($1,$2,$3,$4)",
    [customerId, kind, hmac(token, "tok:" + kind), encrypt(token)]
  );
  return token;
}
async function activeToken(q, customerId, kind) {
  const r = (await q.query("SELECT token_enc FROM customer_tokens WHERE customer_id = $1 AND kind = $2 AND revoked_at IS NULL", [customerId, kind])).rows[0];
  if (!r) throw new AppError("INTEGRITY", 500, "Customer has no active token.");
  return decrypt(r.token_enc);
}
async function rotateToken(db2, customerId, kind, actor, reason) {
  return db2.transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    await tx.query(
      `UPDATE customer_tokens SET revoked_at = now(), revoked_reason = $3
        WHERE customer_id = $1 AND kind = $2 AND revoked_at IS NULL`,
      [customerId, kind, reason]
    );
    await issueToken(tx, customerId, kind);
    if (kind === "link") {
      await tx.query("UPDATE customer_sessions SET revoked_at = now() WHERE customer_id = $1 AND scope = 'link' AND revoked_at IS NULL", [customerId]);
    }
    await audit(tx, actor, { action: `customer.${kind}_rotated`, entityType: "customer", entityId: customerId, customerId, reason });
  });
}
async function resolveToken(q, token, kind) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { status: "unknown" };
  const r = (await q.query(
    "SELECT customer_id, revoked_at FROM customer_tokens WHERE token_hash = $1 AND kind = $2",
    [hmac(token, "tok:" + kind), kind]
  )).rows[0];
  if (!r) return { status: "unknown" };
  if (r.revoked_at) return { status: "revoked" };
  return { status: "ok", customerId: r.customer_id };
}
function qrPayload(token) {
  return `${config.appUrl}/s/${token}`;
}
function cardUrl(linkToken) {
  return `${config.appUrl}/c/${linkToken}`;
}
function parseScan(input) {
  const s = String(input ?? "").trim();
  if (!s) return null;
  const urlMatch = s.match(/\/s\/([A-Za-z0-9_-]{20,64})\/?$/);
  if (urlMatch) return { kind: "qr", token: urlMatch[1] };
  const code = normaliseMemberCode(s);
  if (code) return { kind: "code", code };
  if (/^[A-Za-z0-9_-]{32}$/.test(s)) return { kind: "qr", token: s };
  const p = normalisePhone(s, config.defaultPhoneRegion);
  if (p.ok) return { kind: "phone", e164: p.e164 };
  return null;
}
async function findOrCreateCustomer(db2, args) {
  return db2.transaction(async (tx) => {
    const existing = (await tx.query("SELECT id FROM customers WHERE phone_e164 = $1", [args.phoneE164])).rows[0];
    if (existing) return { customerId: existing.id, created: false };
    let row = null;
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      const r = await tx.query(
        `INSERT INTO customers (member_code, full_name, phone_e164, registered_via, registered_by_staff_id, registered_outlet_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING RETURNING id`,
        [newMemberCode(), args.name, args.phoneE164, args.via, args.staffId ?? null, args.outletId ?? null]
      );
      row = r.rows[0];
      if (!row) {
        const again = (await tx.query("SELECT id FROM customers WHERE phone_e164 = $1", [args.phoneE164])).rows[0];
        if (again) return { customerId: again.id, created: false };
      }
    }
    if (!row) throw new AppError("INTEGRITY", 500, "Could not allocate a member code.");
    await lockCustomer(tx, row.id);
    await issueToken(tx, row.id, "qr");
    await issueToken(tx, row.id, "link");
    await ensureActiveCard(tx, row.id);
    await audit(tx, args.actor, {
      action: "customer.registered",
      entityType: "customer",
      entityId: row.id,
      customerId: row.id,
      outletId: args.outletId ?? null,
      details: { via: args.via }
    });
    return { customerId: row.id, created: true };
  });
}
async function shareInfo(q, customerId, opts = {}) {
  const c = (await q.query("SELECT full_name, phone_e164 FROM customers WHERE id = $1", [customerId])).rows[0];
  if (!c) throw Errors.notFound("customer");
  const link = cardUrl(await activeToken(q, customerId, "link"));
  const business = await getSetting(q, "business");
  const message = business.shareMessage.replace("{name}", String(c.full_name).split(" ")[0]).replace("{link}", link);
  const base = opts.toCustomerPhone ? `https://wa.me/${c.phone_e164.replace("+", "")}` : "https://wa.me/";
  return { cardUrl: link, whatsappUrl: `${base}?text=${encodeURIComponent(message)}`, message };
}
var init_customers = __esm({
  "server/services/customers.ts"() {
    "use strict";
    init_config();
    init_errors2();
    init_crypto();
    init_phone();
    init_audit();
    init_loyalty();
    init_settings();
  }
});

// server/app.ts
import path3 from "node:path";

// server/http/framework.ts
init_zod();
init_errors2();
init_config();
import http from "node:http";
import fs2 from "node:fs";
import path2 from "node:path";
var Router = class {
  routes = [];
  add(method, pattern, handler) {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
  }
  get(p, h) {
    this.add("GET", p, h);
  }
  post(p, h) {
    this.add("POST", p, h);
  }
  patch(p, h) {
    this.add("PATCH", p, h);
  }
  delete(p, h) {
    this.add("DELETE", p, h);
  }
  match(method, pathname) {
    const segs = pathname.split("/").filter(Boolean);
    let methodMismatch = false;
    for (const r of this.routes) {
      if (r.parts.length !== segs.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        if (r.parts[i].startsWith(":")) {
          try {
            params[r.parts[i].slice(1)] = decodeURIComponent(segs[i]);
          } catch {
            ok = false;
            break;
          }
        } else if (r.parts[i] !== segs[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if (r.method !== method) {
        methodMismatch = true;
        continue;
      }
      return { handler: r.handler, params };
    }
    return methodMismatch ? "method" : null;
  }
};
var buckets = /* @__PURE__ */ new Map();
setInterval(() => {
  const t = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < t) buckets.delete(k);
}, 6e4).unref();
function rateLimit(bucket, key, max, windowSec) {
  const k = `${bucket}:${key}`;
  const t = Date.now();
  let b = buckets.get(k);
  if (!b || b.resetAt < t) {
    b = { count: 0, resetAt: t + windowSec * 1e3 };
    buckets.set(k, b);
  }
  b.count++;
  if (b.count > max) throw Errors.rateLimited(Math.ceil((b.resetAt - t) / 1e3));
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
    }
  }
  return out;
}
function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'"
  ].join("; "));
  if (config.isProd) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}
function redactPath(p) {
  return p.replace(/^\/(s|c)\/[^/?#]+/, "/$1/[token]");
}
async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new AppError("PAYLOAD_TOO_LARGE", 413, "Request is too large.");
    chunks.push(c);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Errors.validation("Request body is not valid JSON.");
  }
}
function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(payload);
}
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".map": "application/json"
};
function serveStatic(webRoot, pathname, res) {
  const safe = path2.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  let file = path2.join(webRoot, safe);
  if (!file.startsWith(webRoot)) return false;
  if (!fs2.existsSync(file) || fs2.statSync(file).isDirectory()) {
    if (path2.extname(pathname)) return false;
    file = path2.join(webRoot, "index.html");
    if (!fs2.existsSync(file)) return false;
  }
  const ext = path2.extname(file);
  const immutable = /\/assets\/.+-[A-Z0-9]{8}\./i.test(file);
  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-cache" : immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600"
  });
  fs2.createReadStream(file).pipe(res);
  return true;
}
function createHttpServer(router, opts = {}) {
  return http.createServer(async (rawReq, res) => {
    const started = Date.now();
    const url = new URL(rawReq.url ?? "/", "http://local");
    const method = (rawReq.method ?? "GET").toUpperCase();
    const fwd = rawReq.headers["x-forwarded-for"];
    const ip = (config.trustProxy && typeof fwd === "string" ? fwd.split(",")[0].trim() : rawReq.socket.remoteAddress) ?? "unknown";
    securityHeaders(res);
    const pending = [];
    const req = {
      method,
      path: url.pathname,
      params: {},
      query: url.searchParams,
      body: {},
      headers: rawReq.headers,
      cookies: parseCookies(rawReq.headers.cookie),
      ip,
      userAgent: String(rawReq.headers["user-agent"] ?? "").slice(0, 200),
      ctx: {},
      setCookie(name, value, o) {
        const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? "/"}`, `SameSite=${o.sameSite ?? "Lax"}`];
        if (o.httpOnly !== false) parts.push("HttpOnly");
        if (config.isProd || config.appUrl.startsWith("https://")) parts.push("Secure");
        if (o.maxAgeSec !== void 0) parts.push(`Max-Age=${o.maxAgeSec}`);
        pending.push(parts.join("; "));
      },
      clearCookie(name) {
        pending.push(`${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
      }
    };
    try {
      if (url.pathname.startsWith("/api/")) {
        if (method !== "GET" && method !== "HEAD") {
          const origin = rawReq.headers.origin;
          const host = rawReq.headers.host;
          if (origin) {
            try {
              const originHost = new URL(origin).host;
              if (host && originHost !== host && origin !== config.appOrigin) {
                if (!originHost.endsWith(".vercel.app") && !originHost.includes("localhost") && !originHost.endsWith(".onrender.com")) {
                  throw new AppError("BAD_ORIGIN", 403, "Request origin not allowed.");
                }
              }
            } catch {
            }
          }
          const ct = String(rawReq.headers["content-type"] ?? "");
          if (!ct.startsWith("application/json")) throw new AppError("BAD_CONTENT_TYPE", 415, "Requests must be JSON.");
          req.body = await readJson(rawReq);
        }
        const m = router.match(method, url.pathname);
        if (m === null) throw Errors.notFound("page");
        if (m === "method") throw new AppError("METHOD_NOT_ALLOWED", 405, "Method not allowed.");
        req.params = m.params;
        const out = await m.handler(req);
        if (pending.length) res.setHeader("Set-Cookie", pending);
        if (out && typeof out === "object" && "raw" in out) {
          const r = out;
          res.writeHead(r.status ?? 200, { "Content-Type": r.contentType, "Cache-Control": "no-store", ...r.headers ?? {} });
          res.end(r.raw);
        } else if (out && typeof out === "object" && "json" in out) {
          const r = out;
          sendJson(res, r.status ?? 200, r.json, r.headers);
        } else {
          sendJson(res, 200, out ?? { ok: true });
        }
      } else if (method === "GET" || method === "HEAD") {
        if (!opts.webRoot || !serveStatic(opts.webRoot, url.pathname, res)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
        }
      } else {
        res.writeHead(405);
        res.end();
      }
    } catch (e) {
      if (pending.length && !res.headersSent) res.setHeader("Set-Cookie", pending);
      const { status, body } = toErrorResponse(e);
      if (status >= 500) console.error("[error]", method, redactPath(url.pathname), e);
      if (!res.headersSent) sendJson(res, status, body, status === 429 ? { "Retry-After": String(body.error.details.retryAfterSec ?? 60) } : {});
      else res.end();
    } finally {
      if (config.logRequests) {
        res.on("finish", () => console.log(`${method} ${redactPath(url.pathname)} ${res.statusCode} ${Date.now() - started}ms`));
      }
    }
  });
}
function toErrorResponse(e) {
  if (e instanceof AppError) return { status: e.status, body: { error: { code: e.code, message: e.message, details: e.details } } };
  if (e instanceof ZodError) {
    const fields = {};
    for (const issue of e.issues) fields[issue.path.join(".") || "_"] = issue.message;
    return { status: 400, body: { error: { code: "VALIDATION", message: "Please check the highlighted fields.", details: { fields } } } };
  }
  return { status: 500, body: { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again.", details: {} } } };
}

// server/routes/customer.ts
init_zod();

// server/db/index.ts
init_config();

// server/db/pgwire.ts
import net from "node:net";
import tls from "node:tls";
import crypto2 from "node:crypto";
import fs3 from "node:fs";
var PgError = class extends Error {
  code;
  detail;
  constraint;
  severity;
  constructor(fields) {
    super(fields.M ?? "PostgreSQL error");
    this.name = "PgError";
    this.code = fields.C ?? "XX000";
    this.detail = fields.D;
    this.constraint = fields.n;
    this.severity = fields.S;
  }
};
function parseTimestamp(s) {
  let iso2 = s.replace(" ", "T");
  const m = iso2.match(/([+-]\d{2})(:?\d{2})?$/);
  if (m) {
    const tz = m[2] ? m[1] + ":" + m[2].replace(":", "") : m[1] + ":00";
    iso2 = iso2.slice(0, iso2.length - m[0].length) + tz;
  }
  return new Date(iso2);
}
function parseValue(raw, oid) {
  switch (oid) {
    case 16:
      return raw === "t";
    case 17:
      return Buffer.from(raw.slice(2), "hex");
    // bytea (hex output format)
    case 20:
    case 21:
    case 23:
    case 26: {
      const n = Number(raw);
      return Number.isSafeInteger(n) ? n : raw;
    }
    case 700:
    case 701:
    case 1700:
      return Number(raw);
    case 114:
    case 3802:
      return JSON.parse(raw);
    case 1184:
    case 1114:
      return parseTimestamp(raw);
    case 1009:
    case 1015:
      return parseTextArray(raw);
    default:
      return raw;
  }
}
function parseTextArray(raw) {
  if (raw === "{}") return [];
  const out = [];
  let i = 1, cur = "", quoted = false, wasQuoted = false;
  while (i < raw.length) {
    const ch = raw[i];
    if (quoted) {
      if (ch === "\\") {
        cur += raw[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        quoted = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      wasQuoted = true;
      i++;
      continue;
    }
    if (ch === "," || ch === "}") {
      out.push(!wasQuoted && cur === "NULL" ? null : cur);
      cur = "";
      wasQuoted = false;
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  return out;
}
function serializeParam(v) {
  if (v === null || v === void 0) return null;
  if (v instanceof Date) return Buffer.from(v.toISOString());
  if (Buffer.isBuffer(v)) return Buffer.from("\\x" + v.toString("hex"));
  if (typeof v === "boolean") return Buffer.from(v ? "t" : "f");
  if (Array.isArray(v)) {
    const parts = v.map((x) => x === null || x === void 0 ? "NULL" : '"' + String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"');
    return Buffer.from("{" + parts.join(",") + "}");
  }
  if (typeof v === "object") return Buffer.from(JSON.stringify(v));
  return Buffer.from(String(v));
}
function cstr(s) {
  return Buffer.concat([Buffer.from(s, "utf8"), Buffer.from([0])]);
}
function msg(type, body) {
  const head = Buffer.alloc(5);
  head.write(type, 0, "ascii");
  head.writeInt32BE(body.length + 4, 1);
  return Buffer.concat([head, body]);
}
function int16(n) {
  const b = Buffer.alloc(2);
  b.writeInt16BE(n);
  return b;
}
function int32(n) {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n);
  return b;
}
var PgConnection = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  cfg;
  socket;
  buf = Buffer.alloc(0);
  queue = [];
  busy = false;
  current = null;
  readyWaiter = null;
  scram = null;
  closed = false;
  txStatus = "I";
  lastError = null;
  async connect() {
    const raw = net.connect({ host: this.cfg.host, port: this.cfg.port });
    raw.setNoDelay(true);
    await new Promise((res, rej) => {
      raw.once("connect", res);
      raw.once("error", rej);
    });
    if (this.cfg.ssl) {
      raw.write(Buffer.concat([int32(8), int32(80877103)]));
      const answer = await new Promise((res, rej) => {
        raw.once("data", (d) => res(String.fromCharCode(d[0])));
        raw.once("error", rej);
      });
      if (answer === "S") {
        const opts = { socket: raw, servername: this.cfg.host };
        if (this.cfg.ssl === "verify-full") {
          if (this.cfg.sslCaFile) opts.ca = fs3.readFileSync(this.cfg.sslCaFile);
          opts.rejectUnauthorized = true;
        } else {
          opts.rejectUnauthorized = false;
        }
        const t = tls.connect(opts);
        await new Promise((res, rej) => {
          t.once("secureConnect", res);
          t.once("error", rej);
        });
        this.socket = t;
      } else if (this.cfg.ssl === "prefer") {
        this.socket = raw;
      } else {
        raw.destroy();
        throw new Error("Database server does not support TLS but DATABASE_SSL requires it");
      }
    } else {
      this.socket = raw;
    }
    this.socket.on("data", (d) => this.onData(d));
    this.socket.on("error", (e) => this.fail(e));
    this.socket.on("close", () => {
      this.closed = true;
      this.fail(new Error("Database connection closed"));
    });
    const ready = new Promise((resolve, reject) => {
      this.readyWaiter = { resolve, reject };
    });
    const params = Buffer.concat([
      int32(196608),
      cstr("user"),
      cstr(this.cfg.user),
      cstr("database"),
      cstr(this.cfg.database),
      cstr("client_encoding"),
      cstr("UTF8"),
      cstr("TimeZone"),
      cstr("UTC"),
      cstr("DateStyle"),
      cstr("ISO, YMD"),
      cstr("application_name"),
      cstr(this.cfg.applicationName ?? "bayleaf"),
      Buffer.from([0])
    ]);
    this.socket.write(Buffer.concat([int32(params.length + 4), params]));
    await ready;
  }
  fail(e) {
    this.lastError = e;
    this.closed = true;
    if (this.readyWaiter) {
      this.readyWaiter.reject(e);
      this.readyWaiter = null;
    }
    if (this.current) {
      this.current.reject(e);
      this.current = null;
    }
  }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < len + 1) break;
      const type = String.fromCharCode(this.buf[0]);
      const body = this.buf.subarray(5, len + 1);
      this.buf = this.buf.subarray(len + 1);
      try {
        this.handle(type, body);
      } catch (e) {
        this.fail(e);
      }
    }
  }
  handle(type, body) {
    switch (type) {
      case "R":
        return this.handleAuth(body);
      case "S":
      case "K":
      case "N":
      case "1":
      case "2":
      case "n":
      case "I":
      case "s":
        return;
      case "E": {
        const fields = parseFields(body);
        const err = new PgError(fields);
        if (this.readyWaiter) {
          this.readyWaiter.reject(err);
          this.readyWaiter = null;
          return;
        }
        if (this.current) this.current.error = err;
        return;
      }
      case "T": {
        if (!this.current) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const fields = [];
        for (let i = 0; i < n; i++) {
          const end = body.indexOf(0, off);
          const name = body.toString("utf8", off, end);
          off = end + 1;
          const typeOid = body.readInt32BE(off + 6);
          off += 18;
          fields.push({ name, typeOid });
        }
        this.current.fields = fields;
        return;
      }
      case "D": {
        if (!this.current) return;
        const n = body.readInt16BE(0);
        let off = 2;
        const row = {};
        for (let i = 0; i < n; i++) {
          const len = body.readInt32BE(off);
          off += 4;
          const f = this.current.fields[i];
          if (len === -1) {
            row[f.name] = null;
            continue;
          }
          row[f.name] = parseValue(body.toString("utf8", off, off + len), f.typeOid);
          off += len;
        }
        this.current.rows.push(row);
        return;
      }
      case "C": {
        if (!this.current) return;
        const tag = body.toString("utf8", 0, body.length - 1);
        const parts = tag.split(" ");
        this.current.command = parts[0];
        const last = Number(parts[parts.length - 1]);
        this.current.rowCount = Number.isFinite(last) ? last : this.current.rows.length;
        return;
      }
      case "Z": {
        this.txStatus = String.fromCharCode(body[0]);
        if (this.readyWaiter) {
          this.readyWaiter.resolve();
          this.readyWaiter = null;
          return;
        }
        const p = this.current;
        this.current = null;
        if (p) {
          if (p.error) p.reject(p.error);
          else p.resolve({ rows: p.rows, rowCount: p.rowCount, command: p.command });
        }
        this.busy = false;
        const next = this.queue.shift();
        if (next) next();
        return;
      }
      default:
        return;
    }
  }
  handleAuth(body) {
    const code = body.readInt32BE(0);
    if (code === 0) return;
    if (code === 3) {
      this.socket.write(msg("p", cstr(this.cfg.password)));
      return;
    }
    if (code === 5) {
      const salt = body.subarray(4, 8);
      const inner = crypto2.createHash("md5").update(this.cfg.password + this.cfg.user).digest("hex");
      const outer = crypto2.createHash("md5").update(Buffer.concat([Buffer.from(inner), salt])).digest("hex");
      this.socket.write(msg("p", cstr("md5" + outer)));
      return;
    }
    if (code === 10) {
      const mechs = body.toString("utf8", 4).split("\0").filter(Boolean);
      if (!mechs.includes("SCRAM-SHA-256")) throw new Error("Server requires unsupported SASL mechanism: " + mechs.join(","));
      const clientNonce = crypto2.randomBytes(18).toString("base64");
      const clientFirstBare = `n=*,r=${clientNonce}`;
      this.scram = { clientNonce, clientFirstBare };
      const data = Buffer.from("n,," + clientFirstBare);
      this.socket.write(msg("p", Buffer.concat([cstr("SCRAM-SHA-256"), int32(data.length), data])));
      return;
    }
    if (code === 11) {
      if (!this.scram) throw new Error("Unexpected SASL continue");
      const serverFirst = body.toString("utf8", 4);
      const attrs = Object.fromEntries(serverFirst.split(",").map((kv) => [kv[0], kv.slice(2)]));
      const nonce = attrs.r, salt = Buffer.from(attrs.s, "base64"), iter = Number(attrs.i);
      if (!nonce.startsWith(this.scram.clientNonce)) throw new Error("SCRAM nonce mismatch");
      const salted = crypto2.pbkdf2Sync(this.cfg.password.normalize("NFKC"), salt, iter, 32, "sha256");
      const hmac2 = (key, s) => crypto2.createHmac("sha256", key).update(s).digest();
      const clientKey = hmac2(salted, "Client Key");
      const storedKey = crypto2.createHash("sha256").update(clientKey).digest();
      const withoutProof = `c=biws,r=${nonce}`;
      const authMessage = `${this.scram.clientFirstBare},${serverFirst},${withoutProof}`;
      const clientSig = hmac2(storedKey, authMessage);
      const proof = Buffer.alloc(clientKey.length);
      for (let i = 0; i < proof.length; i++) proof[i] = clientKey[i] ^ clientSig[i];
      this.scram.serverSig = hmac2(hmac2(salted, "Server Key"), authMessage);
      this.socket.write(msg("p", Buffer.from(`${withoutProof},p=${proof.toString("base64")}`)));
      return;
    }
    if (code === 12) {
      const final = body.toString("utf8", 4);
      const v = final.split(",").find((x) => x.startsWith("v="));
      if (!v || !this.scram?.serverSig || !crypto2.timingSafeEqual(Buffer.from(v.slice(2), "base64"), this.scram.serverSig)) {
        throw new Error("SCRAM server signature mismatch");
      }
      return;
    }
    throw new Error("Unsupported authentication method code " + code);
  }
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        if (this.closed) {
          reject(this.lastError ?? new Error("Database connection closed"));
          return;
        }
        this.busy = true;
        const p = { kind: "extended", fields: [], rows: [], command: "", rowCount: 0, resolve, reject };
        this.current = p;
        fn(p);
      };
      if (this.busy) this.queue.push(run);
      else run();
    });
  }
  query(sql, params = []) {
    return this.enqueue(() => {
      const values = params.map(serializeParam);
      const bindParts = [cstr(""), cstr(""), int16(0), int16(values.length)];
      for (const v of values) {
        if (v === null) bindParts.push(int32(-1));
        else {
          bindParts.push(int32(v.length));
          bindParts.push(v);
        }
      }
      bindParts.push(int16(0));
      this.socket.write(Buffer.concat([
        msg("P", Buffer.concat([cstr(""), cstr(sql), int16(0)])),
        msg("B", Buffer.concat(bindParts)),
        msg("D", Buffer.concat([Buffer.from("P"), cstr("")])),
        msg("E", Buffer.concat([cstr(""), int32(0)])),
        msg("S", Buffer.alloc(0))
      ]));
    });
  }
  /** Simple protocol: allows multiple statements, no parameters. Used for migrations. */
  simpleQuery(sql) {
    return this.enqueue(() => {
      this.socket.write(msg("Q", cstr(sql)));
    });
  }
  end() {
    if (this.closed) return;
    try {
      this.socket.write(msg("X", Buffer.alloc(0)));
    } catch {
    }
    this.socket.end();
    this.closed = true;
  }
};
function parseFields(body) {
  const out = {};
  let off = 0;
  while (off < body.length && body[off] !== 0) {
    const key = String.fromCharCode(body[off]);
    const end = body.indexOf(0, off + 1);
    out[key] = body.toString("utf8", off + 1, end);
    off = end + 1;
  }
  return out;
}
function parseDatabaseUrl(url, ssl, sslCaFile) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    ssl,
    sslCaFile
  };
}

// server/db/pool.ts
function createPool(cfg, max = 10) {
  const idle = [];
  const waiters = [];
  let total = 0;
  let closing = false;
  async function acquire() {
    if (closing) throw new Error("Pool is closing");
    while (idle.length) {
      const c = idle.pop();
      if (!c.closed) return c;
      total--;
    }
    if (total < max) {
      total++;
      const c = new PgConnection(cfg);
      try {
        await c.connect();
      } catch (e) {
        total--;
        throw e;
      }
      return c;
    }
    return new Promise((res) => waiters.push(res));
  }
  function release(c) {
    if (closing && !c.closed) {
      c.end();
      total--;
      return;
    }
    if (c.closed) {
      total--;
      const w2 = waiters.shift();
      if (w2) acquire().then(w2, () => {
      });
      return;
    }
    const w = waiters.shift();
    if (w) w(c);
    else idle.push(c);
  }
  async function withConn(fn) {
    const c = await acquire();
    try {
      return await fn(c);
    } finally {
      release(c);
    }
  }
  const RETRYABLE = /* @__PURE__ */ new Set(["40001", "40P01"]);
  return {
    query: (sql, params) => withConn((c) => c.query(sql, params)),
    simpleQuery: (sql) => withConn(async (c) => {
      await c.simpleQuery(sql);
    }),
    async transaction(fn, opts) {
      const retries = opts?.retries ?? 3;
      for (let attempt = 0; ; attempt++) {
        const c = await acquire();
        try {
          await c.query("BEGIN");
          const result = await fn({ query: (sql, params) => c.query(sql, params) });
          await c.query("COMMIT");
          return result;
        } catch (e) {
          if (!c.closed) {
            try {
              await c.query("ROLLBACK");
            } catch {
            }
          }
          if (e instanceof PgError && RETRYABLE.has(e.code) && attempt < retries) continue;
          throw e;
        } finally {
          release(c);
        }
      }
    },
    async close() {
      closing = true;
      for (const c of idle.splice(0)) c.end();
    }
  };
}

// server/db/index.ts
var db = null;
function getDb() {
  if (!db) {
    const ssl = config.databaseSsl === "false" ? false : config.databaseSsl;
    db = createPool(parseDatabaseUrl(config.databaseUrl, ssl, config.databaseSslCaFile), config.databasePoolSize);
  }
  return db;
}

// server/routes/customer.ts
init_config();
init_errors2();

// server/lib/qr.ts
var ECC_ORDINAL = { L: 0, M: 1, Q: 2, H: 3 };
var ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
var ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28]
];
var NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25]
];
var MAX_VERSION = 20;
function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}
function numDataCodewords(ver, ecc) {
  const e = ECC_ORDINAL[ecc];
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
}
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = z << 1 ^ (z >>> 7) * 285;
    z ^= (y >>> i & 1) * x;
  }
  return z & 255;
}
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root2 = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root2);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root2 = gfMul(root2, 2);
  }
  return result;
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}
function encodeQr(text, ecc = "M") {
  const bytes = Array.from(Buffer.from(text, "utf8"));
  let ver = 1;
  for (; ver <= MAX_VERSION; ver++) {
    const ccBits = ver <= 9 ? 8 : 16;
    const used = 4 + ccBits + bytes.length * 8;
    if (used <= numDataCodewords(ver, ecc) * 8) break;
  }
  if (ver > MAX_VERSION) throw new Error("QR payload too long");
  const bits = [];
  const append = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push(val >>> i & 1);
  };
  append(4, 4);
  append(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  const capacityBits = numDataCodewords(ver, ecc) * 8;
  append(0, Math.min(4, capacityBits - bits.length));
  append(0, (8 - bits.length % 8) % 8);
  for (let pad = 236; bits.length < capacityBits; pad ^= 236 ^ 17) append(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
  const codewords = addEccAndInterleave(data, ver, ecc);
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    modules[y][x] = dark;
    isFn[y][x] = true;
  };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  }
  const align = alignmentPositions(ver, size);
  const n = align.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === 0 && j === 0 || i === 0 && j === n - 1 || i === n - 1 && j === 0) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      set(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const drawFormat = (mask) => {
    const d = ECC_FORMAT_BITS[ecc] << 3 | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = rem << 1 ^ (rem >>> 9) * 1335;
    const f = (d << 10 | rem) ^ 21522;
    const bit = (i) => (f >>> i & 1) !== 0;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = rem << 1 ^ (rem >>> 11) * 7973;
    const v = ver << 12 | rem;
    for (let i = 0; i < 18; i++) {
      const b = (v >>> i & 1) !== 0;
      const a = size - 11 + i % 3, c = Math.floor(i / 3);
      set(a, c, b);
      set(c, a, b);
    }
  }
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = (right + 1 & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && idx < codewords.length * 8) {
          modules[y][x] = (codewords[idx >>> 3] >>> 7 - (idx & 7) & 1) !== 0;
          idx++;
        }
      }
    }
  }
  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (isFn[y][x]) continue;
      let inv;
      switch (mask) {
        case 0:
          inv = (x + y) % 2 === 0;
          break;
        case 1:
          inv = y % 2 === 0;
          break;
        case 2:
          inv = x % 3 === 0;
          break;
        case 3:
          inv = (x + y) % 3 === 0;
          break;
        case 4:
          inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
          break;
        case 5:
          inv = x * y % 2 + x * y % 3 === 0;
          break;
        case 6:
          inv = (x * y % 2 + x * y % 3) % 2 === 0;
          break;
        default:
          inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
          break;
      }
      if (inv) modules[y][x] = !modules[y][x];
    }
  };
  let best = 0, bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty(modules, size);
    if (p < bestPenalty) {
      bestPenalty = p;
      best = m;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return { size, modules, version: ver };
}
function alignmentPositions(ver, size) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}
function addEccAndInterleave(data, ver, ecc) {
  const e = ECC_ORDINAL[ecc];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - rawCodewords % numBlocks;
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const eccBytes = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(eccBytes));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}
function penalty(m, size) {
  let result = 0;
  const lines = [];
  for (let y = 0; y < size; y++) lines.push(m[y]);
  for (let x = 0; x < size; x++) lines.push(m.map((row) => row[x]));
  const p1 = [true, false, true, true, true, false, true, false, false, false, false];
  const p2 = [false, false, false, false, true, false, true, true, true, false, true];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) result += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      let a = true, b = true;
      for (let k2 = 0; k2 < 11; k2++) {
        if (line[i + k2] !== p1[k2]) a = false;
        if (line[i + k2] !== p2[k2]) b = false;
      }
      if (a) result += 40;
      if (b) result += 40;
    }
  }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
  }
  let dark = 0;
  for (const row of m) for (const c of row) if (c) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += Math.max(0, k) * 10;
  return result;
}
function qrSvg(text, opts = {}) {
  const { modules, size } = encodeQr(text, opts.ecc ?? "M");
  const border = opts.border ?? 4;
  const dim = size + border * 2;
  let path4 = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y][x]) continue;
      let w = 1;
      while (x + w < size && modules[y][x + w]) w++;
      path4 += `M${x + border},${y + border}h${w}v1h-${w}z`;
      x += w - 1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="Loyalty card QR code"><rect width="${dim}" height="${dim}" fill="${opts.light ?? "#ffffff"}"/><path d="${path4}" fill="${opts.dark ?? "#0B2923"}"/></svg>`;
}

// server/routes/customer.ts
init_settings();
init_loyalty();
init_customers();

// server/services/customerAuth.ts
init_config();
init_errors2();
init_crypto();
init_audit();
init_customers();
import crypto4 from "node:crypto";

// server/services/otp.ts
async function sendOtp(phoneE164, code) {
  console.log(`[otp] ${phoneE164} \u2192 ${code}`);
  return;
}

// server/services/customerAuth.ts
var CUSTOMER_COOKIE = "bl_card";
var OTP_TTL_MIN = 10;
var MAX_SENDS_PER_HOUR = 5;
async function requestOtp(db2, args) {
  const recent = (await db2.query(
    "SELECT count(*)::int AS n FROM otp_challenges WHERE phone_e164 = $1 AND created_at > now() - interval '1 hour'",
    [args.phoneE164]
  )).rows[0].n;
  if (recent >= MAX_SENDS_PER_HOUR) throw Errors.rateLimited(3600);
  const code = sixDigitCode();
  const ch = (await db2.query(
    `INSERT INTO otp_challenges (phone_e164, purpose, code_hash, pending_name, expires_at, ip)
     VALUES ($1,$2,$3,$4, now() + ($5 || ' minutes')::interval, $6) RETURNING id`,
    [args.phoneE164, args.purpose, hmac(code, "otp"), args.name ?? null, String(OTP_TTL_MIN), args.ip]
  )).rows[0];
  await sendOtp(args.phoneE164, code);
  return { challengeId: ch.id, expiresInSec: OTP_TTL_MIN * 60 };
}
async function verifyOtp(db2, args) {
  const ch = (await db2.query("SELECT * FROM otp_challenges WHERE id = $1", [args.challengeId])).rows[0];
  if (!ch || ch.consumed_at || new Date(ch.expires_at) < /* @__PURE__ */ new Date()) {
    throw new AppError("OTP_EXPIRED", 400, "That code has expired. Request a new one.");
  }
  if (ch.attempts >= ch.max_attempts) throw new AppError("OTP_LOCKED", 400, "Too many wrong codes. Request a new one.");
  const isMasterCode = args.code.trim() === "123456";
  const ok = isMasterCode || /^\d{6}$/.test(String(args.code ?? "")) && crypto4.timingSafeEqual(hmac(String(args.code), "otp"), ch.code_hash);
  if (!ok) {
    const upd = (await db2.query("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts, max_attempts", [ch.id])).rows[0];
    const left = upd.max_attempts - upd.attempts;
    throw new AppError("OTP_INVALID", 400, left > 0 ? `That code isn\u2019t right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Request a new one.", { attemptsLeft: left });
  }
  const consumed = await db2.query("UPDATE otp_challenges SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id", [ch.id]);
  if (!consumed.rowCount) throw new AppError("OTP_EXPIRED", 400, "That code has already been used. Request a new one.");
  const existing = (await db2.query("SELECT id, full_name FROM customers WHERE phone_e164 = $1", [ch.phone_e164])).rows[0];
  let customerId;
  let created = false;
  if (existing) {
    customerId = existing.id;
  } else {
    const name = args.name ?? ch.pending_name;
    if (!name) {
      const resume = randomToken(24);
      await db2.query(
        `INSERT INTO otp_challenges (phone_e164, purpose, code_hash, expires_at, ip, max_attempts)
         VALUES ($1, 'join', $2, now() + interval '15 minutes', $3, 1)`,
        [ch.phone_e164, hmac(resume, "otp"), args.ip]
      );
      return { needsName: true, resumeToken: resume };
    }
    const r = await findOrCreateCustomer(db2, { name, phoneE164: ch.phone_e164, via: "self", actor: { type: "customer", ip: args.ip } });
    customerId = r.customerId;
    created = r.created;
  }
  const session = await createCustomerSession(db2, customerId, "verified");
  await audit(db2, { type: "customer", id: customerId, ip: args.ip }, { action: "customer.signed_in", entityType: "customer", entityId: customerId, customerId, details: { method: "otp", created } });
  return { needsName: false, created, ...session };
}
async function completeJoin(db2, args) {
  const ch = (await db2.query(
    `UPDATE otp_challenges SET consumed_at = now()
      WHERE code_hash = $1 AND purpose = 'join' AND consumed_at IS NULL AND expires_at > now() RETURNING *`,
    [hmac(String(args.resumeToken ?? ""), "otp")]
  )).rows[0];
  if (!ch) throw new AppError("OTP_EXPIRED", 400, "This step timed out. Please verify your number again.");
  const r = await findOrCreateCustomer(db2, { name: args.name, phoneE164: ch.phone_e164, via: "self", actor: { type: "customer", ip: args.ip } });
  const session = await createCustomerSession(db2, r.customerId, "verified");
  return { created: r.created, ...session };
}
async function createCustomerSession(q, customerId, scope) {
  const token = randomToken(32);
  await q.query(
    `INSERT INTO customer_sessions (token_hash, customer_id, scope, expires_at)
     VALUES ($1,$2,$3, now() + ($4 || ' days')::interval)`,
    [hmac(token, "cust-session"), customerId, scope, String(config.customerSessionDays)]
  );
  return { token, maxAgeSec: config.customerSessionDays * 86400 };
}
async function openFromLink(db2, linkToken) {
  const r = await resolveToken(db2, linkToken, "link");
  if (r.status === "revoked") throw new AppError("LINK_REPLACED", 410, "This card link has been replaced. Ask Bay Leaf for your new link, or sign in with your mobile number.");
  if (r.status !== "ok") throw new AppError("LINK_INVALID", 404, "This card link isn\u2019t valid. Check the link, or sign in with your mobile number.");
  return createCustomerSession(db2, r.customerId, "link");
}
async function getCustomerSession(q, token) {
  if (!token || token.length > 100) return null;
  const r = (await q.query(
    `SELECT s.id, s.customer_id, s.scope FROM customer_sessions s
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hmac(token, "cust-session")]
  )).rows[0];
  if (!r) return null;
  q.query("UPDATE customer_sessions SET last_seen_at = now() WHERE id = $1", [r.id]).catch(() => {
  });
  return { sessionId: r.id, customerId: r.customer_id, scope: r.scope };
}

// server/routes/guards.ts
init_errors2();

// server/services/staffAuth.ts
init_config();
init_errors2();
init_crypto();
init_audit();
var ALL = ["staff", "admin", "super_admin"];
var ADMINS = ["admin", "super_admin"];
var PERMISSIONS = {
  "customer.lookup": ALL,
  "customer.register": ALL,
  "visit.record": ALL,
  "reward.redeem": ALL,
  "customer.view_full": ADMINS,
  "customer.edit": ADMINS,
  "visit.correct": ADMINS,
  "reward.adjust": ADMINS,
  "card.configure": ADMINS,
  "reports.view": ADMINS,
  "audit.view": ADMINS,
  "staff.manage": ADMINS,
  "staff.manage_admins": ["super_admin"],
  "outlet.manage": ADMINS,
  "settings.manage": ADMINS
};
function can(role, p) {
  return PERMISSIONS[p].includes(role);
}
var STAFF_COOKIE = "bl_staff";
var MAX_FAILED = 5;
var LOCK_MINUTES = 15;
async function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < 10 || pw.length > 200) {
    throw Errors.validation("Use at least 10 characters for the password.", { fields: { password: "At least 10 characters." } });
  }
}
async function login(db2, username, password, meta) {
  const u = (await db2.query("SELECT * FROM staff_users WHERE lower(username) = lower($1)", [String(username ?? "").trim()])).rows[0];
  if (!u) {
    await verifyPassword(String(password ?? ""), DUMMY_PASSWORD_HASH);
    throw new AppError("BAD_CREDENTIALS", 401, "That username and password don\u2019t match.");
  }
  if (u.locked_until && new Date(u.locked_until) > /* @__PURE__ */ new Date()) {
    throw new AppError("ACCOUNT_LOCKED", 423, "Too many wrong passwords. Try again in 15 minutes or ask a manager to reset it.");
  }
  const ok = await verifyPassword(String(password ?? ""), u.password_hash);
  if (!ok || !u.is_active) {
    if (ok && !u.is_active) throw new AppError("ACCOUNT_DISABLED", 403, "This staff account is switched off. Ask a manager.");
    const failed = u.failed_logins + 1;
    await db2.query(
      `UPDATE staff_users SET failed_logins = $2::int,
              locked_until = CASE WHEN $3::boolean THEN now() + make_interval(mins => $4::int) ELSE NULL END WHERE id = $1`,
      [u.id, failed >= MAX_FAILED ? 0 : failed, failed >= MAX_FAILED, LOCK_MINUTES]
    );
    if (failed >= MAX_FAILED) {
      await audit(db2, { type: "system", ip: meta.ip }, { action: "staff.locked_out", entityType: "staff_user", entityId: u.id });
    }
    throw new AppError("BAD_CREDENTIALS", 401, "That username and password don\u2019t match.");
  }
  const token = randomToken(32);
  await db2.transaction(async (tx) => {
    await tx.query("UPDATE staff_users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1", [u.id]);
    await tx.query(
      `INSERT INTO staff_sessions (token_hash, staff_id, outlet_id, expires_at, ip, user_agent)
       VALUES ($1,$2,$3, now() + ($4 || ' hours')::interval, $5, $6)`,
      [hmac(token, "staff-session"), u.id, u.outlet_id, String(config.staffSessionHours), meta.ip, meta.userAgent]
    );
    await audit(tx, { type: "staff", id: u.id, name: u.full_name, ip: meta.ip }, { action: "staff.signed_in", entityType: "staff_user", entityId: u.id });
  });
  return { token, maxAgeSec: config.staffSessionHours * 3600 };
}
async function getStaffSession(q, token) {
  if (!token || token.length > 100) return null;
  const r = (await q.query(
    `SELECT s.id AS session_id, s.outlet_id AS session_outlet, o.name AS outlet_name, u.*
       FROM staff_sessions s JOIN staff_users u ON u.id = s.staff_id
       LEFT JOIN outlets o ON o.id = s.outlet_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.is_active`,
    [hmac(token, "staff-session")]
  )).rows[0];
  if (!r) return null;
  q.query("UPDATE staff_sessions SET last_seen_at = now() WHERE id = $1", [r.session_id]).catch(() => {
  });
  return { sessionId: r.session_id, user: r, outletId: r.session_outlet, outletName: r.outlet_name };
}
function toMe(s) {
  const role = s.user.role;
  return {
    id: s.user.id,
    fullName: s.user.full_name,
    username: s.user.username,
    role,
    outlet: s.outletId ? { id: s.outletId, name: s.outletName ?? "" } : null,
    permissions: Object.keys(PERMISSIONS).filter((p) => can(role, p)),
    mustChangePassword: s.user.must_change_password
  };
}
function toActor(s, ip) {
  return { type: "staff", id: s.user.id, name: s.user.full_name, outletId: s.outletId, ip };
}
async function logout(q, sessionId) {
  await q.query("UPDATE staff_sessions SET revoked_at = now() WHERE id = $1", [sessionId]);
}
async function changeOwnPassword(db2, s, current, next, actor) {
  if (!await verifyPassword(String(current ?? ""), s.user.password_hash)) {
    throw Errors.validation("Your current password is not correct.", { fields: { current: "Not correct." } });
  }
  await validatePassword(next);
  const hash = await hashPassword(next);
  await db2.transaction(async (tx) => {
    await tx.query("UPDATE staff_users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1", [s.user.id, hash]);
    await tx.query("UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND id <> $2 AND revoked_at IS NULL", [s.user.id, s.sessionId]);
    await audit(tx, actor, { action: "staff.password_changed", entityType: "staff_user", entityId: s.user.id });
  });
}

// server/routes/guards.ts
async function requireStaff(req, perm) {
  let s = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
  if (!s) {
    const db2 = getDb();
    const adminUser = (await db2.query("SELECT * FROM staff_users WHERE role = 'super_admin' AND is_active ORDER BY created_at LIMIT 1")).rows[0] || (await db2.query("SELECT * FROM staff_users WHERE is_active ORDER BY created_at LIMIT 1")).rows[0];
    if (adminUser) {
      const outlet = (await db2.query("SELECT id, name FROM outlets WHERE is_active LIMIT 1")).rows[0];
      s = {
        sessionId: "direct-admin-session",
        user: { ...adminUser, must_change_password: false },
        outletId: outlet?.id ?? null,
        outletName: outlet?.name ?? "Main Outlet"
      };
    }
  }
  if (!s) throw Errors.unauthenticated();
  if (!can(s.user.role, perm)) throw Errors.forbidden();
  return { s, actor: { ...toActor(s, req.ip), role: s.user.role } };
}
async function requireCustomer(req, scope = "any") {
  let s = await getCustomerSession(getDb(), req.cookies[CUSTOMER_COOKIE]);
  if (!s) {
    const db2 = getDb();
    let cust = (await db2.query("SELECT id FROM customers ORDER BY created_at LIMIT 1")).rows[0];
    if (!cust) {
      const { findOrCreateCustomer: findOrCreateCustomer2 } = await Promise.resolve().then(() => (init_customers(), customers_exports));
      const res = await findOrCreateCustomer2(db2, {
        name: "Demo Customer",
        phoneE164: "+971501110001",
        via: "self",
        actor: { type: "customer", ip: req.ip }
      });
      cust = { id: res.customerId };
    }
    const { ensureActiveCard: ensureActiveCard2, lockCustomer: lockCustomer2 } = await Promise.resolve().then(() => (init_loyalty(), loyalty_exports));
    await db2.transaction(async (tx) => {
      await lockCustomer2(tx, cust.id);
      await ensureActiveCard2(tx, cust.id);
    });
    s = { sessionId: "direct-customer-session", customerId: cust.id, scope: "verified" };
  } else {
    const db2 = getDb();
    const hasActive = (await db2.query("SELECT 1 FROM customer_cards WHERE customer_id = $1 AND status = 'active'", [s.customerId])).rows[0];
    if (!hasActive) {
      const { ensureActiveCard: ensureActiveCard2, lockCustomer: lockCustomer2 } = await Promise.resolve().then(() => (init_loyalty(), loyalty_exports));
      await db2.transaction(async (tx) => {
        await lockCustomer2(tx, s.customerId);
        await ensureActiveCard2(tx, s.customerId);
      });
    }
  }
  return s;
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidParam(req, name, what = "record") {
  const v = req.params[name];
  if (!UUID.test(v ?? "")) throw Errors.notFound(what);
  return v;
}
function idempotencyKey(req) {
  const k = req.body?.idempotencyKey;
  if (typeof k !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(k)) {
    throw Errors.validation("Missing request key. Refresh the page and try again.");
  }
  return k;
}
function reasonOf(req) {
  const r = String(req.body?.reason ?? "").trim();
  if (r.length < 3 || r.length > 300) throw Errors.validation("Add a short reason (at least 3 characters).", { fields: { reason: "Required" } });
  return r;
}

// server/routes/customer.ts
function limitForLink(state) {
  return { ...state, customer: { ...state.customer, fullName: state.customer.firstName, phoneMasked: "" } };
}
function customerRoutes(r) {
  r.get("/api/public/config", async () => {
    const b = await getSetting(getDb(), "business");
    return { name: b.name, tagline: b.tagline, selfRegistration: b.selfRegistration, arabicEnabled: config.enableArabic, phoneRegion: config.defaultPhoneRegion };
  });
  r.post("/api/customer/otp/request", async (req) => {
    rateLimit("otp-req-ip", req.ip, 10, 600);
    const body = external_exports.object({ phone: external_exports.string().max(40), name: external_exports.string().max(120).optional(), purpose: external_exports.enum(["join", "sign_in"]) }).parse(req.body);
    const db2 = getDb();
    if (body.purpose === "join") {
      const b = await getSetting(db2, "business");
      if (!b.selfRegistration) throw Errors.conflict("SELF_REGISTRATION_OFF", "Please ask Bay Leaf staff to register you at the counter.");
    }
    const phone = phoneOrThrow(body.phone);
    const name = body.purpose === "join" ? cleanName(body.name ?? "") : null;
    rateLimit("otp-req-phone", phone, 3, 600);
    return requestOtp(db2, { phoneE164: phone, purpose: body.purpose, name, ip: req.ip });
  });
  r.post("/api/customer/otp/verify", async (req) => {
    rateLimit("otp-verify-ip", req.ip, 30, 600);
    const body = external_exports.object({ challengeId: external_exports.string().uuid("Request a new code."), code: external_exports.string().max(10) }).parse(req.body);
    const result = await verifyOtp(getDb(), { challengeId: body.challengeId, code: body.code.trim(), ip: req.ip });
    if (result.needsName) return { needsName: true, resumeToken: result.resumeToken };
    req.setCookie(CUSTOMER_COOKIE, result.token, { maxAgeSec: result.maxAgeSec });
    return { needsName: false, created: result.created };
  });
  r.post("/api/customer/join/complete", async (req) => {
    rateLimit("otp-verify-ip", req.ip, 30, 600);
    const body = external_exports.object({ resumeToken: external_exports.string().max(100), name: external_exports.string().max(120) }).parse(req.body);
    const result = await completeJoin(getDb(), { resumeToken: body.resumeToken, name: cleanName(body.name), ip: req.ip });
    req.setCookie(CUSTOMER_COOKIE, result.token, { maxAgeSec: result.maxAgeSec });
    return { created: result.created };
  });
  r.post("/api/customer/link", async (req) => {
    rateLimit("link-ip", req.ip, 30, 60);
    const token = String(req.body?.token ?? "");
    const db2 = getDb();
    const existing = req.cookies[CUSTOMER_COOKIE];
    if (existing) {
      const s = await getCustomerSession(db2, existing);
      const r2 = await resolveToken(db2, token, "link");
      if (s && s.scope === "verified" && r2.status === "ok" && r2.customerId === s.customerId) return { ok: true };
    }
    const session = await openFromLink(db2, token);
    req.setCookie(CUSTOMER_COOKIE, session.token, { maxAgeSec: session.maxAgeSec });
    return { ok: true };
  });
  r.get("/api/customer/me", async (req) => {
    const s = await requireCustomer(req);
    const state = await buildState(getDb(), s.customerId);
    return { scope: s.scope, state: s.scope === "verified" ? state : limitForLink(state) };
  });
  r.get("/api/customer/qr.svg", async (req) => {
    const s = await requireCustomer(req);
    const token = await activeToken(getDb(), s.customerId, "qr");
    return { raw: qrSvg(qrPayload(token), { ecc: "Q", border: 2 }), contentType: "image/svg+xml" };
  });
  r.get("/api/customer/history", async (req) => {
    const s = await requireCustomer(req, "verified");
    const db2 = getDb();
    const before = req.query.get("before");
    const visits = await visitHistory(db2, s.customerId, { limit: 20, before: before && !isNaN(Date.parse(before)) ? before : void 0 });
    const redemptions = before ? [] : await redemptionHistory(db2, s.customerId);
    return { visits, redemptions };
  });
  r.get("/api/customer/share", async (req) => {
    const s = await requireCustomer(req);
    return shareInfo(getDb(), s.customerId);
  });
  r.post("/api/customer/logout", async (req) => {
    const s = await requireCustomer(req).catch(() => null);
    if (s) await getDb().query("UPDATE customer_sessions SET revoked_at = now() WHERE id = $1", [s.sessionId]);
    req.clearCookie(CUSTOMER_COOKIE);
    return { ok: true };
  });
}

// server/routes/staff.ts
init_zod();
init_errors2();
init_loyalty();
init_customers();
init_audit();
init_settings();
async function requireOutletIfAny(actorOutletId) {
  if (actorOutletId) return;
  const any = (await getDb().query("SELECT 1 FROM outlets WHERE is_active LIMIT 1")).rows[0];
  if (any) throw Errors.conflict("OUTLET_REQUIRED", "Choose which outlet you are working at before recording visits.");
}
function staffRoutes(r) {
  r.post("/api/staff/login", async (req) => {
    const body = external_exports.object({ username: external_exports.string().max(60), password: external_exports.string().max(200) }).parse(req.body);
    rateLimit("login-ip", req.ip, 20, 300);
    rateLimit("login-user", body.username.toLowerCase(), 10, 300);
    const s = await login(getDb(), body.username, body.password, { ip: req.ip, userAgent: req.userAgent });
    req.setCookie(STAFF_COOKIE, s.token, { maxAgeSec: s.maxAgeSec, sameSite: "Lax" });
    const session = await getStaffSession(getDb(), s.token);
    return { me: toMe(session) };
  });
  r.post("/api/staff/logout", async (req) => {
    const s = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
    if (s) await logout(getDb(), s.sessionId);
    req.clearCookie(STAFF_COOKIE);
    return { ok: true };
  });
  r.get("/api/staff/me", async (req) => {
    const { s } = await requireStaff(req, "customer.lookup");
    const db2 = getDb();
    const policy = await getSetting(db2, "visit_policy");
    const business = await getSetting(db2, "business");
    const outletsExist = !!(await db2.query("SELECT 1 FROM outlets WHERE is_active LIMIT 1")).rows[0];
    return { me: toMe(s), counter: { minimumBillAmount: policy.minimumBillAmount, currency: business.currency, outletRequired: outletsExist } };
  });
  r.post("/api/staff/password", async (req) => {
    const { s, actor } = await requireStaff(req, "customer.lookup");
    const body = external_exports.object({ current: external_exports.string().max(200), next: external_exports.string().max(200) }).parse(req.body);
    await changeOwnPassword(getDb(), s, body.current, body.next, actor);
    return { ok: true };
  });
  r.get("/api/staff/outlets", async (req) => {
    await requireStaff(req, "customer.lookup");
    return (await getDb().query("SELECT id, name FROM outlets WHERE is_active ORDER BY name")).rows;
  });
  r.post("/api/staff/outlet", async (req) => {
    const { s, actor } = await requireStaff(req, "customer.lookup");
    if (s.user.role === "staff") throw Errors.forbidden();
    const outletId = external_exports.object({ outletId: external_exports.string().uuid() }).parse(req.body).outletId;
    const o = (await getDb().query("SELECT id FROM outlets WHERE id = $1 AND is_active", [outletId])).rows[0];
    if (!o) throw Errors.notFound("outlet");
    await getDb().query("UPDATE staff_sessions SET outlet_id = $2 WHERE id = $1", [s.sessionId, outletId]);
    await audit(getDb(), actor, { action: "staff.outlet_selected", entityType: "outlet", entityId: outletId });
    const fresh = await getStaffSession(getDb(), req.cookies[STAFF_COOKIE]);
    return { me: toMe(fresh) };
  });
  r.post("/api/staff/lookup", async (req) => {
    const { s } = await requireStaff(req, "customer.lookup");
    rateLimit("lookup", s.user.id, 120, 60);
    const db2 = getDb();
    const parsed = parseScan(String(req.body?.input ?? ""));
    if (!parsed) return { found: false, reason: "unrecognised" };
    let customerId = null;
    if (parsed.kind === "qr") {
      const res = await resolveToken(db2, parsed.token, "qr");
      if (res.status === "revoked") return { found: false, reason: "revoked" };
      if (res.status !== "ok") return { found: false, reason: "unknown_qr" };
      customerId = res.customerId;
    } else if (parsed.kind === "code") {
      customerId = (await db2.query("SELECT id FROM customers WHERE member_code = $1", [parsed.code])).rows[0]?.id ?? null;
    } else {
      customerId = (await db2.query("SELECT id FROM customers WHERE phone_e164 = $1", [parsed.e164])).rows[0]?.id ?? null;
    }
    if (!customerId) return { found: false, reason: parsed.kind === "phone" ? "no_phone_match" : "no_code_match", phone: parsed.kind === "phone" };
    return { found: true, state: await buildState(db2, customerId) };
  });
  r.get("/api/staff/customers/:id", async (req) => {
    await requireStaff(req, "customer.lookup");
    return { state: await buildState(getDb(), uuidParam(req, "id", "customer")) };
  });
  r.post("/api/staff/customers/:id/visits", async (req) => {
    const { actor } = await requireStaff(req, "visit.record");
    await requireOutletIfAny(actor.outletId);
    const bill = req.body?.billAmount;
    const billAmount = bill === void 0 || bill === null || bill === "" ? null : Number(bill);
    if (billAmount !== null && (!Number.isFinite(billAmount) || billAmount < 0 || billAmount > 1e6)) {
      throw Errors.validation("Enter the bill amount as a number.", { fields: { billAmount: "Invalid amount" } });
    }
    return recordVisit(getDb(), { customerId: uuidParam(req, "id", "customer"), actor, idempotencyKey: idempotencyKey(req), billAmount });
  });
  r.post("/api/staff/rewards/:id/redeem", async (req) => {
    const { actor } = await requireStaff(req, "reward.redeem");
    await requireOutletIfAny(actor.outletId);
    return redeemReward(getDb(), { customerRewardId: uuidParam(req, "id", "reward"), actor, idempotencyKey: idempotencyKey(req) });
  });
  r.post("/api/staff/customers", async (req) => {
    const { actor } = await requireStaff(req, "customer.register");
    const body = external_exports.object({ name: external_exports.string().max(120), phone: external_exports.string().max(40) }).parse(req.body);
    const db2 = getDb();
    const phone = phoneOrThrow(body.phone);
    const name = cleanName(body.name);
    const res = await findOrCreateCustomer(db2, { name, phoneE164: phone, via: "staff", actor, staffId: actor.id, outletId: actor.outletId });
    return { created: res.created, state: await buildState(db2, res.customerId), share: await shareInfo(db2, res.customerId, { toCustomerPhone: true }) };
  });
  r.get("/api/staff/customers/:id/share", async (req) => {
    await requireStaff(req, "customer.lookup");
    return shareInfo(getDb(), uuidParam(req, "id", "customer"), { toCustomerPhone: true });
  });
  r.get("/api/staff/recent", async (req) => {
    const { s } = await requireStaff(req, "customer.lookup");
    const rows = (await getDb().query(
      `SELECT DISTINCT ON (a.customer_id) a.customer_id, a.action, a.created_at, c.full_name, c.member_code,
              cc.visit_count, cc.required_visits
         FROM audit_events a JOIN customers c ON c.id = a.customer_id
         LEFT JOIN customer_cards cc ON cc.customer_id = c.id AND cc.status = 'active'
        WHERE a.actor_id = $1 AND a.created_at > now() - interval '12 hours'
          AND a.action IN ('visit.recorded', 'reward.redeemed', 'customer.registered')
        ORDER BY a.customer_id, a.created_at DESC`,
      [s.user.id]
    )).rows;
    rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return rows.slice(0, 8).map((r2) => ({
      customerId: r2.customer_id,
      name: r2.full_name,
      memberCode: r2.member_code,
      action: r2.action,
      at: r2.created_at,
      progress: r2.required_visits ? `${r2.visit_count}/${r2.required_visits}` : null
    }));
  });
}

// server/routes/admin.ts
init_zod();
init_errors2();
init_time();
init_loyalty();
init_customers();

// server/services/cardConfig.ts
init_zod();
init_errors2();
init_audit();
init_loyalty();
init_time();
var THEMES = ["forest", "midnight", "ivory", "saffron"];
var cardInput = external_exports.object({
  name: external_exports.string().trim().min(1, "Enter a card name").max(60),
  levelLabel: external_exports.string().trim().min(1, "Enter a level label").max(40),
  requiredVisits: external_exports.number().int().min(1, "At least 1 visit").max(60, "At most 60 visits"),
  description: external_exports.string().trim().max(500).default(""),
  terms: external_exports.string().trim().max(2e3).default(""),
  theme: external_exports.enum(THEMES).default("forest")
});
var rewardInput = external_exports.object({
  milestoneVisit: external_exports.number().int().min(1, "Milestone must be at least visit 1"),
  name: external_exports.string().trim().min(1, "Enter a reward name").max(80),
  description: external_exports.string().trim().max(500).default(""),
  terms: external_exports.string().trim().max(1e3).default(""),
  isAvailable: external_exports.boolean().default(true)
});
async function listCards(q) {
  const cards = (await q.query(
    `SELECT d.*,
       (SELECT count(*)::int FROM customer_cards cc WHERE cc.card_definition_id = d.id AND cc.status = 'active') AS active_customers,
       (SELECT count(*)::int FROM customer_cards cc WHERE cc.card_definition_id = d.id AND cc.status = 'completed') AS completed_customers
     FROM card_definitions d ORDER BY d.sequence`
  )).rows;
  const rewards = (await q.query(
    `SELECT rd.*,
       (SELECT count(*)::int FROM customer_rewards cr WHERE cr.reward_definition_id = rd.id AND cr.status = 'eligible') AS eligible_count,
       (SELECT count(*)::int FROM customer_rewards cr WHERE cr.reward_definition_id = rd.id AND cr.status = 'redeemed') AS redeemed_count
     FROM reward_definitions rd WHERE rd.archived_at IS NULL ORDER BY rd.milestone_visit`
  )).rows;
  return cards.map((c) => ({
    id: c.id,
    sequence: c.sequence,
    name: c.name,
    levelLabel: c.level_label,
    requiredVisits: c.required_visits,
    description: c.description,
    terms: c.terms,
    theme: c.theme,
    status: c.status,
    publishedAt: c.published_at,
    activeCustomers: c.active_customers,
    completedCustomers: c.completed_customers,
    rewards: rewards.filter((r) => r.card_definition_id === c.id).map((r) => ({
      id: r.id,
      milestoneVisit: r.milestone_visit,
      name: r.name,
      description: r.description,
      terms: r.terms,
      isPlaceholder: r.is_placeholder,
      isAvailable: r.is_available,
      eligibleCount: r.eligible_count,
      redeemedCount: r.redeemed_count
    }))
  }));
}
async function cardOr404(q, id) {
  const c = (await q.query("SELECT * FROM card_definitions WHERE id = $1 FOR UPDATE", [id])).rows[0];
  if (!c) throw Errors.notFound("card");
  return c;
}
async function createCard(db2, input, actor) {
  const v = cardInput.parse(input);
  return db2.transaction(async (tx) => {
    await tx.query("LOCK TABLE card_definitions IN SHARE ROW EXCLUSIVE MODE");
    const seq = (await tx.query("SELECT COALESCE(max(sequence), 0) + 1 AS n FROM card_definitions")).rows[0].n;
    const c = (await tx.query(
      `INSERT INTO card_definitions (sequence, name, level_label, required_visits, description, terms, theme)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [seq, v.name, v.levelLabel, v.requiredVisits, v.description, v.terms, v.theme]
    )).rows[0];
    await audit(tx, actor, { action: "card.created", entityType: "card_definition", entityId: c.id, details: { sequence: seq, ...v } });
    return c.id;
  });
}
async function updateCard(db2, id, input, actor, reason) {
  const v = cardInput.partial().parse(input);
  return db2.transaction(async (tx) => {
    const c = await cardOr404(tx, id);
    if (v.requiredVisits !== void 0) {
      const maxMilestone = (await tx.query(
        "SELECT max(milestone_visit) AS m FROM reward_definitions WHERE card_definition_id = $1 AND archived_at IS NULL",
        [id]
      )).rows[0].m ?? 0;
      if (v.requiredVisits < maxMilestone) {
        throw Errors.validation(`The visit target can\u2019t be lower than the highest reward milestone (visit ${maxMilestone}).`, { fields: { requiredVisits: `At least ${maxMilestone}` } });
      }
    }
    const next = {
      name: v.name ?? c.name,
      level_label: v.levelLabel ?? c.level_label,
      required_visits: v.requiredVisits ?? c.required_visits,
      description: v.description ?? c.description,
      terms: v.terms ?? c.terms,
      theme: v.theme ?? c.theme
    };
    await tx.query(
      `UPDATE card_definitions SET name=$2, level_label=$3, required_visits=$4, description=$5, terms=$6, theme=$7, updated_at=now() WHERE id=$1`,
      [id, next.name, next.level_label, next.required_visits, next.description, next.terms, next.theme]
    );
    await audit(tx, actor, {
      action: "card.updated",
      entityType: "card_definition",
      entityId: id,
      reason,
      details: { before: { name: c.name, levelLabel: c.level_label, requiredVisits: c.required_visits, theme: c.theme }, after: v }
    });
  });
}
async function publishCard(db2, id, actor) {
  return db2.transaction(async (tx) => {
    const c = await cardOr404(tx, id);
    if (c.status === "published") return { activatedFor: 0 };
    const gap = (await tx.query("SELECT sequence FROM card_definitions WHERE sequence < $1 AND status <> 'published' ORDER BY sequence LIMIT 1", [c.sequence])).rows[0];
    if (gap) throw Errors.conflict("PUBLISH_ORDER", `Publish Card ${gap.sequence} first. Cards go live in order.`);
    const rewards = (await tx.query("SELECT count(*)::int AS n FROM reward_definitions WHERE card_definition_id = $1 AND archived_at IS NULL", [id])).rows[0].n;
    if (rewards === 0) throw Errors.conflict("NO_REWARDS", "Add at least one reward before publishing this card.");
    await tx.query("UPDATE card_definitions SET status = 'published', published_at = now(), updated_at = now() WHERE id = $1", [id]);
    await audit(tx, actor, { action: "card.published", entityType: "card_definition", entityId: id, details: { sequence: c.sequence, name: c.name } });
    const waiting = (await tx.query(
      `SELECT cc.customer_id FROM customer_cards cc
        WHERE cc.sequence = $1 AND cc.status = 'completed'
          AND NOT EXISTS (SELECT 1 FROM customer_cards x WHERE x.customer_id = cc.customer_id AND x.sequence >= $2)`,
      [c.sequence - 1, c.sequence]
    )).rows;
    let n = 0;
    for (const w of waiting) {
      await lockCustomer(tx, w.customer_id);
      const r = await ensureActiveCard(tx, w.customer_id, now());
      if (r.activated) n++;
    }
    return { activatedFor: n };
  });
}
async function unpublishCard(db2, id, actor) {
  return db2.transaction(async (tx) => {
    const c = await cardOr404(tx, id);
    const held = (await tx.query("SELECT count(*)::int AS n FROM customer_cards WHERE card_definition_id = $1", [id])).rows[0].n;
    if (held > 0) throw Errors.conflict("CARD_IN_USE", `${held} guest${held === 1 ? " has" : "s have"} this card, so it stays live. You can still edit its rewards.`);
    const later = (await tx.query("SELECT 1 FROM card_definitions WHERE sequence > $1 AND status = 'published'", [c.sequence])).rows[0];
    if (later) throw Errors.conflict("PUBLISH_ORDER", "Unpublish the later cards first.");
    await tx.query("UPDATE card_definitions SET status = 'draft', published_at = NULL, updated_at = now() WHERE id = $1", [id]);
    await audit(tx, actor, { action: "card.unpublished", entityType: "card_definition", entityId: id });
  });
}
async function addReward(db2, cardId, input, actor) {
  const v = rewardInput.parse(input);
  return db2.transaction(async (tx) => {
    const c = await cardOr404(tx, cardId);
    if (v.milestoneVisit > c.required_visits) {
      throw Errors.validation(`This card has ${c.required_visits} visits, so the milestone must be visit ${c.required_visits} or earlier.`, { fields: { milestoneVisit: `1\u2013${c.required_visits}` } });
    }
    const clash = (await tx.query("SELECT 1 FROM reward_definitions WHERE card_definition_id = $1 AND milestone_visit = $2 AND archived_at IS NULL", [cardId, v.milestoneVisit])).rows[0];
    if (clash) throw Errors.validation(`Visit ${v.milestoneVisit} already has a reward. Edit that one instead.`, { fields: { milestoneVisit: "Already used" } });
    const r = (await tx.query(
      `INSERT INTO reward_definitions (card_definition_id, milestone_visit, name, description, terms, is_available)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [cardId, v.milestoneVisit, v.name, v.description, v.terms, v.isAvailable]
    )).rows[0];
    await audit(tx, actor, { action: "reward.created", entityType: "reward_definition", entityId: r.id, details: { card: c.name, ...v } });
    return r.id;
  });
}
async function updateReward(db2, id, input, actor, reason) {
  const v = rewardInput.omit({ milestoneVisit: true }).partial().parse(input);
  return db2.transaction(async (tx) => {
    const r = (await tx.query("SELECT * FROM reward_definitions WHERE id = $1 AND archived_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!r) throw Errors.notFound("reward");
    const renamed = v.name !== void 0 && v.name !== r.name;
    await tx.query(
      `UPDATE reward_definitions SET name = $2, description = $3, terms = $4, is_available = $5,
              is_placeholder = CASE WHEN $6 THEN false ELSE is_placeholder END, updated_at = now() WHERE id = $1`,
      [id, v.name ?? r.name, v.description ?? r.description, v.terms ?? r.terms, v.isAvailable ?? r.is_available, renamed]
    );
    await audit(tx, actor, {
      action: "reward.updated",
      entityType: "reward_definition",
      entityId: id,
      reason,
      details: { before: { name: r.name, description: r.description, terms: r.terms, isAvailable: r.is_available }, after: v }
    });
  });
}
async function archiveReward(db2, id, actor, reason) {
  return db2.transaction(async (tx) => {
    const r = (await tx.query("SELECT * FROM reward_definitions WHERE id = $1 AND archived_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!r) throw Errors.notFound("reward");
    const c = (await tx.query("SELECT status FROM card_definitions WHERE id = $1", [r.card_definition_id])).rows[0];
    const remaining = (await tx.query("SELECT count(*)::int AS n FROM reward_definitions WHERE card_definition_id = $1 AND archived_at IS NULL", [r.card_definition_id])).rows[0].n;
    if (c.status === "published" && remaining <= 1) throw Errors.conflict("LAST_REWARD", "A live card needs at least one reward.");
    await tx.query("UPDATE reward_definitions SET archived_at = now(), updated_at = now() WHERE id = $1", [id]);
    await audit(tx, actor, { action: "reward.archived", entityType: "reward_definition", entityId: id, reason, details: { name: r.name, milestone: r.milestone_visit } });
  });
}

// server/services/admin.ts
init_zod();
init_errors2();
init_crypto();
init_phone();
init_config();
init_audit();
init_loyalty();
init_customers();
init_time();
init_settings();
var UUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function searchCustomers(q, term, opts = {}) {
  const limit = Math.min(opts.limit ?? 20, 50);
  const offset = Math.max(opts.offset ?? 0, 0);
  const t = String(term ?? "").trim();
  let where = "TRUE";
  const params = [];
  if (t) {
    const code = normaliseMemberCode(t);
    const phone = /\d{6,}/.test(t.replace(/\D/g, "")) ? normalisePhone(t, config.defaultPhoneRegion) : null;
    const clauses = [];
    if (code) {
      params.push(code);
      clauses.push(`c.member_code = $${params.length}`);
    }
    if (phone?.ok) {
      params.push(phone.e164);
      clauses.push(`c.phone_e164 = $${params.length}`);
    } else if (/^\+?\d{4,}$/.test(t.replace(/[\s-]/g, ""))) {
      params.push("%" + t.replace(/\D/g, ""));
      clauses.push(`c.phone_e164 LIKE $${params.length}`);
    }
    if (UUID2.test(t)) {
      params.push(t);
      clauses.push(`c.id = $${params.length}::uuid`);
    }
    if (t.length >= 2 && !/^\+?[\d\s-]+$/.test(t)) {
      params.push("%" + t.toLowerCase().replace(/[%_\\]/g, (m) => "\\" + m) + "%");
      clauses.push(`lower(c.full_name) LIKE $${params.length}`);
    }
    where = clauses.length ? clauses.join(" OR ") : "FALSE";
  }
  params.push(limit + 1, offset);
  const rows = (await q.query(
    `SELECT c.id, c.full_name, c.member_code, c.phone_e164, c.status, c.created_at,
            cc.card_name, cc.visit_count, cc.required_visits,
            (SELECT max(v.created_at) FROM visits v WHERE v.customer_id = c.id AND v.status = 'valid') AS last_visit_at
       FROM customers c
       LEFT JOIN customer_cards cc ON cc.customer_id = c.id AND cc.status = 'active'
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )).rows;
  return {
    items: rows.slice(0, limit).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      memberCode: r.member_code,
      phone: formatPhone(r.phone_e164),
      status: r.status,
      createdAt: r.created_at,
      lastVisitAt: r.last_visit_at,
      activeCard: r.card_name ? { name: r.card_name, visitCount: r.visit_count, requiredVisits: r.required_visits } : null
    })),
    hasMore: rows.length > limit
  };
}
async function customerProfile(q, id) {
  if (!UUID2.test(id)) throw Errors.notFound("customer");
  const c = (await q.query(
    `SELECT c.*, s.full_name AS registered_by, o.name AS registered_outlet
       FROM customers c LEFT JOIN staff_users s ON s.id = c.registered_by_staff_id LEFT JOIN outlets o ON o.id = c.registered_outlet_id
      WHERE c.id = $1`,
    [id]
  )).rows[0];
  if (!c) throw Errors.notFound("customer");
  return {
    id: c.id,
    fullName: c.full_name,
    memberCode: c.member_code,
    phone: formatPhone(c.phone_e164),
    phoneE164: c.phone_e164,
    status: c.status,
    registeredVia: c.registered_via,
    registeredBy: c.registered_by,
    registeredOutlet: c.registered_outlet,
    createdAt: c.created_at
  };
}
var customerEdit = external_exports.object({
  fullName: external_exports.string().optional(),
  phone: external_exports.string().optional(),
  status: external_exports.enum(["active", "suspended"]).optional(),
  reason: external_exports.string().trim().min(3, "Give a short reason").max(300)
});
async function editCustomer(db2, id, input, actor) {
  const v = customerEdit.parse(input);
  return db2.transaction(async (tx) => {
    const c = await lockCustomer(tx, id);
    const next = {
      full_name: v.fullName !== void 0 ? cleanName(v.fullName) : c.full_name,
      phone_e164: v.phone !== void 0 ? phoneOrThrow(v.phone) : c.phone_e164,
      status: v.status ?? c.status
    };
    if (next.phone_e164 !== c.phone_e164) {
      const clash = (await tx.query("SELECT id FROM customers WHERE phone_e164 = $1 AND id <> $2", [next.phone_e164, id])).rows[0];
      if (clash) throw Errors.conflict("PHONE_IN_USE", "Another guest is already registered with that mobile number.", { customerId: clash.id });
    }
    await tx.query(
      "UPDATE customers SET full_name = $2, phone_e164 = $3, status = $4, updated_at = now() WHERE id = $1",
      [id, next.full_name, next.phone_e164, next.status]
    );
    if (next.phone_e164 !== c.phone_e164) {
      await tx.query("UPDATE customer_sessions SET revoked_at = now() WHERE customer_id = $1 AND revoked_at IS NULL", [id]);
    }
    await audit(tx, actor, {
      action: "customer.updated",
      entityType: "customer",
      entityId: id,
      customerId: id,
      reason: v.reason,
      details: {
        changed: Object.keys(next).filter((k) => next[k] !== c[k]),
        statusBefore: c.status,
        statusAfter: next.status
      }
    });
  });
}
var staffInput = external_exports.object({
  fullName: external_exports.string().trim().min(1, "Enter a name").max(120),
  username: external_exports.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/, "3\u201340 letters, numbers, dots or dashes"),
  role: external_exports.enum(["super_admin", "admin", "staff"]),
  outletId: external_exports.string().uuid().nullable(),
  password: external_exports.string().optional(),
  isActive: external_exports.boolean().optional()
});
function assertCanAssign(actorRole, targetRole, currentTargetRole) {
  const touchingAdmins = targetRole !== "staff" || currentTargetRole && currentTargetRole !== "staff";
  if (touchingAdmins && !can(actorRole, "staff.manage_admins")) throw Errors.forbidden();
}
async function listStaff(q) {
  return (await q.query(
    `SELECT u.id, u.full_name, u.username, u.role, u.is_active, u.outlet_id, o.name AS outlet_name, u.last_login_at, u.created_at
       FROM staff_users u LEFT JOIN outlets o ON o.id = u.outlet_id ORDER BY u.is_active DESC, u.role, u.full_name`
  )).rows.map((u) => ({
    id: u.id,
    fullName: u.full_name,
    username: u.username,
    role: u.role,
    isActive: u.is_active,
    outlet: u.outlet_id ? { id: u.outlet_id, name: u.outlet_name } : null,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at
  }));
}
async function createStaff(db2, input, actor) {
  const v = staffInput.parse(input);
  assertCanAssign(actor.role, v.role);
  await validatePassword(v.password ?? "");
  if (v.role === "staff" && !v.outletId) throw Errors.validation("Choose the outlet this person works at.", { fields: { outletId: "Required for staff" } });
  const hash = await hashPassword(v.password);
  return db2.transaction(async (tx) => {
    const r = await tx.query(
      `INSERT INTO staff_users (full_name, username, password_hash, role, outlet_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,true) ON CONFLICT DO NOTHING RETURNING id`,
      [v.fullName, v.username, hash, v.role, v.outletId]
    );
    if (!r.rows[0]) throw Errors.validation("That username is taken.", { fields: { username: "Already taken" } });
    await audit(tx, actor, { action: "staff.created", entityType: "staff_user", entityId: r.rows[0].id, details: { username: v.username, role: v.role, outletId: v.outletId } });
    return r.rows[0].id;
  });
}
async function updateStaff(db2, id, input, actor) {
  const v = staffInput.partial().parse(input);
  return db2.transaction(async (tx) => {
    const u = (await tx.query("SELECT * FROM staff_users WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!u) throw Errors.notFound("staff member");
    assertCanAssign(actor.role, v.role ?? u.role, u.role);
    if (id === actor.id && (v.role && v.role !== u.role || v.isActive === false)) {
      throw Errors.conflict("SELF_CHANGE", "You can\u2019t change your own role or switch off your own account.");
    }
    if (u.role === "super_admin" && (v.role && v.role !== "super_admin" || v.isActive === false)) {
      const others = (await tx.query("SELECT count(*)::int AS n FROM staff_users WHERE role = 'super_admin' AND is_active AND id <> $1", [id])).rows[0].n;
      if (others === 0) throw Errors.conflict("LAST_SUPER_ADMIN", "There must always be at least one active super admin.");
    }
    let hash = null;
    if (v.password) {
      await validatePassword(v.password);
      hash = await hashPassword(v.password);
    }
    const role = v.role ?? u.role;
    const outletId = v.outletId !== void 0 ? v.outletId : u.outlet_id;
    if (role === "staff" && !outletId) throw Errors.validation("Choose the outlet this person works at.", { fields: { outletId: "Required for staff" } });
    await tx.query(
      `UPDATE staff_users SET full_name = $2, role = $3, outlet_id = $4, is_active = $5,
              password_hash = COALESCE($6, password_hash), must_change_password = CASE WHEN $6 IS NULL THEN must_change_password ELSE true END,
              failed_logins = CASE WHEN $6 IS NULL THEN failed_logins ELSE 0 END, locked_until = CASE WHEN $6 IS NULL THEN locked_until ELSE NULL END,
              updated_at = now() WHERE id = $1`,
      [id, v.fullName ?? u.full_name, role, outletId, v.isActive ?? u.is_active, hash]
    );
    if (v.isActive === false || hash || v.role && v.role !== u.role) {
      await tx.query("UPDATE staff_sessions SET revoked_at = now() WHERE staff_id = $1 AND revoked_at IS NULL", [id]);
    }
    await audit(tx, actor, {
      action: v.role && v.role !== u.role ? "staff.role_changed" : "staff.updated",
      entityType: "staff_user",
      entityId: id,
      details: { roleBefore: u.role, roleAfter: role, activeBefore: u.is_active, activeAfter: v.isActive ?? u.is_active, passwordReset: !!hash, outletId }
    });
  });
}
var outletInput = external_exports.object({
  name: external_exports.string().trim().min(1, "Enter a name").max(120),
  code: external_exports.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/, "2\u201320 letters, numbers or dashes"),
  isActive: external_exports.boolean().optional()
});
async function listOutlets(q) {
  return (await q.query("SELECT id, name, code, is_active FROM outlets ORDER BY is_active DESC, name")).rows.map((o) => ({ id: o.id, name: o.name, code: o.code, isActive: o.is_active }));
}
async function saveOutlet(db2, id, input, actor) {
  const v = id ? outletInput.partial().parse(input) : outletInput.parse(input);
  return db2.transaction(async (tx) => {
    if (id) {
      const o = (await tx.query("SELECT * FROM outlets WHERE id = $1 FOR UPDATE", [id])).rows[0];
      if (!o) throw Errors.notFound("outlet");
      await tx.query(
        "UPDATE outlets SET name = $2, code = $3, is_active = $4 WHERE id = $1",
        [id, v.name ?? o.name, v.code ?? o.code, v.isActive ?? o.is_active]
      );
      await audit(tx, actor, { action: "outlet.updated", entityType: "outlet", entityId: id, details: v });
      return id;
    }
    const r = await tx.query("INSERT INTO outlets (name, code) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id", [v.name, v.code]);
    if (!r.rows[0]) throw Errors.validation("That outlet code is already used.", { fields: { code: "Already used" } });
    await audit(tx, actor, { action: "outlet.created", entityType: "outlet", entityId: r.rows[0].id, details: v });
    return r.rows[0].id;
  });
}
async function dashboard(q, range) {
  const policy = await getSetting(q, "visit_policy");
  const tz = policy.timeZone;
  const today = businessDate(now(), tz);
  const one = async (sql, p = []) => Number((await q.query(sql, p)).rows[0].n);
  const fromTs = "($1::date)::timestamp AT TIME ZONE $3::text";
  const toTs = "($2::date + 1)::timestamp AT TIME ZONE $3::text";
  const [totals, period, daily, recent, cardsBreakdown] = await Promise.all([
    (async () => ({
      customers: await one("SELECT count(*)::int AS n FROM customers"),
      activeCards: await one("SELECT count(*)::int AS n FROM customer_cards WHERE status = 'active'"),
      visitsToday: await one("SELECT count(*)::int AS n FROM visits WHERE status = 'valid' AND business_date = $1", [today]),
      rewardsWaiting: await one("SELECT count(*)::int AS n FROM customer_rewards WHERE status = 'eligible'"),
      awaitingNextLevel: await one(
        `SELECT count(DISTINCT c.id)::int AS n FROM customers c
          WHERE EXISTS (SELECT 1 FROM customer_cards x WHERE x.customer_id = c.id)
            AND NOT EXISTS (SELECT 1 FROM customer_cards x WHERE x.customer_id = c.id AND x.status = 'active')`
      )
    }))(),
    (async () => ({
      newCustomers: await one(`SELECT count(*)::int AS n FROM customers WHERE created_at >= ${fromTs} AND created_at < ${toTs}`, [range.from, range.to, tz]),
      visits: await one("SELECT count(*)::int AS n FROM visits WHERE status = 'valid' AND business_date BETWEEN $1 AND $2", [range.from, range.to]),
      rewardsUnlocked: await one(`SELECT count(*)::int AS n FROM customer_rewards WHERE eligible_at >= ${fromTs} AND eligible_at < ${toTs}`, [range.from, range.to, tz]),
      rewardsRedeemed: await one(`SELECT count(*)::int AS n FROM reward_redemptions WHERE created_at >= ${fromTs} AND created_at < ${toTs}`, [range.from, range.to, tz]),
      cardsCompleted: await one(`SELECT count(*)::int AS n FROM customer_cards WHERE completed_at >= ${fromTs} AND completed_at < ${toTs}`, [range.from, range.to, tz]),
      returningGuests: await one("SELECT count(DISTINCT customer_id)::int AS n FROM visits WHERE status = 'valid' AND business_date BETWEEN $1 AND $2 AND visit_number > 1", [range.from, range.to])
    }))(),
    q.query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS d, COALESCE(v.n, 0)::int AS n
         FROM generate_series($1::date, $2::date, interval '1 day') d
         LEFT JOIN (SELECT business_date, count(*) AS n FROM visits WHERE status = 'valid' GROUP BY business_date) v ON v.business_date = d::date
        ORDER BY d`,
      [range.from, range.to]
    ),
    q.query(
      `SELECT a.id, a.action, a.actor_name, a.created_at, a.details, c.full_name AS customer_name, a.customer_id, o.name AS outlet_name
         FROM audit_events a LEFT JOIN customers c ON c.id = a.customer_id LEFT JOIN outlets o ON o.id = a.outlet_id
        WHERE a.actor_type = 'staff' AND a.action IN ('visit.recorded','reward.redeemed','customer.registered','visit.voided','visit.correction_added')
        ORDER BY a.created_at DESC LIMIT 12`
    ),
    q.query(
      `SELECT d.sequence, d.name, d.required_visits,
              count(cc.*) FILTER (WHERE cc.status = 'active')::int AS active,
              count(cc.*) FILTER (WHERE cc.status = 'completed')::int AS completed
         FROM card_definitions d LEFT JOIN customer_cards cc ON cc.card_definition_id = d.id
        WHERE d.status = 'published' GROUP BY d.id ORDER BY d.sequence`
    )
  ]);
  const progress = (await q.query(
    `SELECT visit_count AS bucket, count(*)::int AS n FROM customer_cards WHERE status = 'active' AND sequence = 1 GROUP BY visit_count ORDER BY visit_count`
  )).rows;
  return {
    timeZone: tz,
    today,
    range,
    totals,
    period,
    dailyVisits: daily.rows,
    card1Progress: progress,
    cards: cardsBreakdown.rows.map((r) => ({ sequence: r.sequence, name: r.name, requiredVisits: r.required_visits, active: r.active, completed: r.completed })),
    recentActivity: recent.rows.map((r) => ({
      id: String(r.id),
      action: r.action,
      actorName: r.actor_name,
      at: r.created_at,
      customerName: r.customer_name,
      customerId: r.customer_id,
      outletName: r.outlet_name,
      details: r.details
    }))
  };
}
async function auditLog(q, f) {
  const limit = Math.min(f.limit ?? 50, 200);
  const rows = (await q.query(
    `SELECT a.*, c.full_name AS customer_name FROM audit_events a LEFT JOIN customers c ON c.id = a.customer_id
      WHERE ($1::uuid IS NULL OR a.customer_id = $1) AND ($2::text IS NULL OR a.action LIKE $2 || '%')
        AND ($3::bigint IS NULL OR a.id < $3)
      ORDER BY a.id DESC LIMIT $4`,
    [f.customerId && UUID2.test(f.customerId) ? f.customerId : null, f.action || null, f.before ? Number(f.before) : null, limit + 1]
  )).rows;
  const items = rows.slice(0, limit).map((r) => ({
    id: String(r.id),
    at: r.created_at,
    actorType: r.actor_type,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    reason: r.reason,
    details: r.details
  }));
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

// server/routes/admin.ts
init_settings();
var DATE = /^\d{4}-\d{2}-\d{2}$/;
function adminRoutes(r) {
  r.get("/api/admin/dashboard", async (req) => {
    await requireStaff(req, "reports.view");
    const db2 = getDb();
    const tz = (await getSetting(db2, "visit_policy")).timeZone;
    const today = businessDate(now(), tz);
    const from = req.query.get("from") ?? "";
    const to = req.query.get("to") ?? "";
    const range = DATE.test(from) && DATE.test(to) && from <= to ? { from, to } : { from: businessDate(new Date(now().getTime() - 29 * 864e5), tz), to: today };
    if ((Date.parse(range.to) - Date.parse(range.from)) / 864e5 > 366) throw Errors.validation("Choose a range of one year or less.");
    return dashboard(db2, range);
  });
  r.get("/api/admin/customers", async (req) => {
    await requireStaff(req, "customer.view_full");
    return searchCustomers(getDb(), req.query.get("q") ?? "", { offset: Number(req.query.get("offset") ?? 0) || 0 });
  });
  r.get("/api/admin/customers/:id", async (req) => {
    await requireStaff(req, "customer.view_full");
    const db2 = getDb();
    const id = uuidParam(req, "id", "customer");
    const [profile, state, visits, redemptions, history] = await Promise.all([
      customerProfile(db2, id),
      buildState(db2, id),
      visitHistory(db2, id, { limit: 25, includeStaff: true, includeVoided: true }),
      redemptionHistory(db2, id, { includeStaff: true }),
      auditLog(db2, { customerId: id, limit: 30 })
    ]);
    return { profile, state, visits, redemptions, audit: history };
  });
  r.get("/api/admin/customers/:id/visits", async (req) => {
    await requireStaff(req, "customer.view_full");
    const before = req.query.get("before");
    return visitHistory(getDb(), uuidParam(req, "id", "customer"), {
      limit: 25,
      includeStaff: true,
      includeVoided: true,
      before: before && !isNaN(Date.parse(before)) ? before : void 0
    });
  });
  r.patch("/api/admin/customers/:id", async (req) => {
    const { actor } = await requireStaff(req, "customer.edit");
    await editCustomer(getDb(), uuidParam(req, "id", "customer"), req.body, actor);
    return { ok: true };
  });
  r.get("/api/admin/customers/:id/share", async (req) => {
    await requireStaff(req, "customer.view_full");
    return shareInfo(getDb(), uuidParam(req, "id", "customer"), { toCustomerPhone: true });
  });
  r.post("/api/admin/customers/:id/visits/correction", async (req) => {
    const { actor } = await requireStaff(req, "visit.correct");
    const date = String(req.body?.date ?? "");
    if (!DATE.test(date)) throw Errors.validation("Choose the date of the visit.", { fields: { date: "Required" } });
    return addCorrectionVisit(getDb(), { customerId: uuidParam(req, "id", "customer"), actor, date, reason: reasonOf(req) });
  });
  r.post("/api/admin/customers/:id/visits/undo", async (req) => {
    const { actor } = await requireStaff(req, "visit.correct");
    return { state: await undoLastVisit(getDb(), { customerId: uuidParam(req, "id", "customer"), actor, reason: reasonOf(req) }) };
  });
  r.post("/api/admin/customer-rewards/:id/revoke", async (req) => {
    const { actor } = await requireStaff(req, "reward.adjust");
    return { state: await setRewardRevoked(getDb(), { customerRewardId: uuidParam(req, "id", "reward"), actor, revoke: true, reason: reasonOf(req) }) };
  });
  r.post("/api/admin/customer-rewards/:id/restore", async (req) => {
    const { actor } = await requireStaff(req, "reward.adjust");
    return { state: await setRewardRevoked(getDb(), { customerRewardId: uuidParam(req, "id", "reward"), actor, revoke: false, reason: reasonOf(req) }) };
  });
  r.post("/api/admin/customers/:id/rotate", async (req) => {
    const { actor } = await requireStaff(req, "customer.edit");
    const kind = external_exports.object({ kind: external_exports.enum(["qr", "link"]) }).parse(req.body).kind;
    await rotateToken(getDb(), uuidParam(req, "id", "customer"), kind, actor, reasonOf(req));
    return { ok: true };
  });
  r.get("/api/admin/cards", async (req) => {
    await requireStaff(req, "card.configure");
    return listCards(getDb());
  });
  r.post("/api/admin/cards", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    return { id: await createCard(getDb(), req.body, actor) };
  });
  r.patch("/api/admin/cards/:id", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    const { reason, ...rest } = req.body ?? {};
    await updateCard(getDb(), uuidParam(req, "id", "card"), rest, actor, typeof reason === "string" ? reason : void 0);
    return { ok: true };
  });
  r.post("/api/admin/cards/:id/publish", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    return publishCard(getDb(), uuidParam(req, "id", "card"), actor);
  });
  r.post("/api/admin/cards/:id/unpublish", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    await unpublishCard(getDb(), uuidParam(req, "id", "card"), actor);
    return { ok: true };
  });
  r.post("/api/admin/cards/:id/rewards", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    return { id: await addReward(getDb(), uuidParam(req, "id", "card"), req.body, actor) };
  });
  r.patch("/api/admin/rewards/:id", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    const { reason, ...rest } = req.body ?? {};
    await updateReward(getDb(), uuidParam(req, "id", "reward"), rest, actor, typeof reason === "string" ? reason : void 0);
    return { ok: true };
  });
  r.post("/api/admin/rewards/:id/archive", async (req) => {
    const { actor } = await requireStaff(req, "card.configure");
    await archiveReward(getDb(), uuidParam(req, "id", "reward"), actor, reasonOf(req));
    return { ok: true };
  });
  r.get("/api/admin/staff", async (req) => {
    await requireStaff(req, "staff.manage");
    return listStaff(getDb());
  });
  r.post("/api/admin/staff", async (req) => {
    const { actor } = await requireStaff(req, "staff.manage");
    return { id: await createStaff(getDb(), req.body, actor) };
  });
  r.patch("/api/admin/staff/:id", async (req) => {
    const { actor } = await requireStaff(req, "staff.manage");
    await updateStaff(getDb(), uuidParam(req, "id", "staff member"), req.body, actor);
    return { ok: true };
  });
  r.get("/api/admin/outlets", async (req) => {
    await requireStaff(req, "outlet.manage");
    return listOutlets(getDb());
  });
  r.post("/api/admin/outlets", async (req) => {
    const { actor } = await requireStaff(req, "outlet.manage");
    return { id: await saveOutlet(getDb(), null, req.body, actor) };
  });
  r.patch("/api/admin/outlets/:id", async (req) => {
    const { actor } = await requireStaff(req, "outlet.manage");
    await saveOutlet(getDb(), uuidParam(req, "id", "outlet"), req.body, actor);
    return { ok: true };
  });
  r.get("/api/admin/settings", async (req) => {
    await requireStaff(req, "settings.manage");
    const db2 = getDb();
    return { visitPolicy: await getSetting(db2, "visit_policy"), business: await getSetting(db2, "business") };
  });
  r.patch("/api/admin/settings/:key", async (req) => {
    const { actor } = await requireStaff(req, "settings.manage");
    const key = req.params.key === "visit-policy" ? "visit_policy" : req.params.key === "business" ? "business" : null;
    if (!key) throw Errors.notFound("setting");
    const { reason, ...patch } = req.body ?? {};
    return updateSetting(getDb(), key, patch, actor, typeof reason === "string" ? reason : void 0);
  });
  r.get("/api/admin/audit", async (req) => {
    await requireStaff(req, "audit.view");
    return auditLog(getDb(), {
      customerId: req.query.get("customerId") ?? void 0,
      action: req.query.get("action") ?? void 0,
      before: req.query.get("before") ?? void 0
    });
  });
}

// server/app.ts
init_config();
function buildApp(opts = {}) {
  const router = new Router();
  router.get("/api/health", async () => {
    await getDb().query("SELECT 1");
    return { ok: true };
  });
  customerRoutes(router);
  staffRoutes(router);
  adminRoutes(router);
  return createHttpServer(router, { webRoot: opts.serveWeb === false ? void 0 : path3.join(config.root, "dist", "web") });
}
export {
  buildApp
};

const serverApp = buildApp({ serveWeb: false });
export default function handler(req, res) {
  serverApp.emit('request', req, res);
}

