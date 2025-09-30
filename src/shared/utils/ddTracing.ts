// Dynamic import of dd-trace only when needed to avoid auto-initialization
import {
  LoggerService,
  LogLevel,
} from '@nestjs/common/services/logger.service';
import { isLocalMode } from './envChecks';
import * as net from 'net';

export type LoggerServices = 'PERPS_TRADER' | 'CRON_PERPS_TRADER';

export const ddServiceName = (
  env: string,
  service: LoggerServices = 'PERPS_TRADER',
): string => {
  const name = `${env}_${service}/API`.toUpperCase();
  // eslint-disable-next-line no-console
  console.log(`Creating a datadog service with name: ${name}`);
  return name;
};

// For tracing, we only need the agent to be running - no API keys needed
const hasValidDatadogTracingConfig = (): boolean => {
  // Tracing only needs service name, env, version - no API keys required
  return true;
};

// Test Datadog agent connectivity for tracing
const testDatadogAgentConnectivity = async (): Promise<boolean> => {
  try {
    const agentUrl = process.env.DD_AGENT_URL || 'http://datadog-agent:8126';

    // Parse the URL to extract host and port
    const url = new URL(agentUrl);
    const host = url.hostname;
    const port = parseInt(url.port) || 8126;

    console.log(`Testing Datadog agent connectivity to ${host}:${port}...`);

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 5000; // 5 second timeout

      socket.setTimeout(timeout);

      socket.connect(port, host, () => {
        console.log('✓ Datadog agent is reachable');
        socket.destroy();
        resolve(true);
      });

      socket.on('error', (err) => {
        console.warn(`⚠ Datadog agent unreachable: ${err.message}`);
        socket.destroy();
        resolve(false);
      });

      socket.on('timeout', () => {
        console.warn('⚠ Datadog agent connection timeout');
        socket.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    console.warn(`⚠ Datadog agent connectivity test failed: ${error.message}`);
    return false;
  }
};

export const ddInitializer = async (
  env: string,
  version: string,
  service?: LoggerServices,
): Promise<void> => {
  try {
    // Check if tracing is explicitly disabled
    const enableTracing = process.env.DD_TRACE_ENABLED !== 'false';

    if (!isLocalMode() && hasValidDatadogTracingConfig() && enableTracing) {
      console.log('Initializing Datadog tracer...');

      // Test agent connectivity first (required for tracing)
      const agentReachable = await testDatadogAgentConnectivity();

      if (!agentReachable) {
        console.warn(
          'Datadog agent is not reachable, skipping tracing initialization',
        );
        return;
      }

      const serviceName = ddServiceName(env, service);
      console.log(`Using service name: ${serviceName}`);

      // Configure agent URL based on environment
      const agentUrl = process.env.DD_AGENT_URL || 'http://datadog-agent:8126';

      // Dynamically import dd-trace only after confirming agent connectivity
      const tracer = await import('dd-trace');

      tracer.default.init({
        startupLogs: true,
        logInjection: true,
        profiling: true,
        runtimeMetrics: true,
        env: env?.toUpperCase(),
        version,
        service: serviceName,
        url: agentUrl,
      });
      console.log('Datadog tracer initialized successfully');
    } else {
      console.log(
        'Skipping Datadog tracing initialization - using logging only',
      );
    }
  } catch (error) {
    console.error('Failed to initialize Datadog tracer:', error);
    console.log('Falling back to local logging');
  }
};

export const getLogger = async (
  service?: LoggerServices,
): Promise<LoggerService | LogLevel[]> => {
  try {
    if (isLocalMode()) {
      console.log('Using local logging configuration');
      return ['error', 'warn', 'debug', 'verbose', 'log'];
    }

    // Log the service being used for debugging
    if (service) {
      console.log(`Setting up logger for service: ${service}`);
    }

    // Test Datadog agent connectivity - use agent for both tracing and logging
    const agentReachable = await testDatadogAgentConnectivity();

    if (!agentReachable) {
      console.log('Datadog agent is not reachable, using local logging only');
      return ['error', 'warn', 'debug', 'verbose', 'log'];
    }

    // Create Winston logger for structured JSON logging
    const winston = await import('winston');
    const { WinstonModule } = await import('nest-winston');

    const logger = WinstonModule.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(
          ({ timestamp, level, message, context, trace, ...meta }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const logEntry: Record<string, any> = {
              timestamp,
              level,
              message,
              service: service || 'ATRADER',
            };

            if (context) {
              logEntry.context = context;
            }

            if (trace) {
              logEntry.trace = trace;
            }

            // Add any additional metadata
            Object.assign(logEntry, meta);

            return JSON.stringify(logEntry);
          },
        ),
      ),
      transports: [
        new winston.transports.Console({
          level: 'debug',
        }),
      ],
    });

    console.log('Datadog agent is reachable, using structured JSON logging');
    return logger;
  } catch (error) {
    console.error('Error setting up logger:', error);
    console.log('Falling back to local logging due to error');
    return ['error', 'warn', 'debug', 'verbose', 'log'];
  }
};
