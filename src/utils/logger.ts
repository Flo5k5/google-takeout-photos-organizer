import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';

const defaultLogDir = process.env.LOG_DIR || './logs';

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

function buildTransports(
  logDir: string,
  enableConsole: boolean,
  enableFile: boolean
): winston.transport[] {
  const transports: winston.transport[] = [];

  if (enableFile) {
    transports.push(
      new winston.transports.File({
        filename: path.join(logDir, 'processing.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logDir, 'errors.log'),
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  }

  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...metadata }) => {
            let msg = `${timestamp} [${level}]: ${message}`;
            if (Object.keys(metadata).length > 0) {
              msg += ` ${JSON.stringify(metadata)}`;
            }
            return msg;
          })
        ),
      })
    );
  }

  return transports;
}

await fs.ensureDir(defaultLogDir);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: baseFormat,
  defaultMeta: { service: 'takeout-processor' },
  transports: buildTransports(defaultLogDir, process.env.NODE_ENV !== 'production', true),
});

export async function configureLogger(options: {
  level: string;
  logDir: string;
  console: boolean;
  file: boolean;
}): Promise<void> {
  const logDir = options.logDir || defaultLogDir;
  await fs.ensureDir(logDir);

  logger.configure({
    level: options.level || logger.level,
    format: baseFormat,
    defaultMeta: { service: 'takeout-processor' },
    transports: buildTransports(logDir, options.console, options.file),
  });
}

export default logger;
