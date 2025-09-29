import { HttpException, HttpStatus } from '@nestjs/common';

export class NothingToUpdateException extends HttpException {
  constructor() {
    super('Nothing to update!', HttpStatus.BAD_REQUEST);
  }
}
