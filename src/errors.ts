export class UpstreamError extends Error {
  readonly statusCode: number | undefined;

  constructor(
    message: string,
    options?: { readonly cause?: unknown; readonly statusCode?: number | undefined },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "UpstreamError";
    this.statusCode = options?.statusCode;
  }
}
