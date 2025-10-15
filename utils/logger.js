// utils/logger.js

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
};

const formatLog = (logData) => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    const time = formatTimestamp(logData.timestamp);
    const level = logData.level.padEnd(5);
    
    let levelColor = colors.white;
    switch (logData.level) {
      case 'ERROR': levelColor = colors.red; break;
      case 'WARN': levelColor = colors.yellow; break;
      case 'INFO': levelColor = colors.green; break;
      case 'DEBUG': levelColor = colors.cyan; break;
    }
    
    let formatted = `${colors.gray}${time}${colors.reset} ${levelColor}${level}${colors.reset} ${colors.bright}${logData.message}${colors.reset}`;
    
    const metaKeys = Object.keys(logData).filter(key => 
      !['timestamp', 'level', 'service', 'message'].includes(key)
    );
    
    if (metaKeys.length > 0) {
      const metaData = {};
      metaKeys.forEach(key => {
        metaData[key] = logData[key];
      });
      formatted += `\n${colors.dim}${JSON.stringify(metaData, null, 2)}${colors.reset}`;
    }
    
    return formatted;
  } else {
    return JSON.stringify(logData);
  }
};

const logger = {
  info: (message, meta = {}) => {
    const logData = {
      // timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...meta
    };
    console.log(formatLog(logData));
  },
  warn: (message, meta = {}) => {
    const logData = {
      // timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      ...meta
    };
    console.warn(formatLog(logData));
  },
  error: (message, error = null, meta = {}) => {
    const logData = {
      // timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : null,
      ...meta
    };
    console.error(formatLog(logData));
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      const logData = {
        // timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        ...meta
      };
      console.debug(formatLog(logData));
    }
  }
};

module.exports = logger;
