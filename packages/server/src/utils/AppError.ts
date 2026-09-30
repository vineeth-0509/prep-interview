export class AppError extends Error {
  code: string;
  status: number;
  step?: string;

  constructor(code: string, message: string, status = 400, step?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.step = step;
  }
}
