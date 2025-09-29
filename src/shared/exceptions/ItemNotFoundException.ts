import { HttpException, HttpStatus } from '@nestjs/common';

export class ItemNotFoundException extends HttpException {
  constructor() {
    super('Item not found!', HttpStatus.NOT_FOUND);
  }
}
