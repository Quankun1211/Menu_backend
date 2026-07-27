export const validate = (schema, target = "body") => (req, res, next) => {
  const { value, error } = schema.validate(req[target], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors: error.details.map(({ path, message }) => ({ field: path.join("."), message })),
    });
  }
  if (target === "query") {
    Object.defineProperty(req, "query", { value, configurable: true, enumerable: true });
  } else {
    req[target] = value;
  }
  next();
};

export const validateMultipart = (schema) => validate(schema, "body");
