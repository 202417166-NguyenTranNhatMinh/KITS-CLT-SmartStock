export interface ValidationFieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly status: number;
  public readonly data: unknown;

  constructor(status: number, message: string, data: unknown = null) {
    super(message);
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message = 'Validation failed', errors?: ValidationFieldError[]) {
    return new AppError(400, message, errors ? { errors } : null);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, message);
  }

  static conflict(message: string, data: unknown = null) {
    return new AppError(409, message, data);
  }

  static serviceUnavailable(message = 'External service unavailable') {
    return new AppError(503, message);
  }
}