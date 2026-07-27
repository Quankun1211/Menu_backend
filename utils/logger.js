const write = (level, message, metadata = {}) => {
  const safeMetadata = { ...metadata };
  for (const key of ["password", "token", "authorization", "secret", "otp"]) {
    if (key in safeMetadata) safeMetadata[key] = "[REDACTED]";
  }
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...safeMetadata,
  }));
};

export const logger = {
  info: (message, metadata) => write("info", message, metadata),
  warn: (message, metadata) => write("warn", message, metadata),
  error: (message, metadata) => write("error", message, metadata),
};
