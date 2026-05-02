import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | undefined;

export const startTracing = (serviceName: string, otlpEndpoint?: string): void => {
  if (sdk) return;
  sdk = new NodeSDK({
    serviceName,
    traceExporter: otlpEndpoint
      ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
      : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Avoid noisy fs spans
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
};

export const stopTracing = async (): Promise<void> => {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
};
