const blockedKeys = new Set(["__proto__", "prototype", "constructor"]);

const inspectValue = (value, path = "request", depth = 0) => {
  if (depth > 8) throw new Error(`${path} vượt quá độ sâu cho phép`);
  if (typeof value === "string" && value.length > 20_000) {
    throw new Error(`${path} vượt quá độ dài cho phép`);
  }
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error(`${path} có quá nhiều phần tử`);
    value.forEach((item, index) => inspectValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 200) throw new Error(`${path} có quá nhiều thuộc tính`);
    for (const [key, child] of entries) {
      if (blockedKeys.has(key) || key.startsWith("$") || key.includes(".")) {
        throw new Error(`${path}.${key} không được phép`);
      }
      inspectValue(child, `${path}.${key}`, depth + 1);
    }
  }
};

export const validateRequestEnvelope = (req, res, next) => {
  try {
    inspectValue(req.params, "params");
    inspectValue(req.query, "query");
    inspectValue(req.body, "body");
    next();
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
