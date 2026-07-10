const logger = require('../utils/logger');

/**
 * HTTPS redirect middleware.
 * Validates host header against allowed origins to prevent host header injection.
 */
const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    if (req.headers["x-forwarded-proto"] !== "https") {
      // Validate host header to prevent host header injection
      const host = req.headers.host || "";
      const allowedHosts = (process.env.ALLOWED_ORIGINS || "")
        .split(",")
        .map(o => {
          try { return new URL(o.trim()).host; } catch { return ""; }
        })
        .filter(Boolean);

      if (allowedHosts.length > 0 && !allowedHosts.includes(host)) {
        logger.warn("Host header injection attempt blocked", { host, ip: req.ip });
        return res.status(400).json({ status: "error", message: "Bad request" });
      }

      return res.redirect(301, `https://${host}${req.url}`);
    }
  }
  next();
};

/**
 * CORS configuration.
 * Strict origin checking — no blanket bypasses.
 */
const corsOptions = {
  origin: (origin, cb) => {
    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || "";
    const allowed = allowedOriginsRaw.split(",").map(o => o.trim()).filter(Boolean);
    
    // Allow requests with no origin (same-origin, server-to-server, curl)
    // or requests from explicitly allowed origins
    if (!origin || allowed.includes(origin)) {
      cb(null, true);
    } else {
      logger.warn("CORS rejection", { origin });
      cb(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
};

/**
 * Helmet security headers configuration.
 * Hand-tuned CSP, HSTS with preload, Permissions-Policy.
 */
const securityHeaders = {
  // Explicit Content-Security-Policy directives
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  // Cross-origin policies
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  // HSTS: 1 year, include subdomains, preload-ready
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  // Prevent clickjacking
  frameguard: {
    action: "deny",
  },
  // Prevent MIME sniffing
  noSniff: true,
  // Referrer policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  // Disable DNS prefetching
  dnsPrefetchControl: { allow: false },
};

/**
 * Permissions-Policy middleware.
 * Disables access to sensitive browser APIs.
 */
const permissionsPolicy = (req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
  );
  next();
};

module.exports = {
  httpsRedirect,
  corsOptions,
  securityHeaders,
  permissionsPolicy,
};
