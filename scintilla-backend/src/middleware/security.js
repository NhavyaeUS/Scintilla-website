const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
};

const corsOptions = {
  origin: (origin, cb) => {
    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || "";
    const allowed = allowedOriginsRaw.split(",");
    
    // Allow local development without origin or within valid list
    if (!origin || allowed.includes(origin) || process.env.NODE_ENV !== "production") {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
};

const securityHeaders = {
  contentSecurityPolicy: true, // Restricts resource origins
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  frameguard: {
    action: "deny",
  },
  noSniff: true,
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  }
};

module.exports = {
  httpsRedirect,
  corsOptions,
  securityHeaders
};
