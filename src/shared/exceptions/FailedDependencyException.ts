import { HttpException } from '@nestjs/common';

export class FailedDependencyException extends HttpException {
  constructor(message: string) {
    super(message, 424);
  }
}
