// Datadog APM initialization
// This must be the very first import before any other modules

import tracer from 'dd-trace';

// Only initialize if DD_API_KEY is set
if (process.env.DD_API_KEY) {
  tracer.init({
    service: 'perps-trader',
    env: process.env.ENVIRONMENT || 'production',
    version: process.env.VERSION || '1.0.0',
    logInjection: true,
    profiling: true,
    runtimeMetrics: true,
  });
}

export default tracer;